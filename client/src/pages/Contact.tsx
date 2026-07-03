import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { SysLabel } from '../components/ui';

const ROWS = [
  { icon: Phone, label: 'Phone', value: '+251 9XX XXX XXX' },
  { icon: Mail, label: 'Email', value: 'hello@menainc.com' },
  { icon: MapPin, label: 'Studio', value: 'Addis Ababa, Ethiopia' },
  { icon: Clock, label: 'Hours', value: 'Mon–Sat, 9:00–18:00' },
];

export function Contact() {
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
        {ROWS.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 p-3">
            <Icon className="h-4 w-4 shrink-0 text-pink" />
            <div>
              <SysLabel>{label}</SysLabel>
              <div className="text-sm">{value}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted">
        Mena INK Trading PLC. Update these details from the admin panel homepage settings or directly in this page.
      </p>
    </div>
  );
}
