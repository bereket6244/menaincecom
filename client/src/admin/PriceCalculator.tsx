import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import type { Product } from '../lib/types';
import { ProductCost } from './ProductCost';
import { CorporateCalculator } from './CorporateCalculator';

const emptyCalculation = (): Omit<Product, 'id'> => ({
  name: '', categoryId: '', description: '', photos: [], variants: [],
  pricingMode: 'exact', price: null, isAddon: false, suggestedAddonIds: [], featured: false,
  cost: { items: [{ inputId: '', quantity: 1 }], margin: 25, adjustment: 0, roundUp: null },
});

export function PriceCalculator() {
  const [mode, setMode] = useState<'corporate' | 'materials'>('corporate');
  const [calculation, setCalculation] = useState(emptyCalculation);
  const [resetKey, setResetKey] = useState(0);

  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto max-w-6xl space-y-5 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold">Price calculator</h1><p className="mt-1 text-sm text-muted">Build a customer quote from a production cost or your materials list.</p></div>
        {mode === 'materials' && <Button variant="outline" onClick={() => { setCalculation(emptyCalculation()); setResetKey(key => key + 1); }}>New material calculation</Button>}
      </div>
      <div role="tablist" aria-label="Calculator mode" className="inline-flex rounded-lg border border-edge bg-surface p-1">
        <button type="button" role="tab" aria-selected={mode === 'corporate'} onClick={() => setMode('corporate')} className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'corporate' ? 'bg-pink text-white' : 'text-muted hover:text-ink'}`}>Corporate quote</button>
        <button type="button" role="tab" aria-selected={mode === 'materials'} onClick={() => setMode('materials')} className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'materials' ? 'bg-pink text-white' : 'text-muted hover:text-ink'}`}>From materials</button>
      </div>
      <div role="tabpanel">{mode === 'corporate' ? <CorporateCalculator /> : <div className="max-w-2xl space-y-3"><p className="text-xs text-muted">Calculate from your <Link className="underline" to="/admin/materials">materials list</Link>. Calculations stay here while this page is open; nothing is saved or published as a product.</p><ProductCost key={resetKey} product={calculation} change={setCalculation} standalone /></div>}</div>
    </div>
  </div>;
}
