// =====================================================================
// TOLVINK — API Client v8 (HttpOnly Cookies)
// =====================================================================

import { captureError } from "./sentry";

export const API_URL = import.meta.env.VITE_API_URL || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

if (!API_URL) console.error('[Tolvink] VITE_API_URL not set — API calls will fail');
if (!SUPABASE_URL) console.error('[Tolvink] VITE_SUPABASE_URL not set — uploads will fail');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const STORAGE_BUCKET = 'freight-docs';

let _onAuthFail = null;
let _isLoggingIn = false;
let _refreshPromise = null;

// User object stays in localStorage (not sensitive)
export function clearAuth() {
  localStorage.removeItem('tolvink_user');
  // Clean up legacy token storage if present
  localStorage.removeItem('tolvink_token');
  localStorage.removeItem('tolvink_refresh_token');
  // Clear offline queue to prevent stale data leaking across sessions
  import('./store.js').then(m => m.offlineQueue?.clear?.()).catch(e => { console.warn('Failed to clear offline queue on logout:', e); });
}
export function setAuthFailHandler(fn) { _onAuthFail = fn; }
export function saveUser(u) {
  // Strip sensitive/internal fields before persisting to localStorage
  if (!u) return;
  const { passwordHash, refreshTokens, ...safe } = u;
  localStorage.setItem('tolvink_user', JSON.stringify(safe));
}
export function getSavedUser() { try { const r=localStorage.getItem('tolvink_user'); return r?JSON.parse(r):null; } catch { return null; } }
export function setLoggingIn(val) { _isLoggingIn = val; }

// legacy no-op — kept for backward compat (imported by tests)
export function setToken() {}
export function getToken() { return null; }
export function setRefreshToken() {}

class ApiError extends Error {
  constructor(s,d) {
    super(d?.message||d?.error||'Error del servidor');
    this.status=s; this.data=d;
    if (s >= 500) {
      try { captureError(this, { status: s, data: d }); } catch {}
    }
  }
}

// Silent token refresh via HttpOnly cookie (sent automatically)
async function tryRefresh() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearAuth();
          if (_onAuthFail) _onAuthFail();
        }
        return false;
      }
      const data = await res.json();
      saveUser(data.user);
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

export default async function api(path, opts={}) {
  const { body, method=body?'POST':'GET', headers={}, signal } = opts;

  const doFetch = () => {
    const cfg = { method, credentials: 'include', headers: { 'Content-Type':'application/json', ...headers } };
    if(body) cfg.body = JSON.stringify(body);
    if(signal) cfg.signal = signal;
    return fetch(`${API_URL}${path}`, cfg);
  };

  let res = await doFetch();

  // On 401 — try silent refresh before failing
  if(res.status===401 && !_isLoggingIn) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        res = await doFetch(); // Retry with new cookie
      } catch (retryErr) {
        // Network error on retry — force logout if online
        if (navigator.onLine) { clearAuth(); if(_onAuthFail) _onAuthFail(); }
        throw retryErr;
      }
    }
    if (res.status===401) {
      // Only force logout if online — offline failures should not clear session
      if (navigator.onLine) { clearAuth(); if(_onAuthFail) _onAuthFail(); }
      throw new ApiError(401,{message:'Sesión expirada'});
    }
  }

  // After a successful mutation, clear SW API cache so subsequent GETs return fresh data
  if (method !== 'GET' && res.ok) {
    caches.open('tolvink-api-v2').then(c => c.keys().then(keys => keys.forEach(k => c.delete(k)))).catch(() => {});
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status,{message: res.ok ? 'Respuesta inesperada del servidor' : 'Error del servidor'});
  }

  if(!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Auth
export async function apiLogin(identifier, password) {
  setLoggingIn(true);
  try {
    const isPhone = /^09\d{7}$/.test(identifier.replace(/[\s\-()]/g,''));
    const reqBody = isPhone ? { phone:identifier.replace(/[\s\-()]/g,''), password } : { email:identifier, password };
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.headers.get('X-Auth-Hint') === 'no-password') {
        const err = new ApiError(res.status, d || { message: 'Credenciales inválidas' });
        err._noPassword = true;
        throw err;
      }
      throw new ApiError(res.status, d || { message: 'Error del servidor' });
    }

    if(!d || !d.user) {
      throw new Error('Respuesta inválida del servidor');
    }

    saveUser(d.user);
    return d;
  } finally {
    setLoggingIn(false);
  }
}

export async function apiRegister(b) {
  setLoggingIn(true);
  try {
    const d=await api('/auth/register',{body:b});

    if(!d || !d.user) {
      throw new Error('Respuesta inválida del servidor');
    }

    saveUser(d.user);
    return d;
  } finally {
    setLoggingIn(false);
  }
}

export async function apiLogout() {
  try { await api('/auth/logout', { body: {}, method: 'POST' }); } catch (e) {
    console.warn("Logout API failed:", e?.message || e);
  }
  clearAuth();
}

// Password reset via WhatsApp
export async function apiIdentifyForReset(identifier) {
  return api('/auth/identify-for-reset', { body: { identifier } });
}
export async function apiRequestCode(identifier, phone) {
  return api('/auth/request-code', { body: { identifier, phone } });
}
export async function apiVerifyCode(phone, code) {
  return api('/auth/verify-code', { body: { phone, code } });
}
export async function apiResetPassword(resetToken, newPassword) {
  const d = await api('/auth/reset-password', { body: { resetToken, newPassword } });
  if (d?.user) saveUser(d.user);
  return d;
}
export async function apiChangePassword(currentPassword, newPassword) {
  return api('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } });
}

// Switch active company
export async function apiSwitchCompany(companyId) {
  const d = await api('/auth/switch-company', { body: { companyId } });
  if (d?.user) saveUser(d.user);
  return d;
}

// Get my companies
export async function apiGetMyCompanies() { return api('/auth/me/companies'); }

// Freights
export async function apiListFreights(q={}) {
  const p = new URLSearchParams();
  if (q.status) p.set('status', q.status);
  if (q.page) p.set('page', String(q.page));
  if (q.limit) p.set('limit', String(q.limit));
  if (q.company) p.set('company', q.company);
  if (q.search) p.set('search', q.search);
  if (q.destName) p.set('destName', q.destName);
  if (q.originCompany) p.set('originCompany', q.originCompany);
  if (q.transporter) p.set('transporter', q.transporter);
  if (q.dateFrom) p.set('dateFrom', q.dateFrom);
  if (q.dateTo) p.set('dateTo', q.dateTo);
  const qs = p.toString();
  return api(`/freights${qs ? `?${qs}` : ''}`);
}
export async function apiSearchFreights(search, page=1) { return apiListFreights({ search, limit: 25, page }); }
export async function apiGetFreightStats(from, to, groupBy) { const p = new URLSearchParams(); if(from) p.set('from',from); if(to) p.set('to',to); if(groupBy) p.set('groupBy',groupBy); return api(`/freights/stats?${p}`); }
export async function apiGetFreight(id) { return api(`/freights/${id}`); }
export async function apiGetFreightSummary(id) { return api(`/freights/${id}/summary`); }
export async function apiGetFreightDetailExtra(id) { return api(`/freights/${id}/detail-extra`); }
export async function apiCreateFreight(b) { return api('/freights',{body:b}); }
export async function apiAssignFreight(id,b) { return api(`/freights/${id}/assign`,{body:b}); }
export async function apiRespondFreight(id,b) { return api(`/freights/${id}/respond`,{body:b}); }
export async function apiStartFreight(id) { return api(`/freights/${id}/start`,{body:{}}); }
export async function apiFinishFreight(id) { return api(`/freights/${id}/finish`,{body:{}}); }
export async function apiCancelFreight(id,reason) { return api(`/freights/${id}/cancel`,{body:{reason}}); }
export async function apiConfirmLoaded(id, loadedTons) { return api(`/freights/${id}/confirm-loaded`,{body:{loadedTons}}); }
export async function apiConfirmFinished(id) { return api(`/freights/${id}/confirm-finished`,{body:{}}); }
export async function apiAuthorizeFreight(id) { return api(`/freights/${id}/authorize`,{body:{}}); }
export async function apiGetAssignmentSuggestions(id) { return api(`/freights/${id}/assignment-suggestions`); }

// Multi-truck (v6.0)
export async function apiAssignMultiTruck(id, trucks) { return api(`/freights/${id}/assign-multi`,{body:{trucks}}); }
export async function apiAssignTruck(id, truckData) { return api(`/freights/${id}/assign-truck`,{body:truckData}); }
export async function apiCancelAssignment(freightId, assignmentId, reason) { return api(`/freights/${freightId}/assignments/${assignmentId}/cancel`,{body:{reason}}); }
export async function apiUpdateAssignment(freightId, assignmentId, data) { return api(`/freights/${freightId}/assignments/${assignmentId}`,{method:'PATCH',body:data}); }
export async function apiRespondTrip(freightId, assignmentId, body) { return api(`/freights/${freightId}/assignments/${assignmentId}/respond`,{body}); }
export async function apiStartTrip(freightId, assignmentId) { return api(`/freights/${freightId}/assignments/${assignmentId}/start`,{body:{}}); }
export async function apiConfirmTripLoaded(freightId, assignmentId, loadedTons) { return api(`/freights/${freightId}/assignments/${assignmentId}/confirm-loaded`,{body:{loadedTons}}); }
export async function apiConfirmTripFinished(freightId, assignmentId) { return api(`/freights/${freightId}/assignments/${assignmentId}/confirm-finished`,{body:{}}); }

// Weigh Tickets
export async function apiGetWeighTickets(freightId, type) { const q=type?`?type=${type}`:''; return api(`/freights/${freightId}/weigh-tickets${q}`); }
export async function apiCreateWeighTicket(freightId, data) { return api(`/freights/${freightId}/weigh-tickets`,{body:data}); }
export async function apiUpdateWeighTicket(freightId, ticketId, data) { return api(`/freights/${freightId}/weigh-tickets/${ticketId}`,{method:'PATCH',body:data}); }
export async function apiDeleteWeighTicket(freightId, ticketId) { return api(`/freights/${freightId}/weigh-tickets/${ticketId}`,{method:'DELETE'}); }
export async function apiRunWeighTicketOcr(freightId, ticketId) { return api(`/freights/${freightId}/weigh-tickets/${ticketId}/ocr`,{body:{}}); }

// Tracking
export async function apiSendTracking(id, data) { return api(`/freights/${id}/tracking`,{body:data}); }
export async function apiGetTracking(id) { return api(`/freights/${id}/tracking`); }
export async function apiGetLastPosition(id) { return api(`/freights/${id}/tracking/last`); }
export async function apiGetParticipantPositions(id) { return api(`/freights/${id}/tracking/participants`); }

// Audit
export async function apiGetAuditLog(id) { return api(`/freights/${id}/audit`); }

// SSE ticket (avoids JWT in URL)
export async function apiGetSseTicket() { return api('/sse/ticket', { method: 'POST' }); }

// Update freight
export async function apiUpdateFreight(id, data) { return api(`/freights/${id}`,{method:"PATCH",body:data}); }
export async function apiApprovePendingChange(freightId, changeId) { return api(`/freights/${freightId}/pending-changes/${changeId}/approve`,{body:{}}); }
export async function apiRejectPendingChange(freightId, changeId) { return api(`/freights/${freightId}/pending-changes/${changeId}/reject`,{body:{}}); }

// Catalog
export async function apiGetPlants() { return api('/catalog/plants'); }
export async function apiGetLots() { return api('/catalog/lots'); }
export async function apiGetTransportCompanies() { return api('/catalog/transport-companies'); }
export async function apiGetCatalogAll() { return api('/catalog/all'); }

// Trucks
export async function apiGetTrucks(companyId) { return api(companyId ? `/trucks?companyId=${encodeURIComponent(companyId)}` : '/trucks'); }
export async function apiCreateTruck(b) { return api('/trucks',{body:b}); }
export async function apiDeactivateTruck(id) { return api(`/trucks/${id}/deactivate`,{body:{},method:'PATCH'}); }

// Drivers (choferes)
export async function apiGetDrivers(companyId) { return api(companyId ? `/freights/drivers?companyId=${encodeURIComponent(companyId)}` : '/freights/drivers'); }
export async function apiGetDriverQueue(driverId) { return api(`/freights/drivers/${driverId}/queue`); }
export async function apiReorderDriverQueue(driverId, orderedFreightIds) { return api(`/freights/drivers/${driverId}/reorder`,{body:{orderedFreightIds}}); }
export async function apiListDrivers() { return api('/trucks/drivers'); }
export async function apiCreateDriver(b) { return api('/trucks/drivers',{body:b}); }
export async function apiDeactivateDriver(id) { return api(`/trucks/drivers/${id}/deactivate`,{body:{},method:'PATCH'}); }

// Fields & Lots
export async function apiGetFields() { return api('/fields'); }
export async function apiCreateField(b) { return api('/fields',{body:b}); }
export async function apiUpdateField(id, b) { return api(`/fields/${id}`,{method:'PATCH',body:b}); }
export async function apiGetFieldLots(fieldId) { return api(`/fields/${fieldId}/lots`); }
export async function apiCreateLot(fieldId,b) { return api(`/fields/${fieldId}/lots`,{body:b}); }
export async function apiUpdateLot(fieldId, lotId, b) { return api(`/fields/${fieldId}/lots/${lotId}`,{method:'PATCH',body:b}); }
export async function apiImportParseLinks(text) { return api('/fields/import-links', { body: { text } }); }
export async function apiImportGoogleList(url) { return api('/fields/import-google-list', { body: { url } }); }
export async function apiImportConfirm(locations) { return api('/fields/import-confirm', { body: { locations } }); }
export async function apiGetPois() { return api('/fields/pois'); }
export async function apiCreatePoi(b) { return api('/fields/pois', { body: b }); }
export async function apiUpdatePoi(id, b) { return api(`/fields/pois/${id}`, { method: 'PATCH', body: b }); }
export async function apiDeletePoi(id) { return api(`/fields/pois/${id}/delete`, { method: 'PATCH' }); }
export async function apiSharePoi(poiId, sharedWithUserId) { return api(`/fields/pois/${poiId}/share`, { body: { sharedWithUserId } }); }
export async function apiUnsharePoi(poiId, sharedWithUserId) { return api(`/fields/pois/${poiId}/unshare`, { method: 'PATCH', body: { sharedWithUserId } }); }
export async function apiGetPoiShares(poiId) { return api(`/fields/pois/${poiId}/shares`); }
export async function apiReclassifyPoi(poiId, body) { return api(`/fields/pois/${poiId}/reclassify`, { body }); }
export async function apiSearchUsersForShare(q) { return api(`/fields/pois/search-users?q=${encodeURIComponent(q)}`); }

// Fields — share/delete
export async function apiShareField(fieldId, sharedWithUserId) { return api(`/fields/${fieldId}/share`, { body: { sharedWithUserId } }); }
export async function apiUnshareField(fieldId, sharedWithUserId) { return api(`/fields/${fieldId}/unshare`, { method: 'PATCH', body: { sharedWithUserId } }); }
export async function apiGetFieldShares(fieldId) { return api(`/fields/${fieldId}/shares`); }
export async function apiDeleteField(fieldId) { return api(`/fields/${fieldId}/delete`, { method: 'PATCH' }); }

// Lots — share/delete
export async function apiShareLot(fieldId, lotId, sharedWithUserId) { return api(`/fields/${fieldId}/lots/${lotId}/share`, { body: { sharedWithUserId } }); }
export async function apiUnshareLot(fieldId, lotId, sharedWithUserId) { return api(`/fields/${fieldId}/lots/${lotId}/unshare`, { method: 'PATCH', body: { sharedWithUserId } }); }
export async function apiGetLotShares(fieldId, lotId) { return api(`/fields/${fieldId}/lots/${lotId}/shares`); }
export async function apiDeleteLot(fieldId, lotId) { return api(`/fields/${fieldId}/lots/${lotId}/delete`, { method: 'PATCH' }); }

// Plant-Producer Access
export async function apiGrantAccess(b) { return api('/plant-access/grant',{body:b}); }
export async function apiRevokeAccess(prodId) { return api(`/plant-access/revoke/${prodId}`,{body:{},method:'PATCH'}); }
export async function apiListAccessProducers(plantCompanyId, producerCompanyId) { const p=new URLSearchParams(); if(plantCompanyId)p.set('plantCompanyId',plantCompanyId); if(producerCompanyId)p.set('producerCompanyId',producerCompanyId); const q=p.toString(); return api(`/plant-access/producers${q?`?${q}`:''}`); }
export async function apiListAccessPlants() { return api('/plant-access/plants'); }
export async function apiSearchProducer(q, type) { const p=new URLSearchParams(); p.set('q',q); if(type)p.set('type',type); return api(`/plant-access/search-producer?${p.toString()}`); }
export async function apiSearchCompany(q, type) { const p=new URLSearchParams(); p.set('q',q); if(type)p.set('type',type); return api(`/plant-access/search-company?${p.toString()}`); }
export async function apiGetMyFacilities(plantCompanyId) { const q=plantCompanyId?`?plantCompanyId=${encodeURIComponent(plantCompanyId)}`:''; return api(`/plant-access/my-facilities${q}`); }
export async function apiListPlantCompanies() { return api('/plant-access/plant-companies'); }

// Catalog - Branches
export async function apiGetBranches() { return api('/catalog/branches'); }

// Conversations
export async function apiSearchUsers(q) { return api(`/conversations/search-users?q=${encodeURIComponent(q)}`); }
export async function apiStartConversation(b) { return api('/conversations/start',{body:b}); }
export async function apiListConversations(search) { const q=search?`?search=${encodeURIComponent(search)}`:''; return api(`/conversations${q}`); }
export async function apiGetMessages(convId, opts={}) { const p=new URLSearchParams(); if(opts.take)p.set('take',String(opts.take)); if(opts.before)p.set('before',opts.before); const qs=p.toString(); return api(`/conversations/${convId}/messages${qs?`?${qs}`:''}`); }
export async function apiSendMessage(convId,text) { return api(`/conversations/${convId}/messages`,{body:{text}}); }
export async function apiMarkRead(convId) { return api(`/conversations/${convId}/read`,{method:'PATCH',body:{}}); }
export async function apiTyping(convId) { return api(`/conversations/${convId}/typing`,{body:{}}); }
export async function apiPinConversation(convId) { return api(`/conversations/${convId}/pin`,{method:'PATCH',body:{}}); }
export async function apiToggleMarkUnread(convId) { return api(`/conversations/${convId}/mark-unread`,{method:'PATCH',body:{}}); }

// Documents
export async function apiAddDocument(freightId, body) { return api(`/freights/${freightId}/documents`,{body}); }
export async function apiDeleteDocument(freightId, docId) { return api(`/freights/${freightId}/documents/${docId}`,{method:'DELETE'}); }

// OCR
export async function apiOcrAnalyze(url, docType) { return api('/ocr/analyze', { body: { url, ...(docType ? { docType } : {}) } }); }
export async function apiSaveOcrData(freightId, docId, ocrData) { return api(`/freights/${freightId}/documents/${docId}/ocr`, { method:'PATCH', body: { ocrData } }); }

// ======================== ADMIN ======================================
// Stats
export async function apiAdminStats() { return api('/admin/stats'); }
export async function apiAdminActivity(page=1, limit=20) { return api(`/admin/activity?page=${page}&limit=${limit}`); }
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
export async function apiAdminAddUserCompany(userId,companyId,role) { return api(`/admin/users/${userId}/companies`,{body:{companyId,role}}); }
export async function apiAdminUpdateUserCompany(userId,companyId,role) { return api(`/admin/users/${userId}/companies/${companyId}`,{method:'PATCH',body:{role}}); }
export async function apiAdminRemoveUserCompany(userId,companyId) { return api(`/admin/users/${userId}/companies/${companyId}`,{method:'DELETE'}); }
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

// Bulk import
export async function apiAdminImportCompanies(companies) { return api('/admin/import/companies',{method:'POST',body:{companies}}); }
export async function apiAdminImportUsers(users) { return api('/admin/import/users',{method:'POST',body:{users}}); }

// Notifications
export async function apiGetNotifications() { return api('/notifications'); }
export async function apiMarkNotificationRead(id) { return api(`/notifications/${id}/read`,{method:'PATCH',body:{}}); }
export async function apiMarkAllRead() { return api('/notifications/read-all',{method:'PATCH',body:{}}); }
export async function apiSubscribePush(subscription) { return api('/notifications/subscribe',{body:subscription}); }
export async function apiUnsubscribePush(endpoint) { return api('/notifications/subscribe',{method:'DELETE',body:{endpoint}}); }

// VAPID public key for push subscription
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Image compression — resize large images and reduce quality before upload
function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Skip if already smaller than maxWidth AND under 500KB
      if (img.width <= maxWidth && file.size < 500 * 1024) { resolve(file); return; }
      const ratio = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name || 'image.jpg', { type: blob.type, lastModified: Date.now() });
          resolve(compressed);
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al procesar imagen')); };
    img.src = url;
  });
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Photo Upload — direct to Supabase Storage (public bucket)
export async function uploadPhoto(file, freightId, step) {
  if (file.size > MAX_UPLOAD_SIZE) throw new Error('El archivo excede el tamaño máximo de 10MB');
  // Compress image before upload
  const processed = file.type.startsWith('image/') ? await compressImage(file).catch(() => file) : file;
  const ext = (processed.name?.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const SAFE_EXTS = new Set(['jpg','jpeg','png','webp','gif','pdf','doc','docx','xlsx','heic','heif']);
  const SAFE_MIMES = new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
  if (!SAFE_EXTS.has(ext) || (processed.type && !SAFE_MIMES.has(processed.type))) throw new Error('Tipo de archivo no permitido');
  const safeId = String(freightId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeStep = String(step).replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `${safeId}/${safeStep}/${Date.now()}.${ext}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  const headers = { 'Content-Type': processed.type || 'image/jpeg' };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body: processed });

  if (!res.ok) {
    let errMsg = 'Error al subir foto';
    try { const d = await res.json(); errMsg = d.message || d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

// Supabase Image Transform — returns thumbnail URL for storage images
export function thumb(url, size = 96) {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  return url.replace('/storage/v1/object/public/', `/storage/v1/render/image/public/`) + `?width=${size}&height=${size}&resize=cover`;
}

// Chat file upload
export async function uploadChatFile(file, conversationId) {
  if (file.size > MAX_UPLOAD_SIZE) throw new Error('El archivo excede el tamaño máximo de 10MB');
  // Compress image before upload (skip non-image files)
  const processed = file.type.startsWith('image/') ? await compressImage(file).catch(() => file) : file;
  const ext = (processed.name?.split('.').pop() || 'bin').toLowerCase();
  const SAFE_CHAT_EXTS = new Set(['jpg','jpeg','png','webp','gif','pdf','doc','docx','xlsx','heic','heif','mp4','mp3','ogg','wav']);
  if (!SAFE_CHAT_EXTS.has(ext)) throw new Error('Tipo de archivo no permitido');
  const safeName = processed.name?.replace(/[^a-zA-Z0-9._-]/g, '_') || `file.${ext}`;
  const safeConvId = String(conversationId).replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `chat/${safeConvId}/${Date.now()}_${safeName}`;
  const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;

  const headers = { 'Content-Type': processed.type || 'application/octet-stream' };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(url, { method: 'POST', headers, body: processed });

  if (!res.ok) {
    let errMsg = 'Error al subir archivo';
    try { const d = await res.json(); errMsg = d.message || d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
}

// Web Chat (AI Agent)
export async function apiWebChatSend(text) { return api('/web-chat/message', { body: { text } }); }
export async function apiWebChatHistory() { return api('/web-chat/history'); }
export async function apiWebChatAudio(blob) {
  const mkForm = () => { const f = new FormData(); f.append('audio', blob, 'audio.webm'); return f; };
  const res = await fetch(`${API_URL}/web-chat/audio`, {
    method: 'POST',
    credentials: 'include',
    body: mkForm(),
  });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${API_URL}/web-chat/audio`, {
        method: 'POST', credentials: 'include', body: mkForm(),
      });
      if (!retry.ok) throw new ApiError(retry.status, await retry.json().catch(() => ({})));
      return retry.json();
    }
    throw new ApiError(401, { message: 'Sesión expirada' });
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}
