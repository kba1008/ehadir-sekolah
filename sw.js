const CACHE_NAME = 'ehadir-v42';
const DB_NAME = 'E-Hadir-Offline-DB';
const STORE_NAME = 'attendance_queue';

// Senarai fail untuk app berjalan tanpa internet (App Shell)
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.ico',
  // Tambah fail CSS/JS anda di sini jika ada
];

// --- INSTALL & ACTIVATE ---
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(assetsToCache)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => k !== CACHE_NAME && caches.delete(k)))));
});

// --- LOGIK PINTAR: OFFLINE MODE ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Jika user hantar data kehadiran (POST)
  if (request.method === 'POST') {
    event.respondWith(
      fetch(request.clone())
        .then(async (response) => {
          // Jika internet ada tapi server error (500), simpan offline juga
          if (!response.ok) throw new Error('Server Error');
          return response;
        })
        .catch(async () => {
          // INTERNET MATI / LEMAH: Simpan dalam IndexedDB
          await saveToIndexedDB(request.clone());
          return new Response(JSON.stringify({ 
            result: 'success', 
            offline: true, 
            msg: 'Data disimpan offline (Tiada Internet)' 
          }), { headers: { 'Content-Type': 'application/json' } });
        })
    );
    return;
  }

  // Paparan UI: Ambil dari Cache jika Offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// --- PENGURUSAN DATA OFFLINE (INDEXEDDB) ---
function openDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
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
  console.log("Data 'DILOCK' dalam storan peranti.");
}

// Auto-Sync (Setiap 15 saat semak internet)
let syncing = false;
setInterval(async () => {
  if (navigator.onLine && !syncing) {
    syncing = true;
    await syncData();
    syncing = false;
  }
}, 15000);

async function syncData() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const items = await new Promise(r => {
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => r(req.result);
  });

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: 'POST',
        body: item.payload,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (res.ok) {
        const delTx = db.transaction(STORE_NAME, 'readwrite');
        await delTx.objectStore(STORE_NAME).delete(item.id);
        console.log("Data berjaya dihantar & dipadam dari peranti.");
      }
    } catch (e) {
      console.log("Internet masih lemah, simpan dulu...");
      break; 
    }
  }
}