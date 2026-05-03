// =====================================================================
// TOLVINK — Public Freight Map Picker
// Anonymous, freight-bound. Renders the same Google Maps wrapper as the app.
// Anyone with a valid token can pin one or more typed locations until expiry.
// =====================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { loadGMaps } from "../maps";
import { API_URL } from "../api";
import { R } from "../theme";
import log from "../logger";

const FALLBACK_CENTER = { lat: -33.0, lng: -56.0 };

const TYPE_LABELS = {
  ORIGIN: "Origen",
  DESTINATION: "Destino",
  POINT_OF_INTEREST: "Punto de interés",
  LOAD_LOCATION: "Carga",
  UNLOAD_LOCATION: "Descarga",
  OPERATIONAL_REFERENCE: "Referencia",
  OTHER: "Otro",
};

const TYPE_COLORS = {
  ORIGIN: "#1A6B37",
  DESTINATION: "#A33A2B",
  POINT_OF_INTEREST: "#7257A8",
  LOAD_LOCATION: "#B86E12",
  UNLOAD_LOCATION: "#2563A9",
  OPERATIONAL_REFERENCE: "#45524A",
  OTHER: "#6B7280",
};

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
  okPale: "#E8F3EC",
};

export default function PublicFreightMapScreen({ token: tokenProp } = {}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const draftMarker = useRef(null);
  const savedMarkers = useRef([]);
  const geocoder = useRef(null);
  const searchRef = useRef(null);

  const [token] = useState(tokenProp || extractTokenFromUrl());
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftAddress, setDraftAddress] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [selectedType, setSelectedType] = useState("ORIGIN");
  const [inputMethod, setInputMethod] = useState("PIN_MANUAL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);

  const allowedTypes = data?.permissions?.allowedTypes || ["ORIGIN", "DESTINATION", "POINT_OF_INTEREST"];
  // Detect existing origin/destination so we can warn the user that saving will replace them.
  // Sources: freight base columns (originLat/destLat) + most recent ACTIVE FreightLocation row.
  const existingByType = (() => {
    const byType = {};
    if (data?.freight?.origin) byType.ORIGIN = data.freight.origin;
    if (data?.freight?.destination) byType.DESTINATION = data.freight.destination;
    (data?.locations || []).forEach((loc) => {
      if (loc.status === "ACTIVE" && (loc.type === "ORIGIN" || loc.type === "DESTINATION")) {
        byType[loc.type] = loc;
      }
    });
    return byType;
  })();
  const willReplace = !!existingByType[selectedType] && (selectedType === "ORIGIN" || selectedType === "DESTINATION");

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/freight-map-public/${encodeURIComponent(token)}/data`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "El enlace no es válido o expiró");
      }
      const payload = await res.json();
      setData(payload);
      const types = payload?.permissions?.allowedTypes || ["ORIGIN", "DESTINATION", "POINT_OF_INTEREST"];
      setSelectedType((current) => (types.includes(current) ? current : types[0]));
      return payload;
    } catch (e) {
      setError(e.message || "No se pudo abrir el mapa");
      return null;
    }
  }, [token]);

  // initial fetch
  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token, loadData]);

  // map init
  useEffect(() => {
    if (!mapRef.current || !data) return;
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;

        const start = pickInitialCenter(data) || FALLBACK_CENTER;
        const map = new maps.Map(mapRef.current, {
          zoom: pickInitialZoom(data),
          center: start,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapInstance.current = map;
        if (!geocoder.current) geocoder.current = new maps.Geocoder();
        setMapLoading(false);

        // draft marker
        const dm = new maps.Marker({
          position: start,
          map,
          draggable: true,
          icon: buildPinIcon(maps, TYPE_COLORS[selectedType] || COLORS.pri),
        });
        draftMarker.current = dm;
        setDraft({ lat: start.lat, lng: start.lng });

        const handleDraft = (lat, lng, method) => {
          setDraft({ lat, lng });
          setInputMethod(method || "PIN_MANUAL");
          if (geocoder.current) {
            geocoder.current.geocode({ location: { lat, lng } }, (results, status) => {
              if (status === "OK" && results?.[0]) setDraftAddress(results[0].formatted_address);
            });
          }
        };

        dm.addListener("dragend", () => {
          const p = dm.getPosition();
          handleDraft(p.lat(), p.lng(), "PIN_MANUAL");
        });
        map.addListener("click", (e) => {
          dm.setPosition(e.latLng);
          handleDraft(e.latLng.lat(), e.latLng.lng(), "PIN_MANUAL");
        });

        // Places autocomplete
        if (searchRef.current && maps.places) {
          const autocomplete = new maps.places.Autocomplete(searchRef.current, {
            componentRestrictions: { country: ["uy", "ar", "br", "py"] },
            fields: ["geometry", "formatted_address", "name"],
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) return;
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            map.setCenter({ lat, lng });
            map.setZoom(15);
            dm.setPosition({ lat, lng });
            setDraftAddress(place.formatted_address || place.name || "");
            if (!draftLabel) setDraftLabel(place.name || "");
            setDraft({ lat, lng });
            setInputMethod("SEARCH");
          });
        }

        renderSavedMarkers(maps, map, data);
      } catch (e) {
        log.error("PublicFreightMap", e);
        setMapLoading(false);
        setError("No se pudo cargar el mapa. Recargá la página.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.freight?.id]);

  // refresh saved markers when data changes
  useEffect(() => {
    if (!mapInstance.current || !data || !window.google?.maps) return;
    renderSavedMarkers(window.google.maps, mapInstance.current, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.locations]);

  // update draft pin color when type changes
  useEffect(() => {
    if (!draftMarker.current || !window.google?.maps) return;
    draftMarker.current.setIcon(buildPinIcon(window.google.maps, TYPE_COLORS[selectedType] || COLORS.pri));
  }, [selectedType]);

  const renderSavedMarkers = (maps, map, payload) => {
    savedMarkers.current.forEach((m) => m.setMap(null));
    savedMarkers.current = [];
    const all = [
      ...(payload.freight.origin ? [{ ...payload.freight.origin, label: payload.freight.origin.label || "Origen" }] : []),
      ...(payload.freight.destination ? [{ ...payload.freight.destination, label: payload.freight.destination.label || "Destino" }] : []),
      ...(payload.locations || []),
    ];
    all.forEach((loc) => {
      const color = TYPE_COLORS[loc.type] || COLORS.pri;
      const m = new maps.Marker({
        position: { lat: Number(loc.lat), lng: Number(loc.lng) },
        map,
        icon: buildPinIcon(maps, color),
        title: `${TYPE_LABELS[loc.type] || loc.type}${loc.label ? ` — ${loc.label}` : ""}`,
        zIndex: 5,
      });
      savedMarkers.current.push(m);
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no permite obtener la ubicación actual.");
      return;
    }
    setInfo("Obteniendo ubicación actual...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapInstance.current) {
          mapInstance.current.setCenter({ lat, lng });
          mapInstance.current.setZoom(16);
        }
        if (draftMarker.current) draftMarker.current.setPosition({ lat, lng });
        setDraft({ lat, lng });
        setInputMethod("BROWSER_CURRENT");
        setInfo("Ubicación actual cargada. Confirmá antes de guardar.");
        if (geocoder.current) {
          geocoder.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results?.[0]) setDraftAddress(results[0].formatted_address);
          });
        }
      },
      () => setError("No se pudo obtener la ubicación. Marcá el punto manualmente."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const submit = async () => {
    if (!draft || saving) return;
    if (willReplace) {
      const ok = window.confirm(`Vas a reemplazar el ${TYPE_LABELS[selectedType].toLowerCase()} cargado en este flete. ¿Confirmás?`);
      if (!ok) return;
    }
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const payload = {
        type: selectedType,
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        label: (draftLabel || "").trim() || undefined,
        address: (draftAddress || "").trim() || undefined,
        inputMethod,
      };
      const res = await fetch(`${API_URL}/freight-map-public/${encodeURIComponent(token)}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "No se pudo guardar la ubicación");
      }
      setInfo(`${TYPE_LABELS[selectedType]} guardado. Podés agregar otra ubicación o cerrar.`);
      setDraftLabel("");
      setDraftAddress("");
      await loadData();
    } catch (e) {
      setError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <CenterCard>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.t1 }}>Link inválido</div>
        <div style={{ fontSize: 14, color: COLORS.t3, marginTop: 8, lineHeight: 1.5 }}>
          Este link fue generado desde Tolvink. Si expiró, solicitá uno nuevo.
        </div>
      </CenterCard>
    );
  }

  if (error && !data) {
    return (
      <CenterCard>
        <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.t1 }}>No se pudo abrir el mapa</div>
        <div style={{ fontSize: 14, color: COLORS.t3, marginTop: 8, lineHeight: 1.5 }}>{error}</div>
      </CenterCard>
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.bg, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}>
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: COLORS.pri, letterSpacing: -1 }}>tolvink</span>
          <span style={{ width: 8, height: 8, borderRadius: R.xs, background: COLORS.acc, display: "inline-block" }}></span>
        </div>
        <div style={{ fontSize: 13, color: COLORS.t3, fontWeight: 600 }}>
          {data?.freight?.code ? `Flete ${data.freight.code}` : "Indicar ubicación"}
        </div>
      </header>

      {data?.freight && (
        <div style={styles.subhead}>
          <span>{data.freight.originName || "—"}</span>
          <span style={{ color: COLORS.t3 }}>→</span>
          <span>{data.freight.destName || "—"}</span>
          {data.freight.item?.grain && <span style={styles.tag}>{data.freight.item.grain}</span>}
        </div>
      )}

      <div style={styles.searchBar}>
        <input
          ref={searchRef}
          value={draftAddress}
          onChange={(e) => setDraftAddress(e.target.value)}
          placeholder="Buscar dirección o lugar..."
          style={styles.input}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
        {mapLoading && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: COLORS.bg }}>
            <div style={{ color: COLORS.t3 }}>Cargando mapa...</div>
          </div>
        )}
      </div>

      <section style={styles.panel}>
        <div style={styles.typeRow}>
          {allowedTypes.map((t) => {
            const exists = !!existingByType[t] && (t === "ORIGIN" || t === "DESTINATION");
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                style={{
                  ...styles.typeBtn,
                  background: selectedType === t ? TYPE_COLORS[t] : COLORS.w,
                  color: selectedType === t ? "#fff" : COLORS.t1,
                  borderColor: selectedType === t ? TYPE_COLORS[t] : COLORS.b1,
                }}
              >
                <span style={{ ...styles.typeDot, background: TYPE_COLORS[t] }} />
                {TYPE_LABELS[t]}
                {exists && (
                  <span style={{ ...styles.typeFlag, background: selectedType === t ? "rgba(255,255,255,0.22)" : COLORS.bg, color: selectedType === t ? "#fff" : COLORS.t2 }}>
                    cargado
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {willReplace && (
          <div style={{ ...styles.banner, background: "#FFF4E0", color: "#7A4B0F", border: "1px solid #F2D8A8" }}>
            Ya hay un {TYPE_LABELS[selectedType].toLowerCase()} cargado para este flete. Si guardás, vas a reemplazarlo.
          </div>
        )}

        <input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          maxLength={120}
          placeholder="Nombre visible (opcional)"
          style={styles.input}
        />

        <div style={styles.actionsRow}>
          <button type="button" onClick={useCurrentLocation} style={styles.secondaryBtn}>
            Usar mi ubicación
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!draft || saving}
            style={{ ...styles.primaryBtn, opacity: !draft || saving ? 0.5 : 1, cursor: !draft || saving ? "default" : "pointer" }}
          >
            {saving
              ? "Guardando..."
              : willReplace
                ? `Modificar ${TYPE_LABELS[selectedType]?.toLowerCase()}`
                : `Cargar ${TYPE_LABELS[selectedType]?.toLowerCase()}`}
          </button>
        </div>

        {error && <div style={{ ...styles.banner, background: COLORS.errPale, color: COLORS.err }}>{error}</div>}
        {info && <div style={{ ...styles.banner, background: COLORS.okPale, color: COLORS.pri }}>{info}</div>}

        {data?.locations?.length > 0 && (
          <div style={styles.list}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.t3, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Ya cargadas en este flete
            </div>
            {data.locations.map((loc) => (
              <div key={loc.id} style={styles.listItem}>
                <span style={{ ...styles.typeDot, background: TYPE_COLORS[loc.type] || COLORS.pri }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {TYPE_LABELS[loc.type]} · {loc.label || loc.address || "sin nombre"}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.t3 }}>
                    {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CenterCard({ children }) {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: COLORS.bg, fontFamily: "'DM Sans', system-ui, sans-serif", padding: 24 }}>
      <div style={{ textAlign: "center", padding: 32, background: COLORS.w, borderRadius: R.xl, maxWidth: 360, boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
        {children}
      </div>
    </div>
  );
}

function extractTokenFromUrl() {
  const m = window.location.pathname.match(/^\/freight-map-public\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || null;
}

function pickInitialCenter(data) {
  if (data?.freight?.origin) return { lat: Number(data.freight.origin.lat), lng: Number(data.freight.origin.lng) };
  if (data?.freight?.destination) return { lat: Number(data.freight.destination.lat), lng: Number(data.freight.destination.lng) };
  const loc = data?.locations?.[0];
  if (loc) return { lat: Number(loc.lat), lng: Number(loc.lng) };
  return null;
}

function pickInitialZoom(data) {
  if (data?.freight?.origin || data?.freight?.destination || data?.locations?.length) return 12;
  return 7;
}

function buildPinIcon(maps, color) {
  return {
    path: maps.SymbolPath?.CIRCLE ?? 0,
    scale: 9,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 3,
  };
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: COLORS.w,
    borderBottom: `1px solid ${COLORS.b2}`,
    flexShrink: 0,
  },
  subhead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    background: COLORS.w,
    borderBottom: `1px solid ${COLORS.b2}`,
    fontSize: 13,
    color: COLORS.t1,
    flexWrap: "wrap",
  },
  tag: {
    marginLeft: "auto",
    padding: "3px 9px",
    borderRadius: 999,
    background: COLORS.bg,
    color: COLORS.t2,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  searchBar: {
    padding: "10px 12px",
    background: COLORS.w,
    borderBottom: `1px solid ${COLORS.b2}`,
    flexShrink: 0,
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    borderRadius: R.md,
    border: `1.5px solid ${COLORS.b1}`,
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
    color: COLORS.t1,
    background: COLORS.bg,
    boxSizing: "border-box",
  },
  panel: {
    padding: "12px 14px",
    paddingBottom: "max(14px, env(safe-area-inset-bottom))",
    background: COLORS.w,
    borderTop: `1px solid ${COLORS.b2}`,
    display: "grid",
    gap: 10,
    flexShrink: 0,
    maxHeight: "44vh",
    overflow: "auto",
  },
  typeRow: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 2,
  },
  typeBtn: {
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 14px",
    borderRadius: 999,
    border: `1.5px solid ${COLORS.b1}`,
    fontSize: 13.5,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
  },
  typeFlag: {
    fontSize: 10.5,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginLeft: 2,
  },
  actionsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  primaryBtn: {
    padding: "13px 16px",
    borderRadius: R.lg,
    border: "none",
    background: COLORS.pri,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "inherit",
  },
  secondaryBtn: {
    padding: "13px 16px",
    borderRadius: R.lg,
    border: `1.5px solid ${COLORS.b1}`,
    background: COLORS.w,
    color: COLORS.t1,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  banner: {
    padding: "9px 12px",
    borderRadius: R.md,
    fontSize: 13,
    lineHeight: 1.4,
  },
  list: {
    display: "grid",
    gap: 7,
    marginTop: 4,
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 11px",
    border: `1px solid ${COLORS.b2}`,
    borderRadius: R.md,
    background: COLORS.bg,
  },
};
