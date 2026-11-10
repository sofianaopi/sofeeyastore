/* Mesin promo — logika sama dengan versi sebelumnya (persen, potongan tetap, harga khusus, paket Beli X Gratis Y, B1G1) */
'use strict';
const Promo = (() => {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const ids = (v) => arr(v).map(String);
  const has = (list, id) => list.includes(String(id));

  function activeToday(p) {
    if (!p || !p.active) return false;
    const today = ymd();
    if (p.start_date && p.start_date > today) return false;
    if (p.end_date && p.end_date < today) return false;
    return true;
  }
  const pkgQty = (p) => (p.type === 'bogo' ? { buy: 1, free: 1 } : { buy: Math.max(1, Number(p.buy_qty) || 1), free: Math.max(1, Number(p.free_qty) || 1) });
  const priceOk = (p, price) => (!(p.min_price > 0) || price >= p.min_price) && (!(p.max_price > 0) || price <= p.max_price);
  const triggers = (p, c) => { const cats = arr(p.categories), pids = ids(p.product_ids); return (cats.length === 0 || cats.includes(c.category)) && (pids.length === 0 || has(pids, c.id)) && priceOk(p, c.price); };

  function describe(p) {
    if (p.type === 'package' || p.type === 'bogo') { const q = pkgQty(p); return `Beli ${q.buy} gratis ${q.free}`; }
    if (p.type === 'percent') return `Diskon ${p.value}%`;
    if (p.type === 'price') return `Harga jadi ${rupiah(p.value)}`;
    return `Potongan ${rupiah(p.value)} / pcs`;
  }
  const TYPE_LABEL = { percent: 'Diskon persen', fixed: 'Potongan tetap / pcs', price: 'Harga khusus', package: 'Paket beli X gratis Y', bogo: 'Beli 1 gratis 1' };
  const isAuto = (p) => p.type === 'bogo' || p.type === 'package' || p.type === 'price' || !p.code;

  function lineAmount(p, c) {
    if (p.type === 'price') { const eff = c.price - (c.discount || 0); const d = eff - (p.value || 0); return d > 0 ? Math.round(d * c.qty) : 0; }
    if (p.type === 'percent') return Math.round((c.price * c.qty * (p.value || 0)) / 100);
    return Math.min(p.value || 0, c.price) * c.qty; // fixed: per pcs
  }

  // Hitung semua promo yang berlaku. Return { total, itemPromo:{id:{amount,promoName}}, perPromo:{promoId:amount} }
  function compute(promos, cart, subtotal) {
    const itemPromo = {}, perPromo = {}, freed = {};
    const add = (cid, p, amt) => {
      const e = itemPromo[cid];
      if (e) { e.amount += amt; if (!e.promoName.includes(p.name)) e.promoName += ', ' + p.name; } else itemPromo[cid] = { amount: amt, promoName: p.name };
      perPromo[p.id] = (perPromo[p.id] || 0) + amt;
    };
    const giveFree = (p, lines, need) => {
      let rem = need;
      for (const c of [...lines].sort((a, b) => a.price - b.price)) {
        if (rem <= 0) break;
        const avail = Math.max(0, c.qty - (freed[c.id] || 0)); const take = Math.min(rem, avail);
        if (take > 0) { add(c.id, p, take * c.price); freed[c.id] = (freed[c.id] || 0) + take; }
        rem -= take;
      }
    };
    for (const p of promos) {
      if (p.type !== 'package' && p.type !== 'bogo') continue;
      if (subtotal < (p.min_purchase || 0)) continue;
      const { buy, free } = pkgQty(p);
      const freePids = ids(p.free_product_ids);
      if (p.free_category || freePids.length) {
        let need = 0;
        if (freePids.length) need = Math.floor(cart.filter((c) => triggers(p, c)).reduce((s, c) => s + c.qty, 0) / buy) * free;
        else { const byCat = {}; cart.filter((c) => triggers(p, c)).forEach((c) => { byCat[c.category] = (byCat[c.category] || 0) + c.qty; }); Object.values(byCat).forEach((q) => { need += Math.floor(q / buy) * free; }); }
        if (need > 0) giveFree(p, freePids.length ? cart.filter((c) => has(freePids, c.id)) : cart.filter((c) => c.category === p.free_category), need);
      } else {
        const el = cart.filter((c) => triggers(p, c));
        const count = Math.floor(el.reduce((s, c) => s + c.qty, 0) / (buy + free)) * free;
        if (count > 0) giveFree(p, el, count);
      }
    }
    for (const p of promos) {
      if (p.type === 'package' || p.type === 'bogo') continue;
      if (subtotal < (p.min_purchase || 0)) continue;
      for (const c of cart) { if (!triggers(p, c)) continue; const a = lineAmount(p, c); if (a > 0) add(c.id, p, a); }
    }
    return { total: Object.values(perPromo).reduce((s, v) => s + v, 0), itemPromo, perPromo };
  }

  // Pesan "sedikit lagi dapat promo"
  function upsell(autoPromos, allActive, cart, subtotal, calc) {
    const msgs = [];
    for (const p of autoPromos) {
      if (calc.perPromo[p.id] || p.type === 'price' || (p.type !== 'package' && p.type !== 'bogo')) continue;
      if (p.min_purchase > 0 && subtotal < p.min_purchase) continue;
      const { buy, free } = pkgQty(p);
      const qty = cart.filter((c) => triggers(p, c)).reduce((s, c) => s + c.qty, 0);
      if (!qty) continue;
      const freePids = ids(p.free_product_ids);
      if (p.free_category || freePids.length) {
        const groups = Math.floor(qty / buy);
        if (groups > 0) msgs.push(`Tambahkan barang hadiah ${p.name} ke keranjang supaya gratis`);
        else msgs.push(`Tambah ${buy - qty} barang lagi untuk ${p.name}`);
      } else {
        const rem = qty % (buy + free);
        if (rem > 0) msgs.push(`Tambah ${buy + free - rem} pcs lagi untuk dapat ${free} gratis (${p.name})`);
      }
    }
    for (const p of allActive) {
      if (p.min_purchase > 0 && subtotal > 0 && subtotal < p.min_purchase && p.min_purchase - subtotal <= 100000) msgs.push(`Belanja ${rupiah(p.min_purchase - subtotal)} lagi untuk ${p.name}`);
    }
    return msgs.slice(0, 3);
  }

  // validasi sebelum kode voucher diterapkan
  function checkVoucher(p, cart, subtotal) {
    if (subtotal < (p.min_purchase || 0)) return `Minimal belanja ${rupiah(p.min_purchase)}.`;
    if (!cart.some((c) => triggers(p, c))) return 'Tidak ada barang di keranjang yang memenuhi syarat promo ini.';
    return '';
  }
  function badgeFor(product, active) {
    for (const p of active) {
      if (!p.badge_text) continue;
      const pids = ids(p.product_ids), cats = arr(p.categories);
      if ((pids.length && has(pids, product.id)) || (cats.length && cats.includes(product.category)) || (!pids.length && !cats.length)) return p;
    }
    return null;
  }
  return { activeToday, compute, describe, upsell, checkVoucher, badgeFor, isAuto, TYPE_LABEL, pkgQty };
})();
const BADGE_COLORS = { yellow: '#D4A106', amber: '#D97706', orange: '#EA580C', red: '#DC2626', green: '#16A34A', emerald: '#059669', blue: '#2563EB', violet: '#7C3AED', pink: '#DB2777', fuchsia: '#C026D3' };
