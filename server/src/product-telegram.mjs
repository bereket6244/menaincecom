import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { telegramApi, sanitizedTelegramError } from './telegram-import/telegram-api.mjs';
import { normalizeProductStatus, telegramProductIdentity } from './product-model.mjs';

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
  if (product.pricingMode === 'tiered') {
    const tiers = (Array.isArray(product.priceTiers) ? product.priceTiers : []).slice().sort((a, b) => a.minQty - b.minQty);
    if (!tiers.length) return 'Price: Request a quote';
    const ranges = tiers.map((tier, index) => {
      const next = tiers[index + 1];
      const start = index === 0 ? 1 : tier.minQty + 1;
      const range = next ? `${start}-${next.minQty}` : `${start}+`;
      return `${range}: ${Number(tier.priceEach).toLocaleString('en-US')} ETB each`;
    });
    return `Quantity pricing (total averaged across all items):\n${ranges.join('\n')}`;
  }
  const amount = `${Number(product.price).toLocaleString('en-US')} ETB`;
  return `Price: ${amount}`;
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
  const maxOrderQty = Math.floor(Number(product.maxOrderQty) || 0);
  if (product.isAddon) details.push('Item type: Add-on');
  if (categories.length) details.push(`Item type: ${categories.join(', ')}`);
  if (maxOrderQty > 0) details.push(`Limited quantity: only ${maxOrderQty.toLocaleString('en-US')} available`);
  for (const group of Array.isArray(product.variants) ? product.variants : []) {
    const name = compactText(group?.name, 32);
    const options = (Array.isArray(group?.options) ? group.options : [])
      .map((option) => compactText(option?.label, 32))
      .filter(Boolean);
    if (name && options.length) details.push(`${name}: ${options.join(', ')}`);
  }
  return details;
}

function productComplimentaryDetails(product) {
  const items = (Array.isArray(product.complimentaryItems) ? product.complimentaryItems : [])
    .filter((item) => item?.enabled !== false && compactText(item?.name, 60) && Number(item?.qty) > 0)
    .map((item) => compactText(item.name, 60));
  if (!items.length) return '';
  const visible = items.slice(0, 8);
  if (items.length > visible.length) visible.push('More complimentary options available');
  return `Complimentary:\n${visible.join('\n')}`;
}

function productHashtags(product) {
  const tags = new Set([
    hashtag('mena inc'),
    ...(product.isAddon ? [hashtag('add on')] : []),
    ...productCategories(product).map(hashtag),
  ].filter(Boolean));
  if (Math.floor(Number(product.maxOrderQty) || 0) > 0) tags.add(hashtag('limited'));

  for (const group of Array.isArray(product.variants) ? product.variants : []) {
    const groupName = compactText(group?.name, 32);
    if (groupName) tags.add(hashtag(groupName));
    for (const option of Array.isArray(group?.options) ? group.options : []) {
      const optionLabel = compactText(option?.label, 32);
      if (optionLabel) tags.add(hashtag(optionLabel));
      if (groupName && optionLabel) tags.add(hashtag(`${groupName} ${optionLabel}`));
    }
  }

  return [...tags].filter((tag) => tag && tag !== '#product').slice(0, 28);
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
  const complimentary = productComplimentaryDetails(product);
  if (complimentary) sections.push(complimentary);
  const tags = productHashtags(product);
  if (tags.length) sections.push(tags.join(' '));
  if (product.id) sections.push(`${shopUrl}/product/${encodeURIComponent(product.id)}`);
  return truncate(sections.filter(Boolean).join('\n\n'), TELEGRAM_CAPTION_LIMIT);
}

export function shouldCreateTelegramPost(previous, next) {
  if (process.env.TELEGRAM_SYNC_ENABLED !== 'true') return false;
  const previousStatus = previous ? normalizeProductStatus(previous.status) : 'draft';
  return previousStatus !== 'published' && normalizeProductStatus(next?.status) === 'published'
    && (!telegramProductIdentity(next) || !!next.telegramDeletedAt);
}

export function shouldUpdateTelegramPost(previous, next) {
  if (process.env.TELEGRAM_SYNC_ENABLED !== 'true') return false;
  if (!previous || !next || next.deletedAt || next.telegramDeletedAt) return false;
  if (normalizeProductStatus(next.status) !== 'published') return false;
  if (!telegramProductIdentity(next)) return false;
  if (normalizeProductStatus(previous.status) !== 'published') return true;
  return Number(next.contentVersion) > Number(previous.contentVersion || 1)
    || next.telegramSyncStatus === 'error';
}

export function shouldDeleteTelegramPost(product) {
  if (process.env.TELEGRAM_SYNC_ENABLED !== 'true') return false;
  return !!telegramProductIdentity(product);
}

function localUpload(photo) {
  const value = String(photo || '').trim();
  const shopUrl = String(process.env.PUBLIC_SHOP_URL || 'https://menaincet.com/shop').replace(/\/$/, '');
  const escapedShopUrl = shopUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = value.match(new RegExp(`^(?:${escapedShopUrl})?(?:/shop)?/uploads/([^/]+)$`));
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
  if (local) {
    const data = await fs.readFile(local.filePath);
    form.set(field, new Blob([data], { type: imageMime(local.filename) }), local.filename);
    return `attach://${field}`;
  }

  const url = String(photo || '').trim();
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Could not read product photo (${response.status}).`);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    form.set(field, new Blob([buffer], { type: contentType }), path.basename(new URL(url).pathname) || `${field}.jpg`);
    return `attach://${field}`;
  }

  form.set(field, url);
  return url;
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
  const chatId = product.telegramChannelId || configuredChannelId();
  if (!token || !chatId) throw new Error('Telegram product synchronization is not configured.');
  const caption = formatProductCaption(product);
  const photos = syncedPhotos(product);

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
    const reference = await appendPhoto(form, field, photos[index]);
    media.push({ type: 'photo', media: reference, ...(index === 0 ? { caption } : {}) });
  }
  form.set('media', JSON.stringify(media));
  return telegramMultipart(token, 'sendMediaGroup', form);
}

export async function createTelegramProductPost(product) {
  try {
    const messages = await sendProductPost(product);
    const first = messages[0];
    const username = channelUsername();
    const photos = (product.photos || []).filter(Boolean).slice(0, TELEGRAM_ALBUM_LIMIT);
    return {
      telegramChannelId: product.telegramChannelId || configuredChannelId(),
      telegramMessageId: first.message_id,
      telegramMessageIds: messages.map((message) => message.message_id),
      telegramPostVerified: messages.length === Math.max(1, photos.length)
        && messages.every((message) => Number.isInteger(message.message_id) && message.message_id > 0)
        && (!photos.length || messages.every((message) => message.photo?.length > 0))
        && (photos.length ? first.caption : first.text) === formatProductCaption(product),
      telegramPostUrl: username ? `https://t.me/${username}/${first.message_id}` : null,
      telegramPostType: photos.length === 0 ? 'text' : photos.length === 1 ? 'photo' : 'album',
      telegramSyncedPhotos: photos,
      telegramSyncStatus: 'synced',
      telegramSyncError: null,
      telegramSyncedVersion: Math.max(1, Number(product.contentVersion) || 1),
      telegramLastSyncedAt: new Date().toISOString(),
      telegramPostedAt: first.date ? new Date(first.date * 1000).toISOString() : new Date().toISOString(),
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

function syncedPhotos(product) {
  const photos = (product.photos || []).filter(Boolean);
  if (photos.length > TELEGRAM_ALBUM_LIMIT) throw new Error('Telegram supports up to 10 photos per product album. No photos were silently omitted.');
  return photos;
}

function telegramPostType(product) {
  const photos = syncedPhotos(product);
  return photos.length === 0 ? 'text' : photos.length === 1 ? 'photo' : 'album';
}

function samePhotoList(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

async function editSinglePhotoPost(token, chatId, messageId, product, caption) {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('message_id', String(messageId));
  const reference = await appendPhoto(form, 'photo', syncedPhotos(product)[0]);
  form.set('media', JSON.stringify({ type: 'photo', media: reference, caption }));
  return telegramMultipart(token, 'editMessageMedia', form);
}

async function editAlbumPhotos(token, chatId, product, photos, caption) {
  const messageIds = telegramMessageIds(product);
  if (messageIds.length !== photos.length) return false;
  for (let index = 0; index < photos.length; index += 1) {
    const form = new FormData();
    form.set('chat_id', chatId);
    form.set('message_id', String(messageIds[index]));
    const reference = await appendPhoto(form, 'photo', photos[index]);
    form.set('media', JSON.stringify({
      type: 'photo', media: reference, ...(index === 0 ? { caption } : {}),
    }));
    try {
      await telegramMultipart(token, 'editMessageMedia', form);
    } catch (error) {
      if (!isNotModified(error)) throw error;
    }
  }
  return true;
}

export async function replaceTelegramProductPost(product, persist) {
  if (!persist) throw new Error('Telegram replacement requires durable product storage.');
  const postedAt = Date.parse(product.telegramPostedAt || product.originalPublishedAt || '');
  // Leave a safety margin for upload and storage before Telegram's deletion deadline.
  if (!Number.isFinite(postedAt) || postedAt > Date.now() || Date.now() - postedAt >= 47 * 60 * 60 * 1000) {
    throw new Error('A channel admin must remove the old Telegram post before republishing: its age is unknown or exceeds the bot deletion window. No replacement was published.');
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = product.telegramChannelId || configuredChannelId();
  const bot = await telegramApi(token, 'getMe');
  const member = await telegramApi(token, 'getChatMember', { chat_id: chatId, user_id: bot.id });
  if (member.status !== 'creator' && !(member.status === 'administrator' && member.can_delete_messages)) {
    throw new Error('A channel admin must grant the bot Delete messages permission before replacing this post. No replacement was published.');
  }
  const replacement = await createTelegramProductPost(product);
  const pending = {
    ...replacement,
    telegramSupersededMessageIds: telegramMessageIds(product),
    telegramCleanupStatus: 'pending',
  };
  let saved;
  try {
    saved = await persist(pending);
  } catch (error) {
    error.telegramPatch = pending;
    throw error;
  }
  if (!saved || saved.telegramChannelId !== replacement.telegramChannelId
    || saved.telegramMessageId !== replacement.telegramMessageId
    || !samePhotoList(saved.telegramMessageIds, replacement.telegramMessageIds)
    || !samePhotoList(saved.telegramSyncedPhotos, replacement.telegramSyncedPhotos)
    || saved.telegramSyncedVersion !== replacement.telegramSyncedVersion) {
    const error = new Error('Telegram replacement linkage could not be verified; old messages were preserved.');
    error.telegramPatch = pending;
    throw error;
  }
  await cleanupSupersededPosts(saved);
  return { ...pending, telegramCleanupStatus: 'complete' };
}

async function cleanupSupersededPosts(product) {
  if (!product.telegramPostVerified) throw new Error('Replacement content and photos could not be verified; old Telegram messages were preserved for review.');
  const current = new Set(telegramMessageIds(product));
  const oldIds = (product.telegramSupersededMessageIds || []).filter((id) => !current.has(Number(id)));
  if (!oldIds.length) throw new Error('Superseded Telegram message IDs are missing; cleanup requires review.');
  await deleteTelegramProductPost({ ...product, telegramMessageId: null, telegramMessageIds: oldIds });
}

export async function updateTelegramProductPost(product, { persist } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = product.telegramChannelId || configuredChannelId();
  const messageId = Number(product.telegramMessageId);
  if (!token || !chatId || !Number.isInteger(messageId) || messageId <= 0) {
    throw new Error('Telegram product synchronization is not configured.');
  }
  const caption = formatProductCaption(product);
  const photos = syncedPhotos(product);
  const nextPostType = telegramPostType(product);
  const currentMessageCount = telegramMessageIds(product).length;

  try {
    if (product.telegramCleanupStatus === 'pending') {
      await cleanupSupersededPosts(product);
      if (!persist || !await persist({ telegramCleanupStatus: 'complete' })) {
        throw new Error('Could not save Telegram cleanup status.');
      }
    }
    if ((product.telegramPostType && product.telegramPostType !== nextPostType
        && !(product.telegramPostType === 'text' && nextPostType === 'photo'))
      || (currentMessageCount > 1 && currentMessageCount !== photos.length)
      || (currentMessageCount === 1 && photos.length > 1)) {
      return await replaceTelegramProductPost(product, persist);
    }

    if (photos.length === 1) {
      await editSinglePhotoPost(token, chatId, messageId, product, caption);
      return syncedTelegramPatch(product);
    }

    if (photos.length > 1 && currentMessageCount === photos.length
      && (!product.telegramSyncedPhotos || !samePhotoList(product.telegramSyncedPhotos, photos))
      && await editAlbumPhotos(token, chatId, product, photos, caption)) {
      return syncedTelegramPatch(product);
    }

    if (
      (photos.length > 1 && product.telegramSyncedPhotos && !samePhotoList(product.telegramSyncedPhotos, photos))
    ) {
      throw new Error('Telegram album message IDs must be verified before replacing its photos.');
    }

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

function telegramMessageIds(product) {
  return [...new Set([
    ...(Array.isArray(product.telegramMessageIds) ? product.telegramMessageIds : []),
    product.telegramMessageId,
  ].map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

export async function deleteTelegramProductPost(product) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = product.telegramChannelId || configuredChannelId();
  const messageIds = telegramMessageIds(product);

  if (!token || !chatId || messageIds.length === 0) {
    throw new Error('Telegram product synchronization is not configured.');
  }

  try {
    const failures = [];
    for (const messageId of messageIds) {
      try {
        const deleted = await telegramApi(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
        if (deleted !== true) throw new Error(`Telegram did not confirm deletion of message ${messageId}.`);
      } catch (error) {
        failures.push(error);
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
  const photos = syncedPhotos(product);
  return {
    telegramPostType: telegramPostType(product),
    telegramSyncedPhotos: photos,
    telegramSyncStatus: 'synced',
    telegramSyncedVersion: Math.max(1, Number(product.contentVersion) || 1),
    telegramLastSyncedAt: new Date().toISOString(),
    telegramSyncError: null,
  };
}
