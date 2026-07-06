import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, ChevronLeft, MessageCircle, MessageSquareText, PlusCircle, Send, ShoppingBag, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useData } from '../lib/useData';
import { OFFLINE_MESSAGE } from '../lib/api';
import type { BusinessSettings, Product } from '../lib/types';
import { buildCartOrderMessage, smsOrderUrl, telegramOrderUrl, whatsappOrderUrl } from '../lib/share';
import { EmptyState } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { mobileProductTint } from '../components/MobileProductCard';
import { formatPrice } from '../lib/utils';

type Channel = 'whatsapp' | 'telegram' | 'sms';
type Step = 'cart' | 'checkout';

const CHANNELS: { id: Channel; label: string; icon: typeof Send; accent: string; tint: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, accent: '#25a34f', tint: 'rgba(37,163,79,.08)' },
  { id: 'telegram', label: 'Telegram', icon: Send, accent: '#2b93d6', tint: 'rgba(43,147,214,.08)' },
  { id: 'sms', label: 'SMS', icon: MessageSquareText, accent: '#ee317b', tint: 'rgba(238,49,123,.08)' },
];

function totalLabel(total: number | null, hasQuote: boolean) {
  if (total != null) return `${total.toLocaleString()} ETB${hasQuote ? ' +' : ''}`;
  return hasQuote ? 'Quote' : '0 ETB';
}

export function MobileOrderSummary() {
  const { cart, addToCart, updateCartItem, removeFromCart, toast, online } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: products } = useData<Product[]>('/products');
  const { data: business } = useData<BusinessSettings>('/content/business');
  const [step, setStep] = useState<Step>('cart');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cart.map((item) => item.key)));
  const [orderNote, setOrderNote] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [sending, setSending] = useState<Channel | null>(null);
  const [sent, setSent] = useState<{ channel: Channel; chatUrl: string; keys: string[] } | null>(null);
  const prevKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSelected((current) => {
      const next = new Set<string>();
      for (const item of cart) {
        if (current.has(item.key) || !prevKeys.current.has(item.key)) next.add(item.key);
      }
      prevKeys.current = new Set(cart.map((item) => item.key));
      return next;
    });
  }, [cart]);

  useEffect(() => {
    const flagged =
      sessionStorage.getItem('mena_go_checkout') === '1'
      || new URLSearchParams(location.search).get('checkout') === '1';
    const rawKeys = sessionStorage.getItem('mena_checkout_keys');
    sessionStorage.removeItem('mena_go_checkout');
    sessionStorage.removeItem('mena_checkout_keys');
    if (!flagged || cart.length === 0) return;
    if (rawKeys) {
      try {
        const keys = JSON.parse(rawKeys);
        if (Array.isArray(keys) && keys.length) setSelected(new Set(keys.filter((key) => typeof key === 'string')));
      } catch {
        /* ignore malformed session state */
      }
    }
    setStep('checkout');
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItems = useMemo(() => cart.filter((item) => selected.has(item.key)), [cart, selected]);
  const allSelected = cart.length > 0 && selectedItems.length === cart.length;
  const selectedTotal = useMemo(() => {
    const priced = selectedItems.filter((item) => item.priceEach != null);
    if (!priced.length) return null;
    return priced.reduce((sum, item) => sum + (item.priceEach || 0) * item.qty, 0);
  }, [selectedItems]);
  const hasQuoteItems = selectedItems.some((item) => item.priceEach == null);
  const selectedQty = selectedItems.reduce((sum, item) => sum + item.qty, 0);
  const cartQty = cart.reduce((sum, item) => sum + item.qty, 0);

  const suggestions = useMemo(() => {
    if (!products) return [];
    const inCart = new Set(cart.map((item) => item.productId));
    const suggestedIds = new Set(
      cart.flatMap((item) => products.find((product) => product.id === item.productId)?.suggestedAddonIds || [])
    );
    return products
      .filter((product) => product.isAddon && !inCart.has(product.id) && (suggestedIds.size === 0 || suggestedIds.has(product.id)))
      .slice(0, 5);
  }, [cart, products]);

  const toggleOne = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(cart.map((item) => item.key)));

  const goCheckout = () => {
    if (!selectedItems.length) {
      toast('error', 'Select at least one item.');
      return;
    }
    setStep('checkout');
    window.scrollTo({ top: 0 });
  };

  const placeOrder = () => {
    if (!online) {
      toast('error', OFFLINE_MESSAGE);
      return;
    }
    if (!selectedItems.length) return;
    setSending(channel);
    const chatTab = channel === 'sms' ? null : window.open('', '_blank');
    if (chatTab) chatTab.opener = null;
    try {
      const message = buildCartOrderMessage(selectedItems, orderNote, window.location.origin);
      const chatUrl =
        channel === 'whatsapp' ? whatsappOrderUrl(business, message)
        : channel === 'telegram' ? telegramOrderUrl(business, message)
        : smsOrderUrl(business, message);
      setSent({ channel, chatUrl, keys: selectedItems.map((item) => item.key) });
      if (channel === 'sms') window.location.href = chatUrl;
      else if (chatTab) chatTab.location.replace(chatUrl);
    } catch (err) {
      chatTab?.close();
      toast('error', (err as Error).message);
      setSent(null);
    } finally {
      setSending(null);
    }
  };

  const finishOrder = () => {
    sent?.keys.forEach((key) => removeFromCart(key));
    setSent(null);
    navigate('/catalog');
  };

  if (sent) {
    const label = CHANNELS.find((item) => item.id === sent.channel)!.label;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10 text-center">
        <div className="mena-check flex h-16 w-16 items-center justify-center rounded-full bg-green text-white">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="mt-5 font-serif text-4xl font-semibold">Order ready</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {label} should have opened with your order summary. Press send there to forward it to the studio.
        </p>
        <a
          href={sent.chatUrl}
          target={sent.channel === 'sms' ? undefined : '_blank'}
          rel="noopener noreferrer"
          className="btn-primary mt-7 w-full max-w-xs"
        >
          Open {label}
        </a>
        <button type="button" onClick={finishOrder} className="btn-outline mt-3 w-full max-w-xs">
          Done - continue browsing
        </button>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-dvh bg-bg">
        <header className="flex h-16 items-center gap-2 border-b border-edge bg-surface px-3">
          <button type="button" onClick={() => navigate(-1)} className="mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2" aria-label="Back">
            <ChevronLeft className="h-5.5 w-5.5" />
          </button>
          <div className="flex-1 font-serif text-[22px] font-semibold">Your cart</div>
        </header>
        <div className="px-4 py-14">
          <EmptyState>
            <ShoppingBag className="mb-2 h-10 w-10 text-edge" />
            Your cart is empty.
            <Link to="/catalog" className="btn-primary mt-3">Browse the catalog</Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  if (step === 'checkout') {
    return (
      <div className="min-h-dvh bg-bg pb-28">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-edge bg-surface px-3">
          <button type="button" onClick={() => setStep('cart')} className="mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2" aria-label="Back">
            <ChevronLeft className="h-5.5 w-5.5" />
          </button>
          <div className="flex-1 font-serif text-[22px] font-semibold">Checkout</div>
          <div className="pr-1 text-[12.5px] text-muted">{selectedItems.length} items</div>
        </header>

        <div className="space-y-4 px-4 py-4">
          <section className="rounded-2xl border border-edge bg-surface p-4">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.06em] text-muted">Items summary</h2>
            <div className="divide-y divide-edge">
              {selectedItems.map((item) => (
                <div key={item.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2">
                    {item.photo ? <img src={item.photo} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: mobileProductTint({ id: item.productId, name: item.name }) }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold">{item.name}</div>
                    {Object.keys(item.variantSelections).length > 0 && (
                      <div className="mt-0.5 truncate text-[12px] text-muted">
                        {Object.entries(item.variantSelections).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-[#ee0a24]">{item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}</span>
                      <span className="text-[12px] text-muted">x{item.qty}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-edge bg-surface p-4">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.06em] text-muted">Send order via</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {CHANNELS.map(({ id, label, icon: Icon, accent, tint }) => {
                const active = channel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChannel(id)}
                    className="mena-press flex min-w-0 flex-col items-center gap-2.5 rounded-2xl border-[1.5px] px-2 py-4"
                    style={{ borderColor: active ? accent : '#ece7e2', background: active ? tint : '#fff' }}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: active ? accent : '#f4f0ec', color: active ? '#fff' : '#a8a29d' }}>
                      <Icon className="h-5.5 w-5.5" />
                    </span>
                    <span className="text-sm font-extrabold" style={{ color: active ? accent : '#1c1a19' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-edge bg-surface p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.06em] text-muted">Message to the studio (optional)</h2>
            <p className="mt-1 text-[12px] text-muted">You can leave this blank. Add wording, colors, deadlines, or special requests only if needed.</p>
            <textarea
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
              rows={4}
              placeholder="Optional: anything else we should know?"
              className="field mt-3 resize-y"
            />
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-edge bg-white/95 px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-8px_24px_rgba(28,26,25,0.07)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted">Amount</div>
              <div className="truncate text-sm font-semibold text-ink">{selectedQty.toLocaleString()} item(s)</div>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <div className="text-[11px] text-muted">Total</div>
              <div className="truncate text-lg font-extrabold text-[#ee0a24]">{totalLabel(selectedTotal, hasQuoteItems)}</div>
            </div>
            <button type="button" onClick={placeOrder} disabled={!online || sending !== null} className="btn-primary h-12 shrink-0 px-5">
              {sending ? 'Opening...' : 'Place order'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg pb-28">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-edge bg-surface px-3">
        <button type="button" onClick={() => navigate(-1)} className="mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2" aria-label="Back">
          <ChevronLeft className="h-5.5 w-5.5" />
        </button>
        <div className="flex-1 font-serif text-[22px] font-semibold">Your cart</div>
        <div className="pr-1 text-[12.5px] text-muted">{cartQty.toLocaleString()} items</div>
      </header>

      <div className="px-4 pt-1">
        {cart.map((item) => {
          const checked = selected.has(item.key);
          return (
            <div key={item.key} className="mena-fade-up flex gap-3 border-b border-edge py-4">
              <button
                type="button"
                onClick={() => toggleOne(item.key)}
                aria-label={checked ? 'Deselect item' : 'Select item'}
                className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2"
                style={{ borderColor: checked ? '#ee0a24' : '#d8cfc8', background: checked ? '#ee0a24' : '#fff' }}
              >
                {checked && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
              <Link to={`/product/${item.productId}`} className="h-24 w-[70px] shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2">
                {item.photo ? <img src={item.photo} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: mobileProductTint({ id: item.productId, name: item.name }) }} />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-extrabold">{item.name}</div>
                    {Object.keys(item.variantSelections).length > 0 && (
                      <div className="mt-1 truncate text-[12px] text-muted">
                        {Object.entries(item.variantSelections).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-[15px] font-extrabold text-[#ee0a24]">
                    {item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <QuantityPicker size="sm" value={item.qty} onChange={(qty) => updateCartItem(item.key, { qty })} />
                  <button type="button" onClick={() => removeFromCart(item.key)} className="mena-press flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface2 hover:text-pink" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {suggestions.length > 0 && (
        <section className="px-4 pt-5">
          <h2 className="font-serif text-2xl font-semibold">Complete the suite</h2>
          <div className="mena-scroll mt-3 flex gap-3 overflow-x-auto pb-1">
            {suggestions.map((product) => (
              <div key={product.id} className="w-32 shrink-0 rounded-2xl border border-edge bg-surface p-2.5">
                <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden rounded-xl bg-surface2" style={{ background: product.photos[0] ? undefined : mobileProductTint(product) }}>
                  {product.photos[0] ? <img src={product.photos[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-2 text-center font-script text-2xl text-pink">{product.name}</div>}
                </Link>
                <div className="mt-2 truncate text-sm font-extrabold">{product.name}</div>
                <div className="text-[12px] font-bold text-[#ee0a24]">{formatPrice(product)}</div>
                <button
                  type="button"
                  onClick={() => {
                    if (product.variants.length) {
                      navigate(`/product/${product.id}`);
                      return;
                    }
                    addToCart({
                      productId: product.id,
                      name: product.name,
                      photo: product.photos[0] || '',
                      isAddon: product.isAddon,
                      pricingMode: product.pricingMode,
                      priceEach: product.pricingMode === 'exact' ? product.price : null,
                      variantSelections: {},
                      qty: 1,
                      note: '',
                    });
                    toast('success', `${product.name} added to cart.`);
                  }}
                  className="btn-primary mt-2 h-9 w-full px-3 py-0 text-[12px]"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-edge bg-white/95 px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-8px_24px_rgba(28,26,25,0.07)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" onClick={toggleAll} className="mena-press flex shrink-0 items-center gap-2 text-sm font-extrabold text-ink">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2" style={{ borderColor: allSelected ? '#ee0a24' : '#d8cfc8', background: allSelected ? '#ee0a24' : '#fff' }}>
              {allSelected && <Check className="h-3 w-3 text-white" />}
            </span>
            All
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted">Amount</div>
            <div className="truncate text-sm font-semibold text-ink">{selectedQty.toLocaleString()} item(s)</div>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[11px] text-muted">Total</div>
            <div className="truncate text-lg font-extrabold text-[#ee0a24]">{totalLabel(selectedTotal, hasQuoteItems)}</div>
          </div>
          <button type="button" onClick={goCheckout} disabled={!selectedItems.length} className="btn-primary h-12 shrink-0 px-5">
            Checkout ({selectedItems.length})
          </button>
        </div>
      </div>
    </div>
  );
}
