import { C } from "../theme";

// ======================== MAP USER ====================================
export function mapUser(u) {
  if(!u) return null;
  const co = u.company;
  const userTypes = u.userTypes || (co?.type ? [co.type] : ["producer"]);
  const userType = u.activeType || co?.type || userTypes[0] || "producer";
  // Map gerente → admin for backward compat in frontend logic
  const rawRole = u.role || "operario";
  const role = rawRole === "gerente" ? "admin" : rawRole;
  const name = u.name || "Usuario";
  const av = name.split(" ").filter(w=>w).map(w=>w[0]).join("").slice(0,2).toUpperCase() || "U";
  // New: companies array from backend (memberships)
  const companies = (u.companies || []).map(c => ({
    ...c,
    // Map gerente → admin for frontend compat
    effectiveRole: c.role === "gerente" ? "admin" : c.role,
  }));
  return {
    id:u.id, email:u.email, phone:u.phone||"", name, role, userType, userTypes,
    companyByType: u.companyByType||{},
    entity:co?.name||"", entityId:co?.id||"", companyId:co?.id||"",
    activeCompanyId: u.activeCompanyId || co?.id || "",
    companies,
    hasInternalFleet: co?.hasInternalFleet||false,
    isSuperAdmin: u.isSuperAdmin||false,
    isNew: !!u.isNew,
    av
  };
}

// ======================== MAP FREIGHT =================================
export function mapFreight(f) {
  if(!f) return null;
  const activeAssigns = (f.assignments||[]).filter(x=>x.status==="active"||x.status==="accepted");
  const a = activeAssigns[0];
  const isMultiTruck = !!(f.isMultiTruck || f.truckCount > 1);
  return {
    id:f.id, code:f.code, status:f.status,
    grain:f.items?.[0]?.grain||"", tons:f.items?.[0]?.tons||0,
    unit:f.items?.[0]?.unit||"toneladas", amount:f.items?.[0]?.amount||0,
    productTypeOther:f.items?.[0]?.productTypeOther||"",
    originLotId:f.originLotId, originName:f.originName||"", originCompanyId:f.originCompanyId||"", originCompanyName:f.originCompany?.name||"",
    originHasOwnFleet: !!(f.originCompany && (f.originCompany.hasInternalFleet || (Array.isArray(f.originCompany.types) && f.originCompany.types.includes("transporter")))),
    destHasOwnFleet: !!(f.destCompany && (f.destCompany.hasInternalFleet || (Array.isArray(f.destCompany.types) && f.destCompany.types.includes("transporter")))),
    originLat:f.originLat?parseFloat(f.originLat):null, originLng:f.originLng?parseFloat(f.originLng):null,
    fieldName:f.field?.name||"", useOwnFleet:f.useOwnFleet??null,
    // useOwnFleet is the initial request; actual assignment reflects reality
    isOwnFleet: a ? !!(a.transportCompanyId === f.originCompanyId) : (f.useOwnFleet ?? false),
    fieldId:f.fieldId||null,
    destPlantId:f.destPlantId, destCompanyId:f.destCompanyId||null, destName:f.destName||"",
    destLat:f.destLat?parseFloat(f.destLat):null, destLng:f.destLng?parseFloat(f.destLng):null,
    loadDate:f.loadDate?.split("T")[0]||"", loadTime:f.loadTime||"",
    scheduledAt:f.scheduledAt||null,
    requestedBy:f.requestedById, requestedByName:f.requestedBy?.name||"",
    // Single-truck compat (first assignment)
    transporterId:a?.transportCompanyId||null, transporterName:a?.transportCompany?.name||"",
    driverId:a?.driverId||a?.driver?.id||null, driverName:a?.driver?.name||null, driverPhone:a?.driver?.phone||null,
    queuePosition:a?.queuePosition??0,
    truckPlate:a?.truck?.plate||a?.plate||null, truckModel:a?.truck?.model||null,
    // All assignments (includes history)
    assignments:(f.assignments||[]).map(x=>({ id:x.id, status:x.status, transporterName:x.transportCompany?.name||"", reason:x.reason||null, createdAt:x.createdAt })),
    // Multi-truck (v6.0)
    truckCount: f.truckCount || 1,
    assignedTruckCount: f.assignedTruckCount || (activeAssigns.length > 0 ? activeAssigns.length : 0),
    isMultiTruck,
    activeAssignments: activeAssigns.map(x => ({
      id: x.id,
      transportCompanyId: x.transportCompanyId || null,
      transporterName: x.transportCompany?.name || "",
      truckId: x.truckId || null,
      plate: x.truck?.plate || x.plate || null,
      truckModel: x.truck?.model || null,
      driverId: x.driverId || x.driver?.id || null,
      driverName: x.driver?.name || x.driverName || null,
      driverPhone: x.driver?.phone || null,
      tripStatus: x.tripStatus || ({"pending_assignment":"pending","assigned":"pending","accepted":"accepted","in_progress":"in_progress","loaded":"loaded","finished":"finished","canceled":"pending"}[f.status] || "pending"),
      tripNumber: x.tripNumber || 1,
      tons: x.tons ? parseFloat(x.tons) : null,
      queuePosition: x.queuePosition ?? 0,
      transporterLoadedConfirmedAt: x.transporterLoadedConfirmedAt || null,
      producerLoadedConfirmedAt: x.producerLoadedConfirmedAt || null,
      transporterFinishedConfirmedAt: x.transporterFinishedConfirmedAt || null,
      plantFinishedConfirmedAt: x.plantFinishedConfirmedAt || null,
      startedAt: x.startedAt || null,
      loadedAt: x.loadedAt || null,
      finishedAt: x.finishedAt || null,
      seenAt: x.seenAt || null,
      // Trip data (Mi Flota / detail view)
      kmLoaded: x.kmLoaded ? parseFloat(x.kmLoaded) : null,
      kmEmpty: x.kmEmpty ? parseFloat(x.kmEmpty) : null,
      kmTotal: x.kmTotal ? parseFloat(x.kmTotal) : null,
      fuelLiters: x.fuelLiters ? parseFloat(x.fuelLiters) : null,
      fuelCostPerLiter: x.fuelCostPerLiter ? parseFloat(x.fuelCostPerLiter) : null,
      tollCost: x.tollCost ? parseFloat(x.tollCost) : null,
      odometerStart: x.odometerStart || null,
      odometerEnd: x.odometerEnd || null,
      // External truck fields
      isExternal: x.isExternal || false,
      externalCompanyName: x.externalCompanyName || null,
      externalDriverName: x.externalDriverName || null,
    })),
    producerCompanyId:f.producerCompanyId||null, producerCompanyName:f.producerCompany?.name||null, producerCompanyPhone:f.producerCompany?.phone||null,
    notes:f.notes||"", cancelReason:f.cancelReason||"", createdAt:f.createdAt,
    transporterLoadedConfirmedAt: f.transporterLoadedConfirmedAt||null,
    producerLoadedConfirmedAt: f.producerLoadedConfirmedAt||null,
    transporterFinishedConfirmedAt: f.transporterFinishedConfirmedAt||null,
    plantFinishedConfirmedAt: f.plantFinishedConfirmedAt||null,
    startedAt: f.startedAt||null,
    loadedAt: f.loadedAt||null,
    finishedAt: f.finishedAt||null,
    needsPlantApproval: !!f.needsPlantApproval,
    plantApprovedAt: f.plantApprovedAt||null,
    documents: f.documents||[],
    conversationId: f.conversation?.id||null,
    pendingChanges: f.pendingChanges||[],
    // Flag: true when loaded via findOne (full detail), false when from list/summary
    _isFullDetail: 'documents' in f || 'conversation' in f || 'pendingChanges' in f,
    isOverdue: (() => {
      const overdueStatuses = ["pending_assignment","assigned","accepted"];
      if (!overdueStatuses.includes(f.status)) return false;
      const ld = f.loadDate?.split("T")[0];
      if (!ld) return false;
      const lt = f.loadTime || "23:59";
      const scheduled = new Date(`${ld}T${lt}:00`);
      return scheduled < new Date();
    })(),
  };
}

/** Resolve origin display text — always use the name saved at freight creation */
export function originDisplay(f) {
  if (!f) return '';
  return [f.fieldName, f.originName].filter(Boolean).join(" / ") || f.originCompanyName || "";
}
/** Resolve dest display text — always use the name saved at freight creation */
export function destDisplay(f) {
  if (!f) return '';
  return f.destName || "";
}

// ======================== PERMISSIONS ================================
export function permsFor(user) {
  if (!user) return {};
  const { role, userType } = user;
  const isChofer = role === "chofer";
  if (isChofer) return { canRequest:false, canApprove:false, canAssignDriver:false, canCancel:false, canReject:false, isChofer:true };
  // role is already mapped: gerente→admin in mapUser, platform_admin stays
  const isManager = role === "admin" || role === "platform_admin";
  return {
    canRequest:      ["plant","producer"].includes(userType),
    canApprove:      userType === "plant" && isManager,
    canAssign:       userType === "plant" && isManager,
    canAssignDriver: userType === "transporter" && isManager,
    canCancel:       isManager,
    canReject:       userType === "transporter" && isManager,
    isChofer:        false,
    isManager,
  };
}
