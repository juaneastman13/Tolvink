import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiGetMyAccess } from "../api";

// =====================================================================
// TOLVINK — useAccessLevel hook
// Resolves the current user's access level in the plant-centric model.
// Returns accessLevel, can(action), isPlant, isConsulta, loading.
// =====================================================================

const WRITE_ACTIONS = new Set([
  'createFreight', 'editFreight', 'cancelFreight',
  'assignTransport', 'acceptFreight', 'rejectFreight',
  'updateStatus', 'startTrip', 'confirmLoad', 'finishTrip',
  'createField', 'editField', 'deleteField',
  'createTruck', 'editTruck', 'deleteTruck',
  'manageUsers',
]);

const READ_ACTIONS = new Set([
  'viewFreights', 'viewFreightDetail', 'viewTimeline',
  'viewTickets', 'viewDocuments', 'viewFleetDetails',
  'viewLocations', 'viewMap',
]);

// Map permission overrides from CompanyAccess.permissions JSON
const PERM_KEY_MAP = {
  viewTickets: 'canViewTickets',
  viewDocuments: 'canViewDocuments',
  viewFleetDetails: 'canViewFleetDetails',
};

export function useAccessLevel(user) {
  const [accessData, setAccessData] = useState(null); // array of CompanyAccess records
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(null); // track which companyId we fetched for

  const isPlant = user?.userType === 'plant';

  useEffect(() => {
    if (!user || isPlant) {
      setAccessData(null);
      fetchedRef.current = null;
      return;
    }
    const companyId = user.activeCompanyId;
    if (!companyId || fetchedRef.current === companyId) return;

    fetchedRef.current = companyId;
    setLoading(true);
    apiGetMyAccess()
      .then(data => setAccessData(data || []))
      .catch(() => setAccessData([]))
      .finally(() => setLoading(false));
  }, [user, isPlant, user?.activeCompanyId]);

  // Build access map: plantCompanyId → accessLevel
  const accessMap = useMemo(() => {
    const m = new Map();
    if (accessData) {
      for (const r of accessData) {
        if (r.grantorCompanyId) m.set(r.grantorCompanyId, r.accessLevel);
      }
    }
    return m;
  }, [accessData]);

  // Global isConsulta: true only if ALL access records are READONLY
  const isConsulta = useMemo(() => {
    if (isPlant) return false;
    if (!accessData || accessData.length === 0) return false;
    return accessData.every(r => r.accessLevel === 'READONLY');
  }, [isPlant, accessData]);

  // Per-plant access check: is the user CONSULTA for a specific plant?
  const isConsultaFor = useCallback((plantCompanyId) => {
    if (isPlant || !plantCompanyId) return false;
    const level = accessMap.get(plantCompanyId);
    if (!level) return false; // no relationship = not restricted
    return level === 'READONLY';
  }, [isPlant, accessMap]);

  // Resolve the accessLevel — pick first active record (typically one plant)
  const record = accessData?.[0] || null;
  const accessLevel = isPlant ? 'OPERATOR' : (record?.accessLevel || null);
  const permissions = record?.permissions || {};

  const can = useCallback((action) => {
    // Plant can do everything
    if (isPlant) return true;
    // No access data yet or NONE
    if (!accessLevel || accessLevel === 'NONE') return false;

    if (WRITE_ACTIONS.has(action)) {
      return accessLevel === 'OPERATOR';
    }
    if (READ_ACTIONS.has(action)) {
      if (accessLevel === 'OPERATOR') return true;
      // READONLY: check for permission overrides
      const permKey = PERM_KEY_MAP[action];
      if (permKey && permissions[permKey] === false) return false;
      return true; // READONLY can read by default
    }
    return false;
  }, [isPlant, accessLevel, permissions]);

  // Grantor (plant) info from the access record
  const plantCompanyId = record?.grantorCompanyId || null;
  const plantCompanyName = record?.grantorCompany?.name || null;

  return {
    accessLevel,
    can,
    isPlant,
    isConsulta,
    isConsultaFor,
    loading,
    plantCompanyId,
    plantCompanyName,
    accessData,
  };
}
