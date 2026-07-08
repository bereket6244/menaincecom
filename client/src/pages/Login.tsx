import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Button, SysLabel } from '../components/ui';
import { cx } from '../lib/utils';

export function Login() {
  const { login, signup, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signup') await signup(name, identifier, password);
      else await login(identifier, password);
      toast('success', mode === 'signup' ? 'Account created — you are logged in.' : 'Welcome back.');
      navigate('/');
    } catch (err) {
      toast('error', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-6">
      <div className="rounded-lg border border-edge bg-surface p-5">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded border border-edge bg-surface2 p-1">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx(
                'rounded py-1.5 text-xs font-semibold transition-colors',
                mode === m ? 'bg-pink text-white' : 'text-muted hover:text-ink'
              )}
            >
              {m === 'login' ? 'Log in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <SysLabel>Full name</SysLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="field mt-1" />
            </div>
          )}
          <div>
            <SysLabel>Email or phone number</SysLabel>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="field mt-1" placeholder="you@example.com or 09…" />
          </div>
          <div>
            <SysLabel>Password</SysLabel>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="field mt-1" />
          </div>
          <Button type="submit" busy={busy} className="w-full py-2.5">
            {mode === 'signup' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </Button>
        </form>
        <p className="mt-3 text-center text-[10px] text-muted">
          No verification codes needed — your account works immediately. You can also order as a guest.
        </p>
      </div>
    </div>
  );
}

export function Account() {
  const { user, logout, toast } = useApp();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="mx-auto max-w-sm space-y-3 py-6">
      <div className="rounded-lg border border-edge bg-surface p-5">
        <SysLabel>Signed in as</SysLabel>
        <div className="mt-1 text-sm font-bold">{user.name}</div>
        <div className="text-xs text-muted">{user.identifier}</div>
        <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/wishlist')}>
          View liked items
        </Button>
        <Button
          variant="danger"
          className="mt-2 w-full"
          onClick={() => { logout(); toast('info', 'Logged out.'); navigate('/'); }}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
