import { Link } from 'react-router-dom';
import { useData } from '../lib/useData';
import type { HomeSummary } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Spinner } from '../components/ui';

const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];

export function Home() {
  const { data: home, loading } = useData<HomeSummary>('/home');
  const content = home?.content;
  const categories = home?.categories || [];
  const latest = home?.products || [];
  const gallery = home?.gallery || [];
  const featured = latest.some((p) => p.featured);
  const heroTitle = content?.heroTitle || 'Wedding cards, crafted to order.';
  const heroSubtitle =
    content?.heroSubtitle ||
    'Invitations, save-the-dates and full stationery suites, designed and printed in Addis Ababa.';
  const heroCta = content?.heroCta || 'Browse the catalog';
  const heroImage = content?.heroImage || latest.find((p) => p.photos[0])?.photos[0] || '';

  if (loading && !home) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {content?.noticeText && (
        <div className="rounded-xl border border-pink/30 bg-pink/10 px-4 py-3 text-sm text-ink">{content.noticeText}</div>
      )}

      <section className="overflow-hidden rounded-lg bg-ink text-white">
        <div className="grid min-h-[360px] md:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Mena Inc. Wedding Stationery</div>
            <h1 className="mt-4 max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/75 sm:text-lg">{heroSubtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/catalog"
                className="inline-flex rounded-full bg-pink px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-pink-dim"
              >
                {heroCta}
              </Link>
              <Link
                to="/contact"
                className="inline-flex rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Contact the studio
              </Link>
            </div>
          </div>
          <div className="relative min-h-[260px] bg-surface2">
            {heroImage ? (
              <img src={heroImage} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center bg-[#f4f0ec] p-8 text-center text-ink">
                <div className="w-full max-w-xs rounded-md border border-edge bg-white px-8 py-10 shadow-sm">
                  <div className="font-script text-5xl leading-none text-pink">Mena Inc.</div>
                  <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.28em] text-ink/45">Wedding Cards</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold">Shop by category</h2>
            <Link to="/catalog" className="text-[13px] font-semibold text-pink hover:underline">View all</Link>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {categories.map((c, i) => (
              <Link key={c.id} to={`/catalog?category=${c.id}`} className="flex w-[92px] shrink-0 flex-col items-center gap-2.5">
                <span
                  className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full"
                  style={{ background: c.photo ? undefined : CIRCLE_TINTS[i % CIRCLE_TINTS.length] }}
                >
                  {c.photo ? (
                    <img src={c.photo} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
          <h2 className="font-serif text-2xl font-semibold">{featured ? 'Featured designs' : 'Latest designs'}</h2>
          <Link to="/catalog" className="text-[13px] font-semibold text-pink hover:underline">View catalog</Link>
        </div>
        {loading && !home ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          latest.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
              {latest.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
            </div>
          ) : (
            <EmptyState>No designs have been added yet. Add products in the admin panel to fill this section.</EmptyState>
          )
        )}
      </section>

      {/* Gallery strip */}
      {gallery.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold">From our portfolio</h2>
            <Link to="/gallery" className="text-[13px] font-semibold text-pink hover:underline">Full gallery</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {gallery.map((g) => (
              <Link key={g.id} to="/gallery" className="h-36 w-48 shrink-0 overflow-hidden rounded-xl border border-edge">
                <img src={g.photo} alt={g.caption} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

