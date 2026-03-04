import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Tolvink from "./App";
import { ErrorBoundary } from "./components";

// Register service worker for offline + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);
        // Force check for updates immediately
        reg.update().catch(() => {});

        const promptUpdate = (sw) => {
          if (window.confirm('Hay una nueva versión de Tolvink disponible. ¿Actualizar ahora?')) {
            sw.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
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
