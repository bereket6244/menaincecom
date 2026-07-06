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
export function buildOrderMessage(order: OrderRecord, business: BusinessSettings | null): string {
  const lines: string[] = [
    'Selam! I would like to place this order with Mena Inc.',
    `Order ref: ${order.id.slice(0, 8).toUpperCase()}`,
    '',
  ];

  for (const item of order.items) {
    const variants = Object.entries(item.variantSelections || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const price =
      item.priceEach != null
        ? `${item.priceEach.toLocaleString()} ETB each = ${(item.priceEach * item.qty).toLocaleString()} ETB`
        : 'price on request';
    lines.push(`• ${item.qty} × ${item.name}${variants ? ` (${variants})` : ''} — ${price}`);
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
    lines.push(`Estimated total: ${order.estimatedTotal.toLocaleString()} ETB${hasQuote ? ' (plus items priced on request)' : ''}`);
  }
  // Contact lines only when known — guests check out without credentials.
  if (order.customer.name && order.customer.name !== 'Guest') lines.push(`Name: ${order.customer.name}`);
  if (order.customer.phone) lines.push(`Phone: ${order.customer.phone}`);
  if (order.customer.email) lines.push(`Email: ${order.customer.email}`);
  if (order.note) lines.push(`Order note: ${order.note}`);

  if (business?.paymentAccountNumber) {
    lines.push('', 'Payment account:');
    if (business.paymentAccountName) lines.push(`Account Name: ${business.paymentAccountName}`);
    lines.push(`Account Number: ${business.paymentAccountNumber}`);
  }
  if (business?.pickupLocation) lines.push('', 'Pickup location:', business.pickupLocation);

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

    lines.push('Reference image:');
    lines.push(item.photo || productUrl(item.productId, origin));
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

export function smsOrderUrl(business: BusinessSettings | null, text: string): string {
  const number = digitsOnly(business?.phone || '') || FALLBACK_WHATSAPP;
  return `sms:+${number}?body=${encodeURIComponent(text)}`;
}

export function isValidPhone(value: string): boolean {
  return /^\+?\d{9,15}$/.test((value || '').replace(/[\s\-().]/g, ''));
}
