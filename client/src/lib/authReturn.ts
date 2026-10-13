const RETURN_KEY = 'mena_auth_return_to';
const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');
const fallback = `${appBase}/catalog` || '/catalog';

export function safeAuthReturn(candidate?: string | null): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const target = `${url.pathname}${url.search}${url.hash}`;
    if (url.pathname === `${appBase}/login` || url.pathname === `${appBase}/auth/telegram/callback`) return null;
    return target;
  } catch {
    return null;
  }
}

export function currentReturnTarget(location: { pathname: string; search: string; hash: string }) {
  return safeAuthReturn(`${appBase}${location.pathname}${location.search}${location.hash}`) || fallback;
}

export function loginRoute(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function rememberAuthReturn(candidate?: string | null) {
  const target = safeAuthReturn(candidate);
  if (target) sessionStorage.setItem(RETURN_KEY, target);
  return target;
}

export function requestedAuthReturn(candidate?: string | null) {
  const fromRequest = rememberAuthReturn(candidate);
  if (fromRequest) return fromRequest;
  const stored = safeAuthReturn(sessionStorage.getItem(RETURN_KEY));
  if (stored) return stored;
  const referrer = safeAuthReturn(document.referrer);
  if (referrer) {
    sessionStorage.setItem(RETURN_KEY, referrer);
    return referrer;
  }
  return fallback;
}

export function returnAfterAuth(candidate?: string | null) {
  const target = safeAuthReturn(candidate) || safeAuthReturn(sessionStorage.getItem(RETURN_KEY)) || fallback;
  sessionStorage.removeItem(RETURN_KEY);
  window.location.replace(target);
}
