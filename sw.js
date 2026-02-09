// sw.js - Versi Fix Masalah Cache & Butang Hilang (v46)
const CACHE_NAME = 'ehadir-v46-FIX-DATA';
const DB_NAME = 'E-Hadir-Offline-DB';
const STORE_NAME = 'attendance_queue';

// Pastikan SEMUA fail (CSS/JS) didaftarkan di sini supaya app tak 'pecah' masa offline
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  // './style.css', // Tambah jika ada
  // './script.js'  // Tambah jika ada
];

// 1. Install: Simpan aset 'seketul' dalam telefon
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Paksa SW baru aktif segera
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

// 2. Activate: Buang cache versi lama supaya tak serabut
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Strategi HYBRID (Penting untuk fix masalah anda)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // --- BAHAGIAN PENTING: FIX MASALAH BUTANG HILANG ---
  // Jika request ke Google Script (Data) -> WAJIB AMBIL DARI INTERNET (Network Only)
  // Jangan benarkan cache untuk data kehadiran!
  if (url.hostname.includes('script.googleusercontent.com') || 
      url.hostname.includes('script.google.com') ||
      request.method === 'POST') {
        
    event.respondWith(
      fetch(request).catch(async () => {
        // Jika tiada internet, baru return offline response
        return new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return; // Berhenti di sini, jangan guna kod cache di bawah
  }

  // --- BAHAGIAN LAIN: ASET APP (HTML/GAMBAR) ---
  
  // Jika navigate (buka app), cuba ambil online dulu, kalau tak dapat baru ambil index.html dalam cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Untuk gambar/logo/file lain -> Guna Cache dulu baru Network (Laju)
  event.respondWith(
    caches.match(request).then((res) => res || fetch(request))
  );
});

// 4. Background Sync (Pilihan Tambahan)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    console.log("Background Sync Triggered!");
  }
});
