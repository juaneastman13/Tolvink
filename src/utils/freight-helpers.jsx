import { C, Ic } from "../theme";
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
  const aa = freight.activeAssignments || [];
  if (!aa.length) {
    if (userType === "plant" && freight.assignedTruckCount < freight.truckCount) {
      return { action: `Asignar ${freight.truckCount - freight.assignedTruckCount} camiones`, color: C.acc, icon: "assign", actionKey: "assign_multi", groupKey: "assign" };
    }
    return null;
  }

  // Plant: check if more trucks needed, authorize own-fleet, or confirm
  if (userType === "plant") {
    if (freight.assignedTruckCount < freight.truckCount) {
      return { action: `Asignar ${freight.truckCount - freight.assignedTruckCount} camiones`, color: C.acc, icon: "assign", actionKey: "assign_multi", groupKey: "assign" };
    }
    // Own-fleet trips pending plant authorization
    const needsAuth = aa.find(a => a.transportCompanyId === freight.originCompanyId && a.tripStatus === "pending");
    if (needsAuth) return { action: `Autorizar viaje #${needsAuth.tripNumber}`, color: C.sec, icon: "authorize", actionKey: "respond_trip", groupKey: "authorize", assignmentId: needsAuth.id };
    // Check for pending confirm_finished on any trip
    const needsFinish = aa.find(a => a.tripStatus === "loaded" && !a.plantFinishedConfirmedAt);
    if (needsFinish) return { action: `Confirmar entrega #${needsFinish.tripNumber}`, color: C.pri, icon: "confirm", actionKey: "confirm_trip_finished", groupKey: "confirm_finished", assignmentId: needsFinish.id };
    return null;
  }

  // Producer: check own-fleet trips AND cross-confirmation pending on any trip
  if (userType === "producer") {
    // Own-fleet trips: producer acts as transporter
    const ownTrips = aa.filter(a => a.transportCompanyId === freight.originCompanyId);
    if (ownTrips.length) {
      const accepted = ownTrips.find(a => a.tripStatus === "accepted");
      if (accepted) return { action: `Iniciar viaje #${accepted.tripNumber}`, color: C.pri, icon: "start", actionKey: "start_trip", groupKey: "start", assignmentId: accepted.id };
      const inProgress = ownTrips.find(a => a.tripStatus === "in_progress" && !a.transporterLoadedConfirmedAt);
      if (inProgress) return { action: `Confirmar carga #${inProgress.tripNumber}`, color: C.acc, icon: "confirm", actionKey: "confirm_trip_loaded", groupKey: "confirm_loaded", assignmentId: inProgress.id };
      const needsFinishOwn = ownTrips.find(a => a.tripStatus === "loaded" && !a.transporterFinishedConfirmedAt);
      if (needsFinishOwn) return { action: `Confirmar entrega #${needsFinishOwn.tripNumber}`, color: C.pri, icon: "confirm", actionKey: "confirm_trip_finished", groupKey: "confirm_finished", assignmentId: needsFinishOwn.id };
    }
    // Cross-confirmation: producer confirms load receipt on any trip
    const needsProducerLoadConfirm = aa.find(a => a.tripStatus === "loaded" && !a.producerLoadedConfirmedAt);
    if (needsProducerLoadConfirm) return { action: `Confirmar carga #${needsProducerLoadConfirm.tripNumber}`, color: C.acc, icon: "confirm", actionKey: "confirm_trip_loaded", groupKey: "confirm_loaded", assignmentId: needsProducerLoadConfirm.id };
    return null;
  }

  // Transporter/chofer: find most urgent among own assignments
  const myAssignments = role === "chofer"
    ? aa.filter(a => a.driverId === user?.id)
    : aa.filter(a => a.transportCompanyId === user?.companyId);
  if (!myAssignments.length) return null;

  // Priority: pending > accepted > in_progress > loaded
  const pending = myAssignments.find(a => a.tripStatus === "pending");
  if (pending) return { action: `Asignar camión #${pending.tripNumber}`, color: C.pri, icon: "truck", actionKey: "edit_trip", groupKey: "assign", assignmentId: pending.id };
  const accepted = myAssignments.find(a => a.tripStatus === "accepted");
  if (accepted) return { action: `Iniciar viaje #${accepted.tripNumber}`, color: C.pri, icon: "start", actionKey: "start_trip", groupKey: "start", assignmentId: accepted.id };
  const inProgress = myAssignments.find(a => a.tripStatus === "in_progress" && !a.transporterLoadedConfirmedAt);
  if (inProgress) return { action: `Confirmar carga #${inProgress.tripNumber}`, color: C.acc, icon: "confirm", actionKey: "confirm_trip_loaded", groupKey: "confirm_loaded", assignmentId: inProgress.id };
  const loaded = myAssignments.find(a => a.tripStatus === "loaded" && !a.transporterFinishedConfirmedAt);
  if (loaded) return { action: `Confirmar entrega #${loaded.tripNumber}`, color: C.pri, icon: "confirm", actionKey: "confirm_trip_finished", groupKey: "confirm_finished", assignmentId: loaded.id };
  return null;
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
    if (s === "assigned") return { action: "Aceptar o rechazar", color: C.sec, icon: "respond", actionKey: "respond", groupKey: "respond" };
    if (s === "accepted") return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress") return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded") return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  if (userType === "plant") {
    if (s === "pending_assignment") return { action: "Asignar transporte", color: C.acc, icon: "assign", actionKey: "assign", groupKey: "assign" };
    if (s === "assigned" && own) return { action: "Autorizar viaje", color: C.sec, icon: "authorize", actionKey: "authorize", groupKey: "authorize" };
    if (s === "loaded" && !freight.plantFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  if (userType === "transporter") {
    if (s === "assigned" && !own) return { action: "Aceptar o rechazar", color: C.sec, icon: "respond", actionKey: "respond", groupKey: "respond" };
    if (s === "accepted") return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress" && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
    if (s === "loaded" && !freight.transporterFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished", groupKey: "confirm_finished" };
    return null;
  }
  if (userType === "producer") {
    if (s === "accepted" && own) return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start", groupKey: "start" };
    if (s === "in_progress" && own && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded", groupKey: "confirm_loaded" };
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
    if (s === "accepted") return own ? "Esperando inicio" : "Esperando inicio transporte";
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
    if (s === "pending_assignment") return "Esperando asignación planta";
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
      <div style={{ width:40, height:40, borderRadius:12, background: n.read ? C.bg : C.priPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
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
      {!n.read && <div style={{ width:8, height:8, borderRadius:4, background:C.pri, flexShrink:0, marginTop:8 }} />}
    </button>
  );
}

// ======================== ADMIN SHARED ================================
export const adminStyles = () => {
  const sel = { width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.b1}`,fontSize:14.3,fontFamily:"inherit",background:C.bgInput,color:C.t1,boxSizing:"border-box",appearance:"none",WebkitAppearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",paddingRight:30,cursor:"pointer",transition:"border-color 0.15s" };
  const inp = { width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.b1}`,fontSize:14.3,fontFamily:"inherit",background:C.bgInput,color:C.t1,boxSizing:"border-box",transition:"border-color 0.15s" };
  const half = { ...inp, flex:1 };
  const btnP = (color,dis) => ({ width:"100%",padding:"10px 0",borderRadius:8,background:color,color:"#fff",border:"none",fontSize:14.3,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:dis?0.6:1,transition:"opacity 0.15s" });
  const lbl = { fontSize:12.1,fontWeight:600,color:C.t3,marginBottom:4 };
  return { sel, inp, half, btnP, lbl };
};
export const typeColors = { producer:"#F59E0B",plant:"#22C55E",transporter:"#14B8A6" };
export const typeLabels = { producer:"Productor",plant:"Planta",transporter:"Transportista" };
export const roleLabels = { platform_admin:"Admin Principal",admin:"Gerente",operator:"Operario",chofer:"Chofer" };
export const adminBackBtn = (onClick) => <button onClick={onClick} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:14.3,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button>;
