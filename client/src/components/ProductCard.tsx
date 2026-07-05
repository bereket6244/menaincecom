import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import type { Product } from '../lib/types';
import { cx, cssColor, findVariantGroup, formatPrice } from '../lib/utils';

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

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
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
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
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

      {(() => {
        // Real Size/Color variants from the admin panel, shown on the card.
        const colorGroup = findVariantGroup(product, 'color');
        const sizeGroup = findVariantGroup(product, 'size');
        if (!colorGroup?.options.length && !sizeGroup?.options.length) return null;
        return (
          <div className="mt-3 space-y-1.5">
            {colorGroup && colorGroup.options.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {colorGroup.options.slice(0, 5).map((opt) => {
                  const swatch = cssColor(opt.label);
                  return opt.photo ? (
                    <img
                      key={opt.label}
                      src={opt.photo}
                      alt={opt.label}
                      title={opt.label}
                      loading="lazy"
                      decoding="async"
                      className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-black/10"
                    />
                  ) : swatch ? (
                    <span
                      key={opt.label}
                      title={opt.label}
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                      style={{ background: swatch }}
                    />
                  ) : (
                    <span key={opt.label} className="rounded-full border border-edge bg-surface px-1.5 py-0.5 text-[9px] font-medium text-muted">
                      {opt.label}
                    </span>
                  );
                })}
                {colorGroup.options.length > 5 && (
                  <span className="text-[10px] font-medium text-muted">+{colorGroup.options.length - 5}</span>
                )}
              </div>
            )}
            {sizeGroup && sizeGroup.options.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {sizeGroup.options.slice(0, 4).map((opt) => (
                  <span key={opt.label} className="rounded border border-edge bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink/70">
                    {opt.label}
                  </span>
                ))}
                {sizeGroup.options.length > 4 && (
                  <span className="text-[10px] font-medium text-muted">+{sizeGroup.options.length - 4}</span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <div className="mt-2.5 text-[11px] uppercase tracking-[0.08em] text-muted">Wedding Cards</div>
      <button onClick={open} className="mt-0.5 text-left text-base font-semibold text-ink transition-colors hover:text-pink">
        {product.name}
      </button>
      <div className="mt-2 text-[15px] font-bold text-[#ee0a24]">{formatPrice(product)}</div>
    </div>
  );
}
