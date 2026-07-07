import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, ChevronLeft, MessageCircle, MessageSquareText, PlusCircle, Send, Trash2 } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useData } from '../lib/useData';
import { OFFLINE_MESSAGE } from '../lib/api';
import type { BusinessSettings, Product, UniversalComplimentaryItem } from '../lib/types';
import { buildCartOrderMessage, smsOrderUrl, telegramOrderUrl, whatsappOrderUrl } from '../lib/share';
import { EmptyState, IconButton } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { complimentaryExtraTotal, complimentaryForProduct, complimentarySummary, productWithResolvedComplimentary } from '../lib/complimentary';
import { cx, formatPrice } from '../lib/utils';

type Channel = 'telegram' | 'whatsapp' | 'sms';
type Step = 'cart' | 'checkout';

const CHANNELS: { id: Channel; label: string; icon: typeof Send; accent: string; tint: string }[] = [
  { id: 'telegram', label: 'Telegram', icon: Send, accent: '#2b93d6', tint: 'rgba(43,147,214,.08)' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, accent: '#25a34f', tint: 'rgba(37,163,79,.08)' },
  { id: 'sms', label: 'SMS', icon: MessageSquareText, accent: '#ee317b', tint: 'rgba(238,49,123,.08)' },
];

export function DesktopOrderSummary() {
  const { cart, addToCart, updateCartItem, removeFromCart, toast, online } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: products } = useData<Product[]>('/products');
  const { data: universalComplimentaryItems } = useData<UniversalComplimentaryItem[]>('/complimentary-items');
  const { data: business } = useData<BusinessSettings>('/content/business');

  const [step, setStep] = useState<Step>('cart');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cart.map((item) => item.key)));
  const [orderNote, setOrderNote] = useState('');
  const [channel, setChannel] = useState<Channel>('telegram');
  const [sending, setSending] = useState<Channel | null>(null);
  const [sent, setSent] = useState<{ channel: Channel; chatUrl: string; keys: string[] } | null>(null);
  const prevKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const item of cart) {
        if (prev.has(item.key) || !prevKeys.current.has(item.key)) next.add(item.key);
      }
      prevKeys.current = new Set(cart.map((item) => item.key));
      return next;
    });
  }, [cart]);

  useEffect(() => {
    const flagged = sessionStorage.getItem('mena_go_checkout') === '1' || new URLSearchParams(location.search).get('checkout') === '1';
    sessionStorage.removeItem('mena_go_checkout');
    if (!flagged || cart.length === 0) return;
    setStep('checkout');
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(
    () => new Map((products || []).map((product) => [product.id, productWithResolvedComplimentary(product, universalComplimentaryItems || undefined)])),
    [products, universalComplimentaryItems]
  );
  const selectedItems = useMemo(() => cart.filter((item) => selected.has(item.key)), [cart, selected]);
  const allSelected = cart.length > 0 && selectedItems.length === cart.length;

  const freebiesFor = (item: typeof cart[number]) => {
    const product = productById.get(item.productId);
    const selections = Object.fromEntries((item.complimentaryItems || []).map((freeItem) => [freeItem.name, freeItem.qty]));
    return product ? complimentaryForProduct(product, item.qty, selections) : item.complimentaryItems || [];
  };

  const selectedTotal = useMemo(() => {
    const extras = selectedItems.reduce((sum, item) => sum + complimentaryExtraTotal(freebiesFor(item)), 0);
    const pricedTotal = selectedItems.reduce((sum, item) => sum + (item.priceEach || 0) * item.qty, 0);
    if (pricedTotal === 0 && extras === 0) return null;
    return pricedTotal + extras;
  }, [selectedItems, productById]);

  const selectedCount = selectedItems.reduce((sum, item) => sum + item.qty, 0);
  const hasQuoteItems = selectedItems.some((item) => item.priceEach == null);
  const selectedItemsForMessage = selectedItems.map((item) => ({ ...item, complimentaryItems: freebiesFor(item) }));
  const complimentaryRows = selectedItems.flatMap((item) =>
    freebiesFor(item).filter((freeItem) => freeItem.qty > 0).map((freeItem) => ({
      key: `${item.key}:${freeItem.name}`,
      productName: item.name,
      ...freeItem,
    }))
  );

  const suggestions = useMemo(() => {
    if (!products) return [];
    const inCart = new Set(cart.map((item) => item.productId));
    const suggestedIds = new Set(cart.flatMap((item) => products.find((product) => product.id === item.productId)?.suggestedAddonIds || []));
    return products.filter((product) => product.isAddon && !inCart.has(product.id) && (suggestedIds.size === 0 || suggestedIds.has(product.id))).slice(0, 4);
  }, [products, cart]);

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(cart.map((item) => item.key)));
  const toggleOne = (key: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const goCheckout = () => {
    if (selectedItems.length === 0) {
      toast('error', 'Select at least one item to check out.');
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
    if (selectedItems.length === 0) return;
    setSending(channel);
    const chatTab = channel === 'sms' ? null : window.open('', '_blank');
    if (chatTab) chatTab.opener = null;
    try {
      const message = buildCartOrderMessage(selectedItemsForMessage, orderNote, window.location.origin);
      const chatUrl =
        channel === 'whatsapp' ? whatsappOrderUrl(business, message)
        : channel === 'telegram' ? telegramOrderUrl(business, message)
        : smsOrderUrl(business, message);
      setSent({ channel, chatUrl, keys: selectedItems.map((item) => item.key) });
      if (channel === 'sms') window.location.href = chatUrl;
      else if (chatTab) chatTab.location.replace(chatUrl);
    } catch (error) {
      chatTab?.close();
      toast('error', (error as Error).message);
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
    const channelDef = CHANNELS.find((item) => item.id === sent.channel)!;
    const Icon = channelDef.icon;
    return (
      <div className="mx-auto max-w-[560px] px-10 py-20 text-center">
        <div className="mena-check mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green text-white">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="mt-5 font-serif text-[42px] font-semibold">Order ready</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {channelDef.label} should have opened with your order summary. Press send there to forward it to the studio.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <a href={sent.chatUrl} target={sent.channel === 'sms' ? undefined : '_blank'} rel="noopener noreferrer" className="btn-primary px-8">
            <Icon className="h-4 w-4" />
            Open {channelDef.label}
          </a>
          <button type="button" onClick={finishOrder} className="mena-press text-sm font-bold text-pink hover:underline">
            Done - continue browsing
          </button>
          <button type="button" onClick={() => setSent(null)} className="mena-press text-[12px] font-semibold text-muted hover:text-ink">
            Something went wrong? Your items are still in the cart.
          </button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-[900px] px-10 py-12">
        <button onClick={() => navigate(-1)} className="mena-press inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="mt-4 font-serif text-[44px] font-semibold">Your cart</h1>
        <EmptyState>
          Your cart is empty.
          <Link to="/catalog" className="mt-1 font-bold text-pink hover:underline">Browse the catalog</Link>
        </EmptyState>
      </div>
    );
  }

  if (step === 'checkout') {
    return (
      <div className="mx-auto max-w-[980px] px-10 py-9 pb-28">
        <button onClick={() => setStep('cart')} className="mena-press inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Back to cart
        </button>
        <h1 className="mt-3 font-serif text-[42px] font-semibold">Checkout</h1>

        <div className="mt-7 space-y-6">
          <section className="rounded-2xl border border-edge bg-white p-5 shadow-[0_1px_3px_rgba(28,26,25,0.05)]">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.07em] text-muted">Your items ({selectedItems.length})</h2>
            <div className="divide-y divide-edge">
              {selectedItems.map((item) => (
                <div key={item.key} className="flex gap-4 py-4">
                  <Link to={`/product/${item.productId}`} className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2">
                    {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold">{item.name}</div>
                    {Object.entries(item.variantSelections).length > 0 && (
                      <div className="mt-1 text-[13px] text-muted">{Object.entries(item.variantSelections).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
                    )}
                    {complimentarySummary(freebiesFor(item)) && (
                      <div className="mt-1 text-[13px] font-bold text-green">Complimentary: {complimentarySummary(freebiesFor(item))}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-extrabold text-[#ee0a24]">{item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}</div>
                    <div className="mt-1 text-[12px] text-muted">x{item.qty}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {complimentaryRows.length > 0 && (
            <section className="rounded-2xl border border-green/30 bg-green/10 p-5">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.07em] text-green">Complimentary items</h2>
              <div className="grid grid-cols-2 gap-3">
                {complimentaryRows.map((item) => (
                  <div key={item.key} className="rounded-xl bg-white/75 px-3 py-2.5">
                    <div className="truncate text-sm font-extrabold">{item.name}</div>
                    <div className="mt-0.5 truncate text-[12px] text-muted">Included with {item.productName}</div>
                    <div className="mt-1 font-extrabold text-green">{item.qty.toLocaleString()}</div>
                    {(item.extraQty || 0) > 0 && <div className="text-[11px] font-bold text-[#ee0a24]">+{(item.extraTotal || 0).toLocaleString()} ETB extra</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-edge bg-white p-5 shadow-[0_1px_3px_rgba(28,26,25,0.05)]">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-[0.07em] text-muted">Send order via</h2>
            <div className="grid grid-cols-3 gap-3">
              {CHANNELS.map(({ id, label, icon: Icon, accent, tint }) => {
                const active = channel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChannel(id)}
                    className="mena-press flex flex-col items-center gap-2 rounded-2xl border p-4 text-center"
                    style={{ borderColor: active ? accent : '#ece7e2', background: active ? tint : '#fff' }}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: active ? accent : '#f4f0ec', color: active ? '#fff' : '#8a8580' }}>
                      <Icon className={cx('h-5 w-5', active && 'mena-pop')} />
                    </span>
                    <span className="text-sm font-extrabold" style={{ color: active ? accent : '#1c1a19' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-edge bg-white p-5 shadow-[0_1px_3px_rgba(28,26,25,0.05)]">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.07em] text-muted">Message to the studio (optional)</h2>
            <p className="mt-1 text-[12.5px] text-muted">You can leave this blank. Add wording, colors, deadlines, or special requests only if needed.</p>
            <textarea
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
              rows={4}
              placeholder="Optional: anything else we should know?"
              className="field mt-3 resize-y rounded-2xl"
            />
          </section>
          {hasQuoteItems && <p className="text-[12px] text-muted">Some items are quoted on request. The studio confirms them with you.</p>}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-white/95 px-10 py-4 shadow-[0_-10px_30px_rgba(28,26,25,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-[980px] items-center gap-6">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Amount</div>
              <div className="text-sm font-bold">{selectedCount.toLocaleString()} item(s)</div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Total</div>
              <div className="text-2xl font-extrabold text-[#ee0a24]">{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : 'Quote'}</div>
            </div>
            <button type="button" onClick={placeOrder} disabled={!online || sending !== null} className="btn-primary h-14 px-10">
              {sending ? 'Opening...' : 'Place order'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] px-10 py-9 pb-28">
      <button onClick={() => navigate(-1)} className="mena-press inline-flex items-center gap-1.5 text-[13.5px] font-bold text-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[44px] font-semibold">Your cart</h1>
          <p className="mt-1 text-sm text-muted">Pick the items to order, then check out. No signup, no online payment.</p>
        </div>
        <button type="button" onClick={toggleAll} className="mena-press flex items-center gap-2 text-sm font-extrabold text-ink">
          <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border-2', allSelected ? 'border-[#ee0a24] bg-[#ee0a24]' : 'border-edge bg-white')}>
            {allSelected && <Check className="h-3 w-3 text-white" />}
          </span>
          Select all ({cart.length} items)
        </button>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_340px] gap-10">
        <div className="space-y-8">
          <section className="overflow-hidden rounded-2xl border border-edge bg-white">
            <div className="divide-y divide-edge">
              {cart.map((item) => {
                const checked = selected.has(item.key);
                return (
                  <div key={item.key} className="flex gap-4 p-5">
                    <button
                      type="button"
                      onClick={() => toggleOne(item.key)}
                      aria-label={checked ? 'Deselect item' : 'Select item'}
                      className={cx('mena-press mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-[#ee0a24] bg-[#ee0a24]' : 'border-edge bg-white')}
                    >
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <Link to={`/product/${item.productId}`} className="h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface2">
                      {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-base font-extrabold">{item.name}</div>
                          {Object.entries(item.variantSelections).length > 0 && (
                            <div className="mt-1 text-[13px] text-muted">{Object.entries(item.variantSelections).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
                          )}
                          {complimentarySummary(freebiesFor(item)) && (
                            <div className="mt-1 text-[13px] font-bold text-green">Complimentary: {complimentarySummary(freebiesFor(item))}</div>
                          )}
                        </div>
                        <span className="shrink-0 text-[15px] font-extrabold text-[#ee0a24]">
                          {item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-4">
                        <QuantityPicker
                          size="sm"
                          value={item.qty}
                          onChange={(qty) =>
                            updateCartItem(item.key, {
                              qty,
                              complimentaryItems: productById.get(item.productId)
                                ? complimentaryForProduct(
                                    productById.get(item.productId)!,
                                    qty,
                                    Object.fromEntries((item.complimentaryItems || []).map((freeItem) => [freeItem.name, freeItem.qty]))
                                  )
                                : item.complimentaryItems,
                            })
                          }
                        />
                        <IconButton icon={<Trash2 className="h-4 w-4" />} title="Remove" danger onClick={() => removeFromCart(item.key)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {suggestions.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-2xl font-semibold">Complete the suite</h2>
              <div className="grid grid-cols-4 gap-3">
                {suggestions.map((addon) => (
                  <div key={addon.id} className="rounded-xl border border-edge bg-white p-3">
                    <div className="truncate text-sm font-extrabold">{addon.name}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{formatPrice(addon)}</div>
                    <button
                      type="button"
                      onClick={() => {
                        if ((addon.variants || []).length > 0) {
                          navigate(`/product/${addon.id}`);
                          return;
                        }
                        addToCart({
                          productId: addon.id,
                          name: addon.name,
                          photo: addon.photos[0] || '',
                          isAddon: addon.isAddon,
                          pricingMode: addon.pricingMode,
                          priceEach: addon.pricingMode === 'exact' ? addon.price : null,
                          variantSelections: {},
                          qty: 1,
                          note: '',
                        });
                        toast('success', `${addon.name} added to your cart.`);
                      }}
                      className="mena-press mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-pink hover:underline"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="sticky top-[180px] h-fit rounded-2xl border border-edge bg-white p-6 shadow-[0_1px_3px_rgba(28,26,25,0.05)]">
          <h2 className="text-lg font-extrabold">Order summary</h2>
          <div className="my-5 space-y-3 border-y border-edge py-5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Selected</span>
              <span className="font-bold text-ink">{selectedItems.length} item(s)</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Amount</span>
              <span className="font-bold text-ink">{selectedCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Total</span>
              <span className="font-extrabold text-[#ee0a24]">{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : 'Quote'}</span>
            </div>
          </div>
          <button type="button" onClick={goCheckout} disabled={selectedItems.length === 0} className="btn-primary h-12 w-full">
            Checkout ({selectedItems.length})
          </button>
          <p className="mt-3 text-center text-[12px] text-muted">No online payment · confirm by chat</p>
        </aside>
      </div>
    </div>
  );
}
