// =====================================================================
// TOLVINK — Live Freight Screen (Public, for WhatsApp live location)
// Two modes: share (send GPS) or view (see participants)
// Opened via signed token link from WhatsApp bot. No auth required.
// =====================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { C, R } from "../theme";
import { loadGMaps, mkFieldIcon, mkPlantIcon, mkPinIcon } from "../maps";
import { API_URL } from "../api";
import log from "../logger";

const COLORS = C;

const ROLE_CFG = {
  producer: { label: "Productor", color: COLORS.pri },
  plant: { label: "Planta", color: "#003882" },
  transporter: { label: "Transportista", color: COLORS.acc },
  chofer: { label: "Chofer", color: COLORS.err },
  unknown: { label: "Participante", color: COLORS.muted },
};

const STATUS_LABELS = {
  pending_assignment: "Sin asignar", assigned: "Asignado", accepted: "Asignado",
  in_progress: "En viaje a campo", loaded: "En viaje a planta", finished: "Finalizado", canceled: "Cancelado",
};

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MAX_SHARE_MS = 4 * 60 * 60 * 1000; // 4h
const SEND_INTERVAL_MS = 20000; // 20s
const POLL_INTERVAL_MS = 10000; // 10s
const GPS_TIMEOUT_MS = 12000; // 12s — if no GPS fix, show error

// Detect WhatsApp / Instagram / Facebook in-app browsers
const isInAppBrowser = () => {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat/i.test(ua);
};

export default function LiveFreightScreen() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const infoRef = useRef(null);
  const watchIdRef = useRef(null);
  const sendTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastPosRef = useRef(null);
  const gpsTimeoutRef = useRef(null);
  const gotFirstFixRef = useRef(false);

  const shareStateRef = useRef("idle");
  const stopSharingRef = useRef(null);

  const [freight, setFreight] = useState(null);
  const [locations, setLocations] = useState([]);
  // shareState: "idle" | "activating" | "sharing" | "error"
  const [shareState, setShareState] = useState("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("t");
  const mode = params.get("mode") || "view";
  const isShareMode = mode === "share";

  // Keep refs in sync
  shareStateRef.current = shareState;

  // Fetch live locations
  const fetchLocations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/whatsapp/live-locations?t=${encodeURIComponent(token)}`);
      if (!res.ok) {
        if (res.status === 400) { setError("expired"); return; }
        throw new Error("Error al cargar datos");
      }
      const data = await res.json();
      setFreight(data.freight);
      setLocations(data.locations);
      setError(null);
    } catch (e) {
      if (e.message !== "expired") log.error("LiveFreight fetch", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLocations();
    const iv = setInterval(fetchLocations, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [fetchLocations]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !token) return;
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;

        const map = new maps.Map(mapRef.current, {
          zoom: 7,
          center: { lat: -33.0, lng: -56.0 },
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
        });
        mapInstance.current = map;
        infoRef.current = new maps.InfoWindow();
      } catch (err) {
        log.error("LiveFreight map init", err);
        setError("No se pudo cargar el mapa.");
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  // Update markers for freight origin/dest + participants
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;

    // Track which markers we've seen
    const seen = new Set();

    const bounds = new maps.LatLngBounds();
    let hasPoints = false;

    // Origin marker
    if (freight?.originLat && freight?.originLng) {
      const key = "_origin";
      seen.add(key);
      const pos = { lat: freight.originLat, lng: freight.originLng };
      if (!markersRef.current[key]) {
        markersRef.current[key] = new maps.Marker({
          position: pos,
          map,
          icon: mkFieldIcon(maps, 1.0),
          title: freight.originName || "Origen",
        });
      } else {
        markersRef.current[key].setPosition(pos);
      }
      bounds.extend(pos);
      hasPoints = true;
    }

    // Destination marker
    if (freight?.destLat && freight?.destLng) {
      const key = "_dest";
      seen.add(key);
      const pos = { lat: freight.destLat, lng: freight.destLng };
      if (!markersRef.current[key]) {
        markersRef.current[key] = new maps.Marker({
          position: pos,
          map,
          icon: mkPlantIcon(maps, 1.0),
          title: freight.destName || "Destino",
        });
      } else {
        markersRef.current[key].setPosition(pos);
      }
      bounds.extend(pos);
      hasPoints = true;
    }

    // Participant markers
    locations.forEach(loc => {
      const key = loc.userId;
      seen.add(key);
      const pos = { lat: loc.lat, lng: loc.lng };
      const cfg = ROLE_CFG[loc.userRole] || ROLE_CFG.unknown;

      const ago = Math.round((Date.now() - new Date(loc.updatedAt).getTime()) / 60000);
      const agoText = ago < 1 ? "ahora" : `hace ${ago} min`;

      const buildContent = () =>
        `<div style="font-family:system-ui;font-size:13px;line-height:1.4;max-width:200px">` +
        `<div style="font-weight:700">${esc(loc.userName)}</div>` +
        `<div style="color:${cfg.color};font-size:12px">${esc(cfg.label)}</div>` +
        `<div style="color:#666;font-size:12px;margin-top:4px">${esc(agoText)}</div>` +
        (loc.speed ? `<div style="color:#666;font-size:12px">${loc.speed} km/h</div>` : "") +
        `</div>`;

      if (!markersRef.current[key]) {
        const marker = new maps.Marker({
          position: pos,
          map,
          icon: mkPinIcon(maps, cfg.color, 1.0),
          title: loc.userName,
        });
        marker._iwContent = buildContent;
        marker.addListener("click", () => {
          infoRef.current.setContent(marker._iwContent());
          infoRef.current.open(map, marker);
        });
        markersRef.current[key] = marker;
      } else {
        markersRef.current[key].setPosition(pos);
        markersRef.current[key]._iwContent = buildContent;
      }

      bounds.extend(pos);
      hasPoints = true;
    });

    // Remove stale markers
    Object.keys(markersRef.current).forEach(key => {
      if (!seen.has(key)) {
        markersRef.current[key].setMap(null);
        delete markersRef.current[key];
      }
    });

    if (hasPoints && locations.length > 0) {
      map.fitBounds(bounds, { top: 60, bottom: 80, left: 20, right: 20 });
    }
  }, [freight, locations]);

  // Clean up all GPS resources
  const cleanupGps = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (sendTimerRef.current) { clearInterval(sendTimerRef.current); sendTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (gpsTimeoutRef.current) { clearTimeout(gpsTimeoutRef.current); gpsTimeoutRef.current = null; }
  }, []);

  // GPS sharing logic — state machine: idle → activating → sharing (or error)
  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocalización no disponible en este dispositivo.");
      setShareState("error");
      return;
    }

    gotFirstFixRef.current = false;
    lastPosRef.current = null;
    setGeoError(null);
    setShareState("activating"); // Show "Activando GPS..."

    // Timeout: if no GPS fix within GPS_TIMEOUT_MS, show error with help
    gpsTimeoutRef.current = setTimeout(() => {
      if (!gotFirstFixRef.current) {
        setShareState("error");
        if (isInAppBrowser()) {
          setGeoError("in_app_browser");
        } else {
          setGeoError("No se pudo obtener la ubicación. Verifique que los permisos de ubicación estén activados.");
        }
        cleanupGps();
      }
    }, GPS_TIMEOUT_MS);

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPosRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          heading: pos.coords.heading,
        };

        // First fix: transition to "sharing" state, start send timer + countdown
        if (!gotFirstFixRef.current) {
          gotFirstFixRef.current = true;
          if (gpsTimeoutRef.current) { clearTimeout(gpsTimeoutRef.current); gpsTimeoutRef.current = null; }
          setShareState("sharing");
          setGeoError(null);
          startTimeRef.current = Date.now();

          // Countdown timer
          countdownRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const left = MAX_SHARE_MS - elapsed;
            if (left <= 0) { stopSharingRef.current(); return; }
            setTimeLeft(left);
          }, 10000);

          // Send immediately on first fix
          sendPosition();
          // Then every 20s
          sendTimerRef.current = setInterval(sendPosition, SEND_INTERVAL_MS);
        }
      },
      (err) => {
        log.error("LiveFreight geo error", err);
        // Only handle if we never got a fix (timeout will handle it)
        if (!gotFirstFixRef.current) {
          if (gpsTimeoutRef.current) { clearTimeout(gpsTimeoutRef.current); gpsTimeoutRef.current = null; }
          setShareState("error");
          if (err.code === 1) { // PERMISSION_DENIED
            setGeoError("Permiso de ubicación denegado. Active los permisos en la configuración del navegador.");
          } else if (isInAppBrowser()) {
            setGeoError("in_app_browser");
          } else {
            setGeoError("No se pudo obtener la ubicación. Verifique los permisos de ubicación.");
          }
          cleanupGps();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  }, [token, cleanupGps]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendPosition = async () => {
    const p = lastPosRef.current;
    if (!p) return;
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) return;
    try {
      await fetch(`${API_URL}/whatsapp/live-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t, lat: p.lat, lng: p.lng, speed: p.speed, heading: p.heading }),
      });
    } catch (e) {
      log.error("LiveFreight send", e);
    }
  };

  const stopSharing = useCallback(async () => {
    setShareState("idle");
    setTimeLeft(null);
    gotFirstFixRef.current = false;
    cleanupGps();
    // Notify server
    if (token) {
      try {
        await fetch(`${API_URL}/whatsapp/live-location/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ t: token }),
        });
      } catch (e) {
        log.error("LiveFreight stop", e);
      }
    }
  }, [token, cleanupGps]);
  stopSharingRef.current = stopSharing;

  // Open current URL in system browser (for in-app browser escape)
  const openInBrowser = () => {
    const url = window.location.href;
    // Android: intent:// opens in Chrome/default browser
    // iOS: just try window.open — Safari may catch it
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      // On iOS, try to open in Safari via a workaround
      window.location.href = url;
    } else {
      // On Android, use intent to force system browser
      const intentUrl = `intent:${url}#Intent;end`;
      window.location.href = intentUrl;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    const handleUnload = () => { if (shareStateRef.current === "sharing") stopSharingRef.current(); };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      cleanupGps();
    };
  }, [cleanupGps]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTimeLeft = (ms) => {
    if (!ms) return "";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m restantes` : `${m}m restantes`;
  };

  // No token
  if (!token) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={{ fontSize: 52.8, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 19.8, fontWeight: 700, color: COLORS.t1 }}>Link inválido</div>
          <div style={{ fontSize: 15.4, color: COLORS.t3, marginTop: 8 }}>
            Este link fue generado desde WhatsApp. Solicite uno nuevo en el chat.
          </div>
        </div>
      </div>
    );
  }

  // Token expired
  if (error === "expired") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <div style={{ fontSize: 30.8, marginBottom: 12, opacity: 0.5 }}>⏳</div>
          <div style={{ fontSize: 19.8, fontWeight: 700, color: COLORS.t1 }}>Link expirado</div>
          <div style={{ fontSize: 15.4, color: COLORS.t3, marginTop: 8 }}>
            Solicite un nuevo link en WhatsApp.
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 15.4, color: COLORS.t3 }}>Cargando mapa...</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.bg, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26.4, fontWeight: 800, color: COLORS.pri, letterSpacing: -1 }}>tolvink</span>
          <span style={{ width: 8, height: 8, borderRadius: R.xs, background: COLORS.acc, display: "inline-block" }}></span>
        </div>
        <div style={{ textAlign: "right" }}>
          {freight && (
            <div style={{ fontSize: 14.3, fontWeight: 600, color: COLORS.t1 }}>
              {freight.code} · {STATUS_LABELS[freight.status] || freight.status}
            </div>
          )}
          <div style={{ fontSize: 13.2, color: COLORS.t3 }}>
            {locations.length} participante{locations.length !== 1 ? "s" : ""} en vivo
          </div>
        </div>
      </div>

      {/* Status bar */}
      {isShareMode && (
        <div style={{
          padding: "8px 16px",
          background: shareState === "sharing" ? "#F0FDF4" : shareState === "activating" ? "#FFFBEB" : COLORS.w,
          borderBottom: `1px solid ${COLORS.b2}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          {shareState === "sharing" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: R.sm, background: "#22C55E", display: "inline-block", animation: "pulse 2s infinite" }}></span>
                <span style={{ fontSize: 14.3, fontWeight: 600, color: COLORS.pri }}>Compartiendo ubicación</span>
                {timeLeft && <span style={{ fontSize: 13.2, color: COLORS.t3 }}>{formatTimeLeft(timeLeft)}</span>}
              </div>
              <button onClick={stopSharing} style={styles.stopBtn}>Detener</button>
            </>
          ) : shareState === "activating" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <span style={{ width: 10, height: 10, borderRadius: R.sm, background: "#F59E0B", display: "inline-block", animation: "pulse 1s infinite" }}></span>
              <span style={{ fontSize: 14.3, fontWeight: 600, color: "#92400E" }}>Activando GPS... Permita el acceso a la ubicación</span>
            </div>
          ) : (
            <button onClick={startSharing} style={styles.shareBtn}>Compartir mi ubicación</button>
          )}
        </div>
      )}

      {/* Geo error */}
      {geoError && geoError !== "in_app_browser" && (
        <div style={{ padding: "10px 16px", background: COLORS.errPale, fontSize: 14.3, color: COLORS.err, flexShrink: 0, lineHeight: 1.4 }}>
          {geoError}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setGeoError(null); setShareState("idle"); }} style={styles.retryBtn}>
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* In-app browser error — prominent card with "Open in browser" */}
      {geoError === "in_app_browser" && (
        <div style={{ padding: "16px", background: "#FEF3C7", flexShrink: 0, borderBottom: `1px solid ${COLORS.b1}` }}>
          <div style={{ fontSize: 15.4, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>
            El navegador de WhatsApp no soporta GPS
          </div>
          <div style={{ fontSize: 14.3, color: "#78350F", lineHeight: 1.4, marginBottom: 12 }}>
            Para compartir tu ubicación, abrí este link en el navegador del celular (Chrome, Safari, etc.)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openInBrowser} style={styles.openBrowserBtn}>
              Abrir en navegador
            </button>
            <button onClick={() => { setGeoError(null); setShareState("idle"); }} style={styles.retryBtnSmall}>
              Reintentar
            </button>
          </div>
          <div style={{ fontSize: 12.1, color: "#92400E", marginTop: 8, lineHeight: 1.4 }}>
            También podés copiar el link y pegarlo en el navegador manualmente.
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
        {locations.length === 0 && shareState !== "sharing" && shareState !== "activating" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ background: COLORS.w, padding: "16px 24px", borderRadius: R.lg, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontSize: 15.4, color: COLORS.t3 }}>
              Nadie está compartiendo ubicación
            </div>
          </div>
        )}
      </div>

      {/* Participants list */}
      {locations.length > 0 && (
        <div style={styles.participants}>
          {locations.map(loc => {
            const cfg = ROLE_CFG[loc.userRole] || ROLE_CFG.unknown;
            const ago = Math.round((Date.now() - new Date(loc.updatedAt).getTime()) / 60000);
            const agoText = ago < 1 ? "ahora" : `hace ${ago} min`;
            return (
              <div key={loc.userId} style={styles.participantRow}>
                <div style={{ width: 28, height: 28, borderRadius: R.lg, background: cfg.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.2, fontWeight: 700, flexShrink: 0 }}>
                  {loc.userName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.3, fontWeight: 600, color: COLORS.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.userName}</div>
                  <div style={{ fontSize: 12.1, color: COLORS.t3 }}>{cfg.label} · {agoText}{loc.speed ? ` · ${loc.speed} km/h` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}

const styles = {
  center: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.bg,
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    padding: 24,
  },
  card: {
    textAlign: "center",
    padding: 32,
    background: COLORS.w,
    borderRadius: R.xl,
    maxWidth: 360,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: COLORS.w,
    borderBottom: `1px solid ${COLORS.b2}`,
    flexShrink: 0,
  },
  shareBtn: {
    width: "100%",
    padding: "12px 24px",
    borderRadius: R.md,
    border: "none",
    background: COLORS.pri,
    color: "#fff",
    fontSize: 15.4,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  stopBtn: {
    padding: "6px 16px",
    borderRadius: R.md,
    border: `1.5px solid ${COLORS.err}`,
    background: "transparent",
    color: COLORS.err,
    fontSize: 14.3,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  retryBtn: {
    padding: "8px 20px",
    borderRadius: R.md,
    border: "none",
    background: COLORS.err,
    color: "#fff",
    fontSize: 14.3,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  openBrowserBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: R.md,
    border: "none",
    background: "#92400E",
    color: "#fff",
    fontSize: 15.4,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  retryBtnSmall: {
    padding: "10px 16px",
    borderRadius: R.md,
    border: "1.5px solid #92400E",
    background: "transparent",
    color: "#92400E",
    fontSize: 14.3,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  participants: {
    maxHeight: 120,
    overflowY: "auto",
    background: COLORS.w,
    borderTop: `1px solid ${COLORS.b2}`,
    padding: "8px 12px",
    paddingBottom: "max(8px, env(safe-area-inset-bottom))",
    flexShrink: 0,
  },
  participantRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 0",
  },
};
