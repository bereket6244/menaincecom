import { sellingPrice as calculateSellingPrice } from '../../../server/src/selling-price.mjs';
import type { CostInput, Product } from '../lib/types';
import { useData } from '../lib/useData';

const displayAmount = (value: number) => Number.isFinite(value) ? value.toFixed(2) : 'Invalid';

type Draft = Omit<Product, 'id'> & { id?: string };

export function ProductCost({ product, change }: { product: Draft; change: (next: Draft) => void }) {
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
  const sellingPrice = (margin: number) => calculateSellingPrice(subtotal, margin, cost?.adjustment, cost?.roundUp);
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
        return <div key={index} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
          <label>Shared input<select className="field" value={row.inputId} onChange={e => update({ inputId: e.target.value, optionId: undefined, legacyBaseCost: undefined })}>
            <option value="">Choose input</option>
            {inputs.map(i => <option key={i.id} value={i.id}>{i.name}{i.options?.length ? '' : ` (${i.unitCost} ETB)`}</option>)}
          </select></label>
          <label>Quantity<input className="field" type="number" min="0" step="any" value={row.quantity || ''} onChange={e => update({ quantity: Number(e.target.value) })} /></label>
          <button type="button" onClick={() => change({ ...product, cost: { ...cost, items: cost.items.filter((_, i) => i !== index) } })}>Remove</button>
          {!!material?.options?.length && <label className="col-span-full">Material option<select className="field" value={row.optionId || ''} onChange={e => update({ optionId: e.target.value || undefined, legacyBaseCost: undefined })}>
            <option value="" disabled>{row.legacyBaseCost == null ? 'Choose option' : `Previous rate (${row.legacyBaseCost} ETB)`}</option>
            {material.options.map(o => <option key={o.id} value={o.id}>{o.name} ({o.unitCost} ETB)</option>)}
          </select></label>}
        </div>;
      })}
      <button type="button" onClick={() => change({ ...product, cost: { ...cost, items: [...cost.items, { inputId: '', quantity: 1 }] } })}>+ Add input to product</button>
      <div className="grid grid-cols-2 gap-2">
        <label>Margin<select className="field" value={cost.margin} onChange={e => change({ ...product, cost: { ...cost, margin: Number(e.target.value) } })}>{margins.map(n => <option key={n} value={n}>{n}%</option>)}</select></label>
      </div>
      <p className="text-xs text-muted">Price after margin = input cost + (input cost x selected percentage).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Adjustment per item (ETB)<input className="field" type="number" step="any" value={cost.adjustment ?? 0}
          onChange={e => change({ ...product, cost: { ...cost, adjustment: Number(e.target.value) } })} /></label>
        <label>Round up to multiple (ETB)<input className="field" type="number" step="any" min="0" placeholder="Off"
          value={cost.roundUp ?? ''} onChange={e => change({ ...product, cost: { ...cost, roundUp: e.target.value === '' ? null : Number(e.target.value) } })} /></label>
      </div>
      <p className="text-xs text-muted">Positive adjustment adds birr; negative subtracts. Margin, then adjustment, then round up, then two decimals. Applies to every quantity tier.</p>
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
        <button type="button" onClick={() => updateBreaks(breaks.filter((_, i) => i !== index))}>Remove</button>
      </div>;
    })}
    {cost && thresholds.map((tier, index) => {
      const update = (patch: Partial<typeof tier>) => setThresholds(thresholds.map((t, i) => i === index ? { ...t, ...patch } : t));
      const previous = costBreaks.filter(t => t.minQty < tier.minQty).sort((a,b) => b.minQty - a.minQty)[0]?.priceEach ?? price ?? 0;
      return <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label>Minimum quantity<input type="number" min="2" className="field" value={tier.minQty || ''} onChange={e => update({ minQty: Number(e.target.value) })} /></label>
        <label>Tier margin<select className="field" value={tier.margin} onChange={e => update({ margin: Number(e.target.value) })}>{margins.map(n => <option key={n} value={n}>{n}%</option>)}</select></label>
        <button type="button" onClick={() => setThresholds(thresholds.filter((_, i) => i !== index))}>Remove</button>
        <p className="col-span-3 text-xs">Profit per item (ETB) <strong>{displayAmount(profitPerItem(tier.margin))}</strong></p>
        {tier.minQty > 1 && Number.isFinite(sellingPrice(tier.margin)) && Number.isFinite(previous) && <p className="col-span-3 text-xs">{tier.minQty - 1} &times; {previous} = {((tier.minQty - 1) * previous).toFixed(2)} ETB &middot; {tier.minQty} &times; {sellingPrice(tier.margin)} = {(tier.minQty * sellingPrice(tier.margin)).toFixed(2)} ETB</p>}
      </div>;
    })}
    <button type="button" onClick={addThreshold}>+ Add quantity threshold</button>
  </section>;
}
