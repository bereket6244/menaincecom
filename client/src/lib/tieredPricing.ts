export { normalizePriceTiers, tieredUnitPrice, tieredLineTotal } from '../../../server/src/tiered-pricing.mjs';

export function formatEtbAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
