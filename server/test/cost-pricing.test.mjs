import test from 'node:test';
import assert from 'node:assert/strict';
import { materialInput, pricedProduct } from '../src/cost-pricing.mjs';
import { tieredLineTotal } from '../src/tiered-pricing.mjs';
import { publicProduct } from '../src/product-model.mjs';

const inputs = [{ id: 'paper', unitCost: 8 }, { id: 'print', unitCost: 8 }];
const card = { price: 999, cost: {
  items: [{ inputId: 'paper', quantity: 1 }, { inputId: 'print', quantity: 0.5 }],
  margin: 25, thresholds: [{ minQty: 50, margin: 10 }],
} };

test('shared inputs and true margin produce exact all-unit prices', () => {
  const priced = pricedProduct(card, inputs);
  assert.equal(priced.price, 16);
  assert.equal(tieredLineTotal(priced.priceTiers, 49), 784);
  assert.equal(tieredLineTotal(priced.priceTiers, 50), 666.5);
  assert.equal(tieredLineTotal(priced.priceTiers, 51), 679.83);
  assert.equal(publicProduct(priced).cost, undefined);
  assert.equal(pricedProduct(card, [{ ...inputs[0], unitCost: 11 }, inputs[1]]).priceTiers[1].priceEach, 16.67);
  assert.throws(() => pricedProduct(card, []), /cost input/);
});

test('a previously saved tax rate has no effect on current prices or the returned recipe', () => {
  const oldCard = { ...card, price: 18.4, cost: { ...card.cost, tax: 15 } };
  assert.deepEqual(pricedProduct(oldCard, inputs), pricedProduct(card, inputs));
});

test('legacy amounts remain exact and missing prices are held for review', () => {
  assert.equal(pricedProduct({ price: 125, pricingMode: 'starting' }, []).pricingMode, 'exact');
  assert.equal(pricedProduct({ price: null, pricingMode: 'quote' }, []).status, 'draft');
  assert.equal(pricedProduct({ price: null, pricingMode: 'quote', status: 'archived' }, []).status, 'archived');
});

test('selected material option sets the product rate before margins and quantity breaks', () => {
  const medium = { id: 'm', name: 'Medium', unitCost: 24 };
  const glass = { id: 'glass', ...materialInput({ name: 'Glass', options: [
    { id: 's', name: 'Small', unitCost: 12 }, medium,
  ] }) };
  const product = { cost: { items: [{ inputId: glass.id, optionId: 'm', quantity: 0.5 }],
    margin: 20, thresholds: [{ minQty: 50, margin: 10 }] } };
  const priced = pricedProduct(product, [glass]);
  assert.equal(priced.price, 15);
  assert.equal(tieredLineTotal(priced.priceTiers, 49), 735);
  assert.equal(tieredLineTotal(priced.priceTiers, 50), 666.5);
  assert.equal(publicProduct(priced).cost, undefined);
  for (const optionId of [undefined, 'unknown']) {
    const cost = { ...product.cost, items: [{ inputId: glass.id, optionId, quantity: 1 }] };
    assert.throws(() => pricedProduct({ cost }, [glass]), /valid option/);
  }
  assert.throws(() => materialInput({ name: 'Glass', options: [medium] }, glass), /retained/);
});

test('adding options to a plain material preserves the base cost for existing recipes', () => {
  const paper = { ...inputs[0], name: 'Paper' };
  const updated = materialInput({ name: 'Paper', options: [{ id: 'p', name: 'Premium', unitCost: 18 }] }, paper);
  assert.equal(pricedProduct(card, [{ ...updated, id: paper.id }, inputs[1]]).price, 16);
});
