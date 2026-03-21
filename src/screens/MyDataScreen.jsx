import { useState, useRef, useEffect, Fragment } from "react";
import { C, Ic, FONT , R} from "../theme";
import { Btn, Bd, LoadingOverlay } from "../components";
import { apiUpdateMe, apiChangePassword } from "../api";
import { adminStyles, typeColors, typeLabels, adminBackBtn } from "../utils/freight-helpers";

export default function MyDataScreen({ user, onBack, onUserUpdate }) {
  const s = adminStyles();
  const [form, setForm] = useState({ name:user?.name||"", email:user?.email||"", phone:user?.phone||"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");
  const [expandedCo, setExpandedCo] = useState(null);
  const [pwForm, setPwForm] = useState({ current:"", next:"" });
  const [pwSaving, setPwSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [confirmErr, setConfirmErr] = useState(false);
  const msgTimer = useRef(null);
  const show = (t,k="ok") => { setMsg({t,k}); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(()=>setMsg(null),3000); };
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  if (!user) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40,color:"#8A9C90",fontSize:15.4,fontWeight:600}}>Cargando...</div>;

  const needsPassword = form.email.trim().toLowerCase() !== (user.email||"").toLowerCase() || form.phone.trim() !== (user.phone||"");
  const doSave = async (password) => {
    setSaving(true);
    try {
      const body = { ...form };
      if (password) body.currentPassword = password;
      await apiUpdateMe(body);
      onUserUpdate?.(form);
      setSaving(false);
      setConfirmModal(false);
      setConfirmPw("");
      setConfirmErr(false);
      setDoneMsg("Datos actualizados");
    } catch(e) {
      setSaving(false);
      if (password && (e.message||"").toLowerCase().includes("contraseña")) {
        setConfirmErr(true);
      } else {
        setConfirmModal(false);
        setConfirmPw("");
        show(e.message,"err");
      }
    }
  };
  const handleSave = () => {
    if(!form.name.trim()||!form.email.trim()) return show("Nombre y email obligatorios","err");
    if (needsPassword) { setConfirmModal(true); setConfirmPw(""); setConfirmErr(false); }
    else doSave(null);
  };
  const companies = (user.companies && user.companies.length > 0) ? user.companies : (user.companyId ? [{ companyId:user.companyId, companyName:user.entity||user.company?.name||"", companyType:user.userType||user.company?.type||"", role:user.role==="admin"?"gerente":"operario" }] : []);
  const permsByRole = (role) => {
    if(role==="gerente"||role==="admin") return ["Solicitar fletes","Aprobar fletes","Asignar choferes","Cancelar fletes","Ver informes","Administrar empresa"];
    return ["Ver fletes asignados","Confirmar carga","Confirmar descarga"];
  };
  return (
    <div style={{flex:1,overflow:"auto"}}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      <div style={{position:"sticky",top:0,zIndex:10,background:C.bg,padding:"18px 18px 8px"}}>{adminBackBtn(onBack)}</div>
      <div style={{padding:"0 18px 18px"}}>
      <div style={{fontSize:19.8,fontWeight:800,color:C.t1,marginBottom:4}}>Mis datos</div>
      <div style={{fontSize:12.1,color:C.t3,marginBottom:14}}>Editá tu información personal</div>
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,boxShadow:C.sh,marginBottom:16}}>
        <div style={s.lbl}>Nombre:</div>
        <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Nombre completo" style={{...s.inp,marginBottom:10}} />
        <div style={s.lbl}>Email:</div>
        <input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="Email" type="email" style={{...s.inp,marginBottom:10}} />
        <div style={s.lbl}>Teléfono:</div>
        <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={{...s.inp,marginBottom:10}} />
        <button onClick={handleSave} disabled={saving} style={s.btnP(C.pri,saving)}>{saving?"Guardando...":"Guardar cambios"}</button>
      </div>

      {companies.length>0 && <>
      <div style={{fontSize:16.5,fontWeight:700,color:C.t1,marginBottom:8}}>Mis empresas</div>
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,overflow:"hidden",boxShadow:C.sh}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.2,fontFamily:"inherit"}}>
          <thead>
            <tr style={{background:C.bg,borderBottom:`2px solid ${C.b1}`}}>
              <th style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Empresa</th>
              <th style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Tipo empresa</th>
              <th style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Tipo usuario</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c,i)=>{
              const isExp = expandedCo===c.companyId;
              const isActive = c.companyId===user.activeCompanyId;
              const tColor = typeColors[c.companyType]||C.t2;
              const rLabel = c.role==="gerente"||c.role==="admin"?"Gerente":"Operario";
              return (<Fragment key={c.companyId||i}>
                <tr onClick={()=>setExpandedCo(isExp?null:c.companyId)} style={{cursor:"pointer",borderTop:i>0?`1px solid ${C.b2}`:"none",background:isExp?`${C.pri}06`:"transparent",transition:"background 0.15s"}}>
                  <td style={{padding:"10px 12px",fontWeight:600,color:C.t1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {c.companyName||user.entity}
                      {isActive && <span style={{fontSize:8.8,background:C.pri,color:C.w,borderRadius: R.xs,padding:"1px 5px",fontWeight:700}}>Activa</span>}
                    </div>
                  </td>
                  <td style={{padding:"10px 12px"}}><Bd color={tColor}>{typeLabels[c.companyType]||c.companyType}</Bd></td>
                  <td style={{padding:"10px 12px"}}><Bd color={C.t2} bg={C.bgInput}>{rLabel}</Bd></td>
                </tr>
                {isExp && <tr><td colSpan={3} style={{padding:"8px 12px 12px",background:`${C.pri}04`,borderTop:`1px dashed ${C.b2}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",marginBottom:6}}>Permisos</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {permsByRole(c.role).map((p,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:4,fontSize:12.1,color:C.t1,padding:"3px 8px",background:C.w,borderRadius: R.sm,border:`1px solid ${C.b2}`}}>{Ic.chk(C.pri,11)} {p}</div>)}
                  </div>
                </td></tr>}
              </Fragment>);
            })}
          </tbody>
        </table>
      </div>
      </>}

      <div style={{fontSize:16.5,fontWeight:700,color:C.t1,marginBottom:8,marginTop:16}}>Cambiar contraseña</div>
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,boxShadow:C.sh}}>
        <div style={s.lbl}>Contraseña actual:</div>
        <input value={pwForm.current} onChange={e=>setPwForm(p=>({...p,current:e.target.value}))} placeholder="Contraseña actual" type="password" style={{...s.inp,marginBottom:10}} />
        <div style={s.lbl}>Nueva contraseña:</div>
        <input value={pwForm.next} onChange={e=>setPwForm(p=>({...p,next:e.target.value}))} placeholder="Mínimo 8 caracteres" type="password" style={{...s.inp,marginBottom:10}} />
        <button onClick={async()=>{
          if(!pwForm.next||pwForm.next.length<8) return show("Mínimo 8 caracteres","err");
          setPwSaving(true);
          try { await apiChangePassword(pwForm.current,pwForm.next); setPwForm({current:"",next:""}); show("Contraseña actualizada"); } catch(e) { show(e.message||"Error","err"); }
          finally { setPwSaving(false); }
        }} disabled={pwSaving} style={s.btnP(C.pri,pwSaving)}>{pwSaving?"Guardando...":"Cambiar contraseña"}</button>
      </div>

      {msg&&<div style={{padding:"8px 12px",borderRadius: R.md,background:msg.k==="ok"?C.okPale:`${C.err}15`,color:msg.k==="ok"?C.ok:C.err,fontSize:13.2,marginTop:10}}>{msg.t}</div>}
      </div>

      {confirmModal && (
        <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{background:C.bgCard,borderRadius: R.lg,padding:24,maxWidth:400,width:"90%",boxShadow:C.shLg}}>
            <div style={{fontFamily:FONT,fontSize:16.5,fontWeight:700,color:C.t1,marginBottom:8}}>Confirmar cambios</div>
            <div style={{fontFamily:FONT,fontSize:14.3,color:C.t2,marginBottom:16,lineHeight:1.5}}>Para confirmar los cambios, ingresá tu contraseña actual.</div>
            <input
              type="password"
              placeholder="Contraseña actual"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setConfirmErr(false); }}
              onKeyDown={e => e.key === "Enter" && confirmPw && !saving && doSave(confirmPw)}
              autoFocus
              style={{width:"100%",padding:"10px 12px",borderRadius: R.md,border:`1.5px solid ${confirmErr?C.err:C.b1}`,fontFamily:FONT,fontSize:14.3,background:C.bgInput,color:C.t1,outline:"none",boxSizing:"border-box"}}
            />
            {confirmErr && <div style={{color:C.err,fontSize:12.1,fontFamily:FONT,marginTop:4}}>Contraseña incorrecta</div>}
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button onClick={()=>{setConfirmModal(false);setConfirmPw("");setConfirmErr(false);}} style={{padding:"8px 16px",borderRadius: R.md,border:`1px solid ${C.b2}`,background:C.w,cursor:"pointer",fontFamily:FONT,fontSize:13.2,fontWeight:600,color:C.t2}}>Cancelar</button>
              <button onClick={()=>doSave(confirmPw)} disabled={!confirmPw||saving} style={{padding:"8px 16px",borderRadius: R.md,border:"none",background:C.pri,cursor:"pointer",fontFamily:FONT,fontSize:13.2,fontWeight:700,color:C.w,opacity:confirmPw&&!saving?1:0.5}}>
                {saving?"Confirmando...":"Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
