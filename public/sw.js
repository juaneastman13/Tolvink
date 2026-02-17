// =====================================================================
// TOLVINK — Service Worker v4.2
// Strategy: Cache-first for app shell, Network-first for API calls
// =====================================================================

const CACHE_NAME = 'tolvink-v4.2';
const API_CACHE = 'tolvink-api-v1';
const FONT_CACHE = 'tolvink-fonts-v1';

// Backend origin (cross-origin API calls)
const API_ORIGIN = 'https://tolvink-api-production.up.railway.app';

// App shell files to precache
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Font origins to cache
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

// API paths worth caching for offline (GET only, read endpoints)
const CACHEABLE_API = ['/api/freights', '/api/catalog/', '/api/fields', '/api/trucks', '/api/plant-access/'];

// ======================== INSTALL ====================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL).catch(() => {
          // Non-fatal: some files may not exist yet (Vite hashed names)
          console.warn('[SW] Some app shell files could not be cached');
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ======================== ACTIVATE ===================================
self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, API_CACHE, FONT_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !keepCaches.includes(key))
          .map((key) => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ======================== FETCH ======================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PATCH/DELETE go straight to network)
  if (request.method !== 'GET') return;

  // Strategy 1: Cache-first for fonts
  if (FONT_ORIGINS.some((origin) => url.origin === origin)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Strategy 2: Network-first for API calls (cross-origin to Railway backend)
  const isApiCall = (url.origin === API_ORIGIN && url.pathname.startsWith('/api/'))
    || (url.origin === location.origin && url.pathname.startsWith('/api/'));

  if (isApiCall) {
    const isCacheable = CACHEABLE_API.some((p) => url.pathname.startsWith(p));

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses for offline fallback
          if (isCacheable && response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache
          return caches.open(API_CACHE).then((cache) =>
            cache.match(request).then((cached) => {
              if (cached) return cached;
              // Return offline JSON response
              return new Response(
                JSON.stringify({ error: 'offline', message: 'Sin conexión. Datos no disponibles.' }),
                { headers: { 'Content-Type': 'application/json' }, status: 503 }
              );
            })
          );
        })
    );
    return;
  }

  // Strategy 3: Cache-first for app shell, with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache same-origin responses
        if (url.origin === location.origin && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// ======================== PUSH NOTIFICATIONS ===========================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); } catch { return; }

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Ver' }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tolvink', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});
