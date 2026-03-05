import { useState, useEffect, useRef, Component } from "react";
import { apiGetLastPosition, apiSendTracking, apiGetParticipantPositions } from "./api";
import { C, Ic } from "./theme";
import { useUIStore } from "./store";
import log from "./logger";

// HTML escape for InfoWindow content (prevents XSS)
const _esc = v => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// Haversine distance in km (straight line)
const _haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Hook: get user's current position (non-blocking, one-shot)
function _useUserPos() {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (ref.current !== null || !navigator.geolocation) return;
    let mounted = true;
    ref.current = "pending";
    navigator.geolocation.getCurrentPosition(
      (p) => { ref.current = "done"; if (mounted) setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { ref.current = "denied"; },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
    return () => { mounted = false; };
  }, []);
  return pos;
}

// ======================== GOOGLE MAPS ================================

const GMAPS_KEY = import.meta.env.VITE_GMAPS_KEY || "";

export function loadGMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      let elapsed = 0;
      const check = setInterval(() => {
        if (window.google?.maps) { clearInterval(check); resolve(window.google.maps); return; }
        elapsed += 100;
        if (elapsed > 15000) { clearInterval(check); reject(new Error('Google Maps load timeout')); }
      }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=geometry,places`;
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Error Boundary to prevent white screens
export class SafeZone extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { log.error("SafeZone", error, info); }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 12, background: "#FEE2E2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Error en este componente</div>
        <div>{this.state.error?.message || "Error desconocido"}</div>
        <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: "1px solid #DC2626", background: "white", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reintentar</button>
      </div>;
    }
    return this.props.children;
  }
}

// Location Picker: Autocomplete + Map Pin
const URUGUAY_CENTER = { lat: -33.0, lng: -56.0 };

export function LocationPicker({ label, value, onChange, defaultCenter }) {
  const inputRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapObjRef = useRef(null);
  const geocoderRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const [showMap, setShowMap] = useState(false);
  const [addr, setAddr] = useState(value?.address || "");
  const [initError, setInitError] = useState(false);
  const setLocPicker = useUIStore(s => s.setLocPicker);

  useEffect(() => {
    if (!showMap || !mapRef.current) return;
    let cancelled = false;

    const initMap = async (startCenter, startZoom) => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          zoom: startZoom, center: startCenter,
          disableDefaultUI: true, zoomControl: true, mapTypeControl: false,
          streetViewControl: false, fullscreenControl: false,
          gestureHandling: "greedy",
        });
        mapObjRef.current = map;

        const marker = new maps.Marker({ position: startCenter, map, draggable: true });
        markerRef.current = marker;

        if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          geocoderRef.current.geocode({ location: { lat: pos.lat(), lng: pos.lng() } }, (results, status) => {
            const a = status === "OK" && results[0] ? results[0].formatted_address : "";
            setAddr(a);
            onChangeRef.current({ lat: pos.lat(), lng: pos.lng(), address: a });
          });
        });

        map.addListener("click", (e) => {
          marker.setPosition(e.latLng);
          geocoderRef.current.geocode({ location: { lat: e.latLng.lat(), lng: e.latLng.lng() } }, (results, status) => {
            const a = status === "OK" && results[0] ? results[0].formatted_address : "";
            setAddr(a);
            onChangeRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng(), address: a });
          });
        });

        // Autocomplete
        if (inputRef.current) {
          const autocomplete = new maps.places.Autocomplete(inputRef.current, {
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
              setAddr(a);
              onChangeRef.current({ lat, lng, address: a });
            }
          });
        }
      } catch (err) {
        log.error("LocationPicker", err);
        setInitError(true);
      }
    };

    if (value?.lat && value?.lng) {
      initMap({ lat: Number(value.lat), lng: Number(value.lng) }, 13);
    } else if (defaultCenter?.lat && defaultCenter?.lng) {
      initMap({ lat: Number(defaultCenter.lat), lng: Number(defaultCenter.lng) }, 13);
    } else {
      initMap(URUGUAY_CENTER, 7);
    }

    return () => {
      cancelled = true;
      if (markerRef.current && window.google?.maps) google.maps.event.clearInstanceListeners(markerRef.current);
      if (mapObjRef.current && window.google?.maps) google.maps.event.clearInstanceListeners(mapObjRef.current);
    };
  }, [showMap]);

  const openFull = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setLocPicker({ value, onChange, defaultCenter, label });
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>{label || "Ubicación"}</div>
      {initError && <div style={{ fontSize: 11, color: C.err, marginBottom: 4 }}>Error al cargar el mapa. Intentá recargar la página.</div>}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input ref={inputRef} value={addr} onChange={e => setAddr(e.target.value)}
          placeholder="Buscar dirección o tocar en el mapa..."
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${C.b1}`, fontSize: 12.5, fontFamily: "inherit", outline: "none", color: C.t1, background: C.w, boxSizing: "border-box" }}
          onFocus={() => setShowMap(true)} />
        <button onClick={() => { if(!showMap) setShowMap(true); else openFull(); }} style={{ padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${value?.lat ? C.ok : C.b1}`, background: value?.lat ? C.okPale : C.w, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: value?.lat ? C.ok : C.t3 }}>
          {Ic.pin(value?.lat ? C.ok : C.t3, 14)} {value?.lat ? "✓" : "Mapa"}
        </button>
      </div>

      {/* Inline map (non-fullscreen) */}
      {showMap && (
        <div style={{ marginTop: 6, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.b1}`, position:"relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: 180 }} />
          <button onClick={openFull} style={{ position:"absolute", top:8, right:8, zIndex:5, padding:"6px 8px", borderRadius:6, background:"rgba(255,255,255,0.9)", border:`1px solid ${C.b1}`, cursor:"pointer", display:"flex", alignItems:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }}>
            {Ic.expand(C.t1,16)}
          </button>
          {value?.lat && <div style={{ fontSize: 10, color: C.t3, padding: "4px 8px", background: C.bg }}>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</div>}
        </div>
      )}
    </div>
  );
}

// ======================== LOCATION PICKER FULLSCREEN =====================
// Rendered in App.jsx below header bar (same pattern as mapFocus)

export function LocPickerFullscreen({ value, onChange, defaultCenter, label, onClose }) {
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const searchRef = useRef(null);
  const geocoderRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const [addr, setAddr] = useState(value?.address || "");
  const [curValue, setCurValue] = useState(value || null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;

        const startCenter = curValue?.lat && curValue?.lng
          ? { lat: Number(curValue.lat), lng: Number(curValue.lng) }
          : defaultCenter?.lat && defaultCenter?.lng
            ? { lat: Number(defaultCenter.lat), lng: Number(defaultCenter.lng) }
            : URUGUAY_CENTER;
        const startZoom = (curValue?.lat || defaultCenter?.lat) ? 13 : 7;

        const map = new maps.Map(mapRef.current, {
          zoom: startZoom, center: startCenter,
          disableDefaultUI: true, zoomControl: true, mapTypeControl: false,
          streetViewControl: false, fullscreenControl: false,
          gestureHandling: "greedy",
        });
        mapObjRef.current = map;

        const marker = new maps.Marker({ position: startCenter, map, draggable: true });
        markerRef.current = marker;

        if (!geocoderRef.current) geocoderRef.current = new maps.Geocoder();
        const geocodeAndUpdate = (lat, lng) => {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            const a = status === "OK" && results[0] ? results[0].formatted_address : "";
            setAddr(a);
            setCurValue({ lat, lng, address: a });
            onChangeRef.current({ lat, lng, address: a });
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

        // Autocomplete on search input
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
              setAddr(a);
              setCurValue({ lat, lng, address: a });
              onChangeRef.current({ lat, lng, address: a });
            }
          });
        }
      } catch (err) {
        log.error("LocPickerFullscreen", err);
      }
    })();

    return () => {
      cancelled = true;
      if (markerRef.current && window.google?.maps) google.maps.event.clearInstanceListeners(markerRef.current);
      if (mapObjRef.current && window.google?.maps) google.maps.event.clearInstanceListeners(mapObjRef.current);
    };
  }, []);

  return <>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.w,borderBottom:`1px solid ${C.b2}`,flexShrink:0,zIndex:10}}>
      <button onClick={onClose} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.bg,cursor:"pointer",fontSize:13,fontWeight:700,color:C.pri,fontFamily:"inherit",flexShrink:0}}>{Ic.chev(C.pri,14)} Listo</button>
      <input ref={searchRef} value={addr} onChange={e => setAddr(e.target.value)} placeholder="Buscar dirección..."
        style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.t1,background:C.bg}} />
    </div>
    <div style={{flex:1,minHeight:0,position:"relative"}}>
      <div ref={mapRef} style={{position:"absolute",inset:0}} />
    </div>
    {curValue?.lat && (
      <div style={{fontSize:11,color:C.t3,padding:"8px 16px",background:C.w,textAlign:"center",flexShrink:0,borderTop:`1px solid ${C.b2}`}}>
        {label || "Ubicación"}: {Number(curValue.lat).toFixed(5)}, {Number(curValue.lng).toFixed(5)}
      </div>
    )}
  </>;
}

// ======================== PARTICIPANT PIN ICONS ========================

const _TYPE_LABEL = { chofer: "Chofer", producer: "Productor", plant: "Planta", transporter: "Transportista", other: "Participante" };
const _TYPE_COLORS = { chofer: "#FF6A00", producer: "#1A6B37", plant: "#003882", transporter: "#8B5CF6", other: "#6B7280" };
const _pinSvg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="5" fill="#fff"/></svg>`;
const _participantIcon = (type, maps) => {
  const color = _TYPE_COLORS[type] || _TYPE_COLORS.other;
  return { url: "data:image/svg+xml," + encodeURIComponent(_pinSvg(color)), scaledSize: new maps.Size(28, 40), anchor: new maps.Point(14, 40) };
};
const _renderParticipantMarkers = (participants, mapInst, markersRef, iwRef, userPos) => {
  const maps = window.google?.maps;
  if (!maps || !mapInst) return;
  if (!iwRef.current) iwRef.current = new maps.InfoWindow();
  const activeIds = new Set();
  participants.forEach(p => {
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    const uid = p.userId || p.id;
    if (!uid) return;
    activeIds.add(uid);
    const name = _esc(p.userName || "Desconocido");
    const type = p.participantType || "other";
    const typeLabel = _TYPE_LABEL[type] || "Participante";
    const time = p.createdAt ? new Date(p.createdAt).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }) : "";
    const distKm = userPos ? _haversine(userPos.lat, userPos.lng, lat, lng) : null;
    const distText = distKm !== null ? `${distKm.toFixed(1)} km` : "";
    const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    const buildContent = () => {
      const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${_esc(_TYPE_COLORS[type]||_TYPE_COLORS.other)};margin-right:4px;vertical-align:middle"></span>`;
      return `<div style="font-family:system-ui;font-size:12px;line-height:1.5;min-width:120px">` +
        `<strong>${name}</strong><br/>${dot}<span style="color:#666">${_esc(typeLabel)}</span>` +
        (time ? ` <span style="color:#999;font-size:10px">\u00b7 ${_esc(time)}</span>` : "") +
        (distText ? `<br/><span style="color:#333;font-weight:600;font-size:11px">${_esc(distText)}</span>` : "") +
        `<br/><a href="${_esc(gmapsUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;margin-top:4px;padding:4px 8px;background:#4285F4;color:#fff;border-radius:5px;font-size:10px;font-weight:700;text-decoration:none">Abrir en Google Maps</a>` +
        `</div>`;
    };

    if (markersRef.current[uid]) {
      markersRef.current[uid].setPosition({ lat, lng });
      markersRef.current[uid]._iwContent = buildContent;
    } else {
      const marker = new maps.Marker({
        position: { lat, lng }, map: mapInst,
        title: `${p.userName || "Desconocido"} (${typeLabel})`,
        icon: _participantIcon(type, maps),
        zIndex: type === "chofer" ? 999 : 900,
      });
      marker._iwContent = buildContent;
      marker.addListener("click", () => {
        iwRef.current.setContent(marker._iwContent());
        iwRef.current.open(mapInst, marker);
      });
      markersRef.current[uid] = marker;
    }
  });
  Object.keys(markersRef.current).forEach(uid => {
    if (!activeIds.has(uid)) { markersRef.current[uid].setMap(null); delete markersRef.current[uid]; }
  });
};

// ======================== FREIGHT MAP =================================

export function FreightMap({ freightId, originLat, originLng, destLat, destLng, originName, destName, status, isDriver, originCompanyType, destCompanyType }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const participantMarkers = useRef({});
  const participantInfoWindow = useRef(null);
  const directionsRef = useRef(null);
  const isLiveRef = useRef(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [truckPos, setTruckPos] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState(null);
  const goToMap = useUIStore(s => s.goToMap);
  const userPos = _useUserPos();

  const hasOrigin = originLat && originLng;
  const hasDest = destLat && destLng;
  const hasCoords = hasOrigin && hasDest;
  const hasAnyCoord = hasOrigin || hasDest;
  const isLive = status === "in_progress" || status === "loaded";
  isLiveRef.current = isLive;

  useEffect(() => {
    if (!hasAnyCoord || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled) return;

        const origin = hasOrigin ? { lat: originLat, lng: originLng } : null;
        const dest = hasDest ? { lat: destLat, lng: destLng } : null;
        const center = origin && dest
          ? { lat: (originLat + destLat) / 2, lng: (originLng + destLng) / 2 }
          : origin || dest;
        const zoom = origin && dest ? 7 : 12;

        const map = new maps.Map(mapRef.current, {
          zoom,
          center,
          disableDefaultUI: true,
          zoomControl: false,
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
        setMapReady(true);

        if (origin) {
          new maps.Marker({
            position: origin, map,
            title: originName || "Origen",
            icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#1A6B37", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
          });
        }

        if (dest) {
          new maps.Marker({
            position: dest, map,
            title: destName || "Destino",
            icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#003882", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
          });
        }

        // Only draw route if both coords exist
        if (origin && dest) {
          const directionsService = new maps.DirectionsService();
          const dr = new maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: isLiveRef.current ? "#FF6A00" : "#1A6B37",
              strokeWeight: 4,
              strokeOpacity: 0.8,
            },
          });
          directionsRef.current = dr;

          directionsService.route({
            origin, destination: dest,
            travelMode: maps.TravelMode.DRIVING,
          }, (result, s) => {
            if (cancelled) return;
            if (s === "OK") {
              dr.setDirections(result);
              const leg = result.routes[0]?.legs[0];
              if (leg) setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text });
            }
          });
        }

      } catch (e) {
        if (!cancelled) setError("No se pudo cargar el mapa");
      }
    })();

    return () => {
      cancelled = true;
      Object.values(participantMarkers.current).forEach(m => m.setMap(null));
      participantMarkers.current = {};
      directionsRef.current = null;
      setMapReady(false);
    };
  }, [hasAnyCoord, originLat, originLng, originName, destLat, destLng, destName]);

  // Update route color when live status changes (without full map reinit)
  useEffect(() => {
    if (!directionsRef.current) return;
    directionsRef.current.setOptions({
      polylineOptions: { strokeColor: isLive ? "#FF6A00" : "#1A6B37", strokeWeight: 4, strokeOpacity: 0.8 },
    });
  }, [isLive]);

  // Fetch participant positions — starts immediately (parallel with map init)
  useEffect(() => {
    if (!freightId) return;
    let cancelled = false;

    const fetchPositions = async () => {
      try {
        const parts = await apiGetParticipantPositions(freightId);
        if (cancelled || !Array.isArray(parts)) return;
        setParticipants(parts);
        // Derive truckPos from chofer participant
        const driver = parts.find(p => p.participantType === "chofer");
        if (driver) {
          const lat = parseFloat(driver.lat);
          const lng = parseFloat(driver.lng);
          if (!isNaN(lat) && !isNaN(lng)) setTruckPos({ lat, lng, speed: driver.speed, updatedAt: driver.createdAt });
        }
      } catch {}
    };

    fetchPositions();
    const iv = isLive ? setInterval(fetchPositions, 10000) : null;
    return () => { cancelled = true; if (iv) clearInterval(iv); };
  }, [isLive, freightId]);

  // Render participant markers when data + map are both ready
  useEffect(() => {
    if (!mapReady || !participants.length) return;
    _renderParticipantMarkers(participants, mapInstance.current, participantMarkers, participantInfoWindow, userPos);
  }, [participants, mapReady, userPos]);

  // Driver sends position (throttled: max 1 send per 15s)
  useEffect(() => {
    if (!isDriver || !isLive || !freightId) return;
    let watchId = null;
    let lastSent = 0;

    if (navigator.geolocation) {
      setTracking(true);
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          if (Date.now() - lastSent < 15000) return;
          try {
            await apiSendTracking(freightId, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed ?? 0,
              heading: pos.coords.heading ?? 0,
            });
            lastSent = Date.now();
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setTracking(false);
    };
  }, [isDriver, isLive, freightId]);

  if (!hasAnyCoord) return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 32, textAlign: "center", boxShadow: C.sh }}>
      {Ic.pin(C.t3, 28)}
      <div style={{ fontSize: 12, color: C.t3, marginTop: 8 }}>Ubicación no disponible</div>
    </div>
  );

  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, overflow: "hidden", boxShadow: C.sh, display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding:"10px 14px", flexShrink:0 }}>
        {Ic.pin(C.pri, 14)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>{hasCoords ? "Recorrido" : "Ubicación"}</span>
        {routeInfo && (
          <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>
            {routeInfo.distance} · {routeInfo.duration}
          </span>
        )}
        <button onClick={()=>goToMap(hasOrigin?originLat:(destLat),hasOrigin?originLng:(destLng),hasOrigin?originName:(destName),hasCoords?destLat:undefined,hasCoords?destLng:undefined,hasCoords?destName:undefined,freightId)} style={{ marginLeft:"auto", padding:"4px 10px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, color:C.pri, fontFamily:"inherit", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
          {Ic.expand(C.pri,11)} Ver mapa
        </button>
      </div>
      {error ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>{error}</div>
      ) : (
        <div ref={mapRef} style={{ width: "100%", flex:1, minHeight:180 }} />
      )}
      <div style={{ padding:"8px 14px", display: "flex", gap: 12, fontSize: 10.5, flexWrap: "wrap", alignItems: "center", flexShrink:0 }}>
        {hasOrigin && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#1A6B37" }} />
          <span style={{ color: C.t2 }}>{originName}</span>
        </div>}
        {hasDest && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#003882" }} />
          <span style={{ color: C.t2 }}>{destName}</span>
        </div>}
        {isLive && (truckPos || participants.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#FF6A00", animation: "ti 1.5s infinite" }} />
            <span style={{ color: C.acc, fontWeight: 600, fontSize: 10 }}>En vivo{truckPos?.speed>0?` \u00b7 ${Math.round(parseFloat(truckPos.speed))} km/h`:""}{truckPos?.updatedAt && ` \u00b7 ${new Date(truckPos.updatedAt).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})}`}</span>
          </div>
        )}
        {isLive && tracking && (
          <div style={{ fontSize: 9, color: C.ok, fontWeight: 600 }}>📡 Enviando ubicación</div>
        )}
      </div>
    </div>
  );
}

// ======================== FREIGHTS OVERVIEW MAP ===========================

const _STATUS_COLOR = s => {
  if (s === "pending_assignment") return "#FF6A00";
  if (["assigned","accepted","in_progress","loaded"].includes(s)) return "#2563EB";
  if (s === "finished") return "#1A6B37";
  if (s === "canceled") return "#DC2626";
  return "#999";
};
const _STATUS_LABEL = { pending_assignment:"Solicitado", assigned:"Asignado a flota", accepted:"Camión confirmado", in_progress:"En curso", loaded:"Cargando", finished:"Finalizado", canceled:"Cancelado" };

const _svgIcon = (svg) => "data:image/svg+xml," + encodeURIComponent(svg);
const _FIELD_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A6B37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22L12 12l10 10"/><path d="M2 16l5-5 3 3 4-4 3 3 5-5"/><line x1="2" y1="22" x2="22" y2="22"/></svg>';
const _PLANT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#003882" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>';
const _TRUCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#FF6A00" stroke="#fff" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';

export function FreightsOverviewMap({ freights, onSelect, fields, plants }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const freightMk = useRef({});
  const entityMk = useRef([]);
  const truckMarkers = useRef([]);
  const info = useRef(null);
  const boundsSet = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [showFreights, setShowFreights] = useState(true);
  onSelectRef.current = onSelect;

  // Init map once
  useEffect(() => {
    if (!mapRef.current) return;
    if (!GMAPS_KEY) { setMapError("Falta la clave de Google Maps (VITE_GMAPS_KEY)"); return; }
    let c = false;
    const initMap = async () => {
      try {
        const maps = await loadGMaps();
        if (c || !mapRef.current) return;
        mapObj.current = new maps.Map(mapRef.current, {
          zoom: 6, center: { lat: -34.6, lng: -56.2 },
          disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy",
          styles: [{ featureType:"poi", stylers:[{visibility:"off"}] }, { featureType:"transit", stylers:[{visibility:"off"}] }],
        });
        info.current = new maps.InfoWindow();
        setReady(true);
      } catch(e) { if (!c) setMapError("No se pudo cargar Google Maps"); }
    };
    initMap();
    return () => { c = true; };
  }, []);

  // Freight + field + plant markers (diff-based for freights, avoids destroy/recreate)
  useEffect(() => {
    if (!ready || !mapObj.current) return;
    const maps = window.google.maps;
    const bounds = new maps.LatLngBounds();
    let has = false;

    // --- Freight origin markers (diff-based: reuse existing, add new, remove stale) ---
    if (showFreights) {
      const seen = new Set();
      freights.forEach(f => {
        if (!f.originLat || !f.originLng) return;
        const col = _STATUS_COLOR(f.status);
        const pos = { lat: f.originLat, lng: f.originLng };
        bounds.extend(pos); has = true;
        if (f.destLat && f.destLng) bounds.extend({ lat: f.destLat, lng: f.destLng });
        seen.add(f.id);

        const buildInfo = () =>
          `<div style="font-family:system-ui;font-size:12px;line-height:1.5;min-width:160px">` +
          `<strong>${_esc(f.code)}</strong><br/>${_esc(f.grain)} · ${_esc(f.tons)} ${_esc(f.unit||"tn")}<br/>` +
          (f.originCompanyName ? `<span style="font-weight:600">${_esc(f.originCompanyName)}</span><br/>` : "") +
          ([f.fieldName, f.originName].filter(Boolean).length ? `${[f.fieldName, f.originName].filter(Boolean).map(_esc).join(" / ")}<br/>` : "") +
          `\u2192 ${_esc(f.destName)}<br/>` +
          `<span style="color:${col};font-weight:600">${_esc(_STATUS_LABEL[f.status]||f.status)}</span></div>`;

        const existing = freightMk.current[f.id];
        if (existing) {
          existing.setPosition(pos);
          existing.setIcon({ path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: col, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 });
          existing._info = buildInfo;
        } else {
          const mk = new maps.Marker({ position: pos, map: mapObj.current, title: f.code,
            icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: col, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
          mk._info = buildInfo;
          mk.addListener("click", () => { info.current.setContent(mk._info()); info.current.open(mapObj.current, mk); });
          mk.addListener("dblclick", () => { if (onSelectRef.current) onSelectRef.current(f.id); });
          freightMk.current[f.id] = mk;
        }
      });
      Object.keys(freightMk.current).forEach(id => {
        if (!seen.has(id)) { freightMk.current[id].setMap(null); delete freightMk.current[id]; }
      });
    } else {
      Object.values(freightMk.current).forEach(m => m.setMap(null));
      freightMk.current = {};
    }

    // --- Field & plant markers (recreated — change rarely) ---
    entityMk.current.forEach(m => m.setMap(null));
    entityMk.current = [];

    (fields||[]).forEach(f => {
      const lat = f.lat ? parseFloat(f.lat) : null;
      const lng = f.lng ? parseFloat(f.lng) : null;
      if (!lat || !lng) return;
      const pos = { lat, lng };
      bounds.extend(pos); has = true;
      const mk = new maps.Marker({ position: pos, map: mapObj.current, title: f.name,
        icon: { url: _svgIcon(_FIELD_SVG), scaledSize: new maps.Size(28, 28), anchor: new maps.Point(14, 14) } });
      mk.addListener("click", () => {
        info.current.setContent(`<div style="font-family:system-ui;font-size:12px;line-height:1.4"><strong>${_esc(f.name)}</strong><br/><span style="color:#1A6B37;font-weight:600">Campo</span>${f.address ? "<br/>"+_esc(f.address) : ""}${f.hectares ? "<br/>"+_esc(f.hectares)+" ha" : ""}</div>`);
        info.current.open(mapObj.current, mk);
      });
      entityMk.current.push(mk);
    });

    (plants||[]).forEach(p => {
      const lat = p.lat ? parseFloat(p.lat) : null;
      const lng = p.lng ? parseFloat(p.lng) : null;
      if (!lat || !lng) return;
      const pos = { lat, lng };
      bounds.extend(pos); has = true;
      const mk = new maps.Marker({ position: pos, map: mapObj.current, title: p.name,
        icon: { url: _svgIcon(_PLANT_SVG), scaledSize: new maps.Size(28, 28), anchor: new maps.Point(14, 14) } });
      mk.addListener("click", () => {
        info.current.setContent(`<div style="font-family:system-ui;font-size:12px;line-height:1.4"><strong>${_esc(p.name)}</strong><br/><span style="color:#003882;font-weight:600">Planta</span>${p.address ? "<br/>"+_esc(p.address) : ""}</div>`);
        info.current.open(mapObj.current, mk);
      });
      entityMk.current.push(mk);
    });

    // Fit bounds only on first render (prevents jarring map jumps on data updates)
    if (has && !boundsSet.current) { mapObj.current.fitBounds(bounds, 40); boundsSet.current = true; }
  }, [ready, freights, fields, plants, showFreights]);

  // Live truck tracking for in_progress freights (parallel fetching)
  useEffect(() => {
    if (!ready || !mapObj.current || !showFreights) return;
    const maps = window.google.maps;
    const liveFreights = freights.filter(f => (f.status === "in_progress" || f.status === "loaded") && f.id);
    if (!liveFreights.length) {
      truckMarkers.current.forEach(m => m.setMap(null));
      truckMarkers.current = [];
      return;
    }

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const existingMap = {};
      truckMarkers.current.forEach(m => { existingMap[m._fid] = m; });

      const results = await Promise.allSettled(liveFreights.map(f =>
        apiGetLastPosition(f.id).then(pos => ({ f, pos }))
      ));
      if (cancelled) return;

      const activeIds = new Set();
      results.forEach(r => {
        if (r.status !== "fulfilled" || !r.value.pos) return;
        const { f, pos } = r.value;
        activeIds.add(f.id);
        const lat = parseFloat(pos.lat);
        const lng = parseFloat(pos.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        if (existingMap[f.id]) {
          existingMap[f.id].setPosition({ lat, lng });
        } else {
          const mk = new maps.Marker({
            position: { lat, lng }, map: mapObj.current, title: `${f.code} \u2014 En curso`,
            icon: { url: _svgIcon(_TRUCK_SVG), scaledSize: new maps.Size(36, 36), anchor: new maps.Point(18, 18) },
            zIndex: 999,
          });
          mk._fid = f.id;
          mk.addListener("click", () => {
            info.current.setContent(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.5"><strong>${_esc(f.code)}</strong><br/>${_esc(f.grain)} · ${_esc(f.tons)} ${_esc(f.unit||"tn")}<br/>` +
              `<span style="color:#FF6A00;font-weight:600">En curso</span>${f.truckPlate ? "<br/>"+_esc(f.truckPlate) : ""}${f.driverName ? " · "+_esc(f.driverName) : ""}</div>`
            );
            info.current.open(mapObj.current, mk);
          });
          mk.addListener("dblclick", () => { if (onSelectRef.current) onSelectRef.current(f.id); });
          truckMarkers.current.push(mk);
        }
      });
      // Remove markers for freights no longer in_progress
      truckMarkers.current = truckMarkers.current.filter(m => {
        if (!activeIds.has(m._fid)) { m.setMap(null); return false; }
        return true;
      });
    };

    poll();
    const iv = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [ready, freights, showFreights]);

  // Cleanup all markers on unmount
  useEffect(() => () => {
    truckMarkers.current.forEach(m => m.setMap(null));
    Object.values(freightMk.current).forEach(m => m.setMap(null));
    entityMk.current.forEach(m => m.setMap(null));
    freightMk.current = {}; entityMk.current = [];
  }, []);

  if (mapError) return (
    <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:40, textAlign:"center", color:C.t3 }}>
      <div style={{fontSize:32,marginBottom:8}}>🗺️</div>
      <div style={{fontSize:13,fontWeight:600,color:C.t2,marginBottom:4}}>Mapa no disponible</div>
      <div style={{fontSize:11}}>{mapError}</div>
    </div>
  );

  return (
    <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", position:"relative" }}>
      {!ready && <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,zIndex:5}}><div style={{fontSize:12,color:C.t3}}>Cargando mapa...</div></div>}
      <button onClick={()=>setShowFreights(v=>!v)} style={{position:"absolute",top:12,right:12,zIndex:10,padding:"6px 12px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.w,color:C.pri,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,boxShadow:C.shMd}}>
        {showFreights?Ic.eyeOff(C.pri,13):Ic.eye(C.pri,13)}
        {showFreights?"Ocultar fletes":"Ver fletes"}
      </button>
      <div ref={mapRef} style={{ width:"100%", height:420 }} />
    </div>
  );
}

// ======================== MAP OVERLAY (pin click) ===========================

export function MapOverlay({ lat, lng, label, destLat, destLng, destLabel, freightId, onClose }) {
  const mapRef = useRef(null);
  const mapInst = useRef(null);
  const pMarkers = useRef({});
  const pIw = useRef(null);
  const originMk = useRef(null);
  const destMk = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [listOpen, setListOpen] = useState(false);
  const userPos = _useUserPos();
  const mkInfoContent = (name, lt, ln) => {
    const gmapsUrl = `https://www.google.com/maps?q=${Number(lt)},${Number(ln)}`;
    return `<div style="font-family:sans-serif;padding:4px 2px"><div style="font-weight:700;font-size:13px;color:#1a1a1a">${_esc(name)||"Ubicación"}</div><div style="font-size:11px;color:#888;margin-top:3px">${Number(lt).toFixed(5)}, ${Number(ln).toFixed(5)}</div><a href="${_esc(gmapsUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:5px 10px;background:#4285F4;color:#fff;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">Abrir en Google Maps</a></div>`;
  };

  const focusPoint = (lt, ln, markerRef) => {
    const map = mapInst.current;
    if (!map) return;
    map.panTo({ lat: Number(lt), lng: Number(ln) });
    map.setZoom(15);
    if (markerRef && pIw.current) {
      const mk = markerRef.current || markerRef;
      if (mk && mk._iwContent) { pIw.current.setContent(mk._iwContent()); pIw.current.open(map, mk); }
      else if (mk) { const iw = new (window.google.maps.InfoWindow)({ content: mkInfoContent(mk.getTitle?.() || "", lt, ln) }); iw.open(map, mk); }
    }
    setListOpen(false);
  };

  // Fetch participant positions in parallel with map init
  useEffect(() => {
    if (!freightId) return;
    let cancelled = false;
    apiGetParticipantPositions(freightId).then(parts => {
      if (!cancelled && Array.isArray(parts)) setParticipants(parts);
    }).catch(() => { if (!cancelled) setParticipants([]); });
    return () => { cancelled = true; };
  }, [freightId]);

  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    let c = false;
    (async () => {
      const maps = await loadGMaps();
      if (c || !mapRef.current) return;
      const pos = { lat: Number(lat), lng: Number(lng) };
      const map = new maps.Map(mapRef.current, {
        zoom: 15, center: pos,
        disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy",
        styles: [{ featureType:"poi", stylers:[{visibility:"off"}] }, { featureType:"transit", stylers:[{visibility:"off"}] }],
      });
      mapInst.current = map;
      if (!pIw.current) pIw.current = new maps.InfoWindow();
      const marker = new maps.Marker({ position: pos, map, animation: maps.Animation.DROP,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 12, fillColor: C.pri, fillOpacity: 0.8, strokeColor: "#fff", strokeWeight: 3 } });
      originMk.current = marker;
      const iw = new maps.InfoWindow({ content: mkInfoContent(label, lat, lng) });
      iw.open(map, marker);
      marker.addListener("click", () => iw.open(map, marker));
      if (destLat && destLng) {
        const dpos = { lat: Number(destLat), lng: Number(destLng) };
        const dm = new maps.Marker({ position: dpos, map, animation: maps.Animation.DROP,
          icon: { path: maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#0891B2", fillOpacity: 0.8, strokeColor: "#fff", strokeWeight: 3 } });
        destMk.current = dm;
        const iw2 = new maps.InfoWindow({ content: mkInfoContent(destLabel, destLat, destLng) });
        dm.addListener("click", () => iw2.open(map, dm));
        const bounds = new maps.LatLngBounds();
        bounds.extend(pos);
        bounds.extend(dpos);
        map.fitBounds(bounds, 60);
      }
      // Render participant pins if data already loaded
      if (participants.length) _renderParticipantMarkers(participants, map, pMarkers, pIw, userPos);
    })();
    return () => { c = true; };
  }, [lat, lng, label, destLat, destLng]);

  // Render participant pins when data or userPos changes
  useEffect(() => {
    if (!mapInst.current || !participants.length) return;
    _renderParticipantMarkers(participants, mapInst.current, pMarkers, pIw, userPos);
  }, [participants, userPos]);

  // Cleanup participant markers on unmount
  useEffect(() => () => {
    Object.values(pMarkers.current).forEach(m => m.setMap(null));
    pMarkers.current = {};
  }, []);

  // Build list items
  const items = [];
  if (lat && lng) items.push({ key: "origin", label: label || "Origen", color: "#1A6B37", type: "Origen", lat: Number(lat), lng: Number(lng), mk: originMk });
  if (destLat && destLng) items.push({ key: "dest", label: destLabel || "Destino", color: "#0891B2", type: "Destino", lat: Number(destLat), lng: Number(destLng), mk: destMk });
  participants.forEach(p => {
    const pLat = parseFloat(p.lat); const pLng = parseFloat(p.lng);
    if (isNaN(pLat) || isNaN(pLng)) return;
    const uid = p.userId || p.id;
    if (!uid) return;
    const type = p.participantType || "other";
    const dist = userPos ? _haversine(userPos.lat, userPos.lng, pLat, pLng) : null;
    items.push({ key: uid, label: p.userName || "Desconocido", color: _TYPE_COLORS[type] || _TYPE_COLORS.other, type: _TYPE_LABEL[type] || "Participante", lat: pLat, lng: pLng, mk: pMarkers.current[uid] ? { current: pMarkers.current[uid] } : null, dist, time: p.createdAt ? new Date(p.createdAt).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }) : null });
  });

  return <div style={{width:"100%",height:"100%",position:"relative"}}>
    <div ref={mapRef} style={{width:"100%",height:"100%"}} />
    {/* List toggle button */}
    {items.length > 0 && <button onClick={() => setListOpen(v => !v)} style={{position:"absolute",top:12,right:12,zIndex:20,padding:"8px 14px",borderRadius:10,border:`1.5px solid ${C.pri}`,background:C.w,color:C.pri,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
      {Ic.pin(C.pri, 13)} Ver ubicaciones compartidas
    </button>}
    {/* Scrollable item list */}
    {listOpen && items.length > 0 && <div style={{position:"absolute",bottom:0,left:0,right:0,maxHeight:"45%",background:"rgba(255,255,255,0.97)",borderTop:`2px solid ${C.pri}`,overflowY:"auto",zIndex:15,WebkitOverflowScrolling:"touch",backdropFilter:"blur(6px)"}}>
      {items.map(it => (
        <button key={it.key} onClick={() => focusPoint(it.lat, it.lng, it.mk)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"12px 16px",border:"none",borderBottom:`1px solid ${C.b1}`,background:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span style={{width:10,height:10,borderRadius:5,background:it.color,flexShrink:0}} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.label}</div>
            <div style={{fontSize:10.5,color:C.t3,marginTop:1}}>
              {it.type}{it.time ? ` \u00b7 ${it.time}` : ""}{it.dist != null ? ` \u00b7 ${it.dist.toFixed(1)} km` : ""}
            </div>
          </div>
          <span style={{fontSize:11,color:C.pri,fontWeight:600,flexShrink:0}}>{Ic.chev(C.pri, 10)}</span>
        </button>
      ))}
    </div>}
  </div>;
}
