import { useState, useEffect, useCallback } from "react";
import { C, R, FONT, Ic } from "../../theme";
import {
  apiListMaintenanceRecords, apiGetMachineAlerts, apiUpdateAlertStatus,
  apiGetMaintenancePlan, apiCreatePlanFromTemplate,
} from "../../api";
import MaintenanceRecordForm from "./MaintenanceRecordForm";

const TYPE_BADGES = {
  scheduled_service: { label: "Service", color: C.info, bg: C.infoPale },
  repair: { label: "Reparación", color: "#E65100", bg: "#FFF3E0" },
  part_change: { label: "Cambio pieza", color: C.ok, bg: C.okPale },
  inspection: { label: "Inspección", color: C.muted, bg: C.mutedPale },
};

export default function MaintenanceTab({ machine }) {
  const [records, setRecords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prefillType, setPrefillType] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r, a, p] = await Promise.all([
        apiListMaintenanceRecords(machine.id),
        apiGetMachineAlerts(machine.id),
        apiGetMaintenancePlan(machine.id).catch(() => null),
      ]);
      setRecords(r); setAlerts(a); setPlan(p);
    } catch { /* ignore */ }
    setLoading(false);
  }, [machine.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDismiss = async (alertId) => {
    await apiUpdateAlertStatus(alertId, "dismissed").catch(() => {});
    setAlerts(alerts.filter(a => a.id !== alertId));
  };

  const handleRegisterFromAlert = (alert) => {
    setPrefillType(alert.maintenanceType === "oilChange" ? "scheduled_service" : "scheduled_service");
    setShowForm(true);
  };

  const handleApplyTemplate = async () => {
    try {
      const p = await apiCreatePlanFromTemplate(machine.id);
      setPlan(p);
    } catch (e) { alert(e?.message || "Error al aplicar plan"); }
  };

  const handleRecordSaved = () => {
    setShowForm(false);
    setPrefillType(null);
    fetchAll();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.t3, fontSize: 14, fontFamily: FONT }}>Cargando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: FONT }}>
      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: "0 0 12px" }}>Alertas activas</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map(a => (
              <div key={a.id} style={{
                padding: "12px 16px", borderRadius: R.lg,
                border: `1px solid ${a.severity === "overdue" ? C.err : C.warn}`,
                background: a.severity === "overdue" ? C.errPale : C.warnPale,
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                {Ic.warn(a.severity === "overdue" ? C.err : C.warn, 20)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{a.label}</div>
                  <div style={{ fontSize: 12.5, color: C.t2 }}>{a.message}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => handleRegisterFromAlert(a)} style={{
                    padding: "6px 12px", borderRadius: R.md, border: "none",
                    background: C.pri, color: C.tOn, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                  }}>Registrar</button>
                  <button onClick={() => handleDismiss(a.id)} style={{
                    padding: "6px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`,
                    background: C.bgCard, color: C.t3, fontSize: 12, cursor: "pointer", fontFamily: FONT,
                  }}>Descartar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New record button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => { setPrefillType(null); setShowForm(true); }} style={{
          padding: "8px 18px", borderRadius: R.lg, border: "none",
          background: C.pri, color: C.tOn, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
          display: "flex", alignItems: "center", gap: 6,
        }}>{Ic.plus(C.tOn, 16)} Registrar intervención</button>
      </div>

      {/* ── Timeline ── */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: "0 0 12px" }}>Historial de intervenciones</h3>
        {records.length === 0 ? (
          <p style={{ fontSize: 13, color: C.t3 }}>Sin intervenciones registradas</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {records.map(r => {
              const badge = TYPE_BADGES[r.type] || TYPE_BADGES.inspection;
              const expanded = expandedId === r.id;
              return (
                <button key={r.id} onClick={() => setExpandedId(expanded ? null : r.id)} style={{
                  padding: "12px 16px", borderRadius: R.lg, border: `1px solid ${C.b1}`,
                  background: C.bgCard, cursor: "pointer", fontFamily: FONT, textAlign: "left", width: "100%",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: badge.color, background: badge.bg, padding: "2px 8px", borderRadius: R.sm }}>{badge.label}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</span>
                    <span style={{ fontSize: 12, color: C.t3, flexShrink: 0 }}>{new Date(r.date).toLocaleDateString("es-UY")}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                    {r.horometerReading != null && <span style={{ fontSize: 11.5, color: C.t3 }}>{r.horometerReading.toLocaleString()} hs</span>}
                    {r.totalCost != null && <span style={{ fontSize: 11.5, color: C.t3 }}>$ {r.totalCost.toLocaleString()}</span>}
                  </div>
                  {expanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.b2}` }}>
                      {r.workshop && <div style={{ fontSize: 12.5, color: C.t2, marginBottom: 4 }}>Taller: {r.workshop}</div>}
                      {r.mechanic && <div style={{ fontSize: 12.5, color: C.t2, marginBottom: 4 }}>Mecánico: {r.mechanic}</div>}
                      {r.partsUsed && Array.isArray(r.partsUsed) && r.partsUsed.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Piezas utilizadas:</div>
                          {r.partsUsed.map((p, i) => (
                            <div key={i} style={{ fontSize: 12, color: C.t2, padding: "2px 0" }}>
                              • {p.name}{p.brand ? ` (${p.brand})` : ""}{p.quantity ? ` x${p.quantity}` : ""}{p.unitCost ? ` — $${p.unitCost}` : ""}
                            </div>
                          ))}
                        </div>
                      )}
                      {r.notes && <div style={{ fontSize: 12.5, color: C.t3, marginTop: 6 }}>{r.notes}</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Maintenance Plan ── */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: "0 0 12px" }}>Plan de mantenimiento</h3>
        {plan ? (
          <div style={{ borderRadius: R.lg, border: `1px solid ${C.b1}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bgCardAlt }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: C.t2, fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: C.t2, fontWeight: 600 }}>Cada (hs)</th>
                </tr>
              </thead>
              <tbody>
                {[...(plan.intervals || []), ...(plan.customIntervals || [])].map((iv, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.b2}` }}>
                    <td style={{ padding: "8px 12px", color: C.t1 }}>{iv.label || iv.type}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: C.t2 }}>{iv.hours || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : machine.templateId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderRadius: R.lg, border: `1px dashed ${C.b1}`, background: C.bgCardAlt }}>
            <span style={{ fontSize: 13, color: C.t3, flex: 1 }}>Esta máquina tiene datos de fábrica disponibles</span>
            <button onClick={handleApplyTemplate} style={{
              padding: "8px 16px", borderRadius: R.md, border: "none",
              background: C.pri, color: C.tOn, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            }}>Aplicar plan de fábrica</button>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: C.t3 }}>Sin plan de mantenimiento configurado</p>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <MaintenanceRecordForm
          machineId={machine.id}
          currentHorometer={machine.currentHorometer}
          prefillType={prefillType}
          onClose={() => { setShowForm(false); setPrefillType(null); }}
          onSaved={handleRecordSaved}
        />
      )}
    </div>
  );
}
