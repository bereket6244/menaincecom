import { Check, Crown, ExternalLink, Gem, Heart, Leaf, MessageCircle, MessageSquareText, Phone, Send } from 'lucide-react';
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

function formatEtb(value: number) {
  return `ETB ${Math.max(0, Number(value) || 0).toLocaleString()}`;
}

function buildPackageMessage(pkg: DigitalInvitePackage) {
  return [
    'Selam Mena Inc, I want to order a digital invitation website.',
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

function packagePresentation(pkg: DigitalInvitePackage, index: number) {
  const key = `${pkg.id || ''} ${pkg.name || ''}`.toLowerCase();
  if (key.includes('standard')) return { Icon: Heart, color: '#ee317b', tint: '#fff1f6', popular: true };
  if (key.includes('premium')) return { Icon: Gem, color: '#ff7a1a', tint: '#fff3e8', popular: false };
  if (key.includes('ultimate')) return { Icon: Crown, color: '#f58220', tint: '#fff4e8', popular: false };
  if (key.includes('basic')) return { Icon: Leaf, color: '#319b5a', tint: '#f0fbf4', popular: false };
  const fallback = [
    { Icon: Leaf, color: '#319b5a', tint: '#f0fbf4', popular: false },
    { Icon: Heart, color: '#ee317b', tint: '#fff1f6', popular: false },
    { Icon: Gem, color: '#ff7a1a', tint: '#fff3e8', popular: false },
    { Icon: Crown, color: '#f58220', tint: '#fff4e8', popular: false },
  ];
  return fallback[index % fallback.length];
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((pkg, index) => {
            const presentation = packagePresentation(pkg, index);
            const highlighted = Boolean(pkg.badge) || presentation.popular;
            const { Icon } = presentation;
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
                  'relative flex min-h-[390px] flex-col rounded-2xl border bg-white px-5 pb-5 pt-8 text-center shadow-[0_16px_42px_rgba(28,26,25,0.07)]',
                  highlighted ? 'border-pink bg-gradient-to-b from-[#fff5f9] to-white shadow-[0_18px_46px_rgba(238,49,123,0.16)]' : 'border-edge/80'
                )}
              >
                {highlighted && (
                  <div className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-pink px-5 py-2 text-[13px] font-extrabold text-white shadow-[0_8px_20px_rgba(238,49,123,0.28)]">
                    <Crown className="h-4 w-4 fill-white" />
                    {pkg.badge || 'Most Popular'}
                  </div>
                )}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: presentation.tint }}>
                  <Icon className="h-8 w-8" style={{ color: presentation.color }} />
                </div>
                <h3 className="mt-4 font-serif text-[31px] font-semibold leading-none text-[#201433]">{pkg.name}</h3>
                {pkg.description && <p className="mt-2 min-h-[24px] text-[15px] font-semibold text-[#6e7795]">{pkg.description}</p>}
                <div className="mx-auto mt-4 h-px w-14 bg-pink/20" />
                <div className="mt-6 flex items-baseline justify-center gap-2">
                  <span className={cx('text-sm font-extrabold', highlighted ? 'text-pink' : 'text-[#ff7a1a]')}>ETB</span>
                  <span className={cx('font-serif text-[45px] font-semibold leading-none', highlighted ? 'text-pink' : 'text-[#ff7a1a]')}>
                    {Math.max(0, Number(pkg.price) || 0).toLocaleString()}
                  </span>
                </div>
                <ul className="mx-auto mt-7 flex-1 space-y-3 text-left text-[15px] font-semibold leading-5 text-[#6e7795]">
                  {(pkg.features || []).map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white', highlighted ? 'bg-pink' : 'bg-[#39a766]')}>
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <details className="group mt-7">
                  <summary className="mena-press flex h-11 w-full cursor-pointer list-none items-center justify-center rounded-full bg-pink px-5 text-[14px] font-extrabold text-white shadow-[0_10px_24px_rgba(238,49,123,0.2)] hover:bg-pink-dim [&::-webkit-details-marker]:hidden">
                    Order {pkg.name}
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {orderLinks.map(({ id, label, icon: Icon, href, external, className }) => (
                      <a
                        key={id}
                        href={href}
                        target={external ? '_blank' : undefined}
                        rel={external ? 'noreferrer' : undefined}
                        className={cx('mena-press inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-extrabold', className)}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </a>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
