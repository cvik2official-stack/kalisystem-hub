const CACHE_NAME = 'kalisystem-dispatcher-v11'; // Incremented cache version
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

  // We only want to handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  // For Supabase API calls, use a network-first strategy.
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // If the fetch is successful, cache the response.
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(async () => {
          // If the network fails, try to serve from the cache.
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache either, it will fail (which is the expected offline behavior for a failed API call)
        })
    );
    return;
  }

  // For all other assets (core app shell), use a cache-first strategy.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return fetch(request);
  })());
});


self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});