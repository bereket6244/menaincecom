type PriceTier = { minQty: number; priceEach: number };
export function normalizePriceTiers(tiers: PriceTier[] | undefined): PriceTier[];
export function tieredUnitPrice(tiers: PriceTier[] | undefined, quantity: number): number | null;
export function tieredLineTotal(tiers: PriceTier[] | undefined, quantity: number): number | null;
