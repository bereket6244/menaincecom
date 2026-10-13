import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';

export function TelegramCallback() {
  const { telegramLogin, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const started = useRef(false);
  const [message, setMessage] = useState('Completing Telegram sign-in…');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error');
    if (providerError || !code || !state) {
      setMessage(providerError === 'access_denied' ? 'Telegram sign-in was cancelled.' : 'Telegram did not return a valid sign-in response.');
      return;
    }
    void telegramLogin(code, state).then(() => {
      toast('success', 'Welcome! You are signed in with Telegram.');
      navigate('/account', { replace: true });
    }).catch((error: Error) => {
      setMessage(error.message);
    });
  }, [navigate, params, telegramLogin, toast]);

  return (
    <div className="mx-auto max-w-sm py-6">
      <div className="rounded-lg border border-edge bg-surface p-5 text-center">
        <div className="text-sm font-semibold text-ink">Telegram sign-in</div>
        <p className="mt-2 text-xs text-muted">{message}</p>
        {!message.startsWith('Completing') && (
          <button type="button" className="mt-4 text-xs font-semibold text-pink underline" onClick={() => navigate('/login', { replace: true })}>
            Return to login
          </button>
        )}
      </div>
    </div>
  );
}
