import { sellingPrice } from './selling-price.mjs';
import { corporatePrice } from './corporate-pricing.mjs';
import { normalizePriceTiers } from './tiered-pricing.mjs';

export function invalidPrice(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

export function validMargin(value) {
  return Number.isFinite(value) && value >= 0;
}

export function materialInput(body, existing) {
  const name = String(body.name || '').trim();
  if (!name) invalidPrice('Enter a material name.');
  const options = body.options ?? existing?.options ?? [];
  if (!Array.isArray(options)) invalidPrice('Enter a list of material options.');
  const ids = new Set();
  const names = new Set();
  const cleanOptions = options.map(option => {
    const id = option?.id;
    const label = String(option?.name || '').trim();
    if (typeof id !== 'string' || !id.trim() || ids.has(id) || !label || names.has(label.toLowerCase()))
      invalidPrice('Give each material option a unique name.');
    if (!Number.isFinite(option.unitCost) || option.unitCost <= 0) invalidPrice('Each option needs a positive unit cost.');
    ids.add(id);
    names.add(label.toLowerCase());
    return { id, name: label, unitCost: option.unitCost };
  });
  // Recipes using an existing plain material keep its original unit rate when options are added.
  const legacyUnitCost = cleanOptions.length ? existing?.legacyUnitCost ?? existing?.unitCost ?? null : null;
  const unitCost = cleanOptions.length ? null : body.unitCost;
  if (!cleanOptions.length && !(Number.isFinite(unitCost) && unitCost > 0))
    invalidPrice('Enter a positive unit cost.');
  return { name, unitCost, legacyUnitCost, options: cleanOptions };
}

const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Material cost of one unit from a product's saved recipe, with a line per
 * material. Uses the same rates `pricedProduct` uses to set the price
 * (including the legacy base rate for rows saved before a material had
 * options). Returns null when there is no recipe or a row no longer resolves,
 * so callers show "no cost yet" instead of a wrong number.
 */
export function recipeCost(product, inputs) {
  const rows = product?.cost?.items;
  if (!Array.isArray(rows) || !rows.length) return null;
  const lines = [];
  let total = 0;
  for (const row of rows) {
    const input = inputs.find((item) => item.id === row.inputId);
    const option = row.optionId ? input?.options?.find((item) => item.id === row.optionId) : null;
    const unitCost = row.optionId
      ? option?.unitCost
      : input?.options?.length ? input.legacyUnitCost ?? input.unitCost : input?.unitCost;
    const quantity = Number(row.quantity);
    if (!input || !(Number.isFinite(unitCost) && unitCost > 0) || !(Number.isFinite(quantity) && quantity > 0)) return null;
    total += unitCost * quantity;
    lines.push({
      inputId: input.id,
      name: option ? `${input.name} (${option.name})` : input.name,
      quantity,
      unitCost,
      lineCost: money(unitCost * quantity),
    });
  }
  return { unitCost: money(total), lines };
}

export function pricedProduct(product, inputs, previous = product) {
  const recipe = product.cost;
  let tiers = normalizePriceTiers(product.priceTiers);
  let price = product.price == null ? null : money(Number(product.price));
  const items = [];
  if (recipe) {
    if (recipe.adjustment !== undefined && !Number.isFinite(recipe.adjustment)) invalidPrice('Enter a finite ETB adjustment.');
    if (recipe.roundUp != null && (!Number.isFinite(recipe.roundUp) || recipe.roundUp <= 0)) invalidPrice('Enter a positive rounding increment or leave it blank.');
    if (!validMargin(recipe.margin))
      invalidPrice('Margin percentage must be a finite number of zero or more.');
    if (!Array.isArray(recipe.items) || !recipe.items.length) invalidPrice('Choose at least one cost input.');
    // Only rows already assigned this material without an option may retain its old rate.
    const baseRows = (previous?.cost?.items || []).filter(row => !row.optionId);
    let cost = 0;
    for (const item of recipe.items) {
      const input = inputs.find((row) => row.id === item.inputId);
      if (!input || !Number.isFinite(item.quantity) || item.quantity <= 0) invalidPrice('Each cost input needs a positive quantity.');
      let legacyBaseCost;
      if (input.options?.length && !item.optionId) {
        const index = baseRows.findIndex(row => row.inputId === input.id);
        if (index < 0) invalidPrice('Select a valid option for ' + input.name + '.');
        baseRows.splice(index, 1);
        legacyBaseCost = input.legacyUnitCost ?? input.unitCost;
      }
      const unitCost = item.optionId
        ? input.options?.find(option => option.id === item.optionId)?.unitCost
        : legacyBaseCost ?? input.unitCost;
      if (!(Number.isFinite(unitCost) && unitCost > 0)) invalidPrice('Select a valid option for ' + input.name + '.');
      items.push({ inputId: input.id, quantity: item.quantity, ...(item.optionId && { optionId: item.optionId }),
        ...(legacyBaseCost != null && { legacyBaseCost }) });
      cost += unitCost * item.quantity;
    }
    if (recipe.roundDirection !== undefined && !['up', 'down'].includes(recipe.roundDirection)) invalidPrice('Choose round up or round down.');
    if (recipe.corporatePricing && !corporatePrice(cost, recipe.margin, recipe.corporatePricing, recipe.adjustment, recipe.roundUp, recipe.roundDirection))
      invalidPrice('Enter valid corporate tax rates, adjustment, and a positive rounding multiple to the cent.');
    const calculatePrice = (margin, roundDirection = recipe.roundDirection, roundUp = recipe.roundUp) => recipe.corporatePricing
      ? corporatePrice(cost, margin, recipe.corporatePricing, recipe.adjustment, roundUp, roundDirection)?.unit ?? NaN
      : sellingPrice(cost, margin, recipe.adjustment, roundUp, roundDirection);
    price = calculatePrice(recipe.margin);
    const thresholds = recipe.thresholds ?? [];
    if (!Array.isArray(thresholds) || thresholds.some(t => !Number.isSafeInteger(t?.minQty) || t.minQty < 2
      || !validMargin(t.margin) || (t.roundDirection !== undefined && !['up', 'down'].includes(t.roundDirection))
      || (t.roundUp != null && (!Number.isFinite(t.roundUp) || t.roundUp <= 0)))
      || new Set(thresholds.map(t => t.minQty)).size !== thresholds.length)
      invalidPrice('Use distinct whole quantities above one, an allowed margin, and a positive rounding multiple or blank at each threshold.');
    tiers = thresholds.map(t => ({ minQty: t.minQty,
      priceEach: calculatePrice(t.margin, t.roundDirection ?? recipe.roundDirection, t.roundUp === undefined ? recipe.roundUp : t.roundUp) })).sort((a,b) => a.minQty - b.minQty);
    if (tiers.some(t => !Number.isFinite(t.priceEach) || t.priceEach <= 0)) invalidPrice('Every threshold must have a positive selling price.');
    if (!Number.isFinite(price) || price <= 0) invalidPrice('Calculated price must be at least 0.01 ETB.');
  } else if (product.pricingMode === 'tiered' && tiers[0]?.minQty === 1) {
    price = tiers[0].priceEach;
  }
  const breaks = tiers.filter((tier) => tier.minQty > 1);
  const priced = price > 0 && Number.isFinite(price);
  return { ...product,
    ...(recipe && { cost: { items, margin: recipe.margin, adjustment: recipe.adjustment ?? 0, roundUp: recipe.roundUp ?? null, roundDirection: recipe.roundDirection ?? 'up', thresholds: recipe.thresholds ?? [], ...(recipe.corporatePricing && { corporatePricing: recipe.corporatePricing }) } }),
    price: priced ? price : null, pricingMode: breaks.length && priced ? 'tiered' : 'exact',
    priceTiers: breaks.length && priced ? [{ minQty: 1, priceEach: price }, ...breaks] : [],
    ...(!priced && (!product.status || product.status === 'published') ? { status: 'draft' } : {}) };
}
