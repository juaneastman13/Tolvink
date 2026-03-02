import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// ─── Brand colors ───
const PRI = '#1A6B37';
const ACC = '#FF6A00';
const SEC = '#0891B2';
const T1 = '#18251C';
const T2 = '#4A6352';
const T3 = '#8A9C90';
const B1 = '#DEE4E0';
const BG_ALT = [247, 248, 247];

const STATUS_LABELS = {
  draft:'Borrador', pending_assignment:'Solicitado', assigned:'Asignado a flota',
  accepted:'Confirmado camión', in_progress:'En curso', loaded:'Cargando',
  finished:'Finalizado', canceled:'Cancelado',
};
const STATUS_COLORS = {
  draft:'#71717A', pending_assignment:'#FF6A00', assigned:'#0891B2',
  accepted:'#2563EB', in_progress:'#4ADE80', loaded:'#22C55E',
  finished:'#1A6B37', canceled:'#DC2626',
};

const hex = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

function haversineKm(lat1,lng1,lat2,lng2) {
  const R = 6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function fmtDateTime(d) {
  if(!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) + ' ' +
           dt.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',hour12:false});
  } catch { return String(d); }
}

function fmtDuration(ms) {
  const min = Math.round(ms/60000);
  if(min <= 0) return '—';
  return min > 60 ? `${Math.floor(min/60)}h ${min%60}min` : `${min} min`;
}

// Draw section header bar
function sectionHeader(doc, y, _W, M, CW, color, text) {
  doc.setFillColor(...hex(color));
  doc.roundedRect(M, y, CW, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica','bold');
  doc.setFontSize(9);
  doc.setTextColor(255,255,255);
  doc.text(text, M+4, y+4.8);
}

// ─── Main export ───
export async function generateFreightPDF(freight, auditLog = []) {
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15, CW = W - 2*M;
  let y = M;

  // ═══════════════════════════════════════════════════════════════════════
  // HEADER — Logo + title + code/status
  // ═══════════════════════════════════════════════════════════════════════
  // Logo: "tolvink" text + orange dot (same as app)
  doc.setFont('helvetica','bold');
  doc.setFontSize(28);
  doc.setTextColor(...hex(PRI));
  doc.text('tolvink', M, y+10);
  const twW = doc.getTextWidth('tolvink');
  doc.setFillColor(...hex(ACC));
  doc.circle(M + twW + 3, y + 3, 2.5, 'F');

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(...hex(T2));
  doc.setFont('helvetica','normal');
  doc.text('Informe de Flete', M, y+15);

  // Right: code + status badge
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.setTextColor(...hex(T1));
  doc.text(freight.code || '—', W-M, y+6, { align:'right' });

  const stColor = STATUS_COLORS[freight.status] || '#71717A';
  const stLabel = STATUS_LABELS[freight.status] || freight.status;
  doc.setFontSize(7);
  const stW = doc.getTextWidth(stLabel) + 8;
  doc.setFillColor(...hex(stColor));
  doc.roundedRect(W-M-stW, y+8, stW, 5, 1.5, 1.5, 'F');
  doc.setTextColor(255,255,255);
  doc.text(stLabel, W-M-stW/2, y+11.5, { align:'center' });

  y += 18;

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(...hex(T3));
  doc.setFont('helvetica','normal');
  const now = new Date();
  doc.text(`Generado el ${now.toLocaleDateString('es-UY',{day:'2-digit',month:'long',year:'numeric'})} a las ${now.toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',hour12:false})}`, M, y);
  y += 3;

  doc.setDrawColor(...hex(B1));
  doc.setLineWidth(0.5);
  doc.line(M, y, W-M, y);
  y += 6;

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1 — Información del flete
  // ═══════════════════════════════════════════════════════════════════════
  sectionHeader(doc, y, W, M, CW, PRI, 'INFORMACIÓN DEL FLETE');
  y += 10;

  const product = freight.grain === 'Otros' ? (freight.productTypeOther || 'Otros') : freight.grain;
  const campoLote = [freight.fieldName, freight.originName].filter(Boolean).join(' / ') || '—';
  const truck = freight.truckPlate ? `${freight.truckPlate}${freight.truckModel ? ' · '+freight.truckModel : ''}` : '—';

  const infoRows = [
    ['Código', freight.code || '—'],
    ['Producto', `${product} · ${freight.tons} ${freight.unit || 'tn'}`],
    ['Empresa', freight.originCompanyName || freight.originName || '—'],
    ['Campo / Lote', campoLote],
    ['Destino', freight.destName || '—'],
    ['Fecha de carga', freight.loadDate || '—'],
    ['Hora de carga', freight.loadTime || '—'],
    ['Solicitado por', freight.requestedByName || '—'],
    ['Transportista', freight.transporterName || '—'],
    ['Camión', truck],
    ['Chofer', freight.driverName || '—'],
    ['Teléfono', freight.driverPhone || '—'],
  ];
  if (freight.amount > 0) infoRows.push(['Importe', `$${Number(freight.amount).toLocaleString('es-UY')}`]);
  if (freight.isOwnFleet) infoRows.push(['Tipo', 'Flota propia']);
  if (freight.notes) infoRows.push(['Observaciones', freight.notes]);

  autoTable(doc, {
    startY: y, head:[], body: infoRows, theme:'plain',
    margin:{left:M,right:M},
    columnStyles:{
      0:{cellWidth:35,fontStyle:'bold',textColor:hex(T2),fontSize:9},
      1:{textColor:hex(T1),fontSize:9},
    },
    styles:{
      cellPadding:{top:2,bottom:2,left:4,right:4},
      lineColor:hex(B1), lineWidth:0.2, font:'helvetica',
    },
    alternateRowStyles:{fillColor:BG_ALT},
  });
  y = doc.lastAutoTable.finalY + 8;

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2 — Recorrido
  // ═══════════════════════════════════════════════════════════════════════
  sectionHeader(doc, y, W, M, CW, SEC, 'RECORRIDO');
  y += 10;

  const hasCoords = freight.originLat && freight.originLng && freight.destLat && freight.destLng;
  const routeRows = [];

  if (hasCoords) {
    const lineal = haversineKm(freight.originLat, freight.originLng, freight.destLat, freight.destLng);
    const road = lineal * 1.3; // road factor
    const estMin = Math.round(road / 60 * 60); // ~60 km/h

    routeRows.push(
      ['Origen', `${freight.originCompanyName||freight.originName||'Origen'} (${Number(freight.originLat).toFixed(4)}, ${Number(freight.originLng).toFixed(4)})`],
      ['Destino', `${freight.destName||'Destino'} (${Number(freight.destLat).toFixed(4)}, ${Number(freight.destLng).toFixed(4)})`],
      ['Distancia estimada', `~${Math.round(road)} km (línea recta: ${Math.round(lineal)} km)`],
      ['Tiempo estimado', `~${fmtDuration(estMin*60000)} (a 60 km/h promedio)`],
    );
  } else {
    routeRows.push(
      ['Origen', freight.originCompanyName || freight.originName || '—'],
      ['Destino', freight.destName || '—'],
      ['Coordenadas', 'No disponibles'],
    );
  }

  // Real timestamps
  if (freight.startedAt) routeRows.push(['Inicio real', fmtDateTime(freight.startedAt)]);
  if (freight.loadedAt) routeRows.push(['Cargado', fmtDateTime(freight.loadedAt)]);
  if (freight.finishedAt) routeRows.push(['Finalizado', fmtDateTime(freight.finishedAt)]);

  // Actual duration
  if (freight.startedAt && freight.finishedAt) {
    const ms = new Date(freight.finishedAt) - new Date(freight.startedAt);
    if(ms > 0) routeRows.push(['Duración real', fmtDuration(ms)]);
  }

  autoTable(doc, {
    startY: y, head:[], body: routeRows, theme:'plain',
    margin:{left:M,right:M},
    columnStyles:{
      0:{cellWidth:35,fontStyle:'bold',textColor:hex(T2),fontSize:9},
      1:{textColor:hex(T1),fontSize:9},
    },
    styles:{
      cellPadding:{top:2,bottom:2,left:4,right:4},
      lineColor:hex(B1), lineWidth:0.2, font:'helvetica',
    },
    alternateRowStyles:{fillColor:[236,254,255]},
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Static map image + QR code ──
  const GMAPS_KEY = import.meta.env.VITE_GMAPS_KEY || '';
  if (hasCoords && GMAPS_KEY) {
    try {
      const oLat = Number(freight.originLat).toFixed(6);
      const oLng = Number(freight.originLng).toFixed(6);
      const dLat = Number(freight.destLat).toFixed(6);
      const dLng = Number(freight.destLng).toFixed(6);
      // Get driving route polyline from Directions API
      let routePath = `color:0x1A6B37|weight:3|${oLat},${oLng}|${dLat},${dLng}`;
      try {
        const dirResp = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&key=${GMAPS_KEY}`);
        if (dirResp.ok) {
          const dirData = await dirResp.json();
          const poly = dirData.routes?.[0]?.overview_polyline?.points;
          if (poly) routePath = `color:0x1A6B37|weight:3|enc:${poly}`;
        }
      } catch (_) { /* fallback to straight line */ }
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&markers=color:green|label:O|${oLat},${oLng}&markers=color:red|label:D|${dLat},${dLng}&path=${encodeURIComponent(routePath)}&key=${GMAPS_KEY}`;
      const mapResp = await fetch(mapUrl);
      if (mapResp.ok) {
        const mapBlob = await mapResp.blob();
        const mapDataUrl = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(mapBlob); });
        if (y + 80 > H - 20) { doc.addPage(); y = M; }
        doc.addImage(mapDataUrl, 'PNG', M, y, CW, 70);
        y += 75;
      }
    } catch (_) { /* skip map/QR on error */ }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3 — Historial de cambios
  // ═══════════════════════════════════════════════════════════════════════
  if (y > H - 50) { doc.addPage(); y = M; }

  sectionHeader(doc, y, W, M, CW, ACC, 'HISTORIAL DE CAMBIOS');
  y += 10;

  const actionLabels = {
    created:'Solicitado', assigned:'Asignado', accepted:'Aceptado', rejected:'Rechazado',
    started:'Viaje iniciado', confirm_loaded:'Carga confirmada', confirm_finished:'Entrega confirmada',
    finished:'Finalizado', canceled:'Cancelado', authorized:'Autorizado', updated:'Editado',
  };

  if (auditLog.length > 0) {
    autoTable(doc, {
      startY: y,
      head:[['Acción','Usuario','Empresa','Fecha','Motivo']],
      body: auditLog.map(log => [
        actionLabels[log.action]||log.action,
        log.user?.name||'Sistema',
        log.user?.company?.name||'—',
        fmtDateTime(log.createdAt),
        log.reason||'',
      ]),
      theme:'grid',
      margin:{left:M,right:M},
      headStyles:{fillColor:hex(ACC),textColor:[255,255,255],fontStyle:'bold',fontSize:8,font:'helvetica'},
      styles:{cellPadding:{top:2,bottom:2,left:3,right:3},fontSize:8,textColor:hex(T1),lineColor:hex(B1),lineWidth:0.2,font:'helvetica'},
      alternateRowStyles:{fillColor:[255,243,232]},
      columnStyles:{0:{fontStyle:'bold',cellWidth:28},1:{cellWidth:28},2:{cellWidth:28},3:{cellWidth:32}},
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    doc.setFont('helvetica','italic');
    doc.setFontSize(9);
    doc.setTextColor(...hex(T3));
    doc.text('Sin registros de historial disponibles', M+4, y+2);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4 — Documentos
  // ═══════════════════════════════════════════════════════════════════════
  if (y > H - 40) { doc.addPage(); y = M; }

  sectionHeader(doc, y, W, M, CW, PRI, 'DOCUMENTOS');
  y += 10;

  const docs = freight.documents || [];
  if (docs.length > 0) {
    const stepLabels = {request:'Solicitud',assignment:'Asignación',load_confirmation:'Carga',delivery:'Entrega'};
    autoTable(doc, {
      startY: y,
      head:[['Nombre','Tipo','Etapa','Fecha']],
      body: docs.map((d,i) => [
        d.name || d.fileName || `Documento ${i+1}`,
        (d.mimeType||d.type||'').includes('image') ? 'Imagen' : (d.mimeType||d.type||'').includes('pdf') ? 'PDF' : 'Archivo',
        stepLabels[d.step] || d.step || '—',
        fmtDateTime(d.createdAt),
      ]),
      theme:'grid',
      margin:{left:M,right:M},
      headStyles:{fillColor:hex(PRI),textColor:[255,255,255],fontStyle:'bold',fontSize:8,font:'helvetica'},
      styles:{cellPadding:{top:2,bottom:2,left:3,right:3},fontSize:8,textColor:hex(T1),lineColor:hex(B1),lineWidth:0.2,font:'helvetica'},
      alternateRowStyles:{fillColor:[228,243,234]},
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    doc.setFont('helvetica','italic');
    doc.setFontSize(9);
    doc.setTextColor(...hex(T3));
    doc.text('Sin documentos adjuntos', M+4, y+2);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // QR CODE — at the end
  // ═══════════════════════════════════════════════════════════════════════
  try {
    const shareParam = freight.shareToken ? `?s=${freight.shareToken}` : '';
    const qrUrl = `https://tolvink.com/${freight.code}/informe${shareParam}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
    if (y + 50 > H - 20) { doc.addPage(); y = M; }
    doc.addImage(qrDataUrl, 'PNG', W/2 - 15, y, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...hex(T3));
    doc.text('Escanear para ver este informe en Tolvink', W/2, y + 34, { align: 'center' });
    y += 40;
  } catch (_) { /* skip QR on error */ }

  // ═══════════════════════════════════════════════════════════════════════
  // FOOTER — all pages
  // ═══════════════════════════════════════════════════════════════════════
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...hex(B1));
    doc.setLineWidth(0.3);
    doc.line(M, H-12, W-M, H-12);
    doc.setFontSize(7);
    doc.setTextColor(...hex(T3));
    doc.setFont('helvetica','normal');
    doc.text('Generado por Tolvink · tolvink.app', M, H-8);
    doc.text(`Página ${i} de ${pages}`, W-M, H-8, { align:'right' });
  }

  // Save — try doc.save first, fallback to blob+anchor, then window.open
  const filename = `${freight.code || 'flete'}-informe.pdf`;
  try {
    doc.save(filename);
    return;
  } catch (_) { /* fallback below */ }

  // Fallback: blob + <a download>
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 30000);
    return;
  } catch (_) { /* fallback below */ }

  // Last resort: open in new tab
  const blobUrl = doc.output('bloburl');
  window.open(blobUrl, '_blank', 'noopener');
}
