import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, RotateCcw, ShieldCheck, Sparkles, Truck, Wand2 } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Category, Product, UniversalComplimentaryItem } from '../lib/types';
import { DesktopProductCard } from '../components/DesktopProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { cx } from '../lib/utils';
import { useApp } from '../store/AppContext';
import { complimentaryForProduct, productWithResolvedComplimentary } from '../lib/complimentary';

type Band = { id: string; label: string; test: (v: number) => boolean };

const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];
const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'low', label: 'Price: low to high' },
  { id: 'high', label: 'Price: high to low' },
  { id: 'name', label: 'Name A-Z' },
];

function formatEtb(value: number): string {
  return `${Math.round(value).toLocaleString()} ETB`;
}

function buildPriceBands(products: Product[]): Band[] {
  const prices = products
    .filter((p) => !p.isAddon && p.price != null)
    .map((p) => p.price as number)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return [];
  const min = prices[0];
  const max = prices[prices.length - 1];
  if (min === max) return [{ id: 'actual-0', label: formatEtb(min), test: (v) => v === min }];
  const bandCount = Math.min(4, Math.max(2, prices.length));
  const step = (max - min) / bandCount;
  return Array.from({ length: bandCount }, (_, i) => {
    const lower = Math.floor(i === 0 ? min : min + step * i);
    const upper = Math.ceil(i === bandCount - 1 ? max : min + step * (i + 1));
    return {
      id: `actual-${i}`,
      label: `${formatEtb(lower)} - ${formatEtb(upper)}`,
      test: (v: number) => (i === bandCount - 1 ? v >= lower && v <= max : v >= lower && v < upper),
    };
  });
}

function productSearchText(product: Product, categories: Category[]): string {
  const category = categories.find((c) => c.id === product.categoryId)?.name || '';
  const variants = (product.variants || [])
    .flatMap((group) => [group.name, ...group.options.map((option) => option.label)])
    .join(' ');
  const pricing = product.price == null ? 'quote request quote' : `${product.price} ${formatEtb(product.price)} birr etb`;
  return [product.name, product.description, category, variants, product.pricingMode, product.featured ? 'featured' : '', pricing]
    .join(' ')
    .toLowerCase();
}

export function DesktopCatalog() {
  const navigate = useNavigate();
  const { addToCart, toast } = useApp();
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const { data: universalComplimentaryItems } = useData<UniversalComplimentaryItem[]>('/complimentary-items');
  const [params, setParams] = useSearchParams();

  const query = params.get('q') || '';
  const activeCategory = params.get('category') || '';
  const [sort, setSort] = useState('featured');
  const [bands, setBands] = useState<string[]>([]);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [pendingCategoryFilters, setPendingCategoryFilters] = useState<string[]>([]);
  const [appliedCategoryFilters, setAppliedCategoryFilters] = useState<string[]>([]);
  const [showMoreCats, setShowMoreCats] = useState(false);

  const priceBands = useMemo(() => buildPriceBands(products || []), [products]);
  const catById = useMemo(() => new Map((categories || []).map((cat) => [cat.id, cat])), [categories]);
  const minPrice = priceBands[0]?.label.split(' - ')[0] || 'Min';
  const maxPrice = priceBands[priceBands.length - 1]?.label.split(' - ').pop() || 'Max';

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id);
    else next.delete('category');
    setParams(next);
  };

  const clearAll = () => {
    setBands([]);
    setMin('');
    setMax('');
    setPendingCategoryFilters([]);
    setAppliedCategoryFilters([]);
    setCategory('');
  };

  const visible = useMemo(() => {
    let list = (products || []).filter((p) => !p.isAddon);
    if (activeCategory) list = list.filter((p) => p.categoryId === activeCategory);
    if (appliedCategoryFilters.length) list = list.filter((p) => appliedCategoryFilters.includes(p.categoryId));
    if (query.trim()) {
      const search = query.trim().toLowerCase();
      list = list.filter((p) => productSearchText(p, categories || []).includes(search));
    }
    if (bands.length) {
      const active = priceBands.filter((b) => bands.includes(b.id));
      list = list.filter((p) => p.price == null || active.some((b) => b.test(p.price as number)));
    }
    const mn = parseFloat(min);
    const mx = parseFloat(max);
    if (!Number.isNaN(mn)) list = list.filter((p) => p.price == null || (p.price as number) >= mn);
    if (!Number.isNaN(mx)) list = list.filter((p) => p.price == null || (p.price as number) <= mx);
    if (sort === 'featured') return [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
    if (sort === 'low') return [...list].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    if (sort === 'high') return [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, activeCategory, appliedCategoryFilters, query, bands, min, max, sort, categories, priceBands]);

  const chips: Pick<Category, 'id' | 'name' | 'photo'>[] = [{ id: '', name: 'All' }, ...(categories || [])];
  const pageTitle = activeCategory ? catById.get(activeCategory)?.name || 'Designs' : 'All';
  const sidebarCategories = showMoreCats ? (categories || []) : (categories || []).slice(0, 5);

  const quickAdd = (product: Product) => {
    if ((product.variants || []).length > 0) {
      navigate(`/product/${product.id}`);
      return;
    }
    const resolved = productWithResolvedComplimentary(product, universalComplimentaryItems || undefined);
    const result = addToCart({
      productId: product.id,
      name: product.name,
      photo: product.photos[0] || '',
      isAddon: product.isAddon,
      pricingMode: product.pricingMode,
      priceEach: product.pricingMode === 'exact' ? product.price : null,
      variantSelections: {},
      qty: 1,
      note: '',
      complimentaryItems: complimentaryForProduct(resolved, 1),
    });
    toast(result === 'updated' ? 'info' : 'success', result === 'updated' ? `${product.name} quantity updated.` : `${product.name} added to your cart.`);
  };

  return (
    <div className="mx-auto max-w-[1240px] px-10 py-9">
      <div className="mena-cat-scroll -mx-3 mb-7 flex items-start gap-[22px] overflow-x-auto px-3 pb-2 pt-1">
        {chips.map((category, index) => {
          const active = activeCategory === category.id;
          return (
            <button
              key={category.id || 'all'}
              type="button"
              onClick={() => setCategory(category.id)}
              className="mena-press flex w-[88px] shrink-0 flex-col items-center gap-2.5"
            >
              <span
                className={cx(
                  'flex h-[84px] w-[84px] items-center justify-center rounded-full border-[3px] p-[3px] transition',
                  active ? 'border-pink bg-bg' : 'border-transparent bg-transparent'
                )}
              >
                <span
                  className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full ring-1 ring-edge"
                  style={{ background: category.photo ? undefined : CIRCLE_TINTS[index % CIRCLE_TINTS.length] }}
                >
                  {category.photo ? (
                    <img src={category.photo} alt="" loading={index < 4 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-serif text-[26px] italic text-ink/45">{category.name.slice(0, 1)}</span>
                  )}
                </span>
              </span>
              <span className={cx('text-center text-[13px] leading-tight', active ? 'font-bold text-pink' : 'font-medium text-ink/75')}>
                {category.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-7 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[44px] font-semibold leading-none tracking-[0.01em]">{pageTitle}</h1>
          <p className="mt-2 text-sm text-muted">{visible.length} designs available</p>
        </div>
        <label className="flex items-center gap-2.5">
          <span className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-muted">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-full border border-edge bg-white px-4 py-2 text-[13.5px] font-bold text-ink outline-none focus:border-pink"
          >
            {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid h-[calc(100vh-272px)] min-h-[560px] grid-cols-[240px_minmax(0,1fr)] gap-9">
        <aside className="mena-d-scroll overflow-y-auto rounded-2xl border border-edge bg-white p-[22px] shadow-[0_1px_3px_rgba(28,26,25,0.05)]">
          <div className="mb-5 flex items-center justify-between border-b border-edge pb-4">
            <span className="text-[17px] font-extrabold">Filters</span>
            <button type="button" onClick={clearAll} className="mena-press text-[13px] font-bold text-pink hover:underline">
              Clear all
            </button>
          </div>

          <section className="border-b border-edge pb-5">
            <h2 className="mb-3 text-sm font-extrabold">Price Range</h2>
            <div className="space-y-2.5">
              {priceBands.length ? priceBands.map((band) => {
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
              }) : <p className="text-sm text-muted">No exact prices yet.</p>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder={minPrice} className="min-w-0 flex-1 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink" />
              <span className="font-bold text-muted">-</span>
              <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder={maxPrice} className="min-w-0 flex-1 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink" />
            </div>
          </section>

          <section className="border-b border-edge py-5">
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

          <div className="space-y-3 pt-5">
            <button type="button" onClick={() => setAppliedCategoryFilters(pendingCategoryFilters)} className="btn-primary w-full py-3">
              Apply Filters
            </button>
            <button type="button" onClick={clearAll} className="btn-outline w-full py-3">
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </aside>

        <div className="mena-d-scroll overflow-y-auto pr-3">
          {loading && !products ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : visible.length === 0 ? (
            <EmptyState>No designs found{query ? ` for "${query}"` : ''}.</EmptyState>
          ) : (
            <div className="grid grid-cols-3 gap-[26px]">
              {visible.map((product, index) => (
                <DesktopProductCard
                  key={product.id}
                  product={product}
                  category={catById.get(product.categoryId)}
                  index={index}
                  priority={index < 6}
                  onOpen={(p) => navigate(`/product/${p.id}`)}
                  onQuickAdd={quickAdd}
                />
              ))}
            </div>
          )}

          <div className="mt-12 grid grid-cols-4 gap-6 border-t border-edge pt-9">
            {[
              { title: 'Quality Materials', desc: 'Premium papers & finishes', icon: ShieldCheck },
              { title: 'Custom Design', desc: 'Tailored to your vision', icon: Wand2 },
              { title: 'Fast & Reliable', desc: '7-10 days delivery', icon: Truck },
              { title: 'Secure Ordering', desc: 'Confirm safely by chat', icon: Sparkles },
            ].map(({ title, desc, icon: Icon }) => (
              <div key={title} className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink/10 text-pink">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-extrabold">{title}</span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">{desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
