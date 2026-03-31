import { useState } from "react";
import { C, R, FONT, Ic } from "../../theme";
import { apiCreateMaintenanceRecord } from "../../api";

const TYPES = [
  { value: "scheduled_service", label: "Service programado" },
  { value: "repair", label: "Reparación" },
  { value: "part_change", label: "Cambio de pieza" },
  { value: "inspection", label: "Inspección" },
];

export default function MaintenanceRecordForm({ machineId, currentHorometer, prefillType, onClose, onSaved }) {
  const [type, setType] = useState(prefillType || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [horometerReading, setHorometerReading] = useState(null);
  const [odometerReading, setOdometerReading] = useState(null);
  const [parts, setParts] = useState([]);
  const [laborCost, setLaborCost] = useState(null);
  const [workshop, setWorkshop] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const partsCost = parts.reduce((sum, p) => sum + ((p.unitCost || 0) * (p.quantity || 1)), 0);
  const totalCost = partsCost + (laborCost || 0);

  const canSubmit = type && date && description;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiCreateMaintenanceRecord(machineId, {
        type, date, description,
        horometerReading: horometerReading || undefined,
        odometerReading: odometerReading || undefined,
        partsUsed: parts.length > 0 ? parts : undefined,
        laborCost: laborCost || undefined,
        totalCost: totalCost || undefined,
        workshop: workshop || undefined,
        mechanic: mechanic || undefined,
        notes: notes || undefined,
      });
      onSaved();
    } catch (e) {
      alert(e?.message || "Error al guardar");
    }
    setSubmitting(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bgOverlay, display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bgCard, borderRadius: R.xl, padding: 24, width: "100%", maxWidth: 540,
        maxHeight: "90dvh", overflowY: "auto", fontFamily: FONT,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: 0 }}>Registrar intervención</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 20)}</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
            Tipo de intervención <span style={{ color: C.err }}>*</span>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar...</option>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          {/* Date */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
            Fecha <span style={{ color: C.err }}>*</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </label>

          {/* Horometer / Odometer */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
              Horómetro (hs)
              {currentHorometer != null && <span style={{ fontSize: 11, color: C.t3 }}>Actual: {currentHorometer.toLocaleString()} hs</span>}
              <input type="number" value={horometerReading ?? ""} onChange={e => setHorometerReading(e.target.value ? Number(e.target.value) : null)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
              Odómetro (km)
              <input type="number" value={odometerReading ?? ""} onChange={e => setOdometerReading(e.target.value ? Number(e.target.value) : null)} style={inputStyle} />
            </label>
          </div>

          {/* Description */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
            Descripción <span style={{ color: C.err }}>*</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 70 }} placeholder="Detalle del trabajo realizado..." />
          </label>

          {/* Parts */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.t2, fontWeight: 500 }}>Piezas utilizadas</span>
              <button onClick={() => setParts([...parts, { name: "", partNumber: "", brand: "", quantity: 1, unitCost: 0 }])}
                style={{ border: "none", background: C.priPale, color: C.pri, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: R.md, cursor: "pointer", fontFamily: FONT }}>
                + Pieza
              </button>
            </div>
            {parts.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-end" }}>
                <input value={p.name} onChange={e => { const n = [...parts]; n[i].name = e.target.value; setParts(n); }} placeholder="Nombre" style={{ ...inputStyle, flex: 2, padding: "6px 8px", fontSize: 12 }} />
                <input value={p.brand} onChange={e => { const n = [...parts]; n[i].brand = e.target.value; setParts(n); }} placeholder="Marca" style={{ ...inputStyle, flex: 1, padding: "6px 8px", fontSize: 12 }} />
                <input type="number" value={p.quantity} onChange={e => { const n = [...parts]; n[i].quantity = Number(e.target.value) || 1; setParts(n); }} placeholder="Cant" style={{ ...inputStyle, width: 50, padding: "6px 8px", fontSize: 12 }} />
                <input type="number" value={p.unitCost || ""} onChange={e => { const n = [...parts]; n[i].unitCost = Number(e.target.value) || 0; setParts(n); }} placeholder="$" style={{ ...inputStyle, width: 65, padding: "6px 8px", fontSize: 12 }} />
                <button onClick={() => setParts(parts.filter((_, j) => j !== i))} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}>{Ic.cross(C.err, 14)}</button>
              </div>
            ))}
          </div>

          {/* Labor + Total */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
              Mano de obra ($)
              <input type="number" value={laborCost ?? ""} onChange={e => setLaborCost(e.target.value ? Number(e.target.value) : null)} style={inputStyle} />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
              Costo total
              <div style={{ ...inputStyle, background: C.bgCardAlt, display: "flex", alignItems: "center", fontWeight: 600, color: C.t1 }}>
                $ {totalCost.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Workshop + Mechanic */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
              Taller
              <input value={workshop} onChange={e => setWorkshop(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
              Mecánico
              <input value={mechanic} onChange={e => setMechanic(e.target.value)} style={inputStyle} />
            </label>
          </div>

          {/* Notes */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2 }}>
            Notas
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: R.lg, border: `1px solid ${C.b1}`, background: C.bgCard, color: C.t2, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || submitting} style={{
            padding: "10px 20px", borderRadius: R.lg, border: "none",
            background: canSubmit ? C.pri : C.b1, color: canSubmit ? C.tOn : C.t3,
            fontSize: 14, fontWeight: 600, cursor: canSubmit && !submitting ? "pointer" : "not-allowed", fontFamily: FONT,
          }}>
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`,
  background: C.bgInput, fontSize: 14, color: C.t1, fontFamily: FONT, outline: "none",
  boxSizing: "border-box", width: "100%",
};
