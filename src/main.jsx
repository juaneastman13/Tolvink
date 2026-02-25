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
        // When a new SW is waiting, tell it to skip waiting
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (newSW) {
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'activated') {
                // New SW activated — reload to get fresh chunks
                window.location.reload();
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
