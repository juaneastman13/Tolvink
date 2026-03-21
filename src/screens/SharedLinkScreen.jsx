import { useState, useEffect, useRef, useMemo } from "react";
import { C, Ic, FONT, MONO, R, STATUS_COLORS } from "../theme";
import { FreightCard, StatusPill } from "../components/FreightCard";
import { Loader, EmptyState } from "../components";
import { apiResolveSharedLink } from "../api";

// =====================================================================
// TOLVINK — SharedLinkScreen (Public)
// Visually identical to the authenticated app, reusing real components.
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

// ---------- Shared layout components ----------

function Card({ children, style }) {
  return (
    <div style={{ background: C.w, borderRadius: R.lg, padding: 18, marginBottom: 12, border: `1px solid ${C.b2}`, boxShadow: C.sh, ...style }}>
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

function InfoCell({ label, value, bold, mono }) {
  return (
    <div style={{ padding: "6px 10px", borderRadius: R.md, background: C.bg }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: C.t1, fontFamily: mono ? MONO : "inherit" }}>{value || "—"}</div>
    </div>
  );
}

function WeightCell({ label, value, highlight }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 6px", borderRadius: R.md, background: highlight ? C.priPale : C.bg }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? C.pri : C.t1 }}>{value}</div>
    </div>
  );
}

function MetricCard({ value, label, color, icon }) {
  return (
    <div style={{
      flex: "1 1 100px", background: C.w, borderRadius: R.lg, padding: "18px 14px",
      border: `1px solid ${C.b2}`, boxShadow: C.sh, textAlign: "center", minWidth: 0,
    }}>
      {icon && <div style={{ marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 28, fontWeight: 800, color: color || C.pri, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t3, marginTop: 2 }}>{label}</div>
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

// ======================== STATUS TIMELINE =============================
// Identical to DetailScreen audit timeline visual pattern

const STATUS_STEPS = [
  { key: "pending_assignment", label: "Solicitado", icon: (c) => Ic.clk(c, 14) },
  { key: "assigned", label: "Asignado", icon: (c) => Ic.truck(c, 14) },
  { key: "accepted", label: "Aceptado", icon: (c) => Ic.chk(c, 14) },
  { key: "in_progress", label: "A campo", icon: (c) => Ic.nav(c, 14) },
  { key: "loaded", label: "A planta", icon: (c) => Ic.grain(c, 14) },
  { key: "finished", label: "Finalizado", icon: (c) => Ic.chk(c, 14) },
];

function StatusTimeline({ freight, auditLogs }) {
  const currentIdx = STATUS_STEPS.findIndex(s => s.key === freight.status);
  const logMap = {};
  for (const log of (auditLogs || [])) {
    const key = log.toValue || log.action;
    if (!logMap[key]) logMap[key] = log.createdAt;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {STATUS_STEPS.map((step, i) => {
        const sc = STATUS_COLORS[step.key] || {};
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const date = logMap[step.key] || (step.key === "pending_assignment" ? freight.createdAt : null);
        const color = reached ? (sc.ribbon || C.pri) : C.b2;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
              <div style={{
                width: isCurrent ? 28 : 22, height: isCurrent ? 28 : 22, borderRadius: "50%",
                background: reached ? color : C.bg, border: `2px solid ${reached ? color : C.b2}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isCurrent ? `0 0 0 4px ${color}20` : "none",
                transition: "all 0.2s",
              }}>
                {reached ? (i < currentIdx ? Ic.chk("#fff", 12) : step.icon("#fff")) : step.icon(C.t3)}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div style={{
                  width: 2, height: 24,
                  background: reached && i < currentIdx ? color : C.b2,
                  borderRadius: R.xs,
                }} />
              )}
            </div>
            <div style={{ paddingBottom: 8, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: isCurrent ? 700 : reached ? 600 : 400, color: reached ? C.t1 : C.t3 }}>
                {step.label}
              </div>
              {date && reached && (
                <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>{fmtDate(date)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ======================== FREIGHT MAP ================================

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
    const existing = document.getElementById("gm-shared");
    const init = () => {
      if (!window.google?.maps || !mapRef.current) return;
      const maps = window.google.maps;
      const map = new maps.Map(mapRef.current, {
        center: { lat: (oLat + dLat) / 2, lng: (oLng + dLng) / 2 }, zoom: 8,
        disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });
      new maps.Marker({ position: { lat: oLat, lng: oLng }, map, title: freight.originName || "Origen",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#22C55E", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      new maps.Marker({ position: { lat: dLat, lng: dLng }, map, title: freight.destName || "Destino",
        icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#F59E0B", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      if (freight.routePolyline) {
        new maps.Polyline({ path: decodePolyline(freight.routePolyline), map, strokeColor: C.pri, strokeWeight: 3, strokeOpacity: 0.8 });
      }
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
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mapError) {
    return (
      <Card style={{ textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {Ic.pin(C.pri, 16)}
          <span style={{ fontSize: 13, color: C.t2 }}>{freight.originName || "Origen"} → {freight.destName || "Destino"}</span>
        </div>
        {freight.routeDistanceKm && (
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{freight.routeDistanceKm} km · ~{freight.routeDurationMin} min</div>
        )}
      </Card>
    );
  }

  return (
    <div ref={containerRef} style={{ background: C.w, borderRadius: R.lg, overflow: "hidden", marginBottom: 12, border: `1px solid ${C.b2}`, boxShadow: C.sh, position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: 280 }}>
        {!loaded && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: C.bg }}>
            <div style={{ fontSize: 13, color: C.t3 }}>Cargando mapa...</div>
          </div>
        )}
      </div>
      {freight.routeDistanceKm && (
        <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(255,255,255,0.92)", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: C.t1, boxShadow: C.shMd, backdropFilter: "blur(4px)" }}>
          {Ic.nav(C.pri, 13)} {freight.routeDistanceKm} km · ~{freight.routeDurationMin} min
        </div>
      )}
    </div>
  );
}

// ======================== FREIGHT VIEW ===============================
// Mirrors DetailScreen: StatusPill hero, route card, map, info grid, timeline

function FreightView({ data, creatorName, lastRefresh }) {
  const f = data;
  if (!f) return null;
  const grain = f.items?.[0]?.grain || f.grainType || "Producto";
  const tons = f.items?.[0]?.tons || f.tonnage || "—";
  const sc = STATUS_COLORS[f.status] || {};
  const assignment = f.assignments?.[0];
  const isTerminal = ["finished", "canceled"].includes(f.status);

  return (
    <div>
      {/* Hero — identical to DetailScreen header */}
      <Card style={{ borderLeft: `4px solid ${sc.ribbon || C.t3}`, padding: "20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <StatusPill status={f.status} />
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.t3 }}>{f.code}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, letterSpacing: -0.5 }}>
          {grain} · {tons} tn
        </div>
        {f.loadDate && <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{fmtDateShort(f.loadDate)}</div>}
        {!isTerminal && lastRefresh && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 8, fontStyle: "italic" }}>
            Actualizado {timeSince(lastRefresh)}
          </div>
        )}
      </Card>

      {/* Origin → Destination route */}
      <Card>
        <SectionLabel icon={Ic.pin(C.pri, 14)} label="Ruta" />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", border: "2px solid #fff", boxShadow: "0 0 0 2px #22C55E" }} />
            <div style={{ width: 2, height: 20, background: C.b2, borderRadius: R.xs }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", border: "2px solid #fff", boxShadow: "0 0 0 2px #F59E0B" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>Origen</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.t1 }}>{f.field?.name || f.originName || f.originCompany?.name || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>Destino</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.t1 }}>{f.destPlant?.name || f.destName || f.destCompany?.name || "—"}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Map */}
      <FreightMap freight={f} />

      {/* Truck / Assignment — mirrors DetailScreen truck cards */}
      {assignment && (
        <Card style={{ borderLeft: `3px solid ${sc.ribbon || C.info}` }}>
          <SectionLabel icon={Ic.truck(C.info, 14)} label="Transporte" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: sc.ribbon ? `${sc.ribbon}18` : C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {Ic.truck(sc.ribbon || C.info, 18)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {assignment.plate && <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{assignment.plate}</span>}
                {assignment.driverName && <span style={{ fontSize: 13, color: C.t2 }}>{assignment.driverName}</span>}
              </div>
              {assignment.transportCompany?.name && (
                <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{assignment.transportCompany.name}</div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Info grid — identical pattern to DetailScreen */}
      <Card>
        <SectionLabel icon={Ic.doc(C.pri, 14)} label="Información" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InfoCell label="Producto" value={grain} />
          <InfoCell label="Toneladas" value={`${tons} tn`} bold />
          {f.originCompany?.name && <InfoCell label="Empresa" value={f.originCompany.name} />}
          {f.field?.name && <InfoCell label="Campo" value={f.field.name} />}
          <InfoCell label="Creado" value={fmtDateShort(f.createdAt)} />
          {f.loadDate && <InfoCell label="Fecha carga" value={fmtDateShort(f.loadDate)} />}
        </div>
      </Card>

      {/* Timeline */}
      <Card>
        <SectionLabel icon={Ic.clk(C.pri, 14)} label="Seguimiento" />
        <StatusTimeline freight={f} auditLogs={f.auditLogs} />
      </Card>
    </div>
  );
}

// ======================== TICKET VIEW ================================
// Mirrors DocumentsScreen layout for weigh ticket display

function TicketView({ data, creatorName }) {
  if (!data) return null;
  const [photoExpanded, setPhotoExpanded] = useState(false);

  return (
    <div>
      {/* Header card */}
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

      {/* Weights */}
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

      {/* Photo — expandable */}
      {data.photoUrl && (
        <Card style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={() => setPhotoExpanded(!photoExpanded)}>
          <img
            src={data.photoUrl}
            alt="Ticket de pesaje"
            style={{
              width: "100%",
              maxHeight: photoExpanded ? "none" : 300,
              objectFit: photoExpanded ? "contain" : "cover",
              background: C.bg,
              transition: "max-height 0.3s",
            }}
          />
          {!photoExpanded && (
            <div style={{ padding: "8px 14px", fontSize: 11, color: C.t3, textAlign: "center", borderTop: `1px solid ${C.b2}` }}>
              {Ic.expand(C.t3, 12)} Tocar para ampliar
            </div>
          )}
        </Card>
      )}

      {/* OCR data */}
      {data.ocrData && (() => {
        const ocr = typeof data.ocrData === "string" ? JSON.parse(data.ocrData) : data.ocrData;
        const fields = ocr?.datos || ocr?.data || ocr || {};
        const entries = Object.entries(fields).filter(([k, v]) => v != null && v !== "" && !k.startsWith("_") && k !== "rawFields");
        if (entries.length === 0) return null;
        return (
          <Card>
            <SectionLabel icon={Ic.doc(C.acc, 14)} label="Datos extraídos (OCR)" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {entries.map(([k, v]) => <InfoCell key={k} label={k} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />)}
            </div>
          </Card>
        );
      })()}

      {/* Linked freight — uses real FreightCard */}
      {data.freight && (
        <div style={{ marginTop: 4 }}>
          <SectionLabel icon={Ic.truck(C.pri, 14)} label="Flete asociado" />
          <FreightCard freight={mapApiFreightToCard(data.freight)} />
        </div>
      )}
    </div>
  );
}

// ======================== PORTAL VIEW ================================
// Mirrors HomeScreen metrics + ListScreen freight cards

function PortalView({ data, creatorName, targetName }) {
  if (!data) return null;
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

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
      {/* Metric cards — identical to HomeScreen */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <MetricCard value={data.totalFreights || 0} label="Fletes totales" color={C.pri} icon={Ic.truck(C.pri, 22)} />
        <MetricCard value={data.activeFreights || 0} label="Activos" color={C.acc} icon={Ic.nav(C.acc, 22)} />
        <MetricCard value={data.totalTons != null ? `${Number(data.totalTons).toLocaleString("es-UY")}` : "—"} label="Toneladas" color={C.sec} icon={Ic.grain(C.sec, 22)} />
      </div>
      {data.lastFreightAt && (
        <div style={{ fontSize: 12, color: C.t3, textAlign: "center", marginBottom: 16 }}>
          Último flete: {fmtDate(data.lastFreightAt)}
        </div>
      )}

      {/* Status filter pills — same as ListScreen */}
      {statusOptions.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label={`Todos (${freights.length})`} />
          {statusOptions.map(o => (
            <FilterPill key={o.key} active={statusFilter === o.key} onClick={() => setStatusFilter(o.key)} label={`${o.label} (${o.count})`} color={STATUS_COLORS[o.key]?.ribbon} />
          ))}
        </div>
      )}

      {/* Freight list — uses real FreightCard */}
      {filteredFreights.length === 0 ? (
        <EmptyState
          icon={Ic.truck(C.t3, 28)}
          title={`Sin fletes${statusFilter !== "all" ? " en este estado" : ""}`}
          subtitle="No hay fletes para mostrar"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredFreights.map(f => {
            const cardF = mapApiFreightToCard(f);
            const isExp = expandedId === f.id;
            const assignment = f.assignments?.[0];
            const grain = f.items?.[0]?.grain || f.grainType || "";
            const tons = f.items?.[0]?.tons || f.tonnage || "";
            return (
              <div key={f.id}>
                <FreightCard
                  freight={cardF}
                  onClick={() => setExpandedId(isExp ? null : f.id)}
                  style={{ borderRadius: isExp ? `${R.sm}px ${R.sm}px 0 0` : undefined }}
                />
                {isExp && (
                  <div style={{
                    background: C.w, borderRadius: `0 0 ${R.sm}px ${R.sm}px`,
                    border: `0.5px solid ${C.b1}`, borderTop: `1px solid ${C.b2}`,
                    padding: "12px 16px",
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {grain && <InfoCell label="Producto" value={grain} />}
                      {tons && <InfoCell label="Toneladas" value={`${tons} tn`} bold />}
                      {assignment?.transportCompany?.name && <InfoCell label="Transporte" value={assignment.transportCompany.name} />}
                      {assignment?.plate && <InfoCell label="Patente" value={assignment.plate} mono />}
                      {assignment?.driverName && <InfoCell label="Chofer" value={assignment.driverName} />}
                      <InfoCell label="Creado" value={fmtDateShort(f.createdAt)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
        fontFamily: "inherit", fontSize: 14, fontWeight: 700, transition: "opacity 0.15s",
      }}>
        Ir a Tolvink {Ic.nav("#fff", 14)}
      </a>
    </div>
  );
}

// ======================== PUBLIC HEADER ===============================
// Identical to app header: same height (56px), logo, background, shadow

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
      {/* Logo — identical to Sidebar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {Ic.seedling(C.pri, 26)}
        <span style={{ fontSize: 22, fontWeight: 800, color: C.pri, letterSpacing: -0.8 }}>tolvink</span>
      </div>

      {/* Separator */}
      {data?.creatorCompanyName && <div style={{ width: 1, height: 24, background: C.b2, flexShrink: 0 }} />}

      {/* Company name + subtitle */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {data?.creatorCompanyName && (
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.creatorCompanyName}
          </div>
        )}
        {subtitle && (
          <div style={{ fontSize: 11, color: C.t3, fontWeight: 500 }}>{subtitle}</div>
        )}
      </div>

      {/* Badge — same style as app badges */}
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
          Compartido por <span style={{ fontWeight: 600 }}>{creatorName}</span> vía Tolvink
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
        {Ic.seedling(C.pri, 18)}
        <span style={{ fontSize: 14, fontWeight: 700, color: C.pri }}>tolvink</span>
      </div>
      <a href="https://tolvink.com" style={{
        fontSize: 12.5, color: C.pri, textDecoration: "none", fontWeight: 600,
        display: "inline-flex", alignItems: "center", gap: 4,
      }}>
        ¿Querés gestionar tu logística? Conocé Tolvink
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.pri} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </a>
    </div>
  );
}

// ======================== HELPERS ====================================

// Map API freight shape (from shared-links backend) to FreightCard expected shape
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

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }
    let mounted = true;

    // Set meta tags
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
          // Dynamic meta tags
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

    // Auto-refresh every 30s (cleared if terminal)
    refreshRef.current = setInterval(() => {
      if (document.hidden) return;
      apiResolveSharedLink(token).then(r => {
        if (!mounted || !r.valid) return;
        setData(r);
        setLastRefresh(new Date());
        // Stop polling if terminal
        if (r.linkType === "FREIGHT" && ["finished", "canceled"].includes(r.data?.status)) {
          clearInterval(refreshRef.current);
        }
      }).catch(() => {});
    }, 30000);

    return () => { mounted = false; clearInterval(refreshRef.current); };
  }, [token]);

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes tolvinkPulse{0%,100%{opacity:1}50%{opacity:.3}}
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

      {/* Header — identical to app header */}
      <PublicHeader data={data} />

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 600, width: "100%", margin: "0 auto", padding: "20px 16px 0" }}>
        {loading && (
          <div style={{ padding: "60px 0" }}>
            <Loader />
          </div>
        )}

        {error && <ErrorView error={error} />}

        {data && data.linkType === "FREIGHT" && (
          <FreightView data={data.data} creatorName={data.creatorCompanyName} lastRefresh={lastRefresh} />
        )}
        {data && data.linkType === "TICKET" && (
          <TicketView data={data.data} creatorName={data.creatorCompanyName} />
        )}
        {data && data.linkType === "PORTAL" && (
          <PortalView data={data.data} creatorName={data.creatorCompanyName} targetName={data.targetCompanyName} />
        )}
      </div>

      {/* Footer */}
      {!loading && <PublicFooter creatorName={data?.creatorCompanyName} />}
    </div>
  );
}
