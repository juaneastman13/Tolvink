import { useMemo, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { C, R, FONT, Ic } from "../theme";
import { useAuthContext } from "../providers/AuthProvider";
import { useSSE } from "../hooks";
import { SL } from "../routing/Router";

const ACCENT = "#475569"; // slate-600

// Lazy-loaded mechanic screens
const MechanicDashboardScreen = lazy(() => import("../screens/mechanic/MechanicDashboardScreen"));
const MachinesListScreen = lazy(() => import("../screens/mechanic/MachinesListScreen"));
const MachineWizard = lazy(() => import("../screens/mechanic/MachineWizard"));
const MachineDetailScreen = lazy(() => import("../screens/mechanic/MachineDetailScreen"));
const MachineQrRedirect = lazy(() => import("../screens/mechanic/MachineQrRedirect"));
const AiChat = lazy(() => import("../AiChat"));
const AiChatFabComp = lazy(() => import("../AiChat").then(m => ({ default: m.AiChatFab })));

// Wrench icon
const WrenchIcon = (c = ACCENT, s = 20) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

// Swap/switch icon
const SwapIcon = (c = C.t3, s = 18) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const NAV_ITEMS = [
  { key: "dashboard", path: "/mechanic/dashboard", label: "Dashboard", icon: (c) => Ic.home(c, 20) },
  { key: "machines", path: "/mechanic/machines", label: "Mis Máquinas", icon: (c) => WrenchIcon(c, 20) },
];

export default function MechanicLayout() {
  const auth = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [sseAiResponse, setSseAiResponse] = useState(null);
  const [sseAiTranscription, setSseAiTranscription] = useState(null);
  const [sseAiChunk, setSseAiChunk] = useState(null);
  const [sseAiThinking, setSseAiThinking] = useState(null);
  const sseAiSeq = useRef(0);
  const sseChunkSeq = useRef(0);
  const sseThinkingSeq = useRef(0);

  useSSE(auth.user, {
    onAiResponse: (data) => { sseAiSeq.current++; setSseAiResponse({ ...data, _seq: sseAiSeq.current }); },
    onAiTranscription: (data) => { setSseAiTranscription({ ...data, _seq: Date.now() }); },
    onAiChunk: (data) => { sseChunkSeq.current++; setSseAiChunk({ ...data, _seq: sseChunkSeq.current }); },
    onAiThinking: () => { sseThinkingSeq.current++; setSseAiThinking({ _seq: sseThinkingSeq.current }); },
  });

  // Redirect /mechanic to /mechanic/dashboard
  useEffect(() => {
    if (location.pathname === "/mechanic") {
      navigate("/mechanic/dashboard", { replace: true });
    }
  }, [location.pathname, navigate]);

  const currentKey = useMemo(() => {
    const p = location.pathname;
    if (p === "/mechanic/machines/new") return "machineNew";
    if (p.startsWith("/mechanic/machines/qr/")) return "machineQr";
    if (p.startsWith("/mechanic/machines/")) return "machineDetail";
    if (p.startsWith("/mechanic/machines")) return "machines";
    return "dashboard";
  }, [location.pathname]);

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: C.bg, fontFamily: FONT }}>
      {/* Sidebar (desktop) */}
      {isDesktop && (
        <aside style={{
          width: 220,
          background: C.bgCard,
          borderRight: `1px solid ${C.b1}`,
          display: "flex",
          flexDirection: "column",
          padding: "16px 0",
          flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ padding: "8px 20px 20px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.pri, letterSpacing: -1 }}>tolvink</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: "rgba(71,85,105,0.1)", padding: "2px 7px", borderRadius: R.sm }}>Mecánico</span>
          </div>

          {/* Company name */}
          <div style={{ padding: "0 20px 16px", fontSize: 12, color: C.t3, fontWeight: 500 }}>
            {auth.user?.entity || auth.user?.companyName || ""}
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
            {NAV_ITEMS.map(item => {
              const active = currentKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: R.md,
                    border: "none",
                    background: active ? "rgba(71,85,105,0.08)" : "transparent",
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 400,
                    color: active ? C.t1 : C.t2,
                    transition: "background 0.15s",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {item.icon(active ? ACCENT : C.t3)}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Switch module */}
          <div style={{ padding: "16px 8px 8px", borderTop: `1px solid ${C.b2}`, marginTop: 8 }}>
            <button
              onClick={() => navigate("/module-selector")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: R.md,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: 13,
                color: C.t3,
                width: "100%",
                textAlign: "left",
              }}
            >
              {SwapIcon(C.t3, 18)}
              Cambiar módulo
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Mobile header */}
        {!isDesktop && (
          <header style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: C.bgCard,
            borderBottom: `1px solid ${C.b1}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.pri, letterSpacing: -0.5 }}>tolvink</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, background: "rgba(71,85,105,0.1)", padding: "2px 6px", borderRadius: R.xs }}>Mecánico</span>
            </div>
            <button
              onClick={() => navigate("/module-selector")}
              style={{ display: "flex", alignItems: "center", border: "none", background: "none", cursor: "pointer", padding: 4 }}
              aria-label="Cambiar módulo"
            >
              {SwapIcon(C.t3, 20)}
            </button>
          </header>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", position: "relative", minHeight: 0 }}>
          <Suspense fallback={<SL />}>
            {currentKey === "dashboard" && <MechanicDashboardScreen />}
            {currentKey === "machines" && <MachinesListScreen />}
            {currentKey === "machineNew" && <MachineWizard />}
            {currentKey === "machineDetail" && <MachineDetailScreen />}
            {currentKey === "machineQr" && <MachineQrRedirect />}
          </Suspense>
        </main>

        {/* Mobile bottom nav */}
        {!isDesktop && (
          <nav style={{
            display: "flex",
            borderTop: `1px solid ${C.b1}`,
            background: C.bgCard,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}>
            {NAV_ITEMS.map(item => {
              const active = currentKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    padding: "10px 0 8px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 10.5,
                    fontWeight: active ? 600 : 400,
                    color: active ? ACCENT : C.t3,
                  }}
                >
                  {item.icon(active ? ACCENT : C.muted)}
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <Suspense fallback={null}>
        <AiChatFabComp open={aiChatOpen} variant="mechanic" onClick={() => setAiChatOpen(p => !p)} />
        <AiChat
          open={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
          module="mechanic"
          title="Asistente Mecánico"
          subtitle="Maquinaria y mantenimiento"
          emptyTitle="Asistente mecánico de Tolvink"
          emptyDescription="Consultá alertas, planes, horómetro, repuestos y mantenimiento de tus máquinas."
          onNavigate={(nav) => {
            if (nav?.machineId) navigate(`/mechanic/machines/${nav.machineId}`);
          }}
          sseAiResponse={sseAiResponse}
          sseAiTranscription={sseAiTranscription}
          sseAiChunk={sseAiChunk}
          sseAiThinking={sseAiThinking}
        />
      </Suspense>
    </div>
  );
}
