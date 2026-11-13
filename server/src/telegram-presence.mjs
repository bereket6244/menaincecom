// Telegram's public post embed contains an exact data-post marker for a visible
// message. An HTTP success without that marker is treated as missing, per the
// operator's chosen policy. Transport errors stay unknown.
export function classifyChannelMessages(result, expectedIds) {
  const messages = result?.messages;
  if (!Array.isArray(messages) || messages.length !== expectedIds.length) {
    return { state: 'unknown', reason: 'incomplete_response' };
  }
  const byId = new Map();
  for (const message of messages) {
    const id = Number(message?.id);
    if (!expectedIds.includes(id) || byId.has(id)) return { state: 'unknown', reason: 'unexpected_response' };
    byId.set(id, message);
  }
  if (byId.size !== expectedIds.length) return { state: 'unknown', reason: 'incomplete_response' };
  const present = [];
  const absent = [];
  for (const id of expectedIds) {
    const message = byId.get(id);
    if (message instanceof Object && (message.className === 'MessageEmpty' || message._ === 'messageEmpty')) absent.push(id);
    else if (message instanceof Object && (message.className === 'Message' || message._ === 'message')) present.push(id);
    else return { state: 'unknown', reason: 'unrecognized_message' };
  }
  return { state: absent.length ? 'absent' : 'present', present, absent };
}

export async function checkTelegramPostPresence(product) {
  const ids = [...new Set([...(product.telegramMessageIds || []), product.telegramMessageId]
    .map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const username = String(process.env.TELEGRAM_CHANNEL_USERNAME || '').replace(/^@/, '').trim();
  if (!ids.length || !username) {
    return { state: 'unknown', reason: 'presence_check_not_configured' };
  }
  const present = [];
  const absent = [];
  try {
    for (const id of ids) {
      const response = await fetch(`https://t.me/${encodeURIComponent(username)}/${id}?embed=1&mode=tme`, {
        headers: { accept: 'text/html' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { state: 'unknown', reason: `telegram_http_${response.status}` };
      const html = await response.text();
      const marker = `data-post="${username}/${id}"`;
      if (html.includes(marker)) present.push(id);
      else absent.push(id);
    }
  } catch {
    return { state: 'unknown', reason: 'telegram_unavailable' };
  }
  return { state: absent.length ? 'absent' : 'present', present, absent };
}
