const CACHE_NAME = 'V23';
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
  return caches.open(CACHE_NAME)
    .then(cache => {
      return cache.keys().then(keys => {
        const cachedUrls = keys.map(request => request.url);
        const missingUrls = urlsToCache.filter(url => !cachedUrls.includes(url));

        if (missingUrls.length > 0) {
          return cache.addAll(missingUrls).then(() => {
            console.log('Missing URLs cached successfully.');
            cacheReady = true;
            // Return a message indicating success
            return { message: 'offlineReady' };
          }).catch(error => {
            console.error('Failed to cache missing URLs:', error);
            // Return a message indicating failure
            throw { message: 'offlineNotReady', error: error.toString() };
          });
        } else {
          console.log('No missing URLs. Cache is ready.');
          // Return a message indicating the cache is already ready
          return { message: 'offlineReady' };
        }
      });
    })
    .catch(error => {
      console.error('Cache verification failed:', error);
      // Return a message indicating failure
      return { message: 'offlineNotReady', error: error.toString() };
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

