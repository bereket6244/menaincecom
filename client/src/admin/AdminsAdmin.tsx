import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { User } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { Button, Modal, SysLabel } from '../components/ui';
import { useApp } from '../store/AppContext';

type Draft = {
  name: string;
  identifier: string;
  password: string;
};

const EMPTY: Draft = { name: '', identifier: '', password: '' };

export function AdminsAdmin() {
  const { data: admins, loading, reload } = useData<User[]>('/admin/users/admins');
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.identifier.trim() || !draft.password.trim()) {
      toast('error', 'Name, email/phone and password are required.');
      return;
    }
    if (draft.password.length < 6) {
      toast('error', 'Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      await apiSend('POST', '/admin/users/admins', draft);
      toast('success', 'Admin created.');
      setDraft(null);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (u) => (
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-pink" />
          {u.name}
        </span>
      ),
      sortValue: (u) => u.name,
    },
    { key: 'identifier', label: 'Email / phone', render: (u) => u.identifier, sortValue: (u) => u.identifier },
    { key: 'role', label: 'Role', render: () => <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] uppercase text-muted">admin</span> },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-sm font-bold">Admins</h1>
      <DataTable
        rows={admins}
        columns={columns}
        loading={loading}
        searchText={(u) => `${u.name} ${u.identifier}`}
        toolbar={
          <Button onClick={() => setDraft({ ...EMPTY })} disabled={!online}>
            <Plus className="h-3.5 w-3.5" /> New admin
          </Button>
        }
        emptyMessage="No admins found."
      />

      <Modal open={draft !== null} onClose={() => setDraft(null)} title="New admin">
        {draft && (
          <div className="space-y-4">
            <div>
              <SysLabel>Name</SysLabel>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="field mt-1"
                placeholder="e.g. Mena Manager"
              />
            </div>
            <div>
              <SysLabel>Email or phone</SysLabel>
              <input
                value={draft.identifier}
                onChange={(e) => setDraft({ ...draft, identifier: e.target.value })}
                className="field mt-1"
                placeholder="manager@example.com"
              />
            </div>
            <div>
              <SysLabel>Password</SysLabel>
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className="field mt-1"
                placeholder="At least 6 characters"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-edge pt-3">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={save} busy={busy}>Create admin</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
