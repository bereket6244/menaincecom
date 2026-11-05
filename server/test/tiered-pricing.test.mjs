import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePriceTiers, tieredUnitPrice, tieredLineTotal } from '../src/tiered-pricing.mjs';

test('the qualifying rate applies to the entire line', () => {
  const tiers = [
    { minQty: 1, priceEach: 10 },
    { minQty: 11, priceEach: 9 },
    { minQty: 21, priceEach: 8 },
  ];

  assert.equal(tieredLineTotal(tiers, 10), 100);
  assert.equal(tieredLineTotal(tiers, 20), 180);
  assert.equal(tieredUnitPrice(tiers, 20), 9);
  assert.equal(tieredLineTotal(tiers, 25), 200);
  assert.equal(tieredUnitPrice(tiers, 25), 8);
});

test('tier normalization sorts ranges and keeps the last value for duplicate starts', () => {
  assert.deepEqual(normalizePriceTiers([
    { minQty: 11, priceEach: 9 },
    { minQty: 1, priceEach: 10 },
    { minQty: 11, priceEach: 8.5 },
    { minQty: 30, priceEach: 0 },
  ]), [
    { minQty: 1, priceEach: 10 },
    { minQty: 11, priceEach: 8.5 },
  ]);
});

test('tier calculation rejects a schedule that does not start at quantity one', () => {
  assert.equal(tieredLineTotal([{ minQty: 10, priceEach: 5 }], 20), null);
});
