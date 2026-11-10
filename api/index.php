<?php
/**
 * Sofeeya Store POS — REST API (PHP 7.4+ / 8.x, MySQL / MariaDB)
 * Semua request: POST api/index.php?a=<aksi>   body JSON
 */
declare(strict_types=1);

$CONFIG = require __DIR__ . '/config.php';
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
    return $pdo;
}
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
    'products' => ['fields' => ['name' => 's', 'barcode' => 's', 'category' => 's', 'cost' => 'n', 'price' => 'n', 'discount' => 'n', 'stock' => 'i', 'commission' => 'n', 'image' => 's', 'stock_in_date' => 'd'],
        'required' => ['name'], 'search' => ['name', 'barcode', 'category'], 'read' => 'auth', 'write' => 'admin', 'order' => 'name'],
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
    'transactions' => ['fields' => ['invoice' => 's', 'items' => 'j', 'subtotal' => 'n', 'discount' => 'n', 'fee' => 'n', 'fee_note' => 's', 'total' => 'n', 'payment' => 'n', 'change' => 'n', 'profit' => 'n', 'promo_name' => 's', 'item_count' => 'i', 'member_id' => 'i', 'member_name' => 's', 'points_earned' => 'i', 'points_used' => 'i', 'member_points_after' => 'i', 'cashier' => 's', 'cashier_id' => 'i', 'payment_method' => 's', 'sales_name' => 's', 'sales_code' => 's', 'commission' => 'n', 'note' => 's'],
        'updatable' => ['sales_name', 'sales_code', 'commission', 'note'],
        'search' => ['invoice', 'member_name', 'cashier', 'sales_name'], 'read' => 'auth', 'write' => 'admin', 'create' => 'none', 'delete' => 'none', 'order' => '-created'],
    'stock_movements' => ['fields' => ['product_id' => 'i', 'product_name' => 's', 'barcode' => 's', 'type' => 's', 'quantity' => 'i', 'stock_before' => 'i', 'stock_after' => 'i', 'cashier' => 's', 'invoice' => 's', 'note' => 's'],
        'search' => ['product_name', 'barcode', 'invoice', 'note'], 'read' => 'admin', 'write' => 'none', 'delete' => 'admin', 'order' => '-created'],
    'attendance' => ['fields' => ['user_id' => 'i', 'user_name' => 's', 'type' => 's', 'lat' => 'n', 'lng' => 'n', 'ip' => 's', 'is_late' => 'b', 'late_minutes' => 'i'],
        'search' => ['user_name'], 'read' => 'admin', 'write' => 'none', 'delete' => 'admin', 'order' => '-created'],
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
        if ((string)($in['pin'] ?? '') === '' || !hash_equals((string)setting('supervisor_pin', '1234'), (string)$in['pin'])) fail('Kode supervisor salah.', 403);
    } else {
        check_perm($perm);
    }
    $vals = pick_fields($t, $data);
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
    if ($t === 'links' && isset($vals['url']) && !preg_match('~^https?://~i', $vals['url'])) $vals['url'] = 'https://' . $vals['url'];
}

// ---------------------------------------------------------------- business actions
function public_settings(): array {
    $keys = ['store_name', 'points_per_amount', 'member_discount_percent', 'member_offer_threshold', 'receipt_address', 'receipt_phone', 'receipt_footer1', 'receipt_footer2', 'work_schedule'];
    $out = [];
    foreach (all('SELECT `key`, value FROM settings') as $r) if (in_array($r['key'], $keys, true)) $out[$r['key']] = $r['value'];
    $out['store_name'] = $out['store_name'] ?? 'Sofeeya Store';
    return $out;
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
    if (!$cart) fail('Keranjang kosong.');
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
                'qty' => $qty, 'price' => $price, 'original_price' => (float)$p['price'], 'cost' => $cost,
                'commission' => (float)$p['commission'], 'discount' => (float)($c['discount'] ?? 0),
                'itemDiscount' => max(0, (float)($c['itemDiscount'] ?? 0)), 'promoName' => (string)($c['promoName'] ?? ''),
            ];
        }
        if ($shortages) fail('Stok tidak cukup: ' . implode(', ', $shortages));

        $discount = min($subtotal, max(0, (float)($in['discount'] ?? 0)));
        $fee = max(0, (float)($in['fee'] ?? 0));
        $total = max(0, $subtotal - $discount + $fee);
        $payment = (float)($in['payment'] ?? 0);
        $method = in_array($in['payment_method'] ?? 'cash', ['cash', 'qris', 'transfer'], true) ? $in['payment_method'] : 'cash';
        if ($method !== 'cash') $payment = max($payment, $total);
        if ($payment + 0.001 < $total) fail('Pembayaran kurang dari total.');

        // member & poin
        $member = null; $earned = 0; $used = 0; $after = 0;
        if (!empty($in['member_id'])) {
            $member = one('SELECT * FROM members WHERE id = ?', [(int)$in['member_id']]);
            if (!$member) fail('Member tidak ditemukan.');
            $rate = max(1, (float)setting('points_per_amount', '1000'));
            $earned = (int)floor($total / $rate);
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
            'total' => $total, 'payment' => $payment, 'change' => max(0, $payment - $total), 'profit' => $gross - $discount + 0,
            'promo_name' => mb_substr((string)($in['promo_name'] ?? ''), 0, 500), 'item_count' => $count,
            'member_id' => $member ? (int)$member['id'] : null, 'member_name' => $member['name'] ?? '',
            'points_earned' => $earned, 'points_used' => $used, 'member_points_after' => $member ? $after : 0,
            'cashier' => $u['name'], 'cashier_id' => $u['id'], 'payment_method' => $method,
            'sales_name' => $sales['name'] ?? '', 'sales_code' => $sales['code'] ?? '', 'commission' => $sales ? $commissionBase : 0,
            'note' => mb_substr(trim((string)($in['note'] ?? '')), 0, 1000),
        ]);
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
    return get_row('transactions', $id);
}

function tx_delete(array $in): array {
    need_admin();
    $tx = get_row('transactions', (int)($in['id'] ?? 0));
    $reason = trim((string)($in['reason'] ?? ''));
    db()->beginTransaction();
    try {
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
        $existing = null;
        if ($barcode !== '') $existing = one('SELECT * FROM products WHERE barcode = ?', [$barcode]);
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
            $id = insert_row('products', $vals);
            if (($vals['stock'] ?? 0) > 0) log_movement(['id' => $id, 'name' => $name, 'barcode' => $barcode], 'in', (int)$vals['stock'], 0, (int)$vals['stock'], 'Impor file');
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
        case 'boot': $out = ['user' => current_user(), 'settings' => public_settings()]; break;
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
        case 'settings_all': need_admin(); $out = []; foreach (all('SELECT `key`, value FROM settings') as $r) $out[$r['key']] = $r['value']; $out['_my_ip'] = client_ip(); break;
        case 'settings_save': {
            need_admin();
            $allowed = ['store_name', 'supervisor_pin', 'points_per_amount', 'member_discount_percent', 'member_offer_threshold', 'receipt_address', 'receipt_phone', 'receipt_footer1', 'receipt_footer2', 'work_schedule', 'store_network'];
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
