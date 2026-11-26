import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeCost } from '../src/cost-pricing.mjs';
import { dashboardCatalog, draftProductFrom, requireIntegrationToken, requireIntegrationWrite, shopCostFromRecipe } from '../src/integration.mjs';

const inputs = [
  { id: 'paper', name: 'Paper', unitCost: 8 },
  { id: 'glass', name: 'Glass', unitCost: null, legacyUnitCost: 10, options: [{ id: 's', name: 'Small', unitCost: 12 }] },
];

test('recipe cost adds each material at its current rate', () => {
  const cost = recipeCost({ cost: { items: [
    { inputId: 'paper', quantity: 1.5 },
    { inputId: 'glass', optionId: 's', quantity: 0.5 },
    { inputId: 'glass', quantity: 1 },
  ] } }, inputs);
  assert.equal(cost.unitCost, 28);
  assert.deepEqual(cost.lines.map((l) => [l.name, l.lineCost]), [['Paper', 12], ['Glass (Small)', 6], ['Glass', 10]]);
});

test('no recipe or a broken row gives no cost rather than a wrong one', () => {
  assert.equal(recipeCost({ price: 50 }, inputs), null);
  assert.equal(recipeCost({ cost: { items: [{ inputId: 'gone', quantity: 1 }] } }, inputs), null);
});

test('catalog reports markup, hides deleted products and sorts by name', () => {
  const catalog = dashboardCatalog([
    { id: 'b', name: 'Velvet', price: 15, cost: { items: [{ inputId: 'paper', quantity: 1 }], margin: 25 }, photos: ['/uploads/v.jpg'] },
    { id: 'a', name: 'Acrylic', price: 90, status: 'draft' },
    { id: 'c', name: 'Old', price: 5, deletedAt: '2026-01-01' },
  ], inputs, new Date('2026-11-17T00:00:00Z'));
  assert.equal(catalog.generatedAt, '2026-11-17T00:00:00.000Z');
  assert.deepEqual(catalog.products.map((p) => p.id), ['a', 'b']);
  assert.equal(catalog.products[0].unitCost, null);
  assert.equal(catalog.products[0].status, 'draft');
  assert.equal(catalog.products[1].unitCost, 8);
  assert.equal(catalog.products[1].markupPercent, 25);
  assert.equal(catalog.products[1].photo, '/uploads/v.jpg');
  assert.deepEqual(catalog.products[1].recipe, {
    items: [{ inputId: 'paper', quantity: 1 }], markupPercent: 25, adjustment: 0, roundUp: null, roundDirection: 'up', thresholds: [],
  });
  assert.equal(catalog.products[0].recipe, null);
  const corporate = dashboardCatalog([{ id: 'q', name: 'Corp', price: 20, cost: {
    items: [{ inputId: 'paper', quantity: 1 }], margin: 25, corporatePricing: { incomeTaxRate: 35, dividendTaxRate: 15, vatRate: 15 },
  } }], inputs);
  assert.deepEqual(corporate.products[0].recipe.corporatePricing, { incomeTaxRate: 35, dividendTaxRate: 15, vatRate: 15 });
  assert.equal(catalog.products[1].recipe.corporatePricing, undefined);
  assert.deepEqual(catalog.materials.map((m) => [m.id, m.unitCost, m.legacyUnitCost, m.options.length]), [['glass', null, 10, 1], ['paper', 8, null, 0]]);
});

test('a dashboard recipe converts to the shop recipe and rejects lines the shop cannot price', () => {
  const recipe = {
    items: [{ inputId: 'paper', name: 'Paper', unitCost: 8, quantity: 2 }, { inputId: 'glass', optionId: 's', name: 'Glass (Small)', unitCost: 12, quantity: 1 }],
    markupPercent: 40, adjustment: 1, roundUp: 5, roundDirection: 'down',
    thresholds: [{ minQty: 100, markupPercent: 30 }], corporatePricing: { incomeTaxRate: 35, dividendTaxRate: 15, vatRate: 15 },
  };
  assert.deepEqual(shopCostFromRecipe(recipe, inputs), {
    items: [{ inputId: 'paper', quantity: 2 }, { inputId: 'glass', optionId: 's', quantity: 1 }],
    margin: 40, adjustment: 1, roundUp: 5, roundDirection: 'down', thresholds: [{ minQty: 100, margin: 30 }],
    corporatePricing: { incomeTaxRate: 35, dividendTaxRate: 15, vatRate: 15 },
  });
  assert.throws(() => shopCostFromRecipe({ ...recipe, items: [{ name: 'Ribbon', unitCost: 3, quantity: 1 }] }, inputs), /Ribbon.*materials list/);
  assert.throws(() => shopCostFromRecipe({ ...recipe, items: [{ inputId: 'glass', quantity: 1 }] }, inputs), /option for Glass/);
  assert.throws(() => shopCostFromRecipe({ ...recipe, items: [{ inputId: 'paper', quantity: 0 }] }, inputs), /positive quantity/);
});

test('dashboard recipes preserve per-threshold rounding settings', () => {
  const product = { id: 'rounded', name: 'Rounded', price: 130, cost: {
    items: [{ inputId: 'paper', quantity: 1 }], margin: 25, roundDirection: 'up', roundUp: 5,
    thresholds: [{ minQty: 10, margin: 13.7, roundDirection: 'down', roundUp: 10 },
      { minQty: 20, margin: 13.7, roundUp: null }],
  } };
  const recipe = dashboardCatalog([product], inputs).products[0].recipe;
  assert.equal(recipe.thresholds[0].roundDirection, 'down');
  assert.equal(recipe.thresholds[0].roundUp, 10);
  assert.equal(recipe.thresholds[1].roundUp, null);
  assert.deepEqual(shopCostFromRecipe(recipe, inputs).thresholds,
    [{ minQty: 10, margin: 13.7, roundDirection: 'down', roundUp: 10 },
      { minQty: 20, margin: 13.7, roundUp: null }]);
});

test('a new item from a variation is a draft that keeps the base details but none of its Telegram post', () => {
  const base = { id: 'b', name: 'Velvet', categoryId: 'c1', photos: ['/u/v.jpg'], status: 'published', price: 50, telegramMessageId: 9, telegramChannelId: '-100', contentVersion: 4 };
  const draft = draftProductFrom({ name: ' Velvet – foil ', base, cost: { items: [] }, actor: 'Bereket', variationId: 'v1' });
  assert.equal(draft.name, 'Velvet – foil');
  assert.equal(draft.status, 'draft');
  assert.equal(draft.categoryId, 'c1');
  assert.deepEqual(draft.photos, ['/u/v.jpg']);
  assert.equal(draft.telegramMessageId, undefined);
  assert.equal(draft.telegramChannelId, undefined);
  assert.equal(draft.price, undefined);
  assert.equal(draft.id, undefined);
  assert.equal(draft.createdFrom.baseProductId, 'b');
  assert.equal(draft.createdFrom.by, 'Bereket');
  assert.throws(() => draftProductFrom({ name: '  ', cost: {} }), /name/);
  const hidden = draftProductFrom({ name: 'Wax seal', cost: { items: [] }, hidden: true });
  assert.equal(hidden.status, 'archived');
  assert.equal(hidden.createdFrom.purpose, 'hidden-item');
});

test('dashboard writes need the token and the shop switch', () => {
  const token = 'y'.repeat(40);
  const run = (allow) => {
    process.env.DASHBOARD_INTEGRATION_TOKEN = token;
    process.env.DASHBOARD_INTEGRATION_ALLOW_WRITES = allow;
    let status = 200; let passed = false;
    requireIntegrationWrite({ get: () => `Bearer ${token}` }, { status(c) { status = c; return this; }, json() { return this; } }, () => { passed = true; });
    process.env.DASHBOARD_INTEGRATION_TOKEN = '';
    process.env.DASHBOARD_INTEGRATION_ALLOW_WRITES = '';
    return passed ? 'ok' : status;
  };
  assert.equal(run('true'), 'ok');
  assert.equal(run(''), 403);
});

function call(token, header) {
  const previous = process.env.DASHBOARD_INTEGRATION_TOKEN;
  process.env.DASHBOARD_INTEGRATION_TOKEN = token;
  let status = 200;
  let passed = false;
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  requireIntegrationToken({ get: () => header }, res, () => { passed = true; });
  process.env.DASHBOARD_INTEGRATION_TOKEN = previous ?? '';
  return passed ? 'ok' : status;
}

test('only the configured dashboard token can read costs', () => {
  const token = 'x'.repeat(40);
  assert.equal(call(token, `Bearer ${token}`), 'ok');
  assert.equal(call(token, 'Bearer wrong'), 401);
  assert.equal(call(token, ''), 401);
  assert.equal(call('short', 'Bearer short'), 503);
});
