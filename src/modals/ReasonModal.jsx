import { useState } from "react";
import { C } from "../theme";
import { Btn, ModalOverlay } from "../components";

export default function ReasonModal({ title, freight, btnLabel, btnType="err", onClose, onConfirm }) {
  const [reason,setReason] = useState("");
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const doConfirm = async ()=>{ if(loading||closing||!reason) return; setLoading(true); const msg=await onConfirm(reason); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };
  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4,color:btnType==="err"?C.err:C.t1}}>{title} · {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn</div>
      <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Motivo</label>
      <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box",marginBottom:16}}/>
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Volver</Btn><Btn full v={btnType} disabled={!reason||loading||closing} onClick={doConfirm}>{loading?"Procesando...":btnLabel}</Btn></div>
    </ModalOverlay>
  );
}
