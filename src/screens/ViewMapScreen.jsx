// =====================================================================
// TOLVINK — View Map Screen (Public, for WhatsApp location links)
// Opened via link from WhatsApp bot. No auth required.
// Shows one or two markers on a read-only map.
// URL: /ver-mapa?lat=X&lng=Y&n=Name[&dlat=X&dlng=Y&dn=DestName]
// =====================================================================

import { useState, useEffect, useRef } from "react";
import { loadGMaps, mkFieldIcon, mkPlantIcon } from "../maps";

const C = {
  pri: "#1A6B37", acc: "#FF6A00", bg: "#F7F8F7", w: "#FFFFFF",
  t1: "#18251C", t2: "#4A6352", t3: "#8A9C90", b1: "#DEE4E0",
};

export default function ViewMapScreen() {
  const mapRef = useRef(null);
  const [error, setError] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get("lat"));
  const lng = parseFloat(params.get("lng"));
  const name = params.get("n") || "Ubicación";
  const dlat = parseFloat(params.get("dlat"));
  const dlng = parseFloat(params.get("dlng"));
  const dname = params.get("dn") || "Destino";
  const hasDest = !isNaN(dlat) && !isNaN(dlng);

  useEffect(() => {
    if (isNaN(lat) || isNaN(lng)) { setError("Coordenadas inválidas"); return; }
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;

        const origin = { lat, lng };
        const center = hasDest
          ? { lat: (lat + dlat) / 2, lng: (lng + dlng) / 2 }
          : origin;

        const map = new maps.Map(mapRef.current, {
          zoom: hasDest ? 7 : 14,
          center,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });

        // Origin marker
        const originMarker = new maps.Marker({
          position: origin,
          map,
          title: name,
          icon: mkFieldIcon(maps, 1.0),
        });

        const originInfo = new maps.InfoWindow({
          content: `<div style="font-family:system-ui;padding:4px 0">
            <strong style="color:${C.t1}">${esc(name)}</strong>
            <div style="margin-top:4px"><a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener" style="color:${C.pri};text-decoration:none;font-weight:600">▶ Navegar</a></div>
          </div>`,
        });
        originMarker.addListener("click", () => originInfo.open(map, originMarker));
        originInfo.open(map, originMarker);

        // Destination marker (optional)
        if (hasDest) {
          const dest = { lat: dlat, lng: dlng };
          const destMarker = new maps.Marker({
            position: dest,
            map,
            title: dname,
            icon: mkPlantIcon(maps, 1.0),
          });

          const destInfo = new maps.InfoWindow({
            content: `<div style="font-family:system-ui;padding:4px 0">
              <strong style="color:${C.t1}">${esc(dname)}</strong>
              <div style="margin-top:4px"><a href="https://www.google.com/maps/search/?api=1&query=${dlat},${dlng}" target="_blank" rel="noopener" style="color:#2563EB;text-decoration:none;font-weight:600">▶ Navegar</a></div>
            </div>`,
          });
          destMarker.addListener("click", () => destInfo.open(map, destMarker));

          // Draw route
          const ds = new maps.DirectionsService();
          const dr = new maps.DirectionsRenderer({ map, suppressMarkers: true, polylineOptions: { strokeColor: C.acc, strokeWeight: 4, strokeOpacity: 0.8 } });
          ds.route({ origin, destination: dest, travelMode: maps.TravelMode.DRIVING }, (result, status) => {
            if (status === "OK") dr.setDirections(result);
          });

          // Fit bounds
          const bounds = new maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(dest);
          map.fitBounds(bounds, 60);
        }
      } catch (e) {
        setError("No se pudo cargar el mapa");
      }
    })();

    return () => { cancelled = true; };
  }, [lat, lng, dlat, dlng]);

  if (error || isNaN(lat) || isNaN(lng)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center", color: C.t2, padding: 32 }}>
          <div style={{ fontSize: 52.8, marginBottom: 16 }}>📍</div>
          <div style={{ fontSize: 19.8, fontWeight: 600, color: C.t1 }}>{error || "Link inválido"}</div>
          <div style={{ fontSize: 15.4, marginTop: 8 }}>No se pudo mostrar la ubicación.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", fontFamily: "system-ui" }}>
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
        <span style={{ fontSize: 24.2, fontWeight: 800, color: C.pri, letterSpacing: -1 }}>tolvink</span>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.acc, marginTop: -8 }}></span>
        <span style={{ marginLeft: "auto", fontSize: 15.4, color: C.t2, fontWeight: 500, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          📍 {name}{hasDest ? ` → ${dname}` : ""}
        </span>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

      {/* Bottom nav button */}
      <div style={{ position: "absolute", bottom: 24, left: 16, right: 16, zIndex: 10 }}>
        <a
          href={hasDest ? `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${dlat},${dlng}` : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", background: C.pri, color: "#fff", padding: "14px 0", borderRadius: 12, fontSize: 17.6, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 12px rgba(26,107,55,0.3)" }}
        >
          ▶ Navegar al destino
        </a>
      </div>
    </div>
  );
}

function esc(s) { return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
