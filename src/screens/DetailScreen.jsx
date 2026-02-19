import { useState, useRef, useEffect } from "react";
import { C, Ic, FONT, MONO, track } from "../theme";
import { stCfg, getActions, POLL_INTERVALS } from "../constants";
import { Bd, Btn, Loader, Sec, FileViewer } from "../components";
import { FreightMap, SafeZone } from "../maps";
import { DocsGallery, FreightFileUpload } from "../uploads";
import { apiGetAuditLog } from "../api";
import { useIsDesktop } from "../hooks";
// PDF report loaded lazily to avoid bundle bloat
const loadPdfReport = () => import("../utils/pdf-report");

export default function DetailScreen({ user, freight, perms, onBack, onAction, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap }) {
  if(!freight) return null;
  const [auditLog, setAuditLog] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [viewFile, setViewFile] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const auditRef = useRef(null);

  // Pre-load PDF module so download works synchronously on click
  useEffect(() => { loadPdfReport(); }, []);

  // Auto-refresh freight detail every 10s
  useEffect(() => {
    if (!freight?.id || !onRefresh) return;
    const iv = setInterval(() => { if (!document.hidden) onRefresh(freight.id); }, POLL_INTERVALS.DETAIL_REFRESH);
    return () => clearInterval(iv);
  }, [freight?.id, onRefresh]);

  const loadAudit = async () => {
    if (auditLog) { setShowAudit(!showAudit); return; }
    try {
      const logs = await apiGetAuditLog(freight.id);
      setAuditLog(logs);
      setShowAudit(true);
    } catch(e) { console.error("Audit load failed:", e); }
  };

  // Close audit on outside click
  useEffect(() => {
    if (!showAudit) return;
    const handler = (e) => { if (auditRef.current && !auditRef.current.contains(e.target)) setShowAudit(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [showAudit]);

  const _isDesktop = useIsDesktop(768);
  const st = stCfg(freight.status);
  const actions = getActions(freight.status, user.userType, user.role, freight.isOwnFleet);

  // Filter actions based on confirmation state
  const filteredActions = actions.filter(a=>{
    if(a==="confirm_loaded" && user.userType==="transporter" && freight.transporterLoadedConfirmedAt) return false;
    if(a==="confirm_loaded" && user.userType==="producer" && freight.producerLoadedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="transporter" && freight.transporterFinishedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="plant" && freight.plantFinishedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="producer" && freight.isOwnFleet && freight.transporterFinishedConfirmedAt) return false;
    return true;
  });

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
            <div style={{ fontSize:22, fontWeight:800, marginTop:2, letterSpacing:-0.3 }}>{freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · {freight.tons} {freight.unit||"tn"}</div>
          </div>
          <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
        </div>
      </div>

      <div style={{ padding:"0 18px 18px" }}>

      {/* Actions */}
      {filteredActions.length > 0 && <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {filteredActions.includes("authorize") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"authorize")}>{actionLoading?"Procesando...":"Autorizar viaje"}</Btn>}
        {filteredActions.includes("assign") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"assign")}>Asignar transportista</Btn>}
        {filteredActions.includes("accept") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"accept")}>Aceptar flete</Btn>}
        {filteredActions.includes("start") && <Btn full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"start")}>{actionLoading?"Procesando...":"Iniciar viaje"}</Btn>}
        {filteredActions.includes("confirm_loaded") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_loaded")}>{actionLoading?"Procesando...":"Confirmar carga"}</Btn>}
        {filteredActions.includes("confirm_finished") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_finished")}>{actionLoading?"Procesando...":"Confirmar entrega"}</Btn>}
      </div>}

      {/* Progress — click to see audit history */}
      {freight.status !== "canceled" && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const curIdx = steps.indexOf(freight.status);
        return <div ref={auditRef} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh, position:"relative" }}>
          <div onClick={loadAudit} style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            Progreso <span style={{ fontSize:9, fontWeight:500, color:C.t3, textTransform:"none", letterSpacing:0 }}>{showAudit?"\u25B2 ocultar historial":"\u25BC ver historial"}</span>
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
          {/* Audit popover */}
          {showAudit && auditLog && (
            <div style={{ marginTop:14, borderTop:`1px solid ${C.b1}`, paddingTop:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Historial de cambios</div>
              <div style={{ position:"relative", paddingLeft:18 }}>
                <div style={{ position:"absolute", left:5, top:4, bottom:4, width:2, background:C.b1, borderRadius:1 }} />
                {auditLog.map((log, i) => {
                  const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; } };
                  const actionLabels = { created:"Solicitado", assigned:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Viaje iniciado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado" };
                  const label = actionLabels[log.action] || log.action;
                  const actionColors = { created:C.pri, assigned:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2 };
                  const col = actionColors[log.action] || C.t2;
                  return (
                    <div key={log.id} style={{ position:"relative", paddingBottom:i<auditLog.length-1?14:0 }}>
                      <div style={{ position:"absolute", left:-16, top:2, width:10, height:10, borderRadius:5, background:col, zIndex:2 }} />
                      <div style={{ fontSize:12, fontWeight:700, color:col }}>{label}</div>
                      <div style={{ fontSize:10.5, color:C.t2, marginTop:1 }}>{log.user?.name || "Sistema"} {log.user?.company?.name ? `\u00b7 ${log.user.company.name}` : ""}</div>
                      {log.reason && <div style={{ fontSize:10, color:C.t3, fontStyle:"italic", marginTop:2 }}>"{log.reason}"</div>}
                      <div style={{ fontSize:9.5, color:C.t3, marginTop:2 }}>{fmtD(log.createdAt)}</div>
                    </div>
                  );
                })}
                {auditLog.length === 0 && <div style={{ fontSize:11, color:C.t3 }}>Sin registros</div>}
              </div>
            </div>
          )}
        </div>;
      })()}

      {/* Cross-confirmations panel */}
      {(freight.status==="loaded" || freight.status==="in_progress") && (
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
            [Ic.pin(C.ok,15),"Campo",<>{[freight.fieldName,freight.originName].filter(Boolean).join(" / ")||"\u2014"}{freight.originLat&&freight.originLng&&<span onClick={()=>goToMap(freight.originLat,freight.originLng,[freight.fieldName,freight.originName].filter(Boolean).join(" / "))} style={{cursor:"pointer",opacity:0.7,marginLeft:4,fontSize:11}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</>],
            [Ic.plant(C.t2,15),"Destino",<>{freight.destName}{freight.destLat&&freight.destLng&&<span onClick={()=>goToMap(freight.destLat,freight.destLng,freight.destName)} style={{cursor:"pointer",opacity:0.7,marginLeft:4,fontSize:11}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</>],
            [Ic.cal(C.t2,15),"Fecha carga",freight.loadDate],
            [Ic.clk(C.t2,15),"Hora carga",freight.loadTime],
            [Ic.user(C.t2,15),"Solicitado por",freight.requestedByName],
            [Ic.grain(C.t2,15),"Producto",`${freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} \u00b7 ${freight.tons} ${freight.unit||"tn"}`],
            freight.amount>0&&[Ic.grain(C.t2,15),"Importe",`$${Number(freight.amount).toLocaleString()}`],
            freight.transporterName&&[Ic.truck(C.t2,15),"Transportista",freight.transporterName],
            freight.truckPlate&&[Ic.truck(C.acc,15),"Cami\u00f3n",`${freight.truckPlate}${freight.truckModel?` \u00b7 ${freight.truckModel}`:""}`],
            freight.driverName&&[Ic.user(C.pri,15),"Chofer",freight.driverName],
            freight.driverPhone&&[Ic.msg(C.info,15),"Tel\u00e9fono",freight.driverPhone],
          ].filter(Boolean).map(([ic,label,val],i,arr)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.b2}`:"none" }}>
              <span style={{display:"flex",flexShrink:0}}>{ic}</span>
              <span style={{ fontSize:11.5, color:C.t2, minWidth:85 }}>{label}</span>
              {label==="Tel\u00e9fono"?<a href={`tel:${val}`} style={{ fontSize:12, fontWeight:600, color:C.info, marginLeft:"auto", textDecoration:"none" }}>{val}</a>:
              <span style={{ fontSize:12, fontWeight:600, color:C.t1, marginLeft:"auto", textAlign:"right" }}>{val}</span>}
            </div>
          ))}
        </div>
        <div style={{ flex:1 }}>
          <FreightMap freightId={freight.id} originLat={freight.originLat} originLng={freight.originLng} destLat={freight.destLat} destLng={freight.destLng} originName={[freight.originCompanyName, [freight.fieldName,freight.originName].filter(Boolean).join("/")].filter(Boolean).join(" \u2014 ")} destName={freight.destName} status={freight.status} isDriver={user.userType==="transporter"||(user.userType==="producer"&&freight.isOwnFleet)}/>
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

      {/* Own fleet banners */}
      {freight.isOwnFleet && (()=>{
        const banners = {
          assigned: { icon:Ic.truck(C.acc,20), bg:C.accPale, border:C.acc, title:"Flota propia \u2014 esperando autorizaci\u00f3n", desc: user.userType==="plant" ? "El productor asign\u00f3 su propio cami\u00f3n. Autoriz\u00e1 el viaje para continuar." : "Tu cami\u00f3n fue asignado. La planta debe autorizar el viaje." },
          accepted: { icon:Ic.chk(C.ok,20), bg:C.okPale, border:C.ok, title:"Viaje autorizado por la planta", desc: user.userType==="producer" ? "Ya pod\u00e9s iniciar el viaje con tu cami\u00f3n." : "El productor puede iniciar el viaje con su flota propia." },
          in_progress: { icon:Ic.truck(C.pri,20), bg:C.priPale, border:C.pri, title:"En viaje \u2014 flota propia", desc:"El productor viaja con su propio cami\u00f3n." },
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
          <div style={{ display: _isDesktop && canUpload && hasDocs ? "flex" : "block", gap: 12, marginBottom: 0 }}>
            {hasDocs && <div style={{ flex: 1, minWidth: 0 }}><DocsGallery documents={freight.documents} onViewFile={setViewFile} freightId={freight.id} canDelete={canUpload} onDeleted={()=>{ if(onRefresh) onRefresh(freight.id); }}/></div>}
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
        } catch(e) { console.error('PDF error', e); }
        finally { setPdfLoading(false); }
      }} style={{ width:"100%", background:C.w, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.b1}`, cursor:"pointer", fontFamily:"inherit", marginBottom:12, opacity:pdfLoading?0.6:1 }}>
        {Ic.doc(C.t2,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:12, fontWeight:700, color:C.t1 }}>{pdfLoading?'Generando...':'Descargar informe PDF'}</div><div style={{ fontSize:10, color:C.t3 }}>Información, recorrido, historial y documentos</div></div>
      </button>

      {/* Edit + Cancel — bottom actions */}
      {freight.status==="pending_assignment" && perms.canRequest && <div style={{ marginBottom:8 }}><Btn full sm v="sec" icon={Ic.doc(C.pri,14)} onClick={()=>onEdit(freight)}>Editar</Btn></div>}
      {filteredActions.includes("cancel") && <div style={{ marginBottom:8 }}><Btn full v="err" icon={Ic.cross(C.err,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"cancel")}>Cancelar flete</Btn></div>}
      {filteredActions.includes("reject") && <div style={{ marginBottom:8 }}><Btn full v="err" icon={Ic.ban(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"reject")}>Rechazar asignación</Btn></div>}
      </div>
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)}/>
    </div>
  );
}
