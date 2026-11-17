<?php
/**
 * Sofeeya Store — website katalog publik (sofeeyastore.id/katalog)
 * Data langsung dari database aplikasi kasir: harga, harga khusus, promo otomatis, stok, foto.
 * Halaman dirender di server (HTML lengkap) supaya mudah dibaca Google.
 */
declare(strict_types=1);
define('POS_LIB', true);
require __DIR__ . '/../api/index.php';

header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function rp($n): string { return 'Rp' . number_format((float)$n, 0, ',', '.'); }
function setting_s(string $k, string $d = ''): string { $v = trim((string)setting($k, '')); return $v !== '' ? $v : $d; }
function wa_num(string $p): string { $d = preg_replace('~\D+~', '', $p); if ($d === '') return ''; if ($d[0] === '0') $d = '62' . substr($d, 1); elseif (substr($d, 0, 2) !== '62' && $d[0] === '8') $d = '62' . $d; return $d; }
function wa_link(string $num, string $text): string { return 'https://api.whatsapp.com/send?phone=' . rawurlencode($num) . '&text=' . rawurlencode($text); }

// ---------------------------------------------------------------- data toko
try { db(); } catch (Throwable $e) { http_response_code(503); header('Content-Type: text/html; charset=utf-8'); echo '<!doctype html><meta charset="utf-8"><title>Sedang perbaikan</title><p style="font-family:sans-serif;padding:40px">Katalog sedang diperbarui. Silakan coba beberapa menit lagi.</p>'; exit; }

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$host = preg_replace('~[^a-z0-9.\-:]~i', '', (string)($_SERVER['HTTP_HOST'] ?? 'sofeeyastore.id'));
$ROOT = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/katalog/index.php'))), '/'); // '' bila di akar domain
$ORIGIN = ($https || !preg_match('~^(localhost|127\.)~', $host) ? 'https://' : 'http://') . $host;
$BASE = $ROOT . '/katalog/';
$ABS = $ORIGIN . $BASE;

$S = [
    'name'      => setting_s('store_name', 'Sofeeya Store'),
    'tagline'   => setting_s('web_tagline', 'Kemeja kerja, blouse, gamis, dan hijab untuk wanita aktif. Pilih langsung di toko atau pesan lewat WhatsApp.'),
    'about'     => setting_s('web_about', ''),
    'address'   => setting_s('web_address', setting_s('receipt_address', 'Andonohu, Kendari')),
    'city'      => setting_s('web_city', 'Kendari'),
    'maps'      => setting_s('web_maps', ''),
    'wa'        => wa_num(setting_s('web_wa', setting_s('receipt_phone', ''))),
    'ig'        => ltrim(setting_s('web_instagram', 'sofeeyastore.andonohu'), '@'),
    'open'      => setting_s('web_open', '09:00'),
    'close'     => setting_s('web_close', '21:00'),
    'days'      => setting_s('web_days', '1,2,3,4,5,6,7'),
    'faq'       => setting_s('web_faq', ''),
    'testi'     => setting_s('web_testimonials', ''),
    'ppa'       => max(1, (int)setting_s('points_per_amount', '1000')),
    'storepic'  => setting_s('web_store_photo', ''),
];
$DAYS = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];
$SCHEMA_DAYS = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];
$openDays = array_values(array_filter(array_map('intval', explode(',', $S['days'])), fn($d) => $d >= 1 && $d <= 7));
if (!$openDays) $openDays = [1, 2, 3, 4, 5, 6, 7];
function days_text(array $d, array $N): string {
    sort($d);
    if (count($d) === 7) return 'Setiap hari';
    $runs = []; $start = $prev = null;
    foreach ($d as $x) { if ($start === null) { $start = $prev = $x; continue; } if ($x === $prev + 1) { $prev = $x; continue; } $runs[] = [$start, $prev]; $start = $prev = $x; }
    if ($start !== null) $runs[] = [$start, $prev];
    return implode(', ', array_map(fn($r) => $r[0] === $r[1] ? $N[$r[0]] : ($r[1] === $r[0] + 1 ? $N[$r[0]] . ', ' . $N[$r[1]] : $N[$r[0]] . '–' . $N[$r[1]]), $runs));
}
$hoursText = days_text($openDays, $DAYS) . ', ' . $S['open'] . '–' . $S['close'] . ' WITA';
$mapsLink = $S['maps'] !== '' && preg_match('~^https://~', $S['maps']) ? $S['maps'] : 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($S['name'] . ' ' . $S['address']);

// ---------------------------------------------------------------- promo (sama dengan aturan di kasir)
$today = date('Y-m-d');
$promos = array_map(fn($r) => cast_row('promos', $r), all('SELECT * FROM promos WHERE active = 1'));
$promos = array_values(array_filter($promos, fn($p) => (!$p['start_date'] || $p['start_date'] <= $today) && (!$p['end_date'] || $p['end_date'] >= $today)));
$isPkg = fn($p) => in_array($p['type'], ['package', 'bogo'], true);
$autoPromos = array_values(array_filter($promos, fn($p) => $isPkg($p) || $p['type'] === 'price' || trim((string)$p['code']) === ''));
function promo_hits(array $p, array $prod): bool {
    $cats = (array)$p['categories']; $pids = array_map('strval', (array)$p['product_ids']); $price = (float)$prod['price'];
    if ($cats && !in_array($prod['category'], $cats, true)) return false;
    if ($pids && !in_array((string)$prod['id'], $pids, true)) return false;
    if ((float)$p['min_price'] > 0 && $price < (float)$p['min_price']) return false;
    if ((float)$p['max_price'] > 0 && $price > (float)$p['max_price']) return false;
    return true;
}
function promo_desc(array $p): string {
    if ($p['type'] === 'bogo') return 'Beli 1 gratis 1';
    if ($p['type'] === 'package') return 'Beli ' . max(1, (int)$p['buy_qty']) . ' gratis ' . max(1, (int)$p['free_qty']);
    if ($p['type'] === 'percent') return 'Diskon ' . rtrim(rtrim(number_format((float)$p['value'], 1, ',', ''), '0'), ',') . '%';
    if ($p['type'] === 'price') return 'Harga jadi ' . rp($p['value']);
    return 'Potongan ' . rp($p['value']) . ' / pcs';
}
// harga 1 pcs setelah harga khusus & promo otomatis terbaik (promo tanpa minimal belanja)
function unit_price(array $prod, array $autoPromos): array {
    $price = (float)$prod['price']; $eff = $price - (float)($prod['discount'] ?? 0);
    $best = 0.0; $bestP = null; $badge = null;
    foreach ($autoPromos as $p) {
        if (!promo_hits($p, $prod)) continue;
        if (in_array($p['type'], ['package', 'bogo'], true)) { $badge = $badge ?? $p; continue; }
        if ((float)$p['min_purchase'] > 0) continue;
        $off = $p['type'] === 'price' ? max(0, $eff - (float)$p['value']) : ($p['type'] === 'percent' ? round($price * (float)$p['value'] / 100) : min((float)$p['value'], $price));
        if ($off > $best) { $best = $off; $bestP = $p; }
    }
    return ['normal' => $price, 'final' => max(0, $eff - $best), 'promo' => $bestP, 'special' => $eff < $price, 'badge' => $badge];
}

// ---------------------------------------------------------------- katalog
$rows = array_map(fn($r) => cast_row('web_catalog', $r), all('SELECT * FROM web_catalog WHERE visible = 1 ORDER BY sort, title'));
$products = array_map(fn($r) => cast_row('products', $r), all('SELECT * FROM products WHERE stock > 0'));
$byKey = [];
foreach ($products as $p) $byKey[cat_key($p)][] = $p;
$SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'ALL SIZE', 'ALLSIZE'];
$sizeSort = function (array $a) use ($SIZE_ORDER) { usort($a, function ($x, $y) use ($SIZE_ORDER) { $i = array_search(strtoupper($x), $SIZE_ORDER, true); $j = array_search(strtoupper($y), $SIZE_ORDER, true); if ($i !== false && $j !== false) return $i <=> $j; if (is_numeric($x) && is_numeric($y)) return $x <=> $y; return strcmp((string)$x, (string)$y); }); return $a; };
$items = [];
foreach ($rows as $r) {
    $vars = $byKey[$r['model_key']] ?? [];
    if (!$vars) continue; // stok habis: tidak tampil
    $vv = []; $min = PHP_INT_MAX; $max = 0; $minNormal = PHP_INT_MAX; $promo = null; $badge = null; $stock = 0;
    foreach ($vars as $v) {
        $u = unit_price($v, $autoPromos);
        $vv[] = ['id' => $v['id'], 'color' => trim((string)$v['color']), 'size' => trim((string)$v['size']), 'price' => $u['final'], 'normal' => $u['normal'], 'stock' => (int)$v['stock']];
        $min = min($min, $u['final']); $max = max($max, $u['final']); $minNormal = min($minNormal, $u['normal']);
        $promo = $promo ?? $u['promo']; $badge = $badge ?? $u['badge']; $stock += (int)$v['stock'];
    }
    $photos = array_values(array_filter((array)$r['photos'], fn($f) => is_string($f) && is_file(dirname(__DIR__) . '/' . $f)));
    $items[] = $r + ['vars' => $vv, 'min' => $min, 'max' => $max, 'minNormal' => $minNormal, 'promo' => $promo, 'badge' => $badge, 'stock' => $stock,
        'category' => (string)$vars[0]['category'], 'colors' => array_values(array_unique(array_filter(array_column($vv, 'color')))),
        'sizes' => $sizeSort(array_values(array_unique(array_filter(array_column($vv, 'size'))))), 'pics' => $photos];
}
function img_url(string $f): string { global $ROOT; return $ROOT . '/' . implode('/', array_map('rawurlencode', explode('/', $f))); }
function img_tag(string $f, string $alt, string $attrs = '', bool $lazy = true): string {
    $wh = @getimagesize(dirname(__DIR__) . '/' . $f);
    return '<img src="' . h(img_url($f)) . '" alt="' . h($alt) . '"' . ($wh ? ' width="' . $wh[0] . '" height="' . $wh[1] . '"' : '') . ($lazy ? ' loading="lazy"' : ' fetchpriority="high"') . ' decoding="async" ' . $attrs . '>';
}
function price_html(array $it): string {
    $s = $it['min'] === $it['max'] ? rp($it['min']) : rp($it['min']) . ' – ' . rp($it['max']);
    $old = $it['minNormal'] > $it['min'] ? '<s>' . rp($it['minNormal']) . '</s>' : '';
    return $old . '<b>' . ($it['min'] !== $it['max'] ? 'mulai ' . rp($it['min']) : $s) . '</b>';
}
function initials(string $t): string { $w = preg_split('~\s+~', trim($t)); return strtoupper(mb_substr($w[0] ?? '?', 0, 1) . mb_substr($w[1] ?? '', 0, 1)); }

// ---------------------------------------------------------------- routing: /katalog/, /katalog/p/<slug>, /katalog/sitemap.xml
$path = (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$rel = substr($path, strlen($BASE)) ?: '';
if (isset($_GET['sitemap']) || $rel === 'sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
    $last = max(array_merge([date('Y-m-d')], array_map(fn($i) => substr((string)$i['updated'], 0, 10), $items)));
    echo '<url><loc>' . h($ABS) . '</loc><lastmod>' . h($last) . '</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>' . "\n";
    foreach ($items as $it) {
        echo '<url><loc>' . h($ABS . 'p/' . rawurlencode($it['slug'])) . '</loc><lastmod>' . h(substr((string)$it['updated'], 0, 10) ?: date('Y-m-d')) . '</lastmod><changefreq>weekly</changefreq>';
        foreach (array_slice($it['pics'], 0, 5) as $f) echo '<image:image><image:loc>' . h($ORIGIN . img_url($f)) . '</image:loc></image:image>';
        echo '</url>' . "\n";
    }
    echo '</urlset>';
    exit;
}
$slug = isset($_GET['p']) ? (string)$_GET['p'] : (preg_match('~^p/([a-z0-9\-]+)/?$~', $rel, $m) ? $m[1] : '');
$item = null;
if ($slug !== '') { foreach ($items as $it) if ($it['slug'] === $slug) { $item = $it; break; } }
$notFound = ($slug !== '' && !$item) || ($slug === '' && $rel !== '' && $rel !== 'index.php');
if ($notFound) http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');

$cats = array_values(array_unique(array_filter(array_column($items, 'category'))));
sort($cats);
$waHello = $S['wa'] ? wa_link($S['wa'], 'Halo ' . $S['name'] . ', saya mau tanya koleksi yang tersedia.') : '';
$catList = $cats ? implode(', ', array_slice(array_map('mb_strtolower', $cats), 0, 5)) : 'kemeja, blouse, gamis, hijab';

// FAQ: dari Pengaturan (baris "Tanya | Jawab"), atau bawaan dari data toko
$faq = [];
foreach (preg_split('~\r?\n~', $S['faq']) as $line) { $pp = array_map('trim', explode('|', $line, 2)); if (count($pp) === 2 && $pp[0] !== '' && $pp[1] !== '') $faq[] = $pp; }
if (!$faq) $faq = [
    ['Di mana alamat ' . $S['name'] . '?', $S['name'] . ' ada di ' . $S['address'] . '. Buka Google Maps dari tombol "Petunjuk arah" di halaman ini.'],
    ['Jam berapa ' . $S['name'] . ' buka?', $hoursText . '.'],
    ['Bagaimana cara memesan dari katalog?', 'Pilih barang, warna, dan ukuran, lalu tekan "Pesan via WhatsApp". Pesan berisi nama barang dan harga terkirim otomatis ke admin toko.'],
    ['Bisa kirim ke luar Kendari?', 'Bisa. Pesanan bisa diambil di toko, diantar dalam kota Kendari, atau dikirim ke luar kota lewat ekspedisi. Ongkir diinfokan lewat WhatsApp.'],
    ['Apakah harga di website sama dengan di toko?', 'Ya. Harga dan promo di halaman ini terhubung langsung dengan kasir toko, jadi selalu sama dengan harga di toko.'],
];

// testimoni asli dari Pengaturan (baris "Nama | Ulasan | Sumber"); tidak tampil bila kosong
$testi = [];
foreach (preg_split('~\r?\n~', $S['testi']) as $line) { $pp = array_map('trim', explode('|', $line)); if (count($pp) >= 2 && $pp[0] !== '' && $pp[1] !== '') $testi[] = ['name' => $pp[0], 'text' => $pp[1], 'src' => $pp[2] ?? '']; }

// tangkapan layar testimoni (diunggah admin) & postingan Instagram bertagar testimoni (diambil otomatis)
$shots = array_values(array_filter(testi_shots(), fn($f) => is_file(dirname(__DIR__) . '/' . $f)));
$igPosts = array_values(array_filter(json_decode((string)setting('web_ig_cache', '[]'), true) ?: [], fn($p) => is_array($p) && !empty($p['link'])));
$hasTesti = $testi || $shots || $igPosts;

// ---------------------------------------------------------------- meta & schema
if ($item) {
    $title = $item['title'] . ' – ' . ($item['min'] === $item['max'] ? rp($item['min']) : 'mulai ' . rp($item['min'])) . ' | ' . $S['name'] . ' ' . $S['city'];
    $descText = trim((string)$item['description']) !== '' ? (string)$item['description'] : $item['title'] . ($item['category'] ? ' (' . mb_strtolower($item['category']) . ' wanita)' : '') . ' di ' . $S['name'] . ', ' . $S['address'] . '.';
    $desc = mb_substr(preg_replace('~\s+~', ' ', $descText . ($item['colors'] ? ' Warna: ' . implode(', ', $item['colors']) . '.' : '') . ($item['sizes'] ? ' Ukuran: ' . implode(', ', $item['sizes']) . '.' : '') . ' Pesan via WhatsApp.'), 0, 158);
    $canon = $ABS . 'p/' . rawurlencode($item['slug']);
    $ogImg = $item['pics'] ? $ORIGIN . img_url($item['pics'][0]) : '';
} else {
    $title = $notFound ? 'Halaman tidak ditemukan | ' . $S['name'] : $S['name'] . ' – Toko Baju Wanita di ' . $S['city'] . ' | Katalog & Harga Terbaru';
    $desc = mb_substr('Toko baju wanita di ' . $S['address'] . ': ' . $catList . '. Lihat katalog & harga terbaru, promo hari ini, lalu pesan via WhatsApp atau datang ke toko. ' . $hoursText . '.', 0, 158);
    $canon = $ABS;
    $ogImg = '';
    if ($S['storepic'] !== '' && is_file(dirname(__DIR__) . '/' . $S['storepic'])) $ogImg = $ORIGIN . img_url($S['storepic']);
    else foreach ($items as $it) if ($it['pics']) { $ogImg = $ORIGIN . img_url($it['pics'][0]); break; }
}
$store = ['@type' => 'ClothingStore', '@id' => $ABS . '#toko', 'name' => $S['name'], 'url' => $ABS, 'description' => $S['tagline'],
    'address' => ['@type' => 'PostalAddress', 'streetAddress' => $S['address'], 'addressLocality' => $S['city'], 'addressRegion' => 'Sulawesi Tenggara', 'addressCountry' => 'ID'],
    'openingHoursSpecification' => [['@type' => 'OpeningHoursSpecification', 'dayOfWeek' => array_map(fn($d) => $SCHEMA_DAYS[$d], $openDays), 'opens' => $S['open'], 'closes' => $S['close']]],
    'priceRange' => $items ? rp(min(array_column($items, 'min'))) . ' – ' . rp(max(array_column($items, 'max'))) : 'Rp',
    'currenciesAccepted' => 'IDR'];
if ($S['wa']) $store['telephone'] = '+' . $S['wa'];
if ($S['ig']) $store['sameAs'] = ['https://www.instagram.com/' . $S['ig'] . '/'];
$store['hasMap'] = $mapsLink;
if ($ogImg) $store['image'] = $ogImg;
$graph = [$store];
if ($item) {
    $offers = $item['min'] === $item['max']
        ? ['@type' => 'Offer', 'price' => (string)$item['min'], 'priceCurrency' => 'IDR', 'availability' => 'https://schema.org/InStock', 'url' => $canon, 'seller' => ['@id' => $ABS . '#toko'], 'itemCondition' => 'https://schema.org/NewCondition']
        : ['@type' => 'AggregateOffer', 'lowPrice' => (string)$item['min'], 'highPrice' => (string)$item['max'], 'priceCurrency' => 'IDR', 'offerCount' => count($item['vars']), 'availability' => 'https://schema.org/InStock', 'url' => $canon, 'seller' => ['@id' => $ABS . '#toko']];
    if ($item['promo'] && !empty($item['promo']['end_date'])) $offers['priceValidUntil'] = $item['promo']['end_date'];
    $prod = ['@type' => 'Product', 'name' => $item['title'], 'description' => $desc, 'brand' => ['@type' => 'Brand', 'name' => $S['name']], 'offers' => $offers, 'url' => $canon];
    if ($item['category']) $prod['category'] = $item['category'];
    if ($item['pics']) $prod['image'] = array_map(fn($f) => $ORIGIN . img_url($f), $item['pics']);
    if ($item['colors']) $prod['color'] = implode(', ', $item['colors']);
    if ($item['sizes']) $prod['size'] = implode(', ', $item['sizes']);
    $graph[] = $prod;
    $graph[] = ['@type' => 'BreadcrumbList', 'itemListElement' => [['@type' => 'ListItem', 'position' => 1, 'name' => 'Katalog', 'item' => $ABS], ['@type' => 'ListItem', 'position' => 2, 'name' => $item['title'], 'item' => $canon]]];
} elseif (!$notFound) {
    $graph[] = ['@type' => 'WebSite', 'name' => $S['name'], 'url' => $ABS, 'inLanguage' => 'id-ID'];
    $graph[] = ['@type' => 'FAQPage', 'mainEntity' => array_map(fn($q) => ['@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]]], $faq)];
    if ($items) $graph[] = ['@type' => 'ItemList', 'name' => 'Katalog ' . $S['name'], 'itemListElement' => array_map(fn($it, $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'url' => $ABS . 'p/' . rawurlencode($it['slug']), 'name' => $it['title']], $items, array_keys($items))];
}
$jsonld = json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);
$fontUrl = $ROOT . '/assets/fonts/lora-variable.ttf';
$open = in_array((int)date('N'), $openDays, true) && date('H:i') >= $S['open'] && date('H:i') < $S['close'];
?><!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($title) ?></title>
<meta name="description" content="<?= h($desc) ?>">
<?php if ($notFound): ?><meta name="robots" content="noindex"><?php else: ?><meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="<?= h($canon) ?>"><?php endif; ?>
<meta name="theme-color" content="#34172F">
<meta property="og:type" content="<?= $item ? 'product' : 'website' ?>">
<meta property="og:site_name" content="<?= h($S['name']) ?>">
<meta property="og:title" content="<?= h($title) ?>">
<meta property="og:description" content="<?= h($desc) ?>">
<meta property="og:url" content="<?= h($canon) ?>">
<meta property="og:locale" content="id_ID">
<?php if ($ogImg): ?><meta property="og:image" content="<?= h($ogImg) ?>"><meta name="twitter:card" content="summary_large_image"><?php endif; ?>
<link rel="icon" href="<?= h($ROOT) ?>/assets/img/favicon.png">
<link rel="preload" href="<?= h($fontUrl) ?>" as="font" type="font/ttf" crossorigin>
<script type="application/ld+json"><?= $jsonld ?></script>
<style>
@font-face{font-family:"Lora";src:url(<?= h($fontUrl) ?>) format("truetype");font-weight:400 700;font-display:swap}
/* Etalase toko: kanopi bergaris mentega, rel gantungan, label harga. Satu momen gerak: gantungan berayun sekali saat dibuka. */
:root{--susu:#FFF4EF;--persik:#FFE6DC;--kertas:#FFFDFB;--mentega:#FFE29A;--mentega-2:#FFF2C7;--terong:#34172F;--terong-2:#674A62;--terong-3:#7A5F75;--raspberry:#B8325A;--raspberry-2:#962247;--jambu:#F7B6C4;--daun:#CFEFE0;--daun-ink:#1D6447;--garis:#F0D3CC;--serif:"Lora",Georgia,"Times New Roman",serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--susu);color:var(--terong);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:inherit}img{max-width:100%;display:block}
.wrap{max-width:1160px;margin:0 auto;padding:0 20px}
:focus-visible{outline:3px solid var(--raspberry);outline-offset:3px;border-radius:6px}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:#fff;padding:8px 12px;z-index:99}
/* bar atas */
.top{position:sticky;top:0;z-index:20;background:var(--terong);color:#FCE9EE}
.top .wrap{display:flex;align-items:center;gap:18px;height:62px}
.brand{font:600 23px/1 var(--serif);text-decoration:none;color:#fff}.brand small{display:block;font:500 12px/1.5 var(--sans);color:#E3C5D2}
.nav{display:flex;gap:2px;margin-left:auto}.nav a{text-decoration:none;padding:8px 12px;border-radius:999px;font-weight:600;font-size:15px;color:#F3DCE5}.nav a:hover{background:rgba(255,255,255,.1);color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border-radius:999px;font:700 15px/1 var(--sans);text-decoration:none;border:2px solid var(--terong);background:transparent;color:var(--terong);cursor:pointer;transition:transform .12s,background .12s}
.btn:hover{transform:translateY(-1px)}.btn.wa{background:var(--raspberry);border-color:var(--raspberry);color:#fff}.btn.wa:hover{background:var(--raspberry-2);border-color:var(--raspberry-2)}
.btn svg{width:20px;height:20px;flex:none}
.top .btn{min-height:40px;padding:0 16px;font-size:14px;border-color:var(--mentega);background:var(--mentega);color:var(--terong)}
@media(max-width:760px){.nav{display:none}.top .btn{margin-left:auto}}
/* kanopi */
.awning{height:44px;background:repeating-linear-gradient(90deg,var(--mentega) 0 44px,var(--kertas) 44px 88px);-webkit-mask:radial-gradient(22px at 22px 22px,#000 98%,transparent) 0 0/44px 44px repeat-x,linear-gradient(#000 0 0) 0 0/100% 22px no-repeat;mask:radial-gradient(22px at 22px 22px,#000 98%,transparent) 0 0/44px 44px repeat-x,linear-gradient(#000 0 0) 0 0/100% 22px no-repeat;filter:drop-shadow(0 3px 0 rgba(52,23,47,.08))}
/* hero */
.hero{padding:30px 0 36px;overflow:hidden}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:36px;align-items:center}
.kicker{display:inline-flex;align-items:center;gap:10px;font-weight:600;color:var(--terong-2);font-size:15px;margin:0 0 16px}
.dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--daun-ink);box-shadow:0 0 0 4px var(--daun)}.dot.off{background:var(--terong-3);box-shadow:0 0 0 4px var(--persik)}
h1{font:600 clamp(38px,5.6vw,64px)/1.04 var(--serif);letter-spacing:-.022em;margin:0 0 18px;text-wrap:balance}
.lead{font-size:18px;color:var(--terong-2);max-width:32em;margin:0 0 26px}
.cta{display:flex;flex-wrap:wrap;gap:12px}
.facts{display:flex;flex-wrap:wrap;gap:8px 20px;margin:26px 0 0;padding:0;list-style:none;font-size:15px;color:var(--terong-2)}.facts b{color:var(--terong)}
/* rel gantungan */
.rail{position:relative;padding-top:26px}
.rail::before{content:"";position:absolute;left:-8px;right:-8px;top:26px;height:8px;border-radius:8px;background:linear-gradient(#B9A08E,#8C7262);box-shadow:0 2px 0 rgba(52,23,47,.12)}
.rack{display:flex;justify-content:space-around;gap:16px}
.hang{position:relative;flex:1 1 0;max-width:230px;text-decoration:none;transform-origin:50% 0;padding-top:4px}
.hang .hook{display:block;width:30px;height:34px;margin:-14px auto -2px;color:#8C7262}
.hang .body{display:block;position:relative;border-radius:46% 46% 18px 18px/30% 30% 18px 18px;overflow:hidden;aspect-ratio:3/4.1;background:var(--persik);box-shadow:0 22px 34px -24px rgba(52,23,47,.55)}
.hang:nth-child(2) .body{background:var(--daun)}.hang:nth-child(3) .body{background:var(--mentega-2)}.hang:nth-child(4) .body{background:var(--jambu)}
.hang img{width:100%;height:100%;object-fit:cover}
.hang .ph{position:absolute;inset:0;display:grid;place-items:center;font:600 40px var(--serif);color:var(--terong-3)}
.hang .tag{position:absolute;right:-8px;bottom:16%;transform:rotate(6deg)}
.tag{display:inline-block;background:var(--kertas);color:var(--terong);font:700 14px/1 var(--sans);padding:9px 11px 9px 20px;border-radius:4px 10px 10px 4px;box-shadow:0 3px 0 rgba(52,23,47,.14);position:relative;white-space:nowrap}
.tag::before{content:"";position:absolute;left:7px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--susu);box-shadow:inset 0 0 0 1.5px var(--garis)}
.tag s{display:block;font-weight:500;font-size:11px;color:var(--terong-3);margin-bottom:3px}
.hang:hover .body{box-shadow:0 26px 40px -22px rgba(52,23,47,.6)}
@media(prefers-reduced-motion:no-preference){.hang{animation:ayun 2.6s cubic-bezier(.3,.6,.4,1) both}.hang:nth-child(2){animation-delay:.12s}.hang:nth-child(3){animation-delay:.24s}
@keyframes ayun{0%{transform:rotate(7deg)}25%{transform:rotate(-4deg)}50%{transform:rotate(2deg)}75%{transform:rotate(-1deg)}100%{transform:rotate(0)}}}
@media(max-width:860px){.hero .wrap{grid-template-columns:1fr;gap:18px}.hero{padding-top:6px}.rail{order:-1}.rack{justify-content:flex-start;overflow-x:auto;padding:0 4px 10px;scrollbar-width:none}.hang{flex:0 0 42%}.hang .tag{right:4px}}
/* foto toko (bila belum ada foto barang) */
.storefront{position:relative;border-radius:46% 46% 24px 24px/30% 30% 24px 24px;overflow:hidden;aspect-ratio:4/4.4;background:var(--persik);box-shadow:0 22px 40px -26px rgba(52,23,47,.55)}
.storefront img{width:100%;height:100%;object-fit:cover}
.storefront .tag{position:absolute;left:18px;bottom:20px;transform:rotate(-4deg);font-size:15px}
@media(max-width:860px){.storefront{order:-1;aspect-ratio:4/3.4}}
/* penawaran */
.offer-sec{padding-top:8px}
.promos{display:flex;gap:14px;overflow-x:auto;padding:8px 2px 4px;scrollbar-width:none}
.promo{flex:none;display:flex;align-items:baseline;gap:10px;background:var(--mentega);border-radius:12px;padding:12px 16px}
.promo b{font:600 19px/1.2 var(--serif)}.promo span{font-size:14px;color:var(--terong-2)}
/* bagian */
section{padding:52px 0;scroll-margin-top:62px}
h2{font:600 clamp(28px,3.6vw,42px)/1.12 var(--serif);letter-spacing:-.015em;margin:0 0 8px}
.sub{color:var(--terong-2);margin:0 0 24px;max-width:40em}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 26px}
.chips button{font:600 14px/1 var(--sans);padding:11px 16px;border-radius:999px;border:1.5px solid var(--garis);background:var(--kertas);color:var(--terong-2);cursor:pointer}
.chips button[aria-pressed=true]{background:var(--terong);border-color:var(--terong);color:#fff}
/* katalog: foto berbentuk badan baju + label harga, tanpa kotak kartu */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:34px 22px}
.card{text-decoration:none;display:flex;flex-direction:column}
.card .pic{position:relative;border-radius:46% 46% 16px 16px/26% 26% 16px 16px;overflow:hidden;aspect-ratio:3/3.9;background:var(--persik)}
.card:nth-child(4n+2) .pic{background:var(--daun)}.card:nth-child(4n+3) .pic{background:var(--mentega-2)}.card:nth-child(4n) .pic{background:var(--jambu)}
.card .pic img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
.card:hover .pic img{transform:scale(1.03)}
.card .pic .ph{position:absolute;inset:0;display:grid;place-items:center;font:600 40px var(--serif);color:var(--terong-3)}
.card .tag{position:absolute;left:10px;bottom:12px;transform:rotate(-4deg)}
.sticker{position:absolute;top:14%;right:8px;background:var(--raspberry);color:#fff;font:700 12px/1.15 var(--sans);padding:8px 11px;border-radius:999px;white-space:nowrap;transform:rotate(6deg)}
.sticker.daun{background:var(--daun);color:var(--daun-ink)}
.card h3{font:600 18px/1.3 var(--serif);margin:14px 2px 2px}
.card .meta{font-size:13px;color:var(--terong-3);margin:0 2px 8px}
.swatch{display:flex;gap:5px;margin:0 2px}.swatch i{width:14px;height:14px;border-radius:50%;border:1px solid rgba(52,23,47,.18);background:var(--c,#ddd)}
@media(max-width:560px){.grid{grid-template-columns:1fr 1fr;gap:26px 14px}.card h3{font-size:16px;margin-top:10px}.card .tag{font-size:12.5px;left:6px;bottom:8px}.sticker{font-size:11px;right:4px}#cats{flex-wrap:nowrap;overflow-x:auto;margin-right:-20px;padding-right:20px;scrollbar-width:none}#cats button{flex:none}}
.empty{background:var(--kertas);border:2px dashed var(--garis);border-radius:22px;padding:34px;text-align:center;color:var(--terong-2)}
/* cara pesan: urutan nyata, jadi bernomor */
.steps{list-style:none;counter-reset:s;margin:24px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.steps li{counter-increment:s;position:relative;padding:22px 22px 22px 76px;background:var(--kertas);border-radius:22px}
.steps li::before{content:counter(s);position:absolute;left:20px;top:18px;width:42px;height:42px;border-radius:50%;background:var(--raspberry);color:#fff;font:600 22px/42px var(--serif);text-align:center}
.steps b{display:block;font:600 19px/1.3 var(--serif);margin-bottom:6px}.steps span{color:var(--terong-2);font-size:15px}
.why-sec{background:var(--mentega-2)}
.why{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:22px}
.why b{display:block;font:600 22px/1.25 var(--serif);margin-bottom:8px;padding-top:14px;border-top:3px solid var(--terong)}
.why p{margin:0;color:var(--terong-2)}
.testi{columns:4 230px;column-gap:18px;margin-top:22px}
.testi>*{break-inside:avoid;display:block;margin:0 0 18px;background:var(--kertas);border-radius:18px;overflow:hidden;text-decoration:none;box-shadow:0 3px 0 rgba(52,23,47,.08)}
.t-shot{padding:8px;background:var(--kertas)}.t-shot img{width:100%;height:auto;border-radius:12px}
.t-ig img{width:100%;height:auto;aspect-ratio:1/1;object-fit:cover}
.t-cap{display:block;padding:14px 16px 4px;font:400 16px/1.5 var(--serif)}
.t-src{display:block;padding:8px 16px 14px;font-size:13px;font-weight:700;color:var(--raspberry)}
.t-quote{padding:22px}.t-quote blockquote{margin:0 0 14px;font:400 18px/1.55 var(--serif)}
.t-quote figcaption{font-weight:700;font-size:15px}.t-quote figcaption span{display:block;font-weight:500;color:var(--terong-3);font-size:13px}
@media(max-width:560px){.testi{columns:2 150px;column-gap:12px}.testi>*{margin-bottom:12px}}
@media(max-width:860px){.steps,.why{grid-template-columns:1fr}}
/* info toko */
#lokasi{background:var(--persik)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:stretch}
.box{background:var(--kertas);border-radius:22px;padding:26px}
.box h3{font:600 22px var(--serif);margin:0 0 12px}
.box dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0 0 20px}.box dt{color:var(--terong-3);font-size:14px}.box dd{margin:0;font-weight:600}
.map{border:0;width:100%;height:100%;min-height:320px;border-radius:22px;background:var(--mentega-2)}
@media(max-width:860px){.split{grid-template-columns:1fr}}
details{border-bottom:1.5px solid var(--garis)}
summary{cursor:pointer;font:600 18px/1.4 var(--serif);padding:18px 0;list-style:none;display:flex;justify-content:space-between;gap:16px}summary::-webkit-details-marker{display:none}
summary::after{content:"+";font:500 24px/1 var(--sans);color:var(--raspberry)}details[open] summary::after{content:"–"}
details p{margin:0 0 18px;color:var(--terong-2);max-width:60ch}
/* halaman barang */
.crumb{font-size:14px;color:var(--terong-3);margin:22px 0 14px}.crumb a{text-decoration:none;color:var(--terong-2)}
.pd{display:grid;grid-template-columns:minmax(0,500px) 1fr;gap:44px;align-items:start;padding-bottom:40px}
.gal{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:46% 46% 22px 22px/24% 24% 22px 22px;scrollbar-width:none;background:var(--persik)}
.gal img,.gal .ph{flex:none;width:100%;height:auto;scroll-snap-align:center;aspect-ratio:4/5;object-fit:cover;background:var(--persik)}
.gal .ph{display:grid;place-items:center;font:600 64px var(--serif);color:var(--terong-3)}
.thumbs{display:flex;gap:8px;margin-top:12px}.thumbs button{width:62px;height:76px;border-radius:12px;overflow:hidden;padding:0;border:2px solid transparent;cursor:pointer;background:none}.thumbs button[aria-current=true]{border-color:var(--raspberry)}.thumbs img{width:100%;height:100%;object-fit:cover}
.pd h1{font-size:clamp(30px,4vw,46px)}
.bigprice{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 6px}.bigprice b{font:700 30px/1.1 var(--sans)}.bigprice s{color:var(--terong-3)}
.promo-note{display:inline-block;background:var(--mentega);border-radius:10px;padding:6px 10px;font-weight:600;font-size:14px;margin:4px 6px 14px 0}
.opt{margin:18px 0}.opt p{font-weight:700;margin:0 0 8px;font-size:15px}
.opt .chips{margin:0}.opt .chips button[disabled]{opacity:.35;text-decoration:line-through;cursor:not-allowed}
.stocknote{font-size:14px;color:var(--daun-ink);font-weight:600;min-height:22px;margin:4px 0 14px}
.desc{white-space:pre-line;color:var(--terong-2)}
@media(max-width:860px){.pd{grid-template-columns:1fr}}
/* kaki */
footer{background:var(--terong);color:#F3DCE5;padding:44px 0 96px}
footer .wrap{display:grid;grid-template-columns:2fr 1fr 1fr;gap:24px}footer a{color:#fff}footer h2{color:#fff;font-size:26px}footer p{margin:4px 0;color:#E3C5D2}
footer small{display:block;margin-top:16px;color:#C3A3B6}
@media(max-width:760px){footer .wrap{grid-template-columns:1fr}}
.float{position:fixed;right:16px;bottom:16px;z-index:30;box-shadow:0 10px 24px -8px rgba(184,50,90,.7)}
@media(min-width:900px){.float{display:none}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<a class="skip" href="#isi">Langsung ke isi</a>
<header class="top"><div class="wrap">
  <a class="brand" href="<?= h($BASE) ?>"><?= h($S['name']) ?><small>Toko baju wanita, <?= h($S['city']) ?></small></a>
  <nav class="nav" aria-label="Menu"><a href="<?= h($BASE) ?>#katalog">Katalog</a><?php if ($autoPromos): ?><a href="<?= h($BASE) ?>#penawaran">Promo</a><?php endif; ?><a href="<?= h($BASE) ?>#cara-pesan">Cara pesan</a><a href="<?= h($BASE) ?>#lokasi">Lokasi</a><a href="<?= h($BASE) ?>#tanya">Tanya jawab</a></nav>
  <?php if ($waHello): ?><a class="btn wa" href="<?= h($waHello) ?>" rel="nofollow noopener" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.6-.5-1-1.1-1.4-1.8-.1-.2 0-.4.1-.5l.4-.4.3-.4v-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.8.8-1.1 1.9-.9 3 .3 1.2.9 2.3 1.7 3.2 1.4 1.6 3.2 2.7 5.2 3.1.8.1 1.6 0 2.3-.4.4-.3.7-.7.8-1.2.1-.3.1-.6 0-.8l-.3-.2Z"/></svg>Chat WhatsApp</a><?php endif; ?>
</div></header>
<main id="isi">
<?php if ($notFound): ?>
  <section><div class="wrap"><h1>Barang ini sudah tidak tersedia</h1><p class="lead">Mungkin stoknya sudah habis. Lihat koleksi lain yang masih ada di katalog.</p><a class="btn" href="<?= h($BASE) ?>">Lihat katalog</a></div></section>
<?php elseif ($item): ?>
  <div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb"><a href="<?= h($BASE) ?>">Katalog</a> / <?php if ($item['category']): ?><a href="<?= h($BASE) ?>?kategori=<?= rawurlencode($item['category']) ?>#katalog"><?= h($item['category']) ?></a> / <?php endif; ?><?= h($item['title']) ?></nav>
    <div class="pd">
      <div>
        <div class="gal" id="gal"><?php if ($item['pics']): foreach ($item['pics'] as $i => $f) echo img_tag($f, $item['title'] . ' – foto ' . ($i + 1), '', $i > 0); else: ?><div class="ph" aria-hidden="true"><?= h(initials($item['title'])) ?></div><?php endif; ?></div>
        <?php if (count($item['pics']) > 1): ?><div class="thumbs" id="thumbs"><?php foreach ($item['pics'] as $i => $f): ?><button type="button" aria-label="Foto <?= $i + 1 ?>" aria-current="<?= $i ? 'false' : 'true' ?>"><img src="<?= h(img_url($f)) ?>" alt="" loading="lazy"></button><?php endforeach; ?></div><?php endif; ?>
      </div>
      <div>
        <h1><?= h($item['title']) ?></h1>
        <div class="bigprice" id="price"><?= $item['minNormal'] > $item['min'] ? '<s>' . rp($item['minNormal']) . '</s>' : '' ?><b><?= $item['min'] === $item['max'] ? rp($item['min']) : rp($item['min']) . ' – ' . rp($item['max']) ?></b></div>
        <?php if ($item['promo']): ?><div class="promo-note"><?= h($item['promo']['name']) ?> · <?= h(promo_desc($item['promo'])) ?><?= $item['promo']['end_date'] ? ' s.d. ' . h(date('j/n', strtotime($item['promo']['end_date']))) : '' ?></div><?php endif; ?>
        <?php if ($item['badge']): ?><div class="promo-note"><?= h($item['badge']['name']) ?> · <?= h(promo_desc($item['badge'])) ?></div><?php endif; ?>
        <?php if ($item['colors']): ?><div class="opt"><p>Warna</p><div class="chips" data-opt="color"><?php foreach ($item['colors'] as $c): ?><button type="button" aria-pressed="false" data-v="<?= h($c) ?>"><?= h($c) ?></button><?php endforeach; ?></div></div><?php endif; ?>
        <?php if ($item['sizes']): ?><div class="opt"><p>Ukuran</p><div class="chips" data-opt="size"><?php foreach ($item['sizes'] as $c): ?><button type="button" aria-pressed="false" data-v="<?= h($c) ?>"><?= h($c) ?></button><?php endforeach; ?></div></div><?php endif; ?>
        <p class="stocknote" id="stocknote" aria-live="polite">Tersedia di toko</p>
        <?php if ($S['wa']): ?><a class="btn wa" id="order" href="<?= h(wa_link($S['wa'], 'Halo ' . $S['name'] . ', saya mau pesan ' . $item['title'] . ' (' . rp($item['min']) . '). ' . $canon)) ?>" rel="nofollow noopener" target="_blank">Pesan via WhatsApp</a><?php endif; ?>
        <a class="btn" href="<?= h($mapsLink) ?>" rel="noopener" target="_blank" style="margin-left:6px">Lihat di toko</a>
        <?php if (trim((string)$item['description']) !== ''): ?><h2 style="font-size:24px;margin-top:32px">Detail</h2><p class="desc"><?= h($item['description']) ?></p><?php endif; ?>
        <p class="sub" style="margin-top:18px;font-size:14px">Harga sama dengan di kasir toko dan berubah otomatis mengikuti promo. Promo tidak dapat digabung dengan diskon member.</p>
      </div>
    </div>
    <?php $related = array_values(array_filter($items, fn($x) => $x['slug'] !== $item['slug'] && $x['category'] === $item['category'])); if (count($related) < 4) $related = array_merge($related, array_values(array_filter($items, fn($x) => $x['slug'] !== $item['slug'] && $x['category'] !== $item['category']))); $related = array_slice($related, 0, 4); ?>
    <?php if ($related): ?><section style="padding-top:10px"><h2>Mungkin kamu suka</h2><div class="grid" style="margin-top:18px"><?php foreach ($related as $it) include __DIR__ . '/kartu.php'; ?></div></section><?php endif; ?>
  </div>
  <script>window.VARS=<?= json_encode(array_map(fn($v) => ['c' => $v['color'], 's' => $v['size'], 'p' => $v['price'], 'n' => $v['normal'], 'q' => $v['stock']], $item['vars']), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;window.ORDER=<?= json_encode(['wa' => $S['wa'], 'store' => $S['name'], 'title' => $item['title'], 'url' => $canon], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?>;</script>
<?php else: ?>
  <div class="awning" aria-hidden="true"></div>
  <div class="hero"><div class="wrap">
    <div>
      <p class="kicker"><span class="dot<?= $open ? '' : ' off' ?>"></span><span><?= $open ? 'Sedang buka sampai ' . h($S['close']) : 'Sedang tutup, buka ' . h(str_replace('Setiap hari', 'setiap hari', days_text($openDays, $DAYS))) . ' pukul ' . h($S['open']) ?>, <?= h($S['address']) ?></span></p>
      <h1>Toko baju wanita di <?= h($S['city']) ?> untuk kerja dan sehari-hari</h1>
      <p class="lead"><?= h($S['tagline']) ?></p>
      <div class="cta"><a class="btn wa" href="#katalog">Lihat katalog &amp; harga</a><?php if ($waHello): ?><a class="btn" href="<?= h($waHello) ?>" target="_blank" rel="nofollow noopener">Chat WhatsApp</a><?php else: ?><a class="btn" href="<?= h($mapsLink) ?>" target="_blank" rel="noopener">Petunjuk arah</a><?php endif; ?></div>
      <ul class="facts"><li><b><?= count($items) ?></b> model tersedia</li><li><?= h($hoursText) ?></li><li>Ambil di toko, antar, atau kirim</li></ul>
    </div>
    <?php $heroPics = array_values(array_filter($items, fn($i) => $i['pics'])); $storePic = $S['storepic'] !== '' && is_file(dirname(__DIR__) . '/' . $S['storepic']) ? $S['storepic'] : ''; ?>
    <?php if (count($heroPics) < 2 && $storePic): ?>
    <div class="storefront"><?= img_tag($storePic, 'Toko ' . $S['name'] . ' di ' . $S['address'], '', false) ?><?php if ($items): ?><span class="tag">Koleksi mulai <?= h(rp(min(array_column($items, 'min')))) ?></span><?php endif; ?></div>
    <?php else: ?>
    <div class="rail">
      <div class="rack">
      <?php $hero = array_slice($heroPics, 0, 3); if (count($hero) < 3) $hero = array_slice(array_merge($hero, array_values(array_filter($items, fn($i) => !$i['pics']))), 0, 3);
      foreach ($hero as $k => $it): ?>
        <a class="hang" href="<?= h($BASE . 'p/' . rawurlencode($it['slug'])) ?>" aria-label="<?= h($it['title'] . ', ' . rp($it['min'])) ?>">
          <svg class="hook" viewBox="0 0 30 34" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M15 33V20M15 20c5 0 8-3 8-7.5S19.5 4 15 4s-7 3-7 6.5"/></svg>
          <span class="body"><?php if ($it['pics']) echo img_tag($it['pics'][0], '', '', $k > 1); else echo '<span class="ph">' . h(initials($it['title'])) . '</span>'; ?></span>
          <span class="tag"><?= $it['minNormal'] > $it['min'] ? '<s>' . rp($it['minNormal']) . '</s>' : '' ?><?= h(rp($it['min'])) ?></span>
        </a>
      <?php endforeach; ?>
      </div>
    </div>
    <?php endif; ?>
  </div></div>
  <?php $showPromos = $autoPromos; if ($showPromos): ?>
  <section id="penawaran" class="offer-sec"><div class="wrap">
    <h2>Penawaran hari ini</h2>
    <p class="sub">Promo yang sedang berjalan di toko. Harga di katalog di bawah sudah memakai promo ini.</p>
    <div class="promos"><?php foreach ($showPromos as $p): ?><div class="promo"><b><?= h(promo_desc($p)) ?></b><span><?= h($p['name']) ?><?= (float)$p['min_purchase'] > 0 ? ', min. belanja ' . rp($p['min_purchase']) : '' ?><?= $p['end_date'] ? ', sampai ' . date('j/n', strtotime($p['end_date'])) : '' ?></span></div><?php endforeach; ?></div>
    <?php if ($S['wa']): ?><a class="btn wa" style="margin-top:18px" href="<?= h(wa_link($S['wa'], 'Halo ' . $S['name'] . ', saya mau tanya promo yang sedang berjalan.')) ?>" target="_blank" rel="nofollow noopener">Tanya promo via WhatsApp</a><?php endif; ?>
  </div></section>
  <?php endif; ?>
  <section id="katalog"><div class="wrap">
    <h2>Katalog &amp; harga hari ini</h2>
    <p class="sub">Harga di bawah sama dengan harga di kasir toko dan sudah termasuk promo yang sedang berjalan. Stok diperbarui setiap ada penjualan.</p>
    <?php if (count($cats) > 1): ?><div class="chips" id="cats" role="group" aria-label="Kategori"><button type="button" aria-pressed="true" data-c="">Semua</button><?php foreach ($cats as $c): ?><button type="button" aria-pressed="false" data-c="<?= h($c) ?>"><?= h($c) ?></button><?php endforeach; ?></div><?php endif; ?>
    <?php if ($items): ?><div class="grid" id="grid"><?php foreach ($items as $it) include __DIR__ . '/kartu.php'; ?></div>
    <?php else: ?><div class="empty">Katalog sedang disiapkan. Hubungi kami lewat WhatsApp atau datang langsung ke toko untuk melihat koleksi.</div><?php endif; ?>
  </div></section>
  <section id="cara-pesan" class="steps-sec"><div class="wrap">
    <h2>Cara pesan dari rumah</h2>
    <ol class="steps">
      <li><b>Pilih barangnya</b><span>Buka barang di katalog, pilih warna dan ukuran yang masih tersedia.</span></li>
      <li><b>Pesan via WhatsApp</b><span>Tekan tombol pesan. Nama barang, warna, ukuran, dan harga terkirim otomatis ke admin toko untuk dicek.</span></li>
      <li><b>Ambil, diantar, atau dikirim</b><span>Ambil sendiri di toko, diantar dalam kota <?= h($S['city']) ?>, atau dikirim ke luar kota lewat ekspedisi. Ongkir diinfokan lewat WhatsApp.</span></li>
    </ol>
  </div></section>
  <section id="kenapa" class="why-sec"><div class="wrap">
    <h2>Belanja di <?= h($S['name']) ?></h2>
    <div class="why">
      <div><b>Harga bersahabat</b><p>Koleksi kerja dan harian dengan harga yang ramah di kantong, ditambah promo yang tampil langsung di katalog ini.</p></div>
      <div><b>Belanja jadi poin</b><p>Daftar jadi member di kasir dan dapat 1 poin setiap belanja <?= h(rp($S['ppa'])) ?>. Poin bisa ditukar dengan hadiah atau potongan.</p></div>
      <div><b>Harga sama dengan di toko</b><p>Harga, promo, dan stok di halaman ini terhubung langsung dengan kasir toko, jadi yang kamu lihat sama dengan di rak.</p></div>
    </div>
  </div></section>
  <?php if ($hasTesti): ?>
  <section id="ulasan"><div class="wrap">
    <h2>Kata pelanggan</h2>
    <?php if ($S['ig']): ?><p class="sub">Testimoni dari pelanggan lewat WhatsApp dan <a href="https://www.instagram.com/<?= h(rawurlencode($S['ig'])) ?>/" rel="noopener" target="_blank">Instagram @<?= h($S['ig']) ?></a>.</p><?php endif; ?>
    <div class="testi">
      <?php foreach (array_slice($igPosts, 0, 8) as $p): ?><a class="t-ig" href="<?= h($p['link']) ?>" rel="noopener" target="_blank"><?php if (!empty($p['img']) && is_file(dirname(__DIR__) . '/' . $p['img'])) echo img_tag($p['img'], 'Testimoni pelanggan di Instagram ' . $S['name']); ?><?php if ($p['text'] !== ''): ?><span class="t-cap"><?= h(mb_strimwidth($p['text'], 0, 160, '…')) ?></span><?php endif; ?><span class="t-src">Lihat di Instagram</span></a><?php endforeach; ?>
      <?php foreach ($shots as $i => $f): ?><a class="t-shot" href="<?= h(img_url($f)) ?>" target="_blank" rel="noopener"><?= img_tag($f, 'Tangkapan layar testimoni pelanggan ' . ($i + 1)) ?></a><?php endforeach; ?>
      <?php foreach (array_slice($testi, 0, 6) as $t): ?><figure class="t-quote"><blockquote><?= h($t['text']) ?></blockquote><figcaption><?= h($t['name']) ?><?= $t['src'] !== '' ? '<span>' . h($t['src']) . '</span>' : '' ?></figcaption></figure><?php endforeach; ?>
    </div>
  </div></section>
  <?php endif; ?>
  <section id="lokasi"><div class="wrap">
    <h2>Kunjungi toko kami</h2>
    <p class="sub"><?= h($S['about'] !== '' ? $S['about'] : $S['name'] . ' adalah toko pakaian wanita di ' . $S['address'] . '. Datang langsung ke toko, atau pesan dari rumah lewat WhatsApp.') ?></p>
    <div class="split">
      <div class="box">
        <h3>Alamat &amp; jam buka</h3>
        <dl><dt>Alamat</dt><dd><?= h($S['address']) ?></dd><dt>Jam buka</dt><dd><?= h($hoursText) ?></dd><?php if ($S['wa']): ?><dt>WhatsApp</dt><dd><a href="<?= h($waHello) ?>" rel="nofollow noopener" target="_blank">+<?= h($S['wa']) ?></a></dd><?php endif; ?><?php if ($S['ig']): ?><dt>Instagram</dt><dd><a href="https://www.instagram.com/<?= h(rawurlencode($S['ig'])) ?>/" rel="noopener" target="_blank">@<?= h($S['ig']) ?></a></dd><?php endif; ?></dl>
        <div class="cta"><a class="btn wa" href="<?= h($mapsLink) ?>" target="_blank" rel="noopener">Petunjuk arah</a><?php if ($waHello): ?><a class="btn" href="<?= h($waHello) ?>" target="_blank" rel="nofollow noopener">Tanya stok</a><?php endif; ?></div>
      </div>
      <iframe class="map" title="Peta lokasi <?= h($S['name']) ?>" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=<?= rawurlencode($S['name'] . ', ' . $S['address']) ?>&amp;output=embed"></iframe>
    </div>
  </div></section>
  <section id="tanya"><div class="wrap" style="max-width:820px">
    <h2>Tanya jawab</h2>
    <?php foreach ($faq as $q): ?><details><summary><?= h($q[0]) ?></summary><p><?= h($q[1]) ?></p></details><?php endforeach; ?>
  </div></section>
<?php endif; ?>
</main>
<footer><div class="wrap">
  <div><h2><?= h($S['name']) ?></h2><p>Toko baju wanita di <?= h($S['address']) ?>.</p><p><?= h($hoursText) ?></p><small>© <?= date('Y') ?> <?= h($S['name']) ?> · Harga terhubung langsung dengan kasir toko.</small></div>
  <div><p><a href="<?= h($BASE) ?>#katalog">Katalog</a></p><p><a href="<?= h($BASE) ?>#lokasi">Lokasi</a></p><p><a href="<?= h($BASE) ?>#tanya">Tanya jawab</a></p></div>
  <div><?php if ($S['ig']): ?><p><a href="https://www.instagram.com/<?= h(rawurlencode($S['ig'])) ?>/" rel="noopener" target="_blank">Instagram @<?= h($S['ig']) ?></a></p><?php endif; ?><?php if ($waHello): ?><p><a href="<?= h($waHello) ?>" rel="nofollow noopener" target="_blank">WhatsApp</a></p><?php endif; ?><p><a href="<?= h($mapsLink) ?>" rel="noopener" target="_blank">Google Maps</a></p></div>
</div></footer>
<?php if ($S['wa'] && $item): ?><a class="btn wa float" href="<?= h($item ? '#order' : $waHello) ?>" <?= $item ? '' : 'rel="nofollow noopener" target="_blank"' ?>><?= $item ? 'Pesan sekarang' : 'Chat WhatsApp' ?></a><?php endif; ?>
<script>
(function(){
  var cats=document.getElementById('cats'),grid=document.getElementById('grid');
  if(cats&&grid){var set=function(c){[].forEach.call(cats.children,function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-c')===c))});[].forEach.call(grid.children,function(el){el.hidden=!!c&&el.getAttribute('data-cat')!==c})};
    cats.addEventListener('click',function(e){var b=e.target.closest('button');if(b)set(b.getAttribute('data-c'))});
    var q=new URLSearchParams(location.search).get('kategori');if(q)set(q);}
  var gal=document.getElementById('gal'),th=document.getElementById('thumbs');
  if(gal&&th){th.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;var i=[].indexOf.call(th.children,b);gal.scrollTo({left:gal.clientWidth*i,behavior:'smooth'})});
    gal.addEventListener('scroll',function(){var i=Math.round(gal.scrollLeft/gal.clientWidth);[].forEach.call(th.children,function(b,k){b.setAttribute('aria-current',String(k===i))})},{passive:true});}
  if(!window.VARS)return;
  var V=window.VARS,O=window.ORDER,sel={color:'',size:''},rp=function(n){return 'Rp'+Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')};
  var groups=document.querySelectorAll('[data-opt]'),price=document.getElementById('price'),note=document.getElementById('stocknote'),order=document.getElementById('order');
  function upd(){
    groups.forEach(function(g){var k=g.getAttribute('data-opt'),o=k==='color'?'size':'color';[].forEach.call(g.children,function(b){var v=b.getAttribute('data-v');b.disabled=!V.some(function(x){return x[k==='color'?'c':'s']===v&&(!sel[o]||x[o==='color'?'c':'s']===sel[o])});b.setAttribute('aria-pressed',String(sel[k]===v))})});
    var m=V.filter(function(x){return(!sel.color||x.c===sel.color)&&(!sel.size||x.s===sel.size)}),one=m.length===1||(m.length&&(sel.color||!groups.length)&&(sel.size||!document.querySelector('[data-opt=size]')));
    if(m.length){var lo=Math.min.apply(null,m.map(function(x){return x.p})),hi=Math.max.apply(null,m.map(function(x){return x.p})),n=Math.min.apply(null,m.map(function(x){return x.n}));price.innerHTML=(n>lo?'<s>'+rp(n)+'</s>':'')+'<b>'+(lo===hi?rp(lo):rp(lo)+' – '+rp(hi))+'</b>';}
    var q=m.reduce(function(s,x){return s+x.q},0);note.textContent=one?(q<=2?'Sisa sedikit, '+q+' pcs':'Tersedia'):'Pilih warna & ukuran';
    if(order&&O.wa){var v=one&&m[0],t='Halo '+O.store+', saya mau pesan:\n'+O.title+(sel.color?'\nWarna: '+sel.color:'')+(sel.size?'\nUkuran: '+sel.size:'')+(v?'\nHarga: '+rp(v.p):'')+'\n'+O.url;order.href='https://api.whatsapp.com/send?phone='+O.wa+'&text='+encodeURIComponent(t);}
  }
  groups.forEach(function(g){g.addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.disabled)return;var k=g.getAttribute('data-opt'),v=b.getAttribute('data-v');sel[k]=sel[k]===v?'':v;upd()})});
  ['color','size'].forEach(function(k){var g=document.querySelector('[data-opt='+k+']');if(g&&g.children.length===1){sel[k]=g.children[0].getAttribute('data-v')}});
  upd();
})();
</script>
</body>
</html>
<?php
// ambil testimoni Instagram di belakang layar (paling sering 6 jam sekali), setelah halaman terkirim
if (trim((string)setting('web_ig_token', '')) !== '' && time() - (int)setting('web_ig_fetched', '0') >= 6 * 3600) {
    if (function_exists('litespeed_finish_request')) litespeed_finish_request(); elseif (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    try { ig_sync(false); } catch (Throwable $e) { /* dicoba lagi nanti */ }
}
