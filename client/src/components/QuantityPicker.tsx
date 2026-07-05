import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cx } from '../lib/utils';

const MAX_QTY = 100000;
const clamp = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(n) || 1));

/**
 * Animated quantity picker: − / + steppers, a directly editable number field
 * (type 1000 instead of clicking 1000 times), and optional one-tap presets.
 */
export function QuantityPicker({
  value, onChange, presets, size = 'md', className = '',
}: {
  value: number;
  onChange: (qty: number) => void;
  presets?: number[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [pulse, setPulse] = useState(0);
  const valueRef = useRef(value);
  const holdDelayRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
    setText(String(value));
  }, [value]);

  useEffect(() => () => stopHold(), []);

  const set = (n: number) => {
    onChange(clamp(n));
    setPulse((p) => p + 1);
  };

  const stopHold = () => {
    if (holdDelayRef.current) window.clearTimeout(holdDelayRef.current);
    if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current);
    holdDelayRef.current = null;
    holdIntervalRef.current = null;
  };

  const startHold = (delta: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stopHold();
    set(valueRef.current + delta);
    holdDelayRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        set(valueRef.current + delta);
      }, 55);
    }, 240);
  };

  const commit = () => {
    const n = clamp(parseInt(text, 10));
    onChange(n);
    setText(String(n));
  };

  const btnCls = cx(
    'flex touch-none select-none items-center justify-center text-ink/70 transition-colors hover:bg-surface2 active:bg-edge',
    size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  );

  return (
    <div className={cx('space-y-2.5', className)}>
      <div className="flex w-fit select-none items-center overflow-hidden rounded-full border border-edge bg-surface">
        <button
          type="button"
          onPointerDown={startHold(-1)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          className={btnCls}
          aria-label="Decrease"
        >
          <Minus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
        <div key={pulse} className="qty-pulse">
          <input
            value={text}
            type="text"
            inputMode="numeric"
            placeholder="Qty"
            title="Type quantity directly"
            onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            onFocus={(e) => e.target.select()}
            className={cx(
              'rounded-md bg-white/80 text-center font-bold text-ink outline-none ring-1 ring-edge/80 transition-shadow placeholder:text-muted/60 focus:ring-2 focus:ring-pink',
              size === 'sm' ? 'mx-0.5 h-7 w-12 text-sm' : 'mx-1 h-9 w-20 text-[15px]'
            )}
            aria-label="Quantity. You can type the amount directly."
          />
        </div>
        <button
          type="button"
          onPointerDown={startHold(1)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          className={btnCls}
          aria-label="Increase"
        >
          <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set(p)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                value === p
                  ? 'border-pink bg-pink/10 text-ink'
                  : 'border-edge bg-surface text-muted hover:border-ink/40 hover:text-ink'
              )}
            >
              {p.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
