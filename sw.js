// sw.js - Sistem E-HADIR Professional (Android & iOS Support)
const CACHE_NAME = 'ehadir-v38';
const OFFLINE_DB = 'E-Hadir-DB';
const STORE_NAME = 'kehadiran_queue';

const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/9334/9334537.png'
];

// 1. Install & Simpan Paparan Asal (Offline Ready)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

// 2. Aktifkan & Bersihkan Cache Lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => k !== CACHE_NAME && caches.delete(k))
    ))
  );
});

// 3. Logik Pintar: Offline Paparan & Offline Data Locking
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST') {
    // TANGKAP DATA PENGHANTARAN (Offline Mode)
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        await saveAttendanceOffline(event.request.clone());
        return new Response(JSON.stringify({ 
          result: 'success', 
          message: 'Data dikunci (Offline Mode)' 
        }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
  } else {
    // PAPARAN MUKA HADAPAN (Sentiasa ambil dari cache jika offline)
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
  }
});

// FUNGSI KUNCI DATA DALAM INDEXEDDB
async function saveAttendanceOffline(request) {
  const body = await request.text();
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  // Data disimpan bulat-bulat (Masa dari HTML tidak akan berubah)
  await store.add({
    url: request.url,
    payload: body,
    timeCaptured: new Date().toISOString()
  });
}

function openDatabase() {
  return new Promise((resolve) => {
    const req = indexedDB.open(OFFLINE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
  });
}

// AUTO-SYNC: Hantar data bila internet kembali
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-attendance') e.waitUntil(sendOfflineData());
});

// Semakan berkala untuk sokongan iPhone (iOS tidak sokong 'sync' event dengan baik)
setInterval(() => {
  if (navigator.onLine) sendOfflineData();
}, 10000);

async function sendOfflineData() {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const data = await new Promise((r) => {
    const req = store.getAll();
    req.onsuccess = () => r(req.result);
  });

  for (const item of data) {
    try {
      await fetch(item.url, {
        method: 'POST',
        body: item.payload,
        mode: 'no-cors'
      });
      // Padam dari queue jika berjaya
      const delTx = db.transaction(STORE_NAME, 'readwrite');
      delTx.objectStore(STORE_NAME).delete(item.id);
    } catch (err) {
      console.log("Menunggu internet...");
    }
  }
}