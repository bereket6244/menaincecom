import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePriceTiers, tieredAveragePrice, tieredLineTotal } from '../src/tiered-pricing.mjs';

test('progressive tiers charge only the units inside each quantity range', () => {
  const tiers = [
    { minQty: 1, priceEach: 10 },
    { minQty: 11, priceEach: 9 },
    { minQty: 21, priceEach: 8 },
  ];

  assert.equal(tieredLineTotal(tiers, 10), 100);
  assert.equal(tieredLineTotal(tiers, 20), 190);
  assert.equal(tieredAveragePrice(tiers, 20), 9.5);
  assert.equal(tieredLineTotal(tiers, 25), 230);
  assert.equal(tieredAveragePrice(tiers, 25), 9.2);
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
