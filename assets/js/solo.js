/* Halaman mandiri: Absen pegawai & Cek stok */
'use strict';
const Solo = {
  settings: {}, user: null,
  async boot(kind) {
    try { const b = await api('boot'); this.settings = b.settings || {}; this.user = b.user; } catch (e) { $('#app').innerHTML = `<div class="solo"><div class="panel panel-b danger">${esc(e.message)}</div></div>`; return; }
    window.onSessionExpired = () => { this.user = null; this.login(kind); };
    this.user ? this[kind]() : this.login(kind);
  },
  header(title, sub) {
    return `<div class="solo-head"><a class="btn icon" href="./" aria-label="Kembali ke kasir">${icon('arrowleft')}</a><div class="grow"><h1>${esc(title)}</h1><span class="small muted">${esc(sub)}</span></div>${this.user ? `<button class="btn ghost sm" data-out>${icon('logout')}Keluar</button>` : ''}</div>`;
  },
  bindOut(kind) { const b = $('[data-out]'); if (b) b.onclick = async () => { await api('logout').catch(() => {}); this.user = null; this.login(kind); }; },
  login(kind) {
    const title = kind === 'absen' ? 'Absen pegawai' : 'Cek stok barang';
    $('#app').innerHTML = `<div class="solo">${this.header(title, this.settings.store_name || 'Toko Anda')}<form class="panel panel-b stack" data-f><p class="muted" style="margin:0">Masuk dengan akun pegawai Anda.</p>${field('Email', 'email', '', { type: 'email', attrs: 'autocomplete="username" required' })}${field('Kata sandi', 'password', '', { type: 'password', attrs: 'autocomplete="current-password" required' })}<button class="btn primary" style="height:46px">Masuk</button></form></div>`;
    $('[data-f]').onsubmit = async (e) => { e.preventDefault(); try { const r = await api('login', formValues(e.target)); this.user = r.user; this.settings = r.settings; this[kind](); } catch (ex) { toastErr(ex); } };
  },

  // ------------------------------------------------------------ ABSEN
  async absen() {
    let st;
    try { st = await api('attendance_status'); } catch (e) { toastErr(e); return; }
    const inRec = st.today.find((r) => r.type === 'in'), outRec = st.today.find((r) => r.type === 'out');
    const n = st.network;
    $('#app').innerHTML = `<div class="solo">${this.header('Absen pegawai', st.user.name)}
      <div class="panel panel-b center stack">
        <div class="clock" data-clock>--:--</div>
        <div class="muted">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · jam masuk ${esc(st.schedule.startTime)} (toleransi ${st.schedule.toleranceMinutes} menit)</div>
        ${n.ok ? `<div class="chip green" style="align-self:center">${icon('check')} ${n.restricted ? 'Terhubung ke jaringan toko' : 'Absen bisa dari mana saja'}</div>` : `<div class="chip red" style="align-self:center;height:auto;padding:6px 10px;white-space:normal">Bukan jaringan toko — sambungkan ke WiFi ${esc(n.wifiName || 'toko')} lalu muat ulang. (IP: ${esc(n.ip)})</div>`}
        <div data-latewarn></div>
        ${!inRec ? `<button class="btn primary bigbtn" data-in ${n.ok ? '' : 'disabled'}>${icon('finger')}Absen datang</button>`
          : !outRec ? `<p style="margin:0">Datang pukul <b>${fmtTime(inRec.created)}</b>${inRec.is_late ? ` <span class="chip amber">terlambat ${inRec.late_minutes} menit</span>` : ' <span class="chip green">tepat waktu</span>'}</p><button class="btn gold bigbtn" data-outbtn ${n.ok ? '' : 'disabled'}>${icon('logout')}Absen pulang</button>`
          : `<p style="margin:0">Hari ini selesai: datang <b>${fmtTime(inRec.created)}</b>, pulang <b>${fmtTime(outRec.created)}</b>. Sampai jumpa besok!</p>`}
        <p class="small muted" style="margin:0">Lokasi GPS ikut dicatat bila diizinkan.</p>
      </div>
      <h3 style="margin:20px 0 8px">Riwayat absen saya</h3>
      ${st.recent.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${st.recent.map((r) => `<tr><td>${fmtDate(r.created)}</td><td>${r.type === 'in' ? 'Datang' : 'Pulang'}</td><td class="num">${fmtTime(r.created)}</td><td>${r.type === 'in' ? (r.is_late ? `<span class="chip amber">+${r.late_minutes}m</span>` : '<span class="chip green">tepat</span>') : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada riwayat.</p>'}
    </div>`;
    this.bindOut('absen');
    const tick = () => { const c = $('[data-clock]'); if (!c) return clearInterval(this.t); const d = new Date(); c.textContent = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (!inRec) { const [h, m] = st.schedule.startTime.split(':').map(Number); const lim = new Date(); lim.setHours(h, m + st.schedule.toleranceMinutes, 0, 0); const late = Math.ceil((d - lim) / 60000); $('[data-latewarn]').innerHTML = late > 0 ? `<p class="small" style="margin:0;background:var(--warn-soft);color:var(--warn);padding:8px;border-radius:8px">Sudah lewat jam masuk ${late} menit — absen akan tercatat terlambat.</p>` : ''; } };
    clearInterval(this.t); this.t = setInterval(tick, 1000); tick();
    const go = async (type, btn) => {
      btn.disabled = true; btn.textContent = 'Mengambil lokasi…';
      const pos = await new Promise((res) => { if (!navigator.geolocation) return res({}); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { enableHighAccuracy: true, timeout: 8000 }); });
      try {
        const r = await api('attendance_check', { type, ...pos });
        if (type === 'in' && r.is_late) await alertBox('Tercatat terlambat', `Anda terlambat ${r.late_minutes} menit dari jadwal masuk.`);
        else toast(type === 'in' ? 'Absen datang tercatat' : 'Absen pulang tercatat', fmtTime(r.created), 'ok');
        this.absen();
      } catch (e) { toastErr(e); this.absen(); }
    };
    const bi = $('[data-in]'); if (bi) bi.onclick = () => go('in', bi);
    const bo = $('[data-outbtn]'); if (bo) bo.onclick = async () => { if (await confirmBox('Absen pulang sekarang?', 'Pastikan pekerjaan hari ini sudah selesai.', 'Absen pulang', false)) go('out', bo); };
  },

  // ------------------------------------------------------------ CEK STOK
  async cekstok() {
    if (!this.user.cek_stok_access) {
      $('#app').innerHTML = `<div class="solo">${this.header('Cek stok barang', this.user.name)}<div class="panel panel-b"><h2>Belum punya akses</h2><p class="muted">Minta admin mencentang "Boleh melakukan cek stok" pada akun Anda di menu Pengguna.</p></div></div>`;
      this.bindOut('cekstok'); return;
    }
    const [products, checks] = await Promise.all([db.list('products'), db.list('stock_checks', { limit: 300 })]);
    const pending = {}; checks.filter((c) => c.status === 'pending').forEach((c) => c.items.forEach((i) => { pending[i.product_id] = true; }));
    const marks = {}; // id -> {status:'ok'|'diff', stock, price}
    let q = '', cat = '';
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
    $('#app').innerHTML = `<div class="solo" style="max-width:720px">${this.header('Cek stok barang', this.user.name + ' · cocokkan stok & harga fisik dengan sistem')}
      <div class="stats" data-sum></div>
      <form class="scanbox" data-scan style="margin-bottom:10px">${icon('barcode')}<input placeholder="Scan barcode untuk menandai cocok…" autocomplete="off"></form>
      <div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari barang…"></div><select class="input" data-cat style="width:auto"><option value="">Semua kategori</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select><button class="btn icon" data-cam aria-label="Scan kamera">${icon('camera')}</button></div>
      <div class="stack" data-list style="gap:8px"></div>
      <div style="position:sticky;bottom:0;padding:12px 0;background:var(--paper)"><button class="btn primary" data-send style="width:100%;height:50px">Kirim hasil cek</button></div>
      <h3 style="margin:18px 0 8px">Pengajuan saya</h3><div data-hist></div></div>`;
    this.bindOut('cekstok');
    const drawSum = () => { const v = Object.values(marks); $('[data-sum]').innerHTML = `<div class="stat"><div class="k">Barang</div><div class="v">${products.length}</div></div><div class="stat"><div class="k">Cocok</div><div class="v money">${v.filter((m) => m.status === 'ok').length}</div></div><div class="stat"><div class="k">Berbeda</div><div class="v" style="color:var(--warn)">${v.filter((m) => m.status === 'diff').length}</div></div><div class="stat"><div class="k">Menunggu admin</div><div class="v">${Object.keys(pending).length}</div></div>`; };
    const draw = () => {
      const list = products.filter((p) => (!cat || p.category === cat) && (!q || [p.name, p.barcode].join(' ').toLowerCase().includes(q)));
      $('[data-list]').innerHTML = list.slice(0, 300).map((p) => { const m = marks[p.id]; const w = pending[p.id];
        return `<div class="check-item ${w ? 'wait' : m ? (m.status === 'ok' ? 'ok' : 'diff') : ''}"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.barcode || '-')} · sistem: stok <b>${p.stock}</b>, harga <b>${rupiah(p.price)}</b></div>
          ${m && m.status === 'diff' ? `<div class="row" style="margin-top:6px"><label class="f grow">Stok fisik<input class="input" data-as="${p.id}" value="${m.stock}" inputmode="numeric"></label><label class="f grow">Harga di label<input class="input" data-ap="${p.id}" value="${m.price}" inputmode="numeric"></label></div>` : ''}</div>
          ${w ? '<span class="chip amber">Menunggu admin</span>' : `<div class="row"><button class="btn sm ${m?.status === 'ok' ? 'primary' : ''}" data-ok="${p.id}">Cocok</button><button class="btn sm ${m?.status === 'diff' ? 'gold' : ''}" data-diff="${p.id}">Beda</button></div>`}</div>`; }).join('') || emptyState('Barang tidak ditemukan.');
      drawSum();
    };
    $('[data-list]').onclick = (e) => {
      const ok = e.target.closest('[data-ok]'), df = e.target.closest('[data-diff]');
      if (ok) { const id = +ok.dataset.ok; marks[id]?.status === 'ok' ? delete marks[id] : (marks[id] = { status: 'ok' }); draw(); }
      if (df) { const id = +df.dataset.diff; const p = products.find((x) => x.id === id); marks[id] = { status: 'diff', stock: p.stock, price: p.price }; draw(); const i = $(`[data-as="${id}"]`); if (i) i.focus(); }
    };
    $('[data-list]').oninput = (e) => { const s = e.target.dataset.as, pr = e.target.dataset.ap; if (s) marks[+s].stock = num(e.target.value); if (pr) marks[+pr].price = num(e.target.value); };
    $('[data-q]').oninput = debounce((e) => { q = e.target.value.toLowerCase(); draw(); }, 150);
    $('[data-cat]').onchange = (e) => { cat = e.target.value; draw(); };
    const mark = (code) => { const p = products.find((x) => x.barcode && x.barcode === code.trim()); if (!p) { toast('Barcode tidak dikenal', code, 'err'); return; } if (pending[p.id]) { toast('Masih menunggu admin', p.name); return; } marks[p.id] = { status: 'ok' }; toast('Ditandai cocok', p.name, 'ok'); draw(); };
    $('[data-scan]').onsubmit = (e) => { e.preventDefault(); const i = $('input', e.target); mark(i.value); i.value = ''; };
    $('[data-cam]').onclick = async () => { const c = await scanWithCamera(); if (c) mark(c); };
    $('[data-send]').onclick = async () => {
      const items = Object.entries(marks).map(([id, m]) => { const p = products.find((x) => x.id === +id); return { product_id: +id, actual_stock: m.status === 'ok' ? p.stock : m.stock, actual_price: m.status === 'ok' ? p.price : m.price }; });
      if (!items.length) { toast('Belum ada barang yang ditandai', '', 'err'); return; }
      try { const r = await api('stockcheck_submit', { items }); toast('Hasil cek terkirim', `${r.matched} cocok, ${r.pending} menunggu persetujuan admin`, 'ok'); this.cekstok(); } catch (e) { toastErr(e); }
    };
    const mine = checks.filter((c) => c.petugas_id === this.user.id).slice(0, 15);
    $('[data-hist]').innerHTML = mine.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${mine.map((c) => `<tr><td>${fmtDT(c.created)}</td><td class="num">${c.items.length} barang</td><td><span class="chip ${c.status === 'approved' ? 'green' : c.status === 'rejected' ? 'red' : 'amber'}">${c.status === 'approved' ? 'Disetujui' : c.status === 'rejected' ? 'Ditolak' : 'Menunggu'}</span></td><td class="small muted">${esc(c.note)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada pengajuan.</p>';
    draw();
  },
};
