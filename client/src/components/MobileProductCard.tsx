import { useNavigate } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
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

export function MobileProductCard({ product, priority = false, onQuickAdd }: {
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
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const selectedPhoto = pickedColorPhoto || product.photos[photoIndex] || product.photos[0];
  const hasMultiplePhotos = product.photos.length > 1;
  const selectedPhotoIndex = product.photos.indexOf(selectedPhoto || '');
  const activePhotoIndex = selectedPhotoIndex >= 0 ? selectedPhotoIndex : photoIndex;
  const limitText = productPreviewLimitText(product);
  const colors = colorOptions(product).slice(0, 5);
  const description = cleanDescription(product.description, product.name);

  return (
    <article className="mena-fade-up grid min-w-0 grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-3 border-b border-edge bg-white px-4 py-4 last:border-b-0">
      <div className="relative min-w-0 self-start">
        <ProductImageFrame
          src={selectedPhoto}
          alt={product.name}
          priority={priority}
          onOpen={open}
          showControls={hasMultiplePhotos}
          showArrows={false}
          showDots={hasMultiplePhotos}
          activeIndex={activePhotoIndex}
          onPrevious={() => {
            setPickedColorPhoto(null);
            setPhotoIndex((current) => (current - 1 + product.photos.length) % product.photos.length);
          }}
          onNext={() => {
            setPickedColorPhoto(null);
            setPhotoIndex((current) => (current + 1) % product.photos.length);
          }}
          preloadSrcs={product.photos}
          className="mena-press aspect-[4/5] w-full rounded-lg text-left"
          placeholder={
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center" style={{ background: tint }}>
              <span className="font-sans text-[20px] font-semibold leading-tight text-pink">{product.name}</span>
              <span className="mt-2.5 text-[8px] tracking-[0.24em] text-ink/50">mena inc</span>
            </div>
          }
        />
        <button
          type="button"
          onClick={async (event) => {
            if (wishlistBusy) return;
            if (!wished) flyToLiked(event.currentTarget);
            setWishlistBusy(true);
            try { await toggleWishlist(product.id); }
            finally { setWishlistBusy(false); }
          }}
          disabled={wishlistBusy}
          aria-busy={wishlistBusy}
          aria-label={wished ? 'Remove from liked items' : 'Save to liked items'}
          className="mena-press absolute right-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink/70 shadow-sm disabled:cursor-wait disabled:opacity-70"
        >
          {wishlistBusy ? <Loader2 className="h-4 w-4 animate-spin text-pink" /> : <Heart className={cx('h-4 w-4', wished && 'fill-pink text-pink')} />}
        </button>
      </div>

      <div className="flex min-w-0 flex-col items-start">
        <button type="button" onClick={open} className="line-clamp-2 w-full text-left font-sans text-[16px] font-semibold leading-[1.3] text-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-pink">
          {product.name}
        </button>
        {description && <p className="mt-1.5 line-clamp-2 w-full text-sm leading-[1.4] text-ink/75">{description}</p>}
        {colors.length > 1 && (
          <div className="mt-2 flex max-w-full flex-wrap gap-1.5" aria-label="Available colors">
            {colors.map((color) => {
              const active = Boolean(color.photo && selectedPhoto === color.photo);
              return (
                <button
                  key={color.label}
                  type="button"
                  title={color.photo ? `Show ${color.label}` : color.label}
                  onClick={() => { if (color.photo) setPickedColorPhoto(color.photo); }}
                  className={cx('mena-press flex h-9 w-9 items-center justify-center rounded-full border bg-white', active ? 'border-pink ring-2 ring-pink/25' : 'border-edge')}
                  aria-label={color.photo ? `Show ${color.label} photo` : `${color.label} color`}
                >
                  <span className="h-5 w-5 rounded-full ring-1 ring-black/15" style={{ background: color.swatch || '#f4f0ec' }} />
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-auto w-full pt-3">
          <div className="text-[20px] font-bold leading-tight text-pink">{formatPrice(product)}</div>
          {limitText && <div className="mt-0.5 text-xs leading-tight text-muted">{limitText}</div>}
          <button
            type="button"
            onClick={() => onQuickAdd ? onQuickAdd(product) : open()}
            className="mena-press mt-2.5 flex min-h-11 w-full items-center justify-center rounded-full bg-pink px-3 text-sm font-bold text-white hover:bg-pink-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink"
          >
            View product
          </button>
        </div>
      </div>
    </article>
  );
}
