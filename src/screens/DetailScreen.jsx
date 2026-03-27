import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { C, Ic, FONT, MONO, track, STATUS_COLORS , R} from "../theme";
import { stCfg, getActions, tripStCfg, POLL_INTERVALS, formatFreightDate } from "../constants";
import { Bd, Btn, Loader, Sec, FileViewer, SkeletonDetail, LicensePlate } from "../components";
import { SafeZone } from "../maps";
const FreightMap = lazy(() => import("../maps").then(m => ({ default: m.FreightMap })));
import log from "../logger";
import { DocsGallery, FreightFileUpload, OcrResultModal, UploadOverlay } from "../uploads";
import { apiGetAuditLog, apiGetFreight, apiGetFreightDetailExtra, apiSendTracking, apiApprovePendingChange, apiRejectPendingChange, apiOcrAnalyze, apiSaveOcrData, apiUpdateFreight, apiGetWeighTickets, apiAssignFreight, apiGetCompanyAccess, apiCreateSharedLink, apiReorderAssignments } from "../api";
import { WeighTicketSummary } from "../components/WeighTicketForm";
import { useIsDesktop, mapFreight, originDisplay, destDisplay } from "../hooks";
import { useAccessLevel } from "../hooks/useAccessLevel";
import { useUIStore, useFreightDetailStore } from "../store";
import AssignmentSuggestions from "../components/AssignmentSuggestions";
// PDF report loaded lazily to avoid bundle bloat
const loadPdfReport = () => import("../utils/pdf-report");

export default function DetailScreen({ user, freight, perms, onBack, onAction, onTripAction, onEditTrip, onCancelAssignment, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap, sseConnected }) {
  // === ALL HOOKS MUST BE BEFORE ANY EARLY RETURN (React rules of hooks) ===
  // Progressive loading: load full detail on-demand when freight is summary-only
  const detailEntry = useFreightDetailStore(s => s.details[freight?.id]);
  const detailData = detailEntry?.data || null;
  const isFullDetail = !!detailData?._isFullDetail;
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    if (!freight?.id || isFullDetail) return;
    setDetailError(null);
    const cached = useFreightDetailStore.getState().getDetail(freight.id);
    const hasListData = !!(cached?.data); // Pre-populated from list fetch
    useFreightDetailStore.getState().setLoading(freight.id, true);
    let cancelled = false;
    if (hasListData) {
      // Fast path: only fetch the delta (documents, conversation, pendingChanges)
      apiGetFreightDetailExtra(freight.id).then(extra => {
        if (cancelled) return;
        const prev = useFreightDetailStore.getState().details[freight.id]?.data || freight;
        useFreightDetailStore.getState().setDetail(freight.id, {
          ...prev,
          documents: extra.documents || [],
          conversationId: extra.conversation?.id || null,
          pendingChanges: extra.pendingChanges || [],
          _isFullDetail: true,
        });
      }).catch(() => {
        // Fallback: fetch full detail if delta endpoint not available
        if (cancelled) return;
        apiGetFreight(freight.id).then(raw => {
          if (cancelled) return;
          useFreightDetailStore.getState().setDetail(freight.id, mapFreight(raw));
        }).catch((e) => {
          if (cancelled) return;
          // Mark as full-detail with whatever we have so the screen doesn't shimmer forever
          const prev = useFreightDetailStore.getState().details[freight.id]?.data || freight;
          useFreightDetailStore.getState().setDetail(freight.id, { ...prev, _isFullDetail: true });
          log.error("detail-load", e);
        });
      });
    } else {
      // Cold path: no cached data at all (direct URL, deep link) — fetch everything
      apiGetFreight(freight.id).then(raw => {
        if (cancelled) return;
        useFreightDetailStore.getState().setDetail(freight.id, mapFreight(raw));
      }).catch((e) => {
        if (cancelled) return;
        useFreightDetailStore.getState().setLoading(freight.id, false);
        setDetailError(e?.message || "No se pudo cargar el flete");
        log.error("detail-load", e);
      });
    }
    return () => { cancelled = true; };
  }, [freight?.id, isFullDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const [auditLog, setAuditLog] = useState(null);
  const [weighTickets, setWeighTickets] = useState({ origin: [], destination: [] });
  const [viewFile, setViewFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrDocId, setOcrDocId] = useState(null);
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
      setOcrDocId(file.id || null);
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

  const handleViewOcr = (ocrData, docIdArg) => { setOcrResult(ocrData); setOcrDocId(docIdArg || null); };

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

  // Fetch weigh tickets — refetch when freight status changes (e.g., after confirm-loaded modal creates a ticket)
  const [wtRefreshKey, setWtRefreshKey] = useState(0);
  const refreshWeighTickets = useCallback(() => setWtRefreshKey(k => k + 1), []);
  useEffect(() => {
    if (!freight?.id) return;
    let cancelled = false;
    apiGetWeighTickets(freight.id).then(all => {
      if (cancelled) return;
      const origin = (all || []).filter(t => t.type === "origin");
      const destination = (all || []).filter(t => t.type === "destination");
      setWeighTickets({ origin, destination });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [freight?.id, freight?.status, wtRefreshKey]);

  const [showProgressModal, setShowProgressModal] = useState(false);

  const [stepModal, setStepModal] = useState(null); // {idx, label, color, backendSteps}
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [truckCountLoading, setTruckCountLoading] = useState(false);
  const [truckCountLocal, setTruckCountLocal] = useState(null); // optimistic local override

  // Reset optimistic truck count when freight data refreshes (only if not mid-commit)
  useEffect(() => { if (!truckCountLoading) setTruckCountLocal(null); }, [freight?.truckCount, truckCountLoading]);
  const [truckModal, setTruckModal] = useState(null); // {type:"add"|"remove"}
  const [locSending, setLocSending] = useState(false);
  const [locSent, setLocSent] = useState(false);
  const [shareLink, setShareLink] = useState(null); // { url, copied }
  const [shareLoading, setShareLoading] = useState(false);
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
      // Plant/Producer: update truckCount in background, open AssignModal immediately
      if (user.userType === "plant" || user.userType === "producer") {
        commitTruckCount(next);
        onAction(freight.id, "assign");
        return;
      }
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
    if (modal.type === "add" && choice === "own_fleet") {
      commitTruckCount(modal.next);
      onAction(freight.id, "assign");
    } else {
      commitTruckCount(modal.next);
    }
  };

  const handleTruckModalCancel = () => {
    setTruckCountLocal(null); // revert
    setTruckModal(null);
  };

  const _isDesktop = useIsDesktop(768);

  // Plant-centric: access level for current user + transporter CONSULTA detection
  const { can, isConsulta: _isConsultaGlobal, isConsultaFor } = useAccessLevel(user);
  // Per-freight CONSULTA: check against the freight's destination plant
  const isConsulta = freight?.destCompanyId ? isConsultaFor(freight.destCompanyId) : _isConsultaGlobal;
  const isPlantUser = user?.userType === "plant";
  const [transporterAccessMap, setTransporterAccessMap] = useState({});
  useEffect(() => {
    if (!isPlantUser || !user?.activeCompanyId) return;
    let cancelled = false;
    apiGetCompanyAccess(user.activeCompanyId, "TRANSPORTER").then(records => {
      if (cancelled) return;
      const map = {};
      for (const r of (records || [])) {
        const cId = r.granteeCompanyId || r.granteeCompany?.id;
        if (cId) map[cId] = r.accessLevel;
      }
      setTransporterAccessMap(map);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isPlantUser, user?.activeCompanyId]);

  // Check if the freight's transporter is CONSULTA (READONLY)
  const transporterCompanyId = freight?.activeAssignments?.[0]?.transportCompanyId;
  const transporterIsConsulta = isPlantUser && transporterCompanyId && transporterAccessMap[transporterCompanyId] === "READONLY";

  const st = freight ? stCfg(freight.status) : null;
  const isMultiTruck = freight?.isMultiTruck && (freight?.truckCount || 1) > 1;
  const isChoferQueued = user.role === "chofer" && (freight?.queuePosition || 0) > 1;
  const actions = !freight ? [] : isMultiTruck ? [] : getActions(freight.status, user.userType, user.role, freight.isOwnFleet);

  // Filter actions based on confirmation state (single-truck only)
  // CONSULTA users: no actions at all
  // Plant + transporter CONSULTA: plant absorbs trip lifecycle actions
  const filteredActions = useMemo(() => {
    if (!freight || isChoferQueued) return [];
    if (isConsulta) return []; // CONSULTA = zero actions
    let acts = actions.filter(a=>{
      if(a==="confirm_loaded" && user.userType==="transporter" && freight?.transporterLoadedConfirmedAt) return false;
      if(a==="confirm_loaded" && user.userType==="producer" && freight?.producerLoadedConfirmedAt) return false;
      if(a==="confirm_finished" && user.userType==="transporter" && freight?.transporterFinishedConfirmedAt) return false;
      if(a==="confirm_finished" && user.userType==="plant" && freight?.plantFinishedConfirmedAt) return false;
      if(a==="confirm_finished" && user.userType==="producer" && freight?.isOwnFleet && freight?.transporterFinishedConfirmedAt) return false;
      return true;
    });
    // Plant absorbs trip lifecycle when transporter is CONSULTA
    if (transporterIsConsulta && !isMultiTruck) {
      const tripLifecycle = { accepted: "start", in_progress: "confirm_loaded", loaded: "confirm_finished" };
      const extra = tripLifecycle[freight.status];
      if (extra && !acts.includes(extra)) acts = [...acts, extra];
    }
    // Plant: inject approve_producer action only for producer own-fleet freights pending approval
    if (user.userType === "plant" && freight.useOwnFleet && freight.needsPlantApproval && !freight.plantApprovedAt) {
      acts = ["approve_producer", ...acts];
    }
    // Never show confirm_finished if confirm_loaded is still pending — carga must come first
    if (acts.includes("confirm_loaded") && acts.includes("confirm_finished")) {
      acts = acts.filter(a => a !== "confirm_finished");
    }
    return acts;
  }, [freight, isChoferQueued, isConsulta, actions, user, transporterIsConsulta, isMultiTruck]);

  // Filter assignments visible to this user (works for both single and multi-truck)
  const [localAssignmentOrder, setLocalAssignmentOrder] = useState(null);
  // Reset local order when freight changes (new data from server)
  useEffect(() => { setLocalAssignmentOrder(null); }, [freight?.id, freight?.activeAssignments?.length]);

  const visibleAssignments = useMemo(() => {
    const aa = localAssignmentOrder || freight?.activeAssignments || [];
    if (aa.length === 0) return [];
    if (user.role === "chofer") return aa.filter(a => a.driverId === user.id);
    if (user.userType === "transporter") return aa.filter(a => a.transportCompanyId === user.companyId);
    return aa;
  }, [freight?.activeAssignments, localAssignmentOrder, user]);

  // Multi-truck: aggregate top-level actions from all visible trips
  const multiTruckTopActions = useMemo(() => {
    if (!isMultiTruck || isChoferQueued || isConsulta) return [];
    const seen = new Map(); // key -> { label, color, icon, assignmentId, count }
    for (const a of visibleAssignments) {
      const ts = a.tripStatus;
      const isOwn = a.transportCompanyId === freight?.originCompanyId;
      const aTransporterIsConsulta = isPlantUser && a.transportCompanyId && transporterAccessMap[a.transportCompanyId] === "READONLY";
      const entries = [];
      if (user.userType === "plant") {
        if (ts === "loaded" && !a.plantFinishedConfirmedAt) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
        // Plant absorbs trip lifecycle when this assignment's transporter is CONSULTA
        if (aTransporterIsConsulta) {
          if (ts === "accepted") entries.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,16) });
          if (ts === "in_progress" && !a.transporterLoadedConfirmedAt) entries.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,16) });
          if (ts === "loaded" && !a.transporterFinishedConfirmedAt && !entries.find(e=>e.key==="confirm_trip_finished")) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
        }
      } else if (user.role !== "chofer" && user.userType === "producer" && !isOwn) {
        if (ts === "loaded" && !a.plantFinishedConfirmedAt) entries.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,16) });
      }
      if (user.userType === "transporter" || user.role === "chofer") {
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
  }, [isMultiTruck, isChoferQueued, isConsulta, isPlantUser, transporterAccessMap, visibleAssignments, freight, user]);

  // Compute primary + danger action buttons for ActionFooter (mobile) / inline (desktop)
  const primaryBtns = useMemo(() => {
    const btns = [];
    if(freight?.needsPlantApproval && !freight?.plantApprovedAt && filteredActions.includes("approve_producer")) btns.push(<Btn key="approve_prod" full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"approve_producer")}>{actionLoading?"Procesando...":"Aceptar flete de productor"}</Btn>);
    if(filteredActions.includes("authorize")) btns.push(<Btn key="auth" full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"authorize")}>{actionLoading?"Procesando...":"Autorizar viaje"}</Btn>);
    if(filteredActions.includes("assign")) btns.push(<Btn key="assign" full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"assign")}>Asignar transportista</Btn>);
    if(filteredActions.includes("assign_truck")) btns.push(<Btn key="assign_truck" full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"assign_truck")}>Asignar camión y chofer</Btn>);
    if(!isMultiTruck && filteredActions.includes("start")) btns.push(<Btn key="start" full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"start")}>{actionLoading?"Procesando...":"Iniciar viaje"}</Btn>);
    if(!isMultiTruck && filteredActions.includes("confirm_loaded")) btns.push(<Btn key="loaded" full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"confirm_loaded")}>{actionLoading?"Procesando...":"Confirmar carga"}</Btn>);
    if(!isMultiTruck && filteredActions.includes("confirm_finished")) btns.push(<Btn key="finished" full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"confirm_finished")}>{actionLoading?"Procesando...":"Confirmar entrega"}</Btn>);
    return btns;
  }, [filteredActions, actionLoading, freight?.id, onAction]);

  const dangerBtns = useMemo(() => {
    const btns = [];
    if(filteredActions.includes("cancel")) btns.push(<Btn key="cancel" sm v="err" icon={Ic.cross(C.err,14)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"cancel")} style={{flex:1}}>Cancelar</Btn>);
    if(filteredActions.includes("reject")) btns.push(<Btn key="reject" sm v="err" icon={Ic.ban(C.err,14)} disabled={actionLoading} onClick={()=>onAction(freight?.id,"reject")} style={{flex:1}}>Rechazar</Btn>);
    return btns;
  }, [filteredActions, actionLoading, freight?.id, onAction]);

  const hasFooterActions = !_isDesktop && (primaryBtns.length > 0 || dangerBtns.length > 0);

  // Guard: freight not yet loaded (deep link, stale reference) — AFTER all hooks
  if (!freight) return <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
    <div style={{ padding:"12px 18px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.b2}` }}>
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{Ic.chev(C.t3,14)} Volver</button>
    </div>
    {detailError ? (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:32 }}>
        {Ic.warn(C.err, 32)}
        <div style={{ fontSize:16, fontWeight:700, color:C.t1, textAlign:"center" }}>No se pudo cargar el flete</div>
        <div style={{ fontSize:13, color:C.t3, textAlign:"center", maxWidth:320 }}>{detailError}</div>
        <button onClick={onBack} style={{ marginTop:8, padding:"10px 24px", borderRadius: R.md, border:"none", background:C.pri, color:C.w, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Volver</button>
      </div>
    ) : <SkeletonDetail />}
  </div>;

  // Merge detail-only fields from full detail cache into freight
  const fullDocs = detailData?.documents ?? freight.documents ?? [];
  const fullConvId = detailData?.conversationId ?? freight.conversationId ?? null;
  const fullPendingChanges = detailData?.pendingChanges ?? freight.pendingChanges ?? [];
  const hasFullDetail = !!detailData || freight._isFullDetail;

  // Per-trip action for a given assignment
  const getTripActions = (a) => {
    const btns = [];
    const ts = a.tripStatus;
    const isOwnFleetTrip = a.transportCompanyId === freight.originCompanyId;
    if (user.userType === "plant") {
      if (ts === "loaded" && !a.plantFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    } else if (user.role !== "chofer" && user.userType === "producer" && !isOwnFleetTrip) {
      if (ts === "loaded" && !a.plantFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    }
    if (user.userType === "transporter" || user.role === "chofer") {
      if (ts === "accepted") btns.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,14) });
      if (ts === "in_progress" && !a.transporterLoadedConfirmedAt) btns.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,14) });
      if (ts === "loaded" && !a.transporterFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    }
    // Transporter can cancel a pending assignment (return it)
    if (user.userType === "transporter" && user.role !== "chofer" && ts === "pending" && a.transportCompanyId === user.companyId) {
      btns.push({ key:"reject_trip", label:"Devolver", color:C.err, icon:Ic.cross(C.w,14) });
    }
    if (user.userType === "producer" && isOwnFleetTrip) {
      if (ts === "accepted") btns.push({ key:"start_trip", label:"Iniciar viaje", color:C.pri, icon:Ic.truck(C.w,14) });
      if (ts === "in_progress" && !a.transporterLoadedConfirmedAt) btns.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,14) });
      if (ts === "loaded" && !a.transporterFinishedConfirmedAt) btns.push({ key:"confirm_trip_finished", label:"Confirmar entrega", color:C.pri, icon:Ic.chk(C.w,14) });
    }
    if (user.userType === "producer" && !isOwnFleetTrip) {
      if (ts === "in_progress" && !a.producerLoadedConfirmedAt && !btns.find(b=>b.key==="confirm_trip_loaded"))
        btns.push({ key:"confirm_trip_loaded", label:"Confirmar carga", color:C.acc, icon:Ic.chk(C.w,14) });
    }
    // Never show confirm_finished if confirm_loaded is still pending
    const hasLoad = btns.find(b=>b.key==="confirm_trip_loaded");
    const hasFinish = btns.find(b=>b.key==="confirm_trip_finished");
    if (hasLoad && hasFinish) return btns.filter(b=>b.key!=="confirm_trip_finished");
    return btns;
  };

  // Cross-confirmations dot (shared between inline progress and detail modal)
  const ConfDot = ({confirmed,label}) => (
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12.2}}>
      <span style={{width:16,height:16,borderRadius: R.md,display:"inline-flex",alignItems:"center",justifyContent:"center",background:confirmed?C.okPale:C.accPale,flexShrink:0}}>
        {confirmed ? Ic.chk(C.ok,11) : Ic.clk(C.acc,10)}
      </span>
      <span style={{color:confirmed?C.ok:C.t2,fontWeight:confirmed?600:400}}>{label}</span>
    </div>
  );

  return (
    <div style={{ flex:1, position:"relative" }}>
    <div style={{ position:"absolute", inset:0, overflow:"auto", animation:"slideUp 0.25s ease" }}>
      {/* Sticky header — back + product title */}
      <div style={{ position:"sticky", top:0, zIndex:10, padding:"18px 18px 8px", background:C.bg }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:600, color:C.pri, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
          {freight.producerCompanyId && (
            <button disabled={shareLoading} onClick={async()=>{
              if (shareLink) { setShareLink(null); return; }
              setShareLoading(true);
              try {
                const r = await apiCreateSharedLink({ linkType:"FREIGHT", targetCompanyId:freight.producerCompanyId, freightId:freight.id });
                const url = `${window.location.origin}/s/${r.token}`;
                setShareLink({ url, copied:false });
              } catch(e) { show(e.message||"Error al generar link","err"); }
              finally { setShareLoading(false); }
            }} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius: R.sm, border:`1px solid ${C.pri}30`, background:shareLink?C.priPale:`${C.pri}08`, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, color:C.pri }}>
              {Ic.doc(C.pri,13)} {shareLoading ? "..." : shareLink ? "Cerrar" : "Compartir"}
            </button>
          )}
        </div>
        {/* Share link mini-modal */}
        {shareLink && (
          <div style={{ padding:"10px 12px", marginBottom:8, borderRadius: R.md, background:C.w, border:`1px solid ${C.b1}`, boxShadow:C.sh }}>
            <div style={{ fontSize:11, color:C.t3, fontWeight:600, marginBottom:6 }}>Link de seguimiento</div>
            <div style={{ display:"flex", gap:6 }}>
              <input readOnly value={shareLink.url} style={{ flex:1, padding:"6px 8px", borderRadius: R.sm, border:`1px solid ${C.b2}`, fontSize:12, fontFamily:"inherit", color:C.t1, background:C.bgInput, outline:"none" }} />
              <button onClick={()=>{
                const msg = `Hola, te comparto el seguimiento de tu flete de ${freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} (${freight.code}): ${shareLink.url}`;
                const raw = freight.producerCompanyPhone || freight.producerCompany?.phone || "";
                const clean = raw.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
                const phone = clean.startsWith("0") ? "598" + clean.slice(1) : clean;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
              }} style={{ padding:"6px 10px", borderRadius: R.sm, border:"none", background:"#25D366", color:C.w, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
                Enviar por WhatsApp
              </button>
              <button onClick={()=>{ try { navigator.clipboard.writeText(shareLink.url); } catch { const ta=document.createElement("textarea"); ta.value=shareLink.url; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } setShareLink(s=>({...s,copied:true})); setTimeout(()=>setShareLink(s=>s?{...s,copied:false}:null),2000); }} style={{ padding:"6px 10px", borderRadius: R.sm, border:"none", background:shareLink.copied?C.ok:C.pri, color:C.w, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                {shareLink.copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:4 }}>
          {(()=>{const sc=STATUS_COLORS[freight.status]||STATUS_COLORS.pending_assignment; return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:500, color:sc.pillText, background:sc.pillBg, padding:"3px 10px", borderRadius: R.pill }}>{sc.pulse&&<span style={{width:6,height:6,borderRadius:"50%",background:sc.ribbon,animation:"tolvinkPulse 1.5s infinite"}}/>}{sc.label}</span>;})()}
          <span style={{ fontSize:24, fontWeight:800, color:C.t1, letterSpacing:-0.3 }}>{freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · {freight.tons} {freight.unit||"toneladas"}</span>
          <span style={{ fontFamily:MONO, fontSize:14, color:C.t1, marginLeft:4 }}>{freight.code}</span>
          {freight.loadDate && <><span style={{ fontSize:14, color:C.t1 }}>-</span><span style={{ fontSize:14, color:C.t1 }}>{formatFreightDate(freight.loadDate)}</span></>}
        </div>
        {/* Producer badge (plant-centric) */}
        {freight.producerCompanyName && (
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
            {Ic.user(C.acc, 13)}
            <span style={{ fontSize:12.5, color:C.acc, fontWeight:600 }}>{freight.producerCompanyName}</span>
            {freight.producerCompanyId !== freight.originCompanyId && freight.originCompanyName && (
              <span style={{ fontSize:11, color:C.t3 }}>· creado por {freight.originCompanyName}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding:"0 18px 18px" }}>

      {/* Queue banner for chofer */}
      {isChoferQueued && <div style={{ background:`${C.info}10`, border:`1.5px solid ${C.info}30`, borderRadius: R.lg, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ display:"flex" }}>{Ic.clk(C.info,20)}</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:C.info }}>En cola #{freight.queuePosition}</div>
          <div style={{ fontSize:12.7, color:C.t2 }}>Debés completar los fletes anteriores primero</div>
        </div>
      </div>}

      {freight.status === "pending_assignment" && user.userType === "producer" && freight.useOwnFleet === false && (
        <div style={{ background:`${C.info}10`, border:`1.5px solid ${C.info}30`, borderRadius: R.lg, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ display:"flex" }}>{Ic.plant(C.info,20)}</span>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:C.info }}>Transporte delegado a {freight.destPlantName || freight.destCompanyName || freight.destName || "la planta"}</div>
            <div style={{ fontSize:12.7, color:C.t2 }}>La planta se encargará de asignar el transportista</div>
          </div>
        </div>
      )}

      {/* Plant sees delegation request from producer */}
      {freight.status === "pending_assignment" && user.userType === "plant" && freight.useOwnFleet === false && freight.producerCompanyName && (
        <div style={{ background:`${C.acc}10`, border:`1.5px solid ${C.acc}30`, borderRadius: R.lg, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ display:"flex" }}>{Ic.warn(C.acc,20)}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.acc }}>Requiere asignar transporte</div>
            <div style={{ fontSize:12.7, color:C.t2 }}>{freight.producerCompanyName} delegó la asignación de transporte</div>
          </div>
          {!isConsulta && perms.canApprove && (
            <button onClick={()=>onAction(freight.id,"assign")} style={{ padding:"8px 14px", borderRadius: R.md, border:"none", background:C.acc, color:C.w, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Asignar</button>
          )}
        </div>
      )}

      {/* Flow C: Plant sees producer's own fleet pending approval */}
      {freight.status === "pending_assignment" && user.userType === "plant" && freight.useOwnFleet && (()=>{
        const ownFleetAssign = (freight.activeAssignments||[]).find(a => a.truckId);
        if (!ownFleetAssign) return null;
        return (
        <div style={{ background:`${C.acc}10`, border:`1.5px solid ${C.acc}30`, borderRadius: R.lg, padding:"12px 16px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ display:"flex" }}>{Ic.truck(C.acc,20)}</span>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.acc }}>Flota propia del productor</div>
              <div style={{ fontSize:12.7, color:C.t2 }}>
                <LicensePlate plate={ownFleetAssign.plate} size="sm" /> — {ownFleetAssign.driverName || "Sin chofer"}. Esperando tu aprobación.
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn full icon={Ic.chk(C.w,14)} disabled={actionLoading} onClick={()=>onAction(freight.id,"authorize")}>{actionLoading?"Procesando...":"Aprobar"}</Btn>
            <Btn full v="err" icon={Ic.cross(C.err,14)} disabled={actionLoading} onClick={()=>onAction(freight.id,"reject_own_fleet")}>Rechazar</Btn>
          </div>
        </div>);
      })()}

      {/* Primary actions — flow-advancing (desktop: inline, mobile: ActionFooter below) */}
      {_isDesktop && primaryBtns.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>{primaryBtns}</div>
      )}
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
            style={{ width:"100%", padding:"14px 20px", borderRadius: R.lg, border:"none", background:a.color, color:C.w, fontSize:17.3, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:actionLoading?0.6:1 }}>
            {a.icon} {actionLoading?"Procesando...":a.label}{a.count>1?` (${a.count})`:a.count===1?` #${a.tripNumber}`:""}
          </button>
        ))}
      </div>}

      {/* Progress — circular stepper with integrated confirmations */}
      {(()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const curIdx = steps.indexOf(freight.status);
        const isCanceled = freight.status === "canceled";
        const subLabels = { assigned:"Asignado", accepted:"Asignado", in_progress:"A campo", loaded:"A planta" };
        const visualIdx = isCanceled ? (curIdx >= 1 ? (curIdx >= 3 ? 2 : 1) : 0) : curIdx === 0 ? 0 : curIdx <= 4 ? 1 : 2;
        const multiTruckSub = isMultiTruck && [1,2,3,4].includes(curIdx) ? (freight.activeAssignments||[]).map(a => {
          const cfg = tripStCfg(a.tripStatus);
          const needsAuth = a.tripStatus === "pending" && freight.useOwnFleet && freight.needsPlantApproval && !freight.plantApprovedAt;
          return { n: a.tripNumber, cfg: needsAuth ? { ...cfg, label: "Sin autorización" } : cfg };
        }) : null;
        const singleSub = [1,2,3,4].includes(curIdx) || isCanceled ? subLabels[freight.status] || subLabels[steps[curIdx]] : null;
        const pendingLabel = freight.useOwnFleet && freight.needsPlantApproval && !freight.plantApprovedAt && (freight.activeAssignments||[]).some(a=>a.plate)
          ? "Esperando confirmación"
          : "Pendiente";
        const visualSteps = [
          { label:pendingLabel, color:STATUS_COLORS.pending_assignment.ribbon, icon:(c,s)=>Ic.clk(c,s) },
          { label:"En viaje", color:STATUS_COLORS.in_progress.ribbon, sub: !multiTruckSub ? singleSub : null, multiSub: multiTruckSub, icon:(c,s)=>Ic.truck(c,s) },
          { label: isCanceled ? "Cancelado" : "Finalizado", color: isCanceled ? STATUS_COLORS.canceled.ribbon : STATUS_COLORS.finished.ribbon, icon:(c,s)=> isCanceled ? Ic.cross(c,s) : Ic.chk(c,s) },
        ];
        const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; } };
        const actionLabels = { created:"Solicitado", assigned:"Asignado", assigned_multi:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Iniciado", confirm_loaded:"Carga OK", confirm_finished:"Entrega OK", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado", trip_accepted:"Aceptado", trip_rejected:"Rechazado", trip_started:"Iniciado", trip_confirm_loaded:"Carga OK", trip_confirm_finished:"Entrega OK", trip_finished:"Finalizado", assignment_canceled:"Cancelado", assignment_updated:"Editado", assignment_truck_assigned:"Camión asignado", auto_started:"Inicio auto", auto_loaded:"Carga auto", auto_transporter_confirmed:"Entrega auto" };
        const actionColors = { created:C.pri, assigned:C.sec, assigned_multi:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2, trip_accepted:C.info, trip_rejected:C.err, trip_started:C.acc, trip_confirm_loaded:C.acc, trip_confirm_finished:C.pri, trip_finished:C.ok, assignment_canceled:C.err, assignment_updated:C.t2, assignment_truck_assigned:C.info, auto_started:C.acc, auto_loaded:C.acc, auto_transporter_confirmed:C.pri };
        const stepAuditActions = {
          pending_assignment:["created"],
          assigned:["assigned","assigned_multi","assignment_updated","assignment_canceled"],
          accepted:["accepted","authorized","trip_accepted","trip_rejected"],
          in_progress:["started","trip_started","auto_started"],
          loaded:["confirm_loaded","trip_confirm_loaded","auto_loaded"],
          finished:["confirm_finished","finished","trip_confirm_finished","trip_finished","canceled","auto_transporter_confirmed"],
        };
        const stepToTrip = { assigned:["pending","accepted"], accepted:["accepted"], in_progress:["in_progress"], loaded:["loaded"], finished:["finished"] };
        const tripRank = { pending:0, accepted:1, in_progress:2, loaded:3, finished:4 };
        const getStepLogs = (step) => { if(!auditLog) return []; return auditLog.filter(l=>(stepAuditActions[step]||[]).includes(l.action)); };
        const getTruckCount = (step) => { if(!isMultiTruck) return null; const tsList=stepToTrip[step]; if(!tsList) return null; const minRank=Math.min(...tsList.map(t=>tripRank[t]??0)); return (freight.activeAssignments||[]).filter(a=>(tripRank[a.tripStatus]??0)>=minRank).length; };
        const tripLabel = (log) => { const tn = log.metadata?.tripNumber; return tn ? `Viaje #${tn}` : null; };
        const getStepAssignments = (step) => { if(!isMultiTruck) return []; const tsList=stepToTrip[step]; if(!tsList) return []; return (freight.activeAssignments||[]).filter(a=>tsList.includes(a.tripStatus)); };
        // Get date for each step from audit log
        const getStepDate = (backendSteps) => { if(!auditLog) return null; const logs = backendSteps.flatMap(s => getStepLogs(s)); if(logs.length === 0) return null; return logs[logs.length-1].createdAt; };
        const visualAuditMap = [["pending_assignment"],["assigned","accepted","in_progress","loaded"],["finished"]];
        const showConfs = !isMultiTruck && (freight.status==="loaded" || freight.status==="in_progress");
        return <div ref={auditRef} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, padding:16, marginBottom:12, boxShadow:C.sh, position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <span style={{ fontSize:12.2, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Progreso</span>
            <button onClick={()=>setShowProgressModal(true)} style={{ fontSize:12.6, fontWeight:700, color:C.t1, background:C.bg, border:`1.5px solid ${C.b1}`, borderRadius: R.sm, padding:"5px 13px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              Ver detalle <span style={{ fontSize:10.4, marginTop:1 }}>{"\u25BC"}</span>
            </button>
          </div>
          {/* Circular stepper nodes with connecting lines */}
          <div style={{display:"flex",alignItems:"flex-start",position:"relative",padding:"0 4px"}}>
            {visualSteps.map((vs,i)=>{
              const done = i < visualIdx; const active = i === visualIdx && !isCanceled; const isCancelStep = i === 2 && isCanceled;
              const nodeColor = done ? C.pri : active ? vs.color : isCancelStep ? C.err : C.b1;
              const nodeIcon = vs.icon(done || active || isCancelStep ? C.w : C.t3, 17);
              const stepDate = getStepDate(visualAuditMap[i]);
              return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",minWidth:0}}>
                {/* Connecting line before node */}
                {i > 0 && <div style={{position:"absolute",top:15,right:"50%",left:0,height:2,background:done||active||isCancelStep?C.pri:C.b1,zIndex:0,transform:"translateX(-4px)"}}/>}
                {/* Connecting line after node */}
                {i < 2 && <div style={{position:"absolute",top:15,left:"50%",right:0,height:2,background:done?(i+1<=visualIdx?C.pri:C.b1):C.b1,zIndex:0,transform:"translateX(4px)"}}/>}
                {/* Node circle */}
                <div onClick={()=>setStepModal({idx:i,label:vs.label,color:vs.color,backendSteps:visualAuditMap[i]})}
                  style={{width:31,height:31,borderRadius: R.xl,background:nodeColor,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1,cursor:"pointer",
                    boxShadow:active?`0 0 0 3px ${vs.color}25`:isCancelStep?`0 0 0 3px ${C.err}25`:"none",transition:"all 0.2s"}}>
                  {nodeIcon}
                </div>
                <span style={{fontSize:13,fontWeight:(active||isCancelStep)?700:done?600:500,color:(active||isCancelStep)?vs.color:done?C.t1:C.t3,textAlign:"center",lineHeight:1.2,marginTop:6}}>{vs.label}</span>
                {active && vs.sub && <span style={{fontSize:11.5,color:C.t3,fontStyle:"italic",textAlign:"center",lineHeight:1.2,marginTop:1}}>({vs.sub})</span>}
                {active && vs.multiSub && vs.multiSub.length > 0 && <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:2,alignItems:"center"}}>
                  {vs.multiSub.map(t => <span key={t.n} style={{fontSize:11,color:t.cfg.color,fontWeight:600,lineHeight:1.2}}>#{t.n} {t.cfg.label}</span>)}
                </div>}
                {(done || active || isCancelStep) && stepDate && <span style={{fontSize:10.7,color:C.t3,marginTop:2,textAlign:"center",lineHeight:1.2}}>{fmtD(stepDate)}</span>}
              </div>;
            })}
          </div>
          {/* Inline cross-confirmations */}
          {showConfs && <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.b1}`,display:"flex",gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:C.t2,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Carga</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <ConfDot confirmed={freight.transporterLoadedConfirmedAt} label="Transportista"/>
                <ConfDot confirmed={freight.producerLoadedConfirmedAt} label="Productor"/>
              </div>
              <WeighTicketSummary tickets={weighTickets.origin} label="Pesaje origen" />
            </div>
            <div style={{width:1,background:C.b1}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:C.t2,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Entrega</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <ConfDot confirmed={freight.transporterFinishedConfirmedAt} label="Transportista"/>
                <ConfDot confirmed={freight.plantFinishedConfirmedAt} label="Planta"/>
              </div>
              <WeighTicketSummary tickets={weighTickets.destination} label="Pesaje destino" />
            </div>
          </div>}
          {/* Weigh tickets display for finished freights (no cross-confirmations shown) */}
          {!showConfs && (weighTickets.origin.length > 0 || weighTickets.destination.length > 0) && (
            <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.b1}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.t2,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Tickets de Pesaje</div>
              <WeighTicketSummary tickets={weighTickets.origin} label="Origen" />
              <WeighTicketSummary tickets={weighTickets.destination} label="Destino" />
            </div>
          )}
        </div>;
      })()}

      {/* Assignment suggestions — for plant users when freight needs assignment */}
      {!isConsulta && perms.canApprove && (freight.status === "pending_assignment" || (freight.status === "assigned" && (freight.assignedTruckCount || 0) < (freight.truckCount || 1))) && (
        <AssignmentSuggestions freight={freight} user={user} onAssign={async (body) => { try { await apiAssignFreight(freight.id, body); if (onRefresh) onRefresh(freight.id); } catch (e) { show(e?.message || 'Error al asignar', 'err'); } }} onRefreshKey={freight.updatedAt || freight.status} />
      )}

      {/* Camiones section — always visible */}
      {freight.status !== "canceled" && (()=>{
        const truckCount = freight.truckCount || 1;
        const assignedCount = freight.assignedTruckCount || freight.activeAssignments?.length || 0;
        const canEditCount = !isConsulta && (perms.canRequest || perms.canApprove) && !["finished","canceled"].includes(freight.status);
        return <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, padding:16, marginBottom:12, boxShadow:C.sh }}>
          {/* Header: title + count + stepper */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6, marginBottom:visibleAssignments.length>0?12:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ display:"flex" }}>{Ic.truck(C.t2,16)}</span>
              <span style={{ fontSize:12.2, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Camiones</span>
              {canEditCount && (()=>{
                const displayCount = truckCountLocal ?? truckCount;
                return <div style={{ display:"flex", alignItems:"center", gap:3, marginLeft:4 }}>
                <button disabled={truckCountLoading||displayCount<=1||displayCount<=assignedCount} onClick={(e)=>{e.stopPropagation();handleTruckCountTap(-1);}} style={{ width:30, height:30, borderRadius: R.sm, border:`1.5px solid ${C.b1}`, background:C.bg, cursor:(truckCountLoading||displayCount<=1||displayCount<=assignedCount)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(truckCountLoading||displayCount<=1||displayCount<=assignedCount)?0.35:1, transition:"opacity 0.1s" }}>{Ic.minus(C.t1,15)}</button>
                <span style={{ fontSize:15.8, fontWeight:800, color:C.t1, minWidth:28, textAlign:"center" }}>{displayCount}</span>
                <button disabled={truckCountLoading||displayCount>=50} onClick={(e)=>{e.stopPropagation();handleTruckCountTap(1);}} style={{ width:30, height:30, borderRadius: R.sm, border:`1.5px solid ${C.b1}`, background:C.bg, cursor:(truckCountLoading||displayCount>=50)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(truckCountLoading||displayCount>=50)?0.35:1, transition:"opacity 0.1s" }}>{Ic.plus(C.t1,15)}</button>
              </div>;})()}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:14, fontWeight:600, color:C.info }}>{assignedCount}/{truckCountLocal ?? truckCount} asignados</span>
              {visibleAssignments.length > 0 && <button onClick={()=>setShowTruckModal(true)} style={{ fontSize:12.6, fontWeight:700, color:C.t1, background:C.bg, border:`1.5px solid ${C.b1}`, borderRadius: R.sm, padding:"5px 13px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
                Ver detalle <span style={{ fontSize:10.4, marginTop:1 }}>{"\u25BC"}</span>
              </button>}
            </div>
          </div>
          {/* Assignment cards */}
          {visibleAssignments.map(a => {
            const tst = tripStCfg(a.tripStatus);
            const tripBtns = isMultiTruck ? getTripActions(a) : [];
            const hasTruck = !!a.plate;
            const isExternalTransporter = a.transportCompanyId && a.transportCompanyId !== freight.originCompanyId && a.transportCompanyId !== user.activeCompanyId;
            const isPlantUser = freight.destCompanyId === user.activeCompanyId && freight.originCompanyId !== user.activeCompanyId;
            const canEditA = (()=>{
              if (isConsulta) return false;
              if (["in_progress","loaded","finished"].includes(a.tripStatus)) return false;
              // Plant cannot edit external transporter's truck — only desasignar
              if (isPlantUser && isExternalTransporter) return false;
              if (user.role === "platform_admin" || user.isSuperAdmin) return true;
              if (a.transportCompanyId === user.activeCompanyId) return true;
              if (freight.originCompanyId === user.activeCompanyId && freight.useOwnFleet) return true;
              if (freight.destCompanyId === user.activeCompanyId) return true;
              return false;
            })();
            return (
              <div key={a.id} style={{ display:"flex", borderRadius: R.sm, border:`0.5px solid ${C.b1}`, overflow:"hidden", background:C.w, marginBottom:8 }}>
                <div style={{ width:20, background:tst.color, flexShrink:0 }} />
                <div style={{ padding:"8px 10px", flex:1, minWidth:0 }}>
                  {/* Single line: #N plate - empresa - chofer | pill | edit */}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {isMultiTruck && <span style={{ fontSize:12, fontWeight:500, color:C.t2, marginRight:2 }}>#{a.tripNumber}</span>}
                    {hasTruck ? <LicensePlate plate={a.plate} size="sm" /> : <span style={{ fontSize:14, fontWeight:500, color:a.transporterName ? C.acc : C.t3 }}>{a.transporterName ? "Esperando camión" : "Sin camión"}</span>}
                    <span style={{ fontSize:12, color:C.t2 }}>- {a.transporterName || "Sin empresa"}</span>
                    <span style={{ fontSize:12, color:C.t2 }}>- {a.driverName || "Sin chofer"}</span>
                    <span style={{ flex:1 }} />
                    {(() => {
                      const needsAuth = a.tripStatus === "pending" && freight.useOwnFleet && freight.needsPlantApproval && !freight.plantApprovedAt;
                      const pillLabel = needsAuth ? "Sin autorización" : tst.label;
                      const pillColor = needsAuth ? "#E65100" : tst.color;
                      const pillBg = needsAuth ? "#FFF3E0" : tst.bg;
                      return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:500, color:pillColor, background:pillBg, padding:"2px 8px", borderRadius: R.pill, flexShrink:0 }}>{pillLabel}</span>;
                    })()}
                    {canEditA && onEditTrip && (
                      <button onClick={()=>onEditTrip(freight.id, a)} aria-label="Editar asignación" style={{ width:28, height:28, borderRadius: R.sm, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:"none", cursor:"pointer", flexShrink:0 }}>{Ic.edit(C.t3,14)}</button>
                    )}
                    {isMultiTruck && !["in_progress","loaded","finished"].includes(a.tripStatus) && visibleAssignments.length > 1 && (()=>{
                      const reorderable = visibleAssignments.filter(v=>!["in_progress","loaded","finished","canceled"].includes(v.tripStatus));
                      const idx = reorderable.findIndex(v=>v.id===a.id);
                      if (idx === -1) return null;
                      const swap = async (dir) => {
                        const ni = idx + dir;
                        if (ni < 0 || ni >= reorderable.length) return;
                        const newOrder = reorderable.map(v=>v.id);
                        [newOrder[idx], newOrder[ni]] = [newOrder[ni], newOrder[idx]];
                        // Optimistic: swap locally for instant UI update
                        const aa = [...(localAssignmentOrder || freight?.activeAssignments || [])];
                        const ai = aa.findIndex(x=>x.id===reorderable[idx].id);
                        const bi = aa.findIndex(x=>x.id===reorderable[ni].id);
                        if (ai !== -1 && bi !== -1) { [aa[ai], aa[bi]] = [aa[bi], aa[ai]]; setLocalAssignmentOrder(aa); }
                        try {
                          await apiReorderAssignments(newOrder);
                          show("Orden actualizado", "ok");
                        } catch (e) { show(e?.message || "Error al reordenar", "err"); setLocalAssignmentOrder(null); }
                      };
                      return <div style={{ display:"flex", gap:2, flexShrink:0 }}>
                        <button disabled={idx===0} onClick={()=>swap(-1)} style={{ background:"none", border:"none", cursor:idx>0?"pointer":"default", padding:2, opacity:idx>0?1:0.2, display:"flex", transform:"rotate(90deg)" }}>{Ic.chev(C.pri,16)}</button>
                        <button disabled={idx>=reorderable.length-1} onClick={()=>swap(1)} style={{ background:"none", border:"none", cursor:idx<reorderable.length-1?"pointer":"default", padding:2, opacity:idx<reorderable.length-1?1:0.2, display:"flex", transform:"rotate(-90deg)" }}>{Ic.chev(C.pri,16)}</button>
                      </div>;
                    })()}
                    {expandedTrip !== a.id && !a.plate && (a.tripStatus === "pending" || a.tripStatus === "accepted") && (perms.canApprove || (user.userType === "producer" && freight.useOwnFleet)) && !(user.userType === "plant" && a.transportCompanyId && a.transportCompanyId !== freight.originCompanyId) && onEditTrip && (
                      <button onClick={(e)=>{e.stopPropagation(); onEditTrip(freight.id, a);}} style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${C.acc}`, background:`${C.acc}0D`, color:C.acc, fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", flexShrink:0 }}>
                        {Ic.plus(C.acc,12)} Asignar
                      </button>
                    )}
                  </div>
                  {/* Confirmation status (in_progress/loaded) */}
                  {(a.tripStatus === "in_progress" || a.tripStatus === "loaded") && (
                    <div style={{ display:"flex", gap:12, marginTop:6 }}>
                      <div>
                        <span style={{ fontSize:10.4, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Carga: </span>
                        <span style={{ fontSize:11.5, display:"inline-flex", alignItems:"center", gap:3 }}>{a.transporterLoadedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Transp.</span> {a.producerLoadedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Prod.</span></span>
                      </div>
                      {a.tripStatus === "loaded" && <div>
                        <span style={{ fontSize:10.4, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Entrega: </span>
                        <span style={{ fontSize:11.5, display:"inline-flex", alignItems:"center", gap:3 }}>{a.transporterFinishedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Transp.</span> {a.plantFinishedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Planta</span></span>
                      </div>}
                    </div>
                  )}
                  {/* Trip action buttons (multi-truck) */}
                  {(tripBtns.length > 0 || (user.userType === "plant" && (a.tripStatus === "pending" || a.tripStatus === "accepted") && a.transportCompanyId !== freight.originCompanyId && a.plate && onCancelAssignment)) && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
                      {tripBtns.map(b => (
                        <button key={b.key} disabled={actionLoading} onClick={()=>onTripAction && onTripAction(freight.id, a.id, b.key)} style={{ flex:"1 1 auto", padding:"8px 10px", minHeight:36, borderRadius: R.md, border:"none", background:b.color, color:C.w, fontSize:12, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:4, opacity:actionLoading?0.6:1 }}>
                          {b.icon} {actionLoading?"...":b.label}
                        </button>
                      ))}
                      {user.userType === "plant" && (a.tripStatus === "pending" || a.tripStatus === "accepted") && a.transportCompanyId !== freight.originCompanyId && a.plate && onCancelAssignment && (
                        <button disabled={actionLoading} onClick={(e)=>{e.stopPropagation(); if(confirm("¿Desasignar este camión?")) onCancelAssignment(freight.id, a.id, "Desasignado por planta").then(r=>{if(r?.ok) onRefresh && onRefresh(freight.id);});}} style={{ flex:"1 1 auto", padding:"8px 10px", minHeight:36, borderRadius: R.md, border:`1px solid ${C.err}`, background:`${C.err}08`, color:C.err, fontSize:12, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:4, opacity:actionLoading?0.6:1 }}>
                          {Ic.ban(C.err,12)} Desasignar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Empty placeholder lines for unassigned truck slots */}
          {Array.from({ length: Math.max(0, (truckCountLocal ?? truckCount) - assignedCount) }, (_, i) => (
            <div key={`empty-${i}`} style={{ border:`1px dashed ${C.b1}`, borderLeft:`3px solid ${C.b1}`, borderRadius: R.md, marginBottom:8, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
              {isMultiTruck && <span style={{ fontSize:13.9, fontWeight:800, color:C.t3 }}>#{assignedCount + i + 1}</span>}
              <span style={{ fontSize:13.9, fontWeight:500, color:C.t3, flex:1, fontStyle:"italic" }}>Pendiente de asignar</span>
              {!isConsulta && !["canceled","finished"].includes(freight.status) && (perms.canApprove || user.userType === "producer") && (
                <button onClick={()=>onAction(freight.id,"assign")} style={{ padding:"6px 10px", borderRadius: R.sm, border:`1px solid ${C.acc}`, background:`${C.acc}0D`, color:C.acc, fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", flexShrink:0 }}>
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
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius: R.xl, padding:"24px 20px", width:"min(340px,90vw)", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
            {truckModal.type === "add" ? (<>
              <div style={{ fontSize:16.2, fontWeight:700, color:C.t1, marginBottom:4 }}>Agregar camión</div>
              <div style={{ fontSize:13.9, color:C.t3, marginBottom:16 }}>¿El camión adicional es de flota propia o se delega a la planta?</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button onClick={()=>handleTruckModalConfirm("own_fleet")} style={{ width:"100%", padding:"12px 0", borderRadius: R.md, border:"none", background:C.pri, color:C.w, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {Ic.truck(C.w,14)} Flota propia — Asignar ahora
                </button>
                <button onClick={()=>handleTruckModalConfirm("delegate")} style={{ width:"100%", padding:"12px 0", borderRadius: R.md, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Delegar a planta
                </button>
                <button onClick={handleTruckModalCancel} style={{ width:"100%", padding:"10px 0", borderRadius: R.md, border:"none", background:"transparent", color:C.t3, fontSize:13.9, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
              </div>
            </>) : (<>
              <div style={{ fontSize:16.2, fontWeight:700, color:C.t1, marginBottom:4 }}>Reducir camiones</div>
              <div style={{ fontSize:13.9, color:C.t3, marginBottom:16 }}>
                {visibleAssignments.length > 0
                  ? "¿Desea quitar un camión específico o delegar la decisión a la planta?"
                  : "Se reducirá la cantidad de camiones solicitados."}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {visibleAssignments.length > 0 && visibleAssignments.filter(a=>a.tripStatus==="pending"||a.tripStatus==="accepted").map(a => (
                  <button key={a.id} onClick={async()=>{const nextCount=truckModal?.next;setTruckModal(null);if(onCancelAssignment){const r=await onCancelAssignment(freight.id,a.id,"Reducción de camiones");if(r&&r.ok){commitTruckCount(nextCount);}else{setTruckCountLocal(null);show(r?.error||"No se pudo quitar el camión","err");}}}} style={{ width:"100%", padding:"10px 12px", borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:13.9, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8, textAlign:"left" }}>
                    <span style={{ fontSize:12.7, fontWeight:700, color:C.err }}>Quitar</span>
                    <span>{a.plate || "Sin placa"}</span>
                    {a.transporterName && <span style={{ color:C.t3, fontSize:12.7 }}>· {a.transporterName}</span>}
                  </button>
                ))}
                <button onClick={()=>handleTruckModalConfirm("remove_delegate")} style={{ width:"100%", padding:"12px 0", borderRadius: R.md, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Delegar a planta
                </button>
                <button onClick={handleTruckModalCancel} style={{ width:"100%", padding:"10px 0", borderRadius: R.md, border:"none", background:"transparent", color:C.t3, fontSize:13.9, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}


      {/* Info + Map — side by side on desktop */}
      <div style={{ display:"flex", flexDirection:_isDesktop?"row":"column", gap:12, marginBottom:12, alignItems:_isDesktop?"stretch":undefined }}>
        <div style={{ flex:"1 1 0%", minWidth:0 }}>
          <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.lg, padding:16, boxShadow:C.sh, height:"100%", boxSizing:"border-box" }}>
          {(()=>{
            const InfoRow = ({ic,label,val,isLast}) => (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:isLast?"none":`1px solid ${C.b2}` }}>
                <span style={{display:"flex",flexShrink:0}}>{ic}</span>
                <span style={{ fontSize:13.3, color:C.t2, minWidth:85 }}>{label}</span>
                {label==="Teléfono"?<a href={`tel:${val}`} style={{ fontSize:13.9, fontWeight:600, color:C.info, marginLeft:"auto", textDecoration:"none" }}>{val}</a>:
                <span style={{ fontSize:13.9, fontWeight:600, color:C.t1, marginLeft:"auto", textAlign:"right" }}>{val}</span>}
              </div>
            );
            const carga = [
              [Ic.grain(C.t2,15),"Producto",`${freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain}${freight.tons ? ` · ${freight.tons} ${freight.unit||"tn"}` : ""}`],
              freight.amount>0&&[Ic.grain(C.t2,15),"Importe",`$${Number(freight.amount).toLocaleString()}`],
            ].filter(Boolean);
            const ruta = [
              freight.producerCompanyName && [Ic.user(C.acc,15),"Productor",freight.producerCompanyName],
              [Ic.user(C.pri,15),"Empresa",freight.originCompanyName||originDisplay(freight)],
              [Ic.field(C.ok,15),"Campo",originDisplay(freight)||"—"],
              [Ic.plant(C.t2,15),"Destino",destDisplay(freight)],
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
        </div>
        <div style={{ flex:"1 1 0%", minWidth:0 }}>
          <Suspense fallback={<div style={{height:300,display:"flex",alignItems:"center",justifyContent:"center",color:C.t3,fontSize:13}}>Cargando mapa...</div>}>
            <FreightMap freightId={freight.id} originLat={freight.originLat} originLng={freight.originLng} destLat={freight.destLat} destLng={freight.destLng} originName={[freight.originCompanyName, originDisplay(freight)].filter(Boolean).join(" — ")} destName={destDisplay(freight)} status={freight.status} isDriver={user.userType==="transporter"||(user.userType==="producer"&&freight.isOwnFleet)}/>
          </Suspense>
        </div>
      </div>

      {/* Notes / Observaciones */}
      {freight.notes && (()=>{
        const isUrgent = /urgente|cuidado|atenci[oó]n|importante|prioridad/i.test(freight.notes);
        return <div style={{ background:C.warnPale, border:`1px solid ${C.warn}30`, borderLeft:`${isUrgent?4:3}px solid ${C.warn}`, borderRadius: R.lg, padding:14, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            {isUrgent ? Ic.warn(C.warn, 15) : Ic.doc(C.warn, 14)}
            <span style={{ fontSize:12.2, fontWeight:700, color:C.warn, textTransform:"uppercase", letterSpacing:0.5 }}>Observaciones{isUrgent?" — Atención":""}</span>
          </div>
          <div style={{ fontSize:14.5, color:C.t1, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{freight.notes}</div>
        </div>;
      })()}

      {/* Pending changes banner */}
      {fullPendingChanges?.length > 0 && (()=>{
        const myCompanyId = user.activeCompanyId || user.companyId;
        return fullPendingChanges.map(pc => {
          const isApprover = pc.approverCompanyId === myCompanyId;
          const label = pc.changeType === "useOwnFleet"
            ? `Cambio de flota propia: ${pc.fromValue?.useOwnFleet ? "Sí" : "No"} → ${pc.toValue?.useOwnFleet ? "Sí" : "No"}`
            : pc.changeType === "destPlant"
              ? `Cambio de destino: ${pc.fromValue?.destName || "—"} → ${pc.toValue?.destName || "—"}`
              : "Cambio pendiente";
          return <div key={pc.id} style={{ background:C.infoPale||"#e8f4fd", border:`1.5px solid ${C.info}30`, borderLeft:`3px solid ${C.info}`, borderRadius: R.lg, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              {Ic.doc(C.info, 14)}
              <span style={{ fontSize:12.2, fontWeight:700, color:C.info, textTransform:"uppercase", letterSpacing:0.5 }}>Cambio pendiente de aprobación</span>
            </div>
            <div style={{ fontSize:13.9, color:C.t1, marginBottom:isApprover?10:0 }}>{label}{pc.requestedBy?.name ? ` — solicitado por ${pc.requestedBy.name}` : ""}</div>
            {isApprover && <div style={{ display:"flex", gap:8 }}>
              <Btn sm disabled={pcLoading===pc.id} onClick={async()=>{ setPcLoading(pc.id); try { await apiApprovePendingChange(freight.id, pc.id); onRefresh(freight.id); } catch(e) { log.error("approve-pc",e); show("Error al procesar el cambio", "err"); } finally { setPcLoading(null); } }}>Aprobar</Btn>
              <Btn sm v="err" disabled={pcLoading===pc.id} onClick={async()=>{ setPcLoading(pc.id); try { await apiRejectPendingChange(freight.id, pc.id); onRefresh(freight.id); } catch(e) { log.error("reject-pc",e); show("Error al procesar el cambio", "err"); } finally { setPcLoading(null); } }}>Rechazar</Btn>
            </div>}
            {!isApprover && <div style={{ fontSize:12.2, color:C.t3, marginTop:4 }}>Esperando aprobación de la otra parte</div>}
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
        return <div style={{ background:b.bg, border:`1.5px solid ${b.border}30`, borderRadius: R.lg, padding:14, marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          {b.icon}
          <div>
            <div style={{ fontSize:13.9, fontWeight:700, color:b.border }}>{b.title}</div>
            <div style={{ fontSize:12.7, color:C.t2 }}>{b.desc}</div>
          </div>
        </div>;
      })()}

      {/* Documents: gallery + upload side-by-side on desktop */}
      {(() => {
        const canUpload = freight.status !== "finished" && freight.status !== "canceled";
        const hasDocs = fullDocs && fullDocs.length > 0;
        if (!canUpload && !hasDocs && hasFullDetail) return null;
        // Show skeleton shimmer while loading detail (documents not yet available)
        if (!hasFullDetail && !hasDocs) return (
          <div style={{ background:C.w, borderRadius: R.lg, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:12.2, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Documentos</div>
            <div style={{ display:"flex", gap:8 }}>
              {[1,2,3].map(i => <div key={i} style={{ width:72, height:72, background:C.b2, borderRadius: R.md, animation:"pulse 1.5s ease-in-out infinite" }}/>)}
            </div>
          </div>
        );
        if (!canUpload && !hasDocs) return null;
        return (
          <div style={{ display:"flex", flexDirection:_isDesktop && canUpload && hasDocs?"row":"column", gap:12, marginBottom:12, alignItems:_isDesktop && canUpload && hasDocs?"stretch":undefined }}>
            {hasDocs && <div style={{ flex:1, minWidth:0, display:"flex" }}><DocsGallery documents={fullDocs} onViewFile={setViewFile} freightId={freight.id} canDelete={canUpload} onDeleted={()=>{ if(onRefresh) onRefresh(freight.id); }} onOcr={handleOcr} ocrLoading={ocrLoading} onViewOcr={handleViewOcr}/></div>}
            {canUpload && <div style={{ flex:1, minWidth:0, display:"flex" }}><FreightFileUpload freightId={freight.id} step={freight.status==="pending_assignment"?"request":freight.status==="in_progress"||freight.status==="loaded"?"load_confirmation":"assignment"} onUploaded={()=>{ if(onRefresh) onRefresh(freight.id); }} /></div>}
          </div>
        );
      })()}

      {/* Chat + PDF compact row */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button onClick={()=>onChat(fullConvId)} disabled={!fullConvId}
          style={{ flex:1, background:C.priPale, borderRadius: R.md, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"center", gap:7, border:`1.5px solid ${C.pri}30`, cursor:fullConvId?"pointer":"default", fontFamily:"inherit" }}>
          {Ic.msg(C.pri,16)}<span style={{ fontSize:13.9, fontWeight:700, color:C.pri }}>Chat</span>
        </button>
        <button disabled={pdfLoading} onClick={async()=>{
          if(pdfLoading) return;
          setPdfLoading(true);
          try {
            let logs = auditLog;
            if(!logs) { try { logs = await apiGetAuditLog(freight.id); setAuditLog(logs); } catch(e) { logs = []; } }
            const { generateFreightPDF } = await loadPdfReport();
            generateFreightPDF({ ...freight, documents: fullDocs, conversationId: fullConvId, pendingChanges: fullPendingChanges }, logs || []);
          } catch(e) { log.error('PDF', e); useUIStore.getState().show('Error al generar PDF: ' + (e?.message || e), 'err'); }
          finally { setPdfLoading(false); }
        }} style={{ flex:1, background:C.w, borderRadius: R.md, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"center", gap:7, border:`1.5px solid ${C.b1}`, cursor:"pointer", fontFamily:"inherit", opacity:pdfLoading?0.6:1 }}>
          {Ic.doc(C.t2,16)}<span style={{ fontSize:13.9, fontWeight:700, color:C.t1 }}>{pdfLoading?'Generando...':'PDF'}</span>
        </button>
      </div>

      {/* Edit action (neutral) — hidden for CONSULTA */}
      {!isConsulta && ["pending_assignment","assigned","accepted","in_progress","loaded"].includes(freight.status) && (perms.canRequest || perms.canApprove) && (
        <div style={{ marginBottom:8 }}>
          <Btn sm v="ghost" icon={Ic.edit(C.t2,14)} onClick={()=>onEdit(freight)} style={{width:"100%"}}>Editar flete</Btn>
        </div>
      )}
      {/* Danger zone — cancel/reject (desktop: inline, mobile: ActionFooter below) */}
      {_isDesktop && dangerBtns.length > 0 && (
        <div style={{ background:`${C.err}06`, border:`1px solid ${C.err}15`, borderRadius: R.md, padding:10, marginBottom:8 }}>
          <div style={{ display:"flex", gap:8 }}>{dangerBtns}</div>
        </div>
      )}
      {/* Mobile: spacer for fixed ActionFooter */}
      {hasFooterActions && <div style={{ height:80 }} />}
      </div>
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)} onOcr={handleOcr} ocrLoading={ocrLoading} onViewOcr={handleViewOcr}/>
      {ocrLoading && <div style={{ position:"fixed", inset:0, zIndex:250 }}><UploadOverlay uploading={ocrLoading} done={false} total={1} current={1} label="Extrayendo datos"/></div>}
      <OcrResultModal result={ocrResult} onClose={()=>{setOcrResult(null);setOcrDocId(null);}} freightId={freight?.id} docId={ocrDocId} onSaved={()=>{ if(onRefresh) onRefresh(freight?.id); }}/>

    </div>

    {/* Mobile ActionFooter — fixed above BottomNav */}
    {hasFooterActions && (
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, zIndex:20,
        background:C.w, borderTop:`1px solid ${C.b2}`,
        padding:"10px 18px max(10px, env(safe-area-inset-bottom))",
        boxShadow:"0 -2px 12px rgba(0,0,0,0.08)",
      }}>
        {primaryBtns.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{primaryBtns}</div>
        )}
        {dangerBtns.length > 0 && (
          <div style={{ display:"flex", gap:8, marginTop: primaryBtns.length > 0 ? 8 : 0 }}>{dangerBtns}</div>
        )}
      </div>
    )}

    {/* Progress detail popup — centered in detail panel */}
      {showProgressModal && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const curIdx = steps.indexOf(freight.status);
        const isCanceled = freight.status === "canceled";
        const visualIdx = isCanceled ? (curIdx >= 1 ? (curIdx >= 3 ? 2 : 1) : 0) : curIdx === 0 ? 0 : curIdx <= 4 ? 1 : 2;
        const stepAuditActions = {
          pending_assignment:["created"],
          assigned:["assigned","assigned_multi","assignment_updated","assignment_canceled"],
          accepted:["accepted","authorized","trip_accepted","trip_rejected"],
          in_progress:["started","trip_started","auto_started"],
          loaded:["confirm_loaded","trip_confirm_loaded","auto_loaded"],
          finished:["confirm_finished","finished","trip_confirm_finished","trip_finished","canceled","auto_transporter_confirmed"],
        };
        const actionLabels = { created:"Solicitado", assigned:"Asignado", assigned_multi:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Iniciado", confirm_loaded:"Carga OK", confirm_finished:"Entrega OK", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado", trip_accepted:"Aceptado", trip_rejected:"Rechazado", trip_started:"Iniciado", trip_confirm_loaded:"Carga OK", trip_confirm_finished:"Entrega OK", trip_finished:"Finalizado", assignment_canceled:"Cancelado", assignment_updated:"Editado", assignment_truck_assigned:"Camión asignado", auto_started:"Inicio auto", auto_loaded:"Carga auto", auto_transporter_confirmed:"Entrega auto" };
        const actionColors = { created:C.pri, assigned:C.sec, assigned_multi:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2, trip_accepted:C.info, trip_rejected:C.err, trip_started:C.acc, trip_confirm_loaded:C.acc, trip_confirm_finished:C.pri, trip_finished:C.ok, assignment_canceled:C.err, assignment_updated:C.t2, assignment_truck_assigned:C.info, auto_started:C.acc, auto_loaded:C.acc, auto_transporter_confirmed:C.pri };
        const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch{ return ""; } };
        const getStepLogs = (step) => { if(!auditLog) return []; return auditLog.filter(l=>(stepAuditActions[step]||[]).includes(l.action)); };
        const stepToTrip = { assigned:["pending","accepted"], accepted:["accepted"], in_progress:["in_progress"], loaded:["loaded"], finished:["finished"] };
        const tripRank = { pending:0, accepted:1, in_progress:2, loaded:3, finished:4 };
        const getTruckCount = (step) => { if(!isMultiTruck) return null; const tsList=stepToTrip[step]; if(!tsList) return null; const minRank=Math.min(...tsList.map(t=>tripRank[t]??0)); return (freight.activeAssignments||[]).filter(a=>(tripRank[a.tripStatus]??0)>=minRank).length; };
        const getStepAssignments = (step) => { if(!isMultiTruck) return []; const tsList=stepToTrip[step]; if(!tsList) return []; return (freight.activeAssignments||[]).filter(a=>tsList.includes(a.tripStatus)); };
        const visualAuditSteps = [
          { label:"Pendiente", backendSteps:["pending_assignment"], color:C.acc, icon:(c,s)=>Ic.clk(c,s) },
          { label:"En curso", backendSteps:["assigned","accepted","in_progress","loaded"], color:C.pri, icon:(c,s)=>Ic.truck(c,s) },
          { label: isCanceled ? "Cancelado" : "Finalizado", backendSteps:["finished"], color: isCanceled ? C.err : C.ok, icon:(c,s)=> isCanceled ? Ic.cross(c,s) : Ic.chk(c,s) },
        ];
        const showConfs = !isMultiTruck && (freight.status==="loaded" || freight.status==="in_progress");
        return <div onClick={()=>setShowProgressModal(false)} style={{ position:"absolute", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius: R.lg, padding:20, maxWidth:560, width:"100%", maxHeight:"80%", overflow:"auto", boxShadow:C.shLg }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ display:"flex" }}>{Ic.clk(C.pri,20)}</span><span style={{ fontSize:18.6, fontWeight:800, color:C.pri }}>Progreso</span></div>
              <button onClick={()=>setShowProgressModal(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,18)}</button>
            </div>
            {/* Cross-confirmations */}
            {showConfs && <div style={{marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${C.b1}`,display:"flex",gap:16}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12.6,fontWeight:700,color:C.t2,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Carga</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <ConfDot confirmed={freight.transporterLoadedConfirmedAt} label="Transportista"/>
                  <ConfDot confirmed={freight.producerLoadedConfirmedAt} label="Productor"/>
                </div>
              </div>
              <div style={{width:1,background:C.b1}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12.6,fontWeight:700,color:C.t2,marginBottom:6,textTransform:"uppercase",letterSpacing:0.4}}>Entrega</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <ConfDot confirmed={freight.transporterFinishedConfirmedAt} label="Transportista"/>
                  <ConfDot confirmed={freight.plantFinishedConfirmedAt} label="Planta"/>
                </div>
              </div>
            </div>}
            {/* Audit timeline by stage */}
            {!auditLog && <div style={{textAlign:"center",padding:"12px 0",fontSize:14.6,color:C.t3}}>Cargando detalle...</div>}
            {auditLog && <div style={{ display:"flex", gap:6 }}>
              {visualAuditSteps.map((vas,vi)=>{
                const done = vi < visualIdx; const active = vi === visualIdx && !isCanceled; const isCancelStep = vi === 2 && isCanceled;
                const col = done ? C.pri : (active || isCancelStep) ? vas.color : C.t3;
                const logs = vas.backendSteps.flatMap(s => getStepLogs(s));
                const stepAssigns = vas.backendSteps.flatMap(s => getStepAssignments(s));
                const tc = isMultiTruck && vi === 1 ? (()=>{ const counts = vas.backendSteps.map(s => getTruckCount(s)).filter(v=>v!==null); return counts.length > 0 ? Math.max(...counts) : null; })() : null;
                return (
                  <div key={vi} style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14.0, fontWeight:700, color:col, marginBottom:8, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}><span style={{ display:"flex" }}>{vas.icon(col,18)}</span>{vas.label}</div>
                    {tc !== null && <div style={{ textAlign:"center", fontSize:13.2, fontWeight:700, color:col, marginBottom:8, background:`${col}12`, borderRadius: R.sm, padding:"3px 0" }}>{tc}/{freight.truckCount}</div>}
                    {logs.map(entry => {
                      const acCol = actionColors[entry.action] || C.t2;
                      const tn = entry.metadata?.tripNumber ? `#${entry.metadata.tripNumber}` : null;
                      return <div key={entry.id} style={{ display:"flex", gap:5, marginBottom:8, alignItems:"flex-start" }}>
                        <div style={{ width:7, height:7, borderRadius: R.xs, background:acCol, flexShrink:0, marginTop:4 }} />
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:14.0, fontWeight:700, color:acCol, lineHeight:1.3 }}>{actionLabels[entry.action]||entry.action}{tn ? ` · ${tn}` : ""}</div>
                          <div style={{ fontSize:13.2, color:C.t2, marginTop:1, lineHeight:1.3, wordBreak:"break-word" }}>{entry.user?.name||"Sistema"}</div>
                          {entry.user?.company?.name && <div style={{ fontSize:12.6, color:C.t3, lineHeight:1.2 }}>{entry.user.company.name}</div>}
                          {(entry.reason || entry.metadata?.reason) && <div style={{ fontSize:12.6, color:C.t3, fontStyle:"italic", marginTop:1 }}>"{(entry.reason||entry.metadata.reason)==="both_consulta"?"Ambos CONSULTA — auto-completado":entry.reason||entry.metadata.reason}"</div>}
                          <div style={{ fontSize:12.6, color:C.t3, marginTop:1 }}>{fmtD(entry.createdAt)}</div>
                        </div>
                      </div>;
                    })}
                    {logs.length === 0 && stepAssigns.length > 0 && stepAssigns.map(a => (
                      <div key={a.id} style={{ display:"flex", gap:5, marginBottom:8, alignItems:"flex-start" }}>
                        <div style={{ width:7, height:7, borderRadius: R.xs, background:col, flexShrink:0, marginTop:4 }} />
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13.2, fontWeight:700, color:C.t1 }}>Viaje #{a.tripNumber}</div>
                          {a.plate && <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:1, lineHeight:1.3 }}><LicensePlate plate={a.plate} size="sm" />{a.truckModel?<span style={{ fontSize:13.2, color:C.t2 }}> · {a.truckModel}</span>:""}</div>}
                          {a.transporterName && <div style={{ fontSize:12.6, color:C.t3, lineHeight:1.2 }}>{a.transporterName}</div>}
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && stepAssigns.length === 0 && <div style={{ fontSize:12.0, color:C.t3, textAlign:"center" }}>{"\u2014"}</div>}
                  </div>
                );
              })}
            </div>}
          </div>
        </div>;
      })()}

      {/* Truck detail popup — centered in detail panel */}
      {showTruckModal && (()=>{
        const truckCount = freight.truckCount || 1;
        const assignedCount = freight.assignedTruckCount || freight.activeAssignments?.length || 0;
        return <div onClick={()=>setShowTruckModal(false)} style={{ position:"absolute", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius: R.lg, padding:20, maxWidth:440, width:"100%", maxHeight:"80%", overflow:"auto", boxShadow:C.shLg }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ display:"flex" }}>{Ic.truck(C.pri,20)}</span>
                <span style={{ fontSize:18.6, fontWeight:800, color:C.t1 }}>Camiones</span>
                <span style={{ fontSize:16.1, fontWeight:600, color:C.info }}>{assignedCount}/{truckCount}</span>
              </div>
              <button onClick={()=>setShowTruckModal(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,18)}</button>
            </div>
            {visibleAssignments.map(a => {
              const tst = tripStCfg(a.tripStatus);
              const tripBtns = isMultiTruck ? getTripActions(a) : [];
              const hasTruck = !!a.plate;
              return <div key={a.id} style={{ display:"flex", borderRadius: R.sm, border:`0.5px solid ${C.b1}`, overflow:"hidden", background:C.w, marginBottom:10 }}>
                <div style={{ width:20, background:tst.color, flexShrink:0 }} />
                <div style={{ padding:"10px 12px", flex:1, minWidth:0 }}>
                  {/* Single line: #N plate - empresa - chofer | pill */}
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {isMultiTruck && <span style={{ fontSize:13, fontWeight:500, color:C.t2 }}>#{a.tripNumber}</span>}
                    {hasTruck ? <LicensePlate plate={a.plate} size="sm" /> : <span style={{ fontSize:15, fontWeight:500, color:a.transporterName ? C.acc : C.t3 }}>{a.transporterName ? "Esperando camión" : "Sin camión"}</span>}
                    <span style={{ fontSize:13, color:C.t2 }}>- {a.transporterName || "Sin empresa"}</span>
                    <span style={{ fontSize:13, color:C.t2 }}>- {a.driverName || "Sin chofer"}</span>
                    <span style={{ flex:1 }} />
                    {(() => {
                      const needsAuth = a.tripStatus === "pending" && freight.useOwnFleet && freight.needsPlantApproval && !freight.plantApprovedAt;
                      const pillLabel = needsAuth ? "Sin autorización" : tst.label;
                      const pillColor = needsAuth ? "#E65100" : tst.color;
                      const pillBg = needsAuth ? "#FFF3E0" : tst.bg;
                      return <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:500, color:pillColor, background:pillBg, padding:"2px 8px", borderRadius: R.pill }}>{pillLabel}</span>;
                    })()}
                  </div>
                  {/* Confirmation status */}
                  {(a.tripStatus === "in_progress" || a.tripStatus === "loaded") && (
                    <div style={{ display:"flex", gap:12, marginTop:6 }}>
                      <div>
                        <span style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Carga: </span>
                        <span style={{ fontSize:12, display:"inline-flex", alignItems:"center", gap:3 }}>{a.transporterLoadedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Transp.</span> {a.producerLoadedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Prod.</span></span>
                      </div>
                      {a.tripStatus === "loaded" && <div>
                        <span style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:"uppercase" }}>Entrega: </span>
                        <span style={{ fontSize:12, display:"inline-flex", alignItems:"center", gap:3 }}>{a.transporterFinishedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Transp.</span> {a.plantFinishedConfirmedAt ? Ic.chk(C.ok,11) : Ic.clk(C.acc,11)} <span>Planta</span></span>
                      </div>}
                    </div>
                  )}
                  {/* Action buttons */}
                  {tripBtns.length > 0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
                      {tripBtns.map(b => (
                        <button key={b.key} disabled={actionLoading} onClick={()=>onTripAction && onTripAction(freight.id, a.id, b.key)} style={{ flex:"1 1 auto", padding:"10px 12px", minWidth:80, minHeight:40, borderRadius: R.md, border:"none", background:b.color, color:C.w, fontSize:14, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:actionLoading?0.6:1 }}>
                          {b.icon} {actionLoading?"...":b.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(tripBtns.length > 0 || (!a.plate && (a.tripStatus === "pending" || a.tripStatus === "accepted") && (perms.canApprove || (user.userType === "producer" && freight.useOwnFleet)) && onEditTrip) || (user.userType === "plant" && (a.tripStatus === "pending" || a.tripStatus === "accepted") && a.transportCompanyId && a.transportCompanyId !== freight.originCompanyId && a.plate && onCancelAssignment)) && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
                    {tripBtns.map(b => (
                      <button key={b.key} disabled={actionLoading} onClick={()=>onTripAction && onTripAction(freight.id, a.id, b.key)} style={{ flex:"1 1 auto", padding:"10px 12px", minWidth:80, minHeight:40, borderRadius: R.md, border:"none", background:b.color, color:C.w, fontSize:15.3, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:actionLoading?0.6:1 }}>
                        {b.icon} {actionLoading?"...":b.label}
                      </button>
                    ))}
                    {!a.plate && (a.tripStatus === "pending" || a.tripStatus === "accepted") && (perms.canApprove || (user.userType === "producer" && freight.useOwnFleet)) && !(user.userType === "plant" && a.transportCompanyId && a.transportCompanyId !== freight.originCompanyId) && onEditTrip && (
                      <button onClick={()=>onEditTrip(freight.id, a)} style={{ flex:"1 1 auto", padding:"10px 12px", minWidth:80, minHeight:40, borderRadius: R.md, border:`1px solid ${C.acc}`, background:`${C.acc}0D`, color:C.acc, fontSize:15.3, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        {Ic.plus(C.acc,14)} Asignar
                      </button>
                    )}
                    {user.userType === "plant" && (a.tripStatus === "pending" || a.tripStatus === "accepted") && a.transportCompanyId && a.transportCompanyId !== freight.originCompanyId && a.plate && onCancelAssignment && (
                      <button disabled={actionLoading} onClick={()=>{if(confirm("¿Desasignar este camión?")) onCancelAssignment(freight.id, a.id, "Desasignado por planta").then(r=>{if(r?.ok) onRefresh && onRefresh(freight.id);});}} style={{ flex:"1 1 auto", padding:"10px 12px", minWidth:80, minHeight:40, borderRadius: R.md, border:`1px solid ${C.err}`, background:`${C.err}08`, color:C.err, fontSize:15.3, fontWeight:700, cursor:actionLoading?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:actionLoading?0.6:1 }}>
                        {Ic.ban(C.err,14)} Desasignar
                      </button>
                    )}
                  </div>
                )}
              </div>;
            })}
            {Array.from({ length: Math.max(0, truckCount - assignedCount) }, (_, i) => (
              <div key={`empty-${i}`} style={{ border:`1px dashed ${C.b1}`, borderLeft:`3px solid ${C.b1}`, borderRadius: R.md, marginBottom:10, padding:"12px 14px", display:"flex", alignItems:"center", gap:8 }}>
                {isMultiTruck && <span style={{ fontSize:16.1, fontWeight:800, color:C.t3 }}>#{assignedCount + i + 1}</span>}
                <span style={{ fontSize:16.0, fontWeight:500, color:C.t3, fontStyle:"italic" }}>Pendiente de asignar</span>
              </div>
            ))}
          </div>
        </div>;
      })()}

      {/* Step detail modal — triggered by clicking a progress step */}
      {stepModal && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const stepAuditActions = {
          pending_assignment:["created"],
          assigned:["assigned","assigned_multi","assignment_updated","assignment_canceled"],
          accepted:["accepted","authorized","trip_accepted","trip_rejected"],
          in_progress:["started","trip_started","auto_started"],
          loaded:["confirm_loaded","trip_confirm_loaded","auto_loaded"],
          finished:["confirm_finished","finished","trip_confirm_finished","trip_finished","canceled","auto_transporter_confirmed"],
        };
        const actionLabels = { created:"Solicitado", assigned:"Asignado", assigned_multi:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Iniciado", confirm_loaded:"Carga OK", confirm_finished:"Entrega OK", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado", trip_accepted:"Aceptado", trip_rejected:"Rechazado", trip_started:"Iniciado", trip_confirm_loaded:"Carga OK", trip_confirm_finished:"Entrega OK", trip_finished:"Finalizado", assignment_canceled:"Cancelado", assignment_updated:"Editado", assignment_truck_assigned:"Camión asignado", auto_started:"Inicio auto", auto_loaded:"Carga auto", auto_transporter_confirmed:"Entrega auto" };
        const actionColors = { created:C.pri, assigned:C.sec, assigned_multi:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2, trip_accepted:C.info, trip_rejected:C.err, trip_started:C.acc, trip_confirm_loaded:C.acc, trip_confirm_finished:C.pri, trip_finished:C.ok, assignment_canceled:C.err, assignment_updated:C.t2, assignment_truck_assigned:C.info, auto_started:C.acc, auto_loaded:C.acc, auto_transporter_confirmed:C.pri };
        const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch{ return ""; } };
        const logs = auditLog ? stepModal.backendSteps.flatMap(s => (auditLog||[]).filter(l=>(stepAuditActions[s]||[]).includes(l.action))) : [];
        const stepToTrip = { assigned:["pending","accepted"], accepted:["accepted"], in_progress:["in_progress"], loaded:["loaded"], finished:["finished"] };
        const stepAssigns = isMultiTruck ? stepModal.backendSteps.flatMap(s => { const tsList=stepToTrip[s]; if(!tsList) return []; return (freight.activeAssignments||[]).filter(a=>tsList.includes(a.tripStatus)); }) : [];
        return <div onClick={()=>setStepModal(null)} style={{ position:"absolute", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius: R.lg, padding:20, maxWidth:400, width:"100%", maxHeight:"80%", overflow:"auto", boxShadow:C.shLg }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:18.6, fontWeight:800, color:stepModal.color }}>{stepModal.label}</span>
              <button onClick={()=>setStepModal(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,18)}</button>
            </div>
            {logs.length === 0 && stepAssigns.length === 0 && <div style={{ fontSize:16.0, color:C.t3, textAlign:"center", padding:"20px 0" }}>Sin actividad registrada en esta etapa</div>}
            {logs.map(entry => {
              const acCol = actionColors[entry.action] || C.t2;
              const tn = entry.metadata?.tripNumber ? `Viaje #${entry.metadata.tripNumber}` : null;
              return <div key={entry.id} style={{ display:"flex", gap:8, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ width:8, height:8, borderRadius: R.xs, background:acCol, flexShrink:0, marginTop:5 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:16.0, fontWeight:700, color:acCol, lineHeight:1.3 }}>{actionLabels[entry.action]||entry.action}{tn ? ` · ${tn}` : ""}</div>
                  <div style={{ fontSize:14.6, color:C.t2, marginTop:2, lineHeight:1.3, wordBreak:"break-word" }}>{entry.user?.name||"Sistema"}</div>
                  {entry.user?.company?.name && <div style={{ fontSize:14.0, color:C.t3, lineHeight:1.2 }}>{entry.user.company.name}</div>}
                  {(entry.reason || entry.metadata?.reason) && <div style={{ fontSize:14.0, color:C.t3, fontStyle:"italic", marginTop:2 }}>"{entry.reason||entry.metadata.reason}"</div>}
                  {entry.metadata?.confirmedBy && <div style={{ fontSize:14.0, color:C.t3, marginTop:2 }}>por {entry.metadata.confirmedBy==="transporter"?"transportista":entry.metadata.confirmedBy==="producer"?"productor":entry.metadata.confirmedBy==="plant"?"planta":entry.metadata.confirmedBy}</div>}
                  <div style={{ fontSize:14.0, color:C.t3, marginTop:2 }}>{fmtD(entry.createdAt)}</div>
                </div>
              </div>;
            })}
            {stepAssigns.length > 0 && logs.length === 0 && stepAssigns.map(a => (
              <div key={a.id} style={{ display:"flex", gap:8, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ width:8, height:8, borderRadius: R.xs, background:stepModal.color, flexShrink:0, marginTop:5 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14.6, fontWeight:700, color:C.t1 }}>Viaje #{a.tripNumber}</div>
                  {a.plate && <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:1 }}><LicensePlate plate={a.plate} size="md" />{a.truckModel?<span style={{ fontSize:14.6, color:C.t2 }}> · {a.truckModel}</span>:""}</div>}
                  {a.transporterName && <div style={{ fontSize:14.0, color:C.t3 }}>{a.transporterName}</div>}
                  {a.driverName && <div style={{ fontSize:14.0, color:C.t3 }}>{a.driverName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>;
      })()}
    </div>
  );
}
