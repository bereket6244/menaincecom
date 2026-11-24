import { MapPin, Phone, Mail, Clock, MessageCircle, Send } from 'lucide-react';
import { useData } from '../lib/useData';
import type { BusinessSettings } from '../lib/types';
import { SysLabel } from '../components/ui';
import { telegramContactUrl, whatsappContactUrl } from '../lib/share';

export function Contact() {
  const { data: business } = useData<BusinessSettings>('/content/business');

  const rows = [
    { icon: Phone, label: 'Phone', value: business?.phone || '+251 94 212 5568', href: `tel:${(business?.phone || '+251942125568').replace(/\s/g, '')}` },
    { icon: Mail, label: 'Email', value: business?.email || 'hello@menainc.com', href: `mailto:${business?.email || 'hello@menainc.com'}` },
    { icon: MapPin, label: 'Studio', value: business?.address || 'Reality Plaza, 1st Floor, Office No. 104, Bole (next to Yougo Church), Addis Ababa' },
    { icon: Clock, label: 'Hours', value: business?.hours || 'Mon–Sat, 9:00–18:00' },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-7 px-4 py-8 sm:py-12">
      <div className="space-y-3">
        <h1 className="font-sans text-3xl font-semibold leading-tight text-ink">Contact Mena</h1>
        <p className="text-base leading-relaxed text-muted">
          Questions about a design, timeline or bulk pricing? Reach us directly — or build an order summary and send it
          via WhatsApp or Telegram in one tap.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <a href={whatsappContactUrl(business)} target="_blank" rel="noreferrer" className="btn-primary min-h-12 px-3 text-sm">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a href={telegramContactUrl(business)} target="_blank" rel="noreferrer" className="btn-outline min-h-12 px-3 text-sm">
          <Send className="h-4 w-4" /> Telegram
        </a>
      </div>
      <div className="divide-y divide-edge rounded-xl border border-edge bg-surface">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="flex items-start gap-4 p-4">
            <Icon className="mt-1 h-5 w-5 shrink-0 text-pink" />
            <div className="min-w-0 space-y-1">
              <SysLabel>{label}</SysLabel>
              <div className="whitespace-pre-line break-words text-base leading-relaxed text-ink">
                {href ? <a href={href} className="hover:text-pink focus-visible:outline-2 focus-visible:outline-pink">{value}</a> : value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
