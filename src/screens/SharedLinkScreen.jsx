import { useState, useEffect, useRef, useCallback } from "react";
import { C, Ic, FONT, MONO } from "../theme";
import { API_URL, apiResolveSharedLink } from "../api";

// Decode Google Maps encoded polyline
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function FreightMap({ freight }) {
  const oLat = freight.originLat != null ? Number(freight.originLat) : null;
  const oLng = freight.originLng != null ? Number(freight.originLng) : null;
  const dLat = freight.destLat != null ? Number(freight.destLat) : null;
  const dLng = freight.destLng != null ? Number(freight.destLng) : null;
  if (!oLat || !oLng || !dLat || !dLng) return null;

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || loaded) return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_PUBLIC_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!key) { setMapError(true); return; }

    // Load Google Maps JS
    const existing = document.getElementById("gm-shared");
    const init = () => {
      if (!window.google?.maps || !mapRef.current) return;
      const maps = window.google.maps;
      const center = { lat: (oLat + dLat) / 2, lng: (oLng + dLng) / 2 };
      const map = new maps.Map(mapRef.current, {
        center, zoom: 8, disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });
      // Origin marker (green)
      new maps.Marker({ position: { lat: oLat, lng: oLng }, map, title: freight.originName || "Origen",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#22C55E", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      // Destination marker (orange)
      new maps.Marker({ position: { lat: dLat, lng: dLng }, map, title: freight.destName || "Destino",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#F59E0B", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      // Route polyline
      if (freight.routePolyline) {
        const path = decodePolyline(freight.routePolyline);
        new maps.Polyline({ path, map, strokeColor: "#1D4ED8", strokeWeight: 3, strokeOpacity: 0.7 });
      }
      // Fit bounds
      const bounds = new maps.LatLngBounds();
      bounds.extend({ lat: oLat, lng: oLng });
      bounds.extend({ lat: dLat, lng: dLng });
      map.fitBounds(bounds, 40);
      setLoaded(true);
    };

    if (existing) { init(); return; }
    const script = document.createElement("script");
    script.id = "gm-shared";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.onload = init;
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, [visible]);

  // Static fallback
  if (mapError) {
    return (
      <div style={{ background: C.w, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${C.b2}`, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.t2 }}>
          {freight.originName || "Origen"} → {freight.destName || "Destino"}
        </div>
        {freight.routeDistanceKm && (
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
            {freight.routeDistanceKm} km · ~{freight.routeDurationMin} min
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ background: C.w, borderRadius: 12, overflow: "hidden", marginBottom: 12, border: `1px solid ${C.b2}`, position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: 260 }}>
        {!loaded && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: C.bg }}>
            <div style={{ fontSize: 13, color: C.t3 }}>Cargando mapa...</div>
          </div>
        )}
      </div>
      {freight.routeDistanceKm && (
        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(255,255,255,0.9)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: C.t1, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
          {freight.routeDistanceKm} km · ~{freight.routeDurationMin} min
        </div>
      )}
    </div>
  );
}

// =====================================================================
// TOLVINK — SharedLinkScreen (Public)
// Renders shared freight tracking, ticket, or portal views.
// =====================================================================

const STATUS_STEPS = [
  { key: "pending_assignment", label: "Solicitado", color: "#6B7280" },
  { key: "assigned", label: "Asignado", color: "#3B82F6" },
  { key: "accepted", label: "Aceptado", color: "#8B5CF6" },
  { key: "in_progress", label: "A campo", color: "#F59E0B" },
  { key: "loaded", label: "Cargado", color: "#14B8A6" },
  { key: "finished", label: "Finalizado", color: "#22C55E" },
];

function StatusTimeline({ freight, auditLogs }) {
  const currentIdx = STATUS_STEPS.findIndex(s => s.key === freight.status);
  const logMap = {};
  for (const log of (auditLogs || [])) {
    const key = log.toValue || log.action;
    if (!logMap[key]) logMap[key] = log.createdAt;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "16px 0" }}>
      {STATUS_STEPS.map((step, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const date = logMap[step.key] || (step.key === "pending_assignment" ? freight.createdAt : null);
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            {/* Timeline line + dot */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
              <div style={{
                width: isCurrent ? 16 : 12, height: isCurrent ? 16 : 12, borderRadius: "50%",
                background: reached ? step.color : C.b2,
                border: isCurrent ? `3px solid ${step.color}40` : "none",
                boxShadow: isCurrent ? `0 0 8px ${step.color}40` : "none",
              }} />
              {i < STATUS_STEPS.length - 1 && (
                <div style={{ width: 2, height: 28, background: reached ? step.color : C.b2 }} />
              )}
            </div>
            {/* Label + date */}
            <div style={{ paddingBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: isCurrent ? 700 : reached ? 600 : 400, color: reached ? C.t1 : C.t3 }}>
                {step.label}
              </div>
              {date && reached && (
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                  {new Date(date).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" })}
                  {" "}
                  {new Date(date).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FreightView({ data, creatorName }) {
  const f = data;
  if (!f) return null;
  const grain = f.items?.[0]?.grain || "Producto";
  const tons = f.items?.[0]?.tons || "—";
  const currentStep = STATUS_STEPS.find(s => s.key === f.status) || STATUS_STEPS[0];
  const assignment = f.assignments?.[0];
  const isActive = !["finished", "cancelled"].includes(f.status);

  return (
    <div>
      {/* Status badge */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px",
          borderRadius: 24, background: `${currentStep.color}15`, border: `2px solid ${currentStep.color}30`,
        }}>
          {isActive && <span style={{ width: 8, height: 8, borderRadius: "50%", background: currentStep.color, animation: "tolvinkPulse 1.5s infinite" }} />}
          <span style={{ fontSize: 18, fontWeight: 700, color: currentStep.color }}>{currentStep.label}</span>
        </div>
      </div>

      {/* Product info */}
      <div style={{ background: C.w, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${C.b2}` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 4 }}>
          {grain} · {tons} tn
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.t3 }}>{f.code}</div>
      </div>

      {/* Origin → Destination */}
      <div style={{ background: C.w, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${C.b2}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {Ic.pin("#22C55E", 16)}
          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>Origen</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>
              {f.field?.name || f.originName || f.originCompany?.name || "—"}
            </div>
          </div>
        </div>
        <div style={{ borderLeft: `2px dashed ${C.b2}`, height: 16, marginLeft: 8 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Ic.plant("#F59E0B", 16)}
          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>Destino</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>
              {f.destPlant?.name || f.destName || f.destCompany?.name || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <FreightMap freight={f} />

      {/* Transporter */}
      {assignment && (
        <div style={{ background: C.w, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${C.b2}` }}>
          <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 4 }}>Transporte</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>
            {assignment.transportCompany?.name || "—"}
          </div>
          {assignment.plate && (
            <div style={{ fontSize: 12, color: C.t2, marginTop: 2, fontFamily: MONO }}>{assignment.plate}</div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div style={{ background: C.w, borderRadius: 12, padding: 16, border: `1px solid ${C.b2}` }}>
        <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 4 }}>Seguimiento</div>
        <StatusTimeline freight={f} auditLogs={f.auditLogs} />
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.t3 }}>
        Compartido por {creatorName || "planta"} vía Tolvink
      </div>
    </div>
  );
}

function TicketView({ data, creatorName }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ background: C.w, borderRadius: 12, padding: 20, border: `1px solid ${C.b2}`, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 16 }}>Comprobante de Pesaje</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          {data.grossWeight != null && <div><div style={{ fontSize: 11, color: C.t3 }}>Peso Bruto</div><div style={{ fontSize: 18, fontWeight: 700 }}>{data.grossWeight} kg</div></div>}
          {data.tareWeight != null && <div><div style={{ fontSize: 11, color: C.t3 }}>Tara</div><div style={{ fontSize: 18, fontWeight: 700 }}>{data.tareWeight} kg</div></div>}
          {data.netWeight != null && <div><div style={{ fontSize: 11, color: C.t3 }}>Peso Neto</div><div style={{ fontSize: 18, fontWeight: 700, color: C.pri }}>{data.netWeight} kg</div></div>}
        </div>
        {data.product && <div style={{ fontSize: 14, color: C.t2 }}>Producto: {data.product}</div>}
        {data.freight && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.t3 }}>
            Flete: {data.freight.code} ({data.freight.status})
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.t3 }}>
        Emitido por {creatorName || "planta"} vía Tolvink
      </div>
    </div>
  );
}

function PortalView({ data, creatorName, targetName }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ fontSize: 14, color: C.t3, textAlign: "center", marginBottom: 16 }}>
        Portal de {creatorName || "planta"} — {targetName || data.targetCompanyName || "empresa"}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ background: C.w, borderRadius: 12, padding: 16, border: `1px solid ${C.b2}`, flex: "1 1 120px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.pri }}>{data.totalFreights || 0}</div>
          <div style={{ fontSize: 11, color: C.t3 }}>Fletes totales</div>
        </div>
        <div style={{ background: C.w, borderRadius: 12, padding: 16, border: `1px solid ${C.b2}`, flex: "1 1 120px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#F59E0B" }}>{data.activeFreights || 0}</div>
          <div style={{ fontSize: 11, color: C.t3 }}>Activos</div>
        </div>
        <div style={{ background: C.w, borderRadius: 12, padding: 16, border: `1px solid ${C.b2}`, flex: "1 1 120px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>
            {data.lastFreightAt ? new Date(data.lastFreightAt).toLocaleDateString("es-UY") : "—"}
          </div>
          <div style={{ fontSize: 11, color: C.t3 }}>Último flete</div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: C.t3 }}>
        Portal de {creatorName || "planta"} — Powered by Tolvink
      </div>
    </div>
  );
}

export default function SharedLinkScreen({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef(null);

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }
    let mounted = true;
    const load = async () => {
      try {
        const result = await apiResolveSharedLink(token);
        if (!mounted) return;
        if (!result.valid) {
          setError(result.reason === "expired" ? "Este link ha expirado" : result.reason === "revoked" ? "Este link fue revocado" : "Link no encontrado");
        } else {
          setData(result);
        }
      } catch {
        if (mounted) setError("Error al cargar");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    // Auto-refresh for active freights
    refreshRef.current = setInterval(() => {
      apiResolveSharedLink(token).then(r => {
        if (mounted && r.valid) setData(r);
      }).catch(() => {});
    }, 30000);

    return () => { mounted = false; clearInterval(refreshRef.current); };
  }, [token]);

  return (
    <div style={{ minHeight: "100dvh", background: "#F8FAFC", fontFamily: FONT }}>
      <meta name="robots" content="noindex, nofollow" />
      <style>{`@keyframes tolvinkPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ background: C.w, borderBottom: `1px solid ${C.b2}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.pri, letterSpacing: -1 }}>tolvink</span>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.acc }} />
        {data && (
          <span style={{ fontSize: 13, color: C.t3, marginLeft: 8 }}>
            {data.linkType === "FREIGHT" ? "Seguimiento de Flete" : data.linkType === "TICKET" ? "Comprobante de Pesaje" : "Portal"}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 40px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.b2}`, borderTopColor: C.pri, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ fontSize: 14, color: C.t3 }}>Cargando...</div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.t1, marginBottom: 8 }}>{error}</div>
            <div style={{ fontSize: 13, color: C.t3 }}>
              Si creés que es un error, contactá a quien te envió este link.
            </div>
          </div>
        )}

        {data && data.linkType === "FREIGHT" && (
          <FreightView data={data.data} creatorName={data.creatorCompanyName} />
        )}
        {data && data.linkType === "TICKET" && (
          <TicketView data={data.data} creatorName={data.creatorCompanyName} />
        )}
        {data && data.linkType === "PORTAL" && (
          <PortalView data={data.data} creatorName={data.creatorCompanyName} targetName={data.targetCompanyName} />
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "20px 16px", borderTop: `1px solid ${C.b2}`, fontSize: 12, color: C.t3 }}>
        <a href="https://tolvink.com" style={{ color: C.pri, textDecoration: "none", fontWeight: 600 }}>tolvink.com</a>
        {" — "}Gestión de fletes de granos
      </div>
    </div>
  );
}
