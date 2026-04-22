import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { C, Ic, MONO, R, STATUS_COLORS } from "../theme";
import { stCfg, getActions, formatFreightDate } from "../constants";
import { Bd, Btn, SkeletonList, SkeletonCard, EmptyState, Tabs, FreightCard, FreightCardCompact, ActiveTripCard } from "../components";
import { useIsDesktop, mapFreight, originDisplay, destDisplay } from "../hooks";
import { useAccessLevel } from "../hooks/useAccessLevel";
import { getPendingActions, resolveUserTypeForFreight, getThirdPartyLabel } from "../utils/freight-helpers";
import { apiListFreights, apiGetFleetAlerts } from "../api";
import DetailScreen from "./DetailScreen";

const GROUP_PAGE_SIZE = 5;

// Sentinel element — triggers loadMore via IntersectionObserver when scrolled into view
function GroupSentinel({ gKey, onVisible }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onVisible(gKey); }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [gKey, onVisible]);
  return <div ref={ref} style={{ height: 1 }} />;
}

// Action groups — grouping pending items by pending action type
const ACTION_GROUPS = [
  { key: "approve_producer", label: "Aceptar flete de productor", color: C.sec, priority: 0 },
  { key: "assign", label: "Asignar transporte", color: C.acc, priority: 1 },
  { key: "respond", label: "Aceptar o rechazar", color: C.sec, priority: 2 },
  { key: "authorize", label: "Autorizar viaje", color: C.sec, priority: 3 },
  { key: "start", label: "Iniciar viaje", color: C.pri, priority: 4 },
  { key: "confirm_loaded", label: "Confirmar carga", color: C.acc, priority: 5 },
  { key: "confirm_finished", label: "Confirmar entrega", color: C.pri, priority: 6 },
];

// Progress groups — for summary view (items without pending actions), matching the 3-step progress bar in DetailScreen
const PROGRESS_GROUPS = [
  { key:"pendiente",   label:"Pendiente",  color:C.acc, statuses:["pending_assignment"] },
  { key:"en_curso",    label:"En curso",   color:C.pri, statuses:["assigned","accepted","in_progress","loaded"] },
];

// Status order for daily summary grouping — colors sourced from stCfg (STATUS_LIGHT)
const DAILY_STATUS_ORDER = [
  { key: "in_progress",        label: "En viaje a campo",      get color() { return stCfg("in_progress").color; } },
  { key: "loaded",             label: "En viaje a planta",     get color() { return stCfg("loaded").color; } },
  { key: "accepted",           label: "Asignado",              get color() { return stCfg("accepted").color; } },
  { key: "assigned",           label: "Asignado",              get color() { return stCfg("assigned").color; } },
  { key: "pending_assignment", label: "Pendiente",             get color() { return stCfg("pending_assignment").color; } },
];

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function formatTodayHeader() {
  const d = new Date();
  return `Fletes de hoy \u2014 ${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export default memo(function HomeScreen({ user, freights, loading, error, perms, onNav, catalog, isDesktop, onAction, onTripAction, onEditTrip, actionLoading, onChat, onRefresh, onRetry, onDuplicate, onEdit, goToMap, simpleMode, statusCounts }) {
  const [selectedId, setSelectedId] = useState(null);
  // Track which panel originated the selection: "pending" (left) or "daily" (right)
  const [selectionSource, setSelectionSource] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  // Mobile tab: "pending" or "daily"
  const [mobileTab, setMobileTab] = useState("pending");
  const { isConsulta, isConsultaFor } = useAccessLevel(user);
  const [fleetAlerts, setFleetAlerts] = useState(null);

  useEffect(() => {
    apiGetFleetAlerts().then(setFleetAlerts).catch(() => setFleetAlerts([]));
  }, []);

  const selectFreight = useCallback((id, source) => {
    setSelectedId(id);
    setSelectionSource(source);
  }, []);

  const deselectFreight = useCallback(() => {
    setSelectedId(null);
    setSelectionSource(null);
  }, []);

  // Build company list from user types + freight data (works even if companyByType is empty)
  const typeLabels = { producer: "Productor", plant: "Planta", transporter: "Transportista" };
  const myCompanies = useMemo(() => {
    const types = user.userTypes || [user.userType];
    if (types.length <= 1) return [{ key: user.userType, name: user.entity, type: user.userType }];
    // For each type, find the company name from freight data or catalog
    return types.map(type => {
      const cbt = user.companyByType || {};
      const companyId = cbt[type] || user.companyId;
      // Try primary company
      let name = companyId === user.companyId ? user.entity : null;
      // Try catalog
      if (!name) {
        const t = (catalog.transporters || []).find(x => x.id === companyId);
        if (t) name = t.name;
      }
      if (!name) {
        const p = (catalog.plants || []).find(x => x.id === companyId || x.companyId === companyId);
        if (p) name = p.name;
      }
      // Scan freights for this type's company name
      if (!name) {
        for (const f of freights) {
          if (resolveUserTypeForFreight(f, user) === type) {
            if (type === "plant" && f.destName) { name = f.destName; break; }
            if (type === "transporter" && f.transporterName) { name = f.transporterName; break; }
          }
        }
      }
      if (!name) name = typeLabels[type] || type;
      return { key: type, name, type };
    });
  }, [user, freights, catalog.transporters, catalog.plants]);

  const [activeTypes, setActiveTypes] = useState(null); // null = all types
  const toggleType = (key) => {
    setActiveTypes(prev => {
      const all = new Set(myCompanies.map(c => c.key));
      const cur = prev ? new Set(prev) : new Set(all);
      if (cur.has(key)) { cur.delete(key); if (cur.size === 0) return new Set(all); }
      else cur.add(key);
      return cur.size === all.size ? null : cur;
    });
  };
  const isTypeActive = (key) => !activeTypes || activeTypes.has(key);
  const allSelected = !activeTypes;
  const hasMultipleCompanies = myCompanies.length > 1;

  // Filter freights by selected types (using resolved type per freight)
  const filteredFreights = useMemo(() => {
    if (!activeTypes) return freights;
    return freights.filter(f => activeTypes.has(resolveUserTypeForFreight(f, user)));
  }, [freights, activeTypes, user]);

  // Date helpers
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    if (preset === "today") { setDateFrom(fmt(today)); setDateTo(fmt(today)); }
    else if (preset === "week") { const w = new Date(today); w.setDate(w.getDate() - 7); setDateFrom(fmt(w)); setDateTo(fmt(today)); }
    else if (preset === "month") { const m = new Date(today); m.setMonth(m.getMonth() - 1); setDateFrom(fmt(m)); setDateTo(fmt(today)); }
    else { setDateFrom(""); setDateTo(""); }
  };
  const clearDateFilter = () => { setDateFrom(""); setDateTo(""); setDatePreset(""); };
  const hasDateFilter = dateFrom || dateTo;

  const matchDate = (loadDate) => {
    if (!dateFrom && !dateTo) return true;
    if (!loadDate) return false;
    if (dateFrom && loadDate < dateFrom) return false;
    if (dateTo && loadDate > dateTo) return false;
    return true;
  };

  // Helper: resolve effective userType per freight for multi-type users
  const effectiveType = useCallback((f) => resolveUserTypeForFreight(f, user), [user]);

  // I4: Compute pending actions ONCE per freight, reuse everywhere
  // CONSULTA check: skip pending actions for freights where user is READONLY
  const pendingMap = useMemo(() => {
    const map = new Map();
    filteredFreights.forEach(f => {
      // Per-freight CONSULTA: if user is READONLY for this freight's destination, no pending actions
      if (f.destCompanyId && isConsultaFor(f.destCompanyId)) return;
      map.set(f.id, getPendingActions(f, effectiveType(f), user.role, user));
    });
    return map;
  }, [filteredFreights, effectiveType, user.id, user.role, user.companyId, user.userType, user.activeCompanyId, user.userTypes, isConsultaFor]);

  // Pending groups — grouped by pending action type
  const pendingByProgress = useMemo(() => {
    return ACTION_GROUPS.map(g => {
      const items = filteredFreights
        .filter(f => {
          const pa = pendingMap.get(f.id);
          if (!pa) return false;
          if (!matchDate(f.loadDate)) return false;
          // Multi-truck: freight can appear in multiple groups via groupKeys array
          if (pa.groupKeys) return pa.groupKeys.includes(g.key);
          return pa.groupKey === g.key;
        })
        .map(f => ({ ...f, pendingAction: pendingMap.get(f.id) }))
        .sort((a, b) => (a.destName||'').localeCompare(b.destName||'') || (a.originName||'').localeCompare(b.originName||'') || a.id.localeCompare(b.id));
      return { ...g, icon: g.key==="assign"?Ic.truck:g.key==="respond"?Ic.msg:g.key==="authorize"?Ic.chk:g.key==="start"?Ic.nav:g.key==="confirm_loaded"?Ic.warn:Ic.chk, items };
    }).filter(g => g.items.length > 0);
  }, [filteredFreights, pendingMap, dateFrom, dateTo]);
  const pendingCount = new Set(pendingByProgress.flatMap(g => g.items.map(f => f.id))).size;
  const hasPending = pendingCount > 0;

  // Total pending (unfiltered) to know if section should show
  const totalPendingAll = useMemo(() => {
    let count = 0;
    for (const pa of pendingMap.values()) { if (pa) count++; }
    return count;
  }, [pendingMap]);

  // Third-party sub-groups — freights without pending actions, grouped by what's being waited on
  const thirdPartyGroups = useMemo(() => {
    const allItems = filteredFreights
      .filter(f => !pendingMap.get(f.id) && matchDate(f.loadDate) && f.status !== 'finished' && f.status !== 'canceled')
      .sort((a, b) => (a.destName||'').localeCompare(b.destName||'') || (a.originName||'').localeCompare(b.originName||'') || a.id.localeCompare(b.id));
    if (!allItems.length) return [];
    const grouped = new Map();
    allItems.forEach(f => {
      const label = getThirdPartyLabel(f, effectiveType(f));
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(f);
    });
    return [...grouped.entries()].map(([label, items]) => ({
      key: "tp_" + label.toLowerCase().replace(/\s+/g, '_'),
      label,
      color: C.ok,
      icon: Ic.clk,
      items,
    }));
  }, [filteredFreights, pendingMap, effectiveType, dateFrom, dateTo]);

  // Third-party sub-group accordion (separate from main accordion)
  const [openTp, setOpenTp] = useState(null);

  // Accordion state — only one group open at a time
  const [openGroup, setOpenGroup] = useState(null);
  // expandedData: { gKey: { items: [], loading: bool, loadingMore: bool, hasMore: bool, page: number, statuses: string[] } }
  const [expandedData, setExpandedData] = useState({});
  const expandedRef = useRef({}); // mirror for synchronous reads
  expandedRef.current = expandedData;

  const fetchGroupPage = useCallback((gKey, statuses, page) => {
    const isFirst = page === 1;
    setExpandedData(d => ({
      ...d,
      [gKey]: {
        ...(d[gKey] || {}),
        items: isFirst ? [] : (d[gKey]?.items || []),
        statuses,
        loading: isFirst,
        loadingMore: !isFirst,
      },
    }));
    apiListFreights({ status: statuses.join(","), limit: GROUP_PAGE_SIZE, page })
      .then(r => {
        const mapped = (r.data || []).map(mapFreight);
        setExpandedData(d => {
          const prev = d[gKey] || {};
          const merged = isFirst ? mapped : [...(prev.items || []), ...mapped];
          const seen = new Set();
          const items = merged.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
          return {
            ...d,
            [gKey]: { ...prev, items, loading: false, loadingMore: false, hasMore: (r.page || 1) < (r.pages || 1), page: r.page || page },
          };
        });
      })
      .catch((e) => {
        console.warn("LoadMore failed:", e?.message);
        setExpandedData(d => ({
          ...d,
          [gKey]: { ...(d[gKey] || {}), loading: false, loadingMore: false },
        }));
      });
  }, []);

  const resolveStatuses = useCallback((gKey) => {
    const prefix = gKey.split("_")[0];
    const groupKey = gKey.slice(prefix.length + 1);
    if (prefix === "sm") {
      const pg = PROGRESS_GROUPS.find(g => g.key === groupKey);
      return pg ? pg.statuses : [];
    }
    return ["pending_assignment", "assigned", "accepted", "in_progress", "loaded"];
  }, []);

  const toggleGroup = useCallback((gKey) => {
    setOpenGroup(prev => {
      if (prev === gKey) return null;
      // Clear old expanded data to prevent memory accumulation
      const oldKey = prev;
      if (oldKey && oldKey !== gKey) {
        setExpandedData(d => { const next = {...d}; delete next[oldKey]; return next; });
      }
      // "pa_" groups already have correctly filtered items in memory — no API fetch needed
      if (gKey.startsWith("pa_")) return gKey;
      // Reuse cached data if available — avoids re-fetch on tab switch
      const cached = expandedRef.current[gKey];
      if (!cached?.items?.length) {
        const statuses = resolveStatuses(gKey);
        if (statuses.length > 0) fetchGroupPage(gKey, statuses, 1);
      }
      return gKey;
    });
  }, [fetchGroupPage, resolveStatuses]);

  const loadMoreGroup = useCallback((gKey) => {
    const exp = expandedRef.current[gKey];
    if (!exp || exp.loading || exp.loadingMore || !exp.hasMore) return;
    fetchGroupPage(gKey, exp.statuses, (exp.page || 1) + 1);
  }, [fetchGroupPage]);

  // Selected freight for detail — also check expanded data for freights loaded on-expand
  const selFreight = selectedId ? (
    filteredFreights.find(f => f.id === selectedId)
    || freights.find(f => f.id === selectedId)
    || Object.values(expandedData).flatMap(d => d.items || []).find(f => f.id === selectedId)
  ) : null;
  const hasDetail = selectedId && selFreight;

  // ======================== DAILY SUMMARY ========================

  const todayFreights = useMemo(() => {
    return filteredFreights
      .filter(f => f.loadDate === todayStr)
      .sort((a, b) => (a.loadTime || "").localeCompare(b.loadTime || "") || (a.code || "").localeCompare(b.code || ""));
  }, [filteredFreights, todayStr]);

  const todayTons = useMemo(() => todayFreights.reduce((s, f) => s + (parseFloat(f.tons) || 0), 0), [todayFreights]);

  const dailyGroups = useMemo(() => {
    return DAILY_STATUS_ORDER.map(g => {
      const items = todayFreights.filter(f => f.status === g.key);
      return { ...g, items };
    }).filter(g => g.items.length > 0);
  }, [todayFreights]);

  // ======================== RENDER HELPERS ========================

  // Active trips (in_progress + loaded) for "Viajes en curso" section
  const activeTrips = useMemo(() => filteredFreights.filter(f => f.status === "in_progress" || f.status === "loaded"), [filteredFreights]);

  // Render a freight card — compact when detail is open on desktop
  const renderCard = (f, pa, source) => {
    const compact = hasDetail && isDesktop;
    if (compact) {
      return <FreightCardCompact key={f.id} freight={f} onClick={() => selectFreight(f.id, source)} showTime />;
    }
    return <FreightCard key={f.id} freight={f} onClick={() => selectFreight(f.id, source)} />;
  };

  // Render a collapsible group (accordion — opening one hides others)
  // btnOnly=true: render only the header button, no inline expanded content
  const renderGroup = (group, keyPrefix, source, allGroups, btnOnly = false) => {
    const gKey = keyPrefix + "_" + group.key;
    const isOpen = openGroup === gKey;
    if (!btnOnly) {
      const anotherOpen = openGroup && openGroup.startsWith(keyPrefix + "_") && openGroup !== gKey;
      if (anotherOpen) return null;
    }

    // When open, use fetched paginated data
    const exp = expandedData[gKey];
    let displayItems = group.items;
    let isLoadingFirst = false;
    if (isOpen && exp) {
      if (exp.loading) {
        isLoadingFirst = true;
      } else {
        displayItems = exp.items || [];
      }
    }

    return (
      <div key={gKey} style={{ marginBottom: 10 }}>
        <button onClick={() => toggleGroup(gKey)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isOpen ? `${group.color}10` : C.w, border: `1px solid ${isOpen ? `${group.color}35` : C.b1}`, borderRadius: R.lg, cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxShadow: isOpen ? "0 4px 14px rgba(0,0,0,0.04)" : "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: R.md, background: `${group.color}16`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {typeof group.icon === "function" ? group.icon(group.color, 16) : group.icon}
          </div>
          <div style={{ minWidth: 34, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: group.color, lineHeight: 1 }}>{group.realCount ?? group.items.length}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{group.label}</div>
          </div>
          <span style={{ display: "flex", transform: isOpen ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>{Ic.chev(C.t3, 14)}</span>
        </button>
        {!btnOnly && isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0 4px 16px", borderLeft: `2px solid ${group.color}30`, marginLeft: 16 }}>
            {isLoadingFirst && <SkeletonList count={3} />}
            {!isLoadingFirst && displayItems.map(f => renderCard(f, pendingMap.get(f.id) || getPendingActions(f, effectiveType(f), user.role, user), source))}
            {!isLoadingFirst && exp?.loadingMore && <SkeletonList count={2} />}
            {!isLoadingFirst && exp?.hasMore && !exp?.loadingMore && <GroupSentinel gKey={gKey} onVisible={loadMoreGroup} />}
          </div>
        )}
      </div>
    );
  };

  // Render a third-party sub-group (simple collapsible, no pagination)
  // btnOnly=true: render only the header button, no inline expanded content
  const renderTpGroup = (group, btnOnly = false) => {
    const isOpen = openTp === group.key;
    if (!btnOnly) {
      const anotherOpen = openTp && openTp !== group.key;
      if (anotherOpen) return null;
    }
    return (
      <div key={group.key} style={{ marginBottom: 10 }}>
        <button onClick={() => setOpenTp(prev => prev === group.key ? null : group.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isOpen ? `${group.color}10` : C.w, border: `1px solid ${isOpen ? `${group.color}35` : C.b1}`, borderRadius: R.lg, cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxShadow: isOpen ? "0 4px 14px rgba(0,0,0,0.04)" : "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: R.md, background: `${group.color}16`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {Ic.clk(group.color, 16)}
          </div>
          <div style={{ minWidth: 34, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: group.color, lineHeight: 1 }}>{group.items.length}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{group.label}</div>
          </div>
          <span style={{ display: "flex", transform: isOpen ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>{Ic.chev(C.t3, 14)}</span>
        </button>
        {!btnOnly && isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0 4px 16px", borderLeft: `2px solid ${group.color}30`, marginLeft: 16 }}>
            {group.items.map(f => renderCard(f, pendingMap.get(f.id) || getPendingActions(f, effectiveType(f), user.role, user), "pending"))}
          </div>
        )}
      </div>
    );
  };

  // ======================== PANEL: PENDING/AL DIA ========================

  const renderPendingPanel = (compact) => (
    <div style={{ flex: compact ? undefined : 1, width: compact ? 300 : undefined, flexShrink: 0, overflow: compact ? "auto" : undefined, boxSizing: "border-box", borderRight: compact ? `1px solid ${C.b1}` : "none" }}>
      {compact && <div style={{ position: "sticky", top: 0, zIndex: 10, background:C.bg, minHeight: 8 }} />}

      <div style={{ padding: compact ? "0 8px 8px" : "18px 18px 18px" }}>

      {(()=>{
        const isInitialLoad = loading && freights.length === 0;
        const smOpen = openGroup && openGroup.startsWith("sm_");
        const paOpen = openGroup && openGroup.startsWith("pa_");
        return <>
        {/* Ver todo — shown when any group is expanded, sticky at top */}
        {openGroup && <div style={{ position:"sticky", top:0, zIndex:11, background:C.bg, paddingTop:4, paddingBottom:4 }}><div style={{ display:"flex", justifyContent:"center" }}><button onClick={() => setOpenGroup(null)} style={{ display:"inline-flex", alignItems:"center", padding:"6px 16px", borderRadius: R.pill, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 1px 2px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize:12.1, fontWeight:600, color:C.t2 }}>Ver todo</span>
        </button></div></div>}
        {/* Date filter — standalone, before pendientes */}
        <div style={{ padding: compact ? "6px 8px" : "8px 12px", borderRadius: R.md, border: `1px solid ${hasDateFilter ? C.acc + "40" : C.b1}`, background: hasDateFilter ? `${C.acc}08` : C.w, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setDateFilterOpen(p => !p)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: R.sm, border: `1px solid ${hasDateFilter ? C.acc : C.b1}`, background: hasDateFilter ? `${C.acc}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9.9 : 11, fontWeight: 600, color: hasDateFilter ? C.acc : C.t3, display: "flex", alignItems: "center", gap: 3 }}>
              {Ic.cal(hasDateFilter ? C.acc : C.t3, compact ? 10 : 11)} {dateFilterOpen ? "Ocultar fechas" : "Filtrar por fecha"}{hasDateFilter ? " (activo)" : ""}
            </button>
            {hasDateFilter && <button onClick={clearDateFilter} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: R.sm, border: `1px solid ${C.err}40`, background: C.errPale, cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9.9 : 11, fontWeight: 600, color: C.err }}>Limpiar</button>}
          </div>
          {dateFilterOpen && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: compact ? 9.9 : 11, color: C.t2, fontWeight: 600 }}>Desde</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDatePreset("custom"); }} onClick={e => e.target.showPicker?.()} style={{ padding: "3px 6px", borderRadius: R.sm, border: `1px solid ${C.b1}`, background: C.w, color: dateFrom ? C.t1 : C.t3, fontSize: compact ? 9.9 : 11, fontFamily: "inherit", outline: "none", cursor: "pointer" }} />
            <span style={{ fontSize: compact ? 9.9 : 11, color: C.t2, fontWeight: 600 }}>Hasta</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setDatePreset("custom"); }} onClick={e => e.target.showPicker?.()} style={{ padding: "3px 6px", borderRadius: R.sm, border: `1px solid ${C.b1}`, background: C.w, color: dateTo ? C.t1 : C.t3, fontSize: compact ? 9.9 : 11, fontFamily: "inherit", outline: "none", cursor: "pointer" }} />
            {[{ k: "today", l: "Hoy" }, { k: "week", l: "Semana" }, { k: "month", l: "Mes" }].map(p => (
              <button key={p.k} onClick={() => applyDatePreset(p.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: R.sm, border: `1px solid ${datePreset === p.k ? C.acc : C.b1}`, background: datePreset === p.k ? `${C.acc}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9.9 : 11, fontWeight: 600, color: datePreset === p.k ? C.acc : C.t3 }}>{p.l}</button>
            ))}
          </div>}
        </div>

        {/* Fleet document alerts */}
        {fleetAlerts?.trucksWithExpired > 0 && !openGroup && (
          <div onClick={() => onNav?.("trucks")} style={{ padding: compact ? "8px 10px" : "10px 14px", borderRadius: R.lg, background: C.errPale, marginBottom: 8, cursor: "pointer", border: `1px solid ${C.err}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {Ic.doc(C.err, compact ? 14 : 16)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: compact ? 11.5 : 13, fontWeight: 700, color: C.err }}>{fleetAlerts.trucksWithExpired} camión{fleetAlerts.trucksWithExpired > 1 ? "es" : ""} con documentos vencidos</div>
              </div>
              <span style={{ opacity: 0.5 }}>{Ic.chev(C.err, 12)}</span>
            </div>
          </div>
        )}
        {fleetAlerts?.trucksWithExpiring > 0 && !fleetAlerts?.trucksWithExpired && !openGroup && (
          <div onClick={() => onNav?.("trucks")} style={{ padding: compact ? "8px 10px" : "10px 14px", borderRadius: R.lg, background: C.warnPale, marginBottom: 8, cursor: "pointer", border: `1px solid ${C.warn}20` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {Ic.doc(C.warn, compact ? 14 : 16)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: compact ? 11.5 : 13, fontWeight: 700, color: C.warn }}>{fleetAlerts.trucksWithExpiring} camión{fleetAlerts.trucksWithExpiring > 1 ? "es" : ""} con documentos por vencer</div>
              </div>
              <span style={{ opacity: 0.5 }}>{Ic.chev(C.warn, 12)}</span>
            </div>
          </div>
        )}

        {/* Initial load: show panel structure with skeletons */}
        {isInitialLoad && <>
          <div style={{ padding: compact ? "8px 10px" : "12px 14px", borderRadius: R.lg, background: `${C.acc}0D`, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
              {!compact && <span style={{ fontSize: 24.2, fontWeight: 800, color: C.acc, lineHeight: 1, minWidth: 28, textAlign: "center", opacity: 0.4 }}>—</span>}
              {compact && <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: 0.5 }}>
                {Ic.bell(C.w, 13)}
              </div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: compact ? 12.1 : 14.3, fontWeight: 700, color: C.acc }}>Cargando pendientes...</div>
              </div>
            </div>
          </div>
          <SkeletonList count={3} />
        </>}

        {/* Non-compact: two-column layout — pendientes izq, esperando der */}
        {!isInitialLoad && !compact && (<>
          {totalPendingAll > 0 && (
            <div style={{ padding: "12px 14px", borderRadius: R.lg, background: `${C.acc}0D`, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24.2, fontWeight: 800, color: C.acc, lineHeight: 1, minWidth: 28, textAlign: "center" }}>{pendingCount}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.3, fontWeight: 700, color: C.acc }}>{`Acción${pendingCount !== 1 ? "es" : ""} pendiente${pendingCount !== 1 ? "s" : ""}`}</div>
                  <div style={{ fontSize: 11.6, color: C.t3 }}>Requieren tu atención</div>
                </div>
              </div>
            </div>
          )}
          {(totalPendingAll > 0 || thirdPartyGroups.length > 0) && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              {totalPendingAll > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  {pendingByProgress.length > 0
                    ? pendingByProgress.map(g => renderGroup(g, "pa", "pending", undefined, true))
                    : <div style={{ padding: "12px 16px", fontSize: 13.2, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>{Ic.chk(C.ok, 14)} Sin pendientes en este periodo</div>
                  }
                </div>
              )}
              {thirdPartyGroups.length > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 2px 8px" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: C.ok, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {Ic.chk(C.w, 9)}
                    </div>
                    <span style={{ fontSize: 11.6, fontWeight: 700, color: C.ok }}>Sin pendientes de mi parte</span>
                  </div>
                  {thirdPartyGroups.map(g => renderTpGroup(g, true))}
                </div>
              )}
            </div>
          )}
          {openGroup?.startsWith("pa_") && (()=>{
            const activeGroup = pendingByProgress.find(g => "pa_" + g.key === openGroup);
            if (!activeGroup) return null;
            const exp = expandedData[openGroup];
            const isLoadingFirst = !!exp?.loading;
            const displayItems = isLoadingFirst ? [] : (exp?.items || activeGroup.items);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0 4px 16px", borderLeft: `2px solid ${activeGroup.color}30`, marginLeft: 16, marginBottom: 8 }}>
                {isLoadingFirst && <SkeletonList count={3} />}
                {!isLoadingFirst && displayItems.map(f => renderCard(f, pendingMap.get(f.id) || getPendingActions(f, effectiveType(f), user.role, user), "pending"))}
                {!isLoadingFirst && exp?.loadingMore && <SkeletonList count={2} />}
                {!isLoadingFirst && exp?.hasMore && !exp?.loadingMore && <GroupSentinel gKey={openGroup} onVisible={loadMoreGroup} />}
              </div>
            );
          })()}
          {openTp && (()=>{
            const activeTpGroup = thirdPartyGroups.find(g => g.key === openTp);
            if (!activeTpGroup) return null;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0 4px 16px", borderLeft: `2px solid ${activeTpGroup.color}30`, marginLeft: 16, marginBottom: 8 }}>
                {activeTpGroup.items.map(f => renderCard(f, pendingMap.get(f.id) || getPendingActions(f, effectiveType(f), user.role, user), "pending"))}
              </div>
            );
          })()}
          {totalPendingAll === 0 && thirdPartyGroups.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 13.2, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>{Ic.chk(C.ok, 14)} Sin pendientes en este periodo</div>
          )}
        </>)}

        {/* Compact (desktop sidebar): lista vertical existente */}
        {!isInitialLoad && compact && (<>
          {!smOpen && totalPendingAll > 0 && (<>
            <div style={{ padding: "8px 10px", borderRadius: R.lg, background: `${C.acc}0D`, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                  {Ic.bell(C.w, 13)}
                  <div style={{ position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: R.md, background: C.err, color: C.w, fontSize: 8.8, fontWeight: 700, padding: "0 3px", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.w}` }}>{pendingCount}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.1, fontWeight: 700, color: C.acc }}>Con pendientes de mi parte</div>
                </div>
              </div>
            </div>
            {pendingByProgress.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {pendingByProgress.map(g => renderGroup(g, "pa", "pending"))}
              </div>
            )}
          </>)}
          {!paOpen && thirdPartyGroups.length > 0 && <>
            <div style={{ padding: thirdPartyGroups.length === 1 ? "8px 10px" : "6px 10px", borderRadius: R.lg, background: C.okPale, marginBottom: thirdPartyGroups.length === 1 ? 8 : 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.ok, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {Ic.chk(C.w, 11)}
                </div>
                <div style={{ flex: 1, fontSize: 12.1, fontWeight: 700, color: C.ok }}>Sin pendientes de mi parte</div>
              </div>
            </div>
            <div>{thirdPartyGroups.map(g => renderTpGroup(g))}</div>
          </>}
        </>)}
        </>;
      })()}
      </div>
    </div>
  );

  // ======================== PANEL: DAILY SUMMARY ========================

  const renderDailyPanel = (compact) => (
    <div style={{ flex: compact ? undefined : 1, width: compact ? 300 : undefined, flexShrink: 0, overflow: compact ? "auto" : undefined, boxSizing: "border-box", borderRight: compact ? `1px solid ${C.b1}` : "none" }}>
      {compact && <div style={{ position: "sticky", top: 0, zIndex: 10, background:C.bg, minHeight: 8 }} />}

      <div style={{ padding: compact ? "0 8px 8px" : "18px 18px 18px" }}>
        {/* Header */}
        <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: R.lg, background: `${C.pri}0D`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
            <div style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: "50%", background: C.pri, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {Ic.cal(C.w, compact ? 13 : 16)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: compact ? 12.1 : 13.2, fontWeight: 700, color: C.pri }}>{compact ? `Hoy (${todayFreights.length})` : formatTodayHeader()}</div>
              {!compact && <div style={{ fontSize: 11, color: C.t3 }}>{todayFreights.length} flete{todayFreights.length !== 1 ? "s" : ""} · {Math.round(todayTons)} tn totales</div>}
            </div>
          </div>
        </div>

        {/* Skeleton while loading */}
        {loading && freights.length === 0 && <SkeletonList count={3} />}

        {/* Error state */}
        {error && !loading && freights.length === 0 && (
          <div style={{padding:16,textAlign:"center"}}>
            <div style={{color:C.err,fontSize:14,marginBottom:8}}>Error al cargar fletes: {error}</div>
            {onRetry && <Btn variant="outline" onClick={onRetry}>Reintentar</Btn>}
          </div>
        )}

        {/* Empty state */}
        {todayFreights.length === 0 && !loading && !error && (
          <EmptyState icon={Ic.cal(C.t3, 28)} title="Sin fletes para hoy" subtitle="No hay fletes programados para la fecha de hoy" />
        )}

        {/* Active trips section */}
        {activeTrips.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: `2px solid ${STATUS_COLORS.in_progress.ribbon}`, marginBottom: 8 }}>
              {Ic.nav(STATUS_COLORS.in_progress.ribbon, 14)}
              <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLORS.in_progress.pillText, textTransform: "uppercase", letterSpacing: 0.5 }}>Viajes en curso</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>({activeTrips.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeTrips.map(f => <ActiveTripCard key={f.id} freight={f} onClick={() => selectFreight(f.id, "daily")} />)}
            </div>
          </div>
        )}

        {/* Groups by status */}
        {dailyGroups.map(g => (
          <div key={g.key} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: `1px solid ${C.b2}`, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.1, fontWeight: 700, color: g.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{g.label}</span>
              <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t3 }}>({g.items.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: compact ? 12 : 16, borderLeft: `2px solid ${g.color}30` }}>
              {g.items.map(f => renderCard(f, pendingMap.get(f.id), "daily"))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ======================== LAYOUT ========================

  // Resolve effective userType for selected freight so DetailScreen shows correct actions
  const detailUser = selFreight ? { ...user, userType: effectiveType(selFreight) } : user;
  const detailScreen = <DetailScreen user={detailUser} freight={selFreight} perms={perms} onBack={deselectFreight} onAction={onAction} onTripAction={onTripAction} onEditTrip={onEditTrip} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} goToMap={goToMap} />;

  // ======================== SIMPLE MODE ========================
  if (simpleMode) {
    // Flat list: active freights sorted by pending-from-me first, then loadDate
    const simpleFreights = filteredFreights
      .filter(f => f.status !== "finished" && f.status !== "canceled")
      .map(f => ({ ...f, _pending: pendingMap.get(f.id) || null }))
      .sort((a, b) => {
        // Pending from me first
        if (a._pending && !b._pending) return -1;
        if (!a._pending && b._pending) return 1;
        // Then by loadDate ascending
        return (a.loadDate || "").localeCompare(b.loadDate || "") || (a.loadTime || "").localeCompare(b.loadTime || "");
      });

    const renderSimpleCard = (f) => {
      return <FreightCard key={f.id} freight={f} onClick={() => selectFreight(f.id, "pending")} />;
    };


    const pendingSimple = simpleFreights.filter(f => f._pending);
    const restSimple = simpleFreights.filter(f => !f._pending);

    const simpleDailyPanel = (
      <div style={{ padding: "14px 16px", borderRadius: R.lg, background: `${C.pri}08`, border: `1px solid ${C.pri}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.pri, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {Ic.cal(C.w, 14)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.3, fontWeight: 700, color: C.pri }}>{formatTodayHeader()}</div>
            <div style={{ fontSize: 11, color: C.t3 }}>{todayFreights.length} flete{todayFreights.length !== 1 ? "s" : ""} · {Math.round(todayTons)} tn totales</div>
          </div>
        </div>
        {loading && freights.length === 0 && <SkeletonList count={2} />}
        {todayFreights.length === 0 && !loading && (
          <div style={{ fontSize: 12.1, color: C.t3, textAlign: "center", padding: "8px 0" }}>Sin fletes programados para hoy</div>
        )}
        {dailyGroups.map(g => (
          <div key={g.key} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.1, fontWeight: 700, color: g.color }}>{g.label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>({g.items.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 14, borderLeft: `2px solid ${g.color}30` }}>
              {g.items.map(f => <FreightCardCompact key={f.id} freight={f} onClick={() => selectFreight(f.id, "daily")} showTime />)}
            </div>
          </div>
        ))}
      </div>
    );

    const simpleFreightList = (scrollable) => (
      <div style={scrollable ? { flex: 1, overflow: "auto", padding: 18 } : {}}>
        {loading && freights.length === 0 && <SkeletonList count={4} />}
        {!loading && simpleFreights.length === 0 && <EmptyState icon={Ic.truck(C.t3, 28)} title="Sin fletes en curso" subtitle="No hay fletes activos en este momento" />}
        {pendingSimple.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.acc, animation: "dotPulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontSize: 14.3, fontWeight: 700, color: C.acc }}>Pendientes de mi parte</span>
              <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t3 }}>({pendingSimple.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {pendingSimple.map(renderSimpleCard)}
            </div>
          </>
        )}
        {restSimple.length > 0 && (
          <>
            {pendingSimple.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.t2 }} />
                <span style={{ fontSize: 14.3, fontWeight: 700, color: C.t2 }}>Sin pendientes de mi parte</span>
                <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t3 }}>({restSimple.length})</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {restSimple.map(renderSimpleCard)}
            </div>
          </>
        )}
      </div>
    );

    if (hasDetail && !isDesktop) return detailScreen;
    if (hasDetail && isDesktop) {
      return (
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row" }}>
            <div style={{ width: 320, flexShrink: 0, overflow: "auto", borderRight: `1px solid ${C.b1}`, padding: "12px 8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {simpleFreights.map(renderSimpleCard)}
              </div>
            </div>
            {detailScreen}
          </div>
        </div>
      );
    }

    // Desktop: fletes left, resumen diario right (50/50)
    if (isDesktop) {
      return (
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row" }}>
            <div style={{ flex: 1, overflow: "auto", padding: 18, borderRight: `1px solid ${C.b1}` }}>
              {simpleFreightList(false)}
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
              {simpleDailyPanel}
            </div>
          </div>
        </div>
      );
    }

    // Mobile: resumen diario first, then fletes below
    return (
      <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
        {simpleDailyPanel}
        <div style={{ marginTop: 24 }}>
          {simpleFreightList(false)}
        </div>
      </div>
    );
  }

    // Desktop with detail selected
  if (isDesktop && hasDetail) {
    return (
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row" }}>
          {selectionSource === "daily" ? renderDailyPanel(true) : renderPendingPanel(true)}
          {detailScreen}
        </div>
      </div>
    );
  }

  // Mobile with detail selected
  if (!isDesktop && hasDetail) {
    return detailScreen;
  }

  // Desktop: two panels side by side (50/50)
  if (isDesktop) {
    return (
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row" }}>
          <div style={{ flex: 1, overflow: "auto", borderRight: `1px solid ${C.b1}` }}>
            {renderPendingPanel(false)}
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {renderDailyPanel(false)}
          </div>
        </div>
      </div>
    );
  }

  // Mobile: tabs between Pendientes and Hoy
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ padding: "8px 12px 0" }}>
        <Tabs items={[{ k: "pending", l: "Pendientes" }, { k: "daily", l: `Hoy (${todayFreights.length})` }]} active={mobileTab} onChange={setMobileTab} />
      </div>
      {mobileTab === "pending" ? renderPendingPanel(false) : renderDailyPanel(false)}
    </div>
  );
});
