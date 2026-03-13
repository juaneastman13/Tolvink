import { useState, useEffect, useRef } from "react";
import { API_URL, apiGetSseTicket } from "../api";
import log from "../logger";

// ======================== CONSTANTS ==================================
const SSE_INITIAL_RECONNECT_MS = 5000;
const SSE_MAX_RECONNECT_MS = 30000;
const SSE_BACKOFF_FACTOR = 1.5;

// ======================== SSE (Server-Sent Events) ===================
export function useSSE(user, { onFreightUpdate, onMessageNew, onNotification, onCatalogChanged, onTyping, onRead, onAiResponse, onAiTranscription, onAiChunk, onAiThinking }) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(SSE_INITIAL_RECONNECT_MS);
  const failureCount = useRef(0);

  // Keep latest callbacks in refs to avoid stale closures in EventSource handlers
  const cbRefs = useRef({ onFreightUpdate, onMessageNew, onNotification, onCatalogChanged, onTyping, onRead, onAiResponse, onAiTranscription, onAiChunk, onAiThinking });
  cbRefs.current = { onFreightUpdate, onMessageNew, onNotification, onCatalogChanged, onTyping, onRead, onAiResponse, onAiTranscription, onAiChunk, onAiThinking };

  useEffect(() => {
    if (!user) {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setConnected(false);
      failureCount.current = 0;
      return;
    }

    const connectingRef = { current: false };
    const connect = async () => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      try {
      // Safety: close previous EventSource before creating new one
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      // Use short-lived ticket instead of JWT in URL
      let url;
      try {
        const { ticket } = await apiGetSseTicket();
        url = `${API_URL}/sse/stream?ticket=${encodeURIComponent(ticket)}`;
      } catch {
        // Ticket fetch failed — schedule retry with backoff instead of exposing JWT in URL
        reconnectTimer.current = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * SSE_BACKOFF_FACTOR, SSE_MAX_RECONNECT_MS);
        return;
      }
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => {
        setConnected(true);
        failureCount.current = 0; // Reset on successful connection
        log.log('SSE', 'Connected');
      });

      es.addEventListener('freight:updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onFreightUpdate?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('message:new', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onMessageNew?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('notification:new', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onNotification?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('catalog:changed', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onCatalogChanged?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('typing', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onTyping?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('read', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onRead?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('ai:response', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onAiResponse?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('ai:transcription', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onAiTranscription?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('ai:chunk', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onAiChunk?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('ai:thinking', () => {
        cbRefs.current.onAiThinking?.();
      });

      es.onopen = () => {
        reconnectDelay.current = SSE_INITIAL_RECONNECT_MS;
        failureCount.current = 0;
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;

        failureCount.current += 1;
        log.warn('SSE', `Connection failed (${failureCount.current})`);

        // Never stop retrying — cap backoff at 30s so reconnection is fast after deploys
        reconnectTimer.current = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * SSE_BACKOFF_FACTOR, SSE_MAX_RECONNECT_MS);
      };
      } finally { connectingRef.current = false; }
    };

    connect();

    // Recovery: when user returns to tab, reset backoff and reconnect immediately if disconnected
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !esRef.current) {
        log.log('SSE', 'Tab visible — reconnecting');
        failureCount.current = 0;
        reconnectDelay.current = SSE_INITIAL_RECONNECT_MS;
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      setConnected(false);
    };
  }, [user?.id]);

  return { connected };
}
