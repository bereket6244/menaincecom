import { Link } from 'react-router-dom';
import { ArrowRight, Images } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Category, GalleryItem, HomepageContent, Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { Spinner, SysLabel } from '../components/ui';

export function Home() {
  const { data: content } = useData<HomepageContent>('/content/homepage');
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const { data: gallery } = useData<GalleryItem[]>('/gallery');

  const featured = (products || []).filter((p) => p.featured && !p.isAddon).slice(0, 8);
  const latest = featured.length ? featured : (products || []).filter((p) => !p.isAddon).slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Compact hero */}
      <section className="overflow-hidden rounded-lg border border-edge bg-surface">
        <div className="grid md:grid-cols-2">
          <div className="flex flex-col justify-center gap-3 p-5 sm:p-8">
            <SysLabel>Mena INK Trading PLC · Addis Ababa</SysLabel>
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
              {content?.heroTitle || 'Wedding cards, crafted to order.'}
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              {content?.heroSubtitle ||
                'Invitations, save-the-dates and full stationery suites — designed and printed in Ethiopia.'}
            </p>
            <div className="mt-1 flex gap-2">
              <Link
                to="/catalog"
                className="inline-flex items-center gap-1.5 rounded bg-pink px-4 py-2 text-xs font-bold text-white hover:bg-pink-dim"
              >
                {content?.heroCta || 'Browse the catalog'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/gallery"
                className="inline-flex items-center gap-1.5 rounded border border-edge bg-surface2 px-4 py-2 text-xs font-semibold text-ink hover:border-pink/50"
              >
                <Images className="h-3.5 w-3.5" />
                Past work
              </Link>
            </div>
          </div>
          <div className="hidden aspect-[3/2] bg-surface2 md:block">
            {content?.heroImage ? (
              <img src={content.heroImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-6xl font-black tracking-tighter text-edge">MENA INC.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {content?.noticeText && (
        <div className="rounded border border-pink/30 bg-pink/10 px-3 py-2 text-xs text-ink">{content.noticeText}</div>
      )}

      {/* Categories */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Shop by category</h2>
          <Link to="/catalog" className="text-[11px] font-medium text-pink hover:underline">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(categories || []).map((c) => (
            <Link
              key={c.id}
              to={`/catalog?category=${c.id}`}
              className="group overflow-hidden rounded-md border border-edge bg-surface transition-colors hover:border-pink/50"
            >
              <div className="aspect-[5/3] bg-surface2">
                {c.photo && <img src={c.photo} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="p-2 text-xs font-semibold">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">{featured.length ? 'Featured designs' : 'Latest designs'}</h2>
          <Link to="/catalog" className="text-[11px] font-medium text-pink hover:underline">
            View catalog
          </Link>
        </div>
        {loading && !products ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {latest.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Gallery strip */}
      {gallery && gallery.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">From our portfolio</h2>
            <Link to="/gallery" className="text-[11px] font-medium text-pink hover:underline">
              Full gallery
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {gallery.slice(0, 10).map((g) => (
              <Link key={g.id} to="/gallery" className="h-32 w-44 shrink-0 overflow-hidden rounded-md border border-edge">
                <img src={g.photo} alt={g.caption} loading="lazy" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
