import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, Send, MessageCircle, CheckCircle2, PlusCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { useData } from '../lib/useData';
import { apiSend, OFFLINE_MESSAGE } from '../lib/api';
import type { Product } from '../lib/types';
import { Button, EmptyState, IconButton, SysLabel } from '../components/ui';
import { formatPrice } from '../lib/utils';

export function OrderSummary() {
  const { cart, updateCartItem, removeFromCart, clearCart, user, toast, online } = useApp();
  const { data: products } = useData<Product[]>('/products');

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.identifier.includes('@') ? user.identifier : '');
  const [orderNote, setOrderNote] = useState('');
  const [sending, setSending] = useState<'whatsapp' | 'telegram' | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);

  const estimatedTotal = useMemo(() => {
    const priced = cart.filter((i) => i.priceEach != null);
    if (!priced.length) return null;
    return priced.reduce((sum, i) => sum + (i.priceEach || 0) * i.qty, 0);
  }, [cart]);

  const hasQuoteItems = cart.some((i) => i.priceEach == null);

  // Suggest add-ons referenced by items in the cart that aren't in it yet.
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

  const send = async (channel: 'whatsapp' | 'telegram') => {
    if (!online) { toast('error', OFFLINE_MESSAGE); return; }
    if (!name.trim() || !phone.trim()) { toast('error', 'Please enter your name and phone number.'); return; }
    if (cart.length === 0) return;
    setSending(channel);
    try {
      const res = await apiSend<{ ok: boolean; id: string }>('POST', '/orders', {
        items: cart,
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        channel,
        note: orderNote.trim(),
      });
      setSentRef(res.id);
      clearCart();
      toast('success', `Order sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}. We will contact you shortly.`);
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setSending(null);
    }
  };

  if (sentRef) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green" />
        <h1 className="mt-3 text-lg font-bold">Order received</h1>
        <p className="mt-1 text-sm text-muted">
          Reference <span className="font-mono text-ink">{sentRef.slice(0, 8).toUpperCase()}</span>. The Mena Inc team
          has your order summary and will reach out on the number you provided.
        </p>
        <Link to="/catalog" className="mt-5 inline-block rounded bg-pink px-5 py-2 text-xs font-bold text-white hover:bg-pink-dim">
          Continue browsing
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-bold">Order summary</h1>
        <EmptyState>
          Your order is empty.
          <Link to="/catalog" className="mt-1 font-semibold text-pink hover:underline">Browse the catalog</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <h1 className="text-base font-bold">Order summary</h1>

        <div className="divide-y divide-edge rounded-lg border border-edge bg-surface">
          {cart.map((item) => (
            <div key={item.key} className="flex gap-3 p-3">
              <Link to={`/product/${item.productId}`} className="h-16 w-20 shrink-0 overflow-hidden rounded border border-edge bg-surface2">
                {item.photo && <img src={item.photo} alt="" className="h-full w-full object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold">
                      {item.name}
                      {item.isAddon && <span className="ml-1.5 rounded bg-surface2 px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted">add-on</span>}
                    </div>
                    {Object.entries(item.variantSelections).length > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted">
                        {Object.entries(item.variantSelections).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <IconButton icon={<Trash2 className="h-3.5 w-3.5" />} title="Remove" danger onClick={() => removeFromCart(item.key)} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateCartItem(item.key, { qty: Math.max(1, item.qty - 1) })} className="flex h-6 w-6 items-center justify-center rounded border border-edge hover:border-pink/50" aria-label="Decrease">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-xs font-semibold">{item.qty}</span>
                    <button onClick={() => updateCartItem(item.key, { qty: item.qty + 1 })} className="flex h-6 w-6 items-center justify-center rounded border border-edge hover:border-pink/50" aria-label="Increase">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs font-semibold text-green">
                    {item.priceEach != null ? `${(item.priceEach * item.qty).toLocaleString()} ETB` : 'Quote'}
                  </span>
                </div>
                <input
                  value={item.note}
                  onChange={(e) => updateCartItem(item.key, { note: e.target.value })}
                  placeholder="Notes for this item…"
                  className="field mt-2 py-1 text-[11px]"
                />
              </div>
            </div>
          ))}
        </div>

        {suggestions.length > 0 && (
          <div className="rounded-lg border border-edge bg-surface p-3">
            <SysLabel>Suggested add-ons</SysLabel>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {suggestions.map((a) => (
                <div key={a.id} className="rounded border border-edge bg-surface2 p-2">
                  <div className="truncate text-[11px] font-semibold">{a.name}</div>
                  <div className="text-[10px] text-muted">{formatPrice(a)}</div>
                  <Link to={`/product/${a.id}`} className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-pink hover:underline">
                    <PlusCircle className="h-3 w-3" /> Add
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact + send */}
      <div className="h-fit space-y-3 rounded-lg border border-edge bg-surface p-4">
        <div>
          <h2 className="text-sm font-bold">Your details</h2>
          <p className="text-[11px] text-muted">We use your phone number to confirm the order and discuss details.</p>
        </div>
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" className="field" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number *" type="tel" className="field" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className="field" />
          <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} rows={2} placeholder="Anything else we should know?" className="field resize-y" />
        </div>

        <div className="border-t border-edge pt-3 text-xs">
          <div className="flex justify-between text-muted">
            <span>Items</span>
            <span className="text-ink">{cart.reduce((n, i) => n + i.qty, 0)}</span>
          </div>
          <div className="mt-1 flex justify-between text-muted">
            <span>Estimated total</span>
            <span className="font-semibold text-green">
              {estimatedTotal != null ? `${estimatedTotal.toLocaleString()} ETB` : '—'}
            </span>
          </div>
          {hasQuoteItems && (
            <p className="mt-1 text-[10px] text-muted">Some items are priced on request — the team will quote them when they contact you.</p>
          )}
        </div>

        <div className="space-y-2 border-t border-edge pt-3">
          <Button variant="green" className="w-full py-2.5" busy={sending === 'whatsapp'} disabled={!online || sending !== null} onClick={() => send('whatsapp')}>
            <MessageCircle className="h-4 w-4" /> Send via WhatsApp
          </Button>
          <Button className="w-full py-2.5" busy={sending === 'telegram'} disabled={!online || sending !== null} onClick={() => send('telegram')}>
            <Send className="h-4 w-4" /> Send via Telegram
          </Button>
          {!online && <p className="text-[11px] text-amber-300">{OFFLINE_MESSAGE}</p>}
          <p className="text-center text-[10px] text-muted">One tap sends everything — no copy-pasting needed. No payment is taken online.</p>
        </div>
      </div>
    </div>
  );
}
