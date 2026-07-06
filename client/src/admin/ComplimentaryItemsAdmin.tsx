import { useState } from 'react';
import { Gift, Pencil, Plus } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { UniversalComplimentaryItem } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { Button, IconButton, Modal, SysLabel } from '../components/ui';
import { PhotoUpload } from './PhotoUpload';
import { useApp } from '../store/AppContext';
import { COMPLIMENTARY_MAX_MULTIPLIER } from '../lib/complimentary';
import { cx } from '../lib/utils';

type Draft = Partial<UniversalComplimentaryItem>;

const EMPTY: Draft = {
  enabled: true,
  name: '',
  description: '',
  photo: '',
  type: 'fixed',
  qty: 1,
  extraPriceEach: 0,
  sortOrder: 0,
};

export function ComplimentaryItemsAdmin() {
  const { data: items, loading, reload } = useData<UniversalComplimentaryItem[]>('/admin/complimentary-items');
  const { toast, online } = useApp();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...(items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const save = async () => {
    if (!editing?.name?.trim()) { toast('error', 'Complimentary item name is required.'); return; }
    setBusy(true);
    try {
      const payload = {
        ...editing,
        enabled: editing.enabled !== false,
        name: editing.name.trim(),
        type: editing.type === 'multiplier' ? 'multiplier' : 'fixed',
        qty: editing.type === 'multiplier'
          ? Math.min(COMPLIMENTARY_MAX_MULTIPLIER, Math.max(0.01, Number(editing.qty) || 1))
          : Math.max(1, Math.floor(Number(editing.qty) || 1)),
        extraPriceEach: Math.max(0, Number(editing.extraPriceEach) || 0),
        sortOrder: Number(editing.sortOrder) || 0,
      };
      if (editing.id) await apiSend('PUT', `/admin/complimentary-items/${editing.id}`, payload);
      else await apiSend('POST', '/admin/complimentary-items', { ...payload, sortOrder: sorted.length });
      toast('success', 'Universal complimentary item saved.');
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
      await Promise.all(ids.map((id) => apiSend('DELETE', `/admin/complimentary-items/${id}`)));
      toast('success', `${ids.length} item(s) deleted.`);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const columns: Column<UniversalComplimentaryItem>[] = [
    {
      key: 'photo', label: '', width: '52px',
      render: (item) => (
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-edge bg-surface2">
          {item.photo ? <img src={item.photo} alt="" className="h-full w-full object-cover" /> : <Gift className="h-4 w-4 text-muted" />}
        </div>
      ),
    },
    {
      key: 'name', label: 'Item',
      render: (item) => (
        <span className="font-semibold">
          {item.name}
          {!item.enabled && <span className="ml-1.5 rounded bg-surface2 px-1 py-0.5 text-[9px] uppercase text-muted">off</span>}
        </span>
      ),
      sortValue: (item) => item.name,
    },
    {
      key: 'free', label: 'Free rule',
      render: (item) => item.type === 'multiplier' ? `${item.qty}x main amount` : `${item.qty} fixed`,
      sortValue: (item) => item.qty,
    },
    {
      key: 'extra', label: 'Extra',
      render: (item) => `${(item.extraPriceEach || 0).toLocaleString()} ETB each`,
      sortValue: (item) => item.extraPriceEach || 0,
    },
    {
      key: 'actions', label: '', width: '40px',
      render: (item) => (
        <div onClick={(event) => event.stopPropagation()}>
          <IconButton icon={<Pencil className="h-3.5 w-3.5" />} title="Edit" onClick={() => setEditing({ ...item })} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-sm font-bold">Universal Complimentary Items</h1>
      <DataTable
        rows={sorted}
        columns={columns}
        loading={loading}
        searchText={(item) => `${item.name} ${item.description || ''}`}
        onRowClick={(item) => setEditing({ ...item })}
        onBulkDelete={bulkDelete}
        toolbar={
          <Button onClick={() => setEditing({ ...EMPTY })} disabled={!online}>
            <Plus className="h-3.5 w-3.5" /> New item
          </Button>
        }
        emptyMessage="No universal complimentary items yet."
      />

      <button
        onClick={() => setEditing({ ...EMPTY })}
        disabled={!online}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-pink text-white shadow-lg disabled:opacity-40 md:hidden"
        aria-label="New complimentary item"
      >
        <Plus className="h-5 w-5" />
      </button>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit complimentary item' : 'New complimentary item'}>
        {editing && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 rounded border border-edge bg-surface2 p-2.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={editing.enabled !== false}
                onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })}
                className="accent-pink"
              />
              Enabled
            </label>

            <div>
              <SysLabel>Name</SysLabel>
              <input
                value={editing.name || ''}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                className="field mt-1"
                placeholder="Entrance cards, schedule cards..."
              />
            </div>

            <div>
              <SysLabel>Description (optional)</SysLabel>
              <textarea
                value={editing.description || ''}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                rows={2}
                className="field mt-1 resize-y"
              />
            </div>

            <div>
              <SysLabel>Photo (optional)</SysLabel>
              <div className="mt-1">
                <PhotoUpload single photos={editing.photo ? [editing.photo] : []} onChange={(photos) => setEditing({ ...editing, photo: photos[0] || '' })} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <SysLabel>Free rule</SysLabel>
                <select
                  value={editing.type || 'fixed'}
                  onChange={(event) => setEditing({ ...editing, type: event.target.value as 'fixed' | 'multiplier' })}
                  className="field mt-1"
                >
                  <option value="fixed">Fixed qty</option>
                  <option value="multiplier">Multiplier</option>
                </select>
              </div>
              <div>
                <SysLabel>{editing.type === 'multiplier' ? 'Multiplier' : 'Free qty'}</SysLabel>
                <input
                  type="number"
                  min={editing.type === 'multiplier' ? 0.01 : 1}
                  max={editing.type === 'multiplier' ? COMPLIMENTARY_MAX_MULTIPLIER : undefined}
                  step={editing.type === 'multiplier' ? 0.25 : 1}
                  value={editing.qty ?? 1}
                  onChange={(event) => setEditing({ ...editing, qty: Number(event.target.value) })}
                  className="field mt-1"
                />
              </div>
              <div>
                <SysLabel>Extra ETB each</SysLabel>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editing.extraPriceEach ?? 0}
                  onChange={(event) => setEditing({ ...editing, extraPriceEach: Number(event.target.value) })}
                  className="field mt-1"
                />
              </div>
            </div>

            <p className={cx('text-[11px] text-muted', editing.type === 'multiplier' && 'text-pink')}>
              Multiplier rules are capped at {COMPLIMENTARY_MAX_MULTIPLIER}x the selected main product amount.
            </p>

            <div className="flex justify-end gap-2 border-t border-edge pt-3">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} busy={busy}>Save item</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
