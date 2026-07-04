import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useData } from '../lib/useData';
import type { BusinessSettings } from '../lib/types';
import { SysLabel } from '../components/ui';

export function Contact() {
  const { data: business } = useData<BusinessSettings>('/content/business');

  const rows = [
    { icon: Phone, label: 'Phone', value: business?.phone || '+251 92 963 9939', href: `tel:${(business?.phone || '+251929639939').replace(/\s/g, '')}` },
    { icon: Mail, label: 'Email', value: business?.email || 'hello@menainc.com', href: `mailto:${business?.email || 'hello@menainc.com'}` },
    { icon: MapPin, label: 'Studio', value: business?.address || 'Reality Plaza, 1st Floor, Office No. 104, Bole (next to Yougo Church), Addis Ababa' },
    { icon: Clock, label: 'Hours', value: business?.hours || 'Mon–Sat, 9:00–18:00' },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-base font-bold">Contact</h1>
        <p className="text-xs text-muted">
          Questions about a design, timeline or bulk pricing? Reach us directly — or build an order summary and send it
          via WhatsApp or Telegram in one tap.
        </p>
      </div>
      <div className="divide-y divide-edge rounded-lg border border-edge bg-surface">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="flex items-center gap-3 p-3">
            <Icon className="h-4 w-4 shrink-0 text-pink" />
            <div>
              <SysLabel>{label}</SysLabel>
              <div className="whitespace-pre-line text-sm">
                {href ? <a href={href} className="hover:text-pink">{value}</a> : value}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted">
        Mena INK Trading PLC. These details are editable from Admin → Business.
      </p>
    </div>
  );
}
