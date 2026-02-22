import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadPhoto, apiAddDocument, apiListConversations } from "./api";
import { C, track, FONT, Ic } from "./theme";
import { POLL_INTERVALS } from "./constants";
import { Toast, LoadingOverlay, Sidebar, Nav, NotifBell, NotificationsPanel, ErrorBoundary, SkeletonList, PwaInstallCard, EmptyState } from "./components";
import { useAuth, useCatalog, useFreights, permsFor, useIsDesktop, useOnline, useNotifications, useSSE, useInstallPrompt } from "./hooks";
import { RoutesBackground } from "./routes-bg";

// Lazy load heavy map components
const MapOverlay = lazy(() => import("./maps").then(m => ({ default: m.MapOverlay })));
const LocPickerFullscreen = lazy(() => import("./maps").then(m => ({ default: m.LocPickerFullscreen })));
import { useUIStore, offlineQueue } from "./store";
import { resolveUserTypeForFreight, getPendingActions } from "./utils/freight-helpers";
import { setUser as setSentryUser } from "./sentry";
import log from "./logger";

// ======================== LAZY-LOADED SCREENS ===========================
const LandingScreen = lazy(() => import("./screens/LandingScreen"));
const HomeScreen = lazy(() => import("./screens/HomeScreen"));
const ListScreen = lazy(() => import("./screens/ListScreen"));
const DetailScreen = lazy(() => import("./screens/DetailScreen"));
const NewScreen = lazy(() => import("./screens/NewScreen"));
const EditScreen = lazy(() => import("./screens/EditScreen"));
const CalendarScreen = lazy(() => import("./screens/CalendarScreen"));
const MenuScreen = lazy(() => import("./screens/MenuScreen"));
const TrucksScreen = lazy(() => import("./screens/TrucksScreen"));
const FieldsScreen = lazy(() => import("./screens/FieldsScreen"));
const AdminScreen = lazy(() => import("./screens/AdminScreen"));
const MyDataScreen = lazy(() => import("./screens/MyDataScreen"));
const ReportsScreen = lazy(() => import("./screens/ReportsScreen"));
const ChatsScreen = lazy(() => import("./screens/ChatsScreen"));
const NotificationsScreen = lazy(() => import("./screens/NotificationsScreen"));
// CompanyHeaderPicker removed — company selector moved to Sidebar

// Lazy modals
const ConfirmActionModal = lazy(() => import("./modals/ConfirmActionModal"));
const AssignModal = lazy(() => import("./modals/AssignModal"));
const TruckSelectModal = lazy(() => import("./modals/TruckSelectModal"));
const ReasonModal = lazy(() => import("./modals/ReasonModal"));

// ======================== ROUTE MAP ===================================
const SCREEN_TO_PATH = {
  home: "/", list: "/list", detail: "/freight", new: "/new", edit: "/edit",
  calendar: "/calendar", menu: "/menu", trucks: "/trucks", fields: "/fields",
  admin: "/admin", mydata: "/mydata", reports: "/reports", chats: "/chats",
  notifs: "/notifications",
};
const PATH_TO_SCREEN = {};
Object.entries(SCREEN_TO_PATH).forEach(([s, p]) => { PATH_TO_SCREEN[p] = s; });

// ======================== SCREEN LOADER ===============================
const SL = () => <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,gap:14,animation:"fadeIn 0.3s ease"}}>
  <div style={{display:"flex",gap:6}}>
    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:4,background:C.pri,opacity:0.3,animation:`tvDots 1.2s ${i*0.15}s ease-in-out infinite`}}/>)}
  </div>
  <style>{`@keyframes tvDots{0%,80%,100%{opacity:0.3;transform:scale(1)}40%{opacity:1;transform:scale(1.3)}}`}</style>
</div>;

// ======================== MAIN APP ====================================
export default function Tolvink() {

  const auth = useAuth();
  const fh = useFreights(auth.user, auth.isInitialized);
  const catalog = useCatalog(auth.user);
  const online = useOnline();
  const notif = useNotifications(auth.user);
  const pwa = useInstallPrompt();
  const isDesktop = useIsDesktop(768);

  // Zustand UI store — individual selectors prevent re-renders
  const modal = useUIStore(s => s.modal);
  const toast = useUIStore(s => s.toast);
  const mapFocus = useUIStore(s => s.mapFocus);
  const listView = useUIStore(s => s.listView);
  const submitting = useUIStore(s => s.submitting);
  const submitDone = useUIStore(s => s.submitDone);
  const actionLoading = useUIStore(s => s.actionLoading);
  const notifOpen = useUIStore(s => s.notifOpen);
  const chatConvId = useUIStore(s => s.chatConvId);
  const duplicateData = useUIStore(s => s.duplicateData);
  const editData = useUIStore(s => s.editData);
  const setModal = useUIStore(s => s.setModal);
  const setToast = useUIStore(s => s.setToast);
  const show = useUIStore(s => s.show);
  const setMapFocus = useUIStore(s => s.setMapFocus);
  const setListView = useUIStore(s => s.setListView);
  const setSubmitting = useUIStore(s => s.setSubmitting);
  const setSubmitDone = useUIStore(s => s.setSubmitDone);
  const setNotifOpen = useUIStore(s => s.setNotifOpen);
  const setChatConvId = useUIStore(s => s.setChatConvId);
  const setDuplicateData = useUIStore(s => s.setDuplicateData);
  const setEditData = useUIStore(s => s.setEditData);
  const locPicker = useUIStore(s => s.locPicker);
  const setLocPicker = useUIStore(s => s.setLocPicker);
  const goToMap = useUIStore(s => s.goToMap);

  // SSE chat events — forwarded to ChatsScreen
  const [sseMsg, setSseMsg] = useState(null);
  const [sseTyping, setSseTyping] = useState(null);
  const [sseRead, setSseRead] = useState(null);
  const [viewAll, setViewAll] = useState(false);

  // SSE — real-time sync
  const sse = useSSE(auth.user, {
    onFreightUpdate: () => fh.fetchAll(),
    onMessageNew: (data) => {
      // Issue #9 fix: only increment unread if message is from another user
      if (data.senderId && data.senderId !== auth.user?.id) {
        setUnreadChats(p => p + 1);
      }
      setSseMsg(data);
    },
    onNotification: () => { notif.refresh(); },
    onCatalogChanged: () => { catalog.refresh(); },
    onTyping: (data) => { setSseTyping(data); },
    onRead: (data) => { setSseRead(data); },
  });

  // React Router — URL-based navigation
  const navigate = useNavigate();
  const location = useLocation();

  // Derive screen from current URL path
  const screen = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/freight/")) return "detail";
    if (p.startsWith("/edit/")) return "edit";
    if (p.startsWith("/chats/")) return "chats";
    return PATH_TO_SCREEN[p] || "home";
  }, [location.pathname]);

  // Extract freight ID from URL params
  const [selFreight, setSelFreight] = useState(null);
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith("/freight/")) {
      const id = p.replace("/freight/", "");
      if (id && id !== selFreight) { setSelFreight(id); fh.refresh(id); }
    }
  }, [location.pathname]);

  const [unreadChats, setUnreadChats] = useState(0);

  // Redirect to home when user logs in + Sentry user tracking
  const prevUser = useRef(null);
  useEffect(()=>{
    if(auth.user && !prevUser.current) { navigate("/", { replace: true }); }
    prevUser.current = auth.user;
    setSentryUser(auth.user);
  },[auth.user]);

  // Filter freights by active company (multi-company users only see selected company's data)
  const viewFreights = useMemo(() => {
    if (!auth.user || !fh.freights) return fh.freights;
    if (viewAll) return fh.freights;
    const cId = auth.user.activeCompanyId || auth.user.companyId;
    if (!cId || (auth.user.companies || []).length <= 1) return fh.freights;
    return fh.freights.filter(f =>
      f.originCompanyId === cId ||
      f.destCompanyId === cId ||
      f.transporterId === cId
    );
  }, [fh.freights, auth.user, viewAll]);

  // Calculate pending actions count
  const pendingCount = useMemo(() => {
    if (!auth.user || !viewFreights) return 0;
    return viewFreights.filter(f => getPendingActions(f, auth.user.userType) !== null).length;
  }, [viewFreights, auth.user]);

  // Smart polling — only freight screens poll freights, auto-refresh on screen change
  const FREIGHT_SCREENS = useMemo(() => new Set(["home","list","calendar","detail","reports","notifs"]), []);
  useEffect(()=>{
    if(!auth.user) return;
    // Immediate refresh when entering a freight screen
    if (FREIGHT_SCREENS.has(screen) && navigator.onLine) fh.fetchAll();
    notif.refresh();
    const poll = () => {
      if (document.hidden || !navigator.onLine) return;
      if (FREIGHT_SCREENS.has(screen)) fh.fetchAll();
      notif.refresh();
    };
    const iv = setInterval(poll, POLL_INTERVALS.FREIGHTS);
    return ()=>clearInterval(iv);
  },[auth.user, screen]);

  // Poll for unread chats
  useEffect(()=>{
    if(!auth.user) return;
    const checkUnread = async ()=>{
      if (document.hidden || !navigator.onLine) return;
      try {
        const convs = await apiListConversations();
        const count = (convs||[]).filter(c => c.unread).length;
        setUnreadChats(count);
      } catch (e) { log.warn('CHAT', 'Unread check failed:', e.message); }
    };
    checkUnread();
    const iv = setInterval(checkUnread, POLL_INTERVALS.UNREAD_CHATS);
    return ()=>clearInterval(iv);
  },[auth.user]);

  // Visibility refresh — immediate refetch when user returns to tab
  useEffect(()=>{
    if(!auth.user) return;
    const onVisible = () => {
      if (document.hidden || !navigator.onLine) return;
      fh.fetchAll();
      notif.refresh();
      catalog.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  },[auth.user]);

  // Replay offline queue when back online
  useEffect(() => {
    if (!online || !auth.user) return;
    (async () => {
      const items = await offlineQueue.getAll();
      for (const item of items) {
        try {
          if (item.type === "create") await fh.create(item.payload);
          else if (item.type === "cancel") await fh.cancel(item.payload.id, item.payload.reason);
          else if (item.type === "update") await fh.update(item.payload.id, item.payload.data);
          await offlineQueue.remove(item.id);
          log.log('OfflineQueue', 'Replayed:', item.type);
        } catch (e) {
          log.error('OfflineQueue', 'Replay failed:', item.type, e);
          break;
        }
      }
    })();
  }, [online, auth.user]);

  const perms = useMemo(()=>permsFor(auth.user),[auth.user]);
  const _resolveType = useCallback((f) => resolveUserTypeForFreight(f, auth.user), [auth.user]);
  const _activeComp = useMemo(() => { const c = (auth.user?.companies||[]).find(x => x.companyId === (auth.user?.activeCompanyId||auth.user?.companyId)); return c || null; }, [auth.user]);

  // Navigation — updates URL + triggers side effects
  const nav = (s, fId) => {
    track("screen_view", { screen: s });
    if (s === "new_date" && fId) {
      if (!perms.canRequest) { show("Sin permisos para solicitar", "err"); return; }
      setDuplicateData({ preDate: fId });
      navigate("/new");
      return;
    }
    if (fId) {
      setSelFreight(fId);
      if (s === "detail") { fh.refresh(fId); navigate(`/freight/${fId}`); return; }
    }
    if (s === "new" && !perms.canRequest) { show("Sin permisos para solicitar", "err"); return; }
    const path = SCREEN_TO_PATH[s] || "/";
    navigate(path);
  };

  const handleNotifTap = (freightId) => { setSelFreight(freightId); fh.refresh(freightId); navigate(`/freight/${freightId}`); };

  const handleAction = (fId,action)=>{
    if(actionLoading) return;
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    if(action==="assign") { setModal({type:"assign",freight:f}); }
    else if(action==="cancel") { setModal({type:"reason",freight:f,title:"Cancelar flete",btnLabel:"Cancelar flete",action:"cancel"}); }
    else if(action==="reject") { setModal({type:"reason",freight:f,title:"Rechazar asignación",btnLabel:"Rechazar",action:"reject"}); }
    else if(action==="accept") { setModal({type:"truck_select",freight:f}); }
    else if(action==="start") { setModal({type:"confirm_action",freight:f,title:"Iniciar viaje",btnLabel:"Iniciar viaje",btnVariant:"acc",icon:Ic.truck(C.acc,24),action:"start"}); }
    else if(action==="authorize") { setModal({type:"confirm_action",freight:f,title:"Autorizar viaje",btnLabel:"Autorizar",icon:Ic.chk(C.pri,24),action:"authorize"}); }
    else if(action==="confirm_loaded") { setModal({type:"confirm_action",freight:f,title:"Confirmar carga",btnLabel:"Confirmar carga",btnVariant:"acc",icon:Ic.chk(C.acc,24),action:"confirm_loaded"}); }
    else if(action==="confirm_finished") { setModal({type:"confirm_action",freight:f,title:"Confirmar entrega",btnLabel:"Confirmar entrega",icon:Ic.chk(C.pri,24),action:"confirm_finished"}); }
  };

  const handleAcceptWithTruck = async (fId, truckId)=>{
    const r = await fh.respond(fId, "accepted", undefined, truckId);
    if(r.ok){ track("freight_accept"); return "Flete aceptado"; }
    show(r.error,"err"); return "";
  };

  const handleAssign = async (fId, transportCompanyId, truckId)=>{
    const r = await fh.assign(fId, transportCompanyId, truckId);
    if(r.ok){ track("freight_assign"); return "Transportista asignado"; }
    show(r.error,"err"); return "";
  };

  const handleConfirmAction = async (fId, action)=>{
    const msgs = { start:"Viaje iniciado", authorize:"Viaje autorizado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada" };
    const fn = { start:fh.start, authorize:fh.authorize, confirm_loaded:fh.confirmLoaded, confirm_finished:fh.confirmFinished }[action];
    if(!fn) return "";
    const r = await fn(fId);
    if(r.ok) return msgs[action]||"Hecho";
    show(r.error,"err"); return "";
  };

  const handleReasonAction = async (fId,reason,action)=>{
    let r;
    if(action==="cancel") r = await fh.cancel(fId,reason);
    else if(action==="reject") r = await fh.respond(fId,"rejected",reason);
    const msg = action==="cancel"?"Flete cancelado":"Asignación rechazada";
    if(r?.ok) return msg;
    show(r?.error||"Error","err"); return "";
  };

  const handleCreate = async (form)=>{
    setSubmitting(true);

    if (!navigator.onLine) {
      await offlineQueue.enqueue({ type: "create", payload: form });
      setSubmitting(false);
      setSubmitDone("Flete guardado — se enviará cuando vuelvas a estar en línea");
      return;
    }

    const r = await fh.create(form);
    if(r.ok && r.freightId && form.photos?.length > 0) {
      for(const photoUrl of form.photos) {
        try {
          const blob = await fetch(photoUrl).then(r=>r.blob());
          const file = new File([blob], `foto-${Date.now()}.jpg`, {type:'image/jpeg'});
          const url = await uploadPhoto(file, r.freightId, 'request');
          await apiAddDocument(r.freightId, { name: file.name, url, type:'photo', step:'request' });
        } catch(e) { log.error('FREIGHT', 'Photo upload failed:', e); }
      }
    }
    setSubmitting(false);
    if(r.ok){ track("freight_create"); setSubmitDone("Flete solicitado"); } else show(r.error,"err");
  };

  // O(1) freight lookup (must be before conditional returns — Rules of Hooks)
  const freightMap = useMemo(() => { const m = new Map(); fh.freights.forEach(f => m.set(f.id, f)); return m; }, [fh.freights]);

  // Show loading splash only during initial auth check
  if (!auth.isInitialized) {
    return <div style={{minHeight:"100dvh",background:C.bg,fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,800&display=swap');@keyframes splashIn{0%{opacity:0;transform:scale(0.7)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}*{margin:0;padding:0;box-sizing:border-box}html,body,#root{background:${C.bg};margin:0;height:auto!important;overflow:visible!important}`}</style>
      <div style={{textAlign:"center",animation:"splashIn 0.8s ease-out forwards"}}>
        <span style={{fontSize:83,fontWeight:800,color:C.pri,letterSpacing:-3.5,display:"inline-block"}}>tolvink</span>
        <span style={{width:16,height:16,borderRadius:8,background:C.acc,display:"inline-block",marginLeft:5,marginTop:-34,verticalAlign:"top",animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
      </div>
    </div>;
  }

  // If no user after initialization, show landing
  if(!auth.user) {
    return <Suspense fallback={<SL/>}><LandingScreen onLogin={auth.login} onSignup={auth.signup} loading={auth.loading} error={auth.error} clearError={auth.clearError}/></Suspense>;
  }

  const curFreight = freightMap.get(selFreight) || null;
  const navActive = ["detail"].includes(screen)?"list":["trucks","fields","admin","mydata","calendar","reports"].includes(screen)&&!isDesktop?"menu":["trucks","fields","admin","mydata"].includes(screen)?"menu":screen;

  return (
    <div className="tv-shell" style={{height:"100dvh",background:C.bg,color:C.t1,fontFamily:FONT,display:"flex",flexDirection:isDesktop?"row":"column",width:"100%",position:"relative",overflow:"hidden"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body{height:100%;margin:0;overflow-x:hidden;max-width:100vw}body{background:${C.bg};overflow-y:hidden;overscroll-behavior:none}input,textarea,select,button{font-size:16px}input::placeholder,textarea::placeholder{color:${C.t3}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.b1};border-radius:4px}@keyframes ti{0%,100%{opacity:1}50%{opacity:.4}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes pageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.tv-page{animation:pageIn 0.25s ease-out}.tv-card{transition:transform 0.15s ease,box-shadow 0.15s ease}.tv-row{transition:background 0.1s ease}@media(hover:hover){.tv-card:hover{transform:translateY(-2px);box-shadow:${C.shMd}!important}.tv-row:hover{background:${C.priGhost}!important}}@media(min-width:640px){.tv-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}.tv-grid3{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:12px!important}.tv-pad{padding:24px 32px!important}.tv-detail-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:16px!important}.tv-table th,.tv-table td{padding:10px 12px!important;font-size:12px!important}.tv-stats{gap:12px!important}.tv-stats>div{padding:14px 12px!important;border-radius:12px!important}.tv-stats .tv-stat-num{font-size:28px!important}.tv-header-bar{padding:10px 32px 0 32px!important}}@media(min-width:768px){.tv-mobile-header{display:none!important}.tv-mobile-nav{display:none!important}.tv-kanban{flex-direction:row!important;gap:12px!important}.tv-kanban-col{max-height:calc(100vh - 280px)!important;overflow-y:auto!important}}@media(max-width:767px){.tv-sidebar{display:none!important}.tv-shell{max-width:100vw!important;width:100%!important}}@media(min-width:900px){.tv-grid{grid-template-columns:1fr 1fr 1fr!important}}@media(min-width:1100px){.tv-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>

      <RoutesBackground trucks={false} opacityMul={0.4} centerFade={false} />

      {/* Desktop Sidebar */}
      <div className="tv-sidebar" style={{position:"relative",zIndex:1}}>
        <Sidebar active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={notif.unreadCount} canRequest={perms.canRequest} onNew={()=>nav("new")} activeCompany={auth.user ? { id: auth.user.activeCompanyId||auth.user.companyId, name: _activeComp?.companyName||auth.user.entity, type: _activeComp?.companyType||auth.user.userType } : null} companies={auth.user?.companies||[]} onSwitchCompany={async(id)=>{if(id===null){setViewAll(true);return;}setViewAll(false);const r=await auth.switchCompany(id);if(r.ok){fh.fetchAll();catalog.refresh();}}} viewAll={viewAll} />
      </div>

      {/* Main content column */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, position:"relative", zIndex:1 }}>
        {/* Mobile-only header */}
        <div className="tv-mobile-header" style={{paddingTop:"max(12px, env(safe-area-inset-top))",paddingBottom:12,paddingLeft:18,paddingRight:18,display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${C.b2}`,background:C.w,flexShrink:0,zIndex:10,position:"relative"}}>
          <div style={{display:"inline-flex",alignItems:"flex-start",flexShrink:0}}>
            <span style={{fontSize:30,fontWeight:800,color:C.pri,letterSpacing:-0.9,lineHeight:1}}>tolvink</span>
            <span style={{width:8,height:8,borderRadius:4,background:C.acc,display:"inline-block",marginLeft:3,marginTop:1,animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
          </div>
          <div style={{flex:1}}/>
          {auth.user?.entity && <span style={{ fontSize:11, fontWeight:600, color:C.t2, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{auth.user.entity}</span>}
          <div style={{position:"relative",flexShrink:0}}>
            <NotifBell count={notif.unreadCount} onClick={()=>setNotifOpen(!notifOpen)} />
            <NotificationsPanel open={notifOpen} onClose={()=>setNotifOpen(false)} notifications={notif.notifications} onMarkRead={notif.markRead} onMarkAllRead={notif.markAllRead} onTap={handleNotifTap} />
          </div>
        </div>

        {/* Desktop: no header bar — company selector is in Sidebar */}

        {/* Offline banner */}
        {!online && <div style={{background:"#f59e0b",color:"#fff",textAlign:"center",padding:"6px 12px",fontSize:13,fontWeight:600,flexShrink:0,zIndex:10}}>{Ic.warn("#fff",14)} Sin conexión — mostrando datos guardados</div>}

        {/* Map bar + fullscreen map when mapFocus is active */}
        {mapFocus && <>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px",background:C.w,borderBottom:`1px solid ${C.b2}`,flexShrink:0,zIndex:10}}>
            <button onClick={()=>setMapFocus(null)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.bg,cursor:"pointer",fontSize:13,fontWeight:700,color:C.pri,fontFamily:"inherit"}}>{Ic.chev(C.pri,14)} Cerrar mapa</button>
            <span style={{flex:1,fontSize:12,color:C.t2,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mapFocus.label||"Ubicación"}</span>
            <a href={mapFocus.destLat&&mapFocus.destLng?`https://www.google.com/maps/dir/?api=1&origin=${mapFocus.lat},${mapFocus.lng}&destination=${mapFocus.destLat},${mapFocus.destLng}&travelmode=driving`:`https://www.google.com/maps/search/?api=1&query=${mapFocus.lat},${mapFocus.lng}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:C.pri,color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none",fontFamily:"inherit",flexShrink:0}}>Google Maps ↗</a>
          </div>
          <div style={{flex:1,minHeight:0}}>
            <Suspense fallback={<SL/>}><MapOverlay lat={mapFocus.lat} lng={mapFocus.lng} label={mapFocus.label} destLat={mapFocus.destLat} destLng={mapFocus.destLng} destLabel={mapFocus.destLabel} onClose={()=>setMapFocus(null)}/></Suspense>
          </div>
        </>}

        {/* Location picker fullscreen */}
        {locPicker && <Suspense fallback={<SL/>}><LocPickerFullscreen value={locPicker.value} onChange={locPicker.onChange} defaultCenter={locPicker.defaultCenter} label={locPicker.label} onClose={()=>setLocPicker(null)}/></Suspense>}

        {/* Scrollable content area */}
        <div style={{flex:1,overflow:(screen==="chats"||screen==="calendar")&&isDesktop?"hidden":"auto",display:(mapFocus||locPicker)?"none":"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
        <div key={screen} className="tv-page" style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        <Suspense fallback={<SL/>}>
        {screen==="home" && <HomeScreen user={auth.user} freights={viewFreights} loading={fh.loading} perms={perms} onNav={nav} catalog={catalog} isDesktop={isDesktop} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap} pwa={pwa}/>}
        {screen==="list" && <ListScreen freights={viewFreights} loading={fh.loading} onNav={nav} onRefresh={fh.fetchAll} catalog={catalog} view={listView} setView={setListView} goToMap={goToMap} hasMore={fh.hasMore} loadMore={fh.loadMore} loadingMore={fh.loadingMore} total={fh.total} isDesktop={isDesktop}/>}
        {screen==="calendar" && <CalendarScreen freights={viewFreights} perms={perms} onNav={nav} isDesktop={isDesktop} user={auth.user} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap}/>}
        {screen==="detail" && <DetailScreen user={curFreight ? {...auth.user, userType: _resolveType(curFreight)} : auth.user} freight={curFreight} perms={perms} onBack={()=>navigate("/list")} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap}/>}
        {screen==="new" && <NewScreen user={auth.user} lots={catalog.lots} plants={catalog.plants} branches={catalog.branches} fields={catalog.fields} trucks={catalog.trucks} onBack={()=>{setDuplicateData(null);navigate("/");}} onCreate={handleCreate} submitting={submitting} duplicateFrom={duplicateData}/>}
        {screen==="edit" && editData && <EditScreen freight={editData} fields={catalog.fields} plants={catalog.plants} onBack={()=>{setEditData(null);navigate(-1);}} onSave={async(id,data)=>{const r=await fh.update(id,data);if(r.ok) return "Flete actualizado"; show(r.error,"err"); return "";}}/>}
        {screen==="menu" && <MenuScreen user={auth.user} perms={perms} onLogout={auth.logout} onNav={nav} isDesktop={isDesktop} onSwitchCompany={async(id)=>{setViewAll(false);const r=await auth.switchCompany(id);if(r.ok){fh.fetchAll();catalog.refresh();}return r;}} onRefresh={()=>{fh.fetchAll();catalog.refresh();}} pwa={pwa}/>}
        {screen==="trucks" && <TrucksScreen user={auth.user} onBack={()=>{catalog.refresh();navigate("/menu");}}/>}
        {screen==="fields" && <FieldsScreen onBack={()=>{catalog.refresh();navigate("/menu");}} goToMap={goToMap}/>}
        {screen==="admin" && <AdminScreen user={auth.user} onBack={()=>navigate("/menu")}/>}
        {screen==="mydata" && <MyDataScreen user={auth.user} onBack={()=>navigate("/menu")}/>}
        {screen==="reports" && <ReportsScreen onBack={()=>navigate(isDesktop?"/reports":"/menu")} freights={viewFreights} isDesktop={isDesktop}/>}
        {screen==="chats" && <ChatsScreen user={auth.user} openConvId={chatConvId} onConvOpened={()=>setChatConvId(null)} isDesktop={isDesktop} sseMsg={sseMsg} onSseMsgHandled={()=>setSseMsg(null)} sseTyping={sseTyping} sseRead={sseRead} sseConnected={sse.connected}/>}
        {screen==="notifs" && <NotificationsScreen notifications={notif.notifications} freights={viewFreights} onMarkRead={notif.markRead} onMarkAllRead={notif.markAllRead} onTap={handleNotifTap} />}
        </Suspense>
        </div>
        </div>

        {/* Mobile-only bottom nav */}
        <div className="tv-mobile-nav">
          <Nav active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={0} canRequest={perms.canRequest} onNew={()=>nav("new")}/>
        </div>
      </div>

      {(submitting||submitDone) && <LoadingOverlay closing={!!submitDone} closingText={submitDone} onClose={()=>{setSubmitDone("");navigate("/list");}}/>}
      <Suspense fallback={null}>
      {modal?.type==="assign" && <AssignModal freight={modal.freight} transporters={catalog.transporters} onClose={()=>setModal(null)} onConfirm={(compId,truckId)=>handleAssign(modal.freight.id,compId,truckId)}/>}
      {modal?.type==="truck_select" && <TruckSelectModal freight={modal.freight} trucks={catalog.trucks} onClose={()=>setModal(null)} onConfirm={t=>handleAcceptWithTruck(modal.freight.id,t)}/>}
      {modal?.type==="confirm_action" && <ConfirmActionModal freight={modal.freight} title={modal.title} btnLabel={modal.btnLabel} btnVariant={modal.btnVariant} icon={modal.icon} onClose={()=>setModal(null)} onConfirm={()=>handleConfirmAction(modal.freight.id,modal.action)}/>}
      {modal?.type==="reason" && <ReasonModal title={modal.title} freight={modal.freight} btnLabel={modal.btnLabel} onClose={()=>setModal(null)} onConfirm={r=>handleReasonAction(modal.freight.id,r,modal.action)}/>}
      </Suspense>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
