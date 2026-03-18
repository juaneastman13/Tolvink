// =====================================================================
// TOLVINK — Daily Map Screen (Public, for WhatsApp daily freight map)
// Opened via signed token link from WhatsApp bot. No auth required.
// =====================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { loadGMaps, mkPinIcon } from "../maps";
import { API_URL } from "../api";
import log from "../logger";

const COLORS = {
  pri: "#1A6B37", acc: "#FF6A00", bg: "#F7F8F7", w: "#FFFFFF",
  t1: "#18251C", t2: "#4A6352", t3: "#8A9C90",
  b1: "#DEE4E0", b2: "#ECF0ED", err: "#DC2626",
};

const STATUS_CFG = {
  pending_assignment: { label: "Sin asignar", color: "#FF6A00" },
  assigned: { label: "Asignado", color: "#2196F3" },
  accepted: { label: "Asignado", color: "#2196F3" },
  in_progress: { label: "A campo", color: "#43A047" },
  loaded: { label: "A planta", color: "#1A6B37" },
  finished: { label: "Finalizado", color: "#9E9E9E" },
  canceled: { label: "Cancelado", color: "#E53935" },
};

const URUGUAY_CENTER = { lat: -33.0, lng: -56.0 };

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export default function DailyMapScreen() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const infoRef = useRef(null);

  const [freights, setFreights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});

  const params = new URLSearchParams(window.location.search);
  const token = params.get("t");

  // Fetch freight data
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/whatsapp/daily-map-data?t=${encodeURIComponent(token)}`);
      if (!res.ok) {
        if (res.status === 400) throw new Error("expired");
        throw new Error("Error al cargar datos");
      }
      const data = await res.json();
      setFreights(data);
      setError(null);
    } catch (e) {
      if (e.message === "expired") setError("expired");
      else { log.error("DailyMap fetch", e); setError("Error al cargar datos"); }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

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
          center: URUGUAY_CENTER,
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
        log.error("DailyMap init", err);
        setError("No se pudo cargar el mapa.");
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  // Update markers when data or filters change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasPoints = false;

    const activeStatuses = Object.keys(filters).length > 0
      ? Object.keys(filters).filter(k => filters[k])
      : null; // null = show all

    freights.forEach(f => {
      if (activeStatuses && !activeStatuses.includes(f.status)) return;
      const cfg = STATUS_CFG[f.status] || { label: f.status, color: "#71717A" };

      // Origin marker
      if (f.originLat && f.originLng) {
        const pos = { lat: f.originLat, lng: f.originLng };
        const marker = new maps.Marker({
          position: pos,
          map,
          icon: mkPinIcon(maps, cfg.color, 1.0),
          title: `${f.code} — ${cfg.label}`,
        });

        marker.addListener("click", () => {
          const content = `<div style="font-family:system-ui;font-size:13px;max-width:240px;line-height:1.4">` +
            `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${esc(f.code)}</div>` +
            `<div style="display:inline-block;padding:2px 8px;border-radius:10px;background:${cfg.color};color:#fff;font-size:11px;font-weight:600;margin-bottom:6px">${esc(cfg.label)}</div>` +
            (f.grain ? `<div style="margin-top:4px">${esc(f.grain)}${f.tons ? ` · ${f.tons} ton` : ""}</div>` : "") +
            `<div style="color:#666;font-size:12px;margin-top:4px">${esc(f.originName || "Origen")} → ${esc(f.destName || "Destino")}</div>` +
            (f.transporterName ? `<div style="color:#666;font-size:12px;margin-top:2px">${esc(f.transporterName)}${f.plate ? ` · ${esc(f.plate)}` : ""}</div>` : "") +
            `</div>`;
          infoRef.current.setContent(content);
          infoRef.current.open(map, marker);
        });

        markersRef.current.push(marker);
        bounds.extend(pos);
        hasPoints = true;
      }

      // Destination marker (smaller)
      if (f.destLat && f.destLng) {
        const pos = { lat: f.destLat, lng: f.destLng };
        const marker = new maps.Marker({
          position: pos,
          map,
          icon: mkPinIcon(maps, cfg.color, 0.7),
          title: `${f.code} destino`,
        });
        markersRef.current.push(marker);
        bounds.extend(pos);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { top: 60, bottom: 20, left: 20, right: 20 });
    }
  }, [freights, filters]);

  const toggleFilter = (status) => {
    setFilters(prev => {
      const next = { ...prev };
      if (next[status]) delete next[status];
      else next[status] = true;
      return next;
    });
  };

  // Count by status
  const statusCounts = {};
  freights.forEach(f => { statusCounts[f.status] = (statusCounts[f.status] || 0) + 1; });

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
            Solicite un nuevo link en WhatsApp para ver el mapa del día.
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

  const activeFilters = Object.keys(filters).filter(k => filters[k]);
  const visibleCount = activeFilters.length > 0
    ? freights.filter(f => activeFilters.includes(f.status)).length
    : freights.length;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.bg, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26.4, fontWeight: 800, color: COLORS.pri, letterSpacing: -1 }}>tolvink</span>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.acc, display: "inline-block" }}></span>
        </div>
        <div style={{ fontSize: 14.3, color: COLORS.t3, fontWeight: 500 }}>
          Mapa del día · {visibleCount} flete{visibleCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filter chips */}
      <div style={styles.filterBar}>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          const active = filters[key];
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              style={{
                ...styles.chip,
                background: active ? cfg.color : COLORS.w,
                color: active ? "#fff" : COLORS.t2,
                borderColor: active ? cfg.color : COLORS.b1,
              }}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
        {freights.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ background: COLORS.w, padding: "16px 24px", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontSize: 15.4, color: COLORS.t3 }}>
              No hay fletes programados para hoy
            </div>
          </div>
        )}
      </div>
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
    borderRadius: 16,
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
  filterBar: {
    display: "flex",
    gap: 6,
    padding: "8px 12px",
    overflowX: "auto",
    background: COLORS.w,
    borderBottom: `1px solid ${COLORS.b2}`,
    flexShrink: 0,
  },
  chip: {
    padding: "5px 10px",
    borderRadius: 16,
    border: "1.5px solid",
    fontSize: 13.2,
    fontWeight: 600,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "all 0.15s",
  },
};
