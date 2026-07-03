import { Link, NavLink, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Images, ShoppingBag, User, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { cx } from '../lib/utils';
import { StatusBanners, Toasts } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/catalog', label: 'Catalog', icon: LayoutGrid },
  { to: '/gallery', label: 'Gallery', icon: Images },
  { to: '/contact', label: 'Contact', icon: Phone },
];

export function Shell({ children }: { children: ReactNode }) {
  const { cart, user } = useApp();
  const location = useLocation();
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <StatusBanners />
      <Toasts />

      {/* Desktop / global header */}
      <header className="sticky top-0 z-30 border-b border-edge bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-3 sm:px-4">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-sm font-black tracking-tight text-ink">MENA</span>
            <span className="text-sm font-black tracking-tight text-pink">INC.</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    isActive ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to={user ? '/account' : '/login'}
              className="hidden items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-muted hover:text-ink md:flex"
            >
              <User className="h-3.5 w-3.5" />
              {user ? user.name.split(' ')[0] : 'Log in'}
            </Link>
            <Link
              to="/order"
              className={cx(
                'relative flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors',
                location.pathname === '/order'
                  ? 'border-pink bg-pink text-white'
                  : 'border-edge bg-surface text-ink hover:border-pink/60'
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Order</span>
              {cartCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-20 pt-4 sm:px-4 md:pb-8">{children}</main>

      <footer className="hidden border-t border-edge py-6 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-[11px] text-muted">
          <span>© {new Date().getFullYear()} Mena INK Trading PLC — Addis Ababa, Ethiopia</span>
          <span className="syslabel">Wedding cards · Stationery · Print</span>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[...NAV.slice(0, 3), { to: '/order', label: 'Order', icon: ShoppingBag }, { to: user ? '/account' : '/login', label: user ? 'Account' : 'Log in', icon: User }].map(
          ({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={(rest as { end?: boolean }).end}
              className={({ isActive }) =>
                cx(
                  'relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  isActive ? 'text-pink' : 'text-muted'
                )
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
              {to === '/order' && cartCount > 0 && (
                <span className="absolute right-[22%] top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-pink px-0.5 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}
