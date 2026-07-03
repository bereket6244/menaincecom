import { useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useData } from '../lib/useData';
import type { GalleryItem } from '../lib/types';
import { EmptyState, Spinner } from '../components/ui';

export function Gallery() {
  const { data: items, loading } = useData<GalleryItem[]>('/gallery');
  const [open, setOpen] = useState<GalleryItem | null>(null);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-base font-bold">Gallery</h1>
        <p className="text-xs text-muted">A selection of invitations and suites we have produced for past clients.</p>
      </div>

      {loading && !items ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !items || items.length === 0 ? (
        <EmptyState>Portfolio photos are coming soon.</EmptyState>
      ) : (
        <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 [&>*]:mb-2">
          {items.map((g) => (
            <button key={g.id} onClick={() => setOpen(g)} className="block w-full overflow-hidden rounded-md border border-edge">
              <img src={g.photo} alt={g.caption} loading="lazy" className="w-full" />
              {g.caption && <div className="bg-surface p-2 text-left text-[11px] text-muted">{g.caption}</div>}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setOpen(null)}
          >
            <button className="absolute right-4 top-4 text-muted hover:text-ink" aria-label="Close">
              <X className="h-6 w-6" />
            </button>
            <div className="max-h-full max-w-3xl">
              <img src={open.photo} alt={open.caption} className="max-h-[85vh] w-auto rounded" />
              {open.caption && <p className="mt-2 text-center text-xs text-muted">{open.caption}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
