import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";

export default function ConfirmActionModal({ freight, title, btnLabel, btnVariant="pri", icon, onClose, onConfirm, showTonsInput, defaultTons }) {
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const [tons,setTons] = useState(defaultTons || freight.tons || "");
  const doConfirm = async ()=>{
    if(loading||closing) return;
    if(showTonsInput){ const n=parseFloat(tons); if(!n||n<=0){ alert("Ingrese toneladas válidas (mayor a 0)"); return; } }
    setLoading(true); const msg=await onConfirm(showTonsInput ? tons : undefined); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); }
  };
  return (
    <ModalOverlay onClose={onClose} maxWidth={360} loading={loading} closing={closing} closingText={closingText}>
      {icon && <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><div style={{width:48,height:48,borderRadius:24,background:`${btnVariant==="acc"?C.acc:C.pri}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div></div>}
      <div style={{fontSize:17,fontWeight:700,marginBottom:6,textAlign:"center"}}>{title}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:showTonsInput?12:20,textAlign:"center"}}>{freight.code} · {freight.grain} · {freight.tons}{freight.unit||"tn"}</div>
      {showTonsInput && <div style={{marginBottom:16}}>
        <label style={{fontSize:13,fontWeight:600,color:C.t1,marginBottom:4,display:"block"}}>Toneladas cargadas</label>
        <input type="number" inputMode="decimal" step="0.01" min="0" value={tons} onChange={e=>setTons(e.target.value)} placeholder="Ej: 30.5" autoFocus
          style={{width:"100%",padding:"12px",borderRadius:10,border:`1px solid ${C.b1}`,fontSize:16,textAlign:"center",boxSizing:"border-box"}}/>
      </div>}
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full v={btnVariant} disabled={loading||closing} onClick={doConfirm}>{loading?"Procesando...":btnLabel}</Btn></div>
    </ModalOverlay>
  );
}
