<?php
/**
 * Sofeeya Store POS — REST API (PHP 7.4+ / 8.x, MySQL / MariaDB)
 * Semua request: POST api/index.php?a=<aksi>   body JSON
 */
declare(strict_types=1);

$CONFIG = require __DIR__ . '/config.php';
// config.local.php (dibuat langsung di server, tidak ikut GitHub) menimpa config.php
if (is_file(__DIR__ . '/config.local.php')) { $CONFIG = array_merge($CONFIG, (array)require __DIR__ . '/config.local.php'); }
if (getenv('POS_TEST_DSN')) { $CONFIG['dsn'] = getenv('POS_TEST_DSN'); } // hanya untuk uji lokal
date_default_timezone_set($CONFIG['timezone'] ?? 'Asia/Makassar');
ini_set('display_errors', !empty($CONFIG['debug']) ? '1' : '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// ---------------------------------------------------------------- session
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('SOFEEYAPOS');
session_set_cookie_params(['lifetime' => 60 * 60 * 24 * 14, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
session_start();

// Mode demo (hanya aktif bila config 'demo' => true): tiap pengunjung mendapat database contoh sendiri
$DEMO = null;
if (!empty($CONFIG['demo'])) require __DIR__ . '/demo.php';

// ---------------------------------------------------------------- helpers
class ApiError extends Exception {
    public int $status;
    public function __construct(string $msg, int $status = 400) { parent::__construct($msg); $this->status = $status; }
}
function fail(string $msg, int $status = 400): void { throw new ApiError($msg, $status); }
function now(): string { return date('Y-m-d H:i:s'); }

function db(): PDO {
    static $pdo = null;
    global $CONFIG;
    if ($pdo) return $pdo;
    try {
        if (!empty($CONFIG['dsn'])) {
            $pdo = new PDO($CONFIG['dsn']);
        } else {
            $dsn = 'mysql:host=' . $CONFIG['db_host'] . ';dbname=' . $CONFIG['db_name'] . ';charset=utf8mb4';
            $pdo = new PDO($dsn, $CONFIG['db_user'], $CONFIG['db_pass']);
        }
    } catch (PDOException $e) {
        fail('Tidak dapat terhubung ke database. Periksa api/config.php.' . (!empty($CONFIG['debug']) ? ' ' . $e->getMessage() : ''), 500);
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    migrate($pdo);
    return $pdo;
}
// Pembaruan struktur database otomatis (tanpa perlu impor ulang database.sql)
function migrate(PDO $pdo): void {
    $v = 1;
    try { $r = $pdo->query("SELECT value FROM settings WHERE `key` = 'schema_version'")->fetch(); if ($r) $v = (int)$r['value']; } catch (Throwable $e) { return; }
    if ($v >= 4) return;
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $pk = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
    $tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $now = date('Y-m-d H:i:s');
    $setDefault = function (string $k, string $val, bool $force = false) use ($pdo, $now) {
        $st = $pdo->prepare('SELECT id FROM settings WHERE `key` = ?'); $st->execute([$k]);
        if ($st->fetch()) { if ($force) $pdo->prepare('UPDATE settings SET value = ?, updated = ? WHERE `key` = ?')->execute([$val, $now, $k]); }
        else $pdo->prepare('INSERT INTO settings (`key`, value, created, updated) VALUES (?,?,?,?)')->execute([$k, $val, $now, $now]);
    };
    $addCol = function (string $t, string $c, string $def) use ($pdo) { try { $pdo->exec("ALTER TABLE $t ADD COLUMN $c $def"); } catch (Throwable $e) { /* sudah ada */ } };
    if ($v < 3) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS shipments (
        id $pk, transaction_id INT NULL, invoice VARCHAR(50) NOT NULL DEFAULT '', courier VARCHAR(60) NOT NULL DEFAULT '',
        recipient VARCHAR(200) NOT NULL DEFAULT '', phone VARCHAR(50) NOT NULL DEFAULT '', address TEXT NULL,
        fee DECIMAL(14,2) NOT NULL DEFAULT 0, resi VARCHAR(100) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'baru',
        note VARCHAR(500) NOT NULL DEFAULT '', cashier VARCHAR(200) NOT NULL DEFAULT '', created DATETIME NULL, updated DATETIME NULL)$tail");
    $presets = json_encode([['label' => 'Ongkir Maxim', 'amount' => 15000], ['label' => 'Ongkir Grab', 'amount' => 20000], ['label' => 'Ongkir J&T', 'amount' => 12000], ['label' => 'Bungkus kado', 'amount' => 5000]]);
    // v3: kolom tambahan pengiriman
    $cols = ['provider' => "VARCHAR(20) NOT NULL DEFAULT 'manual'", 'biteship_order_id' => "VARCHAR(60) NOT NULL DEFAULT ''", 'courier_code' => "VARCHAR(30) NOT NULL DEFAULT ''",
        'courier_service' => "VARCHAR(40) NOT NULL DEFAULT ''", 'tracking_id' => "VARCHAR(80) NOT NULL DEFAULT ''", 'tracking_link' => "VARCHAR(500) NOT NULL DEFAULT ''",
        'bs_status' => "VARCHAR(40) NOT NULL DEFAULT ''", 'driver' => "VARCHAR(200) NOT NULL DEFAULT ''", 'area_id' => "VARCHAR(80) NOT NULL DEFAULT ''",
        'area_name' => "VARCHAR(200) NOT NULL DEFAULT ''", 'postal_code' => "VARCHAR(10) NOT NULL DEFAULT ''", 'lat' => 'DOUBLE NULL', 'lng' => 'DOUBLE NULL',
        'weight' => 'INT NOT NULL DEFAULT 0', 'cost' => 'DECIMAL(14,2) NOT NULL DEFAULT 0'];
    foreach ($cols as $c => $def) { try { $pdo->exec("ALTER TABLE shipments ADD COLUMN $c $def"); } catch (Throwable $e) { /* sudah ada */ } }
    $setDefault('fee_presets', $presets);
    }
    // v4: toko fashion — varian (model/ukuran/warna), saluran penjualan, retur & tukar
    $addCol('products', 'model', "VARCHAR(200) NOT NULL DEFAULT ''");
    $addCol('products', 'size', "VARCHAR(30) NOT NULL DEFAULT ''");
    $addCol('products', 'color', "VARCHAR(40) NOT NULL DEFAULT ''");
    $addCol('transactions', 'channel', "VARCHAR(30) NOT NULL DEFAULT 'Toko'");
    $addCol('transactions', 'return_ref', "VARCHAR(50) NOT NULL DEFAULT ''");
    $addCol('transactions', 'return_items', 'TEXT NULL');
    $addCol('transactions', 'return_amount', 'DECIMAL(14,2) NOT NULL DEFAULT 0');
    $addCol('transactions', 'returned', 'TEXT NULL');
    $setDefault('sales_channels', json_encode(DEFAULT_CHANNELS));
    $setDefault('size_sets', json_encode(DEFAULT_SIZE_SETS));
    $setDefault('return_days', '7');
    $setDefault('schema_version', '4', true);
}
const DEFAULT_CHANNELS = ['Toko', 'WhatsApp', 'Instagram', 'Shopee', 'TikTok Shop'];
const DEFAULT_SIZE_SETS = ['S, M, L, XL', 'XS, S, M, L, XL, XXL', 'All size', 'M, L, XL, XXL, 3XL', '27, 28, 29, 30, 31, 32', '36, 37, 38, 39, 40'];
function q(string $sql, array $p = []): PDOStatement { $s = db()->prepare($sql); $s->execute($p); return $s; }
function one(string $sql, array $p = []): ?array { $r = q($sql, $p)->fetch(); return $r === false ? null : $r; }
function all(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }

function setting(string $key, $default = null) {
    $r = one('SELECT value FROM settings WHERE `key` = ?', [$key]);
    return $r ? $r['value'] : $default;
}
function set_setting(string $key, $value): void {
    $value = is_scalar($value) || $value === null ? (string)$value : json_encode($value, JSON_UNESCAPED_UNICODE);
    if (one('SELECT id FROM settings WHERE `key` = ?', [$key])) {
        q('UPDATE settings SET value = ?, updated = ? WHERE `key` = ?', [$value, now(), $key]);
    } else {
        q('INSERT INTO settings (`key`, value, created, updated) VALUES (?,?,?,?)', [$key, $value, now(), now()]);
    }
}
function client_ip(): string {
    // Hostinger memakai proxy; ambil IP asli bila tersedia
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $h) {
        if (!empty($_SERVER[$h])) return trim(explode(',', $_SERVER[$h])[0]);
    }
    return '';
}

// ---------------------------------------------------------------- auth
function current_user(): ?array {
    static $u = false;
    if ($u !== false) return $u;
    if (empty($_SESSION['uid'])) return $u = null;
    $r = one('SELECT * FROM users WHERE id = ? AND active = 1', [$_SESSION['uid']]);
    return $u = ($r ? public_user($r) : null);
}
function public_user(array $r): array {
    return [
        'id' => (int)$r['id'], 'email' => $r['email'], 'name' => $r['name'], 'role' => $r['role'],
        'promo_access' => (bool)$r['promo_access'] || $r['role'] === 'admin',
        'cek_stok_access' => (bool)$r['cek_stok_access'] || $r['role'] === 'admin',
        'bank_name' => $r['bank_name'], 'bank_account' => $r['bank_account'],
        'active' => (bool)$r['active'], 'created' => $r['created'],
    ];
}
function need_auth(): array { $u = current_user(); if (!$u) fail('Sesi berakhir, silakan masuk kembali.', 401); return $u; }
function is_admin(): bool { $u = current_user(); return $u && $u['role'] === 'admin'; }
function need_admin(): array { $u = need_auth(); if ($u['role'] !== 'admin') fail('Hanya admin yang dapat melakukan ini.', 403); return $u; }
function check_perm(string $perm): array {
    $u = need_auth();
    if ($perm === 'auth') return $u;
    if ($perm === 'admin' && $u['role'] === 'admin') return $u;
    if ($perm === 'promo' && $u['promo_access']) return $u;
    if ($perm === 'stockcheck' && $u['cek_stok_access']) return $u;
    fail('Anda tidak memiliki akses untuk tindakan ini.', 403);
}

// ---------------------------------------------------------------- table schema
// tipe: s=teks, n=angka, i=bilangan bulat, b=ya/tidak, j=JSON, d=tanggal
$TABLES = [
    'products' => ['fields' => ['name' => 's', 'barcode' => 's', 'category' => 's', 'cost' => 'n', 'price' => 'n', 'discount' => 'n', 'stock' => 'i', 'commission' => 'n', 'image' => 's', 'stock_in_date' => 'd', 'model' => 's', 'size' => 's', 'color' => 's'],
        'required' => ['name'], 'search' => ['name', 'barcode', 'category', 'model', 'color'], 'read' => 'auth', 'write' => 'admin', 'order' => 'name'],
    'promos' => ['fields' => ['name' => 's', 'type' => 's', 'value' => 'n', 'min_purchase' => 'n', 'min_price' => 'n', 'max_price' => 'n', 'buy_qty' => 'i', 'free_qty' => 'i', 'free_category' => 's', 'categories' => 'j', 'product_ids' => 'j', 'free_product_ids' => 'j', 'code' => 's', 'stackable' => 'b', 'active' => 'b', 'start_date' => 'd', 'end_date' => 'd', 'badge_text' => 's', 'badge_color' => 's'],
        'required' => ['name', 'type'], 'search' => ['name', 'code'], 'read' => 'auth', 'write' => 'promo', 'order' => 'name'],
    'members' => ['fields' => ['name' => 's', 'phone' => 's', 'email' => 's', 'points' => 'i', 'voucher_amount' => 'n', 'voucher_used' => 'b'],
        'required' => ['name'], 'search' => ['name', 'phone', 'email'], 'read' => 'auth', 'write' => 'admin', 'create' => 'auth', 'order' => 'name'],
    'point_rewards' => ['fields' => ['name' => 's', 'type' => 's', 'points_required' => 'i', 'discount_amount' => 'n', 'product_name' => 's', 'product_barcode' => 's', 'active' => 'b'],
        'required' => ['name'], 'search' => ['name'], 'read' => 'auth', 'write' => 'admin', 'order' => 'points_required'],
    'sales' => ['fields' => ['name' => 's', 'code' => 's', 'active' => 'b'],
        'required' => ['name', 'code'], 'search' => ['name', 'code'], 'read' => 'auth', 'write' => 'admin', 'order' => 'name'],
    'store_info' => ['fields' => ['title' => 's', 'content' => 's', 'active' => 'b'],
        'required' => ['title'], 'search' => ['title', 'content'], 'read' => 'auth', 'write' => 'admin', 'order' => '-created'],
    'links' => ['fields' => ['title' => 's', 'url' => 's', 'category' => 's', 'notes' => 's'],
        'required' => ['title', 'url'], 'search' => ['title', 'url', 'category', 'notes'], 'read' => 'auth', 'write' => 'admin', 'order' => 'category'],
    'transactions' => ['fields' => ['invoice' => 's', 'items' => 'j', 'subtotal' => 'n', 'discount' => 'n', 'fee' => 'n', 'fee_note' => 's', 'total' => 'n', 'payment' => 'n', 'change' => 'n', 'profit' => 'n', 'promo_name' => 's', 'item_count' => 'i', 'member_id' => 'i', 'member_name' => 's', 'points_earned' => 'i', 'points_used' => 'i', 'member_points_after' => 'i', 'cashier' => 's', 'cashier_id' => 'i', 'payment_method' => 's', 'sales_name' => 's', 'sales_code' => 's', 'commission' => 'n', 'note' => 's', 'channel' => 's', 'return_ref' => 's', 'return_items' => 'j', 'return_amount' => 'n', 'returned' => 'j'],
        'updatable' => ['sales_name', 'sales_code', 'commission', 'note'],
        'search' => ['invoice', 'member_name', 'cashier', 'sales_name', 'channel', 'return_ref'], 'read' => 'auth', 'write' => 'admin', 'create' => 'none', 'delete' => 'none', 'order' => '-created'],
    'stock_movements' => ['fields' => ['product_id' => 'i', 'product_name' => 's', 'barcode' => 's', 'type' => 's', 'quantity' => 'i', 'stock_before' => 'i', 'stock_after' => 'i', 'cashier' => 's', 'invoice' => 's', 'note' => 's'],
        'search' => ['product_name', 'barcode', 'invoice', 'note'], 'read' => 'admin', 'write' => 'none', 'delete' => 'admin', 'order' => '-created'],
    'attendance' => ['fields' => ['user_id' => 'i', 'user_name' => 's', 'type' => 's', 'lat' => 'n', 'lng' => 'n', 'ip' => 's', 'is_late' => 'b', 'late_minutes' => 'i'],
        'search' => ['user_name'], 'read' => 'admin', 'write' => 'none', 'delete' => 'admin', 'order' => '-created'],
    'shipments' => ['fields' => ['transaction_id' => 'i', 'invoice' => 's', 'courier' => 's', 'recipient' => 's', 'phone' => 's', 'address' => 's', 'fee' => 'n', 'resi' => 's', 'status' => 's', 'note' => 's', 'cashier' => 's',
        'provider' => 's', 'biteship_order_id' => 's', 'courier_code' => 's', 'courier_service' => 's', 'tracking_id' => 's', 'tracking_link' => 's', 'bs_status' => 's', 'driver' => 's', 'area_id' => 's', 'area_name' => 's', 'postal_code' => 's', 'lat' => 'n', 'lng' => 'n', 'weight' => 'i', 'cost' => 'n'],
        'updatable' => ['courier', 'recipient', 'phone', 'address', 'fee', 'resi', 'status', 'note'],
        'search' => ['invoice', 'recipient', 'phone', 'resi', 'courier'], 'read' => 'auth', 'write' => 'auth', 'create' => 'none', 'delete' => 'admin', 'order' => '-created'],
    'stock_checks' => ['fields' => ['petugas_id' => 'i', 'petugas_name' => 's', 'items' => 'j', 'status' => 's', 'note' => 's', 'reviewed_by' => 'i', 'reviewed_name' => 's'],
        'search' => ['petugas_name'], 'read' => 'stockcheck', 'write' => 'none', 'delete' => 'admin', 'order' => '-created'],
];

function table_def(string $t): array {
    global $TABLES;
    if (!isset($TABLES[$t])) fail('Tabel tidak dikenal: ' . $t);
    return $TABLES[$t];
}
function cast_in(string $type, $v) {
    switch ($type) {
        case 'n': return is_numeric($v) ? (float)$v : 0;
        case 'i': return is_numeric($v) ? (int)round((float)$v) : 0;
        case 'b': return ($v === true || $v === 1 || $v === '1' || $v === 'true' || $v === 'on') ? 1 : 0;
        case 'j': return json_encode(is_array($v) ? array_values($v) : (is_string($v) && $v !== '' ? (json_decode($v, true) ?? []) : []), JSON_UNESCAPED_UNICODE);
        case 'd': return ($v && preg_match('/^\d{4}-\d{2}-\d{2}/', (string)$v)) ? substr((string)$v, 0, 10) : null;
        default:  return trim((string)($v ?? ''));
    }
}
function cast_row(string $table, array $r): array {
    $def = table_def($table);
    $out = ['id' => (int)$r['id']];
    foreach ($def['fields'] as $f => $type) {
        $v = $r[$f] ?? null;
        switch ($type) {
            case 'n': $out[$f] = $v === null ? null : (float)$v + 0; break;
            case 'i': $out[$f] = $v === null ? null : (int)$v; break;
            case 'b': $out[$f] = (bool)(int)$v; break;
            case 'j': $out[$f] = $v ? (json_decode($v, true) ?? []) : []; break;
            default:  $out[$f] = $v ?? '';
        }
    }
    $out['created'] = $r['created'] ?? null;
    $out['updated'] = $r['updated'] ?? null;
    return $out;
}
function pick_fields(string $table, array $data, ?array $only = null): array {
    $def = table_def($table);
    $vals = [];
    foreach ($def['fields'] as $f => $type) {
        if ($only !== null && !in_array($f, $only, true)) continue;
        if (array_key_exists($f, $data)) $vals[$f] = cast_in($type, $data[$f]);
    }
    return $vals;
}
function insert_row(string $table, array $vals): int {
    $vals['created'] = $vals['created'] ?? now();
    if ($table !== 'signals') $vals['updated'] = now();
    $cols = array_keys($vals);
    $sql = 'INSERT INTO ' . $table . ' (' . implode(',', array_map(fn($c) => "`$c`", $cols)) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
    q($sql, array_values($vals));
    return (int)db()->lastInsertId();
}
function update_row(string $table, int $id, array $vals): void {
    if (!$vals) return;
    $vals['updated'] = now();
    $set = implode(',', array_map(fn($c) => "`$c` = ?", array_keys($vals)));
    q("UPDATE $table SET $set WHERE id = ?", array_merge(array_values($vals), [$id]));
}
function get_row(string $table, int $id): array {
    $r = one("SELECT * FROM $table WHERE id = ?", [$id]);
    if (!$r) fail('Data tidak ditemukan.', 404);
    return cast_row($table, $r);
}
function log_movement(array $p, string $type, int $qty, int $before, int $after, string $note, string $invoice = ''): void {
    $u = current_user();
    insert_row('stock_movements', [
        'product_id' => (int)$p['id'], 'product_name' => $p['name'], 'barcode' => $p['barcode'] ?? '',
        'type' => $type, 'quantity' => $qty, 'stock_before' => $before, 'stock_after' => $after,
        'cashier' => $u['name'] ?? '', 'invoice' => $invoice, 'note' => $note,
    ]);
}

// ---------------------------------------------------------------- generic CRUD
function crud_list(array $in): array {
    $t = (string)($in['table'] ?? '');
    $def = table_def($t);
    $u = check_perm($def['read']);
    $where = []; $p = [];
    foreach (($in['where'] ?? []) as $f => $v) {
        if (!isset($def['fields'][$f]) && $f !== 'id') continue;
        $where[] = "`$f` = ?"; $p[] = $f === 'id' ? (int)$v : cast_in($def['fields'][$f], $v);
    }
    // kasir hanya melihat absensinya sendiri
    if ($t === 'attendance' && $u['role'] !== 'admin') { $where[] = 'user_id = ?'; $p[] = $u['id']; }
    if (!empty($in['from'])) { $where[] = 'created >= ?'; $p[] = substr((string)$in['from'], 0, 10) . ' 00:00:00'; }
    if (!empty($in['to']))   { $where[] = 'created <= ?'; $p[] = substr((string)$in['to'], 0, 10) . ' 23:59:59'; }
    if (!empty($in['q'])) {
        $or = [];
        foreach ($def['search'] as $f) { $or[] = "`$f` LIKE ?"; $p[] = '%' . $in['q'] . '%'; }
        $where[] = '(' . implode(' OR ', $or) . ')';
    }
    $order = (string)($in['order'] ?? $def['order']);
    $dir = 'ASC';
    if (strpos($order, '-') === 0) { $dir = 'DESC'; $order = substr($order, 1); }
    if (!isset($def['fields'][$order]) && !in_array($order, ['id', 'created', 'updated'], true)) $order = 'id';
    $limit = max(1, min(20000, (int)($in['limit'] ?? 5000)));
    $sql = "SELECT * FROM $t" . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . " ORDER BY `$order` $dir, id $dir LIMIT $limit";
    return array_map(fn($r) => cast_row($t, $r), all($sql, $p));
}
function crud_create(array $in): array {
    $t = (string)($in['table'] ?? '');
    $def = table_def($t);
    $perm = $def['create'] ?? $def['write'];
    if ($perm === 'none') fail('Tidak dapat dibuat langsung.', 403);
    $data = (array)($in['data'] ?? []);
    if ($t === 'products' && !is_admin()) {
        // kasir boleh menambah barang dengan kode supervisor
        need_auth();
        if ((string)($in['pin'] ?? '') === '' || !hash_equals((string)setting('supervisor_pin', '1234'), (string)$in['pin'])) fail('PIN admin salah. Menambah barang hanya oleh admin atau dengan PIN admin.', 403);
    } else {
        check_perm($perm);
    }
    $vals = pick_fields($t, $data);
    if ($t === 'products' && trim((string)($vals['barcode'] ?? '')) === '' && !empty($in['auto_barcode'])) $vals['barcode'] = gen_barcode();
    foreach ($def['required'] ?? [] as $r) if (($vals[$r] ?? '') === '') fail("Kolom '$r' wajib diisi.");
    validate_row($t, $vals, null);
    $id = insert_row($t, $vals);
    if ($t === 'products' && ($vals['stock'] ?? 0) > 0) {
        $p = get_row('products', $id);
        log_movement($p, 'in', (int)$vals['stock'], 0, (int)$vals['stock'], 'Stok awal');
    }
    return get_row($t, $id);
}
function crud_update(array $in): array {
    $t = (string)($in['table'] ?? '');
    $def = table_def($t);
    if ($def['write'] === 'none') fail('Tidak dapat diubah.', 403);
    check_perm($def['write']);
    $id = (int)($in['id'] ?? 0);
    $old = get_row($t, $id);
    $vals = pick_fields($t, (array)($in['data'] ?? []), $def['updatable'] ?? null);
    foreach ($def['required'] ?? [] as $r) if (array_key_exists($r, $vals) && $vals[$r] === '') fail("Kolom '$r' wajib diisi.");
    validate_row($t, $vals, $id);
    db()->beginTransaction();
    update_row($t, $id, $vals);
    if ($t === 'products' && array_key_exists('stock', $vals) && (int)$vals['stock'] !== (int)$old['stock']) {
        $diff = (int)$vals['stock'] - (int)$old['stock'];
        log_movement($old, $diff > 0 ? 'in' : 'out', abs($diff), (int)$old['stock'], (int)$vals['stock'], 'Koreksi stok (edit produk)');
    }
    db()->commit();
    return get_row($t, $id);
}
function crud_delete(array $in): array {
    $t = (string)($in['table'] ?? '');
    $def = table_def($t);
    $perm = $def['delete'] ?? $def['write'];
    if ($perm === 'none') fail('Tidak dapat dihapus langsung.', 403);
    check_perm($perm);
    $ids = isset($in['ids']) ? array_map('intval', (array)$in['ids']) : [(int)($in['id'] ?? 0)];
    foreach ($ids as $id) q("DELETE FROM $t WHERE id = ?", [$id]);
    return ['deleted' => count($ids)];
}
function validate_row(string $t, array &$vals, ?int $id): void {
    if ($t === 'sales' && isset($vals['code'])) {
        $vals['code'] = strtoupper($vals['code']);
        $dup = one('SELECT id FROM sales WHERE code = ? AND id <> ?', [$vals['code'], $id ?? 0]);
        if ($dup) fail('Kode sales sudah dipakai.');
    }
    if ($t === 'products' && !empty($vals['barcode'])) {
        $dup = one('SELECT id, name FROM products WHERE barcode = ? AND id <> ?', [$vals['barcode'], $id ?? 0]);
        if ($dup) fail('Barcode sudah dipakai oleh produk "' . $dup['name'] . '".');
    }
    if ($t === 'promos') {
        if (isset($vals['type']) && !in_array($vals['type'], ['percent', 'fixed', 'price', 'package', 'bogo'], true)) fail('Tipe promo tidak valid.');
        if (isset($vals['code'])) $vals['code'] = strtoupper($vals['code']);
    }
    if ($t === 'shipments' && isset($vals['status']) && !in_array($vals['status'], ['baru', 'dipesan', 'dikirim', 'selesai', 'batal'], true)) fail('Status pengiriman tidak valid.');
    if ($t === 'links' && isset($vals['url']) && !preg_match('~^https?://~i', $vals['url'])) $vals['url'] = 'https://' . $vals['url'];
}

// ---------------------------------------------------------------- business actions
function public_settings(): array {
    $keys = ['store_name', 'points_per_amount', 'member_discount_percent', 'member_offer_threshold', 'receipt_address', 'receipt_phone', 'receipt_footer1', 'receipt_footer2', 'work_schedule', 'fee_presets', 'qris_payload', 'sales_channels', 'size_sets', 'return_days'];
    $out = [];
    foreach (all('SELECT `key`, value FROM settings') as $r) if (in_array($r['key'], $keys, true)) $out[$r['key']] = $r['value'];
    $out['store_name'] = $out['store_name'] ?? 'Sofeeya Store';
    return $out;
}

// Barcode internal toko (EAN-13 berawalan 2 = khusus pemakaian di toko)
function gen_barcode(): string {
    for ($i = 0; $i < 20; $i++) {
        $d = '2' . str_pad((string)random_int(0, 99999999999), 11, '0', STR_PAD_LEFT);
        $sum = 0; for ($k = 0; $k < 12; $k++) $sum += (int)$d[$k] * ($k % 2 ? 3 : 1);
        $code = $d . ((10 - $sum % 10) % 10);
        if (!one('SELECT id FROM products WHERE barcode = ?', [$code])) return $code;
    }
    return 'SF' . date('ymdHis') . random_int(10, 99);
}
function variant_name(string $model, string $color, string $size): string {
    $v = trim(implode(' / ', array_filter([trim($color), trim($size)], fn($x) => $x !== '')));
    return $v === '' ? $model : $model . ' - ' . $v;
}
function clean_list($v, int $max = 30, int $len = 40): array {
    if (is_string($v)) $v = preg_split('/\s*,\s*/', $v);
    $out = [];
    foreach ((array)$v as $x) { $x = trim(mb_substr((string)$x, 0, $len)); if ($x !== '' && !in_array(mb_strtolower($x), array_map('mb_strtolower', $out), true)) $out[] = $x; }
    return array_slice($out, 0, $max);
}
// Simpan satu model dengan banyak varian (warna × ukuran). Varian yang sudah ada diperbarui.
function variants_save(array $in): array {
    if (!is_admin()) {
        need_auth();
        if ((string)($in['pin'] ?? '') === '' || !hash_equals((string)setting('supervisor_pin', '1234'), (string)$in['pin'])) fail('PIN admin salah. Menambah barang hanya oleh admin atau dengan PIN admin.', 403);
    }
    $model = trim(mb_substr((string)($in['model'] ?? ''), 0, 200));
    if ($model === '') fail('Nama model wajib diisi.');
    $price = max(0, (float)($in['price'] ?? 0));
    if ($price <= 0) fail('Harga jual wajib diisi.');
    $colors = clean_list($in['colors'] ?? []); $sizes = clean_list($in['sizes'] ?? [], 30, 30);
    if (!$colors) $colors = [''];
    if (!$sizes) $sizes = [''];
    if (count($colors) * count($sizes) > 200) fail('Maksimal 200 varian per model.');
    $stocks = (array)($in['stocks'] ?? []); $barcodes = (array)($in['barcodes'] ?? []);
    $base = ['category' => trim(mb_substr((string)($in['category'] ?? ''), 0, 100)), 'cost' => max(0, (float)($in['cost'] ?? 0)), 'price' => $price,
             'discount' => max(0, (float)($in['discount'] ?? 0)), 'commission' => max(0, (float)($in['commission'] ?? 0))];
    $created = []; $updated = 0;
    $imgRow = one("SELECT image FROM products WHERE model = ? AND image <> '' LIMIT 1", [$model]);
    $img = $imgRow ? (string)$imgRow['image'] : '';
    db()->beginTransaction();
    try {
        foreach ($colors as $c) foreach ($sizes as $z) {
            $key = $c . '|' . $z;
            $ex = one('SELECT * FROM products WHERE model = ? AND color = ? AND size = ?', [$model, $c, $z]);
            if ($ex) { update_row('products', (int)$ex['id'], $base + ['name' => variant_name($model, $c, $z)]); $updated++; continue; }
            $stock = max(0, (int)($stocks[$key] ?? 0));
            $bc = trim((string)($barcodes[$key] ?? ''));
            if ($bc !== '' && one('SELECT id FROM products WHERE barcode = ?', [$bc])) fail('Barcode ' . $bc . ' sudah dipakai barang lain.');
            if ($bc === '') $bc = gen_barcode();
            $id = insert_row('products', $base + ['name' => variant_name($model, $c, $z), 'model' => $model, 'color' => $c, 'size' => $z, 'barcode' => $bc,
                'stock' => $stock, 'image' => $img, 'stock_in_date' => $stock > 0 ? date('Y-m-d') : null]);
            if ($stock > 0) log_movement(['id' => $id, 'name' => variant_name($model, $c, $z), 'barcode' => $bc], 'in', $stock, 0, $stock, 'Stok awal');
            $created[] = $id;
        }
        db()->commit();
    } catch (Throwable $e) { if (db()->inTransaction()) db()->rollBack(); throw $e; }
    return ['created' => count($created), 'updated' => $updated, 'items' => array_map(fn($r) => cast_row('products', $r), all('SELECT * FROM products WHERE model = ? ORDER BY id', [$model]))];
}
// Ubah data semua varian dalam satu model sekaligus (nama model, kategori, harga, dll.)
function model_update(array $in): array {
    need_admin();
    $model = (string)($in['model'] ?? '');
    $rows = all('SELECT * FROM products WHERE model = ?', [$model]);
    if (!$rows || $model === '') fail('Model tidak ditemukan.');
    $d = (array)($in['data'] ?? []);
    $vals = [];
    foreach (['category' => 's', 'cost' => 'n', 'price' => 'n', 'discount' => 'n', 'commission' => 'n'] as $f => $t) if (array_key_exists($f, $d)) $vals[$f] = $t === 'n' ? max(0, (float)$d[$f]) : trim((string)$d[$f]);
    $new = array_key_exists('model', $d) ? trim(mb_substr((string)$d['model'], 0, 200)) : $model;
    if ($new === '') fail('Nama model wajib diisi.');
    db()->beginTransaction();
    foreach ($rows as $r) update_row('products', (int)$r['id'], $vals + ['model' => $new, 'name' => variant_name($new, $r['color'], $r['size'])]);
    db()->commit();
    return ['updated' => count($rows)];
}
// Atur stok banyak barang sekaligus (matriks stok). Selisih tercatat di riwayat stok.
function stock_set_bulk(array $in): array {
    need_admin();
    $note = trim(mb_substr((string)($in['note'] ?? ''), 0, 200));
    $n = 0;
    db()->beginTransaction();
    foreach ((array)($in['items'] ?? []) as $it) {
        $p = one('SELECT * FROM products WHERE id = ?', [(int)($it['id'] ?? 0)]);
        if (!$p) continue;
        $new = max(0, (int)($it['stock'] ?? 0)); $old = (int)$p['stock'];
        if ($new === $old) continue;
        $vals = ['stock' => $new]; if ($new > $old) $vals['stock_in_date'] = date('Y-m-d');
        update_row('products', (int)$p['id'], $vals);
        log_movement($p, $new > $old ? 'in' : 'out', abs($new - $old), $old, $new, $note ?: ($new > $old ? 'Stok masuk (matriks)' : 'Koreksi stok (matriks)'));
        $n++;
    }
    db()->commit();
    return ['changed' => $n];
}
// Foto produk: disimpan sebagai file JPG di folder uploads/produk
function product_image(array $in): array {
    global $CONFIG;
    need_admin();
    if (!empty($CONFIG['demo'])) fail('Upload foto tidak tersedia di versi demo.', 403);
    $ids = array_values(array_filter(array_map('intval', (array)($in['ids'] ?? []))));
    if (!$ids) fail('Pilih barang.');
    $url = '';
    if (empty($in['remove'])) {
        $data = (string)($in['data'] ?? '');
        if (!preg_match('~^data:image/(jpeg|png|webp);base64,~', $data, $m)) fail('Format foto tidak didukung. Gunakan JPG/PNG.');
        $bin = base64_decode(substr($data, strpos($data, ',') + 1), true);
        if ($bin === false || strlen($bin) > 1500000) fail('Ukuran foto terlalu besar (maks. 1,5 MB).');
        $info = @getimagesizefromstring($bin);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) fail('File bukan gambar yang valid.');
        $dir = dirname(__DIR__) . '/uploads/produk';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('Folder uploads/produk tidak dapat dibuat. Periksa izin folder.', 500);
        $name = bin2hex(random_bytes(10)) . '.jpg';
        $ok = false;
        if (function_exists('imagecreatefromstring') && function_exists('imagejpeg')) {
            $im = @imagecreatefromstring($bin);
            if ($im) {
                $w = imagesx($im); $h = imagesy($im); $max = 800;
                if ($w > $max || $h > $max) { $k = $max / max($w, $h); $nw = (int)round($w * $k); $nh = (int)round($h * $k); $dst = imagecreatetruecolor($nw, $nh); imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255)); imagecopyresampled($dst, $im, 0, 0, 0, 0, $nw, $nh, $w, $h); imagedestroy($im); $im = $dst; }
                else { $bg = imagecreatetruecolor($w, $h); imagefill($bg, 0, 0, imagecolorallocate($bg, 255, 255, 255)); imagecopy($bg, $im, 0, 0, 0, 0, $w, $h); imagedestroy($im); $im = $bg; }
                $ok = imagejpeg($im, $dir . '/' . $name, 82); imagedestroy($im);
            }
        }
        if (!$ok) { if ($info[2] !== IMAGETYPE_JPEG) fail('Server tidak dapat mengolah foto PNG. Gunakan JPG.'); $ok = (bool)file_put_contents($dir . '/' . $name, $bin); }
        if (!$ok) fail('Gagal menyimpan foto.', 500);
        $url = 'uploads/produk/' . $name;
    }
    $old = [];
    foreach ($ids as $id) { $r = one('SELECT image FROM products WHERE id = ?', [$id]); if ($r && $r['image']) $old[] = $r['image']; q('UPDATE products SET image = ?, updated = ? WHERE id = ?', [$url, now(), $id]); }
    // hapus file lama yang sudah tidak dipakai
    foreach (array_unique($old) as $f) {
        if (strpos($f, 'uploads/produk/') === 0 && !one('SELECT id FROM products WHERE image = ? LIMIT 1', [$f])) @unlink(dirname(__DIR__) . '/' . $f);
    }
    return ['image' => $url];
}

function gen_invoice(): string {
    for ($i = 0; $i < 10; $i++) {
        $inv = 'INV' . date('ymd') . '-' . random_int(1000, 9999);
        if (!one('SELECT id FROM transactions WHERE invoice = ?', [$inv])) return $inv;
    }
    return 'INV' . date('ymdHis') . '-' . random_int(10, 99);
}

function checkout(array $in): array {
    $u = need_auth();
    $cart = (array)($in['items'] ?? []);
    $ret = !empty($in['retur']) && is_array($in['retur']) ? $in['retur'] : null;
    if (!$cart && !$ret) fail('Keranjang kosong.');
    db()->beginTransaction();
    try {
        $items = []; $subtotal = 0; $gross = 0; $commissionBase = 0; $count = 0; $shortages = [];
        foreach ($cart as $c) {
            $p = one('SELECT * FROM products WHERE id = ?', [(int)($c['id'] ?? 0)]);
            if (!$p) fail('Produk tidak ditemukan: ' . ($c['name'] ?? ''));
            $qty = max(1, (int)($c['qty'] ?? 1));
            if ((int)$p['stock'] < $qty) $shortages[] = $p['name'] . ' (stok ' . (int)$p['stock'] . ')';
            $price = max(0, (float)($c['price'] ?? $p['price']));
            $cost = (float)$p['cost'];
            $subtotal += $price * $qty;
            $gross += ($price - $cost) * $qty;
            $commissionBase += (float)$p['commission'] * $qty;
            $count += $qty;
            $items[] = [
                'id' => (int)$p['id'], 'name' => $p['name'], 'barcode' => $p['barcode'], 'category' => $p['category'],
                'model' => (string)($p['model'] ?? ''), 'size' => (string)($p['size'] ?? ''), 'color' => (string)($p['color'] ?? ''),
                'qty' => $qty, 'price' => $price, 'original_price' => (float)$p['price'], 'cost' => $cost,
                'commission' => (float)$p['commission'], 'discount' => (float)($c['discount'] ?? 0),
                'itemDiscount' => max(0, (float)($c['itemDiscount'] ?? 0)), 'promoName' => (string)($c['promoName'] ?? ''),
            ];
        }
        if ($shortages) fail('Stok tidak cukup: ' . implode(', ', $shortages));

        // retur / tukar barang dari transaksi sebelumnya
        $retItems = []; $retAmount = 0; $retProfit = 0; $orig = null;
        if ($ret) {
            $orig = one('SELECT * FROM transactions WHERE invoice = ?', [trim((string)($ret['invoice'] ?? ''))]);
            if (!$orig) fail('Transaksi asal retur tidak ditemukan.');
            $orig = cast_row('transactions', $orig);
            $already = []; foreach ((array)$orig['returned'] as $r) $already[(int)$r['id']] = ($already[(int)$r['id']] ?? 0) + (int)$r['qty'];
            foreach ((array)($ret['items'] ?? []) as $r) {
                $qty = max(0, (int)($r['qty'] ?? 0)); if (!$qty) continue;
                $src = null; foreach ((array)$orig['items'] as $oi) if ((int)$oi['id'] === (int)($r['id'] ?? 0)) { $src = $oi; break; }
                if (!$src) fail('Barang retur tidak ada di transaksi ' . $orig['invoice'] . '.');
                $left = (int)$src['qty'] - ($already[(int)$src['id']] ?? 0);
                if ($qty > $left) fail('Jumlah retur ' . $src['name'] . ' melebihi sisa yang dibeli (' . $left . ').');
                $unit = round(((float)$src['price'] * (int)$src['qty'] - (float)($src['itemDiscount'] ?? 0)) / max(1, (int)$src['qty']));
                $retAmount += $unit * $qty; $retProfit += ($unit - (float)$src['cost']) * $qty;
                $retItems[] = ['id' => (int)$src['id'], 'name' => $src['name'], 'qty' => $qty, 'price' => $unit, 'cost' => (float)$src['cost'],
                               'size' => (string)($src['size'] ?? ''), 'color' => (string)($src['color'] ?? ''), 'model' => (string)($src['model'] ?? ''), 'category' => (string)($src['category'] ?? '')];
                $already[(int)$src['id']] = ($already[(int)$src['id']] ?? 0) + $qty;
            }
            if (!$retItems) fail('Pilih barang yang diretur.');
        }

        $discount = min($subtotal, max(0, (float)($in['discount'] ?? 0)));
        $fee = max(0, (float)($in['fee'] ?? 0));
        $total = $subtotal - $discount + $fee - $retAmount;
        if (!$ret) $total = max(0, $total);
        $payment = (float)($in['payment'] ?? 0);
        $pm = (string)($in['payment_method'] ?? 'cash'); $method = in_array($pm, ['cash', 'qris', 'transfer'], true) ? $pm : 'cash';
        if ($total <= 0) { $payment = 0; }
        else {
            if ($method !== 'cash') $payment = max($payment, $total);
            if ($payment + 0.001 < $total) fail('Pembayaran kurang dari total.');
        }
        $channels = json_decode((string)setting('sales_channels', ''), true) ?: DEFAULT_CHANNELS;
        $channel = trim(mb_substr((string)($in['channel'] ?? 'Toko'), 0, 30));
        if (!in_array($channel, $channels, true)) $channel = $channels[0] ?? 'Toko';

        // member & poin
        $member = null; $earned = 0; $used = 0; $after = 0;
        if (!empty($in['member_id'])) {
            $member = one('SELECT * FROM members WHERE id = ?', [(int)$in['member_id']]);
            if (!$member) fail('Member tidak ditemukan.');
            $rate = max(1, (float)setting('points_per_amount', '1000'));
            $earned = (int)floor(max(0, $total) / $rate);
            if (!empty($in['reward_id'])) {
                $rw = one('SELECT * FROM point_rewards WHERE id = ? AND active = 1', [(int)$in['reward_id']]);
                if (!$rw) fail('Reward poin tidak valid.');
                if ((int)$member['points'] < (int)$rw['points_required']) fail('Poin member tidak cukup untuk reward ini.');
                $used = (int)$rw['points_required'];
            }
            $after = max(0, (int)$member['points'] - $used + $earned);
            $mv = ['points' => $after];
            if (!empty($in['voucher_applied']) && (float)$member['voucher_amount'] > 0 && !(int)$member['voucher_used']) $mv['voucher_used'] = 1;
            update_row('members', (int)$member['id'], $mv);
        }

        // sales & komisi
        $sales = null;
        if (!empty($in['sales_code'])) {
            $sales = one('SELECT * FROM sales WHERE code = ? AND active = 1', [strtoupper(trim((string)$in['sales_code']))]);
            if (!$sales) fail('Kode sales tidak ditemukan / tidak aktif.');
        }

        $invoice = gen_invoice();
        $id = insert_row('transactions', [
            'invoice' => $invoice, 'items' => json_encode($items, JSON_UNESCAPED_UNICODE),
            'subtotal' => $subtotal, 'discount' => $discount, 'fee' => $fee, 'fee_note' => mb_substr((string)($in['fee_note'] ?? ''), 0, 500),
            'total' => $total, 'payment' => $payment, 'change' => $total > 0 ? max(0, $payment - $total) : 0, 'profit' => $gross - $discount - $retProfit,
            'promo_name' => mb_substr((string)($in['promo_name'] ?? ''), 0, 500), 'item_count' => $count,
            'member_id' => $member ? (int)$member['id'] : null, 'member_name' => $member['name'] ?? '',
            'points_earned' => $earned, 'points_used' => $used, 'member_points_after' => $member ? $after : 0,
            'cashier' => $u['name'], 'cashier_id' => $u['id'], 'payment_method' => $method,
            'sales_name' => $sales['name'] ?? '', 'sales_code' => $sales['code'] ?? '', 'commission' => $sales ? $commissionBase : 0,
            'note' => mb_substr(trim((string)($in['note'] ?? '')), 0, 1000),
            'channel' => $channel, 'return_ref' => $orig['invoice'] ?? '', 'return_items' => json_encode($retItems, JSON_UNESCAPED_UNICODE), 'return_amount' => $retAmount,
            'returned' => '[]',
        ]);
        if ($orig) {
            $list = (array)$orig['returned'];
            foreach ($retItems as $r) $list[] = ['id' => $r['id'], 'qty' => $r['qty'], 'by' => $invoice];
            q('UPDATE transactions SET returned = ?, updated = ? WHERE id = ?', [json_encode($list, JSON_UNESCAPED_UNICODE), now(), $orig['id']]);
            foreach ($retItems as $r) {
                $p = one('SELECT * FROM products WHERE id = ?', [$r['id']]);
                if (!$p) continue;
                $before = (int)$p['stock']; $after = $before + $r['qty'];
                q('UPDATE products SET stock = ?, updated = ? WHERE id = ?', [$after, now(), $p['id']]);
                log_movement($p, 'in', $r['qty'], $before, $after, 'Retur dari ' . $orig['invoice'], $invoice);
            }
        }
        if (!empty($in['shipping']) && is_array($in['shipping'])) {
            $sh = $in['shipping'];
            if (trim((string)($sh['courier'] ?? '')) === '') fail('Pilih kurir pengiriman.');
            insert_row('shipments', ['transaction_id' => $id, 'invoice' => $invoice, 'courier' => mb_substr(trim((string)$sh['courier']), 0, 60),
                'recipient' => mb_substr(trim((string)($sh['recipient'] ?? '')), 0, 200), 'phone' => mb_substr(trim((string)($sh['phone'] ?? '')), 0, 50),
                'address' => mb_substr(trim((string)($sh['address'] ?? '')), 0, 2000), 'fee' => max(0, (float)($sh['fee'] ?? 0)),
                'resi' => mb_substr(trim((string)($sh['resi'] ?? '')), 0, 100), 'status' => 'baru', 'note' => mb_substr(trim((string)($sh['note'] ?? '')), 0, 500), 'cashier' => $u['name'],
                'provider' => 'manual', 'courier_code' => mb_substr((string)($sh['courier_code'] ?? ''), 0, 30), 'courier_service' => mb_substr((string)($sh['courier_service'] ?? ''), 0, 40),
                'area_id' => mb_substr((string)($sh['area_id'] ?? ''), 0, 80), 'area_name' => mb_substr((string)($sh['area_name'] ?? ''), 0, 200), 'postal_code' => mb_substr((string)($sh['postal_code'] ?? ''), 0, 10),
                'lat' => is_numeric($sh['lat'] ?? null) ? (float)$sh['lat'] : null, 'lng' => is_numeric($sh['lng'] ?? null) ? (float)$sh['lng'] : null, 'weight' => (int)($sh['weight'] ?? 0), 'cost' => (float)($sh['cost'] ?? 0)]);
        }
        foreach ($items as $it) {
            $p = one('SELECT * FROM products WHERE id = ?', [$it['id']]);
            $before = (int)$p['stock']; $newStock = max(0, $before - $it['qty']);
            q('UPDATE products SET stock = ?, updated = ? WHERE id = ?', [$newStock, now(), $it['id']]);
            log_movement($p, 'out', $it['qty'], $before, $newStock, 'Penjualan', $invoice);
        }
        db()->commit();
    } catch (Throwable $e) {
        if (db()->inTransaction()) db()->rollBack();
        throw $e;
    }
    $tx = get_row('transactions', $id);
    $sh = one('SELECT * FROM shipments WHERE transaction_id = ?', [$id]);
    $tx['shipping'] = $sh ? cast_row('shipments', $sh) : null;
    return $tx;
}

function tx_delete(array $in): array {
    need_admin();
    $tx = get_row('transactions', (int)($in['id'] ?? 0));
    $reason = trim((string)($in['reason'] ?? ''));
    db()->beginTransaction();
    try {
        // transaksi ini meretur barang lain: kembalikan catatan retur & stoknya
        if (!empty($tx['return_ref'])) {
            $o = one('SELECT * FROM transactions WHERE invoice = ?', [$tx['return_ref']]);
            if ($o) { $o = cast_row('transactions', $o); q('UPDATE transactions SET returned = ?, updated = ? WHERE id = ?', [json_encode(array_values(array_filter((array)$o['returned'], fn($r) => ($r['by'] ?? '') !== $tx['invoice'])), JSON_UNESCAPED_UNICODE), now(), $o['id']]); }
            if (!empty($in['restore_stock'])) foreach ((array)$tx['return_items'] as $it) {
                $p = one('SELECT * FROM products WHERE id = ?', [(int)$it['id']]); if (!$p) continue;
                $before = (int)$p['stock']; $after = max(0, $before - (int)$it['qty']);
                q('UPDATE products SET stock = ?, updated = ? WHERE id = ?', [$after, now(), $p['id']]);
                log_movement($p, 'out', (int)$it['qty'], $before, $after, 'Batal retur ' . $tx['invoice'], $tx['invoice']);
            }
        }
        if (!empty($in['restore_stock'])) {
            foreach ($tx['items'] as $it) {
                $p = one('SELECT * FROM products WHERE id = ?', [(int)$it['id']]);
                if (!$p) continue;
                $before = (int)$p['stock']; $after = $before + (int)$it['qty'];
                q('UPDATE products SET stock = ?, updated = ? WHERE id = ?', [$after, now(), $p['id']]);
                log_movement($p, 'in', (int)$it['qty'], $before, $after, 'Batal transaksi' . ($reason ? ": $reason" : ''), $tx['invoice']);
            }
        }
        if ($tx['member_id']) {
            $m = one('SELECT * FROM members WHERE id = ?', [$tx['member_id']]);
            if ($m) update_row('members', (int)$m['id'], ['points' => max(0, (int)$m['points'] - (int)$tx['points_earned'] + (int)$tx['points_used'])]);
        }
        q("UPDATE shipments SET status = 'batal', updated = ? WHERE transaction_id = ?", [now(), $tx['id']]);
        q('DELETE FROM transactions WHERE id = ?', [$tx['id']]);
        db()->commit();
    } catch (Throwable $e) { db()->rollBack(); throw $e; }
    return ['ok' => true];
}

function stock_adjust(array $in): array {
    need_admin();
    $p = one('SELECT * FROM products WHERE id = ?', [(int)($in['product_id'] ?? 0)]);
    if (!$p) fail('Produk tidak ditemukan.');
    $qty = (int)($in['qty'] ?? 0);
    if ($qty <= 0) fail('Jumlah harus lebih dari 0.');
    $type = ($in['type'] ?? 'in') === 'out' ? 'out' : 'in';
    $before = (int)$p['stock'];
    $after = $type === 'in' ? $before + $qty : max(0, $before - $qty);
    $vals = ['stock' => $after];
    if ($type === 'in') $vals['stock_in_date'] = date('Y-m-d');
    db()->beginTransaction();
    update_row('products', (int)$p['id'], $vals);
    log_movement($p, $type, $qty, $before, $after, trim((string)($in['note'] ?? '')) ?: ($type === 'in' ? 'Stok masuk' : 'Stok keluar'));
    db()->commit();
    return get_row('products', (int)$p['id']);
}

function product_import(array $in): array {
    need_admin();
    $rows = (array)($in['rows'] ?? []);
    $mode = $in['mode'] ?? 'products';
    $created = 0; $updated = 0; $skipped = 0; $errors = [];
    db()->beginTransaction();
    foreach ($rows as $i => $r) {
        $name = trim((string)($r['name'] ?? '')); $barcode = trim((string)($r['barcode'] ?? ''));
        $model = trim((string)($r['model'] ?? '')); $color = trim((string)($r['color'] ?? '')); $size = trim((string)($r['size'] ?? ''));
        if ($model !== '') { $name = variant_name($model, $color, $size); $r['name'] = $name; }
        $existing = null;
        if ($barcode !== '') $existing = one('SELECT * FROM products WHERE barcode = ?', [$barcode]);
        if (!$existing && $model !== '') $existing = one('SELECT * FROM products WHERE model = ? AND color = ? AND size = ?', [$model, $color, $size]);
        if (!$existing && $name !== '') $existing = one('SELECT * FROM products WHERE LOWER(name) = LOWER(?)', [$name]);
        if ($mode === 'discount') {
            if (!$existing) { $skipped++; continue; }
            update_row('products', (int)$existing['id'], ['discount' => (float)($r['discount'] ?? 0)]);
            $updated++; continue;
        }
        if ($name === '') { $skipped++; $errors[] = 'Baris ' . ($i + 2) . ': nama kosong'; continue; }
        $vals = pick_fields('products', $r);
        if ($existing) {
            unset($vals['stock']);
            update_row('products', (int)$existing['id'], $vals);
            $newStock = isset($r['stock']) && $r['stock'] !== '' ? (int)$r['stock'] : null;
            if ($newStock !== null && $newStock !== (int)$existing['stock']) {
                q('UPDATE products SET stock = ? WHERE id = ?', [$newStock, $existing['id']]);
                $d = $newStock - (int)$existing['stock'];
                log_movement($existing, $d > 0 ? 'in' : 'out', abs($d), (int)$existing['stock'], $newStock, 'Impor file');
            }
            $updated++;
        } else {
            if (trim((string)($vals['barcode'] ?? '')) === '') $vals['barcode'] = gen_barcode();
            $id = insert_row('products', $vals);
            if (($vals['stock'] ?? 0) > 0) log_movement(['id' => $id, 'name' => $name, 'barcode' => $vals['barcode']], 'in', (int)$vals['stock'], 0, (int)$vals['stock'], 'Impor file');
            $created++;
        }
    }
    db()->commit();
    return compact('created', 'updated', 'skipped', 'errors');
}

function member_import(array $in): array {
    need_admin();
    $created = 0; $updated = 0; $skipped = 0;
    db()->beginTransaction();
    foreach ((array)($in['rows'] ?? []) as $r) {
        $name = trim((string)($r['name'] ?? ''));
        if ($name === '') { $skipped++; continue; }
        $phone = trim((string)($r['phone'] ?? ''));
        $ex = $phone !== '' ? one('SELECT id FROM members WHERE phone = ?', [$phone]) : null;
        $vals = pick_fields('members', $r, ['name', 'phone', 'email', 'points']);
        if ($ex) { update_row('members', (int)$ex['id'], $vals); $updated++; }
        else { insert_row('members', $vals); $created++; }
    }
    db()->commit();
    return compact('created', 'updated', 'skipped');
}

// ---- users
function users_action(string $op, array $in): array {
    $me = need_admin();
    if ($op === 'list') return array_map('public_user', all('SELECT * FROM users ORDER BY role, name'));
    $data = (array)($in['data'] ?? []);
    $vals = [];
    foreach (['name', 'email', 'role', 'bank_name', 'bank_account'] as $f) if (array_key_exists($f, $data)) $vals[$f] = trim((string)$data[$f]);
    foreach (['promo_access', 'cek_stok_access', 'active'] as $f) if (array_key_exists($f, $data)) $vals[$f] = cast_in('b', $data[$f]);
    if (isset($vals['role']) && !in_array($vals['role'], ['admin', 'kasir'], true)) fail('Peran tidak valid.');
    if (isset($vals['email'])) {
        $vals['email'] = strtolower($vals['email']);
        if (!filter_var($vals['email'], FILTER_VALIDATE_EMAIL)) fail('Format email tidak valid.');
    }
    if ($op === 'create') {
        if (empty($vals['name']) || empty($vals['email'])) fail('Nama dan email wajib diisi.');
        if (strlen((string)($data['password'] ?? '')) < 6) fail('Kata sandi minimal 6 karakter.');
        if (one('SELECT id FROM users WHERE email = ?', [$vals['email']])) fail('Email sudah terdaftar.');
        $vals['password_hash'] = password_hash((string)$data['password'], PASSWORD_DEFAULT);
        $vals['role'] = $vals['role'] ?? 'kasir';
        $id = insert_row('users', $vals);
        return public_user(one('SELECT * FROM users WHERE id = ?', [$id]));
    }
    $id = (int)($in['id'] ?? 0);
    if (!one('SELECT id FROM users WHERE id = ?', [$id])) fail('Pengguna tidak ditemukan.', 404);
    if ($op === 'update') {
        if ($id === $me['id'] && (($vals['role'] ?? 'admin') !== 'admin' || (isset($vals['active']) && !$vals['active']))) fail('Tidak dapat menurunkan / menonaktifkan akun admin Anda sendiri.');
        if (isset($vals['email']) && one('SELECT id FROM users WHERE email = ? AND id <> ?', [$vals['email'], $id])) fail('Email sudah dipakai.');
        if (!empty($data['password'])) {
            if (strlen((string)$data['password']) < 6) fail('Kata sandi minimal 6 karakter.');
            $vals['password_hash'] = password_hash((string)$data['password'], PASSWORD_DEFAULT);
        }
        update_row('users', $id, $vals);
        return public_user(one('SELECT * FROM users WHERE id = ?', [$id]));
    }
    if ($op === 'delete') {
        if ($id === $me['id']) fail('Tidak dapat menghapus akun Anda sendiri.');
        q('DELETE FROM users WHERE id = ?', [$id]);
        return ['ok' => true];
    }
    fail('Aksi tidak dikenal.');
}

// ---- absensi
function work_schedule(): array {
    $s = json_decode((string)setting('work_schedule', ''), true) ?: [];
    return ['startTime' => $s['startTime'] ?? '08:00', 'toleranceMinutes' => (int)($s['toleranceMinutes'] ?? 15)];
}
function network_check(): array {
    $n = json_decode((string)setting('store_network', ''), true) ?: [];
    $allowed = array_values(array_filter(array_map('trim', preg_split('/[\s,;]+/', (string)($n['ips'] ?? '')))));
    $ip = client_ip();
    $ok = !$allowed;
    foreach ($allowed as $a) if ($a !== '' && strpos($ip, rtrim($a, '*')) === 0) $ok = true;
    return ['ok' => $ok, 'ip' => $ip, 'restricted' => (bool)$allowed, 'wifiName' => $n['wifiName'] ?? ''];
}
function attendance_status(): array {
    $u = need_auth();
    $today = all('SELECT * FROM attendance WHERE user_id = ? AND created >= ? ORDER BY created', [$u['id'], date('Y-m-d') . ' 00:00:00']);
    $recent = all('SELECT * FROM attendance WHERE user_id = ? ORDER BY created DESC LIMIT 20', [$u['id']]);
    return ['user' => $u, 'schedule' => work_schedule(), 'network' => network_check(), 'server_time' => now(),
        'today' => array_map(fn($r) => cast_row('attendance', $r), $today),
        'recent' => array_map(fn($r) => cast_row('attendance', $r), $recent)];
}
function attendance_check(array $in): array {
    $u = need_auth();
    $type = ($in['type'] ?? 'in') === 'out' ? 'out' : 'in';
    $net = network_check();
    if (!$net['ok']) fail('Absen hanya bisa dilakukan saat terhubung ke WiFi toko' . ($net['wifiName'] ? ' (' . $net['wifiName'] . ')' : '') . '. IP Anda: ' . $net['ip'], 403);
    $today = all('SELECT type FROM attendance WHERE user_id = ? AND created >= ? ORDER BY created', [$u['id'], date('Y-m-d') . ' 00:00:00']);
    $hasIn = (bool)array_filter($today, fn($r) => $r['type'] === 'in');
    $hasOut = (bool)array_filter($today, fn($r) => $r['type'] === 'out');
    if ($type === 'in' && $hasIn) fail('Anda sudah absen datang hari ini.');
    if ($type === 'out' && !$hasIn) fail('Anda belum absen datang hari ini.');
    if ($type === 'out' && $hasOut) fail('Anda sudah absen pulang hari ini.');
    $late = 0;
    if ($type === 'in') {
        $s = work_schedule();
        $sched = strtotime(date('Y-m-d') . ' ' . $s['startTime'] . ':00') + $s['toleranceMinutes'] * 60;
        $late = max(0, (int)ceil((time() - $sched) / 60));
    }
    $id = insert_row('attendance', [
        'user_id' => $u['id'], 'user_name' => $u['name'], 'type' => $type,
        'lat' => isset($in['lat']) && is_numeric($in['lat']) ? (float)$in['lat'] : null,
        'lng' => isset($in['lng']) && is_numeric($in['lng']) ? (float)$in['lng'] : null,
        'ip' => $net['ip'], 'is_late' => $late > 0 ? 1 : 0, 'late_minutes' => $late,
    ]);
    return get_row('attendance', $id);
}

// ---- cek stok
function stockcheck_submit(array $in): array {
    $u = check_perm('stockcheck');
    $items = [];
    foreach ((array)($in['items'] ?? []) as $it) {
        $p = one('SELECT * FROM products WHERE id = ?', [(int)($it['product_id'] ?? 0)]);
        if (!$p) continue;
        $actualStock = (int)($it['actual_stock'] ?? $p['stock']);
        $actualPrice = (float)($it['actual_price'] ?? $p['price']);
        $items[] = ['product_id' => (int)$p['id'], 'name' => $p['name'], 'barcode' => $p['barcode'], 'category' => $p['category'],
            'sys_stock' => (int)$p['stock'], 'sys_price' => (float)$p['price'], 'actual_stock' => $actualStock, 'actual_price' => $actualPrice,
            'changed' => $actualStock !== (int)$p['stock'] || abs($actualPrice - (float)$p['price']) > 0.001];
    }
    if (!$items) fail('Tidak ada barang yang dikirim.');
    $changed = array_values(array_filter($items, fn($i) => $i['changed']));
    $matched = array_values(array_filter($items, fn($i) => !$i['changed']));
    $out = [];
    if ($matched) $out[] = insert_row('stock_checks', ['petugas_id' => $u['id'], 'petugas_name' => $u['name'], 'items' => json_encode($matched, JSON_UNESCAPED_UNICODE), 'status' => 'approved', 'note' => 'Cocok — otomatis disetujui', 'reviewed_name' => 'Sistem']);
    if ($changed) $out[] = insert_row('stock_checks', ['petugas_id' => $u['id'], 'petugas_name' => $u['name'], 'items' => json_encode($changed, JSON_UNESCAPED_UNICODE), 'status' => 'pending', 'note' => mb_substr((string)($in['note'] ?? ''), 0, 1000)]);
    return ['matched' => count($matched), 'pending' => count($changed), 'ids' => $out];
}
function stockcheck_review(array $in): array {
    $u = need_admin();
    $sc = get_row('stock_checks', (int)($in['id'] ?? 0));
    if ($sc['status'] !== 'pending') fail('Pengajuan ini sudah diproses.');
    $approve = !empty($in['approve']);
    db()->beginTransaction();
    if ($approve) {
        foreach ($sc['items'] as $it) {
            $p = one('SELECT * FROM products WHERE id = ?', [(int)$it['product_id']]);
            if (!$p) continue;
            $vals = ['price' => (float)$it['actual_price'], 'stock' => (int)$it['actual_stock']];
            update_row('products', (int)$p['id'], $vals);
            if ((int)$p['stock'] !== (int)$it['actual_stock']) {
                $d = (int)$it['actual_stock'] - (int)$p['stock'];
                log_movement($p, $d > 0 ? 'in' : 'out', abs($d), (int)$p['stock'], (int)$it['actual_stock'], 'Cek stok oleh ' . $sc['petugas_name']);
            }
        }
    }
    update_row('stock_checks', $sc['id'], ['status' => $approve ? 'approved' : 'rejected', 'reviewed_by' => $u['id'], 'reviewed_name' => $u['name'], 'note' => mb_substr(trim((string)($in['note'] ?? $sc['note'])), 0, 1000)]);
    db()->commit();
    return get_row('stock_checks', $sc['id']);
}

// ---------------------------------------------------------------- router
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Gunakan POST.', 405);
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'SofeeyaPOS') fail('Permintaan tidak valid.', 403); // perlindungan CSRF
    $raw = file_get_contents('php://input');
    $in = $raw ? json_decode($raw, true) : [];
    if (!is_array($in)) fail('Format data tidak valid.');
    $a = (string)($_GET['a'] ?? '');

    switch ($a) {
        case 'login': {
            $_SESSION['fails'] = $_SESSION['fails'] ?? 0;
            if ($_SESSION['fails'] >= 8) { sleep(2); }
            $r = one('SELECT * FROM users WHERE email = ?', [strtolower(trim((string)($in['email'] ?? '')))]);
            if (!$r || !password_verify((string)($in['password'] ?? ''), $r['password_hash'])) {
                $_SESSION['fails']++; usleep(400000); fail('Email atau kata sandi salah.', 401);
            }
            if (!(int)$r['active']) fail('Akun dinonaktifkan. Hubungi admin.', 403);
            session_regenerate_id(true);
            $_SESSION['uid'] = (int)$r['id']; $_SESSION['fails'] = 0;
            $out = ['user' => public_user($r), 'settings' => public_settings()];
            break;
        }
        case 'logout': $_SESSION = []; session_destroy(); $out = ['ok' => true]; break;
        case 'boot': $out = ['user' => current_user(), 'settings' => public_settings(), 'demo' => $DEMO]; break;
        case 'change_password': {
            $u = need_auth();
            $r = one('SELECT * FROM users WHERE id = ?', [$u['id']]);
            if (!password_verify((string)($in['old'] ?? ''), $r['password_hash'])) fail('Kata sandi lama salah.');
            if (strlen((string)($in['new'] ?? '')) < 6) fail('Kata sandi baru minimal 6 karakter.');
            update_row('users', $u['id'], ['password_hash' => password_hash((string)$in['new'], PASSWORD_DEFAULT)]);
            $out = ['ok' => true]; break;
        }
        case 'update_profile': {
            $u = need_auth();
            $vals = [];
            foreach (['name', 'bank_name', 'bank_account'] as $f) if (isset($in[$f])) $vals[$f] = mb_substr(trim((string)$in[$f]), 0, 200);
            if (isset($vals['name']) && $vals['name'] === '') fail('Nama wajib diisi.');
            update_row('users', $u['id'], $vals);
            $out = public_user(one('SELECT * FROM users WHERE id = ?', [$u['id']])); break;
        }
        case 'verify_pin': {
            need_auth();
            $out = ['ok' => is_admin() || hash_equals((string)setting('supervisor_pin', '1234'), (string)($in['pin'] ?? ''))];
            break;
        }
        case 'settings_all': {
            need_admin(); $out = []; foreach (all('SELECT `key`, value FROM settings') as $r) $out[$r['key']] = $r['value']; $out['_my_ip'] = client_ip();
            unset($out['biteship_api_key']);
            break;
        }
        case 'settings_save': {
            need_admin();
            $allowed = ['store_name', 'supervisor_pin', 'points_per_amount', 'member_discount_percent', 'member_offer_threshold', 'receipt_address', 'receipt_phone', 'receipt_footer1', 'receipt_footer2', 'work_schedule', 'store_network', 'fee_presets', 'qris_payload', 'sales_channels', 'size_sets', 'return_days'];
            if (isset($in['values']['qris_payload'])) { $qp = trim((string)$in['values']['qris_payload']); if ($qp !== '' && (strpos($qp, '000201') !== 0 || strlen($qp) > 1000)) fail('Kode QRIS tidak valid.'); $in['values']['qris_payload'] = $qp; }

            foreach ((array)($in['values'] ?? []) as $k => $v) if (in_array($k, $allowed, true)) set_setting($k, $v);
            $out = public_settings(); break;
        }
        case 'list':   $out = crud_list($in); break;
        case 'get':    { $d = table_def((string)($in['table'] ?? '')); check_perm($d['read']); $out = get_row((string)$in['table'], (int)($in['id'] ?? 0)); break; }
        case 'create': $out = crud_create($in); break;
        case 'update': $out = crud_update($in); break;
        case 'delete': $out = crud_delete($in); break;
        case 'checkout': $out = checkout($in); break;
        case 'tx_delete': $out = tx_delete($in); break;
        case 'stock_adjust': $out = stock_adjust($in); break;
        case 'variants_save': $out = variants_save($in); break;
        case 'model_update': $out = model_update($in); break;
        case 'stock_set_bulk': $out = stock_set_bulk($in); break;
        case 'product_image': $out = product_image($in); break;
        case 'product_import': $out = product_import($in); break;
        case 'member_import': $out = member_import($in); break;
        case 'users_list': $out = users_action('list', $in); break;
        case 'users_create': $out = users_action('create', $in); break;
        case 'users_update': $out = users_action('update', $in); break;
        case 'users_delete': $out = users_action('delete', $in); break;
        case 'attendance_status': $out = attendance_status(); break;
        case 'attendance_check': $out = attendance_check($in); break;
        case 'stockcheck_submit': $out = stockcheck_submit($in); break;
        case 'stockcheck_review': $out = stockcheck_review($in); break;
        case 'broadcast_refresh': { $u = need_admin(); $out = ['id' => insert_row('signals', ['triggered_by' => $u['id'], 'target' => 'all'])]; break; }
        case 'ping': {
            $u = need_auth();
            $sig = one('SELECT MAX(id) AS m FROM signals');
            $out = ['signal' => (int)($sig['m'] ?? 0), 'time' => now()];
            if ($u['role'] === 'admin') {
                $since = (int)($in['since_tx'] ?? 0);
                $out['last_tx'] = (int)(one('SELECT MAX(id) AS m FROM transactions')['m'] ?? 0);
                $out['new_tx'] = $since ? array_map(fn($r) => cast_row('transactions', $r), all('SELECT * FROM transactions WHERE id > ? ORDER BY id DESC LIMIT 10', [$since])) : [];
                $out['pending_checks'] = (int)(one("SELECT COUNT(*) AS c FROM stock_checks WHERE status = 'pending'")['c'] ?? 0);
            }
            break;
        }
        default: fail('Aksi tidak dikenal.', 404);
    }
    echo json_encode(['ok' => true, 'data' => $out], JSON_UNESCAPED_UNICODE);
} catch (ApiError $e) {
    if (db_in_tx()) db()->rollBack();
    http_response_code($e->status);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (db_in_tx()) db()->rollBack();
    http_response_code(500);
    error_log('[SofeeyaPOS] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode(['ok' => false, 'error' => !empty($CONFIG['debug']) ? $e->getMessage() : 'Terjadi kesalahan server.'], JSON_UNESCAPED_UNICODE);
}
function db_in_tx(): bool { try { return db()->inTransaction(); } catch (Throwable $e) { return false; } }
