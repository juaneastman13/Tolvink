import { useState, useMemo, useCallback } from "react";
import { C, Ic, MONO } from "../theme";
import { stCfg, getActions, formatFreightDate } from "../constants";
import { Bd, Btn, SkeletonList, EmptyState, Tabs } from "../components";
import { useIsDesktop } from "../hooks";
import { getPendingActions, resolveUserTypeForFreight, getWaitingOnText } from "../utils/freight-helpers";
import DetailScreen from "./DetailScreen";

// Progress groups — matching the 3-step progress bar in DetailScreen
const PROGRESS_GROUPS = [
  { key:"pendiente",   label:"Pendiente",  color:C.acc, statuses:["pending_assignment"] },
  { key:"en_curso",    label:"En curso",   color:C.pri, statuses:["assigned","accepted","in_progress","loaded"] },
  { key:"finalizado",  label:"Finalizado", color:C.ok,  statuses:["finished"] },
  { key:"cancelado",   label:"Cancelado",  color:C.err, statuses:["canceled"] },
];

// Status order for daily summary grouping — colors sourced from stCfg (STATUS_LIGHT)
const DAILY_STATUS_ORDER = [
  { key: "in_progress",        label: "En curso",              get color() { return stCfg("in_progress").color; } },
  { key: "loaded",             label: "Cargando",              get color() { return stCfg("loaded").color; } },
  { key: "accepted",           label: "Confirmado",            get color() { return stCfg("accepted").color; } },
  { key: "assigned",           label: "Asignado",              get color() { return stCfg("assigned").color; } },
  { key: "pending_assignment", label: "Solicitado",            get color() { return stCfg("pending_assignment").color; } },
  { key: "finished",           label: "Finalizado",            get color() { return stCfg("finished").color; } },
];

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function formatTodayHeader() {
  const d = new Date();
  return `Fletes de hoy \u2014 ${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export default function HomeScreen({ user, freights, loading, perms, onNav, catalog, isDesktop, onAction, onTripAction, onEditTrip, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap, simpleMode }) {
  const [selectedId, setSelectedId] = useState(null);
  // Track which panel originated the selection: "pending" (left) or "daily" (right)
  const [selectionSource, setSelectionSource] = useState(null);
  const [pendingFilter, setPendingFilter] = useState("all");
  const [summaryFilter, setSummaryFilter] = useState("all");
  // Mobile tab: "pending" or "daily"
  const [mobileTab, setMobileTab] = useState("pending");

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

  // Date helpers for filters — recomputed every render to avoid stale dates when app stays open overnight
  const dateBounds = (() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tom = new Date(now); tom.setDate(tom.getDate() + 1);
    const tomorrowStr = tom.toISOString().slice(0, 10);
    const day = now.getDay(); // 0=sun
    const endWk = new Date(now); endWk.setDate(now.getDate() + (7 - day));
    const weekEndStr = endWk.toISOString().slice(0, 10);
    return { todayStr, tomorrowStr, weekEndStr };
  })();
  const matchDate = (loadDate, filter) => {
    if (filter === "all") return true;
    if (!loadDate) return false;
    if (filter === "today") return loadDate === dateBounds.todayStr;
    if (filter === "tomorrow") return loadDate === dateBounds.tomorrowStr;
    if (filter === "week") return loadDate >= dateBounds.todayStr && loadDate <= dateBounds.weekEndStr;
    return true;
  };

  // Helper: resolve effective userType per freight for multi-type users
  const effectiveType = useCallback((f) => resolveUserTypeForFreight(f, user), [user]);

  // I4: Compute pending actions ONCE per freight, reuse everywhere
  const pendingMap = useMemo(() => {
    const map = new Map();
    filteredFreights.forEach(f => { map.set(f.id, getPendingActions(f, effectiveType(f), user.role, user)); });
    return map;
  }, [filteredFreights, effectiveType, user.id, user.role, user.companyId, user.userType]);

  // Pending groups — grouped by progress state (Pendiente / En curso / Finalizado)
  const pendingByProgress = useMemo(() => {
    return PROGRESS_GROUPS.map(g => {
      const items = filteredFreights
        .filter(f => {
          const pa = pendingMap.get(f.id);
          if (!pa) return false;
          if (!matchDate(f.loadDate, pendingFilter)) return false;
          return g.statuses.includes(f.status);
        })
        .map(f => ({ ...f, pendingAction: pendingMap.get(f.id) }))
        .sort((a, b) => (a.destName||'').localeCompare(b.destName||'') || (a.originName||'').localeCompare(b.originName||''));
      return { ...g, icon: g.key==="pendiente"?Ic.warn:g.key==="en_curso"?Ic.nav:g.key==="cancelado"?Ic.cross:Ic.chk, items };
    }).filter(g => g.items.length > 0);
  }, [filteredFreights, pendingMap, pendingFilter]);
  const pendingCount = pendingByProgress.reduce((s, g) => s + g.items.length, 0);
  const hasPending = pendingCount > 0;

  // Total pending (unfiltered) to know if section should show
  const totalPendingAll = useMemo(() => {
    let count = 0;
    for (const pa of pendingMap.values()) { if (pa) count++; }
    return count;
  }, [pendingMap]);

  const summaryGroups = useMemo(() => {
    return PROGRESS_GROUPS.map(g => {
      const items = filteredFreights
        .filter(f => g.statuses.includes(f.status) && !pendingMap.get(f.id) && matchDate(f.loadDate, summaryFilter))
        .sort((a, b) => (a.destName||'').localeCompare(b.destName||'') || (a.originName||'').localeCompare(b.originName||''));
      return { ...g, icon: g.key==="pendiente"?Ic.warn:g.key==="en_curso"?Ic.nav:g.key==="cancelado"?Ic.cross:Ic.chk, items };
    }).filter(g => g.items.length > 0);
  }, [filteredFreights, pendingMap, summaryFilter]);

  // Accordion state — only one group open at a time
  const [openGroup, setOpenGroup] = useState(null);
  const toggleGroup = (key) => setOpenGroup(prev => prev === key ? null : key);

  // Selected freight for detail
  const selFreight = selectedId ? filteredFreights.find(f => f.id === selectedId) || freights.find(f => f.id === selectedId) : null;
  const hasDetail = selectedId && selFreight;

  // ======================== DAILY SUMMARY ========================

  const todayFreights = useMemo(() => {
    return filteredFreights
      .filter(f => f.loadDate === dateBounds.todayStr)
      .sort((a, b) => (a.loadTime || "").localeCompare(b.loadTime || "") || (a.code || "").localeCompare(b.code || ""));
  }, [filteredFreights, dateBounds.todayStr]);

  const todayTons = useMemo(() => todayFreights.reduce((s, f) => s + (parseFloat(f.tons) || 0), 0), [todayFreights]);

  const dailyGroups = useMemo(() => {
    return DAILY_STATUS_ORDER.map(g => {
      const items = todayFreights.filter(f => f.status === g.key);
      return { ...g, items };
    }).filter(g => g.items.length > 0);
  }, [todayFreights]);

  // ======================== RENDER HELPERS ========================

  // Render a freight card — compact when detail is open on desktop
  const renderCard = (f, pa, source) => {
    const st = stCfg(f.status);
    const isSel = selectedId === f.id;
    const compact = hasDetail && isDesktop;
    if (compact) {
      // Mini card: just code + status color bar + product
      return (
        <div key={f.id} role="button" tabIndex={0} aria-label={`Flete ${f.code}`} onClick={() => selectFreight(f.id, source)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFreight(f.id, source);}}} style={{ background: isSel ? C.priPale : C.w, border: `1px solid ${isSel ? C.pri : C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", transition: "background 0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
          </div>
          <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1, marginTop: 3 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</div>
          {f.loadDate && <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>{Ic.cal(C.t3, 9)} {formatFreightDate(f.loadDate)}{f.loadTime?.trim() ? ` · ${f.loadTime}` : ""}</div>}
          {(f.fieldName || f.originName || f.originCompanyName) && <div style={{ fontSize: 10.5, color: C.t3, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}>{Ic.pin(C.t3, 9)} {[f.fieldName, f.originName].filter(Boolean).join(" / ") || f.originCompanyName}</div>}
        </div>
      );
    }
    return (
      <div key={f.id} role="button" tabIndex={0} aria-label={`Flete ${f.code}`} onClick={() => selectFreight(f.id, source)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFreight(f.id, source);}}} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 10, boxShadow: C.sh, cursor: "pointer", overflow: "hidden", transition: "background 0.15s, border-color 0.15s" }}>
        {/* Two-column layout with vertical divider */}
        <div style={{ display: "flex" }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 12px", borderRight: `1px solid ${C.b2}`, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
              <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
            </div>
            <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</div>
            {f.loadDate && <div style={{ fontSize: 13.6, color: C.t3, fontWeight: 500 }}>{formatFreightDate(f.loadDate)}{f.loadTime?.trim() ? ` · ${f.loadTime}` : ""}</div>}
          </div>
          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 12px", fontSize: 12.1, color: C.t2, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{Ic.plant(C.t3, 12)} <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.destName}</span>{f.destLat&&f.destLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.destLat,f.destLng,f.destName);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,flexShrink:0,display:"inline-flex"}} title="Ver en mapa">{Ic.pin(C.t3,12)}</span>}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{Ic.truck(C.t3, 12)} <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.transporterName || "Sin asignar"}{f.truckPlate ? ` (${f.truckPlate})` : ""}</span>{f.isOwnFleet && <span style={{ fontSize: 11, color: C.acc, fontWeight: 600, marginLeft: 4, flexShrink: 0 }}>Flota propia</span>}{f.isMultiTruck && <span style={{ fontSize: 11, color: C.info, fontWeight: 600, marginLeft: 4, flexShrink: 0 }}>{f.assignedTruckCount}/{f.truckCount} cam.</span>}</div>
            {(f.fieldName || f.originName || f.originCompanyName) && <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{Ic.pin(C.t3, 12)} <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[f.fieldName, f.originName].filter(Boolean).join(" / ") || f.originCompanyName}</span></div>}
          </div>
        </div>
      </div>
    );
  };

  // Render a collapsible group (accordion — opening one hides others)
  const renderGroup = (group, keyPrefix, source, allGroups) => {
    const gKey = keyPrefix + "_" + group.key;
    const isOpen = openGroup === gKey;
    const anotherOpen = openGroup && openGroup.startsWith(keyPrefix + "_") && openGroup !== gKey;
    if (anotherOpen) return null;
    return (
      <div key={gKey}>
        <button onClick={() => toggleGroup(gKey)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 0", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          {group.icon(group.color, 14)}
          <span style={{ fontSize: 15.4, fontWeight: 800, color: group.color }}>{group.items.length}</span>
          <div style={{ flex: 1, fontSize: 14.3, fontWeight: 600, color: C.t1 }}>{group.label}</div>
          <span style={{ display: "flex", transform: isOpen ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>{Ic.chev(C.t3, 14)}</span>
        </button>
        {isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 4px 16px", borderLeft: `2px solid ${group.color}30` }}>
            {group.items.map(f => renderCard(f, pendingMap.get(f.id), source))}
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

      {/* Skeleton while loading */}
      {loading && freights.length === 0 && <SkeletonList count={3} />}

      {(()=>{
        const smOpen = openGroup && openGroup.startsWith("sm_");
        const paOpen = openGroup && openGroup.startsWith("pa_");
        return <>
        {/* Ver todo — shown when any group is expanded */}
        {openGroup && <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><button onClick={() => setOpenGroup(null)} style={{ display:"inline-flex", alignItems:"center", padding:"6px 16px", borderRadius:20, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 1px 2px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize:12.1, fontWeight:600, color:C.t2 }}>Ver todo</span>
        </button></div>}
        {/* Pendientes — hidden when a "sin pendientes" group is open */}
        {!smOpen && totalPendingAll > 0 && (<>
          <div style={{ padding: compact ? "8px 10px" : "12px 14px", borderRadius: 12, background: `${C.acc}0D`, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
              {!compact && <span style={{ fontSize: 24.2, fontWeight: 800, color: C.acc, lineHeight: 1, minWidth: 28, textAlign: "center" }}>{pendingCount}</span>}
              {compact && <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                {Ic.bell(C.w, 13)}
                <div style={{ position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 8, background: C.err, color: C.w, fontSize: 8.8, fontWeight: 700, padding: "0 3px", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.w}` }}>{pendingCount}</div>
              </div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: compact ? 12.1 : 14.3, fontWeight: 700, color: C.acc }}>{compact ? "Con pendientes de mi parte" : `Acción${pendingCount !== 1 ? "es" : ""} pendiente${pendingCount !== 1 ? "s" : ""}`}</div>
                {!compact && <div style={{ fontSize: 11.6, color: C.t3 }}>Requieren tu atención</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
              {[{k:"all",l:"Todo"},{k:"today",l:"Hoy"},{k:"tomorrow",l:"Mañana"},{k:"week",l:"Semana"}].map(o => (
                <button key={o.k} onClick={() => setPendingFilter(o.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: 6, border: `1px solid ${pendingFilter === o.k ? C.acc : C.b1}`, background: pendingFilter === o.k ? `${C.acc}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9.9 : 11, fontWeight: pendingFilter === o.k ? 700 : 500, color: pendingFilter === o.k ? C.acc : C.t3 }}>{o.l}</button>
              ))}
            </div>
          </div>
          {pendingByProgress.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {pendingByProgress.map(g => renderGroup(g, "pa", "pending"))}
            </div>
          )}
          {!compact && pendingByProgress.length === 0 && <div style={{ padding:"12px 16px", fontSize:13.2, color:C.t3, display:"flex", alignItems:"center", gap:8 }}>{Ic.chk(C.ok,14)} Sin pendientes en este periodo</div>}
        </>)}

        {/* Sin pendientes de mi parte — hidden when a "pendientes" group is open */}
        {!paOpen && <>
        <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12, background: C.okPale, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
            <div style={{ width: compact ? 22 : 28, height: compact ? 22 : 28, borderRadius: "50%", background: C.ok, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {Ic.chk(C.w, compact ? 11 : 14)}
            </div>
            <div style={{ flex: 1, fontSize: compact ? 12.1 : 13.2, fontWeight: 700, color: C.ok }}>Sin pendientes de mi parte</div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {[{k:"all",l:"Todo"},{k:"today",l:"Hoy"},{k:"tomorrow",l:"Mañana"},{k:"week",l:"Semana"}].map(o => (
              <button key={o.k} onClick={() => setSummaryFilter(o.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: 6, border: `1px solid ${summaryFilter === o.k ? C.ok : C.b1}`, background: summaryFilter === o.k ? `${C.ok}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9.9 : 11, fontWeight: summaryFilter === o.k ? 700 : 500, color: summaryFilter === o.k ? C.ok : C.t3 }}>{o.l}</button>
            ))}
          </div>
        </div>

        {/* Summary groups — by progress state */}
        {summaryGroups.length > 0 ? (
          <div>
            {summaryGroups.map(g => renderGroup(g, "sm", "pending"))}
          </div>
        ) : null}
        </>}
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
        <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12, background: `${C.pri}0D`, marginBottom: 8 }}>
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

        {/* Empty state */}
        {todayFreights.length === 0 && !loading && (
          <EmptyState icon={Ic.cal(C.t3, 28)} title="Sin fletes para hoy" subtitle="No hay fletes programados para la fecha de hoy" />
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
      const st = stCfg(f.status);
      const pa = f._pending;
      const isSel = selectedId === f.id;
      return (
        <div key={f.id} role="button" tabIndex={0} aria-label={`Flete ${f.code}`} onClick={() => selectFreight(f.id, "pending")} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFreight(f.id, "pending");}}} style={{ background: isSel ? C.priPale : C.w, border: `1px solid ${isSel ? C.pri : pa ? st.color + "40" : C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", boxShadow: C.sh, transition: "background 0.15s, border-color 0.15s", position: "relative" }}>
          {/* Pending indicator — pulsing dot */}
          {pa && <div style={{ position: "absolute", top: 10, right: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.acc, display: "inline-block", animation: "dotPulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.acc, whiteSpace: "nowrap" }}>{pa.action}</span>
          </div>}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
          </div>
          <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1, marginBottom: 3 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11.5, color: C.t2 }}>
            {f.loadDate && <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{Ic.cal(C.t3, 10)} {formatFreightDate(f.loadDate)}{f.loadTime ? ` · ${f.loadTime}` : ""}</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{Ic.pin(C.t3, 10)} {[f.fieldName, f.originName].filter(Boolean).join(" / ") || f.originCompanyName || "Sin origen"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{Ic.plant(C.t3, 10)} {f.destName || "Sin destino"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{Ic.truck(C.t3, 10)} {f.transporterName || "Sin asignar"}</span>
          </div>
        </div>
      );
    };


    const pendingSimple = simpleFreights.filter(f => f._pending);
    const restSimple = simpleFreights.filter(f => !f._pending);

    const simpleDailyPanel = (
      <div style={{ padding: "14px 16px", borderRadius: 12, background: `${C.pri}08`, border: `1px solid ${C.pri}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.pri, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {Ic.cal(C.w, 14)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.3, fontWeight: 700, color: C.pri }}>{formatTodayHeader()}</div>
            <div style={{ fontSize: 11, color: C.t3 }}>{todayFreights.length} flete{todayFreights.length !== 1 ? "s" : ""} · {Math.round(todayTons)} tn totales</div>
          </div>
        </div>
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
              {g.items.map(f => {
                const st = stCfg(f.status);
                return (
                  <div key={f.id} role="button" tabIndex={0} aria-label={`Flete ${f.code}`} onClick={() => selectFreight(f.id, "daily")} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFreight(f.id, "daily");}}} style={{ padding: "7px 10px", borderRadius: 8, background: C.w, border: `1px solid ${C.b1}`, cursor: "pointer", transition: "background 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
                      <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t1, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} tn</span>
                      {f.loadTime && <span style={{ fontSize: 10.5, color: C.t3 }}>{f.loadTime}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 11, color: C.t3 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{Ic.pin(C.t3, 9)} {[f.fieldName, f.originName].filter(Boolean).join(" / ") || f.originCompanyName || "Sin origen"}</span>
                      {f.destName && <span style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{Ic.plant(C.t3, 9)} {f.destName}</span>}
                    </div>
                  </div>
                );
              })}
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
}
