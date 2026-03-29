import { C, Ic , R} from "../theme";
import { getActions } from "../constants";
import { destDisplay } from "../hooks";

// ======================== RESOLVE USER TYPE FOR FREIGHT ================
export function resolveUserTypeForFreight(freight, user) {
  if (user.role === "chofer") return "chofer";
  const types = user.userTypes || [user.userType];
  if (types.length <= 1) return user.userType;

  // Only consider types where the user's active company matches the freight role:
  // producer → originCompanyId, plant → destCompanyId, transporter → assignment transportCompanyId
  const cId = user.activeCompanyId || user.companyId;
  const eligible = types.filter(t => {
    if (t === "producer") return freight.originCompanyId === cId;
    if (t === "plant") return freight.destCompanyId === cId;
    if (t === "transporter") return freight.transporterId === cId || (freight.activeAssignments || []).some(a => a.transportCompanyId === cId);
    return false;
  });
  if (eligible.length === 0) return user.userType;
  if (eligible.length === 1) return eligible[0];

  // Multiple eligible: pick the one with pending actions, prioritizing active type
  const active = user.userType;
  const sorted = eligible.includes(active) ? [active, ...eligible.filter(t => t !== active)] : eligible;
  for (const type of sorted) {
    if (getPendingActions(freight, type, user.role, user)) return type;
  }
  for (const type of sorted) {
    if (getActions(freight.status, type, user.role, freight.isOwnFleet).length > 0) return type;
  }
  return eligible[0];
}

// ======================== GET PENDING ACTIONS ==========================

// Multi-truck: find most urgent action across user's assignments
function getMultiTruckPendingAction(freight, userType, role, user) {
  // Plant approval takes priority over everything else
  if (userType === "plant" && freight.needsPlantApproval && !freight.plantApprovedAt) {
    return { action: "Aprobar flete", color: C.sec, icon: "approve", actionKey: "approve_producer", groupKey: "approve_producer" };
  }

  const aa = freight.activeAssignments || [];
  if (!aa.length) {
    if (userType === "plant" && freight.assignedTruckCount < freight.truckCount) {
      return { action: `Asignar ${freight.truckCount - freight.assignedTruckCount} camiones`, color: C.acc, icon: "assign", actionKey: "assign_multi", groupKey: "assign" };
    }
    if (userType === "producer" && !freight.destCompanyId) {
      return { action: "Indicar camión", color: C.acc, icon: "assign", actionKey: "assign", groupKey: "assign" };
    }
    return null;
  }

  // Collect ALL distinct groupKeys for multi-truck (freight appears in multiple groups)
  const allGroupKeys = new Set();

  // Plant: check if more trucks needed or any trip needs truck/driver, authorize own-fleet, or confirm
  if (userType === "plant") {
    if (freight.assignedTruckCount < freight.truckCount) allGroupKeys.add("assign");
    if (aa.some(a => a.tripStatus === "pending" && !a.truckId && !a.isExternal)) allGroupKeys.add("assign");
    const needsAuth = aa.find(a => a.transportCompanyId === freight.originCompanyId && a.tripStatus === "pending" && (a.truckId || a.isExternal));
    if (needsAuth) allGroupKeys.add("authorize");
    const ownOrExt = aa.filter(a => a.transportCompanyId === freight.originCompanyId || a.isExternal);
    if (ownOrExt.some(a => a.tripStatus === "accepted" && (a.driverId === user?.id || a.isExternal))) allGroupKeys.add("start");
    if (ownOrExt.some(a => a.tripStatus === "in_progress" && !a.transporterLoadedConfirmedAt && (a.driverId === user?.id || a.isExternal))) allGroupKeys.add("confirm_loaded");
    if (ownOrExt.some(a => a.tripStatus === "loaded" && !a.transporterFinishedConfirmedAt)) allGroupKeys.add("confirm_finished");
    if (aa.some(a => !a.isExternal && a.transportCompanyId !== freight.originCompanyId && a.tripStatus === "loaded" && !a.plantFinishedConfirmedAt)) allGroupKeys.add("confirm_finished");
  } else if (userType === "producer") {
    const ownTrips = aa.filter(a => a.transportCompanyId === freight.originCompanyId);
    if (ownTrips.some(a => a.tripStatus === "accepted" && a.driverId === user?.id)) allGroupKeys.add("start");
    if (ownTrips.some(a => a.tripStatus === "in_progress" && !a.transporterLoadedConfirmedAt && a.driverId === user?.id)) allGroupKeys.add("confirm_loaded");
    if (ownTrips.some(a => a.tripStatus === "loaded" && !a.transporterFinishedConfirmedAt)) allGroupKeys.add("confirm_finished");
    if (aa.some(a => (a.tripStatus === "loaded" || a.tripStatus === "in_progress") && !a.producerLoadedConfirmedAt)) allGroupKeys.add("confirm_loaded");
  } else {
    // Transporter/chofer
    const my = role === "chofer" ? aa.filter(a => a.driverId === user?.id) : aa.filter(a => a.transportCompanyId === user?.companyId);
    if (my.some(a => a.tripStatus === "pending")) allGroupKeys.add("assign");
    if (my.some(a => a.tripStatus === "accepted")) allGroupKeys.add("start");
    if (my.some(a => a.tripStatus === "in_progress" && !a.transporterLoadedConfirmedAt)) allGroupKeys.add("confirm_loaded");
    if (my.some(a => a.tripStatus === "loaded" && !a.transporterFinishedConfirmedAt)) allGroupKeys.add("confirm_finished");
  }

  if (allGroupKeys.size === 0) return null;

  // Return primary action (first by priority) + all groupKeys for multi-group placement
  const priority = ["approve_producer", "assign", "authorize", "start", "confirm_loaded", "confirm_finished"];
  const primaryKey = priority.find(k => allGroupKeys.has(k)) || [...allGroupKeys][0];
  const labels = { assign: "Asignar transporte", authorize: "Autorizar viaje", start: "Iniciar viaje", confirm_loaded: "Confirmar carga", confirm_finished: "Confirmar entrega" };
  const colors = { assign: C.acc, authorize: C.sec, start: C.pri, confirm_loaded: C.acc, confirm_finished: C.pri };

  return {
    action: labels[primaryKey] || primaryKey,
    color: colors[primaryKey] || C.pri,
    icon: primaryKey === "assign" ? "truck" : primaryKey === "authorize" ? "authorize" : primaryKey === "start" ? "start" : "confirm",
    actionKey: primaryKey,
    groupKey: primaryKey,
    groupKeys: [...allGroupKeys],
  };
}

export function getPendingActions(freight, userType, role, user) {
  // Multi-truck OR multiple active assignments: delegate to specialized function
  // This ensures per-trip pending actions are detected even when isMultiTruck flag is not set
  const hasMultipleAssignments = (freight.activeAssignments || []).length > 1;
  if (freight.isMultiTruck || hasMultipleAssignments) return getMultiTruckPendingAction(freight, userType, role, user);

  const s = freight.status;
  const own = freight.isOwnFleet;
  if (role === "chofer" || userType === "chofer") {
    const qp = freight.queuePosition || 0;
    if (qp > 1) return { action: `En cola #${qp}`, color: C.t3, icon: "queue", actionKey: null, isQueue: true };
    // Chofer assignments are auto-accepted — skip "assigned" status, go straight to start when accepted
    if (s === "accepted") return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress") return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded") return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  if (userType === "plant") {
    // Producer-created freight with own fleet pending plant approval
    if (own && freight.needsPlantApproval && !freight.plantApprovedAt && s !== "canceled" && s !== "finished") return { action: "Aceptar flete de productor", color: C.sec, icon: "approve", actionKey: "approve_producer", groupKey: "approve_producer" };
    if (s === "pending_assignment") return { action: "Asignar transporte", color: C.acc, icon: "assign", actionKey: "assign", groupKey: "assign" };
    if (s === "assigned" && own) return { action: "Autorizar viaje", color: C.sec, icon: "authorize", actionKey: "authorize", groupKey: "authorize" };
    // Own fleet: only show start/confirm_loaded as pending if the user IS the assigned driver
    // Otherwise the chofer handles it and the plant sees it as "waiting"
    const isOwnDriver = own && freight.driverId === user?.id;
    if (s === "accepted" && own && isOwnDriver) return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress" && own && isOwnDriver && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded" && own && !freight.transporterFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    // Non-own-fleet: plant confirms delivery reception
    if (s === "loaded" && !own && !freight.plantFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  if (userType === "transporter") {
    if (s === "assigned" && !own) return { action: "Asignar camión", color: C.pri, icon: "truck", actionKey: "assign_truck", groupKey: "assign" };
    if (s === "accepted") return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress" && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded" && !freight.transporterFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  if (userType === "producer") {
    // If plant hasn't approved yet, producer can't act
    if (freight.needsPlantApproval && !freight.plantApprovedAt) return null;
    // Pending assignment without dest company: producer must assign truck (no plant to delegate to)
    if (s === "pending_assignment" && !freight.destCompanyId) return { action: "Indicar camión", color: C.acc, icon: "assign", actionKey: "assign", groupKey: "assign" };
    // Own fleet: only show start/confirm_loaded as pending if the user IS the assigned driver
    const isProdOwnDriver = own && freight.driverId === user?.id;
    if (s === "accepted" && own && isProdOwnDriver) return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress" && own && isProdOwnDriver && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded" && !freight.producerLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded" && own && freight.producerLoadedConfirmedAt && !freight.transporterFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  return null;
}

// ======================== WAITING ON (CROSS-CONFIRMATION) ===============
export function getWaitingOnText(freight, userType) {
  const s = freight.status;
  const own = freight.isOwnFleet;
  if (userType === "plant") {
    if (s === "assigned" && !own) return "Esperando transporte";
    if (s === "accepted") return "Esperando inicio";
    if (s === "in_progress") return "En tránsito";
    return null;
  }
  if (userType === "transporter" || userType === "chofer") {
    if (s === "assigned" && own) return "Esperando autorización planta";
    if (s === "in_progress" && freight.transporterLoadedConfirmedAt && !freight.producerLoadedConfirmedAt) return "Esperando confirmación productor";
    if (s === "loaded" && freight.transporterFinishedConfirmedAt) return "Esperando confirmación planta";
    return null;
  }
  if (userType === "producer") {
    if (freight.needsPlantApproval && !freight.plantApprovedAt) return "Esperando aprobación de planta";
    if (s === "pending_assignment" && freight.destCompanyId) return "Esperando asignación planta";
    if (s === "assigned") return own ? "Esperando autorización planta" : "Esperando transporte";
    if (s === "accepted") return "Esperando inicio";
    if (s === "in_progress") return "En tránsito";
    return null;
  }
  return null;
}

// ======================== THIRD-PARTY LABEL (for grouping) =============
export function getThirdPartyLabel(freight, userType) {
  // Delegate to getWaitingOnText which already handles isOwnFleet + cross-confirmations
  const waitText = getWaitingOnText(freight, userType);
  if (waitText) return waitText;
  // Fallback for statuses not covered by getWaitingOnText
  const s = freight.status;
  if (s === "in_progress") return "En viaje a campo";
  if (s === "loaded") return "En viaje a planta";
  return "Sin pendientes de mi parte";
}

// ======================== NOTIFICATION HELPERS =========================
export const NOTIF_ICONS = {
  freight_created: (s) => Ic.truck(C.pri, s),
  freight_assigned: (s) => Ic.truck(C.info, s),
  freight_accepted: (s) => Ic.chk(C.ok, s),
  freight_rejected: (s) => Ic.ban(C.err, s),
  freight_started: (s) => Ic.nav(C.info, s),
  freight_loaded: (s) => Ic.truck(C.ok, s),
  freight_finished: (s) => Ic.chk(C.ok, s),
  freight_cancelled: (s) => Ic.ban(C.err, s),
};

export function _timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return `hace ${Math.floor(d / 7)} sem`;
}

export function _fmtDate(d) { if(!d) return ""; return d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(2,4); }

export function NotifRow({ n, freight, onMarkRead, onTap, isLast }) {
  const icFn = NOTIF_ICONS[n.type] || ((s) => Ic.bell(C.t3, s));
  const f = freight;
  const detailStyle = { fontSize:12.1, color:C.t3, display:"flex", alignItems:"center", gap:4 };
  return (
    <button onClick={() => { if (!n.read) onMarkRead(n.id); if (n.entityId) onTap(n.entityId); }}
      className="tv-row"
      style={{
        display:"flex", alignItems:"flex-start", gap:14, width:"100%", padding:"14px 18px",
        border:"none", background: n.read ? "transparent" : C.priGhost, cursor:"pointer",
        fontFamily:"inherit", textAlign:"left",
        borderBottom: isLast ? "none" : `1px solid ${C.b2}`,
        WebkitTapHighlightColor:"transparent", touchAction:"manipulation", transition:"background 0.15s"
      }}>
      <div style={{ width:40, height:40, borderRadius: R.lg, background: n.read ? C.bg : C.priPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icFn(18)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:15.4, fontWeight: n.read ? 500 : 700, color: n.read ? C.t2 : C.t1, flex:1 }}>{n.title}</span>
          <span style={{ fontSize:12.1, color:C.t3, fontWeight:500, flexShrink:0 }}>{_timeAgo(n.createdAt)}</span>
        </div>
        <div style={{ fontSize:13.8, color:C.t3, marginTop:3, lineHeight:1.4 }}>{n.body}</div>
        {f && (
          <div style={{ display:"flex", flexDirection:"column", gap:2, marginTop:6 }}>
            {(f.originCompanyName||f.requestedByName) && <span style={detailStyle}>{Ic.user(C.t3,11)} {f.originCompanyName||f.requestedByName}</span>}
            {f.transporterName && <span style={detailStyle}>{Ic.truck(C.t3,11)} {f.transporterName}{f.truckPlate?` (${f.truckPlate})`:""}</span>}
            {destDisplay(f) && <span style={detailStyle}>{Ic.plant(C.t3,11)} {destDisplay(f)}</span>}
          </div>
        )}
      </div>
      {!n.read && <div style={{ width:8, height:8, borderRadius: R.xs, background:C.pri, flexShrink:0, marginTop:8 }} />}
    </button>
  );
}

// ======================== ADMIN SHARED ================================
export const adminStyles = () => {
  const sel = { width:"100%",padding:"9px 12px",borderRadius: R.md,border:`1px solid ${C.b1}`,fontSize:14.3,fontFamily:"inherit",background:C.bgInput,color:C.t1,boxSizing:"border-box",appearance:"none",WebkitAppearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",paddingRight:30,cursor:"pointer",transition:"border-color 0.15s" };
  const inp = { width:"100%",padding:"9px 12px",borderRadius: R.md,border:`1px solid ${C.b1}`,fontSize:14.3,fontFamily:"inherit",background:C.bgInput,color:C.t1,boxSizing:"border-box",transition:"border-color 0.15s" };
  const half = { ...inp, flex:1 };
  const btnP = (color,dis) => ({ width:"100%",padding:"10px 0",borderRadius: R.md,background:color,color:"#fff",border:"none",fontSize:14.3,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:dis?0.6:1,transition:"opacity 0.15s" });
  const lbl = { fontSize:12.1,fontWeight:600,color:C.t3,marginBottom:4 };
  return { sel, inp, half, btnP, lbl };
};
export const typeColors = { producer:"#F59E0B",plant:"#22C55E",transporter:C.sec };
export const typeLabels = { producer:"Productor",plant:"Planta",transporter:"Transportista" };
export const roleLabels = { platform_admin:"Admin Principal",admin:"Gerente",operator:"Operario",chofer:"Chofer" };
export const adminBackBtn = (onClick) => <button onClick={onClick} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:14.3,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button>;
