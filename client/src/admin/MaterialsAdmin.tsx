import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button, IconButton, Modal } from '../components/ui';
import { apiSend } from '../lib/api';
import type { CostInput } from '../lib/types';
import { useData } from '../lib/useData';
import { useApp } from '../store/AppContext';
import { DataTable, type Column } from './DataTable';

const endpoint = '/admin/cost-inputs';

export function MaterialsAdmin() {
  const { data, loading, error, reload } = useData<CostInput[]>(endpoint);
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<Partial<CostInput> | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    if (!draft.name?.trim() || !(Number(draft.unitCost) > 0)) {
      toast('error', 'Enter a material name and a positive unit cost.');
      return;
    }
    setBusy(true);
    try {
      await apiSend('POST', endpoint, draft);
      setDraft(null);
      reload();
      toast('success', 'Material saved.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<CostInput>[] = [
    { key: 'name', label: 'Material', render: row => row.name, sortValue: row => row.name },
    { key: 'unitCost', label: 'Unit cost (ETB)', render: row => row.unitCost, sortValue: row => row.unitCost },
    { key: 'edit', label: '', width: '52px', render: row =>
      <IconButton title={`Edit ${row.name}`} icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setDraft(row)} /> },
  ];

  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <h1 className="text-sm font-bold">Materials</h1>
    <p className="text-xs text-muted">Changing a unit cost updates the price of every product that uses it.</p>
    {error && <p role="alert" className="text-sm">{error}</p>}
    <DataTable rows={data || []} columns={columns} loading={loading} searchText={row => row.name}
      onRowClick={setDraft} emptyMessage="No shared materials yet."
      toolbar={<Button disabled={!online} onClick={() => setDraft({ name: '' })}><Plus className="h-3.5 w-3.5" />New material</Button>} />
    <Modal open={draft !== null} title={draft?.id ? 'Edit material' : 'New material'} onClose={() => { if (!busy) setDraft(null); }}>
      {draft && <form onSubmit={save} className="space-y-3">
        <label className="block">Material name<input className="field mt-1" required value={draft.name || ''}
          onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block">Unit cost (ETB)<input className="field mt-1" type="number" required min="0" step="any"
          value={draft.unitCost ?? ''} onChange={e => setDraft({ ...draft, unitCost: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button>
          <Button type="submit" busy={busy} disabled={!online}>Save material</Button>
        </div>
      </form>}
    </Modal>
  </div>;
}
