// The version of the cache.
const CACHE_VERSION = 5; // Increment version again to force update
const CACHE_NAME = `second-hand-cache-v${CACHE_VERSION}`;
const SERVER_URL = 'https://second-hand-app-j1t7.onrender.com'; // Make sure this is the correct URL

// A function to log messages to the server for debugging on mobile
function logToServer(message) {
    fetch(`${SERVER_URL}/api/log-sw`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message }),
    }).catch(err => console.error('[SW] Failed to log to server:', err));
}

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
  logToServer(`[SW] Installing version ${CACHE_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        logToServer('[SW] Caching core files.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        logToServer('[SW] Installation complete. Skipping waiting.');
        return self.skipWaiting();
      })
  );
});

// Event listener for the 'activate' event.
self.addEventListener('activate', event => {
  logToServer(`[SW] Activating version ${CACHE_VERSION}...`);
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            logToServer(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        logToServer('[SW] New service worker activated. Claiming clients.');
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
  logToServer('[SW] Push notification received.');
  let data;
  try {
    data = event.data.json();
    logToServer(`[SW] Push data: ${JSON.stringify(data)}`);
  } catch (e) {
    logToServer(`[SW] Push event but no data or failed to parse: ${e.message}`);
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
      .then(() => logToServer('[SW] Notification shown successfully.'))
      .catch(err => logToServer(`[SW] Error showing notification: ${err.message}`))
  );
});

// Event listener for the 'notificationclick' event.
self.addEventListener('notificationclick', event => {
  logToServer('[SW] Notification clicked.');
  event.notification.close(); 

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      for (const client of clientList) {
        if (new URL(client.url).pathname === new URL(urlToOpen).pathname && 'focus' in client) {
          logToServer('[SW] Found an open client, focusing it.');
          return client.focus();
        }
      }
      if (clients.openWindow) {
        logToServer('[SW] No open client found, opening a new one.');
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
