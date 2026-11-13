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
    title: 'Impor data barang', aliases: 'product', action: 'product_import', mode: 'products', numeric: ['cost', 'price', 'discount', 'stock', 'commission'], need: ['name|model'],
    help: 'Barang dengan barcode yang sama, atau model + warna + ukuran yang sama, akan diperbarui; sisanya ditambahkan sebagai barang baru.',
    file: 'template_produk', headers: ['Model', 'Warna', 'Ukuran', 'Nama Produk', 'Barcode / Kode', 'Kategori', 'Harga Beli', 'Harga Jual', 'Diskon / pcs', 'Stok', 'Komisi Sales / pcs'],
    sample: [['Kemeja Kantor Basic', 'Putih', 'M', '', '', 'Kemeja', 75000, 159000, 0, 6, 2000], ['Kemeja Kantor Basic', 'Putih', 'L', '', '', 'Kemeja', 75000, 159000, 0, 4, 2000], ['Kemeja Kantor Basic', 'Navy', 'M', '', '', 'Kemeja', 75000, 159000, 0, 5, 2000], ['', '', '', 'Bros Mutiara', '', 'Aksesoris', 8000, 20000, 0, 30, 0]], widths: [26, 12, 9, 26, 18, 14, 12, 12, 12, 8, 18],
    tips: ['Barang dengan varian: isi Model, Warna, dan Ukuran — satu baris per varian. Nama Produk boleh kosong (dibuat otomatis).', 'Barang tanpa varian: kosongkan Model/Warna/Ukuran dan isi Nama Produk.', 'Wajib diisi: Harga Jual. Harga & stok cukup angka, mis. 75000.', 'Barcode boleh dikosongkan — dibuat otomatis untuk cetak label.', 'Jangan ubah nama kolom di baris pertama.'],
    cols: [{ label: 'Model / nama', get: (r) => r.model || r.name }, { label: 'Warna', key: 'color' }, { label: 'Ukuran', key: 'size' }, { label: 'Kategori', key: 'category' }, { label: 'Jual', num: true, get: (r) => rupiah(r.price) }, { label: 'Stok', num: true, get: (r) => (r.stock ?? '') }],
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
  const MODES = { hari: { label: 'Hari', n: 14, cur: 'Hari ini', prev: 'kemarin' }, minggu: { label: 'Minggu', n: 12, cur: 'Minggu ini', prev: 'minggu lalu' }, bulan: { label: 'Bulan', n: 12, cur: 'Bulan ini', prev: 'bulan lalu' }, tahun: { label: 'Tahun', n: 5, cur: 'Tahun ini', prev: 'tahun lalu' } };
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  let mode = 'hari'; try { mode = localStorage.getItem('dash-mode') || 'hari'; } catch (e) { /* abaikan */ }
  if (!MODES[mode]) mode = 'hari';
  const products = await db.list('products');
  const cache = {};
  let slow = null;
  // barang lambat laku: masih ada stok tetapi tidak terjual 45 hari terakhir
  async function loadSlow() {
    if (slow) return slow;
    const DAYS = 45, since = addDays(new Date(), -DAYS);
    const tx = await db.list('transactions', { from: ymd(since), limit: 20000 });
    const sold = new Set(); tx.forEach((t) => (t.items || []).forEach((i) => { sold.add(i.id); if (i.model) sold.add('m:' + i.model); }));
    const old = (p) => !p.stock_in_date || p.stock_in_date <= ymd(since);
    slow = groupProducts(products).filter((g) => g.stock > 0 && !g.items.some((p) => sold.has(p.id)) && !(g.model && sold.has('m:' + g.model)) && g.items.every(old))
      .map((g) => ({ ...g, value: g.items.reduce((s, p) => s + p.cost * Math.max(0, p.stock), 0), since: g.items.map((p) => p.stock_in_date).filter(Boolean).sort()[0] || '' }))
      .sort((a, b) => b.value - a.value);
    return slow;
  }
  // awal periode (bucket) untuk sebuah tanggal
  const startOf = (d, m) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (m === 'minggu') { const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); }
    if (m === 'bulan') x.setDate(1);
    if (m === 'tahun') { x.setMonth(0); x.setDate(1); }
    return x;
  };
  const step = (d, m, k) => { const x = new Date(d); if (m === 'hari') x.setDate(x.getDate() + k); if (m === 'minggu') x.setDate(x.getDate() + 7 * k); if (m === 'bulan') x.setMonth(x.getMonth() + k); if (m === 'tahun') x.setFullYear(x.getFullYear() + k); return x; };
  const label = (d, m) => (m === 'hari' ? String(d.getDate()) : m === 'minggu' ? `${d.getDate()}/${d.getMonth() + 1}` : m === 'bulan' ? BULAN[d.getMonth()] : String(d.getFullYear()));
  const longLabel = (d, m) => (m === 'hari' ? fmtDate(ymd(d)) : m === 'minggu' ? `Minggu ${fmtDate(ymd(d))}` : m === 'bulan' ? `${BULAN[d.getMonth()]} ${d.getFullYear()}` : String(d.getFullYear()));
  async function load(m) {
    const now = new Date(); const first = step(startOf(now, m), m, -(MODES[m].n - 1));
    if (!cache[m]) cache[m] = await db.list('transactions', { from: ymd(first), to: ymd(now), order: 'created', limit: 20000 });
    const buckets = []; for (let i = 0; i < MODES[m].n; i++) { const st = step(first, m, i); buckets.push({ start: st, key: ymd(st), tx: [] }); }
    const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
    cache[m].forEach((t) => { const k = ymd(startOf(parseDT(t.created), m)); if (idx[k] !== undefined) buckets[idx[k]].tx.push(t); });
    return buckets;
  }
  async function draw() {
    const body = $('[data-dash]', page); body.style.opacity = '.5';
    const B = await load(mode); body.style.opacity = '1';
    const cur = B[B.length - 1], prev = B[B.length - 2];
    const C = sumTx(cur.tx), P = sumTx(prev ? prev.tx : []), M = MODES[mode];
    const all = B.flatMap((b) => b.tx), A = sumTx(all);
    const vals = B.map((b) => sumTx(b.tx).omzet), max = Math.max(1, ...vals);
    const prod = {}; cur.tx.forEach((t) => (t.items || []).forEach((i) => { const k = i.model || i.name; const p = (prod[k] = prod[k] || { qty: 0 }); p.qty += i.qty; }));
    const top = Object.entries(prod).sort((a, b) => b[1].qty - a[1].qty).slice(0, 7), topMax = top.length ? top[0][1].qty : 1;
    const meth = { cash: 0, qris: 0, transfer: 0 }; cur.tx.forEach((t) => { if (t.total > 0) meth[t.payment_method] = (meth[t.payment_method] || 0) + t.total; });
    const chan = {}; salesChannels().forEach((c) => { chan[c] = 0; }); cur.tx.forEach((t) => { if (t.total > 0) chan[t.channel || 'Toko'] = (chan[t.channel || 'Toko'] || 0) + t.total; });
    const chanMax = Math.max(1, ...Object.values(chan));
    const bySize = {}, byColor = {}; cur.tx.forEach((t) => (t.items || []).forEach((i) => { if (i.size) bySize[i.size] = (bySize[i.size] || 0) + i.qty; if (i.color) byColor[i.color] = (byColor[i.color] || 0) + i.qty; }));
    const sizeL = Object.entries(bySize).sort((a, b) => b[1] - a[1]).slice(0, 8), colorL = Object.entries(byColor).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const szMax = Math.max(1, ...sizeL.map((x) => x[1])), clMax = Math.max(1, ...colorL.map((x) => x[1]));
    const ret = cur.tx.reduce((a, t) => { if (t.return_amount > 0) { a.n++; a.v += t.return_amount; a.q += (t.return_items || []).reduce((s, i) => s + i.qty, 0); } return a; }, { n: 0, v: 0, q: 0 });
    const SL = await loadSlow();
    const low = products.filter((p) => p.stock > 0 && p.stock <= 2).sort((a, b) => a.stock - b.stock).slice(0, 8);
    const stockValue = products.reduce((s, p) => s + p.cost * Math.max(0, p.stock), 0);
    const cmp = (c, p) => { if (!p) return c ? '<span class="money">baru</span>' : '<span class="muted">—</span>'; const x = Math.round(((c - p) / p) * 100); return `<span class="${x >= 0 ? 'money' : 'danger'}">${x >= 0 ? '▲' : '▼'} ${Math.abs(x)}%</span> <span class="muted">vs ${M.prev}</span>`; };
    body.innerHTML = `
      <div class="stats">
        ${stat('Omzet ' + M.cur.toLowerCase(), rupiah(C.omzet), cmp(C.omzet, P.omzet).replace(/class="(money|danger|muted)"/g, 'style="color:#fff;opacity:.9"'), 'hero')}
        ${stat('Laba ' + M.cur.toLowerCase(), rupiah(C.laba), cmp(C.laba, P.laba))}
        ${stat('Transaksi', fmtNum(C.n), `${fmtNum(C.items)} barang · ${cmp(C.n, P.n)}`)}
        ${stat('Rata-rata belanja', rupiah(C.n ? C.omzet / C.n : 0), 'per transaksi')}
        ${stat('Tukar / retur', fmtNum(ret.q) + ' pcs', ret.n ? `${ret.n}× · senilai ${rupiah(ret.v)}` : 'tidak ada')}
        ${stat('Nilai stok (modal)', rupiah(stockValue), `${fmtNum(groupProducts(products).length)} model · ${fmtNum(products.length)} varian`)}
      </div>
      <div class="grid2" style="grid-template-columns:1.4fr 1fr">
        <div class="panel"><div class="panel-h"><h3>Omzet per ${M.label.toLowerCase()} · ${M.n} ${M.label.toLowerCase()} terakhir</h3><span class="small muted">Total ${rupiah(A.omzet)} · laba ${rupiah(A.laba)}</span></div><div class="panel-b"><div class="bars">${B.map((b, i) => `<div class="b" title="${esc(longLabel(b.start, mode))}: ${rupiah(vals[i])}"><i class="${i === B.length - 1 ? 'today' : ''}" style="height:${(vals[i] / max) * 100}%"></i><span>${label(b.start, mode)}</span></div>`).join('')}</div></div></div>
        <div class="panel"><div class="panel-h"><h3>Terlaris ${M.cur.toLowerCase()}</h3></div><div class="panel-b">${top.length ? top.map(([n, v]) => `<div class="hbar"><span class="t" title="${esc(n)}">${esc(n)}</span><span class="track"><i style="width:${(v.qty / topMax) * 100}%"></i></span><span class="n">${fmtNum(v.qty)} pcs</span></div>`).join('') : emptyState('Belum ada penjualan.')}</div></div>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div class="panel"><div class="panel-h"><h3>Penjualan per saluran</h3><span class="small muted">${M.cur}</span></div><div class="panel-b">${Object.entries(chan).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span class="t">${esc(k)}</span><span class="track"><i style="width:${(v / chanMax) * 100}%"></i></span><span class="n">${rupiah(v)}</span></div>`).join('')}</div></div>
        <div class="panel"><div class="panel-h"><h3>Ukuran & warna terlaris</h3><span class="small muted">${M.cur}</span></div><div class="panel-b">${sizeL.length || colorL.length ? `<div class="grid2" style="gap:18px">${[['Ukuran', sizeL, szMax, false], ['Warna', colorL, clMax, true]].map(([t, l, mx, sw]) => `<div><div class="small bold muted" style="margin-bottom:6px">${t}</div>${l.map(([k, v]) => `<div class="hbar"><span class="t" title="${esc(k)}">${sw ? swatch(k) + ' ' : ''}${esc(k)}</span><span class="track"><i style="width:${(v / mx) * 100}%"></i></span><span class="n">${fmtNum(v)}</span></div>`).join('') || '<p class="muted small">—</p>'}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">Belum ada penjualan barang bervarian.</p>'}<p class="small muted" style="margin:8px 0 0">Pakai untuk menentukan ukuran & warna yang direstok lebih banyak.</p></div></div>
      </div>
      <div class="grid2" style="margin-top:12px">
        <div class="panel"><div class="panel-h"><h3>Ukuran hampir habis</h3><a href="#produk" class="small bold">Kelola stok</a></div>${low.length ? table([{ label: 'Barang', key: 'name' }, { label: 'Kategori', key: 'category' }, { label: 'Sisa', num: true, html: (p) => `<span class="chip amber">${p.stock}</span>` }], low) : '<div class="panel-b muted">Semua stok aman.</div>'}</div>
        <div class="panel"><div class="panel-h"><h3>Metode bayar ${M.cur.toLowerCase()}</h3></div><div class="panel-b">${Object.entries(meth).map(([k, v]) => `<div class="hbar"><span class="t">${PAY[k] || k}</span><span class="track"><i style="width:${C.omzet ? (v / Math.max(1, Object.values(meth).reduce((a, b) => a + b, 0))) * 100 : 0}%"></i></span><span class="n">${rupiah(v)}</span></div>`).join('')}</div></div>
      </div>
      <div class="panel" style="margin-top:12px"><div class="panel-h"><div><h3>Barang lambat laku</h3><span class="small muted">Masih ada stok, tidak terjual 45 hari terakhir — modal tertahan ${rupiah(SL.reduce((s, g) => s + g.value, 0))}</span></div><a href="#promo" class="btn sm">${icon('promo')}Buat promo cuci gudang</a></div>
        ${SL.length ? table([{ label: 'Barang', html: (g) => `<div class="row">${thumb(g.image, g.name, 'xs')}<div><b>${esc(g.name)}</b><div class="small muted">${esc(g.category || '')}${g.since ? ' · masuk ' + fmtDate(g.since) : ''}</div></div></div>` }, { label: 'Stok', num: true, get: (g) => fmtNum(g.stock) + ' pcs' }, { label: 'Modal tertahan', num: true, html: (g) => `<b>${rupiah(g.value)}</b>` }], SL.slice(0, 8)) : '<div class="panel-b muted">Tidak ada — semua barang terjual dalam 45 hari terakhir.</div>'}</div>`;
  }
  page.innerHTML = head('Dashboard', 'Analisa penjualan per hari, minggu, bulan, dan tahun.', '<a class="btn primary" href="#kasir">' + icon('kasir') + 'Buka kasir</a>') +
    `<div style="margin-bottom:14px">${tabs(Object.entries(MODES).map(([k, v]) => [k, v.label]), mode)}</div><div data-dash></div>`;
  bindTabs(page, (m) => { mode = m; try { localStorage.setItem('dash-mode', m); } catch (e) { /* abaikan */ } draw(); });
  await draw();
};

// =====================================================================
//  LAPORAN KEUANGAN — 9 sub menu (hak akses admin / kasir)
// =====================================================================
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
// pemilih periode harian / bulanan / tahunan
function periodCtl(root, modes, def, onChange) {
  const now = new Date(); let mode = def, day = ymd(now), mon = now.getMonth(), yr = now.getFullYear();
  const years = []; for (let y = now.getFullYear(); y >= 2020; y--) years.push(y);
  const L = { day: 'Harian', month: 'Bulanan', year: 'Tahunan' };
  const emit = () => {
    let from, to, label;
    if (mode === 'day') { from = to = day; label = day === ymd() ? 'Hari ini, ' + fmtDate(day) : fmtDate(day); }
    else if (mode === 'month') { from = ymd(new Date(yr, mon, 1)); to = ymd(new Date(yr, mon + 1, 0)); label = BULAN[mon] + ' ' + yr; }
    else { from = yr + '-01-01'; to = yr + '-12-31'; label = 'Tahun ' + yr; }
    onChange({ mode, from, to, label, year: yr, month: mon });
  };
  const draw = () => {
    root.innerHTML = `<div class="row wrap pctl">${modes.length > 1 ? `<div class="seg">${modes.map((m) => `<button data-pm="${m}" class="${m === mode ? 'on' : ''}">${L[m]}</button>`).join('')}</div>` : ''}
      ${mode === 'day' ? `<input type="date" class="input" data-pd value="${day}" max="${ymd()}" style="width:auto">`
        : `${mode === 'month' ? `<select class="input" data-pmo style="width:auto">${BULAN.map((b, i) => `<option value="${i}" ${i === mon ? 'selected' : ''}>${b}</option>`).join('')}</select>` : ''}<select class="input" data-py style="width:auto">${years.map((y) => `<option ${y === yr ? 'selected' : ''}>${y}</option>`).join('')}</select>`}</div>`;
    root.onclick = (e) => { const b = e.target.closest('[data-pm]'); if (b && b.dataset.pm !== mode) { mode = b.dataset.pm; draw(); emit(); } };
    root.onchange = (e) => { const t = e.target; if (t.dataset.pd !== undefined && t.value) day = t.value; if (t.dataset.pmo !== undefined) mon = +t.value; if (t.dataset.py !== undefined) yr = +t.value; emit(); };
  };
  draw(); emit();
}
const PAY_KEYS = ['cash', 'qris', 'debit', 'transfer'];
const payLabel = (k) => PAY[k] || k;

V.laporan = async (page) => {
  const admin = App.isAdmin();
  const MENUS = [
    ['transaksi', 'Transaksi', 'laporan', true, 'Penjualan per hari, bulan, dan tahun.'],
    ['labarugi', 'Laba rugi', 'wallet', admin, 'Laporan keuangan: pendapatan, HPP, beban, laba bersih.'],
    ['persediaan', 'Persediaan', 'box', admin, 'Barang masuk & keluar per tanggal.'],
    ['terlaris', 'Produk terlaris', 'star', admin, 'Barang paling laku pada periode.'],
    ['pembayaran', 'Pembayaran', 'card', admin, 'Rekap tunai, QRIS, debit, transfer.'],
    ['member', 'Member', 'member', true, 'Pembelian member & peringkat per semester.'],
    ['pegawai', 'Pegawai', 'akun', true, admin ? 'Waktu absen, rekap absen, komisi.' : 'Absen & komisi Anda.'],
    ['retur', 'Retur', 'rotate', true, 'Tukar & pengembalian barang.'],
    ['reject', 'Barang reject', 'trash', true, 'Barang rusak / cacat yang dikeluarkan dari stok.'],
  ].filter((m) => m[3]);
  const fromHash = (location.hash.split('/')[1] || '');
  let sub = MENUS.some((m) => m[0] === fromHash) ? fromHash : (() => { try { const s = localStorage.getItem('lap-sub'); return MENUS.some((m) => m[0] === s) ? s : 'transaksi'; } catch (e) { return 'transaksi'; } })();
  page.innerHTML = head('Laporan keuangan', admin ? 'Semua laporan toko dalam satu tempat.' : 'Laporan yang dapat diakses kasir.') +
    `<div class="lap"><nav class="lap-nav" data-nav>${MENUS.map(([k, l, ic]) => `<button data-sub="${k}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav><section class="lap-main"><div class="lap-h" data-h></div><div data-body></div></section></div>`;
  const body = $('[data-body]', page), hd = $('[data-h]', page);
  const loading = () => { body.innerHTML = '<div class="empty">Memuat…</div>'; };
  const failed = (e) => { body.innerHTML = `<div class="panel panel-b danger">${esc(e.message)}</div>`; };
  const ctlBox = (modes, def, cb) => { hd.insertAdjacentHTML('beforeend', '<div data-ctl></div>'); periodCtl($('[data-ctl]', hd), modes, def, cb); };
  const go = (k) => {
    sub = k; body.onclick = null; body.onchange = null; try { localStorage.setItem('lap-sub', k); } catch (e) { /* abaikan */ }
    history.replaceState(null, '', '#laporan/' + k);
    $$('[data-sub]', page).forEach((b) => b.classList.toggle('on', b.dataset.sub === k));
    const m = MENUS.find((x) => x[0] === k);
    hd.innerHTML = `<div class="lap-title"><h2>${m[1]}</h2><span class="small muted">${m[4]}</span></div>`;
    const on = $(`[data-sub="${k}"]`, page); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    R[k]();
  };
  $('[data-nav]', page).onclick = (e) => { const b = e.target.closest('[data-sub]'); if (b) go(b.dataset.sub); };

  const R = {};
  // ---------------------------------------------------------------- 1. TRANSAKSI
  R.transaksi = () => {
    let cache = [], P = null;
    const load = async (p) => { P = p; loading(); try { cache = await db.list('transactions', { from: p.from, to: p.to, limit: 20000 }); draw(); } catch (e) { failed(e); } };
    if (admin) ctlBox(['day', 'month', 'year'], 'day', load);
    else { hd.insertAdjacentHTML('beforeend', `<span class="chip blue">Hari ini · ${fmtDate(ymd())}</span>`); load({ from: ymd(), to: ymd(), label: 'Hari ini', mode: 'day' }); }
    function draw() {
      const cashiers = [...new Set(cache.map((t) => t.cashier).filter(Boolean))];
      body.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari invoice, member, kasir…"></div>
        ${admin ? `<select class="input" data-fc style="width:auto"><option value="">Semua kasir</option>${cashiers.map((c) => `<option>${esc(c)}</option>`).join('')}</select>` : ''}
        <select class="input" data-fm style="width:auto"><option value="">Semua metode</option>${PAY_KEYS.map((k) => `<option value="${k}">${payLabel(k)}</option>`).join('')}</select>
        <select class="input" data-fch style="width:auto"><option value="">Semua saluran</option>${[...new Set([...salesChannels(), ...cache.map((t) => t.channel).filter(Boolean)])].map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <button class="btn" data-xls>${icon('download')}Excel</button>${admin ? `<button class="btn" data-xlsd>${icon('download')}Detail barang</button>` : ''}</div><div data-stats></div>${P.mode !== 'day' ? '<div data-daily></div>' : ''}<div data-tbl></div>`;
      const filt = () => {
        const q = $('[data-q]', body).value.toLowerCase(), c = $('[data-fc]', body)?.value || '', mt = $('[data-fm]', body).value, ch = $('[data-fch]', body).value;
        return cache.filter((t) => (!c || t.cashier === c) && (!mt || t.payment_method === mt) && (!ch || (t.channel || 'Toko') === ch) && (!q || [t.invoice, t.member_name, t.cashier, t.sales_name, t.note, t.return_ref].join(' ').toLowerCase().includes(q)));
      };
      const render = () => {
        const list = filt(), s = sumTx(list);
        $('[data-stats]', body).innerHTML = `<div class="stats">${stat('Pendapatan', rupiah(s.omzet), P.label, 'hero')}${admin ? stat('Keuntungan', rupiah(s.laba), s.omzet ? `Margin ${Math.round((s.laba / s.omzet) * 100)}%` : '') : ''}${stat('Transaksi', fmtNum(s.n), `${fmtNum(s.items)} barang`)}${stat('Rata-rata belanja', rupiah(s.n ? s.omzet / s.n : 0))}${stat('Total diskon', rupiah(s.diskon))}</div>`;
        const dl = $('[data-daily]', body);
        if (dl) {
          const key = (t) => (P.mode === 'year' ? t.created.slice(0, 7) : t.created.slice(0, 10)); const g = {};
          list.forEach((t) => { const k = key(t); const a = (g[k] = g[k] || { k, n: 0, omzet: 0, laba: 0 }); a.n++; a.omzet += t.total; a.laba += t.profit; });
          const rows = Object.values(g).sort((a, b) => a.k.localeCompare(b.k)), mx = Math.max(1, ...rows.map((r) => r.omzet));
          dl.innerHTML = `<div class="panel" style="margin-bottom:12px"><div class="panel-h"><h3>${P.mode === 'year' ? 'Per bulan' : 'Per hari'}</h3></div><div class="panel-b">${rows.map((r) => `<div class="hbar"><span class="t">${P.mode === 'year' ? BULAN[+r.k.slice(5, 7) - 1].slice(0, 3) : fmtDate(r.k).slice(0, 6)}</span><span class="track"><i style="width:${(r.omzet / mx) * 100}%"></i></span><span class="n">${rupiah(r.omzet)} · ${r.n}×</span></div>`).join('') || '<p class="muted" style="margin:0">—</p>'}</div></div>`;
        }
        $('[data-tbl]', body).innerHTML = table([
          { label: 'Waktu', html: (t) => `${P.mode === 'day' ? '' : fmtDate(t.created) + '<div class="small muted">'}${fmtTime(t.created)}${P.mode === 'day' ? '' : '</div>'}` },
          { label: 'Invoice', html: (t) => `<b>${esc(t.invoice)}</b>${t.return_ref ? `<div><span class="chip amber">${t.total < 0 ? 'Retur' : 'Tukar'} · ${esc(t.return_ref)}</span></div>` : ''}${t.promo_name ? `<div class="small muted">${esc(t.promo_name)}</div>` : ''}` },
          { label: 'Saluran', html: (t) => `<span class="chip ${(t.channel || 'Toko') === 'Toko' ? '' : 'blue'}">${esc(t.channel || 'Toko')}</span>` },
          { label: 'Kasir', key: 'cashier' }, { label: 'Member', get: (t) => t.member_name || '-' },
          { label: 'Metode', html: (t) => `<span class="chip ${t.payment_method === 'cash' ? '' : 'blue'}">${payLabel(t.payment_method)}</span>` },
          { label: 'Barang', num: true, get: (t) => t.item_count },
          { label: 'Total', num: true, html: (t) => `<b class="${t.total < 0 ? 'danger' : ''}">${rupiah(t.total)}</b>` },
          ...(admin ? [{ label: 'Laba', num: true, html: (t) => `<span class="${t.profit < 0 ? 'danger' : 'money'}">${rupiah(t.profit)}</span>` }] : []),
        ], list, { rowAttr: (t) => `data-tx="${t.id}" style="cursor:pointer"`, empty: 'Tidak ada transaksi pada periode ini.', emptyIcon: 'laporan', maxH: '60vh' });
      };
      ['[data-q]', '[data-fc]', '[data-fm]', '[data-fch]'].forEach((s) => { const x = $(s, body); if (x) x.oninput = render; });
      const cols = [{ label: 'Tanggal', key: 'created' }, { label: 'Invoice', key: 'invoice' }, { label: 'Saluran', get: (t) => t.channel || 'Toko' }, { label: 'Kasir', key: 'cashier' }, { label: 'Member', key: 'member_name' }, { label: 'Sales', key: 'sales_name' }, { label: 'Metode', get: (t) => payLabel(t.payment_method) }, { label: 'Retur dari', key: 'return_ref' }, { label: 'Jumlah barang', key: 'item_count' }, { label: 'Subtotal', key: 'subtotal' }, { label: 'Diskon', key: 'discount' }, { label: 'Biaya', key: 'fee' }, { label: 'Total', key: 'total' }, ...(admin ? [{ label: 'Laba', key: 'profit' }, { label: 'Komisi', key: 'commission' }] : []), { label: 'Catatan', key: 'note' }];
      $('[data-xls]', body).onclick = () => downloadXLS(`transaksi_${P.from}_${P.to}.xls`, filt(), cols, 'Laporan transaksi ' + P.label);
      const xd = $('[data-xlsd]', body); if (xd) xd.onclick = () => {
        const rows = []; filt().forEach((t) => (t.items || []).forEach((i) => rows.push({ t, i })));
        downloadXLS(`detail_barang_${P.from}_${P.to}.xls`, rows, [{ label: 'Tanggal', get: (r) => r.t.created }, { label: 'Invoice', get: (r) => r.t.invoice }, { label: 'Nama barang', get: (r) => r.i.name }, { label: 'Model', get: (r) => r.i.model || '' }, { label: 'Warna', get: (r) => r.i.color || '' }, { label: 'Ukuran', get: (r) => r.i.size || '' }, { label: 'Kategori', get: (r) => r.i.category || '' }, { label: 'Qty', get: (r) => r.i.qty }, { label: 'Harga jual', get: (r) => r.i.price }, { label: 'Harga beli', get: (r) => r.i.cost }, { label: 'Diskon', get: (r) => r.i.itemDiscount || 0 }, { label: 'Harga bersih', get: (r) => r.i.price * r.i.qty - (r.i.itemDiscount || 0) }, { label: 'Metode', get: (r) => payLabel(r.t.payment_method) }]);
      };
      $('[data-tbl]', body).onclick = (e) => { const r = e.target.closest('[data-tx]'); if (r) txDetail(cache.find((t) => t.id === +r.dataset.tx), () => load(P)); };
      render();
    }
  };
  async function txDetail(t, reload) {
    if (t.shipping === undefined) { try { const sh = await db.list('shipments', { where: { transaction_id: t.id }, limit: 1 }); t.shipping = sh[0] || null; } catch (e) { t.shipping = null; } }
    const m = modal({ title: 'Detail transaksi', size: 'wide', body: `<div class="grid2" style="align-items:start"><div class="receipt-preview">${receiptHTML(t, App.settings)}</div><div class="stack">
      ${admin ? `<div class="panel panel-b small"><div class="row"><span class="grow muted">Laba</span><b class="${t.profit < 0 ? 'danger' : 'money'}">${rupiah(t.profit)}</b></div><div class="row"><span class="grow muted">Komisi sales</span><b>${rupiah(t.commission)}</b></div><div class="row"><span class="grow muted">Poin didapat / dipakai</span><b>${t.points_earned} / ${t.points_used}</b></div></div>
      <div class="panel panel-b"><h3>Batalkan transaksi</h3><p class="small muted">Transaksi dihapus dari laporan. Poin member dikembalikan.</p><label class="check"><input type="checkbox" data-restore checked> Kembalikan stok barang</label>${field('Alasan pembatalan', 'reason', '', { placeholder: 'Salah input, dll.' })}<button class="btn danger" data-cancel style="margin-top:10px">Batalkan transaksi</button></div>` : `<div class="panel panel-b small"><div class="row"><span class="grow muted">Poin didapat / dipakai</span><b>${t.points_earned} / ${t.points_used}</b></div></div>`}</div></div>`,
      foot: `<button class="btn" data-print>${icon('printer')}Cetak ulang</button>${Printer.supported ? '<button class="btn" data-bt>Printer Bluetooth</button>' : ''}` });
    m.$('[data-print]').onclick = () => printHTML(receiptHTML(t, App.settings));
    const bt = m.$('[data-bt]'); if (bt) bt.onclick = async () => { try { await Printer.printReceipt(t); toast('Struk dikirim', '', 'ok'); } catch (e) { if (e.name !== 'NotFoundError') toastErr(e); } };
    const c = m.$('[data-cancel]');
    if (c) c.onclick = async () => {
      if (!(await confirmBox('Batalkan ' + t.invoice + '?', 'Tindakan ini tidak dapat diurungkan.', 'Ya, batalkan'))) return;
      try { await api('tx_delete', { id: t.id, restore_stock: m.$('[data-restore]').checked, reason: m.$('[name=reason]').value }); toast('Transaksi dibatalkan', t.invoice, 'ok'); m.close(); reload(); } catch (e) { toastErr(e); }
    };
  }

  // ---------------------------------------------------------------- 2. LABA RUGI
  const EXP_CATS = ['Gaji pegawai', 'Sewa toko', 'Listrik & air', 'Internet & pulsa', 'Plastik & kemasan', 'Iklan & promosi', 'Transportasi', 'Perawatan toko', 'Lain-lain'];
  R.labarugi = () => {
    let P;
    const load = async (p) => {
      P = p; loading();
      try {
        const [tx, rj, ex] = await Promise.all([db.list('transactions', { from: p.from, to: p.to, limit: 20000 }), db.list('rejects', { from: p.from, to: p.to, limit: 20000 }), db.list('expenses', { from: p.from, to: p.to, limit: 5000 })]);
        draw(tx, rj, ex);
      } catch (e) { failed(e); }
    };
    ctlBox(['month', 'year'], 'month', load);
    const calc = (tx, rj, ex) => {
      const a = { kotor: 0, diskon: 0, retur: 0, hpp: 0, komisi: 0, fee: 0, reject: 0, biaya: 0, n: 0, cats: {} };
      tx.forEach((t) => { a.n++; a.kotor += t.subtotal; a.diskon += t.discount; a.retur += t.return_amount || 0; a.komisi += t.commission; a.fee += t.fee || 0;
        (t.items || []).forEach((i) => { a.hpp += (i.cost || 0) * i.qty; }); (t.return_items || []).forEach((i) => { a.hpp -= (i.cost || 0) * i.qty; }); });
      rj.forEach((r) => { a.reject += r.cost * r.qty; });
      ex.forEach((e) => { a.biaya += e.amount; a.cats[e.category] = (a.cats[e.category] || 0) + e.amount; });
      a.bersih = a.kotor - a.diskon - a.retur; a.lk = a.bersih - a.hpp; a.beban = a.komisi + a.reject + a.biaya; a.lb = a.lk - a.beban;
      return a;
    };
    function draw(tx, rj, ex) {
      const a = calc(tx, rj, ex), pct = (v) => (a.bersih ? ` <span class="small muted">${Math.round((v / a.bersih) * 1000) / 10}%</span>` : '');
      const L = (k, v, cls = '', ind = false) => `<div class="pl-row ${cls}"><span class="${ind ? 'ind' : ''}">${k}</span><b>${rupiah(v)}</b></div>`;
      let monthly = '';
      if (P.mode === 'year') {
        const rows = BULAN.map((b, i) => { const mm = String(i + 1).padStart(2, '0'), f = (x, k) => (x[k] || '').slice(5, 7) === mm; const c = calc(tx.filter((t) => f(t, 'created')), rj.filter((r) => f(r, 'created')), ex.filter((e) => f(e, 'expense_date'))); return { b, ...c }; });
        monthly = `<div class="panel" style="margin-top:12px"><div class="panel-h"><h3>Per bulan · ${P.year}</h3></div>${table([{ label: 'Bulan', get: (r) => r.b }, { label: 'Transaksi', num: true, get: (r) => fmtNum(r.n) }, { label: 'Penjualan bersih', num: true, get: (r) => rupiah(r.bersih) }, { label: 'Laba kotor', num: true, get: (r) => rupiah(r.lk) }, { label: 'Beban', num: true, get: (r) => rupiah(r.beban) }, { label: 'Laba bersih', num: true, html: (r) => `<b class="${r.lb < 0 ? 'danger' : 'money'}">${rupiah(r.lb)}</b>` }], rows, { foot: ['Total', fmtNum(a.n), rupiah(a.bersih), rupiah(a.lk), rupiah(a.beban), `<b>${rupiah(a.lb)}</b>`] })}</div>`;
      }
      body.innerHTML = `<div class="stats">${stat('Penjualan bersih', rupiah(a.bersih), P.label, 'hero')}${stat('Laba kotor', rupiah(a.lk), a.bersih ? 'Margin ' + Math.round((a.lk / a.bersih) * 100) + '%' : '')}${stat('Total beban', rupiah(a.beban))}${stat('Laba bersih', `<span class="${a.lb < 0 ? 'danger' : 'money'}">${rupiah(a.lb)}</span>`, a.lb < 0 ? 'Rugi' : 'Untung')}</div>
        <div class="grid2" style="align-items:start">
          <div class="panel"><div class="panel-h"><h3>Laporan laba rugi</h3><button class="btn sm" data-xls>${icon('download')}Excel</button></div><div class="panel-b pl">
            <div class="pl-sec">Pendapatan</div>
            ${L('Penjualan kotor', a.kotor, '', true)}${L('Diskon & promo', -a.diskon, 'neg', true)}${L('Retur penjualan', -a.retur, 'neg', true)}
            <div class="pl-row sum"><span>Penjualan bersih</span><b>${rupiah(a.bersih)}</b></div>
            ${L('Harga pokok penjualan (HPP)', -a.hpp, 'neg', true)}
            <div class="pl-row sum"><span>Laba kotor${pct(a.lk)}</span><b>${rupiah(a.lk)}</b></div>
            <div class="pl-sec">Beban</div>
            ${L('Komisi sales', -a.komisi, 'neg', true)}${L('Barang reject (rusak/cacat)', -a.reject, 'neg', true)}
            ${Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, v]) => L(esc(k), -v, 'neg', true)).join('') || '<div class="pl-row"><span class="ind muted">Belum ada biaya operasional dicatat</span><b>Rp0</b></div>'}
            <div class="pl-row sum"><span>Total beban</span><b>${rupiah(-a.beban)}</b></div>
            <div class="pl-row grand ${a.lb < 0 ? 'loss' : ''}"><span>LABA BERSIH${pct(a.lb)}</span><b>${rupiah(a.lb)}</b></div>
            ${a.fee ? `<p class="small muted" style="margin:10px 0 0">Biaya tambahan dari pelanggan (ongkir, dll.) ${rupiah(a.fee)} tidak dihitung sebagai pendapatan karena diteruskan ke pihak lain.</p>` : ''}
          </div></div>
          <div class="panel"><div class="panel-h"><div><h3>Biaya operasional</h3><span class="small muted">Gaji, sewa, listrik, dll. · ${P.label}</span></div><button class="btn sm primary" data-addx>${icon('plus')}Catat biaya</button></div>
            ${table([{ label: 'Tanggal', get: (e) => fmtDate(e.expense_date) }, { label: 'Kategori', html: (e) => `<b>${esc(e.category)}</b>${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}` }, { label: 'Jumlah', num: true, get: (e) => rupiah(e.amount) }, { label: '', cls: 'right nowrap', html: (e) => `<button class="btn sm icon" data-ex="${e.id}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-dx="${e.id}" aria-label="Hapus">${icon('trash')}</button>` }], ex, { empty: 'Belum ada biaya. Catat gaji, sewa, listrik, dll. agar laba bersih akurat.', maxH: '46vh' })}</div>
        </div>${monthly}`;
      const form = (e = {}) => `<div class="grid2">${field('Tanggal', 'expense_date', e.expense_date || ymd(), { type: 'date' })}${field('Kategori', 'category', e.category || '', { attrs: 'list="xcats"', placeholder: 'Gaji pegawai, Sewa toko…' })}${field('Jumlah (Rp)', 'amount', e.amount || '', { numeric: true })}${field('Catatan', 'note', e.note || '')}</div><datalist id="xcats">${EXP_CATS.map((c) => `<option value="${c}">`).join('')}</datalist>`;
      $('[data-addx]', body).onclick = () => crudModal({ title: 'Catat biaya operasional', fields: form(), onSave: async (v) => { if (!(v.amount > 0)) throw new Error('Isi jumlah biaya.'); await db.create('expenses', { ...v, user_name: App.user.name }); toast('Biaya dicatat', v.category, 'ok'); load(P); } });
      body.onclick = async (e) => {
        const ed = e.target.closest('[data-ex]'), dl = e.target.closest('[data-dx]');
        if (ed) { const x = ex.find((y) => y.id === +ed.dataset.ex); crudModal({ title: 'Ubah biaya', fields: form(x), onSave: async (v) => { await db.update('expenses', x.id, v); load(P); } }); }
        if (dl && await confirmBox('Hapus biaya ini?', '', 'Hapus')) { await db.remove('expenses', +dl.dataset.dx); load(P); }
      };
      $('[data-xls]', body).onclick = () => {
        const rows = [['Penjualan kotor', a.kotor], ['Diskon & promo', -a.diskon], ['Retur penjualan', -a.retur], ['PENJUALAN BERSIH', a.bersih], ['Harga pokok penjualan (HPP)', -a.hpp], ['LABA KOTOR', a.lk], ['Komisi sales', -a.komisi], ['Barang reject', -a.reject], ...Object.entries(a.cats).map(([k, v]) => [k, -v]), ['TOTAL BEBAN', -a.beban], ['LABA BERSIH', a.lb]].map(([k, v]) => ({ k, v }));
        downloadXLS(`laba_rugi_${P.from}_${P.to}.xls`, rows, [{ label: 'Pos', key: 'k' }, { label: 'Jumlah (Rp)', key: 'v' }], 'Laporan laba rugi ' + P.label);
      };
    }
  };

  // ---------------------------------------------------------------- 3. PERSEDIAAN
  R.persediaan = () => {
    hd.insertAdjacentHTML('beforeend', `<div class="row wrap pctl" data-rng><div class="seg"><button data-r="today">Hari ini</button><button data-r="7">7 hari</button><button data-r="month" class="on">Bulan ini</button></div><input type="date" class="input" data-f style="width:auto"><span class="muted">s/d</span><input type="date" class="input" data-t style="width:auto"></div>`);
    const rb = $('[data-rng]', hd), f = $('[data-f]', rb), t = $('[data-t]', rb);
    let mv = [], view = 'tanggal';
    const kind = (m) => (m.type === 'in' ? (/^Retur/.test(m.note) ? 'Retur masuk' : /^Batal/.test(m.note) ? 'Pembatalan' : /awal/i.test(m.note) ? 'Stok awal' : 'Barang masuk') : /^Penjualan/.test(m.note) ? 'Penjualan' : /^Reject/.test(m.note) ? 'Reject' : 'Koreksi / keluar lain');
    const load = async () => { loading(); try { mv = await db.list('stock_movements', { from: f.value, to: t.value, limit: 20000 }); draw(); } catch (e) { failed(e); } };
    const setR = (k) => { const d = new Date(); t.value = ymd(d); f.value = k === 'today' ? ymd(d) : k === '7' ? ymd(addDays(d, -6)) : ymd(new Date(d.getFullYear(), d.getMonth(), 1)); $$('[data-r]', rb).forEach((b) => b.classList.toggle('on', b.dataset.r === k)); load(); };
    rb.onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) setR(b.dataset.r); };
    f.onchange = t.onchange = () => { $$('[data-r]', rb).forEach((b) => b.classList.remove('on')); if (f.value && t.value) load(); };
    function draw() {
      const masuk = mv.filter((m) => m.type === 'in'), keluar = mv.filter((m) => m.type !== 'in'), sq = (l) => l.reduce((s, m) => s + m.quantity, 0);
      const kinds = {}; mv.forEach((m) => { const k = kind(m); kinds[k] = (kinds[k] || 0) + m.quantity; });
      body.innerHTML = `<div class="stats">${stat('Barang masuk', fmtNum(sq(masuk)) + ' pcs', `${fmtDate(f.value)} – ${fmtDate(t.value)}`, 'hero')}${stat('Barang keluar', fmtNum(sq(keluar)) + ' pcs')}${stat('Terjual', fmtNum(kinds['Penjualan'] || 0) + ' pcs')}${stat('Reject', fmtNum(kinds['Reject'] || 0) + ' pcs')}</div>
        <div class="row wrap" style="margin-bottom:10px;justify-content:space-between">${tabs([['tanggal', 'Per tanggal'], ['barang', 'Per barang'], ['rincian', 'Rincian']], view)}<div class="row">${Object.entries(kinds).map(([k, v]) => `<span class="chip">${esc(k)}: ${fmtNum(v)}</span>`).join(' ')}<button class="btn sm" data-xls>${icon('download')}Excel</button></div></div><div data-v></div>`;
      const V2 = $('[data-v]', body);
      const show = () => {
        if (view === 'tanggal') {
          const g = {}; mv.forEach((m) => { const k = m.created.slice(0, 10); const a = (g[k] = g[k] || { k, in: 0, out: 0, jual: 0, rej: 0 }); if (m.type === 'in') a.in += m.quantity; else { a.out += m.quantity; if (kind(m) === 'Penjualan') a.jual += m.quantity; if (kind(m) === 'Reject') a.rej += m.quantity; } });
          const rows = Object.values(g).sort((a, b) => b.k.localeCompare(a.k));
          V2.innerHTML = table([{ label: 'Tanggal', get: (r) => fmtDate(r.k) }, { label: 'Masuk', num: true, html: (r) => `<b class="money">+${fmtNum(r.in)}</b>` }, { label: 'Keluar', num: true, html: (r) => `<b class="danger">−${fmtNum(r.out)}</b>` }, { label: 'Terjual', num: true, get: (r) => fmtNum(r.jual) }, { label: 'Reject', num: true, get: (r) => fmtNum(r.rej) }], rows, { empty: 'Tidak ada pergerakan stok.', maxH: '56vh', foot: ['Total', '+' + fmtNum(sq(masuk)), '−' + fmtNum(sq(keluar)), fmtNum(kinds['Penjualan'] || 0), fmtNum(kinds['Reject'] || 0)] });
        } else if (view === 'barang') {
          const g = {}; mv.forEach((m) => { const a = (g[m.product_id + '|' + m.product_name] = g[m.product_id + '|' + m.product_name] || { name: m.product_name, in: 0, out: 0, last: 0 }); if (m.type === 'in') a.in += m.quantity; else a.out += m.quantity; a.last = m.stock_after; });
          const rows = Object.values(g).sort((a, b) => b.out + b.in - (a.out + a.in));
          V2.innerHTML = table([{ label: 'Barang', key: 'name' }, { label: 'Masuk', num: true, html: (r) => `<span class="money">+${fmtNum(r.in)}</span>` }, { label: 'Keluar', num: true, html: (r) => `<span class="danger">−${fmtNum(r.out)}</span>` }, { label: 'Stok akhir', num: true, get: (r) => fmtNum(r.last) }], rows, { empty: 'Tidak ada pergerakan stok.', maxH: '56vh' });
        } else {
          V2.innerHTML = table([{ label: 'Waktu', get: (m) => fmtDT(m.created) }, { label: 'Barang', html: (m) => `<b>${esc(m.product_name)}</b><div class="small muted">${esc(m.note || '')}${m.invoice ? ' · ' + esc(m.invoice) : ''}</div>` }, { label: 'Jenis', html: (m) => `<span class="chip ${m.type === 'in' ? 'green' : 'red'}">${esc(kind(m))}</span>` }, { label: 'Jumlah', num: true, html: (m) => `<b class="${m.type === 'in' ? 'money' : 'danger'}">${m.type === 'in' ? '+' : '−'}${m.quantity}</b>` }, { label: 'Stok', num: true, get: (m) => `${m.stock_before} → ${m.stock_after}` }, { label: 'Oleh', key: 'cashier' }], mv, { empty: 'Tidak ada pergerakan stok.', maxH: '56vh' });
        }
      };
      bindTabs(body, (v) => { view = v; show(); }); show();
      $('[data-xls]', body).onclick = () => downloadXLS(`persediaan_${f.value}_${t.value}.xls`, mv, [{ label: 'Waktu', key: 'created' }, { label: 'Barang', key: 'product_name' }, { label: 'Barcode', key: 'barcode' }, { label: 'Jenis', get: (m) => kind(m) }, { label: 'Masuk', get: (m) => (m.type === 'in' ? m.quantity : 0) }, { label: 'Keluar', get: (m) => (m.type === 'in' ? 0 : m.quantity) }, { label: 'Stok sebelum', key: 'stock_before' }, { label: 'Stok sesudah', key: 'stock_after' }, { label: 'Keterangan', key: 'note' }, { label: 'Invoice', key: 'invoice' }, { label: 'Oleh', key: 'cashier' }]);
    }
    setR('month');
  };

  // ---------------------------------------------------------------- 4. PRODUK TERLARIS
  R.terlaris = () => {
    let P, cache = [], byModel = true;
    const load = async (p) => { P = p; loading(); try { cache = await db.list('transactions', { from: p.from, to: p.to, limit: 20000 }); draw(); } catch (e) { failed(e); } };
    ctlBox(['day', 'month', 'year'], 'month', load);
    function draw() {
      const agg = {}, key = (i) => (byModel && i.model ? 'm:' + i.model : i.id + '|' + i.name), nm = (i) => (byModel && i.model ? i.model : i.name);
      const add = (i, sign) => { const k = key(i); const a = (agg[k] = agg[k] || { name: nm(i), category: i.category || '', qty: 0, omzet: 0, laba: 0, n: 0 }); const net = sign > 0 ? i.price * i.qty - (i.itemDiscount || 0) : i.price * i.qty; a.qty += sign * i.qty; a.omzet += sign * net; a.laba += sign * (net - (i.cost || 0) * i.qty); if (sign > 0) a.n++; };
      cache.forEach((t) => { (t.items || []).forEach((i) => add(i, 1)); (t.return_items || []).forEach((i) => add(i, -1)); });
      const rows = Object.values(agg).filter((r) => r.qty > 0).sort((a, b) => b.qty - a.qty || b.omzet - a.omzet), tq = rows.reduce((s, r) => s + r.qty, 0), mx = Math.max(1, ...rows.map((r) => r.qty));
      const cat = {}; rows.forEach((r) => { cat[r.category || 'Tanpa kategori'] = (cat[r.category || 'Tanpa kategori'] || 0) + r.qty; }); const cmx = Math.max(1, ...Object.values(cat));
      body.innerHTML = `<div class="toolbar"><div class="seg" data-gm><button data-g="1" class="${byModel ? 'on' : ''}">Per model</button><button data-g="0" class="${byModel ? '' : 'on'}">Per varian</button></div><span class="grow muted">${rows.length} barang terjual · ${fmtNum(tq)} pcs · ${P.label}</span><button class="btn" data-xls>${icon('download')}Excel</button></div>
        <div class="grid2" style="grid-template-columns:1.6fr 1fr;align-items:start">${table([{ label: '#', html: (r, i) => (i < 3 ? `<span class="chip gold">${icon('star')} ${i + 1}</span>` : i + 1) }, { label: 'Barang', html: (r) => `<b>${esc(r.name)}</b><div class="bar-mini"><i style="width:${(r.qty / mx) * 100}%"></i></div>` }, { label: 'Terjual', num: true, html: (r) => `<b>${fmtNum(r.qty)}</b> <span class="small muted">${tq ? Math.round((r.qty / tq) * 100) : 0}%</span>` }, { label: 'Penjualan', num: true, get: (r) => rupiah(r.omzet) }, { label: 'Laba', num: true, html: (r) => `<span class="${r.laba < 0 ? 'danger' : 'money'}">${rupiah(r.laba)}</span>` }], rows.slice(0, 100), { empty: 'Belum ada barang terjual pada periode ini.', maxH: '62vh' })}
        <div class="panel"><div class="panel-h"><h3>Per kategori</h3></div><div class="panel-b">${Object.entries(cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span class="t">${esc(k)}</span><span class="track"><i style="width:${(v / cmx) * 100}%"></i></span><span class="n">${fmtNum(v)} pcs</span></div>`).join('') || '<p class="muted" style="margin:0">—</p>'}</div></div></div>`;
      $('[data-gm]', body).onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { byModel = b.dataset.g === '1'; draw(); } };
      $('[data-xls]', body).onclick = () => downloadXLS(`terlaris_${P.from}_${P.to}.xls`, rows, [{ label: 'Barang', key: 'name' }, { label: 'Kategori', key: 'category' }, { label: 'Terjual (pcs)', key: 'qty' }, { label: 'Penjualan bersih', key: 'omzet' }, { label: 'Laba', key: 'laba' }]);
    }
  };

  // ---------------------------------------------------------------- 5. PEMBAYARAN
  R.pembayaran = () => {
    let P, cache = [];
    const load = async (p) => { P = p; loading(); try { cache = await db.list('transactions', { from: p.from, to: p.to, limit: 20000 }); draw(); } catch (e) { failed(e); } };
    ctlBox(['day', 'month', 'year'], 'day', load);
    function draw() {
      const tot = {}, cnt = {}; PAY_KEYS.forEach((k) => { tot[k] = 0; cnt[k] = 0; });
      let refund = 0;
      cache.forEach((t) => { if (t.total > 0) { tot[t.payment_method] = (tot[t.payment_method] || 0) + t.total; cnt[t.payment_method] = (cnt[t.payment_method] || 0) + 1; } else if (t.total < 0) refund += -t.total; });
      const all = Object.values(tot).reduce((a, b) => a + b, 0);
      const key = (t) => (P.mode === 'year' ? t.created.slice(0, 7) : P.mode === 'month' ? t.created.slice(0, 10) : t.created.slice(11, 13));
      const g = {}; cache.forEach((t) => { if (t.total <= 0) return; const k = key(t); const a = (g[k] = g[k] || { k, total: 0 }); a[t.payment_method] = (a[t.payment_method] || 0) + t.total; a.total += t.total; });
      const rows = Object.values(g).sort((a, b) => a.k.localeCompare(b.k));
      const lab = (k) => (P.mode === 'year' ? BULAN[+k.slice(5, 7) - 1] : P.mode === 'month' ? fmtDate(k) : `Jam ${k}.00`);
      body.innerHTML = `<div class="stats">${stat('Total diterima', rupiah(all), P.label, 'hero')}${PAY_KEYS.map((k) => stat(payLabel(k), rupiah(tot[k] || 0), `${fmtNum(cnt[k] || 0)} transaksi${all ? ' · ' + Math.round(((tot[k] || 0) / all) * 100) + '%' : ''}`)).join('')}</div>
        ${refund ? `<div class="ntf-warn" style="margin-bottom:12px">${icon('info')}<span>Uang dikembalikan ke pelanggan karena retur: <b>${rupiah(refund)}</b>. Uang tunai di laci seharusnya: <b>${rupiah((tot.cash || 0) - refund)}</b>.</span></div>` : `<p class="small muted" style="margin:0 0 12px">Uang tunai yang seharusnya ada di laci: <b>${rupiah(tot.cash || 0)}</b> (di luar modal awal).</p>`}
        <div class="toolbar"><span class="grow bold">${P.mode === 'year' ? 'Per bulan' : P.mode === 'month' ? 'Per hari' : 'Per jam'}</span><button class="btn" data-xls>${icon('download')}Excel</button></div>
        ${table([{ label: P.mode === 'day' ? 'Jam' : P.mode === 'month' ? 'Tanggal' : 'Bulan', get: (r) => lab(r.k) }, ...PAY_KEYS.map((k) => ({ label: payLabel(k), num: true, get: (r) => (r[k] ? rupiah(r[k]) : '-') })), { label: 'Total', num: true, html: (r) => `<b>${rupiah(r.total)}</b>` }], rows, { empty: 'Belum ada pembayaran.', maxH: '56vh', foot: ['Total', ...PAY_KEYS.map((k) => rupiah(tot[k] || 0)), `<b>${rupiah(all)}</b>`] })}`;
      $('[data-xls]', body).onclick = () => downloadXLS(`pembayaran_${P.from}_${P.to}.xls`, rows, [{ label: 'Periode', get: (r) => lab(r.k) }, ...PAY_KEYS.map((k) => ({ label: payLabel(k), get: (r) => r[k] || 0 })), { label: 'Total', key: 'total' }], 'Rekap pembayaran ' + P.label);
    }
  };

  // ---------------------------------------------------------------- 6. MEMBER
  R.member = () => {
    const now = new Date(); let yr = now.getFullYear(), half = now.getMonth() < 6 ? 1 : 2, view = 'rank';
    const years = []; for (let y = yr; y >= 2020; y--) years.push(y);
    hd.insertAdjacentHTML('beforeend', `<div class="row wrap pctl" data-sem><select class="input" data-y style="width:auto">${years.map((y) => `<option>${y}</option>`).join('')}</select><div class="seg"><button data-hf="1">Semester 1 (Jan–Jun)</button><button data-hf="2">Semester 2 (Jul–Des)</button></div></div>`);
    const sb = $('[data-sem]', hd);
    const mark = () => $$('[data-hf]', sb).forEach((b) => b.classList.toggle('on', +b.dataset.hf === half));
    sb.onclick = (e) => { const b = e.target.closest('[data-hf]'); if (b) { half = +b.dataset.hf; mark(); load(); } };
    $('[data-y]', sb).onchange = (e) => { yr = +e.target.value; load(); };
    const load = async () => {
      loading();
      try {
        const [d, members] = await Promise.all([api('report_members', { year: yr, half }), admin ? db.list('members') : Promise.resolve([])]);
        const label = `Semester ${half} ${yr}`, sum = d.ranking.reduce((s, r) => s + r.total, 0), n = d.ranking.reduce((s, r) => s + r.n, 0);
        body.innerHTML = `<div class="stats">${stat('Member berbelanja', fmtNum(d.ranking.length), label, 'hero')}${stat('Belanja member', rupiah(sum), d.all_sales ? Math.round((sum / d.all_sales) * 100) + '% dari omzet' : '')}${stat('Transaksi member', fmtNum(n), d.all_tx ? Math.round((n / d.all_tx) * 100) + '% dari semua transaksi' : '')}${stat('Member terdaftar', fmtNum(d.members_total))}</div>
          <div class="toolbar">${tabs([['rank', 'Belanja terbanyak'], ['buy', 'Pembelian member']], view)}<span class="grow"></span><button class="btn" data-xls>${icon('download')}Excel</button></div><div data-v></div>`;
        const show = () => {
          $('[data-v]', body).innerHTML = view === 'rank' ? table([{ label: 'Peringkat', html: (r, i) => (i < 3 ? `<span class="chip gold">${icon('star')} ${i + 1}</span>` : i + 1) }, { label: 'Member', html: (r) => `<b>${esc(r.name)}</b><div class="small muted">${esc(r.phone || '')}</div>` }, { label: 'Transaksi', num: true, get: (r) => r.n }, { label: 'Barang', num: true, get: (r) => r.items }, { label: 'Total belanja', num: true, html: (r) => `<b>${rupiah(r.total)}</b>` }, { label: 'Terakhir', get: (r) => fmtDate(r.last) }, { label: 'Poin', num: true, get: (r) => fmtNum(r.points) },
            ...(admin ? [{ label: 'Voucher', html: (r) => { const m = members.find((x) => x.id === r.id); return m ? (m.voucher_amount > 0 ? `<span class="chip ${m.voucher_used ? '' : 'green'}">${rupiah(m.voucher_amount)}${m.voucher_used ? ' · terpakai' : ''}</span> ` : '') + `<button class="btn sm" data-vc="${r.id}">Atur</button>` : '-'; } }] : [])], d.ranking, { empty: 'Belum ada member berbelanja pada semester ini.', emptyIcon: 'member', maxH: '58vh' })
            : table([{ label: 'Waktu', get: (t) => fmtDT(t.created) }, { label: 'Invoice', key: 'invoice' }, { label: 'Member', html: (t) => `<b>${esc(t.member)}</b>` }, { label: 'Barang', num: true, get: (t) => t.items }, { label: 'Total', num: true, get: (t) => rupiah(t.total) }, { label: 'Poin', num: true, get: (t) => (t.points ? '+' + t.points : '-') }, { label: 'Kasir', key: 'cashier' }], d.purchases, { empty: 'Belum ada pembelian member pada semester ini.', maxH: '58vh' });
        };
        bindTabs(body, (v) => { view = v; show(); }); show();
        $('[data-xls]', body).onclick = () => (view === 'rank' ? downloadXLS(`member_terbanyak_${yr}_S${half}.xls`, d.ranking.map((r, i) => ({ ...r, rank: i + 1 })), [{ label: 'Peringkat', key: 'rank' }, { label: 'Member', key: 'name' }, { label: 'Telepon', key: 'phone' }, { label: 'Transaksi', key: 'n' }, { label: 'Total belanja', key: 'total' }, { label: 'Terakhir', key: 'last' }, { label: 'Poin', key: 'points' }], 'Member belanja terbanyak ' + label) : downloadXLS(`pembelian_member_${yr}_S${half}.xls`, d.purchases, [{ label: 'Waktu', key: 'created' }, { label: 'Invoice', key: 'invoice' }, { label: 'Member', key: 'member' }, { label: 'Barang', key: 'items' }, { label: 'Total', key: 'total' }, { label: 'Poin', key: 'points' }, { label: 'Kasir', key: 'cashier' }], 'Pembelian member ' + label));
        body.onclick = (e) => {
          const b = e.target.closest('[data-vc]'); if (!b || !admin) return;
          const mem = members.find((x) => x.id === +b.dataset.vc);
          crudModal({ title: 'Voucher untuk ' + mem.name, fields: field('Nominal voucher (Rp)', 'voucher_amount', mem.voucher_amount || '', { numeric: true, hint: 'Hadiah untuk member terbaik. Isi 0 untuk menghapus. Terpotong otomatis satu kali di kasir.' }), onSave: async (v) => { await db.update('members', mem.id, { voucher_amount: v.voucher_amount, voucher_used: false }); toast('Voucher disimpan', mem.name, 'ok'); load(); } });
        };
      } catch (e) { failed(e); }
    };
    $('[data-y]', sb).value = yr; mark(); load();
  };

  // ---------------------------------------------------------------- 7. PEGAWAI
  R.pegawai = () => {
    let P, view = 'absen';
    const load = async (p) => {
      P = p; loading();
      try {
        const [att, users, kom] = await Promise.all([db.list('attendance', { from: p.from, to: p.to, order: 'created', limit: 20000 }), admin ? api('users_list') : Promise.resolve([App.user]), api('report_commission', { from: p.from, to: p.to })]);
        draw(att, users.filter((u) => u.active !== false && (u.role === 'kasir' || att.some((a) => a.user_id === u.id) || !admin)), kom);
      } catch (e) { failed(e); }
    };
    ctlBox(['day', 'month'], 'month', load);
    function draw(att, users, kom) {
      const days = []; for (let d = new Date(P.from); ymd(d) <= P.to && ymd(d) <= ymd(); d = addDays(d, 1)) days.push(ymd(d));
      const rows = []; days.forEach((d) => users.forEach((u) => { const r = att.filter((a) => a.user_id === u.id && a.created.slice(0, 10) === d); rows.push({ d, u, i: r.find((a) => a.type === 'in'), o: r.find((a) => a.type === 'out') }); }));
      const sum = users.map((u) => { const r = rows.filter((x) => x.u.id === u.id); return { u, hadir: r.filter((x) => x.i).length, telat: r.filter((x) => x.i && x.i.is_late).length, menit: r.reduce((s, x) => s + (x.i?.late_minutes || 0), 0), absen: r.filter((x) => !x.i && x.d < ymd()).length, jam: r.reduce((s, x) => s + (x.i && x.o ? (parseDT(x.o.created) - parseDT(x.i.created)) / 3600000 : 0), 0) }; });
      const dur = (i, o) => { if (!i || !o) return '-'; const m = Math.round((parseDT(o.created) - parseDT(i.created)) / 60000); return `${Math.floor(m / 60)}j ${m % 60}m`; };
      const loc = (a) => (a && a.lat ? ` <a href="https://maps.google.com/?q=${a.lat},${a.lng}" target="_blank" rel="noopener" class="small">${icon('pin')}</a>` : '');
      const kTot = kom.sales.reduce((s, x) => s + x.commission, 0);
      body.innerHTML = `<div class="stats">${stat('Hari hadir', fmtNum(sum.reduce((s, x) => s + x.hadir, 0)), P.label, 'hero')}${stat('Terlambat', fmtNum(sum.reduce((s, x) => s + x.telat, 0)) + '×')}${stat('Tidak masuk', fmtNum(sum.reduce((s, x) => s + x.absen, 0)) + ' hari')}${stat('Komisi', rupiah(kTot), kom.self_only ? 'milik Anda' : 'semua sales')}</div>
        <div class="toolbar">${tabs([['absen', 'Waktu absen'], ['rekap', 'Rekap absen'], ['komisi', 'Komisi']], view)}<span class="grow"></span><button class="btn" data-xls>${icon('download')}Excel</button></div><div data-v></div>`;
      const show = () => {
        const V2 = $('[data-v]', body);
        if (view === 'absen') V2.innerHTML = table([{ label: 'Tanggal', get: (r) => fmtDate(r.d) }, ...(admin ? [{ label: 'Pegawai', html: (r) => `<b>${esc(r.u.name)}</b>` }] : []), { label: 'Masuk', html: (r) => (r.i ? fmtTime(r.i.created) + loc(r.i) : '-') }, { label: 'Pulang', html: (r) => (r.o ? fmtTime(r.o.created) + loc(r.o) : '-') }, { label: 'Durasi', get: (r) => dur(r.i, r.o) }, { label: 'Status', html: (r) => (!r.i ? (r.d < ymd() ? '<span class="chip red">Tidak masuk</span>' : '<span class="chip">Belum absen</span>') : r.i.is_late ? `<span class="chip amber">Terlambat ${r.i.late_minutes}m</span>` : '<span class="chip green">Tepat waktu</span>') }], [...rows].reverse(), { empty: 'Belum ada data absensi.', maxH: '56vh' });
        else if (view === 'rekap') V2.innerHTML = table([{ label: 'Pegawai', html: (s) => `<b>${esc(s.u.name)}</b>` }, { label: 'Hadir', num: true, get: (s) => s.hadir + ' hari' }, { label: 'Terlambat', num: true, html: (s) => (s.telat ? `<span class="chip amber">${s.telat}× · ${s.menit} menit</span>` : '0') }, { label: 'Tidak masuk', num: true, html: (s) => (s.absen ? `<span class="chip red">${s.absen} hari</span>` : '0') }, { label: 'Total jam kerja', num: true, get: (s) => Math.round(s.jam * 10) / 10 + ' jam' }, { label: 'Kehadiran', num: true, html: (s) => { const d = s.hadir + s.absen; return d ? `<b>${Math.round((s.hadir / d) * 100)}%</b>` : '-'; } }], sum, { empty: 'Belum ada pegawai.' });
        else V2.innerHTML = (kom.sales.length ? kom.sales.map((s) => `<div class="panel" style="margin-bottom:12px"><div class="panel-h"><div><h3>${esc(s.name)} <span class="chip blue">${esc(s.code)}</span></h3><span class="small muted">${s.n} transaksi · ${fmtNum(s.items)} barang · omzet ${rupiah(s.omzet)}</span></div><b class="money" style="font-size:18px">${rupiah(s.commission)}</b></div>${table([{ label: 'Waktu', get: (t) => fmtDT(t.created) }, { label: 'Invoice', key: 'invoice' }, { label: 'Barang', num: true, get: (t) => t.items }, { label: 'Total', num: true, get: (t) => rupiah(t.total) }, { label: 'Komisi', num: true, get: (t) => rupiah(t.commission) }], s.tx, { empty: 'Belum ada transaksi dengan kode sales ini.', maxH: '40vh' })}</div>`).join('')
          : `<div class="panel panel-b muted">${kom.self_only ? 'Belum ada data komisi untuk Anda. Komisi tercatat bila nama sales di menu Sales & komisi sama dengan nama akun Anda, dan kode sales dimasukkan saat pembayaran.' : 'Belum ada sales. Tambahkan di menu Sales & komisi.'}</div>`);
      };
      bindTabs(body, (v) => { view = v; show(); }); show();
      $('[data-xls]', body).onclick = () => {
        if (view === 'komisi') downloadXLS(`komisi_${P.from}_${P.to}.xls`, kom.sales.flatMap((s) => s.tx.map((t) => ({ ...t, sales: s.name }))), [{ label: 'Sales', key: 'sales' }, { label: 'Waktu', key: 'created' }, { label: 'Invoice', key: 'invoice' }, { label: 'Total', key: 'total' }, { label: 'Komisi', key: 'commission' }], 'Komisi ' + P.label);
        else if (view === 'rekap') downloadXLS(`rekap_absen_${P.from}_${P.to}.xls`, sum, [{ label: 'Pegawai', get: (s) => s.u.name }, { label: 'Hadir (hari)', key: 'hadir' }, { label: 'Terlambat (kali)', key: 'telat' }, { label: 'Terlambat (menit)', key: 'menit' }, { label: 'Tidak masuk (hari)', key: 'absen' }, { label: 'Jam kerja', get: (s) => Math.round(s.jam * 10) / 10 }], 'Rekap absen ' + P.label);
        else downloadXLS(`absensi_${P.from}_${P.to}.xls`, rows, [{ label: 'Tanggal', get: (r) => r.d }, { label: 'Pegawai', get: (r) => r.u.name }, { label: 'Masuk', get: (r) => (r.i ? fmtTime(r.i.created) : '') }, { label: 'Pulang', get: (r) => (r.o ? fmtTime(r.o.created) : '') }, { label: 'Durasi', get: (r) => dur(r.i, r.o) }, { label: 'Terlambat (menit)', get: (r) => r.i?.late_minutes || 0 }], 'Absensi ' + P.label);
      };
    }
  };

  // ---------------------------------------------------------------- 8. RETUR
  R.retur = () => {
    let P, cache = [];
    const load = async (p) => { P = p; loading(); try { cache = (await db.list('transactions', { from: p.from, to: p.to, limit: 20000 })).filter((t) => t.return_ref); draw(); } catch (e) { failed(e); } };
    if (admin) ctlBox(['day', 'month', 'year'], 'month', load);
    else { hd.insertAdjacentHTML('beforeend', `<span class="chip blue">Hari ini · ${fmtDate(ymd())}</span>`); load({ from: ymd(), to: ymd(), label: 'Hari ini', mode: 'day' }); }
    function draw() {
      const pcs = cache.reduce((s, t) => s + (t.return_items || []).reduce((a, i) => a + i.qty, 0), 0), val = cache.reduce((s, t) => s + (t.return_amount || 0), 0), refund = cache.reduce((s, t) => s + (t.total < 0 ? -t.total : 0), 0), tukar = cache.filter((t) => (t.items || []).length).length;
      const reasons = {}; cache.forEach((t) => { const r = (t.note || 'Tanpa keterangan').trim(); reasons[r] = (reasons[r] || 0) + 1; });
      body.innerHTML = `<div class="stats">${stat('Retur & tukar', fmtNum(cache.length) + '×', P.label, 'hero')}${stat('Barang kembali', fmtNum(pcs) + ' pcs')}${stat('Nilai barang', rupiah(val))}${stat('Uang dikembalikan', rupiah(refund), `${tukar}× tukar barang`)}</div>
        <div class="toolbar"><span class="grow">${Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `<span class="chip">${esc(k)} · ${v}</span>`).join(' ')}</span><button class="btn" data-xls>${icon('download')}Excel</button></div>
        ${table([{ label: 'Waktu', get: (t) => fmtDT(t.created) }, { label: 'Invoice', html: (t) => `<b>${esc(t.invoice)}</b><div class="small muted">dari ${esc(t.return_ref)}</div>` }, { label: 'Dikembalikan', html: (t) => (t.return_items || []).map((i) => `${esc(i.name)} ×${i.qty}`).join('<br>') }, { label: 'Pengganti', html: (t) => (t.items || []).map((i) => `${esc(i.name)} ×${i.qty}`).join('<br>') || '<span class="muted">—</span>' }, { label: 'Nilai retur', num: true, get: (t) => rupiah(t.return_amount) }, { label: 'Selisih', num: true, html: (t) => (t.total < 0 ? `<span class="danger">Kembali ${rupiah(-t.total)}</span>` : t.total > 0 ? `<span class="money">Bayar ${rupiah(t.total)}</span>` : 'Pas') }, { label: 'Kasir', key: 'cashier' }, { label: 'Alasan', get: (t) => t.note || '-' }], cache, { empty: 'Tidak ada retur pada periode ini.', emptyIcon: 'rotate', maxH: '58vh' })}`;
      $('[data-xls]', body).onclick = () => downloadXLS(`retur_${P.from}_${P.to}.xls`, cache, [{ label: 'Waktu', key: 'created' }, { label: 'Invoice', key: 'invoice' }, { label: 'Dari invoice', key: 'return_ref' }, { label: 'Barang dikembalikan', get: (t) => (t.return_items || []).map((i) => `${i.name} x${i.qty}`).join('; ') }, { label: 'Barang pengganti', get: (t) => (t.items || []).map((i) => `${i.name} x${i.qty}`).join('; ') }, { label: 'Nilai retur', key: 'return_amount' }, { label: 'Selisih', key: 'total' }, { label: 'Kasir', key: 'cashier' }, { label: 'Alasan', key: 'note' }], 'Laporan retur ' + P.label);
    }
  };

  // ---------------------------------------------------------------- 9. BARANG REJECT
  const REASONS = ['Cacat jahitan', 'Noda / kotor', 'Robek / bolong', 'Luntur / pudar', 'Salah ukuran dari supplier', 'Hilang', 'Lainnya'];
  R.reject = () => {
    let P, cache = [];
    const load = async (p) => { P = p; loading(); try { cache = await db.list('rejects', { from: p.from, to: p.to, limit: 20000 }); draw(); } catch (e) { failed(e); } };
    ctlBox(['day', 'month', 'year'], 'month', load);
    function draw() {
      const pcs = cache.reduce((s, r) => s + r.qty, 0), val = cache.reduce((s, r) => s + r.qty * r.cost, 0);
      const why = {}; cache.forEach((r) => { why[r.reason] = (why[r.reason] || 0) + r.qty; });
      body.innerHTML = `<div class="stats">${stat('Barang reject', fmtNum(pcs) + ' pcs', P.label, 'hero')}${stat('Dicatat', fmtNum(cache.length) + '×')}${admin ? stat('Kerugian (modal)', `<span class="danger">${rupiah(val)}</span>`, 'masuk ke laporan laba rugi') : ''}</div>
        <div class="toolbar"><button class="btn primary" data-add>${icon('plus')}Tambah barang reject</button><span class="grow">${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip">${esc(k)} · ${v}</span>`).join(' ')}</span><button class="btn" data-xls>${icon('download')}Excel</button></div>
        ${!admin ? '<p class="small muted" style="margin:0 0 10px">Data yang sudah ditambahkan hanya bisa dihapus oleh admin. Periksa kembali sebelum menyimpan.</p>' : ''}
        ${table([{ label: 'Waktu', get: (r) => fmtDT(r.created) }, { label: 'Barang', html: (r) => `<b>${esc(r.product_name)}</b><div class="small muted">${esc(r.barcode || '')}</div>` }, { label: 'Jumlah', num: true, html: (r) => `<b>${r.qty}</b>` }, { label: 'Alasan', html: (r) => `<span class="chip amber">${esc(r.reason)}</span>${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}` }, ...(admin ? [{ label: 'Kerugian', num: true, get: (r) => rupiah(r.cost * r.qty) }] : []), { label: 'Dicatat oleh', key: 'user_name' }, ...(admin ? [{ label: '', cls: 'right', html: (r) => `<button class="btn sm icon danger" data-del="${r.id}" aria-label="Hapus" title="Hapus & kembalikan stok">${icon('trash')}</button>` }] : [])], cache, { empty: 'Belum ada barang reject pada periode ini.', emptyIcon: 'box', maxH: '56vh' })}`;
      $('[data-add]', body).onclick = rejectModal;
      $('[data-xls]', body).onclick = () => downloadXLS(`reject_${P.from}_${P.to}.xls`, cache, [{ label: 'Waktu', key: 'created' }, { label: 'Barang', key: 'product_name' }, { label: 'Barcode', key: 'barcode' }, { label: 'Kategori', key: 'category' }, { label: 'Jumlah', key: 'qty' }, { label: 'Alasan', key: 'reason' }, { label: 'Catatan', key: 'note' }, ...(admin ? [{ label: 'Harga modal', key: 'cost' }, { label: 'Kerugian', get: (r) => r.cost * r.qty }] : []), { label: 'Dicatat oleh', key: 'user_name' }], 'Barang reject ' + P.label);
      body.onclick = async (e) => {
        const d = e.target.closest('[data-del]'); if (!d) return;
        const r = cache.find((x) => x.id === +d.dataset.del);
        if (await confirmBox('Hapus data reject?', `${r.product_name} ×${r.qty} — stok akan dikembalikan.`, 'Hapus')) { try { await api('reject_delete', { id: r.id }); toast('Data reject dihapus', 'Stok dikembalikan.', 'ok'); load(P); } catch (ex) { toastErr(ex); } }
      };
    }
    async function rejectModal() {
      let products = []; try { products = (await db.list('products')).filter((p) => p.stock > 0); } catch (e) { toastErr(e); return; }
      let pick = null, reason = '';
      const m = modal({ title: 'Tambah barang reject', size: 'wide', body: `<div class="stack">
        <div class="search">${icon('search')}<input class="input" data-s placeholder="Cari nama, warna, ukuran, atau scan barcode…" autocomplete="off"></div><div class="pick rj-list" data-res></div>
        <div data-sel></div>
        <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Alasan</div><div class="quick" data-why>${REASONS.map((r) => `<button type="button" data-w="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
        <div class="grid2">${field('Jumlah (pcs)', 'qty', '1', { numeric: true })}${field('Catatan', 'note', '', { placeholder: 'mis. noda di lengan kanan' })}</div></div>`,
        foot: '<button class="btn" data-x>Batal</button><button class="btn primary" data-ok>Simpan</button>' });
      const res = (q) => { q = q.toLowerCase().trim(); const l = products.filter((p) => !q || [p.name, p.barcode, p.model, p.color, p.size].join(' ').toLowerCase().includes(q)).slice(0, 30); m.$('[data-res]').innerHTML = l.map((p) => `<button data-p="${p.id}" class="${pick && pick.id === p.id ? 'on' : ''}"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.barcode || '')}</div></div><span class="chip">stok ${p.stock}</span></button>`).join('') || emptyState('Barang tidak ditemukan.'); };
      res('');
      m.$('[data-s]').oninput = (e) => { const v = e.target.value.trim(); const ex = products.find((p) => p.barcode && p.barcode === v); if (ex) { pick = ex; m.$('[data-sel]').innerHTML = `<div class="chip green">Dipilih: ${esc(ex.name)} · stok ${ex.stock}</div>`; } res(v); };
      m.$('[data-res]').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; pick = products.find((p) => p.id === +b.dataset.p); m.$('[data-sel]').innerHTML = `<div class="chip green">Dipilih: ${esc(pick.name)} · stok ${pick.stock}</div>`; res(m.$('[data-s]').value); };
      m.$('[data-why]').onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; reason = b.dataset.w; m.$$('[data-w]').forEach((x) => x.classList.toggle('on', x === b)); };
      m.$('[data-x]').onclick = () => m.close();
      m.$('[data-ok]').onclick = async () => {
        const qty = num(m.$('[name=qty]').value);
        if (!pick) { toast('Pilih barangnya dulu', '', 'err'); return; }
        if (!reason) { toast('Pilih alasan reject', '', 'err'); return; }
        if (!(qty > 0) || qty > pick.stock) { toast('Jumlah tidak valid', `Stok tersedia ${pick.stock}`, 'err'); return; }
        if (!admin && !(await confirmBox('Simpan barang reject?', `${pick.name} ×${qty} (${reason}). Setelah disimpan hanya admin yang bisa menghapus.`, 'Simpan'))) return;
        try { await api('reject_add', { product_id: pick.id, qty, reason, note: m.$('[name=note]').value }); toast('Barang reject dicatat', `${pick.name} ×${qty} · stok dikurangi`, 'ok'); m.close(); load(P); } catch (ex) { toastErr(ex); }
      };
      setTimeout(() => m.$('[data-s]').focus(), 50);
    }
  };

  go(sub);
};

// =====================================================================
//  PRODUK & STOK
// =====================================================================
// ---------------------------------------------------------------- fashion: model, varian, matriks stok, foto
function groupProducts(products) {
  const map = new Map();
  products.forEach((p) => {
    const k = p.model ? 'm:' + p.model : 'p:' + p.id;
    let g = map.get(k);
    if (!g) { g = { key: k, model: p.model || '', name: p.model || p.name, category: p.category, image: '', items: [] }; map.set(k, g); }
    g.items.push(p); if (!g.image && p.image) g.image = p.image;
  });
  return [...map.values()].map((g) => {
    g.stock = g.items.reduce((s, p) => s + Math.max(0, p.stock), 0);
    g.colors = [...new Set(g.items.map((p) => p.color).filter(Boolean))];
    g.sizes = sortSizes([...new Set(g.items.map((p) => p.size).filter(Boolean))]);
    g.low = g.items.some((p) => p.stock > 0 && p.stock <= 2); g.out = g.items.some((p) => p.stock <= 0);
    return g;
  });
}
// input "chip" untuk daftar warna / ukuran
function chipInput(root, initial = [], onChange = () => {}) {
  let list = [...initial];
  const draw = () => {
    root.innerHTML = list.map((x, i) => `<span>${swatch(x) && root.dataset.kind === 'color' ? swatch(x) : ''}${esc(x)}<button type="button" data-rm="${i}" aria-label="Hapus">×</button></span>`).join('') + `<input placeholder="${esc(root.dataset.ph || 'Ketik lalu Enter')}" aria-label="${esc(root.dataset.ph || '')}">`;
    const inp = root.querySelector('input');
    inp.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) { e.preventDefault(); add(inp.value); } else if (e.key === 'Backspace' && !inp.value && list.length) { list.pop(); draw(); onChange(list); root.querySelector('input').focus(); } };
    inp.onblur = () => { if (inp.value.trim()) add(inp.value); };
  };
  const add = (v) => { String(v).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!list.some((y) => y.toLowerCase() === x.toLowerCase())) list.push(x); }); draw(); onChange(list); const i = root.querySelector('input'); if (i) i.focus(); };
  root.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { list.splice(+b.dataset.rm, 1); draw(); onChange(list); } else root.querySelector('input').focus(); };
  draw();
  return { get: () => list, set: (l) => { list = [...l]; draw(); onChange(list); }, add };
}
const COMMON_COLORS = ['Hitam', 'Putih', 'Broken White', 'Cream', 'Mocca', 'Navy', 'Sage', 'Dusty Pink', 'Maroon', 'Abu', 'Biru Muda', 'Coklat'];
// Tambah model baru (dengan varian) atau tambah warna/ukuran pada model yang sudah ada
function productModelModal({ pin = '', group = null, categories = [], barcode = '', onSaved = () => {} } = {}) {
  const ex = group ? group.items[0] : {};
  const existing = new Set(group ? group.items.map((p) => p.color + '|' + p.size) : []);
  let mode = group && !group.model ? 'single' : 'variant';
  const m = modal({ title: group ? 'Tambah warna / ukuran: ' + group.name : 'Barang baru', size: 'wide', body: `<div class="stack">
    ${group ? '' : `<div class="seg" data-mode><button data-md="variant" class="on">Dengan varian warna / ukuran</button><button data-md="single">Barang tunggal</button></div>`}
    <div class="grid2" data-f>
      ${field(mode === 'variant' ? 'Nama model' : 'Nama barang', 'model', group ? group.name : '', { placeholder: 'mis. Kemeja Kantor Basic', attrs: group ? 'readonly' : '' })}
      ${field('Kategori', 'category', ex.category || '', { attrs: 'list="pm-cats"', placeholder: 'Kemeja, Rok, Gamis, Hijab…' })}
      ${field('Harga beli (modal)', 'cost', ex.cost ?? '', { numeric: true })}${field('Harga jual', 'price', ex.price ?? '', { numeric: true })}
      ${field('Potongan harga / pcs', 'discount', ex.discount ?? '', { numeric: true, hint: 'Harga coret otomatis di kasir. 0 = tidak ada.' })}${field('Komisi sales / pcs', 'commission', ex.commission ?? '', { numeric: true })}
    </div><datalist id="pm-cats">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
    <div data-single class="grid2 hidden">${field('Barcode / kode', 'barcode', barcode, { hint: 'Kosongkan — dibuat otomatis untuk label.' })}${field('Stok awal', 'stock', '', { numeric: true })}</div>
    <div data-var>
      <div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Ukuran</div>
      <div class="quick" style="margin-bottom:8px">${sizeSets().map((z) => `<button type="button" data-ss="${esc(z)}">${esc(z)}</button>`).join('')}</div>
      <div class="chipin" data-sizes data-ph="Tambah ukuran, mis. M lalu Enter"></div>
      <div class="small bold" style="color:var(--ink-2);margin:14px 0 6px">Warna</div>
      <div class="quick" style="margin-bottom:8px">${COMMON_COLORS.map((c) => `<button type="button" data-cc="${esc(c)}">${swatch(c)} ${esc(c)}</button>`).join('')}</div>
      <div class="chipin" data-colors data-kind="color" data-ph="Tambah warna, mis. Sage lalu Enter"></div>
      <div class="small bold" style="color:var(--ink-2);margin:14px 0 6px">Stok awal per varian</div>
      <div class="tbl-wrap" style="max-height:320px" data-grid></div>
      <p class="small muted" style="margin:6px 0 0">Setiap varian otomatis mendapat barcode sendiri untuk cetak label.</p>
    </div></div>`, foot: '<button class="btn" data-x>Batal</button><button class="btn primary" data-ok>Simpan</button>' });
  const stockVal = {};
  const drawGrid = () => {
    const cs = colors.get().length ? colors.get() : [''], zs = sizes.get().length ? sortSizes(sizes.get()) : [''];
    m.$('[data-grid]').querySelectorAll('input[data-k]').forEach((i) => { stockVal[i.dataset.k] = i.value; });
    m.$('[data-grid]').innerHTML = `<table class="matrix"><thead><tr><th>${colors.get().length ? 'Warna' : ''} \\ ${sizes.get().length ? 'Ukuran' : ''}</th>${zs.map((z) => `<th>${esc(z || 'Stok')}</th>`).join('')}</tr></thead><tbody>${cs.map((c) => `<tr><td>${c ? swatch(c) + ' ' + esc(c) : '—'}</td>${zs.map((z) => { const k = c + '|' + z; return existing.has(k) ? '<td><span class="chip">sudah ada</span></td>' : `<td><input data-k="${esc(k)}" inputmode="numeric" value="${esc(stockVal[k] ?? '')}" placeholder="0"></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  };
  const sizes = chipInput(m.$('[data-sizes]'), group ? group.sizes : [], drawGrid);
  const colors = chipInput(m.$('[data-colors]'), group ? group.colors : [], drawGrid);
  drawGrid();
  m.$$('[data-ss]').forEach((b) => (b.onclick = () => sizes.set([...new Set([...sizes.get(), ...b.dataset.ss.split(',').map((x) => x.trim())])])));
  m.$$('[data-cc]').forEach((b) => (b.onclick = () => colors.add(b.dataset.cc)));
  const setMode = (md) => { mode = md; m.$('[data-single]').classList.toggle('hidden', md !== 'single'); m.$('[data-var]').classList.toggle('hidden', md === 'single'); const l = m.$('[name=model]').closest('label'); if (l && l.firstChild) l.firstChild.textContent = md === 'single' ? 'Nama barang' : 'Nama model'; };
  setMode(mode);
  const seg = m.$('[data-mode]'); if (seg) seg.onclick = (e) => { const b = e.target.closest('[data-md]'); if (!b) return; m.$$('[data-md]').forEach((x) => x.classList.toggle('on', x === b)); setMode(b.dataset.md); };
  m.$('[data-x]').onclick = () => m.close();
  m.$('[data-ok]').onclick = async () => {
    const v = formValues(m.$('[data-f]'));
    if (!v.model) { toast('Nama wajib diisi', '', 'err'); return; }
    if (!(v.price > 0)) { toast('Harga jual wajib diisi', '', 'err'); return; }
    const btn = m.$('[data-ok]'); btn.disabled = true;
    try {
      if (mode === 'single') {
        const s = formValues(m.$('[data-single]'));
        const rec = await db.create('products', { name: v.model, category: v.category, cost: v.cost, price: v.price, discount: v.discount, commission: v.commission, barcode: s.barcode, stock: s.stock }, { pin, auto_barcode: true });
        toast('Barang ditambahkan', rec.name, 'ok'); m.close(); onSaved([rec]); return;
      }
      if (!sizes.get().length && !colors.get().length) { toast('Isi minimal satu ukuran atau warna', 'Atau pilih "Barang tunggal".', 'err'); btn.disabled = false; return; }
      drawGrid();
      const stocks = {}; Object.entries(stockVal).forEach(([k, val]) => { if (num(val) > 0) stocks[k] = num(val); });
      const r = await api('variants_save', { pin, model: v.model, category: v.category, cost: v.cost, price: v.price, discount: v.discount, commission: v.commission, colors: colors.get(), sizes: sizes.get(), stocks });
      toast(group ? 'Varian ditambahkan' : 'Model disimpan', `${r.created} varian baru${r.updated ? ', ' + r.updated + ' diperbarui' : ''}`, 'ok'); m.close(); onSaved(r.items);
    } catch (e) { toastErr(e); btn.disabled = false; }
  };
  return m;
}
// matriks stok warna × ukuran
function stockMatrixModal(g, onSaved) {
  const colors = g.colors.length ? g.colors : [''], sizes = g.sizes.length ? g.sizes : [''];
  const cell = (c, z) => g.items.find((p) => p.color === c && p.size === z);
  const m = modal({ title: 'Stok: ' + g.name, size: 'wide', body: `<p class="muted" style="margin-top:0">Ubah angka sesuai stok fisik atau tambahkan kiriman baru. Selisih otomatis tercatat di riwayat stok.</p>
    <div class="row wrap" style="margin-bottom:10px"><span class="small muted">Isi cepat:</span><button class="btn sm" data-addall="1">+1 semua</button><button class="btn sm" data-addall="3">+3 semua</button><button class="btn sm" data-addall="6">+6 semua</button></div>
    <div class="tbl-wrap" style="max-height:52vh"><table class="matrix"><thead><tr><th>Warna \\ Ukuran</th>${sizes.map((z) => `<th>${esc(z || 'Stok')}</th>`).join('')}<th>Total</th></tr></thead><tbody>${colors.map((c) => `<tr><td>${c ? swatch(c) + ' ' + esc(c) : '—'}</td>${sizes.map((z) => { const p = cell(c, z); return p ? `<td><input data-id="${p.id}" data-old="${p.stock}" value="${p.stock}" inputmode="numeric" class="${p.stock <= 0 ? 'zero' : ''}" aria-label="Stok ${esc(c)} ${esc(z)}"></td>` : '<td class="muted">—</td>'; }).join('')}<td class="tot" data-rt></td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td>${sizes.map(() => '<td class="tot" data-ct></td>').join('')}<td class="tot" data-gt></td></tr></tfoot></table></div>
    ${field('Keterangan', 'note', '', { placeholder: 'Kiriman konveksi, hasil stok opname…' })}`,
    foot: '<button class="btn" data-plus>' + icon('plus') + 'Warna / ukuran baru</button><button class="btn" data-x>Batal</button><button class="btn primary" data-ok>Simpan stok</button>' });
  const tot = () => {
    const rows = m.$$('tbody tr');
    rows.forEach((tr) => { tr.querySelector('[data-rt]').textContent = [...tr.querySelectorAll('input')].reduce((s, i) => s + num(i.value), 0); });
    m.$$('[data-ct]').forEach((td, k) => { td.textContent = rows.reduce((s, tr) => { const i = tr.children[k + 1].querySelector('input'); return s + (i ? num(i.value) : 0); }, 0); });
    m.$('[data-gt]').textContent = m.$$('input[data-id]').reduce((s, i) => s + num(i.value), 0);
    m.$$('input[data-id]').forEach((i) => { i.classList.toggle('chg', num(i.value) !== +i.dataset.old); i.classList.toggle('zero', num(i.value) <= 0); });
  };
  m.el.addEventListener('input', tot); tot();
  m.$$('[data-addall]').forEach((b) => (b.onclick = () => { m.$$('input[data-id]').forEach((i) => { i.value = num(i.value) + +b.dataset.addall; }); tot(); }));
  m.$('[data-x]').onclick = () => m.close();
  m.$('[data-plus]').onclick = () => { m.close(); productModelModal({ group: g, onSaved }); };
  m.$('[data-ok]').onclick = async () => {
    const items = m.$$('input[data-id]').filter((i) => num(i.value) !== +i.dataset.old).map((i) => ({ id: +i.dataset.id, stock: Math.max(0, num(i.value)) }));
    if (!items.length) { m.close(); return; }
    try { const r = await api('stock_set_bulk', { items, note: m.$('[name=note]').value }); toast('Stok disimpan', r.changed + ' varian diperbarui', 'ok'); m.close(); onSaved(); } catch (e) { toastErr(e); }
  };
}
// foto produk (dipakai semua varian dalam satu model)
async function photoModal(g, onSaved) {
  const m = modal({ title: 'Foto: ' + g.name, body: `<div class="photo-pick">${thumb(g.image, g.name)}<div class="stack" style="gap:8px"><p class="small muted" style="margin:0">Foto tampil di kasir agar pegawai cepat menemukan barang. Gunakan foto tegak (potret). Otomatis dikecilkan sebelum diunggah.</p>
    <label class="btn primary" style="width:max-content">${icon('camera')}Pilih / ambil foto<input type="file" accept="image/*" data-file style="position:absolute;left:-9999px;opacity:0"></label>
    ${g.image ? '<button class="btn danger sm" data-rm style="width:max-content">Hapus foto</button>' : ''}</div></div>` });
  const ids = g.items.map((p) => p.id);
  m.$('[data-file]').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { toast('Mengunggah foto…'); const data = await resizeImage(f, 900); const r = await api('product_image', { ids, data }); toast('Foto disimpan', g.name, 'ok'); m.close(); onSaved(r.image); } catch (ex) { toastErr(ex); }
  };
  const rm = m.$('[data-rm]'); if (rm) rm.onclick = async () => { try { await api('product_image', { ids, remove: true }); toast('Foto dihapus', '', 'ok'); m.close(); onSaved(''); } catch (ex) { toastErr(ex); } };
}

V.produk = async (page) => {
  page.innerHTML = head('Produk & stok', 'Kelola model, varian warna & ukuran, stok, foto, dan label barcode.') + `<div style="margin-bottom:14px">${tabs([['list', 'Daftar barang'], ['moves', 'Riwayat stok'], ['checks', 'Pengajuan cek stok' + (App.pendingChecks ? ` (${App.pendingChecks})` : '')]], 'list')}</div><div data-body></div>`;
  const body = $('[data-body]', page);
  let products = [], groupsL = [], sel = new Set();
  const cats = () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const pform = (p = {}) => `<div class="grid2">${field('Nama barang', 'name', p.name)}${field('Barcode / kode', 'barcode', p.barcode, { hint: 'Kosongkan bila belum punya.' })}${field('Kategori', 'category', p.category, { attrs: 'list="pcats"' })}${field('Stok', 'stock', p.stock ?? '', { numeric: true, hint: p.id ? 'Perubahan stok tercatat di riwayat.' : '' })}${field('Harga beli (modal)', 'cost', p.cost ?? '', { numeric: true })}${field('Harga jual', 'price', p.price ?? '', { numeric: true })}${field('Harga khusus: potongan / pcs', 'discount', p.discount ?? '', { numeric: true, hint: 'Potongan otomatis di kasir. 0 = tidak ada.' })}${field('Komisi sales / pcs', 'commission', p.commission ?? '', { numeric: true })}</div><datalist id="pcats">${cats().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
  const mform = (g) => { const p = g.items[0]; return `<div class="grid2">${field('Nama model', 'model', g.model)}${field('Kategori', 'category', p.category, { attrs: 'list="pcats"' })}${field('Harga beli (modal)', 'cost', p.cost, { numeric: true })}${field('Harga jual', 'price', p.price, { numeric: true })}${field('Potongan harga / pcs', 'discount', p.discount, { numeric: true })}${field('Komisi sales / pcs', 'commission', p.commission, { numeric: true })}</div><p class="small muted">Perubahan berlaku untuk ${g.items.length} varian. Nama barang tiap varian ikut diperbarui.</p><datalist id="pcats">${cats().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`; };

  async function drawList() {
    products = await db.list('products');
    body.innerHTML = `<div class="toolbar"><div class="search">${icon('search')}<input class="input" data-q placeholder="Cari model, warna, barcode…"></div>
      <select class="input" data-cat style="width:auto"><option value="">Semua kategori</option>${cats().map((c) => `<option>${esc(c)}</option>`).join('')}</select>
      <select class="input" data-stk style="width:auto"><option value="">Semua stok</option><option value="low">Ada ukuran menipis</option><option value="out">Ada ukuran habis</option></select>
      <button class="btn primary" data-new>${icon('plus')}Barang baru</button>
      <button class="btn" data-imp>${icon('upload')}Impor</button><button class="btn" data-exp>${icon('download')}Ekspor</button>
      <button class="btn hidden" data-lbl>${icon('barcode')}Cetak label (<span data-n>0</span>)</button></div>
      <div data-stats></div><div data-tbl></div>`;
    const filt = () => { const q = $('[data-q]', body).value.toLowerCase(), c = $('[data-cat]', body).value, s = $('[data-stk]', body).value; groupsL = groupProducts(products); return groupsL.filter((g) => (!c || g.category === c) && (!s || (s === 'low' ? g.low : g.out)) && (!q || g.items.some((p) => [p.name, p.barcode, p.category, p.color, p.size].join(' ').toLowerCase().includes(q)))); };
    const priceTxt = (g) => { const ps = g.items.map((p) => p.price - p.discount), lo = Math.min(...ps), hi = Math.max(...ps); const p = g.items[0]; return (p.discount > 0 && lo === hi ? `<s class="muted small">${rupiah(p.price)}</s> ` : '') + `<b>${lo === hi ? rupiah(lo) : rupiah(lo) + '–' + rupiah(hi)}</b>`; };
    const render = () => {
      const list = filt(), skus = list.flatMap((g) => g.items);
      const val = skus.reduce((s, p) => s + p.cost * Math.max(0, p.stock), 0), units = skus.reduce((s, p) => s + Math.max(0, p.stock), 0);
      $('[data-stats]', body).innerHTML = `<div class="stats">${stat('Model / barang', fmtNum(list.length), fmtNum(skus.length) + ' varian (SKU)')}${stat('Total stok', fmtNum(units) + ' pcs')}${stat('Nilai stok (modal)', rupiah(val))}${stat('Varian habis', fmtNum(skus.filter((p) => p.stock <= 0).length), 'perlu restok / hapus')}</div>`;
      $('[data-tbl]', body).innerHTML = table([
        { label: '', html: (g) => `<input type="checkbox" data-gsel="${esc(g.key)}" ${g.items.every((p) => sel.has(p.id)) ? 'checked' : ''} aria-label="Pilih">` },
        { label: '', cls: 'mrow-img', html: (g) => `<button class="btn ghost" style="padding:0;height:auto" data-photo="${esc(g.key)}" title="Foto">${thumb(g.image, g.name)}</button>` },
        { label: 'Barang', html: (g) => `<b>${esc(g.name)}</b>${g.model ? `<div class="vtags">${g.colors.length ? `<span>${g.colors.length} warna</span>` : ''}${g.sizes.map((z) => { const st = g.items.filter((p) => p.size === z).reduce((s, p) => s + Math.max(0, p.stock), 0); return `<span class="${st <= 0 ? 'o' : st <= 2 ? 'l' : ''}" title="Stok ukuran ${esc(z)}: ${st}">${esc(z)} ${st}</span>`; }).join('')}</div>` : `<div class="small muted">${esc(g.items[0].barcode || 'tanpa barcode')}</div>`}` },
        { label: 'Kategori', get: (g) => g.category || '-' },
        { label: 'Harga jual', num: true, html: priceTxt },
        { label: 'Margin', num: true, html: (g) => { const p = g.items[0]; const mg = p.price - p.discount - p.cost; return `<span class="${mg < 0 ? 'danger' : 'money'}">${rupiah(mg)}</span>`; } },
        { label: 'Stok', num: true, html: (g) => `<span class="chip ${g.stock <= 0 ? 'red' : g.low || g.out ? 'amber' : 'green'}">${g.stock}</span>` },
        { label: '', cls: 'nowrap right', html: (g) => (g.model ? `<button class="btn sm" data-mx="${esc(g.key)}">${icon('box')}Stok</button>` : `<button class="btn sm" data-in="${g.items[0].id}">+ Stok</button> <button class="btn sm" data-out="${g.items[0].id}">− Stok</button>`) + ` <button class="btn sm icon" data-edit="${esc(g.key)}" aria-label="Ubah">${icon('edit')}</button> <button class="btn sm icon danger" data-del="${esc(g.key)}" aria-label="Hapus">${icon('trash')}</button>` },
      ], list, { empty: 'Belum ada barang. Klik "Barang baru" atau impor dari Excel.', maxH: '62vh' });
      $('[data-n]', body).textContent = sel.size; $('[data-lbl]', body).classList.toggle('hidden', !sel.size);
    };
    ['[data-q]', '[data-cat]', '[data-stk]'].forEach((s) => ($(s, body).oninput = render));
    $('[data-new]', body).onclick = () => productModelModal({ categories: cats(), onSaved: drawList });
    $('[data-exp]', body).onclick = () => downloadXLS('produk_' + ymd() + '.xls', filt().flatMap((g) => g.items), [{ label: 'Nama Produk', key: 'name' }, { label: 'Model', key: 'model' }, { label: 'Warna', key: 'color' }, { label: 'Ukuran', key: 'size' }, { label: 'Barcode / Kode', key: 'barcode' }, { label: 'Kategori', key: 'category' }, { label: 'Harga Beli', key: 'cost' }, { label: 'Harga Jual', key: 'price' }, { label: 'Diskon / pcs', key: 'discount' }, { label: 'Stok', key: 'stock' }, { label: 'Komisi Sales / pcs', key: 'commission' }]);
    $('[data-imp]', body).onclick = importModal;
    $('[data-lbl]', body).onclick = () => labelModal(products.filter((p) => sel.has(p.id)));
    $('[data-tbl]', body).onclick = async (e) => {
      const t = e.target; const gk = (k) => t.closest(`[data-${k}]`)?.dataset[k];
      if (t.dataset.gsel) { const g = groupsL.find((x) => x.key === t.dataset.gsel); g.items.forEach((p) => (t.checked ? sel.add(p.id) : sel.delete(p.id))); $('[data-n]', body).textContent = sel.size; $('[data-lbl]', body).classList.toggle('hidden', !sel.size); return; }
      const key = gk('mx') || gk('edit') || gk('del') || gk('photo');
      const g = key ? groupsL.find((x) => x.key === key) : null;
      if (gk('photo')) return photoModal(g, drawList);
      if (gk('mx')) return stockMatrixModal(g, drawList);
      if (gk('edit')) {
        if (g.model) crudModal({ title: 'Ubah model', size: 'wide', fields: mform(g), onSave: async (v) => { await api('model_update', { model: g.model, data: v }); toast('Model disimpan', v.model, 'ok'); drawList(); } });
        else { const p = g.items[0]; crudModal({ title: 'Ubah barang', size: 'wide', fields: pform(p), onSave: async (v) => { await db.update('products', p.id, v); toast('Barang disimpan', v.name, 'ok'); drawList(); } }); }
        return;
      }
      if (gk('del')) {
        if (await confirmBox('Hapus ' + g.name + '?', g.items.length > 1 ? `${g.items.length} varian akan dihapus. Riwayat transaksi lama tetap tersimpan.` : 'Barang dihapus dari daftar. Riwayat transaksi lama tetap tersimpan.', 'Hapus')) { try { await api('delete', { table: 'products', ids: g.items.map((p) => p.id) }); toast('Barang dihapus', '', 'ok'); drawList(); } catch (ex) { toastErr(ex); } }
        return;
      }
      const id = +(gk('in') || gk('out') || 0); if (!id) return;
      const p = products.find((x) => x.id === id), type = gk('in') ? 'in' : 'out';
      crudModal({ title: (type === 'in' ? 'Stok masuk: ' : 'Stok keluar: ') + p.name, fields: `<p class="muted" style="margin:0">Stok sekarang: <b>${p.stock}</b></p>${field('Jumlah (pcs)', 'qty', '', { numeric: true })}${field('Keterangan', 'note', '', { placeholder: type === 'in' ? 'Kiriman supplier…' : 'Rusak, hilang, retur ke supplier…' })}`, onSave: async (v) => { const r = await api('stock_adjust', { product_id: p.id, type, qty: v.qty, note: v.note }); toast('Stok diperbarui', `${p.name}: ${p.stock} → ${r.stock}`, 'ok'); drawList(); } });
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
//  PENGATURAN TOKO
// =====================================================================
V.pengaturan = async (page) => {
  const s = await api('settings_all');
  const sch = (() => { try { return JSON.parse(s.work_schedule || '{}'); } catch (e) { return {}; } })();
  const net = (() => { try { return JSON.parse(s.store_network || '{}'); } catch (e) { return {}; } })();
  const sample = { invoice: 'INV261110-1234', created: nowStr(), cashier: App.user.name, items: [{ name: 'Kemeja Kantor Basic - Putih / M', qty: 1, price: 159000 }, { name: 'Rok Span - Hitam / L', qty: 1, price: 129000, itemDiscount: 20000 }], subtotal: 288000, discount: 20000, total: 268000, payment: 300000, change: 32000, payment_method: 'cash' };
  page.innerHTML = head('Pengaturan toko', 'Identitas toko, struk, notifikasi transaksi, saluran penjualan, tukar barang, PIN admin, biaya, QRIS, dan absensi.') + `
  <div class="grid2" style="align-items:start">
    <div class="stack">
      <div class="panel"><div class="panel-h"><h3>Toko & struk</h3></div><div class="panel-b stack" data-store>
        ${field('Nama toko', 'store_name', s.store_name)}${field('Alamat di struk', 'receipt_address', s.receipt_address)}${field('Telepon / WA', 'receipt_phone', s.receipt_phone)}${field('Catatan bawah baris 1', 'receipt_footer1', s.receipt_footer1)}${field('Catatan bawah baris 2', 'receipt_footer2', s.receipt_footer2)}
        <div><button class="btn primary" data-save-store>Simpan toko & struk</button></div></div></div>
      <div class="panel" data-wa><div class="panel-h"><div><h3>Notifikasi transaksi</h3><span class="small muted">Kabari pemilik setiap ada transaksi masuk</span></div></div><div class="panel-b stack">
        <div class="ntf-card">
          <div class="row" style="align-items:flex-start"><span class="ntf-ic">${icon('bell')}</span><div class="grow"><b>Notifikasi di HP</b> <span class="chip green">Gratis</span><div class="small muted">Muncul di layar HP seperti pesan aplikasi — walau aplikasi kasir sedang ditutup.</div></div></div>
          <label class="row" style="gap:10px;cursor:pointer"><span class="switch"><input type="checkbox" data-push-on ${s.push_enabled === '1' ? 'checked' : ''}><span></span></span><b>Kirim notifikasi setiap transaksi</b></label>
          <div data-push-me></div>
          <div data-push-devs></div>
          <p class="small muted" style="margin:0" data-push-last></p>
        </div>
        <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Isi pemberitahuan</div>
          ${field('Kirim hanya bila total minimal', 'wa_min_total', s.wa_min_total || '', { numeric: true, hint: 'Kosongkan = semua transaksi diberitahukan.' })}
          <div class="stack" style="gap:8px;margin-top:10px">
            <label class="row" style="gap:8px"><input type="checkbox" data-wa-opt="wa_items" ${s.wa_items !== '0' ? 'checked' : ''}> Sertakan nama barang</label>
            <label class="row" style="gap:8px"><input type="checkbox" data-wa-opt="wa_daily" ${s.wa_daily !== '0' ? 'checked' : ''}> Sertakan omzet hari ini</label>
            <label class="row" style="gap:8px"><input type="checkbox" data-wa-opt="wa_retur" ${s.wa_retur !== '0' ? 'checked' : ''}> Beritahukan juga tukar / retur</label>
          </div></div>
        <div class="ntf-prev" data-push-prev></div>
        <details class="ntf-more" ${s.wa_enabled === '1' ? 'open' : ''}><summary>${icon('wa')} Juga kirim lewat WhatsApp <span class="small muted">(opsional)</span> <span class="chip ${s.wa_enabled === '1' ? 'green' : ''}" data-wa-chip>${s.wa_enabled === '1' ? 'Aktif' : 'Nonaktif'}</span></summary><div class="stack" style="margin-top:12px">
          <label class="row" style="gap:10px;cursor:pointer"><span class="switch"><input type="checkbox" data-wa-on ${s.wa_enabled === '1' ? 'checked' : ''}><span></span></span><b>Kirim pesan WhatsApp</b></label>
          <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Layanan pengirim</div><div class="seg" data-wa-prov><button data-pv="fonnte" class="${(s.wa_provider || 'fonnte') === 'fonnte' ? 'on' : ''}">Fonnte</button><button data-pv="callmebot" class="${s.wa_provider === 'callmebot' ? 'on' : ''}">CallMeBot</button></div></div>
          <div class="wa-help small" data-wa-help></div>
          ${field('Token / API key', 'wa_token', s.wa_token || '', { attrs: 'autocomplete="off" spellcheck="false"', placeholder: 'Tempel token di sini' })}
          ${field('Nomor WhatsApp penerima', 'wa_targets', s.wa_targets || '', { placeholder: '0812xxxx, 0813xxxx', hint: 'Beberapa nomor pisahkan dengan koma.' })}
          <p class="small muted" style="margin:0" data-wa-last></p>
          <div><button class="btn" data-wa-test>${icon('wa')}Kirim tes WhatsApp</button></div>
        </div></details>
        <div><button class="btn primary" data-wa-save>Simpan pengaturan notifikasi</button></div>
      </div></div>
      <div class="panel"><div class="panel-h"><h3>Penjualan & tukar barang</h3></div><div class="panel-b stack" data-fash>
        <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Saluran penjualan</div><div class="chipin" data-chs data-ph="Tambah, mis. Lazada lalu Enter"></div><span class="hint">Dipilih kasir saat pembayaran — omzet tiap saluran tampil di Dashboard.</span></div>
        <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Pilihan cepat ukuran</div><div class="chipin" data-szs data-ph="Tambah set, mis. S, M, L lalu Enter"></div><span class="hint">Satu set ukuran per kotak, dipisah koma. Muncul saat membuat model baru.</span></div>
        ${field('Batas tukar / retur (hari)', 'return_days', s.return_days || 7, { numeric: true, hint: 'Kasir diberi peringatan bila struk sudah lewat batas ini.' })}
        <div><button class="btn primary" data-save-fash>Simpan</button></div></div></div>
      <div class="panel"><div class="panel-h"><h3>PIN admin</h3></div><div class="panel-b stack" data-pin>
        <p class="small muted" style="margin:0">Kasir hanya bisa menambah barang atau mengubah harga bila admin memasukkan PIN ini. PIN tidak pernah dikirim ke perangkat kasir.</p>
        ${field('PIN admin baru', 'supervisor_pin', '', { type: 'password', placeholder: 'Minimal 4 angka', attrs: 'inputmode="numeric" autocomplete="new-password"' })}
        <div><button class="btn primary" data-save-pin>Ganti PIN</button></div></div></div>
      <div class="panel"><div class="panel-h"><h3>Biaya tambahan</h3><button class="btn sm" data-addfee>${icon('plus')}Tambah</button></div><div class="panel-b stack">
        <p class="small muted" style="margin:0">Pilihan cepat di tombol <b>Biaya</b> dan <b>Kirim</b> pada kasir, misalnya ongkir Maxim. Nominal tetap bisa diubah saat transaksi.</p>
        <div class="stack" data-fees style="gap:8px"></div>
        <div><button class="btn primary" data-save-fees>Simpan biaya tambahan</button></div></div></div>
      <div class="panel"><div class="panel-h"><h3>QRIS toko</h3><span data-qstat></span></div><div class="panel-b stack" data-qris>
        <p class="small muted" style="margin:0">Masukkan QRIS statis toko (yang dicetak di stand kasir, dari bank / GoPay / DANA / ShopeePay Merchant). Aplikasi akan membuat kode QRIS dengan nominal transaksi otomatis.</p>
        <div class="row wrap"><label class="btn" style="cursor:pointer">${icon('upload')}Foto / gambar QRIS<input type="file" accept="image/*" data-qfile style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></label><button class="btn" data-qcam>${icon('camera')}Scan pakai kamera</button></div>
        <label class="f">Teks QRIS<textarea class="input" name="qris_payload" placeholder="000201010211…" style="min-height:70px;font-family:monospace;font-size:12px">${esc(s.qris_payload || '')}</textarea><span class="hint">Terisi otomatis dari foto/kamera. Bisa juga ditempel manual.</span></label>
        <div data-qprev></div>
        <div class="row wrap"><button class="btn primary" data-qsave>Simpan QRIS</button><button class="btn danger" data-qdel>Hapus</button></div></div></div>
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
  // ---- QRIS
  const qta = $('[name=qris_payload]', page);
  const qprev = () => {
    const v = qta.value.trim();
    if (!v) { $('[data-qprev]', page).innerHTML = ''; $('[data-qstat]', page).innerHTML = '<span class="chip">Belum diatur</span>'; return; }
    try { const inf = QRIS.info(v); $('[data-qstat]', page).innerHTML = `<span class="chip ${inf.crcOk ? 'green' : 'red'}">${inf.crcOk ? 'Valid' : 'Checksum salah'}</span>`; $('[data-qprev]', page).innerHTML = `<div class="panel panel-b small" style="background:#FAFBFD"><b>${esc(inf.name)}</b> · ${esc(inf.city)}${inf.nmid ? ' · NMID ' + esc(inf.nmid) : ''}${inf.dynamic ? '<br><span class="danger">Ini QRIS dinamis (sekali pakai). Gunakan QRIS statis yang dicetak di stand toko.</span>' : ''}<div class="row" style="margin-top:8px"><button class="btn sm" data-qtest>Coba buat QR Rp1.000</button></div></div>`; }
    catch (e) { $('[data-qstat]', page).innerHTML = '<span class="chip red">Tidak valid</span>'; $('[data-qprev]', page).innerHTML = `<p class="danger small" style="margin:0">${esc(e.message)}</p>`; }
  };
  qta.oninput = qprev; qprev();
  $('[data-qfile]', page).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { qta.value = await QRIS.decodeImage(f); qprev(); toast('QRIS terbaca', '', 'ok'); } catch (ex) { toastErr(ex); } e.target.value = ''; };
  $('[data-qcam]', page).onclick = async () => { const c = await scanWithCamera(); if (c) { qta.value = c; qprev(); } };
  $('[data-qris]', page).addEventListener('click', (e) => { if (e.target.closest('[data-qtest]')) { App.settings.qris_payload = qta.value.trim(); qrisFullscreen(1000); } });
  $('[data-qsave]', page).onclick = () => { const v = qta.value.trim(); try { if (v) { const inf = QRIS.info(v); if (!inf.crcOk) throw new Error('Checksum QRIS salah. Ambil ulang dari foto.'); if (inf.dynamic) throw new Error('Gunakan QRIS statis, bukan QRIS dinamis.'); } } catch (ex) { toastErr(ex); return; } save({ qris_payload: v }, v ? 'QRIS disimpan' : 'QRIS dihapus'); };
  $('[data-qdel]', page).onclick = async () => { if (await confirmBox('Hapus QRIS?', 'Pembayaran QRIS di kasir tidak akan menampilkan kode.', 'Hapus')) { qta.value = ''; qprev(); save({ qris_payload: '' }, 'QRIS dihapus'); } };
  let fees = (() => { try { return JSON.parse(s.fee_presets || '[]'); } catch (e) { return []; } })();
  const drawFees = () => { $('[data-fees]', page).innerHTML = fees.length ? fees.map((f, i) => `<div class="row"><input class="input grow" data-fl="${i}" value="${esc(f.label)}" placeholder="Nama biaya, mis. Ongkir Maxim"><input class="input" data-fa="${i}" value="${f.amount || ''}" inputmode="numeric" placeholder="Rp" style="width:120px"><button class="btn icon sm danger" data-fd="${i}" aria-label="Hapus">${icon('trash')}</button></div>`).join('') : '<p class="muted small" style="margin:0">Belum ada. Klik Tambah.</p>'; };
  drawFees();
  $('[data-fees]', page).oninput = (e) => { const i = e.target.dataset.fl ?? e.target.dataset.fa; if (i === undefined) return; if (e.target.dataset.fl !== undefined) fees[+i].label = e.target.value; else fees[+i].amount = numID(e.target.value); };
  $('[data-fees]', page).onclick = (e) => { const d = e.target.closest('[data-fd]'); if (d) { fees.splice(+d.dataset.fd, 1); drawFees(); } };
  $('[data-addfee]', page).onclick = () => { fees.push({ label: '', amount: 0 }); drawFees(); $(`[data-fl="${fees.length - 1}"]`, page).focus(); };
  $('[data-save-fees]', page).onclick = () => { fees = fees.filter((f) => f.label.trim()).map((f) => ({ label: f.label.trim(), amount: num(f.amount) })); drawFees(); save({ fee_presets: JSON.stringify(fees) }, 'Biaya tambahan disimpan'); };
  const chs = chipInput($('[data-chs]', page), (() => { try { return JSON.parse(s.sales_channels || '[]'); } catch (e) { return []; } })());
  const szs = (() => { let l = []; try { l = JSON.parse(s.size_sets || '[]'); } catch (e) { /* kosong */ } const root = $('[data-szs]', page); let list = l; const draw = () => { root.innerHTML = list.map((x, i) => `<span>${esc(x)}<button type="button" data-rm="${i}" aria-label="Hapus">×</button></span>`).join('') + `<input placeholder="${esc(root.dataset.ph)}">`; const inp = root.querySelector('input'); inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); list.push(inp.value.trim()); draw(); root.querySelector('input').focus(); } }; }; root.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { list.splice(+b.dataset.rm, 1); draw(); } }; draw(); return { get: () => list }; })();
  $('[data-save-fash]', page).onclick = () => { const c = chs.get(); if (!c.length) { toast('Isi minimal satu saluran penjualan', '', 'err'); return; } save({ sales_channels: JSON.stringify(c), size_sets: JSON.stringify(szs.get()), return_days: String(Math.max(0, num($('[name=return_days]', page).value))) }, 'Pengaturan penjualan disimpan'); };
  // ---------- notifikasi transaksi: HP (Web Push) + WhatsApp opsional
  {
    const box = $('[data-wa]', page);
    let prov = s.wa_provider || 'fonnte';
    const HELP = {
      fonnte: `<b>Fonnte</b> (gateway WhatsApp Indonesia):<ol><li>Daftar di <a href="https://fonnte.com" target="_blank" rel="noopener">fonnte.com</a> → <b>Add device</b> → scan QR memakai WhatsApp nomor <u>pengirim</u> (sebaiknya nomor khusus toko).</li><li>Salin <b>Token</b> perangkat, tempel di bawah, lalu isi nomor <u>penerima</u>.</li></ol>`,
      callmebot: `<b>CallMeBot</b> (gratis, hanya ke nomor Anda sendiri). Nomor bot mereka bisa berganti — ikuti langkah terbaru di <a href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noopener">halaman resmi CallMeBot</a>, lalu tempel APIKEY yang dikirim bot dan isi nomor HP yang sama.`,
    };
    const lastTxt = (raw, what) => { try { const l = JSON.parse(raw || ''); return l.time ? `${what} terakhir ${fmtDT(l.time)}${l.label ? ' (' + esc(l.label) + ')' : ''}: <b class="${l.ok ? 'money' : 'danger'}">${l.ok ? 'berhasil' : 'gagal'}</b> — ${esc(l.info || '')}` : ''; } catch (e) { return ''; } };
    const opts = () => { const o = {}; $$('[data-wa-opt]', box).forEach((c) => { o[c.dataset.waOpt] = c.checked; }); return o; };
    const drawPrev = () => {
      const o = opts();
      $('[data-push-prev]', box).innerHTML = `<div class="small bold muted" style="margin-bottom:6px">Contoh notifikasi di HP</div><div class="ntf-mock"><img src="assets/img/icon-192.png" alt=""><div class="grow"><div class="ntf-app">${esc(s.store_name || 'Kasir')} · sekarang</div><b>🛍️ Rp249.000 · Transaksi baru</b><div>INV261113-1234 · Instagram · Nisa</div>${o.wa_items ? '<div>Kemeja Kantor Basic - Putih / M ×1, Pashmina Ceruty - Sage ×2</div>' : ''}${o.wa_daily ? '<div>Hari ini: Rp2.450.000 · 14 transaksi</div>' : ''}</div></div>`;
    };
    const drawWA = () => {
      $$('[data-pv]', box).forEach((b) => b.classList.toggle('on', b.dataset.pv === prov));
      $('[data-wa-help]', box).innerHTML = HELP[prov];
      $('[name=wa_token]', box).closest('label').firstChild.textContent = prov === 'callmebot' ? 'APIKEY dari CallMeBot' : 'Token perangkat Fonnte';
    };
    // --- HP ini & daftar HP
    const drawPush = async () => {
      const me = $('[data-push-me]', box), blk = Push.blocker(), sub = await Push.current();
      let devs = []; try { devs = await api('push_list', { endpoint: sub ? sub.endpoint : '' }); } catch (e) { /* abaikan */ }
      const mine = sub && devs.some((d) => d.this);
      me.innerHTML = blk && !mine ? `<div class="ntf-warn">${icon('info')}<span>${esc(blk)}</span></div>`
        : mine ? `<div class="row wrap"><span class="chip green">${icon('check')}HP ini sudah menerima notifikasi</span><button class="btn sm" data-push-off>Matikan di HP ini</button></div>`
        : `<button class="btn primary" data-push-enable style="width:100%;height:48px">${icon('bell')}Aktifkan notifikasi di HP ini</button><p class="small muted" style="margin:6px 0 0">Lakukan di HP pemilik saat login sebagai admin. Browser akan bertanya — tekan <b>Izinkan</b>.</p>`;
      $('[data-push-devs]', box).innerHTML = devs.length ? `<div class="small bold muted" style="margin:4px 0 6px">HP penerima (${devs.length})</div><div class="ntf-devs">${devs.map((d) => `<div class="row"><span class="grow"><b>${esc(d.device)}</b>${d.this ? ' <span class="chip blue">HP ini</span>' : ''}<div class="small muted">${esc(d.user || '')} · ${d.last_ok ? 'terakhir terkirim ' + fmtDT(d.last_ok) : 'didaftarkan ' + fmtDT(d.created)}${d.fails ? ` · <span class="danger">${d.fails}× gagal</span>` : ''}</div></span><button class="btn sm icon danger" data-push-del="${d.id}" aria-label="Hapus">${icon('trash')}</button></div>`).join('')}</div><div style="margin-top:8px"><button class="btn" data-push-test>${icon('bell')}Kirim tes ke semua HP</button></div>` : '<p class="small muted" style="margin:0">Belum ada HP penerima.</p>';
    };
    const savePushOn = async (on) => { try { App.settings = await api('settings_save', { values: { push_enabled: on ? '1' : '0' } }); $('[data-push-on]', box).checked = on; } catch (e) { toastErr(e); } };
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.pushEnable !== undefined) {
        t.disabled = true; t.textContent = 'Mengaktifkan…';
        try { const r = await Push.enable(); await savePushOn(true); toast('Notifikasi aktif di HP ini', r.device + ' — kirim tes untuk mencoba.', 'ok'); } catch (ex) { toastErr(ex); }
        drawPush();
      } else if (t.dataset.pushOff !== undefined) {
        await Push.disable(); toast('Notifikasi dimatikan di HP ini'); drawPush();
      } else if (t.dataset.pushDel) {
        if (await confirmBox('Hapus HP ini dari penerima?', 'HP tersebut tidak akan menerima notifikasi transaksi lagi.', 'Hapus')) { try { await api('push_unsubscribe', { id: +t.dataset.pushDel }); } catch (ex) { toastErr(ex); } drawPush(); }
      } else if (t.dataset.pushTest !== undefined) {
        t.disabled = true;
        try { const r = await api('push_test'); toast('Notifikasi tes dikirim', r.info, 'ok'); } catch (ex) { toastErr(ex); }
        try { const all = await api('settings_all'); $('[data-push-last]', box).innerHTML = lastTxt(all.push_last, 'Notifikasi'); } catch (ex) { /* abaikan */ }
        t.disabled = false; drawPush();
      }
    });
    $('[data-push-on]', box).onchange = (e) => savePushOn(e.target.checked).then(() => toast(e.target.checked ? 'Notifikasi transaksi aktif' : 'Notifikasi transaksi dimatikan'));
    $('[data-push-last]', box).innerHTML = lastTxt(s.push_last, 'Notifikasi');
    $('[data-wa-last]', box).innerHTML = lastTxt(s.wa_last, 'WhatsApp');
    $('[data-wa-prov]', box).onclick = (e) => { const b = e.target.closest('[data-pv]'); if (b) { prov = b.dataset.pv; drawWA(); } };
    box.addEventListener('change', (e) => { if (e.target.dataset.waOpt) drawPrev(); });
    const vals = () => {
      const v = { push_enabled: $('[data-push-on]', box).checked ? '1' : '0', wa_enabled: $('[data-wa-on]', box).checked ? '1' : '0', wa_provider: prov, wa_token: $('[name=wa_token]', box).value.trim(), wa_targets: $('[name=wa_targets]', box).value.trim(), wa_min_total: String(num($('[name=wa_min_total]', box).value) || '') };
      $$('[data-wa-opt]', box).forEach((c) => { v[c.dataset.waOpt] = c.checked ? '1' : '0'; });
      return v;
    };
    const check = (v) => {
      if (v.wa_enabled === '1' && !v.wa_token) { toast('Isi token / API key WhatsApp', '', 'err'); return false; }
      if (v.wa_enabled === '1' && v.wa_targets.replace(/\D/g, '').length < 9) { toast('Isi nomor WhatsApp penerima', '', 'err'); return false; }
      return true;
    };
    const persist = async () => { const v = vals(); if (!check(v)) return false; try { App.settings = await api('settings_save', { values: v }); const c = $('[data-wa-chip]', box); c.textContent = v.wa_enabled === '1' ? 'Aktif' : 'Nonaktif'; c.className = 'chip ' + (v.wa_enabled === '1' ? 'green' : ''); return true; } catch (e) { toastErr(e); return false; } };
    $('[data-wa-save]', box).onclick = async () => { if (await persist()) toast('Pengaturan notifikasi disimpan', '', 'ok'); };
    $('[data-wa-test]', box).onclick = async (e) => {
      const b = e.currentTarget; const v = vals();
      if (!v.wa_token || v.wa_targets.replace(/\D/g, '').length < 9) { toast('Isi token dan nomor penerima dulu', '', 'err'); return; }
      if (!(await persist())) return;
      b.disabled = true;
      try { const r = await api('wa_test'); toast('Pesan tes terkirim', r.info + ' Cek WhatsApp Anda.', 'ok'); } catch (ex) { toastErr(ex); }
      try { const all = await api('settings_all'); $('[data-wa-last]', box).innerHTML = lastTxt(all.wa_last, 'WhatsApp'); } catch (ex) { /* abaikan */ }
      b.disabled = false;
    };
    drawWA(); drawPrev(); drawPush();
  }
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
//  PRINTER
// =====================================================================
V.printer = async (page) => {
  const sample = { invoice: 'TES-PRINTER', created: nowStr(), cashier: App.user.name, items: [{ name: 'Tes cetak', qty: 1, price: 10000 }], subtotal: 10000, discount: 0, total: 10000, payment: 10000, change: 0, payment_method: 'cash' };
  const draw = () => {
    const s = Printer.status, sv = Printer.saved(), pp = PrinterPrefs.get(), on = s === 'connected';
    page.innerHTML = head('Printer', 'Hubungkan printer thermal Bluetooth, atau cetak lewat printer biasa / simpan PDF.') + `<div class="grid2" style="align-items:start">
      <div class="panel"><div class="panel-h"><h3>Printer thermal Bluetooth</h3><span class="chip ${on ? 'green' : s === 'connecting' ? 'amber' : ''}">${on ? 'Terhubung' : s === 'connecting' ? 'Menghubungkan…' : 'Belum terhubung'}</span></div><div class="panel-b stack">
        ${Printer.supported ? `
          <div class="row"><span class="thumb xs ph" style="--h:210"><b>${icon('printer')}</b></span><div class="grow"><b>${esc((Printer.device && Printer.device.name) || (sv && sv.name) || 'Belum ada printer')}</b><div class="small muted">${sv ? (on ? 'Siap mencetak' : 'Tersimpan di perangkat ini') : 'Nyalakan printer, aktifkan Bluetooth & lokasi HP, lalu tekan Hubungkan.'}</div></div></div>
          <div class="row wrap">${on ? '<button class="btn primary" data-test>Cetak tes</button><button class="btn" data-dis>Putuskan</button>' : `<button class="btn primary" data-con>${sv ? 'Sambungkan ' + esc(sv.name) : 'Hubungkan printer'}</button>`}${sv ? '<button class="btn" data-any>Ganti printer</button><button class="btn ghost danger" data-forget>Lupakan</button>' : ''}</div>
          <p class="small muted" style="margin:0">${Printer.canRestore ? 'Printer yang tersimpan otomatis tersambung lagi saat halaman dibuka atau dimuat ulang.' : 'Printer tersimpan di perangkat ini. Setelah halaman dimuat ulang, browser meminta satu ketukan untuk menyambung lagi — atau aplikasi menyambung sendiri saat Anda pertama kali mencetak.'}</p>`
          : '<p class="danger small" style="margin:0">Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome di Android, Windows, atau macOS. iPhone/Safari belum didukung — gunakan cetak biasa.</p>'}
      </div></div>
      <div class="stack">
        <div class="panel"><div class="panel-h"><h3>Pengaturan cetak</h3><span class="small muted">disimpan di perangkat ini</span></div><div class="panel-b stack">
          <label class="row" style="gap:10px;cursor:pointer"><span class="switch"><input type="checkbox" data-auto ${pp.auto ? 'checked' : ''}><span></span></span><span><b>Cetak struk otomatis</b><div class="small muted">Struk langsung tercetak di printer Bluetooth setiap transaksi selesai.</div></span></label>
          <div><div class="small bold" style="color:var(--ink-2);margin-bottom:6px">Lebar kertas</div><div class="seg" data-w><button data-wv="32" class="${pp.width !== 48 ? 'on' : ''}">58 mm</button><button data-wv="48" class="${pp.width === 48 ? 'on' : ''}">80 mm</button></div></div>
        </div></div>
        <div class="panel"><div class="panel-h"><h3>Cetak biasa / PDF</h3></div><div class="panel-b stack"><p class="small muted" style="margin:0">Memakai dialog cetak browser — cocok untuk printer USB yang terpasang di Windows, printer kantor, atau simpan sebagai PDF.</p><div><button class="btn" data-web>${icon('printer')}Cetak contoh struk</button></div></div></div>
      </div></div>`;
    const b = (q, f) => { const x = $(q, page); if (x) x.onclick = f; };
    const con = async (any) => { try { await Printer.connect({ any }); toast('Printer terhubung', Printer.device?.name || '', 'ok'); } catch (e) { if (e.name !== 'NotFoundError') toastErr(e); } };
    b('[data-con]', () => con(false));
    b('[data-any]', async () => { Printer.disconnect(); await con(true); });
    b('[data-dis]', () => Printer.disconnect());
    b('[data-forget]', async () => { if (await confirmBox('Lupakan printer?', 'Printer tidak akan disambungkan otomatis lagi di perangkat ini.', 'Lupakan')) { await Printer.forget(); toast('Printer dilupakan'); } });
    b('[data-test]', async () => { try { await Printer.printReceipt(sample); toast('Tes cetak dikirim', '', 'ok'); } catch (e) { toastErr(e); } });
    b('[data-web]', () => printHTML(receiptHTML(sample, App.settings)));
    const au = $('[data-auto]', page); if (au) au.onchange = () => { PrinterPrefs.set({ auto: au.checked }); toast(au.checked ? 'Cetak otomatis aktif' : 'Cetak otomatis nonaktif'); };
    const w = $('[data-w]', page); if (w) w.onclick = (e) => { const x = e.target.closest('[data-wv]'); if (!x) return; PrinterPrefs.set({ width: +x.dataset.wv }); draw(); toast('Lebar kertas: ' + x.textContent); };
  };
  Printer.listeners.add(draw); draw();
  return () => Printer.listeners.delete(draw);
};

// =====================================================================
//  PENGIRIMAN
// =====================================================================
V.pengiriman = async (page) => {
  const ST = { baru: ['Perlu dikirim', 'amber'], dipesan: ['Kurir dipesan', 'blue'], dikirim: ['Dalam perjalanan', 'blue'], selesai: ['Selesai', 'green'], batal: ['Batal', 'red'] };
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
        <div class="row"><span class="chip blue">${icon('truck')} ${esc(sh.courier)}</span><span class="chip ${(ST[sh.status] || ST.baru)[1]}">${(ST[sh.status] || ST.baru)[0]}</span><span class="grow"></span><span class="small muted">${fmtDT(sh.created)}</span></div>
        <div><b style="font-size:15px">${esc(sh.recipient || '-')}</b> ${sh.phone ? `<span class="muted">· ${esc(sh.phone)}</span>` : ''}</div>
        <p class="ship-addr">${esc(sh.address || '-')}</p>
        <div class="small muted">${esc(sh.invoice)} · ongkir ${sh.fee ? rupiah(sh.fee) : 'dibayar penerima'}${sh.note ? ' · ' + esc(sh.note) : ''}</div>
        ${sh.driver ? `<div class="small">Kurir: <b>${esc(sh.driver)}</b></div>` : ''}
        ${sh.resi ? `<div class="small">Resi / pelacakan: <b>${tr ? `<a href="${esc(tr)}" target="_blank" rel="noopener">${esc(sh.resi)}</a>` : esc(sh.resi)}</b></div>` : ''}
        <div class="row wrap" style="margin-top:4px">
          ${sh.status === 'baru' ? `${c.site ? `<a class="btn sm" href="${esc(c.site)}" target="_blank" rel="noopener">Buka ${esc(c.id)}</a>` : ''}<button class="btn sm" data-copy="${sh.id}">Salin alamat</button><button class="btn sm primary" data-send="${sh.id}">Isi resi & kirim</button>` : ''}
          ${sh.status === 'dikirim' || sh.status === 'dipesan' ? `${tr ? `<a class="btn sm" href="${esc(tr)}" target="_blank" rel="noopener">Lacak</a>` : ''}<button class="btn sm" data-send="${sh.id}">Ubah resi</button><button class="btn sm primary" data-done="${sh.id}">Tandai diterima</button>` : ''}
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
//  QRIS — terima pembayaran langsung dengan nominal
// =====================================================================
V.qris = async (page) => {
  let amount = 0;
  page.innerHTML = head('QRIS', 'Ketik nominal, lalu tunjukkan kode ke pembeli. Nominal langsung terisi di aplikasi pembeli.', App.isAdmin() ? '<a class="btn" href="#pengaturan">Atur QRIS toko</a>' : '') + `
    <div class="grid2" style="align-items:start;max-width:900px">
      <div class="panel panel-b stack">
        <div class="bigtotal"><span>Nominal</span><b data-amt>Rp0</b></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '000', 0, '⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
        <div class="quick">${[10000, 25000, 50000, 100000, 150000, 200000].map((v) => `<button data-q="${v}">${rupiah(v)}</button>`).join('')}</div>
        <div class="row"><button class="btn" data-clear>Hapus</button><span class="grow"></span><button class="btn primary" data-full disabled>Layar penuh untuk pembeli</button></div>
      </div>
      <div class="center" data-qr></div>
    </div>
    <p class="small muted" style="max-width:900px">Pembayaran lewat menu ini tidak tercatat sebagai penjualan barang. Untuk penjualan, pilih metode QRIS di layar <a href="#kasir">Kasir</a>. Selalu cek notifikasi dana masuk di aplikasi merchant QRIS Anda.</p>`;
  const draw = () => {
    $('[data-amt]', page).textContent = rupiah(amount);
    $('[data-full]', page).disabled = !(amount > 0 && App.settings.qris_payload);
    $('[data-qr]', page).innerHTML = amount > 0 ? qrisPanel(amount) : (App.settings.qris_payload ? `<div class="panel panel-b muted">Masukkan nominal untuk membuat kode QRIS.</div>` : qrisPanel(1));
  };
  page.onclick = (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k, q = e.target.closest('[data-q]')?.dataset.q;
    if (k !== undefined) { const s = String(amount === 0 ? '' : amount); amount = k === '⌫' ? num(s.slice(0, -1)) : Math.min(99999999, num(s + k)); draw(); }
    if (q) { amount = +q; draw(); }
    if (e.target.closest('[data-clear]')) { amount = 0; draw(); }
    if (e.target.closest('[data-full]') && amount > 0) qrisFullscreen(amount);
  };
  draw();
  return () => { page.onclick = null; };
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
