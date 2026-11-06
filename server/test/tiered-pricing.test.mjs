import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePriceTiers, tieredUnitPrice, tieredLineTotal } from '../src/tiered-pricing.mjs';

test('rates above each threshold are blended across the entire line', () => {
  const tiers = [{ minQty: 1, priceEach: 100 }, { minQty: 10, priceEach: 80 }, { minQty: 20, priceEach: 60 }];
  assert.equal(tieredLineTotal(tiers, 9), 900);
  assert.equal(tieredLineTotal(tiers, 10), 1000);
  assert.equal(tieredLineTotal(tiers, 11), 1080);
  assert.equal(tieredUnitPrice(tiers, 11), 1080 / 11);
  assert.equal(tieredLineTotal(tiers, 20), 1800);
  assert.equal(tieredLineTotal(tiers, 21), 1860);
  assert.equal(tieredLineTotal(tiers, 25), 2100);
  assert.equal(tieredUnitPrice(tiers, 25), 84);
  for (const qty of [9, 10, 11, 20, 21, 25, 99999]) {
    assert.equal(Math.round(tieredUnitPrice(tiers, qty) * qty * 100) / 100, tieredLineTotal(tiers, qty));
  }
  const decimals = [{ minQty: 1, priceEach: 125.15 }, { minQty: 10, priceEach: 110.05 }];
  assert.equal(tieredLineTotal(decimals, 11), 1361.55);
  assert.equal(tieredLineTotal([{ minQty: 1, priceEach: 100 }], 11), 1100);
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
