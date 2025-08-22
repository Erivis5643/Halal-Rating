const CACHE_NAME = 'halal-rating-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/manifest.webmanifest',
  '/fotos/logo.png',
  '/fotos/unrankt.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
    })))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const reqUrl = new URL(request.url);
  const sameOrigin = reqUrl.origin === self.location.origin;

  // Never intercept Supabase or other cross-origin API calls
  if (!sameOrigin) {
    // Let the network handle cross-origin requests (no caching)
    return; // do not call respondWith, so browser does normal fetch
  }

  // Navigation requests: network first with fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        }
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Images under /fotos/: cache-first, but don't cache failed responses
  if (reqUrl.pathname.startsWith('/fotos/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Static assets (CSS/JS/manifest): stale-while-revalidate
  if (reqUrl.pathname.endsWith('.css') || reqUrl.pathname.endsWith('.js') || reqUrl.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: try cache, then network (no caching of errors)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => response);
    })
  );
});
