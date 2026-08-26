import type { CartItem, Product } from './types';

export function formatPrice(product: Pick<Product, 'pricingMode' | 'price'>): string {
  if (product.pricingMode === 'quote' || product.price == null) return 'Request a quote';
  const amount = `${product.price.toLocaleString()} ETB`;
  return product.pricingMode === 'starting' ? `From ${amount}` : amount;
}

/**
 * The unit price a cart line carries. Anything with a real number counts —
 * a 'starting' price is an estimate the studio confirms, not a quote-only item,
 * so it has to reach the cart total instead of silently becoming "Quote".
 */
export function cartPriceEach(product: Pick<Product, 'pricingMode' | 'price'>): number | null {
  return product.pricingMode !== 'quote' && product.price != null ? product.price : null;
}

/** Line total for a cart item, prefixed with "From" for starting prices. */
export function formatLineTotal(item: Pick<CartItem, 'pricingMode' | 'priceEach' | 'qty'>): string {
  if (item.priceEach == null) return 'Quote';
  const amount = `${(item.priceEach * item.qty).toLocaleString()} ETB`;
  return item.pricingMode === 'starting' ? `From ${amount}` : amount;
}

/**
 * Cart/checkout total. `+` marks items priced on request, `From` marks a total
 * that includes starting prices — both mean the studio confirms the final figure.
 */
export function formatCartTotal(
  total: number | null,
  { hasQuote = false, hasStarting = false }: { hasQuote?: boolean; hasStarting?: boolean } = {}
): string {
  if (total == null) return hasQuote ? 'Quote' : '0 ETB';
  return `${hasStarting ? 'From ' : ''}${total.toLocaleString()} ETB${hasQuote ? ' +' : ''}`;
}

/**
 * Tidy a product description for customer display. The raw text (often a
 * Telegram import) repeats the name/price, mentions complimentary items and
 * colours that are chosen elsewhere in the UI, and ends in hashtags. We strip
 * all of that and collapse blank lines so the copy reads tight. The original
 * description is left untouched for search, so hashtags stay discoverable.
 */
export function cleanDescription(description: string | undefined, productName?: string): string {
  if (!description) return '';
  const nameLower = (productName || '').trim().toLowerCase();
  return description
    .split(/\r?\n/)
    .map((line) => line.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s{2,}/g, ' ').trim())
    .filter((line) => {
      if (!line) return false; // drops empties and collapses blank-line gaps
      const lower = line.toLowerCase();
      if (nameLower && lower === nameLower) return false; // repeated product name
      if (/^\d[\d,.\s]*(etb|birr)?$/i.test(lower)) return false; // price-only line
      if (/(complimentary|complementary)/i.test(lower)) return false; // covered below the fold
      if (/available in all colou?rs?/i.test(lower)) return false; // colour chosen at checkout
      return true;
    })
    .join('\n');
}

export function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const COLOR_GROUP_NAMES = ['color', 'colour', 'colors', 'colours'];
const SIZE_GROUP_NAMES = ['size', 'sizes'];

export function isColorGroupName(name: string): boolean {
  return COLOR_GROUP_NAMES.includes(name.trim().toLowerCase());
}

export function isSizeGroupName(name: string): boolean {
  return SIZE_GROUP_NAMES.includes(name.trim().toLowerCase());
}

export function findVariantGroup(product: Pick<Product, 'variants'>, kind: 'color' | 'size') {
  const match = kind === 'color' ? isColorGroupName : isSizeGroupName;
  return (product.variants || []).find((g) => match(g.name)) || null;
}

const NAMED_SWATCHES: Record<string, string> = {
  blush: '#f5b5c8',
  cream: '#fff5dc',
  gold: '#ffd21f',
  ivory: '#fffef0',
  navy: '#000080',
  sage: '#b8c8a7',
  terracotta: '#c86f4a',
};

/** CSS colour for a variant label like "Sage", "ivory" or "#c2185b", or null if it cannot be rendered. */
export function cssColor(label: string): string | null {
  const value = label.trim().toLowerCase();
  if (!value) return null;
  if (NAMED_SWATCHES[value]) return NAMED_SWATCHES[value];
  return typeof CSS !== 'undefined' && CSS.supports?.('color', value) ? value : null;
}

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function assetUrl(src: string | undefined): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith('/uploads/')) return `${APP_BASE}${src}`;
  return src;
}

type CompressImageOptions = {
  watermarkSrc?: string;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Watermark image could not be loaded.'));
    image.src = src;
  });
}

async function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, src: string) {
  const watermark = await loadImage(src);
  const pattern = ctx.createPattern(watermark, 'repeat');
  if (!pattern) {
    ctx.drawImage(watermark, 0, 0);
    return;
  }

  ctx.save();
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Client-side photo handling: preserve original uploads unless a watermark is
 * requested. Watermarked photos are re-encoded as high-quality JPEG — a
 * full-resolution PNG re-encode of a phone photo is 15-40MB, which the
 * hosting layer rejects before the request ever reaches the API. PNG sources
 * stay PNG so transparency survives.
 */
export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  if (!/^image\//.test(file.type)) return file;
  if (!options.watermarkSrc) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Could not read the selected image for watermarking.');

  const keepPng = file.type === 'image/png';
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the image for watermarking.');
  if (!keepPng) {
    // JPEG has no alpha channel; without this, transparent regions turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  await drawWatermark(ctx, canvas.width, canvas.height, options.watermarkSrc);

  const type = keepPng ? 'image/png' : 'image/jpeg';
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (blob && blob.size > 8 * 1024 * 1024 && !keepPng) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));
  }
  if (!blob) throw new Error('Could not save the watermarked image.');

  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}-watermarked.${keepPng ? 'png' : 'jpg'}`, { type: blob.type });
}
