import { useState, Fragment } from "react";
import { C, Ic } from "../theme";
import { Av, Bd, Btn } from "../components";

export default function MenuScreen({ user, perms, onLogout, onNav, isDesktop, onSwitchCompany, onRefresh, simpleMode, onToggleSimple }) {
  const TYPE_LABELS = {plant:"Planta de Acopio",transporter:"Transportista",producer:"Productor"};
  const TYPE_COLORS = {plant:C.pri,transporter:C.info||C.sec,producer:C.acc};
  const tc = TYPE_COLORS[user.userType]||C.pri;
  const pl = []; if(perms.canRequest)pl.push("Solicitar fletes"); if(perms.canApprove)pl.push("Aprobar fletes"); if(perms.canAssignDriver)pl.push("Asignar choferes"); if(perms.canCancel)pl.push("Cancelar fletes"); if(perms.canReject)pl.push("Rechazar viajes");
  const [switching, setSwitching] = useState(null);

  // Use new companies array from backend memberships
  const companies = (user.companies && user.companies.length > 0) ? user.companies.map(c => ({
    ...c, label: TYPE_LABELS[c.companyType] || c.companyType, color: TYPE_COLORS[c.companyType] || C.t2,
  })) : [{ companyId: user.companyId, companyName: user.entity, companyType: user.userType, role: user.role === "admin" ? "gerente" : "operario", label: TYPE_LABELS[user.userType] || user.userType, color: tc }];

  const handleSwitch = async (companyId) => {
    if (!onSwitchCompany || companyId === user.activeCompanyId) return;
    setSwitching(companyId);
    try {
      const r = await onSwitchCompany(companyId);
      if (r?.ok && onRefresh) onRefresh();
    } catch (e) {
      console.warn("switchCompany failed:", e?.message);
    } finally {
      setSwitching(null);
    }
  };

  const isChofer = user.role === "chofer";
  const isGerente = user.role==="admin"||user.role==="platform_admin";
  const mgmtItems = [];
  if (!isChofer) {
    const ut = user.userType; const uts = user.userTypes||[];
    if(ut==="transporter"||ut==="producer"||ut==="plant"||uts.includes("transporter")||uts.includes("producer")||uts.includes("plant")||isGerente) mgmtItems.push({k:"trucks",l:"Mi Flota",ic:Ic.truck(C.acc,18),c:C.acc});
    if(ut==="producer"||uts.includes("producer")||isGerente) mgmtItems.push({k:"fields",l:"Mis Campos y Lotes",ic:Ic.pin(C.pri,18),c:C.pri});
    if(user.role==="platform_admin"||user.role==="admin") mgmtItems.push({k:"admin",l:"Administración",ic:Ic.shield(C.err,18),c:C.err});
    if(!isDesktop) {
      mgmtItems.push({k:"calendar",l:"Calendario",ic:Ic.cal(C.sec,18),c:C.sec});
      mgmtItems.push({k:"reports",l:"Informes",ic:Ic.doc(C.t2,18),c:C.t2});
    }
  }

  const menuItem = (m, i, arr) => (
    <button key={m.k} onClick={()=>onNav(m.k)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 14px",background:"none",border:"none",borderTop:i>0?`1px solid ${C.b2}`:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{width:36,height:36,borderRadius:10,background:`${m.c}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{m.ic}</div>
      <span style={{fontSize:14,fontWeight:600,color:C.t1}}>{m.l}</span>
      <span style={{marginLeft:"auto",display:"flex"}}>{Ic.chev(C.t3,16)}</span>
    </button>
  );

  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>

      <Btn full v="err" onClick={onLogout} icon={Ic.out(C.err,16)} style={{marginBottom:12}}>Cerrar sesión</Btn>

      {/* Profile section */}
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}>{Ic.user(C.pri,16)}<span style={{fontSize:10.5,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Mi Perfil</span></div>

        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
          <Av letters={user.av} size={56} color={tc}/>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.t1}}>{user.name}</div>
            <div style={{fontSize:12,color:C.t2,marginTop:2}}>{user.email}</div>
            {user.phone && <div style={{fontSize:11,color:C.t3,marginTop:1}}>{user.phone}</div>}
          </div>
        </div>

        {/* Companies table */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Empresas</div>
          <div style={{border:`1px solid ${C.b2}`,borderRadius:8,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"inherit"}}>
              <thead>
                <tr style={{background:C.bg,borderBottom:`1.5px solid ${C.b1}`}}>
                  <th style={{padding:"7px 10px",textAlign:"left",fontSize:9.5,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.4}}>Empresa</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontSize:9.5,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.4}}>Tipo</th>
                  <th style={{padding:"7px 10px",textAlign:"left",fontSize:9.5,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.4}}>Rol</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c,i)=>{
                  const isActive = c.companyId === user.activeCompanyId;
                  const roleLabel = c.role === "chofer" ? "Chofer" : c.role === "gerente" || c.effectiveRole === "admin" ? "Gerente" : "Operario";
                  const isExp = switching === "exp_"+c.companyId;
                  return (<Fragment key={c.companyId||i}>
                    <tr onClick={()=>setSwitching(isExp?null:"exp_"+c.companyId)} style={{cursor:"pointer",borderTop:i>0?`1px solid ${C.b2}`:"none",background:isExp?`${C.pri}06`:"transparent",transition:"background 0.15s"}}>
                      <td style={{padding:"8px 10px",fontWeight:600,color:C.t1,fontSize:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          {companies.length>1 && <div style={{width:14,height:14,borderRadius:7,border:`2px solid ${isActive?C.pri:C.b2}`,background:isActive?C.pri:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}} onClick={e=>{e.stopPropagation();if(!isActive)handleSwitch(c.companyId);}}>{isActive&&<div style={{width:6,height:6,borderRadius:3,background:C.w}}/>}</div>}
                          <span>{c.companyName||user.entity}</span>
                        </div>
                      </td>
                      <td style={{padding:"8px 10px"}}><Bd color={c.color}>{c.label}</Bd></td>
                      <td style={{padding:"8px 10px"}}><Bd color={C.t2} bg={C.bgInput}>{roleLabel}</Bd></td>
                    </tr>
                    {isExp && <tr><td colSpan={3} style={{padding:"6px 10px 10px",background:`${C.pri}04`,borderTop:`1px dashed ${C.b2}`}}>
                      <div style={{fontSize:9.5,fontWeight:700,color:C.t3,textTransform:"uppercase",marginBottom:5}}>Permisos</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {(()=>{
                          const p=[];
                          if(roleLabel==="Gerente"){if(perms.canRequest)p.push("Solicitar fletes");if(perms.canApprove)p.push("Aprobar fletes");if(perms.canAssignDriver)p.push("Asignar choferes");if(perms.canCancel)p.push("Cancelar fletes");if(perms.canReject)p.push("Rechazar viajes");p.push("Ver informes","Administrar empresa");}
                          else{p.push("Ver fletes asignados","Confirmar carga","Confirmar descarga");}
                          return p.map((pp,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:C.t1,padding:"2px 7px",background:C.w,borderRadius:5,border:`1px solid ${C.b2}`}}>{Ic.chk(C.pri,10)} {pp}</div>);
                        })()}
                      </div>
                    </td></tr>}
                  </Fragment>);
                })}
              </tbody>
            </table>
          </div>
          {companies.length>1 && <div style={{fontSize:10,color:C.t3,marginTop:4}}>Tocá el círculo para cambiar empresa activa · Tocá la fila para ver permisos</div>}
        </div>

        <button onClick={()=>onNav("mydata")} style={{width:"100%",padding:"10px 16px",borderRadius:8,border:`1px solid ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          {Ic.edit(C.pri,14)} Administrar mis datos
        </button>


      </div>

      {/* Management items */}
      {mgmtItems.length>0 && (
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:4,marginBottom:12,boxShadow:C.sh}}>
          {mgmtItems.map((m,i)=>menuItem(m,i,mgmtItems))}
        </div>
      )}

    </div>
  );
}
