import { Link } from 'react-router-dom';
import { useData } from '../lib/useData';
import type { Category, GalleryItem, HomepageContent, Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { Spinner } from '../components/ui';

const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];

export function Home() {
  const { data: content } = useData<HomepageContent>('/content/homepage');
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const { data: gallery } = useData<GalleryItem[]>('/gallery');

  const featured = (products || []).filter((p) => p.featured && !p.isAddon).slice(0, 8);
  const latest = featured.length ? featured : (products || []).filter((p) => !p.isAddon).slice(0, 8);

  return (
    <div className="space-y-12">
      {content?.noticeText && (
        <div className="rounded-xl border border-pink/30 bg-pink/10 px-4 py-3 text-sm text-ink">{content.noticeText}</div>
      )}

      {/* Categories */}
      {(categories || []).length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold">Shop by category</h2>
            <Link to="/catalog" className="text-[13px] font-semibold text-pink hover:underline">View all</Link>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {(categories || []).map((c, i) => (
              <Link key={c.id} to={`/catalog?category=${c.id}`} className="flex w-[92px] shrink-0 flex-col items-center gap-2.5">
                <span
                  className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full"
                  style={{ background: c.photo ? undefined : CIRCLE_TINTS[i % CIRCLE_TINTS.length] }}
                >
                  {c.photo ? (
                    <img src={c.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-serif text-3xl italic text-ink/45">{c.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className="text-center text-[13px] font-medium text-muted">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{featured.length ? 'Featured designs' : 'Latest designs'}</h2>
          <Link to="/catalog" className="text-[13px] font-semibold text-pink hover:underline">View catalog</Link>
        </div>
        {loading && !products ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {latest.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Gallery strip */}
      {gallery && gallery.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold">From our portfolio</h2>
            <Link to="/gallery" className="text-[13px] font-semibold text-pink hover:underline">Full gallery</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {gallery.slice(0, 10).map((g) => (
              <Link key={g.id} to="/gallery" className="h-36 w-48 shrink-0 overflow-hidden rounded-xl border border-edge">
                <img src={g.photo} alt={g.caption} loading="lazy" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

