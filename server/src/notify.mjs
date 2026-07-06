import webpush from 'web-push';
import { records } from './db.mjs';

const vapidReady = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@menainc.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export function formatOrderMessage(order) {
  const lines = [
    'NEW ORDER — MENA INC.',
    `Ref: ${order.id.slice(0, 8).toUpperCase()}`,
    `Customer: ${order.customer.name}`,
    `Phone: ${order.customer.phone}`,
  ];
  if (order.customer.email) lines.push(`Email: ${order.customer.email}`);
  lines.push(`Channel: ${order.channel}`, '', 'Items:');
  for (const item of order.items) {
    const variants = Object.entries(item.variantSelections || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`• ${item.qty} × ${item.name}${item.isAddon ? ' (add-on)' : ''}${variants ? ` [${variants}]` : ''}${item.priceEach != null ? ` — ${item.priceEach * item.qty} ETB` : ' — quote'}`);
    const freebies = (item.complimentaryItems || [])
      .filter((freeItem) => freeItem?.qty > 0 && freeItem?.name)
      .map((freeItem) => `${Number(freeItem.qty).toLocaleString()} ${freeItem.name}`)
      .join(', ');
    if (freebies) lines.push(`  Complimentary: ${freebies}`);
    for (const freeItem of item.complimentaryItems || []) {
      if ((Number(freeItem.extraQty) || 0) > 0) {
        lines.push(`  Extra ${freeItem.name}: ${Number(freeItem.extraQty).toLocaleString()} x ${Number(freeItem.extraPriceEach || 0).toLocaleString()} ETB = ${Number(freeItem.extraTotal || 0).toLocaleString()} ETB`);
      }
    }
    if (item.note) lines.push(`  Note: ${item.note}`);
  }
  if (order.note) lines.push('', `Order note: ${order.note}`);
  if (order.estimatedTotal != null) lines.push('', `Estimated total: ${order.estimatedTotal} ETB (items without price excluded)`);
  return lines.join('\n');
}

export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] not configured, skipping delivery');
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) console.error('[telegram] send failed:', await res.text());
  return res.ok;
}

export async function sendWhatsApp(text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TEAM_NUMBER;
  if (!token || !phoneId || !to) {
    console.warn('[whatsapp] not configured, skipping delivery');
    return false;
  }
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) console.error('[whatsapp] send failed:', await res.text());
  return res.ok;
}

export async function pushToAdmins(payload) {
  if (!vapidReady) {
    console.warn('[push] VAPID keys not configured, skipping push');
    return;
  }
  const subs = await records.list('push_subscriptions');
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await records.remove('push_subscriptions', sub.id);
        }
      }
    })
  );
}
