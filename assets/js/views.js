/* Sofeeya Store POS — halaman-halaman pengelolaan */
'use strict';
const V = App.views;

// ---------------------------------------------------------------- helper umum
function head(title, desc = '', actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div><div class="row wrap">${actions}</div></div>`;
}
function table(cols, rows, opt = {}) {
  if (!rows.length) return `<div class="tbl-wrap">${emptyState(opt.empty || 'Belum ada data.', opt.emptyIcon || 'box')}</div>`;
  return `<div class="tbl-wrap" ${opt.maxH ? `style="max-height:${opt.maxH}"` : ''}><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr ${opt.rowAttr ? opt.rowAttr(r, i) : ''}>${cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.html ? c.html(r, i) : esc(c.get ? c.get(r) : r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>${opt.foot ? `<tfoot><tr>${opt.foot.map((f, i) => `<td class="${cols[i] && cols[i].num ? 'num' : ''}">${f}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}
function tabs(list, cur) { return `<div class="seg" data-tabs>${list.map(([k, l]) => `<button data-t="${k}" class="${k === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; }
function bindTabs(root, onChange) { $('[data-tabs]', root).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; $$('[data-t]', root).forEach((x) => x.classList.toggle('on', x === b)); onChange(b.dataset.t); }; }
// pemilih periode
function periodPicker(id = 'p') {
  return `<div class="row wrap" data-period="${id}"><div class="seg"><button data-pr="today" class="on">Hari ini</button><button data-pr="7">7 hari</button><button data-pr="month">Bulan ini</button><button data-pr="lastmonth">Bulan lalu</button></div><input type="date" class="input" data-from style="width:auto"><span class="muted">s/d</span><input type="date" class="input" data-to style="width:auto"></div>`;
}
function bindPeriod(root, onChange) {
  const box = $('[data-period]', root), f = $('[data-from]', box), t = $('[data-to]', box);
  const set = (k) => {
    const d = new Date();
    if (k === 'today') { f.value = t.value = ymd(d); }
    if (k === '7') { f.value = ymd(addDays(d, -6)); t.value = ymd(d); }
    if (k === 'month') { f.value = ymd(new Date(d.getFullYear(), d.getMonth(), 1)); t.value = ymd(d); }
    if (k === 'lastmonth') { f.value = ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)); t.value = ymd(new Date(d.getFullYear(), d.getMonth(), 0)); }
    $$('[data-pr]', box).forEach((b) => b.classList.toggle('on', b.dataset.pr === k));
    onChange(f.value, t.value);
  };
  $$('[data-pr]', box).forEach((b) => (b.onclick = () => set(b.dataset.pr)));
  f.onchange = t.onchange = () => { $$('[data-pr]', box).forEach((b) => b.classList.remove('on')); if (f.value && t.value) onChange(f.value, t.value); };
  return { set, get: () => [f.value, t.value] };
}
const stat = (k, v, d = '', cls = '') => `<div class="stat ${cls}"><div class="k">${esc(k)}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
function crudModal({ title, fields, data = {}, onSave, size = '' }) {
  const m = modal({ title, size, body: `<div class="stack" data-f>${fields}</div>`, foot: `<button class="btn" data-cancel>Batal</button><button class="btn primary" data-save>Simpan</button>` });
  m.$('[data-cancel]').onclick = () => m.close();
  m.$('[data-save]').onclick = async () => {
    const b = m.$('[data-save]'); b.disabled = true;
    try { await onSave(formValues(m.$('[data-f]')), m); m.close(); } catch (e) { toastErr(e); b.disabled = false; }
  };
  return m;
}
// ---------------------------------------------------------------- dialog impor (Excel/CSV) dengan template
const IMPORT_KINDS = {
  products: {
    title: 'Impor data barang', aliases: 'product', action: 'product_import', mode: 'products', numeric: ['cost', 'price', 'discount', 'stock', 'commission'], need: ['name'],
    help: 'Barang dengan barcode atau nama yang sama akan diperbarui; sisanya ditambahkan sebagai barang baru.',
    file: 'template_produk', headers: ['Nama Produk', 'Barcode / Kode', 'Kategori', 'Harga Beli', 'Harga Jual', 'Diskon / pcs', 'Stok', 'Komisi Sales / pcs'],
    sample: [['Kemeja Kantor Putih', '8991234500011', 'Kemeja', 75000, 159000, 0, 12, 2000], ['Rok Span Hitam', '8991234500028', 'Rok', 55000, 129000, 20000, 10, 1500]], widths: [30, 18, 14, 12, 12, 12, 8, 18],
    tips: ['Wajib diisi: Nama Produk dan Harga Jual.', 'Harga & stok cukup angka, mis. 75000 (boleh juga 75.000 atau Rp75.000).', 'Barcode boleh dikosongkan.', 'Diskon / pcs = potongan harga khusus per barang. Isi 0 bila tidak ada.', 'Jangan ubah nama kolom di baris pertama. Boleh menambah/menghapus baris contoh.'],
    cols: [{ label: 'Nama', key: 'name' }, { label: 'Barcode', key: 'barcode' }, { label: 'Kategori', key: 'category' }, { label: 'Modal', num: true, get: (r) => rupiah(r.cost) }, { label: 'Jual', num: true, get: (r) => rupiah(r.price) }, { label: 'Stok', num: true, get: (r) => (r.stock ?? '') }],
  },
  discount: {
    title: 'Impor harga khusus (diskon)', aliases: 'discount', action: 'product_import', mode: 'discount', numeric: ['discount'], need: ['barcode|name', 'discount'],
    help: 'Hanya memperbarui kolom Diskon / pcs. Barang dicocokkan lewat barcode, lalu nama. Barang yang tidak ditemukan dilewati.',
    file: 'template_harga_khusus', headers: ['Barcode / Kode', 'Nama Produk', 'Diskon / pcs'], sample: [['8991234500011', 'Kemeja Kantor Putih', 20000]], widths: [18, 30, 14],
    tips: ['Isi Barcode atau Nama Produk yang sudah terdaftar.', 'Diskon / pcs dalam rupiah. Isi 0 untuk menghapus diskon.'],
    cols: [{ label: 'Barcode', key: 'barcode' }, { label: 'Nama', key: 'name' }, { label: 'Diskon', num: true, get: (r) => rupiah(r.discount) }],
  },
  members: {
    title: 'Impor data member', aliases: 'member', action: 'member_import', numeric: ['points'], need: ['name'],
    help: 'Member dengan nomor HP yang sama akan diperbarui; sisanya ditambahkan.',
    file: 'template_member', headers: ['Nama', 'Telepon', 'Email', 'Poin'], sample: [['Siti Amelia', '081234567890', 'siti@email.com', 0]], widths: [26, 18, 26, 8],
    tips: ['Wajib diisi: Nama.', 'Tulis nomor HP sebagai teks agar angka 0 di depan tidak hilang (contoh sudah diformat teks).'],
    cols: [{ label: 'Nama', key: 'name' }, { label: 'Telepon', key: 'phone' }, { label: 'Email', key: 'email' }, { label: 'Poin', num: true, key: 'points' }],
  },
};
function importDialog(kinds, onDone) {
  let kind = kinds[0], rows = [];
  const K = () => IMPORT_KINDS[kind];
  const m = modal({ title: K().title, size: 'wide', body: `<div class="stack">
    ${kinds.length > 1 ? `<div class="seg" data-kinds>${kinds.map((k, i) => `<button data-k="${k}" class="${i ? '' : 'on'}">${k === 'products' ? 'Data barang lengkap' : 'Hanya harga khusus'}</button>`).join('')}</div>` : ''}
    <div class="panel panel-b" style="background:#FAFBFD"><b>1. Unduh template, isi di Excel / WPS / Google Sheets</b><p class="small muted" data-help style="margin:4px 0 10px"></p><button class="btn" data-tpl>${icon('download')}Unduh template (.xlsx)</button></div>
    <div class="panel panel-b" style="background:#FAFBFD"><b>2. Pilih file yang sudah diisi</b><p class="small muted" style="margin:4px 0 10px">Format yang diterima: .xlsx, .csv (juga .xls). Simpan file terlebih dahulu sebelum diunggah.</p>
      <label class="btn primary" style="cursor:pointer">${icon('upload')}Pilih file<input type="file" data-input style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></label> <span class="small muted" data-fname></span></div>
    <div data-prev></div></div>`, foot: '<button class="btn" data-cancel>Batal</button><button class="btn primary" data-go disabled>Impor</button>' });
  const setKind = (k) => { kind = k; rows = []; m.$('.modal-h h2').textContent = K().title; m.$('[data-help]').textContent = K().help; m.$('[data-prev]').innerHTML = ''; m.$('[data-fname]').textContent = ''; m.$('[data-input]').value = ''; m.$('[data-go]').disabled = true; };
  setKind(kind);
  const ks = m.$('[data-kinds]'); if (ks) ks.onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; m.$$('[data-k]').forEach((x) => x.classList.toggle('on', x === b)); setKind(b.dataset.k); };
  m.$('[data-cancel]').onclick = () => m.close();
  m.$('[data-tpl]').onclick = () => downloadXLSX(K().file + '.xlsx', [{ name: 'Data', rows: [K().headers, ...K().sample], widths: K().widths }, { name: 'Petunjuk', header: false, rows: [['Petunjuk pengisian'], [''], ...K().tips.map((t) => [t])], widths: [90] }]);
  m.$('[data-input]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    m.$('[data-fname]').textContent = f.name; m.$('[data-prev]').innerHTML = '<div class="empty">Membaca file…</div>'; m.$('[data-go]').disabled = true;
    try {
      const { rows: raw, headers } = await parseImportFile(f, ALIASES[K().aliases]);
      rows = raw.map((r) => mapRow(r, ALIASES[K().aliases])).filter((r) => K().need.every((n) => n.split('|').some((x) => r[x] !== undefined && r[x] !== '')));
      rows.forEach((r) => { K().numeric.forEach((k) => { if (r[k] !== undefined) r[k] = numID(r[k]); }); if (r.phone && /^8\d{7,12}$/.test(r.phone)) r.phone = '0' + r.phone; if (r.barcode) r.barcode = String(r.barcode).trim(); });
      if (!rows.length) {
        m.$('[data-prev]').innerHTML = `<div class="panel panel-b" style="background:var(--danger-soft)"><b class="danger">Tidak ada baris yang bisa diimpor.</b><p class="small" style="margin:6px 0 0">Kolom yang terbaca di file: <b>${esc(headers.filter(Boolean).join(', ') || '(kosong)')}</b>.<br>Kolom yang dibutuhkan: <b>${esc(K().headers.join(', '))}</b>. Pastikan baris pertama berisi nama kolom seperti di template dan kolom wajib terisi.</p></div>`;
        return;
      }
      const skipped = raw.length - rows.length;
      m.$('[data-prev]').innerHTML = `<p class="bold" style="margin:0 0 8px">${rows.length} baris siap diimpor${skipped ? ` <span class="chip amber">${skipped} baris kosong/tidak lengkap dilewati</span>` : ''}</p>` + table(K().cols, rows.slice(0, 50), { maxH: '260px' }) + (rows.length > 50 ? `<p class="small muted">…dan ${rows.length - 50} baris lainnya.</p>` : '');
      m.$('[data-go]').disabled = false;
    } catch (ex) { m.$('[data-prev]').innerHTML = `<div class="panel panel-b" style="background:var(--danger-soft)"><b class="danger">File tidak bisa dibaca</b><p class="small" style="margin:6px 0 0">${esc(ex.message)}</p></div>`; }
  };
  m.$('[data-go]').onclick = async () => {
    const b = m.$('[data-go]'); b.disabled = true; b.textContent = 'Mengimpor…';
    try {
      let tot = { created: 0, updated: 0, skipped: 0 };
      for (let i = 0; i < rows.length; i += 500) { const r = await api(K().action, { rows: rows.slice(i, i + 500), mode: K().mode }); tot = { created: tot.created + (r.created || 0), updated: tot.updated + (r.updated || 0), skipped: tot.skipped + (r.skipped || 0) }; }
      toast('Impor selesai', `${tot.created} baru, ${tot.updated} diperbarui${tot.skipped ? ', ' + tot.skipped + ' dilewati' : ''}`, 'ok'); m.close(); onDone && onDone();
    } catch (ex) { toastErr(ex); b.disabled = false; b.textContent = 'Impor'; }
  };
}

// ringkasan transaksi
function sumTx(list) {
  return list.reduce((a, t) => { a.omzet += t.total; a.laba += t.profit; a.diskon += t.discount; a.items += t.item_count; a.komisi += t.commission; a.n++; return a; }, { omzet: 0, laba: 0, diskon: 0, items: 0, komisi: 0, n: 0 });
}
function delta(cur, prev) {
  if (!prev) return cur ? '<span class="money">baru</span>' : '<span class="muted">—</span>';
  const p = Math.round(((cur - prev) / prev) * 100);
  return `<span class="${p >= 0 ? 'money' : 'danger'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}%</span> <span class="muted">dibanding kemarin</span>`;
}

// =====================================================================
//  DASHBOARD
// =====================================================================
V.dashboard = async (page) => {
  const today = new Date();
  const from = ymd(addDays(today, -29));
  const [txs, products] = await Promise.all([db.list('transactions', { from, to: ymd(today), order: 'created' }), db.list('products')]);
  const byDay = {}; txs.forEach((t) => { const d = t.created.slice(0, 10); (byDay[d] = byDay[d] || []).push(t); });
  const T = sumTx(byDay[ymd(today)] || []), Y = sumTx(byDay[ymd(addDays(today, -1))] || []);
  const M = sumTx(txs.filter((t) => t.created.slice(0, 7) === ymd(today).slice(0, 7)));
  const days = [...Array(14)].map((_, i) => ymd(addDays(today, i - 13)));
  const vals = days.map((d) => sumTx(byDay[d] || []).omzet); const max = Math.max(1, ...vals);
  const prod = {}; txs.forEach((t) => (t.items || []).forEach((i) => { const p = (prod[i.name] = prod[i.name] || { qty: 0, omzet: 0 }); p.qty += i.qty; p.omzet += i.price * i.qty - (i.itemDiscount || 0); }));
  const top = Object.entries(prod).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8); const topMax = top.length ? top[0][1].qty : 1;
  const low = products.filter((p) => p.stock <= 3).sort((a, b) => a.stock - b.stock).slice(0, 10);
  const meth = { cash: 0, qris: 0, transfer: 0 }; txs.filter((t) => t.created.slice(0, 7) === ymd(today).slice(0, 7)).forEach((t) => { meth[t.payment_method] = (meth[t.payment_method] || 0) + t.total; });
  const stockValue = products.reduce((s, p) => s + p.cost * Math.max(0, p.stock), 0);
  page.innerHTML = head('Dashboard', 'Ringkasan penjualan ' + today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), '<a class="btn primary" href="#kasir">' + icon('kasir') + 'Buka kasir</a>') + `
    <div class="stats">
      ${stat('Omzet hari ini', rupiah(T.omzet), delta(T.omzet, Y.omzet).replace(/class="(money|danger|muted)"/g, 'style="color:#fff;opacity:.9"'), 'hero')}
      ${stat('Laba hari ini', rupiah(T.laba), delta(T.laba, Y.laba))}
      ${stat('Transaksi hari ini', fmtNum(T.n), `${fmtNum(T.items)} barang terjual`)}
      ${stat('Omzet bulan ini', rupiah(M.omzet), `Laba ${rupiah(M.laba)} · ${fmtNum(M.n)} transaksi`)}
      ${stat('Nilai stok (harga beli)', rupiah(stockValue), `${fmtNum(products.length)} jenis barang`)}
    </div>
    <div class="grid2" style="grid-template-columns:1.4fr 1fr">
      <div class="panel"><div class="panel-h"><h3>Omzet 14 hari terakhir</h3><span class="small muted">Tertinggi ${rupiah(max === 1 ? 0 : max)}</span></div><div class="panel-b"><div class="bars">${days.map((d, i) => `<div class="b" title="${fmtDate(d)}: ${rupiah(vals[i])}"><i class="${d === ymd(today) ? 'today' : ''}" style="height:${(vals[i] / max) * 100}%"></i><span>${+d.slice(8)}</span></div>`).join('')}</div></div></div>
      <div class="panel"><div class="panel-h"><h3>Barang terlaris (30 hari)</h3></div><div class="panel-b">${top.length ? top.map(([n, v]) => `<div class="hbar"><span class="t" title="${esc(n)}">${esc(n)}</span><span class="track"><i style="width:${(v.qty / topMax) * 100}%"></i></span><span class="n">${fmtNum(v.qty)} pcs</span></div>`).join('') : emptyState('Belum ada penjualan.')}</div></div>
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="panel"><div class="panel-h"><h3>Stok menipis</h3><a href="#produk" class="small bold">Kelola stok</a></div>${low.length ? table([{ label: 'Barang', key: 'name' }, { label: 'Kategori', key: 'category' }, { label: 'Stok', num: true, html: (p) => `<span class="chip ${p.stock <= 0 ? 'red' : 'amber'}">${p.stock}</span>` }], low) : '<div class="panel-b muted">Semua stok aman.</div>'}</div>
      <div class="panel"><div class="panel-h"><h3>Metode bayar bulan ini</h3></div><div class="panel-b">${Object.entries(meth).map(([k, v]) => `<div class="hbar"><span class="t">${PAY[k] || k}</span><span class="track"><i style="width:${M.omzet ? (v / M.omzet) * 100 : 0}%"></i></span><span class="n">${rupiah(v)}</span></div>`).join('')}</div></div>
    </div>`;
};

// =====================================================================
//  LAPORAN
// =====================================================================
V.laporan = async (page) => {
  const admin = App.isAdmin();
  const T = [['trx', 'Transaksi'], ['barang', 'Per barang'], ['member', 'Member']];
  if (admin) T.push(['absen', 'Absensi']);
  page.innerHTML = head('Laporan', admin ? 'Penjualan, laba, member, dan kehadiran pegawai.' : 'Riwayat penjualan toko.') + `<div class="row wrap" style="margin-bottom:14px;justify-content:space-between">${tabs(T, 'trx')}${periodPicker()}</div><div data-body></div>`;
  let tab = 'trx', range = [ymd(), ymd()], cache = null;
  const body = $('[data-body]', page);
  const load = async () => {
    body.innerHTML = '<div class="empty">Memuat…</div>';
    try {
      if (tab === 'absen') cache = await db.list('attendance', { from: range[0], to: range[1], order: 'created' });
      else cache = await db.list('transactions', { from: range[0], to: range[1] });
      draw();
    } catch (e) { body.innerHTML = `<div class="panel panel-b danger">${esc(e.message)}</div>`; }
  };
  const draw = () => ({ trx: drawTrx, barang: drawItems, member: drawMembers, absen: drawAbsen })[tab]();
  const label = () => (range[0] === range[1] ? fmtDate(range[0]) : `${fmtDate(range[0])} – ${fmtDate(range[1])}`);

  function drawTrx() {
    const cashiers = [...new Set(cache.map((t) => t.cashier).filter(Boolean))];
    const salesL = [...new Set(cache.map((t) => t.sales_name).filter(Boolean))];
    body.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari invoice, member, kasir…"></div>
      <select class="input" data-fc style="width:auto"><option value="">Semua kasir</option>${cashiers.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
      <select class="input" data-fm style="width:auto"><option value="">Semua metode</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      ${salesL.length ? `<select class="input" data-fs style="width:auto"><option value="">Semua sales</option>${salesL.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : ''}
      <button class="btn" data-csv>${icon('download')}CSV</button><button class="btn" data-xls>${icon('download')}Excel</button><button class="btn" data-xlsd>${icon('download')}Detail barang</button></div><div data-stats></div><div data-tbl></div>`;
    const filt = () => {
      const q = $('[data-q]', body).value.toLowerCase(), c = $('[data-fc]', body).value, mt = $('[data-fm]', body).value, sl = $('[data-fs]', body)?.value || '';
      return cache.filter((t) => (!c || t.cashier === c) && (!mt || t.payment_method === mt) && (!sl || t.sales_name === sl) && (!q || [t.invoice, t.member_name, t.cashier, t.sales_name, t.note].join(' ').toLowerCase().includes(q)));
    };
    const render = () => {
      const list = filt(), s = sumTx(list);
      $('[data-stats]', body).innerHTML = `<div class="stats">${stat('Pendapatan', rupiah(s.omzet), label(), 'hero')}${admin ? stat('Keuntungan', rupiah(s.laba), s.omzet ? `Margin ${Math.round((s.laba / s.omzet) * 100)}%` : '') : ''}${stat('Transaksi', fmtNum(s.n), `${fmtNum(s.items)} barang`)}${stat('Total diskon', rupiah(s.diskon))}${admin ? stat('Komisi sales', rupiah(s.komisi)) : ''}</div>`;
      $('[data-tbl]', body).innerHTML = table([
        { label: 'Waktu', html: (t) => `${fmtDate(t.created)}<div class="small muted">${fmtTime(t.created)}</div>` },
        { label: 'Invoice', html: (t) => `<b>${esc(t.invoice)}</b>${t.promo_name ? `<div class="small muted">${esc(t.promo_name)}</div>` : ''}` },
        { label: 'Kasir', key: 'cashier' }, { label: 'Member', get: (t) => t.member_name || '-' },
        { label: 'Metode', html: (t) => `<span class="chip ${t.payment_method === 'cash' ? '' : 'blue'}">${PAY[t.payment_method] || t.payment_method}</span>` },
        { label: 'Barang', num: true, get: (t) => t.item_count }, { label: 'Diskon', num: true, get: (t) => (t.discount ? rupiah(t.discount) : '-') },
        { label: 'Total', num: true, html: (t) => `<b>${rupiah(t.total)}</b>` },
        ...(admin ? [{ label: 'Laba', num: true, html: (t) => `<span class="${t.profit < 0 ? 'danger' : 'money'}">${rupiah(t.profit)}</span>` }] : []),
      ], list, { rowAttr: (t) => `data-tx="${t.id}" style="cursor:pointer"`, empty: 'Tidak ada transaksi pada periode ini.', emptyIcon: 'laporan', maxH: '62vh' });
    };
    ['[data-q]', '[data-fc]', '[data-fm]', '[data-fs]'].forEach((s) => { const x = $(s, body); if (x) x.oninput = render; });
    const cols = [{ label: 'Tanggal', get: (t) => t.created }, { label: 'Invoice', key: 'invoice' }, { label: 'Kasir', key: 'cashier' }, { label: 'Member', key: 'member_name' }, { label: 'Sales', key: 'sales_name' }, { label: 'Metode', get: (t) => PAY[t.payment_method] }, { label: 'Jumlah barang', key: 'item_count' }, { label: 'Subtotal', key: 'subtotal' }, { label: 'Diskon', key: 'discount' }, { label: 'Biaya', key: 'fee' }, { label: 'Total', key: 'total' }, ...(admin ? [{ label: 'Laba', key: 'profit' }, { label: 'Komisi', key: 'commission' }] : []), { label: 'Promo', key: 'promo_name' }, { label: 'Catatan', key: 'note' }];
    $('[data-csv]', body).onclick = () => downloadCSV(`transaksi_${range[0]}_${range[1]}.csv`, filt(), cols);
    $('[data-xls]', body).onclick = () => downloadXLS(`transaksi_${range[0]}_${range[1]}.xls`, filt(), cols, 'Laporan transaksi ' + label());
    $('[data-xlsd]', body).onclick = () => {
      const rows = []; filt().forEach((t) => (t.items || []).forEach((i) => rows.push({ t, i })));
      downloadXLS(`detail_barang_${range[0]}_${range[1]}.xls`, rows, [{ label: 'Tanggal', get: (r) => r.t.created }, { label: 'Invoice', get: (r) => r.t.invoice }, { label: 'Kasir', get: (r) => r.t.cashier }, { label: 'Nama barang', get: (r) => r.i.name }, { label: 'Kategori', get: (r) => r.i.category || '' }, { label: 'Qty', get: (r) => r.i.qty }, { label: 'Harga jual', get: (r) => r.i.price }, ...(admin ? [{ label: 'Harga beli', get: (r) => r.i.cost }] : []), { label: 'Diskon', get: (r) => r.i.itemDiscount || 0 }, { label: 'Harga bersih', get: (r) => r.i.price * r.i.qty - (r.i.itemDiscount || 0) }, { label: 'Metode', get: (r) => PAY[r.t.payment_method] }], 'Detail barang terjual ' + label());
    };
    $('[data-tbl]', body).onclick = (e) => { const r = e.target.closest('[data-tx]'); if (r) txDetail(cache.find((t) => t.id === +r.dataset.tx)); };
    render();
  }
  async function txDetail(t) {
    if (t.shipping === undefined) { try { const sh = await db.list('shipments', { where: { transaction_id: t.id }, limit: 1 }); t.shipping = sh[0] || null; } catch (e) { t.shipping = null; } }
    const m = modal({ title: 'Detail transaksi', size: 'wide', body: `<div class="grid2" style="align-items:start"><div class="receipt-preview">${receiptHTML(t, App.settings)}</div><div class="stack">
      <div class="panel panel-b small"><div class="row"><span class="grow muted">Laba</span><b class="${t.profit < 0 ? 'danger' : 'money'}">${admin ? rupiah(t.profit) : '—'}</b></div><div class="row"><span class="grow muted">Komisi sales</span><b>${rupiah(t.commission)}</b></div><div class="row"><span class="grow muted">Poin didapat / dipakai</span><b>${t.points_earned} / ${t.points_used}</b></div></div>
      ${admin ? `<div class="panel panel-b"><h3>Batalkan transaksi</h3><p class="small muted">Transaksi dihapus dari laporan. Poin member dikembalikan.</p><label class="check"><input type="checkbox" data-restore checked> Kembalikan stok barang</label>${field('Alasan pembatalan', 'reason', '', { placeholder: 'Salah input, retur, dll.' })}<button class="btn danger" data-cancel style="margin-top:10px">Batalkan transaksi</button></div>` : ''}</div></div>`,
      foot: `<button class="btn" data-print>${icon('printer')}Cetak ulang</button>${Printer.supported ? `<button class="btn" data-bt>Printer Bluetooth</button>` : ''}` });
    m.$('[data-print]').onclick = () => printHTML(receiptHTML(t, App.settings));
    const bt = m.$('[data-bt]'); if (bt) bt.onclick = async () => { try { await Printer.print(escposReceipt(t, App.settings)); toast('Struk dikirim', '', 'ok'); } catch (e) { toastErr(e); } };
    const c = m.$('[data-cancel]');
    if (c) c.onclick = async () => {
      if (!(await confirmBox('Batalkan ' + t.invoice + '?', 'Tindakan ini tidak dapat diurungkan.', 'Ya, batalkan'))) return;
      try { await api('tx_delete', { id: t.id, restore_stock: m.$('[data-restore]').checked, reason: m.$('[name=reason]').value }); toast('Transaksi dibatalkan', t.invoice, 'ok'); m.close(); load(); } catch (e) { toastErr(e); }
    };
  }
  function drawItems() {
    const agg = {};
    cache.forEach((t) => (t.items || []).forEach((i) => { const a = (agg[i.id + '|' + i.name] = agg[i.id + '|' + i.name] || { name: i.name, category: i.category || '', qty: 0, omzet: 0, laba: 0, disc: 0 }); a.qty += i.qty; const net = i.price * i.qty - (i.itemDiscount || 0); a.omzet += net; a.disc += i.itemDiscount || 0; a.laba += net - i.cost * i.qty; }));
    const rows = Object.values(agg).sort((a, b) => b.qty - a.qty);
    const cat = {}; rows.forEach((r) => { cat[r.category || 'Tanpa kategori'] = (cat[r.category || 'Tanpa kategori'] || 0) + r.qty; });
    const cmax = Math.max(1, ...Object.values(cat));
    const cols = [{ label: 'Barang', key: 'name' }, { label: 'Kategori', key: 'category' }, { label: 'Terjual', num: true, get: (r) => fmtNum(r.qty) }, { label: 'Diskon', num: true, get: (r) => rupiah(r.disc) }, { label: 'Penjualan bersih', num: true, get: (r) => rupiah(r.omzet) }, ...(admin ? [{ label: 'Laba', num: true, html: (r) => `<span class="${r.laba < 0 ? 'danger' : 'money'}">${rupiah(r.laba)}</span>` }] : [])];
    body.innerHTML = `<div class="grid2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div><div class="toolbar"><span class="grow muted">${rows.length} jenis barang terjual · ${label()}</span><button class="btn" data-xls>${icon('download')}Excel</button></div>${table(cols, rows, { empty: 'Belum ada barang terjual.', maxH: '64vh', foot: ['Total', '', fmtNum(rows.reduce((s, r) => s + r.qty, 0)), rupiah(rows.reduce((s, r) => s + r.disc, 0)), rupiah(rows.reduce((s, r) => s + r.omzet, 0)), ...(admin ? [rupiah(rows.reduce((s, r) => s + r.laba, 0))] : [])] })}</div>
      <div class="panel"><div class="panel-h"><h3>Unit terjual per kategori</h3></div><div class="panel-b">${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span class="t">${esc(k)}</span><span class="track"><i style="width:${(v / cmax) * 100}%"></i></span><span class="n">${fmtNum(v)} pcs</span></div>`).join('') || '<p class="muted">—</p>'}</div></div></div>`;
    $('[data-xls]', body).onclick = () => downloadXLS(`penjualan_barang_${range[0]}_${range[1]}.xls`, rows, [{ label: 'Barang', key: 'name' }, { label: 'Kategori', key: 'category' }, { label: 'Qty', key: 'qty' }, { label: 'Diskon', key: 'disc' }, { label: 'Penjualan bersih', key: 'omzet' }, ...(admin ? [{ label: 'Laba', key: 'laba' }] : [])], 'Penjualan per barang ' + label());
  }
  async function drawMembers() {
    const members = await db.list('members');
    const agg = {};
    cache.filter((t) => t.member_id).forEach((t) => { const a = (agg[t.member_id] = agg[t.member_id] || { id: t.member_id, name: t.member_name, n: 0, total: 0, last: '' }); a.n++; a.total += t.total; if (t.created > a.last) a.last = t.created; });
    const rows = Object.values(agg).sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1, m: members.find((x) => x.id === r.id) }));
    const memberTx = cache.filter((t) => t.member_id), s = sumTx(memberTx), all = sumTx(cache);
    body.innerHTML = `<div class="stats">${stat('Member berbelanja', fmtNum(rows.length), label(), 'hero')}${stat('Belanja member', rupiah(s.omzet), all.omzet ? Math.round((s.omzet / all.omzet) * 100) + '% dari total omzet' : '')}${stat('Transaksi member', fmtNum(s.n), all.n ? Math.round((s.n / all.n) * 100) + '% dari semua transaksi' : '')}${stat('Total member terdaftar', fmtNum(members.length))}</div>
      ${admin ? '<p class="small muted" style="margin:0 0 10px">Beri voucher belanja (Rupiah) untuk member terbaik — otomatis terpotong satu kali saat member dipilih di kasir.</p>' : ''}
      ${table([{ label: 'Peringkat', html: (r) => (r.rank <= 3 ? `<span class="chip gold">${icon('star')} ${r.rank}</span>` : r.rank) }, { label: 'Member', html: (r) => `<b>${esc(r.name)}</b><div class="small muted">${esc(r.m?.phone || '')}</div>` }, { label: 'Transaksi', num: true, get: (r) => r.n }, { label: 'Total belanja', num: true, html: (r) => `<b>${rupiah(r.total)}</b>` }, { label: 'Terakhir', get: (r) => fmtDate(r.last) }, { label: 'Poin', num: true, get: (r) => fmtNum(r.m?.points || 0) },
        ...(admin ? [{ label: 'Voucher', html: (r) => (r.m ? (r.m.voucher_amount > 0 ? `<span class="chip ${r.m.voucher_used ? '' : 'green'}">${rupiah(r.m.voucher_amount)}${r.m.voucher_used ? ' · terpakai' : ''}</span> ` : '') + `<button class="btn sm" data-v="${r.id}">Atur</button>` : '-') }] : [])], rows, { empty: 'Belum ada member yang berbelanja pada periode ini.', emptyIcon: 'member' })}`;
    $$('[data-v]', body).forEach((b) => (b.onclick = () => {
      const mem = members.find((x) => x.id === +b.dataset.v);
      crudModal({ title: 'Voucher untuk ' + mem.name, fields: field('Nominal voucher (Rp)', 'voucher_amount', mem.voucher_amount || '', { numeric: true, hint: 'Isi 0 untuk menghapus voucher. Voucher baru otomatis berstatus belum dipakai.' }), onSave: async (v) => { await db.update('members', mem.id, { voucher_amount: v.voucher_amount, voucher_used: false }); toast('Voucher disimpan', mem.name, 'ok'); drawMembers(); } });
    }));
  }
  async function drawAbsen() {
    const users = (await api('users_list')).filter((u) => u.active);
    const days = []; for (let d = new Date(range[0]); ymd(d) <= range[1]; d = addDays(d, 1)) days.push(ymd(d));
    const rows = [];
    days.forEach((d) => users.forEach((u) => {
      const recs = cache.filter((a) => a.user_id === u.id && a.created.slice(0, 10) === d);
      const i = recs.find((a) => a.type === 'in'), o = recs.find((a) => a.type === 'out');
      if (!i && !o && d > ymd()) return;
      rows.push({ d, u, i, o });
    }));
    const sum = users.map((u) => { const r = rows.filter((x) => x.u.id === u.id); return { u, hadir: r.filter((x) => x.i).length, telat: r.filter((x) => x.i && x.i.is_late).length, menit: r.reduce((s, x) => s + (x.i?.late_minutes || 0), 0), absen: r.filter((x) => !x.i && x.d < ymd()).length }; });
    const dur = (i, o) => { if (!i || !o) return '-'; const m = Math.round((parseDT(o.created) - parseDT(i.created)) / 60000); return `${Math.floor(m / 60)}j ${m % 60}m`; };
    const loc = (a) => (a && a.lat ? `<a href="https://maps.google.com/?q=${a.lat},${a.lng}" target="_blank" rel="noopener">${icon('pin')} peta</a>` : '');
    body.innerHTML = `<div class="panel" style="margin-bottom:14px"><div class="panel-h"><h3>Rekap kehadiran · ${label()}</h3><button class="btn sm" data-xls>${icon('download')}Excel</button></div>${table([{ label: 'Pegawai', html: (s) => `<b>${esc(s.u.name)}</b>` }, { label: 'Hari hadir', num: true, get: (s) => s.hadir }, { label: 'Terlambat', num: true, html: (s) => (s.telat ? `<span class="chip amber">${s.telat}× · ${s.menit} menit</span>` : '0') }, { label: 'Tidak masuk', num: true, get: (s) => s.absen }], sum)}</div>
      ${table([{ label: 'Tanggal', get: (r) => fmtDate(r.d) }, { label: 'Pegawai', get: (r) => r.u.name }, { label: 'Masuk', html: (r) => (r.i ? `${fmtTime(r.i.created)} ${loc(r.i)}` : '-') }, { label: 'Pulang', html: (r) => (r.o ? `${fmtTime(r.o.created)} ${loc(r.o)}` : '-') }, { label: 'Durasi', get: (r) => dur(r.i, r.o) }, { label: 'Status', html: (r) => (!r.i ? (r.d < ymd() ? '<span class="chip red">Tidak masuk</span>' : '<span class="chip">Belum absen</span>') : r.i.is_late ? `<span class="chip amber">Terlambat ${r.i.late_minutes}m</span>` : '<span class="chip green">Tepat waktu</span>') }], rows.reverse(), { empty: 'Belum ada data absensi.', maxH: '55vh' })}`;
    $('[data-xls]', body).onclick = () => downloadXLS(`absensi_${range[0]}_${range[1]}.xls`, rows, [{ label: 'Tanggal', get: (r) => r.d }, { label: 'Pegawai', get: (r) => r.u.name }, { label: 'Masuk', get: (r) => (r.i ? fmtTime(r.i.created) : '') }, { label: 'Pulang', get: (r) => (r.o ? fmtTime(r.o.created) : '') }, { label: 'Durasi', get: (r) => dur(r.i, r.o) }, { label: 'Terlambat (menit)', get: (r) => r.i?.late_minutes || 0 }]);
  }
  bindTabs(page, (t) => { tab = t; load(); });
  bindPeriod(page, (f, t) => { range = [f, t]; load(); }).set('today');
};

// =====================================================================
//  PRODUK & STOK
// =====================================================================
V.produk = async (page) => {
  page.innerHTML = head('Produk & stok', 'Kelola barang, harga, stok masuk/keluar, label barcode, dan hasil cek stok.') + `<div style="margin-bottom:14px">${tabs([['list', 'Daftar barang'], ['moves', 'Riwayat stok'], ['checks', 'Pengajuan cek stok' + (App.pendingChecks ? ` (${App.pendingChecks})` : '')]], 'list')}</div><div data-body></div>`;
  const body = $('[data-body]', page);
  let products = [], sel = new Set();
  const cats = () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const pform = (p = {}) => `<div class="grid2">${field('Nama barang', 'name', p.name)}${field('Barcode / kode', 'barcode', p.barcode, { hint: 'Kosongkan bila belum punya.' })}${field('Kategori', 'category', p.category, { attrs: 'list="pcats"' })}${field('Stok', 'stock', p.stock ?? '', { numeric: true, hint: p.id ? 'Perubahan stok tercatat di riwayat.' : '' })}${field('Harga beli (modal)', 'cost', p.cost ?? '', { numeric: true })}${field('Harga jual', 'price', p.price ?? '', { numeric: true })}${field('Harga khusus: potongan / pcs', 'discount', p.discount ?? '', { numeric: true, hint: 'Potongan otomatis di kasir. 0 = tidak ada.' })}${field('Komisi sales / pcs', 'commission', p.commission ?? '', { numeric: true })}</div><datalist id="pcats">${cats().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;

  async function drawList() {
    products = await db.list('products');
    body.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari nama, barcode, kategori…"></div>
      <select class="input" data-cat style="width:auto"><option value="">Semua kategori</option>${cats().map((c) => `<option>${esc(c)}</option>`).join('')}</select>
      <select class="input" data-stk style="width:auto"><option value="">Semua stok</option><option value="low">Stok ≤ 3</option><option value="out">Habis</option></select>
      <button class="btn primary" data-new>${icon('plus')}Barang baru</button>
      <button class="btn" data-imp>${icon('upload')}Impor</button><button class="btn" data-exp>${icon('download')}Ekspor</button>
      <button class="btn hidden" data-lbl>${icon('barcode')}Cetak label (<span data-n>0</span>)</button></div>
      <div data-stats></div><div data-tbl></div>`;
    const filt = () => { const q = $('[data-q]', body).value.toLowerCase(), c = $('[data-cat]', body).value, s = $('[data-stk]', body).value; return products.filter((p) => (!c || p.category === c) && (!s || (s === 'low' ? p.stock <= 3 && p.stock > 0 : p.stock <= 0)) && (!q || [p.name, p.barcode, p.category].join(' ').toLowerCase().includes(q))); };
    const render = () => {
      const list = filt();
      const val = list.reduce((s, p) => s + p.cost * Math.max(0, p.stock), 0), units = list.reduce((s, p) => s + Math.max(0, p.stock), 0);
      $('[data-stats]', body).innerHTML = `<div class="stats">${stat('Jenis barang', fmtNum(list.length))}${stat('Total stok', fmtNum(units) + ' pcs')}${stat('Nilai stok (modal)', rupiah(val))}${stat('Stok habis', fmtNum(list.filter((p) => p.stock <= 0).length))}</div>`;
      $('[data-tbl]', body).innerHTML = table([
        { label: '', html: (p) => `<input type="checkbox" data-sel="${p.id}" ${sel.has(p.id) ? 'checked' : ''} aria-label="Pilih">` },
        { label: 'Barang', html: (p) => `<b>${esc(p.name)}</b><div class="small muted">${esc(p.barcode || 'tanpa barcode')}</div>` }, { label: 'Kategori', key: 'category' },
        { label: 'Modal', num: true, get: (p) => rupiah(p.cost) }, { label: 'Harga jual', num: true, html: (p) => (p.discount > 0 ? `<s class="muted small">${rupiah(p.price)}</s> <b>${rupiah(p.price - p.discount)}</b>` : `<b>${rupiah(p.price)}</b>`) },
        { label: 'Margin', num: true, html: (p) => { const mg = p.price - p.discount - p.cost; return `<span class="${mg < 0 ? 'danger' : 'money'}">${rupiah(mg)}</span>`; } },
        { label: 'Stok', num: true, html: (p) => `<span class="chip ${p.stock <= 0 ? 'red' : p.stock <= 3 ? 'amber' : 'green'}">${p.stock}</span>` },
        { label: '', cls: 'nowrap right', html: (p) => `<button class="btn sm" data-in="${p.id}" title="Stok masuk">+ Stok</button> <button class="btn sm" data-out="${p.id}" title="Stok keluar">− Stok</button> <button class="btn sm icon" data-edit="${p.id}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-del="${p.id}" aria-label="Hapus">${icon('trash')}</button>` },
      ], list, { empty: 'Belum ada barang. Klik "Barang baru" atau impor dari Excel.', maxH: '60vh' });
      $('[data-n]', body).textContent = sel.size; $('[data-lbl]', body).classList.toggle('hidden', !sel.size);
    };
    ['[data-q]', '[data-cat]', '[data-stk]'].forEach((s) => ($(s, body).oninput = render));
    $('[data-new]', body).onclick = () => crudModal({ title: 'Barang baru', size: 'wide', fields: pform(), onSave: async (v) => { await db.create('products', v); toast('Barang ditambahkan', v.name, 'ok'); drawList(); } });
    $('[data-exp]', body).onclick = () => downloadXLS('produk_' + ymd() + '.xls', filt(), [{ label: 'Nama Produk', key: 'name' }, { label: 'Barcode / Kode', key: 'barcode' }, { label: 'Kategori', key: 'category' }, { label: 'Harga Beli', key: 'cost' }, { label: 'Harga Jual', key: 'price' }, { label: 'Diskon / pcs', key: 'discount' }, { label: 'Stok', key: 'stock' }, { label: 'Komisi Sales / pcs', key: 'commission' }]);
    $('[data-imp]', body).onclick = importModal;
    $('[data-lbl]', body).onclick = () => labelModal(products.filter((p) => sel.has(p.id)));
    $('[data-tbl]', body).onclick = async (e) => {
      const t = e.target; const g = (k) => t.closest(`[data-${k}]`)?.dataset[k];
      if (t.dataset.sel) { t.checked ? sel.add(+t.dataset.sel) : sel.delete(+t.dataset.sel); $('[data-n]', body).textContent = sel.size; $('[data-lbl]', body).classList.toggle('hidden', !sel.size); return; }
      const id = +(g('edit') || g('del') || g('in') || g('out') || 0); if (!id) return;
      const p = products.find((x) => x.id === id);
      if (g('edit')) crudModal({ title: 'Ubah barang', size: 'wide', fields: pform(p), onSave: async (v) => { await db.update('products', p.id, v); toast('Barang disimpan', v.name, 'ok'); drawList(); } });
      if (g('del') && await confirmBox('Hapus ' + p.name + '?', 'Barang dihapus dari daftar. Riwayat transaksi lama tetap tersimpan.', 'Hapus barang')) { try { await db.remove('products', p.id); toast('Barang dihapus', '', 'ok'); drawList(); } catch (ex) { toastErr(ex); } }
      if (g('in') || g('out')) {
        const type = g('in') ? 'in' : 'out';
        crudModal({ title: (type === 'in' ? 'Stok masuk: ' : 'Stok keluar: ') + p.name, fields: `<p class="muted" style="margin:0">Stok sekarang: <b>${p.stock}</b></p>${field('Jumlah (pcs)', 'qty', '', { numeric: true })}${field('Keterangan', 'note', '', { placeholder: type === 'in' ? 'Kiriman supplier, retur pelanggan…' : 'Rusak, hilang, retur ke supplier…' })}`, onSave: async (v) => { const r = await api('stock_adjust', { product_id: p.id, type, qty: v.qty, note: v.note }); toast('Stok diperbarui', `${p.name}: ${p.stock} → ${r.stock}`, 'ok'); drawList(); } });
      }
    };
    render();
  }
  function importModal() { importDialog(['products', 'discount'], drawList); }
  function labelModal(list) {
    const m = modal({ title: 'Cetak label barcode', size: 'wide', body: `<p class="muted" style="margin-top:0">${list.length} barang. Atur jumlah label per barang.</p>${table([{ label: 'Barang', key: 'name' }, { label: 'Barcode', get: (p) => p.barcode || '— (tanpa barcode)' }, { label: 'Jumlah label', html: (p) => `<input class="input" style="width:80px" data-lq="${p.id}" value="${Math.max(1, p.stock)}" inputmode="numeric">` }], list, { maxH: '300px' })}`, foot: `<button class="btn" data-print>${icon('printer')}Cetak ke printer biasa / PDF</button>${Printer.supported ? '<button class="btn primary" data-bt>Printer label Bluetooth</button>' : ''}` });
    const expand = () => list.flatMap((p) => Array(Math.min(500, num(m.$(`[data-lq="${p.id}"]`).value))).fill(p));
    m.$('[data-print]').onclick = () => printHTML(labelsHTML(expand()));
    const bt = m.$('[data-bt]'); if (bt) bt.onclick = async () => { try { for (const p of expand()) await Printer.print(escposLabel(p)); toast('Label dikirim', '', 'ok'); } catch (e) { toastErr(e); } };
  }
  async function drawMoves() {
    body.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari barang, invoice, keterangan…"></div>${periodPicker('m')}<button class="btn" data-xls>${icon('download')}Excel</button></div><div data-tbl></div>`;
    let list = [];
    const render = () => { const q = $('[data-q]', body).value.toLowerCase(); const l = list.filter((x) => !q || [x.product_name, x.barcode, x.invoice, x.note, x.cashier].join(' ').toLowerCase().includes(q)); $('[data-tbl]', body).innerHTML = table([{ label: 'Waktu', get: (x) => fmtDT(x.created) }, { label: 'Barang', html: (x) => `<b>${esc(x.product_name)}</b><div class="small muted">${esc(x.barcode)}</div>` }, { label: 'Jenis', html: (x) => `<span class="chip ${x.type === 'in' ? 'green' : 'red'}">${x.type === 'in' ? 'Masuk' : 'Keluar'}</span>` }, { label: 'Jumlah', num: true, html: (x) => `<b>${x.type === 'in' ? '+' : '−'}${x.quantity}</b>` }, { label: 'Stok', num: true, get: (x) => `${x.stock_before} → ${x.stock_after}` }, { label: 'Keterangan', html: (x) => `${esc(x.note)}${x.invoice ? `<div class="small muted">${esc(x.invoice)}</div>` : ''}` }, { label: 'Oleh', key: 'cashier' }], l, { empty: 'Tidak ada pergerakan stok.', maxH: '62vh' }); $('[data-xls]', body).onclick = () => downloadXLS('riwayat_stok.xls', l, [{ label: 'Waktu', key: 'created' }, { label: 'Barang', key: 'product_name' }, { label: 'Barcode', key: 'barcode' }, { label: 'Jenis', get: (x) => (x.type === 'in' ? 'Masuk' : 'Keluar') }, { label: 'Jumlah', key: 'quantity' }, { label: 'Stok sebelum', key: 'stock_before' }, { label: 'Stok sesudah', key: 'stock_after' }, { label: 'Keterangan', key: 'note' }, { label: 'Invoice', key: 'invoice' }, { label: 'Oleh', key: 'cashier' }]); };
    $('[data-q]', body).oninput = render;
    bindPeriod(body, async (f, t) => { list = await db.list('stock_movements', { from: f, to: t }); render(); }).set('7');
  }
  async function drawChecks() {
    const list = await db.list('stock_checks', { limit: 200 });
    const pend = list.filter((s) => s.status === 'pending'), done = list.filter((s) => s.status !== 'pending').slice(0, 40);
    body.innerHTML = `<div class="stack">${pend.length ? pend.map((s) => `<div class="panel"><div class="panel-h"><div><h3>Pengajuan dari ${esc(s.petugas_name)}</h3><span class="small muted">${fmtDT(s.created)} · ${s.items.length} barang berbeda${s.note ? ' · ' + esc(s.note) : ''}</span></div><div class="row"><button class="btn danger" data-rej="${s.id}">Tolak</button><button class="btn primary" data-ok="${s.id}">Setujui & perbarui data</button></div></div>${table([{ label: 'Barang', html: (i) => `<b>${esc(i.name)}</b><div class="small muted">${esc(i.barcode)}</div>` }, { label: 'Stok sistem', num: true, key: 'sys_stock' }, { label: 'Stok fisik', num: true, html: (i) => `<b class="${i.actual_stock !== i.sys_stock ? 'danger' : ''}">${i.actual_stock}</b>` }, { label: 'Harga sistem', num: true, get: (i) => rupiah(i.sys_price) }, { label: 'Harga di label', num: true, html: (i) => `<b class="${i.actual_price !== i.sys_price ? 'danger' : ''}">${rupiah(i.actual_price)}</b>` }], s.items)}</div>`).join('') : `<div class="panel panel-b muted">Tidak ada pengajuan cek stok yang menunggu. Petugas mengirim hasil cek dari halaman <a href="cek-stok.html">Cek stok</a>.</div>`}
      <h3 style="margin-top:8px">Riwayat</h3>${table([{ label: 'Waktu', get: (s) => fmtDT(s.created) }, { label: 'Petugas', key: 'petugas_name' }, { label: 'Barang', num: true, get: (s) => s.items.length }, { label: 'Status', html: (s) => `<span class="chip ${s.status === 'approved' ? 'green' : 'red'}">${s.status === 'approved' ? 'Disetujui' : 'Ditolak'}</span>` }, { label: 'Diperiksa', get: (s) => s.reviewed_name }, { label: 'Catatan', key: 'note' }], done, { empty: 'Belum ada riwayat.' })}</div>`;
    body.onclick = async (e) => {
      const ok = e.target.closest('[data-ok]'), rj = e.target.closest('[data-rej]'); if (!ok && !rj) return;
      const id = +(ok || rj).dataset[ok ? 'ok' : 'rej'];
      if (ok && !(await confirmBox('Setujui pengajuan?', 'Stok dan harga barang akan diperbarui sesuai hasil cek fisik.', 'Setujui', false))) return;
      try { await api('stockcheck_review', { id, approve: !!ok }); toast(ok ? 'Pengajuan disetujui' : 'Pengajuan ditolak', '', 'ok'); App.pendingChecks = Math.max(0, App.pendingChecks - 1); App.updateBadges(); drawChecks(); } catch (ex) { toastErr(ex); }
    };
  }
  bindTabs(page, (t) => { body.onclick = null; ({ list: drawList, moves: drawMoves, checks: drawChecks })[t](); });
  await drawList();
};

// =====================================================================
//  PROMO
// =====================================================================
V.promo = async (page) => {
  const [promos, products] = await Promise.all([db.list('promos'), db.list('products')]);
  const cats = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const status = (p) => (!p.active ? ['Nonaktif', ''] : !Promo.activeToday(p) ? (p.start_date && p.start_date > ymd() ? ['Terjadwal', 'blue'] : ['Berakhir', 'red']) : ['Aktif', 'green']);
  const rank = (p) => { const [l] = status(p); return { Aktif: 0, Terjadwal: 1, Nonaktif: 2, Berakhir: 3 }[l]; };
  const sorted = [...promos].sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
  const period = (p) => (p.start_date || p.end_date ? `${p.start_date ? fmtDate(p.start_date) : 'Sekarang'} – ${p.end_date ? fmtDate(p.end_date) : 'seterusnya'}` : 'Tanpa batas waktu');
  page.innerHTML = head('Promo', 'Promo otomatis langsung terpotong di kasir. Promo berkode dipakai saat kasir memasukkan kodenya.', `<button class="btn primary" data-new>${icon('plus')}Promo baru</button>`) +
    `<div class="stats">${stat('Promo aktif hari ini', fmtNum(promos.filter((p) => status(p)[0] === 'Aktif').length), '', 'hero')}${stat('Otomatis', fmtNum(promos.filter((p) => p.active && !p.code).length))}${stat('Pakai kode', fmtNum(promos.filter((p) => p.active && p.code).length))}${stat('Nonaktif / berakhir', fmtNum(promos.filter((p) => ['Nonaktif', 'Berakhir'].includes(status(p)[0])).length))}</div>` +
    (sorted.length ? `<div class="promo-grid">${sorted.map((p) => { const [l, c] = status(p); return `
      <article class="promo-card ${l === 'Aktif' ? 'live' : ''} ${l === 'Nonaktif' || l === 'Berakhir' ? 'off' : ''}">
        <div class="row"><span class="chip ${c}">${l}</span>${p.badge_text ? `<span class="chip" style="background:${BADGE_COLORS[p.badge_color] || '#7C3AED'};color:#fff">${esc(p.badge_text)}</span>` : ''}<span class="grow"></span>
          <label class="switch" title="${p.active ? 'Matikan' : 'Aktifkan'}"><input type="checkbox" data-tog="${p.id}" ${p.active ? 'checked' : ''}><span></span></label></div>
        <h3>${esc(p.name)}</h3>
        <div class="promo-val">${esc(Promo.describe(p))}</div>
        <div class="promo-meta">${p.code ? `<span class="pc-code">${esc(p.code)}</span>` : '<span class="muted small">Berlaku otomatis</span>'}${p.min_purchase ? `<span class="small muted">Min. belanja ${rupiah(p.min_purchase)}</span>` : ''}</div>
        <div class="promo-foot"><span class="small muted">${icon('clock')} ${esc(period(p))}</span><span class="grow"></span><button class="btn sm icon ghost" data-edit="${p.id}" aria-label="Ubah">${icon('edit')}</button><button class="btn sm icon ghost danger" data-del="${p.id}" aria-label="Hapus">${icon('trash')}</button></div>
      </article>`; }).join('')}</div>` : `<div class="panel">${emptyState('Belum ada promo. Buat promo pertama, misalnya "Beli 2 gratis 1 kemeja".', 'promo')}</div>`);

  function form(p = { type: 'percent', active: true, buy_qty: 2, free_qty: 1, categories: [], product_ids: [], free_product_ids: [] }) {
    const m = modal({ title: p.id ? 'Ubah promo' : 'Promo baru', size: 'wide', body: `<div class="stack" data-f>
      <div class="grid2">${field('Nama promo', 'name', p.name, { placeholder: 'Beli 2 gratis 1 kemeja' })}<label class="f">Jenis promo<select class="input" name="type">${Object.entries(Promo.TYPE_LABEL).map(([k, l]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="grid3" data-valbox>${field('Nilai', 'value', p.value ?? '', { numeric: true, hint: '' })}<div data-pkg class="grid2" style="grid-column:span 2">${field('Beli (pcs)', 'buy_qty', p.buy_qty ?? 2, { numeric: true })}${field('Gratis (pcs)', 'free_qty', p.free_qty ?? 1, { numeric: true })}</div></div>
      <div class="grid3">${field('Minimal belanja (Rp)', 'min_purchase', p.min_purchase || '', { numeric: true })}${field('Harga barang minimal', 'min_price', p.min_price || '', { numeric: true, hint: '0 = tanpa batas' })}${field('Harga barang maksimal', 'max_price', p.max_price || '', { numeric: true, hint: '0 = tanpa batas' })}</div>
      <div><div class="f" style="font-size:12.5px;font-weight:600;color:var(--ink-2);margin-bottom:6px">Berlaku untuk kategori <span class="muted" style="font-weight:400">(kosongkan = semua)</span></div><div class="row wrap">${cats.map((c) => `<label class="check chip" style="height:30px"><input type="checkbox" data-cat value="${esc(c)}" ${(p.categories || []).includes(c) ? 'checked' : ''}>${esc(c)}</label>`).join('') || '<span class="muted small">Belum ada kategori barang.</span>'}</div></div>
      <div><div class="row"><b class="grow small">Barang tertentu <span class="muted" style="font-weight:400">(opsional)</span></b><span class="small muted" data-pcount></span></div><input class="input" data-psearch placeholder="Cari barang…" style="margin:6px 0"><div class="pick" data-plist style="max-height:170px"></div></div>
      <div data-freebox class="panel panel-b" style="background:#FAFBFD"><b class="small">Hadiah (khusus promo paket)</b><p class="small muted" style="margin:2px 0 8px">Kosongkan bila barang gratis diambil dari barang yang dibeli (yang termurah).</p>
        <label class="f">Kategori hadiah<select class="input" name="free_category"><option value="">— Tidak ada —</option>${cats.map((c) => `<option ${p.free_category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <div class="row" style="margin-top:8px"><b class="grow small">atau barang hadiah tertentu</b><span class="small muted" data-fcount></span></div><input class="input" data-fsearch placeholder="Cari barang hadiah…" style="margin:6px 0"><div class="pick" data-flist style="max-height:150px"></div></div>
      <div class="grid3">${field('Kode promo', 'code', p.code, { placeholder: 'Kosong = otomatis', attrs: 'style="text-transform:uppercase"' })}${field('Mulai', 'start_date', p.start_date || '', { type: 'date' })}${field('Berakhir', 'end_date', p.end_date || '', { type: 'date' })}</div>
      <div class="grid2">${field('Teks lencana di kartu barang', 'badge_text', p.badge_text, { placeholder: 'SALE, B2G1…', attrs: 'maxlength="12"' })}<label class="f">Warna lencana<select class="input" name="badge_color">${Object.keys(BADGE_COLORS).map((c) => `<option ${p.badge_color === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
      <div class="row wrap" style="gap:18px"><label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Aktif</label><label class="check"><input type="checkbox" name="stackable" ${p.stackable ? 'checked' : ''}> Bisa digabung dengan kode promo lain</label></div>
    </div>`, foot: '<button class="btn" data-cancel>Batal</button><button class="btn primary" data-save>Simpan promo</button>' });
    const pick = { p: new Set((p.product_ids || []).map(Number)), f: new Set((p.free_product_ids || []).map(Number)) };
    const drawPick = (k) => {
      const q = m.$(k === 'p' ? '[data-psearch]' : '[data-fsearch]').value.toLowerCase();
      const list = products.filter((x) => pick[k].has(x.id) || !q || x.name.toLowerCase().includes(q) || (x.barcode || '').includes(q)).slice(0, 60);
      m.$(k === 'p' ? '[data-plist]' : '[data-flist]').innerHTML = list.map((x) => `<label style="display:flex;gap:10px;padding:8px 12px;border-bottom:1px solid var(--line-2);cursor:pointer"><input type="checkbox" data-pk="${k}" value="${x.id}" ${pick[k].has(x.id) ? 'checked' : ''}><span class="grow">${esc(x.name)}</span><span class="small muted">${rupiah(x.price)}</span></label>`).join('') || '<div class="empty">Tidak ada barang.</div>';
      m.$(k === 'p' ? '[data-pcount]' : '[data-fcount]').textContent = pick[k].size ? pick[k].size + ' dipilih' : '';
    };
    ['p', 'f'].forEach((k) => { drawPick(k); m.$(k === 'p' ? '[data-psearch]' : '[data-fsearch]').oninput = () => drawPick(k); });
    m.el.addEventListener('change', (e) => { const k = e.target.dataset.pk; if (k) { e.target.checked ? pick[k].add(+e.target.value) : pick[k].delete(+e.target.value); m.$(k === 'p' ? '[data-pcount]' : '[data-fcount]').textContent = pick[k].size ? pick[k].size + ' dipilih' : ''; } });
    const typeSel = m.$('[name=type]');
    const onType = () => {
      const t = typeSel.value, pkg = t === 'package';
      m.$('[data-pkg]').classList.toggle('hidden', !pkg);
      m.$('[name=value]').closest('label').classList.toggle('hidden', t === 'package' || t === 'bogo');
      m.$('[data-freebox]').classList.toggle('hidden', !(t === 'package' || t === 'bogo'));
      m.$('[name=value]').closest('label').querySelector('.hint')?.remove();
      const hints = { percent: 'Persen diskon, mis. 10', fixed: 'Potongan Rupiah per pcs', price: 'Harga akhir per pcs, mis. 99000' };
      if (hints[t]) m.$('[name=value]').insertAdjacentHTML('afterend', `<span class="hint">${hints[t]}</span>`);
    };
    typeSel.onchange = onType; onType();
    m.$('[data-cancel]').onclick = () => m.close();
    m.$('[data-save]').onclick = async () => {
      const v = formValues(m.$('[data-f]'));
      delete v.undefined;
      v.categories = m.$$('[data-cat]:checked').map((x) => x.value);
      v.product_ids = [...pick.p]; v.free_product_ids = (v.type === 'package' || v.type === 'bogo') ? [...pick.f] : [];
      if (!(v.type === 'package' || v.type === 'bogo')) v.free_category = '';
      if (!v.name) { toast('Nama promo wajib diisi', '', 'err'); return; }
      if (v.type === 'percent' && (v.value <= 0 || v.value > 100)) { toast('Persen diskon harus 1–100', '', 'err'); return; }
      if (v.start_date && v.end_date && v.end_date < v.start_date) { toast('Tanggal berakhir sebelum tanggal mulai', '', 'err'); return; }
      try { if (p.id) await db.update('promos', p.id, v); else await db.create('promos', v); toast('Promo disimpan', v.name, 'ok'); m.close(); V.promo(page); } catch (e) { toastErr(e); }
    };
  }
  $('[data-new]', page).onclick = () => form();
  page.onclick = async (e) => {
    const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k];
    const id = +(g('edit') || g('del') || g('tog') || 0); if (!id) return;
    const p = promos.find((x) => x.id === id);
    if (g('edit')) form(p);
    if (g('tog')) { e.preventDefault(); try { await db.update('promos', id, { active: !p.active }); toast(p.active ? 'Promo dimatikan' : 'Promo diaktifkan', p.name, 'ok'); V.promo(page); } catch (ex) { toastErr(ex); } }
    if (g('del') && await confirmBox('Hapus promo ' + p.name + '?', 'Promo tidak dapat dipakai lagi.', 'Hapus')) { try { await db.remove('promos', id); V.promo(page); } catch (ex) { toastErr(ex); } }
  };
  return () => { page.onclick = null; };
};

// =====================================================================
//  MEMBER
// =====================================================================
V.member = async (page) => {
  const admin = App.isAdmin();
  page.innerHTML = head('Member', 'Data pelanggan, poin belanja, dan reward.') + `<div style="margin-bottom:14px">${tabs([['list', 'Daftar member'], ['reward', 'Reward poin'], ...(admin ? [['set', 'Aturan poin & diskon']] : [])], 'list')}</div><div data-body></div>`;
  const body = $('[data-body]', page);
  const mform = (m = {}) => `${field('Nama', 'name', m.name)}${field('Nomor HP / WA', 'phone', m.phone, { type: 'tel' })}${field('Email', 'email', m.email, { type: 'email' })}${admin ? `<div class="grid2">${field('Poin', 'points', m.points ?? 0, { numeric: true })}${field('Voucher belanja (Rp)', 'voucher_amount', m.voucher_amount || '', { numeric: true, hint: 'Sekali pakai, otomatis terpotong di kasir.' })}</div>` : ''}`;
  async function drawList() {
    const list = await db.list('members');
    body.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari nama, HP, email…"></div><button class="btn primary" data-new>${icon('user_plus')}Member baru</button>${admin ? `<button class="btn" data-imp>${icon('upload')}Impor</button><button class="btn" data-exp>${icon('download')}Ekspor</button>` : ''}</div><div data-tbl></div>`;
    const render = () => {
      const q = $('[data-q]', body).value.toLowerCase();
      const l = list.filter((m) => !q || [m.name, m.phone, m.email].join(' ').toLowerCase().includes(q));
      $('[data-tbl]', body).innerHTML = table([{ label: 'Nama', html: (m) => `<b>${esc(m.name)}</b>` }, { label: 'HP', html: (m) => (m.phone ? `${esc(m.phone)} <a class="small" target="_blank" rel="noopener" href="https://wa.me/${esc(m.phone.replace(/\D/g, '').replace(/^0/, '62'))}">WA</a>` : '-') }, { label: 'Email', get: (m) => m.email || '-' }, { label: 'Poin', num: true, html: (m) => `<b>${fmtNum(m.points)}</b>` }, { label: 'Voucher', html: (m) => (m.voucher_amount > 0 ? `<span class="chip ${m.voucher_used ? '' : 'green'}">${rupiah(m.voucher_amount)}${m.voucher_used ? ' · terpakai' : ''}</span>` : '-') }, { label: 'Terdaftar', get: (m) => fmtDate(m.created) }, ...(admin ? [{ label: '', cls: 'nowrap right', html: (m) => `<button class="btn sm icon" data-edit="${m.id}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-del="${m.id}" aria-label="Hapus">${icon('trash')}</button>` }] : [])], l, { empty: 'Belum ada member.', emptyIcon: 'member', maxH: '66vh' });
    };
    $('[data-q]', body).oninput = render;
    $('[data-new]', body).onclick = () => crudModal({ title: 'Member baru', fields: mform(), onSave: async (v) => { await db.create('members', v); toast('Member ditambahkan', v.name, 'ok'); drawList(); } });
    if (admin) {
      $('[data-exp]', body).onclick = () => downloadXLS('member_' + ymd() + '.xls', list, [{ label: 'Nama', key: 'name' }, { label: 'Telepon', key: 'phone' }, { label: 'Email', key: 'email' }, { label: 'Poin', key: 'points' }, { label: 'Voucher', key: 'voucher_amount' }, { label: 'Terdaftar', key: 'created' }]);
      $('[data-imp]', body).onclick = () => importDialog(['members'], drawList);
      $('[data-tbl]', body).onclick = async (e) => {
        const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
        const m = list.find((x) => x.id === +(ed || dl)?.dataset[ed ? 'edit' : 'del']); if (!m) return;
        if (ed) crudModal({ title: 'Ubah member', fields: mform(m), onSave: async (v) => { if (v.voucher_amount !== m.voucher_amount) v.voucher_used = false; await db.update('members', m.id, v); toast('Member disimpan', '', 'ok'); drawList(); } });
        if (dl && await confirmBox('Hapus ' + m.name + '?', 'Poin member akan hilang. Riwayat transaksi tetap ada.', 'Hapus')) { try { await db.remove('members', m.id); drawList(); } catch (ex) { toastErr(ex); } }
      };
    }
    render();
  }
  async function drawReward() {
    const list = await db.list('point_rewards');
    const rf = (r = { type: 'discount', active: true }) => `${field('Nama reward', 'name', r.name, { placeholder: 'Potongan 25 ribu' })}<label class="f">Jenis<select class="input" name="type"><option value="discount" ${r.type === 'discount' ? 'selected' : ''}>Potongan harga</option><option value="product" ${r.type === 'product' ? 'selected' : ''}>Barang gratis</option></select></label><div class="grid2">${field('Poin dibutuhkan', 'points_required', r.points_required || '', { numeric: true })}${field('Potongan (Rp)', 'discount_amount', r.discount_amount || '', { numeric: true, hint: 'Untuk jenis potongan harga' })}</div><div class="grid2">${field('Nama barang hadiah', 'product_name', r.product_name, { hint: 'Untuk jenis barang gratis' })}${field('Barcode hadiah', 'product_barcode', r.product_barcode)}</div><label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> Aktif</label>`;
    body.innerHTML = `<div class="toolbar"><span class="grow muted">Pelanggan menukar poin di kasir saat member dipilih. ${fmtNum(num(App.settings.points_per_amount) || 1000)} rupiah belanja = 1 poin.</span>${admin ? `<button class="btn primary" data-new>${icon('gift')}Reward baru</button>` : ''}</div>` + table([{ label: 'Reward', html: (r) => `<b>${esc(r.name)}</b>` }, { label: 'Jenis', get: (r) => (r.type === 'discount' ? 'Potongan ' + rupiah(r.discount_amount) : 'Gratis: ' + r.product_name) }, { label: 'Poin', num: true, html: (r) => `<span class="chip gold">${fmtNum(r.points_required)}</span>` }, { label: 'Status', html: (r) => `<span class="chip ${r.active ? 'green' : ''}">${r.active ? 'Aktif' : 'Nonaktif'}</span>` }, ...(admin ? [{ label: '', cls: 'right nowrap', html: (r) => `<button class="btn sm icon" data-edit="${r.id}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-del="${r.id}" aria-label="Hapus">${icon('trash')}</button>` }] : [])], list, { empty: 'Belum ada reward poin.', emptyIcon: 'gift' });
    if (!admin) return;
    $('[data-new]', body).onclick = () => crudModal({ title: 'Reward baru', fields: rf(), onSave: async (v) => { await db.create('point_rewards', v); drawReward(); } });
    body.onclick = async (e) => {
      const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]'); const r = list.find((x) => x.id === +(ed || dl)?.dataset[ed ? 'edit' : 'del']); if (!r) return;
      if (ed) crudModal({ title: 'Ubah reward', fields: rf(r), onSave: async (v) => { await db.update('point_rewards', r.id, v); drawReward(); } });
      if (dl && await confirmBox('Hapus reward?', r.name, 'Hapus')) { await db.remove('point_rewards', r.id); drawReward(); }
    };
  }
  async function drawSet() {
    const s = await api('settings_all');
    body.innerHTML = `<div class="panel" style="max-width:560px"><div class="panel-b stack" data-f>
      ${field('Belanja per 1 poin (Rp)', 'points_per_amount', s.points_per_amount || 1000, { numeric: true, hint: 'Contoh 1000: belanja Rp150.000 = 150 poin.' })}
      ${field('Diskon member untuk semua member (%)', 'member_discount_percent', s.member_discount_percent || 0, { numeric: true, hint: 'Jika diisi, member mendapat diskon ini dan promo lain tidak digabung. Isi 0 bila tidak dipakai.' })}
      ${field('Tawarkan daftar member bila belanja di atas (Rp)', 'member_offer_threshold', s.member_offer_threshold || 200000, { numeric: true, hint: '0 = jangan tawarkan.' })}
      <div><button class="btn primary" data-save>Simpan aturan</button></div></div></div>`;
    $('[data-save]', body).onclick = async () => { try { App.settings = await api('settings_save', { values: formValues($('[data-f]', body)) }); toast('Aturan member disimpan', '', 'ok'); } catch (e) { toastErr(e); } };
  }
  bindTabs(page, (t) => { body.onclick = null; ({ list: drawList, reward: drawReward, set: drawSet })[t](); });
  await drawList();
};

// =====================================================================
//  SALES & KOMISI
// =====================================================================
V.sales = async (page) => {
  page.innerHTML = head('Sales & komisi', 'Komisi dihitung dari "komisi per pcs" tiap barang pada transaksi yang memakai kode sales.', `<button class="btn primary" data-new>${icon('plus')}Sales baru</button>`) + `<div class="row wrap" style="justify-content:space-between;margin-bottom:12px">${tabs([['rekap', 'Rekap komisi'], ['tanpa', 'Transaksi tanpa sales']], 'rekap')}${periodPicker()}</div><div data-body></div>`;
  const body = $('[data-body]', page);
  let sales = await db.list('sales'), txs = [], tab = 'rekap', range = [];
  const sform = (s = { active: true }) => `${field('Nama sales', 'name', s.name)}${field('Kode sales', 'code', s.code, { placeholder: 'SLS01', attrs: 'style="text-transform:uppercase"', hint: 'Dimasukkan kasir saat pembayaran.' })}<label class="check"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}> Aktif</label>`;
  const draw = () => {
    if (tab === 'rekap') {
      const rows = sales.map((s) => { const l = txs.filter((t) => t.sales_code === s.code); return { s, n: l.length, omzet: l.reduce((a, t) => a + t.total, 0), komisi: l.reduce((a, t) => a + t.commission, 0), items: l.reduce((a, t) => a + t.item_count, 0) }; });
      body.innerHTML = table([{ label: 'Sales', html: (r) => `<b>${esc(r.s.name)}</b> <span class="chip blue">${esc(r.s.code)}</span>${r.s.active ? '' : ' <span class="chip">nonaktif</span>'}` }, { label: 'Transaksi', num: true, get: (r) => r.n }, { label: 'Barang', num: true, get: (r) => r.items }, { label: 'Omzet', num: true, get: (r) => rupiah(r.omzet) }, { label: 'Komisi', num: true, html: (r) => `<b class="money">${rupiah(r.komisi)}</b>` }, { label: '', cls: 'right nowrap', html: (r) => `<button class="btn sm" data-detail="${r.s.id}">Rincian</button> <button class="btn sm icon" data-edit="${r.s.id}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-del="${r.s.id}" aria-label="Hapus">${icon('trash')}</button>` }], rows, { empty: 'Belum ada sales. Tambahkan sales dengan kodenya.', emptyIcon: 'sales', foot: ['Total', rows.reduce((a, r) => a + r.n, 0), rows.reduce((a, r) => a + r.items, 0), rupiah(rows.reduce((a, r) => a + r.omzet, 0)), rupiah(rows.reduce((a, r) => a + r.komisi, 0)), ''] });
    } else {
      const l = txs.filter((t) => !t.sales_code);
      body.innerHTML = `<p class="small muted" style="margin-top:0">Lupa memasukkan kode sales saat bayar? Tetapkan sales di sini — komisi dihitung ulang otomatis.</p>` + table([{ label: 'Waktu', get: (t) => fmtDT(t.created) }, { label: 'Invoice', key: 'invoice' }, { label: 'Kasir', key: 'cashier' }, { label: 'Total', num: true, get: (t) => rupiah(t.total) }, { label: 'Potensi komisi', num: true, get: (t) => rupiah((t.items || []).reduce((a, i) => a + (i.commission || 0) * i.qty, 0)) }, { label: 'Tetapkan sales', html: (t) => `<select class="input" data-assign="${t.id}" style="width:auto;height:32px"><option value="">— pilih —</option>${sales.filter((s) => s.active).map((s) => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('')}</select>` }], l, { empty: 'Semua transaksi pada periode ini sudah memiliki sales.' });
    }
  };
  const load = async () => { txs = await db.list('transactions', { from: range[0], to: range[1] }); draw(); };
  $('[data-new]', page).onclick = () => crudModal({ title: 'Sales baru', fields: sform(), onSave: async (v) => { await db.create('sales', v); sales = await db.list('sales'); draw(); } });
  body.onclick = async (e) => {
    const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k];
    const s = sales.find((x) => x.id === +(g('edit') || g('del') || g('detail') || 0)); if (!s) return;
    if (g('edit')) crudModal({ title: 'Ubah sales', fields: sform(s), onSave: async (v) => { await db.update('sales', s.id, v); sales = await db.list('sales'); draw(); } });
    if (g('del') && await confirmBox('Hapus sales ' + s.name + '?', 'Riwayat komisi di transaksi lama tetap tersimpan.', 'Hapus')) { await db.remove('sales', s.id); sales = await db.list('sales'); draw(); }
    if (g('detail')) {
      const l = txs.filter((t) => t.sales_code === s.code);
      const m = modal({ title: 'Komisi ' + s.name, size: 'wide', body: table([{ label: 'Waktu', get: (t) => fmtDT(t.created) }, { label: 'Invoice', key: 'invoice' }, { label: 'Barang', html: (t) => (t.items || []).map((i) => `${esc(i.name)} ×${i.qty}`).join('<br>') }, { label: 'Total', num: true, get: (t) => rupiah(t.total) }, { label: 'Komisi', num: true, get: (t) => rupiah(t.commission) }], l, { empty: 'Tidak ada transaksi.', maxH: '60vh' }), foot: '<button class="btn" data-x2>Unduh Excel</button>' });
      m.$('[data-x2]').onclick = () => downloadXLS(`komisi_${s.code}_${range[0]}_${range[1]}.xls`, l, [{ label: 'Tanggal', key: 'created' }, { label: 'Invoice', key: 'invoice' }, { label: 'Kasir', key: 'cashier' }, { label: 'Total', key: 'total' }, { label: 'Komisi', key: 'commission' }]);
    }
  };
  body.onchange = async (e) => {
    const id = +e.target.dataset.assign; if (!id || !e.target.value) return;
    const t = txs.find((x) => x.id === id), s = sales.find((x) => x.code === e.target.value);
    try { await db.update('transactions', id, { sales_code: s.code, sales_name: s.name, commission: (t.items || []).reduce((a, i) => a + (i.commission || 0) * i.qty, 0) }); toast('Sales ditetapkan', `${t.invoice} → ${s.name}`, 'ok'); load(); } catch (ex) { toastErr(ex); }
  };
  bindTabs(page, (t) => { tab = t; draw(); });
  bindPeriod(page, (f, t) => { range = [f, t]; load(); }).set('month');
};

// =====================================================================
//  INFO KASIR (running text)
// =====================================================================
V.info = async (page) => {
  const list = await db.list('store_info');
  const f = (i = { active: true }) => `${field('Judul', 'title', i.title, { placeholder: 'Stok kemeja batik baru datang' })}<label class="f">Isi info<textarea class="input" name="content">${esc(i.content || '')}</textarea></label><label class="check"><input type="checkbox" name="active" ${i.active ? 'checked' : ''}> Tampilkan di kasir</label>`;
  page.innerHTML = head('Info kasir', 'Pesan berjalan di bagian bawah layar kasir, misalnya target harian atau info barang baru.', `<button class="btn primary" data-new>${icon('plus')}Info baru</button>`) + table([{ label: 'Judul', html: (i) => `<b>${esc(i.title)}</b><div class="small muted">${esc(i.content)}</div>` }, { label: 'Dibuat', get: (i) => fmtDate(i.created) }, { label: 'Status', html: (i) => `<span class="chip ${i.active ? 'green' : ''}">${i.active ? 'Tampil' : 'Disembunyikan'}</span>` }, { label: '', cls: 'right nowrap', html: (i) => `<button class="btn sm" data-tog="${i.id}">${i.active ? 'Sembunyikan' : 'Tampilkan'}</button> <button class="btn sm icon" data-edit="${i.id}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-del="${i.id}" aria-label="Hapus">${icon('trash')}</button>` }], list, { empty: 'Belum ada info untuk kasir.', emptyIcon: 'info' });
  $('[data-new]', page).onclick = () => crudModal({ title: 'Info baru', fields: f(), onSave: async (v) => { await db.create('store_info', v); V.info(page); } });
  page.onclick = async (e) => {
    const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k]; const i = list.find((x) => x.id === +(g('edit') || g('del') || g('tog') || 0)); if (!i) return;
    if (g('edit')) crudModal({ title: 'Ubah info', fields: f(i), onSave: async (v) => { await db.update('store_info', i.id, v); V.info(page); } });
    if (g('tog')) { await db.update('store_info', i.id, { active: !i.active }); V.info(page); }
    if (g('del') && await confirmBox('Hapus info?', i.title, 'Hapus')) { await db.remove('store_info', i.id); V.info(page); }
  };
  return () => { page.onclick = null; };
};

// =====================================================================
//  PENGATURAN TOKO
// =====================================================================
V.pengaturan = async (page) => {
  const s = await api('settings_all');
  const sch = (() => { try { return JSON.parse(s.work_schedule || '{}'); } catch (e) { return {}; } })();
  const net = (() => { try { return JSON.parse(s.store_network || '{}'); } catch (e) { return {}; } })();
  const sample = { invoice: 'INV261110-1234', created: nowStr(), cashier: App.user.name, items: [{ name: 'Kemeja Kantor Putih', qty: 1, price: 159000 }, { name: 'Rok Span Hitam', qty: 1, price: 129000, itemDiscount: 20000 }], subtotal: 288000, discount: 20000, total: 268000, payment: 300000, change: 32000, payment_method: 'cash' };
  page.innerHTML = head('Pengaturan toko', 'Identitas toko, struk, PIN admin, biaya tambahan, jadwal masuk, dan WiFi absensi.') + `
  <div class="grid2" style="align-items:start">
    <div class="stack">
      <div class="panel"><div class="panel-h"><h3>Toko & struk</h3></div><div class="panel-b stack" data-store>
        ${field('Nama toko', 'store_name', s.store_name)}${field('Alamat di struk', 'receipt_address', s.receipt_address)}${field('Telepon / WA', 'receipt_phone', s.receipt_phone)}${field('Catatan bawah baris 1', 'receipt_footer1', s.receipt_footer1)}${field('Catatan bawah baris 2', 'receipt_footer2', s.receipt_footer2)}
        <div><button class="btn primary" data-save-store>Simpan toko & struk</button></div></div></div>
      <div class="panel"><div class="panel-h"><h3>PIN admin</h3></div><div class="panel-b stack" data-pin>
        <p class="small muted" style="margin:0">Kasir hanya bisa menambah barang atau mengubah harga bila admin memasukkan PIN ini. PIN tidak pernah dikirim ke perangkat kasir.</p>
        ${field('PIN admin baru', 'supervisor_pin', '', { type: 'password', placeholder: 'Minimal 4 angka', attrs: 'inputmode="numeric" autocomplete="new-password"' })}
        <div><button class="btn primary" data-save-pin>Ganti PIN</button></div></div></div>
      <div class="panel"><div class="panel-h"><h3>Biaya tambahan</h3><button class="btn sm" data-addfee>${icon('plus')}Tambah</button></div><div class="panel-b stack">
        <p class="small muted" style="margin:0">Pilihan cepat di tombol <b>Biaya</b> dan <b>Kirim</b> pada kasir, misalnya ongkir Maxim. Nominal tetap bisa diubah saat transaksi.</p>
        <div class="stack" data-fees style="gap:8px"></div>
        <div><button class="btn primary" data-save-fees>Simpan biaya tambahan</button></div></div></div>
      <div class="panel"><div class="panel-h"><h3>Jadwal & absensi</h3></div><div class="panel-b stack" data-att>
        <div class="grid2">${field('Jam masuk', 'startTime', sch.startTime || '08:00', { type: 'time' })}${field('Toleransi terlambat (menit)', 'toleranceMinutes', sch.toleranceMinutes ?? 15, { numeric: true })}</div>
        ${field('Nama WiFi toko (informasi)', 'wifiName', net.wifiName || '')}
        <label class="f">IP publik WiFi toko<textarea class="input" name="ips" placeholder="Contoh: 103.10.20.30" style="min-height:60px">${esc(net.ips || '')}</textarea><span class="hint">Absen hanya bisa dilakukan dari jaringan dengan IP ini. Pisahkan dengan koma bila lebih dari satu. Kosongkan agar absen bisa dari mana saja.</span></label>
        <div class="row wrap"><span class="small muted grow">IP perangkat ini sekarang: <b>${esc(s._my_ip)}</b></span><button class="btn sm" data-myip>Pakai IP ini</button></div>
        <p class="small" style="margin:0;background:var(--warn-soft);color:var(--warn);padding:8px 10px;border-radius:8px">Buka halaman ini dari HP yang tersambung ke WiFi toko, lalu tekan "Pakai IP ini". IP rumah/paket data pegawai tidak akan diterima.</p>
        <div><button class="btn primary" data-save-att>Simpan jadwal & WiFi</button></div></div></div>
    </div>
    <div class="panel" style="position:sticky;top:0"><div class="panel-h"><h3>Contoh struk</h3><button class="btn sm" data-test>${icon('printer')}Cetak contoh</button></div><div class="panel-b"><div class="receipt-preview" data-prev></div></div></div>
  </div>`;
  let fees = (() => { try { return JSON.parse(s.fee_presets || '[]'); } catch (e) { return []; } })();
  const drawFees = () => { $('[data-fees]', page).innerHTML = fees.length ? fees.map((f, i) => `<div class="row"><input class="input grow" data-fl="${i}" value="${esc(f.label)}" placeholder="Nama biaya, mis. Ongkir Maxim"><input class="input" data-fa="${i}" value="${f.amount || ''}" inputmode="numeric" placeholder="Rp" style="width:120px"><button class="btn icon sm danger" data-fd="${i}" aria-label="Hapus">${icon('trash')}</button></div>`).join('') : '<p class="muted small" style="margin:0">Belum ada. Klik Tambah.</p>'; };
  drawFees();
  $('[data-fees]', page).oninput = (e) => { const i = e.target.dataset.fl ?? e.target.dataset.fa; if (i === undefined) return; if (e.target.dataset.fl !== undefined) fees[+i].label = e.target.value; else fees[+i].amount = numID(e.target.value); };
  $('[data-fees]', page).onclick = (e) => { const d = e.target.closest('[data-fd]'); if (d) { fees.splice(+d.dataset.fd, 1); drawFees(); } };
  $('[data-addfee]', page).onclick = () => { fees.push({ label: '', amount: 0 }); drawFees(); $(`[data-fl="${fees.length - 1}"]`, page).focus(); };
  $('[data-save-fees]', page).onclick = () => { fees = fees.filter((f) => f.label.trim()).map((f) => ({ label: f.label.trim(), amount: num(f.amount) })); drawFees(); save({ fee_presets: JSON.stringify(fees) }, 'Biaya tambahan disimpan'); };
  const prev = () => { const v = formValues($('[data-store]', page)); $('[data-prev]', page).innerHTML = receiptHTML(sample, v); };
  $('[data-store]', page).oninput = prev; prev();
  $('[data-test]', page).onclick = () => printHTML(receiptHTML(sample, formValues($('[data-store]', page))));
  const save = async (values, msg) => { try { App.settings = await api('settings_save', { values }); toast(msg, '', 'ok'); } catch (e) { toastErr(e); } };
  $('[data-save-store]', page).onclick = () => save(formValues($('[data-store]', page)), 'Pengaturan toko disimpan');
  $('[data-save-pin]', page).onclick = () => { const p = $('[name=supervisor_pin]', page).value.trim(); if (p.length < 4) { toast('PIN minimal 4 karakter', '', 'err'); return; } save({ supervisor_pin: p }, 'PIN admin diganti'); $('[name=supervisor_pin]', page).value = ''; };
  $('[data-myip]', page).onclick = () => { const t = $('[name=ips]', page); const list = t.value.split(/[\s,;]+/).filter(Boolean); if (!list.includes(s._my_ip)) list.push(s._my_ip); t.value = list.join(', '); };
  $('[data-save-att]', page).onclick = () => { const v = formValues($('[data-att]', page)); save({ work_schedule: JSON.stringify({ startTime: v.startTime || '08:00', toleranceMinutes: num(v.toleranceMinutes) }), store_network: JSON.stringify({ ips: v.ips, wifiName: v.wifiName }) }, 'Jadwal & WiFi disimpan'); };
};

// =====================================================================
//  PENGGUNA
// =====================================================================
V.pengguna = async (page) => {
  const users = await api('users_list');
  const uf = (u = { role: 'kasir', active: true }) => `<div class="grid2">${field('Nama', 'name', u.name)}${field('Email (untuk masuk)', 'email', u.email, { type: 'email' })}</div>
    <div class="grid2"><label class="f">Peran<select class="input" name="role"><option value="kasir" ${u.role === 'kasir' ? 'selected' : ''}>Kasir</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></label>${field(u.id ? 'Kata sandi baru' : 'Kata sandi', 'password', '', { type: 'password', hint: u.id ? 'Kosongkan bila tidak diganti.' : 'Minimal 6 karakter.', attrs: 'autocomplete="new-password"' })}</div>
    <div class="grid2">${field('Bank', 'bank_name', u.bank_name, { placeholder: 'BRI, BNI, Mandiri…' })}${field('No. rekening', 'bank_account', u.bank_account)}</div>
    <div class="stack" style="gap:8px"><label class="check"><input type="checkbox" name="promo_access" ${u.promo_access ? 'checked' : ''}> Boleh mengelola promo</label><label class="check"><input type="checkbox" name="cek_stok_access" ${u.cek_stok_access ? 'checked' : ''}> Boleh melakukan cek stok</label><label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Akun aktif (bisa masuk)</label></div>`;
  page.innerHTML = head('Pengguna', 'Akun admin dan kasir. Kasir hanya melihat menu yang diizinkan.', `<button class="btn primary" data-new>${icon('user_plus')}Pengguna baru</button>`) + table([
    { label: 'Nama', html: (u) => `<div class="row"><div class="avatar">${esc(u.name[0] || '?')}</div><div><b>${esc(u.name)}</b>${u.id === App.user.id ? ' <span class="chip">Anda</span>' : ''}<div class="small muted">${esc(u.email)}</div></div></div>` },
    { label: 'Peran', html: (u) => `<span class="chip ${u.role === 'admin' ? 'blue' : ''}">${u.role === 'admin' ? 'Admin' : 'Kasir'}</span>` },
    { label: 'Akses tambahan', html: (u) => (u.role === 'admin' ? '<span class="muted small">Semua</span>' : [u.promo_access ? '<span class="chip">Promo</span>' : '', u.cek_stok_access ? '<span class="chip">Cek stok</span>' : ''].join(' ') || '<span class="muted small">—</span>') },
    { label: 'Rekening', get: (u) => (u.bank_account ? `${u.bank_name} ${u.bank_account}` : '-') },
    { label: 'Status', html: (u) => `<span class="chip ${u.active ? 'green' : 'red'}">${u.active ? 'Aktif' : 'Nonaktif'}</span>` },
    { label: '', cls: 'right nowrap', html: (u) => `<button class="btn sm icon" data-edit="${u.id}" aria-label="Ubah">${icon('edit')}</button>${u.id !== App.user.id ? ` <button class="btn sm icon danger" data-del="${u.id}" aria-label="Hapus">${icon('trash')}</button>` : ''}` },
  ], users);
  $('[data-new]', page).onclick = () => crudModal({ title: 'Pengguna baru', size: 'wide', fields: uf(), onSave: async (v) => { await api('users_create', { data: v }); toast('Pengguna dibuat', v.email, 'ok'); V.pengguna(page); } });
  page.onclick = async (e) => {
    const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k]; const u = users.find((x) => x.id === +(g('edit') || g('del') || 0)); if (!u) return;
    if (g('edit')) crudModal({ title: 'Ubah pengguna', size: 'wide', fields: uf(u), onSave: async (v) => { await api('users_update', { id: u.id, data: v }); toast('Pengguna disimpan', '', 'ok'); V.pengguna(page); } });
    if (g('del') && await confirmBox('Hapus ' + u.name + '?', 'Akun tidak bisa dipakai masuk lagi. Riwayat transaksi tetap tersimpan. Alternatif: nonaktifkan akun.', 'Hapus akun')) { try { await api('users_delete', { id: u.id }); V.pengguna(page); } catch (ex) { toastErr(ex); } }
  };
  return () => { page.onclick = null; };
};

// =====================================================================
//  RUMAH TAUTAN
// =====================================================================
V.tautan = async (page) => {
  const admin = App.isAdmin(); const list = await db.list('links');
  const groups = {}; list.forEach((l) => (groups[l.category || 'Lainnya'] = groups[l.category || 'Lainnya'] || []).push(l));
  const lf = (l = {}) => `${field('Judul', 'title', l.title, { placeholder: 'Marketplace Shopee' })}${field('Alamat (URL)', 'url', l.url, { placeholder: 'https://…' })}${field('Kelompok', 'category', l.category, { placeholder: 'Marketplace, Supplier, Media sosial…', attrs: 'list="lcats"' })}<datalist id="lcats">${Object.keys(groups).map((c) => `<option value="${esc(c)}">`).join('')}</datalist><label class="f">Catatan<textarea class="input" name="notes">${esc(l.notes || '')}</textarea></label>`;
  page.innerHTML = head('Rumah tautan', 'Kumpulan link penting toko: marketplace, supplier, media sosial, formulir.', admin ? `<button class="btn primary" data-new>${icon('plus')}Tautan baru</button>` : '') + (list.length ? Object.entries(groups).map(([g, ls]) => `<h3 style="margin:18px 0 8px">${esc(g)}</h3><div class="grid3">${ls.map((l) => `<div class="panel panel-b"><div class="row"><b class="grow">${esc(l.title)}</b>${admin ? `<button class="btn sm icon ghost" data-edit="${l.id}" aria-label="Ubah">${icon('edit')}</button><button class="btn sm icon ghost danger" data-del="${l.id}" aria-label="Hapus">${icon('trash')}</button>` : ''}</div>${l.notes ? `<p class="small muted" style="margin:4px 0 0">${esc(l.notes)}</p>` : ''}<a class="btn sm" style="margin-top:10px" href="${esc(l.url)}" target="_blank" rel="noopener">${icon('link')}Buka</a></div>`).join('')}</div>`).join('') : `<div class="panel">${emptyState('Belum ada tautan.', 'link')}</div>`);
  const nb = $('[data-new]', page); if (nb) nb.onclick = () => crudModal({ title: 'Tautan baru', fields: lf(), onSave: async (v) => { await db.create('links', v); V.tautan(page); } });
  page.onclick = async (e) => {
    const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k]; const l = list.find((x) => x.id === +(g('edit') || g('del') || 0)); if (!l) return;
    if (g('edit')) crudModal({ title: 'Ubah tautan', fields: lf(l), onSave: async (v) => { await db.update('links', l.id, v); V.tautan(page); } });
    if (g('del') && await confirmBox('Hapus tautan?', l.title, 'Hapus')) { await db.remove('links', l.id); V.tautan(page); }
  };
  return () => { page.onclick = null; };
};

// =====================================================================
//  PRINTER
// =====================================================================
V.printer = async (page) => {
  const sample = { invoice: 'TES-PRINTER', created: nowStr(), cashier: App.user.name, items: [{ name: 'Tes cetak', qty: 1, price: 10000 }], subtotal: 10000, discount: 0, total: 10000, payment: 10000, change: 0, payment_method: 'cash' };
  const draw = () => {
    const s = Printer.status;
    page.innerHTML = head('Printer', 'Hubungkan printer thermal Bluetooth 58 mm, atau cetak lewat printer biasa / simpan PDF.') + `<div class="grid2" style="align-items:start">
      <div class="panel"><div class="panel-h"><h3>Printer thermal Bluetooth</h3><span class="chip ${s === 'connected' ? 'green' : s === 'connecting' ? 'amber' : ''}">${s === 'connected' ? 'Terhubung' : s === 'connecting' ? 'Menghubungkan…' : 'Belum terhubung'}</span></div><div class="panel-b stack">
        ${Printer.supported ? `<p class="small muted" style="margin:0">${s === 'connected' ? 'Printer: <b>' + esc(Printer.device?.name || '-') + '</b>' : 'Nyalakan printer, aktifkan Bluetooth & lokasi HP, lalu tekan Hubungkan.'}</p>
          <div class="row wrap">${s === 'connected' ? '<button class="btn" data-dis>Putuskan</button><button class="btn primary" data-test>Cetak tes</button>' : '<button class="btn primary" data-con>Hubungkan printer</button>'}</div>
          <p class="small muted" style="margin:0">Koneksi Bluetooth perlu diulang setiap kali halaman dimuat ulang (aturan keamanan browser).</p>`
          : '<p class="danger small" style="margin:0">Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome di Android, Windows, atau macOS. iPhone/Safari belum didukung — gunakan cetak biasa.</p>'}
      </div></div>
      <div class="panel"><div class="panel-h"><h3>Cetak biasa / PDF</h3></div><div class="panel-b stack"><p class="small muted" style="margin:0">Memakai dialog cetak browser — cocok untuk printer thermal USB yang sudah terpasang di Windows, printer kantor, atau simpan sebagai PDF.</p><div><button class="btn" data-web>${icon('printer')}Cetak contoh struk</button></div></div></div></div>`;
    const b = (s2, f) => { const x = $(s2, page); if (x) x.onclick = f; };
    b('[data-con]', async () => { try { await Printer.connect(); toast('Printer terhubung', '', 'ok'); } catch (e) { if (e.name !== 'NotFoundError') toastErr(e); } });
    b('[data-dis]', () => Printer.disconnect());
    b('[data-test]', async () => { try { await Printer.print(escposReceipt(sample, App.settings)); toast('Tes cetak dikirim', '', 'ok'); } catch (e) { toastErr(e); } });
    b('[data-web]', () => printHTML(receiptHTML(sample, App.settings)));
  };
  Printer.listeners.add(draw); draw();
  return () => Printer.listeners.delete(draw);
};

// =====================================================================
//  PENGIRIMAN
// =====================================================================
V.pengiriman = async (page) => {
  const ST = { baru: ['Perlu dikirim', 'amber'], dikirim: ['Dalam perjalanan', 'blue'], selesai: ['Selesai', 'green'], batal: ['Batal', 'red'] };
  let list = [], tab = 'baru';
  page.innerHTML = head('Pengiriman', 'Pesanan yang dikirim lewat J&T, JNE, Grab, GoSend, Maxim, atau kurir toko.') + `<div class="row wrap" style="justify-content:space-between;margin-bottom:12px"><div data-tabwrap></div><div class="search" style="min-width:240px">${icon('search')}<input class="input" data-q placeholder="Cari nama, HP, resi, invoice…"></div></div><div data-body></div>`;
  const body = $('[data-body]', page);
  const msg = (sh) => `Halo ${sh.recipient}, pesanan Anda dari ${App.settings.store_name || 'Sofeeya Store'} (${sh.invoice}) ${sh.status === 'selesai' ? 'sudah diterima. Terima kasih telah berbelanja!' : `sudah dikirim via ${sh.courier}.`}${sh.resi && sh.status !== 'selesai' ? `\nNo. resi / pelacakan: ${sh.resi}` : ''}${trackURL(sh) && sh.status !== 'selesai' ? `\nLacak: ${trackURL(sh)}` : ''}`;
  const load = async () => { list = await db.list('shipments', { limit: 1000 }); draw(); };
  const draw = () => {
    const counts = Object.fromEntries(Object.keys(ST).map((k) => [k, list.filter((x) => x.status === k).length]));
    $('[data-tabwrap]', page).innerHTML = tabs([['baru', `Perlu dikirim (${counts.baru})`], ['dikirim', `Dalam perjalanan (${counts.dikirim})`], ['selesai', 'Selesai'], ['batal', 'Batal'], ['all', 'Semua']], tab);
    bindTabs($('[data-tabwrap]', page), (t) => { tab = t; draw(); });
    const q = $('[data-q]', page).value.toLowerCase();
    const l = list.filter((x) => (tab === 'all' || x.status === tab) && (!q || [x.recipient, x.phone, x.resi, x.invoice, x.courier, x.address].join(' ').toLowerCase().includes(q)));
    body.innerHTML = l.length ? `<div class="ship-grid">${l.map((sh) => { const c = courierInfo(sh.courier); const tr = trackURL(sh); return `
      <article class="panel ship-card">
        <div class="row"><span class="chip blue">${icon('truck')} ${esc(sh.courier)}</span><span class="chip ${ST[sh.status][1]}">${ST[sh.status][0]}</span><span class="grow"></span><span class="small muted">${fmtDT(sh.created)}</span></div>
        <div><b style="font-size:15px">${esc(sh.recipient || '-')}</b> ${sh.phone ? `<span class="muted">· ${esc(sh.phone)}</span>` : ''}</div>
        <p class="ship-addr">${esc(sh.address || '-')}</p>
        <div class="small muted">${esc(sh.invoice)} · ongkir ${sh.fee ? rupiah(sh.fee) : 'dibayar penerima'}${sh.note ? ' · ' + esc(sh.note) : ''}</div>
        ${sh.resi ? `<div class="small">Resi / pelacakan: <b>${tr ? `<a href="${esc(tr)}" target="_blank" rel="noopener">${esc(sh.resi)}</a>` : esc(sh.resi)}</b></div>` : ''}
        <div class="row wrap" style="margin-top:4px">
          ${sh.status === 'baru' ? `${c.site ? `<a class="btn sm" href="${esc(c.site)}" target="_blank" rel="noopener">Buka ${esc(c.id)}</a>` : ''}<button class="btn sm" data-copy="${sh.id}">Salin alamat</button><button class="btn sm primary" data-send="${sh.id}">Isi resi & kirim</button>` : ''}
          ${sh.status === 'dikirim' ? `${tr ? `<a class="btn sm" href="${esc(tr)}" target="_blank" rel="noopener">Lacak</a>` : ''}<button class="btn sm" data-send="${sh.id}">Ubah resi</button><button class="btn sm primary" data-done="${sh.id}">Tandai diterima</button>` : ''}
          ${sh.phone && sh.status !== 'batal' ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(waLink(sh.phone, msg(sh)))}">${icon('wa')}WA</a>` : ''}
          <button class="btn sm" data-label="${sh.id}">${icon('printer')}Label</button>
          <span class="grow"></span><button class="btn sm icon ghost" data-edit="${sh.id}" aria-label="Ubah">${icon('edit')}</button>
        </div>
      </article>`; }).join('')}</div>` : `<div class="panel">${emptyState(tab === 'baru' ? 'Tidak ada pesanan yang menunggu dikirim. Pengiriman dibuat dari tombol "Kirim" di kasir.' : 'Tidak ada data.', 'truck')}</div>`;
  };
  $('[data-q]', page).oninput = debounce(draw, 150);
  body.onclick = async (e) => {
    const g = (k) => e.target.closest(`[data-${k}]`)?.dataset[k];
    const id = +(g('send') || g('done') || g('copy') || g('label') || g('edit') || 0); if (!id) return;
    const sh = list.find((x) => x.id === id);
    if (g('copy')) { const txt = `${sh.recipient} (${sh.phone})\n${sh.address}`; try { await navigator.clipboard.writeText(txt); toast('Alamat disalin', 'Tempel di aplikasi kurir.', 'ok'); } catch (ex) { prompt('Salin alamat:', txt); } }
    if (g('send')) crudModal({ title: 'Nomor resi / link pelacakan', fields: `<p class="muted" style="margin:0">${esc(sh.courier)} · ${esc(sh.recipient)}</p>${field(courierInfo(sh.courier).type === 'paket' ? 'Nomor resi' : 'Link pelacakan / nama & plat driver', 'resi', sh.resi, { hint: courierInfo(sh.courier).type === 'paket' ? 'Resi dari J&T/JNE/SiCepat bisa dilacak otomatis.' : 'Salin link "bagikan perjalanan" dari aplikasi Grab/Gojek/Maxim.' })}`, onSave: async (v) => { await db.update('shipments', id, { resi: v.resi, status: 'dikirim' }); toast('Pesanan ditandai dikirim', sh.recipient, 'ok'); load(); } });
    if (g('done')) { await db.update('shipments', id, { status: 'selesai' }); toast('Pesanan diterima', sh.recipient, 'ok'); load(); }
    if (g('label')) printHTML(`<div style="width:95mm;border:2px solid #000;padding:4mm;font-family:Arial,sans-serif;font-size:11pt"><div style="display:flex;justify-content:space-between;font-weight:700"><span>${esc(sh.courier)}</span><span>${esc(sh.invoice)}</span></div><hr><div style="font-size:9pt">Penerima</div><div style="font-size:14pt;font-weight:700">${esc(sh.recipient)}</div><div>${esc(sh.phone)}</div><div style="margin-top:2mm">${esc(sh.address)}</div>${sh.note ? `<div style="margin-top:2mm;font-size:9pt">Catatan: ${esc(sh.note)}</div>` : ''}<hr><div style="font-size:9pt">Pengirim: ${esc(App.settings.store_name || 'Sofeeya Store')} ${esc(App.settings.receipt_phone || '')}</div>${sh.resi && courierInfo(sh.courier).type === 'paket' ? `<div style="margin-top:2mm;height:14mm">${code128SVG(sh.resi)}</div><div style="text-align:center;font-size:9pt">${esc(sh.resi)}</div>` : ''}</div>`);
    if (g('edit')) crudModal({ title: 'Ubah pengiriman', size: 'wide', fields: `<div class="grid2"><label class="f">Kurir<select class="input" name="courier">${COURIERS.map((c) => `<option ${c.id === sh.courier ? 'selected' : ''}>${esc(c.id)}</option>`).join('')}</select></label><label class="f">Status<select class="input" name="status">${Object.entries(ST).map(([k, [l]]) => `<option value="${k}" ${k === sh.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${field('Nama penerima', 'recipient', sh.recipient)}${field('No. HP', 'phone', sh.phone)}</div><label class="f">Alamat<textarea class="input" name="address">${esc(sh.address)}</textarea></label><div class="grid2">${field('Ongkir (Rp)', 'fee', sh.fee, { numeric: true, hint: 'Hanya catatan; total transaksi tidak berubah.' })}${field('Resi / link', 'resi', sh.resi)}</div>${field('Catatan', 'note', sh.note)}`, onSave: async (v) => { await db.update('shipments', id, v); load(); } });
  };
  await load();
  return () => { body.onclick = null; };
};

// =====================================================================
//  AKUN SAYA
// =====================================================================
V.akun = async (page) => {
  const u = App.user;
  page.innerHTML = head('Akun saya', u.email) + `<div class="grid2" style="align-items:start;max-width:900px">
    <div class="panel"><div class="panel-h"><h3>Profil</h3></div><div class="panel-b stack" data-p>${field('Nama', 'name', u.name)}<div class="grid2">${field('Bank', 'bank_name', u.bank_name)}${field('No. rekening', 'bank_account', u.bank_account, { hint: 'Untuk pembayaran gaji / komisi.' })}</div><div><button class="btn primary" data-sp>Simpan profil</button></div></div></div>
    <div class="panel"><div class="panel-h"><h3>Ganti kata sandi</h3></div><div class="panel-b stack" data-w>${field('Kata sandi lama', 'old', '', { type: 'password', attrs: 'autocomplete="current-password"' })}${field('Kata sandi baru', 'new', '', { type: 'password', hint: 'Minimal 6 karakter.', attrs: 'autocomplete="new-password"' })}${field('Ulangi kata sandi baru', 'new2', '', { type: 'password', attrs: 'autocomplete="new-password"' })}<div><button class="btn primary" data-sw>Ganti kata sandi</button></div></div></div></div>`;
  $('[data-sp]', page).onclick = async () => { try { App.user = await api('update_profile', formValues($('[data-p]', page))); toast('Profil disimpan', '', 'ok'); } catch (e) { toastErr(e); } };
  $('[data-sw]', page).onclick = async () => { const v = formValues($('[data-w]', page)); if (v.new !== v.new2) { toast('Kata sandi baru tidak sama', '', 'err'); return; } try { await api('change_password', v); toast('Kata sandi diganti', '', 'ok'); $$('[data-w] input', page).forEach((i) => (i.value = '')); } catch (e) { toastErr(e); } };
};
