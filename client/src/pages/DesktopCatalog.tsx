import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useData } from '../lib/useData';
import type { Category, Product, UniversalComplimentaryItem } from '../lib/types';
import { DesktopProductCard } from '../components/DesktopProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { cartPriceEach, cx } from '../lib/utils';
import { useApp } from '../store/AppContext';
import { complimentaryForProduct, productWithResolvedComplimentary } from '../lib/complimentary';
import { buildPriceBands, formatEtb, priceBounds } from '../lib/priceBands';
import {
  buildVariantFacets, matchesVariantFilters, toggleVariantOption, type Facet, type VariantFilters,
} from '../lib/variantFacets';
import { useResultAnimation } from '../lib/useResultAnimation';
import { firstProductCategory, productCategoryIds, productCategoryNames } from '../lib/productCategories';

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'low', label: 'Price: low to high' },
  { id: 'high', label: 'Price: high to low' },
  { id: 'name', label: 'Name A-Z' },
];
const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#eeeeec', '#f6efdd', '#e9f0ec', '#e9e6ef'];

type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

function productSearchText(product: Product, categories: Category[]): string {
  const category = productCategoryNames(product, categories).join(' ');
  const variants = (product.variants || [])
    .flatMap((group) => [group.name, ...group.options.map((option) => option.label)])
    .join(' ');
  const pricing = product.price == null ? 'quote request quote' : `${product.price} ${formatEtb(product.price)} birr etb`;
  return [product.name, product.description, category, variants, product.pricingMode, product.featured ? 'featured' : '', pricing]
    .join(' ')
    .toLowerCase();
}

function FilterSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-edge first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="mena-press flex w-full items-center justify-between py-4 text-left text-[14px] font-extrabold text-ink"
      >
        {title}
        <ChevronDown className={cx('h-4 w-4 text-ink/60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </section>
  );
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
  const [variantFilters, setVariantFilters] = useState<VariantFilters>({});
  const [sortOpen, setSortOpen] = useState(false);
  const [openFilters, setOpenFilters] = useState<Record<string, boolean>>({
    price: true,
    color: true,
    event: true,
    style: true,
  });

  const priceBands = useMemo(() => buildPriceBands(products || []), [products]);
  const bounds = useMemo(() => priceBounds(products || []), [products]);
  const catById = useMemo(() => new Map((categories || []).map((cat) => [cat.id, cat])), [categories]);
  const minPrice = bounds.min != null ? formatEtb(bounds.min) : 'Min';
  const maxPrice = bounds.max != null ? formatEtb(bounds.max) : 'Max';
  const gridRef = useResultAnimation<HTMLDivElement>(
    JSON.stringify([activeCategory, bands, min, max, variantFilters, sort, query])
  );

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
    setVariantFilters({});
    setCategory('');
  };

  const toggleFilterSection = (key: string) => {
    setOpenFilters((current) => ({ ...current, [key]: current[key] === false }));
  };

  const scoped = useMemo(() => {
    let list = (products || []).filter((p) => !p.isAddon);
    if (activeCategory) list = list.filter((p) => productCategoryIds(p).includes(activeCategory));
    if (query.trim()) {
      const search = query.trim().toLowerCase();
      list = list.filter((p) => productSearchText(p, categories || []).includes(search));
    }
    if (bands.length) {
      const active = priceBands.filter((b) => bands.includes(b.id));
      list = list.filter((p) => p.price != null && active.some((b) => b.test(p.price as number)));
    }
    const mn = parseFloat(min);
    const mx = parseFloat(max);
    if (!Number.isNaN(mn)) list = list.filter((p) => p.price != null && (p.price as number) >= mn);
    if (!Number.isNaN(mx)) list = list.filter((p) => p.price != null && (p.price as number) <= mx);
    return list;
  }, [products, activeCategory, query, bands, min, max, categories, priceBands]);

  const facets = useMemo(() => buildVariantFacets(scoped, variantFilters), [scoped, variantFilters]);

  const visible = useMemo(() => {
    const list = scoped.filter((p) => matchesVariantFilters(p, variantFilters));
    if (sort === 'featured') return [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
    if (sort === 'low') return [...list].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    if (sort === 'high') return [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [scoped, variantFilters, sort]);

  const chips: Pick<Category, 'id' | 'name' | 'photo'>[] = [{ id: '', name: 'All' }, ...(categories || [])];
  const pageTitle = activeCategory ? catById.get(activeCategory)?.name || 'Designs' : 'All Designs';
  const sortLabel = SORTS.find((item) => item.id === sort)?.label || 'Featured';

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const next: FilterChip[] = [];
    for (const bandId of bands) {
      const band = priceBands.find((item) => item.id === bandId);
      if (!band) continue;
      next.push({
        id: `price:${bandId}`,
        label: band.label,
        onRemove: () => setBands((current) => current.filter((id) => id !== bandId)),
      });
    }
    if (min.trim() || max.trim()) {
      next.push({
        id: 'price:range',
        label: `${min.trim() || minPrice} - ${max.trim() || maxPrice}`,
        onRemove: () => {
          setMin('');
          setMax('');
        },
      });
    }
    for (const [facetKey, values] of Object.entries(variantFilters)) {
      const facet = facets.find((item) => item.key === facetKey);
      for (const value of values) {
        const option = facet?.options.find((item) => item.value === value);
        next.push({
          id: `facet:${facetKey}:${value}`,
          label: option?.label || value,
          onRemove: () => setVariantFilters((current) => toggleVariantOption(current, facetKey, value)),
        });
      }
    }
    return next;
  }, [bands, facets, max, maxPrice, min, minPrice, priceBands, variantFilters]);

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
      priceEach: cartPriceEach(product),
      variantSelections: {},
      qty: 1,
      note: '',
      complimentaryItems: complimentaryForProduct(resolved, 1),
    });
    toast(result === 'updated' ? 'info' : 'success', result === 'updated' ? `${product.name} quantity updated.` : `${product.name} added to your cart.`);
  };

  const renderFacet = (facet: Facet) => {
    const selected = variantFilters[facet.key] || [];
    return (
      <FilterSection
        key={facet.key}
        title={facet.name}
        open={openFilters[facet.key] !== false}
        onToggle={() => toggleFilterSection(facet.key)}
      >
        <div className={cx(facet.isColor ? 'flex flex-wrap gap-2.5' : 'space-y-2.5')}>
          {facet.options.map((option) => {
            const checked = selected.includes(option.value);
            const toggle = () => setVariantFilters((current) => toggleVariantOption(current, facet.key, option.value));

            if (facet.isColor) {
              return option.swatch ? (
                <button
                  key={option.value}
                  type="button"
                  onClick={toggle}
                  title={option.label}
                  aria-pressed={checked}
                  className={cx(
                    'mena-press flex h-8 w-8 items-center justify-center rounded-full transition',
                    checked ? 'ring-2 ring-pink ring-offset-2' : 'ring-1 ring-black/15'
                  )}
                  style={{ background: option.swatch }}
                >
                  {checked && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
                  <span className="sr-only">{option.label}</span>
                </button>
              ) : (
                <button
                  key={option.value}
                  type="button"
                  onClick={toggle}
                  aria-pressed={checked}
                  className={cx(
                    'mena-press h-8 rounded-full border px-3 text-[13px] transition',
                    checked ? 'border-pink bg-pink/10 font-bold text-pink' : 'border-edge bg-white text-ink/75 hover:border-pink/40'
                  )}
                >
                  {option.label}
                </button>
              );
            }

            return (
              <label key={option.value} className="mena-press flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink/75">
                <input type="checkbox" checked={checked} onChange={toggle} className="sr-only" />
                <span className={cx('flex h-5 w-5 items-center justify-center rounded-[5px] border', checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white')}>
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      </FilterSection>
    );
  };

  return (
    <div className="bg-bg">
      <nav className="border-b border-edge bg-white shadow-[0_2px_10px_rgba(28,26,25,0.035)]">
        <div className="mena-cat-scroll mx-auto flex max-w-[1560px] items-start gap-7 overflow-x-auto px-10 pb-4 pt-5 2xl:px-12">
          {chips.map((category, index) => {
            const active = activeCategory === category.id;
            return (
              <button
                key={category.id || 'all'}
                type="button"
                onClick={() => setCategory(category.id)}
                className="mena-press flex w-[108px] shrink-0 flex-col items-center gap-2"
              >
                <span
                  className={cx(
                    'flex h-[74px] w-[74px] items-center justify-center rounded-full border-[3px] p-[3px] transition',
                    active ? 'border-pink bg-bg shadow-[0_8px_22px_rgba(238,49,123,0.16)]' : 'border-transparent bg-transparent'
                  )}
                >
                  <span
                    className="flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full ring-1 ring-edge"
                    style={{ background: category.photo ? undefined : CIRCLE_TINTS[index % CIRCLE_TINTS.length] }}
                  >
                    {category.photo ? (
                      <img src={category.photo} alt="" loading={index < 5 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-serif text-[24px] italic text-ink/45">{category.name.slice(0, 1)}</span>
                    )}
                  </span>
                </span>
                <span className={cx('text-center text-[13px] font-semibold leading-tight', active ? 'text-pink' : 'text-ink/75')}>
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-[1560px] px-10 pb-10 pt-7 2xl:px-12">
        <div className="mb-5 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <h1 className="font-serif text-[36px] font-semibold leading-none tracking-[0.01em]">{pageTitle}</h1>
              <p className="text-sm text-muted">{visible.length} designs available</p>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={chip.onRemove}
                    className="mena-press flex h-9 items-center gap-2 rounded-full border border-edge bg-white px-4 text-[13px] font-medium text-ink/75 hover:border-pink/40 hover:text-pink"
                  >
                    {chip.label}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
                <button type="button" onClick={clearAll} className="mena-press ml-1 text-[13px] font-extrabold text-pink hover:underline">
                  Clear all
                </button>
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSortOpen((value) => !value)}
              className="mena-press flex h-11 items-center gap-2 rounded-full border border-edge bg-white px-5 text-[13.5px] font-extrabold text-ink shadow-[0_2px_8px_rgba(28,26,25,0.06)]"
            >
              <ArrowUpDown className="h-4 w-4" />
              Sort: {sortLabel}
              <ChevronDown className={cx('h-4 w-4 transition-transform', sortOpen && 'rotate-180')} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] z-20 w-48 rounded-xl border border-edge bg-white p-1.5 shadow-[0_14px_36px_rgba(28,26,25,0.14)]">
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
                        'mena-press flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-bold',
                        active ? 'bg-pink/10 text-pink' : 'text-ink hover:bg-surface2'
                      )}
                    >
                      {item.label}
                      {active && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[234px_minmax(0,1fr)] gap-7">
          <aside className="mena-d-scroll sticky top-[145px] max-h-[calc(100vh-165px)] self-start overflow-y-auto rounded-xl border border-edge bg-white p-4 shadow-[0_1px_5px_rgba(28,26,25,0.045)]">
            <div className="mb-1 flex items-center justify-between pb-2">
              <span className="text-[17px] font-extrabold">Filters</span>
              <button type="button" onClick={clearAll} className="mena-press text-[13px] font-bold text-pink hover:underline">
                Reset
              </button>
            </div>

            <FilterSection title="Price (ETB)" open={openFilters.price !== false} onToggle={() => toggleFilterSection('price')}>
              <div className="space-y-2.5">
                {priceBands.length ? priceBands.map((band) => {
                  const checked = bands.includes(band.id);
                  return (
                    <label key={band.id} className="mena-press flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink/75">
                      <input type="checkbox" checked={checked} onChange={() => setBands((current) => checked ? current.filter((id) => id !== band.id) : [...current, band.id])} className="sr-only" />
                      <span className={cx('flex h-5 w-5 items-center justify-center rounded-[5px] border', checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white')}>
                        {checked && <Check className="h-3 w-3 text-white" />}
                      </span>
                      {band.label}
                    </label>
                  );
                }) : <p className="text-sm text-muted">No exact prices yet.</p>}
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder={minPrice} className="min-w-0 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink" />
                <span className="font-bold text-muted">-</span>
                <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder={maxPrice} className="min-w-0 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] outline-none focus:border-pink" />
              </div>
            </FilterSection>

            {facets.map(renderFacet)}

            <button type="button" onClick={clearAll} className="btn-outline mt-4 h-10 w-full py-0 text-[13px]">
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </aside>

          <div>
            {loading && !products ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : visible.length === 0 ? (
              <EmptyState>No designs found{query ? ` for "${query}"` : ''}.</EmptyState>
            ) : (
              <div ref={gridRef} className="grid grid-cols-3 gap-5 min-[1320px]:grid-cols-4">
                {visible.map((product, index) => (
                  <DesktopProductCard
                    key={product.id}
                    product={product}
                    category={firstProductCategory(product, [...catById.values()])}
                    index={index}
                    priority={index < 8}
                    onOpen={(p) => navigate(`/product/${p.id}`)}
                    onQuickAdd={quickAdd}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
