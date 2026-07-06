import { useState } from 'react';
import { Plus, Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { Category } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { Button, IconButton, Modal, SysLabel } from '../components/ui';
import { PhotoUpload } from './PhotoUpload';
import { useApp } from '../store/AppContext';

const EMPTY = { name: '', photo: '', sortOrder: 0 };

export function CategoriesAdmin() {
  const { data: categories, loading, reload } = useData<Category[]>('/admin/categories');
  const { toast, online } = useApp();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...(categories || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const save = async () => {
    if (!editing?.name?.trim()) { toast('error', 'Category name is required.'); return; }
    setBusy(true);
    try {
      if (editing.id) await apiSend('PUT', `/admin/categories/${editing.id}`, editing);
      else await apiSend('POST', '/admin/categories', { ...editing, sortOrder: sorted.length });
      toast('success', 'Category saved. It is live in the catalog now.');
      setEditing(null);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const move = async (cat: Category, dir: -1 | 1) => {
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const other = sorted[idx + dir];
    if (!other) return;
    try {
      await Promise.all([
        apiSend('PUT', `/admin/categories/${cat.id}`, { sortOrder: other.sortOrder ?? idx + dir }),
        apiSend('PUT', `/admin/categories/${other.id}`, { sortOrder: cat.sortOrder ?? idx }),
      ]);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const bulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => apiSend('DELETE', `/admin/categories/${id}`)));
      toast('success', `${ids.length} categor${ids.length > 1 ? 'ies' : 'y'} deleted.`);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'photo', label: '', width: '52px',
      render: (c) => (
        <div className="h-9 w-9 overflow-hidden rounded-full border border-edge bg-surface2">
          {c.photo && <img src={c.photo} alt="" className="h-full w-full object-cover" />}
        </div>
      ),
    },
    { key: 'name', label: 'Name', render: (c) => <span className="font-semibold">{c.name}</span>, sortValue: (c) => c.name },
    { key: 'order', label: 'Order', render: (c) => c.sortOrder ?? 0, sortValue: (c) => c.sortOrder ?? 0 },
    {
      key: 'actions', label: '', width: '110px',
      render: (c) => (
        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
          <IconButton icon={<ArrowUp className="h-3.5 w-3.5" />} title="Move up" onClick={() => move(c, -1)} />
          <IconButton icon={<ArrowDown className="h-3.5 w-3.5" />} title="Move down" onClick={() => move(c, 1)} />
          <IconButton icon={<Pencil className="h-3.5 w-3.5" />} title="Edit" onClick={() => setEditing(c)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-sm font-bold">Categories</h1>
      <DataTable
        rows={sorted}
        columns={columns}
        loading={loading}
        searchText={(c) => c.name}
        onRowClick={(c) => setEditing(c)}
        onBulkDelete={bulkDelete}
        toolbar={
          <Button onClick={() => setEditing({ ...EMPTY })} disabled={!online}>
            <Plus className="h-3.5 w-3.5" /> New category
          </Button>
        }
        emptyMessage="No categories yet — create the first one."
      />

      {/* Floating add button (mobile) */}
      <button
        onClick={() => setEditing({ ...EMPTY })}
        disabled={!online}
        className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-pink text-white shadow-lg disabled:opacity-40 md:hidden"
        aria-label="New category"
      >
        <Plus className="h-5 w-5" />
      </button>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : 'New category'}>
        {editing && (
          <div className="space-y-3">
            <div>
              <SysLabel>Name</SysLabel>
              <input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="field mt-1" placeholder="e.g. Wedding Invitations" />
            </div>
            <div>
              <SysLabel>Category profile picture</SysLabel>
              <p className="mt-0.5 text-[11px] text-muted">Shown to customers as the circular category image in the storefront.</p>
              <div className="mt-2">
                <PhotoUpload single photos={editing.photo ? [editing.photo] : []} onChange={(p) => setEditing({ ...editing, photo: p[0] || '' })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save} busy={busy}>Save category</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
