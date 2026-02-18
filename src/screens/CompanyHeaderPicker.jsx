import { useState, useEffect, useRef } from "react";
import { C, Ic } from "../theme";

export default function CompanyHeaderPicker({ user, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const TYPE_L = {plant:"Planta",transporter:"Transportista",producer:"Productor"};
  const TYPE_C = {plant:C.pri,transporter:C.info||C.sec,producer:C.acc};
  const companies = (user.companies && user.companies.length > 0) ? user.companies : (user.companyId ? [{ companyId:user.companyId, companyName:user.entity||"", companyType:user.userType||"", role:user.role }] : []);
  const [viewAll, setViewAll] = useState(false);
  const active = companies.find(c=>c.companyId===user.activeCompanyId) || companies[0];
  const activeName = viewAll ? "Todas las empresas" : (active?.companyName || user.entity || "");
  const tColor = viewAll ? C.t2 : (TYPE_C[active?.companyType] || C.t2);

  useEffect(()=>{
    if(!open) return;
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[open]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("es-UY",{weekday:"long",day:"numeric",month:"long"});
  const timeLabel = now.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit",hour12:false});

  if(!activeName) return null;
  return (
    <div ref={ref} style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
      <div style={{fontSize:10,color:C.t3,textTransform:"capitalize",marginBottom:2}}>{dateLabel} · {timeLabel}</div>
      <button onClick={()=>setOpen(!open)} style={{background:"none",border:`1px solid ${C.b2}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>
        <span style={{width:8,height:8,borderRadius:4,background:tColor,flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:700,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{activeName}</span>
        <span style={{fontSize:10,color:C.t3,flexShrink:0}}>▼</span>
      </button>
      {open && (
        <div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,boxShadow:C.shMd,padding:4,zIndex:100,minWidth:180,maxWidth:280}}>
          {companies.length>1 && <button onClick={()=>{setOpen(false);setViewAll(true);}} style={{display:"flex",alignItems:"center",gap:6,width:"100%",padding:"8px 10px",background:viewAll?`${C.pri}08`:"transparent",border:"none",borderRadius:8,cursor:viewAll?"default":"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <span style={{width:6,height:6,borderRadius:3,background:C.t2,flexShrink:0}}/>
            <span style={{fontSize:11,fontWeight:viewAll?700:500,color:C.t1,flex:1}}>Todas las empresas</span>
            {viewAll && <span style={{fontSize:8,color:C.pri,fontWeight:700}}>✓</span>}
          </button>}
          {companies.map(c=>{
            const isAct = !viewAll && c.companyId===user.activeCompanyId;
            return <button key={c.companyId} onClick={()=>{setOpen(false);setViewAll(false);if(c.companyId!==user.activeCompanyId)onSwitch(c.companyId);}} style={{display:"flex",alignItems:"center",gap:6,width:"100%",padding:"8px 10px",background:isAct?`${C.pri}08`:"transparent",border:"none",borderRadius:8,cursor:isAct?"default":"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <span style={{width:6,height:6,borderRadius:3,background:TYPE_C[c.companyType]||C.t2,flexShrink:0}}/>
              <span style={{fontSize:11,fontWeight:isAct?700:500,color:C.t1,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.companyName}</span>
              <span style={{fontSize:9,color:C.t3}}>{TYPE_L[c.companyType]||""}</span>
              {isAct && <span style={{fontSize:8,color:C.pri,fontWeight:700}}>✓</span>}
            </button>;
          })}
        </div>
      )}
    </div>
  );
}
