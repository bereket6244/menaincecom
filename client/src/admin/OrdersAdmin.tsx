import { useState } from 'react';
import { MessageCircle, MessageSquareText, Send, RefreshCw } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { OrderRecord } from '../lib/types';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';
import { Modal, IconButton, SysLabel } from '../components/ui';
import { useApp } from '../store/AppContext';
import { complimentarySummary } from '../lib/complimentary';
import { cx, formatDate } from '../lib/utils';

const STATUS_STYLES: Record<OrderRecord['status'], string> = {
  new: 'bg-pink/15 text-pink',
  contacted: 'bg-amber-500/15 text-amber-300',
  closed: 'bg-green/15 text-green',
};

function StatusSelect({ order, onChanged }: { order: OrderRecord; onChanged: (o: OrderRecord) => void }) {
  const { toast } = useApp();
  return (
    <select
      value={order.status}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const status = e.target.value as OrderRecord['status'];
        const prev = order.status;
        onChanged({ ...order, status }); // optimistic while online
        try {
          await apiSend('PUT', `/admin/orders/${order.id}`, { status });
        } catch (err) {
          onChanged({ ...order, status: prev });
          toast('error', (err as Error).message);
        }
      }}
      className={cx('rounded border-0 px-1.5 py-0.5 text-[10px] font-bold uppercase outline-none', STATUS_STYLES[order.status])}
    >
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="closed">Closed</option>
    </select>
  );
}

export function OrdersAdmin() {
  const { data: orders, loading, reload, setData } = useData<OrderRecord[]>('/admin/orders');
  const [open, setOpen] = useState<OrderRecord | null>(null);

  const patch = (o: OrderRecord) => setData((orders || []).map((x) => (x.id === o.id ? o : x)));

  const columns: Column<OrderRecord>[] = [
    {
      key: 'ref', label: 'Ref', width: '70px',
      render: (o) => <span className="font-mono text-[10px] text-muted">{o.id.slice(0, 8).toUpperCase()}</span>,
    },
    { key: 'name', label: 'Customer', render: (o) => <span className="font-semibold">{o.customer.name}</span>, sortValue: (o) => o.customer.name },
    { key: 'phone', label: 'Phone', render: (o) => o.customer.phone || '—' },
    {
      key: 'channel', label: 'Channel',
      render: (o) => (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase text-muted">
          {o.channel === 'whatsapp'
            ? <MessageCircle className="h-3 w-3 text-green" />
            : o.channel === 'telegram'
              ? <Send className="h-3 w-3 text-sky-400" />
              : <MessageSquareText className="h-3 w-3 text-amber-400" />}
          {o.channel}
        </span>
      ),
      sortValue: (o) => o.channel,
    },
    { key: 'items', label: 'Items', render: (o) => o.items.reduce((n, i) => n + i.qty, 0), sortValue: (o) => o.items.reduce((n, i) => n + i.qty, 0) },
    {
      key: 'total', label: 'Est. Total',
      render: (o) => (o.estimatedTotal != null ? `${o.estimatedTotal.toLocaleString()} ETB` : '—'),
      sortValue: (o) => o.estimatedTotal ?? -1,
    },
    { key: 'status', label: 'Status', render: (o) => <StatusSelect order={o} onChanged={patch} /> , sortValue: (o) => o.status },
    { key: 'date', label: 'Date', render: (o) => formatDate(o.createdAt), sortValue: (o) => o.createdAt || '' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold">Orders / Leads inbox</h1>
      </div>
      <DataTable
        rows={orders}
        columns={columns}
        loading={loading}
        searchText={(o) => `${o.customer.name} ${o.customer.phone} ${o.customer.email} ${o.channel} ${o.status}`}
        searchPlaceholder="Search name, phone, channel…"
        onRowClick={setOpen}
        toolbar={<IconButton icon={<RefreshCw className="h-3.5 w-3.5" />} title="Refresh" onClick={reload} />}
        emptyMessage="No orders yet. They will appear here the moment a customer sends one."
      />

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open ? `Order ${open.id.slice(0, 8).toUpperCase()}` : ''} wide>
        {open && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><SysLabel>Customer</SysLabel><div>{open.customer.name}</div></div>
              <div>
                <SysLabel>Phone</SysLabel>
                <div>
                  {open.customer.phone
                    ? <a className="text-pink hover:underline" href={`tel:${open.customer.phone}`}>{open.customer.phone}</a>
                    : '—'}
                </div>
              </div>
              <div><SysLabel>Email</SysLabel><div>{open.customer.email || '—'}</div></div>
              <div><SysLabel>Channel</SysLabel><div className="uppercase">{open.channel}</div></div>
            </div>
            <div>
              <SysLabel>Items</SysLabel>
              <div className="mt-1 divide-y divide-edge rounded border border-edge">
                {open.items.map((i, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2">
                    {i.photo && <img src={i.photo} alt="" className="h-10 w-12 rounded object-cover" />}
                    <div className="flex-1">
                      <div className="text-xs font-semibold">{i.qty} × {i.name} {i.isAddon && <span className="text-[9px] uppercase text-muted">(add-on)</span>}</div>
                      {Object.entries(i.variantSelections).length > 0 && (
                        <div className="text-[10px] text-muted">{Object.entries(i.variantSelections).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
                      )}
                      {complimentarySummary(i.complimentaryItems) && (
                        <div className="text-[10px] font-semibold text-green">
                          Complimentary: {complimentarySummary(i.complimentaryItems)}
                        </div>
                      )}
                      {i.note && <div className="text-[10px] italic text-muted">“{i.note}”</div>}
                    </div>
                    <div className="text-xs text-green">{i.priceEach != null ? `${(i.priceEach * i.qty).toLocaleString()} ETB` : 'Quote'}</div>
                  </div>
                ))}
              </div>
            </div>
            {open.note && <div><SysLabel>Order note</SysLabel><p className="text-xs text-muted">{open.note}</p></div>}
            <div className="flex items-center justify-between border-t border-edge pt-3">
              <SysLabel>Status</SysLabel>
              <StatusSelect order={open} onChanged={(o) => { patch(o); setOpen(o); }} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
