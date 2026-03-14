import { useState, useMemo, useRef, useEffect } from "react";
import { C, Ic, FONT, MONO } from "../theme";
import { stCfg } from "../constants";
import { originDisplay, destDisplay } from "../hooks";
import { Bd, Btn, Field, Select, exportExcel, exportPDF, FileViewer } from "../components";
import { OcrResultModal, UploadOverlay } from "../uploads";
import log from "../logger";
import { useUIStore, useFreightDetailStore } from "../store";
import { apiGetAuditLog, apiGetFreight, apiGetFreightStats, apiOcrAnalyze, apiSaveOcrData, thumb } from "../api";
import { mapFreight } from "../hooks";
const loadPdfReport = () => import("../utils/pdf-report");

export default function ReportsScreen({ onBack, freights, isDesktop, embedded, onRefresh }) {
  const show = useUIStore(s => s.show);
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fPlant, setFPlant] = useState("");
  const [fField, setFField] = useState("");
  const [fTransporter, setFTransporter] = useState("");
  const [viewFile, setViewFile] = useState(null);
  const [pdfLoadingId, setPdfLoadingId] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState("month"); // "week" | "month" | "lastMonth" | "custom"

  // Load stats when period or date filters change
  useEffect(() => {
    let from, to;
    const now = new Date();
    if (statsPeriod === "week") {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      from = d.toISOString().split("T")[0]; to = now.toISOString().split("T")[0];
    } else if (statsPeriod === "month") {
      from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
      to = now.toISOString().split("T")[0];
    } else if (statsPeriod === "lastMonth") {
      const pm = new Date(now.getFullYear(), now.getMonth()-1, 1);
      from = pm.toISOString().split("T")[0];
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    } else if (dateFrom || dateTo) {
      from = dateFrom || undefined; to = dateTo || undefined;
    } else { return; }
    setStatsLoading(true);
    apiGetFreightStats(from, to).then(setStats).catch(() => setStats(null)).finally(() => setStatsLoading(false));
  }, [statsPeriod, dateFrom, dateTo]);

  const toggle = (k) => {
    setExpanded(p => {
      const opening = !p[k];
      if (opening) {
        // Load full detail on expand if not cached
        const cached = useFreightDetailStore.getState().getDetail(k);
        if (!cached) {
          apiGetFreight(k).then(raw => {
            useFreightDetailStore.getState().setDetail(k, mapFreight(raw));
          }).catch(() => {});
        }
      }
      return { ...p, [k]: opening };
    });
  };

  // Pre-load PDF module
  useEffect(() => { loadPdfReport(); }, []);
  const toggleSel = (id, e) => { e.stopPropagation(); setSelected(p => { const n = new Set(p); if(n.has(id)) n.delete(id); else n.add(id); return n; }); };

  const handleOcr = async (file, freightId) => {
    setOcrLoading(true);
    try {
      const res = await apiOcrAnalyze(file.url);
      if (res.error) { log.error("OCR", res.error); show("Error en OCR", "err"); return; }
      setOcrResult(res);
      if (file.id && freightId) {
        apiSaveOcrData(freightId, file.id, res).then(() => { if (onRefresh) onRefresh(); }).catch(e => { log.error("OCR", "save failed:", e); show("No se pudieron guardar los datos OCR", "err"); });
      }
    } catch (e) {
      log.error("OCR", "failed:", e);
      show("Error al extraer datos del documento", "err");
    } finally {
      setOcrLoading(false);
    }
  };

  const plantOptions = useMemo(()=>[...new Set((freights||[]).map(f=>destDisplay(f)).filter(Boolean))].sort(),[freights]);
  const fieldOptions = useMemo(()=>[...new Set((freights||[]).map(f=>originDisplay(f)).filter(Boolean))].sort(),[freights]);
  const transporterOptions = useMemo(()=>[...new Set((freights||[]).map(f=>f.transporterName).filter(Boolean))].sort(),[freights]);
  const hasEntityFilters = fPlant || fField || fTransporter;

  const allFreights = useMemo(() => (freights||[]).filter(f=>{
    if(dateFrom && f.loadDate < dateFrom) return false;
    if(dateTo && f.loadDate > dateTo) return false;
    if(fPlant && destDisplay(f) !== fPlant) return false;
    if(fField && originDisplay(f) !== fField) return false;
    if(fTransporter && f.transporterName !== fTransporter) return false;
    if(!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (f.code||"").toLowerCase().includes(q) || (f.originName||"").toLowerCase().includes(q) || (f.destName||"").toLowerCase().includes(q) || (f.grain||"").toLowerCase().includes(q) || (f.transporterName||"").toLowerCase().includes(q) || (f.requestedByName||"").toLowerCase().includes(q);
  }), [freights, dateFrom, dateTo, searchQ, fPlant, fField, fTransporter]);

  const STATUS_GROUPS_RPT = { solicitado:["pending_assignment"], en_curso:["assigned","accepted","in_progress","loaded"], finalizados:["finished"], cancelados:["canceled"] };
  const filtered = useMemo(() => filterStatus==="all" ? allFreights : allFreights.filter(f=>(STATUS_GROUPS_RPT[filterStatus]||[]).includes(f.status)), [allFreights, filterStatus]);

  const groups = useMemo(()=>{
    const solicitado = filtered.filter(f=>f.status==="pending_assignment");
    const enCurso = filtered.filter(f=>["assigned","accepted","in_progress","loaded"].includes(f.status));
    const finished = filtered.filter(f=>f.status==="finished");
    const canceled = filtered.filter(f=>f.status==="canceled");
    return [
      {key:"solicitado", label:"Solicitado", items:solicitado, color:C.acc},
      {key:"en_curso", label:"En curso", items:enCurso, color:C.info},
      {key:"finished", label:"Finalizados", items:finished, color:C.ok},
      {key:"canceled", label:"Cancelados", items:canceled, color:C.err},
    ].filter(g=>g.items.length>0);
  },[filtered]);

  const exportData = selected.size > 0 ? filtered.filter(f=>selected.has(f.id)) : filtered;

  return (
    <div style={{ flex:embedded?undefined:1, overflow:embedded?"visible":"auto", padding:embedded?0:undefined }}>
      {!isDesktop && !embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14.3, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Mi Perfil</button></div>}
      <div style={{ padding:embedded?0:isDesktop?"18px 18px 18px":"0 18px 18px" }}>

      {/* ── Stats Summary ── */}
      {!embedded && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:15, fontWeight:700, color:C.t1 }}>Resumen del per\u00edodo</span>
            {["week","month","lastMonth","custom"].map(p=>(
              <button key={p} onClick={()=>setStatsPeriod(p)} style={{ padding:"5px 12px", borderRadius:16, border:`1.5px solid ${statsPeriod===p?C.pri:C.b1}`, background:statsPeriod===p?C.priPale:C.w, color:statsPeriod===p?C.pri:C.t2, fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>
                {p==="week"?"Esta semana":p==="month"?"Este mes":p==="lastMonth"?"Mes anterior":"Personalizado"}
              </button>
            ))}
          </div>
          {statsLoading && <div style={{ padding:12, color:C.t3, fontSize:13 }}>Cargando estad\u00edsticas...</div>}
          {stats && !statsLoading && (
            <>
              {/* Metric cards */}
              <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(4,1fr)":"repeat(2,1fr)", gap:10, marginBottom:12 }}>
                {[
                  { label:"Total fletes", value:stats.totalFreights, color:C.pri },
                  { label:"Toneladas", value:`${stats.totalTons}t`, color:C.acc },
                  { label:"Completados", value:`${Math.round(stats.completionRate*100)}%`, color:C.ok },
                  { label:"Prom. tons/flete", value:stats.avgTonsPerFreight, color:C.sec },
                ].map((m,i)=>(
                  <div key={i} style={{ background:C.bgCard, borderRadius:12, padding:"14px 16px", boxShadow:C.sh }}>
                    <div style={{ fontSize:11, fontWeight:600, color:C.t3, textTransform:"uppercase", letterSpacing:0.4 }}>{m.label}</div>
                    <div style={{ fontSize:26, fontWeight:800, color:m.color, marginTop:2 }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {/* Mini tables */}
              <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr", gap:10, marginBottom:12 }}>
                {[
                  { title:"Por grano", items:stats.byGrain, nameKey:"grain" },
                  { title:"Top transportistas", items:stats.topTransporters, nameKey:"name" },
                  { title:"Top destinos", items:stats.topDestinations, nameKey:"name" },
                ].map((tbl,ti)=>(
                  <div key={ti} style={{ background:C.bgCard, borderRadius:12, padding:"12px 14px", boxShadow:C.sh }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.t2, marginBottom:8, textTransform:"uppercase", letterSpacing:0.3 }}>{tbl.title}</div>
                    {(tbl.items||[]).slice(0,5).map((row,ri)=>(
                      <div key={ri} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:ri<Math.min(tbl.items.length,5)-1?`1px solid ${C.b2}`:"none" }}>
                        <span style={{ fontSize:12.5, color:C.t1, fontWeight:500 }}>{row[tbl.nameKey]}</span>
                        <span style={{ fontSize:12, color:C.t3, fontFamily:MONO }}>{row.count} · {row.tons}t</span>
                      </div>
                    ))}
                    {(!tbl.items||tbl.items.length===0) && <div style={{ fontSize:12, color:C.t3 }}>Sin datos</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Search bar */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <div style={{ position:"relative", flex:1, minWidth:0 }}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar flete..."
            style={{width:"100%",padding:"8px 12px 8px 32px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13.2,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          {searchQ && <button aria-label="Limpiar búsqueda" onClick={()=>setSearchQ("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,14)}</button>}
        </div>
        {(searchQ||hasEntityFilters||dateFrom||dateTo) && <button onClick={()=>{setSearchQ("");setFPlant("");setFField("");setFTransporter("");setDateFrom("");setDateTo("");}} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>Limpiar</button>}
      </div>

      {/* Entity filters row — matching ListScreen style */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap" }}>
        <button onClick={()=>{const el=document.getElementById("rpt-date-row");if(el)el.style.display=el.style.display==="none"?"flex":"none";}} style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${(dateFrom||dateTo)?C.pri:C.b1}`,background:(dateFrom||dateTo)?C.priPale:C.w,color:(dateFrom||dateTo)?C.pri:C.t2,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
          {Ic.cal((dateFrom||dateTo)?C.pri:C.t3,13)} Filtrar por fecha{(dateFrom||dateTo)?" (activo)":""}
        </button>
        <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fPlant?C.pri:C.b1}`,background:fPlant?C.priPale:C.w,color:fPlant?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Planta</option>
          {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fField} onChange={e=>setFField(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fField?C.pri:C.b1}`,background:fField?C.priPale:C.w,color:fField?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Campo</option>
          {fieldOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fTransporter} onChange={e=>setFTransporter(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fTransporter?C.pri:C.b1}`,background:fTransporter?C.priPale:C.w,color:fTransporter?C.pri:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Transportista</option>
          {transporterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Collapsible date filters */}
      <div id="rpt-date-row" style={{ display:(dateFrom||dateTo)?"flex":"none", alignItems:"center", gap:6, marginBottom:6, padding:"8px 12px", background:C.bg, borderRadius:10, border:`1px solid ${C.b1}` }}>
        <span style={{fontSize:11,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        <span style={{fontSize:11,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:12.1,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        {(dateFrom||dateTo)&&<button aria-label="Limpiar filtro de fechas" onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2}}>{Ic.cross(C.t3,14)}</button>}
      </div>

      {/* Status filter + export buttons */}
      {isDesktop ? (
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {[{k:"all",l:"Todos"},{k:"solicitado",l:"Solicitado"},{k:"en_curso",l:"En curso"},{k:"finalizados",l:"Finalizados"},{k:"cancelados",l:"Cancelados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFilterStatus(opt.k)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${filterStatus===opt.k?C.pri:C.b1}`, background:filterStatus===opt.k?C.priPale:C.w, color:filterStatus===opt.k?C.pri:C.t2, fontSize:12.1, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{opt.l}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {selected.size>0 && <button onClick={()=>setSelected(new Set())} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {selected.size} seleccionado{selected.size!==1?"s":""} {Ic.cross(C.pri,10)}
          </button>}
          <button aria-label="Exportar a Excel" onClick={()=>exportExcel(exportData,"tolvink-fletes.xls")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.ok}`,background:C.okPale,color:C.ok,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc(C.ok,12)} Excel
          </button>
          <button aria-label="Exportar a PDF" onClick={()=>exportPDF(exportData,"Informe de Fletes")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.err}`,background:C.errPale,color:C.err,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc(C.err,12)} PDF
          </button>
        </div>
      </div>
      ) : (<>
      <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap", alignItems:"center" }}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${filterStatus!=="all"?C.pri:C.b1}`,background:filterStatus!=="all"?C.priPale:C.w,color:filterStatus!=="all"?C.pri:C.t2,fontSize:12.1,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
          <option value="all">Todos los estados</option>
          <option value="solicitado">Solicitado</option>
          <option value="en_curso">En curso</option>
          <option value="finalizados">Finalizados</option>
          <option value="cancelados">Cancelados</option>
        </select>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {selected.size>0 && <button onClick={()=>setSelected(new Set())} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {selected.size} seleccionado{selected.size!==1?"s":""} {Ic.cross(C.pri,10)}
          </button>}
          <button aria-label="Exportar a Excel" onClick={()=>exportExcel(exportData,"tolvink-fletes.xls")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.ok}`,background:C.okPale,color:C.ok,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc(C.ok,12)} Excel
          </button>
          <button aria-label="Exportar a PDF" onClick={()=>exportPDF(exportData,"Informe de Fletes")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.err}`,background:C.errPale,color:C.err,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc(C.err,12)} PDF
          </button>
        </div>
      </div>
      </>)}

      {/* Result count + select all */}
      {filtered.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:12.1, color:C.t3, fontWeight:500 }}>{filtered.length} flete{filtered.length!==1?"s":""}</span>
          <button onClick={()=>{ if(selected.size===filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(f=>f.id))); }} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11.6, fontWeight:600, color:C.pri, padding:"4px 8px" }}>
            {selected.size===filtered.length && filtered.length>0 ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
        </div>
      )}

      {allFreights.length===0 && <div style={{ textAlign:"center", padding:32, color:C.t3, fontSize:14.3 }}>No hay fletes registrados.</div>}
      {allFreights.length>0 && filtered.length===0 && <div style={{ textAlign:"center", padding:32, color:C.t3, fontSize:14.3 }}>No hay fletes con los filtros seleccionados.</div>}

      {groups.map(group=>(
        <div key={group.key} style={{ marginBottom:16 }}>
          <div style={{ fontSize:11.6, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{width:8,height:8,borderRadius:4,background:group.color}}/>
            {group.label} ({group.items.length})
          </div>

          {group.items.map(f=>{
            const isOpen = expanded[f.id];
            const isSel = selected.has(f.id);
            const detailCached = useFreightDetailStore.getState().getDetail(f.id);
            const docs = detailCached?.data?.documents || f.documents || [];
            const ocrDocs = docs.filter(d => d.ocrData);
            const imgDocs = docs.filter(d => d.type === "photo" || d.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i));
            return (
              <div key={f.id} style={{ background:isSel?C.priPale:C.w, border:`1px solid ${isSel?C.pri:C.b1}`, borderRadius:12, overflow:"hidden", marginBottom:8, boxShadow:C.sh, transition:"all 0.15s" }}>
                <button onClick={()=>toggle(f.id)} style={{ width:"100%", padding:"12px 14px", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
                  <span onClick={(e)=>toggleSel(f.id,e)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${isSel?C.pri:C.b1}`,background:isSel?C.pri:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                    {isSel && Ic.chk(C.w,12)}
                  </span>
                  {Ic.doc(group.color,18)}
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:13.2, fontWeight:700, color:C.t1 }}>{f.grain} · {f.tons} {f.unit||"tn"}</span>
                      <span style={{ fontSize:10, fontFamily:MONO, color:C.t3 }}>{f.code}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:2,fontSize:12.1,color:C.t2,marginTop:2}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.user(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.originCompanyName||originDisplay(f)}</span></div>
                      {f.transporterName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.truck(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.transporterName}{f.truckPlate?` (${f.truckPlate})`:""}</span></div>}
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.plant(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{destDisplay(f)}</span> <span style={{color:C.t3,marginLeft:4,fontSize:11}}>{docs.length} doc{docs.length!==1?"s":""}{ocrDocs.length>0 && ` · ${ocrDocs.length} OCR`}</span></div>
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
                        try { logs = await apiGetAuditLog(f.id); } catch(e) { console.warn("Audit logs unavailable:", e?.message); }
                        const { generateFreightPDF } = await loadPdfReport();
                        const dc = useFreightDetailStore.getState().getDetail(f.id);
                        generateFreightPDF(dc?.data ? { ...f, documents: dc.data.documents } : f, logs);
                      } catch(err) { log.error('PDF', err); useUIStore.getState().show('Error al generar PDF', 'err'); }
                      finally { setPdfLoadingId(null); }
                    }} style={{ width:"100%", padding:"8px 10px", marginBottom:8, borderRadius:8, border:`1.5px solid ${C.b1}`, background:C.w, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8, opacity:pdfLoadingId===f.id?0.6:1 }}>
                      {Ic.doc(C.pri,16)}<span style={{fontSize:12.1,fontWeight:600,color:C.pri}}>{pdfLoadingId===f.id?'Generando...':'Descargar informe PDF'}</span>
                    </button>

                    {/* Documents list */}
                    {docs.length>0 ? docs.map((d,i)=>{
                      const isImg = d.type==="photo" || d.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                      return (
                      <div key={d.id||i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<docs.length-1?`1px solid ${C.b2}`:"none" }}>
                        {d.type==="photo" ? (
                          <button onClick={()=>setViewFile({url:d.url,name:d.name||"Foto",type:"photo",id:d.id,ocrData:d.ocrData,freightId:f.id})} style={{ width:48, height:48, borderRadius:8, overflow:"hidden", flexShrink:0, border:`1px solid ${C.b1}`, padding:0, background:"none", cursor:"pointer" }}>
                            <img src={thumb(d.url)} alt="" loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          </button>
                        ) : (
                          <div style={{ width:48, height:48, borderRadius:8, background:C.secPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {Ic.doc(C.sec,20)}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13.2, fontWeight:600, color:C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", display:"flex", alignItems:"center", gap:4 }}>
                            {d.name||"Documento"}
                            {d.ocrData && <span style={{width:7,height:7,borderRadius:4,background:C.ok,flexShrink:0}} title="Datos OCR disponibles"/>}
                          </div>
                          <div style={{ fontSize:11, color:C.t3 }}>{d.step==="request"?"Solicitud":d.step==="load_confirmation"?"Carga":d.step==="assignment"?"Asignación":"Otro"} · {d.createdAt?new Date(d.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short"}):""}</div>
                        </div>
                        {d.ocrData && <button onClick={()=>setOcrResult(d.ocrData)} title="Ver datos extraídos" style={{ display:"flex", alignItems:"center", justifyContent:"center", minWidth:44, minHeight:44, padding:6, borderRadius:8, border:`1px solid ${C.ok}`, background:C.okPale, cursor:"pointer" }}>{Ic.eye(C.ok,14)}</button>}
                        {isImg && !d.ocrData && <button onClick={()=>handleOcr({url:d.url,name:d.name,type:d.type,id:d.id},f.id)} disabled={ocrLoading} title="Extraer datos (OCR)" style={{ display:"flex", alignItems:"center", justifyContent:"center", minWidth:44, minHeight:44, padding:6, borderRadius:8, border:`1px solid ${C.pri}40`, background:C.priPale, cursor:"pointer", opacity:ocrLoading?0.5:1 }}>{Ic.doc(C.pri,14)}</button>}
                        <button onClick={()=>setViewFile({url:d.url,name:d.name||"Documento",type:d.type,id:d.id,ocrData:d.ocrData,freightId:f.id})} style={{ display:"flex", alignItems:"center", justifyContent:"center", minWidth:44, minHeight:44, padding:6, borderRadius:8, background:C.secPale, border:"none", cursor:"pointer" }}>
                          {Ic.eye(C.sec,16)}
                        </button>
                      </div>
                      );
                    }) : <div style={{ fontSize:12.1, color:C.t3, padding:"8px 0" }}>Sin documentos adjuntos</div>}

                    {/* OCR data summary */}
                    {ocrDocs.length > 0 && (
                      <div style={{ marginTop:8, borderTop:`1px solid ${C.b2}`, paddingTop:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                          {Ic.doc(C.ok,14)}
                          <span style={{ fontSize:11.6, fontWeight:700, color:C.ok, textTransform:"uppercase", letterSpacing:0.5 }}>Datos extraídos ({ocrDocs.length})</span>
                        </div>
                        {ocrDocs.map(d => {
                          const ocr = d.ocrData;
                          const tipo = ocr?.tipoDocumento || "documento";
                          const conf = ocr?.confianza != null ? Math.round(ocr.confianza * 100) : null;
                          const datos = ocr?.datos || {};
                          const preview = Object.entries(datos).filter(([,v]) => v != null && v !== "" && typeof v !== "object").slice(0, 3);
                          return (
                            <button key={d.id} onClick={() => setOcrResult(ocr)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"6px 0", marginBottom:2, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                              <div style={{ width:6, height:6, borderRadius:3, background:C.ok, flexShrink:0 }}/>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:12.1, fontWeight:700, color:C.t1, textTransform:"capitalize" }}>{tipo}</span>
                                  {conf != null && <span style={{ fontSize:9.9, color:C.ok, fontWeight:600, background:C.okPale, padding:"1px 6px", borderRadius:8 }}>{conf}%</span>}
                                  <span style={{ fontSize:9.9, color:C.t3 }}>{d.name}</span>
                                </div>
                                <div style={{ fontSize:11, color:C.t2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  {preview.map(([k,v]) => `${k}: ${v}`).join(" · ") || "Sin datos"}
                                </div>
                              </div>
                              {Ic.eye(C.ok,14)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <FileViewer file={viewFile} onClose={()=>setViewFile(null)} onOcr={(file)=>handleOcr(file, viewFile?.freightId)} ocrLoading={ocrLoading} onViewOcr={(data)=>setOcrResult(data)}/>
      {ocrLoading && <div style={{ position:"fixed", inset:0, zIndex:250 }}><UploadOverlay uploading={ocrLoading} done={false} total={1} current={1} label="Extrayendo datos"/></div>}
      <OcrResultModal result={ocrResult} onClose={()=>setOcrResult(null)}/>
      </div>
    </div>
  );
}
