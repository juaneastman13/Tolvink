import { useState, useEffect } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, ModalOverlay } from "../components";
import { apiCreateTruck, apiGetDrivers, apiCreateDriver } from "../api";

export default function TruckSelectModal({ freight, trucks: initialTrucks, onClose, onConfirm, user }) {
  const [sel,setSel] = useState("");
  const [driverId,setDriverId] = useState("");
  const [drivers,setDrivers] = useState([]);
  const [loadingDrivers,setLoadingDrivers] = useState(false);
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const [truckList,setTruckList] = useState((initialTrucks||[]).filter(t=>t.active!==false));
  const [truckSearch,setTruckSearch] = useState("");
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

  const companyId = user?.activeCompanyId || user?.companyId;

  // Load drivers
  const loadDriversFn = ()=>{
    if(!companyId) return;
    setLoadingDrivers(true);
    apiGetDrivers(companyId).then(r=>{ setDrivers(r||[]); }).catch(()=>setDrivers([])).finally(()=>setLoadingDrivers(false));
  };
  useEffect(()=>{ loadDriversFn(); },[companyId]);

  // Pre-select driver from truck's assignedUser
  useEffect(()=>{
    if(sel){
      const tk = truckList.find(x=>x.id===sel);
      if(tk?.assignedUser?.id){
        const d = drivers.find(x=>x.id===tk.assignedUser.id);
        if(d) setDriverId(tk.assignedUser.id);
      }
    }
  },[sel, truckList, drivers]);

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

  const doConfirm = async ()=>{ if(loading||closing||!sel) return; setLoading(true); const msg=await onConfirm(sel, driverId||undefined); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };

  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText} quick>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Aceptar flete · {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn → {freight.destName}</div>

      {/* Truck selection */}
      <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccioná un camión</label>
      {truckList.length > 6 && (
        <div style={{ position:"relative", marginBottom:8 }}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
          <input value={truckSearch} onChange={e=>setTruckSearch(e.target.value)} placeholder="Buscar por patente o modelo..." style={{width:"100%",padding:"8px 12px 8px 30px",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:180,overflowY:"auto"}}>
        {truckList.length===0 && !showNewTruck && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No tenés camiones registrados.</div>}
        {truckList.filter(t=>!truckSearch || t.plate?.toLowerCase().includes(truckSearch.toLowerCase()) || t.model?.toLowerCase().includes(truckSearch.toLowerCase())).map(t=><button key={t.id} onClick={()=>setSel(t.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${sel===t.id?C.acc:C.b1}`,background:sel===t.id?C.accPale:C.w,color:sel===t.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
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
          {Ic.plus(C.acc,14)} Agregar camión
        </button>
      ) : (
        <div style={{border:`1.5px solid ${C.acc}`,borderRadius:12,padding:12,marginBottom:10,background:`${C.acc}04`}}>
          <div style={{fontSize:11,fontWeight:700,color:C.acc,marginBottom:8}}>Nuevo camión</div>
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

      {/* Driver selection */}
      <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,marginTop:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Chofer (opcional)</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10,maxHeight:160,overflowY:"auto"}}>
        {loadingDrivers && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>Cargando choferes...</div>}
        {!loadingDrivers && drivers.length===0 && !showNewDriver && <div style={{fontSize:12,color:C.t3,padding:8,textAlign:"center"}}>No hay choferes registrados</div>}
        {drivers.map(d=>{const qLen=d.activeFreights?.length||0; return <button key={d.id} onClick={()=>setDriverId(d.id===driverId?"":d.id)} style={{padding:"11px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${driverId===d.id?C.info:C.b1}`,background:driverId===d.id?`${C.info}10`:C.w,color:driverId===d.id?C.info:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          {Ic.user(driverId===d.id?C.info:C.t3,16)}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:driverId===d.id?C.info:C.t1}}>{d.name}</div>
            {d.phone && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{d.phone}</div>}
            {qLen>0 && <div style={{fontSize:10,color:C.info,fontWeight:600,marginTop:1}}>{qLen} flete{qLen>1?"s":""} en cola</div>}
          </div>
        </button>})}
      </div>

      {/* Inline new driver form */}
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
            <button onClick={()=>{setShowNewDriver(false);setNewDriverName("");setNewDriverPhone("");setDriverErr("");}} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
            <button disabled={savingDriver} onClick={handleCreateDriver} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:C.info,color:C.w,fontSize:11.5,fontWeight:600,cursor:savingDriver?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingDriver?0.6:1}}>{savingDriver?"Guardando...":"Registrar"}</button>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full v="acc" disabled={!sel||loading||closing} onClick={doConfirm}>{loading?"Aceptando...":"Aceptar flete"}</Btn></div>
    </ModalOverlay>
  );
}
