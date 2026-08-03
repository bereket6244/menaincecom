import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Check, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Category, Product } from '../lib/types';
import { MobileProductCard } from '../components/MobileProductCard';
import { EmptyState, Modal, Spinner } from '../components/ui';
import { cx } from '../lib/utils';

const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#e9f0ec'];
const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'newest', label: 'Newest' },
  { id: 'low', label: 'Price: low to high' },
  { id: 'high', label: 'Price: high to low' },
  { id: 'name', label: 'Name A-Z' },
];
type Band = { id: string; label: string; test: (value: number) => boolean };

function formatEtb(value: number): string {
  return `${Math.round(value).toLocaleString()} ETB`;
}

function buildPriceBands(products: Product[]): Band[] {
  const prices = products
    .filter((product) => !product.isAddon && product.price != null)
    .map((product) => product.price as number)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return [];
  const min = prices[0];
  const max = prices[prices.length - 1];
  if (min === max) return [{ id: 'actual-0', label: formatEtb(min), test: (value) => value === min }];
  const bandCount = Math.min(4, Math.max(2, prices.length));
  const step = (max - min) / bandCount;
  return Array.from({ length: bandCount }, (_, index) => {
    const lower = Math.floor(index === 0 ? min : min + step * index);
    const upper = Math.ceil(index === bandCount - 1 ? max : min + step * (index + 1));
    return {
      id: `actual-${index}`,
      label: `${formatEtb(lower)} - ${formatEtb(upper)}`,
      test: (value: number) => (index === bandCount - 1 ? value >= lower && value <= max : value >= lower && value < upper),
    };
  });
}

function productSearchText(product: Product, categories: Category[]): string {
  const category = categories.find((c) => c.id === product.categoryId)?.name || '';
  const variants = (product.variants || [])
    .flatMap((group) => [group.name, ...group.options.map((option) => option.label)])
    .join(' ');
  const pricing =
    product.price == null
      ? 'quote request quote quoted price'
      : `${product.price} ${formatEtb(product.price)} birr etb`;
  return [
    product.name,
    product.description,
    category,
    variants,
    product.pricingMode,
    product.isAddon ? 'add-on addon extra' : 'wedding card invitation stationery',
    product.featured ? 'featured' : '',
    pricing,
  ].join(' ').toLowerCase();
}

export function MobileCatalog() {
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const [params, setParams] = useSearchParams();
  const [bands, setBands] = useState<string[]>([]);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [pendingCategoryFilters, setPendingCategoryFilters] = useState<string[]>([]);
  const [appliedCategoryFilters, setAppliedCategoryFilters] = useState<string[]>([]);
  const [showMoreCats, setShowMoreCats] = useState(false);
  const [sort, setSort] = useState('featured');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const query = params.get('q') || '';
  const activeCategory = params.get('category') || '';

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id);
    else next.delete('category');
    setParams(next);
  };

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category.name])),
    [categories]
  );
  const priceBands = useMemo(() => buildPriceBands(products || []), [products]);
  const minPrice = priceBands[0]?.label.split(' - ')[0] || 'Min';
  const maxPrice = priceBands[priceBands.length - 1]?.label.split(' - ').pop() || 'Max';
  const sidebarCategories = showMoreCats ? (categories || []) : (categories || []).slice(0, 5);
  const activeFilterCount = bands.length + appliedCategoryFilters.length + (min ? 1 : 0) + (max ? 1 : 0);

  const clearAll = () => {
    setBands([]);
    setMin('');
    setMax('');
    setPendingCategoryFilters([]);
    setAppliedCategoryFilters([]);
    setCategory('');
  };

  const visible = useMemo(() => {
    let list = (products || []).filter((product) => !product.isAddon);
    if (activeCategory) list = list.filter((product) => product.categoryId === activeCategory);
    if (appliedCategoryFilters.length) list = list.filter((product) => appliedCategoryFilters.includes(product.categoryId));
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      list = list.filter((product) => productSearchText(product, categories || []).includes(needle));
    }
    if (bands.length) {
      const active = priceBands.filter((band) => bands.includes(band.id));
      list = list.filter((product) => product.price == null || active.some((band) => band.test(product.price as number)));
    }
    const mn = parseFloat(min);
    const mx = parseFloat(max);
    if (!Number.isNaN(mn)) list = list.filter((product) => product.price == null || (product.price as number) >= mn);
    if (!Number.isNaN(mx)) list = list.filter((product) => product.price == null || (product.price as number) <= mx);
    if (sort === 'low') return [...list].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    if (sort === 'high') return [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') return [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return [...list].sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured)
        || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [activeCategory, appliedCategoryFilters, bands, categories, max, min, priceBands, products, query, sort]);

  const chips: { id: string; name: string; photo?: string }[] = [
    { id: '', name: 'All' },
    ...(categories || []).map((category) => ({ id: category.id, name: category.name, photo: category.photo })),
  ];
  const sortLabel = SORTS.find((item) => item.id === sort)?.label || 'Featured';

  return (
    <div className="pb-8">
      <div className="mena-scroll flex gap-[18px] overflow-x-auto px-4 pb-2 pt-4">
        {chips.map((chip, index) => {
          const active = activeCategory === chip.id;
          return (
            <button
              key={chip.id || 'all'}
              type="button"
              onClick={() => setCategory(chip.id)}
              className="mena-press flex w-[66px] shrink-0 flex-col items-center gap-2 bg-transparent"
            >
              <span
                className={cx(
                  'flex h-16 w-16 items-center justify-center overflow-hidden rounded-full font-serif text-[26px] italic text-ink/50',
                  active && 'ring-2 ring-pink ring-offset-[5px] ring-offset-bg'
                )}
                style={{ background: chip.photo ? undefined : CIRCLE_TINTS[index % CIRCLE_TINTS.length] }}
              >
                {chip.photo ? (
                  <img src={chip.photo} alt={chip.name} loading={index < 4 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover" />
                ) : (
                  chip.name === 'All' ? 'A' : chip.name.slice(0, 1)
                )}
              </span>
              <span className={cx('text-center text-[11.5px] leading-tight', active ? 'font-extrabold text-ink' : 'font-medium text-muted')}>
                {chip.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between px-4 pb-2 pt-2">
        <h1 className="m-0 font-serif text-[30px] font-semibold tracking-[0.01em]">
          {activeCategory ? categoryById.get(activeCategory) || 'Wedding Cards' : 'All designs'}
        </h1>
        <span className="text-[12.5px] text-muted">{visible.length} designs</span>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-2 pt-1">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className={cx(
            'mena-press flex h-11 items-center justify-center gap-2 rounded-full border text-[13px] font-extrabold',
            activeFilterCount ? 'border-pink bg-pink text-white' : 'border-edge bg-white text-ink'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="mena-press flex h-11 items-center justify-center gap-2 rounded-full border border-edge bg-white px-3 text-[13px] font-extrabold text-ink"
        >
          <ArrowUpDown className="h-4 w-4" />
          <span className="min-w-0 truncate">{sortLabel}</span>
        </button>
      </div>

      {loading && !products ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState>No designs found{query ? ` for "${query}"` : ''}.</EmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 px-4 pt-3">
          {visible.map((product, index) => (
            <MobileProductCard
              key={product.id}
              product={product}
              categoryName={categoryById.get(product.categoryId) || 'Wedding Cards'}
              priority={index < 4}
            />
          ))}
        </div>
      )}

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter designs">
        <div className="space-y-5">
          <section className="border-b border-edge pb-5">
            <h2 className="mb-3 text-sm font-extrabold">Price Range</h2>
            {priceBands.length ? (
              <div className="space-y-2.5">
                {priceBands.map((band) => {
                  const checked = bands.includes(band.id);
                  return (
                    <label key={band.id} className="mena-press flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink/80">
                      <input type="checkbox" checked={checked} onChange={() => setBands((current) => checked ? current.filter((id) => id !== band.id) : [...current, band.id])} className="sr-only" />
                      <span className={cx('flex h-5 w-5 items-center justify-center rounded-[5px] border', checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white')}>
                        {checked && <Check className="h-3 w-3 text-white" />}
                      </span>
                      {band.label}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">No exact prices yet.</p>
            )}
            <div className="mt-4 flex items-center gap-2">
              <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder={minPrice} className="min-w-0 flex-1 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink" />
              <span className="font-bold text-muted">-</span>
              <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder={maxPrice} className="min-w-0 flex-1 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-extrabold">Category</h2>
            <div className="space-y-2.5">
              {sidebarCategories.map((category) => {
                const checked = pendingCategoryFilters.includes(category.id);
                return (
                  <label key={category.id} className="mena-press flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setPendingCategoryFilters((current) => checked ? current.filter((id) => id !== category.id) : [...current, category.id])}
                      className="sr-only"
                    />
                    <span className={cx('flex h-5 w-5 items-center justify-center rounded-[5px] border', checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white')}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  </label>
                );
              })}
            </div>
            {(categories || []).length > 5 && (
              <button type="button" onClick={() => setShowMoreCats((value) => !value)} className="mena-press mt-3 flex items-center gap-1 text-[13px] font-bold text-pink">
                {showMoreCats ? 'Show less' : 'Show more'}
                <ChevronDown className={cx('h-4 w-4 transition-transform', showMoreCats && 'rotate-180')} />
              </button>
            )}
          </section>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={clearAll} className="btn-outline h-12 px-3">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setAppliedCategoryFilters(pendingCategoryFilters);
              setFilterOpen(false);
            }}
            className="btn-primary h-12 px-3"
          >
            Apply
          </button>
        </div>
      </Modal>

      <Modal open={sortOpen} onClose={() => setSortOpen(false)} title="Sort designs">
        <div className="space-y-2.5">
          {SORTS.map((item) => {
            const active = sort === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSort(item.id);
                  setSortOpen(false);
                }}
                className={cx(
                  'mena-press flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm font-extrabold',
                  active ? 'border-pink bg-pink/5 text-pink' : 'border-edge bg-white text-ink'
                )}
              >
                {item.label}
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
