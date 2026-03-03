import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadPhoto, apiAddDocument, apiListConversations } from "./api";
import { C, track, FONT, Ic } from "./theme";
import { POLL_INTERVALS } from "./constants";
import { Toast, LoadingOverlay, Sidebar, Nav, NotifBell, NotificationsPanel, ErrorBoundary, SkeletonList, EmptyState } from "./components";
import { useAuth, useCatalog, useFreights, permsFor, useIsDesktop, useOnline, useNotifications, useSSE } from "./hooks";
import { RoutesBackground } from "./routes-bg";
import "./app.css";

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
const PickLocationScreen = lazy(() => import("./screens/PickLocationScreen"));
const TrackFreightScreen = lazy(() => import("./screens/TrackFreightScreen"));
const ReportDownloadScreen = lazy(() => import("./screens/ReportDownloadScreen"));
const DailyMapScreen = lazy(() => import("./screens/DailyMapScreen"));
const LiveFreightScreen = lazy(() => import("./screens/LiveFreightScreen"));
const ViewMapScreen = lazy(() => import("./screens/ViewMapScreen"));
// CompanyHeaderPicker removed — company selector moved to Sidebar

// Lazy modals
const ConfirmActionModal = lazy(() => import("./modals/ConfirmActionModal"));
const AssignModal = lazy(() => import("./modals/AssignModal"));
const TruckSelectModal = lazy(() => import("./modals/TruckSelectModal"));
const ReasonModal = lazy(() => import("./modals/ReasonModal"));
const DriverQueueModal = lazy(() => import("./modals/DriverQueueModal"));
const EditTripModal = lazy(() => import("./modals/EditTripModal"));

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
  const [viewAll, setViewAll] = useState(false);
  const fh = useFreights(auth.user, auth.isInitialized, viewAll ? null : undefined);
  const catalog = useCatalog(auth.user);
  const online = useOnline();
  const notif = useNotifications(auth.user);
  const isDesktop = useIsDesktop(768);

  // Zustand UI store — individual selectors prevent re-renders
  const modal = useUIStore(s => s.modal);
  const toast = useUIStore(s => s.toast);
  const mapFocus = useUIStore(s => s.mapFocus);
  const listView = useUIStore(s => s.listView);
  const submitting = useUIStore(s => s.submitting);
  const submitDone = useUIStore(s => s.submitDone);
  const actionLoading = useUIStore(s => s.actionLoading);
  const setActionLoading = useUIStore(s => s.setActionLoading);
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
  const [compDropOpen, setCompDropOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  // SSE — real-time sync
  const sse = useSSE(auth.user, {
    onFreightUpdate: (data) => { if(data?.id) fh.refresh(data.id); else fh.fetchAll(); },
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
      if (id) { setSelFreight(id); fh.refresh(id); }
    }
  }, [location.pathname, fh.refresh]);

  // Redirect to home when user logs in + Sentry user tracking
  const prevUser = useRef(null);
  useEffect(()=>{
    const p = location.pathname;
    const isPublicPath = ["/pick-location","/track","/report","/daily-map","/live-freight","/ver-mapa"].includes(p)
      || /^\/(FLT-\d{4,}|F\d{2}-[A-Z]{3}\.\d{4})\/(ubicacion|informe)$/i.test(p)
      || /^\/campo\/[a-z0-9-]+\/ubicacion$/i.test(p);
    if(auth.user && !prevUser.current && !isPublicPath) {
      navigate("/", { replace: true });
    }
    prevUser.current = auth.user;
    setSentryUser(auth.user);
  },[auth.user, navigate, location.pathname]);

  // Server-side company filter handles multi-company. Chofer: client-side driver filter + queue sort
  const viewFreights = useMemo(() => {
    if (!auth.user || !fh.freights) return fh.freights;
    if (auth.user.role === "chofer") {
      return fh.freights.filter(f => f.driverId === auth.user.id).sort((a,b) => (a.queuePosition||0) - (b.queuePosition||0));
    }
    return fh.freights;
  }, [fh.freights, auth.user]);

  // Calculate pending actions count
  const pendingCount = useMemo(() => {
    if (!auth.user || !viewFreights) return 0;
    return viewFreights.filter(f => getPendingActions(f, auth.user.userType, auth.user.role, auth.user) !== null).length;
  }, [viewFreights, auth.user]);

  // Refs for polling callbacks — avoids stale closures in setInterval/event listeners
  const fhRef = useRef(fh);
  fhRef.current = fh;
  const notifRef = useRef(notif);
  notifRef.current = notif;
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  // Smart polling — only freight screens poll freights, auto-refresh on screen change
  // When SSE is disconnected, poll faster (10s) to compensate
  const FREIGHT_SCREENS = useMemo(() => new Set(["home","list","calendar","detail","reports","notifs"]), []);
  useEffect(()=>{
    if(!auth.user) return;
    // Immediate refresh when entering a freight screen
    if (FREIGHT_SCREENS.has(screen) && navigator.onLine) fhRef.current.fetchAll();
    notifRef.current.refresh();
    const poll = () => {
      if (document.hidden || !navigator.onLine) return;
      if (FREIGHT_SCREENS.has(screen)) fhRef.current.fetchAll();
      notifRef.current.refresh();
    };
    const interval = sse.connected ? POLL_INTERVALS.FREIGHTS : 10000;
    const iv = setInterval(poll, interval);
    return ()=>clearInterval(iv);
  },[auth.user, screen, sse.connected]);

  // Poll for unread chats — skip if SSE is connected (SSE handles real-time updates)
  useEffect(()=>{
    if(!auth.user) return;
    const checkUnread = async ()=>{
      if (document.hidden || !navigator.onLine || sse.connected) return;
      try {
        const convs = await apiListConversations();
        const count = (convs||[]).filter(c => c.unread).length;
        setUnreadChats(count);
      } catch (e) { log.warn('CHAT', 'Unread check failed:', e.message); }
    };
    checkUnread();
    const iv = setInterval(checkUnread, POLL_INTERVALS.UNREAD_CHATS);
    return ()=>clearInterval(iv);
  },[auth.user, sse.connected]);

  // Visibility refresh — immediate refetch when user returns to tab (catalog only if TTL expired)
  useEffect(()=>{
    if(!auth.user) return;
    const onVisible = () => {
      if (document.hidden || !navigator.onLine) return;
      fhRef.current.fetchAll();
      notifRef.current.refresh();
      catalogRef.current.refresh(false); // false = respect TTL, don't force
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
    if (s === "home") { setSelFreight(null); navigate("/"); return; }
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
    else if(action==="driver_queue") { setModal({type:"driver_queue",driverId:f.driverId,driverName:f.driverName}); }
  };

  const handleAcceptWithTruck = async (fId, truckId, driverId)=>{
    setActionLoading(true);
    try {
      const r = await fh.respond(fId, "accepted", undefined, truckId, driverId);
      if(r.ok){ track("freight_accept"); return "Flete aceptado"; }
      show(r.error,"err"); return "";
    } finally { setActionLoading(false); }
  };

  const handleAssign = async (fId, transportCompanyId, truckId, driverId)=>{
    setActionLoading(true);
    try {
      const r = await fh.assign(fId, transportCompanyId, truckId, driverId);
      if(r.ok){ track("freight_assign"); return "Transportista asignado"; }
      show(r.error,"err"); return "";
    } finally { setActionLoading(false); }
  };

  const handleAssignMulti = async (trucks)=>{
    if(!modal?.freight) return "";
    const r = await fh.assignMulti(modal.freight.id, trucks);
    if(r.ok){ track("freight_assign_multi"); return `${trucks.length} camiones asignados`; }
    show(r.error,"err"); return "";
  };

  const handleTripAction = (fId, aId, actionKey)=>{
    if(actionLoading) return;
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    const isPlant = auth.user?.userType === "plant" || (auth.user?.userTypes||[]).includes("plant");
    const cfgs = {
      respond_trip_accept: isPlant
        ? { title:"Autorizar viaje", btnLabel:"Autorizar", icon:Ic.chk(C.pri,24), btnVariant:"pri" }
        : { title:"Aceptar viaje", btnLabel:"Aceptar", icon:Ic.chk(C.ok,24), btnVariant:"pri" },
      start_trip: { title:"Iniciar viaje", btnLabel:"Iniciar viaje", icon:Ic.truck(C.acc,24), btnVariant:"acc" },
      confirm_trip_loaded: { title:"Confirmar carga", btnLabel:"Confirmar carga", icon:Ic.chk(C.acc,24), btnVariant:"acc" },
      confirm_trip_finished: { title:"Confirmar entrega", btnLabel:"Confirmar entrega", icon:Ic.chk(C.pri,24), btnVariant:"pri" },
    };
    if(actionKey==="respond_trip_reject") {
      setModal({type:"reason",freight:f,title:"Rechazar viaje",btnLabel:"Rechazar",action:"reject_trip",assignmentId:aId});
      return;
    }
    const cfg = cfgs[actionKey];
    if(!cfg) return;
    setModal({type:"confirm_trip_action",freight:f,...cfg,actionKey,assignmentId:aId});
  };

  const handleTripConfirmAction = async (fId, aId, actionKey, loadedTons)=>{
    setActionLoading(true);
    try {
      const msgs = { respond_trip_accept:"Viaje autorizado", start_trip:"Viaje iniciado", confirm_trip_loaded:"Carga confirmada", confirm_trip_finished:"Entrega confirmada" };
      let r;
      if(actionKey==="respond_trip_accept") r = await fh.respondTrip(fId, aId, {action:"accepted"});
      else if(actionKey==="start_trip") r = await fh.startTrip(fId, aId);
      else if(actionKey==="confirm_trip_loaded") r = await fh.confirmTripLoaded(fId, aId, loadedTons);
      else if(actionKey==="confirm_trip_finished") r = await fh.confirmTripFinished(fId, aId);
      if(r?.ok) return msgs[actionKey]||"Hecho";
      show(r?.error||"Error","err"); return "";
    } finally { setActionLoading(false); }
  };

  const handleEditTrip = (fId, assignment)=>{
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    setModal({type:"edit_trip",freight:f,assignment});
  };

  const handleSaveTrip = async (data)=>{
    if(!modal?.freight || !modal?.assignment) return "";
    const r = await fh.updateAssignment(modal.freight.id, modal.assignment.id, data);
    if(r.ok) return "Viaje actualizado";
    show(r.error,"err"); return "";
  };

  const handleConfirmAction = async (fId, action, loadedTons)=>{
    setActionLoading(true);
    try {
      const msgs = { start:"Viaje iniciado", authorize:"Viaje autorizado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada" };
      const fn = { start:fh.start, authorize:fh.authorize, confirm_loaded:fh.confirmLoaded, confirm_finished:fh.confirmFinished }[action];
      if(!fn) return "";
      const r = action==="confirm_loaded" ? await fn(fId, loadedTons) : await fn(fId);
      if(r.ok) return msgs[action]||"Hecho";
      show(r.error,"err"); return "";
    } finally { setActionLoading(false); }
  };

  const handleReasonAction = async (fId,reason,action,extra)=>{
    setActionLoading(true);
    try {
      let r;
      if(action==="cancel") r = await fh.cancel(fId,reason);
      else if(action==="reject") r = await fh.respond(fId,"rejected",reason);
      else if(action==="reject_trip" && extra?.assignmentId) { r = await fh.respondTrip(fId, extra.assignmentId, {action:"rejected",reason}); }
      const msg = action==="cancel"?"Flete cancelado":action==="reject_trip"?"Viaje rechazado":"Asignación rechazada";
      if(r?.ok) return msg;
      show(r?.error||"Error","err"); return "";
    } finally { setActionLoading(false); }
  };

  const handleCreate = async (form)=>{
    setSubmitting(true);

    if (!navigator.onLine) {
      await offlineQueue.enqueue({ type: "create", payload: { ...form, _idempotencyKey: crypto.randomUUID() } });
      setSubmitting(false);
      setSubmitDone("Flete guardado — se enviará cuando vuelvas a estar en línea");
      return;
    }

    const r = await fh.create(form);
    let photoFailCount = 0;
    if(r.ok && r.freightId && form.photos?.length > 0) {
      const results = await Promise.allSettled(form.photos.map(async (photoUrl, i) => {
        const blob = await fetch(photoUrl).then(res=>res.blob());
        const file = new File([blob], `foto-${Date.now()}-${i}.jpg`, {type:'image/jpeg'});
        const url = await uploadPhoto(file, r.freightId, 'request');
        await apiAddDocument(r.freightId, { name: file.name, url, type:'photo', step:'request' });
      }));
      photoFailCount = results.filter(res => res.status === 'rejected').length;
      results.filter(res => res.status === 'rejected').forEach(res => log.error('FREIGHT', 'Photo upload failed:', res.reason));
    }
    setSubmitting(false);
    if(r.ok){
      track("freight_create");
      if(photoFailCount > 0) show(`Flete solicitado, pero ${photoFailCount} foto(s) no se pudieron adjuntar`,"warn");
      else setSubmitDone("Flete solicitado");
    } else show(r.error,"err");
  };

  // O(1) freight lookup (must be before conditional returns — Rules of Hooks)
  const freightMap = useMemo(() => { const m = new Map(); fh.freights.forEach(f => m.set(f.id, f)); return m; }, [fh.freights]);

  // Show loading splash only during initial auth check
  if (!auth.isInitialized) {
    return <div style={{minHeight:"100dvh",background:C.bg,fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes splashIn{0%{opacity:0;transform:scale(0.7)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}*{margin:0;padding:0;box-sizing:border-box}html,body,#root{background:${C.bg};margin:0;height:auto!important;overflow:visible!important}`}</style>
      <div style={{textAlign:"center",animation:"splashIn 0.8s ease-out forwards"}}>
        <span style={{fontSize:83,fontWeight:800,color:C.pri,letterSpacing:-3.5,display:"inline-block"}}>tolvink</span>
        <span style={{width:16,height:16,borderRadius:8,background:C.acc,display:"inline-block",marginLeft:5,marginTop:-34,verticalAlign:"top",animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
      </div>
    </div>;
  }

  // Clean URL routes (new)
  const trackMatch = location.pathname.match(/^\/(FLT-\d{4,}|F\d{2}-[A-Z]{3}\.\d{4})\/ubicacion$/i);
  if (trackMatch) {
    return <Suspense fallback={<SL/>}><TrackFreightScreen code={trackMatch[1].toUpperCase()} /></Suspense>;
  }
  const reportMatch = location.pathname.match(/^\/(FLT-\d{4,}|F\d{2}-[A-Z]{3}\.\d{4})\/informe$/i);
  if (reportMatch) {
    return <Suspense fallback={<SL/>}><ReportDownloadScreen code={reportMatch[1].toUpperCase()} /></Suspense>;
  }
  const campoMatch = location.pathname.match(/^\/campo\/([a-z0-9-]+)\/ubicacion$/i);
  if (campoMatch) {
    return <Suspense fallback={<SL/>}><PickLocationScreen slug={campoMatch[1]} /></Suspense>;
  }
  if (location.pathname === "/ver-mapa") {
    return <Suspense fallback={<SL/>}><ViewMapScreen /></Suspense>;
  }

  // Legacy public routes (backward compatibility)
  if (location.pathname === "/pick-location") {
    return <Suspense fallback={<SL/>}><PickLocationScreen /></Suspense>;
  }

  // Public route: Real-time freight tracking (shared via WhatsApp)
  if (location.pathname === "/track") {
    return <Suspense fallback={<SL/>}><TrackFreightScreen /></Suspense>;
  }

  // Public route: PDF report download (shared via WhatsApp)
  if (location.pathname === "/report") {
    return <Suspense fallback={<SL/>}><ReportDownloadScreen /></Suspense>;
  }

  // Public route: Daily freight map (WhatsApp signed token)
  if (location.pathname === "/daily-map") {
    return <Suspense fallback={<SL/>}><DailyMapScreen /></Suspense>;
  }

  // Public route: Live freight location sharing (WhatsApp signed token)
  if (location.pathname === "/live-freight") {
    return <Suspense fallback={<SL/>}><LiveFreightScreen /></Suspense>;
  }

  // If no user after initialization, show landing
  if(!auth.user) {
    return <Suspense fallback={<SL/>}><LandingScreen onLogin={auth.login} onSignup={auth.signup} onPasswordReset={auth.handlePasswordReset} loading={auth.loading} error={auth.error} clearError={auth.clearError}/></Suspense>;
  }

  const curFreight = freightMap.get(selFreight) || null;
  const navActive = ["detail"].includes(screen)?"list":["trucks","fields","admin","mydata","calendar","reports"].includes(screen)&&!isDesktop?"menu":["trucks","fields","admin","mydata"].includes(screen)?"menu":screen;

  return (
    <div className="tv-shell" style={{height:"100dvh",background:C.bg,color:C.t1,fontFamily:FONT,display:"flex",flexDirection:isDesktop?"row":"column",width:"100%",position:"relative",overflow:"hidden"}}>
      <style>{`body{background:${C.bg}}input::placeholder,textarea::placeholder{color:${C.t3}}::-webkit-scrollbar-thumb{background:${C.b1}}@media(hover:hover){.tv-card:hover{box-shadow:${C.shMd}!important}.tv-row:hover{background:${C.priGhost}!important}}`}</style>

      <RoutesBackground trucks={false} opacityMul={0.4} centerFade={false} />

      {/* Desktop Sidebar */}
      <div className="tv-sidebar" style={{position:"relative",zIndex:1}}>
        <Sidebar active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={notif.unreadCount} canRequest={perms.canRequest} onNew={()=>nav("new")} activeCompany={auth.user ? { id: auth.user.activeCompanyId||auth.user.companyId, name: _activeComp?.companyName||auth.user.entity, type: _activeComp?.companyType||auth.user.userType } : null} companies={auth.user?.companies||[]} onSwitchCompany={async(id)=>{if(id===null){setViewAll(true);return;}setViewAll(false);await auth.switchCompany(id);}} viewAll={viewAll} />
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
          {auth.user?.entity && (auth.user.companies?.length > 1 ? (
            <div style={{position:"relative"}}>
              <button onClick={()=>setCompDropOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,cursor:"pointer",fontFamily:"inherit",maxWidth:140,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                <span style={{fontSize:11,fontWeight:600,color:C.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{auth.user.entity}</span>
                {Ic.down(C.t3,12)}
              </button>
              {compDropOpen && <>
                <div onClick={()=>setCompDropOpen(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
                <div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,boxShadow:C.shMd,zIndex:100,minWidth:180,overflow:"hidden"}}>
                  {auth.user.companies.map(c=>{
                    const isActive = c.companyId === auth.user.activeCompanyId;
                    return <button key={c.companyId} onClick={async()=>{
                      setCompDropOpen(false);
                      if(!isActive){
                        setViewAll(false);
                        await auth.switchCompany(c.companyId);
                      }
                    }} style={{width:"100%",padding:"10px 14px",border:"none",borderBottom:`1px solid ${C.b2}`,background:isActive?C.priPale:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:8,height:8,borderRadius:4,background:isActive?C.pri:C.b2,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:isActive?700:500,color:isActive?C.pri:C.t1}}>{c.companyName}</div>
                        <div style={{fontSize:10,color:C.t3}}>{({plant:"Planta",transporter:"Transportista",producer:"Productor"})[c.companyType]||c.companyType}</div>
                      </div>
                    </button>;
                  })}
                </div>
              </>}
            </div>
          ) : <span style={{ fontSize:11, fontWeight:600, color:C.t2, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{auth.user.entity}</span>)}
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
            <a href={mapFocus.destLat!=null&&mapFocus.destLng!=null?`https://www.google.com/maps/dir/?api=1&origin=${mapFocus.lat},${mapFocus.lng}&destination=${mapFocus.destLat},${mapFocus.destLng}`:`https://www.google.com/maps/search/?api=1&query=${mapFocus.lat},${mapFocus.lng}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,background:C.pri,color:"#fff",fontSize:12,fontWeight:700,textDecoration:"none",fontFamily:"inherit",flexShrink:0}}>Navegar ↗</a>
          </div>
          <div style={{flex:1,minHeight:0}}>
            <Suspense fallback={<SL/>}><MapOverlay lat={mapFocus.lat} lng={mapFocus.lng} label={mapFocus.label} destLat={mapFocus.destLat} destLng={mapFocus.destLng} destLabel={mapFocus.destLabel} freightId={mapFocus.freightId} onClose={()=>setMapFocus(null)}/></Suspense>
          </div>
        </>}

        {/* Location picker fullscreen */}
        {locPicker && <Suspense fallback={<SL/>}><LocPickerFullscreen value={locPicker.value} onChange={locPicker.onChange} defaultCenter={locPicker.defaultCenter} label={locPicker.label} onClose={()=>setLocPicker(null)}/></Suspense>}

        {/* Company switch transition overlay */}
        {auth.companySwitching && <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,backdropFilter:"blur(2px)"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 24px",borderRadius:12,background:C.w,boxShadow:C.shMd}}><div style={{width:18,height:18,border:`3px solid ${C.b2}`,borderTopColor:C.pri,borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/><span style={{fontSize:13,fontWeight:600,color:C.t2}}>Cambiando empresa...</span></div></div>}

        {/* Scrollable content area */}
        <div style={{flex:1,overflow:(screen==="chats"||screen==="calendar")&&isDesktop?"hidden":"auto",display:(mapFocus||locPicker)?"none":"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
        <div key={screen} className="tv-page" style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        <Suspense fallback={<SL/>}>
        {screen==="home" && <HomeScreen user={auth.user} freights={viewFreights} loading={fh.loading} perms={perms} onNav={nav} catalog={catalog} isDesktop={isDesktop} onAction={handleAction} onTripAction={handleTripAction} onEditTrip={handleEditTrip} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap}/>}
        {screen==="list" && <ListScreen freights={viewFreights} loading={fh.loading} onNav={nav} onRefresh={fh.fetchAll} catalog={catalog} view={listView} setView={setListView} goToMap={goToMap} hasMore={fh.hasMore} loadMore={fh.loadMore} loadingMore={fh.loadingMore} total={fh.total} isDesktop={isDesktop} onAction={handleAction}/>}
        {screen==="calendar" && <CalendarScreen freights={viewFreights} perms={perms} onNav={nav} isDesktop={isDesktop} user={auth.user} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap}/>}
        {screen==="detail" && <DetailScreen user={curFreight ? {...auth.user, userType: _resolveType(curFreight)} : auth.user} freight={curFreight} perms={perms} onBack={()=>navigate("/list")} onAction={handleAction} onTripAction={handleTripAction} onEditTrip={handleEditTrip} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap}/>}
        {screen==="new" && <NewScreen user={auth.user} lots={catalog.lots} plants={catalog.plants} branches={catalog.branches} fields={catalog.fields} trucks={catalog.trucks} onBack={()=>{setDuplicateData(null);navigate("/");}} onCreate={handleCreate} submitting={submitting} duplicateFrom={duplicateData}/>}
        {screen==="edit" && editData && <EditScreen freight={editData} fields={catalog.fields} plants={catalog.plants} branches={catalog.branches} trucks={catalog.trucks} user={auth.user} onBack={()=>{setEditData(null);navigate(-1);}} onSave={async(id,data)=>{const r=await fh.update(id,data);if(r.ok) return r.pending?"Cambio enviado a aprobación":"Flete actualizado"; show(r.error,"err"); return "";}}/>}
        {screen==="menu" && <MenuScreen user={auth.user} perms={perms} onLogout={auth.logout} onNav={nav} isDesktop={isDesktop} onSwitchCompany={async(id)=>{setViewAll(false);return await auth.switchCompany(id);}} onRefresh={()=>{fh.fetchAll();catalog.refresh();}}/>}
        {screen==="trucks" && <TrucksScreen user={auth.user} onBack={()=>{catalog.refresh();navigate("/menu");}}/>}
        {screen==="fields" && <FieldsScreen onBack={()=>{catalog.refresh();navigate("/menu");}} goToMap={goToMap}/>}
        {screen==="admin" && <AdminScreen user={auth.user} onBack={()=>navigate("/menu")}/>}
        {screen==="mydata" && <MyDataScreen user={auth.user} onBack={()=>navigate("/menu")} onUserUpdate={auth.patchUser}/>}
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
      {modal?.type==="assign" && <AssignModal freight={modal.freight} transporters={catalog.transporters} user={auth.user} onClose={()=>setModal(null)} onConfirm={(compId,truckId,driverId)=>handleAssign(modal.freight.id,compId,truckId,driverId)} onAssignMulti={handleAssignMulti}/>}
      {modal?.type==="truck_select" && <TruckSelectModal freight={modal.freight} trucks={catalog.trucks} user={auth.user} onClose={()=>setModal(null)} onConfirm={(t,driverId)=>handleAcceptWithTruck(modal.freight.id,t,driverId)}/>}
      {modal?.type==="confirm_action" && <ConfirmActionModal freight={modal.freight} title={modal.title} btnLabel={modal.btnLabel} btnVariant={modal.btnVariant} icon={modal.icon} onClose={()=>setModal(null)} onConfirm={(tons)=>handleConfirmAction(modal.freight.id,modal.action,tons)} showTonsInput={modal.action==="confirm_loaded"} defaultTons={modal.freight.tons}/>}
      {modal?.type==="confirm_trip_action" && <ConfirmActionModal freight={modal.freight} title={modal.title} btnLabel={modal.btnLabel} btnVariant={modal.btnVariant} icon={modal.icon} onClose={()=>setModal(null)} onConfirm={(tons)=>handleTripConfirmAction(modal.freight.id,modal.assignmentId,modal.actionKey,tons)} showTonsInput={modal.actionKey==="confirm_trip_loaded"} defaultTons={modal.freight.tons}/>}
      {modal?.type==="reason" && <ReasonModal title={modal.title} freight={modal.freight} btnLabel={modal.btnLabel} onClose={()=>setModal(null)} onConfirm={r=>handleReasonAction(modal.freight.id,r,modal.action,{assignmentId:modal.assignmentId})}/>}
      {modal?.type==="edit_trip" && <EditTripModal freight={modal.freight} assignment={modal.assignment} transporters={catalog.transporters} onClose={()=>setModal(null)} onSave={handleSaveTrip}/>}
      {modal?.type==="driver_queue" && <DriverQueueModal driverId={modal.driverId} driverName={modal.driverName} onClose={()=>setModal(null)}/>}
      </Suspense>
      {toast && <Toast key={toast._ts||toast.msg} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
