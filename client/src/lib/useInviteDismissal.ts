import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mena-invite-float-dismissed-until';
const DISMISS_DURATION_MS = 4 * 60 * 60 * 1000;

function readDismissedUntil() {
  try {
    const until = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(until) && until > Date.now()) return until;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Keep the banner usable if browser storage is unavailable.
  }
  return 0;
}

export function useInviteDismissal() {
  const [dismissedUntil, setDismissedUntil] = useState(readDismissedUntil);

  useEffect(() => {
    const sync = () => setDismissedUntil(readDismissedUntil());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  useEffect(() => {
    if (!dismissedUntil) return;
    const remaining = dismissedUntil - Date.now();
    if (remaining <= 0) {
      setDismissedUntil(readDismissedUntil());
      return;
    }
    const timer = window.setTimeout(() => setDismissedUntil(readDismissedUntil()), remaining);
    return () => window.clearTimeout(timer);
  }, [dismissedUntil]);

  const dismiss = (dismissedAt = Date.now()) => {
    const until = dismissedAt + DISMISS_DURATION_MS;
    try {
      localStorage.setItem(STORAGE_KEY, String(until));
    } catch {
      // The current page still keeps the four-hour timer.
    }
    setDismissedUntil(until);
  };

  return { inviteDismissed: dismissedUntil > Date.now(), dismissInviteForFourHours: dismiss };
}
