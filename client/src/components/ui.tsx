import { X, Loader2, WifiOff, DatabaseZap, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { OFFLINE_MESSAGE } from '../lib/api';
import { cx } from '../lib/utils';

/* ------------------------------- primitives -------------------------------- */

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-muted', className || 'h-5 w-5')} />;
}

export function SysLabel({ children }: { children: ReactNode }) {
  return <span className="syslabel">{children}</span>;
}

export function Button({
  children, onClick, variant = 'primary', type = 'button', disabled, busy, className = '', title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'green' | 'outline';
  type?: 'button' | 'submit';
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: 'bg-pink text-white hover:bg-pink-dim',
    green: 'bg-green text-white hover:brightness-110',
    ghost: 'bg-transparent text-muted hover:bg-surface2 hover:text-ink',
    outline: 'border border-ink bg-white text-ink hover:bg-ink hover:text-white',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  } as const;
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        styles[variant],
        className
      )}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  icon, onClick, title, danger, className = '',
}: {
  icon: ReactNode;
  onClick?: () => void;
  title: string;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted transition-colors hover:border-edge hover:bg-surface2',
        danger ? 'hover:text-rose-500' : 'hover:text-ink',
        className
      )}
    >
      {icon}
    </button>
  );
}

/* ---------------------------- modal / bottom sheet -------------------------- */

export function Modal({
  open, onClose, title, children, wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'modal-panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-edge bg-surface shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <IconButton icon={<X className="h-4 w-4" />} title="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- toasts --------------------------------- */

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const icons = {
    success: <CheckCircle2 className="h-4 w-4 shrink-0 text-green" />,
    error: <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />,
    info: <Info className="h-4 w-4 shrink-0 text-muted" />,
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex flex-col items-center gap-1.5 px-3 sm:items-end sm:px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="toast-enter pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2 text-left text-xs text-ink shadow-lg"
        >
          {icons[t.kind]}
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ status banners ------------------------------ */

export function StatusBanners() {
  const { online, dbDown } = useApp();
  if (online && !dbDown) return null;
  return (
    <div className="sticky top-0 z-40">
      {!online && (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          {OFFLINE_MESSAGE}
        </div>
      )}
      {online && dbDown && (
        <div className="flex items-center gap-2 border-b border-rose-300 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
          <DatabaseZap className="h-3.5 w-3.5 shrink-0" />
          Server connection issue: live data may be cached, and changes cannot be saved until the API is reachable.
        </div>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-edge py-10 text-center text-xs text-muted">
      {children}
    </div>
  );
}
