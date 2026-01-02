const CACHE_NAME = 'mc-store-v2';
const CONTENT_TO_CACHE = [
  '/',
  '/index.html',
  '/src/style.css',
];

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  self.skipWaiting(); // Force activation
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all: app shell and content');
      return cache.addAll(CONTENT_TO_CACHE);
    }),
  );
});

self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activate');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim()) // Become available to all pages
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
        return caches.match(e.request);
    })
  );
});
