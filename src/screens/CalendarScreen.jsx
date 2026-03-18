import { useState, useMemo } from "react";
import { C, Ic, MONO, STATUS_COLORS } from "../theme";
import { stCfg, formatFreightDate } from "../constants";
import { Bd, Btn, FreightCardCompact, CalendarChip } from "../components";
import { originDisplay, destDisplay } from "../hooks";
import { resolveUserTypeForFreight } from "../utils/freight-helpers";
import DetailScreen from "./DetailScreen";

export default function CalendarScreen({ freights, perms, onNav, isDesktop, user, onAction, onTripAction, onEditTrip, actionLoading, onChat, onRefresh, onDuplicate, onEdit, goToMap }) {
  const [selectedId, setSelectedId] = useState(null);
  const selFreightObj = selectedId ? freights.find(f => f.id === selectedId) : null;
  const calDetailUser = selFreightObj ? { ...user, userType: resolveUserTypeForFreight(selFreightObj, user) } : user;
  const [calMonth, setCalMonth] = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()}});
  const [calSelDay, setCalSelDay] = useState(null);
  const [calSelMonth, setCalSelMonth] = useState(null);
  const [fStatus, setFStatus] = useState("");
  const [monthsToShow, setMonthsToShow] = useState(1);

  const STATUS_GROUPS_CAL = { solicitado:["pending_assignment"], en_curso:["assigned","accepted","in_progress","loaded"], finalizados:["finished"], cancelados:["canceled"] };
  const filtered = useMemo(()=>{
    let ff = freights.filter(f=>f.status!=="draft");
    if(fStatus) ff = ff.filter(f=>(STATUS_GROUPS_CAL[fStatus]||[]).includes(f.status));
    return ff;
  },[freights,fStatus]);

  const monNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Pre-index freights by YYYY-MM-DD key once (avoids repeated parseInt per freight per month)
  const freightsByDate = useMemo(()=>{
    const idx={};
    filtered.forEach(f=>{ if(f.loadDate){ if(!idx[f.loadDate])idx[f.loadDate]=[]; idx[f.loadDate].push(f); } });
    return idx;
  },[filtered]);

  const months = useMemo(()=>{
    const result = [];
    for(let i=0;i<monthsToShow;i++){
      let y=calMonth.y, m=calMonth.m+i;
      if(m>11){m-=12;y++;}
      const arr=[];
      const first=new Date(y,m,1);
      const lastDay=new Date(y,m+1,0).getDate();
      const startDow=(first.getDay()+6)%7;
      for(let j=0;j<startDow;j++)arr.push(null);
      for(let d=1;d<=lastDay;d++)arr.push(d);
      const map={};
      for(let d=1;d<=lastDay;d++){
        const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if(freightsByDate[key]) map[d]=freightsByDate[key];
      }
      result.push({y,m,days:arr,byDay:map});
    }
    return result;
  },[calMonth,monthsToShow,freightsByDate]);

  const activeMonth = calSelMonth!==null ? months[calSelMonth] : months[0];
  const selFreights = calSelDay && activeMonth ? (activeMonth.byDay[calSelDay]||[]) : [];
  const today=new Date();
  const totalInMonth = months.reduce((s,mo)=>s+Object.values(mo.byDay).reduce((ss,a)=>ss+a.length,0),0);

  // --- Detail panel (shared between mobile inline and desktop side panel) ---
  const detailPanel = calSelDay ? (
    <div style={{animation:"fadeIn 0.2s ease",padding:isDesktop?"18px 16px":0,overflow:"auto",flex:isDesktop?1:undefined}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:17.6,fontWeight:800,color:C.t1}}>{calSelDay} de {monNames[activeMonth?.m??calMonth.m]}</div>
          <div style={{fontSize:12.1,color:C.t2,marginTop:2}}>{selFreights.length} flete{selFreights.length!==1?"s":""}</div>
        </div>
        {isDesktop&&<button aria-label="Cerrar" onClick={()=>setCalSelDay(null)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:8,borderRadius:8}}>{Ic.cross(C.t3,18)}</button>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {selFreights.length===0&&<div style={{textAlign:"center",padding:30,color:C.t3,fontSize:13.2,background:C.w,borderRadius:10,border:`1px solid ${C.b1}`}}>Sin fletes programados este día</div>}
        {selFreights.map(f=>
          <FreightCardCompact key={f.id} freight={f} onClick={()=>{setSelectedId(f.id);onRefresh(f.id);}} showTime />
        )}
      </div>
    </div>
  ) : isDesktop ? (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.t3,fontSize:14.3,padding:20,textAlign:"center"}}>
      <div>{Ic.cal(C.b1,40)}<div style={{marginTop:8}}>Seleccioná un día para ver los fletes programados</div></div>
    </div>
  ) : null;

  // --- Calendar grid panel ---
  const calendarPanel = (
    <div style={{flex:isDesktop?undefined:1,overflow:"auto",padding:18,minWidth:isDesktop?420:undefined}}>
      {!isDesktop && <button onClick={()=>onNav("home")} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14.3, fontWeight:600, color:C.pri, marginBottom:10, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Inicio</button>}

      {/* Status filter — desktop: pills, mobile: select */}
      {isDesktop ? (
      <div style={{ display:"flex", gap:5, marginBottom:14, flexWrap:"wrap" }}>
        {[{k:"",l:"Todos"},{k:"solicitado",l:"Solicitado"},{k:"en_curso",l:"En curso"},{k:"finalizados",l:"Finalizados"},{k:"cancelados",l:"Cancelados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFStatus(opt.k)} style={{ padding:"4px 10px", borderRadius:20, border:`1.5px solid ${fStatus===opt.k?C.pri:C.b1}`, background:fStatus===opt.k?C.priPale:C.w, color:fStatus===opt.k?C.pri:C.t2, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>{opt.l}</button>
        ))}
      </div>
      ) : (
      <div style={{ marginBottom:14 }}>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:`1.5px solid ${fStatus?C.pri:C.b1}`,background:fStatus?C.priPale:C.w,color:fStatus?C.pri:C.t2,fontSize:12.1,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
          <option value="">Todos los estados</option>
          <option value="solicitado">Solicitado</option>
          <option value="en_curso">En curso</option>
          <option value="finalizados">Finalizados</option>
          <option value="cancelados">Cancelados</option>
        </select>
      </div>
      )}

      {/* Navigation + months toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <button aria-label="Mes anterior" onClick={()=>{setCalMonth(p=>p.m===0?{y:p.y-1,m:11}:{y:p.y,m:p.m-1});setCalSelDay(null);setCalSelMonth(null);}} style={{background:C.priPale,border:`1px solid ${C.pri}20`,borderRadius:8,cursor:"pointer",padding:"10px 12px",display:"flex",alignItems:"center",gap:4,fontSize:12.1,fontWeight:600,color:C.pri,fontFamily:"inherit",minHeight:40}}>{Ic.chev(C.pri,16)} Anterior</button>
        {isDesktop && <div style={{display:"flex",gap:4}}>
          {[1,3,6].map(n=><button key={n} onClick={()=>setMonthsToShow(n)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${monthsToShow===n?C.pri:C.b1}`,background:monthsToShow===n?C.priPale:C.w,color:monthsToShow===n?C.pri:C.t2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{n} mes{n>1?"es":""}</button>)}
        </div>}
        <button aria-label="Mes siguiente" onClick={()=>{setCalMonth(p=>p.m===11?{y:p.y+1,m:0}:{y:p.y,m:p.m+1});setCalSelDay(null);setCalSelMonth(null);}} style={{background:C.priPale,border:`1px solid ${C.pri}20`,borderRadius:8,cursor:"pointer",padding:"10px 12px",display:"flex",alignItems:"center",gap:4,fontSize:12.1,fontWeight:600,color:C.pri,fontFamily:"inherit",minHeight:40}}>Siguiente <span style={{display:"inline-flex",transform:"rotate(180deg)"}}>{Ic.chev(C.pri,16)}</span></button>
      </div>

      {/* Calendar grids */}
      <div style={{display:"grid",gridTemplateColumns:monthsToShow===1?"1fr":isDesktop&&monthsToShow>=3?"1fr 1fr 1fr":monthsToShow>=3?"1fr":"1fr 1fr",gap:12,marginBottom:isDesktop?0:14}}>
        {months.map((mo,mi)=>{
          const isTodayMonth = mo.m===today.getMonth()&&mo.y===today.getFullYear();
          const moCount = Object.values(mo.byDay).reduce((s,a)=>s+a.length,0);
          return <div key={`${mo.y}-${mo.m}`} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:monthsToShow===1?16:12,boxShadow:C.sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:monthsToShow===1?18.7:15.4,fontWeight:700,color:isTodayMonth?C.pri:C.t1}}>{monNames[mo.m]} {mo.y}</span>
              {moCount>0&&<span style={{fontSize:9.9,color:C.t3,fontWeight:600}}>{moCount}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:monthsToShow===1?3:2,textAlign:"center"}}>
              {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{fontSize:monthsToShow===1?11:8.8,fontWeight:700,color:C.t3,padding:monthsToShow===1?6:3}}>{d}</div>)}
              {mo.days.map((d,i)=>{
                if(!d)return<div key={`e${i}`}/>;
                const cnt=mo.byDay[d]?.length||0;
                const sel=calSelDay===d&&calSelMonth===mi;
                const td=d===today.getDate()&&isTodayMonth;
                const dayFreights=mo.byDay[d]||[];
                const hasPending=dayFreights.some(f=>f.status==="pending_assignment");
                const densityAlpha=cnt===0?0:Math.min(0.15,0.04*cnt);
                const densityBg=sel?C.pri:td?C.priPale:cnt>0?`rgba(26,107,55,${densityAlpha})`:"transparent";
                const isSingle=monthsToShow===1;
                return <div key={d} role="button" tabIndex={0} aria-label={`${d} de ${monNames[mo.m]}, ${cnt} flete${cnt!==1?"s":""}`} onClick={()=>{setCalSelDay(sel?null:d);setCalSelMonth(sel?null:mi);setSelectedId(null);}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setCalSelDay(sel?null:d);setCalSelMonth(sel?null:mi);setSelectedId(null);}}} style={{padding:isSingle?"6px 3px":"4px 2px",borderRadius:isSingle?10:6,cursor:"pointer",background:densityBg,border:td&&!sel?`1.5px solid #1A6B37`:"1.5px solid transparent",transition:"all 0.15s",minHeight:isSingle?52:36,position:"relative"}}>
                  <div style={{fontSize:isSingle?14:12.1,fontWeight:sel||td?700:400,color:sel?C.w:td?C.pri:C.t1}}>{d}</div>
                  {hasPending&&!sel&&<div style={{position:"absolute",top:isSingle?4:2,right:isSingle?4:2,width:5,height:5,borderRadius:3,background:STATUS_COLORS.pending_assignment.ribbon}}/>}
                  {cnt>0&&isSingle&&!sel&&<div style={{display:"flex",flexDirection:"column",gap:1,marginTop:2}}>
                    {dayFreights.slice(0,2).map((f,j)=><CalendarChip key={j} freight={f}/>)}
                    {cnt>2&&<div style={{fontSize:7.7,color:C.t3,textAlign:"center",lineHeight:1}}>+{cnt-2}</div>}
                  </div>}
                  {cnt>0&&(!isSingle||sel)&&<div style={{display:"flex",gap:1,justifyContent:"center",marginTop:2,flexWrap:"wrap"}}>
                    {dayFreights.slice(0,isSingle?4:2).map((f,j)=><div key={j} style={{width:isSingle?6:4,height:isSingle?6:4,borderRadius:3,background:sel?C.w:(STATUS_COLORS[f.status]||STATUS_COLORS.pending_assignment).ribbon}}/>)}
                    {cnt>(isSingle?4:2)&&<div style={{fontSize:7.7,color:sel?C.w:C.t3,lineHeight:1}}>+{cnt-(isSingle?4:2)}</div>}
                  </div>}
                </div>;
              })}
            </div>
          </div>;
        })}
      </div>

      {/* Mobile: inline detail below calendar */}
      {!isDesktop && detailPanel}
    </div>
  );

  // --- Desktop: split layout (calendar left, detail right) ---
  if (isDesktop) {
    if (selFreightObj) {
      // Freight selected: same layout as HomeScreen (calendar compressed, detail fills rest)
      return (
        <div style={{flex:1,position:"relative"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",flexDirection:"row"}}>
            <div style={{overflow:"auto",minWidth:380}}>
              {calendarPanel}
            </div>
            <DetailScreen user={calDetailUser} freight={selFreightObj} perms={perms} onBack={()=>setSelectedId(null)} onAction={onAction} onTripAction={onTripAction} onEditTrip={onEditTrip} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} goToMap={goToMap} />
          </div>
        </div>
      );
    }
    const rightPanel = calSelDay ? (
      <div style={{width:380,minWidth:380,borderLeft:`1px solid ${C.b2}`,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg,animation:"fadeIn 0.2s ease"}}>
        {detailPanel}
      </div>
    ) : null;
    return (
      <div style={{flex:1,display:"flex",flexDirection:"row",overflow:"hidden"}}>
        <div style={{flex:1,overflow:"auto"}}>
          {calendarPanel}
        </div>
        {rightPanel}
      </div>
    );
  }

  // --- Mobile: fullscreen detail or calendar ---
  if (selFreightObj) {
    return <DetailScreen user={calDetailUser} freight={selFreightObj} perms={perms} onBack={()=>setSelectedId(null)} onAction={onAction} onTripAction={onTripAction} onEditTrip={onEditTrip} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} goToMap={goToMap} />;
  }
  return calendarPanel;
}
