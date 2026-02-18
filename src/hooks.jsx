import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiLogin, apiRegister, apiLogout, apiSwitchCompany, getToken, getSavedUser, clearAuth, setAuthFailHandler,
  apiListFreights, apiGetFreight, apiCreateFreight, apiAssignFreight, apiRespondFreight,
  apiStartFreight, apiFinishFreight, apiCancelFreight, apiConfirmLoaded, apiConfirmFinished,
  apiAuthorizeFreight, apiUpdateFreight,
  apiGetPlants, apiGetBranches, apiGetLots, apiGetTransportCompanies, apiGetTrucks, apiGetFields,
  apiGetNotifications, apiMarkNotificationRead, apiMarkAllRead, apiSubscribePush, VAPID_PUBLIC_KEY,
  API_URL,
} from "./api";
import { C, track } from "./theme";

// ======================== CATALOG HOOK (Real API + client cache) ======
const _catalogCache = { data: null, ts: 0, userId: null };
const CATALOG_TTL = 5 * 60 * 1000; // 5 min

export function useCatalog(user) {
  const [plants, setPlants] = useState(_catalogCache.data?.plants || []);
  const [branches, setBranches] = useState(_catalogCache.data?.branches || []);
  const [lots, setLots] = useState(_catalogCache.data?.lots || []);
  const [fields, setFields] = useState(_catalogCache.data?.fields || []);
  const [transporters, setTransporters] = useState(_catalogCache.data?.transporters || []);
  const [trucks, setTrucks] = useState(_catalogCache.data?.trucks || []);
  const [loading, setLoading] = useState(false);

  const load = useCallback((force)=>{
    if(!user) return;
    const now = Date.now();
    if(!force && _catalogCache.data && _catalogCache.userId === user.id && (now - _catalogCache.ts) < CATALOG_TTL) {
      setPlants(_catalogCache.data.plants); setBranches(_catalogCache.data.branches);
      setLots(_catalogCache.data.lots); setTransporters(_catalogCache.data.transporters);
      setTrucks(_catalogCache.data.trucks); setFields(_catalogCache.data.fields);
      return;
    }
    setLoading(true);
    Promise.all([
      apiGetPlants().catch(()=>[]),
      apiGetBranches().catch(()=>[]),
      apiGetLots().catch(()=>[]),
      apiGetTransportCompanies().catch(()=>[]),
      (user.role==="admin"||user.role==="platform_admin"||user.userType==="transporter"||user.userType==="producer"||(user.userTypes||[]).includes("transporter")||(user.userTypes||[]).includes("producer")) ? apiGetTrucks().catch(()=>[]) : Promise.resolve([]),
      (user.role==="admin"||user.role==="platform_admin"||user.userType==="producer"||(user.userTypes||[]).includes("producer")) ? apiGetFields().catch(()=>[]) : Promise.resolve([]),
    ]).then(([p,br,l,t,tr,f])=>{
      const d = { plants:p||[], branches:br||[], lots:l||[], transporters:t||[], trucks:tr||[], fields:f||[] };
      _catalogCache.data = d; _catalogCache.ts = Date.now(); _catalogCache.userId = user.id;
      setPlants(d.plants); setBranches(d.branches); setLots(d.lots);
      setTransporters(d.transporters); setTrucks(d.trucks); setFields(d.fields);
    }).finally(()=>setLoading(false));
  },[user]);

  useEffect(()=>{ load(); },[load]);

  const refresh = useCallback(()=>{ load(true); },[load]);

  return { plants, branches, lots, fields, transporters, trucks, loading, refresh };
}

// ======================== AUTH HOOK (Real API) ========================
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Setup auth fail handler ONCE
  useEffect(()=>{
    setAuthFailHandler(()=>{
      setUser(null);
      setError("Tu sesión expiró.");
      console.log('[AUTH] Session expired, cleared user');
    });
  },[]);

  // Initialize user from localStorage
  useEffect(()=>{
    const token = getToken();
    const saved = getSavedUser();
    console.log('[AUTH] Initializing:', { hasToken: !!token, hasSaved: !!saved });

    if(token && saved) {
      try {
        const mappedUser = mapUser(saved);
        setUser(mappedUser);
        console.log('[AUTH] User restored from localStorage:', mappedUser);
      } catch(e) {
        console.error('[AUTH] Error mapping saved user:', e);
        clearAuth();
      }
    }
    setLoading(false);
    setIsInitialized(true);
  },[]);

  const login = useCallback(async (identifier) => {
    setLoading(true); setError(null);
    try {
      console.log('[AUTH] Login attempt for:', identifier);
      const d = await apiLogin(identifier);
      console.log('[AUTH] Login response:', d);

      if(!d.user) {
        throw new Error('Respuesta inválida del servidor');
      }

      const mappedUser = mapUser(d.user);
      setUser(mappedUser);
      track("login");
      console.log('[AUTH] Login successful, user set:', mappedUser);
    }
    catch(e) {
      console.error('[AUTH] Login error:', e);
      setError(e.message||"Error al iniciar sesión");
      clearAuth();
    }
    finally { setLoading(false); }
  },[]);

  const signup = useCallback(async (form) => {
    setLoading(true); setError(null);
    try {
      console.log('[AUTH] Signup attempt');
      const typeMap = {planta:"plant",transporter:"transporter",producer:"producer"};
      const userTypes = (form.userTypes||[]).map(t=>typeMap[t]||t);
      const phone = form.phone?.replace(/[\s\-()]/g,'')||"";
      const d = await apiRegister({ name:form.name, email:form.email, phone, userTypes });

      if(!d.user) {
        throw new Error('Respuesta inválida del servidor');
      }

      const mappedUser = mapUser(d.user);
      setUser(mappedUser);
      track("signup");
      console.log('[AUTH] Signup successful, user set:', mappedUser);
    } catch(e) {
      console.error('[AUTH] Signup error:', e);
      setError(e.message||"Error al crear cuenta");
      clearAuth();
    }
    finally { setLoading(false); }
  },[]);

  const logout = useCallback(()=>{
    apiLogout(); // async — revokes refresh tokens on server
    setUser(null);
  },[]);

  const switchCompany = useCallback(async (companyId) => {
    try {
      const d = await apiSwitchCompany(companyId);
      if (d?.user) {
        const mappedUser = mapUser(d.user);
        setUser(mappedUser);
        console.log('[AUTH] Switched to company:', companyId);
        return { ok: true };
      }
      return { ok: false, error: "Respuesta inválida" };
    } catch (e) {
      console.error('[AUTH] Switch company error:', e);
      return { ok: false, error: e.message };
    }
  }, []);

  return { user, loading, error, isInitialized, login, signup, logout, switchCompany, clearError:()=>setError(null) };
}

// ======================== MAP USER ====================================
export function mapUser(u) {
  if(!u) return null;
  const co = u.company;
  const userTypes = u.userTypes || (co?.type ? [co.type] : ["producer"]);
  const userType = u.activeType || userTypes[0] || co?.type || "producer";
  // Map gerente → admin for backward compat in frontend logic
  const rawRole = u.role || "operario";
  const role = rawRole === "gerente" ? "admin" : rawRole;
  const name = u.name || "Usuario";
  const av = name.split(" ").filter(w=>w).map(w=>w[0]).join("").slice(0,2).toUpperCase() || "U";
  // New: companies array from backend (memberships)
  const companies = (u.companies || []).map(c => ({
    ...c,
    // Map gerente → admin for frontend compat
    effectiveRole: c.role === "gerente" ? "admin" : c.role,
  }));
  return {
    id:u.id, email:u.email, phone:u.phone||"", name, role, userType, userTypes,
    companyByType: u.companyByType||{},
    entity:co?.name||"", entityId:co?.id||"", companyId:co?.id||"",
    activeCompanyId: u.activeCompanyId || co?.id || "",
    companies,
    hasInternalFleet: co?.hasInternalFleet||false,
    isSuperAdmin: u.isSuperAdmin||false,
    av
  };
}

// ======================== FREIGHTS HOOK (Real API) ====================
const FREIGHTS_PAGE_SIZE = 25;

export function useFreights(user, isAuthInitialized) {
  const [freights, setFreights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);

  const fetchAll = useCallback(async ()=>{
    if(!user || !isAuthInitialized) return;
    setLoading(true);
    pageRef.current = 1;
    try {
      const r = await apiListFreights({page:1, limit:FREIGHTS_PAGE_SIZE});
      const mapped = (r.data||[]).map(mapFreight);
      setFreights(mapped);
      setTotal(r.total||0);
      setHasMore((r.page||1) < (r.pages||1));
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  },[user, isAuthInitialized]);

  const loadMore = useCallback(async ()=>{
    if(!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const r = await apiListFreights({page:nextPage, limit:FREIGHTS_PAGE_SIZE});
      const mapped = (r.data||[]).map(mapFreight);
      pageRef.current = nextPage;
      setFreights(p=>{
        const ids = new Set(p.map(f=>f.id));
        return [...p, ...mapped.filter(f=>!ids.has(f.id))];
      });
      setHasMore((r.page||1) < (r.pages||1));
    }
    catch(e) { setError(e.message); }
    finally { setLoadingMore(false); }
  },[user, loadingMore, hasMore]);

  useEffect(()=>{
    if(isAuthInitialized && user) { fetchAll(); }
  },[fetchAll, isAuthInitialized, user]);

  const refresh = useCallback(async (id)=>{
    try { const u=await apiGetFreight(id); const m=mapFreight(u); setFreights(p=>p.map(f=>f.id===id?m:f)); return m; }
    catch(e) { setError(e.message); return null; }
  },[]);
  const create = useCallback(async (form)=>{
    try { const body = { originLotId:form.lotId||undefined, fieldId:form.fieldId||undefined, destPlantId:form.plantId||undefined, customOriginName:form.customOriginName||undefined, loadDate:form.loadDate, loadTime:form.loadTime, items:[{grain:form.grain,tons:parseFloat(form.tons),unit:form.unit||"toneladas",amount:form.amount?parseFloat(form.amount):0,productTypeOther:form.productTypeOther||undefined}], notes:form.notes||"", truckId:form.truckId||undefined, overrideOriginLat:form.overrideOriginLat, overrideOriginLng:form.overrideOriginLng, overrideDestLat:form.overrideDestLat, overrideDestLng:form.overrideDestLng };
      if(form.customDestName) { body.customDestName=form.customDestName; body.customDestLat=form.customDestLat; body.customDestLng=form.customDestLng; if(form.destCompanyId) body.destCompanyId=form.destCompanyId; if(!form.plantId) delete body.destPlantId; }
      const c=await apiCreateFreight(body);
      const m=mapFreight(c); setFreights(p=>[m,...p]); setTotal(t=>t+1); return {ok:true, freightId:c.id}; } catch(e) { return {ok:false,error:e.message}; }
  },[]);
  const assign = useCallback(async (fId,compId)=>{ try { await apiAssignFreight(fId,{transportCompanyId:compId}); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respond = useCallback(async (fId,action,reason,truckId)=>{ try { await apiRespondFreight(fId,{action,reason,truckId}); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const start = useCallback(async (fId)=>{ try { await apiStartFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const finish = useCallback(async (fId)=>{ try { await apiFinishFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancel = useCallback(async (fId,reason)=>{ try { await apiCancelFreight(fId,reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmLoaded = useCallback(async (fId)=>{ try { await apiConfirmLoaded(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmFinished = useCallback(async (fId)=>{ try { await apiConfirmFinished(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const authorize = useCallback(async (fId)=>{ try { await apiAuthorizeFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const update = useCallback(async (fId, data)=>{ try { await apiUpdateFreight(fId, data); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  return { freights, loading, loadingMore, error, hasMore, total, fetchAll, loadMore, refresh, create, assign, respond, start, finish, cancel, confirmLoaded, confirmFinished, authorize, update };
}

// ======================== MAP FREIGHT =================================
export function mapFreight(f) {
  if(!f) return null;
  const a = f.assignments?.find(x=>x.status==="active"||x.status==="accepted");
  const isOwnFleet = !!(a && a.transportCompanyId === f.originCompanyId);
  return {
    id:f.id, code:f.code, status:f.status,
    grain:f.items?.[0]?.grain||"", tons:f.items?.[0]?.tons||0,
    unit:f.items?.[0]?.unit||"toneladas", amount:f.items?.[0]?.amount||0,
    productTypeOther:f.items?.[0]?.productTypeOther||"",
    originLotId:f.originLotId, originName:f.originName||"", originCompanyId:f.originCompanyId||"", originCompanyName:f.originCompany?.name||"",
    originLat:f.originLat?parseFloat(f.originLat):null, originLng:f.originLng?parseFloat(f.originLng):null,
    fieldName:f.field?.name||"", isOwnFleet,
    destPlantId:f.destPlantId, destName:f.destName||"",
    destLat:f.destLat?parseFloat(f.destLat):null, destLng:f.destLng?parseFloat(f.destLng):null,
    loadDate:f.loadDate?.split("T")[0]||"", loadTime:f.loadTime||"",
    scheduledAt:f.scheduledAt||null,
    requestedBy:f.requestedById, requestedByName:f.requestedBy?.name||"",
    transporterId:a?.transportCompanyId||null, transporterName:a?.transportCompany?.name||"",
    driverName:a?.driver?.name||null, driverPhone:a?.driver?.phone||null,
    truckPlate:a?.truck?.plate||a?.plate||null, truckModel:a?.truck?.model||null,
    assignments:(f.assignments||[]).map(x=>({ id:x.id, status:x.status, transporterName:x.transportCompany?.name||"", reason:x.reason||null, createdAt:x.createdAt })),
    notes:f.notes||"", cancelReason:f.cancelReason||"", createdAt:f.createdAt,
    transporterLoadedConfirmedAt: f.transporterLoadedConfirmedAt||null,
    producerLoadedConfirmedAt: f.producerLoadedConfirmedAt||null,
    transporterFinishedConfirmedAt: f.transporterFinishedConfirmedAt||null,
    plantFinishedConfirmedAt: f.plantFinishedConfirmedAt||null,
    loadedAt: f.loadedAt||null,
    documents: f.documents||[],
    conversationId: f.conversation?.id||null,
  };
}

// ======================== PERMISSIONS ================================
export function permsFor(user) {
  if (!user) return {};
  const { role, userType } = user;
  // role is already mapped: gerente→admin in mapUser, platform_admin stays
  const isManager = role === "admin" || role === "platform_admin" || role === "gerente";
  return {
    canRequest:      ["plant","producer"].includes(userType),
    canApprove:      userType === "plant" && isManager,
    canAssignDriver: userType === "transporter" && isManager,
    canCancel:       isManager,
    canReject:       userType === "transporter" && isManager,
  };
}

// ======================== MEDIA QUERY HOOK ============================
export function useIsDesktop(bp = 768) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= bp);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${bp}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [bp]);
  return isDesktop;
}

// ======================== ONLINE STATUS HOOK ==========================
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// ======================== NOTIFICATIONS HOOK ==========================
export function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscribedRef = useRef(false);

  // Subscribe to push notifications on first load
  useEffect(() => {
    if (!user || subscribedRef.current || !VAPID_PUBLIC_KEY) return;
    subscribedRef.current = true;

    (async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          const key = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        }

        const subJson = sub.toJSON();
        await apiSubscribePush({ endpoint: subJson.endpoint, keys: subJson.keys });
        console.log('[PUSH] Subscribed');
      } catch (e) {
        console.warn('[PUSH] Subscription failed:', e.message);
      }
    })();
  }, [user]);

  // Initial fetch of notifications (polling handled by App.jsx universal poll)
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      if (!navigator.onLine) return;
      try {
        const r = await apiGetNotifications();
        setNotifications(r.notifications || []);
        setUnreadCount(r.unreadCount || 0);
      } catch { /* ignore fetch errors */ }
    };
    fetchNotifications();
  }, [user]);

  const markRead = useCallback(async (id) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(p => Math.max(0, p - 1));
    } catch { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiMarkAllRead();
      setNotifications(p => p.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await apiGetNotifications();
      setNotifications(r.notifications || []);
      setUnreadCount(r.unreadCount || 0);
    } catch {}
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
}

// ======================== INSTALL PROMPT HOOK =========================
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const canPrompt = !!deferredPrompt;

  return { canPrompt, isInstalled, install, isIOS };
}

// ======================== TABLE SORT HOOK =============================
export function useTableSort() {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const toggle = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
  };
  const sortData = useCallback((data, getters) => {
    if (!sortCol || !sortDir || !getters[sortCol]) return data;
    const getter = getters[sortCol];
    return [...data].sort((a, b) => {
      let va = getter(a), vb = getter(b);
      if (va == null) va = "";
      if (vb == null) vb = "";
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      const da = new Date(va), db = new Date(vb);
      if (!isNaN(da) && !isNaN(db) && String(va).length > 4) return sortDir === "asc" ? da - db : db - da;
      const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
      const cmp = sa.localeCompare(sb, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortCol, sortDir]);
  return { sortCol, sortDir, toggle, sortData };
}

// ======================== SSE (Server-Sent Events) ===================
export function useSSE(user, { onFreightUpdate, onMessageNew, onNotification, onCatalogChanged }) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(5000);

  useEffect(() => {
    if (!user) {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setConnected(false);
      return;
    }

    const token = getToken();
    if (!token) return;

    const connect = () => {
      const url = `${API_URL}/sse/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => {
        setConnected(true);
        console.log('[SSE] Connected');
      });

      es.addEventListener('freight:updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onFreightUpdate) onFreightUpdate(data);
        } catch {}
      });

      es.addEventListener('message:new', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onMessageNew) onMessageNew(data);
        } catch {}
      });

      es.addEventListener('notification:new', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onNotification) onNotification(data);
        } catch {}
      });

      es.addEventListener('catalog:changed', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (onCatalogChanged) onCatalogChanged(data);
        } catch {}
      });

      es.onopen = () => { reconnectDelay.current = 5000; };
      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        reconnectTimer.current = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 60000);
      };
    };

    connect();

    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      setConnected(false);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return { connected };
}

// ======================== PULL TO REFRESH =============================
export function usePullToRefresh(onRefresh) {
  const containerRef = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDist = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop <= 0) startY.current = e.touches[0].clientY;
      else startY.current = 0;
    };
    const onTouchMove = (e) => {
      if (!startY.current || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 10 && el.scrollTop <= 0) {
        pullDist.current = Math.min(diff, 100);
        setPulling(pullDist.current > 50);
      }
    };
    const onTouchEnd = async () => {
      if (pulling && !refreshing) {
        setRefreshing(true);
        setPulling(false);
        try { await onRefresh(); } catch {}
        setRefreshing(false);
      }
      startY.current = 0;
      pullDist.current = 0;
      setPulling(false);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, pulling, refreshing]);

  const indicator = (refreshing || pulling) ? (
    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600, color: refreshing ? C.pri : C.t3 }}>
      {refreshing ? "Actualizando..." : "Soltar para actualizar"}
    </div>
  ) : null;

  return { containerRef, indicator, refreshing };
}
