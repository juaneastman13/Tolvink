import { useState, useEffect, useRef } from "react";
import { C, FONT, Ic } from "../theme";
import { V, validate, SCHEMAS, FieldError } from "../validation";
import { Btn, Field } from "../components";
import { RoutesBackground } from "../routes-bg";
import { apiIdentifyForReset, apiRequestCode, apiVerifyCode, apiResetPassword } from "../api";

// Compact summary chip for a completed signup field
function CompletedField({ icon, value, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%", transition: "all 0.15s" }}>
      {icon}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  );
}

export default function AuthScreen({ onLogin, onSignup, onPasswordReset, loading, error, clearError, onBackToLanding }) {
  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [userTypes, setUserTypes] = useState([]);
  const [errs, setErrs] = useState({});
  const [touched, setTouched] = useState(false);
  // Which signup field is being edited (for collapsing)
  const [editingField, setEditingField] = useState("name");

  // Reset flow state
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resetPhone, setResetPhone] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [codeSent, setCodeSent] = useState(false);

  const bottomRef = useRef(null);
  const scrollTimer = useRef(null);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);

  const isResetMode = mode.startsWith("reset_");
  const anyLoading = loading || resetLoading;

  const switchMode = (m) => {
    setMode(m); clearError(); setErrs({}); setTouched(false); setResetError(null);
    // Clear stale reset state when going back to login/signup
    if (m === "login" || m === "signup") { setResetIdentifier(""); setMaskedPhone(""); setResetPhone(""); setResetCode(""); setNewPassword(""); setConfirmPassword(""); setResetToken(""); setCodeSent(false); }
  };
  const toggle = () => switchMode(mode === "login" ? "signup" : "login");
  const toggleType = (t) => setUserTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const formatPhone = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0, 3) + ' ' + digits.slice(3);
    return digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
  };
  const handlePhone = (v) => setPhone(formatPhone(v));

  const scrollBottom = () => { clearTimeout(scrollTimer.current); scrollTimer.current = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 100); };

  // Check if the current editing field meets minimum criteria to advance
  const canAdvance = (field) => {
    if (field === "name") return name.trim().length >= 3;
    if (field === "email") return email.trim().length >= 5 && email.includes("@");
    if (field === "phone") return phone.replace(/\D/g, "").length >= 9;
    if (field === "password") return signupPassword.length >= 8;
    return false;
  };

  const advanceField = () => {
    const next = { name: "email", email: "phone", phone: "password", password: "types" };
    if (next[editingField]) { setEditingField(next[editingField]); scrollBottom(); }
  };

  const submit = async () => {
    setTouched(true);
    setResetError(null);

    if (mode === "login") {
      const isPhone = /^09/.test(loginId.replace(/[\s\-()]/g, ''));
      if (isPhone) {
        const cleanPhone = loginId.replace(/[\s\-()]/g, '');
        if (!/^09[1-9]\d{6}$/.test(cleanPhone)) { setErrs({ email: "Formato: 09X XXX XXX" }); return; }
      } else {
        const { ok, errs: e } = validate({ email: loginId }, SCHEMAS.login);
        if (!ok) { setErrs(e); return; }
      }
      if (!password) { setErrs({ password: "Contraseña requerida" }); return; }
      setErrs({});
      const cleanId = loginId.replace(/[\s\-()]/g, '');
      const result = await onLogin(
        /^09/.test(cleanId) ? cleanId : cleanId.toLowerCase(),
        password,
      );
      if (result?.noPassword) {
        const cleanLogin = loginId.replace(/[\s\-()]/g, '');
        setResetIdentifier(/^09/.test(cleanLogin) ? cleanLogin : cleanLogin.toLowerCase());
        setResetError("Tu cuenta no tiene contraseña configurada. Seguí los pasos para establecerla.");
        switchMode("reset_identify");
      }

    } else if (mode === "signup") {
      if (!signupPassword || signupPassword.length < 8) {
        setEditingField("password");
        setErrs(prev => ({ ...prev, password: "Mínimo 8 caracteres" })); return;
      }
      const vals = { name, email, phone: phone.replace(/[\s\-()]/g, ''), userTypes };
      const { ok, errs: e } = validate(vals, SCHEMAS.signup);
      setErrs(e);
      if (!ok) return;
      onSignup({ name, email, phone, password: signupPassword, userTypes });

    } else if (mode === "reset_identify") {
      if (!resetIdentifier.trim()) { setErrs({ identifier: "Ingresá tu email o teléfono" }); return; }
      setErrs({});
      setResetLoading(true);
      try {
        const result = await apiIdentifyForReset(resetIdentifier.trim());
        setMaskedPhone(result.maskedPhone);
        setMode("reset_confirm");
      } catch (e) { setResetError(e.message || "No se encontró la cuenta"); }
      finally { setResetLoading(false); }

    } else if (mode === "reset_confirm") {
      const cleanPhone = resetPhone.replace(/[\s\-()]/g, '');
      if (!/^09[1-9]\d{6}$/.test(cleanPhone)) { setErrs({ phone: "Formato: 09X XXX XXX" }); return; }
      setErrs({});
      setResetLoading(true);
      try {
        await apiRequestCode(resetIdentifier.trim(), cleanPhone);
        setCodeSent(true);
        setMode("reset_code");
      } catch (e) { setResetError(e.message || "Error al enviar código"); }
      finally { setResetLoading(false); }

    } else if (mode === "reset_code") {
      if (resetCode.length !== 6) { setErrs({ code: "Ingresá los 6 dígitos" }); return; }
      setErrs({});
      setResetLoading(true);
      try {
        const result = await apiVerifyCode(resetPhone.replace(/[\s\-()]/g, ''), resetCode);
        setResetToken(result.resetToken);
        setMode("reset_password");
      } catch (e) { setResetError(e.message || "Código inválido"); }
      finally { setResetLoading(false); }

    } else if (mode === "reset_password") {
      if (newPassword.length < 8) { setErrs({ newPassword: "Mínimo 8 caracteres" }); return; }
      if (newPassword !== confirmPassword) { setErrs({ confirmPassword: "Las contraseñas no coinciden" }); return; }
      setErrs({});
      setResetLoading(true);
      try {
        const result = await apiResetPassword(resetToken, newPassword);
        onPasswordReset?.(result);
      } catch (e) { setResetError(e.message || "Error al cambiar contraseña"); }
      finally { setResetLoading(false); }
    }
  };

  const typeOptions = [
    { k: "planta", l: "Planta de Acopio", desc: "Recibís y gestionás cargas", c: C.pri, ic: Ic.plant },
    { k: "transporter", l: "Transportista", desc: "Realizás fletes y entregas", c: C.info || C.sec, ic: Ic.truck },
    { k: "producer", l: "Productor", desc: "Solicitás fletes desde el campo", c: C.acc, ic: Ic.seedling },
  ];

  // PWA install prompt
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener('pwa-install-available', h);
    return () => window.removeEventListener('pwa-install-available', h);
  }, []);

  const titles = {
    login: "Iniciar sesión",
    signup: "Crear cuenta",
    reset_identify: "Recuperar contraseña",
    reset_confirm: "Confirmá tu teléfono",
    reset_code: "Verificar código",
    reset_password: "Nueva contraseña",
  };
  const subtitles = {
    login: "Ingresá con email o teléfono",
    signup: "Completá tus datos para registrarte",
    reset_identify: "Ingresá tu email o teléfono para identificarte.",
    reset_confirm: `Tu teléfono registrado es ${maskedPhone || "09*****XX"}. Ingresá el número completo para recibir el código.`,
    reset_code: "Ingresá el código de 6 dígitos que te enviamos por WhatsApp.",
    reset_password: "Elegí tu nueva contraseña.",
  };
  const btnLabels = {
    login: "Ingresar",
    signup: "Crear cuenta",
    reset_identify: "Continuar",
    reset_confirm: codeSent ? "Reenviar código" : "Enviar código",
    reset_code: "Verificar",
    reset_password: "Guardar contraseña",
  };

  const displayError = resetError || error;

  // Signup field order for collapsing logic
  const signupFields = ["name", "email", "phone", "password", "types"];
  const fieldIdx = signupFields.indexOf(editingField);

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FONT, position: "relative", overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;min-height:0!important;overflow:visible!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;position:static!important}input::placeholder,textarea::placeholder{color:${C.t3}}.tv-sel-opt:hover{background:${C.priGhost}!important}input[type="date"],input[type="time"]{color-scheme:light}input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{opacity:0;position:absolute;inset:0;width:100%;height:100%;cursor:pointer}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <RoutesBackground trucks centerFade />

      <div style={{ maxWidth: 430, margin: "0 auto", padding: "0 28px", boxSizing: "border-box", position: "relative", zIndex: 1 }}>
        <div style={{ paddingTop: mode === "signup" ? "max(24px, env(safe-area-inset-top))" : "28px", paddingBottom: "max(40px, env(safe-area-inset-bottom))", minHeight: mode === "login" ? "100svh" : "auto", display: "flex", flexDirection: "column", justifyContent: mode === "login" ? "center" : "flex-start" }}>
          <div style={{ textAlign: "center", marginBottom: mode === "login" ? 32 : 20 }}>
            {onBackToLanding && <button onClick={onBackToLanding} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4, margin: "0 auto 14px" }}>{Ic.chev(C.pri, 18)} Volver</button>}
            <div style={{ display: "inline-flex", alignItems: "flex-start", animation: "fadeUp 0.6s ease-out" }}>
              <span style={{ fontSize: 55, fontWeight: 800, color: C.pri, letterSpacing: -2.9, lineHeight: 1 }}>tolvink</span>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: C.acc, marginLeft: 3, marginTop: 2, display: "inline-block", animation: "dotPulse 1.5s ease-in-out infinite" }} />
            </div>
          </div>
          <div style={{ background: C.w, borderRadius: 16, padding: 22, boxShadow: C.shMd, border: `1px solid ${C.b2}` }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3, color: C.t1 }}>{titles[mode]}</div>
            <div style={{ fontSize: 12.5, color: C.t2, marginBottom: 18 }}>{subtitles[mode]}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* === LOGIN MODE === */}
              {mode === "login" && <>
                <div>
                  <Field label="Email o teléfono" icon={Ic.mail(errs.email || error ? C.err : C.t2, 14)} value={loginId} onChange={v => { setLoginId(v); if (error) clearError(); }} placeholder="tu@email.com o 09X XXX XXX" hasError={!!(errs.email || error)} onKeyDown={e => { if (e.key === 'Enter' && password) submit(); }} />
                  {touched && <FieldError error={errs.email} />}
                </div>
                <div>
                  <Field label="Contraseña" icon={Ic.lock(errs.password ? C.err : C.t2, 14)} value={password} onChange={setPassword} placeholder="Tu contraseña" type="password" hasError={!!errs.password} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
                  {touched && <FieldError error={errs.password} />}
                </div>
                <button onClick={() => { switchMode("reset_identify"); }} style={{ background: "none", border: "none", color: C.pri, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "right", padding: 0, marginTop: -4 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </>}

              {/* === SIGNUP MODE === */}
              {mode === "signup" && (() => {
                const nextBtn = (field) => canAdvance(field) && editingField === field && (
                  <button onClick={advanceField} style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 8, border: "none", background: C.pri, color: C.w, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 4, transition: "opacity 0.15s", animation: "fadeUp 0.2s ease-out" }}>
                    Siguiente <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                );
                const fieldKeyDown = (e) => { if (e.key === "Enter" && canAdvance(editingField)) advanceField(); };
                return <>
                  {/* NAME */}
                  {editingField === "name" ? (
                    <div style={{ animation: "fadeUp 0.3s ease-out" }}>
                      <Field label="Nombre completo" icon={Ic.user(C.t2, 14)} value={name} onChange={setName} placeholder="Tu nombre completo" autoFocus onKeyDown={fieldKeyDown} />
                      {touched && <FieldError error={errs.name} />}
                      {nextBtn("name")}
                    </div>
                  ) : name && (
                    <CompletedField icon={Ic.user(C.pri, 14)} value={name} onClick={() => setEditingField("name")} />
                  )}

                  {/* EMAIL */}
                  {fieldIdx >= 1 && (editingField === "email" ? (
                    <div style={{ animation: "fadeUp 0.3s ease-out" }}>
                      <Field label="Email" icon={Ic.mail(C.t2, 14)} value={email} onChange={setEmail} placeholder="tu@email.com" type="email" autoFocus onKeyDown={fieldKeyDown} />
                      {touched && <FieldError error={errs.email} />}
                      {nextBtn("email")}
                    </div>
                  ) : email && (
                    <CompletedField icon={Ic.mail(C.pri, 14)} value={email} onClick={() => setEditingField("email")} />
                  ))}

                  {/* PHONE */}
                  {fieldIdx >= 2 && (editingField === "phone" ? (
                    <div style={{ animation: "fadeUp 0.3s ease-out" }}>
                      <Field label="Celular" icon={Ic.phone(C.t2, 14)} value={phone} onChange={handlePhone} placeholder="09X XXX XXX" type="tel" autoFocus onKeyDown={fieldKeyDown} />
                      {touched && <FieldError error={errs.phone} />}
                      {nextBtn("phone")}
                    </div>
                  ) : phone && (
                    <CompletedField icon={Ic.phone(C.pri, 14)} value={phone} onClick={() => setEditingField("phone")} />
                  ))}

                  {/* PASSWORD */}
                  {fieldIdx >= 3 && (editingField === "password" ? (
                    <div style={{ animation: "fadeUp 0.3s ease-out" }}>
                      <Field label="Contraseña" icon={Ic.lock(C.t2, 14)} value={signupPassword} onChange={setSignupPassword} placeholder="Mínimo 8 caracteres" type="password" autoFocus onKeyDown={fieldKeyDown} />
                      {touched && <FieldError error={errs.password} />}
                      {nextBtn("password")}
                    </div>
                  ) : signupPassword && (
                    <CompletedField icon={Ic.lock(C.pri, 14)} value={"•".repeat(signupPassword.length)} onClick={() => setEditingField("password")} />
                  ))}

                  {/* USER TYPES */}
                  {fieldIdx >= 4 && <div style={{ animation: "fadeUp 0.3s ease-out" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>¿Qué tipo de usuario sos?</div>
                    <div style={{ fontSize: 10.5, color: C.t3, marginBottom: 10 }}>Podés seleccionar más de uno</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {typeOptions.map(t => {
                        const sel = userTypes.includes(t.k);
                        return (
                          <button key={t.k} onClick={() => toggleType(t.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${sel ? t.c : C.b1}`, background: sel ? `${t.c}0A` : C.w, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s", width: "100%" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: sel ? `${t.c}18` : `${t.c}08`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}>
                              {t.ic(sel ? t.c : C.t3, 18)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: sel ? 700 : 600, color: sel ? t.c : C.t1 }}>{t.l}</div>
                              <div style={{ fontSize: 10.5, color: C.t3, marginTop: 1 }}>{t.desc}</div>
                            </div>
                            <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? t.c : C.b1}`, background: sel ? t.c : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                              {sel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.w} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {touched && <FieldError error={errs.userTypes} />}
                  </div>}
                </>;
              })()}

              {/* === RESET: IDENTIFY === */}
              {mode === "reset_identify" && <>
                <div>
                  <Field label="Email o teléfono" icon={Ic.mail(C.t2, 14)} value={resetIdentifier} onChange={setResetIdentifier} placeholder="tu@email.com o 09X XXX XXX" hasError={!!errs.identifier} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
                  {touched && <FieldError error={errs.identifier} />}
                </div>
              </>}

              {/* === RESET: CONFIRM PHONE === */}
              {mode === "reset_confirm" && <>
                <div>
                  <Field label="Teléfono registrado" icon={Ic.phone(errs.phone ? C.err : C.t2, 14)} value={resetPhone} onChange={v => setResetPhone(formatPhone(v))} placeholder="09X XXX XXX" type="tel" hasError={!!errs.phone} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
                  {touched && <FieldError error={errs.phone} />}
                </div>
              </>}

              {/* === RESET: CODE === */}
              {mode === "reset_code" && <>
                <div>
                  <Field label="Código de verificación" value={resetCode} onChange={v => setResetCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="000000" hasError={!!errs.code} onKeyDown={e => { if (e.key === 'Enter') submit(); }} style={{ letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 700 }} />
                  {touched && <FieldError error={errs.code} />}
                </div>
                <button onClick={() => { setResetCode(""); switchMode("reset_confirm"); }} style={{ background: "none", border: "none", color: C.pri, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "center", padding: 0 }}>
                  Reenviar código
                </button>
              </>}

              {/* === RESET: NEW PASSWORD === */}
              {mode === "reset_password" && <>
                <div>
                  <Field label="Nueva contraseña" icon={Ic.lock(C.t2, 14)} value={newPassword} onChange={setNewPassword} placeholder="Mínimo 8 caracteres" type="password" hasError={!!errs.newPassword} />
                  {touched && <FieldError error={errs.newPassword} />}
                </div>
                <div>
                  <Field label="Confirmar contraseña" icon={Ic.lock(C.t2, 14)} value={confirmPassword} onChange={setConfirmPassword} placeholder="Repetí la contraseña" type="password" hasError={!!errs.confirmPassword} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
                  {touched && <FieldError error={errs.confirmPassword} />}
                </div>
              </>}

              {displayError && <div style={{ padding: "10px 14px", background: C.errPale, borderRadius: 8, fontSize: 12.5, color: C.err, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{displayError}</div>}
              <Btn full onClick={submit} disabled={anyLoading}>{anyLoading ? "Cargando..." : btnLabels[mode]}</Btn>
              <div ref={bottomRef} />
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            {!isResetMode && <>
              <span style={{ fontSize: 13, color: C.t2 }}>{mode === "login" ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}</span>
              <button onClick={toggle} style={{ background: "none", border: "none", color: C.pri, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{mode === "login" ? "Registrate" : "Iniciá sesión"}</button>
            </>}
            {isResetMode && <>
              <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: C.pri, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Volver a iniciar sesión</button>
            </>}
          </div>
          {canInstall && <button onClick={() => window.installPWA?.()} style={{ marginTop: 14, width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.pri}`, background: C.priPale, color: C.pri, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{Ic.plus(C.pri, 16)} Instalar Tolvink en tu dispositivo</button>}
        </div>
      </div>
    </div>
  );
}
