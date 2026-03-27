import { useState, useEffect } from "react";
import { C, FONT, MONO, Ic } from "../theme";
import { RoutesBackground } from "../routes-bg";
import AuthScreen from "./AuthScreen";

/* Force-enable scrolling on mount by applying inline !important styles
   directly on html/body/#root — overrides index.html + app.css locks */
function useUnlockScroll() {
  useEffect(() => {
    const el = document.documentElement;
    const bd = document.body;
    const rt = document.getElementById("root");
    const set = (n, p, v) => n && n.style.setProperty(p, v, "important");
    set(el, "height", "auto"); set(el, "overflow-y", "auto"); set(el, "overflow-x", "hidden");
    set(bd, "height", "auto"); set(bd, "overflow-y", "auto"); set(bd, "overflow-x", "hidden");
    set(bd, "position", "static"); set(bd, "overscroll-behavior", "auto");
    set(rt, "height", "auto"); set(rt, "overflow", "visible");
    return () => {
      const rem = (n, p) => n && n.style.removeProperty(p);
      ["height","overflow-y","overflow-x"].forEach(p => { rem(el,p); rem(bd,p); });
      rem(bd,"position"); rem(bd,"overscroll-behavior");
      if (rt) { rem(rt,"height"); rem(rt,"overflow"); }
    };
  }, []);
}

/* ── shared inline-style patterns ─────────────────────────── */
const _slide = bg => ({ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"72px 32px", position:"relative", overflow:"hidden", background:bg });
const _cnt = { maxWidth:900, width:"100%", textAlign:"center" };
const _tag = { display:"block", fontSize:13.2, fontWeight:700, color:C.acc, textTransform:"uppercase", letterSpacing:2.5, marginBottom:14 };
const _h2 = { fontSize:35.2, fontWeight:800, color:C.t1, letterSpacing:-0.5, lineHeight:1.15 };
const _p = { fontSize:16.5, color:C.t2, lineHeight:1.65, margin:0 };
const _sm = { fontSize:14.3, color:C.t3, lineHeight:1.6, margin:0 };
const _hr = { width:40, height:3, borderRadius:2, background:C.acc, margin:"0 auto" };
const _card = { background:C.w, borderRadius:14, border:`1px solid ${C.b2}`, padding:24, boxShadow:C.sh };
const _badge = { display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:6, fontSize:11.6, fontWeight:600, whiteSpace:"nowrap", letterSpacing:0.2 };
const _ib = { width:48, height:48, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
const _ibs = { width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
const _pf = { width:320, background:C.bg, borderRadius:32, overflow:"hidden", border:`1px solid ${C.b1}`, boxShadow:C.shMd };
const _bar = { height:44, background:C.w, display:"flex", alignItems:"center", justifyContent:"center", borderBottom:`1px solid ${C.b2}`, padding:"0 16px" };
const _nav = { display:"flex", alignItems:"center", gap:8, padding:"10px 16px", background:C.w, borderBottom:`1px solid ${C.b2}` };
const _navT = { fontSize:17.6, fontWeight:700, color:C.t1, flex:1 };
const _pbody = { padding:"12px 14px", minHeight:380 };
const _msec = { background:C.w, borderRadius:12, border:`1px solid ${C.b2}`, padding:14, marginBottom:10, boxShadow:C.sh };
const _msh = { display:"flex", alignItems:"center", gap:8, marginBottom:10 };
const _msl = { fontSize:11.6, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 };
const _sel = { width:"100%", padding:"11px 14px", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, fontSize:15.4, display:"flex", alignItems:"center", justifyContent:"space-between" };
const _lbl = { fontSize:11.6, fontWeight:600, color:C.t2, textTransform:"uppercase", letterSpacing:0.6, marginBottom:6, display:"flex", alignItems:"center", gap:4 };
const _fc = { background:C.w, borderRadius:14, padding:14, border:`1px solid ${C.b2}`, boxShadow:C.sh, marginBottom:10 };
const _fh = { display:"flex", alignItems:"center", gap:10, marginBottom:10 };
const _cr = sent => ({ display:"flex", marginBottom:12, justifyContent:sent?"flex-end":"flex-start" });
const _cb = sent => ({ maxWidth:"78%", padding:"10px 14px", borderRadius:14, fontSize:14.3, lineHeight:1.5, ...(sent ? { background:C.priPale, color:C.t1, borderBottomRightRadius:4 } : { background:C.w, color:C.t1, border:`1px solid ${C.b2}`, borderBottomLeftRadius:4 }) });
const _ct = { fontSize:9.9, color:C.t3, marginTop:4 };

export default function LandingScreen({ onLogin, onSignup, onPasswordReset, loading, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);
  useUnlockScroll();

  /* Activate reveal animations + switchTab for embedded presentation HTML */
  useEffect(() => {
    // IntersectionObserver for .reveal elements
    const revealEls = document.querySelectorAll('.reveal');
    const observers = [];
    revealEls.forEach(el => {
      const o = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) { en.target.classList.add('visible'); o.unobserve(en.target); }
        });
      }, { threshold: 0.12 });
      o.observe(el);
      observers.push(o);
    });
    // switchTab on window for inline onclick handlers in presentation HTML
    window.switchTab = function(id) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const tabEl = document.getElementById('tab-' + id);
      if (tabEl) tabEl.classList.add('active');
      // activate the clicked tab button via the event
      if (window.event && window.event.target) window.event.target.classList.add('active');
    };
    return () => { observers.forEach(o => o.disconnect()); delete window.switchTab; };
  }, [showAuth]);

  if (showAuth) return <AuthScreen onLogin={onLogin} onSignup={onSignup} onPasswordReset={onPasswordReset} loading={loading} error={error} clearError={clearError} onBackToLanding={()=>setShowAuth(false)} />;

  return (
    <div style={{ background:C.bg, fontFamily:FONT, display:"flex", flexDirection:"column", WebkitOverflowScrolling:"touch", position:"relative" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes splashIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}@keyframes truckPulse{0%,100%{box-shadow:0 2px 8px rgba(8,145,178,0.3)}50%{box-shadow:0 2px 16px rgba(8,145,178,0.5)}}@keyframes bounceDown{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@media(max-width:767px){.tv-ld-tag{font-size:10px!important;letter-spacing:1.6px!important}.tv-ld-h1{font-size:15px!important}.tv-ld-feat{gap:16px!important}.tv-ld-feat svg{width:16px!important;height:16px!important}.tv-ld-feat span{font-size:9px!important}.tv-ld-logo{font-size:106px!important;letter-spacing:-5px!important}.tv-ld-dot{width:18px!important;height:18px!important}.tv-ld-btn{font-size:14.5px!important;padding:12px 38px!important}.tv-ld-section{padding:48px 20px!important}.tv-ld-section h2{font-size:24px!important}.tv-ld-section p{font-size:13px!important}.tv-ld-phone{width:290px!important;max-width:calc(100vw - 40px)!important}.tv-ld-steps{flex-direction:column!important;gap:24px!important}.tv-ld-steps>div{flex-basis:auto!important}.tv-ld-cards{gap:12px!important}.tv-ld-cards>div{flex-basis:100%!important;min-width:0!important}.tv-ld-caps{flex-direction:column!important;gap:24px!important;align-items:center!important}.tv-ld-sec11{flex-direction:column!important;gap:20px!important;align-items:center!important}}`}</style>

      {/* ═══ HERO ═══ */}
      <div style={{ flex:"none", minHeight:"100dvh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center", paddingTop:"max(40px, env(safe-area-inset-top))", position:"relative", zIndex:1 }}>
        <RoutesBackground trucks centerFade />

        {/* Big logo */}
        <div style={{ animation:"splashIn 0.8s ease-out", marginBottom:30 }}>
          <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
            <span className="tv-ld-logo" style={{ fontSize:130, fontWeight:800, color:C.pri, letterSpacing:-5.6, lineHeight:1 }}>tolvink</span>
            <span className="tv-ld-dot" style={{ width:21, height:21, borderRadius:11, background:C.acc, marginLeft:8, marginTop:6, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Tagline */}
        <div style={{ animation:"fadeUp 0.8s ease-out", marginBottom:34 }}>
          <div className="tv-ld-tag" style={{ fontSize:15.4, fontWeight:700, color:C.acc, textTransform:"uppercase", letterSpacing:2.5, marginBottom:14 }}>
            Logística agrícola simplificada
          </div>
          <h1 className="tv-ld-h1" style={{ fontSize:24.2, fontWeight:700, color:C.t2, lineHeight:1.2, letterSpacing:-0.3 }}>
            Gestioná tus fletes desde WhatsApp con Inteligencia Artificial
          </h1>
        </div>

        {/* 4 Features inline */}
        <div className="tv-ld-feat" style={{ display:"flex", gap:24, justifyContent:"center", marginBottom:38, animation:"fadeUp 1s ease-out", flexWrap:"wrap" }}>
          {[
            { icon: Ic.truck(C.pri,20), label:"Fletes" },
            { icon: Ic.pin(C.acc,20), label:"Seguimiento" },
            { icon: Ic.chk(C.ok,20), label:"Confirmaciones" },
            { icon: Ic.nav(C.sec,20), label:"Rutas" },
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
              {f.icon}
              <span style={{ fontSize:12.1, fontWeight:600, color:C.t2 }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Ingresar + WhatsApp contact */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
          <button onClick={()=>setShowAuth(true)} className="tv-ld-btn" style={{ display:"inline-block", padding:"14px 42px", borderRadius:12, background:C.pri, color:C.w, fontSize:17.6, fontWeight:700, border:"none", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(0,0,0,0.15)", minWidth:200, textAlign:"center", cursor:"pointer", WebkitTapHighlightColor:"rgba(0,0,0,0.1)" }}>Ingresar</button>

          <a href="https://wa.me/59898247552?text=Hola%2C%20quiero%20información%20sobre%20Tolvink" target="_blank" rel="noopener noreferrer" aria-label="Contáctanos por WhatsApp" style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:4, opacity:0.7, textDecoration:"none" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span style={{ fontSize:11, color:C.t3 }}>Contáctanos</span>
          </a>

          {/* Scroll hint */}
          <button onClick={()=>document.getElementById("tv-details")?.scrollIntoView({behavior:"smooth"})} style={{ marginTop:12, display:"flex", flexDirection:"column", alignItems:"center", gap:4, opacity:0.5, animation:"fadeUp 1.2s ease-out, bounceDown 2s ease-in-out 2s infinite", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
            <span style={{ fontSize:12.1, color:C.t3 }}>Bajá para ver detalles</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>

      {/* ═══ PRESENTATION (full page from presentacion.html) ═══ */}
      <iframe id="tv-details" src="/presentacion.html" style={{width:"100%",border:"none",minHeight:"100vh"}} title="Presentación Tolvink" onLoad={e=>{try{const h=e.target.contentDocument.documentElement.scrollHeight;e.target.style.height=h+"px";}catch(ex){}}} />
    </div>
  );
}
