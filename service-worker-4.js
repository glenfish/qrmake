const CACHE_NAME = 'V22';
const urlsToCache = [
  'index.html',
  'gif.js',
  'qrcode.min.js',
  'jsQR.min.js',
  'index.min.js',
  'libgif.js',
  'gif.worker.js',
  'service-worker.js'
];

let cacheReady = false;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => {
        cacheReady = true;
        self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
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

        if (!cacheReady) {
          // Delay the fetch until cache is ready
          return new Promise(resolve => {
            const checkCache = () => {
              if (cacheReady) {
                resolve(fetch(event.request));
              } else {
                setTimeout(checkCache, 100);
              }
            };
            checkCache();
          });
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));

          return response;
        });
      })
  );
});



function verifyCache() {
  return new Promise((resolve, reject) => {
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        const cachedUrls = keys.map(request => request.url);
        const missingUrls = urlsToCache.filter(url => !cachedUrls.includes(url));
        let messageToSend = { message: 'offlineReady' }; // Default message

        if (missingUrls.length === 0) {
          // Even if there are no missing URLs, we might want to communicate the cache's status
          console.log('No missing URLs. Cache is ready.');
        } else {
          // If there are missing URLs, attempt to cache them
          return caches.delete(CACHE_NAME)
            .then(() => caches.open(CACHE_NAME))
            .then(cache => cache.addAll(missingUrls))
            .then(() => {
              console.log('Missing URLs cached successfully.');
              cacheReady = true;
            })
            .catch(error => {
              messageToSend = { message: 'offlineNotReady', error: error.toString() };
              reject(error);
            });
        }
        // Always resolve to send a message about the cache status
        resolve(messageToSend);
      })
      .catch(error => {
        console.error('Cache verification failed:', error);
        reject(error);
      });
  });
}

// Adjusted event listener for message event to use the new logic
self.addEventListener('message', event => {
  if (event.data.action === 'verifyCache') {
    verifyCache()
      .then(messageToSend => {
        // Use the message determined by the verifyCache function's logic
        console.log(messageToSend.message);
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage(messageToSend);
          });
        });
      })
      .catch(error => {
        console.error('Error after verifying cache:', error);
        // Send a failure message if needed
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              message: 'offlineNotReady',
              error: error.toString(),
            });
          });
        });
      });
  }
});

  

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    window.addEventListener('online', () => {
      navigator.serviceWorker.controller.postMessage({action: 'verifyCache'});
    });
  }

