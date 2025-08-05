// A high version number to forcefully invalidate all previous caches.
const CACHE_VERSION = 20;
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

  // For navigation requests (loading the page itself), always try network first.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If network fails, serve the cached index.html as a fallback.
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other requests (CSS, JS, images), use the same network-first strategy.
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // If the network request is successful, cache the response and return it.
        // This keeps the cache up-to-date.
        if (networkResponse) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network fails, try to get the response from the cache.
        console.log(`[Service Worker] Network request for ${event.request.url} failed. Trying cache.`);
        return caches.match(event.request);
      })
  );
});
