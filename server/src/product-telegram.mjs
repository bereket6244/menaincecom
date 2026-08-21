import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { telegramApi, sanitizedTelegramError } from './telegram-import/telegram-api.mjs';
import { telegramProductIdentity } from './product-model.mjs';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsDir = path.join(serverRoot, 'uploads');
const TELEGRAM_CAPTION_LIMIT = 1024;
const TELEGRAM_ALBUM_LIMIT = 10;

function configuredChannelId() {
  return String(process.env.TELEGRAM_CHANNEL_ID || '').trim();
}

function channelUsername() {
  return String(process.env.TELEGRAM_CHANNEL_USERNAME || '').trim().replace(/^@/, '');
}

function productPrice(product) {
  if (product.pricingMode === 'quote' || product.price == null) return 'Price: Request a quote';
  const amount = `${Number(product.price).toLocaleString('en-US')} ETB`;
  return product.pricingMode === 'starting' ? `Price: From ${amount}` : `Price: ${amount}`;
}

function compactText(value, limit = 80) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit).trim();
}

function hashtag(value) {
  const tag = compactText(value, 48)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return tag ? `#${tag}` : '';
}

function productCategories(product) {
  return [...new Set([
    ...(Array.isArray(product.categoryNames) ? product.categoryNames : []),
    ...(Array.isArray(product.categoryLabels) ? product.categoryLabels : []),
  ].map((item) => compactText(item)).filter(Boolean))];
}

function productDetails(product) {
  const details = [];
  const categories = productCategories(product);
  if (product.isAddon) details.push('Item type: Add-on');
  if (categories.length) details.push(`Item type: ${categories.join(', ')}`);
  for (const group of Array.isArray(product.variants) ? product.variants : []) {
    const name = compactText(group?.name, 32);
    const options = (Array.isArray(group?.options) ? group.options : [])
      .map((option) => compactText(option?.label, 32))
      .filter(Boolean);
    if (name && options.length) details.push(`${name}: ${options.join(', ')}`);
  }
  return details;
}

function productHashtags(product) {
  const tags = new Set([
    hashtag('mena inc'),
    hashtag(product.isAddon ? 'add on' : 'product'),
    ...productCategories(product).map(hashtag),
  ].filter(Boolean));

  for (const group of Array.isArray(product.variants) ? product.variants : []) {
    const groupName = compactText(group?.name, 32);
    if (groupName) tags.add(hashtag(groupName));
    for (const option of Array.isArray(group?.options) ? group.options : []) {
      const optionLabel = compactText(option?.label, 32);
      if (optionLabel) tags.add(hashtag(optionLabel));
      if (groupName && optionLabel) tags.add(hashtag(`${groupName} ${optionLabel}`));
    }
  }

  return [...tags].filter(Boolean).slice(0, 28);
}

function truncate(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

export function formatProductCaption(product) {
  const shopUrl = String(process.env.PUBLIC_SHOP_URL || 'https://menaincet.com/shop').replace(/\/$/, '');
  const sections = [truncate(product.name, 180)];
  const description = truncate(product.description, 560);
  if (description && description.toLowerCase() !== String(product.name || '').trim().toLowerCase()) {
    sections.push(description);
  }
  sections.push(productPrice(product));
  const details = productDetails(product);
  if (details.length) sections.push(`Details:\n${details.join('\n')}`);
  const tags = productHashtags(product);
  if (tags.length) sections.push(tags.join(' '));
  if (product.id) sections.push(`${shopUrl}/product/${encodeURIComponent(product.id)}`);
  return truncate(sections.filter(Boolean).join('\n\n'), TELEGRAM_CAPTION_LIMIT);
}

export function shouldCreateTelegramPost(previous, next) {
  if (process.env.TELEGRAM_SYNC_ENABLED !== 'true') return false;
  if (next?.status !== 'published' || telegramProductIdentity(next)) return false;
  return !previous || previous.status !== 'published';
}

export function shouldUpdateTelegramPost(previous, next) {
  if (process.env.TELEGRAM_SYNC_ENABLED !== 'true') return false;
  if (next?.status !== 'published' || !telegramProductIdentity(next)) return false;
  return Math.max(1, Number(previous?.contentVersion) || 1) < Math.max(1, Number(next?.contentVersion) || 1);
}

export function shouldDeleteTelegramPost(product) {
  if (process.env.TELEGRAM_SYNC_ENABLED !== 'true') return false;
  return !!telegramProductIdentity(product);
}

function localUpload(photo) {
  const match = String(photo || '').match(/^(?:\/shop)?\/uploads\/([^/]+)$/);
  if (!match) return null;
  const filename = path.basename(match[1]);
  return filename === match[1] ? { filename, filePath: path.join(uploadsDir, filename) } : null;
}

function imageMime(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.avif') return 'image/avif';
  return 'image/jpeg';
}

async function appendPhoto(form, field, photo) {
  const local = localUpload(photo);
  if (!local) {
    form.set(field, String(photo));
    return;
  }
  const data = await fs.readFile(local.filePath);
  form.set(field, new Blob([data], { type: imageMime(local.filename) }), local.filename);
}

async function telegramMultipart(token, method, form) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.description || `Telegram ${method} failed with HTTP ${response.status}.`);
    error.code = result?.error_code || response.status;
    throw error;
  }
  return result.result;
}

async function sendProductPost(product) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = configuredChannelId();
  if (!token || !chatId) throw new Error('Telegram product synchronization is not configured.');
  const caption = formatProductCaption(product);
  const photos = (product.photos || []).filter(Boolean).slice(0, TELEGRAM_ALBUM_LIMIT);

  if (photos.length === 0) {
    return [await telegramApi(token, 'sendMessage', { chat_id: chatId, text: caption })];
  }

  if (photos.length === 1) {
    const form = new FormData();
    form.set('chat_id', chatId);
    form.set('caption', caption);
    await appendPhoto(form, 'photo', photos[0]);
    return [await telegramMultipart(token, 'sendPhoto', form)];
  }

  const form = new FormData();
  form.set('chat_id', chatId);
  const media = [];
  for (let index = 0; index < photos.length; index += 1) {
    const field = `photo${index}`;
    await appendPhoto(form, field, photos[index]);
    media.push({ type: 'photo', media: `attach://${field}`, ...(index === 0 ? { caption } : {}) });
  }
  form.set('media', JSON.stringify(media));
  return telegramMultipart(token, 'sendMediaGroup', form);
}

export async function createTelegramProductPost(product) {
  try {
    const messages = await sendProductPost(product);
    const first = messages[0];
    const username = channelUsername();
    return {
      telegramChannelId: configuredChannelId(),
      telegramMessageId: first.message_id,
      telegramMessageIds: messages.map((message) => message.message_id),
      telegramPostUrl: username ? `https://t.me/${username}/${first.message_id}` : null,
      telegramSyncStatus: 'synced',
      telegramSyncedVersion: Math.max(1, Number(product.contentVersion) || 1),
      telegramLastSyncedAt: new Date().toISOString(),
      originalPublishedAt: product.originalPublishedAt || new Date().toISOString(),
    };
  } catch (error) {
    error.telegram = sanitizedTelegramError(error);
    throw error;
  }
}

function isNotModified(error) {
  return error?.code === 400 && /message is not modified/i.test(String(error.message || ''));
}

export async function updateTelegramProductPost(product) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = product.telegramChannelId || configuredChannelId();
  const messageId = Number(product.telegramMessageId);
  if (!token || !chatId || !Number.isInteger(messageId) || messageId <= 0) {
    throw new Error('Telegram product synchronization is not configured.');
  }
  const caption = formatProductCaption(product);

  try {
    try {
      await telegramApi(token, 'editMessageCaption', {
        chat_id: chatId,
        message_id: messageId,
        caption,
      });
    } catch (error) {
      if (isNotModified(error)) {
        return syncedTelegramPatch(product);
      }
      await telegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: caption,
      });
    }
    return syncedTelegramPatch(product);
  } catch (error) {
    if (isNotModified(error)) return syncedTelegramPatch(product);
    error.telegram = sanitizedTelegramError(error);
    throw error;
  }
}

function isAlreadyDeleted(error) {
  return error?.code === 400 && /(message to delete not found|message identifier is not specified|message can't be deleted)/i.test(String(error.message || ''));
}

export async function deleteTelegramProductPost(product) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = product.telegramChannelId || configuredChannelId();
  const messageIds = [...new Set([
    ...(Array.isArray(product.telegramMessageIds) ? product.telegramMessageIds : []),
    product.telegramMessageId,
  ]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0))];

  if (!token || !chatId || messageIds.length === 0) {
    throw new Error('Telegram product synchronization is not configured.');
  }

  try {
    const failures = [];
    for (const messageId of messageIds) {
      try {
        await telegramApi(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
      } catch (error) {
        if (!isAlreadyDeleted(error)) failures.push(error);
      }
    }
    if (failures.length) throw failures[0];
    return {
      telegramSyncStatus: 'deleted',
      telegramDeletedAt: new Date().toISOString(),
      telegramLastSyncedAt: new Date().toISOString(),
      telegramSyncError: null,
    };
  } catch (error) {
    error.telegram = sanitizedTelegramError(error);
    throw error;
  }
}

function syncedTelegramPatch(product) {
  return {
    telegramSyncStatus: 'synced',
    telegramSyncedVersion: Math.max(1, Number(product.contentVersion) || 1),
    telegramLastSyncedAt: new Date().toISOString(),
    telegramSyncError: null,
  };
}
