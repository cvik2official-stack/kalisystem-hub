const CACHE_NAME = 'kalisystem-dispatcher-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-16x16.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png'
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

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    
    // Try to get the response from the cache.
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's not in the cache, fetch it from the network.
    try {
      const networkResponse = await fetch(event.request);
      
      // If the fetch was successful, clone it and store it in the cache.
      if (networkResponse && networkResponse.ok) {
        const responseToCache = networkResponse.clone();
        await cache.put(event.request, responseToCache);
      }
      
      return networkResponse;
    } catch (error) {
      // The network request failed. This happens when the user is offline.
      console.error('Service Worker: Fetch failed.', error);
      // You could return a fallback offline page here if you had one cached.
    }
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