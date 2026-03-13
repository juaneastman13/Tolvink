// =====================================================================
// TOLVINK — hooks.jsx (backward compatibility re-export)
// All hooks have been decomposed into src/hooks/ directory.
// This file re-exports everything so existing imports continue to work.
// =====================================================================
export {
  mapUser, mapFreight, originDisplay, destDisplay, permsFor,
  useAuth, useFreights, useCatalog, useNotifications, useSSE,
  useIsDesktop, useOnline, useTableSort, usePullToRefresh,
} from "./hooks/index";
