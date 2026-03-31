import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C, R, FONT, Ic } from "../theme";
import api from "../api";

// Wrench icon (not in Ic set)
const WrenchIcon = (c = C.t3, s = 40) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const MECHANIC_COLOR = "#475569"; // slate-600 — armoniza con la paleta

export default function ModuleSelectorScreen({ user }) {
  const navigate = useNavigate();
  const [remember, setRemember] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectModule = useCallback(async (mod) => {
    setLoading(true);
    try {
      if (remember && user) {
        await api("/users/preferred-module", { body: { preferredModule: mod } }).catch(() => {});
      }
      navigate(mod === "mechanic" ? "/mechanic" : "/", { replace: true });
    } catch {
      navigate(mod === "mechanic" ? "/mechanic" : "/", { replace: true });
    }
  }, [remember, user, navigate]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div style={{
      minHeight: "100dvh",
      background: C.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: FONT,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <span style={{ fontSize: 48, fontWeight: 800, color: C.pri, letterSpacing: -2 }}>tolvink</span>
        <span style={{ width: 10, height: 10, borderRadius: R.xs, background: C.acc, display: "inline-block", marginLeft: 3, marginTop: -18, verticalAlign: "top" }} />
      </div>

      {/* Title */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, marginBottom: 28, textAlign: "center", fontFamily: FONT }}>
        ¿A qué módulo querés ingresar?
      </h1>

      {/* Cards */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: 16,
        maxWidth: 560,
        width: "100%",
      }}>
        {/* Logística */}
        <button
          onClick={() => selectModule("logistics")}
          onMouseEnter={() => setHoveredCard("logistics")}
          onMouseLeave={() => setHoveredCard(null)}
          disabled={loading}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "32px 24px",
            borderRadius: R.lg,
            border: `2px solid ${hoveredCard === "logistics" ? C.pri : C.b1}`,
            background: hoveredCard === "logistics" ? C.priGhost : C.bgCard,
            cursor: loading ? "wait" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: hoveredCard === "logistics" ? C.shMd : C.sh,
            fontFamily: FONT,
          }}
        >
          {Ic.truck(C.pri, 40)}
          <span style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Logística</span>
          <span style={{ fontSize: 13, color: C.t3, textAlign: "center" }}>Gestión de fletes y transporte</span>
        </button>

        {/* Mecánico */}
        <button
          onClick={() => selectModule("mechanic")}
          onMouseEnter={() => setHoveredCard("mechanic")}
          onMouseLeave={() => setHoveredCard(null)}
          disabled={loading}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "32px 24px",
            borderRadius: R.lg,
            border: `2px solid ${hoveredCard === "mechanic" ? MECHANIC_COLOR : C.b1}`,
            background: hoveredCard === "mechanic" ? "rgba(71,85,105,0.05)" : C.bgCard,
            cursor: loading ? "wait" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: hoveredCard === "mechanic" ? C.shMd : C.sh,
            fontFamily: FONT,
          }}
        >
          {WrenchIcon(MECHANIC_COLOR, 40)}
          <span style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Mecánico</span>
          <span style={{ fontSize: 13, color: C.t3, textAlign: "center" }}>Diagnóstico y mantenimiento de maquinaria</span>
        </button>
      </div>

      {/* Remember checkbox */}
      <label style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 24,
        cursor: "pointer",
        fontSize: 13.5,
        color: C.t2,
        fontFamily: FONT,
      }}>
        <input
          type="checkbox"
          checked={remember}
          onChange={e => setRemember(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.pri, cursor: "pointer" }}
        />
        Recordar mi elección
      </label>
    </div>
  );
}
