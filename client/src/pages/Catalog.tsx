import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Category, Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Spinner } from '../components/ui';
import { cx } from '../lib/utils';

export function Catalog() {
  const { data: categories } = useData<Category[]>('/categories');
  const { data: products, loading } = useData<Product[]>('/products');
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const activeCategory = params.get('category') || '';

  const visible = useMemo(() => {
    let list = (products || []).filter((p) => !p.isAddon);
    if (activeCategory) list = list.filter((p) => p.categoryId === activeCategory);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-base font-bold">Catalog</h1>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search designs…"
            className="field pl-8"
          />
        </div>
      </div>

      {/* Category tabs — fully dynamic from admin */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setParams({})}
          className={cx(
            'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            !activeCategory ? 'border-pink bg-pink text-white' : 'border-edge bg-surface text-muted hover:text-ink'
          )}
        >
          All
        </button>
        {(categories || []).map((c) => (
          <button
            key={c.id}
            onClick={() => setParams({ category: c.id })}
            className={cx(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeCategory === c.id ? 'border-pink bg-pink text-white' : 'border-edge bg-surface text-muted hover:text-ink'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && !products ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState>No products found{query ? ` for “${query}”` : ''}.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
