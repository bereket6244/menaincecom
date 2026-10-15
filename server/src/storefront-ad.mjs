export function normalizeStorefrontAd(input) {
  if (!input || typeof input !== 'object' || typeof input.enabled !== 'boolean') {
    throw new Error('Choose whether to show the storefront ad.');
  }
  const source = { label: 'From Mena', ...input };
  const ad = { enabled: input.enabled };
  for (const [key, limit] of Object.entries({ label: 30, title: 80, description: 120, buttonText: 20, href: 500 })) {
    if (typeof source[key] !== 'string' || source[key].trim().length > limit) {
      throw new Error(`${key} must be text with at most ${limit} characters.`);
    }
    ad[key] = source[key].trim();
  }
  if (ad.enabled && (!ad.title || !ad.buttonText || !ad.href)) {
    throw new Error('Add a headline, button text, and destination before publishing.');
  }
  if (ad.href) {
    let valid = /^\/(?![\/\\])[^\\\s]*$/.test(ad.href);
    if (/^https?:\/\/[^\s\\]+$/i.test(ad.href)) {
      try { valid = Boolean(new URL(ad.href).hostname); } catch { valid = false; }
    }
    if (!valid) throw new Error('Use a shop path beginning with / or a full http:// or https:// link.');
  }
  return ad;
}
