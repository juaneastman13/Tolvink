import { useState, useRef, useEffect, useMemo } from "react";
import { C, Ic, FONT, MONO, track } from "../theme";
import { stCfg, getActions, tripStCfg, POLL_INTERVALS, formatFreightDate } from "../constants";
import { Bd, Btn, Loader, Sec, FileViewer } from "../components";
import { FreightMap, SafeZone } from "../maps";
import log from "../logger";
import { DocsGallery, FreightFileUpload, OcrResultModal, UploadOverlay } from "../uploads";
import { apiGetAuditLog, apiSendTracking, apiApprovePendingChange, apiRejectPendingChange, apiOcrAnalyze, apiSaveOcrData } from "../api";
import { useIsDesktop } from "../hooks";
// PDF report loaded lazily to avoid bundle bloat
const loadPdfReport = () => import("../utils/pdf-report");

export default function DetailScreen({ user, freight, perms, onBack, onAction, onTripAction, onEditTrip, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap }) {
  const [auditLog, setAuditLog] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pcLoading, setPcLoading] = useState(null);
  const auditRef = useRef(null);

  const handleOcr = async (file) => {
    setOcrLoading(true);
    try {
      const res = await apiOcrAnalyze(file.url);
      if (res.error) { log.error("OCR", res.error); return; }
      setOcrResult(res);
      // Auto-save OCR data to document
      if (file.id && freight?.id) {
        apiSaveOcrData(freight.id, file.id, res).then(() => { if (onRefresh) onRefresh(freight.id); }).catch(e => log.error("OCR", "save failed:", e));
      }
    } catch (e) {
      log.error("OCR", "failed:", e);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleViewOcr = (ocrData) => setOcrResult(ocrData);

  // Pre-load PDF module so download works synchronously on click
  useEffect(() => { loadPdfReport(); }, []);

  // Auto-refresh freight detail every 10s
  useEffect(() => {
    if (!freight?.id || !onRefresh) return;
    const iv = setInterval(() => { if (!document.hidden) onRefresh(freight.id); }, POLL_INTERVALS.DETAIL_REFRESH);
    return () => clearInterval(iv);
  }, [freight?.id, onRefresh]);

  // Auto-load audit log on mount / freight change
  useEffect(() => {
    if (!freight?.id) return;
    let cancelled = false;
    apiGetAuditLog(freight.id).then(logs => { if (!cancelled) setAuditLog(logs); }).catch(() => {});
    return () => { cancelled = true; };
  }, [freight?.id]);

  const toggleAudit = () => setShowAudit(v => !v);

  const [expandedTrip, setExpandedTrip] = useState(null);
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
        } catch { /* ignore */ }
        setLocSending(false);
      },
      () => { setLocSending(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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

  // Multi-truck: filter assignments visible to this user
  const visibleAssignments = useMemo(() => {
    if (!isMultiTruck) return [];
    const aa = freight?.activeAssignments || [];
    if (user.role === "chofer") return aa.filter(a => a.driverId === user.id);
    if (user.userType === "transporter") return aa.filter(a => a.transportCompanyId === user.companyId);
    return aa; // plant/producer see all
  }, [isMultiTruck, freight?.activeAssignments, user]);

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
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, color:C.t3, fontWeight:600, fontFamily:MONO }}>{freight.code}</span>
              {user.userType && <span style={{ fontSize:9, fontWeight:700, color:({producer:C.acc,plant:C.pri,transporter:C.info||C.sec})[user.userType]||C.t3, background:`${({producer:C.acc,plant:C.pri,transporter:C.info||C.sec})[user.userType]||C.t3}15`, padding:"1px 6px", borderRadius:4, textTransform:"uppercase", letterSpacing:0.3 }}>{({producer:"Productor",plant:"Planta",transporter:"Transportista"})[user.userType]||user.userType}</span>}
            </div>
            {freight.loadDate && <div style={{ fontSize:11, color:C.t3, fontWeight:500, marginTop:2 }}>{formatFreightDate(freight.loadDate)}</div>}
            <div style={{ fontSize:22, fontWeight:800, marginTop:2, letterSpacing:-0.3 }}>{freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · {freight.tons} {freight.unit||"tn"}</div>
          </div>
          <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
        </div>
      </div>

      <div style={{ padding:"0 18px 18px" }}>

      {/* Queue banner for chofer */}
      {isChoferQueued && <div style={{ background:`${C.info}10`, border:`1.5px solid ${C.info}30`, borderRadius:12, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:20 }}>{"\u23F3"}</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.info }}>En cola #{freight.queuePosition}</div>
          <div style={{ fontSize:11, color:C.t2 }}>Debés completar los fletes anteriores primero</div>
        </div>
      </div>}

      {freight.status === "pending_assignment" && user.userType === "producer" && freight.useOwnFleet === false && (
        <div style={{ background:`${C.info}10`, border:`1.5px solid ${C.info}30`, borderRadius:12, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>{"\u23F3"}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.info }}>Pendiente de asignación por planta</div>
            <div style={{ fontSize:11, color:C.t2 }}>La planta de destino asignará el transportista</div>
          </div>
        </div>
      )}

      {/* Actions */}
      {filteredActions.length > 0 && <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {filteredActions.includes("authorize") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"authorize")}>{actionLoading?"Procesando...":"Autorizar viaje"}</Btn>}
        {filteredActions.includes("assign") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"assign")}>Asignar transportista</Btn>}
        {filteredActions.includes("accept") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"accept")}>Aceptar flete</Btn>}
        {filteredActions.includes("start") && <Btn full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"start")}>{actionLoading?"Procesando...":"Iniciar viaje"}</Btn>}
        {filteredActions.includes("confirm_loaded") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_loaded")}>{actionLoading?"Procesando...":"Confirmar carga"}</Btn>}
        {filteredActions.includes("confirm_finished") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_finished")}>{actionLoading?"Procesando...":"Confirmar entrega"}</Btn>}
      </div>}
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
            style={{ width:"100%", padding:"14px 20px", borderRadius:12, border:"none", background:a.color, color:C.w, fontSize:15, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:actionLoading?0.6:1 }}>
            {a.icon} {actionLoading?"Procesando...":a.label}{a.count>1?` (${a.count})`:a.count===1?` #${a.tripNumber}`:""}
          </button>
        ))}
      </div>}

      {/* Progress — click to see per-stage detail */}
      {freight.status !== "canceled" && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const curIdx = steps.indexOf(freight.status);
        const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; } };
        const actionLabels = { created:"Solicitado", assigned:"Asignado", assigned_multi:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Iniciado", confirm_loaded:"Carga OK", confirm_finished:"Entrega OK", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado", trip_accepted:"Aceptado", trip_rejected:"Rechazado", trip_started:"Iniciado", trip_confirm_loaded:"Carga OK", trip_confirm_finished:"Entrega OK", trip_finished:"Finalizado", assignment_canceled:"Cancelado", assignment_updated:"Editado" };
        const actionColors = { created:C.pri, assigned:C.sec, assigned_multi:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2, trip_accepted:C.info, trip_rejected:C.err, trip_started:C.acc, trip_confirm_loaded:C.acc, trip_confirm_finished:C.pri, trip_finished:C.ok, assignment_canceled:C.err, assignment_updated:C.t2 };
        const stepAuditActions = {
          pending_assignment:["created"],
          assigned:["assigned","assigned_multi","assignment_updated","assignment_canceled"],
          accepted:["accepted","authorized","trip_accepted","trip_rejected"],
          in_progress:["started","trip_started"],
          loaded:["confirm_loaded","trip_confirm_loaded"],
          finished:["confirm_finished","finished","trip_confirm_finished","trip_finished"],
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
            <span style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Progreso</span>
            <button onClick={toggleAudit} style={{ fontSize:11, fontWeight:700, color:C.t1, background:C.bg, border:`1.5px solid ${C.b1}`, borderRadius:8, padding:"5px 14px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 }}>
              {showAudit?"Ocultar detalle":"Ver detalle"} <span style={{ fontSize:9, marginTop:1 }}>{showAudit?"\u25B2":"\u25BC"}</span>
            </button>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"flex-start"}}>
            {steps.map((s,i)=>{
              const done = i < curIdx; const active = i === curIdx; const c = stCfg(s);
              return <div key={s} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                <div style={{width:"100%",height:active?5:4,borderRadius:3,background:done?C.pri:active?c.border:C.b1,transition:"all 0.2s"}}/>
                {active && <div style={{width:6,height:6,borderRadius:3,background:c.border,marginTop:-2}}/>}
                <span style={{fontSize:7.5,fontWeight:active?700:500,color:active?c.color:done?C.t2:C.t3,textAlign:"center",lineHeight:1.2,wordBreak:"break-word",maxWidth:"100%"}}>{c.label}</span>
              </div>;
            })}
          </div>
          {/* Per-stage detail — columnar, aligned with progress bar */}
          {showAudit && auditLog && (
            <div style={{ display:"flex", gap:3, marginTop:12, borderTop:`1px solid ${C.b1}`, paddingTop:10 }}>
              {steps.map((s,i)=>{
                const done = i < curIdx; const active = i === curIdx;
                const c = stCfg(s);
                const logs = getStepLogs(s);
                const tc = getTruckCount(s);
                const stepAssigns = getStepAssignments(s);
                const hasData = logs.length > 0 || (tc !== null && tc > 0);
                const col = done ? C.pri : active ? (c.border||c.color) : C.t3;
                return (
                  <div key={s} style={{ flex:1, minWidth:0 }}>
                    {tc !== null && (
                      <div style={{ textAlign:"center", fontSize:10, fontWeight:700, color:col, marginBottom:8, background:`${col}12`, borderRadius:5, padding:"3px 0" }}>
                        {tc}/{freight.truckCount}
                      </div>
                    )}
                    {/* Audit log entries */}
                    {logs.length > 0 && logs.map(log => {
                      const acCol = actionColors[log.action] || C.t2;
                      const tn = tripLabel(log);
                      return (
                        <div key={log.id} style={{ display:"flex", gap:5, marginBottom:8, alignItems:"flex-start" }}>
                          <div style={{ width:7, height:7, borderRadius:4, background:acCol, flexShrink:0, marginTop:3 }} />
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:9.5, fontWeight:700, color:acCol, lineHeight:1.3 }}>{actionLabels[log.action]||log.action}{tn ? ` · ${tn}` : ""}</div>
                            <div style={{ fontSize:9.5, color:C.t2, marginTop:1, lineHeight:1.3, wordBreak:"break-word" }}>{log.user?.name||"Sistema"}</div>
                            {log.user?.company?.name && <div style={{ fontSize:9, color:C.t3, lineHeight:1.2 }}>{log.user.company.name}</div>}
                            {(log.reason || log.metadata?.reason) && <div style={{ fontSize:8.5, color:C.t3, fontStyle:"italic", marginTop:1 }}>"{log.reason||log.metadata.reason}"</div>}
                            {log.metadata?.confirmedBy && <div style={{ fontSize:8.5, color:C.t3, marginTop:1 }}>por {log.metadata.confirmedBy==="transporter"?"transportista":log.metadata.confirmedBy==="producer"?"productor":log.metadata.confirmedBy==="plant"?"planta":log.metadata.confirmedBy}</div>}
                            <div style={{ fontSize:8.5, color:C.t3, marginTop:1 }}>{fmtD(log.createdAt)}</div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Fallback: show assignment details when no audit entries but trucks are at this stage */}
                    {logs.length === 0 && stepAssigns.length > 0 && stepAssigns.map(a => (
                      <div key={a.id} style={{ display:"flex", gap:5, marginBottom:8, alignItems:"flex-start" }}>
                        <div style={{ width:7, height:7, borderRadius:4, background:col, flexShrink:0, marginTop:3 }} />
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:9, fontWeight:700, color:C.t1 }}>Viaje #{a.tripNumber}</div>
                          {a.plate && <div style={{ fontSize:9.5, color:C.t2, marginTop:1, lineHeight:1.3 }}>{a.plate}{a.truckModel?` · ${a.truckModel}`:""}</div>}
                          {a.transporterName && <div style={{ fontSize:9, color:C.t3, lineHeight:1.2 }}>{a.transporterName}</div>}
                          {a.driverName && <div style={{ fontSize:9, color:C.t3, lineHeight:1.2 }}>{a.driverName}</div>}
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && stepAssigns.length === 0 && hasData && <div style={{ fontSize:9, color:C.t3, textAlign:"center" }}>{"\u2014"}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>;
      })()}

      {/* Multi-truck: Camiones section */}
      {isMultiTruck && (
        <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Camiones</div>
            <span style={{ fontSize:11, fontWeight:600, color:C.info }}>{freight.assignedTruckCount}/{freight.truckCount} asignados</span>
          </div>
          {/* Progress bar */}
          <div style={{ height:6, borderRadius:3, background:C.b1, marginBottom:14, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:3, background: freight.assignedTruckCount >= freight.truckCount ? C.ok : C.info, width:`${Math.min(100, (freight.assignedTruckCount / freight.truckCount) * 100)}%`, transition:"width 0.3s" }}/>
          </div>
          {/* Assignment list */}
          {visibleAssignments.map(a => {
            const tst = tripStCfg(a.tripStatus);
            const isExpanded = expandedTrip === a.id;
            const tripBtns = getTripActions(a);
            return (
              <div key={a.id} style={{ border:`1px solid ${tst.color}30`, borderLeft:`3px solid ${tst.color}`, borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                <div onClick={()=>setExpandedTrip(isExpanded?null:a.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", cursor:"pointer", background:isExpanded?`${tst.color}06`:"transparent", flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:800, color:tst.color }}>#{a.tripNumber}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.t1, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>
                    {a.plate || "Sin camión"}{a.transporterName ? ` · ${a.transporterName}` : ""}{a.driverName ? ` · ${a.driverName}` : ""}
                  </span>
                  <Bd color={tst.color} bg={tst.bg} small>{tst.label}</Bd>
                  {/* Edit button for plant on trips they assigned (not own-fleet), before started */}
                  {user.userType === "plant" && (a.tripStatus === "pending" || a.tripStatus === "accepted") && a.transportCompanyId !== freight.originCompanyId && onEditTrip && (
                    <button onClick={(e)=>{e.stopPropagation(); onEditTrip(freight.id, a);}} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:3 }}>
                      {Ic.doc(C.t2,12)} Editar
                    </button>
                  )}
                  {/* Inline action buttons (visible only when NOT expanded) */}
                  {!isExpanded && tripBtns.length > 0 && tripBtns.map(b => (
                    <button key={b.key} disabled={actionLoading} onClick={(e)=>{e.stopPropagation(); onTripAction && onTripAction(freight.id, a.id, b.key);}} style={{ padding:"5px 10px", borderRadius:6, border:"none", background:b.color, color:C.w, fontSize:10.5, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, opacity:actionLoading?0.6:1 }}>
                      {b.icon} {actionLoading?"...":b.label}
                    </button>
                  ))}
                  <span style={{ display:"flex", transform:isExpanded?"rotate(-90deg)":"rotate(0deg)", transition:"transform 0.15s" }}>{Ic.chev(C.t3,14)}</span>
                </div>
                {isExpanded && (
                  <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.b2}` }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:4, fontSize:11.5, color:C.t2, marginBottom:tripBtns.length>0?10:0 }}>
                      {a.transporterName && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.truck(C.t3,12)} {a.transporterName}</div>}
                      {a.plate && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.truck(C.acc,12)} {a.plate}{a.truckModel?` · ${a.truckModel}`:""}</div>}
                      {a.driverName && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.user(C.pri,12)} {a.driverName}{a.driverPhone?` · ${a.driverPhone}`:""}</div>}
                      {a.tons && <div style={{ display:"flex", alignItems:"center", gap:6 }}>{Ic.grain(C.t3,12)} {a.tons} tn</div>}
                      {/* Cross-confirmation status */}
                      {(a.tripStatus === "in_progress" || a.tripStatus === "loaded") && (
                        <div style={{ display:"flex", gap:12, marginTop:6 }}>
                          <div>
                            <span style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Carga: </span>
                            <span style={{ fontSize:10 }}>{a.transporterLoadedConfirmedAt ? "\u2705 Transp." : "\u23F3 Transp."} {a.producerLoadedConfirmedAt ? "\u2705 Prod." : "\u23F3 Prod."}</span>
                          </div>
                          {a.tripStatus === "loaded" && <div>
                            <span style={{ fontSize:9, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Entrega: </span>
                            <span style={{ fontSize:10 }}>{a.transporterFinishedConfirmedAt ? "\u2705 Transp." : "\u23F3 Transp."} {a.plantFinishedConfirmedAt ? "\u2705 Planta" : "\u23F3 Planta"}</span>
                          </div>}
                        </div>
                      )}
                    </div>
                    {/* Per-trip action buttons */}
                    {tripBtns.length > 0 && (
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {tripBtns.map(b => (
                          <button key={b.key} disabled={actionLoading} onClick={()=>onTripAction && onTripAction(freight.id, a.id, b.key)} style={{ flex:"1 1 auto", padding:"8px 12px", borderRadius:8, border:"none", background:b.color, color:C.w, fontSize:11.5, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:actionLoading?0.6:1 }}>
                            {b.icon} {actionLoading?"...":b.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Unassigned slots */}
          {freight.assignedTruckCount < freight.truckCount && user.userType === "plant" && (
            <button onClick={()=>onAction(freight.id,"assign")} style={{ width:"100%", padding:"10px 0", borderRadius:10, border:`1.5px dashed ${C.acc}`, background:`${C.acc}08`, color:C.acc, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginTop:4 }}>
              {Ic.plus(C.acc,14)} Agregar camión ({freight.truckCount - freight.assignedTruckCount} pendientes)
            </button>
          )}
        </div>
      )}

      {/* Cross-confirmations panel (single-truck only) */}
      {!isMultiTruck && (freight.status==="loaded" || freight.status==="in_progress") && (
        <div style={{ background:C.w, border:`1px solid ${C.acc}30`, borderLeft:`3px solid ${C.acc}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          <div style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.acc, textTransform:"uppercase", letterSpacing:0.5 }}>Confirmaciones</div>
          <div style={{display:"flex",gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Carga</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.transporterLoadedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.transporterLoadedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>{"\u23F3"}</span>}
                  </span>
                  <span style={{color:freight.transporterLoadedConfirmedAt?C.ok:C.t2,fontWeight:freight.transporterLoadedConfirmedAt?600:400}}>Transportista</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.producerLoadedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.producerLoadedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>{"\u23F3"}</span>}
                  </span>
                  <span style={{color:freight.producerLoadedConfirmedAt?C.ok:C.t2,fontWeight:freight.producerLoadedConfirmedAt?600:400}}>Productor</span>
                </div>
              </div>
            </div>
            <div style={{width:1,background:C.b1}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Entrega</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.transporterFinishedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.transporterFinishedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>{"\u23F3"}</span>}
                  </span>
                  <span style={{color:freight.transporterFinishedConfirmedAt?C.ok:C.t2,fontWeight:freight.transporterFinishedConfirmedAt?600:400}}>Transportista</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.plantFinishedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.plantFinishedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>{"\u23F3"}</span>}
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
          <span style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:12, display:"block" }}>Información del flete</span>
          {[
            [Ic.user(C.pri,15),"Empresa",freight.originCompanyName||freight.originName],
            [Ic.grain(C.ok,15),"Campo",[freight.fieldName,freight.originName].filter(Boolean).join(" / ")||"—"],
            [Ic.plant(C.t2,15),"Destino",freight.destName],
            [Ic.cal(C.t2,15),"Fecha carga",formatFreightDate(freight.loadDate)],
            [Ic.clk(C.t2,15),"Hora carga",freight.loadTime],
            [Ic.user(C.t2,15),"Solicitado por",freight.requestedByName],
            [Ic.grain(C.t2,15),"Producto",`${freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · ${freight.tons} ${freight.unit||"tn"}`],
            freight.amount>0&&[Ic.grain(C.t2,15),"Importe",`$${Number(freight.amount).toLocaleString()}`],
            !isMultiTruck&&freight.transporterName&&[Ic.truck(C.t2,15),"Transportista",freight.transporterName],
            isMultiTruck&&[Ic.truck(C.t2,15),"Camiones",`${freight.assignedTruckCount}/${freight.truckCount}`],
            !isMultiTruck&&freight.truckPlate&&[Ic.truck(C.acc,15),"Camión",`${freight.truckPlate}${freight.truckModel?` · ${freight.truckModel}`:""}`],
            !isMultiTruck&&freight.driverName&&[Ic.user(C.pri,15),"Chofer",<>{freight.driverName}{perms.canApprove && freight.driverId && <button onClick={()=>onAction(freight.id,"driver_queue")} style={{marginLeft:6,fontSize:9.5,fontWeight:700,color:C.info,background:`${C.info}12`,border:`1px solid ${C.info}30`,borderRadius:6,padding:"2px 7px",cursor:"pointer",fontFamily:"inherit"}}>Ver cola</button>}</>],
            !isMultiTruck&&freight.driverPhone&&[Ic.msg(C.info,15),"Teléfono",freight.driverPhone],
          ].filter(Boolean).map(([ic,label,val],i,arr)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.b2}`:"none" }}>
              <span style={{display:"flex",flexShrink:0}}>{ic}</span>
              <span style={{ fontSize:11.5, color:C.t2, minWidth:85 }}>{label}</span>
              {label==="Teléfono"?<a href={`tel:${val}`} style={{ fontSize:12, fontWeight:600, color:C.info, marginLeft:"auto", textDecoration:"none" }}>{val}</a>:
              <span style={{ fontSize:12, fontWeight:600, color:C.t1, marginLeft:"auto", textAlign:"right" }}>{val}</span>}
            </div>
          ))}
        </div>
        <div style={{ flex:1 }}>
          <FreightMap freightId={freight.id} originLat={freight.originLat} originLng={freight.originLng} destLat={freight.destLat} destLng={freight.destLng} originName={[freight.originCompanyName, [freight.fieldName,freight.originName].filter(Boolean).join("/")].filter(Boolean).join(" — ")} destName={freight.destName} status={freight.status} isDriver={user.userType==="transporter"||(user.userType==="producer"&&freight.isOwnFleet)}/>
        </div>
      </div>

      {/* Notes / Observaciones */}
      {freight.notes && (
        <div style={{ background:C.warnPale, border:`1px solid ${C.warn}30`, borderLeft:`3px solid ${C.warn}`, borderRadius:12, padding:14, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            {Ic.doc(C.warn, 14)}
            <span style={{ fontSize:10.5, fontWeight:700, color:C.warn, textTransform:"uppercase", letterSpacing:0.5 }}>Observaciones</span>
          </div>
          <div style={{ fontSize:12.5, color:C.t1, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{freight.notes}</div>
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
              <span style={{ fontSize:10.5, fontWeight:700, color:C.info, textTransform:"uppercase", letterSpacing:0.5 }}>Cambio pendiente de aprobación</span>
            </div>
            <div style={{ fontSize:12, color:C.t1, marginBottom:isApprover?10:0 }}>{label}{pc.requestedBy?.name ? ` — solicitado por ${pc.requestedBy.name}` : ""}</div>
            {isApprover && <div style={{ display:"flex", gap:8 }}>
              <Btn sm disabled={pcLoading===pc.id} onClick={async()=>{ setPcLoading(pc.id); try { await apiApprovePendingChange(freight.id, pc.id); onRefresh(freight.id); } catch(e) { log.error("approve-pc",e); } finally { setPcLoading(null); } }}>Aprobar</Btn>
              <Btn sm v="err" disabled={pcLoading===pc.id} onClick={async()=>{ setPcLoading(pc.id); try { await apiRejectPendingChange(freight.id, pc.id); onRefresh(freight.id); } catch(e) { log.error("reject-pc",e); } finally { setPcLoading(null); } }}>Rechazar</Btn>
            </div>}
            {!isApprover && <div style={{ fontSize:10.5, color:C.t3, marginTop:4 }}>Esperando aprobación de la otra parte</div>}
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
            <div style={{ fontSize:12, fontWeight:700, color:b.border }}>{b.title}</div>
            <div style={{ fontSize:11, color:C.t2 }}>{b.desc}</div>
          </div>
        </div>;
      })()}

      {/* Documents: gallery + upload side-by-side on desktop */}
      {(() => {
        const canUpload = freight.status !== "finished" && freight.status !== "canceled";
        const hasDocs = freight.documents && freight.documents.length > 0;
        if (!canUpload && !hasDocs) return null;
        return (
          <div style={{ display:"flex", flexDirection: _isDesktop && canUpload && hasDocs ? "row" : "column", gap: 12, marginBottom: 12, alignItems:_isDesktop && canUpload && hasDocs?"stretch":undefined }}>
            {hasDocs && <div style={{ flex: 1, minWidth: 0, display:"flex" }}><DocsGallery documents={freight.documents} onViewFile={setViewFile} freightId={freight.id} canDelete={canUpload} onDeleted={()=>{ if(onRefresh) onRefresh(freight.id); }} onOcr={handleOcr} ocrLoading={ocrLoading} onViewOcr={handleViewOcr}/></div>}
            {canUpload && <div style={{ flex: 1, minWidth: 0 }}><FreightFileUpload freightId={freight.id} step={freight.status==="pending_assignment"?"request":freight.status==="in_progress"||freight.status==="loaded"?"load_confirmation":"assignment"} onUploaded={()=>{ if(onRefresh) onRefresh(freight.id); }} /></div>}
          </div>
        );
      })()}

      <button onClick={()=>onChat(freight.conversationId)} disabled={!freight.conversationId}
        style={{ width:"100%", background:C.priPale, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.pri}30`, cursor:freight.conversationId?"pointer":"default", fontFamily:"inherit", marginBottom:12 }}>
        {Ic.msg(C.pri,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:12, fontWeight:700, color:C.pri }}>Chat del flete</div><div style={{ fontSize:10, color:C.t2 }}>Conversá con las partes involucradas</div></div>
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
        } catch(e) { log.error('PDF', e); alert('Error al generar PDF: ' + (e?.message || e)); }
        finally { setPdfLoading(false); }
      }} style={{ width:"100%", background:C.w, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.b1}`, cursor:"pointer", fontFamily:"inherit", marginBottom:12, opacity:pdfLoading?0.6:1 }}>
        {Ic.doc(C.t2,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:12, fontWeight:700, color:C.t1 }}>{pdfLoading?'Generando...':'Descargar informe PDF'}</div><div style={{ fontSize:10, color:C.t3 }}>Información, recorrido, historial y documentos</div></div>
      </button>

      {/* Edit + Cancel — bottom actions */}
      {["pending_assignment","assigned","accepted","in_progress","loaded"].includes(freight.status) && (perms.canRequest || perms.canApprove) && <div style={{ marginBottom:8 }}><Btn full sm v="sec" icon={Ic.doc(C.pri,14)} onClick={()=>onEdit(freight)}>Editar</Btn></div>}
      {filteredActions.includes("cancel") && <div style={{ marginBottom:8 }}><Btn full v="err" icon={Ic.cross(C.err,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"cancel")}>Cancelar flete</Btn></div>}
      {filteredActions.includes("reject") && <div style={{ marginBottom:8 }}><Btn full v="err" icon={Ic.ban(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"reject")}>Rechazar asignación</Btn></div>}
      </div>
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)} onOcr={handleOcr} ocrLoading={ocrLoading} onViewOcr={handleViewOcr}/>
      {ocrLoading && <div style={{ position:"fixed", inset:0, zIndex:250 }}><UploadOverlay uploading={ocrLoading} done={false} total={1} current={1} label="Extrayendo datos"/></div>}
      <OcrResultModal result={ocrResult} onClose={()=>setOcrResult(null)}/>
    </div>
  );
}
