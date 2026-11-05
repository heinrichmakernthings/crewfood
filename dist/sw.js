// Crew Table service worker: installable app that also works offline.
// Bump CACHE when you release, so installed copies pick up the new files straight away.
const CACHE = 'crew-table-v3';
const FILES = ['./', 'index.html', 'style.css', 'app.mjs', 'model.mjs', 'data.mjs', 'plan.mjs', 'reports.mjs', 'charts.mjs', 'equipment.mjs', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Show the saved copy straight away, then refresh it in the background.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(r, {ignoreSearch: true});
    const net = fetch(r).then(res => { if (res.ok) cache.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});
