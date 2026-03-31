import { createContext, useContext, useEffect, useRef, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks";
import { setUser as setSentryUser } from "../sentry";
import { C , R} from "../theme";
import { SL, LandingScreen, isPublicPath, renderPublicRoute } from "../routing/Router";
import api from "../api";

// ======================== AUTH CONTEXT =================================
const AuthContext = createContext(null);
export const useAuthContext = () => useContext(AuthContext);

// ======================== AUTH PROVIDER ================================
// Wraps auth initialization + splash screen + provides auth via context.
// Children only render once auth is initialized.
export function AuthProvider({ children }) {
  const auth = useAuth();

  if (!auth.isInitialized) {
    return <div role="status" aria-label="Cargando Tolvink" style={{minHeight:"100dvh",background:C.bg,fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes splashIn{0%{opacity:0;transform:scale(0.7)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}*{margin:0;padding:0;box-sizing:border-box}html,body,#root{background:${C.bg};margin:0;height:auto!important;overflow:visible!important}`}</style>
      <div style={{textAlign:"center",animation:"splashIn 0.8s ease-out forwards"}}>
        <span style={{fontSize:91.3,fontWeight:800,color:C.pri,letterSpacing:-3.5,display:"inline-block"}}>tolvink</span>
        <span style={{width:16,height:16,borderRadius: R.md,background:C.acc,display:"inline-block",marginLeft:5,marginTop:-34,verticalAlign:"top",animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
      </div>
    </div>;
  }

  return (
    <AuthContext.Provider value={auth}>
      <AuthRouteGuard>{children}</AuthRouteGuard>
    </AuthContext.Provider>
  );
}

// ======================== AUTH ROUTE GUARD =============================
// Handles public routes, landing page, login redirect, and Sentry tracking.
function AuthRouteGuard({ children }) {
  const auth = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to home only on real login (not page refresh).
  // On refresh, the first render already has auth.user (loaded from cookie),
  // so we skip the redirect. Only redirect when user transitions null→object
  // AFTER the initial render (i.e., the user just logged in).
  const prevUser = useRef(auth.user);
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      prevUser.current = auth.user;
      setSentryUser(auth.user);
      return;
    }
    if (auth.user && !prevUser.current) {
      // User just logged in — check module routing
      const companyId = auth.user.activeCompanyId || auth.user.companyId;
      if (companyId) {
        api(`/companies/${companyId}/modules`).then(data => {
          const { enabledModules = ["logistics"], preferredModule } = data || {};
          if (enabledModules.length > 1 && !preferredModule) {
            navigate("/module-selector", { replace: true });
          } else if (enabledModules.length > 1 && preferredModule === "mechanic") {
            navigate("/mechanic", { replace: true });
          } else if (enabledModules.length === 1 && enabledModules[0] === "mechanic") {
            navigate("/mechanic", { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }).catch(() => {
          navigate("/", { replace: true });
        });
      } else {
        navigate("/", { replace: true });
      }
    }
    prevUser.current = auth.user;
    setSentryUser(auth.user);
  }, [auth.user, navigate]);

  // Public routes — render without authentication
  const publicRoute = renderPublicRoute(location.pathname);
  if (publicRoute) return publicRoute;

  // No user — show landing page
  if (!auth.user) {
    return <Suspense fallback={<SL/>}><LandingScreen onLogin={auth.login} onSignup={auth.signup} onPasswordReset={auth.handlePasswordReset} loading={auth.loading} error={auth.error} clearError={auth.clearError}/></Suspense>;
  }

  return children;
}
