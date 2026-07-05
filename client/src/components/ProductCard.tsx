import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import type { Product } from '../lib/types';
import { cx, formatPrice } from '../lib/utils';

/* Lightweight, self-contained wishlist persisted in localStorage. */
const WKEY = 'mena_wishlist';
function readWish(): string[] {
  try {
    return JSON.parse(localStorage.getItem(WKEY) || '[]');
  } catch {
    return [];
  }
}
function toggleWish(id: string): boolean {
  const w = readWish();
  const next = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
  localStorage.setItem(WKEY, JSON.stringify(next));
  return next.includes(id);
}

/* Decorative colour swatches shown under each card, à la The Knot. */
const SWATCHES = ['#efe9df', '#ffffff', '#1f2937', '#c2185b', '#5e7a3b'];

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const [wished, setWished] = useState(false);
  useEffect(() => {
    setWished(readWish().includes(product.id));
  }, [product.id]);

  const open = () => navigate(`/product/${product.id}`);

  return (
    <div className="group flex flex-col">
      <div className="relative">
        <button
          onClick={open}
          className="block w-full overflow-hidden rounded-md bg-surface2 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
        >
          <div className="aspect-[5/7] w-full overflow-hidden">
            {product.photos[0] ? (
              <img
                src={product.photos[0]}
                alt={product.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-[#f4f0ec] p-4 text-center">
                <span className="font-script text-3xl leading-none text-pink">{product.name}</span>
                <span className="mt-3 text-[9px] uppercase tracking-[0.24em] text-ink/50">Mena Inc.</span>
              </div>
            )}
          </div>
        </button>

        {product.featured && (
          <span className="absolute left-2.5 top-2.5 rounded bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Featured
          </span>
        )}

        <button
          onClick={() => setWished(toggleWish(product.id))}
          aria-label="Save to wishlist"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-105"
        >
          <Heart className={cx('h-4 w-4', wished ? 'fill-pink text-pink' : 'text-ink/40')} />
        </button>
      </div>

      <div className="mt-3 flex gap-1.5">
        {SWATCHES.slice(0, 4).map((c) => (
          <span
            key={c}
            className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="mt-2.5 text-[11px] uppercase tracking-[0.08em] text-muted">Wedding Cards</div>
      <button onClick={open} className="mt-0.5 text-left text-base font-semibold text-ink transition-colors hover:text-pink">
        {product.name}
      </button>
      <button onClick={open} className="mt-1.5 self-start text-[13px] font-semibold text-pink hover:underline">
        Order a sample
      </button>
      <div className="mt-2 text-[15px] font-bold text-[#ee0a24]">{formatPrice(product)}</div>
    </div>
  );
}
