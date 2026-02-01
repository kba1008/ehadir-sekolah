// sw.js - E-HADIR (Fixed: No Duplicates & Auto-Update)
const CACHE_NAME = 'ehadir-v41'; // Versi dinaikkan
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

// 3. Logik Fetch (Network First untuk Update UI Segera)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        await saveToIndexedDB(request.clone());
        return new Response(JSON.stringify({ result: 'success', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// --- FUNGSI INDEXEDDB YANG DIBAIKI ---

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // PENTING: keyPath 'id' memastikan data boleh dipadam dengan tepat
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(request) {
  const body = await request.text();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  await store.add({
    url: request.url,
    payload: body,
    timestamp: Date.now()
  });
}

// Lock untuk elak proses bertindih (Race Condition)
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

  if (allData.length === 0) return;

  for (const item of allData) {
    try {
      // Hantar data ke server
      const response = await fetch(item.url, {
        method: 'POST',
        body: item.payload,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.ok) {
        // PADAM hanya jika server sahkan terima (HTTP 200)
        const delTx = db.transaction(STORE_NAME, 'readwrite');
        await delTx.objectStore(STORE_NAME).delete(item.id);
        console.log(`Data ID ${item.id} berjaya disinkronkan.`);
      }
    } catch (e) {
      console.error("Gagal hantar, internet mungkin tidak stabil.");
      break; // Berhenti seketika, cuba lagi 15 saat kemudian
    }
  }
}