/* Service worker: membuat aplikasi tetap terbuka walau sinyal hilang.
   Hemat kuota: saat versi naik hanya berkas inti (±130 KB terkompresi) yang diunduh ulang.
   Pustaka besar (Excel, template Word/Excel, halaman admin) baru disimpan saat pertama kali dipakai. */
const CACHE = 'sakti-v68';
const PUSTAKA = 'sakti-pustaka-1';   // berkas bernama-versi (vendor/, fonts/): disimpan sekali, tidak diunduh ulang tiap versi
// berkas lain (gambar latar, docx.js, dinas.js, admin, kuis) tetap tersimpan otomatis saat pertama kali dibuka
const INTI = ['./', 'index.html', 'input.html', 'tema.css', 'config.js', 'common.js', 'excel.js', 'rkpicker.js', 'manifest-input.json', 'manifest-dashboard.json', 'icons/input-192.png', 'icons/dashboard-192.png', 'img/logo-sakti.svg', 'img/karakter-perempuan.webp', 'img/karakter-laki.webp'];
const PUSTAKA_INTI = ['vendor/supabase-js-2.119.0.js', 'fonts/nunito.woff2'];
const tetap = u => /\/(vendor|fonts)\//.test(u.pathname);

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(INTI.map(f => new Request(f, { cache: 'reload' })))),
    caches.open(PUSTAKA).then(async c => { for (const f of PUSTAKA_INTI) if (!(await c.match(f))) await c.add(f); })
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== PUSTAKA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Hanya berkas aplikasi yang disimpan; data database selalu langsung ke server
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Pustaka & huruf bernama-versi: ambil dari simpanan dulu (lebih cepat), unduh hanya bila belum ada
  if (tetap(u)) {
    e.respondWith(caches.open(PUSTAKA).then(c => c.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  // Berkas aplikasi: jaringan dulu & selalu cek versi terbaru ke server, pakai simpanan bila offline
  e.respondWith(fetch(new Request(e.request, { cache: 'no-cache' })).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
