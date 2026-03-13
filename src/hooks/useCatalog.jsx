import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiGetCatalogAll, apiGetTrucks, apiGetFields,
} from "../api";
import { useCatalogStore } from "../store";
import log from "../logger";

// ======================== CONSTANTS ==================================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CATALOG_TTL = CACHE_TTL;
const _loadingPromises = {}; // Singleton: prevent concurrent requests for same user

// ======================== CATALOG HOOK (Real API + Zustand cache) ====
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
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

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
        if (!d || !mountedRef.current) return;
        setPlants(d.plants); setBranches(d.branches); setLots(d.lots);
        setTransporters(d.transporters); setTrucks(d.trucks); setFields(d.fields);
      });
      return;
    }

    setLoadingLocal(true);
    setLoading(cacheKey, true);

    // Consolidated: 1 request for plants+branches+lots+transporters, parallel with trucks+fields
    const needsTrucks = user.role==="admin"||user.role==="platform_admin"||user.userType==="transporter"||user.userType==="producer"||user.userType==="plant"||(user.userTypes||[]).includes("transporter")||(user.userTypes||[]).includes("producer")||(user.userTypes||[]).includes("plant");
    const needsFields = user.role==="admin"||user.role==="platform_admin"||user.userType==="producer"||(user.userTypes||[]).includes("producer");
    _loadingPromises[cacheKey] = Promise.all([
      apiGetCatalogAll().catch((e)=>{ log.warn('Catalog', 'apiGetCatalogAll failed:', e.message); return { plants:[], branches:[], lots:[], transportCompanies:[] }; }),
      needsTrucks ? apiGetTrucks().catch((e)=>{ log.warn('Catalog', 'apiGetTrucks failed:', e.message); return []; }) : Promise.resolve([]),
      needsFields ? apiGetFields().catch((e)=>{ log.warn('Catalog', 'apiGetFields failed:', e.message); return []; }) : Promise.resolve([]),
    ]).then(([catalog,tr,f])=>{
      const activeCoId = user.activeCompanyId || user.companyId;
      const filteredFields = activeCoId ? (f||[]).filter(fd => fd.companyId === activeCoId || fd.company?.id === activeCoId) : (f||[]);
      const d = { plants:catalog.plants||[], branches:catalog.branches||[], lots:catalog.lots||[], transporters:catalog.transportCompanies||[], trucks:tr||[], fields:filteredFields };
      setCache(cacheKey, d);
      setPlants(d.plants); setBranches(d.branches); setLots(d.lots);
      setTransporters(d.transporters); setTrucks(d.trucks); setFields(d.fields);
      return d;
    }).catch(()=>null).finally(()=>{
      setLoadingLocal(false);
      setLoading(cacheKey, false);
      delete _loadingPromises[cacheKey];
    });
  },[user, cacheKey, getCache, setCache, setLoading]);

  useEffect(()=>{ load(); },[load]);

  const refresh = useCallback((force = true)=>{ load(force); },[load]);

  return { plants, branches, lots, fields, transporters, trucks, loading, refresh };
}
