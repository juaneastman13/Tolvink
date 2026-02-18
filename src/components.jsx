import { useState, useEffect, useRef, memo, useMemo } from "react";
import { C, Ic } from "./theme";
import { stCfg } from "./constants";

// ======================== BASE COMPONENTS ============================

export const Av = memo(function Av({ letters, size=36, color=C.pri }) {
  return <div style={{ width:size, height:size, borderRadius:size, display:"flex", alignItems:"center", justifyContent:"center", background:`${color}12`, color, fontSize:size*0.36, fontWeight:700, letterSpacing:0.5, flexShrink:0, border:`1.5px solid ${color}22` }}>{letters}</div>;
});

export const Bd = memo(function Bd({ children, color=C.pri, bg, small }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:small?"2px 7px":"4px 10px", borderRadius:6, fontSize:small?9.5:10.5, fontWeight:600, background:bg||`${color}0D`, color, whiteSpace:"nowrap", letterSpacing:0.2 }}>{children}</span>;
});

export const Btn = memo(function Btn({ children, onClick, v="pri", full, sm, icon, disabled, style={} }) {
  const vs = {
    pri:  { bg:C.pri, c:C.w, hbg:C.priLt },
    sec:  { bg:C.w,   c:C.pri, bd:C.b1 },
    err:  { bg:C.errPale, c:C.err },
    ghost:{ bg:"transparent", c:C.t2 },
    acc:  { bg:C.acc, c:C.w, hbg:C.accLt },
  };
  const vv = vs[v] || vs.pri;
  return <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, padding:sm?"8px 14px":"13px 22px", borderRadius:10, fontSize:sm?12:13.5, fontWeight:600, fontFamily:"inherit", background:disabled?"#E8ECE9":vv.bg, color:disabled?C.t3:vv.c, border:vv.bd?`1px solid ${vv.bd}`:"none", cursor:disabled?"not-allowed":"pointer", width:full?"100%":"auto", transition:"all 0.2s ease", minHeight:sm?36:44, WebkitTapHighlightColor:"transparent", touchAction:"manipulation", ...style }} onMouseEnter={e=>{if(!disabled&&vv.hbg)e.currentTarget.style.background=vv.hbg}} onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=disabled?"#E8ECE9":vv.bg}}>{icon&&<span style={{display:"flex",alignItems:"center"}}>{icon}</span>}{children}</button>;
});

export const Tabs = memo(function Tabs({ items, active, onChange }) {
  return <div style={{ display:"flex", gap:2, background:C.bgInput, borderRadius:10, padding:3 }}>{items.map(t=><button key={t.k} onClick={()=>onChange(t.k)} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:"none", fontFamily:"inherit", fontSize:11, fontWeight:active===t.k?700:500, cursor:"pointer", background:active===t.k?C.w:"transparent", color:active===t.k?C.pri:C.t3, boxShadow:active===t.k?C.sh:"none", transition:"all 0.15s" }}>{t.l}</button>)}</div>;
});

export function Field({ label, icon, value, onChange, placeholder, type="text", children, hasError, onKeyDown }) {
  const [showPw, setShowPw] = useState(false);
  const isPw = type === "password";
  const borderColor = hasError ? C.err : C.b1;
  const labelColor = hasError ? C.err : C.t2;
  if (children) return <div>{label && <label style={{ fontSize:10.5, fontWeight:600, color:labelColor, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}{children}</div>;
  return (
    <div>
      {label && <label style={{ fontSize:10.5, fontWeight:600, color:labelColor, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <div style={{ position:"relative" }}>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={isPw&&!showPw?"password":"text"} onKeyDown={onKeyDown}
          style={{ width:"100%", padding:"12px 14px", paddingRight:isPw?42:14, borderRadius:10, border:`1.5px solid ${borderColor}`, background:hasError?C.errPale+"40":C.w, color:C.t1, fontSize:16, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
          onFocus={e=>{e.target.style.borderColor=hasError?C.err:C.bFocus;}} onBlur={e=>{e.target.style.borderColor=borderColor;}} />
        {isPw && <button onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", display:"flex", padding:4 }}>{showPw?Ic.eye(C.t3,18):Ic.eyeOff(C.t3,18)}</button>}
      </div>
    </div>
  );
}

export function Select({ label, icon, value, onChange, options, placeholder="Seleccionar..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);
  useEffect(()=>{
    if(!open) return;
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  },[open]);
  useEffect(()=>{
    if(open && listRef.current && value) {
      const el = listRef.current.querySelector(`[data-val="${value}"]`);
      if(el) el.scrollIntoView({ block:"nearest" });
    }
  },[open, value]);
  const sel = options.find(o=>o.value===value);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      {label && <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <button type="button" onClick={()=>setOpen(!open)} style={{ width:"100%", padding:"12px 14px", paddingRight:36, borderRadius:10, border:`1.5px solid ${open?C.bFocus:C.b1}`, background:C.w, color:sel?C.t1:C.t3, fontSize:15, fontFamily:"inherit", cursor:"pointer", boxSizing:"border-box", minHeight:44, outline:"none", textAlign:"left", display:"flex", alignItems:"center", transition:"border-color 0.15s" }}>
        {sel ? <>{sel.label}{sel.sub && <span style={{ color:C.t3, fontWeight:400 }}>&nbsp;— {sel.sub}</span>}</> : placeholder}
      </button>
      <div style={{ position:"absolute", right:12, top:label?`calc(50% + 11px)`:"50%", transform:`translateY(-50%) rotate(${open?180:0}deg)`, pointerEvents:"none", display:"flex", transition:"transform 0.2s" }}>{Ic.down(open?C.bFocus:C.t3,16)}</div>
      {open && <div ref={listRef} style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:C.w, border:`1.5px solid ${C.b1}`, borderRadius:12, boxShadow:C.shMd, maxHeight:240, overflowY:"auto", zIndex:50, padding:4 }}>
        {options.length===0 && <div style={{ padding:"14px 12px", fontSize:13, color:C.t3, textAlign:"center" }}>Sin opciones</div>}
        {options.map((o,i)=>{
          const active = o.value===value;
          return <button key={o.value} data-val={o.value} type="button" onClick={()=>{onChange(o.value);setOpen(false);}} className="tv-sel-opt" style={{ width:"100%", padding:"11px 14px", background:active?C.priPale:"transparent", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:active?600:400, color:active?C.pri:C.t1, textAlign:"left", display:"flex", alignItems:"center", gap:8, transition:"background 0.12s", marginBottom:i<options.length-1?2:0 }}>
            <span style={{ flex:1 }}>{o.label}{o.sub && <span style={{ fontSize:12, color:active?C.pri:C.t3, fontWeight:400 }}> — {o.sub}</span>}</span>
            {active && Ic.chk(C.pri,15)}
          </button>;
        })}
      </div>}
    </div>
  );
}

// Collapsible form section — defined at module level for stable React identity
export function Sec({ label, complete, summary, children, isExpanded, onFocus, secRef, incomplete, highlight, disabled }) {
  const [showWarn, setShowWarn] = useState(false);
  const hl = !complete && !incomplete && highlight;
  const handleClick = () => {
    if (disabled) { setShowWarn(true); setTimeout(()=>setShowWarn(false),2000); return; }
    onFocus();
  };
  return (
    <div ref={secRef} style={{ transition:"all 0.3s ease" }}>
      {!isExpanded ? (
        <>
          <button type="button" onClick={handleClick} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:12, border:`1.5px solid ${complete?C.ok+'40':(incomplete||hl)?C.acc+'60':C.b1}`, background:complete?`${C.ok}08`:(incomplete||hl)?`${C.acc}08`:C.w, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, fontFamily:"inherit", textAlign:"left", transition:"all 0.2s ease" }} tabIndex={0}>
            {complete ? Ic.chk(C.ok,16) : (incomplete||hl) ? <span style={{width:10,height:10,borderRadius:5,background:C.acc,display:"inline-block",animation:"dotPulse 1.5s ease-in-out infinite",flexShrink:0}}/> : <span style={{width:10,height:10,borderRadius:5,border:`2px solid ${C.b1}`,display:"inline-block",flexShrink:0}}/>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, fontWeight:700, color:complete?C.ok:(incomplete||hl)?C.acc:C.t3, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
              {complete && summary && <div style={{ fontSize:12, fontWeight:600, color:C.t1, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{summary}</div>}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" style={{flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showWarn && <div style={{marginTop:6,padding:"6px 12px",borderRadius:8,background:C.acc+'18',border:`1px solid ${C.acc}40`,fontSize:11,fontWeight:600,color:C.acc,display:"flex",alignItems:"center",gap:6,animation:"fadeIn 0.2s ease"}}>{Ic.warn(C.acc,14)} Completá los campos anteriores primero</div>}
        </>
      ) : (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.pri,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:4,background:C.pri,display:"inline-block"}}/>{label}</div>
          {children}
        </div>
      )}
    </div>
  );
}

export function Toast({ msg, type="ok", onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[onClose]);
  const cfg = { ok:{bg:C.pri,ic:Ic.chk(C.w,16)}, err:{bg:C.err,ic:Ic.warn(C.w,16)}, info:{bg:C.info,ic:Ic.bell(C.w,16)} }[type]||{bg:C.pri,ic:Ic.chk(C.w,16)};
  return <div style={{ position:"fixed", top:"max(20px, env(safe-area-inset-top))", left:"50%", transform:"translateX(-50%)", zIndex:200, background:cfg.bg, color:C.w, padding:"11px 22px", borderRadius:12, fontSize:13, fontWeight:600, boxShadow:C.shLg, display:"flex", alignItems:"center", gap:8, animation:"fadeIn 0.3s ease", maxWidth:"calc(100vw - 40px)" }}>{cfg.ic} {msg}</div>;
}

export const Loader = memo(function Loader() {
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:12 }}>
    <span style={{ width:14, height:14, borderRadius:7, background:C.acc, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }}></span>
  </div>;
});

export function LoadingOverlay({ closing=false, closingText="", onClose }) {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const t1 = setTimeout(() => setFading(true), 1600);
    const t2 = setTimeout(() => { if (onClose) onClose(); }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [closing]);
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:250,animation:fading?"moOutroFade 0.4s ease forwards":"moFadeIn 0.2s ease"}}>
      <style>{`@keyframes moFadeIn{from{opacity:0}to{opacity:1}}@keyframes moLogoIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}@keyframes moCircleIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}@keyframes moOutroFade{to{opacity:0}}`}</style>
      {!closing && (
        <div style={{display:"flex",alignItems:"flex-start",animation:"moLogoIn 0.35s ease-out"}}>
          <span style={{fontSize:57,fontWeight:800,color:C.pri,letterSpacing:-2.5,lineHeight:1}}>tolvink</span>
          <span style={{width:17,height:17,borderRadius:9,background:C.acc,marginLeft:5,marginTop:3,display:"inline-block",animation:"dotPulse 1.5s ease-in-out infinite"}} />
        </div>
      )}
      {closing && (
        <div style={{width:150,height:150,borderRadius:"50%",background:C.acc,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,animation:"moCircleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",pointerEvents:"none"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {closingText && <span style={{color:"#fff",fontSize:14,fontWeight:700,textAlign:"center",lineHeight:1.3,padding:"0 16px"}}>{closingText}</span>}
        </div>
      )}
    </div>
  );
}

// ======================== SORT TABLE HEADER ===========================

export function SortTh({ label, colKey, sortCol, sortDir, onSort }) {
  const active = sortCol === colKey;
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th onClick={() => onSort(colKey)} style={{ padding:"9px 10px", textAlign:"left", fontWeight:700, color: active ? C.pri : C.t2, fontSize:10, whiteSpace:"nowrap", borderBottom:`1px solid ${C.b1}`, cursor:"pointer", userSelect:"none", textTransform:"uppercase", letterSpacing:0.5 }}>
      {label}{arrow && <span style={{ color: C.pri, fontWeight: 800 }}>{arrow}</span>}
    </th>
  );
}

// ======================== MODAL OVERLAY (animated logo → card) ========

export function ModalOverlay({ children, onClose, maxWidth=400, loading=false, closing=false, closingText="" }) {
  const [stage, setStage] = useState(0);
  const [fading, setFading] = useState(false);

  // Intro stages (logo → text collapse → dot grow → card)
  useEffect(() => {
    if (loading || closing) return;
    const t1 = setTimeout(() => setStage(1), 500);
    const t2 = setTimeout(() => setStage(2), 1050);
    const t3 = setTimeout(() => setStage(3), 1750);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [loading, closing]);

  useEffect(() => { if (loading) setStage(0); }, [loading]);

  // Outro: show result circle → hold 0.5s → fade → close
  useEffect(() => {
    if (!closing) return;
    const t1 = setTimeout(() => setFading(true), 1600);
    const t2 = setTimeout(() => { if (onClose) onClose(); }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [closing]);

  const showIntro = !loading && !closing && stage < 3;
  const showCard = !loading && !closing && stage === 3;
  const showLoading = loading && !closing;

  return (
    <div onClick={showCard ? onClose : undefined} style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24,animation:fading ? "moOutroFade 0.4s ease forwards" : "moFadeIn 0.25s ease"}}>
      <style>{`
@keyframes moFadeIn{from{opacity:0}to{opacity:1}}
@keyframes moLogoIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
@keyframes moTextOut{0%{opacity:1;max-width:200px;margin-right:4px}40%{opacity:0;max-width:200px;margin-right:4px}100%{opacity:0;max-width:0;margin-right:0;overflow:hidden}}
@keyframes moDotGrow{0%{transform:scale(1);opacity:1}60%{transform:scale(25);opacity:0.5}100%{transform:scale(50);opacity:0}}
@keyframes moCardIn{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}
@keyframes moCircleIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes moOutroFade{to{opacity:0}}
      `}</style>
      {/* Loading: full logo with pulsing dot */}
      {showLoading && (
        <div style={{position:"absolute",display:"flex",alignItems:"flex-start",animation:"moLogoIn 0.35s ease-out",pointerEvents:"none"}}>
          <span style={{fontSize:57,fontWeight:800,color:C.pri,letterSpacing:-2.5,lineHeight:1}}>tolvink</span>
          <span style={{width:17,height:17,borderRadius:9,background:C.acc,marginLeft:5,marginTop:3,display:"inline-block",animation:"dotPulse 1.5s ease-in-out infinite"}} />
        </div>
      )}
      {/* Intro: staged animation */}
      {showIntro && (
        <div style={{position:"absolute",display:"flex",alignItems:"center",justifyContent:"center",animation:stage===0?"moLogoIn 0.35s ease-out forwards":"none",pointerEvents:"none"}}>
          {stage < 2 && (
            <span style={{fontSize:57,fontWeight:800,color:C.pri,letterSpacing:-2.5,lineHeight:1,display:"inline-block",overflow:"hidden",whiteSpace:"nowrap",marginRight:5,animation:stage===1?"moTextOut 0.55s ease forwards":"none"}}>tolvink</span>
          )}
          <span style={{width:17,height:17,borderRadius:9,background:C.acc,display:"inline-block",animation:stage===2?"moDotGrow 0.7s ease forwards":"dotPulse 1.5s ease-in-out infinite"}} />
        </div>
      )}
      {/* Outro: orange circle with result text */}
      {closing && (
        <div style={{width:150,height:150,borderRadius:"50%",background:C.acc,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,animation:"moCircleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",pointerEvents:"none"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {closingText && (
            <span style={{color:"#fff",fontSize:14,fontWeight:700,textAlign:"center",lineHeight:1.3,padding:"0 16px"}}>{closingText}</span>
          )}
        </div>
      )}
      {/* Card */}
      {showCard && (
        <div onClick={e=>e.stopPropagation()} style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth,boxShadow:C.shLg,animation:"moCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>
          {children}
        </div>
      )}
    </div>
  );
}

// ======================== ATTACH MENU (action sheet) ==================

export function AttachMenu({ open, onClose, onCamera, onGallery, onFiles }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:C.bgOverlay, zIndex:200, animation:"fadeIn 0.15s ease" }} />
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:201, background:C.w, borderRadius:"18px 18px 0 0", padding:"8px 16px max(16px, env(safe-area-inset-bottom))", boxShadow:"0 -4px 24px rgba(0,0,0,0.12)", animation:"sheetUp 0.2s ease" }}>
        <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        <div style={{ width:36, height:4, borderRadius:2, background:C.b1, margin:"0 auto 12px" }} />
        <div style={{ fontSize:13, fontWeight:700, color:C.t1, marginBottom:12, textAlign:"center" }}>Adjuntar</div>
        {[
          { icon:Ic.cam(C.acc,22), label:"Tomar foto", sub:"Usar cámara del dispositivo", action:onCamera },
          { icon:Ic.img(C.pri,22), label:"Galería", sub:"Seleccionar de imágenes", action:onGallery },
          { icon:Ic.doc(C.info,22), label:"Archivo", sub:"PDF, DOC, imágenes y más", action:onFiles },
        ].map((opt,i) => (
          <button key={i} onClick={()=>{opt.action();onClose();}} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"14px 12px", border:"none", borderRadius:12, background:"none", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{opt.icon}</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.t1 }}>{opt.label}</div>
              <div style={{ fontSize:11, color:C.t3, marginTop:1 }}>{opt.sub}</div>
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{ width:"100%", padding:"13px 0", marginTop:4, border:"none", borderRadius:12, background:C.bg, fontSize:14, fontWeight:600, color:C.t2, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
      </div>
    </>
  );
}

// ======================== DESKTOP SIDEBAR =============================

export function Sidebar({ active, onChange, unread=0, pendingCount=0, notifCount=0, canRequest=false, onNew }) {
  const hasPending = pendingCount > 0;
  const centerColor = hasPending ? C.acc : C.ok;
  const items = [
    { k:"home",    ic:a=>Ic.home(a?C.pri:C.t3,20),  l:"Inicio" },
    { k:"list",    ic:a=>Ic.truck(a?C.pri:C.t3,20),  l:"Fletes" },
    { k:"chats",   ic:a=>Ic.msg(a?C.pri:C.t3,20),    l:"Chat", bd:unread },
    { k:"notifs",  ic:a=>Ic.bell(a?C.pri:C.t3,20),   l:"Notificaciones", bd:notifCount },
    { k:"calendar",ic:a=>Ic.cal(a?C.pri:C.t3,20),    l:"Calendario" },
    { k:"reports", ic:a=>Ic.doc(a?C.pri:C.t3,20),    l:"Informes" },
    { k:"menu",    ic:a=>Ic.menu3(a?C.pri:C.t3,20),   l:"Menú" },
  ];
  return (
    <div style={{ width:220, minWidth:220, height:"100%", background:C.w, borderRight:`1px solid ${C.b2}`, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
      {/* Logo */}
      <div style={{ padding:"10px 20px 8px", borderBottom:`1px solid ${C.b2}` }}>
        <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
          <span style={{ fontSize:63, fontWeight:800, color:C.pri, letterSpacing:-2.8, lineHeight:1 }}>tolvink</span>
          <span style={{ width:15, height:15, borderRadius:8, background:C.acc, display:"inline-block", marginLeft:4, marginTop:3, animation:"dotPulse 1.5s ease-in-out infinite" }}></span>
        </div>
      </div>

      {/* Solicitar */}
      {canRequest && (
        <div style={{ padding:"14px 14px 10px" }}>
          <button onClick={onNew} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 14px", borderRadius:12, background:C.acc, border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${C.acc}30`, transition:"transform 0.15s, box-shadow 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 12px ${C.acc}40`}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 2px 8px ${C.acc}30`}}>
            <style>{`@keyframes truckDrive{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}`}</style>
            <span style={{ display:"inline-flex", animation:"truckDrive 1.5s ease-in-out infinite" }}>{Ic.truck("#fff",16)}</span>
            <span style={{ fontSize:12.5, fontWeight:700, color:"#fff" }}>Solicitar flete</span>
          </button>
        </div>
      )}

      {/* Nav items */}
      <div style={{ flex:1, padding:"4px 8px", display:"flex", flexDirection:"column", gap:2 }}>
        {items.map(it => {
          const isActive = active === it.k;
          return (
            <button key={it.k} onClick={()=>onChange(it.k)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:"none", background:isActive?C.priPale:"transparent", cursor:"pointer", fontFamily:"inherit", position:"relative", transition:"background 0.15s", width:"100%" }} onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=C.priGhost}} onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background="transparent"}}>
              <span style={{display:"flex"}}>{it.ic(isActive)}</span>
              <span style={{ fontSize:13, fontWeight:isActive?700:500, color:isActive?C.pri:C.t2 }}>{it.l}</span>
              {it.bd>0 && <div style={{ marginLeft:"auto", minWidth:18, height:18, borderRadius:9, background:C.err, color:C.w, fontSize:9, fontWeight:700, padding:"0 5px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
              {isActive && <div style={{ position:"absolute", left:0, top:"20%", bottom:"20%", width:3, borderRadius:2, background:C.pri }} />}
            </button>
          );
        })}
      </div>

      {/* Bottom brand */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.b2}`, fontSize:10, fontWeight:500, letterSpacing:0.3, color:C.t3, textAlign:"center" }}>
        Gestión de Fletes · v4.1
      </div>
    </div>
  );
}

// ======================== BOTTOM NAV =================================

export function Nav({ active, onChange, unread=0, pendingCount=0, notifCount=0, canRequest=false, onNew }) {
  const hasPending = pendingCount > 0;
  const centerColor = hasPending ? C.acc : C.ok;
  const items = [
    { k:"home",     ic:a=>Ic.home(a?C.pri:C.t3,20),  l:"Inicio" },
    { k:"list",     ic:a=>Ic.truck(a?C.pri:C.t3,20),  l:"Fletes" },
    { k:"home",  sp:true, bd:pendingCount },
    { k:"chats",    ic:a=>Ic.msg(a?C.pri:C.t3,20),    l:"Chat", bd:unread },
    { k:"menu",     ic:a=>Ic.menu3(a?C.pri:C.t3,20),  l:"Menú", bd:notifCount },
  ];
  return (
    <div style={{ display:"flex", borderTop:`1px solid ${C.b1}`, background:C.nav, paddingTop:2, paddingBottom:"max(4px, env(safe-area-inset-bottom))", flexShrink:0 }}>
      <style>{`@keyframes truckDrive{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}`}</style>
      {items.map(it=>(
        <button key={it.k} onClick={()=>onChange(it.k)} style={{ flex:it.sp&&canRequest?1.6:1, display:"flex", flexDirection:"column", alignItems:"center", gap:1, border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", position:"relative", padding:it.sp?"0":"5px 0", minHeight:42, WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
          {it.sp ? <>
            <div onClick={e=>{e.stopPropagation();onChange("home")}} style={{ width:40, height:40, borderRadius:20, background:centerColor, display:"flex", alignItems:"center", justifyContent:"center", marginTop:-16, boxShadow:`0 3px 12px ${centerColor}40`, position:"relative", transition:"background 0.5s ease, box-shadow 0.5s ease" }}>
              {hasPending ? Ic.clk(C.w,18) : Ic.chk(C.w,18)}
              {it.bd>0 && <div style={{ position:"absolute", top:-4, right:-4, minWidth:16, height:16, borderRadius:8, background:C.err, color:C.w, fontSize:8, fontWeight:700, padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.nav}` }}>{it.bd}</div>}
            </div>
            <span style={{ fontSize:7.5, fontWeight:700, color:centerColor, marginTop:1, transition:"color 0.5s ease" }}>{hasPending?"Pendientes":"Al día"}</span>
            {canRequest && (
              <div onClick={e=>{e.stopPropagation();onNew();}} style={{ display:"flex", alignItems:"center", gap:5, marginTop:2, padding:"6px 14px", borderRadius:20, background:C.acc, cursor:"pointer", boxShadow:`0 2px 8px ${C.acc}40` }}>
                <span style={{ display:"inline-flex", animation:"truckDrive 1.5s ease-in-out infinite" }}>{Ic.truck("#fff",15)}</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#fff", whiteSpace:"nowrap" }}>Solicitar flete</span>
              </div>
            )}
          </> : <>
            <span style={{display:"flex"}}>{it.ic(active===it.k)}</span>
            <span style={{ fontSize:9, fontWeight:active===it.k?700:500, color:active===it.k?C.pri:C.t3 }}>{it.l}</span>
            {it.bd>0 && <div style={{ position:"absolute", top:1, right:"20%", minWidth:14, height:14, borderRadius:7, background:C.err, color:C.w, fontSize:8, fontWeight:700, padding:"0 3px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
          </>}
        </button>
      ))}
    </div>
  );
}

// ======================== NOTIFICATIONS PANEL ========================

const NOTIF_ICONS = {
  freight_created: (s) => Ic.truck(C.pri, s),
  freight_assigned: (s) => Ic.truck(C.info, s),
  freight_accepted: (s) => Ic.chk(C.ok, s),
  freight_rejected: (s) => Ic.ban(C.err, s),
  freight_started: (s) => Ic.nav(C.info, s),
  freight_loaded: (s) => Ic.truck(C.ok, s),
  freight_finished: (s) => Ic.chk(C.ok, s),
  freight_cancelled: (s) => Ic.ban(C.err, s),
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}sem`;
}

export function NotificationsPanel({ open, onClose, notifications=[], onMarkRead, onMarkAllRead, onTap }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    const tid = setTimeout(() => document.addEventListener("click", handleClick), 10);
    return () => { clearTimeout(tid); document.removeEventListener("click", handleClick); };
  }, [open, onClose]);

  const { unread, read } = useMemo(() => {
    const u = [], r = [];
    notifications.forEach(n => (n.read ? r : u).push(n));
    return { unread: u, read: r };
  }, [notifications]);

  if (!open) return null;

  return (
    <div ref={panelRef} style={{
      position:"absolute", top:"100%", right:0, marginTop:8, width:360, maxWidth:"calc(100vw - 24px)",
      background:C.w, borderRadius:16, boxShadow:C.shLg, border:`1px solid ${C.b2}`,
      zIndex:150, overflow:"hidden", animation:"fadeIn 0.2s ease"
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px 12px" }}>
        <span style={{ fontSize:16, fontWeight:700, color:C.t1 }}>Notificaciones</span>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} style={{ border:"none", background:"none", cursor:"pointer", fontSize:12, fontWeight:600, color:C.pri, fontFamily:"inherit", padding:"4px 8px", borderRadius:6 }}
            onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="none"}>
            Marcar todas leídas
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight:420, overflowY:"auto", overscrollBehavior:"contain" }}>
        {notifications.length === 0 && (
          <div style={{ padding:"40px 20px", textAlign:"center" }}>
            <div style={{ marginBottom:8 }}>{Ic.bell(C.b1, 36)}</div>
            <div style={{ fontSize:13, fontWeight:600, color:C.t3 }}>Sin notificaciones</div>
            <div style={{ fontSize:11, color:C.t3, marginTop:4 }}>Las novedades de tus fletes aparecerán aquí</div>
          </div>
        )}

        {notifications.map(n => {
          const icFn = NOTIF_ICONS[n.type] || ((s) => Ic.bell(C.t3, s));
          return (
            <button key={n.id} onClick={() => { if (!n.read) onMarkRead(n.id); if (n.entityId) onTap(n.entityId); onClose(); }}
              style={{
                display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 16px",
                border:"none", background: n.read ? "none" : C.priGhost, cursor:"pointer",
                fontFamily:"inherit", textAlign:"left", borderBottom:`1px solid ${C.b2}`,
                WebkitTapHighlightColor:"transparent", touchAction:"manipulation", transition:"background 0.15s"
              }}
              onMouseEnter={e=>e.currentTarget.style.background=n.read?C.bg:C.priPale}
              onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":C.priGhost}>

              {/* Icon */}
              <div style={{ width:28, height:28, borderRadius:8, background: n.read ? C.bg : C.priPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {icFn(14)}
              </div>

              {/* Content — 2 lines max */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                  <span style={{ fontSize:12.5, fontWeight: n.read ? 500 : 700, color: n.read ? C.t2 : C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:0 }}>{n.title}</span>
                  <span style={{ fontSize:10, color:C.t3, fontWeight:500, whiteSpace:"nowrap", flexShrink:0 }}>{timeAgo(n.createdAt)}</span>
                </div>
                <div style={{ fontSize:11, color:C.t3, lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{n.body}</div>
              </div>

              {/* Unread dot */}
              {!n.read && <div style={{ width:7, height:7, borderRadius:4, background:C.pri, flexShrink:0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ======================== NOTIFICATION BELL ===========================

export function NotifBell({ count=0, onClick }) {
  return (
    <button onClick={onClick} style={{ position:"relative", border:"none", background:"none", cursor:"pointer", padding:6, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}
      onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="none"}>
      {Ic.bell(C.t2, 22)}
      {count > 0 && (
        <div style={{ position:"absolute", top:2, right:2, minWidth:16, height:16, borderRadius:8, background:C.err, color:C.w, fontSize:9, fontWeight:700, padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.w}`, lineHeight:1 }}>
          {count > 99 ? "99+" : count}
        </div>
      )}
    </button>
  );
}

// ======================== FILE VIEWER (in-app) =======================

export function FileViewer({ file, onClose }) {
  if (!file) return null;
  const isImg = file.type === "image" || file.type === "photo" || file.url?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  const isPdf = file.url?.match(/\.pdf$/i);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:250, animation:"fvFadeIn 0.2s ease", padding:16 }}>
      <style>{`@keyframes fvFadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,0.3)", display:"flex", flexDirection:"column", maxWidth:"92vw", maxHeight:"90vh", width: isImg ? "auto" : "90vw", overflow:"hidden" }}>
        {/* Header with close */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:`1px solid ${C.b2}`, flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:10 }}>{file.name||"Archivo"}</div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            <a href={file.url} download style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.bg, color:C.t1, textDecoration:"none", fontSize:11, fontWeight:600, fontFamily:"inherit" }} onClick={e=>e.stopPropagation()}>{Ic.down(C.t2,13)} Descargar</a>
            <button onClick={onClose} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:8, background:C.err, border:"none", cursor:"pointer", color:"#fff", fontSize:11, fontWeight:700, fontFamily:"inherit" }}>{Ic.cross("#fff",14)} Cerrar</button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", overflow:"auto", padding:12, minHeight:200 }}>
          {isImg ? (
            <img src={file.url} alt={file.name||""} style={{ maxWidth:"100%", maxHeight:"75vh", objectFit:"contain", borderRadius:6 }} />
          ) : isPdf ? (
            <iframe src={file.url} title={file.name||"PDF"} style={{ width:"100%", height:"75vh", border:"none", borderRadius:6, background:"#fff" }} />
          ) : (
            <div style={{ textAlign:"center", padding:20 }}>
              <div style={{ marginBottom:16 }}>{Ic.doc(C.t3,48)}</div>
              <div style={{ fontSize:16, fontWeight:700, color:C.t1, marginBottom:8 }}>{file.name||"Archivo"}</div>
              <a href={file.url} download style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, background:C.pri, color:"#fff", textDecoration:"none", fontSize:14, fontWeight:600 }} onClick={e=>e.stopPropagation()}>{Ic.down("#fff",16)} Descargar archivo</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================== CSV EXPORT =================================

export function exportCSV(freights, filename) {
  const headers = ["Código","Estado","Productor","Origen","Destino","Producto","Cantidad","Unidad","Camión","Fecha Carga","Hora","Transportista","Notas"];
  const rows = freights.map(f => {
    const st = stCfg(f.status);
    const fmtDate = f.loadDate ? f.loadDate.slice(8,10)+"-"+f.loadDate.slice(5,7)+"-"+f.loadDate.slice(2,4) : "";
    return [f.code, st.label, f.requestedByName||"", (f.originName||"").split("—")[0].trim(), f.destName, f.grain, f.tons, f.unit||"tn", f.truckPlate||"", fmtDate, f.loadTime, f.transporterName||"", (f.notes||"").replace(/[\n\r]+/g," ")];
  });
  const escape = v => { const s = String(v||""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "tolvink-fletes.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ======================== EXCEL EXPORT (SpreadsheetML) =================

const _REPORT_HEADERS = ["Código","Estado","Empresa","Campo","Lote","Destino","Producto","Cantidad","Unidad","Matrícula","Fecha Carga","Hora","Transportista","Chofer","Celular","Notas"];

function _reportRows(freights) {
  return freights.map(f => {
    const st = stCfg(f.status);
    const fmtDate = f.loadDate ? f.loadDate.slice(8,10)+"/"+f.loadDate.slice(5,7)+"/"+f.loadDate.slice(0,4) : "";
    return [f.code, st.label, f.originCompanyName||f.originName||"", f.fieldName||"", f.originName||"", f.destName||"", f.grain==="Otros"?f.productTypeOther||"Otros":f.grain||"", f.tons||"", f.unit||"tn", f.truckPlate||"", fmtDate, f.loadTime||"", f.transporterName||"", f.driverName||"", f.driverPhone||"", (f.notes||"").replace(/[\n\r]+/g," ")];
  });
}

export function exportExcel(freights, filename) {
  const rows = _reportRows(freights);
  const esc = v => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const headerCells = _REPORT_HEADERS.map(h => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("");
  const dataRows = rows.map(r => "<Row>" + r.map(v => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join("") + "</Row>").join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style></Styles>
<Worksheet ss:Name="Fletes"><Table>
<Row>${headerCells}</Row>
${dataRows}
</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "tolvink-fletes.xls"; a.click();
  URL.revokeObjectURL(url);
}

// ======================== PDF EXPORT (HTML → Print) ====================

export function exportPDF(freights, title) {
  const rows = _reportRows(freights);
  const esc = v => String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const today = new Date().toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"});
  const headerCells = _REPORT_HEADERS.map(h => `<th>${esc(h)}</th>`).join("");
  const dataRows = rows.map(r => "<tr>" + r.map(v => `<td>${esc(v)}</td>`).join("") + "</tr>").join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title||"Informe de Fletes")}</title>
<style>
@page{size:landscape;margin:10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;font-size:9px;color:#1a1a1a;padding:8mm}
h1{font-size:16px;margin-bottom:2px}
.sub{font-size:10px;color:#666;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:8px}
th{background:#003882;color:#fff;padding:5px 4px;text-align:left;font-size:7.5px;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap}
td{padding:4px;border-bottom:1px solid #e0e0e0;white-space:nowrap}
tr:nth-child(even){background:#f8f9fa}
.footer{margin-top:8px;font-size:8px;color:#999;text-align:right}
</style></head><body>
<h1>${esc(title||"Informe de Fletes")} — Tolvink</h1>
<div class="sub">${rows.length} flete${rows.length!==1?"s":""} · Generado el ${today}</div>
<table><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>
<div class="footer">tolvink.app</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
  const w = window.open("","_blank");
  if(w) { w.document.write(html); w.document.close(); }
}
