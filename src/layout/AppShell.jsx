import { useCatalog, useFreights, useIsDesktop, useOnline, useNotifications } from "../hooks";
import { AuthProvider, useAuthContext } from "../providers/AuthProvider";
import { SSEProvider } from "../providers/SSEProvider";
import AppLayout from "./AppLayout";
import "../app.css";

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
