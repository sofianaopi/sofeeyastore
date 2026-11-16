# DESIGN.md — Website katalog Sofeeya Store (`/katalog`)

Berlaku untuk website publik di `katalog/`. Aplikasi kasir punya gaya sendiri (`assets/css/app.css`).
Arah: **etalase toko** — ceria dan hangat, seperti melihat ke dalam butik dari jalan: kanopi bergaris, rel gantungan, label harga kertas.
Dasar keputusan: barang & suasana toko itu sendiri (bukan meniru situs lain; UXKIN tidak tersambung saat ditulis).

## Warna (CSS variables di `katalog/index.php`)
| Token | Nilai | Peran |
|---|---|---|
| `--susu` | #FFF4EF | latar halaman |
| `--persik` | #FFE6DC | latar bagian Lokasi, latar foto barang |
| `--kertas` | #FFFDFB | label harga, kotak info, chip |
| `--mentega` | #FFE29A | kanopi, kartu promo, tombol di bar atas |
| `--mentega-2` / `--daun` / `--jambu` | #FFF2C7 / #CFEFE0 / #F7B6C4 | latar foto bergantian (dekoratif) |
| `--terong` | #34172F | teks utama, bar atas, kaki halaman, chip aktif |
| `--terong-2` | #674A62 | teks pendukung (7,1:1) |
| `--terong-3` | #7A5F75 | teks kecil/meta (5,2:1) |
| `--raspberry` / `-2` | #B8325A / #962247 | tombol utama & hover, stiker promo, fokus (teks putih 5,8:1) |
| `--daun-ink` | #1D6447 | status "buka", "tersedia" |
| `--garis` | #F0D3CC | garis & bingkai chip |
Tidak ada mode gelap. Tidak memakai gradasi kecuali rel kayu.

## Tipografi
- **Lora** (berkas sendiri `assets/fonts/lora-variable.ttf`): judul H1–H3, label promo, nama barang. H1 clamp(38–64px)/1.04, H2 clamp(28–42px)/1.12, H3 18–22px.
- **System sans** (system-ui): isi 16px/1.6, lead 18px, meta 13–14px, tombol 15px 700.
- Huruf kecil biasa (sentence case); tanpa label huruf kapital, tanpa eyebrow.

## Jarak & lebar
Skala 4px (4, 8, 12, 16, 20, 24, 32, 44, 52). Bagian 52px atas-bawah. Lebar isi 1160px, padding samping 20px. Teks panjang ≤ 40em.

## Bentuk & bayangan
- Tombol & chip: radius penuh (999px). Kotak info: 22px. Label harga: 4px kiri / 10px kanan + lubang tali.
- Foto barang: bentuk badan baju (atas membulat 46%/26%, bawah 16px).
- Satu bayangan lembut ungu di bawah foto gantungan; label pakai bayangan tegas 3px.

## Komponen
- **Tombol**: utama raspberry teks putih; kedua garis terong transparan; di bar atas: mentega. Hover naik 1px; fokus garis raspberry 3px.
- **Chip** kategori/varian: kertas + garis; aktif terong; habis = coret & redup.
- **Kartu barang**: tanpa kotak — foto badan baju, label harga gantung, stiker promo, nama (Lora), meta, titik warna.
- **Rel gantungan** (hero): 3 barang berfoto, label harga; satu-satunya gerak otomatis (ayun sekali, mati bila reduce-motion).
- **Kanopi**: garis mentega/kertas 44px, ujung bergelombang.
- **Bar atas** terong, sticky; **kaki** terong.

## Gambar & ikon
Foto produk asli dari menu Katalog website (latar polos, tampak depan). Ikon: hanya ikon WhatsApp & gantungan (SVG garis). Tanpa emoji, tanpa ilustrasi stok.
