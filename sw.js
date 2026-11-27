/*
 * sw.js - Service Worker for Farhan Jawed - AI Agent PWA
 * Handles offline caching and "Add to Home Screen" installation
 */

/* ==============================================================
   Configuration
   ============================================================== */

const CACHE_NAME = 'farhan-jawed-ai-v1';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './sw.js',
];

/* ==============================================================
   Install Event - Precache essential assets
   ============================================================== */

self.addEventListener('install', (event) => {
  // Wait until precaching is complete
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Precaching shell assets');
        return cache.addAll(PRECACHE);
      })
      .then(() => {
        console.log('Shell assets precached successfully');
      })
      .catch((error) => {
        console.error('Failed to precache:', error);
      })
  );

  // Ensure the service worker activates immediately
  event.waitUntil(self.clients.claim());
});

/* ==============================================================
   Activate Event - Clean up old caches
   ============================================================== */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );

  // Take control of all clients immediately
  event.waitUntil(clients.claim());
});

/* ==============================================================
   Fetch Event - Serve from cache, fallback to network
   ============================================================== */

self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests for our app
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-app assets (third-party APIs, etc.)
  if (url.origin !== self.location.origin && url.origin !== 'https://generativelanguage.googleapis.com') {
    // Let network handle external APIs
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Don't cache if not ok
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clone the response
        const responseToClone = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToClone);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests - show offline page
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ==============================================================
   Push Notification Event (optional - can add later)
   ============================================================== */

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Farhan Jawed - AI Agent';
  const options = {
    body: data.body || 'You have a new message',
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%230a0c2d/%3E%3Ctext x=%2220%22 y=%2255%22 font-family=%22Arial%20Bold%22 font-size=%2240%22 fill=%23ffffff%3EFJA%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 72 72%22><rect width=%2272%22 height=%2272%22 fill=%230a0c2d/%3E%3Ctext x=%2236%22 y=%2248%22 font-family=%22Arial%20Bold%22 font-size=%2216%22 fill=%233b82f6%3EFJA%3C/text%3E%3C/svg%3E',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ==============================================================
   Notification Click Event
   ============================================================== */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url === './index.html' && !client.focused) {
          client.focus();
          return;
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        clients.openWindow('./index.html');
      }
    })
  );
});

/* ==============================================================
   Background Sync (optional for message queuing)
   ============================================================== */

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

/* ==============================================================
   Helper: Sync messages from localStorage
   ============================================================== */

async function syncMessages() {
  // Could implement message queuing for offline mode
  console.log('Syncing messages...');
}

/* ==============================================================
   Console log for debugging
   ============================================================== */

console.log('[Farhan Jawed AI] Service Worker registered and active');
