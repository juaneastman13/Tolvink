import { useState } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, LoadingOverlay } from "../components";

export default function EditScreen({ freight, fields, plants, onBack, onSave }) {
  const [form, setForm] = useState({
    loadDate: freight.loadDate || "",
    loadTime: freight.loadTime || "",
    notes: freight.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const u = f => setForm(p=>({...p,...f}));

  const save = async () => {
    setSaving(true);
    const msg = await onSave(freight.id, form);
    setSaving(false);
    if(msg) setDoneMsg(msg);
  };

  return (
    <div style={{ flex:1, overflow:"auto" }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>{setDoneMsg("");onBack();}}/>}
      <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Editar Flete</div>
      </div>
      <div style={{ padding:"0 18px 18px" }}>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>{freight.code} · {freight.grain} · {freight.tons} {freight.unit||"tn"}</div>

      <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, boxShadow:C.sh }}>
        <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <div style={{flex:1}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"flex",alignItems:"center",gap:4,textTransform:"uppercase",letterSpacing:0.6}}>{Ic.cal(C.pri,14)} Fecha</label>
            <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} onClick={e=>e.target.showPicker?.()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"flex",alignItems:"center",gap:4,textTransform:"uppercase",letterSpacing:0.6}}>{Ic.clk(C.pri,14)} Hora</label>
            <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} onClick={e=>e.target.showPicker?.()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Notas</label>
          <textarea value={form.notes} onChange={e=>u({notes:e.target.value})} placeholder="Indicaciones..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box"}}/>
        </div>

        <Btn full disabled={saving} onClick={save}>{saving?"Guardando...":"Guardar cambios"}</Btn>
      </div>

      <div style={{ marginTop:16, padding:12, background:C.bgInput, borderRadius:10, fontSize:11, color:C.t3 }}>
        Solo se puede editar fecha, hora y notas. Para cambiar origen, destino o producto, cancelá y creá un flete nuevo.
      </div>
      </div>
    </div>
  );
}
