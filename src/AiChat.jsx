// =====================================================================
// TOLVINK — AI Chat Component (fullscreen floating panel)
// Embeds maps and location pickers inline when AI returns map URLs
// =====================================================================

import { useState, useEffect, useRef, useCallback, useMemo, memo, lazy, Suspense } from "react";
import { C, FONT, Ic, R } from "./theme";
import { apiWebChatSend, apiWebChatHistory, apiWebChatAudio, apiWebChatFile, uploadChatFile, API_URL } from "./api";

// Lazy-load heavy map components
const MapOverlay = lazy(() => import("./maps").then(m => ({ default: m.MapOverlay })));
const LocPickerFullscreen = lazy(() => import("./maps").then(m => ({ default: m.LocPickerFullscreen })));

// ======================== STATIC STYLES (injected once) ==============
const AI_CHAT_STYLES = `
@keyframes aiDot { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.1)} }
@keyframes aiSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.ai-chat-scroll::-webkit-scrollbar{width:5px}
.ai-chat-scroll::-webkit-scrollbar-thumb{background:${C.b1};border-radius:4px}
.ai-chat-scroll::-webkit-scrollbar-track{background:transparent}
`;
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  const s = document.createElement("style");
  s.textContent = AI_CHAT_STYLES;
  document.head.appendChild(s);
  _stylesInjected = true;
}

// ======================== URL PARSING ===========================
// Detect tolvink map/location URLs in message text and extract params
const FRONTEND_HOST = (import.meta.env.VITE_FRONTEND_URL || "https://tolvink.com").replace(/^https?:\/\//, "");

function parseMapUrls(text) {
  if (!text) return [];
  const results = [];
  // Match URLs — tolvink.com/ver-mapa?..., tolvink.com/ubicacion/..., etc.
  const urlRe = /https?:\/\/[^\s)>\]]+/gi;
  let match;
  urlRe.lastIndex = 0; // Reset stateful regex before use
  while ((match = urlRe.exec(text)) !== null) {
    const url = match[0];
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (!host.includes("tolvink")) continue;

      // /ver-mapa?lat=...&lng=...&n=...
      if (u.pathname === "/ver-mapa") {
        const lat = parseFloat(u.searchParams.get("lat"));
        const lng = parseFloat(u.searchParams.get("lng"));
        const name = u.searchParams.get("n") || "Ubicación";
        const dlat = parseFloat(u.searchParams.get("dlat"));
        const dlng = parseFloat(u.searchParams.get("dlng"));
        const dn = u.searchParams.get("dn") || "";
        if (!isNaN(lat) && !isNaN(lng)) {
          results.push({
            type: "map",
            url,
            lat, lng, name,
            destLat: isNaN(dlat) ? null : dlat,
            destLng: isNaN(dlng) ? null : dlng,
            destName: dn,
          });
        }
      }
      // /ubicacion/{slug}
      else if (u.pathname.startsWith("/ubicacion/")) {
        const slug = u.pathname.split("/ubicacion/")[1]?.replace(/[^a-z0-9-]/g, "");
        if (slug && slug.length >= 3) {
          results.push({ type: "location", url, slug });
        }
      }
    } catch { /* ignore invalid URLs */ }
  }
  return results;
}

// Strip detected URLs from display text (so we don't show the raw link)
function stripUrls(text, parsedUrls) {
  if (!parsedUrls?.length) return text;
  let clean = text;
  for (const p of parsedUrls) {
    clean = clean.replace(p.url, "").replace(/\n{3,}/g, "\n\n");
  }
  return clean.trim();
}

// ======================== ICONS ==============================

const MicIcon = (c = C.w, s = 20) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="1" width="6" height="12" rx="3" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const StopIcon = (c = C.w, s = 20) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);
const SparkIcon = (c = C.w, s = 22) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
    <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" />
  </svg>
);
const MapPinIcon = (c = C.pri, s = 16) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
  </svg>
);
const ClipIcon = (c = C.t3, s = 18) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

// ======================== AUDIO RECORDER HOOK ================

const MIC_ERROR_MSG = "No se pudo acceder al micrófono. Verificá los permisos del navegador.";

function useAudioRecorder(onError) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try { recorderRef.current.stop(); } catch {}
      }
    };
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (!mountedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        clearInterval(timerRef.current);
      };
      recorderRef.current = mr;
      mr.start();
      startRef.current = Date.now();
      setRecording(true);
      setDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);
      timerRef.current = setInterval(() => {
        if (!mountedRef.current) { clearInterval(timerRef.current); return; }
        setDuration(Math.floor((Date.now() - startRef.current) / 1000));
      }, 500);
    } catch {
      onError?.(MIC_ERROR_MSG);
    }
  }, [onError]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  }, []);

  const discard = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  }, [audioUrl]);

  return { recording, audioBlob, audioUrl, duration, start, stop, discard };
}

// ======================== TYPING INDICATOR ===================

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "8px 12px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: C.pri,
          animation: `aiDot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ======================== INLINE MAP VIEW ====================

function InlineMap({ mapData, onClose }) {
  return (
    <div style={{
      borderRadius: R.lg, overflow: "hidden", border: `1.5px solid ${C.b1}`,
      height: 280, margin: "6px 0", position: "relative",
    }}>
      <Suspense fallback={<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.bgCard, color: C.t3, fontSize: 13 }}>Cargando mapa...</div>}>
        <MapOverlay
          lat={mapData.lat} lng={mapData.lng} label={mapData.name}
          destLat={mapData.destLat} destLng={mapData.destLng} destLabel={mapData.destName}
          onClose={onClose}
        />
      </Suspense>
    </div>
  );
}

// ======================== INLINE LOCATION PICKER =============

function InlineLocPicker({ slug, onDone, onClose }) {
  const [loc, setLoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = useCallback(async () => {
    if (!loc?.lat || !loc?.lng || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/whatsapp/save-location-by-slug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, lat: loc.lat, lng: loc.lng, name: loc.address || "", address: loc.address || "" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Error al guardar ubicación");
      }
      setSaved(true);
      onDone?.();
    } catch (e) {
      setError(e.message || "Error al guardar ubicación");
    } finally {
      setSaving(false);
    }
  }, [loc, slug, saving, onDone]);

  if (saved) {
    return (
      <div style={{
        borderRadius: R.lg, overflow: "hidden", border: `1.5px solid ${C.ok}`,
        padding: "16px 20px", margin: "6px 0", background: C.okPale,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ok, marginBottom: 4 }}>
          {Ic.chk(C.ok, 18)} Ubicación guardada
        </div>
        {loc && <div style={{ fontSize: 12, color: C.t3 }}>{loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`}</div>}
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: R.lg, overflow: "hidden", border: `1.5px solid ${C.pri}`,
      height: 340, margin: "6px 0", display: "flex", flexDirection: "column",
    }}>
      <Suspense fallback={<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.bgCard, color: C.t3, fontSize: 13 }}>Cargando mapa...</div>}>
        <LocPickerFullscreen
          value={null}
          onChange={setLoc}
          label="Ubicación"
          onClose={onClose}
          confirmLabel={saving ? "Guardando..." : "Confirmar ubicación"}
          onConfirm={handleConfirm}
        />
      </Suspense>
      {error && <div style={{ padding: "6px 12px", background: C.errPale, color: C.err, fontSize: 12, textAlign: "center" }}>{error}</div>}
    </div>
  );
}

// ======================== MESSAGE BUBBLE ======================

const MsgBubble = memo(function MsgBubble({ msg, onSendText }) {
  const isUser = msg.role === "user";
  const isAudio = msg.audioUrl;
  const parsedUrls = useMemo(() => !isUser ? parseMapUrls(msg.text) : [], [msg.text, isUser]);
  const displayText = useMemo(() => stripUrls(msg.text, parsedUrls), [msg.text, parsedUrls]);
  const [expandedMaps, setExpandedMaps] = useState(() => new Set());
  const [locDone, setLocDone] = useState(new Set());

  const toggleMap = (idx) => setExpandedMaps(prev => {
    const next = new Set(prev);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    return next;
  });

  const handleLocDone = useCallback((idx) => {
    setLocDone(prev => new Set(prev).add(idx));
    // Auto-send "UBICACIÓN LISTA" to continue the AI flow
    onSendText?.("UBICACIÓN LISTA");
  }, [onSendText]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", padding: "2px 0", width: "100%" }}>
      {/* Text bubble */}
      {(displayText || isAudio) && (
        <div style={{
          maxWidth: "85%",
          padding: isAudio ? "6px 10px" : "9px 14px",
          borderRadius: R.lg,
          background: isUser ? C.pri : C.bgCard,
          color: isUser ? C.tOn : C.t1,
          fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
          boxShadow: isUser ? "none" : C.sh,
          border: isUser ? "none" : `1px solid ${C.b2}`,
          wordBreak: "break-word",
          whiteSpace: isUser ? "pre-wrap" : "normal",
        }}>
          {isAudio ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {MicIcon(isUser ? C.tOn : C.pri, 16)}
              <audio src={msg.audioUrl} controls preload="metadata" style={{
                height: 32, maxWidth: 200,
                filter: isUser ? "invert(1) brightness(2)" : "none",
              }} />
            </div>
          ) : (isUser ? displayText : renderMarkdown(displayText, (code) => onSendText?.(`Ver flete ${code}`)))}
        </div>
      )}

      {/* Inline map/location embeds */}
      {parsedUrls.map((pu, idx) => (
        <div key={idx} style={{ width: "100%", maxWidth: "85%" }}>
          {pu.type === "map" && !expandedMaps.has(idx) && (
            <button onClick={() => toggleMap(idx)} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", margin: "4px 0", borderRadius: R.lg,
              border: `1.5px solid ${C.pri}`, background: C.priPale,
              cursor: "pointer", fontFamily: FONT, width: "100%", textAlign: "left",
            }}>
              {MapPinIcon(C.pri, 18)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.pri }}>Ver mapa</div>
                <div style={{ fontSize: 11.5, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pu.name}{pu.destName ? ` → ${pu.destName}` : ""}
                </div>
              </div>
              {Ic.chev(C.pri, 12)}
            </button>
          )}
          {pu.type === "map" && expandedMaps.has(idx) && (
            <InlineMap mapData={pu} onClose={() => toggleMap(idx)} />
          )}

          {pu.type === "location" && !locDone.has(idx) && (
            <InlineLocPicker
              slug={pu.slug}
              onDone={() => handleLocDone(idx)}
              onClose={() => {}}
            />
          )}
          {pu.type === "location" && locDone.has(idx) && (
            <div style={{
              borderRadius: R.lg, overflow: "hidden", border: `1.5px solid ${C.ok}`,
              padding: "12px 16px", margin: "6px 0", background: C.okPale,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {Ic.chk(C.ok, 16)}
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ok }}>Ubicación guardada</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// ======================== BUTTON ROW =========================

function BtnRow({ buttons, onSend, disabled }) {
  if (!buttons?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 0" }}>
      {buttons.map((b) => (
        <button key={b.id} disabled={disabled} onClick={() => onSend(b.title)} style={{
          padding: "6px 14px", borderRadius: R.pill,
          border: `1.5px solid ${C.pri}`, background: C.priPale, color: C.pri,
          fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
        }}>
          {b.title}
        </button>
      ))}
    </div>
  );
}

// ======================== THINKING TIMEOUT ====================
const THINKING_TIMEOUT_MS = 30_000;

// ======================== MAIN COMPONENT =====================

// ======================== SIMPLE MARKDOWN RENDERER ================
// Supports **bold**, bullet lists (- item / • item), ### headers, freight code links, and URLs
const FREIGHT_CODE_RE = /\b(F\d{2}-[A-Z]{3}\.\d{4})\b/g;
const URL_RE = /(https?:\/\/[^\s<>"{}|\\^`\]]+)/g;

function renderPlainSegment(text, keyPrefix, onCodeClick) {
  // First check for freight codes
  if (onCodeClick && FREIGHT_CODE_RE.test(text)) {
    FREIGHT_CODE_RE.lastIndex = 0;
    const segs = text.split(FREIGHT_CODE_RE);
    return segs.map((seg, k) => {
      if (FREIGHT_CODE_RE.test(seg)) {
        FREIGHT_CODE_RE.lastIndex = 0;
        return <span key={`${keyPrefix}-c-${k}`} onClick={() => onCodeClick(seg)} style={{ color: C.pri, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{seg}</span>;
      }
      return seg;
    });
  }
  // Then check for URLs
  if (URL_RE.test(text)) {
    URL_RE.lastIndex = 0;
    const segs = text.split(URL_RE);
    return segs.map((seg, k) => {
      if (URL_RE.test(seg)) {
        URL_RE.lastIndex = 0;
        return <a key={`${keyPrefix}-u-${k}`} href={seg} target="_blank" rel="noopener noreferrer" style={{ color: C.pri, textDecoration: "underline", wordBreak: "break-all" }}>{seg.length > 50 ? seg.slice(0, 47) + "..." : seg}</a>;
      }
      return seg;
    });
  }
  return text;
}

function renderInline(line, keyPrefix, onCodeClick) {
  // Split by bold first, then process each part for codes/URLs
  const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${j}`}>{part.slice(2, -2)}</strong>;
    }
    return renderPlainSegment(part, `${keyPrefix}-${j}`, onCodeClick);
  });
}

// Detect bullet lines: - item, • item, emoji item (🌾 text), or numbered (1. text)
const BULLET_RE = /^[\s]*(?:[-•]|(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?))\s+(.*)/u;
const NUMBERED_RE = /^[\s]*(\d+)[.)]\s+(.*)/;

function renderMarkdown(text, onCodeClick) {
  if (!text) return text;
  const lines = text.split('\n');
  const result = [];
  let listItems = [];
  let listType = null; // 'ul' or 'ol'
  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ol') {
        result.push(
          <ol key={`ol-${result.length}`} style={{ margin: "4px 0", paddingLeft: 22, listStyleType: "decimal" }}>
            {listItems.map((li, k) => <li key={k} style={{ marginBottom: 3 }}>{li}</li>)}
          </ol>
        );
      } else {
        result.push(
          <ul key={`ul-${result.length}`} style={{ margin: "4px 0", paddingLeft: 18, listStyleType: "disc" }}>
            {listItems.map((li, k) => <li key={k} style={{ marginBottom: 3 }}>{li}</li>)}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Numbered list: 1. item or 1) item
    const numMatch = line.match(NUMBERED_RE);
    if (numMatch) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(renderInline(numMatch[2], `li-${i}`, onCodeClick));
      continue;
    }
    // Bullet list: - item, • item, or emoji-prefixed item
    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      const emoji = bulletMatch[1] || '';
      const content = bulletMatch[2] || '';
      listItems.push(<>{emoji ? `${emoji} ` : ''}{renderInline(content, `li-${i}`, onCodeClick)}</>);
      continue;
    }
    if (listItems.length) flushList();
    // Header: ### text
    const headerMatch = line.match(/^#{1,3}\s+(.*)/);
    if (headerMatch) {
      result.push(<strong key={`h-${i}`} style={{ display: "block", marginTop: 6, marginBottom: 2 }}>{renderInline(headerMatch[1], `h-${i}`, onCodeClick)}</strong>);
      continue;
    }
    // Empty line = paragraph break
    if (!line.trim()) {
      if (result.length > 0) result.push(<div key={`sp-${i}`} style={{ height: 6 }} />);
      continue;
    }
    if (result.length > 0) result.push(<br key={`br-${i}`} />);
    result.push(<span key={`l-${i}`}>{renderInline(line, `l-${i}`, onCodeClick)}</span>);
  }
  flushList();
  return result;
}

// ======================== SUGGESTION CHIPS =========================

const SUGGESTIONS = [
  { label: "Mis fletes pendientes", text: "Mis fletes pendientes" },
  { label: "Crear flete", text: "Quiero crear un flete" },
  { label: "Resumen del día", text: "Resumen del día" },
  { label: "Dashboard", text: "¿Cómo van mis fletes?" },
];

function SuggestionChips({ onSend, disabled }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", padding: "8px 0" }}>
      {SUGGESTIONS.map((s) => (
        <button key={s.label} disabled={disabled} onClick={() => onSend(s.text)} style={{
          padding: "7px 14px", borderRadius: R.pill,
          border: `1.5px solid ${C.b1}`, background: C.bgCard, color: C.t2,
          fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
        }}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ======================== MAIN COMPONENT =====================

export default function AiChat({ open, onClose, onNavigate, sseAiResponse, sseAiTranscription, sseAiChunk, sseAiThinking }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [micError, setMicError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const thinkingTimer = useRef(null);
  const sseCounter = useRef(0);
  const rec = useAudioRecorder(setMicError);

  useEffect(() => { injectStyles(); }, []);

  // Thinking timeout — poll history as SSE fallback
  const pollAbort = useRef(null);
  useEffect(() => {
    if (thinking) {
      clearInterval(thinkingTimer.current);
      // AbortController cancels in-flight fetches when thinking stops
      const ac = new AbortController();
      pollAbort.current = ac;
      thinkingTimer.current = setInterval(async () => {
        if (ac.signal.aborted) return;
        try {
          const data = await apiWebChatHistory();
          // Bail if thinking already resolved via SSE while fetch was in-flight
          if (ac.signal.aborted) return;
          if (data?.messages?.length) {
            const lastMsg = data.messages[data.messages.length - 1];
            if (lastMsg?.role === "assistant") {
              setThinking(false);
              streamMsgId.current = null;
              setMessages(data.messages.map(m => ({ ...m, ts: Date.now() })));
              if (data.navigate && onNavigate) {
                onNavigate(data.navigate);
              }
            }
          }
        } catch {}
      }, 5000);
    } else {
      clearInterval(thinkingTimer.current);
      // Abort any in-flight poll so it doesn't overwrite state
      pollAbort.current?.abort();
      pollAbort.current = null;
    }
    return () => { clearInterval(thinkingTimer.current); pollAbort.current?.abort(); };
  }, [thinking]);

  // Load history on first open
  useEffect(() => {
    if (!open || historyLoaded) return;
    apiWebChatHistory().then(data => {
      if (data?.messages?.length) {
        setMessages(data.messages.map(m => ({ ...m, ts: Date.now() })));
      }
      setHistoryLoaded(true);
    }).catch(() => setHistoryLoaded(true));
  }, [open, historyLoaded]);

  // Handle SSE ai:thinking — server confirmed it's processing
  useEffect(() => {
    if (!sseAiThinking) return;
    setThinking(true);
  }, [sseAiThinking]);

  // Handle SSE ai:chunk — streaming
  const streamMsgId = useRef(null);
  useEffect(() => {
    if (!sseAiChunk) return;
    setThinking(false);
    setMessages(prev => {
      if (sseAiChunk.start || !streamMsgId.current) {
        const filtered = streamMsgId.current
          ? prev.filter(m => m.id !== streamMsgId.current)
          : prev;
        const id = `stream-${Date.now()}`;
        streamMsgId.current = id;
        return [...filtered, { id, role: "assistant", text: sseAiChunk.text, streaming: true, ts: Date.now() }];
      }
      return prev.map(m => m.id === streamMsgId.current
        ? { ...m, text: m.text + sseAiChunk.text }
        : m
      );
    });
  }, [sseAiChunk]);

  // Handle SSE ai:response — final
  useEffect(() => {
    if (!sseAiResponse) return;
    sseCounter.current++;
    const seq = sseCounter.current;
    setThinking(false);
    setMessages(prev => {
      const sid = streamMsgId.current;
      streamMsgId.current = null;
      const finalMsg = {
        id: `ai-${seq}-${Date.now()}`,
        role: "assistant",
        text: sseAiResponse.text,
        buttons: sseAiResponse.buttons,
        ts: Date.now(),
      };
      if (sid) {
        return prev.map(m => m.id === sid ? finalMsg : m);
      }
      return [...prev, finalMsg];
    });
    // Handle navigation
    if (sseAiResponse.navigate && onNavigate) {
      onNavigate(sseAiResponse.navigate);
    }
  }, [sseAiResponse, onNavigate]);

  // Handle SSE ai:transcription
  useEffect(() => {
    if (!sseAiTranscription) return;
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "user" && copy[i].audioUrl) {
          copy[i] = { ...copy[i], transcription: sseAiTranscription.text };
          break;
        }
      }
      return copy;
    });
  }, [sseAiTranscription]);

  // Auto-scroll (debounced via requestAnimationFrame to avoid layout thrashing)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, thinking]);

  // Focus input on open
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Escape key closes chat
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Clear mic error
  useEffect(() => {
    if (!micError) return;
    const t = setTimeout(() => setMicError(null), 4000);
    return () => clearTimeout(t);
  }, [micError]);

  const sendText = useCallback((text) => {
    const t = (text || input).trim();
    if (!t || thinking) return;
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", text: t, ts: Date.now() }]);
    setInput("");
    setThinking(true);
    apiWebChatSend(t).catch(() => {
      setThinking(false);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: "assistant",
        text: "Error de conexión. Intentá de nuevo.", ts: Date.now(),
      }]);
    });
  }, [input, thinking]);

  const sendAudio = useCallback(() => {
    if (!rec.audioBlob || thinking) return;
    const url = rec.audioUrl;
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`, role: "user", audioUrl: url,
      text: "", ts: Date.now(),
    }]);
    setThinking(true);
    const blob = rec.audioBlob;
    rec.discard();
    apiWebChatAudio(blob).catch(() => {
      setThinking(false);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: "assistant",
        text: "Error procesando audio. Intentá de nuevo.", ts: Date.now(),
      }]);
    });
  }, [rec, thinking]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const sendFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file || uploading || thinking) return;
    setUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      const docType = isImage ? "photo" : "document";
      // Show preview immediately
      setMessages(prev => [...prev, {
        id: `u-${Date.now()}`, role: "user",
        text: `📎 ${file.name}`,
        ts: Date.now(),
      }]);
      setThinking(true);
      // Upload to Supabase
      const url = await uploadChatFile(file, "ai-chat");
      // Notify backend
      await apiWebChatFile(url, file.name, docType);
    } catch (err) {
      setThinking(false);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: "assistant",
        text: err.message || "Error al subir archivo. Intentá de nuevo.", ts: Date.now(),
      }]);
    } finally {
      setUploading(false);
    }
  }, [uploading, thinking]);

  const onKey = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
  }, [sendText]);

  // Only show buttons from the LAST assistant message
  const lastButtons = useMemo(() => {
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return (last.role === "assistant" && last.buttons?.length) ? last.buttons : null;
  }, [messages]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT,
    }}>
      {/* Panel */}
      <div style={{
        width: "100%", maxWidth: 520, height: "100%", maxHeight: "calc(100dvh - 24px)",
        background: C.bg, borderRadius: R.xl, overflow: "hidden",
        boxShadow: C.shLg, border: `1px solid ${C.b1}`,
        display: "flex", flexDirection: "column",
        animation: "aiSlideUp 0.2s ease-out",
        margin: 12,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", background: C.pri, color: C.tOn,
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "rgba(255,255,255,0.18)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            {Ic.grain(C.tOn, 18)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Asistente Tolvink</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Agente IA</div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
            padding: "6px 8px", borderRadius: R.md,
            display: "flex", alignItems: "center",
          }} aria-label="Cerrar chat">
            {Ic.cross(C.tOn, 18)}
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="ai-chat-scroll" style={{
          flex: 1, overflowY: "auto", padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {messages.length === 0 && !thinking && (
            <div style={{
              textAlign: "center", padding: "48px 20px", color: C.t3, fontSize: 13,
            }}>
              <div style={{ marginBottom: 10 }}>{Ic.grain(C.priLt, 40)}</div>
              <div style={{ fontWeight: 600, color: C.t2, marginBottom: 4, fontSize: 16 }}>
                Hola, soy el asistente de Tolvink
              </div>
              <div style={{ marginBottom: 12 }}>Podés consultar fletes, crear nuevos, ver reportes, ubicaciones y mucho más.</div>
              <SuggestionChips onSend={sendText} disabled={thinking} />
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id}>
              <MsgBubble msg={m} onSendText={sendText} />
              {m.transcription && (
                <div style={{
                  fontSize: 11, color: C.t3, paddingLeft: 4, marginTop: 2,
                  fontStyle: "italic",
                }}>
                  Transcripción: {m.transcription}
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                background: C.bgCard, borderRadius: R.lg,
                border: `1px solid ${C.b2}`, boxShadow: C.sh,
              }}>
                <TypingDots />
              </div>
            </div>
          )}

          {!thinking && lastButtons && (
            <BtnRow buttons={lastButtons} onSend={sendText} disabled={thinking} />
          )}
        </div>

        {/* Mic error banner */}
        {micError && (
          <div style={{
            padding: "6px 14px", background: C.warnPale, borderTop: `1px solid ${C.b2}`,
            fontSize: 12, color: C.warn, fontFamily: FONT, textAlign: "center",
          }}>
            {micError}
          </div>
        )}

        {/* Audio preview */}
        {rec.audioBlob && !rec.recording && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", background: C.priPale, borderTop: `1px solid ${C.b2}`,
          }}>
            <audio src={rec.audioUrl} controls preload="metadata" style={{ height: 32, flex: 1 }} />
            <button onClick={rec.discard} style={{
              background: C.errPale, border: "none", borderRadius: R.md,
              padding: "4px 10px", cursor: "pointer", fontSize: 12,
              color: C.err, fontWeight: 600, fontFamily: FONT,
            }}>Descartar</button>
            <button onClick={sendAudio} disabled={thinking} style={{
              background: C.pri, border: "none", borderRadius: R.md,
              padding: "4px 12px", cursor: "pointer", fontSize: 12,
              color: C.tOn, fontWeight: 600, fontFamily: FONT,
              opacity: thinking ? 0.5 : 1,
            }}>Enviar</button>
          </div>
        )}

        {/* Recording indicator */}
        {rec.recording && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", background: C.errPale, borderTop: `1px solid ${C.b2}`,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%", background: C.err,
              animation: "aiDot 1s infinite",
            }} />
            <span style={{ fontSize: 13, color: C.err, fontWeight: 600, fontFamily: FONT, flex: 1 }}>
              Grabando... {rec.duration}s
            </span>
            <button onClick={rec.stop} style={{
              background: C.err, border: "none", borderRadius: R.md,
              padding: "6px 12px", cursor: "pointer", display: "flex",
              alignItems: "center", gap: 4,
            }}>
              {StopIcon(C.tOn, 14)}
              <span style={{ color: C.tOn, fontSize: 12, fontWeight: 600, fontFamily: FONT }}>Detener</span>
            </button>
          </div>
        )}

        {/* Input bar */}
        {!rec.recording && !rec.audioBlob && (
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            padding: "10px 12px", borderTop: `1px solid ${C.b2}`,
            background: C.bgCard,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Escribí tu mensaje..."
              rows={1}
              style={{
                flex: 1, resize: "none", border: `1.5px solid ${C.b1}`,
                borderRadius: R.lg, padding: "9px 12px",
                fontSize: 14, fontFamily: FONT, lineHeight: 1.4,
                background: C.bgInput, color: C.t1,
                outline: "none", maxHeight: 100, overflow: "auto",
              }}
              onFocus={e => e.target.style.borderColor = C.bFocus}
              onBlur={e => e.target.style.borderColor = C.b1}
              disabled={thinking}
            />
            {/* File attach button */}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx" style={{ display: "none" }} onChange={sendFile} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={thinking || uploading}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "transparent", border: "none", cursor: thinking ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: thinking ? 0.4 : 0.7, flexShrink: 0,
                transition: "all 0.15s",
              }}
              aria-label="Adjuntar archivo"
            >
              {ClipIcon(C.t3, 18)}
            </button>
            {/* Mic button */}
            <button
              onClick={rec.start}
              disabled={thinking}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: C.muted, border: "none", cursor: thinking ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: thinking ? 0.4 : 0.8, flexShrink: 0,
                transition: "all 0.15s",
              }}
              aria-label="Grabar audio"
            >
              {MicIcon(C.tOn, 18)}
            </button>
            {/* Send button */}
            <button
              onClick={() => sendText()}
              disabled={!input.trim() || thinking}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: input.trim() && !thinking ? C.pri : C.b1,
                border: "none", cursor: input.trim() && !thinking ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.15s",
              }}
              aria-label="Enviar mensaje"
            >
              {Ic.send(input.trim() && !thinking ? C.tOn : C.muted, 16)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ======================== FLOATING BUTTON ====================

const FAB_ICONS = [
  (s) => Ic.plant(C.tOn, s),
  (s) => Ic.seedling(C.tOn, s),
  (s) => Ic.truck(C.tOn, s),
];
const FAB_CYCLE_MS = 2500;

export function AiChatFab({ onClick, open }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (open) return;
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx(p => (p + 1) % FAB_ICONS.length);
        setFading(false);
      }, 200);
    }, FAB_CYCLE_MS);
    return () => clearInterval(timer);
  }, [open]);

  return (
    <button
      onClick={onClick}
      aria-label={open ? "Cerrar asistente" : "Abrir asistente IA"}
      style={{
        position: "fixed", bottom: 80, right: 16, zIndex: 9999,
        width: window.innerWidth < 768 ? 40 : 56, height: window.innerWidth < 768 ? 40 : 56, borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.pri}, ${C.priLt})`,
        border: "none", cursor: "pointer",
        boxShadow: `0 4px 16px rgba(26,107,55,0.35)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {open ? Ic.cross(C.tOn, window.innerWidth < 768 ? 16 : 22) : (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: fading ? 0 : 1,
          transform: fading ? "scale(0.7)" : "scale(1)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}>
          {FAB_ICONS[idx](window.innerWidth < 768 ? 18 : 24)}
        </div>
      )}
    </button>
  );
}
