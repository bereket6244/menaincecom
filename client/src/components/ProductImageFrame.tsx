import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { ReactNode, TouchEvent } from 'react';
import { cx } from '../lib/utils';
import { ProtectedImage } from './ProtectedImage';
import { responsiveImage } from '../lib/images';

// A keyed photo owns its load state: late events from a previous slide cannot
// clear the new slide's indicator, including when a shopper taps quickly.
function FramePhoto({ src, alt, priority, sizes, className, onReady }: {
  src: string; alt: string; priority: boolean; sizes: string; className?: string; onReady: () => void;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) {
      setState('ready');
      onReady();
    }
  }, [src, attempt]);
  return <>
    {state === 'ready' && <ProtectedImage src={src} sizes={sizes} alt="" aria-hidden="true" decoding="async"
      className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl" />}
    <ProtectedImage key={attempt} ref={ref} src={src} sizes={sizes} alt={alt}
      loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"
      onLoad={() => { setState('ready'); onReady(); }} onError={() => setState('error')}
      className={cx('relative z-[1] h-full w-full object-contain', state !== 'ready' && 'opacity-0', className)} />
    {state === 'loading' && <span role="status" className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface2 text-[10px] font-semibold text-muted">
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-pink" /> Loading photo…
    </span>}
    {state === 'error' && <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface2 text-xs text-muted">
      <span role="status">Photo couldn’t load</span>
      <button type="button" className="rounded-full border border-pink px-3 py-2 font-bold text-pink"
        onClick={(event) => { event.stopPropagation(); setState('loading'); setAttempt((n) => n + 1); }}>Retry photo</button>
    </span>}
  </>;
}

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
  preloadSrcs = [],
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
  preloadSrcs?: string[];
}) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const ignoreClickRef = useRef(false);
  const [engaged, setEngaged] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState('');
  const sizes = onOpen ? '(min-width: 1024px) 320px, 50vw' : '(min-width: 1024px) 640px, 100vw';
  const currentIndex = preloadSrcs.indexOf(src || '');
  const nextSrc = preloadSrcs[(currentIndex + 1) % preloadSrcs.length];
  const previousSrc = preloadSrcs[(currentIndex - 1 + preloadSrcs.length) % preloadSrcs.length];

  useEffect(() => {
    if (!engaged || loadedSrc !== src) return;
    // Warm only adjacent slides for the card being used, never the whole shop.
    for (const url of new Set([nextSrc, previousSrc])) {
      if (!url || url === src) continue;
      const image = new Image();
      image.fetchPriority = 'low';
      const responsive = responsiveImage(url, sizes);
      if (responsive.sizes) image.sizes = responsive.sizes;
      if (responsive.srcSet) image.srcset = responsive.srcSet;
      image.src = responsive.src!;
    }
  }, [engaged, loadedSrc, src, nextSrc, previousSrc, sizes]);

  const handleTouchStart = (event: TouchEvent) => {
    setEngaged(true);
    if (!showControls) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!showControls || !touchStartRef.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

    ignoreClickRef.current = true;
    if (dx < 0) onNext?.();
    else onPrevious?.();
    window.setTimeout(() => {
      ignoreClickRef.current = false;
    }, 350);
  };

  const image = src ? (
    <FramePhoto key={src} src={src} alt={alt} priority={priority || engaged} sizes={sizes}
      className={imageClassName} onReady={() => setLoadedSrc(src)} />
  ) : (
    placeholder
  );

  return (
    <div
      className={cx('relative isolate overflow-hidden bg-surface2 touch-pan-y select-none', className)}
      onContextMenu={(event) => event.preventDefault()}
      onPointerEnter={() => setEngaged(true)}
      onFocusCapture={() => setEngaged(true)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {image}
      {onOpen && (
        <button
          type="button"
          aria-label={`View ${alt}`}
          onClick={(event) => {
            if (ignoreClickRef.current) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            onOpen();
          }}
          className="absolute inset-0 z-[5] block h-full w-full cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink"
        />
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
            className="mena-press absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-ink shadow-[0_2px_10px_rgba(28,26,25,0.16)] hover:text-pink"
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
            className="mena-press absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-ink shadow-[0_2px_10px_rgba(28,26,25,0.16)] hover:text-pink"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
