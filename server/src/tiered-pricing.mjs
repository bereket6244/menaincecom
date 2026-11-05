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

export function tieredUnitPrice(tiers, quantity) {
  const clean = normalizePriceTiers(tiers);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (clean[0]?.minQty !== 1) return null;
  let rate = clean[0].priceEach;
  for (const tier of clean) {
    if (tier.minQty > qty) break;
    rate = tier.priceEach;
  }
  return Math.round(rate * 100) / 100;
}

export function tieredLineTotal(tiers, quantity) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const rate = tieredUnitPrice(tiers, qty);
  return rate == null ? null : Math.round(rate * 100) * qty / 100;
}
