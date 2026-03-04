// Sentry error tracking — proper SDK integration
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

let _initialized = false;

if (SENTRY_DSN && typeof window !== 'undefined' && !import.meta.env.DEV) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    beforeSend(event) {
      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.data?.url) {
            try {
              const u = new URL(b.data.url);
              ['token', 't', 's', 'ticket'].forEach(k => u.searchParams.delete(k));
              b.data.url = u.toString();
            } catch {}
          }
          return b;
        });
      }
      return event;
    },
  });
  _initialized = true;
}

export function captureError(err, extra) {
  if (_initialized) {
    Sentry.captureException(err, extra ? { extra } : undefined);
  }
}

export function setUser(user) {
  if (_initialized && user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else if (_initialized) {
    Sentry.setUser(null);
  }
}

export { Sentry };
