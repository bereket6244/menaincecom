import type { BusinessSettings, OrderRecord } from './types';

const FALLBACK_WHATSAPP = '251929639939';
const FALLBACK_TELEGRAM = '+251929639939';

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
  lines.push(`Name: ${order.customer.name}`, `Phone: ${order.customer.phone}`);
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

export function whatsappOrderUrl(business: BusinessSettings | null, text: string): string {
  const number = digitsOnly(business?.whatsappNumber || '') || FALLBACK_WHATSAPP;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function telegramOrderUrl(business: BusinessSettings | null, text: string): string {
  const handle = (business?.telegramHandle || FALLBACK_TELEGRAM).trim().replace(/^@/, '');
  // Phone-number targets need the "+"; usernames are used as-is.
  const target = handle.startsWith('+') ? `+${digitsOnly(handle)}` : handle;
  return `https://t.me/${target}?text=${encodeURIComponent(text)}`;
}

export function isValidPhone(value: string): boolean {
  return /^\+?\d{9,15}$/.test((value || '').replace(/[\s\-().]/g, ''));
}
