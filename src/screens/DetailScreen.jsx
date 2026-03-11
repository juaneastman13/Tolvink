import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { C, Ic, FONT, MONO, track } from "../theme";
import { stCfg, getActions, tripStCfg, POLL_INTERVALS, formatFreightDate } from "../constants";
import { Bd, Btn, Loader, Sec, FileViewer } from "../components";
import { SafeZone } from "../maps";
const FreightMap = lazy(() => import("../maps").then(m => ({ default: m.FreightMap })));
import log from "../logger";
import { DocsGallery, FreightFileUpload, OcrResultModal, UploadOverlay } from "../uploads";
import { apiGetAuditLog, apiSendTracking, apiApprovePendingChange, apiRejectPendingChange, apiOcrAnalyze, apiSaveOcrData, apiUpdateFreight } from "../api";
import { useIsDesktop } from "../hooks";
import { useUIStore } from "../store";
// PDF report loaded lazily to avoid bundle bloat
const loadPdfReport = () => import("../utils/pdf-report");

export default function DetailScreen({ user, freight, perms, onBack, onAction, onTripAction, onEditTrip, onCancelAssignment, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap, sseConnected }) {
  // Guard: freight not yet loaded (deep link, stale reference)
  if (!freight) return <div style={{ padding:40, textAlign:"center" }}><div style={{ fontSize:14, color:C.t3, marginBottom:12 }}>Cargando flete...</div><button onClick={onBack} style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Volver</button></div>;
  const [auditLog, setAuditLog] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pcLoading, setPcLoading] = useState(null);
  const auditRef = useRef(null);
  const show = useUIStore(s => s.show);

  const handleOcr = async (file) => {
    setOcrLoading(true);
    try {
      const res = await apiOcrAnalyze(file.url);
      if (res.error) { log.error("OCR", res.error); show("Error al extraer datos del documento", "err"); return; }
      setOcrResult(res);
      // Auto-save OCR data to document
      if (file.id && freight?.id) {
        apiSaveOcrData(freight.id, file.id, res).then(() => { if (onRefresh) onRefresh(freight.id); }).catch(e => { log.error('ocr-save', e); show('No se pudieron guardar los datos OCR', 'err'); });
      }
    } catch (e) {
      log.error("OCR", "failed:", e);
      show("Error al extraer datos del documento", "err");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleViewOcr = (ocrData) => setOcrResult(ocrData);

  // Pre-load PDF module so download works synchronously on click
  useEffect(() => { loadPdfReport(); }, []);

  // Auto-refresh freight detail — skip when SSE pushes real-time updates, fallback 15s poll otherwise
  useEffect(() => {
    if (!freight?.id || !onRefresh || sseConnected) return;
    const iv = setInterval(() => { if (!document.hidden) onRefresh(freight.id); }, POLL_INTERVALS.DETAIL_REFRESH);
    return () => clearInterval(iv);
  }, [freight?.id, onRefresh, sseConnected]);

  // Auto-load audit log on mount / freight change
  useEffect(() => {
    if (!freight?.id) return;
    let cancelled = false;
    apiGetAuditLog(freight.id).then(logs => { if (!cancelled) setAuditLog(logs); }).catch(() => { if (!cancelled) setAuditLog([]); });
    return () => { cancelled = true; };
  }, [freight?.id]);

  const toggleAudit = () => setShowAudit(v => !v);

  const [stepModal, setStepModal] = useState(null); // {idx, label, color, backendSteps}
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [truckCountLoading, setTruckCountLoading] = useState(false);
  const [truckCountLocal, setTruckCountLocal] = useState(null); // optimistic local override

  // Reset optimistic truck count when freight data refreshes (only if not mid-commit)
  useEffect(() => { if (!truckCountLoading) setTruckCountLocal(null); }, [freight?.truckCount, truckCountLoading]);
  const [truckModal, setTruckModal] = useState(null); // {type:"add"|"remove"}
  const [locSending, setLocSending] = useState(false);
  const [locSent, setLocSent] = useState(false);
  const locTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(locTimerRef.current), []);
  const handleShareLocation = () => {
    if (locSending || locSent || !navigator.geolocation) return;
    setLocSending(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiSendTracking(freight.id, { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed || 0, heading: pos.coords.heading || 0 });
          setLocSent(true);
          locTimerRef.current = setTimeout(() => setLocSent(false), 5000);
        } catch { show("Error al enviar ubicación", "err"); }
        setLocSending(false);
      },
      () => { setLocSending(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleTruckCountTap = (delta) => {
    if (truckCountLoading || !freight) return;
    const current = truckCountLocal ?? (freight.truckCount || 1);
    const next = current + delta;
    if (next < 1 || next > 50) return;
    const assigned = freight.assignedTruckCount || 0;
    if (next < assigned) { show(`No se puede reducir: hay ${assigned} camiones asignados`, "err"); return; }
    // Optimistic: update display immediately
    setTruckCountLocal(next);
    if (delta > 0) {
      setTruckModal({ type: "add", next });
    } else {
      setTruckModal({ type: "remove", next, assigned });
    }
  };

  const commitTruckCount = async (newCount) => {
    setTruckCountLoading(true);
    try {
      await apiUpdateFreight(freight.id, { truckCount: newCount });
      if (onRefresh) onRefresh(freight.id);
    } catch (e) {
      log.error("truckCount", e);
      show(e.message || "Error al actualizar camiones", "err");
      setTruckCountLocal(null); // revert optimistic
    } finally {
      setTruckCountLoading(false);
    }
  };

  const handleTruckModalConfirm = (choice) => {
    // choice: "own_fleet" | "delegate" | "remove_delegate" | "remove_specific"
    const modal = truckModal;
    setTruckModal(null);
    if (!modal) return;
    commitTruckCount(modal.next);
    if (modal.type === "add" && choice === "own_fleet") {
      // After count updated, open assignment flow
      setTimeout(() => onAction(freight.id, "assign"), 600);
    }
  };

  const handleTruckModalCancel = () => {
    setTruckCountLocal(null); // revert
    setTruckModal(null);
  };

  const _isDesktop = useIsDesktop(768);

  const st = freight ? stCfg(freight.status) : null;
  const isMultiTruck = freight?.isMultiTruck && (freight?.truckCount || 1) > 1;
  const isChoferQueued = user.role === "chofer" && (freight?.queuePosition || 0) > 1;
  const actions = !freight ? [] : isMultiTruck ? [] : getActions(freight.status, user.userType, user.role, freight.isOwnFleet);

  // Filter actions based on confirmation state (single-truck only)
  const filteredActions = !freight ? [] : isChoferQueued ? [] : actions.filter(a=>{
    if(a==="confirm_loaded" && user.userType==="transporter" && freight?.transporterLoadedConfirmedAt) return false;
    if(a==="confirm_loaded" && user.userType==="producer" && freight?.producerLoadedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="transporter" && freight?.transporterFinishedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="plant" && freight?.plantFinishedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="producer" && freight?.isOwnFleet && freight?.transporterFinishedConfirmedAt) return false;
    return true;
  });

  // Filter assignments visible to this user (works for both single and multi-truck)
  const visibleAssignments = useMemo(() => {
    const aa = freight?.activeAssignments || [];
    if (aa.length === 0) return [];
    if (user.role === "chofer") return aa.filter(a => a.driverId === user.id);
    if (user.userType === "transporter") return aa.filter(a => a.transportCompanyId === user.companyId);
    return aa; // plant/producer see all
  }, [freight?.activeAssignments, user]);

  // Multi-truck: aggregate top-level actions from all visible trips
  const multiTruckTopActions = useMemo(() => {
    if (!isMultiTruck || isChoferQueued) return [];
    const seen = new Map(); // key -> { label, color, icon, assignmentId, count }
    for (const a of visibleAssignments) {
      const ts = a.tripStatus;
      const isOwn = a.transportCompanyId === freight?.originCompanyId;
      const entries = [];
      if (user.userType === "plant") {
        if (isOwn && ts === "pending") entries.push({ key:"respond_trip_accept", label:"Autorizar viaje", color:C.sec, icon:Ic.chk(C.w,16) });
        if (ts === "loaded" && !a.plantFinishedConfirmedAt) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
      } else if (user.role !== "chofer" && user.userType === "producer" && !isOwn) {
        if (ts === "loaded" && !a.plantFinishedConfirmedAt) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
      }
      if (user.userType === "transporter" || user.role === "chofer") {
        if (ts === "pending") entries.push({ key:"respond_trip_accept", label:"Aceptar viaje", color:C.ok, icon:Ic.chk(C.w,16) });
        if (ts === "accepted") entries.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,16) });
        if (ts === "in_progress" && !a.transporterLoadedConfirmedAt) entries.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,16) });
        if (ts === "loaded" && !a.transporterFinishedConfirmedAt) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
      }
      if (user.userType === "producer" && isOwn) {
        if (ts === "accepted" && !entries.find(e=>e.key==="start_trip")) entries.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,16) });
        if (ts === "in_progress" && !a.transporterLoadedConfirmedAt && !entries.find(e=>e.key==="confirm_trip_loaded")) entries.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,16) });
        if (ts === "loaded" && !a.transporterFinishedConfirmedAt && !entries.find(e=>e.key==="confirm_trip_finished")) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
      }
      if (user.userType === "producer" && !isOwn) {
        if ((ts === "loaded" || ts === "in_progress") && !a.producerLoadedConfirmedAt && !entries.find(e=>e.key==="confirm_trip_loaded"))
          entries.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,16) });
      }
      for (const e of entries) {
        if (!seen.has(e.key)) seen.set(e.key, { ...e, assignmentId: a.id, tripNumber: a.tripNumber, count: 1 });
        else seen.get(e.key).count++;
      }
    }
    return [...seen.values()];
  }, [isMultiTruck, isChoferQueued, visibleAssignments, freight, user]);

  if(!freight) return null;

  // Per-trip action for a given assignment
  const getTripActions = (a) => {
    const btns = [];
    const ts = a.tripStatus;
    const isOwnFleetTrip = a.transportCompanyId === freight.originCompanyId;
    if (user.userType === "plant") {
      // Plant authorizes own-fleet trips
      if (isOwnFleetTrip && ts === "pending") btns.push({ key:"respond_trip_accept", label:"Autorizar", color:C.sec, icon:Ic.chk(C.w,14) });
      if (ts === "loaded" && !a.plantFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    } else if (user.role !== "chofer" && user.userType === "producer" && !isOwnFleetTrip) {
      if (ts === "loaded" && !a.plantFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    }
    if (user.userType === "transporter" || user.role === "chofer") {
      if (ts === "pending") btns.push({ key:"respond_trip_accept", label:"Aceptar", color:C.ok, icon:Ic.chk(C.w,14) }, { key:"respond_trip_reject", label:"Rechazar", color:C.err, icon:Ic.ban(C.w,14) });
      if (ts === "accepted") btns.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,14) });
      if (ts === "in_progress" && !a.transporterLoadedConfirmedAt) btns.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,14) });
      if (ts === "loaded" && !a.transporterFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    }
    if (user.userType === "producer" && isOwnFleetTrip) {
      if (ts === "accepted") btns.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,14) });
      if (ts === "in_progress" && !a.transporterLoadedConfirmedAt) btns.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,14) });
      if (ts === "loaded" && !a.transporterFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    }
    if (user.userType === "producer" && !isOwnFleetTrip) {
      if ((ts === "loaded" || ts === "in_progress") && !a.producerLoadedConfirmedAt && !btns.find(b=>b.key==="confirm_trip_loaded"))
        btns.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,14) });
    }
    return btns;
  };

  return (
    <div style={{ flex:1, overflow:"auto", animation:"slideUp 0.25s ease" }}>
      {/* Sticky header — back + product title */}
      <div style={{ position:"sticky", top:0, zIndex:10, padding:"18px 18px 8px", background:C.bg }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14.3, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:12.1, color:C.t3, fontWeight:600, fontFamily:MONO }}>{freight.code}</span>
            {st && <span style={{ fontSize:9.9, fontWeight:700, color:st.color, background:st.bg, padding:"1px 6px", borderRadius:4, textTransform:"uppercase", letterSpacing:0.3 }}>{st.label}</span>}
          </div>
          {freight.loadDate && <div style={{ fontSize:12.1, color:C.t3, fontWeight:500, marginTop:2 }}>{formatFreightDate(freight.loadDate)}</div>}
          <div style={{ fontSize:24.2, fontWeight:800, marginTop:2, letterSpacing:-0.3 }}>{freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · {freight.tons} {freight.unit||"tn"}</div>
        </div>
      </div>

      <div style={{ padding:"0 18px 18px" }}>

      {/* Queue banner for chofer */}
      {isChoferQueued && <div style={{ background:`${C.info}10`, border:`1.5px solid ${C.info}30`, borderRadius:12, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ display:"flex" }}>{Ic.clk(C.info,20)}</span>
        <div>
          <div style={{ fontSize:14.3, fontWeight:700, color:C.info }}>En cola #{freight.queuePosition}</div>
          <div style={{ fontSize:12.1, color:C.t2 }}>Debés completar los fletes anteriores primero</div>
        </div>
      </div>}

      {freight.status === "pending_assignment" && user.userType === "producer" && freight.useOwnFleet === false && (
        <div style={{ background:`${C.info}10`, border:`1.5px solid ${C.info}30`, borderRadius:12, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ display:"flex" }}>{Ic.clk(C.info,20)}</span>
          <div>
            <div style={{ fontSize:14.3, fontWeight:700, color:C.info }}>Pendiente de asignación por planta</div>
            <div style={{ fontSize:12.1, color:C.t2 }}>La planta de destino asignará el transportista</div>
          </div>
        </div>
      )}

      {/* Primary actions — flow-advancing (sticky on mobile) */}
      {(()=>{
        const primary = [];
        if(filteredActions.includes("authorize")) primary.push(<Btn key="auth" full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"authorize")}>{actionLoading?"Procesando...":"Autorizar viaje"}</Btn>);
        if(filteredActions.includes("assign")) primary.push(<Btn key="assign" full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"assign")}>Asignar transportista</Btn>);
        if(filteredActions.includes("accept")) primary.push(<Btn key="accept" full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"accept")}>Aceptar flete</Btn>);
        if(filteredActions.includes("start")) primary.push(<Btn key="start" full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"start")}>{actionLoading?"Procesando...":"Iniciar viaje"}</Btn>);
        if(filteredActions.includes("confirm_loaded")) primary.push(<Btn key="loaded" full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_loaded")}>{actionLoading?"Procesando...":"Confirmar carga"}</Btn>);
        if(filteredActions.includes("confirm_finished")) primary.push(<Btn key="finished" full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_finished")}>{actionLoading?"Procesando...":"Confirmar entrega"}</Btn>);
        if(primary.length===0) return null;
        // Desktop: inline; Mobile: sticky bottom bar
        return _isDesktop
          ? <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>{primary}</div>
          : <div style={{ position:"sticky", bottom:0, zIndex:10, background:C.w, padding:"10px 0 max(10px, env(safe-area-inset-bottom))", borderTop:`1px solid ${C.b2}`, marginLeft:-18, marginRight:-18, paddingLeft:18, paddingRight:18, boxShadow:"0 -2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{primary}</div>
            </div>;
      })()}
      {["in_progress","loaded"].includes(freight.status) && navigator.geolocation && (
        <div style={{ marginBottom:12 }}>
          <Btn full v="sec" sm icon={Ic.pin(locSent?C.ok:C.pri,14)} disabled={locSending} onClick={handleShareLocation}>
            {locSending ? "Enviando..." : locSent ? "Ubicaci\u00f3n enviada" : "Compartir mi ubicaci\u00f3n"}
          </Btn>
        </div>
      )}

      {/* Multi-truck: top-level action buttons */}
      {multiTruckTopActions.length > 0 && <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {multiTruckTopActions.map(a => (
          <button key={a.key} disabled={actionLoading} onClick={()=>onTripAction && onTripAction(freight.id, a.assignmentId, a.key)}
            style={{ width:"100%", padding:"14px 20px", borderRadius:12, border:"none", background:a.color, color:C.w, fontSize:16.5, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:actionLoading?0.6:1 }}>
            {a.icon} {actionLoading?"Procesando...":a.label}{a.count>1?` (${a.count})`:a.count===1?` #${a.tripNumber}`:""}
          </button>
        ))}
      </div>}

      {/* Progress — click to see per-stage detail */}
      {(()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const curIdx = steps.indexOf(freight.status);
        const isCanceled = freight.status === "canceled";
        // Visual stepper: 3 steps
        const subLabels = { assigned:"Asignado", accepted:"Asignado", in_progress:"En viaje a campo", loaded:"En viaje a planta" };
        const visualIdx = isCanceled ? (curIdx >= 1 ? (curIdx >= 3 ? 2 : 1) : 0) : curIdx === 0 ? 0 : curIdx <= 4 ? 1 : 2;
        // Multi-truck: build per-assignment status breakdown
        const multiTruckSub = isMultiTruck && [1,2,3,4].includes(curIdx) ? (freight.activeAssignments||[]).map(a => ({ n: a.tripNumber, cfg: tripStCfg(a.tripStatus) })) : null;
        const singleSub = [1,2,3,4].includes(curIdx) || isCanceled ? subLabels[freight.status] || subLabels[steps[curIdx]] : null;
        const visualSteps = [
          { label:"Pendiente", color:C.acc },
          { label:"En curso", color:C.pri, sub: !multiTruckSub ? singleSub : null, multiSub: multiTruckSub },
          { label: isCanceled ? "Cancelado" : "Finalizado", color: isCanceled ? C.err : C.ok },
        ];
        const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; } };
        const actionLabels = { created:"Solicitado", assigned:"Asignado", assigned_multi:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Iniciado", confirm_loaded:"Carga OK", confirm_finished:"Entrega OK", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado", trip_accepted:"Aceptado", trip_rejected:"Rechazado", trip_started:"Iniciado", trip_confirm_loaded:"Carga OK", trip_confirm_finished:"Entrega OK", trip_finished:"Finalizado", assignment_canceled:"Cancelado", assignment_updated:"Editado" };
        const actionColors = { created:C.pri, assigned:C.sec, assigned_multi:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2, trip_accepted:C.info, trip_rejected:C.err, trip_started:C.acc, trip_confirm_loaded:C.acc, trip_confirm_finished:C.pri, trip_finished:C.ok, assignment_canceled:C.err, assignment_updated:C.t2 };
        const stepAuditActions = {
          pending_assignment:["created"],
          assigned:["assigned","assigned_multi","assignment_updated","assignment_canceled"],
          accepted:["accepted","authorized","trip_accepted","trip_rejected"],
          in_progress:["started","trip_started"],
          loaded:["confirm_loaded","trip_confirm_loaded"],
          finished:["confirm_finished","finished","trip_confirm_finished","trip_finished","canceled"],
        };
        const stepToTrip = { assigned:"pending", accepted:"accepted", in_progress:"in_progress", loaded:"loaded", finished:"finished" };
        const tripRank = { pending:0, accepted:1, in_progress:2, loaded:3, finished:4 };
        const getStepLogs = (step) => { if(!auditLog) return []; return auditLog.filter(l=>(stepAuditActions[step]||[]).includes(l.action)); };
        const getTruckCount = (step) => { if(!isMultiTruck) return null; const ts=stepToTrip[step]; if(!ts) return null; const rank=tripRank[ts]??0; return (freight.activeAssignments||[]).filter(a=>(tripRank[a.tripStatus]??0)>=rank).length; };
        const tripLabel = (log) => { const tn = log.metadata?.tripNumber; return tn ? `Viaje #${tn}` : null; };
        // Get assignments exactly at a given tripStatus (for showing truck details per stage)
        const getStepAssignments = (step) => { if(!isMultiTruck) return []; const ts=stepToTrip[step]; if(!ts) return []; return (freight.activeAssignments||[]).filter(a=>a.tripStatus===ts); };
        return <div ref={auditRef} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh, position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:11.6, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Progreso</span>
            <button onClick={toggleAudit} style={{ fontSize:12.1, fontWeight:700, color:C.t1, background:C.bg, border:`1.5px solid ${C.b1}`, borderRadius:8, padding:"5px 14px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 }}>
              {showAudit?"Ocultar detalle":"Ver detalle"} <span style={{ fontSize:9.9, marginTop:1 }}>{showAudit?"\u25B2":"\u25BC"}</span>
            </button>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"flex-start"}}>
            {visualSteps.map((vs,i)=>{
              const done = i < visualIdx; const active = i === visualIdx && !isCanceled; const isCancelStep = i === 2 && isCanceled;
              const barColor = done ? C.pri : active ? vs.color : isCancelStep ? C.err : C.b1;
              const visualAuditMap = [["pending_assignment"],["assigned","accepted","in_progress","loaded"],["finished"]];
              return <div key={i} onClick={()=>setStepModal({idx:i,label:vs.label,color:vs.color,backendSteps:visualAuditMap[i]})} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0,cursor:"pointer"}}>
                <div style={{width:"100%",height:active?5:4,borderRadius:3,background:barColor,transition:"all 0.2s"}}/>
                {(active || isCancelStep) && <div style={{width:6,height:6,borderRadius:3,background:vs.color,marginTop:-2}}/>}
                <span style={{fontSize:13.2,fontWeight:(active||isCancelStep)?700:500,color:(active||isCancelStep)?vs.color:done?C.t2:C.t3,textAlign:"center",lineHeight:1.2}}>{vs.label}</span>
                {active && vs.sub && <span style={{fontSize:11.6,color:C.t3,fontStyle:"italic",textAlign:"center",lineHeight:1.2,marginTop:-2}}>({vs.sub})</span>}
                {active && vs.multiSub && vs.multiSub.length > 0 && <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:-1,alignItems:"center"}}>
                  {vs.multiSub.map(t => <span key={t.n} style={{fontSize:10.5,color:t.cfg.color,fontWeight:600,lineHeight:1.2}}>#{t.n} {t.cfg.label}</span>)}
                </div>}
              </div>;
            })}
          </div>
          {/* Per-stage detail — 3 columns matching visual stepper */}
          {showAudit && !auditLog && <div style={{textAlign:"center",padding:"12px 0",fontSize:12.1,color:C.t3}}>Cargando detalle...</div>}
          {showAudit && auditLog && (()=>{
            const visualAuditSteps = [
              { label:"Pendiente", backendSteps:["pending_assignment"], color:C.acc },
              { label:"En curso", backendSteps:["assigned","accepted","in_progress","loaded"], color:C.pri },
              { label: isCanceled ? "Cancelado" : "Finalizado", backendSteps:["finished"], color: isCanceled ? C.err : C.ok },
            ];
            return <div style={{ display:"flex", gap:3, marginTop:12, borderTop:`1px solid ${C.b1}`, paddingTop:10 }}>
              {visualAuditSteps.map((vas,vi)=>{
                const done = vi < visualIdx; const active = vi === visualIdx && !isCanceled; const isCancelStep = vi === 2 && isCanceled;
                const col = done ? C.pri : (active || isCancelStep) ? vas.color : C.t3;
                const logs = vas.backendSteps.flatMap(s => getStepLogs(s));
                const stepAssigns = vas.backendSteps.flatMap(s => getStepAssignments(s));
                const tc = isMultiTruck && vi === 1 ? (()=>{ const counts = vas.backendSteps.map(s => getTruckCount(s)).filter(v=>v!==null); return counts.length > 0 ? Math.max(...counts) : null; })() : null;
                const hasData = logs.length > 0 || (tc !== null && tc > 0);
                return (
                  <div key={vi} style={{ flex:1, minWidth:0 }}>
                    {tc !== null && (
                      <div style={{ textAlign:"center", fontSize:11, fontWeight:700, color:col, marginBottom:8, background:`${col}12`, borderRadius:5, padding:"3px 0" }}>
                        {tc}/{freight.truckCount}
                      </div>
                    )}
                    {logs.length > 0 && logs.map(entry => {
                      const acCol = actionColors[entry.action] || C.t2;
                      const tn = tripLabel(entry);
                      return (
                        <div key={entry.id} style={{ display:"flex", gap:5, marginBottom:8, alignItems:"flex-start" }}>
                          <div style={{ width:7, height:7, borderRadius:4, background:acCol, flexShrink:0, marginTop:3 }} />
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:11.6, fontWeight:700, color:acCol, lineHeight:1.3 }}>{actionLabels[entry.action]||entry.action}{tn ? ` · ${tn}` : ""}</div>
                            <div style={{ fontSize:11, color:C.t2, marginTop:1, lineHeight:1.3, wordBreak:"break-word" }}>{entry.user?.name||"Sistema"}</div>
                            {entry.user?.company?.name && <div style={{ fontSize:10.5, color:C.t3, lineHeight:1.2 }}>{entry.user.company.name}</div>}
                            {(entry.reason || entry.metadata?.reason) && <div style={{ fontSize:10.5, color:C.t3, fontStyle:"italic", marginTop:1 }}>"{entry.reason||entry.metadata.reason}"</div>}
                            {entry.metadata?.confirmedBy && <div style={{ fontSize:10.5, color:C.t3, marginTop:1 }}>por {entry.metadata.confirmedBy==="transporter"?"transportista":entry.metadata.confirmedBy==="producer"?"productor":entry.metadata.confirmedBy==="plant"?"planta":entry.metadata.confirmedBy}</div>}
                            <div style={{ fontSize:10.5, color:C.t3, marginTop:1 }}>{fmtD(entry.createdAt)}</div>
                          </div>
                        </div>
                      );
                    })}
                    {logs.length === 0 && stepAssigns.length > 0 && stepAssigns.map(a => (
                      <div key={a.id} style={{ display:"flex", gap:5, marginBottom:8, alignItems:"flex-start" }}>
                        <div style={{ width:7, height:7, borderRadius:4, background:col, flexShrink:0, marginTop:3 }} />
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.t1 }}>Viaje #{a.tripNumber}</div>
                          {a.plate && <div style={{ fontSize:11, color:C.t2, marginTop:1, lineHeight:1.3 }}>{a.plate}{a.truckModel?` · ${a.truckModel}`:""}</div>}
                          {a.transporterName && <div style={{ fontSize:10.5, color:C.t3, lineHeight:1.2 }}>{a.transporterName}</div>}
                          {a.driverName && <div style={{ fontSize:10.5, color:C.t3, lineHeight:1.2 }}>{a.driverName}</div>}
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && stepAssigns.length === 0 && hasData && <div style={{ fontSize:9.9, color:C.t3, textAlign:"center" }}>{"\u2014"}</div>}
                  </div>
                );
              })}
            </div>;
          })()}
        </div>;
      })()}

      {/* Camiones section — always visible */}
      {freight.status !== "canceled" && (()=>{
        const truckCount = freight.truckCount || 1;
        const assignedCount = freight.assignedTruckCount || freight.activeAssignments?.length || 0;
        const canEditCount = (perms.canRequest || perms.canApprove) && !["finished","canceled"].includes(freight.status);
        const showProgressBar = truckCount > 1;
        return <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          {/* Header: title + count + stepper */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:showProgressBar||visibleAssignments.length>0?12:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ display:"flex" }}>{Ic.truck(C.t2,16)}</span>
              <span style={{ fontSize:11.6, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Camiones</span>
              {canEditCount && (()=>{
                const displayCount = truckCountLocal ?? truckCount;
                return <div style={{ display:"flex", alignItems:"center", gap:3, marginLeft:4 }}>
                <button disabled={truckCountLoading||displayCount<=1||displayCount<=assignedCount} onClick={(e)=>{e.stopPropagation();handleTruckCountTap(-1);}} style={{ width:30, height:30, borderRadius:7, border:`1.5px solid ${C.b1}`, background:C.bg, cursor:(truckCountLoading||displayCount<=1||displayCount<=assignedCount)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(truckCountLoading||displayCount<=1||displayCount<=assignedCount)?0.35:1, transition:"opacity 0.1s" }}>{Ic.minus(C.t1,15)}</button>
                <span style={{ fontSize:15, fontWeight:800, color:C.t1, minWidth:28, textAlign:"center" }}>{displayCount}</span>
                <button disabled={truckCountLoading||displayCount>=50} onClick={(e)=>{e.stopPropagation();handleTruckCountTap(1);}} style={{ width:30, height:30, borderRadius:7, border:`1.5px solid ${C.b1}`, background:C.bg, cursor:(truckCountLoading||displayCount>=50)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(truckCountLoading||displayCount>=50)?0.35:1, transition:"opacity 0.1s" }}>{Ic.plus(C.t1,15)}</button>
              </div>;})()}
            </div>
            <span style={{ fontSize:12.1, fontWeight:600, color:C.info }}>{assignedCount}/{truckCountLocal ?? truckCount} asignados</span>
          </div>
          {/* Progress bar (multi-truck) */}
          {showProgressBar && <div style={{ height:6, borderRadius:3, background:C.b1, marginBottom:14, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:3, background: assignedCount >= (truckCountLocal ?? truckCount) ? C.ok : C.info, width:`${Math.min(100, (assignedCount / (truckCountLocal ?? truckCount)) * 100)}%`, transition:"width 0.3s" }}/>
          </div>}
          {/* Assignment cards */}
          {visibleAssignments.map(a => {
            const tst = tripStCfg(a.tripStatus);
            const isExpanded = expandedTrip === a.id;
            const tripBtns = isMultiTruck ? getTripActions(a) : [];
            const mainBtn = tripBtns[0]; // primary action for inline display
            return (
              <div key={a.id} style={{ border:`1px solid ${tst.color}30`, borderLeft:`3px solid ${tst.color}`, borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                <div onClick={()=>setExpandedTrip(isExpanded?null:a.id)} style={{ padding:"10px 12px", cursor:"pointer", background:isExpanded?`${tst.color}06`:"transparent" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {isMultiTruck && <span style={{ fontSize:13.2, fontWeight:800, color:tst.color }}>#{a.tripNumber}</span>}
                    <span style={{ fontSize:13.2, fontWeight:600, color:C.t1, flex:1, minWidth:0 }}>
                      <span style={{ display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.plate || "Sin camión"}{a.transporterName ? ` · ${a.transporterName}` : ""}</span>
                      {a.driverName && <span style={{ display:"block", fontSize:11.6, fontWeight:400, color:C.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.driverName}{a.driverPhone?` · ${a.driverPhone}`:""}</span>}
                    </span>
                    {/* Action button inline (right side) */}
                    {!isExpanded && mainBtn && (
                      <button disabled={actionLoading} onClick={(e)=>{e.stopPropagation(); onTripAction && onTripAction(freight.id, a.id, mainBtn.key);}} style={{ padding:"6px 10px", borderRadius:7, border:"none", background:mainBtn.color, color:C.w, fontSize:11, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, opacity:actionLoading?0.6:1, whiteSpace:"nowrap", flexShrink:0 }}>
                        {mainBtn.icon} {actionLoading?"...":mainBtn.label}
                      </button>
                    )}
                    {!mainBtn && <Bd color={tst.color} bg={tst.bg} small>{tst.label}</Bd>}
                    <span style={{ display:"flex", transform:isExpanded?"rotate(-90deg)":"rotate(0deg)", transition:"transform 0.15s", flexShrink:0 }}>{Ic.chev(C.t3,14)}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.b2}` }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:12.7, color:C.t2, marginBottom:tripBtns.length>0?10:0 }}>
                      <Bd color={tst.color} bg={tst.bg} small>{tst.label}</Bd>
                      {a.transporterName && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.truck(C.t3,12)} {a.transporterName}</div>}
                      {a.plate && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.truck(C.acc,12)} {a.plate}{a.truckModel?` · ${a.truckModel}`:""}</div>}
                      {a.driverName && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.user(C.pri,12)} {a.driverName}{a.driverPhone?` · ${a.driverPhone}`:""}</div>}
                      {a.tons && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.grain(C.t3,12)} {a.tons} tn</div>}
                      {(a.tripStatus === "in_progress" || a.tripStatus === "loaded") && (
                        <div style={{ display:"flex", gap:12, marginTop:6 }}>
                          <div>
                            <span style={{ fontSize:9.9, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Carga: </span>
                            <span style={{ fontSize:11, display:"inline-flex", alignItems:"center", gap:3 }}>{a.transporterLoadedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Transp.</span> {a.producerLoadedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Prod.</span></span>
                          </div>
                          {a.tripStatus === "loaded" && <div>
                            <span style={{ fontSize:9.9, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Entrega: </span>
                            <span style={{ fontSize:11, display:"inline-flex", alignItems:"center", gap:3 }}>{a.transporterFinishedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Transp.</span> {a.plantFinishedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Planta</span></span>
                          </div>}
                        </div>
                      )}
                    </div>
                    {tripBtns.length > 0 && (
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {tripBtns.map(b => (
                          <button key={b.key} disabled={actionLoading} onClick={()=>onTripAction && onTripAction(freight.id, a.id, b.key)} style={{ flex:"1 1 auto", padding:"10px 12px", minWidth:80, minHeight:40, borderRadius:8, border:"none", background:b.color, color:C.w, fontSize:12.7, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:actionLoading?0.6:1 }}>
                            {b.icon} {actionLoading?"...":b.label}
                          </button>
                        ))}
                        {user.userType === "plant" && (a.tripStatus === "pending" || a.tripStatus === "accepted") && a.transportCompanyId !== freight.originCompanyId && onEditTrip && (
                          <button onClick={(e)=>{e.stopPropagation(); onEditTrip(freight.id, a);}} style={{ padding:"8px 12px", minHeight:36, borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12.1, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
                            {Ic.doc(C.t2,12)} Editar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty placeholder lines for unassigned truck slots */}
          {Array.from({ length: Math.max(0, (truckCountLocal ?? truckCount) - assignedCount) }, (_, i) => (
            <div key={`empty-${i}`} style={{ border:`1px dashed ${C.b1}`, borderLeft:`3px solid ${C.b1}`, borderRadius:10, marginBottom:8, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
              {isMultiTruck && <span style={{ fontSize:13.2, fontWeight:800, color:C.t3 }}>#{assignedCount + i + 1}</span>}
              <span style={{ fontSize:13.2, fontWeight:500, color:C.t3, flex:1, fontStyle:"italic" }}>Pendiente de asignar</span>
              {(perms.canApprove || (user.userType === "producer" && freight.useOwnFleet)) && (
                <button onClick={()=>onAction(freight.id,"assign")} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.acc}`, background:`${C.acc}0D`, color:C.acc, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", flexShrink:0 }}>
                  {Ic.plus(C.acc,12)} Asignar
                </button>
              )}
            </div>
          ))}
        </div>;
      })()}

      {/* Truck add/remove modal */}
      {truckModal && (
        <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.4)" }} onClick={handleTruckModalCancel}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius:16, padding:"24px 20px", width:"min(340px,90vw)", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
            {truckModal.type === "add" ? (<>
              <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:4 }}>Agregar camión</div>
              <div style={{ fontSize:13.2, color:C.t3, marginBottom:16 }}>¿El camión adicional es de flota propia o se delega a la planta?</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button onClick={()=>handleTruckModalConfirm("own_fleet")} style={{ width:"100%", padding:"12px 0", borderRadius:10, border:"none", background:C.pri, color:C.w, fontSize:14.3, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {Ic.truck(C.w,14)} Flota propia — Asignar ahora
                </button>
                <button onClick={()=>handleTruckModalConfirm("delegate")} style={{ width:"100%", padding:"12px 0", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:14.3, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Delegar a planta
                </button>
                <button onClick={handleTruckModalCancel} style={{ width:"100%", padding:"10px 0", borderRadius:10, border:"none", background:"transparent", color:C.t3, fontSize:13.2, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
              </div>
            </>) : (<>
              <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:4 }}>Reducir camiones</div>
              <div style={{ fontSize:13.2, color:C.t3, marginBottom:16 }}>
                {visibleAssignments.length > 0
                  ? "¿Desea quitar un camión específico o delegar la decisión a la planta?"
                  : "Se reducirá la cantidad de camiones solicitados."}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {visibleAssignments.length > 0 && visibleAssignments.filter(a=>a.tripStatus==="pending"||a.tripStatus==="accepted").map(a => (
                  <button key={a.id} onClick={async()=>{const nextCount=truckModal?.next;setTruckModal(null);if(onCancelAssignment){const r=await onCancelAssignment(freight.id,a.id,"Reducción de camiones");if(r&&r.ok){commitTruckCount(nextCount);}else{setTruckCountLocal(null);show(r?.error||"No se pudo quitar el camión","err");}}}} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:13.2, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8, textAlign:"left" }}>
                    <span style={{ fontSize:12.1, fontWeight:700, color:C.err }}>Quitar</span>
                    <span>{a.plate || "Sin placa"}</span>
                    {a.transporterName && <span style={{ color:C.t3, fontSize:12.1 }}>· {a.transporterName}</span>}
                  </button>
                ))}
                <button onClick={()=>handleTruckModalConfirm("remove_delegate")} style={{ width:"100%", padding:"12px 0", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:14.3, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Delegar a planta
                </button>
                <button onClick={handleTruckModalCancel} style={{ width:"100%", padding:"10px 0", borderRadius:10, border:"none", background:"transparent", color:C.t3, fontSize:13.2, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* Cross-confirmations panel (single-truck only) */}
      {!isMultiTruck && (freight.status==="loaded" || freight.status==="in_progress") && (
        <div style={{ background:C.w, border:`1px solid ${C.acc}30`, borderLeft:`3px solid ${C.acc}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          <div style={{ fontSize:11.6, fontWeight:700, marginBottom:12, color:C.acc, textTransform:"uppercase", letterSpacing:0.5 }}>Confirmaciones</div>
          <div style={{display:"flex",gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Carga</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12.7}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.transporterLoadedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.transporterLoadedConfirmedAt ? Ic.chk(C.ok,12) : Ic.clk(C.acc,11)}
                  </span>
                  <span style={{color:freight.transporterLoadedConfirmedAt?C.ok:C.t2,fontWeight:freight.transporterLoadedConfirmedAt?600:400}}>Transportista</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12.7}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.producerLoadedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.producerLoadedConfirmedAt ? Ic.chk(C.ok,12) : Ic.clk(C.acc,11)}
                  </span>
                  <span style={{color:freight.producerLoadedConfirmedAt?C.ok:C.t2,fontWeight:freight.producerLoadedConfirmedAt?600:400}}>Productor</span>
                </div>
              </div>
            </div>
            <div style={{width:1,background:C.b1}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Entrega</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12.7}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.transporterFinishedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.transporterFinishedConfirmedAt ? Ic.chk(C.ok,12) : Ic.clk(C.acc,11)}
                  </span>
                  <span style={{color:freight.transporterFinishedConfirmedAt?C.ok:C.t2,fontWeight:freight.transporterFinishedConfirmedAt?600:400}}>Transportista</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12.7}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.plantFinishedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.plantFinishedConfirmedAt ? Ic.chk(C.ok,12) : Ic.clk(C.acc,11)}
                  </span>
                  <span style={{color:freight.plantFinishedConfirmedAt?C.ok:C.t2,fontWeight:freight.plantFinishedConfirmedAt?600:400}}>Planta</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info + Map — side by side on desktop */}
      <div style={{ display:"flex", flexDirection:_isDesktop?"row":"column", gap:12, marginBottom:12, alignItems:_isDesktop?"stretch":undefined }}>
        <div style={{ flex:1, background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, boxShadow:C.sh }}>
          {(()=>{
            const InfoRow = ({ic,label,val,isLast}) => (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:isLast?"none":`1px solid ${C.b2}` }}>
                <span style={{display:"flex",flexShrink:0}}>{ic}</span>
                <span style={{ fontSize:12.7, color:C.t2, minWidth:85 }}>{label}</span>
                {label==="Teléfono"?<a href={`tel:${val}`} style={{ fontSize:13.2, fontWeight:600, color:C.info, marginLeft:"auto", textDecoration:"none" }}>{val}</a>:
                <span style={{ fontSize:13.2, fontWeight:600, color:C.t1, marginLeft:"auto", textAlign:"right" }}>{val}</span>}
              </div>
            );
            const carga = [
              [Ic.grain(C.t2,15),"Producto",`${freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · ${freight.tons} ${freight.unit||"tn"}`],
              freight.amount>0&&[Ic.grain(C.t2,15),"Importe",`$${Number(freight.amount).toLocaleString()}`],
            ].filter(Boolean);
            const ruta = [
              [Ic.user(C.pri,15),"Empresa",freight.originCompanyName||freight.originName],
              [Ic.grain(C.ok,15),"Campo",[freight.fieldName,freight.originName].filter(Boolean).join(" / ")||"—"],
              [Ic.plant(C.t2,15),"Destino",freight.destName],
              [Ic.cal(C.t2,15),"Fecha carga",formatFreightDate(freight.loadDate)],
              [Ic.clk(C.t2,15),"Hora carga",freight.loadTime],
              [Ic.user(C.t2,15),"Solicitado por",freight.requestedByName],
            ].filter(Boolean);
            const allRows = [...carga.map((r,i)=>["c"+i,...r]), ...ruta.map((r,i)=>["r"+i,...r])];
            return <>
              {allRows.map(([key,ic,label,val],i)=><InfoRow key={key} ic={ic} label={label} val={val} isLast={i===allRows.length-1}/>)}
            </>;
          })()}
        </div>
        <div style={{ flex:1 }}>
          <Suspense fallback={<div style={{height:300,display:"flex",alignItems:"center",justifyContent:"center",color:C.t3,fontSize:13}}>Cargando mapa...</div>}>
            <FreightMap freightId={freight.id} originLat={freight.originLat} originLng={freight.originLng} destLat={freight.destLat} destLng={freight.destLng} originName={[freight.originCompanyName, [freight.fieldName,freight.originName].filter(Boolean).join("/")].filter(Boolean).join(" — ")} destName={freight.destName} status={freight.status} isDriver={user.userType==="transporter"||(user.userType==="producer"&&freight.isOwnFleet)}/>
          </Suspense>
        </div>
      </div>

      {/* Notes / Observaciones */}
      {freight.notes && (
        <div style={{ background:C.warnPale, border:`1px solid ${C.warn}30`, borderLeft:`3px solid ${C.warn}`, borderRadius:12, padding:14, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            {Ic.doc(C.warn, 14)}
            <span style={{ fontSize:11.6, fontWeight:700, color:C.warn, textTransform:"uppercase", letterSpacing:0.5 }}>Observaciones</span>
          </div>
          <div style={{ fontSize:13.8, color:C.t1, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{freight.notes}</div>
        </div>
      )}

      {/* Pending changes banner */}
      {freight.pendingChanges?.length > 0 && (()=>{
        const myCompanyId = user.activeCompanyId || user.companyId;
        return freight.pendingChanges.map(pc => {
          const isApprover = pc.approverCompanyId === myCompanyId;
          const label = pc.changeType === "useOwnFleet"
            ? `Cambio de flota propia: ${pc.fromValue?.useOwnFleet ? "Sí" : "No"} → ${pc.toValue?.useOwnFleet ? "Sí" : "No"}`
            : pc.changeType === "destPlant"
              ? `Cambio de destino: ${pc.fromValue?.destName || "—"} → ${pc.toValue?.destName || "—"}`
              : "Cambio pendiente";
          return <div key={pc.id} style={{ background:C.infoPale||"#e8f4fd", border:`1.5px solid ${C.info}30`, borderLeft:`3px solid ${C.info}`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              {Ic.doc(C.info, 14)}
              <span style={{ fontSize:11.6, fontWeight:700, color:C.info, textTransform:"uppercase", letterSpacing:0.5 }}>Cambio pendiente de aprobación</span>
            </div>
            <div style={{ fontSize:13.2, color:C.t1, marginBottom:isApprover?10:0 }}>{label}{pc.requestedBy?.name ? ` — solicitado por ${pc.requestedBy.name}` : ""}</div>
            {isApprover && <div style={{ display:"flex", gap:8 }}>
              <Btn sm disabled={pcLoading===pc.id} onClick={async()=>{ setPcLoading(pc.id); try { await apiApprovePendingChange(freight.id, pc.id); onRefresh(freight.id); } catch(e) { log.error("approve-pc",e); show("Error al procesar el cambio", "err"); } finally { setPcLoading(null); } }}>Aprobar</Btn>
              <Btn sm v="err" disabled={pcLoading===pc.id} onClick={async()=>{ setPcLoading(pc.id); try { await apiRejectPendingChange(freight.id, pc.id); onRefresh(freight.id); } catch(e) { log.error("reject-pc",e); show("Error al procesar el cambio", "err"); } finally { setPcLoading(null); } }}>Rechazar</Btn>
            </div>}
            {!isApprover && <div style={{ fontSize:11.6, color:C.t3, marginTop:4 }}>Esperando aprobación de la otra parte</div>}
          </div>;
        });
      })()}

      {/* Own fleet banners */}
      {(freight.useOwnFleet === true || (freight.useOwnFleet == null && freight.isOwnFleet)) && (()=>{
        const banners = {
          assigned: { icon:Ic.truck(C.acc,20), bg:C.accPale, border:C.acc, title:"Flota propia — esperando autorización", desc: user.userType==="plant" ? "El productor asignó su propio camión. Autorizá el viaje para continuar." : "Tu camión fue asignado. La planta debe autorizar el viaje." },
          accepted: { icon:Ic.chk(C.ok,20), bg:C.okPale, border:C.ok, title:"Viaje autorizado por la planta", desc: user.userType==="producer" ? "Ya podés iniciar el viaje con tu camión." : "El productor puede iniciar el viaje con su flota propia." },
          in_progress: { icon:Ic.truck(C.pri,20), bg:C.priPale, border:C.pri, title:"En viaje — flota propia", desc:"El productor viaja con su propio camión." },
        };
        const b = banners[freight.status];
        if(!b) return null;
        return <div style={{ background:b.bg, border:`1.5px solid ${b.border}30`, borderRadius:12, padding:14, marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          {b.icon}
          <div>
            <div style={{ fontSize:13.2, fontWeight:700, color:b.border }}>{b.title}</div>
            <div style={{ fontSize:12.1, color:C.t2 }}>{b.desc}</div>
          </div>
        </div>;
      })()}

      {/* Documents: gallery + upload side-by-side on desktop */}
      {(() => {
        const canUpload = freight.status !== "finished" && freight.status !== "canceled";
        const hasDocs = freight.documents && freight.documents.length > 0;
        if (!canUpload && !hasDocs) return null;
        return (
          <div style={{ display:"flex", flexDirection:_isDesktop && canUpload && hasDocs?"row":"column", gap:12, marginBottom:12, alignItems:_isDesktop && canUpload && hasDocs?"stretch":undefined }}>
            {hasDocs && <div style={{ flex:1, minWidth:0, display:"flex" }}><DocsGallery documents={freight.documents} onViewFile={setViewFile} freightId={freight.id} canDelete={canUpload} onDeleted={()=>{ if(onRefresh) onRefresh(freight.id); }} onOcr={handleOcr} ocrLoading={ocrLoading} onViewOcr={handleViewOcr}/></div>}
            {canUpload && <div style={{ flex:1, minWidth:0, display:"flex" }}><FreightFileUpload freightId={freight.id} step={freight.status==="pending_assignment"?"request":freight.status==="in_progress"||freight.status==="loaded"?"load_confirmation":"assignment"} onUploaded={()=>{ if(onRefresh) onRefresh(freight.id); }} /></div>}
          </div>
        );
      })()}

      <button onClick={()=>onChat(freight.conversationId)} disabled={!freight.conversationId}
        style={{ width:"100%", background:C.priPale, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.pri}30`, cursor:freight.conversationId?"pointer":"default", fontFamily:"inherit", marginBottom:12 }}>
        {Ic.msg(C.pri,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:13.2, fontWeight:700, color:C.pri }}>Chat del flete</div><div style={{ fontSize:11, color:C.t2 }}>Conversá con las partes involucradas</div></div>
      </button>

      {/* PDF Report */}
      <button disabled={pdfLoading} onClick={async()=>{
        if(pdfLoading) return;
        setPdfLoading(true);
        try {
          let logs = auditLog;
          if(!logs) { try { logs = await apiGetAuditLog(freight.id); setAuditLog(logs); } catch(e) { logs = []; } }
          const { generateFreightPDF } = await loadPdfReport();
          generateFreightPDF(freight, logs || []);
        } catch(e) { log.error('PDF', e); useUIStore.getState().show('Error al generar PDF: ' + (e?.message || e), 'err'); }
        finally { setPdfLoading(false); }
      }} style={{ width:"100%", background:C.w, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.b1}`, cursor:"pointer", fontFamily:"inherit", marginBottom:12, opacity:pdfLoading?0.6:1 }}>
        {Ic.doc(C.t2,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:13.2, fontWeight:700, color:C.t1 }}>{pdfLoading?'Generando...':'Descargar informe PDF'}</div><div style={{ fontSize:11, color:C.t3 }}>Información, recorrido, historial y documentos</div></div>
      </button>

      {/* Secondary actions — edit, cancel, reject (horizontal, smaller) */}
      {(()=>{
        const sec = [];
        if(["pending_assignment","assigned","accepted","in_progress","loaded"].includes(freight.status) && (perms.canRequest || perms.canApprove))
          sec.push(<Btn key="edit" sm v="ghost" icon={Ic.edit(C.t2,14)} onClick={()=>onEdit(freight)} style={{flex:1}}>Editar</Btn>);
        if(filteredActions.includes("cancel"))
          sec.push(<Btn key="cancel" sm v="err" icon={Ic.cross(C.err,14)} disabled={actionLoading} onClick={()=>onAction(freight.id,"cancel")} style={{flex:1}}>Cancelar</Btn>);
        if(filteredActions.includes("reject"))
          sec.push(<Btn key="reject" sm v="err" icon={Ic.ban(C.err,14)} disabled={actionLoading} onClick={()=>onAction(freight.id,"reject")} style={{flex:1}}>Rechazar</Btn>);
        if(sec.length===0) return null;
        return <div style={{ display:"flex", gap:8, marginBottom:8 }}>{sec}</div>;
      })()}
      </div>
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)} onOcr={handleOcr} ocrLoading={ocrLoading} onViewOcr={handleViewOcr}/>
      {ocrLoading && <div style={{ position:"fixed", inset:0, zIndex:250 }}><UploadOverlay uploading={ocrLoading} done={false} total={1} current={1} label="Extrayendo datos"/></div>}
      <OcrResultModal result={ocrResult} onClose={()=>setOcrResult(null)}/>

      {/* Step detail modal — triggered by clicking a progress step */}
      {stepModal && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const stepAuditActions = {
          pending_assignment:["created"],
          assigned:["assigned","assigned_multi","assignment_updated","assignment_canceled"],
          accepted:["accepted","authorized","trip_accepted","trip_rejected"],
          in_progress:["started","trip_started"],
          loaded:["confirm_loaded","trip_confirm_loaded"],
          finished:["confirm_finished","finished","trip_confirm_finished","trip_finished","canceled"],
        };
        const actionLabels = { created:"Solicitado", assigned:"Asignado", assigned_multi:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Iniciado", confirm_loaded:"Carga OK", confirm_finished:"Entrega OK", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado", trip_accepted:"Aceptado", trip_rejected:"Rechazado", trip_started:"Iniciado", trip_confirm_loaded:"Carga OK", trip_confirm_finished:"Entrega OK", trip_finished:"Finalizado", assignment_canceled:"Cancelado", assignment_updated:"Editado" };
        const actionColors = { created:C.pri, assigned:C.sec, assigned_multi:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2, trip_accepted:C.info, trip_rejected:C.err, trip_started:C.acc, trip_confirm_loaded:C.acc, trip_confirm_finished:C.pri, trip_finished:C.ok, assignment_canceled:C.err, assignment_updated:C.t2 };
        const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch{ return ""; } };
        const logs = auditLog ? stepModal.backendSteps.flatMap(s => (auditLog||[]).filter(l=>(stepAuditActions[s]||[]).includes(l.action))) : [];
        const stepToTrip = { assigned:"pending", accepted:"accepted", in_progress:"in_progress", loaded:"loaded", finished:"finished" };
        const stepAssigns = isMultiTruck ? stepModal.backendSteps.flatMap(s => { const ts=stepToTrip[s]; if(!ts) return []; return (freight.activeAssignments||[]).filter(a=>a.tripStatus===ts); }) : [];
        return <div onClick={()=>setStepModal(null)} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius:14, padding:20, maxWidth:400, width:"100%", maxHeight:"80vh", overflow:"auto", boxShadow:C.shLg }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:15.4, fontWeight:800, color:stepModal.color }}>{stepModal.label}</span>
              <button onClick={()=>setStepModal(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,18)}</button>
            </div>
            {logs.length === 0 && stepAssigns.length === 0 && <div style={{ fontSize:13.2, color:C.t3, textAlign:"center", padding:"20px 0" }}>Sin actividad registrada en esta etapa</div>}
            {logs.map(entry => {
              const acCol = actionColors[entry.action] || C.t2;
              const tn = entry.metadata?.tripNumber ? `Viaje #${entry.metadata.tripNumber}` : null;
              return <div key={entry.id} style={{ display:"flex", gap:8, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ width:8, height:8, borderRadius:4, background:acCol, flexShrink:0, marginTop:5 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13.2, fontWeight:700, color:acCol, lineHeight:1.3 }}>{actionLabels[entry.action]||entry.action}{tn ? ` · ${tn}` : ""}</div>
                  <div style={{ fontSize:12.1, color:C.t2, marginTop:2, lineHeight:1.3, wordBreak:"break-word" }}>{entry.user?.name||"Sistema"}</div>
                  {entry.user?.company?.name && <div style={{ fontSize:11.6, color:C.t3, lineHeight:1.2 }}>{entry.user.company.name}</div>}
                  {(entry.reason || entry.metadata?.reason) && <div style={{ fontSize:11.6, color:C.t3, fontStyle:"italic", marginTop:2 }}>"{entry.reason||entry.metadata.reason}"</div>}
                  {entry.metadata?.confirmedBy && <div style={{ fontSize:11.6, color:C.t3, marginTop:2 }}>por {entry.metadata.confirmedBy==="transporter"?"transportista":entry.metadata.confirmedBy==="producer"?"productor":entry.metadata.confirmedBy==="plant"?"planta":entry.metadata.confirmedBy}</div>}
                  <div style={{ fontSize:11.6, color:C.t3, marginTop:2 }}>{fmtD(entry.createdAt)}</div>
                </div>
              </div>;
            })}
            {stepAssigns.length > 0 && logs.length === 0 && stepAssigns.map(a => (
              <div key={a.id} style={{ display:"flex", gap:8, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ width:8, height:8, borderRadius:4, background:stepModal.color, flexShrink:0, marginTop:5 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12.1, fontWeight:700, color:C.t1 }}>Viaje #{a.tripNumber}</div>
                  {a.plate && <div style={{ fontSize:12.1, color:C.t2, marginTop:1 }}>{a.plate}{a.truckModel?` · ${a.truckModel}`:""}</div>}
                  {a.transporterName && <div style={{ fontSize:11.6, color:C.t3 }}>{a.transporterName}</div>}
                  {a.driverName && <div style={{ fontSize:11.6, color:C.t3 }}>{a.driverName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>;
      })()}
    </div>
  );
}
