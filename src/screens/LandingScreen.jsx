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

/* ── custom inline SVGs (no matching Ic function) ─────────── */
const SvgProducer = (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V8"/><path d="M8 12l4-4 4 4"/><path d="M6 16l6-6 6 6"/><path d="M9 20l3-3 3 3"/></svg>;
const SvgGrid = (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>;
const SvgMic = (c,s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>;

/* ── Presentation HTML (from presentacion.html) ─────────── */
const PRESENTATION_HTML = `
<style>
:root{
--pri:#1A6B37;--priLt:#228B46;--priPale:#E4F3EA;
--acc:#FF6A00;--accLt:#FF8124;--accPale:#FFF3E8;
--sec:#0891B2;--secLt:#06B6D4;--secPale:#ECFEFF;
--ok:#1A6B37;--okPale:#E4F3EA;--warn:#CA8A04;--warnPale:#FEF9C3;
--err:#DC2626;--errPale:#FEE2E2;
--bg:#F7F8F7;--card:#FFFFFF;--cardAlt:#F1F4F2;--input:#EDEFED;
--t1:#18251C;--t2:#4A6352;--t3:#566B5E;
--b1:#DEE4E0;--b2:#ECF0ED;
--sh:0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.03);
--shMd:0 4px 14px rgba(0,0,0,.06);--shLg:0 12px 32px rgba(0,0,0,.10);
--head:'Plus Jakarta Sans','DM Sans',sans-serif;
--body:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
--mono:'JetBrains Mono','SF Mono',monospace;
--nav-h:60px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:var(--nav-h)}
body{font-family:var(--body);color:var(--t1);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
h1,h2,h3,h4{font-family:var(--head);line-height:1.15}
a{color:inherit;text-decoration:none}
@keyframes tolvinkPulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(20px)}}
.nav{position:fixed;top:0;left:0;right:0;height:var(--nav-h);background:rgba(247,248,247,.92);border-bottom:1px solid var(--b1);z-index:100;display:flex;align-items:center;padding:0 clamp(16px,4vw,48px);backdrop-filter:blur(12px)}
.nav-logo{font-family:var(--head);font-size:22px;font-weight:800;color:var(--pri);letter-spacing:-1px;display:flex;align-items:flex-start}
.nav-dot{width:7px;height:7px;border-radius:4px;background:var(--acc);margin-left:2px;margin-top:3px}
.nav-links{display:flex;gap:4px;margin-left:auto;align-items:center}
.nav-links a{font-size:13px;font-weight:500;color:var(--t2);padding:6px 12px;border-radius:8px;transition:.2s}
.nav-links a:hover,.nav-links a.active{color:var(--pri);background:var(--priPale)}
.hamburger{display:none;width:36px;height:36px;border:1px solid var(--b1);border-radius:8px;background:var(--card);cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px;margin-left:auto}
.hamburger span{width:18px;height:2px;background:var(--t1);border-radius:1px}
.section{padding:80px clamp(20px,5vw,56px);max-width:1100px;margin:0 auto}
.tag{font-size:12px;font-weight:700;color:var(--acc);text-transform:uppercase;letter-spacing:2.5px;margin-bottom:14px;display:inline-block}
.title{font-size:clamp(28px,5vw,44px);font-weight:800;letter-spacing:-.5px;margin-bottom:14px}
.sub{font-size:clamp(15px,2vw,18px);color:var(--t2);max-width:600px;line-height:1.65}
.hr{width:40px;height:3px;border-radius:2px;background:var(--acc);margin:16px 0 28px}
.card{background:var(--card);border:1px solid var(--b2);border-radius:14px;padding:24px;box-shadow:var(--sh);transition:.3s}
.card:hover{box-shadow:var(--shMd);transform:translateY(-1px)}
.icon-box{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:10px;font-family:var(--head);font-size:15px;font-weight:700;border:none;cursor:pointer;transition:.25s}
.btn-pri{background:var(--pri);color:#fff}
.btn-pri:hover{background:var(--priLt);box-shadow:0 4px 16px rgba(26,107,55,.25)}
.btn-acc{background:var(--acc);color:#fff}
.btn-acc:hover{background:var(--accLt);box-shadow:0 4px 16px rgba(255,106,0,.25)}
.btn-sec{background:transparent;color:var(--pri);border:1.5px solid var(--pri)}
.btn-sec:hover{background:var(--priPale)}
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;padding-top:60px}
.hero-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.hero-bg::before{content:'';position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(26,107,55,.08),transparent 70%);top:-80px;right:-150px;animation:float 8s ease-in-out infinite}
.hero-bg::after{content:'';position:absolute;width:350px;height:350px;border-radius:50%;background:radial-gradient(circle,rgba(255,106,0,.06),transparent 70%);bottom:-80px;left:-80px;animation:float 10s ease-in-out infinite 2s}
.pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap}
.phone{width:300px;background:var(--bg);border-radius:28px;overflow:hidden;border:1px solid var(--b1);box-shadow:var(--shLg);flex-shrink:0}
.phone-bar{height:40px;background:var(--card);display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--b2);font-size:11px;color:var(--t3)}
.phone-nav{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--card);border-bottom:1px solid var(--b2)}
.phone-body{padding:10px 12px;min-height:340px}
.fc{display:flex;border-radius:6px;border:.5px solid var(--b1);overflow:hidden;background:var(--card);margin-bottom:8px}
.fc-ribbon{width:16px;flex-shrink:0}
.fc-content{padding:8px 10px;flex:1;min-width:0}
.fc-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
.fc-code{font-size:10px;color:var(--t2);font-family:var(--mono)}
.fc-title{font-size:12px;font-weight:500;color:var(--t1)}
.fc-route{display:flex;align-items:center;gap:3px;font-size:10px;color:var(--t2);margin-bottom:3px}
.fc-transport{display:flex;align-items:center;gap:3px;font-size:10px}
.status-pill{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:500}
.pulse-dot{width:5px;height:5px;border-radius:50%;animation:tolvinkPulse 1.5s infinite}
.plate{display:inline-flex;flex-direction:column;border:1px solid #1a1a1a;border-radius:4px;overflow:hidden;box-shadow:0 0 0 .25px #000;transform:scaleY(.9);line-height:1}
.plate-top{background:#003DA5;padding:1px 6px;text-align:center}
.plate-top span{color:#fff;font-weight:700;font-family:var(--body);font-size:5.5px;letter-spacing:.8px}
.plate-bot{background:#f8f8f8;text-align:center;padding:2px 6px 3px;font-family:var(--mono);font-weight:700;color:#1a1a1a;font-size:12px;letter-spacing:1.5px}
.stat{flex:1;min-width:70px;text-align:center;padding:8px 4px;background:var(--bg);border-radius:8px}
.stat-val{font-size:15px;font-weight:800}
.stat-lbl{font-size:9px;color:var(--t3);margin-top:1px}
.wa-frame{width:320px;background:#ECE5DD;border-radius:28px;overflow:hidden;border:1px solid var(--b1);box-shadow:var(--shLg);flex-shrink:0}
.wa-header{background:#075E54;padding:10px 14px;display:flex;align-items:center;gap:10px}
.wa-avatar{width:32px;height:32px;border-radius:50%;background:var(--pri);display:flex;align-items:center;justify-content:center;font-family:var(--head);font-size:11px;font-weight:800;color:#fff}
.wa-name{color:#fff;font-size:14px;font-weight:600}
.wa-sub{color:rgba(255,255,255,.7);font-size:10px}
.wa-body{padding:10px;min-height:380px;display:flex;flex-direction:column;gap:6px}
.wa-msg{max-width:82%;padding:6px 10px;border-radius:8px;font-size:12.5px;line-height:1.45;position:relative}
.wa-sent{background:#DCF8C6;align-self:flex-end;border-bottom-right-radius:2px}
.wa-recv{background:#fff;align-self:flex-start;border-bottom-left-radius:2px}
.wa-time{font-size:9px;color:#999;text-align:right;margin-top:2px;display:flex;align-items:center;gap:3px;justify-content:flex-end}
.wa-audio{display:flex;align-items:center;gap:8px;padding:8px 10px}
.wa-audio-bar{flex:1;height:4px;background:#ccc;border-radius:2px}
.wa-audio-fill{width:65%;height:100%;background:#34B7F1;border-radius:2px}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.compare-old{border-radius:14px;padding:24px;background:var(--errPale);border:1px solid rgba(220,38,38,.15)}
.compare-new{border-radius:14px;padding:24px;background:var(--priPale);border:1px solid rgba(26,107,55,.15)}
.tabs{display:flex;gap:3px;margin-bottom:24px;background:var(--card);border:1px solid var(--b2);border-radius:12px;padding:3px;flex-wrap:wrap}
.tab{flex:1;min-width:100px;padding:8px 14px;border-radius:9px;border:none;background:transparent;font-family:var(--head);font-size:13px;font-weight:600;color:var(--t3);cursor:pointer;transition:.2s;text-align:center}
.tab.active{background:var(--pri);color:#fff}
.tab-content{display:none;animation:fadeUp .3s ease}
.tab-content.active{display:block}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}
.reveal.visible{opacity:1;transform:translateY(0)}
@media(max-width:768px){
.nav-links{display:none;position:absolute;top:var(--nav-h);left:0;right:0;background:var(--bg);border-bottom:1px solid var(--b1);flex-direction:column;padding:10px 16px;gap:2px}
.nav-links.open{display:flex}
.hamburger{display:flex}
.section{padding:50px 18px}
.hero{min-height:auto;padding-top:40px;padding-bottom:40px}
.compare{grid-template-columns:1fr}
.phone,.wa-frame{width:100%;max-width:320px}
.mockup-row{flex-direction:column!important;align-items:center!important}
}
/* Journey animation */
@keyframes drawLine{from{stroke-dashoffset:200}to{stroke-dashoffset:0}}
@keyframes pulseGlow{0%,100%{opacity:0.3;r:4}50%{opacity:1;r:6}}
@keyframes moveRight{0%{transform:translateX(0)}100%{transform:translateX(calc(100% - 40px))}}
.journey{display:flex;align-items:flex-start;justify-content:center;gap:0;position:relative;padding:20px 0}
.journey-step{flex:1;text-align:center;position:relative;min-width:100px;max-width:180px}
.journey-icon{width:64px;height:64px;border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;position:relative}
.journey-label{font-size:11px;font-weight:600;color:var(--t2);margin-bottom:4px}
.journey-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:600;opacity:0;animation:fadeUp .4s ease forwards}
.journey-line{flex:0 0 60px;height:2px;margin-top:32px;position:relative;overflow:visible}
.journey-line svg{width:100%;height:20px;position:absolute;top:-9px}
/* Before/After */
.ba-panel{flex:1;min-width:260px;border-radius:16px;padding:28px;position:relative;overflow:hidden}
.ba-before{background:linear-gradient(135deg,#FEF2F2,#FFF5F5);border:1px solid rgba(220,38,38,.12)}
.ba-after{background:linear-gradient(135deg,var(--priPale),#F0FFF4);border:1px solid rgba(26,107,55,.12)}
.ba-float{position:absolute;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px;opacity:0;animation:fadeUp .5s ease forwards}
.ba-item{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;color:var(--t2)}
/* Ecosystem */
.eco-node{width:100px;text-align:center;position:relative}
.eco-circle{width:64px;height:64px;border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;border:2px solid var(--b1);transition:.3s}
.eco-center{width:80px;height:80px;border-radius:20px;background:var(--pri);border:none;box-shadow:0 4px 20px rgba(26,107,55,.2)}
@keyframes pulseLine{0%{stroke-dashoffset:40}100%{stroke-dashoffset:0}}
@media(max-width:768px){.journey{flex-direction:column;align-items:center}.journey-line{width:2px;height:40px;flex:0 0 40px;margin-top:0}.ba-panel{min-width:auto}}
</style>
<section class="section" style="position:relative;z-index:1;text-align:center">
  <div class="tag">Logística agrícola inteligente</div>
  <h2 class="title">Tu operación de fletes en una sola plataforma</h2>
  <p class="sub" style="margin:0 auto 32px;text-align:center">Tolvink digitaliza la coordinación de fletes de granos entre plantas, productores y transportistas. Menos llamadas, más control, trazabilidad completa.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;max-width:800px;margin:0 auto;text-align:left">
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="icon-box" style="background:var(--priPale);width:38px;height:38px;min-width:38px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
      <div><div style="font-size:14px;font-weight:700;color:var(--t1)">Gestión de fletes</div><p style="font-size:12px;color:var(--t2)">Creación, asignación y seguimiento con trazabilidad completa de campo a planta.</p></div>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="icon-box" style="background:var(--accPale);width:38px;height:38px;min-width:38px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
      <div><div style="font-size:14px;font-weight:700;color:var(--t1)">Tracking GPS en vivo</div><p style="font-size:12px;color:var(--t2)">Sabé dónde está cada camión en tiempo real. Sin llamar a nadie.</p></div>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="icon-box" style="background:var(--secPale);width:38px;height:38px;min-width:38px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sec)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div><div style="font-size:14px;font-weight:700;color:var(--t1)">Mi Flota</div><p style="font-size:12px;color:var(--t2)">Documentos, gastos, ingresos y resumen económico por camión. OCR automático.</p></div>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="icon-box" style="background:var(--priPale);width:38px;height:38px;min-width:38px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg></div>
      <div><div style="font-size:14px;font-weight:700;color:var(--t1)">Mi Cola</div><p style="font-size:12px;color:var(--t2)">Organizá turnos de carga con drag-and-drop. Asigná camiones desde un panel.</p></div>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="icon-box" style="background:var(--accPale);width:38px;height:38px;min-width:38px"><svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg></div>
      <div><div style="font-size:14px;font-weight:700;color:var(--t1)">Agente IA por WhatsApp</div><p style="font-size:12px;color:var(--t2)">Creá fletes, consultá estados y gestioná tu flota por texto o audio. 107 herramientas.</p></div>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="icon-box" style="background:var(--secPale);width:38px;height:38px;min-width:38px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sec)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div><div style="font-size:14px;font-weight:700;color:var(--t1)">Dashboard económico</div><p style="font-size:12px;color:var(--t2)">Costo/km, ingreso/km, margen y rendimiento. Decisiones con datos reales.</p></div>
    </div>
  </div>
</section>

<section class="section" id="problema" style="position:relative;z-index:1">
  <div class="reveal"><div class="tag">El problema actual</div><h2 class="title">La logística agropecuaria es informal y con poca trazabilidad</h2><p class="sub">En Uruguay, la gran mayoría de la coordinación de fletes agrícolas se gestióna por llamada telefónica, WhatsApp informal y planillas Excel.</p><div class="hr"></div></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
    <div class="card reveal" style="display:flex;gap:14px;align-items:flex-start"><div class="icon-box" style="background:var(--errPale)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div><div><h3 style="font-size:15px;margin-bottom:4px">Coordinacion telefónica</h3><p style="font-size:13px;color:var(--t2)">Decenas de llamadas diarias entre productores, plantas y choferes para confirmar cada viaje.</p></div></div>
    <div class="card reveal" style="display:flex;gap:14px;align-items:flex-start"><div class="icon-box" style="background:var(--errPale)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><div><h3 style="font-size:15px;margin-bottom:4px">Registros manuales</h3><p style="font-size:13px;color:var(--t2)">Planillas sin actualizacion en tiempo real. Datos duplicados o perdidos.</p></div></div>
    <div class="card reveal" style="display:flex;gap:14px;align-items:flex-start"><div class="icon-box" style="background:var(--errPale)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div><h3 style="font-size:15px;margin-bottom:4px">Cero visibilidad</h3><p style="font-size:13px;color:var(--t2)">No hay forma de saber dónde está un camión. "Llama al chofer" es la unica opcion.</p></div></div>
    <div class="card reveal" style="display:flex;gap:14px;align-items:flex-start"><div class="icon-box" style="background:var(--errPale)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div><div><h3 style="font-size:15px;margin-bottom:4px">Flota invisible</h3><p style="font-size:13px;color:var(--t2)">Documentos vencidos, gastos sin registrar, rendimiento desconocido por camión.</p></div></div>
  </div>
  <div class="reveal" style="margin-top:40px">
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      <div class="ba-panel ba-before">
        <h3 style="font-size:16px;color:var(--err);margin-bottom:16px;display:flex;align-items:center;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Así se gestiona hoy</h3>
        <div class="ba-item">47 mensajes de WhatsApp sin leer</div>
        <div class="ba-item">Planillas Excel desactualizadas</div>
        <div class="ba-item">"¿Llegó el camión?" — 15 llamadas/día</div>
        <div class="ba-item">Trabajando hasta las 22hs</div>
        <div class="ba-item">"Se venció la habilitación..."</div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">
          <span style="padding:4px 10px;border-radius:8px;background:var(--errPale);color:var(--err);font-size:11px;font-weight:600">¿Quién lleva la soja de Pérez?</span>
          <span style="padding:4px 10px;border-radius:8px;background:var(--errPale);color:var(--err);font-size:11px;font-weight:600">¿A qué hora sale el próximo?</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;flex-shrink:0;width:40px">
        <div style="width:3px;height:80px;background:linear-gradient(to bottom,var(--err),var(--pri));border-radius:2px"></div>
      </div>
      <div class="ba-panel ba-after">
        <h3 style="font-size:16px;color:var(--pri);margin-bottom:16px;display:flex;align-items:center;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Así se gestiona con Tolvink</h3>
        <div class="ba-item">Todo rastreado, cada flete con su estado</div>
        <div class="ba-item">Documentos al día con alertas automáticas</div>
        <div class="ba-item">Mapa en vivo — sabés dónde está cada camión</div>
        <div class="ba-item">Agente IA responde por vos las 24hs</div>
        <div class="ba-item">Te vas a las 17hs con todo controlado</div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">
          <span style="padding:4px 10px;border-radius:8px;background:var(--priPale);color:var(--pri);font-size:11px;font-weight:600">Flota bajo control</span>
          <span style="padding:4px 10px;border-radius:8px;background:var(--priPale);color:var(--pri);font-size:11px;font-weight:600">Sin una sola llamada</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="actores" style="background:var(--card);padding-left:0;padding-right:0;position:relative;z-index:1">
  <div style="max-width:1100px;margin:0 auto;padding:0 clamp(20px,5vw,56px)">
    <div class="reveal" style="text-align:center;margin-bottom:36px"><div class="tag">Tres actores, una plataforma</div><h2 class="title">Cada rol opera como necesita</h2><p class="sub" style="margin:0 auto">Plataforma web, app móvil y WhatsApp. Cada actor elige cómo operar.</p></div>
    <div class="tabs"><button class="tab active" onclick="switchTab('plantas')">Plantas</button><button class="tab" onclick="switchTab('productores')">Productores</button><button class="tab" onclick="switchTab('transportistas')">Transportistas</button></div>
    <div class="tab-content active" id="tab-plantas"><div class="card" style="border-left:4px solid var(--pri)"><h3 style="margin-bottom:16px">Planta acopiadora — el centro de la operación</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px"><div><h4 style="font-size:14px;color:var(--pri);margin-bottom:3px">Agenda digital de ingresos</h4><p style="font-size:13px;color:var(--t2)">Todos los fletes del dia con filtros por estado, grano y transportista.</p></div><div><h4 style="font-size:14px;color:var(--pri);margin-bottom:3px">Asignacion de transporte</h4><p style="font-size:13px;color:var(--t2)">Seleccioná transportista y camión. Notificación inmediata al chofer.</p></div><div><h4 style="font-size:14px;color:var(--pri);margin-bottom:3px">Fletes internos</h4><p style="font-size:13px;color:var(--t2)">Mové grano entre sucursales. Destinos personalizados.</p></div><div><h4 style="font-size:14px;color:var(--pri);margin-bottom:3px">Control de flota propia</h4><p style="font-size:13px;color:var(--t2)">Documentos, vencimientos, gastos e ingresos por camión.</p></div></div></div></div>
    <div class="tab-content" id="tab-productores"><div class="card" style="border-left:4px solid var(--acc)"><h3 style="margin-bottom:16px">Productor — del campo al seguimiento en tiempo real</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px"><div><h4 style="font-size:14px;color:var(--acc);margin-bottom:3px">Solicitud desde campo</h4><p style="font-size:13px;color:var(--t2)">Seleccioná campo, lote, grano y cantidad.</p></div><div><h4 style="font-size:14px;color:var(--acc);margin-bottom:3px">Seguimiento GPS</h4><p style="font-size:13px;color:var(--t2)">Mapa en vivo con estados actualizados.</p></div><div><h4 style="font-size:14px;color:var(--acc);margin-bottom:3px">Pedí por WhatsApp</h4><p style="font-size:13px;color:var(--t2)">Mandá un audio y la IA arma el flete.</p></div><div><h4 style="font-size:14px;color:var(--acc);margin-bottom:3px">Notificaciónes</h4><p style="font-size:13px;color:var(--t2)">Avisos en cada etapa del viaje.</p></div></div></div></div>
    <div class="tab-content" id="tab-transportistas"><div class="card" style="border-left:4px solid var(--sec)"><h3 style="margin-bottom:16px">Transportista — tu flota, tus numeros, tu control</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px"><div><h4 style="font-size:14px;color:var(--sec);margin-bottom:3px">Gestión de flota</h4><p style="font-size:13px;color:var(--t2)">Gastos, ingresos, documentos por camión.</p></div><div><h4 style="font-size:14px;color:var(--sec);margin-bottom:3px">Solicitudes en vivo</h4><p style="font-size:13px;color:var(--t2)">Recibí pedidos de plantas. Aceptá con un toque.</p></div><div><h4 style="font-size:14px;color:var(--sec);margin-bottom:3px">Documentos al dia</h4><p style="font-size:13px;color:var(--t2)">Semaforo de vencimientos. OCR automático.</p></div><div><h4 style="font-size:14px;color:var(--sec);margin-bottom:3px">Dashboard económico</h4><p style="font-size:13px;color:var(--t2)">Cuánto ganás por camión y por mes.</p></div></div></div></div>
  </div>
</section>

<section class="section" id="funcionalidades" style="position:relative;z-index:1">
  <div class="reveal" style="text-align:center;margin-bottom:40px"><div class="tag">La plataforma</div><h2 class="title">Así se ve tu operación en Tolvink</h2></div>
  <div class="reveal" style="margin-bottom:48px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <h3 style="font-size:18px;margin:0">Listado de fletes con trazabilidad completa</h3>
      <span class="pill" style="background:var(--priPale);color:var(--pri);font-size:11px">Para plantas</span>
    </div>
    <div class="mockup-row" style="display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap">
      <div class="phone"><div class="phone-bar"><span>9:41</span></div><div class="phone-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg><span style="font-size:16px;font-weight:700;color:var(--t1);flex:1">Fletes de hoy</span></div>
        <div class="phone-body">
          <div class="fc"><div class="fc-ribbon" style="background:#FF6A00"></div><div class="fc-content"><div class="fc-row"><div style="display:flex;align-items:baseline;gap:5px"><span class="fc-code">F-0089</span><span class="fc-title">Soja · 30tn</span></div><span class="status-pill" style="background:#FFF3E0;color:#E65100">Pendiente</span></div><div class="fc-route"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Est. San Pedro<span style="margin:0 2px">→</span><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" stroke-width="2"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>CADOL Young</div><div class="fc-transport"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><span style="color:var(--t1);font-weight:500">Sin asignar</span><span style="margin-left:auto;color:var(--t2)">27/mar 08:00</span></div></div></div>
          <div class="fc"><div class="fc-ribbon" style="background:#43A047"></div><div class="fc-content"><div class="fc-row"><div style="display:flex;align-items:baseline;gap:5px"><span class="fc-code">F-0087</span><span class="fc-title">Trigo · 28tn</span></div><span class="status-pill" style="background:#E8F5E9;color:#2E7D32"><span class="pulse-dot" style="background:#43A047"></span>A campo</span></div><div class="fc-route"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>La Rinconada<span style="margin:0 2px">→</span><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" stroke-width="2"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>Planta Dolores</div><div class="fc-transport"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><span style="color:var(--t1);font-weight:500">Transp. Perez</span><span style="margin:0 3px;color:var(--t2)">·</span><span class="plate"><span class="plate-top"><span>URUGUAY</span></span><span class="plate-bot">LAF 1234</span></span><span style="margin-left:auto;color:var(--t2)">07:00</span></div></div></div>
          <div class="fc"><div class="fc-ribbon" style="background:#9E9E9E"></div><div class="fc-content"><div class="fc-row"><div style="display:flex;align-items:baseline;gap:5px"><span class="fc-code">F-0085</span><span class="fc-title">Cebada · 25tn</span></div><span class="status-pill" style="background:#F5F5F5;color:#616161">Finalizado</span></div><div class="fc-route"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Campos del Litoral<span style="margin:0 2px">→</span><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" stroke-width="2"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>Calmer Mercedes</div><div class="fc-transport"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg><span style="color:var(--t1);font-weight:500">Log. Martinez</span><span style="margin:0 3px;color:var(--t2)">·</span><span class="plate"><span class="plate-top"><span>URUGUAY</span></span><span class="plate-bot">MER 5678</span></span><span style="margin-left:auto;color:var(--t2)">26/mar</span></div></div></div>
        </div>
      </div>
      <div style="flex:1;min-width:260px">
        <h4 style="font-size:16px;margin-bottom:12px">Trazabilidad de cada viaje</h4>
        <p style="font-size:14px;color:var(--t2);margin-bottom:16px">Cada flete tiene su card con estado visual, ruta, transporte asignado y matricula. Historial completo con busqueda y filtros.</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px"><span class="status-pill" style="background:#FFF3E0;color:#E65100;font-size:11px">Pendiente</span><span style="font-size:13px;color:var(--t2)">Esperando asignación</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="status-pill" style="background:var(--secPale);color:#0E7490;font-size:11px">Asignado</span><span style="font-size:13px;color:var(--t2)">Camion y chofer confirmados</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="status-pill" style="background:#E8F5E9;color:#2E7D32;font-size:11px"><span class="pulse-dot" style="background:#43A047"></span>A campo</span><span style="font-size:13px;color:var(--t2)">En viaje al campo de carga</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="status-pill" style="background:#E0F2E5;color:#1A6B37;font-size:11px"><span class="pulse-dot" style="background:#1A6B37"></span>A planta</span><span style="font-size:13px;color:var(--t2)">Cargado, en camino a destino</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="status-pill" style="background:#F5F5F5;color:#616161;font-size:11px">Finalizado</span><span style="font-size:13px;color:var(--t2)">Entrega confirmada</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="reveal" style="margin-bottom:48px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <h3 style="font-size:18px;margin:0">Mi Flota — dashboard económico por camión</h3>
      <span class="pill" style="background:var(--secPale);color:var(--sec);font-size:11px">Para transportistas</span>
    </div>
    <div class="mockup-row" style="display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap">
      <div class="phone"><div class="phone-bar"><span>9:41</span></div><div class="phone-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg><span style="font-size:16px;font-weight:700;color:var(--t1);flex:1">Detalle camión</span></div>
        <div class="phone-body">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div class="plate" style="transform:scaleY(.9)"><span class="plate-top"><span>URUGUAY</span></span><span class="plate-bot" style="font-size:16px;padding:3px 10px 4px">LAF 1234</span></div><div><div style="font-size:13px;font-weight:600;color:var(--t1)">Scania R450</div><div style="font-size:10px;color:var(--t3)">12.450 km</div></div></div>
          <div style="display:flex;gap:1px;margin-bottom:10px;background:var(--b1);border-radius:6px;overflow:hidden"><div style="flex:1;padding:5px 2px;font-size:8px;font-weight:700;text-align:center;background:var(--pri);color:#fff">Resumen</div><div style="flex:1;padding:5px 2px;font-size:8px;text-align:center;background:var(--card);color:var(--t3)">Fletes</div><div style="flex:1;padding:5px 2px;font-size:8px;text-align:center;background:var(--card);color:var(--t3)">Ingresos</div><div style="flex:1;padding:5px 2px;font-size:8px;text-align:center;background:var(--card);color:var(--t3)">Gastos</div><div style="flex:1;padding:5px 2px;font-size:8px;text-align:center;background:var(--card);color:var(--t3)">Docs</div></div>
          <div style="display:flex;gap:6px;margin-bottom:8px"><div class="stat"><div class="stat-val" style="color:var(--ok)">$450K</div><div class="stat-lbl">Ingresos</div></div><div class="stat"><div class="stat-val" style="color:var(--err)">$280K</div><div class="stat-lbl">Gastos</div></div><div class="stat"><div class="stat-val" style="color:var(--ok)">+$170K</div><div class="stat-lbl">Neto</div></div></div>
          <div style="display:flex;gap:6px;margin-bottom:10px"><div class="stat"><div class="stat-val" style="font-size:12px">3.200</div><div class="stat-lbl">Km</div></div><div class="stat"><div class="stat-val" style="font-size:12px">12</div><div class="stat-lbl">Viajes</div></div><div class="stat"><div class="stat-val" style="font-size:12px">3.2</div><div class="stat-lbl">km/l</div></div><div class="stat"><div class="stat-val" style="font-size:12px">$87</div><div class="stat-lbl">$/km</div></div></div>
          <div style="font-size:9px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Gastos por tipo</div>
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px"><span style="font-size:9px;color:var(--t3);width:70px">Combustible</span><div style="flex:1;height:6px;background:var(--bg);border-radius:3px"><div style="width:55%;height:100%;background:var(--acc);border-radius:3px"></div></div><span style="font-size:9px;font-weight:600">55%</span></div>
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px"><span style="font-size:9px;color:var(--t3);width:70px">Peaje</span><div style="flex:1;height:6px;background:var(--bg);border-radius:3px"><div style="width:20%;height:100%;background:var(--acc);border-radius:3px"></div></div><span style="font-size:9px;font-weight:600">20%</span></div>
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px"><span style="font-size:9px;color:var(--t3);width:70px">Mantenimiento</span><div style="flex:1;height:6px;background:var(--bg);border-radius:3px"><div style="width:15%;height:100%;background:var(--acc);border-radius:3px"></div></div><span style="font-size:9px;font-weight:600">15%</span></div>
          <div style="font-size:9px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;margin:10px 0 6px">Documentos</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><span style="font-size:9px;font-weight:600;color:var(--ok);background:var(--okPale);padding:2px 8px;border-radius:20px">ITV ✓</span><span style="font-size:9px;font-weight:600;color:var(--warn);background:var(--warnPale);padding:2px 8px;border-radius:20px">Seguro ⚠</span><span style="font-size:9px;font-weight:600;color:var(--err);background:var(--errPale);padding:2px 8px;border-radius:20px">Habilitación ✕</span><span style="font-size:9px;font-weight:600;color:var(--ok);background:var(--okPale);padding:2px 8px;border-radius:20px">Licencia ✓</span></div>
        </div>
      </div>
      <div style="flex:1;min-width:260px">
        <h4 style="font-size:16px;margin-bottom:12px">Control total de cada camión</h4>
        <p style="font-size:14px;color:var(--t2);margin-bottom:16px">6 pestañas por camión: resumen económico, fletes, movimientos, ingresos, gastos y documentos con OCR.</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--priPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><div><div style="font-size:14px;font-weight:600">Resumen económico</div><p style="font-size:12px;color:var(--t2)">Costo/km, ingreso/km, margen, rendimiento km/litro.</p></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--accPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div><div style="font-size:14px;font-weight:600">OCR automático</div><p style="font-size:12px;color:var(--t2)">Foto de factura → extracción de datos con IA.</p></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--secPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sec)" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div><div style="font-size:14px;font-weight:600">Alertas de vencimiento</div><p style="font-size:12px;color:var(--t2)">Semaforo: verde vigente, amarillo por vencer, rojo vencido.</p></div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="reveal" style="margin-bottom:48px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <h3 style="font-size:18px;margin:0">Documentos con OCR automático</h3>
      <span class="pill" style="background:var(--secPale);color:var(--sec);font-size:11px">Para transportistas</span>
    </div>
    <div class="mockup-row" style="display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap">
      <div class="phone">
        <div class="phone-bar"><span>9:41</span></div>
        <div class="phone-nav"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg><span style="font-size:16px;font-weight:700;color:var(--t1);flex:1">Documento</span></div>
        <div class="phone-body">
          <!-- Simulated scanned document -->
          <div style="background:var(--cardAlt);border-radius:10px;padding:20px 14px;margin-bottom:10px;text-align:center;border:1.5px dashed var(--b1);transform:rotate(-0.5deg)">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style="font-size:11px;font-weight:600;color:var(--t3);margin-top:6px">cedula_verde_LAF1234.jpg</div>
            <div style="font-size:9px;color:var(--t3)">380 KB · 1200×900</div>
          </div>
          <!-- Arrow -->
          <div style="text-align:center;margin:8px 0;font-size:10px;font-weight:700;color:var(--acc)">▼ Extracción automática con IA ▼</div>
          <!-- OCR badge -->
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="padding:2px 8px;border-radius:6px;background:var(--accPale);font-size:10px;font-weight:700;color:var(--acc)">OCR</span>
            <span style="font-size:10px;color:var(--t3)">Datos extraídos</span>
          </div>
          <!-- OCR data grid -->
          <div style="display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg);border-radius:6px"><span style="font-size:10px;color:var(--t3);font-weight:600">Tipo</span><span style="font-size:11px;color:var(--t1);font-weight:700">Cédula Verde</span></div>
            <div style="display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg);border-radius:6px"><span style="font-size:10px;color:var(--t3);font-weight:600">Placa</span><span style="font-size:11px;color:var(--t1);font-weight:700;font-family:var(--mono)">LAF 1234</span></div>
            <div style="display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg);border-radius:6px"><span style="font-size:10px;color:var(--t3);font-weight:600">Titular</span><span style="font-size:11px;color:var(--t1);font-weight:700">Juan Pérez</span></div>
            <div style="display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg);border-radius:6px"><span style="font-size:10px;color:var(--t3);font-weight:600">Vencimiento</span><span style="font-size:11px;color:var(--ok);font-weight:700">15/08/2026</span></div>
            <div style="display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg);border-radius:6px"><span style="font-size:10px;color:var(--t3);font-weight:600">Confianza</span><span style="font-size:11px;color:var(--pri);font-weight:700">94%</span></div>
          </div>
        </div>
      </div>
      <div style="flex:1;min-width:260px">
        <h4 style="font-size:16px;margin-bottom:8px">Subís la foto, nosotros hacemos el resto</h4>
        <p style="font-size:14px;color:var(--t2);margin-bottom:16px">Cargá los documentos de tu flota desde el celular. La IA extrae los datos automáticamente y te avisa antes de que venzan.</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--accPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div><div><div style="font-size:13px;font-weight:600">Foto → datos en segundos</div><p style="font-size:12px;color:var(--t2)">Claude Vision extrae tipo, placa, titular y vencimiento.</p></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--priPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div><div><div style="font-size:13px;font-weight:600">Editable inline</div><p style="font-size:12px;color:var(--t2)">Corregí cualquier dato directamente en la app.</p></div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="reveal" style="margin-bottom:48px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <h3 style="font-size:18px;margin:0">Control de vencimientos</h3>
      <span class="pill" style="background:var(--secPale);color:var(--sec);font-size:11px">Para transportistas</span>
    </div>
    <div style="background:var(--card);border:1px solid var(--b2);border-radius:14px;padding:16px;box-shadow:var(--sh);max-width:500px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span class="plate" style="transform:scaleY(.9)"><span class="plate-top"><span>URUGUAY</span></span><span class="plate-bot" style="font-size:14px;padding:2px 8px 3px">LAF 1234</span></span>
        <span style="font-size:13px;font-weight:600;color:var(--t1)">Scania R450</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;font-size:12px;font-weight:500">ITV / VTV</span><span style="font-size:11px;color:var(--t3)">Vence 12/11/2026</span><span style="font-size:10px;font-weight:600;color:var(--ok);background:var(--okPale);padding:2px 7px;border-radius:20px">Vigente</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;font-size:12px;font-weight:500">Seguro obligatorio</span><span style="font-size:11px;color:var(--t3)">Vence 18/04/2026</span><span style="font-size:10px;font-weight:600;color:var(--warn);background:var(--warnPale);padding:2px 7px;border-radius:20px">Pronto</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;font-size:12px;font-weight:500">Habilitación MTOP</span><span style="font-size:11px;color:var(--t3)">Venció 02/03/2026</span><span style="font-size:10px;font-weight:600;color:var(--err);background:var(--errPale);padding:2px 7px;border-radius:20px">Vencido</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;font-size:12px;font-weight:500">Licencia de conducir</span><span style="font-size:11px;color:var(--t3)">Vence 30/09/2027</span><span style="font-size:10px;font-weight:600;color:var(--ok);background:var(--okPale);padding:2px 7px;border-radius:20px">Vigente</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="flex:1;font-size:12px;font-weight:500">Permiso de circulación</span><span style="font-size:11px;color:var(--t3)">Vence 15/01/2027</span><span style="font-size:10px;font-weight:600;color:var(--ok);background:var(--okPale);padding:2px 7px;border-radius:20px">Vigente</span></div>
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--t3);text-align:center">Nunca más una multa por documento vencido</div>
    </div>
  <!-- MAP MOCKUP -->
  <div class="reveal" style="margin-bottom:48px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <h3 style="font-size:18px;margin:0">Toda tu operación en un mapa</h3>
      <span class="pill" style="background:var(--priPale);color:var(--pri);font-size:11px">Para plantas</span>
    </div>
    <p style="font-size:14px;color:var(--t2);margin-bottom:20px;max-width:560px">Visualizá en tiempo real dónde está cada camión, qué flete transporta y cuándo llega. Sin llamar a nadie.</p>
    <div style="background:var(--card);border-radius:20px;box-shadow:var(--shLg);overflow:hidden;border:1px solid var(--b1)">
      <div style="height:36px;background:var(--card);border-bottom:1px solid var(--b2);display:flex;align-items:center;padding:0 14px;gap:8px;font-size:11px;color:var(--t3)"><span>9:41</span><span style="margin-left:auto">Mapa del día</span></div>
      <!-- SVG Map -->
      <div style="position:relative;height:380px;background:linear-gradient(135deg,#E8F5E9 0%,#F1F8E9 30%,#FAFAFA 60%,#E3F2FD 100%);overflow:hidden">
        <svg viewBox="0 0 800 380" style="width:100%;height:100%;position:absolute;inset:0">
          <!-- River Uruguay (west side) -->
          <path d="M0,0 C30,60 10,120 25,180 S15,280 30,380" stroke="#90CAF9" stroke-width="40" fill="none" opacity="0.4"/>
          <path d="M0,0 C30,60 10,120 25,180 S15,280 30,380" stroke="#BBDEFB" stroke-width="20" fill="none" opacity="0.5"/>
          <!-- Roads -->
          <path d="M60,190 L300,160 L520,140 L750,100" stroke="#CFD8DC" stroke-width="2" fill="none" opacity="0.6"/>
          <path d="M60,250 L200,280 L400,300 L650,260" stroke="#CFD8DC" stroke-width="2" fill="none" opacity="0.6"/>
          <path d="M300,60 L300,160 L280,320" stroke="#CFD8DC" stroke-width="1.5" fill="none" opacity="0.5"/>
          <!-- Active route 1: animated dashed -->
          <path d="M180,290 C280,260 380,200 520,140" stroke="#43A047" stroke-width="2.5" fill="none" stroke-dasharray="8,6" opacity="0.7"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2s" repeatCount="indefinite"/></path>
          <!-- Active route 2: animated dashed -->
          <path d="M400,310 C480,270 560,200 660,160" stroke="#1A6B37" stroke-width="2.5" fill="none" stroke-dasharray="8,6" opacity="0.7"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2s" repeatCount="indefinite"/></path>
          <!-- Plant markers (navy blue silo icon) -->
          <g transform="translate(520,130)"><circle r="14" fill="#003882" opacity="0.9"/><path d="M-5,-6 L-5,6 L5,6 L5,-6 Z M-7,-6 L0,-10 L7,-6 Z" fill="#fff" transform="scale(0.7)"/></g>
          <text x="540" y="128" font-family="DM Sans,sans-serif" font-size="9" font-weight="600" fill="#003882">CADOL Young</text>
          <g transform="translate(660,155)"><circle r="14" fill="#003882" opacity="0.9"/><path d="M-5,-6 L-5,6 L5,6 L5,-6 Z M-7,-6 L0,-10 L7,-6 Z" fill="#fff" transform="scale(0.7)"/></g>
          <text x="680" y="153" font-family="DM Sans,sans-serif" font-size="9" font-weight="600" fill="#003882">Calmer Mercedes</text>
          <g transform="translate(120,190)"><circle r="12" fill="#003882" opacity="0.9"/><path d="M-5,-6 L-5,6 L5,6 L5,-6 Z M-7,-6 L0,-10 L7,-6 Z" fill="#fff" transform="scale(0.7)"/></g>
          <text x="136" y="188" font-family="DM Sans,sans-serif" font-size="9" font-weight="600" fill="#003882">Fray Bentos</text>
          <!-- Field markers (green pins) -->
          <g transform="translate(180,290)"><path d="M0,-14 c-5,0 -9,4 -9,9 c0,5 9,14 9,14 s9,-9 9,-14 c0,-5 -4,-9 -9,-9Z" fill="#1A6B37"/><circle cy="-7" r="3" fill="#fff" opacity="0.9"/></g>
          <text x="194" y="290" font-family="DM Sans,sans-serif" font-size="8.5" font-weight="500" fill="#1A6B37">Est. La Esperanza</text>
          <g transform="translate(400,310)"><path d="M0,-14 c-5,0 -9,4 -9,9 c0,5 9,14 9,14 s9,-9 9,-14 c0,-5 -4,-9 -9,-9Z" fill="#1A6B37"/><circle cy="-7" r="3" fill="#fff" opacity="0.9"/></g>
          <text x="414" y="310" font-family="DM Sans,sans-serif" font-size="8.5" font-weight="500" fill="#1A6B37">Campo San Pedro</text>
          <!-- Truck 1: En viaje a campo -->
          <g transform="translate(330,230)">
            <rect x="-18" y="-10" width="36" height="20" rx="6" fill="#43A047" opacity="0.9"/>
            <rect x="-11" y="-5" width="14" height="10" rx="1.5" fill="#fff" opacity="0.3"/>
            <polygon points="3,-4 8,-4 11,-1 11,5 3,5" fill="#fff" opacity="0.3"/>
            <circle cx="-5" cy="6" r="2" fill="#fff" opacity="0.5"/><circle cx="8" cy="6" r="2" fill="#fff" opacity="0.5"/>
          </g>
          <text x="310" y="255" font-family="JetBrains Mono,monospace" font-size="8" font-weight="700" fill="#43A047">LAF 1234</text>
          <!-- Truck 2: En viaje a planta -->
          <g transform="translate(560,200)">
            <rect x="-18" y="-10" width="36" height="20" rx="6" fill="#1A6B37" opacity="0.9"/>
            <rect x="-11" y="-5" width="14" height="10" rx="1.5" fill="#fff" opacity="0.3"/>
            <polygon points="3,-4 8,-4 11,-1 11,5 3,5" fill="#fff" opacity="0.3"/>
            <circle cx="-5" cy="6" r="2" fill="#fff" opacity="0.5"/><circle cx="8" cy="6" r="2" fill="#fff" opacity="0.5"/>
          </g>
          <text x="540" y="225" font-family="JetBrains Mono,monospace" font-size="8" font-weight="700" fill="#1A6B37">MER 5678</text>
          <!-- City labels -->
          <text x="80" y="345" font-family="DM Sans,sans-serif" font-size="8" fill="#90A4AE">N. Palmira</text>
          <text x="250" y="85" font-family="DM Sans,sans-serif" font-size="8" fill="#90A4AE">Dolores</text>
          <text x="680" y="310" font-family="DM Sans,sans-serif" font-size="8" fill="#90A4AE">Carmelo</text>
        </svg>
        <!-- Popup over truck 2 -->
        <div style="position:absolute;left:56%;top:28%;background:var(--card);border-radius:10px;padding:10px 12px;box-shadow:var(--shLg);border:1px solid var(--b1);font-size:11px;width:180px;z-index:2">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span class="plate" style="transform:scaleY(.85)"><span class="plate-top"><span style="font-size:4.5px">URUGUAY</span></span><span class="plate-bot" style="font-size:10px;padding:1px 5px 2px;letter-spacing:1px">MER 5678</span></span><span class="status-pill" style="background:#E0F2E5;color:#1A6B37;font-size:8px"><span class="pulse-dot" style="background:#1A6B37;width:4px;height:4px"></span>A planta</span></div>
          <div style="font-size:10px;color:var(--t1);font-weight:600;margin-bottom:2px">Soja · 30tn</div>
          <div style="font-size:9px;color:var(--t2)">Campo San Pedro → Calmer Mercedes</div>
          <div style="font-size:9px;color:var(--sec);font-weight:600;margin-top:3px">ETA: 45 min</div>
        </div>
        <!-- Legend -->
        <div style="position:absolute;bottom:10px;left:10px;background:rgba(255,255,255,.9);border-radius:8px;padding:8px 10px;font-size:9px;display:flex;gap:10px;border:1px solid var(--b2)">
          <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#003882"></span>Planta</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#1A6B37"></span>Campo</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:7px;border-radius:3px;background:#43A047"></span>Camión</span>
        </div>
      </div>
    </div>
  </div>

  <!-- QUEUE / MI COLA MOCKUP -->
  <div class="reveal" style="margin-bottom:48px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <h3 style="font-size:18px;margin:0">Tu cola de espera. Tu control total.</h3>
      <span class="pill" style="background:var(--priPale);color:var(--pri);font-size:11px">Para plantas</span>
    </div>
    <p style="font-size:14px;color:var(--t2);margin-bottom:20px;max-width:600px">Organizá, reasigná y controlá cada flete del día con drag-and-drop. Sabé qué camión llega, cuándo y con qué carga — todo desde una sola pantalla.</p>
    <div style="background:var(--card);border-radius:16px;box-shadow:var(--shLg);overflow:hidden;border:1px solid var(--b1)">
      <!-- Header bar -->
      <div style="padding:10px 16px;border-bottom:1px solid var(--b2);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:16px;font-weight:700;color:var(--t1);font-family:var(--head)">Colas de Camiones</span>
        <span style="font-size:12px;color:var(--t2);background:var(--bg);padding:4px 10px;border-radius:6px">Hoy — Vie 28 Mar 2026</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          <span style="font-size:9px;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:3px;border:2px solid #71717A;background:rgba(113,113,122,0.1)"></span>Pendiente</span>
          <span style="font-size:9px;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:3px;border:2px solid #FF6A00;background:#FFF3E8"></span>Aceptado</span>
          <span style="font-size:9px;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:3px;border:2px solid #0891B2;background:#ECFEFF"></span>En viaje</span>
          <span style="font-size:9px;display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:3px;border:2px solid #1A6B37;background:#E4F3EA"></span>Finalizado</span>
        </div>
      </div>
      <!-- Board -->
      <div style="display:flex;min-height:320px">
        <!-- Freight rows -->
        <div style="flex:1;padding:10px;overflow-x:auto">
          <!-- Row 1: assigned, trucks inside -->
          <div style="background:var(--bg);border:1.5px solid var(--b1);border-radius:12px;padding:10px 12px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--pri)">F-0087</span>
              <span style="font-size:11px;font-weight:500;color:var(--t1)">Trigo · 28tn</span>
              <span style="font-size:10px;color:var(--t2)">EST. LA ESPERANZA</span>
              <span style="font-size:10px;color:var(--t3)">→ CADOL Young</span>
              <span style="font-size:10px;color:var(--t3);margin-left:auto">07:00</span>
              <span style="font-size:10px;font-weight:600;color:var(--pri)">1/1</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <div style="display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;border:2px solid #0891B2;background:#ECFEFF;font-size:11px;font-weight:600"><div style="width:3px;height:16px;border-radius:2px;background:var(--pri)"></div><span class="plate" style="transform:scaleY(.85)"><span class="plate-top"><span style="font-size:4px">URUGUAY</span></span><span class="plate-bot" style="font-size:9px;padding:1px 4px 2px;letter-spacing:1px">LAF 1234</span></span></div>
            </div>
          </div>
          <!-- Row 2: being dragged TO (drop zone active) -->
          <div style="background:var(--priPale);border:1.5px solid var(--pri);border-radius:12px;padding:10px 12px;margin-bottom:8px;box-shadow:0 0 0 2px rgba(26,107,55,0.15)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--pri)">F-0089</span>
              <span style="font-size:11px;font-weight:500;color:var(--t1)">Soja · 30tn</span>
              <span style="font-size:10px;color:var(--t2)">CAMPO SAN PEDRO</span>
              <span style="font-size:10px;color:var(--t3)">→ Calmer Mercedes</span>
              <span style="font-size:10px;color:var(--t3);margin-left:auto">08:00</span>
              <span style="font-size:10px;font-weight:600;color:var(--acc)">0/1</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <div style="border:1.5px dashed var(--pri);background:rgba(26,107,55,0.06);border-radius:8px;padding:5px 12px;font-size:10px;color:var(--pri);font-weight:600">Soltar para asignar</div>
              <!-- Assign tooltip -->
              <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:8px 10px;box-shadow:var(--shMd);font-size:10px;margin-left:8px">
                <div style="font-weight:600;color:var(--t1);margin-bottom:3px">¿Asignar Scania R450 (MER 5678)?</div>
                <div style="color:var(--t3);margin-bottom:6px">Soja 30tn — San Pedro → Calmer</div>
                <div style="display:flex;gap:4px"><span style="padding:3px 10px;border-radius:6px;background:var(--pri);color:#fff;font-weight:600;font-size:9px">Confirmar</span><span style="padding:3px 10px;border-radius:6px;background:var(--bg);color:var(--t3);font-size:9px">Cancelar</span></div>
              </div>
            </div>
          </div>
          <!-- Row 3: completed -->
          <div style="background:var(--bg);border:1.5px solid var(--b1);border-radius:12px;padding:10px 12px;margin-bottom:8px;opacity:0.6">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--t3)">F-0085</span>
              <span style="font-size:11px;font-weight:500;color:var(--t2)">Cebada · 25tn</span>
              <span style="font-size:10px;color:var(--t3)">CAMPOS DEL LITORAL → Calmer</span>
              <span style="font-size:10px;color:var(--t3);margin-left:auto">06:00</span>
              <span style="font-size:10px;font-weight:600;color:var(--ok)">1/1 ✓</span>
            </div>
            <div style="display:flex;gap:6px"><div style="display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;border:2px solid #1A6B37;background:#E4F3EA;font-size:11px;font-weight:600"><div style="width:3px;height:16px;border-radius:2px;background:var(--pri)"></div><span class="plate" style="transform:scaleY(.85)"><span class="plate-top"><span style="font-size:4px">URUGUAY</span></span><span class="plate-bot" style="font-size:9px;padding:1px 4px 2px;letter-spacing:1px">SBY 4321</span></span></div></div>
          </div>
          <!-- Row 4: pending, empty -->
          <div style="background:var(--bg);border:1.5px solid var(--b1);border-radius:12px;padding:10px 12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
              <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--acc)">F-0091</span>
              <span style="font-size:11px;font-weight:500;color:var(--t1)">Sorgo · 32tn</span>
              <span style="font-size:10px;color:var(--t2)">LA RINCONADA</span>
              <span style="font-size:10px;color:var(--t3)">→ CADOL Young</span>
              <span style="font-size:10px;color:var(--t3);margin-left:auto">10:00</span>
              <span style="font-size:10px;font-weight:600;color:var(--acc)">0/2</span>
            </div>
            <div style="display:flex;gap:6px"><div style="border:1.5px dashed var(--b1);border-radius:8px;padding:5px 12px;font-size:10px;color:var(--t3)">Arrastrá camiones o empresas aquí</div><div style="border:1.5px dashed var(--b1);border-radius:8px;padding:5px 12px;font-size:10px;color:var(--t3)">Slot 2</div></div>
          </div>
        </div>
        <!-- Truck panel (right) -->
        <div style="width:200px;border-left:1px solid var(--b2);padding:10px;flex-shrink:0;background:var(--bg)">
          <div style="font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Camiones disponibles</div>
          <input placeholder="Buscar patente..." style="width:100%;padding:5px 8px;border-radius:6px;border:1px solid var(--b1);font-size:10px;font-family:var(--body);margin-bottom:8px;background:var(--card);outline:none"/>
          <!-- Own fleet -->
          <div style="margin-bottom:10px">
            <div style="font-size:10px;font-weight:600;color:var(--pri);margin-bottom:4px;display:flex;align-items:center;gap:4px"><div style="width:3px;height:10px;border-radius:2px;background:var(--pri)"></div>Flota propia</div>
            <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:6px 8px;margin-bottom:4px;cursor:grab;font-size:10px;display:flex;align-items:center;gap:6px">
              <span class="plate" style="transform:scaleY(.85)"><span class="plate-top"><span style="font-size:4px">URUGUAY</span></span><span class="plate-bot" style="font-size:8px;padding:1px 4px;letter-spacing:1px">KAP 8909</span></span>
              <span style="font-size:9px;color:var(--ok);font-weight:600">Disponible</span>
            </div>
          </div>
          <!-- External -->
          <div>
            <div style="font-size:10px;font-weight:600;color:var(--sec);margin-bottom:4px;display:flex;align-items:center;gap:4px"><div style="width:3px;height:10px;border-radius:2px;background:var(--sec)"></div>Transp. García</div>
            <!-- Truck being dragged -->
            <div style="background:var(--card);border:1px solid var(--pri);border-radius:8px;padding:6px 8px;margin-bottom:4px;opacity:0.4;font-size:10px;display:flex;align-items:center;gap:6px;border-style:dashed">
              <span class="plate" style="transform:scaleY(.85)"><span class="plate-top"><span style="font-size:4px">URUGUAY</span></span><span class="plate-bot" style="font-size:8px;padding:1px 4px;letter-spacing:1px">MER 5678</span></span>
              <span style="font-size:9px;color:var(--t3)">Arrastrando...</span>
            </div>
            <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:6px 8px;font-size:10px;display:flex;align-items:center;gap:6px;cursor:grab">
              <span class="plate" style="transform:scaleY(.85)"><span class="plate-top"><span style="font-size:4px">URUGUAY</span></span><span class="plate-bot" style="font-size:8px;padding:1px 4px;letter-spacing:1px">ABC 7890</span></span>
              <span style="font-size:9px;color:var(--ok);font-weight:600">Disponible</span>
            </div>
          </div>
          <div style="margin-top:10px;font-size:9px;color:var(--t3);text-align:center">3 disponibles / 5 total</div>
        </div>
      </div>
    </div>
    <!-- Feature pills -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;justify-content:center">
      <span class="pill" style="background:var(--priPale);color:var(--pri);font-size:11px">Drag-and-drop para reorganizar</span>
      <span class="pill" style="background:var(--accPale);color:var(--acc);font-size:11px">Asignación directa desde el panel</span>
      <span class="pill" style="background:var(--secPale);color:var(--sec);font-size:11px">Vista por día con estado en vivo</span>
    </div>
  </div>

  </div>
</section>

<section class="section" id="whatsapp" style="background:var(--card);padding-left:0;padding-right:0;position:relative;z-index:1">
  <div style="max-width:1100px;margin:0 auto;padding:0 clamp(20px,5vw,56px)">
    <div class="reveal" style="text-align:center;margin-bottom:40px"><div class="tag">Agente IA por WhatsApp</div><h2 class="title">Tu logística por WhatsApp, como hablar<br>con tu mejor operador</h2><p class="sub" style="margin:0 auto">107 herramientas de IA. Texto y audio. Crea fletes, consulta estados, registra gastos. Todo desde el chat.</p></div>
    <div class="mockup-row reveal" style="display:flex;gap:32px;align-items:flex-start;justify-content:center;flex-wrap:wrap">
      <div class="wa-frame"><div class="wa-header"><div class="wa-avatar">t.</div><div><div class="wa-name">Tolvink</div><div class="wa-sub">en linea</div></div></div>
        <div class="wa-body">
          <div class="wa-msg wa-sent">Hola, necesito un flete de Estancia San Pedro a planta CADOL para mañana<div class="wa-time">9:14 <span style="color:#34B7F1">✓✓</span></div></div>
          <div class="wa-msg wa-recv">Hola Juan! Ya encontré disponibilidad para mañana. Tenés2 camiones:<br><br><b>1.</b> LAF 1234 (Scania R450)<br><b>2.</b> MER 5678 (Volvo FH)<br><br>¿Cuál preferís?<div class="wa-time">9:14</div></div>
          <div class="wa-msg wa-sent">El Scania<div class="wa-time">9:15 <span style="color:#34B7F1">✓✓</span></div></div>
          <div class="wa-msg wa-recv">Perfecto, flete creado:<br><br>📋 <b>F-0089</b> · Soja · 30tn<br>📍 Est. San Pedro → CADOL Young<br>🚚 Scania R450 (LAF 1234)<br>📅 Manana 07:00<br><br>Te aviso cuando salga hacia el campo.<div class="wa-time">9:15</div></div>
          <div class="wa-msg wa-sent" style="min-width:200px"><div class="wa-audio"><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--pri)"><path d="M8 5v14l11-7z"/></svg><div class="wa-audio-bar"><div class="wa-audio-fill"></div></div><span style="font-size:10px;color:#999">0:08</span></div><div class="wa-time">9:22 <span style="color:#34B7F1">✓✓</span></div></div>
          <div class="wa-msg wa-recv">Entendido, cambie el destino del flete F-0089 a <b>Planta Calmer Mercedes</b>. Confirmo?<div class="wa-time">9:22</div></div>
          <div class="wa-msg wa-sent">Si, dale<div class="wa-time">9:23 <span style="color:#34B7F1">✓✓</span></div></div>
          <div class="wa-msg wa-recv">Listo! Destino actualizado. El transportista ya fue notificado. ✅<div class="wa-time">9:23</div></div>
        </div>
      </div>
      <div style="flex:1;min-width:260px">
        <h4 style="font-size:16px;margin-bottom:16px">Todo desde el chat que ya usas</h4>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--priPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div><div style="font-size:14px;font-weight:600">Texto y audio</div><p style="font-size:12px;color:var(--t2)">Interpreta mensajes escritos y notas de voz con la misma precisión.</p></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--accPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div><div><div style="font-size:14px;font-weight:600">Crea fletes por chat</div><p style="font-size:12px;color:var(--t2)">Un audio de 10 segundos y el flete queda armado.</p></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--secPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sec)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div><div style="font-size:14px;font-weight:600">Consulta estados</div><p style="font-size:12px;color:var(--t2)">Preguntá dónde esta un camión en lenguaje natural.</p></div></div>
          <div style="display:flex;gap:10px;align-items:flex-start"><div class="icon-box" style="background:var(--priPale);width:36px;height:36px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div><div><div style="font-size:14px;font-weight:600">Gestión de flota por chat</div><p style="font-size:12px;color:var(--t2)">Registra gastos, consulta documentos, pedi el resumen económico.</p></div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="diferenciadores" style="position:relative;z-index:1">
  <div class="reveal" style="text-align:center;margin-bottom:40px"><div class="tag">Por que Tolvink</div><h2 class="title">Lo que nos hace diferentes</h2></div>
  <div class="compare reveal">
    <div class="compare-old"><h3 style="font-size:16px;display:flex;align-items:center;gap:8px;margin-bottom:14px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Metodo tradicional</h3><ul style="padding:0"><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--err);font-weight:700;flex-shrink:0">✕</span>Coordinacion por telefono</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--err);font-weight:700;flex-shrink:0">✕</span>Sin trazabilidad</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--err);font-weight:700;flex-shrink:0">✕</span>Planillas desactualizadas</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--err);font-weight:700;flex-shrink:0">✕</span>Documentos vencidos sin aviso</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--err);font-weight:700;flex-shrink:0">✕</span>Costos de flota desconocidos</li></ul></div>
    <div class="compare-new"><h3 style="font-size:16px;display:flex;align-items:center;gap:8px;margin-bottom:14px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pri)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Con Tolvink</h3><ul style="padding:0"><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--pri);font-weight:700;flex-shrink:0">✓</span>IA conversacional por WhatsApp</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--pri);font-weight:700;flex-shrink:0">✓</span>Trazabilidad completa</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--pri);font-weight:700;flex-shrink:0">✓</span>Plataforma web + app + WhatsApp</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--pri);font-weight:700;flex-shrink:0">✓</span>Alertas automaticas de documentos</li><li style="list-style:none;display:flex;gap:6px;padding:5px 0;font-size:13px;color:var(--t2)"><span style="color:var(--pri);font-weight:700;flex-shrink:0">✓</span>Dashboard económico por camión</li></ul></div>
  </div>
  <div class="reveal" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:32px;text-align:center">
    <div style="padding:20px"><div style="font-size:28px;font-weight:800;color:var(--pri);font-family:var(--head)">WhatsApp + App</div><p style="font-size:13px;color:var(--t2);margin-top:4px">La plataforma y el chat trabajan juntos.</p></div>
    <div style="padding:20px"><div style="font-size:28px;font-weight:800;color:var(--acc);font-family:var(--head)">Adopcion organica</div><p style="font-size:13px;color:var(--t2);margin-top:4px">Una planta trae a toda su red.</p></div>
    <div style="padding:20px"><div style="font-size:28px;font-weight:800;color:var(--sec);font-family:var(--head)">Precio accesible</div><p style="font-size:13px;color:var(--t2);margin-top:4px">Pensado para PyMEs agropecuarias.</p></div>
  </div>
</section>

<section class="section" id="contacto" style="text-align:center;position:relative;z-index:1">
  <div class="reveal"><div class="tag">Empezá hoy</div><h2 class="title">Logística agrícola simplificada</h2><p class="sub" style="margin:0 auto 32px">Hablemos sobre cómo Tolvink puede transformar tu operación.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:40px"><a href="https://wa.me/59898247552?text=Hola%2C%20quiero%20información%20sobre%20Tolvink" target="_blank" class="btn btn-acc" style="gap:6px"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>Contactar por WhatsApp</a><a href="mailto:tolvink.uy@gmail.com" class="btn btn-sec">tolvink.uy@gmail.com</a></div>
    <div style="display:flex;gap:28px;justify-content:center;flex-wrap:wrap;color:var(--t3);font-size:13px"><span>+598 98 247 552</span><span>tolvink.com</span><span>Uruguay</span></div>
  </div>
</section>

<footer style="background:var(--t1);color:#fff;padding:40px;text-align:center;position:relative;z-index:1">
  <div style="font-family:var(--head);font-size:28px;font-weight:800;color:var(--pri);margin-bottom:6px;display:inline-flex;align-items:flex-start">tolvink<span style="width:7px;height:7px;border-radius:4px;background:var(--acc);margin-left:2px;margin-top:3px;display:inline-block"></span></div>
  <div style="color:rgba(255,255,255,.5);font-size:13px;margin-bottom:12px">Logística agrícola inteligente. Hecho en Uruguay.</div>
  <div style="font-size:11px;opacity:.3">2026 Tolvink. Todos los derechos reservados.</div>
</footer>
`;

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


      {/* ═══ SECTION 2 · WhatsApp + AI Agent ═══ */}
      <div id="tv-details" className="tv-ld-section" style={_slide(C.w)}>
        <RoutesBackground opacityMul={0.3} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>Operación por WhatsApp</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Un agente inteligente como interfaz principal</h2>
          <p style={{ ..._p, maxWidth:520, margin:"0 auto 40px" }}>
            Todo el sistema puede operarse desde WhatsApp mediante un agente de Inteligencia Artificial que interpreta texto y audio, ejecuta acciones y responde con precisión. Sin descargar ninguna aplicación.
          </p>
          <div className="tv-ld-caps" style={{ display:"flex", gap:48, alignItems:"flex-start", justifyContent:"center", flexWrap:"wrap" }}>
            {/* Chat mock */}
            <div className="tv-ld-phone" style={{ ..._pf, width:310 }}>
              <div style={_bar}><span style={{ fontSize:12.1, color:C.t3 }}>9:41</span></div>
              <div style={{ padding:"10px 16px", background:C.w, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:17, background:C.pri, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:14.3, fontWeight:800, color:C.w, lineHeight:1 }}>t</span>
                  <span style={{ width:5, height:5, borderRadius:3, background:C.acc, marginLeft:1, marginTop:-8 }} />
                </div>
                <div>
                  <div style={{ fontSize:15.4, fontWeight:700, color:C.t1 }}>Tolvink</div>
                  <div style={{ fontSize:11, color:C.pri, fontWeight:500 }}>en línea</div>
                </div>
              </div>
              <div style={{ padding:"16px 14px", background:C.bg, minHeight:360, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                <div style={_cr(false)}><div style={_cb(false)}>Buenos días. ¿En qué puedo ayudarte?<div style={_ct}>09:12</div></div></div>
                <div style={_cr(true)}>
                  <div style={_cb(true)}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                      {SvgMic(C.pri,14)}
                      <div style={{ flex:1, height:4, background:C.b1, borderRadius:2, position:"relative" }}>
                        <div style={{ position:"absolute", left:0, top:0, width:"75%", height:"100%", background:C.pri, borderRadius:2 }} />
                      </div>
                      <span style={{ fontSize:11, color:C.t2, fontWeight:500 }}>0:08</span>
                    </div>
                    <span style={{ fontSize:12.1, color:C.t2, fontStyle:"italic" }}>Necesito mandar 30 toneladas de soja mañana desde La Rinconada a Dolores</span>
                    <div style={{ ..._ct, textAlign:"right" }}>09:13</div>
                  </div>
                </div>
                <div style={_cr(false)}>
                  <div style={_cb(false)}>
                    <div style={{ fontWeight:600, marginBottom:6 }}>Solicitud creada</div>
                    <div style={{ fontSize:13.2, lineHeight:1.6 }}>
                      <div style={{ display:"flex", gap:6, marginBottom:2 }}><span style={{ color:C.t3 }}>Grano:</span><span style={{ fontWeight:600 }}>Soja · 30 t</span></div>
                      <div style={{ display:"flex", gap:6, marginBottom:2 }}><span style={{ color:C.t3 }}>Origen:</span><span style={{ fontWeight:600 }}>Est. La Rinconada</span></div>
                      <div style={{ display:"flex", gap:6, marginBottom:2 }}><span style={{ color:C.t3 }}>Destino:</span><span style={{ fontWeight:600 }}>Planta Dolores</span></div>
                      <div style={{ display:"flex", gap:6 }}><span style={{ color:C.t3 }}>Fecha:</span><span style={{ fontWeight:600 }}>26/02 · 08:00</span></div>
                    </div>
                    <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.b2}`, fontSize:13.2, color:C.t2 }}>
                      Transporte Pérez fue notificado y tiene disponibilidad. ¿Confirmo la asignación?
                    </div>
                    <div style={_ct}>09:13</div>
                  </div>
                </div>
                <div style={_cr(true)}><div style={_cb(true)}>Sí, confirmá.<div style={{ ..._ct, textAlign:"right" }}>09:14</div></div></div>
                <div style={_cr(false)}>
                  <div style={_cb(false)}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {Ic.chk(C.pri,14)}
                      <span style={{ fontWeight:600, color:C.pri }}>Flete asignado</span>
                    </div>
                    <div style={{ fontSize:13.2, color:C.t2, marginTop:4 }}>Transporte Pérez confirmado. El chofer recibirá los datos del viaje.</div>
                    <div style={_ct}>09:14</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Capabilities */}
            <div style={{ maxWidth:320, textAlign:"left" }}>
              <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:20 }}>Capacidades del agente</div>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {[
                  { bg:C.priPale, icon:Ic.msg(C.pri,16), title:"Texto y audio", desc:"Interpreta mensajes escritos y notas de voz con la misma precisión." },
                  { bg:C.accPale, icon:Ic.plus(C.acc,16), title:"Crear solicitudes", desc:"Genera fletes completos a partir de instrucciones en lenguaje natural." },
                  { bg:C.secPale, icon:Ic.truck(C.sec,16), title:"Asignar transportistas", desc:"Selecciona y notifica al transportista adecuado según disponibilidad." },
                  { bg:"#EFF6FF", icon:Ic.srch("#2563EB",16), title:"Consultar estados", desc:"Responde al instante sobre ubicación, estado y datos de cualquier flete activo." },
                  { bg:C.priPale, icon:Ic.edit(C.pri,16), title:"Modificar y confirmar", desc:"Editá datos, cambiá fechas y confirmá operaciones sin salir de la conversación." },
                ].map((c,i) => (
                  <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.icon}</div>
                    <div><div style={{ fontSize:14.3, fontWeight:600, color:C.t1, marginBottom:2 }}>{c.title}</div><p style={{ ..._sm, fontSize:13.2 }}>{c.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══ SECTION 3 · Three Actors ═══ */}
      <div className="tv-ld-section" style={_slide(C.bg)}>
        <RoutesBackground opacityMul={0.25} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>Tres actores, una plataforma</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Cada rol opera como necesita</h2>
          <div style={{ ..._hr, marginBottom:28 }} />
          <p style={{ ..._p, maxWidth:560, margin:"0 auto 44px" }}>
            Tolvink se adapta a cada actor de la cadena. Todos pueden operar desde WhatsApp, la aplicación o desde la plataforma web, según lo que les resulte más cómodo.
          </p>
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, textAlign:"left" }}>
            {[
              { bg:C.priPale, icon:SvgProducer(C.pri,22), title:"Productor", desc:"Creá fletes por WhatsApp, la aplicación o desde la web. Definí grano, volumen, origen y destino. Seguí el estado en tiempo real y recibí confirmaciones automáticas sin hacer una sola llamada." },
              { bg:C.accPale, icon:Ic.plant("#FF6A00",22), title:"Planta de acopio", desc:"Recibí solicitudes, asigná flota y confirmá recepción de mercadería. Todo desde un mensaje de WhatsApp, la aplicación o desde el panel web con vista consolidada de operaciones." },
              { bg:C.secPale, icon:Ic.truck("#0891B2",20), title:"Transportista", desc:"Aceptá viajes, reportá carga y confirmá entrega directamente por WhatsApp. Sin descargar aplicaciones, sin aprender interfaces nuevas. El chofer opera desde el chat que ya usa todos los días. También puede operar desde la aplicación o la web." },
            ].map((c,i) => (
              <div key={i} style={{ ..._card, flex:"1 1 250px", minWidth:250 }}>
                <div style={{ ..._ib, background:c.bg, marginBottom:16 }}>{c.icon}</div>
                <div style={{ fontSize:17.6, fontWeight:700, color:C.t1, marginBottom:6 }}>{c.title}</div>
                <p style={_sm}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══ SECTION 4 · The Problem ═══ */}
      <div className="tv-ld-section" style={_slide(C.w)}>
        <RoutesBackground opacityMul={0.3} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>La solución al problema actual</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Eliminá la improvisación</h2>
          <div style={{ ..._hr, marginBottom:28 }} />
          <p style={{ ..._p, maxWidth:540, margin:"0 auto 44px" }}>
            La coordinación de fletes agrícolas en Uruguay sigue operando con herramientas fragmentadas: llamadas, mensajes sueltos y planillas sin actualización en tiempo real.
          </p>
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, maxWidth:720, margin:"0 auto", textAlign:"left" }}>
            {[
              { icon:Ic.phone("#DC2626",18), title:"Coordinación telefónica", desc:"Decenas de llamadas diarias entre productores, plantas y choferes para confirmar horarios, disponibilidad y estado de cada viaje." },
              { icon:Ic.doc("#DC2626",18), title:"Registros manuales", desc:"Planillas en papel o Excel sin actualización. Información duplicada, inconsistente o directamente perdida." },
              { icon:Ic.clk("#DC2626",18), title:"Cero visibilidad en ruta", desc:"No hay forma de saber dónde está un camión, si ya cargó, o cuándo llega. La respuesta siempre es \"llamá al chofer\"." },
              { icon:Ic.warn("#DC2626",18), title:"Errores y demoras evitables", desc:"Camiones vacíos esperando, cargas duplicadas, destinos equivocados. Cada error tiene un costo directo en la operación." },
            ].map((c,i) => (
              <div key={i} style={{ ..._card, display:"flex", gap:14, alignItems:"flex-start", flex:"1 1 calc(50% - 8px)", minWidth:280 }}>
                <div style={{ ..._ibs, background:"#FEE2E2" }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:4 }}>{c.title}</div>
                  <p style={_sm}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══ SECTION 5 · How It Works ═══ */}
      <div className="tv-ld-section" style={_slide(C.bg)}>
        <RoutesBackground opacityMul={0.25} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>Cómo funciona</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Del campo a la planta, en un flujo continuo</h2>
          <div style={{ ..._hr, marginBottom:44 }} />
          <div className="tv-ld-steps" style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", width:"100%", maxWidth:820, margin:"0 auto", justifyContent:"center" }}>
            {[
              { bg:C.priPale, color:C.pri, num:"1", title:"Solicitud", desc:"El productor crea el flete indicando grano, volumen, origen y destino.", badgeBg:C.accPale, badgeC:C.acc, badge:"Pendiente" },
              { bg:C.secPale, color:C.sec, num:"2", title:"Asignación", desc:"La planta recibe la solicitud y asigna un transportista con disponibilidad.", badgeBg:C.secPale, badgeC:C.sec, badge:"Asignado" },
              { bg:"#E8F5E9", color:"#43A047", num:"3", title:"A campo", desc:"El transportista asigna camión y chofer. El camión sale hacia el campo de carga.", badgeBg:"#E8F5E9", badgeC:"#43A047", badge:"A campo" },
              { bg:"#E0F2E5", color:"#1A6B37", num:"4", title:"A planta", desc:"El camión carga en campo y parte hacia la planta de destino.", badgeBg:"#E0F2E5", badgeC:"#1A6B37", badge:"A planta" },
              { bg:C.priPale, color:C.pri, num:"5", title:"Finalización", desc:"La planta confirma la recepción. El flete queda cerrado con registro completo.", badgeBg:C.priPale, badgeC:C.pri, badge:"Finalizado" },
            ].map((s,i) => (
              <div key={i} style={{ flex:"1 1 140px", minWidth:140, display:"flex", flexDirection:"column", alignItems:"center", position:"relative", padding:"0 8px" }}>
                {i < 4 && <div style={{ position:"absolute", top:24, left:"calc(50% + 28px)", width:"calc(100% - 56px)", height:2, background:C.b1 }} />}
                <div style={{ width:48, height:48, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17.6, fontWeight:800, marginBottom:14, position:"relative", zIndex:1, background:s.bg, color:s.color }}>{s.num}</div>
                <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:6 }}>{s.title}</div>
                <p style={{ ..._sm, textAlign:"center", maxWidth:160 }}>{s.desc}</p>
                <div style={{ ..._badge, background:s.badgeBg, color:s.badgeC, marginTop:10 }}>{s.badge}</div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══ SECTION 6 · Trip Request ═══ */}
      <div className="tv-ld-section" style={_slide(C.w)}>
        <RoutesBackground opacityMul={0.3} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>La aplicación</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Solicitud de viaje</h2>
          <p style={{ ..._p, maxWidth:480, margin:"0 auto 36px" }}>
            El productor completa el formulario con datos del grano, cantidades, origen y destino. El sistema valida cada sección antes de habilitar la siguiente.
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="tv-ld-phone" style={_pf}>
              <div style={_bar}><span style={{ fontSize:12.1, color:C.t3 }}>9:41</span></div>
              <div style={_nav}>
                {Ic.chev(C.pri,18)}
                <span style={_navT}>Nuevo flete</span>
              </div>
              <div style={{ ..._pbody, paddingBottom:20 }}>
                {/* Producto — completed */}
                <div style={{ ..._msec, borderLeft:`3px solid ${C.pri}` }}>
                  <div style={{ ..._msh, marginBottom:0 }}>
                    {Ic.chk("#1A6B37",14)}
                    <span style={_msl}>Producto</span>
                    <span style={{ ..._badge, background:C.priPale, color:C.pri, marginLeft:"auto", fontSize:9.9, padding:"2px 7px" }}>Soja</span>
                  </div>
                </div>
                {/* Cantidad — completed */}
                <div style={{ ..._msec, borderLeft:`3px solid ${C.pri}` }}>
                  <div style={{ ..._msh, marginBottom:0 }}>
                    {Ic.chk("#1A6B37",14)}
                    <span style={_msl}>Cantidad</span>
                    <span style={{ marginLeft:"auto", fontSize:13.2, fontWeight:600, color:C.t1 }}>30 t</span>
                  </div>
                </div>
                {/* Origen — active */}
                <div style={{ ..._msec, borderLeft:`3px solid ${C.acc}` }}>
                  <div style={_msh}>
                    {Ic.pin("#FF6A00",14)}
                    <span style={{ ..._msl, color:C.acc }}>Origen</span>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={_lbl}>{SvgGrid(C.t2,12)} Campo</div>
                    <div style={_sel}>
                      <span style={{ color:C.t1, fontSize:14.3 }}>Est. La Rinconada</span>
                      {Ic.down(C.t3,14)}
                    </div>
                  </div>
                  <div>
                    <div style={_lbl}>{Ic.lot(C.t2,12)} Lote</div>
                    <div style={_sel}>
                      <span style={{ color:C.t3, fontSize:14.3 }}>Seleccionar...</span>
                      {Ic.down(C.t3,14)}
                    </div>
                  </div>
                </div>
                {/* Destino — disabled */}
                <div style={{ ..._msec, opacity:0.4 }}>
                  <div style={{ ..._msh, marginBottom:0 }}>
                    {Ic.plant(C.t3,14)}
                    <span style={_msl}>Destino</span>
                  </div>
                </div>
                {/* Fecha — disabled */}
                <div style={{ ..._msec, opacity:0.4 }}>
                  <div style={{ ..._msh, marginBottom:0 }}>
                    {Ic.cal(C.t3,14)}
                    <span style={_msl}>Fecha y hora</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══ SECTION 7 · Freight Detail ═══ */}
      <div className="tv-ld-section" style={_slide(C.bg)}>
        <RoutesBackground opacityMul={0.25} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>La aplicación</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Detalle y gestión del flete</h2>
          <p style={{ ..._p, maxWidth:480, margin:"0 auto 36px" }}>
            Cada flete cuenta con una vista completa de su estado, actores involucrados, datos logísticos y acciones disponibles según el rol del usuario.
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="tv-ld-phone" style={_pf}>
              <div style={_bar}><span style={{ fontSize:12.1, color:C.t3 }}>9:41</span></div>
              <div style={_nav}>
                {Ic.chev(C.pri,18)}
                <span style={_navT}>Detalle</span>
                {Ic.msg(C.t3,18)}
              </div>
              <div style={_pbody}>
                {/* Freight header */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16.5, fontWeight:700, letterSpacing:0.5, flexShrink:0, background:"rgba(26,107,55,0.07)", color:C.pri, border:"1.5px solid rgba(26,107,55,0.13)" }}>GR</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:16.5, fontWeight:700, color:C.t1 }}>Graneros del Sur</div>
                    <div style={{ fontSize:12.1, color:C.t3, fontFamily:MONO }}>FL-2025-0847</div>
                  </div>
                  <div style={{ ..._badge, background:"#E8F5E9", color:"#43A047" }}>A campo</div>
                </div>
                {/* Carga */}
                <div style={_msec}>
                  <div style={_msh}>
                    {SvgProducer(C.pri,14)}
                    <span style={_msl}>Carga</span>
                  </div>
                  <div style={{ display:"flex", gap:12 }}>
                    <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2 }}>Grano</div><div style={{ fontSize:14.3, fontWeight:600, color:C.t1 }}>Soja</div></div>
                    <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2 }}>Cantidad</div><div style={{ fontSize:14.3, fontWeight:600, color:C.t1 }}>30 t</div></div>
                    <div style={{ flex:1 }}><div style={{ fontSize:11, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2 }}>Fecha</div><div style={{ fontSize:14.3, fontWeight:600, color:C.t1 }}>25/02</div></div>
                  </div>
                </div>
                {/* Recorrido */}
                <div style={_msec}>
                  <div style={_msh}>
                    {Ic.pin(C.acc,14)}
                    <span style={_msl}>Recorrido</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:2 }}>
                      <div style={{ width:8, height:8, borderRadius:4, background:C.pri }} />
                      <div style={{ width:1.5, height:28, background:C.b1 }} />
                      <div style={{ width:8, height:8, borderRadius:4, background:C.acc }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ marginBottom:14 }}><div style={{ fontSize:11, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, marginBottom:1 }}>Origen</div><div style={{ fontSize:14.3, fontWeight:600, color:C.t1 }}>Est. La Rinconada · Lote 4</div></div>
                      <div><div style={{ fontSize:11, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, marginBottom:1 }}>Destino</div><div style={{ fontSize:14.3, fontWeight:600, color:C.t1 }}>Planta Dolores · Suc. 1</div></div>
                    </div>
                  </div>
                </div>
                {/* Transporte */}
                <div style={_msec}>
                  <div style={_msh}>
                    {Ic.truck(C.sec,14)}
                    <span style={_msl}>Transporte</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:"rgba(8,145,178,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13.2, fontWeight:700, color:C.sec, border:"1px solid rgba(8,145,178,0.13)" }}>ML</div>
                    <div style={{ flex:1 }}><div style={{ fontSize:14.3, fontWeight:600, color:C.t1 }}>Mario López</div><div style={{ fontSize:12.1, color:C.t3 }}>SCO 1234 · Transporte Pérez</div></div>
                  </div>
                </div>
                {/* Action button */}
                <div style={{ marginTop:14 }}>
                  <div style={{ width:"100%", padding:"13px 22px", borderRadius:10, background:C.acc, color:C.w, fontSize:14.9, fontWeight:600, border:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:7, minHeight:44 }}>
                    {Ic.chk(C.w,16)}
                    Confirmar carga
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══ SECTION 8 · Live Tracking ═══ */}
      <div className="tv-ld-section" style={_slide(C.w)}>
        <RoutesBackground opacityMul={0.3} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>Seguimiento en tiempo real</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Sabé dónde está cada camión en todo momento</h2>
          <p style={{ ..._p, maxWidth:480, margin:"0 auto 36px" }}>
            GPS en vivo con ubicación del chofer actualizada automáticamente. Sin llamadas, sin preguntar "¿dónde estás?". El mapa muestra todos los fletes activos del día.
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="tv-ld-phone" style={_pf}>
              <div style={_bar}><span style={{ fontSize:12.1, color:C.t3 }}>9:41</span></div>
              <div style={_nav}>
                {Ic.chev(C.pri,18)}
                <span style={_navT}>Mapa del día</span>
              </div>
              <div style={{ padding:10 }}>
                {/* Map mock */}
                <div style={{ width:"100%", height:260, borderRadius:14, background:"linear-gradient(135deg, #E8F0E8 0%, #D8E8D8 50%, #E0ECDF 100%)", position:"relative", overflow:"hidden", border:`1px solid ${C.b2}`, marginBottom:12 }}>
                  {/* Road lines */}
                  <div style={{ position:"absolute", top:"45%", left:"10%", width:"80%", height:2, background:C.t3, opacity:0.2, borderRadius:1 }} />
                  <div style={{ position:"absolute", top:"25%", left:"30%", width:"50%", height:2, background:C.t3, opacity:0.15, borderRadius:1, transform:"rotate(25deg)" }} />
                  <div style={{ position:"absolute", top:"60%", left:"20%", width:"40%", height:2, background:C.t3, opacity:0.15, borderRadius:1, transform:"rotate(-15deg)" }} />
                  {/* Origin pin */}
                  <div style={{ position:"absolute", display:"flex", flexDirection:"column", alignItems:"center", transform:"translate(-50%, -100%)", zIndex:2, left:"20%", top:"38%" }}>
                    <div style={{ width:12, height:12, borderRadius:6, background:C.pri, border:`2px solid ${C.w}`, boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
                    <div style={{ fontSize:8.8, fontWeight:700, padding:"2px 5px", borderRadius:4, background:C.w, boxShadow:"0 1px 3px rgba(0,0,0,0.1)", marginTop:2, whiteSpace:"nowrap", color:C.pri }}>La Rinconada</div>
                  </div>
                  {/* Destination pin */}
                  <div style={{ position:"absolute", display:"flex", flexDirection:"column", alignItems:"center", transform:"translate(-50%, -100%)", zIndex:2, left:"78%", top:"38%" }}>
                    <div style={{ width:12, height:12, borderRadius:6, background:C.acc, border:`2px solid ${C.w}`, boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }} />
                    <div style={{ fontSize:8.8, fontWeight:700, padding:"2px 5px", borderRadius:4, background:C.w, boxShadow:"0 1px 3px rgba(0,0,0,0.1)", marginTop:2, whiteSpace:"nowrap", color:C.acc }}>Planta Dolores</div>
                  </div>
                  {/* Truck 1 */}
                  <div style={{ position:"absolute", zIndex:3, transform:"translate(-50%, -50%)", width:28, height:28, borderRadius:8, background:C.sec, display:"flex", alignItems:"center", justifyContent:"center", animation:"truckPulse 2s ease-in-out infinite", left:"52%", top:"42%" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  </div>
                  {/* Truck 2 */}
                  <div style={{ position:"absolute", zIndex:3, transform:"translate(-50%, -50%)", width:28, height:28, borderRadius:8, background:C.sec, display:"flex", alignItems:"center", justifyContent:"center", animation:"truckPulse 2s ease-in-out infinite 0.5s", left:"35%", top:"62%" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  </div>
                </div>
                {/* Info bar 1 */}
                <div style={{ ..._msec, marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:5, background:C.sec, animation:"truckPulse 2s ease-in-out infinite" }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13.2, fontWeight:600, color:C.t1 }}>SCO 1234 · Mario López</div>
                      <div style={{ fontSize:11, color:C.t3 }}>En camino · Llegada estimada 12:40</div>
                    </div>
                    <div style={{ ..._badge, background:"#E8F5E9", color:"#43A047", fontSize:9.9, padding:"2px 7px" }}>A campo</div>
                  </div>
                </div>
                {/* Info bar 2 */}
                <div style={{ ..._msec, marginBottom:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:5, background:C.sec, animation:"truckPulse 2s ease-in-out infinite 0.5s" }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13.2, fontWeight:600, color:C.t1 }}>SBY 5678 · Juan Martínez</div>
                      <div style={{ fontSize:11, color:C.t3 }}>Cargando en origen</div>
                    </div>
                    <div style={{ ..._badge, background:"#E0F2E5", color:"#1A6B37", fontSize:9.9, padding:"2px 7px" }}>A planta</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══ SECTION 9 · Operations Panel ═══ */}
      <div className="tv-ld-section" style={_slide(C.bg)}>
        <RoutesBackground opacityMul={0.25} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>La aplicación</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Panel de operaciones</h2>
          <p style={{ ..._p, maxWidth:480, margin:"0 auto 36px" }}>
            Vista consolidada para plantas y empresas. Fletes agrupados por estado con acceso directo a cada operación, y filtros por fecha, productor y transportista.
          </p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div className="tv-ld-phone" style={_pf}>
              <div style={_bar}><span style={{ fontSize:12.1, color:C.t3 }}>9:41</span></div>
              <div style={{ padding:"14px 16px 8px", background:C.w, borderBottom:`1px solid ${C.b2}` }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:12.1, color:C.t3, marginBottom:1 }}>Planta Dolores</div>
                    <div style={{ fontSize:18.7, fontWeight:800, color:C.t1 }}>Hoy</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>{Ic.bell(C.t3,16)}</div>
                    <div style={{ width:32, height:32, borderRadius:10, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>{Ic.menu3(C.t3,16)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:2, background:C.bgInput, borderRadius:10, padding:3, marginBottom:12 }}>
                  {["Resumen","Listado","Mapa"].map((t,i) => (
                    <div key={i} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:"none", fontSize:12.1, fontWeight:i===0?700:500, textAlign:"center", color:i===0?C.pri:C.t3, background:i===0?C.w:"transparent", boxShadow:i===0?C.sh:"none" }}>{t}</div>
                  ))}
                </div>
              </div>
              <div style={{ ..._pbody, paddingTop:10 }}>
                {/* En curso group */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, padding:"0 2px" }}>
                    <div style={{ width:6, height:6, borderRadius:3, background:"#4ADE80" }} />
                    <span style={{ fontSize:12.1, fontWeight:700, color:C.t2 }}>En curso</span>
                    <span style={{ fontSize:11, color:C.t3, marginLeft:2 }}>3</span>
                  </div>
                  {/* Card 1 */}
                  <div style={_fc}>
                    <div style={_fh}>
                      <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14.3, fontWeight:700, letterSpacing:0.5, flexShrink:0, background:"rgba(26,107,55,0.07)", color:C.pri, border:"1.5px solid rgba(26,107,55,0.13)" }}>GR</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:2 }}>Graneros del Sur</div>
                        <div style={{ fontSize:12.1, color:C.t3 }}>Soja · 30 t · 25/02 08:00</div>
                      </div>
                      <div style={{ ..._badge, background:"#E8F5E9", color:"#43A047", fontSize:9.9, padding:"2px 7px" }}>A campo</div>
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:600, background:C.secPale, color:C.sec }}>
                        {Ic.truck(C.sec,10)}
                        Transp. Pérez
                      </span>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:600, background:C.bgInput, color:C.t2 }}>SCO 1234</span>
                    </div>
                  </div>
                  {/* Card 2 */}
                  <div style={_fc}>
                    <div style={_fh}>
                      <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14.3, fontWeight:700, letterSpacing:0.5, flexShrink:0, background:"rgba(255,106,0,0.08)", color:C.acc, border:"1.5px solid rgba(255,106,0,0.13)" }}>CA</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:2 }}>Campos del Litoral</div>
                        <div style={{ fontSize:12.1, color:C.t3 }}>Trigo · 28 t · 25/02 10:30</div>
                      </div>
                      <div style={{ ..._badge, background:"#E0F2E5", color:"#1A6B37", fontSize:9.9, padding:"2px 7px" }}>A planta</div>
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:600, background:C.secPale, color:C.sec }}>
                        {Ic.truck(C.sec,10)}
                        Logística Martínez
                      </span>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:6, fontSize:11, fontWeight:600, background:C.bgInput, color:C.t2 }}>SBY 5678</span>
                    </div>
                  </div>
                </div>
                {/* Solicitado group */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, padding:"0 2px" }}>
                    <div style={{ width:6, height:6, borderRadius:3, background:C.acc }} />
                    <span style={{ fontSize:12.1, fontWeight:700, color:C.t2 }}>Solicitado</span>
                    <span style={{ fontSize:11, color:C.t3, marginLeft:2 }}>1</span>
                  </div>
                  <div style={_fc}>
                    <div style={{ ..._fh, marginBottom:0 }}>
                      <div style={{ width:42, height:42, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14.3, fontWeight:700, letterSpacing:0.5, flexShrink:0, background:"rgba(202,138,4,0.08)", color:C.warn, border:"1.5px solid rgba(202,138,4,0.13)" }}>AG</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:2 }}>Agro San José</div>
                        <div style={{ fontSize:12.1, color:C.t3 }}>Maíz · 25 t · 26/02 07:00</div>
                      </div>
                      <div style={{ ..._badge, background:C.accPale, color:C.acc, fontSize:9.9, padding:"2px 7px" }}>Pendiente</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══ SECTION 10 · Plant Benefits ═══ */}
      <div className="tv-ld-section" style={_slide(C.w)}>
        <RoutesBackground opacityMul={0.3} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>Beneficios para la planta</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Control total de la operativa de ingreso</h2>
          <div style={{ ..._hr, marginBottom:44 }} />
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, maxWidth:740, margin:"0 auto", textAlign:"left" }}>
            {[
              { bg:C.priPale, icon:Ic.cal("#1A6B37",18), title:"Agenda de ingresos digital", desc:"Visualización clara de todos los fletes programados por día, con filtros por estado, origen y tipo de grano." },
              { bg:C.secPale, icon:Ic.truck("#0891B2",18), title:"Asignación directa de flota", desc:"Selección de transportista desde la plataforma con notificación inmediata. Sin intermediarios ni demoras." },
              { bg:C.accPale, icon:Ic.bell("#FF6A00",18), title:"Notificaciones en tiempo real", desc:"Alertas automáticas cuando un camión confirma, inicia viaje, carga o llega a destino. Sin necesidad de llamar." },
              { bg:C.priPale, icon:Ic.msg("#1A6B37",18), title:"Chat integrado por flete", desc:"Comunicación directa entre todos los actores del flete dentro de la plataforma. Historial completo y accesible." },
            ].map((c,i) => (
              <div key={i} style={{ ..._card, display:"flex", gap:14, alignItems:"flex-start", flex:"1 1 calc(50% - 8px)", minWidth:280 }}>
                <div style={{ ..._ibs, background:c.bg }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:4 }}>{c.title}</div>
                  <p style={_sm}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══ SECTION 11 · Security ═══ */}
      <div className="tv-ld-section" style={{ ..._slide(C.bg), padding:"48px 32px" }}>
        <RoutesBackground opacityMul={0.25} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <div className="tv-ld-sec11" style={{ display:"flex", gap:40, justifyContent:"center", flexWrap:"wrap", maxWidth:800, margin:"0 auto" }}>
            {[
              { bg:C.priPale, icon:Ic.shield(C.pri,18), title:"Autenticación segura", sub:"Sesiones protegidas con cookies HttpOnly" },
              { bg:C.secPale, icon:Ic.lock(C.sec,18), title:"Datos protegidos", sub:"Comunicación cifrada de extremo a extremo" },
              { bg:C.accPale, icon:Ic.eye(C.acc,18), title:"Trazabilidad completa", sub:"Registro detallado de cada acción" },
            ].map((c,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:c.bg }}>{c.icon}</div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:14.3, fontWeight:700, color:C.t1 }}>{c.title}</div>
                  <div style={{ fontSize:12.1, color:C.t3 }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══ SECTION 12 · Benefits + Closing ═══ */}
      <div className="tv-ld-section" style={_slide(C.w)}>
        <RoutesBackground opacityMul={0.3} />
        <div style={{..._cnt,position:"relative",zIndex:1}}>
          <span style={_tag}>Beneficios operativos y económicos</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Menos fricción, más eficiencia</h2>
          <div style={{ ..._hr, marginBottom:44 }} />
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, maxWidth:820, margin:"0 auto" }}>
            {[
              { bg:C.priPale, icon:Ic.clk("#1A6B37",22), color:C.pri, stat:"\u221270%", label:"Tiempo de coordinación", desc:"Eliminación de llamadas repetitivas y confirmaciones manuales entre actores." },
              { bg:C.accPale, icon:Ic.shield("#FF6A00",22), color:C.acc, stat:"100%", label:"Trazabilidad", desc:"Registro completo de cada flete con estados, marcas de tiempo y responsables identificados." },
              { bg:C.secPale, icon:Ic.nav("#0891B2",22), color:C.sec, stat:"Tiempo real", label:"Visibilidad operativa", desc:"Estado actualizado de cada camión y flete accesible desde cualquier dispositivo móvil." },
            ].map((c,i) => (
              <div key={i} style={{ ..._card, textAlign:"center", padding:"28px 20px", flex:"1 1 250px", minWidth:250 }}>
                <div style={{ ..._ib, background:c.bg, margin:"0 auto 16px" }}>{c.icon}</div>
                <div style={{ fontSize:30.8, fontWeight:800, color:c.color, marginBottom:4, letterSpacing:-1 }}>{c.stat}</div>
                <div style={{ fontSize:14.3, fontWeight:600, color:C.t1, marginBottom:4 }}>{c.label}</div>
                <p style={_sm}>{c.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop:48 }}>
            <p style={{ ..._p, maxWidth:500, margin:"0 auto 20px" }}>
              Tolvink se adapta a la realidad operativa del agro uruguayo.
              Sin hardware adicional. Sin capacitación compleja. Funciona desde el celular que ya tenés.
            </p>
            <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
              <span style={{ fontSize:35.2, fontWeight:800, color:C.pri, letterSpacing:-1.5, lineHeight:1 }}>tolvink</span>
              <span style={{ width:6, height:6, borderRadius:3, background:C.acc, marginLeft:2, marginTop:2, display:"inline-block" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PRESENTATION SECTIONS (from presentacion.html) ═══ */}
      <div id="tv-details" dangerouslySetInnerHTML={{__html: PRESENTATION_HTML}} />
    </div>
  );
}
