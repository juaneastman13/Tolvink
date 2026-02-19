import { useState, useMemo, useRef, useEffect } from "react";
import { C, Ic, FONT, MONO } from "../theme";
import { stCfg } from "../constants";
import { Bd, Btn, Field, Select, exportExcel, exportPDF, FileViewer } from "../components";
import { DocsGallery } from "../uploads";
import { apiGetAuditLog } from "../api";
const loadPdfReport = () => import("../utils/pdf-report");

export default function ReportsScreen({ onBack, freights, isDesktop, embedded }) {
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewFile, setViewFile] = useState(null);
  const [pdfLoadingId, setPdfLoadingId] = useState(null);
  const toggle = (k) => setExpanded(p=>({...p,[k]:!p[k]}));

  // Pre-load PDF module
  useEffect(() => { loadPdfReport(); }, []);
  const toggleSel = (id, e) => { e.stopPropagation(); setSelected(p => { const n = new Set(p); if(n.has(id)) n.delete(id); else n.add(id); return n; }); };

  const allFreights = (freights||[]).filter(f=>{
    if(dateFrom && f.loadDate < dateFrom) return false;
    if(dateTo && f.loadDate > dateTo) return false;
    if(!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (f.code||"").toLowerCase().includes(q) || (f.originName||"").toLowerCase().includes(q) || (f.destName||"").toLowerCase().includes(q) || (f.grain||"").toLowerCase().includes(q) || (f.transporterName||"").toLowerCase().includes(q) || (f.requestedByName||"").toLowerCase().includes(q);
  });

  const STATUS_GROUPS_RPT = { solicitado:["pending_assignment"], en_curso:["assigned","accepted","in_progress","loaded"], finalizados:["finished"], cancelados:["canceled"] };
  const filtered = filterStatus==="all" ? allFreights : allFreights.filter(f=>(STATUS_GROUPS_RPT[filterStatus]||[]).includes(f.status));

  const groups = useMemo(()=>{
    const solicitado = filtered.filter(f=>f.status==="pending_assignment");
    const enCurso = filtered.filter(f=>["assigned","accepted","in_progress","loaded"].includes(f.status));
    const finished = filtered.filter(f=>f.status==="finished");
    const canceled = filtered.filter(f=>f.status==="canceled");
    return [
      {key:"solicitado", label:"Solicitado", items:solicitado, color:"#FF6A00"},
      {key:"en_curso", label:"En curso", items:enCurso, color:"#2563EB"},
      {key:"finished", label:"Finalizados", items:finished, color:"#1A6B37"},
      {key:"canceled", label:"Cancelados", items:canceled, color:"#DC2626"},
    ].filter(g=>g.items.length>0);
  },[filtered]);

  const totalDocs = allFreights.reduce((sum,f)=>sum+(f.documents?.length||0),0);
  const exportData = selected.size > 0 ? filtered.filter(f=>selected.has(f.id)) : filtered;

  return (
    <div style={{ flex:embedded?undefined:1, overflow:embedded?"visible":"auto", padding:embedded?0:undefined }}>
      {!isDesktop && !embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Mi Perfil</button></div>}
      <div style={{ padding:embedded?0:isDesktop?"18px 18px 18px":"0 18px 18px" }}>

      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:12 }}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,16)}</div>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar por código, origen, destino, producto..."
          style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,16)}</button>}
      </div>

      {/* Status filter + export buttons — desktop: pills inline with dates, mobile: select + separate dates line */}
      {isDesktop ? (
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {[{k:"all",l:"Todos"},{k:"solicitado",l:"Solicitado"},{k:"en_curso",l:"En curso"},{k:"finalizados",l:"Finalizados"},{k:"cancelados",l:"Cancelados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFilterStatus(opt.k)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${filterStatus===opt.k?C.pri:C.b1}`, background:filterStatus===opt.k?C.priPale:C.w, color:filterStatus===opt.k?C.pri:C.t2, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{opt.l}</button>
        ))}
        <span style={{fontSize:10,color:C.t2,fontWeight:600,marginLeft:4}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2}}>{Ic.cross(C.t3,14)}</button>}
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {selected.size>0 && <button onClick={()=>setSelected(new Set())} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {selected.size} seleccionado{selected.size!==1?"s":""} {Ic.cross(C.pri,10)}
          </button>}
          <button onClick={()=>exportExcel(exportData,"tolvink-fletes.xls")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid #1A6B37`,background:"#E6F4EA",color:"#1A6B37",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc("#1A6B37",12)} Excel
          </button>
          <button onClick={()=>exportPDF(exportData,"Informe de Fletes")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid #DC2626`,background:"#FEE2E2",color:"#DC2626",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc("#DC2626",12)} PDF
          </button>
        </div>
      </div>
      ) : (<>
      <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${filterStatus!=="all"?C.pri:C.b1}`,background:filterStatus!=="all"?C.priPale:C.w,color:filterStatus!=="all"?C.pri:C.t2,fontSize:11,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
          <option value="all">Todos los estados</option>
          <option value="solicitado">Solicitado</option>
          <option value="en_curso">En curso</option>
          <option value="finalizados">Finalizados</option>
          <option value="cancelados">Cancelados</option>
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {selected.size>0 && <button onClick={()=>setSelected(new Set())} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {selected.size} seleccionado{selected.size!==1?"s":""} {Ic.cross(C.pri,10)}
          </button>}
          <button onClick={()=>exportExcel(exportData,"tolvink-fletes.xls")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid #1A6B37`,background:"#E6F4EA",color:"#1A6B37",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc("#1A6B37",12)} Excel
          </button>
          <button onClick={()=>exportPDF(exportData,"Informe de Fletes")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid #DC2626`,background:"#FEE2E2",color:"#DC2626",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc("#DC2626",12)} PDF
          </button>
        </div>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12, alignItems:"center" }}>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer",flex:1,minWidth:0}}/>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer",flex:1,minWidth:0}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2,flexShrink:0}}>{Ic.cross(C.t3,14)}</button>}
      </div>
      </>)}

      {allFreights.length===0 && <div style={{ textAlign:"center", padding:32, color:C.t3, fontSize:13 }}>No hay fletes registrados.</div>}

      {groups.map(group=>(
        <div key={group.key} style={{ marginBottom:16 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{width:8,height:8,borderRadius:4,background:group.color}}/>
            {group.label} ({group.items.length})
          </div>

          {group.items.map(f=>{
            const isOpen = expanded[f.id];
            const isSel = selected.has(f.id);
            const docs = f.documents||[];
            return (
              <div key={f.id} style={{ background:isSel?C.priPale:C.w, border:`1px solid ${isSel?C.pri:C.b1}`, borderRadius:12, overflow:"hidden", marginBottom:8, boxShadow:C.sh, transition:"all 0.15s" }}>
                <button onClick={()=>toggle(f.id)} style={{ width:"100%", padding:"12px 14px", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
                  <span onClick={(e)=>toggleSel(f.id,e)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${isSel?C.pri:C.b1}`,background:isSel?C.pri:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                    {isSel && Ic.chk("#fff",12)}
                  </span>
                  {Ic.doc(group.color,18)}
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, fontFamily:MONO }}>{f.code}</span>
                      <span style={{ fontSize:10, color:C.t3 }}>{f.grain} · {f.tons} {f.unit||"tn"}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:2,fontSize:11,color:C.t2,marginTop:2}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.user(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.originCompanyName||(f.originName||"").split("—")[0].trim()}</span></div>
                      {f.transporterName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.truck(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.transporterName}{f.truckPlate?` (${f.truckPlate})`:""}</span></div>}
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.plant(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.destName}</span> <span style={{color:C.t3,marginLeft:4,fontSize:10}}>{docs.length} doc{docs.length!==1?"s":""}</span></div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" style={{transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {isOpen && (
                  <div style={{ borderTop:`1px solid ${C.b2}`, padding:"8px 14px" }}>
                    {/* Individual PDF report download */}
                    <button disabled={pdfLoadingId===f.id} onClick={async(e)=>{
                      e.stopPropagation();
                      if(pdfLoadingId) return;
                      setPdfLoadingId(f.id);
                      try {
                        let logs = [];
                        try { logs = await apiGetAuditLog(f.id); } catch {}
                        const { generateFreightPDF } = await loadPdfReport();
                        generateFreightPDF(f, logs);
                      } catch(err) { console.error('PDF error', err); }
                      finally { setPdfLoadingId(null); }
                    }} style={{ width:"100%", padding:"8px 10px", marginBottom:8, borderRadius:8, border:`1.5px solid ${C.b1}`, background:C.w, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8, opacity:pdfLoadingId===f.id?0.6:1 }}>
                      {Ic.doc(C.pri,16)}<span style={{fontSize:11,fontWeight:600,color:C.pri}}>{pdfLoadingId===f.id?'Generando...':'Descargar informe PDF'}</span>
                    </button>
                    {docs.length>0 ? docs.map((d,i)=>(
                      <div key={d.id||i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<docs.length-1?`1px solid ${C.b2}`:"none" }}>
                        {d.type==="photo" ? (
                          <button onClick={()=>setViewFile({url:d.url,name:d.name||"Foto",type:"photo"})} style={{ width:48, height:48, borderRadius:8, overflow:"hidden", flexShrink:0, border:`1px solid ${C.b1}`, padding:0, background:"none", cursor:"pointer" }}>
                            <img src={d.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          </button>
                        ) : (
                          <div style={{ width:48, height:48, borderRadius:8, background:C.secPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {Ic.doc(C.sec,20)}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.name||"Documento"}</div>
                          <div style={{ fontSize:10, color:C.t3 }}>{d.step==="request"?"Solicitud":d.step==="load_confirmation"?"Carga":d.step==="assignment"?"Asignación":"Otro"} · {d.createdAt?new Date(d.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short"}):""}</div>
                        </div>
                        <button onClick={()=>setViewFile({url:d.url,name:d.name||"Documento",type:d.type})} style={{ display:"flex", padding:6, borderRadius:8, background:C.secPale, border:"none", cursor:"pointer" }}>
                          {Ic.eye(C.sec,16)}
                        </button>
                      </div>
                    )) : <div style={{ fontSize:11, color:C.t3, padding:"8px 0" }}>Sin documentos adjuntos</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)}/>
      </div>
    </div>
  );
}
