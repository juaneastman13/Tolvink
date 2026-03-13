// App.jsx — Re-exports AppShell as default.
// The app is decomposed into:
//   src/providers/AuthProvider.jsx  — auth context, splash screen, landing guard
//   src/providers/SSEProvider.jsx   — SSE connection + real-time event state
//   src/routing/Router.jsx          — route constants, lazy imports, screen derivation
//   src/layout/AppLayout.jsx        — main layout, handlers, Zustand, polling, search
//   src/layout/AppShell.jsx         — thin root composing all providers
export { default } from "./layout/AppShell";
