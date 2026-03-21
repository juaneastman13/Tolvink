import { useState, useEffect, useCallback, useMemo } from "react";
import { C, Ic, R, STATUS_COLORS } from "../theme";
import { Loader, EmptyState } from "../components";
import { apiGetCompanyAccess, apiListFreights, apiGetWeighTickets, apiGetFreight, apiOcrAnalyze, apiSaveOcrData, apiClearOcrData, apiEditOcrData, apiDeleteDocument, apiRenameDocument } from "../api";
import { OcrResultModal, ocrLabel, FreightFileUpload } from "../uploads";

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
  const [processingOcr, setProcessingOcr] = useState(null); // doc id being processed
  const [processingAll, setProcessingAll] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0 });
  const [clearingOcr, setClearingOcr] = useState(null); // doc id
  const [confirmClear, setConfirmClear] = useState(null); // doc to confirm clear
  const [viewerDoc, setViewerDoc] = useState(null); // doc for viewer modal
  const [ocrEditDoc, setOcrEditDoc] = useState(null); // doc for OCR edit modal
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null); // doc to confirm delete
  const [deletingDoc, setDeletingDoc] = useState(null); // doc id being deleted
  const [renamingDoc, setRenamingDoc] = useState(null); // doc id being renamed
  const [renameValue, setRenameValue] = useState("");

  const companyId = user?.activeCompanyId || user?.companyId;
  const isManager = ["admin", "gerente", "platform_admin"].includes(user?.role);

  // Load freights (shared between both tabs for counts)
  useEffect(() => {
    setLoadingFreights(true);
    apiListFreights({ limit: 200 }).then(r => {
      setFreights((r?.data || r || []).filter(f => f.id));
    }).catch(() => setFreights([])).finally(() => setLoadingFreights(false));
  }, []);

  // Load linked companies for "Por empresa" tab
  useEffect(() => {
    if (tab !== "company" || !companyId) return;
    setLoadingCompanies(true);
    apiGetCompanyAccess(companyId).then(data => {
      setCompanies((data || []).filter(r => r.isActive));
    }).catch(() => setCompanies([])).finally(() => setLoadingCompanies(false));
  }, [tab, companyId]);

  // Compute per-company doc counts from freights
  const companyDocCounts2 = useMemo(() => {
    const map = {};
    freights.forEach(f => {
      const total = (f.documentCount || 0) + (f.weighTicketCount || 0);
      const ocr = (f.ocrDocCount || 0) + (f.ocrTicketCount || 0);
      const addTo = (cid) => {
        if (!cid) return;
        if (!map[cid]) map[cid] = { total: 0, ocr: 0 };
        map[cid].total += total;
        map[cid].ocr += ocr;
      };
      addTo(f.companyId);
      addTo(f.producerCompanyId);
      addTo(f.originCompanyId);
      (f.assignments || []).forEach(a => addTo(a.transportCompanyId));
    });
    return map;
  }, [freights]);

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

  // OCR processing — single document
  const handleProcessOcr = useCallback(async (doc) => {
    const url = doc._thumb || doc.photoUrl || doc.url;
    if (!url || !doc._freight?.id) return;
    setProcessingOcr(doc.id);
    try {
      const result = await apiOcrAnalyze(url);
      if (result && result.datos) {
        // Save OCR data to the document
        if (doc._source === "document") {
          await apiSaveOcrData(doc._freight.id, doc.id, result);
        }
        // Update doc in local state
        const updateDocs = (docs) => docs.map(d => d.id === doc.id ? { ...d, _hasOcr: true, _ocrData: result, ocrData: result } : d);
        if (tab === "company") setCompanyDocs(updateDocs);
        else setFreightDocs(updateDocs);
      }
    } catch (e) { console.error("OCR error:", e); }
    finally { setProcessingOcr(null); }
  }, [tab]);

  // OCR processing — all docs without OCR
  const docsWithoutOcr = useMemo(() => visibleDocs.filter(d => !d._hasOcr && (d._thumb || d.photoUrl || d.url)), [visibleDocs]);

  const handleProcessAll = useCallback(async () => {
    if (docsWithoutOcr.length === 0) return;
    setProcessingAll(true);
    setOcrProgress({ current: 0, total: docsWithoutOcr.length });
    for (let i = 0; i < docsWithoutOcr.length; i++) {
      setOcrProgress({ current: i + 1, total: docsWithoutOcr.length });
      try { await handleProcessOcr(docsWithoutOcr[i]); } catch { /* continue */ }
    }
    setProcessingAll(false);
  }, [docsWithoutOcr, handleProcessOcr]);

  // Clear OCR data
  const handleClearOcr = useCallback(async (doc) => {
    if (!doc._freight?.id || !doc.id || doc._source !== "document") return;
    setClearingOcr(doc.id);
    try {
      await apiClearOcrData(doc._freight.id, doc.id);
      const updateDocs = (docs) => docs.map(d => d.id === doc.id ? { ...d, _hasOcr: false, _ocrData: null, ocrData: null } : d);
      if (tab === "company") setCompanyDocs(updateDocs);
      else setFreightDocs(updateDocs);
    } catch (e) { console.error("Clear OCR error:", e); }
    finally { setClearingOcr(null); setConfirmClear(null); }
  }, [tab]);

  // Download document
  const handleDownload = useCallback(async (doc) => {
    const url = doc._thumb || doc.photoUrl || doc.url;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (url.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const code = (doc._freight?.code || "doc").replace(/[^a-zA-Z0-9-]/g, "");
      const type = (doc._type || "documento").replace(/\s+/g, "-").toLowerCase();
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `${code}_${type}_${date}.${ext}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { console.error("Download error:", e); }
  }, []);

  const reloadDocs = useCallback(() => {
    if (tab === "company" && selCompany) loadCompanyDocs(selCompany.granteeCompany?.id || selCompany.companyId || selCompany.id);
    else if (tab === "freight" && selFreight) loadFreightDocs(selFreight.id);
  }, [tab, selCompany, selFreight]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteDoc = useCallback(async (doc) => {
    if (!doc._freight?.id || !doc.id || doc._source !== "document") return;
    setDeletingDoc(doc.id);
    try {
      await apiDeleteDocument(doc._freight.id, doc.id);
      const updateDocs = (docs) => docs.filter(d => d.id !== doc.id);
      if (tab === "company") setCompanyDocs(updateDocs);
      else setFreightDocs(updateDocs);
    } catch (e) { console.error("Delete doc error:", e); }
    finally { setDeletingDoc(null); setConfirmDeleteDoc(null); }
  }, [tab]);

  const handleRenameDoc = useCallback(async (doc, newName) => {
    if (!doc._freight?.id || !doc.id || doc._source !== "document" || !newName.trim()) return;
    try {
      await apiRenameDocument(doc._freight.id, doc.id, newName.trim());
      const updateDocs = (docs) => docs.map(d => d.id === doc.id ? { ...d, name: newName.trim(), _name: newName.trim() } : d);
      if (tab === "company") setCompanyDocs(updateDocs);
      else setFreightDocs(updateDocs);
    } catch (e) { console.error("Rename doc error:", e); }
    finally { setRenamingDoc(null); setRenameValue(""); }
  }, [tab]);

  const StatusPill = ({ status }) => {
    const sc = STATUS_COLORS[status] || { pillBg: C.bg, pillText: C.t3, label: status };
    return <span style={{ padding: "2px 8px", borderRadius: R.sm, fontSize: 10.5, fontWeight: 700, background: sc.pillBg, color: sc.pillText }}>{sc.label}</span>;
  };

  const DocCard = ({ doc }) => {
    const isExp = expanded === doc.id;
    const icFn = DOC_TYPE_ICONS[doc._source] || DOC_TYPE_ICONS.photo;
    return (
      <div onClick={() => setExpanded(isExp ? null : doc.id)} style={{
        background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${doc._hasOcr ? C.pri : C.t3}`,
        borderRadius: R.lg, padding: 14, boxShadow: C.sh, cursor: "pointer", transition: "all 0.15s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {doc._thumb ? (
            <img src={doc._thumb} alt="" style={{ width: 40, height: 40, borderRadius: R.md, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.b2}` }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: R.md, background: `${C.t3}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icFn(C.t3, 18)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {renamingDoc === doc.id ? (
                <form onSubmit={e => { e.preventDefault(); e.stopPropagation(); handleRenameDoc(doc, renameValue); }} onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus style={{ padding: "3px 8px", borderRadius: R.sm, border: `1.5px solid ${C.pri}`, fontSize: 13.2, fontFamily: "inherit", color: C.t1, width: 160, outline: "none" }} />
                  <button type="submit" style={{ padding: "3px 8px", borderRadius: R.sm, border: "none", background: C.pri, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ok</button>
                  <button type="button" onClick={e => { e.stopPropagation(); setRenamingDoc(null); }} style={{ padding: "3px 8px", borderRadius: R.sm, border: `1px solid ${C.b1}`, background: C.bg, color: C.t3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                </form>
              ) : (
                <span style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{doc._name || doc.name || doc._type}</span>
              )}
              <span style={{ padding: "2px 7px", borderRadius: R.sm, fontSize: 10, fontWeight: 600, background: `${C.t3}12`, color: C.t3 }}>{doc._type}</span>
              {doc._hasOcr && <span style={{ padding: "2px 7px", borderRadius: R.sm, fontSize: 10, fontWeight: 700, background: C.priPale, color: C.pri }}>{doc._ocrData?.structured !== false ? "OCR" : "OCR libre"}</span>}
              {doc._hasOcr && doc._ocrData?._editMeta && <span style={{ padding: "2px 6px", borderRadius: R.sm, fontSize: 9, fontWeight: 700, background: `${C.acc}15`, color: C.acc }}>Editado</span>}
            </div>
            <div style={{ fontSize: 12.1, color: C.t3, marginTop: 2 }}>
              {fmtDate(doc._date)} {doc._freight?.code ? `· ${doc._freight.code}` : ""}
            </div>
            {doc._hasOcr && doc._ocrData?.structured !== false && (() => {
              const d = typeof doc._ocrData === "string" ? JSON.parse(doc._ocrData) : doc._ocrData;
              const data = d?.datos || d?.data || d || {};
              const lines = [];
              if (data.documentNumber || data.numero) lines.push(`${data.documentNumber || data.numero}${data.date || data.fecha ? ` — ${data.date || data.fecha}` : ""}`);
              if (data.origin || data.destination) lines.push(`${data.origin || data.origenLocalidad || "?"} → ${data.destination || data.destinoPlanta || "?"}`);
              if (data.product || data.grano) lines.push(`${data.product || data.grano}${data.quantity || data.pesoNeto ? ` — ${data.quantity || data.pesoNeto} ${data.quantityUnit || "kg"}` : ""}`);
              if (lines.length === 0) return null;
              return <div style={{ fontSize: 11, color: C.t2, marginTop: 3, lineHeight: 1.4 }}>{lines.join(" · ")}</div>;
            })()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {(doc._thumb || doc.photoUrl || doc.url) && (
              <button onClick={e => { e.stopPropagation(); setViewerDoc(doc); }} title="Ver documento" style={{
                padding: 5, borderRadius: R.sm, border: `1px solid ${C.b2}`, background: C.bg,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            )}
            {(doc._thumb || doc.photoUrl || doc.url) && (
              <button onClick={e => { e.stopPropagation(); handleDownload(doc); }} title="Descargar" style={{
                padding: 5, borderRadius: R.sm, border: `1px solid ${C.b2}`, background: C.bg,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {Ic.download(C.t2, 14)}
              </button>
            )}
            {!doc._hasOcr && (doc._thumb || doc.photoUrl || doc.url) && (
              <button onClick={e => { e.stopPropagation(); handleProcessOcr(doc); }} disabled={processingOcr === doc.id} style={{
                padding: "4px 8px", borderRadius: R.sm, border: `1px solid ${C.acc}`, background: `${C.acc}10`,
                cursor: processingOcr === doc.id ? "wait" : "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, color: C.acc,
                display: "flex", alignItems: "center", gap: 4, opacity: processingOcr === doc.id ? 0.5 : 1,
              }}>
                {processingOcr === doc.id ? <Loader size={12} /> : Ic.doc(C.acc, 12)} {processingOcr === doc.id ? "..." : "OCR"}
              </button>
            )}
            {doc._source === "document" && (
              <button onClick={e => { e.stopPropagation(); setRenamingDoc(doc.id); setRenameValue(doc._name || doc.name || ""); }} title="Renombrar" style={{
                padding: 5, borderRadius: R.sm, border: `1px solid ${C.b2}`, background: C.bg,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            {doc._source === "document" && (
              <button onClick={e => { e.stopPropagation(); setConfirmDeleteDoc(doc); }} disabled={deletingDoc === doc.id} title="Eliminar" style={{
                padding: 5, borderRadius: R.sm, border: `1px solid ${C.err}40`, background: C.errPale || "#fef2f2",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: deletingDoc === doc.id ? 0.5 : 1,
              }}>
                {Ic.cross(C.err, 14)}
              </button>
            )}
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
              const raw = typeof doc._ocrData === "string" ? JSON.parse(doc._ocrData) : doc._ocrData;
              const isStructured = raw?.structured !== false;
              const data = raw?.datos || raw?.data || raw || {};
              // For free extraction, show rawFields separately
              const rawFields = data?.rawFields || {};
              const mainEntries = isStructured
                ? Object.entries(data).filter(([k, v]) => v != null && v !== "" && !k.startsWith("_"))
                : Object.entries(rawFields).filter(([, v]) => v != null && v !== "");
              if (mainEntries.length === 0 && !data.documentType && !data.summary) return null;
              // Labels handled by shared ocrLabel()
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: "uppercase", letterSpacing: 0.4 }}>Datos OCR</span>
                    <span style={{ fontSize: 10, color: C.t3, fontStyle: "italic" }}>{isStructured ? "Estructurado" : "Libre"}</span>
                    {raw?.confianza != null && <span style={{ fontSize: 10, color: C.t3 }}>({Math.round((raw.confianza || 0) * 100)}%)</span>}
                    {raw?._editMeta && <span style={{ fontSize: 9, fontWeight: 700, color: C.acc, background: `${C.acc}15`, padding: "1px 5px", borderRadius: R.sm }}>Editado</span>}
                    <span style={{ flex: 1 }} />
                    {doc._source === "document" && (
                      <button onClick={e => { e.stopPropagation(); setOcrEditDoc(doc); }} style={{
                        padding: "3px 8px", borderRadius: R.sm, border: `1px solid ${C.acc}`, background: `${C.acc}10`,
                        cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, color: C.acc,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        Editar
                      </button>
                    )}
                    {doc._source === "document" && (
                      <button onClick={e => { e.stopPropagation(); setConfirmClear(doc); }} disabled={clearingOcr === doc.id} style={{
                        padding: "3px 8px", borderRadius: R.sm, border: `1px solid #EF4444`, background: "#FEF2F2",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, color: "#EF4444",
                        display: "flex", alignItems: "center", gap: 4, opacity: clearingOcr === doc.id ? 0.5 : 1,
                      }}>
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                        {clearingOcr === doc.id ? "..." : "Borrar OCR"}
                      </button>
                    )}
                  </div>
                  {!isStructured && data.documentType && <div style={{ fontSize: 12.6, color: C.t2, fontWeight: 600, marginBottom: 4 }}>{data.documentType}</div>}
                  {!isStructured && data.summary && <div style={{ fontSize: 12.1, color: C.t3, marginBottom: 6, fontStyle: "italic" }}>{data.summary}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                    {mainEntries.map(([k, v]) => <DCell key={k} label={ocrLabel(k)} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />)}
                  </div>
                </div>
              );
            })()}
            {doc._thumb && doc._source === "document" && (
              <div style={{ marginBottom: 8 }}>
                <img src={doc._thumb} alt="" style={{ maxWidth: 240, maxHeight: 180, borderRadius: R.md, border: `1px solid ${C.b1}`, objectFit: "contain" }} />
              </div>
            )}
            {doc._freight?.code && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: R.md, background: C.bg, border: `1px solid ${C.b2}` }}>
                {Ic.truck(C.acc, 16)}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13.2, fontWeight: 600 }}>{doc._freight.code}</span>
                  <div style={{ fontSize: 11, color: C.t3 }}>{doc._freight.originName} → {doc._freight.destName}</div>
                </div>
                <StatusPill status={doc._freight.status} />
                <button onClick={e => { e.stopPropagation(); onNavigate?.(doc._freight.id); }} style={{ padding: "4px 10px", borderRadius: R.md, border: `1px solid ${C.pri}`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.pri }}>Ver</button>
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
        {docsWithoutOcr.length > 0 && (selCompany || selFreight) && (
          <button onClick={handleProcessAll} disabled={processingAll} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: R.md,
            border: `1.5px solid ${C.acc}`, background: `${C.acc}10`, cursor: processingAll ? "wait" : "pointer",
            fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.acc, opacity: processingAll ? 0.6 : 1,
          }}>
            {Ic.doc(C.acc, 14)} {processingAll ? `Procesando ${ocrProgress.current}/${ocrProgress.total}...` : `Procesar OCR (${docsWithoutOcr.length})`}
          </button>
        )}
        {ocrDocs.length > 0 && (
          <button onClick={handleExportOcr} disabled={exporting} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: R.md,
            border: `1.5px solid ${C.pri}`, background: C.priPale, cursor: exporting ? "wait" : "pointer",
            fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.pri, opacity: exporting ? 0.6 : 1,
          }}>
            {Ic.download(C.pri, 14)} {exporting ? "Exportando..." : `Exportar OCR (${ocrDocs.length})`}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bg, borderRadius: R.md, padding: 3 }}>
        {[{ k: "freight", l: "Por flete" }, ...(isManager ? [{ k: "company", l: "Por empresa" }] : [])].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); setSelCompany(null); setSelFreight(null); setExpanded(null); }} style={{
            flex: 1, padding: "9px 16px", borderRadius: R.md, border: "none", fontFamily: "inherit",
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
            const counts = companyDocCounts2[comp.id] || { total: 0, ocr: 0 };
            return (
              <button key={c.id} onClick={() => { setSelCompany(c); loadCompanyDocs(comp.id); }} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 16, background: C.w,
                border: `1px solid ${C.b1}`, borderRadius: R.lg, boxShadow: C.sh, cursor: "pointer",
                fontFamily: "inherit", textAlign: "left", width: "100%",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: R.md, background: `${typeColor}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {comp.type === "producer" ? Ic.grain(typeColor, 18) : Ic.truck(typeColor, 18)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1 }}>{comp.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ padding: "2px 8px", borderRadius: R.sm, fontSize: 10.5, fontWeight: 700, background: `${typeColor}14`, color: typeColor }}>{comp.type === "producer" ? "Productor" : "Transportista"}</span>
                    {counts.total > 0 && <span style={{ fontSize: 11.5, color: C.t2, fontWeight: 600 }}>{counts.total} documento{counts.total !== 1 ? "s" : ""}</span>}
                    {counts.ocr > 0 && <span style={{ fontSize: 10.5, color: C.pri, fontWeight: 600 }}>{counts.ocr} con OCR</span>}
                  </div>
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
            const ocrCount = (f.ocrDocCount || 0) + (f.ocrTicketCount || 0);
            const fDate = f.loadDate || f.createdAt;
            return (
              <button key={f.id} onClick={() => { setSelFreight(f); loadFreightDocs(f.id); }} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 14, background: C.w,
                border: `1px solid ${C.b1}`, borderLeft: `3px solid ${sc.pillBg || C.t3}`,
                borderRadius: R.lg, boxShadow: C.sh, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{f.code}</span>
                    <StatusPill status={f.status} />
                    {fDate && <span style={{ fontSize: 10.5, color: C.t3 }}>{fmtDate(fDate)}</span>}
                  </div>
                  <div style={{ fontSize: 12.1, color: C.t3, marginTop: 3 }}>
                    {f.producerCompany?.name || f.originCompany?.name || f.originName || "—"} → {f.destName || "—"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {docCount > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: C.t2 }}>{docCount} documento{docCount !== 1 ? "s" : ""}</span>}
                    {ocrCount > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: C.pri }}>{ocrCount} con OCR</span>}
                    {docCount === 0 && <span style={{ fontSize: 11, color: C.t3 }}>Sin documentos</span>}
                  </div>
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
            <>
              <div style={{ marginBottom: 12 }}>
                <FreightFileUpload freightId={selFreight.id} step="assignment" onUploaded={() => loadFreightDocs(selFreight.id)} />
              </div>
              {freightDocs.length === 0 ? <EmptyState icon={Ic.doc(C.t3, 28)} title="No hay documentos para este flete" subtitle="Los documentos aparecerán cuando se adjunten" /> :
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {freightDocs.map(d => <DocCard key={d.id} doc={d} />)}
              </div>}
            </>
          }
        </div>
      )}

      {/* Confirm Clear OCR Dialog */}
      {confirmClear && (
        <div onClick={() => setConfirmClear(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.w, borderRadius: R.xl, padding: 24, maxWidth: 340, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>Borrar datos OCR</div>
            <div style={{ fontSize: 13.2, color: C.t2, marginBottom: 20, lineHeight: 1.5 }}>
              Se eliminarán los datos OCR extraídos de este documento. Podrás volver a procesarlo después.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmClear(null)} style={{
                padding: "8px 18px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.bg,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, color: C.t2,
              }}>Cancelar</button>
              <button onClick={() => handleClearOcr(confirmClear)} disabled={clearingOcr === confirmClear.id} style={{
                padding: "8px 18px", borderRadius: R.md, border: "none", background: "#EF4444",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 700, color: "#fff",
                opacity: clearingOcr === confirmClear.id ? 0.6 : 1,
              }}>{clearingOcr === confirmClear.id ? "Borrando..." : "Borrar OCR"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Document Dialog */}
      {confirmDeleteDoc && (
        <div onClick={() => setConfirmDeleteDoc(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.w, borderRadius: R.xl, padding: 24, maxWidth: 340, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 8 }}>Eliminar documento</div>
            <div style={{ fontSize: 13.2, color: C.t2, marginBottom: 6, lineHeight: 1.5 }}>
              ¿Eliminar <strong>{confirmDeleteDoc._name || confirmDeleteDoc.name || "este documento"}</strong>?
            </div>
            <div style={{ fontSize: 12.1, color: C.t3, marginBottom: 20 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDeleteDoc(null)} style={{
                padding: "8px 18px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.bg,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, color: C.t2,
              }}>Cancelar</button>
              <button onClick={() => handleDeleteDoc(confirmDeleteDoc)} disabled={deletingDoc === confirmDeleteDoc.id} style={{
                padding: "8px 18px", borderRadius: R.md, border: "none", background: "#EF4444",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 700, color: "#fff",
                opacity: deletingDoc === confirmDeleteDoc.id ? 0.6 : 1,
              }}>{deletingDoc === confirmDeleteDoc.id ? "Eliminando..." : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Edit Modal */}
      {ocrEditDoc && ocrEditDoc._ocrData && (
        <OcrResultModal
          result={typeof ocrEditDoc._ocrData === "string" ? JSON.parse(ocrEditDoc._ocrData) : ocrEditDoc._ocrData}
          onClose={() => setOcrEditDoc(null)}
          freightId={ocrEditDoc._freight?.id}
          docId={ocrEditDoc._source === "document" ? ocrEditDoc.id : null}
          startInEditMode
          onSaved={() => {
            // Reload docs to get updated ocrData
            if (tab === "company" && selCompany) loadCompanyDocs(selCompany.companyId || selCompany.id);
            else if (tab === "freight" && selFreight) loadFreightDocs(selFreight.id);
            setOcrEditDoc(null);
          }}
        />
      )}

      {/* Document Viewer Modal */}
      {viewerDoc && (
        <div onClick={() => setViewerDoc(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, width: "100%", maxWidth: 900, justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{viewerDoc._name || viewerDoc.name || viewerDoc._type}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={e => { e.stopPropagation(); handleDownload(viewerDoc); }} style={{
                padding: "6px 14px", borderRadius: R.md, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: "#fff",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {Ic.download("#fff", 14)} Descargar
              </button>
              <button onClick={() => setViewerDoc(null)} style={{
                padding: "6px 14px", borderRadius: R.md, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: "#fff",
              }}>Cerrar</button>
            </div>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: "calc(100vh - 120px)", overflow: "auto", borderRadius: R.lg }}>
            {(() => {
              const url = viewerDoc._thumb || viewerDoc.photoUrl || viewerDoc.url || "";
              const isPdf = url.toLowerCase().includes(".pdf");
              if (isPdf) {
                return <iframe src={url} title="PDF viewer" style={{ width: "min(900px, 90vw)", height: "calc(100vh - 140px)", border: "none", borderRadius: R.lg, background: "#fff" }} />;
              }
              return <img src={url} alt="" style={{ maxWidth: "min(900px, 90vw)", maxHeight: "calc(100vh - 140px)", objectFit: "contain", borderRadius: R.lg, background: "#fff" }} />;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function DCell({ label, value, bold }) {
  return (
    <div style={{ padding: "5px 8px", borderRadius: R.sm, background: C.bg }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.2, fontWeight: bold ? 700 : 500, color: C.t1 }}>{value}</div>
    </div>
  );
}
