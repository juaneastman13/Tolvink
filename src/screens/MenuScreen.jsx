import { useState, useEffect, Fragment } from "react";
import { C, Ic } from "../theme";
import { Av, Bd, Btn } from "../components";

export default function MenuScreen({ user, perms, onLogout, onNav, isDesktop, onSwitchCompany, onRefresh, simpleMode, onToggleSimple }) {
  const TYPE_LABELS = {plant:"Planta de Acopio",transporter:"Transportista",producer:"Productor"};
  const TYPE_COLORS = {plant:C.pri,transporter:C.info||C.sec,producer:C.acc};
  const tc = TYPE_COLORS[user.userType]||C.pri;
  const pl = []; if(perms.canRequest)pl.push("Solicitar fletes"); if(perms.canApprove)pl.push("Aprobar fletes"); if(perms.canAssignDriver)pl.push("Asignar choferes"); if(perms.canCancel)pl.push("Cancelar fletes"); if(perms.canReject)pl.push("Rechazar viajes");
  const [switching, setSwitching] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener('pwa-install-available', h);
    return () => window.removeEventListener('pwa-install-available', h);
  }, []);

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
  const isPlantUser = user.userType === "plant";
  const mgmtItems = [];
  if (!isChofer) {
    const ut = user.userType; const uts = user.userTypes||[];
    if(ut==="transporter"||ut==="producer"||ut==="plant"||uts.includes("transporter")||uts.includes("producer")||uts.includes("plant")||isGerente) mgmtItems.push({k:"trucks",l:"Mi Flota",ic:Ic.truck(C.t3,18),c:C.t3});
    if(isPlantUser) mgmtItems.push({k:"linked",l:"Empresas vinculadas",ic:Ic.plant(C.t3,18),c:C.t3});
    if(user.role==="platform_admin"||user.role==="admin") mgmtItems.push({k:"admin",l:"Administración",ic:Ic.shield(C.t3,18),c:C.t3});
    if(!isDesktop) {
      mgmtItems.push({k:"chats",l:"Chat",ic:Ic.msg(C.t3,18),c:C.t3});
      mgmtItems.push({k:"calendar",l:"Calendario",ic:Ic.cal(C.t3,18),c:C.t3});
      mgmtItems.push({k:"reports",l:"Informes",ic:Ic.doc(C.t3,18),c:C.t3});
    }
  }

  const menuItem = (m, i, arr) => (
    <button key={m.k} onClick={()=>onNav(m.k)} aria-label={m.l} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 14px",minHeight:52,background:"none",border:"none",borderTop:i>0?`1px solid ${C.b2}`:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{width:36,height:36,borderRadius:10,background:`${m.c}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{m.ic}</div>
      <span style={{fontSize:15.4,fontWeight:600,color:C.t1}}>{m.l}</span>
      <span style={{marginLeft:"auto",display:"flex"}}>{Ic.chev(C.t3,16)}</span>
    </button>
  );

  const profileSection = (
    <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,boxShadow:C.sh}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}>{Ic.user(C.pri,16)}<span style={{fontSize:11.6,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Mi Perfil</span></div>

      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
        <Av letters={user.av} size={56} color={tc}/>
        <div>
          <div style={{fontSize:17.6,fontWeight:700,color:C.t1}}>{user.name}</div>
          <div style={{fontSize:13.2,color:C.t2,marginTop:2}}>{user.email}</div>
          {user.phone && <div style={{fontSize:12.1,color:C.t3,marginTop:1}}>{user.phone}</div>}
        </div>
      </div>

      {/* Companies */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Empresas</div>

        {isDesktop ? (
        <div style={{border:`1px solid ${C.b2}`,borderRadius:8,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13.2,fontFamily:"inherit"}}>
            <thead>
              <tr style={{background:C.bg,borderBottom:`1.5px solid ${C.b1}`}}>
                <th style={{padding:"7px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.4}}>Empresa</th>
                <th style={{padding:"7px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.4}}>Tipo</th>
                <th style={{padding:"7px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.4}}>Rol</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c,i)=>{
                const isActive = c.companyId === user.activeCompanyId;
                const roleLabel = c.role === "chofer" ? "Chofer" : c.role === "gerente" || c.effectiveRole === "admin" ? "Gerente" : "Operario";
                const isExp = switching === "exp_"+c.companyId;
                return (<Fragment key={c.companyId||i}>
                  <tr onClick={()=>setSwitching(isExp?null:"exp_"+c.companyId)} style={{cursor:"pointer",borderTop:i>0?`1px solid ${C.b2}`:"none",background:isExp?`${C.pri}06`:"transparent",transition:"background 0.15s"}}>
                    <td style={{padding:"8px 10px",fontWeight:600,color:C.t1,fontSize:13.2}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        {companies.length>1 && <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${isActive?C.pri:C.b2}`,background:isActive?C.pri:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}} onClick={e=>{e.stopPropagation();if(!isActive)handleSwitch(c.companyId);}}>{isActive&&<div style={{width:8,height:8,borderRadius:4,background:C.w}}/>}</div>}
                        <span>{c.companyName||user.entity}</span>
                      </div>
                    </td>
                    <td style={{padding:"8px 10px"}}><Bd color={c.color}>{c.label}</Bd></td>
                    <td style={{padding:"8px 10px"}}><Bd color={C.t2} bg={C.bgInput}>{roleLabel}</Bd></td>
                  </tr>
                  {isExp && <tr><td colSpan={3} style={{padding:"6px 10px 10px",background:`${C.pri}04`,borderTop:`1px dashed ${C.b2}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",marginBottom:5}}>Permisos</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {(()=>{
                        const p=[];
                        if(roleLabel==="Gerente"){if(perms.canRequest)p.push("Solicitar fletes");if(perms.canApprove)p.push("Aprobar fletes");if(perms.canAssignDriver)p.push("Asignar choferes");if(perms.canCancel)p.push("Cancelar fletes");if(perms.canReject)p.push("Rechazar viajes");p.push("Ver informes","Administrar empresa");}
                        else{p.push("Ver fletes asignados","Confirmar carga","Confirmar descarga");}
                        return p.map((pp,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:3,fontSize:12.1,color:C.t1,padding:"2px 7px",background:C.w,borderRadius:5,border:`1px solid ${C.b2}`}}>{Ic.chk(C.pri,10)} {pp}</div>);
                      })()}
                    </div>
                  </td></tr>}
                </Fragment>);
              })}
            </tbody>
          </table>
        </div>
        ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {companies.map((c,i)=>{
            const isActive = c.companyId === user.activeCompanyId;
            const roleLabel = c.role === "chofer" ? "Chofer" : c.role === "gerente" || c.effectiveRole === "admin" ? "Gerente" : "Operario";
            const isExp = switching === "exp_"+c.companyId;
            return (<div key={c.companyId||i} style={{border:`1.5px solid ${isActive?C.pri:C.b2}`,borderRadius:10,overflow:"hidden",background:isActive?`${C.pri}04`:C.w,transition:"all 0.15s"}}>
              <button onClick={()=>{if(companies.length>1&&!isActive)handleSwitch(c.companyId);setSwitching(isExp?null:"exp_"+c.companyId);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",minHeight:52,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                {companies.length>1 && <div style={{width:20,height:20,borderRadius:10,border:`2px solid ${isActive?C.pri:C.b2}`,background:isActive?C.pri:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isActive&&<div style={{width:8,height:8,borderRadius:4,background:C.w}}/>}</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14.3,fontWeight:700,color:C.t1}}>{c.companyName||user.entity}</div>
                  <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                    <Bd color={c.color}>{c.label}</Bd>
                    <Bd color={C.t2} bg={C.bgInput}>{roleLabel}</Bd>
                  </div>
                </div>
                <span style={{display:"flex",transform:isExp?"rotate(-90deg)":"rotate(0deg)",transition:"transform 0.15s"}}>{Ic.chev(C.t3,14)}</span>
              </button>
              {isExp && <div style={{padding:"8px 14px 12px",borderTop:`1px dashed ${C.b2}`,background:`${C.pri}04`}}>
                <div style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",marginBottom:5}}>Permisos</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {(()=>{
                    const p=[];
                    if(roleLabel==="Gerente"){if(perms.canRequest)p.push("Solicitar fletes");if(perms.canApprove)p.push("Aprobar fletes");if(perms.canAssignDriver)p.push("Asignar choferes");if(perms.canCancel)p.push("Cancelar fletes");if(perms.canReject)p.push("Rechazar viajes");p.push("Ver informes","Administrar empresa");}
                    else{p.push("Ver fletes asignados","Confirmar carga","Confirmar descarga");}
                    return p.map((pp,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:3,fontSize:12.1,color:C.t1,padding:"2px 7px",background:C.w,borderRadius:5,border:`1px solid ${C.b2}`}}>{Ic.chk(C.pri,10)} {pp}</div>);
                  })()}
                </div>
              </div>}
            </div>);
          })}
        </div>
        )}

        {companies.length>1 && <div style={{fontSize:11,color:C.t3,marginTop:4}}>{isDesktop?"Tocá el círculo para cambiar empresa activa · Tocá la fila para ver permisos":"Tocá una empresa para cambiarla y ver permisos"}</div>}
      </div>

      <button onClick={()=>onNav("mydata")} style={{width:"100%",padding:"12px 16px",minHeight:44,borderRadius:8,border:`1px solid ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:13.2,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        {Ic.edit(C.pri,14)} Administrar mis datos
      </button>
    </div>
  );

  const leftPanel = (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Management items */}
      {mgmtItems.length>0 && (
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:4,boxShadow:C.sh}}>
          {mgmtItems.map((m,i)=>menuItem(m,i,mgmtItems))}
        </div>
      )}

      {/* PWA install banner */}
      {canInstall && (
        <button onClick={() => window.installPWA?.()} style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:`1.5px solid ${C.pri}`, background:C.priPale, color:C.pri, fontSize:14.3, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:C.sh }}>
          {Ic.plus(C.pri, 16)} Instalar Tolvink en tu dispositivo
        </button>
      )}

      <Btn full v="err" onClick={onLogout} icon={Ic.out(C.err,16)}>Cerrar sesión</Btn>
    </div>
  );

  const [showProfile, setShowProfile] = useState(false);

  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      {isDesktop ? (
        <div style={{display:"flex",gap:18,alignItems:"flex-start"}}>
          <div style={{flex:1,minWidth:0}}>{leftPanel}</div>
          <div style={{flex:1,minWidth:0}}>{profileSection}</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Mobile: compact profile header + expandable */}
          <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,overflow:"hidden",boxShadow:C.sh}}>
            <button onClick={()=>setShowProfile(p=>!p)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 14px",minHeight:52,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"background 0.15s"}}>
              <Av letters={user.av} size={36} color={tc}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15.4,fontWeight:700,color:C.t1}}>{user.name}</div>
                <div style={{fontSize:12.1,color:C.t3}}>{user.email}</div>
              </div>
              <span style={{display:"flex",transform:showProfile?"rotate(-90deg)":"rotate(0deg)",transition:"transform 0.15s"}}>{Ic.chev(C.t3,16)}</span>
            </button>
            {showProfile && <div style={{borderTop:`1px solid ${C.b2}`,padding:16}}>{profileSection}</div>}
          </div>
          {leftPanel}
        </div>
      )}
    </div>
  );
}
