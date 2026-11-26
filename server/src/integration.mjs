import crypto from 'node:crypto';
import { recipeCost } from './cost-pricing.mjs';
import { normalizeProductStatus } from './product-model.mjs';

/**
 * Server-to-server access for the operations dashboard. The dashboard sends
 * `Authorization: Bearer <DASHBOARD_INTEGRATION_TOKEN>`; nothing else can read
 * costs. With no token configured the endpoint is switched off.
 */
export function requireIntegrationToken(req, res, next) {
  const expected = process.env.DASHBOARD_INTEGRATION_TOKEN || '';
  if (expected.length < 32) {
    return res.status(503).json({ error: 'integration_disabled', message: 'Dashboard integration is not configured.' });
  }
  const header = String(req.get('authorization') || '');
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!supplied || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid integration token.' });
  }
  next();
}

/**
 * Writes (creating draft products, changing a product's recipe) need the same
 * token AND DASHBOARD_INTEGRATION_ALLOW_WRITES=true, so the cost feed can be
 * switched on without letting the dashboard change the shop.
 */
export function requireIntegrationWrite(req, res, next) {
  requireIntegrationToken(req, res, () => {
    if (process.env.DASHBOARD_INTEGRATION_ALLOW_WRITES !== 'true') {
      return res.status(403).json({ error: 'writes_disabled', message: 'The shop does not accept changes from the dashboard yet (DASHBOARD_INTEGRATION_ALLOW_WRITES).' });
    }
    next();
  });
}

const badRequest = (message) => { throw Object.assign(new Error(message), { status: 400 }); };

/**
 * A dashboard recipe as the shop stores it. Only shop materials can be saved:
 * a custom line typed in the dashboard has no shop material behind it.
 */
export function shopCostFromRecipe(recipe, inputs) {
  if (!recipe || !Array.isArray(recipe.items) || !recipe.items.length) badRequest('Add at least one material.');
  const items = recipe.items.map((item) => {
    if (!item?.inputId) badRequest(`"${item?.name || 'A custom item'}" isn't in the shop's materials list. Add it as a material in the shop first.`);
    const input = inputs.find((row) => row.id === item.inputId);
    if (!input) badRequest(`${item.name || 'A material'} no longer exists in the shop.`);
    if (item.optionId && !input.options?.some((option) => option.id === item.optionId)) badRequest(`Choose a current option for ${input.name}.`);
    if (input.options?.length && !item.optionId) badRequest(`Choose an option for ${input.name}.`);
    const quantity = Number(item.quantity);
    if (!(Number.isFinite(quantity) && quantity > 0)) badRequest(`Enter a positive quantity for ${input.name}.`);
    return { inputId: input.id, ...(item.optionId && { optionId: item.optionId }), quantity };
  });
  const cost = {
    items,
    margin: Number(recipe.markupPercent),
    adjustment: Number(recipe.adjustment) || 0,
    roundUp: recipe.roundUp == null ? null : Number(recipe.roundUp),
    roundDirection: recipe.roundDirection === 'down' ? 'down' : 'up',
    thresholds: (recipe.thresholds || []).map((t) => ({ minQty: Number(t.minQty), margin: Number(t.markupPercent),
      ...(t.roundDirection !== undefined && { roundDirection: t.roundDirection }),
      ...(t.roundUp !== undefined && { roundUp: t.roundUp == null ? null : Number(t.roundUp) }) })),
  };
  if (recipe.corporatePricing) {
    cost.corporatePricing = {
      incomeTaxRate: Number(recipe.corporatePricing.incomeTaxRate),
      dividendTaxRate: Number(recipe.corporatePricing.dividendTaxRate),
      vatRate: Number(recipe.corporatePricing.vatRate),
    };
  }
  return cost;
}

// Fields that identify a product's own Telegram post or history; never copied to a new item.
const NOT_COPIED = new Set([
  'id', 'createdAt', 'updatedAt', 'deletedAt', 'status', 'contentVersion', 'price', 'priceTiers', 'pricingMode', 'cost',
  'telegramChannelId', 'telegramMessageId', 'telegramMessageIds', 'telegramMediaGroupId', 'telegramSyncStatus',
  'telegramSyncError', 'telegramLastSyncedAt', 'telegramDeletedAt', 'telegramReconcileClaim', 'importAction',
]);

/**
 * A new unpublished product built from a base product (category, photos,
 * details) and a recipe. `hidden` makes it archived: priced in the shop but
 * never shown on the website or Telegram, for items sold only in person.
 * Otherwise it is a draft, waiting for an admin to publish it.
 */
export function draftProductFrom({ name, base, cost, actor, variationId, hidden = false }) {
  const cleanName = String(name || '').trim().slice(0, 120);
  if (!cleanName) badRequest('Enter a name for the new shop item.');
  const copied = Object.fromEntries(Object.entries(base || {}).filter(([key]) => !NOT_COPIED.has(key) && !key.startsWith('telegram')));
  return {
    ...copied,
    name: cleanName,
    status: hidden ? 'archived' : 'draft',
    cost,
    createdFrom: {
      source: 'dashboard',
      ...(hidden && { purpose: 'hidden-item' }),
      ...(base?.id && { baseProductId: base.id }),
      ...(variationId && { variationId: String(variationId).slice(0, 100) }),
      ...(actor && { by: String(actor).slice(0, 100) }),
      at: new Date().toISOString(),
    },
  };
}

/**
 * What the dashboard needs to price an order: the selling price (and quantity
 * breaks), the material cost of one unit and the markup the shop applied.
 * `markupPercent` is the shop's "margin" field: the percentage added on top of
 * cost (cost × (1 + markup/100)), not a share of the selling price.
 * Deleted products are left out; drafts and archived items stay so older
 * dashboard orders keep their link.
 */
export function dashboardCatalog(products, inputs, now = new Date()) {
  return {
    generatedAt: now.toISOString(),
    // The materials list, so the dashboard can build and adjust recipes with
    // the same rates the shop uses.
    materials: inputs
      .map((input) => ({
        id: input.id,
        name: input.name,
        unitCost: input.options?.length ? null : input.unitCost ?? null,
        legacyUnitCost: input.options?.length ? input.legacyUnitCost ?? input.unitCost ?? null : null,
        options: (input.options || []).map((option) => ({ id: option.id, name: option.name, unitCost: option.unitCost })),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    products: products
      .filter((product) => !product.deletedAt)
      .map((product) => {
        const cost = recipeCost(product, inputs);
        return {
          id: product.id,
          name: product.name,
          status: normalizeProductStatus(product.status),
          isAddon: !!product.isAddon,
          photo: product.photos?.[0] || '',
          pricingMode: product.pricingMode || 'exact',
          price: product.price ?? null,
          priceTiers: product.priceTiers || [],
          unitCost: cost?.unitCost ?? null,
          costLines: cost?.lines || [],
          markupPercent: product.cost && Number.isFinite(product.cost.margin) ? product.cost.margin : null,
          // The full recipe, as the shop's price calculator edits it. "margin"
          // in the shop is markup on cost, so it is named that way here.
          recipe: product.cost?.items?.length ? {
            items: product.cost.items.map((row) => ({
              inputId: row.inputId,
              ...(row.optionId && { optionId: row.optionId }),
              quantity: Number(row.quantity),
            })),
            markupPercent: Number(product.cost.margin) || 0,
            adjustment: Number(product.cost.adjustment) || 0,
            roundUp: product.cost.roundUp ?? null,
            roundDirection: product.cost.roundDirection === 'down' ? 'down' : 'up',
            thresholds: (product.cost.thresholds || []).map((t) => ({ minQty: t.minQty, markupPercent: t.margin,
              ...(t.roundDirection !== undefined && { roundDirection: t.roundDirection }),
              ...(t.roundUp !== undefined && { roundUp: t.roundUp }) })),
            // Corporate pricing adds estimated income and dividend tax, then VAT,
            // and rounds the VAT-inclusive price (see corporate-pricing.mjs).
            ...(product.cost.corporatePricing && { corporatePricing: {
              incomeTaxRate: Number(product.cost.corporatePricing.incomeTaxRate),
              dividendTaxRate: Number(product.cost.corporatePricing.dividendTaxRate),
              vatRate: Number(product.cost.corporatePricing.vatRate),
            } }),
          } : null,
          hasVatPricing: !!product.cost?.corporatePricing,
          updatedAt: product.updatedAt || null,
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
  };
}
