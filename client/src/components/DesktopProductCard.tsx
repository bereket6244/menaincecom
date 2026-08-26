import { useState } from 'react';
import { Heart } from 'lucide-react';
import type { Product } from '../lib/types';
import { useApp } from '../store/AppContext';
import { cleanDescription, cx, formatPrice } from '../lib/utils';
import { flyToLiked } from '../lib/fly';
import { ProductImageFrame } from './ProductImageFrame';
import { productLimitText } from '../lib/orderLimits';

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
  const selectedPhoto = product.photos[photoIndex] || product.photos[0];
  const hasMultiplePhotos = product.photos.length > 1;
  const limitText = productLimitText(product);
  const description = cleanDescription(product.description, product.name);

  return (
    <article
      className="mena-fade-up group overflow-hidden rounded-xl border border-edge bg-white shadow-[0_1px_4px_rgba(28,26,25,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-pink/20 hover:shadow-[0_12px_28px_rgba(28,26,25,0.11)]"
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <div className="relative">
        <ProductImageFrame
          src={selectedPhoto}
          alt={product.name}
          priority={priority}
          onOpen={() => onOpen(product)}
          showControls={hasMultiplePhotos}
        onPrevious={() => setPhotoIndex((current) => (current - 1 + product.photos.length) % product.photos.length)}
        onNext={() => setPhotoIndex((current) => (current + 1) % product.photos.length)}
        preloadSrcs={product.photos}
          className="aspect-[1.12/1]"
          imageClassName="transition-transform duration-500 group-hover:scale-[1.025]"
          placeholder={
            <div className="flex h-full flex-col items-center justify-center p-5 text-center" style={{ background: tint }}>
              <span className="font-script text-[34px] leading-none text-pink">{product.name}</span>
              <span className="mt-3 text-[9px] tracking-[0.24em] text-ink/40">mena inc</span>
            </div>
          }
        />

        {product.featured && (
          <span className="absolute left-3 top-3 z-30 rounded-md bg-pink px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white shadow-[0_5px_14px_rgba(238,49,123,0.25)]">
            Featured
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!wished) flyToLiked(e.currentTarget);
            void toggleWishlist(product.id);
          }}
          aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
          className="mena-press absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-[0_3px_12px_rgba(28,26,25,0.14)] hover:text-pink"
        >
          <Heart className={cx('h-4 w-4', wished ? 'fill-pink text-pink' : 'text-ink/45')} />
        </button>
      </div>

      <div className="p-3.5 pb-3">
        <button
          type="button"
          onClick={() => onOpen(product)}
          className="mena-press block min-h-[22px] text-left text-[15px] font-extrabold leading-tight text-ink hover:text-pink"
        >
          {product.name}
        </button>
        {description && (
          <p className="mt-1.5 line-clamp-2 min-h-[34px] text-[12.5px] font-medium leading-[1.35] text-ink/55">
            {description}
          </p>
        )}
        <div className="mt-2.5 flex flex-col items-stretch gap-2.5">
          <span className="text-[15px] font-extrabold leading-tight text-pink">{formatPrice(product)}</span>
          {limitText && <span className="text-[11px] font-bold text-[#ee0a24]">{limitText}</span>}
          <button
            type="button"
            onClick={() => onQuickAdd(product)}
            className="btn-outline h-9 w-full whitespace-nowrap px-4 py-0 text-[12px]"
          >
            {isQuote ? 'Request Quote' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </article>
  );
}
