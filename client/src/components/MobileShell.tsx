import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Grid2X2, Heart, Image, Menu, Phone, Search, ShoppingBag, User, X } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { cx } from '../lib/utils';
import { StatusBanners, Toasts } from './ui';
import menaIcon from '../assets/menainc-icon.png';

const NAV = [
  { to: '/catalog', label: 'Wedding Cards', icon: Grid2X2 },
  { to: '/wishlist', label: 'Liked items', icon: Heart },
  { to: '/gallery', label: 'Gallery', icon: Image },
  { to: '/contact', label: 'Contact', icon: Phone },
];

export function MobileShell({ children }: { children: ReactNode }) {
  const { cart, user, wishlistProductIds } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const showCatalogHeader = ['/catalog', '/', '/wishlist', '/gallery', '/contact'].includes(location.pathname);

  const submitSearch = (value = search) => {
    const q = value.trim();
    setDrawerOpen(false);
    navigate(`/catalog${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  };

  return (
    <div className="mobile-boutique min-h-dvh bg-bg text-ink">
      <StatusBanners />
      <Toasts />

      <div className="mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-bg shadow-none sm:shadow-[0_0_0_1px_rgba(28,26,25,0.06)]">
        {showCatalogHeader && (
          <header className="sticky top-0 z-30 border-b border-edge bg-surface">
            <div className="flex h-16 items-center gap-2 px-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Menu"
                className="mena-press flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2"
              >
                <Menu className="h-5.5 w-5.5" />
              </button>
              <Link to="/catalog" className="min-w-0 flex-1 text-center font-serif text-2xl font-semibold tracking-[0.02em]">
                Mena Inc.
              </Link>
              <Link
                id="mena-cart-icon"
                to="/order"
                aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
                className="mena-press relative flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface2"
              >
                <ShoppingBag className="h-5.5 w-5.5" />
                {cartCount > 0 && (
                  <span className="mena-pop absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ee0a24] px-1 text-[10px] font-extrabold text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            </div>
            {location.pathname === '/catalog' && (
              <div className="px-4 pb-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
                  className="relative"
                >
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearch(value);
                      const q = value.trim();
                      navigate(`/catalog${q ? `?q=${encodeURIComponent(q)}` : ''}`, { replace: true });
                    }}
                    placeholder="Search designs, colors, prices..."
                    className="w-full rounded-full border border-edge bg-white py-3 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-pink"
                  />
                </form>
              </div>
            )}
          </header>
        )}

        <main className={cx('min-h-[calc(100dvh-4rem)]', showCatalogHeader ? 'pb-8' : '')}>{children}</main>
      </div>

      <div
        className={cx(
          'fixed inset-0 z-[70] bg-ink/45 transition-opacity duration-300',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={cx(
          'fixed bottom-0 left-0 top-0 z-[71] flex w-[300px] max-w-[82vw] flex-col bg-surface shadow-[8px_0_30px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 border-b border-edge px-4 py-4">
          <img src={menaIcon} alt="Mena Inc." className="h-10 w-auto" />
          <div className="min-w-0">
            <div className="font-serif text-2xl font-semibold leading-none">Mena Inc.</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Wedding stationery</div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="mena-press ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-5">
          <nav className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'mena-press flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-extrabold',
                    isActive ? 'bg-pink text-white' : 'text-ink hover:bg-surface2'
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{label}</span>
                {to === '/wishlist' && wishlistProductIds.length > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{wishlistProductIds.length}</span>
                )}
              </NavLink>
            ))}
            <NavLink
              to={user ? '/account' : '/login'}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                cx(
                  'mena-press flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-extrabold',
                  isActive ? 'bg-pink text-white' : 'text-ink hover:bg-surface2'
                )
              }
            >
              <User className="h-5 w-5" />
              {user ? user.name.split(' ')[0] : 'Log in'}
            </NavLink>
          </nav>
        </div>

        <div className="mt-auto border-t border-edge bg-surface2/70 px-4 py-4 text-[12px] leading-relaxed text-muted">
          <div className="font-bold text-ink">Studio</div>
          <div>Reality Plaza, 1st Floor, Office No. 104</div>
          <div>Bole, Addis Ababa</div>
        </div>
      </aside>
    </div>
  );
}
