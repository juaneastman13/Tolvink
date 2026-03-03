import { useState, useEffect, useRef, useCallback } from "react";
import { C, FONT, Ic } from "../theme";
import { RoutesBackground } from "../routes-bg";
import AuthScreen from "./AuthScreen";

/* ── 4 demo conversations ─────────────────────────────────────────── */
const DEMOS = [
  { // 1 — Crear flete por texto (productor)
    msgs: [
      { from: "user", type: "text", time: "07:42", text: "Creame un flete de soja, 30 toneladas, del Lote 5 campo El Ombú a planta AGRITERRA, mañana a las 8" },
      { from: "bot", type: "text", time: "07:42", text: "✅ Flete preparado\n📦 Soja — 30 toneladas\n🗺️ Lote 5 — Campo El Ombú\n🏢 Planta: AGRITERRA\n📅 Mañana — 08:00\n\n¿Confirma la creación?" },
      { from: "user", type: "text", time: "07:43", text: "Sí" },
      { from: "bot", type: "text", time: "07:43", text: "✅ Flete F26-EOM.3041 creado\nLa planta ya fue notificada.\n\nSiguiente paso: la planta asignará transportista." },
    ],
  },
  { // 2 — Audio + seguimiento en vivo
    msgs: [
      { from: "user", type: "audio", time: "11:15", duration: "0:04", transcript: "Dónde va el flete que salió hoy" },
      { from: "bot", type: "text", time: "11:15", text: "🚛 Flete F26-EOM.3041\nEn camino — salió hace 1h 20min\n📍 Ubicación en vivo:\ntolvink.com/track/F26-EOM.3041\n\n👤 Chofer: Martín Rodríguez\n🕒 Llegada estimada: 12:40" },
    ],
  },
  { // 3 — Adjuntar foto + confirmación de carga
    msgs: [
      { from: "user", type: "image", time: "15:22", label: "Ticket de balanza" },
      { from: "bot", type: "text", time: "15:22", text: "📎 Imagen recibida\nSe adjuntó al flete activo F26-EOM.3041" },
      { from: "user", type: "text", time: "15:23", text: "Confirmar carga, pesó 28.5 toneladas" },
      { from: "bot", type: "text", time: "15:23", text: "✅ Carga confirmada\n📦 28.5 toneladas registradas\n🚛 Flete F26-EOM.3041\n\nFalta la confirmación del productor para avanzar." },
    ],
  },
  { // 4 — Resumen semanal por audio
    msgs: [
      { from: "user", type: "audio", time: "18:05", duration: "0:06", transcript: "Mandame el resumen de esta semana" },
      { from: "bot", type: "text", time: "18:05", text: "📊 Resumen semanal — AGRITERRA\n🚛 23 fletes completados\n📦 680 toneladas recibidas\n⏳ Tiempo promedio campo→planta: 2h 15min\n✅ 1 cancelación (chofer no disponible)\n\n👤 Transportistas destacados:\nTRANSCAR — 12 viajes, 4.9 ★\nLOGISUR — 8 viajes, 4.7 ★\n\n¿Desea el informe PDF completo?" },
    ],
  },
];

/* Decorative waveform bar heights for audio bubbles */
const WAVE = [4, 7, 10, 6, 12, 8, 4, 9, 11, 5, 7, 12, 8, 4, 10, 6, 9, 5];

/* WhatsApp icon (white fill for green button) */
const WA_ICON = <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;

/* ── Bubble styles ─────────────────────────────────────────────────── */
const bubbleBase = { boxShadow: "0 1px 1px rgba(0,0,0,0.06)", fontFamily: FONT };
const userBg = "#DCF8C6";
const userRadius = "10px 10px 2px 10px";
const botRadius = "10px 10px 10px 2px";
const timeStyle = { fontSize: 9, color: C.t3, textAlign: "right", marginTop: 2 };

/* ── ChatDemo — renders one conversation with crossfade ────────────── */
function ChatDemo({ demo, visible }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 6,
      padding: 10, opacity: visible ? 1 : 0,
      transition: "opacity 0.5s ease", pointerEvents: visible ? "auto" : "none",
    }}>
      {demo.msgs.map((m, i) => {
        const isUser = m.from === "user";

        /* ── Audio bubble ── */
        if (m.type === "audio") {
          return (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ maxWidth: "82%" }}>
                <div style={{
                  padding: "7px 10px", borderRadius: userRadius,
                  background: userBg, ...bubbleBase,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Play triangle */}
                    <svg width="12" height="14" viewBox="0 0 12 14" fill={C.t2} style={{ flexShrink: 0 }}>
                      <path d="M1 1v12l10-6z" />
                    </svg>
                    {/* Waveform bars */}
                    <div style={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
                      {WAVE.map((h, j) => (
                        <div key={j} style={{ width: 2.5, height: h, borderRadius: 1.5, background: C.t3 }} />
                      ))}
                    </div>
                    {/* Duration */}
                    <span style={{ fontSize: 10, color: C.t3, flexShrink: 0 }}>{m.duration}</span>
                  </div>
                  <div style={timeStyle}>{m.time}</div>
                </div>
                {/* Transcript below bubble */}
                <div style={{ fontSize: 10, color: C.t3, fontStyle: "italic", marginTop: 3, textAlign: "right", paddingRight: 4 }}>
                  &ldquo;{m.transcript}&rdquo;
                </div>
              </div>
            </div>
          );
        }

        /* ── Image bubble ── */
        if (m.type === "image") {
          return (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                padding: 5, borderRadius: userRadius,
                background: userBg, ...bubbleBase,
              }}>
                <div style={{
                  width: 190, height: 90, borderRadius: 8,
                  background: C.bgInput,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  {Ic.cam(C.t3, 22)}
                  <span style={{ fontSize: 10, color: C.t3 }}>{m.label}</span>
                </div>
                <div style={{ ...timeStyle, paddingRight: 5, marginTop: 3 }}>{m.time}</div>
              </div>
            </div>
          );
        }

        /* ── Text bubble (user or bot) ── */
        return (
          <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "7px 10px",
              borderRadius: isUser ? userRadius : botRadius,
              background: isUser ? userBg : C.w,
              ...bubbleBase,
              fontSize: 11.5, lineHeight: 1.45, color: C.t1,
              whiteSpace: "pre-line", wordBreak: "break-word",
            }}>
              {!isUser && (
                <div style={{ fontSize: 10, fontWeight: 700, color: C.pri, marginBottom: 2 }}>Tolvink IA</div>
              )}
              {m.text}
              <div style={timeStyle}>{m.time}</div>
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

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  const pickDemo = useCallback((idx) => {
    setDemoIdx(idx);
    resetTimer();
  }, [resetTimer]);

  if (showAuth) return <AuthScreen onLogin={onLogin} onSignup={onSignup} onPasswordReset={onPasswordReset} loading={loading} error={error} clearError={clearError} onBackToLanding={() => setShowAuth(false)} />;

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FONT, display: "flex", flexDirection: "column", overflowX: "hidden", WebkitOverflowScrolling: "touch", position: "relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;overflow:visible!important;overflow-x:hidden!important}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes splashIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}@media(max-width:767px){.tv-ld-tag{font-size:10px!important;letter-spacing:1.6px!important}.tv-ld-h1{font-size:17px!important}.tv-ld-feat{gap:14px!important}.tv-ld-feat svg{width:14px!important;height:14px!important}.tv-ld-feat span{font-size:9px!important}.tv-ld-logo{font-size:26px!important}.tv-ld-dot{width:6px!important;height:6px!important}.tv-ld-btn{font-size:14px!important;padding:12px 36px!important;min-width:220px!important}.tv-ld-chat{max-width:100%!important}}`}</style>

      <RoutesBackground trucks centerFade />

      {/* ── Header — logo top-left ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "max(16px, env(safe-area-inset-top)) 24px 0" }}>
        <div style={{ animation: "splashIn 0.8s ease-out", display: "inline-flex", alignItems: "flex-start" }}>
          <span className="tv-ld-logo" style={{ fontSize: 32, fontWeight: 800, color: C.pri, letterSpacing: -1.5, lineHeight: 1 }}>tolvink</span>
          <span className="tv-ld-dot" style={{ width: 8, height: 8, borderRadius: 4, background: C.acc, marginLeft: 3, marginTop: 2, display: "inline-block", animation: "dotPulse 1.5s ease-in-out infinite" }} />
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px 16px", textAlign: "center", position: "relative", zIndex: 1 }}>

        {/* Tagline + H1 */}
        <div style={{ animation: "fadeUp 0.8s ease-out", marginBottom: 24 }}>
          <div className="tv-ld-tag" style={{ fontSize: 12, fontWeight: 700, color: C.acc, textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 10 }}>
            Logística agrícola simplificada
          </div>
          <h1 className="tv-ld-h1" style={{ fontSize: 22, fontWeight: 700, color: C.t1, lineHeight: 1.3, letterSpacing: -0.3, maxWidth: 500 }}>
            Gestioná tus fletes desde WhatsApp con Inteligencia Artificial
          </h1>
        </div>

        {/* Features inline — 5 items */}
        <div className="tv-ld-feat" style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 28, animation: "fadeUp 1s ease-out", flexWrap: "wrap" }}>
          {[
            { icon: Ic.wa("#25D366", 18), label: "Operá desde WhatsApp" },
            { icon: Ic.truck(C.pri, 18), label: "Fletes" },
            { icon: Ic.pin(C.acc, 18), label: "Tracking" },
            { icon: Ic.chk(C.ok, 18), label: "Confirmaciones" },
            { icon: Ic.nav(C.sec, 18), label: "Rutas" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {f.icon}
              <span style={{ fontSize: 11, fontWeight: 600, color: C.t2 }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* ── Chat demo ── */}
        <div className="tv-ld-chat" style={{
          maxWidth: 380, width: "100%", borderRadius: 14,
          background: "#E5DDD5", position: "relative", overflow: "hidden",
          boxShadow: C.shMd, marginBottom: 12,
          animation: "fadeUp 1.2s ease-out",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5bfb0' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}>
          {/* Chat header — WhatsApp style */}
          <div style={{
            background: "#075E54", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: C.pri, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.w }}>T</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.w }}>Tolvink IA</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: C.w, background: "rgba(255,255,255,0.2)", padding: "1px 6px", borderRadius: 6 }}>Asistente</span>
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>en línea</div>
            </div>
          </div>

          {/* Chat body — crossfade between demos */}
          <div style={{ position: "relative", minHeight: 400 }}>
            {DEMOS.map((d, i) => (
              <ChatDemo key={i} demo={d} visible={i === demoIdx} />
            ))}
          </div>
        </div>

        {/* Demo dot indicators */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
          {DEMOS.map((_, i) => (
            <button key={i} onClick={() => pickDemo(i)} aria-label={`Demo ${i + 1}`} style={{
              width: 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", padding: 0,
              background: i === demoIdx ? C.pri : C.b1,
              transition: "background 0.3s ease",
            }} />
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <a href="#ingresar" onClick={function (ev) { ev.preventDefault(); setShowAuth(true); }} className="tv-ld-btn" style={{
            display: "inline-block", padding: "14px 42px", borderRadius: 12, background: C.pri, color: C.w,
            fontSize: 16, fontWeight: 700, textDecoration: "none", fontFamily: "inherit",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)", minWidth: 240, textAlign: "center", cursor: "pointer",
            WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
          }}>Ingresar</a>

          <a href="https://wa.me/59898247552?text=Hola%2C%20quiero%20probar%20el%20asistente%20Tolvink" target="_blank" rel="noopener noreferrer" className="tv-ld-btn" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 42px", borderRadius: 12, background: "#25D366", color: C.w,
            fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "inherit",
            minWidth: 240, textAlign: "center", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(37,211,102,0.3)",
          }}>
            {WA_ICON}
            Probá el asistente en WhatsApp
          </a>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px 24px", paddingBottom: "max(16px, env(safe-area-inset-bottom))", fontSize: 10, color: C.t3, position: "relative", zIndex: 1 }}>
        Logística agrícola inteligente · Uruguay
      </div>
    </div>
  );
}
