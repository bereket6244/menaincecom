import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import watermarkImage from '../assets/mena-watermark.png';
import { apiUpload } from '../lib/api';
import { compressImage } from '../lib/utils';
import { useApp } from '../store/AppContext';

/**
 * Photo picker: preserves normal uploads when possible, and only re-encodes
 * when resizing or applying a watermark is needed.
 */
export function PhotoUpload({
  photos, onChange, max = 8, single,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  single?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [addWatermark, setAddWatermark] = useState(false);
  const { toast } = useApp();

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(
        [...files].map((file) => compressImage(file, { watermarkSrc: addWatermark ? watermarkImage : undefined }))
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

  return (
    <div className="space-y-2">
      <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted">
        <input
          type="checkbox"
          checked={addWatermark}
          onChange={(event) => setAddWatermark(event.target.checked)}
          className="accent-pink"
        />
        Add watermark
      </label>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p} className="relative h-16 w-20 overflow-hidden rounded border border-edge bg-surface2">
            <img src={p} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((x) => x !== p))}
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white hover:bg-rose-600"
              aria-label="Remove photo"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
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
    </div>
  );
}
