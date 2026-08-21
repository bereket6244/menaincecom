import type { CartItem, Product } from './types';

export const DEFAULT_MAX_ORDER_QTY = 100000;

export function productMaxOrderQty(product: Pick<Product, 'maxOrderQty'> | null | undefined): number {
  const limit = Math.floor(Number(product?.maxOrderQty) || 0);
  return limit > 0 ? limit : DEFAULT_MAX_ORDER_QTY;
}

export function productLimitText(product: Pick<Product, 'maxOrderQty'> | Pick<CartItem, 'maxOrderQty'> | null | undefined): string {
  const limit = Math.floor(Number(product?.maxOrderQty) || 0);
  return limit > 0 ? `Limited quantity: only ${limit.toLocaleString()} available.` : '';
}

export function clampOrderQty(qty: number, product: Pick<Product, 'maxOrderQty'> | Pick<CartItem, 'maxOrderQty'> | null | undefined): number {
  return Math.min(productMaxOrderQty(product), Math.max(1, Math.floor(Number(qty)) || 1));
}
