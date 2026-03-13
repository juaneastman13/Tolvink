import { memo } from "react";
import { C } from "../theme";
import { stCfg } from "../constants";

export const Av = memo(function Av({ letters, size=36, color=C.pri }) {
  return <div style={{ width:size, height:size, borderRadius:size, display:"flex", alignItems:"center", justifyContent:"center", background:`${color}12`, color, fontSize:size*0.4, fontWeight:700, letterSpacing:0.5, flexShrink:0, border:`1.5px solid ${color}22` }}>{letters}</div>;
});

export const Bd = memo(function Bd({ children, color=C.pri, bg, small }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:small?"2px 8px":"4px 10px", borderRadius:6, fontSize:small?12.8:12.1, fontWeight:600, background:bg||`${color}0D`, color, whiteSpace:"nowrap", letterSpacing:0.2 }}>{children}</span>;
});

export const Tabs = memo(function Tabs({ items, active, onChange }) {
  return <div style={{ display:"flex", gap:2, background:C.bgInput, borderRadius:10, padding:3 }}>{items.map(t=><button key={t.k} onClick={()=>onChange(t.k)} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:"none", fontFamily:"inherit", fontSize:12.1, fontWeight:active===t.k?700:500, cursor:"pointer", background:active===t.k?C.w:"transparent", color:active===t.k?C.pri:C.t3, boxShadow:active===t.k?C.sh:"none", transition:"all 0.15s" }}>{t.l}</button>)}</div>;
});

export function SortTh({ label, colKey, sortCol, sortDir, onSort }) {
  const active = sortCol === colKey;
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th onClick={() => onSort(colKey)} style={{ padding:"9px 10px", textAlign:"left", fontWeight:700, color: active ? C.pri : C.t2, fontSize:11, whiteSpace:"nowrap", borderBottom:`1px solid ${C.b1}`, cursor:"pointer", userSelect:"none", textTransform:"uppercase", letterSpacing:0.5 }}>
      {label}{arrow && <span style={{ color: C.pri, fontWeight: 800 }}>{arrow}</span>}
    </th>
  );
}

// ======================== CSV EXPORT =================================

export function exportCSV(freights, filename) {
  const headers = ["Código","Estado","Productor","Origen","Destino","Producto","Cantidad","Unidad","Camión","Fecha Carga","Hora","Transportista","Notas"];
  const rows = freights.map(f => {
    const st = stCfg(f.status);
    const fmtDate = f.loadDate ? f.loadDate.slice(8,10)+"-"+f.loadDate.slice(5,7)+"-"+f.loadDate.slice(2,4) : "";
    return [f.code, st.label, f.requestedByName||"", (f.originName||"").split("—")[0].trim(), f.destName, f.grain, f.tons, f.unit||"tn", f.truckPlate||"", fmtDate, f.loadTime, f.transporterName||"", (f.notes||"").replace(/[\n\r]+/g," ")];
  });
  const escape = v => { const s = String(v||""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "tolvink-fletes.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ======================== EXCEL EXPORT (SpreadsheetML) =================

const _REPORT_HEADERS = ["Código","Estado","Empresa","Campo","Lote","Destino","Producto","Cantidad","Unidad","Matrícula","Fecha Carga","Hora","Transportista","Chofer","Celular","Notas"];

function _reportRows(freights) {
  return freights.map(f => {
    const st = stCfg(f.status);
    const fmtDate = f.loadDate ? f.loadDate.slice(8,10)+"/"+f.loadDate.slice(5,7)+"/"+f.loadDate.slice(0,4) : "";
    return [f.code, st.label, f.originCompanyName||f.originName||"", f.fieldName||"", f.originName||"", f.destName||"", f.grain==="Otros"?f.productTypeOther||"Otros":f.grain||"", f.tons||"", f.unit||"tn", f.truckPlate||"", fmtDate, f.loadTime||"", f.transporterName||"", f.driverName||"", f.driverPhone||"", (f.notes||"").replace(/[\n\r]+/g," ")];
  });
}

export function exportExcel(freights, filename) {
  const rows = _reportRows(freights);
  const esc = v => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const headerCells = _REPORT_HEADERS.map(h => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("");
  const dataRows = rows.map(r => "<Row>" + r.map(v => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join("") + "</Row>").join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style></Styles>
<Worksheet ss:Name="Fletes"><Table>
<Row>${headerCells}</Row>
${dataRows}
</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "tolvink-fletes.xls"; a.click();
  URL.revokeObjectURL(url);
}

// ======================== PDF EXPORT (HTML → Print) ====================

export function exportPDF(freights, title) {
  const rows = _reportRows(freights);
  const esc = v => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const today = new Date().toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"});
  const headerCells = _REPORT_HEADERS.map(h => `<th>${esc(h)}</th>`).join("");
  const dataRows = rows.map(r => "<tr>" + r.map(v => `<td>${esc(v)}</td>`).join("") + "</tr>").join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title||"Informe de Fletes")}</title>
<style>
@page{size:landscape;margin:10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;font-size:9px;color:#1a1a1a;padding:8mm}
h1{font-size:16px;margin-bottom:2px}
.sub{font-size:10px;color:#666;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:8px}
th{background:#003882;color:#fff;padding:5px 4px;text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap}
td{padding:4px;border-bottom:1px solid #e0e0e0;white-space:nowrap}
tr:nth-child(even){background:#f8f9fa}
.footer{margin-top:8px;font-size:8px;color:#999;text-align:right}
</style></head><body>
<h1>${esc(title||"Informe de Fletes")} — Tolvink</h1>
<div class="sub">${rows.length} flete${rows.length!==1?"s":""} · Generado el ${today}</div>
<table><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>
<div class="footer">tolvink.com</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
