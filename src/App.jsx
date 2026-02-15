import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  apiLogin, apiRegister, apiLogout, apiListFreights, apiGetFreight,
  apiCreateFreight, apiAssignFreight, apiRespondFreight,
  apiStartFreight, apiFinishFreight, apiCancelFreight,
  apiGetPlants, apiGetLots, apiGetTransportCompanies,
  getToken, getSavedUser, setAuthFailHandler, clearAuth,
} from "./api";

// =====================================================================
// TOLVINK v4.1 — PWA Production Build
// Freight/Trip · Validations · Advanced Filters · Offline-ready
// Stack: React Hooks → PWA → React Native (Expo) → NestJS + PG
// =====================================================================

// ======================== VALIDATION ENGINE ===========================
// Centralized — mirrors future NestJS DTO validation
const V = {
  req: (v, f) => (!v || (typeof v==='string' && !v.trim())) ? `${f} es obligatorio` : null,
  email: (v) => { if(!v) return 'Email es obligatorio'; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?null:'Email inválido'; },
  min: (n) => (v,f) => { if(!v) return `${f} es obligatorio`; return v.length>=n?null:`${f}: mínimo ${n} caracteres`; },
  posNum: (v, f) => { if(!v&&v!==0) return `${f} es obligatorio`; return Number(v)>0?null:`${f} debe ser mayor a 0`; },
  sel: (v, f) => !v ? `Seleccioná ${f}` : null,
  time: (v, f) => { if(!v) return `${f} es obligatorio`; return /^\d{2}:\d{2}$/.test(v)?null:`${f} inválido`; },
};
function validate(vals, schema) {
  const errs = {}; let ok = true;
  for (const [k, rules] of Object.entries(schema)) {
    for (const rule of rules) { const e = rule(vals[k],k); if(e){errs[k]=e;ok=false;break;} }
    if(!errs[k]) errs[k]=null;
  }
  return {ok,errs};
}
const SCHEMAS = {
  login:   { email:[V.email], pw:[V.min(4)] },
  signup:  { name:[V.req,V.min(3)], email:[V.email], pw:[V.min(4)], userType:[v=>V.sel(v,'tipo de usuario')], role:[v=>V.sel(v,'rol')], entity:[V.req] },
  freight: { grain:[v=>V.sel(v,'tipo de grano')], tons:[V.posNum], lotId:[v=>V.sel(v,'lote')], plantId:[v=>V.sel(v,'planta')], loadDate:[V.req], loadTime:[V.time] },
};

// ======================== FILTER ENGINE ===============================
// Reusable — maps to backend query params: GET /api/freights?q=juan&plant=SOFOVAL
function textMatch(haystack, needle) {
  if(!needle||!needle.trim()) return true;
  if(!haystack) return false;
  return String(haystack).toLowerCase().includes(needle.toLowerCase().trim());
}

// Inline error display component
function FieldError({ error }) {
  if(!error) return null;
  return <div style={{fontSize:11,color:C.err,fontWeight:500,marginTop:4,display:"flex",alignItems:"center",gap:4}}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    {error}
  </div>;
}

// ======================== DESIGN TOKENS ==============================
const C = {
  bg:"#F7F8F7",
  bgCard:"#FFFFFF",
  bgCardAlt:"#F1F4F2",
  bgInput:"#EDEFED",
  bgOverlay:"rgba(10,20,14,0.6)",
  nav:"#FFFFFF",

  // Primary — verde oscuro
  pri:"#1A6B37",
  priLt:"#228B46",
  priPale:"#E4F3EA",
  priGhost:"rgba(26,107,55,0.06)",

  // Accent — naranja
  acc:"#E07A12",
  accLt:"#F08C24",
  accPale:"#FFF1DE",

  // Semantic
  ok:"#1A6B37",
  okPale:"#E4F3EA",
  info:"#2563EB",
  infoPale:"#EFF4FF",
  warn:"#CA8A04",
  warnPale:"#FEF9C3",
  err:"#DC2626",
  errPale:"#FEE2E2",
  muted:"#71717A",
  mutedPale:"#F4F4F5",

  // Text
  t1:"#18251C",
  t2:"#4A6352",
  t3:"#8A9C90",
  tOn:"#FFFFFF",

  // Borders
  b1:"#DEE4E0",
  b2:"#ECF0ED",
  bFocus:"#1A6B37",

  w:"#FFFFFF",
  sh:"0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03)",
  shMd:"0 4px 14px rgba(0,0,0,0.06)",
  shLg:"0 12px 32px rgba(0,0,0,0.10)",
};

const FONT = `'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
const MONO = `'JetBrains Mono','IBM Plex Mono','SF Mono',monospace`;

// ======================== SVG ICONS ==================================
const Ic = {
  home:(c=C.t3,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  truck:(c=C.t3,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  plus:(c=C.w,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  msg:(c=C.t3,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  user:(c=C.t3,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  chev:(c=C.pri,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chk:(c=C.pri,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  pin:(c=C.pri,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  plant:(c=C.t2,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"/><path d="M5 20V8l5 4V8l5 4V4h3v16"/></svg>,
  cal:(c=C.t2,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clk:(c=C.t2,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  warn:(c=C.acc,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  send:(c=C.w,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  out:(c=C.err,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  shield:(c=C.pri,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bell:(c=C.t3,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  gear:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V12a2 2 0 0 1 0 4z"/></svg>,
  wa:(c="#25D366",s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  nav:(c=C.info,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  srch:(c=C.t3,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  cross:(c=C.t3,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  mail:(c=C.t3,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>,
  lock:(c=C.t3,s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  eye:(c=C.t3,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:(c=C.t3,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  grain:(c=C.pri,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M8 8c2.2 0 4 1.8 4 4s-1.8 4-4 4"/><path d="M16 8c-2.2 0-4 1.8-4 4s1.8 4 4 4"/></svg>,
  ban:(c=C.err,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  redo:(c=C.info,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  down:(c=C.t3,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  filter:(c=C.t2,s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
};

// ======================== STATE MACHINE ==============================
// Freight has 2 states. Trip has its own lifecycle.
// This separation allows: 1 Freight → many Trips (reasignaciones)

// Backend states: draft, pending_assignment, assigned, accepted, in_progress, finished, canceled
const STATUS = {
  draft:              { label:"Borrador",     color:C.muted, bg:C.mutedPale },
  pending_assignment: { label:"Disponible",   color:C.ok,    bg:C.okPale    },
  assigned:           { label:"Asignado",     color:C.info,  bg:C.infoPale  },
  accepted:           { label:"Aceptado",     color:"#7C3AED", bg:"#F3EEFF" },
  in_progress:        { label:"En curso",     color:C.acc,   bg:C.accPale   },
  finished:           { label:"Finalizado",   color:C.ok,    bg:C.okPale    },
  canceled:           { label:"Cancelado",    color:C.err,   bg:C.errPale   },
};
function stCfg(s) { return STATUS[s] || STATUS.pending_assignment; }

function getActions(status, userType, role) {
  const map = {
    pending_assignment: { producer:["cancel"], plant:["assign","cancel"], transporter:[] },
    assigned:           { producer:["cancel"], plant:["cancel"],          transporter:["accept","reject"] },
    accepted:           { producer:["cancel"], plant:["cancel"],          transporter:["start","cancel"] },
    in_progress:        { producer:[],         plant:["finish"],          transporter:["finish"] },
    finished:           { producer:[], plant:[], transporter:[] },
    canceled:           { producer:[], plant:[], transporter:[] },
    draft:              { producer:[], plant:[], transporter:[] },
  };
  return map[status]?.[userType] || [];
}

const GRANOS = ["Soja","Maíz","Trigo","Girasol","Sorgo","Cebada"];

// ======================== CATALOG HOOK (Real API) ====================
function useCatalog(user) {
  const [plants, setPlants] = useState([]);
  const [lots, setLots] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if(!user) return;
    setLoading(true);
    Promise.all([
      apiGetPlants().catch(()=>[]),
      apiGetLots().catch(()=>[]),
      apiGetTransportCompanies().catch(()=>[]),
    ]).then(([p,l,t])=>{
      setPlants(p||[]);
      setLots(l||[]);
      setTransporters(t||[]);
    }).finally(()=>setLoading(false));
  },[user]);

  return { plants, lots, transporters, loading };
}




// ======================== AUTH HOOK (Real API) ========================
function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    const token = getToken(); const saved = getSavedUser();
    if(token && saved) setUser(mapUser(saved));
    setLoading(false);
    setAuthFailHandler(()=>{ setUser(null); setError("Tu sesión expiró."); });
  },[]);

  const login = useCallback(async (email,pw) => {
    setLoading(true); setError(null);
    try { const d = await apiLogin(email,pw); setUser(mapUser(d.user)); }
    catch(e) { setError(e.message||"Error al iniciar sesión"); }
    finally { setLoading(false); }
  },[]);

  const signup = useCallback(async (form) => {
    setLoading(true); setError(null);
    try {
      const typeMap = {planta:"plant",transporter:"transporter",producer:"producer"};
      const d = await apiRegister({ name:form.name, email:form.email, password:form.pw, companyType:typeMap[form.userType]||form.userType, companyName:form.entity, role:form.role });
      setUser(mapUser(d.user));
    } catch(e) { setError(e.message||"Error al crear cuenta"); }
    finally { setLoading(false); }
  },[]);

  const logout = useCallback(()=>{ apiLogout(); setUser(null); },[]);
  return { user, loading, error, login, signup, logout, clearError:()=>setError(null) };
}

function mapUser(u) {
  if(!u) return null;
  const co = u.company;
  return { id:u.id, email:u.email, name:u.name, role:u.role, userType:co?.type||"producer", entity:co?.name||"", entityId:co?.id||"",
    av: u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() };
}

// ======================== FREIGHTS HOOK (Real API) ====================
function useFreights(user) {
  const [freights, setFreights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchAll = useCallback(async ()=>{
    if(!user) return; setLoading(true);
    try { const r = await apiListFreights({limit:100}); setFreights((r.data||[]).map(mapFreight)); }
    catch(e) { setError(e.message); } finally { setLoading(false); }
  },[user]);
  useEffect(()=>{ fetchAll(); },[fetchAll]);
  const refresh = useCallback(async (id)=>{
    try { const u=await apiGetFreight(id); const m=mapFreight(u); setFreights(p=>p.map(f=>f.id===id?m:f)); return m; }
    catch(e) { setError(e.message); return null; }
  },[]);
  const create = useCallback(async (form)=>{
    try { const c=await apiCreateFreight({ originLotId:form.lotId, destPlantId:form.plantId, loadDate:form.loadDate, loadTime:form.loadTime, items:[{grain:form.grain,tons:parseFloat(form.tons)}], notes:form.notes||"" });
      const m=mapFreight(c); setFreights(p=>[m,...p]); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; }
  },[]);
  const assign = useCallback(async (fId,compId)=>{ try { await apiAssignFreight(fId,{transportCompanyId:compId}); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respond = useCallback(async (fId,action,reason)=>{ try { await apiRespondFreight(fId,{action,reason}); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const start = useCallback(async (fId)=>{ try { await apiStartFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const finish = useCallback(async (fId)=>{ try { await apiFinishFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancel = useCallback(async (fId,reason)=>{ try { await apiCancelFreight(fId,reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  return { freights, loading, error, fetchAll, create, assign, respond, start, finish, cancel };
}

function mapFreight(f) {
  if(!f) return null;
  const a = f.assignments?.find(x=>x.status==="active"||x.status==="accepted");
  return {
    id:f.id, code:f.code, status:f.status,
    grain:f.items?.[0]?.grain||"", tons:f.items?.[0]?.tons||0,
    originLotId:f.originLotId, originName:f.originName||"",
    destPlantId:f.destPlantId, destName:f.destName||"",
    loadDate:f.loadDate?.split("T")[0]||"", loadTime:f.loadTime||"",
    requestedBy:f.requestedById, requestedByName:f.requestedBy?.name||"",
    transporterId:a?.transportCompanyId||null, transporterName:a?.transportCompany?.name||"",
    driverName:a?.driver?.name||null,
    assignments:(f.assignments||[]).map(x=>({ id:x.id, status:x.status, transporterName:x.transportCompany?.name||"", reason:x.reason||null, createdAt:x.createdAt })),
    notes:f.notes||"", cancelReason:f.cancelReason||"", createdAt:f.createdAt,
  };
}

// ======================== PERMISSIONS ================================

function permsFor(user) {
  if (!user) return {};
  const { role, userType } = user;
  return {
    canRequest:      ["plant","producer"].includes(userType),
    canApprove:      userType === "plant" && role === "admin",
    canAssignDriver: userType === "transporter" && role === "admin",
    canCancel:       role === "admin",
    canReject:       userType === "transporter" && role === "admin",
  };
}

// ======================== BASE COMPONENTS ============================

function Av({ letters, size=36, color=C.pri }) {
  return <div style={{ width:size, height:size, borderRadius:size, display:"flex", alignItems:"center", justifyContent:"center", background:`${color}12`, color, fontSize:size*0.36, fontWeight:700, letterSpacing:0.5, flexShrink:0, border:`1.5px solid ${color}22` }}>{letters}</div>;
}

function Bd({ children, color=C.pri, bg, small }) {
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:small?"2px 7px":"4px 10px", borderRadius:6, fontSize:small?9.5:10.5, fontWeight:600, background:bg||`${color}0D`, color, whiteSpace:"nowrap", letterSpacing:0.2 }}>{children}</span>;
}

function Btn({ children, onClick, v="pri", full, sm, icon, disabled, style={} }) {
  const vs = {
    pri:  { bg:C.pri, c:C.w },
    sec:  { bg:C.w,   c:C.pri, bd:C.b1 },
    err:  { bg:C.errPale, c:C.err },
    ghost:{ bg:"transparent", c:C.t2 },
    acc:  { bg:C.acc, c:C.w },
  };
  const vv = vs[v] || vs.pri;
  return <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, padding:sm?"8px 14px":"12px 22px", borderRadius:10, fontSize:sm?12:13.5, fontWeight:600, fontFamily:"inherit", background:disabled?"#E8ECE9":vv.bg, color:disabled?C.t3:vv.c, border:vv.bd?`1px solid ${vv.bd}`:"none", cursor:disabled?"not-allowed":"pointer", width:full?"100%":"auto", transition:"all 0.15s", ...style }}>{icon&&<span style={{display:"flex",alignItems:"center"}}>{icon}</span>}{children}</button>;
}

function Tabs({ items, active, onChange }) {
  return <div style={{ display:"flex", gap:2, background:C.bgInput, borderRadius:10, padding:3 }}>{items.map(t=><button key={t.k} onClick={()=>onChange(t.k)} style={{ flex:1, padding:"8px 4px", borderRadius:8, border:"none", fontFamily:"inherit", fontSize:11, fontWeight:active===t.k?700:500, cursor:"pointer", background:active===t.k?C.w:"transparent", color:active===t.k?C.pri:C.t3, boxShadow:active===t.k?C.sh:"none", transition:"all 0.15s" }}>{t.l}</button>)}</div>;
}

function Field({ label, icon, value, onChange, placeholder, type="text", children }) {
  const [showPw, setShowPw] = useState(false);
  const isPw = type === "password";
  if (children) return <div>{label && <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}{children}</div>;
  return (
    <div>
      {label && <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <div style={{ position:"relative" }}>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={isPw&&!showPw?"password":"text"}
          style={{ width:"100%", padding:"12px 14px", paddingRight:isPw?42:14, borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
          onFocus={e=>{e.target.style.borderColor=C.bFocus;}} onBlur={e=>{e.target.style.borderColor=C.b1;}} />
        {isPw && <button onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", display:"flex", padding:4 }}>{showPw?Ic.eye(C.t3,18):Ic.eyeOff(C.t3,18)}</button>}
      </div>
    </div>
  );
}

function Select({ label, icon, value, onChange, options, placeholder="Seleccionar..." }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o=>o.value===value);
  return (
    <div style={{ position:"relative" }}>
      {label && <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <button onClick={()=>setOpen(!open)} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${open?C.bFocus:C.b1}`, background:C.w, color:selected?C.t1:C.t3, fontSize:14, fontFamily:"inherit", textAlign:"left", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", boxSizing:"border-box" }}>
        <span>{selected?.label || placeholder}</span>
        {Ic.down(C.t3,16)}
      </button>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:C.w, border:`1.5px solid ${C.b1}`, borderRadius:10, boxShadow:C.shMd, zIndex:50, maxHeight:200, overflow:"auto" }}>
          {options.map(o=>(
            <button key={o.value} onClick={()=>{onChange(o.value);setOpen(false);}} style={{ width:"100%", padding:"11px 14px", border:"none", borderBottom:`1px solid ${C.b2}`, background:value===o.value?C.priPale:C.w, color:value===o.value?C.pri:C.t1, fontSize:13, fontFamily:"inherit", textAlign:"left", cursor:"pointer", fontWeight:value===o.value?600:400 }}>
              {o.label}
              {o.sub && <div style={{ fontSize:10.5, color:C.t3, marginTop:2 }}>{o.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toast({ msg, type="ok", onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[onClose]);
  const cfg = { ok:{bg:C.pri,ic:Ic.chk(C.w,16)}, err:{bg:C.err,ic:Ic.warn(C.w,16)}, info:{bg:C.info,ic:Ic.bell(C.w,16)} }[type]||{bg:C.pri,ic:Ic.chk(C.w,16)};
  return <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", zIndex:200, background:cfg.bg, color:C.w, padding:"11px 22px", borderRadius:12, fontSize:13, fontWeight:600, boxShadow:C.shLg, display:"flex", alignItems:"center", gap:8, animation:"ti 0.3s ease" }}>{cfg.ic} {msg}</div>;
}

// ======================== BOTTOM NAV =================================

function Nav({ active, onChange, unread=0 }) {
  const items = [
    { k:"home",   ic:a=>Ic.home(a?C.pri:C.t3,22),  l:"Inicio" },
    { k:"list",   ic:a=>Ic.truck(a?C.pri:C.t3,22),  l:"Fletes" },
    { k:"new",    ic:()=>Ic.plus(C.w,22),             l:"Nuevo", sp:true },
    { k:"chats",  ic:a=>Ic.msg(a?C.pri:C.t3,22),    l:"Chat", bd:unread },
    { k:"profile",ic:a=>Ic.user(a?C.pri:C.t3,22),   l:"Perfil" },
  ];
  return (
    <div style={{ display:"flex", borderTop:`1px solid ${C.b1}`, background:C.nav, padding:"4px 0 8px" }}>
      {items.map(it=>(
        <button key={it.k} onClick={()=>onChange(it.k)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", position:"relative", padding:it.sp?0:"6px 0" }}>
          {it.sp ? <div style={{ width:48, height:48, borderRadius:24, background:C.pri, display:"flex", alignItems:"center", justifyContent:"center", marginTop:-20, boxShadow:`0 4px 16px ${C.pri}30` }}>{it.ic(false)}</div> : <>
            <span style={{display:"flex"}}>{it.ic(active===it.k)}</span>
            <span style={{ fontSize:9.5, fontWeight:active===it.k?700:500, color:active===it.k?C.pri:C.t3 }}>{it.l}</span>
            {it.bd>0 && <div style={{ position:"absolute", top:2, right:"20%", minWidth:15, height:15, borderRadius:8, background:C.err, color:C.w, fontSize:8.5, fontWeight:700, padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
          </>}
        </button>
      ))}
    </div>
  );
}

// ======================== AUTH SCREEN =================================

function AuthScreen({ onLogin, onSignup, loading, error, clearError }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [uType, setUType] = useState("");
  const [uRole, setURole] = useState("");
  const [entity, setEntity] = useState("");
  const [errs, setErrs] = useState({});
  const [touched, setTouched] = useState(false);

  const toggle = () => { setMode(m=>m==="login"?"signup":"login"); clearError(); setErrs({}); setTouched(false); };

  const submit = () => {
    setTouched(true);
    const schema = mode==="login" ? SCHEMAS.login : SCHEMAS.signup;
    const vals = mode==="login" ? {email,pw} : {name,email,pw,userType:uType,role:uRole,entity};
    const {ok,errs:e} = validate(vals, schema);
    setErrs(e);
    if(!ok) return;
    if(mode==="login") onLogin(email,pw);
    else onSignup({name,email,pw,userType:uType,role:uRole,entity});
  };
  const tc = {planta:C.pri,transporter:C.info,producer:C.acc};

  // PWA install prompt
  const [canInstall, setCanInstall] = useState(false);
  useEffect(()=>{
    const h = ()=>setCanInstall(true);
    window.addEventListener('pwa-install-available',h);
    return ()=>window.removeEventListener('pwa-install-available',h);
  },[]);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:FONT, display:"flex", flexDirection:"column", justifyContent:"center", padding:28, maxWidth:430, margin:"0 auto" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:${C.bg}}input::placeholder,textarea::placeholder{color:${C.t3}}@keyframes ti{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <div style={{ textAlign:"center", marginBottom:mode==="login"?36:24 }}>
        <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:52, height:52, borderRadius:14, background:C.priPale, marginBottom:12 }}>{Ic.grain(C.pri,26)}</div>
        <div style={{ fontSize:32, fontWeight:800, color:C.pri, letterSpacing:-1.5, lineHeight:1 }}>tolvink</div>
        <div style={{ fontSize:11, color:C.t2, letterSpacing:2.5, textTransform:"uppercase", fontWeight:500, marginTop:6 }}>gestión de fletes</div>
      </div>
      <div style={{ background:C.w, borderRadius:16, padding:22, boxShadow:C.shMd, border:`1px solid ${C.b2}` }}>
        <div style={{ fontSize:17, fontWeight:700, marginBottom:3, color:C.t1 }}>{mode==="login"?"Iniciar sesión":"Crear cuenta"}</div>
        <div style={{ fontSize:12.5, color:C.t2, marginBottom:18 }}>{mode==="login"?"Ingresá con tu email y contraseña":"Completá tus datos"}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {mode==="signup" && <><Field label="Nombre" icon={Ic.user(C.t2,14)} value={name} onChange={setName} placeholder="Tu nombre completo"/>{touched&&<FieldError error={errs.name}/>}</>}
          <div><Field label="Email" icon={Ic.mail(C.t2,14)} value={email} onChange={setEmail} placeholder="tu@email.com" type="email"/>{touched&&<FieldError error={errs.email}/>}</div>
          <div><Field label="Contraseña" icon={Ic.lock(C.t2,14)} value={pw} onChange={setPw} placeholder="••••••" type="password"/>{touched&&<FieldError error={errs.pw}/>}</div>
          {mode==="signup" && <>
            <Field label="Tipo de usuario" icon={Ic.user(C.t2,14)}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                {[{k:"planta",l:"Planta"},{k:"transporter",l:"Transp."},{k:"producer",l:"Productor"}].map(t=><button key={t.k} onClick={()=>setUType(t.k)} style={{ padding:"10px 6px", borderRadius:8, border:`1.5px solid ${uType===t.k?tc[t.k]||C.pri:C.b1}`, background:uType===t.k?`${tc[t.k]||C.pri}0D`:C.w, color:uType===t.k?tc[t.k]||C.pri:C.t2, cursor:"pointer", fontSize:11.5, fontWeight:600, fontFamily:"inherit" }}>{t.l}</button>)}
              </div>
            </Field>
            {touched&&<FieldError error={errs.userType}/>}
            <Field label="Rol" icon={Ic.shield(C.t2,14)}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {[{k:"admin",l:"Gerente"},{k:"operator",l:"Operario"}].map(r=><button key={r.k} onClick={()=>setURole(r.k)} style={{ padding:"10px 8px", borderRadius:8, border:`1.5px solid ${uRole===r.k?C.pri:C.b1}`, background:uRole===r.k?C.priPale:C.w, color:uRole===r.k?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>{r.l}</button>)}
              </div>
            </Field>
            {touched&&<FieldError error={errs.role}/>}
            <div><Field label="Empresa" icon={Ic.plant(C.t2,14)} value={entity} onChange={setEntity} placeholder="Nombre de tu empresa"/>{touched&&<FieldError error={errs.entity}/>}</div>
          </>}
          {error && <div style={{ padding:"10px 14px", background:C.errPale, borderRadius:8, fontSize:12.5, color:C.err, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
          <Btn full onClick={submit} disabled={loading}>{loading?"Cargando...":mode==="login"?"Ingresar":"Crear cuenta"}</Btn>
        </div>
      </div>
      <div style={{ textAlign:"center", marginTop:16 }}>
        <span style={{ fontSize:13, color:C.t2 }}>{mode==="login"?"¿No tenés cuenta? ":"¿Ya tenés cuenta? "}</span>
        <button onClick={toggle} style={{ background:"none", border:"none", color:C.pri, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{mode==="login"?"Registrate":"Iniciá sesión"}</button>
      </div>
      {canInstall && <button onClick={()=>window.installPWA?.()} style={{marginTop:14,width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${C.pri}`,background:C.priPale,color:C.pri,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{Ic.plus(C.pri,16)} Instalar Tolvink en tu dispositivo</button>}
      <div style={{ marginTop:14, padding:12, background:C.bgCardAlt, borderRadius:10, border:`1px solid ${C.b2}` }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.t2, marginBottom:4 }}>CUENTAS DEMO</div>
        <div style={{ fontSize:10, color:C.t3, lineHeight:1.7, fontFamily:MONO }}>
          carolina@planta.com · maria@planta.com{"\n"}ricardo@transp.com · miguel@transp.com{"\n"}juan@campo.com · pedro@campo.com{"\n"}<span style={{color:C.t2,fontWeight:600}}>pw: 1234</span>
        </div>
      </div>
    </div>
  );
}

// ======================== HOME SCREEN ================================

function HomeScreen({ user, freights, perms, onNav }) {
  const stats = useMemo(()=>{
    const avail = freights.filter(f=>f.status==="pending_assignment").length;
    const active = freights.filter(f=>["assigned","accepted","in_progress"].includes(f.status)).length;
    const done = freights.filter(f=>f.status==="finished").length;
    return {avail,active,done};
  },[freights]);

  const activeFreights = useMemo(()=>freights.filter(f=>["assigned","accepted","in_progress"].includes(f.status)),[freights]);

  const tc = ({plant:C.pri,transporter:C.info,producer:C.acc})[user.userType]||C.pri;
  const typeLabel = ({plant:"Planta de Acopio",transporter:"Transportista",producer:"Productor"})[user.userType];

  return (
    <div style={{ flex:1, overflow:"auto", padding:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div><div style={{ fontSize:13, color:C.t2 }}>Hola,</div><div style={{ fontSize:22, fontWeight:800, letterSpacing:-0.3, color:C.t1 }}>{user.name.split(" ")[0]}</div></div>
        <div style={{ textAlign:"right" }}><Bd color={tc}>{typeLabel}</Bd><div style={{ fontSize:10, color:C.t3, marginTop:4 }}>{user.role==="admin"?"Gerente":"Operario"} · {user.entity}</div></div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
        {[{l:"Disponibles",v:stats.avail,c:C.pri,bg:C.priPale},{l:"En curso",v:stats.active,c:C.acc,bg:C.accPale},{l:"Finalizados",v:stats.done,c:C.ok,bg:C.okPale}].map((s,i)=>(
          <div key={i} style={{ background:s.bg, borderRadius:12, padding:"14px 10px", textAlign:"center" }}><div style={{ fontSize:26, fontWeight:800, color:s.c }}>{s.v}</div><div style={{ fontSize:10, color:s.c, fontWeight:500, marginTop:2, opacity:0.8 }}>{s.l}</div></div>
        ))}
      </div>

      {perms.canRequest && <Btn full onClick={()=>onNav("new")} icon={Ic.plus(C.w,16)} style={{marginBottom:16}}>Solicitar nuevo flete</Btn>}

      {perms.canApprove && stats.avail>0 && (
        <div onClick={()=>onNav("list")} style={{ background:C.accPale, border:`1px solid ${C.acc}22`, borderRadius:12, padding:14, marginBottom:18, cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
          {Ic.warn(C.acc,24)}<div><div style={{ fontSize:13, fontWeight:700, color:C.acc }}>{stats.avail} flete{stats.avail>1?"s":""} disponible{stats.avail>1?"s":""}</div><div style={{ fontSize:11.5, color:C.t2 }}>Esperando asignación de transporte</div></div>
        </div>
      )}

      {activeFreights.length>0 && <>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:10, color:C.t1 }}>En movimiento</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {activeFreights.map(f=>{
            const st = stCfg(f.status);
            return (
              <div key={f.id} onClick={()=>onNav("detail",f.id)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:14, cursor:"pointer", boxShadow:C.sh }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.t3, fontFamily:MONO }}>{f.code}</span>
                  <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{f.grain} · {f.tons} tn</div>
                <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:6, fontSize:11.5, color:C.t2 }}>
                  {Ic.pin(C.t3,13)} <span>{(f.originName||"").split("—")[0].trim()}</span>
                  <span style={{color:C.t3,margin:"0 2px"}}>&rarr;</span>
                  {Ic.plant(C.t3,13)} <span>{f.destName}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:C.t3, marginTop:6 }}>
                  {Ic.cal(C.t3,12)} {f.loadDate} {f.loadTime}
                  {f.transporterName && <><span style={{color:C.b1}}>|</span>{Ic.truck(C.t3,12)} {f.transporterName}</>}
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

// ======================== FREIGHT LIST ================================

function ListScreen({ freights, onNav }) {
  const [tab, setTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [fPlant, setFPlant] = useState("");

  const plantOptions = useMemo(()=>[...new Set(freights.map(f=>f.destName).filter(Boolean))].sort(),[freights]);

  const filtered = useMemo(()=>{
    return freights.filter(f=>{
      if(tab==="available" && f.status!=="pending_assignment") return false;
      if(tab==="active" && !["assigned","accepted","in_progress"].includes(f.status)) return false;
      if(tab==="done" && f.status!=="finished") return false;
      if(tab==="closed" && f.status!=="canceled") return false;
      if(searchQ && !textMatch(f.requestedByName,searchQ) && !textMatch(f.code,searchQ) && !textMatch(f.grain,searchQ)) return false;
      if(fPlant && f.destName!==fPlant) return false;
      return true;
    });
  },[freights,tab,searchQ,fPlant]);

  const activeFilters = [fPlant,searchQ].filter(Boolean).length;

  return (
    <div style={{ flex:1, overflow:"auto", padding:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>Fletes</div>
        <button onClick={()=>setShowFilters(!showFilters)} style={{display:"flex",alignItems:"center",gap:4,background:activeFilters>0?C.priPale:"none",border:activeFilters>0?`1px solid ${C.pri}30`:"1px solid transparent",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,color:activeFilters>0?C.pri:C.t2}}>
          {Ic.filter(activeFilters>0?C.pri:C.t2,14)} Filtros{activeFilters>0?` (${activeFilters})`:""}
        </button>
      </div>

      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:10 }}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,16)}</div>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar productor, código, grano..."
          style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,16)}</button>}
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:14,marginBottom:10,boxShadow:C.sh}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <label style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4,display:"block"}}>Planta</label>
              <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12,fontFamily:"inherit",outline:"none"}}>
                <option value="">Todas</option>
                {plantOptions.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>

          </div>
          {activeFilters>0 && <button onClick={()=>{setFPlant("");setSearchQ("");}} style={{fontSize:11,color:C.pri,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Limpiar filtros</button>}
        </div>
      )}

      <Tabs items={[{k:"all",l:"Todos"},{k:"available",l:"Disponibles"},{k:"active",l:"Activos"},{k:"done",l:"Finalizados"},{k:"closed",l:"Cerrados"}]} active={tab} onChange={setTab}/>
      <div style={{fontSize:11,color:C.t3,marginTop:8,marginBottom:6}}>{filtered.length} resultado{filtered.length!==1?"s":""}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.length===0 && <div style={{ textAlign:"center", padding:40, color:C.t3, fontSize:13 }}>Sin fletes en esta categoría</div>}
        {filtered.map(f=>(
          <div key={f.id} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:14, boxShadow:C.sh }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.t3, fontFamily:MONO }}>{f.code}</span>
                  
                </div>
                <div style={{ fontSize:15, fontWeight:700, marginTop:4, color:C.t1 }}>{f.requestedByName || f.grain}</div>
              </div>
              {(()=>{const st=stCfg(f.status);return <Bd color={st.color} bg={st.bg}>{st.label}</Bd>})()}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:11.5, color:C.t2 }}>{Ic.plant(C.t3,13)} {f.destName} <span style={{color:C.b1}}>|</span> {f.grain} · {f.tons}tn</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:C.t3, marginTop:6 }}>{Ic.cal(C.t3,11)} {f.loadDate} {f.loadTime}</div>
            {f.transporterName && <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10.5, color:C.t3, marginTop:4 }}>{Ic.truck(C.t3,12)} {f.transporterName}</div>}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <Btn sm v="sec" onClick={()=>onNav("detail",f.id)} icon={Ic.eye(C.pri,14)}>Detalle</Btn>
              
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================== FREIGHT DETAIL ==============================

function DetailScreen({ user, freight, perms, onBack, onAction }) {
  if(!freight) return null;
  const st = stCfg(freight.status);
  const actions = getActions(freight.status, user.userType, user.role);

  return (
    <div style={{ flex:1, overflow:"auto", padding:18 }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:11, color:C.t3, fontWeight:600, fontFamily:MONO }}>{freight.code}</div>
          <div style={{ fontSize:22, fontWeight:800, marginTop:2, letterSpacing:-0.3 }}>{freight.grain} · {freight.tons} tn</div>
        </div>
        <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
      </div>

      {/* Progress */}
      {freight.status !== "canceled" && (()=>{
        const steps = ["pending_assignment","assigned","accepted","in_progress","finished"];
        const curIdx = steps.indexOf(freight.status);
        return <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          <div style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Progreso</div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {steps.map((s,i)=>{
              const done = i < curIdx; const active = i === curIdx; const c = stCfg(s);
              return <div key={s} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",height:4,borderRadius:2,background:done||active?c.color:C.b1}}/>
                <span style={{fontSize:8,fontWeight:active?700:500,color:active?c.color:done?C.t2:C.t3,textAlign:"center"}}>{c.label}</span>
              </div>;
            })}
          </div>
        </div>;
      })()}

      {/* Info */}
      <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
        <div style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Información del flete</div>
        {[
          [Ic.pin(C.pri,15),"Origen",freight.originName],
          [Ic.plant(C.t2,15),"Destino",freight.destName],
          [Ic.cal(C.t2,15),"Fecha carga",freight.loadDate],
          [Ic.clk(C.t2,15),"Hora carga",freight.loadTime],
          [Ic.user(C.t2,15),"Solicitado por",freight.requestedByName],
          [Ic.grain(C.t2,15),"Grano",`${freight.grain} · ${freight.tons}tn`],
          freight.transporterName&&[Ic.truck(C.t2,15),"Transportista",freight.transporterName],
          freight.driverName&&[Ic.user(C.pri,15),"Chofer",freight.driverName],
        ].filter(Boolean).map(([ic,label,val],i,arr)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.b2}`:"none" }}>
            <span style={{display:"flex",flexShrink:0}}>{ic}</span>
            <span style={{ fontSize:11.5, color:C.t2, minWidth:85 }}>{label}</span>
            <span style={{ fontSize:12, fontWeight:600, color:C.t1, marginLeft:"auto", textAlign:"right" }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Assignment history */}
      {freight.assignments?.length > 0 && (
        <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
          <div style={{ fontSize:10.5, fontWeight:700, marginBottom:10, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Historial de asignaciones</div>
          {freight.assignments.map((a,i)=>{
            const ac = {active:{l:"Pendiente",c:C.info,bg:C.infoPale},accepted:{l:"Aceptada",c:C.ok,bg:C.okPale},rejected:{l:"Rechazada",c:C.err,bg:C.errPale},canceled:{l:"Cancelada",c:C.muted,bg:C.mutedPale}}[a.status]||{l:a.status,c:C.muted,bg:C.mutedPale};
            return <div key={a.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:i<freight.assignments.length-1?`1px solid ${C.b2}`:"none" }}>
              <Bd color={ac.c} bg={ac.bg} small>{ac.l}</Bd>
              <span style={{fontSize:11,color:C.t2}}>{a.transporterName}</span>
              {a.reason && <span style={{fontSize:10,color:C.err,fontStyle:"italic",marginLeft:"auto"}}>"{a.reason}"</span>}
            </div>;
          })}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
        {actions.includes("assign") && <Btn full v="acc" icon={Ic.chk(C.w,16)} onClick={()=>onAction(freight.id,"assign")}>Asignar transportista</Btn>}
        {actions.includes("accept") && <Btn full icon={Ic.chk(C.w,16)} onClick={()=>onAction(freight.id,"accept")}>Aceptar flete</Btn>}
        {actions.includes("start") && <Btn full icon={Ic.truck(C.w,16)} onClick={()=>onAction(freight.id,"start")}>Iniciar viaje</Btn>}
        {actions.includes("finish") && <Btn full icon={Ic.chk(C.w,16)} onClick={()=>onAction(freight.id,"finish")}>Finalizar viaje</Btn>}
        {actions.includes("reject") && <Btn full v="err" icon={Ic.ban(C.w,16)} onClick={()=>onAction(freight.id,"reject")}>Rechazar asignación</Btn>}
        {actions.includes("cancel") && <Btn full v="err" icon={Ic.cross(C.err,16)} onClick={()=>onAction(freight.id,"cancel")}>Cancelar flete</Btn>}
      </div>

      <div style={{ background:C.bgCardAlt, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1px solid ${C.b2}` }}>
        {Ic.wa("#25D366",20)}<div><div style={{ fontSize:11, fontWeight:600, color:"#25D366" }}>WhatsApp activo</div><div style={{ fontSize:10, color:C.t2 }}>Notificaciones automáticas a involucrados</div></div>
      </div>
    </div>
  );
}


// ======================== NEW FREIGHT ================================

function NewScreen({ user, lots, plants, onBack, onCreate }) {
  const [form, setForm] = useState({ grain:"", tons:"", lotId:"", plantId:"", loadDate:"", loadTime:"", notes:"" });
  const [errs, setErrs] = useState({});
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const u = f => setForm(p=>({...p,...f}));

  const lotOpts = (lots||[]).map(l=>({ value:l.id, label:l.name, sub:l.lat?`${l.lat}, ${l.lng}`:'' }));
  const plantOpts = (plants||[]).map(p=>({ value:p.id, label:p.name }));
  const selectedLot = (lots||[]).find(l=>l.id===form.lotId);

  const submit = () => {
    setTouched(true);
    const {ok,errs:e} = validate(form, SCHEMAS.freight);
    setErrs(e);
    if(!ok) return;
    onCreate(form);
  };

  return (
    <div style={{ flex:1, overflow:"auto", padding:18 }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Solicitar Flete</div>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>Solicitando como: <span style={{fontWeight:600,color:C.t1}}>{user.name}</span></div>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div>
          <Field label="Tipo de grano" icon={Ic.grain(C.pri,14)}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
              {GRANOS.map(g=><button key={g} onClick={()=>u({grain:g})} style={{ padding:"10px 8px", borderRadius:8, border:`1.5px solid ${form.grain===g?C.pri:C.b1}`, background:form.grain===g?C.priPale:C.w, color:form.grain===g?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>{g}</button>)}
            </div>
          </Field>
          {touched&&<FieldError error={errs.grain}/>}
        </div>

        <div>
          <Field label="Toneladas" icon={Ic.weight(C.t2,14)} value={form.tons} onChange={v=>u({tons:v})} placeholder="Ej: 30" type="number"/>
          {touched&&<FieldError error={errs.tons}/>}
        </div>

        <div>
          <Select label="Origen (lote)" icon={Ic.pin(C.pri,14)} value={form.lotId} onChange={v=>u({lotId:v})} options={lotOpts} placeholder="Seleccionar lote..."/>
          {touched&&<FieldError error={errs.lotId}/>}
          {selectedLot && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:C.priPale, borderRadius:8, marginTop:6 }}>{Ic.chk(C.pri,14)}<span style={{fontSize:10.5,color:C.pri,fontWeight:500}}>{selectedLot.lat}, {selectedLot.lng}</span></div>}
        </div>

        <div>
          <Select label="Destino (planta)" icon={Ic.plant(C.t2,14)} value={form.plantId} onChange={v=>u({plantId:v})} options={plantOpts} placeholder="Seleccionar planta..."/>
          {touched&&<FieldError error={errs.plantId}/>}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.cal(C.pri,14)} Fecha carga</label>
            <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadDate?C.err:C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            {touched&&<FieldError error={errs.loadDate}/>}
          </div>
          <div>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.clk(C.pri,14)} Hora carga</label>
            <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadTime?C.err:C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            {touched&&<FieldError error={errs.loadTime}/>}
          </div>
        </div>

        <div>
          <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"block", textTransform:"uppercase", letterSpacing:0.6 }}>Notas</label>
          <textarea value={form.notes} onChange={e=>u({notes:e.target.value})} placeholder="Indicaciones, horarios especiales..." rows={3} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", boxSizing:"border-box" }}/>
        </div>

        <Btn full icon={Ic.chk(C.w,16)} disabled={submitting} onClick={submit}>{submitting?"Enviando...":"Solicitar Flete"}</Btn>
      </div>
    </div>
  );
}


// ======================== PROFILE =====================================

function ProfileScreen({ user, perms, onLogout }) {
  const tc = ({plant:C.pri,transporter:C.info,producer:C.acc})[user.userType]||C.pri;
  const pl = []; if(perms.canRequest)pl.push("Solicitar fletes"); if(perms.canApprove)pl.push("Aprobar fletes"); if(perms.canAssignDriver)pl.push("Asignar choferes"); if(perms.canCancel)pl.push("Cancelar fletes"); if(perms.canReject)pl.push("Rechazar viajes");
  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      <div style={{fontSize:20,fontWeight:800,marginBottom:22,letterSpacing:-0.3}}>Mi Perfil</div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <Av letters={user.av} size={60} color={tc}/>
        <div style={{fontSize:18,fontWeight:700,marginTop:10}}>{user.name}</div>
        <div style={{fontSize:12,color:C.t2,marginTop:3}}>{user.email}</div>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:8}}>
          <Bd color={tc}>{({plant:"Planta",transporter:"Transportista",producer:"Productor"})[user.userType]}</Bd>
          <Bd color={C.t2} bg={C.bgInput}>{user.role==="admin"?"Gerente":"Operario"}</Bd>
        </div>
        <div style={{fontSize:12,color:C.t2,marginTop:6}}>{user.entity}</div>
      </div>
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>{Ic.shield(C.pri,16)}<span style={{fontSize:10.5,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Permisos</span></div>
        {pl.length>0?pl.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}>{Ic.chk(C.pri,14)}<span style={{fontSize:13}}>{p}</span></div>):<div style={{fontSize:12,color:C.t3}}>Rol operativo</div>}
      </div>
      <Btn full v="err" onClick={onLogout} icon={Ic.out(C.err,16)}>Cerrar sesión</Btn>
    </div>
  );
}

// ======================== MODALS =====================================

function AssignModal({ freight, transporters, onClose, onConfirm }) {
  const [t,setT] = useState("");
  const ts = transporters||[];
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:16}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Asignar transporte · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn · {freight.originName}</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Transportista</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
          {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10}}>No hay transportistas disponibles</div>}
          {ts.map(x=><button key={x.id} onClick={()=>setT(x.id)} style={{padding:"13px 14px",borderRadius:10,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${t===x.id?C.pri:C.b1}`,background:t===x.id?C.priPale:C.w,color:t===x.id?C.pri:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>{Ic.truck(t===x.id?C.pri:C.t3,16)} {x.name}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose}>Cancelar</Btn><Btn full disabled={!t} onClick={()=>onConfirm(t)}>Asignar</Btn></div>
      </div>
    </div>
  );
}

function ReasonModal({ title, freight, btnLabel, btnType="err", onClose, onConfirm }) {
  const [reason,setReason] = useState("");
  return (
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:16}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4,color:btnType==="err"?C.err:C.t1}}>{title} · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Motivo</label>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describí el motivo..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:13,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box",marginBottom:16}}/>
        <div style={{display:"flex",gap:8}}><Btn full v="ghost" onClick={onClose}>Volver</Btn><Btn full v={btnType} disabled={!reason} onClick={()=>onConfirm(reason)}>{btnLabel}</Btn></div>
      </div>
    </div>
  );
}

// ======================== MAIN APP ====================================
export default function Tolvink() {
  const auth = useAuth();
  const fh = useFreights(auth.user);
  const catalog = useCatalog(auth.user);
  const [screen, setScreen] = useState("home");
  const [selFreight, setSelFreight] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const perms = useMemo(()=>permsFor(auth.user),[auth.user]);
  const show = (msg,type="ok")=>setToast({msg,type});
  const nav = (s,fId)=>{ if(fId) setSelFreight(fId); if(s==="new"&&!perms.canRequest){show("Sin permisos para solicitar","err");return;} setScreen(s); };

  const handleAction = (fId,action)=>{
    const f = fh.freights.find(x=>x.id===fId);
    if(!f) return;
    if(action==="assign") setModal({type:"assign",freight:f});
    if(action==="cancel") setModal({type:"reason",freight:f,title:"Cancelar flete",btnLabel:"Cancelar flete",action:"cancel"});
    if(action==="reject") setModal({type:"reason",freight:f,title:"Rechazar asignación",btnLabel:"Rechazar",action:"reject"});
    if(action==="accept") (async()=>{ const r=await fh.respond(fId,"accepted"); if(r.ok) show("Flete aceptado"); else show(r.error,"err"); })();
    if(action==="start") (async()=>{ const r=await fh.start(fId); if(r.ok) show("Viaje iniciado"); else show(r.error,"err"); })();
    if(action==="finish") (async()=>{ const r=await fh.finish(fId); if(r.ok) show("Viaje finalizado"); else show(r.error,"err"); })();
  };

  const handleAssign = async (fId, transportCompanyId)=>{
    const r = await fh.assign(fId, transportCompanyId);
    if(r.ok){ setModal(null); show("Transportista asignado"); } else show(r.error,"err");
  };

  const handleReasonAction = async (fId,reason,action)=>{
    let r;
    if(action==="cancel") r = await fh.cancel(fId,reason);
    else if(action==="reject") r = await fh.respond(fId,"rejected",reason);
    if(r?.ok){ setModal(null); show(action==="cancel"?"Flete cancelado":"Asignación rechazada","info"); } else show(r?.error||"Error","err");
  };

  const handleCreate = async (form)=>{
    setSubmitting(true);
    const r = await fh.create(form);
    setSubmitting(false);
    if(r.ok){ setScreen("list"); show("Flete solicitado"); } else show(r.error,"err");
  };

  if(auth.loading) return <div style={{minHeight:"100vh",background:C.bg,fontFamily:FONT,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{display:"inline-flex",alignItems:"center",gap:5,marginBottom:12}}>{Ic.grain(C.pri,20)}<span style={{fontSize:16,fontWeight:800,color:C.pri}}>tolvink</span></div><div style={{fontSize:12,color:C.t3}}>Cargando...</div></div></div>;

  if(!auth.user) return <AuthScreen onLogin={auth.login} onSignup={auth.signup} loading={auth.loading} error={auth.error} clearError={auth.clearError}/>;
  const curFreight = fh.freights.find(f=>f.id===selFreight);

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.t1,fontFamily:FONT,display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:${C.bg}}input::placeholder,textarea::placeholder{color:${C.t3}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.b1};border-radius:4px}@keyframes ti{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <div style={{padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.b2}`,background:C.w}}>
        <span style={{fontSize:11,fontWeight:500,color:C.t3}}>{new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})}</span>
        <div style={{display:"flex",alignItems:"center",gap:5}}>{Ic.grain(C.pri,15)}<span style={{fontSize:13,fontWeight:800,color:C.pri,letterSpacing:-0.5}}>tolvink</span></div>
        {Ic.bell(C.t3,16)}
      </div>

      {screen==="home" && <HomeScreen user={auth.user} freights={fh.freights} perms={perms} onNav={nav}/>}
      {screen==="list" && <ListScreen freights={fh.freights} onNav={nav}/>}
      {screen==="detail" && <DetailScreen user={auth.user} freight={curFreight} perms={perms} onBack={()=>setScreen("list")} onAction={handleAction}/>}
      {screen==="new" && <NewScreen user={auth.user} lots={catalog.lots} plants={catalog.plants} onBack={()=>setScreen("home")} onCreate={handleCreate} submitting={submitting}/>}
      {screen==="profile" && <ProfileScreen user={auth.user} perms={perms} onLogout={auth.logout}/>}

      <Nav active={screen==="detail"?"list":screen} onChange={nav}/>

      {modal?.type==="assign" && <AssignModal freight={modal.freight} transporters={catalog.transporters} onClose={()=>setModal(null)} onConfirm={t=>handleAssign(modal.freight.id,t)}/>}
      {modal?.type==="reason" && <ReasonModal title={modal.title} freight={modal.freight} btnLabel={modal.btnLabel} onClose={()=>setModal(null)} onConfirm={r=>handleReasonAction(modal.freight.id,r,modal.action)}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
