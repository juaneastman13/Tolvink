import { useState, useRef } from "react";
import { C, Ic, MONO, R } from "../theme";
import { uploadPhoto, apiCreateWeighTicket, apiRunWeighTicketOcr } from "../api";
import { useUIStore } from "../store";
import log from "../logger";

const FIELD_LABELS = {
  ticketNumber: "Nro. Ticket",
  grossWeight: "Peso Bruto (kg)",
  tareWeight: "Tara (kg)",
  netWeight: "Peso Neto (kg)",
  humidity: "Humedad (%)",
  impurities: "Impurezas (%)",
  dockage: "Merma (kg/%)",
  temperature: "Temperatura (°C)",
  observations: "Observaciones",
};

const NUM_FIELDS = ["grossWeight", "tareWeight", "netWeight", "humidity", "impurities", "dockage", "temperature"];

function SmallField({ label, value, onChange, placeholder, type = "text", mono }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.4, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
      <input
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={type === "number" ? "decimal" : undefined}
        style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontSize: 14.3, fontFamily: mono ? MONO : "inherit", outline: "none", boxSizing: "border-box" }}
        onFocus={e => { e.target.style.borderColor = C.bFocus; }}
        onBlur={e => { e.target.style.borderColor = C.b1; }}
      />
    </div>
  );
}

export default function WeighTicketForm({ freightId, type = "destination", onCreated, originTickets, compact }) {
  const [mode, setMode] = useState(null); // null | "photo" | "manual"
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({});
  const [ticketId, setTicketId] = useState(null);
  const inputRef = useRef(null);
  const show = useUIStore(s => s.show);

  const setField = (k, v) => setFields(prev => {
    const next = { ...prev, [k]: v };
    // Auto-calc netWeight
    if ((k === "grossWeight" || k === "tareWeight") && !next.netWeight) {
      const g = parseFloat(next.grossWeight);
      const t = parseFloat(next.tareWeight);
      if (g > 0 && t > 0) next.netWeight = String(Math.max(0, g - t));
    }
    return next;
  });

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { show("Solo imágenes", "err"); return; }
    if (file.size > 10 * 1024 * 1024) { show("Máximo 10MB", "err"); return; }

    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setUploading(true);
    try {
      const url = await uploadPhoto(file, freightId, "weigh-ticket");
      setPhotoUrl(url);

      // Create ticket with photo, then run OCR
      const ticket = await apiCreateWeighTicket(freightId, { type, photoUrl: url });
      setTicketId(ticket.id);

      setOcrRunning(true);
      try {
        const updated = await apiRunWeighTicketOcr(freightId, ticket.id);
        // Fill form with OCR results
        const ocrFields = {};
        if (updated.ticketNumber) ocrFields.ticketNumber = updated.ticketNumber;
        if (updated.grossWeight != null) ocrFields.grossWeight = String(Number(updated.grossWeight));
        if (updated.tareWeight != null) ocrFields.tareWeight = String(Number(updated.tareWeight));
        if (updated.netWeight != null) ocrFields.netWeight = String(Number(updated.netWeight));
        if (updated.humidity != null) ocrFields.humidity = String(Number(updated.humidity));
        if (updated.impurities != null) ocrFields.impurities = String(Number(updated.impurities));
        if (updated.dockage != null) ocrFields.dockage = String(Number(updated.dockage));
        if (updated.temperature != null) ocrFields.temperature = String(Number(updated.temperature));
        if (updated.observations) ocrFields.observations = updated.observations;
        setFields(ocrFields);
        setOcrDone(true);
      } catch (ocrErr) {
        log.warn("WT-OCR", "OCR failed:", ocrErr);
        show("No se pudieron extraer datos de la foto. Completá manualmente.", "warn");
      } finally {
        setOcrRunning(false);
      }
    } catch (err) {
      log.error("WT-UPLOAD", err);
      show(err.message || "Error al subir foto", "err");
      URL.revokeObjectURL(preview);
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let ticket;
      if (ticketId) {
        // Already created via photo flow — update with manual fields
        const { apiUpdateWeighTicket } = await import("../api");
        const data = {};
        if (fields.ticketNumber) data.ticketNumber = fields.ticketNumber;
        for (const k of NUM_FIELDS) {
          const v = parseFloat(fields[k]);
          if (!isNaN(v)) data[k] = v;
        }
        if (fields.observations) data.observations = fields.observations;
        ticket = await apiUpdateWeighTicket(freightId, ticketId, data);
      } else {
        // Manual-only flow — create from scratch
        const data = { type };
        if (fields.ticketNumber) data.ticketNumber = fields.ticketNumber;
        for (const k of NUM_FIELDS) {
          const v = parseFloat(fields[k]);
          if (!isNaN(v)) data[k] = v;
        }
        if (fields.observations) data.observations = fields.observations;
        ticket = await apiCreateWeighTicket(freightId, data);
        setTicketId(ticket.id);
      }
      if (onCreated) onCreated(ticket);
    } catch (err) {
      log.error("WT-SAVE", err);
      show(err.message || "Error al guardar ticket", "err");
    } finally {
      setSaving(false);
    }
  };

  const hasAnyField = Object.values(fields).some(v => v && String(v).trim());
  const typeLabel = type === "origin" ? "Origen" : "Destino";

  // Comparison with origin tickets (for destination flow)
  const comparison = type === "destination" && originTickets?.length > 0 ? (() => {
    const ot = originTickets[0]; // Most recent origin ticket
    const oNet = ot.netWeight != null ? Number(ot.netWeight) : null;
    const dNet = fields.netWeight ? parseFloat(fields.netWeight) : null;
    if (oNet == null || dNet == null) return null;
    const diff = dNet - oNet;
    const pct = oNet > 0 ? ((diff / oNet) * 100).toFixed(1) : null;
    return { originNet: oNet, destNet: dNet, diff, pct };
  })() : null;

  // Mode selection screen
  if (mode === null) {
    return (
      <div style={{ padding: compact ? 0 : "4px 0" }}>
        <div style={{ fontSize: 12.2, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          {Ic.doc(C.t2, 14)} Ticket de Pesaje — {typeLabel}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setMode("photo"); setTimeout(() => inputRef.current?.click(), 100); }}
            style={{ flex: 1, padding: "14px 12px", borderRadius: R.md, border: `1.5px solid ${C.acc}40`, background: `${C.acc}08`, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {Ic.cam(C.acc, 24)}
            <span style={{ fontSize: 13.2, fontWeight: 700, color: C.acc }}>Foto + OCR</span>
            <span style={{ fontSize: 11, color: C.t3 }}>Sacá foto y se extraen los datos</span>
          </button>
          <button onClick={() => setMode("manual")}
            style={{ flex: 1, padding: "14px 12px", borderRadius: R.md, border: `1.5px solid ${C.pri}40`, background: `${C.pri}08`, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            {Ic.edit(C.pri, 24)}
            <span style={{ fontSize: 13.2, fontWeight: 700, color: C.pri }}>Manual</span>
            <span style={{ fontSize: 11, color: C.t3 }}>Ingresá los datos a mano</span>
          </button>
        </div>
      </div>
    );
  }

  // Photo upload + OCR processing
  const showPhotoSection = mode === "photo";
  const showForm = mode === "manual" || (mode === "photo" && (ocrDone || (!uploading && !ocrRunning && photoUrl)));

  return (
    <div style={{ padding: compact ? 0 : "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12.2, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
          {Ic.doc(C.t2, 14)} Ticket — {typeLabel}
        </div>
        <button onClick={() => { setMode(null); setFields({}); setPhotoUrl(null); setPhotoPreview(null); setTicketId(null); setOcrDone(false); }}
          style={{ fontSize: 11.5, fontWeight: 600, color: C.t3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 8px" }}>Cambiar modo</button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />

      {/* Photo preview */}
      {showPhotoSection && (
        <div style={{ marginBottom: 10 }}>
          {photoPreview ? (
            <div style={{ position: "relative", borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.b1}`, marginBottom: 8 }}>
              <img src={photoPreview} alt="ticket" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
              {(uploading || ocrRunning) && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  <span style={{ fontSize: 12.7, fontWeight: 600, color: "#fff" }}>{uploading ? "Subiendo foto..." : "Analizando con OCR..."}</span>
                </div>
              )}
              {ocrDone && (
                <div style={{ position: "absolute", top: 6, right: 6, background: C.ok, borderRadius: R.md, padding: "3px 10px", fontSize: 11, color: C.w, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  {Ic.chk(C.w, 11)} Datos extraídos
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              style={{ width: "100%", padding: "16px 14px", borderRadius: R.md, border: `1.5px dashed ${C.acc}60`, background: `${C.acc}08`, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {Ic.cam(C.acc, 20)}
              <span style={{ fontSize: 13.2, fontWeight: 600, color: C.acc }}>Tomar foto del ticket</span>
            </button>
          )}
        </div>
      )}

      {/* Form fields */}
      {showForm && (
        <div>
          {ocrDone && (
            <div style={{ fontSize: 11.5, color: C.info, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
              {Ic.chk(C.info, 12)} Datos del OCR — revisá y corregí si es necesario
            </div>
          )}
          <SmallField label={FIELD_LABELS.ticketNumber} value={fields.ticketNumber} onChange={v => setField("ticketNumber", v)} placeholder="Ej: 001234" mono />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <SmallField label={FIELD_LABELS.grossWeight} value={fields.grossWeight} onChange={v => setField("grossWeight", v)} placeholder="0" type="number" mono />
            <SmallField label={FIELD_LABELS.tareWeight} value={fields.tareWeight} onChange={v => setField("tareWeight", v)} placeholder="0" type="number" mono />
            <SmallField label={FIELD_LABELS.netWeight} value={fields.netWeight} onChange={v => setField("netWeight", v)} placeholder="Auto" type="number" mono />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <SmallField label={FIELD_LABELS.humidity} value={fields.humidity} onChange={v => setField("humidity", v)} placeholder="%" type="number" mono />
            <SmallField label={FIELD_LABELS.impurities} value={fields.impurities} onChange={v => setField("impurities", v)} placeholder="%" type="number" mono />
            <SmallField label={FIELD_LABELS.temperature} value={fields.temperature} onChange={v => setField("temperature", v)} placeholder="°C" type="number" mono />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <SmallField label={FIELD_LABELS.dockage} value={fields.dockage} onChange={v => setField("dockage", v)} placeholder="0" type="number" mono />
            <div style={{ flex: 2, minWidth: 0 }}>
              <div style={{ fontSize: 10.4, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{FIELD_LABELS.observations}</div>
              <input value={fields.observations || ""} onChange={e => setField("observations", e.target.value)} placeholder="Notas..." style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontSize: 14.3, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = C.bFocus; }} onBlur={e => { e.target.style.borderColor = C.b1; }} />
            </div>
          </div>

          {/* Origin vs Destination comparison */}
          {comparison && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: R.md, background: Math.abs(comparison.diff) > comparison.originNet * 0.02 ? `${C.warn}12` : `${C.ok}12`, border: `1px solid ${Math.abs(comparison.diff) > comparison.originNet * 0.02 ? C.warn : C.ok}30` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>Comparación Origen vs Destino</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.7 }}>
                <span style={{ color: C.t2 }}>Origen: <strong style={{ fontFamily: MONO }}>{comparison.originNet.toLocaleString()} kg</strong></span>
                <span style={{ color: C.t2 }}>Destino: <strong style={{ fontFamily: MONO }}>{comparison.destNet.toLocaleString()} kg</strong></span>
                <span style={{ color: comparison.diff < 0 ? C.err : C.ok, fontWeight: 700 }}>
                  {comparison.diff > 0 ? "+" : ""}{comparison.diff.toLocaleString()} kg ({comparison.pct}%)
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={handleSave} disabled={saving || !hasAnyField}
              style={{ flex: 1, padding: "10px 14px", borderRadius: R.md, border: "none", background: hasAnyField ? C.acc : C.b1, color: hasAnyField ? C.w : C.t3, fontSize: 14.3, fontWeight: 700, cursor: hasAnyField && !saving ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: saving ? 0.6 : 1 }}>
              {saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} /> Guardando...</> : <>{Ic.chk(C.w, 14)} Guardar ticket</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact read-only display for existing weigh tickets
export function WeighTicketSummary({ tickets, label }) {
  if (!tickets || tickets.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {label && <div style={{ fontSize: 10.4, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>}
      {tickets.map(t => (
        <div key={t.id} style={{ padding: "8px 12px", borderRadius: R.md, background: C.bg, border: `1px solid ${C.b1}`, marginBottom: 4, display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
          {t.ticketNumber && <span style={{ fontSize: 12.7, fontWeight: 700, color: C.t1, fontFamily: MONO }}>#{t.ticketNumber}</span>}
          {t.grossWeight != null && <span style={{ fontSize: 11.5, color: C.t2 }}>Bruto: <strong style={{ fontFamily: MONO }}>{Number(t.grossWeight).toLocaleString()}</strong></span>}
          {t.tareWeight != null && <span style={{ fontSize: 11.5, color: C.t2 }}>Tara: <strong style={{ fontFamily: MONO }}>{Number(t.tareWeight).toLocaleString()}</strong></span>}
          {t.netWeight != null && <span style={{ fontSize: 11.5, color: C.pri, fontWeight: 700 }}>Neto: <strong style={{ fontFamily: MONO }}>{Number(t.netWeight).toLocaleString()} kg</strong></span>}
          {t.humidity != null && <span style={{ fontSize: 11.5, color: C.t2 }}>Hum: {Number(t.humidity)}%</span>}
          {t.impurities != null && <span style={{ fontSize: 11.5, color: C.t2 }}>Imp: {Number(t.impurities)}%</span>}
          {t.photoUrl && <span style={{ fontSize: 11, color: C.info, display: "flex", alignItems: "center", gap: 3 }}>{Ic.cam(C.info, 10)} Foto</span>}
          {t.ocrConfidence != null && <span style={{ fontSize: 10.4, color: C.t3, background: `${C.info}15`, padding: "1px 6px", borderRadius: R.xs }}>OCR {Math.round(Number(t.ocrConfidence) * 100)}%</span>}
        </div>
      ))}
    </div>
  );
}
