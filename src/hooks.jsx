import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiLogin, apiRegister, apiLogout, apiSwitchCompany, getToken, getSavedUser, clearAuth, setAuthFailHandler,
  apiListFreights, apiGetFreight, apiCreateFreight, apiAssignFreight, apiRespondFreight,
  apiStartFreight, apiFinishFreight, apiCancelFreight, apiConfirmLoaded, apiConfirmFinished,
  apiAuthorizeFreight, apiUpdateFreight,
  apiAssignMultiTruck, apiAssignTruck, apiCancelAssignment, apiUpdateAssignment, apiRespondTrip, apiStartTrip, apiConfirmTripLoaded, apiConfirmTripFinished,
  apiGetPlants, apiGetBranches, apiGetLots, apiGetTransportCompanies, apiGetTrucks, apiGetFields,
  apiGetNotifications, apiMarkNotificationRead, apiMarkAllRead, apiSubscribePush, VAPID_PUBLIC_KEY,
  API_URL, apiGetSseTicket,
} from "./api";
import { C, track } from "./theme";
import { useCatalogStore } from "./store";
import log from "./logger";

// ======================== CATALOG HOOK (Real API + Zustand cache) ====
const CATALOG_TTL = 5 * 60 * 1000; // 5 min
const _loadingPromises = {}; // Singleton: prevent concurrent requests for same user

export function useCatalog(user) {
  const getCache = useCatalogStore(s => s.getCache);
  const setCache = useCatalogStore(s => s.setCache);
  const setLoading = useCatalogStore(s => s.setLoading);
  // Cache key includes activeCompanyId so switching company invalidates cache
  const cacheKey = user ? `${user.id}:${user.activeCompanyId || user.companyId || ''}` : null;
  const cached = cacheKey ? getCache(cacheKey) : null;

  const [plants, setPlants] = useState(cached?.data?.plants || []);
  const [branches, setBranches] = useState(cached?.data?.branches || []);
  const [lots, setLots] = useState(cached?.data?.lots || []);
  const [fields, setFields] = useState(cached?.data?.fields || []);
  const [transporters, setTransporters] = useState(cached?.data?.transporters || []);
  const [trucks, setTrucks] = useState(cached?.data?.trucks || []);
  const [loading, setLoadingLocal] = useState(cached?.loading || false);

  const load = useCallback((force)=>{
    if(!user || !cacheKey) return;

    const now = Date.now();
    const cache = getCache(cacheKey);

    // Return cached data if fresh
    if(!force && cache?.data && (now - cache.ts) < CATALOG_TTL) {
      setPlants(cache.data.plants); setBranches(cache.data.branches);
      setLots(cache.data.lots); setTransporters(cache.data.transporters);
      setTrucks(cache.data.trucks); setFields(cache.data.fields);
      return;
    }

    // Singleton: if already loading for this user+company, wait for that promise
    if(_loadingPromises[cacheKey]) {
      _loadingPromises[cacheKey].then((d) => {
        if (!d) return;
        setPlants(d.plants); setBranches(d.branches); setLots(d.lots);
        setTransporters(d.transporters); setTrucks(d.trucks); setFields(d.fields);
      });
      return;
    }

    setLoadingLocal(true);
    setLoading(cacheKey, true);

    _loadingPromises[cacheKey] = Promise.all([
      apiGetPlants().catch((e)=>{ log.warn('Catalog', 'apiGetPlants failed:', e.message); return []; }),
      apiGetBranches().catch((e)=>{ log.warn('Catalog', 'apiGetBranches failed:', e.message); return []; }),
      apiGetLots().catch((e)=>{ log.warn('Catalog', 'apiGetLots failed:', e.message); return []; }),
      apiGetTransportCompanies().catch((e)=>{ log.warn('Catalog', 'apiGetTransportCompanies failed:', e.message); return []; }),
      (user.role==="admin"||user.role==="platform_admin"||user.userType==="transporter"||user.userType==="producer"||user.userType==="plant"||(user.userTypes||[]).includes("transporter")||(user.userTypes||[]).includes("producer")||(user.userTypes||[]).includes("plant"))
        ? apiGetTrucks().catch((e)=>{ log.warn('Catalog', 'apiGetTrucks failed:', e.message); return []; })
        : Promise.resolve([]),
      (user.role==="admin"||user.role==="platform_admin"||user.userType==="producer"||(user.userTypes||[]).includes("producer"))
        ? apiGetFields().catch((e)=>{ log.warn('Catalog', 'apiGetFields failed:', e.message); return []; })
        : Promise.resolve([]),
    ]).then(([p,br,l,t,tr,f])=>{
      const d = { plants:p||[], branches:br||[], lots:l||[], transporters:t||[], trucks:tr||[], fields:f||[] };
      setCache(cacheKey, d);
      setPlants(d.plants); setBranches(d.branches); setLots(d.lots);
      setTransporters(d.transporters); setTrucks(d.trucks); setFields(d.fields);
      return d;
    }).catch(()=>null).finally(()=>{
      setLoadingLocal(false);
      delete _loadingPromises[cacheKey];
    });
  },[user, cacheKey, getCache, setCache, setLoading]);

  useEffect(()=>{ load(); },[load]);

  const refresh = useCallback((force = true)=>{ load(force); },[load]);

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
      log.log('AUTH', 'Session expired, cleared user');
    });
    return () => setAuthFailHandler(null);
  },[]);

  // Initialize user from localStorage
  useEffect(()=>{
    const token = getToken();
    const saved = getSavedUser();
    log.log('AUTH', 'Initializing:', { hasToken: !!token, hasSaved: !!saved });

    if(token && saved) {
      try {
        const mappedUser = mapUser(saved);
        setUser(mappedUser);
        log.log('AUTH', 'User restored, id:', mappedUser?.id);
      } catch(e) {
        log.error('AUTH', 'Error mapping saved user:', e);
        clearAuth();
      }
    }
    setLoading(false);
    setIsInitialized(true);
  },[]);

  const login = useCallback(async (identifier, password) => {
    setLoading(true); setError(null);
    try {
      log.log('AUTH', 'Login attempt');
      const d = await apiLogin(identifier, password);
      log.log('AUTH', 'Login response received');

      if(!d.user) {
        throw new Error('Respuesta inválida del servidor');
      }

      const mappedUser = mapUser(d.user);
      setUser(mappedUser);
      track("login");
      log.log('AUTH', 'Login successful, user id:', mappedUser?.id);
      return { success: true };
    }
    catch(e) {
      log.error('AUTH', 'Login error:', e);
      // Special case: user has no password set (header hint, not in body)
      if (e._noPassword) {
        setLoading(false);
        return { noPassword: true };
      }
      setError(e.message||"Error al iniciar sesión");
      clearAuth();
      return null;
    }
    finally { setLoading(false); }
  },[]);

  const signup = useCallback(async (form) => {
    setLoading(true); setError(null);
    try {
      log.log('AUTH', 'Signup attempt');
      const typeMap = {planta:"plant",transporter:"transporter",producer:"producer"};
      const userTypes = (form.userTypes||[]).map(t=>typeMap[t]||t);
      const phone = form.phone?.replace(/[\s\-()]/g,'')||"";
      const d = await apiRegister({ name:form.name, email:form.email, phone, password:form.password, userTypes });

      if(!d.user) {
        throw new Error('Respuesta inválida del servidor');
      }

      const mappedUser = mapUser(d.user);
      setUser(mappedUser);
      track("signup");
      log.log('AUTH', 'Signup successful, user set:', mappedUser);
    } catch(e) {
      log.error('AUTH', 'Signup error:', e);
      setError(e.message||"Error al crear cuenta");
      clearAuth();
    }
    finally { setLoading(false); }
  },[]);

  const logout = useCallback(()=>{
    apiLogout(); // async — revokes refresh tokens on server
    setUser(null);
    useCatalogStore.getState().clearCache();
    // Clear SW API cache to prevent stale data leaking between users
    if ('caches' in window) caches.delete('tolvink-api-v2').catch(() => {});
  },[]);

  const switchingRef = useRef(false);
  const [companySwitching, setCompanySwitching] = useState(false);
  const switchCompany = useCallback(async (companyId) => {
    if (switchingRef.current) return { ok: false, error: "Cambio en curso" };
    switchingRef.current = true;
    setCompanySwitching(true);
    try {
      // Optimistic: update company name immediately from local data
      setUser(prev => {
        if (!prev) return prev;
        const target = prev.companies?.find(c => c.companyId === companyId);
        if (!target) return prev;
        return { ...prev, activeCompanyId: companyId, companyId, entity: target.companyName, userType: target.companyType };
      });

      const d = await apiSwitchCompany(companyId);
      if (d?.user) {
        const mappedUser = mapUser(d.user);
        setUser(mappedUser);
        if ('caches' in window) caches.delete('tolvink-api-v2').catch(() => {});
        log.log('AUTH', 'Switched to company:', companyId);
        return { ok: true };
      }
      return { ok: false, error: "Respuesta inválida" };
    } catch (e) {
      log.error('AUTH', 'Switch company error:', e);
      return { ok: false, error: e.message };
    } finally {
      switchingRef.current = false;
      setCompanySwitching(false);
    }
  }, []);

  const handlePasswordReset = useCallback((result) => {
    if (result?.user) {
      const mappedUser = mapUser(result.user);
      setUser(mappedUser);
      track("password_reset");
    }
  }, []);

  const patchUser = useCallback((updates) => {
    const ALLOWED = new Set(['name', 'email', 'phone', 'company', 'activeCompanyId', 'companies', 'isNew']);
    setUser(prev => {
      if (!prev) return prev;
      const safe = {};
      for (const k of Object.keys(updates)) { if (ALLOWED.has(k)) safe[k] = updates[k]; }
      const patched = { ...prev, ...safe };
      localStorage.setItem('tolvink_user', JSON.stringify(patched));
      return patched;
    });
  }, []);

  return { user, loading, error, isInitialized, login, signup, logout, switchCompany, companySwitching, handlePasswordReset, patchUser, clearError:()=>setError(null) };
}

// ======================== MAP USER ====================================
export function mapUser(u) {
  if(!u) return null;
  const co = u.company;
  const userTypes = u.userTypes || (co?.type ? [co.type] : ["producer"]);
  const userType = u.activeType || co?.type || userTypes[0] || "producer";
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
    isNew: !!u.isNew,
    av
  };
}

// ======================== FREIGHTS HOOK (Real API) ====================
const FREIGHTS_PAGE_SIZE = 25;

export function useFreights(user, isAuthInitialized) {
  const [freights, setFreights] = useState([]);
  const freightsRef = useRef([]); // Mirror of freights state for synchronous reads in optimistic updates
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);

  // Multi-company: pass activeCompanyId to server-side filter
  const companyFilter = user?.activeCompanyId || user?.companyId || undefined;

  const fetchAll = useCallback(async ()=>{
    if(!user || !isAuthInitialized) return;
    setLoading(true);
    pageRef.current = 1;
    try {
      const r = await apiListFreights({page:1, limit:FREIGHTS_PAGE_SIZE, company:companyFilter});
      const mapped = (r.data||[]).map(mapFreight);
      freightsRef.current = mapped;
      setFreights(mapped);
      setTotal(r.total||0);
      setHasMore((r.page||1) < (r.pages||1));
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  },[user, isAuthInitialized, companyFilter]);

  const loadMore = useCallback(async ()=>{
    if(!user || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const r = await apiListFreights({page:nextPage, limit:FREIGHTS_PAGE_SIZE, company:companyFilter});
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
  },[user, loadingMore, hasMore, companyFilter]);

  useEffect(()=>{
    if(isAuthInitialized && user) { fetchAll(); }
  },[fetchAll, isAuthInitialized, user]);

  const refresh = useCallback(async (id)=>{
    try {
      const u=await apiGetFreight(id); const m=mapFreight(u);
      setFreights(p=>{
        const idx = p.findIndex(f=>f.id===id);
        let next;
        if (idx >= 0) { next=[...p]; next[idx]=m; }
        else { next=[m, ...p]; } // New freight — prepend to list
        freightsRef.current = next;
        return next;
      });
      return m;
    }
    catch(e) { setError(e.message); return null; }
  },[]);
  const create = useCallback(async (form)=>{
    try { const body = { originLotId:form.lotId||undefined, fieldId:form.fieldId||undefined, destPlantId:form.plantId||undefined, customOriginName:form.customOriginName||undefined, loadDate:form.loadDate, loadTime:form.loadTime, items:[{grain:form.grain,tons:parseFloat(form.tons),unit:form.unit||"toneladas",amount:form.amount?parseFloat(form.amount):0,productTypeOther:form.productTypeOther||undefined}], notes:form.notes||"", truckId:form.truckId||undefined, useOwnFleet:form.useOwnFleet, overrideOriginLat:form.overrideOriginLat, overrideOriginLng:form.overrideOriginLng, overrideDestLat:form.overrideDestLat, overrideDestLng:form.overrideDestLng };
      const computedTruckCount = form.truckCount ? parseInt(form.truckCount) : (parseFloat(form.tons) > 0 ? Math.ceil(parseFloat(form.tons) / 30) : 1);
      if(computedTruckCount > 1) body.truckCount = computedTruckCount;
      if(form.customDestName) { body.customDestName=form.customDestName; body.customDestLat=form.customDestLat; body.customDestLng=form.customDestLng; if(form.destCompanyId) body.destCompanyId=form.destCompanyId; if(!form.plantId) delete body.destPlantId; }
      const c=await apiCreateFreight(body);
      const m=mapFreight(c); setFreights(p=>[m,...p]); setTotal(t=>t+1); return {ok:true, freightId:c.id}; } catch(e) { return {ok:false,error:e.message}; }
  },[]);
  const assign = useCallback(async (fId,compId,truckId,driverId)=>{ try { const body={transportCompanyId:compId}; if(truckId) body.truckId=truckId; if(driverId) body.driverId=driverId; await apiAssignFreight(fId,body); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respond = useCallback(async (fId,action,reason,truckId,driverId)=>{
    let prev = null;
    if(action==="accepted") {
      prev = freightsRef.current.find(f=>f.id===fId)?.status || null;
      setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:"accepted"}:f); freightsRef.current=next; return next; });
    }
    try { await apiRespondFreight(fId,{action,reason,truckId,driverId}); await refresh(fId); return {ok:true}; }
    catch(e) { if(prev) setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:prev}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message}; }
  },[refresh]);
  const start = useCallback(async (fId)=>{
    const prev = freightsRef.current.find(f=>f.id===fId)?.status || null;
    setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:"in_progress"}:f); freightsRef.current=next; return next; });
    try { await apiStartFreight(fId); await refresh(fId); return {ok:true}; }
    catch(e) { if(prev) setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:prev}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message}; }
  },[refresh]);
  const finish = useCallback(async (fId)=>{ try { await apiFinishFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancel = useCallback(async (fId,reason)=>{ try { await apiCancelFreight(fId,reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmLoaded = useCallback(async (fId, loadedTons)=>{ try { await apiConfirmLoaded(fId, loadedTons); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmFinished = useCallback(async (fId)=>{ try { await apiConfirmFinished(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const authorize = useCallback(async (fId)=>{
    const prev = freightsRef.current.find(f=>f.id===fId)?.status || null;
    setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:"accepted"}:f); freightsRef.current=next; return next; });
    try { await apiAuthorizeFreight(fId); await refresh(fId); return {ok:true}; }
    catch(e) { if(prev) setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:prev}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message}; }
  },[refresh]);
  const update = useCallback(async (fId, data)=>{ try { const res = await apiUpdateFreight(fId, data); await refresh(fId); return {ok:true, pending: !!res?.pendingChangeCreated}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  // Multi-truck callbacks (v6.0)
  const assignMulti = useCallback(async (fId, trucks)=>{ try { await apiAssignMultiTruck(fId, trucks); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const assignTruckCb = useCallback(async (fId, truckData)=>{ try { await apiAssignTruck(fId, truckData); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancelAssignment = useCallback(async (fId, aId, reason)=>{ try { await apiCancelAssignment(fId, aId, reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const updateAssignment = useCallback(async (fId, aId, data)=>{ try { await apiUpdateAssignment(fId, aId, data); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respondTrip = useCallback(async (fId, aId, body)=>{ try { await apiRespondTrip(fId, aId, body); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const startTrip = useCallback(async (fId, aId)=>{ try { await apiStartTrip(fId, aId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmTripLoaded = useCallback(async (fId, aId, loadedTons)=>{ try { await apiConfirmTripLoaded(fId, aId, loadedTons); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmTripFinished = useCallback(async (fId, aId)=>{ try { await apiConfirmTripFinished(fId, aId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  return { freights, loading, loadingMore, error, hasMore, total, fetchAll, loadMore, refresh, create, assign, respond, start, finish, cancel, confirmLoaded, confirmFinished, authorize, update, assignMulti, assignTruckCb, cancelAssignment, updateAssignment, respondTrip, startTrip, confirmTripLoaded, confirmTripFinished };
}

// ======================== MAP FREIGHT =================================
export function mapFreight(f) {
  if(!f) return null;
  const activeAssigns = (f.assignments||[]).filter(x=>x.status==="active"||x.status==="accepted");
  const a = activeAssigns[0];
  const isOwnFleet = !!(a && a.transportCompanyId === f.originCompanyId);
  const isMultiTruck = !!(f.isMultiTruck || f.truckCount > 1);
  return {
    id:f.id, code:f.code, status:f.status,
    grain:f.items?.[0]?.grain||"", tons:f.items?.[0]?.tons||0,
    unit:f.items?.[0]?.unit||"toneladas", amount:f.items?.[0]?.amount||0,
    productTypeOther:f.items?.[0]?.productTypeOther||"",
    originLotId:f.originLotId, originName:f.originName||"", originCompanyId:f.originCompanyId||"", originCompanyName:f.originCompany?.name||"",
    originHasOwnFleet: !!(f.originCompany?.hasInternalFleet || (Array.isArray(f.originCompany?.types) && f.originCompany.types.includes("transporter"))),
    destHasOwnFleet: !!(f.destCompany?.hasInternalFleet || (Array.isArray(f.destCompany?.types) && f.destCompany.types.includes("transporter"))),
    originLat:f.originLat?parseFloat(f.originLat):null, originLng:f.originLng?parseFloat(f.originLng):null,
    fieldName:f.field?.name||"", useOwnFleet:f.useOwnFleet??null, isOwnFleet: f.useOwnFleet!=null ? f.useOwnFleet : isOwnFleet,
    destPlantId:f.destPlantId, destCompanyId:f.destCompanyId||null, destName:f.destName||"",
    destLat:f.destLat?parseFloat(f.destLat):null, destLng:f.destLng?parseFloat(f.destLng):null,
    loadDate:f.loadDate?.split("T")[0]||"", loadTime:f.loadTime||"",
    scheduledAt:f.scheduledAt||null,
    requestedBy:f.requestedById, requestedByName:f.originCompany?.name ? `${({producer:"Productor",plant:"Planta",transporter:"Transportista"})[f.originCompany.type]||""} ${f.originCompany.name}`.trim() : f.requestedBy?.name||"",
    // Single-truck compat (first assignment)
    transporterId:a?.transportCompanyId||null, transporterName:a?.transportCompany?.name||"",
    driverId:a?.driverId||a?.driver?.id||null, driverName:a?.driver?.name||null, driverPhone:a?.driver?.phone||null,
    queuePosition:a?.queuePosition??0,
    truckPlate:a?.truck?.plate||a?.plate||null, truckModel:a?.truck?.model||null,
    // All assignments (includes history)
    assignments:(f.assignments||[]).map(x=>({ id:x.id, status:x.status, transporterName:x.transportCompany?.name||"", reason:x.reason||null, createdAt:x.createdAt })),
    // Multi-truck (v6.0)
    truckCount: f.truckCount || 1,
    assignedTruckCount: f.assignedTruckCount || (activeAssigns.length > 0 ? activeAssigns.length : 0),
    isMultiTruck,
    activeAssignments: activeAssigns.map(x => ({
      id: x.id,
      transportCompanyId: x.transportCompanyId || null,
      transporterName: x.transportCompany?.name || "",
      truckId: x.truckId || null,
      plate: x.truck?.plate || x.plate || null,
      truckModel: x.truck?.model || null,
      driverId: x.driverId || x.driver?.id || null,
      driverName: x.driver?.name || x.driverName || null,
      driverPhone: x.driver?.phone || null,
      tripStatus: x.tripStatus || "pending",
      tripNumber: x.tripNumber || 1,
      tons: x.tons ? parseFloat(x.tons) : null,
      queuePosition: x.queuePosition ?? 0,
      transporterLoadedConfirmedAt: x.transporterLoadedConfirmedAt || null,
      producerLoadedConfirmedAt: x.producerLoadedConfirmedAt || null,
      transporterFinishedConfirmedAt: x.transporterFinishedConfirmedAt || null,
      plantFinishedConfirmedAt: x.plantFinishedConfirmedAt || null,
      startedAt: x.startedAt || null,
      loadedAt: x.loadedAt || null,
      finishedAt: x.finishedAt || null,
    })),
    notes:f.notes||"", cancelReason:f.cancelReason||"", createdAt:f.createdAt,
    transporterLoadedConfirmedAt: f.transporterLoadedConfirmedAt||null,
    producerLoadedConfirmedAt: f.producerLoadedConfirmedAt||null,
    transporterFinishedConfirmedAt: f.transporterFinishedConfirmedAt||null,
    plantFinishedConfirmedAt: f.plantFinishedConfirmedAt||null,
    startedAt: f.startedAt||null,
    loadedAt: f.loadedAt||null,
    finishedAt: f.finishedAt||null,
    documents: f.documents||[],
    conversationId: f.conversation?.id||null,
  };
}

// ======================== PERMISSIONS ================================
export function permsFor(user) {
  if (!user) return {};
  const { role, userType } = user;
  const isChofer = role === "chofer";
  if (isChofer) return { canRequest:false, canApprove:false, canAssignDriver:false, canCancel:false, canReject:false, isChofer:true };
  // role is already mapped: gerente→admin in mapUser, platform_admin stays
  const isManager = role === "admin" || role === "platform_admin";
  return {
    canRequest:      ["plant","producer"].includes(userType),
    canApprove:      userType === "plant" && isManager,
    canAssignDriver: userType === "transporter" && isManager,
    canCancel:       isManager,
    canReject:       userType === "transporter" && isManager,
    isChofer:        false,
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
          try {
            const key = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
          } catch (keyError) {
            log.warn('PUSH', 'Invalid VAPID key or subscription failed:', keyError);
            return;
          }
        }

        const subJson = sub.toJSON();
        await apiSubscribePush({ endpoint: subJson.endpoint, keys: subJson.keys });
        log.log('PUSH', 'Subscribed');
      } catch (e) {
        log.warn('PUSH', 'Subscription failed:', e.message);
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
      } catch (e) { log.warn('NOTIF', 'Fetch failed:', e.message); }
    };
    fetchNotifications();
  }, [user]);

  const markRead = useCallback(async (id) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(p => Math.max(0, p - 1));
    } catch (e) { log.warn('NOTIF', 'Mark read failed:', e.message); }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiMarkAllRead();
      setNotifications(p => p.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) { log.warn('NOTIF', 'Mark all read failed:', e.message); }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await apiGetNotifications();
      setNotifications(r.notifications || []);
      setUnreadCount(r.unreadCount || 0);
    } catch (e) { log.warn('NOTIF', 'Refresh failed:', e.message); }
  }, []);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
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
export function useSSE(user, { onFreightUpdate, onMessageNew, onNotification, onCatalogChanged, onTyping, onRead }) {
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(5000);
  const failureCount = useRef(0);

  // Keep latest callbacks in refs to avoid stale closures in EventSource handlers
  const cbRefs = useRef({ onFreightUpdate, onMessageNew, onNotification, onCatalogChanged, onTyping, onRead });
  cbRefs.current = { onFreightUpdate, onMessageNew, onNotification, onCatalogChanged, onTyping, onRead };

  useEffect(() => {
    if (!user) {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setConnected(false);
      failureCount.current = 0;
      return;
    }

    if (!getToken()) return;

    let connecting = false;
    const connect = async () => {
      if (!getToken() || connecting) return;
      connecting = true;
      try {
      // Safety: close previous EventSource before creating new one
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      // Use short-lived ticket instead of JWT in URL
      let url;
      try {
        const { ticket } = await apiGetSseTicket();
        url = `${API_URL}/sse/stream?ticket=${encodeURIComponent(ticket)}`;
      } catch {
        // Ticket fetch failed — schedule retry with backoff instead of exposing JWT in URL
        reconnectTimer.current = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 30000);
        return;
      }
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => {
        setConnected(true);
        failureCount.current = 0; // Reset on successful connection
        log.log('SSE', 'Connected');
      });

      es.addEventListener('freight:updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onFreightUpdate?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('message:new', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onMessageNew?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('notification:new', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onNotification?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('catalog:changed', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onCatalogChanged?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('typing', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onTyping?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.addEventListener('read', (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRefs.current.onRead?.(data);
        } catch (err) { log.warn('SSE', 'Event parse error:', err.message); }
      });

      es.onopen = () => {
        reconnectDelay.current = 5000;
        failureCount.current = 0;
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;

        failureCount.current += 1;
        log.warn('SSE', `Connection failed (${failureCount.current})`);

        // Never stop retrying — cap backoff at 30s so reconnection is fast after deploys
        reconnectTimer.current = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 30000);
      };
      } finally { connecting = false; }
    };

    connect();

    // Recovery: when user returns to tab, reset backoff and reconnect immediately if disconnected
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !esRef.current) {
        log.log('SSE', 'Tab visible — reconnecting');
        failureCount.current = 0;
        reconnectDelay.current = 5000;
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
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
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop <= 0) startY.current = e.touches[0].clientY;
      else startY.current = 0;
    };
    const onTouchMove = (e) => {
      if (!startY.current || refreshingRef.current) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 10 && el.scrollTop <= 0) {
        pullDist.current = Math.min(diff, 100);
        const isPulling = pullDist.current > 50;
        if (isPulling !== pullingRef.current) { pullingRef.current = isPulling; setPulling(isPulling); }
      }
    };
    const onTouchEnd = async () => {
      if (pullingRef.current && !refreshingRef.current) {
        refreshingRef.current = true; setRefreshing(true);
        pullingRef.current = false; setPulling(false);
        try { await onRefreshRef.current(); } catch {}
        refreshingRef.current = false; setRefreshing(false);
      }
      startY.current = 0;
      pullDist.current = 0;
      pullingRef.current = false; setPulling(false);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const indicator = (refreshing || pulling) ? (
    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600, color: refreshing ? C.pri : C.t3 }}>
      {refreshing ? "Actualizando..." : "Soltar para actualizar"}
    </div>
  ) : null;

  return { containerRef, indicator, refreshing };
}
