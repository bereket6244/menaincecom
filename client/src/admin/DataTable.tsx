import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Trash2 } from 'lucide-react';
import { Button, EmptyState, Spinner } from '../components/ui';
import { cx } from '../lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
}

interface Props<T extends { id: string }> {
  rows: T[] | null;
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  onBulkDelete?: (ids: string[]) => void;
  toolbar?: ReactNode;
  emptyMessage?: string;
}

/** Dense spreadsheet-style table: search, sorting, selection, bulk actions. */
export function DataTable<T extends { id: string }>({
  rows, columns, searchText, searchPlaceholder = 'Search…', loading,
  onRowClick, onBulkDelete, toolbar, emptyMessage = 'No records.',
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    let list = rows || [];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        const sv = col.sortValue;
        list = [...list].sort((a, b) => {
          const av = sv(a); const bv = sv(b);
          return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
        });
      }
    }
    return list;
  }, [rows, query, sortKey, sortDir, columns, searchText]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 1) setSortDir(-1);
      else { setSortKey(null); setSortDir(1); }
    } else { setSortKey(key); setSortDir(1); }
  };

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* Compact toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="field pl-8" />
        </div>
        <span className="syslabel hidden sm:inline">{visible.length} rows</span>
        {onBulkDelete && selected.size > 0 && (
          <Button variant="danger" onClick={() => { onBulkDelete([...selected]); setSelected(new Set()); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete {selected.size}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>

      <div className="overflow-hidden rounded-md border border-edge bg-surface">
        <div className="max-h-[65vh] overflow-auto">
          <table className="sheet w-full border-collapse">
            <thead>
              <tr>
                {onBulkDelete && (
                  <th className="w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-pink" />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                    {c.sortValue ? (
                      <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
                        {c.label}
                        {sortKey === c.key
                          ? sortDir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </button>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cx(onRowClick && 'cursor-pointer', selected.has(row.id) && 'bg-pink/10')}
                >
                  {onBulkDelete && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} className="accent-pink" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !rows && <div className="flex justify-center py-10"><Spinner /></div>}
          {!loading && visible.length === 0 && <div className="p-4"><EmptyState>{emptyMessage}</EmptyState></div>}
        </div>
      </div>
    </div>
  );
}
