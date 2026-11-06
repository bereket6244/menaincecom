import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Modal } from '../components/ui';
import { apiSend } from '../lib/api';
import type { CostInput, MaterialOption } from '../lib/types';
import { useData } from '../lib/useData';
import { useApp } from '../store/AppContext';
import { DataTable, type Column } from './DataTable';

const endpoint = '/admin/cost-inputs';

export function MaterialsAdmin() {
  const { data, loading, error, reload } = useData<CostInput[]>(endpoint);
  const { data: margins, reload: reloadMargins } = useData<number[]>('/admin/cost-margins');
  const [percent, setPercent] = useState('');
  const [savingMargin, setSavingMargin] = useState(false);
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<Partial<CostInput> | null>(null);
  const [deleting, setDeleting] = useState<CostInput | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMargin(event: React.FormEvent) {
    event.preventDefault();
    setSavingMargin(true);
    try {
      await apiSend('POST', '/admin/cost-margins', { percent: Number(percent) });
      reloadMargins();
      setPercent('');
      toast('success', 'Margin available in product Cost.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setSavingMargin(false);
    }
  }

  function updateOption(id: string, patch: Partial<MaterialOption>) {
    if (!draft) return;
    setDraft({ ...draft, options: draft.options?.map(o => o.id === id ? { ...o, ...patch } : o) });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    if (!draft.name?.trim() || (!draft.options?.length && !(Number(draft.unitCost) > 0))) {
      toast('error', 'Enter a material name and a unit cost or priced options.');
      return;
    }
    setBusy(true);
    try {
      await apiSend('POST', endpoint, { ...draft, unitCost: draft.options?.length ? null : draft.unitCost });
      setDraft(null);
      reload();
      toast('success', 'Material saved.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMaterial() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await apiSend('DELETE', `${endpoint}/${deleting.id}`);
      setDeleting(null);
      reload();
      toast('success', 'Material deleted.');
    } catch (err) { toast('error', (err as Error).message); }
    finally { setBusy(false); }
  }

  const columns: Column<CostInput>[] = [
    { key: 'name', label: 'Material', render: row => row.name, sortValue: row => row.name },
    { key: 'unitCost', label: 'Unit cost (ETB)', render: row => [
      ...(row.options?.length || row.unitCost == null ? [] : [String(row.unitCost)]),
      ...(row.options || []).map(o => `${o.name}: ${o.unitCost}`),
    ].join(' · '), sortValue: row => row.unitCost ?? 0 },
    { key: 'delete', label: '', width: '52px', render: row => <IconButton title={`Delete ${row.name}`} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(row)} /> },
    { key: 'edit', label: '', width: '52px', render: row =>
      <IconButton title={`Edit ${row.name}`} icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setDraft(row)} /> },
  ];

  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <h1 className="text-sm font-bold">Materials</h1>
    <p className="text-xs text-muted">Changing a unit cost updates the price of every product that uses it.</p>
    <details className="rounded border border-edge bg-surface p-2 text-xs">
      <summary className="cursor-pointer font-semibold">Margin choices</summary>
      <p className="my-2">Each percentage is added to input cost. For example, 100 ETB plus 25% is 125 ETB.</p>
      <p className="my-2">{margins?.map(n => n + '%').join(', ')}</p>
      <form className="flex items-end gap-2" onSubmit={addMargin}>
        <label>Additional margin (%)<input className="field" type="number" required min="0" step="any" value={percent} onChange={e => setPercent(e.target.value)} /></label>
        <Button type="submit" busy={savingMargin} disabled={!online}>Add margin</Button>
      </form>
    </details>
    {error && <p role="alert" className="text-sm">{error}</p>}
    <DataTable rows={data || []} columns={columns} loading={loading} searchText={row => [row.name, ...(row.options || []).map(o => o.name)].join(' ')}
      onRowClick={setDraft} emptyMessage="No shared materials yet."
      toolbar={<Button disabled={!online} onClick={() => setDraft({ name: '' })}><Plus className="h-3.5 w-3.5" />New material</Button>} />
    <Modal open={deleting !== null} title="Delete material" onClose={() => { if (!busy) setDeleting(null); }}>
      <p>Delete {deleting?.name}? Materials used by a product must first be removed from its recipe.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button>
        <Button busy={busy} disabled={!online} onClick={removeMaterial}>Delete material</Button>
      </div>
    </Modal>
    <Modal open={draft !== null} title={draft?.id ? 'Edit material' : 'New material'} onClose={() => { if (!busy) setDraft(null); }}>
      {draft && <form onSubmit={save} className="space-y-3">
        <label className="block">Material name<input autoFocus onFocus={e => e.currentTarget.select()} className="field mt-1" required value={draft.name || ''}
          onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        {!draft.options?.length && <label className="block">Unit cost (ETB)<input className="field mt-1" type="number" required min="0" step="any"
          value={draft.unitCost ?? ''} onChange={e => setDraft({ ...draft, unitCost: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>}
        <fieldset className="space-y-2"><legend className="font-semibold">Priced options</legend>
          {(draft.options || []).map(o => <div key={o.id} className="grid grid-cols-2 gap-2">
            <label>Option name<input autoFocus={!o.name} className="field" required value={o.name} onChange={e => updateOption(o.id, { name: e.target.value })} /></label>
            <label>Option cost (ETB)<input className="field" required type="number" min="0" step="any" value={o.unitCost || ''} onChange={e => updateOption(o.id, { unitCost: Number(e.target.value) })} /></label>
            <button type="button" className="text-left text-xs" onClick={() => setDraft({ ...draft, options: draft.options?.filter(item => item.id !== o.id) })}>Remove option</button>
          </div>)}
          <Button type="button" variant="outline" onClick={() => setDraft({ ...draft, options: [...(draft.options || []), { id: crypto.randomUUID(), name: '', unitCost: 0 }] })}>Add option</Button>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button>
          <Button type="submit" busy={busy} disabled={!online}>Save material</Button>
        </div>
      </form>}
    </Modal>
  </div>;
}
