// =====================================================================
// TOLVINK — Hooks Barrel Export
// Re-exports all hooks and helpers from domain-specific files.
// Any file importing from './hooks' or '../hooks' gets everything here.
// =====================================================================

// Helpers (pure functions, no React hooks)
export { mapUser, mapFreight, originDisplay, destDisplay, permsFor } from "./helpers";

// Auth
export { useAuth } from "./useAuth";

// Freights
export { useFreights } from "./useFreights";

// Catalog
export { useCatalog } from "./useCatalog";

// Notifications
export { useNotifications } from "./useNotifications";

// SSE
export { useSSE } from "./useSSE";

// Responsive / Online
export { useIsDesktop, useOnline } from "./useResponsive";

// Table interactions
export { useTableSort, usePullToRefresh } from "./useTableInteractions";

// Access Level (plant-centric model)
export { useAccessLevel } from "./useAccessLevel";
