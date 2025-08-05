// The version of the cache.
const CACHE_VERSION = 2; // Increment version to ensure the new service worker is installed
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
// This is where we cache the core files of the app.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event listener for the 'fetch' event.
// This intercepts network requests and serves files from the cache if available.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }
        // Not in cache - fetch from network
        return fetch(event.request);
      }
    )
  );
});

// Event listener for the 'activate' event.
// This is where we clean up old caches.
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
    })
  );
});

// *** NEW: Event listener for the 'push' event ***
// This is triggered when the service worker receives a push message from the server.
self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('Push notification received:', data);

  const title = data.title || 'התראה חדשה';
  const options = {
    body: data.body || 'קיבלת עדכון חדש.',
    icon: data.icon || 'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png',
    badge: 'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png',
    data: {
      url: data.data.url // URL to open when the notification is clicked
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// *** NEW: Event listener for the 'notificationclick' event ***
// This is triggered when a user clicks on a notification.
self.addEventListener('notificationclick', event => {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // If a window for the app is already open, focus it.
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
