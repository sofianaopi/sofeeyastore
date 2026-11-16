<?php
/** Kartu barang di katalog. Variabel: $it (item katalog), $BASE */
if (!isset($it)) return;
$COLORS = ['hitam' => '#222', 'putih' => '#fff', 'broken white' => '#f4efe6', 'cream' => '#f1e3c8', 'krem' => '#f1e3c8', 'navy' => '#1f2a4d', 'biru' => '#3b6fd1', 'merah' => '#c62f3a', 'maroon' => '#6d1f2c', 'pink' => '#f2a6bd', 'dusty pink' => '#d7a1a9', 'ungu' => '#8c6bb1', 'lilac' => '#c8b2db', 'mocca' => '#a58a73', 'coklat' => '#7a5034', 'cokelat' => '#7a5034', 'abu' => '#9aa0a6', 'abu-abu' => '#9aa0a6', 'hijau' => '#4f8a5b', 'sage' => '#a3b18a', 'army' => '#5b6237', 'kuning' => '#f2c94c', 'mustard' => '#d7a63a', 'orange' => '#f08a3c', 'tosca' => '#3fb8af', 'salem' => '#f3a68a', 'olive' => '#7c7a3a', 'denim' => '#4b6a8f', 'emerald' => '#1f8a6b', 'beige' => '#e5d3b3', 'nude' => '#e3c0a6', 'baby blue' => '#a9cbee', 'peach' => '#f7c1a1', 'mint' => '#bfe6d0', 'khaki' => '#c3b091', 'terracotta' => '#c8664a', 'wardah' => '#c6a5b9', 'silver' => '#c0c0c0', 'gold' => '#d4af37'];
$url = $BASE . 'p/' . rawurlencode($it['slug']);
?>
<a class="card" href="<?= h($url) ?>" data-cat="<?= h($it['category']) ?>">
  <div class="pic"><?php if ($it['pics']): echo img_tag($it['pics'][0], $it['title'] . ($it['colors'] ? ' warna ' . implode(', ', $it['colors']) : '')); else: ?><span class="ph" aria-hidden="true"><?= h(initials($it['title'])) ?></span><?php endif; ?>
    <?php if ($it['promo']): ?><span class="sticker"><?= h(promo_desc($it['promo'])) ?></span><?php elseif ($it['badge']): ?><span class="sticker"><?= h(promo_desc($it['badge'])) ?></span><?php elseif ($it['stock'] <= 2): ?><span class="sticker daun">Sisa <?= (int)$it['stock'] ?></span><?php endif; ?>
    <span class="tag"><?= $it['minNormal'] > $it['min'] ? '<s>' . rp($it['minNormal']) . '</s>' : '' ?><?= $it['min'] !== $it['max'] ? 'mulai ' : '' ?><?= rp($it['min']) ?></span></div>
  <h3><?= h($it['title']) ?></h3>
  <p class="meta"><?= h(implode(' · ', array_filter([$it['category'], $it['sizes'] ? implode(' ', array_slice($it['sizes'], 0, 6)) : '']))) ?></p>
  <?php if ($it['colors']): ?><div class="swatch" aria-label="Warna: <?= h(implode(', ', $it['colors'])) ?>"><?php foreach (array_slice($it['colors'], 0, 7) as $c): $k = strtolower(trim($c)); ?><i style="--c:<?= h($COLORS[$k] ?? ($COLORS[preg_replace('~\s.*$~', '', $k)] ?? '#e8d5dc')) ?>" title="<?= h($c) ?>"></i><?php endforeach; ?></div><?php endif; ?>
</a>
