import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Button, SysLabel } from '../components/ui';
import { cx } from '../lib/utils';
import { GoogleSignIn } from '../components/GoogleSignIn';

export function Login() {
  const { login, signup, verifySignup, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (verificationEmail) {
        await verifySignup(verificationEmail, code);
        toast('success', 'Email verified — your account is ready.');
      } else if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const result = await signup(name, identifier, password, confirmPassword);
        setVerificationEmail(result.email);
        toast('success', `We sent a verification code to ${result.email}.`);
        return;
      } else {
        await login(identifier, password);
        toast('success', 'Welcome back.');
      }
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
              onClick={() => { setMode(m); setConfirmPassword(''); setVerificationEmail(''); setCode(''); }}
              className={cx(
                'rounded py-1.5 text-xs font-semibold transition-colors',
                mode === m ? 'bg-pink text-white' : 'text-muted hover:text-ink'
              )}
            >
              {m === 'login' ? 'Log in' : 'Create account'}
            </button>
          ))}
        </div>

        {verificationEmail ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="text-center">
              <div className="text-sm font-semibold text-ink">Check your email</div>
              <p className="mt-1 text-xs text-muted">Enter the six-digit code sent to {verificationEmail}.</p>
            </div>
            <div>
              <SysLabel>Verification code</SysLabel>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="field mt-1 text-center text-xl tracking-[0.35em]"
                placeholder="000000"
              />
            </div>
            <Button type="submit" busy={busy} disabled={code.length !== 6} className="h-10 w-full py-2.5">
              Verify and create account
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-pink underline"
              onClick={() => { setVerificationEmail(''); setCode(''); }}
            >
              Change email or resend code
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <SysLabel>Full name</SysLabel>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="field mt-1" />
              </div>
            )}
            <div>
              <SysLabel>{mode === 'signup' ? 'Email address' : 'Email or phone number'}</SysLabel>
              <input
                type={mode === 'signup' ? 'email' : 'text'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="field mt-1"
                placeholder={mode === 'signup' ? 'you@example.com' : 'you@example.com or 09…'}
              />
            </div>
            <div>
              <SysLabel>Password</SysLabel>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="field mt-1"
              />
            </div>
            {mode === 'signup' && (
              <div>
                <SysLabel>Confirm password</SysLabel>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="field mt-1"
                />
              </div>
            )}
            <Button type="submit" busy={busy} className="h-10 w-full py-2.5">
              {mode === 'signup' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {mode === 'signup' ? 'Send verification code' : 'Log in'}
            </Button>
          </form>
        )}
        {!verificationEmail && <GoogleSignIn onSuccess={() => { toast('success', 'Welcome! You are signed in.'); navigate('/account'); }} />}
        <p className="mt-3 text-center text-[10px] text-muted">
          {mode === 'signup' ? 'We verify your email before creating your account.' : 'You can also order as a guest.'}
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
        {user.role === 'customer' && <>
          <p className="mt-4 text-xs text-muted">Connect Google using the same email to sign in more easily next time.</p>
          <GoogleSignIn onSuccess={() => toast('success', 'Google is connected to your account.')} />
        </>}
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
