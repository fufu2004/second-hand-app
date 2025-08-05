// The version of the cache. Higher version number means old caches are invalidated.
const CACHE_VERSION = 4; // עדכון גרסה כדי לאלץ ריענון
const CACHE_NAME = `second-hand-cache-v${CACHE_VERSION}`;

// The core files needed for the app to run offline.
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.socket.io/4.7.5/socket.io.min.js',
  'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap',
  'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png'
];

// On install, cache the core assets.
self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to activate immediately.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[Service Worker] Caching core assets for version ${CACHE_VERSION}`);
        return cache.addAll(urlsToCache);
      })
  );
});

// On activate, clean up old caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activated and claimed clients.');
      return self.clients.claim(); // Take control of all open pages immediately.
    })
  );
});

// On fetch, implement a "Network first, falling back to cache" strategy.
self.addEventListener('fetch', event => {
  // We only want to intercept GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // 1. Try to fetch from the network.
    fetch(event.request)
      .then(networkResponse => {
        // If the network request is successful, cache the response and return it.
        // This keeps the cache up-to-date.
        if (networkResponse) {
            // We need to clone the response because a response is a stream and can only be consumed once.
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                // Cache the new response for the request.
                cache.put(event.request, responseToCache);
              });
        }
        return networkResponse;
      })
      .catch(() => {
        // 2. If the network fails (e.g., offline), try to get the response from the cache.
        console.log(`[Service Worker] Network request for ${event.request.url} failed. Trying cache.`);
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If the request is for a page navigation and it's not in the cache,
            // return the offline fallback page.
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            // If it's another type of asset and not in cache, there's nothing we can do.
            // The browser will show its default offline error.
            return new Response("You are offline and this asset is not cached.", {
              status: 404,
              statusText: "Offline",
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});
