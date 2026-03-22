import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { uploadPhoto, apiAddDocument, apiListConversations, apiSearchFreights } from "../api";
import { C, track, FONT, Ic , R} from "../theme";
import { POLL_INTERVALS, stCfg } from "../constants";
import { Toast, LoadingOverlay, Sidebar, Nav, NotifBell, NotificationsPanel, ErrorBoundary } from "../components";
import { permsFor, mapFreight, originDisplay, destDisplay } from "../hooks";
import { useAccessLevel } from "../hooks/useAccessLevel";
import { RoutesBackground } from "../routes-bg";
import { useUIStore, useFreightDetailStore, offlineQueue } from "../store";
import { resolveUserTypeForFreight, getPendingActions } from "../utils/freight-helpers";
import { useAuthContext } from "../providers/AuthProvider";
import { useSSEContext } from "../providers/SSEProvider";
import {
  SCREEN_TO_PATH, SL, FREIGHT_SCREENS, useScreen,
  HomeScreen, ListScreen, DetailScreen, NewScreen, EditScreen,
  CalendarScreen, MenuScreen, TrucksScreen, TicketsScreen, DocumentsScreen, AnalyticsScreen,
  LocationsScreen, AdminScreen, MyDataScreen, ReportsScreen,
  ChatsScreen, NotificationsScreen, LinkedCompaniesScreen,
  MapOverlay, LocPickerFullscreen,
  ConfirmActionModal, AssignModal, TruckSelectModal, ReasonModal, DriverQueueModal, EditTripModal, WeighTicketConfirmModal,
  AiChat, AiChatFabComp,
} from "../routing/Router";
import log from "../logger";

// ======================== MAIN APP LAYOUT ==============================
export default function AppLayout({ fh, catalog, online, notif, isDesktop }) {
  const auth = useAuthContext();
  const {
    sse, sseMsg, setSseMsg, sseTyping, sseRead,
    unreadChats, setUnreadChats,
    sseAiResponse, sseAiTranscription, sseAiChunk, sseAiThinking,
    catalogRef,
  } = useSSEContext();

  const navigate = useNavigate();
  const location = useLocation();
  const screen = useScreen();
  // Track list search params so DetailScreen can navigate back preserving filters
  const listSearchRef = useRef("");
  useEffect(() => { if (location.pathname === "/list") listSearchRef.current = location.search; }, [location.pathname, location.search]);

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

  // Post-creation modal state
  const [postCreateFreightId, setPostCreateFreightId] = useState(null);
  const [postCreateForm, setPostCreateForm] = useState(null);

  // Mobile header state
  const [compDropOpen, setCompDropOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Global search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const searchPageRef = useRef(1);
  const searchTimerRef = useRef(null);

  // AI Chat state
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // Extract freight ID from URL params
  const [selFreight, setSelFreight] = useState(null);
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith("/freight/")) {
      const id = p.replace("/freight/", "");
      if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { setSelFreight(id); fh.refreshLight(id); }
    }
  }, [location.pathname, fh.refresh]);

  // Server-side company filter handles multi-company. Chofer: client-side driver filter + queue sort
  const viewFreights = useMemo(() => {
    if (!auth.user || !fh.freights) return fh.freights;
    if (auth.user.role === "chofer") {
      return fh.freights.filter(f =>
        f.driverId === auth.user.id ||
        (f.activeAssignments || []).some(a => a.driverId === auth.user.id)
      ).sort((a,b) => (a.queuePosition||0) - (b.queuePosition||0));
    }
    return fh.freights;
  }, [fh.freights, auth.user]);

  // Global search — debounced server-side search
  const searchAbortRef = useRef(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQ || searchQ.length < 2) { setSearchResults([]); setSearchHasMore(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        searchPageRef.current = 1;
        const r = await apiSearchFreights(searchQ, 1);
        if (controller.signal.aborted) return;
        setSearchResults((r.data || []).map(mapFreight));
        setSearchHasMore((r.page || 1) < (r.pages || 1));
      } catch (e) {
        if (e.name === 'AbortError') return;
        setSearchResults([]); setSearchHasMore(false);
      }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchAbortRef.current?.abort(); };
  }, [searchQ]);

  const loadMoreSearch = useCallback(async () => {
    if (searchLoadingMore || !searchHasMore || !searchQ) return;
    setSearchLoadingMore(true);
    try {
      const nextPage = searchPageRef.current + 1;
      const r = await apiSearchFreights(searchQ, nextPage);
      searchPageRef.current = nextPage;
      setSearchResults(prev => [...prev, ...(r.data || []).map(mapFreight)]);
      setSearchHasMore((r.page || 1) < (r.pages || 1));
    } catch { /* ignore */ }
    finally { setSearchLoadingMore(false); }
  }, [searchLoadingMore, searchHasMore, searchQ]);

  // Calculate pending actions count
  const pendingCount = useMemo(() => {
    if (!auth.user || !viewFreights) return 0;
    return viewFreights.filter(f => getPendingActions(f, auth.user.userType, auth.user.role, auth.user) !== null).length;
  }, [viewFreights, auth.user]);

  // Refs for polling callbacks
  const fhRef = useRef(fh);
  fhRef.current = fh;
  const notifRef = useRef(notif);
  notifRef.current = notif;

  // Smart polling — only freight screens poll freights
  const lastFetchRef = useRef(0);
  useEffect(()=>{
    if(!auth.user) return;
    const now = Date.now();
    const STALE_MS = sse.connected ? 30000 : 5000;
    if (FREIGHT_SCREENS.has(screen) && navigator.onLine && now - lastFetchRef.current > STALE_MS) {
      lastFetchRef.current = now;
      fhRef.current.fetchAll();
    }
    const poll = () => {
      if (document.hidden || !navigator.onLine) return;
      if (!sse.connected && FREIGHT_SCREENS.has(screen) && Date.now() - lastFetchRef.current > 5000) { lastFetchRef.current = Date.now(); fhRef.current.fetchAll(); }
      if (!sse.connected) notifRef.current.refresh();
    };
    const interval = sse.connected ? POLL_INTERVALS.FREIGHTS : 30000;
    const iv = setInterval(poll, interval);
    return ()=>clearInterval(iv);
  },[auth.user, screen, sse.connected]);

  // Poll for unread chats
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
    const initialDelay = setTimeout(checkUnread, 5000);
    const iv = setInterval(checkUnread, POLL_INTERVALS.UNREAD_CHATS);
    return ()=>{ clearTimeout(initialDelay); clearInterval(iv); };
  },[auth.user, sse.connected]);

  // Visibility refresh
  useEffect(()=>{
    if(!auth.user) return;
    let lastVisible = 0;
    const onVisible = () => {
      if (document.hidden || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastVisible < 2000) return;
      lastVisible = now;
      if (now - lastFetchRef.current > (sse.connected ? 30000 : 2000)) {
        lastFetchRef.current = now;
        fhRef.current.fetchAll();
      }
      notifRef.current.refresh();
      catalogRef.current.refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  },[auth.user, sse.connected]);

  // Fallback timeout for submitDone overlay — skip auto-nav when post-creation modal is active
  useEffect(() => {
    if (!submitDone) return;
    if (postCreateFreightId) {
      // Clear the overlay text quickly but don't navigate — post-creation modal takes over
      const t = setTimeout(() => setSubmitDone(""), 1500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setSubmitDone(""); navigate("/list"); }, 5000);
    return () => clearTimeout(t);
  }, [submitDone, navigate, setSubmitDone, postCreateFreightId]);

  // Replay offline queue when back online
  const replayingRef = useRef(false);
  useEffect(() => {
    if (!online || !auth.user || replayingRef.current) return;
    replayingRef.current = true;
    let cancelled = false;
    (async () => {
      const items = await offlineQueue.getAll();
      for (const item of items) {
        if (cancelled) break;
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
    })().finally(() => { replayingRef.current = false; });
    return () => { cancelled = true; };
  }, [online, auth.user]);

  const { isConsulta: _isConsulta } = useAccessLevel(auth.user);
  const perms = useMemo(()=>{
    const p = permsFor(auth.user);
    // CONSULTA users: override write permissions to false (but producers can still create freights)
    if (_isConsulta) {
      const userType = auth.user?.userType;
      return { ...p, canRequest: userType === "producer" || userType === "plant", canApprove:false, canAssign:false, canAssignDriver:false, canCancel:false, canReject:false };
    }
    return p;
  },[auth.user, _isConsulta]);
  const _resolveType = useCallback((f) => resolveUserTypeForFreight(f, auth.user), [auth.user]);
  const _activeComp = useMemo(() => { const c = (auth.user?.companies||[]).find(x => x.companyId === (auth.user?.activeCompanyId||auth.user?.companyId)); return c || null; }, [auth.user]);

  // Close modals on company switch
  useEffect(() => { setModal(null); }, [auth.user?.activeCompanyId]);

  // ======================== NAVIGATION =================================
  const nav = useCallback((s, fId) => {
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
    setSelFreight(null);
    setModal(null);
    if (s === "home") { navigate("/"); return; }
    const path = SCREEN_TO_PATH[s] || "/";
    navigate(path);
  }, [perms.canRequest, navigate, show, setDuplicateData, fh.refresh]);

  const handleNotifTap = useCallback((freightId) => { setSelFreight(freightId); fh.refresh(freightId); navigate(`/freight/${freightId}`); }, [navigate, fh.refresh]);

  // ======================== ACTION HANDLERS ============================
  const handleAction = useCallback((fId,action)=>{
    if(actionLoading) return;
    if(!fh.freights) return;
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    if(action==="assign") { setModal({type:"assign",freight:f}); }
    else if(action==="cancel") { setModal({type:"reason",freight:f,title:"Cancelar flete",btnLabel:"Cancelar flete",action:"cancel"}); }
    else if(action==="reject") { setModal({type:"reason",freight:f,title:"Rechazar asignación",btnLabel:"Rechazar",action:"reject"}); }
    else if(action==="assign_truck") {
      const pendingAssignment = (f.activeAssignments||[]).find(a => !a.truckId && a.transportCompanyId === auth.user?.companyId);
      if(pendingAssignment) setModal({type:"edit_trip",freight:f,assignment:pendingAssignment});
      else show("No hay viajes pendientes de camión","warn");
    }
    else if(action==="start") { setModal({type:"confirm_action",freight:f,title:"Iniciar viaje",btnLabel:"Iniciar viaje",btnVariant:"acc",icon:Ic.truck(C.acc,24),action:"start"}); }
    else if(action==="authorize") { setModal({type:"confirm_action",freight:f,title:"Autorizar viaje",btnLabel:"Autorizar",icon:Ic.chk(C.pri,24),action:"authorize"}); }
    else if(action==="approve_producer") { setModal({type:"confirm_action",freight:f,title:"Aceptar flete de productor",btnLabel:"Aceptar",icon:Ic.chk(C.pri,24),action:"approve_producer"}); }
    else if(action==="reject_own_fleet") { setModal({type:"reason",freight:f,title:"Rechazar flota propia",btnLabel:"Rechazar",action:"cancel"}); }
    else if(action==="confirm_loaded") { setModal({type:"wt_confirm",freight:f,title:"Confirmar carga",btnLabel:"Confirmar carga",btnVariant:"acc",icon:Ic.chk(C.acc,24),action:"confirm_loaded"}); }
    else if(action==="confirm_finished") { setModal({type:"wt_confirm",freight:f,title:"Confirmar entrega",btnLabel:"Confirmar entrega",icon:Ic.chk(C.pri,24),action:"confirm_finished"}); }
    else if(action==="driver_queue") { setModal({type:"driver_queue",driverId:f.driverId,driverName:f.driverName}); }
  }, [actionLoading, fh.freights, setModal]);

  // actionLoading stays true until modal closes (500ms animation) to prevent button flicker
  const clearActionAfterClose = ()=> setTimeout(()=>setActionLoading(false), 600);

  const handleAcceptWithTruck = async (fId, truckId, driverId)=>{
    setActionLoading(true);
    try {
      const r = await fh.respond(fId, "accepted", undefined, truckId, driverId);
      if(r.ok){ track("freight_accept"); clearActionAfterClose(); return "Flete aceptado"; }
      show(r.error,"err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
  };

  const handleAssign = async (fId, transportCompanyId, truckId, driverId)=>{
    setActionLoading(true);
    try {
      const r = await fh.assign(fId, transportCompanyId, truckId, driverId);
      if(r.ok){ track("freight_assign"); clearActionAfterClose(); return "Transportista asignado"; }
      show(r.error,"err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
  };

  const handleAssignMulti = async (trucks)=>{
    if(!modal?.freight) return "";
    setActionLoading(true);
    try {
      const r = await fh.assignMulti(modal.freight.id, trucks);
      if(r.ok){ track("freight_assign_multi"); clearActionAfterClose(); return `${trucks.length} camiones asignados`; }
      show(r.error,"err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
  };

  const handleTripAction = useCallback((fId, aId, actionKey)=>{
    if(actionLoading) return;
    if(!fh.freights) return;
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    const isPlant = auth.user?.userType === "plant" || (auth.user?.userTypes||[]).includes("plant");
    const cfgs = {
      start_trip: { title:"Iniciar viaje", btnLabel:"Iniciar viaje", icon:Ic.truck(C.acc,24), btnVariant:"acc" },
      confirm_trip_loaded: { title:"Confirmar carga", btnLabel:"Confirmar carga", icon:Ic.chk(C.acc,24), btnVariant:"acc" },
      confirm_trip_finished: { title:"Confirmar entrega", btnLabel:"Confirmar entrega", icon:Ic.chk(C.pri,24), btnVariant:"pri" },
    };
    if(actionKey==="respond_trip_reject" || actionKey==="reject_trip") {
      setModal({type:"reason",freight:f,title:"Devolver asignación",btnLabel:"Devolver",action:"reject_trip",assignmentId:aId});
      return;
    }
    if(actionKey==="edit_trip") {
      const assignment = (f.activeAssignments||[]).find(a=>a.id===aId);
      if(assignment) setModal({type:"edit_trip",freight:f,assignment});
      else show("Asignación no encontrada","warn");
      return;
    }
    const cfg = cfgs[actionKey];
    if(!cfg) return;
    setModal({type:"confirm_trip_action",freight:f,...cfg,actionKey,assignmentId:aId});
  }, [actionLoading, fh.freights, auth.user, setModal]);

  const handleAcceptTripWithTruck = async (fId, aId, truckId, driverId)=>{
    setActionLoading(true);
    try {
      const r = await fh.respondTrip(fId, aId, {action:"accepted", truckId, driverId});
      if(r.ok){ track("trip_accept"); clearActionAfterClose(); return "Viaje aceptado"; }
      show(r.error,"err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
  };

  const handleTripConfirmAction = async (fId, aId, actionKey, loadedTons)=>{
    setActionLoading(true);
    try {
      const msgs = { start_trip:"Viaje iniciado", confirm_trip_loaded:"Carga confirmada", confirm_trip_finished:"Entrega confirmada" };
      let r;
      if(actionKey==="start_trip") r = await fh.startTrip(fId, aId);
      else if(actionKey==="confirm_trip_loaded") r = await fh.confirmTripLoaded(fId, aId, loadedTons);
      else if(actionKey==="confirm_trip_finished") r = await fh.confirmTripFinished(fId, aId);
      if(r?.ok){ clearActionAfterClose(); return msgs[actionKey]||"Hecho"; }
      show(r?.error||"Error","err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
  };

  const handleEditTrip = useCallback((fId, assignment)=>{
    if(!fh.freights) return;
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    setModal({type:"edit_trip",freight:f,assignment});
  }, [fh.freights, setModal]);

  const handleSaveTrip = async (data)=>{
    if(!modal?.freight || !modal?.assignment) return "";
    const r = await fh.updateAssignment(modal.freight.id, modal.assignment.id, data);
    if(r.ok) return "Viaje actualizado";
    show(r.error,"err"); return "";
  };

  const handleConfirmAction = async (fId, action, loadedTons)=>{
    setActionLoading(true);
    try {
      const msgs = { start:"Viaje iniciado", authorize:"Viaje autorizado", approve_producer:"Flete aceptado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada" };
      const fn = { start:fh.start, authorize:fh.authorize, approve_producer:fh.approveProducer, confirm_loaded:fh.confirmLoaded, confirm_finished:fh.confirmFinished }[action];
      if(!fn){ setActionLoading(false); return ""; }
      const r = action==="confirm_loaded" ? await fn(fId, loadedTons) : await fn(fId);
      if(r.ok){ clearActionAfterClose(); return msgs[action]||"Hecho"; }
      show(r.error,"err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
  };

  const handleReasonAction = async (fId,reason,action,extra)=>{
    setActionLoading(true);
    try {
      let r;
      if(action==="cancel") r = await fh.cancel(fId,reason);
      else if(action==="reject") r = await fh.respond(fId,"rejected",reason);
      else if(action==="reject_trip" && extra?.assignmentId) { r = await fh.respondTrip(fId, extra.assignmentId, {action:"rejected",reason}); }
      const msg = action==="cancel"?"Flete cancelado":action==="reject_trip"?"Viaje rechazado":"Asignación rechazada";
      if(r?.ok){ clearActionAfterClose(); return msg; }
      show(r?.error||"Error","err"); setActionLoading(false); return "";
    } catch(e) { show(e?.message||"Error de conexión","err"); setActionLoading(false); return ""; }
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
        URL.revokeObjectURL(photoUrl);
        const file = new File([blob], `foto-${Date.now()}-${i}.jpg`, {type:'image/jpeg'});
        const url = await uploadPhoto(file, r.freightId, 'request');
        await apiAddDocument(r.freightId, { name: file.name, url, type:'photo', step:'request' });
      }));
      photoFailCount = results.filter(res => res.status === 'rejected').length;
      results.filter(res => res.status === 'rejected').forEach(res => log.error('FREIGHT', 'Photo upload failed:', res.reason));
    }
    // After creating, assign transport if assignData was included
    let assignError = null;
    if (r.ok && r.freightId && form.assignData) {
      const ad = form.assignData;
      const ar = await fh.assign(r.freightId, ad.transportCompanyId, ad.truckId, ad.driverId);
      if (!ar.ok) assignError = ar.error;
    }
    setSubmitting(false);
    if(r.ok){
      track("freight_create");
      if (assignError) show(`Flete creado, pero no se pudo asignar transporte: ${assignError}`, "warn");
      else if(photoFailCount > 0) show(`Flete solicitado, pero ${photoFailCount} foto(s) no se pudieron adjuntar`,"warn");
      // Show post-creation modal with options
      setPostCreateFreightId(r.freightId);
      setPostCreateForm(form);
      if (!assignError && photoFailCount === 0) setSubmitDone("Flete solicitado");
    } else show(r.error,"err");
  };

  // O(1) freight lookup
  const freightMap = useMemo(() => { const m = new Map(); fh.freights.forEach(f => m.set(f.id, f)); return m; }, [fh.freights]);
  const curFreight = freightMap.get(selFreight) || null;
  const navActive = ["detail"].includes(screen)?"list":["trucks","tickets","documents","analytics","admin","mydata","calendar","reports","chats"].includes(screen)?"menu":["linked","notifs"].includes(screen)&&!isDesktop?"menu":screen;

  // ======================== RENDER =====================================
  return (
    <div className="tv-shell" style={{height:"100dvh",background:C.bg,color:C.t1,fontFamily:FONT,display:"flex",flexDirection:isDesktop?"row":"column",width:"100%",position:"relative",overflow:"hidden"}}>
      <a href="#main-content" style={{position:'absolute',left:'-9999px',top:'auto',width:'1px',height:'1px',overflow:'hidden',zIndex:9999}} onFocus={e=>{e.currentTarget.style.cssText='position:fixed;top:0;left:0;padding:8px 16px;background:#003882;color:#fff;z-index:9999;font-size:14px';}} onBlur={e=>{e.currentTarget.style.cssText='position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden';}}>Ir al contenido principal</a>
      <style>{`body{background:${C.bg}}input::placeholder,textarea::placeholder{color:${C.t3}}::-webkit-scrollbar-thumb{background:${C.b1}}@media(hover:hover){.tv-card:hover{box-shadow:${C.shMd}!important}.tv-row:hover{background:${C.priGhost}!important}}`}</style>

      <RoutesBackground trucks={false} opacityMul={0.4} centerFade={false} />

      {/* Desktop Sidebar */}
      <aside className="tv-sidebar" aria-label="Navegación principal" style={{position:"relative",zIndex:1}}>
        <Sidebar active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={notif.unreadCount} canRequest={perms.canRequest} onNew={()=>nav("new")} activeCompany={auth.user ? { id: auth.user.activeCompanyId||auth.user.companyId, name: _activeComp?.companyName||auth.user.entity, type: _activeComp?.companyType||auth.user.userType } : null} companies={auth.user?.companies||[]} onSwitchCompany={async(id)=>{await auth.switchCompany(id);}} simpleMode={auth.simpleMode} onToggleSimple={auth.toggleSimpleMode} searchQuery={searchQ} onSearchChange={setSearchQ} searchResults={searchResults} onSearchSelect={(id)=>{setSelFreight(id);fh.refresh(id);navigate(`/freight/${id}`);}} searchHasMore={searchHasMore} searchLoadingMore={searchLoadingMore} onSearchLoadMore={loadMoreSearch} user={auth.user} />
      </aside>

      {/* Main content column */}
      <main id="main-content" style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, position:"relative", zIndex:1 }}>
        {/* Mobile-only header */}
        <div className="tv-mobile-header" style={{paddingTop:"max(12px, env(safe-area-inset-top))",paddingBottom:10,paddingLeft:18,paddingRight:18,borderBottom:`1px solid ${C.b2}`,background:C.w,flexShrink:0,zIndex:10,position:"relative",display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"inline-flex",alignItems:"flex-start",flexShrink:0}}>
            <span style={{fontSize:33,fontWeight:800,color:C.pri,letterSpacing:-0.9,lineHeight:1}}>tolvink</span>
            <span style={{width:8,height:8,borderRadius: R.xs,background:C.acc,display:"inline-block",marginLeft:3,marginTop:1,animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
          </div>
          <div style={{flex:1}}/>
          {auth.user && <div style={{position:"relative"}}>
            <button aria-label="Configuración" onClick={()=>setCompDropOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,cursor:"pointer",fontFamily:"inherit",maxWidth:180,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
              <span style={{fontSize:12.1,fontWeight:600,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{auth.user.entity}</span>
              <span style={{fontSize:10,fontWeight:600,color:C.t3,background:C.bg,padding:"1px 6px",borderRadius: R.xs,flexShrink:0,whiteSpace:"nowrap"}}>{auth.simpleMode?"Simple":"Completo"}</span>
              {Ic.down(C.t3,10)}
            </button>
            {compDropOpen && <>
              <div onClick={()=>setCompDropOpen(false)} style={{position:"fixed",inset:0,zIndex:99}}/>
              <div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.lg,boxShadow:C.shMd,zIndex:100,minWidth:200,overflow:"hidden"}}>
                {auth.user.companies?.length > 1 && <>
                  <div style={{padding:"8px 14px 4px",fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.5}}>Empresa</div>
                  {auth.user.companies.map(c=>{
                    const isActive = c.companyId === auth.user.activeCompanyId;
                    return <button key={c.companyId} onClick={async()=>{
                      if(!isActive) await auth.switchCompany(c.companyId);
                      setCompDropOpen(false);
                    }} style={{width:"100%",padding:"8px 14px",border:"none",background:isActive?C.priPale:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:7,height:7,borderRadius: R.xs,background:isActive?C.pri:C.b2,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:13.2,fontWeight:isActive?700:500,color:isActive?C.pri:C.t1}}>{c.companyName}</div>
                        <div style={{fontSize:10,color:C.t3}}>{({plant:"Planta",transporter:"Transportista",producer:"Productor"})[c.companyType]||c.companyType}</div>
                      </div>
                    </button>;
                  })}
                  <div style={{borderTop:`1px solid ${C.b2}`,margin:"4px 0"}}/>
                </>}
                <div style={{padding:"8px 14px 4px",fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.5}}>Vista</div>
                {[{k:false,l:"Completo"},{k:true,l:"Simple"}].map(o=>{
                  const isActive = auth.simpleMode === o.k;
                  return <button key={String(o.k)} onClick={()=>{if(!isActive) auth.toggleSimpleMode(); setCompDropOpen(false);}} style={{width:"100%",padding:"8px 14px",border:"none",background:isActive?C.priPale:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:7,height:7,borderRadius: R.xs,background:isActive?C.pri:C.b2,flexShrink:0}}/>
                    <span style={{fontSize:13.2,fontWeight:isActive?700:500,color:isActive?C.pri:C.t1}}>{o.l}</span>
                  </button>;
                })}
              </div>
            </>}
          </div>}
          {auth.user && <button aria-label="Buscar" onClick={()=>{setMobileSearchOpen(v=>!v);if(mobileSearchOpen){setSearchQ("");}}} style={{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:34,borderRadius: R.md,border:`1px solid ${mobileSearchOpen?C.pri:C.b1}`,background:mobileSearchOpen?C.priPale:C.w,cursor:"pointer",flexShrink:0,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>{Ic.srch(mobileSearchOpen?C.pri:C.t3,16)}</button>}
          <div style={{position:"relative",flexShrink:0}}>
            <NotifBell count={notif.unreadCount} onClick={()=>setNotifOpen(!notifOpen)} />
            <NotificationsPanel open={notifOpen} onClose={()=>setNotifOpen(false)} notifications={notif.notifications} onMarkRead={notif.markRead} onMarkAllRead={notif.markAllRead} onTap={handleNotifTap} />
          </div>
        </div>
        {/* Mobile search bar */}
        {mobileSearchOpen && <div style={{padding:"0 18px 10px",background:C.w,borderBottom:`1px solid ${C.b2}`,position:"relative",zIndex:10}} className="tv-mobile-header">
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius: R.md,background:C.bg,border:`1.5px solid ${searchQ?C.bFocus:C.b2}`,transition:"border-color 0.15s"}}>
            <span style={{display:"flex",flexShrink:0}}>{Ic.srch(C.t3,14)}</span>
            <input autoFocus aria-label="Buscar fletes" value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar flete..." style={{flex:1,border:"none",background:"transparent",outline:"none",fontSize:14,color:C.t1,fontFamily:"inherit",padding:0}}/>
            {searchQ && <button onClick={()=>setSearchQ("")} style={{display:"flex",border:"none",background:"none",cursor:"pointer",padding:0}}>{Ic.cross(C.t3,14)}</button>}
          </div>
          {searchQ.length >= 2 && searchResults.length > 0 && <div onScroll={e=>{const el=e.currentTarget;if(searchHasMore&&!searchLoadingMore&&el.scrollTop+el.clientHeight>=el.scrollHeight-20)loadMoreSearch();}} style={{position:"absolute",left:18,right:18,top:"100%",marginTop:2,background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.lg,boxShadow:C.shMd,zIndex:200,maxHeight:320,overflowY:"auto",padding:4}}>
            {searchResults.map(f=>{const st=stCfg(f.status);return <button key={f.id} aria-label={`Ver flete ${f.code || ''} ${f.grain || ''}`} onClick={()=>{setSelFreight(f.id);fh.refresh(f.id);navigate(`/freight/${f.id}`);setSearchQ("");setMobileSearchOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",background:"transparent",border:"none",borderRadius: R.md,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}} onTouchStart={e=>e.currentTarget.style.background=C.priGhost} onTouchEnd={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:4,height:32,borderRadius: R.xs,background:st.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                <div style={{fontSize:12,color:C.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.code} · {originDisplay(f)||"—"} → {destDisplay(f)||"—"}</div>
              </div>
            </button>})}
            {searchLoadingMore && <div style={{padding:"8px",textAlign:"center"}}><div style={{width:16,height:16,border:`2px solid ${C.b2}`,borderTopColor:C.pri,borderRadius:"50%",animation:"spin 0.6s linear infinite",margin:"0 auto"}}/></div>}
          </div>}
          {searchQ.length >= 2 && searchResults.length === 0 && <div style={{position:"absolute",left:18,right:18,top:"100%",marginTop:2,background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.lg,boxShadow:C.shMd,zIndex:200,padding:"14px 16px",fontSize:13.2,color:C.t3}}>Sin resultados</div>}
        </div>}

        {/* Offline banner */}
        {!online && <div style={{background:"#f59e0b",color:"#fff",textAlign:"center",padding:"6px 12px",fontSize:14.3,fontWeight:600,flexShrink:0,zIndex:10}}>{Ic.warn("#fff",14)} Sin conexión — mostrando datos guardados</div>}

        {/* Map bar + fullscreen map */}
        {mapFocus && <>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px",background:C.w,borderBottom:`1px solid ${C.b2}`,flexShrink:0,zIndex:10}}>
            <button onClick={()=>setMapFocus(null)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius: R.md,border:`1.5px solid ${C.b1}`,background:C.bg,cursor:"pointer",fontSize:14.3,fontWeight:700,color:C.pri,fontFamily:"inherit"}}>{Ic.chev(C.pri,14)} Cerrar mapa</button>
            <span style={{flex:1,fontSize:13.2,color:C.t2,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mapFocus.label||"Ubicación"}</span>
            <a href={mapFocus.destLat!=null&&mapFocus.destLng!=null?`https://www.google.com/maps/dir/?api=1&origin=${mapFocus.lat},${mapFocus.lng}&destination=${mapFocus.destLat},${mapFocus.destLng}`:`https://www.google.com/maps/search/?api=1&query=${mapFocus.lat},${mapFocus.lng}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius: R.md,background:C.pri,color:"#fff",fontSize:13.2,fontWeight:700,textDecoration:"none",fontFamily:"inherit",flexShrink:0}}>Navegar ↗</a>
          </div>
          <div style={{flex:1,minHeight:0}}>
            <Suspense fallback={<SL/>}><MapOverlay lat={mapFocus.lat} lng={mapFocus.lng} label={mapFocus.label} destLat={mapFocus.destLat} destLng={mapFocus.destLng} destLabel={mapFocus.destLabel} freightId={mapFocus.freightId} onClose={()=>setMapFocus(null)}/></Suspense>
          </div>
        </>}

        {/* Location picker fullscreen */}
        {locPicker && <Suspense fallback={<SL/>}><LocPickerFullscreen value={locPicker.value} onChange={locPicker.onChange} defaultCenter={locPicker.defaultCenter} label={locPicker.label} confirmLabel={locPicker.confirmLabel} onConfirm={locPicker.onConfirm} onClose={()=>setLocPicker(null)}/></Suspense>}

        {/* Company switch transition overlay */}
        {auth.companySwitching && <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,backdropFilter:"blur(2px)"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 24px",borderRadius: R.lg,background:C.w,boxShadow:C.shMd}}><div style={{width:18,height:18,border:`3px solid ${C.b2}`,borderTopColor:C.pri,borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/><span style={{fontSize:14.3,fontWeight:600,color:C.t2}}>Cambiando empresa...</span></div></div>}

        {/* Scrollable content area */}
        <div style={{flex:1,overflow:(screen==="chats"||screen==="calendar")&&isDesktop?"hidden":"auto",display:(mapFocus||locPicker)?"none":"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
        <div key={screen} className="tv-page" style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
        <ErrorBoundary><Suspense fallback={<SL/>}>
        {screen==="home" && <HomeScreen user={auth.user} freights={viewFreights} loading={fh.loading} error={fh.error} perms={perms} onNav={nav} catalog={catalog} isDesktop={isDesktop} onAction={handleAction} onTripAction={handleTripAction} onEditTrip={handleEditTrip} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onRetry={fh.fetchAll} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap} simpleMode={auth.simpleMode} statusCounts={fh.statusCounts}/>}
        {screen==="list" && <ListScreen freights={viewFreights} loading={fh.loading} onNav={nav} onRefresh={fh.fetchAll} catalog={catalog} view={listView} setView={setListView} goToMap={goToMap} hasMore={fh.hasMore} loadMore={fh.loadMore} loadingMore={fh.loadingMore} total={fh.total} isDesktop={isDesktop} onAction={handleAction} user={auth.user} simpleMode={auth.simpleMode} statusCounts={fh.statusCounts}/>}
        {screen==="calendar" && <CalendarScreen freights={viewFreights} perms={perms} onNav={nav} isDesktop={isDesktop} user={auth.user} onAction={handleAction} onTripAction={handleTripAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap}/>}
        {screen==="detail" && <DetailScreen user={curFreight ? {...auth.user, userType: _resolveType(curFreight)} : auth.user} freight={curFreight} perms={perms} onBack={()=>navigate("/list" + listSearchRef.current)} onAction={handleAction} onTripAction={handleTripAction} onEditTrip={handleEditTrip} onCancelAssignment={fh.cancelAssignment} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);navigate("/chats");}}} onRefresh={(id)=>{ useFreightDetailStore.getState().invalidate(id); fh.refresh(id); }} onDuplicate={(f)=>{setDuplicateData(f);navigate("/new");}} onEdit={(f)=>{setEditData(f);navigate("/edit/"+f.id);}} goToMap={goToMap} sseConnected={sse.connected}/>}
        {screen==="new" && <NewScreen user={auth.user} lots={catalog.lots} plants={catalog.plants} branches={catalog.branches} fields={catalog.fields} trucks={catalog.trucks} freights={fh.freights} onBack={()=>{setDuplicateData(null);navigate("/");}} onCreate={handleCreate} submitting={submitting} duplicateFrom={duplicateData}/>}
        {screen==="edit" && editData && <EditScreen freight={editData} fields={catalog.fields} plants={catalog.plants} branches={catalog.branches} trucks={catalog.trucks} user={auth.user} onBack={()=>{setEditData(null);navigate(-1);}} onSave={async(id,data)=>{try{const r=await fh.update(id,data);if(r.ok) return r.pending?"Cambio enviado a aprobación":"Flete actualizado"; show(r.error,"err"); return "";}catch(e){show(e?.message||"Error de conexión","err");return "";}}}/>}
        {screen==="menu" && <MenuScreen user={auth.user} perms={perms} onLogout={auth.logout} onNav={nav} isDesktop={isDesktop} onSwitchCompany={async(id)=>{return await auth.switchCompany(id);}} onRefresh={()=>{fh.fetchAll();catalog.refresh();}} simpleMode={auth.simpleMode} onToggleSimple={auth.toggleSimpleMode}/>}
        {screen==="trucks" && <TrucksScreen user={auth.user} onBack={()=>{catalog.refresh();navigate("/menu");}}/>}
        {screen==="tickets" && <TicketsScreen user={auth.user} onBack={()=>navigate("/menu")}/>}
        {screen==="documents" && <DocumentsScreen user={auth.user} onBack={()=>navigate("/menu")} onNavigate={(fId)=>{setSelFreight(fId);fh.refresh(fId);navigate(`/freight/${fId}`);}}/>}
        {screen==="analytics" && <AnalyticsScreen user={auth.user} onBack={()=>navigate("/menu")}/>}
        {screen==="locations" && <LocationsScreen user={auth.user} onBack={()=>{catalog.refresh();navigate("/menu");}}/>}
        {screen==="admin" && (auth.user?.role==="admin"||auth.user?.role==="platform_admin") && <AdminScreen user={auth.user} onBack={()=>navigate("/menu")}/>}
        {screen==="linked" && <LinkedCompaniesScreen user={auth.user} onBack={()=>navigate(isDesktop?"/linked":"/menu")} onNav={nav}/>}
        {screen==="mydata" && <MyDataScreen user={auth.user} onBack={()=>navigate("/menu")} onUserUpdate={auth.patchUser}/>}
        {screen==="reports" && <ReportsScreen onBack={()=>navigate(isDesktop?"/reports":"/menu")} freights={viewFreights} isDesktop={isDesktop}/>}
        {screen==="chats" && <ChatsScreen user={auth.user} openConvId={chatConvId} onConvOpened={()=>setChatConvId(null)} isDesktop={isDesktop} sseMsg={sseMsg} onSseMsgHandled={()=>setSseMsg(null)} sseTyping={sseTyping} sseRead={sseRead} sseConnected={sse.connected}/>}
        {screen==="notifs" && <NotificationsScreen notifications={notif.notifications} freights={viewFreights} loading={notif.loading} onMarkRead={notif.markRead} onMarkAllRead={notif.markAllRead} onTap={handleNotifTap} />}
        </Suspense></ErrorBoundary>
        </div>
        </div>

        {/* Mobile-only bottom nav */}
        <div className="tv-mobile-nav">
          <Nav active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={0} canRequest={perms.canRequest} onNew={()=>nav("new")} simpleMode={auth.simpleMode}/>
        </div>
      </main>

      {(submitting||submitDone) && !postCreateFreightId && <LoadingOverlay closing={!!submitDone} closingText={submitDone} onClose={()=>{setSubmitDone("");navigate("/list");}}/>}
      {submitting && postCreateFreightId && <LoadingOverlay />}
      {/* Post-creation modal */}
      {!submitting && postCreateFreightId && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.5)", fontFamily:FONT }}>
          <div style={{ background:C.w, borderRadius: R.xl, padding:28, maxWidth:380, width:"90%", boxShadow:C.shLg, textAlign:"center" }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:C.okPale, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>{Ic.chk(C.ok,24)}</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.t1, marginBottom:4 }}>Flete solicitado</div>
            <div style={{ fontSize:13, color:C.t3, marginBottom:24 }}>El flete fue creado correctamente</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button onClick={()=>{
                const prev = postCreateForm;
                setPostCreateFreightId(null); setPostCreateForm(null); setSubmitDone("");
                setDuplicateData(prev ? { ...prev, fieldId:undefined, lotId:undefined, tons:undefined, truckCount:undefined } : null);
                navigate("/new");
              }} style={{ padding:"12px 16px", borderRadius: R.md, border:"none", background:C.pri, color:C.w, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Crear otro similar
              </button>
              <button onClick={()=>{
                const fId = postCreateFreightId;
                setPostCreateFreightId(null); setPostCreateForm(null); setSubmitDone("");
                navigate("/freight/" + fId);
              }} style={{ padding:"12px 16px", borderRadius: R.md, border:`1.5px solid ${C.pri}`, background:C.w, color:C.pri, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Ver flete creado
              </button>
              <button onClick={()=>{
                setPostCreateFreightId(null); setPostCreateForm(null); setSubmitDone("");
                navigate("/list");
              }} style={{ padding:"8px 16px", borderRadius: R.md, border:"none", background:"transparent", color:C.t3, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Ir a la lista
              </button>
            </div>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
      {modal?.type==="assign" && <AssignModal freight={modal.freight} transporters={catalog.transporters} user={auth.user} onClose={()=>setModal(null)} onConfirm={(compId,truckId,driverId)=>handleAssign(modal.freight.id,compId,truckId,driverId)} onAssignMulti={handleAssignMulti} onRefresh={fh.refresh}/>}
      {modal?.type==="truck_select" && <TruckSelectModal freight={modal.freight} trucks={catalog.trucks} user={auth.user} onClose={()=>setModal(null)} onConfirm={(t,driverId)=>handleAcceptWithTruck(modal.freight.id,t,driverId)}/>}
      {modal?.type==="truck_select_trip" && <TruckSelectModal freight={modal.freight} trucks={catalog.trucks} user={auth.user} onClose={()=>setModal(null)} onConfirm={(t,driverId)=>handleAcceptTripWithTruck(modal.freight.id,modal.assignmentId,t,driverId)}/>}
      {modal?.type==="confirm_action" && <ConfirmActionModal freight={modal.freight} title={modal.title} btnLabel={modal.btnLabel} btnVariant={modal.btnVariant} icon={modal.icon} onClose={()=>setModal(null)} onConfirm={(tons)=>handleConfirmAction(modal.freight.id,modal.action,tons)} showTonsInput={modal.action==="confirm_loaded"} defaultTons={modal.freight.tons}/>}
      {modal?.type==="wt_confirm" && <WeighTicketConfirmModal freight={modal.freight} action={modal.action} title={modal.title} btnLabel={modal.btnLabel} btnVariant={modal.btnVariant} icon={modal.icon} onClose={()=>setModal(null)} onConfirm={(tons)=>handleConfirmAction(modal.freight.id,modal.action,tons)} showTonsInput={modal.action==="confirm_loaded"} defaultTons={modal.freight.tons}/>}
      {modal?.type==="confirm_trip_action" && <ConfirmActionModal freight={modal.freight} title={modal.title} btnLabel={modal.btnLabel} btnVariant={modal.btnVariant} icon={modal.icon} onClose={()=>setModal(null)} onConfirm={(tons)=>handleTripConfirmAction(modal.freight.id,modal.assignmentId,modal.actionKey,tons)} showTonsInput={modal.actionKey==="confirm_trip_loaded"} defaultTons={modal.freight.tons}/>}
      {modal?.type==="reason" && <ReasonModal title={modal.title} freight={modal.freight} btnLabel={modal.btnLabel} onClose={()=>setModal(null)} onConfirm={r=>handleReasonAction(modal.freight.id,r,modal.action,{assignmentId:modal.assignmentId})}/>}
      {modal?.type==="edit_trip" && <EditTripModal freight={modal.freight} assignment={modal.assignment} transporters={catalog.transporters} onClose={()=>setModal(null)} onSave={handleSaveTrip}/>}
      {modal?.type==="driver_queue" && <DriverQueueModal driverId={modal.driverId} driverName={modal.driverName} onClose={()=>setModal(null)}/>}
      </Suspense>
      {toast && <Toast key={toast._ts||toast.msg} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

      {/* AI Chat */}
      <Suspense fallback={null}>
        {screen !== "new" && <AiChatFabComp open={aiChatOpen} onClick={() => setAiChatOpen(p => !p)} />}
        <AiChat open={aiChatOpen} onClose={() => setAiChatOpen(false)} onNavigate={(nav) => {
          const path = nav.screen === 'detail' && nav.freightId
            ? `/freight/${nav.freightId}`
            : SCREEN_TO_PATH[nav.screen] || '/';
          navigate(path);
        }} sseAiResponse={sseAiResponse} sseAiTranscription={sseAiTranscription} sseAiChunk={sseAiChunk} sseAiThinking={sseAiThinking} />
      </Suspense>
    </div>
  );
}
