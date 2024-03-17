const CACHE_NAME = 'v30';
const urlsToCache = [
  '/',
  '/index.html',
  '/gif.js',
  '/qrcode.min.js',
  '/jsQR.min.js',
  '/index.min.js',
  '/libgif.js',
  './gif.worker.js',
  './service-worker-2.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to cache it
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(error => {
        // Fallback mechanism
        console.error('Error fetching and caching:', error);
        // Return a default offline page or notify the user
        // You can customize this based on your requirements
        return new Response('You are offline. Some features may not be available.');
      })
  );
});
