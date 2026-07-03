import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { Product } from '../lib/types';
import { formatPrice } from '../lib/utils';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group overflow-hidden rounded-md border border-edge bg-surface transition-colors hover:border-pink/50"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-surface2">
        {product.photos[0] ? (
          <img
            src={product.photos[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted/40">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="truncate text-xs font-semibold text-ink">{product.name}</div>
        <div className="mt-0.5 text-[11px] text-muted">{formatPrice(product)}</div>
      </div>
    </Link>
  );
}
