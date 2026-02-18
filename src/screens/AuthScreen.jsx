import { useState, useEffect } from "react";
import { C, FONT, Ic } from "../theme";
import { V, validate, SCHEMAS, FieldError } from "../validation";
import { Btn, Field } from "../components";
import { RoutesBackground } from "../routes-bg";

export default function AuthScreen({ onLogin, onSignup, loading, error, clearError, onBackToLanding }) {
  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState(""); // email or phone
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [userTypes, setUserTypes] = useState([]); // multi-select: ["planta","transporter","producer"]
  const [errs, setErrs] = useState({});
  const [touched, setTouched] = useState(false);

  const toggle = () => { setMode(m=>m==="login"?"signup":"login"); clearError(); setErrs({}); setTouched(false); };

  const toggleType = (t) => setUserTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]);

  // Phone formatter: 09X XXX XXX
  const formatPhone = (v) => {
    const digits = v.replace(/\D/g,'').slice(0,9);
    if(digits.length<=3) return digits;
    if(digits.length<=6) return digits.slice(0,3)+' '+digits.slice(3);
    return digits.slice(0,3)+' '+digits.slice(3,6)+' '+digits.slice(6);
  };
  const handlePhone = (v) => setPhone(formatPhone(v));

  const submit = () => {
    setTouched(true);
    if(mode==="login") {
      // Login accepts email or phone
      const isPhone = /^09/.test(loginId.replace(/[\s\-()]/g,''));
      if(isPhone) {
        const cleanPhone = loginId.replace(/[\s\-()]/g,'');
        if(!/^09[1-9]\d{6}$/.test(cleanPhone)) { setErrs({email:"Formato: 09X XXX XXX"}); return; }
      } else {
        const {ok,errs:e} = validate({email:loginId}, SCHEMAS.login);
        if(!ok) { setErrs(e); return; }
      }
      setErrs({});
      const cleanId = loginId.replace(/[\s\-()]/g,'');
      onLogin(/^09/.test(cleanId) ? cleanId : cleanId.toLowerCase());
    } else {
      const vals = {name,email,phone:phone.replace(/[\s\-()]/g,''),userTypes};
      const {ok,errs:e} = validate(vals, SCHEMAS.signup);
      setErrs(e);
      if(!ok) return;
      onSignup({name,email,phone,userTypes});
    }
  };

  const typeOptions = [
    {k:"planta",l:"Planta de Acopio",desc:"Recibís y gestionás cargas",c:C.pri,ic:Ic.plant},
    {k:"transporter",l:"Transportista",desc:"Realizás fletes y entregas",c:C.info||C.sec,ic:Ic.truck},
    {k:"producer",l:"Productor",desc:"Solicitás fletes desde el campo",c:C.acc,ic:Ic.seedling},
  ];

  // PWA install prompt
  const [canInstall, setCanInstall] = useState(false);
  useEffect(()=>{
    const h = ()=>setCanInstall(true);
    window.addEventListener('pwa-install-available',h);
    return ()=>window.removeEventListener('pwa-install-available',h);
  },[]);

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:FONT, position:"relative", overflow:"hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;min-height:0!important;overflow:visible!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;position:static!important}input::placeholder,textarea::placeholder{color:${C.t3}}.tv-sel-opt:hover{background:${C.priGhost}!important}input[type="date"],input[type="time"]{color-scheme:light}input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{opacity:0;position:absolute;inset:0;width:100%;height:100%;cursor:pointer}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <RoutesBackground trucks centerFade />

      <div style={{ maxWidth:430, margin:"0 auto", padding:"0 28px", boxSizing:"border-box", position:"relative", zIndex:1 }}>
        <div style={{ paddingTop:mode==="signup"?"max(24px, env(safe-area-inset-top))":"28px", paddingBottom:"max(40px, env(safe-area-inset-bottom))", minHeight:mode==="login"?"100svh":"auto", display:"flex", flexDirection:"column", justifyContent:mode==="login"?"center":"flex-start" }}>
          <div style={{ textAlign:"center", marginBottom:mode==="login"?32:20 }}>
            {onBackToLanding && <button onClick={onBackToLanding} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4, margin:"0 auto 14px" }}>{Ic.chev(C.pri,18)} Volver</button>}
            <div style={{ display:"inline-flex", alignItems:"flex-start", animation:"fadeUp 0.6s ease-out" }}>
              <span style={{ fontSize:55, fontWeight:800, color:C.pri, letterSpacing:-2.9, lineHeight:1 }}>tolvink</span>
              <span style={{ width:12, height:12, borderRadius:6, background:C.acc, marginLeft:3, marginTop:2, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
          <div style={{ background:C.w, borderRadius:16, padding:22, boxShadow:C.shMd, border:`1px solid ${C.b2}` }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:3, color:C.t1 }}>{mode==="login"?"Iniciar sesión":"Crear cuenta"}</div>
            <div style={{ fontSize:12.5, color:C.t2, marginBottom:18 }}>{mode==="login"?"Ingresá con email o teléfono":"Completá tus datos para registrarte"}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* === LOGIN MODE === */}
              {mode==="login" && <>
                <div>
                  <Field label="Email o teléfono" icon={Ic.mail(errs.email||error?C.err:C.t2,14)} value={loginId} onChange={v=>{setLoginId(v);if(error)clearError();}} placeholder="tu@email.com o 09X XXX XXX" hasError={!!(errs.email||error)} onKeyDown={e=>{if(e.key==='Enter')submit();}}/>
                  {touched&&<FieldError error={errs.email}/>}
                </div>
              </>}

              {/* === SIGNUP MODE === */}
              {mode==="signup" && (()=>{
                const showEmail = name.trim().length >= 3;
                const showPhone = showEmail && email.trim().length >= 5 && email.includes("@");
                const showTypes = showPhone && phone.replace(/\D/g,"").length >= 9;
                return <>
                <div style={{animation:"fadeUp 0.3s ease-out"}}>
                  <Field label="Nombre completo" icon={Ic.user(C.t2,14)} value={name} onChange={setName} placeholder="Tu nombre completo"/>
                  {touched&&<FieldError error={errs.name}/>}
                </div>
                {showEmail && <div style={{animation:"fadeUp 0.3s ease-out"}}>
                  <Field label="Email" icon={Ic.mail(C.t2,14)} value={email} onChange={setEmail} placeholder="tu@email.com" type="email"/>
                  {touched&&<FieldError error={errs.email}/>}
                </div>}
                {showPhone && <div style={{animation:"fadeUp 0.3s ease-out"}}>
                  <Field label="Celular" icon={Ic.phone(C.t2,14)} value={phone} onChange={handlePhone} placeholder="09X XXX XXX" type="tel"/>
                  {touched&&<FieldError error={errs.phone}/>}
                </div>}

                {/* Multi-select user types */}
                {showTypes && <div style={{animation:"fadeUp 0.3s ease-out"}}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.t2, marginBottom:8 }}>¿Qué tipo de usuario sos?</div>
                  <div style={{ fontSize:10.5, color:C.t3, marginBottom:10 }}>Podés seleccionar más de uno</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {typeOptions.map(t=>{
                      const sel = userTypes.includes(t.k);
                      return (
                        <button key={t.k} onClick={()=>toggleType(t.k)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, border:`1.5px solid ${sel?t.c:C.b1}`, background:sel?`${t.c}0A`:C.w, cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
                          <div style={{ width:36, height:36, borderRadius:9, background:sel?`${t.c}18`:`${t.c}08`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}>
                            {t.ic(sel?t.c:C.t3, 18)}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:sel?700:600, color:sel?t.c:C.t1 }}>{t.l}</div>
                            <div style={{ fontSize:10.5, color:C.t3, marginTop:1 }}>{t.desc}</div>
                          </div>
                          <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${sel?t.c:C.b1}`, background:sel?t.c:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                            {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.w} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {touched&&<FieldError error={errs.userTypes}/>}
                </div>}
              </>})()}

              {error && <div style={{ padding:"10px 14px", background:C.errPale, borderRadius:8, fontSize:12.5, color:C.err, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
              <Btn full onClick={submit} disabled={loading}>{loading?"Cargando...":mode==="login"?"Ingresar":"Crear cuenta"}</Btn>
            </div>
          </div>
          <div style={{ textAlign:"center", marginTop:16 }}>
            <span style={{ fontSize:13, color:C.t2 }}>{mode==="login"?"¿No tenés cuenta? ":"¿Ya tenés cuenta? "}</span>
            <button onClick={toggle} style={{ background:"none", border:"none", color:C.pri, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{mode==="login"?"Registrate":"Iniciá sesión"}</button>
          </div>
          {canInstall && <button onClick={()=>window.installPWA?.()} style={{marginTop:14,width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{Ic.plus(C.pri,16)} Instalar Tolvink en tu dispositivo</button>}
        </div>
      </div>
    </div>
  );
}
