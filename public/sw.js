/* OnlyBudget service worker: cache the app shell so the web version opens offline.
   Data never goes through here; SQLite lives in the browser's own storage. */
const CACHE = 'onlybudget-shell-v1';
const PRECACHE = ['/', '/sw-register.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Navigation requests: network first, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((res) => { caches.open(CACHE).then((c) => c.put('/', res.clone())); return res; }).catch(() => caches.match('/')));
    return;
  }
  // Hashed assets: cache first.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
      return res;
    })),
  );
});
