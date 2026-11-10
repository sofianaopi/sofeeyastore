/* Sofeeya Store POS — kerangka aplikasi + halaman Kasir */
'use strict';

const App = {
  user: null, settings: {}, view: null, views: {}, cleanup: null,
  sig: null, lastTx: 0, newTx: [], pendingChecks: 0,

  NAV: [
    { id: 'kasir', label: 'Kasir', icon: 'kasir', can: () => true },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', can: (u) => u.role === 'admin' },
    { id: 'laporan', label: 'Laporan', icon: 'laporan', can: () => true },
    { id: 'produk', label: 'Produk & stok', icon: 'produk', can: (u) => u.role === 'admin' },
    { id: 'promo', label: 'Promo', icon: 'promo', can: (u) => u.promo_access },
    { id: 'member', label: 'Member', icon: 'member', can: () => true },
    { id: 'sales', label: 'Sales & komisi', icon: 'sales', can: (u) => u.role === 'admin' },
    { sep: true },
    { id: 'info', label: 'Info kasir', icon: 'info', can: (u) => u.role === 'admin' },
    { id: 'pengaturan', label: 'Pengaturan toko', icon: 'setting', can: (u) => u.role === 'admin' },
    { id: 'pengguna', label: 'Pengguna', icon: 'users', can: (u) => u.role === 'admin' },
    { id: 'tautan', label: 'Rumah tautan', icon: 'link', can: () => true },
    { id: 'printer', label: 'Printer', icon: 'printer', can: () => true },
    { id: 'akun', label: 'Akun saya', icon: 'akun', can: () => true },
  ],
  isAdmin() { return this.user && this.user.role === 'admin'; },

  async start() {
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
    document.body.className = '';
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
        <div class="brandmark"><div class="logo">${esc(name[0] || 'S')}</div><div><b>${esc(name)}</b><span>${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div></div>
        <nav class="nav">${nav.map((n) => n.sep ? '<div class="sep"></div>' : `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${esc(n.label)}</span>${n.id === 'laporan' ? '<span class="badge hidden" data-txbadge></span>' : ''}${n.id === 'produk' ? '<span class="badge hidden" data-chkbadge></span>' : ''}</a>`).join('')}
          <div class="sep"></div>
          <a href="absen.html">${icon('finger')}<span>Absen</span></a>
          ${u.cek_stok_access ? `<a href="cek-stok.html">${icon('clipboard')}<span>Cek stok</span></a>` : ''}
          ${u.role === 'admin' ? `<a href="#" data-broadcast>${icon('refresh')}<span>Refresh semua perangkat</span></a>` : ''}
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
    $$('[data-menu]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); document.body.classList.toggle('nav-open'); }));
    $('[data-scrim]').onclick = () => document.body.classList.remove('nav-open');
    const bc = $('[data-broadcast]');
    if (bc) bc.onclick = async (e) => {
      e.preventDefault();
      if (!(await confirmBox('Refresh semua perangkat?', 'Semua perangkat kasir yang sedang terbuka akan memuat ulang dalam ±20 detik. Gunakan setelah mengubah harga atau promo.', 'Kirim refresh', false))) return;
      try { const r = await api('broadcast_refresh'); this.sig = r.id; toast('Perintah refresh terkirim', '', 'ok'); } catch (ex) { toastErr(ex); }
    };
    window.onhashchange = () => this.route();
    this.route();
    this.startPing();
  },

  route() {
    const u = this.user; if (!u) return;
    let id = (location.hash || '').replace('#', '').split('/')[0];
    const allowed = this.NAV.filter((n) => !n.sep && n.can(u)).map((n) => n.id);
    if (!allowed.includes(id)) id = u.role === 'admin' ? 'dashboard' : 'kasir';
    document.body.classList.remove('nav-open', 'cart-open');
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
    products: [], promos: [], members: [], sales: [], infos: [], rewards: [],
    cart: [], cat: 'Semua', q: '', memberId: null, vouchers: [], fees: [], reward: null, note: '', offerShown: false,
  };
  page.innerHTML = `
  <div class="pos">
    <section class="pos-left">
      <div class="pos-tools">
        <form class="scanbox" data-scanform>${icon('barcode')}<input data-scan placeholder="Scan barcode atau ketik nama barang…" autocomplete="off" aria-label="Scan barcode atau cari barang"></form>
        <button class="btn icon" data-camera title="Scan pakai kamera" aria-label="Scan pakai kamera">${icon('camera')}</button>
        <button class="btn" data-addprod title="Tambah barang baru">${icon('plus')}<span class="hide-sm">Barang</span></button>
      </div>
      <div class="cats" data-cats></div>
      <div class="promostrip" data-promos></div>
      <div class="products" data-grid><div class="empty">Memuat barang…</div></div>
      <div class="marquee" data-marquee></div>
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
  style.textContent = '@media(min-width:901px){.mobile-only{display:none!important}} @media(max-width:520px){.hide-sm{display:none}}';
  page.appendChild(style);

  const el = (s) => $(s, page);
  const scan = el('[data-scan]');

  // ---------- muat data
  try {
    const [products, promos, members, sales, infos, rewards] = await Promise.all([
      db.list('products'), db.list('promos', { where: { active: 1 } }), db.list('members'),
      db.list('sales', { where: { active: 1 } }), db.list('store_info', { where: { active: 1 } }), db.list('point_rewards', { where: { active: 1 } }),
    ]);
    Object.assign(st, { products, promos, members, sales, infos, rewards });
  } catch (e) { toastErr(e); }

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
    const fee = st.fees.reduce((s, f) => s + f.amount, 0);
    const total = Math.max(0, subtotal - discount + fee);
    const count = cart.reduce((s, c) => s + c.qty, 0);
    const promoNames = eff.filter((p) => pc.perPromo[p.id]).map((p) => p.name);
    return { subtotal, pc, memberDisc, voucher, blocked, rewardDisc, prodDisc, discount, fee, total, count, promoNames, eff, m };
  }

  // ---------- render
  function renderCats() {
    const cats = ['Semua', ...new Set(st.products.map((p) => p.category).filter(Boolean))].sort((a, b) => (a === 'Semua' ? -1 : b === 'Semua' ? 1 : a.localeCompare(b)));
    el('[data-cats]').innerHTML = cats.map((c) => `<button class="${c === st.cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }
  function renderPromos() {
    const r = calc();
    const list = activePromos();
    el('[data-promos]').innerHTML = list.map((p) => `<button class="pcard ${r.pc.perPromo[p.id] ? 'on' : ''}" data-promo="${p.id}"><b>${esc(p.name)}</b><span>${esc(Promo.describe(p))}</span><em>${p.code ? 'Kode ' + esc(p.code) : 'Berlaku otomatis'}${(p.categories || []).length ? ' · ' + esc(p.categories.join(', ')) : ''}</em></button>`).join('');
    el('[data-promos]').classList.toggle('hidden', !list.length);
    const segs = [...st.infos.map((i) => i.title + (i.content ? ' — ' + i.content : '')), ...list.map((p) => `Promo ${p.name}: ${Promo.describe(p)}${p.code ? ' (kode ' + p.code + ')' : ''}`)];
    const text = segs.length ? segs.join('      •      ') : 'Selamat bekerja! Belum ada info atau promo aktif.';
    el('[data-marquee]').innerHTML = `<span class="tag">Info</span><div style="overflow:hidden;flex:1"><div class="trk"><span>${esc(text)}</span><span aria-hidden="true">${esc(text)}</span></div></div>`;
  }
  const alive = () => !!el('[data-grid]') && App.view === 'kasir';
  function renderGrid() {
    if (!alive()) return;
    const q = st.q.trim().toLowerCase();
    const act = activePromos();
    const list = st.products.filter((p) => (st.cat === 'Semua' || p.category === st.cat) && (!q || p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q)));
    const inCart = Object.fromEntries(st.cart.map((c) => [c.id, c.qty]));
    if (!list.length) { el('[data-grid]').innerHTML = emptyState(st.products.length ? 'Barang tidak ditemukan.' : 'Belum ada barang. Tambahkan lewat menu Produk & stok.'); return; }
    el('[data-grid]').innerHTML = list.slice(0, 400).map((p) => {
      const out = p.stock <= 0; const b = Promo.badgeFor(p, act);
      return `<button class="prod" data-add="${p.id}" ${out ? 'disabled style="opacity:.45"' : ''}>
        ${b ? `<span class="bdg" style="background:${BADGE_COLORS[b.badge_color] || '#7C3AED'}">${esc(b.badge_text)}</span>` : ''}
        ${inCart[p.id] ? `<span class="qtyin">${inCart[p.id]}</span>` : ''}
        <span class="nm">${esc(p.name)}</span>
        <span class="meta">${esc(p.category || 'Tanpa kategori')} · ${out ? '<span class="danger bold">Habis</span>' : p.stock <= 3 ? `<span class="low">Sisa ${p.stock}</span>` : 'Stok ' + p.stock}</span>
        <span class="pr">${p.discount > 0 ? `<s>${rupiah(p.price)}</s>${rupiah(p.price - p.discount)}` : rupiah(p.price)}</span>
      </button>`;
    }).join('');
  }
  function renderCart() {
    if (!alive()) return;
    const r = calc();
    const m = r.m;
    el('[data-membername]').textContent = m ? m.name + ' · ' + fmtNum(m.points) + ' poin' : 'Pilih member';
    el('[data-member]').classList.toggle('primary', !!m);
    el('[data-items]').innerHTML = st.cart.length ? st.cart.map((c) => {
      const ip = r.pc.itemPromo[c.id]; const disc = (ip ? ip.amount : 0) + (c.discount || 0) * c.qty;
      return `<div class="line"><div class="t"><b>${esc(c.name)}</b><button class="btn ghost icon sm" data-del="${c.id}" aria-label="Hapus">${icon('trash')}</button></div>
        <div class="c"><div class="qty"><button data-dec="${c.id}" aria-label="Kurangi">−</button><input data-qty="${c.id}" value="${c.qty}" inputmode="numeric" aria-label="Jumlah"><button data-inc="${c.id}" aria-label="Tambah">+</button></div>
        <span class="pp">@${rupiah(c.price)}${c.price !== c.original_price ? ' <span class="chip amber">diubah</span>' : ''} <button data-price="${c.id}">ubah</button></span>
        <span class="sum">${disc > 0 ? `<s>${rupiah(c.price * c.qty)}</s>${rupiah(c.price * c.qty - disc)}` : rupiah(c.price * c.qty)}</span></div>
        ${disc > 0 ? `<div class="dl">Hemat ${rupiah(disc)}${ip ? ' · ' + esc(ip.promoName) : ''}${c.discount > 0 ? (ip ? ' + ' : ' · ') + 'harga khusus' : ''}</div>` : ''}</div>`;
    }).join('') : `<div class="empty" style="padding:50px 10px">${icon('cart')}Scan barcode atau ketuk barang untuk mulai.</div>`;

    const chips = [
      ...st.vouchers.map((p) => `<span class="chip blue">${esc(p.code)} <button data-rmv="${p.id}" aria-label="Hapus promo">×</button></span>`),
      ...st.fees.map((f) => `<span class="chip amber">${esc(f.label)} ${rupiah(f.amount)} <button data-rmf="${f.id}" aria-label="Hapus biaya">×</button></span>`),
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
      ${r.fee > 0 ? `<div class="r"><span>Biaya tambahan</span><span>+${rupiah(r.fee)}</span></div>` : ''}
      <div class="r big"><span>Total</span><span>${rupiah(r.total)}</span></div>
      ${m && eligible.length && !st.reward ? `<button class="btn sm" data-reward style="margin-top:6px;width:100%">${icon('gift')} ${eligible.length} reward poin bisa ditukar</button>` : ''}`;
    el('[data-pay]').disabled = !st.cart.length;
    el('[data-pay]').textContent = st.cart.length ? 'Bayar ' + rupiah(r.total) : 'Bayar';
    el('[data-fabcount]').textContent = r.count + ' barang';
    el('[data-fabtotal]').textContent = rupiah(r.total);
    renderPromos();
  }
  const refresh = () => { renderCart(); renderGrid(); };

  // ---------- aksi keranjang
  function addToCart(p, qty = 1) {
    const ex = st.cart.find((c) => c.id === p.id);
    const have = ex ? ex.qty : 0;
    if (have + qty > p.stock) { toast('Stok tidak cukup', `${p.name}: sisa ${p.stock}`, 'err'); return; }
    if (ex) ex.qty += qty;
    else st.cart.push({ id: p.id, name: p.name, barcode: p.barcode, category: p.category, price: p.price, original_price: p.price, cost: p.cost, commission: p.commission, discount: p.discount || 0, qty, stock: p.stock });
    refresh();
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
    const p = st.products.find((x) => x.barcode && x.barcode.toLowerCase() === code.toLowerCase());
    if (p) { addToCart(p); toast('Ditambahkan', p.name); scan.value = ''; st.q = ''; renderGrid(); return; }
    const matches = st.products.filter((x) => x.name.toLowerCase().includes(code.toLowerCase()));
    if (matches.length === 1) { addToCart(matches[0]); scan.value = ''; st.q = ''; renderGrid(); return; }
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
    const m = modal({ title: 'Biaya tambahan', body: `<div class="stack" data-f>${field('Keterangan', 'label', '', { placeholder: 'Ongkir, jahit, bungkus kado…' })}${field('Nominal (Rp)', 'amount', '', { numeric: true })}</div>`, foot: '<button class="btn primary" data-ok>Tambahkan</button>' });
    m.$('[data-ok]').onclick = () => { const v = formValues(m.$('[data-f]')); if (!v.label || !(v.amount > 0)) { toast('Isi keterangan dan nominal', '', 'err'); return; } st.fees.push({ id: uid(), label: v.label, amount: v.amount }); m.close(); renderCart(); };
  }
  function rewardModal() {
    const mem = member(); if (!mem) return;
    const list = st.rewards.filter((x) => x.points_required <= mem.points);
    const m = modal({ title: 'Tukar poin member', body: `<p class="muted" style="margin-top:0">${esc(mem.name)} punya <b>${fmtNum(mem.points)} poin</b>.</p><div class="pick">${list.map((x) => `<button data-rw="${x.id}"><div class="grow"><b>${esc(x.name)}</b><div class="small muted">${x.type === 'discount' ? 'Potongan ' + rupiah(x.discount_amount) : 'Hadiah: ' + esc(x.product_name)}</div></div><span class="chip gold">${fmtNum(x.points_required)} poin</span></button>`).join('')}</div>` });
    $$('[data-rw]', m.el).forEach((b) => (b.onclick = () => { st.reward = st.rewards.find((x) => x.id === +b.dataset.rw); m.close(); toast('Reward dipakai', st.reward.name, 'ok'); renderCart(); }));
  }
  async function priceModal(id) {
    const c = st.cart.find((x) => x.id === id); if (!c) return;
    const m = modal({ title: 'Ubah harga', body: `<p class="muted" style="margin-top:0">${esc(c.name)} — harga normal ${rupiah(c.original_price)}</p>${field('Harga baru per pcs', 'price', c.price, { numeric: true })}${isAdmin ? '' : '<p class="small muted">Perubahan harga memerlukan kode supervisor.</p>'}`, foot: `<button class="btn" data-reset>Kembalikan normal</button><button class="btn primary" data-ok>Simpan harga</button>` });
    const save = async (price) => {
      if (!isAdmin) { m.close(); const pin = await askPin('Masukkan kode supervisor untuk mengubah harga.'); if (!pin) return; }
      else m.close();
      c.price = Math.max(0, price); toast('Harga diperbarui', `${c.name}: ${rupiah(c.price)}`); renderCart();
    };
    m.$('[data-ok]').onclick = () => save(num(m.$('[name=price]').value));
    m.$('[data-reset]').onclick = () => { c.price = c.original_price; m.close(); renderCart(); };
  }
  function addProductModal() {
    const m = modal({ title: 'Tambah barang baru', size: 'wide', body: `<div class="grid2" data-f>${field('Nama barang', 'name')}${field('Barcode / kode', 'barcode', scan.value.trim())}${field('Kategori', 'category', '', { attrs: 'list="catlist"' })}${field('Stok', 'stock', '', { numeric: true })}${field('Harga beli', 'cost', '', { numeric: true })}${field('Harga jual', 'price', '', { numeric: true })}${field('Komisi sales / pcs', 'commission', '', { numeric: true })}</div><datalist id="catlist">${[...new Set(st.products.map((p) => p.category).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>${isAdmin ? '' : '<p class="small muted">Menambah barang dari kasir memerlukan kode supervisor.</p>'}`, foot: '<button class="btn primary" data-ok>Simpan barang</button>' });
    m.$('[data-ok]').onclick = async () => {
      const v = formValues(m.$('[data-f]'));
      if (!v.name) { toast('Nama barang wajib diisi', '', 'err'); return; }
      let pin = '';
      if (!isAdmin) { pin = await askPin('Masukkan kode supervisor untuk menambah barang.'); if (!pin) return; }
      try { const rec = await db.create('products', v, { pin }); st.products.push(rec); st.products.sort((a, b) => a.name.localeCompare(b.name)); m.close(); toast('Barang ditambahkan', rec.name, 'ok'); renderCats(); if (rec.stock > 0) addToCart(rec); else renderGrid(); }
      catch (ex) { toastErr(ex); }
    };
  }

  // ---------- pembayaran
  function requestPay() {
    if (!st.cart.length) return;
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
    const quick = [...new Set([r.total, Math.ceil(r.total / 50000) * 50000, Math.ceil(r.total / 100000) * 100000, 100000, 200000, 500000].filter((v) => v >= r.total))].slice(0, 5);
    const m = modal({ title: 'Pembayaran', body: `
      <div class="bigtotal"><span>Total bayar</span><b>${rupiah(r.total)}</b></div>
      <div class="stack" style="margin-top:14px">
        <div class="paymethods">${[['cash', 'Tunai', 'cash'], ['qris', 'QRIS', 'qr'], ['transfer', 'Debit/Transfer', 'card']].map(([k, l, ic]) => `<button data-m="${k}" class="${k === 'cash' ? 'on' : ''}">${icon(ic)}${l}</button>`).join('')}</div>
        <div data-cashbox>${field('Uang diterima', 'pay', '', { numeric: true, placeholder: '0' })}
          <div class="quick" style="margin-top:8px">${quick.map((v) => `<button data-q="${v}">${v === r.total ? 'Uang pas' : rupiah(v)}</button>`).join('')}</div>
          <p class="bold" style="margin:10px 0 0" data-change></p></div>
        <div class="grid2">${field('Kode sales (opsional)', 'sales', '', { placeholder: 'SLS01', attrs: 'style="text-transform:uppercase" list="saleslist"' })}${field('Catatan (opsional)', 'note', st.note)}</div>
        <datalist id="saleslist">${st.sales.map((s) => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('')}</datalist>
        <p class="small muted" data-salesname style="margin:-6px 0 0"></p>
      </div>`, foot: '<button class="btn" data-cancel>Kembali</button><button class="btn gold" data-finish style="min-width:170px;height:44px">Selesaikan transaksi</button>' });
    const pay = m.$('[name=pay]');
    const upd = () => {
      const v = num(pay.value);
      const ch = m.$('[data-change]');
      if (method !== 'cash') { ch.textContent = ''; return; }
      ch.innerHTML = v >= r.total ? `Kembalian: <span class="money">${rupiah(v - r.total)}</span>` : v > 0 ? `<span class="danger">Kurang ${rupiah(r.total - v)}</span>` : '';
    };
    pay.oninput = upd;
    m.$$('[data-q]').forEach((b) => (b.onclick = () => { pay.value = b.dataset.q; upd(); }));
    m.$$('[data-m]').forEach((b) => (b.onclick = () => { method = b.dataset.m; m.$$('[data-m]').forEach((x) => x.classList.toggle('on', x === b)); m.$('[data-cashbox]').classList.toggle('hidden', method !== 'cash'); upd(); }));
    m.$('[name=sales]').oninput = (e) => { const s = st.sales.find((x) => x.code.toUpperCase() === e.target.value.trim().toUpperCase()); m.$('[data-salesname]').textContent = e.target.value.trim() ? (s ? 'Sales: ' + s.name : 'Kode sales tidak dikenal') : ''; };
    m.$('[data-cancel]').onclick = () => m.close();
    if (window.innerWidth > 700) setTimeout(() => pay.focus(), 40);
    m.$('[data-finish]').onclick = async () => {
      const payNum = method === 'cash' ? num(pay.value) : r.total;
      if (method === 'cash' && payNum < r.total) { toast('Uang diterima kurang dari total', '', 'err'); pay.focus(); return; }
      const btn = m.$('[data-finish]'); btn.disabled = true; btn.textContent = 'Menyimpan…';
      const extra = r.memberDisc + r.rewardDisc;
      const items = st.cart.map((c) => { const ip = r.pc.itemPromo[c.id]; const line = c.price * c.qty; return { id: c.id, qty: c.qty, price: c.price, discount: c.discount, promoName: ip ? ip.promoName : '', itemDiscount: Math.round((ip ? ip.amount : 0) + (c.discount || 0) * c.qty + (r.subtotal ? (line / r.subtotal) * extra : 0)) }; });
      try {
        const trx = await api('checkout', {
          items, discount: r.discount, fee: r.fee, fee_note: st.fees.map((f) => `${f.label} ${rupiah(f.amount)}`).join('; '),
          payment: payNum, payment_method: method, member_id: st.memberId, reward_id: st.reward ? st.reward.id : null, voucher_applied: r.voucher > 0,
          sales_code: m.$('[name=sales]').value.trim(), promo_name: [...r.promoNames, st.reward ? 'Tukar poin: ' + st.reward.name : ''].filter(Boolean).join(', '),
          note: [m.$('[name=note]').value.trim(), st.reward && st.reward.type === 'product' ? 'Hadiah poin: ' + st.reward.product_name : ''].filter(Boolean).join(' | '),
        });
        m.close(); doneModal(trx);
      } catch (ex) { toastErr(ex); btn.disabled = false; btn.textContent = 'Selesaikan transaksi'; }
    };
  }
  function doneModal(trx) {
    const m = modal({ title: 'Transaksi berhasil', body: `<div class="center" style="margin-bottom:12px"><div class="chip green" style="height:28px;font-size:13px">${icon('check')} ${esc(trx.invoice)}</div>${trx.payment_method === 'cash' ? `<h1 style="margin-top:10px">Kembalian ${rupiah(trx.change)}</h1>` : ''}</div><div class="receipt-preview">${receiptHTML(trx, S)}</div>`,
      foot: `<button class="btn" data-print>${icon('printer')}Cetak struk</button>${Printer.supported ? `<button class="btn" data-bt>${icon('printer')}Printer Bluetooth</button>` : ''}<button class="btn primary" data-new>Transaksi baru</button>`, onClose: () => newSale() });
    m.$('[data-print]').onclick = () => printHTML(receiptHTML(trx, S));
    const bt = m.$('[data-bt]'); if (bt) bt.onclick = async () => { try { await Printer.print(escposReceipt(trx, S)); toast('Struk dikirim ke printer', '', 'ok'); } catch (ex) { toastErr(ex); } };
    m.$('[data-new]').onclick = () => m.close();
  }
  async function newSale() {
    Object.assign(st, { cart: [], memberId: null, vouchers: [], fees: [], reward: null, note: '', offerShown: false });
    document.body.classList.remove('cart-open');
    try { const [p, mem] = await Promise.all([db.list('products'), db.list('members')]); st.products = p; st.members = mem; } catch (e) { /* biarkan */ }
    refresh(); if (window.innerWidth > 900) scan.focus();
  }

  // ---------- event
  el('[data-scanform]').onsubmit = (e) => { e.preventDefault(); handleScan(scan.value); };
  scan.oninput = debounce(() => { st.q = scan.value; renderGrid(); }, 150);
  el('[data-camera]').onclick = async () => { const code = await scanWithCamera(); if (code) handleScan(code); };
  el('[data-addprod]').onclick = addProductModal;
  el('[data-cats]').onclick = (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; st.cat = b.dataset.cat; renderCats(); renderGrid(); };
  el('[data-promos]').onclick = (e) => { const b = e.target.closest('[data-promo]'); if (!b) return; const p = st.promos.find((x) => x.id === +b.dataset.promo); if (p.code) applyVoucher(p.code); else toast('Promo otomatis', `${p.name} langsung terpotong saat syarat terpenuhi.`); };
  el('[data-grid]').onclick = (e) => { const b = e.target.closest('[data-add]'); if (!b) return; const p = st.products.find((x) => x.id === +b.dataset.add); if (p) addToCart(p); };
  el('[data-items]').onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.inc) setQty(+t.dataset.inc, st.cart.find((c) => c.id === +t.dataset.inc).qty + 1);
    if (t.dataset.dec) setQty(+t.dataset.dec, st.cart.find((c) => c.id === +t.dataset.dec).qty - 1);
    if (t.dataset.del) setQty(+t.dataset.del, 0);
    if (t.dataset.price) priceModal(+t.dataset.price);
  };
  el('[data-items]').onchange = (e) => { if (e.target.dataset.qty) setQty(+e.target.dataset.qty, num(e.target.value)); };
  el('[data-extras]').onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.rmv) st.vouchers = st.vouchers.filter((p) => p.id !== +t.dataset.rmv);
    if (t.dataset.rmf) st.fees = st.fees.filter((f) => f.id !== t.dataset.rmf);
    if (t.dataset.rmr !== undefined) st.reward = null;
    renderCart();
  };
  el('[data-totals]').onclick = (e) => { if (e.target.closest('[data-reward]')) rewardModal(); };
  el('[data-member]').onclick = memberModal;
  el('[data-voucher]').onclick = voucherModal;
  el('[data-fee]').onclick = feeModal;
  el('[data-clear]').onclick = async () => { if (st.cart.length && await confirmBox('Kosongkan keranjang?', 'Semua barang, promo, dan member di keranjang ini akan dihapus.', 'Kosongkan')) newSale(); };
  el('[data-pay]').onclick = requestPay;
  el('[data-opencart]').onclick = () => document.body.classList.add('cart-open');
  el('[data-closecart]').onclick = () => document.body.classList.remove('cart-open');
  const onKey = (e) => {
    if ($('.modal-bg')) return;
    if (e.key === 'F2') { e.preventDefault(); scan.focus(); scan.select(); }
    if (e.key === 'F9') { e.preventDefault(); requestPay(); }
  };
  document.addEventListener('keydown', onKey);

  renderCats(); refresh();
  if (window.innerWidth > 900) scan.focus();
  return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('cart-open'); };
}
