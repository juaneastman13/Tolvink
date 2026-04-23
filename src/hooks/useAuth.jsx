import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiLogin, apiRegister, apiLogout, apiSwitchCompany, getSavedUser, clearAuth, setAuthFailHandler,
} from "../api";
import { track } from "../theme";
import { useCatalogStore } from "../store";
import { mapUser } from "./helpers";
import log from "../logger";

// ======================== AUTH HOOK (Real API) ========================
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Simple mode — default for choferes/operarios, persisted in localStorage
  const [simpleMode, setSimpleMode] = useState(() => {
    const saved = localStorage.getItem('tolvink_simple_mode');
    if (saved !== null) return saved === 'true';
    // Default: simple for choferes/operarios
    const u = getSavedUser();
    const r = u?.role === 'gerente' ? 'admin' : (u?.role || 'operario');
    return r === 'chofer' || r === 'operario';
  });
  const toggleSimpleMode = useCallback(() => {
    setSimpleMode(prev => { const next = !prev; localStorage.setItem('tolvink_simple_mode', String(next)); return next; });
  }, []);

  // Setup auth fail handler ONCE
  useEffect(()=>{
    setAuthFailHandler(()=>{
      setUser(null);
      setError("Tu sesión expiró.");
      log.log('AUTH', 'Session expired, cleared user');
    });
    return () => setAuthFailHandler(null);
  },[]);

  // Initialize user from localStorage (cookies handle auth — just need user object)
  useEffect(()=>{
    const saved = getSavedUser();
    log.log('AUTH', 'Initializing:', { hasSaved: !!saved });

    if(saved) {
      try {
        const mappedUser = mapUser(saved);
        setUser(mappedUser);
        log.log('AUTH', 'User restored, id:', mappedUser?.id);
      } catch(e) {
        log.error('AUTH', 'Error mapping saved user:', e);
        clearAuth();
      }
    }
    setLoading(false);
    setIsInitialized(true);
  },[]);

  const login = useCallback(async (identifier, password) => {
    setLoading(true); setError(null);
    try {
      log.log('AUTH', 'Login attempt');
      const d = await apiLogin(identifier, password);
      log.log('AUTH', 'Login response received');

      if(!d.user) {
        throw new Error('Respuesta inválida del servidor');
      }

      const mappedUser = mapUser(d.user);
      setUser(mappedUser);
      track("login");
      log.log('AUTH', 'Login successful, user id:', mappedUser?.id);
      return { success: true };
    }
    catch(e) {
      log.error('AUTH', 'Login error:', e);
      // Special case: user has no password set (header hint, not in body)
      if (e._noPassword) {
        setLoading(false);
        return { noPassword: true };
      }
      setError(e.message||"Error al iniciar sesión");
      clearAuth();
      return null;
    }
    finally { setLoading(false); }
  },[]);

  const signup = useCallback(async (form) => {
    setLoading(true); setError(null);
    try {
      log.log('AUTH', 'Signup attempt');
      const typeMap = {planta:"plant",transporter:"transporter",producer:"producer"};
      const userTypes = (form.userTypes||[]).map(t=>typeMap[t]||t);
      const phone = form.phone?.replace(/[\s\-()]/g,'')||"";
      const d = await apiRegister({ name:form.name, email:form.email, phone, password:form.password, userTypes });

      if(!d.user) {
        throw new Error('Respuesta inválida del servidor');
      }

      const mappedUser = mapUser(d.user);
      setUser(mappedUser);
      track("signup");
      log.log('AUTH', 'Signup successful, user set:', mappedUser);
    } catch(e) {
      log.error('AUTH', 'Signup error:', e);
      setError(e.message||"Error al crear cuenta");
      clearAuth();
    }
    finally { setLoading(false); }
  },[]);

  const logout = useCallback(()=>{
    apiLogout().catch(() => {}); // async — revokes refresh tokens on server
    setUser(null);
    useCatalogStore.getState().clearCache();
    // Clear SW API cache to prevent stale data leaking between users
    if ('caches' in window) caches.delete('tolvink-api-v2').catch(() => {});
  },[]);

  const switchingRef = useRef(false);
  const [companySwitching, setCompanySwitching] = useState(false);
  const switchCompany = useCallback(async (companyId) => {
    if (switchingRef.current) return { ok: false, error: "Cambio en curso" };
    switchingRef.current = true;
    setCompanySwitching(true);
    try {
      // Optimistic: update company name immediately from local data
      setUser(prev => {
        if (!prev) return prev;
        const target = prev.companies?.find(c => c.companyId === companyId);
        if (!target) return prev;
        return {
          ...prev,
          activeCompanyId: companyId,
          companyId,
          entity: target.companyName,
          userType: target.companyType,
          role: target.effectiveRole || (target.role === "gerente" ? "admin" : target.role) || prev.role,
        };
      });

      const d = await apiSwitchCompany(companyId);
      if (d?.user) {
        const mappedUser = mapUser(d.user);
        setUser(mappedUser);
        if ('caches' in window) caches.delete('tolvink-api-v2').catch(() => {});
        log.log('AUTH', 'Switched to company:', companyId);
        return { ok: true };
      }
      return { ok: false, error: "Respuesta inválida" };
    } catch (e) {
      log.error('AUTH', 'Switch company error:', e);
      return { ok: false, error: e.message };
    } finally {
      switchingRef.current = false;
      setCompanySwitching(false);
    }
  }, []);

  const handlePasswordReset = useCallback((result) => {
    if (result?.user) {
      const mappedUser = mapUser(result.user);
      setUser(mappedUser);
      track("password_reset");
    }
  }, []);

  const patchUser = useCallback((updates) => {
    const ALLOWED = new Set(['name', 'email', 'phone', 'company', 'activeCompanyId', 'companies', 'isNew', 'hasInternalFleet']);
    setUser(prev => {
      if (!prev) return prev;
      const safe = {};
      for (const k of Object.keys(updates)) { if (ALLOWED.has(k)) safe[k] = updates[k]; }
      const patched = { ...prev, ...safe };
      localStorage.setItem('tolvink_user', JSON.stringify(patched));
      return patched;
    });
  }, []);

  return { user, loading, error, isInitialized, login, signup, logout, switchCompany, companySwitching, handlePasswordReset, patchUser, clearError:()=>setError(null), simpleMode, toggleSimpleMode };
}
