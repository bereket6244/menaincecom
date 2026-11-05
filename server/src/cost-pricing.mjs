import { normalizePriceTiers } from './tiered-pricing.mjs';

export function invalidPrice(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function pricedProduct(product, inputs) {
  const recipe = product.cost;
  let tiers = normalizePriceTiers(product.priceTiers);
  let price = product.price == null ? null : money(Number(product.price));
  if (recipe) {
    if (![25, 10, 5].includes(recipe.margin))
      invalidPrice('Choose a margin of 25%, 10%, or 5%.');
    if (!Array.isArray(recipe.items) || !recipe.items.length) invalidPrice('Choose at least one cost input.');
    let cost = 0;
    for (const item of recipe.items) {
      const input = inputs.find((row) => row.id === item.inputId);
      if (!input || !Number.isFinite(item.quantity) || item.quantity <= 0) invalidPrice('Each cost input needs a positive quantity.');
      cost += input.unitCost * item.quantity;
    }
    const sellingPrice = margin => money(cost / (1 - margin / 100));
    price = sellingPrice(recipe.margin);
    const thresholds = recipe.thresholds ?? [];
    if (!Array.isArray(thresholds) || thresholds.some(t => !Number.isSafeInteger(t?.minQty) || t.minQty < 2
      || ![25, 10, 5].includes(t.margin)) || new Set(thresholds.map(t => t.minQty)).size !== thresholds.length)
      invalidPrice('Use distinct whole quantities above one and an allowed margin at each threshold.');
    tiers = thresholds.map(t => ({ minQty: t.minQty, priceEach: sellingPrice(t.margin) })).sort((a,b) => a.minQty - b.minQty);
    if (tiers.some(t => !Number.isFinite(t.priceEach) || t.priceEach <= 0)) invalidPrice('Every threshold must have a positive selling price.');
    if (!Number.isFinite(price) || price <= 0) invalidPrice('Calculated price must be at least 0.01 ETB.');
  } else if (product.pricingMode === 'tiered' && tiers[0]?.minQty === 1) {
    price = tiers[0].priceEach;
  }
  const breaks = tiers.filter((tier) => tier.minQty > 1);
  const priced = price > 0 && Number.isFinite(price);
  return { ...product,
    ...(recipe && { cost: { items: recipe.items, margin: recipe.margin, thresholds: recipe.thresholds ?? [] } }),
    price: priced ? price : null, pricingMode: breaks.length && priced ? 'tiered' : 'exact',
    priceTiers: breaks.length && priced ? [{ minQty: 1, priceEach: price }, ...breaks] : [],
    ...(!priced && (!product.status || product.status === 'published') ? { status: 'draft' } : {}) };
}
