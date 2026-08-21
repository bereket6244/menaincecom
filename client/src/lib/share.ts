import type { BusinessSettings, CartItem, OrderRecord } from './types';
import { complimentarySummary } from './complimentary';

const FALLBACK_WHATSAPP = '251929639939';
const TELEGRAM_ORDER_URL = 'https://t.me/+251929639939';

const digitsOnly = (value: string) => (value || '').replace(/\D/g, '');

/**
 * Human-readable order summary the customer forwards to the studio on
 * WhatsApp/Telegram. Built from the server-sanitized order so amounts always
 * match catalog prices.
 */
export function buildOrderMessage(order: OrderRecord, _business: BusinessSettings | null, origin?: string): string {
  const lines: string[] = [
    'Selam! I would like to place this order with mena inc.',
    `Order ref: ${order.id.slice(0, 8).toUpperCase()}`,
    '',
  ];

  for (const item of order.items) {
    const variants = Object.entries(item.variantSelections || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const from = item.pricingMode === 'starting' ? 'from ' : '';
    const price =
      item.priceEach != null
        ? `${from}${item.priceEach.toLocaleString()} ETB each = ${from}${(item.priceEach * item.qty).toLocaleString()} ETB`
        : 'price on request';
    lines.push(`• ${item.qty} × ${item.name}${variants ? ` (${variants})` : ''} — ${price}`);
    if (origin) lines.push(`  ${productUrl(item.productId, origin)}`);
    const freebies = complimentarySummary(item.complimentaryItems);
    if (freebies) lines.push(`  Complimentary: ${freebies}`);
    for (const freeItem of item.complimentaryItems || []) {
      if ((freeItem.extraQty || 0) > 0) {
        lines.push(`  Extra ${freeItem.name}: ${freeItem.extraQty?.toLocaleString()} x ${(freeItem.extraPriceEach || 0).toLocaleString()} ETB = ${(freeItem.extraTotal || 0).toLocaleString()} ETB`);
      }
    }
    if (item.note) lines.push(`  Note: ${item.note}`);
  }

  lines.push('');
  if (order.estimatedTotal != null) {
    const hasQuote = order.items.some((i) => i.priceEach == null);
    const hasStarting = order.items.some((i) => i.pricingMode === 'starting');
    const caveats = [
      hasQuote ? 'plus items priced on request' : '',
      hasStarting ? 'some items are starting prices' : '',
    ].filter(Boolean);
    lines.push(
      `Estimated total: ${order.estimatedTotal.toLocaleString()} ETB${caveats.length ? ` (${caveats.join('; ')})` : ''}`
    );
  }
  // Contact lines only when known — guests check out without credentials.
  if (order.customer.name && order.customer.name !== 'Guest') lines.push(`Name: ${order.customer.name}`);
  if (order.customer.phone) lines.push(`Phone: ${order.customer.phone}`);
  if (order.customer.email) lines.push(`Email: ${order.customer.email}`);
  if (order.note) lines.push(`Order note: ${order.note}`);

  lines.push('', 'Thank you!');
  return lines.join('\n');
}

function productUrl(productId: string, origin: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = `${base}/product/${encodeURIComponent(productId)}`;
  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

export function buildCartOrderMessage(items: CartItem[], note: string, origin: string): string {
  const itemWord = items.length === 1 ? 'this item' : 'these items';
  const lines = [`Hello, I'd like to order ${itemWord}.`, ''];

  items.forEach((item, idx) => {
    const prefix = items.length === 1 ? '' : `${idx + 1}) `;
    lines.push(`${prefix}Item: ${item.name}`);
    lines.push(`Quantity: ${item.qty.toLocaleString()} pcs`);

    const complimentary = (item.complimentaryItems || []).filter((freeItem) => freeItem.qty > 0);
    if (complimentary.length) {
      lines.push('Extras:');
      for (const freeItem of complimentary) {
        const freeQty = Math.min(freeItem.qty, freeItem.freeQty ?? freeItem.maxQty ?? freeItem.qty);
        const extraQty = freeItem.extraQty || 0;
        if (extraQty > 0) {
          lines.push(`- ${freeItem.name}: ${freeQty.toLocaleString()} free + ${extraQty.toLocaleString()} paid x ${(freeItem.extraPriceEach || 0).toLocaleString()} ETB = ${(freeItem.extraTotal || 0).toLocaleString()} ETB`);
        } else {
          lines.push(`- ${freeItem.name}: ${freeQty.toLocaleString()} free`);
        }
      }
    }

    lines.push('Item link:');
    lines.push(productUrl(item.productId, origin));
    lines.push('');
  });

  if (note.trim()) lines.push('order note: ' + note.trim(), '');
  lines.push('Please contact me.');
  return lines.join('\n');
}

export function whatsappOrderUrl(business: BusinessSettings | null, text: string): string {
  const number = digitsOnly(business?.whatsappNumber || '') || FALLBACK_WHATSAPP;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function telegramOrderUrl(_business: BusinessSettings | null, text: string): string {
  return `${TELEGRAM_ORDER_URL}?text=${encodeURIComponent(text)}`;
}

export function telegramContactUrl(business: BusinessSettings | null): string {
  const handle = (business?.telegramHandle || '').trim();
  if (!handle) return TELEGRAM_ORDER_URL;
  if (/^https?:\/\//i.test(handle)) return handle;
  if (handle.startsWith('@')) return `https://t.me/${handle.slice(1)}`;
  const phone = digitsOnly(handle);
  if (phone) return `https://t.me/+${phone}`;
  return `https://t.me/${handle.replace(/^\/+/, '')}`;
}

export function smsOrderUrl(business: BusinessSettings | null, text: string): string {
  const number = digitsOnly(business?.phone || '') || FALLBACK_WHATSAPP;
  return `sms:+${number}?body=${encodeURIComponent(text)}`;
}

/** Chat links without a prefilled order — used by the "message us" buttons. */
export function whatsappContactUrl(business: BusinessSettings | null): string {
  return `https://wa.me/${digitsOnly(business?.whatsappNumber || '') || FALLBACK_WHATSAPP}`;
}

export function smsContactUrl(business: BusinessSettings | null): string {
  return `sms:+${digitsOnly(business?.phone || '') || FALLBACK_WHATSAPP}`;
}

export function isValidPhone(value: string): boolean {
  return /^\+?\d{9,15}$/.test((value || '').replace(/[\s\-().]/g, ''));
}
