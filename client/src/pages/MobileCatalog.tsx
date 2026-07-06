import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../lib/useData';
import type { Category, Product } from '../lib/types';
import { MobileProductCard } from '../components/MobileProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { cx } from '../lib/utils';

const CIRCLE_TINTS = ['#f3e7ea', '#efe9df', '#e7ecef', '#efe3d6', '#e9f0ec'];
type AttributeFilter = { id: string; group: string; label: string; count: number };

function formatEtb(value: number): string {
  return `${Math.round(value).toLocaleString()} ETB`;
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

function buildAttributeFilters(products: Product[]): AttributeFilter[] {
  const counts = new Map<string, AttributeFilter>();
  for (const product of products.filter((item) => !item.isAddon)) {
    for (const group of product.variants || []) {
      for (const option of group.options || []) {
        const id = `${group.name}::${option.label}`;
        const existing = counts.get(id);
        counts.set(id, {
          id,
          group: group.name,
          label: option.label,
          count: (existing?.count || 0) + 1,
        });
      }
    }
  }
  return [...counts.values()].sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

export function MobileCatalog() {
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const [params, setParams] = useSearchParams();
  const [attributes, setAttributes] = useState<string[]>([]);
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
  const attributeFilters = useMemo(() => buildAttributeFilters(products || []), [products]);
  const toggleAttribute = (id: string) =>
    setAttributes((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const visible = useMemo(() => {
    let list = (products || []).filter((product) => !product.isAddon);
    if (activeCategory) list = list.filter((product) => product.categoryId === activeCategory);
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      list = list.filter((product) => productSearchText(product, categories || []).includes(needle));
    }
    if (attributes.length) {
      list = list.filter((product) => {
        const productAttributes = new Set(
          (product.variants || []).flatMap((group) => (group.options || []).map((option) => `${group.name}::${option.label}`))
        );
        return attributes.every((id) => productAttributes.has(id));
      });
    }
    return [...list].sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured)
        || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [activeCategory, attributes, categories, products, query]);

  const chips: { id: string; name: string; photo?: string }[] = [
    { id: '', name: 'All' },
    ...(categories || []).map((category) => ({ id: category.id, name: category.name, photo: category.photo })),
  ];

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

      {attributeFilters.length > 0 && (
        <div className="mena-scroll flex gap-2 overflow-x-auto px-4 pb-2 pt-1">
          {attributeFilters.map((item) => {
            const active = attributes.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleAttribute(item.id)}
                className={cx(
                  'mena-press shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-extrabold',
                  active ? 'border-pink bg-pink text-white' : 'border-edge bg-white text-ink/70'
                )}
              >
                {item.group}: {item.label}
              </button>
            );
          })}
          {attributes.length > 0 && (
            <button
              type="button"
              onClick={() => setAttributes([])}
              className="mena-press shrink-0 rounded-full border border-edge bg-surface px-3 py-1.5 text-[12px] font-extrabold text-pink"
            >
              Clear
            </button>
          )}
        </div>
      )}

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
    </div>
  );
}
