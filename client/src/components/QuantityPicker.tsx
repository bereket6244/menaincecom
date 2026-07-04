import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
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

  useEffect(() => { setText(String(value)); }, [value]);

  const set = (n: number) => {
    onChange(clamp(n));
    setPulse((p) => p + 1);
  };

  const commit = () => {
    const n = clamp(parseInt(text, 10));
    onChange(n);
    setText(String(n));
  };

  const btnCls = cx(
    'flex items-center justify-center text-ink/70 transition-colors hover:bg-surface2 active:bg-edge',
    size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  );

  return (
    <div className={cx('space-y-2.5', className)}>
      <div className="flex w-fit items-center overflow-hidden rounded-full border border-edge bg-surface">
        <motion.button type="button" whileTap={{ scale: 0.8 }} onClick={() => set(value - 1)} className={btnCls} aria-label="Decrease">
          <Minus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </motion.button>
        <motion.div key={pulse} animate={{ scale: [1, 1.14, 1] }} transition={{ duration: 0.18, ease: 'easeOut' }}>
          <input
            value={text}
            inputMode="numeric"
            onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            onFocus={(e) => e.target.select()}
            className={cx(
              'bg-transparent text-center font-bold text-ink outline-none',
              size === 'sm' ? 'w-12 text-sm' : 'w-16 text-[15px]'
            )}
            aria-label="Quantity"
          />
        </motion.div>
        <motion.button type="button" whileTap={{ scale: 0.8 }} onClick={() => set(value + 1)} className={btnCls} aria-label="Increase">
          <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </motion.button>
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <motion.button
              key={p}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => set(p)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                value === p
                  ? 'border-pink bg-pink/10 text-ink'
                  : 'border-edge bg-surface text-muted hover:border-ink/40 hover:text-ink'
              )}
            >
              {p.toLocaleString()}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
