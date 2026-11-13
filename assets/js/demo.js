/* Mode demo: penghitung waktu, peringatan, dan layar "waktu habis". */
(function () {
  let info = null, timer = null, endAt = 0, warned = false, shown = false;
  const waURL = (text) => info && info.wa ? 'https://wa.me/' + info.wa + '?text=' + encodeURIComponent(text) : '';
  const mmss = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  window.onDemoGate = (state, extra) => {
    if (!info && extra) info = extra;
    if (state === 'expired') return expired();
    location.replace('demo.html');
  };

  function css() {
    if (document.getElementById('demo-css')) return;
    const st = document.createElement('style'); st.id = 'demo-css';
    st.textContent = `
.demo-pill{position:fixed;z-index:9000;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 6px);display:flex;align-items:center;gap:8px;
  background:rgba(20,35,58,.92);color:#fff;border-radius:999px;padding:5px 6px 5px 12px;font:600 12.5px/1 var(--font,system-ui);box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer;user-select:none}
.demo-pill .t{font-variant-numeric:tabular-nums;color:#F2C438}
.demo-pill .x{background:#F2C438;color:#3D2E00;border-radius:999px;padding:5px 10px;text-decoration:none}
.demo-pill.low{background:rgba(200,49,62,.95)} .demo-pill.low .t{color:#fff}
@media (max-width:719px){.demo-pill{left:auto;right:54px;transform:none}}
.demo-pill.solo{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);left:auto;right:14px;transform:none}
body.in-kasir .demo-pill{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);left:auto;right:10px;transform:none}
.demo-pop{position:fixed;inset:0;z-index:9500;background:rgba(10,18,32,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.demo-card{background:#fff;color:#14233A;border-radius:18px;max-width:420px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:var(--font,system-ui)}
.demo-card h2{font-size:20px;margin:0 0 6px} .demo-card p{color:#4A5A70;margin:0 0 12px;line-height:1.55}
.demo-card table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0 14px} .demo-card td{padding:6px 4px;border-bottom:1px solid #EBF0F6}
.demo-card code{background:#F4F7FB;border-radius:6px;padding:2px 6px}
.demo-card .row2{display:flex;gap:8px;flex-wrap:wrap} .demo-card .b{flex:1;display:inline-flex;align-items:center;justify-content:center;height:44px;border-radius:10px;font-weight:700;text-decoration:none;border:1px solid #DCE3EC;color:#14233A;background:#fff;cursor:pointer;font-size:14px}
.demo-card .b.wa{background:#1FA855;border-color:#1FA855;color:#fff}
.demo-card .big{font-size:40px;line-height:1;margin-bottom:10px}`;
    document.head.appendChild(st);
  }

  function pill() {
    let p = document.querySelector('.demo-pill');
    if (!p) {
      p = document.createElement('div'); p.className = 'demo-pill' + (/(absen|cek-stok)\.html$/.test(location.pathname) ? ' solo' : '');
      p.innerHTML = '<span>Demo</span><span class="t"></span><span class="x">Info</span>';
      p.addEventListener('click', helpBox);
      document.body.appendChild(p);
    }
    return p;
  }

  function tick() {
    const left = (endAt - Date.now()) / 1000;
    const p = pill();
    p.querySelector('.t').textContent = mmss(left);
    p.classList.toggle('low', left <= 300);
    if (left <= 300 && !warned) { warned = true; if (window.toast) toast('Sisa waktu demo 5 menit', 'Hubungi kami bila ingin memakai aplikasi ini untuk toko Anda.'); }
    if (left <= 0) expired();
  }

  function helpBox() {
    css();
    const box = document.createElement('div'); box.className = 'demo-pop';
    const wa = waURL(`Halo, saya ${info.name || ''} baru mencoba demo ${info.brand || 'aplikasi kasir'}. Saya ingin tanya harga & pemasangannya.`);
    box.innerHTML = `<div class="demo-card"><h2>Mode demo</h2>
      <p>Silakan coba semua fitur — data di sini contoh dan hanya untuk Anda. Sisa waktu: <b>${mmss((endAt - Date.now()) / 1000)}</b>.</p>
      <table><tr><td>Pemilik / admin</td><td><code>admin@toko.com</code> · <code>admin12345</code></td></tr>
      <tr><td>Kasir</td><td><code>nita@toko.com</code> · <code>demo1234</code></td></tr>
      <tr><td>PIN admin</td><td><code>1234</code></td></tr></table>
      <p style="font-size:13px">Coba: transaksi di Kasir, promo Buy 1 Get 1, member & poin, QRIS, Dashboard, Absen (absen.html), dan Komisi di menu Sales.</p>
      <div class="row2"><button class="b" data-x>Lanjut mencoba</button>${wa ? `<a class="b wa" target="_blank" rel="noopener" href="${wa}">Tanya via WhatsApp</a>` : ''}</div></div>`;
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('[data-x]')) box.remove(); });
    document.body.appendChild(box);
  }

  function expired() {
    if (shown) return; shown = true;
    clearInterval(timer); css();
    const p = document.querySelector('.demo-pill'); if (p) p.remove();
    document.querySelectorAll('.demo-pop').forEach((x) => x.remove());
    const box = document.createElement('div'); box.className = 'demo-pop'; box.style.background = 'linear-gradient(160deg,#062246,#04396E)';
    const name = info && info.name ? info.name : '';
    const wa = waURL(`Halo, saya ${name} sudah mencoba demo ${(info && info.brand) || 'aplikasi kasir'}. Saya tertarik memakainya untuk toko saya.`);
    box.innerHTML = `<div class="demo-card" style="text-align:center"><div class="big">⏰</div><h2>Waktu demo sudah habis</h2>
      <p>Terima kasih${name ? ', ' + name.replace(/[<>&"]/g, '') : ''}, sudah mencoba aplikasinya. Aplikasi ini bisa disesuaikan dengan kebutuhan toko Anda — promo, member, laporan, absen, dan lainnya.</p>
      <div class="row2">${wa ? `<a class="b wa" target="_blank" rel="noopener" href="${wa}">Hubungi kami via WhatsApp</a>` : '<span class="b">Hubungi kami untuk versi lengkap</span>'}</div></div>`;
    document.body.appendChild(box);
  }

  async function start() {
    if (/demo\.html$/.test(location.pathname)) return; // halaman pendaftaran demo
    try { info = await api('demo_info', { client_id: clientId() }); } catch (e) { return; }
    if (!info) return;
    if (info.state === 'used') return expired();
    if (info.state !== 'active') return location.replace('demo.html');
    css();
    endAt = Date.now() + info.remaining * 1000;
    tick(); timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }
  function clientId() { try { let c = localStorage.getItem('kasir-demo-id'); if (!c) { c = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('kasir-demo-id', c); } return c; } catch (e) { return ''; } }
  window.DemoMode = { clientId, helpBox };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
