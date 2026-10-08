import { useState } from 'react';
import { Check, Heart, Loader2 } from 'lucide-react';
import type { Product } from '../lib/types';
import { useApp } from '../store/AppContext';
import { cleanDescription, colorOptions, cx, formatPrice } from '../lib/utils';
import { flyToLiked } from '../lib/fly';
import { ProductImageFrame } from './ProductImageFrame';
import { productPreviewLimitText } from '../lib/orderLimits';

const TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#e9f0ec', '#f6efdd'];

export function DesktopProductCard({
  product,
  priority = false,
  index = 0,
  onOpen,
  onQuickAdd,
}: {
  product: Product;
  priority?: boolean;
  index?: number;
  onOpen: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}) {
  const { wishlistProductIds, toggleWishlist } = useApp();
  const wished = wishlistProductIds.includes(product.id);
  const tint = TINTS[index % TINTS.length];
  const isQuote = product.pricingMode === 'quote' || product.price == null;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [pickedColorPhoto, setPickedColorPhoto] = useState<string | null>(null);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [quickState, setQuickState] = useState<'idle' | 'adding' | 'added'>('idle');
  const selectedPhoto = pickedColorPhoto || product.photos[photoIndex] || product.photos[0];
  const hasMultiplePhotos = product.photos.length > 1;
  const limitText = productPreviewLimitText(product);
  const description = cleanDescription(product.description, product.name);
  const colors = colorOptions(product).slice(0, 8);
  const showColors = colors.length > 0;

  return (
    <article
      className="mena-fade-up group overflow-hidden rounded-2xl border border-edge/70 bg-white shadow-[0_12px_32px_rgba(28,26,25,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(28,26,25,0.13)]"
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <div className="relative p-2.5 pb-0">
        <ProductImageFrame
          src={selectedPhoto}
          alt={product.name}
          priority={priority}
          onOpen={() => onOpen(product)}
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
          className="aspect-[1.08/1] rounded-[18px]"
          imageClassName="transition-transform duration-500 group-hover:scale-[1.025]"
          placeholder={
            <div className="flex h-full flex-col items-center justify-center p-5 text-center" style={{ background: tint }}>
              <span className="font-script text-[34px] leading-none text-pink">{product.name}</span>
              <span className="mt-3 text-[9px] tracking-[0.24em] text-ink/40">mena inc</span>
            </div>
          }
        />

        {showColors && (
          <div className="absolute bottom-3 left-5 right-5 z-30 flex items-center gap-1.5">
            <div className="flex max-w-full gap-1.5 overflow-hidden rounded-full bg-white/90 px-1.5 py-1.5 shadow-[0_5px_16px_rgba(28,26,25,0.12)] backdrop-blur">
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
                      'mena-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white transition',
                      active ? 'border-pink ring-2 ring-pink/25' : 'border-white hover:border-pink/50'
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
          </div>
        )}

        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            if (wishlistBusy) return;
            if (!wished) flyToLiked(e.currentTarget);
            setWishlistBusy(true);
            try {
              await toggleWishlist(product.id);
            } finally {
              setWishlistBusy(false);
            }
          }}
          disabled={wishlistBusy}
          aria-busy={wishlistBusy}
          aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
          className="mena-press absolute right-5 top-5 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink/70 shadow-[0_5px_16px_rgba(28,26,25,0.14)] backdrop-blur hover:text-pink disabled:cursor-wait disabled:opacity-70"
        >
          {wishlistBusy ? <Loader2 className="h-4 w-4 animate-spin text-pink" /> : <Heart className={cx('h-4 w-4', wished ? 'fill-pink text-pink' : '')} />}
        </button>
      </div>

      <div className="p-4 pt-3.5">
        <button
          type="button"
          onClick={() => onOpen(product)}
          className="mena-press block min-h-[42px] text-left font-serif text-[22px] font-semibold leading-[1.06] text-ink hover:text-pink"
        >
          {product.name}
        </button>
        {description && (
          <p className="mt-2 line-clamp-2 min-h-[38px] text-[14px] font-medium leading-[1.4] text-ink/58">
            {description}
          </p>
        )}
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-2">
          <span className="text-[24px] font-extrabold leading-none text-pink">{formatPrice(product)}</span>
          {limitText && <span className="max-w-[104px] text-right text-[10.5px] font-bold leading-tight text-pink/85">{limitText}</span>}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              if (quickState !== 'idle') return;
              setQuickState('adding');
              window.setTimeout(() => {
                onQuickAdd(product);
                setQuickState('added');
                window.setTimeout(() => setQuickState('idle'), 750);
              }, 140);
            }}
            disabled={quickState !== 'idle'}
            aria-busy={quickState === 'adding'}
            className="mena-press flex h-11 w-full items-center justify-center gap-2 rounded-full bg-pink px-3 text-[13px] font-extrabold text-white shadow-[0_10px_22px_rgba(238,49,123,0.25)] hover:bg-pink-dim disabled:cursor-wait disabled:opacity-80"
          >
            {quickState === 'adding' && <Loader2 className="h-4 w-4 animate-spin" />}
            {quickState === 'added' && <Check className="h-4 w-4" />}
            {quickState === 'adding' ? 'Adding...' : quickState === 'added' ? 'Added' : isQuote ? 'Request Quote' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
