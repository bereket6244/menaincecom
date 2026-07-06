import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, LayoutGrid, ShoppingBag, X } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Product } from '../lib/types';
import { useApp } from '../store/AppContext';
import { Spinner, SysLabel, EmptyState } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { complimentaryForProduct, complimentarySummary } from '../lib/complimentary';
import { cx, cssColor, formatPrice, isColorGroupName } from '../lib/utils';
import type { AddToCartResult } from '../store/AppContext';

const ADD_TO_CART_BUTTON = 'border-2 border-pink bg-white text-pink hover:bg-pink/5';
const BUY_NOW_BUTTON = 'bg-pink text-white shadow-sm hover:bg-pink-dim';

export function DesktopProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, cart, toast, online } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');

  const product = useMemo(() => (products || []).find((p) => p.id === id) || null, [products, id]);
  const [photoIdx, setPhotoIdx] = useState(0);
  // A clicked thumbnail pins the main photo; picking a variant unpins it so
  // the variant's own photo can take over.
  const [photoPinned, setPhotoPinned] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [complimentarySelections, setComplimentarySelections] = useState<Record<string, number>>({});
  const [qty, setQty] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const complimentaryOptions = useMemo(
    () => (product ? complimentaryForProduct(product, qty) : []),
    [product, qty]
  );

  const notifyAdded = (name: string, result: AddToCartResult) => {
    toast(
      result === 'updated' ? 'info' : 'success',
      result === 'updated' ? `${name} is already in your cart — quantity updated.` : `${name} added to your cart.`
    );
  };

  const goBack = () => {
    // Direct visits (shared links) have no in-app history — don't exit the site.
    if (location.key === 'default') navigate('/catalog');
    else navigate(-1);
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

  const missingVariant = product.variants.find((v) => !selections[v.name]);
  const isQuote = product.pricingMode === 'quote';
  const complimentaryItems = complimentaryForProduct(product, qty, complimentarySelections);
  const complimentaryText = complimentarySummary(complimentaryItems);

  const add = (p: Product, selectedVariants: Record<string, string>, quantity: number, mode: 'increment' | 'replace' = 'increment') => {
    return addToCart({
      productId: p.id,
      name: p.name,
      photo: p.photos[0] || '',
      isAddon: p.isAddon,
      pricingMode: p.pricingMode,
      priceEach: p.pricingMode === 'exact' ? p.price : null,
      variantSelections: selectedVariants,
      qty: quantity,
      note: '',
      complimentaryItems: complimentaryForProduct(p, quantity),
    }, mode);
  };

  // Add to cart: stacks quantity, closes the sheet, stays on this product.
  const handleAdd = () => {
    if (missingVariant) {
      toast('error', `Please choose a ${missingVariant.name.toLowerCase()}.`);
      return;
    }
    const result = add(product, selections, qty);
    setSheetOpen(false);
    notifyAdded(product.name, result);
  };

  // Buy now: takes the current selection straight to checkout. 'replace' keeps
  // an earlier "Add to cart" tap from doubling the quantity.
  const handleOrderNow = () => {
    if (missingVariant) {
      toast('error', `Please choose a ${missingVariant.name.toLowerCase()}.`);
      return;
    }
    add(product, selections, qty, 'replace');
    sessionStorage.setItem('mena_go_checkout', '1');
    navigate('/order?checkout=1');
  };

  // Sticky-bar Buy now on mobile: if options still need choosing, open the
  // sheet where they can be chosen instead of erroring at the bottom of the page.
  const handleBarOrderNow = () => {
    if (missingVariant) {
      setSheetOpen(true);
      return;
    }
    handleOrderNow();
  };

  const handleBarAdd = () => {
    if (product.variants.length === 0) {
      handleAdd();
      return;
    }
    setSheetOpen(true);
  };

  return (
    <div className="space-y-12 pb-44 md:pb-0">
      <button onClick={goBack} className="mena-press inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Back to catalog
      </button>

      <div className="grid gap-10 md:grid-cols-2 lg:gap-14">
        {/* Photos */}
        <div className="mena-fade-up space-y-4">
          <div className="aspect-[5/7] max-w-md overflow-hidden rounded-lg border border-edge bg-surface2 shadow-md">
            {selectedPhoto ? (
              <img src={selectedPhoto} alt={product.name} loading="eager" decoding="async" className="h-full w-full object-cover" />
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
                    'mena-press h-16 w-14 shrink-0 overflow-hidden rounded-md border-2',
                    i === photoIdx ? 'border-pink' : 'border-edge opacity-70'
                  )}
                >
                  <img src={ph} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Details */}
        <div className="mena-fade-up space-y-6">
          <div>
            {product.isAddon ? (
              <SysLabel>Add-on item</SysLabel>
            ) : (
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Design</div>
            )}
            <h1 className="mt-1.5 font-serif text-4xl font-semibold leading-tight">{product.name}</h1>
            <div className="mt-2 text-3xl font-extrabold text-[#ee0a24]">
              {formatPrice(product)}
              {!isQuote && <span className="ml-1 text-sm font-medium text-muted">each</span>}
            </div>
          </div>

          {product.description && (
            <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink/70">{product.description}</p>
          )}

          {product.variants.map((group) => {
            const isColor = isColorGroupName(group.name);
            return (
              <div key={group.name}>
                <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{group.name}</div>
                <div className="flex flex-wrap gap-2.5">
                  {group.options.map((opt) => {
                    const swatch = isColor ? cssColor(opt.label) : null;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => { setSelections((s) => ({ ...s, [group.name]: opt.label })); setPhotoPinned(false); }}
                        className={cx(
                          'mena-press inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                          selections[group.name] === opt.label
                            ? 'border-pink bg-pink/10 text-ink'
                            : 'border-edge bg-surface text-ink/70 hover:border-ink/40'
                        )}
                      >
                        {swatch && <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Quantity</div>
            <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
            <p className="mt-2 text-[12px] text-muted">Type the exact amount in the quantity box, tap a preset, or use - / +.</p>
          </div>

          {complimentaryOptions.length > 0 && (
            <div className="rounded-xl border border-green/30 bg-green/10 p-4">
              <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-green">Complimentary items</div>
              <div className="mt-3 space-y-3">
                {complimentaryOptions.map((item) => {
                  const maxQty = item.maxQty || item.qty;
                  const selectedQty = Math.min(maxQty, Math.max(0, complimentarySelections[item.name] ?? maxQty));
                  return (
                    <div key={item.name} className="rounded-xl bg-white/75 p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-ink">{item.name}</div>
                          <div className="text-[12px] text-muted">Choose 0 to {maxQty.toLocaleString()}</div>
                        </div>
                        <div className="text-sm font-extrabold text-green">{selectedQty.toLocaleString()}</div>
                      </div>
                      <QuantityPicker
                        size="sm"
                        min={0}
                        max={maxQty}
                        value={selectedQty}
                        onChange={(nextQty) => setComplimentarySelections((current) => ({ ...current, [item.name]: nextQty }))}
                      />
                    </div>
                  );
                })}
              </div>
              {complimentaryText && <div className="mt-3 text-[12px] font-semibold text-green">Selected: {complimentaryText}</div>}
            </div>
          )}


          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={handleAdd}
              className={cx('mena-press inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-extrabold transition-colors active:scale-[0.98]', ADD_TO_CART_BUTTON)}
            >
              <ShoppingBag className="h-4 w-4" />
              Add to cart
            </button>
            <button
              onClick={handleOrderNow}
              className={cx('mena-press inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-extrabold transition-colors active:scale-[0.98]', BUY_NOW_BUTTON)}
            >
              Buy now
            </button>
          </div>
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
              <div key={a.id} className="mena-fade-up overflow-hidden rounded-xl border border-edge bg-surface">
                <Link to={`/product/${a.id}`} className="mena-press block aspect-square bg-surface2">
                  {a.photos[0] ? (
                    <img src={a.photos[0]} alt={a.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
                      const result = add(a, {}, 1);
                      notifyAdded(a.name, result);
                    }}
                    className="mena-press mt-2.5 w-full rounded-lg bg-pink py-2 text-[13px] font-bold text-white transition-colors hover:bg-pink-dim"
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
        <div className="mx-auto max-w-6xl space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-ink">{product.name}</div>
              <div className="text-base font-extrabold text-[#ee0a24]">{formatPrice(product)}</div>
            </div>
            <QuantityPicker size="sm" value={qty} onChange={setQty} />
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/catalog"
              aria-label="Catalog"
              className="flex h-12 w-10 shrink-0 items-center justify-center text-ink"
            >
              <LayoutGrid className="h-5 w-5" />
            </Link>
            <Link
              to="/order"
              aria-label={`Order cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative flex h-12 w-10 shrink-0 items-center justify-center text-ink"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[9px] font-extrabold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <div className="flex h-14 flex-1 overflow-hidden rounded-full border-2 border-pink bg-white shadow-sm">
              <button
                type="button"
                onClick={handleBarAdd}
                className="flex-1 bg-white px-4 text-base font-extrabold text-pink transition-colors hover:bg-pink/5"
              >
                Add to cart
              </button>
              <button
                type="button"
                onClick={handleBarOrderNow}
                className="flex-1 bg-pink px-4 text-base font-extrabold text-white transition-colors hover:bg-pink-dim"
              >
                Buy now
              </button>
            </div>
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/45 md:hidden" onClick={() => setSheetOpen(false)}>
          <div
            className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-edge bg-surface px-4 py-4">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2">
                {selectedPhoto ? (
                  <img src={selectedPhoto} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" />
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
                onClick={() => setSheetOpen(false)}
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
                    <div className="mt-1 text-3xl font-extrabold text-[#ee0a24]">{formatPrice(product)}</div>
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
                      const swatch = !opt.photo && isColorGroupName(group.name) ? cssColor(opt.label) : null;
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
                              <img src={opt.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            </div>
                          )}
                          <span className="flex items-center justify-center gap-1.5 truncate px-1">
                            {swatch && <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
                            {opt.label}
                          </span>
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

            </div>

            <div className="sticky bottom-0 flex gap-3 border-t border-edge bg-surface px-4 py-3">
              <button
                type="button"
                onClick={handleAdd}
                className={cx('h-14 flex-1 rounded-full text-base font-extrabold transition-colors active:scale-[0.98]', ADD_TO_CART_BUTTON)}
              >
                Add to cart
              </button>
              <button
                type="button"
                onClick={handleOrderNow}
                className={cx('h-14 flex-1 rounded-full text-base font-extrabold transition-colors active:scale-[0.98]', BUY_NOW_BUTTON)}
              >
                Buy now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
