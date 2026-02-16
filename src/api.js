// =====================================================================
// TOLVINK — API Client v6 (with Admin endpoints)
// =====================================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://tolvink-api-production.up.railway.app/api';
const SUPABASE_URL = 'https://mlmecljidioymujsazrs.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbWVjbGppZGlveW11anNhenJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTE2MTYsImV4cCI6MjA4NjY4NzYxNn0.0y0jNN9CcbzfDNOQZqDnjAR8as14dUZ4yQvnJeaYnNM';
const STORAGE_BUCKET = 'freight-docs';

let _token = localStorage.getItem('tolvink_token');
let _onAuthFail = null;
let _isLoggingIn = false;

export function setToken(t) { _token = t; if(t) localStorage.setItem('tolvink_token',t); else localStorage.removeItem('tolvink_token'); }
export function getToken() { return _token; }
export function clearAuth() {
  console.log('[API] Clearing auth');
  _token=null;
  localStorage.removeItem('tolvink_token');
  localStorage.removeItem('tolvink_user');
}
export function setAuthFailHandler(fn) { _onAuthFail = fn; }
export function saveUser(u) { localStorage.setItem('tolvink_user', JSON.stringify(u)); }
export function getSavedUser() { try { const r=localStorage.getItem('tolvink_user'); return r?JSON.parse(r):null; } catch { return null; } }
export function setLoggingIn(val) { _isLoggingIn = val; }

class ApiError extends Error {
  constructor(s,d) { super(d?.message||d?.error||'Error del servidor'); this.status=s; this.data=d; }
}

export default async function api(path, opts={}) {
  const { body, method=body?'POST':'GET', headers={} } = opts;
  const cfg = { method, headers: { 'Content-Type':'application/json', ...(_token?{Authorization:`Bearer ${_token}`}:{}), ...headers } };
  if(body) cfg.body = JSON.stringify(body);

  console.log(`[API] ${method} ${path}`, { hasToken: !!_token, isLoggingIn: _isLoggingIn });

  const res = await fetch(`${API_URL}${path}`, cfg);

  // Only trigger auth fail if NOT during login/register
  if(res.status===401 && !_isLoggingIn) {
    console.error('[API] 401 Unauthorized - clearing auth');
    clearAuth();
    if(_onAuthFail) _onAuthFail();
    throw new ApiError(401,{message:'Sesión expirada'});
  }

  let data;
  try {
    data = await res.json();
  } catch {
    if(!res.ok) throw new ApiError(res.status,{message:'Error del servidor'});
    return null;
  }

  if(!res.ok) throw new ApiError(res.status, data);

  console.log(`[API] ${method} ${path} - OK`);
  return data;
}

// Auth
export async function apiLogin(identifier,password) {
  setLoggingIn(true);
  try {
    const isPhone = /^09[1-9]\d{6}$/.test(identifier.replace(/[\s\-()]/g,''));
    const body = isPhone ? { phone:identifier.replace(/[\s\-()]/g,''), password } : { email:identifier, password };
    const d=await api('/auth/login',{body});

    if(!d || !d.access_token || !d.user) {
      throw new Error('Respuesta inválida del servidor');
    }

    setToken(d.access_token);
    saveUser(d.user);
    console.log('[API] Login successful, token and user saved');
    return d;
  } finally {
    setLoggingIn(false);
  }
}

export async function apiRegister(b) {
  setLoggingIn(true);
  try {
    const d=await api('/auth/register',{body:b});

    if(!d || !d.access_token || !d.user) {
      throw new Error('Respuesta inválida del servidor');
    }

    setToken(d.access_token);
    saveUser(d.user);
    console.log('[API] Register successful, token and user saved');
    return d;
  } finally {
    setLoggingIn(false);
  }
}

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
export async function apiAuthorizeFreight(id) { return api(`/freights/${id}/authorize`,{body:{}}); }

// Tracking
export async function apiSendTracking(id, data) { return api(`/freights/${id}/tracking`,{body:data}); }
export async function apiGetTracking(id) { return api(`/freights/${id}/tracking`); }
export async function apiGetLastPosition(id) { return api(`/freights/${id}/tracking/last`); }

// Audit
export async function apiGetAuditLog(id) { return api(`/freights/${id}/audit`); }

// Update freight (pending only)
export async function apiUpdateFreight(id, data) { return api(`/freights/${id}`,{method:"PATCH",body:data}); }

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
export async function apiUpdateField(id, b) { return api(`/fields/${id}`,{method:'PATCH',body:b}); }
export async function apiGetFieldLots(fieldId) { return api(`/fields/${fieldId}/lots`); }
export async function apiCreateLot(fieldId,b) { return api(`/fields/${fieldId}/lots`,{body:b}); }
export async function apiUpdateLot(fieldId, lotId, b) { return api(`/fields/${fieldId}/lots/${lotId}`,{method:'PATCH',body:b}); }

// Plant-Producer Access
export async function apiGrantAccess(b) { return api('/plant-access/grant',{body:b}); }
export async function apiRevokeAccess(prodId) { return api(`/plant-access/revoke/${prodId}`,{body:{},method:'PATCH'}); }
export async function apiListAccessProducers() { return api('/plant-access/producers'); }
export async function apiListAccessPlants() { return api('/plant-access/plants'); }
export async function apiSearchProducer(phone) { return api(`/plant-access/search-producer?phone=${encodeURIComponent(phone)}`); }
export async function apiGetMyFacilities() { return api('/plant-access/my-facilities'); }

// Catalog - Branches
export async function apiGetBranches() { return api('/catalog/branches'); }

// Conversations
export async function apiSearchCompanies(q) { return api(`/conversations/search-companies?q=${encodeURIComponent(q)}`); }
export async function apiStartConversation(b) { return api('/conversations/start',{body:b}); }
export async function apiListConversations(search) { const q=search?`?search=${encodeURIComponent(search)}`:''; return api(`/conversations${q}`); }
export async function apiGetMessages(convId) { return api(`/conversations/${convId}/messages`); }
export async function apiSendMessage(convId,text) { return api(`/conversations/${convId}/messages`,{body:{text}}); }

// Documents
export async function apiAddDocument(freightId, body) { return api(`/freights/${freightId}/documents`,{body}); }

// ======================== ADMIN ======================================
// Stats
export async function apiAdminStats() { return api('/admin/stats'); }
// Companies
export async function apiAdminListCompanies(search) { const q=search?`?search=${encodeURIComponent(search)}`:''; return api(`/admin/companies${q}`); }
export async function apiAdminGetCompany(id) { return api(`/admin/companies/${id}`); }
export async function apiAdminCreateCompany(b) { return api('/admin/companies',{body:b}); }
export async function apiAdminUpdateCompany(id,b) { return api(`/admin/companies/${id}`,{method:'PATCH',body:b}); }
// Branches
export async function apiAdminListBranches(companyId) { return api(`/admin/branches/${companyId}`); }
export async function apiAdminCreateBranch(b) { return api('/admin/branches',{body:b}); }
export async function apiAdminUpdateBranch(id,b) { return api(`/admin/branches/${id}`,{method:'PATCH',body:b}); }
export async function apiAdminDeleteBranch(id) { return api(`/admin/branches/${id}`,{method:'DELETE'}); }
// Users
export async function apiAdminListUsers(search, companyId) {
  const p=new URLSearchParams();
  if(search)p.set('search',search);
  if(companyId)p.set('companyId',companyId);
  const q=p.toString(); return api(`/admin/users${q?`?${q}`:''}`);
}
export async function apiAdminCreateUser(b) { return api('/admin/users',{body:b}); }
export async function apiAdminUpdateUser(id,b) { return api(`/admin/users/${id}`,{method:'PATCH',body:b}); }
// Self-edit
export async function apiUpdateMe(b) { return api('/admin/me',{method:'PATCH',body:b}); }
// Fields (Producer)
export async function apiAdminListFields(companyId) { return api(`/admin/companies/${companyId}/fields`); }
export async function apiAdminCreateField(companyId, b) { return api(`/admin/companies/${companyId}/fields`,{body:b}); }
export async function apiAdminUpdateField(id, b) { return api(`/admin/fields/${id}`,{method:'PATCH',body:b}); }
export async function apiAdminDeleteField(id) { return api(`/admin/fields/${id}`,{method:'DELETE'}); }
// Lots (Inside Fields)
export async function apiAdminListLots(fieldId) { return api(`/admin/fields/${fieldId}/lots`); }
export async function apiAdminCreateLot(fieldId, b) { return api(`/admin/fields/${fieldId}/lots`,{body:b}); }
export async function apiAdminUpdateLot(id, b) { return api(`/admin/lots/${id}`,{method:'PATCH',body:b}); }
export async function apiAdminDeleteLot(id) { return api(`/admin/lots/${id}`,{method:'DELETE'}); }
// Trucks (Transporter)
export async function apiAdminListTrucks(companyId) { return api(`/admin/companies/${companyId}/trucks`); }
export async function apiAdminCreateTruck(companyId, b) { return api(`/admin/companies/${companyId}/trucks`,{body:b}); }
export async function apiAdminUpdateTruck(id, b) { return api(`/admin/trucks/${id}`,{method:'PATCH',body:b}); }
export async function apiAdminDeleteTruck(id) { return api(`/admin/trucks/${id}`,{method:'DELETE'}); }

// Photo Upload — direct to Supabase Storage (public bucket)
export async function uploadPhoto(file, freightId, step) {
  const ext = file.name?.split('.').pop() || 'jpg';
  const path = `${freightId}/${step}/${Date.now()}.${ext}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  const headers = { 'Content-Type': file.type || 'image/jpeg' };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body: file });

  if (!res.ok) {
    let errMsg = 'Error al subir foto';
    try { const d = await res.json(); errMsg = d.message || d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

// Chat file upload
export async function uploadChatFile(file, conversationId) {
  const ext = file.name?.split('.').pop() || 'bin';
  const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || `file.${ext}`;
  const path = `chat/${conversationId}/${Date.now()}_${safeName}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  const headers = { 'Content-Type': file.type || 'application/octet-stream' };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body: file });

  if (!res.ok) {
    let errMsg = 'Error al subir archivo';
    try { const d = await res.json(); errMsg = d.message || d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}
