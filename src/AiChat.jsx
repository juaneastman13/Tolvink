// =====================================================================
// TOLVINK — AI Chat Component (floating panel)
// =====================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { C, FONT, Ic } from "./theme";
import { apiWebChatSend, apiWebChatHistory, apiWebChatAudio } from "./api";

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

  // Cleanup on unmount (#6)
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
      // (#8) Notify user of mic permission error
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

// ======================== MESSAGE BUBBLE ======================

function MsgBubble({ msg }) {
  const isUser = msg.role === "user";
  const isAudio = msg.audioUrl;

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", padding: "2px 0" }}>
      <div style={{
        maxWidth: "82%",
        padding: isAudio ? "6px 10px" : "9px 14px",
        borderRadius: 14,
        background: isUser ? C.pri : C.bgCard,
        color: isUser ? C.tOn : C.t1,
        fontSize: 14, lineHeight: 1.45, fontFamily: FONT,
        boxShadow: isUser ? "none" : C.sh,
        border: isUser ? "none" : `1px solid ${C.b2}`,
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      }}>
        {isAudio ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {MicIcon(isUser ? C.tOn : C.pri, 16)}
            <audio src={msg.audioUrl} controls preload="metadata" style={{
              height: 32, maxWidth: 200,
              filter: isUser ? "invert(1) brightness(2)" : "none",
            }} />
          </div>
        ) : (
          msg.text
        )}
      </div>
    </div>
  );
}

// ======================== BUTTON ROW =========================

function BtnRow({ buttons, onSend, disabled }) {
  if (!buttons?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 0" }}>
      {buttons.map((b) => (
        <button key={b.id} disabled={disabled} onClick={() => onSend(b.title)} style={{
          padding: "6px 14px", borderRadius: 20,
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
const THINKING_TIMEOUT_MS = 90_000; // 90 seconds — matches AI loop hard timeout

// ======================== MAIN COMPONENT =====================

export default function AiChat({ open, onClose, sseAiResponse, sseAiTranscription }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [micError, setMicError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const thinkingTimer = useRef(null);
  const sseCounter = useRef(0); // (#5) monotonic counter for dedup
  const rec = useAudioRecorder(setMicError);

  // (#12) Inject styles once on mount
  useEffect(() => { injectStyles(); }, []);

  // (#3) Thinking timeout — recover if SSE response never arrives
  useEffect(() => {
    if (thinking) {
      clearTimeout(thinkingTimer.current);
      thinkingTimer.current = setTimeout(() => {
        setThinking(false);
        setMessages(prev => [...prev, {
          id: `timeout-${Date.now()}`, role: "assistant",
          text: "La respuesta tardó demasiado. Intentá de nuevo.",
          error: true, ts: Date.now(),
        }]);
      }, THINKING_TIMEOUT_MS);
    } else {
      clearTimeout(thinkingTimer.current);
    }
    return () => clearTimeout(thinkingTimer.current);
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

  // (#5) Handle SSE ai:response — use counter to detect even identical messages
  useEffect(() => {
    if (!sseAiResponse) return;
    sseCounter.current++;
    const seq = sseCounter.current;
    setThinking(false);
    setMessages(prev => [...prev, {
      id: `ai-${seq}-${Date.now()}`,
      role: "assistant",
      text: sseAiResponse.text,
      buttons: sseAiResponse.buttons,
      ts: Date.now(),
    }]);
  }, [sseAiResponse]);

  // Handle SSE ai:transcription (show user what was heard)
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

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  // Focus input on open
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // (#7) Escape key closes chat
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Clear mic error after 4 seconds
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

  const onKey = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
  }, [sendText]);

  // (#9) Only show buttons from the LAST assistant message (not any previous one)
  const lastButtons = useMemo(() => {
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return (last.role === "assistant" && last.buttons?.length) ? last.buttons : null;
  }, [messages]);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", bottom: 88, right: 20, zIndex: 9998,
      width: 380, maxWidth: "calc(100vw - 24px)",
      height: "min(540px, calc(100vh - 120px))",
      background: C.bg, borderRadius: 18, overflow: "hidden",
      boxShadow: C.shLg, border: `1px solid ${C.b1}`,
      display: "flex", flexDirection: "column",
      animation: "aiSlideUp 0.25s ease-out",
      fontFamily: FONT,
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
          background: "none", border: "none", cursor: "pointer", padding: 4,
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
            textAlign: "center", padding: "40px 20px", color: C.t3, fontSize: 13,
          }}>
            <div style={{ marginBottom: 10 }}>{Ic.grain(C.priLt, 36)}</div>
            <div style={{ fontWeight: 600, color: C.t2, marginBottom: 4 }}>
              Hola, soy el asistente de Tolvink
            </div>
            <div>Podés consultar fletes, crear nuevos, ver reportes y mucho más.</div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id}>
            <MsgBubble msg={m} />
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
              background: C.bgCard, borderRadius: 14,
              border: `1px solid ${C.b2}`, boxShadow: C.sh,
            }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Buttons from last assistant message only */}
        {!thinking && lastButtons && (
          <BtnRow buttons={lastButtons} onSend={sendText} disabled={thinking} />
        )}
      </div>

      {/* (#8) Mic error banner */}
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
            background: C.errPale, border: "none", borderRadius: 8,
            padding: "4px 10px", cursor: "pointer", fontSize: 12,
            color: C.err, fontWeight: 600, fontFamily: FONT,
          }}>Descartar</button>
          <button onClick={sendAudio} disabled={thinking} style={{
            background: C.pri, border: "none", borderRadius: 8,
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
            background: C.err, border: "none", borderRadius: 8,
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
              borderRadius: 12, padding: "9px 12px",
              fontSize: 14, fontFamily: FONT, lineHeight: 1.4,
              background: C.bgInput, color: C.t1,
              outline: "none", maxHeight: 100, overflow: "auto",
            }}
            onFocus={e => e.target.style.borderColor = C.bFocus}
            onBlur={e => e.target.style.borderColor = C.b1}
            disabled={thinking}
          />
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
  );
}

// ======================== FLOATING BUTTON ====================

export function AiChatFab({ onClick, open }) {
  return (
    <button
      onClick={onClick}
      aria-label={open ? "Cerrar asistente" : "Abrir asistente IA"}
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 9999,
        width: 56, height: 56, borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.pri}, ${C.priLt})`,
        border: "none", cursor: "pointer",
        boxShadow: `0 4px 16px rgba(26,107,55,0.35)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {open ? Ic.cross(C.tOn, 22) : SparkIcon(C.tOn, 24)}
    </button>
  );
}
