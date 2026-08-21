import { useMemo, useState } from 'react';
import { Check, Plus, Pencil, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { Category, PricingMode, Product, UniversalComplimentaryItem, VariantGroup } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { Button, IconButton, Modal, SysLabel } from '../components/ui';
import { PhotoUpload } from './PhotoUpload';
import { useApp } from '../store/AppContext';
import { COMPLIMENTARY_MAX_MULTIPLIER } from '../lib/complimentary';
import { cx, cssColor, formatPrice, isColorGroupName } from '../lib/utils';
import { facetKey, optionValue } from '../lib/variantFacets';
import { productCategoryIds, productCategoryNames } from '../lib/productCategories';

type Draft = Omit<Product, 'id' | 'createdAt'> & { id?: string };
type ProductBulkPatch = {
  ids: string[];
  set?: Partial<Pick<Product, 'status' | 'categoryId' | 'categoryIds' | 'featured' | 'isAddon' | 'pricingMode' | 'price'>>;
  variants?: { mode: 'add' | 'replace'; groups: VariantGroup[] };
  complimentaryItems?: { mode: 'add' | 'replace'; items: NonNullable<Product['complimentaryItems']> };
  universalComplimentaryItemIds?: { mode: 'add' | 'replace'; ids: string[] };
  suggestedAddonIds?: { mode: 'add' | 'replace'; ids: string[] };
};

const EMPTY: Draft = {
  name: '', categoryId: '', description: '', photos: [],
  categoryIds: [],
  pricingMode: 'exact', price: null, variants: [],
  isAddon: false, suggestedAddonIds: [], complimentaryItems: [], universalComplimentaryItemIds: [], featured: false,
  status: 'published',
};

type VariantOption = VariantGroup['options'][number];
type LibraryGroup = { name: string; options: Map<string, VariantOption> };

function cleanVariants(variants: VariantGroup[]) {
  return variants
    .map((variant) => ({
      ...variant,
      name: variant.name.trim(),
      options: variant.options
        .map((option) => ({ ...option, label: option.label.trim() }))
        .filter((option) => option.label),
    }))
    .filter((variant) => variant.name && variant.options.length > 0);
}

function cleanComplimentaryItems(items: NonNullable<Product['complimentaryItems']> | undefined) {
  return (items || [])
    .map((item) => ({
      id: item.id,
      enabled: !!item.enabled,
      name: item.name.trim(),
      type: item.type === 'multiplier' ? 'multiplier' as const : 'fixed' as const,
      qty: item.type === 'multiplier'
        ? Math.min(COMPLIMENTARY_MAX_MULTIPLIER, Math.max(0.01, Number(item.qty) || 1))
        : Math.max(1, Math.floor(Number(item.qty) || 1)),
      extraPriceEach: Math.max(0, Number(item.extraPriceEach) || 0),
    }))
    .filter((item) => item.name);
}

/**
 * Variant groups and option labels already used across the catalog. Lets a group
 * invented on one product ("Paper Weight") be reused on the next, with its options,
 * instead of being retyped into a near-duplicate.
 */
function useOptionLibrary(products: Product[] | null) {
  return useMemo(() => {
    const library = new Map<string, LibraryGroup>();
    for (const product of products || []) {
      for (const group of product.variants || []) {
        const key = facetKey(group.name);
        if (!key) continue;
        if (!library.has(key)) library.set(key, { name: group.name.trim(), options: new Map() });
        const { options } = library.get(key) as LibraryGroup;
        for (const option of group.options) {
          const value = optionValue(option.label);
          if (value && !options.has(value)) options.set(value, { ...option, label: option.label.trim() });
        }
      }
    }
    return library;
  }, [products]);
}

function VariantsEditor({
  variants, onChange, library,
}: {
  variants: VariantGroup[];
  onChange: (v: VariantGroup[]) => void;
  /** Groups and options used on other products, offered as reusable suggestions. */
  library: Map<string, LibraryGroup>;
}) {
  const hasGroup = (name: string) => variants.some((g) => facetKey(g.name) === facetKey(name));
  const addGroup = (name: string) => onChange([...variants, { name, options: [] }]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [searches, setSearches] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [groupSearch, setGroupSearch] = useState('');
  const [pickedGroups, setPickedGroups] = useState<string[]>([]);

  const addOptions = (gi: number, optionsToAdd: VariantOption[]) => {
    const group = variants[gi];
    const taken = new Set(group.options.map((o) => optionValue(o.label)));
    const seen = new Set<string>();
    const fresh = optionsToAdd
      .map((option) => ({ ...option, label: option.label.trim() }))
      .filter((option) => option.label && !taken.has(optionValue(option.label)))
      .filter((option) => {
        const value = optionValue(option.label);
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    if (!fresh.length) return;
    onChange(variants.map((g, i) => (
      i === gi ? { ...g, options: [...g.options, ...fresh] } : g
    )));
    setDrafts((current) => ({ ...current, [gi]: '' }));
    setSearches((current) => ({ ...current, [gi]: '' }));
    setPicked((current) => ({ ...current, [gi]: [] }));
  };

  const togglePick = (gi: number, value: string) => {
    setPicked((current) => {
      const list = current[gi] || [];
      return { ...current, [gi]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  };

  /** Every label used elsewhere for this group name that is not already on this group. */
  const poolFor = (group: VariantGroup) => {
    const pool = library.get(facetKey(group.name))?.options;
    if (!pool) return [];
    const taken = new Set(group.options.map((o) => optionValue(o.label)));
    return [...pool.entries()]
      .filter(([value]) => !taken.has(value))
      .map(([value, option]) => ({ value, option }));
  };

  /** The pool narrowed by the panel's own search box. */
  const suggestionsFor = (group: VariantGroup, gi: number) => {
    const term = optionValue(searches[gi] || '');
    return poolFor(group)
      .filter(({ value }) => !term || value.includes(term))
      .slice(0, 24);
  };

  // Custom groups invented on other products — Size and Color have their own buttons.
  const groupPool = [...library.values()]
    .filter((entry) => !['size', 'color'].includes(facetKey(entry.name)) && !hasGroup(entry.name))
    .map((entry) => entry.name);
  const groupTerm = groupSearch.trim().toLowerCase();
  const groupMatches = groupPool.filter((name) => !groupTerm || name.toLowerCase().includes(groupTerm));
  const canCreateSearched = groupSearch.trim().length > 0
    && !groupMatches.some((name) => facetKey(name) === facetKey(groupSearch))
    && !hasGroup(groupSearch);

  const addGroups = (names: string[]) => {
    const fresh = names.filter((name) => name.trim() && !hasGroup(name));
    if (!fresh.length) return;
    onChange([
      ...variants,
      ...fresh.map((name) => {
        const cleanName = name.trim();
        const reused = library.get(facetKey(cleanName));
        return {
          name: reused?.name || cleanName,
          options: [],
        };
      }),
    ]);
    setGroupSearch('');
    setPickedGroups([]);
  };

  return (
    <div className="space-y-2">
      {variants.map((group, gi) => {
        const isColor = isColorGroupName(group.name);
        return (
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
              {group.options.map((opt, oi) => {
                const swatch = isColor ? cssColor(opt.label) : null;
                return (
                  <div key={oi} className="rounded border border-edge bg-surface p-2">
                    <div className="mb-1.5 flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked
                        onChange={() => onChange(variants.map((g, i) => (
                          i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g
                        )))}
                        className="shrink-0 accent-pink"
                        aria-label={`Include ${opt.label}`}
                      />
                      {opt.photo ? (
                        <img src={opt.photo} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
                      ) : swatch ? (
                        <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />
                      ) : null}
                      <span className="font-semibold">{opt.label}</span>
                      <button
                        type="button"
                        onClick={() => onChange(variants.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)))}
                        className="ml-auto text-muted hover:text-rose-400"
                        aria-label={`Remove ${opt.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <PhotoUpload
                      single
                      max={1}
                      showWatermark={false}
                      photos={opt.photo ? [opt.photo] : []}
                      onChange={(photos) =>
                        onChange(variants.map((g, i) => (
                          i === gi
                            ? {
                                ...g,
                                options: g.options.map((option, j) => (
                                  j === oi ? { ...option, photo: photos[0] } : option
                                )),
                              }
                            : g
                        )))
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-1.5 flex items-center gap-1">
              <input
                value={drafts[gi] || ''}
                onChange={(e) => setDrafts((current) => ({ ...current, [gi]: e.target.value }))}
                placeholder={isColor ? 'New option: ivory, gold, #c2185b' : 'New option'}
                className="field w-52 py-1 text-[11px]"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault(); // Enter still works; the button is for everyone else.
                  addOptions(gi, [{ label: drafts[gi] || '' }]);
                }}
              />
              <Button variant="outline" disabled={!(drafts[gi] || '').trim()} onClick={() => addOptions(gi, [{ label: drafts[gi] || '' }])}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            {/* Options from other products are staged here first, then saved into this
                product with the explicit button below. */}
            {poolFor(group).length > 0 && (
              <div className="mt-1.5 rounded border border-dashed border-edge p-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Used on other products ({poolFor(group).length})
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
                    <input
                      value={searches[gi] || ''}
                      onChange={(e) => setSearches((current) => ({ ...current, [gi]: e.target.value }))}
                      placeholder="Search these options"
                      className="field w-44 py-1 pl-6 text-[11px]"
                    />
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {suggestionsFor(group, gi).map(({ value, option }) => {
                    const label = option.label;
                    const swatch = isColor ? cssColor(label) : null;
                    const checked = (picked[gi] || []).includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => togglePick(gi, value)}
                        className={cx(
                          'mena-press flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                          checked ? 'border-pink bg-pink/10 font-semibold text-pink' : 'border-edge bg-surface hover:border-pink/60'
                        )}
                      >
                        <span className={cx(
                          'flex h-3 w-3 items-center justify-center rounded-[3px] border',
                          checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white'
                        )}>
                          {checked && <Check className="h-2 w-2 text-white" />}
                        </span>
                        {swatch && <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/15" style={{ background: swatch }} />}
                        {label}
                      </button>
                    );
                  })}
                  {suggestionsFor(group, gi).length === 0 && (
                    <span className="text-[11px] text-muted">
                      Nothing matches “{searches[gi]}” — type it in the New option box above to create it.
                    </span>
                  )}
                </div>
                {(picked[gi] || []).length > 0 && (
                  <div className="mt-1.5">
                    <Button
                      onClick={() => addOptions(
                        gi,
                        (picked[gi] || [])
                          .map((value) => library.get(facetKey(group.name))?.options.get(value))
                          .filter((option): option is VariantOption => !!option)
                      )}
                    >
                      <Plus className="h-3 w-3" /> Save {(picked[gi] || []).length} selected option{(picked[gi] || []).length === 1 ? '' : 's'} to this product
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={hasGroup('size')} onClick={() => addGroup('Size')}>
          <Plus className="h-3 w-3" /> Size
        </Button>
        <Button variant="outline" disabled={hasGroup('color')} onClick={() => addGroup('Color')}>
          <Plus className="h-3 w-3" /> Color
        </Button>
        <Button variant="outline" onClick={() => addGroup('')}>
          <Plus className="h-3 w-3" /> Custom group
        </Button>
      </div>

      {/* Custom groups from other products: search, tick several, add together — and if the
          search matches nothing, create a group under that name straight from here. */}
      {(groupPool.length > 0 || groupSearch) && (
        <div className="rounded border border-dashed border-edge p-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Groups on other products ({groupPool.length})
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
              <input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search or name a group"
                className="field w-48 py-1 pl-6 text-[11px]"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !canCreateSearched) return;
                  e.preventDefault();
                  addGroups([groupSearch]);
                }}
              />
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            {groupMatches.map((name) => {
              const checked = pickedGroups.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => setPickedGroups((current) => (
                    current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
                  ))}
                  className={cx(
                    'mena-press flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                    checked ? 'border-pink bg-pink/10 font-semibold text-pink' : 'border-edge bg-surface hover:border-pink/60'
                  )}
                >
                  <span className={cx(
                    'flex h-3 w-3 items-center justify-center rounded-[3px] border',
                    checked ? 'border-pink bg-pink' : 'border-[#d8cfc8] bg-white'
                  )}>
                    {checked && <Check className="h-2 w-2 text-white" />}
                  </span>
                  {name}
                </button>
              );
            })}
            {groupMatches.length === 0 && !groupSearch.trim() && (
              <span className="text-[11px] text-muted">No custom groups on other products yet.</span>
            )}
          </div>

          {(pickedGroups.length > 0 || canCreateSearched) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {pickedGroups.length > 0 && (
                <Button onClick={() => addGroups(pickedGroups)}>
                  <Plus className="h-3 w-3" /> Add {pickedGroups.length} selected
                </Button>
              )}
              {canCreateSearched && (
                <Button variant="outline" onClick={() => addGroups([groupSearch])}>
                  <Plus className="h-3 w-3" /> Create “{groupSearch.trim()}”
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted">
        Search the dashed panels to reuse groups and options from other products. Tick only the options
        you want, save the selected options into this product, then Save product. Reusing names keeps one
        catalog filter instead of near-duplicates. Colour names or hex codes become swatches.
      </p>
    </div>
  );
}

function BulkEditProductsModal({
  open, selectedCount, onClose, onApply, categories, products, universalComplimentaryItems, library,
}: {
  open: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (patch: Omit<ProductBulkPatch, 'ids'>) => Promise<void>;
  categories: Category[] | null;
  products: Product[] | null;
  universalComplimentaryItems: UniversalComplimentaryItem[] | null;
  library: Map<string, LibraryGroup>;
}) {
  const [busy, setBusy] = useState(false);
  const [shouldSetStatus, setShouldSetStatus] = useState(false);
  const [status, setProductStatus] = useState<Product['status']>('published');
  const [shouldSetCategory, setShouldSetCategory] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [shouldSetFeatured, setShouldSetFeatured] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [shouldSetAddon, setShouldSetAddon] = useState(false);
  const [isAddon, setIsAddon] = useState(false);
  const [shouldSetPricing, setShouldSetPricing] = useState(false);
  const [pricingMode, setPricingMode] = useState<PricingMode>('exact');
  const [price, setPrice] = useState<number | null>(null);
  const [variantMode, setVariantMode] = useState<'off' | 'add' | 'replace'>('off');
  const [bulkVariants, setBulkVariants] = useState<VariantGroup[]>([]);
  const [freeMode, setFreeMode] = useState<'off' | 'add' | 'replace'>('off');
  const [freeItems, setFreeItems] = useState<NonNullable<Product['complimentaryItems']>>([]);
  const [universalMode, setUniversalMode] = useState<'off' | 'add' | 'replace'>('off');
  const [universalIds, setUniversalIds] = useState<string[]>([]);
  const [addonMode, setAddonMode] = useState<'off' | 'add' | 'replace'>('off');
  const [addonIds, setAddonIds] = useState<string[]>([]);

  const addonProducts = (products || []).filter((product) => product.isAddon);
  const addFreeItem = () => {
    setFreeItems((items) => [
      ...items,
      { id: crypto.randomUUID?.() || String(Date.now()), enabled: true, name: '', type: 'fixed', qty: 1, extraPriceEach: 0 },
    ]);
  };
  const updateFreeItem = (id: string, patch: Partial<NonNullable<Product['complimentaryItems']>[number]>) => {
    setFreeItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const toggleId = (ids: string[], id: string) => (
    ids.includes(id) ? ids.filter((itemId) => itemId !== id) : [...ids, id]
  );
  const operationMode = (value: 'off' | 'add' | 'replace', setter: (next: 'off' | 'add' | 'replace') => void) => (
    <select value={value} onChange={(e) => setter(e.target.value as 'off' | 'add' | 'replace')} className="field w-32 py-1 text-[12px]">
      <option value="off">Do nothing</option>
      <option value="add">Add</option>
      <option value="replace">Replace</option>
    </select>
  );
  const resetDraft = () => {
    setShouldSetStatus(false);
    setProductStatus('published');
    setShouldSetCategory(false);
    setCategoryIds([]);
    setShouldSetFeatured(false);
    setFeatured(false);
    setShouldSetAddon(false);
    setIsAddon(false);
    setShouldSetPricing(false);
    setPricingMode('exact');
    setPrice(null);
    setVariantMode('off');
    setBulkVariants([]);
    setFreeMode('off');
    setFreeItems([]);
    setUniversalMode('off');
    setUniversalIds([]);
    setAddonMode('off');
    setAddonIds([]);
  };
  const close = () => {
    resetDraft();
    onClose();
  };

  const apply = async () => {
    const patch: Omit<ProductBulkPatch, 'ids'> = {};
    const set: NonNullable<ProductBulkPatch['set']> = {};
    if (shouldSetStatus) set.status = status;
    if (shouldSetCategory) {
      set.categoryIds = categoryIds;
      set.categoryId = categoryIds[0] || '';
    }
    if (shouldSetFeatured) set.featured = featured;
    if (shouldSetAddon) set.isAddon = isAddon;
    if (shouldSetPricing) {
      set.pricingMode = pricingMode;
      set.price = pricingMode === 'quote' ? null : price;
    }
    if (Object.keys(set).length > 0) patch.set = set;
    const variants = cleanVariants(bulkVariants);
    if (variantMode !== 'off' && variants.length > 0) patch.variants = { mode: variantMode, groups: variants };
    const complimentaryItems = cleanComplimentaryItems(freeItems);
    if (freeMode !== 'off') patch.complimentaryItems = { mode: freeMode, items: complimentaryItems };
    if (universalMode !== 'off') patch.universalComplimentaryItemIds = { mode: universalMode, ids: universalIds };
    if (addonMode !== 'off') patch.suggestedAddonIds = { mode: addonMode, ids: addonIds };
    if (Object.keys(patch).length === 0) return;
    setBusy(true);
    try {
      await onApply(patch);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={`Bulk edit ${selectedCount} product${selectedCount === 1 ? '' : 's'}`} wide>
      <div className="space-y-4">
        <div className="rounded border border-edge bg-surface2 p-3">
          <SysLabel>Basic fields</SysLabel>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={shouldSetStatus} onChange={(e) => setShouldSetStatus(e.target.checked)} className="accent-pink" />
              Status
              <select value={status} onChange={(e) => setProductStatus(e.target.value as Product['status'])} disabled={!shouldSetStatus} className="field py-1 text-[12px] disabled:opacity-40">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={shouldSetCategory} onChange={(e) => setShouldSetCategory(e.target.checked)} className="accent-pink" />
              Category
            </label>
            {shouldSetCategory && (
              <div className="flex flex-wrap gap-1 sm:col-span-2">
                {(categories || []).map((category) => {
                  const active = categoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryIds((current) => active ? current.filter((id) => id !== category.id) : [...current, category.id])}
                      className={cx('rounded border px-2 py-1 text-[11px]', active ? 'border-pink bg-pink/15 text-ink' : 'border-edge bg-surface text-muted hover:text-ink')}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={shouldSetFeatured} onChange={(e) => setShouldSetFeatured(e.target.checked)} className="accent-pink" />
              Featured
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={!shouldSetFeatured} className="accent-pink disabled:opacity-40" />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={shouldSetAddon} onChange={(e) => setShouldSetAddon(e.target.checked)} className="accent-pink" />
              Add-on item
              <select value={isAddon ? 'yes' : 'no'} onChange={(e) => setIsAddon(e.target.value === 'yes')} disabled={!shouldSetAddon} className="field py-1 text-[12px] disabled:opacity-40">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded border border-edge bg-surface2 p-3">
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={shouldSetPricing} onChange={(e) => setShouldSetPricing(e.target.checked)} className="accent-pink" />
            Pricing
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
            <select value={pricingMode} onChange={(e) => setPricingMode(e.target.value as PricingMode)} disabled={!shouldSetPricing} className="field py-1 text-[12px] disabled:opacity-40">
              <option value="exact">Exact</option>
              <option value="starting">From...</option>
              <option value="quote">Request a quote</option>
            </select>
            <input
              type="number"
              min={0}
              value={price ?? ''}
              disabled={!shouldSetPricing || pricingMode === 'quote'}
              onChange={(e) => setPrice(e.target.value === '' ? null : Number(e.target.value))}
              className="field py-1 text-[12px] disabled:opacity-40"
              placeholder={pricingMode === 'quote' ? 'Quoted on request' : 'ETB'}
            />
          </div>
        </div>

        <div className="rounded border border-edge bg-surface2 p-3">
          <div className="flex items-center justify-between gap-2">
            <SysLabel>Variant groups/options</SysLabel>
            {operationMode(variantMode, setVariantMode)}
          </div>
          {variantMode !== 'off' && (
            <div className="mt-2">
              <VariantsEditor variants={bulkVariants} onChange={setBulkVariants} library={library} />
            </div>
          )}
        </div>

        <div className="rounded border border-edge bg-surface2 p-3">
          <div className="flex items-center justify-between gap-2">
            <SysLabel>Complimentary item rules</SysLabel>
            {operationMode(freeMode, setFreeMode)}
          </div>
          {freeMode !== 'off' && (
            <div className="mt-2 space-y-2">
              {freeItems.map((item) => (
                <div key={item.id} className="grid gap-2 rounded border border-edge bg-surface p-2 sm:grid-cols-[auto_1fr_120px_100px_120px_auto] sm:items-center">
                  <input type="checkbox" checked={item.enabled} onChange={(e) => updateFreeItem(item.id, { enabled: e.target.checked })} className="accent-pink" aria-label="Enabled" />
                  <input value={item.name} onChange={(e) => updateFreeItem(item.id, { name: e.target.value })} placeholder="Envelope, schedule card..." className="field py-1 text-[12px]" />
                  <select value={item.type || 'fixed'} onChange={(e) => updateFreeItem(item.id, { type: e.target.value as 'fixed' | 'multiplier' })} className="field py-1 text-[12px]">
                    <option value="fixed">Fixed qty</option>
                    <option value="multiplier">Multiplier</option>
                  </select>
                  <input type="number" min={item.type === 'multiplier' ? 0.01 : 1} step={item.type === 'multiplier' ? 0.25 : 1} value={item.qty} onChange={(e) => updateFreeItem(item.id, { qty: Number(e.target.value) })} className="field py-1 text-[12px]" />
                  <input type="number" min={0} value={item.extraPriceEach ?? 0} onChange={(e) => updateFreeItem(item.id, { extraPriceEach: Number(e.target.value) })} className="field py-1 text-[12px]" aria-label="Extra price each" />
                  <IconButton icon={<X className="h-3.5 w-3.5" />} title="Remove complimentary item" danger onClick={() => setFreeItems((items) => items.filter((freeItem) => freeItem.id !== item.id))} />
                </div>
              ))}
              <Button variant="outline" onClick={addFreeItem}><Plus className="h-3 w-3" /> Add free item</Button>
            </div>
          )}
        </div>

        {(universalComplimentaryItems || []).length > 0 && (
          <div className="rounded border border-edge bg-surface2 p-3">
            <div className="flex items-center justify-between gap-2">
              <SysLabel>Universal complimentary items</SysLabel>
              {operationMode(universalMode, setUniversalMode)}
            </div>
            {universalMode !== 'off' && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(universalComplimentaryItems || []).map((item) => {
                  const active = universalIds.includes(item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => setUniversalIds((ids) => toggleId(ids, item.id))} className={cx('rounded border px-2 py-1 text-[11px]', active ? 'border-green bg-green/15 text-green' : 'border-edge bg-surface text-muted hover:text-ink')}>
                      {item.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {addonProducts.length > 0 && (
          <div className="rounded border border-edge bg-surface2 p-3">
            <div className="flex items-center justify-between gap-2">
              <SysLabel>Suggested add-ons</SysLabel>
              {operationMode(addonMode, setAddonMode)}
            </div>
            {addonMode !== 'off' && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {addonProducts.map((item) => {
                  const active = addonIds.includes(item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => setAddonIds((ids) => toggleId(ids, item.id))} className={cx('rounded border px-2 py-1 text-[11px]', active ? 'border-pink bg-pink/15 text-ink' : 'border-edge bg-surface text-muted hover:text-ink')}>
                      {item.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-edge pt-3">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={apply} busy={busy} disabled={shouldSetCategory && categoryIds.length === 0}>Apply changes</Button>
        </div>
      </div>
    </Modal>
  );
}

export function ProductsAdmin() {
  const { data: products, loading, reload, setData } = useData<Product[]>('/admin/products');
  const { data: categories } = useData<Category[]>('/categories');
  const { data: universalComplimentaryItems } = useData<UniversalComplimentaryItem[]>('/admin/complimentary-items');
  const { toast, online } = useApp();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [bulkEditingIds, setBulkEditingIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const optionLibrary = useOptionLibrary(products);
  const catNames = (product: Pick<Product, 'categoryId' | 'categoryIds'>) => productCategoryNames(product, categories || []);
  const catLabel = (product: Pick<Product, 'categoryId' | 'categoryIds'>) => catNames(product).join(', ') || '—';
  const addonOptions = (products || []).filter((p) => p.isAddon && p.id !== editing?.id);
  const editingCategoryIds = editing ? productCategoryIds(editing) : [];
  const toggleEditingCategory = (id: string) => {
    if (!editing) return;
    const next = editingCategoryIds.includes(id)
      ? editingCategoryIds.filter((categoryId) => categoryId !== id)
      : [...editingCategoryIds, id];
    setEditing({ ...editing, categoryIds: next, categoryId: next[0] || '' });
  };

  const updateComplimentaryItem = (
    id: string,
    patch: Partial<NonNullable<Draft['complimentaryItems']>[number]>
  ) => {
    if (!editing) return;
    setEditing({
      ...editing,
      complimentaryItems: (editing.complimentaryItems || []).map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  };

  const addComplimentaryItem = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      complimentaryItems: [
        ...(editing.complimentaryItems || []),
        { id: crypto.randomUUID?.() || String(Date.now()), enabled: true, name: '', type: 'fixed', qty: 2, extraPriceEach: 0 },
      ],
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast('error', 'Product name is required.'); return; }
    const selectedCategoryIds = productCategoryIds(editing);
    if (!editing.isAddon && selectedCategoryIds.length === 0) { toast('error', 'Pick at least one category for this product.'); return; }
    if (editing.pricingMode !== 'quote' && (editing.price == null || editing.price <= 0)) {
      toast('error', 'Enter a price, or switch to "Request a quote".');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...editing,
        categoryId: editing.isAddon ? '' : selectedCategoryIds[0] || '',
        categoryIds: editing.isAddon ? [] : selectedCategoryIds,
        price: editing.pricingMode === 'quote' ? null : editing.price,
        variants: cleanVariants(editing.variants),
        complimentaryItems: editing.isAddon
          ? []
          : cleanComplimentaryItems(editing.complimentaryItems),
        universalComplimentaryItemIds: editing.isAddon ? [] : editing.universalComplimentaryItemIds || [],
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
      setData((current) => current ? current.filter((product) => !ids.includes(product.id)) : current);
      toast('success', `${ids.length} product(s) deleted.`);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const bulkEdit = async (ids: string[], patch: Omit<ProductBulkPatch, 'ids'>) => {
    try {
      const res = await apiSend<{ products: Product[] }>('PATCH', '/admin/products/bulk', { ids, ...patch });
      const updated = new Map(res.products.map((product) => [product.id, product]));
      setData((current) => current ? current.map((product) => updated.get(product.id) || product) : current);
      toast('success', `${res.products.length} product(s) updated.`);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
      throw err;
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
    { key: 'category', label: 'Category', render: (p) => (p.isAddon ? '—' : catLabel(p)), sortValue: (p) => catLabel(p) },
    {
      key: 'status', label: 'Status',
      render: (p) => <span className="text-[11px] capitalize">{p.status || 'published'}</span>,
      sortValue: (p) => p.status || 'published',
    },
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
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <h1 className="text-sm font-bold">Products</h1>
      <DataTable
        rows={products}
        columns={columns}
        loading={loading}
        searchText={(p) => `${p.name} ${p.description} ${catLabel(p)}`}
        onRowClick={(p) => setEditing({ ...p })}
        bulkActions={(ids) => (
          <Button variant="outline" onClick={() => setBulkEditingIds(ids)} disabled={!online}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Bulk edit {ids.length}
          </Button>
        )}
        onBulkDelete={bulkDelete}
        deleteConfirmation={(ids) =>
          `Delete ${ids.length} product${ids.length === 1 ? '' : 's'}?\n\nThis hides ${ids.length === 1 ? 'it' : 'them'} from the website and deletes the linked Telegram channel post${ids.length === 1 ? '' : 's'} when Telegram sync is enabled. This cannot be undone from the admin table.`
        }
        toolbar={
          <Button onClick={() => setEditing({ ...EMPTY })} disabled={!online}>
            <Plus className="h-3.5 w-3.5" /> New product
          </Button>
        }
        emptyMessage="No products yet — add the first design."
      />

      <BulkEditProductsModal
        open={bulkEditingIds.length > 0}
        selectedCount={bulkEditingIds.length}
        onClose={() => setBulkEditingIds([])}
        onApply={(patch) => bulkEdit(bulkEditingIds, patch)}
        categories={categories}
        products={products}
        universalComplimentaryItems={universalComplimentaryItems}
        library={optionLibrary}
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
                <div className={cx('mt-1 flex min-h-10 flex-wrap gap-1.5 rounded border border-edge bg-white p-1.5', editing.isAddon && 'opacity-40')}>
                  {(categories || []).map((category) => {
                    const active = editingCategoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        disabled={editing.isAddon}
                        onClick={() => toggleEditingCategory(category.id)}
                        className={cx(
                          'rounded border px-2.5 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed',
                          active ? 'border-pink bg-pink/15 text-ink' : 'border-edge bg-surface text-muted hover:text-ink'
                        )}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                  {(categories || []).length === 0 && (
                    <span className="px-2 py-1.5 text-[11px] text-muted">No categories yet.</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <SysLabel>Publication status</SysLabel>
              <select
                value={editing.status || 'published'}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as Product['status'] })}
                className="field mt-1"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
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
                <VariantsEditor
                  variants={editing.variants}
                  onChange={(variants) => setEditing({ ...editing, variants })}
                  library={optionLibrary}
                />
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

            {!editing.isAddon && (
              <div className="rounded border border-edge bg-surface2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SysLabel>Complimentary items</SysLabel>
                    <p className="mt-0.5 text-[10px] text-muted">
                      Use Fixed qty for a set amount like 50 schedule cards, or Multiplier for amounts like 1x the main card quantity. Every item is capped at {COMPLIMENTARY_MAX_MULTIPLIER}x the selected main-card amount.
                    </p>
                  </div>
                  <Button variant="outline" onClick={addComplimentaryItem}>
                    <Plus className="h-3 w-3" /> Add free item
                  </Button>
                </div>

                {(editing.complimentaryItems || []).length === 0 ? (
                  <p className="mt-3 text-[11px] text-muted">No complimentary items for this product.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(editing.complimentaryItems || []).map((item) => (
                      <div key={item.id} className="grid gap-2 rounded border border-edge bg-surface p-2 sm:grid-cols-[auto_1fr_130px_120px_140px_auto] sm:items-center">
                        <label className="flex items-center gap-2 text-xs font-semibold">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={(e) => updateComplimentaryItem(item.id, { enabled: e.target.checked })}
                            className="accent-pink"
                          />
                          On
                        </label>
                        <input
                          value={item.name}
                          onChange={(e) => updateComplimentaryItem(item.id, { name: e.target.value })}
                          placeholder="Entrance cards, schedule cards..."
                          className="field py-1 text-[12px]"
                        />
                        <select
                          value={item.type || 'fixed'}
                          onChange={(e) => updateComplimentaryItem(item.id, { type: e.target.value as 'fixed' | 'multiplier' })}
                          className="field py-1 text-[12px]"
                          aria-label="Complimentary quantity type"
                        >
                          <option value="fixed">Fixed qty</option>
                          <option value="multiplier">Multiplier</option>
                        </select>
                        <input
                          type="number"
                          min={item.type === 'multiplier' ? 0.01 : 1}
                          max={item.type === 'multiplier' ? COMPLIMENTARY_MAX_MULTIPLIER : undefined}
                          step={item.type === 'multiplier' ? 0.25 : 1}
                          value={item.qty}
                          onChange={(e) => updateComplimentaryItem(item.id, { qty: Number(e.target.value) })}
                          className="field py-1 text-[12px]"
                          aria-label={item.type === 'multiplier' ? 'Complimentary multiplier' : 'Complimentary quantity'}
                        />
                        <label className="block">
                          <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Extra ETB each</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={item.extraPriceEach ?? 0}
                            onChange={(e) => updateComplimentaryItem(item.id, { extraPriceEach: Number(e.target.value) })}
                            className="field py-1 text-[12px]"
                            aria-label="Extra price per complimentary item"
                          />
                        </label>
                        <IconButton
                          icon={<X className="h-3.5 w-3.5" />}
                          title="Remove complimentary item"
                          danger
                          onClick={() =>
                            setEditing({
                              ...editing,
                              complimentaryItems: (editing.complimentaryItems || []).filter((freeItem) => freeItem.id !== item.id),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!editing.isAddon && (universalComplimentaryItems || []).length > 0 && (
              <div className="rounded border border-edge bg-surface2 p-3">
                <SysLabel>Universal complimentary items for this product</SysLabel>
                <p className="mt-0.5 text-[10px] text-muted">
                  Select reusable free/extra items that should appear on this product page.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(universalComplimentaryItems || []).map((item) => {
                    const active = (editing.universalComplimentaryItemIds || []).includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            universalComplimentaryItemIds: active
                              ? (editing.universalComplimentaryItemIds || []).filter((id) => id !== item.id)
                              : [...(editing.universalComplimentaryItemIds || []), item.id],
                          })
                        }
                        className={cx(
                          'rounded border px-2.5 py-1.5 text-[11px] font-semibold',
                          active ? 'border-green bg-green/15 text-green' : 'border-edge bg-surface text-muted hover:text-ink'
                        )}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
