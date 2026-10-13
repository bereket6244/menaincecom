import { useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { rememberAuthReturn } from '../lib/authReturn';

export function TelegramSignIn({ returnTo }: { returnTo?: string }) {
  const { telegramStart, toast } = useApp();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      rememberAuthReturn(returnTo || window.location.href);
      const { authorizationUrl } = await telegramStart();
      window.location.assign(authorizationUrl);
    } catch (error) {
      toast('error', (error as Error).message);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={start}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#229ED9] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1d8dbf] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Send className="h-4 w-4" />
      {busy ? 'Opening Telegram…' : 'Continue with Telegram'}
    </button>
  );
}
