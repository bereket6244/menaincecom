export interface CorporateRates { incomeTaxRate: number; dividendTaxRate: number; vatRate: number }
export interface CorporatePriceResult { profit: number; incomeTax: number; dividendTax: number; beforeVat: number; vat: number; exactUnit: number; unit: number }
export function corporatePrice(cost: number, markup: number, rates: CorporateRates, adjustment?: number, multiple?: number | null, direction?: 'up' | 'down'): CorporatePriceResult | null;
