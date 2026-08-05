import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { useApp } from '../store/AppContext';

export function Wishlist() {
  const navigate = useNavigate();
  const { wishlistProductIds } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');
  const liked = (products || []).filter((product) => wishlistProductIds.includes(product.id));

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-edge bg-surface px-3">
        <button type="button" onClick={() => navigate(-1)} className="mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2" aria-label="Back">
          <ChevronLeft className="h-5.5 w-5.5" />
        </button>
        <div className="flex-1 font-serif text-[22px] font-semibold">Liked items</div>
        <div className="pr-1 text-[12.5px] text-muted">{liked.length} items</div>
      </header>

      {loading && !products ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : liked.length === 0 ? (
        <div className="px-4 py-14">
          <EmptyState>
            No liked items yet.
            <Link to="/catalog" className="btn-primary mt-3">Browse the catalog</Link>
          </EmptyState>
        </div>
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {liked.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
