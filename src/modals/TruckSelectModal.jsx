import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";

export default function TruckSelectModal({ freight, trucks, onClose, onConfirm }) {
  const [sel,setSel] = useState("");
  const [loading,setLoading] = useState(false);
  const [closing,setClosing] = useState(false);
  const [closingText,setClosingText] = useState("");
  const ts = (trucks||[]).filter(t=>t.active!==false);
  const doConfirm = async ()=>{ if(loading||closing||!sel) return; setLoading(true); const msg=await onConfirm(sel); setLoading(false); if(msg){ setClosingText(msg); setClosing(true); } };
  return (
    <ModalOverlay onClose={onClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Aceptar flete · {freight.code}</div>
      <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn → {freight.destName}</div>
      <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccioná un camión</label>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18,maxHeight:220,overflowY:"auto"}}>
        {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No tenés camiones registrados.<br/><span style={{color:C.acc,fontWeight:600}}>Registrá uno desde tu perfil.</span></div>}
        {ts.map(t=><button key={t.id} onClick={()=>setSel(t.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${sel===t.id?C.acc:C.b1}`,background:sel===t.id?C.accPale:C.w,color:sel===t.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
          {Ic.truck(sel===t.id?C.acc:C.t3,18)}
          <div>
            <div style={{fontSize:13,fontWeight:700,color:sel===t.id?C.acc:C.t1}}>{t.plate}</div>
            {t.model && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{t.model}</div>}
            {t.assignedUser && <div style={{fontSize:10,color:C.t3,marginTop:1}}>Chofer: {t.assignedUser.name}</div>}
          </div>
        </button>)}
      </div>
      <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading||closing}>Cancelar</Btn><Btn full v="acc" disabled={!sel||loading||closing} onClick={doConfirm}>{loading?"Aceptando...":"Aceptar flete"}</Btn></div>
    </ModalOverlay>
  );
}
