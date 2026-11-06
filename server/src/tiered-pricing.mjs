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

/** Thresholds are inclusive caps: a threshold of 10 changes the rate for item 11 onward. */
export function tieredLineTotal(tiers, quantity) {
  const clean = normalizePriceTiers(tiers);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (clean[0]?.minQty !== 1) return null;
  let totalCents = 0;
  for (let index = 0; index < clean.length; index++) {
    const start = index === 0 ? 0 : clean[index].minQty;
    const end = Math.min(qty, clean[index + 1]?.minQty ?? qty);
    if (end > start) totalCents += (end - start) * Math.round(clean[index].priceEach * 100);
    if (end === qty) break;
  }
  return totalCents / 100;
}

/** Keep the full blended rate; rounding it before multiplication changes the order total. */
export function tieredUnitPrice(tiers, quantity) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const total = tieredLineTotal(tiers, qty);
  return total == null ? null : total / qty;
}
