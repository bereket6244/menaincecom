import * as Sentry from '@sentry/node';

const dsn = (process.env.GLITCHTIP_DSN || '').trim();
const requestedRate = Number(process.env.GLITCHTIP_TRACE_SAMPLE_RATE || 0.01);
const tracesSampleRate = Number.isFinite(requestedRate) ? Math.min(1, Math.max(0, requestedRate)) : 0.01;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate,
    traceLifecycle: 'static',
    autoSessionTracking: false,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.breadcrumbs;
      delete event.extra;
      delete event.message;
      for (const exception of event.exception?.values || []) {
        exception.value = exception.type || 'server_error';
      }
      return event;
    },
    beforeSendTransaction(event) {
      delete event.user;
      delete event.request;
      delete event.breadcrumbs;
      delete event.extra;
      // Span attributes/descriptions may contain SQL values or outbound URLs.
      for (const span of event.spans || []) {
        delete span.data;
        delete span.description;
      }
      return event;
    },
  });
}

export function attachErrorMonitoring(app) {
  if (dsn) Sentry.setupExpressErrorHandler(app);
}

export function reportServerFailure(route, code = 'server_error') {
  if (!dsn) return;
  Sentry.captureException(new Error(`API failure: ${code}`), {
    tags: { route: String(route || 'unknown').slice(0, 100), code: String(code).slice(0, 50) },
  });
}
