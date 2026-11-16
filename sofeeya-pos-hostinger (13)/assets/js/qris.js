/* QRIS — ubah QRIS statis toko menjadi QRIS dengan nominal (standar EMVCo/QRIS, tag 54) */
'use strict';
const QRIS = (() => {
  function crc16(str) { // CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF)
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function parse(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      const tag = s.substr(i, 2), len = parseInt(s.substr(i + 2, 2), 10);
      if (!/^\d{2}$/.test(tag) || Number.isNaN(len)) throw new Error('Format QRIS tidak valid.');
      const val = s.substr(i + 4, len);
      if (val.length !== len) throw new Error('Data QRIS terpotong.');
      out.push([tag, val]); i += 4 + len;
    }
    return out;
  }
  const build = (tlv) => tlv.map(([t, v]) => t + String(v.length).padStart(2, '0') + v).join('');
  function info(payload) {
    const s = String(payload || '').trim();
    if (!s.startsWith('000201')) throw new Error('Ini bukan kode QRIS. Pastikan memakai QRIS toko (bukan QR biasa).');
    const tlv = parse(s);
    const get = (t) => (tlv.find((x) => x[0] === t) || [])[1] || '';
    const crcOk = s.length > 8 && crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase();
    const merchantInfo = tlv.filter(([t]) => +t >= 26 && +t <= 51);
    if (!merchantInfo.length) throw new Error('QRIS tidak berisi data merchant.');
    let nmid = '';
    merchantInfo.forEach(([, v]) => { try { const sub = parse(v); const id = (sub.find((x) => x[0] === '02') || [])[1]; if (id && /^ID/.test(id)) nmid = id; } catch (e) { /* abaikan */ } });
    return { name: get('59'), city: get('60'), dynamic: get('01') === '12', amount: get('54'), nmid, crcOk };
  }
  function withAmount(payload, amount) {
    const s = String(payload || '').trim();
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0) throw new Error('Nominal harus lebih dari 0.');
    let tlv = parse(s).filter(([t]) => t !== '63' && t !== '54');
    tlv = tlv.map(([t, v]) => (t === '01' ? ['01', '12'] : [t, v]));
    const at = tlv.findIndex(([t]) => +t > 54);
    tlv.splice(at < 0 ? tlv.length : at, 0, ['54', String(amt)]);
    const body = build(tlv) + '6304';
    return body + crc16(body);
  }
  function svg(text, px = 280) {
    let qr = null;
    for (let t = 1; t <= 40; t++) { try { qr = new QRLib.QRCode(t, QRLib.ECL.M); qr.addData(text); qr.make(); break; } catch (e) { qr = null; } }
    if (!qr) throw new Error('Data terlalu panjang untuk QR.');
    const n = qr.getModuleCount(), q = 4, size = n + q * 2; let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="Kode QRIS"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  // baca QR dari foto (BarcodeDetector, cadangan: jsQR dari CDN)
  async function decodeImage(file) {
    const bmp = await createImageBitmap(file);
    if ('BarcodeDetector' in window) {
      try { const r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bmp); if (r.length) return r[0].rawValue; } catch (e) { /* lanjut */ }
    }
    if (!window.jsQR) await loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js').catch(() => { throw new Error('Tidak bisa membaca foto di browser ini. Gunakan "Scan pakai kamera" atau tempel teks QRIS.'); });
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
    const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const res = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
    if (!res) throw new Error('QR tidak terbaca dari foto. Foto ulang lebih dekat, terang, dan tidak miring.');
    return res.data;
  }
  return { crc16, parse, info, withAmount, svg, decodeImage };
})();

// Layar QRIS untuk pembeli (dipakai di kasir & menu QRIS)
function qrisPanel(amount, opt = {}) {
  const payload = App.settings.qris_payload || '';
  if (!payload) return `<div class="panel panel-b center"><b>QRIS belum diatur</b><p class="small muted" style="margin:6px 0 0">${App.isAdmin() ? 'Atur di <a href="#pengaturan">Pengaturan toko → QRIS</a>.' : 'Minta admin mengatur QRIS toko di Pengaturan toko.'}</p></div>`;
  try {
    const inf = QRIS.info(payload);
    const code = QRIS.withAmount(payload, amount);
    return `<div class="qris-box ${opt.big ? 'big' : ''}"><div class="qris-head"><span class="qris-logo">QRIS</span><span>${esc(inf.name || App.settings.store_name || '')}</span></div>${QRIS.svg(code, opt.big ? 360 : 230)}<div class="qris-amt">${rupiah(amount)}</div><div class="small muted">Scan dengan aplikasi bank / e-wallet apa pun${inf.nmid ? ` · NMID ${esc(inf.nmid)}` : ''}</div></div>`;
  } catch (e) { return `<div class="panel panel-b danger">${esc(e.message)}</div>`; }
}
function qrisFullscreen(amount) {
  const bg = document.createElement('div');
  bg.className = 'qris-full'; bg.innerHTML = `${qrisPanel(amount, { big: true })}<p class="small" style="color:#fff;opacity:.8;margin-top:14px">Ketuk di mana saja untuk menutup</p>`;
  bg.onclick = () => bg.remove();
  document.body.appendChild(bg);
}
