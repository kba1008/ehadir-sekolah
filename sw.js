// sw.js - Versi Ultra-Offline v46 (Dynamic Asset Caching)
const CACHE_NAME = 'ehadir-v46-tech';

// Aset kritikal yang WAJIB ada
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  // Tambah aset luaran supaya tak perlu WiFi lagi
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap',
  'https://img.freepik.com/free-vector/dark-hexagonal-background-with-gradient-color_79603-1409.jpg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching core assets...");
      return cache.addAll(assetsToCache);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log("Removing old cache", key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Handle POST requests (Simpan offline jika gagal)
  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        return new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Handle Navigation (Sentiasa ke index.html jika offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3. Dynamic Caching untuk Ikon Flaticon & Gambar Luaran
  // Ini menyelesaikan masalah "mengharapkan wifi" untuk ikon
  if (url.hostname.includes('flaticon.com') || url.hostname.includes('freepik.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
          caches.match(request).then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              return fetch(request).then((networkResponse) => {
                  // Clone response sebab stream hanya boleh baca sekali
                  let responseClone = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                      cache.put(request, responseClone);
                  });
                  return networkResponse;
              });
          }).catch(() => {
              // Jika offline dan tiada cache imej, pulangkan kosong atau placeholder
              return new Response('', { status: 404, statusText: 'Offline Image' });
          })
      );
      return;
  }

  // 4. Default Cache-First Strategy
  event.respondWith(
    caches.match(request).then((res) => res || fetch(request))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    console.log("Background Sync Triggered!");
  }
});