import type { PriceTier } from './types';

export function normalizePriceTiers(tiers: PriceTier[] | undefined): PriceTier[] {
  const byMinimum = new Map<number, number>();
  for (const tier of tiers || []) {
    const minQty = Math.max(1, Math.floor(Number(tier?.minQty) || 0));
    const priceEach = Math.max(0, Number(tier?.priceEach) || 0);
    if (priceEach > 0) byMinimum.set(minQty, priceEach);
  }
  return [...byMinimum.entries()]
    .map(([minQty, priceEach]) => ({ minQty, priceEach }))
    .sort((a, b) => a.minQty - b.minQty);
}

/** The qualifying rate applies to every unit on the line. */
export function tieredUnitPrice(tiers: PriceTier[] | undefined, quantity: number): number | null {
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

export function tieredLineTotal(tiers: PriceTier[] | undefined, quantity: number): number | null {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const rate = tieredUnitPrice(tiers, qty);
  return rate == null ? null : Math.round(rate * 100) * qty / 100;
}

export function formatEtbAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
