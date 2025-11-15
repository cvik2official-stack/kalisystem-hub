const CACHE_NAME = 'kalisystem-dispatcher-v10';
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
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add all core assets to the cache
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // Use a "stale-while-revalidate" strategy
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);

    const fetchPromise = fetch(event.request).then(networkResponse => {
      // If the fetch was successful, clone it and store it in the cache for next time.
      if (networkResponse && networkResponse.ok) {
        const responseToCache = networkResponse.clone();
        cache.put(event.request, responseToCache);
      }
      return networkResponse;
    }).catch(error => {
      console.error('Service Worker: Fetch failed; user may be offline.', error);
      // If fetch fails and we have no cached response, the request will fail.
    });

    // Return the cached response immediately if it exists, otherwise wait for the network.
    return cachedResponse || fetchPromise;
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