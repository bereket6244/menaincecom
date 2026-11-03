import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Crown, Gem, Heart, Leaf, MessageCircle, MessageSquareText, Phone, Send } from 'lucide-react';
import { useData } from '../lib/useData';
import type { BusinessSettings, DigitalInviteExample, DigitalInvitePackage, DigitalInvitationsContent } from '../lib/types';
import { smsContactUrl, smsOrderUrl, telegramContactUrl, telegramOrderUrl, whatsappContactUrl, whatsappOrderUrl } from '../lib/share';
import { assetUrl, cx } from '../lib/utils';

const FALLBACK_DIGITAL_INVITATIONS: DigitalInvitationsContent = {
  enabled: true,
  title: 'Digital wedding invitation websites',
  subtitle: '',
  intro: '',
  portfolioUrl: 'https://menaincet.com',
  examples: [
    { id: 'kalyordi', title: 'Kalyordi', url: 'https://menaincet.com/kalyordi/', description: '' },
    { id: 'yeabsra-christian', title: 'Yeabsra & Christian', url: 'https://menaincet.com/yeabsrachristian', description: '' },
    { id: 'yeabsra-and-christian', title: 'Yeabsra & Christian - Wedding', url: 'https://menaincet.com/yeabsra-and-christian/', description: '' },
    { id: 'chris-yeabsra', title: 'Chris & Yeabsra', url: 'https://chris-yeabsra.menaincet.com/', description: '' },
  ],
  packages: [
    {
      "id": "simple",
      "name": "Simple",
      "eyebrow": "",
      "description": "",
      "price": 4990,
      "compareAtPrice": null,
      "badge": "",
      "features": [
        "Countdown",
        "Add to calendar",
        "1 Google Maps location link",
        "1 language",
        "Wedding day itinerary",
        "3 photos",
        "Custom couple monogram logo"
      ],
      "footnote": ""
    },
    {
      "id": "classic",
      "name": "Classic",
      "eyebrow": "",
      "description": "",
      "price": 9990,
      "compareAtPrice": null,
      "badge": "",
      "features": [
        "Countdown",
        "Add to calendar",
        "2 Google Maps location links",
        "2 languages",
        "Wedding day itinerary",
        "10 photos",
        "Custom couple monogram logo",
        "Guest messages",
        "Guest photo upload and live slideshow",
        "Downloadable thank-you card",
        "RSVP",
        "Background music",
        "Bulk guest sending"
      ],
      "footnote": ""
    },
    {
      "id": "luxury",
      "name": "Luxury",
      "eyebrow": "",
      "description": "",
      "price": 14990,
      "compareAtPrice": null,
      "badge": "",
      "features": [
        "Countdown",
        "Add to calendar",
        "2 Google Maps location links",
        "2+ languages",
        "Wedding day itinerary",
        "20 photos",
        "Custom couple monogram logo",
        "Guest messages with video and photo options",
        "Guest photo upload and live slideshow",
        "Downloadable thank-you card",
        "RSVP",
        "Background music",
        "Bulk guest sending",
        "1 video",
        "Bride and groom profiles"
      ],
      "footnote": ""
    },
    {
      "id": "luxury-plus",
      "name": "Luxury plus",
      "eyebrow": "",
      "description": "",
      "price": 19990,
      "compareAtPrice": null,
      "badge": "",
      "features": [
        "Countdown",
        "Add to calendar",
        "2+ Google Maps location links",
        "2+ languages",
        "Wedding day itinerary",
        "Unlimited photos",
        "Custom couple monogram logo",
        "Guest messages",
        "Guest photo upload and live slideshow",
        "Downloadable thank-you card",
        "RSVP",
        "Background music",
        "Bulk guest sending",
        "Unlimited videos",
        "Bride and groom profiles",
        "Personalized invitations with QR code for every guest",
        "QR code guest check-in and live attendance reports (optional)",
        "Seating arrangement"
      ],
      "footnote": ""
    }
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
  if (key.includes('kalyordi')) return assetUrl('digital-invites/kalyordi-mobile.png');
  if (key.includes('chris-yeabsra')) return assetUrl('digital-invites/chris-yeabsra-mobile.jpg');
  if (key.includes('yeabsra-and-christian')) return assetUrl('digital-invites/yeabsra-and-christian-mobile.jpg');
  if (key.includes('yeabsrachristian') || key.includes('yeabsra-christian')) return assetUrl('digital-invites/yeabsra-christian-mobile.jpg');
  return '';
}

function showcaseExamples(examples: DigitalInviteExample[] = []) {
  const normalizeUrl = (url: string) => url.replace(/\/+$/, '').toLowerCase();
  const allowedUrls = FALLBACK_DIGITAL_INVITATIONS.examples.map((example) => normalizeUrl(example.url));
  const seen = new Set<string>();
  return examples.filter((example) => {
    const url = normalizeUrl(example.url || '');
    if (!allowedUrls.includes(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  }).sort((a, b) => allowedUrls.indexOf(normalizeUrl(a.url)) - allowedUrls.indexOf(normalizeUrl(b.url)));
}

function packagePresentation(pkg: DigitalInvitePackage, index: number) {
  const key = `${pkg.id || ''} ${pkg.name || ''}`.toLowerCase();
  if (key.includes('classic')) return { Icon: Heart, color: '#ee317b', tint: '#fff1f6', popular: false };
  if (key.includes('luxury-plus')) return { Icon: Crown, color: '#f58220', tint: '#fff4e8', popular: false };
  if (key.includes('luxury')) return { Icon: Gem, color: '#ff7a1a', tint: '#fff3e8', popular: false };
  if (key.includes('simple')) return { Icon: Leaf, color: '#319b5a', tint: '#f0fbf4', popular: false };
  const fallback = [
    { Icon: Leaf, color: '#319b5a', tint: '#f0fbf4', popular: false },
    { Icon: Heart, color: '#ee317b', tint: '#fff1f6', popular: false },
    { Icon: Gem, color: '#ff7a1a', tint: '#fff3e8', popular: false },
    { Icon: Crown, color: '#f58220', tint: '#fff4e8', popular: false },
  ];
  return fallback[index % fallback.length];
}

export function DigitalInvitations() {
  const touchStartX = useRef<number | null>(null);
  const orderButtonRef = useRef<HTMLButtonElement | null>(null);
  const orderMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeExample, setActiveExample] = useState(0);
  const [orderExample, setOrderExample] = useState<DigitalInviteExample | null>(null);
  const [orderMenuPosition, setOrderMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const { data: business } = useData<BusinessSettings>('/content/business');
  const content = business?.digitalInvitations || FALLBACK_DIGITAL_INVITATIONS;
  const packages = content.packages?.length ? content.packages : FALLBACK_DIGITAL_INVITATIONS.packages;
  const examples = showcaseExamples(content.examples ?? FALLBACK_DIGITAL_INVITATIONS.examples);

  const showExample = (direction: -1 | 1) => {
    setOrderExample(null);
    setActiveExample((current) => (current + direction + examples.length) % examples.length);
  };

  useLayoutEffect(() => {
    if (!orderExample) return;
    const positionMenu = () => {
      const trigger = orderButtonRef.current;
      const menu = orderMenuRef.current;
      if (!trigger || !menu) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 8;
      const below = triggerRect.bottom + gap + menuRect.height <= window.innerHeight - 12
        || triggerRect.top - gap - menuRect.height < 12;
      setOrderMenuPosition({
        top: below ? triggerRect.bottom + gap : triggerRect.top - menuRect.height - gap,
        left: Math.max(12, Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - 12)),
      });
    };
    positionMenu();
    window.addEventListener('scroll', positionMenu, true);
    window.addEventListener('resize', positionMenu);
    return () => {
      window.removeEventListener('scroll', positionMenu, true);
      window.removeEventListener('resize', positionMenu);
    };
  }, [orderExample]);

  useEffect(() => {
    if (!orderExample) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOrderExample(null);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (!orderMenuRef.current?.contains(event.target as Node) && !orderButtonRef.current?.contains(event.target as Node)) {
        setOrderExample(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [orderExample]);

  const orderMessage = orderExample ? [
    'Selam Mena Inc, I want to order a digital invitation website.',
    `Example: ${orderExample.title}`,
    `Link: ${orderExample.url}`,
    '',
    'Please contact me with the next steps.',
  ].join('\n') : '';
  const orderChannels = [
    { id: 'telegram', label: 'Telegram', icon: Send, href: telegramContactUrl(business, orderMessage), className: 'bg-[#2b93d6] hover:bg-[#2380c0]', external: true },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: whatsappContactUrl(business, orderMessage), className: 'bg-[#25a34f] hover:bg-[#1e8a3d]', external: true },
    { id: 'sms', label: 'SMS', icon: MessageSquareText, href: smsContactUrl(business, orderMessage), className: 'bg-[#ee317b] hover:bg-[#d41f66]', external: false },
  ];

  if (content.enabled === false) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
        <h1 className="font-sans text-4xl text-ink">Digital invitations are coming soon</h1>
      </section>
    );
  }

  return (
    <div className="bg-bg">
      <section className="mx-auto max-w-[1240px] px-5 py-4 sm:px-8 lg:px-10 lg:py-5">
        <h1 className="font-dancing text-[clamp(42px,12vw,64px)] leading-[1.1] text-ink sm:text-[88px]">Digital Invitation</h1>
      </section>

      <section id="examples" className="border-y border-edge bg-white py-9">
        <div className="mx-auto max-w-[1240px] lg:px-10">
          <h2 className="sr-only">Invitation examples</h2>
          <div
            className="relative mx-auto h-[min(137vw,580px)] max-w-[900px] overflow-hidden [perspective:1100px] sm:h-[640px]"
            aria-label="Digital invitation examples carousel"
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              if (touchStartX.current === null) return;
              const distance = event.changedTouches[0]?.clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(distance) > 40) showExample(distance < 0 ? 1 : -1);
            }}
          >
              {examples.map((example, idx) => {
              const preview = previewImage(example);
              let offset = (idx - activeExample + examples.length) % examples.length;
              if (offset > examples.length / 2) offset -= examples.length;
              const distance = Math.abs(offset);
              return (
                <article
                  key={example.id || example.url || idx}
                  aria-current={distance === 0 ? 'true' : undefined}
                  onClick={() => { if (distance !== 0) setActiveExample(idx); }}
                  className="absolute left-1/2 top-4 w-[min(62vw,300px)] overflow-hidden rounded-[22px] border border-edge bg-bg shadow-[0_16px_34px_rgba(28,26,25,0.16)] motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(.22,.7,.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink focus-visible:ring-offset-2"
                  style={{
                    transform: `translateX(${-50 + offset * 76}%) rotateY(${offset === 0 ? 0 : offset < 0 ? 22 : -22}deg) scale(${distance === 0 ? 1 : 0.88})`,
                    zIndex: examples.length - distance,
                    opacity: distance > 1 ? 0 : 1,
                    pointerEvents: distance > 1 ? 'none' : 'auto',
                  }}
                >
                  <a
                    href={example.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${example.title} invitation website`}
                    tabIndex={distance === 0 ? 0 : -1}
                    onClick={(event) => { if (distance !== 0) event.preventDefault(); }}
                    className="relative block aspect-[9/16] overflow-hidden bg-[#f8efe8]"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt={`${example.title} mobile website preview`}
                        loading={idx < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                        <div className="font-sans text-5xl text-pink">{initials(example.title)}</div>
                        <div className="mt-2 font-sans text-2xl text-ink">{example.title}</div>
                      </div>
                    )}
                  </a>
                  <div className="flex items-center justify-between gap-4 p-3">
                    <a href={example.url} target="_blank" rel="noreferrer" tabIndex={distance === 0 ? 0 : -1} onClick={(event) => { if (distance !== 0) event.preventDefault(); }} className="min-w-0 truncate font-extrabold text-ink hover:text-pink" aria-label={`View ${example.title} invitation website`}>{example.title}</a>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        orderButtonRef.current = event.currentTarget;
                        setOrderMenuPosition(null);
                        setOrderExample((current) => current?.url === example.url ? null : example);
                      }}
                      tabIndex={distance === 0 ? 0 : -1}
                      aria-haspopup="menu"
                      aria-expanded={orderExample?.url === example.url}
                      className="mena-press inline-flex shrink-0 items-center gap-1.5 rounded-full border border-pink px-3 py-1.5 text-xs font-extrabold text-pink"
                    >
                      Order <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
              })}
            {examples.length > 1 && <>
              <button type="button" onClick={() => showExample(-1)} aria-label="Previous invitation" className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink sm:left-5">
                <ChevronLeft className="h-9 w-9" />
              </button>
              <button type="button" onClick={() => showExample(1)} aria-label="Next invitation" className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink sm:right-5">
                <ChevronRight className="h-9 w-9" />
              </button>
            </>}
          </div>
          <div className="mt-1 flex items-center justify-center gap-2" aria-label="Choose invitation example">
            {examples.map((example, index) => (
              <button key={example.id || example.url || index} type="button" onClick={() => { setOrderExample(null); setActiveExample(index); }} aria-label={`Show ${example.title}`} aria-current={activeExample === index ? 'true' : undefined} className={cx('h-2.5 rounded-full transition-all', activeExample === index ? 'w-7 bg-pink' : 'w-2.5 bg-ink/25')} />
            ))}
          </div>
        </div>
      </section>

      {orderExample && createPortal(
        <div
          ref={orderMenuRef}
          role="menu"
          aria-label={`Order ${orderExample.title} through`}
          className="modal-panel fixed z-[90] flex w-44 flex-col items-end gap-2"
          style={{ top: orderMenuPosition?.top ?? 0, left: orderMenuPosition?.left ?? 0, visibility: orderMenuPosition ? 'visible' : 'hidden' }}
        >
          {orderChannels.map(({ id, label, icon: Icon, href, className, external }) => (
            <a key={id} href={href} role="menuitem" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} onClick={() => setOrderExample(null)} className={cx('mena-press flex h-12 w-full items-center gap-3 rounded-full px-4 text-sm font-extrabold text-white shadow-lg', className)}>
              <Icon className="h-5 w-5" />{label}
            </a>
          ))}
        </div>,
        document.body,
      )}

      <section id="packages" className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8 lg:px-10">
        <h2 className="mb-7 font-sans text-4xl text-ink">Package plans</h2>
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
                <h3 className="mt-4 font-sans text-[31px] font-semibold leading-none text-[#201433]">{pkg.name}</h3>
                {pkg.description && <p className="mt-2 min-h-[24px] text-[15px] font-semibold text-[#6e7795]">{pkg.description}</p>}
                <div className="mx-auto mt-4 h-px w-14 bg-pink/20" />
                <div className="mt-6 flex items-baseline justify-center gap-2">
                  <span className={cx('text-sm font-extrabold', highlighted ? 'text-pink' : 'text-[#ff7a1a]')}>ETB</span>
                  <span className={cx('font-sans text-[45px] font-semibold leading-none', highlighted ? 'text-pink' : 'text-[#ff7a1a]')}>
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
