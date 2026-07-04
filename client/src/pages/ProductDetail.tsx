import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ShoppingBag, Clock } from 'lucide-react';
import { useData } from '../lib/useData';
import type { BusinessSettings, Product } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Button, Spinner, SysLabel, EmptyState } from '../components/ui';
import { cx, formatPrice } from '../lib/utils';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, toast, online } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');
  const { data: business } = useData<BusinessSettings>('/content/business');

  const product = useMemo(() => (products || []).find((p) => p.id === id) || null, [products, id]);
  const [photoIdx, setPhotoIdx] = useState(0);
  // A clicked thumbnail pins the main photo; picking a variant unpins it so
  // the variant's own photo can take over.
  const [photoPinned, setPhotoPinned] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  if (loading && !product) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!product)
    return <EmptyState>Product not found. <Link to="/catalog" className="font-semibold text-pink underline">Back to catalog</Link></EmptyState>;

  const suggestedAddonIds = product.suggestedAddonIds || [];
  const addons = (products || [])
    .filter((p) => p.isAddon && (suggestedAddonIds.includes(p.id) || suggestedAddonIds.length === 0))
    .slice(0, 4);

  const variantPhoto = product.variants
    .flatMap((v) => v.options)
    .find((o) => Object.values(selections).includes(o.label) && o.photo)?.photo;
  const selectedPhoto =
    (photoPinned ? product.photos[photoIdx] : variantPhoto || product.photos[photoIdx]) || product.photos[0];

  const samplePrice = business?.samplePriceEtb ?? 120;

  const missingVariant = product.variants.find((v) => !selections[v.name]);
  const isQuote = product.pricingMode === 'quote';

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

  const orderSample = () => {
    addToCart({
      productId: product.id,
      name: `Printed sample — ${product.name}`,
      photo: product.photos[0] || '',
      isAddon: false,
      isSample: true,
      pricingMode: 'exact',
      priceEach: samplePrice,
      variantSelections: {},
      qty: 1,
      note: '',
    });
    toast('success', `Printed sample of ${product.name} added to your order.`);
  };

  return (
    <div className="space-y-12">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Back to catalog
      </button>

      <div className="grid gap-10 md:grid-cols-2 lg:gap-14">
        {/* Photos */}
        <div className="space-y-4">
          <div className="aspect-[5/7] max-w-md overflow-hidden rounded-lg border border-edge bg-surface2 shadow-md">
            {selectedPhoto ? (
              <img src={selectedPhoto} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-[#f4f0ec] p-8 text-center">
                <span className="font-script text-5xl leading-none text-pink">{product.name}</span>
                <span className="mt-4 text-[10px] uppercase tracking-[0.24em] text-ink/50">Mena Inc. · Addis Ababa</span>
              </div>
            )}
          </div>
          {product.photos.length > 1 && (
            <div className="flex max-w-md gap-2 overflow-x-auto">
              {product.photos.map((ph, i) => (
                <button
                  key={ph}
                  onClick={() => { setPhotoIdx(i); setPhotoPinned(true); }}
                  className={cx(
                    'h-16 w-14 shrink-0 overflow-hidden rounded-md border-2',
                    i === photoIdx ? 'border-pink' : 'border-edge opacity-70'
                  )}
                >
                  <img src={ph} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={orderSample}
            className="block w-full max-w-md text-center text-sm font-semibold text-pink underline-offset-2 hover:underline"
          >
            Order a printed sample — {samplePrice} ETB
          </button>
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            {product.isAddon ? (
              <SysLabel>Add-on item</SysLabel>
            ) : (
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Wedding Cards</div>
            )}
            <h1 className="mt-1.5 font-serif text-4xl font-semibold leading-tight">{product.name}</h1>
            <div className="mt-2 text-2xl font-bold text-ink">
              {formatPrice(product)}
              {!isQuote && <span className="ml-1 text-sm font-medium text-muted">/ 100 cards</span>}
            </div>
          </div>

          {product.description && (
            <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink/70">{product.description}</p>
          )}

          {product.variants.map((group) => (
            <div key={group.name}>
              <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{group.name}</div>
              <div className="flex flex-wrap gap-2.5">
                {group.options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => { setSelections((s) => ({ ...s, [group.name]: opt.label })); setPhotoPinned(false); }}
                    className={cx(
                      'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                      selections[group.name] === opt.label
                        ? 'border-pink bg-pink/10 text-ink'
                        : 'border-edge bg-surface text-ink/70 hover:border-ink/40'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Quantity</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center overflow-hidden rounded-full border border-edge">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center text-ink/70 hover:bg-surface2" aria-label="Decrease">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-[15px] font-bold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="flex h-11 w-11 items-center justify-center text-ink/70 hover:bg-surface2" aria-label="Increase">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-sm text-muted">packs of 100</span>
            </div>
          </div>

          <div>
            <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Customization notes (optional)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Names, date, wording, colours…"
              className="field resize-y"
            />
          </div>

          <Button onClick={handleAdd} className="w-full py-3.5 text-sm sm:w-auto sm:px-10">
            <ShoppingBag className="h-4 w-4" />
            Add to order
          </Button>
          {!online && (
            <p className="text-[12px] text-amber-700">You are offline — you can browse, but sending an order requires a connection.</p>
          )}

          <div className="flex items-start gap-2.5 rounded-xl bg-surface2 p-4 text-[13.5px] text-ink/70">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-pink" />
            Send your order on WhatsApp or Telegram — no online payment. Our studio confirms every detail with you first.
          </div>
        </div>
      </div>

      {/* Suggested add-ons */}
      {!product.isAddon && addons.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Complete the suite</h2>
          <p className="mb-4 text-sm text-muted">Matching extras that pair with this design.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {addons.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border border-edge bg-surface">
                <Link to={`/product/${a.id}`} className="block aspect-square bg-surface2">
                  {a.photos[0] ? (
                    <img src={a.photos[0]} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center font-script text-2xl text-pink">{a.name}</div>
                  )}
                </Link>
                <div className="p-3">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="mt-0.5 text-[13px] text-muted">{formatPrice(a)}</div>
                  <button
                    onClick={() => {
                      if (a.variants.length > 0) { navigate(`/product/${a.id}`); return; }
                      add(a, {}, 1, '');
                      toast('success', `${a.name} added to your order.`);
                    }}
                    className="mt-2.5 w-full rounded-lg bg-surface2 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-edge"
                  >
                    Add
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
