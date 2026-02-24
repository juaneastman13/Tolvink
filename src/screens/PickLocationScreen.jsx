// =====================================================================
// TOLVINK — Pick Location Screen (Public, for WhatsApp map picker)
// Opened via link from WhatsApp bot. No auth required.
// =====================================================================

import { useState, useEffect, useRef } from "react";
import { loadGMaps } from "../maps";
import { API_URL } from "../api";
import log from "../logger";

const URUGUAY_CENTER = { lat: -33.0, lng: -56.0 };

const COLORS = {
  pri: "#1A6B37",
  priLt: "#228B46",
  acc: "#FF6A00",
  bg: "#F7F8F7",
  w: "#FFFFFF",
  t1: "#18251C",
  t2: "#4A6352",
  t3: "#8A9C90",
  b1: "#DEE4E0",
  b2: "#ECF0ED",
  err: "#DC2626",
  errPale: "#FEE2E2",
};

export default function PickLocationScreen() {
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // Extract token from URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

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

        const marker = new maps.Marker({
          position: URUGUAY_CENTER,
          map,
          draggable: true,
        });
        markerRef.current = marker;

        if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();

        const geocodeAndUpdate = (lat, lng) => {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            const a = status === "OK" && results[0] ? results[0].formatted_address : "";
            setAddress(a);
            setLocation({ lat, lng });
          });
        };

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          geocodeAndUpdate(pos.lat(), pos.lng());
        });

        map.addListener("click", (e) => {
          marker.setPosition(e.latLng);
          geocodeAndUpdate(e.latLng.lat(), e.latLng.lng());
        });

        // Autocomplete search
        if (searchRef.current) {
          const autocomplete = new maps.places.Autocomplete(searchRef.current, {
            componentRestrictions: { country: ["ar", "uy", "br", "py"] },
            fields: ["geometry", "formatted_address", "name"],
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const a = place.formatted_address || place.name || "";
              map.setCenter({ lat, lng });
              map.setZoom(14);
              marker.setPosition({ lat, lng });
              setAddress(a);
              setLocation({ lat, lng });
            }
          });
        }

        // Try to use device GPS
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              map.setCenter({ lat, lng });
              map.setZoom(13);
              marker.setPosition({ lat, lng });
              geocodeAndUpdate(lat, lng);
            },
            () => {}, // Ignore errors — user can still pick manually
            { enableHighAccuracy: true, timeout: 5000 }
          );
        }
      } catch (err) {
        log.error("PickLocation", err);
        setError("No se pudo cargar el mapa. Recarga la pagina.");
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const handleConfirm = async () => {
    if (!location || !token) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/whatsapp/save-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          lat: location.lat,
          lng: location.lng,
          name: address.split(",")[0] || "",
          address: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Error al guardar");
      }

      setDone(true);
    } catch (e) {
      setError(e.message || "Error al guardar la ubicacion");
    } finally {
      setSaving(false);
    }
  };

  // No token
  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.t1 }}>Link invalido</div>
          <div style={{ fontSize: 14, color: COLORS.t3, marginTop: 8 }}>
            Este link fue generado desde WhatsApp. Si expiro, pedi uno nuevo en el chat.
          </div>
        </div>
      </div>
    );
  }

  // Done
  if (done) {
    return (
      <div style={styles.container}>
        <div style={styles.successBox}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.pri }}>Ubicacion guardada</div>
          <div style={{ fontSize: 14, color: COLORS.t2, marginTop: 8, lineHeight: 1.5 }}>
            Volve a WhatsApp y decile al asistente que ya elegiste la ubicacion.
          </div>
          {address && (
            <div style={{ fontSize: 12, color: COLORS.t3, marginTop: 12, padding: "8px 12px", background: COLORS.bg, borderRadius: 8 }}>
              📍 {address}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.bg, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.pri, letterSpacing: -1 }}>tolvink</span>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.acc, display: "inline-block" }}></span>
        </div>
        <div style={{ fontSize: 13, color: COLORS.t3, fontWeight: 500 }}>Elegir ubicacion</div>
      </div>

      {/* Search bar */}
      <div style={styles.searchBar}>
        <input
          ref={searchRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Buscar direccion o lugar..."
          style={styles.searchInput}
        />
      </div>

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        {error && (
          <div style={{ padding: "8px 12px", background: COLORS.errPale, borderRadius: 8, fontSize: 12, color: COLORS.err, marginBottom: 8, textAlign: "center" }}>
            {error}
          </div>
        )}
        {location && (
          <div style={{ fontSize: 11, color: COLORS.t3, textAlign: "center", marginBottom: 8 }}>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!location || saving}
          style={{
            ...styles.confirmBtn,
            opacity: !location || saving ? 0.5 : 1,
            cursor: !location || saving ? "default" : "pointer",
          }}
        >
          {saving ? "Guardando..." : "Confirmar ubicacion"}
        </button>
        {!location && (
          <div style={{ fontSize: 12, color: COLORS.t3, textAlign: "center", marginTop: 8 }}>
            Busca una direccion o toca el mapa para marcar la ubicacion
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.bg,
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
    padding: 24,
  },
  errorBox: {
    textAlign: "center",
    padding: 32,
    background: COLORS.w,
    borderRadius: 16,
    maxWidth: 360,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  successBox: {
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
  searchBar: {
    padding: "8px 12px",
    background: COLORS.w,
    borderBottom: `1px solid ${COLORS.b2}`,
    flexShrink: 0,
  },
  searchInput: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1.5px solid ${COLORS.b1}`,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    color: COLORS.t1,
    background: COLORS.bg,
    boxSizing: "border-box",
  },
  footer: {
    padding: "12px 16px",
    paddingBottom: "max(12px, env(safe-area-inset-bottom))",
    background: COLORS.w,
    borderTop: `1px solid ${COLORS.b2}`,
    flexShrink: 0,
  },
  confirmBtn: {
    width: "100%",
    padding: "14px 24px",
    borderRadius: 12,
    border: "none",
    background: COLORS.pri,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "inherit",
    letterSpacing: -0.3,
  },
};
