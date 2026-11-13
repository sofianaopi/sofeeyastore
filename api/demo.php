<?php
/**
 * MODE DEMO — dimuat oleh api/index.php bila config 'demo' => true.
 *
 * - Pengunjung mengisi nama + nomor WhatsApp di demo.html, lalu mendapat salinan
 *   database contoh miliknya sendiri (SQLite) yang berlaku selama 'demo_minutes'.
 * - Satu nomor WhatsApp / satu perangkat hanya bisa memakai demo SATU KALI.
 * - Daftar pengunjung (calon pelanggan) bisa dilihat di api/demo-leads.php?key=...
 */
declare(strict_types=1);
// file ini hanya boleh dimuat oleh api/index.php
if (realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) { http_response_code(404); exit; }

const DEMO_DIR = __DIR__ . '/demo-data';
const DEMO_TEMPLATE = DEMO_DIR . '/template.sqlite';

function demo_cfg(string $k, $def = null) { global $CONFIG; return $CONFIG[$k] ?? $def; }
function demo_minutes(): int { return max(5, (int)demo_cfg('demo_minutes', 30)); }

function demo_reg(): PDO {
    static $r = null;
    if ($r) return $r;
    if (!is_dir(DEMO_DIR . '/s')) @mkdir(DEMO_DIR . '/s', 0775, true);
    $r = new PDO('sqlite:' . DEMO_DIR . '/.htvisitors.sqlite');
    $r->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $r->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $r->exec('PRAGMA busy_timeout = 4000');
    $r->exec('CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE, name TEXT, phone TEXT, business TEXT,
        device TEXT, client_id TEXT, ip TEXT, user_agent TEXT, started TEXT, expires TEXT, last_seen TEXT, hits INTEGER DEFAULT 0)');
    $r->exec('CREATE INDEX IF NOT EXISTS ix_phone ON visitors(phone)');
    $r->exec('CREATE INDEX IF NOT EXISTS ix_device ON visitors(device)');
    $r->exec('CREATE INDEX IF NOT EXISTS ix_client ON visitors(client_id)');
    return $r;
}
function demo_ip(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? ''); }
function demo_json(array $body, int $status = 200): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}
// Menolak permintaan aplikasi bila demo belum dimulai / sudah habis
function demo_gate(string $state, ?array $v = null): void {
    $msg = $state === 'expired' ? 'Waktu demo sudah habis.' : 'Silakan mulai demo terlebih dahulu.';
    $info = ['state' => $state, 'name' => $v['name'] ?? '', 'wa' => (string)demo_cfg('demo_wa', ''), 'brand' => (string)demo_cfg('demo_brand', 'Aplikasi Kasir')];
    demo_json(['ok' => false, 'error' => $msg, 'demo' => $state, 'demo_info' => $info], 403);
}
function demo_phone(string $p): string {
    $d = preg_replace('/\D+/', '', $p);
    if (strpos($d, '0') === 0) $d = '62' . substr($d, 1);
    elseif (strpos($d, '8') === 0) $d = '62' . $d;
    return $d;
}
function demo_path(string $token): string { return DEMO_DIR . '/s/' . $token . '.sqlite'; }
function demo_remaining(array $v): int { return max(0, strtotime($v['expires']) - time()); }
function demo_info_of(array $v): array {
    return ['state' => 'active', 'name' => $v['name'], 'expires' => $v['expires'], 'remaining' => demo_remaining($v),
            'minutes' => demo_minutes(), 'wa' => (string)demo_cfg('demo_wa', ''), 'brand' => (string)demo_cfg('demo_brand', 'Aplikasi Kasir')];
}
function demo_find_session(): ?array {
    $t = (string)($_SESSION['demo_token'] ?? '');
    if ($t === '') return null;
    $v = demo_reg()->prepare('SELECT * FROM visitors WHERE token = ?'); $v->execute([$t]);
    return $v->fetch() ?: null;
}
function demo_set_device_cookie(string $dev): void {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie('KASIRDEMO_DEV', $dev, ['expires' => time() + 60 * 60 * 24 * 730, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
}
// Hapus database pengunjung yang sudah lewat waktunya (data pengunjung tetap tersimpan di registry)
function demo_cleanup(): void {
    $st = demo_reg()->prepare('SELECT token FROM visitors WHERE expires < ?');
    $st->execute([date('Y-m-d H:i:s', time() - 600)]);
    foreach ($st->fetchAll() as $r) { $f = demo_path($r['token']); if (is_file($f)) @unlink($f); }
}
// Salin database contoh lalu geser semua tanggal agar data terlihat "baru" (sampai hari ini)
function demo_create_sandbox(string $token): void {
    if (!is_file(DEMO_TEMPLATE)) fail('Database contoh (api/demo-data/template.sqlite) tidak ditemukan.', 500);
    $path = demo_path($token);
    if (!copy(DEMO_TEMPLATE, $path)) fail('Gagal menyiapkan demo. Periksa izin folder api/demo-data.', 500);
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $anchor = $pdo->query("SELECT value FROM settings WHERE `key` = 'demo_anchor'")->fetchColumn();
    $days = $anchor ? (int)round((strtotime(date('Y-m-d')) - strtotime((string)$anchor)) / 86400) : 0;
    $pdo->beginTransaction();
    if ($days !== 0) {
        $shift = ($days > 0 ? '+' : '') . $days . ' days';
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($tables as $t) {
            $cols = array_column($pdo->query("PRAGMA table_info(`$t`)")->fetchAll(PDO::FETCH_ASSOC), 'name');
            foreach (array_intersect($cols, ['created', 'updated', 'start_date', 'end_date', 'stock_in_date']) as $c) {
                $pdo->exec("UPDATE `$t` SET `$c` = CASE WHEN length(`$c`) > 10 THEN datetime(`$c`, '$shift') ELSE date(`$c`, '$shift') END
                            WHERE `$c` IS NOT NULL AND `$c` <> ''");
            }
        }
    }
    // Transaksi hari ini: padatkan jamnya ke rentang jam buka (09.00) s/d sekarang, agar
    // dashboard "Hari ini" langsung berisi tanpa ada transaksi "dari masa depan".
    $now = date('Y-m-d H:i:s'); $open = date('Y-m-d') . ' 09:00:00';
    $maxToday = $pdo->query("SELECT MAX(created) FROM transactions WHERE created >= '" . date('Y-m-d') . "'")->fetchColumn();
    if ($maxToday && $maxToday > $now && $now > date('Y-m-d') . ' 09:30:00') {
        $pdo->prepare("UPDATE transactions SET created = datetime(strftime('%s', :o) + (strftime('%s', created) - strftime('%s', :o)) * (strftime('%s', :n) - strftime('%s', :o)) * 1.0 / (strftime('%s', :m) - strftime('%s', :o)), 'unixepoch'), updated = created
                       WHERE created >= :o")->execute([':o' => $open, ':n' => $now, ':m' => $maxToday]);
        $pdo->exec('UPDATE transactions SET updated = created WHERE updated > created');
    }
    $pdo->prepare('DELETE FROM transactions WHERE created > ?')->execute([$now]);
    $pdo->prepare('DELETE FROM attendance WHERE created > ?')->execute([$now]);
    $pdo->prepare("UPDATE settings SET value = ? WHERE `key` = 'demo_anchor'")->execute([date('Y-m-d')]);
    $pdo->commit();
}

// ------------------------------------------------------------------ aksi khusus demo
$__a = (string)($_GET['a'] ?? '');

if ($__a === 'demo_info' || $__a === 'demo_start') {
    try {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'SofeeyaPOS') demo_json(['ok' => false, 'error' => 'Permintaan tidak valid.'], 403);
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $reg = demo_reg();
        $dev = (string)($_COOKIE['KASIRDEMO_DEV'] ?? '');
        $client = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($in['client_id'] ?? '')), 0, 64);
        $base = ['minutes' => demo_minutes(), 'wa' => (string)demo_cfg('demo_wa', ''), 'brand' => (string)demo_cfg('demo_brand', 'Aplikasi Kasir')];

        // 1) sesi demo yang masih berjalan di perangkat ini
        $v = demo_find_session();
        if ($v && demo_remaining($v) > 0 && is_file(demo_path($v['token']))) demo_json(['ok' => true, 'data' => demo_info_of($v)]);

        // 2) perangkat ini sudah pernah memakai demo
        $q = $reg->prepare('SELECT * FROM visitors WHERE (device <> \'\' AND device = ?) OR (client_id <> \'\' AND client_id = ?) ORDER BY id DESC LIMIT 1');
        $q->execute([$dev, $client]);
        $used = $q->fetch();
        if ($used && demo_remaining($used) > 0 && is_file(demo_path($used['token']))) {
            // perangkat yang sama, sesi masih berlaku (mis. cookie sesi terhapus) → lanjutkan
            session_regenerate_id(true);
            $_SESSION['demo_token'] = $used['token']; $_SESSION['uid'] = 1;
            demo_json(['ok' => true, 'data' => demo_info_of($used)]);
        }
        if ($used) demo_json(['ok' => true, 'data' => $base + ['state' => 'used', 'name' => $used['name']]]);

        if ($__a === 'demo_info') demo_json(['ok' => true, 'data' => $base + ['state' => 'new']]);

        // 3) mulai demo baru
        $name = trim(mb_substr(strip_tags((string)($in['name'] ?? '')), 0, 60));
        $phone = demo_phone((string)($in['phone'] ?? ''));
        $biz = trim(mb_substr(strip_tags((string)($in['business'] ?? '')), 0, 60));
        if (mb_strlen($name) < 2) fail('Isi nama Anda.');
        if (!preg_match('/^62\d{8,13}$/', $phone)) fail('Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890');

        $q = $reg->prepare('SELECT * FROM visitors WHERE phone = ? ORDER BY id DESC LIMIT 1'); $q->execute([$phone]);
        if ($q->fetch()) demo_json(['ok' => true, 'data' => $base + ['state' => 'used', 'name' => $name]]);

        $limit = max(1, (int)demo_cfg('demo_ip_limit', 5));
        $q = $reg->prepare('SELECT COUNT(*) FROM visitors WHERE ip = ? AND started > ?');
        $q->execute([demo_ip(), date('Y-m-d H:i:s', time() - 86400)]);
        if ((int)$q->fetchColumn() >= $limit) fail('Terlalu banyak percobaan demo dari jaringan ini hari ini. Silakan hubungi kami lewat WhatsApp.', 429);

        demo_cleanup();
        $token = bin2hex(random_bytes(16));
        if ($dev === '' || !preg_match('/^[a-f0-9]{32}$/', $dev)) $dev = bin2hex(random_bytes(16));
        demo_create_sandbox($token);
        $now = date('Y-m-d H:i:s');
        $reg->prepare('INSERT INTO visitors (token, name, phone, business, device, client_id, ip, user_agent, started, expires, last_seen) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$token, $name, $phone, $biz, $dev, $client, demo_ip(), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250), $now, date('Y-m-d H:i:s', time() + demo_minutes() * 60), $now]);
        demo_set_device_cookie($dev);
        session_regenerate_id(true);
        $_SESSION['demo_token'] = $token; $_SESSION['uid'] = 1; // langsung masuk sebagai pemilik toko
        $q = $reg->prepare('SELECT * FROM visitors WHERE token = ?'); $q->execute([$token]);
        demo_json(['ok' => true, 'data' => demo_info_of($q->fetch())]);
    } catch (ApiError $e) {
        demo_json(['ok' => false, 'error' => $e->getMessage()], $e->status);
    } catch (Throwable $e) {
        error_log('[KasirDemo] ' . $e->getMessage());
        demo_json(['ok' => false, 'error' => !empty($CONFIG['debug']) ? $e->getMessage() : 'Terjadi kesalahan server.'], 500);
    }
}

// ------------------------------------------------------------------ semua aksi aplikasi lainnya
$__v = demo_find_session();
if (!$__v) demo_gate('none');
if (demo_remaining($__v) <= 0 || !is_file(demo_path($__v['token']))) demo_gate('expired', $__v);
$CONFIG['dsn'] = 'sqlite:' . demo_path($__v['token']);
$DEMO = demo_info_of($__v);
if (random_int(1, 10) === 1 || $__a === 'boot') {
    demo_reg()->prepare('UPDATE visitors SET last_seen = ?, hits = hits + 1 WHERE token = ?')->execute([date('Y-m-d H:i:s'), $__v['token']]);
}
// Keluar di mode demo: hanya keluar dari akun, sesi demo tetap berjalan (bisa masuk sebagai kasir)
if ($__a === 'logout') { unset($_SESSION['uid']); demo_json(['ok' => true, 'data' => ['ok' => true]]); }
unset($__a, $__v);
