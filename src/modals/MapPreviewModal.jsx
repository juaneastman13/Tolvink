import { useEffect, useRef } from "react";
import { C, Ic } from "../theme";
import { ModalOverlay } from "../components";
import { loadGMaps } from "../maps";

export default function MapPreviewModal({ loc, onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!loc || !mapRef.current) return;
    let cancelled = false;
    loadGMaps().then((maps) => {
      if (cancelled || !mapRef.current) return;
      const center = { lat: Number(loc.lat), lng: Number(loc.lng) };
      const map = new maps.Map(mapRef.current, {
        center,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: { style: maps.MapTypeControlStyle.DROPDOWN_MENU },
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "simplified" }] },
        ],
      });
      new maps.Marker({
        position: center,
        map,
        title: loc.name || "Ubicación",
      });
      mapInstance.current = map;
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current = null;
      }
    };
  }, [loc]);

  if (!loc) return null;

  return (
    <ModalOverlay onClose={onClose} maxWidth={480} quick>
      <div style={{ padding: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: C.t1, marginBottom: 4 }}>
              {Ic.pin(C.pri, 18)} {loc.name || "Ubicación"}
            </div>
            {loc.address && (
              <div style={{ fontSize: 12.7, color: C.t3, lineHeight: 1.4 }}>{loc.address}</div>
            )}
            <div style={{ fontSize: 11.5, color: C.ok, fontWeight: 700, marginTop: 4 }}>
              {Number(loc.lat).toFixed(6)}, {Number(loc.lng).toFixed(6)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
            {Ic.cross(C.t3, 18)}
          </button>
        </div>

        {/* Map container */}
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: 280,
            borderRadius: 12,
            border: `1px solid ${C.b1}`,
            background: C.bgInput,
            overflow: "hidden",
          }}
        />

        {/* Open in Google Maps link */}
        <a
          href={`https://www.google.com/maps?q=${Number(loc.lat)},${Number(loc.lng)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 12,
            padding: "10px 16px",
            borderRadius: 10,
            border: `1.5px solid ${C.b1}`,
            background: C.w,
            color: C.pri,
            fontSize: 13.2,
            fontWeight: 700,
            fontFamily: "inherit",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          {Ic.nav(C.pri, 14)} Abrir en Google Maps
        </a>
      </div>
    </ModalOverlay>
  );
}
