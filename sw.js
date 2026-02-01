// sw.js - Versi Ultra-Offline v44
const CACHE_NAME = 'ehadir-v44';
const DB_NAME = 'E-Hadir-Offline-DB';
const STORE_NAME = 'attendance_queue';

// Pastikan SEMUA fail (CSS/JS) didaftarkan di sini supaya app tak 'pecah' masa offline
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.ico',
  // './style.css', // Tambah jika ada
  // './script.js'  // Tambah jika ada
];

// Install: Simpan aset 'seketul' dalam telefon
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

// Fetch: Strategi Cache-First untuk aset agar laju
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        await saveToIndexedDB(request.clone());
        return new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Navigasi sentiasa ke index.html jika offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((res) => res || fetch(request))
  );
});

// Background Sync (Hanya Android/Chrome sokong penuh buat masa ini)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(sendOfflineData());
  }
});

// Kekalkan fungsi openDB dan sendOfflineData anda yang sedia ada