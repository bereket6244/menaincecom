import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/utils';

/**
 * Filters presented as a window in front of the catalog: a centred panel over a
 * blurred backdrop on desktop, a full-screen sheet on mobile. Closes on the X, on
 * Escape, and on a click outside the panel.
 */
export function FilterOverlay({
  open, onClose, title = 'Filters', fullScreen, headerAction, footer, children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  fullScreen?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    // The page behind must not scroll while the window is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Rendered into <body> so no ancestor's stacking context can trap it — the catalog
  // toolbars sit in z-indexed wrappers that would otherwise let the contact button and
  // card badges paint over the window. z-[55] then sits above the FAB and sticky headers
  // (z-50) but below the toasts (z-60) and the mobile nav drawer (z-70).
  return createPortal(
    <div
      className={cx('fixed inset-0 z-[55] flex', fullScreen ? 'items-stretch' : 'items-center justify-center p-6')}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Click-outside target. Hidden from assistive tech so the X stays the one
          announced way out, rather than two controls with the same label. */}
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[6px]"
      />

      <div
        className={cx(
          'relative flex min-h-0 flex-col bg-white shadow-[0_24px_60px_rgba(28,26,25,0.22)]',
          fullScreen
            ? 'h-full w-full'
            : 'max-h-[min(80vh,720px)] w-[min(420px,100%)] rounded-2xl border border-edge'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
          <span className="text-[17px] font-extrabold">{title}</span>
          <div className="flex items-center gap-3">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="mena-press flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-white text-ink hover:border-pink/50 hover:text-pink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mena-d-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="border-t border-edge px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
