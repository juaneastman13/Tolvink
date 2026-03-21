import { useState, useEffect, useRef } from "react";
import { C, Ic , R} from "../theme";

// ======================== MODAL OVERLAY (animated logo → card) ========

export function ModalOverlay({ children, onClose, maxWidth=400, loading=false, closing=false, closingText="", quick=false }) {
  const [stage, setStage] = useState(quick ? 3 : 0);
  const [fading, setFading] = useState(false);
  const dialogRef = useRef(null);

  // Escape key + focus trap
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape" && onClose) { onClose(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Intro stages (logo → text collapse → dot grow → card)
  useEffect(() => {
    if (loading || closing || quick) return;
    const t1 = setTimeout(() => setStage(1), 60);
    const t2 = setTimeout(() => setStage(2), 120);
    const t3 = setTimeout(() => setStage(3), 180);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [loading, closing, quick]);

  useEffect(() => { if (loading) setStage(0); }, [loading]);

  // Outro: show result circle → hold 0.5s → fade → close
  useEffect(() => {
    if (!closing) return;
    const t1 = setTimeout(() => setFading(true), 200);
    const t2 = setTimeout(() => { if (onClose) onClose(); }, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [closing]);

  const showIntro = !loading && !closing && stage < 3;
  const showCard = !loading && !closing && stage === 3;
  const showLoading = loading && !closing;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" onClick={showCard ? onClose : undefined} style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24,animation:fading ? "moOutroFade 0.4s ease forwards" : "moFadeIn 0.25s ease"}}>
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
          <span style={{fontSize:62.7,fontWeight:800,color:C.pri,letterSpacing:-2.5,lineHeight:1}}>tolvink</span>
          <span style={{width:17,height:17,borderRadius: R.md,background:C.acc,marginLeft:5,marginTop:3,display:"inline-block",animation:"dotPulse 1.5s ease-in-out infinite"}} />
        </div>
      )}
      {/* Intro: staged animation */}
      {showIntro && (
        <div style={{position:"absolute",display:"flex",alignItems:"center",justifyContent:"center",animation:stage===0?"moLogoIn 0.35s ease-out forwards":"none",pointerEvents:"none"}}>
          {stage < 2 && (
            <span style={{fontSize:62.7,fontWeight:800,color:C.pri,letterSpacing:-2.5,lineHeight:1,display:"inline-block",overflow:"hidden",whiteSpace:"nowrap",marginRight:5,animation:stage===1?"moTextOut 0.55s ease forwards":"none"}}>tolvink</span>
          )}
          <span style={{width:17,height:17,borderRadius: R.md,background:C.acc,display:"inline-block",animation:stage===2?"moDotGrow 0.7s ease forwards":"dotPulse 1.5s ease-in-out infinite"}} />
        </div>
      )}
      {/* Outro: orange circle with result text */}
      {closing && (
        <div style={{width:150,height:150,borderRadius:"50%",background:C.acc,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,animation:"moCircleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",pointerEvents:"none"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {closingText && (
            <span style={{color:"#fff",fontSize:15.4,fontWeight:700,textAlign:"center",lineHeight:1.3,padding:"0 16px"}}>{closingText}</span>
          )}
        </div>
      )}
      {/* Card */}
      {showCard && (
        <div onClick={e=>e.stopPropagation()} style={{background:C.w,borderRadius: R.xl,padding:"22px 22px max(22px, env(safe-area-inset-bottom))",width:"100%",maxWidth,maxHeight:"calc(100vh - 48px)",overflowY:"auto",boxShadow:C.shLg,animation:"moCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",WebkitOverflowScrolling:"touch"}}>
          {children}
        </div>
      )}
    </div>
  );
}

// ======================== ATTACH MENU (action sheet) ==================

export function AttachMenu({ open, onClose, onCamera, onGallery, onFiles }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:C.bgOverlay, zIndex:200, animation:"fadeIn 0.15s ease" }} />
      <div role="dialog" aria-modal="true" style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:201, background:C.w, borderRadius:"18px 18px 0 0", padding:"8px 16px max(16px, env(safe-area-inset-bottom))", boxShadow:"0 -4px 24px rgba(0,0,0,0.12)", animation:"sheetUp 0.2s ease" }}>
        <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        <div style={{ width:36, height:4, borderRadius: R.xs, background:C.b1, margin:"0 auto 12px" }} />
        <div style={{ fontSize:14.3, fontWeight:700, color:C.t1, marginBottom:12, textAlign:"center" }}>Adjuntar</div>
        {[
          { icon:Ic.cam(C.acc,22), label:"Tomar foto", sub:"Usar cámara del dispositivo", action:onCamera },
          { icon:Ic.img(C.pri,22), label:"Galería", sub:"Seleccionar de imágenes", action:onGallery },
          { icon:Ic.doc(C.info,22), label:"Archivo", sub:"PDF, DOC, imágenes y más", action:onFiles },
        ].map((opt,i) => (
          <button key={i} onClick={()=>{opt.action();onClose();}} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"14px 12px", border:"none", borderRadius: R.lg, background:"none", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
            <div style={{ width:44, height:44, borderRadius: R.lg, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{opt.icon}</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:15.4, fontWeight:600, color:C.t1 }}>{opt.label}</div>
              <div style={{ fontSize:12.1, color:C.t3, marginTop:1 }}>{opt.sub}</div>
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{ width:"100%", padding:"13px 0", marginTop:4, border:"none", borderRadius: R.lg, background:C.bg, fontSize:15.4, fontWeight:600, color:C.t2, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
      </div>
    </>
  );
}

// ======================== FILE VIEWER (in-app) =======================

export function FileViewer({ file, onClose, onOcr, ocrLoading, onViewOcr }) {
  useEffect(() => {
    if (!file) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [file, onClose]);
  if (!file) return null;
  const safeUrl = file.url && /^https:\/\//i.test(file.url) ? file.url : null;
  const isImg = file.type === "image" || file.type === "photo" || safeUrl?.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
  const isPdf = safeUrl?.match(/\.pdf$/i);
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:260, animation:"fvFadeIn 0.2s ease", padding:16 }}>
      <style>{`@keyframes fvFadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius: R.lg, boxShadow:"0 8px 32px rgba(0,0,0,0.3)", display:"flex", flexDirection:"column", maxWidth:"92vw", maxHeight:"90vh", width: isImg ? "auto" : "90vw", overflow:"hidden" }}>
        {/* Header with close */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:`1px solid ${C.b2}`, flexShrink:0 }}>
          <div style={{ fontSize:14.3, fontWeight:600, color:C.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:10 }}>{file.name||"Archivo"}</div>
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {file.ocrData && onViewOcr && <button onClick={()=>onViewOcr(file.ocrData, file.id)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius: R.md, border:`1px solid ${C.pri}`, background:C.okPale, color:C.pri, fontSize:12.1, fontWeight:700, fontFamily:"inherit", cursor:"pointer" }}>{Ic.eye(C.pri,13)} Ver datos</button>}
            {isImg && onOcr && !file.ocrData && <button onClick={()=>onOcr(file)} disabled={ocrLoading} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius: R.md, border:`1px solid ${C.pri}`, background:C.priPale, color:C.pri, fontSize:12.1, fontWeight:700, fontFamily:"inherit", cursor:"pointer", opacity:ocrLoading?0.6:1 }}>{Ic.doc(C.pri,13)} {ocrLoading ? "Analizando..." : "Extraer datos"}</button>}
            {safeUrl && <a href={safeUrl} download style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.bg, color:C.t1, textDecoration:"none", fontSize:12.1, fontWeight:600, fontFamily:"inherit" }} onClick={e=>e.stopPropagation()}>{Ic.down(C.t2,13)} Descargar</a>}
            <button onClick={onClose} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius: R.md, background:C.err, border:"none", cursor:"pointer", color:"#fff", fontSize:12.1, fontWeight:700, fontFamily:"inherit" }}>{Ic.cross("#fff",14)} Cerrar</button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", overflow:"auto", padding:12, minHeight:200 }}>
          {isImg ? (
            <img src={safeUrl} alt={file.name||""} loading="lazy" style={{ maxWidth:"100%", maxHeight:"75vh", objectFit:"contain", borderRadius: R.sm }} />
          ) : isPdf ? (
            <iframe src={safeUrl} title={file.name||"PDF"} sandbox="allow-scripts allow-same-origin" style={{ width:"100%", height:"75vh", border:"none", borderRadius: R.sm, background:"#fff" }} />
          ) : (
            <div style={{ textAlign:"center", padding:20 }}>
              <div style={{ marginBottom:16 }}>{Ic.doc(C.t3,48)}</div>
              <div style={{ fontSize:17.6, fontWeight:700, color:C.t1, marginBottom:8 }}>{file.name||"Archivo"}</div>
              {safeUrl && <a href={safeUrl} download style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius: R.md, background:C.pri, color:"#fff", textDecoration:"none", fontSize:15.4, fontWeight:600 }} onClick={e=>e.stopPropagation()}>{Ic.down("#fff",16)} Descargar archivo</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
