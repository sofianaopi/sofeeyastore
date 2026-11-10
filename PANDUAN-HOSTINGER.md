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

## Langkah 1 — Buat database MySQL

1. Masuk **hPanel → Websites → Manage → Databases → Management**.
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

1. hPanel → **Files → File Manager** → buka folder `public_html`
   (atau subfolder, misalnya `public_html/kasir`, jika website utama dipakai untuk hal lain).
2. Klik **Upload**, lalu unggah file **ZIP**-nya. Klik kanan → **Extract**.
3. Pastikan `index.html` berada langsung di dalam folder tujuan, bukan di dalam folder ZIP lagi.

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
| Ingin melihat pesan error detail | Sementara ubah `'debug' => true` di `api/config.php`, lalu kembalikan ke `false`. |

## Cadangan data (backup)

hPanel → **Files → Backups** → *Database backups*. Disarankan mengunduh cadangan seminggu sekali.
Cara lain: phpMyAdmin → **Export**.
