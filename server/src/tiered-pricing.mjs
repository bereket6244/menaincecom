export function normalizePriceTiers(tiers) {
  const byMinimum = new Map();
  for (const tier of Array.isArray(tiers) ? tiers : []) {
    const minQty = Math.max(1, Math.floor(Number(tier?.minQty) || 0));
    const priceEach = Math.max(0, Number(tier?.priceEach) || 0);
    if (priceEach > 0) byMinimum.set(minQty, priceEach);
  }
  return [...byMinimum.entries()]
    .map(([minQty, priceEach]) => ({ minQty, priceEach }))
    .sort((a, b) => a.minQty - b.minQty);
}

export function tieredLineTotal(tiers, quantity) {
  const clean = normalizePriceTiers(tiers);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (!clean.length || clean[0].minQty !== 1) return null;

  let total = 0;
  for (let index = 0; index < clean.length; index += 1) {
    const tier = clean[index];
    if (tier.minQty > qty) break;
    const nextMinimum = clean[index + 1]?.minQty ?? qty + 1;
    total += Math.max(0, Math.min(qty + 1, nextMinimum) - tier.minQty) * tier.priceEach;
  }
  return total;
}

export function tieredAveragePrice(tiers, quantity) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const total = tieredLineTotal(tiers, qty);
  return total == null ? null : total / qty;
}
