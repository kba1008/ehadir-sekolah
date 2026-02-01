// sw.js - Versi 37 (Advanced Offline Sync)
const CACHE_NAME = 'ehadir-cache-v37';
const QUEUE_NAME = 'offline-attendance-queue';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Install & Cache Files
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// 2. Activate & Clean Old Cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
      })
    ))
  );
});

// 3. Intercept Fetch Requests
self.addEventListener('fetch', event => {
  const { request } = event;

  // Jika permintaan dihantar ke Google Apps Script (API_URL)
  if (request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Jika gagal (Offline), simpan data asal ke dalam "Queue"
        await saveToQueue(request);
        return new Response(JSON.stringify({ status: 'offline_saved' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } else {
    // Untuk fail biasa (HTML/JSON), ambil dari cache jika offline
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

// Fungsi untuk simpan data ke IndexedDB (Kunci Data Asal)
async function saveToQueue(request) {
  const body = await request.clone().text();
  const db = await openDB();
  const tx = db.transaction(QUEUE_NAME, 'readwrite');
  const store = tx.objectStore(QUEUE_NAME);
  
  // Data disimpan dengan timestamp asal dari HTML
  await store.add({
    url: request.url,
    method: request.method,
    body: body,
    timeSaved: new Date().toISOString()
  });
}

// Fungsi untuk buka IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ECheckDB', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(QUEUE_NAME, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 4. Background Sync: Hantar data bila ada internet
self.addEventListener('sync', event => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(sendQueueToServer());
  }
});

// Semakan berkala atau bila internet kembali
async function sendQueueToServer() {
  const db = await openDB();
  const tx = db.transaction(QUEUE_NAME, 'readwrite');
  const store = tx.objectStore(QUEUE_NAME);
  const allRequests = await new Promise(r => {
    const req = store.getAll();
    req.onsuccess = () => r(req.result);
  });

  for (const item of allRequests) {
    try {
      await fetch(item.url, {
        method: item.method,
        body: item.body,
        mode: 'no-cors'
      });
      // Jika berjaya hantar, padam dari queue
      const deleteTx = db.transaction(QUEUE_NAME, 'readwrite');
      const deleteStore = deleteTx.objectStore(QUEUE_NAME);
      // Nota: Logik ini perlu disesuaikan dengan ID item
    } catch (err) {
      console.error('Gagal hantar semula:', err);
    }
  }
}