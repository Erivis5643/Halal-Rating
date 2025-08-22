const CACHE_NAME = 'halal-rating-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/manifest.json',
  '/fotos/logo.png',
  '/fotos/halal-schlachter.png',
  '/fotos/unrankt.png',
  '/fotos/front-flipper.png',
  '/fotos/flicker-massen-beta.png',
  '/fotos/haram-schlachter.png',
  '/fotos/pockai-knose.png',
  '/fotos/fnaf-tuf.png',
  '/fotos/schwertmensch.png',
  '/fotos/bake-flips-flippa.png',
  '/fotos/kaese-fuss-sigma.png',
  '/fotos/ultimate-durchhaehmer.png',
  '/fotos/creeper-stripper.png',
  '/fotos/psychiatrie-c1.png',
  '/fotos/psychiatrie-c2.png',
  '/fotos/psychiatrie-c3.png',
  '/fotos/psychiatrie-c4.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache failed:', error);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request because it's a stream and can only be consumed once
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response because it's a stream and can only be consumed once
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              // Don't cache external resources or API calls
              if (event.request.url.startsWith(self.location.origin) && 
                  !event.request.url.includes('/api/') &&
                  !event.request.url.includes('supabase.co')) {
                cache.put(event.request, responseToCache);
              }
            });
          
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, show offline page
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // This would handle any offline actions that need to be synced
  // when the user comes back online
  console.log('Background sync triggered');
}

// Handle push notifications (if you want to add them later)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
              icon: '/fotos/logo.png',
        badge: '/fotos/logo.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
