import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, MessageCircle, MessageSquareText, Send, Search, ShoppingCart, User, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { StatusBanners, Toasts } from './ui';
import { assetUrl, cx } from '../lib/utils';
import { BrandLogo } from './BrandLogo';
import { AdStrip } from './AdStrip';
import { useData } from '../lib/useData';
import type { BusinessSettings } from '../lib/types';
import { buildProductInquiryMessage, smsContactUrl, telegramContactUrl, whatsappContactUrl } from '../lib/share';
import { currentReturnTarget, loginRoute } from '../lib/authReturn';

export function DesktopShell({ children }: { children: ReactNode }) {
  const { cart, user, wishlistProductIds } = useApp();
  const { data: business } = useData<BusinessSettings>('/content/business');
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const inviteHeaderRef = useRef<HTMLAnchorElement>(null);
  const inviteFloatRef = useRef<HTMLDivElement>(null);
  const [inviteDismissed, setInviteDismissed] = useState(() => sessionStorage.getItem('mena-invite-float-dismissed') === '1');
  const [inviteFlying, setInviteFlying] = useState(false);
  const [inviteLanded, setInviteLanded] = useState(false);
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const accountRoute = user ? '/account' : loginRoute(currentReturnTarget(location));
  const productInquiry = location.pathname.startsWith('/product/')
    ? buildProductInquiryMessage(null, `${window.location.origin}${window.location.pathname}`)
    : undefined;
  const contactChannels = [
    { id: 'telegram', label: 'Telegram', icon: Send, accent: '#2b93d6', href: telegramContactUrl(business, productInquiry), external: true },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, accent: '#25a34f', href: whatsappContactUrl(business, productInquiry), external: true },
    { id: 'sms', label: 'SMS', icon: MessageSquareText, accent: '#ee317b', href: smsContactUrl(business, productInquiry), external: false },
  ];

  useEffect(() => {
    if (location.pathname !== '/catalog') return;
    setQ(new URLSearchParams(location.search).get('q') || '');
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!contactOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(event.target as Node)) setContactOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContactOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [contactOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileOpen]);

  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  const applySearch = (value: string, live = false) => {
    setQ(value);
    const onCatalog = location.pathname === '/catalog';
    if (live && !onCatalog) return;
    const next = new URLSearchParams(onCatalog ? location.search : '');
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    navigate(`/catalog${next.toString() ? `?${next.toString()}` : ''}`, { replace: live });
  };

  const dismissInvite = () => {
    if (inviteFlying) return;
    const source = inviteFloatRef.current;
    const target = inviteHeaderRef.current;
    const finish = () => {
      sessionStorage.setItem('mena-invite-float-dismissed', '1');
      setInviteDismissed(true);
      setInviteFlying(false);
      setInviteLanded(true);
      window.setTimeout(() => setInviteLanded(false), 900);
    };

    if (!source || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const from = source.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = Math.min(to.width / from.width, to.height / from.height);
    setInviteFlying(true);
    const animation = source.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      ],
      { duration: 760, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' },
    );
    animation.onfinish = finish;
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink desktop-boutique">
      <StatusBanners />
      <Toasts />

      <header className="sticky top-0 z-50 border-b border-edge bg-white/98 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between px-10 2xl:px-12">
          <Link to="/catalog" className="mena-press flex shrink-0 items-center gap-3">
            <BrandLogo size="md" />
          </Link>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-3">
            <Link
              ref={inviteHeaderRef}
              to="/digital-invitations"
              className={cx('mena-press flex h-10 items-center gap-2 px-1.5 text-[13px] font-medium text-ink/80 hover:text-pink', inviteLanded && 'invite-header-landed')}
            >
              <img
                src={assetUrl('digital-invites-logo.svg')}
                alt=""
                loading="eager"
                decoding="async"
                className="h-7 w-7 object-contain mix-blend-multiply"
              />
              <span>Digital Invites</span>
            </Link>
            <div ref={contactRef} className="relative">
              <button
                type="button"
                onClick={() => { setProfileOpen(false); setContactOpen((open) => !open); }}
                aria-label="Message Mena"
                aria-haspopup="menu"
                aria-expanded={contactOpen}
                className={cx('mena-press flex h-10 items-center gap-2 px-1.5 text-[13px] font-medium text-ink/80 hover:text-pink', contactOpen && 'text-pink')}
              >
                <Send className="h-[19px] w-[19px]" />
                <span>Message</span>
              </button>
              {contactOpen && (
                <div
                  role="menu"
                  className="modal-panel absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-edge bg-white py-1.5 shadow-[0_16px_40px_rgba(28,26,25,0.18)]"
                >
                  <div className="px-4 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Message us on</div>
                  {contactChannels.map(({ id, label, icon: Icon, accent, href, external }) => (
                    <a
                      key={id}
                      href={href}
                      role="menuitem"
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                      onClick={() => setContactOpen(false)}
                      className="mena-press flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface2"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: accent }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <Link
              id="desktop-cart-target"
              to="/order"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="mena-press relative flex h-10 items-center gap-2 px-1.5 text-[13px] font-medium text-ink/80 hover:text-pink"
            >
              <ShoppingCart className="h-[19px] w-[19px]" />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="mena-pop absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink px-1 text-[10px] font-extrabold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <div ref={profileRef} className="relative">
              <button
                id="desktop-liked-target"
                type="button"
                onClick={() => { setContactOpen(false); setProfileOpen((open) => !open); }}
                aria-label={`${user ? user.name.split(' ')[0] : 'Profile'}, ${wishlistProductIds.length} saved items`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="mena-press relative inline-flex items-center gap-2 rounded-full bg-pink px-5 py-2.5 text-[13px] font-extrabold text-white hover:bg-pink-dim"
              >
                <User className="h-4 w-4" />
                {user ? user.name.split(' ')[0] : 'Local'}
                <ChevronDown className={cx('h-3.5 w-3.5 transition-transform', profileOpen && 'rotate-180')} />
                {wishlistProductIds.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-pink shadow-sm">
                    {wishlistProductIds.length > 99 ? '99+' : wishlistProductIds.length}
                  </span>
                )}
              </button>
              {profileOpen && (
                <div role="menu" className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-edge bg-white py-1.5 shadow-[0_16px_40px_rgba(28,26,25,0.18)]">
                  <Link to={accountRoute} role="menuitem" onClick={() => setProfileOpen(false)} className="mena-press flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink hover:bg-surface2">
                    <User className="h-4 w-4" /> {user ? 'My account' : 'Log in'}
                  </Link>
                  <Link to="/wishlist" role="menuitem" onClick={() => setProfileOpen(false)} className="mena-press flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink hover:bg-surface2">
                    <Heart className="h-4 w-4 text-pink" /> Wishlist
                    {wishlistProductIds.length > 0 && <span className="ml-auto text-xs font-bold text-pink">{wishlistProductIds.length}</span>}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative border-t border-edge/70 bg-white px-10 py-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-56 opacity-40" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applySearch(q);
            }}
            className="relative mx-auto max-w-[1560px]"
          >
            <Search className="pointer-events-none absolute left-5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted/80" />
            <input
              value={q}
              onChange={(e) => applySearch(e.target.value, true)}
              placeholder="Search wedding cards, save-the-dates, menus..."
              className="h-11 w-full rounded-full border border-edge bg-white pl-12 pr-14 text-[14px] text-ink shadow-[0_1px_3px_rgba(28,26,25,0.04)] outline-none placeholder:text-muted/65 focus:border-pink/50 focus:shadow-[0_2px_12px_rgba(28,26,25,0.08)]"
            />
            {q && (
              <button
                type="button"
                onClick={() => applySearch('', true)}
                aria-label="Clear search"
                className="mena-press absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface2 hover:text-ink"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            )}
          </form>
        </div>
        <AdStrip ad={business?.storefrontAd} />
      </header>

      <main className="w-full flex-1">{children}</main>

      {!inviteDismissed && location.pathname !== '/digital-invitations' && (
        <div ref={inviteFloatRef} className={cx('invite-float', inviteFlying && 'invite-float-flying')}>
          <button type="button" className="invite-float-close" onClick={dismissInvite} aria-label="Dismiss Digital Invites button">
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <Link to="/digital-invitations" className="invite-float-link">
            <span className="invite-float-icon"><img src={assetUrl('digital-invites-logo.svg')} alt="" /></span>
            <span className="invite-float-copy"><span className="invite-float-eyebrow">Make it memorable</span><span className="invite-float-title">Digital Invites</span></span>
          </Link>
        </div>
      )}

      <footer className="border-t border-edge bg-white py-6">
        <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-6 px-10 text-[12px] text-muted 2xl:px-12">
          <a
            href={business?.digitalInvitations?.portfolioUrl || 'https://menaincet.com'}
            target="_blank"
            rel="noreferrer"
            className="mena-press hover:text-pink"
          >
            (c) {new Date().getFullYear()} Mena INK Trading PLC - Addis Ababa, Ethiopia
          </a>
          <div className="flex items-center gap-5 font-bold uppercase tracking-[0.12em]">
            <a href="https://menaincet.com" target="_blank" rel="noreferrer" className="mena-press hover:text-pink">
              About us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
