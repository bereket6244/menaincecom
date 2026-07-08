import { useState } from 'react';
import { Plus, Trash2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import watermarkImage from '../assets/mena-watermark.png';
import { useData } from '../lib/useData';
import { apiSend, apiUpload } from '../lib/api';
import type { GalleryItem } from '../lib/types';
import { Button, EmptyState, Spinner } from '../components/ui';
import { compressImage } from '../lib/utils';
import { useApp } from '../store/AppContext';

export function GalleryAdmin() {
  const { data: items, loading, reload } = useData<GalleryItem[]>('/admin/gallery');
  const { toast, online } = useApp();
  const [uploading, setUploading] = useState(false);
  const [addWatermark, setAddWatermark] = useState(false);

  const sorted = [...(items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const compressed = await Promise.all(
        [...files].map((file) => compressImage(file, { watermarkSrc: addWatermark ? watermarkImage : undefined }))
      );
      const urls = await apiUpload(compressed);
      await Promise.all(
        urls.map((photo, i) =>
          apiSend('POST', '/admin/gallery', { photo, caption: '', sortOrder: sorted.length + i })
        )
      );
      toast('success', `${urls.length} photo(s) added to the gallery.`);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const saveCaption = async (item: GalleryItem, caption: string) => {
    if (caption === item.caption) return;
    try {
      await apiSend('PUT', `/admin/gallery/${item.id}`, { caption });
      toast('success', 'Caption saved.');
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const remove = async (item: GalleryItem) => {
    try {
      await apiSend('DELETE', `/admin/gallery/${item.id}`);
      toast('success', 'Photo removed.');
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  const move = async (item: GalleryItem, dir: -1 | 1) => {
    const idx = sorted.findIndex((g) => g.id === item.id);
    const other = sorted[idx + dir];
    if (!other) return;
    try {
      await Promise.all([
        apiSend('PUT', `/admin/gallery/${item.id}`, { sortOrder: other.sortOrder ?? idx + dir }),
        apiSend('PUT', `/admin/gallery/${other.id}`, { sortOrder: item.sortOrder ?? idx }),
      ]);
      reload();
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">Gallery / Portfolio</h1>
          <p className="text-[11px] text-muted">Photos are optimized in high quality before upload.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted">
            <input
              type="checkbox"
              checked={addWatermark}
              onChange={(event) => setAddWatermark(event.target.checked)}
              className="accent-pink"
            />
            Add watermark
          </label>
          <label className={online ? 'cursor-pointer' : 'pointer-events-none opacity-40'}>
            <span className="inline-flex items-center gap-1.5 rounded bg-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-dim">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Upload photos
            </span>
            <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
      </div>

      {loading && !items ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : sorted.length === 0 ? (
        <EmptyState>No portfolio photos yet — upload the first batch.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {sorted.map((g) => (
            <div key={g.id} className="overflow-hidden rounded-md border border-edge bg-surface">
              <div className="aspect-[4/3] bg-surface2">
                <img src={g.photo} alt={g.caption} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-1.5 p-2">
                <input
                  defaultValue={g.caption}
                  placeholder="Caption…"
                  onBlur={(e) => saveCaption(g, e.target.value)}
                  className="field py-1 text-[11px]"
                />
                <div className="flex justify-between">
                  <div className="flex gap-0.5">
                    <Button variant="ghost" className="!px-1.5 !py-1" onClick={() => move(g, -1)} title="Move earlier"><ArrowLeft className="h-3 w-3" /></Button>
                    <Button variant="ghost" className="!px-1.5 !py-1" onClick={() => move(g, 1)} title="Move later"><ArrowRight className="h-3 w-3" /></Button>
                  </div>
                  <Button variant="ghost" className="!px-1.5 !py-1 hover:!text-rose-400" onClick={() => remove(g)} title="Delete"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
