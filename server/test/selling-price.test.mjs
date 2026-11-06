import test from 'node:test';
import assert from 'node:assert/strict';
import { sellingPrice } from '../src/selling-price.mjs';
import { pricedProduct } from '../src/cost-pricing.mjs';
import { publicProduct } from '../src/product-model.mjs';
import { tieredLineTotal } from '../src/tiered-pricing.mjs';

test('adjustment and upward rounding follow margin and precede currency rounding', () => {
  assert.equal(sellingPrice(12, 20), 15);
  assert.equal(sellingPrice(12, 20, 2, 5), 20);
  assert.equal(sellingPrice(12, 20, -2, 5), 15);
  assert.equal(sellingPrice(12, 20, 0, 5), 15);
  assert.equal(sellingPrice(0.1 + 0.2, 0, 0, 0.1), 0.3);
  assert.equal(sellingPrice(0.300001, 0, 0, 0.1), 0.4);
  assert.equal(sellingPrice(8.004, 20, 0.001, 0.05), 10.05);
  assert.equal(sellingPrice(12, 20, 0, 2.5), 15);
  for (const args of [[12, 20, -15], [12, 20, -20, 5], [12, 20, Infinity], [12, 20, 0, 0], [12, 20, 0, -1], [12, 20, 0, Infinity]]) {
    assert.ok(Number.isNaN(sellingPrice(...args)));
  }
});

test('product and all-unit tiers retain adjustments across shared cost updates', () => {
  const product = { cost: { items: [{ inputId: 'paper', quantity: 0.5 }], margin: 20,
    adjustment: 2, roundUp: 5, thresholds: [{ minQty: 50, margin: 10 }] } };
  const priced = pricedProduct(product, [{ id: 'paper', unitCost: 24 }]);
  assert.equal(priced.price, 20);
  assert.equal(tieredLineTotal(priced.priceTiers, 49), 980);
  assert.equal(tieredLineTotal(priced.priceTiers, 50), 1000);
  assert.equal(pricedProduct(priced, [{ id: 'paper', unitCost: 30 }]).price, 25);
  assert.equal(publicProduct(priced).cost, undefined);
  assert.throws(() => pricedProduct({ cost: { ...product.cost, adjustment: -100 } }, [{ id: 'paper', unitCost: 24 }]), /positive|0.01/);
});
