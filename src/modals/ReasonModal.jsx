import { useState } from "react";
import { C , R} from "../theme";
import { Btn, ModalOverlay } from "../components";

export default function ReasonModal({ title, freight, btnLabel, btnType="err", onClose, onConfirm }) {
  const [reason,setReason] = useState("");
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const doConfirm = async ()=>{ if(loading||closing||!reason) return; setLoading(true); const msg=await onConfirm(reason); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };
  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText} quick>
      <div style={{fontSize:18.7,fontWeight:700,marginBottom:6,color:btnType==="err"?C.err:C.t1}}>{title}</div>
      <div style={{fontSize:13.2,color:C.t2,marginBottom:18,padding:"8px 12px",background:C.bg,borderRadius: R.md,border:`1px solid ${C.b1}`}}>
        <div style={{fontWeight:700,color:C.t1}}>{freight.grain} · {freight.tons}tn</div>
        <div style={{fontSize:11,color:C.t3,marginTop:2}}>{freight.code}</div>
      </div>
      <label style={{fontSize:11.6,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Motivo</label>
      <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius: R.md,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:14.3,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box",marginBottom:16}}/>
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Volver</Btn><Btn full v={btnType} disabled={!reason||loading||closing} onClick={doConfirm}>{loading?"Procesando...":btnLabel}</Btn></div>
    </ModalOverlay>
  );
}
