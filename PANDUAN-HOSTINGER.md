# Sofeeya Store POS — Panduan Upload ke Hostinger

Versi ini terdiri dari HTML + JavaScript biasa (tanpa proses build), API PHP, dan database MySQL. Versi ini berjalan di paket hosting Hostinger mana pun yang mendukung PHP (Premium / Business / Cloud).

## Isi folder

| File / folder | Fungsi |
|---|---|
| `index.html` | Aplikasi utama: kasir, dashboard, laporan, produk, promo, member, dll. |
| `absen.html` | Halaman absen pegawai (datang/pulang) |
| `cek-stok.html` | Halaman cek stok untuk petugas |
| `assets/` | Tampilan (CSS), logika (JS), ikon |
| `api/index.php` | Server API, terhubung ke database |
| `api/config.php` | **Isi data database Anda di sini** |
| `database.sql` | Struktur tabel + akun awal, untuk diimpor ke MySQL |
| `uploads/produk/` | Tempat foto produk. Harus bisa ditulis server (izin **755**). |

## Memperbarui dari versi sebelumnya

Cukup timpa semua file, **kecuali** `api/config.php` atau `api/config.local.php` yang berisi password database. Jangan impor ulang `database.sql` karena data akan hilang. Kolom-kolom baru ditambahkan otomatis saat aplikasi dibuka pertama kali.

## Fitur toko fashion (versi ini)

| Fitur | Di mana | Catatan |
|---|---|---|
| **Varian warna × ukuran** | Produk & stok → *Barang baru* | Satu model punya banyak varian. Setiap varian punya stok & barcode sendiri. Di kasir tampil satu kartu, lalu pilih warna & ukuran. |
| **Matriks stok** | Produk & stok → tombol *Stok* | Isi stok semua warna/ukuran dalam satu tabel. Cocok saat kiriman konveksi datang atau saat stok opname. |
| **Foto produk** | Produk & stok → klik gambar kecil di kiri | Foto dikecilkan otomatis. Tampil di kasir agar pegawai cepat menemukan barang. |
| **Tukar size / retur** | Kasir → *Tukar / retur*, atau scan barcode invoice di struk | Pilih barang yang dikembalikan, lalu ambil pengganti. Selisih dibayar atau dikembalikan otomatis. Stok kembali otomatis. Batas hari diatur di Pengaturan. |
| **Saluran penjualan** | Kasir → layar Pembayaran | Toko, WhatsApp, Instagram, Shopee, TikTok Shop (bisa diubah di Pengaturan). Omzet per saluran tampil di Dashboard. |
| **Ukuran & warna terlaris** | Dashboard | Panduan restok: ukuran/warna mana yang paling cepat habis. |
| **Barang lambat laku** | Dashboard | Barang yang masih ada stok tetapi tidak terjual 45 hari, beserta modal yang tertahan. Cocok dijadikan promo cuci gudang. |
| **Impor varian dari Excel** | Produk & stok → *Impor* | Template baru punya kolom Model, Warna, Ukuran — satu baris per varian. |

## Memori kasir & printer (tidak hilang saat halaman dimuat ulang)

| Yang diingat | Keterangan |
|---|---|
| **Keranjang yang belum dibayar** | Barang, member, voucher, biaya, pengiriman, dan retur tersimpan otomatis di perangkat. Setelah refresh / HP restart, keranjang kembali. Harga & stok dicek ulang; barang yang sudah habis dikeluarkan. |
| **Transaksi saat refresh** | Bila halaman dimuat ulang tepat saat menekan *Selesaikan transaksi*, aplikasi mengecek ke server. Transaksi yang sudah tersimpan tidak akan tercatat dua kali; layar struknya muncul lagi. |
| **Struk terakhir** | Kasir → tombol printer di atas → *Cetak ulang struk terakhir*. |
| **Printer Bluetooth** | Printer terakhir diingat. Di Chrome yang mendukung, langsung tersambung lagi otomatis. Bila belum, cukup satu ketukan *Sambungkan* (hanya printer Anda yang muncul), atau aplikasi menyambung sendiri saat mencetak. Bila printer mati sebentar, aplikasi mencoba menyambung ulang. |
| **Pengaturan cetak** | Menu Printer: *Cetak struk otomatis* dan lebar kertas 58 / 80 mm — disimpan per perangkat. |

Memori disimpan per perangkat & per akun kasir. Jika browser dibersihkan (hapus data situs), keranjang yang belum dibayar ikut terhapus — transaksi yang sudah selesai tetap aman di server.

## Laporan keuangan (menu baru)

Menu **Laporan** kini bernama **Laporan keuangan** dan berisi 9 sub menu. Pembaruan database berjalan otomatis saat aplikasi pertama dibuka setelah upload (tidak perlu impor SQL).

| Sub menu | Isi | Admin | Kasir |
|---|---|---|---|
| Transaksi | Penjualan harian / bulanan / tahunan, filter kasir-metode-saluran, ekspor Excel | ✓ semua periode | hanya hari ini |
| Laba rugi | Penjualan bersih − HPP = laba kotor − beban (komisi, barang reject, biaya operasional) = laba bersih; per bulan & tahun | ✓ | – |
| Persediaan | Barang masuk & keluar per tanggal / per barang / rincian | ✓ | – |
| Produk terlaris | Per model atau per varian, plus per kategori | ✓ | – |
| Pembayaran | Rekap Tunai, QRIS, Debit, Transfer per jam / hari / bulan | ✓ | – |
| Member | Belanja terbanyak & pembelian member per semester | ✓ (+ atur voucher) | ✓ |
| Pegawai | Waktu absen, rekap absen, komisi | semua pegawai | data sendiri |
| Retur | Tukar & pengembalian barang | ✓ semua periode | hanya hari ini |
| Barang reject | Catat barang rusak (stok otomatis berkurang) | tambah & hapus | tambah saja |

Catatan:
- **Biaya operasional** (gaji, sewa, listrik, dll.) dicatat di sub menu Laba rugi → "Catat biaya" agar laba bersih akurat.
- **Debit** sekarang metode pembayaran tersendiri (terpisah dari Transfer).
- Komisi di laporan kasir muncul bila **nama sales** di menu Sales & komisi sama dengan **nama akun** kasir tersebut.
- Menghapus data reject (admin) akan mengembalikan stok barangnya.

## Notifikasi transaksi di HP pemilik

Setiap transaksi masuk, HP pemilik menampilkan pemberitahuan seperti pesan aplikasi — **walau aplikasi kasir sedang ditutup**. Contoh:

> 🛍️ **Rp249.000 · Transaksi baru**
> INV261113-1234 · Instagram · Nisa
> Kemeja Kantor Basic - Putih / M ×1, Pashmina Ceruty - Sage ×2
> Hari ini: Rp2.450.000 · 14 transaksi

Gratis, tanpa nomor WhatsApp, tanpa Telegram, tanpa layanan pihak ketiga. Mengetuk notifikasi membuka halaman Laporan.

**Cara mengaktifkan (sekali saja, di HP pemilik):**
1. Pastikan situs memakai **https://** — di hPanel: *Keamanan → SSL* (gratis). Notifikasi tidak bisa di http.
2. Di HP pemilik, buka aplikasi dan **masuk sebagai admin**.
3. **Pengaturan → Notifikasi transaksi → Aktifkan notifikasi di HP ini**, lalu tekan **Izinkan** saat browser bertanya.
4. Tekan **Kirim tes ke semua HP** — notifikasi tes harus muncul.

| HP | Catatan |
|---|---|
| **Android** | Pakai Chrome (atau Edge/Samsung Internet). Bisa langsung dari browser; lebih baik lagi bila aplikasi dipasang ke layar utama. |
| **iPhone / iPad** | Wajib iOS 16.4 ke atas. Pasang dulu: buka situs di Safari → **Bagikan → Tambah ke Layar Utama**, buka dari ikon itu, baru aktifkan notifikasi. |

- Bisa lebih dari satu HP (misalnya pemilik dan admin). Daftar HP penerima tampil di panel dan bisa dihapus.
- Atur isi pemberitahuan: total minimal, nama barang, omzet hari ini, serta tukar/retur.
- Bila tidak muncul: cek *Pengaturan HP → Aplikasi → Chrome → Notifikasi* menyala, dan mode hemat baterai tidak membatasi Chrome.
- WhatsApp (Fonnte/CallMeBot) tetap tersedia sebagai tambahan di bagian *Juga kirim lewat WhatsApp*.

Menu **Info kasir** dan **Rumah tautan** dihapus karena tidak dipakai dalam alur kerja toko.

## Langkah 0 — PENTING jika domain Anda dipakai website Horizons

Website buatan **Hostinger Horizons** TIDAK punya menu File Manager, Databases, maupun PHP.
Karena itu aplikasi ini harus dipasang sebagai **website PHP/HTML biasa** pada paket hosting yang sama:

1. Buka hPanel → menu **Websites** (Situs web) → tombol **+ Add website** (Tambah situs web).
2. Pilih **Custom PHP/HTML website** / **Empty PHP/HTML website** (website kosong) — JANGAN pilih Horizons, WordPress, atau Website Builder.
3. Saat diminta domain, pilih salah satu:
   - **Subdomain** dari domain Anda, misalnya `kasir.domainanda.com` (website Horizons tetap jalan di domain utama), atau
   - **Domain sementara** gratis dari Hostinger untuk mencoba dulu.
4. Setelah website baru jadi, klik **Dashboard / Manage** pada website itu. Di menu samping sekarang akan muncul **Files → File Manager** dan **Databases**. Lanjutkan ke Langkah 1.

> Jika menu "Add website" tidak ada, kemungkinan Anda hanya berlangganan Horizons tanpa paket hosting Web/Cloud. Hubungi live chat Hostinger dan tanyakan: "Bagaimana menambah website Custom PHP/HTML di paket saya?"

## Langkah 1 — Buat database MySQL

1. Di dashboard website baru → **Databases → Management** (pada tampilan baru: **Databases → MySQL Databases**).
2. Isi *Database name*, *Username*, dan *Password*, lalu klik **Create**.
   Catat ketiganya. Hostinger menambahkan awalan, misalnya `u123456789_sofeeya`.
3. Klik **Enter phpMyAdmin** pada database tersebut.
4. Buka tab **Import → Choose file →** pilih `database.sql` **→ Go**.
   Jika berhasil, akan muncul 14 tabel (users, products, transactions, …).

## Langkah 2 — Isi konfigurasi

Buka `api/config.php`, lalu ganti tiga baris ini:

```php
'db_name' => 'u123456789_sofeeya',
'db_user' => 'u123456789_admin',
'db_pass' => 'PASSWORD_DATABASE_ANDA',
```

`db_host` biarkan `localhost`.

## Langkah 3 — Upload file

1. Di dashboard website baru → **Files → File Manager** → buka folder `public_html`.
2. Klik **Upload**, lalu unggah file **ZIP**-nya. Klik kanan → **Extract**.
3. Pastikan `index.html` berada langsung di dalam folder tujuan, bukan di dalam folder ZIP lagi.

## Alternatif Langkah 2–3: lewat GitHub

1. Ekstrak ZIP di komputer. Buat repositori baru di github.com (pilih **Private**), klik **uploading an existing file**, lalu seret **isi** folder (bukan file ZIP-nya) — `index.html` harus berada di halaman depan repositori. Klik **Commit changes**.
2. hPanel → website PHP/HTML Anda → **Dashboard → Advanced → Git** → **Continue with GitHub** → izinkan akses → pilih repositori → branch `main`, folder `public_html` → **Deploy**. Folder `public_html` harus kosong saat deploy pertama (hapus file `default.php` bila ada).
3. **Jangan isi password di `api/config.php` yang ada di GitHub.** Setelah deploy, buka **File Manager → public_html/api**, buat file baru `config.local.php`, salin isi dari `config.local.contoh.php`, lalu isi data database Anda. File ini tidak akan tertimpa saat deploy berikutnya.
4. Impor `database.sql` tetap lewat phpMyAdmin (Langkah 1).
5. Setiap kali ada perubahan kode di GitHub, Hostinger otomatis memperbarui website (atau klik **Redeploy**).

## Langkah 4 — Aktifkan SSL (HTTPS)

hPanel → **Security → SSL** → pasang SSL gratis. HTTPS wajib untuk:
- kamera (scan barcode lewat HP),
- printer Bluetooth,
- lokasi GPS saat absen.

Setelah SSL aktif, buka `.htaccess` dan hapus tanda `#` pada 5 baris "Paksa HTTPS".

## Langkah 5 — Masuk pertama kali

Buka domain Anda, lalu masuk dengan:

- **Admin:** `admin@toko.com` / `admin12345`
- **Kasir:** `kasir@toko.com` / `kasir12345`

**Segera lakukan ini:**
1. *Akun saya* → ganti kata sandi admin.
2. *Pengguna* → ubah email/sandi kasir atau buat akun pegawai sendiri.
3. *Pengaturan toko* → ganti **kode supervisor** (bawaan `1234`), alamat & telepon struk.
4. *Pengaturan toko → Jadwal & absensi* → buka dari HP yang tersambung WiFi toko, tekan **Pakai IP ini**, lalu simpan.

## Memindahkan data produk lama

Data dari aplikasi lama (Horizons/PocketBase) **tidak ikut** di file ekspor ZIP — yang ada hanya kodenya.
Cara tercepat memindahkan:
1. Di aplikasi lama: *Produk & Stok* → ekspor ke Excel.
2. Di aplikasi baru: *Produk & stok → Impor* → pilih file tersebut.
   Nama kolom lama (Nama Produk, Barcode / Kode, Harga Beli, Harga Jual, Stok, dst.) dikenali otomatis.
3. Lakukan hal yang sama untuk *Member → Impor*.

## Pasang di HP seperti aplikasi

Buka domain di **Chrome Android** → menu ⋮ → **Tambahkan ke layar utama**.

## Pemecahan masalah

| Gejala | Solusi |
|---|---|
| "Tidak dapat terhubung ke database" | Cek nama database, user, dan password di `api/config.php` (termasuk awalan `u123…_`). |
| "Respons server tidak valid" | Pastikan folder `api/` ikut terunggah dan versi PHP ≥ 7.4 (hPanel → Advanced → PHP Configuration). |
| Login berhasil lalu langsung keluar lagi | Akses lewat satu alamat saja (pilih dengan atau tanpa `www`) dan gunakan HTTPS. |
| Absen ditolak "bukan jaringan toko" | IP WiFi toko bisa berubah bila modem restart. Perbarui lewat *Pengaturan toko → Pakai IP ini*. |
| Tombol "Aktifkan notifikasi" tidak muncul / ada peringatan https | Aktifkan SSL di hPanel, lalu buka situs dengan https://. Untuk memaksa https, hapus tanda `#` pada baris pengalihan HTTPS di file `.htaccess`. |
| Notifikasi diblokir di HP | Ketuk ikon gembok di samping alamat situs → Izin → Notifikasi → Izinkan, lalu muat ulang. |
| Tes WhatsApp gagal "token invalid" / "device disconnected" | Salin ulang token dari dashboard Fonnte; pastikan perangkat di Fonnte berstatus *connect* (scan ulang QR bila putus). |
| Upload foto gagal "Folder uploads/produk tidak dapat dibuat" | Di File Manager buat folder `uploads/produk`, lalu klik kanan → Permissions → **755**. |
| Ingin melihat pesan error detail | Sementara ubah `'debug' => true` di `api/config.php`, lalu kembalikan ke `false`. |

## Cadangan data (backup)

hPanel → **Files → Backups** → *Database backups*. Disarankan mengunduh cadangan seminggu sekali.
Cara lain: phpMyAdmin → **Export**.

## QRIS dengan nominal otomatis

1. Login admin → **Pengaturan toko → QRIS toko**.
2. Klik **Foto / gambar QRIS** dan pilih foto QRIS statis yang ada di stand kasir (dari bank, GoPay/DANA/ShopeePay Merchant), atau **Scan pakai kamera**.
3. Pastikan status **Valid** dan nama merchant benar → **Coba buat QR Rp1.000** → scan dengan HP Anda untuk memastikan nominal muncul → **Simpan QRIS**.
4. Di kasir pilih metode **QRIS** saat membayar: kode QR dengan total belanja langsung tampil. Pembeli scan, nominal sudah terisi.
5. Menu **QRIS** di samping dipakai untuk menerima pembayaran cepat dengan nominal bebas (tidak tercatat sebagai penjualan).

Catatan: aplikasi tidak bisa mengetahui otomatis apakah dana sudah masuk. Kasir tetap mengecek notifikasi di aplikasi merchant QRIS sebelum menekan **Sudah dibayar**. Konfirmasi otomatis membutuhkan payment gateway berbayar (Midtrans / Xendit).

## Pasang sebagai aplikasi di HP / tablet

Syarat: website sudah memakai **HTTPS** (Langkah 4 — SSL aktif).

- **Android (Chrome):** buka website → login → menu samping **Pasang aplikasi di HP** → **Instal**. Atau menu ⋮ Chrome → **Instal aplikasi**.
- **iPhone / iPad (Safari):** buka website → tombol **Bagikan** → **Tambahkan ke Layar Utama**.
- Ikon **Sofeeya POS** muncul di layar utama dan terbuka layar penuh seperti aplikasi biasa. Data tetap tersimpan di server, jadi semua HP/tablet melihat data yang sama.
- Ingin file **APK** untuk dibagikan atau diunggah ke Play Store? Masukkan alamat website di **pwabuilder.com** → *Package for stores* → Android.

## Tampilan potret / lanskap

- Aplikasi otomatis menyesuaikan arah layar: **lanskap** = produk di kiri, keranjang di kanan; **potret** tablet = produk di atas, keranjang di bawah; **potret** HP = tombol keranjang di bawah layar.
- Untuk mengunci tampilan, ketuk tombol **putar** (ikon HP dengan panah) di layar kasir, atau menu samping **Tampilan potret / lanskap** → pilih *Otomatis*, *Potret*, atau *Lanskap*. Pilihan disimpan per perangkat.
- Menu samping tersembunyi otomatis: di tablet/laptop tampil sebagai ikon dan melebar saat disentuh/didekati kursor; di HP dibuka lewat tombol ☰.

