import { useId, useState } from 'react';

export function SearchChoice({ label, value, options, placeholder = 'Search…', autoFocus = false, onChange }: {
  label: string; value: string; options: { value: string; label: string }[];
  placeholder?: string; autoFocus?: boolean; onChange: (value: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const selected = options.find(option => option.value === value)?.label || '';
  const filtered = options.filter(option => option.label.toLowerCase().includes((query || '').toLowerCase()));
  const choose = (next: string) => { onChange(next); setQuery(null); setActive(0); };
  return <label className="relative block min-w-0">{label}
    <input className="field min-w-0" role="combobox" autoFocus={autoFocus} autoComplete="off" placeholder={placeholder}
      aria-expanded={query !== null} aria-controls={id} aria-autocomplete="list"
      aria-activedescendant={query !== null && filtered[active] ? `${id}-${active}` : undefined}
      value={query ?? selected} onFocus={() => { setQuery(''); setActive(0); }}
      onBlur={() => setQuery(null)} onChange={event => { setQuery(event.target.value); setActive(0); }}
      onKeyDown={event => {
        if (event.key === 'Escape') setQuery(null);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setQuery(query ?? '');
          setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && query !== null) { event.preventDefault(); if (filtered[active]) choose(filtered[active].value); }
      }} />
    {query !== null && <ul id={id} role="listbox" className="absolute z-50 max-h-48 w-full overflow-auto rounded border border-edge bg-surface shadow-lg">
      {filtered.map((option, index) => <li id={`${id}-${index}`} key={option.value} role="option"
        aria-selected={index === active} className={`cursor-pointer px-2 py-2 text-sm ${index === active ? 'bg-surface2' : ''}`}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(option.value)}>{option.label}</li>)}
      {!filtered.length && <li className="p-2 text-sm text-muted">No matches</li>}
    </ul>}
  </label>;
}
