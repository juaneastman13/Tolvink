import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { C, Ic, FONT, MONO, R, STATUS_COLORS } from "../theme";
import { stCfg, formatFreightDate } from "../constants";
import { Bd, Btn, Select, SortTh, Tabs, exportExcel, exportCSV, SkeletonList, EmptyState, ErrorBoundary, FreightCard, FreightCardCompact } from "../components";
import { useTableSort, usePullToRefresh, mapFreight, originDisplay, destDisplay } from "../hooks";
import { useAccessLevel } from "../hooks/useAccessLevel";
import { getPendingActions, getWaitingOnText, resolveUserTypeForFreight } from "../utils/freight-helpers";
import { apiListFreights } from "../api";
const FreightsOverviewMap = lazy(() => import("../maps").then(m => ({ default: m.FreightsOverviewMap })));

const GROUPS = [
  { key:"solicitado", label:"Pendiente", color:STATUS_COLORS.pending_assignment.ribbon, icon:Ic.warn, statuses:["draft","pending_assignment"] },
  { key:"en_curso", label:"En curso", color:STATUS_COLORS.in_progress.ribbon, icon:Ic.nav, statuses:["assigned","accepted","in_progress","loaded"] },
  { key:"finalizados", label:"Finalizados", color:STATUS_COLORS.finished.ribbon, icon:Ic.chk, statuses:["finished"] },
  { key:"cancelados", label:"Cancelados", color:STATUS_COLORS.canceled.ribbon, icon:Ic.ban, statuses:["canceled"] },
];

// Entity grouping configs per user type
const ENTITY_GROUPS = {
  producer:     [{ key:"transportista", label:"Transportista", field:"transporterName", fallback:"Sin asignar", icon:"truck", clr:"info" }, { key:"planta", label:"Planta", field:"destName", fallback:"Sin destino", icon:"plant", clr:"ok" }],
  plant:        [{ key:"transportista", label:"Transportista", field:"transporterName", fallback:"Sin asignar", icon:"truck", clr:"info" }, { key:"productor", label:"Productor", field:"originCompanyName", fallback:"Sin productor", icon:"user", clr:"pri" }],
  transporter:  [{ key:"planta", label:"Planta", field:"destName", fallback:"Sin destino", icon:"plant", clr:"ok" }],
};

// Table sort column getters
const SORT_GETTERS = {
  code:        f => f.code,
  status:      f => f.status,
  product:     f => (f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain),
  company:     f => f.originCompanyName || f.originName || "",
  dest:        f => f.destName || "",
  date:        f => f.loadDate || "",
  time:        f => f.loadTime || "",
  transporter: f => f.transporterName || "",
  plate:       f => f.truckPlate || "",
  driver:      f => f.driverName || "",
  phone:       f => f.driverPhone || "",
};

const MESES_K = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtKanbanDate(dateStr, timeStr) {
  if (!dateStr) return "";
  const p = dateStr.split("-");
  if (p.length < 3) return dateStr;
  const base = `${p[2].padStart(2,"0")}/${MESES_K[parseInt(p[1],10)-1]||p[1]}`;
  return timeStr?.trim() ? `${base} ${timeStr.trim().slice(0,5)}` : base;
}

export default memo(function ListScreen({ freights, loading, onNav, onRefresh, catalog, view, setView, goToMap, hasMore, loadMore, loadingMore, total, isDesktop, onAction, user, simpleMode, statusCounts }) {
  const [sp] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQ, setSearchQ] = useState(sp.get("search") || "");
  const [segExpanded, setSegExpanded] = useState({});
  const [fPlant, setFPlant] = useState("");
  const [fProducer, setFProducer] = useState("");
  const [fTransporter, setFTransporter] = useState("");
  const [fProducerCompany, setFProducerCompany] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [mapShown, setMapShown] = useState(false);
  // Kanban grouping: "status" (default) or entity key
  const [kanbanGroup, setKanbanGroup] = useState(null);
  // Table status filter
  const [tableStatusFilter, setTableStatusFilter] = useState("all");
  // "Requiere mi acción" filter
  const [filterRequiresAction, setFilterRequiresAction] = useState(false);
  const { isConsulta } = useAccessLevel(user);

  // Server-side filtering state
  const [serverData, setServerData] = useState(null); // null = use freights prop
  const [serverLoading, setServerLoading] = useState(false);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [serverLoadingMore, setServerLoadingMore] = useState(false);
  const [serverTotal, setServerTotal] = useState(0);
  const serverPageRef = useRef(1);
  const filterTimerRef = useRef(null);

  const userTypes = user?.userTypes || [];
  const userType = user?.userType || userTypes[0] || "producer";
  const isProducerUser = userTypes.includes("producer");
  const isTransporterUser = userTypes.includes("transporter");
  const plantOptions = useMemo(()=>[...new Set(freights.map(f=>f.destName).filter(Boolean))].sort(),[freights]);
  const secondFilterLabel = isProducerUser ? "Campo" : isTransporterUser ? "Planta" : "Productor";
  const secondFilterOptions = useMemo(()=>{
    if (isProducerUser) return (catalog?.fields || []).map(f=>f.name).filter(Boolean).sort();
    if (isTransporterUser) return [...new Set(freights.map(f=>f.destName).filter(Boolean))].sort();
    return [...new Set(freights.map(f=>f.originCompanyName).filter(Boolean))].sort();
  },[freights, isProducerUser, isTransporterUser, catalog?.fields]);
  const transporterOptions = useMemo(()=>[...new Set(freights.map(f=>f.transporterName).filter(Boolean))].sort(),[freights]);
  const producerOptions = useMemo(()=>[...new Set(freights.map(f=>f.originCompanyName).filter(Boolean))].sort(),[freights]);
  // Plant-centric: filter by producerCompanyName (freights created on behalf of producers)
  const isPlantUser = userType === "plant";
  const producerCompanyOptions = useMemo(()=>isPlantUser ? [...new Set(freights.map(f=>f.producerCompanyName).filter(Boolean))].sort() : [],[freights, isPlantUser]);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    if(preset==="today") { setDateFrom(fmt(today)); setDateTo(fmt(today)); }
    else if(preset==="week") { const w=new Date(today); w.setDate(w.getDate()-7); setDateFrom(fmt(w)); setDateTo(fmt(today)); }
    else if(preset==="month") { const m=new Date(today); m.setMonth(m.getMonth()-1); setDateFrom(fmt(m)); setDateTo(fmt(today)); }
    else if(preset==="quarter") { const q=new Date(today); q.setMonth(q.getMonth()-3); setDateFrom(fmt(q)); setDateTo(fmt(today)); }
    else { setDateFrom(""); setDateTo(""); }
  };

  const clearAll = () => { setSearchQ(""); setFPlant(""); setFProducer(""); setFTransporter(""); setDateFrom(""); setDateTo(""); setDatePreset(""); setFilterRequiresAction(false); setServerData(null); };
  const hasFilters = searchQ || fPlant || fProducer || fTransporter || fProducerCompany || dateFrom || dateTo || filterRequiresAction;

  // Build query params for server-side filtering
  const buildFilterParams = useCallback(() => {
    const params = { limit: 25, page: 1 };
    if (searchQ && searchQ.length >= 2) params.search = searchQ;
    if (fPlant) params.destName = fPlant;
    if (fProducer) {
      // For producers: fProducer is a field name — not supported as backend filter, skip
      // For transporters: fProducer is a plant name (destName) — already covered by fPlant mapping
      // For plants: fProducer is an origin company name
      if (!isProducerUser) {
        if (isTransporterUser) params.destName = params.destName || fProducer;
        else params.originCompany = fProducer;
      }
    }
    if (fTransporter) params.transporter = fTransporter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  }, [searchQ, fPlant, fProducer, fTransporter, dateFrom, dateTo, isProducerUser, isTransporterUser]);

  // Server-side filter query — debounced
  useEffect(() => {
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    if (!hasFilters) { setServerData(null); setServerHasMore(false); setServerLoading(false); return; }
    // For search, wait for 2+ chars; for other filters, query immediately
    if (searchQ && searchQ.length < 2 && !fPlant && !fProducer && !fTransporter && !dateFrom && !dateTo) {
      setServerData(null); setServerHasMore(false); setServerLoading(false); return;
    }
    setServerLoading(true);
    const delay = searchQ ? 300 : 50; // Shorter debounce for dropdown filters
    filterTimerRef.current = setTimeout(async () => {
      try {
        serverPageRef.current = 1;
        const params = buildFilterParams();
        const r = await apiListFreights(params);
        setServerData((r.data || []).map(mapFreight));
        setServerHasMore((r.page || 1) < (r.pages || 1));
        setServerTotal(r.total || 0);
      } catch { setServerData([]); setServerHasMore(false); setServerTotal(0); }
      finally { setServerLoading(false); }
    }, delay);
    return () => { if (filterTimerRef.current) clearTimeout(filterTimerRef.current); };
  }, [hasFilters, searchQ, fPlant, fProducer, fTransporter, dateFrom, dateTo, buildFilterParams]);

  // Load more server results (infinite scroll)
  const loadMoreServer = useCallback(async () => {
    if (serverLoadingMore || !serverHasMore) return;
    setServerLoadingMore(true);
    try {
      const nextPage = serverPageRef.current + 1;
      const params = buildFilterParams();
      params.page = nextPage;
      const r = await apiListFreights(params);
      serverPageRef.current = nextPage;
      setServerData(prev => [...(prev || []), ...(r.data || []).map(mapFreight)]);
      setServerHasMore((r.page || 1) < (r.pages || 1));
    } catch { /* ignore */ }
    finally { setServerLoadingMore(false); }
  }, [serverLoadingMore, serverHasMore, buildFilterParams]);

  // Use server data when filters active, otherwise use freights prop
  const filtered = useMemo(() => {
    let data;
    if (serverData !== null) {
      // For producers, fProducer is a field name — apply local filter on server results
      data = (isProducerUser && fProducer) ? serverData.filter(f => f.fieldName === fProducer) : serverData;
    } else {
      data = freights;
    }
    // Plant-centric: filter by producerCompanyName
    if (fProducerCompany) data = data.filter(f => f.producerCompanyName === fProducerCompany);
    return data;
  }, [serverData, freights, isProducerUser, fProducer, fProducerCompany]);

  // Pending actions map for kanban cards + "requiere mi acción" filter
  const effectiveTypeKanban = useCallback((f) => resolveUserTypeForFreight ? resolveUserTypeForFreight(f, user) : userType, [user, userType]);
  const pendingMap = useMemo(() => {
    const m = new Map();
    filtered.forEach(f => { m.set(f.id, getPendingActions(f, effectiveTypeKanban(f), user?.role, user)); });
    return m;
  }, [filtered, user?.role, user?.id, userType, effectiveTypeKanban]);

  // Apply "Requiere mi acción" filter
  const filteredFinal = useMemo(() => {
    if (!filterRequiresAction) return filtered;
    return filtered.filter(f => pendingMap.get(f.id) != null);
  }, [filtered, filterRequiresAction, pendingMap]);

  // Status grouping (default kanban)
  const grouped = useMemo(()=>{
    const map = {};
    GROUPS.forEach(g => map[g.key] = []);
    filteredFinal.forEach(f => {
      const g = GROUPS.find(g => g.statuses.includes(f.status));
      if(g) map[g.key].push(f);
    });
    GROUPS.forEach(g => map[g.key].sort((a,b) => (a.destName||'').localeCompare(b.destName||'') || (a.originName||'').localeCompare(b.originName||'')));
    return map;
  },[filteredFinal]);

  // Real company-wide counts per status group (from backend)
  const groupRealCounts = useMemo(() => {
    if (!statusCounts || !Object.keys(statusCounts).length) return null;
    const map = {};
    GROUPS.forEach(g => { map[g.key] = g.statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0); });
    return map;
  }, [statusCounts]);

  // Entity grouping for kanban
  const entityGrouped = useMemo(() => {
    if (!kanbanGroup) return null;
    const entityCfg = (ENTITY_GROUPS[userType] || []).find(e => e.key === kanbanGroup);
    if (!entityCfg) return null;
    const buckets = {};
    filteredFinal.forEach(f => {
      const val = f[entityCfg.field] || entityCfg.fallback;
      if (!buckets[val]) buckets[val] = [];
      buckets[val].push(f);
    });
    // Sort buckets: named first (alphabetical), fallback last
    const keys = Object.keys(buckets).sort((a, b) => {
      if (a === entityCfg.fallback) return 1;
      if (b === entityCfg.fallback) return -1;
      return a.localeCompare(b, "es");
    });
    return keys.map(k => ({ name: k, items: buckets[k], isFallback: k === entityCfg.fallback }));
  }, [filteredFinal, kanbanGroup, userType]);

  // Available kanban grouping options
  const kanbanGroupOptions = useMemo(() => {
    const opts = [];
    (ENTITY_GROUPS[userType] || []).forEach(e => opts.push({ key: e.key, label: e.label }));
    return opts;
  }, [userType]);

  // Table: status-filtered + sorted
  const { sortCol, sortDir, toggle: toggleSort, sortData } = useTableSort();
  const tableFiltered = useMemo(() => {
    if (tableStatusFilter === "all") return filteredFinal;
    const group = GROUPS.find(g => g.key === tableStatusFilter);
    if (!group) return filteredFinal;
    return filteredFinal.filter(f => group.statuses.includes(f.status));
  }, [filteredFinal, tableStatusFilter]);
  const tableSorted = useMemo(() => sortData(tableFiltered, SORT_GETTERS), [tableFiltered, sortCol, sortDir]);

  // Tracking view: group by transporter -> driver -> queue
  const trackingGroups = useMemo(()=>{
    const active = filteredFinal.filter(f=>!["finished","canceled"].includes(f.status));
    const unassigned = active.filter(f=>!f.transporterName);
    const byT = {};
    active.filter(f=>f.transporterName).forEach(f=>{
      const key = f.transporterId||f.transporterName;
      if(!byT[key]) byT[key] = { name:f.transporterName, id:key, drivers:{}, noDriver:[] };
      if(f.driverName){
        const dk = f.driverId||f.driverName;
        if(!byT[key].drivers[dk]) byT[key].drivers[dk] = { id:f.driverId, name:f.driverName, phone:f.driverPhone, freights:[] };
        byT[key].drivers[dk].freights.push(f);
      } else {
        byT[key].noDriver.push(f);
      }
    });
    Object.values(byT).forEach(t=>Object.values(t.drivers).forEach(d=>d.freights.sort((a,b)=>(a.queuePosition||0)-(b.queuePosition||0))));
    return { transporters:Object.values(byT).sort((a,b)=>a.name.localeCompare(b.name)), unassigned };
  },[filteredFinal]);

  const { containerRef, indicator } = usePullToRefresh(onRefresh);

  // Preload Google Maps API + chunk while user browses the list
  useEffect(() => { import("../maps").then(m => m.loadGMaps()).catch(() => {}); }, []);
  // Keep map mounted after first show to avoid reinit on view switch
  useEffect(() => { if (view === "mapa") setMapShown(true); }, [view]);

  // ======================== HOVER PREVIEW ========================
  const [hoverFreight, setHoverFreight] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const hoverCardRef = useRef(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
  }, []);

  const handleCardMouseEnter = useCallback((f, e) => {
    if (!isDesktop) return;
    clearHoverTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      setHoverPos({ x: rect.right + 12, y: rect.top });
      setHoverFreight(f);
    }, 800);
  }, [isDesktop, clearHoverTimer]);

  const handleCardMouseLeave = useCallback(() => {
    clearHoverTimer();
    setHoverFreight(null);
  }, [clearHoverTimer]);

  // Adjust preview position to stay within viewport via callback ref
  const adjustPreviewPos = useCallback((el) => {
    if (!el) return;
    hoverCardRef.current = el;
    const rect = el.getBoundingClientRect();
    let needsUpdate = false;
    let x = rect.left, y = rect.top;
    if (rect.right > window.innerWidth - 12) { x = Math.max(12, rect.left - rect.width - 24); needsUpdate = true; }
    if (rect.bottom > window.innerHeight - 12) { y = Math.max(12, window.innerHeight - rect.height - 12); needsUpdate = true; }
    if (needsUpdate) setHoverPos({ x, y });
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const FreightHoverPreview = hoverFreight && isDesktop ? (() => {
    const f = hoverFreight;
    const st = stCfg(f.status);
    const origin = originDisplay(f);
    const dest = destDisplay(f) || "Sin destino";
    return (
      <div ref={adjustPreviewPos} style={{ position:"fixed", left:hoverPos.x, top:hoverPos.y, zIndex:9999, width:340, background:C.w, border:`1px solid ${C.b1}`, borderLeft:`5px solid ${st.color}`, borderRadius: R.lg, boxShadow:C.shLg, padding:18, pointerEvents:"none", fontFamily:FONT, animation:"tvPreviewIn 0.15s ease-out" }}>
        {/* Header: code + status */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontFamily:MONO, fontWeight:700, fontSize:13.2, color:C.t2 }}>{f.code}</span>
          <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
        </div>
        {/* Product */}
        <div style={{ fontSize:16, fontWeight:700, color:C.t1, marginBottom:8 }}>
          {Ic.grain(st.color, 16)} <span style={{ marginLeft:4 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</span>
        </div>
        {/* Origin → Destination */}
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:10, padding:"8px 0", borderTop:`1px solid ${C.b2}`, borderBottom:`1px solid ${C.b2}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13.2, color:C.t2 }}>
            {Ic.pin(C.pri, 13)} <span style={{ fontWeight:600 }}>{origin || "Sin origen"}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.t3, paddingLeft:2 }}>
            <span style={{ width:13, display:"flex", justifyContent:"center", color:C.t3 }}>↓</span>
            <span>{f.originCompanyName || ""}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13.2, color:C.t2 }}>
            {Ic.plant(C.sec, 13)} <span style={{ fontWeight:600 }}>{dest}</span>
          </div>
        </div>
        {/* Date & time */}
        {f.loadDate && (
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, color:C.t2, marginBottom:6 }}>
            {Ic.cal(C.t3, 12)} {formatFreightDate(f.loadDate)}{f.loadTime ? <><span style={{ color:C.t3, margin:"0 2px" }}>·</span>{Ic.clk(C.t3, 12)} {f.loadTime}</> : ""}
          </div>
        )}
        {/* Transporter + truck */}
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, color:C.t2, marginBottom:4 }}>
          {Ic.truck(C.t3, 12)} <span>{f.transporterName || "Sin asignar"}</span>
          {f.isOwnFleet && <span style={{ fontSize:10, color:C.acc, fontWeight:700, background:C.accPale, padding:"1px 5px", borderRadius: R.xs }}>Flota propia</span>}
        </div>
        {/* Truck plate + driver */}
        {(f.truckPlate || f.driverName) && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.1, color:C.t3 }}>
            {f.truckPlate && <span style={{ fontFamily:MONO, fontWeight:600 }}>{f.truckPlate}</span>}
            {f.driverName && <span>{Ic.user(C.t3, 11)} {f.driverName}</span>}
          </div>
        )}
        {/* Multi-truck info */}
        {f.isMultiTruck && (
          <div style={{ marginTop:8, padding:"5px 8px", background:C.infoPale, borderRadius: R.sm, fontSize:11.5, fontWeight:600, color:C.info, display:"inline-flex", alignItems:"center", gap:4 }}>
            {Ic.truck(C.info, 12)} {f.assignedTruckCount}/{f.truckCount} camiones asignados
          </div>
        )}
        {/* Overdue */}
        {f.isOverdue && (
          <div style={{ marginTop:8, padding:"4px 8px", background:"#FEE2E2", borderRadius: R.sm, fontSize:11.5, fontWeight:700, color:"#DC2626", display:"inline-flex", alignItems:"center", gap:4 }}>
            {Ic.warn("#DC2626", 12)} Retrasado
          </div>
        )}
      </div>
    );
  })() : null;

  // Wrap a card element with hover handlers
  const wrapHover = (f, cardEl) => (
    <div key={f.id} onMouseEnter={(e) => handleCardMouseEnter(f, e)} onMouseLeave={handleCardMouseLeave}>
      {cardEl}
    </div>
  );

  // Kanban card renderer (shared between status and entity grouping)
  const renderKanbanCard = (f) => {
    const origin = originDisplay(f) || f.originCompanyName || "Sin origen";
    const dest = destDisplay(f) || "Sin destino";
    const isCustomDest = !f.destPlantId && f.destLat && f.destLng;
    const grain = f.grain === "Otros" ? (f.productTypeOther || "Otros") : f.grain;
    const tons = `${f.tons || ""}${f.unit && f.unit !== "toneladas" ? ` ${f.unit}` : " tn"}`;
    const dt = fmtKanbanDate(f.loadDate, f.loadTime);
    const transport = f.transporterName || "Sin asignar";
    const plate = f.truckPlate;
    const sc = STATUS_COLORS[f.status] || STATUS_COLORS.pending_assignment;
    const pa = pendingMap.get(f.id);
    const waitText = !pa ? getWaitingOnText(f, effectiveTypeKanban(f)) : null;
    return wrapHover(f,
      <div className="tv-card" onClick={()=>onNav("detail",f.id)} style={{ display:"flex", borderRadius: R.sm, border:`0.5px solid ${pa ? pa.color + "30" : C.b1}`, overflow:"hidden", cursor:"pointer", background:C.w, transition:"border-color 0.15s", contentVisibility:"auto", containIntrinsicSize:"0 90px" }}>
        <div style={{ width:5, background:sc.ribbon, flexShrink:0 }} />
        <div style={{ padding:"8px 10px", flex:1, minWidth:0 }}>
          {/* Line 1: code - date */}
          <div style={{ fontSize:11, color:C.t2, marginBottom:3, display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontFamily:MONO, fontWeight:700 }}>{f.code}</span>
            {dt && <><span>-</span><span>{dt}</span></>}
          </div>
          {/* Line 2: grain · tons */}
          <div style={{ fontSize:14, fontWeight:500, color:C.t1, marginBottom:4 }}>{grain} · {tons}</div>
          {/* Line 3: origin → dest */}
          <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
            {Ic.pin("#888",12)}
            <span style={{ fontSize:12, color:C.t2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{origin}</span>
            <span style={{ fontSize:12, color:C.t2, flexShrink:0 }}>→</span>
            {isCustomDest ? Ic.pin("#888",11) : Ic.plant("#666",11)}
            <span style={{ fontSize:12, color:C.t2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{dest}</span>
          </div>
          {/* Producer badge (plant only) */}
          {isPlantUser && f.producerCompanyName && (
            <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
              {Ic.user(C.acc,11)}
              <span style={{ fontSize:11, color:C.acc, fontWeight:600 }}>{f.producerCompanyName}</span>
            </div>
          )}
          {/* Line 4: transporter */}
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            {Ic.truck(C.t2,12)}
            <span style={{ fontSize:12, color:C.t2 }}>{transport}{plate ? ` · ${plate}` : ""}</span>
          </div>
          {/* Pending action / waiting indicator */}
          {pa && <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:pa.color, flexShrink:0 }} />
            <span style={{ fontSize:11, fontWeight:700, color:pa.color }}>{pa.action}</span>
          </div>}
          {!pa && waitText && <div style={{ fontSize:11, color:C.t3, marginTop:3 }}>{waitText}</div>}
        </div>
        {/* Quick action button (plant only) */}
        {isPlantUser && onAction && pa && pa.actionKey && (
          <div style={{ display:"flex", alignItems:"center", paddingRight:6, flexShrink:0 }}>
            <button onClick={(e)=>{e.stopPropagation();onAction(f.id, pa.actionKey, pa.assignmentId);}} title={pa.action} style={{ width:32, height:32, borderRadius: R.md, border:`1.5px solid ${pa.color}30`, background:`${pa.color}10`, color:pa.color, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
              {pa.icon === "assign" ? Ic.truck(pa.color,15) : pa.icon === "confirm" ? Ic.chk(pa.color,15) : pa.icon === "authorize" ? Ic.chk(pa.color,15) : Ic.nav(pa.color,15)}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Kanban grouping toggle pills
  const groupingPills = kanbanGroupOptions.length > 0 && (
    <div style={{ display:"flex", gap:6, marginBottom:10, alignItems:"center" }}>
      <span style={{ fontSize:12.1, fontWeight:600, color:C.t3, whiteSpace:"nowrap" }}>Agrupar por:</span>
      {kanbanGroupOptions.map(o => (
        <button key={o.key} onClick={() => setKanbanGroup(o.key)} style={{ padding:"5px 10px", borderRadius: R.sm, border:`1.5px solid ${kanbanGroup === o.key ? C.pri : C.b1}`, background: kanbanGroup === o.key ? C.priPale : C.w, color: kanbanGroup === o.key ? C.pri : C.t2, fontSize:12.1, fontWeight: kanbanGroup === o.key ? 700 : 500, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{o.label}</button>
      ))}
    </div>
  );

  // ======================== SIMPLE MODE ========================
  if (simpleMode) {
    // Determine filters based on user type
    const isPlantUser = userType === "plant" || userTypes.includes("plant");
    const simpleFilter1 = isProducerUser ? { value: fPlant, set: setFPlant, label: "Planta", options: plantOptions }
      : isPlantUser ? { value: fProducer, set: setFProducer, label: "Productor", options: producerOptions }
      : { value: fProducer, set: setFProducer, label: "Productor", options: producerOptions };
    const simpleFilter2 = isProducerUser ? { value: fTransporter, set: setFTransporter, label: "Transportista", options: transporterOptions }
      : isPlantUser ? { value: fTransporter, set: setFTransporter, label: "Transportista", options: transporterOptions }
      : { value: fPlant, set: setFPlant, label: "Planta", options: plantOptions };
    const simpleHasFilters = searchQ || simpleFilter1.value || simpleFilter2.value;

    // Pending actions map for simple cards
    const effectiveType = (f) => resolveUserTypeForFreight ? resolveUserTypeForFreight(f, user) : userType;
    const simplePendingMap = useMemo(() => {
      const m = new Map();
      filtered.forEach(f => { m.set(f.id, getPendingActions(f, effectiveType(f), user?.role, user)); });
      return m;
    }, [filtered, user?.role, user?.id, userType]);

    const renderSimpleCard = (f) => {
      const st = stCfg(f.status);
      const pa = f._pending;
      const origin = originDisplay(f);
      const dest = destDisplay(f) || "Sin destino";
      return wrapHover(f,
        <div key={f.id} onClick={() => onNav("detail", f.id)} style={{ background: C.w, border: `1px solid ${pa ? st.color + "40" : C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: R.md, padding: "8px 12px", cursor: "pointer", boxShadow: C.sh, transition: "background 0.15s, border-color 0.15s", position: "relative", overflow: "hidden", boxSizing: "border-box" }}>
          {pa && <div style={{ position: "absolute", top: 8, right: 10, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF6A00", display: "inline-block", animation: "dotPulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FF6A00", whiteSpace: "nowrap" }}>{pa.action}</span>
          </div>}
          <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1, marginBottom: 2 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: C.t2, marginBottom: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            <span style={{display:"flex",alignItems:"center",gap:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",flexShrink:1,minWidth:0}}>{Ic.pin(C.t3,10)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{origin || "Sin origen"}</span></span>
            <span style={{color:C.t3,flexShrink:0}}>→</span>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dest}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.t3 }}>
            {f.loadDate && <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{Ic.cal(C.t3, 9)} {formatFreightDate(f.loadDate)}{f.loadTime ? ` · ${f.loadTime}` : ""}</span>}
            <span style={{ fontFamily: MONO, fontWeight: 600 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
            {f.isOverdue && <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:16, height:16, borderRadius: R.xs, background:"#FEE2E2", flexShrink:0, fontSize:10, fontWeight:800, color:"#DC2626", lineHeight:1 }} title="Retrasado">R</span>}
          </div>
        </div>
      );
    };

    return (
      <div ref={containerRef} style={{ flex:1, overflow:"auto", padding:18, WebkitOverflowScrolling:"touch" }}>
        {indicator}
        {/* Search bar */}
        <div style={{ position:"relative", marginBottom:8 }}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar flete..."
            style={{width:"100%",padding:"8px 12px 8px 32px",borderRadius: R.md,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:14.3,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          {searchQ && <button onClick={()=>setSearchQ("")} aria-label="Limpiar busqueda" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,14)}</button>}
        </div>
        {/* Filters */}
        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <select aria-label={simpleFilter1.label} value={simpleFilter1.value} onChange={e=>simpleFilter1.set(e.target.value)} style={{padding:"7px 10px",borderRadius: R.md,border:`1.5px solid ${simpleFilter1.value?C.pri:C.b1}`,background:simpleFilter1.value?C.priPale:C.w,color:simpleFilter1.value?C.pri:C.t3,fontSize:13.2,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0,flex:"1 1 120px",maxWidth:200}}>
            <option value="">{simpleFilter1.label}</option>
            {simpleFilter1.options.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          <select aria-label={simpleFilter2.label} value={simpleFilter2.value} onChange={e=>simpleFilter2.set(e.target.value)} style={{padding:"7px 10px",borderRadius: R.md,border:`1.5px solid ${simpleFilter2.value?C.pri:C.b1}`,background:simpleFilter2.value?C.priPale:C.w,color:simpleFilter2.value?C.pri:C.t3,fontSize:13.2,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0,flex:"1 1 120px",maxWidth:200}}>
            <option value="">{simpleFilter2.label}</option>
            {simpleFilter2.options.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          {simpleHasFilters && <button onClick={()=>{setSearchQ("");setServerData(null);simpleFilter1.set("");simpleFilter2.set("");}} style={{padding:"6px 10px",borderRadius: R.sm,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>Limpiar</button>}
        </div>
        {loading && freights.length === 0 && <SkeletonList count={5} />}
        {!loading && freights.length === 0 && <EmptyState icon={Ic.truck(C.t3, 28)} title="Sin fletes todavia" subtitle="Los fletes que solicites o te asignen apareceran aca" />}
        {filtered.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {GROUPS.map(group => {
              const items = grouped[group.key];
              if(items.length===0) return null;
              const enriched = items.map(f => ({ ...f, _pending: simplePendingMap.get(f.id) || null }));
              return (
                <div key={group.key}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"6px 0", borderBottom:`2px solid ${group.color}` }}>
                    <span style={{ display:"flex", flexShrink:0 }}>{group.icon(group.color, 15)}</span>
                    <span style={{ fontSize:13.2, fontWeight:700, color:group.color }}>{group.label}</span>
                    <span style={{ fontSize:12.1, fontWeight:600, color:C.t3 }}>({items.length})</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {enriched.map(f => <div key={f.id} style={{ flex:"1 1 calc(50% - 4px)", minWidth:240, maxWidth:"100%" }}>{renderSimpleCard(f)}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {filtered.length === 0 && freights.length > 0 && !loading && !serverLoading && <EmptyState icon={Ic.srch(C.t3, 28)} title="Sin resultados" subtitle="Proba cambiando los filtros" />}
        {serverLoading && <div style={{ textAlign:"center", padding:12, fontSize:12.1, color:C.t3 }}>Buscando...</div>}
        {serverData !== null && serverHasMore && <div style={{ textAlign:"center", padding:12 }}><Btn v="ghost" onClick={loadMoreServer} loading={serverLoadingMore}>Cargar mas resultados</Btn></div>}
        {serverData === null && hasMore && <div style={{ textAlign:"center", padding:12 }}><Btn v="ghost" onClick={loadMore} loading={loadingMore}>Cargar mas</Btn></div>}
        {FreightHoverPreview}
      </div>
    );
  }

  const fromLocations = sp.get("fieldId") || sp.get("lotId") || sp.get("originName") || sp.get("fromLocations");

  return (
    <div ref={containerRef} style={{ flex:1, overflow:"auto", padding:18, WebkitOverflowScrolling:"touch" }}>
      {indicator}
      {fromLocations && <button onClick={() => onNav("locations")} style={{ background:C.priPale, border:`1px solid ${C.pri}40`, borderRadius: R.md, cursor:"pointer", fontFamily:FONT, fontSize:14, fontWeight:600, color:C.pri, padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:6, width:"100%" }}>{Ic.chev(C.pri, 16)} Volver al mapa de ubicaciones</button>}
      {/* Desktop: original filters layout */}
      {!fromLocations && (isDesktop ? (<>
      {/* Search bar -- line 1 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <div style={{ position:"relative", flex:1, minWidth:0 }}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar flete..."
            style={{width:"100%",padding:"8px 12px 8px 32px",borderRadius: R.md,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13.2,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          {searchQ && <button onClick={()=>setSearchQ("")} aria-label="Limpiar busqueda" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,14)}</button>}
        </div>
        {hasFilters && <button onClick={clearAll} style={{padding:"6px 10px",borderRadius: R.sm,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>Limpiar</button>}
      </div>
      {/* Entity filters + date toggle -- line 2 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:dateFilterOpen?6:12 }}>
        <button onClick={()=>setFilterRequiresAction(p=>!p)} style={{padding:"6px 10px",borderRadius: R.md,border:`1.5px solid ${filterRequiresAction?C.acc:C.b1}`,background:filterRequiresAction?`${C.acc}15`:C.w,color:filterRequiresAction?C.acc:C.t2,fontSize:12.1,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
          {filterRequiresAction ? Ic.chk(C.acc,12) : Ic.warn(C.t3,12)} Mi acción
        </button>
        <button onClick={()=>setDateFilterOpen(p=>!p)} style={{padding:"6px 10px",borderRadius: R.md,border:`1.5px solid ${(dateFrom||dateTo)?C.pri:C.b1}`,background:(dateFrom||dateTo)?C.priPale:C.w,color:(dateFrom||dateTo)?C.pri:C.t2,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
          {Ic.cal((dateFrom||dateTo)?C.pri:C.t3,13)} {dateFilterOpen?"Ocultar fechas":"Filtrar por fecha"}{(dateFrom||dateTo)?" (activo)":""}
        </button>
        <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fPlant?C.pri:C.b1}`,background:fPlant?C.priPale:C.w,color:fPlant?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Planta</option>
          {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fProducer} onChange={e=>setFProducer(e.target.value)} style={{padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fProducer?C.pri:C.b1}`,background:fProducer?C.priPale:C.w,color:fProducer?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">{secondFilterLabel}</option>
          {secondFilterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fTransporter} onChange={e=>setFTransporter(e.target.value)} style={{padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fTransporter?C.pri:C.b1}`,background:fTransporter?C.priPale:C.w,color:fTransporter?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Transportista</option>
          {transporterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {isPlantUser && producerCompanyOptions.length > 0 && (
          <select value={fProducerCompany} onChange={e=>setFProducerCompany(e.target.value)} style={{padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fProducerCompany?C.pri:C.b1}`,background:fProducerCompany?C.priPale:C.w,color:fProducerCompany?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
            <option value="">Productor</option>
            {producerCompanyOptions.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          {[{k:"kanban",l:"Estados",ic:Ic.home},{k:"seguimiento",l:"Seguimiento",ic:Ic.user},{k:"tabla",l:"Tabla",ic:Ic.doc},{k:"mapa",l:"Mapa",ic:Ic.pin}].map(v=>(
            <button key={v.k} onClick={()=>setView(v.k)} style={{padding:"5px 10px",borderRadius: R.md,border:`1.5px solid ${view===v.k?C.pri:C.b1}`,background:view===v.k?C.priPale:C.w,color:view===v.k?C.pri:C.t2,fontSize:12.1,fontWeight:view===v.k?700:500,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              {v.ic(view===v.k?C.pri:C.t3,12)} {v.l}
            </button>
          ))}
        </div>
      </div>
      {/* Collapsible date filters */}
      {dateFilterOpen && <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12, padding:"8px 12px", background:C.bg, borderRadius: R.md, border:`1px solid ${C.b1}` }}>
        <span style={{fontSize:11,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius: R.sm,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        <span style={{fontSize:11,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius: R.sm,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");setDatePreset("");}} aria-label="Limpiar fechas" style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2}}>{Ic.cross(C.t3,14)}</button>}
        {[{k:"today",l:"Hoy"},{k:"week",l:"Semana"},{k:"month",l:"Mes"}].map(p=>(
          <button key={p.k} onClick={()=>applyDatePreset(p.k)} style={{padding:"5px 10px",borderRadius: R.sm,border:`1px solid ${datePreset===p.k?C.pri:C.b1}`,background:datePreset===p.k?C.priPale:C.w,color:datePreset===p.k?C.pri:C.t2,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{p.l}</button>
        ))}
      </div>}
      </>) : (<>
      {/* Mobile: collapsible filters layout */}
      {/* Toggle button */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <button onClick={()=>setFiltersOpen(p=>!p)} style={{padding:"8px 14px",borderRadius: R.md,border:`1.5px solid ${hasFilters?C.pri:C.b1}`,background:hasFilters?C.priPale:C.w,color:hasFilters?C.pri:C.t2,fontSize:13.2,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,minHeight:44}}>
          {Ic.srch(hasFilters?C.pri:C.t3,12)} {filtersOpen?"Ocultar filtros":"Ver filtros"}{hasFilters?" (activos)":""}
        </button>
        {hasFilters && <button onClick={clearAll} style={{padding:"8px 12px",borderRadius: R.sm,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:13.2,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,minHeight:44}}>Limpiar</button>}
      </div>
      {/* "Requiere mi acción" chip (mobile) */}
      <div style={{ display:"flex", gap:6, marginBottom:8 }}>
        <button onClick={()=>setFilterRequiresAction(p=>!p)} style={{padding:"7px 12px",borderRadius: R.md,border:`1.5px solid ${filterRequiresAction?C.acc:C.b1}`,background:filterRequiresAction?`${C.acc}15`:C.w,color:filterRequiresAction?C.acc:C.t2,fontSize:13.2,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",minHeight:36}}>
          {filterRequiresAction ? Ic.chk(C.acc,12) : Ic.warn(C.t3,12)} Mi acción
        </button>
      </div>
      {/* View mode buttons */}
      <div style={{ display:"flex", gap:4, marginBottom:10, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:2 }}>
        {[{k:"kanban",l:"Estados",ic:Ic.home},{k:"seguimiento",l:"Transportistas",ic:Ic.user},{k:"mapa",l:"Mapa",ic:Ic.pin}].map(v=>(
          <button key={v.k} onClick={()=>setView(v.k)} style={{padding:"8px 10px",borderRadius: R.sm,border:`1.5px solid ${view===v.k?C.pri:C.b1}`,background:view===v.k?C.priPale:C.w,color:view===v.k?C.pri:C.t2,fontSize:12.1,fontWeight:view===v.k?700:500,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap",minHeight:36,flexShrink:0}}>
            {v.ic(view===v.k?C.pri:C.t3,11)} {v.l}
          </button>
        ))}
      </div>
      {/* Collapsible filter block */}
      {filtersOpen && <>
      <div style={{ position:"relative", marginBottom:6 }}>
        <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar..."
          style={{width:"100%",padding:"7px 12px 7px 30px",borderRadius: R.md,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13.2,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} aria-label="Limpiar busqueda" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,12)}</button>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{fontSize:11,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius: R.sm,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer",flex:1,minWidth:0}}/>
        <span style={{fontSize:11,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius: R.sm,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer",flex:1,minWidth:0}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");setDatePreset("");}} aria-label="Limpiar fechas" style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2,flexShrink:0}}>{Ic.cross(C.t3,14)}</button>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <select aria-label="Planta" value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fPlant?C.pri:C.b1}`,background:fPlant?C.priPale:C.w,color:fPlant?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
          <option value="">Planta</option>
          {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label={secondFilterLabel} value={fProducer} onChange={e=>setFProducer(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fProducer?C.pri:C.b1}`,background:fProducer?C.priPale:C.w,color:fProducer?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
          <option value="">{secondFilterLabel}</option>
          {secondFilterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <select aria-label="Transportista" value={fTransporter} onChange={e=>setFTransporter(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fTransporter?C.pri:C.b1}`,background:fTransporter?C.priPale:C.w,color:fTransporter?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
          <option value="">Transportista</option>
          {transporterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {isPlantUser && producerCompanyOptions.length > 0 && (
          <select aria-label="Productor" value={fProducerCompany} onChange={e=>setFProducerCompany(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius: R.md,border:`1.5px solid ${fProducerCompany?C.pri:C.b1}`,background:fProducerCompany?C.priPale:C.w,color:fProducerCompany?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
            <option value="">Productor</option>
            {producerCompanyOptions.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>
      </>}
      </>))}

      {/* Search result count */}
      {hasFilters && filteredFinal.length > 0 && !serverLoading && <div style={{ fontSize:12.1, fontWeight:600, color:C.t3, marginBottom:8 }}>{serverData !== null ? `${serverTotal} flete${serverTotal!==1?"s":""} encontrado${serverTotal!==1?"s":""}` : `${filteredFinal.length} flete${filteredFinal.length!==1?"s":""}`}</div>}
      {hasFilters && filteredFinal.length === 0 && !loading && !serverLoading && <EmptyState icon={Ic.srch(C.t3, 28)} title="Sin resultados" subtitle={`No hay fletes para "${searchQ || "los filtros seleccionados"}"`} />}
      {serverLoading && <div style={{ textAlign:"center", padding:16, fontSize:12.1, color:C.t3 }}>Buscando...</div>}

      {/* Skeleton while loading */}
      {loading && freights.length === 0 && <SkeletonList count={5} />}

      {/* Empty state */}
      {!loading && freights.length === 0 && <EmptyState icon={Ic.truck(C.t3, 28)} title="Sin fletes todavia" subtitle="Los fletes que solicites o te asignen apareceran aca" />}

      {/* View: Kanban */}
      {view==="kanban" && freights.length > 0 && (<>
      {!kanbanGroup || !entityGrouped ? (
        /* Status grouping (original) */
        isDesktop ? (
        <div style={{ display:"flex", gap:12, overflowX:"auto", alignItems:"flex-start", paddingBottom:8 }}>
          {GROUPS.map(group => {
            const items = grouped[group.key];
            return (
              <div key={group.key} style={{ minWidth:200, flex:"1 1 0", background:C.bg, borderRadius: R.lg, border:`1px solid ${C.b1}`, overflow:"hidden", borderTop:`4px solid ${group.color}` }}>
                <div style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ display:"flex", flexShrink:0 }}>{group.icon(group.color, 14)}</span>
                  <span style={{ fontSize:12.1, fontWeight:700, color:group.color }}>{group.label}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{groupRealCounts?.[group.key] ?? items.length}</span>
                </div>
                <div style={{ padding:8, display:"flex", flexDirection:"column", gap:8, maxHeight:"calc(100vh - 180px)", overflowY:"auto" }}>
                  {items.length===0 && <div style={{ fontSize:12.1, color:C.t3, textAlign:"center", padding:16 }}>Sin fletes</div>}
                  {items.map(renderKanbanCard)}
                </div>
              </div>
            );
          })}
        </div>
        ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {GROUPS.map(group => {
            const items = grouped[group.key];
            if(items.length===0) return null;
            return (
              <div key={group.key}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"6px 0", borderBottom:`2px solid ${group.color}` }}>
                  <span style={{ display:"flex", flexShrink:0 }}>{group.icon(group.color, 15)}</span>
                  <span style={{ fontSize:13.2, fontWeight:700, color:group.color }}>{group.label}</span>
                  <span style={{ fontSize:12.1, fontWeight:600, color:C.t3 }}>({groupRealCounts?.[group.key] ?? items.length})</span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                  {items.map(f => (
                    <div key={f.id} style={{ flex:"1 1 280px", maxWidth:420, minWidth:240 }}>{renderKanbanCard(f)}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )
      ) : (
        /* Entity grouping */
        isDesktop ? (
        <div style={{ display:"flex", gap:12, overflowX:"auto", alignItems:"flex-start", paddingBottom:8 }}>
          {entityGrouped.map(col => (
            <div key={col.name} style={{ minWidth:220, flex:"1 1 0", background:C.bg, borderRadius: R.lg, border:`1px solid ${C.b1}`, overflow:"hidden" }}>
              <div style={{ padding:"10px 12px", borderBottom:`2px solid ${col.isFallback ? C.t3 : C.pri}`, display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12.1, fontWeight:700, color: col.isFallback ? C.t3 : C.t1 }}>{col.name}</span>
                <span style={{ fontSize:11, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{col.items.length}</span>
              </div>
              <div style={{ padding:8, display:"flex", flexDirection:"column", gap:8, maxHeight:"calc(100vh - 180px)", overflowY:"auto" }}>
                {col.items.map(renderKanbanCard)}
              </div>
            </div>
          ))}
        </div>
        ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {entityGrouped.map(col => (
            <div key={col.name}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"6px 0", borderBottom:`2px solid ${col.isFallback ? C.t3 : C.pri}` }}>
                <span style={{ fontSize:13.2, fontWeight:700, color: col.isFallback ? C.t3 : C.t1 }}>{col.name}</span>
                <span style={{ fontSize:12.1, fontWeight:600, color:C.t3 }}>({col.items.length})</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                {col.items.map(f => (
                  <div key={f.id} style={{ flex:"1 1 280px", maxWidth:420, minWidth:240 }}>{renderKanbanCard(f)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        )
      )}
      </>)}

      {/* View: Mapa -- stays mounted after first show to avoid reinit */}
      {(view==="mapa" || mapShown) && (
        <div style={{ display: view === "mapa" ? undefined : "none" }}>
          <ErrorBoundary><Suspense fallback={<SkeletonList count={3}/>}><FreightsOverviewMap freights={filteredFinal} onSelect={(id)=>onNav("detail",id)} fields={catalog?.fields} plants={catalog?.plants} lots={catalog?.lots} /></Suspense></ErrorBoundary>
        </div>
      )}

      {/* View: Tabla */}
      {view==="tabla" && (
        <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 12px", flexWrap:"wrap" }}>
            {/* Status filter pills */}
            {[{k:"all",label:"Todos",color:C.t2},...GROUPS.map(g=>({k:g.key,label:g.label,color:g.color}))].map(s => (
              <button key={s.k} onClick={() => setTableStatusFilter(s.k)} style={{ padding:"4px 10px", borderRadius: R.sm, border:`1px solid ${tableStatusFilter === s.k ? s.color : C.b1}`, background: tableStatusFilter === s.k ? `${s.color}15` : "transparent", color: tableStatusFilter === s.k ? s.color : C.t3, fontSize:11, fontWeight: tableStatusFilter === s.k ? 700 : 500, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{s.label}</button>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
              <button onClick={()=>exportCSV(tableFiltered,"tolvink-fletes.csv")} style={{padding:"5px 12px",borderRadius: R.md,border:`1.5px solid ${C.t3}`,background:C.bg,color:C.t2,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>{Ic.doc(C.t3,13)} CSV</button>
              <button onClick={()=>exportExcel(tableFiltered,"tolvink-fletes.xls")} style={{padding:"5px 12px",borderRadius: R.md,border:`1.5px solid ${C.pri}`,background:C.okPale,color:C.pri,fontSize:12.1,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>{Ic.doc(C.pri,13)} Excel</button>
            </div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.2, fontFamily:"inherit" }}>
              <thead>
                <tr style={{ background:C.bg, borderBottom:`2px solid ${C.b1}` }}>
                  <SortTh label="Codigo" colKey="code" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Estado" colKey="status" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Producto" colKey="product" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>Cam.</th>
                  <SortTh label="Empresa" colKey="company" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>Campo / Lote</th>
                  <SortTh label="Destino" colKey="dest" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Fecha" colKey="date" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Hora" colKey="time" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Transportista" colKey="transporter" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Matricula" colKey="plate" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Chofer" colKey="driver" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Celular" colKey="phone" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th style={{ padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {tableSorted.length===0 && <tr><td colSpan={14} style={{ padding:24, textAlign:"center", color:C.t3, fontSize:13.2 }}>Sin fletes</td></tr>}
                {tableSorted.map(f=>{
                  const st = stCfg(f.status);
                  const campoLote = originDisplay(f) || "\u2014";
                  const destText = destDisplay(f);
                  const tpa = pendingMap.get(f.id);
                  return (
                    <tr key={f.id} className="tv-row" onClick={()=>onNav("detail",f.id)} onMouseEnter={(e)=>handleCardMouseEnter(f,e)} onMouseLeave={handleCardMouseLeave} style={{ borderBottom:`1px solid ${C.b1}`, cursor:"pointer", contentVisibility:"auto", containIntrinsicSize:"0 44px" }}>
                      <td style={{ padding:"10px 12px", fontFamily:MONO, fontWeight:700, fontSize:11.5, color:C.t2, whiteSpace:"nowrap" }}>{f.code}</td>
                      <td style={{ padding:"10px 12px" }}><Bd color={st.color} bg={st.bg} small>{st.label}</Bd>{f.isOverdue && <> <Bd color="#DC2626" bg="#FEE2E2" small>Retrasado</Bd></>}</td>
                      <td style={{ padding:"10px 12px", fontWeight:600, color:C.t1 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</td>
                      <td style={{ padding:"10px 12px", color:f.isMultiTruck?C.info:C.t3, fontWeight:f.isMultiTruck?600:400, fontSize:12.1, whiteSpace:"nowrap" }}>{f.isMultiTruck?`${f.assignedTruckCount}/${f.truckCount}`:"1"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.originCompanyName||originDisplay(f)}{isPlantUser && f.producerCompanyName && <div style={{ fontSize:10.5, color:C.acc, fontWeight:600 }}>{f.producerCompanyName}</div>}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{campoLote}{f.originLat&&f.originLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.originLat,f.originLng,campoLote);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:11}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{destText}{f.destLat&&f.destLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.destLat,f.destLng,destText);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:11}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</td>
                      <td style={{ padding:"10px 12px", color:C.t2, whiteSpace:"nowrap" }}>{formatFreightDate(f.loadDate)}</td>
                      <td style={{ padding:"10px 12px", color:C.t3, whiteSpace:"nowrap" }}>{f.loadTime||"\u2014"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.transporterName||"\u2014"}</td>
                      <td style={{ padding:"10px 12px", fontFamily:MONO, fontSize:12.1, color:C.t2, whiteSpace:"nowrap" }}>{f.truckPlate||"\u2014"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.driverName||"\u2014"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2, whiteSpace:"nowrap" }}>{f.driverPhone||"\u2014"}</td>
                      <td style={{ padding:"8px 12px", whiteSpace:"nowrap" }}>
                        {tpa && tpa.actionKey && onAction ? (
                          <button onClick={(e)=>{e.stopPropagation();onAction(f.id, tpa.actionKey, tpa.assignmentId);}} style={{padding:"4px 10px",borderRadius: R.sm,border:`1px solid ${tpa.color}40`,background:`${tpa.color}10`,color:tpa.color,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{tpa.action}</button>
                        ) : tpa ? (
                          <span style={{ fontSize:11, color:tpa.color, fontWeight:600 }}>{tpa.action}</span>
                        ) : (
                          <span style={{ fontSize:11, color:C.t3 }}>{getWaitingOnText(f, effectiveTypeKanban(f)) || "\u2014"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Seguimiento -- by transporter -> driver -> queue */}
      {view==="seguimiento" && freights.length > 0 && (<>
      {groupingPills}
      {entityGrouped ? (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {entityGrouped.map(g => {
            const entityCfg = (ENTITY_GROUPS[userType] || []).find(e => e.key === kanbanGroup);
            const groupColor = entityCfg ? C[entityCfg.clr] || C.info : C.info;
            const groupIcon = entityCfg?.icon === "plant" ? Ic.plant : entityCfg?.icon === "user" ? Ic.user : Ic.truck;
            const isCollapsed = !segExpanded[g.name];
            return (
              <div key={g.name} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, overflow:"hidden", boxShadow:C.sh }}>
                <div onClick={() => setSegExpanded(p => ({...p, [g.name]: !p[g.name]}))} style={{ padding:"12px 16px", borderBottom:isCollapsed?"none":`2px solid ${groupColor}`, display:"flex", alignItems:"center", gap:8, background:`${groupColor}08`, cursor:"pointer", userSelect:"none" }}>
                  {g.isFallback ? Ic.warn(C.t3,16) : groupIcon(groupColor,16)}
                  <span style={{ fontSize:14.3, fontWeight:700, color:g.isFallback ? C.t2 : groupColor }}>{g.name}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{g.items.length} flete{g.items.length!==1?"s":""}</span>
                  <span style={{ display:"flex", transition:"transform 0.2s", transform:isCollapsed?"rotate(0deg)":"rotate(-90deg)" }}>{Ic.chev(groupColor,16)}</span>
                </div>
                {!isCollapsed && <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
                  {g.items.map(f => {
                    const st = stCfg(f.status);
                    return (
                      <div key={f.id} onClick={() => onNav("detail",f.id)} onMouseEnter={(e)=>handleCardMouseEnter(f,e)} onMouseLeave={handleCardMouseLeave} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius: R.md, border:`1px solid ${C.b1}`, borderLeft:`3px solid ${st.color}`, background:C.bg, cursor:"pointer", transition:"background 0.15s" }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:12.1, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                            {f.isOverdue && <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:16, height:16, borderRadius: R.xs, background:"#FEE2E2", flexShrink:0, fontSize:10, fontWeight:800, color:"#DC2626", lineHeight:1 }} title="Retrasado">R</span>}
                          </div>
                          <div style={{ fontSize:13.2, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                          {f.loadDate && <div style={{ fontSize:12.1, color:C.t3, fontWeight:500, marginTop:2 }}>{Ic.cal(C.t3,9)} {formatFreightDate(f.loadDate)}{f.loadTime?` · ${f.loadTime}`:""}</div>}
                          {originDisplay(f) && <div style={{ fontSize:11.5, color:C.t3, marginTop:1, display:"flex", alignItems:"center", gap:3 }}>{Ic.pin(C.t3,9)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{originDisplay(f)}</span></div>}
                        </div>
                        <div style={{ fontSize:12.1, color:C.t3, textAlign:"right", flexShrink:0 }}>
                          {destDisplay(f) && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.plant(C.t3,10)} <span style={{ maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{destDisplay(f)}</span></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {trackingGroups.transporters.map(t=>{
            const driverList = Object.values(t.drivers);
            const totalFreights = driverList.reduce((s,d)=>s+d.freights.length,0) + t.noDriver.length;
            const isCollapsed = !segExpanded[t.id];
            return (
              <div key={t.id} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, overflow:"hidden", boxShadow:C.sh }}>
                {/* Transporter header -- clickable to collapse */}
                <div onClick={()=>setSegExpanded(p=>({...p,[t.id]:!p[t.id]}))} style={{ padding:"12px 16px", borderBottom:isCollapsed?"none":`2px solid ${C.info}`, display:"flex", alignItems:"center", gap:8, background:`${C.info}08`, cursor:"pointer", userSelect:"none" }}>
                  {Ic.truck(C.info,16)}
                  <span style={{ fontSize:14.3, fontWeight:700, color:C.info }}>{t.name}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{totalFreights} flete{totalFreights!==1?"s":""}</span>
                  <span style={{ display:"flex", transition:"transform 0.2s", transform:isCollapsed?"rotate(0deg)":"rotate(-90deg)" }}>{Ic.chev(C.info,16)}</span>
                </div>
                {!isCollapsed && <div style={{ padding:12, display:"flex", flexDirection:"column", gap:14 }}>
                  {/* Drivers */}
                  {driverList.map(d=>(
                    <div key={d.id||d.name}>
                      {/* Driver header */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        {Ic.user(C.pri,14)}
                        <span style={{ fontSize:13.2, fontWeight:700, color:C.t1 }}>{d.name}</span>
                        {d.phone && <span style={{ fontSize:11.6, color:C.t3 }}>{d.phone}</span>}
                        <span style={{ fontSize:11, fontWeight:600, color:C.info, background:`${C.info}12`, padding:"2px 8px", borderRadius: R.sm }}>{d.freights.length} en cola</span>
                        {onAction && d.id && <button onClick={()=>onAction(d.freights[0]?.id,"driver_queue")} style={{ marginLeft:"auto", fontSize:11, fontWeight:700, color:C.info, background:`${C.info}12`, border:`1px solid ${C.info}30`, borderRadius: R.sm, padding:"8px 12px", cursor:"pointer", fontFamily:"inherit", minHeight:36 }}>Ver cola</button>}
                      </div>
                      {/* Freight cards */}
                      <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:22 }}>
                        {d.freights.map((f,i)=>{
                          const st = stCfg(f.status);
                          return (
                            <div key={f.id} onClick={()=>onNav("detail",f.id)} onMouseEnter={(e)=>handleCardMouseEnter(f,e)} onMouseLeave={handleCardMouseLeave} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius: R.md, border:`1px solid ${C.b1}`, borderLeft:`3px solid ${st.color}`, background:i===0?`${C.pri}06`:C.bg, cursor:"pointer", transition:"background 0.15s" }}>
                              <div style={{ width:22, height:22, borderRadius: R.lg, background:i===0?C.pri:C.b1, color:i===0?C.w:C.t3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:12.7, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                                  <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                                  {f.isOverdue && <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:16, height:16, borderRadius: R.xs, background:"#FEE2E2", flexShrink:0, fontSize:10, fontWeight:800, color:"#DC2626", lineHeight:1 }} title="Retrasado">R</span>}
                                </div>
                                <div style={{ fontSize:13.2, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                                {f.loadDate && <div style={{ fontSize:12.7, color:C.t3, fontWeight:500, marginTop:2 }}>{Ic.cal(C.t3,9)} {formatFreightDate(f.loadDate)}{f.loadTime?` · ${f.loadTime}`:""}</div>}
                              </div>
                              <div style={{ fontSize:12.1, color:C.t3, textAlign:"right", flexShrink:0 }}>
                                {destDisplay(f) && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.plant(C.t3,10)} <span style={{ maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{destDisplay(f)}</span></div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Freights without driver */}
                  {t.noDriver.length>0 && (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        {Ic.user(C.t3,14)}
                        <span style={{ fontSize:13.2, fontWeight:600, color:C.t3, fontStyle:"italic" }}>Sin chofer asignado</span>
                        <span style={{ fontSize:11, fontWeight:600, color:C.t3, background:`${C.t3}12`, padding:"2px 8px", borderRadius: R.sm }}>{t.noDriver.length}</span>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:22 }}>
                        {t.noDriver.map(f=>{
                          const st = stCfg(f.status);
                          return (
                            <div key={f.id} onClick={()=>onNav("detail",f.id)} onMouseEnter={(e)=>handleCardMouseEnter(f,e)} onMouseLeave={handleCardMouseLeave} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius: R.md, border:`1px dashed ${C.b1}`, background:C.bg, cursor:"pointer" }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:12.7, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                                  <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                                  {f.isOverdue && <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:16, height:16, borderRadius: R.xs, background:"#FEE2E2", flexShrink:0, fontSize:10, fontWeight:800, color:"#DC2626", lineHeight:1 }} title="Retrasado">R</span>}
                                </div>
                                <div style={{ fontSize:13.2, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                              </div>
                              <div style={{ fontSize:12.1, color:C.t3, textAlign:"right", flexShrink:0 }}>
                                {destDisplay(f) && <div>{destDisplay(f)}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>}
              </div>
            );
          })}
          {/* Unassigned freights */}
          {trackingGroups.unassigned.length>0 && (
            <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, overflow:"hidden", boxShadow:C.sh }}>
              <div style={{ padding:"12px 16px", borderBottom:`2px solid ${C.t3}`, display:"flex", alignItems:"center", gap:8, background:`${C.t3}08` }}>
                {Ic.warn(C.t3,16)}
                <span style={{ fontSize:14.3, fontWeight:700, color:C.t2 }}>Sin asignar</span>
                <span style={{ fontSize:11, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{trackingGroups.unassigned.length}</span>
              </div>
              <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
                {trackingGroups.unassigned.map(f=>{
                  const st = stCfg(f.status);
                  return (
                    <div key={f.id} onClick={()=>onNav("detail",f.id)} onMouseEnter={(e)=>handleCardMouseEnter(f,e)} onMouseLeave={handleCardMouseLeave} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius: R.md, border:`1px dashed ${C.b1}`, borderLeft:`3px solid ${st.color}`, background:C.bg, cursor:"pointer" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:11, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                          <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                          {f.isOverdue && <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:16, height:16, borderRadius: R.xs, background:"#FEE2E2", flexShrink:0, fontSize:10, fontWeight:800, color:"#DC2626", lineHeight:1 }} title="Retrasado">R</span>}
                        </div>
                        <div style={{ fontSize:13.2, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                      </div>
                      <div style={{ fontSize:12.1, color:C.t3, textAlign:"right", flexShrink:0 }}>
                        {f.originCompanyName && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.user(C.t3,10)} {f.originCompanyName}</div>}
                        {destDisplay(f) && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.plant(C.t3,10)} {destDisplay(f)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {trackingGroups.transporters.length===0 && trackingGroups.unassigned.length===0 && (
            <EmptyState icon={Ic.truck(C.t3,28)} title="Sin fletes activos" subtitle="No hay fletes en curso para mostrar en seguimiento"/>
          )}
        </div>
      )}
      </>)}

      {/* Load more / pagination indicator */}
      {(()=>{
        const visibleCount = hasFilters ? filteredFinal.length : Object.values(grouped).reduce((s,a)=>s+a.length,0);
        return <>
          {serverData !== null && serverHasMore && (
            <div style={{textAlign:"center",padding:"16px 0 24px"}}>
              {serverTotal>0 && <div style={{fontSize:11,color:C.t3,marginBottom:6}}>Mostrando {filteredFinal.length} de {serverTotal}</div>}
              <button onClick={loadMoreServer} disabled={serverLoadingMore} style={{padding:"8px 24px",borderRadius: R.md,border:`1.5px solid ${C.pri}`,background:C.w,color:C.pri,fontSize:13.2,fontWeight:700,cursor:serverLoadingMore?"default":"pointer",fontFamily:"inherit",opacity:serverLoadingMore?0.5:1}}>
                {serverLoadingMore?"Cargando...":"Cargar mas resultados"}
              </button>
            </div>
          )}
          {serverData === null && hasMore && (
            <div style={{textAlign:"center",padding:"16px 0 24px"}}>
              {total>0 && <div style={{fontSize:11,color:C.t3,marginBottom:6}}>Mostrando {visibleCount} de {total}</div>}
              <button onClick={loadMore} disabled={loadingMore} style={{padding:"8px 24px",borderRadius: R.md,border:`1.5px solid ${C.pri}`,background:C.w,color:C.pri,fontSize:13.2,fontWeight:700,cursor:loadingMore?"default":"pointer",fontFamily:"inherit",opacity:loadingMore?0.5:1}}>
                {loadingMore?"Cargando...":"Cargar mas fletes"}
              </button>
            </div>
          )}
          {visibleCount>0 && <div style={{textAlign:"center",padding:"4px 0 16px",fontSize:11,color:C.t3}}>{visibleCount} flete{visibleCount!==1?"s":""}{hasFilters?" con filtros aplicados":""}</div>}
        </>;
      })()}
      {FreightHoverPreview}
    </div>
  );
});
