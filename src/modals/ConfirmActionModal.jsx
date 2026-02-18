import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";

export default function ConfirmActionModal({ freight, title, btnLabel, btnVariant="pri", icon, onClose, onConfirm }) {
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const doConfirm = async ()=>{ if(loading||closing) return; setLoading(true); const msg=await onConfirm(); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };
  return (
    <ModalOverlay onClose={onClose} maxWidth={360} loading={loading} closing={closing} closingText={closingText}>
      {icon && <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><div style={{width:48,height:48,borderRadius:24,background:`${btnVariant==="acc"?C.acc:C.pri}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div></div>}
      <div style={{fontSize:17,fontWeight:700,marginBottom:6,textAlign:"center"}}>{title}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:20,textAlign:"center"}}>{freight.code} · {freight.grain} · {freight.tons}{freight.unit||"tn"}</div>
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full v={btnVariant} disabled={loading||closing} onClick={doConfirm}>{loading?"Procesando...":btnLabel}</Btn></div>
    </ModalOverlay>
  );
}
