// The version of the cache.
const CACHE_VERSION = 4; // Increment version again to force update
const CACHE_NAME = `second-hand-cache-v${CACHE_VERSION}`;

// The files to cache on installation.
const urlsToCache = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.socket.io/4.7.5/socket.io.min.js',
  'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap',
  'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png'
];

// Event listener for the 'install' event.
self.addEventListener('install', event => {
  console.log(`[SW] Installing version ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core files.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the new service worker to become active immediately.
        console.log('[SW] Installation complete. Skipping waiting.');
        return self.skipWaiting();
      })
  );
});

// Event listener for the 'activate' event.
self.addEventListener('activate', event => {
  console.log(`[SW] Activating version ${CACHE_VERSION}...`);
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // Take control of all open clients (tabs) immediately.
        console.log('[SW] New service worker activated. Claiming clients.');
        return self.clients.claim();
    })
  );
});


// Event listener for the 'fetch' event.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      }
    )
  );
});


// Event listener for the 'push' event.
self.addEventListener('push', event => {
  console.log('[SW] Push notification received.');
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Push event but no data', e);
    data = {
        title: 'התראה חדשה',
        body: 'קיבלת עדכון חדש.',
        data: { url: '/' }
    };
  }

  const title = data.title || 'התראה חדשה';
  const options = {
    body: data.body || 'קיבלת עדכון חדש.',
    icon: data.icon || 'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png',
    badge: 'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png',
    data: {
      url: data.data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Event listener for the 'notificationclick' event.
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked.');
  event.notification.close(); 

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      for (const client of clientList) {
        // If a window for the app is already open, focus it.
        if (new URL(client.url).pathname === new URL(urlToOpen).pathname && 'focus' in client) {
          console.log('[SW] Found an open client, focusing it.');
          return client.focus();
        }
      }
      // If no window is open, open a new one.
      if (clients.openWindow) {
        console.log('[SW] No open client found, opening a new one.');
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
