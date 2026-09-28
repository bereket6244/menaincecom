import { ExternalLink, MessageCircle, MessageSquareText, Phone, Send } from 'lucide-react';
import { useData } from '../lib/useData';
import type { BusinessSettings, DigitalInvitePackage, DigitalInvitationsContent } from '../lib/types';
import { smsOrderUrl, telegramOrderUrl, whatsappOrderUrl } from '../lib/share';
import { assetUrl, cx } from '../lib/utils';

const FALLBACK_DIGITAL_INVITATIONS: DigitalInvitationsContent = {
  enabled: true,
  title: 'Digital wedding invitation websites',
  subtitle: '',
  intro: '',
  portfolioUrl: 'https://menaincet.com',
  examples: [
    { id: 'yordanos-kaleab', title: 'Yordanos & Kaleab', url: 'https://menaincet.com/yordanoskaleab/', description: '' },
    { id: 'yeabsra-christian', title: 'Yeabsra & Christian', url: 'https://menaincet.com/yeabsrachristian', description: '' },
  ],
  packages: [
    {
      id: 'basic',
      name: 'Basic',
      eyebrow: '',
      description: '',
      price: 12000,
      compareAtPrice: null,
      badge: '',
      features: ['Basic Information', 'Photo Gallery (3 Photos)', '1 Location (Map Point)', 'Countdown', 'RSVP Form', '1 Language Support'],
      footnote: '',
    },
    {
      id: 'standard',
      name: 'Standard',
      eyebrow: '',
      description: '',
      price: 16000,
      compareAtPrice: null,
      badge: '',
      features: ['Basic Information', 'Photo Gallery (10 Photos)', '2 Location (Map Point)', 'Countdown', 'RSVP Form', '2 Language Support', 'Timeline'],
      footnote: '',
    },
    {
      id: 'premium',
      name: 'Premium',
      eyebrow: '',
      description: '',
      price: 19000,
      compareAtPrice: null,
      badge: 'Featured',
      features: ['Basic Information', 'Unlimited Photo', '3 Location (Map Point)', 'Countdown', 'RSVP Form', '2 Language Support', 'Timeline', 'Video', 'Bride & Groom Profile', 'Gift Ideas'],
      footnote: '',
    },
    {
      id: 'ultimate',
      name: 'Ultimate',
      eyebrow: '',
      description: '',
      price: 28500,
      compareAtPrice: null,
      badge: '',
      features: ['Basic Information', 'Unlimited Photo', '3+ Location (Map Point)', 'Countdown', 'RSVP Form', '3+ Language Support', 'Timeline', 'Video', 'Bride & Groom Profile', 'Gift Ideas', 'QR Code', 'Live Guest Check In'],
      footnote: '',
    },
  ],
};

function formatEtb(value: number) {
  return `ETB ${Math.max(0, Number(value) || 0).toLocaleString()}`;
}

function buildPackageMessage(pkg: DigitalInvitePackage) {
  return [
    'Selam Mena INK, I want to order a digital invitation website.',
    `Package: ${pkg.name}`,
    `Price: ${formatEtb(pkg.price)}`,
    '',
    'Please contact me with the next steps.',
  ].join('\n');
}

function callUrl(business: BusinessSettings | null) {
  const number = (business?.phone || business?.whatsappNumber || '').replace(/[^\d+]/g, '');
  return number ? `tel:${number.startsWith('+') ? number : `+${number}`}` : 'tel:+251929639939';
}

function initials(title: string) {
  return (title || 'MI')
    .split(/\s*&\s*|\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
}

function previewImage(example: { id?: string; url: string }) {
  const key = `${example.id || ''} ${example.url}`.toLowerCase();
  if (key.includes('yordanos') || key.includes('kaleab')) return assetUrl('digital-invites/yordanos-kaleab.webp');
  if (key.includes('yeabsra') || key.includes('christian')) return assetUrl('digital-invites/yeabsra-christian.webp');
  return '';
}

export function DigitalInvitations() {
  const { data: business } = useData<BusinessSettings>('/content/business');
  const content = business?.digitalInvitations || FALLBACK_DIGITAL_INVITATIONS;
  const packages = content.packages?.length ? content.packages : FALLBACK_DIGITAL_INVITATIONS.packages;
  const examples = content.examples?.length ? content.examples : FALLBACK_DIGITAL_INVITATIONS.examples;

  if (content.enabled === false) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
        <h1 className="font-serif text-4xl text-ink">Digital invitations are coming soon</h1>
      </section>
    );
  }

  return (
    <div className="bg-bg">
      <section className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <h1 className="max-w-3xl font-serif text-[44px] leading-[0.98] text-ink sm:text-[64px]">
          {content.title || FALLBACK_DIGITAL_INVITATIONS.title}
        </h1>
      </section>

      <section id="examples" className="border-y border-edge bg-white py-9">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">
          <h2 className="mb-5 font-serif text-4xl text-ink">Sample websites</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {examples.map((example, idx) => {
              const preview = previewImage(example);
              return (
                <a
                  key={example.id || example.url || idx}
                  href={example.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-edge bg-bg transition hover:border-pink/50 hover:bg-white"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#f8efe8]">
                    {preview ? (
                      <img
                        src={preview}
                        alt={`${example.title} website preview`}
                        loading="eager"
                        decoding="async"
                        className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                        <div className="font-serif text-5xl text-pink">{initials(example.title)}</div>
                        <div className="mt-2 font-serif text-2xl text-ink">{example.title}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 p-3">
                    <span className="font-extrabold text-ink">{example.title}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-pink px-3 py-1.5 text-xs font-extrabold text-pink">
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section id="packages" className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 lg:px-10">
        <h2 className="mb-7 font-serif text-4xl text-ink">Package plans</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {packages.map((pkg) => {
            const orderMessage = buildPackageMessage(pkg);
            const orderLinks = [
              { id: 'telegram', label: 'Telegram', icon: Send, href: telegramOrderUrl(business, orderMessage), external: true, className: 'bg-[#2b93d6] text-white hover:bg-[#237dbc]' },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: whatsappOrderUrl(business, orderMessage), external: true, className: 'bg-[#25a34f] text-white hover:bg-[#1f8b43]' },
              { id: 'sms', label: 'SMS', icon: MessageSquareText, href: smsOrderUrl(business, orderMessage), external: false, className: 'border border-pink bg-white text-pink hover:bg-pink/5' },
              { id: 'call', label: 'Call', icon: Phone, href: callUrl(business), external: false, className: 'border border-green bg-white text-green hover:bg-green/5' },
            ];
            return (
              <article
                key={pkg.id}
                className={cx(
                  'flex flex-col rounded-2xl border p-6 text-center shadow-[0_14px_40px_rgba(28,26,25,0.06)]',
                  pkg.name.toLowerCase() === 'premium'
                    ? 'border-[#ff74ad] bg-[#ff74ad] text-white'
                    : 'border-[#4a1730]/50 bg-white text-ink'
                )}
              >
                <h3 className={cx('font-serif text-3xl', pkg.name.toLowerCase() === 'premium' ? 'text-[#ffc77f]' : 'text-[#4a1730]')}>{pkg.name}</h3>
                <div className="mt-7 flex items-baseline justify-center gap-2">
                  <span className={cx('text-sm font-extrabold', pkg.name.toLowerCase() === 'premium' ? 'text-white' : 'text-[#ffb45f]')}>ETB</span>
                  <span className={cx('font-serif text-5xl font-semibold', pkg.name.toLowerCase() === 'premium' ? 'text-white' : 'text-[#ffbd71]')}>
                    {Math.max(0, Number(pkg.price) || 0).toLocaleString()}
                  </span>
                </div>
                <ul className={cx('mx-auto mt-7 flex-1 space-y-1.5 text-base leading-7', pkg.name.toLowerCase() === 'premium' ? 'text-white' : 'text-ink/70')}>
                  {(pkg.features || []).map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {orderLinks.map(({ id, label, icon: Icon, href, external, className }) => (
                    <a
                      key={id}
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                      className={cx('mena-press inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold', className)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
