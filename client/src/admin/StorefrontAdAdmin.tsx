import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import type { BusinessSettings, StorefrontAd } from '../lib/types';
import { AdStrip, EXAMPLE_AD, validAdHref } from '../components/AdStrip';
import { Button, Spinner } from '../components/ui';
import { useApp } from '../store/AppContext';

const FIELDS = [
  ['label', 'Small label (optional)', 30, 'Leave blank to remove the small label above the headline.'],
  ['title', 'Headline', 80, 'Your main offer, in one short sentence.'],
  ['description', 'Supporting text', 120, 'Extra detail shown on wide desktop screens.'],
  ['buttonText', 'Button text', 20, 'A short action such as Explore or Shop now.'],
  ['href', 'Destination link', 500, 'Use /catalog, /digital-invitations, /product/product-id, or a full https:// link.'],
] as const;

export function StorefrontAdAdmin() {
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<StorefrontAd | null>(null);
  const [saved, setSaved] = useState<StorefrontAd | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<'mobile' | 'desktop'>('desktop');

  useEffect(() => {
    let active = true;
    apiGet<BusinessSettings>('/content/business').then((content) => {
      if (!active) return;
      const ad = { ...EXAMPLE_AD, ...(content.storefrontAd ?? {}) };
      setDraft(ad);
      setSaved(ad);
    }).catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  if (!draft) return error
    ? <p role="alert" className="text-sm">{error} Reload this page to retry.</p>
    : <div className="flex justify-center py-16"><Spinner /></div>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const validation = draft.enabled && (!draft.title.trim() || !draft.buttonText.trim() || !draft.href.trim())
    ? 'Add a headline, button text, and destination before publishing.'
    : draft.href.trim() && !validAdHref(draft.href.trim())
      ? 'Enter a shop path beginning with / or a full http:// or https:// link.' : '';

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (validation || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiSend<BusinessSettings>('PUT', '/admin/content/business', { storefrontAd: draft });
      const ad = result.storefrontAd!;
      setDraft(ad);
      setSaved(ad);
      toast('success', ad.enabled ? 'Storefront ad published.' : 'Storefront ad hidden.');
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  };

  return <div className="min-h-0 overflow-y-auto">
    <form onSubmit={save} className="max-w-5xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-bold">Storefront ad</h1>
          <p className="mt-1 text-xs text-muted">Edit your message, preview it, then publish to the mobile and desktop storefront.</p>
        </div>
        <Link to="/catalog" target="_blank" className="text-xs font-semibold text-pink">View storefront</Link>
      </div>
      <fieldset disabled={busy} className="max-w-2xl space-y-4 rounded-lg border border-edge bg-surface p-4">
        <legend className="px-1 text-xs font-bold">1. Edit the ad</legend>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          Show ad on the storefront
        </label>
        {FIELDS.map(([key, label, limit, hint]) => <label key={key} className="block text-xs font-medium">
          <span className="flex justify-between gap-3"><span>{label}</span><span className="text-muted">{(draft[key] ?? '').length}/{limit}</span></span>
          <input className="field mt-1" maxLength={limit} value={draft[key] ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
          <span className="mt-1 block text-[11px] font-normal text-muted">{hint}</span>
        </label>)}
      </fieldset>
      <section className="space-y-3" aria-label="Ad preview">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold">2. Preview</h2>
          {(['desktop', 'mobile'] as const).map((mode) => <button type="button" key={mode} aria-pressed={preview === mode} onClick={() => setPreview(mode)} className={`rounded border px-3 py-1 text-xs capitalize ${preview === mode ? 'border-pink text-pink' : 'border-edge'}`}>{mode}</button>)}
        </div>
        <p className="text-xs text-muted">{draft.enabled ? 'Preview only. Changes go live when you publish.' : 'The ad will be hidden after you save. Your text is kept for reuse.'}</p>
        <div className="overflow-x-auto rounded-lg border border-edge bg-surface p-2">
          <div className={`pointer-events-none overflow-hidden rounded ${preview === 'mobile' ? 'w-[375px]' : 'min-w-[800px] w-full'}`} inert>
            <AdStrip ad={{ ...draft, enabled: true }} previewMode={preview} />
          </div>
        </div>
      </section>
      {(validation || error) && <p role="alert" className="text-sm text-rose-600">{validation || error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" busy={busy} disabled={!online || Boolean(validation)}><Save className="h-3.5 w-3.5" />{draft.enabled ? 'Publish ad' : 'Save hidden ad'}</Button>
        <Button type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(''); }}>Discard changes</Button>
        <span className="text-xs text-muted" role="status">{dirty ? 'Unpublished changes' : saved?.enabled ? 'Current ad is visible' : 'Current ad is hidden'}</span>
      </div>
    </form>
  </div>;
}
