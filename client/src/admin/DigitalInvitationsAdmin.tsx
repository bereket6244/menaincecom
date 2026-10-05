import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { BusinessSettings, DigitalInviteExample, DigitalInvitePackage, DigitalInvitationsContent } from '../lib/types';
import { Button, Spinner, SysLabel } from '../components/ui';
import { useApp } from '../store/AppContext';

const defaultDigitalInvitations: DigitalInvitationsContent = {
  enabled: true,
  title: 'Digital wedding invitation websites',
  subtitle: '',
  intro: '',
  portfolioUrl: 'https://menaincet.com',
  examples: [
    {
      id: 'yordanos-kaleab',
      title: 'Yordanos & Kaleab',
      url: 'https://menaincet.com/yordanoskaleab/',
      description: '',
    },
    {
      id: 'yeabsra-christian',
      title: 'Yeabsra & Christian',
      url: 'https://menaincet.com/yeabsra-and-christian/',
      description: '',
    },
  ],
  packages: [
    {
      id: 'basic',
      name: 'Basic',
      eyebrow: '',
      description: 'Simple and elegant',
      price: 9000,
      compareAtPrice: null,
      badge: '',
      features: ['Wedding details', '3 photos', '1 venue + map', 'RSVP'],
      footnote: '',
    },
    {
      id: 'standard',
      name: 'Standard',
      eyebrow: '',
      description: 'Best for most weddings',
      price: 13000,
      compareAtPrice: null,
      badge: 'Most Popular',
      features: ['Everything in Basic', '10 photos', '2 venues + map', '2 languages + timeline'],
      footnote: '',
    },
    {
      id: 'premium',
      name: 'Premium',
      eyebrow: '',
      description: 'More personal and complete',
      price: 16000,
      compareAtPrice: null,
      badge: '',
      features: ['Everything in Standard', 'Unlimited photos', 'Video + couple profile', 'Gift info'],
      footnote: '',
    },
    {
      id: 'ultimate',
      name: 'Ultimate',
      eyebrow: '',
      description: 'For full guest management',
      price: 18500,
      compareAtPrice: null,
      badge: '',
      features: ['Everything in Premium', '3+ languages', 'QR code', 'Live guest check-in'],
      footnote: '',
    },
  ],
};

export function DigitalInvitationsAdmin() {
  const { data: content, loading } = useData<BusinessSettings>('/content/business');
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<BusinessSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (content && !draft) {
      setDraft({
        ...content,
        key: 'business',
        digitalInvitations: {
          ...defaultDigitalInvitations,
          ...(content.digitalInvitations || {}),
          examples: content.digitalInvitations?.examples?.length ? content.digitalInvitations.examples : defaultDigitalInvitations.examples,
          packages: content.digitalInvitations?.packages?.length ? content.digitalInvitations.packages : defaultDigitalInvitations.packages,
        },
      });
    }
  }, [content, draft]);

  if (loading && !draft) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!draft) return null;

  const digital = draft.digitalInvitations || defaultDigitalInvitations;
  const setDigital = (patch: Partial<DigitalInvitationsContent>) => {
    setDraft({ ...draft, digitalInvitations: { ...digital, ...patch } });
  };

  const save = async () => {
    setBusy(true);
    try {
      const { id, ...payload } = draft;
      await apiSend('PUT', '/admin/content/business', payload);
      toast('success', 'Digital invitation settings saved.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateExample = (index: number, patch: Partial<DigitalInviteExample>) => {
    setDigital({ examples: digital.examples.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  };
  const addExample = () => {
    setDigital({
      examples: [
        ...digital.examples,
        { id: `example-${Date.now()}`, title: 'New invitation', url: 'https://menaincet.com/', description: '' },
      ],
    });
  };
  const removeExample = (index: number) => {
    setDigital({ examples: digital.examples.filter((_item, i) => i !== index) });
  };
  const updatePackage = (index: number, patch: Partial<DigitalInvitePackage>) => {
    setDigital({ packages: digital.packages.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  };
  const addPackage = () => {
    setDigital({
      packages: [
        ...digital.packages,
        {
          id: `package-${Date.now()}`,
          name: 'New package',
          eyebrow: 'Custom',
          description: '',
          price: 0,
          compareAtPrice: null,
          badge: '',
          features: [''],
          footnote: '',
        },
      ],
    });
  };
  const removePackage = (index: number) => {
    setDigital({ packages: digital.packages.filter((_item, i) => i !== index) });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">Digital invitations</h1>
          <p className="text-[11px] text-muted">Manage the public digital invitation page, showcase examples, and package pricing.</p>
        </div>
        <Button onClick={save} busy={busy} disabled={!online}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border border-edge bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SysLabel>Page settings</SysLabel>
            <p className="mt-1 text-[11px] text-muted">Controls the public /digital-invitations page and footer portfolio link.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink">
            <input
              type="checkbox"
              checked={digital.enabled}
              onChange={(e) => setDigital({ enabled: e.target.checked })}
              className="h-4 w-4 accent-pink"
            />
            Enabled
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <SysLabel>Page title</SysLabel>
            <input value={digital.title} onChange={(e) => setDigital({ title: e.target.value })} className="field mt-1" />
          </div>
          <div>
            <SysLabel>Portfolio URL</SysLabel>
            <input value={digital.portfolioUrl} onChange={(e) => setDigital({ portfolioUrl: e.target.value })} className="field mt-1" placeholder="https://menaincet.com" />
          </div>
        </div>
        <div>
          <SysLabel>Subtitle</SysLabel>
          <textarea value={digital.subtitle} onChange={(e) => setDigital({ subtitle: e.target.value })} rows={2} className="field mt-1 resize-y" />
        </div>
        <div>
          <SysLabel>Intro copy</SysLabel>
          <textarea value={digital.intro} onChange={(e) => setDigital({ intro: e.target.value })} rows={2} className="field mt-1 resize-y" />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
        <div className="flex items-center justify-between">
          <SysLabel>Showcase examples</SysLabel>
          <Button onClick={addExample} variant="outline"><Plus className="h-3.5 w-3.5" /> Add example</Button>
        </div>
        {digital.examples.map((example, index) => (
          <div key={example.id || index} className="rounded-lg border border-edge bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-ink">Example {index + 1}</div>
              <Button onClick={() => removeExample(index)} variant="ghost" className="text-rose-600 hover:text-rose-700">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <SysLabel>Title</SysLabel>
                <input value={example.title} onChange={(e) => updateExample(index, { title: e.target.value })} className="field mt-1" />
              </div>
              <div>
                <SysLabel>URL</SysLabel>
                <input value={example.url} onChange={(e) => updateExample(index, { url: e.target.value })} className="field mt-1" />
              </div>
            </div>
            <div className="mt-3">
              <SysLabel>Description</SysLabel>
              <textarea value={example.description} onChange={(e) => updateExample(index, { description: e.target.value })} rows={2} className="field mt-1 resize-y" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <SysLabel>Packages</SysLabel>
            <p className="mt-1 text-[11px] text-muted">Prices, comparison prices, badges, and feature lists shown to customers.</p>
          </div>
          <Button onClick={addPackage} variant="outline"><Plus className="h-3.5 w-3.5" /> Add package</Button>
        </div>
        {digital.packages.map((pkg, index) => (
          <div key={pkg.id || index} className="rounded-lg border border-edge bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-ink">{pkg.name || `Package ${index + 1}`}</div>
              <Button onClick={() => removePackage(index)} variant="ghost" className="text-rose-600 hover:text-rose-700">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <SysLabel>Name</SysLabel>
                <input value={pkg.name} onChange={(e) => updatePackage(index, { name: e.target.value })} className="field mt-1" />
              </div>
              <div>
                <SysLabel>Eyebrow</SysLabel>
                <input value={pkg.eyebrow} onChange={(e) => updatePackage(index, { eyebrow: e.target.value })} className="field mt-1" />
              </div>
              <div>
                <SysLabel>Badge</SysLabel>
                <input value={pkg.badge || ''} onChange={(e) => updatePackage(index, { badge: e.target.value })} className="field mt-1" placeholder="Most chosen" />
              </div>
            </div>
            <div className="mt-3">
              <SysLabel>Price (ETB)</SysLabel>
              <input
                type="number"
                value={pkg.price}
                onChange={(e) => updatePackage(index, { price: Math.max(0, Number(e.target.value) || 0) })}
                className="field mt-1"
              />
            </div>
            <div className="mt-3">
              <SysLabel>Description</SysLabel>
              <textarea value={pkg.description} onChange={(e) => updatePackage(index, { description: e.target.value })} rows={2} className="field mt-1 resize-y" />
            </div>
            <div className="mt-3">
              <SysLabel>Features</SysLabel>
              <textarea
                value={(pkg.features || []).join('\n')}
                onChange={(e) => updatePackage(index, { features: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })}
                rows={5}
                className="field mt-1 resize-y"
                placeholder="One feature per line"
              />
            </div>
            <div className="mt-3">
              <SysLabel>Footnote</SysLabel>
              <input value={pkg.footnote} onChange={(e) => updatePackage(index, { footnote: e.target.value })} className="field mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
