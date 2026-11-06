import { tieredLineTotal, tieredUnitPrice } from '../lib/tieredPricing';
import { useId, useState } from 'react';
import { SearchChoice } from './SearchChoice';
import { sellingPrice as calculateSellingPrice } from '../../../server/src/selling-price.mjs';
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
  const inputs = data || [];
  const cost = product.cost;
  const breaks = (product.priceTiers || []).filter(t => t.minQty > 1);
  const subtotal = cost?.items.reduce((sum, row) => {
    const input = inputs.find(i => i.id === row.inputId);
    const rate = row.optionId ? input?.options?.find(o => o.id === row.optionId)?.unitCost : input?.options?.length ? row.legacyBaseCost : input?.unitCost;
    return sum + (Number.isFinite(rate) && (rate ?? 0) > 0 && Number.isFinite(row.quantity) && row.quantity > 0 ? rate! * row.quantity : NaN);
  }, 0) ?? 0;
  const sellingPrice = (margin: number) => calculateSellingPrice(subtotal, margin, cost?.adjustment, cost?.roundUp, cost?.roundDirection);
  const profitPerItem = (margin: number) => Math.round((sellingPrice(margin) - subtotal + Number.EPSILON) * 100) / 100;
  const price = cost ? sellingPrice(cost.margin) : product.price;
  const thresholds = cost?.thresholds || [];
  const costBreaks = thresholds.map(t => ({ ...t, priceEach: sellingPrice(t.margin) }));
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
      setThresholds([...thresholds, { minQty, margin: 10 }]);
    } else {
      const minQty = breaks.length ? Math.max(...breaks.map(t => t.minQty)) + 1 : 50;
      updateBreaks([...breaks, { minQty, priceEach: price || 0 }]);
    }
  }

  return <section className="space-y-3 rounded-xl border border-edge bg-surface2 p-4">
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
        <label>Margin (%)<input className="field" type="number" min="0" step="any" list={marginList} value={Number.isFinite(cost.margin) ? cost.margin : ''} placeholder="Choose or type percentage" onChange={e => change({ ...product, cost: { ...cost, margin: e.target.value === '' ? NaN : Number(e.target.value) } })} /></label>
      </div>
      <datalist id={marginList}>{margins.map(n => <option key={n} value={n}>{n}%</option>)}</datalist>
      <p className="text-xs text-muted">Price after margin = input cost + (input cost x selected percentage).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Adjustment per item (ETB)<input className="field" type="number" step="any" value={cost.adjustment ?? 0}
          onChange={e => change({ ...product, cost: { ...cost, adjustment: Number(e.target.value) } })} /></label>
        <label>Rounding<select className="field" value={cost.roundDirection || 'up'} onChange={e => change({ ...product, cost: { ...cost, roundDirection: e.target.value as 'up' | 'down' } })}><option value="up">Round up</option><option value="down">Round down</option></select></label>
        <label>Round to multiple (ETB)<input className="field" type="number" step="any" min="0" placeholder="Off"
          value={cost.roundUp ?? ''} onChange={e => change({ ...product, cost: { ...cost, roundUp: e.target.value === '' ? null : Number(e.target.value) } })} /></label>
      </div>
      <p className="text-xs text-muted">Positive adjustment adds birr; negative subtracts. Margin, then adjustment, then selected rounding, then two decimals. Leave the rounding multiple blank to turn it off. Applies to every quantity tier.</p>
      {(!Number.isFinite(price) || costBreaks.some(t => !Number.isFinite(t.priceEach))) && <p role="alert" className="text-sm">Enter valid amounts that give a positive selling price for every tier.</p>}
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <span>Input cost per item (ETB)<br /><strong>{displayAmount(subtotal)}</strong></span>
        <span>Selling price per item (ETB)<br /><strong>{displayAmount(sellingPrice(cost.margin))}</strong></span>
        <span>Profit per item (ETB)<br /><strong>{displayAmount(profitPerItem(cost.margin))}</strong></span>
      </div>
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

      return <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label>Above quantity<input type="number" min="2" className="field" value={tier.minQty || ''} onChange={e => update({ minQty: Number(e.target.value) })} /></label>
        <label>Tier margin (%)<input className="field" type="number" min="0" step="any" list={marginList} value={Number.isFinite(tier.margin) ? tier.margin : ''} placeholder="Choose or type percentage" onChange={e => update({ margin: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        <button type="button" onClick={() => setThresholds(thresholds.filter((_, i) => i !== index)) } aria-label="Remove quantity threshold">&times;</button>
        <p className="col-span-3 text-xs">Rate for items above {tier.minQty}: <strong>{displayAmount(sellingPrice(tier.margin))} ETB</strong>. Profit on those items (ETB) <strong>{displayAmount(profitPerItem(tier.margin))}</strong></p>
        {previewValid && tier.minQty > 1 && <p className="col-span-3 text-xs">At {tier.minQty} items: {displayAmount(tieredLineTotal(previewTiers, tier.minQty) ?? NaN)} ETB total. At {tier.minQty + 1} items: {displayAmount(tieredLineTotal(previewTiers, tier.minQty + 1) ?? NaN)} ETB total, averaging {displayAmount(tieredUnitPrice(previewTiers, tier.minQty + 1) ?? NaN)} ETB each.</p>}
      </div>;
    })}
    <button type="button" onClick={addThreshold}>+ Add quantity threshold</button>
    <div className="space-y-2 rounded border border-edge p-3" aria-live="polite">
      <label>{standalone ? 'Requested quantity' : 'Preview order quantity'}<input className="field" type="number" min="1" step="1" value={previewQty || ''} onChange={e => setPreviewQty(Number(e.target.value))} /></label>
      {previewQty > 0 && Number.isSafeInteger(previewQty) && <p className="text-sm">Total: <strong>{displayAmount(previewTotal ?? NaN)} ETB</strong> &middot; Average per item: <strong>{displayAmount(previewEach ?? NaN)} ETB</strong>{cost && <> &middot; Average profit per item: <strong>{displayAmount((previewEach ?? NaN) - subtotal)} ETB</strong></>}</p>}
      <p className="text-xs text-muted">Average prices are displayed to two decimals. The total uses the exact quantity breakdown.</p>
    </div>
  </section>;
}
