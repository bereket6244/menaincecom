import { tieredLineTotal, tieredUnitPrice } from '../lib/tieredPricing';
import { useId, useState } from 'react';
import { SearchChoice } from './SearchChoice';
import { sellingPrice as calculateSellingPrice } from '../../../server/src/selling-price.mjs';
import { corporatePrice } from '../../../server/src/corporate-pricing.mjs';
import type { CostInput, Product } from '../lib/types';
import { useData } from '../lib/useData';

const displayAmount = (value: number) => Number.isFinite(value) ? value.toFixed(2) : 'Invalid';

type Draft = Omit<Product, 'id'> & { id?: string };

export function ProductCost({ product, change, standalone = false }: { product: Draft; change: (next: Draft) => void; standalone?: boolean }) {
  const marginList = useId();
  const [previewQty, setPreviewQty] = useState(standalone ? 1 : 11);
  const { data, loading, error, reload } = useData<CostInput[]>('/admin/cost-inputs');
  const { data: savedMargins } = useData<number[]>('/admin/cost-margins');
  const margins = savedMargins || [25, 10, 5];
  const inputs = data ?? [];
  const cost = product.cost;
  const breaks = (product.priceTiers || []).filter(t => t.minQty > 1);
  const subtotal = cost?.items.reduce((sum, row) => {
    const input = inputs.find(i => i.id === row.inputId);
    const rate = row.optionId ? input?.options?.find(o => o.id === row.optionId)?.unitCost : input?.options?.length ? row.legacyBaseCost : input?.unitCost;
    return sum + (Number.isFinite(rate) && (rate ?? 0) > 0 && Number.isFinite(row.quantity) && row.quantity > 0 ? rate! * row.quantity : NaN);
  }, 0) ?? 0;
  const corporate = cost?.corporatePricing;
  const corporateResult = (margin: number, direction = cost?.roundDirection, multiple = cost?.roundUp) => corporate ? corporatePrice(subtotal, margin, corporate, cost?.adjustment, multiple, direction) : null;
  const sellingPrice = (margin: number, direction = cost?.roundDirection, multiple = cost?.roundUp) => corporate ? corporateResult(margin, direction, multiple)?.unit ?? NaN : calculateSellingPrice(subtotal, margin, cost?.adjustment, multiple, direction);
  const profitPerItem = (margin: number, direction = cost?.roundDirection, multiple = cost?.roundUp) => Math.round((sellingPrice(margin, direction, multiple) - subtotal + Number.EPSILON) * 100) / 100;
  const price = cost ? sellingPrice(cost.margin) : product.price;
  const thresholds = cost?.thresholds || [];
  const costBreaks = thresholds.map(t => ({ ...t, priceEach: sellingPrice(t.margin, t.roundDirection ?? cost?.roundDirection, t.roundUp === undefined ? cost?.roundUp : t.roundUp) }));
  const previewTiers = [{ minQty: 1, priceEach: price ?? 0 }, ...(cost ? costBreaks : breaks)];
  const previewValid = previewTiers.every(t => Number.isFinite(t.priceEach) && t.priceEach > 0 && Number.isSafeInteger(t.minQty) && t.minQty > 0)
    && new Set(previewTiers.map(t => t.minQty)).size === previewTiers.length;
  const previewTotal = previewValid ? tieredLineTotal(previewTiers, previewQty) : null;
  const previewEach = previewValid ? tieredUnitPrice(previewTiers, previewQty) : null;
  const setThresholds = (rows: typeof thresholds) => cost && change({ ...product, cost: { ...cost, thresholds: rows } });
  const updateBreaks = (rows: typeof breaks) => change({ ...product, pricingMode: rows.length ? 'tiered' : 'exact', priceTiers: rows });
  function addThreshold() {
    if (cost) {
      const minQty = thresholds.length ? Math.max(...thresholds.map(t => t.minQty)) + 1 : 50;
      setThresholds([...thresholds, { minQty, margin: 10, roundDirection: cost.roundDirection ?? 'up', roundUp: cost.roundUp ?? null }]);
    } else {
      const minQty = breaks.length ? Math.max(...breaks.map(t => t.minQty)) + 1 : 50;
      updateBreaks([...breaks, { minQty, priceEach: price || 0 }]);
    }
  }

  return <>
    {!standalone && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge bg-surface p-4 text-sm">
      <input className="mt-0.5 h-4 w-4 shrink-0 accent-pink" type="checkbox" checked={!!corporate}
        onChange={e => change({ ...product, cost: { ...(cost ?? { items: [], margin: 25 }), corporatePricing: e.target.checked ? { incomeTaxRate: 35, dividendTaxRate: 15, vatRate: 15 } : undefined } })} />
      <span><strong className="block">Use corporate pricing</strong><span className="block text-xs text-muted">Include estimated income tax, dividend tax, and VAT in this product's calculated selling price.</span></span>
    </label>}
    <section className="space-y-3 rounded-xl border border-edge bg-surface2 p-4">
    <h3 className="font-bold">Cost</h3>
    {loading && <p role="status" className="text-xs text-muted">Loading materials...</p>}
    {error && <p role="alert" className="text-sm">{error} <button type="button" className="underline" onClick={reload}>Retry</button></p>}
    {!loading && !error && inputs.length === 0 && <p className="text-xs text-muted">Add materials in the Materials tab to calculate input costs.</p>}
    {!standalone && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!cost}
      onChange={e => change({ ...product, price, priceTiers: cost ? costBreaks : [], cost: e.target.checked ? { items: [], margin: 25 } : null })} />
      Calculate selling price from input costs</label>}
    {cost && <>
      {cost.items.map((row, index) => {
        const material = inputs.find(i => i.id === row.inputId);
        const update = (patch: Partial<typeof row>) => change({ ...product, cost: { ...cost, items: cost.items.map((item, i) => i === index ? { ...item, ...patch } : item) } });
        return <div key={index} className={`grid items-end gap-2 ${material?.options?.length ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_2rem]' : 'grid-cols-[minmax(0,1fr)_4.5rem_2rem]'}`}>
          <SearchChoice autoFocus={!row.inputId} label="Material" value={row.inputId} options={inputs.map(i => ({ value: i.id, label: i.name + (i.options?.length ? '' : ` (${i.unitCost} ETB)`) }))}
            onChange={inputId => update({ inputId, optionId: undefined, legacyBaseCost: undefined })} />
          {!!material?.options?.length && <SearchChoice autoFocus={!row.optionId && row.legacyBaseCost == null} label="Option" value={row.optionId || ''}
            placeholder={row.legacyBaseCost == null ? 'Search options' : `Previous rate (${row.legacyBaseCost} ETB)`}
            options={material.options.map(o => ({ value: o.id, label: `${o.name} (${o.unitCost} ETB)` }))}
            onChange={optionId => update({ optionId, legacyBaseCost: undefined })} />}
          <label className="min-w-0">Quantity<input className="field" type="number" min="0" step="any" value={row.quantity || ''} onChange={e => update({ quantity: Number(e.target.value) })} /></label>
          <button type="button" className="h-9" aria-label={`Remove material ${index + 1}`} onClick={() => change({ ...product, cost: { ...cost, items: cost.items.filter((_, i) => i !== index) } })}>&times;</button>
        </div>;
      })}
      <button type="button" onClick={() => change({ ...product, cost: { ...cost, items: [...cost.items, { inputId: '', quantity: 1 }] } })}>{standalone ? '+ Add material' : '+ Add input to product'}</button>
      <div className="grid grid-cols-2 gap-2">
        <label>{corporate ? 'Markup on cost (%)' : 'Margin (%)'}<input className="field" type="number" min="0" step="any" list={marginList} value={Number.isFinite(cost.margin) ? cost.margin : ''} placeholder="Choose or type percentage" onChange={e => change({ ...product, cost: { ...cost, margin: e.target.value === '' ? NaN : Number(e.target.value) } })} /></label>
      </div>
      <datalist id={marginList}>{margins.map(n => <option key={n} value={n}>{n}%</option>)}</datalist>
      <p className="text-xs text-muted">{corporate ? 'Target markup is a percentage of material cost. Tax estimates and VAT are added to the price.' : 'Price after margin = input cost + (input cost x selected percentage).'}</p>
      {corporate && <div className="grid gap-2 rounded-lg border border-edge bg-surface p-3 sm:grid-cols-3">
        {([['incomeTaxRate', 'Income tax (%)'], ['dividendTaxRate', 'Dividend tax (%)'], ['vatRate', 'VAT (%)']] as const).map(([field, label]) =>
          <label key={field}>{label}<input className="field" type="number" min="0" max="100" step="any" value={Number.isFinite(corporate[field]) ? corporate[field] : ''}
            onChange={e => change({ ...product, cost: { ...cost, corporatePricing: { ...corporate, [field]: e.target.value === '' ? NaN : Number(e.target.value) } } })} /></label>)}
        <p className="text-xs text-muted sm:col-span-3">Defaults match the corporate calculator. Dividend tax is estimated on profit after income tax.</p>
      </div>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Adjustment per item (ETB)<input className="field" type="number" step="any" value={cost.adjustment ?? 0}
          onChange={e => change({ ...product, cost: { ...cost, adjustment: Number(e.target.value) } })} /></label>
        <label>Rounding<select className="field" value={cost.roundDirection || 'up'} onChange={e => change({ ...product, cost: { ...cost, roundDirection: e.target.value as 'up' | 'down' } })}><option value="up">Round up</option><option value="down">Round down</option></select></label>
        <label>Base round to multiple (ETB)<input className="field" type="number" step={corporate ? '0.01' : 'any'} min={corporate ? '0.01' : '0'} placeholder="Off"
          value={cost.roundUp ?? ''} onChange={e => change({ ...product, cost: { ...cost, roundUp: e.target.value === '' ? null : Number(e.target.value) } })} /></label>
      </div>
      <p className="text-xs text-muted">{corporate ? 'Adjustment changes the price before VAT. Rounding applies to the VAT-inclusive unit price. Each threshold can set its own direction and positive multiple to the cent; leave a multiple blank to turn rounding off.' : 'Positive adjustment adds birr; negative subtracts. Margin, then adjustment, then selected rounding, then two decimals. Each threshold can set its own direction and multiple; leave a multiple blank to turn rounding off.'}</p>
      {(!Number.isFinite(price) || costBreaks.some(t => !Number.isFinite(t.priceEach))) && <p role="alert" className="text-sm">Enter valid amounts that give a positive selling price for every tier.</p>}
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <span>Input cost per item (ETB)<br /><strong>{displayAmount(subtotal)}</strong></span>
        <span>Selling price per item (ETB)<br /><strong>{displayAmount(sellingPrice(cost.margin))}</strong></span>
        <span>{corporate ? 'Target markup per item (ETB)' : 'Profit per item (ETB)'}<br /><strong>{displayAmount(corporate ? corporateResult(cost.margin)?.profit ?? NaN : profitPerItem(cost.margin))}</strong></span>
      </div>
      {corporate && corporateResult(cost.margin) && <div className="grid grid-cols-2 gap-2 border-t border-edge pt-3 text-xs sm:grid-cols-4">
        <span>Income tax estimate<br /><strong>{displayAmount(corporateResult(cost.margin)!.incomeTax)} ETB</strong></span>
        <span>Dividend tax estimate<br /><strong>{displayAmount(corporateResult(cost.margin)!.dividendTax)} ETB</strong></span>
        <span>Price before VAT<br /><strong>{displayAmount(corporateResult(cost.margin)!.beforeVat)} ETB</strong></span>
        <span>VAT<br /><strong>{displayAmount(corporateResult(cost.margin)!.vat)} ETB</strong></span>
      </div>}
    </>}
    {!cost && <label className="block">Exact selling price (ETB)<input className="field" type="number" min="0.01" step=".01" value={product.price ?? ''} onChange={e => change({ ...product, price: e.target.value === '' ? null : Number(e.target.value) })} /></label>}
    <h4 className="font-semibold">Quantity pricing</h4>
    <p className="text-xs">The new rate applies only to items above the threshold. The total is divided equally across all items of this product.</p>
    {!cost && breaks.map((tier, index) => {
      const update = (patch: Partial<typeof tier>) => updateBreaks(breaks.map((t, i) => i === index ? { ...t, ...patch } : t));
      return <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label>Above quantity<input type="number" min="2" className="field" value={tier.minQty || ''} onChange={e => update({ minQty: Number(e.target.value) })} /></label>
        <label>ETB each<input type="number" min=".01" step=".01" className="field" value={tier.priceEach || ''} onChange={e => update({ priceEach: Number(e.target.value) })} /></label>
        <button type="button" onClick={() => updateBreaks(breaks.filter((_, i) => i !== index)) } aria-label="Remove quantity threshold">&times;</button>
      </div>;
    })}
    {cost && thresholds.map((tier, index) => {
      const update = (patch: Partial<typeof tier>) => setThresholds(thresholds.map((t, i) => i === index ? { ...t, ...patch } : t));

      const direction = tier.roundDirection ?? cost.roundDirection ?? 'up';
      const multiple = tier.roundUp === undefined ? cost.roundUp : tier.roundUp;
      return <div key={index} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-edge bg-surface p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <label>Above quantity<input type="number" min="2" className="field" value={tier.minQty || ''} onChange={e => update({ minQty: Number(e.target.value) })} /></label>
        <label>{corporate ? 'Tier markup (%)' : 'Tier margin (%)'}<input className="field" type="number" min="0" step="any" list={marginList} value={Number.isFinite(tier.margin) ? tier.margin : ''} placeholder="Choose or type percentage" onChange={e => update({ margin: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        <label>Rounding<select className="field" aria-label={`Rounding above quantity ${tier.minQty}`} value={direction} onChange={e => update({ roundDirection: e.target.value as 'up' | 'down' })}><option value="up">Round up</option><option value="down">Round down</option></select></label>
        <label>Round to multiple (ETB)<input className="field" type="number" step={corporate ? '0.01' : 'any'} min={corporate ? '0.01' : '0'} placeholder="Off"
          value={multiple ?? ''} onChange={e => update({ roundUp: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <button type="button" className="col-span-2 justify-self-end sm:col-span-1" onClick={() => setThresholds(thresholds.filter((_, i) => i !== index)) } aria-label="Remove quantity threshold">&times;</button>
        <p className="col-span-2 text-xs sm:col-span-5">Rate for items above {tier.minQty}: <strong>{displayAmount(sellingPrice(tier.margin, direction, multiple))} ETB</strong>. {corporate ? 'Target markup' : 'Profit'} on those items (ETB) <strong>{displayAmount(corporate ? corporateResult(tier.margin, direction, multiple)?.profit ?? NaN : profitPerItem(tier.margin, direction, multiple))}</strong></p>
        {previewValid && tier.minQty > 1 && <p className="col-span-2 text-xs sm:col-span-5">At {tier.minQty} items: {displayAmount(tieredLineTotal(previewTiers, tier.minQty) ?? NaN)} ETB total. At {tier.minQty + 1} items: {displayAmount(tieredLineTotal(previewTiers, tier.minQty + 1) ?? NaN)} ETB total, averaging {displayAmount(tieredUnitPrice(previewTiers, tier.minQty + 1) ?? NaN)} ETB each.</p>}
      </div>;
    })}
    <button type="button" onClick={addThreshold}>+ Add quantity threshold</button>
    <div className="space-y-2 rounded border border-edge p-3" aria-live="polite">
      <label>{standalone ? 'Requested quantity' : 'Preview order quantity'}<input className="field" type="number" min="1" step="1" value={previewQty || ''} onChange={e => setPreviewQty(Number(e.target.value))} /></label>
      {previewQty > 0 && Number.isSafeInteger(previewQty) && <p className="text-sm">Total: <strong>{displayAmount(previewTotal ?? NaN)} ETB</strong> &middot; Average per item: <strong>{displayAmount(previewEach ?? NaN)} ETB</strong>{cost && !corporate && <> &middot; Average profit per item: <strong>{displayAmount((previewEach ?? NaN) - subtotal)} ETB</strong></>}</p>}
      <p className="text-xs text-muted">Average prices are displayed to two decimals. The total uses the exact quantity breakdown.</p>
    </div>
  </section></>;
}
