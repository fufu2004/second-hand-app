// The version of the cache.
const CACHE_VERSION = 8; // Increment version to force update
const CACHE_NAME = `second-hand-cache-v${CACHE_VERSION}`;
const SERVER_URL = 'https://octopus-app-iwic4.ondigitalocean.app'; // ✨ כתובת השרת הוחלפה

// A function to log messages to the server for debugging on mobile
function logToServer(message) {
    // This function is for debugging and can be removed in production if not needed.
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

// --- The rest of the original sw.js code from the backup goes here ---
// ... (Paste the entire content of the sw.js backup file from this point onwards)
