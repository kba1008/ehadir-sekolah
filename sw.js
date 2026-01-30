// KEMASKINI VERSI DI SINI SETIAP KALI UBAH HTML
const CACHE_NAME = 'ehadir-cache-v23'; 

const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// INSTALL: Simpan fail dalam cache
self.addEventListener('install', event => {
  self.skipWaiting(); // Paksa update segera
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// FETCH: Guna cache jika offline, update jika online
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ACTIVATE: Buang cache lama (v19, v20, dll)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Buang cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});