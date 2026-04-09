import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useSSE } from "../hooks";
import { useFreightDetailStore } from "../store";

// ======================== SSE CONTEXT =================================
const SSEContext = createContext(null);
export const useSSEContext = () => useContext(SSEContext);

// ======================== SSE PROVIDER ================================
// Manages SSE connection + all real-time event state (chat, AI, notifications).
// fh/notif/catalog are passed as props since they come from hooks above this provider.
export function SSEProvider({ children, auth, fh, notif, catalog }) {
  // SSE chat events
  const [sseMsg, setSseMsg] = useState(null);
  const [sseTyping, setSseTyping] = useState(null);
  const [sseRead, setSseRead] = useState(null);
  const [unreadChats, setUnreadChats] = useState(0);

  // AI Chat SSE state
  const [sseAiResponse, setSseAiResponse] = useState(null);
  const [sseAiTranscription, setSseAiTranscription] = useState(null);
  const [sseAiChunk, setSseAiChunk] = useState(null);
  const [sseAiThinking, setSseAiThinking] = useState(null);
  const sseAiSeq = useRef(0);
  const sseChunkSeq = useRef(0);
  const sseThinkingSeq = useRef(0);

  // Refs for stable callbacks — avoids stale closures
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  // Notification sound + vibration
  const playNotifSound = useCallback(() => {
    try {
      if (document.hidden) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => ctx.close();
    } catch(e) {}
    try { navigator.vibrate?.([100, 50, 100]); } catch(e) {}
  }, []);

  // Catalog debounce timer ref — cleaned up on unmount to prevent stale setState
  const catalogTimerRef = useRef(null);
  useEffect(() => () => { clearTimeout(catalogTimerRef.current); }, []);

  // SSE connection — real-time sync
  const sse = useSSE(auth.user, {
    onFreightUpdate: (data) => {
      if (!data?.id) return;
      fh.refreshLight(data.id);
      useFreightDetailStore.getState().invalidate(data.id);
    },
    onMessageNew: (data) => {
      if (data.senderId && data.senderId !== auth.user?.id) {
        setUnreadChats(p => p + 1);
      }
      setSseMsg(data);
    },
    onNotification: () => { notif.refresh(); playNotifSound(); },
    onCatalogChanged: () => { clearTimeout(catalogTimerRef.current); catalogTimerRef.current = setTimeout(() => catalogRef.current?.refresh(), 3000); },
    onTyping: (data) => { setSseTyping(data); },
    onRead: (data) => { setSseRead(data); },
    onAiResponse: (data) => { sseAiSeq.current++; setSseAiResponse({ ...data, _seq: sseAiSeq.current }); },
    onAiTranscription: (data) => { setSseAiTranscription({ ...data, _seq: Date.now() }); },
    onAiChunk: (data) => { sseChunkSeq.current++; setSseAiChunk({ ...data, _seq: sseChunkSeq.current }); },
    onAiThinking: () => { sseThinkingSeq.current++; setSseAiThinking({ _seq: sseThinkingSeq.current }); },
  });

  const resetUnreadChats = useCallback(() => setUnreadChats(0), []);

  const value = {
    sse,
    sseMsg, setSseMsg,
    sseTyping, sseRead,
    unreadChats, setUnreadChats, resetUnreadChats,
    sseAiResponse, sseAiTranscription, sseAiChunk, sseAiThinking,
    catalogRef,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
}
