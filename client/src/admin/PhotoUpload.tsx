import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import watermarkImage from '../assets/mena-watermark-tile.png';
import { apiUpload } from '../lib/api';
import { compressImage } from '../lib/utils';
import { useApp } from '../store/AppContext';

const move = (list: string[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** The lifted tile that follows the pointer while dragging. */
type Lift = {
  photo: string;
  x: number; y: number;      // current pointer position
  dx: number; dy: number;    // grab offset inside the tile
  w: number; h: number;      // tile size
};

/**
 * Photo picker: preserves normal uploads when possible, and only re-encodes
 * when resizing or applying a watermark is needed. Multi-photo pickers can be
 * reordered by picking a tile up and dropping it (mouse or touch); the tile
 * follows the cursor and the other tiles open a slot where it will land.
 */
export function PhotoUpload({
  photos, onChange, max = 8, single, showWatermark = true,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  single?: boolean;
  showWatermark?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [addWatermark, setAddWatermark] = useState(false);
  const { toast } = useApp();

  // Live preview of the reordered list while a drag is in progress.
  const [preview, setPreview] = useState<string[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ pointerId: number; index: number; x: number; y: number; active: boolean } | null>(null);

  const list = preview ?? photos;
  const sortable = !single && list.length > 1;

  // Keep the grabbing cursor while the pointer is anywhere on the page.
  useEffect(() => {
    if (!lift) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';
    return () => { document.body.style.cursor = previous; };
  }, [!!lift]);

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(
        [...files].map((file) => compressImage(file, { watermarkSrc: showWatermark && addWatermark ? watermarkImage : undefined }))
      );
      const urls = await apiUpload(compressed);
      onChange(single ? urls.slice(0, 1) : [...photos, ...urls].slice(0, max));
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  /** Index of the tile whose center is closest to the pointer. */
  const tileAt = (x: number, y: number, fallback: number) => {
    let best = fallback;
    let bestDist = Infinity;
    tiles.current.slice(0, list.length).forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (!sortable || busy) return;
    if ((event.target as HTMLElement).closest('button')) return; // let the remove button work
    drag.current = { pointerId: event.pointerId, index, x: event.clientX, y: event.clientY, active: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;

    if (!state.active) {
      if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < 5) return;
      state.active = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
      const rect = event.currentTarget.getBoundingClientRect();
      setDragIndex(state.index);
      setPreview(list);
      setLift({
        photo: list[state.index],
        x: event.clientX,
        y: event.clientY,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      });
    }

    event.preventDefault();
    setLift((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));

    const target = tileAt(event.clientX, event.clientY, state.index);
    if (target !== state.index) {
      const next = move(list, state.index, target);
      state.index = target;
      setDragIndex(target);
      setPreview(next);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state || state.pointerId !== event.pointerId) return;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch { /* pointer already released */ }
    const next = preview;
    setDragIndex(null);
    setPreview(null);
    setLift(null);
    if (state.active && next && next.some((p, i) => p !== photos[i])) onChange(next);
  };

  const nudge = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    onChange(move(photos, index, target));
    requestAnimationFrame(() => tiles.current[target]?.focus());
  };

  return (
    <div className="space-y-2">
      {showWatermark && (
        <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted">
          <input
            type="checkbox"
            checked={addWatermark}
            onChange={(event) => setAddWatermark(event.target.checked)}
            className="accent-pink"
          />
          Add watermark
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {list.map((p, index) => {
          const held = dragIndex === index;
          return (
            <div
              key={p}
              ref={(el) => { tiles.current[index] = el; }}
              tabIndex={sortable ? 0 : -1}
              role={sortable ? 'button' : undefined}
              aria-label={sortable ? `Photo ${index + 1} of ${list.length}. Use arrow keys to reorder.` : undefined}
              onPointerDown={(event) => onPointerDown(event, index)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(event) => {
                if (!sortable) return;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); nudge(index, -1); }
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); nudge(index, 1); }
              }}
              className={`relative h-16 w-20 overflow-hidden rounded border bg-surface2 outline-none transition-[transform,opacity,border-color] duration-150 ${
                held
                  ? 'border-2 border-dashed border-pink bg-pink/10'
                  : 'border-edge'
              } ${sortable ? 'cursor-grab touch-none select-none focus-visible:ring-2 focus-visible:ring-pink active:cursor-grabbing' : ''}`}
            >
              {/* While held, this tile is just the landing slot; the photo rides with the cursor. */}
              <img
                src={p}
                alt=""
                draggable={false}
                className={`h-full w-full object-cover transition-opacity duration-150 ${held ? 'opacity-0' : 'opacity-100'}`}
              />
              {sortable && !held && (
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[8px] font-semibold uppercase tracking-wide text-white">
                  {index === 0 ? 'Cover' : index + 1}
                </span>
              )}
              {held && (
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold uppercase tracking-wide text-pink">
                  {index === 0 ? 'Cover' : index + 1}
                </span>
              )}
              {!lift && (
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((x) => x !== p))}
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white hover:bg-rose-600"
                  aria-label="Remove photo"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}
        {(single ? photos.length === 0 : photos.length < max) && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex h-16 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-edge text-muted hover:border-pink/50 hover:text-ink disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            <span className="text-[9px] uppercase tracking-wide">{busy ? 'Uploading' : 'Add'}</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple={!single}
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {sortable && (
        <p className="text-[10px] text-muted">Drag a photo to reorder. The first photo is the cover.</p>
      )}

      {/* The picked-up photo, following the cursor. */}
      {lift && (
        <div
          aria-hidden
          data-drag-ghost
          className="pointer-events-none fixed z-[100] overflow-hidden rounded border-2 border-pink"
          style={{
            left: lift.x - lift.dx,
            top: lift.y - lift.dy,
            width: lift.w,
            height: lift.h,
            transform: 'scale(1.15) rotate(-3deg)',
            transformOrigin: 'center',
            boxShadow: '0 12px 24px -6px rgba(0,0,0,0.45), 0 4px 8px -4px rgba(0,0,0,0.35)',
          }}
        >
          <img src={lift.photo} alt="" draggable={false} className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
