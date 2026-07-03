import { RefreshCw } from 'lucide-react';
import { useData } from '../lib/useData';
import type { Lead } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { IconButton } from '../components/ui';
import { formatDate } from '../lib/utils';

export function LeadsAdmin() {
  const { data: leads, loading, reload } = useData<Lead[]>('/admin/leads');

  const columns: Column<Lead>[] = [
    { key: 'name', label: 'Name', render: (l) => <span className="font-semibold">{l.name}</span>, sortValue: (l) => l.name },
    {
      key: 'phone', label: 'Phone',
      render: (l) => (l.phone ? <a href={`tel:${l.phone}`} className="text-pink hover:underline">{l.phone}</a> : '—'),
    },
    { key: 'email', label: 'Email', render: (l) => l.email || '—' },
    {
      key: 'source', label: 'Source',
      render: (l) => (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${l.source === 'account' ? 'bg-sky-500/15 text-sky-300' : 'bg-surface2 text-muted'}`}>
          {l.source}
        </span>
      ),
      sortValue: (l) => l.source,
    },
    { key: 'orders', label: 'Orders', render: (l) => l.orderCount, sortValue: (l) => l.orderCount },
    { key: 'channel', label: 'Last channel', render: (l) => <span className="uppercase text-[10px] text-muted">{l.lastChannel || '—'}</span> },
    { key: 'date', label: 'First seen', render: (l) => formatDate(l.createdAt), sortValue: (l) => l.createdAt || '' },
  ];

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-sm font-bold">Leads</h1>
        <p className="text-[11px] text-muted">Every captured contact — guest orders and registered accounts — in one list for outreach.</p>
      </div>
      <DataTable
        rows={leads}
        columns={columns}
        loading={loading}
        searchText={(l) => `${l.name} ${l.phone} ${l.email} ${l.source}`}
        searchPlaceholder="Search name, phone, email…"
        toolbar={<IconButton icon={<RefreshCw className="h-3.5 w-3.5" />} title="Refresh" onClick={reload} />}
        emptyMessage="No leads captured yet."
      />
    </div>
  );
}
