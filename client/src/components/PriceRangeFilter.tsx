import type { ChangeEvent } from 'react';
import { formatEtb } from '../lib/priceBands';

type Bounds = { min: number | null; max: number | null };

export function PriceRangeFilter({ bounds, min, max, onMinChange, onMaxChange }: {
  bounds: Bounds;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  if (bounds.min == null || bounds.max == null) return <p className="text-sm text-muted">No exact prices yet.</p>;

  const floor = bounds.min;
  const ceiling = bounds.max;
  const clamp = (value: number) => Math.min(ceiling, Math.max(floor, value));
  const selectedMin = min && Number.isFinite(Number(min)) ? clamp(Number(min)) : floor;
  const selectedMax = max && Number.isFinite(Number(max)) ? clamp(Number(max)) : ceiling;
  const span = Math.max(ceiling - floor, 1);
  const left = ((Math.min(selectedMin, selectedMax) - floor) / span) * 100;
  const right = 100 - ((Math.max(selectedMin, selectedMax) - floor) / span) * 100;

  const changeNumber = (event: ChangeEvent<HTMLInputElement>, update: (value: string) => void) => {
    if (event.target.value === '' || /^\d+(\.\d*)?$/.test(event.target.value)) update(event.target.value);
  };
  const commitMin = () => {
    if (!min) return;
    const value = Number(min);
    onMinChange(Number.isFinite(value) ? String(Math.min(clamp(value), selectedMax)) : '');
  };
  const commitMax = () => {
    if (!max) return;
    const value = Number(max);
    onMaxChange(Number.isFinite(value) ? String(Math.max(clamp(value), selectedMin)) : '');
  };

  return (
    <div>
      <div className="flex justify-between text-[12px] font-medium text-muted">
        <span>{formatEtb(selectedMin)}</span><span>{formatEtb(selectedMax)}</span>
      </div>
      <div className="relative mt-4 h-7">
        <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-edge" />
        <div className="absolute top-3 h-1 rounded-full bg-pink" style={{ left: `${left}%`, right: `${right}%` }} />
        <input aria-label="Minimum price" type="range" min={floor} max={ceiling} step="1" value={Math.min(selectedMin, selectedMax)} onChange={(event) => onMinChange(String(Math.min(Number(event.target.value), selectedMax)))} className="price-range-thumb absolute inset-x-0 top-0 w-full" />
        <input aria-label="Maximum price" type="range" min={floor} max={ceiling} step="1" value={Math.max(selectedMin, selectedMax)} onChange={(event) => onMaxChange(String(Math.max(Number(event.target.value), selectedMin)))} className="price-range-thumb absolute inset-x-0 top-0 w-full" />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <label className="min-w-0 text-[11px] font-medium text-muted">Min (ETB)
          <input value={min} onChange={(event) => changeNumber(event, onMinChange)} onBlur={commitMin} inputMode="decimal" placeholder={String(floor)} className="mt-1 w-full min-w-0 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-pink" />
        </label>
        <span className="pt-4 text-muted">–</span>
        <label className="min-w-0 text-[11px] font-medium text-muted">Max (ETB)
          <input value={max} onChange={(event) => changeNumber(event, onMaxChange)} onBlur={commitMax} inputMode="decimal" placeholder={String(ceiling)} className="mt-1 w-full min-w-0 rounded-lg border border-edge bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-pink" />
        </label>
      </div>
    </div>
  );
}
