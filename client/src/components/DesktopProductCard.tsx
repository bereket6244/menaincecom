import { Heart } from 'lucide-react';
import type { Product, Category } from '../lib/types';
import { useApp } from '../store/AppContext';
import { cx, formatPrice } from '../lib/utils';

const TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#e9f0ec', '#f6efdd'];

export function DesktopProductCard({
  product,
  category,
  priority = false,
  index = 0,
  onOpen,
  onQuickAdd,
}: {
  product: Product;
  category?: Category;
  priority?: boolean;
  index?: number;
  onOpen: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}) {
  const { wishlistProductIds, toggleWishlist } = useApp();
  const wished = wishlistProductIds.includes(product.id);
  const tint = TINTS[index % TINTS.length];
  const isQuote = product.pricingMode === 'quote' || product.price == null;

  return (
    <article
      className="mena-fade-up group overflow-hidden rounded-[14px] border border-edge bg-white shadow-[0_1px_3px_rgba(28,26,25,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(28,26,25,0.12)]"
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      <div className="relative aspect-square overflow-hidden" style={{ background: tint }}>
        <button type="button" onClick={() => onOpen(product)} className="block h-full w-full cursor-pointer">
          {product.photos[0] ? (
            <img
              src={product.photos[0]}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-5 text-center">
              <span className="font-script text-[34px] leading-none text-pink">{product.name}</span>
              <span className="mt-3 text-[9px] uppercase tracking-[0.24em] text-ink/40">mena Inc.</span>
            </div>
          )}
        </button>

        {product.featured && (
          <span className="absolute left-3 top-3 rounded-md bg-pink px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white">
            Featured
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleWishlist(product.id);
          }}
          aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
          className="mena-press absolute right-3 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/95 shadow-[0_1px_4px_rgba(28,26,25,0.14)]"
        >
          <Heart className={cx('h-4 w-4', wished ? 'fill-pink text-pink' : 'text-ink/45')} />
        </button>
      </div>

      <div className="p-4 pb-[18px]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted/80">
          {category?.name || (product.isAddon ? 'Add-on' : 'Design')}
        </div>
        <button
          type="button"
          onClick={() => onOpen(product)}
          className="mena-press mt-1 block text-left text-base font-extrabold leading-tight text-ink hover:text-pink"
        >
          {product.name}
        </button>
        <div className="mt-3.5 flex items-center justify-between gap-3">
          <span className="text-[15px] font-extrabold text-pink">{formatPrice(product)}</span>
          <button
            type="button"
            onClick={() => onQuickAdd(product)}
            className="btn-outline h-[36px] min-w-[120px] whitespace-nowrap px-5 py-0 text-[12.5px]"
          >
            {isQuote ? 'Request Quote' : 'Add to Order'}
          </button>
        </div>
      </div>
    </article>
  );
}
