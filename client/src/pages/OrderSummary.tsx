import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Send, MessageCircle, MessageSquareText, CheckCircle2, PlusCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useData } from '../lib/useData';
import { OFFLINE_MESSAGE } from '../lib/api';
import type { BusinessSettings, Product } from '../lib/types';
import { buildCartOrderMessage, smsOrderUrl, telegramOrderUrl, whatsappOrderUrl } from '../lib/share';
import { Button, EmptyState, IconButton } from '../components/ui';
import { QuantityPicker } from '../components/QuantityPicker';
import { formatPrice } from '../lib/utils';

type Channel = 'whatsapp' | 'telegram' | 'sms';

const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  sms: 'SMS',
};

export function OrderSummary() {
  const { cart, updateCartItem, removeFromCart, clearCart, toast, online } = useApp();
  const { data: products } = useData<Product[]>('/products');
  const { data: business } = useData<BusinessSettings>('/content/business');

  const [orderNote, setOrderNote] = useState('');
  const [sending, setSending] = useState<Channel | null>(null);
  const [sent, setSent] = useState<{ channel: Channel; chatUrl: string } | null>(null);

  const estimatedTotal = useMemo(() => {
    const priced = cart.filter((i) => i.priceEach != null);
    if (!priced.length) return null;
    return priced.reduce((sum, i) => sum + (i.priceEach || 0) * i.qty, 0);
  }, [cart]);

  const hasQuoteItems = cart.some((i) => i.priceEach == null);

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

  const send = async (channel: Channel) => {
    if (!online) { toast('error', OFFLINE_MESSAGE); return; }
    if (cart.length === 0) return;
    setSending(channel);
    // sms: links are handled by the OS in the current tab; https chat links get
    // a tab opened inside the click gesture so popup blockers allow it.
    const chatTab = channel === 'sms' ? null : window.open('', '_blank');
    try {
      // No credentials required — signed-in customers get their contact
      // details attached automatically, guests just send the chat message.
      const message = buildCartOrderMessage(cart, orderNote, window.location.origin);
      const chatUrl =
        channel === 'whatsapp' ? whatsappOrderUrl(business, message)
        : channel === 'telegram' ? telegramOrderUrl(business, message)
        : smsOrderUrl(business, message);
      setSent({ channel, chatUrl });
      clearCart();
      if (channel === 'sms') {
        window.location.href = chatUrl;
      } else if (chatTab) {
        chatTab.location.replace(chatUrl);
      }
      toast(
        'success',
        channel === 'sms' || chatTab
          ? `${CHANNEL_LABEL[channel]} opened with your order summary — just press send.`
          : `Tap "Open ${CHANNEL_LABEL[channel]}" to send the summary.`
      );
    } catch (err) {
      chatTab?.close();
      toast('error', (err as Error).message);
    } finally {
      setSending(null);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green">
          <CheckCircle2 className="h-8 w-8 text-white" />
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold">Order ready</h1>
        <p className="mt-2 text-sm text-muted">
          {CHANNEL_LABEL[sent.channel]} should have opened with the summary — press send there to forward it to our
          studio. If it did not open, use the button below.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <a
            href={sent.chatUrl}
            target={sent.channel === 'sms' ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-pink px-6 py-2.5 text-sm font-bold text-white hover:bg-pink-dim"
          >
            {sent.channel === 'whatsapp' ? <MessageCircle className="h-4 w-4" /> : sent.channel === 'telegram' ? <Send className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
            Open {CHANNEL_LABEL[sent.channel]}
          </a>
          <Link to="/catalog" className="text-sm font-semibold text-pink hover:underline">
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-4xl font-semibold">Your order</h1>
        <EmptyState>
          Your order is empty.
          <Link to="/catalog" className="mt-1 font-semibold text-pink hover:underline">Browse the catalog</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl font-semibold">Your order</h1>
        <p className="mt-1 text-sm text-muted">
          Review your selection, then send it to our studio on WhatsApp, Telegram or SMS — no signup needed.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div className="divide-y divide-edge">
            {cart.map((item) => (
              <div key={item.key} className="flex gap-4 py-5">
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
                    <span className="whitespace-nowrap text-[15px] font-bold text-ink">
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
            ))}
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

        {/* Summary card */}
        <div className="h-fit space-y-4 rounded-2xl border border-edge bg-surface p-6">
          <h2 className="text-lg font-bold">Summary</h2>

          <div className="space-y-2 border-b border-edge pb-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>Items</span>
              <span className="font-semibold text-ink">{cart.reduce((n, i) => n + i.qty, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Estimated total</span>
              <span className="font-bold text-ink">
                {estimatedTotal != null ? `${estimatedTotal.toLocaleString()} ETB` : '—'}
              </span>
            </div>
            {hasQuoteItems && (
              <p className="text-[12px] text-muted">Some items are priced on request — the team will quote them when they contact you.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Anything extra?</h3>
            <p className="text-[12px] text-muted">Wording, colours, deadlines — it will be included in your message.</p>
          </div>
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            rows={2}
            placeholder="Anything else we should know?"
            className="field resize-y"
          />

          <div className="space-y-2.5 border-t border-edge pt-4">
            <Button variant="primary" className="w-full py-3" busy={sending === 'whatsapp'} disabled={!online || sending !== null} onClick={() => send('whatsapp')}>
              <MessageCircle className="h-4 w-4" /> Send via WhatsApp
            </Button>
            <Button variant="outline" className="w-full py-3" busy={sending === 'telegram'} disabled={!online || sending !== null} onClick={() => send('telegram')}>
              <Send className="h-4 w-4" /> Send via Telegram
            </Button>
            <Button variant="outline" className="w-full py-3" busy={sending === 'sms'} disabled={!online || sending !== null} onClick={() => send('sms')}>
              <MessageSquareText className="h-4 w-4" /> Send via SMS
            </Button>
            {!online && <p className="text-[12px] text-amber-700">{OFFLINE_MESSAGE}</p>}
            <p className="text-center text-[11px] text-muted">
              One tap opens your chat app with the full summary pre-filled — just press send. No payment is taken online.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
