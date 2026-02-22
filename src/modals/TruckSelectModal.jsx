import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, ModalOverlay } from "../components";
import { apiCreateTruck } from "../api";

export default function TruckSelectModal({ freight, trucks: initialTrucks, onClose, onConfirm }) {
  const [sel,setSel] = useState("");
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const [truckList,setTruckList] = useState((initialTrucks||[]).filter(t=>t.active!==false));
  const [showNewTruck,setShowNewTruck] = useState(false);
  const [newPlate,setNewPlate] = useState("");
  const [newModel,setNewModel] = useState("");
  const [savingTruck,setSavingTruck] = useState(false);
  const [truckErr,setTruckErr] = useState("");

  const handleCreateTruck = async ()=>{
    if(savingTruck) return;
    const plate = newPlate.trim().toUpperCase();
    if(!plate){ setTruckErr("Patente obligatoria"); return; }
    setSavingTruck(true); setTruckErr("");
    try {
      const created = await apiCreateTruck({ plate, model: newModel.trim()||undefined });
      setNewPlate(""); setNewModel(""); setShowNewTruck(false);
      if(created?.id){
        setTruckList(prev=>[...prev, created]);
        setSel(created.id);
      }
    } catch(e){ setTruckErr(e.message||"Error al crear veh\u00edculo"); }
    finally { setSavingTruck(false); }
  };

  const doConfirm = async ()=>{ if(loading||closing||!sel) return; setLoading(true); const msg=await onConfirm(sel); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };

  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Aceptar flete \u00b7 {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} \u00b7 {freight.tons}tn \u2192 {freight.destName}</div>
      <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccion\u00e1 un cami\u00f3n</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:220,overflowY:"auto"}}>
        {truckList.length===0 && !showNewTruck && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No ten\u00e9s camiones registrados.</div>}
        {truckList.map(t=><button key={t.id} onClick={()=>setSel(t.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${sel===t.id?C.acc:C.b1}`,background:sel===t.id?C.accPale:C.w,color:sel===t.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          {Ic.truck(sel===t.id?C.acc:C.t3,18)}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:sel===t.id?C.acc:C.t1}}>{t.plate}</div>
            {t.model && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{t.model}</div>}
            {t.assignedUser && <div style={{fontSize:10,color:C.t3,marginTop:1}}>Chofer: {t.assignedUser.name}</div>}
          </div>
        </button>)}
      </div>

      {/* Inline new truck form */}
      {!showNewTruck ? (
        <button onClick={()=>{setShowNewTruck(true);setTruckErr("");}} style={{width:"100%",padding:"10px 0",borderRadius:10,border:`1.5px dashed ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:10}}>
          {Ic.plus(C.acc,14)} Agregar cami\u00f3n
        </button>
      ) : (
        <div style={{border:`1.5px solid ${C.acc}`,borderRadius:12,padding:12,marginBottom:10,background:`${C.acc}04`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.acc,marginBottom:8}}>Nuevo cami\u00f3n</div>
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

      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full v="acc" disabled={!sel||loading||closing} onClick={doConfirm}>{loading?"Aceptando...":"Aceptar flete"}</Btn></div>
    </ModalOverlay>
  );
}
