import { useState, useEffect, useCallback } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, ModalOverlay } from "../components";
import { apiGetTrucks, apiCreateTruck, apiGetDrivers, apiCreateDriver } from "../api";

// Collapsed summary for a completed wizard step
function StepDone({ label, value, sub, onEdit }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:10, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:10 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:0.4 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:600, color:C.t1, marginTop:1 }}>{value}</div>
        {sub && <div style={{ fontSize:10.5, color:C.t3, marginTop:1 }}>{sub}</div>}
      </div>
      <button onClick={onEdit} style={{ background:"none", border:`1px solid ${C.b2}`, borderRadius:6, padding:"4px 10px", fontSize:10.5, fontWeight:600, color:C.pri, cursor:"pointer", fontFamily:"inherit" }}>Cambiar</button>
    </div>
  );
}

export default function AssignModal({ freight, transporters, user, onClose, onConfirm, onAssignMulti }) {
  const multiTruck = (freight.truckCount || 1) > 1;
  const [truckList, setTruckList] = useState([]);
  const [mode,setMode] = useState(()=> freight.useOwnFleet===true ? "own" : "company"); // "company" | "own"
  const [t,setT] = useState("");
  const [truckId,setTruckId] = useState("");
  const [driverId,setDriverId] = useState("");
  const [trucks,setTrucks] = useState([]);
  const [drivers,setDrivers] = useState([]);
  const [loadingTrucks,setLoadingTrucks] = useState(false);
  const [loadingDrivers,setLoadingDrivers] = useState(false);
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const [showNewTruck,setShowNewTruck] = useState(false);
  const [newPlate,setNewPlate] = useState("");
  const [newModel,setNewModel] = useState("");
  const [savingTruck,setSavingTruck] = useState(false);
  const [truckErr,setTruckErr] = useState("");
  const [showNewDriver,setShowNewDriver] = useState(false);
  const [newDriverName,setNewDriverName] = useState("");
  const [newDriverPhone,setNewDriverPhone] = useState("");
  const [savingDriver,setSavingDriver] = useState(false);
  const [driverErr,setDriverErr] = useState("");
  const [tripCount, setTripCount] = useState(1);
  const ts = transporters||[];

  // Multi-truck: how many more needed
  const alreadyAssigned = freight.assignedTruckCount || 0;
  const needed = (freight.truckCount || 1) - alreadyAssigned;
  const totalTons = freight.tons || 0;
  const defaultTonsPerTruck = needed > 0 ? Math.round(totalTons / (freight.truckCount || 1) * 10) / 10 : totalTons;
  const [tonsInput, setTonsInput] = useState(defaultTonsPerTruck.toString());

  // Either origin (producer) or dest (plant) can have own fleet
  const hasOwnFleet = !!freight.originHasOwnFleet || !!freight.destHasOwnFleet;
  const ownFleetCompanyId = freight.destHasOwnFleet ? freight.destCompanyId : freight.originCompanyId;

  // Respect explicit useOwnFleet decision: force mode when set
  const forceMode = freight.useOwnFleet === true ? "own" : freight.useOwnFleet === false ? "company" : null;

  // Max trips you can still add
  const remainingSlots = Math.max(0, needed - truckList.length);

  const loadTrucks = useCallback((compId)=>{
    const cid = compId || (mode==="own"?ownFleetCompanyId:t);
    if(!cid) return;
    setLoadingTrucks(true);
    apiGetTrucks(cid).then(r=>{ setTrucks((r||[]).filter(t=>t.active!==false)); }).catch(()=>setTrucks([])).finally(()=>setLoadingTrucks(false));
  },[mode,ownFleetCompanyId,t]);
  const loadDriversFn = useCallback((compId)=>{
    const cid = compId || (mode==="own"?ownFleetCompanyId:t);
    if(!cid) return;
    setLoadingDrivers(true);
    apiGetDrivers(cid).then(r=>{ setDrivers(r||[]); }).catch(()=>setDrivers([])).finally(()=>setLoadingDrivers(false));
  },[mode,ownFleetCompanyId,t]);
  useEffect(()=>{ if(mode==="own"){ loadTrucks(ownFleetCompanyId); loadDriversFn(ownFleetCompanyId); } },[mode,ownFleetCompanyId,loadTrucks,loadDriversFn]);

  // Reset tripCount when company changes
  useEffect(()=>{ setTripCount(1); },[t, mode]);

  // Pre-select driver from truck's assignedUser
  useEffect(()=>{
    if(truckId){
      const tk = trucks.find(x=>x.id===truckId);
      if(tk?.assignedUser?.id){
        const d = drivers.find(x=>x.id===tk.assignedUser.id);
        if(d) setDriverId(tk.assignedUser.id);
      }
    }
  },[truckId]);

  const handleCreateTruck = async ()=>{
    if(savingTruck) return;
    const plate = newPlate.trim().toUpperCase();
    if(!plate){ setTruckErr("Patente obligatoria"); return; }
    setSavingTruck(true); setTruckErr("");
    try {
      const created = await apiCreateTruck({ plate, model: newModel.trim()||undefined });
      setNewPlate(""); setNewModel(""); setShowNewTruck(false);
      loadTrucks();
      if(created?.id) setTruckId(created.id);
    } catch(e){ setTruckErr(e.message||"Error al crear vehículo"); }
    finally { setSavingTruck(false); }
  };

  const handleCreateDriver = async ()=>{
    if(savingDriver) return;
    const name = newDriverName.trim();
    if(!name){ setDriverErr("Nombre obligatorio"); return; }
    setSavingDriver(true); setDriverErr("");
    try {
      const created = await apiCreateDriver({ name, phone: newDriverPhone.trim()||undefined });
      setNewDriverName(""); setNewDriverPhone(""); setShowNewDriver(false);
      loadDriversFn();
      if(created?.id) setDriverId(created.id);
    } catch(e){ setDriverErr(e.message||"Error al crear chofer"); }
    finally { setSavingDriver(false); }
  };

  // Add truck(s) to multi-truck list
  const addToList = () => {
    if(remainingSlots <= 0) return;
    const compId = mode==="own" ? ownFleetCompanyId : t;
    if(!compId) return;
    if(mode==="own" && !truckId) return;
    const selTruck = trucks.find(x=>x.id===truckId);
    const selDriver = drivers.find(x=>x.id===driverId);
    const compName = mode==="own" ? "Flota propia" : (ts.find(x=>x.id===compId)?.name||"");
    const count = multiTruck && mode==="company" ? Math.min(tripCount, remainingSlots) : 1;
    const newEntries = [];
    for (let i = 0; i < count; i++) {
      newEntries.push({
        transportCompanyId: compId,
        truckId: (count === 1 && truckId) ? truckId : undefined,
        driverId: (count === 1 && driverId) ? driverId : undefined,
        tons: parseFloat(tonsInput) || undefined,
        _plate: (count === 1 && selTruck?.plate) ? selTruck.plate : "",
        _compName: compName,
        _driverName: (count === 1 && selDriver?.name) ? selDriver.name : "",
      });
    }
    setTruckList(prev => [...prev, ...newEntries]);
    setTruckId(""); setDriverId(""); setTripCount(1);
    setTonsInput(defaultTonsPerTruck.toString());
  };

  const removeFromList = (idx) => {
    setTruckList(prev => prev.filter((_,i) => i !== idx));
  };

  // Single-truck confirm
  const doConfirm = async ()=>{
    if(loading||closing) return;
    if(mode==="company" && !t) return;
    if(mode==="own" && !truckId) return;
    if(mode==="own" && !driverId) return;
    setLoading(true);
    const compId = mode==="own" ? ownFleetCompanyId : t;
    const truck = mode==="own" ? truckId : undefined;
    const driver = mode==="own" ? driverId : undefined;
    const msg = await onConfirm(compId, truck, driver);
    setLoading(false);
    if(msg){ setClosingText(msg); setClosing(true); }
  };

  // Multi-truck confirm
  const doConfirmMulti = async ()=>{
    if(loading||closing||!onAssignMulti) return;
    if(truckList.length===0) return;
    setLoading(true);
    const payload = truckList.map(t => ({
      transportCompanyId: t.transportCompanyId,
      truckId: t.truckId,
      driverId: t.driverId,
      tons: t.tons,
    }));
    const msg = await onAssignMulti(payload);
    setLoading(false);
    if(msg){ setClosingText(msg); setClosing(true); }
  };

  const externalTs = ts.filter(x=>x.id!==freight.originCompanyId);
  const canAdd = remainingSlots > 0 && ((mode==="company"&&t) || (mode==="own"&&truckId));
  const hasDirtyData = !!(t || truckId || driverId || truckList.length > 0 || showNewTruck || showNewDriver);
  const safeClose = () => {
    if (hasDirtyData && !loading && !closing) {
      if (!window.confirm("¿Descartar los cambios sin guardar?")) return;
    }
    onClose();
  };

  // Helpers
  const selTransporterName = t ? (ts.find(x=>x.id===t)?.name||"") : "";
  const selTruckObj = truckId ? trucks.find(x=>x.id===truckId) : null;
  const selDriverObj = driverId ? (driverId===user?.id ? { name: user.name, _isMe: true } : drivers.find(x=>x.id===driverId)) : null;

  // Collapse repeated entries for display
  const collapsedList = [];
  for (const tk of truckList) {
    const last = collapsedList[collapsedList.length - 1];
    if (last && last._compName === tk._compName && !last._plate && !tk._plate && !last._driverName && !tk._driverName && last.tons === tk.tons) {
      last._count++;
    } else {
      collapsedList.push({ ...tk, _count: 1, _startIdx: truckList.indexOf(tk) });
    }
  }

  // ======================== RENDER =====================================

  return (
    <ModalOverlay onClose={safeClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Asignar transporte · {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:8}}>{freight.grain} · {freight.tons}tn · {freight.originName}</div>

      {/* Progress stepper */}
      {remainingSlots > 0 && (() => {
        const steps = mode === "own"
          ? [{ l: "Vehículo", done: !!truckId }, { l: "Chofer", done: !!driverId }, ...(multiTruck ? [{ l: "Toneladas", done: !!tonsInput }] : [])]
          : [{ l: "Transportista", done: !!t }, ...(multiTruck ? [{ l: "Viajes", done: tripCount > 0 }, { l: "Toneladas", done: !!tonsInput }] : [])];
        return (
          <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:14 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", flex:i < steps.length-1 ? 1 : undefined }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                  <div style={{ width:20, height:20, borderRadius:10, background:s.done?C.pri:C.b1, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s" }}>
                    {s.done ? Ic.chk(C.w, 12) : <span style={{ fontSize:10, fontWeight:700, color:C.t3 }}>{i+1}</span>}
                  </div>
                  <span style={{ fontSize:10, fontWeight:600, color:s.done?C.pri:C.t3, whiteSpace:"nowrap" }}>{s.l}</span>
                </div>
                {i < steps.length-1 && <div style={{ flex:1, height:2, background:s.done?C.pri:C.b1, margin:"0 4px", marginBottom:14, transition:"background 0.2s" }}/>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Multi-truck header */}
      {multiTruck && (
        <div style={{background:`${C.info}10`,border:`1px solid ${C.info}30`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
          {Ic.truck(C.info,18)}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.info}}>Necesita {freight.truckCount} camiones</div>
            <div style={{fontSize:11,color:C.t2}}>{alreadyAssigned} asignados · {Math.max(0, needed - truckList.length)} pendientes</div>
          </div>
        </div>
      )}

      {/* Truck list (multi-truck) — collapsed view */}
      {multiTruck && truckList.length > 0 && (
        <div style={{marginBottom:14}}>
          <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Camiones a asignar ({truckList.length})</label>
          {collapsedList.map((tk,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,border:`1px solid ${C.b1}`,background:C.w,marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:C.pri}}>{tk._count > 1 ? `x${tk._count}` : `#${tk._startIdx+1}`}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:C.t1}}>{tk._compName}{tk._plate?` · ${tk._plate}`:""}</div>
                {tk._driverName && <div style={{fontSize:10.5,color:C.t3}}>{tk._driverName}</div>}
                {tk.tons && <div style={{fontSize:10,color:C.t3}}>{tk.tons} tn{tk._count > 1 ? " c/u" : ""}</div>}
              </div>
              <button onClick={()=>{
                const idxs = new Set();
                let found = 0;
                for (let j = tk._startIdx; j < truckList.length && found < tk._count; j++) {
                  const e = truckList[j];
                  if (e._compName === tk._compName && !e._plate && !tk._plate && !e._driverName && !tk._driverName && e.tons === tk.tons) {
                    idxs.add(j); found++;
                  } else if (e._plate || e._driverName) break;
                }
                if (idxs.size === 0) idxs.add(tk._startIdx);
                setTruckList(prev => prev.filter((_,j) => !idxs.has(j)));
              }} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.cross(C.err,14)}</button>
            </div>
          ))}
        </div>
      )}

      {/* ============ WIZARD FORM (only when remaining slots) ============ */}
      {remainingSlots > 0 && <>

        {/* Mode toggle — hidden when useOwnFleet explicitly set */}
        {hasOwnFleet && !forceMode && <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:`1.5px solid ${C.b1}`}}>
          <button onClick={()=>{setMode("company");setTruckId("");setDriverId("");}} style={{flex:1,padding:"10px 0",fontFamily:"inherit",fontSize:12.5,fontWeight:mode==="company"?700:500,background:mode==="company"?C.pri:C.w,color:mode==="company"?C.w:C.t2,border:"none",cursor:"pointer"}}>Empresa</button>
          <button onClick={()=>{setMode("own");setT("");}} style={{flex:1,padding:"10px 0",fontFamily:"inherit",fontSize:12.5,fontWeight:mode==="own"?700:500,background:mode==="own"?C.acc:C.w,color:mode==="own"?C.w:C.t2,border:"none",cursor:"pointer",borderLeft:`1px solid ${C.b1}`}}>Flota propia</button>
        </div>}
        {forceMode && <div style={{padding:"8px 12px",background:forceMode==="own"?C.accPale:`${C.info}10`,borderRadius:8,fontSize:11,fontWeight:500,color:forceMode==="own"?C.acc:C.info,marginBottom:12}}>{forceMode==="own"?"El productor eligió usar flota propia":"El productor delegó el transporte"}</div>}

        {/* ======== COMPANY MODE ======== */}
        {mode==="company" && <>
          {/* Step 1: Transporter — full list or collapsed */}
          {!t ? (<>
            <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Transportista</label>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14,maxHeight:260,overflowY:"auto"}}>
              {externalTs.length===0 && ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10}}>No hay transportistas disponibles</div>}
              {(hasOwnFleet ? externalTs : ts).map(x=><button key={x.id} onClick={()=>setT(x.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                {Ic.truck(C.t3,16)}
                <div>
                  <div>{x.name}</div>
                  {x.accessUsers?.length > 0 && x.accessUsers.map(u=><div key={u.id} style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{Ic.user(C.t3,11)} {u.name}{u.phone?` · ${u.phone}`:""}</div>)}
                </div>
              </button>)}
            </div>
          </>) : (<>
            {/* Collapsed transporter */}
            <StepDone label="Transportista" value={selTransporterName} onEdit={()=>setT("")} />

            {/* Multi-truck: trip count + tons */}
            {multiTruck && <>
              <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Cantidad de viajes</label>
              <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:14,borderRadius:10,overflow:"hidden",border:`1.5px solid ${C.b1}`,alignSelf:"flex-start",width:"fit-content"}}>
                <button onClick={()=>setTripCount(c=>Math.max(1,c-1))} style={{width:40,height:38,border:"none",background:C.w,fontSize:18,fontWeight:700,color:tripCount<=1?C.t3:C.pri,cursor:tripCount<=1?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>-</button>
                <div style={{minWidth:44,height:38,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:C.t1,borderLeft:`1px solid ${C.b1}`,borderRight:`1px solid ${C.b1}`,background:C.w}}>{tripCount}</div>
                <button onClick={()=>setTripCount(c=>Math.min(Math.max(1,remainingSlots),c+1))} disabled={tripCount>=Math.max(1,remainingSlots)} style={{width:40,height:38,border:"none",background:C.w,fontSize:18,fontWeight:700,color:tripCount>=Math.max(1,remainingSlots)?C.t3:C.pri,cursor:tripCount>=Math.max(1,remainingSlots)?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
              </div>
              <div style={{marginBottom:14}}>
                <Field label={tripCount > 1 ? "Toneladas por viaje" : "Toneladas para este camión"} value={tonsInput} onChange={setTonsInput} placeholder={`${defaultTonsPerTruck}`}/>
              </div>
            </>}
          </>)}
        </>}

        {/* ======== OWN FLEET MODE ======== */}
        {mode==="own" && <>
          {/* Step 1: Truck — full list or collapsed */}
          {!truckId ? (<>
            <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccioná un vehículo</label>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:180,overflowY:"auto"}}>
              {loadingTrucks && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>Cargando vehículos...</div>}
              {!loadingTrucks && trucks.length===0 && !showNewTruck && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No hay vehículos registrados</div>}
              {trucks.map(tk=><button key={tk.id} onClick={()=>setTruckId(tk.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                {Ic.truck(C.t3,18)}
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.t1}}>{tk.plate}</div>
                  {tk.model && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{tk.model}</div>}
                  {tk.assignedUser && <div style={{fontSize:10,color:C.t3,marginTop:1}}>Chofer: {tk.assignedUser.name}</div>}
                </div>
              </button>)}
            </div>

            {!showNewTruck ? (
              <button onClick={()=>{setShowNewTruck(true);setTruckErr("");}} style={{width:"100%",padding:"10px 0",borderRadius:10,border:`1.5px dashed ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:10}}>
                {Ic.plus(C.acc,14)} Agregar vehículo
              </button>
            ) : (
              <div style={{border:`1.5px solid ${C.acc}`,borderRadius:12,padding:12,marginBottom:10,background:`${C.acc}04`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.acc,marginBottom:8}}>Nuevo vehículo</div>
                <Field label="Patente" value={newPlate} onChange={v=>{setNewPlate(v);setTruckErr("");}} placeholder="Ej: AB-123-CD" hasError={!!truckErr}/>
                <div style={{height:8}}/>
                <Field label="Modelo (opcional)" value={newModel} onChange={setNewModel} placeholder="Ej: Scania R500"/>
                {truckErr && <div style={{fontSize:11,color:C.err,fontWeight:600,marginTop:6}}>{truckErr}</div>}
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button onClick={()=>{setShowNewTruck(false);setNewPlate("");setNewModel("");setTruckErr("");}} style={{flex:1,padding:"10px 0",minHeight:38,borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                  <button disabled={savingTruck} onClick={handleCreateTruck} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:C.acc,color:C.w,fontSize:11.5,fontWeight:600,cursor:savingTruck?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingTruck?0.6:1}}>{savingTruck?"Guardando...":"Registrar"}</button>
                </div>
              </div>
            )}
          </>) : (<>
            {/* Collapsed truck */}
            <StepDone label="Vehículo" value={selTruckObj?.plate||""} sub={selTruckObj?.model} onEdit={()=>{setTruckId("");setDriverId("");}} />

            {/* Step 2: Driver — full list or collapsed */}
            {!driverId ? (<>
              <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Chofer</label>
              {user && <button onClick={()=>{
                const me = drivers.find(d=>d.id===user.id);
                if(me) setDriverId(me.id);
                else setDriverId(user.id);
              }} style={{width:"100%",padding:"11px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${C.b2}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                {Ic.user(C.t3,16)} Yo soy el chofer
              </button>}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:160,overflowY:"auto"}}>
                {loadingDrivers && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>Cargando choferes...</div>}
                {!loadingDrivers && drivers.length===0 && !showNewDriver && !user && <div style={{fontSize:12,color:C.t3,padding:8,textAlign:"center"}}>No hay choferes registrados</div>}
                {drivers.filter(d=>d.id!==user?.id).map(d=>{const qLen=d.activeFreights?.length||0; return <button key={d.id} onClick={()=>setDriverId(d.id)} style={{padding:"11px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  {Ic.user(C.t3,16)}
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.t1}}>{d.name}</div>
                    {d.phone && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{d.phone}</div>}
                    {qLen>0 && <div style={{fontSize:10,color:C.info,fontWeight:600,marginTop:1}}>{qLen} flete{qLen>1?"s":""} en cola</div>}
                  </div>
                </button>})}
              </div>

              {!showNewDriver ? (
                <button onClick={()=>{setShowNewDriver(true);setDriverErr("");}} style={{width:"100%",padding:"10px 0",borderRadius:10,border:`1.5px dashed ${C.info}`,background:`${C.info}08`,color:C.info,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:10}}>
                  {Ic.plus(C.info,14)} Agregar chofer
                </button>
              ) : (
                <div style={{border:`1.5px solid ${C.info}`,borderRadius:12,padding:12,marginBottom:10,background:`${C.info}04`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.info,marginBottom:8}}>Nuevo chofer</div>
                  <Field label="Nombre" value={newDriverName} onChange={v=>{setNewDriverName(v);setDriverErr("");}} placeholder="Ej: Juan Pérez" hasError={!!driverErr}/>
                  <div style={{height:8}}/>
                  <Field label="Teléfono (opcional)" value={newDriverPhone} onChange={setNewDriverPhone} placeholder="Ej: 099123456"/>
                  {driverErr && <div style={{fontSize:11,color:C.err,fontWeight:600,marginTop:6}}>{driverErr}</div>}
                  <div style={{display:"flex",gap:6,marginTop:10}}>
                    <button onClick={()=>{setShowNewDriver(false);setNewDriverName("");setNewDriverPhone("");setDriverErr("");}} style={{flex:1,padding:"10px 0",minHeight:38,borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                    <button disabled={savingDriver} onClick={handleCreateDriver} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:C.info,color:C.w,fontSize:11.5,fontWeight:600,cursor:savingDriver?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingDriver?0.6:1}}>{savingDriver?"Guardando...":"Registrar"}</button>
                  </div>
                </div>
              )}
            </>) : (<>
              {/* Collapsed driver */}
              <StepDone label="Chofer" value={selDriverObj?._isMe ? `${selDriverObj.name} (yo)` : selDriverObj?.name||""} onEdit={()=>setDriverId("")} />

              {/* Step 3: Tons (multi-truck only) */}
              {multiTruck && (
                <div style={{marginBottom:14}}>
                  <Field label="Toneladas para este camión" value={tonsInput} onChange={setTonsInput} placeholder={`${defaultTonsPerTruck}`}/>
                </div>
              )}
            </>)}
          </>)}
        </>}

      </>}
      {/* end remainingSlots > 0 */}

      {/* ============ BUTTONS ============ */}
      <div style={{display:"flex",gap:8}}>
        <Btn full v="ghost" onClick={safeClose} disabled={loading||closing}>Cancelar</Btn>
        {multiTruck ? (
          remainingSlots > 0 ? (
            <Btn full v="acc" disabled={!canAdd||loading||closing} onClick={addToList}>
              {mode==="company" && tripCount > 1 ? `Agregar ${tripCount} viajes` : "Agregar camión"}
            </Btn>
          ) : truckList.length > 0 ? (
            <Btn full disabled={loading||closing} onClick={doConfirmMulti}>
              {loading?"Asignando...":`Asignar ${truckList.length} camión${truckList.length>1?"es":""}`}
            </Btn>
          ) : null
        ) : (
          <Btn full v={mode==="own"?"acc":undefined} disabled={(mode==="company"&&!t)||(mode==="own"&&(!truckId||!driverId))||loading||closing} onClick={doConfirm}>{loading?"Asignando...":"Asignar"}</Btn>
        )}
      </div>

      {/* Multi-truck: final assign all button (when still adding + items in list) */}
      {multiTruck && truckList.length > 0 && remainingSlots > 0 && (
        <div style={{marginTop:10}}>
          <Btn full disabled={loading||closing} onClick={doConfirmMulti}>
            {loading?"Asignando...":truckList.length < needed
              ? `Asignar ${truckList.length} camión${truckList.length>1?"es":""} (parcial)`
              : `Asignar ${truckList.length} camiones`}
          </Btn>
        </div>
      )}
    </ModalOverlay>
  );
}
