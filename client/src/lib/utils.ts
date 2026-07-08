import type { Product } from './types';

export function formatPrice(product: Pick<Product, 'pricingMode' | 'price'>): string {
  if (product.pricingMode === 'quote' || product.price == null) return 'Request a quote';
  const amount = `${product.price.toLocaleString()} ETB`;
  return product.pricingMode === 'starting' ? `From ${amount}` : amount;
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

/** CSS colour for a variant label like "ivory" or "#c2185b", or null if the browser can't render it. */
export function cssColor(label: string): string | null {
  const value = label.trim().toLowerCase();
  if (!value) return null;
  return typeof CSS !== 'undefined' && CSS.supports?.('color', value) ? value : null;
}

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function assetUrl(src: string | undefined): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith('/uploads/')) return `${APP_BASE}${src}`;
  return src;
}

const MAX_DIMENSION = 2400;
const QUALITY = 0.92;
const WATERMARK_OPACITY = 0.82;

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

  ctx.save();
  ctx.globalAlpha = WATERMARK_OPACITY;
  ctx.drawImage(watermark, 0, 0, width, height);
  ctx.restore();
}

/**
 * Client-side photo compression: downscales to a web-friendly size and
 * re-encodes (WebP when supported, JPEG otherwise) before upload, so large
 * camera photos never hit the server or slow the storefront down.
 */
export async function compressImage(file: File, options: CompressImageOptions = {}): Promise<File> {
  if (!/^image\//.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  if (!options.watermarkSrc && scale === 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  if (options.watermarkSrc) await drawWatermark(ctx, width, height, options.watermarkSrc);

  const tryEncode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

  let blob = await tryEncode('image/webp');
  let ext = '.webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await tryEncode('image/jpeg');
    ext = '.jpg';
  }
  if (!blob) return file;
  // Keep the original if compression didn't actually help (tiny files).
  if (!options.watermarkSrc && blob.size >= file.size && scale === 1) return file;

  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}${ext}`, { type: blob.type });
}
