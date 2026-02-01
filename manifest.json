// sw.js - Sistem Kehadiran Offline (Data Locking)
const CACHE_NAME = 'ehadir-cache-v37';
const DB_NAME = 'OfflineAttendanceDB';
const STORE_NAME = 'pending_submissions';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/2910/2910756.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method === 'POST' && request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // LOCK DATA: Simpan data asal (timestamp asal) ke IndexedDB
        await saveToIndexedDB(request.clone());
        return new Response(JSON.stringify({ result: 'success', offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } else {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

async function saveToIndexedDB(request) {
  const body = await request.text();
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.add({
    url: request.url,
    body: body,
    timestamp: new Date().getTime()
  });
}

function openDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

self.addEventListener('sync', event => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(processQueue());
  }
});

async function processQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const allEntries = await new Promise(r => {
    const req = store.getAll();
    req.onsuccess = () => r(req.result);
  });

  for (const entry of allEntries) {
    try {
      await fetch(entry.url, {
        method: 'POST',
        body: entry.body,
        mode: 'no-cors'
      });
      const deleteTx = db.transaction(STORE_NAME, 'readwrite');
      deleteTx.objectStore(STORE_NAME).delete(entry.id);
    } catch (e) {
      console.log("Masih offline...");
    }
  }
}