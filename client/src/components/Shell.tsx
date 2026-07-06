import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Images, ShoppingBag, User, Phone, Search, Menu, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { cx } from '../lib/utils';
import { StatusBanners, Toasts } from './ui';
import menaIcon from '../assets/menainc-icon.png';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: '/catalog', label: 'Wedding Cards', icon: LayoutGrid },
  { to: '/gallery', label: 'Gallery', icon: Images },
  { to: '/contact', label: 'Contact', icon: Phone },
];

export function Shell({ children }: { children: ReactNode }) {
  const { cart, user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  // Live-filter only while already on the catalog (keeping the category param);
  // from any other page, search navigates only on submit.
  const applySearch = (value: string, live = false) => {
    setQ(value);
    const onCatalog = location.pathname === '/catalog';
    if (live && !onCatalog) return;
    const next = new URLSearchParams(onCatalog ? location.search : '');
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    navigate(`/catalog${next.toString() ? `?${next.toString()}` : ''}`, { replace: live });
  };

  const submitSearch = () => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    setMenuOpen(false);
    navigate(`/catalog${next.toString() ? `?${next.toString()}` : ''}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <StatusBanners />
      <Toasts />

      {/* White brand header */}
      <header className="sticky top-0 z-30 border-b border-edge bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/catalog" className="flex shrink-0 items-center">
            <img
              src={menaIcon}
              alt="Mena Inc."
              className="h-8 w-auto object-contain sm:h-9"
            />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'text-sm transition-colors',
                    isActive
                      ? 'border-b-2 border-pink pb-[22px] font-semibold text-ink -mb-[26px]'
                      : 'font-medium text-ink/70 hover:text-ink'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <Link to="/contact" className="hidden items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-ink lg:flex">
              <Phone className="h-4 w-4" /> Find our studio
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              className="hidden rounded-full bg-pink px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-pink-dim md:inline-flex"
            >
              {user ? user.name.split(' ')[0] : 'Log in'}
            </Link>
            {/* Ordering needs no account — keep the entry point quiet. */}
            <Link
              to="/order"
              aria-label={`Order cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-surface2 hover:text-ink md:hidden"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[9px] font-bold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-surface2 hover:text-ink md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-edge bg-surface px-4 py-4 md:hidden">
            <form
              onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
              className="relative mb-4"
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search designs, categories, colors, prices..."
                className="w-full rounded-full border border-edge bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-pink"
              />
            </form>
            <nav className="space-y-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors',
                      isActive ? 'bg-pink text-white' : 'text-ink hover:bg-surface2'
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </NavLink>
              ))}
              <NavLink
                to={user ? '/account' : '/login'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors',
                    isActive ? 'bg-pink text-white' : 'text-ink hover:bg-surface2'
                  )
                }
              >
                <User className="h-5 w-5" />
                {user ? 'Account' : 'Log in'}
              </NavLink>
            </nav>
          </div>
        )}
      </header>

      {/* Black sub-nav with search */}
      <div className="hidden bg-ink text-white md:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <nav className="hidden items-center gap-5 lg:flex">
            <Link to="/catalog" className="whitespace-nowrap text-[13px] font-medium text-white/80 hover:text-white">
              All designs
            </Link>
            <Link to="/gallery" className="whitespace-nowrap text-[13px] font-medium text-white/80 hover:text-white">
              Portfolio
            </Link>
            <Link to="/contact" className="whitespace-nowrap text-[13px] font-medium text-white/80 hover:text-white">
              Studio
            </Link>
          </nav>
          <form
            onSubmit={(e) => { e.preventDefault(); applySearch(q); }}
            className="relative min-w-0 flex-1 lg:max-w-md"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => applySearch(e.target.value, true)}
              placeholder="Search designs, categories, colors, prices..."
              className="w-full rounded-full border-none bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted/70"
            />
          </form>
          <Link to="/order" aria-label="Order" className="relative text-white hover:text-white/80">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-8 md:pb-12">{children}</main>

      <footer className="hidden border-t border-edge bg-surface py-6 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-[12px] text-muted">
          <span>© {new Date().getFullYear()} Mena INK Trading PLC — Addis Ababa, Ethiopia</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em]">Wedding cards · Stationery · Print</span>
        </div>
      </footer>
    </div>
  );
}
