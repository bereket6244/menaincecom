import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Clock, ShoppingBag, X } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Product, UniversalComplimentaryItem } from '../lib/types';
import { useApp } from '../store/AppContext';
import { EmptyState, Spinner } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import {
  COMPLIMENTARY_EXTRA_MAX_QTY,
  complimentaryAllowanceText,
  complimentaryForProduct,
  complimentarySummary,
  productWithResolvedComplimentary,
} from '../lib/complimentary';
import { cx, cssColor, formatPrice, isColorGroupName } from '../lib/utils';
import type { AddToCartResult } from '../store/AppContext';

const ADD_TO_CART_BUTTON = 'btn-outline min-w-[180px]';
const BUY_NOW_BUTTON = 'btn-primary min-w-[180px]';

export function DesktopProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, toast, online } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');
  const { data: universalComplimentaryItems } = useData<UniversalComplimentaryItem[]>('/complimentary-items');

  const product = useMemo(() => {
    const found = (products || []).find((p) => p.id === id) || null;
    return found ? productWithResolvedComplimentary(found, universalComplimentaryItems || undefined) : null;
  }, [products, id, universalComplimentaryItems]);

  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoPinned, setPhotoPinned] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [complimentarySelections, setComplimentarySelections] = useState<Record<string, number>>({});
  const [qty, setQty] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const goBack = () => {
    if (location.key === 'default') navigate('/catalog');
    else navigate(-1);
  };

  if (loading && !product) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!product) {
    return (
      <EmptyState>
        Product not found. <Link to="/catalog" className="font-bold text-pink underline">Back to catalog</Link>
      </EmptyState>
    );
  }

  const variantPhoto = product.variants
    .flatMap((variant) => variant.options)
    .find((option) => Object.values(selections).includes(option.label) && option.photo)?.photo;
  const selectedPhoto = (photoPinned ? product.photos[photoIdx] : variantPhoto || product.photos[photoIdx]) || product.photos[0];
  const missingVariant = product.variants.find((variant) => !selections[variant.name]);
  const isQuote = product.pricingMode === 'quote';
  const complimentaryOptions = complimentaryForProduct(product, qty, complimentarySelections);
  const complimentaryText = complimentarySummary(complimentaryOptions);

  const notifyAdded = (name: string, result: AddToCartResult) => {
    toast(
      result === 'updated' ? 'info' : 'success',
      result === 'updated' ? `${name} is already in your cart - quantity updated.` : `${name} added to your cart.`
    );
  };

  const add = (mode: 'increment' | 'replace' = 'increment') => {
    return addToCart({
      productId: product.id,
      name: product.name,
      photo: selectedPhoto || product.photos[0] || '',
      isAddon: product.isAddon,
      pricingMode: product.pricingMode,
      priceEach: product.pricingMode === 'exact' ? product.price : null,
      variantSelections: selections,
      qty,
      note: '',
      complimentaryItems: complimentaryOptions,
    }, mode);
  };

  const requireOptions = () => {
    if (!missingVariant) return false;
    setSheetOpen(true);
    toast('error', `Please choose a ${missingVariant.name.toLowerCase()}.`);
    return true;
  };

  const handleAdd = () => {
    if (requireOptions()) return;
    const result = add();
    setSheetOpen(false);
    notifyAdded(product.name, result);
  };

  const handleBuy = () => {
    if (requireOptions()) return;
    add('replace');
    sessionStorage.setItem('mena_go_checkout', '1');
    navigate('/order?checkout=1');
  };

  const variantPickers = (
    <div className="space-y-5">
      {product.variants.map((group) => {
        const isColor = isColorGroupName(group.name);
        return (
          <div key={group.name}>
            <div className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">
              {group.name}{selections[group.name] ? `: ${selections[group.name]}` : ''}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {group.options.map((option) => {
                const active = selections[group.name] === option.label;
                const swatch = isColor ? cssColor(option.label) : null;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      setSelections((current) => ({ ...current, [group.name]: option.label }));
                      setPhotoPinned(false);
                    }}
                    className={cx(
                      'mena-press inline-flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2.5 text-sm font-bold',
                      active ? 'border-pink bg-pink/10 text-ink' : 'border-edge bg-white text-ink/70 hover:border-pink/60'
                    )}
                  >
                    {swatch && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
                    {option.label}
                    {active && <Check className="h-3.5 w-3.5 text-pink" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1120px] px-10 py-9 pb-24">
      <button onClick={goBack} className="mena-press mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" />
        Back to catalog
      </button>

      <div className="grid grid-cols-[minmax(0,1fr)_440px] items-start gap-14">
        <div className="sticky top-[176px] space-y-4">
          <div className="aspect-[5/6] overflow-hidden rounded-[20px] bg-surface2 shadow-[0_1px_3px_rgba(28,26,25,0.08)]">
            {selectedPhoto ? (
              <img src={selectedPhoto} alt={product.name} loading="eager" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-[#f3e7ea] p-8 text-center">
                <span className="font-script text-[68px] leading-none text-pink">{product.name}</span>
                <span className="mt-5 text-[11px] tracking-[0.24em] text-ink/50">mena inc · Addis Ababa</span>
              </div>
            )}
          </div>
          {product.photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.photos.map((photo, index) => (
                <button
                  key={photo}
                  type="button"
                  onClick={() => {
                    setPhotoIdx(index);
                    setPhotoPinned(true);
                  }}
                  className={cx('mena-press h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-surface2', index === photoIdx ? 'border-pink' : 'border-edge opacity-75')}
                >
                  <img src={photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mena-fade-up">
          <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-muted">{product.isAddon ? 'Add-on item' : 'Design'}</div>
          <h1 className="mt-1.5 font-serif text-[42px] font-semibold leading-[1.05]">{product.name}</h1>
          <div className="mt-3 text-[30px] font-extrabold text-[#ee0a24]">
            {formatPrice(product)}
            {!isQuote && <span className="ml-2 text-sm font-medium text-muted">each</span>}
          </div>
          {product.description && <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.65] text-ink/70">{product.description}</p>}

          <div className="mt-7">{variantPickers}</div>

          <div className="mt-7">
            <div className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Quantity</div>
            <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
          </div>

          {complimentaryOptions.length > 0 && (
            <div className="mt-7 rounded-2xl border border-green/30 bg-green/10 p-4">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-green">Complimentary items</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/70">
                Choose any amount up to the free allowance. Anything above the allowance is shown with its extra price.
              </p>
              <div className="mt-4 space-y-3">
                {complimentaryOptions.map((item) => {
                  const freeQty = item.freeQty ?? item.maxQty ?? item.qty;
                  const selectedQty = Math.min(COMPLIMENTARY_EXTRA_MAX_QTY, Math.max(0, complimentarySelections[item.name] ?? 0));
                  const extraQty = Math.max(0, selectedQty - freeQty);
                  const extraTotal = extraQty * (item.extraPriceEach || 0);
                  return (
                    <div key={item.name} className="rounded-xl bg-white/80 p-3">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold">{item.name}</div>
                          <div className="text-[12px] text-muted">{complimentaryAllowanceText(item)}</div>
                        </div>
                        <div className="text-sm font-extrabold text-green">{selectedQty.toLocaleString()}</div>
                      </div>
                      <QuantityPicker
                        size="sm"
                        min={0}
                        max={COMPLIMENTARY_EXTRA_MAX_QTY}
                        value={selectedQty}
                        onChange={(nextQty) => setComplimentarySelections((current) => ({ ...current, [item.name]: nextQty }))}
                      />
                      {extraQty > 0 && (
                        <div className="mt-2 text-[12px] font-bold text-[#ee0a24]">
                          Extra: {extraQty.toLocaleString()} x {(item.extraPriceEach || 0).toLocaleString()} ETB = {extraTotal.toLocaleString()} ETB
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {complimentaryText && <div className="mt-3 text-[12px] font-bold text-green">Selected: {complimentaryText}</div>}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={handleAdd} className={ADD_TO_CART_BUTTON}>
              <ShoppingBag className="h-4 w-4" />
              Add to cart
            </button>
            <button type="button" onClick={handleBuy} className={BUY_NOW_BUTTON}>
              Buy now
            </button>
          </div>
          {!online && <p className="mt-3 text-[12px] font-semibold text-amber-700">You are offline - sending an order requires a connection.</p>}

          <div className="mt-7 flex items-start gap-3 rounded-xl bg-surface2 p-4 text-[13.5px] leading-relaxed text-ink/70">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-pink" />
            Send your order by Telegram, WhatsApp, or SMS. No online payment - the studio confirms every detail with you first.
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-[70] bg-ink/50 p-6" onClick={() => setSheetOpen(false)}>
          <div
            className="modal-panel mx-auto mt-[9vh] max-h-[82vh] w-[540px] overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.3)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-edge bg-white p-5">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-surface2">
                {selectedPhoto && <img src={selectedPhoto} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-2xl font-semibold leading-tight">{product.name}</div>
                <div className="mt-1 text-sm font-semibold text-muted">
                  {Object.keys(selections).length ? Object.entries(selections).map(([k, v]) => `${k}: ${v}`).join(', ') : 'Choose your options'}
                </div>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} className="mena-press rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-ink" aria-label="Close options">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-5">
              {variantPickers}
              <div>
                <div className="mb-2.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted">Quantity</div>
                <QuantityPicker value={qty} onChange={setQty} presets={[100, 250, 500, 1000]} />
              </div>
            </div>
            <div className="sticky bottom-0 flex gap-3 border-t border-edge bg-white p-4">
              <button type="button" onClick={handleAdd} className="btn-outline h-14 flex-1">Add to cart</button>
              <button type="button" onClick={handleBuy} className="btn-primary h-14 flex-1">Buy now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
