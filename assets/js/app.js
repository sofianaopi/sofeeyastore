/* Sofeeya Store POS — kerangka aplikasi + halaman Kasir */
'use strict';

const App = {
  user: null, settings: {}, view: null, views: {}, cleanup: null,
  sig: null, lastTx: 0, newTx: [], pendingChecks: 0,

  NAV: [
    { id: 'kasir', label: 'Kasir', icon: 'kasir', can: () => true },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', can: (u) => u.role === 'admin' },
    { id: 'laporan', label: 'Laporan keuangan', icon: 'laporan', can: () => true },
    { id: 'pengiriman', label: 'Pengiriman', icon: 'truck', can: () => true },
    { id: 'qris', label: 'QRIS', icon: 'qr', can: () => true },
    { id: 'produk', label: 'Produk & stok', icon: 'produk', can: (u) => u.role === 'admin' },
    { id: 'promo', label: 'Promo', icon: 'promo', can: (u) => u.promo_access },
    { id: 'member', label: 'Member', icon: 'member', can: () => true },
    { id: 'sales', label: 'Sales & komisi', icon: 'sales', can: (u) => u.role === 'admin' },
    { sep: true },
    { id: 'pengaturan', label: 'Pengaturan toko', icon: 'setting', can: (u) => u.role === 'admin' },
    { id: 'pengguna', label: 'Pengguna', icon: 'users', can: (u) => u.role === 'admin' },
    { id: 'printer', label: 'Printer', icon: 'printer', can: () => true },
    { id: 'akun', label: 'Akun saya', icon: 'akun', can: () => true },
  ],
  isAdmin() { return this.user && this.user.role === 'admin'; },

  // ---- tata letak: otomatis / potret / lanskap (disimpan per perangkat)
  layoutPref() { try { return localStorage.getItem('pos-layout') || 'auto'; } catch (e) { return 'auto'; } },
  setLayout(v) { try { localStorage.setItem('pos-layout', v); } catch (e) { /* abaikan */ } this.applyLayout(); if (v !== 'auto' && screen.orientation && screen.orientation.lock) screen.orientation.lock(v === 'land' ? 'landscape' : 'portrait').catch(() => {}); else if (screen.orientation && screen.orientation.unlock) try { screen.orientation.unlock(); } catch (e) { /* abaikan */ } },
  applyLayout() {
    const w = window.innerWidth, h = window.innerHeight, pref = this.layoutPref();
    const o = pref === 'auto' ? (w >= h ? 'land' : 'port') : pref;
    const b = document.body.classList;
    b.toggle('o-land', o === 'land'); b.toggle('o-port', o === 'port');
    b.toggle('d-phone', Math.min(w, h) < 600);
    b.toggle('compact', w < 720 || Math.min(w, h) < 600);
  },
  layoutMenu(anchor) {
    $$('.laymenu').forEach((x) => x.remove());
    const r = anchor.getBoundingClientRect(), cur = this.layoutPref();
    const m = document.createElement('div'); m.className = 'laymenu';
    m.innerHTML = [['auto', 'Otomatis (ikuti layar)', 'rotate'], ['port', 'Potret', 'phone'], ['land', 'Lanskap', 'tablet']].map(([k, l, ic]) => `<button data-lay="${k}" class="${cur === k ? 'on' : ''}">${icon(ic)}${l}</button>`).join('');
    m.style.top = Math.min(window.innerHeight - 150, r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(window.innerWidth - 200, r.right - 190)) + 'px';
    m.style.position = 'fixed';
    document.body.appendChild(m);
    const close = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', close, true); } };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
    m.onclick = (e) => { const b = e.target.closest('[data-lay]'); if (!b) return; this.setLayout(b.dataset.lay); m.remove(); toast('Tampilan: ' + b.textContent.trim()); };
  },
  // ---- sidebar
  rail(open) { const r = $('.rail'); if (!r) return; r.classList.toggle('open', open); document.body.classList.toggle('rail-open', open); },
  // ---- pasang aplikasi (PWA)
  installEvt: null,
  isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; },
  async install() {
    if (this.installEvt) { this.installEvt.prompt(); const r = await this.installEvt.userChoice; if (r.outcome === 'accepted') { toast('Aplikasi dipasang', 'Buka dari layar utama HP.', 'ok'); this.installEvt = null; this.updateInstall(); } return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    modal({ title: 'Pasang aplikasi di HP / tablet', body: ios
      ? '<ol style="margin:0;padding-left:18px;line-height:1.8"><li>Buka halaman ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambahkan ke Layar Utama</b> → <b>Tambah</b>.</li></ol>'
      : '<ol style="margin:0;padding-left:18px;line-height:1.8"><li>Buka halaman ini di <b>Google Chrome</b>.</li><li>Ketuk menu <b>⋮</b> di kanan atas.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li></ol><p class="small muted">Pastikan website memakai HTTPS (gembok di alamat). Aplikasi lalu terbuka layar penuh seperti aplikasi biasa.</p>' });
  },
  updateInstall() { $$('[data-install]').forEach((b) => b.classList.toggle('hidden', this.isStandalone())); },

  async start() {
    this.applyLayout();
    window.addEventListener('resize', debounce(() => this.applyLayout(), 120));
    window.addEventListener('orientationchange', () => setTimeout(() => this.applyLayout(), 200));
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.installEvt = e; this.updateInstall(); });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.onSessionExpired = () => { if (this.user) { this.user = null; toast('Sesi berakhir', 'Silakan masuk kembali.', 'err'); this.renderLogin(); } };
    try {
      const b = await api('boot');
      this.settings = b.settings || {};
      if (b.user) { this.user = b.user; this.renderShell(); } else this.renderLogin();
    } catch (e) {
      $('#app').innerHTML = `<div class="solo"><div class="panel panel-b"><h2>Tidak dapat memuat aplikasi</h2><p class="muted">${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Coba lagi</button></div></div>`;
    }
  },

  // ------------------------------------------------------------ login
  renderLogin() {
    document.body.classList.remove('in-kasir', 'rail-open', 'cart-open'); this.applyLayout();
    const name = this.settings.store_name || 'Sofeeya Store';
    $('#app').innerHTML = `
    <div class="login">
      <div class="login-art">
        <div class="brandmark" style="padding:0"><div class="logo" style="background:#fff;color:var(--brand)">${esc(name[0] || 'S')}</div><div><b>${esc(name)}</b><span style="color:rgba(255,255,255,.75)">Kasir & stok toko</span></div></div>
        <div><h1>Kasir, stok, dan member toko dalam satu layar.</h1><p>Scan barang, terapkan promo otomatis, cetak struk, dan pantau omzet harian dari HP maupun komputer.</p></div>
        <p class="small" style="opacity:.6;position:relative">© ${new Date().getFullYear()} ${esc(name)}</p>
      </div>
      <div class="login-form">
        <form id="loginForm" class="stack" autocomplete="on">
          <div><h1>Masuk</h1><p class="muted" style="margin:4px 0 0">Gunakan akun yang diberikan admin toko.</p></div>
          ${field('Email', 'email', '', { type: 'email', placeholder: 'nama@toko.com', attrs: 'autocomplete="username" required' })}
          <label class="f">Kata sandi<div style="position:relative"><input class="input" name="password" type="password" required autocomplete="current-password" style="padding-right:42px"><button type="button" class="btn ghost sm icon" data-eye style="position:absolute;right:4px;top:4px" aria-label="Tampilkan sandi">${icon('search')}</button></div></label>
          <p class="danger small bold hidden" data-err></p>
          <button class="btn primary" style="height:46px">Masuk</button>
          <div class="login-links">
            <a href="absen.html">${icon('finger')}<div>Absen pegawai<span>Absen datang & pulang dari WiFi toko</span></div></a>
            <a href="cek-stok.html">${icon('clipboard')}<div>Cek stok barang<span>Untuk petugas yang diberi akses</span></div></a>
          </div>
        </form>
      </div>
    </div>`;
    const f = $('#loginForm');
    $('[data-eye]', f).onclick = () => { const i = $('[name=password]', f); i.type = i.type === 'password' ? 'text' : 'password'; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('button.primary', f), err = $('[data-err]', f);
      btn.disabled = true; btn.textContent = 'Memeriksa…'; err.classList.add('hidden');
      try {
        const r = await api('login', formValues(f));
        this.user = r.user; this.settings = r.settings; location.hash = ''; this.renderShell();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Masuk'; }
    };
  },

  async logout() {
    try { await api('logout'); } catch (e) { /* abaikan */ }
    this.user = null; clearInterval(this.pingTimer); location.hash = ''; this.renderLogin();
  },

  // ------------------------------------------------------------ shell
  renderShell() {
    const u = this.user, name = this.settings.store_name || 'Sofeeya Store';
    const nav = this.NAV.filter((n) => n.sep || n.can(u));
    $('#app').innerHTML = `
    <div class="shell">
      <aside class="rail">
        <div class="brandmark" data-railtoggle title="Menu"><div class="logo">${esc(name[0] || 'S')}</div><div><b>${esc(name)}</b><span>${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div></div>
        <nav class="nav">${nav.map((n) => n.sep ? '<div class="sep"></div>' : `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${esc(n.label)}</span>${n.id === 'laporan' ? '<span class="badge hidden" data-txbadge></span>' : ''}${n.id === 'produk' ? '<span class="badge hidden" data-chkbadge></span>' : ''}</a>`).join('')}
          <div class="sep"></div>
          <a href="absen.html">${icon('finger')}<span>Absen</span></a>
          ${u.cek_stok_access ? `<a href="cek-stok.html">${icon('clipboard')}<span>Cek stok</span></a>` : ''}
          ${u.role === 'admin' ? `<a href="#" data-broadcast>${icon('refresh')}<span>Refresh semua perangkat</span></a>` : ''}
          <a href="#" data-install>${icon('download')}<span>Pasang aplikasi di HP</span></a>
          <a href="#" data-layout>${icon('rotate')}<span>Tampilan potret / lanskap</span></a>
        </nav>
        <div class="me"><div class="avatar">${esc((u.name || 'U')[0])}</div><div class="grow"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.name)}</b><span class="tiny muted">${u.role === 'admin' ? 'Admin' : 'Kasir'}</span></div><button class="btn ghost icon sm" data-logout title="Keluar" aria-label="Keluar">${icon('logout')}</button></div>
      </aside>
      <div class="scrim" data-scrim></div>
      <div class="main">
        <header class="topbar"><button class="btn ghost icon" data-menu aria-label="Menu">${icon('menu')}</button><div class="grow"><span class="sub">${esc(name)}</span><b data-title>Kasir</b></div><button class="btn ghost icon" data-logout aria-label="Keluar">${icon('logout')}</button></header>
        <div class="page" id="page"></div>
      </div>
      <nav class="tabbar">
        <a href="#kasir" data-tab="kasir">${icon('kasir')}Kasir</a>
        <a href="#laporan" data-tab="laporan">${icon('laporan')}Laporan</a>
        <a href="#${u.role === 'admin' ? 'produk' : 'member'}" data-tab="${u.role === 'admin' ? 'produk' : 'member'}">${icon(u.role === 'admin' ? 'produk' : 'member')}${u.role === 'admin' ? 'Produk' : 'Member'}</a>
        <a href="#" data-menu>${icon('menu')}Menu</a>
      </nav>
    </div>`;
    $$('[data-logout]').forEach((b) => (b.onclick = () => this.logout()));
    $$('[data-menu]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); this.rail(!$('.rail').classList.contains('open')); }));
    $('[data-scrim]').onclick = () => this.rail(false);
    const rail = $('.rail');
    $('[data-railtoggle]').onclick = () => this.rail(!rail.classList.contains('open'));
    // desktop: buka saat kursor mendekat, tutup otomatis saat kursor pergi
    rail.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !document.body.classList.contains('compact')) this.rail(true); });
    rail.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !document.body.classList.contains('compact')) this.rail(false); });
    rail.addEventListener('click', (e) => { if (e.target.closest('.nav a[href^="#"]:not([data-broadcast]):not([data-install]):not([data-layout])')) this.rail(false); });
    $('[data-install]').onclick = (e) => { e.preventDefault(); this.install(); };
    $('[data-layout]').onclick = (e) => { e.preventDefault(); this.layoutMenu(e.currentTarget); };
    this.updateInstall();
    const bc = $('[data-broadcast]');
    if (bc) bc.onclick = async (e) => {
      e.preventDefault();
      if (!(await confirmBox('Refresh semua perangkat?', 'Semua perangkat kasir yang sedang terbuka akan memuat ulang dalam ±20 detik. Gunakan setelah mengubah harga atau promo.', 'Kirim refresh', false))) return;
      try { const r = await api('broadcast_refresh'); this.sig = r.id; toast('Perintah refresh terkirim', '', 'ok'); } catch (ex) { toastErr(ex); }
    };
    window.onhashchange = () => this.route();
    this.route();
    this.startPing();
    if (Printer.saved()) Printer.restore();
    // perbarui langganan notifikasi HP pemilik (bila browser menggantinya diam-diam)
    if (this.isAdmin() && Push.supported && Notification.permission === 'granted') Push.current().then((sub) => sub && api('push_subscribe', { subscription: sub.toJSON() })).catch(() => {});
  },

  route() {
    const u = this.user; if (!u) return;
    let id = (location.hash || '').replace('#', '').split('/')[0];
    const allowed = this.NAV.filter((n) => !n.sep && n.can(u)).map((n) => n.id);
    if (!allowed.includes(id)) id = u.role === 'admin' ? 'dashboard' : 'kasir';
    this.rail(false); document.body.classList.remove('cart-open');
    document.body.classList.toggle('in-kasir', id === 'kasir');
    $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === id));
    $$('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === id));
    const item = this.NAV.find((n) => n.id === id);
    $('[data-title]').textContent = item ? item.label : '';
    document.title = (item ? item.label + ' — ' : '') + (this.settings.store_name || 'Sofeeya Store');
    if (this.cleanup) { try { this.cleanup(); } catch (e) { /* abaikan */ } this.cleanup = null; }
    const page = $('#page');
    page.className = 'page' + (id === 'kasir' ? ' flush' : '');
    page.innerHTML = '<div class="empty">Memuat…</div>';
    this.view = id;
    if (id === 'laporan') { this.newTx = []; this.updateBadges(); }
    const v = id === 'kasir' ? Kasir : this.views[id];
    Promise.resolve(v ? v(page) : null).then((c) => { if (typeof c === 'function') this.cleanup = c; }).catch((e) => { page.innerHTML = `<div class="panel panel-b"><b>Gagal memuat halaman</b><p class="muted">${esc(e.message)}</p></div>`; });
  },

  startPing() {
    clearInterval(this.pingTimer);
    const tick = async () => {
      try {
        const r = await api('ping', { since_tx: this.lastTx });
        if (this.sig === null) this.sig = r.signal;
        else if (r.signal > this.sig) { toast('Memuat ulang…', 'Admin meminta semua perangkat refresh.'); setTimeout(() => location.reload(), 700); return; }
        if (this.isAdmin()) {
          if (this.lastTx && r.new_tx && r.new_tx.length) {
            r.new_tx.filter((t) => t.cashier_id !== this.user.id).forEach((t) => { toast('Transaksi baru ' + rupiah(t.total), `${t.invoice} · kasir ${t.cashier}`); this.newTx.push(t); });
          }
          this.lastTx = r.last_tx || this.lastTx; this.pendingChecks = r.pending_checks || 0; this.updateBadges();
        }
      } catch (e) { /* offline sementara */ }
    };
    tick(); this.pingTimer = setInterval(tick, 20000);
  },
  updateBadges() {
    const b = $('[data-txbadge]'); if (b) { b.textContent = this.newTx.length; b.classList.toggle('hidden', !this.newTx.length); }
    const c = $('[data-chkbadge]'); if (c) { c.textContent = this.pendingChecks; c.classList.toggle('hidden', !this.pendingChecks); }
  },
};

// =====================================================================
//  HALAMAN KASIR
// =====================================================================
async function Kasir(page) {
  const S = App.settings, isAdmin = App.isAdmin();
  const st = {
    products: [], promos: [], members: [], sales: [], rewards: [],
    cart: [], cat: 'Semua', q: '', memberId: null, vouchers: [], fees: [], shipping: null, reward: null, note: '', offerShown: false, retur: null,
  };
  page.innerHTML = `
  <div class="pos">
    <section class="pos-left">
      <div class="pos-tools">
        <button class="btn icon kasir-menu" data-kmenu aria-label="Menu">${icon('menu')}</button>
        <form class="scanbox" data-scanform>${icon('barcode')}<input data-scan placeholder="Scan barcode atau ketik nama barang…" autocomplete="off" aria-label="Scan barcode atau cari barang"></form>
        <button class="btn icon" data-camera title="Scan pakai kamera" aria-label="Scan pakai kamera">${icon('camera')}</button>
        <button class="btn" data-addprod title="Tambah barang baru">${icon('plus')}<span class="hide-sm">Barang</span></button>
        <button class="btn icon prn-btn" data-prn title="Printer & struk terakhir" aria-label="Printer & struk terakhir">${icon('printer')}<i class="prn-dot"></i></button>
        <button class="btn icon" data-lay title="Tampilan potret / lanskap" aria-label="Tampilan potret / lanskap">${icon('rotate')}</button>
      </div>
      <div class="cats" data-cats></div>
      <div class="promostrip" data-promos></div>
      <div class="products" data-grid><div class="empty">Memuat barang…</div></div>
      <div class="cartfab"><button class="btn gold" data-opencart><span>${icon('cart')} <span data-fabcount>0 barang</span></span><b data-fabtotal>Rp0</b></button></div>
    </section>
    <aside class="cartcol">
      <div class="receipt">
        <div class="rc-h">
          <div class="row"><button class="btn ghost icon sm mobile-only" data-closecart aria-label="Tutup keranjang">${icon('arrowleft')}</button><b class="grow">Keranjang</b><button class="btn ghost sm" data-clear>Kosongkan</button></div>
          <div class="row wrap" style="margin-top:8px">
            <button class="btn sm" data-member>${icon('member')}<span data-membername>Pilih member</span></button>
            <button class="btn sm" data-voucher>${icon('promo')}Kode promo</button>
            <button class="btn sm" data-fee>${icon('wallet')}Biaya</button>
            <button class="btn sm" data-ship>${icon('truck')}<span data-shiplabel>Kirim</span></button>
            <button class="btn sm" data-retur>${icon('rotate')}<span data-returlabel>Tukar / retur</span></button>
          </div>
        </div>
        <div data-upsell></div>
        <div class="rc-items" data-items></div>
        <div class="rc-extras hidden" data-extras></div>
        <div class="rc-tot" data-totals></div>
      </div>
      <div class="zig"></div>
      <div class="paybar"><button class="btn gold" data-pay disabled>Bayar</button></div>
    </aside>
  </div>`;
  const style = document.createElement('style');
  style.textContent = '@media(max-width:520px){.hide-sm{display:none}} body.d-phone .hide-sm{display:none}';
  page.appendChild(style);

  const el = (s) => $(s, page);
  const scan = el('[data-scan]');

  // ---------- muat data
  try {
    const [products, promos, members, sales, rewards] = await Promise.all([
      db.list('products'), db.list('promos', { where: { active: 1 } }), db.list('members'),
      db.list('sales', { where: { active: 1 } }), db.list('point_rewards', { where: { active: 1 } }),
    ]);
    Object.assign(st, { products, promos, members, sales, rewards });
  } catch (e) { toastErr(e); }

  // ---------- memori: keranjang & struk terakhir tersimpan di perangkat (aman saat halaman dimuat ulang)
  const DKEY = 'pos-draft-' + App.user.id, LKEY = 'pos-last-' + App.user.id;
  const newRef = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
  let ref = newRef(), pending = false;
  function saveDraft() {
    try {
      const empty = !st.cart.length && !st.retur && !st.memberId && !st.fees.length && !st.shipping && !st.vouchers.length && !st.reward;
      if (empty && !pending) { localStorage.removeItem(DKEY); return; }
      localStorage.setItem(DKEY, JSON.stringify({ v: 1, at: Date.now(), ref, pending, cart: st.cart, memberId: st.memberId, vouchers: st.vouchers.map((p) => p.id), fees: st.fees, shipping: st.shipping, reward: st.reward, note: st.note, retur: st.retur, offerShown: st.offerShown, cat: st.cat }));
    } catch (e) { /* penyimpanan penuh / mode privat */ }
  }
  const rememberLast = (trx) => { try { localStorage.setItem(LKEY, JSON.stringify({ id: trx.id, invoice: trx.invoice, at: Date.now() })); } catch (e) { /* abaikan */ } };
  const lastInfo = () => { try { return JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch (e) { return null; } };
  async function restoreDraft() {
    let d = null; try { d = JSON.parse(localStorage.getItem(DKEY) || 'null'); } catch (e) { /* rusak */ }
    if (!d || d.v !== 1) return;
    if (Date.now() - d.at > 3 * 86400000) { localStorage.removeItem(DKEY); return; }
    // halaman dimuat ulang saat pembayaran sedang dikirim: cek apakah sudah tersimpan di server
    if (d.pending && d.ref) {
      try {
        const trx = await api('checkout_status', { client_ref: d.ref });
        if (trx) { localStorage.removeItem(DKEY); rememberLast(trx); toast('Transaksi sudah tersimpan', trx.invoice + ' tersimpan sebelum halaman dimuat ulang.', 'ok'); doneModal(trx); return; }
      } catch (e) { /* offline: tetap pulihkan keranjang */ }
    }
    ref = d.ref || newRef();
    let dropped = 0, changed = 0;
    st.cart = (d.cart || []).map((c) => {
      const p = st.products.find((x) => x.id === c.id);
      if (!p || p.stock <= 0) { dropped++; return null; }
      const manual = c.price !== c.original_price, q = Math.min(c.qty, p.stock);
      if (q < c.qty || (!manual && p.price !== c.price)) changed++;
      return { ...c, name: p.name, barcode: p.barcode, category: p.category, model: p.model, size: p.size, color: p.color, cost: p.cost, commission: p.commission, discount: p.discount || 0, stock: p.stock, price: manual ? c.price : p.price, original_price: p.price, qty: q };
    }).filter(Boolean);
    st.memberId = d.memberId && st.members.some((m) => m.id === d.memberId) ? d.memberId : null;
    st.vouchers = (d.vouchers || []).map((id) => st.promos.find((p) => p.id === id)).filter((p) => p && Promo.activeToday(p));
    st.fees = Array.isArray(d.fees) ? d.fees : []; st.shipping = d.shipping || null; st.note = d.note || ''; st.retur = d.retur || null; st.offerShown = !!d.offerShown;
    st.reward = d.reward && st.rewards.some((r) => r.id === d.reward.id) ? d.reward : null;
    if (d.cat && st.products.some((p) => p.category === d.cat && p.stock > 0)) st.cat = d.cat;
    const n = st.cart.reduce((a, c) => a + c.qty, 0);
    if (n || st.retur || dropped) toast('Transaksi dipulihkan', `${n} barang di keranjang${st.retur ? ' + retur ' + st.retur.invoice : ''}${dropped ? ` · ${dropped} barang dikeluarkan karena stok habis` : ''}${changed ? ' · harga/stok diperbarui' : ''}`, dropped ? 'err' : 'ok');
  }
  // menu printer & struk terakhir
  function printerMenu() {
    const sv = Printer.saved(), li = lastInfo(), on = Printer.status === 'connected';
    const m = modal({ title: 'Printer & struk', body: `<div class="stack">
      <div class="row"><span class="chip ${on ? 'green' : Printer.status === 'connecting' ? 'amber' : ''}">${on ? 'Terhubung' : Printer.status === 'connecting' ? 'Menghubungkan…' : 'Belum terhubung'}</span><b class="grow">${esc((Printer.device && Printer.device.name) || (sv && sv.name) || 'Belum ada printer tersimpan')}</b></div>
      ${!Printer.supported ? '<p class="small danger" style="margin:0">Browser ini tidak mendukung printer Bluetooth. Gunakan Chrome di Android / PC, atau cetak biasa.</p>' : on ? '<button class="btn" data-pdis>Putuskan printer</button>' : `<button class="btn primary" data-pcon>${icon('printer')}${sv ? 'Sambungkan ' + esc(sv.name) : 'Hubungkan printer'}</button>`}
      ${li ? `<button class="btn" data-plast>${icon('refresh')}Cetak ulang struk terakhir · ${esc(li.invoice)}</button>` : ''}
      <a class="btn ghost" href="#printer">Pengaturan printer</a></div>` });
    const b = (q, f) => { const x = m.$(q); if (x) x.onclick = f; };
    b('[data-pcon]', async () => { try { await Printer.connect(); toast('Printer terhubung', Printer.device?.name || '', 'ok'); m.close(); } catch (e) { if (e.name !== 'NotFoundError') toastErr(e); } });
    b('[data-pdis]', () => { Printer.disconnect(); m.close(); });
    b('[data-plast]', async () => { try { const trx = await api('get', { table: 'transactions', id: li.id }); m.close(); doneModal(trx, { reprint: true }); } catch (e) { toastErr(e); } });
  }
  const prnUpd = () => { const b = el('[data-prn]'); if (!b) return; b.dataset.st = Printer.status; b.title = 'Printer: ' + (Printer.status === 'connected' ? 'terhubung' : Printer.status === 'connecting' ? 'menghubungkan…' : 'belum terhubung'); };
  Printer.listeners.add(prnUpd);

  const activePromos = () => st.promos.filter(Promo.activeToday);
  const autoPromos = () => activePromos().filter(Promo.isAuto);
  const member = () => st.members.find((m) => m.id === st.memberId) || null;

  // ---------- perhitungan total
  function calc() {
    const cart = st.cart;
    const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const m = member();
    const memberRate = num(S.member_discount_percent);
    const voucher = m && m.voucher_amount > 0 && !m.voucher_used ? m.voucher_amount : 0;
    const blocked = !!m && voucher === 0 && memberRate > 0; // diskon member % menonaktifkan promo
    const ids = new Set(); const eff = [];
    if (!blocked) [...st.vouchers, ...autoPromos()].forEach((p) => { if (!ids.has(p.id)) { ids.add(p.id); eff.push(p); } });
    const pc = Promo.compute(eff, cart, subtotal);
    const memberDisc = m ? (voucher > 0 ? Math.min(voucher, subtotal) : Math.round(subtotal * memberRate / 100)) : 0;
    const rewardDisc = st.reward && st.reward.type === 'discount' ? st.reward.discount_amount : 0;
    const prodDisc = cart.reduce((s, c) => s + (c.discount || 0) * c.qty, 0);
    const discount = Math.min(subtotal, pc.total + memberDisc + rewardDisc + prodDisc);
    const shipFee = st.shipping ? st.shipping.fee || 0 : 0;
    const fee = st.fees.reduce((s, f) => s + f.amount, 0) + shipFee;
    const retAmount = st.retur ? st.retur.items.reduce((s, i) => s + i.price * i.qty, 0) : 0;
    const total = st.retur ? subtotal - discount + fee - retAmount : Math.max(0, subtotal - discount + fee);
    const count = cart.reduce((s, c) => s + c.qty, 0);
    const promoNames = eff.filter((p) => pc.perPromo[p.id]).map((p) => p.name);
    return { subtotal, pc, memberDisc, voucher, blocked, rewardDisc, prodDisc, discount, fee, shipFee, total, count, promoNames, eff, m, retAmount };
  }

  // ---------- render
  function renderCats() {
    const cats = ['Semua', ...new Set(st.products.filter((p) => p.stock > 0).map((p) => p.category).filter(Boolean))].sort((a, b) => (a === 'Semua' ? -1 : b === 'Semua' ? 1 : a.localeCompare(b)));
    el('[data-cats]').innerHTML = cats.map((c) => `<button class="${c === st.cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }
  function renderPromos() {
    const r = calc();
    const list = activePromos();
    el('[data-promos]').innerHTML = list.map((p) => `<button class="pcard ${r.pc.perPromo[p.id] ? 'on' : ''}" data-promo="${p.id}" title="${esc(p.name)}"><span class="pc-top"><b>${esc(p.name)}</b>${r.pc.perPromo[p.id] ? icon('check', 'pc-ok') : ''}</span><span class="pc-val">${esc(Promo.describe(p))}</span>${p.code ? `<span class="pc-code">${esc(p.code)}</span>` : '<span class="pc-auto">Otomatis</span>'}</button>`).join('');
    el('[data-promos]').classList.toggle('hidden', !list.length);
  }
  const alive = () => !!el('[data-grid]') && App.view === 'kasir';
  // barang dikelompokkan per model (varian warna/ukuran jadi satu kartu)
  function groups() {
    const map = new Map();
    st.products.forEach((p) => {
      const k = p.model ? 'm:' + p.model : 'p:' + p.id;
      let g = map.get(k);
      if (!g) { g = { key: k, model: p.model || '', name: p.model || p.name, category: p.category, image: '', items: [] }; map.set(k, g); }
      g.items.push(p); if (!g.image && p.image) g.image = p.image;
    });
    return [...map.values()];
  }
  const effPrice = (p) => p.price - (p.discount || 0);
  function renderGrid() {
    if (!alive()) return;
    const q = st.q.trim().toLowerCase();
    const act = activePromos();
    const inCart = {}; st.cart.forEach((c) => { inCart[c.id] = c.qty; });
    const list = groups().filter((g) => g.items.some((p) => p.stock > 0) && (st.cat === 'Semua' || g.category === st.cat) &&
      (!q || g.items.some((p) => [p.name, p.barcode, p.model, p.color, p.size].join(' ').toLowerCase().includes(q))));
    if (!list.length) { el('[data-grid]').innerHTML = emptyState(st.products.some((p) => p.stock > 0) ? 'Barang tidak ditemukan.' : (st.products.length ? 'Semua barang sedang habis. Tambah stok di menu Produk & stok.' : 'Belum ada barang. Tambahkan lewat menu Produk & stok.')); return; }
    el('[data-grid]').innerHTML = list.slice(0, 400).map((g) => {
      const avail = g.items.filter((p) => p.stock > 0);
      const stock = avail.reduce((s, p) => s + p.stock, 0);
      const prices = avail.map(effPrice), lo = Math.min(...prices), hi = Math.max(...prices);
      const orig = Math.max(...avail.map((p) => p.price));
      const colors = [...new Set(avail.map((p) => p.color).filter(Boolean))], sizes = sortSizes([...new Set(avail.map((p) => p.size).filter(Boolean))]);
      const b = avail.map((p) => Promo.badgeFor(p, act)).find(Boolean);
      const qty = g.items.reduce((s, p) => s + (inCart[p.id] || 0), 0);
      const vinfo = g.model ? [sizes.length ? sizes.join(' · ') : '', colors.length > 1 ? colors.length + ' warna' : colors[0] || ''].filter(Boolean).join(' — ') : (g.category || '');
      return `<button class="prod" data-g="${esc(g.key)}">
        ${thumb(g.image, g.name)}
        ${b ? `<span class="bdg" style="background:${BADGE_COLORS[b.badge_color] || '#7C3AED'}">${esc(b.badge_text)}</span>` : ''}
        ${qty ? `<span class="qtyin">${qty}</span>` : ''}
        <span class="pinfo"><span class="nm">${esc(g.name)}</span>
        ${colors.length > 1 ? `<span class="sws">${colors.slice(0, 6).map(swatch).join('')}${colors.length > 6 ? `<small>+${colors.length - 6}</small>` : ''}</span>` : ''}
        <span class="meta">${esc(vinfo)}</span>
        <span class="pr">${lo < orig && lo === hi ? `<s>${rupiah(orig)}</s>` : ''}${lo === hi ? rupiah(lo) : rupiah(lo) + '–' + rupiah(hi).replace('Rp', '')}<em class="${stock <= 3 ? 'low' : ''}">${stock <= 3 ? 'Sisa ' + stock : stock + ' pcs'}</em></span></span>
      </button>`;
    }).join('');
  }
  // pilih warna & ukuran
  function variantSheet(g) {
    const items = g.items;
    const colors = [...new Set(items.map((p) => p.color))];
    const sizes = sortSizes([...new Set(items.map((p) => p.size))]);
    const hasC = colors.some(Boolean), hasS = sizes.some(Boolean);
    let color = hasC ? (colors.find((c) => items.some((p) => p.color === c && p.stock > 0)) ?? colors[0]) : '';
    let size = null, qty = 1;
    const find = () => items.find((p) => p.color === color && p.size === (hasS ? size : p.size)) || null;
    const m = modal({ title: g.name, size: 'wide', body: `<div class="vsheet"><div class="vs-img">${thumb(g.image, g.name, 'lg')}</div><div class="vs-body" data-vb></div></div>`,
      foot: '<button class="btn" data-x>Batal</button><button class="btn gold" data-ok style="min-width:180px">Tambah ke keranjang</button>' });
    const draw = () => {
      const p = find();
      const inCart = (id) => (st.cart.find((c) => c.id === id) || {}).qty || 0;
      m.$('[data-vb]').innerHTML = `
        <div class="vs-price">${p ? (p.discount > 0 ? `<s>${rupiah(p.price)}</s> ` : '') + rupiah(effPrice(p)) : rupiah(Math.min(...items.map(effPrice)))}</div>
        <div class="small muted">${esc(g.category || '')}${p ? ' · ' + esc(p.barcode || '') : ''}</div>
        ${hasC ? `<div class="vs-l">Warna${color ? ': <b>' + esc(color) + '</b>' : ''}</div><div class="vchips">${colors.map((c) => { const st2 = items.filter((x) => x.color === c).reduce((s, x) => s + x.stock, 0); return `<button data-c="${esc(c)}" class="${c === color ? 'on' : ''}" ${st2 <= 0 ? 'disabled' : ''}>${swatch(c)}${esc(c || '—')}</button>`; }).join('')}</div>` : ''}
        ${hasS ? `<div class="vs-l">Ukuran</div><div class="vchips size">${sizes.map((z) => { const v = items.find((x) => x.color === color && x.size === z); const left = v ? v.stock - inCart(v.id) : 0; return `<button data-z="${esc(z)}" class="${z === size ? 'on' : ''}" ${!v || left <= 0 ? 'disabled' : ''}><b>${esc(z || '—')}</b><small>${v ? (left <= 0 ? 'habis' : 'stok ' + left) : '—'}</small></button>`; }).join('')}</div>` : ''}
        <div class="vs-l">Jumlah</div><div class="row"><div class="qty big"><button data-q="-1" aria-label="Kurangi">−</button><input value="${qty}" data-qv inputmode="numeric" aria-label="Jumlah"><button data-q="1" aria-label="Tambah">+</button></div>
        <span class="small muted">${p ? `Stok ${esc(p.color || '')} ${esc(p.size || '')}: <b>${p.stock - inCart(p.id)}</b>` : hasS ? 'Pilih ukuran' : ''}</span></div>`;
      m.$('[data-ok]').disabled = !p || p.stock - inCart(p.id) <= 0;
    };
    // pilih otomatis bila hanya ada satu ukuran tersedia
    const autoSize = () => { const av = sizes.filter((z) => items.some((x) => x.color === color && x.size === z && x.stock > 0)); if (!hasS) size = sizes[0]; else if (av.length === 1) size = av[0]; else if (size !== null && !av.includes(size)) size = null; };
    autoSize(); draw();
    m.$('[data-vb]').onclick = (e) => {
      const c = e.target.closest('[data-c]'), z = e.target.closest('[data-z]'), q = e.target.closest('[data-q]');
      if (c) { color = c.dataset.c; autoSize(); }
      if (z) size = z.dataset.z;
      if (q) qty = Math.max(1, qty + +q.dataset.q);
      draw();
    };
    m.$('[data-vb]').oninput = (e) => { if (e.target.dataset.qv !== undefined) qty = Math.max(1, num(e.target.value) || 1); };
    m.$('[data-x]').onclick = () => m.close();
    m.$('[data-ok]').onclick = () => { const p = find(); if (!p) return; if (addToCart(p, qty)) { m.close(); toast('Ditambahkan', `${p.name} × ${qty}`, 'ok'); } };
  }
  function renderCart() {
    if (!alive()) return;
    saveDraft();
    const r = calc();
    const m = r.m;
    el('[data-membername]').textContent = m ? m.name + ' · ' + fmtNum(m.points) + ' poin' : 'Pilih member';
    el('[data-member]').classList.toggle('primary', !!m);
    el('[data-shiplabel]').textContent = st.shipping ? st.shipping.courier : 'Kirim';
    el('[data-ship]').classList.toggle('primary', !!st.shipping);
    el('[data-returlabel]').textContent = st.retur ? 'Retur ' + st.retur.invoice.slice(-4) : 'Tukar / retur';
    el('[data-retur]').classList.toggle('primary', !!st.retur);
    const retBlock = st.retur ? `<div class="retblock"><div class="row"><b class="grow">${icon('rotate')} Dikembalikan · ${esc(st.retur.invoice)}</b><button class="btn ghost sm" data-rmret>Batal</button></div>${st.retur.items.map((i) => `<div class="r"><span>${esc(i.name)} × ${i.qty}</span><span>−${rupiah(i.price * i.qty)}</span></div>`).join('')}<div class="small muted">${st.cart.length ? 'Barang pengganti ada di bawah.' : 'Tambahkan barang pengganti (tukar size/warna), atau langsung bayar untuk mengembalikan uang.'}</div></div>` : '';
    el('[data-items]').innerHTML = retBlock + (st.cart.length ? st.cart.map((c) => {
      const ip = r.pc.itemPromo[c.id]; const disc = (ip ? ip.amount : 0) + (c.discount || 0) * c.qty;
      return `<div class="line"><div class="t"><b>${esc(c.name)}</b><button class="btn ghost icon sm" data-del="${c.id}" aria-label="Hapus">${icon('trash')}</button></div>
        <div class="c"><div class="qty"><button data-dec="${c.id}" aria-label="Kurangi">−</button><input data-qty="${c.id}" value="${c.qty}" inputmode="numeric" aria-label="Jumlah"><button data-inc="${c.id}" aria-label="Tambah">+</button></div>
        <span class="pp">@${rupiah(c.price)}${c.price !== c.original_price ? ' <span class="chip amber">diubah</span>' : ''} <button data-price="${c.id}">ubah</button></span>
        <span class="sum">${disc > 0 ? `<s>${rupiah(c.price * c.qty)}</s>${rupiah(c.price * c.qty - disc)}` : rupiah(c.price * c.qty)}</span></div>
        ${disc > 0 ? `<div class="dl">Hemat ${rupiah(disc)}${ip ? ' · ' + esc(ip.promoName) : ''}${c.discount > 0 ? (ip ? ' + ' : ' · ') + 'harga khusus' : ''}</div>` : ''}</div>`;
    }).join('') : st.retur ? '' : `<div class="empty" style="padding:50px 10px">${icon('cart')}Scan barcode atau ketuk barang untuk mulai.</div>`);

    const chips = [
      ...st.vouchers.map((p) => `<span class="chip blue">${esc(p.code)} <button data-rmv="${p.id}" aria-label="Hapus promo">×</button></span>`),
      ...st.fees.map((f) => `<span class="chip amber">${esc(f.label)} ${rupiah(f.amount)} <button data-rmf="${f.id}" aria-label="Hapus biaya">×</button></span>`),
      st.shipping ? `<span class="chip blue">${icon('truck')} ${esc(st.shipping.courier)} · ${esc(st.shipping.recipient || 'tanpa nama')} <button data-rms aria-label="Batalkan pengiriman">×</button></span>` : '',
      st.reward ? `<span class="chip gold">${icon('gift')} ${esc(st.reward.name)} <button data-rmr aria-label="Hapus reward">×</button></span>` : '',
      m && r.blocked ? '<span class="chip red">Diskon member aktif — promo tidak digabung</span>' : '',
    ].filter(Boolean);
    el('[data-extras]').innerHTML = chips.join('');
    el('[data-extras]').classList.toggle('hidden', !chips.length);

    const ups = r.blocked ? [] : Promo.upsell(autoPromos(), activePromos(), st.cart, r.subtotal, r.pc);
    el('[data-upsell]').innerHTML = ups.map((u) => `<div class="upsell">${esc(u)}</div>`).join('');

    const eligible = m ? st.rewards.filter((x) => x.points_required <= m.points) : [];
    el('[data-totals]').innerHTML = `
      <div class="r"><span>Subtotal (${r.count} barang)</span><span>${rupiah(r.subtotal)}</span></div>
      ${r.prodDisc > 0 ? `<div class="r minus"><span>Harga khusus barang</span><span>−${rupiah(r.prodDisc)}</span></div>` : ''}
      ${r.pc.total > 0 ? `<div class="r minus"><span>Promo</span><span>−${rupiah(r.pc.total)}</span></div>` : ''}
      ${r.memberDisc > 0 ? `<div class="r minus"><span>${r.voucher > 0 ? 'Voucher member' : 'Diskon member ' + num(S.member_discount_percent) + '%'}</span><span>−${rupiah(r.memberDisc)}</span></div>` : ''}
      ${r.rewardDisc > 0 ? `<div class="r minus"><span>Tukar poin</span><span>−${rupiah(r.rewardDisc)}</span></div>` : ''}
      ${st.fees.map((f) => `<div class="r"><span>${esc(f.label)}</span><span>+${rupiah(f.amount)}</span></div>`).join('')}
      ${st.shipping ? `<div class="r"><span>Ongkir ${esc(st.shipping.courier)}</span><span>${r.shipFee ? '+' + rupiah(r.shipFee) : 'dibayar penerima'}</span></div>` : ''}
      ${r.retAmount ? `<div class="r minus"><span>Barang dikembalikan</span><span>−${rupiah(r.retAmount)}</span></div>` : ''}
      <div class="r big"><span>${r.total < 0 ? 'Uang dikembalikan' : 'Total'}</span><span>${rupiah(Math.abs(r.total))}</span></div>
      ${m && eligible.length && !st.reward ? `<button class="btn sm" data-reward style="margin-top:6px;width:100%">${icon('gift')} ${eligible.length} reward poin bisa ditukar</button>` : ''}`;
    el('[data-pay]').disabled = !st.cart.length && !st.retur;
    el('[data-pay]').textContent = r.total < 0 ? 'Kembalikan ' + rupiah(-r.total) : st.retur && r.total === 0 ? 'Selesaikan tukar' : (st.cart.length || st.retur) ? 'Bayar ' + rupiah(r.total) : 'Bayar';
    el('[data-fabcount]').textContent = r.count + ' barang';
    el('[data-fabtotal]').textContent = rupiah(r.total);
    renderPromos();
  }
  const refresh = () => { renderCart(); renderGrid(); };

  // ---------- aksi keranjang
  function addToCart(p, qty = 1) {
    const ex = st.cart.find((c) => c.id === p.id);
    const have = ex ? ex.qty : 0;
    if (have + qty > p.stock) { toast('Stok tidak cukup', `${p.name}: sisa ${p.stock}`, 'err'); return false; }
    if (ex) ex.qty += qty;
    else st.cart.push({ id: p.id, name: p.name, barcode: p.barcode, category: p.category, model: p.model, size: p.size, color: p.color, price: p.price, original_price: p.price, cost: p.cost, commission: p.commission, discount: p.discount || 0, qty, stock: p.stock });
    refresh(); return true;
  }
  function setQty(id, q) {
    const c = st.cart.find((x) => x.id === id); if (!c) return;
    const p = st.products.find((x) => x.id === id);
    q = Math.floor(q);
    if (q <= 0) st.cart = st.cart.filter((x) => x.id !== id);
    else if (p && q > p.stock) { toast('Stok tidak cukup', `${c.name}: sisa ${p.stock}`, 'err'); c.qty = p.stock; }
    else c.qty = q;
    refresh();
  }
  function handleScan(code) {
    code = code.trim(); if (!code) return;
    if (/^INV\d{6}-\d+$/i.test(code)) { scan.value = ''; st.q = ''; renderGrid(); returModal(code.toUpperCase()); return; }
    const p = st.products.find((x) => x.barcode && x.barcode.toLowerCase() === code.toLowerCase());
    if (p) { addToCart(p); toast('Ditambahkan', p.name); scan.value = ''; st.q = ''; renderGrid(); return; }
    const matches = st.products.filter((x) => x.stock > 0 && x.name.toLowerCase().includes(code.toLowerCase()));
    if (matches.length === 1) { addToCart(matches[0]); scan.value = ''; st.q = ''; renderGrid(); return; }
    const gs = groups().filter((g) => g.items.some((x) => x.stock > 0) && g.name.toLowerCase().includes(code.toLowerCase()));
    if (gs.length === 1) { variantSheet(gs[0]); return; }
    if (!matches.length) toast('Barang tidak ditemukan', code, 'err');
  }

  // ---------- modal-modal
  function memberModal() {
    const m = modal({ title: 'Pilih member', size: '', body: `
      <div class="search" style="margin-bottom:10px">${icon('search')}<input class="input" data-mq placeholder="Cari nama atau nomor HP…"></div>
      <div class="pick" data-mlist></div>
      <details style="margin-top:12px"><summary class="bold" style="cursor:pointer">+ Daftarkan member baru</summary>
        <div class="stack" style="margin-top:10px" data-newm>${field('Nama', 'name')}${field('Nomor HP / WA', 'phone', '', { type: 'tel' })}${field('Email (opsional)', 'email', '', { type: 'email' })}<button class="btn primary" data-savem>Simpan & pilih</button></div></details>`,
      foot: member() ? '<button class="btn danger" data-unset>Lepas member</button>' : '' });
    const draw = () => {
      const q = m.$('[data-mq]').value.trim().toLowerCase();
      const list = st.members.filter((x) => !q || x.name.toLowerCase().includes(q) || (x.phone || '').includes(q)).slice(0, 50);
      m.$('[data-mlist]').innerHTML = list.length ? list.map((x) => `<button data-pickm="${x.id}"><div class="avatar">${esc(x.name[0])}</div><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${esc(x.phone || '-')} · ${fmtNum(x.points)} poin${x.voucher_amount > 0 && !x.voucher_used ? ' · voucher ' + rupiah(x.voucher_amount) : ''}</div></div></button>`).join('') : '<div class="empty">Member tidak ditemukan.</div>';
    };
    draw();
    m.$('[data-mq]').oninput = draw;
    m.$('[data-mlist]').onclick = async (e) => {
      const b = e.target.closest('[data-pickm]'); if (!b) return;
      st.memberId = +b.dataset.pickm; st.reward = null; m.close();
      try { const fresh = await api('get', { table: 'members', id: st.memberId }); st.members = st.members.map((x) => (x.id === fresh.id ? fresh : x)); if (fresh.voucher_amount > 0 && !fresh.voucher_used) toast('Voucher member aktif', `Potongan ${rupiah(fresh.voucher_amount)} otomatis diterapkan.`, 'ok'); } catch (ex) { /* pakai data lama */ }
      if (calc().blocked && st.vouchers.length) { st.vouchers = []; toast('Kode promo dilepas', 'Diskon member tidak bisa digabung dengan promo.'); }
      renderCart();
      if (st.afterMember) { const f = st.afterMember; st.afterMember = null; f(); }
    };
    m.$('[data-savem]').onclick = async () => {
      const v = formValues(m.$('[data-newm]'));
      if (!v.name) { toast('Nama member wajib diisi', '', 'err'); return; }
      try { const rec = await db.create('members', { ...v, points: 0 }); st.members.push(rec); st.memberId = rec.id; m.close(); toast('Member ditambahkan', rec.name, 'ok'); renderCart(); if (st.afterMember) { const f = st.afterMember; st.afterMember = null; f(); } }
      catch (ex) { toastErr(ex); }
    };
    const un = m.$('[data-unset]'); if (un) un.onclick = () => { st.memberId = null; st.reward = null; m.close(); renderCart(); };
    return m;
  }
  function voucherModal() {
    const vouchers = activePromos().filter((p) => p.code);
    const m = modal({ title: 'Kode promo', body: `<div class="row"><input class="input" data-code placeholder="Masukkan kode, mis. HEMAT10" style="text-transform:uppercase"><button class="btn primary" data-apply>Pakai</button></div>
      ${vouchers.length ? `<p class="small muted" style="margin:14px 0 6px">Promo berkode yang aktif hari ini</p><div class="pick">${vouchers.map((p) => `<button data-c="${esc(p.code)}"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(Promo.describe(p))}${p.min_purchase ? ' · min. ' + rupiah(p.min_purchase) : ''}</div></div><span class="chip blue">${esc(p.code)}</span></button>`).join('')}</div>` : ''}` });
    const go = (code) => { if (applyVoucher(code)) m.close(); };
    m.$('[data-apply]').onclick = () => go(m.$('[data-code]').value);
    m.$('[data-code]').onkeydown = (e) => { if (e.key === 'Enter') go(e.target.value); };
    $$('[data-c]', m.el).forEach((b) => (b.onclick = () => go(b.dataset.c)));
  }
  function applyVoucher(raw) {
    const code = String(raw || '').trim().toUpperCase(); if (!code) return false;
    const r = calc();
    if (r.blocked) { toast('Promo tidak dapat digabung', 'Diskon member sedang aktif.', 'err'); return false; }
    const p = activePromos().find((x) => x.code && x.code.toUpperCase() === code);
    if (!p) { toast('Kode promo tidak ditemukan atau tidak aktif', code, 'err'); return false; }
    if (st.vouchers.some((x) => x.id === p.id)) { toast('Promo sudah dipakai', '', 'err'); return false; }
    const why = Promo.checkVoucher(p, st.cart, r.subtotal); if (why) { toast('Promo belum bisa dipakai', why, 'err'); return false; }
    if (st.vouchers.length >= 2) { toast('Maksimal 2 kode promo per transaksi', '', 'err'); return false; }
    if (st.vouchers.length === 1 && (!st.vouchers[0].stackable || !p.stackable)) { toast('Promo tidak bisa digabung', 'Salah satu promo tidak diatur "bisa digabung".', 'err'); return false; }
    st.vouchers.push(p); toast('Promo dipakai', p.name, 'ok'); renderCart(); return true;
  }
  function feeModal() {
    const presets = feePresets();
    const m = modal({ title: 'Biaya tambahan', body: `${presets.length ? `<p class="small muted" style="margin:0 0 8px">Pilih cepat (nominal bisa diubah):</p><div class="quick" style="margin-bottom:14px">${presets.map((f, i) => `<button data-pre="${i}">${esc(f.label)} · ${rupiah(f.amount)}</button>`).join('')}</div>` : ''}<div class="stack" data-f>${field('Nama biaya', 'label', '', { placeholder: 'Ongkir Maxim, jahit, bungkus kado…' })}${field('Nominal (Rp)', 'amount', '', { numeric: true })}</div>${App.isAdmin() ? '<p class="small muted">Daftar pilihan cepat diatur di Pengaturan toko → Biaya tambahan.</p>' : ''}`, foot: '<button class="btn primary" data-ok>Tambahkan biaya</button>' });
    m.$$('[data-pre]').forEach((b) => (b.onclick = () => { const f = presets[+b.dataset.pre]; m.$('[name=label]').value = f.label; m.$('[name=amount]').value = f.amount; m.$('[name=amount]').focus(); }));
    m.$('[data-ok]').onclick = () => { const v = formValues(m.$('[data-f]')); if (!v.label || !(v.amount > 0)) { toast('Isi nama biaya dan nominal', '', 'err'); return; } st.fees.push({ id: uid(), label: v.label, amount: v.amount }); m.close(); renderCart(); };
  }
  function shipModal() {
    const cur = st.shipping || { courier: '', recipient: '', phone: '', address: '', fee: '', note: '' };
    const mem = member();
    if (!st.shipping && mem) { cur.recipient = mem.name; cur.phone = mem.phone; }
    const presets = feePresets();
    const m = modal({ title: 'Kirim pesanan', size: 'wide', body: `<div class="stack">
      <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Kurir</div><div class="quick" data-cour>${COURIERS.map((c) => `<button data-c="${esc(c.id)}" class="${cur.courier === c.id ? 'on' : ''}">${esc(c.id)}</button>`).join('')}</div></div>
      <div class="grid2">${field('Nama penerima', 'recipient', cur.recipient)}${field('No. HP / WA penerima', 'phone', cur.phone, { type: 'tel' })}</div>
      <label class="f">Alamat lengkap<textarea class="input" name="address" placeholder="Jalan, nomor rumah, kelurahan, kecamatan, patokan">${esc(cur.address || '')}</textarea></label>
      <div class="grid2">${field('Ongkir yang ditagih ke pembeli (Rp)', 'fee', cur.fee === '' ? '' : cur.fee, { numeric: true, hint: 'Isi 0 bila ongkir dibayar penerima / gratis ongkir.' })}${field('Catatan untuk kurir', 'note', cur.note, { placeholder: 'Titip satpam, hubungi dulu…' })}</div>
      ${presets.length ? `<div class="quick">${presets.map((f, i) => `<button data-p="${i}">${esc(f.label)} · ${rupiah(f.amount)}</button>`).join('')}</div>` : ''}
      <p class="small muted" style="margin:0">Setelah transaksi selesai, pesan kurir lewat aplikasinya lalu isi nomor resi / link pelacakan di menu <b>Pengiriman</b>.</p></div>`,
      foot: `${st.shipping ? '<button class="btn danger" data-rm>Batalkan pengiriman</button>' : ''}<button class="btn primary" data-ok>Simpan pengiriman</button>` });
    let courier = cur.courier;
    m.$$('[data-c]').forEach((b) => (b.onclick = () => { courier = b.dataset.c; m.$$('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); const key = courier.toLowerCase().split(' ')[0].replace('&', ''); const pre = presets.find((f) => f.label.toLowerCase().replace('&', '').includes(key)); if (pre && !num(m.$('[name=fee]').value)) m.$('[name=fee]').value = pre.amount; }));
    m.$$('[data-p]').forEach((b) => (b.onclick = () => { m.$('[name=fee]').value = presets[+b.dataset.p].amount; }));
    const rm = m.$('[data-rm]'); if (rm) rm.onclick = () => { st.shipping = null; m.close(); renderCart(); };
    m.$('[data-ok]').onclick = () => {
      const v = { recipient: m.$('[name=recipient]').value.trim(), phone: m.$('[name=phone]').value.trim(), address: m.$('[name=address]').value.trim(), fee: num(m.$('[name=fee]').value), note: m.$('[name=note]').value.trim() };
      if (!courier) { toast('Pilih kurir dulu', '', 'err'); return; }
      if (!v.recipient || !v.address) { toast('Isi nama penerima dan alamat', '', 'err'); return; }
      st.shipping = { courier, ...v }; m.close(); renderCart();
    };
  }
  function rewardModal() {
    const mem = member(); if (!mem) return;
    const list = st.rewards.filter((x) => x.points_required <= mem.points);
    const m = modal({ title: 'Tukar poin member', body: `<p class="muted" style="margin-top:0">${esc(mem.name)} punya <b>${fmtNum(mem.points)} poin</b>.</p><div class="pick">${list.map((x) => `<button data-rw="${x.id}"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${x.type === 'discount' ? 'Potongan ' + rupiah(x.discount_amount) : 'Hadiah: ' + esc(x.product_name)}</div></div><span class="chip gold">${fmtNum(x.points_required)} poin</span></button>`).join('')}</div>` });
    $$('[data-rw]', m.el).forEach((b) => (b.onclick = () => { st.reward = st.rewards.find((x) => x.id === +b.dataset.rw); m.close(); toast('Reward dipakai', st.reward.name, 'ok'); renderCart(); }));
  }
  async function priceModal(id) {
    const c = st.cart.find((x) => x.id === id); if (!c) return;
    const m = modal({ title: 'Ubah harga', body: `<p class="muted" style="margin-top:0">${esc(c.name)} — harga normal ${rupiah(c.original_price)}</p>${field('Harga baru per pcs', 'price', c.price, { numeric: true })}${isAdmin ? '' : '<p class="small muted">Perubahan harga memerlukan PIN admin.</p>'}`, foot: `<button class="btn" data-reset>Kembalikan normal</button><button class="btn primary" data-ok>Simpan harga</button>` });
    const save = async (price) => {
      if (!isAdmin) { m.close(); const pin = await askPin('Masukkan PIN admin untuk mengubah harga.'); if (!pin) return; }
      else m.close();
      c.price = Math.max(0, price); toast('Harga diperbarui', `${c.name}: ${rupiah(c.price)}`); renderCart();
    };
    m.$('[data-ok]').onclick = () => save(num(m.$('[name=price]').value));
    m.$('[data-reset]').onclick = () => { c.price = c.original_price; m.close(); renderCart(); };
  }
  async function addProductModal() {
    let pin = '';
    if (!isAdmin) { pin = await askPin('Menambah barang hanya untuk admin. Minta admin memasukkan PIN admin.'); if (!pin) return; }
    productModelModal({ pin, barcode: scan.value.trim(), categories: [...new Set(st.products.map((p) => p.category).filter(Boolean))], onSaved: (items) => {
      (items || []).forEach((it) => { const i = st.products.findIndex((x) => x.id === it.id); if (i >= 0) st.products[i] = it; else st.products.push(it); });
      st.products.sort((a, b) => a.name.localeCompare(b.name)); scan.value = ''; st.q = ''; renderCats(); renderGrid();
    } });
  }

  // ---------- tukar / retur barang
  async function returModal(invoice = '') {
    const days = num(S.return_days) || 7;
    const m = modal({ title: 'Tukar / retur barang', size: 'wide', body: `<div class="stack">
      <form class="row" data-f><input class="input" data-inv placeholder="No. invoice di struk, mis. INV261111-1234" value="${esc(invoice)}" style="text-transform:uppercase"><button class="btn primary">Cari</button></form>
      <p class="small muted" style="margin:-4px 0 0">Bisa juga scan barcode invoice di struk. Batas tukar toko: ${days} hari.</p><div data-res></div></div>` });
    let recent = [];
    const pick = (t) => {
      const back = {}; (t.returned || []).forEach((r) => { back[r.id] = (back[r.id] || 0) + r.qty; });
      const rows = (t.items || []).map((i) => ({ ...i, left: i.qty - (back[i.id] || 0), unit: Math.round((i.price * i.qty - (i.itemDiscount || 0)) / i.qty), take: 0 }));
      const age = Math.floor((Date.now() - parseDT(t.created)) / 86400000);
      const draw = () => {
        const sum = rows.reduce((s, i) => s + i.unit * i.take, 0);
        m.$('[data-res]').innerHTML = `<div class="panel"><div class="panel-h"><div><h3>${esc(t.invoice)}</h3><span class="small muted">${fmtDT(t.created)} · ${esc(t.member_name || 'tanpa member')} · ${rupiah(t.total)}</span></div>${age > days ? `<span class="chip red">${age} hari lalu — lewat batas tukar</span>` : `<span class="chip green">${age} hari lalu</span>`}</div>
          ${table([{ label: 'Barang', html: (i) => `<b>${esc(i.name)}</b><div class="small muted">dibayar ${rupiah(i.unit)} / pcs</div>` }, { label: 'Dibeli', num: true, get: (i) => i.qty }, { label: 'Bisa diretur', num: true, get: (i) => i.left },
            { label: 'Dikembalikan', num: true, html: (i, k) => (i.left > 0 ? `<div class="qty"><button data-d="${k}" aria-label="Kurangi">−</button><input value="${i.take}" readonly aria-label="Jumlah"><button data-u="${k}" aria-label="Tambah">+</button></div>` : '<span class="chip">sudah diretur</span>') }], rows)}
          <div class="panel-b row"><span class="grow">Nilai barang dikembalikan: <b>${rupiah(sum)}</b></span><button class="btn gold" data-go ${sum ? '' : 'disabled'}>Masukkan ke keranjang</button></div></div>`;
      };
      draw();
      m.$('[data-res]').onclick = (e) => {
        const d = e.target.closest('[data-d]'), u = e.target.closest('[data-u]');
        if (d) { const i = rows[+d.dataset.d]; i.take = Math.max(0, i.take - 1); draw(); }
        if (u) { const i = rows[+u.dataset.u]; i.take = Math.min(i.left, i.take + 1); draw(); }
        if (e.target.closest('[data-go]')) {
          st.retur = { invoice: t.invoice, items: rows.filter((i) => i.take > 0).map((i) => ({ id: i.id, name: i.name, qty: i.take, price: i.unit })) };
          if (t.member_id && !st.memberId) st.memberId = t.member_id;
          m.close(); refresh(); document.body.classList.add('cart-open');
          toast('Barang retur dimasukkan', 'Pilih barang pengganti, lalu bayar selisihnya.', 'ok');
        }
      };
    };
    const showList = (q = '') => {
      const l = recent.filter((t) => !q || [t.invoice, t.member_name].join(' ').toLowerCase().includes(q.toLowerCase())).slice(0, 30);
      m.$('[data-res]').innerHTML = l.length ? `<div class="pick">${l.map((t) => `<button data-t="${t.id}"><div class="grow"><b>${esc(t.invoice)}</b><div class="small muted">${fmtDT(t.created)} · ${esc(t.member_name || '')} ${t.item_count} barang</div></div><b>${rupiah(t.total)}</b></button>`).join('')}</div>` : emptyState('Transaksi tidak ditemukan.');
      $$('[data-t]', m.el).forEach((b) => (b.onclick = () => pick(recent.find((t) => t.id === +b.dataset.t))));
    };
    const find = async () => {
      const v = m.$('[data-inv]').value.trim().toUpperCase();
      if (/^INV/.test(v)) {
        try { const l = await db.list('transactions', { where: { invoice: v }, limit: 1 }); if (l[0]) return pick(l[0]); } catch (e) { toastErr(e); return; }
        m.$('[data-res]').innerHTML = emptyState('Invoice ' + v + ' tidak ditemukan.'); return;
      }
      showList(v);
    };
    m.$('[data-f]').onsubmit = (e) => { e.preventDefault(); find(); };
    try { recent = (await db.list('transactions', { from: ymd(addDays(new Date(), -Math.max(days, 14))), limit: 300 })).filter((t) => t.total > 0 && (t.items || []).length); } catch (e) { /* abaikan */ }
    if (invoice) find(); else showList();
    m.$('[data-inv]').oninput = debounce(() => { if (!/^INV\d{6}-/i.test(m.$('[data-inv]').value)) showList(m.$('[data-inv]').value.trim()); }, 200);
  }

  // ---------- pembayaran
  function requestPay() {
    if (!st.cart.length && !st.retur) return;
    const r = calc();
    const threshold = num(S.member_offer_threshold || 200000);
    if (!r.m && threshold > 0 && r.total > threshold && !st.offerShown) {
      st.offerShown = true;
      const m = modal({ title: 'Tawarkan jadi member?', body: `<p style="margin-top:0">Belanja ${rupiah(r.total)} — pelanggan bisa mendapat <b>${fmtNum(Math.floor(r.total / (num(S.points_per_amount) || 1000)))} poin</b> bila terdaftar sebagai member.</p>`, foot: '<button class="btn" data-skip>Lanjut tanpa member</button><button class="btn primary" data-join>Pilih / daftarkan member</button>' });
      m.$('[data-skip]').onclick = () => { m.close(); payModal(); };
      m.$('[data-join]').onclick = () => { m.close(); st.afterMember = payModal; memberModal(); };
      return;
    }
    payModal();
  }
  function payModal() {
    const r = calc();
    let method = 'cash';
    const refund = r.total <= 0;
    const chs = salesChannels();
    let channel = (() => { try { const c = localStorage.getItem('pos-channel'); return chs.includes(c) ? c : chs[0]; } catch (e) { return chs[0]; } })();
    const chHTML = `<div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Saluran penjualan</div><div class="quick chs" data-ch>${chs.map((c) => `<button data-chv="${esc(c)}" class="${c === channel ? 'on' : ''}">${esc(c)}</button>`).join('')}</div></div>`;
    const quick = [...new Set([r.total, Math.ceil(r.total / 50000) * 50000, Math.ceil(r.total / 100000) * 100000, 100000, 200000, 500000].filter((v) => v >= r.total))].slice(0, 5);
    const m = modal({ title: refund ? 'Selesaikan retur' : 'Pembayaran', body: refund ? `
      <div class="bigtotal ${r.total < 0 ? 'refund' : ''}"><span>${r.total < 0 ? 'Uang dikembalikan ke pelanggan' : 'Tukar barang — tidak ada selisih'}</span><b>${rupiah(-r.total)}</b></div>
      <div class="stack" style="margin-top:14px">${chHTML}${field('Alasan / catatan retur', 'note', st.note, { placeholder: 'Kebesaran, salah warna, cacat…' })}<input type="hidden" name="sales" value=""><input type="hidden" name="pay" value="0"></div>` : `
      <div class="bigtotal"><span>Total bayar</span><b>${rupiah(r.total)}</b></div>
      <div class="stack" style="margin-top:14px">
        ${chHTML}
        <div class="paymethods">${[['cash', 'Tunai', 'cash'], ['qris', 'QRIS', 'qr'], ['debit', 'Debit', 'card'], ['transfer', 'Transfer', 'wallet']].map(([k, l, ic]) => `<button data-m="${k}" class="${k === 'cash' ? 'on' : ''}">${icon(ic)}${l}</button>`).join('')}</div>
        <div data-cashbox>${field('Uang diterima', 'pay', '', { numeric: true, placeholder: '0' })}
          <div class="quick" style="margin-top:8px">${quick.map((v) => `<button data-q="${v}">${v === r.total ? 'Uang pas' : rupiah(v)}</button>`).join('')}</div>
          <p class="bold" style="margin:10px 0 0" data-change></p></div>
        <div data-qrisbox class="hidden center"></div>
        <div class="grid2">${field('Kode sales (opsional)', 'sales', '', { placeholder: 'SLS01', attrs: 'style="text-transform:uppercase" list="saleslist"' })}${field('Catatan (opsional)', 'note', st.note)}</div>
        <datalist id="saleslist">${st.sales.map((s) => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('')}</datalist>
        <p class="small muted" data-salesname style="margin:-6px 0 0"></p>
      </div>`, foot: `<button class="btn" data-cancel>Kembali</button><button class="btn gold" data-finish style="min-width:170px;height:44px">${refund ? 'Selesaikan retur' : 'Selesaikan transaksi'}</button>` });
    const pay = m.$('[name=pay]');
    m.$('[data-ch]').onclick = (e) => { const b = e.target.closest('[data-chv]'); if (!b) return; channel = b.dataset.chv; m.$$('[data-chv]').forEach((x) => x.classList.toggle('on', x === b)); try { localStorage.setItem('pos-channel', channel); } catch (ex) { /* abaikan */ } };
    const upd = () => {
      const v = num(pay.value);
      const ch = m.$('[data-change]');
      if (method !== 'cash') { ch.textContent = ''; return; }
      ch.innerHTML = v >= r.total ? `Kembalian: <span class="money">${rupiah(v - r.total)}</span>` : v > 0 ? `<span class="danger">Kurang ${rupiah(r.total - v)}</span>` : '';
    };
    if (!refund) pay.oninput = upd;
    if (!refund) m.$$('[data-q]').forEach((b) => (b.onclick = () => { pay.value = b.dataset.q; upd(); }));
    m.$$('[data-m]').forEach((b) => (b.onclick = () => { method = b.dataset.m; m.$$('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); m.$('[data-cashbox]').classList.toggle('hidden', method !== 'cash'); const qb = m.$('[data-qrisbox]'); qb.classList.toggle('hidden', method !== 'qris'); if (method === 'qris') { qb.innerHTML = qrisPanel(r.total) + (App.settings.qris_payload ? `<div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm" data-qfull>Tampilkan layar penuh</button></div><p class="small muted" style="margin:6px 0 0">Cek notifikasi dana masuk di aplikasi merchant QRIS sebelum menekan "Sudah dibayar".</p>` : ''); const fb = qb.querySelector('[data-qfull]'); if (fb) fb.onclick = () => qrisFullscreen(r.total); } m.$('[data-finish]').textContent = method === 'cash' ? 'Selesaikan transaksi' : 'Sudah dibayar — selesaikan'; upd(); }));
    if (!refund) m.$('[name=sales]').oninput = (e) => { const s = st.sales.find((x) => x.code.toUpperCase() === e.target.value.trim().toUpperCase()); m.$('[data-salesname]').textContent = e.target.value.trim() ? (s ? 'Sales: ' + s.name : 'Kode sales tidak dikenal') : ''; };
    m.$('[data-cancel]').onclick = () => m.close();
    if (window.innerWidth > 700 && !refund) setTimeout(() => pay.focus(), 40);
    m.$('[data-finish]').onclick = async () => {
      const payNum = refund ? 0 : method === 'cash' ? num(pay.value) : r.total;
      if (!refund && method === 'cash' && payNum < r.total) { toast('Uang diterima kurang dari total', '', 'err'); pay.focus(); return; }
      const btn = m.$('[data-finish]'); btn.disabled = true; btn.textContent = 'Menyimpan…';
      const extra = r.memberDisc + r.rewardDisc;
      const items = st.cart.map((c) => { const ip = r.pc.itemPromo[c.id]; const line = c.price * c.qty; return { id: c.id, qty: c.qty, price: c.price, discount: c.discount, promoName: ip ? ip.promoName : '', itemDiscount: Math.round((ip ? ip.amount : 0) + (c.discount || 0) * c.qty + (r.subtotal ? (line / r.subtotal) * extra : 0)) }; });
      pending = true; saveDraft();
      try {
        const trx = await api('checkout', {
          client_ref: ref,
          items, discount: r.discount, fee: r.fee, fee_note: [...st.fees.map((f) => `${f.label} ${rupiah(f.amount)}`), st.shipping && st.shipping.fee ? `Ongkir ${st.shipping.courier} ${rupiah(st.shipping.fee)}` : ''].filter(Boolean).join('; '), shipping: st.shipping,
          payment: payNum, payment_method: method, member_id: st.memberId, channel,
          retur: st.retur ? { invoice: st.retur.invoice, items: st.retur.items.map((i) => ({ id: i.id, qty: i.qty })) } : null, reward_id: st.reward ? st.reward.id : null, voucher_applied: r.voucher > 0,
          sales_code: m.$('[name=sales]').value.trim(), promo_name: [...r.promoNames, st.reward ? 'Tukar poin: ' + st.reward.name : ''].filter(Boolean).join(', '),
          note: [m.$('[name=note]').value.trim(), st.reward && st.reward.type === 'product' ? 'Hadiah poin: ' + st.reward.product_name : ''].filter(Boolean).join(' | '),
        });
        rememberLast(trx); m.close(); doneModal(trx);
      } catch (ex) { pending = false; saveDraft(); toastErr(ex); btn.disabled = false; btn.textContent = refund ? 'Selesaikan retur' : method === 'cash' ? 'Selesaikan transaksi' : 'Sudah dibayar — selesaikan'; }
    };
  }
  function doneModal(trx, { reprint = false } = {}) {
    const pp = PrinterPrefs.get();
    const m = modal({ title: reprint ? 'Struk ' + trx.invoice : 'Transaksi berhasil', body: `<div class="center" style="margin-bottom:12px"><div class="chip green" style="height:28px;font-size:13px">${icon('check')} ${esc(trx.invoice)}</div>${trx.total < 0 ? `<h1 style="margin-top:10px">Kembalikan uang ${rupiah(-trx.total)}</h1>` : trx.return_ref && trx.total === 0 ? '<h1 style="margin-top:10px">Tukar barang selesai</h1>' : trx.payment_method === 'cash' ? `<h1 style="margin-top:10px">Kembalian ${rupiah(trx.change)}</h1>` : ''}</div><div class="receipt-preview">${receiptHTML(trx, S)}</div>`,
      foot: `${trx.shipping && trx.shipping.phone ? `<a class="btn" target="_blank" rel="noopener" href="${esc(waLink(trx.shipping.phone, `Halo ${trx.shipping.recipient}, pesanan Anda di ${S.store_name || 'Sofeeya Store'} (${trx.invoice}, ${rupiah(trx.total)}) akan dikirim via ${trx.shipping.courier}. Terima kasih!`))}">${icon('wa')}WA pembeli</a>` : ''}<button class="btn" data-print>${icon('printer')}Cetak struk</button>${Printer.supported ? `<button class="btn" data-bt>${icon('printer')}Printer Bluetooth</button>` : ''}<button class="btn primary" data-new>${reprint ? 'Tutup' : 'Transaksi baru'}</button>`, onClose: () => { if (!reprint) newSale(); } });
    m.$('[data-print]').onclick = () => printHTML(receiptHTML(trx, S));
    const btPrint = async () => { try { await Printer.printReceipt(trx); toast('Struk dikirim ke printer', Printer.device?.name || '', 'ok'); } catch (ex) { if (ex.name !== 'NotFoundError') toastErr(ex); } };
    const bt = m.$('[data-bt]'); if (bt) bt.onclick = btPrint;
    // cetak otomatis (diatur di menu Printer)
    if (!reprint && pp.auto && Printer.supported && (Printer.char || Printer.saved())) btPrint();
    m.$('[data-new]').onclick = () => m.close();
  }
  async function newSale() {
    ref = newRef(); pending = false;
    Object.assign(st, { cart: [], memberId: null, vouchers: [], fees: [], shipping: null, reward: null, note: '', offerShown: false, retur: null });
    document.body.classList.remove('cart-open');
    try { const [p, mem] = await Promise.all([db.list('products'), db.list('members')]); st.products = p; st.members = mem; } catch (e) { /* biarkan */ }
    refresh(); if (window.innerWidth > 900) scan.focus();
  }

  // ---------- event
  el('[data-scanform]').onsubmit = (e) => { e.preventDefault(); handleScan(scan.value); };
  scan.oninput = debounce(() => { st.q = scan.value; renderGrid(); }, 150);
  el('[data-camera]').onclick = async () => { const code = await scanWithCamera(); if (code) handleScan(code); };
  el('[data-addprod]').onclick = addProductModal;
  el('[data-lay]').onclick = (e) => App.layoutMenu(e.currentTarget);
  el('[data-prn]').onclick = printerMenu;
  el('[data-kmenu]').onclick = () => App.rail(true);
  el('[data-cats]').onclick = (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; st.cat = b.dataset.cat; renderCats(); renderGrid(); };
  el('[data-promos]').onclick = (e) => { const b = e.target.closest('[data-promo]'); if (!b) return; const p = st.promos.find((x) => x.id === +b.dataset.promo); if (p.code) applyVoucher(p.code); else toast('Promo otomatis', `${p.name} langsung terpotong saat syarat terpenuhi.`); };
  el('[data-grid]').onclick = (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = groups().find((x) => x.key === b.dataset.g); if (!g) return;
    const avail = g.items.filter((p) => p.stock > 0);
    if (!g.model && avail.length === 1) addToCart(avail[0]); else variantSheet(g);
  };
  el('[data-items]').onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.inc) setQty(+t.dataset.inc, st.cart.find((c) => c.id === +t.dataset.inc).qty + 1);
    if (t.dataset.dec) setQty(+t.dataset.dec, st.cart.find((c) => c.id === +t.dataset.dec).qty - 1);
    if (t.dataset.del) setQty(+t.dataset.del, 0);
    if (t.dataset.price) priceModal(+t.dataset.price);
    if (t.dataset.rmret !== undefined) { st.retur = null; renderCart(); }
  };
  el('[data-items]').onchange = (e) => { if (e.target.dataset.qty) setQty(+e.target.dataset.qty, num(e.target.value)); };
  el('[data-extras]').onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.rmv) st.vouchers = st.vouchers.filter((p) => p.id !== +t.dataset.rmv);
    if (t.dataset.rmf) st.fees = st.fees.filter((f) => f.id !== t.dataset.rmf);
    if (t.dataset.rmr !== undefined) st.reward = null;
    if (t.dataset.rms !== undefined) st.shipping = null;
    renderCart();
  };
  el('[data-totals]').onclick = (e) => { if (e.target.closest('[data-reward]')) rewardModal(); };
  el('[data-member]').onclick = memberModal;
  el('[data-voucher]').onclick = voucherModal;
  el('[data-fee]').onclick = feeModal;
  el('[data-ship]').onclick = shipModal;
  el('[data-retur]').onclick = () => returModal();
  el('[data-clear]').onclick = async () => { if ((st.cart.length || st.retur) && await confirmBox('Kosongkan keranjang?', 'Semua barang, promo, dan member di keranjang ini akan dihapus.', 'Kosongkan')) newSale(); };
  el('[data-pay]').onclick = requestPay;
  el('[data-opencart]').onclick = () => document.body.classList.add('cart-open');
  el('[data-closecart]').onclick = () => document.body.classList.remove('cart-open');
  const onKey = (e) => {
    if ($('.modal-bg')) return;
    if (e.key === 'F2') { e.preventDefault(); scan.focus(); scan.select(); }
    if (e.key === 'F9') { e.preventDefault(); requestPay(); }
  };
  document.addEventListener('keydown', onKey);

  await restoreDraft();
  renderCats(); refresh(); prnUpd();
  if (window.innerWidth > 900) scan.focus();
  return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('cart-open'); Printer.listeners.delete(prnUpd); };
}
