// =====================================================================
// TOLVINK — API Client v4
// =====================================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://tolvink-api-production.up.railway.app/api';
const SUPABASE_URL = 'https://mlmecljidioymujsazrs.supabase.co';
const STORAGE_BUCKET = 'freight-docs';

let _token = localStorage.getItem('tolvink_token');
let _onAuthFail = null;

export function setToken(t) { _token = t; if(t) localStorage.setItem('tolvink_token',t); else localStorage.removeItem('tolvink_token'); }
export function getToken() { return _token; }
export function clearAuth() { _token=null; localStorage.removeItem('tolvink_token'); localStorage.removeItem('tolvink_user'); }
export function setAuthFailHandler(fn) { _onAuthFail = fn; }
export function saveUser(u) { localStorage.setItem('tolvink_user', JSON.stringify(u)); }
export function getSavedUser() { try { const r=localStorage.getItem('tolvink_user'); return r?JSON.parse(r):null; } catch { return null; } }

class ApiError extends Error {
  constructor(s,d) { super(d?.message||d?.error||'Error del servidor'); this.status=s; this.data=d; }
}

export default async function api(path, opts={}) {
  const { body, method=body?'POST':'GET', headers={} } = opts;
  const cfg = { method, headers: { 'Content-Type':'application/json', ...(_token?{Authorization:`Bearer ${_token}`}:{}), ...headers } };
  if(body) cfg.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, cfg);
  if(res.status===401) { clearAuth(); if(_onAuthFail) _onAuthFail(); throw new ApiError(401,{message:'Sesión expirada'}); }
  let data; try { data = await res.json(); } catch { if(!res.ok) throw new ApiError(res.status,{message:'Error del servidor'}); return null; }
  if(!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Auth
export async function apiLogin(email,password) { const d=await api('/auth/login',{body:{email,password}}); setToken(d.access_token); saveUser(d.user); return d; }
export async function apiRegister(b) { const d=await api('/auth/register',{body:b}); setToken(d.access_token); saveUser(d.user); return d; }
export function apiLogout() { clearAuth(); }

// Freights
export async function apiListFreights(q={}) { const p=new URLSearchParams(); if(q.status)p.set('status',q.status); if(q.page)p.set('page',String(q.page)); if(q.limit)p.set('limit',String(q.limit)); const qs=p.toString(); return api(`/freights${qs?`?${qs}`:''}`); }
export async function apiGetFreight(id) { return api(`/freights/${id}`); }
export async function apiCreateFreight(b) { return api('/freights',{body:b}); }
export async function apiAssignFreight(id,b) { return api(`/freights/${id}/assign`,{body:b}); }
export async function apiRespondFreight(id,b) { return api(`/freights/${id}/respond`,{body:b}); }
export async function apiStartFreight(id) { return api(`/freights/${id}/start`,{body:{}}); }
export async function apiFinishFreight(id) { return api(`/freights/${id}/finish`,{body:{}}); }
export async function apiCancelFreight(id,reason) { return api(`/freights/${id}/cancel`,{body:{reason}}); }
export async function apiConfirmLoaded(id) { return api(`/freights/${id}/confirm-loaded`,{body:{}}); }
export async function apiConfirmFinished(id) { return api(`/freights/${id}/confirm-finished`,{body:{}}); }

// Catalog
export async function apiGetPlants() { return api('/catalog/plants'); }
export async function apiGetLots() { return api('/catalog/lots'); }
export async function apiGetTransportCompanies() { return api('/catalog/transport-companies'); }

// Trucks
export async function apiGetTrucks() { return api('/trucks'); }
export async function apiCreateTruck(b) { return api('/trucks',{body:b}); }
export async function apiDeactivateTruck(id) { return api(`/trucks/${id}/deactivate`,{body:{},method:'PATCH'}); }

// Fields & Lots
export async function apiGetFields() { return api('/fields'); }
export async function apiCreateField(b) { return api('/fields',{body:b}); }
export async function apiGetFieldLots(fieldId) { return api(`/fields/${fieldId}/lots`); }
export async function apiCreateLot(fieldId,b) { return api(`/fields/${fieldId}/lots`,{body:b}); }

// Plant-Producer Access
export async function apiGrantAccess(b) { return api('/plant-access/grant',{body:b}); }
export async function apiRevokeAccess(prodId) { return api(`/plant-access/revoke/${prodId}`,{body:{},method:'PATCH'}); }
export async function apiListAccessProducers() { return api('/plant-access/producers'); }
export async function apiListAccessPlants() { return api('/plant-access/plants'); }

// Conversations
export async function apiStartConversation(b) { return api('/conversations/start',{body:b}); }
export async function apiListConversations() { return api('/conversations'); }
export async function apiGetMessages(convId) { return api(`/conversations/${convId}/messages`); }
export async function apiSendMessage(convId,text) { return api(`/conversations/${convId}/messages`,{body:{text}}); }

// Photo Upload — direct to Supabase Storage
export async function uploadPhoto(file, freightId, step) {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${freightId}/${step}/${Date.now()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${_token}`,
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  });
  if (!res.ok) {
    // Try with anon key approach (public bucket)
    const res2 = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
      body: file,
    });
    if (!res2.ok) throw new Error('Error al subir foto');
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}
