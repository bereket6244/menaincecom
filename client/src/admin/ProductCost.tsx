import { useId } from 'react';
import { SearchChoice } from './SearchChoice';
import { sellingPrice as calculateSellingPrice } from '../../../server/src/selling-price.mjs';
import type { CostInput, Product } from '../lib/types';
import { useData } from '../lib/useData';

const displayAmount = (value: number) => Number.isFinite(value) ? value.toFixed(2) : 'Invalid';

type Draft = Omit<Product, 'id'> & { id?: string };

export function ProductCost({ product, change }: { product: Draft; change: (next: Draft) => void }) {
  const marginList = useId();
  const { data } = useData<CostInput[]>('/admin/cost-inputs');
  const { data: savedMargins } = useData<number[]>('/admin/cost-margins');
  const margins = savedMargins || [25, 10, 5];
  const inputs = data || [];
  const cost = product.cost;
  const breaks = product.priceTiers || [];
  const subtotal = cost?.items.reduce((sum, row) => {
    const input = inputs.find(i => i.id === row.inputId);
    const rate = row.optionId ? input?.options?.find(o => o.id === row.optionId)?.unitCost : input?.options?.length ? row.legacyBaseCost : input?.unitCost;
    return sum + (rate ?? 0) * row.quantity;
  }, 0) || 0;
  const sellingPrice = (margin: number) => calculateSellingPrice(subtotal, margin, cost?.adjustment, cost?.roundUp, cost?.roundDirection);
  const profitPerItem = (margin: number) => Math.round((sellingPrice(margin) - subtotal + Number.EPSILON) * 100) / 100;
  const price = cost ? sellingPrice(cost.margin) : product.price;
  const thresholds = cost?.thresholds || [];
  const costBreaks = thresholds.map(t => ({ ...t, priceEach: sellingPrice(t.margin) }));
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
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!cost}
      onChange={e => change({ ...product, price, priceTiers: cost ? costBreaks : [], cost: e.target.checked ? { items: [], margin: 25 } : null })} />
      Calculate selling price from input costs</label>
    {cost && <>
      {cost.items.map((row, index) => {
        const material = inputs.find(i => i.id === row.inputId);
        const update = (patch: Partial<typeof row>) => change({ ...product, cost: { ...cost, items: cost.items.map((item, i) => i === index ? { ...item, ...patch } : item) } });
        return <div key={index} className={`grid items-end gap-2 ${material?.options?.length ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_2rem]' : 'grid-cols-[minmax(0,1fr)_4.5rem_2rem]'}`}>
          <SearchChoice label="Material" value={row.inputId} options={inputs.map(i => ({ value: i.id, label: i.name + (i.options?.length ? '' : ` (${i.unitCost} ETB)`) }))}
            onChange={inputId => update({ inputId, optionId: undefined, legacyBaseCost: undefined })} />
          {!!material?.options?.length && <SearchChoice label="Option" value={row.optionId || ''}
            placeholder={row.legacyBaseCost == null ? 'Search options' : `Previous rate (${row.legacyBaseCost} ETB)`}
            options={material.options.map(o => ({ value: o.id, label: `${o.name} (${o.unitCost} ETB)` }))}
            onChange={optionId => update({ optionId, legacyBaseCost: undefined })} />}
          <label className="min-w-0">Quantity<input className="field" type="number" min="0" step="any" value={row.quantity || ''} onChange={e => update({ quantity: Number(e.target.value) })} /></label>
          <button type="button" className="h-9" aria-label={`Remove material ${index + 1}`} onClick={() => change({ ...product, cost: { ...cost, items: cost.items.filter((_, i) => i !== index) } })}>&times;</button>
        </div>;
      })}
      <button type="button" onClick={() => change({ ...product, cost: { ...cost, items: [...cost.items, { inputId: '', quantity: 1 }] } })}>+ Add input to product</button>
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
        <span>Input cost per item (ETB)<br /><strong>{subtotal.toFixed(2)}</strong></span>
        <span>Selling price per item (ETB)<br /><strong>{displayAmount(sellingPrice(cost.margin))}</strong></span>
        <span>Profit per item (ETB)<br /><strong>{displayAmount(profitPerItem(cost.margin))}</strong></span>
      </div>
    </>}
    {!cost && <label className="block">Exact selling price (ETB)<input className="field" type="number" min="0.01" step=".01" value={product.price ?? ''} onChange={e => change({ ...product, price: e.target.value === '' ? null : Number(e.target.value) })} /></label>}
    <h4 className="font-semibold">Quantity pricing</h4>
    <p className="text-xs">At each threshold, the new unit price applies to every item.</p>
    {!cost && breaks.map((tier, index) => {
      const update = (patch: Partial<typeof tier>) => updateBreaks(breaks.map((t, i) => i === index ? { ...t, ...patch } : t));
      return <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label>Minimum quantity<input type="number" min="2" className="field" value={tier.minQty || ''} onChange={e => update({ minQty: Number(e.target.value) })} /></label>
        <label>ETB each<input type="number" min=".01" step=".01" className="field" value={tier.priceEach || ''} onChange={e => update({ priceEach: Number(e.target.value) })} /></label>
        <button type="button" onClick={() => updateBreaks(breaks.filter((_, i) => i !== index)) } aria-label="Remove quantity threshold">&times;</button>
      </div>;
    })}
    {cost && thresholds.map((tier, index) => {
      const update = (patch: Partial<typeof tier>) => setThresholds(thresholds.map((t, i) => i === index ? { ...t, ...patch } : t));
      const previous = costBreaks.filter(t => t.minQty < tier.minQty).sort((a,b) => b.minQty - a.minQty)[0]?.priceEach ?? price ?? 0;
      return <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label>Minimum quantity<input type="number" min="2" className="field" value={tier.minQty || ''} onChange={e => update({ minQty: Number(e.target.value) })} /></label>
        <label>Tier margin (%)<input className="field" type="number" min="0" step="any" list={marginList} value={Number.isFinite(tier.margin) ? tier.margin : ''} placeholder="Choose or type percentage" onChange={e => update({ margin: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        <button type="button" onClick={() => setThresholds(thresholds.filter((_, i) => i !== index)) } aria-label="Remove quantity threshold">&times;</button>
        <p className="col-span-3 text-xs">Profit per item (ETB) <strong>{displayAmount(profitPerItem(tier.margin))}</strong></p>
        {tier.minQty > 1 && Number.isFinite(sellingPrice(tier.margin)) && Number.isFinite(previous) && <p className="col-span-3 text-xs">{tier.minQty - 1} &times; {previous} = {((tier.minQty - 1) * previous).toFixed(2)} ETB &middot; {tier.minQty} &times; {sellingPrice(tier.margin)} = {(tier.minQty * sellingPrice(tier.margin)).toFixed(2)} ETB</p>}
      </div>;
    })}
    <button type="button" onClick={addThreshold}>+ Add quantity threshold</button>
  </section>;
}
