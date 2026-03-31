import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { C, R, FONT, MONO, Ic } from "../../theme";
import { apiGetMachine } from "../../api";

const TYPE_LABELS = { tractor: "Tractor", harvester: "Cosechadora", seeder: "Sembradora", baler: "Enfardadora", implement: "Implemento", truck: "Camión", car: "Auto", motorcycle: "Moto", other: "Otro" };
const TABS = ["Datos técnicos", "Historial", "Mantenimiento", "Diagnósticos"];

function Badge({ label, color = C.t3, bg = C.bgCardAlt }) {
  return <span style={{ fontSize: 11.5, fontWeight: 600, color, background: bg, padding: "3px 10px", borderRadius: R.sm }}>{label}</span>;
}

export default function MachineDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setMachine(await apiGetMachine(id)); }
    catch { setMachine(null); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: C.t3, fontSize: 14, fontFamily: FONT }}>Cargando...</div>;
  if (!machine) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, fontFamily: FONT }}>
    <p style={{ fontSize: 16, color: C.t1, fontWeight: 600 }}>Máquina no encontrada</p>
    <button onClick={() => navigate("/mechanic/machines")} style={{ border: "none", background: C.pri, color: C.tOn, padding: "8px 20px", borderRadius: R.lg, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Volver al listado</button>
  </div>;

  const m = machine;

  return (
    <div style={{ padding: isMobile ? 16 : 24, fontFamily: FONT, maxWidth: 900, margin: "0 auto" }}>
      {/* Back + Header */}
      <button onClick={() => navigate("/mechanic/machines")} style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", color: C.t3, fontSize: 13, fontFamily: FONT, marginBottom: 16, padding: 0 }}>
        {Ic.chev(C.t3, 16)} Mis Máquinas
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {/* Photo or placeholder */}
        <div style={{ width: 80, height: 80, borderRadius: R.lg, background: C.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {m.photos?.length > 0
            ? <img src={m.photos[0]} alt="" style={{ width: 80, height: 80, borderRadius: R.lg, objectFit: "cover" }} />
            : Ic.gear(C.muted, 36)
          }
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t1, margin: "0 0 6px" }}>{m.brand} {m.model}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge label={TYPE_LABELS[m.machineType] || m.machineType} color={C.pri} bg={C.priPale} />
            <Badge label={m.status === "active" ? "Activa" : m.status === "sold" ? "Vendida" : "Inactiva"}
              color={m.status === "active" ? C.ok : C.muted} bg={m.status === "active" ? C.okPale : C.mutedPale} />
            {m.year && <Badge label={String(m.year)} />}
          </div>
          <div style={{ fontSize: 12.5, color: C.t3, marginTop: 6, fontFamily: MONO }}>S/N: {m.serialNumber}</div>
          {m.currentHorometer != null && <div style={{ fontSize: 12.5, color: C.t3, marginTop: 2 }}>Horómetro: {m.currentHorometer.toLocaleString()} hs</div>}
        </div>
        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { /* TODO: download QR */ }} style={{ padding: "8px 14px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCard, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: FONT, color: C.t2 }}>
            Descargar QR
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${C.b1}`, marginBottom: 20 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: "10px 18px", border: "none", borderBottom: `2px solid ${tab === i ? C.pri : "transparent"}`,
            background: "transparent", color: tab === i ? C.pri : C.t3, fontSize: 13.5, fontWeight: tab === i ? 600 : 400,
            cursor: "pointer", fontFamily: FONT, marginBottom: -2,
          }}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          <Section title="Motor">
            <Field label="Marca" value={m.engineBrand} />
            <Field label="Modelo" value={m.engineModel} />
            <Field label="Potencia" value={m.enginePower} />
            <Field label="Cilindrada" value={m.engineDisplacement} />
          </Section>
          <Section title="Transmisión">
            <Field label="Tipo" value={m.transmissionType} />
            <Field label="Combustible" value={m.fuelType} />
          </Section>
          <Section title="Hidráulica">
            <Field label="Sistema" value={m.hydraulicSystem} />
            <Field label="Capacidad" value={m.hydraulicCapacity} />
          </Section>
          <Section title="Neumáticos">
            <Field label="Medida" value={m.tireSize} />
            <Field label="Marca" value={m.tireBrand} />
          </Section>
        </div>
      )}

      {tab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Modifications */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: "0 0 12px" }}>Modificaciones</h3>
            {m.modifications?.length > 0 ? m.modifications.map(mod => (
              <div key={mod.id} style={{ padding: 12, borderRadius: R.md, border: `1px solid ${C.b1}`, marginBottom: 8, background: C.bgCard }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.t1 }}>{mod.description}</div>
                {mod.date && <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{new Date(mod.date).toLocaleDateString("es-UY")}</div>}
                {mod.notes && <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{mod.notes}</div>}
              </div>
            )) : <p style={{ fontSize: 13, color: C.t3 }}>Sin modificaciones registradas</p>}
          </div>
          {/* Repair History */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: "0 0 12px" }}>Reparaciones</h3>
            {m.repairHistory?.length > 0 ? m.repairHistory.map(rep => (
              <div key={rep.id} style={{ padding: 12, borderRadius: R.md, border: `1px solid ${C.b1}`, marginBottom: 8, background: C.bgCard }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.t1 }}>{rep.description}</div>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  {rep.date && <span style={{ fontSize: 12, color: C.t3 }}>{new Date(rep.date).toLocaleDateString("es-UY")}</span>}
                  {rep.workshop && <span style={{ fontSize: 12, color: C.t3 }}>Taller: {rep.workshop}</span>}
                  {rep.cost != null && <span style={{ fontSize: 12, color: C.t3 }}>$ {rep.cost.toLocaleString()}</span>}
                </div>
              </div>
            )) : <p style={{ fontSize: 13, color: C.t3 }}>Sin reparaciones registradas</p>}
          </div>
        </div>
      )}

      {tab === 2 && <Placeholder title="Mantenimiento" />}
      {tab === 3 && <Placeholder title="Diagnósticos" />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ padding: 16, borderRadius: R.lg, border: `1px solid ${C.b1}`, background: C.bgCard }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: C.t2, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: C.t3 }}>{label}</span>
      <span style={{ color: value ? C.t1 : C.muted, fontWeight: value ? 500 : 400 }}>{value || "—"}</span>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 48 }}>
      {Ic.gear(C.muted, 32)}
      <p style={{ fontSize: 15, fontWeight: 600, color: C.t1, fontFamily: FONT }}>{title}</p>
      <p style={{ fontSize: 13, color: C.t3, fontFamily: FONT }}>Próximamente</p>
    </div>
  );
}
