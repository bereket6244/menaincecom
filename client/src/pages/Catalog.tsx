import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Category, Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { cx } from '../lib/utils';

type Band = { id: string; label: string; test: (v: number) => boolean };

const PRICE_BANDS: Band[] = [
  { id: 'b1', label: 'Under 1,000 ETB', test: (v) => v < 1000 },
  { id: 'b2', label: '1,000 – 2,000 ETB', test: (v) => v >= 1000 && v < 2000 },
  { id: 'b3', label: '2,000 – 3,500 ETB', test: (v) => v >= 2000 && v < 3500 },
  { id: 'b4', label: '3,500 ETB & up', test: (v) => v >= 3500 },
];

const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];

const SORTS: { id: string; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'new', label: 'Newest' },
  { id: 'low', label: 'Price: Low to High' },
  { id: 'high', label: 'Price: High to Low' },
];

export function Catalog() {
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const activeCategory = params.get('category') || '';

  const [sort, setSort] = useState('featured');
  const [bands, setBands] = useState<string[]>([]);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [priceOpen, setPriceOpen] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id);
    else next.delete('category');
    setParams(next);
  };

  const toggleBand = (id: string) =>
    setBands((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));

  const clearAll = () => {
    setBands([]);
    setMin('');
    setMax('');
    setCategory('');
  };

  const visible = useMemo(() => {
    let list = (products || []).filter((p) => !p.isAddon);
    if (activeCategory) list = list.filter((p) => p.categoryId === activeCategory);
    if (query.trim()) {
      const s = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
    }
    // Quote-priced designs have no listed price, so price filters keep them
    // visible instead of silently hiding them.
    if (bands.length) {
      const active = PRICE_BANDS.filter((b) => bands.includes(b.id));
      list = list.filter((p) => p.price == null || active.some((b) => b.test(p.price as number)));
    }
    const mn = parseFloat(min);
    const mx = parseFloat(max);
    if (!isNaN(mn)) list = list.filter((p) => p.price == null || (p.price as number) >= mn);
    if (!isNaN(mx)) list = list.filter((p) => p.price == null || (p.price as number) <= mx);
    if (sort === 'featured')
      list = [...list].sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    if (sort === 'low') list = [...list].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    if (sort === 'high') list = [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (sort === 'new')
      list = [...list].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    return list;
  }, [products, activeCategory, query, bands, min, max, sort]);

  const chips: { id: string; name: string; photo?: string }[] = [
    { id: '', name: 'All' },
    ...(categories || []).map((c) => ({ id: c.id, name: c.name, photo: c.photo })),
  ];

  return (
    <div className="space-y-6">
      {/* Title + sort */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Wedding Cards</h1>
          <span className="text-sm text-muted">{visible.length} designs</span>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => setMobileFilters((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm font-semibold lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {mobileFilters ? 'Hide filters' : 'Filters'}
          </button>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Sort by</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="min-w-[180px] rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Category circles */}
      <div className="flex gap-6 overflow-x-auto pb-2 pt-2">
        {chips.map((c, i) => {
          const active = activeCategory === c.id;
          return (
            <button
              key={c.id || 'all'}
              onClick={() => setCategory(c.id)}
              className="flex w-[92px] shrink-0 flex-col items-center gap-2.5"
            >
              <span
                className={cx(
                  'flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full',
                  active && 'ring-2 ring-pink ring-offset-2 ring-offset-bg'
                )}
                style={{ background: c.photo ? undefined : CIRCLE_TINTS[i % CIRCLE_TINTS.length] }}
              >
                {c.photo ? (
                  <img src={c.photo} alt={c.name} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-serif text-3xl italic text-ink/45">{c.name.slice(0, 1)}</span>
                )}
              </span>
              <span className={cx('text-center text-[13px]', active ? 'font-bold text-ink' : 'font-medium text-muted')}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sidebar + grid */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className={cx('shrink-0 lg:block lg:w-56', mobileFilters ? 'block' : 'hidden')}>
          <div className="rounded-2xl border border-edge bg-surface p-5 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="border-b border-edge pb-5">
              <button
                onClick={() => setPriceOpen((v) => !v)}
                className="mb-3 flex w-full items-center justify-between text-[15px] font-bold"
              >
                Price Range
                <ChevronUp className={cx('h-4 w-4 text-muted transition-transform', !priceOpen && 'rotate-180')} />
              </button>
              {priceOpen && (
                <>
                  <div className="flex flex-col gap-3">
                    {PRICE_BANDS.map((b) => (
                      <label key={b.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink/80">
                        <input
                          type="checkbox"
                          checked={bands.includes(b.id)}
                          onChange={() => toggleBand(b.id)}
                          className="h-4 w-4 accent-pink"
                        />
                        {b.label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      value={min}
                      onChange={(e) => setMin(e.target.value)}
                      inputMode="numeric"
                      placeholder="Min"
                      className="w-full rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink"
                    />
                    <span className="text-muted">–</span>
                    <input
                      value={max}
                      onChange={(e) => setMax(e.target.value)}
                      inputMode="numeric"
                      placeholder="Max"
                      className="w-full rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink"
                    />
                  </div>
                </>
              )}
            </div>
            <button onClick={clearAll} className="mt-5 text-[13px] font-semibold text-pink hover:underline">
              Clear all filters
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading && !products ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : visible.length === 0 ? (
            <EmptyState>No designs found{query ? ` for “${query}”` : ''}.</EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 lg:grid-cols-3">
              {visible.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 6} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
