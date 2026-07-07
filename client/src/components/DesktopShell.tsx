import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, Search, ShoppingBag, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { StatusBanners, Toasts } from './ui';
import { cx } from '../lib/utils';
import { BrandLogo } from './BrandLogo';

const NAV = [
  { to: '/catalog', label: 'All Designs' },
  { to: '/gallery', label: 'Portfolio' },
  { to: '/contact', label: 'Studio' },
  { to: '/contact', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function DesktopShell({ children }: { children: ReactNode }) {
  const { cart, user, wishlistProductIds } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  useEffect(() => {
    if (location.pathname !== '/catalog') return;
    setQ(new URLSearchParams(location.search).get('q') || '');
  }, [location.pathname, location.search]);

  const applySearch = (value: string, live = false) => {
    setQ(value);
    const onCatalog = location.pathname === '/catalog';
    if (live && !onCatalog) return;
    const next = new URLSearchParams(onCatalog ? location.search : '');
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    navigate(`/catalog${next.toString() ? `?${next.toString()}` : ''}`, { replace: live });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink desktop-boutique">
      <StatusBanners />
      <Toasts />

      <header className="sticky top-0 z-50 border-b border-edge bg-white">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between px-10">
          <Link to="/catalog" className="mena-press flex shrink-0 items-center gap-3">
            <BrandLogo size="md" />
          </Link>

          <nav className="ml-14 flex flex-1 items-center gap-8">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) =>
                  cx(
                    'mena-press text-[13.5px] font-bold transition-colors hover:text-pink',
                    isActive || (label === 'All Designs' && location.pathname === '/catalog') ? 'text-pink' : 'text-ink'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-5">
            <Link to="/wishlist" className="mena-press flex items-center gap-2 text-[13px] font-bold text-ink hover:text-pink">
              <Heart className={cx('h-[18px] w-[18px]', wishlistProductIds.length > 0 && 'fill-pink text-pink')} />
              Wishlist
              {wishlistProductIds.length > 0 && (
                <span className="mena-pop rounded-full bg-pink px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {wishlistProductIds.length}
                </span>
              )}
            </Link>
            <Link
              id="desktop-cart-target"
              to="/order"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="mena-press relative flex h-10 w-10 items-center justify-center text-ink hover:text-pink"
            >
              <ShoppingBag className="h-[22px] w-[22px]" />
              {cartCount > 0 && (
                <span className="mena-pop absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink px-1 text-[10px] font-extrabold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              className="mena-press inline-flex items-center gap-2 rounded-full bg-pink px-5 py-2.5 text-[13px] font-extrabold text-white hover:bg-pink-dim"
            >
              <User className="h-4 w-4" />
              {user ? user.name.split(' ')[0] : 'Mena'}
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="relative bg-[#fdeef5] px-10 py-[18px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-56 opacity-40" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applySearch(q);
            }}
            className="relative mx-auto max-w-[1240px]"
          >
            <Search className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted/80" />
            <input
              value={q}
              onChange={(e) => applySearch(e.target.value, true)}
              placeholder="Search wedding cards, save-the-dates, menus..."
              className="h-12 w-full rounded-full border-0 bg-white pl-14 pr-6 text-[15px] text-ink shadow-[0_1px_4px_rgba(28,26,25,0.06)] outline-none placeholder:text-muted/70 focus:shadow-[0_2px_12px_rgba(28,26,25,0.12)]"
            />
          </form>
        </div>
      </header>

      <main className="w-full flex-1">{children}</main>

      <footer className="border-t border-edge bg-white py-6">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-10 text-[12px] text-muted">
          <span>© {new Date().getFullYear()} Mena INK Trading PLC · Addis Ababa, Ethiopia</span>
          <span className="font-bold uppercase tracking-[0.12em]">Invitations · Stationery · Print</span>
        </div>
      </footer>
    </div>
  );
}
