// Sentry error tracking — lazy loaded in production only
// @sentry/react is dynamically imported to avoid bundling in dev/non-DSN builds

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

let _Sentry = null;
let _initialized = false;
let _initPromise = null;

if (SENTRY_DSN && typeof window !== 'undefined' && import.meta.env.PROD) {
  _initPromise = import('@sentry/react').then(Sentry => {
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
    _Sentry = Sentry;
    _initialized = true;
    return Sentry;
  }).catch(() => {});
}

export function captureError(err, extra) {
  if (_initialized && _Sentry) {
    _Sentry.captureException(err, extra ? { extra } : undefined);
  }
}

export function setUser(user) {
  if (_initialized && _Sentry && user) {
    _Sentry.setUser({ id: user.id });
  } else if (_initialized && _Sentry) {
    _Sentry.setUser(null);
  }
}

// For consumers that need the Sentry object directly
export const Sentry = { get current() { return _Sentry; } };
