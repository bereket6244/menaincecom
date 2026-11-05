import test from 'node:test';
import assert from 'node:assert/strict';
import { pricedProduct } from '../src/cost-pricing.mjs';
import { tieredLineTotal } from '../src/tiered-pricing.mjs';
import { publicProduct } from '../src/product-model.mjs';

const inputs = [{ id: 'paper', unitCost: 8 }, { id: 'print', unitCost: 8 }];
const card = { price: 999, cost: {
  items: [{ inputId: 'paper', quantity: 1 }, { inputId: 'print', quantity: 0.5 }],
  margin: 25, tax: 15, thresholds: [{ minQty: 50, margin: 10 }],
} };

test('shared inputs, true margin and tax produce exact all-unit prices', () => {
  const priced = pricedProduct(card, inputs);
  assert.equal(priced.price, 18.4);
  assert.equal(tieredLineTotal(priced.priceTiers, 49), 901.6);
  assert.equal(tieredLineTotal(priced.priceTiers, 50), 766.5);
  assert.equal(tieredLineTotal(priced.priceTiers, 51), 781.83);
  assert.equal(publicProduct(priced).cost, undefined);
  assert.equal(pricedProduct(card, [{ ...inputs[0], unitCost: 11 }, inputs[1]]).priceTiers[1].priceEach, 19.17);
  assert.throws(() => pricedProduct(card, []), /cost input/);
});

test('legacy amounts remain exact and missing prices are held for review', () => {
  assert.equal(pricedProduct({ price: 125, pricingMode: 'starting' }, []).pricingMode, 'exact');
  assert.equal(pricedProduct({ price: null, pricingMode: 'quote' }, []).status, 'draft');
  assert.equal(pricedProduct({ price: null, pricingMode: 'quote', status: 'archived' }, []).status, 'archived');
});
