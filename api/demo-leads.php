<?php
/**
 * Daftar pengunjung demo (calon pelanggan).
 * Buka: https://demo.domainanda.com/api/demo-leads.php?key=KUNCI_ADMIN_DEMO
 * Tambah &csv=1 untuk mengunduh sebagai file Excel/CSV.
 */
declare(strict_types=1);
$CONFIG = require __DIR__ . '/config.php';
if (is_file(__DIR__ . '/config.local.php')) { $CONFIG = array_merge($CONFIG, (array)require __DIR__ . '/config.local.php'); }
date_default_timezone_set($CONFIG['timezone'] ?? 'Asia/Makassar');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$key = (string)($CONFIG['demo_admin_key'] ?? '');
if (empty($CONFIG['demo']) || strlen($key) < 8 || $key === 'GANTI_KUNCI_ADMIN' || !hash_equals($key, (string)($_GET['key'] ?? ''))) {
    http_response_code(403); header('Content-Type: text/plain; charset=utf-8');
    exit("Akses ditolak. Isi 'demo_admin_key' di api/config.php lalu buka halaman ini dengan ?key=...");
}
$file = __DIR__ . '/demo-data/.htvisitors.sqlite';
$rows = [];
if (is_file($file)) {
    $pdo = new PDO('sqlite:' . $file);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $rows = $pdo->query('SELECT name, phone, business, started, expires, last_seen, hits, ip FROM visitors ORDER BY id DESC')->fetchAll();
}
$now = date('Y-m-d H:i:s');

if (!empty($_GET['csv'])) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="pengunjung-demo-' . date('Ymd') . '.csv"');
    $o = fopen('php://output', 'w');
    fwrite($o, "\xEF\xBB\xBF");
    fputcsv($o, ['Nama', 'WhatsApp', 'Jenis usaha', 'Mulai', 'Berakhir', 'Terakhir aktif', 'Aktivitas', 'IP'], ';');
    foreach ($rows as $r) fputcsv($o, [$r['name'], "'" . $r['phone'], $r['business'], $r['started'], $r['expires'], $r['last_seen'], $r['hits'], $r['ip']], ';');
    exit;
}
header('Content-Type: text/html; charset=utf-8');
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$active = count(array_filter($rows, fn($r) => $r['expires'] > $now));
$today = count(array_filter($rows, fn($r) => substr($r['started'], 0, 10) === date('Y-m-d')));
?><!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Pengunjung demo</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0;background:#F4F7FB;color:#14233A;font-size:14px}
.w{max-width:1000px;margin:0 auto;padding:20px 14px}
h1{font-size:20px;margin:0 0 4px} .m{color:#7D8BA0}
.k{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}
.k div{background:#fff;border:1px solid #DCE3EC;border-radius:12px;padding:10px 14px;min-width:120px}
.k b{display:block;font-size:22px}
.btn{display:inline-block;background:#035AA6;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;font-weight:600}
.t{background:#fff;border:1px solid #DCE3EC;border-radius:12px;overflow:auto;margin-top:14px}
table{border-collapse:collapse;width:100%;min-width:640px} th,td{padding:9px 12px;border-bottom:1px solid #EBF0F6;text-align:left;white-space:nowrap}
th{font-size:12px;color:#4A5A70;background:#F8FAFD} .on{color:#0F8A5F;font-weight:700} a.wa{color:#0F8A5F;font-weight:600}
</style></head><body><div class="w">
<h1>Pengunjung demo</h1><div class="m">Orang yang sudah mencoba demo aplikasi — calon pelanggan untuk dihubungi.</div>
<div class="k"><div><span class="m">Total</span><b><?= count($rows) ?></b></div><div><span class="m">Hari ini</span><b><?= $today ?></b></div><div><span class="m">Sedang mencoba</span><b><?= $active ?></b></div></div>
<a class="btn" href="?key=<?= $h($_GET['key']) ?>&csv=1">Unduh Excel (CSV)</a>
<div class="t"><table><thead><tr><th>Nama</th><th>WhatsApp</th><th>Jenis usaha</th><th>Mulai</th><th>Status</th><th>Aktivitas</th></tr></thead><tbody>
<?php if (!$rows): ?><tr><td colspan="6" class="m">Belum ada pengunjung.</td></tr><?php endif; ?>
<?php foreach ($rows as $r): $msg = rawurlencode('Halo ' . $r['name'] . ', terima kasih sudah mencoba demo aplikasi kasir kami. Bagaimana kesannya? Ada yang ingin ditanyakan?'); ?>
<tr><td><?= $h($r['name']) ?></td><td><a class="wa" target="_blank" rel="noopener" href="https://wa.me/<?= $h($r['phone']) ?>?text=<?= $msg ?>">+<?= $h($r['phone']) ?></a></td>
<td><?= $h($r['business'] ?: '-') ?></td><td><?= $h(substr($r['started'], 0, 16)) ?></td>
<td><?= $r['expires'] > $now ? '<span class="on">Sedang mencoba</span>' : 'Selesai' ?></td><td><?= (int)$r['hits'] ?></td></tr>
<?php endforeach; ?>
</tbody></table></div></div></body></html>
