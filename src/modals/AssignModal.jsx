import { useState, useEffect } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";
import { apiGetTrucks } from "../api";

export default function AssignModal({ freight, transporters, onClose, onConfirm }) {
  const [mode,setMode] = useState("company"); // "company" | "own"
  const [t,setT] = useState("");
  const [truckId,setTruckId] = useState("");
  const [trucks,setTrucks] = useState([]);
  const [loadingTrucks,setLoadingTrucks] = useState(false);
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const ts = transporters||[];

  // Origin company has own fleet (from backend hasInternalFleet or types includes transporter)
  const hasOwnFleet = !!freight.originHasOwnFleet;

  // Load trucks when switching to own fleet mode
  useEffect(()=>{
    if(mode==="own" && freight.originCompanyId){
      setLoadingTrucks(true);
      apiGetTrucks(freight.originCompanyId).then(r=>{ setTrucks((r||[]).filter(t=>t.active!==false)); }).catch(()=>setTrucks([])).finally(()=>setLoadingTrucks(false));
    }
  },[mode,freight.originCompanyId]);

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
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18,maxHeight:260,overflowY:"auto"}}>
          {loadingTrucks && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>Cargando veh\u00edculos...</div>}
          {!loadingTrucks && trucks.length===0 && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No hay veh\u00edculos registrados para esta empresa</div>}
          {trucks.map(tk=><button key={tk.id} onClick={()=>setTruckId(tk.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${truckId===tk.id?C.acc:C.b1}`,background:truckId===tk.id?C.accPale:C.w,color:truckId===tk.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            {Ic.truck(truckId===tk.id?C.acc:C.t3,18)}
            <div>
              <div style={{fontSize:13,fontWeight:700,color:truckId===tk.id?C.acc:C.t1}}>{tk.plate}</div>
              {tk.model && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{tk.model}</div>}
              {tk.assignedUser && <div style={{fontSize:10,color:C.t3,marginTop:1}}>Chofer: {tk.assignedUser.name}</div>}
            </div>
          </button>)}
        </div>
      </>}

      <div style={{display:"flex",gap:8}}>
        <Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn>
        <Btn full v={mode==="own"?"acc":undefined} disabled={(mode==="company"&&!t)||(mode==="own"&&!truckId)||loading||closing} onClick={doConfirm}>{loading?"Asignando...":"Asignar"}</Btn>
      </div>
    </ModalOverlay>
  );
}
