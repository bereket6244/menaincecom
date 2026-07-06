import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ShoppingBag, X } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Category, Product, UniversalComplimentaryItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { EmptyState, Spinner } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { mobileProductTint } from '../components/MobileProductCard';
import { COMPLIMENTARY_EXTRA_MAX_QTY, complimentaryAllowanceText, complimentaryForProduct, complimentarySummary, productWithResolvedComplimentary } from '../lib/complimentary';
import { cx, cssColor, formatPrice, isColorGroupName } from '../lib/utils';
import type { AddToCartResult } from '../store/AppContext';

type SheetMode = 'add' | 'buy';

function flyToCart(origin: HTMLElement | null, product: Product) {
  const target = document.getElementById('mena-cart-icon');
  if (!origin || !target) return;
  const from = origin.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const clone = document.createElement('div');
  clone.textContent = product.name.slice(0, 1);
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left + from.width / 2 - 16}px`,
    top: `${from.top + from.height / 2 - 16}px`,
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    zIndex: '90',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: product.photos[0] ? '#ee317b' : mobileProductTint(product),
    color: product.photos[0] ? '#fff' : '#ee317b',
    fontFamily: 'var(--font-serif)',
    fontWeight: '700',
    boxShadow: '0 8px 22px rgba(238,49,123,.28)',
    pointerEvents: 'none',
  });
  document.body.appendChild(clone);
  clone.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top + to.height / 2 - from.top - from.height / 2}px) scale(.25)`,
        opacity: 0.35,
      },
    ],
    { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }
  ).onfinish = () => {
    clone.remove();
    target.classList.remove('mena-pop');
    void target.offsetWidth;
    target.classList.add('mena-pop');
  };
}

export function MobileProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, cart, toast } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');
  const { data: categories } = useData<Category[]>('/categories');
  const { data: universalComplimentaryItems } = useData<UniversalComplimentaryItem[]>('/complimentary-items');
  const product = useMemo(() => {
    const found = (products || []).find((p) => p.id === id) || null;
    return found ? productWithResolvedComplimentary(found, universalComplimentaryItems) : null;
  }, [products, id, universalComplimentaryItems]);
  const categoryName = categories?.find((category) => category.id === product?.categoryId)?.name || 'Wedding Cards';
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [complimentarySelections, setComplimentarySelections] = useState<Record<string, number>>({});
  const [qty, setQty] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('add');
  const cartCount = cart.reduce((n, item) => n + item.qty, 0);
  const complimentaryOptions = useMemo(
    () => (product ? complimentaryForProduct(product, qty) : []),
    [product, qty]
  );

  useEffect(() => {
    setComplimentarySelections((current) => {
      const next: Record<string, number> = {};
      for (const item of complimentaryOptions) {
        const maxQty = COMPLIMENTARY_EXTRA_MAX_QTY;
        const existing = current[item.name];
        next[item.name] = existing == null ? 0 : Math.min(maxQty, Math.max(0, existing));
      }
      return next;
    });
  }, [complimentaryOptions]);

  const goBack = () => {
    if (location.key === 'default') navigate('/catalog');
    else navigate(-1);
  };

  if (loading && !product) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!product) {
    return (
      <div className="p-4">
        <EmptyState>Product not found. <Link to="/catalog" className="font-semibold text-pink underline">Back to catalog</Link></EmptyState>
      </div>
    );
  }

  const selectedPhoto =
    product.variants
      .flatMap((variant) => variant.options)
      .find((option) => Object.values(selections).includes(option.label) && option.photo)?.photo
    || product.photos[0];
  const missingVariant = product.variants.find((variant) => !selections[variant.name]);
  const tint = mobileProductTint(product);
  const isQuote = product.pricingMode === 'quote';
  const complimentaryItems = complimentaryForProduct(product, qty, complimentarySelections);
  const complimentaryText = complimentarySummary(complimentaryItems);

  const notifyAdded = (result: AddToCartResult) => {
    toast(
      result === 'updated' ? 'info' : 'success',
      result === 'updated' ? `${product.name} quantity updated.` : `${product.name} added to cart.`
    );
  };

  const add = (mode: 'increment' | 'replace' = 'increment') => {
    const selectedComplimentaryItems = complimentaryForProduct(product, qty, complimentarySelections);
    return addToCart({
      productId: product.id,
      name: product.name,
      photo: product.photos[0] || '',
      isAddon: product.isAddon,
      pricingMode: product.pricingMode,
      priceEach: product.pricingMode === 'exact' ? product.price : null,
      variantSelections: selections,
      qty,
      note: '',
      complimentaryItems: selectedComplimentaryItems,
    }, mode);
  };

  const requireOptions = () => {
    if (!missingVariant) return false;
    toast('error', `Please choose a ${missingVariant.name.toLowerCase()}.`);
    return true;
  };

  const addFrom = (origin: HTMLElement | null) => {
    if (requireOptions()) return;
    flyToCart(origin, product);
    notifyAdded(add());
    setSheetOpen(false);
  };

  const buyNow = () => {
    if (requireOptions()) return;
    const key = `${product.id}|${JSON.stringify(selections)}`;
    add('replace');
    sessionStorage.setItem('mena_go_checkout', '1');
    sessionStorage.setItem('mena_checkout_keys', JSON.stringify([key]));
    setSheetOpen(false);
    navigate('/order?checkout=1');
  };

  const openSheet = (mode: SheetMode) => {
    setSheetMode(mode);
    setSheetOpen(true);
  };

  const runAction = (mode: SheetMode, origin: HTMLElement | null) => {
    if (mode === 'buy') buyNow();
    else addFrom(origin);
  };

  return (
    <div className="min-h-dvh bg-bg pb-44">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-edge bg-surface px-3">
        <button type="button" onClick={goBack} aria-label="Back" className="mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2">
          <ChevronLeft className="h-5.5 w-5.5" />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-muted">{categoryName}</div>
        <Link
          id="mena-cart-icon"
          to="/order"
          aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
          className="mena-press relative flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2"
        >
          <ShoppingBag className="h-5.5 w-5.5" />
          {cartCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ee0a24] px-1 text-[10px] font-extrabold text-white">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>
      </header>

      <div className="mena-scroll overflow-y-auto">
        <div className="aspect-[5/7] max-h-[420px] w-full bg-surface2" style={{ background: selectedPhoto ? undefined : tint }}>
          {selectedPhoto ? (
            <img src={selectedPhoto} alt={product.name} loading="eager" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <span className="font-script text-[52px] leading-none text-pink">{product.name}</span>
              <span className="mt-4 text-[10px] uppercase tracking-[0.24em] text-ink/50">Mena Inc. · Addis Ababa</span>
            </div>
          )}
        </div>

        <section className="px-[18px] pb-2 pt-[18px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{product.isAddon ? 'Add-on item' : categoryName}</div>
          <h1 className="mt-1 font-serif text-[30px] font-semibold leading-[1.15]">{product.name}</h1>
          <div className="mt-2 text-[26px] font-extrabold text-[#ee0a24]">
            {formatPrice(product)}
            {!isQuote && <span className="ml-1 text-[13px] font-medium text-muted">each</span>}
          </div>
          {product.description && <p className="mt-3 whitespace-pre-line text-[14.5px] leading-[1.55] text-ink/70">{product.description}</p>}
        </section>

        <section className="space-y-4 px-[18px] pt-2">
          {product.variants.map((group) => {
            const isColor = isColorGroupName(group.name);
            return (
              <div key={group.name}>
                <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{group.name}</div>
                <div className="flex flex-wrap gap-2.5">
                  {group.options.map((option) => {
                    const active = selections[group.name] === option.label;
                    const swatch = isColor ? cssColor(option.label) : null;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setSelections((current) => ({ ...current, [group.name]: option.label }))}
                        className={cx(
                          'mena-press inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2.5 text-sm font-semibold',
                          active ? 'border-pink bg-pink/10 text-ink' : 'border-edge bg-white text-ink/70'
                        )}
                      >
                        {swatch && <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <section className="px-[18px] pt-5">
          <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Amount</div>
          <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
        </section>

        {complimentaryOptions.length > 0 && (
          <section className="px-[18px] pt-4">
            <div className="rounded-2xl border border-green/30 bg-green/10 p-4">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-green">Complimentary items</div>
              <div className="mt-3 space-y-3">
                {complimentaryOptions.map((item) => {
                  const freeQty = item.freeQty ?? item.maxQty ?? item.qty;
                  const selectedQty = complimentarySelections[item.name] ?? 0;
                  const extraQty = Math.max(0, selectedQty - freeQty);
                  const extraTotal = extraQty * (item.extraPriceEach || 0);
                  return (
                    <div key={item.name} className="rounded-xl bg-white/75 p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-ink">{item.name}</div>
                          <div className="text-[12px] text-muted">{complimentaryAllowanceText(item)}</div>
                        </div>
                        <div className="shrink-0 text-sm font-extrabold text-green">
                          {selectedQty.toLocaleString()}
                        </div>
                      </div>
                      <QuantityPicker
                        size="sm"
                        min={0}
                        max={COMPLIMENTARY_EXTRA_MAX_QTY}
                        value={selectedQty}
                        onChange={(nextQty) => setComplimentarySelections((current) => ({ ...current, [item.name]: nextQty }))}
                      />
                      {extraQty > 0 && (
                        <div className="mt-2 text-[12px] font-semibold text-[#ee0a24]">
                          Extra: {extraQty.toLocaleString()} x {(item.extraPriceEach || 0).toLocaleString()} ETB = {extraTotal.toLocaleString()} ETB
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {complimentaryText && <div className="mt-3 text-[12px] font-semibold text-green">Selected: {complimentaryText}</div>}
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-edge bg-white/95 px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-8px_24px_rgba(28,26,25,0.07)] backdrop-blur">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted">Amount</div>
              <div className="text-sm font-semibold text-ink">{qty.toLocaleString()} item(s)</div>
            </div>
            <QuantityPicker size="sm" value={qty} onChange={setQty} />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 shrink">
            <div className="text-[11px] text-muted">Total each</div>
            <div className="truncate text-[19px] font-extrabold text-[#ee0a24]">{formatPrice(product)}</div>
            </div>
            <button
              type="button"
              onClick={(event) => {
                if (product.variants.length && missingVariant) openSheet('add');
                else addFrom(event.currentTarget);
              }}
              className="btn-outline h-[50px] min-w-0 flex-1 px-3 text-sm"
            >
              Add to cart
            </button>
            <button
              type="button"
              onClick={() => {
                if (product.variants.length && missingVariant) openSheet('buy');
                else buyNow();
              }}
              className="btn-primary h-[50px] min-w-0 flex-1 px-3 text-sm"
            >
              Buy now
            </button>
          </div>
        </div>
      </div>

      <div
        className={cx('fixed inset-0 z-50 bg-ink/50 transition-opacity duration-300', sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={() => setSheetOpen(false)}
      />
      <section
        className={cx(
          'fixed inset-x-0 bottom-0 z-[51] mx-auto max-h-[88dvh] max-w-[430px] overflow-y-auto rounded-t-3xl bg-surface shadow-[0_-12px_40px_rgba(0,0,0,.2)] transition-transform duration-[340ms]',
          sheetOpen ? 'translate-y-0' : 'translate-y-[110%]'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(.3,1,.4,1)' }}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-edge bg-surface px-4 py-4">
          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2" style={{ background: selectedPhoto ? undefined : tint }}>
            {selectedPhoto ? (
              <img src={selectedPhoto} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center font-script text-xl text-pink">M</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-extrabold text-ink">{product.name}</div>
            <div className="mt-1 text-sm text-muted">
              {Object.entries(selections).length
                ? Object.entries(selections).map(([key, value]) => `${key}: ${value}`).join(', ')
                : 'Choose your options'}
            </div>
          </div>
          <button type="button" onClick={() => setSheetOpen(false)} className="mena-press rounded-full p-1 text-muted hover:bg-surface2 hover:text-ink" aria-label="Close options">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6 px-4 py-5">
          <div className="rounded-2xl border border-pink/20 bg-pink/5 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-pink">Mena order price</div>
            <div className="mt-1 text-3xl font-extrabold text-[#ee0a24]">{formatPrice(product)}</div>
            <p className="mt-2 text-xs font-semibold text-pink-dim">No online payment. Send the order summary and our studio confirms details with you.</p>
          </div>

          {product.variants.map((group) => {
            const isColor = isColorGroupName(group.name);
            return (
              <div key={group.name}>
                <h3 className="mb-3 text-lg font-extrabold text-ink">{group.name}: {selections[group.name] || 'Select'}</h3>
                <div className="flex flex-wrap gap-2.5">
                  {group.options.map((option) => {
                    const active = selections[group.name] === option.label;
                    const swatch = isColor ? cssColor(option.label) : null;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setSelections((current) => ({ ...current, [group.name]: option.label }))}
                        className={cx(
                          'mena-press inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2.5 text-sm font-semibold',
                          active ? 'border-ink bg-white text-ink' : 'border-edge bg-white text-ink/75'
                        )}
                      >
                        {swatch && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <h3 className="mb-3 text-lg font-extrabold text-ink">Qty</h3>
            <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-edge bg-surface px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <button type="button" onClick={(event) => runAction('add', event.currentTarget)} className="btn-outline h-14 flex-1">
            Add to cart
          </button>
          <button type="button" onClick={() => runAction(sheetMode === 'buy' ? 'buy' : 'buy', null)} className="btn-primary h-14 flex-1">
            Buy now
          </button>
        </div>
      </section>
    </div>
  );
}
