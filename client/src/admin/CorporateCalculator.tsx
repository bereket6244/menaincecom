import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '../components/ui';
import type { CostInput, Product } from '../lib/types';
import { useData } from '../lib/useData';
import { SearchChoice } from './SearchChoice';

function recipeCost(product: Product | undefined, inputs: CostInput[] | null): number | null {
  if (!product?.cost?.items?.length || !inputs) return null;
  let total = 0;
  for (const item of product.cost.items) {
    const input = inputs.find(candidate => candidate.id === item.inputId);
    const unitCost = item.optionId
      ? input?.options?.find(option => option.id === item.optionId)?.unitCost
      : input?.options?.length ? item.legacyBaseCost : input?.unitCost;
    if (!Number.isFinite(unitCost) || !(unitCost! > 0) || !Number.isFinite(item.quantity) || item.quantity <= 0) return null;
    total += unitCost! * item.quantity;
  }
  return total;
}

type Draft = { preset: string; name: string; quantity: string; cost: string; markup: string; incomeTax: string; dividendTax: string; vat: string; roundingMultiple: string; roundingDirection: 'up' | 'down' };
const initial: Draft = { preset: '', name: '', quantity: '1', cost: '', markup: '40', incomeTax: '35', dividendTax: '15', vat: '15', roundingMultiple: '', roundingDirection: 'up' };
const money = (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
const numeric = (value: string) => value.trim() === '' ? NaN : Number(value);
const rateOk = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;

export function calculateCorporateQuote(draft: Draft, markupOverride?: number) {
  const quantity = numeric(draft.quantity), cost = numeric(draft.cost), markup = markupOverride ?? numeric(draft.markup);
  const incomeRate = numeric(draft.incomeTax), dividendRate = numeric(draft.dividendTax), vatRate = numeric(draft.vat);
  const multiple = draft.roundingMultiple.trim() === '' ? null : numeric(draft.roundingMultiple);
  const multipleCents = multiple === null ? null : Math.round(multiple * 100);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(cost) || cost <= 0 ||
    !Number.isFinite(markup) || markup < 0 || markup > 1000 || !rateOk(incomeRate) || !rateOk(dividendRate) || !rateOk(vatRate) ||
    (multiple !== null && (!Number.isFinite(multiple) || multiple <= 0 || !Number.isSafeInteger(multipleCents) || Math.abs(multiple * 100 - multipleCents!) > 1e-8))) return null;
  const profit = cost * markup / 100;
  const incomeTax = profit * incomeRate / 100;
  const dividendTax = (profit - incomeTax) * dividendRate / 100;
  const beforeVat = cost + profit + incomeTax + dividendTax;
  const vat = beforeVat * vatRate / 100;
  const exactUnit = beforeVat + vat;
  const unit = multipleCents === null
    ? Math.round((exactUnit + Number.EPSILON) * 100) / 100
    : (draft.roundingDirection === 'up'
      ? Math.ceil(exactUnit * 100 / multipleCents - 1e-9)
      : Math.floor(exactUnit * 100 / multipleCents + 1e-9)) * multipleCents / 100;
  if (!Number.isFinite(unit) || unit <= 0) return null;
  return { quantity, cost, markup, profit, incomeTax, dividendTax, beforeVat, vat, exactUnit, unit, total: unit * quantity };
}

export function CorporateCalculator() {
  const { data: websiteProducts, loading: catalogLoading, error: catalogError, reload: reloadCatalog } = useData<Product[]>('/products');
  const { data: adminProducts, loading: adminLoading, error: adminError } = useData<Product[]>('/admin/products');
  const { data: inputs, loading: inputsLoading, error: inputsError } = useData<CostInput[]>('/admin/cost-inputs');
  const [draft, setDraft] = useState<Draft>(initial);
  const [costEdited, setCostEdited] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateCorporateQuote(draft), [draft]);
  const update = (field: keyof Draft, value: string) => { setDraft(previous => ({ ...previous, [field]: value })); setCopied(false); };
  const products = websiteProducts || (adminProducts || []).filter(product => !product.status || product.status === 'published');
  const options = [{ value: '', label: 'Custom item' }, ...products.map(product => ({ value: product.id, label: product.name }))];
  const selectedProduct = products.find(product => product.id === draft.preset);
  useEffect(() => {
    if (!draft.preset || costEdited) return;
    const cost = recipeCost(adminProducts?.find(product => product.id === draft.preset), inputs);
    if (cost != null) setDraft(previous => previous.preset === draft.preset && previous.cost === '' ? { ...previous, cost: String(cost) } : previous);
  }, [draft.preset, costEdited, adminProducts, inputs]);
  const choose = (id: string) => {
    const product = products.find(item => item.id === id);
    const cost = recipeCost(adminProducts?.find(item => item.id === id), inputs);
    setDraft(previous => ({ ...previous, preset: id, name: product?.name || '', cost: cost == null ? '' : String(cost) }));
    setCostEdited(false);
    setCopied(false);
  };
  const copy = async () => {
    if (!result) return;
    const text = `${draft.name.trim() || 'Custom item'}\nQuantity: ${result.quantity}\nUnit price (incl. VAT): ${money(result.unit)}\nTotal (incl. VAT): ${money(result.total)}`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
    <div className="space-y-5">
      <section className="rounded-xl border border-edge bg-surface p-4 sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 className="text-base font-bold">Quote inputs</h2><p className="mt-1 text-xs text-muted">Choose a website product or enter a custom production cost.</p></div>
          <button type="button" onClick={() => { setDraft(initial); setCostEdited(false); setCopied(false); }} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted hover:text-ink"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
        </div>
        <div className="space-y-4">
          <SearchChoice label="Website product" value={draft.preset} options={options} placeholder="Search published products" onChange={choose} />
          {catalogLoading && !websiteProducts && <p role="status" className="text-xs text-muted">Loading website products…</p>}
          {catalogError && !websiteProducts && !adminProducts && <p role="alert" className="text-xs text-muted">Could not load website products. <button type="button" className="underline" onClick={reloadCatalog}>Retry</button></p>}
          {selectedProduct && !draft.cost && <p className="text-xs text-muted">{adminLoading || inputsLoading ? 'Loading saved production cost…' : adminError || inputsError ? 'Saved production costs require an admin session. Enter the cost manually in this local preview.' : 'This product has no production cost recipe. Enter its cost below; the website selling price is not used as cost.'}</p>}
          <label className="block text-sm font-medium">Item or project name
            <input className="field mt-1" value={draft.name} onChange={event => update('name', event.target.value)} placeholder="e.g. Corporate invitation" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Production cost per item (ETB)
              <input className="field mt-1" type="number" min="0.01" step="any" inputMode="decimal" value={draft.cost} onChange={event => { setCostEdited(true); update('cost', event.target.value); }} placeholder="Enter cost" />
            </label>
            <label className="block text-sm font-medium">Quantity
              <input className="field mt-1" type="number" min="1" step="1" inputMode="numeric" value={draft.quantity} onChange={event => update('quantity', event.target.value)} />
            </label>
          </div>
          <div><label className="block text-sm font-medium" htmlFor="corporate-markup">Markup on cost (%)</label>
            <div className="mt-1 grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(90px,1fr)] gap-2">
              {[40, 45, 50].map(rate => <button key={rate} type="button" onClick={() => update('markup', String(rate))} aria-pressed={numeric(draft.markup) === rate} className={`rounded-md border px-2 py-2 text-sm font-semibold ${numeric(draft.markup) === rate ? 'border-pink bg-pink/10 text-pink' : 'border-edge bg-surface2 text-ink hover:border-pink'}`}>{rate}%</button>)}
              <input id="corporate-markup" aria-label="Custom markup percentage" className="field text-center" type="number" min="0" max="1000" step="any" inputMode="decimal" value={draft.markup} onChange={event => update('markup', event.target.value)} />
            </div><p className="mt-1.5 text-xs text-muted">Markup is a percentage of production cost, matching the spreadsheet.</p>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-edge bg-surface p-4 sm:p-5">
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setAdvanced(value => !value)} aria-expanded={advanced}>
          <span className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" /> Pricing assumptions</span>
          <span className="text-xs text-muted">{advanced ? 'Hide' : 'Edit'} rates & rounding</span>
        </button>
        <p className="mt-2 text-xs text-muted">Defaults reproduce the spreadsheet: 35% income tax, 15% dividend tax on the remainder, and 15% VAT.</p>
        {advanced && <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([['incomeTax', 'Income tax (%)'], ['dividendTax', 'Dividend tax (%)'], ['vat', 'VAT (%)']] as const).map(([field, label]) =>
            <label key={field} className="text-sm font-medium">{label}<input className="field mt-1" type="number" min="0" max="100" step="any" value={draft[field]} onChange={event => update(field, event.target.value)} /></label>)}
          <label className="text-sm font-medium">Rounding multiple (ETB)
            <input className="field mt-1" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Off — e.g. 2.50" value={draft.roundingMultiple} onChange={event => update('roundingMultiple', event.target.value)} />
          </label>
          <label className="text-sm font-medium">Rounding direction
            <select className="field mt-1" value={draft.roundingDirection} onChange={event => update('roundingDirection', event.target.value)}>
              <option value="up">Round up</option><option value="down">Round down</option>
            </select>
          </label>
          <p className="text-xs text-muted sm:col-span-2">Enter any positive ETB multiple to the cent, or leave blank for no rounding. Applied to the VAT-inclusive unit price before multiplying by quantity.</p>
        </div>}
      </section>
    </div>
    <div className="space-y-5">
      <section className="rounded-xl border border-edge bg-surface p-4 sm:p-5" aria-live="polite">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-bold">Quote summary</h2><span className="rounded-full bg-surface2 px-2 py-1 text-[11px] font-semibold text-muted">ETB · VAT included</span></div>
        {result ? <>
          <p className="text-xs text-muted">Total for {result.quantity.toLocaleString()} {result.quantity === 1 ? 'item' : 'items'}</p>
          <div className="mt-1 text-3xl font-bold tracking-tight text-ink">{money(result.total)}</div>
          <p className="mt-1 text-sm text-muted">{money(result.unit)} per item{draft.roundingMultiple.trim() !== '' ? ' after rounding' : ''}</p>
          <div className="mt-5 space-y-2 border-t border-edge pt-4 text-sm">
            <div className="flex justify-between gap-3"><span>Production cost</span><strong>{money(result.cost)}</strong></div>
            <div className="flex justify-between gap-3"><span>Target markup ({result.markup}%)</span><strong>{money(result.profit)}</strong></div>
            <div className="flex justify-between gap-3"><span>Estimated income tax</span><strong>{money(result.incomeTax)}</strong></div>
            <div className="flex justify-between gap-3"><span>Estimated dividend tax</span><strong>{money(result.dividendTax)}</strong></div>
            <div className="flex justify-between gap-3 border-t border-edge pt-2"><span>Unit price before VAT</span><strong>{money(result.beforeVat)}</strong></div>
            <div className="flex justify-between gap-3"><span>VAT</span><strong>{money(result.vat)}</strong></div>
            {draft.roundingMultiple.trim() !== '' && <div className="flex justify-between gap-3"><span>Rounding adjustment</span><strong>{money(result.unit - result.exactUnit)}</strong></div>}
          </div>
          <Button type="button" onClick={copy} className="mt-5 flex w-full items-center justify-center gap-2"><span>{copied ? 'Copied quote' : 'Copy quote'}</span>{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}</Button>
        </> : <p role="status" className="rounded-lg bg-surface2 p-4 text-sm text-muted">Enter a cost above zero and a whole-number quantity. Tax rates must be 0–100%, markup 0–1,000%, and the rounding multiple must be positive, to the cent, and leave a positive unit price.</p>}
      </section>
      <section className="rounded-xl border border-edge bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-bold">Compare markup options</h2>
        <p className="mt-1 text-xs text-muted">VAT-inclusive unit prices using the current cost and tax rates.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">{[40, 45, 50].map(rate => {
          const option = calculateCorporateQuote(draft, rate);
          return <button key={rate} type="button" onClick={() => update('markup', String(rate))} className={`rounded-lg border p-3 text-left ${numeric(draft.markup) === rate ? 'border-pink bg-pink/10' : 'border-edge bg-surface2 hover:border-pink'}`}>
            <span className="block text-xs text-muted">{rate}% markup</span><strong className="mt-1 block text-sm">{option ? money(option.unit) : '—'}</strong>
          </button>;
        })}</div>
      </section>
      <p className="px-1 text-xs leading-relaxed text-muted">Products come from the website catalog. When a product has a saved materials recipe, its current production cost fills in automatically; you can edit it for this quote. Tax figures are pricing assumptions. Nothing here changes catalog prices or publishes a product.</p>
    </div>
  </div>;
}
