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
