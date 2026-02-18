import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Tolvink from "./App";
import { captureError } from "./sentry";

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info);
    captureError(err, { componentStack: info?.componentStack });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"DM Sans, sans-serif", padding:32, textAlign:"center" }}>
          <div>
            <div style={{ fontSize:48, marginBottom:16 }}>Algo salió mal</div>
            <p style={{ color:"#666", marginBottom:24 }}>Ocurrió un error inesperado.</p>
            <button onClick={() => window.location.reload()} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:"#4F46E5", color:"#fff", fontWeight:600, cursor:"pointer", fontSize:14 }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
