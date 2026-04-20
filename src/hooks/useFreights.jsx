import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiListFreights, apiGetFreight, apiGetFreightSummary, apiCreateFreight, apiAssignFreight, apiRespondFreight,
  apiStartFreight, apiFinishFreight, apiCancelFreight, apiConfirmLoaded, apiConfirmFinished,
  apiAuthorizeFreight, apiApproveProducerFreight, apiUpdateFreight,
  apiAssignMultiTruck, apiAssignTruck, apiCancelAssignment, apiUpdateAssignment, apiRespondTrip, apiStartTrip, apiConfirmTripLoaded, apiConfirmTripFinished,
} from "../api";
import { useFreightDetailStore } from "../store";
import { mapFreight } from "./helpers";

// ======================== CONSTANTS ==================================
const PAGE_SIZE = 25;
const FREIGHTS_PAGE_SIZE = PAGE_SIZE;

// Detail-only fields that must not be overwritten by summary/list data
const DETAIL_FIELDS = ['documents', 'pendingChanges', 'conversationId'];

/** Merge new data into existing freight, preserving detail-only fields if the
 *  existing entry was loaded in full but the new one is summary/list data. */
function mergeFreight(existing, incoming) {
  if (!existing || !existing._isFullDetail || incoming._isFullDetail) return incoming;
  const merged = { ...incoming };
  for (const k of DETAIL_FIELDS) { if (existing[k] !== undefined) merged[k] = existing[k]; }
  merged._isFullDetail = true;
  return merged;
}

// ======================== FREIGHTS HOOK (Real API) ====================
export function useFreights(user, isAuthInitialized) {
  const [freights, setFreights] = useState([]);
  const freightsRef = useRef([]); // Mirror of freights state for synchronous reads in optimistic updates
  const [loading, setLoading] = useState(!!user && !!isAuthInitialized);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const pageRef = useRef(1);

  // Multi-company: show ALL freights from all user's companies (no company filter).
  // The backend resolveAllCompanyIds already scopes to the user's memberships.
  const companyFilter = undefined;

  const fetchingRef = useRef(false); // prevent concurrent fetchAll calls
  const fetchAll = useCallback(async ()=>{
    if(!user || !isAuthInitialized || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    pageRef.current = 1;
    try {
      const r = await apiListFreights({page:1, limit:FREIGHTS_PAGE_SIZE, company:companyFilter});
      const mapped = (r.data||[]).map(mapFreight);
      // Preserve full-detail fields for items currently loaded in detail view
      const prev = freightsRef.current;
      const fullMap = new Map();
      prev.forEach(f => { if (f._isFullDetail) fullMap.set(f.id, f); });
      const merged = fullMap.size > 0 ? mapped.map(f => mergeFreight(fullMap.get(f.id), f)) : mapped;
      freightsRef.current = merged;
      setFreights(merged);
      // Pre-populate detail cache so card clicks render instantly
      const detailStore = useFreightDetailStore.getState();
      mapped.forEach(f => { if (f.id && !detailStore.getDetail(f.id)) detailStore.setDetail(f.id, f); });
      setTotal(r.total||0);
      setStatusCounts(r.statusCounts||{});
      setHasMore((r.page||1) < (r.pages||1));
    }
    catch(e) { setError(e.message); }
    finally { setLoading(false); fetchingRef.current = false; }
  },[user, isAuthInitialized, companyFilter]);

  const loadMore = useCallback(async ()=>{
    if(!user || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const r = await apiListFreights({page:nextPage, limit:FREIGHTS_PAGE_SIZE, company:companyFilter});
      const mapped = (r.data||[]).map(mapFreight);
      // Pre-populate detail cache for new items
      const detailStore = useFreightDetailStore.getState();
      mapped.forEach(f => { if (f.id && !detailStore.getDetail(f.id)) detailStore.setDetail(f.id, f); });
      pageRef.current = nextPage;
      setFreights(p=>{
        // Merge: update stale items + append new ones (prevents divergence on page boundaries)
        const map = new Map(p.map(f=>[f.id,f]));
        mapped.forEach(f=>map.set(f.id, mergeFreight(map.get(f.id), f)));
        const next = [...map.values()];
        freightsRef.current = next;
        return next;
      });
      setHasMore((r.page||1) < (r.pages||1));
    }
    catch(e) { setError(e.message); }
    finally { setLoadingMore(false); }
  },[user, loadingMore, hasMore, loading, companyFilter]);

  useEffect(()=>{
    if(isAuthInitialized && user) { fetchAll(); }
  },[fetchAll, isAuthInitialized, user]);

  const refresh = useCallback(async (id)=>{
    try {
      const u=await apiGetFreight(id); const m=mapFreight(u);
      // Update detail cache since we already have full data
      useFreightDetailStore.getState().setDetail(id, m);
      setFreights(p=>{
        const idx = p.findIndex(f=>f.id===id);
        const oldStatus = idx >= 0 ? p[idx].status : null;
        let next;
        if (idx >= 0) { next=[...p]; next[idx]=m; }
        else { next=[m, ...p]; } // New freight — prepend to list
        freightsRef.current = next;
        // Update statusCounts locally to avoid full re-fetch
        if (idx < 0 || oldStatus !== m.status) {
          setStatusCounts(prev => {
            const updated = { ...prev };
            if (oldStatus && updated[oldStatus] > 0) updated[oldStatus]--;
            updated[m.status] = (updated[m.status] || 0) + 1;
            return updated;
          });
        }
        return next;
      });
      return m;
    }
    catch(e) { setError(e.message); return null; }
  },[]);
  /** Light refresh: fetch summary (no documents/pendingChanges/conversation) — used for SSE updates.
   *  Falls back to full refresh if summary endpoint is not available.
   *  Merges into existing full-detail entries to avoid losing detail-only fields. */
  const refreshLight = useCallback(async (id)=>{
    try {
      let u;
      try { u = await apiGetFreightSummary(id); }
      catch { return refresh(id); } // Fallback: summary endpoint not deployed yet
      const m=mapFreight(u);
      setFreights(p=>{
        const idx = p.findIndex(f=>f.id===id);
        const oldStatus = idx >= 0 ? p[idx].status : null;
        let next;
        if (idx >= 0) { next=[...p]; next[idx]=mergeFreight(p[idx], m); }
        else { next=[m, ...p]; }
        freightsRef.current = next;
        if (idx < 0 || oldStatus !== m.status) {
          setStatusCounts(prev => {
            const updated = { ...prev };
            if (oldStatus && updated[oldStatus] > 0) updated[oldStatus]--;
            updated[m.status] = (updated[m.status] || 0) + 1;
            return updated;
          });
        }
        return next;
      });
      return m;
    }
    catch(e) { setError(e.message); return null; }
  },[refresh]);
  const create = useCallback(async (form)=>{
    try { const body = { originLotId:form.originLotId||form.lotId||undefined, fieldId:form.fieldId||undefined, destPlantId:form.plantId||undefined, tolvinkPlantId:form.tolvinkPlantId||undefined, customOriginName:form.customOriginName||undefined, loadDate:form.loadDate, loadTime:form.loadTime, items:[{grain:form.grain,...(form.tons&&parseFloat(form.tons)>0?{tons:parseFloat(form.tons)}:{}),unit:form.unit||"toneladas",amount:form.amount?parseFloat(form.amount):0,productTypeOther:form.productTypeOther||undefined}], notes:form.notes||"", truckId:form.truckId||undefined, driverId:form.driverId||undefined, useOwnFleet:form.useOwnFleet, overrideOriginLat:form.overrideOriginLat, overrideOriginLng:form.overrideOriginLng, overrideDestLat:form.overrideDestLat, overrideDestLng:form.overrideDestLng };
      if(form.producerCompanyId) body.producerCompanyId=form.producerCompanyId;
      const tonsEquiv = form.unit==="kg" ? parseFloat(form.tons)/1000 : parseFloat(form.tons);
      const computedTruckCount = form.truckCount ? parseInt(form.truckCount) : (tonsEquiv > 0 ? Math.ceil(tonsEquiv / 30) : 1);
      if(computedTruckCount > 1) body.truckCount = computedTruckCount;
      if(form.customDestName) { body.customDestName=form.customDestName; body.customDestLat=form.customDestLat; body.customDestLng=form.customDestLng; if(form.destCompanyId) body.destCompanyId=form.destCompanyId; if(!form.plantId) delete body.destPlantId; }
      const c=await apiCreateFreight(body);
      const m=mapFreight(c); setFreights(p=>[m,...p]); setTotal(t=>t+1); return {ok:true, freightId:c.id}; } catch(e) { return {ok:false,error:e.message}; }
  },[]);
  const assign = useCallback(async (fId,compId,truckId,driverId)=>{ try { const body={transportCompanyId:compId}; if(truckId) body.truckId=truckId; if(driverId) body.driverId=driverId; await apiAssignFreight(fId,body); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respond = useCallback(async (fId,action,reason,truckId,driverId)=>{
    let prevStatus = null;
    const freight = freightsRef.current.find(f=>f.id===fId);
    // Skip optimistic update for multi-truck freights — server derives status differently
    if(action==="accepted" && !(freight?.truckCount > 1)) {
      prevStatus = freight?.status ?? null;
      setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:"accepted"}:f); freightsRef.current=next; return next; });
    }
    try { await apiRespondFreight(fId,{action,reason,truckId,driverId}); await refresh(fId); return {ok:true}; }
    catch(e) { if(prevStatus) setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:prevStatus}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message}; }
  },[refresh]);
  const start = useCallback(async (fId, force)=>{
    const prevStatus = freightsRef.current.find(f=>f.id===fId)?.status || null;
    setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:"in_progress"}:f); freightsRef.current=next; return next; });
    try { await apiStartFreight(fId, force); await refresh(fId); return {ok:true}; }
    catch(e) { if(prevStatus) setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:prevStatus}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message,truckBusy:e.data?.truckBusy,busyFreightCode:e.data?.busyFreightCode}; }
  },[refresh]);
  const finish = useCallback(async (fId)=>{ try { await apiFinishFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancel = useCallback(async (fId,reason)=>{ try { await apiCancelFreight(fId,reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmLoaded = useCallback(async (fId, loadedTons)=>{ try { await apiConfirmLoaded(fId, loadedTons); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmFinished = useCallback(async (fId)=>{ try { await apiConfirmFinished(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const authorize = useCallback(async (fId)=>{
    const prevStatus = freightsRef.current.find(f=>f.id===fId)?.status || null;
    setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:"accepted"}:f); freightsRef.current=next; return next; });
    try { await apiAuthorizeFreight(fId); await refresh(fId); return {ok:true}; }
    catch(e) { if(prevStatus) setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,status:prevStatus}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message}; }
  },[refresh]);
  const approveProducer = useCallback(async (fId)=>{
    setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,plantApprovedAt:new Date().toISOString()}:f); freightsRef.current=next; return next; });
    try { await apiApproveProducerFreight(fId); await refresh(fId); return {ok:true}; }
    catch(e) { setFreights(p=>{ const next=p.map(f=>f.id===fId?{...f,plantApprovedAt:null}:f); freightsRef.current=next; return next; }); refresh(fId); return {ok:false,error:e.message}; }
  },[refresh]);
  const update = useCallback(async (fId, data)=>{ try { const res = await apiUpdateFreight(fId, data); await refresh(fId); return {ok:true, pending: !!res?.pendingChangeCreated}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  // Multi-truck callbacks (v6.0)
  const assignMulti = useCallback(async (fId, trucks)=>{ try { await apiAssignMultiTruck(fId, trucks); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const assignTruckCb = useCallback(async (fId, truckData)=>{ try { await apiAssignTruck(fId, truckData); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancelAssignment = useCallback(async (fId, aId, reason)=>{ try { await apiCancelAssignment(fId, aId, reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const updateAssignment = useCallback(async (fId, aId, data)=>{ try { await apiUpdateAssignment(fId, aId, data); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respondTrip = useCallback(async (fId, aId, body)=>{ try { await apiRespondTrip(fId, aId, body); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const startTrip = useCallback(async (fId, aId, force)=>{ try { await apiStartTrip(fId, aId, force); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message,truckBusy:e.data?.truckBusy,busyFreightCode:e.data?.busyFreightCode}; } },[refresh]);
  const confirmTripLoaded = useCallback(async (fId, aId, loadedTons)=>{ try { await apiConfirmTripLoaded(fId, aId, loadedTons); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmTripFinished = useCallback(async (fId, aId)=>{ try { await apiConfirmTripFinished(fId, aId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  return { freights, loading, loadingMore, error, hasMore, total, statusCounts, fetchAll, loadMore, refresh, refreshLight, create, assign, respond, start, finish, cancel, confirmLoaded, confirmFinished, authorize, approveProducer, update, assignMulti, assignTruckCb, cancelAssignment, updateAssignment, respondTrip, startTrip, confirmTripLoaded, confirmTripFinished };
}
