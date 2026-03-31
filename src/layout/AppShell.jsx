import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useCatalog, useFreights, useIsDesktop, useOnline, useNotifications } from "../hooks";
import { AuthProvider, useAuthContext } from "../providers/AuthProvider";
import { SSEProvider } from "../providers/SSEProvider";
import AppLayout from "./AppLayout";
import { SL } from "../routing/Router";
import "../app.css";

const MechanicLayout = lazy(() => import("./MechanicLayout"));
const ModuleSelectorScreen = lazy(() => import("../screens/ModuleSelectorScreen"));

// ======================== APP SHELL ====================================
// Thin root component: composes AuthProvider → core hooks → SSEProvider → AppLayout.
// All behavior lives in the providers and AppLayout — this file is purely wiring.

export default function AppShell() {
  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}

// Only mounts when auth is initialized AND user is logged in (AuthProvider handles splash/landing/public routes).
function AuthedApp() {
  const auth = useAuthContext();
  const location = useLocation();

  // Module selector — standalone screen, no logistics hooks needed
  if (location.pathname === "/module-selector") {
    return <Suspense fallback={<SL />}><ModuleSelectorScreen user={auth.user} /></Suspense>;
  }

  // Mechanic module — own layout, no logistics hooks needed
  if (location.pathname.startsWith("/mechanic")) {
    return <Suspense fallback={<SL />}><MechanicLayout /></Suspense>;
  }

  // Logistics module — existing behavior
  return <LogisticsApp />;
}

function LogisticsApp() {
  const auth = useAuthContext();
  const fh = useFreights(auth.user, true);
  const catalog = useCatalog(auth.user);
  const online = useOnline();
  const notif = useNotifications(auth.user);
  const isDesktop = useIsDesktop(768);

  return (
    <SSEProvider auth={auth} fh={fh} notif={notif} catalog={catalog}>
      <AppLayout fh={fh} catalog={catalog} online={online} notif={notif} isDesktop={isDesktop} />
    </SSEProvider>
  );
}
