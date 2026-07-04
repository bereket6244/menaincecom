import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, Clock, MessageCircle, ShoppingBag, Store, X } from 'lucide-react';
import { useData } from '../lib/useData';
import type { BusinessSettings, Product } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Button, Spinner, SysLabel, EmptyState } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { cx, formatPrice } from '../lib/utils';
import type { AddToCartResult } from '../store/AppContext';

type OrderNotice = {
  kind: AddToCartResult;
  message: string;
};

type PurchaseMode = 'cart' | 'buy';

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
  const [orderNotice, setOrderNotice] = useState<OrderNotice | null>(null);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode | null>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  const showOrderNotice = (name: string, result: AddToCartResult) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    const message =
      result === 'updated'
        ? `${name} is already in your order. Quantity updated.`
        : `${name} added to your order.`;
    setOrderNotice({ kind: result, message });
    noticeTimer.current = window.setTimeout(() => setOrderNotice(null), 3600);
    toast(result === 'updated' ? 'info' : 'success', message);
  };

  const openPurchaseSheet = (mode: PurchaseMode) => {
    setPurchaseMode(mode);
    setOrderNotice(null);
  };

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
    return addToCart({
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
    const result = add(product, selections, qty, note);
    showOrderNotice(product.name, result);
  };

  const handleContinue = () => {
    if (missingVariant) {
      toast('error', `Please choose a ${missingVariant.name.toLowerCase()}.`);
      return;
    }
    const result = add(product, selections, qty, note);
    showOrderNotice(product.name, result);
    if (purchaseMode === 'buy') {
      window.setTimeout(() => navigate('/order'), 650);
    }
  };

  const orderSample = () => {
    const result = addToCart({
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
    showOrderNotice(`Printed sample of ${product.name}`, result);
  };

  return (
    <div className="space-y-12 pb-28 md:pb-0">
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
              {!isQuote && <span className="ml-1 text-sm font-medium text-muted">each</span>}
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
            <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
            <p className="mt-2 text-[12px] text-muted">Type the exact amount in the quantity box, tap a preset, or use - / +.</p>
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
          {orderNotice && (
            <div
              role="status"
              aria-live="polite"
              className={cx(
                'w-full rounded-lg border px-3 py-2 text-sm font-semibold sm:max-w-sm',
                orderNotice.kind === 'updated'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-green/30 bg-green/10 text-ink'
              )}
            >
              {orderNotice.message}
            </div>
          )}
          {!online && (
            <p className="text-[12px] text-amber-700">You are offline — you can browse, but sending an order requires a connection.</p>
          )}

          <div className="flex items-start gap-2.5 rounded-xl bg-surface2 p-4 text-[13.5px] text-ink/70">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-pink" />
            Send your order on WhatsApp, Telegram or SMS — no signup, no online payment. Our studio confirms every detail with you first.
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
                      const result = add(a, {}, 1, '');
                      showOrderNotice(a.name, result);
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_30px_rgba(28,26,25,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link to="/catalog" className="flex w-12 flex-col items-center gap-0.5 text-[10px] font-semibold text-muted">
            <Store className="h-5 w-5" />
            Shop
          </Link>
          <Link to="/contact" className="flex w-12 flex-col items-center gap-0.5 text-[10px] font-semibold text-muted">
            <MessageCircle className="h-5 w-5" />
            Chat
          </Link>
          <Link to="/order" className="flex w-12 flex-col items-center gap-0.5 text-[10px] font-semibold text-muted">
            <ShoppingBag className="h-5 w-5" />
            Order
          </Link>
          <button
            type="button"
            onClick={() => openPurchaseSheet('cart')}
            className="h-12 flex-1 rounded-full border-2 border-ink bg-white px-4 text-sm font-extrabold text-ink"
          >
            Add to order
          </button>
          <button
            type="button"
            onClick={() => openPurchaseSheet('buy')}
            className="h-12 flex-1 rounded-full bg-pink px-4 text-sm font-extrabold text-white shadow-lg shadow-pink/20"
          >
            Order now
          </button>
        </div>
      </div>

      {purchaseMode && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/45 md:hidden" onClick={() => setPurchaseMode(null)}>
          <div
            className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-edge bg-surface px-4 py-4">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2">
                {selectedPhoto ? (
                  <img src={selectedPhoto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center font-script text-xl text-pink">M</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-extrabold text-ink">{product.name}</div>
                <div className="mt-1 text-sm text-muted">
                  {Object.entries(selections).length > 0
                    ? Object.entries(selections).map(([k, v]) => `${k}: ${v}`).join(', ')
                    : 'Choose your options'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseMode(null)}
                className="rounded-full p-1 text-ink/70 hover:bg-surface2"
                aria-label="Close options"
              >
                <X className="h-7 w-7" />
              </button>
            </div>

            <div className="space-y-6 px-4 py-5">
              <div className="rounded-2xl border border-pink/20 bg-pink/5 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-pink">Mena order price</div>
                    <div className="mt-1 text-3xl font-extrabold text-ink">{formatPrice(product)}</div>
                  </div>
                  {!isQuote && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-muted">each</span>}
                </div>
                <p className="mt-2 text-xs font-semibold text-pink-dim">
                  No online payment. Send the order summary and our studio confirms details with you.
                </p>
              </div>

              {product.variants.map((group) => (
                <div key={group.name}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-ink">{group.name}: {selections[group.name] || 'Select'}</h3>
                  </div>
                  <div className={cx('flex gap-3 overflow-x-auto pb-1', group.options.some((opt) => opt.photo) ? '' : 'flex-wrap overflow-visible')}>
                    {group.options.map((opt) => {
                      const active = selections[group.name] === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => { setSelections((s) => ({ ...s, [group.name]: opt.label })); setPhotoPinned(false); }}
                          className={cx(
                            'relative shrink-0 rounded-xl border bg-white text-sm font-bold transition-colors',
                            opt.photo ? 'w-24 overflow-hidden pb-2' : 'min-w-20 px-5 py-3',
                            active ? 'border-2 border-ink text-ink' : 'border-edge text-ink/75'
                          )}
                        >
                          {opt.photo && (
                            <div className="mb-2 aspect-square bg-surface2">
                              <img src={opt.photo} alt="" className="h-full w-full object-cover" />
                            </div>
                          )}
                          <span className="block truncate px-1">{opt.label}</span>
                          {active && <span className="absolute right-1.5 top-1.5 rounded-full bg-pink px-1.5 py-0.5 text-[10px] text-white">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div>
                <h3 className="mb-3 text-lg font-extrabold text-ink">Qty</h3>
                <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
                <p className="mt-2 text-xs text-muted">Type the exact amount in the quantity box.</p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">Customization notes</h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Names, date, wording, colours..."
                  className="field resize-y"
                />
              </div>
            </div>

            {orderNotice && (
              <div className="pointer-events-none absolute inset-x-7 top-[40%] z-20 rounded-xl bg-ink/80 px-5 py-6 text-center text-white shadow-2xl">
                <CheckCircle2 className="mx-auto h-9 w-9 text-green" />
                <div className="mt-2 text-2xl font-extrabold">
                  {orderNotice.kind === 'updated' ? 'Already in order' : 'Added to order!'}
                </div>
                <div className="mt-1 text-sm text-white/80">{orderNotice.message}</div>
                <Link
                  to="/order"
                  className="pointer-events-auto mt-4 inline-flex rounded-full border border-white px-8 py-2 text-sm font-extrabold text-white"
                >
                  Check order
                </Link>
              </div>
            )}

            <div className="sticky bottom-0 border-t border-edge bg-surface px-4 py-3">
              <button
                type="button"
                onClick={handleContinue}
                className="h-14 w-full rounded-full border-2 border-ink bg-white text-base font-extrabold text-ink transition-colors active:bg-surface2"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
