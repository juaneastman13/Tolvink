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

export default function LandingScreen({ onLogin, onSignup, onPasswordReset, loading, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);
  useUnlockScroll();

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
            Gestioná tus fletes desde WhatsApp con inteligencia artificial
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
        <div style={_cnt}>
          <span style={_tag}>Operación por WhatsApp</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Un agente inteligente como interfaz</h2>
          <p style={{ ..._p, maxWidth:520, margin:"0 auto 40px" }}>
            Todo el sistema puede operarse desde WhatsApp mediante un agente de inteligencia artificial que interpreta texto y audio, ejecuta acciones y responde con precisión. Sin descargar ninguna app.
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
                  { bg:C.priPale, icon:Ic.edit(C.pri,16), title:"Modificar y confirmar", desc:"Edita datos, cambia fechas y confirma operaciones sin salir de la conversación." },
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
        <div style={_cnt}>
          <span style={_tag}>Tres actores, una plataforma</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Cada rol opera como necesita</h2>
          <div style={{ ..._hr, marginBottom:28 }} />
          <p style={{ ..._p, maxWidth:560, margin:"0 auto 44px" }}>
            Tolvink se adapta a cada actor de la cadena. Todos pueden operar desde WhatsApp, la app o desde la plataforma web, según lo que les resulte más cómodo.
          </p>
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, textAlign:"left" }}>
            {[
              { bg:C.priPale, icon:SvgProducer(C.pri,22), title:"Productor", desc:"Creá fletes por WhatsApp, la app o desde la web. Definí grano, volumen, origen y destino. Seguí el estado en tiempo real y recibí confirmaciones automáticas sin hacer una sola llamada." },
              { bg:C.accPale, icon:Ic.plant("#FF6A00",22), title:"Planta acopiadora", desc:"Recibí solicitudes, asigná flota y confirmá recepción de mercadería. Todo desde un mensaje de WhatsApp, la app o desde el panel web con vista consolidada de operaciones." },
              { bg:C.secPale, icon:Ic.truck("#0891B2",20), title:"Transportista", desc:"Aceptá viajes, reportá carga y confirmá entrega directamente por WhatsApp. Sin descargar aplicaciones, sin aprender interfaces nuevas. El chofer opera desde el chat que ya usa todos los días. También puede operar desde la app o web." },
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
        <div style={_cnt}>
          <span style={_tag}>La solución al problema actual</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Eliminando la improvisación</h2>
          <div style={{ ..._hr, marginBottom:28 }} />
          <p style={{ ..._p, maxWidth:540, margin:"0 auto 44px" }}>
            La coordinación de fletes agrícolas en Uruguay sigue operando con herramientas fragmentadas: llamadas, mensajes sueltos y planillas sin actualización.
          </p>
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, maxWidth:720, margin:"0 auto", textAlign:"left" }}>
            {[
              { icon:Ic.phone("#DC2626",18), title:"Coordinación telefónica", desc:"Decenas de llamadas diarias entre productores, plantas y choferes para confirmar horarios, disponibilidad y estado de cada viaje." },
              { icon:Ic.doc("#DC2626",18), title:"Registros manuales", desc:"Planillas en papel o Excel sin actualización en tiempo real. Información duplicada, inconsistente o directamente perdida." },
              { icon:Ic.clk("#DC2626",18), title:"Cero visibilidad en tiempo real", desc:"No hay forma de saber dónde está un camión, si ya cargó, o cuándo llega. La respuesta siempre es \"llamá al chofer\"." },
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
        <div style={_cnt}>
          <span style={_tag}>Cómo funciona</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Del campo a la planta en un flujo continuo</h2>
          <div style={{ ..._hr, marginBottom:44 }} />
          <div className="tv-ld-steps" style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", width:"100%", maxWidth:820, margin:"0 auto", justifyContent:"center" }}>
            {[
              { bg:C.priPale, color:C.pri, num:"1", title:"Solicitud", desc:"El productor crea el flete indicando grano, volumen, origen y destino.", badgeBg:C.accPale, badgeC:C.acc, badge:"Pendiente" },
              { bg:C.secPale, color:C.sec, num:"2", title:"Asignación", desc:"La planta recibe la solicitud y asigna un transportista con flota disponible.", badgeBg:C.secPale, badgeC:C.sec, badge:"Asignando flota" },
              { bg:"#EFF6FF", color:"#2563EB", num:"3", title:"Confirmación", desc:"El transportista acepta el viaje. Los choferes reciben la asignación en su dispositivo.", badgeBg:"#EFF6FF", badgeC:"#2563EB", badge:"Confirmado" },
              { bg:"#ECFDF5", color:"#4ADE80", num:"4", title:"En curso", desc:"El flete avanza con seguimiento de estado: en viaje, cargado y entregado.", badgeBg:"#ECFDF5", badgeC:"#22C55E", badge:"En viaje" },
              { bg:C.priPale, color:C.pri, num:"5", title:"Finalización", desc:"La planta confirma recepción. El flete queda cerrado con registro completo.", badgeBg:C.priPale, badgeC:C.pri, badge:"Finalizado" },
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
        <div style={_cnt}>
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
                    <div style={_lbl}>{Ic.pin(C.t2,12)} Lote</div>
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
        <div style={_cnt}>
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
                  <div style={{ ..._badge, background:"#ECFDF5", color:"#4ADE80" }}>En curso</div>
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
        <div style={_cnt}>
          <span style={_tag}>Seguimiento en tiempo real</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Sabé dónde está cada camión, siempre</h2>
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
                      <div style={{ fontSize:11, color:C.t3 }}>En camino · Llegada est. 12:40</div>
                    </div>
                    <div style={{ ..._badge, background:"#ECFDF5", color:"#22C55E", fontSize:9.9, padding:"2px 7px" }}>En viaje</div>
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
                    <div style={{ ..._badge, background:"#DCFCE7", color:"#22C55E", fontSize:9.9, padding:"2px 7px" }}>Cargando</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* ═══ SECTION 9 · Operations Panel ═══ */}
      <div className="tv-ld-section" style={_slide(C.bg)}>
        <div style={_cnt}>
          <span style={_tag}>La aplicación</span>
          <h2 style={{ ..._h2, marginBottom:12 }}>Panel de operaciones</h2>
          <p style={{ ..._p, maxWidth:480, margin:"0 auto 36px" }}>
            Vista consolidada para plantas y empresas. Fletes agrupados por estado con acceso directo a cada operación y filtros por fecha, productor y transportista.
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
                      <div style={{ ..._badge, background:"#ECFDF5", color:"#4ADE80", fontSize:9.9, padding:"2px 7px" }}>En curso</div>
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
                      <div style={{ ..._badge, background:"#DCFCE7", color:"#22C55E", fontSize:9.9, padding:"2px 7px" }}>Cargando</div>
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
        <div style={_cnt}>
          <span style={_tag}>Beneficios para la planta</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Control total de la operativa de ingreso</h2>
          <div style={{ ..._hr, marginBottom:44 }} />
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, maxWidth:740, margin:"0 auto", textAlign:"left" }}>
            {[
              { bg:C.priPale, icon:Ic.cal("#1A6B37",18), title:"Agenda de ingresos digital", desc:"Visualización clara de todos los fletes programados por día, con filtros por estado, origen y tipo de grano." },
              { bg:C.secPale, icon:Ic.truck("#0891B2",18), title:"Asignación directa de flota", desc:"Selección de transportista desde la plataforma con notificación inmediata. Sin intermediarios ni demoras." },
              { bg:C.accPale, icon:Ic.bell("#FF6A00",18), title:"Notificaciones en tiempo real", desc:"Alertas push cuando un camión confirma, inicia viaje, carga o llega a destino. Sin necesidad de llamar." },
              { bg:C.priPale, icon:Ic.msg("#1A6B37",18), title:"Chat integrado por flete", desc:"Comunicación directa entre todos los actores del flete dentro de la plataforma. Historial completo accesible." },
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
        <div style={_cnt}>
          <div className="tv-ld-sec11" style={{ display:"flex", gap:40, justifyContent:"center", flexWrap:"wrap", maxWidth:800, margin:"0 auto" }}>
            {[
              { bg:C.priPale, icon:Ic.shield(C.pri,18), title:"Autenticación segura", sub:"Sesiones seguras con cookies HttpOnly" },
              { bg:C.secPale, icon:Ic.lock(C.sec,18), title:"Datos protegidos", sub:"Comunicación cifrada" },
              { bg:C.accPale, icon:Ic.eye(C.acc,18), title:"Trazabilidad completa", sub:"Registro de cada acción" },
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
        <div style={_cnt}>
          <span style={_tag}>Beneficios operativos y económicos</span>
          <h2 style={{ ..._h2, marginBottom:16 }}>Menos fricción, más eficiencia</h2>
          <div style={{ ..._hr, marginBottom:44 }} />
          <div className="tv-ld-cards" style={{ display:"flex", flexWrap:"wrap", gap:16, maxWidth:820, margin:"0 auto" }}>
            {[
              { bg:C.priPale, icon:Ic.clk("#1A6B37",22), color:C.pri, stat:"\u221270%", label:"Tiempo de coordinación", desc:"Eliminación de llamadas repetitivas y confirmaciones manuales entre actores." },
              { bg:C.accPale, icon:Ic.shield("#FF6A00",22), color:C.acc, stat:"100%", label:"Trazabilidad", desc:"Registro completo de cada flete con estados, timestamps y responsables identificados." },
              { bg:C.secPale, icon:Ic.nav("#0891B2",22), color:C.sec, stat:"Real-time", label:"Visibilidad operativa", desc:"Estado actualizado de cada camión y flete accesible desde cualquier dispositivo móvil." },
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
              Sin hardware adicional. Sin capacitación compleja. Funciona desde el celular.
            </p>
            <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
              <span style={{ fontSize:35.2, fontWeight:800, color:C.pri, letterSpacing:-1.5, lineHeight:1 }}>tolvink</span>
              <span style={{ width:6, height:6, borderRadius:3, background:C.acc, marginLeft:2, marginTop:2, display:"inline-block" }} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
