import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';

type GoogleIdentity = {
  initialize: (options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void; auto_select: boolean }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string; shape: string }) => void;
};
declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }

let scriptReady: Promise<void> | undefined;
function loadGoogle() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (!scriptReady) {
    scriptReady = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      const timeout = window.setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 15000);
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('load failed')); };
      document.head.appendChild(script);
    }).catch((error) => { scriptReady = undefined; throw error; });
  }
  return scriptReady;
}

export function GoogleSignIn({ onSuccess }: { onSuccess: () => void }) {
  const { googleLogin, toast } = useApp();
  const container = useRef<HTMLDivElement>(null);
  const success = useRef(onSuccess);
  success.current = onSuccess;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'busy' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    setStatus('loading');
    const initialize = async () => {
      await loadGoogle();
      if (cancelled) return;
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const response = await fetch(`${base}/api/auth/google/config`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Google sign-in unavailable');
      const config = await response.json() as { clientId: string; nonce: string };
      if (cancelled || !container.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: config.clientId, nonce: config.nonce, auto_select: false,
        callback: ({ credential }) => {
          if (cancelled) return;
          setStatus('busy');
          void googleLogin(credential).then(() => {
            if (!cancelled) success.current();
          }).catch((error: Error) => {
            if (!cancelled) { toast('error', error.message); setAttempt((value) => value + 1); }
          });
        },
      });
      let renderedWidth = 0;
      const renderButton = () => {
        if (cancelled || !container.current || !window.google) return;
        const width = Math.min(container.current.clientWidth || 300, 400);
        if (width === renderedWidth) return;
        renderedWidth = width;
        container.current.replaceChildren();
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline', size: 'large', width, text: 'continue_with', shape: 'pill',
        });
      };
      renderButton();
      resizeObserver = new ResizeObserver(renderButton);
      resizeObserver.observe(container.current);
      setStatus('ready');
    };
    void initialize().catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; resizeObserver?.disconnect(); };
  }, [attempt, googleLogin, toast]);

  return <div className="my-4">
    <div ref={container} className={status === 'busy' ? 'pointer-events-none opacity-50' : ''} />
    <div aria-live="polite" className="mt-2 text-center text-xs text-muted">
      {status === 'loading' && 'Loading Google sign-in…'}
      {status === 'busy' && 'Signing in…'}
      {status === 'error' && <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>Google sign-in could not load. Retry</button>}
    </div>
  </div>;
}
