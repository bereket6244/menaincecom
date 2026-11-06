import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import type { Product } from '../lib/types';
import { ProductCost } from './ProductCost';

const emptyCalculation = (): Omit<Product, 'id'> => ({
  name: '', categoryId: '', description: '', photos: [], variants: [],
  pricingMode: 'exact', price: null, isAddon: false, suggestedAddonIds: [], featured: false,
  cost: { items: [{ inputId: '', quantity: 1 }], margin: 25, adjustment: 0, roundUp: null },
});

export function PriceCalculator() {
  const [calculation, setCalculation] = useState(emptyCalculation);
  const [resetKey, setResetKey] = useState(0);

  return <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto max-w-2xl space-y-3 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-sm font-bold">Price calculator</h1>
        <Button variant="outline" onClick={() => { setCalculation(emptyCalculation()); setResetKey(key => key + 1); }}>New calculation</Button>
      </div>
      <p className="text-xs text-muted">Calculate a customer quote using your <Link className="underline" to="/admin/materials">materials list</Link>. Calculations stay here while this page is open; nothing is saved or published as a product.</p>
      <ProductCost key={resetKey} product={calculation} change={setCalculation} standalone />
    </div>
  </div>;
}
