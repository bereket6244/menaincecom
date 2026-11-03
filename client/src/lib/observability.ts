type EventData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: EventData) => void };
    menaUmamiBeforeSend?: (type: string, payload: { url?: string }) => unknown;
  }
}

const umamiUrl = (import.meta.env.VITE_UMAMI_URL || '').trim().replace(/\/$/, '');
const umamiWebsiteId = (import.meta.env.VITE_UMAMI_WEBSITE_ID || '').trim();

export function trackEvent(name: string, data?: EventData) {
  if (!umamiWebsiteId) return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt shopping.
  }
}

export function startObservability() {
  if (umamiUrl && umamiWebsiteId && /^https:\/\//.test(umamiUrl)) {
    window.menaUmamiBeforeSend = (_type, payload) => {
      const path = payload?.url || window.location.pathname;
      if (/(?:^|\/)admin(?:\/|$)|(?:^|\/)auth(?:\/|$)/.test(path)) return false;
      return payload;
    };
    const script = document.createElement('script');
    script.defer = true;
    script.src = `${umamiUrl}/script.js`;
    script.dataset.websiteId = umamiWebsiteId;
    script.dataset.excludeSearch = 'true';
    script.dataset.excludeHash = 'true';
    script.dataset.performance = 'true';
    script.dataset.errors = 'true';
    script.dataset.beforeSend = 'menaUmamiBeforeSend';
    document.head.appendChild(script);
  }
}
