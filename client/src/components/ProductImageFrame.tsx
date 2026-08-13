import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../lib/utils';

export function ProductImageFrame({
  src,
  alt,
  priority = false,
  className,
  imageClassName,
  placeholder,
  onOpen,
  showControls = false,
  onPrevious,
  onNext,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  placeholder: ReactNode;
  onOpen?: () => void;
  showControls?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const image = src ? (
    <>
      <img
        src={src}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
      />
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cx('relative z-[1] h-full w-full object-contain', imageClassName)}
      />
    </>
  ) : (
    placeholder
  );

  return (
    <div className={cx('relative overflow-hidden bg-surface2', className)}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block h-full w-full cursor-pointer">
          {image}
        </button>
      ) : (
        image
      )}

      {showControls && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrevious?.();
            }}
            aria-label="Previous photo"
            className="mena-press absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-ink shadow-[0_2px_10px_rgba(28,26,25,0.16)] hover:text-pink"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNext?.();
            }}
            aria-label="Next photo"
            className="mena-press absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-ink shadow-[0_2px_10px_rgba(28,26,25,0.16)] hover:text-pink"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
