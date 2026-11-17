<?php
// =====================================================================
//  KONFIGURASI DATABASE
//  - Upload manual (File Manager): isi langsung di file ini.
//  - Lewat GitHub: JANGAN isi password di sini. Buat file api/config.local.php
//    di server (File Manager) dengan isi yang sama — file itu tidak ikut GitHub.
// =====================================================================
return [
    'db_host' => 'localhost',            // di Hostinger biasanya tetap "localhost"
    'db_name' => 'u870165196_sofeeya',   // ganti: nama database
    'db_user' => 'u870165196_admin',     // ganti: username database
    'db_pass' => 'Zayn3013',    // ganti: password database

    // Zona waktu toko (Kendari = WITA)
    'timezone' => 'Asia/Makassar',

    // Biarkan false di server produksi (true hanya untuk mencari error)
    'debug' => false,
];
