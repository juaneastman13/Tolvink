// Sentry error tracking — lazy init via CDN (no npm dependency needed for build)
let _sentry = null;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

if (SENTRY_DSN && typeof window !== 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/8.45.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    if (window.Sentry) {
      window.Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
        beforeSend(event) {
          if (import.meta.env.DEV) return null;
          return event;
        },
      });
      _sentry = window.Sentry;
    }
  };
  document.head.appendChild(script);
}

export function captureError(err, extra) {
  const s = _sentry || window.Sentry;
  if (s) s.captureException(err, extra ? { extra } : undefined);
}
