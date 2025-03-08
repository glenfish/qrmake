const CACHE_NAME = 'v2';
const urlsToCache = [
  'index.html',
  'gif.js',
  'qrcode.min.js',
  'jsQR.min.js',
  'index.min.js',
  'libgif.js',
  'gif.worker.js'
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

        if (missingUrls.length === 0) {
          resolve();
        } else {
          // Clear the cache and retry caching missing files
          caches.delete(CACHE_NAME)
            .then(() => caches.open(CACHE_NAME))
            .then(cache => cache.addAll(missingUrls))
            .then(() => {
              cacheReady = true;
              resolve();
            })
            .catch(error => reject(error));
        }
      })
      .catch(error => reject(error));
  });
}

// Perform initial cache verification
verifyCache()
  .then(() => {
    console.log('Cache verification successful');
    // Notify all client pages
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          message: 'offlineReady',
        });
      });
    });
  })
  .catch(error => console.error('Cache verification failed:', error));

 self.addEventListener('message', event => {
  if (event.data.action === 'verifyCache') {
    verifyCache()
      .then(() => {
        console.log('Cache verification successful after coming back online');
        // Notify all client pages about being ready for offline
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              message: 'offlineReady',
            });
          });
        });
      })
      .catch(error => {
        console.error('Cache verification failed:', error);
        // Notify all client pages about NOT being ready for offline
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

