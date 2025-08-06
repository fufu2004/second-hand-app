// The version of the cache.
const CACHE_VERSION = 3; // Increment version again to force update
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
  console.log('Attempting to install new service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // *** NEW: Force the new service worker to become active immediately. ***
        return self.skipWaiting();
      })
  );
});

// Event listener for the 'activate' event.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // *** NEW: Take control of all open clients (tabs) immediately. ***
        console.log('New service worker activated. Claiming clients.');
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
  const data = event.data.json();
  console.log('Push notification received:', data);

  const title = data.title || 'התראה חדשה';
  const testIcon = 'https://placehold.co/192x192/14b8a6/FFFFFF?text=S'; 

  const options = {
    body: data.body || 'קיבלת עדכון חדש.',
    icon: testIcon,
    badge: testIcon, 
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
  event.notification.close(); 

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
