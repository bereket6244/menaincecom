import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Inbox, Package, FolderTree, Images, Users, ShieldCheck, Bell, ExternalLink, LogOut, Building2, Gift,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { apiGet, apiSend } from '../lib/api';
import { BrandLogo } from '../components/BrandLogo';
import { StatusBanners, Toasts, Button, SysLabel } from '../components/ui';
import { cx } from '../lib/utils';

const TABS = [
  { to: '/admin', label: 'Orders', icon: Inbox, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/complimentary-items', label: 'Free Items', icon: Gift },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/business', label: 'Business', icon: Building2 },
  { to: '/admin/leads', label: 'Leads', icon: Users },
  { to: '/admin/admins', label: 'Admins', icon: ShieldCheck },
];

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function AdminLogin() {
  const { login, toast } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(identifier, password);
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <Toasts />
      <form onSubmit={submit} className="w-full max-w-xs space-y-3 rounded-lg border border-edge bg-surface p-5">
        <div className="flex items-baseline gap-1.5">
          <BrandLogo size="sm" />
          <span className="syslabel ml-1">Admin</span>
        </div>
        <div>
          <SysLabel>Email or phone</SysLabel>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="field mt-1" />
        </div>
        <div>
          <SysLabel>Password</SysLabel>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="field mt-1" />
        </div>
        <Button type="submit" busy={busy} className="w-full py-2">Log in</Button>
      </form>
    </div>
  );
}

export function AdminShell() {
  const { user, logout, toast } = useApp();

  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast('error', 'Push notifications are not supported in this browser.');
        return;
      }
      const { key } = await apiGet<{ key: string }>('/admin/push/key');
      if (!key) { toast('error', 'Push is not configured on the server (VAPID keys missing).'); return; }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { toast('info', 'Notification permission was not granted.'); return; }
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await apiSend('POST', '/admin/push/subscribe', { subscription: sub.toJSON() });
      toast('success', 'Push notifications enabled on this device.');
    } catch (err) {
      toast('error', (err as Error).message);
    }
  };

  if (!user) return <AdminLogin />;
  if (user.role !== 'admin') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg p-4 text-center">
        <p className="text-sm text-muted">This account does not have admin access.</p>
        <Link to="/catalog" className="text-xs font-semibold text-pink hover:underline">Back to the store</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <StatusBanners />
      <Toasts />

      {/* Top header */}
      <header className="border-b border-edge bg-surface">
        <div className="flex h-11 items-center gap-3 px-3">
          <Link to="/admin" className="flex items-baseline gap-1.5">
            <BrandLogo showIcon={false} size="sm" />
          </Link>
          <SysLabel>Operations Console</SysLabel>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={enablePush} title="Enable push notifications" className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-ink">
              <Bell className="h-4 w-4" />
            </button>
            <Link to="/catalog" title="View storefront" className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-ink">
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button onClick={logout} title="Log out" className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface2 hover:text-rose-400">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Horizontal module tabs (desktop) */}
        <nav className="hidden gap-0.5 overflow-x-auto px-2 md:flex">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                  isActive ? 'border-pink text-ink' : 'border-transparent text-muted hover:text-ink'
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-3 pb-20 md:pb-4">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-8 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium', isActive ? 'text-pink' : 'text-muted')
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
