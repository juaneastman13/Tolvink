import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { C, Ic, FONT, MONO , R} from "../theme";
import { LicensePlate } from "./ui/LicensePlate";
import { stCfg, formatFreightDate } from "../constants";
import { FEATURES } from "../features";
import { originDisplay, destDisplay } from "../hooks";
import { Bd } from "./data-display";

// ======================== DESKTOP SIDEBAR =============================

const _TYPE_LABELS = { producer:"Productor", plant:"Planta", transporter:"Transportista" };
const _TYPE_IC_COLORS = { producer:C.warn, plant:C.ok, transporter:C.sec };
const _typeIcon = (t,s=14) => t==='producer'?Ic.grain(C.warn,s):t==='plant'?Ic.plant(C.ok,s):t==='transporter'?Ic.truck(C.sec,s):null;

export function Sidebar({ active, onChange, unread=0, pendingCount=0, notifCount=0, canRequest=false, onNew, activeCompany, companies=[], onSwitchCompany, simpleMode=false, onToggleSimple, searchQuery="", onSearchChange, searchResults=[], onSearchSelect, searchHasMore=false, searchLoadingMore=false, onSearchLoadMore, user }) {
  const hasPending = pendingCount > 0;
  const centerColor = hasPending ? C.acc : C.ok;
  const [compOpen, setCompOpen] = useState(false);
  const compRef = useRef(null);
  useEffect(() => {
    if (!compOpen) return;
    const h = e => { if (compRef.current && !compRef.current.contains(e.target)) setCompOpen(false); };
    const tid = setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => { clearTimeout(tid); document.removeEventListener("mousedown", h); };
  }, [compOpen]);
  const isManager = ["admin","gerente","platform_admin"].includes(user?.role);
  const allItems = [
    { k:"home",    ic:a=>Ic.home(a?C.pri:C.t3,20),  l:"Inicio" },
    { k:"list",    ic:a=>Ic.truck(a?C.pri:C.t3,20),  l:"Fletes" },
    ...((user?.userTypes||[]).includes("plant")||(user?.company?.type==="plant")||((user?.company?.types||[]).includes("plant")) ? [{ k:"queue", ic:a=>Ic.filter(a?C.pri:C.t3,20), l:"Colas" }] : []),
    { k:"locations",ic:a=>Ic.map(a?C.pri:C.t3,20), l:"Mapa" },
    { k:"trucks",   ic:a=>Ic.truck(a?C.pri:C.t3,20), l:"Mi Flota" },
    ...(isManager ? [{ k:"linked", ic:a=>Ic.plant(a?C.pri:C.t3,20), l:"Empresas" }] : []),
    { k:"menu",    ic:a=>Ic.menu3(a?C.pri:C.t3,20),   l:"Menú", bd:notifCount },
  ];
  const simpleKeys = new Set(["home","list","locations","chats","menu"]);
  const items = simpleMode ? allItems.filter(it => simpleKeys.has(it.k)) : allItems;
  const compLabel = activeCompany ? (_TYPE_LABELS[activeCompany.type] || "") : null;
  const hasMultiple = companies.length > 1;

  // Hover preview for search results
  const [hoverFreight, setHoverFreight] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x:0, y:0 });
  const hoverTimerRef = useRef(null);
  const clearHoverTimer = useCallback(() => { if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; } }, []);
  const handleSearchHoverEnter = useCallback((f, e) => {
    clearHoverTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimerRef.current = setTimeout(() => {
      setHoverPos({ x: rect.right + 12, y: rect.top });
      setHoverFreight(f);
    }, 800);
  }, [clearHoverTimer]);
  const handleSearchHoverLeave = useCallback(() => { clearHoverTimer(); setHoverFreight(null); }, [clearHoverTimer]);
  const adjustPreviewPos = useCallback((el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let needsUpdate = false, x = rect.left, y = rect.top;
    if (rect.right > window.innerWidth - 12) { x = Math.max(12, rect.left - rect.width - 24); needsUpdate = true; }
    if (rect.bottom > window.innerHeight - 12) { y = Math.max(12, window.innerHeight - rect.height - 12); needsUpdate = true; }
    if (needsUpdate) setHoverPos({ x, y });
  }, []);
  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const SearchHoverPreview = hoverFreight ? (() => {
    const f = hoverFreight;
    const st = stCfg(f.status);
    const origin = originDisplay(f);
    return (
      <div ref={adjustPreviewPos} style={{ position:"fixed", left:hoverPos.x, top:hoverPos.y, zIndex:9999, width:340, background:C.w, border:`1px solid ${C.b1}`, borderLeft:`5px solid ${st.color}`, borderRadius: R.lg, boxShadow:C.shLg, padding:18, pointerEvents:"none", fontFamily:FONT, animation:"tvPreviewIn 0.15s ease-out" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontFamily:MONO, fontWeight:700, fontSize:13.2, color:C.t2 }}>{f.code}</span>
          <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:C.t1, marginBottom:8 }}>
          {Ic.grain(st.color, 16)} <span style={{ marginLeft:4 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:10, padding:"8px 0", borderTop:`1px solid ${C.b2}`, borderBottom:`1px solid ${C.b2}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13.2, color:C.t2 }}>
            {Ic.pin(C.pri, 13)} <span style={{ fontWeight:600 }}>{origin || "Sin origen"}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.t3, paddingLeft:2 }}>
            <span style={{ width:13, display:"flex", justifyContent:"center", color:C.t3 }}>↓</span>
            <span>{f.originCompanyName || ""}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13.2, color:C.t2 }}>
            {Ic.plant(C.sec, 13)} <span style={{ fontWeight:600 }}>{destDisplay(f) || "Sin destino"}</span>
          </div>
        </div>
        {f.loadDate && (
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, color:C.t2, marginBottom:6 }}>
            {Ic.cal(C.t3, 12)} {formatFreightDate(f.loadDate)}{f.loadTime ? <><span style={{ color:C.t3, margin:"0 2px" }}>·</span>{Ic.clk(C.t3, 12)} {f.loadTime}</> : ""}
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, color:C.t2, marginBottom:4 }}>
          {Ic.truck(C.t3, 12)} <span>{f.transporterName || "Sin asignar"}</span>
          {f.isOwnFleet && <span style={{ fontSize:10, color:C.acc, fontWeight:700, background:C.accPale, padding:"1px 5px", borderRadius: R.xs }}>Flota propia</span>}
        </div>
        {(f.truckPlate || f.driverName) && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.1, color:C.t3 }}>
            {f.truckPlate && <LicensePlate plate={f.truckPlate} size="sm" />}
            {f.driverName && <span>{Ic.user(C.t3, 11)} {f.driverName}</span>}
          </div>
        )}
        {f.isMultiTruck && (
          <div style={{ marginTop:8, padding:"5px 8px", background:C.infoPale, borderRadius: R.sm, fontSize:11.5, fontWeight:600, color:C.info, display:"inline-flex", alignItems:"center", gap:4 }}>
            {Ic.truck(C.info, 12)} {f.assignedTruckCount}/{f.truckCount} camiones asignados
          </div>
        )}
        {f.isOverdue && (
          <div style={{ marginTop:8, padding:"4px 8px", background:C.errPale, borderRadius: R.sm, fontSize:11.5, fontWeight:700, color:C.err, display:"inline-flex", alignItems:"center", gap:4 }}>
            {Ic.warn(C.err, 12)} Retrasado
          </div>
        )}
      </div>
    );
  })() : null;

  return (
    <div style={{ width:220, minWidth:220, height:"100%", background:C.w, borderRight:`1px solid ${C.b2}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
      {/* Logo */}
      <div style={{ padding:"20px 0", borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
          <span style={{ fontSize:54.6, fontWeight:800, color:C.pri, letterSpacing:-2, lineHeight:1 }}>tolvink</span>
          <span style={{ width:12.6, height:12.6, borderRadius: R.sm, background:C.acc, display:"inline-block", marginLeft:3.2, marginTop:3.2, animation:"dotPulse 1.5s ease-in-out infinite" }}></span>
        </div>
      </div>

      {/* Company selector — dropdown if multiple */}
      {activeCompany && activeCompany.name && (
        <div ref={compRef} style={{ padding:"8px 14px", borderBottom:`1px solid ${C.b2}`, position:"relative", flexShrink:0 }}>
          <button onClick={() => hasMultiple && setCompOpen(!compOpen)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 8px", borderRadius: R.sm, background:`${(_TYPE_IC_COLORS[activeCompany.type]||C.t2)}0A`, border:`1px solid ${(_TYPE_IC_COLORS[activeCompany.type]||C.t2)+'30'}`, width:"100%", cursor:hasMultiple?"pointer":"default", fontFamily:"inherit", textAlign:"left" }}>
            <span style={{ display:"flex", flexShrink:0 }}>{_typeIcon(activeCompany.type,14) || <span style={{width:7,height:7,borderRadius: R.xs,background:C.t2}}/>}</span>
            <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"baseline", gap:5, overflow:"hidden", whiteSpace:"nowrap" }}>
              <span style={{ fontSize:11.2, fontWeight:700, color:C.t1, overflow:"hidden", textOverflow:"ellipsis" }}>{activeCompany.name}</span>
              {compLabel && <span style={{ fontSize:9.4, fontWeight:600, color:_TYPE_IC_COLORS[activeCompany.type]||C.t2, flexShrink:0 }}>{compLabel}</span>}
            </div>
            {hasMultiple && <span style={{ fontSize:9.4, color:C.t3, flexShrink:0 }}>{compOpen?"▲":"▼"}</span>}
          </button>
          {compOpen && hasMultiple && (
            <div style={{ position:"absolute", left:14, right:14, top:"100%", marginTop:2, background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.md, boxShadow:C.shMd, padding:4, zIndex:100, maxHeight:260, overflowY:"auto" }}>
              {companies.map(c => {
                const isAct = c.companyId === activeCompany.id;
                return (
                  <button key={c.companyId} onClick={() => { setCompOpen(false); if (!isAct && onSwitchCompany) onSwitchCompany(c.companyId); }} style={{ display:"flex", alignItems:"center", gap:6, width:"100%", padding:"8px 10px", background:isAct?`${C.pri}08`:"transparent", border:"none", borderRadius: R.md, cursor:isAct?"default":"pointer", fontFamily:"inherit", textAlign:"left" }}>
                    <span style={{ display:"flex", flexShrink:0 }}>{_typeIcon(c.companyType,12)}</span>
                    <span style={{ fontSize:12.1, fontWeight:isAct?700:500, color:C.t1, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.companyName}</span>
                    <span style={{ fontSize:9.9, color:_TYPE_IC_COLORS[c.companyType]||C.t3 }}>{_TYPE_LABELS[c.companyType]||""}</span>
                    {isAct && <span style={{ fontSize:8.8, color:C.pri, fontWeight:700 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Solicitar */}
      {canRequest && (
        <div style={{ padding:"14px 14px 10px", flexShrink:0 }}>
          <button onClick={onNew} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 14px", borderRadius: R.lg, background:C.acc, border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${C.acc}30`, transition:"transform 0.15s, box-shadow 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 12px ${C.acc}40`}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 2px 8px ${C.acc}30`}}>
            <style>{`@keyframes truckDrive{0%{transform:translateX(-10px)}60%{transform:translateX(6px)}100%{transform:translateX(-10px)}}`}</style>
            <span style={{ display:"inline-flex", animation:"truckDrive 1.5s ease-in-out infinite" }}>{Ic.truck(C.w,16)}</span>
            <span style={{ fontSize:13.8, fontWeight:700, color:C.w }}>Solicitar flete</span>
          </button>
        </div>
      )}

      {/* Global search */}
      {onSearchChange && <div style={{ padding:"0 12px 6px", position:"relative", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius: R.md, background:C.bgInput, border:`1.5px solid ${searchQuery?C.bFocus:C.b2}`, transition:"border-color 0.15s" }}>
          <span style={{ display:"flex", flexShrink:0 }}>{Ic.srch(C.t3,14)}</span>
          <input value={searchQuery} onChange={e=>onSearchChange(e.target.value)} placeholder="Buscar flete..." style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:12.5, color:C.t1, fontFamily:"inherit", padding:0 }} />
          {searchQuery && <button onClick={()=>onSearchChange("")} style={{ display:"flex", border:"none", background:"none", cursor:"pointer", padding:0 }}>{Ic.cross(C.t3,12)}</button>}
        </div>
        {searchQuery.length >= 2 && searchResults.length > 0 && <div onScroll={e=>{const el=e.currentTarget;if(searchHasMore&&!searchLoadingMore&&el.scrollTop+el.clientHeight>=el.scrollHeight-20)onSearchLoadMore?.();}} style={{ position:"absolute", left:12, right:12, top:"100%", marginTop:2, background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.md, boxShadow:C.shMd, zIndex:100, maxHeight:320, overflowY:"auto", padding:4 }}>
          {searchResults.map(f => <button key={f.id} onClick={()=>{handleSearchHoverLeave();onSearchSelect(f.id);onSearchChange("");}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 10px", background:"transparent", border:"none", borderRadius: R.md, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }} onMouseEnter={e=>{e.currentTarget.style.background=C.priGhost;handleSearchHoverEnter(f,e);}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";handleSearchHoverLeave();}}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.1, fontWeight:700, color:C.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.grain} · {f.tons} {f.unit||"tn"}</div>
              <div style={{ fontSize:10.5, color:C.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.code} · {originDisplay(f)||"—"} → {destDisplay(f)||"—"}</div>
            </div>
          </button>)}
          {searchLoadingMore && <div style={{ padding:"8px 10px", textAlign:"center" }}><div style={{ width:16, height:16, border:`2px solid ${C.b2}`, borderTopColor:C.pri, borderRadius:"50%", animation:"spin 0.6s linear infinite", margin:"0 auto" }}/></div>}
        </div>}
        {searchQuery.length >= 2 && searchResults.length === 0 && <div style={{ position:"absolute", left:12, right:12, top:"100%", marginTop:2, background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.md, boxShadow:C.shMd, zIndex:100, padding:"12px 14px", fontSize:12.1, color:C.t3 }}>Sin resultados</div>}
      </div>}

      {/* Nav items */}
      <nav aria-label="Menú principal" style={{ flex:1, padding:"4px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto", overflowX:"hidden", minHeight:0 }}>
        {items.map(it => {
          const isActive = active === it.k;
          return (
            <button key={it.k} onClick={()=>onChange(it.k)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius: R.md, border:"none", background:isActive?C.priPale:"transparent", cursor:"pointer", fontFamily:"inherit", position:"relative", transition:"background 0.15s", width:"100%" }} onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=C.priGhost}} onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background="transparent"}}>
              <span style={{display:"flex"}}>{it.ic(isActive)}</span>
              <span style={{ fontSize:14.3, fontWeight:isActive?700:500, color:isActive?C.pri:C.t2 }}>{it.l}</span>
              {it.bd>0 && <div style={{ marginLeft:"auto", minWidth:18, height:18, borderRadius: R.md, background:C.err, color:C.w, fontSize:9.9, fontWeight:700, padding:"0 5px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
              {isActive && <div style={{ position:"absolute", left:0, top:"20%", bottom:"20%", width:3, borderRadius: R.xs, background:C.pri }} />}
            </button>
          );
        })}
      </nav>

      {/* Mode toggle + Theme toggle */}
      <div style={{ borderTop:`1px solid ${C.b2}`, padding:"8px 12px", display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
        {FEATURES.SIMPLE_MODE_TOGGLE && onToggleSimple && <div style={{ position:"relative", display:"flex", borderRadius: R.sm, background:C.b2, padding:2, cursor:"pointer" }} onClick={onToggleSimple}>
          <div style={{ position:"absolute", top:2, left:simpleMode?"50%":2, width:"calc(50% - 2px)", height:"calc(100% - 4px)", borderRadius: R.sm, background:C.t3, transition:"left 0.25s ease", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }} />
          <span style={{ flex:1, textAlign:"center", fontSize:9.9, fontWeight:700, padding:"4px 0", position:"relative", zIndex:1, color:simpleMode?C.t3:C.w, transition:"color 0.2s", userSelect:"none" }}>Completo</span>
          <span style={{ flex:1, textAlign:"center", fontSize:9.9, fontWeight:700, padding:"4px 0", position:"relative", zIndex:1, color:simpleMode?C.w:C.t3, transition:"color 0.2s", userSelect:"none" }}>Simple</span>
        </div>}
      </div>
      {SearchHoverPreview && createPortal(SearchHoverPreview, document.body)}
    </div>
  );
}

// ======================== BOTTOM NAV =================================

export function Nav({ active, onChange, unread=0, pendingCount=0, notifCount=0, canRequest=false, onNew, simpleMode=false }) {
  const hasPending = pendingCount > 0;
  const centerColor = hasPending ? C.acc : C.ok;
  const allNavItems = [
    { k:"home",     ic:a=>Ic.home(a?C.pri:C.t3,20),  l:"Inicio" },
    { k:"list",     ic:a=>Ic.truck(a?C.pri:C.t3,20),  l:"Fletes" },
    { k:"center",  sp:true, bd:pendingCount },
    { k:"locations",ic:a=>Ic.map(a?C.pri:C.t3,20), l:"Mapa" },
    { k:"menu",     ic:a=>Ic.menu3(a?C.pri:C.t3,20),  l:"Menú", bd:notifCount },
  ];
  const items = allNavItems;
  return (
    <nav aria-label="Navegación" style={{ display:"flex", borderTop:`1px solid ${C.b1}`, background:C.nav, paddingTop:2, paddingBottom:"max(4px, env(safe-area-inset-bottom))", flexShrink:0 }}>
      <style>{`@keyframes truckDrive{0%{transform:translateX(-10px)}60%{transform:translateX(6px)}100%{transform:translateX(-10px)}}`}</style>
      {items.map(it=>(
        <button key={it.k} onClick={()=>onChange(it.k)} style={{ flex:it.sp&&canRequest?1.6:1, display:"flex", flexDirection:"column", alignItems:"center", gap:1, border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", position:"relative", padding:it.sp?"0":"5px 0", minHeight:42, WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
          {it.sp ? <>
            <div onClick={e=>{e.stopPropagation();onChange("home")}} style={{ width:40, height:40, borderRadius: R.pill, background:centerColor, display:"flex", alignItems:"center", justifyContent:"center", marginTop:-16, boxShadow:`0 3px 12px ${centerColor}40`, position:"relative", transition:"background 0.5s ease, box-shadow 0.5s ease" }}>
              {hasPending ? Ic.clk(C.w,18) : Ic.chk(C.w,18)}
              {it.bd>0 && <div style={{ position:"absolute", top:-4, right:-4, minWidth:16, height:16, borderRadius: R.md, background:C.err, color:C.w, fontSize:8.8, fontWeight:700, padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.nav}` }}>{it.bd}</div>}
            </div>
            <span style={{ fontSize:9.9, fontWeight:700, color:centerColor, marginTop:1, transition:"color 0.5s ease" }}>{hasPending?"Pendientes":"Al día"}</span>
            {canRequest && (
              <div onClick={e=>{e.stopPropagation();onNew();}} style={{ display:"flex", alignItems:"center", gap:5, marginTop:2, padding:"6px 14px", borderRadius: R.pill, background:C.acc, cursor:"pointer", boxShadow:`0 2px 8px ${C.acc}40` }}>
                <span style={{ display:"inline-flex", animation:"truckDrive 1.5s ease-in-out infinite" }}>{Ic.truck(C.w,15)}</span>
                <span style={{ fontSize:12.1, fontWeight:700, color:C.w, whiteSpace:"nowrap" }}>Solicitar flete</span>
              </div>
            )}
          </> : <>
            <span style={{display:"flex"}}>{it.ic(active===it.k)}</span>
            <span style={{ fontSize:11, fontWeight:active===it.k?700:500, color:active===it.k?C.pri:C.t3 }}>{it.l}</span>
            {it.bd>0 && <div style={{ position:"absolute", top:1, right:"20%", minWidth:14, height:14, borderRadius: R.sm, background:C.err, color:C.w, fontSize:8.8, fontWeight:700, padding:"0 3px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
          </>}
        </button>
      ))}
    </nav>
  );
}

// ======================== NOTIFICATIONS PANEL ========================

const NOTIF_ICONS = {
  freight_created: (s) => Ic.truck(C.pri, s),
  freight_assigned: (s) => Ic.truck(C.info, s),
  freight_accepted: (s) => Ic.chk(C.ok, s),
  freight_rejected: (s) => Ic.ban(C.err, s),
  freight_started: (s) => Ic.nav(C.info, s),
  freight_loaded: (s) => Ic.truck(C.ok, s),
  freight_finished: (s) => Ic.chk(C.ok, s),
  freight_cancelled: (s) => Ic.ban(C.err, s),
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}sem`;
}

export function NotificationsPanel({ open, onClose, notifications=[], onMarkRead, onMarkAllRead, onTap }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    const tid = setTimeout(() => document.addEventListener("click", handleClick), 0);
    window.addEventListener("keydown", handleKey);
    return () => { clearTimeout(tid); document.removeEventListener("click", handleClick); window.removeEventListener("keydown", handleKey); };
  }, [open, onClose]);

  const { unread, read } = useMemo(() => {
    const u = [], r = [];
    notifications.forEach(n => (n.read ? r : u).push(n));
    return { unread: u, read: r };
  }, [notifications]);

  if (!open) return null;

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Notificaciones" style={{
      position:"absolute", top:"100%", right:0, marginTop:8, width:360, maxWidth:"calc(100vw - 24px)",
      background:C.w, borderRadius: R.xl, boxShadow:C.shLg, border:`1px solid ${C.b2}`,
      zIndex:150, overflow:"hidden", animation:"fadeIn 0.2s ease"
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px 12px" }}>
        <span style={{ fontSize:17.6, fontWeight:700, color:C.t1 }}>Notificaciones</span>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} style={{ border:"none", background:"none", cursor:"pointer", fontSize:13.2, fontWeight:600, color:C.pri, fontFamily:"inherit", padding:"4px 8px", borderRadius: R.sm }}
            onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="none"}>
            Marcar todas leídas
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight:420, overflowY:"auto", overscrollBehavior:"contain" }}>
        {notifications.length === 0 && (
          <div style={{ padding:"40px 20px", textAlign:"center" }}>
            <div style={{ marginBottom:8 }}>{Ic.bell(C.b1, 36)}</div>
            <div style={{ fontSize:14.3, fontWeight:600, color:C.t3 }}>Sin notificaciones</div>
            <div style={{ fontSize:12.1, color:C.t3, marginTop:4 }}>Las novedades de tus fletes aparecerán aquí</div>
          </div>
        )}

        {notifications.map(n => {
          const icFn = NOTIF_ICONS[n.type] || ((s) => Ic.bell(C.t3, s));
          return (
            <button key={n.id} onClick={() => { if (!n.read) onMarkRead(n.id); if (n.entityId) onTap(n.entityId); onClose(); }}
              style={{
                display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 16px",
                border:"none", background: n.read ? "none" : C.priGhost, cursor:"pointer",
                fontFamily:"inherit", textAlign:"left", borderBottom:`1px solid ${C.b2}`,
                WebkitTapHighlightColor:"transparent", touchAction:"manipulation", transition:"background 0.15s"
              }}
              onMouseEnter={e=>e.currentTarget.style.background=n.read?C.bg:C.priPale}
              onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":C.priGhost}>

              {/* Icon */}
              <div style={{ width:28, height:28, borderRadius: R.md, background: n.read ? C.bg : C.priPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {icFn(14)}
              </div>

              {/* Content — 2 lines max */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                  <span style={{ fontSize:13.8, fontWeight: n.read ? 500 : 700, color: n.read ? C.t2 : C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:0 }}>{n.title}</span>
                  <span style={{ fontSize:11, color:C.t3, fontWeight:500, whiteSpace:"nowrap", flexShrink:0 }}>{timeAgo(n.createdAt)}</span>
                </div>
                <div style={{ fontSize:12.1, color:C.t3, lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{n.body}</div>
              </div>

              {/* Unread dot */}
              {!n.read && <div style={{ width:7, height:7, borderRadius: R.xs, background:C.pri, flexShrink:0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ======================== NOTIFICATION BELL ===========================

export function NotifBell({ count=0, onClick }) {
  return (
    <button onClick={onClick} aria-label={count > 0 ? `Notificaciones (${count} sin leer)` : "Notificaciones"} style={{ position:"relative", border:"none", background:"none", cursor:"pointer", padding:6, borderRadius: R.md, display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}
      onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="none"}>
      {Ic.bell(C.t2, 22)}
      {count > 0 && (
        <div style={{ position:"absolute", top:2, right:2, minWidth:16, height:16, borderRadius: R.md, background:C.err, color:C.w, fontSize:9.9, fontWeight:700, padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.w}`, lineHeight:1 }}>
          {count > 99 ? "99+" : count}
        </div>
      )}
    </button>
  );
}
