import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  apiGetAuditLog,
  apiCreateTruck, apiDeactivateTruck,
  apiCreateField, apiUpdateField, apiCreateLot, apiUpdateLot, apiGetFieldLots,
  apiGrantAccess, apiRevokeAccess, apiListAccessProducers, apiListAccessPlants, apiSearchProducer, apiGetMyFacilities,
  apiSearchUsers, apiStartConversation, apiListConversations, apiGetMessages, apiSendMessage, apiMarkRead,
  uploadPhoto, apiAddDocument, uploadChatFile,
  apiAdminStats, apiAdminListCompanies, apiAdminGetCompany, apiAdminCreateCompany, apiAdminUpdateCompany,
  apiAdminListBranches, apiAdminCreateBranch, apiAdminUpdateBranch, apiAdminDeleteBranch,
  apiAdminListUsers, apiAdminCreateUser, apiAdminUpdateUser, apiUpdateMe,
  apiAdminListFields, apiAdminCreateField, apiAdminUpdateField, apiAdminDeleteField,
  apiAdminListLots, apiAdminCreateLot, apiAdminUpdateLot, apiAdminDeleteLot,
  apiAdminListTrucks, apiAdminCreateTruck, apiAdminUpdateTruck, apiAdminDeleteTruck,
} from "./api";

import { C, track, FONT, MONO, Ic } from "./theme";
import { V, validate, SCHEMAS, textMatch, FieldError } from "./validation";
import { stCfg, getActions, GRANOS, UNITS } from "./constants";
import { Av, Bd, Btn, Tabs, Field, Select, Sec, Toast, Loader, AttachMenu, Sidebar, Nav, SortTh, exportCSV, exportExcel, exportPDF } from "./components";
import { useAuth, useCatalog, useFreights, permsFor, useIsDesktop, useTableSort, usePullToRefresh, useOnline, useNotifications } from "./hooks";
import { SafeZone, LocationPicker, FreightMap, FreightsOverviewMap } from "./maps";
import { PhotoUpload, DocsGallery, FreightFileUpload } from "./uploads";
import { RoutesBackground } from "./routes-bg";


// ======================== LANDING PAGE ================================

function LandingScreen({ onLogin, onSignup, loading, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) return <AuthScreen onLogin={onLogin} onSignup={onSignup} loading={loading} error={error} clearError={clearError} onBackToLanding={()=>setShowAuth(false)} />;

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:FONT, display:"flex", flexDirection:"column", overflow:"hidden", WebkitOverflowScrolling:"touch", position:"relative" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;overflow:visible!important;overflow-x:hidden!important}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes splashIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}@media(max-width:767px){.tv-ld-tag{font-size:11px!important;letter-spacing:1.8px!important}.tv-ld-h1{font-size:17px!important}.tv-ld-feat{gap:18px!important}.tv-ld-feat svg{width:18px!important;height:18px!important}.tv-ld-feat span{font-size:10px!important}}`}</style>

      <RoutesBackground trucks centerFade />

      {/* Main content — centered */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center", paddingTop:"max(40px, env(safe-area-inset-top))", position:"relative", zIndex:1 }}>

        {/* Big logo */}
        <div style={{ animation:"splashIn 0.8s ease-out", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
            <span style={{ fontSize:139, fontWeight:800, color:C.pri, letterSpacing:-6.6, lineHeight:1 }}>tolvink</span>
            <span style={{ width:25, height:25, borderRadius:13, background:C.acc, marginLeft:9, marginTop:7, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Tagline */}
        <div style={{ animation:"fadeUp 0.8s ease-out", marginBottom:40 }}>
          <div className="tv-ld-tag" style={{ fontSize:14, fontWeight:700, color:C.acc, textTransform:"uppercase", letterSpacing:2.5, marginBottom:14 }}>
            Logística agrícola simplificada
          </div>
          <h1 className="tv-ld-h1" style={{ fontSize:22, fontWeight:700, color:C.t2, lineHeight:1.1, letterSpacing:-0.3, whiteSpace:"nowrap" }}>
            Gestioná tus fletes desde el campo
          </h1>
        </div>

        {/* 4 Features inline */}
        <div className="tv-ld-feat" style={{ display:"flex", gap:28, justifyContent:"center", marginBottom:44, animation:"fadeUp 1s ease-out", flexWrap:"wrap" }}>
          {[
            { icon: Ic.truck(C.pri,22), label:"Fletes" },
            { icon: Ic.pin(C.acc,22), label:"Tracking" },
            { icon: Ic.chk(C.ok,22), label:"Confirmaciones" },
            { icon: Ic.nav(C.sec,22), label:"Rutas" },
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
              {f.icon}
              <span style={{ fontSize:12, fontWeight:600, color:C.t2 }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Ingresar — fresh element, no legacy handlers */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
          <a href="#ingresar" onClick={function(ev){ ev.preventDefault(); console.log('[LANDING] Ingresar clicked'); setShowAuth(true); }} style={{ display:"inline-block", padding:"14px 42px", borderRadius:12, background:C.pri, color:C.w, fontSize:16, fontWeight:700, textDecoration:"none", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(0,0,0,0.15)", minWidth:200, textAlign:"center", cursor:"pointer", WebkitTapHighlightColor:"rgba(0,0,0,0.1)" }}>Ingresar</a>

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

// ======================== AUTH SCREEN =================================

function AuthScreen({ onLogin, onSignup, loading, error, clearError, onBackToLanding }) {
  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState(""); // email or phone
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
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
        const {ok,errs:e} = validate({email:loginId,pw}, {email:[V.email],pw:[V.min(4)]});
        if(!ok) { setErrs(e); return; }
      }
      if(!pw||pw.length<4) { setErrs(prev=>({...prev,pw:"Mínimo 4 caracteres"})); return; }
      setErrs({});
      const cleanId = loginId.replace(/[\s\-()]/g,'');
      onLogin(/^09/.test(cleanId) ? cleanId : cleanId.toLowerCase(), pw);
    } else {
      const vals = {name,email,phone:phone.replace(/[\s\-()]/g,''),pw,userTypes};
      const {ok,errs:e} = validate(vals, SCHEMAS.signup);
      setErrs(e);
      if(!ok) return;
      onSignup({name,email,phone,pw,userTypes});
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
                  <Field label="Email o teléfono" icon={Ic.mail(errs.email||error?C.err:C.t2,14)} value={loginId} onChange={v=>{setLoginId(v);if(error)clearError();}} placeholder="tu@email.com o 09X XXX XXX" hasError={!!(errs.email||error)}/>
                  {touched&&<FieldError error={errs.email}/>}
                </div>
                <div>
                  <Field label="Contraseña" icon={Ic.lock(errs.pw||error?C.err:C.t2,14)} value={pw} onChange={v=>{setPw(v);if(error)clearError();}} placeholder="••••••" type="password" hasError={!!(errs.pw||error)}/>
                  {touched&&<FieldError error={errs.pw}/>}
                </div>
              </>}

              {/* === SIGNUP MODE === */}
              {mode==="signup" && (()=>{
                const showEmail = name.trim().length >= 3;
                const showPhone = showEmail && email.trim().length >= 5 && email.includes("@");
                const showPw = showPhone && phone.replace(/\D/g,"").length >= 9;
                const showTypes = showPw && pw.length >= 4;
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
                {showPw && <div style={{animation:"fadeUp 0.3s ease-out"}}>
                  <Field label="Contraseña" icon={Ic.lock(C.t2,14)} value={pw} onChange={setPw} placeholder="Mínimo 4 caracteres" type="password"/>
                  {touched&&<FieldError error={errs.pw}/>}
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


// ======================== HOME SCREEN ================================


// Resolve effective userType for a freight (multi-type users)
// Tries each type: prefer the one with pending actions, then any actions
function resolveUserTypeForFreight(freight, user) {
  const types = user.userTypes || [user.userType];
  if (types.length <= 1) return user.userType;
  for (const type of types) {
    if (getPendingActions(freight, type)) return type;
  }
  for (const type of types) {
    if (getActions(freight.status, type, user.role, freight.isOwnFleet).length > 0) return type;
  }
  return user.userType;
}

function HomeScreen({ user, freights, perms, onNav, catalog, isDesktop, onAction, actionLoading, onChat, onRefresh, onDuplicate, onEdit }) {
  const [selectedId, setSelectedId] = useState(null);
  const [pendingFilter, setPendingFilter] = useState("all");
  const [summaryFilter, setSummaryFilter] = useState("all");
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);
  const companyPickerRef = useRef(null);

  // Build company list from user types + freight data (works even if companyByType is empty)
  const typeLabels = { producer: "Productor", plant: "Planta", transporter: "Transportista" };
  const myCompanies = useMemo(() => {
    const types = user.userTypes || [user.userType];
    if (types.length <= 1) return [{ key: user.userType, name: user.entity, type: user.userType }];
    // For each type, find the company name from freight data or catalog
    return types.map(type => {
      const cbt = user.companyByType || {};
      const companyId = cbt[type] || user.companyId;
      // Try primary company
      let name = companyId === user.companyId ? user.entity : null;
      // Try catalog
      if (!name) {
        const t = (catalog.transporters || []).find(x => x.id === companyId);
        if (t) name = t.name;
      }
      if (!name) {
        const p = (catalog.plants || []).find(x => x.id === companyId || x.companyId === companyId);
        if (p) name = p.name;
      }
      // Scan freights for this type's company name
      if (!name) {
        for (const f of freights) {
          if (resolveUserTypeForFreight(f, user) === type) {
            if (type === "plant" && f.destName) { name = f.destName; break; }
            if (type === "transporter" && f.transporterName) { name = f.transporterName; break; }
          }
        }
      }
      if (!name) name = typeLabels[type] || type;
      return { key: type, name, type };
    });
  }, [user, freights, catalog.transporters, catalog.plants]);

  const [activeTypes, setActiveTypes] = useState(null); // null = all types
  const toggleType = (key) => {
    setActiveTypes(prev => {
      const all = new Set(myCompanies.map(c => c.key));
      const cur = prev ? new Set(prev) : new Set(all);
      if (cur.has(key)) { cur.delete(key); if (cur.size === 0) return new Set(all); }
      else cur.add(key);
      return cur.size === all.size ? null : cur;
    });
  };
  const isTypeActive = (key) => !activeTypes || activeTypes.has(key);
  const allSelected = !activeTypes;
  const hasMultipleCompanies = myCompanies.length > 1;

  // Filter freights by selected types (using resolved type per freight)
  const filteredFreights = useMemo(() => {
    if (!activeTypes) return freights;
    return freights.filter(f => activeTypes.has(resolveUserTypeForFreight(f, user)));
  }, [freights, activeTypes, user]);

  // Close company picker on outside click
  useEffect(() => {
    if (!showCompanyPicker) return;
    const handler = (e) => { if (companyPickerRef.current && !companyPickerRef.current.contains(e.target)) setShowCompanyPicker(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCompanyPicker]);

  // Date helpers for filters
  const dateBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tom = new Date(now); tom.setDate(tom.getDate() + 1);
    const tomorrowStr = tom.toISOString().slice(0, 10);
    const day = now.getDay(); // 0=sun
    const endWk = new Date(now); endWk.setDate(now.getDate() + (7 - day));
    const weekEndStr = endWk.toISOString().slice(0, 10);
    return { todayStr, tomorrowStr, weekEndStr };
  }, []);
  const matchDate = (loadDate, filter) => {
    if (filter === "all") return true;
    if (!loadDate) return false;
    if (filter === "today") return loadDate === dateBounds.todayStr;
    if (filter === "tomorrow") return loadDate === dateBounds.tomorrowStr;
    if (filter === "week") return loadDate >= dateBounds.todayStr && loadDate <= dateBounds.weekEndStr;
    return true;
  };

  // Helper: resolve effective userType per freight for multi-type users
  const effectiveType = useCallback((f) => resolveUserTypeForFreight(f, user), [user]);

  // Pending groups — grouped by ACTION type, filtered by date
  const pendingByAction = useMemo(() => {
    const buckets = {};
    filteredFreights.forEach(f => {
      const pa = getPendingActions(f, effectiveType(f));
      if (!pa) return;
      if (!matchDate(f.loadDate, pendingFilter)) return;
      if (!buckets[pa.action]) buckets[pa.action] = { label: pa.action, color: pa.color, actionKey: pa.actionKey, icon: pa.icon, items: [] };
      buckets[pa.action].items.push({ ...f, pendingAction: pa });
    });
    return Object.values(buckets).map(b => {
      b.items.sort((a, b2) => a.loadDate && b2.loadDate ? a.loadDate.localeCompare(b2.loadDate) : 0);
      return b;
    });
  }, [filteredFreights, effectiveType, pendingFilter]);
  const pendingCount = pendingByAction.reduce((s, g) => s + g.items.length, 0);
  const hasPending = pendingCount > 0;

  // Total pending (unfiltered) to know if section should show
  const totalPendingAll = useMemo(() =>
    filteredFreights.filter(f => getPendingActions(f, effectiveType(f))).length
  , [filteredFreights, effectiveType]);

  // Summary groups — by freight status, filtered by date
  const STATUS_GROUPS = [
    { key:"pending_assignment", label:"Solicitado",        icon:Ic.warn,  statuses:["pending_assignment"] },
    { key:"assigned",           label:"Asignado a flota",  icon:Ic.truck, statuses:["assigned"] },
    { key:"accepted",           label:"Confirmado camión", icon:Ic.chk,   statuses:["accepted"] },
    { key:"in_progress",        label:"En curso",          icon:Ic.nav,   statuses:["in_progress"] },
    { key:"loaded",             label:"Cargando",          icon:Ic.plant, statuses:["loaded"] },
    { key:"finished",           label:"Finalizado",        icon:Ic.chk,   statuses:["finished"] },
  ];
  const summaryGroups = useMemo(() => {
    return STATUS_GROUPS.map(g => {
      const st = stCfg(g.statuses[0]);
      const items = filteredFreights.filter(f => g.statuses.includes(f.status) && !getPendingActions(f, effectiveType(f)) && matchDate(f.loadDate, summaryFilter))
        .sort((a, b) => a.loadDate && b.loadDate ? a.loadDate.localeCompare(b.loadDate) : 0);
      return { ...g, color: st.color, items };
    }).filter(g => g.items.length > 0);
  }, [filteredFreights, effectiveType, summaryFilter]);

  // Collapsed state
  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Icon map for pending action types
  const actionIcon = (icon) => icon === "assign" ? Ic.warn : icon === "authorize" ? Ic.chk : icon === "respond" ? Ic.truck : icon === "start" ? Ic.nav : icon === "confirm" ? Ic.plant : Ic.chk;

  // Selected freight for detail
  const selFreight = selectedId ? filteredFreights.find(f => f.id === selectedId) || freights.find(f => f.id === selectedId) : null;
  const hasDetail = selectedId && selFreight;

  // Render a freight card — compact when detail is open on desktop
  const compact = hasDetail && isDesktop;
  const renderCard = (f, pa) => {
    const st = stCfg(f.status);
    const isSel = selectedId === f.id;
    if (compact) {
      // Mini card: just code + status color bar + product
      return (
        <div key={f.id} onClick={() => setSelectedId(f.id)} style={{ background: isSel ? C.priPale : C.w, border: `1px solid ${isSel ? C.pri : C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", transition: "background 0.15s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, marginTop: 3 }}>{f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}</div>
          {f.loadDate && <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{Ic.cal(C.t3, 8)} {f.loadDate}{f.loadTime ? ` · ${f.loadTime}` : ""}</div>}
        </div>
      );
    }
    return (
      <div key={f.id} onClick={() => setSelectedId(f.id)} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: 14, boxShadow: C.sh, cursor: "pointer", transition: "background 0.15s, border-color 0.15s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
            <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
          </div>
          {f.isOwnFleet && <span style={{ fontSize: 9, color: C.acc, fontWeight: 600 }}>Flota propia</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
          {f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}
        </div>
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>{f.originCompanyName || f.originName} → {f.destName}</div>
        {f.loadDate && <div style={{ fontSize: 10, color: C.t3 }}>{Ic.cal(C.t3, 10)} {f.loadDate}{f.loadTime ? ` · ${f.loadTime}` : ""}{f.transporterName ? ` · ${f.transporterName}` : ""}</div>}
      </div>
    );
  };

  // Render a collapsible group (pending or summary)
  const renderGroup = (group, keyPrefix) => {
    const gKey = keyPrefix + "_" + group.key;
    const isOpen = !!collapsed[gKey];
    return (
      <div key={gKey}>
        <button onClick={() => toggleGroup(gKey)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 0", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          {group.icon(group.color, 14)}
          <span style={{ fontSize: 14, fontWeight: 800, color: group.color }}>{group.items.length}</span>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.t1 }}>{group.label}</div>
          <span style={{ display: "flex", transform: isOpen ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.15s ease" }}>{Ic.chev(C.t3, 14)}</span>
        </button>
        {isOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 4px 16px", borderLeft: `2px solid ${group.color}30` }}>
            {group.items.map(f => renderCard(f, getPendingActions(f, effectiveType(f))))}
          </div>
        )}
      </div>
    );
  };

  // List panel content
  const todayLabel = new Date().toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
  const nowTime = new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
  // Sidebar logo area: padTop24 + font63 + padBot20 = 107px → midline ~55px. Solicitar btn top ~122px.
  const listContent = (
    <div style={{ flex: compact ? undefined : 1, width: compact ? 300 : undefined, flexShrink: 0, overflow: compact ? "auto" : undefined, boxSizing: "border-box", borderRight: compact ? `1px solid ${C.b1}` : "none" }}>
      {/* Sticky header — empresa (clickable), fecha+hora, fletes */}
      <div style={{ position: compact ? "sticky" : undefined, top: 0, zIndex: 10, background:C.bg, display: "flex", alignItems: "center", minHeight: isDesktop ? 107 : 56, padding: compact ? "0 14px" : "0 18px", borderBottom: `1px solid ${C.b2}` }}>
        <div style={{ position: "relative" }}>
          <div ref={companyPickerRef}>
            <button onClick={() => hasMultipleCompanies && setShowCompanyPicker(p => !p)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: hasMultipleCompanies ? "pointer" : "default", fontFamily: "inherit" }}>
              <span style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: C.t1 }}>
                {allSelected ? (myCompanies.length > 1 ? "Todas las empresas" : user.entity) : myCompanies.filter(c => isTypeActive(c.key)).map(c => c.name).join(", ")}
              </span>
              {hasMultipleCompanies && <span style={{ display: "flex", transform: showCompanyPicker ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.15s" }}>{Ic.chev(C.t3, 12)}</span>}
            </button>
            {/* Company dropdown */}
            {showCompanyPicker && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: C.w, border: `1px solid ${C.b1}`, borderRadius: 10, boxShadow: C.shMd, padding: 6, zIndex: 20, minWidth: 200 }}>
                {myCompanies.map(c => (
                  <button key={c.key} onClick={() => toggleType(c.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, border: "none", background: isTypeActive(c.key) ? C.priPale : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isTypeActive(c.key) ? C.pri : C.b1}`, background: isTypeActive(c.key) ? C.pri : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isTypeActive(c.key) && Ic.chk("#fff", 10)}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: C.t3 }}>{typeLabels[c.type] || c.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <span style={{ fontSize: 11, color: C.t3, textTransform: "capitalize" }}>{todayLabel} · {nowTime}</span>
            <span style={{ fontSize: 11, color: C.t3 }}>·</span>
            <span style={{ fontSize: 11, color: C.t2, fontWeight: 600 }}>{filteredFreights.length} flete{filteredFreights.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: compact ? "0 8px 8px" : "0 18px 18px" }}>

      {/* Pendientes — top aligned with Solicitar flete button (~14px padding in sidebar) */}
      {totalPendingAll > 0 && (<>
        <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12, background: `${C.acc}0D`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
            <div style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: "50%", background: C.acc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
              {Ic.bell(C.w, compact ? 13 : 16)}
              <div style={{ position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, borderRadius: 8, background: C.err, color: C.w, fontSize: 8, fontWeight: 700, padding: "0 3px", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.w}` }}>{pendingCount}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: C.acc }}>Con pendientes de mi parte</div>
              {!compact && <div style={{ fontSize: 10, color: C.t3 }}>{pendingCount} acción{pendingCount !== 1 ? "es" : ""}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {[{k:"all",l:"Todo"},{k:"today",l:"Hoy"},{k:"tomorrow",l:"Mañana"},{k:"week",l:"Semana"}].map(o => (
              <button key={o.k} onClick={() => setPendingFilter(o.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: 6, border: `1px solid ${pendingFilter === o.k ? C.acc : C.b1}`, background: pendingFilter === o.k ? `${C.acc}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9 : 10, fontWeight: pendingFilter === o.k ? 700 : 500, color: pendingFilter === o.k ? C.acc : C.t3 }}>{o.l}</button>
            ))}
          </div>
        </div>
        {pendingByAction.length > 0 && (
          <div style={{ paddingLeft: compact ? 12 : 16, borderLeft: `2px solid ${C.acc}30`, marginBottom: 16 }}>
            {pendingByAction.map(g => renderGroup({ key: g.actionKey, label: g.label, icon: actionIcon(g.icon), color: g.color, items: g.items }, "pa"))}
          </div>
        )}
        {!compact && pendingByAction.length === 0 && <div style={{ fontSize: 11, color: C.t3, paddingLeft: 16, marginBottom: 16 }}>Sin pendientes en este período</div>}
      </>)}

      {/* Sin pendientes de mi parte */}
      <div style={{ padding: compact ? "8px 10px" : "10px 12px", borderRadius: 12, background: C.okPale, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10 }}>
          <div style={{ width: compact ? 22 : 28, height: compact ? 22 : 28, borderRadius: "50%", background: C.ok, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {Ic.chk(C.w, compact ? 11 : 14)}
          </div>
          <div style={{ flex: 1, fontSize: compact ? 11 : 12, fontWeight: 700, color: C.ok }}>Sin pendientes de mi parte</div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {[{k:"all",l:"Todo"},{k:"today",l:"Hoy"},{k:"tomorrow",l:"Mañana"},{k:"week",l:"Semana"}].map(o => (
            <button key={o.k} onClick={() => setSummaryFilter(o.k)} style={{ padding: compact ? "3px 6px" : "4px 8px", borderRadius: 6, border: `1px solid ${summaryFilter === o.k ? C.ok : C.b1}`, background: summaryFilter === o.k ? `${C.ok}15` : "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: compact ? 9 : 10, fontWeight: summaryFilter === o.k ? 700 : 500, color: summaryFilter === o.k ? C.ok : C.t3 }}>{o.l}</button>
          ))}
        </div>
      </div>

      {/* Summary groups — by status */}
      {summaryGroups.length > 0 ? (
        <div style={{ paddingLeft: compact ? 12 : 16, borderLeft: `2px solid ${C.ok}30` }}>
          {summaryGroups.map(g => renderGroup(g, "sm"))}
        </div>
      ) : (
        !compact && <div style={{ fontSize: 11, color: C.t3, paddingLeft: 16 }}>Sin fletes en este período</div>
      )}
      </div>
    </div>
  );

  // Desktop: split layout — collapsed list left + DetailScreen right
  // Resolve effective userType for selected freight so DetailScreen shows correct actions
  const detailUser = selFreight ? { ...user, userType: effectiveType(selFreight) } : user;

  if (isDesktop && hasDetail) {
    return (
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "row" }}>
          {listContent}
          <DetailScreen user={detailUser} freight={selFreight} perms={perms} onBack={() => setSelectedId(null)} onAction={onAction} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} />
        </div>
      </div>
    );
  }

  // Mobile: fullscreen detail or list
  if (!isDesktop && hasDetail) {
    return <DetailScreen user={detailUser} freight={selFreight} perms={perms} onBack={() => setSelectedId(null)} onAction={onAction} actionLoading={actionLoading} onChat={onChat} onRefresh={onRefresh} onDuplicate={onDuplicate} onEdit={onEdit} />;
  }

  return listContent;
}

// Inline calendar panel for Home dashboard

// ======================== FREIGHT LIST ================================

function ListScreen({ freights, onNav, onRefresh, catalog }) {
  const [searchQ, setSearchQ] = useState("");
  const [fPlant, setFPlant] = useState("");
  const [fProducer, setFProducer] = useState("");
  const [fTransporter, setFTransporter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [viewMode, setViewMode] = useState("kanban"); // kanban | mapa | tabla

  const plantOptions = useMemo(()=>[...new Set(freights.map(f=>f.destName).filter(Boolean))].sort(),[freights]);
  const producerOptions = useMemo(()=>[...new Set(freights.map(f=>f.originCompanyName).filter(Boolean))].sort(),[freights]);
  const transporterOptions = useMemo(()=>[...new Set(freights.map(f=>f.transporterName).filter(Boolean))].sort(),[freights]);

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    if(preset==="today") { setDateFrom(fmt(today)); setDateTo(fmt(today)); }
    else if(preset==="week") { const w=new Date(today); w.setDate(w.getDate()-7); setDateFrom(fmt(w)); setDateTo(fmt(today)); }
    else if(preset==="month") { const m=new Date(today); m.setMonth(m.getMonth()-1); setDateFrom(fmt(m)); setDateTo(fmt(today)); }
    else if(preset==="quarter") { const q=new Date(today); q.setMonth(q.getMonth()-3); setDateFrom(fmt(q)); setDateTo(fmt(today)); }
    else { setDateFrom(""); setDateTo(""); }
  };

  const clearAll = () => { setSearchQ(""); setFPlant(""); setFProducer(""); setFTransporter(""); setDateFrom(""); setDateTo(""); setDatePreset(""); };
  const hasFilters = searchQ || fPlant || fProducer || fTransporter || dateFrom || dateTo;

  const filtered = useMemo(()=>{
    return freights.filter(f=>{
      if(searchQ && !textMatch(f.originCompanyName,searchQ) && !textMatch(f.code,searchQ) && !textMatch(f.grain,searchQ) && !textMatch(f.originName,searchQ) && !textMatch(f.destName,searchQ) && !textMatch(f.transporterName,searchQ)) return false;
      if(fPlant && f.destName!==fPlant) return false;
      if(fProducer && f.originCompanyName!==fProducer) return false;
      if(fTransporter && f.transporterName!==fTransporter) return false;
      if(dateFrom && f.loadDate < dateFrom) return false;
      if(dateTo && f.loadDate > dateTo) return false;
      return true;
    });
  },[freights,searchQ,fPlant,fProducer,fTransporter,dateFrom,dateTo]);

  const GROUPS = [
    { key:"solicitado", label:"Solicitado", color:"#FF6A00", icon:Ic.warn, statuses:["pending_assignment"] },
    { key:"en_curso", label:"En curso", color:"#2563EB", icon:Ic.nav, statuses:["assigned","accepted","in_progress","loaded"] },
    { key:"finalizados", label:"Finalizados", color:"#1A6B37", icon:Ic.chk, statuses:["finished"] },
    { key:"cancelados", label:"Cancelados", color:"#DC2626", icon:Ic.ban, statuses:["canceled"] },
  ];
  const grouped = useMemo(()=>{
    const map = {};
    GROUPS.forEach(g => map[g.key] = []);
    filtered.forEach(f => {
      const g = GROUPS.find(g => g.statuses.includes(f.status));
      if(g) map[g.key].push(f);
    });
    return map;
  },[filtered]);

  const { containerRef, indicator } = usePullToRefresh(onRefresh);

  return (
    <div ref={containerRef} style={{ flex:1, overflow:"auto", padding:18, WebkitOverflowScrolling:"touch" }}>
      {indicator}
      <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3, marginBottom:10 }}>Fletes</div>
      {/* Date filters — line 1 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDatePreset("custom");}} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");setDatePreset("");}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2}}>{Ic.cross(C.t3,14)}</button>}
        {[{k:"today",l:"Hoy"},{k:"week",l:"Semana"},{k:"month",l:"Mes"}].map(p=>(
          <button key={p.k} onClick={()=>applyDatePreset(p.k)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${datePreset===p.k?C.pri:C.b1}`,background:datePreset===p.k?C.priPale:C.w,color:datePreset===p.k?C.pri:C.t2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{p.l}</button>
        ))}
        {hasFilters && <button onClick={clearAll} style={{marginLeft:"auto",padding:"5px 10px",borderRadius:6,border:`1px solid ${C.err}40`,background:C.errPale,color:C.err,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Limpiar</button>}
      </div>
      {/* Search + entity filters — line 2 */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <div style={{ position:"relative", minWidth:140, flex:"0 1 200px" }}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,14)}</div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar..."
            style={{width:"100%",padding:"6px 12px 6px 30px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,12)}</button>}
        </div>
        <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fPlant?C.pri:C.b1}`,background:fPlant?C.priPale:C.w,color:fPlant?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Planta</option>
          {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fProducer} onChange={e=>setFProducer(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fProducer?C.pri:C.b1}`,background:fProducer?C.priPale:C.w,color:fProducer?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Productor</option>
          {producerOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fTransporter} onChange={e=>setFTransporter(e.target.value)} style={{padding:"6px 8px",borderRadius:8,border:`1.5px solid ${fTransporter?C.pri:C.b1}`,background:fTransporter?C.priPale:C.w,color:fTransporter?C.pri:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
          <option value="">Transportista</option>
          {transporterOptions.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={()=>setViewMode(v=>v==="kanban"?"mapa":v==="mapa"?"tabla":"kanban")} style={{marginLeft:"auto",padding:"5px 12px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
          {viewMode==="kanban"?Ic.pin(C.pri,13):viewMode==="mapa"?Ic.doc(C.pri,13):Ic.home(C.pri,13)}
          {viewMode==="kanban"?"Cambiar a mapa":viewMode==="mapa"?"Cambiar a tabla":"Cambiar a etiquetas"}
        </button>
      </div>

      {/* View: Kanban */}
      {viewMode==="kanban" && (
      <div style={{ display:"flex", gap:12, overflowX:"auto", alignItems:"flex-start", paddingBottom:8 }}>
        {GROUPS.map(group => {
          const items = grouped[group.key];
          return (
            <div key={group.key} style={{ minWidth:220, flex:"1 1 0", background:C.bg, borderRadius:12, border:`1px solid ${C.b1}`, overflow:"hidden" }}>
              <div style={{ padding:"10px 12px", borderBottom:`2px solid ${group.color}`, display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ display:"flex", flexShrink:0 }}>{group.icon(group.color, 14)}</span>
                <span style={{ fontSize:11, fontWeight:700, color:group.color }}>{group.label}</span>
                <span style={{ fontSize:10, fontWeight:600, color:C.t3, marginLeft:"auto" }}>{items.length}</span>
              </div>
              <div style={{ padding:8, display:"flex", flexDirection:"column", gap:8, maxHeight:"calc(100vh - 180px)", overflowY:"auto" }}>
                {items.length===0 && <div style={{ fontSize:11, color:C.t3, textAlign:"center", padding:16 }}>Sin fletes</div>}
                {items.map(f => {
                  const st = stCfg(f.status);
                  return (
                  <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderLeft:`4px solid ${st.color}`, borderRadius:12, padding:14, cursor:"pointer", boxShadow:C.sh, transition:"background 0.15s" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:11, fontWeight:700, fontFamily:MONO, color:C.t2 }}>{f.code}</span>
                        <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                      </div>
                      {f.isOwnFleet && <span style={{ fontSize:9, color:C.acc, fontWeight:600 }}>Flota propia</span>}
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:4 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</div>
                    <div style={{ fontSize:11, color:C.t2, marginBottom:4 }}>{f.originCompanyName || f.originName} → {f.destName}</div>
                    {f.loadDate && <div style={{ fontSize:10, color:C.t3 }}>{Ic.cal(C.t3,10)} {f.loadDate}{f.loadTime?` · ${f.loadTime}`:""}{f.transporterName?` · ${f.transporterName}`:""}</div>}
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* View: Mapa */}
      {viewMode==="mapa" && (
        <FreightsOverviewMap freights={filtered} onSelect={(id)=>onNav("detail",id)} fields={catalog?.fields} plants={catalog?.plants} />
      )}

      {/* View: Tabla */}
      {viewMode==="tabla" && (
        <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"inherit" }}>
              <thead>
                <tr style={{ background:C.bg, borderBottom:`2px solid ${C.b1}` }}>
                  {["Código","Estado","Producto","Empresa","Campo / Lote","Destino","Fecha","Hora","Transportista","Matrícula","Chofer","Celular"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={12} style={{ padding:24, textAlign:"center", color:C.t3, fontSize:12 }}>Sin fletes</td></tr>}
                {filtered.map(f=>{
                  const st = stCfg(f.status);
                  const campoLote = [f.fieldName, f.originName].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr key={f.id} onClick={()=>onNav("detail",f.id)} style={{ borderBottom:`1px solid ${C.b1}`, cursor:"pointer", transition:"background 0.1s" }} onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={{ padding:"10px 12px", fontFamily:MONO, fontWeight:700, fontSize:11, color:C.t2, whiteSpace:"nowrap" }}>{f.code}</td>
                      <td style={{ padding:"10px 12px" }}><Bd color={st.color} bg={st.bg} small>{st.label}</Bd></td>
                      <td style={{ padding:"10px 12px", fontWeight:600, color:C.t1 }}>{f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · {f.tons} {f.unit||"tn"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.originCompanyName||f.originName}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{campoLote}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.destName}</td>
                      <td style={{ padding:"10px 12px", color:C.t2, whiteSpace:"nowrap" }}>{f.loadDate}</td>
                      <td style={{ padding:"10px 12px", color:C.t3, whiteSpace:"nowrap" }}>{f.loadTime||"—"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.transporterName||"—"}</td>
                      <td style={{ padding:"10px 12px", fontFamily:MONO, fontSize:11, color:C.t2, whiteSpace:"nowrap" }}>{f.truckPlate||"—"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2 }}>{f.driverName||"—"}</td>
                      <td style={{ padding:"10px 12px", color:C.t2, whiteSpace:"nowrap" }}>{f.driverPhone||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getPendingActions(freight, userType) {
  const s = freight.status;
  const own = freight.isOwnFleet;
  if (userType === "plant") {
    if (s === "pending_assignment") return { action: "Asignar transporte", color: C.acc, icon: "assign", actionKey: "assign" };
    if (s === "assigned" && own) return { action: "Autorizar viaje", color: C.sec, icon: "authorize", actionKey: "authorize" };
    if (s === "loaded" && !freight.plantFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished" };
    return null;
  }
  if (userType === "transporter") {
    if (s === "assigned" && !own) return { action: "Aceptar o rechazar", color: C.sec, icon: "respond", actionKey: "respond" };
    if (s === "accepted") return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start" };
    if (s === "in_progress" && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded" };
    if (s === "loaded" && !freight.transporterFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm", actionKey: "confirm_finished" };
    return null;
  }
  if (userType === "producer") {
    if (s === "accepted" && own) return { action: "Iniciar viaje", color: C.pri, icon: "start", actionKey: "start" };
    if (s === "in_progress" && own && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded" };
    if (s === "loaded" && !freight.producerLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm", actionKey: "confirm_loaded" };
    return null;
  }
  return null;
}

function PendingScreen({ user, freights, onNav, onNewFreight, onAction, actionLoading, embedded }) {
  const pending = useMemo(() => {
    return freights.map(f => {
      const pa = getPendingActions(f, user.userType);
      return pa ? { ...f, pendingAction: pa } : null;
    }).filter(Boolean);
  }, [freights, user.userType]);

  // Collapsed state per group (starts expanded)
  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (key) => setCollapsed(prev=>({...prev,[key]:!prev[key]}));

  // Define status groups in priority order
  const statusGroups = useMemo(()=>{
    const groups = [
      { key:"pending_assignment", label:"Pendientes de asignación", icon:Ic.warn, color:C.acc,   statuses:["pending_assignment"] },
      { key:"assigned",           label:"Asignados — esperando respuesta", icon:Ic.truck, color:C.sec,   statuses:["assigned"] },
      { key:"accepted",           label:"Confirmados — listos para iniciar", icon:Ic.chk, color:C.pri,   statuses:["accepted"] },
      { key:"in_progress",        label:"En curso — confirmación de carga", icon:Ic.nav, color:"#258B3E", statuses:["in_progress"] },
      { key:"loaded",             label:"Cargados — confirmar entrega", icon:Ic.plant, color:"#1B7D33", statuses:["loaded"] },
    ];
    return groups.map(g=>({
      ...g,
      items: pending.filter(f=>g.statuses.includes(f.status)).sort((a,b)=>{
        // Sort by loadDate within group
        if(a.loadDate && b.loadDate) return a.loadDate.localeCompare(b.loadDate);
        return 0;
      })
    })).filter(g=>g.items.length>0);
  },[pending]);

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Pendientes</div>
        <Btn sm v="acc" icon={Ic.plus(C.w, 14)} onClick={onNewFreight}>Nuevo flete</Btn>
      </div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 18 }}>
        {pending.length > 0 ? `${pending.length} flete${pending.length !== 1 ? "s" : ""} esperando tu acción` : "No tenés acciones pendientes"}
      </div>

      {statusGroups.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.pri, marginBottom: 6 }}>Todo al día</div>
          <div style={{ fontSize: 12, color: C.t3 }}>No hay fletes que requieran tu atención</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {statusGroups.map((group, gi) => {
            const isCollapsed = collapsed[group.key];
            return (
              <div key={group.key} style={{ animation:`fadeIn 0.2s ease ${gi*0.05}s both` }}>
                {/* Group header — clickable to collapse */}
                <button onClick={()=>toggleGroup(group.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:`${group.color}0A`, borderRadius:10, border:`1px solid ${group.color}20`, borderLeft:`3px solid ${group.color}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left", marginBottom:isCollapsed?0:10, transition:"margin 0.15s ease" }}>
                  <div style={{ width:28, height:28, borderRadius:7, background:`${group.color}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {group.icon(group.color, 14)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:group.color }}>{group.label}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:group.color, background:`${group.color}15`, padding:"2px 8px", borderRadius:6 }}>{group.items.length}</span>
                    <span style={{ display:"flex", transform:isCollapsed?"rotate(90deg)":"rotate(270deg)", transition:"transform 0.15s ease" }}>{Ic.chev(group.color,16)}</span>
                  </div>
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft:4 }}>
                    {group.items.map((f, idx) => {
                      const st = stCfg(f.status);
                      const pa = f.pendingAction;
                      const canInline = embedded && onAction;
                      return (
                        <div key={f.id} style={{ width: "100%", background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${pa.color}`, borderRadius: 12, padding: 14, fontFamily: "inherit", textAlign: "left", boxShadow: C.sh, animation:`cardIn 0.2s ease ${idx*0.03}s both` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{f.code}</span>
                              <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                            </div>
                            {f.isOwnFleet && <span style={{ fontSize: 9, color: C.acc, fontWeight: 600 }}>Flota propia</span>}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
                            {f.grain === "Otros" ? f.productTypeOther || "Otros" : f.grain} · {f.tons} {f.unit || "tn"}
                          </div>
                          <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
                            {f.originName} → {f.destName}
                          </div>
                          {f.loadDate && <div style={{ fontSize: 10, color: C.t3, marginBottom: 8 }}>
                            {Ic.cal(C.t3,10)} {f.loadDate}{f.loadTime?` · ${f.loadTime}`:""}{f.transporterName?` · ${f.transporterName}`:""}
                          </div>}
                          {canInline ? (
                            pa.actionKey === "respond" ? (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button disabled={actionLoading} onClick={() => onAction(f.id, "accept")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 12px", background: C.pri, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                                  {Ic.chk("#fff", 14)}<span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Aceptar</span>
                                </button>
                                <button disabled={actionLoading} onClick={() => onAction(f.id, "reject")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.err}`, cursor: "pointer", fontFamily: "inherit" }}>
                                  {Ic.cross(C.err, 14)}<span style={{ fontSize: 12, fontWeight: 700, color: C.err }}>Rechazar</span>
                                </button>
                              </div>
                            ) : (
                              <button disabled={actionLoading} onClick={() => onAction(f.id, pa.actionKey)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", background: pa.color, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", opacity: actionLoading ? 0.6 : 1 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{pa.action}</span>
                              </button>
                            )
                          ) : (
                            <button onClick={() => onNav("detail", f.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: `${pa.color}10`, borderRadius: 8, border: `1px solid ${pa.color}20`, cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ width: 8, height: 8, borderRadius: 4, background: pa.color, animation: "ti 1.5s infinite" }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: pa.color }}>{pa.action}</span>
                              <span style={{ marginLeft: "auto", display: "flex" }}>{Ic.chev(pa.color, 16)}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ======================== FREIGHT DETAIL ==============================

function DetailScreen({ user, freight, perms, onBack, onAction, actionLoading, onChat, onRefresh, onDuplicate, onEdit }) {
  if(!freight) return null;
  const [auditLog, setAuditLog] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const auditRef = useRef(null);

  const loadAudit = async () => {
    if (auditLog) { setShowAudit(!showAudit); return; }
    try {
      const logs = await apiGetAuditLog(freight.id);
      setAuditLog(logs);
      setShowAudit(true);
    } catch(e) { console.error("Audit load failed:", e); }
  };

  // Close audit on outside click
  useEffect(() => {
    if (!showAudit) return;
    const handler = (e) => { if (auditRef.current && !auditRef.current.contains(e.target)) setShowAudit(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [showAudit]);

  const _isDesktop = useIsDesktop(768);
  const st = stCfg(freight.status);
  const actions = getActions(freight.status, user.userType, user.role, freight.isOwnFleet);

  // Filter actions based on confirmation state
  const filteredActions = actions.filter(a=>{
    if(a==="confirm_loaded" && user.userType==="transporter" && freight.transporterLoadedConfirmedAt) return false;
    if(a==="confirm_loaded" && user.userType==="producer" && freight.producerLoadedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="transporter" && freight.transporterFinishedConfirmedAt) return false;
    if(a==="confirm_finished" && user.userType==="plant" && freight.plantFinishedConfirmedAt) return false;
    return true;
  });

  return (
    <div style={{ flex:1, overflow:"auto", animation:"slideUp 0.25s ease" }}>
      {/* Sticky header — back + product title */}
      <div style={{ position:"sticky", top:0, zIndex:10, padding:"18px 18px 8px", background:C.bg }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, color:C.t3, fontWeight:600, fontFamily:MONO }}>{freight.code}</div>
            <div style={{ fontSize:22, fontWeight:800, marginTop:2, letterSpacing:-0.3 }}>{freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · {freight.tons} {freight.unit||"tn"}</div>
          </div>
          <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
        </div>
      </div>

      <div style={{ padding:"0 18px 18px" }}>

      {/* Actions */}
      {filteredActions.length > 0 && <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {filteredActions.includes("authorize") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"authorize")}>{actionLoading?"Procesando...":"Autorizar viaje"}</Btn>}
        {filteredActions.includes("assign") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"assign")}>Asignar transportista</Btn>}
        {filteredActions.includes("accept") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"accept")}>Aceptar flete</Btn>}
        {filteredActions.includes("start") && <Btn full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"start")}>{actionLoading?"Procesando...":"Iniciar viaje"}</Btn>}
        {filteredActions.includes("confirm_loaded") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_loaded")}>{actionLoading?"Procesando...":"Confirmar carga"}</Btn>}
        {filteredActions.includes("confirm_finished") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_finished")}>{actionLoading?"Procesando...":"Confirmar entrega"}</Btn>}
      </div>}

      {/* Progress — click to see audit history */}
      {freight.status !== "canceled" && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","loaded","finished"];
        const curIdx = steps.indexOf(freight.status);
        return <div ref={auditRef} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh, position:"relative" }}>
          <div onClick={loadAudit} style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            Progreso <span style={{ fontSize:9, fontWeight:500, color:C.t3, textTransform:"none", letterSpacing:0 }}>{showAudit?"▲ ocultar historial":"▼ ver historial"}</span>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"flex-start"}}>
            {steps.map((s,i)=>{
              const done = i < curIdx; const active = i === curIdx; const c = stCfg(s);
              return <div key={s} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                <div style={{width:"100%",height:active?5:4,borderRadius:3,background:done?C.pri:active?c.border:C.b1,transition:"all 0.2s"}}/>
                {active && <div style={{width:6,height:6,borderRadius:3,background:c.border,marginTop:-2}}/>}
                <span style={{fontSize:7.5,fontWeight:active?700:500,color:active?c.color:done?C.t2:C.t3,textAlign:"center",lineHeight:1.2,wordBreak:"break-word",maxWidth:"100%"}}>{c.label}</span>
              </div>;
            })}
          </div>
          {/* Audit popover */}
          {showAudit && auditLog && (
            <div style={{ marginTop:14, borderTop:`1px solid ${C.b1}`, paddingTop:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Historial de cambios</div>
              <div style={{ position:"relative", paddingLeft:18 }}>
                <div style={{ position:"absolute", left:5, top:4, bottom:4, width:2, background:C.b1, borderRadius:1 }} />
                {auditLog.map((log, i) => {
                  const fmtD = (d) => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; } };
                  const actionLabels = { created:"Solicitado", assigned:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Viaje iniciado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado" };
                  const label = actionLabels[log.action] || log.action;
                  const actionColors = { created:C.pri, assigned:C.sec, accepted:C.info, rejected:C.err, started:C.acc, confirm_loaded:C.acc, confirm_finished:C.pri, finished:C.ok, canceled:C.err, authorized:C.info, updated:C.t2 };
                  const col = actionColors[log.action] || C.t2;
                  return (
                    <div key={log.id} style={{ position:"relative", paddingBottom:i<auditLog.length-1?14:0 }}>
                      <div style={{ position:"absolute", left:-16, top:2, width:10, height:10, borderRadius:5, background:col, zIndex:2 }} />
                      <div style={{ fontSize:12, fontWeight:700, color:col }}>{label}</div>
                      <div style={{ fontSize:10.5, color:C.t2, marginTop:1 }}>{log.user?.name || "Sistema"} {log.user?.company?.name ? `· ${log.user.company.name}` : ""}</div>
                      {log.reason && <div style={{ fontSize:10, color:C.t3, fontStyle:"italic", marginTop:2 }}>"{log.reason}"</div>}
                      <div style={{ fontSize:9.5, color:C.t3, marginTop:2 }}>{fmtD(log.createdAt)}</div>
                    </div>
                  );
                })}
                {auditLog.length === 0 && <div style={{ fontSize:11, color:C.t3 }}>Sin registros</div>}
              </div>
            </div>
          )}
        </div>;
      })()}

      {/* Cross-confirmations panel */}
      {(freight.status==="loaded" || freight.status==="in_progress") && (
        <div style={{ background:C.w, border:`1px solid ${C.acc}30`, borderLeft:`3px solid ${C.acc}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          <div style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.acc, textTransform:"uppercase", letterSpacing:0.5 }}>Confirmaciones</div>
          <div style={{display:"flex",gap:16}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Carga</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.transporterLoadedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.transporterLoadedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>⏳</span>}
                  </span>
                  <span style={{color:freight.transporterLoadedConfirmedAt?C.ok:C.t2,fontWeight:freight.transporterLoadedConfirmedAt?600:400}}>Transportista</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.producerLoadedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.producerLoadedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>⏳</span>}
                  </span>
                  <span style={{color:freight.producerLoadedConfirmedAt?C.ok:C.t2,fontWeight:freight.producerLoadedConfirmedAt?600:400}}>Productor</span>
                </div>
              </div>
            </div>
            <div style={{width:1,background:C.b1}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>Entrega</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.transporterFinishedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.transporterFinishedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>⏳</span>}
                  </span>
                  <span style={{color:freight.transporterFinishedConfirmedAt?C.ok:C.t2,fontWeight:freight.transporterFinishedConfirmedAt?600:400}}>Transportista</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5}}>
                  <span style={{width:18,height:18,borderRadius:9,display:"inline-flex",alignItems:"center",justifyContent:"center",background:freight.plantFinishedConfirmedAt?C.okPale:C.accPale,flexShrink:0}}>
                    {freight.plantFinishedConfirmedAt ? Ic.chk(C.ok,12) : <span style={{fontSize:10,color:C.acc}}>⏳</span>}
                  </span>
                  <span style={{color:freight.plantFinishedConfirmedAt?C.ok:C.t2,fontWeight:freight.plantFinishedConfirmedAt?600:400}}>Planta</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info + Map — side by side on desktop */}
      <div style={{ display:"flex", flexDirection:_isDesktop?"row":"column", gap:12, marginBottom:12, alignItems:_isDesktop?"stretch":undefined }}>
        <div style={{ flex:1, background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, boxShadow:C.sh }}>
          <div style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Información del flete</div>
          {[
            [Ic.user(C.pri,15),"Empresa",freight.originCompanyName||freight.originName],
            [Ic.pin(C.ok,15),"Campo",[freight.fieldName,freight.originName].filter(Boolean).join(" / ")||"—"],
            [Ic.plant(C.t2,15),"Destino",freight.destName],
            [Ic.cal(C.t2,15),"Fecha carga",freight.loadDate],
            [Ic.clk(C.t2,15),"Hora carga",freight.loadTime],
            [Ic.user(C.t2,15),"Solicitado por",freight.requestedByName],
            [Ic.grain(C.t2,15),"Producto",`${freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · ${freight.tons} ${freight.unit||"tn"}`],
            freight.amount>0&&[Ic.grain(C.t2,15),"Importe",`$${Number(freight.amount).toLocaleString()}`],
            freight.transporterName&&[Ic.truck(C.t2,15),"Transportista",freight.transporterName],
            freight.truckPlate&&[Ic.truck(C.acc,15),"Camión",`${freight.truckPlate}${freight.truckModel?` · ${freight.truckModel}`:""}`],
            freight.driverName&&[Ic.user(C.pri,15),"Chofer",freight.driverName],
            freight.driverPhone&&[Ic.msg(C.info,15),"Teléfono",freight.driverPhone],
          ].filter(Boolean).map(([ic,label,val],i,arr)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.b2}`:"none" }}>
              <span style={{display:"flex",flexShrink:0}}>{ic}</span>
              <span style={{ fontSize:11.5, color:C.t2, minWidth:85 }}>{label}</span>
              {label==="Teléfono"?<a href={`tel:${val}`} style={{ fontSize:12, fontWeight:600, color:C.info, marginLeft:"auto", textDecoration:"none" }}>{val}</a>:
              <span style={{ fontSize:12, fontWeight:600, color:C.t1, marginLeft:"auto", textAlign:"right" }}>{val}</span>}
            </div>
          ))}
        </div>
        <div style={{ flex:1 }}>
          <FreightMap freightId={freight.id} originLat={freight.originLat} originLng={freight.originLng} destLat={freight.destLat} destLng={freight.destLng} originName={[freight.originCompanyName, [freight.fieldName,freight.originName].filter(Boolean).join("/")].filter(Boolean).join(" — ")} destName={freight.destName} status={freight.status} isDriver={user.userType==="transporter"||(user.userType==="producer"&&freight.isOwnFleet)}/>
        </div>
      </div>

      {/* Notes / Observaciones */}
      {freight.notes && (
        <div style={{ background:C.warnPale, border:`1px solid ${C.warn}30`, borderLeft:`3px solid ${C.warn}`, borderRadius:12, padding:14, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            {Ic.doc(C.warn, 14)}
            <span style={{ fontSize:10.5, fontWeight:700, color:C.warn, textTransform:"uppercase", letterSpacing:0.5 }}>Observaciones</span>
          </div>
          <div style={{ fontSize:12.5, color:C.t1, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{freight.notes}</div>
        </div>
      )}

      {/* Own fleet banners */}
      {freight.isOwnFleet && (()=>{
        const banners = {
          assigned: { icon:Ic.truck(C.acc,20), bg:C.accPale, border:C.acc, title:"Flota propia — esperando autorización", desc: user.userType==="plant" ? "El productor asignó su propio camión. Autorizá el viaje para continuar." : "Tu camión fue asignado. La planta debe autorizar el viaje." },
          accepted: { icon:Ic.chk(C.ok,20), bg:C.okPale, border:C.ok, title:"Viaje autorizado por la planta", desc: user.userType==="producer" ? "Ya podés iniciar el viaje con tu camión." : "El productor puede iniciar el viaje con su flota propia." },
          in_progress: { icon:Ic.truck(C.pri,20), bg:C.priPale, border:C.pri, title:"En viaje — flota propia", desc:"El productor viaja con su propio camión." },
        };
        const b = banners[freight.status];
        if(!b) return null;
        return <div style={{ background:b.bg, border:`1.5px solid ${b.border}30`, borderRadius:12, padding:14, marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
          {b.icon}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:b.border }}>{b.title}</div>
            <div style={{ fontSize:11, color:C.t2 }}>{b.desc}</div>
          </div>
        </div>;
      })()}

      {/* Documents gallery */}
      <DocsGallery documents={freight.documents}/>

      {/* File upload — multi-source, any status except finished/canceled */}
      {freight.status !== "finished" && freight.status !== "canceled" && (
        <FreightFileUpload freightId={freight.id} step={freight.status==="pending_assignment"?"request":freight.status==="in_progress"||freight.status==="loaded"?"load_confirmation":"assignment"} onUploaded={()=>{ if(onRefresh) onRefresh(freight.id); }} />
      )}

      <button onClick={()=>onChat(freight.conversationId)} disabled={!freight.conversationId}
        style={{ width:"100%", background:C.priPale, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.pri}30`, cursor:freight.conversationId?"pointer":"default", fontFamily:"inherit", marginBottom:12 }}>
        {Ic.msg(C.pri,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:12, fontWeight:700, color:C.pri }}>Chat del flete</div><div style={{ fontSize:10, color:C.t2 }}>Conversá con las partes involucradas</div></div>
      </button>

      {/* Edit + Cancel — bottom actions */}
      {freight.status==="pending_assignment" && perms.canRequest && <div style={{ marginBottom:8 }}><Btn full sm v="sec" icon={Ic.doc(C.pri,14)} onClick={()=>onEdit(freight)}>Editar</Btn></div>}
      {filteredActions.includes("cancel") && <div style={{ marginBottom:8 }}><Btn full v="err" icon={Ic.cross(C.err,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"cancel")}>Cancelar flete</Btn></div>}
      {filteredActions.includes("reject") && <div style={{ marginBottom:8 }}><Btn full v="err" icon={Ic.ban(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"reject")}>Rechazar asignación</Btn></div>}
      </div>
    </div>
  );
}


// ======================== NEW FREIGHT ================================

function NewScreen({ user, lots, plants, branches, fields, trucks, onBack, onCreate, duplicateFrom }) {
  const dup = duplicateFrom;
  const [destMode, setDestMode] = useState("plant");
  const [customDest, setCustomDest] = useState({ name:"", lat:null, lng:null });
  const [form, setForm] = useState({
    grain: dup?.grain || "",
    tons: dup?.tons?.toString() || "",
    lotId: dup?.originLotId || "",
    plantId: dup?.destPlantId || "",
    branchId: dup?.destBranchId || "",
    fieldId: dup?.fieldId || "",
    loadDate: dup?.loadDate?.split("T")[0] || dup?.preDate || "", loadTime: dup?.loadTime || "",
    notes: dup?.notes || "",
    unit: dup?.unit || "toneladas",
    amount: dup?.amount?.toString() || "",
    productTypeOther: dup?.productTypeOther || "",
    truckId: ""
  });
  const [errs, setErrs] = useState({});
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldLots, setFieldLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const nfCamRef = useRef(null);
  const nfGalRef = useRef(null);
  const nfDocRef = useRef(null);
  const u = f => setForm(p=>({...p,...f}));

  // Section refs for collapsible sections
  const secRefs = { product:useRef(null), quantity:useRef(null), origin:useRef(null), destination:useRef(null), schedule:useRef(null), extras:useRef(null), submit:useRef(null) };
  const [activeSection, setActiveSection] = useState(null);

  // Section completeness
  const secComplete = useMemo(()=>({
    product: !!form.grain && (form.grain!=="Otros" || !!form.productTypeOther.trim()),
    quantity: !!form.tons && parseFloat(form.tons) > 0,
    origin: !!form.fieldId && !!form.lotId,
    destination: destMode==="plant" ? !!form.plantId : !!customDest.name?.trim(),
    schedule: !!form.loadDate && /^\d{2}:\d{2}$/.test(form.loadTime),
  }),[form, destMode, customDest]);

  // Load lots when field changes
  useEffect(()=>{
    if(!form.fieldId){ setFieldLots([]); return; }
    setLoadingLots(true);
    apiGetFieldLots(form.fieldId).then(l=>setFieldLots(l||[])).catch(()=>setFieldLots([])).finally(()=>setLoadingLots(false));
  },[form.fieldId]);

  const fieldOpts = (fields||[]).map(f=>({ value:f.id, label:f.name, sub:f.address||"" }));
  const lotOpts = fieldLots.map(l=>({ value:l.id, label:l.name, sub:l.hectares?`${l.hectares} ha`:'' }));
  const plantOpts = (plants||[]).map(p=>({ value:p.id, label:p.name }));
  const selectedPlantCompanyId = (plants||[]).find(p=>p.id===form.plantId)?.companyId;
  const branchOpts = (branches||[]).filter(b=>b.companyId===selectedPlantCompanyId).map(b=>({ value:b.id, label:b.name }));
  const selectedLot = fieldLots.find(l=>l.id===form.lotId);
  const selectedPlant = (plants||[]).find(p=>p.id===form.plantId);
  const selectedBranch = (branches||[]).find(b=>b.id===form.branchId);
  const truckOpts = (trucks||[]).map(t=>({ value:t.id, label:`${t.plate}${t.model?` · ${t.model}`:""}` }));
  const showTruckSelect = (user.userType==="producer"||(user.userTypes||[]).includes("producer")) && truckOpts.length > 0;

  // Coords for map preview
  const originCoords = selectedLot?.lat ? { lat: parseFloat(selectedLot.lat), lng: parseFloat(selectedLot.lng) } : null;
  const destCoords = destMode==="plant"
    ? (selectedBranch?.lat ? { lat: parseFloat(selectedBranch.lat), lng: parseFloat(selectedBranch.lng) } : selectedPlant?.lat ? { lat: parseFloat(selectedPlant.lat), lng: parseFloat(selectedPlant.lng) } : null)
    : (customDest.lat ? { lat: customDest.lat, lng: customDest.lng } : null);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [editingDest, setEditingDest] = useState(false);
  const [overrideOrigin, setOverrideOrigin] = useState(null);
  const [overrideDest, setOverrideDest] = useState(null);
  const finalOrigin = overrideOrigin || originCoords;
  const finalDest = overrideDest || destCoords;

  const destDisplayName = destMode==="plant" ? ((selectedPlant?.name||"")+(selectedBranch?` → ${selectedBranch.name}`:"")) : (customDest.name||"");

  const submit = () => {
    setTouched(true);
    const {ok,errs:e} = validate(form, SCHEMAS.freight);
    if(form.grain==="Otros" && !form.productTypeOther.trim()) { e.productTypeOther="Descripción obligatoria"; }
    if(form.fieldId && !form.lotId) { e.lotId="Seleccioná un lote del campo"; }
    // Destination validation
    if(destMode==="plant" && !form.plantId) { e.plantId="Seleccioná una planta"; }
    if(destMode==="custom" && !customDest.name?.trim()) { e.customDestName="Nombre de destino obligatorio"; }
    setErrs(e);
    if(!ok || Object.keys(e).filter(k=>e[k]).length>0) return;
    if(submitting) return;
    setSubmitting(true);
    const payload = {...form, amount:form.amount?parseFloat(form.amount):0, photos: photos.map(p=>p.preview),
      overrideOriginLat: overrideOrigin?.lat || undefined,
      overrideOriginLng: overrideOrigin?.lng || undefined,
      overrideDestLat: overrideDest?.lat || undefined,
      overrideDestLng: overrideDest?.lng || undefined,
    };
    if(destMode==="custom") {
      payload.plantId = undefined;
      payload.branchId = undefined;
      payload.customDestName = customDest.name;
      payload.customDestLat = customDest.lat || undefined;
      payload.customDestLng = customDest.lng || undefined;
    }
    if(selectedBranch) {
      payload.customDestName = selectedBranch.name;
      payload.customDestLat = selectedBranch.lat ? parseFloat(selectedBranch.lat) : undefined;
      payload.customDestLng = selectedBranch.lng ? parseFloat(selectedBranch.lng) : undefined;
    }
    onCreate(payload);
  };

  const addPhoto = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    if(!file.type.startsWith('image/')) return;
    if(file.size > 10*1024*1024) return;
    setPhotos(prev=>[...prev, { file, preview: URL.createObjectURL(file) }]);
    e.target.value="";
  };

  const removePhoto = (idx) => {
    setPhotos(prev=>prev.filter((_,i)=>i!==idx));
  };

  const secSummary = {
    product: form.grain ? (form.grain==="Otros" ? `Otros: ${form.productTypeOther}` : form.grain) : "",
    quantity: form.tons ? `${form.tons} ${form.unit}${form.amount?` · $${form.amount}`:""}` : "",
    origin: (fieldOpts.find(f=>f.value===form.fieldId)?.label||"")+(selectedLot?` → ${selectedLot.name}`:""),
    destination: destDisplayName || "",
    schedule: form.loadDate&&form.loadTime ? `${form.loadDate} a las ${form.loadTime}` : "",
  };

  return (
    <div style={{ flex:1, overflow:"auto", padding:18, animation:"slideUp 0.25s ease" }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Solicitar Flete</div>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>Solicitando como: <span style={{fontWeight:600,color:C.t1}}>{user.name}</span></div>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* PRODUCT SECTION */}
        <Sec label="Producto" complete={secComplete.product} summary={secSummary.product} isExpanded={activeSection==="product"||!secComplete.product} onFocus={()=>setActiveSection("product")} secRef={secRefs.product}>
          <div>
            <Field label="Tipo de producto" icon={Ic.grain(C.pri,14)}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                {GRANOS.map(g=><button key={g} onClick={()=>{u({grain:g}); if(g!=="Otros")u({productTypeOther:""});}} style={{ padding:"10px 8px", borderRadius:8, border:`1.5px solid ${form.grain===g?C.pri:C.b1}`, background:form.grain===g?C.priPale:C.w, color:form.grain===g?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>{g}</button>)}
              </div>
            </Field>
            {touched&&<FieldError error={errs.grain}/>}
          </div>
          {form.grain==="Otros" && (
            <div style={{ marginTop:10 }}>
              <Field label="Descripción de producto" value={form.productTypeOther} onChange={v=>u({productTypeOther:v})} placeholder="Ej: Arena, Cemento, etc."/>
              {touched&&<FieldError error={errs.productTypeOther}/>}
            </div>
          )}
        </Sec>

        {/* QUANTITY SECTION */}
        <Sec label="Cantidad" complete={secComplete.quantity} summary={secSummary.quantity} isExpanded={activeSection==="quantity"||!secComplete.quantity} onFocus={()=>setActiveSection("quantity")} secRef={secRefs.quantity}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <Field label="Cantidad" icon={Ic.grain(C.t2,14)} value={form.tons} onChange={v=>u({tons:v})} placeholder="Ej: 30"/>
              {touched&&<FieldError error={errs.tons}/>}
            </div>
            <div>
              <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>Unidad</label>
              <div style={{ display:"flex", gap:4 }}>
                {UNITS.map(uu=><button key={uu.v} onClick={()=>u({unit:uu.v})} style={{ flex:1, padding:"10px 4px", borderRadius:8, border:`1.5px solid ${form.unit===uu.v?C.pri:C.b1}`, background:form.unit===uu.v?C.priPale:C.w, color:form.unit===uu.v?C.pri:C.t2, cursor:"pointer", fontSize:10, fontWeight:600, fontFamily:"inherit" }}>{uu.l}</button>)}
              </div>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <Field label="Importe (opcional)" value={form.amount} onChange={v=>u({amount:v})} placeholder="Ej: 150000"/>
          </div>
        </Sec>

        {/* ORIGIN SECTION */}
        <Sec label="Origen" complete={secComplete.origin} summary={secSummary.origin} isExpanded={activeSection==="origin"||!secComplete.origin} onFocus={()=>setActiveSection("origin")} secRef={secRefs.origin}>
          <div>
            <Select label="Campo" icon={Ic.pin(C.ok,14)} value={form.fieldId} onChange={v=>{u({fieldId:v,lotId:""});}} options={fieldOpts} placeholder="Seleccionar campo..."/>
          </div>
          <div style={{ marginTop:10 }}>
            <Select label="Origen (lote)" icon={Ic.pin(C.pri,14)} value={form.lotId} onChange={v=>u({lotId:v})} options={lotOpts} placeholder={loadingLots?"Cargando lotes...":form.fieldId?"Seleccionar lote...":"Primero seleccioná un campo"}/>
            {touched&&<FieldError error={errs.lotId}/>}
            {selectedLot && selectedLot.lat && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:C.priPale, borderRadius:8, marginTop:6 }}>{Ic.chk(C.pri,14)}<span style={{fontSize:10.5,color:C.pri,fontWeight:500}}>{selectedLot.lat}, {selectedLot.lng}</span></div>}
          </div>
        </Sec>

        {/* DESTINATION SECTION */}
        <Sec label="Destino" complete={secComplete.destination} summary={secSummary.destination} isExpanded={activeSection==="destination"||!secComplete.destination} onFocus={()=>setActiveSection("destination")} secRef={secRefs.destination}>
          <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.plant(C.t2,14)} Destino</label>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <button onClick={()=>{setDestMode("plant"); setCustomDest({name:"",lat:null,lng:null});}} style={{ flex:1, padding:"10px 8px", borderRadius:8, border:`1.5px solid ${destMode==="plant"?C.pri:C.b1}`, background:destMode==="plant"?C.priPale:C.w, color:destMode==="plant"?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>Planta</button>
            <button onClick={()=>{setDestMode("custom"); u({plantId:""});}} style={{ flex:1, padding:"10px 8px", borderRadius:8, border:`1.5px solid ${destMode==="custom"?C.acc:C.b1}`, background:destMode==="custom"?C.accPale:C.w, color:destMode==="custom"?C.acc:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>Personalizado</button>
          </div>
          {destMode==="plant" && (
            <>
              <Select value={form.plantId} onChange={v=>u({plantId:v,branchId:""})} options={plantOpts} placeholder="Seleccionar planta..."/>
              {touched&&<FieldError error={errs.plantId}/>}
              {form.plantId && branchOpts.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <Select label="Sucursal (opcional)" icon={Ic.pin(C.sec,14)} value={form.branchId} onChange={v=>u({branchId:v})} options={branchOpts} placeholder="Seleccionar sucursal..."/>
                </div>
              )}
            </>
          )}
          {destMode==="custom" && (
            <>
              <Field label="Nombre del destino" value={customDest.name} onChange={v=>setCustomDest(p=>({...p,name:v}))} placeholder="Ej: Acopio Central, Puerto Rosario..."/>
              {touched&&<FieldError error={errs.customDestName}/>}
              <div style={{ marginTop:8 }}>
                <LocationPicker label="Ubicación del destino" value={customDest.lat?{lat:customDest.lat,lng:customDest.lng}:null} onChange={loc=>setCustomDest(p=>({...p,lat:loc.lat,lng:loc.lng}))}/>
              </div>
            </>
          )}
        </Sec>

        {/* Route preview map */}
        {(finalOrigin || finalDest) && (
          <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:C.sh }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px" }}>
              {Ic.pin(C.pri,14)}
              <span style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Vista previa del recorrido</span>
            </div>

            {finalOrigin && finalDest ? (
              <FreightMap freightId={null} originLat={finalOrigin.lat} originLng={finalOrigin.lng} destLat={finalDest.lat} destLng={finalDest.lng} originName={fieldLots.find(l=>l.id===form.lotId)?.name||"Origen"} destName={destDisplayName||"Destino"} status="preview" isDriver={false}/>
            ) : (
              <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:C.t3 }}>
                Seleccioná {!finalOrigin?"origen (lote)":""}{!finalOrigin&&!finalDest?" y ":""}{!finalDest?"destino":""} para ver la ruta
              </div>
            )}

            {/* Edit location buttons */}
            <div style={{ padding:"6px 14px 10px", display:"flex", gap:8 }}>
              {finalOrigin && (
                <button onClick={()=>setEditingOrigin(!editingOrigin)} style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${editingOrigin?C.pri:C.b1}`, background:editingOrigin?C.priPale:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:10.5, fontWeight:600, color:editingOrigin?C.pri:C.t2, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  {Ic.pin("#1A6B37",12)} {editingOrigin?"Editando origen":"Editar origen"}
                </button>
              )}
              {finalDest && (
                <button onClick={()=>setEditingDest(!editingDest)} style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${editingDest?C.sec:C.b1}`, background:editingDest?C.secPale:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:10.5, fontWeight:600, color:editingDest?C.sec:C.t2, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  {Ic.pin("#003882",12)} {editingDest?"Editando destino":"Editar destino"}
                </button>
              )}
            </div>

            {editingOrigin && (
              <div style={{ padding:"0 14px 12px" }}>
                <LocationPicker label="Corregir ubicación de origen" value={overrideOrigin||originCoords} onChange={loc=>setOverrideOrigin({lat:loc.lat,lng:loc.lng})}/>
              </div>
            )}
            {editingDest && (
              <div style={{ padding:"0 14px 12px" }}>
                <LocationPicker label="Corregir ubicación de destino" value={overrideDest||destCoords} onChange={loc=>setOverrideDest({lat:loc.lat,lng:loc.lng})}/>
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE SECTION */}
        <Sec label="Fecha y hora" complete={secComplete.schedule} summary={secSummary.schedule} isExpanded={activeSection==="schedule"||!secComplete.schedule} onFocus={()=>setActiveSection("schedule")} secRef={secRefs.schedule}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.cal(C.pri,14)} Fecha carga</label>
              <div style={{ position:"relative" }}>
                <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} onClick={e=>e.target.showPicker?.()} onFocus={e=>{e.target.style.borderColor=touched&&errs.loadDate?C.err:C.bFocus;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.bFocus}} onBlur={e=>{e.target.style.borderColor=touched&&errs.loadDate?C.err:C.b1;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.t3}} style={{ width:"100%", padding:"12px 42px 12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadDate?C.err:C.b1}`, background:C.w, color:form.loadDate?C.t1:C.t3, fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer", minHeight:44, transition:"border-color 0.15s" }}/>
                <div className="tv-dt-icon" style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", display:"flex", color:C.t3, transition:"color 0.15s" }}>{Ic.cal(C.t3,17)}</div>
              </div>
              {touched&&<FieldError error={errs.loadDate}/>}
            </div>
            <div>
              <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.clk(C.pri,14)} Hora carga</label>
              <div style={{ position:"relative" }}>
                <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} onClick={e=>e.target.showPicker?.()} onFocus={e=>{e.target.style.borderColor=touched&&errs.loadTime?C.err:C.bFocus;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.bFocus}} onBlur={e=>{e.target.style.borderColor=touched&&errs.loadTime?C.err:C.b1;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.t3}} style={{ width:"100%", padding:"12px 42px 12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadTime?C.err:C.b1}`, background:C.w, color:form.loadTime?C.t1:C.t3, fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer", minHeight:44, transition:"border-color 0.15s" }}/>
                <div className="tv-dt-icon" style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", display:"flex", color:C.t3, transition:"color 0.15s" }}>{Ic.clk(C.t3,17)}</div>
              </div>
              {touched&&<FieldError error={errs.loadTime}/>}
            </div>
          </div>
        </Sec>

        {/* EXTRAS SECTION */}
        <div ref={secRefs.extras}>
          {showTruckSelect && (
            <div style={{ background:C.accPale, border:`1.5px solid ${C.acc}30`, borderRadius:12, padding:14, marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>{Ic.truck(C.acc,16)}<span style={{ fontSize:10.5, fontWeight:700, color:C.acc, textTransform:"uppercase", letterSpacing:0.5 }}>Flota propia (opcional)</span></div>
              <Select value={form.truckId} onChange={v=>u({truckId:v})} options={truckOpts} placeholder="Sin camión propio — la planta asigna"/>
              {form.truckId && <button onClick={()=>u({truckId:""})} style={{ marginTop:6, background:"none", border:"none", cursor:"pointer", fontSize:11, color:C.err, fontWeight:600, fontFamily:"inherit" }}>Quitar camión propio</button>}
            </div>
          )}

          <div>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"block", textTransform:"uppercase", letterSpacing:0.6 }}>Notas</label>
            <textarea value={form.notes} onChange={e=>u({notes:e.target.value})} placeholder="Indicaciones, horarios especiales..." rows={3} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", boxSizing:"border-box" }}/>
          </div>

          {/* Photo/file attachments */}
          <div style={{ marginTop:12 }}>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:8, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.clip(C.acc,14)} Adjuntar archivos (opcional)</label>
            {photos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                {photos.map((p,i)=>(
                  <div key={i} style={{ position:"relative", width:72, height:72, borderRadius:10, overflow:"hidden", border:`1px solid ${C.b1}` }}>
                    {p.preview ? <img src={p.preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:C.bg, padding:4 }}>{Ic.doc(C.pri,18)}<span style={{fontSize:7,color:C.t3,textAlign:"center",marginTop:2,wordBreak:"break-all"}}>{(p.name||"").slice(-12)}</span></div>}
                    <button onClick={()=>removePhoto(i)} style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:10, background:C.err, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{Ic.cross(C.w,12)}</button>
                  </div>
                ))}
              </div>
            )}
            {/* Hidden inputs */}
            <input ref={nfCamRef} type="file" accept="image/*" capture="environment" onChange={addPhoto} style={{ display:"none" }}/>
            <input ref={nfGalRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>{if(f.type.startsWith('image/')&&f.size<=10*1024*1024)setPhotos(prev=>[...prev,{file:f,preview:URL.createObjectURL(f)}])});e.target.value="";}} style={{ display:"none" }}/>
            <input ref={nfDocRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>{if(f.size<=10*1024*1024)setPhotos(prev=>[...prev,{file:f,preview:f.type.startsWith('image/')?URL.createObjectURL(f):null,name:f.name}])});e.target.value="";}} style={{ display:"none" }}/>
            <button onClick={()=>setShowAttach(true)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:`1.5px dashed ${C.b1}`, background:C.bg, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, color:C.t2 }}>
              {Ic.clip(C.t2,16)} Adjuntar archivo
            </button>
            <AttachMenu open={showAttach} onClose={()=>setShowAttach(false)} onCamera={()=>nfCamRef.current?.click()} onGallery={()=>nfGalRef.current?.click()} onFiles={()=>nfDocRef.current?.click()} />
          </div>
        </div>

        <div ref={secRefs.submit}>
          <Btn full icon={Ic.chk(C.w,16)} disabled={submitting} onClick={submit}>{submitting?"Enviando...":"Solicitar Flete"}</Btn>
        </div>
      </div>
    </div>
  );
}


// ======================== PROFILE =====================================

function MenuScreen({ user, perms, onLogout, onNav, isDesktop }) {
  const TYPE_LABELS = {plant:"Planta de Acopio",transporter:"Transportista",producer:"Productor"};
  const TYPE_COLORS = {plant:C.pri,transporter:C.info||C.sec,producer:C.acc};
  const tc = TYPE_COLORS[user.userType]||C.pri;
  const pl = []; if(perms.canRequest)pl.push("Solicitar fletes"); if(perms.canApprove)pl.push("Aprobar fletes"); if(perms.canAssignDriver)pl.push("Asignar choferes"); if(perms.canCancel)pl.push("Cancelar fletes"); if(perms.canReject)pl.push("Rechazar viajes");

  // Build companies list from companyByType
  const companies = [];
  const cbt = user.companyByType||{};
  Object.entries(cbt).forEach(([type, companyId])=>{
    if(companyId) companies.push({ type, companyId, label:TYPE_LABELS[type]||type, color:TYPE_COLORS[type]||C.t2 });
  });
  if(companies.length===0 && user.entity) companies.push({ type:user.userType, companyId:user.companyId, label:TYPE_LABELS[user.userType]||user.userType, color:tc, name:user.entity });

  const mgmtItems = [];
  if(user.userType==="transporter"||user.userType==="producer") mgmtItems.push({k:"trucks",l:"Mi Flota",ic:Ic.truck(C.acc,18),c:C.acc});
  if(user.userType==="producer") mgmtItems.push({k:"fields",l:"Mis Campos y Lotes",ic:Ic.pin(C.pri,18),c:C.pri});
  if(user.userType==="plant") mgmtItems.push({k:"access",l:"Productores / Transportistas",ic:Ic.user(C.pri,18),c:C.pri});
  if(user.role==="platform_admin"||user.role==="admin") mgmtItems.push({k:"admin",l:"Administración",ic:Ic.shield(C.err,18),c:C.err});

  const menuItem = (m, i, arr) => (
    <button key={m.k} onClick={()=>onNav(m.k)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 14px",background:"none",border:"none",borderTop:i>0?`1px solid ${C.b2}`:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{width:36,height:36,borderRadius:10,background:`${m.c}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{m.ic}</div>
      <span style={{fontSize:14,fontWeight:600,color:C.t1}}>{m.l}</span>
      <span style={{marginLeft:"auto",display:"flex"}}>{Ic.chev(C.t3,16)}</span>
    </button>
  );

  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      <div style={{fontSize:20,fontWeight:800,letterSpacing:-0.3,marginBottom:16}}>Menú</div>

      {/* Management items */}
      {mgmtItems.length>0 && (
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:4,marginBottom:12,boxShadow:C.sh}}>
          {mgmtItems.map((m,i)=>menuItem(m,i,mgmtItems))}
        </div>
      )}

      {/* Profile section */}
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14}}>{Ic.user(C.pri,16)}<span style={{fontSize:10.5,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Mi Perfil</span></div>

        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
          <Av letters={user.av} size={56} color={tc}/>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.t1}}>{user.name}</div>
            <div style={{fontSize:12,color:C.t2,marginTop:2}}>{user.email}</div>
            {user.phone && <div style={{fontSize:11,color:C.t3,marginTop:1}}>{user.phone}</div>}
          </div>
        </div>

        {/* Companies */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Empresas</div>
          {companies.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?`1px solid ${C.b2}`:"none"}}>
              <Bd color={c.color}>{c.label}</Bd>
              <span style={{fontSize:12,fontWeight:600,color:C.t1}}>{c.name||user.entity}</span>
              <Bd color={C.t2} bg={C.bgInput}>{user.role==="admin"?"Gerente":"Operario"}</Bd>
            </div>
          ))}
        </div>

        {/* Permissions */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Permisos</div>
          {pl.length>0 ? pl.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>{Ic.chk(C.pri,12)}<span style={{fontSize:12,color:C.t1}}>{p}</span></div>) : <div style={{fontSize:12,color:C.t3}}>Rol operativo</div>}
        </div>

        {/* ID */}
        {user.companyId && <div style={{fontSize:9.5,color:C.t3,fontFamily:MONO,marginBottom:10}}>ID: {user.companyId}</div>}

        <button onClick={()=>onNav("mydata")} style={{width:"100%",padding:"10px 16px",borderRadius:8,border:`1px solid ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          {Ic.edit(C.pri,14)} Administrar mis datos
        </button>
      </div>

      <Btn full v="err" onClick={onLogout} icon={Ic.out(C.err,16)}>Cerrar sesión</Btn>
    </div>
  );
}

// ======================== TRUCKS MANAGEMENT (Transportista) ===========

function TrucksScreen({ onBack, embedded }) {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try { const t = await apiGetTrucks(); setTrucks(t||[]); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!plate.trim()) { setMsg({ t: "Patente obligatoria", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateTruck({ plate: plate.trim().toUpperCase(), model: model.trim() || undefined });
      setPlate(""); setModel(""); setShowForm(false); setMsg({ t: "Camión registrado", k: "ok" });
      load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if(saving) return;
    setSaving(true);
    try { await apiDeactivateTruck(id); setMsg({ t: "Camión eliminado", k: "ok" }); load(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:18 }}>
      {!embedded && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Mi Perfil</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Mi Flota</div>
        <Btn sm onClick={() => setShowForm(!showForm)} icon={showForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showForm ? "Cerrar" : "Agregar"}</Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {showForm && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <Field label="Patente" value={plate} onChange={setPlate} placeholder="Ej: AB-123-CD" />
          <div style={{ height: 10 }} />
          <Field label="Modelo (opcional)" value={model} onChange={setModel} placeholder="Ej: Scania R500" />
          <div style={{ height: 12 }} />
          <Btn full v="acc" disabled={saving} onClick={handleCreate}>{saving ? "Guardando..." : "Registrar camión"}</Btn>
        </div>
      )}

      {loading ? <Loader/> :
        trucks.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: C.t3, fontSize: 13 }}>No tenés camiones registrados.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trucks.map(t => (
              <div key={t.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${C.acc}`, borderRadius: 12, padding: 14, boxShadow: C.sh, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {Ic.truck(C.acc, 20)}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.plate}</div>
                    {t.model && <div style={{ fontSize: 11, color: C.t3 }}>{t.model}</div>}
                    {t.assignedUser && <div style={{ fontSize: 10, color: C.t2 }}>Chofer: {t.assignedUser.name}</div>}
                  </div>
                </div>
                <button disabled={saving} onClick={() => handleDeactivate(t.id)} style={{ background: "none", border: "none", cursor: saving?"not-allowed":"pointer", padding: 6, opacity:saving?0.4:1 }}>{Ic.ban(C.err, 18)}</button>
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ======================== FIELDS MANAGEMENT (Productor) ===============

function FieldsScreen({ onBack, embedded }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [fieldAddr, setFieldAddr] = useState("");
  const [fieldLoc, setFieldLoc] = useState(null);
  const [showLotForm, setShowLotForm] = useState(null);
  const [lotName, setLotName] = useState("");
  const [lotHa, setLotHa] = useState("");
  const [lotLoc, setLotLoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  // Edit states
  const [editField, setEditField] = useState(null); // field id being edited
  const [editFieldAddr, setEditFieldAddr] = useState("");
  const [editFieldLoc, setEditFieldLoc] = useState(null);
  const [editLot, setEditLot] = useState(null); // {fieldId, lotId}
  const [editLotHa, setEditLotHa] = useState("");
  const [editLotLoc, setEditLotLoc] = useState(null);

  const load = useCallback(async () => {
    try { const f = await apiGetFields(); setFields(f || []); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreateField = async () => {
    if (!fieldName.trim()) { setMsg({ t: "Nombre obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateField({
        name: fieldName.trim(),
        address: fieldLoc?.address || fieldAddr.trim() || undefined,
        lat: fieldLoc?.lat || undefined,
        lng: fieldLoc?.lng || undefined,
      });
      setFieldName(""); setFieldAddr(""); setFieldLoc(null); setShowFieldForm(false); setMsg({ t: "Campo creado", k: "ok" }); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); } finally { setSaving(false); }
  };

  const handleCreateLot = async (fieldId) => {
    if (!lotName.trim()) { setMsg({ t: "Nombre del lote obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateLot(fieldId, {
        name: lotName.trim(),
        hectares: lotHa ? parseFloat(lotHa) : undefined,
        lat: lotLoc?.lat || undefined,
        lng: lotLoc?.lng || undefined,
      });
      setLotName(""); setLotHa(""); setLotLoc(null); setShowLotForm(null); setMsg({ t: "Lote creado", k: "ok" }); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); } finally { setSaving(false); }
  };

  const startEditField = (f) => {
    setEditField(f.id);
    setEditFieldAddr(f.address || "");
    const lat = f.lat != null ? Number(f.lat) : null;
    const lng = f.lng != null ? Number(f.lng) : null;
    setEditFieldLoc(lat && lng ? { lat, lng, address: f.address || "" } : null);
  };

  const handleUpdateField = async (fieldId) => {
    setSaving(true);
    try {
      await apiUpdateField(fieldId, {
        address: editFieldLoc?.address || editFieldAddr.trim() || undefined,
        lat: editFieldLoc?.lat || undefined,
        lng: editFieldLoc?.lng || undefined,
      });
      setEditField(null); setMsg({ t: "Campo actualizado", k: "ok" }); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); } finally { setSaving(false); }
  };

  const startEditLot = (fieldId, l) => {
    try {
      setEditLot({ fieldId, lotId: l.id });
      setEditLotHa(l.hectares != null ? String(Number(l.hectares)) : "");
      const lat = l.lat != null ? Number(l.lat) : null;
      const lng = l.lng != null ? Number(l.lng) : null;
      setEditLotLoc(lat && lng ? { lat, lng } : null);
    } catch (e) {
      console.error("startEditLot error", e);
      setEditLot({ fieldId, lotId: l.id });
      setEditLotHa("");
      setEditLotLoc(null);
    }
  };

  const handleUpdateLot = async () => {
    if (!editLot) return;
    setSaving(true);
    try {
      await apiUpdateLot(editLot.fieldId, editLot.lotId, {
        hectares: editLotHa ? parseFloat(editLotHa) : undefined,
        lat: editLotLoc?.lat || undefined,
        lng: editLotLoc?.lng || undefined,
      });
      setEditLot(null); setMsg({ t: "Lote actualizado", k: "ok" }); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); } finally { setSaving(false); }
  };

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:18 }}>
      {!embedded && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Mi Perfil</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Mis Campos</div>
        <Btn sm onClick={() => setShowFieldForm(!showFieldForm)} icon={showFieldForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showFieldForm ? "Cerrar" : "Agregar"}</Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {showFieldForm && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <Field label="Nombre del campo" value={fieldName} onChange={setFieldName} placeholder="Ej: Campo San Juan" />
          <div style={{ height: 10 }} />
          <SafeZone><LocationPicker label="Ubicación del campo" value={fieldLoc} onChange={setFieldLoc} /></SafeZone>
          <div style={{ height: 12 }} />
          <Btn full v="acc" disabled={saving} onClick={handleCreateField}>{saving ? "Guardando..." : "Crear campo"}</Btn>
        </div>
      )}

      {loading ? <Loader/> :
        fields.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>No tenés campos registrados.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {fields.map(f => (
              <div key={f.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${C.pri}`, borderRadius: 12, padding: 14, boxShadow: C.sh }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {Ic.pin(C.pri, 18)}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                      {f.address && <div style={{ fontSize: 11, color: C.t3 }}>{f.address}</div>}
                      {f.lat && <div style={{ fontSize: 9.5, color: C.ok, fontWeight: 600 }}>📍 Ubicación cargada</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => editField === f.id ? setEditField(null) : startEditField(f)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.edit(editField === f.id ? C.pri : C.t3, 16)}</button>
                    <Bd color={C.pri} small>{(f.lots || []).length} lote{(f.lots || []).length !== 1 ? "s" : ""}</Bd>
                  </div>
                </div>

                {/* Edit field form */}
                {editField === f.id && (
                  <div style={{ background: C.priPale, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar campo</div>
                    <SafeZone><LocationPicker label="Ubicación" value={editFieldLoc} onChange={setEditFieldLoc} /></SafeZone>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <Btn sm v="ghost" onClick={() => setEditField(null)}>Cancelar</Btn>
                      <Btn sm disabled={saving} onClick={() => handleUpdateField(f.id)}>{saving ? "..." : "Guardar"}</Btn>
                    </div>
                  </div>
                )}

                {(f.lots || []).map(l => (
                  <div key={l.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0 6px 28px", borderTop: `1px solid ${C.b2}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {Ic.grain(C.ok, 14)}
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</span>
                        {l.hectares && <span style={{ fontSize: 10, color: C.t3 }}>{l.hectares} ha</span>}
                        {l.lat && <span style={{ fontSize: 9, color: C.ok }}>📍</span>}
                      </div>
                      <button onClick={() => editLot?.lotId === l.id ? setEditLot(null) : startEditLot(f.id, l)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.edit(editLot?.lotId === l.id ? C.pri : C.t3, 14)}</button>
                    </div>
                    {/* Edit lot form */}
                    {editLot?.lotId === l.id && (
                      <div style={{ background: C.accPale, borderRadius: 10, padding: 12, marginLeft: 28, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.acc, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar lote</div>
                        <Field label="Hectáreas" value={editLotHa} onChange={setEditLotHa} placeholder="Ej: 150" />
                        <div style={{ height: 8 }} />
                        <SafeZone><LocationPicker label="Ubicación del lote" value={editLotLoc} onChange={setEditLotLoc} /></SafeZone>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <Btn sm v="ghost" onClick={() => setEditLot(null)}>Cancelar</Btn>
                          <Btn sm v="acc" disabled={saving} onClick={handleUpdateLot}>{saving ? "..." : "Guardar"}</Btn>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {showLotForm === f.id ? (
                  <div style={{ marginTop: 8, padding: "10px 0 0 28px", borderTop: `1px solid ${C.b2}` }}>
                    <Field label="Nombre del lote" value={lotName} onChange={setLotName} placeholder="Ej: Lote 1A" />
                    <div style={{ height: 8 }} />
                    <Field label="Hectáreas (opcional)" value={lotHa} onChange={setLotHa} placeholder="Ej: 150" />
                    <div style={{ height: 8 }} />
                    <SafeZone><LocationPicker label="Ubicación del lote" value={lotLoc} onChange={setLotLoc} /></SafeZone>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <Btn sm v="ghost" onClick={() => { setShowLotForm(null); setLotName(""); setLotHa(""); setLotLoc(null); }}>Cancelar</Btn>
                      <Btn sm v="acc" disabled={saving} onClick={() => handleCreateLot(f.id)}>{saving ? "..." : "Crear lote"}</Btn>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowLotForm(f.id)} style={{ marginTop: 6, marginLeft: 28, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: C.acc, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.plus(C.acc, 12)} Agregar lote</button>
                )}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ======================== ACCESS MANAGEMENT (Planta) ==================

function AccessScreen({ onBack }) {
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProducer, setSelectedProducer] = useState(null);
  const searchTimer = useRef(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [facilities, setFacilities] = useState(null);
  const [selectedPlantIds, setSelectedPlantIds] = useState([]);
  const [editingAccess, setEditingAccess] = useState(null); // producer record being edited
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([apiListAccessProducers(), apiGetMyFacilities().catch(()=>({plants:[],branches:[]}))]);
      setProducers(p || []);
      setFacilities(f);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (q) => {
    setSearchQ(q);
    setSelectedProducer(null);
    setSelectedPlantIds([]);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      apiSearchProducer(q.trim()).then(r => setSearchResults(r || [])).catch(() => setSearchResults([])).finally(() => setSearching(false));
    }, 400);
  };

  const handleSelectProducer = (p) => {
    setSelectedProducer(p);
    setSearchResults([]);
    setSearchQ(p.userName + (p.producerCompanyName ? ` (${p.producerCompanyName})` : ""));
  };

  const togglePlant = (id) => setSelectedPlantIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const handleGrant = async () => {
    if (!selectedProducer?.userId && !editingAccess) return;
    if (fPlants.length > 0 && selectedPlantIds.length === 0) {
      setMsg({ t: "Seleccioná al menos una planta", k: "err" }); return;
    }
    setSaving(true);
    const userId = editingAccess ? editingAccess.producerUserId : selectedProducer.userId;
    const companyId = editingAccess ? editingAccess.producerCompanyId : selectedProducer.producerCompanyId;
    try {
      await apiGrantAccess({ producerUserId: userId, producerCompanyId: companyId, allowedPlantIds: selectedPlantIds });
      setSearchQ(""); setSelectedProducer(null); setSearchResults([]); setShowGrant(false); setEditingAccess(null);
      setSelectedPlantIds([]);
      setMsg({ t: editingAccess ? "Habilitación actualizada" : "Productor habilitado — podrá seleccionar tu planta al solicitar flete", k: "ok" }); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); } finally { setSaving(false); }
  };

  const handleRevoke = async (accessId) => {
    if(saving) return;
    setSaving(true);
    try { await apiRevokeAccess(accessId); setMsg({ t: "Acceso revocado", k: "ok" }); setConfirmRevoke(null); load(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  const startEdit = (p) => {
    setEditingAccess(p);
    setSelectedPlantIds((p.allowedPlantIds || []).slice());
    setShowGrant(false); setSelectedProducer(null); setSearchResults([]); setSearchQ("");
  };

  const selCount = selectedPlantIds.length;
  const fPlants = facilities?.plants || [];
  const plantMap = useMemo(()=>new Map(fPlants.map(p=>[p.id,p])),[fPlants]);

  // Group active producers by plant
  const activeProducers = producers.filter(p=>p.active);
  const grouped = useMemo(()=>{
    const byPlant = {};
    const general = [];
    for (const p of activeProducers) {
      const pIds = (p.allowedPlantIds || []);
      if (pIds.length === 0) { general.push(p); continue; }
      for (const pid of pIds) {
        if (!byPlant[pid]) byPlant[pid] = [];
        byPlant[pid].push(p);
      }
    }
    return { byPlant, general };
  },[activeProducers]);

  const FacilityToggle = ({ id, name, address, selected, color, onToggle }) => (
    <button onClick={()=>onToggle(id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:`1.5px solid ${selected?color:C.b1}`, background:selected?`${color}0A`:C.w, cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:selected?700:500, color:selected?color:C.t1 }}>{name}</div>
        {address && <div style={{ fontSize:10, color:C.t3 }}>{address}</div>}
      </div>
      <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${selected?color:C.b1}`, background:selected?color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
        {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.w} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
    </button>
  );

  const FacilitySelector = () => (
    <div style={{ marginBottom:12 }}>
      {fPlants.length > 0 ? (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:C.t2, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5, display:"flex", alignItems:"center", gap:4 }}>{Ic.plant(C.pri,14)} Plantas</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
            {fPlants.map(p => <FacilityToggle key={p.id} id={p.id} name={p.name} address={p.address} selected={selectedPlantIds.includes(p.id)} color={C.pri} onToggle={togglePlant}/>)}
          </div>
        </>
      ) : (
        <div style={{ padding:"10px 12px", borderRadius:8, background:C.infoPale, border:`1px solid ${C.info}30`, marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.info }}>El productor tendrá acceso general a tu empresa.</div>
          <div style={{ fontSize:10.5, color:C.t3, marginTop:2 }}>Podés crear plantas desde el panel de administración para habilitar acceso específico.</div>
        </div>
      )}
    </div>
  );

  const ProducerRow = ({ p }) => {
    const nPlants = (p.allowedPlantIds||[]).length;
    const plantNames = (p.allowedPlantIds||[]).map(id=>plantMap.get(id)?.name).filter(Boolean).join(", ");
    const userName = p.producerUser?.name || p.producerCompany?.name || "Productor";
    const companyName = p.producerCompany?.name || "";
    return (
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
        <button onClick={()=>startEdit(p)} style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left", padding:0 }}>
          {Ic.user(C.ok,18)}
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.t1 }}>{userName}</div>
            {companyName && <div style={{ fontSize:10, color:C.t2 }}>{companyName}</div>}
            {plantNames && <div style={{ fontSize:10, color:C.pri }}>{plantNames}</div>}
            {nPlants===0 && <div style={{ fontSize:10, color:C.t3 }}>Acceso general</div>}
          </div>
        </button>
        <button onClick={()=>setConfirmRevoke(p)} style={{ background:"none", border:"none", cursor:"pointer", padding:6, borderRadius:6, display:"flex", alignItems:"center" }}>
          {Ic.cross(C.err,16)}
        </button>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Mi Perfil</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Productores / Transportistas</div>
        <Btn sm onClick={() => { setShowGrant(!showGrant); setEditingAccess(null); setSelectedProducer(null); setSearchResults([]); setSearchQ(""); setMsg(null); setSelectedPlantIds([]); }} icon={showGrant ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showGrant ? "Cerrar" : "Habilitar"}</Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {/* Confirm revoke modal */}
      {confirmRevoke && (
        <div style={{ position:"fixed", inset:0, background:C.bgOverlay, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }} onClick={()=>setConfirmRevoke(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius:18, padding:24, maxWidth:340, width:"100%", boxShadow:C.shLg }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Revocar acceso</div>
            <div style={{ fontSize:13, color:C.t2, marginBottom:16 }}>¿Revocar el acceso de <b>{confirmRevoke.producerUser?.name||confirmRevoke.producerCompany?.name}</b>? No podrá enviar fletes a tus plantas.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmRevoke(null)} style={{ flex:1, padding:"10px 14px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.t2 }}>Cancelar</button>
              <button disabled={saving} onClick={()=>handleRevoke(confirmRevoke.id)} style={{ flex:1, padding:"10px 14px", borderRadius:8, border:"none", background:saving?C.muted:C.err, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.w, opacity:saving?0.7:1 }}>{saving?"Revocando...":"Revocar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit access panel */}
      {editingAccess && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}>Editar: {editingAccess.producerUser?.name||editingAccess.producerCompany?.name}</div>
              <div style={{ fontSize:10, color:C.t3 }}>Modificá las plantas habilitadas</div>
            </div>
            <button onClick={()=>{setEditingAccess(null); setSelectedPlantIds([]);}} style={{ background:"none", border:"none", cursor:"pointer" }}>{Ic.cross(C.t2,18)}</button>
          </div>
          <FacilitySelector/>
          <Btn full v="acc" disabled={saving || (fPlants.length > 0 && selCount === 0)} onClick={handleGrant}>{saving ? "Guardando..." : fPlants.length > 0 ? `Guardar cambios (${selCount} seleccionados)` : "Guardar cambios"}</Btn>
        </div>
      )}

      {/* Grant new producer */}
      {showGrant && !editingAccess && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ fontSize:11, fontWeight:600, color:C.t2, marginBottom:4 }}>Habilitar un productor para que pueda seleccionar tu planta al solicitar flete.</div>
          <Field label="Buscar productor" icon={Ic.srch(C.pri,14)} value={searchQ} onChange={handleSearchChange} placeholder="Nombre, email o teléfono..."/>
          {searching && <div style={{ fontSize:11, color:C.t3, marginTop:6 }}>Buscando...</div>}

          {/* Search results list */}
          {searchResults.length > 0 && !selectedProducer && (
            <div style={{ marginTop:8, border:`1px solid ${C.b1}`, borderRadius:8, overflow:"hidden", maxHeight:240, overflowY:"auto" }}>
              {searchResults.map(p => (
                <button key={p.userId} onClick={() => handleSelectProducer(p)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:C.w, border:"none", borderBottom:`1px solid ${C.b2}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  {Ic.user(C.pri,18)}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{p.userName}</div>
                    <div style={{ fontSize:10.5, color:C.t3 }}>{p.producerCompanyName}{p.phone ? ` · ${p.phone}` : ""}{p.email ? ` · ${p.email}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQ.trim().length >= 2 && !searching && searchResults.length === 0 && !selectedProducer && (
            <div style={{ fontSize:12, color:C.t3, marginTop:8, textAlign:"center", padding:10 }}>No se encontraron productores</div>
          )}

          {/* Selected producer — show plant selector + grant button */}
          {selectedProducer && (
            <div style={{ marginTop:12, background:C.priPale, border:`1.5px solid ${C.pri}30`, borderRadius:10, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                {Ic.user(C.pri,20)}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{selectedProducer.userName}</div>
                  <div style={{ fontSize:11, color:C.t2 }}>{selectedProducer.producerCompanyName}</div>
                  {selectedProducer.phone && <div style={{ fontSize:10.5, color:C.t3 }}>{selectedProducer.phone}{selectedProducer.email ? ` · ${selectedProducer.email}` : ""}</div>}
                </div>
                <button onClick={() => { setSelectedProducer(null); setSearchQ(""); setSelectedPlantIds([]); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,16)}</button>
              </div>
              {facilities ? <FacilitySelector/> : <div style={{ fontSize:11, color:C.t3, marginBottom:8 }}>Cargando instalaciones...</div>}
              <Btn full v="acc" disabled={saving || (fPlants.length > 0 && selCount === 0)} onClick={handleGrant}>{saving ? "Habilitando..." : fPlants.length > 0 ? `Habilitar (${selCount} planta${selCount!==1?"s":""})` : "Habilitar productor"}</Btn>
            </div>
          )}
        </div>
      )}

      {/* Producer list grouped by plant */}
      {loading ? <Loader/> :
        activeProducers.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Ningún productor habilitado aún.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {fPlants.map(plant => {
              const prods = grouped.byPlant[plant.id];
              if (!prods || prods.length === 0) return null;
              return (
                <div key={plant.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px", background:`${C.pri}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                    {Ic.plant(C.pri,16)}
                    <div style={{ fontSize:13, fontWeight:700, color:C.pri }}>{plant.name}</div>
                    <div style={{ fontSize:10, color:C.t3, marginLeft:4 }}>{prods.length} productor{prods.length!==1?"es":""}</div>
                  </div>
                  <div style={{ padding:"4px 14px" }}>
                    {prods.map(p => <ProducerRow key={p.id} p={p}/>)}
                  </div>
                </div>
              );
            })}
            {grouped.general.length > 0 && (
              <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                <div style={{ padding:"12px 14px", background:`${C.t2}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                  {Ic.user(C.t2,16)}
                  <div style={{ fontSize:13, fontWeight:700, color:C.t2 }}>Acceso general</div>
                </div>
                <div style={{ padding:"4px 14px" }}>
                  {grouped.general.map(p => <ProducerRow key={p.id} p={p}/>)}
                </div>
              </div>
            )}
          </div>
      }
    </div>
  );
}

// ======================== CHATS SCREEN ================================

function ChatsScreen({ user, openConvId, onConvOpened, isDesktop }) {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newCompId, setNewCompId] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newErr, setNewErr] = useState(null);
  const [compSearchQ, setCompSearchQ] = useState("");
  const [compResults, setCompResults] = useState([]);
  const [compSearching, setCompSearching] = useState(false);
  const compSearchTimer = useRef(null);
  const [searchQ, setSearchQ] = useState("");
  const msgEndRef = useRef(null);

  const loadConvs = useCallback(async () => {
    try { const c = await apiListConversations(searchQ||undefined); setConvs(c || []); return c||[]; } catch { return []; } finally { setLoading(false); }
  }, [searchQ]);
  useEffect(() => { loadConvs().then(cs => {
    if(openConvId) {
      const found = cs.find(c=>c.id===openConvId);
      if(found) { openConv(found); }
      else { openConv({id:openConvId}); }
      if(onConvOpened) onConvOpened();
    }
  }); }, [loadConvs, openConvId]);

  // Reload when search changes (debounced)
  useEffect(()=>{ const t=setTimeout(()=>loadConvs(),300); return ()=>clearTimeout(t); },[searchQ]);

  const openConv = async (conv) => {
    setActiveConv(conv);
    try {
      const m = await apiGetMessages(conv.id);
      setMessages(m || []);
      apiMarkRead(conv.id).catch(() => {});
    } catch {}
  };

  useEffect(() => { if (msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!activeConv) return;
    const iv = setInterval(async () => {
      try { const m = await apiGetMessages(activeConv.id); setMessages(m || []); } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [activeConv]);

  const handleSend = async () => {
    if (!msgText.trim() || !activeConv) return;
    setSending(true);
    try {
      const m = await apiSendMessage(activeConv.id, msgText.trim());
      setMessages(prev => [...prev, m]);
      setMsgText("");
    } catch {} finally { setSending(false); }
  };

  const [uploading, setUploading] = useState(false);
  const chatFileRef = useRef(null);
  const chatCamRef = useRef(null);
  const chatGalRef = useRef(null);
  const [chatTab, setChatTab] = useState("chat");
  const [showChatAttach, setShowChatAttach] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    if (file.size > 15 * 1024 * 1024) { alert("Máximo 15MB"); return; }
    e.target.value = "";
    setUploading(true);
    try {
      const url = await uploadChatFile(file, activeConv.id);
      const isImg = file.type.startsWith("image/");
      const tag = `[FILE:${url}|${isImg ? "image" : "document"}|${file.name}]`;
      const m = await apiSendMessage(activeConv.id, tag);
      setMessages(prev => [...prev, m]);
    } catch (err) { console.error("Upload failed:", err); }
    finally { setUploading(false); }
  };

  // Parse file messages
  const parseFileMsg = (text) => {
    const match = text?.match(/^\[FILE:(.*?)\|(.*?)\|(.*?)\]$/);
    if (!match) return null;
    return { url: match[1], type: match[2], name: match[3] };
  };

  // Collect all files from messages
  const chatFiles = useMemo(() => {
    return messages.filter(m => parseFileMsg(m.text)).map(m => ({
      ...parseFileMsg(m.text),
      sender: m.sender?.name || "Desconocido",
      date: m.createdAt,
      id: m.id,
    }));
  }, [messages]);

  // Search users by name for new chat
  const handleCompSearch = (q) => {
    setCompSearchQ(q);
    setNewCompId("");
    setNewUserId("");
    setNewErr(null);
    clearTimeout(compSearchTimer.current);
    if (q.trim().length < 2) { setCompResults([]); return; }
    setCompSearching(true);
    compSearchTimer.current = setTimeout(()=>{
      apiSearchUsers(q.trim()).then(r=>setCompResults(r||[])).catch(()=>setCompResults([])).finally(()=>setCompSearching(false));
    }, 300);
  };

  const handleSelectUser = (u) => {
    setNewCompId(u.company?.id || "");
    setNewUserId(u.id);
    setCompSearchQ(u.name + (u.company?.name ? ` (${u.company.name})` : ""));
    setCompResults([]);
  };

  const [startingConv, setStartingConv] = useState(false);
  const handleStartConv = async () => {
    if (!newUserId) { setNewErr("Buscá y seleccioná un usuario"); return; }
    if(startingConv) return;
    setStartingConv(true);
    setNewErr(null);
    try {
      const conv = await apiStartConversation({ targetUserId: newUserId });
      setShowNew(false); setNewCompId(""); setNewUserId(""); setCompSearchQ(""); setCompResults([]);
      loadConvs();
      openConv(conv);
    } catch (e) { setNewErr(e.message); }
    finally { setStartingConv(false); }
  };

  const getConvName = (conv) => {
    if (!conv) return "Chat";
    if (conv.freight) return `Flete ${conv.freight.code}`;
    // For direct conversations, find the other user by userId
    const otherP = (conv.participants || []).find(p => p.userId && p.userId !== user.id);
    if (otherP?.user?.name) return otherP.user.name;
    // Fallback: message sender name
    const lastMsg = conv.messages?.[0];
    if (lastMsg?.sender?.id !== user.id && lastMsg?.sender?.name) return lastMsg.sender.name;
    if (conv.displayName) return conv.displayName;
    return "Chat";
  };

  const getLastMsg = (conv) => {
    const m = conv.messages?.[0];
    if (!m) return "Sin mensajes";
    const fileMatch = m.text?.match(/^\[FILE:.*?\|(.*?)\|(.*?)\]$/);
    if (fileMatch) return `${m.sender?.name?.split(" ")[0] || ""}: 📎 ${fileMatch[2]}`;
    return `${m.sender?.name?.split(" ")[0] || ""}: ${m.text?.slice(0, 40)}${m.text?.length > 40 ? "..." : ""}`;
  };

  const getLastMsgTime = (conv) => {
    const m = conv.messages?.[0];
    if (!m?.createdAt) return "";
    return new Date(m.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short"});
  };

  const stLabel = (s) => {
    const m = {pending_assignment:"Pendiente",assigned:"Asignado",accepted:"Aceptado",in_progress:"En viaje",loaded:"Cargado",finished:"Finalizado",canceled:"Cancelado"};
    return m[s]||s;
  };
  const stColor = (s) => {
    const m = {pending_assignment:C.warn,assigned:C.info,accepted:C.info,in_progress:C.acc,loaded:C.pri,finished:C.ok,canceled:C.muted};
    return m[s]||C.t3;
  };

  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (key) => setExpandedGroups(prev=>({...prev,[key]:!prev[key]}));

  // Group conversations: company → user (nested folders)
  const grouped = useMemo(() => {
    const byCompany = {};
    const directConvs = [];
    const statusOrder = { in_progress: 0, loaded: 1, accepted: 2, assigned: 3, pending_assignment: 4, finished: 5, canceled: 6 };

    convs.forEach(c => {
      if (c.freight) {
        const others = (c.participants || []).filter(p => p.userId !== user.id && p.companyId !== user.companyId);
        const companyName = others.map(o => o.company?.name || "").filter(Boolean).sort().join(", ") || "Otros";
        const companyType = others[0]?.company?.type || "";
        if (!byCompany[companyName]) byCompany[companyName] = { companyType, freightConvs: [] };
        byCompany[companyName].freightConvs.push(c);
      } else {
        // For direct conversations, find the OTHER person by userId only
        const others = (c.participants || []).filter(p => p.userId && p.userId !== user.id);
        const otherUser = others.find(o => o.user?.name) || others[0];
        // Fallback: get name from last message sender
        const lastMsg = c.messages?.[0];
        const msgSenderName = (lastMsg?.sender?.id && lastMsg.sender.id !== user.id) ? lastMsg.sender.name : null;
        const userName = otherUser?.user?.name || msgSenderName || "Chat";
        const companyName = otherUser?.company?.name || "";
        directConvs.push({ ...c, _userName: userName, _companyName: companyName });
      }
    });

    Object.values(byCompany).forEach(group => {
      group.freightConvs.sort((a, b) => {
        const sa = statusOrder[a.freight?.status] ?? 99;
        const sb = statusOrder[b.freight?.status] ?? 99;
        if (sa !== sb) return sa - sb;
        return (b.messages?.[0]?.createdAt||"").localeCompare(a.messages?.[0]?.createdAt||"");
      });
    });

    directConvs.sort((a, b) => (b.messages?.[0]?.createdAt||"").localeCompare(a.messages?.[0]?.createdAt||""));

    const getLatest = group => {
      let max = "";
      group.freightConvs.forEach(c => { const t = c.messages?.[0]?.createdAt||""; if(t>max) max=t; });
      return max;
    };
    const companyKeys = Object.keys(byCompany).sort((a, b) => getLatest(byCompany[b]).localeCompare(getLatest(byCompany[a])));

    return { companyKeys, byCompany, directConvs };
  }, [convs, user.companyId, user.id]);

  // Chat detail view
  const chatDetailPanel = activeConv ? (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: isDesktop ? undefined : "fadeIn 0.2s ease" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.b1}`, background: C.w, display: "flex", alignItems: "center", gap: 10, paddingTop: isDesktop ? 12 : "max(12px, env(safe-area-inset-top))" }}>
          {!isDesktop && <button onClick={() => { setActiveConv(null); setChatTab("chat"); }} style={{ background: C.priPale, border: `1px solid ${C.pri}20`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontFamily:"inherit", fontSize:11, fontWeight:600, color:C.pri }}>{Ic.chev(C.pri, 16)} Chats</button>}
          {isDesktop && <button onClick={() => { setActiveConv(null); setChatTab("chat"); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>{Ic.chev(C.pri, 20)}</button>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{activeConv.freight?.code ? `Flete ${activeConv.freight.code}` : "Mensaje directo"}</div>
            <div style={{ fontSize: 10, color: C.t3 }}>{getConvName(activeConv)} · {messages.length} mensaje{messages.length !== 1 ? "s" : ""}</div>
          </div>
          {/* Chat / Files tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setChatTab("chat")} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: chatTab === "chat" ? C.priPale : "none", color: chatTab === "chat" ? C.pri : C.t3, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Chat</button>
            <button onClick={() => setChatTab("files")} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: chatTab === "files" ? C.priPale : "none", color: chatTab === "files" ? C.pri : C.t3, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", position: "relative" }}>
              Archivos
              {chatFiles.length > 0 && <span style={{ position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 7, background: C.acc, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{chatFiles.length}</span>}
            </button>
          </div>
        </div>

        {chatTab === "chat" ? (
          <>
            <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {messages.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin mensajes aún. Escribí el primero.</div>}
              {messages.map(m => {
                const mine = m.senderId === user.id || m.sender?.id === user.id;
                const fileData = parseFileMsg(m.text);
                return (
                  <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                    {!mine && <div style={{ fontSize: 9.5, color: C.t3, marginBottom: 2, marginLeft: 4 }}>{m.sender?.name?.split(" ")[0]}</div>}
                    <div style={{ padding: fileData ? "6px" : "10px 14px", borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4, background: mine ? C.pri : C.w, color: mine ? C.w : C.t1, fontSize: 13, border: mine ? "none" : `1px solid ${C.b1}`, boxShadow: C.sh, overflow: "hidden" }}>
                      {fileData ? (
                        fileData.type === "image" ? (
                          <a href={fileData.url} target="_blank" rel="noopener noreferrer">
                            <img src={fileData.url} alt={fileData.name} style={{ maxWidth: 220, maxHeight: 200, borderRadius: 10, display: "block" }} />
                          </a>
                        ) : (
                          <a href={fileData.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", textDecoration: "none", color: mine ? "#fff" : C.t1 }}>
                            {Ic.doc(mine ? "#fff" : C.pri, 20)}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-all" }}>{fileData.name}</div>
                              <div style={{ fontSize: 10, opacity: 0.7 }}>Abrir archivo</div>
                            </div>
                          </a>
                        )
                      ) : m.text}
                    </div>
                    <div style={{ fontSize: 9, color: C.t3, marginTop: 2, textAlign: mine ? "right" : "left", marginRight: mine ? 4 : 0, marginLeft: mine ? 0 : 4 }}>
                      {new Date(m.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Upload progress */}
            {uploading && (
              <div style={{ padding: "8px 18px", background: C.accPale, borderTop: `1px solid ${C.acc}20`, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${C.acc}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>Subiendo archivo...</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.b1}`, background: C.w, display: "flex", gap: 8, alignItems: "center" }}>
              <input ref={chatCamRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
              <input ref={chatGalRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} style={{ display: "none" }} />
              <input ref={chatFileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
              <button onClick={() => setShowChatAttach(true)} disabled={uploading} style={{ width: 40, height: 40, borderRadius: 20, background: C.bg, border: `1px solid ${C.b1}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {Ic.clip(C.t2, 18)}
              </button>
              <AttachMenu open={showChatAttach} onClose={() => setShowChatAttach(false)} onCamera={() => chatCamRef.current?.click()} onGallery={() => chatGalRef.current?.click()} onFiles={() => chatFileRef.current?.click()} />
              <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Escribí un mensaje..." style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1.5px solid ${C.b1}`, background: C.bg, color: C.t1, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <button onClick={handleSend} disabled={sending || !msgText.trim()} style={{ width: 40, height: 40, borderRadius: 20, background: msgText.trim() ? C.pri : C.b1, border: "none", cursor: msgText.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {Ic.send(C.w, 16)}
              </button>
            </div>
          </>
        ) : (
          /* Files tab */
          <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
            {chatFiles.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin archivos compartidos</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chatFiles.map(f => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: C.w, border: `1px solid ${C.b1}`, borderRadius: 10, textDecoration: "none", boxShadow: C.sh }}>
                    {f.type === "image" ? (
                      <img src={f.url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.doc(C.pri, 22)}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, wordBreak: "break-all" }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>{f.sender} · {new Date(f.date).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    {Ic.down(C.pri, 16)}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    ) : isDesktop ? (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.t3, fontSize: 13 }}>Seleccioná una conversación</div>
    ) : null;

  // Mobile: show detail fullscreen if activeConv
  if (!isDesktop && activeConv) {
    return chatDetailPanel;
  }

  // Desktop: split layout / Mobile: list only
  const chatListPanel = (
    <div style={{ flex: isDesktop ? undefined : 1, overflow: "auto", padding: isDesktop ? "14px 12px" : 18, width: isDesktop ? 320 : undefined, minWidth: isDesktop ? 320 : undefined, borderRight: isDesktop ? `1px solid ${C.b2}` : undefined, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isDesktop ? 10 : 14 }}>
        <div style={{ fontSize: isDesktop ? 16 : 20, fontWeight: 800, letterSpacing: -0.3 }}>Mensajes</div>
        <Btn sm onClick={() => setShowNew(!showNew)} icon={showNew ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showNew ? "Cerrar" : "Nuevo"}</Btn>
      </div>

      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:8 }}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,16)}</div>
        <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);}} placeholder="Buscar conversación..."
          style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,16)}</button>}
      </div>

      {showNew && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: C.sh }}>
          <Field label="Buscar usuario" value={compSearchQ} onChange={handleCompSearch} placeholder="Escribí el nombre de la persona..."/>
          {compSearching && <div style={{ fontSize:10, color:C.t3, marginTop:4 }}>Buscando...</div>}
          {compResults.length > 0 && (
            <div style={{ marginTop:6, border:`1px solid ${C.b1}`, borderRadius:8, maxHeight:200, overflow:"auto" }}>
              {compResults.map(u=>(
                <button key={u.id} onClick={()=>handleSelectUser(u)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:newUserId===u.id?C.priPale:C.w, border:"none", borderBottom:`1px solid ${C.b2}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  {Ic.user(C.pri,16)}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{u.name}</div>
                    <div style={{ fontSize:10, color:C.t3 }}>{u.company?.name || "Sin empresa"} · {({plant:"Planta",transporter:"Transportista",producer:"Productor"})[u.company?.type]||u.company?.type||""}</div>
                  </div>
                  {newUserId===u.id && Ic.chk(C.pri,14)}
                </button>
              ))}
            </div>
          )}
          {compSearchQ.length>=2 && !compSearching && compResults.length===0 && !newUserId && <div style={{ fontSize:11, color:C.t3, marginTop:6 }}>Sin resultados</div>}
          {newUserId && <div style={{ fontSize:11, color:C.ok, marginTop:6, fontWeight:600 }}>Usuario seleccionado: {compSearchQ}</div>}
          {newErr && <div style={{ fontSize: 11, color: C.err, marginTop:6, marginBottom: 4 }}>{newErr}</div>}
          <div style={{ marginTop:10 }}><Btn full v="acc" disabled={!newUserId||startingConv} onClick={handleStartConv}>{startingConv?"Iniciando...":"Iniciar conversación"}</Btn></div>
        </div>
      )}

      {loading ? <Loader/> :
        convs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin conversaciones aún.{!showNew && <><br/><button onClick={()=>setShowNew(true)} style={{background:"none",border:"none",color:C.acc,fontWeight:600,cursor:"pointer",fontFamily:"inherit",fontSize:13,marginTop:8}}>Iniciar una nueva</button></>}</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Direct conversations (flat, no nesting) */}
            {grouped.directConvs.map(c => (
              <button key={c.id} onClick={() => openConv(c)} style={{ width:"100%", padding:"12px 14px", border:`1px solid ${c.unread?C.acc+"40":C.b1}`, borderRadius:12, background:c.unread?C.accPale+"30":C.w, cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", alignItems:"center", gap:12, transition:"all 0.15s", boxShadow:C.sh }} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background=c.unread?C.accPale+"30":C.w}>
                <div style={{ width:36, height:36, borderRadius:18, background:c.unread?C.acc:C.accPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {Ic.user(c.unread?"#fff":C.acc, 16)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:c.unread?800:700, color:C.t1 }}>{c._userName}</span>
                  </div>
                  {c._companyName && <div style={{ fontSize:10, color:C.t3, marginTop:1 }}>{c._companyName}</div>}
                  <div style={{ fontSize:11, color:c.unread?C.t1:C.t3, fontWeight:c.unread?600:400, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginTop:2 }}>{getLastMsg(c)}</div>
                </div>
                {c.unread && <div style={{ width:8, height:8, borderRadius:4, background:C.acc, flexShrink:0 }} />}
                <span style={{ fontSize:9.5, color:C.t3, flexShrink:0 }}>{getLastMsgTime(c)}</span>
              </button>
            ))}

            {/* Freight conversations grouped by company */}
            {grouped.companyKeys.map(companyName => {
              const group = grouped.byCompany[companyName];
              const isOpen = expandedGroups[companyName] !== false;
              const freightCount = group.freightConvs.length;
              const unreadCount = group.freightConvs.filter(c=>c.unread).length;
              return (
                <div key={companyName} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, overflow: "hidden", boxShadow: C.sh }}>
                  <button onClick={() => toggleGroup(companyName)} style={{ width: "100%", padding: "12px 14px", background: C.w, border: "none", borderBottom: isOpen ? `1px solid ${C.b2}` : "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {Ic.truck(C.pri, 16)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{companyName}</div>
                      <div style={{ fontSize: 10.5, color: C.t3 }}>{freightCount} flete{freightCount !== 1 ? "s" : ""}</div>
                    </div>
                    {unreadCount > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: C.acc, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", flexShrink: 0 }}>{unreadCount}</span>}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {group.freightConvs.map(c => (
                        <button key={c.id} onClick={() => openConv(c)} style={{ padding: "10px 14px", border: "none", borderTop: `1px solid ${C.b2}`, background: c.unread ? C.accPale+"30" : C.w, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 10, width: "100%", transition: "background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background=c.unread?C.accPale+"30":C.w}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: stColor(c.freight?.status), flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: c.unread ? 800 : 700, color: C.t1 }}>Flete {c.freight.code}</span>
                              <span style={{ fontSize: 9, fontWeight: 600, color: stColor(c.freight?.status), textTransform: "uppercase" }}>{stLabel(c.freight?.status)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: c.unread ? C.t1 : C.t3, fontWeight: c.unread ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{getLastMsg(c)}</div>
                          </div>
                          {c.unread && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.acc, flexShrink: 0 }} />}
                          <span style={{ fontSize: 9.5, color: C.t3, flexShrink: 0 }}>{getLastMsgTime(c)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" }}>
        {chatListPanel}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {chatDetailPanel}
        </div>
      </div>
    );
  }

  return chatListPanel;
}

// ======================== CALENDAR SCREEN =============================

function CalendarScreen({ freights, perms, onNav, isDesktop }) {
  const [calMonth, setCalMonth] = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()}});
  const [calSelDay, setCalSelDay] = useState(null);
  const [calSelMonth, setCalSelMonth] = useState(null);
  const [fStatus, setFStatus] = useState("");
  const [monthsToShow, setMonthsToShow] = useState(1);

  const STATUS_GROUPS_CAL = { solicitado:["pending_assignment"], en_curso:["assigned","accepted","in_progress","loaded"], finalizados:["finished"], cancelados:["canceled"] };
  const filtered = useMemo(()=>{
    let ff = freights.filter(f=>f.status!=="draft");
    if(fStatus) ff = ff.filter(f=>(STATUS_GROUPS_CAL[fStatus]||[]).includes(f.status));
    return ff;
  },[freights,fStatus]);

  const monNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const getMonthData = (y, m) => {
    const arr=[];
    const first=new Date(y,m,1);
    const lastDay=new Date(y,m+1,0).getDate();
    const startDow=(first.getDay()+6)%7;
    for(let i=0;i<startDow;i++)arr.push(null);
    for(let d=1;d<=lastDay;d++)arr.push(d);
    const map={};
    filtered.forEach(f=>{
      if(!f.loadDate)return;
      const dd=parseInt(f.loadDate.slice(8,10),10);
      const mm=parseInt(f.loadDate.slice(5,7),10)-1;
      const yy=parseInt(f.loadDate.slice(0,4),10);
      if(yy===y&&mm===m){ if(!map[dd])map[dd]=[]; map[dd].push(f); }
    });
    return { days: arr, byDay: map };
  };

  const months = useMemo(()=>{
    const result = [];
    for(let i=0;i<monthsToShow;i++){
      let y=calMonth.y, m=calMonth.m+i;
      if(m>11){m-=12;y++;}
      result.push({y,m,...getMonthData(y,m)});
    }
    return result;
  },[calMonth,monthsToShow,filtered]);

  const activeMonth = calSelMonth!==null ? months[calSelMonth] : months[0];
  const selFreights = calSelDay && activeMonth ? (activeMonth.byDay[calSelDay]||[]) : [];
  const today=new Date();
  const totalInMonth = months.reduce((s,mo)=>s+Object.values(mo.byDay).reduce((ss,a)=>ss+a.length,0),0);

  // --- Detail panel (shared between mobile inline and desktop side panel) ---
  const detailPanel = calSelDay ? (
    <div style={{animation:"fadeIn 0.2s ease",padding:isDesktop?"18px 16px":0,overflow:"auto",flex:isDesktop?1:undefined}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:C.t1}}>{calSelDay} de {monNames[activeMonth?.m??calMonth.m]}</div>
          <div style={{fontSize:11,color:C.t2,marginTop:2}}>{selFreights.length} flete{selFreights.length!==1?"s":""}</div>
        </div>
        {isDesktop&&<button onClick={()=>setCalSelDay(null)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:4}}>{Ic.cross(C.t3,18)}</button>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {selFreights.length===0&&<div style={{textAlign:"center",padding:30,color:C.t3,fontSize:12,background:C.w,borderRadius:10,border:`1px solid ${C.b1}`}}>Sin fletes programados este día</div>}
        {selFreights.map(f=>{
          const st=stCfg(f.status);
          return <div key={f.id} className="tv-card" onClick={()=>onNav("detail",f.id)} style={{background:C.w,border:`1px solid ${C.b1}`,borderLeft:`4px solid ${st.border}`,borderRadius:12,padding:14,cursor:"pointer",boxShadow:C.sh}}>
            {/* Header: code + status */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:C.t3,fontFamily:MONO}}>{f.code}</span>
              <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
            </div>
            {/* Product + qty */}
            <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:6}}>{f.grain} · {f.tons} {f.unit||"tn"}</div>
            {/* Route */}
            <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.t2,marginBottom:6}}>
              {Ic.user(C.t3,12)} <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.originCompanyName || (f.originName||"").split("—")[0].trim()}</span>
              <span style={{color:C.t3,margin:"0 2px"}}>→</span>
              {Ic.plant(C.t3,12)} <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.destName}</span>
            </div>
            {/* Info grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px",fontSize:10.5,color:C.t2}}>
              {f.loadTime&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.cal(C.t3,11)} <span style={{fontWeight:600}}>{f.loadTime}</span></div>}
              {f.destName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.plant(C.t3,11)} <span>{f.destName}</span></div>}
              {f.transporterName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.truck(C.t3,11)} <span>{f.transporterName}</span></div>}
              {f.truckPlate&&<div style={{fontSize:10,fontFamily:MONO,color:C.t3}}>{f.truckPlate}</div>}
              {f.driverName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{Ic.user(C.t3,11)} <span>{f.driverName}</span></div>}
              {f.requestedByName&&<div style={{fontSize:10,color:C.t3}}>Sol: {f.requestedByName}</div>}
            </div>
          </div>;
        })}
      </div>
    </div>
  ) : isDesktop ? (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.t3,fontSize:13,padding:20,textAlign:"center"}}>
      <div>{Ic.cal(C.b1,40)}<div style={{marginTop:8}}>Seleccioná un día para ver los fletes programados</div></div>
    </div>
  ) : null;

  // --- Calendar grid panel ---
  const calendarPanel = (
    <div style={{flex:isDesktop?undefined:1,overflow:"auto",padding:18,minWidth:isDesktop?420:undefined}}>
      {!isDesktop && <button onClick={()=>onNav("home")} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:10, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Inicio</button>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>Calendario</div>
        <div style={{fontSize:11,color:C.t2}}>{totalInMonth} flete{totalInMonth!==1?"s":""}</div>
      </div>

      {/* Status filter */}
      <div style={{ display:"flex", gap:5, marginBottom:14, flexWrap:"wrap" }}>
        {[{k:"",l:"Todos"},{k:"solicitado",l:"Solicitado"},{k:"en_curso",l:"En curso"},{k:"finalizados",l:"Finalizados"},{k:"cancelados",l:"Cancelados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFStatus(opt.k)} style={{ padding:"4px 10px", borderRadius:20, border:`1.5px solid ${fStatus===opt.k?C.pri:C.b1}`, background:fStatus===opt.k?C.priPale:C.w, color:fStatus===opt.k?C.pri:C.t2, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>{opt.l}</button>
        ))}
      </div>

      {/* Navigation + months toggle */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <button onClick={()=>{setCalMonth(p=>p.m===0?{y:p.y-1,m:11}:{y:p.y,m:p.m-1});setCalSelDay(null);setCalSelMonth(null);}} style={{background:C.priPale,border:`1px solid ${C.pri}20`,borderRadius:8,cursor:"pointer",padding:"6px 10px",display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:C.pri,fontFamily:"inherit"}}>{Ic.chev(C.pri,16)} Anterior</button>
        <div style={{display:"flex",gap:4}}>
          {[1,3,6].map(n=><button key={n} onClick={()=>setMonthsToShow(n)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${monthsToShow===n?C.pri:C.b1}`,background:monthsToShow===n?C.priPale:C.w,color:monthsToShow===n?C.pri:C.t2,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{n} mes{n>1?"es":""}</button>)}
        </div>
        <button onClick={()=>{setCalMonth(p=>p.m===11?{y:p.y+1,m:0}:{y:p.y,m:p.m+1});setCalSelDay(null);setCalSelMonth(null);}} style={{background:C.priPale,border:`1px solid ${C.pri}20`,borderRadius:8,cursor:"pointer",padding:"6px 10px",display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:C.pri,fontFamily:"inherit"}}>Siguiente <span style={{display:"inline-flex",transform:"rotate(180deg)"}}>{Ic.chev(C.pri,16)}</span></button>
      </div>

      {/* Calendar grids */}
      <div style={{display:"grid",gridTemplateColumns:monthsToShow===1?"1fr":isDesktop&&monthsToShow>=3?"1fr 1fr 1fr":monthsToShow>=3?"1fr":"1fr 1fr",gap:12,marginBottom:isDesktop?0:14}}>
        {months.map((mo,mi)=>{
          const isTodayMonth = mo.m===today.getMonth()&&mo.y===today.getFullYear();
          const moCount = Object.values(mo.byDay).reduce((s,a)=>s+a.length,0);
          return <div key={`${mo.y}-${mo.m}`} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:monthsToShow===1?16:12,boxShadow:C.sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:monthsToShow===1?17:14,fontWeight:700,color:isTodayMonth?C.pri:C.t1}}>{monNames[mo.m]} {mo.y}</span>
              {moCount>0&&<span style={{fontSize:9,color:C.t3,fontWeight:600}}>{moCount}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:monthsToShow===1?3:2,textAlign:"center"}}>
              {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{fontSize:monthsToShow===1?10:8,fontWeight:700,color:C.t3,padding:monthsToShow===1?6:3}}>{d}</div>)}
              {mo.days.map((d,i)=>{
                if(!d)return<div key={`e${i}`}/>;
                const cnt=mo.byDay[d]?.length||0;
                const sel=calSelDay===d&&calSelMonth===mi;
                const td=d===today.getDate()&&isTodayMonth;
                const statuses=mo.byDay[d]?.map(f=>stCfg(f.status).color)||[];
                return <div key={d} onClick={()=>{setCalSelDay(sel?null:d);setCalSelMonth(sel?null:mi);}} style={{padding:monthsToShow===1?"8px 4px":"4px 2px",borderRadius:monthsToShow===1?10:6,cursor:"pointer",background:sel?C.pri:td?C.priPale:"transparent",transition:"all 0.15s",minHeight:monthsToShow===1?44:30}}>
                  <div style={{fontSize:monthsToShow===1?14:11,fontWeight:sel||td?700:400,color:sel?C.w:td?C.pri:C.t1}}>{d}</div>
                  {cnt>0&&<div style={{display:"flex",gap:1,justifyContent:"center",marginTop:2,flexWrap:"wrap"}}>
                    {statuses.slice(0,monthsToShow===1?4:2).map((c,j)=><div key={j} style={{width:monthsToShow===1?6:4,height:monthsToShow===1?6:4,borderRadius:3,background:sel?"#fff":c}}/>)}
                    {cnt>(monthsToShow===1?4:2)&&<div style={{fontSize:7,color:sel?C.w:C.t3,lineHeight:1}}>+{cnt-(monthsToShow===1?4:2)}</div>}
                  </div>}
                </div>;
              })}
            </div>
          </div>;
        })}
      </div>

      {/* Mobile: inline detail below calendar */}
      {!isDesktop && detailPanel}
    </div>
  );

  // --- Desktop: split layout (detail panel left, calendar right) ---
  if (isDesktop) {
    return (
      <div style={{flex:1,display:"flex",flexDirection:"row",overflow:"hidden"}}>
        {calSelDay ? (
          <div style={{width:380,minWidth:380,borderRight:`1px solid ${C.b2}`,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg,animation:"fadeIn 0.2s ease"}}>
            {detailPanel}
          </div>
        ) : null}
        <div style={{flex:1,overflow:"auto"}}>
          {calendarPanel}
        </div>
      </div>
    );
  }

  // --- Mobile: single column ---
  return calendarPanel;
}

// ======================== REPORTS =====================================


// ======================== EDIT FREIGHT ================================

function EditScreen({ freight, fields, plants, onBack, onSave }) {
  const [form, setForm] = useState({
    loadDate: freight.loadDate || "",
    loadTime: freight.loadTime || "",
    notes: freight.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const u = f => setForm(p=>({...p,...f}));

  const save = async () => {
    setSaving(true);
    await onSave(freight.id, form);
    setSaving(false);
  };

  return (
    <div style={{ flex:1, overflow:"auto", padding:18 }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Editar Flete</div>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>{freight.code} · {freight.grain} · {freight.tons} {freight.unit||"tn"}</div>

      <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, boxShadow:C.sh }}>
        <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <div style={{flex:1}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"flex",alignItems:"center",gap:4,textTransform:"uppercase",letterSpacing:0.6}}>{Ic.cal(C.pri,14)} Fecha</label>
            <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} onClick={e=>e.target.showPicker?.()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"flex",alignItems:"center",gap:4,textTransform:"uppercase",letterSpacing:0.6}}>{Ic.clk(C.pri,14)} Hora</label>
            <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} onClick={e=>e.target.showPicker?.()} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Notas</label>
          <textarea value={form.notes} onChange={e=>u({notes:e.target.value})} placeholder="Indicaciones..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box"}}/>
        </div>

        <Btn full disabled={saving} onClick={save}>{saving?"Guardando...":"Guardar cambios"}</Btn>
      </div>

      <div style={{ marginTop:16, padding:12, background:C.bgInput, borderRadius:10, fontSize:11, color:C.t3 }}>
        Solo se puede editar fecha, hora y notas. Para cambiar origen, destino o producto, cancelá y creá un flete nuevo.
      </div>
    </div>
  );
}

function ReportsScreen({ onBack, freights, isDesktop, embedded }) {
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const toggle = (k) => setExpanded(p=>({...p,[k]:!p[k]}));
  const toggleSel = (id, e) => { e.stopPropagation(); setSelected(p => { const n = new Set(p); if(n.has(id)) n.delete(id); else n.add(id); return n; }); };

  const allFreights = (freights||[]).filter(f=>{
    if(dateFrom && f.loadDate < dateFrom) return false;
    if(dateTo && f.loadDate > dateTo) return false;
    if(!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (f.code||"").toLowerCase().includes(q) || (f.originName||"").toLowerCase().includes(q) || (f.destName||"").toLowerCase().includes(q) || (f.grain||"").toLowerCase().includes(q) || (f.transporterName||"").toLowerCase().includes(q) || (f.requestedByName||"").toLowerCase().includes(q);
  });

  const STATUS_GROUPS_RPT = { solicitado:["pending_assignment"], en_curso:["assigned","accepted","in_progress","loaded"], finalizados:["finished"], cancelados:["canceled"] };
  const filtered = filterStatus==="all" ? allFreights : allFreights.filter(f=>(STATUS_GROUPS_RPT[filterStatus]||[]).includes(f.status));

  const groups = useMemo(()=>{
    const solicitado = filtered.filter(f=>f.status==="pending_assignment");
    const enCurso = filtered.filter(f=>["assigned","accepted","in_progress","loaded"].includes(f.status));
    const finished = filtered.filter(f=>f.status==="finished");
    const canceled = filtered.filter(f=>f.status==="canceled");
    return [
      {key:"solicitado", label:"Solicitado", items:solicitado, color:"#FF6A00"},
      {key:"en_curso", label:"En curso", items:enCurso, color:"#2563EB"},
      {key:"finished", label:"Finalizados", items:finished, color:"#1A6B37"},
      {key:"canceled", label:"Cancelados", items:canceled, color:"#DC2626"},
    ].filter(g=>g.items.length>0);
  },[filtered]);

  const totalDocs = allFreights.reduce((sum,f)=>sum+(f.documents?.length||0),0);
  const exportData = selected.size > 0 ? filtered.filter(f=>selected.has(f.id)) : filtered;

  return (
    <div style={{ flex:embedded?undefined:1, overflow:embedded?"visible":"auto", padding:embedded?0:18 }}>
      {!isDesktop && !embedded && <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Mi Perfil</button>}
      {!embedded && <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3, marginBottom:4 }}>Informes y Documentos</div>}
      <div style={{ fontSize:12, color:C.t2, marginBottom:12 }}>{allFreights.length} flete{allFreights.length!==1?"s":""} · {totalDocs} documento{totalDocs!==1?"s":""}</div>

      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:12 }}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,16)}</div>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar por código, origen, destino, producto..."
          style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,16)}</button>}
      </div>

      {/* Status filter pills + export buttons */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {[{k:"all",l:"Todos"},{k:"solicitado",l:"Solicitado"},{k:"en_curso",l:"En curso"},{k:"finalizados",l:"Finalizados"},{k:"cancelados",l:"Cancelados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFilterStatus(opt.k)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${filterStatus===opt.k?C.pri:C.b1}`, background:filterStatus===opt.k?C.priPale:C.w, color:filterStatus===opt.k?C.pri:C.t2, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{opt.l}</button>
        ))}
        <span style={{fontSize:10,color:C.t2,fontWeight:600,marginLeft:4}}>Desde</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateFrom?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        <span style={{fontSize:10,color:C.t2,fontWeight:600}}>Hasta</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.b1}`,background:C.w,color:dateTo?C.t1:C.t3,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
        {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:2}}>{Ic.cross(C.t3,14)}</button>}
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          {selected.size>0 && <button onClick={()=>setSelected(new Set())} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {selected.size} seleccionado{selected.size!==1?"s":""} {Ic.cross(C.pri,10)}
          </button>}
          <button onClick={()=>exportExcel(exportData,"tolvink-fletes.xls")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid #1A6B37`,background:"#E6F4EA",color:"#1A6B37",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc("#1A6B37",12)} Excel
          </button>
          <button onClick={()=>exportPDF(exportData,"Informe de Fletes")} style={{padding:"5px 10px",borderRadius:8,border:`1.5px solid #DC2626`,background:"#FEE2E2",color:"#DC2626",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            {Ic.doc("#DC2626",12)} PDF
          </button>
        </div>
      </div>

      {allFreights.length===0 && <div style={{ textAlign:"center", padding:32, color:C.t3, fontSize:13 }}>No hay fletes registrados.</div>}

      {groups.map(group=>(
        <div key={group.key} style={{ marginBottom:16 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{width:8,height:8,borderRadius:4,background:group.color}}/>
            {group.label} ({group.items.length})
          </div>

          {group.items.map(f=>{
            const isOpen = expanded[f.id];
            const isSel = selected.has(f.id);
            const docs = f.documents||[];
            return (
              <div key={f.id} style={{ background:isSel?C.priPale:C.w, border:`1px solid ${isSel?C.pri:C.b1}`, borderRadius:12, overflow:"hidden", marginBottom:8, boxShadow:C.sh, transition:"all 0.15s" }}>
                <button onClick={()=>toggle(f.id)} style={{ width:"100%", padding:"12px 14px", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
                  <span onClick={(e)=>toggleSel(f.id,e)} style={{width:20,height:20,borderRadius:6,border:`2px solid ${isSel?C.pri:C.b1}`,background:isSel?C.pri:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                    {isSel && Ic.chk("#fff",12)}
                  </span>
                  {Ic.doc(group.color,18)}
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:700, fontFamily:MONO }}>{f.code}</span>
                      <span style={{ fontSize:10, color:C.t3 }}>{f.grain} · {f.tons} {f.unit||"tn"}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.t2, marginTop:2 }}>{docs.length} doc{docs.length!==1?"s":""} · {f.originName} → {f.destName}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" style={{transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {isOpen && (
                  <div style={{ borderTop:`1px solid ${C.b2}`, padding:"8px 14px" }}>
                    {docs.length>0 ? docs.map((d,i)=>(
                      <div key={d.id||i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<docs.length-1?`1px solid ${C.b2}`:"none" }}>
                        {d.type==="photo" ? (
                          <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ width:48, height:48, borderRadius:8, overflow:"hidden", flexShrink:0, border:`1px solid ${C.b1}` }}>
                            <img src={d.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          </a>
                        ) : (
                          <div style={{ width:48, height:48, borderRadius:8, background:C.secPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {Ic.doc(C.sec,20)}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{d.name||"Documento"}</div>
                          <div style={{ fontSize:10, color:C.t3 }}>{d.step==="request"?"Solicitud":d.step==="load_confirmation"?"Carga":d.step==="assignment"?"Asignación":"Otro"} · {d.createdAt?new Date(d.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short"}):""}</div>
                        </div>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ display:"flex", padding:6, borderRadius:8, background:C.secPale, textDecoration:"none" }}>
                          {Ic.eye(C.sec,16)}
                        </a>
                      </div>
                    )) : <div style={{ fontSize:11, color:C.t3, padding:"8px 0" }}>Sin documentos adjuntos</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ======================== MODALS =====================================

function AssignModal({ freight, transporters, onClose, onConfirm }) {
  const [t,setT] = useState("");
  const [loading,setLoading] = useState(false);
  const ts = transporters||[];
  const doConfirm = async ()=>{ if(loading||!t) return; setLoading(true); await onConfirm(t); setLoading(false); };
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Asignar transporte · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn · {freight.originName}</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Transportista</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
          {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10}}>No hay transportistas disponibles</div>}
          {ts.map(x=><button key={x.id} onClick={()=>setT(x.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${t===x.id?C.pri:C.b1}`,background:t===x.id?C.priPale:C.w,color:t===x.id?C.pri:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>{Ic.truck(t===x.id?C.pri:C.t3,16)} {x.name}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading}>Cancelar</Btn><Btn full disabled={!t||loading} onClick={doConfirm}>{loading?"Asignando...":"Asignar"}</Btn></div>
      </div>
    </div>
  );
}

function TruckSelectModal({ freight, trucks, onClose, onConfirm }) {
  const [sel,setSel] = useState("");
  const [loading,setLoading] = useState(false);
  const ts = (trucks||[]).filter(t=>t.active!==false);
  const doConfirm = async ()=>{ if(loading||!sel) return; setLoading(true); await onConfirm(sel); setLoading(false); };
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Aceptar flete · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn → {freight.destName}</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccioná un camión</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18,maxHeight:220,overflowY:"auto"}}>
          {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No tenés camiones registrados.<br/><span style={{color:C.acc,fontWeight:600}}>Registrá uno desde tu perfil.</span></div>}
          {ts.map(t=><button key={t.id} onClick={()=>setSel(t.id)} style={{padding:"13px 14px",borderRadius:12,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${sel===t.id?C.acc:C.b1}`,background:sel===t.id?C.accPale:C.w,color:sel===t.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            {Ic.truck(sel===t.id?C.acc:C.t3,18)}
            <div>
              <div style={{fontSize:13,fontWeight:700,color:sel===t.id?C.acc:C.t1}}>{t.plate}</div>
              {t.model && <div style={{fontSize:10.5,fontWeight:400,color:C.t3,marginTop:1}}>{t.model}</div>}
              {t.assignedUser && <div style={{fontSize:10,color:C.t3,marginTop:1}}>Chofer: {t.assignedUser.name}</div>}
            </div>
          </button>)}
        </div>
        <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading}>Cancelar</Btn><Btn full v="acc" disabled={!sel||loading} onClick={doConfirm}>{loading?"Aceptando...":"Aceptar flete"}</Btn></div>
      </div>
    </div>
  );
}

function ReasonModal({ title, freight, btnLabel, btnType="err", onClose, onConfirm }) {
  const [reason,setReason] = useState("");
  const [loading,setLoading] = useState(false);
  const doConfirm = async ()=>{ if(loading||!reason) return; setLoading(true); await onConfirm(reason); setLoading(false); };
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4,color:btnType==="err"?C.err:C.t1}}>{title} · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Motivo</label>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box",marginBottom:16}}/>
        <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose} disabled={loading}>Volver</Btn><Btn full v={btnType} disabled={!reason||loading} onClick={doConfirm}>{loading?"Procesando...":btnLabel}</Btn></div>
      </div>
    </div>
  );
}

// ======================== ADMIN SHARED ================================
const adminStyles = () => {
  const sel = { width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.b1}`,fontSize:13,fontFamily:"inherit",background:C.bgInput,color:C.t1,boxSizing:"border-box",appearance:"none",WebkitAppearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",paddingRight:30,cursor:"pointer",transition:"border-color 0.15s" };
  const inp = { width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.b1}`,fontSize:13,fontFamily:"inherit",background:C.bgInput,color:C.t1,boxSizing:"border-box",transition:"border-color 0.15s" };
  const half = { ...inp, flex:1 };
  const btnP = (color,dis) => ({ width:"100%",padding:"10px 0",borderRadius:8,background:color,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:dis?0.6:1,transition:"opacity 0.15s" });
  const lbl = { fontSize:11,fontWeight:600,color:C.t3,marginBottom:4 };
  return { sel, inp, half, btnP, lbl };
};
const typeColors = { producer:"#F59E0B",plant:"#6366F1",transporter:"#3B82F6" };
const typeLabels = { producer:"Productor",plant:"Planta",transporter:"Transportista" };
const roleLabels = { platform_admin:"Admin Principal",admin:"Gerente",operator:"Operario" };
const adminBackBtn = (onClick) => <button onClick={onClick} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button>;

// ======================== MY DATA SCREEN ==============================
function MyDataScreen({ user, onBack }) {
  const s = adminStyles();
  const [form, setForm] = useState({ name:user.name||"", email:user.email||"", phone:user.phone||"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const show = (t,k="ok") => { setMsg({t,k}); setTimeout(()=>setMsg(null),3000); };
  const handleSave = async () => {
    if(!form.name.trim()||!form.email.trim()) return show("Nombre y email obligatorios","err");
    setSaving(true);
    try { await apiUpdateMe(form); show("Datos actualizados"); } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };
  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      {adminBackBtn(onBack)}
      <div style={{fontSize:18,fontWeight:800,color:C.t1,marginBottom:4}}>Mis datos</div>
      <div style={{fontSize:11,color:C.t3,marginBottom:14}}>Editá tu información personal</div>
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,boxShadow:C.sh}}>
        <div style={s.lbl}>Nombre:</div>
        <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Nombre completo" style={{...s.inp,marginBottom:10}} />
        <div style={s.lbl}>Email:</div>
        <input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="Email" type="email" style={{...s.inp,marginBottom:10}} />
        <div style={s.lbl}>Teléfono:</div>
        <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={{...s.inp,marginBottom:10}} />
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10,paddingTop:8,borderTop:`1px solid ${C.b2}`}}>
          <Bd color={C.t2}>{roleLabels[user.role]||user.role}</Bd>
          {(user.userTypes||[]).map(t=><Bd key={t} color={typeColors[t]}>{typeLabels[t]}</Bd>)}
          {user.company&&<Bd color={typeColors[user.company?.type]||C.t2}>{user.company?.name||user.entity}</Bd>}
        </div>
        <button onClick={handleSave} disabled={saving} style={s.btnP(C.pri,saving)}>{saving?"Guardando...":"Guardar cambios"}</button>
      </div>
      {msg&&<div style={{padding:"8px 12px",borderRadius:8,background:msg.k==="ok"?C.okPale:`${C.err}15`,color:msg.k==="ok"?C.ok:C.err,fontSize:12,marginTop:10}}>{msg.t}</div>}
    </div>
  );
}

// ======================== ADMIN SCREEN ================================
function AdminScreen({ user, onBack }) {
  const isPlatform = user.role === "platform_admin";
  const isManager = user.role === "admin";
  const s = adminStyles();

  const [tab, setTab] = useState("companies");
  const [companies, setCompanies] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statsFilter, setStatsFilter] = useState(null);

  // Views: list | companyForm | companyDetail | userForm | userEdit
  const [view, setView] = useState("list");
  const [companyForm, setCompanyForm] = useState({ name:"",type:"producer",phone:"",email:"",rut:"",hasInternalFleet:false,lat:null,lng:null,address:"" });
  const [editCompanyId, setEditCompanyId] = useState(null);
  const [userForm, setUserForm] = useState({ name:"",email:"",phone:"",password:"",userTypes:[],companyByType:{},roleByType:{} });
  const [editUserData, setEditUserData] = useState(null);
  const [activeUserType, setActiveUserType] = useState(null); // which type tab is active in user edit
  const [branchForm, setBranchForm] = useState({ name:"",address:"",reference:"",lat:null,lng:null,locationAddress:"" });
  const [editBranchId, setEditBranchId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showBranchForm, setShowBranchForm] = useState(false);

  // Producer: fields + lots
  const [fields, setFields] = useState([]);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState({ name:"",lat:null,lng:null,address:"",hectares:"",comments:"" });
  const [editFieldId, setEditFieldId] = useState(null);
  const [expandedFieldId, setExpandedFieldId] = useState(null);
  const [lots, setLots] = useState([]);
  const [showLotForm, setShowLotForm] = useState(false);
  const [lotForm, setLotForm] = useState({ name:"",lat:null,lng:null,address:"",hectares:"",comments:"" });
  const [editLotId, setEditLotId] = useState(null);

  // Transporter: trucks
  const [trucks, setTrucks] = useState([]);
  const [showTruckForm, setShowTruckForm] = useState(false);
  const [truckForm, setTruckForm] = useState({ plate:"",brand:"",model:"",capacity:"" });
  const [editTruckId, setEditTruckId] = useState(null);

  // Detail tab: branches | fields | trucks
  const [detailTab, setDetailTab] = useState("branches");

  const show = (t,k="ok") => { setMsg({t,k}); setTimeout(()=>setMsg(null),3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([apiAdminListCompanies(), apiAdminListUsers()]);
      setCompanies(c||[]); setAllCompanies(c||[]); setUsers(u||[]); setAllUsers(u||[]);
      if(isPlatform) { const st = await apiAdminStats(); setStats(st); }
    } catch(e) { show(e.message,"err"); }
    finally { setLoading(false); }
  }, [isPlatform]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if(tab==="companies") { const c=search?(await apiAdminListCompanies(search)):allCompanies; setCompanies(c||[]); }
        else { const u=search?(await apiAdminListUsers(search)):allUsers; setUsers(u||[]); }
      } catch {}
    }, 300);
    return ()=>clearTimeout(t);
  }, [search, tab, allCompanies, allUsers]);

  const handleStatsClick = (filter) => {
    if(statsFilter===filter) { setStatsFilter(null); return; }
    setStatsFilter(filter);
    if(filter==="companies"||filter==="branches") setTab("companies");
    else if(filter==="users") setTab("users");
    setSearch("");
  };

  // --- Company ---
  const openNewCompany = () => { setCompanyForm({name:"",type:"producer",phone:"",email:"",rut:"",hasInternalFleet:false,lat:null,lng:null,address:""}); setEditCompanyId(null); setView("companyForm"); };
  const openEditCompany = (c) => { setCompanyForm({name:c.name,type:c.type,phone:c.phone||"",email:c.email||"",rut:c.rut||"",hasInternalFleet:!!c.hasInternalFleet,lat:c.lat?Number(c.lat):null,lng:c.lng?Number(c.lng):null,address:c.address||""}); setEditCompanyId(c.id); setView("companyForm"); };
  const handleSaveCompany = async () => {
    if(!companyForm.name.trim()) return show("Nombre requerido","err");
    setSaving(true);
    try {
      if(editCompanyId) { await apiAdminUpdateCompany(editCompanyId, companyForm); show("Empresa actualizada"); }
      else { await apiAdminCreateCompany(companyForm); show("Empresa creada"); }
      setView("list"); load();
    } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };

  // --- Branches ---
  const openCompanyDetail = async (c) => {
    setSelectedCompany(c); setBranches([]); setFields([]); setTrucks([]);
    setShowBranchForm(false); setShowFieldForm(false); setShowTruckForm(false); setShowLotForm(false); setExpandedFieldId(null);
    setDetailTab("branches"); setView("companyDetail");
    try { const b=await apiAdminListBranches(c.id); setBranches(b||[]); } catch {}
    if(c.type==="producer") { try { const f=await apiAdminListFields(c.id); setFields(f||[]); } catch {} }
    if(c.type==="transporter") { try { const t=await apiAdminListTrucks(c.id); setTrucks(t||[]); } catch {} }
  };
  const openNewBranch = () => { setBranchForm({name:"",address:"",reference:"",lat:null,lng:null,locationAddress:""}); setEditBranchId(null); setShowBranchForm(true); };
  const openEditBranch = (b) => { setBranchForm({name:b.name,address:b.address||"",reference:b.reference||"",lat:b.lat?Number(b.lat):null,lng:b.lng?Number(b.lng):null,locationAddress:""}); setEditBranchId(b.id); setShowBranchForm(true); };
  const handleSaveBranch = async () => {
    if(!branchForm.name.trim()) return show("Nombre requerido","err");
    setSaving(true);
    try {
      if(editBranchId) { await apiAdminUpdateBranch(editBranchId, branchForm); show("Sucursal actualizada"); }
      else { await apiAdminCreateBranch({...branchForm,companyId:selectedCompany.id}); show("Sucursal creada"); }
      setShowBranchForm(false); const b=await apiAdminListBranches(selectedCompany.id); setBranches(b||[]); load();
    } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };
  const handleDeleteBranch = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteBranch(id); show("Sucursal eliminada"); const b=await apiAdminListBranches(selectedCompany.id); setBranches(b||[]); load(); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Fields ---
  const openNewField = () => { setFieldForm({name:"",lat:null,lng:null,address:"",hectares:"",comments:""}); setEditFieldId(null); setShowFieldForm(true); };
  const openEditField = (f) => { setFieldForm({name:f.name,lat:f.lat?Number(f.lat):null,lng:f.lng?Number(f.lng):null,address:f.address||"",hectares:f.hectares?String(f.hectares):"",comments:f.comments||""}); setEditFieldId(f.id); setShowFieldForm(true); };
  const handleSaveField = async () => {
    if(!fieldForm.name.trim()) return show("Nombre requerido","err");
    if(fieldForm.lat==null||fieldForm.lng==null) return show("Ubicación requerida","err");
    setSaving(true);
    try {
      const data = {...fieldForm, hectares:fieldForm.hectares?Number(fieldForm.hectares):null};
      if(editFieldId) { await apiAdminUpdateField(editFieldId, data); show("Campo actualizado"); }
      else { await apiAdminCreateField(selectedCompany.id, data); show("Campo creado"); }
      setShowFieldForm(false); const f=await apiAdminListFields(selectedCompany.id); setFields(f||[]);
    } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };
  const handleDeleteField = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteField(id); show("Campo eliminado"); const f=await apiAdminListFields(selectedCompany.id); setFields(f||[]); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Lots ---
  const expandField = async (fieldId) => {
    if(expandedFieldId===fieldId) { setExpandedFieldId(null); return; }
    setExpandedFieldId(fieldId); setLots([]); setShowLotForm(false);
    try { const l=await apiAdminListLots(fieldId); setLots(l||[]); } catch {}
  };
  const openNewLot = () => { setLotForm({name:"",lat:null,lng:null,address:"",hectares:"",comments:""}); setEditLotId(null); setShowLotForm(true); };
  const openEditLot = (l) => { setLotForm({name:l.name,lat:l.lat?Number(l.lat):null,lng:l.lng?Number(l.lng):null,address:"",hectares:l.hectares?String(l.hectares):"",comments:l.comments||""}); setEditLotId(l.id); setShowLotForm(true); };
  const handleSaveLot = async () => {
    if(!lotForm.name.trim()) return show("Nombre requerido","err");
    if(lotForm.lat==null||lotForm.lng==null) return show("Ubicación requerida","err");
    setSaving(true);
    try {
      const data = {...lotForm, hectares:lotForm.hectares?Number(lotForm.hectares):null};
      if(editLotId) { await apiAdminUpdateLot(editLotId, data); show("Lote actualizado"); }
      else { await apiAdminCreateLot(expandedFieldId, data); show("Lote creado"); }
      setShowLotForm(false); const l=await apiAdminListLots(expandedFieldId); setLots(l||[]);
      const f=await apiAdminListFields(selectedCompany.id); setFields(f||[]);
    } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };
  const handleDeleteLot = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteLot(id); show("Lote eliminado"); const l=await apiAdminListLots(expandedFieldId); setLots(l||[]); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Trucks ---
  const openNewTruck = () => { setTruckForm({plate:"",brand:"",model:"",capacity:""}); setEditTruckId(null); setShowTruckForm(true); };
  const openEditTruck = (t) => { setTruckForm({plate:t.plate,brand:t.brand||"",model:t.model||"",capacity:t.capacity||""}); setEditTruckId(t.id); setShowTruckForm(true); };
  const handleSaveTruck = async () => {
    if(!truckForm.plate.trim()) return show("Patente requerida","err");
    setSaving(true);
    try {
      if(editTruckId) { await apiAdminUpdateTruck(editTruckId, truckForm); show("Vehículo actualizado"); }
      else { await apiAdminCreateTruck(selectedCompany.id, truckForm); show("Vehículo creado"); }
      setShowTruckForm(false); const t=await apiAdminListTrucks(selectedCompany.id); setTrucks(t||[]);
    } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };
  const handleDeleteTruck = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteTruck(id); show("Vehículo eliminado"); const t=await apiAdminListTrucks(selectedCompany.id); setTrucks(t||[]); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Users with companyByType + roleByType ---
  const toggleFormUserType = (t) => setUserForm(p=>({...p,userTypes:p.userTypes.includes(t)?p.userTypes.filter(x=>x!==t):[...p.userTypes,t]}));
  const toggleEditUserType = (t) => setEditUserData(p=>{
    const has = (p.userTypes||[]).includes(t);
    const newTypes = has ? (p.userTypes||[]).filter(x=>x!==t) : [...(p.userTypes||[]),t];
    return {...p, userTypes:newTypes};
  });

  const openNewUser = () => { setUserForm({name:"",email:"",phone:"",password:"",userTypes:[],companyByType:{},roleByType:{}}); setActiveUserType(null); setView("userForm"); };

  const openEditUser = (u) => {
    const cbt = u.companyByType && typeof u.companyByType === "object" ? {...u.companyByType} : {};
    const rbt = u.roleByType && typeof u.roleByType === "object" ? {...u.roleByType} : {};
    if(u.companyId && u.company && Object.keys(cbt).length===0) cbt[u.company.type] = u.companyId;
    if(u.role && Object.keys(rbt).length===0 && (u.userTypes||[]).length>0) {
      (u.userTypes||[]).forEach(t => { rbt[t] = u.role; });
    }
    const types = u.userTypes||[];
    setEditUserData({...u, userTypes:types, companyByType:cbt, roleByType:rbt});
    setActiveUserType(types[0]||null);
    setView("userEdit");
  };

  const handleCreateUser = async () => {
    if(!userForm.name.trim()||!userForm.email.trim()||!userForm.password) return show("Nombre, email y contraseña obligatorios","err");
    if(userForm.userTypes.length===0) return show("Seleccioná al menos un tipo","err");
    setSaving(true);
    const cbt = userForm.companyByType||{};
    const rbt = userForm.roleByType||{};
    const firstCompanyId = Object.values(cbt).find(v=>v) || undefined;
    const firstRole = Object.values(rbt).find(v=>v) || "operator";
    try { await apiAdminCreateUser({...userForm, companyId:firstCompanyId, role:firstRole, companyByType:cbt, roleByType:rbt}); show("Usuario creado"); setView("list"); load(); }
    catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };

  const handleSaveEditUser = async () => {
    setSaving(true);
    const cbt = editUserData.companyByType||{};
    const rbt = editUserData.roleByType||{};
    const firstCompanyId = Object.values(cbt).find(v=>v) || null;
    const highestRole = Object.values(rbt).includes("platform_admin") ? "platform_admin" : Object.values(rbt).includes("admin") ? "admin" : "operator";
    try {
      await apiAdminUpdateUser(editUserData.id, { name:editUserData.name, email:editUserData.email, phone:editUserData.phone, role:highestRole, userTypes:editUserData.userTypes, companyId:firstCompanyId, companyByType:cbt, roleByType:rbt, active:editUserData.active });
      show("Usuario actualizado"); setView("list"); load();
    } catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };

  const MsgBar = () => msg ? <div style={{padding:"8px 12px",borderRadius:8,background:msg.k==="ok"?C.okPale:`${C.err}15`,color:msg.k==="ok"?C.ok:C.err,fontSize:12,marginTop:10,marginBottom:10,display:"flex",justifyContent:"space-between"}}>{msg.t}<button onClick={()=>setMsg(null)} style={{background:"none",border:"none",cursor:"pointer",color:"inherit",fontFamily:"inherit"}}>✕</button></div> : null;

  // ===================== COMPANY FORM =====================
  if (view==="companyForm") {
    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {adminBackBtn(()=>setView("list"))}
        <div style={{fontSize:16,fontWeight:700,color:C.t1,marginBottom:12}}>{editCompanyId?"Editar empresa":"Nueva empresa"}</div>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,boxShadow:C.sh}}>
          <div style={s.lbl}>Nombre:</div>
          <input value={companyForm.name} onChange={e=>setCompanyForm(p=>({...p,name:e.target.value}))} placeholder="Nombre de la empresa" style={{...s.inp,marginBottom:10}} />
          <div style={s.lbl}>Tipo:</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {["producer","plant","transporter"].map(t=>(<button key={t} onClick={()=>setCompanyForm(p=>({...p,type:t}))} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1.5px solid ${companyForm.type===t?typeColors[t]:C.b1}`,background:companyForm.type===t?`${typeColors[t]}12`:C.w,color:companyForm.type===t?typeColors[t]:C.t2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{typeLabels[t]}</button>))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><div style={s.lbl}>Email:</div><input value={companyForm.email} onChange={e=>setCompanyForm(p=>({...p,email:e.target.value}))} placeholder="Email" style={s.inp} /></div>
            <div style={{flex:1}}><div style={s.lbl}>Teléfono:</div><input value={companyForm.phone} onChange={e=>setCompanyForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={s.inp} /></div>
          </div>
          <div style={s.lbl}>RUT:</div>
          <input value={companyForm.rut} onChange={e=>setCompanyForm(p=>({...p,rut:e.target.value}))} placeholder="RUT" style={{...s.inp,marginBottom:10}} />
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.t2,marginBottom:10,cursor:"pointer"}}>
            <input type="checkbox" checked={companyForm.hasInternalFleet} onChange={e=>setCompanyForm(p=>({...p,hasInternalFleet:e.target.checked}))} style={{width:16,height:16}} /> Flota propia
          </label>
          <LocationPicker label="Ubicación" value={companyForm.lat?{lat:companyForm.lat,lng:companyForm.lng,address:companyForm.address||""}:null} onChange={(loc)=>setCompanyForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,address:loc?.address||""}))} />
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button onClick={()=>setView("list")} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
            <button onClick={handleSaveCompany} disabled={saving} style={{...s.btnP(C.pri,saving),flex:2}}>{saving?"Guardando...":(editCompanyId?"Guardar cambios":"Crear empresa")}</button>
          </div>
        </div>
        <MsgBar/>
      </div>
    );
  }

  // ===================== USER EDIT =====================
  if (view==="userEdit" && editUserData) {
    const types = editUserData.userTypes||[];
    const at = activeUserType && types.includes(activeUserType) ? activeUserType : types[0]||null;
    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {adminBackBtn(()=>setView("list"))}
        <div style={{fontSize:16,fontWeight:700,color:C.t1,marginBottom:12}}>Editar usuario</div>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,boxShadow:C.sh}}>
          {/* Basic info */}
          <div style={s.lbl}>Nombre:</div>
          <input value={editUserData.name} onChange={e=>setEditUserData(p=>({...p,name:e.target.value}))} placeholder="Nombre" style={{...s.inp,marginBottom:10}} />
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><div style={s.lbl}>Email:</div><input value={editUserData.email} onChange={e=>setEditUserData(p=>({...p,email:e.target.value}))} placeholder="Email" style={s.inp} /></div>
            <div style={{flex:1}}><div style={s.lbl}>Teléfono:</div><input value={editUserData.phone||""} onChange={e=>setEditUserData(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={s.inp} /></div>
          </div>

          {/* User types selection */}
          <div style={s.lbl}>Tipos de usuario:</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {["producer","plant","transporter"].map(t=>{const sel=types.includes(t);return(<button key={t} onClick={()=>toggleEditUserType(t)} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1.5px solid ${sel?typeColors[t]:C.b1}`,background:sel?`${typeColors[t]}12`:C.w,color:sel?typeColors[t]:C.t2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{sel?"✓ ":""}{typeLabels[t]}</button>);})}
          </div>

          {/* Type tabs - select one type to configure */}
          {types.length>0 && (
            <div style={{background:C.bgInput,border:`1px solid ${C.b1}`,borderRadius:10,padding:12,marginBottom:10}}>
              {types.length>1 && (
                <div style={{display:"flex",gap:4,marginBottom:10}}>
                  {types.map(t=>(
                    <button key={t} onClick={()=>setActiveUserType(t)} style={{flex:1,padding:"7px 0",borderRadius:6,border:`1.5px solid ${at===t?typeColors[t]:C.b1}`,background:at===t?`${typeColors[t]}18`:C.w,color:at===t?typeColors[t]:C.t3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{typeLabels[t]}</button>
                  ))}
                </div>
              )}

              {at && (
                <div key={at}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <div style={{width:10,height:10,borderRadius:5,background:typeColors[at]}}/>
                    <span style={{fontSize:12,fontWeight:700,color:typeColors[at]}}>{typeLabels[at]}</span>
                  </div>

                  {/* Role for this type */}
                  <div style={s.lbl}>Rol como {typeLabels[at]}:</div>
                  <select value={(editUserData.roleByType||{})[at]||"operator"} onChange={e=>setEditUserData(p=>({...p,roleByType:{...(p.roleByType||{}),[at]:e.target.value}}))} style={{...s.sel,marginBottom:8}}>
                    <option value="operator">Operario</option>
                    <option value="admin">Gerente</option>
                    {isPlatform&&<option value="platform_admin">Admin Principal</option>}
                  </select>

                  {/* Company for this type */}
                  <div style={s.lbl}>Empresa ({typeLabels[at]}):</div>
                  <select value={(editUserData.companyByType||{})[at]||""} onChange={e=>setEditUserData(p=>({...p,companyByType:{...(p.companyByType||{}),[at]:e.target.value||null}}))} style={{...s.sel,marginBottom:4}}>
                    <option value="">Sin empresa</option>
                    {allCompanies.filter(c=>c.type===at).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={s.lbl}>Estado:</div>
              <select value={editUserData.active?"active":"inactive"} onChange={e=>setEditUserData(p=>({...p,active:e.target.value==="active"}))} style={s.sel}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={()=>setView("list")} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
            <button onClick={handleSaveEditUser} disabled={saving} style={{...s.btnP(C.acc,saving),flex:2}}>{saving?"Guardando...":"Guardar cambios"}</button>
          </div>
        </div>
        <MsgBar/>
      </div>
    );
  }

  // ===================== USER CREATE =====================
  if (view==="userForm") {
    const formTypes = userForm.userTypes;
    const formAt = activeUserType && formTypes.includes(activeUserType) ? activeUserType : formTypes[0]||null;
    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {adminBackBtn(()=>setView("list"))}
        <div style={{fontSize:16,fontWeight:700,color:C.t1,marginBottom:12}}>Nuevo usuario</div>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,boxShadow:C.sh}}>
          <div style={s.lbl}>Nombre:</div>
          <input value={userForm.name} onChange={e=>setUserForm(p=>({...p,name:e.target.value}))} placeholder="Nombre completo" style={{...s.inp,marginBottom:10}} />
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><div style={s.lbl}>Email:</div><input value={userForm.email} onChange={e=>setUserForm(p=>({...p,email:e.target.value}))} placeholder="Email" type="email" style={s.inp} /></div>
            <div style={{flex:1}}><div style={s.lbl}>Teléfono:</div><input value={userForm.phone} onChange={e=>setUserForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={s.inp} /></div>
          </div>
          <div style={s.lbl}>Contraseña:</div>
          <input value={userForm.password} onChange={e=>setUserForm(p=>({...p,password:e.target.value}))} placeholder="Contraseña" type="password" style={{...s.inp,marginBottom:10}} />

          <div style={s.lbl}>Tipos de usuario:</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {["producer","plant","transporter"].map(t=>{const sel=formTypes.includes(t);return(<button key={t} onClick={()=>toggleFormUserType(t)} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1.5px solid ${sel?typeColors[t]:C.b1}`,background:sel?`${typeColors[t]}12`:C.w,color:sel?typeColors[t]:C.t2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{sel?"✓ ":""}{typeLabels[t]}</button>);})}
          </div>

          {/* Config per type */}
          {formTypes.length>0 && (
            <div style={{background:C.bgInput,border:`1px solid ${C.b1}`,borderRadius:10,padding:12,marginBottom:10}}>
              {formTypes.length>1 && (
                <div style={{display:"flex",gap:4,marginBottom:10}}>
                  {formTypes.map(t=>(
                    <button key={t} onClick={()=>setActiveUserType(t)} style={{flex:1,padding:"7px 0",borderRadius:6,border:`1.5px solid ${formAt===t?typeColors[t]:C.b1}`,background:formAt===t?`${typeColors[t]}18`:C.w,color:formAt===t?typeColors[t]:C.t3,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{typeLabels[t]}</button>
                  ))}
                </div>
              )}
              {formAt && (
                <div key={formAt}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <div style={{width:10,height:10,borderRadius:5,background:typeColors[formAt]}}/>
                    <span style={{fontSize:12,fontWeight:700,color:typeColors[formAt]}}>{typeLabels[formAt]}</span>
                  </div>
                  <div style={s.lbl}>Rol como {typeLabels[formAt]}:</div>
                  <select value={(userForm.roleByType||{})[formAt]||"operator"} onChange={e=>setUserForm(p=>({...p,roleByType:{...(p.roleByType||{}),[formAt]:e.target.value}}))} style={{...s.sel,marginBottom:8}}>
                    <option value="operator">Operario</option>
                    <option value="admin">Gerente</option>
                    {isPlatform&&<option value="platform_admin">Admin Principal</option>}
                  </select>
                  <div style={s.lbl}>Empresa ({typeLabels[formAt]}):</div>
                  <select value={(userForm.companyByType||{})[formAt]||""} onChange={e=>setUserForm(p=>({...p,companyByType:{...(p.companyByType||{}),[formAt]:e.target.value||null}}))} style={s.sel}>
                    <option value="">Sin empresa</option>
                    {allCompanies.filter(c=>c.type===formAt).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <button onClick={handleCreateUser} disabled={saving} style={s.btnP(C.acc,saving)}>{saving?"Creando...":"Crear usuario"}</button>
        </div>
        <MsgBar/>
      </div>
    );
  }

  // ===================== COMPANY DETAIL =====================
  if (view==="companyDetail" && selectedCompany) {
    const cType = selectedCompany.type;
    const isProducer = cType==="producer";
    const isTransporter = cType==="transporter";
    const tabs = [{k:"branches",l:"Sucursales",n:branches.length}];
    if(isProducer) tabs.push({k:"fields",l:"Campos",n:fields.length});
    if(isTransporter) tabs.push({k:"trucks",l:"Flota",n:trucks.length});
    const curTab = tabs.find(t=>t.k===detailTab) ? detailTab : "branches";

    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {adminBackBtn(()=>{setView("list");setShowBranchForm(false);setShowFieldForm(false);setShowTruckForm(false);})}
        {/* Company header */}
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.t1}}>{selectedCompany.name}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <Bd color={typeColors[cType]}>{typeLabels[cType]}</Bd>
                {selectedCompany.rut&&<Bd color={C.t2}>RUT: {selectedCompany.rut}</Bd>}
                {selectedCompany.hasInternalFleet&&<Bd color={C.info||"#3B82F6"}>Flota propia</Bd>}
              </div>
              {selectedCompany.email&&<div style={{fontSize:12,color:C.t2,marginTop:4}}>{selectedCompany.email}</div>}
              {selectedCompany.phone&&<div style={{fontSize:12,color:C.t3}}>{selectedCompany.phone}</div>}
              {selectedCompany.lat&&<div style={{fontSize:10,color:C.t3,marginTop:2}}>📍 {Number(selectedCompany.lat).toFixed(5)}, {Number(selectedCompany.lng).toFixed(5)}</div>}
            </div>
            <button onClick={()=>openEditCompany(selectedCompany)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.pri}40`,background:`${C.pri}08`,color:C.pri,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setDetailTab(t.k)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1.5px solid ${curTab===t.k?C.pri:C.b1}`,background:curTab===t.k?`${C.pri}12`:C.w,color:curTab===t.k?C.pri:C.t2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l} ({t.n})</button>
          ))}
        </div>

        {/* ====== TAB: BRANCHES ====== */}
        {curTab==="branches"&&(<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button onClick={()=>{showBranchForm?setShowBranchForm(false):openNewBranch();}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.pri}`,background:`${C.pri}12`,color:C.pri,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showBranchForm&&!editBranchId?"Cancelar":"+ Nueva"}</button>
          </div>
          {showBranchForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <div style={{fontSize:12,fontWeight:600,color:C.t1,marginBottom:8}}>{editBranchId?"Editar sucursal":"Nueva sucursal"}</div>
              <div style={s.lbl}>Nombre:</div>
              <input value={branchForm.name} onChange={e=>setBranchForm(p=>({...p,name:e.target.value}))} placeholder="Nombre" style={{...s.inp,marginBottom:10}} />
              <div style={s.lbl}>Dirección:</div>
              <input value={branchForm.address} onChange={e=>setBranchForm(p=>({...p,address:e.target.value}))} placeholder="Dirección" style={{...s.inp,marginBottom:10}} />
              <div style={s.lbl}>Referencia:</div>
              <input value={branchForm.reference} onChange={e=>setBranchForm(p=>({...p,reference:e.target.value}))} placeholder="Referencia (opcional)" style={{...s.inp,marginBottom:10}} />
              <LocationPicker label="Ubicación sucursal" value={branchForm.lat?{lat:branchForm.lat,lng:branchForm.lng,address:branchForm.locationAddress||""}:null} onChange={(loc)=>setBranchForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,locationAddress:loc?.address||""}))} />
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowBranchForm(false)} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={handleSaveBranch} disabled={saving} style={{...s.btnP(C.pri,saving),flex:2}}>{saving?"Guardando...":(editBranchId?"Guardar":"Crear")}</button>
              </div>
            </div>
          )}
          {branches.map(b=>(<div key={b.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",marginBottom:8,boxShadow:C.sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.t1}}>{b.name}</div>{b.address&&<div style={{fontSize:11,color:C.t3}}>{b.address}</div>}{b.lat&&<div style={{fontSize:9,color:C.t3}}>📍 {Number(b.lat).toFixed(5)}, {Number(b.lng).toFixed(5)}</div>}</div>
              <div style={{display:"flex",gap:4}}><button onClick={()=>openEditBranch(b)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.pri}40`,background:"none",fontSize:10,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button><button disabled={saving} onClick={()=>handleDeleteBranch(b.id)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.err}30`,background:"none",fontSize:10,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button></div>
            </div>
          </div>))}
          {branches.length===0&&!showBranchForm&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:12}}>Sin sucursales</div>}
        </>)}

        {/* ====== TAB: FIELDS (Producer) ====== */}
        {curTab==="fields"&&isProducer&&(<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button onClick={()=>{showFieldForm?setShowFieldForm(false):openNewField();}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${typeColors.producer}`,background:`${typeColors.producer}12`,color:typeColors.producer,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showFieldForm&&!editFieldId?"Cancelar":"+ Nuevo campo"}</button>
          </div>
          {showFieldForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <div style={{fontSize:12,fontWeight:600,color:C.t1,marginBottom:8}}>{editFieldId?"Editar campo":"Nuevo campo"}</div>
              <div style={s.lbl}>Nombre *</div>
              <input value={fieldForm.name} onChange={e=>setFieldForm(p=>({...p,name:e.target.value}))} placeholder="Nombre del campo" style={{...s.inp,marginBottom:10}} />
              <LocationPicker label="Ubicación *" value={fieldForm.lat?{lat:fieldForm.lat,lng:fieldForm.lng,address:fieldForm.address}:null} onChange={(loc)=>setFieldForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,address:loc?.address||""}))} />
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><div style={s.lbl}>Hectáreas</div><input value={fieldForm.hectares} onChange={e=>setFieldForm(p=>({...p,hectares:e.target.value}))} placeholder="Ej: 150" type="number" style={s.inp} /></div>
              </div>
              <div style={s.lbl}>Comentarios</div>
              <textarea value={fieldForm.comments} onChange={e=>setFieldForm(p=>({...p,comments:e.target.value}))} placeholder="Notas opcionales..." rows={2} style={{...s.inp,resize:"vertical",marginBottom:10}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowFieldForm(false)} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={handleSaveField} disabled={saving} style={{...s.btnP(typeColors.producer,saving),flex:2}}>{saving?"Guardando...":(editFieldId?"Guardar":"Crear campo")}</button>
              </div>
            </div>
          )}
          {fields.map(f=>(<div key={f.id} style={{background:C.w,border:`1px solid ${expandedFieldId===f.id?typeColors.producer:C.b1}`,borderRadius:10,marginBottom:8,boxShadow:C.sh,overflow:"hidden"}}>
            <div style={{padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>expandField(f.id)}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{f.name}</div>
                <div style={{display:"flex",gap:8,fontSize:10,color:C.t3,marginTop:2}}>
                  {f.hectares&&<span>{Number(f.hectares)} ha</span>}
                  {f.lat&&<span>📍 {Number(f.lat).toFixed(3)}, {Number(f.lng).toFixed(3)}</span>}
                  <span>{f._count?.lots||f.lots?.length||0} lotes</span>
                </div>
                {f.comments&&<div style={{fontSize:10,color:C.t3,fontStyle:"italic",marginTop:1}}>{f.comments}</div>}
              </div>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <button onClick={(e)=>{e.stopPropagation();openEditField(f);}} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.pri}40`,background:"none",fontSize:10,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                <button disabled={saving} onClick={(e)=>{e.stopPropagation();handleDeleteField(f.id);}} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.err}30`,background:"none",fontSize:10,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button>
                <span style={{fontSize:12,color:C.t3,marginLeft:4}}>{expandedFieldId===f.id?"▾":"▸"}</span>
              </div>
            </div>
            {/* Lots inside field */}
            {expandedFieldId===f.id&&(
              <div style={{padding:"0 14px 12px",borderTop:`1px solid ${C.b1}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.t2}}>Lotes</div>
                  <button onClick={()=>{showLotForm?setShowLotForm(false):openNewLot();}} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${typeColors.producer}`,background:`${typeColors.producer}10`,color:typeColors.producer,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showLotForm&&!editLotId?"Cancelar":"+ Lote"}</button>
                </div>
                {showLotForm&&(
                  <div style={{background:C.bgInput,border:`1px solid ${C.b1}`,borderRadius:8,padding:12,marginBottom:8}}>
                    <div style={s.lbl}>Nombre *</div>
                    <input value={lotForm.name} onChange={e=>setLotForm(p=>({...p,name:e.target.value}))} placeholder="Nombre del lote" style={{...s.inp,marginBottom:8}} />
                    <LocationPicker label="Ubicación *" value={lotForm.lat?{lat:lotForm.lat,lng:lotForm.lng,address:lotForm.address}:null} onChange={(loc)=>setLotForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,address:loc?.address||""}))} />
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}><div style={s.lbl}>Hectáreas</div><input value={lotForm.hectares} onChange={e=>setLotForm(p=>({...p,hectares:e.target.value}))} placeholder="Ej: 50" type="number" style={s.inp} /></div>
                    </div>
                    <div style={s.lbl}>Comentarios</div>
                    <textarea value={lotForm.comments} onChange={e=>setLotForm(p=>({...p,comments:e.target.value}))} placeholder="Notas..." rows={2} style={{...s.inp,resize:"vertical",marginBottom:8}} />
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setShowLotForm(false)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                      <button onClick={handleSaveLot} disabled={saving} style={{...s.btnP(typeColors.producer,saving),flex:2,padding:"8px 0"}}>{saving?"Guardando...":(editLotId?"Guardar":"Crear lote")}</button>
                    </div>
                  </div>
                )}
                {lots.map(l=>(<div key={l.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:8,padding:"8px 12px",marginBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:12,fontWeight:600,color:C.t1}}>{l.name}</div>
                      <div style={{display:"flex",gap:6,fontSize:9,color:C.t3}}>{l.hectares&&<span>{Number(l.hectares)} ha</span>}{l.lat&&<span>📍 {Number(l.lat).toFixed(3)},{Number(l.lng).toFixed(3)}</span>}</div>
                      {l.comments&&<div style={{fontSize:9,color:C.t3,fontStyle:"italic"}}>{l.comments}</div>}
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>openEditLot(l)} style={{padding:"3px 6px",borderRadius:4,border:`1px solid ${C.pri}40`,background:"none",fontSize:9,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                      <button disabled={saving} onClick={()=>handleDeleteLot(l.id)} style={{padding:"3px 6px",borderRadius:4,border:`1px solid ${C.err}30`,background:"none",fontSize:9,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button>
                    </div>
                  </div>
                </div>))}
                {lots.length===0&&!showLotForm&&<div style={{textAlign:"center",padding:10,color:C.t3,fontSize:11}}>Sin lotes</div>}
              </div>
            )}
          </div>))}
          {fields.length===0&&!showFieldForm&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:12}}>Sin campos</div>}
        </>)}

        {/* ====== TAB: TRUCKS (Transporter) ====== */}
        {curTab==="trucks"&&isTransporter&&(<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button onClick={()=>{showTruckForm?setShowTruckForm(false):openNewTruck();}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${typeColors.transporter}`,background:`${typeColors.transporter}12`,color:typeColors.transporter,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showTruckForm&&!editTruckId?"Cancelar":"+ Nuevo vehículo"}</button>
          </div>
          {showTruckForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <div style={{fontSize:12,fontWeight:600,color:C.t1,marginBottom:8}}>{editTruckId?"Editar vehículo":"Nuevo vehículo"}</div>
              <div style={s.lbl}>Patente *</div>
              <input value={truckForm.plate} onChange={e=>setTruckForm(p=>({...p,plate:e.target.value}))} placeholder="ABC-1234" style={{...s.inp,marginBottom:10,textTransform:"uppercase"}} />
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><div style={s.lbl}>Marca</div><input value={truckForm.brand} onChange={e=>setTruckForm(p=>({...p,brand:e.target.value}))} placeholder="Ej: Scania" style={s.inp} /></div>
                <div style={{flex:1}}><div style={s.lbl}>Modelo</div><input value={truckForm.model} onChange={e=>setTruckForm(p=>({...p,model:e.target.value}))} placeholder="Ej: R500" style={s.inp} /></div>
              </div>
              <div style={s.lbl}>Capacidad</div>
              <input value={truckForm.capacity} onChange={e=>setTruckForm(p=>({...p,capacity:e.target.value}))} placeholder="Ej: 30 ton" style={{...s.inp,marginBottom:10}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowTruckForm(false)} style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={handleSaveTruck} disabled={saving} style={{...s.btnP(typeColors.transporter,saving),flex:2}}>{saving?"Guardando...":(editTruckId?"Guardar":"Crear vehículo")}</button>
              </div>
            </div>
          )}
          {trucks.map(t=>(<div key={t.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",marginBottom:8,boxShadow:C.sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.t1,letterSpacing:1}}>{t.plate}</div>
                <div style={{display:"flex",gap:8,fontSize:11,color:C.t3,marginTop:2}}>
                  {t.brand&&<span>{t.brand}</span>}{t.model&&<span>{t.model}</span>}{t.capacity&&<span>· {t.capacity}</span>}
                </div>
                {t.assignedUser&&<div style={{fontSize:10,color:C.t2,marginTop:1}}>Chofer: {t.assignedUser.name}</div>}
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>openEditTruck(t)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.pri}40`,background:"none",fontSize:10,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                <button disabled={saving} onClick={()=>handleDeleteTruck(t.id)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${C.err}30`,background:"none",fontSize:10,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button>
              </div>
            </div>
          </div>))}
          {trucks.length===0&&!showTruckForm&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:12}}>Sin vehículos</div>}
        </>)}

        <MsgBar/>
      </div>
    );
  }

  // ===================== MAIN LIST =====================
  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      {adminBackBtn(onBack)}
      <div style={{fontSize:18,fontWeight:800,color:C.t1,marginBottom:4}}>Administración</div>
      <div style={{fontSize:11,color:C.t3,marginBottom:14}}>{isPlatform?"Admin Principal — Control total":isManager?"Gerente — Tu empresa":""}</div>

      {stats&&isPlatform&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          {[{k:"companies",l:"Empresas",v:stats.companies,c:C.pri},{k:"branches",l:"Sucursales",v:stats.branches,c:C.info||"#3B82F6"},{k:"users",l:"Usuarios",v:stats.users,c:C.acc}].map(st=>(
            <button key={st.k} onClick={()=>handleStatsClick(st.k)} style={{background:C.w,border:`2px solid ${statsFilter===st.k?st.c:C.b1}`,borderRadius:8,padding:"10px 8px",textAlign:"center",boxShadow:statsFilter===st.k?`0 0 0 1px ${st.c}20`:C.sh,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
              <div style={{fontSize:20,fontWeight:800,color:st.c}}>{st.v}</div>
              <div style={{fontSize:9,color:C.t3}}>{st.l}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {["companies","users"].map(t=>(
          <button key={t} onClick={()=>{setTab(t);setSearch("");setStatsFilter(null);}} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${tab===t?C.pri:C.b1}`,background:tab===t?`${C.pri}12`:C.w,color:tab===t?C.pri:C.t2,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            {t==="companies"?"Empresas":"Usuarios"}
          </button>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="companies"?"Buscar empresa o RUT...":"Buscar usuario..."} style={{...s.inp,marginBottom:10,paddingLeft:12}} />
      <MsgBar/>

      {loading?<Loader/>:(<>
        {tab==="companies"&&(<>
          {isPlatform&&<button onClick={openNewCompany} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px dashed ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>+ Nueva Empresa</button>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {companies.map(c=>(
              <div key={c.id} className="tv-card" style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",boxShadow:C.sh}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>openCompanyDetail(c)}>
                    <div style={{fontSize:14,fontWeight:700,color:C.t1}}>{c.name}</div>
                    <div style={{fontSize:11,color:C.t3,marginTop:2}}>{c.email||""} {c.rut?`· RUT: ${c.rut}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    <Bd color={typeColors[c.type]}>{typeLabels[c.type]}</Bd>
                    <div style={{fontSize:10,color:C.t3,background:C.bgInput,padding:"2px 6px",borderRadius:4}}>{c._count?.users||0} usr · {c._count?.branches||0} suc</div>
                    <button onClick={()=>openEditCompany(c)} title="Editar" style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}>{Ic.doc(C.pri,14)}</button>
                    <button onClick={()=>openCompanyDetail(c)} title="Ver" style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}>{Ic.chev(C.t3,14)}</button>
                  </div>
                </div>
              </div>
            ))}
            {companies.length===0&&<div style={{textAlign:"center",padding:32,color:C.t3,fontSize:13}}>No se encontraron empresas</div>}
          </div>
        </>)}

        {tab==="users"&&(<>
          <button onClick={openNewUser} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px dashed ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>+ Nuevo Usuario</button>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {users.map(u=>{
              const cbt = u.companyByType && typeof u.companyByType === "object" ? u.companyByType : {};
              const rbt = u.roleByType && typeof u.roleByType === "object" ? u.roleByType : {};
              const assignedCompanies = Object.entries(cbt).filter(([_,v])=>v);
              return (
              <div key={u.id} className="tv-card" style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",boxShadow:C.sh,cursor:"pointer"}} onClick={()=>openEditUser(u)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.t1}}>{u.name}</div>
                    <div style={{fontSize:11.5,color:C.t2,marginTop:1}}>{u.email}</div>
                    {u.phone&&<div style={{fontSize:11,color:C.t3}}>{u.phone}</div>}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <Bd color={u.active?C.ok:C.err}>{u.active?"Activo":"Inactivo"}</Bd>
                  </div>
                </div>
                {/* Types with inline role */}
                <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                  {(u.userTypes||[]).map(t=>{
                    const role = rbt[t] || u.role || "operator";
                    return <Bd key={t} color={typeColors[t]}>{typeLabels[t]} · {roleLabels[role]||role}</Bd>;
                  })}
                  {(u.userTypes||[]).length===0&&<span style={{fontSize:10,color:C.t3}}>Sin tipo</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6,paddingTop:6,borderTop:`1px solid ${C.b2}`,flexWrap:"wrap"}}>
                  {assignedCompanies.length>0 ? assignedCompanies.map(([type,cId])=>{const comp=allCompanies.find(c=>c.id===cId); return comp?<Bd key={type} color={typeColors[type]}>{comp.name}</Bd>:null;}) : u.company ? <Bd color={typeColors[u.company.type]}>{u.company.name}</Bd> : <span style={{fontSize:11,color:C.t3}}>Sin empresa</span>}
                  <span style={{marginLeft:"auto",display:"flex"}}>{Ic.chev(C.t3,14)}</span>
                </div>
              </div>
            );})}
            {users.length===0&&<div style={{textAlign:"center",padding:32,color:C.t3,fontSize:13}}>No se encontraron usuarios</div>}
          </div>
        </>)}
      </>)}
    </div>
  );
}

// ======================== MAIN APP ====================================
export default function Tolvink() {

  const auth = useAuth();
  const fh = useFreights(auth.user, auth.isInitialized);
  const catalog = useCatalog(auth.user);
  const online = useOnline();
  const notif = useNotifications(auth.user);
  const [screen, setScreen] = useState("home");
  const [selFreight, setSelFreight] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [chatConvId, setChatConvId] = useState(null);
  const [duplicateData, setDuplicateData] = useState(null);
  const [editData, setEditData] = useState(null);
  const [unreadChats, setUnreadChats] = useState(0);
  const isDesktop = useIsDesktop(768);

  // 4. Redirect to home when user logs in
  const prevUser = useRef(null);
  useEffect(()=>{
    if(auth.user && !prevUser.current) { setScreen("home"); }
    prevUser.current = auth.user;
  },[auth.user]);

  // Calculate pending actions count
  const pendingCount = useMemo(() => {
    if (!auth.user || !fh.freights) return 0;
    return fh.freights.filter(f => getPendingActions(f, auth.user.userType) !== null).length;
  }, [fh.freights, auth.user]);

  // Poll for unread chats (uses server-side lastReadAt tracking)
  useEffect(()=>{
    if(!auth.user) return;
    const checkUnread = async ()=>{
      try {
        const convs = await apiListConversations();
        const count = (convs||[]).filter(c => c.unread).length;
        setUnreadChats(count);
      } catch {}
    };
    checkUnread();
    const iv = setInterval(checkUnread, 30000);
    return ()=>clearInterval(iv);
  },[auth.user]);

  const perms = useMemo(()=>permsFor(auth.user),[auth.user]);
  const _resolveType = useCallback((f) => resolveUserTypeForFreight(f, auth.user), [auth.user]);
  const show = (msg,type="ok")=>setToast({msg,type});
  const nav = (s,fId)=>{ track("screen_view",{screen:s}); if(s==="new_date"&&fId){if(!perms.canRequest){show("Sin permisos para solicitar","err");return;} setDuplicateData({preDate:fId});setScreen("new");return;} if(fId){ setSelFreight(fId); if(s==="detail") fh.refresh(fId); } if(s==="new"&&!perms.canRequest){show("Sin permisos para solicitar","err");return;} setScreen(s); };

  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = (fId,action)=>{
    if(actionLoading) return;
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    if(action==="assign") { setModal({type:"assign",freight:f}); }
    else if(action==="cancel") { setModal({type:"reason",freight:f,title:"Cancelar flete",btnLabel:"Cancelar flete",action:"cancel"}); }
    else if(action==="reject") { setModal({type:"reason",freight:f,title:"Rechazar asignación",btnLabel:"Rechazar",action:"reject"}); }
    else if(action==="accept") { setModal({type:"truck_select",freight:f}); }
    else if(action==="start") { setActionLoading(true); (async()=>{ const r=await fh.start(fId); setActionLoading(false); if(r.ok) show("Viaje iniciado"); else show(r.error,"err"); })(); }
    else if(action==="authorize") { setActionLoading(true); (async()=>{ const r=await fh.authorize(fId); setActionLoading(false); if(r.ok) show("Viaje autorizado"); else show(r.error,"err"); })(); }
    else if(action==="confirm_loaded") { setActionLoading(true); (async()=>{ const r=await fh.confirmLoaded(fId); setActionLoading(false); if(r.ok) show("Carga confirmada"); else show(r.error,"err"); })(); }
    else if(action==="confirm_finished") { setActionLoading(true); (async()=>{ const r=await fh.confirmFinished(fId); setActionLoading(false); if(r.ok) show("Entrega confirmada"); else show(r.error,"err"); })(); }
  };

  const handleAcceptWithTruck = async (fId, truckId)=>{
    const r = await fh.respond(fId, "accepted", undefined, truckId);
    if(r.ok){ track("freight_accept"); setModal(null); show("Flete aceptado"); } else { setModal(null); show(r.error,"err"); }
  };

  const handleAssign = async (fId, transportCompanyId)=>{
    const r = await fh.assign(fId, transportCompanyId);
    if(r.ok){ track("freight_assign"); setModal(null); show("Transportista asignado"); } else { setModal(null); show(r.error,"err"); }
  };

  const handleReasonAction = async (fId,reason,action)=>{
    let r;
    if(action==="cancel") r = await fh.cancel(fId,reason);
    else if(action==="reject") r = await fh.respond(fId,"rejected",reason);
    if(r?.ok){ setModal(null); show(action==="cancel"?"Flete cancelado":"Asignación rechazada","info"); } else { setModal(null); show(r?.error||"Error","err"); }
  };

  const handleCreate = async (form)=>{
    setSubmitting(true);
    const r = await fh.create(form);
    if(r.ok && r.freightId && form.photos?.length > 0) {
      // Upload photos to storage and register as documents
      for(const photoUrl of form.photos) {
        try {
          const blob = await fetch(photoUrl).then(r=>r.blob());
          const file = new File([blob], `foto-${Date.now()}.jpg`, {type:'image/jpeg'});
          const url = await uploadPhoto(file, r.freightId, 'request');
          await apiAddDocument(r.freightId, { name: file.name, url, type:'photo', step:'request' });
        } catch(e) { console.error('Photo upload failed:', e); }
      }
    }
    setSubmitting(false);
    if(r.ok){ track("freight_create"); setScreen("list"); show("Flete solicitado"); } else show(r.error,"err");
  };

  // Show loading splash only during initial auth check
  if (!auth.isInitialized) {
    return <div style={{minHeight:"100dvh",background:C.bg,fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,800&display=swap');@keyframes splashIn{0%{opacity:0;transform:scale(0.7)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}*{margin:0;padding:0;box-sizing:border-box}html,body,#root{background:${C.bg};margin:0;height:auto!important;overflow:visible!important}`}</style>
      <div style={{textAlign:"center",animation:"splashIn 0.8s ease-out forwards"}}>
        <span style={{fontSize:83,fontWeight:800,color:C.pri,letterSpacing:-3.5,display:"inline-block"}}>tolvink</span>
        <span style={{width:16,height:16,borderRadius:8,background:C.acc,display:"inline-block",marginLeft:5,marginTop:-34,verticalAlign:"top",animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
      </div>
    </div>;
  }

  // If no user after initialization, show landing
  if(!auth.user) {
    console.log('[APP] No user, showing landing screen');
    return <LandingScreen onLogin={auth.login} onSignup={auth.signup} loading={auth.loading} error={auth.error} clearError={auth.clearError}/>;
  }

  console.log('[APP] User authenticated, rendering main app');
  const curFreight = fh.freights.find(f=>f.id===selFreight);
  const navActive = ["detail"].includes(screen)?"list":["trucks","fields","access","admin","mydata"].includes(screen)?"menu":screen;

  return (
    <div className="tv-shell" style={{height:"100dvh",background:C.bg,color:C.t1,fontFamily:FONT,display:"flex",flexDirection:isDesktop?"row":"column",width:"100%",position:"relative",overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body{height:100%;margin:0;overflow-x:hidden;max-width:100vw}body{background:${C.bg};overflow-y:hidden;overscroll-behavior:none}input,textarea,select,button{font-size:16px}input::placeholder,textarea::placeholder{color:${C.t3}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.b1};border-radius:4px}@keyframes ti{0%,100%{opacity:1}50%{opacity:.4}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes pageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.tv-page{animation:pageIn 0.25s ease-out}.tv-card{transition:transform 0.15s ease,box-shadow 0.15s ease}.tv-row{transition:background 0.1s ease}@media(hover:hover){.tv-card:hover{transform:translateY(-2px);box-shadow:${C.shMd}!important}.tv-row:hover{background:${C.priGhost}!important}}@media(min-width:640px){.tv-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}.tv-grid3{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:12px!important}.tv-pad{padding:24px 32px!important}.tv-detail-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:16px!important}.tv-table th,.tv-table td{padding:10px 12px!important;font-size:12px!important}.tv-stats{gap:12px!important}.tv-stats>div{padding:14px 12px!important;border-radius:12px!important}.tv-stats .tv-stat-num{font-size:28px!important}.tv-header-bar{padding:10px 32px 0 32px!important}}@media(min-width:768px){.tv-mobile-header{display:none!important}.tv-mobile-nav{display:none!important}.tv-kanban{flex-direction:row!important;gap:12px!important}.tv-kanban-col{max-height:calc(100vh - 280px)!important;overflow-y:auto!important}}@media(max-width:767px){.tv-sidebar{display:none!important}.tv-shell{max-width:100vw!important;width:100%!important}}@media(min-width:900px){.tv-grid{grid-template-columns:1fr 1fr 1fr!important}}@media(min-width:1100px){.tv-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>

      <RoutesBackground trucks={false} opacityMul={0.4} centerFade={false} />

      {/* Desktop Sidebar */}
      <div className="tv-sidebar" style={{position:"relative",zIndex:1}}>
        <Sidebar active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={notif.unreadCount} canRequest={perms.canRequest} onNew={()=>nav("new")} />
      </div>

      {/* Main content column */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, position:"relative", zIndex:1 }}>
        {/* Mobile-only header */}
        <div className="tv-mobile-header" style={{paddingTop:"max(12px, env(safe-area-inset-top))",paddingBottom:12,paddingLeft:18,paddingRight:18,display:"flex",alignItems:"center",borderBottom:`1px solid ${C.b2}`,background:C.w,flexShrink:0,zIndex:10}}>
          <div style={{display:"inline-flex",alignItems:"flex-start"}}>
            <span style={{fontSize:30,fontWeight:800,color:C.pri,letterSpacing:-0.9,lineHeight:1}}>tolvink</span>
            <span style={{width:8,height:8,borderRadius:4,background:C.acc,display:"inline-block",marginLeft:3,marginTop:1,animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
          </div>
        </div>

        {/* Offline banner */}
        {!online && <div style={{background:"#f59e0b",color:"#fff",textAlign:"center",padding:"6px 12px",fontSize:13,fontWeight:600,flexShrink:0,zIndex:10}}>{Ic.warn("#fff",14)} Sin conexión — mostrando datos guardados</div>}

        {/* Scrollable content area */}
        <div style={{flex:1,overflow:(screen==="chats"||screen==="calendar")&&isDesktop?"hidden":"auto",display:"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
        <div key={screen} className="tv-page" style={{flex:1,display:"flex",flexDirection:"column"}}>
        {screen==="home" && <HomeScreen user={auth.user} freights={fh.freights} perms={perms} onNav={nav} catalog={catalog} isDesktop={isDesktop} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);setScreen("chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);setScreen("new");}} onEdit={(f)=>{setEditData(f);setScreen("edit");}}/>}
        {screen==="list" && <ListScreen freights={fh.freights} onNav={nav} onRefresh={fh.fetchAll} catalog={catalog}/>}
        {screen==="pending" && <PendingScreen user={auth.user} freights={fh.freights} onNav={nav} onNewFreight={()=>nav("new")}/>}
        {screen==="calendar" && <CalendarScreen freights={fh.freights} perms={perms} onNav={nav} isDesktop={isDesktop}/>}
        {screen==="detail" && <DetailScreen user={curFreight ? {...auth.user, userType: _resolveType(curFreight)} : auth.user} freight={curFreight} perms={perms} onBack={()=>setScreen("list")} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);setScreen("chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);setScreen("new");}} onEdit={(f)=>{setEditData(f);setScreen("edit");}}/>}
        {screen==="new" && <NewScreen user={auth.user} lots={catalog.lots} plants={catalog.plants} branches={catalog.branches} fields={catalog.fields} trucks={catalog.trucks} onBack={()=>{setDuplicateData(null);setScreen("home");}} onCreate={handleCreate} submitting={submitting} duplicateFrom={duplicateData}/>}
        {screen==="edit" && editData && <EditScreen freight={editData} fields={catalog.fields} plants={catalog.plants} onBack={()=>{setEditData(null);setScreen("detail");}} onSave={async(id,data)=>{const r=await fh.update(id,data);if(r.ok){setEditData(null);setScreen("detail");show("Flete actualizado");}else show(r.error,"err");}}/>}
        {screen==="menu" && <MenuScreen user={auth.user} perms={perms} onLogout={auth.logout} onNav={nav} isDesktop={isDesktop}/>}
        {screen==="trucks" && <TrucksScreen onBack={()=>{catalog.refresh();setScreen("menu");}}/>}
        {screen==="fields" && <FieldsScreen onBack={()=>{catalog.refresh();setScreen("menu");}}/>}
        {screen==="access" && <AccessScreen onBack={()=>setScreen("menu")}/>}
        {screen==="admin" && <AdminScreen user={auth.user} onBack={()=>setScreen("menu")}/>}
        {screen==="mydata" && <MyDataScreen user={auth.user} onBack={()=>setScreen("menu")}/>}
        {screen==="reports" && <ReportsScreen onBack={()=>setScreen(isDesktop?"reports":"menu")} freights={fh.freights} isDesktop={isDesktop}/>}
        {screen==="chats" && <ChatsScreen user={auth.user} openConvId={chatConvId} onConvOpened={()=>setChatConvId(null)} isDesktop={isDesktop}/>}
        </div>
        </div>

        {/* Mobile-only bottom nav */}
        <div className="tv-mobile-nav">
          <Nav active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} notifCount={notif.unreadCount} canRequest={perms.canRequest} onNew={()=>nav("new")}/>
        </div>
      </div>

      {modal?.type==="assign" && <AssignModal freight={modal.freight} transporters={catalog.transporters} onClose={()=>setModal(null)} onConfirm={t=>handleAssign(modal.freight.id,t)}/>}
      {modal?.type==="truck_select" && <TruckSelectModal freight={modal.freight} trucks={catalog.trucks} onClose={()=>setModal(null)} onConfirm={t=>handleAcceptWithTruck(modal.freight.id,t)}/>}
      {modal?.type==="reason" && <ReasonModal title={modal.title} freight={modal.freight} btnLabel={modal.btnLabel} onClose={()=>setModal(null)} onConfirm={r=>handleReasonAction(modal.freight.id,r,modal.action)}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
