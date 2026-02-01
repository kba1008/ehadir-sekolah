// sw.js - E-HADIR (Offline-First & Auto-Sync)
const CACHE_NAME = 'ehadir-v43';
const DB_NAME = 'E-Hadir-Offline-DB';
const STORE_NAME = 'attendance_queue';

const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.ico'
];

// 1. Install: Simpan aset asas ke dalam cache
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

// 2. Activate: Padam cache lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => k !== CACHE_NAME && caches.delete(k))
    ))
  );
});

// 3. Strategi Fetch: Kendalikan Data & Navigasi
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // A. KENDALI DATA (POST)
  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone())
        .then(response => {
           if (!response.ok) throw new Error('Server Error');
           return response;
        })
        .catch(async () => {
          // Jika gagal (offline/server down), simpan ke IndexedDB
          await saveToIndexedDB(request.clone());
          return new Response(JSON.stringify({ 
            result: 'success', 
            offline: true,
            message: 'Data disimpan secara offline.' 
          }), { headers: { 'Content-Type': 'application/json' } });
        })
    );
    return;
  }

  // B. KENDALI NAVIGASI (Elak skrin "You're offline")
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // C. KENDALI ASET (Imej, CSS, JS)
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(request, fetchRes.clone());
          return fetchRes;
        });
      });
    })
  );
});

// --- PENGURUSAN INDEXEDDB ---
function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      // Gunakan keyPath 'id' untuk mengelakkan data berulang
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function saveToIndexedDB(request) {
  const body = await request.text();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).add({
    url: request.url,
    payload: body,
    time: new Date().toISOString()
  });
}

// Auto-Sync Lock: Elak proses hantaran bertindih
let isSyncing = false;
setInterval(async () => {
  if (navigator.onLine && !isSyncing) {
    isSyncing = true;
    await sendOfflineData();
    isSyncing = false;
  }
}, 15000);

async function sendOfflineData() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const allData = await new Promise(r => {
    const res = store.getAll();
    res.onsuccess = () => r(res.result);
  });

  for (const item of allData) {
    try {
      const response = await fetch(item.url, {
        method: 'POST',
        body: item.payload,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.ok) {
        // Padam hanya selepas server sahkan terima data
        const delTx = db.transaction(STORE_NAME, 'readwrite');
        await delTx.objectStore(STORE_NAME).delete(item.id);
        console.log("Data offline disinkronkan.");
      }
    } catch (e) {
      break; // Berhenti jika internet masih tidak stabil
    }
  }
}