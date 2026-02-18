import { useState } from "react";
import { C, FONT, Ic } from "../theme";
import { RoutesBackground } from "../routes-bg";
import AuthScreen from "./AuthScreen";

export default function LandingScreen({ onLogin, onSignup, loading, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) return <AuthScreen onLogin={onLogin} onSignup={onSignup} loading={loading} error={error} clearError={clearError} onBackToLanding={()=>setShowAuth(false)} />;

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:FONT, display:"flex", flexDirection:"column", overflow:"hidden", WebkitOverflowScrolling:"touch", position:"relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;overflow:visible!important;overflow-x:hidden!important}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes splashIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}@media(max-width:767px){.tv-ld-tag{font-size:10px!important;letter-spacing:1.6px!important}.tv-ld-h1{font-size:15px!important}.tv-ld-feat{gap:16px!important}.tv-ld-feat svg{width:16px!important;height:16px!important}.tv-ld-feat span{font-size:9px!important}.tv-ld-logo{font-size:125px!important;letter-spacing:-5.9px!important}.tv-ld-dot{width:22px!important;height:22px!important}.tv-ld-btn{font-size:14.5px!important;padding:12px 38px!important}}`}</style>

      <RoutesBackground trucks centerFade />

      {/* Main content — centered */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center", paddingTop:"max(40px, env(safe-area-inset-top))", position:"relative", zIndex:1 }}>

        {/* Big logo */}
        <div style={{ animation:"splashIn 0.8s ease-out", marginBottom:30 }}>
          <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
            <span className="tv-ld-logo" style={{ fontSize:139, fontWeight:800, color:C.pri, letterSpacing:-6.6, lineHeight:1 }}>tolvink</span>
            <span className="tv-ld-dot" style={{ width:25, height:25, borderRadius:13, background:C.acc, marginLeft:9, marginTop:7, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Tagline */}
        <div style={{ animation:"fadeUp 0.8s ease-out", marginBottom:34 }}>
          <div className="tv-ld-tag" style={{ fontSize:14, fontWeight:700, color:C.acc, textTransform:"uppercase", letterSpacing:2.5, marginBottom:14 }}>
            Logística agrícola simplificada
          </div>
          <h1 className="tv-ld-h1" style={{ fontSize:22, fontWeight:700, color:C.t2, lineHeight:1.1, letterSpacing:-0.3, whiteSpace:"nowrap" }}>
            Gestioná tus fletes desde el campo
          </h1>
        </div>

        {/* 4 Features inline */}
        <div className="tv-ld-feat" style={{ display:"flex", gap:24, justifyContent:"center", marginBottom:38, animation:"fadeUp 1s ease-out", flexWrap:"wrap" }}>
          {[
            { icon: Ic.truck(C.pri,20), label:"Fletes" },
            { icon: Ic.pin(C.acc,20), label:"Tracking" },
            { icon: Ic.chk(C.ok,20), label:"Confirmaciones" },
            { icon: Ic.nav(C.sec,20), label:"Rutas" },
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
              {f.icon}
              <span style={{ fontSize:11, fontWeight:600, color:C.t2 }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Ingresar — fresh element, no legacy handlers */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
          <a href="#ingresar" onClick={function(ev){ ev.preventDefault(); console.log('[LANDING] Ingresar clicked'); setShowAuth(true); }} className="tv-ld-btn" style={{ display:"inline-block", padding:"14px 42px", borderRadius:12, background:C.pri, color:C.w, fontSize:16, fontWeight:700, textDecoration:"none", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(0,0,0,0.15)", minWidth:200, textAlign:"center", cursor:"pointer", WebkitTapHighlightColor:"rgba(0,0,0,0.1)" }}>Ingresar</a>

          <a href="https://wa.me/59898247552?text=Hola%2C%20quiero%20información%20sobre%20Tolvink" target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", opacity:0.7 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        </div>
      </div>

      {/* Minimal footer */}
      <div style={{ textAlign:"center", padding:"16px 24px", paddingBottom:"max(16px, env(safe-area-inset-bottom))", fontSize:10, color:C.t3, position:"relative", zIndex:1 }}>
        Logística agrícola inteligente · Uruguay
      </div>
    </div>
  );
}
