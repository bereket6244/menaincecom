import test from 'node:test';
import assert from 'node:assert/strict';
import { corporatePrice } from '../src/corporate-pricing.mjs';
import { pricedProduct } from '../src/cost-pricing.mjs';

const rates = { incomeTaxRate: 35, dividendTaxRate: 15, vatRate: 15 };

test('corporate product prices include tax estimates, VAT, and tier markup', () => {
  const product = { cost: { items: [{ inputId: 'paper', quantity: 1 }], margin: 40, corporatePricing: rates,
    thresholds: [{ minQty: 10, margin: 20 }] } };
  const priced = pricedProduct(product, [{ id: 'paper', unitCost: 100 }]);
  assert.equal(priced.price, 181.59);
  assert.equal(priced.priceTiers[1].priceEach, 148.29);
  assert.deepEqual(priced.cost.corporatePricing, rates);
});

test('corporate rounding follows direction and checks the cent precision', () => {
  assert.equal(corporatePrice(100, 40, rates, 0, 5, 'up').unit, 185);
  assert.equal(corporatePrice(100, 40, rates, 0, 5, 'down').unit, 180);
  assert.equal(corporatePrice(100, 40, rates, 0, 2.5, 'up').unit, 182.5);
  assert.equal(corporatePrice(100, 40, rates, 0, 0.001), null);
  assert.equal(corporatePrice(100, 40, { ...rates, vatRate: 101 }), null);
  const priced = pricedProduct({ cost: { items: [{ inputId: 'paper', quantity: 1 }], margin: 40,
    corporatePricing: rates, roundUp: 5, roundDirection: 'up',
    thresholds: [{ minQty: 10, margin: 40, roundDirection: 'down', roundUp: 10 },
      { minQty: 20, margin: 40, roundUp: null }] } }, [{ id: 'paper', unitCost: 100 }]);
  assert.deepEqual(priced.priceTiers.map(t => t.priceEach), [185, 180, 181.59]);
});
