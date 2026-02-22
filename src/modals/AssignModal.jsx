import { useState, useEffect } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, ModalOverlay } from "../components";
import { apiGetTrucks, apiCreateTruck } from "../api";

export default function AssignModal({ freight, transporters, onClose, onConfirm }) {
  const [mode,setMode] = useState("company"); // "company" | "own"
  const [t,setT] = useState("");
  const [truckId,setTruckId] = useState("");
  const [trucks,setTrucks] = useState([]);
  const [loadingTrucks,setLoadingTrucks] = useState(false);
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const [showNewTruck,setShowNewTruck] = useState(false);
  const [newPlate,setNewPlate] = useState("");
  const [newModel,setNewModel] = useState("");
  const [savingTruck,setSavingTruck] = useState(false);
  const [truckErr,setTruckErr] = useState("");
  const ts = transporters||[];

  // Origin company has own fleet (from backend hasInternalFleet or types includes transporter)
  const hasOwnFleet = !!freight.originHasOwnFleet;

  // Load trucks when switching to own fleet mode
  const loadTrucks = ()=>{
    if(!freight.originCompanyId) return;
    setLoadingTrucks(true);
    apiGetTrucks(freight.originCompanyId).then(r=>{ setTrucks((r||[]).filter(t=>t.active!==false)); }).catch(()=>setTrucks([])).finally(()=>setLoadingTrucks(false));
  };
  useEffect(()=>{ if(mode==="own") loadTrucks(); },[mode,freight.originCompanyId]);

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
    } catch(e){ setTruckErr(e.message||"Error al crear veh\u00edculo"); }
    finally { setSavingTruck(false); }
  };

  const doConfirm = async ()=>{
    if(loading||closing) return;
    if(mode==="company" && !t) return;
    if(mode==="own" && !truckId) return;
    setLoading(true);
    const compId = mode==="own" ? freight.originCompanyId : t;
    const truck = mode==="own" ? truckId : undefined;
    const msg = await onConfirm(compId, truck);
    setLoading(false);
    if(msg){ setClosingText(msg); setClosing(true); }
  };

  // Filter out origin company from external transporters list
  const externalTs = ts.filter(x=>x.id!==freight.originCompanyId);

  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Asignar transporte \u00b7 {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:14}}>{freight.grain} \u00b7 {freight.tons}tn \u00b7 {freight.originName}</div>

      {/* Mode toggle — only show if origin has own fleet */}
      {hasOwnFleet && <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:`1.5px solid ${C.b1}`}}>
        <button onClick={()=>{setMode("company");setTruckId("");}} style={{flex:1,padding:"10px 0",fontFamily:"inherit",fontSize:12.5,fontWeight:mode==="company"?700:500,background:mode==="company"?C.pri:C.w,color:mode==="company"?C.w:C.t2,border:"none",cursor:"pointer"}}>Empresa</button>
        <button onClick={()=>{setMode("own");setT("");}} style={{flex:1,padding:"10px 0",fontFamily:"inherit",fontSize:12.5,fontWeight:mode==="own"?700:500,background:mode==="own"?C.acc:C.w,color:mode==="own"?C.w:C.t2,border:"none",cursor:"pointer",borderLeft:`1px solid ${C.b1}`}}>Flota propia</button>
      </div>}

      {mode==="company" && <>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Transportista</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18,maxHeight:260,overflowY:"auto"}}>
          {externalTs.length===0 && ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10}}>No hay transportistas disponibles</div>}
          {(hasOwnFleet ? externalTs : ts).map(x=><button key={x.id} onClick={()=>setT(x.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${t===x.id?C.pri:C.b1}`,background:t===x.id?C.priPale:C.w,color:t===x.id?C.pri:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            {Ic.truck(t===x.id?C.pri:C.t3,16)}
            <div>
              <div>{x.name}</div>
              {x.accessUsers?.length > 0 && x.accessUsers.map(u=><div key={u.id} style={{fontSize:10.5,fontWeight:400,color:t===x.id?C.pri:C.t3,marginTop:1}}>{Ic.user(t===x.id?C.pri:C.t3,11)} {u.name}{u.phone?` \u00b7 ${u.phone}`:""}</div>)}
            </div>
          </button>)}
        </div>
      </>}

      {mode==="own" && <>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccion\u00e1 un veh\u00edculo</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:220,overflowY:"auto"}}>
          {loadingTrucks && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>Cargando veh\u00edculos...</div>}
          {!loadingTrucks && trucks.length===0 && !showNewTruck && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No hay veh\u00edculos registrados</div>}
          {trucks.map(tk=><button key={tk.id} onClick={()=>setTruckId(tk.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${truckId===tk.id?C.acc:C.b1}`,background:truckId===tk.id?C.accPale:C.w,color:truckId===tk.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            {Ic.truck(truckId===tk.id?C.acc:C.t3,18)}
            <div>
              <div style={{fontSize:13,fontWeight:700,color:truckId===tk.id?C.acc:C.t1}}>{tk.plate}</div>
              {tk.model && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{tk.model}</div>}
              {tk.assignedUser && <div style={{fontSize:10,color:C.t3,marginTop:1}}>Chofer: {tk.assignedUser.name}</div>}
            </div>
          </button>)}
        </div>

        {/* Inline new truck form */}
        {!showNewTruck ? (
          <button onClick={()=>{setShowNewTruck(true);setTruckErr("");}} style={{width:"100%",padding:"10px 0",borderRadius:10,border:`1.5px dashed ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:10}}>
            {Ic.plus(C.acc,14)} Agregar veh\u00edculo
          </button>
        ) : (
          <div style={{border:`1.5px solid ${C.acc}`,borderRadius:12,padding:12,marginBottom:10,background:`${C.acc}04`}}>
            <div style={{fontSize:11,fontWeight:700,color:C.acc,marginBottom:8}}>Nuevo veh\u00edculo</div>
            <Field label="Patente" value={newPlate} onChange={v=>{setNewPlate(v);setTruckErr("");}} placeholder="Ej: AB-123-CD" hasError={!!truckErr}/>
            <div style={{height:8}}/>
            <Field label="Modelo (opcional)" value={newModel} onChange={setNewModel} placeholder="Ej: Scania R500"/>
            {truckErr && <div style={{fontSize:11,color:C.err,fontWeight:600,marginTop:6}}>{truckErr}</div>}
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <button onClick={()=>{setShowNewTruck(false);setNewPlate("");setNewModel("");setTruckErr("");}} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
              <button disabled={savingTruck} onClick={handleCreateTruck} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:C.acc,color:C.w,fontSize:11.5,fontWeight:600,cursor:savingTruck?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingTruck?0.6:1}}>{savingTruck?"Guardando...":"Registrar"}</button>
            </div>
          </div>
        )}
      </>}

      <div style={{display:"flex",gap:8}}>
        <Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn>
        <Btn full v={mode==="own"?"acc":undefined} disabled={(mode==="company"&&!t)||(mode==="own"&&!truckId)||loading||closing} onClick={doConfirm}>{loading?"Asignando...":"Asignar"}</Btn>
      </div>
    </ModalOverlay>
  );
}
