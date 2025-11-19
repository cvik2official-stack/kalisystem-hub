const CACHE_NAME = 'kalisystem-dispatcher-v12'; // Incremented cache version
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/index.tsx',
  '/manifest.json?v=2',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.ico',
  '/icons/favicon-96x96.png',
  '/icons/web-app-manifest-192x192.png',
  '/icons/web-app-manifest-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching core assets.');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Network-first for Supabase API calls
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for all other assets
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    return fetch(request);
  })());
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheWhitelist.indexOf(cacheName) === -1) {
          return caches.delete(cacheName);
        }
      })
    ))
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const action = event.action;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const openClient = clientList.find(client => client.url.includes(self.location.origin) && 'focus' in client);

      if (action === 'close_pip') {
        if (openClient) {
          openClient.postMessage({ action: 'CLOSE_PIP' });
          openClient.focus();
        }
      } else if (action === 'show_all') {
        if (openClient) {
          openClient.postMessage({ action: 'SHOW_ALL' });
          openClient.focus();
        } else {
          clients.openWindow('/?action=show_all');
        }
      } else {
        // Default action (clicking the notification body)
        if (openClient) {
          openClient.focus();
        } else {
          clients.openWindow('/');
        }
      }
    })
  );
});
