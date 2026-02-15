// =====================================================================
// TOLVINK — API Client
// =====================================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://tolvink-api-production.up.railway.app/api';

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

export async function apiLogin(email,password) { const d=await api('/auth/login',{body:{email,password}}); setToken(d.access_token); saveUser(d.user); return d; }
export async function apiRegister(b) { const d=await api('/auth/register',{body:b}); setToken(d.access_token); saveUser(d.user); return d; }
export function apiLogout() { clearAuth(); }
export async function apiListFreights(q={}) { const p=new URLSearchParams(); if(q.status)p.set('status',q.status); if(q.page)p.set('page',String(q.page)); if(q.limit)p.set('limit',String(q.limit)); const qs=p.toString(); return api(`/freights${qs?`?${qs}`:''}`); }
export async function apiGetFreight(id) { return api(`/freights/${id}`); }
export async function apiCreateFreight(b) { return api('/freights',{body:b}); }
export async function apiAssignFreight(id,b) { return api(`/freights/${id}/assign`,{body:b}); }
export async function apiRespondFreight(id,b) { return api(`/freights/${id}/respond`,{body:b}); }
export async function apiStartFreight(id) { return api(`/freights/${id}/start`,{body:{}}); }
export async function apiFinishFreight(id) { return api(`/freights/${id}/finish`,{body:{}}); }
export async function apiCancelFreight(id,reason) { return api(`/freights/${id}/cancel`,{body:{reason}}); }
export async function apiGetPlants() { return api('/catalog/plants'); }
export async function apiGetLots() { return api('/catalog/lots'); }
export async function apiGetTransportCompanies() { return api('/catalog/transport-companies'); }
export async function apiGetTrucks() { return api('/trucks'); }
export async function apiConfirmLoaded(id) { return api(`/freights/${id}/confirm-loaded`,{body:{}}); }
export async function apiConfirmFinished(id) { return api(`/freights/${id}/confirm-finished`,{body:{}}); }
