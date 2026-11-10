<?php
// =====================================================================
//  KONFIGURASI DATABASE — WAJIB DIISI SETELAH UPLOAD KE HOSTINGER
//  hPanel → Databases → Management → buat database & user, lalu isi di sini.
// =====================================================================
return [
    'db_host' => 'localhost',            // di Hostinger biasanya tetap "localhost"
    'db_name' => 'u123456789_sofeeya',   // ganti: nama database
    'db_user' => 'u123456789_admin',     // ganti: username database
    'db_pass' => 'GANTI_PASSWORD_DB',    // ganti: password database

    // Zona waktu toko (Kendari = WITA)
    'timezone' => 'Asia/Makassar',

    // Biarkan false di server produksi (true hanya untuk mencari error)
    'debug' => false,
];
