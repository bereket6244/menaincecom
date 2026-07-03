import { useState } from 'react';
import { Plus, Pencil, Star, X } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { Category, PricingMode, Product, VariantGroup } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { Button, IconButton, Modal, SysLabel } from '../components/ui';
import { PhotoUpload } from './PhotoUpload';
import { useApp } from '../store/AppContext';
import { cx, formatPrice } from '../lib/utils';

type Draft = Omit<Product, 'id' | 'createdAt'> & { id?: string };

const EMPTY: Draft = {
  name: '', categoryId: '', description: '', photos: [],
  pricingMode: 'exact', price: null, variants: [],
  isAddon: false, suggestedAddonIds: [], featured: false,
};

function VariantsEditor({ variants, onChange }: { variants: VariantGroup[]; onChange: (v: VariantGroup[]) => void }) {
  return (
    <div className="space-y-2">
      {variants.map((group, gi) => (
        <div key={gi} className="rounded border border-edge bg-surface2 p-2">
          <div className="flex items-center gap-2">
            <input
              value={group.name}
              onChange={(e) => onChange(variants.map((g, i) => (i === gi ? { ...g, name: e.target.value } : g)))}
              placeholder="Variant name (e.g. Material)"
              className="field py-1 text-[11px]"
            />
            <IconButton icon={<X className="h-3.5 w-3.5" />} title="Remove variant group" danger onClick={() => onChange(variants.filter((_, i) => i !== gi))} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {group.options.map((opt, oi) => (
              <span key={oi} className="inline-flex items-center gap-1 rounded border border-edge bg-surface px-2 py-0.5 text-[11px]">
                {opt.label}
                <button
                  type="button"
                  onClick={() => onChange(variants.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)))}
                  className="text-muted hover:text-rose-400"
                  aria-label={`Remove ${opt.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              placeholder="Add option + Enter"
              className="field w-36 py-1 text-[11px]"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const value = (e.target as HTMLInputElement).value.trim();
                if (!value) return;
                onChange(variants.map((g, i) => (i === gi ? { ...g, options: [...g.options, { label: value }] } : g)));
                (e.target as HTMLInputElement).value = '';
              }}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={() => onChange([...variants, { name: '', options: [] }])}>
        <Plus className="h-3 w-3" /> Add variant group
      </Button>
    </div>
  );
}

export function ProductsAdmin() {
  const { data: products, loading, reload } = useData<Product[]>('/admin/products');
  const { data: categories } = useData<Category[]>('/categories');
  const { toast, online } = useApp();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const catName = (id: string) => (categories || []).find((c) => c.id === id)?.name || '—';
  const addonOptions = (products || []).filter((p) => p.isAddon && p.id !== editing?.id);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast('error', 'Product name is required.'); return; }
    if (!editing.isAddon && !editing.categoryId) { toast('error', 'Pick a category for this product.'); return; }
    if (editing.pricingMode !== 'quote' && (editing.price == null || editing.price <= 0)) {
      toast('error', 'Enter a price, or switch to "Request a quote".');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...editing,
        price: editing.pricingMode === 'quote' ? null : editing.price,
        variants: editing.variants.filter((v) => v.name.trim() && v.options.length > 0),
      };
      if (editing.id) await apiSend('PUT', `/admin/products/${editing.id}`, payload);
      else await apiSend('POST', '/admin/products', payload);
      toast('success', 'Product saved.');
      setEditing(null);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => apiSend('DELETE', `/admin/products/${id}`)));
      toast('success', `${ids.length} product(s) deleted.`);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'photo', label: '', width: '52px',
      render: (p) => (
        <div className="h-8 w-10 overflow-hidden rounded border border-edge bg-surface2">
          {p.photos[0] && <img src={p.photos[0]} alt="" className="h-full w-full object-cover" />}
        </div>
      ),
    },
    {
      key: 'name', label: 'Product',
      render: (p) => (
        <span className="font-semibold">
          {p.featured && <Star className="mr-1 inline h-3 w-3 fill-amber-400 text-amber-400" />}
          {p.name}
          {p.isAddon && <span className="ml-1.5 rounded bg-surface2 px-1 py-0.5 text-[9px] uppercase text-muted">add-on</span>}
        </span>
      ),
      sortValue: (p) => p.name,
    },
    { key: 'category', label: 'Category', render: (p) => (p.isAddon ? '—' : catName(p.categoryId)), sortValue: (p) => catName(p.categoryId) },
    {
      key: 'pricing', label: 'Pricing',
      render: (p) => (
        <span className={cx('text-[11px]', p.pricingMode === 'quote' ? 'text-muted' : 'text-green')}>{formatPrice(p)}</span>
      ),
      sortValue: (p) => p.price ?? -1,
    },
    { key: 'variants', label: 'Variants', render: (p) => p.variants.length || '—' },
    {
      key: 'actions', label: '', width: '40px',
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <IconButton icon={<Pencil className="h-3.5 w-3.5" />} title="Edit" onClick={() => setEditing({ ...p })} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-sm font-bold">Products</h1>
      <DataTable
        rows={products}
        columns={columns}
        loading={loading}
        searchText={(p) => `${p.name} ${p.description} ${catName(p.categoryId)}`}
        onRowClick={(p) => setEditing({ ...p })}
        onBulkDelete={bulkDelete}
        toolbar={
          <Button onClick={() => setEditing({ ...EMPTY })} disabled={!online}>
            <Plus className="h-3.5 w-3.5" /> New product
          </Button>
        }
        emptyMessage="No products yet — add the first design."
      />

      <button
        onClick={() => setEditing({ ...EMPTY })}
        disabled={!online}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-pink text-white shadow-lg disabled:opacity-40 md:hidden"
        aria-label="New product"
      >
        <Plus className="h-5 w-5" />
      </button>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit product' : 'New product'} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <SysLabel>Name</SysLabel>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="field mt-1" />
              </div>
              <div>
                <SysLabel>Category</SysLabel>
                <select
                  value={editing.categoryId}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  className="field mt-1"
                  disabled={editing.isAddon}
                >
                  <option value="">{editing.isAddon ? 'Not needed for add-ons' : 'Choose…'}</option>
                  {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <SysLabel>Description</SysLabel>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="field mt-1 resize-y" />
            </div>

            <div>
              <SysLabel>Photos</SysLabel>
              <div className="mt-1">
                <PhotoUpload photos={editing.photos} onChange={(photos) => setEditing({ ...editing, photos })} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <SysLabel>Pricing mode</SysLabel>
                <div className="mt-1 grid grid-cols-3 gap-1 rounded border border-edge bg-surface2 p-1">
                  {([['exact', 'Exact'], ['starting', 'From…'], ['quote', 'Quote']] as [PricingMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEditing({ ...editing, pricingMode: mode })}
                      className={cx(
                        'rounded py-1 text-[11px] font-semibold',
                        editing.pricingMode === mode ? 'bg-pink text-white' : 'text-muted hover:text-ink'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <SysLabel>Price (ETB)</SysLabel>
                <input
                  type="number"
                  min={0}
                  value={editing.price ?? ''}
                  disabled={editing.pricingMode === 'quote'}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value === '' ? null : Number(e.target.value) })}
                  className="field mt-1 disabled:opacity-40"
                  placeholder={editing.pricingMode === 'quote' ? 'Quoted on request' : 'e.g. 85'}
                />
              </div>
            </div>

            <div>
              <SysLabel>Variants (material, finish, color, quantity tier…)</SysLabel>
              <div className="mt-1">
                <VariantsEditor variants={editing.variants} onChange={(variants) => setEditing({ ...editing, variants })} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 rounded border border-edge bg-surface2 p-2.5">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={editing.isAddon} onChange={(e) => setEditing({ ...editing, isAddon: e.target.checked })} className="accent-pink" />
                Add-on item (entrance card, schedule card…)
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} className="accent-pink" />
                Featured on homepage
              </label>
            </div>

            {!editing.isAddon && addonOptions.length > 0 && (
              <div>
                <SysLabel>Suggested add-ons (shown on this product's page)</SysLabel>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {addonOptions.map((a) => {
                    const active = editing.suggestedAddonIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            suggestedAddonIds: active
                              ? editing.suggestedAddonIds.filter((id) => id !== a.id)
                              : [...editing.suggestedAddonIds, a.id],
                          })
                        }
                        className={cx(
                          'rounded border px-2 py-1 text-[11px]',
                          active ? 'border-pink bg-pink/15 text-ink' : 'border-edge bg-surface text-muted hover:text-ink'
                        )}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-muted">Leave empty to suggest all add-ons automatically.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-edge pt-3">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} busy={busy}>Save product</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
