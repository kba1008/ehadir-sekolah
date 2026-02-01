// sw.js - E-HADIR (Auto-Update & Data Locking)
const CACHE_NAME = 'ehadir-v40';
const DB_NAME = 'E-Hadir-Offline-DB';
const STORE_NAME = 'attendance_queue';

const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.ico'
];

// 1. Install & Cache
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

// 2. Activate & Clean Old Caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => k !== CACHE_NAME && caches.delete(k))
    ))
  );
});

// 3. Logik Pintar: Auto-Update UI & Lock Data Offline
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // A. JIKA HANTAR DATA (POST)
  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Simpan data asal (LOCK DATA) jika tiada internet
        await saveToIndexedDB(request.clone());
        return new Response(JSON.stringify({ result: 'success', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // B. JIKA BUKA PAPARAN (GET index.html / icon)
  // Strategi: Network First (Ambil yang baru, jika gagal baru guna cache)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Kemaskini cache dengan paparan terbaru dari server
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
        return response;
      })
      .catch(() => caches.match(request)) // Jika offline, guna cache terakhir
  );
});

// --- FUNGSI INDEXEDDB (LOCKING SYSTEM) ---

async function saveToIndexedDB(request) {
  const body = await request.text();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  await store.add({
    url: request.url,
    payload: body,
    timeLabel: new Date().toLocaleTimeString() // Sekadar rujukan log
  });
}

function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
  });
}

// Auto-Sync bila internet kembali (Support Android & iOS)
setInterval(() => {
  if (navigator.onLine) sendOfflineData();
}, 15000); // Semak setiap 15 saat

async function sendOfflineData() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const allData = await new Promise(r => {
    const res = store.getAll();
    res.onsuccess = () => r(res.result);
  });

  for (const item of allData) {
    try {
      await fetch(item.url, {
        method: 'POST',
        body: item.payload,
        mode: 'no-cors'
      });
      const delTx = db.transaction(STORE_NAME, 'readwrite');
      delTx.objectStore(STORE_NAME).delete(item.id);
      console.log("Data offline berjaya dihantar!");
    } catch (e) {
      console.log("Menunggu internet stabil...");
    }
  }
}