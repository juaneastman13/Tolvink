import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";

export default function AssignModal({ freight, transporters, onClose, onConfirm }) {
  const [t,setT] = useState("");
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const ts = transporters||[];
  const doConfirm = async ()=>{ if(loading||closing||!t) return; setLoading(true); const msg=await onConfirm(t); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };
  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Asignar transporte · {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn · {freight.originName}</div>
      <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Transportista</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
        {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10}}>No hay transportistas disponibles</div>}
        {ts.map(x=><button key={x.id} onClick={()=>setT(x.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${t===x.id?C.pri:C.b1}`,background:t===x.id?C.priPale:C.w,color:t===x.id?C.pri:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>{Ic.truck(t===x.id?C.pri:C.t3,16)} {x.name}</button>)}
      </div>
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full disabled={!t||loading||closing} onClick={doConfirm}>{loading?"Asignando...":"Asignar"}</Btn></div>
    </ModalOverlay>
  );
}
