import { useState, useEffect, useRef, useId } from "react";
import { C, Ic } from "../theme";

export function Field({ label, icon, value, onChange, placeholder, type="text", children, hasError, onKeyDown, inputMode }) {
  const [showPw, setShowPw] = useState(false);
  const fieldId = useId();
  const isPw = type === "password";
  const borderColor = hasError ? C.err : C.b1;
  const labelColor = hasError ? C.err : C.t2;
  if (children) return <div>{label && <label htmlFor={fieldId} style={{ fontSize:11.6, fontWeight:600, color:labelColor, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}{children}</div>;
  return (
    <div>
      {label && <label htmlFor={fieldId} style={{ fontSize:11.6, fontWeight:600, color:labelColor, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <div style={{ position:"relative" }}>
        <input id={fieldId} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={isPw&&!showPw?"password":"text"} onKeyDown={onKeyDown} inputMode={inputMode}
          style={{ width:"100%", padding:"12px 14px", paddingRight:isPw?42:14, borderRadius:10, border:`1.5px solid ${borderColor}`, background:hasError?C.errPale+"40":C.w, color:C.t1, fontSize:17.6, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
          onFocus={e=>{e.target.style.borderColor=hasError?C.err:C.bFocus;}} onBlur={e=>{e.target.style.borderColor=borderColor;}} />
        {isPw && <button aria-label={showPw?"Ocultar contraseña":"Mostrar contraseña"} onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", minWidth:44, minHeight:44, padding:4 }}>{showPw?Ic.eye(C.t3,18):Ic.eyeOff(C.t3,18)}</button>}
      </div>
    </div>
  );
}

export function NumericStepper({ value, onChange, min, max, step=1, placeholder, label, icon }) {
  const num = parseFloat(value) || 0;
  const dec = step < 1 ? String(step).split('.')[1]?.length || 2 : 0;
  const adjust = (delta) => {
    let next = +(num + delta).toFixed(dec);
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    onChange(String(next));
  };
  const btnS = { width:38, height:38, borderRadius:19, border:`1.5px solid ${C.b1}`, background:C.w, color:C.pri, fontSize:22, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", flexShrink:0, transition:"background 0.15s", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" };
  return (
    <div>
      {label && <label style={{ fontSize:11.6, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button type="button" onClick={()=>adjust(-step)} style={btnS} onMouseEnter={e=>e.currentTarget.style.background=C.priPale} onMouseLeave={e=>e.currentTarget.style.background=C.w}>−</button>
        <input type="number" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max} step={step}
          style={{ width:80, padding:"10px 4px", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:17.6, fontFamily:"inherit", outline:"none", boxSizing:"border-box", textAlign:"center" }}
          onFocus={e=>e.target.style.borderColor=C.bFocus} onBlur={e=>e.target.style.borderColor=C.b1} />
        <button type="button" onClick={()=>adjust(step)} style={btnS} onMouseEnter={e=>e.currentTarget.style.background=C.priPale} onMouseLeave={e=>e.currentTarget.style.background=C.w}>+</button>
      </div>
    </div>
  );
}

export function Select({ label, icon, value, onChange, options, placeholder="Seleccionar..." }) {
  const [open, setOpen] = useState(false);
  const [hlIdx, setHlIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const h = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  useEffect(()=>{
    if(!open) return;
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h, { passive:true });
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  },[open]);
  useEffect(()=>{
    if(open && listRef.current && value) {
      const idx = options.findIndex(o=>o.value===value);
      setHlIdx(idx>=0?idx:0);
      Array.from(listRef.current.children).find(el => el.dataset.val === value)?.scrollIntoView({ block:"nearest" });
    }
  },[open, value]);
  const sel = value != null ? options.find(o=>o.value===value) : undefined;
  const handleKeyDown = (e) => {
    if (!open) { if (e.key==="ArrowDown"||e.key==="ArrowUp"||e.key===" ") { e.preventDefault(); setOpen(true); } return; }
    if (e.key==="ArrowDown") { e.preventDefault(); setHlIdx(i=>Math.min(options.length-1,(i<0?0:i+1))); }
    else if (e.key==="ArrowUp") { e.preventDefault(); setHlIdx(i=>Math.max(0,i-1)); }
    else if (e.key==="Enter"||e.key===" ") { e.preventDefault(); if(hlIdx>=0&&options[hlIdx]) { onChange(options[hlIdx].value); setOpen(false); } }
    else if (e.key==="Escape") { e.preventDefault(); setOpen(false); }
  };
  useEffect(()=>{
    if(open&&listRef.current&&hlIdx>=0) {
      const el = listRef.current.children[hlIdx];
      if(el) el.scrollIntoView({ block:"nearest" });
    }
  },[hlIdx, open]);

  // Mobile: native <select> for best touch UX
  if (isMobile) {
    return (
      <div style={{ position:"relative" }}>
        {label && <label style={{ fontSize:11.6, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
        <select value={value||""} onChange={e=>onChange(e.target.value)} style={{ width:"100%", padding:"12px 14px", paddingRight:36, borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:value?C.t1:C.t3, fontSize:16.5, fontFamily:"inherit", cursor:"pointer", boxSizing:"border-box", minHeight:44, outline:"none", WebkitAppearance:"none", appearance:"none" }}>
          <option value="" disabled>{placeholder}</option>
          {options.map(o=><option key={o.value} value={o.value}>{o.label}{o.sub?` — ${o.sub}`:""}</option>)}
        </select>
        <div style={{ position:"absolute", right:12, top:label?"calc(50% + 11px)":"50%", transform:"translateY(-50%)", pointerEvents:"none", display:"flex" }}>{Ic.down(C.t3,16)}</div>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position:"relative" }}>
      {label && <label style={{ fontSize:11.6, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <button type="button" onClick={()=>setOpen(!open)} onKeyDown={handleKeyDown} style={{ width:"100%", padding:"12px 14px", paddingRight:36, borderRadius:10, border:`1.5px solid ${open?C.bFocus:C.b1}`, background:C.w, color:sel?C.t1:C.t3, fontSize:16.5, fontFamily:"inherit", cursor:"pointer", boxSizing:"border-box", minHeight:44, outline:"none", textAlign:"left", display:"flex", alignItems:"center", transition:"border-color 0.15s" }}>
        {sel ? <>{sel.label}{sel.sub && <span style={{ color:C.t3, fontWeight:400 }}>&nbsp;— {sel.sub}</span>}</> : placeholder}
      </button>
      <div style={{ position:"absolute", right:12, top:label?`calc(50% + 11px)`:"50%", transform:`translateY(-50%) rotate(${open?180:0}deg)`, pointerEvents:"none", display:"flex", transition:"transform 0.2s" }}>{Ic.down(open?C.bFocus:C.t3,16)}</div>
      {open && <div ref={listRef} role="listbox" style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:C.w, border:`1.5px solid ${C.b1}`, borderRadius:12, boxShadow:C.shMd, maxHeight:240, overflowY:"auto", zIndex:50, padding:4 }}>
        {options.length===0 && <div style={{ padding:"14px 12px", fontSize:14.3, color:C.t3, textAlign:"center" }}>Sin opciones</div>}
        {options.map((o,i)=>{
          const active = o.value===value;
          const highlighted = i===hlIdx;
          return <button key={o.value} data-val={o.value} type="button" role="option" aria-selected={active} onClick={()=>{onChange(o.value);setOpen(false);}} className="tv-sel-opt" style={{ width:"100%", padding:"11px 14px", background:highlighted?C.priPale:active?`${C.pri}08`:"transparent", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:15.4, fontWeight:active?600:400, color:active?C.pri:C.t1, textAlign:"left", display:"flex", alignItems:"center", gap:8, transition:"background 0.12s", marginBottom:i<options.length-1?2:0 }}>
            <span style={{ flex:1 }}>{o.label}{o.sub && <span style={{ fontSize:13.2, color:active?C.pri:C.t3, fontWeight:400 }}> — {o.sub}</span>}</span>
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
              <div style={{ fontSize:11, fontWeight:700, color:complete?C.ok:(incomplete||hl)?C.acc:C.t3, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
              {complete && summary && <div style={{ fontSize:13.2, fontWeight:600, color:C.t1, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{summary}</div>}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" style={{flexShrink:0}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showWarn && <div style={{marginTop:6,padding:"6px 12px",borderRadius:8,background:C.acc+'18',border:`1px solid ${C.acc}40`,fontSize:12.1,fontWeight:600,color:C.acc,display:"flex",alignItems:"center",gap:6,animation:"fadeIn 0.2s ease"}}>{Ic.warn(C.acc,14)} Completá los campos anteriores primero</div>}
        </>
      ) : (
        <div>
          <div style={{fontSize:12.1,fontWeight:700,color:C.pri,textTransform:"uppercase",letterSpacing:0.5,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:4,background:C.pri,display:"inline-block"}}/>{label}</div>
          {children}
        </div>
      )}
    </div>
  );
}
