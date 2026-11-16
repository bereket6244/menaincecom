/** VAT-inclusive corporate unit price from a product's material cost. */
export function corporatePrice(cost, markup, rates, adjustment = 0, multiple = null, direction = 'up') {
  const { incomeTaxRate, dividendTaxRate, vatRate } = rates || {};
  const validRate = value => Number.isFinite(value) && value >= 0 && value <= 100;
  const cents = multiple == null ? null : Math.round(multiple * 100);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(markup) || markup < 0 || markup > 1000 ||
    !validRate(incomeTaxRate) || !validRate(dividendTaxRate) || !validRate(vatRate) || !Number.isFinite(adjustment) ||
    !['up', 'down'].includes(direction) || (multiple != null && (!Number.isFinite(multiple) || multiple <= 0 ||
      !Number.isSafeInteger(cents) || Math.abs(multiple * 100 - cents) > 1e-8))) return null;
  const profit = cost * markup / 100;
  const incomeTax = profit * incomeTaxRate / 100;
  const dividendTax = (profit - incomeTax) * dividendTaxRate / 100;
  const beforeVat = cost + profit + incomeTax + dividendTax + adjustment;
  const vat = beforeVat * vatRate / 100;
  const exactUnit = beforeVat + vat;
  const unit = cents == null ? Math.round((exactUnit + Number.EPSILON) * 100) / 100
    : (direction === 'up' ? Math.ceil(exactUnit * 100 / cents - 1e-9) : Math.floor(exactUnit * 100 / cents + 1e-9)) * cents / 100;
  if (!Number.isFinite(unit) || unit <= 0) return null;
  return { profit, incomeTax, dividendTax, beforeVat, vat, exactUnit, unit };
}
