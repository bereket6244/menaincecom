import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { useApp } from '../store/AppContext';

export function Wishlist() {
  const { user, wishlistProductIds } = useApp();
  const { data: products, loading } = useData<Product[]>('/products');
  const liked = (products || []).filter((product) => wishlistProductIds.includes(product.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-pink">
            <Heart className="h-4 w-4 fill-pink" />
            Liked items
          </div>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Your wishlist</h1>
          <p className="mt-1 text-sm text-muted">
            {user ? 'Saved to your account and this device.' : 'Saved on this device. Log in to keep them across devices.'}
          </p>
        </div>
        {!user && (
          <Link to="/login" className="rounded-full bg-pink px-5 py-2.5 text-sm font-bold text-white hover:bg-pink-dim">
            Log in to sync
          </Link>
        )}
      </div>

      {loading && !products ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : liked.length === 0 ? (
        <EmptyState>
          No liked items yet.
          <Link to="/catalog" className="mt-1 font-semibold text-pink hover:underline">Browse designs</Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {liked.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
