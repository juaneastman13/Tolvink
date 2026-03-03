import { useState, useEffect, useRef, useCallback } from "react";
import { C, FONT, Ic } from "../theme";
import { RoutesBackground } from "../routes-bg";
import AuthScreen from "./AuthScreen";

/* ── Hero demo conversations ──────────────────────────────────────── */
const DEMOS = [
  { msgs: [
    { from: "user", type: "text", time: "07:42", text: "Creame un flete de soja, 30 toneladas, del Lote 5 campo El Ombú a planta AGRITERRA, mañana a las 8" },
    { from: "bot", type: "text", time: "07:42", text: "✅ Flete preparado\n📦 Soja — 30 toneladas\n🗺️ Lote 5 — Campo El Ombú\n🏢 Planta: AGRITERRA\n📅 Mañana — 08:00\n\n¿Confirma la creación?" },
    { from: "user", type: "text", time: "07:43", text: "Sí" },
    { from: "bot", type: "text", time: "07:43", text: "✅ Flete F26-EOM.3041 creado\nLa planta ya fue notificada.\n\nSiguiente paso: la planta asignará transportista." },
  ] },
  { msgs: [
    { from: "user", type: "audio", time: "11:15", duration: "0:04", transcript: "Dónde va el flete que salió hoy" },
    { from: "bot", type: "text", time: "11:15", text: "🚛 Flete F26-EOM.3041\nEn camino — salió hace 1h 20min\n📍 Ubicación en vivo:\ntolvink.com/track/F26-EOM.3041\n\n👤 Chofer: Martín Rodríguez\n🕒 Llegada estimada: 12:40" },
  ] },
  { msgs: [
    { from: "user", type: "image", time: "15:22", label: "Ticket de balanza" },
    { from: "bot", type: "text", time: "15:22", text: "📎 Imagen recibida\nSe adjuntó al flete activo F26-EOM.3041" },
    { from: "user", type: "text", time: "15:23", text: "Confirmar carga, pesó 28.5 toneladas" },
    { from: "bot", type: "text", time: "15:23", text: "✅ Carga confirmada\n📦 28.5 toneladas registradas\n🚛 Flete F26-EOM.3041\n\nFalta la confirmación del productor para avanzar." },
  ] },
  { msgs: [
    { from: "user", type: "audio", time: "18:05", duration: "0:06", transcript: "Mandame el resumen de esta semana" },
    { from: "bot", type: "text", time: "18:05", text: "📊 Resumen semanal — AGRITERRA\n🚛 23 fletes completados\n📦 680 toneladas recibidas\n⏳ Tiempo promedio campo→planta: 2h 15min\n✅ 1 cancelación (chofer no disponible)\n\n👤 Transportistas destacados:\nTRANSCAR — 12 viajes, 4.9 ★\nLOGISUR — 8 viajes, 4.7 ★\n\n¿Desea el informe PDF completo?" },
  ] },
];
const WAVE = [4, 7, 10, 6, 12, 8, 4, 9, 11, 5, 7, 12, 8, 4, 10, 6, 9, 5];
const WA_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;

/* ── Shared styles for detail sections ─────────────────────────────── */
const _tag = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: C.acc, marginBottom: 8 };
const _h2 = { fontSize: 26, fontWeight: 800, color: C.t1, letterSpacing: -0.5, marginBottom: 12 };
const _dv = { width: 40, height: 3, borderRadius: 2, background: C.acc, margin: "0 auto 16px" };
const _p = { fontSize: 15, lineHeight: 1.6, color: C.t2, maxWidth: 640, margin: "0 auto 40px" };
const _card = { background: C.w, borderRadius: 14, border: `1px solid ${C.b2}`, padding: 24, boxShadow: C.sh };
const _ib = (bg, sz = 36) => ({ width: sz, height: sz, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
const _sec = (bg) => ({ background: bg, padding: "72px 24px", position: "relative", animation: "fadeUp 0.7s ease-out" });
const _inner = { maxWidth: 900, margin: "0 auto", textAlign: "center" };
const _phone = { borderRadius: 32, border: `1px solid ${C.b1}`, boxShadow: C.shMd, overflow: "hidden", background: C.w };
const _sbar = { padding: "6px 20px", textAlign: "center", fontSize: 11, fontWeight: 600, color: C.t2, background: C.w };
const _badge = (bg, c) => ({ fontSize: 9, fontWeight: 700, color: c, background: bg, padding: "2px 8px", borderRadius: 8, display: "inline-block" });

/* Bubble styles for section 1 chat mock */
const _rcv = { maxWidth: "80%", padding: "8px 10px", borderRadius: "14px 14px 14px 4px", background: C.w, border: `1px solid ${C.b2}`, fontSize: 12, lineHeight: 1.5, color: C.t1, textAlign: "left" };
const _snt = { maxWidth: "80%", padding: "8px 10px", borderRadius: "14px 14px 4px 14px", background: C.priPale, fontSize: 12, lineHeight: 1.5, color: C.t1, textAlign: "left" };
const _ts = { fontSize: 9, color: C.t3, marginTop: 4, textAlign: "right" };

/* Hero bubble styles */
const _heroBubble = { boxShadow: "0 1px 1px rgba(0,0,0,0.06)", fontFamily: FONT };
const _heroTime = { fontSize: 9, color: C.t3, textAlign: "right", marginTop: 2 };

/* ── Hero ChatDemo component ───────────────────────────────────────── */
function ChatDemo({ demo, visible }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 6, padding: 10, opacity: visible ? 1 : 0, transition: "opacity 0.5s ease", pointerEvents: visible ? "auto" : "none" }}>
      {demo.msgs.map((m, i) => {
        const isUser = m.from === "user";
        if (m.type === "audio") return (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "82%" }}>
              <div style={{ padding: "7px 10px", borderRadius: "10px 10px 2px 10px", background: "#DCF8C6", ..._heroBubble }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="12" height="14" viewBox="0 0 12 14" fill={C.t2} style={{ flexShrink: 0 }}><path d="M1 1v12l10-6z" /></svg>
                  <div style={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>{WAVE.map((h, j) => <div key={j} style={{ width: 2.5, height: h, borderRadius: 1.5, background: C.t3 }} />)}</div>
                  <span style={{ fontSize: 10, color: C.t3, flexShrink: 0 }}>{m.duration}</span>
                </div>
                <div style={_heroTime}>{m.time}</div>
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontStyle: "italic", marginTop: 3, textAlign: "right", paddingRight: 4 }}>&ldquo;{m.transcript}&rdquo;</div>
            </div>
          </div>
        );
        if (m.type === "image") return (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ padding: 5, borderRadius: "10px 10px 2px 10px", background: "#DCF8C6", ..._heroBubble }}>
              <div style={{ width: 190, height: 90, borderRadius: 8, background: C.bgInput, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {Ic.cam(C.t3, 22)}<span style={{ fontSize: 10, color: C.t3 }}>{m.label}</span>
              </div>
              <div style={{ ..._heroTime, paddingRight: 5, marginTop: 3 }}>{m.time}</div>
            </div>
          </div>
        );
        return (
          <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "7px 10px", borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px", background: isUser ? "#DCF8C6" : C.w, ..._heroBubble, fontSize: 11.5, lineHeight: 1.45, color: C.t1, whiteSpace: "pre-line", wordBreak: "break-word" }}>
              {!isUser && <div style={{ fontSize: 10, fontWeight: 700, color: C.pri, marginBottom: 2 }}>Tolvink IA</div>}
              {m.text}
              <div style={_heroTime}>{m.time}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function LandingScreen({ onLogin, onSignup, onPasswordReset, loading, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);
  const [demoIdx, setDemoIdx] = useState(0);
  const timerRef = useRef(null);
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDemoIdx(p => (p + 1) % DEMOS.length), 6000);
  }, []);
  useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, [resetTimer]);
  const pickDemo = useCallback((idx) => { setDemoIdx(idx); resetTimer(); }, [resetTimer]);

  if (showAuth) return <AuthScreen onLogin={onLogin} onSignup={onSignup} onPasswordReset={onPasswordReset} loading={loading} error={error} clearError={clearError} onBackToLanding={() => setShowAuth(false)} />;

  return (
    <div style={{ background: C.bg, fontFamily: FONT, overflowX: "hidden", WebkitOverflowScrolling: "touch", position: "relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;overflow:visible!important;overflow-x:hidden!important}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes splashIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}@keyframes truckPulse{0%,100%{box-shadow:0 2px 8px rgba(8,145,178,0.3)}50%{box-shadow:0 2px 16px rgba(8,145,178,0.5)}}.tv-ld-row{display:flex;gap:40px;align-items:flex-start}.tv-ld-g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.tv-ld-g3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.tv-ld-phone{width:310px;flex-shrink:0}.tv-ld-flow{display:flex;gap:0;align-items:flex-start;justify-content:center}.tv-ld-flow-line{width:40px;height:2px;background:${C.b1};flex-shrink:0;align-self:center;margin-top:24px}@media(max-width:767px){.tv-ld-tag{font-size:10px!important;letter-spacing:1.6px!important}.tv-ld-h1{font-size:17px!important}.tv-ld-feat{gap:14px!important}.tv-ld-feat svg{width:14px!important;height:14px!important}.tv-ld-feat span{font-size:9px!important}.tv-ld-logo{font-size:26px!important}.tv-ld-dot{width:6px!important;height:6px!important}.tv-ld-btn{font-size:14px!important;padding:12px 36px!important;min-width:220px!important}.tv-ld-chat{max-width:100%!important}.tv-ld-row{flex-direction:column!important;align-items:center!important;gap:32px!important}.tv-ld-g2,.tv-ld-g3{grid-template-columns:1fr!important}.tv-ld-phone{width:280px!important}.tv-ld-flow{flex-direction:column!important;align-items:center!important}.tv-ld-flow-line{width:2px!important;height:24px!important;margin-top:0!important}}`}</style>

      <RoutesBackground trucks centerFade />

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        {/* Header — logo top-left */}
        <div style={{ padding: "max(16px, env(safe-area-inset-top)) 24px 0" }}>
          <div style={{ animation: "splashIn 0.8s ease-out", display: "inline-flex", alignItems: "flex-start" }}>
            <span className="tv-ld-logo" style={{ fontSize: 32, fontWeight: 800, color: C.pri, letterSpacing: -1.5, lineHeight: 1 }}>tolvink</span>
            <span className="tv-ld-dot" style={{ width: 8, height: 8, borderRadius: 4, background: C.acc, marginLeft: 3, marginTop: 2, display: "inline-block", animation: "dotPulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Main hero content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px 16px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ animation: "fadeUp 0.8s ease-out", marginBottom: 24 }}>
            <div className="tv-ld-tag" style={{ fontSize: 12, fontWeight: 700, color: C.acc, textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 10 }}>Logística agrícola simplificada</div>
            <h1 className="tv-ld-h1" style={{ fontSize: 22, fontWeight: 700, color: C.t1, lineHeight: 1.3, letterSpacing: -0.3, maxWidth: 500 }}>Gestioná tus fletes desde WhatsApp con Inteligencia Artificial</h1>
          </div>
          <div className="tv-ld-feat" style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 28, animation: "fadeUp 1s ease-out", flexWrap: "wrap" }}>
            {[
              { icon: Ic.wa("#25D366", 18), label: "Operá desde WhatsApp" },
              { icon: Ic.truck(C.pri, 18), label: "Fletes" },
              { icon: Ic.pin(C.acc, 18), label: "Tracking" },
              { icon: Ic.chk(C.ok, 18), label: "Confirmaciones" },
              { icon: Ic.nav(C.sec, 18), label: "Rutas" },
            ].map((f, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>{f.icon}<span style={{ fontSize: 11, fontWeight: 600, color: C.t2 }}>{f.label}</span></div>)}
          </div>

          {/* Chat demo */}
          <div className="tv-ld-chat" style={{ maxWidth: 380, width: "100%", borderRadius: 14, background: "#E5DDD5", position: "relative", overflow: "hidden", boxShadow: C.shMd, marginBottom: 12, animation: "fadeUp 1.2s ease-out", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5bfb0' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
            <div style={{ background: "#075E54", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: C.pri, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 13, fontWeight: 800, color: C.w }}>T</span></div>
              <div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: C.w }}>Tolvink IA</span><span style={{ fontSize: 8, fontWeight: 700, color: C.w, background: "rgba(255,255,255,0.2)", padding: "1px 6px", borderRadius: 6 }}>Asistente</span></div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>en línea</div></div>
            </div>
            <div style={{ position: "relative", minHeight: 400 }}>{DEMOS.map((d, i) => <ChatDemo key={i} demo={d} visible={i === demoIdx} />)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
            {DEMOS.map((_, i) => <button key={i} onClick={() => pickDemo(i)} aria-label={`Demo ${i + 1}`} style={{ width: 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", padding: 0, background: i === demoIdx ? C.pri : C.b1, transition: "background 0.3s ease" }} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <a href="#ingresar" onClick={function (ev) { ev.preventDefault(); setShowAuth(true); }} className="tv-ld-btn" style={{ display: "inline-block", padding: "14px 42px", borderRadius: 12, background: C.pri, color: C.w, fontSize: 16, fontWeight: 700, textDecoration: "none", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", minWidth: 240, textAlign: "center", cursor: "pointer", WebkitTapHighlightColor: "rgba(0,0,0,0.1)" }}>Ingresar</a>
            <a href="https://wa.me/59898247552?text=Hola%2C%20quiero%20probar%20el%20asistente%20Tolvink" target="_blank" rel="noopener noreferrer" className="tv-ld-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 42px", borderRadius: 12, background: "#25D366", color: C.w, fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "inherit", minWidth: 240, textAlign: "center", cursor: "pointer", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}>{WA_ICON}Probá el asistente en WhatsApp</a>
          </div>
        </div>

        {/* Hero footer */}
        <div style={{ textAlign: "center", padding: "16px 24px", paddingBottom: "max(16px, env(safe-area-inset-bottom))", fontSize: 10, color: C.t3 }}>Logística agrícola inteligente · Uruguay</div>
      </div>

      {/* ═══════════════════════ DETAIL SECTIONS ═══════════════════════ */}

      {/* ── Section 1: Operación por WhatsApp ── */}
      <div style={_sec(C.w)}>
        <div style={_inner}>
          <div style={_tag}>Operación por WhatsApp</div>
          <h2 style={_h2}>Un agente inteligente como interfaz</h2>
          <div style={_dv} />
          <p style={_p}>Todo el sistema puede operarse desde WhatsApp mediante un agente de inteligencia artificial que interpreta texto y audio, ejecuta acciones y responde con precisión. Sin descargar ninguna app.</p>
        </div>
        <div className="tv-ld-row" style={{ maxWidth: 900, margin: "0 auto", justifyContent: "center" }}>
          {/* Phone chat mock */}
          <div className="tv-ld-phone" style={_phone}>
            <div style={_sbar}>9:41</div>
            <div style={{ background: C.w, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.b2}` }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: C.pri, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 15, fontWeight: 800, color: C.w }}>t</span></div>
                <div style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: 4, background: C.acc, border: `2px solid ${C.w}` }} />
              </div>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Tolvink</div><div style={{ fontSize: 10, color: C.pri }}>en línea</div></div>
            </div>
            <div style={{ padding: 10, background: C.bg, display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Received: greeting */}
              <div style={{ display: "flex" }}><div style={_rcv}>Buenos días. ¿En qué puedo ayudarte?<div style={_ts}>09:12</div></div></div>
              {/* Sent: audio */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: "80%" }}>
                  <div style={_snt}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.b1 }}><div style={{ width: "75%", height: 4, borderRadius: 2, background: C.pri }} /></div>
                      <span style={{ fontSize: 10, color: C.t3 }}>0:08</span>
                    </div>
                    <div style={_ts}>09:13</div>
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, fontStyle: "italic", marginTop: 3, textAlign: "right" }}>&ldquo;Necesito mandar 30 toneladas de soja mañana desde La Rinconada a Dolores&rdquo;</div>
                </div>
              </div>
              {/* Received: solicitud creada */}
              <div style={{ display: "flex" }}>
                <div style={_rcv}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Solicitud creada</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                    <span style={{ color: C.t3 }}>Grano:</span> <span style={{ fontWeight: 600 }}>Soja · 30 t</span><br />
                    <span style={{ color: C.t3 }}>Origen:</span> <span style={{ fontWeight: 600 }}>Est. La Rinconada</span><br />
                    <span style={{ color: C.t3 }}>Destino:</span> <span style={{ fontWeight: 600 }}>Planta Dolores</span><br />
                    <span style={{ color: C.t3 }}>Fecha:</span> <span style={{ fontWeight: 600 }}>26/02 · 08:00</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.b2}`, marginTop: 8, paddingTop: 8, fontSize: 11 }}>Transporte Pérez fue notificado y tiene disponibilidad. ¿Confirmo la asignación?</div>
                  <div style={_ts}>09:13</div>
                </div>
              </div>
              {/* Sent: confirm */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}><div style={_snt}>Sí, confirmá.<div style={_ts}>09:14</div></div></div>
              {/* Received: assigned */}
              <div style={{ display: "flex" }}>
                <div style={_rcv}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>{Ic.chk(C.ok, 14)}<span style={{ fontWeight: 600 }}>Flete asignado</span></div>
                  Transporte Pérez confirmado. El chofer recibirá los datos del viaje.
                  <div style={_ts}>09:14</div>
                </div>
              </div>
            </div>
          </div>

          {/* Capabilities list */}
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 20 }}>Capacidades del agente</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { bg: C.priPale, icon: Ic.msg(C.pri, 16), title: "Texto y audio", desc: "Interpreta mensajes escritos y notas de voz con la misma precisión." },
                { bg: C.accPale, icon: Ic.plus(C.acc, 16), title: "Crear solicitudes", desc: "Genera fletes completos a partir de instrucciones en lenguaje natural." },
                { bg: C.secPale, icon: Ic.truck(C.sec, 16), title: "Asignar transportistas", desc: "Selecciona y notifica al transportista adecuado según disponibilidad." },
                { bg: "#EFF6FF", icon: Ic.srch("#2563EB", 16), title: "Consultar estados", desc: "Responde al instante sobre ubicación, estado y datos de cualquier flete activo." },
                { bg: C.priPale, icon: Ic.edit(C.pri, 16), title: "Modificar y confirmar", desc: "Edita datos, cambia fechas y confirma operaciones sin salir de la conversación." },
              ].map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={_ib(c.bg)}>{c.icon}</div>
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 2 }}>{c.title}</div><div style={{ fontSize: 12, lineHeight: 1.5, color: C.t2 }}>{c.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Tres actores ── */}
      <div style={_sec(C.bg)}>
        <div style={_inner}>
          <div style={_tag}>Tres actores, una plataforma</div>
          <h2 style={_h2}>Cada rol opera como necesita</h2>
          <div style={_dv} />
          <p style={_p}>Tolvink se adapta a cada actor de la cadena. Todos pueden operar desde WhatsApp o desde la plataforma web, según lo que les resulte más cómodo.</p>
        </div>
        <div className="tv-ld-g3" style={{ maxWidth: 900, margin: "0 auto" }}>
          {[
            { bg: C.priPale, icon: Ic.grain(C.pri, 22), title: "Productor", desc: "Creá fletes por WhatsApp o desde la web. Definí grano, volumen, origen y destino. Seguí el estado en tiempo real y recibí confirmaciones automáticas sin hacer una sola llamada." },
            { bg: C.accPale, icon: Ic.plant(C.acc, 22), title: "Planta acopiadora", desc: "Recibí solicitudes, asigná flota y confirmá recepción de mercadería. Todo desde un mensaje de WhatsApp o desde el panel web con vista consolidada de operaciones." },
            { bg: C.secPale, icon: Ic.truck(C.sec, 20), title: "Transportista", desc: "Aceptá viajes, reportá carga y confirmá entrega directamente por WhatsApp. Sin descargar aplicaciones, sin aprender interfaces nuevas. El chofer opera desde el chat que ya usa todos los días." },
          ].map((c, i) => (
            <div key={i} style={{ ..._card, textAlign: "left", transition: "box-shadow 0.2s, transform 0.2s" }}>
              <div style={{ ..._ib(c.bg, 44), marginBottom: 16 }}>{c.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 8 }}>{c.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: C.t2 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: El problema actual ── */}
      <div style={_sec(C.w)}>
        <div style={_inner}>
          <div style={_tag}>El problema actual</div>
          <h2 style={_h2}>Un sistema que depende de la improvisación</h2>
          <div style={_dv} />
          <p style={_p}>La coordinación de fletes agrícolas en Uruguay sigue operando con herramientas fragmentadas. En una planta mediana del interior, el encargado hace 40+ llamadas diarias solo para coordinar ingresos.</p>
        </div>
        <div className="tv-ld-g2" style={{ maxWidth: 900, margin: "0 auto" }}>
          {[
            { icon: Ic.phone(C.err, 18), title: "Coordinación telefónica", desc: "Decenas de llamadas diarias entre productores, plantas y choferes para confirmar horarios, disponibilidad y estado de cada viaje." },
            { icon: Ic.doc(C.err, 18), title: "Registros manuales", desc: "Planillas en papel o Excel sin actualización en tiempo real. Información duplicada, inconsistente o directamente perdida." },
            { icon: Ic.clk(C.err, 18), title: "Cero visibilidad en tiempo real", desc: "No hay forma de saber dónde está un camión, si ya cargó, o cuándo llega. La respuesta siempre es llamá al chofer." },
            { icon: Ic.warn(C.err, 18), title: "Errores y demoras evitables", desc: "Camiones vacíos esperando, cargas duplicadas, destinos equivocados. Cada error tiene un costo directo en la operación." },
          ].map((c, i) => (
            <div key={i} style={{ ..._card, display: "flex", gap: 14, textAlign: "left" }}>
              <div style={_ib(C.errPale, 40)}>{c.icon}</div>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{c.title}</div><div style={{ fontSize: 12, lineHeight: 1.6, color: C.t2 }}>{c.desc}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: Cómo funciona ── */}
      <div style={_sec(C.bg)}>
        <div style={_inner}>
          <div style={_tag}>Cómo funciona</div>
          <h2 style={_h2}>Del campo a la planta en un flujo continuo</h2>
          <div style={_dv} />
        </div>
        <div className="tv-ld-flow" style={{ maxWidth: 900, margin: "0 auto" }}>
          {[
            { bg: C.priPale, c: C.pri, n: "1", title: "Solicitud", desc: "El productor crea el flete indicando grano, volumen, origen y destino.", badge: "Pendiente", bc: C.accPale, bt: C.acc },
            { bg: C.secPale, c: C.sec, n: "2", title: "Asignación", desc: "La planta recibe la solicitud y asigna un transportista con flota disponible.", badge: "Asignando flota", bc: C.secPale, bt: C.sec },
            { bg: "#EFF6FF", c: "#2563EB", n: "3", title: "Confirmación", desc: "El transportista acepta el viaje. Los choferes reciben la asignación.", badge: "Confirmado", bc: "#DBEAFE", bt: "#2563EB" },
            { bg: "#ECFDF5", c: "#4ADE80", n: "4", title: "En curso", desc: "El flete avanza con seguimiento de estado: en viaje, cargado y entregado.", badge: "En viaje", bc: "#DCFCE7", bt: "#16A34A" },
            { bg: C.priPale, c: C.pri, n: "5", title: "Finalización", desc: "La planta confirma recepción. El flete queda cerrado con registro completo.", badge: "Finalizado", bc: C.priPale, bt: C.pri },
          ].map((s, i, arr) => (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flex: 1, minWidth: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: s.c, marginBottom: 12 }}>{s.n}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: C.t2, marginBottom: 8, maxWidth: 140 }}>{s.desc}</div>
                <span style={_badge(s.bc, s.bt)}>{s.badge}</span>
              </div>
              {i < arr.length - 1 && <div className="tv-ld-flow-line" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 5: Solicitud de viaje (phone mock) ── */}
      <div style={_sec(C.w)}>
        <div style={_inner}>
          <div style={_tag}>La aplicación</div>
          <h2 style={_h2}>Solicitud de viaje</h2>
          <div style={_dv} />
          <p style={_p}>El productor completa el formulario con datos del grano, cantidades, origen y destino. El sistema valida cada sección antes de habilitar la siguiente.</p>
        </div>
        <div className="tv-ld-phone" style={{ ..._phone, margin: "0 auto" }}>
          <div style={_sbar}>9:41</div>
          <div style={{ background: C.w, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.b2}` }}>
            {Ic.chev(C.pri, 20)}<span style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Nuevo flete</span>
          </div>
          <div style={{ padding: 12, background: C.bg, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Producto — completed */}
            <div style={{ background: C.w, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.b2}` }}>
              {Ic.chk(C.ok, 16)}<span style={{ fontSize: 13, fontWeight: 600, color: C.t1, flex: 1 }}>Producto</span>
              <span style={_badge(C.priPale, C.pri)}>Soja</span>
            </div>
            {/* Cantidad — completed */}
            <div style={{ background: C.w, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.b2}` }}>
              {Ic.chk(C.ok, 16)}<span style={{ fontSize: 13, fontWeight: 600, color: C.t1, flex: 1 }}>Cantidad</span>
              <span style={_badge(C.priPale, C.pri)}>30 t</span>
            </div>
            {/* Origen — active */}
            <div style={{ background: C.w, borderRadius: 12, padding: "12px 14px", borderLeft: `3px solid ${C.acc}`, border: `1px solid ${C.b2}`, borderLeftColor: C.acc, borderLeftWidth: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 8 }}>Origen</div>
              <div style={{ background: C.bgInput, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.t1, marginBottom: 6 }}>Est. La Rinconada</div>
              <div style={{ background: C.bgInput, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.t3 }}>Seleccionar lote...</div>
            </div>
            {/* Destino — locked */}
            <div style={{ background: C.w, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.b2}`, opacity: 0.4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Destino</span>
            </div>
            {/* Fecha — locked */}
            <div style={{ background: C.w, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.b2}`, opacity: 0.4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Fecha y hora</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 6: Detalle del flete (phone mock) ── */}
      <div style={_sec(C.bg)}>
        <div style={_inner}>
          <div style={_tag}>La aplicación</div>
          <h2 style={_h2}>Detalle y gestión del flete</h2>
          <div style={_dv} />
          <p style={_p}>Cada flete cuenta con una vista completa de su estado, actores involucrados, datos logísticos y acciones disponibles según el rol del usuario.</p>
        </div>
        <div className="tv-ld-phone" style={{ ..._phone, margin: "0 auto" }}>
          <div style={_sbar}>9:41</div>
          {/* Header */}
          <div style={{ background: C.w, padding: "12px 16px", borderBottom: `1px solid ${C.b2}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.pri }}>GR</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Graneros del Sur</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: C.t3 }}>FL-2025-0847</span>
                  <span style={_badge(C.priPale, C.pri)}>En curso</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: 12, background: C.bg, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Carga */}
            <div style={{ background: C.w, borderRadius: 12, padding: 14, border: `1px solid ${C.b2}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Carga</div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <div><span style={{ color: C.t3 }}>Grano</span><div style={{ fontWeight: 600, color: C.t1 }}>Soja</div></div>
                <div><span style={{ color: C.t3 }}>Cantidad</span><div style={{ fontWeight: 600, color: C.t1 }}>30 t</div></div>
                <div><span style={{ color: C.t3 }}>Fecha</span><div style={{ fontWeight: 600, color: C.t1 }}>25/02</div></div>
              </div>
            </div>
            {/* Recorrido */}
            <div style={{ background: C.w, borderRadius: 12, padding: 14, border: `1px solid ${C.b2}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Recorrido</div>
              <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, paddingTop: 2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: C.pri }} />
                  <div style={{ width: 2, flex: 1, background: C.b1 }} />
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: C.acc }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 12, gap: 16 }}>
                  <div><div style={{ fontWeight: 600, color: C.t1 }}>Est. La Rinconada</div><div style={{ fontSize: 10, color: C.t3 }}>Lote 4</div></div>
                  <div><div style={{ fontWeight: 600, color: C.t1 }}>Planta Dolores</div><div style={{ fontSize: 10, color: C.t3 }}>Suc. 1</div></div>
                </div>
              </div>
            </div>
            {/* Transporte */}
            <div style={{ background: C.w, borderRadius: 12, padding: 14, border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: C.secPale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.sec }}>ML</div>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Mario López</div><div style={{ fontSize: 10, color: C.t3 }}>SCO 1234 · Transporte Pérez</div></div>
            </div>
            {/* Action */}
            <div style={{ background: C.acc, borderRadius: 12, padding: "12px 16px", textAlign: "center", color: C.w, fontWeight: 700, fontSize: 14 }}>Confirmar carga</div>
          </div>
        </div>
      </div>

      {/* ── Section 7: Tracking en vivo (phone mock) ── */}
      <div style={_sec(C.w)}>
        <div style={_inner}>
          <div style={_tag}>Seguimiento en tiempo real</div>
          <h2 style={_h2}>Sabé dónde está cada camión, siempre</h2>
          <div style={_dv} />
          <p style={_p}>GPS en vivo con ubicación del chofer actualizada automáticamente. Sin llamadas, sin preguntar dónde estás. El mapa muestra todos los fletes activos del día.</p>
        </div>
        <div className="tv-ld-phone" style={{ ..._phone, margin: "0 auto" }}>
          <div style={_sbar}>9:41</div>
          <div style={{ background: C.w, padding: "12px 16px", textAlign: "center", borderBottom: `1px solid ${C.b2}`, fontSize: 16, fontWeight: 700, color: C.t1 }}>Mapa del día</div>
          {/* Fake map */}
          <div style={{ position: "relative", height: 220, background: "linear-gradient(135deg, #E8F0E8 0%, #D8E8D8 100%)", overflow: "hidden" }}>
            {/* Decorative route lines */}
            <div style={{ position: "absolute", top: 60, left: 30, width: 200, height: 2, background: C.t3, opacity: 0.15, transform: "rotate(15deg)" }} />
            <div style={{ position: "absolute", top: 120, left: 50, width: 160, height: 2, background: C.t3, opacity: 0.15, transform: "rotate(-10deg)" }} />
            {/* Origin pin */}
            <div style={{ position: "absolute", top: 40, left: 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: C.pri, border: "2px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: C.t1, background: "rgba(255,255,255,0.9)", padding: "1px 4px", borderRadius: 3, marginTop: 2 }}>La Rinconada</span>
            </div>
            {/* Destination pin */}
            <div style={{ position: "absolute", bottom: 40, right: 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: C.acc, border: "2px solid white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: C.t1, background: "rgba(255,255,255,0.9)", padding: "1px 4px", borderRadius: 3, marginTop: 2 }}>Planta Dolores</span>
            </div>
            {/* Truck 1 */}
            <div style={{ position: "absolute", top: 90, left: 120, width: 28, height: 28, borderRadius: 8, background: C.sec, display: "flex", alignItems: "center", justifyContent: "center", animation: "truckPulse 2s ease-in-out infinite" }}>{Ic.truck(C.w, 14)}</div>
            {/* Truck 2 */}
            <div style={{ position: "absolute", top: 140, left: 70, width: 28, height: 28, borderRadius: 8, background: C.sec, display: "flex", alignItems: "center", justifyContent: "center", animation: "truckPulse 2s ease-in-out infinite 0.5s" }}>{Ic.truck(C.w, 14)}</div>
          </div>
          {/* Status cards */}
          <div style={{ padding: 10, background: C.bg, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ background: C.w, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>SCO 1234 · Mario López</div><div style={{ fontSize: 10, color: C.t3 }}>En camino · Llegada est. 12:40</div></div>
              <span style={_badge(C.secPale, C.sec)}>En viaje</span>
            </div>
            <div style={{ background: C.w, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.b2}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>SBY 5678 · Juan Martínez</div><div style={{ fontSize: 10, color: C.t3 }}>Cargando en origen</div></div>
              <span style={_badge(C.accPale, C.acc)}>Cargando</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 8: Panel de operaciones (phone mock) ── */}
      <div style={_sec(C.bg)}>
        <div style={_inner}>
          <div style={_tag}>La aplicación</div>
          <h2 style={_h2}>Panel de operaciones</h2>
          <div style={_dv} />
          <p style={_p}>Vista consolidada para plantas y empresas. Fletes agrupados por estado con acceso directo a cada operación y filtros por fecha, productor y transportista.</p>
        </div>
        <div className="tv-ld-phone" style={{ ..._phone, margin: "0 auto" }}>
          <div style={_sbar}>9:41</div>
          <div style={{ background: C.w, padding: "12px 16px", borderBottom: `1px solid ${C.b2}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 11, color: C.t3 }}>Planta Dolores</div><div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>Hoy</div></div>
              <div style={{ display: "flex", gap: 12 }}>{Ic.bell(C.t3, 18)}{Ic.menu3(C.t2, 18)}</div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", background: C.w, borderBottom: `1px solid ${C.b2}` }}>
            <div style={{ flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12, fontWeight: 700, color: C.pri, borderBottom: `2px solid ${C.pri}` }}>Resumen</div>
            <div style={{ flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12, fontWeight: 500, color: C.t3 }}>Listado</div>
            <div style={{ flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12, fontWeight: 500, color: C.t3 }}>Mapa</div>
          </div>
          <div style={{ padding: 10, background: C.bg, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Group: En curso */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, display: "flex", alignItems: "center", gap: 6 }}>En curso <span style={{ fontSize: 10, color: C.t3 }}>(3)</span></div>
            {[
              { initials: "GS", c: C.pri, name: "Graneros del Sur", grain: "Soja 30t", status: "En curso", sb: C.priPale, sc: C.pri, tags: ["Transp. Pérez", "SCO 1234"] },
              { initials: "CL", c: C.sec, name: "Campos del Litoral", grain: "Trigo 28t", status: "Cargando", sb: C.accPale, sc: C.acc, tags: ["Logística Martínez", "SBY 5678"] },
            ].map((f, i) => (
              <div key={i} style={{ background: C.w, borderRadius: 12, padding: 12, border: `1px solid ${C.b2}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: `${f.c}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: f.c, flexShrink: 0 }}>{f.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{f.name}</span>
                    <span style={_badge(f.sb, f.sc)}>{f.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>{f.grain}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{f.tags.map((t, j) => <span key={j} style={{ fontSize: 9, color: C.t3, background: C.bgInput, padding: "1px 6px", borderRadius: 4 }}>{t}</span>)}</div>
                </div>
              </div>
            ))}
            {/* Group: Solicitado */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>Solicitado <span style={{ fontSize: 10, color: C.t3 }}>(1)</span></div>
            <div style={{ background: C.w, borderRadius: 12, padding: 12, border: `1px solid ${C.b2}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: `${C.acc}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.acc, flexShrink: 0 }}>AS</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>Agro San José</span>
                  <span style={_badge(C.accPale, C.acc)}>Pendiente</span>
                </div>
                <div style={{ fontSize: 11, color: C.t2 }}>Maíz 25t</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 9: Beneficios para la planta ── */}
      <div style={_sec(C.w)}>
        <div style={_inner}>
          <div style={_tag}>Beneficios para la planta</div>
          <h2 style={_h2}>Control total de la operativa de ingreso</h2>
          <div style={_dv} />
        </div>
        <div className="tv-ld-g2" style={{ maxWidth: 900, margin: "0 auto" }}>
          {[
            { bg: C.priPale, icon: Ic.cal(C.pri, 18), title: "Agenda de ingresos digital", desc: "Visualización clara de todos los fletes programados por día, con filtros por estado, origen y tipo de grano." },
            { bg: C.secPale, icon: Ic.truck(C.sec, 18), title: "Asignación directa de flota", desc: "Selección de transportista desde la plataforma con notificación inmediata. Sin intermediarios ni demoras." },
            { bg: C.accPale, icon: Ic.bell(C.acc, 18), title: "Notificaciones en tiempo real", desc: "Alertas push cuando un camión confirma, inicia viaje, carga o llega a destino. Sin necesidad de llamar." },
            { bg: C.priPale, icon: Ic.msg(C.pri, 18), title: "Chat integrado por flete", desc: "Comunicación directa entre todos los actores del flete dentro de la plataforma. Historial completo accesible." },
          ].map((c, i) => (
            <div key={i} style={{ ..._card, display: "flex", gap: 14, textAlign: "left" }}>
              <div style={_ib(c.bg)}>{c.icon}</div>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{c.title}</div><div style={{ fontSize: 12, lineHeight: 1.6, color: C.t2 }}>{c.desc}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 10: Seguridad ── */}
      <div style={{ ..._sec(C.bg), padding: "48px 24px" }}>
        <div className="tv-ld-g3" style={{ maxWidth: 700, margin: "0 auto" }}>
          {[
            { bg: C.priPale, icon: Ic.shield(C.pri, 18), title: "Autenticación segura", desc: "JWT con tokens firmados" },
            { bg: C.secPale, icon: Ic.lock(C.sec, 18), title: "Datos protegidos", desc: "Comunicación cifrada" },
            { bg: C.accPale, icon: Ic.eye(C.acc, 18), title: "Trazabilidad completa", desc: "Registro de cada acción" },
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
              <div style={_ib(c.bg)}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: C.t2 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 11: Beneficios operativos + cierre ── */}
      <div style={_sec(C.w)}>
        <div style={_inner}>
          <div style={_tag}>Beneficios operativos y económicos</div>
          <h2 style={_h2}>Menos fricción, más eficiencia</h2>
          <div style={_dv} />
        </div>
        <div className="tv-ld-g3" style={{ maxWidth: 900, margin: "0 auto", marginBottom: 48 }}>
          {[
            { bg: C.priPale, icon: Ic.clk(C.pri, 22), stat: "−70%", sc: C.pri, title: "Tiempo de coordinación", desc: "Eliminación de llamadas repetitivas y confirmaciones manuales entre actores." },
            { bg: C.accPale, icon: Ic.shield(C.acc, 22), stat: "100%", sc: C.acc, title: "Trazabilidad", desc: "Registro completo de cada flete con estados, timestamps y responsables identificados." },
            { bg: C.secPale, icon: Ic.nav(C.sec, 22), stat: "Real-time", sc: C.sec, title: "Visibilidad operativa", desc: "Estado actualizado de cada camión y flete accesible desde cualquier dispositivo móvil." },
          ].map((c, i) => (
            <div key={i} style={{ ..._card, textAlign: "center" }}>
              <div style={{ ..._ib(c.bg, 44), margin: "0 auto 12px" }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.sc, marginBottom: 4 }}>{c.stat}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: C.t2 }}>{c.desc}</div>
            </div>
          ))}
        </div>
        {/* Closing */}
        <div style={{ textAlign: "center", maxWidth: 500, margin: "0 auto", paddingBottom: 24 }}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: C.t2, marginBottom: 24 }}>Tolvink se adapta a la realidad operativa del agro uruguayo. Sin hardware adicional. Sin capacitación compleja. Funciona desde el celular.</p>
          <div style={{ display: "inline-flex", alignItems: "flex-start" }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: C.pri, letterSpacing: -1.5, lineHeight: 1 }}>tolvink</span>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: C.acc, marginLeft: 3, marginTop: 2, display: "inline-block" }} />
          </div>
        </div>
      </div>

    </div>
  );
}
