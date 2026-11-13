// A Bot API token cannot fetch an arbitrary message. This read-only MTProto
// request uses the same bot account and requires a Telegram application ID/hash.
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
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = String(process.env.TELEGRAM_API_HASH || '').trim();
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!ids.length || !username || !Number.isSafeInteger(apiId) || apiId <= 0 || !apiHash || !botToken) {
    return { state: 'unknown', reason: 'presence_check_not_configured' };
  }
  let client;
  try {
    const { Api, TelegramClient } = await import('teleproto');
    const { StringSession } = await import('teleproto/sessions');
    client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 1, requestRetries: 0 });
    await client.start({ botAuthToken: botToken });
    const peer = await client.getInputEntity(username);
    if (peer.className !== 'InputPeerChannel') return { state: 'unknown', reason: 'not_a_channel' };
    const savedChannel = String(product.telegramChannelId || process.env.TELEGRAM_CHANNEL_ID || '').trim();
    const channelNumber = String(peer.channelId);
    if (savedChannel && savedChannel !== `-100${channelNumber}` && savedChannel !== `@${username}` && savedChannel !== username) {
      return { state: 'unknown', reason: 'channel_mismatch' };
    }
    const channel = new Api.InputChannel({ channelId: peer.channelId, accessHash: peer.accessHash });
    const result = await client.invoke(new Api.channels.GetMessages({
      channel,
      id: ids.map((id) => new Api.InputMessageID({ id })),
    }));
    return classifyChannelMessages(result, ids);
  } catch {
    return { state: 'unknown', reason: 'telegram_unavailable' };
  } finally {
    await client?.disconnect().catch(() => {});
  }
}
