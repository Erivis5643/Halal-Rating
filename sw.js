const CACHE_NAME = 'halal-rating-v5';

// Only cache essential static assets, never auth-related
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/fotos/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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
  
  // Only handle GET requests
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  
  // NEVER intercept these - let them go to network:
  // - Any API calls (Supabase, etc.)
  // - Any cross-origin requests
  // - Any requests with query parameters (dynamic content)
  // - Any requests to config.js
  // - Any auth-related requests
  if (
    !url.origin.includes(location.hostname) || // Cross-origin
    url.pathname.includes('supabase') ||       // Supabase API
    url.pathname.includes('api.') ||          // Any API
    url.pathname.includes('config.js') ||     // Config file
    url.search ||                             // Query parameters
    url.pathname.includes('auth') ||          // Auth endpoints
    url.pathname.includes('storage') ||       // Storage endpoints
    url.pathname.includes('rest') ||          // REST endpoints
    url.pathname.includes('realtime') ||      // Realtime endpoints
    url.pathname.includes('functions') ||     // Edge functions
    url.pathname.includes('graphql') ||       // GraphQL
    url.pathname.includes('postgrest')        // PostgREST
  ) {
    return; // Let browser handle normally
  }
  
  // For static assets only: try cache first, then network
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset.split('/').pop()))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          // Only cache successful responses
          if (response && response.ok && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }
  
  // For everything else: network only, no caching
  event.respondWith(fetch(request));
});
