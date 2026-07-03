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

const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

/**
 * Client-side photo compression: downscales to a web-friendly size and
 * re-encodes (WebP when supported, JPEG otherwise) before upload, so large
 * camera photos never hit the server or slow the storefront down.
 */
export async function compressImage(file: File): Promise<File> {
  if (!/^image\//.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

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
  if (blob.size >= file.size && scale === 1) return file;

  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}${ext}`, { type: blob.type });
}
