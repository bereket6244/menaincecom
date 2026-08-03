const PRICE_PATTERN = /(?:^|[^\d])([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:birr|etb)\b/giu;
const UNAVAILABLE_PATTERN = /\b(?:not available|unavailable|out of stock|discontinued)\b/i;
const PRODUCT_WORD_PATTERN = /\b(?:card|invitation|envelop(?:e)?|wax|velvet|acrylic|ribbon|wedding|favo[u]?r|pocket|fold|tracing)\b/i;
const NON_TITLE_PATTERN = /^(?:available\b|not available\b|currently\b|only\b|size\b|natural flowers?\b|limited edition\b|ajabi\b|megbia\b|entrance cards?\b)|\b(?:cards? (?:are|is) complimentary|free with (?:your )?purchase)\b/i;

function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parsePrices(text) {
  const values = [];
  for (const match of String(text || '').matchAll(PRICE_PATTERN)) {
    const value = Number(match[1].replaceAll(',', ''));
    if (Number.isFinite(value) && value >= 0) values.push(value);
  }
  return [...new Set(values)];
}

export function parseTitle(text) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const withoutTags = line.replace(/#[\p{L}\p{N}_-]+/gu, '').trim();
    const withoutPrice = withoutTags
      .replace(/(?:^|\s)[0-9][0-9,]*(?:\.[0-9]+)?\s*(?:birr|etb)\b.*$/iu, '')
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, '')
      .replace(/\s+price$/iu, '')
      .trim();
    if (withoutPrice && /[\p{L}]/u.test(withoutPrice) && !NON_TITLE_PATTERN.test(withoutPrice)) {
      return withoutPrice;
    }
  }
  return '';
}

function productDraft(message, channelUsername) {
  const prices = parsePrices(message.text);
  const title = parseTitle(message.text);
  const media = message.albumMedia || message.media;
  const reasons = [];
  if (!title) reasons.push('missing_title');
  if (prices.length === 0) reasons.push('missing_price');
  if (prices.length > 1) reasons.push('multiple_prices');
  if (media.length === 0) reasons.push('missing_media');
  if (media.some((item) => !item.exists)) reasons.push('missing_media_file');
  if (message.inferredMediaGroupId) reasons.push('html_inferred_album');
  if (message.replyToMessageId) reasons.push('reply_requires_review');

  return {
    telegramMessageId: message.id,
    telegramMediaGroupId: message.inferredMediaGroupId,
    telegramPostUrl: channelUsername ? `https://t.me/${channelUsername}/${message.id}` : null,
    telegramOriginalCaption: message.text,
    originalPublishedAt: message.date,
    name: title || null,
    description: message.text || '',
    pricingMode: prices.length === 0 ? 'quote' : prices.length === 1 ? 'exact' : 'starting',
    price: prices.length === 0 ? null : Math.min(...prices),
    priceCandidates: prices,
    currency: 'ETB',
    tags: message.hashtags,
    photos: media.filter((item) => item.kind === 'photo').map((item) => item.relativePath),
    videos: media.filter((item) => item.kind === 'video').map((item) => item.relativePath),
    unavailable: UNAVAILABLE_PATTERN.test(message.text),
    importStatus: 'pending_review',
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
  };
}

export function classifyMessages(messages, channelUsername) {
  const captionGroups = new Map();
  for (const message of messages) {
    const key = normalized(message.text);
    if (!key) continue;
    const group = captionGroups.get(key) || [];
    group.push(message.id);
    captionGroups.set(key, group);
  }

  return messages.map((message) => {
    const prices = parsePrices(message.text);
    const title = parseTitle(message.text);
    const captionMatches = captionGroups.get(normalized(message.text)) || [];
    let classification = 'needs_manual_review';
    const reasons = [];

    if (message.albumRepresentativeId && message.albumRepresentativeId !== message.id) {
      classification = 'album_member';
    } else if (message.replyToMessageId) {
      classification = 'product_update';
    } else if ((message.media.length > 0 && prices.length > 0) || (prices.length > 0 && title)) {
      classification = captionMatches.length > 1 ? 'product_repost' : 'product';
    } else if (message.media.length > 0 && PRODUCT_WORD_PATTERN.test(message.text)) {
      classification = 'product';
      reasons.push('missing_price');
    } else if (!message.text && message.media.length > 0) {
      classification = 'unsupported_attachment';
      reasons.push('media_without_caption');
    } else if (message.text && message.media.length === 0) {
      classification = 'general_announcement';
    } else if (!message.text && message.media.length === 0) {
      classification = 'empty_message';
    }

    if (captionMatches.length > 1 && classification !== 'album_member') {
      reasons.push('repeated_caption');
    }
    if (message.media.some((item) => !item.exists)) reasons.push('missing_media_file');

    const isProductCandidate = ['product', 'product_repost', 'product_update'].includes(classification);
    return {
      ...message,
      classification,
      classificationReasons: reasons,
      proposedProduct: isProductCandidate ? productDraft(message, channelUsername) : null,
    };
  });
}
