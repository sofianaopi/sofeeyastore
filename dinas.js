/* SAKTI — Fitur tambahan: Laporan Perjalanan Dinas (pengawasan / pendataan lapangan)
   Tabel isi laporan disusun per tanggal yang diatur sendiri (tambah baris satu per satu),
   tidak bergantung pada Catat Kegiatan. Dokumentasi memakai foto yang dipilih dari Catat Kegiatan,
   tanpa keterangan tanggal di dokumen. */
(function () {
  'use strict';
  const S = window.SKP;
  const $ = id => document.getElementById(id);
  const JENIS = ['Pengawasan Lapangan', 'Pendataan Lapangan'];
  let C = null;              // konteks dari index.html
  let daftar = [], dimuat = false, gagalMuat = '';
  let ed = null;             // laporan yang sedang diedit
  let rows = [];             // baris tabel: {id, tanggal, tanggalAkhir?, uraian, masalah, solusi}
  let fotoPilih = [];        // urutan foto dokumentasi: [{id: fotoId, k: kegiatanId}]
  let templateBuf = null;
  let ketuaTim = {};         // dari admin (menu Bidang): {bidang: {id, nama, nip}}
  async function muatKetua() { try { const m = await S.get('meta', 'ketua_tim'); ketuaTim = (m && m.tim) || {}; } catch (e) { ketuaTim = {}; } return ketuaTim; }
  const timAda = () => Object.keys(ketuaTim).filter(b => ketuaTim[b] && ketuaTim[b].nama);

  const CSS = `
  .ld-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.3px;color:#8a5300;background:#fff3db;border:1px solid #f1d39a;border-radius:20px;padding:2px 9px;vertical-align:middle;margin-left:8px}
  .ld-langkah{display:flex;gap:10px;align-items:center;margin:0 0 12px}.ld-langkah b{width:26px;height:26px;border-radius:50%;background:#1F4E79;color:#fff;display:grid;place-items:center;font-size:13px;flex:0 0 auto}
  .ld-langkah h2{margin:0;font-size:16px}
  .ld-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}.ld-g .penuh{grid-column:1/-1}
  .ld-jenis{display:flex;gap:8px;flex-wrap:wrap}.ld-jenis label{display:flex;align-items:center;gap:8px;border:1.5px solid var(--garis);border-radius:10px;padding:10px 14px;cursor:pointer;margin:0;font-weight:600;color:var(--teks)}
  .ld-jenis input{width:auto;margin:0}.ld-jenis label:has(input:checked){border-color:#1F4E79;background:#eef5fc}
  .ld-alat{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.ld-alat input,.ld-alat select{width:auto;flex:1;min-width:150px}.ld-alat input[type=checkbox]{flex:0 0 auto;min-width:0}.ld-alat label{white-space:nowrap}
  .ld-keg{max-height:380px;overflow:auto;border:1px solid var(--garis);border-radius:12px}
  .ld-keg label{display:grid;grid-template-columns:22px 92px 1fr auto;gap:10px;align-items:start;padding:10px 12px;border-top:1px solid var(--garis);margin:0;cursor:pointer;font-weight:400;color:var(--teks)}
  .ld-keg label:first-child{border-top:0}.ld-keg label:hover{background:#f7fbff}.ld-keg input{width:auto;margin:3px 0 0}
  .ld-keg .tg{font-size:12.5px;color:var(--teks2)}.ld-keg .bd{font-size:11.5px;color:#2E75B6;font-weight:600}.ld-keg .ft{font-size:12px;color:var(--teks2);white-space:nowrap}
  .ld-keg label.on{background:#eef5fc}
  .ld-baris{border:1px solid var(--garis);border-radius:12px;padding:12px 14px;margin-top:10px;background:#fff}
  .ld-baris .kp{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:6px}
  .ld-baris .kp b{font-size:14px}.ld-baris textarea{min-height:64px}
  .ld-baris .g3{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:8px}
  .ld-hapus{border:0;background:none;color:#b42318;cursor:pointer;font:inherit;font-size:12.5px}
  .ld-aksi{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}
.ld-peringatan{color:#B45309;font-size:12.5px}
  .ld-baris .kp label{margin:0;display:flex;align-items:center;gap:8px;font-weight:600;color:var(--teks)} .ld-baris .kp input[type=date]{width:auto;min-width:160px}
  .ld-no{width:28px;height:28px;border-radius:8px;background:var(--biru-50);color:var(--biru-700);display:inline-grid;place-items:center;font-weight:800;font-size:13px;flex:0 0 auto}
  .ld-tambah{margin-top:12px;width:100%;border-style:dashed !important}
  .ld-galeri{max-height:460px;overflow:auto;border:1px solid var(--garis);border-radius:12px;padding:4px 12px 12px}
  .ld-galeri h4{margin:12px 0 8px;font-size:13px;color:var(--teks2);font-weight:600}
  .ld-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}
  .ld-ft{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:2px solid transparent;background:var(--n-50);cursor:pointer;padding:0;transition:border-color .15s,transform .12s}
  .ld-ft img{width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .25s}.ld-ft img.siap{opacity:1}
  .ld-ft .ld-urut{position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;border:2px solid #fff;background:rgba(15,23,34,.35);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .ld-ft.on{border-color:var(--biru-600)}.ld-ft.on .ld-urut{background:var(--biru-600)}
  .ld-ft .tx{position:absolute;left:0;right:0;bottom:0;padding:14px 6px 5px;font-size:11px;line-height:1.25;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.65));text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ld-ft:active{transform:scale(.97)}
  .ld-pejabat{display:flex;align-items:center;gap:12px;border:1px solid var(--garis);border-radius:12px;padding:12px 14px;background:var(--n-25)}
  .ld-pejabat .av{width:40px;height:40px;border-radius:50%;background:var(--biru-600);color:#fff;display:grid;place-items:center;font-weight:700;flex:0 0 auto}
  .ld-pejabat b{display:block;font-size:14.5px}.ld-pejabat small{color:var(--teks2);font-size:12.5px}
  .ld-pilihan{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:13px;color:var(--teks2)}
  @media (max-width:760px){.ld-g,.ld-baris .g3{grid-template-columns:1fr}.ld-keg label{grid-template-columns:22px 1fr}.ld-keg .tg{grid-column:2}.ld-keg .ft{grid-column:2}}`;

  /* ---------- util ---------- */
  const tglPanjang = d => d ? S.tglSedang(d) : '';
  // [“2026-07-02”,“2026-07-03”,“2026-07-06”] → “2, 3 dan 6 Juli 2026”
  function periodeDari(tgl) {
    // tgl: daftar tanggal 'yyyy-mm-dd' atau 'yyyy-mm-dd..yyyy-mm-dd' (rentang) → semua hari ikut dihitung
    const hari = []; tgl.filter(Boolean).forEach(t => { const [a, b] = String(t).split('..'); if (!b || b <= a) { hari.push(a); return; } const d = S.parseYmd(a); for (let i = 0; i < 62 && S.ymd(d) <= b; i++) { hari.push(S.ymd(d)); d.setDate(d.getDate() + 1); } });
    const L = [...new Set(hari)].sort(); if (!L.length) return '';
    const grup = []; L.forEach(t => { const k = t.slice(0, 7); let g = grup.find(x => x.k === k); if (!g) grup.push(g = { k, h: [] }); g.h.push(Number(t.slice(8))); });
    const gabung = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' dan ' + a[a.length - 1] : String(a[0]);
    const tahunSama = grup.every(g => g.k.slice(0, 4) === grup[0].k.slice(0, 4));
    const teks = grup.map((g, i) => gabung(g.h) + ' ' + S.BULAN[Number(g.k.slice(5)) - 1] + (!tahunSama || i === grup.length - 1 ? ' ' + g.k.slice(0, 4) : ''));
    return gabung(teks);
  }
  const rgTgl = r => r.tanggal + (r.tanggalAkhir && r.tanggalAkhir > r.tanggal ? '..' + r.tanggalAkhir : '');
  const hariBerikut = d => { const t = S.parseYmd(d); t.setDate(t.getDate() + 1); return S.ymd(t); };
  const bersihFile = t => String(t || '').replace(/[\\/:*?"<>|#%\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const ketuaTersimpan = () => { try { return JSON.parse(localStorage.getItem('sakti-ketua') || '{}'); } catch (e) { return {}; } };
  const simpanKetua = (jab, nama, nip) => { try { const m = ketuaTersimpan(); if (jab && nama) { m[jab] = nama; localStorage.setItem('sakti-ketua', JSON.stringify(m)); } if (nama && nip) { const n = nipTersimpan(); n[nama] = nip; localStorage.setItem('sakti-ketua-nip', JSON.stringify(n)); } } catch (e) { } };
  const nipTersimpan = () => { try { return JSON.parse(localStorage.getItem('sakti-ketua-nip') || '{}'); } catch (e) { return {}; } };
  const nipKetuaDari = nama => nama ? (nipTersimpan()[nama] || (daftar.find(l => l.ketua === nama && l.nipKetua) || {}).nipKetua || '') : '';

  async function muat() {
    try { daftar = await S.list('dinas'); dimuat = true; gagalMuat = ''; }
    catch (x) { daftar = []; dimuat = true; gagalMuat = /laporan_dinas|schema cache|does not exist|Could not find/i.test(x.message) ? 'Database belum diperbarui untuk fitur ini. Minta admin menjalankan setup.sql terbaru di Supabase (SQL Editor), lalu muat ulang.' : x.message; }
    return daftar;
  }
  /* id kegiatan yang dipakai di laporan dinas (untuk peringatan sebelum diarsipkan) */
  const fotoLaporan = l => l.fotos || (l.isi || []).flatMap(r => (r.fotoIds || []).map(id => ({ id, k: r.kegiatanId })));   // laporan lama: foto per baris kegiatan
  const kegiatanTerpakai = () => new Set(daftar.flatMap(l => fotoLaporan(l).map(f => f.k).concat((l.isi || []).map(r => r.kegiatanId)).filter(Boolean)));

  /* ---------- tampilan daftar ---------- */
  function kerangka() {
    const v = $('v-dinas'); if (v.dataset.siap) return; v.dataset.siap = '1';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    v.innerHTML = `
      <div class="kepala"><div style="flex:1"><h1>Laporan Perjalanan Dinas <span class="ld-badge">Fitur tambahan</span></h1>
        <p>Buat laporan perjalanan dinas <b>pengawasan</b> atau <b>pendataan lapangan</b>. Isi tabel per tanggal penugasan, lalu pilih foto dokumentasi dari Catat Kegiatan.</p></div>
        <div><button class="btn utama" type="button" id="ldBaru">+ Buat laporan</button></div></div>
      <div id="ldDaftarBox" class="kartu" style="padding:0"></div>
      <div id="ldEditor" hidden></div>`;
    $('ldBaru').onclick = () => buka(null);
    $('ldDaftarBox').addEventListener('click', klikDaftar);
  }
  function renderDaftar() {
    const box = $('ldDaftarBox'); box.hidden = false; $('ldEditor').hidden = true; $('ldBaru').hidden = false;
    if (gagalMuat) { box.innerHTML = `<div class="kosong" style="color:#b42318">${S.esc(gagalMuat)}</div>`; return; }
    const ada = new Set(C.kegiatan().map(k => k.id));
    box.innerHTML = daftar.length ? `<div class="tabel-wrap"><table class="t"><thead><tr><th>Jenis</th><th>Nomor Surat Tugas</th><th>Periode penugasan</th><th class="num">Tanggal</th><th class="num">Foto</th><th></th></tr></thead><tbody>${daftar.map(l => {
      const F = fotoLaporan(l), nF = F.length, hilang = F.filter(f => f.k && !ada.has(f.k)).length;
      return `<tr data-id="${S.esc(l.id)}"><td><b>${S.esc(l.jenis)}</b></td><td>${S.esc(l.nomor || '—')}${l.tglSt ? '<div style="font-size:12px;color:var(--teks2)">' + S.esc(tglPanjang(l.tglSt)) + '</div>' : ''}</td><td>${S.esc(l.periode || '—')}</td><td class="num">${l.isi.length}</td>
        <td class="num">${nF}${hilang ? `<div class="ld-peringatan" title="Kegiatan sudah diarsipkan ke Drive; fotonya tidak tersedia lagi di aplikasi">⚠ ${hilang} foto diarsipkan</div>` : ''}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn kecil utama" type="button" data-ld="unduh">Unduh .docx</button> <button class="btn kecil" type="button" data-ld="ubah">Ubah</button> <button class="btn kecil" type="button" data-ld="hapus" style="color:#b42318">Hapus</button></td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="kosong">Belum ada laporan perjalanan dinas.<br>Klik <b>“+ Buat laporan”</b>, tambahkan tanggal penugasan, lalu pilih foto dokumentasinya.</div>`;
    box.insertAdjacentHTML('beforeend', '<p style="font-size:12.5px;color:var(--teks2);margin:0;padding:12px 16px;border-top:1px solid var(--garis)">💡 Unduh laporan perjalanan dinas <b>sebelum</b> kegiatannya disimpan &amp; diarsipkan ke Google Drive di menu Upload Dokumen — setelah diarsipkan, foto kegiatan tidak ada lagi di aplikasi.</p>');
  }
  async function klikDaftar(e) {
    const b = e.target.closest('[data-ld]'); if (!b) return; const l = daftar.find(x => x.id === b.closest('tr').dataset.id); if (!l) return;
    if (b.dataset.ld === 'ubah') buka(l);
    else if (b.dataset.ld === 'unduh') unduh(l);
    else if (b.dataset.ld === 'hapus') {
      if (!await C.konfirmasi('Hapus laporan ini?', 'Laporan ' + l.jenis + (l.periode ? ' (' + l.periode + ')' : '') + ' akan dihapus. Catatan kegiatan dan fotonya tidak ikut terhapus.')) return;
      try { await S.del('dinas', l.id); daftar = daftar.filter(x => x !== l); renderDaftar(); S.toast('Laporan dihapus'); } catch (x) { S.toast(x.message, 5000); }
    }
  }

  /* ---------- editor ---------- */
  function buka(l) {
    const keg = C.kegiatan();
    ed = l ? JSON.parse(JSON.stringify(l)) : { id: 'ld_' + S.uid(), jenis: JENIS[0], nomor: '', tglSt: '', periode: '', tempat: 'Kendari', tglLap: '', jabatan: '', ketua: '', isi: [], fotos: [] };
    fotoPilih = fotoLaporan(ed).slice();
    rows = (ed.isi || []).map(r => ({ id: 'b' + S.uid(), tanggal: r.tanggal || '', ...(r.tanggalAkhir && r.tanggalAkhir > r.tanggal ? { tanggalAkhir: r.tanggalAkhir } : {}), uraian: r.uraian || '', masalah: r.masalah || '', solusi: r.solusi || '' }));
    const bulanAwal = rows[0] && rows[0].tanggal ? rows[0].tanggal.slice(0, 7) : (keg.length ? keg[keg.length - 1].tanggal.slice(0, 7) : S.ymd(new Date()).slice(0, 7));
    $('ldDaftarBox').hidden = true; $('ldBaru').hidden = true; const box = $('ldEditor'); box.hidden = false;
    box.innerHTML = `
      <div class="kartu form" style="margin-bottom:14px">
        <div class="ld-langkah"><b>1</b><h2>Jenis &amp; surat tugas</h2></div>
        <div class="ld-jenis">${JENIS.map(j => `<label><input type="radio" name="ldJenis" value="${j}"${ed.jenis === j ? ' checked' : ''}>${j}</label>`).join('')}
          <label><input type="radio" name="ldJenis" value="_lain"${JENIS.includes(ed.jenis) ? '' : ' checked'}>Lainnya: <input id="ldJenisLain" style="width:180px;padding:6px 8px" value="${JENIS.includes(ed.jenis) ? '' : S.esc(ed.jenis)}" placeholder="mis. Koordinasi"></label></div>
        <div class="ld-g" style="margin-top:6px">
          <div><label for="ldNomor">Nomor Surat Tugas</label><input id="ldNomor" value="${S.esc(ed.nomor)}" placeholder="B-1020/74710/KP.650/2026"></div>
          <div><label for="ldTglSt">Tanggal Surat Tugas</label><input type="date" id="ldTglSt" value="${S.esc(ed.tglSt)}"></div>
        </div>
      </div>
      <div class="kartu form" style="margin-bottom:14px">
        <div class="ld-langkah"><b>2</b><h2>Isi tabel laporan</h2></div>
        <p style="margin:-4px 0 4px;font-size:13px;color:var(--teks2)">Satu baris untuk setiap tanggal penugasan. Tambah baris sebanyak tanggal yang dibutuhkan. Untuk membuat butir (mis. daftar perusahaan), awali baris dengan tanda <b>-</b> .</p>
        <div id="ldBaris"></div>
        <button class="btn ld-tambah" type="button" id="ldTambah">+ Tambah tanggal</button>
        <div class="ld-g" style="margin-top:14px"><div class="penuh"><label for="ldPeriode">Periode penugasan <button type="button" id="ldPeriodeAuto" class="ld-hapus" style="color:var(--biru-600)">↻ isi otomatis dari tanggal di tabel</button></label><input id="ldPeriode" value="${S.esc(ed.periode)}" placeholder="mis. 2, 3 dan 6 Juli 2026"></div></div>
      </div>
      <div class="kartu form" style="margin-bottom:14px">
        <div class="ld-langkah"><b>3</b><h2>Foto dokumentasi</h2></div>
        <p style="margin:-4px 0 10px;font-size:13px;color:var(--teks2)">Ketuk foto dari Catat Kegiatan untuk dilampirkan. Nomor pada foto = urutan di laporan. Di dokumen, foto tampil tanpa keterangan tanggal.</p>
        <div class="ld-alat"><input type="month" id="ldBulan" value="${bulanAwal}" aria-label="Bulan foto"><label style="display:flex;align-items:center;gap:6px;margin:0;font-weight:500"><input type="checkbox" id="ldSesuai" style="width:auto"> hanya tanggal yang ada di tabel</label></div>
        <div class="ld-galeri" id="ldGaleri"></div>
        <div class="ld-pilihan"><span id="ldJmlFoto"></span><button type="button" class="ld-hapus" id="ldKosongFoto">Kosongkan pilihan</button></div>
      </div>
      <div class="kartu form">
        <div class="ld-langkah"><b>4</b><h2>Tanda tangan</h2></div>
        <div class="ld-g">
          <div><label for="ldTempat">Tempat</label><input id="ldTempat" value="${S.esc(ed.tempat || 'Kendari')}"></div>
          <div><label for="ldTglLap">Tanggal laporan</label><input type="date" id="ldTglLap" value="${S.esc(ed.tglLap)}"></div>
          <div class="penuh"><label for="ldTim">Mengetahui</label><select id="ldTim"><option value="">Memuat daftar ketua tim…</option></select></div>
          <div class="penuh" id="ldPejabat"></div>
          <div class="ld-manual"><label for="ldJabatan">Jabatan</label><input id="ldJabatan" value="${S.esc(ed.jabatan)}" placeholder="mis. Kepala BPS Kota Kendari"></div>
          <div class="ld-manual"><label for="ldKetua">Nama</label><input id="ldKetua" value="${S.esc(ed.ketua)}" list="ldKetuaList" placeholder="Nama lengkap"><datalist id="ldKetuaList">${[...new Set(daftar.map(l => l.ketua).concat(Object.values(ketuaTersimpan())).filter(Boolean))].map(n => `<option value="${S.esc(n)}">`).join('')}</datalist></div>
          <div class="ld-manual"><label for="ldNipKetua">NIP</label><input id="ldNipKetua" inputmode="numeric" value="${S.esc(ed.nipKetua || nipKetuaDari(ed.ketua))}" placeholder="18 digit" maxlength="24"></div>
          <div style="align-self:end;font-size:13px;color:var(--teks2);padding-bottom:10px">Petugas: <b>${S.esc(C.profil().nama || '—')}</b><br>NIP. ${C.profil().nip ? S.esc(C.profil().nip) : '<span class="ld-peringatan">belum diisi — lengkapi di menu Profil</span>'}</div>
        </div>
        <div class="ld-aksi"><button class="btn" type="button" id="ldBatal">Batal</button><button class="btn" type="button" id="ldSimpan">Simpan</button><button class="btn utama" type="button" id="ldSimpanUnduh">Simpan &amp; unduh .docx</button></div>
      </div>`;
    if (ed.periode) $('ldPeriode').dataset.manual = '1';
    if (ed.tglLap) $('ldTglLap').dataset.manual = '1';
    $('ldTambah').onclick = () => { tambahBaris(); };
    $('ldBaris').addEventListener('input', e => { const t = e.target.closest('[data-f]'); if (!t) return; const r = rows.find(x => x.id === t.closest('[data-b]').dataset.b); if (!r) return; r[t.dataset.f] = t.value; if (t.dataset.f === 'tanggal' || t.dataset.f === 'tanggalAkhir') { otomatis(); if ($('ldSesuai').checked) renderFoto(); } });
    $('ldBaris').addEventListener('click', e => { const b = e.target.closest('[data-hapus]'); if (!b) return; rows = rows.filter(x => x.id !== b.dataset.hapus); renderBaris(); otomatis(); if ($('ldSesuai').checked) renderFoto(); });
    $('ldGaleri').addEventListener('click', e => { const t = e.target.closest('[data-ft]'); if (!t) return; pilihFoto(t.dataset.ft, t.dataset.k); });
    $('ldBulan').onchange = renderFoto; $('ldSesuai').onchange = renderFoto;
    $('ldKosongFoto').onclick = () => { fotoPilih = []; renderFoto(); };
    $('ldTim').onchange = () => pakaiTim($('ldTim').value, true);
    muatKetua().then(() => isiTim());
    $('ldKetua').addEventListener('change', () => { const n = nipKetuaDari($('ldKetua').value.trim()); if (n && !$('ldNipKetua').value.trim()) $('ldNipKetua').value = n; });
    $('ldNipKetua').addEventListener('input', () => { $('ldNipKetua').value = $('ldNipKetua').value.replace(/[^\d ]/g, ''); });
    $('ldPeriode').oninput = () => { $('ldPeriode').dataset.manual = '1'; }; $('ldTglLap').oninput = () => { $('ldTglLap').dataset.manual = '1'; };
    $('ldPeriodeAuto').onclick = () => { delete $('ldPeriode').dataset.manual; otomatis(); };
    $('ldBatal').onclick = () => { ed = null; renderDaftar(); window.scrollTo(0, 0); };
    $('ldSimpan').onclick = () => simpan(false);
    $('ldSimpanUnduh').onclick = () => simpan(true);
    if (!rows.length) tambahBaris(true); else renderBaris();
    renderFoto(); window.scrollTo(0, 0);
  }
  /* baris baru: tanggal = sehari setelah baris terakhir (atau tanggal surat tugas / hari ini) */
  function tambahBaris(awal) {
    const akhir = rows.map(r => r.tanggalAkhir || r.tanggal).filter(Boolean).sort().pop();
    const tgl = akhir ? hariBerikut(akhir) : ($('ldTglSt') && $('ldTglSt').value) || S.ymd(new Date());
    rows.push({ id: 'b' + S.uid(), tanggal: tgl, uraian: '', masalah: '', solusi: '' });
    renderBaris(); otomatis();
    if (!awal) { const el = $('ldBaris').lastElementChild; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const u = el.querySelector('[data-f=uraian]'); if (u) setTimeout(() => u.focus({ preventScroll: true }), 300); } }
  }
  /* isi otomatis periode, tanggal laporan & pejabat bila belum diubah sendiri */
  function otomatis() {
    const tgl = rows.filter(r => r.tanggal);
    if (!$('ldPeriode').dataset.manual) $('ldPeriode').value = periodeDari(tgl.map(rgTgl));
    if (!$('ldTglLap').dataset.manual && tgl.length) $('ldTglLap').value = hariBerikut(tgl.map(r => r.tanggalAkhir || r.tanggal).sort().pop());
  }
  const baris = t => Math.min(10, Math.max(3, String(t || '').split('\n').length + Math.floor(String(t || '').length / 45)));
  function renderBaris() {
    $('ldBaris').innerHTML = rows.length ? rows.map((r, i) => `<div class="ld-baris" data-b="${r.id}">
        <div class="kp"><label><span class="ld-no">${i + 1}</span>Tanggal <input type="date" data-f="tanggal" value="${S.esc(r.tanggal || '')}" aria-label="Tanggal baris ${i + 1}">${r.tanggalAkhir ? ` s.d. <input type="date" data-f="tanggalAkhir" value="${S.esc(r.tanggalAkhir)}" aria-label="Sampai tanggal">` : ''}</label>
          <button type="button" class="ld-hapus" data-hapus="${r.id}">Hapus baris</button></div>
        <div class="g3"><div><label>Uraian kegiatan</label><textarea data-f="uraian" rows="${baris(r.uraian)}" placeholder="Apa yang dikerjakan pada tanggal ini…">${S.esc(r.uraian || '')}</textarea></div>
          <div><label>Permasalahan</label><textarea data-f="masalah" rows="${baris(r.masalah)}" placeholder="mis. Tidak ditemukan permasalahan…">${S.esc(r.masalah || '')}</textarea></div>
          <div><label>Solusi</label><textarea data-f="solusi" rows="${baris(r.solusi)}" placeholder="kosong = “-”">${S.esc(r.solusi || '')}</textarea></div></div></div>`).join('')
      : '<div class="kosong" style="padding:16px">Belum ada baris. Tekan <b>+ Tambah tanggal</b>.</div>';
  }
  /* galeri foto dari Catat Kegiatan, dikelompokkan per tanggal (hanya untuk memilih) */
  function renderFoto() {
    const bl = $('ldBulan').value, sesuai = $('ldSesuai').checked;
    const hari = new Set(); rows.forEach(r => { if (!r.tanggal) return; const d = S.parseYmd(r.tanggal), b = r.tanggalAkhir || r.tanggal; for (let i = 0; i < 62 && S.ymd(d) <= b; i++) { hari.add(S.ymd(d)); d.setDate(d.getDate() + 1); } });
    const kena = k => sesuai ? [...hari].some(t => t >= k.tanggal && t <= (k.tanggalAkhir || k.tanggal)) : (!bl || k.tanggal.startsWith(bl) || (k.tanggalAkhir || '').startsWith(bl));
    const L = C.kegiatan().filter(k => (k.fotoIds || []).length && kena(k)).slice().sort((a, b) => (a.tanggal + (a.jam || '')).localeCompare(b.tanggal + (b.jam || '')));
    const grup = []; L.forEach(k => { let g = grup.find(x => x.t === k.tanggal); if (!g) grup.push(g = { t: k.tanggal, ks: [] }); g.ks.push(k); });
    const urut = id => fotoPilih.findIndex(f => f.id === id);
    $('ldGaleri').innerHTML = grup.length ? grup.map(g => `<h4>${S.esc(S.tglSedang(g.t))}</h4><div class="ld-grid">${g.ks.flatMap(k => k.fotoIds.map(fid => { const n = urut(fid);
        return `<button type="button" class="ld-ft${n >= 0 ? ' on' : ''}" data-ft="${S.esc(fid)}" data-k="${S.esc(k.id)}" aria-pressed="${n >= 0}" title="${S.esc(k.teks || 'Foto bukti')}"><img alt="${S.esc(k.teks || 'Foto bukti')}" data-src="${S.esc(fid)}"><span class="ld-urut">${n >= 0 ? n + 1 : ''}</span><span class="tx">${S.esc(k.teks || 'Foto bukti')}</span></button>`; })).join('')}</div>`).join('')
      : `<div class="kosong" style="padding:18px">${sesuai ? (hari.size ? 'Tidak ada foto di Catat Kegiatan pada tanggal-tanggal di tabel.' : 'Isi dulu tanggal di tabel (langkah 2).') : 'Tidak ada foto di Catat Kegiatan pada ' + S.esc(S.namaBulan(bl)) + '. Ganti bulan di atas.'}</div>`;
    // muat gambar seperlunya (hanya yang terlihat)
    const muatImg = im => C.ambilFoto(im.dataset.src).then(f => { if (f && f.data) { im.src = f.data; im.classList.add('siap'); } }).catch(() => { });
    const imgs = $('ldGaleri').querySelectorAll('img[data-src]');
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); muatImg(e.target); } }), { root: $('ldGaleri'), rootMargin: '200px' }); imgs.forEach(im => io.observe(im)); }
    else imgs.forEach(muatImg);
    const ada = new Set(C.kegiatan().map(k => k.id)), hilang = fotoPilih.filter(f => f.k && !ada.has(f.k)).length;
    $('ldJmlFoto').innerHTML = `<b>${fotoPilih.length}</b> foto dipilih${hilang ? ` · <span class="ld-peringatan">⚠ ${hilang} dari kegiatan yang sudah diarsipkan (tidak bisa dilampirkan)</span>` : ''}`;
    $('ldKosongFoto').hidden = !fotoPilih.length;
  }
  function pilihFoto(fid, kid) {
    const i = fotoPilih.findIndex(f => f.id === fid);
    if (i >= 0) fotoPilih.splice(i, 1); else fotoPilih.push({ id: fid, k: kid });
    // isi jabatan "Ketua Tim <bidang>" dari bidang kegiatan foto bila masih kosong
    if (!$('ldTim').value && !$('ldJabatan').value.trim()) { const hit = {}; fotoPilih.forEach(f => { const k = C.kegiatan().find(x => x.id === f.k); if (k && k.bidang) hit[k.bidang] = (hit[k.bidang] || 0) + 1; }); const b = Object.keys(hit).sort((a, c) => hit[c] - hit[a])[0]; if (b && ketuaTim[b]) { $('ldTim').value = b; pakaiTim(b); } }
    // perbarui nomor urut tanpa memuat ulang gambar
    $('ldGaleri').querySelectorAll('.ld-ft').forEach(el => { const n = fotoPilih.findIndex(f => f.id === el.dataset.ft); el.classList.toggle('on', n >= 0); el.setAttribute('aria-pressed', n >= 0); el.querySelector('.ld-urut').textContent = n >= 0 ? n + 1 : ''; });
    const ada = new Set(C.kegiatan().map(k => k.id)), hilang = fotoPilih.filter(f => f.k && !ada.has(f.k)).length;
    $('ldJmlFoto').innerHTML = `<b>${fotoPilih.length}</b> foto dipilih${hilang ? ` · <span class="ld-peringatan">⚠ ${hilang} dari kegiatan yang sudah diarsipkan (tidak bisa dilampirkan)</span>` : ''}`;
    $('ldKosongFoto').hidden = !fotoPilih.length;
  }
  /* pilihan "Mengetahui": ketua tim yang ditetapkan admin, atau isi manual */
  function isiTim() {
    const T = timAda(), sel = $('ldTim'); if (!sel) return;
    sel.innerHTML = '<option value="">— pilih ketua tim —</option>' + T.map(b => `<option value="${S.esc(b)}">Ketua Tim ${S.esc(b)} — ${S.esc(ketuaTim[b].nama)}</option>`).join('') + '<option value="_manual">Lainnya (isi manual, mis. Kepala BPS)</option>';
    // laporan yang sudah ada: cocokkan dengan ketua tim bila jabatan & nama sama
    const jab = $('ldJabatan').value.trim(), nm = $('ldKetua').value.trim();
    const cocok = T.find(b => jab === 'Ketua Tim ' + b && (!nm || nm === ketuaTim[b].nama));
    if (cocok) { sel.value = cocok; pakaiTim(cocok); } else if (jab || nm) { sel.value = '_manual'; pakaiTim('_manual'); } else pakaiTim('');
    if (!T.length) $('ldPejabat').innerHTML = '<span class="ld-peringatan">Admin belum menetapkan ketua tim (menu admin → Bidang). Pilih "Lainnya" untuk mengisi manual.</span>';
  }
  function pakaiTim(b, dariPilih) {
    const manual = b === '_manual';
    document.querySelectorAll('#ldEditor .ld-manual').forEach(el => el.hidden = !manual);
    if (manual) { $('ldPejabat').innerHTML = ''; if (dariPilih) $('ldJabatan').focus(); return; }
    const k = ketuaTim[b];
    if (!k) { $('ldPejabat').innerHTML = ''; if (dariPilih) { $('ldJabatan').value = ''; $('ldKetua').value = ''; $('ldNipKetua').value = ''; } return; }
    $('ldJabatan').value = 'Ketua Tim ' + b; $('ldKetua').value = k.nama; $('ldNipKetua').value = k.nip || '';
    const ini = String(k.nama).replace(/,.*$/, '').split(/\s+/).filter(w => !/^(dr|ir|drs|dra|h|hj)\.?$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    $('ldPejabat').innerHTML = `<div class="ld-pejabat"><span class="av">${S.esc(ini)}</span><div><b>${S.esc(k.nama)}</b><small>Ketua Tim ${S.esc(b)} · ${k.nip ? 'NIP. ' + S.esc(k.nip) : '<span class="ld-peringatan">NIP baru belum diisi admin</span>'}</small></div></div>`;
  }
  function kumpulkan() {
    const j = (document.querySelector('input[name=ldJenis]:checked') || {}).value;
    ed.jenis = j === '_lain' ? ($('ldJenisLain').value.trim() || 'Pengawasan Lapangan') : j;
    ed.nomor = $('ldNomor').value.trim(); ed.tglSt = $('ldTglSt').value; ed.periode = $('ldPeriode').value.trim();
    ed.tempat = $('ldTempat').value.trim(); ed.tglLap = $('ldTglLap').value; ed.jabatan = $('ldJabatan').value.trim(); ed.ketua = $('ldKetua').value.trim(); ed.nipKetua = $('ldNipKetua').value.replace(/\s+/g, '').trim();
    ed.isi = rows.filter(r => r.tanggal || r.uraian.trim() || r.masalah.trim() || r.solusi.trim()).map(({ id, ...r }) => r).sort((a, b) => (a.tanggal || '9').localeCompare(b.tanggal || '9'));
    ed.fotos = fotoPilih.slice();
    return ed;
  }
  async function simpan(lanjutUnduh) {
    const l = kumpulkan();
    if (!l.isi.length) { S.toast('Tambahkan minimal satu tanggal di tabel laporan (langkah 2)'); return; }
    if (l.isi.some(r => !r.tanggal)) { S.toast('Ada baris tabel yang belum diberi tanggal'); return; }
    if (!l.periode) l.periode = periodeDari(l.isi.map(rgTgl));
    try {
      await S.put('dinas', l); simpanKetua(l.jabatan, l.ketua, l.nipKetua);
      const i = daftar.findIndex(x => x.id === l.id); if (i >= 0) daftar[i] = l; else daftar.unshift(l);
      S.toast('Laporan disimpan');
      if (lanjutUnduh) await unduh(l);
      ed = null; renderDaftar(); window.scrollTo(0, 0);
    } catch (x) { S.toast(/laporan_dinas|schema cache|does not exist/i.test(x.message) ? 'Database belum diperbarui untuk fitur ini — minta admin menjalankan setup.sql terbaru.' : x.message, 6000); }
  }

  /* ---------- dokumen Word ---------- */
  async function ambilTemplate() {
    if (!templateBuf) { const r = await fetch('template-laporan-dinas.docx', { cache: 'no-cache' }); if (!r.ok) throw new Error('Berkas template-laporan-dinas.docx tidak ditemukan di website'); templateBuf = await r.arrayBuffer(); }
    return templateBuf.slice(0);
  }
  async function unduh(l) {
    const sb = S.sibuk('Menyusun laporan perjalanan dinas…');
    try {
      const fotos = []; let hilang = 0, n = 0; const daftarFoto = fotoLaporan(l);
      for (const x of daftarFoto) {   // dokumentasi tanpa keterangan tanggal
        sb.pesan('Mengambil foto ' + (++n) + ' dari ' + daftarFoto.length + '…');
        const f = await C.ambilFoto(x.id).catch(() => null);
        if (f && f.data) fotos.push({ data: f.data, w: f.w, h: f.h }); else hilang++;
      }
      sb.pesan('Menyusun dokumen Word…');
      const p = C.profil();
      const [kopD, footerD] = await Promise.all([S.get('meta', 'kop_dinas').catch(() => null), S.get('meta', 'footer_dinas').catch(() => null)]);
      const blob = await DOCX.laporanDinas({ template: await ambilTemplate(), kop: kopD, footer: footerD, jenis: l.jenis, nomor: l.nomor, tglSt: l.tglSt ? S.tglSedang(l.tglSt) : '', nama: p.nama || '',
        periode: l.periode || periodeDari(l.isi.map(rgTgl)),
        baris: l.isi.map(r => ({ tanggal: r.tanggal ? S.rentangTgl(r.tanggal, r.tanggalAkhir) : '', uraian: r.uraian, masalah: r.masalah, solusi: r.solusi })),
        tempatTgl: [l.tempat, l.tglLap ? S.tglSedang(l.tglLap) : ''].filter(Boolean).join(', '), jabatan: l.jabatan, ketua: l.ketua, nipKetua: l.nipKetua || '', petugas: p.nama || '', nipPetugas: p.nip || '', fotos });
      sb.selesai();
      const nama = bersihFile('Laporan Perjalanan Dinas ' + l.jenis + '_' + (l.periode || '')).slice(0, 120) + '.docx';
      await S.download(nama, blob);
      S.toast('Laporan siap: ' + nama + (hilang ? ' · ' + hilang + ' foto tidak tersedia (kegiatan sudah diarsipkan)' : ''), hilang ? 7000 : 4000);
    } catch (x) { console.error(x); S.toast('Gagal membuat laporan: ' + (x.message || x), 6000); }
    finally { sb.selesai(); }
  }

  window.SKPDinas = {
    init(ctx) { C = ctx; return muat(); },
    async render() { kerangka(); if (!dimuat) { $('ldDaftarBox').innerHTML = '<div class="kosong">Memuat…</div>'; await muat(); } if (!ed) renderDaftar(); },
    kegiatanTerpakai, periodeDari
  };
})();
