import { useUIStore } from "../store";
import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay, NumericStepper } from "../components";

export default function ConfirmActionModal({ freight, title, btnLabel, btnVariant="pri", icon, onClose, onConfirm, showTonsInput, defaultTons }) {
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const [tons,setTons] = useState(defaultTons || freight.tons || "");
  const doConfirm = async ()=>{
    if(loading||closing) return;
    if(showTonsInput){ const n=parseFloat(tons); if(!n||n<=0){ useUIStore.getState().show("Ingrese toneladas válidas (mayor a 0)", "error"); return; } }
    setLoading(true); const msg=await onConfirm(showTonsInput ? tons : undefined); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); }
  };
  return (
    <ModalOverlay onClose={onClose} maxWidth={360} loading={loading} closing={closing} closingText={closingText} quick>
      {icon && <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><div style={{width:48,height:48,borderRadius:24,background:`${btnVariant==="acc"?C.acc:C.pri}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div></div>}
      <div style={{fontSize:18.7,fontWeight:700,marginBottom:6,textAlign:"center"}}>{title}</div>
      <div style={{fontSize:13.2,color:C.t2,marginBottom:showTonsInput?12:20,textAlign:"center",padding:"8px 12px",background:C.bg,borderRadius:8,border:`1px solid ${C.b1}`}}>
        <div style={{fontWeight:700,color:C.t1}}>{freight.grain} · {freight.tons}{freight.unit||"tn"}</div>
        <div style={{fontSize:11,color:C.t3,marginTop:2}}>{freight.code}</div>
      </div>
      {showTonsInput && <div style={{marginBottom:16}}>
        <NumericStepper label="Toneladas cargadas" value={tons} onChange={setTons} min={0} step={0.01} placeholder="Ej: 30.5" />
      </div>}
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full v={btnVariant} disabled={loading||closing} onClick={doConfirm}>{loading?<><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.6s linear infinite",marginRight:6,verticalAlign:"middle"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Procesando...</>:btnLabel}</Btn></div>
    </ModalOverlay>
  );
}
