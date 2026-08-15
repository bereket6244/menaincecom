const PUBLIC_PRODUCT_FIELDS = new Set([
  'id', 'name', 'categoryId', 'description', 'photos', 'pricingMode', 'price', 'variants',
  'isAddon', 'suggestedAddonIds', 'complimentaryItems', 'universalComplimentaryItemIds',
  'featured', 'createdAt', 'updatedAt',
]);

export function normalizeProductStatus(value) {
  return ['draft', 'published', 'archived'].includes(value) ? value : 'published';
}

export function isPublicProduct(product) {
  return !product?.deletedAt && normalizeProductStatus(product?.status) === 'published';
}

export function publicProduct(product) {
  return Object.fromEntries(
    Object.entries(product || {}).filter(([key]) => PUBLIC_PRODUCT_FIELDS.has(key))
  );
}

export function telegramProductIdentity(product) {
  const channelId = String(product?.telegramChannelId || '');
  const messageId = Number(product?.telegramMessageId);
  return channelId && Number.isInteger(messageId) && messageId > 0
    ? `${channelId}:${messageId}`
    : null;
}
