import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../lib/types';
import { cleanDescription, colorOptions, cx, formatPrice } from '../lib/utils';
import { flyToLiked } from '../lib/fly';
import { useApp } from '../store/AppContext';
import { ProductImageFrame } from './ProductImageFrame';
import { productPreviewLimitText } from '../lib/orderLimits';

const TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];

export function mobileProductTint(product: Pick<Product, 'id' | 'name'>): string {
  const seed = `${product.id}${product.name}`.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TINTS[seed % TINTS.length];
}

export function MobileProductCard({
  product,
  priority = false,
  onQuickAdd,
}: {
  product: Product;
  priority?: boolean;
  onQuickAdd?: (product: Product) => void;
}) {
  const navigate = useNavigate();
  const { wishlistProductIds, toggleWishlist } = useApp();
  const wished = wishlistProductIds.includes(product.id);
  const open = () => navigate(`/product/${product.id}`);
  const tint = mobileProductTint(product);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [pickedColorPhoto, setPickedColorPhoto] = useState<string | null>(null);
  const selectedPhoto = pickedColorPhoto || product.photos[photoIndex] || product.photos[0];
  const hasMultiplePhotos = product.photos.length > 1;
  const limitText = productPreviewLimitText(product);
  const colors = colorOptions(product).slice(0, 6);
  const isQuote = product.pricingMode === 'quote' || product.price == null;
  const description = cleanDescription(product.description, product.name);

  return (
    <article className="mena-fade-up flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-edge/70 bg-white p-1.5 shadow-[0_10px_28px_rgba(28,26,25,0.08)]">
      <div className="relative">
        <ProductImageFrame
          src={selectedPhoto}
          alt={product.name}
          priority={priority}
          onOpen={open}
          showControls={hasMultiplePhotos}
          onPrevious={() => {
            setPickedColorPhoto(null);
            setPhotoIndex((current) => (current - 1 + product.photos.length) % product.photos.length);
          }}
          onNext={() => {
            setPickedColorPhoto(null);
            setPhotoIndex((current) => (current + 1) % product.photos.length);
          }}
          preloadSrcs={[...product.photos, ...colors.map((color) => color.photo || '').filter(Boolean)]}
          className="mena-press aspect-[1/1.18] w-full rounded-[16px] text-left"
          placeholder={
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center" style={{ background: tint }}>
              <span className="font-script text-[28px] leading-none text-pink">{product.name}</span>
              <span className="mt-2.5 text-[8px] tracking-[0.24em] text-ink/50">mena inc</span>
            </div>
          }
        />

        {colors.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 z-30 flex max-w-full gap-1 overflow-hidden rounded-full bg-white/90 px-1.5 py-1.5 shadow-sm backdrop-blur">
            {colors.map((color) => {
              const active = color.photo && selectedPhoto === color.photo;
              return (
                <button
                  key={color.label}
                  type="button"
                  title={color.photo ? `Show ${color.label}` : color.label}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (color.photo) setPickedColorPhoto(color.photo);
                  }}
                  className={cx(
                    'mena-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white',
                    active ? 'border-pink ring-2 ring-pink/25' : 'border-white'
                  )}
                  aria-label={color.photo ? `Show ${color.label} photo` : `${color.label} color`}
                >
                  <span
                    className="h-[18px] w-[18px] rounded-full ring-1 ring-black/15"
                    style={{ background: color.swatch || '#f4f0ec' }}
                  />
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            if (!wished) flyToLiked(e.currentTarget);
            void toggleWishlist(product.id);
          }}
          aria-label={wished ? 'Remove from liked items' : 'Save to liked items'}
          className="mena-press absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink/70 shadow-sm"
        >
          <Heart className={cx('h-4 w-4', wished ? 'fill-pink text-pink' : '')} />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-0.5 pb-0.5">
        <button type="button" onClick={open} className="mt-2 line-clamp-2 min-h-[34px] text-left font-serif text-[17px] font-semibold leading-none text-ink">
          {product.name}
        </button>
        <p className="mt-1 line-clamp-2 min-h-[28px] text-[10.5px] font-medium leading-[1.3] text-ink/58">
          {description || '\u00a0'}
        </p>
        <div className="mt-auto pt-2">
          <div className="flex min-h-[26px] items-end justify-between gap-2">
            <div className="text-[17px] font-extrabold leading-none text-pink">{formatPrice(product)}</div>
            {limitText ? (
              <div className="max-w-[76px] text-right text-[9px] font-bold leading-tight text-pink/85">{limitText}</div>
            ) : (
              <div className="h-0 max-w-[76px]" aria-hidden="true" />
            )}
          </div>
          <button
            type="button"
            onClick={() => (onQuickAdd ? onQuickAdd(product) : open())}
            className="mena-press mt-2 flex h-8 w-full items-center justify-center rounded-full bg-pink px-2 text-[11px] font-extrabold text-white shadow-[0_8px_18px_rgba(238,49,123,0.23)] hover:bg-pink-dim"
          >
            {isQuote ? 'Request Quote' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
