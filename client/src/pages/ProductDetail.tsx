import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ShoppingBag, PlusCircle } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Product } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Button, Spinner, SysLabel, EmptyState } from '../components/ui';
import { cx, formatPrice } from '../lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, toast, online } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');

  const product = useMemo(() => (products || []).find((p) => p.id === id) || null, [products, id]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  if (loading && !product) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!product) return <EmptyState>Product not found. <Link to="/catalog" className="text-pink underline">Back to catalog</Link></EmptyState>;

  const addons = (products || []).filter(
    (p) => p.isAddon && (product.suggestedAddonIds.includes(p.id) || product.suggestedAddonIds.length === 0)
  ).slice(0, 6);

  // Variant photos override the main gallery when the selected option has one.
  const selectedPhoto =
    product.variants
      .flatMap((v) => v.options)
      .find((o) => Object.values(selections).includes(o.label) && o.photo)?.photo ||
    product.photos[photoIdx] ||
    product.photos[0];

  const missingVariant = product.variants.find((v) => !selections[v.name]);

  const add = (p: Product, selectedVariants: Record<string, string>, quantity: number, itemNote: string) => {
    addToCart({
      productId: p.id,
      name: p.name,
      photo: p.photos[0] || '',
      isAddon: p.isAddon,
      pricingMode: p.pricingMode,
      priceEach: p.pricingMode === 'exact' ? p.price : null,
      variantSelections: selectedVariants,
      qty: quantity,
      note: itemNote,
    });
  };

  const handleAdd = () => {
    if (missingVariant) {
      toast('error', `Please choose a ${missingVariant.name.toLowerCase()}.`);
      return;
    }
    add(product, selections, qty, note);
    toast('success', `${product.name} added to your order.`);
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Photos */}
        <div className="space-y-2">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-edge bg-surface2">
            {selectedPhoto ? (
              <img src={selectedPhoto} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted/40 text-xs">No photo yet</div>
            )}
          </div>
          {product.photos.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto">
              {product.photos.map((ph, i) => (
                <button
                  key={ph}
                  onClick={() => setPhotoIdx(i)}
                  className={cx(
                    'h-14 w-16 shrink-0 overflow-hidden rounded border',
                    i === photoIdx ? 'border-pink' : 'border-edge opacity-70'
                  )}
                >
                  <img src={ph} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>
            {product.isAddon && <SysLabel>Add-on item</SysLabel>}
            <h1 className="text-xl font-bold leading-tight">{product.name}</h1>
            <div className={cx('mt-1 text-sm font-semibold', product.pricingMode === 'quote' ? 'text-muted' : 'text-green')}>
              {formatPrice(product)}
            </div>
          </div>

          {product.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{product.description}</p>
          )}

          {product.variants.map((group) => (
            <div key={group.name}>
              <SysLabel>{group.name}</SysLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {group.options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelections((s) => ({ ...s, [group.name]: opt.label }))}
                    className={cx(
                      'rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                      selections[group.name] === opt.label
                        ? 'border-pink bg-pink/15 text-ink'
                        : 'border-edge bg-surface text-muted hover:text-ink'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <SysLabel>Quantity</SysLabel>
            <div className="mt-1.5 flex items-center gap-2">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-8 w-8 items-center justify-center rounded border border-edge bg-surface hover:border-pink/50" aria-label="Decrease">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="field w-20 text-center"
              />
              <button onClick={() => setQty((q) => q + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-edge bg-surface hover:border-pink/50" aria-label="Increase">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div>
            <SysLabel>Customization notes (optional)</SysLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Names, date, wording, colors…"
              className="field mt-1.5 resize-y"
            />
          </div>

          <Button onClick={handleAdd} className="w-full py-2.5 sm:w-auto sm:px-8" disabled={false}>
            <ShoppingBag className="h-4 w-4" />
            Add to order
          </Button>
          {!online && (
            <p className="text-[11px] text-amber-300">You are offline — you can browse, but sending an order requires a connection.</p>
          )}
        </div>
      </div>

      {/* Suggested add-ons */}
      {!product.isAddon && addons.length > 0 && (
        <section className="rounded-lg border border-edge bg-surface p-3">
          <h2 className="text-sm font-bold">Complete the suite</h2>
          <p className="mb-2 text-[11px] text-muted">Matching extras that pair with this design.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {addons.map((a) => (
              <div key={a.id} className="overflow-hidden rounded border border-edge bg-surface2">
                <Link to={`/product/${a.id}`} className="block aspect-[4/3] bg-bg">
                  {a.photos[0] && <img src={a.photos[0]} alt={a.name} loading="lazy" className="h-full w-full object-cover" />}
                </Link>
                <div className="p-2">
                  <div className="truncate text-[11px] font-semibold">{a.name}</div>
                  <div className="text-[10px] text-muted">{formatPrice(a)}</div>
                  <button
                    onClick={() => {
                      if (a.variants.length > 0) { navigate(`/product/${a.id}`); return; }
                      add(a, {}, 1, '');
                      toast('success', `${a.name} added to your order.`);
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-pink hover:underline"
                  >
                    <PlusCircle className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
