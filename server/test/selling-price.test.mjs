import test from 'node:test';
import assert from 'node:assert/strict';
import { sellingPrice } from '../src/selling-price.mjs';
import { pricedProduct } from '../src/cost-pricing.mjs';
import { publicProduct } from '../src/product-model.mjs';
import { tieredLineTotal } from '../src/tiered-pricing.mjs';

test('adjustment and upward rounding follow margin and precede currency rounding', () => {
  assert.equal(sellingPrice(100, 25), 125);
  assert.equal(sellingPrice(100, 12.5), 112.5);
  assert.equal(sellingPrice(100, 100), 200);
  assert.equal(sellingPrice(100, 0), 100);
  assert.equal(sellingPrice(12, 20), 14.4);
  assert.equal(sellingPrice(12, 20, 2, 5), 20);
  assert.equal(sellingPrice(12, 20, -2, 5), 15);
  assert.equal(sellingPrice(12, 20, 0, 5), 15);
  assert.equal(sellingPrice(0.1 + 0.2, 0, 0, 0.1), 0.3);
  assert.equal(sellingPrice(0.300001, 0, 0, 0.1), 0.4);
  assert.equal(sellingPrice(8.004, 20, 0.001, 0.05), 9.65);
  assert.equal(sellingPrice(12, 20, 0, 2.5), 15);
  for (const args of [[12, 20, -15], [12, 20, -20, 5], [12, 20, Infinity], [12, 20, 0, 0], [12, 20, 0, -1], [12, 20, 0, Infinity]]) {
    assert.ok(Number.isNaN(sellingPrice(...args)));
  }
});

test('product and progressive tiers retain adjustments across shared cost updates', () => {
  const product = { cost: { items: [{ inputId: 'paper', quantity: 0.5 }], margin: 20,
    adjustment: 2, roundUp: 5, thresholds: [{ minQty: 50, margin: 10 }] } };
  const priced = pricedProduct(product, [{ id: 'paper', unitCost: 24 }]);
  assert.equal(priced.price, 20);
  assert.equal(tieredLineTotal(priced.priceTiers, 49), 980);
  assert.equal(tieredLineTotal(priced.priceTiers, 50), 1000);
  assert.equal(pricedProduct(priced, [{ id: 'paper', unitCost: 30 }]).price, 20);
  assert.equal(publicProduct(priced).cost, undefined);
  assert.throws(() => pricedProduct({ cost: { ...product.cost, adjustment: -100 } }, [{ id: 'paper', unitCost: 24 }]), /positive|0.01/);
});

 test('round down preserves boundaries and applies to custom margins and tiers', () => {
  assert.equal(sellingPrice(100, 27.75, 0, 5, 'down'), 125);
  assert.equal(sellingPrice(100, 25, 0, 5, 'down'), 125);
  assert.equal(sellingPrice(0.3, 0, 0, 0.1, 'down'), 0.3);
  assert.equal(sellingPrice(100, 27.75, -3, 5, 'down'), 120);
  assert.ok(Number.isNaN(sellingPrice(1, 0, 0, 5, 'down')));
  const cost = { items: [{ inputId: 'paper', quantity: 1 }], margin: 27.75,
    roundUp: 5, roundDirection: 'down', thresholds: [{ minQty: 50, margin: 13.7 }] };
  const result = pricedProduct({ cost }, [{ id: 'paper', unitCost: 100 }]);
  assert.equal(result.price, 125);
  assert.equal(result.cost.roundDirection, 'down');
  assert.equal(tieredLineTotal(result.priceTiers, 50), 6250);
  assert.throws(() => pricedProduct({ cost: { ...cost, roundDirection: 'invalid' } }, [{ id: 'paper', unitCost: 100 }]), /round up or round down/);
});
