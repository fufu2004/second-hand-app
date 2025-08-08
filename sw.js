// The version of the cache.
const CACHE_VERSION = 9; // Increment version to force update
const CACHE_NAME = `second-hand-cache-v${CACHE_VERSION}`;
const SERVER_URL = 'https://second-hand-app-j1t7.onrender.com';

// A function to log messages to the server for debugging on mobile
function logToServer(message) {
    fetch(`${SERVER_URL}/api/log-sw`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: `[SW v${CACHE_VERSION}] ${message}` }),
    }).catch(err => console.error('[SW] Failed to log to server:', err));
}

// The files to cache on installation.
const urlsToCache = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap',
  'https://raw.githubusercontent.com/fufu2004/second-hand-app/main/ChatGPT%20Image%20Jul%2023%2C%202025%2C%2010_44_20%20AM%20copy.png'
];

self.addEventListener('install', event => {
  logToServer(`Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        logToServer('Caching core files.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        logToServer('Installation complete. Skipping waiting.');
        return self.skipWaiting();
      })
      .catch(error => {
        logToServer(`Cache addAll failed: ${error}`);
      })
  );
});

self.addEventListener('activate', event => {
  logToServer(`Activating...`);
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            logToServer(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        logToServer('New service worker activated. Claiming clients.');
        return self.clients.claim();
    })
  );
});


// --- NEW STRATEGY: Network First for EVERYTHING ---
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If fetch is successful, cache the new response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // If fetch fails (offline), try to get it from the cache
        return caches.match(event.request);
      })
  );
});


// Event listener for the 'push' event.
self.addEventListener('push', event => {
  logToServer('Push notification received.');
  let data;
  try {
    data = event.data.json();
    logToServer(`Push data: ${JSON.stringify(data)}`);
  } catch (e) {
    logToServer(`Push event but no data or failed to parse: ${e.message}`);
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
      .then(() => logToServer('Notification shown successfully.'))
      .catch(err => logToServer(`Error showing notification: ${err.message}`))
  );
});

// Event listener for the 'notificationclick' event.
self.addEventListener('notificationclick', event => {
  logToServer('Notification clicked.');
  event.notification.close(); 

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window open with the target URL.
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          logToServer('Found an open client, focusing it.');
          return client.focus();
        }
      }
      // If no client is open, open a new window.
      if (clients.openWindow) {
        logToServer('No open client found, opening a new one.');
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
