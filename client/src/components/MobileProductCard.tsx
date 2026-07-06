import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { Product } from '../lib/types';
import { cx, formatPrice } from '../lib/utils';
import { useApp } from '../store/AppContext';

const TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];

export function mobileProductTint(product: Pick<Product, 'id' | 'name'>): string {
  const seed = `${product.id}${product.name}`.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TINTS[seed % TINTS.length];
}

export function MobileProductCard({
  product,
  categoryName = 'Wedding Cards',
  priority = false,
}: {
  product: Product;
  categoryName?: string;
  priority?: boolean;
}) {
  const navigate = useNavigate();
  const { wishlistProductIds, toggleWishlist } = useApp();
  const wished = wishlistProductIds.includes(product.id);
  const open = () => navigate(`/product/${product.id}`);
  const tint = mobileProductTint(product);

  return (
    <div className="mena-fade-up flex min-w-0 flex-col">
      <div className="relative">
        <button
          type="button"
          onClick={open}
          className="mena-press relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-surface2 text-left shadow-[0_1px_3px_rgba(28,26,25,0.08)]"
          style={{ background: product.photos[0] ? undefined : tint }}
        >
          {product.photos[0] ? (
            <img
              src={product.photos[0]}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
              <span className="font-script text-[28px] leading-none text-pink">{product.name}</span>
              <span className="mt-2.5 text-[8px] uppercase tracking-[0.24em] text-ink/50">Mena Inc.</span>
            </div>
          )}

          {product.featured && (
            <span className="absolute left-2 top-2 rounded-md bg-ink px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white">
              Featured
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void toggleWishlist(product.id)}
          aria-label={wished ? 'Remove from liked items' : 'Save to liked items'}
          className="mena-press absolute right-2 top-2 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/95 shadow-sm"
        >
          <Heart className={cx('h-4 w-4', wished ? 'fill-pink text-pink' : 'text-ink/40')} />
        </button>
      </div>

      <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{categoryName}</div>
      <button type="button" onClick={open} className="mt-0.5 truncate text-left text-[15px] font-semibold text-ink">
        {product.name}
      </button>
      <div className="mt-1 text-[15px] font-extrabold text-[#ee0a24]">{formatPrice(product)}</div>
    </div>
  );
}
