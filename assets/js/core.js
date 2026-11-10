/* Sofeeya Store POS — utilitas inti (tanpa framework) */
'use strict';

// ---------------------------------------------------------------- ikon (garis, 24px)
const ICONS = {
  kasir: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 7v10M12 7v10M16 7v10"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  laporan: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  produk: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  promo: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  member: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  sales: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.6-3-1.5M12 6v2M12 16v2"/>',
  info: '<path d="m3 11 18-8-8 18-2-8z"/>',
  setting: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  users: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1M18 4l1.5 1.5L22 3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  akun: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.7a6 6 0 0 1 10 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  gift: '<rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  barcode: '<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4"/>',
  finger: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.29 21.02c.12-.6.43-2.3.5-3.02M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .131-5.354 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2M8.65 22c.21-.66.45-1.32.57-2M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  arrowleft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  wa: '<path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 21l2.1-5.3A8.5 8.5 0 1 1 21 11.5z"/>',
  user_plus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
};
function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

// ---------------------------------------------------------------- dasar
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function num(v) { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function rupiah(n) { const v = Math.round(Number(n) || 0); return (v < 0 ? '-Rp' : 'Rp') + Math.abs(v).toLocaleString('id-ID'); }
function fmtNum(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function nowStr() { const d = new Date(); return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseDT(s) { if (!s) return null; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d; }
function fmtDate(s) { const d = parseDT(s); return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function fmtTime(s) { const d = parseDT(s); return d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'; }
function fmtDT(s) { const d = parseDT(s); return d ? `${fmtDate(s)} ${fmtTime(s)}` : '-'; }
function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function uid() { return Math.random().toString(36).slice(2, 9); }

// ---------------------------------------------------------------- API
async function api(action, body = {}) {
  let res;
  try {
    res = await fetch('api/index.php?a=' + encodeURIComponent(action), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'SofeeyaPOS' },
      body: JSON.stringify(body),
    });
  } catch (e) { throw new Error('Tidak ada koneksi internet / server tidak terjangkau.'); }
  let json;
  try { json = await res.json(); } catch (e) { throw new Error('Respons server tidak valid (' + res.status + '). Pastikan PHP aktif dan api/config.php benar.'); }
  if (!json.ok) {
    const err = new Error(json.error || 'Terjadi kesalahan.'); err.status = res.status;
    if (res.status === 401 && window.onSessionExpired) window.onSessionExpired();
    throw err;
  }
  return json.data;
}
const db = {
  list: (table, opt = {}) => api('list', { table, ...opt }),
  create: (table, data, extra = {}) => api('create', { table, data, ...extra }),
  update: (table, id, data) => api('update', { table, id, data }),
  remove: (table, id) => api('delete', { table, id }),
};

// ---------------------------------------------------------------- toast
function toast(title, desc = '', type = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = esc(title) + (desc ? `<small>${esc(desc)}</small>` : '');
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), type === 'err' ? 4500 : 2600);
}
const toastErr = (e) => toast(e?.message || String(e), '', 'err');

// ---------------------------------------------------------------- modal
function modal({ title = '', body = '', foot = '', size = '', onClose } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="modal-h"><h2>${esc(title)}</h2><button class="btn ghost icon sm" data-x aria-label="Tutup">${icon('x')}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  $('[data-x]', bg).onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  const first = $('input:not([type=hidden]),select,textarea', bg);
  if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 30);
  return { el: $('.modal', bg), close, $: (s) => $(s, bg), $$: (s) => $$(s, bg) };
}
function confirmBox(title, message, okLabel = 'Ya, lanjutkan', danger = true) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({ title, body: `<p style="margin:0">${esc(message)}</p>`,
      foot: `<button class="btn" data-no>Batal</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button>`,
      onClose: () => { if (!done) resolve(false); } });
    m.$('[data-no]').onclick = () => m.close();
    m.$('[data-yes]').onclick = () => { done = true; m.close(); resolve(true); };
  });
}
function alertBox(title, message, okLabel = 'Mengerti') {
  return new Promise((resolve) => {
    const m = modal({ title, body: `<p style="margin:0">${esc(message)}</p>`, foot: `<button class="btn primary" data-ok>${esc(okLabel)}</button>`, onClose: () => resolve(true) });
    m.$('[data-ok]').onclick = () => m.close();
  });
}
function askPin(reason = 'Masukkan PIN admin untuk melanjutkan.') {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({ title: 'PIN admin', body: `<p class="muted" style="margin-top:0">${esc(reason)}</p><input class="input" type="password" inputmode="numeric" autocomplete="off" data-pin placeholder="••••">`,
      foot: `<button class="btn" data-no>Batal</button><button class="btn primary" data-yes>Konfirmasi</button>`,
      onClose: () => { if (!done) resolve(null); } });
    const go = async () => {
      const pin = m.$('[data-pin]').value.trim();
      if (!pin) return;
      try {
        const r = await api('verify_pin', { pin });
        if (!r.ok) { toast('PIN admin salah', '', 'err'); return; }
        done = true; m.close(); resolve(pin);
      } catch (e) { toastErr(e); }
    };
    m.$('[data-pin]').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    m.$('[data-no]').onclick = () => m.close();
    m.$('[data-yes]').onclick = go;
    setTimeout(() => m.$('[data-pin]').focus(), 30);
  });
}
// ambil isi form → objek (checkbox = boolean, data-num = angka)
function formValues(root) {
  const o = {};
  $$('[name]', root).forEach((el) => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.dataset.num !== undefined) o[el.name] = num(el.value);
    else o[el.name] = el.value.trim();
  });
  return o;
}
function field(label, name, value = '', opt = {}) {
  const { type = 'text', hint = '', numeric = false, placeholder = '', attrs = '' } = opt;
  return `<label class="f">${esc(label)}<input class="input" name="${name}" type="${type}" value="${esc(value)}" ${numeric ? 'data-num inputmode="decimal"' : ''} placeholder="${esc(placeholder)}" ${attrs}>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</label>`;
}
function emptyState(msg, ic = 'box') { return `<div class="empty">${icon(ic)}${esc(msg)}</div>`; }

// ---------------------------------------------------------------- file: CSV / Excel
function toCSV(rows, cols) {
  const e = (v) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.map((c) => e(c.label)).join(','), ...rows.map((r) => cols.map((c) => e(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))].join('\n');
}
function downloadBlob(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function downloadCSV(filename, rows, cols) { downloadBlob(filename, '\ufeff' + toCSV(rows, cols), 'text/csv;charset=utf-8'); }
// ---------------------------------------------------------------- Excel .xlsx asli (tanpa library luar)
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(files) { // files: [{name, data:Uint8Array}] → Blob (tanpa kompresi)
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + sz;
  }
  const cdSize = central.reduce((a, x) => a + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xmlEsc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
// sheets: [{name, rows: [[...]], widths:[..], header:true}]  → unduh .xlsx
function downloadXLSX(filename, sheets) {
  const enc = new TextEncoder();
  const sheetXml = (sh) => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1), st = ri === 0 && sh.header !== false ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      if (v === null || v === undefined || v === '') return st ? `<c r="${ref}"${st}/>` : '';
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const cols = (sh.widths || []).length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const pane = sh.header !== false ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sh, i) => `<sheet name="${xmlEsc(String(sh.name).replace(/[\\\/?*\[\]:]/g, '').slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF035AA6"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`],
    ...sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)]),
  ].map(([name, txt]) => ({ name, data: enc.encode(txt) }));
  downloadBlob(filename.replace(/\.xlsx?$/i, '') + '.xlsx', zipStore(files));
}
// Ekspor tabel → .xlsx (nama fungsi lama dipertahankan)
function downloadXLS(filename, rows, cols) {
  const aoa = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => { const v = typeof c.get === 'function' ? c.get(r) : r[c.key]; return v == null ? '' : v; }))];
  downloadXLSX(filename, [{ name: 'Data', rows: aoa, widths: cols.map((c) => Math.min(45, Math.max(10, String(c.label).length + 4))) }]);
}
// ---------------------------------------------------------------- membaca file impor
async function unzipEntries(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let eocd = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('File Excel rusak atau bukan .xlsx.');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    out[name] = { method, data: u8.subarray(start, start + csize) };
    p += 46 + nl + el + cl;
  }
  return {
    has: (nm) => !!out[nm],
    names: () => Object.keys(out),
    async text(nm) {
      const e = out[nm]; if (!e) return null;
      if (e.method === 0) return dec.decode(e.data);
      if (typeof DecompressionStream === 'undefined') throw new Error('Browser terlalu lama untuk membaca Excel. Perbarui Chrome, atau simpan file sebagai CSV.');
      const ab = await new Response(new Blob([e.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      return dec.decode(ab);
    },
  };
}
function cellIndex(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; }
function cleanNumStr(v) { // 8.99123E+12 → 8991230000000 (barcode yang terlanjur jadi angka)
  if (/^-?\d+(\.\d+)?E[+-]?\d+$/i.test(v)) { const n = Number(v); if (Number.isFinite(n) && Number.isInteger(n)) return BigInt(Math.round(n)).toString(); }
  if (/^-?\d+\.\d{6,}$/.test(v)) return String(Math.round(Number(v) * 100) / 100);
  return v;
}
async function readXLSX(buf) {
  const z = await unzipEntries(buf);
  const P = (t) => new DOMParser().parseFromString(t, 'application/xml');
  const tags = (node, name) => Array.from(node.getElementsByTagName('*')).filter((e) => e.localName === name);
  let sheetPath = 'xl/worksheets/sheet1.xml';
  try {
    const wb = P(await z.text('xl/workbook.xml')), rels = P(await z.text('xl/_rels/workbook.xml.rels'));
    const first = tags(wb, 'sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = tags(rels, 'Relationship').find((r) => r.getAttribute('Id') === rid);
    if (rel) { let t = rel.getAttribute('Target').replace(/^\//, ''); if (!t.startsWith('xl/')) t = 'xl/' + t; if (z.has(t)) sheetPath = t; }
  } catch (e) { /* pakai sheet1 */ }
  if (!z.has(sheetPath)) sheetPath = z.names().find((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  if (!sheetPath) throw new Error('Sheet tidak ditemukan di file Excel.');
  const shared = [];
  const sst = await z.text('xl/sharedStrings.xml');
  if (sst) tags(P(sst), 'si').forEach((si) => shared.push(tags(si, 't').map((t) => t.textContent).join('')));
  const doc = P(await z.text(sheetPath)); const aoa = [];
  tags(doc, 'row').forEach((row, ri) => {
    const rIdx = (Number(row.getAttribute('r')) || ri + 1) - 1; const arr = []; let ci = 0;
    tags(row, 'c').forEach((c) => {
      const idx = cellIndex(c.getAttribute('r')); if (idx >= 0) ci = idx;
      const t = c.getAttribute('t'); const vEl = tags(c, 'v')[0]; let v = '';
      if (t === 's') v = shared[Number(vEl?.textContent)] ?? '';
      else if (t === 'inlineStr') v = tags(c, 't').map((x) => x.textContent).join('');
      else if (t === 'b') v = vEl?.textContent === '1' ? 'TRUE' : 'FALSE';
      else v = cleanNumStr(vEl?.textContent ?? '');
      arr[ci++] = v;
    });
    aoa[rIdx] = Array.from(arr, (x) => (x == null ? '' : String(x)));
  });
  return Array.from(aoa, (r) => r || []);
}
function readHTMLTable(text) {
  const t = new DOMParser().parseFromString(text, 'text/html').querySelector('table');
  return t ? Array.from(t.rows).map((r) => Array.from(r.cells).map((c) => c.textContent.trim())) : [];
}
function csvToAoa(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = text.split('\n')[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') && !first.includes(',') ? '\t' : ',');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}
function parseCSV(text) { return aoaToObjects(csvToAoa(text)); }
// cari baris judul kolom (baris pertama yang cocok dengan nama kolom yang dikenal)
function aoaToObjects(aoa, aliases) {
  const known = new Set(Object.values(aliases || {}).flat());
  const nonEmpty = (r) => (r || []).some((c) => String(c).trim() !== '');
  let h = aoa.findIndex(nonEmpty); if (h < 0) return { rows: [], headers: [] };
  if (aliases) { for (let i = 0; i < Math.min(aoa.length, 15); i++) { const hits = (aoa[i] || []).filter((c) => known.has(normHeader(c))).length; if (hits >= 1) { h = i; break; } } }
  const headers = (aoa[h] || []).map((x) => String(x).trim());
  const rows = aoa.slice(h + 1).filter(nonEmpty).map((r) => { const o = {}; headers.forEach((k, i) => { if (k) o[k] = String(r[i] ?? '').trim(); }); return o; });
  return { rows, headers };
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Format .xls lama tidak bisa dibaca. Buka file di Excel lalu "Simpan sebagai" .xlsx atau CSV.')); document.head.appendChild(s); }); }
// → { rows:[{Header:value}], headers:[...] }
async function parseImportFile(file, aliases) {
  if (!file) throw new Error('Tidak ada file dipilih.');
  if (file.size > 15 * 1024 * 1024) throw new Error('File terlalu besar (maks. 15 MB).');
  const buf = await file.arrayBuffer(); const head = new Uint8Array(buf.slice(0, 8));
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  let aoa;
  if (isZip) aoa = await readXLSX(buf);
  else if (isOle) {
    if (!window.XLSX) await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const wb = window.XLSX.read(buf, { type: 'array' });
    aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
  } else {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    aoa = /<table[\s>]/i.test(text) ? readHTMLTable(text) : csvToAoa(text);
  }
  return aoaToObjects(aoa, aliases);
}
// angka gaya Indonesia: "Rp 75.000" → 75000, "1.250.000" → 1250000, "12,5" → 12.5
function numID(v) {
  let s = String(v ?? '').replace(/rp|idr|\s/gi, '').trim(); if (!s) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0;
}
function normHeader(h) { return String(h || '').trim().toLowerCase().replace(/[\/]+/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, ''); }
function mapRow(raw, aliases) {
  const n = {}; Object.keys(raw).forEach((k) => { n[normHeader(k)] = String(raw[k] ?? '').trim(); });
  const o = {}; Object.entries(aliases).forEach(([f, al]) => { for (const a of al) if (n[a] !== undefined && n[a] !== '') { o[f] = n[a]; break; } });
  return o;
}
const ALIASES = {
  product: { name: ['name', 'nama', 'nama_produk', 'produk', 'nama_barang'], barcode: ['barcode', 'barcode_kode', 'kode', 'kode_barcode', 'sku'], category: ['category', 'kategori'], cost: ['cost', 'harga_beli', 'hargabeli', 'modal'], price: ['price', 'harga', 'harga_jual', 'hargajual'], discount: ['discount', 'diskon', 'diskon_pcs', 'potongan', 'potongan_harga'], stock: ['stock', 'stok', 'stok_awal'], commission: ['commission', 'komisi', 'komisi_sales_pcs', 'komisi_per_pcs'] },
  discount: { barcode: ['barcode', 'barcode_kode', 'kode', 'kode_barcode'], name: ['name', 'nama', 'nama_produk', 'produk'], discount: ['discount', 'diskon', 'diskon_pcs', 'potongan', 'potongan_harga', 'harga_khusus'] },
  member: { name: ['name', 'nama'], phone: ['phone', 'telepon', 'hp', 'no_hp', 'no_telepon', 'wa'], email: ['email'], points: ['points', 'poin'] },
};
function pickFile() {
  return new Promise((resolve) => {
    const i = document.createElement('input'); i.type = 'file'; i.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(i);
    i.onchange = () => { resolve(i.files[0] || null); i.remove(); };
    i.click();
  });
}

// ---------------------------------------------------------------- printer Bluetooth (ESC/POS)
const Printer = {
  char: null, device: null, status: 'disconnected', listeners: new Set(),
  supported: typeof navigator !== 'undefined' && !!navigator.bluetooth,
  set(s) { this.status = s; this.listeners.forEach((f) => f(s)); },
  async connect() {
    if (!this.supported) throw new Error('Browser ini tidak mendukung Bluetooth. Gunakan Chrome di Android / PC.');
    this.set('connecting');
    try {
      const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [0x18f0, '000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 0xff00, 0xffe0] });
      const server = await dev.gatt.connect();
      let ch = null;
      for (const svc of await server.getPrimaryServices()) { for (const c of await svc.getCharacteristics()) { if (c.properties.write || c.properties.writeWithoutResponse) { ch = c; break; } } if (ch) break; }
      if (!ch) throw new Error('Printer tidak menyediakan jalur cetak.');
      this.char = ch; this.device = dev;
      dev.addEventListener('gattserverdisconnected', () => { this.char = null; this.set('disconnected'); });
      this.set('connected');
    } catch (e) { this.set('disconnected'); throw e; }
  },
  async print(text) {
    if (!this.char) await this.connect();
    const bytes = new TextEncoder().encode(text.normalize('NFKD').replace(/[^\x00-\x7F]/g, ''));
    for (let i = 0; i < bytes.length; i += 180) {
      const chunk = bytes.slice(i, i + 180);
      if (this.char.properties.writeWithoutResponse) await this.char.writeValueWithoutResponse(chunk); else await this.char.writeValue(chunk);
      await new Promise((r) => setTimeout(r, 20));
    }
  },
  disconnect() { try { this.device?.gatt?.disconnect(); } catch (e) { /* abaikan */ } this.char = null; this.set('disconnected'); },
};
const COURIERS = [
  { id: 'J&T Express', type: 'paket', site: 'https://jet.co.id/track' },
  { id: 'JNE', type: 'paket', site: 'https://www.jne.co.id/tracking-package' },
  { id: 'SiCepat', type: 'paket', site: 'https://www.sicepat.com/checkAwb' },
  { id: 'Shopee Xpress', type: 'paket', site: 'https://spx.co.id/' },
  { id: 'Grab Express', type: 'instan', site: 'https://www.grab.com/id/express/' },
  { id: 'GoSend', type: 'instan', site: 'https://www.gojek.com/id-id/gosend' },
  { id: 'Maxim', type: 'instan', site: 'https://taximaxim.com/id/' },
  { id: 'Kurir toko', type: 'instan', site: '' },
];
function courierInfo(id) { return COURIERS.find((c) => c.id === id) || { id, type: 'paket', site: '' }; }
function trackURL(sh) { if (!sh || !sh.resi) return ''; if (/^https?:\/\//i.test(sh.resi)) return sh.resi; return courierInfo(sh.courier).type === 'paket' ? 'https://cekresi.com/?noresi=' + encodeURIComponent(sh.resi) : ''; }
function waLink(phone, text) { const n = String(phone || '').replace(/\D/g, '').replace(/^0/, '62'); return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text); }
function feePresets() { try { const a = JSON.parse(App.settings.fee_presets || '[]'); return Array.isArray(a) ? a.filter((x) => x && x.label) : []; } catch (e) { return []; } }
const PAY = { cash: 'Tunai', qris: 'QRIS', transfer: 'Debit/Transfer' };
function escposReceipt(trx, s, width = 32) {
  const ESC = '\x1B', GS = '\x1D';
  const L = (ch = '-') => ch.repeat(width) + '\n';
  const R = (a, b) => { a = String(a); b = String(b); const sp = width - a.length - b.length; return sp > 0 ? a + ' '.repeat(sp) + b + '\n' : a + '\n' + ' '.repeat(Math.max(0, width - b.length)) + b + '\n'; };
  let o = ESC + '@' + ESC + 'a\x01' + ESC + '!\x18' + (s.store_name || 'Sofeeya Store') + '\n' + ESC + '!\x00';
  if (s.receipt_address) o += s.receipt_address + '\n';
  if (s.receipt_phone) o += 'Telp: ' + s.receipt_phone + '\n';
  o += ESC + 'a\x00' + L() + R(trx.invoice, fmtDate(trx.created)) + R('Waktu', fmtTime(trx.created));
  if (trx.cashier) o += 'Kasir : ' + trx.cashier + '\n';
  if (trx.sales_name) o += 'Sales : ' + trx.sales_name + '\n';
  if (trx.member_name) o += 'Member: ' + trx.member_name + '\n';
  o += L();
  (trx.items || []).forEach((it) => { o += it.name + '\n' + R(`${it.qty} x ${rupiah(it.price)}`, rupiah(it.qty * it.price)); if (it.itemDiscount > 0) o += R('  Diskon', '-' + rupiah(it.itemDiscount)); });
  o += L() + R('Subtotal', rupiah(trx.subtotal));
  if (trx.discount > 0) o += R('Potongan', '-' + rupiah(trx.discount));
  if (trx.fee > 0) o += R('Biaya tambahan', rupiah(trx.fee));
  o += ESC + '!\x08' + R('TOTAL', rupiah(trx.total)) + ESC + '!\x00';
  o += R('Bayar (' + (PAY[trx.payment_method] || 'Tunai') + ')', rupiah(trx.payment)) + R('Kembali', rupiah(trx.change));
  if (trx.member_name) o += L() + R('Poin didapat', '+' + (trx.points_earned || 0)) + R('Total poin', String(trx.member_points_after || 0));
  if (trx.shipping) o += L() + 'Kirim: ' + trx.shipping.courier + '\n' + (trx.shipping.recipient || '') + ' ' + (trx.shipping.phone || '') + '\n' + (trx.shipping.address || '') + '\n';
  if (trx.discount > 0) o += L() + ESC + 'a\x01' + 'Anda hemat ' + rupiah(trx.discount) + '\n';
  o += L() + ESC + 'a\x01';
  if (s.receipt_footer1) o += s.receipt_footer1 + '\n';
  if (s.receipt_footer2) o += s.receipt_footer2 + '\n';
  return o + '\n\n\n' + GS + 'V\x42\x00';
}
function escposLabel(p) {
  const ESC = '\x1B', GS = '\x1D'; const code = String(p.barcode || '').trim();
  let o = ESC + '@' + ESC + 'a\x01' + String(p.name || '').slice(0, 24) + '\n' + ESC + '!\x08' + rupiah(p.price - (p.discount || 0)) + '\n' + ESC + '!\x00';
  if (code) { const d = '{B' + code; o += GS + 'h\x50' + GS + 'w\x02' + GS + 'H\x02' + GS + 'f\x00' + GS + 'k\x49' + String.fromCharCode(d.length) + d + '\n'; }
  return o + ESC + 'd\x02';
}

// ---------------------------------------------------------------- struk HTML (cetak browser)
function receiptHTML(trx, s, wide = false) {
  const it = (trx.items || []).map((i) => `<div>${esc(i.name)}</div><div class="r"><span>${i.qty} x ${rupiah(i.price)}</span><span>${rupiah(i.qty * i.price)}</span></div>${i.itemDiscount > 0 ? `<div class="r"><span>&nbsp; Diskon${i.promoName ? ' (' + esc(i.promoName) + ')' : ''}</span><span>-${rupiah(i.itemDiscount)}</span></div>` : ''}`).join('');
  return `<div class="slip ${wide ? 'w80' : ''}">
    <div class="c big">${esc(s.store_name || 'Sofeeya Store')}</div>
    ${s.receipt_address ? `<div class="c">${esc(s.receipt_address)}</div>` : ''}${s.receipt_phone ? `<div class="c">Telp: ${esc(s.receipt_phone)}</div>` : ''}
    <hr><div class="r"><span>${esc(trx.invoice)}</span><span>${fmtDT(trx.created)}</span></div>
    ${trx.cashier ? `<div>Kasir: ${esc(trx.cashier)}</div>` : ''}${trx.sales_name ? `<div>Sales: ${esc(trx.sales_name)}</div>` : ''}${trx.member_name ? `<div>Member: ${esc(trx.member_name)}</div>` : ''}
    <hr>${it}<hr>
    <div class="r"><span>Subtotal</span><span>${rupiah(trx.subtotal)}</span></div>
    ${trx.discount > 0 ? `<div class="r"><span>Potongan</span><span>-${rupiah(trx.discount)}</span></div>` : ''}
    ${trx.fee > 0 ? `<div class="r"><span>Biaya tambahan${trx.fee_note ? ' (' + esc(trx.fee_note) + ')' : ''}</span><span>${rupiah(trx.fee)}</span></div>` : ''}
    <div class="r big"><span>TOTAL</span><span>${rupiah(trx.total)}</span></div>
    <div class="r"><span>Bayar (${PAY[trx.payment_method] || 'Tunai'})</span><span>${rupiah(trx.payment)}</span></div>
    <div class="r"><span>Kembali</span><span>${rupiah(trx.change)}</span></div>
    ${trx.member_name ? `<hr><div class="r"><span>Poin didapat</span><span>+${trx.points_earned || 0}</span></div><div class="r"><span>Total poin</span><span>${trx.member_points_after || 0}</span></div>` : ''}
    ${trx.discount > 0 ? `<hr><div class="c"><b>Anda hemat ${rupiah(trx.discount)}</b></div>` : ''}
    ${trx.shipping ? `<hr><div><b>Dikirim via ${esc(trx.shipping.courier)}</b></div><div>${esc(trx.shipping.recipient)}${trx.shipping.phone ? ' (' + esc(trx.shipping.phone) + ')' : ''}</div><div>${esc(trx.shipping.address)}</div>${trx.shipping.resi ? `<div>Resi: ${esc(trx.shipping.resi)}</div>` : ''}` : ''}
    ${trx.note ? `<hr><div>Catatan: ${esc(trx.note)}</div>` : ''}
    <hr><div class="c">${esc(s.receipt_footer1 || '')}</div><div class="c">${esc(s.receipt_footer2 || '')}</div></div>`;
}
function printHTML(html) {
  let area = $('#print-area');
  if (!area) { area = document.createElement('div'); area.id = 'print-area'; document.body.appendChild(area); }
  area.innerHTML = html;
  setTimeout(() => { window.print(); }, 60);
}

// ---------------------------------------------------------------- barcode Code128-B (SVG)
const C128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
function code128SVG(text) {
  text = String(text || '').replace(/[^\x20-\x7E]/g, '');
  if (!text) return '';
  const codes = [104]; for (const ch of text) codes.push(ch.charCodeAt(0) - 32);
  let sum = 104; for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103, 106);
  let x = 10, bars = '';
  codes.forEach((c) => { const pat = C128[c]; for (let i = 0; i < pat.length; i++) { const w = +pat[i]; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="50"/>`; x += w; } });
  return `<svg viewBox="0 0 ${x + 10} 50" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}
function labelsHTML(list) {
  return `<div class="labels">${list.map((p) => `<div class="label"><div class="n">${esc(p.name)}</div>${p.barcode ? code128SVG(p.barcode) : '<div style="height:11mm"></div>'}<div class="code">${esc(p.barcode || '-')}</div><div class="p">${rupiah(p.price - (p.discount || 0))}</div></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- scanner kamera (BarcodeDetector bila tersedia)
async function scanWithCamera() {
  if (!('BarcodeDetector' in window)) { toast('Scan kamera belum didukung browser ini', 'Gunakan Chrome Android terbaru, atau pakai scanner barcode USB/Bluetooth.', 'err'); return null; }
  const detector = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'qr_code'] });
  return new Promise(async (resolve) => {
    let stream, stop = false, result = null;
    const m = modal({ title: 'Scan barcode', body: `<video playsinline muted style="width:100%;border-radius:10px;background:#000;aspect-ratio:4/3;object-fit:cover"></video><p class="muted small center">Arahkan kamera ke barcode barang.</p>`, onClose: () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); resolve(result); } });
    const video = m.$('video');
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.srcObject = stream; await video.play(); }
    catch (e) { toast('Kamera tidak dapat dibuka', 'Izinkan akses kamera di browser.', 'err'); m.close(); return; }
    const loop = async () => {
      if (stop) return;
      try { const codes = await detector.detect(video); if (codes.length) { result = codes[0].rawValue; m.close(); return; } } catch (e) { /* lanjut */ }
      requestAnimationFrame(loop);
    };
    loop();
  });
}
