// =====================================================================
// TOLVINK — Truck Detail Screen
// Documents (with expiry tracking), freight history, and expenses
// =====================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { C, Ic, R, FONT, MONO } from "../theme";
import { Btn, Field, Loader, EmptyState, LicensePlate, LoadingOverlay } from "../components";
import {
  apiGetTruckDetail, apiAddTruckDocument, apiUpdateTruckDocument, apiDeleteTruckDocument,
  apiAddTruckExpense, apiUpdateTruckExpense, apiDeleteTruckExpense, apiGetTruckExpenseSummary,
  apiGetTruckFreights, uploadPhoto,
} from "../api";

// ======================== CONSTANTS ====================================

const DOC_TYPE_LABELS = {
  VTV_ITV: "VTV / ITV", INSURANCE: "Seguro", TRANSPORT_LICENSE: "Habilitación de transporte",
  GREEN_CARD: "Cédula verde", DRIVER_LICENSE: "Licencia de conducir", RUAT: "RUAT",
  SENASA: "SENASA", FUMIGATION: "Certificado de fumigación", OTHER: "Otro",
};
const EXP_TYPE_LABELS = {
  FUEL: "Combustible", TOLL: "Peaje", MAINTENANCE: "Mantenimiento", TIRE: "Neumáticos",
  INSURANCE: "Seguro", FINE: "Multa", PARKING: "Estacionamiento", MEAL: "Viáticos", OTHER: "Otro",
};
const EXPIRY_COLORS = { valid: C.ok, expiring_soon: C.warn, expired: C.err, no_expiry: C.t3 };
const EXPIRY_LABELS = { valid: "Vigente", expiring_soon: "Por vencer", expired: "Vencido", no_expiry: "Sin vencimiento" };

function fmtDate(d) { if (!d) return "—"; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`; }
function fmtMoney(n, cur = "UYU") { const v = Number(n) || 0; return `${cur === "USD" ? "US$" : "$"}${v.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

// ======================== SECTION HEADER ================================

function SectionHeader({ title, icon, count, onAdd, addLabel, expanded, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "14px 16px", background: C.w, border: `1px solid ${C.b1}`,
      borderRadius: R.lg, cursor: "pointer", fontFamily: FONT, marginBottom: expanded ? 0 : 10,
      borderBottomLeftRadius: expanded ? 0 : R.lg, borderBottomRightRadius: expanded ? 0 : R.lg,
      boxShadow: C.sh,
    }}>
      {icon}
      <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 700, color: C.t1 }}>{title}</span>
      {count != null && <span style={{ fontSize: 12, fontWeight: 600, color: C.t3, background: C.bg, padding: "2px 8px", borderRadius: R.pill }}>{count}</span>}
      {onAdd && <span onClick={e => { e.stopPropagation(); onAdd(); }} style={{ padding: "4px 10px", borderRadius: R.md, background: C.pri, cursor: "pointer", display: "flex", alignItems: "center" }}>{Ic.plus(C.tOn, 14)}</span>}
      <span style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>{Ic.chev(C.t3, 14)}</span>
    </button>
  );
}

// ======================== DOCUMENT FORM =================================

function DocForm({ onSave, onCancel, saving, initial }) {
  const [type, setType] = useState(initial?.type || "VTV_ITV");
  const [name, setName] = useState(initial?.name || "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ? new Date(initial.expiresAt).toISOString().split("T")[0] : "");
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt ? new Date(initial.issuedAt).toISOString().split("T")[0] : "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!initial && !file) return;
    setUploading(true);
    try {
      let fileUrl = initial?.fileUrl;
      let fileName = initial?.fileName;
      let mimeType = initial?.mimeType;
      if (file) {
        fileUrl = await uploadPhoto(file, "truck-docs", "doc");
        fileName = file.name;
        mimeType = file.type;
      }
      await onSave({ type, name: name || null, fileUrl, fileName, mimeType, expiresAt: expiresAt || null, issuedAt: issuedAt || null, notes: notes || null });
    } finally { setUploading(false); }
  };

  return (
    <div style={{ padding: 16, background: C.bgCard, border: `1px solid ${C.b2}`, borderRadius: R.lg, marginBottom: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Tipo de documento</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT, background: C.w }}>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {type === "OTHER" && <Field label="Nombre" value={name} onChange={setName} placeholder="Nombre del documento" />}
      {!initial && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Archivo</label>
          <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 13, fontFamily: FONT }} />
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Emisión</label>
          <input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Vencimiento</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT }} />
        </div>
      </div>
      <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones" />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn full disabled={saving || uploading || (!initial && !file)} onClick={handleSubmit}>{uploading ? "Subiendo..." : initial ? "Guardar" : "Agregar documento"}</Btn>
        <Btn v="muted" onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  );
}

// ======================== EXPENSE FORM ==================================

function ExpForm({ onSave, onCancel, saving, initial, activeFreights }) {
  const [type, setType] = useState(initial?.type || "FUEL");
  const [amount, setAmount] = useState(initial?.amount?.toString() || "");
  const [currency, setCurrency] = useState(initial?.currency || "UYU");
  const [date, setDate] = useState(initial?.date ? new Date(initial.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState(initial?.description || "");
  const [freightId, setFreightId] = useState(initial?.freightId || "");
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || !date) return;
    setUploading(true);
    try {
      let receiptUrl = initial?.receiptUrl;
      let receiptName = initial?.receiptName;
      if (receiptFile) {
        receiptUrl = await uploadPhoto(receiptFile, "truck-receipts", "receipt");
        receiptName = receiptFile.name;
      }
      await onSave({ type, amount: parseFloat(amount), currency, date, description: description || null, freightId: freightId || null, receiptUrl, receiptName });
    } finally { setUploading(false); }
  };

  return (
    <div style={{ padding: 16, background: C.bgCard, border: `1px solid ${C.b2}`, borderRadius: R.lg, marginBottom: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Tipo de gasto</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT, background: C.w }}>
          {Object.entries(EXP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 2 }}><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number" /></div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Moneda</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT, background: C.w }}>
            <option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Fecha</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT }} />
      </div>
      <Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle del gasto" />
      {activeFreights?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Flete asociado (opcional)</label>
          <select value={freightId} onChange={e => setFreightId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: FONT, background: C.w }}>
            <option value="">Sin flete</option>
            {activeFreights.map(f => <option key={f.id} value={f.id}>{f.code} — {f.originName || "?"} → {f.destName || "?"}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4, display: "block" }}>Comprobante (opcional)</label>
        <input type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)} style={{ fontSize: 13, fontFamily: FONT }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Btn full disabled={saving || uploading || !amount || !date} onClick={handleSubmit}>{uploading ? "Guardando..." : initial ? "Guardar" : "Registrar gasto"}</Btn>
        <Btn v="muted" onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  );
}

// ======================== MAIN SCREEN ===================================

export default function TruckDetailScreen({ truckId, user, onBack, onNavFreight }) {
  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  // Sections
  const [docOpen, setDocOpen] = useState(true);
  const [freightOpen, setFreightOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);

  // Forms
  const [showDocForm, setShowDocForm] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [showExpForm, setShowExpForm] = useState(false);
  const [editExp, setEditExp] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Expenses
  const [expSummary, setExpSummary] = useState(null);
  const [expenses, setExpenses] = useState(null);

  // Freight history
  const [freightHistory, setFreightHistory] = useState(null);

  const canEdit = user?.role !== "chofer";

  const load = useCallback(async () => {
    try {
      const data = await apiGetTruckDetail(truckId);
      setTruck(data);
      setError(null);
    } catch (e) { setError(e.message || "Error al cargar camión"); }
    finally { setLoading(false); }
  }, [truckId]);

  useEffect(() => { load(); }, [load]);

  const loadExpenses = useCallback(async () => {
    if (!expOpen || expenses) return;
    try {
      const [list, summary] = await Promise.all([
        apiGetTruckExpenseSummary(truckId).catch(() => null),
        apiGetTruckExpenseSummary(truckId),
      ]);
      // list endpoint returns expenses, summary returns aggregates
      setExpSummary(summary);
      // Load actual expense list separately
      const { apiGetTruckExpenses } = await import("../api");
      const expList = await apiGetTruckExpenses(truckId);
      setExpenses(expList || []);
    } catch { setExpenses([]); }
  }, [truckId, expOpen, expenses]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const loadFreightHistory = useCallback(async () => {
    if (!freightOpen || freightHistory) return;
    try {
      const data = await apiGetTruckFreights(truckId);
      setFreightHistory(data || []);
    } catch { setFreightHistory([]); }
  }, [truckId, freightOpen, freightHistory]);

  useEffect(() => { loadFreightHistory(); }, [loadFreightHistory]);

  // ======================== DOCUMENT HANDLERS ============================

  const handleAddDoc = async (body) => {
    setSaving(true);
    try {
      await apiAddTruckDocument(truckId, body);
      setShowDocForm(false); setDoneMsg("Documento agregado");
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleUpdateDoc = async (body) => {
    setSaving(true);
    try {
      await apiUpdateTruckDocument(truckId, editDoc.id, body);
      setEditDoc(null); setDoneMsg("Documento actualizado");
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteDoc = async (docId) => {
    setSaving(true);
    try {
      await apiDeleteTruckDocument(truckId, docId);
      setConfirmDelete(null); setDoneMsg("Documento eliminado");
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // ======================== EXPENSE HANDLERS =============================

  const handleAddExp = async (body) => {
    setSaving(true);
    try {
      await apiAddTruckExpense(truckId, body);
      setShowExpForm(false); setDoneMsg("Gasto registrado");
      setExpenses(null); setExpSummary(null); // force reload
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleUpdateExp = async (body) => {
    setSaving(true);
    try {
      await apiUpdateTruckExpense(truckId, editExp.id, body);
      setEditExp(null); setDoneMsg("Gasto actualizado");
      setExpenses(null); setExpSummary(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteExp = async (expId) => {
    setSaving(true);
    try {
      await apiDeleteTruckExpense(truckId, expId);
      setConfirmDelete(null); setDoneMsg("Gasto eliminado");
      setExpenses(null); setExpSummary(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // ======================== RENDER =======================================

  if (loading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}><Loader /></div>;
  if (error && !truck) return <div style={{ padding: 20 }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Volver</button><EmptyState icon={Ic.warn(C.err, 28)} title="Error" subtitle={error} /></div>;

  const docs = truck?.documents || [];
  const summary = truck?.docsSummary || {};

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, padding: "18px 18px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.pri, marginBottom: 10, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Flota</button>
      </div>

      <div style={{ padding: "0 18px 24px" }}>
        {/* ==================== HEADER CARD ==================== */}
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.xl, padding: 20, boxShadow: C.shMd, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            {Ic.truck(C.acc, 28)}
            <div style={{ flex: 1 }}>
              <LicensePlate plate={truck.plate} size="lg" />
              {truck.model && <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>{truck.brand ? `${truck.brand} ` : ""}{truck.model}</div>}
            </div>
            {summary.expired > 0 && <span style={{ background: C.errPale, color: C.err, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: R.pill }}>{summary.expired} vencido{summary.expired > 1 ? "s" : ""}</span>}
            {summary.expiringSoon > 0 && <span style={{ background: C.warnPale, color: C.warn, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: R.pill }}>{summary.expiringSoon} por vencer</span>}
          </div>

          {/* Driver */}
          {truck.assignedUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.bg, borderRadius: R.md }}>
              {Ic.user(C.pri, 16)}
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{truck.assignedUser.name}</span>
              {truck.assignedUser.phone && (
                <a href={`tel:${truck.assignedUser.phone}`} style={{ fontSize: 12, color: C.pri, textDecoration: "none", marginLeft: "auto" }}>{truck.assignedUser.phone}</a>
              )}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: C.bg, borderRadius: R.md }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{truck.totalFreights || 0}</div>
              <div style={{ fontSize: 11, color: C.t3 }}>Fletes</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: C.bg, borderRadius: R.md }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{Number(truck.totalTons || 0).toLocaleString("es-UY")}t</div>
              <div style={{ fontSize: 11, color: C.t3 }}>Toneladas</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: C.bg, borderRadius: R.md }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{docs.length}</div>
              <div style={{ fontSize: 11, color: C.t3 }}>Documentos</div>
            </div>
          </div>
        </div>

        {/* ==================== DOCUMENTS SECTION ==================== */}
        <SectionHeader title="Documentos" icon={Ic.doc(C.pri, 18)} count={docs.length} onAdd={canEdit ? () => { setShowDocForm(true); setDocOpen(true); } : null} expanded={docOpen} onToggle={() => setDocOpen(p => !p)} />
        {docOpen && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderTop: "none", borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg, padding: 14, marginBottom: 16 }}>
            {/* Summary badges */}
            {docs.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {summary.valid > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.ok, background: C.okPale, padding: "3px 10px", borderRadius: R.pill }}>✅ {summary.valid} vigente{summary.valid > 1 ? "s" : ""}</span>}
                {summary.expiringSoon > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.warn, background: C.warnPale, padding: "3px 10px", borderRadius: R.pill }}>⚠️ {summary.expiringSoon} por vencer</span>}
                {summary.expired > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.err, background: C.errPale, padding: "3px 10px", borderRadius: R.pill }}>❌ {summary.expired} vencido{summary.expired > 1 ? "s" : ""}</span>}
              </div>
            )}

            {showDocForm && <DocForm onSave={handleAddDoc} onCancel={() => setShowDocForm(false)} saving={saving} />}
            {editDoc && <DocForm initial={editDoc} onSave={handleUpdateDoc} onCancel={() => setEditDoc(null)} saving={saving} />}

            {docs.length === 0 && !showDocForm ? (
              <EmptyState icon={Ic.doc(C.t3, 24)} title="Sin documentos" subtitle="Cargá el primer documento del camión" />
            ) : docs.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${C.b2}`, borderLeft: `3px solid ${EXPIRY_COLORS[d.expiryStatus]}`, borderRadius: R.md, marginBottom: 8, background: C.w }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{DOC_TYPE_LABELS[d.type] || d.type}{d.name ? ` — ${d.name}` : ""}</div>
                  <div style={{ fontSize: 11.5, color: EXPIRY_COLORS[d.expiryStatus], fontWeight: 600, marginTop: 2 }}>
                    {EXPIRY_LABELS[d.expiryStatus]}{d.expiresAt ? ` · ${fmtDate(d.expiresAt)}` : ""}
                  </div>
                </div>
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: 4, color: C.pri }}>{Ic.eye(C.pri, 16)}</a>
                {canEdit && <button onClick={() => setEditDoc(d)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.edit(C.t3, 14)}</button>}
                {canEdit && <button onClick={() => setConfirmDelete({ type: "doc", id: d.id, label: DOC_TYPE_LABELS[d.type] })} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.ban(C.err, 14)}</button>}
              </div>
            ))}
          </div>
        )}

        {/* ==================== FREIGHTS SECTION ==================== */}
        <SectionHeader title="Fletes" icon={Ic.truck(C.sec, 18)} count={truck.totalFreights || 0} expanded={freightOpen} onToggle={() => setFreightOpen(p => !p)} />
        {freightOpen && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderTop: "none", borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg, padding: 14, marginBottom: 16 }}>
            {/* Active freights */}
            {truck.activeFreights?.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Activos</div>
                {truck.activeFreights.map(f => (
                  <div key={f.id} onClick={() => onNavFreight?.(f.id)} style={{
                    padding: "10px 12px", border: `1.5px solid ${C.pri}`, borderRadius: R.md, marginBottom: 8, cursor: "pointer", background: C.priPale,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.pri, fontFamily: MONO }}>{f.code}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.pri, background: C.w, padding: "2px 8px", borderRadius: R.pill }}>{f.tripStatus}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>{f.originName || "?"} → {f.destName || "?"}</div>
                  </div>
                ))}
              </>
            )}

            {/* History */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 8, marginTop: truck.activeFreights?.length ? 12 : 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Historial</div>
            {freightHistory === null ? <Loader /> : freightHistory.length === 0 ? (
              <EmptyState icon={Ic.truck(C.t3, 20)} title="Sin historial" subtitle="Este camión aún no completó fletes" />
            ) : freightHistory.map((f, i) => (
              <div key={i} onClick={() => onNavFreight?.(f.freightId)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.b2}`, cursor: "pointer",
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.pri, fontFamily: MONO, minWidth: 110 }}>{f.code}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.origin || "?"} → {f.dest || "?"}</span>
                <span style={{ fontSize: 11, color: C.t3 }}>{fmtDate(f.date)}</span>
                {f.tons && <span style={{ fontSize: 11, fontWeight: 600, color: C.t2 }}>{Number(f.tons).toLocaleString("es-UY")}t</span>}
              </div>
            ))}
          </div>
        )}

        {/* ==================== EXPENSES SECTION ==================== */}
        <SectionHeader title="Gastos" icon={Ic.doc(C.warn, 18)} count={expenses?.length} onAdd={canEdit ? () => { setShowExpForm(true); setExpOpen(true); } : null} expanded={expOpen} onToggle={() => setExpOpen(p => !p)} />
        {expOpen && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderTop: "none", borderBottomLeftRadius: R.lg, borderBottomRightRadius: R.lg, padding: 14, marginBottom: 16 }}>
            {/* Summary */}
            {expSummary && (
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, padding: "10px 12px", background: C.bg, borderRadius: R.md, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{fmtMoney(expSummary.thisMonth)}</div>
                  <div style={{ fontSize: 11, color: C.t3 }}>Este mes</div>
                </div>
                <div style={{ flex: 1, padding: "10px 12px", background: C.bg, borderRadius: R.md, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.t3 }}>{fmtMoney(expSummary.prevMonth)}</div>
                  <div style={{ fontSize: 11, color: C.t3 }}>Mes anterior</div>
                </div>
              </div>
            )}

            {showExpForm && <ExpForm onSave={handleAddExp} onCancel={() => setShowExpForm(false)} saving={saving} activeFreights={truck.activeFreights} />}
            {editExp && <ExpForm initial={editExp} onSave={handleUpdateExp} onCancel={() => setEditExp(null)} saving={saving} activeFreights={truck.activeFreights} />}

            {expenses === null ? <Loader /> : expenses.length === 0 && !showExpForm ? (
              <EmptyState icon={Ic.doc(C.t3, 20)} title="Sin gastos" subtitle="Registrá el primer gasto del camión" />
            ) : expenses.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${C.b2}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{EXP_TYPE_LABELS[e.type] || e.type}</span>
                    {e.freight && <span style={{ fontSize: 10.5, color: C.pri, fontWeight: 600 }}>{e.freight.code}</span>}
                  </div>
                  {e.description && <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}>{e.description}</div>}
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{fmtDate(e.date)}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, whiteSpace: "nowrap" }}>{fmtMoney(e.amount, e.currency)}</span>
                {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ padding: 4 }}>{Ic.clip(C.pri, 14)}</a>}
                {canEdit && <button onClick={() => setEditExp(e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.edit(C.t3, 14)}</button>}
                {canEdit && <button onClick={() => setConfirmDelete({ type: "exp", id: e.id, label: EXP_TYPE_LABELS[e.type] })} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.ban(C.err, 14)}</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== DELETE CONFIRMATION ==================== */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.w, borderRadius: R.xl, padding: 24, maxWidth: 340, width: "90%", boxShadow: C.shLg }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>¿Eliminar {confirmDelete.label}?</div>
            <div style={{ fontSize: 13, color: C.t3, marginBottom: 16 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="muted" full onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
              <Btn v="err" full onClick={() => confirmDelete.type === "doc" ? handleDeleteDoc(confirmDelete.id) : handleDeleteExp(confirmDelete.id)}>Eliminar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
