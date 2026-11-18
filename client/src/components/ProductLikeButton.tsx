import { useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { useApp } from '../store/AppContext';

export function ProductLikeButton({ productId, name }: { productId: string; name: string }) {
  const { wishlistProductIds, toggleWishlist } = useApp();
  const [busy, setBusy] = useState(false);
  const liked = wishlistProductIds.includes(productId);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleWishlist(productId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-busy={busy}
      aria-pressed={liked}
      aria-label={`${liked ? 'Unlike' : 'Like'} ${name}`}
      className="product-utility-action"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Heart className={`h-5 w-5 ${liked ? 'fill-pink text-pink' : ''}`} aria-hidden="true" />}
      <span>{liked ? 'Liked' : 'Like'}</span>
    </button>
  );
}
