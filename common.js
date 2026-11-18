/* SAKTI (Sahabat Kinerja Terintegrasi) — lapisan data (database Supabase), login, & utilitas bersama */
(function () {
  'use strict';
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const CFG = Object.assign({}, window.SKP_CONFIG || {});
  // Rapikan alamat bila tertulis dengan garis miring di akhir atau berakhiran /rest/v1/
  if (CFG.SUPABASE_URL) CFG.SUPABASE_URL = String(CFG.SUPABASE_URL).trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '');
  if (CFG.SUPABASE_ANON_KEY) CFG.SUPABASE_ANON_KEY = String(CFG.SUPABASE_ANON_KEY).trim();
  const BUCKET = 'bukti';
  const BIDANG = ['Sosial', 'Distribusi', 'Produksi', 'Nerwilis', 'IPDS', 'TU'];

  /* ---------- Koneksi ---------- */
  let sb = null, uid = null, saya = null;
  const siap = () => CFG.SUPABASE_URL && /^https?:\/\//.test(CFG.SUPABASE_URL) && CFG.SUPABASE_ANON_KEY && !/^ISI_/.test(CFG.SUPABASE_ANON_KEY) && window.supabase;
  function client() {
    if (!sb) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'skp-harian-auth' } });
    return sb;
  }
  const emailDariNip = nip => String(nip || '').toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@' + (CFG.EMAIL_DOMAIN || 'pegawai.skpharian.id');
  function cek(res, pesan) {
    if (res.error) {
      const m = res.error.message || String(res.error);
      const e = new Error(/schema cache|does not exist|Could not find the (table|column|function)/i.test(m) ? 'Database belum diperbarui ke versi terbaru. Admin perlu menjalankan setup.sql terbaru di Supabase (SQL Editor → Run), lalu muat ulang halaman ini.' : /JWT|token/i.test(m) ? 'Sesi berakhir, silakan masuk lagi.' : /row-level security/i.test(m) ? 'Tidak diizinkan oleh aturan akses.' : (pesan ? pesan + ': ' : '') + m);
      e.asli = res.error; throw e;
    }
    return res.data;
  }

  /* ---------- Pemetaan baris database <-> objek aplikasi ---------- */
  const keK = r => ({ id: r.id, tanggal: r.tanggal, jam: r.jam || '', teks: r.teks || '', bidang: r.bidang || null, jenisId: r.jenis_id || null, rhkId: r.rk_id || null, jumlah: r.jumlah || 1, fotoIds: Array.isArray(r.foto) ? r.foto : [], dibuat: Number(r.dibuat) || 0, gabung: r.gabung === undefined ? undefined : (r.gabung || null), tanggalAkhir: r.tanggal_akhir === undefined ? undefined : (r.tanggal_akhir || null) });
  const dariK = k => { const o = { id: k.id, user_id: uid, tanggal: k.tanggal, jam: k.jam || null, teks: k.teks || '', bidang: k.bidang || null, jenis_id: k.jenisId || null, rk_id: k.rhkId || null, jumlah: Math.max(1, parseInt(k.jumlah) || 1), foto: k.fotoIds || [], dibuat: k.dibuat || Date.now() };
    if (k.gabung !== undefined) o.gabung = k.gabung || null;   // kolom baru: hanya dikirim bila sudah dipakai
    if (k.tanggalAkhir !== undefined) o.tanggal_akhir = k.tanggalAkhir && k.tanggalAkhir > k.tanggal ? k.tanggalAkhir : null;
    return o; };
  const keR = r => ({ id: r.id, bidang: r.bidang || null, nama: r.nama || '', indikator: r.indikator || '', satuan: r.satuan || '', target: Number(r.target) || 0, targetBulan: r.target_bulan || {}, urutan: r.urutan || 0, bersama: !!r.bersama });
  const dariR = r => ({ id: r.id, user_id: uid, bidang: r.bidang || null, nama: r.nama || '', indikator: r.indikator || null, satuan: r.satuan || null, target: Number(r.target) || 0, target_bulan: r.targetBulan || {}, urutan: r.urutan || 0, bersama: !!r.bersama });
  const keL = r => ({ id: r.id, jenis: r.jenis || 'Pengawasan Lapangan', nomor: r.nomor_st || '', tglSt: r.tanggal_st || '', periode: r.periode || '', tempat: r.tempat || '', tglLap: r.tanggal_lap || '', jabatan: r.jabatan || '', ketua: r.ketua || '', isi: (Array.isArray(r.isi) ? r.isi : []).filter(x => !(x && x._fotos)), ...((Array.isArray(r.isi) ? r.isi : []).find(x => x && x._fotos) ? { fotos: r.isi.find(x => x && x._fotos)._fotos, nipKetua: r.isi.find(x => x && x._fotos).nipKetua || '' } : {}), dibuat: r.dibuat, diubah: r.diubah });
  const dariL = o => ({ id: o.id, user_id: uid, jenis: o.jenis || 'Pengawasan Lapangan', nomor_st: o.nomor || null, tanggal_st: o.tglSt || null, periode: o.periode || null, tempat: o.tempat || null, tanggal_lap: o.tglLap || null, jabatan: o.jabatan || null, ketua: o.ketua || null, isi: (o.isi || []).concat(o.fotos || o.nipKetua ? [{ _fotos: o.fotos || [], ...(o.nipKetua ? { nipKetua: o.nipKetua } : {}) }] : []), diubah: new Date().toISOString() });   // foto dokumentasi disimpan di elemen khusus isi (tanpa perubahan database)
  const keD = r => ({ id: r.id, bidang: r.bidang, periode: r.periode, nama: r.nama_file, driveId: r.drive_id, url: r.url, ukuran: Number(r.ukuran) || 0, dibuat: r.dibuat });
  const keJ = r => ({ id: r.id, bidang: r.bidang, nama: r.nama, urutan: r.urutan || 0, dibuatOleh: r.dibuat_oleh });
  const PROFIL = { nama: 'nama', nip: 'nip_baru', jabatan: 'jabatan', unit: 'unit', kota: 'kota', atasanNama: 'atasan_nama', atasanNip: 'atasan_nip', atasanJabatan: 'atasan_jabatan' };
  const keP = r => { const o = { id: 'profil', peran: r.peran, aktif: r.aktif, username: r.nip }; Object.entries(PROFIL).forEach(([a, b]) => o[a] = r[b] || ''); return o; };
  const fotoPath = id => uid + '/' + id + '.jpg';

  function dataUrlKeBlob(d) { const [h, b] = d.split(','); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' }); }
  const blobKeDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const ukuran = d => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 4, h: 3 }); i.src = d; });

  let bc = null; try { bc = new BroadcastChannel('skp-harian'); } catch (e) { }
  const listeners = new Set();
  if (bc) bc.onmessage = () => listeners.forEach(f => f());
  const notify = () => { try { bc && bc.postMessage('changed'); } catch (e) { } };

  /* RK yang sama (IKI berbeda) diletakkan berurutan; urutan kelompok mengikuti kemunculan pertama */
  function urutRk(L) { const k = r => (r.bidang || '') + '|' + String(r.nama || '').trim().replace(/\s+/g, ' ').toLowerCase(); const m = new Map(); L.forEach(r => { if (!m.has(k(r))) m.set(k(r), []); m.get(k(r)).push(r); }); return [...m.values()].flat(); }
  const db = {
    async list(s) {
      const c = client();
      if (s === 'kegiatan') return cek(await c.from('kegiatan').select('*').eq('user_id', uid).order('tanggal').limit(10000)).map(keK);
      if (s === 'rhk') return urutRk(cek(await c.from('rk').select('*').or('user_id.eq.' + uid + ',bersama.eq.true').order('bersama', { ascending: false }).order('urutan')).map(keR));
      if (s === 'rhkBersama') return urutRk(cek(await c.from('rk').select('*').eq('bersama', true).order('urutan')).map(keR));
      if (s === 'ringkas') return cek(await c.from('kegiatan_ringkas').select('tanggal,jumlah,foto').eq('user_id', uid)).map(r => ({ tanggal: r.tanggal, jumlah: Number(r.jumlah) || 0, foto: Number(r.foto) || 0 }));
      if (s === 'dinas') return cek(await c.from('laporan_dinas').select('*').eq('user_id', uid).order('diubah', { ascending: false })).map(keL);
      if (s === 'dokumen') return cek(await c.from('dokumen').select('*').eq('user_id', uid).order('dibuat', { ascending: false })).map(keD);
      if (s === 'jenis') return cek(await c.from('jenis_kegiatan').select('*').order('bidang').order('urutan').order('nama')).map(keJ);
      if (s === 'foto') { const ks = await db.list('kegiatan'); const out = []; for (const k of ks) for (const id of k.fotoIds) { const f = await db.get('foto', id); if (f) out.push(f); } return out; }
      return [];
    },
    async get(s, id) {
      const c = client();
      if (s === 'foto') {
        const r = await c.storage.from(BUCKET).download(fotoPath(id)); if (r.error || !r.data) return null;
        const data = await blobKeDataUrl(r.data); return Object.assign({ id, data }, await ukuran(data));
      }
      if (s === 'meta' && id === 'profil') { const r = cek(await c.from('pegawai').select('*').eq('id', uid).maybeSingle()); return r ? keP(r) : { id: 'profil' }; }
      if (s === 'meta') { const r = cek(await c.from('pengaturan').select('value').eq('key', id).maybeSingle()); return r ? Object.assign({ id }, r.value) : null; }
      if (s === 'kegiatan') { const r = cek(await c.from('kegiatan').select('*').eq('id', id).maybeSingle()); return r ? keK(r) : null; }
      if (s === 'rhk') { const r = cek(await c.from('rk').select('*').eq('id', id).maybeSingle()); return r ? keR(r) : null; }
      return null;
    },
    async put(s, o) {
      const c = client();
      if (s === 'foto') { cek(await c.storage.from(BUCKET).upload(fotoPath(o.id), dataUrlKeBlob(o.data), { upsert: true, contentType: 'image/jpeg' }), 'Gagal mengunggah foto'); return o; }
      if (s === 'kegiatan') cek(await c.from('kegiatan').upsert(dariK(o)), 'Gagal menyimpan kegiatan');
      else if (s === 'rhk') cek(await c.from('rk').upsert(dariR(o)), 'Gagal menyimpan RK');
      else if (s === 'dinas') cek(await c.from('laporan_dinas').upsert(dariL(o)), 'Gagal menyimpan laporan');
      else if (s === 'dokumen') cek(await c.from('dokumen').upsert({ id: o.id, user_id: uid, bidang: o.bidang || null, periode: o.periode || null, nama_file: o.nama, drive_id: o.driveId || null, url: o.url, ukuran: o.ukuran || null, dibuat: new Date().toISOString() }), 'Gagal menyimpan link dokumen');
      else if (s === 'jenis') { const r = { id: o.id, bidang: o.bidang, nama: (o.nama || '').trim(), urutan: o.urutan || 0 }; if (!o.dibuatOleh) r.dibuat_oleh = uid; const res = await c.from('jenis_kegiatan').upsert(r); if (res.error && /duplicate|unik/i.test(res.error.message)) throw new Error('Jenis kegiatan "' + r.nama + '" sudah ada di bidang ' + r.bidang); cek(res, 'Gagal menyimpan jenis kegiatan'); }
      else if (s === 'meta' && o.id === 'profil') { const u = {}; Object.entries(PROFIL).forEach(([a, b]) => { if (a !== 'nip') u[b] = (o[a] || '').trim() || null; }); u.nama = u.nama || saya.nama; cek(await c.from('pegawai').update(u).eq('id', uid), 'Gagal menyimpan profil'); Object.assign(saya, u); }
      else if (s === 'meta') { const v = Object.assign({}, o); delete v.id; cek(await c.from('pengaturan').upsert({ key: o.id, value: v }), 'Gagal menyimpan pengaturan'); }
      notify(); return o;
    },
    async putBanyak(s, arr, progres) {   // simpan banyak kegiatan sekaligus (impor Excel)
      if (s !== 'kegiatan' && s !== 'rhk') throw new Error('putBanyak hanya untuk kegiatan/RK');
      const c = client(); const tabel = s === 'rhk' ? 'rk' : 'kegiatan', peta = s === 'rhk' ? dariR : dariK;
      for (let i = 0; i < arr.length; i += 200) {
        cek(await c.from(tabel).upsert(arr.slice(i, i + 200).map(peta)), 'Gagal menyimpan ' + (s === 'rhk' ? 'RK' : 'kegiatan'));
        if (progres) progres(Math.min(arr.length, i + 200), arr.length);
      }
      notify();
    },
    async arsipkanKegiatan(ks) {   // catat ringkasan + hapus kegiatan (satu transaksi di database), lalu hapus fotonya
      const c = client();
      const ids = ks.map(k => k.id);
      for (let i = 0; i < ids.length; i += 500) cek(await c.rpc('arsipkan_kegiatan', { p_ids: ids.slice(i, i + 500) }), 'Gagal mengarsipkan kegiatan');
      const paths = ks.flatMap(k => (k.fotoIds || []).map(fotoPath)); let gagalFoto = 0;
      for (let i = 0; i < paths.length; i += 100) { const r = await c.storage.from(BUCKET).remove(paths.slice(i, i + 100)); if (r.error) gagalFoto += paths.slice(i, i + 100).length; }
      notify(); return { gagalFoto };
    },
    async hapusBanyakRk(ids) {   // hapus banyak RK sekaligus (kegiatan yang memakainya otomatis menjadi tanpa RK)
      const c = client();
      for (let i = 0; i < ids.length; i += 200) cek(await c.from('rk').delete().in('id', ids.slice(i, i + 200)), 'Gagal menghapus RK');
      notify();
    },
    async hapusBanyakKegiatan(ks) {   // hapus banyak kegiatan + fotonya sekaligus
      const c = client();
      const paths = ks.flatMap(k => (k.fotoIds || []).map(fotoPath));
      for (let i = 0; i < paths.length; i += 100) { const r = await c.storage.from(BUCKET).remove(paths.slice(i, i + 100)); if (r.error) throw new Error('Gagal menghapus foto: ' + r.error.message); }
      const ids = ks.map(k => k.id);
      for (let i = 0; i < ids.length; i += 200) cek(await c.from('kegiatan').delete().in('id', ids.slice(i, i + 200)), 'Gagal menghapus kegiatan');
      notify();
    },
    async del(s, id) {
      const c = client();
      if (s === 'foto') { await c.storage.from(BUCKET).remove([fotoPath(id)]); return; }
      if (s === 'kegiatan') cek(await c.from('kegiatan').delete().eq('id', id));
      else if (s === 'rhk') cek(await c.from('rk').delete().eq('id', id));
      else if (s === 'dokumen') cek(await c.from('dokumen').delete().eq('id', id));
      else if (s === 'dinas') cek(await c.from('laporan_dinas').delete().eq('id', id), 'Gagal menghapus laporan');
      else if (s === 'jenis') cek(await c.from('jenis_kegiatan').delete().eq('id', id), 'Gagal menghapus jenis kegiatan');
      else if (s === 'meta' && id !== 'profil') cek(await c.from('pengaturan').delete().eq('key', id));
      notify();
    }
  };

  /* ---------- Layar login ---------- */
  const CSS = `#skp-login[hidden]{display:none!important}
  #skp-login{position:fixed;inset:0;z-index:1000;overflow:auto;font-family:"Nunito","Segoe UI",-apple-system,Roboto,Arial,sans-serif;color:#162038;font-weight:600;
    background:radial-gradient(700px 520px at 100% 0,#D3E2FF 0,rgba(211,226,255,0) 70%),radial-gradient(640px 520px at 0 100%,#E6DFFF 0,rgba(230,223,255,0) 70%),#EAF1FC}
  #skp-login .lg-latar{position:fixed;inset:0;pointer-events:none;overflow:hidden}
  #skp-login .lg-gelembung{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,rgba(255,255,255,0) 70%)}
  #skp-login .lg-g1{width:340px;height:340px;left:8%;top:6%;opacity:.8}#skp-login .lg-g2{width:200px;height:200px;left:40%;bottom:6%;background:radial-gradient(circle,rgba(255,224,234,.9),rgba(255,224,234,0) 70%)}
  #skp-login .lg-panggung{position:absolute;left:0;top:0;bottom:0;width:56%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px}
  #skp-login .lg-duo{display:flex;align-items:flex-end;justify-content:center;position:relative}#skp-login .lg-duo::after{content:"";position:absolute;left:8%;right:8%;bottom:-6px;height:22px;border-radius:50%;background:radial-gradient(closest-side,rgba(40,80,160,.22),rgba(40,80,160,0))}
  #skp-login .lg-maskot{height:min(400px,46vh);width:auto;position:relative;z-index:1;filter:drop-shadow(0 18px 24px rgba(40,80,160,.22));animation:lgApung 5s ease-in-out infinite}#skp-login .lg-m2{margin-left:-6%;animation-delay:-2.5s}#skp-login .lg-maskot{-webkit-mask-image:linear-gradient(180deg,#000 80%,transparent 100%);mask-image:linear-gradient(180deg,#000 80%,transparent 100%)}#skp-login .lg-duo::after{display:none}
  @keyframes lgApung{50%{transform:translateY(-10px)}}
  #skp-login .lg-teks{text-align:center;color:#1C3A75}
  #skp-login .lg-teks .t1{font-size:clamp(40px,min(5.6vw,9vh),78px);font-weight:900;letter-spacing:-1px;line-height:1}
  #skp-login .lg-teks .t2{font-size:clamp(17px,min(2vw,3.2vh),26px);font-weight:800;margin-top:6px;color:#2F5DB8}
  #skp-login .lg-teks .t3{font-size:clamp(13px,min(1.3vw,2.2vh),17px);font-weight:700;line-height:1.4;color:#4D5D7F;margin-top:8px}
  #skp-login .lg-isi{position:relative;min-height:100%;display:flex;align-items:center;justify-content:flex-end;padding:28px 7vw 28px 20px;box-sizing:border-box}
  #skp-login .kartu-login{position:relative;background:#fff;border-radius:32px;width:100%;max-width:430px;padding:30px 32px 26px;box-sizing:border-box;
    box-shadow:inset 0 2px 0 #fff,inset 0 -4px 0 rgba(120,150,210,.14),0 30px 60px -20px rgba(28,58,117,.4),0 4px 10px rgba(40,80,160,.06)}
  #skp-login .lg-logo{width:84px;height:auto;display:block;margin:0 auto 6px;filter:drop-shadow(0 8px 10px rgba(47,93,184,.3))}
  #skp-login h1{font-size:32px;line-height:1.1;text-align:center;margin:0;padding:0;border:0;color:#1C3A75;font-weight:900;letter-spacing:-.5px}
  #skp-login .sub{text-align:center;color:#2F5DB8;font-size:15.5px;font-weight:800;margin:4px 0 0;padding:0;border:0}
  #skp-login .sambut{text-align:center;color:#4D5D7F;font-size:14px;line-height:1.5;margin:10px 0 14px;font-weight:600}
  #skp-login label{display:block;font-size:12.5px;color:#4D5D7F;margin:12px 0 5px 6px;font-weight:700}
  #skp-login .fld{display:flex;align-items:center;gap:10px;background:#F5F8FE;border:1.5px solid #DFE7F4;border-radius:999px;padding:6px 14px 6px 6px;margin-top:12px;box-shadow:inset 0 2px 5px rgba(40,80,160,.08);transition:border-color .15s,box-shadow .15s,background .15s}
  #skp-login .fld:focus-within{border-color:#4F80E0;background:#fff;box-shadow:inset 0 2px 5px rgba(40,80,160,.06),0 0 0 4px rgba(79,128,224,.25)}
  #skp-login .fld .ic{flex:0 0 40px;height:40px;border-radius:50%;background:linear-gradient(180deg,#fff,#E3ECFF);display:grid;place-items:center;box-shadow:inset 0 2px 0 #fff,inset 0 -3px 0 rgba(110,140,200,.2),0 4px 8px -4px rgba(40,80,160,.35)}
  #skp-login .fld .ic svg{width:20px;height:20px;fill:#3F70D2}
  #skp-login .fld input{flex:1;min-width:0;border:0;outline:0;background:transparent;padding:10px 2px;font-size:16px;font-family:inherit;font-weight:700;color:#162038}
  #skp-login .fld input::placeholder{color:#5E6F92;font-weight:600}
  #skp-login .mata{flex:0 0 auto;width:38px;height:38px;border:0;background:none;padding:0;margin:0;cursor:pointer;display:grid;place-items:center;border-radius:50%}
  #skp-login .mata svg{width:22px;height:22px;fill:none;stroke:#4D5D7F;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  #skp-login .mata:hover{background:#EEF4FF}
  #skp-login .tbl{width:100%;margin-top:20px;padding:15px;border:0;border-radius:999px;background:linear-gradient(180deg,#5B8BE6,#3566CC);color:#fff;font-size:16.5px;font-weight:900;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px;text-shadow:0 1px 0 rgba(15,40,105,.3);
    box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -5px 0 rgba(15,40,105,.3),0 14px 22px -10px rgba(47,93,184,.8);transition:transform .12s,box-shadow .12s,filter .2s}
  #skp-login .tbl:active{transform:translateY(3px);box-shadow:inset 0 3px 8px rgba(10,30,80,.4)}
  #skp-login .tbl svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  #skp-login .tbl:hover{filter:brightness(1.06)}#skp-login .tbl:disabled{opacity:.6;cursor:progress}
  #skp-login .err{color:#b42318;font-size:13.5px;margin-top:8px;text-align:center;font-weight:700}#skp-login .err:empty{display:none}
  #skp-login .link{width:100%;border:0;background:none;color:#2F5DB8;font-weight:800;font-size:13.5px;padding:8px;margin-top:4px;cursor:pointer;font-family:inherit}
  #skp-login .ket{font-size:13px;color:#23304D;background:#DCE8FF;border-radius:16px;padding:10px 12px;margin-top:6px;line-height:1.5}
  #skp-login .lg-kaki{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:18px}
  #skp-login .lg-kaki div{text-align:center;font-size:12px;line-height:1.3;color:#23304D;font-weight:800;background:#EEF4FF;border-radius:16px;padding:10px 4px;box-shadow:inset 0 2px 0 #fff,inset 0 -3px 0 rgba(110,140,200,.14)}
  #skp-login .lg-kaki div:nth-child(2){background:#FFE0EA}#skp-login .lg-kaki div:nth-child(3){background:#D9F5E6}
  #skp-login .lg-kaki svg{display:block;width:26px;height:26px;margin:0 auto 5px;fill:none;stroke:#3F70D2;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  #skp-login .lg-kaki div:nth-child(2) svg{stroke:#B4335F}#skp-login .lg-kaki div:nth-child(3) svg{stroke:#17734F}
  @media (max-height:720px) and (min-width:861px){
    #skp-login .kartu-login{padding:20px 30px 18px}#skp-login .lg-logo{width:62px;margin-bottom:2px}#skp-login h1{font-size:26px}
    #skp-login .sub{font-size:14.5px}#skp-login .sambut{margin:6px 0 8px;font-size:13.5px}#skp-login .fld{margin-top:9px}#skp-login .tbl{margin-top:14px;padding:12px}
  }
  @media (max-width:860px){
    #skp-login .lg-panggung{display:none}
    #skp-login .lg-isi{justify-content:center;padding:126px 16px 22px}
    #skp-login .kartu-login{padding:56px 20px 18px;border-radius:28px}
    #skp-login .kartu-login::before{content:"";position:absolute;left:50%;top:-112px;width:150px;height:140px;transform:translateX(-50%);background:url(img/karakter-perempuan.webp) left bottom/auto 100% no-repeat,url(img/karakter-laki.webp) right bottom/auto 100% no-repeat;filter:drop-shadow(0 10px 12px rgba(40,80,160,.25))}
    #skp-login .lg-logo{display:none}
    #skp-login h1{font-size:28px}#skp-login .sub{font-size:14.5px}#skp-login .sambut{font-size:13.5px;margin:8px 0 10px}
  }
  @media (prefers-reduced-motion:reduce){#skp-login .lg-maskot{animation:none}}`;
  const IKON = {
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2"/><path d="M3.8 20.5c.6-4.2 4-6.6 8.2-6.6s7.6 2.4 8.2 6.6z"/></svg>',
    kunci: '<svg viewBox="0 0 24 24"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A2.5 2.5 0 0 1 20 12.5v7A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-7A2.5 2.5 0 0 1 6.5 10zm2.2 0h5.6V7.5a2.8 2.8 0 0 0-5.6 0zM12 14a1.6 1.6 0 0 0-.8 3v1.6h1.6V17a1.6 1.6 0 0 0-.8-3z"/></svg>',
    lihat: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    tutup: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    masuk: '<svg viewBox="0 0 24 24"><path d="M14 3h4.5A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M3 12h12"/><path d="M11 7.5 15.5 12 11 16.5"/></svg>'
  };
  function layar(html) {
    let el = document.getElementById('skp-login');
    if (!el) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); el = document.createElement('div'); el.id = 'skp-login'; document.body.appendChild(el); }
    el.innerHTML = `<div class="lg-latar" aria-hidden="true"><div class="lg-gelembung lg-g1"></div><div class="lg-gelembung lg-g2"></div><div class="lg-panggung"><div class="lg-duo"><img class="lg-maskot" src="img/karakter-perempuan.webp" alt="" width="520" height="909"><img class="lg-maskot lg-m2" src="img/karakter-laki.webp" alt="" width="520" height="914"></div><div class="lg-teks"><div class="t1">SAKTI</div><div class="t2">Sahabat Kinerja Terintegrasi</div><div class="t3">Asisten Cerdas Penyusunan SKP Triwulanan<br>BPS Kota Kendari</div></div></div></div>
      <div class="lg-isi"><div class="kartu-login" role="dialog" aria-label="Masuk">
      <img class="lg-logo" src="img/logo-sakti.svg" alt="Logo SAKTI" width="84" height="84"><h1>SAKTI</h1><div class="sub">Sahabat Kinerja Terintegrasi</div>
      <div class="sambut">Asisten Cerdas Penyusunan SKP Triwulanan<br>BPS Kota Kendari</div>${html}</div></div>`;
    el.hidden = false; return el;
  }
  const pwField = (id, ac, ph = 'Password') => `<div class="fld"><span class="ic">${IKON.kunci}</span><input id="${id}" type="password" autocomplete="${ac}" required placeholder="${ph}" aria-label="${ph}"><button type="button" class="mata" data-lihat="${id}" aria-label="Tampilkan password">${IKON.tutup}</button></div>`;
  const fldTeks = (id, ph, extra = '') => `<div class="fld"><span class="ic">${IKON.user}</span><input id="${id}" placeholder="${ph}" aria-label="${ph}" ${extra}></div>`;
  function pasangLihat(el) { el.querySelectorAll('[data-lihat]').forEach(s => s.onclick = () => { const i = el.querySelector('#' + s.dataset.lihat); const buka = i.type === 'password'; i.type = buka ? 'text' : 'password'; s.innerHTML = buka ? IKON.lihat : IKON.tutup; s.setAttribute('aria-label', buka ? 'Sembunyikan password' : 'Tampilkan password'); }); }

  function formLogin(pesan) {
    return new Promise(resolve => {
      const el = layar(`<form id="fLogin">${fldTeks('lNip', 'NIP lama / Username', 'autocomplete="username" autocapitalize="off" required')}
        ${pwField('lPw', 'current-password')}
        <button type="submit" class="tbl">${IKON.masuk}Masuk</button><div class="err" id="lErr">${esc(pesan || '')}</div></form><div id="lSetup"></div>`);
      pasangLihat(el);
      try { const n = localStorage.getItem('skp-nip-terakhir'); if (n) el.querySelector('#lNip').value = n; } catch (e) { }
      el.querySelector(el.querySelector('#lNip').value ? '#lPw' : '#lNip').focus();
      el.querySelector('#fLogin').onsubmit = async e => {
        e.preventDefault(); const b = el.querySelector('button[type=submit]'); b.disabled = true; el.querySelector('#lErr').textContent = '';
        const nip = el.querySelector('#lNip').value.trim();
        const r = await client().auth.signInWithPassword({ email: emailDariNip(nip), password: el.querySelector('#lPw').value });
        b.disabled = false;
        if (r.error) { el.querySelector('#lErr').textContent = /invalid/i.test(r.error.message) ? 'NIP lama/username atau password salah.' : r.error.message; return; }
        try { localStorage.setItem('skp-nip-terakhir', nip); } catch (er) { }
        resolve();
      };
      client().rpc('ada_admin').then(r => {
        if (r.error || r.data !== false) return;
        const s = el.querySelector('#lSetup');
        s.innerHTML = `<button class="link" type="button" id="lMulai">Penyiapan awal: daftarkan admin pertama →</button>`;
        s.querySelector('#lMulai').onclick = () => formAdminPertama().then(resolve);
      });
    });
  }
  function formAdminPertama() {
    return new Promise(resolve => {
      const el = layar(`<form id="fAdm"><div class="ket">Database masih kosong. Akun pertama ini menjadi <b>admin</b> yang nanti menambahkan pegawai lain.</div>
        ${fldTeks('aNama', 'Nama admin (mis. Admin SKP)', 'required')}${fldTeks('aNip', 'Username untuk masuk (mis. admin)', 'required autocapitalize="off" autocomplete="username"')}
        ${pwField('aPw', 'new-password', 'Password (min. 6 karakter)')}
        <button type="submit" class="tbl">${IKON.masuk}Buat akun admin</button><div class="err" id="aErr"></div></form>`);
      pasangLihat(el);
      el.querySelector('#fAdm').onsubmit = async e => {
        e.preventDefault(); const b = el.querySelector('button[type=submit]'); b.disabled = true; const er = el.querySelector('#aErr'); er.textContent = '';
        try {
          const nip = el.querySelector('#aNip').value.trim().toLowerCase(), pw = el.querySelector('#aPw').value;
          if (!/^[a-z0-9._-]{3,40}$/.test(nip)) throw new Error('Username 3–40 karakter: huruf kecil, angka, titik, minus, atau garis bawah');
          if (pw.length < 6) throw new Error('Password minimal 6 karakter');
          let r = await client().auth.signUp({ email: emailDariNip(nip), password: pw });
          if (r.error && /already/i.test(r.error.message)) r = await client().auth.signInWithPassword({ email: emailDariNip(nip), password: pw });
          if (r.error) throw r.error;
          if (!r.data.session) throw new Error('Akun dibuat tetapi belum aktif. Di Supabase matikan "Confirm email" (lihat PANDUAN), lalu coba lagi.');
          cek(await client().rpc('daftar_admin_pertama', { p_nip: nip, p_nama: el.querySelector('#aNama').value.trim() }));
          try { localStorage.setItem('skp-nip-terakhir', nip); } catch (x) { }
          resolve();
        } catch (x) { er.textContent = x.message || String(x); b.disabled = false; }
      };
    });
  }

  /* Daftar bidang pekerjaan: diatur admin (menu Bidang), disimpan di pengaturan 'bidang' */
  const BIDANG_BAWAAN = BIDANG.slice();
  async function muatBidang() {
    try {
      const r = await client().from('pengaturan').select('value').eq('key', 'bidang').maybeSingle();
      const d = r.data && r.data.value && Array.isArray(r.data.value.daftar) ? r.data.value.daftar.map(x => String(x).trim()).filter(Boolean) : null;
      BIDANG.splice(0, BIDANG.length, ...(d && d.length ? d : BIDANG_BAWAAN));
    } catch (e) { }
    return BIDANG;
  }
  /* Bidang dari daftar + bidang lama yang masih dipakai data (mis. bidang yang sudah dihapus dari daftar) */
  function bidangDari(...nama) { const out = BIDANG.slice(); nama.flat().forEach(b => { if (b && !out.includes(b)) out.push(b); }); return out; }

  async function mulai(opt = {}) {
    if (!siap()) {
      layar(`<div class="ket" style="background:#fff7e6">${window.supabase ? '<b>Koneksi database belum diatur.</b><br>Buka berkas <code>config.js</code> lalu isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> sesuai PANDUAN.' : '<b>Tidak dapat memuat pustaka database.</b><br>Periksa koneksi internet lalu muat ulang halaman.'}</div>`);
      return new Promise(() => { });
    }
    const c = client(); let pesan = '';
    for (; ;) {
      const { data } = await c.auth.getSession();
      if (!data.session) {
        // Database kosong (belum ada admin): langsung tampilkan formulir admin pertama
        const cekAdmin = await c.rpc('ada_admin');
        if (cekAdmin.error) {
          const m = cekAdmin.error.message || '';
          pesan = /schema cache|does not exist|Could not find/i.test(m) ? 'Database belum disiapkan: jalankan setup.sql di Supabase (SQL Editor), lalu muat ulang.'
            : /Invalid API key|JWT|apikey|No API key/i.test(m) ? 'Kunci di config.js tidak valid. Periksa SUPABASE_ANON_KEY (gunakan kunci anon/publishable).'
            : 'Tidak dapat terhubung ke database: ' + m + '. Periksa SUPABASE_URL di config.js dan koneksi internet.';
          await formLogin(pesan); continue;
        }
        if (cekAdmin.data === false) { await formAdminPertama(); pesan = ''; continue; }
        await formLogin(pesan); continue;
      }
      uid = data.session.user.id;
      { const mk = (data.session.user.user_metadata || {}).karakter; if (KARAKTER[mk]) { karakterKu = mk; try { localStorage.setItem('sakti-karakter-' + uid, mk); } catch (e) { } } }
      const r = await c.from('pegawai').select('*').eq('id', uid).maybeSingle();
      if (r.error) { pesan = 'Gagal memuat akun: ' + r.error.message; await c.auth.signOut(); continue; }
      if (!r.data || !r.data.aktif) { pesan = !r.data ? 'Akun ini belum terdaftar sebagai pegawai. Hubungi admin.' : 'Akun Anda dinonaktifkan. Hubungi admin.'; await c.auth.signOut(); continue; }
      saya = r.data; break;
    }
    pasangKarakter();
    if (opt.pimpinan && saya.peran !== 'pimpinan') {
      layar(`<div class="ket">Halaman ini khusus <b>pimpinan</b>. Anda masuk sebagai ${esc(saya.nama)}.</div><button type="button" class="tbl" onclick="location.href='${saya.peran === 'admin' ? 'admin.html' : 'index.html'}'">Kembali</button>`);
      return new Promise(() => { });
    }
    if (opt.admin && saya.peran !== 'admin') {
      layar(`<div class="ket">Halaman ini khusus <b>admin</b>. Anda masuk sebagai ${esc(saya.nama)}.</div><button type="button" class="tbl" onclick="location.href='index.html'">Ke Dashboard saya</button>`);
      return new Promise(() => { });
    }
    await muatBidang();
    const el = document.getElementById('skp-login'); if (el) el.hidden = true;
    c.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.reload(); });
    if (saya.peran !== 'admin' && !/kuis\.html/i.test(location.pathname)) { ajakKuis(); setInterval(ajakKuis, 20000); document.addEventListener('visibilitychange', () => { if (!document.hidden) ajakKuis(); }); }
    return { uid, pegawai: saya };
  }
  /* Menu Kuis BerAKHLAK: tampil di menu setiap pengguna selama ada kuis yang berlangsung */
  async function ajakKuis() {
    if (!document.getElementById('skp-kuis-css')) { const st = document.createElement('style'); st.id = 'skp-kuis-css'; st.textContent = `[data-kuis-menu][hidden]{display:none!important}
      .skp-live{display:inline-flex;align-items:center;gap:4px;margin-left:auto;background:#e21b3c;color:#fff;font-size:10px;font-weight:800;letter-spacing:.04em;border-radius:99px;padding:2px 7px;line-height:1.4}
      .skp-live.titik{padding:0;width:9px;height:9px;flex:0 0 auto;background:#ff4d6d;box-shadow:0 0 0 3px rgba(255,77,109,.3);animation:skpLive 1.2s ease-in-out infinite}.skp-live.titik::before{display:none}nav.sisi a.menu-kuis{white-space:nowrap}
      .skp-live::before{content:"";width:6px;height:6px;border-radius:50%;background:#fff;animation:skpLive 1.2s ease-in-out infinite}@keyframes skpLive{50%{opacity:.2}}
      nav.sisi a.menu-kuis{background:linear-gradient(135deg,#46178f,#7b2ff7)!important;color:#fff!important;font-weight:700}
      .bawah-nav a.kuis{color:#7b2ff7!important;font-weight:700;position:relative}.bawah-nav a.kuis::after,.ikon-kuis::after{content:"";position:absolute;top:6px;right:calc(50% - 16px);width:8px;height:8px;border-radius:50%;background:#e21b3c;box-shadow:0 0 0 2px #fff;animation:skpLive 1.2s ease-in-out infinite}
      .ikon-kuis{position:relative}.ikon-kuis::after{top:4px;right:4px}body.kuis-on .bawah-nav a[data-r=profil]{display:none}`; document.head.appendChild(st); }
    let k = null; try { const r = await client().rpc('kuis_aktif'); k = r.error ? null : r.data; } catch (e) { }
    const el = document.querySelectorAll('[data-kuis-menu]');
    document.body.classList.toggle('kuis-on', !!k);
    if (!k) { el.forEach(x => x.hidden = true); return; }
    const href = 'kuis.html' + (k.ikut ? '' : '?pin=' + encodeURIComponent(k.pin));
    el.forEach(x => { x.hidden = false; x.href = href; x.title = k.ikut ? 'Kembali ke kuis' : 'Ikut ' + k.judul + ' (PIN ' + k.pin + ')'; });
    let sudah = null; try { sudah = sessionStorage.getItem('sakti-kuis-info'); sessionStorage.setItem('sakti-kuis-info', k.pin); } catch (e) { }
    if (!k.ikut && sudah !== k.pin && el.length) toast('🎮 ' + k.judul + ' sedang berlangsung. Buka menu Kuis untuk ikut bermain.', 6000);
  }
  async function token() { const { data } = await client().auth.getSession(); if (!data.session) throw new Error('Sesi berakhir, silakan masuk lagi.'); return data.session.access_token; }
  /* Kirim perintah ke Google Apps Script (penyimpan dokumen ke Google Drive) */
  async function drive(url, aksi, isi) {
    if (!url) throw new Error('Penyimpanan Google Drive belum diaktifkan admin');
    let r;
    try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ aksi, token: await token() }, isi || {})) }); }
    catch (e) { throw new Error('Tidak dapat menghubungi Google Drive. Periksa koneksi internet atau alamat Apps Script.'); }
    let j; try { j = await r.json(); } catch (e) { throw new Error('Jawaban Apps Script tidak dikenali. Pastikan di-deploy sebagai Web app dengan akses "Anyone".'); }
    if (!j.ok) throw new Error(j.error || 'Google Drive menolak permintaan');
    return j;
  }
  async function keluar() { try { await client().auth.signOut(); } catch (e) { } location.reload(); }
  /* karakter sapaan (perempuan/laki-laki) dipilih pegawai di Profil, disimpan di metadata akun (tanpa ubah database) */
  const KARAKTER = { p: 'img/karakter-perempuan.webp', l: 'img/karakter-laki.webp' };
  let karakterKu = null;
  function karakter() { if (karakterKu) return karakterKu; try { return localStorage.getItem('sakti-karakter-' + uid) || 'p'; } catch (e) { return 'p'; } }
  function pasangKarakter() { const k = karakter(); document.querySelectorAll('img[data-karakter]').forEach(i => { if (i.getAttribute('src') !== KARAKTER[k]) i.src = KARAKTER[k]; }); document.querySelectorAll('[data-pilih-karakter] [data-k]').forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }
  async function aturKarakter(k) { if (!KARAKTER[k]) return; cek(await client().auth.updateUser({ data: { karakter: k } }), 'Gagal menyimpan pilihan karakter'); karakterKu = k; try { localStorage.setItem('sakti-karakter-' + uid, k); } catch (e) { } pasangKarakter(); }
  function pasangPilihKarakter(el) { if (!el) return; el.addEventListener('click', async e => { const b = e.target.closest('[data-k]'); if (!b || b.classList.contains('on')) return; const lama = karakter(); karakterKu = b.dataset.k; pasangKarakter();
    try { await aturKarakter(b.dataset.k); toast('Karakter sapaan disimpan'); } catch (x) { karakterKu = lama; pasangKarakter(); toast(x.message, 5000); } }); pasangKarakter(); }
  async function gantiPassword(pw) { if (!pw || pw.length < 6) throw new Error('Password minimal 6 karakter'); cek(await client().auth.updateUser({ password: pw })); }

  /* ---------- Utilitas ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const mkid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function tglPanjang(s) { const d = parseYmd(s); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
  function tglSedang(s) { const d = parseYmd(s); return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
  /* "2–4 November 2026", "30 Oktober – 2 November 2026", atau satu tanggal */
  /* ---------- Pencocokan otomatis uraian kegiatan → RK & IKI ----------
     Kata dasar sederhana (awalan/akhiran bahasa Indonesia dipangkas) + bobot kata langka (IDF)
     + riwayat: kegiatan lama yang mirip dan sudah ber-RK menjadi petunjuk kuat. */
  const KATA_ABAI = new Set('yang dan di ke dari untuk dengan pada dalam oleh serta atau ini itu sebagai bagi para secara terkait tentang terhadap hari tanggal kota kendari bps kegiatan melakukan dilakukan telah sudah akan juga hal agar guna tahun bulan minggu pekan sesuai dalam rangka kab provinsi badan pusat statistik the of'.split(' '));
  function kataDasar(w) {
    if (w.length <= 4 || /\d/.test(w)) return w;
    let s = w;
    if (s.endsWith('nya') && s.length > 6) s = s.slice(0, -3);
    if (s.length > 6 && /(kan|an)$/.test(s)) s = s.replace(/(kan|an)$/, '');
    else if (s.length > 6 && s.endsWith('i') && !/[aiueo]i$/.test(s.slice(-2)) ) s = s.slice(0, -1);
    const P = [['meny', 's'], ['peny', 's'], ['meng', ''], ['peng', ''], ['mem', ''], ['pem', ''], ['men', ''], ['pen', ''], ['ber', ''], ['ter', ''], ['per', ''], ['me', ''], ['pe', ''], ['di', ''], ['ke', ''], ['se', '']];
    for (const [p, g] of P) if (s.startsWith(p) && s.length - p.length >= 4) { s = g + s.slice(p.length); break; }
    return s;
  }
  const tokenRk = t => [...new Set(String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 1 && !KATA_ABAI.has(w) && !/^(i|ii|iii|iv|\d+)$/.test(w)).map(kataDasar).filter(w => w.length > 1 && !KATA_ABAI.has(w)))];
  function cocokRk(teks, rhkList, opsi) {
    opsi = opsi || {}; const q = tokenRk(teks); if (!q.length || !rhkList || !rhkList.length) return [];
    const dok = rhkList.map(r => ({ r, nama: new Set(tokenRk(r.nama)), iki: new Set(tokenRk(r.indikator)) }));
    const df = new Map(); dok.forEach(d => new Set([...d.nama, ...d.iki]).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
    const N = dok.length, idf = t => Math.log(1 + N / (df.get(t) || 0.5));
    // riwayat: kegiatan lama (punya RK) yang kalimatnya mirip
    const hist = new Map();
    (opsi.riwayat || []).forEach(k => { if (!k.rhkId) return; const K = tokenRk(k.gabung || k.teks); if (!K.length) return;
      const sama = q.filter(t => K.includes(t)).length; if (sama < 2) return;
      const sim = sama / Math.min(q.length, K.length); if (sim > (hist.get(k.rhkId) || 0)) hist.set(k.rhkId, sim); });
    const hasil = dok.map(d => {
      let s = 0; const kena = [];
      q.forEach(t => { const di = d.nama.has(t) || d.iki.has(t); if (!di) return; const w = idf(t); s += w; if (d.iki.has(t)) s += w * 0.35; kena.push(t); });
      const h = hist.get(d.r.id) || 0; if (h >= 0.5) s += 2.6 * h;
      if (opsi.bidang && d.r.bidang === opsi.bidang) s *= 1.2;
      return { r: d.r, skor: s, kata: kena, riwayat: h };
    }).filter(x => x.skor > 0).sort((a, b) => b.skor - a.skor);
    return hasil;
  }

  /* RK & IKI: kelompokkan baris (bidang + nama RK sama) → satu RK berisi beberapa IKI */
  const kunciRkTeks = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  function kelompokRk(list) {
    const m = new Map(), out = [];
    list.forEach(r => { const k = (r.bidang || '') + '|' + kunciRkTeks(r.nama); let g = m.get(k); if (!g) { g = { kunci: k, bidang: r.bidang || '', nama: r.nama || '', iki: [] }; m.set(k, g); out.push(g); } g.iki.push(r); });
    return out;
  }
  /* Navigasi halaman: ‹ 1 2 3 … 9 › — dipakai tabel RK & IKI */
  function pager(el, hal, total, jumlah, satuan, perHal) {
    if (total <= 1) { el.innerHTML = jumlah ? `<span class="pg-info">${jumlah} ${satuan}</span>` : ''; return; }
    const no = []; for (let i = 1; i <= total; i++) if (i === 1 || i === total || Math.abs(i - hal) <= 1) no.push(i); else if (no[no.length - 1] !== '…') no.push('…');
    const a = (hal - 1) * perHal + 1, z = Math.min(hal * perHal, jumlah);
    el.innerHTML = `<span class="pg-info">Menampilkan ${a}–${z} dari ${jumlah} ${satuan}</span><span class="pg-nav"><button type="button" data-hal="${hal - 1}" ${hal <= 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>` +
      no.map(i => i === '…' ? '<span class="pg-titik">…</span>' : `<button type="button" data-hal="${i}"${i === hal ? ' class="aktif" aria-current="page"' : ''}>${i}</button>`).join('') +
      `<button type="button" data-hal="${hal + 1}" ${hal >= total ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button></span>`;
  }
  function rentangTgl(a, b) {
    if (!a) return ''; if (!b || b <= a) return tglSedang(a);
    const A = parseYmd(a), Z = parseYmd(b);
    if (A.getFullYear() !== Z.getFullYear()) return tglSedang(a) + ' – ' + tglSedang(b);
    if (A.getMonth() !== Z.getMonth()) return A.getDate() + ' ' + BULAN[A.getMonth()] + ' – ' + tglSedang(b);
    return A.getDate() + '–' + tglSedang(b);
  }
  function namaBulan(ym) { const [y, m] = ym.split('-').map(Number); return BULAN[m - 1] + ' ' + y; }
  function labelHari(s) { const t = ymd(new Date()); const k = new Date(); k.setDate(k.getDate() - 1); if (s === t) return 'Hari ini'; if (s === ymd(k)) return 'Kemarin'; return tglPanjang(s); }
  function targetBulan(rhk, ym) { if (rhk.targetBulan && rhk.targetBulan[ym] != null && rhk.targetBulan[ym] !== '') return Number(rhk.targetBulan[ym]); return Number(rhk.target || 0); }
  function compressImage(file, max = 1280, q = 0.72) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
        const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); let data = c.toDataURL('image/jpeg', q); if (data.length > 400000) data = c.toDataURL('image/jpeg', 0.55); res({ data, w, h });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak bisa dibaca')); };
      img.src = url;
    });
  }
  async function download(filename, blob) {
    // iPhone/iPad yang membuka aplikasi dari layar utama tidak mendukung unduhan biasa: pakai menu Bagikan
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    if (ios && standalone && navigator.canShare && window.File) {
      try { const f = new File([blob], filename, { type: blob.type || 'application/octet-stream' }); if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: filename }); return true; } }
      catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
  }
  /* Angka KPI menghitung naik saat tampil (≈0,7 detik). Mati bila perangkat diatur "kurangi gerakan". */
  const HITUNG = '.kpi b.angka, .d-tile > b, .stat .angka', hitungLalu = new Map();
  function hitungNaik(el) {
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue)); if (!tn || el._hitung === tn.nodeValue) return;
    const m = tn.nodeValue.match(/^(\D*?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?(.*)$/s); if (!m) return;
    const akhir = Number(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '')), des = m[3] ? m[3].length : 0, ribuan = m[2].includes('.') || akhir >= 1000;
    const kartu = el.closest('.kpi, .d-tile, .stat'), kunci = (kartu ? kartu.className + '|' + ((kartu.querySelector('.k-lbl, .t-kep, .lbl, small') || {}).textContent || '') : '');
    if (!isFinite(akhir) || akhir === 0 || hitungLalu.get(kunci) === tn.nodeValue) { el._hitung = tn.nodeValue; return; }   // nilai sama dengan tampilan sebelumnya: tidak dihitung ulang
    hitungLalu.set(kunci, tn.nodeValue);
    const tulis = v => m[1] + v.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des, useGrouping: ribuan }) + m[4];
    const t0 = performance.now(), dur = 700, sel = tulis(akhir);
    const f = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); tn.nodeValue = k < 1 ? tulis(des ? Math.round(akhir * e * 10 ** des) / 10 ** des : Math.round(akhir * e)) : sel; el._hitung = tn.nodeValue; if (k < 1) requestAnimationFrame(f); };
    el._hitung = tulis(0); tn.nodeValue = el._hitung; requestAnimationFrame(f);
  }
  function pasangHitung() {
    if (!window.MutationObserver || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    let jadwal = 0; const jalan = () => { jadwal = 0; document.querySelectorAll(HITUNG).forEach(el => { if (el.offsetParent !== null) hitungNaik(el); }); };
    new MutationObserver(() => { if (!jadwal) jadwal = requestAnimationFrame(jalan); }).observe(document.body, { childList: true, subtree: true });
    jadwal = requestAnimationFrame(jalan);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasangHitung); else pasangHitung();

  /* Wilayah yang bisa digulir (tabel lebar, daftar obrolan) dapat difokus & digulir dengan keyboard */
  function tandaiGulir() {
    const tandai = () => document.querySelectorAll('.tabel-wrap, .pm-tabel-wrap, #chat, .kz-daftar').forEach(el => {
      if (el.hasAttribute('data-gulir')) return; el.setAttribute('data-gulir', ''); if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if (el.tagName !== 'MAIN' && !el.getAttribute('role')) { el.setAttribute('role', 'region'); if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.id === 'chat' ? 'Daftar catatan kegiatan' : 'Tabel, dapat digulir ke samping'); }
    });
    let j = 0; if (window.MutationObserver) new MutationObserver(() => { if (!j) j = requestAnimationFrame(() => { j = 0; tandai(); }); }).observe(document.body, { childList: true, subtree: true });
    tandai();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tandaiGulir); else tandaiGulir();

  /* ===== Gerak interaktif: tombol beriak & memantul saat ditekan, halaman bergeser sesuai arah menu ===== */
  const GERAK_MATI = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOMBOL = '.btn, .qa button, .seg button, .pm-seg button, .p-btn, .kz-tbtn, .kz-sbtn, .kz-chipset button, .kz-main, .bulan button, .d-btn-kaca, .pg-nav button, .bawah-nav a, nav.sisi a.menu, .sb nav.tab a, #kirim, .bd, .chip, #skp-login button[type=submit], .pm-panah, .lnk, .kz-tabs button, .sr-tipe button, .rk-pilih';
  function pasangGerak() {
    // riak (ripple) dari titik sentuh
    document.addEventListener('pointerdown', e => {
      if (GERAK_MATI() || e.button > 0) return;
      const el = e.target.closest(TOMBOL); if (!el || el.disabled || el.tagName === 'INPUT') return;
      const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
      s.className = 'skp-riak'; s.setAttribute('aria-hidden', 'true');
      s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      el.classList.add('skp-riak-host'); el.appendChild(s); setTimeout(() => s.remove(), 650);
    }, { passive: true });
    // pantulan pegas saat dilepas (kecuali tombol yang memang tetap "tertekan" karena terpilih)
    document.addEventListener('click', e => {
      if (GERAK_MATI()) return;
      const el = e.target.closest(TOMBOL); if (!el || el.disabled || el.matches('.on, .aktif, [aria-pressed=true]')) return;
      el.classList.remove('skp-pantul'); void el.offsetWidth; el.classList.add('skp-pantul');
      setTimeout(() => el.classList.remove('skp-pantul'), 450);
    }, true);
    // arah pergeseran halaman: maju bila menu tujuan berada di bawah/kanan menu asal
    const rute = () => (location.hash.slice(1).split('/')[0] || 'dashboard');
    let lalu = rute();
    window.addEventListener('hashchange', () => {
      const r = rute(), L = [...document.querySelectorAll('nav.sisi a[data-r], .sb nav.tab a[data-r]')].map(a => a.dataset.r);
      const a = L.indexOf(lalu === 'lihat' ? 'pegawai' : lalu), b = L.indexOf(r === 'lihat' ? 'pegawai' : r);
      document.documentElement.dataset.arah = r === 'lihat' ? 'maju' : lalu === 'lihat' ? 'mundur' : (a < 0 || b < 0 || b >= a) ? 'maju' : 'mundur';
      lalu = r;
      setTimeout(() => document.querySelectorAll('.topbar h1, .tb-judul h1').forEach(h => { h.classList.remove('skp-judul'); void h.offsetWidth; h.classList.add('skp-judul'); }), 0);
    });
    // penanda menu bawah (HP) yang meluncur ke menu aktif
    const nav = document.querySelector('.bawah-nav');
    if (nav) {
      const pil = document.createElement('span'); pil.className = 'skp-nav-pil'; pil.setAttribute('aria-hidden', 'true'); nav.appendChild(pil);
      const geser = () => { const a = nav.querySelector('a.aktif'); if (!a || !a.offsetParent) { pil.style.opacity = '0'; return; } const n = nav.getBoundingClientRect(), r = a.getBoundingClientRect(), w = Math.min(36, r.width * .5);
        pil.style.opacity = '1'; pil.style.width = w + 'px'; pil.style.transform = `translateX(${r.left - n.left + (r.width - w) / 2}px)`; };
      new MutationObserver(() => requestAnimationFrame(geser)).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
      window.addEventListener('resize', geser); setTimeout(geser, 300);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasangGerak); else pasangGerak();

  function toast(msg, ms = 2800) {
    let t = document.getElementById('skp-toast'); if (!t) { t = document.createElement('div'); t.id = 'skp-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show'; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', ms);
  }

  /* Layar "sedang diproses": menutup seluruh halaman (mencegah klik berulang) sampai proses selesai */
  const sibukList = [];
  /* Nilai dasar ASN BerAKHLAK (SE Menteri PANRB No. 20 Tahun 2021) — satu nilai per hari tampil di popup loading */
  const BERAKHLAK = [
    { h: 'B', n: 'Berorientasi Pelayanan', w: '#1d4ed8', m: 'Komitmen memberikan pelayanan prima demi kepuasan masyarakat', p: ['Memahami dan memenuhi kebutuhan masyarakat', 'Ramah, cekatan, solutif, dan dapat diandalkan', 'Melakukan perbaikan tiada henti'] },
    { h: 'A', n: 'Akuntabel', w: '#0f766e', m: 'Bertanggung jawab atas kepercayaan yang diberikan', p: ['Melaksanakan tugas dengan jujur, bertanggung jawab, cermat, disiplin, dan berintegritas tinggi', 'Menggunakan kekayaan dan barang milik negara secara bertanggung jawab, efektif, dan efisien', 'Tidak menyalahgunakan kewenangan jabatan'] },
    { h: 'K', n: 'Kompeten', w: '#7c3aed', m: 'Terus belajar dan mengembangkan kapabilitas', p: ['Meningkatkan kompetensi diri untuk menjawab tantangan yang selalu berubah', 'Membantu orang lain belajar', 'Melaksanakan tugas dengan kualitas terbaik'] },
    { h: 'H', n: 'Harmonis', w: '#db2777', m: 'Saling peduli dan menghargai perbedaan', p: ['Menghargai setiap orang apa pun latar belakangnya', 'Suka menolong orang lain', 'Membangun lingkungan kerja yang kondusif'] },
    { h: 'L', n: 'Loyal', w: '#b91c1c', m: 'Berdedikasi dan mengutamakan kepentingan Bangsa dan Negara', p: ['Memegang teguh ideologi Pancasila, UUD 1945, setia kepada NKRI serta pemerintahan yang sah', 'Menjaga nama baik sesama ASN, pimpinan, instansi, dan negara', 'Menjaga rahasia jabatan dan negara'] },
    { h: 'A', n: 'Adaptif', w: '#C2410C', m: 'Terus berinovasi dan antusias dalam menggerakkan serta menghadapi perubahan', p: ['Cepat menyesuaikan diri menghadapi perubahan', 'Terus berinovasi dan mengembangkan kreativitas', 'Bertindak proaktif'] },
    { h: 'K', n: 'Kolaboratif', w: '#047857', m: 'Membangun kerja sama yang sinergis', p: ['Memberi kesempatan kepada berbagai pihak untuk berkontribusi', 'Terbuka dalam bekerja sama untuk menghasilkan nilai tambah', 'Menggerakkan pemanfaatan berbagai sumber daya untuk tujuan bersama'] }];
  /* Bank soal kuis BerAKHLAK — dibuat otomatis dari materi nilai dasar ASN (SE Menteri PANRB No. 20 Tahun 2021) */
  function soalBerakhlak() {
    const B = BERAKHLAK, acak = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pilih = (benar, salah) => { const p = acak([benar].concat(acak(salah).slice(0, 3))); return { p, b: p.indexOf(benar) }; };
    const lain = v => B.filter(x => x !== v);
    const L = [];
    B.forEach(v => {
      v.p.forEach(pp => L.push(Object.assign({ t: `Panduan perilaku “${pp}” termasuk nilai BerAKHLAK…`, k: 'perilaku' }, pilih(v.n, lain(v).map(x => x.n)))));
      L.push(Object.assign({ t: `Makna nilai ${v.n} adalah…`, k: 'makna' }, pilih(v.m, lain(v).map(x => x.m))));
      L.push(Object.assign({ t: `“${v.m}” adalah makna dari nilai…`, k: 'makna' }, pilih(v.n, lain(v).map(x => x.n))));
      const bukan = lain(v).flatMap(x => x.p); L.push(Object.assign({ t: `Manakah yang BUKAN panduan perilaku nilai ${v.n}?`, k: 'bukan' }, pilih(acak(bukan)[0], v.p)));
    });
    ['B', 'H', 'L'].forEach(h => { const v = B.find(x => x.h === h); L.push(Object.assign({ t: `Huruf “${h}” pada BerAKHLAK adalah singkatan dari…`, k: 'huruf' }, pilih(v.n, lain(v).map(x => x.n)))); });
    [[1, 'pertama'], [4, 'keempat'], [5, 'kelima'], [7, 'ketujuh']].forEach(([i, k]) => { const v = B[i - 1]; L.push(Object.assign({ t: `Nilai ${k} dalam urutan BerAKHLAK adalah…`, k: 'urutan' }, pilih(v.n, lain(v).map(x => x.n)))); });
    L.push(Object.assign({ t: 'BerAKHLAK terdiri dari berapa nilai dasar ASN?', k: 'umum' }, pilih('7 nilai', ['5 nilai', '6 nilai', '8 nilai'])));
    L.push(Object.assign({ t: 'Employer branding ASN yang diluncurkan bersama core values BerAKHLAK adalah…', k: 'umum' }, pilih('Bangga Melayani Bangsa', ['Melayani dengan Hati', 'ASN Berintegritas', 'Kerja Cerdas, Kerja Ikhlas'])));
    L.push(Object.assign({ t: 'Implementasi core values BerAKHLAK diatur dalam…', k: 'umum' }, pilih('SE Menteri PANRB No. 20 Tahun 2021', ['PP No. 11 Tahun 2017', 'UU No. 5 Tahun 2014', 'Perpres No. 81 Tahun 2010'])));
    L.forEach((q, i) => q.id = 'm' + i);   // id tetap: urutan pembuatan soal selalu sama
    return L;
  }
  function susunKuis(n, durasi, tambahan, hanyaTambahan) {   // pilih n soal acak, variasi jenis, tiap soal {t, p[4], b, d}
    const acak = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const tb = (tambahan || []).map(q => ({ t: q.teks, p: q.pilihan, b: q.benar, k: 'tambahan' }));
    let pool = hanyaTambahan ? acak(tb) : acak(tb).concat(acak(soalBerakhlak()));
    const out = [], hit = {};
    for (const q of pool) { if (out.length >= n) break; const k = q.k; if (k !== 'tambahan' && (hit[k] || 0) >= Math.ceil(n / 3)) continue; hit[k] = (hit[k] || 0) + 1; out.push(q); }
    for (const q of pool) { if (out.length >= n) break; if (!out.includes(q)) out.push(q); }
    return acak(out).map(q => ({ t: q.t, p: q.p, b: q.b, d: durasi }));
  }
  /* Nama sapaan: lewati gelar depan; nama depan pendek khas Sulawesi (La, Wa, Ni, …) digabung dengan kata berikutnya */
  function namaPanggil(n) {
    const w = String(n || '').replace(/,.*$/, '').trim().split(/\s+/).filter(x => x && !/^(dr|ir|drs|dra|prof|h|hj|apt|ns)\.?$/i.test(x));
    if (!w.length) return '';
    if (/^(la|wa)$/i.test(w[0]) && /^ode$/i.test(w[1] || '') && w[2]) return w.slice(0, 3).join(' ');
    return w[0].replace(/\.$/, '').length <= 2 && w[1] ? w[0] + ' ' + w[1] : w[0];
  }
  function nilaiHariIni(d) {   // berganti setiap hari, berurutan B-A-K-H-L-A-K; panduan perilaku bergilir tiap putaran
    d = d || new Date(); const hari = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    const i = ((hari % 7) + 7) % 7, v = BERAKHLAK[i]; return Object.assign({ i, perilaku: v.p[Math.floor(hari / 7) % 3] }, v);
  }
  function htmlNilaiHariIni() {
    const v = nilaiHariIni(); const POS = [0, 3, 4, 5, 6, 7, 8];
    const akronim = 'BerAKHLAK'.split('').map((c, j) => j === POS[v.i] ? `<b style="color:${v.w}">${c}</b>` : `<span>${c}</span>`).join('');
    return `<div class="bk-hari" style="--w:${v.w}"><div class="bk-kep"><span class="bk-chip">Nilai hari ini</span><span class="bk-akr">${akronim}</span></div>
      <div class="bk-isi"><span class="bk-huruf">${v.h}</span><div><b>${esc(v.n)}</b><p>${esc(v.m)}</p></div></div>
      <div class="bk-perilaku">“${esc(v.perilaku)}”</div></div>`;
  }
  function bannerNilaiHariIni() {   // banner di bagian paling atas dashboard
    const v = nilaiHariIni(); const POS = [0, 3, 4, 5, 6, 7, 8];
    const akr = 'BerAKHLAK'.split('').map((c, j) => j === POS[v.i] ? `<b>${c}</b>` : `<span>${c}</span>`).join('');
    return `<div class="bkb" style="--w:${v.w}"><span class="bkb-h">${v.h}</span><div class="bkb-tx"><div class="bkb-lbl">Nilai BerAKHLAK hari ini · ${tglPanjang(ymd(new Date()))}</div>
      <div class="bkb-n">${esc(v.n)}<span><i class="bkb-dash"> — </i>${esc(v.m)}</span></div><div class="bkb-p">Panduan perilaku: “${esc(v.perilaku)}”</div></div><div class="bkb-akr" aria-hidden="true">${akr}</div></div>`;
  }
  if (!document.getElementById('skp-bkb-css')) {
    const st = document.createElement('style'); st.id = 'skp-bkb-css';
    st.textContent = '.bkb{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #e6ebf1;border-left:6px solid var(--w);border-radius:16px;padding:14px 18px;margin-bottom:18px;box-shadow:0 2px 10px rgba(16,40,70,.05)}.bkb-h{width:52px;height:52px;flex:0 0 auto;border-radius:14px;background:var(--w);color:#fff;display:grid;place-items:center;font-size:28px;font-weight:800;box-shadow:0 6px 14px rgba(0,0,0,.15)}.bkb-tx{flex:1;min-width:0}.bkb-lbl{font-size:11.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--w)}.bkb-n{font-size:17px;font-weight:800;color:#1e293b;margin-top:2px}.bkb-n span{font-weight:500;color:#334155;font-size:14.5px}.bkb-dash{font-style:normal}.bkb-p{font-size:12.5px;color:#64748b;font-style:italic;margin-top:3px}.bkb-akr{font-size:22px;font-weight:800;letter-spacing:3px;color:#cbd5e1;flex:0 0 auto}.bkb-akr b{color:var(--w)}@media (max-width:760px){.bkb{padding:12px 14px;gap:12px;margin-bottom:14px}.bkb-h{width:44px;height:44px;font-size:23px}.bkb-akr{display:none}.bkb-dash{display:none}.bkb-n{font-size:15.5px}.bkb-n span{display:block;font-size:13px;margin-top:2px}.bkb-lbl{font-size:10.5px}}';
    (document.head || document.documentElement).appendChild(st);
  }
  function sibukRender() {
    let o = document.getElementById('skp-sibuk');
    const aktif = sibukList.filter(x => x.tampil);
    if (!aktif.length) { if (o) o.classList.remove('on'); document.documentElement.classList.remove('skp-sibuk'); return; }
    if (!o) {
      o = document.createElement('div'); o.id = 'skp-sibuk'; o.setAttribute('role', 'alert'); o.setAttribute('aria-live', 'assertive');
      o.innerHTML = '<div class="kotak"><div class="putar"></div><div class="pesan"></div><div class="sub">Mohon tunggu, jangan tutup halaman ini…</div><div class="bk-slot"></div></div>';
      document.body.appendChild(o);
      ['click', 'mousedown', 'touchstart', 'keydown'].forEach(ev => o.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, true));
    }
    o.querySelector('.pesan').textContent = aktif[0].pesan;
    const slot = o.querySelector('.bk-slot'), kunci = ymd(new Date()); if (slot.dataset.hari !== kunci) { slot.innerHTML = htmlNilaiHariIni(); slot.dataset.hari = kunci; }
    o.classList.add('on'); document.documentElement.classList.add('skp-sibuk');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function sibuk(pesan = 'Memproses…', tunda = 0) {
    const t = { pesan, tampil: !tunda }; sibukList.push(t);
    if (tunda) t.h = setTimeout(() => { t.tampil = true; sibukRender(); }, tunda); else sibukRender();
    return {
      pesan(p) { t.pesan = p; sibukRender(); },
      selesai() { clearTimeout(t.h); const i = sibukList.indexOf(t); if (i >= 0) sibukList.splice(i, 1); sibukRender(); }
    };
  }
  async function proses(pesan, fn, tunda = 0) { const s = sibuk(pesan, tunda); try { return await fn(s); } finally { s.selesai(); } }
  if (!document.getElementById('skp-sibuk-css')) {
    const st = document.createElement('style'); st.id = 'skp-sibuk-css';
    st.textContent = '#skp-sibuk{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.45);backdrop-filter:blur(1.5px);cursor:progress}#skp-sibuk.on{display:flex}#skp-sibuk .kotak{background:#fff;border-radius:14px;padding:22px 26px;min-width:220px;max-width:86vw;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);font-family:inherit}#skp-sibuk .putar{width:42px;height:42px;margin:0 auto 12px;border:4px solid #dbe4f0;border-top-color:#0b5ea8;border-radius:50%;animation:skpPutar .8s linear infinite}#skp-sibuk .pesan{font-weight:600;font-size:15px;color:#1e293b}#skp-sibuk .sub{font-size:12px;color:#64748b;margin-top:4px}#skp-sibuk .kotak{width:340px}#skp-sibuk .bk-hari{margin-top:16px;padding-top:14px;border-top:1px dashed #e2e8f0;text-align:left}#skp-sibuk .bk-kep{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}#skp-sibuk .bk-chip{font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--w)}#skp-sibuk .bk-akr{font-size:13px;font-weight:800;letter-spacing:1.5px;color:#cbd5e1}#skp-sibuk .bk-isi{display:flex;gap:12px;align-items:center}#skp-sibuk .bk-huruf{width:46px;height:46px;flex:0 0 auto;border-radius:12px;background:var(--w);color:#fff;display:grid;place-items:center;font-size:24px;font-weight:800;box-shadow:0 6px 14px rgba(0,0,0,.15)}#skp-sibuk .bk-isi b{display:block;font-size:16.5px;color:var(--w)}#skp-sibuk .bk-isi p{margin:2px 0 0;font-size:12.5px;color:#334155;line-height:1.4}#skp-sibuk .bk-perilaku{margin-top:10px;font-size:12px;color:#475569;font-style:italic;background:#f8fafc;border-left:3px solid var(--w);padding:7px 10px;border-radius:6px;line-height:1.4}@keyframes skpPutar{to{transform:rotate(360deg)}}';
    (document.head || document.documentElement).appendChild(st);
  }

  const api = {
    BULAN, HARI, BIDANG, BIDANG_BAWAAN, muatBidang, bidangDari, urutRk, ymd, parseYmd, uid: mkid, esc, pad, tglPanjang, tglSedang, rentangTgl, kelompokRk, pager, cocokRk, tokenRk, namaBulan, labelHari, targetBulan, compressImage, download, toast, sibuk, proses, waLink: () => waLink(),
    BERAKHLAK, nilaiHariIni, bannerNilaiHariIni, karakter, aturKarakter, pasangKarakter, pasangPilihKarakter, soalBerakhlak, susunKuis, namaPanggil, mulai, keluar, gantiPassword, token, drive, blobKeBase64: b => blobKeDataUrl(b).then(d => d.split(',')[1]), client, emailDariNip, cek, config: CFG,
    get saya() { return saya; },
    backend: async () => ({ mode: 'server' }),
    list: s => db.list(s), get: (s, id) => db.get(s, id), put: (s, o) => proses('Menyimpan…', () => db.put(s, o), 250), putDiam: (s, o) => db.put(s, o), putBanyak: (s, a, p) => proses('Menyimpan data…', () => db.putBanyak(s, a, p), 150), hapusBanyakRk: ids => proses('Menghapus ' + ids.length + ' RK…', () => db.hapusBanyakRk(ids), 150), hapusBanyakKegiatan: ks => proses('Menghapus ' + ks.length + ' kegiatan…', () => db.hapusBanyakKegiatan(ks), 150), arsipkanKegiatan: ks => proses('Mengarsipkan kegiatan…', () => db.arsipkanKegiatan(ks), 150), del: (s, id) => proses('Menghapus…', () => db.del(s, id), 150),
    onChange: f => listeners.add(f),
    async profil() { return db.get('meta', 'profil'); },
    async hapusKegiatan(k) { return proses('Menghapus kegiatan…', async () => { for (const f of (k.fotoIds || [])) await db.del('foto', f); await db.del('kegiatan', k.id); }, 150); },
    registerSW() { try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { } }
  };

  /* ---------- Tombol bantuan WhatsApp (melayang) ---------- */
  const WA_NOMOR = String(CFG.WA_BANTUAN || '082121559865').replace(/\D/g, '').replace(/^0/, '62');
  // "Halo, saya <nama pengguna>, saya ingin bertanya …"  (nama hanya muncul bila sudah login)
  const waPesan = () => 'Halo, saya ' + (saya && saya.nama ? saya.nama + ', saya ' : '') + 'ingin bertanya seputar aplikasi SAKTI (Sahabat Kinerja Terintegrasi).';
  const waLink = () => 'https://wa.me/' + WA_NOMOR + '?text=' + encodeURIComponent(waPesan());
  const IKON_WA = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.2-.6-6-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.6-5.6C5.1 9.9 10 5.2 16 5.2s10.9 4.7 10.9 10.6S22 26.4 16 26.4zm6-7.9c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.3c.2.2 2.3 3.5 5.6 4.9 2.8 1.1 3.3.9 3.9.8.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg>';
  function pasangWA() {
    if (document.getElementById('skp-wa') || /(input|pimpinan|kuis)\.html/i.test(location.pathname) || !WA_NOMOR) return;
    const st = document.createElement('style');
    st.textContent = `#skp-wa{position:fixed;right:18px;bottom:18px;z-index:1001;font-family:inherit}
    #skp-wa .wa-tbl{width:56px;height:56px;border-radius:50%;border:0;background:linear-gradient(180deg,#3BE07A,#1FB85A);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -4px 0 rgba(0,0,0,.18),0 10px 20px -8px rgba(20,120,60,.7);transition:transform .15s}
    #skp-wa .wa-tbl:hover{transform:scale(1.06)}#skp-wa .wa-tbl svg{width:32px;height:32px}
    #skp-wa .wa-pop{position:absolute;right:0;bottom:68px;width:min(300px,calc(100vw - 36px));background:#fff;color:#1d2733;border-radius:16px;box-shadow:0 12px 36px rgba(0,0,0,.22);overflow:hidden;display:none}
    #skp-wa.buka .wa-pop{display:block}
    #skp-wa .wa-kepala{background:#075E54;color:#fff;padding:14px 16px;display:flex;gap:10px;align-items:center}
    #skp-wa .wa-kepala svg{width:30px;height:30px;flex:0 0 auto}#skp-wa .wa-kepala b{display:block;font-size:15px}#skp-wa .wa-kepala small{font-size:12px;opacity:.85}
    #skp-wa .wa-x{margin-left:auto;background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}
    #skp-wa .wa-isi{padding:14px 16px;background:#ECE5DD;font-size:13.5px;line-height:1.45}
    #skp-wa .wa-gel{background:#fff;border-radius:0 10px 10px 10px;padding:9px 11px;box-shadow:0 1px 1px rgba(0,0,0,.08)}
    #skp-wa .wa-mulai{display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 16px 14px;padding:11px;border-radius:999px;background:#25D366;color:#fff;font-weight:700;text-decoration:none;font-size:14.5px}
    #skp-wa .wa-mulai svg{width:20px;height:20px}
    #skp-wa .wa-label{position:absolute;right:66px;bottom:12px;white-space:nowrap;background:#fff;color:#1d2733;font-size:12.5px;font-weight:600;padding:6px 10px;border-radius:8px;box-shadow:0 3px 10px rgba(0,0,0,.15)}
    #skp-wa.buka .wa-label{display:none}
    @media (max-width:760px){#skp-wa{bottom:calc(92px + env(safe-area-inset-bottom));right:14px}#skp-wa .wa-tbl{width:50px;height:50px}#skp-wa .wa-label{display:none}}
    @media print{#skp-wa{display:none}}`;
    document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'skp-wa';
    el.innerHTML = `<div class="wa-pop" role="dialog" aria-label="Bantuan WhatsApp"><div class="wa-kepala">${IKON_WA}<div><b>Bantuan SAKTI</b><small>Biasanya membalas di jam kerja</small></div><button class="wa-x" type="button" aria-label="Tutup">×</button></div>
      <div class="wa-isi"><div class="wa-gel">Halo 👋<br>Ada pertanyaan seputar aplikasi <b>SAKTI</b>? Silakan chat kami di WhatsApp.</div></div>
      <a class="wa-mulai" target="_blank" rel="noopener">${IKON_WA}Chat di WhatsApp</a></div>
      <span class="wa-label">Ada pertanyaan?</span>
      <button class="wa-tbl" type="button" aria-label="Tanya lewat WhatsApp" title="Tanya lewat WhatsApp">${IKON_WA}</button>`;
    document.body.appendChild(el);
    const buka = b => { el.classList.toggle('buka', b); if (b) el.querySelector('.wa-mulai').href = waLink(); };
    el.querySelector('.wa-tbl').onclick = () => buka(!el.classList.contains('buka'));
    el.querySelector('.wa-x').onclick = () => buka(false);
    el.querySelector('.wa-mulai').onclick = () => setTimeout(() => buka(false), 300);
    document.addEventListener('click', e => { if (!el.contains(e.target)) buka(false); });
    setTimeout(() => { const l = el.querySelector('.wa-label'); if (l) l.remove(); }, 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasangWA); else pasangWA();
  window.SKP = api;
})();
