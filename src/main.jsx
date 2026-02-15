import React from "react";
import ReactDOM from "react-dom/client";
import Tolvink from "./App";

// Clear stale service workers and caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(<Tolvink />);
