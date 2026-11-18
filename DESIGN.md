# DESIGN.md — SAKTI (Sahabat Kinerja Terintegrasi), BPS Kota Kendari

**Arah: "clay biru pastel".** Tampilan ramah dan lembut seperti mainan tanah liat: kartu putih yang menggembung, tombol empuk 3D yang terasa bisa ditekan, biru pastel sebagai warna utama, dan empat pastel pendamping (pink, kuning, mint, ungu) untuk membedakan data. Karakter pegawai BPS (perempuan berhijab atau laki-laki, dipilih tiap pegawai) menyapa di dashboard; maskot bintang menemani banner nilai BerAKHLAK dan kartu ajakan. Data tetap nomor satu: hiasan hanya di sapaan, banner, dan kartu ajakan.

Token ada di `tema.css`. Halaman memakai **nama token** (`var(--…)`), tidak menulis nilai mentah.

## 1. Warna

| Token | Nilai | Peran |
|---|---|---|
| `--latar` | `#EAF1FC` | Latar halaman (dengan dua gumpalan lembut biru & ungu) |
| `--n-0` | `#FFFFFF` | Kartu, panel menu, kolom isian aktif |
| `--n-25` | `#F5F8FE` | Kolom isian, kepala tabel, butir daftar |
| `--n-50` | `#ECF1FA` | Lekukan (track bar, kontrol segmen), garis putus-putus |
| `--n-100` | `#DFE7F4` | Garis kolom isian & pemisah |
| `--n-500` | `#5E6F92` | Placeholder, label grup menu (4,9:1) |
| `--n-600` | `#4D5D7F` | Teks sekunder (6,4:1; ≥5:1 di atas semua pastel) |
| `--n-800` | `#23304D` | Teks utama |
| `--n-900` | `#162038` | Judul, angka |
| `--biru-50` / `--biru-100` | `#EEF4FF` / `#DBE7FF` | Hover menu, baris terpilih |
| `--biru-400` / `--biru-500` | `#6E9BEA` / `#4F80E0` | Ikon menu, batang grafik, cincin fokus |
| `--biru-600` / `--biru-700` | `#3F70D2` / `#2F5DB8` | **Primer:** tombol utama (putih di atasnya 4,7:1), tautan |
| `--biru-900` | `#1C3A75` | Judul sapaan |
| `--hijau-600` | `#18825A` | Aksen "Catat" (tombol Catat di menu bawah) |

**Pastel pendamping** (latar kartu & petak ikon) dengan **tinta** yang terbaca di atasnya (≥4,5:1):

| Pastel | Latar | Tinta | Warna padat (ikon, batang) |
|---|---|---|---|
| Biru | `--pas-biru` `#DCE8FF` | `--tinta-biru` `#2F5DB8` | `--biru-500` |
| Pink | `--pas-pink` `#FFE0EA` | `--tinta-pink` `#B4335F` | `--pink` `#E26A93` |
| Kuning | `--pas-kuning` `#FFF0C9` | `--tinta-kuning` `#8A5A00` | `--kuning` `#F4B43C` |
| Mint | `--pas-mint` `#D9F5E6` | `--tinta-mint` `#17734F` | `--mint` `#3DBE86` |
| Ungu | `--pas-ungu` `#ECE6FF` | `--tinta-ungu` `#5B43B8` | `--ungu` `#8E79E8` |

Urutan tetap biru → pink → kuning → mint untuk empat kartu ringkasan; KPI di bawahnya biru → mint → kuning → pink. Semantik: `--sukses` `#17734F`, `--peringatan` `#A35200`, `--bahaya` `#B42318` (+ latar `-bg` masing-masing).

**Pengecualian:** layar permainan Kuis BerAKHLAK (`kuis.html`) memakai palet permainannya sendiri (ungu, merah, biru, kuning, hijau). Penanda bidang (avatar inisial & potongan donat) memakai `WARNA_AV` yang gelap agar teks putih terbaca.

## 2. Tipografi

- **Huruf:** Nunito (variabel 200–1000, disimpan sendiri di `fonts/nunito.woff2`, lisensi OFL). Bentuknya membulat, cocok dengan gaya clay.
- **Bobot:** 500 isi, 600–700 label & menu, 800 tombol & judul kartu, 900 judul halaman, sapaan, dan angka.
- **Angka:** `tabular-nums` untuk tabel, KPI, dan jam.

| Token | Ukuran | Peran |
|---|---|---|
| `--t-xs` | 12 | Badge, label grup menu |
| `--t-sm` | 13 | Kepala tabel, tombol kecil |
| `--t-ui` | 14,5 | Isi tabel, menu, tombol |
| `--t-body` | 16 | Paragraf, isian di HP (agar tidak di-zoom) |
| `--t-h4` | 17 | Judul kartu |
| `--t-h3` | 21 | Judul topbar |
| `--t-h2` | 28 | Sapaan di dashboard |
| `--t-angka` | 32 | Angka KPI |

## 3. Jarak & bentuk

Skala 4: `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-8` 32 · `--s-10` 40.
Sudut: `--r-sm` 10 · `--r-md` 14 (isian, butir) · `--r-lg` 22 (kartu) · `--r-xl` 28 (sapaan, panel menu, modal) · `--r-full` (semua tombol berbentuk pil).
Padding halaman 28 (HP 14). Kartu: padding 22–24, jarak antarkartu 18–20.

## 4. Kedalaman clay

| Token | Dipakai untuk |
|---|---|
| `--clay` | Kartu: kilau putih di tepi atas + bayang lembut kebiruan di bawah |
| `--clay-angkat` | Panel menu melayang, kotak sapaan |
| `--empuk-putih` | Tombol sekunder, kontrol bulan, chip |
| `--empuk-biru` | Tombol utama, menu aktif, tombol kirim |
| `--empuk-tekan` | Keadaan ditekan (lekuk ke dalam) |

**Aturan kedalaman:** yang **timbul** bisa ditekan (tombol, chip, menu aktif); yang **cekung** bisa diisi (kolom isian, track bar, kontrol segmen); kartu isi **menggembung lembut** tetapi tidak bereaksi saat ditekan, kecuali butir yang memang tautan. Ditekan → turun 2–3 px dan bayangan pindah ke dalam. Pilihan terpilih → tampak tertekan (biru) atau timbul putih di atas lekukan (segmen).

## 5. Komponen

- **Panel menu (desktop):** kartu putih melayang (jarak 16 dari tepi, sudut 28). Urutan: logo → profil "Halo, Nama!" dengan avatar → menu → kartu ajakan dengan maskot bintang. Menu aktif = pil biru empuk; "Catat Kegiatan" = pil mint; "Kuis" = pil ungu saat kuis berlangsung. Kartu ajakan disembunyikan bila tinggi layar < 860 px.
- **Menu bawah (HP):** bilah putih melayang sudut 24; menu aktif diberi latar pastel di belakang ikon dan garis kecil yang meluncur; tombol Catat berupa tuts mint.
- **Kotak sapaan:** gradasi putih → biru pastel, karakter pilihan pegawai di kiri, tanaman di kanan (disembunyikan di HP), salam menurut jam, tombol pil biru (Catat kegiatan / Pantau pegawai / Pantau pengisian) dan kontrol bulan putih empuk. HP ≤ 460 px: karakter pindah ke kanan bawah.
- **Empat kartu ringkasan:** di bawah sapaan, latar pastel biru/pink/kuning/mint, petak ikon padat dengan kilau, angka 30 px tebal.
- **KPI:** kartu putih, petak ikon pastel, bar tebal 10 px dalam lekukan dengan gradasi warna yang sama.
- **Grafik harian:** batang membulat berganti pastel; hari ini biru tua. **Kegiatan per Bidang:** donat dengan total di tengah, warnanya sama dengan penanda bidang.
- **Aksi cepat & Perlu Perhatian:** petak pastel empuk, ikon dalam tuts berwarna, tombol pil berwarna tinta.
- **Banner nilai BerAKHLAK:** gradasi putih → warna nilai, huruf nilai dalam tuts, maskot bintang di kanan (disembunyikan di HP ≤ 560 px).
- **Catat Kegiatan:** kepala putih melayang dengan logo; pesan = kartu clay putih dengan garis biru di kiri; label bidang = pil; kolom ketik = pil cekung; tombol kirim = tuts bulat biru.
- **Layar masuk:** dua karakter berdampingan + nama SAKTI di kiri, kartu putih clay di kanan; di HP keduanya "berdiri" di atas kartu.
- **Pilihan karakter:** dua kartu potret di menu Profil (admin: Pengaturan). Pilihan disimpan di metadata akun Supabase (`user_metadata.karakter` = `p`/`l`), jadi ikut ke semua perangkat tanpa mengubah tabel; bawaan = perempuan.

## 6. Logo & ilustrasi

- **Logo:** gelembung obrolan biru 3D berisi grafik naik + bintang (`img/logo-sakti.svg`). Ikon PWA dan gambar pratinjau tautan (`img/og-sakti.jpg`, dengan kedua karakter) dibuat dari logo ini.
- **Karakter:** dua pegawai BPS berseragam (`img/karakter-perempuan.webp`, `img/karakter-laki.webp`), diberikan oleh pemilik aplikasi; latar sudah dihapus, papan nama dikosongkan. Bintang (`img/bintang.svg`) dan tanaman (`img/tanaman.svg`) buatan sendiri. Jangan memakai karakter atau aset merek lain.
- Ilustrasi selalu `alt=""` (hiasan), kecuali logo di layar masuk.

## 7. Gerak

Cepat dan bermakna; semua mati otomatis bila perangkat diatur "kurangi gerakan".
- Masuk halaman: naik pelan atau bergeser sesuai arah menu (maju dari kanan, mundur dari kiri).
- Kartu muncul bertahap 50 ms; bar terisi dari kiri; angka KPI menghitung naik.
- Tombol: riak dari titik sentuh + pantulan pegas; menu bawah memantulkan ikonnya.
- Karakter sapaan muncul memantul sekali; tanaman dan bintang bergoyang/melayang pelan (satu-satunya gerak tanpa interaksi).

## 8. Aksesibilitas

- Kontras teks ≥ 4,5:1 di semua permukaan (diperiksa axe-core: 0 pelanggaran WCAG 2 A/AA di 15 layar).
- Fokus keyboard: cincin biru 4 px (`--fokus`).
- Target ketuk ≥ 40 px untuk tombol ikon; isian 16 px di HP.
- Label tanpa huruf kapital semua.
