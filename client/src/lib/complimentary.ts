import type { ComplimentaryCartItem, Product } from './types';

export const COMPLIMENTARY_MAX_MULTIPLIER = 2.5;

export function complimentaryLimit(mainQty: number): number {
  return Math.max(0, Math.floor((Number(mainQty) || 0) * COMPLIMENTARY_MAX_MULTIPLIER));
}

export function complimentaryForProduct(product: Product, mainQty: number): ComplimentaryCartItem[] {
  if (product.isAddon) return [];
  const limit = complimentaryLimit(mainQty);
  if (limit <= 0) return [];

  return (product.complimentaryItems || [])
    .filter((item) => item.enabled && item.name.trim() && item.qty > 0)
    .map((item) => ({
      name: item.name.trim(),
      qty: Math.min(Math.floor(item.qty), limit),
    }))
    .filter((item) => item.qty > 0);
}

export function complimentarySummary(items: ComplimentaryCartItem[] | undefined): string {
  const active = (items || []).filter((item) => item.qty > 0 && item.name.trim());
  if (!active.length) return '';
  return active.map((item) => `${item.qty.toLocaleString()} ${item.name}`).join(', ');
}
