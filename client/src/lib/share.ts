import type { BusinessSettings, CartItem, OrderRecord } from './types';

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

function fullImageUrl(photo: string, origin: string): string {
  if (!photo) return '';
  try {
    return new URL(photo, origin).toString();
  } catch {
    return photo;
  }
}

export function buildCartOrderMessage(items: CartItem[], note: string, origin: string): string {
  const lines = ['hello there, i would like to order these', ''];

  let total = 0;
  let hasPriced = false;
  let hasQuote = false;

  items.forEach((item, idx) => {
    const variants = Object.entries(item.variantSelections || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`${idx + 1}) ${item.name}${variants ? ` — ${variants}` : ''}`);
    if (item.priceEach != null) {
      hasPriced = true;
      total += item.priceEach * item.qty;
      lines.push(`${item.qty.toLocaleString()} pcs × ${item.priceEach.toLocaleString()} birr = ${(item.priceEach * item.qty).toLocaleString()} birr`);
    } else {
      hasQuote = true;
      lines.push(`${item.qty.toLocaleString()} pcs — price to be confirmed`);
    }
    if (item.note) lines.push(`note: ${item.note}`);
    const imageUrl = fullImageUrl(item.photo, origin);
    if (imageUrl) lines.push(`photo: ${imageUrl}`);
    lines.push('');
  });

  if (hasPriced) {
    lines.push(`estimated total: ${total.toLocaleString()} birr${hasQuote ? ' (plus items priced on request)' : ''}`, '');
  }
  if (note.trim()) lines.push(`order note: ${note.trim()}`, '');
  lines.push('please contact me');
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
