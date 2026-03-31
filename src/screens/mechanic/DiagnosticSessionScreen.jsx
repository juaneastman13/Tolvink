import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { C, R, FONT, MONO, Ic } from "../../theme";
import {
  apiGetDiagnosticSession, apiSendDiagnosticMessage,
  apiResolveDiagnosticSession, apiShareDiagnosticSession,
} from "../../api";

export default function DiagnosticSessionScreen() {
  const location = useLocation();
  // Extract from: /mechanic/machines/:machineId/diagnostics/:sessionId
  const parts = location.pathname.match(/\/mechanic\/machines\/([^/]+)\/diagnostics\/([^/]+)/);
  const machineId = parts?.[1];
  const sessionId = parts?.[2];
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [resolveStatus, setResolveStatus] = useState("resolved");
  const [resolveNotes, setResolveNotes] = useState("");
  const chatEnd = useRef(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setSession(await apiGetDiagnosticSession(sessionId)); }
    catch { setSession(null); }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [session?.messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic user message
    const tempMsg = { id: "temp", role: "user", content: text, mediaUrls: [], timestamp: new Date().toISOString() };
    setSession(prev => ({ ...prev, messages: [...(prev.messages || []), tempMsg] }));

    try {
      const reply = await apiSendDiagnosticMessage(sessionId, { content: text });
      // Refresh full session to get both messages properly saved
      const updated = await apiGetDiagnosticSession(sessionId);
      setSession(updated);
    } catch (e) {
      // Remove temp and show error
      setSession(prev => ({
        ...prev,
        messages: [...(prev.messages || []).filter(m => m.id !== "temp"),
          { id: "err", role: "assistant", content: "Error al procesar tu consulta. Intentá de nuevo.", timestamp: new Date().toISOString() }],
      }));
    }
    setSending(false);
  };

  const handleResolve = async () => {
    try {
      await apiResolveDiagnosticSession(sessionId, { status: resolveStatus, resolutionNotes: resolveNotes || undefined });
      setShowResolve(false);
      fetch();
    } catch (e) { alert(e?.message || "Error"); }
  };

  const handleShare = async () => {
    try {
      const data = await apiShareDiagnosticSession(sessionId);
      setShareUrl(data.shareUrl);
      setShowShare(true);
    } catch (e) { alert(e?.message || "Error al generar link"); }
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const isOpen = session?.status === "open";

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: C.t3, fontSize: 14, fontFamily: FONT }}>Cargando...</div>;
  if (!session) return <div style={{ padding: 60, textAlign: "center", fontFamily: FONT }}>
    <p style={{ color: C.t1, fontWeight: 600 }}>Sesión no encontrada</p>
    <button onClick={() => navigate(`/mechanic/machines/${machineId}`)} style={{ marginTop: 12, border: "none", background: C.pri, color: C.tOn, padding: "8px 20px", borderRadius: R.lg, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Volver</button>
  </div>;

  const messages = (session.messages || []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.b1}`, background: C.bgCard, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => navigate(`/mechanic/machines/${machineId}`)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>{Ic.chev(C.t3, 18)}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.title || "Diagnóstico"}
          </div>
          <div style={{ fontSize: 11.5, color: C.t3 }}>{session.machine?.brand} {session.machine?.model}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {isOpen && <button onClick={() => setShowResolve(true)} style={headerBtn}>Resolver</button>}
          <button onClick={handleShare} style={headerBtn}>Compartir</button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>
            Describí el problema que tiene tu {session.machine?.brand} {session.machine?.model}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id || i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: isMobile ? "85%" : "70%", padding: "10px 14px", borderRadius: R.lg,
              background: msg.role === "user" ? C.pri : C.bgCard,
              color: msg.role === "user" ? C.tOn : C.t1,
              border: msg.role === "assistant" ? `1px solid ${C.b1}` : "none",
              fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.mediaUrls?.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {msg.mediaUrls.map((url, j) => (
                    <img key={j} src={url} alt="" style={{ maxWidth: 180, maxHeight: 180, borderRadius: R.md, objectFit: "cover" }} />
                  ))}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: R.lg, background: C.bgCard, border: `1px solid ${C.b1}`, color: C.t3, fontSize: 13.5 }}>
              Analizando...
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {/* Input bar */}
      {isOpen ? (
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.b1}`, background: C.bgCard, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Describí el problema..."
            rows={1}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: R.lg, border: `1px solid ${C.b1}`,
              background: C.bgInput, fontSize: 14, color: C.t1, fontFamily: FONT, outline: "none",
              resize: "none", maxHeight: 120, minHeight: 40,
            }} />
          <button onClick={handleSend} disabled={!input.trim() || sending} style={{
            width: 40, height: 40, borderRadius: R.full, border: "none",
            background: input.trim() && !sending ? C.pri : C.b1, cursor: input.trim() && !sending ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>{Ic.send(C.tOn, 18)}</button>
        </div>
      ) : (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.b1}`, background: C.bgCardAlt, textAlign: "center", fontSize: 13, color: C.t3 }}>
          Sesión {session.status === "resolved" ? "resuelta" : "cerrada"}
          {session.resolutionNotes && <div style={{ marginTop: 4, fontSize: 12 }}>"{session.resolutionNotes}"</div>}
        </div>
      )}

      {/* Resolve Modal */}
      {showResolve && (
        <div style={{ position: "fixed", inset: 0, background: C.bgOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setShowResolve(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: R.xl, padding: 24, width: "100%", maxWidth: 400, fontFamily: FONT }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 16px" }}>Resolver diagnóstico</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setResolveStatus("resolved")} style={{
                flex: 1, padding: "10px", borderRadius: R.md, border: `2px solid ${resolveStatus === "resolved" ? C.ok : C.b1}`,
                background: resolveStatus === "resolved" ? C.okPale : C.bgCard, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              }}>Se resolvió ✓</button>
              <button onClick={() => setResolveStatus("unresolved")} style={{
                flex: 1, padding: "10px", borderRadius: R.md, border: `2px solid ${resolveStatus === "unresolved" ? C.err : C.b1}`,
                background: resolveStatus === "unresolved" ? C.errPale : C.bgCard, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              }}>No se resolvió</button>
            </div>
            <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="¿Qué lo resolvió? (ayuda a mejorar futuros diagnósticos)" rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgInput, fontSize: 13.5, fontFamily: FONT, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowResolve(false)} style={{ padding: "8px 16px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCard, color: C.t2, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
              <button onClick={handleResolve} style={{ padding: "8px 16px", borderRadius: R.md, border: "none", background: C.pri, color: C.tOn, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShare && (
        <div style={{ position: "fixed", inset: 0, background: C.bgOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setShowShare(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: R.xl, padding: 24, width: "100%", maxWidth: 420, fontFamily: FONT }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 12px" }}>Compartir diagnóstico</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input readOnly value={shareUrl} style={{ flex: 1, padding: "10px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgInput, fontSize: 12.5, fontFamily: MONO, color: C.t1 }} />
              <button onClick={() => { navigator.clipboard.writeText(shareUrl); }} style={{ padding: "10px 14px", borderRadius: R.md, border: "none", background: C.pri, color: C.tOn, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Copiar</button>
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#25D366", fontWeight: 600, textDecoration: "none" }}>
              {Ic.wa("#25D366", 18)} Enviar por WhatsApp
            </a>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 12 }}>Este link vence en 72 horas</div>
            <button onClick={() => setShowShare(false)} style={{ marginTop: 16, width: "100%", padding: "10px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCard, color: C.t2, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const headerBtn = { padding: "6px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCard, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT, color: C.t2 };
