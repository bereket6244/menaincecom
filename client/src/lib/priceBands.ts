import type { Product } from './types';

export type PriceBand = { id: string; label: string; test: (value: number) => boolean };

export function formatEtb(value: number): string {
  return `${Math.round(value).toLocaleString()} ETB`;
}

/** Ascending list of the real, quotable prices in the catalog (add-ons and quote-only items excluded). */
function sortedPrices(products: Product[]): number[] {
  return products
    .filter((product) => !product.isAddon && product.price != null)
    .map((product) => product.price as number)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
}

export function priceBounds(products: Product[]): { min: number | null; max: number | null } {
  const prices = sortedPrices(products);
  if (!prices.length) return { min: null, max: null };
  return { min: prices[0], max: prices[prices.length - 1] };
}

/** Round to a human-friendly boundary whose step scales with magnitude (…, 55→55, 118→120, 340→350). */
function niceRound(value: number): number {
  if (value <= 0) return 0;
  const step = value < 100 ? 5 : value < 500 ? 10 : value < 2000 ? 50 : 100;
  return Math.round(value / step) * step;
}

/** Linear-interpolated quantile of an ascending list. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

/**
 * Dynamic price buckets derived from the catalog's actual distribution — e.g.
 * "25 - 60 ETB", "60 - 120 ETB", "120 - 350 ETB", "Over 350 ETB". Boundaries sit
 * at the quartiles (rounded to friendly numbers) so the buckets stay balanced as
 * prices change, and the top bucket is open-ended.
 */
export function buildPriceBands(products: Product[]): PriceBand[] {
  const prices = sortedPrices(products);
  if (prices.length === 0) return [];

  const min = prices[0];
  const max = prices[prices.length - 1];
  if (min === max) return [{ id: 'band-0', label: formatEtb(min), test: (value) => value === min }];

  const distinct = [...new Set(prices)];
  const internalBreaks = Math.min(3, distinct.length - 1); // up to 3 cuts → up to 4 buckets
  const floor = niceRound(min);

  const boundaries: number[] = [floor];
  for (let i = 1; i <= internalBreaks; i += 1) {
    const cut = niceRound(quantile(prices, i / (internalBreaks + 1)));
    const prev = boundaries[boundaries.length - 1];
    if (cut > prev && cut < max) boundaries.push(cut);
  }

  return boundaries.map((low, index) => {
    const isLast = index === boundaries.length - 1;
    if (isLast) {
      return { id: `band-${index}`, label: `Over ${formatEtb(low)}`, test: (value: number) => value >= low };
    }
    const high = boundaries[index + 1];
    return {
      id: `band-${index}`,
      label: `${Math.round(low).toLocaleString()} - ${formatEtb(high)}`,
      test: (value: number) => value >= low && value < high,
    };
  });
}
