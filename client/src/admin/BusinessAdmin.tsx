import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useData } from '../lib/useData';
import { apiSend } from '../lib/api';
import type { BusinessSettings } from '../lib/types';
import { Button, Spinner, SysLabel } from '../components/ui';
import { useApp } from '../store/AppContext';

export function BusinessAdmin() {
  const { data: content, loading } = useData<BusinessSettings>('/content/business');
  const { toast, online } = useApp();
  const [draft, setDraft] = useState<BusinessSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (content && !draft) setDraft({ ...content, key: 'business' });
  }, [content, draft]);

  if (loading && !draft) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!draft) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { id, ...payload } = draft;
      await apiSend('PUT', '/admin/content/business', payload);
      toast('success', 'Business settings saved.');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: keyof BusinessSettings, opts?: { placeholder?: string; textarea?: boolean; hint?: string }) => (
    <div>
      <SysLabel>{label}</SysLabel>
      {opts?.textarea ? (
        <textarea
          value={String(draft[key] ?? '')}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          rows={2}
          className="field mt-1 resize-y"
          placeholder={opts?.placeholder}
        />
      ) : (
        <input
          value={String(draft[key] ?? '')}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          className="field mt-1"
          placeholder={opts?.placeholder}
        />
      )}
      {opts?.hint && <p className="mt-0.5 text-[10px] text-muted">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">Business settings</h1>
          <p className="text-[11px] text-muted">Contact details, order-forwarding numbers, payment account and pickup location.</p>
        </div>
        <Button onClick={save} busy={busy} disabled={!online}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
        <SysLabel>Contact page</SysLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Phone', 'phone', { placeholder: '+251 92 963 9939', hint: 'Also the number customers\' SMS orders are sent to.' })}
          {field('Email', 'email', { placeholder: 'hello@menainc.com' })}
        </div>
        {field('Studio address', 'address', { textarea: true })}
        {field('Opening hours', 'hours', { placeholder: 'Mon–Sat, 9:00–18:00' })}
      </div>

      <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
        <SysLabel>Order forwarding</SysLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('WhatsApp number', 'whatsappNumber', {
            placeholder: '251929639939',
            hint: 'Digits only, with country code — customers\' orders open a wa.me chat to this number.',
          })}
          {field('Telegram handle or phone', 'telegramHandle', {
            placeholder: '@menainc or +251929639939',
            hint: 'A @username is most reliable; phone numbers only work if the account is discoverable by phone.',
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-edge bg-surface p-4">
        <SysLabel>Payment &amp; pickup (included in the order message)</SysLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Account name', 'paymentAccountName', { placeholder: 'CBE (Bereket Girma)' })}
          {field('Account number', 'paymentAccountNumber', { placeholder: '1000530092732' })}
        </div>
        {field('Pickup location', 'pickupLocation', { textarea: true })}
        <div>
          <SysLabel>Printed sample price (ETB)</SysLabel>
          <input
            type="number"
            min={0}
            value={draft.samplePriceEtb ?? ''}
            onChange={(e) => setDraft({ ...draft, samplePriceEtb: e.target.value === '' ? null : Number(e.target.value) })}
            className="field mt-1"
            placeholder="120"
          />
        </div>
      </div>
    </div>
  );
}
