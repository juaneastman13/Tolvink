// =====================================================================
// TOLVINK — Track Freight Screen (Public, for WhatsApp tracking links)
// Opened via link from WhatsApp bot. No auth required.
// =====================================================================

import { useState, useEffect, useRef } from "react";
import { loadGMaps } from "../maps";
import { API_URL } from "../api";
import log from "../logger";

const COLORS = {
  pri: "#1A6B37", acc: "#FF6A00", bg: "#F7F8F7", w: "#FFFFFF",
  t1: "#18251C", t2: "#4A6352", t3: "#8A9C90",
  b1: "#DEE4E0", b2: "#ECF0ED", err: "#DC2626",
};

const STATUS_CFG = {
  draft: { label: "Borrador", color: "#71717A" },
  pending_assignment: { label: "Sin asignar", color: "#FF6A00" },
  assigned: { label: "Asignado", color: "#0891B2" },
  accepted: { label: "Aceptado", color: "#2563EB" },
  in_progress: { label: "En camino", color: "#FF6A00" },
  loaded: { label: "Cargado", color: "#1A6B37" },
  finished: { label: "Finalizado", color: "#1A6B37" },
  canceled: { label: "Cancelado", color: "#DC2626" },
};

const TRUCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#FF6A00" stroke="#fff" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';

export default function TrackFreightScreen() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const truckMarker = useRef(null);

  const [freight, setFreight] = useState(null);
  const [truckPos, setTruckPos] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // Fetch freight data
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/track/${token}`);
        if (!res.ok) throw new Error("Flete no encontrado");
        setFreight(await res.json());
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  // Initialize map
  useEffect(() => {
    if (!freight || !mapRef.current || !freight.originLat || !freight.destLat) return;
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;

        const origin = { lat: freight.originLat, lng: freight.originLng };
        const dest = { lat: freight.destLat, lng: freight.destLng };

        const map = new maps.Map(mapRef.current, {
          zoom: 7,
          center: { lat: (origin.lat + dest.lat) / 2, lng: (origin.lng + dest.lng) / 2 },
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapInstance.current = map;

        // Origin marker (green)
        new maps.Marker({
          position: origin, map, title: freight.originName || "Origen",
          icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#1A6B37",
                  fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });

        // Destination marker (blue)
        new maps.Marker({
          position: dest, map, title: freight.destName || "Destino",
          icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#003882",
                  fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });

        // Route line
        const isLive = ["in_progress", "loaded"].includes(freight.status);
        const dr = new maps.DirectionsRenderer({
          map, suppressMarkers: true,
          polylineOptions: { strokeColor: isLive ? "#FF6A00" : "#1A6B37", strokeWeight: 4, strokeOpacity: 0.8 },
        });

        new maps.DirectionsService().route(
          { origin, destination: dest, travelMode: maps.TravelMode.DRIVING },
          (result, s) => {
            if (cancelled) return;
            if (s === "OK") {
              dr.setDirections(result);
              const leg = result.routes[0]?.legs[0];
              if (leg) setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text });
            }
          }
        );
      } catch (e) { log.error("TrackFreight", e); }
    })();

    return () => { cancelled = true; };
  }, [freight]);

  // Poll last position every 10s
  useEffect(() => {
    if (!freight || !token || !mapInstance.current) return;
    if (!["in_progress", "loaded"].includes(freight.status)) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/track/${token}/position`);
        if (!res.ok || cancelled) return;
        const pos = await res.json();
        if (!pos || cancelled) return;
        const lat = parseFloat(pos.lat), lng = parseFloat(pos.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        setTruckPos({ lat, lng, speed: pos.speed, updatedAt: pos.createdAt });

        const maps = window.google.maps;
        if (!truckMarker.current) {
          truckMarker.current = new maps.Marker({
            position: { lat, lng }, map: mapInstance.current, title: "Camion",
            icon: { url: "data:image/svg+xml," + encodeURIComponent(TRUCK_SVG),
                    scaledSize: new maps.Size(36, 36), anchor: new maps.Point(18, 18) },
            zIndex: 999,
          });
        } else {
          truckMarker.current.setPosition({ lat, lng });
        }
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [freight, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch freight status every 30s
  useEffect(() => {
    if (!token || !freight || ["finished", "canceled"].includes(freight.status)) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/track/${token}`);
        if (!res.ok || cancelled) return;
        setFreight(await res.json());
      } catch {}
    }, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [token, freight?.status]);

  // === RENDER ===

  if (!token) return (
    <div style={S.center}>
      <div style={S.card}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.t1 }}>Link invalido</div>
        <div style={{ fontSize: 14, color: COLORS.t3, marginTop: 8 }}>
          Este link fue generado desde WhatsApp. Si no funciona, pedi uno nuevo.
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={S.center}>
      <div style={{ fontSize: 14, color: COLORS.t3 }}>Cargando...</div>
    </div>
  );

  if (error) return (
    <div style={S.center}>
      <div style={S.card}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.t1 }}>No encontrado</div>
        <div style={{ fontSize: 14, color: COLORS.t3, marginTop: 8 }}>{error}</div>
      </div>
    </div>
  );

  const sc = STATUS_CFG[freight.status] || { label: freight.status, color: "#999" };
  const isLive = ["in_progress", "loaded"].includes(freight.status);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.bg,
                  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.pri, letterSpacing: -1 }}>tolvink</span>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.acc, display: "inline-block" }} />
        </div>
        <div style={{ fontSize: 12, color: COLORS.t3, fontWeight: 500 }}>Seguimiento en vivo</div>
      </div>

      {/* Freight info */}
      <div style={S.info}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: COLORS.t1 }}>{freight.code}</span>
          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                         background: sc.color + "18", color: sc.color }}>{sc.label}</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.t2, marginTop: 4 }}>
          {freight.grain && <>{freight.grain}{freight.tons ? ` ${freight.tons} tn` : ""} · </>}
          {freight.originName} → {freight.destName}
        </div>
        {routeInfo && (
          <div style={{ fontSize: 11, color: COLORS.t3, marginTop: 2 }}>
            {routeInfo.distance} · {routeInfo.duration} estimado
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {(!freight.originLat || !freight.destLat) ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                        height: "100%", color: COLORS.t3, fontSize: 13 }}>
            Sin coordenadas de ruta
          </div>
        ) : (
          <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
        )}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <div style={{ display: "flex", gap: 12, fontSize: 11, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#1A6B37", display: "inline-block" }} />
            <span style={{ color: COLORS.t2 }}>{freight.originName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#003882", display: "inline-block" }} />
            <span style={{ color: COLORS.t2 }}>{freight.destName}</span>
          </div>
          {isLive && truckPos && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: "#FF6A00",
                             display: "inline-block", animation: "pulse 1.5s infinite" }} />
              <span style={{ color: COLORS.acc, fontWeight: 600, fontSize: 10 }}>
                En vivo{truckPos.speed > 0 ? ` · ${Math.round(parseFloat(truckPos.speed))} km/h` : ""}
              </span>
            </div>
          )}
          {isLive && !truckPos && (
            <div style={{ marginLeft: "auto", fontSize: 10, color: COLORS.t3 }}>Esperando posicion del camion</div>
          )}
          {freight.status === "finished" && (
            <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: COLORS.pri }}>Flete completado</div>
          )}
          {freight.status === "canceled" && (
            <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: COLORS.err }}>Flete cancelado</div>
          )}
          {["accepted", "assigned", "pending_assignment", "draft"].includes(freight.status) && (
            <div style={{ marginLeft: "auto", fontSize: 10, color: COLORS.t3 }}>Esperando inicio del viaje</div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  center: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
            background: COLORS.bg, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif", padding: 24 },
  card: { textAlign: "center", padding: 32, background: COLORS.w, borderRadius: 16,
          maxWidth: 360, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", background: COLORS.w, borderBottom: `1px solid ${COLORS.b2}`, flexShrink: 0 },
  info: { padding: "10px 16px", background: COLORS.w, borderBottom: `1px solid ${COLORS.b2}`, flexShrink: 0 },
  footer: { padding: "10px 16px", paddingBottom: "max(10px, env(safe-area-inset-bottom))",
            background: COLORS.w, borderTop: `1px solid ${COLORS.b2}`, flexShrink: 0 },
};
