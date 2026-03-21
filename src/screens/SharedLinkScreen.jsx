import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { C, Ic, FONT, MONO, R, STATUS_COLORS } from "../theme";
import { FreightCard, StatusPill } from "../components/FreightCard";
import { Loader, EmptyState } from "../components";
import { apiResolveSharedLink } from "../api";
import { formatFreightDate } from "../constants";

// =====================================================================
// TOLVINK — SharedLinkScreen (Public)
// Visually identical to the authenticated app. Reuses real components.
// Full-width layout (max 1400px), natural scroll, no overflow hidden.
// =====================================================================

// ---------- Polyline decode ----------
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

// ---------- Date formatters ----------
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" }) + " " + dt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}
function fmtWeight(v) {
  if (v == null) return "—";
  const n = Number(v);
  return isNaN(n) ? "—" : n.toLocaleString("es-UY") + " kg";
}
function timeSince(d) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "hace unos segundos";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  return `hace ${Math.floor(s / 3600)}h`;
}
function useIsDesktop(bp = 768) {
  const [d, setD] = useState(typeof window !== "undefined" ? window.innerWidth >= bp : false);
  useEffect(() => {
    const h = () => setD(window.innerWidth >= bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return d;
}

// ---------- Shared layout primitives ----------

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.w, borderRadius: R.lg, padding: 18, marginBottom: 12, border: `1px solid ${C.b2}`, boxShadow: C.sh, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      {icon}
      <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
    </div>
  );
}

function MetricCard({ value, label, color, icon }) {
  return (
    <div style={{
      flex: "1 1 140px", background: C.w, borderRadius: R.lg, padding: "14px 16px",
      border: `1px solid ${C.b2}`, boxShadow: C.sh, minWidth: 0,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {icon}
      <span style={{ fontSize: 26, fontWeight: 800, color: color || C.pri, letterSpacing: -0.5 }}>{value}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: color || C.pri }}>{label}</span>
    </div>
  );
}

function FilterPill({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: R.pill, border: active ? `2px solid ${color || C.pri}` : `1px solid ${C.b2}`,
      background: active ? `${color || C.pri}12` : C.w, cursor: "pointer", fontFamily: "inherit",
      fontSize: 11.5, fontWeight: 600, color: active ? (color || C.pri) : C.t3,
    }}>{label}</button>
  );
}

// ======================== PROGRESS STEPPER ============================
// Identical to DetailScreen: 3-node circular stepper (Pendiente → En viaje → Finalizado)

function ProgressStepper({ freight, auditLogs }) {
  const steps = ["pending_assignment", "assigned", "accepted", "in_progress", "loaded", "finished"];
  const curIdx = steps.indexOf(freight.status);
  const isCanceled = freight.status === "canceled";
  const visualIdx = isCanceled ? (curIdx >= 1 ? (curIdx >= 3 ? 2 : 1) : 0) : curIdx === 0 ? 0 : curIdx <= 4 ? 1 : 2;

  const subLabels = { assigned: "Asignado", accepted: "Asignado", in_progress: "A campo", loaded: "A planta" };
  const singleSub = [1, 2, 3, 4].includes(curIdx) || isCanceled ? subLabels[freight.status] || subLabels[steps[curIdx]] : null;

  const visualSteps = [
    { label: "Pendiente", color: STATUS_COLORS.pending_assignment.ribbon, icon: (c, s) => Ic.clk(c, s) },
    { label: "En viaje", color: STATUS_COLORS.in_progress.ribbon, sub: singleSub, icon: (c, s) => Ic.truck(c, s) },
    { label: isCanceled ? "Cancelado" : "Finalizado", color: isCanceled ? STATUS_COLORS.canceled.ribbon : STATUS_COLORS.finished.ribbon, icon: (c, s) => isCanceled ? Ic.cross(c, s) : Ic.chk(c, s) },
  ];

  const fmtD = (d) => { try { const dt = new Date(d); return dt.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " " + dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return ""; } };

  const stepAuditActions = {
    pending_assignment: ["created"],
    assigned: ["assigned", "assigned_multi"],
    accepted: ["accepted", "authorized"],
    in_progress: ["started", "trip_started", "auto_started"],
    loaded: ["confirm_loaded", "trip_confirm_loaded", "auto_loaded"],
    finished: ["confirm_finished", "finished", "trip_confirm_finished", "trip_finished", "canceled", "auto_transporter_confirmed"],
  };
  const visualAuditMap = [["pending_assignment"], ["assigned", "accepted", "in_progress", "loaded"], ["finished"]];

  const getStepDate = (backendSteps) => {
    if (!auditLogs) return null;
    const logs = backendSteps.flatMap(s => (auditLogs || []).filter(l => (stepAuditActions[s] || []).includes(l.action)));
    if (logs.length === 0) return null;
    return logs[logs.length - 1].createdAt;
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 12.2, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Progreso</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", position: "relative", padding: "0 4px" }}>
        {visualSteps.map((vs, i) => {
          const done = i < visualIdx;
          const active = i === visualIdx && !isCanceled;
          const isCancelStep = i === 2 && isCanceled;
          const nodeColor = done ? C.pri : active ? vs.color : isCancelStep ? C.err : C.b1;
          const nodeIcon = vs.icon(done || active || isCancelStep ? C.w : C.t3, 17);
          const stepDate = getStepDate(visualAuditMap[i]);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minWidth: 0 }}>
              {i > 0 && <div style={{ position: "absolute", top: 15, right: "50%", left: 0, height: 2, background: done || active || isCancelStep ? C.pri : C.b1, zIndex: 0, transform: "translateX(-4px)" }} />}
              {i < 2 && <div style={{ position: "absolute", top: 15, left: "50%", right: 0, height: 2, background: done ? (i + 1 <= visualIdx ? C.pri : C.b1) : C.b1, zIndex: 0, transform: "translateX(4px)" }} />}
              <div style={{
                width: 31, height: 31, borderRadius: R.xl, background: nodeColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1,
                boxShadow: active ? `0 0 0 3px ${vs.color}25` : isCancelStep ? `0 0 0 3px ${C.err}25` : "none",
                transition: "all 0.2s",
              }}>
                {nodeIcon}
              </div>
              <span style={{ fontSize: 13, fontWeight: (active || isCancelStep) ? 700 : done ? 600 : 500, color: (active || isCancelStep) ? vs.color : done ? C.t1 : C.t3, textAlign: "center", lineHeight: 1.2, marginTop: 6 }}>{vs.label}</span>
              {active && vs.sub && <span style={{ fontSize: 11.5, color: C.t3, fontStyle: "italic", textAlign: "center", lineHeight: 1.2, marginTop: 1 }}>({vs.sub})</span>}
              {(done || active || isCancelStep) && stepDate && <span style={{ fontSize: 10.7, color: C.t3, marginTop: 2, textAlign: "center", lineHeight: 1.2 }}>{fmtD(stepDate)}</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ======================== FREIGHT MAP ================================

function infoWindowHtml(title, subtitle, lat, lng, color) {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return `<div style="font-family:${FONT};min-width:160px;max-width:240px">` +
    `<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:2px">${title}</div>` +
    (subtitle ? `<div style="font-size:12px;font-weight:600;color:${color};margin-bottom:6px">${subtitle}</div>` : '') +
    `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:${C.pri};text-decoration:none;padding:4px 0">` +
    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${C.pri}" stroke-width="2.5" stroke-linecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>` +
    `Ver en Google Maps</a></div>`;
}

function FreightMap({ freight, style }) {
  const oLat = freight.originLat != null ? Number(freight.originLat) : null;
  const oLng = freight.originLng != null ? Number(freight.originLng) : null;
  const dLat = freight.destLat != null ? Number(freight.destLat) : null;
  const dLng = freight.destLng != null ? Number(freight.destLng) : null;
  const hasCoords = oLat && oLng && dLat && dLng;

  const originLabel = freight.field?.name || freight.originName || "Origen";
  const destLabel = freight.destPlant?.name ? `${freight.destCompany?.name || freight.destName || "Destino"} — ${freight.destPlant.name}` : (freight.destName || "Destino");
  const producerLabel = freight.producerCompany?.name || null;
  const routeUrl = hasCoords ? `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving` : null;

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!hasCoords) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasCoords]);

  useEffect(() => {
    if (!hasCoords || !visible || loaded) return;
    const key = import.meta.env.VITE_GMAPS_KEY || "";
    if (!key) { setMapError(true); return; }
    const init = () => {
      if (!window.google?.maps || !mapRef.current) return;
      const maps = window.google.maps;
      const map = new maps.Map(mapRef.current, {
        center: { lat: (oLat + dLat) / 2, lng: (oLng + dLng) / 2 }, zoom: 8,
        disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });

      // Shared InfoWindow — only one open at a time
      const iw = new maps.InfoWindow();

      // Origin marker
      const originMarker = new maps.Marker({
        position: { lat: oLat, lng: oLng }, map, title: originLabel,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#22C55E", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      originMarker.addListener("click", () => {
        iw.setContent(infoWindowHtml(originLabel, producerLabel, oLat, oLng, C.acc));
        iw.open(map, originMarker);
      });

      // Destination marker
      const destMarker = new maps.Marker({
        position: { lat: dLat, lng: dLng }, map, title: destLabel,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#F59E0B", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      destMarker.addListener("click", () => {
        iw.setContent(infoWindowHtml(destLabel, null, dLat, dLng, C.t2));
        iw.open(map, destMarker);
      });

      if (freight.routePolyline) {
        new maps.Polyline({ path: decodePolyline(freight.routePolyline), map, strokeColor: C.pri, strokeWeight: 3, strokeOpacity: 0.8 });
      }
      const bounds = new maps.LatLngBounds();
      bounds.extend({ lat: oLat, lng: oLng });
      bounds.extend({ lat: dLat, lng: dLng });
      map.fitBounds(bounds, 40);
      setLoaded(true);
    };
    if (window.google?.maps) { init(); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) { existing.addEventListener("load", init); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, [hasCoords, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback when no coordinates or map error
  if (!hasCoords || mapError) {
    return (
      <Card style={{ textAlign: "center", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 180, ...style }}>
        {Ic.pin(C.pri, 22)}
        <span style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginTop: 10 }}>{originLabel}</span>
        <span style={{ fontSize: 13, color: C.t3, margin: "2px 0" }}>{Ic.nav(C.t3, 12)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{destLabel}</span>
        {freight.routeDistanceKm && (
          <div style={{ fontSize: 12, color: C.pri, fontWeight: 700, marginTop: 8 }}>{freight.routeDistanceKm} km · ~{freight.routeDurationMin} min</div>
        )}
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}>
      <div ref={containerRef} style={{ background: C.w, borderRadius: `${R.lg} ${R.lg} 0 0`, overflow: "hidden", border: `1px solid ${C.b2}`, borderBottom: "none", position: "relative", flex: 1, minHeight: 300 }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 300 }} />
        {!loaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, zIndex: 1 }}>
            <div style={{ fontSize: 13, color: C.t3 }}>Cargando mapa...</div>
          </div>
        )}
        {freight.routeDistanceKm && (
          <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(255,255,255,0.92)", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: C.t1, boxShadow: C.shMd, backdropFilter: "blur(4px)" }}>
            {Ic.nav(C.pri, 13)} {freight.routeDistanceKm} km · ~{freight.routeDurationMin} min
          </div>
        )}
      </div>
      {routeUrl && (
        <a href={routeUrl} target="_blank" rel="noopener noreferrer" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          padding: "10px 16px", background: C.w, border: `1px solid ${C.b2}`,
          borderRadius: `0 0 ${R.lg} ${R.lg}`, textDecoration: "none",
          fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: C.pri,
          cursor: "pointer", transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = C.priPale}
          onMouseLeave={e => e.currentTarget.style.background = C.w}
        >
          {Ic.nav(C.pri, 15)}
          Ver ruta en Google Maps
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.pri} strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      )}
    </div>
  );
}

// ======================== FREIGHT VIEW ===============================
// Mirrors DetailScreen EXACTLY: same section order, same layout

function FreightView({ data, creatorName, lastRefresh, isDesktop, onBack }) {
  const f = data;
  if (!f) return null;
  const grain = f.items?.[0]?.grain || f.grainType || "Producto";
  const tons = f.items?.[0]?.tons || f.tonnage || "—";
  const sc = STATUS_COLORS[f.status] || {};
  const assignments = f.assignments || [];
  const isTerminal = ["finished", "canceled"].includes(f.status);
  const originName = f.field?.name || f.originName || f.originCompany?.name || "—";
  const destName = f.destPlant?.name || f.destName || f.destCompany?.name || "—";

  // Build info rows identical to DetailScreen
  const InfoRow = ({ ic, label, val, isLast }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: isLast ? "none" : `1px solid ${C.b2}` }}>
      <span style={{ display: "flex", flexShrink: 0 }}>{ic}</span>
      <span style={{ fontSize: 13.3, color: C.t2, minWidth: 85 }}>{label}</span>
      <span style={{ fontSize: 13.9, fontWeight: 600, color: C.t1, marginLeft: "auto", textAlign: "right" }}>{val}</span>
    </div>
  );

  const infoRows = [
    [Ic.grain(C.t2, 15), "Producto", `${grain} · ${tons} tn`],
    f.originCompany?.name && [Ic.user(C.pri, 15), "Empresa", f.originCompany.name],
    f.producerCompany?.name && [Ic.user(C.acc, 15), "Productor", f.producerCompany.name],
    [Ic.field(C.ok, 15), "Campo", originName],
    [Ic.plant(C.t2, 15), "Destino", destName],
    [Ic.cal(C.t2, 15), "Fecha carga", f.loadDate ? formatFreightDate(f.loadDate) : fmtDateShort(f.createdAt)],
    f.loadTime && [Ic.clk(C.t2, 15), "Hora carga", f.loadTime],
  ].filter(Boolean);

  return (
    <div>
      {/* 1. Header — identical to DetailScreen sticky header */}
      <div style={{ padding: "18px 0 8px" }}>
        {onBack && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: C.pri, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Volver</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <StatusPill status={f.status} />
          <span style={{ fontSize: 24, fontWeight: 800, color: C.t1, letterSpacing: -0.3 }}>{grain} · {tons} tn</span>
          <span style={{ fontFamily: MONO, fontSize: 14, color: C.t1, marginLeft: 4 }}>{f.code}</span>
          {f.loadDate && <><span style={{ fontSize: 14, color: C.t1 }}>-</span><span style={{ fontSize: 14, color: C.t1 }}>{formatFreightDate(f.loadDate)}</span></>}
        </div>
        {f.producerCompany?.name && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            {Ic.user(C.acc, 13)}
            <span style={{ fontSize: 12.5, color: C.acc, fontWeight: 600 }}>{f.producerCompany.name}</span>
          </div>
        )}
        {!isTerminal && lastRefresh && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 6, fontStyle: "italic" }}>
            Actualizado {timeSince(lastRefresh)}
          </div>
        )}
      </div>

      {/* 2. Truck assignments — identical to DetailScreen "Camiones" section */}
      {assignments.length > 0 && f.status !== "canceled" && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: assignments.length > 0 ? 12 : 0 }}>
            <span style={{ display: "flex" }}>{Ic.truck(C.t2, 16)}</span>
            <span style={{ fontSize: 12.2, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Camiones</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.info }}>{assignments.length} asignado{assignments.length > 1 ? "s" : ""}</span>
          </div>
          {assignments.map(a => {
            const tripSc = STATUS_COLORS[a.tripStatus] || STATUS_COLORS[f.status] || {};
            const tColor = tripSc.ribbon || C.info;
            return (
              <div key={a.id} style={{ display: "flex", borderRadius: R.sm, border: `0.5px solid ${C.b1}`, overflow: "hidden", background: C.w, marginBottom: 8 }}>
                <div style={{ width: 20, background: tColor, flexShrink: 0 }} />
                <div style={{ padding: "8px 10px", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {assignments.length > 1 && <span style={{ fontSize: 12, fontWeight: 500, color: C.t2, marginRight: 2 }}>#{a.tripNumber}</span>}
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.t1 }}>{a.plate || "Sin camión"}</span>
                    {a.transportCompany?.name && <span style={{ fontSize: 12, color: C.t2 }}>- {a.transportCompany.name}</span>}
                    {a.driverName && <span style={{ fontSize: 12, color: C.t2 }}>- {a.driverName}</span>}
                    <span style={{ flex: 1 }} />
                    <StatusPill status={a.tripStatus || f.status} small />
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* 4. Info + Map side by side — identical to DetailScreen layout */}
      <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", gap: 12, marginBottom: 12, alignItems: isDesktop ? "stretch" : undefined }}>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, boxShadow: C.sh, height: "100%", boxSizing: "border-box" }}>
            {infoRows.map(([ic, label, val], i) => <InfoRow key={i} ic={ic} label={label} val={val} isLast={i === infoRows.length - 1} />)}
          </div>
        </div>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <FreightMap freight={f} />
        </div>
      </div>

      {/* 5. Notes — if present */}
      {f.notes && (
        <div style={{ background: C.warnPale, border: `1px solid ${C.warn}30`, borderLeft: `3px solid ${C.warn}`, borderRadius: R.lg, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {Ic.doc(C.warn, 14)}
            <span style={{ fontSize: 12.2, fontWeight: 700, color: C.warn, textTransform: "uppercase", letterSpacing: 0.5 }}>Observaciones</span>
          </div>
          <div style={{ fontSize: 14.5, color: C.t1, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{f.notes}</div>
        </div>
      )}

      {/* 6. Progress stepper — at the bottom */}
      <ProgressStepper freight={f} auditLogs={f.auditLogs} />
    </div>
  );
}

// ======================== TICKET VIEW ================================

function TicketView({ data, creatorName, onViewFreight }) {
  if (!data) return null;
  const [photoExpanded, setPhotoExpanded] = useState(false);

  return (
    <div>
      <Card style={{ textAlign: "center", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {Ic.doc(C.pri, 24)}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Comprobante de Pesaje</div>
        {data.ticketNumber && <div style={{ fontFamily: MONO, fontSize: 14, color: C.t3 }}>#{data.ticketNumber}</div>}
        {data.registeredAt && <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{fmtDate(data.registeredAt)}</div>}
      </Card>

      <Card>
        <SectionLabel icon={Ic.grain(C.pri, 14)} label="Pesaje" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {data.grossWeight != null && <WeightCell label="Peso Bruto" value={fmtWeight(data.grossWeight)} />}
          {data.tareWeight != null && <WeightCell label="Tara" value={fmtWeight(data.tareWeight)} />}
          {data.netWeight != null && <WeightCell label="Peso Neto" value={fmtWeight(data.netWeight)} highlight />}
        </div>
        {data.humidity != null && (
          <div style={{ marginTop: 10, padding: "6px 10px", background: C.bg, borderRadius: R.md, fontSize: 12.5 }}>
            <span style={{ color: C.t3, fontWeight: 600 }}>Humedad: </span>
            <span style={{ color: C.t1, fontWeight: 700 }}>{Number(data.humidity)}%</span>
          </div>
        )}
      </Card>

      {data.photoUrl && (
        <Card style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={() => setPhotoExpanded(!photoExpanded)}>
          <img src={data.photoUrl} alt="Ticket de pesaje" style={{ width: "100%", maxHeight: photoExpanded ? "none" : 300, objectFit: photoExpanded ? "contain" : "cover", background: C.bg, transition: "max-height 0.3s" }} />
          {!photoExpanded && (
            <div style={{ padding: "8px 14px", fontSize: 11, color: C.t3, textAlign: "center", borderTop: `1px solid ${C.b2}` }}>
              {Ic.expand(C.t3, 12)} Tocar para ampliar
            </div>
          )}
        </Card>
      )}

      {data.ocrData && (() => {
        const ocr = typeof data.ocrData === "string" ? JSON.parse(data.ocrData) : data.ocrData;
        const fields = ocr?.datos || ocr?.data || ocr || {};
        const entries = Object.entries(fields).filter(([k, v]) => v != null && v !== "" && !k.startsWith("_") && k !== "rawFields");
        if (entries.length === 0) return null;
        return (
          <Card>
            <SectionLabel icon={Ic.doc(C.acc, 14)} label="Datos extraídos (OCR)" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {entries.map(([k, v]) => (
                <div key={k} style={{ padding: "6px 10px", borderRadius: R.md, background: C.bg }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Linked freight — real FreightCard, click navigates to detail */}
      {data.freight && (
        <div style={{ marginTop: 4 }}>
          <SectionLabel icon={Ic.truck(C.pri, 14)} label="Flete asociado" />
          <FreightCard freight={mapApiFreightToCard(data.freight)} onClick={onViewFreight ? () => onViewFreight(data.freight) : undefined} />
        </div>
      )}
    </div>
  );
}

// ======================== PORTAL VIEW ================================
// Mirrors HomeScreen metrics + ListScreen freight list. Full width.

function PortalView({ data, creatorName, targetName, onSelectFreight }) {
  if (!data) return null;
  const [statusFilter, setStatusFilter] = useState("all");

  const freights = data.freights || [];
  const filteredFreights = useMemo(() => {
    if (statusFilter === "all") return freights;
    return freights.filter(f => f.status === statusFilter);
  }, [freights, statusFilter]);

  const statusOptions = useMemo(() => {
    const counts = {};
    freights.forEach(f => { counts[f.status] = (counts[f.status] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({ key: k, label: (STATUS_COLORS[k]?.label || k), count: v }));
  }, [freights]);

  return (
    <div>
      {/* Metric cards — full width grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <MetricCard value={data.totalFreights || 0} label="Fletes totales" color={C.pri} icon={Ic.truck(C.pri, 22)} />
        <MetricCard value={data.activeFreights || 0} label="Activos" color={C.acc} icon={Ic.nav(C.acc, 22)} />
        <MetricCard value={data.totalTons != null ? `${Number(data.totalTons).toLocaleString("es-UY")}` : "—"} label="Toneladas totales" color={C.sec} icon={Ic.grain(C.sec, 22)} />
      </div>

      {/* Status filter pills */}
      {statusOptions.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label={`Todos (${freights.length})`} />
          {statusOptions.map(o => (
            <FilterPill key={o.key} active={statusFilter === o.key} onClick={() => setStatusFilter(o.key)} label={`${o.label} (${o.count})`} color={STATUS_COLORS[o.key]?.ribbon} />
          ))}
        </div>
      )}

      {/* Freight list — real FreightCard, click navigates to detail */}
      {filteredFreights.length === 0 ? (
        <EmptyState
          icon={Ic.truck(C.t3, 28)}
          title={`Sin fletes${statusFilter !== "all" ? " en este estado" : ""}`}
          subtitle="No hay fletes para mostrar"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredFreights.map(f => (
            <FreightCard
              key={f.id}
              freight={mapApiFreightToCard(f)}
              onClick={() => onSelectFreight && onSelectFreight(f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ======================== ERROR VIEW =================================

function ErrorView({ error }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.errPale, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, marginBottom: 8 }}>Este link ya no está disponible</div>
      <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.6, maxWidth: 340, margin: "0 auto 24px" }}>
        {error === "Este link ha expirado"
          ? "El link ha expirado. Contactá a quien te lo compartió para obtener uno nuevo."
          : error === "Este link fue revocado"
          ? "El link fue revocado por su creador. Solicitá uno nuevo."
          : "El link puede haber expirado o sido revocado. Contactá a quien te lo compartió."}
      </div>
      <a href="https://tolvink.com" style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 24px",
        borderRadius: R.lg, background: C.pri, color: "#fff", textDecoration: "none",
        fontFamily: "inherit", fontSize: 14, fontWeight: 700,
      }}>
        Ir a Tolvink {Ic.nav("#fff", 14)}
      </a>
    </div>
  );
}

// ======================== PUBLIC HEADER ===============================

function PublicHeader({ data }) {
  const subtitle = data
    ? (data.linkType === "FREIGHT" ? "Seguimiento de Flete"
      : data.linkType === "TICKET" ? "Comprobante de Pesaje"
      : `Portal de ${data.targetCompanyName || "empresa"}`)
    : "";

  return (
    <div style={{
      background: C.w, borderBottom: `1px solid ${C.b2}`, padding: "0 20px",
      height: 56, display: "flex", alignItems: "center", gap: 12, boxShadow: C.sh,
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "inline-flex", alignItems: "flex-start", flexShrink: 0 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: C.pri, letterSpacing: -1, lineHeight: 1 }}>tolvink</span>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: C.acc, display: "inline-block", marginLeft: 2, marginTop: 2, animation: "dotPulse 1.5s ease-in-out infinite" }} />
      </div>
      {data?.creatorCompanyName && <div style={{ width: 1, height: 24, background: C.b2, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {data?.creatorCompanyName && (
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.creatorCompanyName}
          </div>
        )}
        {subtitle && <div style={{ fontSize: 11, color: C.t3, fontWeight: 500 }}>{subtitle}</div>}
      </div>
      <div className="tv-shared-badge" style={{
        display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
        borderRadius: R.md, background: C.priPale, flexShrink: 0,
      }}>
        {Ic.share(C.pri, 13)}
        <span style={{ fontSize: 11, fontWeight: 700, color: C.pri }}>Vista compartida</span>
      </div>
    </div>
  );
}

// ======================== PUBLIC FOOTER ==============================

function PublicFooter({ creatorName }) {
  return (
    <div style={{
      textAlign: "center", padding: "24px 20px 32px", borderTop: `1px solid ${C.b2}`,
      marginTop: 24, background: C.w,
    }}>
      {creatorName && (
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>
          Compartido por <span style={{ fontWeight: 600 }}>{creatorName}</span> vía tolvink
        </div>
      )}
      <a href="https://tolvink.com" style={{
        fontSize: 12.5, color: C.t3, textDecoration: "none", fontWeight: 500,
        display: "inline-flex", alignItems: "baseline", gap: 5,
      }}>
        <span>¿Querés gestionar tu logística? Conocé</span>
        <span style={{ display: "inline-flex", alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.pri, letterSpacing: -0.7, lineHeight: 1 }}>tolvink</span>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: C.acc, display: "inline-block", marginLeft: 1.5, marginTop: 1, animation: "dotPulse 1.5s ease-in-out infinite" }} />
        </span>
      </a>
    </div>
  );
}

// ======================== HELPERS ====================================

function WeightCell({ label, value, highlight }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 6px", borderRadius: R.md, background: highlight ? C.priPale : C.bg }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? C.pri : C.t1 }}>{value}</div>
    </div>
  );
}

function mapApiFreightToCard(f) {
  const assignment = f.assignments?.[0];
  const grain = f.items?.[0]?.grain || f.grainType || "Producto";
  const tons = f.items?.[0]?.tons || f.tonnage || 0;
  return {
    id: f.id,
    code: f.code || "",
    status: f.status || "pending_assignment",
    grain,
    tons,
    unit: f.unit || "toneladas",
    originCompanyName: f.originCompany?.name || f.originName || "",
    originFieldName: f.field?.name,
    originBranchName: f.originBranch?.name,
    destPlantId: f.destPlant?.id || f.destPlantId,
    destPlantName: f.destPlant?.name,
    destBranchName: f.destBranch?.name,
    destLat: f.destLat,
    destLng: f.destLng,
    destName: f.destName,
    transporterName: assignment?.transportCompany?.name || "Sin asignar",
    truckPlate: assignment?.plate,
    driverName: assignment?.driverName,
    loadDate: f.loadDate,
    loadTime: f.loadTime,
    producerCompanyName: f.producerCompany?.name,
  };
}

// ======================== MAIN COMPONENT =============================

export default function SharedLinkScreen({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshRef = useRef(null);
  const isDesktop = useIsDesktop(768);

  // Navigation: portal can drill into freight detail
  const [selectedFreight, setSelectedFreight] = useState(null);

  const handleSelectFreight = useCallback((f) => {
    setSelectedFreight(f);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedFreight(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }
    let mounted = true;

    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[property="${name}"],meta[name="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(name.startsWith("og:") ? "property" : "name", name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("robots", "noindex, nofollow");
    setMeta("og:image", "/icon-192.png");

    const load = async () => {
      try {
        const result = await apiResolveSharedLink(token);
        if (!mounted) return;
        if (!result.valid) {
          setError(result.reason === "expired" ? "Este link ha expirado" : result.reason === "revoked" ? "Este link fue revocado" : "Link no encontrado");
        } else {
          setData(result);
          setLastRefresh(new Date());
          if (result.linkType === "FREIGHT" && result.data?.code) {
            document.title = `Seguimiento ${result.data.code} — Tolvink`;
            setMeta("og:title", `Seguimiento de Flete ${result.data.code} — Tolvink`);
            setMeta("og:description", "Seguí el estado de tu flete en tiempo real");
          } else if (result.linkType === "TICKET") {
            document.title = "Comprobante de Pesaje — Tolvink";
            setMeta("og:title", "Comprobante de Pesaje — Tolvink");
            setMeta("og:description", "Comprobante de pesaje compartido vía Tolvink");
          } else if (result.linkType === "PORTAL") {
            document.title = `Portal de ${result.targetCompanyName || "empresa"} — Tolvink`;
            setMeta("og:title", `Portal de ${result.targetCompanyName || "empresa"} — Tolvink`);
            setMeta("og:description", "Portal de seguimiento de fletes");
          }
        }
      } catch {
        if (mounted) setError("Error al cargar");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    // Auto-refresh every 30s, stops for terminal states
    refreshRef.current = setInterval(() => {
      if (document.hidden) return;
      apiResolveSharedLink(token).then(r => {
        if (!mounted || !r.valid) return;
        setData(r);
        setLastRefresh(new Date());
        if (r.linkType === "FREIGHT" && ["finished", "canceled"].includes(r.data?.status)) {
          clearInterval(refreshRef.current);
        }
      }).catch(() => {});
    }, 30000);

    return () => { mounted = false; clearInterval(refreshRef.current); };
  }, [token]);

  // Enable natural scroll (index.html + app.css lock body for the auth shell)
  useEffect(() => {
    const root = document.getElementById("root");
    const saved = {
      htmlH: document.documentElement.style.height, htmlO: document.documentElement.style.overflow,
      bodyH: document.body.style.height, bodyO: document.body.style.overflow, bodyOY: document.body.style.overflowY,
      bodyPos: document.body.style.position, bodyW: document.body.style.width,
      rootH: root?.style.height, rootO: root?.style.overflow,
    };
    document.documentElement.style.height = "auto";
    document.documentElement.style.overflow = "visible";
    document.body.style.height = "auto";
    document.body.style.overflow = "visible";
    document.body.style.overflowY = "auto";
    document.body.style.position = "static";
    document.body.style.width = "100%";
    if (root) { root.style.height = "auto"; root.style.overflow = "visible"; }
    return () => {
      document.documentElement.style.height = saved.htmlH;
      document.documentElement.style.overflow = saved.htmlO;
      document.body.style.height = saved.bodyH;
      document.body.style.overflow = saved.bodyO;
      document.body.style.overflowY = saved.bodyOY;
      document.body.style.position = saved.bodyPos;
      document.body.style.width = saved.bodyW;
      if (root) { root.style.height = saved.rootH; root.style.overflow = saved.rootO; }
    };
  }, []);

  // Determine what view to render
  const showFreightDetail = selectedFreight || (data?.linkType === "FREIGHT");
  const freightData = selectedFreight || (data?.linkType === "FREIGHT" ? data?.data : null);

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes tolvinkPulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes dotPulse{0%,100%{opacity:.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tv-card:hover{box-shadow:0 2px 8px rgba(0,0,0,0.08)}
        @media print{
          .tv-shared-badge{display:none!important}
          body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        }
        @media(max-width:480px){
          .tv-shared-badge span{display:none}
        }
      `}</style>

      <PublicHeader data={data} />

      <main style={{ flex: 1, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
        {loading && (
          <div style={{ padding: "60px 0" }}>
            <Loader />
          </div>
        )}

        {error && <ErrorView error={error} />}

        {/* Freight detail — direct link or drilled down from portal/ticket */}
        {!loading && !error && showFreightDetail && (
          <FreightView
            data={freightData}
            creatorName={data?.creatorCompanyName}
            lastRefresh={lastRefresh}
            isDesktop={isDesktop}
            onBack={selectedFreight ? handleBack : null}
          />
        )}

        {/* Portal list — only when no freight is selected */}
        {!loading && !error && data?.linkType === "PORTAL" && !selectedFreight && (
          <PortalView
            data={data.data}
            creatorName={data.creatorCompanyName}
            targetName={data.targetCompanyName}
            onSelectFreight={handleSelectFreight}
          />
        )}

        {/* Ticket — only when no freight is selected */}
        {!loading && !error && data?.linkType === "TICKET" && !selectedFreight && (
          <TicketView
            data={data.data}
            creatorName={data.creatorCompanyName}
            onViewFreight={data.data?.freight ? (f) => handleSelectFreight(f) : null}
          />
        )}
      </main>

      {!loading && <PublicFooter creatorName={data?.creatorCompanyName} />}
    </div>
  );
}
