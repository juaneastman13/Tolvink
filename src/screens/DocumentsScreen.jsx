import { useState, useEffect, useCallback, useMemo } from "react";
import { C, Ic, STATUS_COLORS } from "../theme";
import { Loader, EmptyState } from "../components";
import { apiGetCompanyAccess, apiListFreights, apiGetWeighTickets, apiGetFreight } from "../api";

const API_URL = import.meta.env.VITE_API_URL || "";
const DOC_TYPE_ICONS = {
  pesaje: (c, s) => Ic.doc(c, s),
  ticket: (c, s) => Ic.doc(c, s),
  remito: (c, s) => Ic.doc(c, s),
  carta_porte: (c, s) => Ic.doc(c, s),
  analisis: (c, s) => Ic.doc(c, s),
  photo: (c, s) => Ic.cam(c, s),
};
const DOC_TYPE_LABELS = {
  origin: "Ticket origen", destination: "Ticket destino",
  request: "Solicitud", assignment: "Asignación",
  load_confirmation: "Carga", delivery_confirmation: "Entrega",
  cancellation: "Cancelación",
};

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-UY", { day: "2-digit", month: "short" }) + " " + dt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}
function fmtWeight(v) {
  if (v == null) return "—";
  const n = Number(v);
  return isNaN(n) ? "—" : n.toLocaleString("es-UY") + " kg";
}
function normalizeKey(k) {
  return (k || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export default function DocumentsScreen({ user, onBack, onNavigate }) {
  const [tab, setTab] = useState("freight"); // "company" | "freight"
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selCompany, setSelCompany] = useState(null);
  const [companyDocs, setCompanyDocs] = useState([]);
  const [loadingCompanyDocs, setLoadingCompanyDocs] = useState(false);

  const [freights, setFreights] = useState([]);
  const [loadingFreights, setLoadingFreights] = useState(false);
  const [selFreight, setSelFreight] = useState(null);
  const [freightDocs, setFreightDocs] = useState([]);
  const [loadingFreightDocs, setLoadingFreightDocs] = useState(false);

  const [expanded, setExpanded] = useState(null); // doc id
  const [exporting, setExporting] = useState(false);

  const companyId = user?.activeCompanyId || user?.companyId;
  const isManager = ["admin", "gerente", "platform_admin"].includes(user?.role);

  // Load linked companies for "Por empresa" tab
  useEffect(() => {
    if (tab !== "company" || !companyId) return;
    setLoadingCompanies(true);
    apiGetCompanyAccess(companyId).then(data => {
      setCompanies((data || []).filter(r => r.isActive));
    }).catch(() => setCompanies([])).finally(() => setLoadingCompanies(false));
  }, [tab, companyId]);

  // Load freights for "Por flete" tab
  useEffect(() => {
    if (tab !== "freight") return;
    setLoadingFreights(true);
    apiListFreights({ limit: 100 }).then(r => {
      setFreights((r?.data || r || []).filter(f => f.id));
    }).catch(() => setFreights([])).finally(() => setLoadingFreights(false));
  }, [tab]);

  // Load docs for selected company
  const loadCompanyDocs = useCallback(async (granteeCompanyId) => {
    setLoadingCompanyDocs(true);
    setCompanyDocs([]);
    try {
      const r = await apiListFreights({ limit: 200 });
      const allFreights = (r?.data || r || []).filter(f => f.id);
      // Filter freights involving this company
      const matching = allFreights.filter(f =>
        f.companyId === granteeCompanyId ||
        f.producerCompanyId === granteeCompanyId ||
        f.originCompanyId === granteeCompanyId ||
        (f.assignments || []).some(a => a.transportCompanyId === granteeCompanyId)
      );
      const docs = [];
      for (const f of matching.slice(0, 30)) {
        try {
          const [detail, tickets] = await Promise.all([
            apiGetFreight(f.id),
            apiGetWeighTickets(f.id).catch(() => []),
          ]);
          // FreightDocuments
          (detail?.documents || []).forEach(d => docs.push({
            ...d, _source: "document", _freight: { id: f.id, code: detail.code || f.code, status: f.status, originName: f.originName, destName: f.destName },
            _date: d.createdAt, _type: DOC_TYPE_LABELS[d.step] || d.type || "Documento",
            _hasOcr: !!d.ocrData, _ocrData: d.ocrData, _thumb: d.url,
          }));
          // WeighTickets
          (tickets || []).forEach(t => docs.push({
            ...t, _source: "ticket", _freight: { id: f.id, code: detail.code || f.code, status: f.status, originName: f.originName, destName: f.destName },
            _date: t.registeredAt || t.createdAt, _type: DOC_TYPE_LABELS[t.type] || "Ticket pesaje",
            _hasOcr: t.ocrConfidence != null, _ocrData: t.ocrData, _thumb: t.photoUrl,
            _name: t.ticketNumber ? `Ticket #${t.ticketNumber}` : "Ticket pesaje",
          }));
        } catch { /* skip freight */ }
      }
      docs.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
      setCompanyDocs(docs);
    } catch { setCompanyDocs([]); }
    finally { setLoadingCompanyDocs(false); }
  }, []);

  // Load docs for selected freight
  const loadFreightDocs = useCallback(async (freightId) => {
    setLoadingFreightDocs(true);
    setFreightDocs([]);
    try {
      const [detail, tickets] = await Promise.all([
        apiGetFreight(freightId),
        apiGetWeighTickets(freightId).catch(() => []),
      ]);
      const docs = [];
      (detail?.documents || []).forEach(d => docs.push({
        ...d, _source: "document", _freight: { id: freightId, code: detail.code, status: detail.status, originName: detail.originName, destName: detail.destName },
        _date: d.createdAt, _type: DOC_TYPE_LABELS[d.step] || d.type || "Documento",
        _hasOcr: !!d.ocrData, _ocrData: d.ocrData, _thumb: d.url,
      }));
      (tickets || []).forEach(t => docs.push({
        ...t, _source: "ticket", _freight: { id: freightId, code: detail.code, status: detail.status, originName: detail.originName, destName: detail.destName },
        _date: t.registeredAt || t.createdAt, _type: DOC_TYPE_LABELS[t.type] || "Ticket pesaje",
        _hasOcr: t.ocrConfidence != null, _ocrData: t.ocrData, _thumb: t.photoUrl,
        _name: t.ticketNumber ? `Ticket #${t.ticketNumber}` : "Ticket pesaje",
      }));
      docs.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
      setFreightDocs(docs);
    } catch { setFreightDocs([]); }
    finally { setLoadingFreightDocs(false); }
  }, []);

  // OCR export
  const visibleDocs = tab === "company" ? companyDocs : freightDocs;
  const ocrDocs = useMemo(() => visibleDocs.filter(d => d._hasOcr && d._ocrData), [visibleDocs]);

  const handleExportOcr = useCallback(async () => {
    if (ocrDocs.length === 0) return;
    setExporting(true);
    try {
      const XLSX = (await import("xlsx")).default || await import("xlsx");
      // Group docs by similar OCR key sets
      const groups = [];
      ocrDocs.forEach(doc => {
        const data = typeof doc._ocrData === "string" ? JSON.parse(doc._ocrData) : doc._ocrData;
        const flat = data?.datos || data || {};
        const keys = Object.keys(flat).map(normalizeKey).filter(Boolean).sort();
        const keyStr = keys.join(",");
        let group = groups.find(g => {
          const overlap = g.keySet.filter(k => keys.includes(k)).length;
          const maxLen = Math.max(g.keySet.length, keys.length);
          return maxLen > 0 && overlap / maxLen > 0.7;
        });
        if (!group) {
          group = { keySet: keys, rawKeys: Object.keys(flat), label: doc._type || "Documentos", rows: [] };
          groups.push(group);
        }
        // Merge keys
        Object.keys(flat).forEach(k => { if (!group.rawKeys.includes(k)) group.rawKeys.push(k); });
        group.keySet = [...new Set([...group.keySet, ...keys])];
        group.rows.push({ _freight: doc._freight, _data: flat });
      });

      const wb = XLSX.utils.book_new();
      groups.forEach((g, idx) => {
        const headers = ["Flete", ...g.rawKeys];
        const wsData = [headers];
        g.rows.forEach(r => {
          const row = [r._freight?.code || ""];
          g.rawKeys.forEach(k => { row.push(r._data[k] != null ? String(r._data[k]) : ""); });
          wsData.push(row);
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Auto-width columns
        ws["!cols"] = headers.map((h, i) => ({
          wch: Math.min(40, Math.max(h.length + 2, ...wsData.slice(1).map(r => String(r[i] || "").length + 2)))
        }));
        const sheetName = (g.label || `Grupo ${idx + 1}`).slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
      XLSX.writeFile(wb, `documentos-ocr-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { console.error("Export error:", e); }
    finally { setExporting(false); }
  }, [ocrDocs]);

  // Company doc counts
  const companyDocCounts = useMemo(() => {
    if (tab !== "company" || !selCompany) return {};
    return {};
  }, [tab, selCompany]);

  const StatusPill = ({ status }) => {
    const sc = STATUS_COLORS[status] || { pillBg: C.bg, pillText: C.t3, label: status };
    return <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: sc.pillBg, color: sc.pillText }}>{sc.label}</span>;
  };

  const DocCard = ({ doc }) => {
    const isExp = expanded === doc.id;
    const icFn = DOC_TYPE_ICONS[doc._source] || DOC_TYPE_ICONS.photo;
    return (
      <div onClick={() => setExpanded(isExp ? null : doc.id)} style={{
        background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${doc._hasOcr ? C.pri : C.t3}`,
        borderRadius: 12, padding: 14, boxShadow: C.sh, cursor: "pointer", transition: "all 0.15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {doc._thumb ? (
            <img src={doc._thumb} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.b2}` }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 8, background: `${C.t3}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icFn(C.t3, 18)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{doc._name || doc.name || doc._type}</span>
              <span style={{ padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: `${C.t3}12`, color: C.t3 }}>{doc._type}</span>
              {doc._hasOcr && <span style={{ padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: C.priPale, color: C.pri }}>OCR</span>}
            </div>
            <div style={{ fontSize: 12.1, color: C.t3, marginTop: 2 }}>
              {fmtDate(doc._date)} {doc._freight?.code ? `· ${doc._freight.code}` : ""}
            </div>
          </div>
          <span style={{ display: "flex", transform: isExp ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>{Ic.chev(C.t3, 14)}</span>
        </div>
        {isExp && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.b2}` }}>
            {doc._source === "ticket" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                <DCell label="Peso Bruto" value={fmtWeight(doc.grossWeight)} />
                <DCell label="Tara" value={fmtWeight(doc.tareWeight)} />
                <DCell label="Peso Neto" value={fmtWeight(doc.netWeight)} bold />
                <DCell label="Humedad" value={doc.humidity != null ? Number(doc.humidity) + "%" : "—"} />
              </div>
            )}
            {doc._ocrData && (() => {
              const data = typeof doc._ocrData === "string" ? JSON.parse(doc._ocrData) : doc._ocrData;
              const flat = data?.datos || data || {};
              const entries = Object.entries(flat).filter(([, v]) => v != null && v !== "");
              if (entries.length === 0) return null;
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Datos OCR</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                    {entries.map(([k, v]) => <DCell key={k} label={k} value={String(v)} />)}
                  </div>
                </div>
              );
            })()}
            {doc._thumb && doc._source === "document" && (
              <div style={{ marginBottom: 8 }}>
                <img src={doc._thumb} alt="" style={{ maxWidth: 240, maxHeight: 180, borderRadius: 8, border: `1px solid ${C.b1}`, objectFit: "contain" }} />
              </div>
            )}
            {doc._freight?.code && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: C.bg, border: `1px solid ${C.b2}` }}>
                {Ic.truck(C.acc, 16)}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13.2, fontWeight: 600 }}>{doc._freight.code}</span>
                  <div style={{ fontSize: 11, color: C.t3 }}>{doc._freight.originName} → {doc._freight.destName}</div>
                </div>
                <StatusPill status={doc._freight.status} />
                <button onClick={e => { e.stopPropagation(); onNavigate?.(doc._freight.id); }} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.pri}`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.pri }}>Ver</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18, fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>{Ic.chev(C.pri, 18)}</button>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, flex: 1 }}>Documentos</span>
        {ocrDocs.length > 0 && (
          <button onClick={handleExportOcr} disabled={exporting} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10,
            border: `1.5px solid ${C.pri}`, background: C.priPale, cursor: exporting ? "wait" : "pointer",
            fontFamily: "inherit", fontSize: 12.7, fontWeight: 700, color: C.pri, opacity: exporting ? 0.6 : 1,
          }}>
            {Ic.download(C.pri, 14)} {exporting ? "Exportando..." : `Exportar OCR (${ocrDocs.length})`}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bg, borderRadius: 10, padding: 3 }}>
        {[{ k: "freight", l: "Por flete" }, ...(isManager ? [{ k: "company", l: "Por empresa" }] : [])].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); setSelCompany(null); setSelFreight(null); setExpanded(null); }} style={{
            flex: 1, padding: "9px 16px", borderRadius: 8, border: "none", fontFamily: "inherit",
            fontSize: 13.8, fontWeight: 700, cursor: "pointer",
            background: tab === t.k ? C.w : "transparent", color: tab === t.k ? C.pri : C.t3,
            boxShadow: tab === t.k ? C.sh : "none", transition: "all 0.15s",
          }}>{t.l}</button>
        ))}
      </div>

      {/* TAB: Por empresa */}
      {tab === "company" && !selCompany && (
        loadingCompanies ? <div style={{ padding: 40, textAlign: "center" }}><Loader /></div> :
        companies.length === 0 ? <EmptyState icon={Ic.doc(C.t3, 28)} title="Sin empresas vinculadas" subtitle="Vinculá empresas desde la sección Empresas" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {companies.map(c => {
            const comp = c.granteeCompany || {};
            const typeColor = comp.type === "producer" ? "#F59E0B" : comp.type === "transporter" ? "#0891B2" : C.pri;
            return (
              <button key={c.id} onClick={() => { setSelCompany(c); loadCompanyDocs(comp.id); }} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 16, background: C.w,
                border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, cursor: "pointer",
                fontFamily: "inherit", textAlign: "left", width: "100%",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${typeColor}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {comp.type === "producer" ? Ic.grain(typeColor, 18) : Ic.truck(typeColor, 18)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1 }}>{comp.name}</div>
                  <div style={{ fontSize: 12.1, color: typeColor, fontWeight: 600 }}>{comp.type === "producer" ? "Productor" : "Transportista"}</div>
                </div>
                {Ic.chev(C.t3, 16)}
              </button>
            );
          })}
        </div>
      )}

      {tab === "company" && selCompany && (
        <div>
          <button onClick={() => { setSelCompany(null); setCompanyDocs([]); setExpanded(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, color: C.pri, padding: 0, marginBottom: 12 }}>
            {Ic.chev(C.pri, 14)} {selCompany.granteeCompany?.name || "Empresa"}
          </button>
          {loadingCompanyDocs ? <div style={{ padding: 40, textAlign: "center" }}><Loader /></div> :
            companyDocs.length === 0 ? <EmptyState icon={Ic.doc(C.t3, 28)} title="No hay documentos para esta empresa" subtitle="Los documentos aparecerán cuando se adjunten a fletes" /> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {companyDocs.map(d => <DocCard key={d.id} doc={d} />)}
            </div>
          }
        </div>
      )}

      {/* TAB: Por flete */}
      {tab === "freight" && !selFreight && (
        loadingFreights ? <div style={{ padding: 40, textAlign: "center" }}><Loader /></div> :
        freights.length === 0 ? <EmptyState icon={Ic.doc(C.t3, 28)} title="Sin fletes" subtitle="Los fletes aparecerán aquí" /> :
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {freights.map(f => {
            const sc = STATUS_COLORS[f.status] || {};
            const docCount = (f.documentCount || 0) + (f.weighTicketCount || 0);
            return (
              <button key={f.id} onClick={() => { setSelFreight(f); loadFreightDocs(f.id); }} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 14, background: C.w,
                border: `1px solid ${C.b1}`, borderLeft: `3px solid ${sc.pillBg || C.t3}`,
                borderRadius: 12, boxShadow: C.sh, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{f.code}</span>
                    <StatusPill status={f.status} />
                    {docCount > 0 && <span style={{ padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: C.bg, color: C.t2 }}>{docCount} doc{docCount !== 1 ? "s" : ""}</span>}
                  </div>
                  <div style={{ fontSize: 12.1, color: C.t3, marginTop: 3 }}>
                    {f.originName || f.originCompanyName || "—"} → {f.destName || "—"}
                  </div>
                  {f.producerCompanyName && <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>{f.producerCompanyName}</div>}
                </div>
                {Ic.chev(C.t3, 16)}
              </button>
            );
          })}
        </div>
      )}

      {tab === "freight" && selFreight && (
        <div>
          <button onClick={() => { setSelFreight(null); setFreightDocs([]); setExpanded(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, color: C.pri, padding: 0, marginBottom: 12 }}>
            {Ic.chev(C.pri, 14)} {selFreight.code || "Flete"}
          </button>
          {loadingFreightDocs ? <div style={{ padding: 40, textAlign: "center" }}><Loader /></div> :
            freightDocs.length === 0 ? <EmptyState icon={Ic.doc(C.t3, 28)} title="No hay documentos para este flete" subtitle="Los documentos aparecerán cuando se adjunten" /> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {freightDocs.map(d => <DocCard key={d.id} doc={d} />)}
            </div>
          }
        </div>
      )}
    </div>
  );
}

function DCell({ label, value, bold }) {
  return (
    <div style={{ padding: "5px 8px", borderRadius: 6, background: C.bg }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.2, fontWeight: bold ? 700 : 500, color: C.t1 }}>{value}</div>
    </div>
  );
}
