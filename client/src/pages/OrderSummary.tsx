import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2, Send, MessageCircle, MessageSquareText, CheckCircle2, PlusCircle, ChevronLeft, Check, ShieldCheck, X,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useData } from '../lib/useData';
import { OFFLINE_MESSAGE } from '../lib/api';
import type { BusinessSettings, Product } from '../lib/types';
import { buildCartOrderMessage, smsOrderUrl, telegramOrderUrl, whatsappOrderUrl } from '../lib/share';
import { EmptyState, IconButton } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { cx, formatPrice } from '../lib/utils';

type Channel = 'whatsapp' | 'telegram' | 'sms';
type Step = 'cart' | 'checkout';

const CHANNELS: { id: Channel; label: string; desc: string; icon: typeof Send }[] = [
  { id: 'whatsapp', label: 'WhatsApp', desc: 'Opens WhatsApp with your order ready to send', icon: MessageCircle },
  { id: 'telegram', label: 'Telegram', desc: 'Opens Telegram with your order ready to send', icon: Send },
  { id: 'sms', label: 'SMS', desc: 'Opens your messaging app — no internet needed', icon: MessageSquareText },
];

/* AliExpress-style commerce accents. */
const CTA = 'bg-[linear-gradient(90deg,#70c72b_0%,#c89b5d_48%,#ec2f7a_100%)] text-white';
const PRICE = 'text-[#ee0a24]';

export function OrderSummary() {
  const { cart, updateCartItem, removeFromCart, toast, online } = useApp();
  const { data: products } = useData<Product[]>('/products');
  const { data: business } = useData<BusinessSettings>('/content/business');

  const [step, setStep] = useState<Step>('cart');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cart.map((i) => i.key)));
  const [orderNote, setOrderNote] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [sending, setSending] = useState<Channel | null>(null);
  const [sent, setSent] = useState<{ channel: Channel; chatUrl: string } | null>(null);
  const prevKeys = useRef<Set<string>>(new Set());

  // Keep selection in sync with the cart: newly added items start selected,
  // removed items drop out (AliExpress behaviour).
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const item of cart) {
        if (prev.has(item.key) || !prevKeys.current.has(item.key)) next.add(item.key);
      }
      prevKeys.current = new Set(cart.map((i) => i.key));
      return next;
    });
  }, [cart]);

  const selectedItems = useMemo(() => cart.filter((i) => selected.has(i.key)), [cart, selected]);
  const allSelected = cart.length > 0 && selectedItems.length === cart.length;

  const selectedTotal = useMemo(() => {
    const priced = selectedItems.filter((i) => i.priceEach != null);
    if (!priced.length) return null;
    return priced.reduce((sum, i) => sum + (i.priceEach || 0) * i.qty, 0);
  }, [selectedItems]);

  const hasQuoteItems = selectedItems.some((i) => i.priceEach == null);
  const selectedCount = selectedItems.reduce((n, i) => n + i.qty, 0);

  const suggestions = useMemo(() => {
    if (!products) return [];
    const inCart = new Set(cart.map((i) => i.productId));
    const suggestedIds = new Set(
      cart.flatMap((i) => products.find((p) => p.id === i.productId)?.suggestedAddonIds || [])
    );
    return products
      .filter((p) => p.isAddon && !inCart.has(p.id) && (suggestedIds.size === 0 || suggestedIds.has(p.id)))
      .slice(0, 4);
  }, [products, cart]);

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(cart.map((i) => i.key)));
  const toggleOne = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const goCheckout = () => {
    if (selectedItems.length === 0) { toast('error', 'Select at least one item to check out.'); return; }
    setStep('checkout');
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (cart.length === 0 || sessionStorage.getItem('mena_open_channel_popup') !== '1') return;
    sessionStorage.removeItem('mena_open_channel_popup');
    setStep('checkout');
    setChannelModalOpen(true);
    window.scrollTo({ top: 0 });
  }, [cart.length]);

  const openChannelModal = () => {
    if (!online) { toast('error', OFFLINE_MESSAGE); return; }
    if (selectedItems.length === 0) { toast('error', 'Select at least one item to check out.'); return; }
    setChannelModalOpen(true);
  };

  const placeOrder = () => {
    if (!online) { toast('error', OFFLINE_MESSAGE); return; }
    const items = selectedItems;
    if (items.length === 0) return;
    setSending(channel);
    // sms: handled by the OS in the current tab; https chat links get a tab
    // opened inside the click gesture so popup blockers allow it.
    const chatTab = channel === 'sms' ? null : window.open('', '_blank');
    try {
      const message = buildCartOrderMessage(items, orderNote, window.location.origin);
      const chatUrl =
        channel === 'whatsapp' ? whatsappOrderUrl(business, message)
        : channel === 'telegram' ? telegramOrderUrl(business, message)
        : smsOrderUrl(business, message);
      setSent({ channel, chatUrl });
      setChannelModalOpen(false);
      items.forEach((i) => removeFromCart(i.key));
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

  /* ------------------------------ success screen ----------------------------- */

  if (sent) {
    const label = CHANNELS.find((c) => c.id === sent.channel)!.label;
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green">
          <CheckCircle2 className="h-8 w-8 text-white" />
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold">Order ready</h1>
        <p className="mt-2 text-sm text-muted">
          {label} should have opened with your order summary — press send there to forward it to our studio. If it did
          not open, use the button below.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <a
            href={sent.chatUrl}
            target={sent.channel === 'sms' ? undefined : '_blank'}
            rel="noopener noreferrer"
            className={cx('inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold', CTA)}
          >
            {sent.channel === 'whatsapp' ? <MessageCircle className="h-4 w-4" /> : sent.channel === 'telegram' ? <Send className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
            Open {label}
          </a>
          <Link to="/catalog" className="text-sm font-semibold text-pink hover:underline">Continue browsing</Link>
        </div>
      </div>
    );
  }

  /* -------------------------------- empty cart ------------------------------- */

  if (cart.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-4xl font-semibold">Your cart</h1>
        <EmptyState>
          Your cart is empty.
          <Link to="/catalog" className="mt-1 font-semibold text-pink hover:underline">Browse the catalog</Link>
        </EmptyState>
      </div>
    );
  }

  /* ------------------------------ checkout screen ----------------------------- */

  if (step === 'checkout') {
    return (
      <div className="pb-28">
        <button onClick={() => setStep('cart')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Back to cart
        </button>
        <h1 className="mt-2 font-serif text-3xl font-semibold">Checkout</h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* Items */}
            <div className="rounded-2xl border border-edge bg-surface p-4">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.06em] text-muted">Your items ({selectedItems.length})</h2>
              <div className="divide-y divide-edge">
                {selectedItems.map((item) => (
                  <div key={item.key} className="flex gap-3 py-3">
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-md border border-edge bg-surface2">
                      {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      {Object.entries(item.variantSelections).length > 0 && (
                        <div className="mt-0.5 truncate text-[12px] text-muted">
                          {Object.entries(item.variantSelections).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </div>
                      )}
                      {item.note && <div className="mt-0.5 truncate text-[12px] italic text-muted">“{item.note}”</div>}
                      <div className="mt-1 flex items-center justify-between">
                        <span className={cx('text-sm font-bold', PRICE)}>
                          {item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}
                        </span>
                        <span className="text-[12px] text-muted">×{item.qty}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message to studio */}
            <div className="rounded-2xl border border-edge bg-surface p-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-muted">Message to the studio</h2>
              <p className="mt-0.5 text-[12px] text-muted">Wording, colours, deadlines — added to your order message.</p>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={3}
                placeholder="Anything else we should know?"
                className="field mt-2 resize-y"
              />
            </div>

            {/* Send channel */}
            <div className="rounded-2xl border border-edge bg-surface p-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-muted">Send order via</h2>
              <p className="mt-1 text-sm text-ink/70">
                Tap Place order and choose WhatsApp, Telegram, or SMS in a popup. The background will blur while you choose.
              </p>
            </div>
          </div>

          {/* Price detail */}
          <div className="h-fit space-y-4 rounded-2xl border border-edge bg-surface p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold">Order summary</h2>
            <div className="space-y-2 border-b border-edge pb-4 text-sm">
              <div className="flex justify-between text-muted">
                <span>Items</span>
                <span className="font-semibold text-ink">{selectedCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="font-semibold text-ink">{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : '—'}</span>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className={cx('text-2xl font-extrabold', PRICE)}>{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : '—'}</span>
            </div>
            {hasQuoteItems && <p className="text-[12px] text-muted">Some items are quoted on request — the studio confirms them with you.</p>}
            <button
              type="button"
              onClick={openChannelModal}
              disabled={!online || sending !== null}
              className={cx('hidden h-12 w-full items-center justify-center rounded-full text-sm font-extrabold disabled:opacity-50 lg:flex', CTA)}
            >
              Place order
            </button>
            <p className="hidden items-center justify-center gap-1.5 text-center text-[11px] text-muted lg:flex">
              <ShieldCheck className="h-3.5 w-3.5" /> No online payment — the studio confirms every detail first.
            </p>
          </div>
        </div>

        {/* Sticky place-order bar (mobile) */}
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-edge bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted">Total</div>
              <div className={cx('truncate text-lg font-extrabold', PRICE)}>{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : '—'}</div>
            </div>
            <button
              type="button"
              onClick={openChannelModal}
              disabled={!online || sending !== null}
              className={cx('h-12 rounded-full px-8 text-sm font-extrabold disabled:opacity-50', CTA)}
            >
              Place order
            </button>
          </div>
        </div>

        {channelModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-md sm:items-center sm:p-4"
            onClick={() => setChannelModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="send-channel-title"
              className="w-full rounded-t-3xl border border-edge bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-pink">Choose send option</p>
                  <h2 id="send-channel-title" className="mt-1 font-serif text-3xl font-semibold text-ink">Place order</h2>
                  <p className="mt-1 text-sm text-muted">
                    Your order summary opens pre-filled. Just press send in your app.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChannelModalOpen(false)}
                  className="rounded-full p-1 text-ink/70 hover:bg-surface2"
                  aria-label="Close send options"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-5 space-y-2.5">
                {CHANNELS.map(({ id, label, desc, icon: Icon }) => {
                  const active = channel === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setChannel(id)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors',
                        active ? 'border-[#ee0a24] bg-[#ee0a24]/5 shadow-sm' : 'border-edge bg-surface hover:border-ink/30'
                      )}
                    >
                      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', active ? 'bg-[#ee0a24] text-white' : 'bg-surface2 text-muted')}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-ink">{label}</span>
                        <span className="block truncate text-[12px] text-muted">{desc}</span>
                      </span>
                      <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border-2', active ? 'border-[#ee0a24] bg-[#ee0a24]' : 'border-edge')}>
                        {active && <Check className="h-3 w-3 text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={placeOrder}
                disabled={!online || sending !== null}
                className={cx('mt-5 flex h-12 w-full items-center justify-center rounded-full text-sm font-extrabold disabled:opacity-50', CTA)}
              >
                {sending ? 'Opening...' : `Continue with ${CHANNELS.find((c) => c.id === channel)?.label}`}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> No online payment. We confirm details first.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------- cart screen ------------------------------ */

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="font-serif text-4xl font-semibold">Your cart</h1>
        <p className="mt-1 text-sm text-muted">Pick the items to order, then check out — no signup, no online payment.</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div className="divide-y divide-edge">
            {cart.map((item) => {
              const checked = selected.has(item.key);
              return (
                <div key={item.key} className="flex gap-3 py-5">
                  <button
                    type="button"
                    onClick={() => toggleOne(item.key)}
                    aria-label={checked ? 'Deselect item' : 'Select item'}
                    className={cx(
                      'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      checked ? 'border-[#ee0a24] bg-[#ee0a24]' : 'border-edge'
                    )}
                  >
                    {checked && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <Link to={`/product/${item.productId}`} className="h-24 w-[70px] shrink-0 overflow-hidden rounded-md border border-edge bg-surface2">
                    {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-semibold">
                          {item.name}
                          {item.isAddon && <span className="ml-2 rounded bg-surface2 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted">add-on</span>}
                        </div>
                        {Object.entries(item.variantSelections).length > 0 && (
                          <div className="mt-1 text-[13px] text-muted">
                            {Object.entries(item.variantSelections).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </div>
                        )}
                      </div>
                      <span className={cx('whitespace-nowrap text-[15px] font-bold', PRICE)}>
                        {item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <QuantityPicker size="sm" value={item.qty} onChange={(qty) => updateCartItem(item.key, { qty })} />
                      <IconButton icon={<Trash2 className="h-4 w-4" />} title="Remove" danger onClick={() => removeFromCart(item.key)} />
                    </div>
                    <input
                      value={item.note}
                      onChange={(e) => updateCartItem(item.key, { note: e.target.value })}
                      placeholder="Notes for this item…"
                      className="field mt-3 py-1.5 text-[13px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {suggestions.length > 0 && (
            <div>
              <h2 className="mb-3 font-serif text-xl font-semibold">Complete the suite</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {suggestions.map((a) => (
                  <div key={a.id} className="rounded-xl border border-edge bg-surface p-3">
                    <div className="truncate text-sm font-semibold">{a.name}</div>
                    <div className="text-[13px] text-muted">{formatPrice(a)}</div>
                    <Link to={`/product/${a.id}`} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-pink hover:underline">
                      <PlusCircle className="h-3.5 w-3.5" /> Add
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary card (desktop) */}
        <div className="hidden h-fit space-y-4 rounded-2xl border border-edge bg-surface p-6 lg:sticky lg:top-24 lg:block">
          <h2 className="text-lg font-bold">Summary</h2>
          <div className="space-y-2 border-b border-edge pb-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>Items selected</span>
              <span className="font-semibold text-ink">{selectedCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Estimated total</span>
              <span className={cx('font-extrabold', PRICE)}>{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : '—'}</span>
            </div>
            {hasQuoteItems && <p className="text-[12px] text-muted">Some items are quoted on request.</p>}
          </div>
          <button
            type="button"
            onClick={goCheckout}
            disabled={selectedItems.length === 0}
            className={cx('flex h-12 w-full items-center justify-center rounded-full text-sm font-extrabold disabled:opacity-50', CTA)}
          >
            Checkout ({selectedItems.length})
          </button>
        </div>
      </div>

      {/* Sticky cart bar (mobile) */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-edge bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button type="button" onClick={toggleAll} className="flex shrink-0 items-center gap-2 text-sm font-semibold text-ink">
            <span className={cx('flex h-5 w-5 items-center justify-center rounded-full border-2', allSelected ? 'border-[#ee0a24] bg-[#ee0a24]' : 'border-edge')}>
              {allSelected && <Check className="h-3 w-3 text-white" />}
            </span>
            All
          </button>
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[11px] text-muted">Total</div>
            <div className={cx('truncate text-lg font-extrabold', PRICE)}>{selectedTotal != null ? `${selectedTotal.toLocaleString()} ETB` : '—'}</div>
          </div>
          <button
            type="button"
            onClick={goCheckout}
            disabled={selectedItems.length === 0}
            className={cx('h-12 shrink-0 rounded-full px-6 text-sm font-extrabold disabled:opacity-50', CTA)}
          >
            Checkout ({selectedItems.length})
          </button>
        </div>
      </div>
    </div>
  );
}
