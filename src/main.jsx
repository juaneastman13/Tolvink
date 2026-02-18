import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Tolvink from "./App";
import { ErrorBoundary } from "./components";

// Register service worker for offline + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
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
