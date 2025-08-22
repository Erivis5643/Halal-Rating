const CACHE_NAME = 'halal-rating-v6';

// Only cache the most basic static assets
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/fotos/logo.png'
];

self.addEventListener('install', (event) => {
  console.log('SW installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW activating...');
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
  
  // Debug logging
  console.log('SW fetch:', url.pathname, url.origin, location.hostname);
  
  // NEVER intercept these - let them go to network:
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
    url.pathname.includes('postgrest') ||     // PostgREST
    url.pathname.includes('cdn.jsdelivr.net') || // External CDN
    url.pathname.includes('fonts.gstatic.com') || // Google Fonts
    url.pathname.includes('fonts.googleapis.com') // Google Fonts
  ) {
    console.log('SW: letting request go to network:', url.pathname);
    return; // Let browser handle normally
  }
  
  // For static assets only: try cache first, then network
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset.split('/').pop()))) {
    console.log('SW: caching static asset:', url.pathname);
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
  console.log('SW: network only for:', url.pathname);
  event.respondWith(fetch(request));
});
