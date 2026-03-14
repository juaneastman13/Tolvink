import { useState, useEffect, useRef, memo, Component } from "react";
import { C, Ic } from "../theme";
import { captureError } from "../sentry";

export function Toast({ msg, type="ok", onClose }) {
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  useEffect(()=>{ const t=setTimeout(()=>onCloseRef.current?.(),3500); return()=>clearTimeout(t); },[msg]);
  const cfg = { ok:{bg:C.pri,ic:Ic.chk(C.w,16)}, err:{bg:C.err,ic:Ic.warn(C.w,16)}, info:{bg:C.info,ic:Ic.bell(C.w,16)} }[type]||{bg:C.pri,ic:Ic.chk(C.w,16)};
  return <div role="alert" aria-live="assertive" style={{ position:"fixed", top:"max(20px, env(safe-area-inset-top))", left:"50%", transform:"translateX(-50%)", zIndex:300, background:cfg.bg, color:C.w, padding:"11px 22px", borderRadius:12, fontSize:14.3, fontWeight:600, boxShadow:C.shLg, display:"flex", alignItems:"center", gap:8, animation:"fadeIn 0.3s ease", maxWidth:"calc(100vw - 40px)" }}>{cfg.ic} {msg}</div>;
}

export const Loader = memo(function Loader() {
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, gap:12 }}>
    <span style={{ width:14, height:14, borderRadius:7, background:C.acc, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }}></span>
  </div>;
});

export function LoadingOverlay({ closing=false, closingText="", onClose }) {
  const [fading, setFading] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!closing) return;
    const t1 = setTimeout(() => setFading(true), 2200);
    const t2 = setTimeout(() => { onCloseRef.current?.(); }, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [closing]);
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:250,animation:fading?"moOutroFade 0.4s ease forwards":"moFadeIn 0.2s ease"}}>
      <style>{`@keyframes moFadeIn{from{opacity:0}to{opacity:1}}@keyframes moLogoIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}@keyframes moCircleIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}@keyframes moOutroFade{to{opacity:0}}`}</style>
      {!closing && (
        <div style={{display:"flex",alignItems:"flex-start",animation:"moLogoIn 0.35s ease-out"}}>
          <span style={{fontSize:62.7,fontWeight:800,color:C.pri,letterSpacing:-2.5,lineHeight:1}}>tolvink</span>
          <span style={{width:17,height:17,borderRadius:9,background:C.acc,marginLeft:5,marginTop:3,display:"inline-block",animation:"dotPulse 1.5s ease-in-out infinite"}} />
        </div>
      )}
      {closing && (
        <div style={{width:150,height:150,borderRadius:"50%",background:C.acc,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,animation:"moCircleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",pointerEvents:"none"}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {closingText && <span style={{color:"#fff",fontSize:15.4,fontWeight:700,textAlign:"center",lineHeight:1.3,padding:"0 16px"}}>{closingText}</span>}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, action }) {
  return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center", minHeight:200 }}>
    {icon && <div style={{ width:56, height:56, borderRadius:16, background:C.priPale, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>{icon}</div>}
    <div style={{ fontSize:16.5, fontWeight:700, color:C.t1, marginBottom:6 }}>{title}</div>
    {subtitle && <div style={{ fontSize:14.3, color:C.t3, lineHeight:1.5, maxWidth:300 }}>{subtitle}</div>}
    {action && <div style={{ marginTop:16 }}>{action}</div>}
  </div>;
}

// ======================== SKELETON LOADERS ============================

const shimmerStyle = `@keyframes tvShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`;

function SkeletonBlock({ w="100%", h=16, r=8, mb=0, style={} }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:`linear-gradient(90deg, ${C.bgInput} 25%, ${C.b2} 50%, ${C.bgInput} 75%)`, backgroundSize:"200% 100%", animation:"tvShimmer 1.5s ease-in-out infinite", marginBottom:mb, flexShrink:0, ...style }} />;
}

export function SkeletonCard() {
  return <>
    <style>{shimmerStyle}</style>
    <div style={{ background:C.w, borderRadius:10, padding:"10px 14px", border:`1px solid ${C.b2}`, borderLeft:`4px solid ${C.b2}`, marginBottom:10 }}>
      <SkeletonBlock w="45%" h={14} mb={4} />
      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
        <SkeletonBlock w="35%" h={12} />
        <SkeletonBlock w={12} h={12} r={2} />
        <SkeletonBlock w="30%" h={12} />
      </div>
      <div style={{ borderTop:`1px solid ${C.b2}`, paddingTop:8, display:"flex", alignItems:"center", gap:6 }}>
        <SkeletonBlock w={80} h={11} />
        <SkeletonBlock w={100} h={11} />
        <div style={{ flex:1 }} />
        <SkeletonBlock w={50} h={11} />
        <SkeletonBlock w={60} h={20} r={6} />
      </div>
    </div>
  </>;
}

export function SkeletonList({ count=4 }) {
  return <div style={{ padding:"0 2px" }}>
    <style>{shimmerStyle}</style>
    {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
  </div>;
}

export function SkeletonDetail() {
  return <>
    <style>{shimmerStyle}</style>
    <div style={{ padding:18 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <SkeletonBlock w={48} h={48} r={14} />
        <div style={{ flex:1 }}>
          <SkeletonBlock w="50%" h={18} mb={8} />
          <SkeletonBlock w="35%" h={12} />
        </div>
      </div>
      {[1,2,3].map(i => <div key={i} style={{ background:C.w, borderRadius:14, padding:16, border:`1px solid ${C.b2}`, marginBottom:12 }}>
        <SkeletonBlock w="30%" h={10} mb={10} />
        <SkeletonBlock w="80%" h={14} mb={8} />
        <SkeletonBlock w="60%" h={14} />
      </div>)}
    </div>
  </>;
}

// ======================== ERROR BOUNDARY ==============================

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    try {
      captureError(error, { componentStack: info?.componentStack });
    } catch {}
  }
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:32, textAlign:"center", background:C.bg, fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ width:64, height:64, borderRadius:20, background:C.errPale, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div style={{ fontSize:19.8, fontWeight:700, color:C.t1, marginBottom:8 }}>Algo salió mal</div>
        <div style={{ fontSize:14.3, color:C.t3, marginBottom:20, maxWidth:320, lineHeight:1.5 }}>Ocurrió un error inesperado. Podés intentar recargar la página.</div>
        <button onClick={() => window.location.reload()} style={{ padding:"12px 28px", borderRadius:10, background:C.pri, color:C.w, border:"none", fontSize:15.4, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Recargar página</button>
        {import.meta.env.DEV && this.state.error && <div style={{ marginTop:16, fontSize:11, color:C.t3, fontFamily:"monospace", maxWidth:400, wordBreak:"break-all" }}>{String(this.state.error.message || this.state.error).slice(0, 200)}</div>}
      </div>;
    }
    return this.props.children;
  }
}
