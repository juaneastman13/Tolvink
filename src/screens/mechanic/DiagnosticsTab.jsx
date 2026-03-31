import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C, R, FONT, Ic } from "../../theme";
import { apiListDiagnosticSessions, apiCreateDiagnosticSession } from "../../api";

const STATUS_BADGE = {
  open: { label: "Abierta", color: "#E65100", bg: "#FFF3E0" },
  resolved: { label: "Resuelta", color: C.ok, bg: C.okPale },
  unresolved: { label: "No resuelta", color: C.err, bg: C.errPale },
};

export default function DiagnosticsTab({ machine }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setSessions(await apiListDiagnosticSessions(machine.id)); }
    catch { setSessions([]); }
    setLoading(false);
  }, [machine.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleNew = async () => {
    try {
      const s = await apiCreateDiagnosticSession(machine.id);
      navigate(`/mechanic/machines/${machine.id}/diagnostics/${s.id}`);
    } catch (e) { alert(e?.message || "Error al crear sesión"); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.t3, fontSize: 14, fontFamily: FONT }}>Cargando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleNew} style={{
          padding: "8px 18px", borderRadius: R.lg, border: "none", background: C.pri, color: C.tOn,
          fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6,
        }}>{Ic.plus(C.tOn, 16)} Nuevo diagnóstico</button>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.t3 }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>Sin sesiones de diagnóstico</p>
          <p style={{ fontSize: 13 }}>Creá una nueva sesión para consultar al agente mecánico</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map(s => {
            const badge = STATUS_BADGE[s.status] || STATUS_BADGE.open;
            return (
              <button key={s.id} onClick={() => navigate(`/mechanic/machines/${machine.id}/diagnostics/${s.id}`)} style={{
                padding: "14px 16px", borderRadius: R.lg, border: `1px solid ${C.b1}`, background: C.bgCard,
                cursor: "pointer", fontFamily: FONT, textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title || "Sin título"}
                  </div>
                  <div style={{ fontSize: 12, color: C.t3, marginTop: 3 }}>
                    {new Date(s.createdAt).toLocaleDateString("es-UY")} · {s.messagesCount} mensajes
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: badge.color, background: badge.bg, padding: "3px 10px", borderRadius: R.sm, flexShrink: 0 }}>
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
