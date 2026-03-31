import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { C, R, FONT, MONO, Ic } from "../../theme";
import {
  apiGetDiagnosticSession, apiSendDiagnosticMessage,
  apiResolveDiagnosticSession, apiShareDiagnosticSession,
  uploadDiagnosticMedia,
} from "../../api";

export default function DiagnosticSessionScreen() {
  const location = useLocation();
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
  const [pendingImages, setPendingImages] = useState([]); // { file, preview }
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const chatEnd = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try { setSession(await apiGetDiagnosticSession(sessionId)); }
    catch { setSession(null); }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [session?.messages, sending]);

  // Cleanup previews on unmount
  useEffect(() => { return () => pendingImages.forEach(p => URL.revokeObjectURL(p.preview)); }, []);

  const addImages = (files) => {
    const newImages = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) { alert("La imagen excede 10MB"); continue; }
      newImages.push({ file, preview: URL.createObjectURL(file) });
    }
    setPendingImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (idx) => {
    setPendingImages(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || sending) return;
    const text = input.trim();
    const images = [...pendingImages];
    setInput("");
    setPendingImages([]);
    setSending(true);
    setUploading(images.length > 0);

    // Optimistic user message
    const tempMsg = {
      id: "temp", role: "user", content: text || (images.length > 0 ? "Analizá esta imagen" : ""),
      mediaUrls: images.map(i => i.preview), timestamp: new Date().toISOString(),
    };
    setSession(prev => ({ ...prev, messages: [...(prev.messages || []), tempMsg] }));

    try {
      // Upload images first
      let mediaUrls = [];
      if (images.length > 0) {
        mediaUrls = await Promise.all(images.map(img => uploadDiagnosticMedia(img.file, sessionId)));
        images.forEach(i => URL.revokeObjectURL(i.preview));
      }
      setUploading(false);

      // Send message with media
      await apiSendDiagnosticMessage(sessionId, {
        content: text || (mediaUrls.length > 0 ? "Analizá esta imagen y diagnosticá el problema." : ""),
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });
      const updated = await apiGetDiagnosticSession(sessionId);
      setSession(updated);
    } catch (e) {
      setSession(prev => ({
        ...prev,
        messages: [...(prev.messages || []).filter(m => m.id !== "temp"),
          { id: "err", role: "assistant", content: e?.message || "Error al procesar tu consulta. Intentá de nuevo.", timestamp: new Date().toISOString() }],
      }));
    }
    setSending(false);
    setUploading(false);
  };

  const handleResolve = async () => {
    try {
      await apiResolveDiagnosticSession(sessionId, { status: resolveStatus, resolutionNotes: resolveNotes || undefined });
      setShowResolve(false);
      fetchSession();
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
  const canSend = (input.trim() || pendingImages.length > 0) && !sending;

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: C.t3, fontSize: 14, fontFamily: FONT }}>Cargando...</div>;
  if (!session) return <div style={{ padding: 60, textAlign: "center", fontFamily: FONT }}>
    <p style={{ color: C.t1, fontWeight: 600 }}>Sesión no encontrada</p>
    <button onClick={() => navigate(`/mechanic/machines/${machineId}`)} style={{ marginTop: 12, border: "none", background: C.pri, color: C.tOn, padding: "8px 20px", borderRadius: R.lg, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Volver</button>
  </div>;

  const messages = (session.messages || []);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontFamily: FONT }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.b1}`, background: C.bgCard, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        <button onClick={() => navigate(`/mechanic/machines/${machineId}`)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>{Ic.chev(C.t3, 18)}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title || "Diagnóstico"}</div>
          <div style={{ fontSize: 11.5, color: C.t3 }}>{session.machine?.brand} {session.machine?.model}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {isOpen && <button onClick={() => setShowResolve(true)} style={headerBtn}>Resolver</button>}
          <button onClick={handleShare} style={headerBtn}>Compartir</button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>
            Describí el problema o enviá una foto
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: msg.content ? 8 : 0 }}>
                  {msg.mediaUrls.map((url, j) => (
                    <img key={j} src={url} alt="" onClick={() => setLightboxUrl(url)}
                      style={{ maxWidth: msg.mediaUrls.length > 1 ? 140 : 220, maxHeight: 200, borderRadius: R.md, objectFit: "cover", cursor: "pointer" }} />
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
              {uploading ? "Subiendo imagen..." : "Analizando..."}
            </div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {/* Input bar */}
      {isOpen ? (
        <div style={{ borderTop: `1px solid ${C.b1}`, background: C.bgCard, flexShrink: 0 }}>
          {/* Pending image previews */}
          {pendingImages.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "10px 16px 0", overflowX: "auto" }}>
              {pendingImages.map((img, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  <img src={img.preview} alt="" style={{ width: 64, height: 64, borderRadius: R.md, objectFit: "cover" }} />
                  <button onClick={() => removeImage(i)} style={{
                    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: R.full,
                    border: "none", background: C.err, color: C.tOn, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", alignItems: "flex-end" }}>
            {/* Attach button */}
            <button onClick={() => fileInputRef.current?.click()} style={{
              width: 40, height: 40, borderRadius: R.full, border: `1px solid ${C.b1}`,
              background: C.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{Ic.cam(C.t2, 20)}</button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
              onChange={e => { if (e.target.files?.length) addImages(Array.from(e.target.files)); e.target.value = ""; }} />
            {/* Camera capture (mobile) */}
            {isMobile && (
              <>
                <button onClick={() => cameraInputRef.current?.click()} style={{
                  width: 40, height: 40, borderRadius: R.full, border: `1px solid ${C.b1}`,
                  background: C.bgCard, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{Ic.img(C.t2, 20)}</button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
                  onChange={e => { if (e.target.files?.length) addImages(Array.from(e.target.files)); e.target.value = ""; }} />
              </>
            )}
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Describí el problema..."
              rows={1}
              style={{
                flex: 1, padding: "10px 12px", borderRadius: R.lg, border: `1px solid ${C.b1}`,
                background: C.bgInput, fontSize: 14, color: C.t1, fontFamily: FONT, outline: "none",
                resize: "none", maxHeight: 120, minHeight: 40,
              }} />
            <button onClick={handleSend} disabled={!canSend} style={{
              width: 40, height: 40, borderRadius: R.full, border: "none",
              background: canSend ? C.pri : C.b1, cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{Ic.send(C.tOn, 18)}</button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.b1}`, background: C.bgCardAlt, textAlign: "center", fontSize: 13, color: C.t3, flexShrink: 0 }}>
          Sesión {session.status === "resolved" ? "resuelta" : "cerrada"}
          {session.resolutionNotes && <div style={{ marginTop: 4, fontSize: 12 }}>"{session.resolutionNotes}"</div>}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{
          position: "fixed", inset: 0, background: C.bgOverlay, display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1100, cursor: "pointer", padding: 16,
        }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: "95%", maxHeight: "90dvh", borderRadius: R.lg, objectFit: "contain" }} />
        </div>
      )}

      {/* Resolve Modal */}
      {showResolve && (
        <div style={{ position: "fixed", inset: 0, background: C.bgOverlay, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={() => setShowResolve(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bgCard, borderRadius: R.xl, padding: 24, width: "100%", maxWidth: 400, fontFamily: FONT }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.t1, margin: "0 0 16px" }}>Resolver diagnóstico</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setResolveStatus("resolved")} style={{ flex: 1, padding: "10px", borderRadius: R.md, border: `2px solid ${resolveStatus === "resolved" ? C.ok : C.b1}`, background: resolveStatus === "resolved" ? C.okPale : C.bgCard, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Se resolvió ✓</button>
              <button onClick={() => setResolveStatus("unresolved")} style={{ flex: 1, padding: "10px", borderRadius: R.md, border: `2px solid ${resolveStatus === "unresolved" ? C.err : C.b1}`, background: resolveStatus === "unresolved" ? C.errPale : C.bgCard, color: C.t1, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>No se resolvió</button>
            </div>
            <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="¿Qué lo resolvió?" rows={3}
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
              <button onClick={() => navigator.clipboard.writeText(shareUrl)} style={{ padding: "10px 14px", borderRadius: R.md, border: "none", background: C.pri, color: C.tOn, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Copiar</button>
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
