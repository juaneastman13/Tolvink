import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { C, Ic, MONO } from "../theme";
import { stCfg, getActions } from "../constants";
import { Bd, Btn, SkeletonList, EmptyState } from "../components";
import { useIsDesktop } from "../hooks";
import { getPendingActions, resolveUserTypeForFreight, getWaitingOnText } from "../utils/freight-helpers";
import DetailScreen from "./DetailScreen";

// Summary groups — by freight type/status, filtered by date. Priority: pending confirmation → active → rest
const STATUS_GROUPS = [
  { key:"own_fleet_pending",   label:"Esperando confirmación de planta", icon:Ic.warn,  color:"#CA8A04", filter:(f) => f.status === "assigned" && f.isOwnFleet },
  { key:"in_progress",         label:"En curso",                         icon:Ic.nav,   color:"#4ADE80", filter:(f) => f.status === "in_progress" },
  { key:"loaded",              label:"Cargando",                         icon:Ic.plant, color:"#22C55E", filter:(f) => f.status === "loaded" },
  { key:"own_fleet_confirmed", label:"Flota propia confirmada",          icon:Ic.chk,   color:"#2563EB", filter:(f) => f.status === "accepted" && f.isOwnFleet },
  { key:"external_assigned",   label:"Transporte asignado",              icon:Ic.truck, color:"#0891B2", filter:(f) => (f.status === "assigned" || f.status === "accepted") && !f.isOwnFleet },
  { key:"pending_assignment",  label:"Solicitado",                       icon:Ic.warn,  color:"#FF6A00", filter:(f) => f.status === "pending_assignment" },
];

export default function HomeScreen({ user, freights, loading, perms, onNav, catalog, isDesktop, onAction, onTripAction, onEditTrip, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap, pwa }) {
  const [selectedId, setSelectedId] = useState(null);
  const [pendingFilter, setPendingFilter] = useState("all");
  const [summaryFilter, setSummaryFilter] = useState("all");
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const companyPickerRef = useRef(null);

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

  // Close company picker on outside click
  useEffect(() => {
    if (!showCompanyPicker) return;
    const handler = (e) => { if (companyPickerRef.current && !companyPickerRef.current.contains(e.target)) setShowCompanyPicker(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCompanyPicker]);

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
  }, [filteredFreights, effectiveType, user.id, user.role, user.companyId]);

  // Pending groups — grouped by ACTION type, filtered by date
  const pendingByAction = useMemo(() => {
    const buckets = {};
    filteredFreights.forEach(f => {
      const pa = pendingMap.get(f.id);
      if (!pa) return;
      if (!matchDate(f.loadDate, pendingFilter)) return;
      const bk = pa.groupKey || pa.actionKey;
      const baseLabel = pa.action.replace(/ #\d+$/, '').replace(/ \d+ camiones$/, ' transporte');
      if (!buckets[bk]) buckets[bk] = { label: baseLabel, color: pa.color, actionKey: bk, icon: pa.icon, items: [] };
      buckets[bk].items.push({ ...f, pendingAction: pa });
    });
    return Object.values(buckets).map(b => ({
      ...b,
      items: [...b.items].sort((a, b2) => a.loadDate && b2.loadDate ? a.loadDate.localeCompare(b2.loadDate) : 0),
    }));
  }, [filteredFreights, pendingMap, pendingFilter]);
  const pendingCount = pendingByAction.reduce((s, g) => s + g.items.length, 0);
  const hasPending = pendingCount > 0;

  // Total pending (unfiltered) to know if section should show
  const totalPendingAll = useMemo(() => {
    let count = 0;
    for (const pa of pendingMap.values()) { if (pa) count++; }
    return count;
  }, [pendingMap]);

  const activeFreights = useMemo(() => filteredFreights.filter(f => f.status !== "finished" && f.status !== "canceled"), [filteredFreights]);
  const summaryGroups = useMemo(() => {
    return STATUS_GROUPS.map(g => {
      const items = activeFreights
        .filter(f => g.filter(f) && !pendingMap.get(f.id) && matchDate(f.loadDate, summaryFilter))
        .sort((a, b) => a.loadDate && b.loadDate ? a.loadDate.localeCompare(b.loadDate) : 0);
      return { ...g, items };
    }).filter(g => g.items.length > 0);
  }, [activeFreights, pendingMap, summaryFilter]);

  // Collapsed state
  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Icon map for pending action types
  const actionIcon = (icon) => icon === "assign" ? Ic.warn : icon === "authorize" ? Ic.chk : icon === "respond" ? Ic.truck : icon === "start" ? Ic.nav : icon === "confirm" ? Ic.plant : Ic.chk;

  // Selected freight for detail
  const selFreight = selectedId ? filteredFreights.find(f => f.id === selectedId) || freights.find(f => f.id === selectedId) : null;
  const hasDetail = selectedId && selFreight;

  // Render a freight card — compact when detail is open on desktop
  const compact = hasDetail && isDesktop;
  const renderCard = (f, pa) => {
    const st = stCfg(f.status);
    const isSel = selectedId === f.id;
    if (compact) {
      // Mini card: just code + status color bar + product
      return (
        <div key={f.id} onClick={() => setSelectedId(f.id)} style={{ background: isSel ? C.priPale : C.w, border: `1px solid ${isSel ? C.pri : C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", transition: "background 0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginTop: 3 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</div>
          {f.loadDate && <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{Ic.cal(C.t3, 8)} {f.loadDate}{f.loadTime?.trim() ? ` · ${f.loadTime}` : ""}</div>}
        </div>
      );
    }
    return (
      <div key={f.id} onClick={() => setSelectedId(f.id)} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: 14, boxShadow: C.sh, cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
          </div>
          {f.isOwnFleet && <span style={{ fontSize: 9, color: C.acc, fontWeight: 600 }}>Flota propia</span>}
        </div>
        <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:6}}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:3,fontSize:11,color:C.t2}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.user(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.originCompanyName||(f.originName||"").split("—")[0].trim()}</span>{f.originLat&&f.originLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.originLat,f.originLng,[f.originCompanyName,f.fieldName,f.originName].filter(Boolean).join(" — "));}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10,flexShrink:0}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</div>
          {f.transporterName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.truck(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.transporterName}{f.truckPlate?` (${f.truckPlate})`:""}</span></div>}
          <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.plant(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.destName}</span>{f.destLat&&f.destLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.destLat,f.destLng,f.destName);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10,flexShrink:0}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</div>
        </div>
        {!pa && (() => { const wt = getWaitingOnText(f, effectiveType(f)); return wt ? <div style={{marginTop:4,fontSize:9.5,color:C.t3,fontStyle:"italic"}}>{wt}</div> : null; })()}
      </div>
    );
  };

  // Render a collapsible group (pending or summary)
  const renderGroup = (group, keyPrefix) => {
    const gKey = keyPrefix + "_" + group.key;
    const isOpen = !!collapsed[gKey];
    return (
      <div key={gKey}>
        <button onClick={() => toggleGroup(gKey)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 0", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          {group.icon(group.color, 14)}
          <span style={{ fontSize: 14, fontWeight: 800, color: group.color }}>{group.items.length}</span>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.t1 }}>{group.label}</div>
          <span style={{ display: "flex", transform: isOpen ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>{Ic.chev(C.t3, 14)}</span>
        </button>
        {isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 4px 16px", borderLeft: `2px solid ${group.color}30` }}>
            {group.items.map(f => renderCard(f, pendingMap.get(f.id)))}
          </div>
        )}
      </div>
    );
  };

  // List panel content
  // Sidebar logo area: padTop24 + font63 + padBot20 = 107px → midline ~55px. Solicitar btn top ~122px.
  const listContent = (
    <div style={{ flex: compact ? undefined : 1, width: compact ? 300 : undefined, flexShrink: 0, overflow: compact ? "auto" : undefined, boxSizing: "border-box", borderRight: compact ? `1px solid ${C.b1}` : "none" }}>
      {/* Sticky header spacer */}
      {compact && <div style={{ position: "sticky", top: 0, zIndex: 10, background:C.bg, minHeight: 8 }} />}

      <div style={{ padding: compact ? "0 8px 8px" : "18px 18px 18px" }}>

      {/* Skeleton while loading */}
      {loading && freights.length === 0 && <SkeletonList count={3} />}

      {/* PWA install prompt */}
      {pwa && !pwa.isInstalled && (pwa.canPrompt || pwa.isIOS) && (
        <div style={{ background:C.priPale, border:`1.5px solid ${C.pri}30`, borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{flex:1}}>
            <div style={{ fontSize:12, fontWeight:700, color:C.pri }}>Instalá Tolvink en tu dispositivo</div>
            <div style={{ fontSize:10.5, color:C.t2, marginTop:2 }}>{pwa.isIOS ? "Tocá Compartir → Agregar a inicio" : "Acceso directo desde tu pantalla de inicio"}</div>
          </div>
          {pwa.canPrompt && <button onClick={pwa.install} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:C.pri, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>Instalar</button>}
        </div>
      )}


      {/* Pendientes — top aligned with Solicitar flete button (~14px padding in sidebar) */}
      {totalPendingAll > 0 && (<>
        <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12, background: `${C.acc}0D`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
            <div style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: "50%", background: C.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
              {Ic.bell(C.w, compact ? 13 : 16)}
              <div style={{ position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 8, background: C.err, color: C.w, fontSize: 8, fontWeight: 700, padding: "0 3px", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.w}` }}>{pendingCount}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: C.acc }}>Con pendientes de mi parte</div>
              {!compact && <div style={{ fontSize: 10, color: C.t3 }}>{pendingCount} acción{pendingCount !== 1 ? "es" : ""}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {[{k:"all",l:"Todo"},{k:"today",l:"Hoy"},{k:"tomorrow",l:"Mañana"},{k:"week",l:"Semana"}].map(o => (
              <button key={o.k} onClick={() => setPendingFilter(o.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: 6, border: `1px solid ${pendingFilter === o.k ? C.acc : C.b1}`, background: pendingFilter === o.k ? `${C.acc}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9 : 10, fontWeight: pendingFilter === o.k ? 700 : 500, color: pendingFilter === o.k ? C.acc : C.t3 }}>{o.l}</button>
            ))}
          </div>
        </div>
        {pendingByAction.length > 0 && (
          <div style={{ paddingLeft: compact ? 12 : 16, borderLeft: `2px solid ${C.acc}30`, marginBottom: 16 }}>
            {pendingByAction.map(g => renderGroup({ key: g.actionKey, label: g.label, icon: actionIcon(g.icon), color: g.color, items: g.items }, "pa"))}
          </div>
        )}
        {!compact && pendingByAction.length === 0 && <div style={{ padding:"12px 16px", fontSize:12, color:C.t3, display:"flex", alignItems:"center", gap:8 }}>{Ic.chk(C.ok,14)} Sin pendientes en este período</div>}
      </>)}

      {/* Sin pendientes de mi parte */}
      <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12, background: C.okPale, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
          <div style={{ width: compact ? 22 : 28, height: compact ? 22 : 28, borderRadius: "50%", background: C.ok, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {Ic.chk(C.w, compact ? 11 : 14)}
          </div>
          <div style={{ flex: 1, fontSize: compact ? 11 : 12, fontWeight: 700, color: C.ok }}>Sin pendientes de mi parte</div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {[{k:"all",l:"Todo"},{k:"today",l:"Hoy"},{k:"tomorrow",l:"Mañana"},{k:"week",l:"Semana"}].map(o => (
            <button key={o.k} onClick={() => setSummaryFilter(o.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: 6, border: `1px solid ${summaryFilter === o.k ? C.ok : C.b1}`, background: summaryFilter === o.k ? `${C.ok}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9 : 10, fontWeight: summaryFilter === o.k ? 700 : 500, color: summaryFilter === o.k ? C.ok : C.t3 }}>{o.l}</button>
          ))}
        </div>
      </div>

      {/* Summary groups — by status */}
      {summaryGroups.length > 0 ? (
        <div style={{ paddingLeft: compact ? 12 : 16, borderLeft: `2px solid ${C.ok}30` }}>
          {summaryGroups.map(g => renderGroup(g, "sm"))}
        </div>
      ) : null}
      </div>
    </div>
  );

  // Desktop: split layout — collapsed list left + DetailScreen right
  // Resolve effective userType for selected freight so DetailScreen shows correct actions
  const detailUser = selFreight ? { ...user, userType: effectiveType(selFreight) } : user;

  if (isDesktop && hasDetail) {
    return (
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row" }}>
          {listContent}
          <DetailScreen user={detailUser} freight={selFreight} perms={perms} onBack={() => setSelectedId(null)} onAction={onAction} onTripAction={onTripAction} onEditTrip={onEditTrip} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} />
        </div>
      </div>
    );
  }

  // Mobile: fullscreen detail or list
  if (!isDesktop && hasDetail) {
    return <DetailScreen user={detailUser} freight={selFreight} perms={perms} onBack={() => setSelectedId(null)} onAction={onAction} onTripAction={onTripAction} onEditTrip={onEditTrip} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} />;
  }

  return listContent;
}
