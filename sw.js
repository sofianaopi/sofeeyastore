/* Service worker Sofeeya POS — membuat aplikasi bisa diinstal & cepat dibuka.
   Data (api/) selalu diambil langsung dari server, tidak pernah disimpan di cache. */
const VERSION = 'sofeeya-v7';
const ASSETS = [
  './', 'index.html', 'absen.html', 'cek-stok.html', 'manifest.json',
  'assets/css/app.css?v=7', 'assets/js/core.js?v=7', 'assets/js/promo.js?v=7', 'assets/js/qrlib.js?v=7',
  'assets/js/qris.js?v=7', 'assets/js/app.js?v=7', 'assets/js/views.js?v=7', 'assets/js/solo.js?v=7',
  'assets/img/icon-192.png', 'assets/img/icon-512.png', 'assets/img/icon-maskable-512.png', 'assets/img/apple-touch-icon.png', 'assets/img/favicon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes('/api/')) return; // data selalu online
  if (req.mode === 'navigate') { // halaman: utamakan versi terbaru, cadangan dari cache saat offline
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
