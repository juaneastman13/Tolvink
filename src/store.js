// =====================================================================
// TOLVINK — Zustand Global Stores
// Centralized state management replacing prop drilling
// =====================================================================

import { create } from "zustand";
import log from "./logger";

// Theme: inlined localStorage to avoid importing theme.jsx (circular dep risk)
function _getTheme() { try { return localStorage.getItem('tolvink_theme') || 'light'; } catch(e) { return 'light'; } }
function _setTheme(name) { try { localStorage.setItem('tolvink_theme', name); } catch(e) {} }

// ======================== UI STORE ===================================
// Modals, toasts, map overlay, list view mode, theme
export const useUIStore = create((set) => ({
  theme: _getTheme(),
  modal: null,
  toast: null,
  mapFocus: null,
  listView: "kanban",
  submitting: false,
  submitDone: "",
  actionLoading: false,
  notifOpen: false,
  chatConvId: null,
  duplicateData: null,
  editData: null,
  locPicker: null,

  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    _setTheme(next);
    return { theme: next };
  }),
  setModal: (modal) => set({ modal }),
  setToast: (toast) => set({ toast }),
  show: (msg, type = "ok") => set({ toast: { msg, type, _ts: Date.now() } }),
  setMapFocus: (mapFocus) => set({ mapFocus }),
  setListView: (listView) => set({ listView }),
  setSubmitting: (submitting) => set({ submitting }),
  setSubmitDone: (submitDone) => set({ submitDone }),
  setActionLoading: (actionLoading) => set({ actionLoading }),
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  setChatConvId: (chatConvId) => set({ chatConvId }),
  setDuplicateData: (duplicateData) => set({ duplicateData }),
  setEditData: (editData) => set({ editData }),
  setLocPicker: (locPicker) => set({ locPicker }),

  goToMap: (lat, lng, label, destLat, destLng, destLabel, freightId) => {
    if (!lat || !lng) return;
    set({
      mapFocus: {
        lat: Number(lat), lng: Number(lng), label: label || "",
        destLat: destLat ? Number(destLat) : null,
        destLng: destLng ? Number(destLng) : null,
        destLabel: destLabel || "",
        freightId: freightId || null,
      },
    });
  },
}));

// ======================== CATALOG CACHE STORE =========================
// Centralized catalog cache (multi-tenant safe)
export const useCatalogStore = create((set, get) => ({
  cache: {}, // { [userId]: { data, ts, loading } }

  getCache: (userId) => get().cache[userId] || null,

  setCache: (userId, data) => set((state) => ({
    cache: {
      ...state.cache,
      [userId]: { data, ts: Date.now(), loading: false }
    }
  })),

  setLoading: (userId, loading) => set((state) => ({
    cache: {
      ...state.cache,
      [userId]: { ...(state.cache[userId] || {}), loading }
    }
  })),

  clearCache: () => set({ cache: {} }),
}));

// ======================== OFFLINE WRITE QUEUE =========================
// Queues failed writes when offline, replays when back online
const DB_NAME = "tolvink-offline";
const STORE_NAME = "queue";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const offlineQueue = {
  async enqueue(action) {
    let db;
    try {
      db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add({
        ...action,
        createdAt: Date.now(),
      });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
      log.error("OfflineQueue", "enqueue failed:", e);
    } finally {
      db?.close();
    }
  },

  async getAll() {
    let db;
    try {
      db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      return await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('OfflineQueue.getAll failed:', e?.message || e);
      return [];
    } finally {
      db?.close();
    }
  },

  async remove(id) {
    let db;
    try {
      db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
      log.error("OfflineQueue", "remove failed:", e);
    } finally {
      db?.close();
    }
  },

  async count() {
    const items = await this.getAll();
    return items.length;
  },

  async clear() {
    let db;
    try {
      db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
      log.error("OfflineQueue", "clear failed:", e);
    } finally {
      db?.close();
    }
  },
};
