import type { ComplimentaryCartItem, Product } from './types';

export const COMPLIMENTARY_MAX_MULTIPLIER = 2.5;
export const COMPLIMENTARY_EXTRA_MAX_QTY = 100000;

export function complimentaryLimit(mainQty: number): number {
  return Math.max(0, Math.floor((Number(mainQty) || 0) * COMPLIMENTARY_MAX_MULTIPLIER));
}

export type ComplimentarySelections = Record<string, number>;

function clampSelected(value: number | undefined, maxQty: number): number {
  if (value == null) return maxQty;
  return Math.min(maxQty, Math.max(0, Math.floor(Number(value) || 0)));
}

export function complimentaryForProduct(
  product: Product,
  mainQty: number,
  selections?: ComplimentarySelections
): ComplimentaryCartItem[] {
  if (product.isAddon) return [];
  const limit = complimentaryLimit(mainQty);
  if (limit <= 0) return [];

  return (product.complimentaryItems || [])
    .filter((item) => item.enabled && item.name.trim() && item.qty > 0)
    .map((item) => {
      const rawQty = item.type === 'multiplier'
        ? Math.floor((Number(mainQty) || 0) * Number(item.qty))
        : Math.floor(Number(item.qty) || 0);
      const freeQty = Math.min(rawQty, limit);
      const selectedQty = selections ? clampSelected(selections[item.name.trim()], COMPLIMENTARY_EXTRA_MAX_QTY) : 0;
      const extraQty = Math.max(0, selectedQty - freeQty);
      const extraPriceEach = item.extraPriceEach == null ? null : Math.max(0, Number(item.extraPriceEach) || 0);
      return {
        name: item.name.trim(),
        qty: selectedQty,
        maxQty: freeQty,
        freeQty,
        extraQty,
        extraPriceEach,
        extraTotal: extraPriceEach != null ? extraQty * extraPriceEach : 0,
      };
    })
    .filter((item) => (item.freeQty || 0) > 0 || item.qty > 0);
}

export function complimentarySummary(items: ComplimentaryCartItem[] | undefined): string {
  const active = (items || []).filter((item) => item.qty > 0 && item.name.trim());
  if (!active.length) return '';
  return active.map((item) => `${item.qty.toLocaleString()} ${item.name}`).join(', ');
}

export function complimentaryExtraTotal(items: ComplimentaryCartItem[] | undefined): number {
  return (items || []).reduce((sum, item) => sum + (item.extraTotal || 0), 0);
}

export function complimentaryAllowanceText(item: ComplimentaryCartItem): string {
  const freeQty = item.freeQty ?? item.maxQty ?? 0;
  const price = item.extraPriceEach ?? 0;
  return `Up to ${freeQty.toLocaleString()} complimentary. Anything above that is ${price.toLocaleString()} ETB each.`;
}
