import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { C, Ic, FONT, MONO } from "../theme";
import { stCfg } from "../constants";
import { Bd, Btn, Select, SortTh, Tabs, exportExcel, SkeletonList, EmptyState, ErrorBoundary } from "../components";
import { useTableSort, usePullToRefresh } from "../hooks";
import { textMatch } from "../validation";
const FreightsOverviewMap = lazy(() => import("../maps").then(m => ({ default: m.FreightsOverviewMap })));

const GROUPS = [
  { key:"solicitado", label:"Solicitado", color:"#FF6A00", icon:Ic.warn, statuses:["pending_assignment"] },
  { key:"en_curso", label:"En curso", color:"#2563EB", icon:Ic.nav, statuses:["assigned","accepted","in_progress","loaded"] },
  { key:"finalizados", label:"Finalizados", color:"#1A6B37", icon:Ic.chk, statuses:["finished"] },
  { key:"cancelados", label:"Cancelados", color:"#DC2626", icon:Ic.ban, statuses:["canceled"] },
];

export default function ListScreen({ freights, loading, onNav, onRefresh, catalog, view, setView, goToMap, hasMore, loadMore, loadingMore, total, isDesktop, onAction }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [segExpanded, setSegExpanded] = useState({});
  const [fPlant, setFPlant] = useState("");
  const [fProducer, setFProducer] = useState("");
  const [fTransporter, setFTransporter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [mapShown, setMapShown] = useState(false);

  const plantOptions = useMemo(()=>[...new Set(freights.map(f=>f.destName).filter(Boolean))].sort(),[freights]);
  const producerOptions = useMemo(()=>[...new Set(freights.map(f=>f.originCompanyName).filter(Boolean))].sort(),[freights]);
  const transporterOptions = useMemo(()=>[...new Set(freights.map(f=>f.transporterName).filter(Boolean))].sort(),[freights]);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    if(preset==="today") { setDateFrom(fmt(today)); setDateTo(fmt(today)); }
    else if(preset==="week") { const w=new Date(today); w.setDate(w.getDate()-7); setDateFrom(fmt(w)); setDateTo(fmt(today)); }
    else if(preset==="month") { const m=new Date(today); m.setMonth(m.getMonth()-1); setDateFrom(fmt(m)); setDateTo(fmt(today)); }
    else if(preset==="quarter") { const q=new Date(today); q.setMonth(q.getMonth()-3); setDateFrom(fmt(q)); setDateTo(fmt(today)); }
    else { setDateFrom(""); setDateTo(""); }
  };

  const clearAll = () => { setSearchQ(""); setFPlant(""); setFProducer(""); setFTransporter(""); setDateFrom(""); setDateTo(""); setDatePreset(""); };
  const hasFilters = searchQ || fPlant || fProducer || fTransporter || dateFrom || dateTo;

  const filtered = useMemo(()=>{
    return freights.filter(f=>{
      if(searchQ && !textMatch(f.originCompanyName,searchQ) && !textMatch(f.code,searchQ) && !textMatch(f.grain,searchQ) && !textMatch(f.originName,searchQ) && !textMatch(f.destName,searchQ) && !textMatch(f.transporterName,searchQ) && !textMatch(f.driverName,searchQ) && !textMatch(f.driverPhone,searchQ)) return false;
      if(fPlant && f.destName!==fPlant) return false;
      if(fProducer && f.originCompanyName!==fProducer) return false;
      if(fTransporter && f.transporterName!==fTransporter) return false;
      if(dateFrom && f.loadDate < dateFrom) return false;
      if(dateTo && f.loadDate > dateTo) return false;
      return true;
    });
  },[freights,searchQ,fPlant,fProducer,fTransporter,dateFrom,dateTo]);

  const grouped = useMemo(()=>{
    const map = {};
    GROUPS.forEach(g => map[g.key] = []);
    filtered.forEach(f => {
      const g = GROUPS.find(g => g.statuses.includes(f.status));
      if(g) map[g.key].push(f);
    });
    return map;
  },[filtered]);

  // Tracking view: group by transporter → driver → queue
  const trackingGroups = useMemo(()=>{
    const active = filtered.filter(f=>!["finished","canceled"].includes(f.status));
    const unassigned = active.filter(f=>!f.transporterName);
    const byT = {};
    active.filter(f=>f.transporterName).forEach(f=>{
      const key = f.transporterId||f.transporterName;
      if(!byT[key]) byT[key] = { name:f.transporterName, id:key, drivers:{}, noDriver:[] };
      if(f.driverName){
        const dk = f.driverId||f.driverName;
        if(!byT[key].drivers[dk]) byT[key].drivers[dk] = { id:f.driverId, name:f.driverName, phone:f.driverPhone, freights:[] };
        byT[key].drivers[dk].freights.push(f);
      } else {
        byT[key].noDriver.push(f);
      }
    });
    Object.values(byT).forEach(t=>Object.values(t.drivers).forEach(d=>d.freights.sort((a,b)=>(a.queuePosition||0)-(b.queuePosition||0))));
    return { transporters:Object.values(byT).sort((a,b)=>a.name.localeCompare(b.name)), unassigned };
  },[filtered]);

  const { containerRef, indicator } = usePullToRefresh(onRefresh);

  // Preload Google Maps API + chunk while user browses the list
  useEffect(() => { import("../maps").then(m => m.loadGMaps()).catch(() => {}); }, []);
  // Keep map mounted after first show to avoid reinit on view switch
  useEffect(() => { if (view === "mapa") setMapShown(true); }, [view]);

  return (
    <div ref={containerRef} style={{ flex:1, overflow:"auto", padding:18, WebkitOverflowScrolling:"touch" }}>
      {indicator}
      {/* Desktop: original filters layout */}
      {isDesktop ? (<>
      {/* Date filters — line 1 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");setDatePreset("");}} aria-label="Limpiar fechas" style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2}}>{Ic.cross(C.t3,14)}</button>}
        {[{k:"today",l:"Hoy"},{k:"week",l:"Semana"},{k:"month",l:"Mes"}].map(p=>(
          <button key={p.k} onClick={()=>applyDatePreset(p.k)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${datePreset===p.k?C.pri:C.b1}`,background:datePreset===p.k?C.priPale:C.w,color:datePreset===p.k?C.pri:C.t2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{p.l}</button>
        ))}
        {hasFilters && <button onClick={clearAll} style={{marginLeft:"auto",padding:"5px 10px",borderRadius:6,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Limpiar</button>}
      </div>
      {/* Search + entity filters — line 2 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <div style={{ position:"relative", minWidth:140, flex:"0 1 200px" }}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar..."
            style={{width:"100%",padding:"6px 12px 6px 30px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          {searchQ && <button onClick={()=>setSearchQ("")} aria-label="Limpiar búsqueda" style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,12)}</button>}
        </div>
        <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fPlant?C.pri:C.b1}`,background:fPlant?C.priPale:C.w,color:fPlant?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Planta</option>
          {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fProducer} onChange={e=>setFProducer(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fProducer?C.pri:C.b1}`,background:fProducer?C.priPale:C.w,color:fProducer?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Productor</option>
          {producerOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fTransporter} onChange={e=>setFTransporter(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fTransporter?C.pri:C.b1}`,background:fTransporter?C.priPale:C.w,color:fTransporter?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Transportista</option>
          {transporterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          {[{k:"kanban",l:"Estados",ic:Ic.home},{k:"seguimiento",l:"Seguimiento",ic:Ic.user},{k:"tabla",l:"Tabla",ic:Ic.doc},{k:"mapa",l:"Mapa",ic:Ic.pin}].map(v=>(
            <button key={v.k} onClick={()=>setView(v.k)} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${view===v.k?C.pri:C.b1}`,background:view===v.k?C.priPale:C.w,color:view===v.k?C.pri:C.t2,fontSize:11,fontWeight:view===v.k?700:500,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              {v.ic(view===v.k?C.pri:C.t3,12)} {v.l}
            </button>
          ))}
        </div>
      </div>
      </>) : (<>
      {/* Mobile: collapsible filters layout */}
      {/* Toggle button */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        <button onClick={()=>setFiltersOpen(p=>!p)} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${hasFilters?C.pri:C.b1}`,background:hasFilters?C.priPale:C.w,color:hasFilters?C.pri:C.t2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
          {Ic.srch(hasFilters?C.pri:C.t3,12)} {filtersOpen?"Ocultar filtros":"Ver filtros"}{hasFilters?" (activos)":""}
        </button>
        {hasFilters && <button onClick={clearAll} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>Limpiar</button>}
      </div>
      {/* View mode buttons */}
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {[{k:"kanban",l:"Estados",ic:Ic.home},{k:"seguimiento",l:"Seg.",ic:Ic.user},{k:"tabla",l:"Tabla",ic:Ic.doc},{k:"mapa",l:"Mapa",ic:Ic.pin}].map(v=>(
          <button key={v.k} onClick={()=>setView(v.k)} style={{padding:"5px 7px",borderRadius:7,border:`1.5px solid ${view===v.k?C.pri:C.b1}`,background:view===v.k?C.priPale:C.w,color:view===v.k?C.pri:C.t2,fontSize:10,fontWeight:view===v.k?700:500,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>
            {v.ic(view===v.k?C.pri:C.t3,11)} {v.l}
          </button>
        ))}
      </div>
      {/* Collapsible filter block */}
      {filtersOpen && <>
      <div style={{ position:"relative", marginBottom:6 }}>
        <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar..."
          style={{width:"100%",padding:"7px 12px 7px 30px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} aria-label="Limpiar búsqueda" style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,12)}</button>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer",flex:1,minWidth:0}}/>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer",flex:1,minWidth:0}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");setDatePreset("");}} aria-label="Limpiar fechas" style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2,flexShrink:0}}>{Ic.cross(C.t3,14)}</button>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fPlant?C.pri:C.b1}`,background:fPlant?C.priPale:C.w,color:fPlant?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
          <option value="">Planta</option>
          {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fProducer} onChange={e=>setFProducer(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fProducer?C.pri:C.b1}`,background:fProducer?C.priPale:C.w,color:fProducer?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
          <option value="">Productor</option>
          {producerOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <select value={fTransporter} onChange={e=>setFTransporter(e.target.value)} style={{flex:1,padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fTransporter?C.pri:C.b1}`,background:fTransporter?C.priPale:C.w,color:fTransporter?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer",minWidth:0}}>
          <option value="">Transportista</option>
          {transporterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      </>}
      </>)}

      {/* Skeleton while loading */}
      {loading && freights.length === 0 && <SkeletonList count={5} />}

      {/* Empty state */}
      {!loading && freights.length === 0 && <EmptyState icon={Ic.truck(C.t3, 28)} title="Sin fletes todavía" subtitle="Los fletes que solicites o te asignen aparecerán acá" />}

      {/* View: Kanban — desktop: horizontal columns, mobile: stacked */}
      {view==="kanban" && freights.length > 0 && (isDesktop ? (
      <div style={{ display:"flex", gap:12, overflowX:"auto", alignItems:"flex-start", paddingBottom:8 }}>
        {GROUPS.map(group => {
          const items = grouped[group.key];
          return (
            <div key={group.key} style={{ minWidth:220, flex:"1 1 0", background:C.bg, borderRadius:12, border:`1px solid ${C.b1}`, overflow:"hidden" }}>
              <div style={{ padding:"10px 12px", borderBottom:`2px solid ${group.color}`, display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ display:"flex", flexShrink:0 }}>{group.icon(group.color, 14)}</span>
                <span style={{ fontSize:11, fontWeight:700, color:group.color }}>{group.label}</span>
                <span style={{ fontSize:10, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{items.length}</span>
              </div>
              <div style={{ padding:8, display:"flex", flexDirection:"column", gap:8, maxHeight:"calc(100vh - 180px)", overflowY:"auto" }}>
                {items.length===0 && <div style={{ fontSize:11, color:C.t3, textAlign:"center", padding:16 }}>Sin fletes</div>}
                {items.map(f => {
                  const st = stCfg(f.status);
                  return (
                  <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderLeft:`4px solid ${st.color}`, borderRadius:12, padding:14, cursor:"pointer", boxShadow:C.sh, transition:"background 0.15s", contentVisibility:"auto", containIntrinsicSize:"0 120px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:11, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                        <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                      </div>
                      {f.isOwnFleet && <span style={{ fontSize:9, color:C.acc, fontWeight:600 }}>Flota propia</span>}
                      {f.isMultiTruck && <span style={{ fontSize:9, color:C.info, fontWeight:600 }}>{f.assignedTruckCount}/{f.truckCount} cam.</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:6}}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,fontSize:11,color:C.t2}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.user(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.originCompanyName||(f.originName||"").split("—")[0].trim()}</span>{f.originLat&&f.originLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.originLat,f.originLng,[f.originCompanyName,f.fieldName,f.originName].filter(Boolean).join(" — "));}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10,flexShrink:0}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</div>
                      {f.transporterName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.truck(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.transporterName}{f.truckPlate?` (${f.truckPlate})`:""}</span></div>}
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.plant(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.destName}</span>{f.destLat&&f.destLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.destLat,f.destLng,f.destName);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10,flexShrink:0}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      ) : (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {GROUPS.map(group => {
          const items = grouped[group.key];
          if(items.length===0) return null;
          return (
            <div key={group.key}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"6px 0", borderBottom:`2px solid ${group.color}` }}>
                <span style={{ display:"flex", flexShrink:0 }}>{group.icon(group.color, 15)}</span>
                <span style={{ fontSize:12, fontWeight:700, color:group.color }}>{group.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:C.t3 }}>({items.length})</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                {items.map(f => {
                  const st = stCfg(f.status);
                  return (
                  <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderLeft:`4px solid ${st.color}`, borderRadius:12, padding:14, cursor:"pointer", boxShadow:C.sh, transition:"background 0.15s", flex:"1 1 280px", maxWidth:420, minWidth:240, contentVisibility:"auto", containIntrinsicSize:"0 120px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:11, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                        <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                      </div>
                      {f.isOwnFleet && <span style={{ fontSize:9, color:C.acc, fontWeight:600 }}>Flota propia</span>}
                      {f.isMultiTruck && <span style={{ fontSize:9, color:C.info, fontWeight:600 }}>{f.assignedTruckCount}/{f.truckCount} cam.</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:6}}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3,fontSize:11,color:C.t2}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.user(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.originCompanyName||(f.originName||"").split("—")[0].trim()}</span>{f.originLat&&f.originLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.originLat,f.originLng,[f.originCompanyName,f.fieldName,f.originName].filter(Boolean).join(" — "));}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10,flexShrink:0}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</div>
                      {f.transporterName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.truck(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.transporterName}{f.truckPlate?` (${f.truckPlate})`:""}</span></div>}
                      <div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.plant(C.t3,12)} <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.destName}</span>{f.destLat&&f.destLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.destLat,f.destLng,f.destName);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10,flexShrink:0}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      ))}

      {/* View: Mapa — stays mounted after first show to avoid reinit */}
      {(view==="mapa" || mapShown) && (
        <div style={{ display: view === "mapa" ? undefined : "none" }}>
          <ErrorBoundary><Suspense fallback={<SkeletonList count={3}/>}><FreightsOverviewMap freights={filtered} onSelect={(id)=>onNav("detail",id)} fields={catalog?.fields} plants={catalog?.plants} /></Suspense></ErrorBoundary>
        </div>
      )}

      {/* View: Tabla */}
      {view==="tabla" && (
        <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"flex-end", padding:"10px 12px 0" }}>
            <button onClick={()=>exportExcel(filtered,"tolvink-fletes.xls")} style={{padding:"5px 12px",borderRadius:8,border:`1.5px solid #1A6B37`,background:"#E6F4EA",color:"#1A6B37",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>{Ic.doc("#1A6B37",13)} Exportar Excel</button>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"inherit" }}>
              <thead>
                <tr style={{ background:C.bg, borderBottom:`2px solid ${C.b1}` }}>
                  {["Código","Estado","Producto","Cam.","Empresa","Campo / Lote","Destino","Fecha","Hora","Transportista","Matrícula","Chofer","Celular"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={13} style={{ padding:24, textAlign:"center", color:C.t3, fontSize:12 }}>Sin fletes</td></tr>}
                {filtered.map(f=>{
                  const st = stCfg(f.status);
                  const campoLote = [f.fieldName, f.originName].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr key={f.id} className="tv-row" onClick={()=>onNav("detail",f.id)} style={{ borderBottom:`1px solid ${C.b1}`, cursor:"pointer", contentVisibility:"auto", containIntrinsicSize:"0 44px" }}>
                      <td style={{ padding:"10px 12px", fontFamily:MONO, fontWeight:700, fontSize:11, color:C.t2, whiteSpace:"nowrap" }}>{f.code}</td>
                      <td style={{ padding:"10px 12px" }}><Bd color={st.color} bg={st.bg} small>{st.label}</Bd></td>
                      <td style={{ padding:"10px 12px", fontWeight:600, color:C.t1 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</td>
                      <td style={{ padding:"10px 12px", color:f.isMultiTruck?C.info:C.t3, fontWeight:f.isMultiTruck?600:400, fontSize:11, whiteSpace:"nowrap" }}>{f.isMultiTruck?`${f.assignedTruckCount}/${f.truckCount}`:"1"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.originCompanyName||f.originName}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{campoLote}{f.originLat&&f.originLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.originLat,f.originLng,[f.fieldName,f.originName].filter(Boolean).join(" / "));}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.destName}{f.destLat&&f.destLng&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.destLat,f.destLng,f.destName);}} style={{cursor:"pointer",opacity:0.6,marginLeft:3,fontSize:10}} title="Ver en mapa">{"\uD83D\uDCCD"}</span>}</td>
                      <td style={{ padding:"10px 12px", color:C.t2, whiteSpace:"nowrap" }}>{f.loadDate}</td>
                      <td style={{ padding:"10px 12px", color:C.t3, whiteSpace:"nowrap" }}>{f.loadTime||"—"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.transporterName||"—"}</td>
                      <td style={{ padding:"10px 12px", fontFamily:MONO, fontSize:11, color:C.t2, whiteSpace:"nowrap" }}>{f.truckPlate||"—"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.driverName||"—"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2, whiteSpace:"nowrap" }}>{f.driverPhone||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Seguimiento — by transporter → driver → queue */}
      {view==="seguimiento" && freights.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {trackingGroups.transporters.map(t=>{
            const driverList = Object.values(t.drivers);
            const totalFreights = driverList.reduce((s,d)=>s+d.freights.length,0) + t.noDriver.length;
            const isCollapsed = !segExpanded[t.id];
            return (
              <div key={t.id} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:14, overflow:"hidden", boxShadow:C.sh }}>
                {/* Transporter header — clickable to collapse */}
                <div onClick={()=>setSegExpanded(p=>({...p,[t.id]:!p[t.id]}))} style={{ padding:"12px 16px", borderBottom:isCollapsed?"none":`2px solid ${C.info}`, display:"flex", alignItems:"center", gap:8, background:`${C.info}08`, cursor:"pointer", userSelect:"none" }}>
                  {Ic.truck(C.info,16)}
                  <span style={{ fontSize:13, fontWeight:700, color:C.info }}>{t.name}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{totalFreights} flete{totalFreights!==1?"s":""}</span>
                  <span style={{ display:"flex", transition:"transform 0.2s", transform:isCollapsed?"rotate(0deg)":"rotate(-90deg)" }}>{Ic.chev(C.info,16)}</span>
                </div>
                {!isCollapsed && <div style={{ padding:12, display:"flex", flexDirection:"column", gap:14 }}>
                  {/* Drivers */}
                  {driverList.map(d=>(
                    <div key={d.id||d.name}>
                      {/* Driver header */}
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        {Ic.user(C.pri,14)}
                        <span style={{ fontSize:12, fontWeight:700, color:C.t1 }}>{d.name}</span>
                        {d.phone && <span style={{ fontSize:10.5, color:C.t3 }}>{d.phone}</span>}
                        <span style={{ fontSize:9.5, fontWeight:600, color:C.info, background:`${C.info}12`, padding:"2px 8px", borderRadius:6 }}>{d.freights.length} en cola</span>
                        {onAction && d.id && <button onClick={()=>onAction(d.freights[0]?.id,"driver_queue")} style={{ marginLeft:"auto", fontSize:9.5, fontWeight:700, color:C.info, background:`${C.info}12`, border:`1px solid ${C.info}30`, borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"inherit" }}>Ver cola</button>}
                      </div>
                      {/* Freight cards */}
                      <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:22 }}>
                        {d.freights.map((f,i)=>{
                          const st = stCfg(f.status);
                          return (
                            <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:10, border:`1px solid ${C.b1}`, borderLeft:`3px solid ${st.color}`, background:i===0?`${C.pri}06`:C.bg, cursor:"pointer", transition:"background 0.15s" }}>
                              <div style={{ width:22, height:22, borderRadius:11, background:i===0?C.pri:C.b1, color:i===0?C.w:C.t3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, flexShrink:0 }}>{i+1}</div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:10, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                                  <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                                </div>
                                <div style={{ fontSize:12, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                              </div>
                              <div style={{ fontSize:11, color:C.t3, textAlign:"right", flexShrink:0 }}>
                                {f.destName && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.plant(C.t3,10)} <span style={{ maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.destName}</span></div>}
                                {f.loadDate && <div style={{ fontSize:9.5, marginTop:2 }}>{f.loadDate}{f.loadTime?` · ${f.loadTime}`:""}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Freights without driver */}
                  {t.noDriver.length>0 && (
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        {Ic.user(C.t3,14)}
                        <span style={{ fontSize:12, fontWeight:600, color:C.t3, fontStyle:"italic" }}>Sin chofer asignado</span>
                        <span style={{ fontSize:9.5, fontWeight:600, color:C.t3, background:`${C.t3}12`, padding:"2px 8px", borderRadius:6 }}>{t.noDriver.length}</span>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:22 }}>
                        {t.noDriver.map(f=>{
                          const st = stCfg(f.status);
                          return (
                            <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:10, border:`1px dashed ${C.b1}`, background:C.bg, cursor:"pointer" }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:10, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                                  <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                                </div>
                                <div style={{ fontSize:12, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                              </div>
                              <div style={{ fontSize:11, color:C.t3, textAlign:"right", flexShrink:0 }}>
                                {f.destName && <div>{f.destName}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>}
              </div>
            );
          })}
          {/* Unassigned freights */}
          {trackingGroups.unassigned.length>0 && (
            <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:14, overflow:"hidden", boxShadow:C.sh }}>
              <div style={{ padding:"12px 16px", borderBottom:`2px solid ${C.t3}`, display:"flex", alignItems:"center", gap:8, background:`${C.t3}08` }}>
                {Ic.warn(C.t3,16)}
                <span style={{ fontSize:13, fontWeight:700, color:C.t2 }}>Sin asignar</span>
                <span style={{ fontSize:10, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{trackingGroups.unassigned.length}</span>
              </div>
              <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
                {trackingGroups.unassigned.map(f=>{
                  const st = stCfg(f.status);
                  return (
                    <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:10, border:`1px dashed ${C.b1}`, borderLeft:`3px solid ${st.color}`, background:C.bg, cursor:"pointer" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:10, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                          <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                        </div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.t1, marginTop:2 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                      </div>
                      <div style={{ fontSize:11, color:C.t3, textAlign:"right", flexShrink:0 }}>
                        {f.originCompanyName && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.user(C.t3,10)} {f.originCompanyName}</div>}
                        {f.destName && <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>{Ic.plant(C.t3,10)} {f.destName}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {trackingGroups.transporters.length===0 && trackingGroups.unassigned.length===0 && (
            <EmptyState icon={Ic.truck(C.t3,28)} title="Sin fletes activos" subtitle="No hay fletes en curso para mostrar en seguimiento"/>
          )}
        </div>
      )}

      {/* Load more / pagination indicator */}
      {hasMore && (
        <div style={{textAlign:"center",padding:"16px 0 24px"}}>
          <button onClick={loadMore} disabled={loadingMore} style={{padding:"8px 24px",borderRadius:10,border:`1.5px solid ${C.pri}`,background:C.w,color:C.pri,fontSize:12,fontWeight:700,cursor:loadingMore?"default":"pointer",fontFamily:"inherit",opacity:loadingMore?0.5:1}}>
            {loadingMore?"Cargando...":"Cargar más fletes"}
          </button>
          {total>0 && <div style={{fontSize:10,color:C.t3,marginTop:6}}>Mostrando {freights.length} de {total}</div>}
        </div>
      )}
    </div>
  );
}
