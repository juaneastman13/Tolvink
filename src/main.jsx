import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Tolvink from "./App";
import { ErrorBoundary } from "./components";

// PWA install prompt handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window._deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-install-available'));
});
window.installPWA = async () => {
  const p = window._deferredInstallPrompt;
  if (p) { p.prompt(); window._deferredInstallPrompt = null; }
};

// Register service worker for offline + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);
        // Force check for updates immediately
        reg.update().catch(() => {});

        const promptUpdate = (sw) => {
          sw.postMessage({ type: 'SKIP_WAITING' });
          window.dispatchEvent(new CustomEvent('sw-update-available', { detail: { reload: () => window.location.reload() } }));
        };

        // When a new SW is waiting, prompt user
        if (reg.waiting) promptUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (newSW) {
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                promptUpdate(newSW);
              }
            });
          }
        });
      })
      .catch(err => console.error('[SW] Registration failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Tolvink />
    </BrowserRouter>
  </ErrorBoundary>
);
