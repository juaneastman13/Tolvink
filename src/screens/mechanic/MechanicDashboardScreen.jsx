import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C, R, FONT, Ic } from "../../theme";
import { apiGetMechanicDashboard } from "../../api";

const TYPE_LABELS = { tractor: "Tractor", harvester: "Cosechadora", seeder: "Sembradora", baler: "Enfardadora", implement: "Implemento", truck: "Camión", other: "Otro" };
const STATUS_DOT = { up_to_date: C.ok, alert: C.warn, overdue: C.err, open_issue: C.err };

export default function MechanicDashboardScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setData(await apiGetMechanicDashboard()); }
    catch { setData(null); }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: C.t3, fontSize: 14, fontFamily: FONT }}>Cargando dashboard...</div>;

  if (!data || data.summary.totalMachines === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, fontFamily: FONT }}>
        <div style={{ width: 64, height: 64, borderRadius: R.xl, background: C.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Ic.gear(C.muted, 32)}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Bienvenido al módulo Mecánico</h2>
        <p style={{ fontSize: 14, color: C.t3, textAlign: "center", maxWidth: 360 }}>Registrá tu primera máquina para empezar a gestionar el mantenimiento de tu flota</p>
        <button onClick={() => navigate("/mechanic/machines/new")} style={{ padding: "10px 24px", borderRadius: R.lg, border: "none", background: C.pri, color: C.tOn, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
          + Registrar máquina
        </button>
      </div>
    );
  }

  const { summary, machines, recentAlerts, recentDiagnostics } = data;
  const filteredMachines = statusFilter ? machines.filter(m => m.status === statusFilter) : machines;

  return (
    <div style={{ padding: isMobile ? 16 : 24, fontFamily: FONT, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, marginBottom: 20 }}>Dashboard</h1>

      {/* ── Counters ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <CounterCard label="Al día" count={summary.upToDate} color={C.ok} bg={C.okPale}
          icon={Ic.chk(C.ok, 22)} active={statusFilter === "up_to_date"} onClick={() => setStatusFilter(statusFilter === "up_to_date" ? null : "up_to_date")} />
        <CounterCard label="Alertas" count={summary.alertsPending} color={C.warn} bg={C.warnPale}
          icon={Ic.warn(C.warn, 22)} active={statusFilter === "alert" || statusFilter === "overdue"} onClick={() => setStatusFilter(statusFilter === "alert" ? null : "alert")} />
        <CounterCard label="Problemas abiertos" count={summary.openIssues} color={C.err} bg={C.errPale}
          icon={Ic.ban(C.err, 22)} active={statusFilter === "open_issue"} onClick={() => setStatusFilter(statusFilter === "open_issue" ? null : "open_issue")} />
      </div>

      {/* ── Recent alerts + diagnostics ── */}
      {(recentAlerts.length > 0 || recentDiagnostics.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {recentAlerts.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.t2, margin: "0 0 10px" }}>Alertas recientes</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentAlerts.map(a => (
                  <button key={a.id} onClick={() => navigate(`/mechanic/machines/${a.machineId}`)}
                    style={{ ...listItem, borderLeft: `3px solid ${a.severity === "overdue" ? C.err : C.warn}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.t1 }}>{a.machineBrand} {a.machineModel}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>{a.label} — {a.message}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {recentDiagnostics.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.t2, margin: "0 0 10px" }}>Diagnósticos abiertos</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentDiagnostics.map(d => (
                  <button key={d.id} onClick={() => navigate(`/mechanic/machines/${d.machineId}/diagnostics/${d.id}`)}
                    style={{ ...listItem, borderLeft: `3px solid #E65100` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.t1 }}>{d.machineBrand} {d.machineModel}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>{d.title || "Sin título"} · {d.messagesCount} msgs</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Machine list ── */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: C.t2, margin: "0 0 12px" }}>
        Máquinas {statusFilter && `(${filteredMachines.length})`}
        {statusFilter && <button onClick={() => setStatusFilter(null)} style={{ border: "none", background: "none", color: C.pri, fontSize: 12, cursor: "pointer", fontFamily: FONT, marginLeft: 8 }}>Ver todas</button>}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {filteredMachines.map(m => (
          <button key={m.id} onClick={() => navigate(`/mechanic/machines/${m.id}`)} style={{
            display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: R.lg,
            border: `1px solid ${C.b1}`, background: C.bgCard, cursor: "pointer", fontFamily: FONT,
            textAlign: "left", width: "100%", boxShadow: C.sh,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: R.md, background: C.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {m.photoUrl ? <img src={m.photoUrl} alt="" style={{ width: 48, height: 48, borderRadius: R.md, objectFit: "cover" }} /> : Ic.gear(C.muted, 22)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.brand} {m.model}</span>
                <span style={{ width: 8, height: 8, borderRadius: R.full, background: STATUS_DOT[m.status] || C.muted, flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
                {TYPE_LABELS[m.machineType] || m.machineType}{m.year ? ` · ${m.year}` : ""}
                {m.currentHorometer != null ? ` · ${m.currentHorometer.toLocaleString()} hs` : ""}
              </div>
              {m.nextMaintenance && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Próx: {m.nextMaintenance.type} ({m.nextMaintenance.estimatedAt})</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
              {m.alertsCount > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: C.warn, background: C.warnPale, padding: "1px 7px", borderRadius: R.sm }}>{m.alertsCount} alerta{m.alertsCount > 1 ? "s" : ""}</span>}
              {m.openDiagnosticsCount > 0 && <span style={{ fontSize: 10.5, fontWeight: 600, color: "#E65100", background: "#FFF3E0", padding: "1px 7px", borderRadius: R.sm }}>{m.openDiagnosticsCount} diag</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CounterCard({ label, count, color, bg, icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: R.lg,
      border: `2px solid ${active ? color : C.b1}`, background: active ? bg : C.bgCard,
      cursor: "pointer", fontFamily: FONT, textAlign: "left", width: "100%",
      boxShadow: active ? C.shMd : C.sh, transition: "all 0.15s",
    }}>
      {icon}
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 12.5, color: C.t2, marginTop: 2 }}>{label}</div>
      </div>
    </button>
  );
}

const listItem = {
  padding: "10px 14px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCard,
  cursor: "pointer", fontFamily: FONT, textAlign: "left", width: "100%",
};
