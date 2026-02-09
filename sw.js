// sw.js - Versi Ultra-Hybrid v50 (Online/Offline Ready)
// Dibuat untuk: E-HADIR PWA
// Strategi: Network First (Data Terkini) -> Fallback Cache (Offline)

const CACHE_NAME = 'ehadir-hybrid-v50';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
  // Tambah fail css/js lain jika ada, contoh: './style.css'
];

// 1. INSTALL: Simpan 'kulit' aplikasi (fail asas) ke dalam telefon
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa SW baru ambil alih segera
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// 2. ACTIVATE: Buang cache versi lama (bersihkan memori telefon)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Memadam cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. FETCH: "Otak" yang menentukan guna Internet atau Cache
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // A. JIKA HANTAR DATA (POST) - Cth: Tekan Butang Masuk/Keluar
  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone())
        .catch(() => {
          // Jika internet tiada, pulangkan isyarat 'Offline'
          // Kod di index.html akan terima ini dan simpan data dalam LocalStorage
          return new Response(JSON.stringify({ offline: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // B. JIKA MINTA DATA LIST (GET dari Google Script)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Jika BERJAYA dapat internet:
          // 1. Clone response (sebab stream cuma boleh baca sekali)
          const resClone = response.clone();
          // 2. Simpan copy data terkini dalam Cache (untuk backup masa depan)
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, resClone);
          });
          // 3. Bagi data fresh kepada pengguna
          return response;
        })
        .catch(() => {
          // Jika GAGAL (Tiada Internet):
          // Cari data lama dalam cache. Kalau ada, bagi je (supaya app tak kosong).
          return caches.match(request).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            
            // Jika cache pun tiada, bagi JSON kosong supaya tak error
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // C. JIKA MINTA FAIL BIASA (HTML, Gambar, Logo)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Guna cache dulu (laju), kalau tiada baru cari internet
      return cachedResponse || fetch(request).then((networkResponse) => {
         return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
         });
      });
    }).catch(() => {
       // Jika semua gagal (offline & tiada cache), tapi user cuba buka app
       // Paksa buka index.html (supaya user tak nampak Dinosaur Chrome)
       if (request.mode === 'navigate') {
         return caches.match('./index.html');
       }
    })
  );
});
