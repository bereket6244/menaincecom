import fs from 'node:fs/promises';
import { isPublicProduct } from './product-model.mjs';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function publicImageUrl(photo, origin, basePath) {
  if (typeof photo !== 'string' || !photo.trim()) return null;
  try {
    const imagePath = /^https?:\/\//i.test(photo) || photo.startsWith(`${basePath}/`)
      ? photo
      : `${basePath === '/' ? '' : basePath}/${photo.replace(/^\/+/, '')}`;
    const url = new URL(imagePath, origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function productPageMeta(product, pageUrl, origin, basePath = '/') {
  const title = `${product.name} | mena inc`;
  const description = String(product.description || '').replace(/\s+/g, ' ').trim().slice(0, 240)
    || `View ${product.name} at mena inc.`;
  const image = publicImageUrl(product.photos?.[0], origin, basePath);
  const tag = (key, value, property = false) => `<meta ${property ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}" />`;
  return [
    `<title>${escapeHtml(title)}</title>`,
    tag('description', description),
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    tag('og:type', 'product', true),
    tag('og:site_name', 'mena inc', true),
    tag('og:title', title, true),
    tag('og:description', description, true),
    tag('og:url', pageUrl, true),
    ...(image ? [tag('og:image', image, true), tag('og:image:alt', product.name, true)] : []),
    tag('twitter:card', image ? 'summary_large_image' : 'summary'),
    tag('twitter:title', title),
    tag('twitter:description', description),
    ...(image ? [tag('twitter:image', image)] : []),
  ].join('\n    ');
}

export function productPageMiddleware({ clientIndex, basePath, getProduct, publicShopUrl }) {
  const productPath = `${basePath === '/' ? '' : basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/product/([^/]+)/?`;
  const route = new RegExp(`^(?:${productPath}${basePath === '/' ? '' : '|/product/([^/]+)/?'})$`);
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const match = req.path.match(route);
    if (!match) return next();
    let id;
    try { id = decodeURIComponent(match[1] || match[2]); } catch { return next(); }
    try {
      const product = await getProduct(id);
      if (!product || !isPublicProduct(product)) return next();
      const origin = publicShopUrl ? new URL(publicShopUrl).origin : `${req.protocol}://${req.get('host')}`;
      const pageUrl = `${origin}${basePath === '/' ? '' : basePath}/product/${encodeURIComponent(id)}`;
      const html = await fs.readFile(clientIndex, 'utf8');
      const metadata = productPageMeta(product, pageUrl, origin, basePath);
      const rendered = html
        .replace(/<title>[^<]*<\/title>/i, '')
        .replace(/<meta name="description"[^>]*>/i, '')
        .replace('</head>', `    ${metadata}\n  </head>`);
      res.set('Cache-Control', 'no-cache');
      res.type('html').send(rendered);
    } catch (error) {
      next(error);
    }
  };
}
