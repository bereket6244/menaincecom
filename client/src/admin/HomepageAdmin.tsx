import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { HomepageContent } from '../lib/types';
import { Button, Spinner, SysLabel } from '../components/ui';
import { PhotoUpload } from './PhotoUpload';
import { useApp } from '../store/AppContext';

export function HomepageAdmin() {
  const { data: content, loading } = useData<HomepageContent>('/content/homepage');
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<HomepageContent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (content && !draft) setDraft({ ...content, key: 'homepage' });
  }, [content, draft]);

  if (loading && !draft) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!draft) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { id, ...payload } = draft;
      await apiSend('PUT', '/admin/content/homepage', payload);
      toast('success', 'Homepage content published.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold">Homepage content</h1>
        <Button onClick={save} busy={busy} disabled={!online}>
          <Save className="h-3.5 w-3.5" /> Publish
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
        <div>
          <SysLabel>Hero title</SysLabel>
          <input value={draft.heroTitle || ''} onChange={(e) => setDraft({ ...draft, heroTitle: e.target.value })} className="field mt-1" />
        </div>
        <div>
          <SysLabel>Hero subtitle</SysLabel>
          <textarea value={draft.heroSubtitle || ''} onChange={(e) => setDraft({ ...draft, heroSubtitle: e.target.value })} rows={2} className="field mt-1 resize-y" />
        </div>
        <div>
          <SysLabel>Hero button text</SysLabel>
          <input value={draft.heroCta || ''} onChange={(e) => setDraft({ ...draft, heroCta: e.target.value })} className="field mt-1" />
        </div>
        <div>
          <SysLabel>Hero image</SysLabel>
          <div className="mt-1">
            <PhotoUpload single photos={draft.heroImage ? [draft.heroImage] : []} onChange={(p) => setDraft({ ...draft, heroImage: p[0] || '' })} />
          </div>
        </div>
        <div>
          <SysLabel>Announcement banner (optional)</SysLabel>
          <input
            value={draft.noticeText || ''}
            onChange={(e) => setDraft({ ...draft, noticeText: e.target.value })}
            className="field mt-1"
            placeholder="e.g. Order 3 weeks before your wedding date for foil printing."
          />
        </div>
      </div>
    </div>
  );
}
