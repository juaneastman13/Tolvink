// =====================================================================
// TOLVINK — Service Worker v5.3
// Cache-first shell, stale-while-revalidate API, navigation preload
// =====================================================================

const CACHE_NAME = 'tolvink-v5.4';
const API_CACHE = 'tolvink-api-v2';
const FONT_CACHE = 'tolvink-fonts-v1';
const IMG_CACHE = 'tolvink-img-v1';

// API_ORIGIN — can be overridden at build time via env; hardcoded fallback for production
const API_ORIGIN = self.__API_ORIGIN || 'https://tolvink-api-production.up.railway.app';

const APP_SHELL = ['/', '/index.html', '/manifest.json'];

const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const IMG_ORIGINS = ['https://mlmecljidioymujsazrs.supabase.co'];

// API paths to cache for offline (GET only)
const CACHEABLE_API = ['/api/freights', '/api/catalog/', '/api/fields', '/api/trucks', '/api/plant-access/'];

// Cache size limits
const API_CACHE_MAX = 100;
const IMG_CACHE_MAX = 200;

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}

// ======================== INSTALL ====================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ======================== MESSAGE ====================================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ======================== ACTIVATE ===================================
self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, API_CACHE, FONT_CACHE, IMG_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k)))
    )
    .then(() => {
      // Enable navigation preload if supported
      if (self.registration.navigationPreload) {
        return self.registration.navigationPreload.enable();
      }
    })
    .then(() => self.clients.claim())
  );
});

// ======================== FETCH ======================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // --- Fonts: cache-first (immutable) ---
  if (FONT_ORIGINS.some((o) => url.origin === o)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((r) => { cache.put(request, r.clone()); return r; });
        })
      )
    );
    return;
  }

  // --- Supabase images: cache-first ---
  if (IMG_ORIGINS.some((o) => url.origin === o)) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((r) => {
            if (r.ok) cache.put(request, r.clone());
            trimCache(IMG_CACHE, IMG_CACHE_MAX).catch(() => {});
            return r;
          });
        })
      )
    );
    return;
  }

  // --- API calls: stale-while-revalidate ---
  const isApiCall = (url.origin === API_ORIGIN && url.pathname.startsWith('/api/'))
    || (url.origin === location.origin && url.pathname.startsWith('/api/'));

  if (isApiCall) {
    const isCacheable = CACHEABLE_API.some((p) => url.pathname.startsWith(p));
    if (!isCacheable) return; // Non-cacheable API → let browser handle

    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        const networkFetch = fetch(request).then((r) => {
          if (r.ok) {
            cache.put(request, r.clone());
            trimCache(API_CACHE, API_CACHE_MAX).catch(() => {});
          }
          return r;
        }).catch(() => {
          // Offline fallback
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: 'offline', message: 'Sin conexión' }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        });

        // Network-first to avoid cross-user data leakage; cache is offline fallback only
        return networkFetch;
      })
    );
    return;
  }

  // --- App shell: network-first (ensures deploys take effect immediately) ---
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try navigation preload first, then network
          const preloadResp = event.preloadResponse ? await event.preloadResponse : null;
          const r = preloadResp || await fetch(request);
          if (r.ok && url.origin === location.origin) {
            const c = await caches.open(CACHE_NAME);
            c.put(request, r.clone());
          }
          return r;
        } catch {
          // Offline: fall back to cached index.html
          const cached = await caches.match(request);
          return cached || caches.match('/index.html');
        }
      })()
    );
    return;
  }

  // --- Other static assets: network-first for hashed assets, cache-first for rest ---
  const isHashedAsset = url.pathname.startsWith('/assets/') && /[-.][\da-f]{6,}\./.test(url.pathname);
  event.respondWith(
    (async () => {
      if (isHashedAsset) {
        // Network-first for Vite hashed chunks — avoids stale chunk MIME errors
        try {
          const r = await fetch(request);
          // If Vercel returns HTML for a missing .js chunk, don't cache — trigger reload
          const ct = r.headers.get('content-type') || '';
          if (url.pathname.endsWith('.js') && ct.includes('text/html')) {
            // Stale chunk — purge cache and let client reload
            const c = await caches.open(CACHE_NAME);
            await c.delete(request);
            return r;
          }
          if (r.ok && url.origin === location.origin) {
            const c = await caches.open(CACHE_NAME);
            c.put(request, r.clone());
          }
          return r;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          throw new Error('offline');
        }
      }
      // Non-hashed static: cache-first
      const cached = await caches.match(request);
      if (cached) return cached;
      const r = await fetch(request);
      if (url.origin === location.origin && r.ok) {
        const c = await caches.open(CACHE_NAME);
        c.put(request, r.clone());
      }
      return r;
    })().catch((err) => { console.warn('[SW] Static asset fetch failed:', err?.message || err); })
  );
});

// ======================== PUSH NOTIFICATIONS ===========================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Ver' }],
    tag: data.tag || 'tolvink-notif',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tolvink', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';
  const url = (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) ? rawUrl : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ======================== BACKGROUND SYNC =============================
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-queue') {
    event.waitUntil(
      (async () => {
        // Notify all clients to replay offline queue
        const allClients = await clients.matchAll({ type: 'window' });
        allClients.forEach(c => c.postMessage({ type: 'REPLAY_OFFLINE_QUEUE' }));
      })()
    );
  }
});
