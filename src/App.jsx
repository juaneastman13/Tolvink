import { useState, useEffect, useRef, useCallback, useMemo, Component } from "react";
import {
  apiLogin, apiRegister, apiLogout, apiListFreights, apiGetFreight,
  apiCreateFreight, apiAssignFreight, apiRespondFreight,
  apiStartFreight, apiFinishFreight, apiCancelFreight,
  apiConfirmLoaded, apiConfirmFinished, apiAuthorizeFreight,
  apiSendTracking, apiGetLastPosition,
  apiGetAuditLog,
  apiUpdateFreight,
  apiGetPlants, apiGetLots, apiGetTransportCompanies, apiGetTrucks,
  apiCreateTruck, apiDeactivateTruck,
  apiGetFields, apiCreateField, apiUpdateField, apiCreateLot, apiUpdateLot, apiGetFieldLots,
  apiGrantAccess, apiRevokeAccess, apiListAccessProducers, apiListAccessPlants,
  apiStartConversation, apiListConversations, apiGetMessages, apiSendMessage,
  uploadPhoto, apiAddDocument, uploadChatFile,
  apiAdminStats, apiAdminListCompanies, apiAdminGetCompany, apiAdminCreateCompany, apiAdminUpdateCompany,
  apiAdminListBranches, apiAdminCreateBranch, apiAdminUpdateBranch, apiAdminDeleteBranch,
  apiAdminListUsers, apiAdminCreateUser, apiAdminUpdateUser, apiUpdateMe,
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
  phone: (v) => { if(!v) return 'Teléfono es obligatorio'; const clean=v.replace(/[\s\-()]/g,''); return /^09[1-9]\d{6}$/.test(clean)?null:'Formato: 09X XXX XXX'; },
  userTypes: (v) => { if(!v||!Array.isArray(v)||v.length===0) return 'Seleccioná al menos un tipo'; return null; },
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
  signup:  { name:[V.req,V.min(3)], email:[V.email], phone:[V.phone], pw:[V.min(4)], userTypes:[V.userTypes] },
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
const LIGHT = {
  bg:"#F7F8F7",
  bgCard:"#FFFFFF",
  bgCardAlt:"#F1F4F2",
  bgInput:"#EDEFED",
  bgOverlay:"rgba(10,20,14,0.6)",
  nav:"#FFFFFF",
  pri:"#1A6B37", priLt:"#228B46", priPale:"#E4F3EA", priGhost:"rgba(26,107,55,0.06)",
  acc:"#FF6A00", accLt:"#FF8124", accPale:"#FFF3E8",
  sec:"#0891B2", secLt:"#06B6D4", secPale:"#ECFEFF",
  ok:"#1A6B37", okPale:"#E4F3EA",
  info:"#0891B2", infoPale:"#ECFEFF",
  warn:"#CA8A04", warnPale:"#FEF9C3",
  err:"#DC2626", errPale:"#FEE2E2",
  muted:"#71717A", mutedPale:"#F4F4F5",
  t1:"#18251C", t2:"#4A6352", t3:"#8A9C90", tOn:"#FFFFFF",
  b1:"#DEE4E0", b2:"#ECF0ED", bFocus:"#1A6B37",
  w:"#FFFFFF",
  sh:"0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03)",
  shMd:"0 4px 14px rgba(0,0,0,0.06)",
  shLg:"0 12px 32px rgba(0,0,0,0.10)",
};

const DARK = {
  bg:"#0F1512",
  bgCard:"#1A2420",
  bgCardAlt:"#212E28",
  bgInput:"#253530",
  bgOverlay:"rgba(0,0,0,0.75)",
  nav:"#1A2420",
  pri:"#2EBF5E", priLt:"#38D96E", priPale:"#1A3328", priGhost:"rgba(46,191,94,0.08)",
  acc:"#FF8533", accLt:"#FF9F5C", accPale:"#33241A",
  sec:"#22D3EE", secLt:"#67E8F9", secPale:"#164E63",
  ok:"#2EBF5E", okPale:"#1A3328",
  info:"#22D3EE", infoPale:"#164E63",
  warn:"#FACC15", warnPale:"#33291A",
  err:"#EF4444", errPale:"#331A1A",
  muted:"#9CA3AF", mutedPale:"#27302C",
  t1:"#E8F0EC", t2:"#A0B5A8", t3:"#6B8273", tOn:"#FFFFFF",
  b1:"#2A3832", b2:"#1F2D26", bFocus:"#2EBF5E",
  w:"#1A2420",
  sh:"0 1px 3px rgba(0,0,0,0.2),0 1px 2px rgba(0,0,0,0.15)",
  shMd:"0 4px 14px rgba(0,0,0,0.25)",
  shLg:"0 12px 32px rgba(0,0,0,0.35)",
};

// Global theme state — persisted in localStorage
let _theme = "light";
try { _theme = localStorage.getItem("tv-theme") || "light"; } catch {}
let _listeners = [];
function getTheme() { return _theme; }
function setTheme(t) { _theme = t; try { localStorage.setItem("tv-theme", t); } catch {} _listeners.forEach(fn => fn(t)); }
function useTheme() {
  const [t, setT] = useState(getTheme);
  useEffect(() => { const fn = (v) => setT(v); _listeners.push(fn); return () => { _listeners = _listeners.filter(f => f !== fn); }; }, []);
  return [t, setTheme];
}

let C = _theme === "dark" ? { ...DARK } : { ...LIGHT };

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
  cam:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  img:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  doc:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  seedling:(c="#1A6B37",s=22)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V10"/><path d="M6 13c0-3.5 2.7-6 6-6 3.3 0 6 2.5 6 6"/><path d="M12 10c0-4-2.5-7-6-8 0 3.5 2 7 6 8z"/><path d="M12 10c0-4 2.5-7 6-8 0 3.5-2 7-6 8z"/></svg>,
  expand:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  collapse:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  edit:(c=C.t2,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  clip:(c=C.t3,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  phone:(c=C.t3,s=18)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
};

// ======================== STATE MACHINE ==============================
// Freight has 2 states. Trip has its own lifecycle.
// This separation allows: 1 Freight → many Trips (reasignaciones)

// Backend states: draft, pending_assignment, assigned, accepted, in_progress, loaded, finished, canceled
// Color system: pending=naranja, active states=verde progresivo, terminal=verde oscuro/rojo
// Light mode uses original hardcoded colors; dark mode uses C (dynamic)
const STATUS_LIGHT = {
  draft:              { label:"Borrador",            color:"#71717A",   bg:"#F4F4F5",   border:"#71717A"   },
  pending_assignment: { label:"Solicitado",          color:"#FF6A00",   bg:"#FFF3E8",   border:"#FF6A00"   },
  assigned:           { label:"Asignado a flota",    color:"#0891B2",   bg:"#ECFEFF",   border:"#0891B2"   },
  accepted:           { label:"Confirmado camión",   color:"#0891B2",   bg:"#ECFEFF",   border:"#0891B2"   },
  in_progress:        { label:"En curso",            color:"#258B3E",   bg:"#D0EBD7",   border:"#258B3E"   },
  loaded:             { label:"Cargando",            color:"#1B7D33",   bg:"#C4E6CC",   border:"#1B7D33"   },
  finished:           { label:"Finalizado",          color:"#1A6B37",   bg:"#E4F3EA",   border:"#1A6B37"   },
  canceled:           { label:"Cancelado",           color:"#DC2626",   bg:"#FEE2E2",   border:"#DC2626"   },
};
const STATUS_DARK = {
  draft:              { label:"Borrador",            color:"#9CA3AF",   bg:"#27302C",   border:"#9CA3AF"   },
  pending_assignment: { label:"Solicitado",          color:"#FF8533",   bg:"#33241A",   border:"#FF8533"   },
  assigned:           { label:"Asignado a flota",    color:"#22D3EE",   bg:"#164E63",   border:"#22D3EE"   },
  accepted:           { label:"Confirmado camión",   color:"#22D3EE",   bg:"#164E63",   border:"#22D3EE"   },
  in_progress:        { label:"En curso",            color:"#4ADE80",   bg:"#1A3328",   border:"#4ADE80"   },
  loaded:             { label:"Cargando",            color:"#34D399",   bg:"#1A332D",   border:"#34D399"   },
  finished:           { label:"Finalizado",          color:"#2EBF5E",   bg:"#1A3328",   border:"#2EBF5E"   },
  canceled:           { label:"Cancelado",           color:"#EF4444",   bg:"#331A1A",   border:"#EF4444"   },
};
function stCfg(s) { 
  const map = _theme === "dark" ? STATUS_DARK : STATUS_LIGHT;
  return map[s] || map.pending_assignment; 
}

function getActions(status, userType, role, isOwnFleet) {
  const map = {
    pending_assignment: { producer:["cancel"], plant:["assign","cancel"], transporter:[] },
    assigned:           { producer: isOwnFleet ? ["cancel"] : ["cancel"], plant: isOwnFleet ? ["authorize","cancel"] : ["cancel"], transporter:["accept","reject"] },
    accepted:           { producer: isOwnFleet ? ["start","cancel"] : ["cancel"], plant:["cancel"], transporter: isOwnFleet ? [] : ["start","cancel"] },
    in_progress:        { producer: isOwnFleet ? ["confirm_loaded"] : [], plant:[], transporter: isOwnFleet ? [] : ["confirm_loaded"] },
    loaded:             { producer:["confirm_loaded"], plant:["confirm_finished"], transporter:["confirm_finished"] },
    finished:           { producer:[], plant:[], transporter:[] },
    canceled:           { producer:[], plant:[], transporter:[] },
    draft:              { producer:[], plant:[], transporter:[] },
  };
  return map[status]?.[userType] || [];
}

const GRANOS = ["Soja","Maíz","Trigo","Girasol","Sorgo","Cebada","Otros"];
const UNITS = [{v:"toneladas",l:"Toneladas"},{v:"cantidad",l:"Cantidad"},{v:"metros",l:"Metros"},{v:"m3",l:"M³"}];

// ======================== CATALOG HOOK (Real API) ====================
function useCatalog(user) {
  const [plants, setPlants] = useState([]);
  const [lots, setLots] = useState([]);
  const [fields, setFields] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(()=>{
    if(!user) return;
    setLoading(true);
    Promise.all([
      apiGetPlants().catch(()=>[]),
      apiGetLots().catch(()=>[]),
      apiGetTransportCompanies().catch(()=>[]),
      (user.userType==="transporter"||user.userType==="producer") ? apiGetTrucks().catch(()=>[]) : Promise.resolve([]),
      user.userType==="producer" ? apiGetFields().catch(()=>[]) : Promise.resolve([]),
    ]).then(([p,l,t,tr,f])=>{
      setPlants(p||[]);
      setLots(l||[]);
      setTransporters(t||[]);
      setTrucks(tr||[]);
      setFields(f||[]);
    }).finally(()=>setLoading(false));
  },[user]);

  useEffect(()=>{ load(); },[load]);

  const refresh = useCallback(()=>{ load(); },[load]);

  return { plants, lots, fields, transporters, trucks, loading, refresh };
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

  const login = useCallback(async (identifier,pw) => {
    setLoading(true); setError(null);
    try { const d = await apiLogin(identifier,pw); setUser(mapUser(d.user)); }
    catch(e) { setError(e.message||"Error al iniciar sesión"); }
    finally { setLoading(false); }
  },[]);

  const signup = useCallback(async (form) => {
    setLoading(true); setError(null);
    try {
      const typeMap = {planta:"plant",transporter:"transporter",producer:"producer"};
      const userTypes = (form.userTypes||[]).map(t=>typeMap[t]||t);
      const phone = form.phone?.replace(/[\s\-()]/g,'')||"";
      const d = await apiRegister({ name:form.name, email:form.email, phone, password:form.pw, userTypes });
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
  // Support new multi-type structure: u.userTypes = ["plant","producer",...]
  // Fallback to legacy: co?.type
  const userTypes = u.userTypes || (co?.type ? [co.type] : ["producer"]);
  // Active type: first type or legacy
  const userType = u.activeType || userTypes[0] || co?.type || "producer";
  // Role: from user_companies join or legacy
  const role = u.role || "operator";
  return {
    id:u.id, email:u.email, phone:u.phone||"", name:u.name, role, userType, userTypes,
    entity:co?.name||"", entityId:co?.id||"", companyId:co?.id||"",
    hasInternalFleet: co?.hasInternalFleet||false,
    isSuperAdmin: u.isSuperAdmin||false,
    av: u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()
  };
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
    try { const c=await apiCreateFreight({ originLotId:form.lotId, fieldId:form.fieldId||undefined, destPlantId:form.plantId, loadDate:form.loadDate, loadTime:form.loadTime, items:[{grain:form.grain,tons:parseFloat(form.tons),unit:form.unit||"toneladas",amount:form.amount?parseFloat(form.amount):0,productTypeOther:form.productTypeOther||undefined}], notes:form.notes||"", truckId:form.truckId||undefined, overrideOriginLat:form.overrideOriginLat, overrideOriginLng:form.overrideOriginLng, overrideDestLat:form.overrideDestLat, overrideDestLng:form.overrideDestLng });
      const m=mapFreight(c); setFreights(p=>[m,...p]); return {ok:true, freightId:c.id}; } catch(e) { return {ok:false,error:e.message}; }
  },[]);
  const assign = useCallback(async (fId,compId)=>{ try { await apiAssignFreight(fId,{transportCompanyId:compId}); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const respond = useCallback(async (fId,action,reason,truckId)=>{ try { await apiRespondFreight(fId,{action,reason,truckId}); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const start = useCallback(async (fId)=>{ try { await apiStartFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const finish = useCallback(async (fId)=>{ try { await apiFinishFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const cancel = useCallback(async (fId,reason)=>{ try { await apiCancelFreight(fId,reason); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmLoaded = useCallback(async (fId)=>{ try { await apiConfirmLoaded(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const confirmFinished = useCallback(async (fId)=>{ try { await apiConfirmFinished(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const authorize = useCallback(async (fId)=>{ try { await apiAuthorizeFreight(fId); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  const update = useCallback(async (fId, data)=>{ try { await apiUpdateFreight(fId, data); await refresh(fId); return {ok:true}; } catch(e) { return {ok:false,error:e.message}; } },[refresh]);
  return { freights, loading, error, fetchAll, refresh, create, assign, respond, start, finish, cancel, confirmLoaded, confirmFinished, authorize, update };
}

function mapFreight(f) {
  if(!f) return null;
  const a = f.assignments?.find(x=>x.status==="active"||x.status==="accepted");
  const isOwnFleet = !!(a && a.transportCompanyId === f.originCompanyId);
  return {
    id:f.id, code:f.code, status:f.status,
    grain:f.items?.[0]?.grain||"", tons:f.items?.[0]?.tons||0,
    unit:f.items?.[0]?.unit||"toneladas", amount:f.items?.[0]?.amount||0,
    productTypeOther:f.items?.[0]?.productTypeOther||"",
    originLotId:f.originLotId, originName:f.originName||"", originCompanyId:f.originCompanyId||"",
    originLat:f.originLat?parseFloat(f.originLat):null, originLng:f.originLng?parseFloat(f.originLng):null,
    fieldName:f.field?.name||"", isOwnFleet,
    destPlantId:f.destPlantId, destName:f.destName||"",
    destLat:f.destLat?parseFloat(f.destLat):null, destLng:f.destLng?parseFloat(f.destLng):null,
    loadDate:f.loadDate?.split("T")[0]||"", loadTime:f.loadTime||"",
    scheduledAt:f.scheduledAt||null,
    requestedBy:f.requestedById, requestedByName:f.requestedBy?.name||"",
    transporterId:a?.transportCompanyId||null, transporterName:a?.transportCompany?.name||"",
    driverName:a?.driver?.name||null, driverPhone:a?.driver?.phone||null,
    truckPlate:a?.truck?.plate||a?.plate||null, truckModel:a?.truck?.model||null,
    assignments:(f.assignments||[]).map(x=>({ id:x.id, status:x.status, transporterName:x.transportCompany?.name||"", reason:x.reason||null, createdAt:x.createdAt })),
    notes:f.notes||"", cancelReason:f.cancelReason||"", createdAt:f.createdAt,
    // Cross-confirmation timestamps
    transporterLoadedConfirmedAt: f.transporterLoadedConfirmedAt||null,
    producerLoadedConfirmedAt: f.producerLoadedConfirmedAt||null,
    transporterFinishedConfirmedAt: f.transporterFinishedConfirmedAt||null,
    plantFinishedConfirmedAt: f.plantFinishedConfirmedAt||null,
    loadedAt: f.loadedAt||null,
    documents: f.documents||[],
    conversationId: f.conversation?.id||null,
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
    pri:  { bg:C.pri, c:C.w, hbg:C.priLt },
    sec:  { bg:C.w,   c:C.pri, bd:C.b1 },
    err:  { bg:C.errPale, c:C.err },
    ghost:{ bg:"transparent", c:C.t2 },
    acc:  { bg:C.acc, c:C.w, hbg:C.accLt },
  };
  const vv = vs[v] || vs.pri;
  return <button disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, padding:sm?"8px 14px":"13px 22px", borderRadius:10, fontSize:sm?12:13.5, fontWeight:600, fontFamily:"inherit", background:disabled?"#E8ECE9":vv.bg, color:disabled?C.t3:vv.c, border:vv.bd?`1px solid ${vv.bd}`:"none", cursor:disabled?"not-allowed":"pointer", width:full?"100%":"auto", transition:"all 0.2s ease", minHeight:sm?36:44, WebkitTapHighlightColor:"transparent", touchAction:"manipulation", ...style }} onMouseEnter={e=>{if(!disabled&&vv.hbg)e.currentTarget.style.background=vv.hbg}} onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=disabled?"#E8ECE9":vv.bg}}>{icon&&<span style={{display:"flex",alignItems:"center"}}>{icon}</span>}{children}</button>;
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
          style={{ width:"100%", padding:"12px 14px", paddingRight:isPw?42:14, borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:16, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
          onFocus={e=>{e.target.style.borderColor=C.bFocus;}} onBlur={e=>{e.target.style.borderColor=C.b1;}} />
        {isPw && <button onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", display:"flex", padding:4 }}>{showPw?Ic.eye(C.t3,18):Ic.eyeOff(C.t3,18)}</button>}
      </div>
    </div>
  );
}

function Select({ label, icon, value, onChange, options, placeholder="Seleccionar..." }) {
  return (
    <div>
      {label && <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{icon} {label}</label>}
      <select value={value||""} onChange={e=>onChange(e.target.value)} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:value?C.t1:C.t3, fontSize:16, fontFamily:"inherit", cursor:"pointer", boxSizing:"border-box", appearance:"auto", minHeight:44 }}>
        <option value="" disabled>{placeholder}</option>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}{o.sub?` — ${o.sub}`:""}</option>)}
      </select>
    </div>
  );
}

function Toast({ msg, type="ok", onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return()=>clearTimeout(t); },[onClose]);
  const cfg = { ok:{bg:C.pri,ic:Ic.chk(C.w,16)}, err:{bg:C.err,ic:Ic.warn(C.w,16)}, info:{bg:C.info,ic:Ic.bell(C.w,16)} }[type]||{bg:C.pri,ic:Ic.chk(C.w,16)};
  return <div style={{ position:"fixed", top:"max(20px, env(safe-area-inset-top))", left:"50%", transform:"translateX(-50%)", zIndex:200, background:cfg.bg, color:C.w, padding:"11px 22px", borderRadius:12, fontSize:13, fontWeight:600, boxShadow:C.shLg, display:"flex", alignItems:"center", gap:8, animation:"fadeIn 0.3s ease", maxWidth:"calc(100vw - 40px)" }}>{cfg.ic} {msg}</div>;
}

// ======================== ATTACH MENU (action sheet) ==================

function AttachMenu({ open, onClose, onCamera, onGallery, onFiles }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:150, animation:"fadeIn 0.15s ease" }} />
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:151, background:C.w, borderRadius:"18px 18px 0 0", padding:"8px 16px max(16px, env(safe-area-inset-bottom))", boxShadow:"0 -4px 24px rgba(0,0,0,0.12)", animation:"sheetUp 0.2s ease" }}>
        <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
        <div style={{ width:36, height:4, borderRadius:2, background:C.b1, margin:"0 auto 12px" }} />
        <div style={{ fontSize:13, fontWeight:700, color:C.t1, marginBottom:12, textAlign:"center" }}>Adjuntar</div>
        {[
          { icon:Ic.cam(C.acc,22), label:"Tomar foto", sub:"Usar cámara del dispositivo", action:onCamera },
          { icon:Ic.img(C.pri,22), label:"Galería", sub:"Seleccionar de imágenes", action:onGallery },
          { icon:Ic.doc(C.info,22), label:"Archivo", sub:"PDF, DOC, imágenes y más", action:onFiles },
        ].map((opt,i) => (
          <button key={i} onClick={()=>{opt.action();onClose();}} style={{ display:"flex", alignItems:"center", gap:14, width:"100%", padding:"14px 12px", border:"none", borderRadius:12, background:"none", cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{opt.icon}</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.t1 }}>{opt.label}</div>
              <div style={{ fontSize:11, color:C.t3, marginTop:1 }}>{opt.sub}</div>
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{ width:"100%", padding:"13px 0", marginTop:4, border:"none", borderRadius:12, background:C.bg, fontSize:14, fontWeight:600, color:C.t2, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
      </div>
    </>
  );
}

// ======================== MEDIA QUERY HOOK ============================

function useIsDesktop(bp = 768) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= bp);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${bp}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [bp]);
  return isDesktop;
}

// ======================== DESKTOP SIDEBAR =============================

function Sidebar({ active, onChange, unread=0, pendingCount=0, canRequest=false, onNew }) {
  const hasPending = pendingCount > 0;
  const centerColor = hasPending ? C.acc : C.ok;
  const items = [
    { k:"home",    ic:a=>Ic.home(a?C.pri:C.t3,20),  l:"Inicio" },
    { k:"list",    ic:a=>Ic.truck(a?C.pri:C.t3,20),  l:"Fletes" },
    { k:"calendar",ic:a=>Ic.cal(a?C.pri:C.t3,20),    l:"Calendario" },
    { k:"chats",   ic:a=>Ic.msg(a?C.pri:C.t3,20),    l:"Chat", bd:unread },
    { k:"reports", ic:a=>Ic.doc(a?C.pri:C.t3,20),    l:"Informes" },
    { k:"profile", ic:a=>Ic.user(a?C.pri:C.t3,20),   l:"Perfil" },
  ];
  return (
    <div style={{ width:200, minWidth:200, height:"100%", background:C.w, borderRight:`1px solid ${C.b2}`, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
      {/* Logo */}
      <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${C.b2}` }}>
        <span style={{ fontSize:24, fontWeight:800, color:C.pri, letterSpacing:-0.8 }}>tolvink</span>
        <span style={{ width:6, height:6, borderRadius:3, background:C.acc, display:"inline-block", marginLeft:2, marginTop:-10 }}></span>
      </div>

      {/* Status + Solicitar */}
      <div style={{ padding:"14px 14px 10px" }}>
        <button onClick={()=>onChange("pending")} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10, border:"none", background:hasPending?`${C.acc}0D`:C.okPale, cursor:"pointer", fontFamily:"inherit", marginBottom:8, transition:"background 0.15s" }}>
          <div style={{ width:32, height:32, borderRadius:16, background:centerColor, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, position:"relative" }}>
            {hasPending ? Ic.bell(C.w,16) : Ic.chk(C.w,16)}
            {pendingCount>0 && <div style={{ position:"absolute", top:-3, right:-3, minWidth:15, height:15, borderRadius:8, background:C.err, color:C.w, fontSize:8, fontWeight:700, padding:"0 3px", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.w}` }}>{pendingCount}</div>}
          </div>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize:12, fontWeight:700, color:centerColor }}>{hasPending?"Pendientes":"Al día"}</div>
            <div style={{ fontSize:10, color:C.t3 }}>{pendingCount} acción{pendingCount!==1?"es":""}</div>
          </div>
        </button>
        {canRequest && (
          <button onClick={onNew} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 14px", borderRadius:10, background:C.acc, border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:`0 2px 8px ${C.acc}30`, transition:"transform 0.15s, box-shadow 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 12px ${C.acc}40`}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 2px 8px ${C.acc}30`}}>
            <style>{`@keyframes truckDrive{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}`}</style>
            <span style={{ display:"inline-flex", animation:"truckDrive 1.5s ease-in-out infinite" }}>{Ic.truck("#fff",16)}</span>
            <span style={{ fontSize:12.5, fontWeight:700, color:"#fff" }}>Solicitar flete</span>
          </button>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex:1, padding:"4px 8px", display:"flex", flexDirection:"column", gap:2 }}>
        {items.map(it => {
          const isActive = active === it.k;
          return (
            <button key={it.k} onClick={()=>onChange(it.k)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:"none", background:isActive?C.priPale:"transparent", cursor:"pointer", fontFamily:"inherit", position:"relative", transition:"background 0.15s", width:"100%" }} onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=C.priGhost}} onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background="transparent"}}>
              <span style={{display:"flex"}}>{it.ic(isActive)}</span>
              <span style={{ fontSize:13, fontWeight:isActive?700:500, color:isActive?C.pri:C.t2 }}>{it.l}</span>
              {it.bd>0 && <div style={{ marginLeft:"auto", minWidth:18, height:18, borderRadius:9, background:C.err, color:C.w, fontSize:9, fontWeight:700, padding:"0 5px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
              {isActive && <div style={{ position:"absolute", left:0, top:"20%", bottom:"20%", width:3, borderRadius:2, background:C.pri }} />}
            </button>
          );
        })}
      </div>

      {/* Bottom brand */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.b2}`, fontSize:9, color:C.t3, textAlign:"center" }}>
        Gestión de Fletes
      </div>
    </div>
  );
}

// ======================== BOTTOM NAV =================================

function Nav({ active, onChange, unread=0, pendingCount=0, canRequest=false, onNew }) {
  const hasPending = pendingCount > 0;
  const centerColor = hasPending ? C.acc : C.ok;
  const items = [
    { k:"home",   ic:a=>Ic.home(a?C.pri:C.t3,22),  l:"Inicio" },
    { k:"list",   ic:a=>Ic.truck(a?C.pri:C.t3,22),  l:"Fletes" },
    { k:"pending",sp:true, bd:pendingCount },
    { k:"chats",  ic:a=>Ic.msg(a?C.pri:C.t3,22),    l:"Chat", bd:unread },
    { k:"profile",ic:a=>Ic.user(a?C.pri:C.t3,22),   l:"Perfil" },
  ];
  return (
    <div style={{ display:"flex", borderTop:`1px solid ${C.b1}`, background:C.nav, paddingTop:2, paddingBottom:"max(4px, env(safe-area-inset-bottom))", flexShrink:0 }}>
      <style>{`@keyframes truckDrive{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}`}</style>
      {items.map(it=>(
        <button key={it.k} onClick={()=>onChange(it.k)} style={{ flex:it.sp&&canRequest?1.6:1, display:"flex", flexDirection:"column", alignItems:"center", gap:1, border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", position:"relative", padding:it.sp?"0":"5px 0", minHeight:42, WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
          {it.sp ? <>
            <div onClick={e=>{e.stopPropagation();onChange("pending")}} style={{ width:40, height:40, borderRadius:20, background:centerColor, display:"flex", alignItems:"center", justifyContent:"center", marginTop:-16, boxShadow:`0 3px 12px ${centerColor}40`, position:"relative", transition:"background 0.5s ease, box-shadow 0.5s ease" }}>
              {hasPending ? Ic.bell(C.w,18) : Ic.chk(C.w,18)}
              {it.bd>0 && <div style={{ position:"absolute", top:-4, right:-4, minWidth:16, height:16, borderRadius:8, background:C.err, color:C.w, fontSize:8, fontWeight:700, padding:"0 4px", display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.nav}` }}>{it.bd}</div>}
            </div>
            <span style={{ fontSize:7.5, fontWeight:700, color:centerColor, marginTop:1, transition:"color 0.5s ease" }}>{hasPending?"Pendientes":"Al día"}</span>
            {/* Solicitar — below status, same column */}
            {canRequest && (
              <div onClick={e=>{e.stopPropagation();onNew();}} style={{ display:"flex", alignItems:"center", gap:5, marginTop:2, padding:"6px 14px", borderRadius:20, background:C.acc, cursor:"pointer", boxShadow:`0 2px 8px ${C.acc}40` }}>
                <span style={{ display:"inline-flex", animation:"truckDrive 1.5s ease-in-out infinite" }}>{Ic.truck("#fff",15)}</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#fff", whiteSpace:"nowrap" }}>Solicitar flete</span>
              </div>
            )}
          </> : <>
            <span style={{display:"flex"}}>{it.ic(active===it.k)}</span>
            <span style={{ fontSize:9, fontWeight:active===it.k?700:500, color:active===it.k?C.pri:C.t3 }}>{it.l}</span>
            {it.bd>0 && <div style={{ position:"absolute", top:1, right:"20%", minWidth:14, height:14, borderRadius:7, background:C.err, color:C.w, fontSize:8, fontWeight:700, padding:"0 3px", display:"flex", alignItems:"center", justifyContent:"center" }}>{it.bd}</div>}
          </>}
        </button>
      ))}
    </div>
  );
}

// ======================== LANDING PAGE ================================

function LandingScreen({ onLogin, onSignup, loading, error, clearError }) {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) return <AuthScreen onLogin={onLogin} onSignup={onSignup} loading={loading} error={error} clearError={clearError} onBackToLanding={()=>setShowAuth(false)} />;

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:FONT, display:"flex", flexDirection:"column", overflow:"auto", WebkitOverflowScrolling:"touch" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;overflow:visible!important;overflow-x:hidden!important}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes splashIn{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}`}</style>

      {/* Main content — centered */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", textAlign:"center", paddingTop:"max(40px, env(safe-area-inset-top))" }}>

        {/* Big logo */}
        <div style={{ animation:"splashIn 0.8s ease-out", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"flex-start" }}>
            <span style={{ fontSize:84, fontWeight:800, color:C.pri, letterSpacing:-4, lineHeight:1 }}>tolvink</span>
            <span style={{ width:16, height:16, borderRadius:8, background:C.acc, marginLeft:5, marginTop:4, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Tagline */}
        <div style={{ animation:"fadeUp 0.8s ease-out", marginBottom:36 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.acc, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>
            Logística agrícola simplificada
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:C.t2, lineHeight:1, letterSpacing:-0.3, whiteSpace:"nowrap" }}>
            Gestioná tus fletes desde el campo
          </h1>
        </div>

        {/* 4 Features inline no boxes */}
        <div style={{ display:"flex", gap:28, justifyContent:"center", marginBottom:40, animation:"fadeUp 1s ease-out", flexWrap:"wrap" }}>
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

        {/* Ingresar button */}
        <div style={{ animation:"fadeUp 1.2s ease-out", display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
          <button onClick={()=>setShowAuth(true)} style={{ padding:"16px 48px", borderRadius:14, background:C.pri, color:C.w, fontSize:17, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"inherit", boxShadow:`0 4px 20px ${C.pri}30`, minWidth:220 }}>
            Ingresar
          </button>

          {/* WhatsApp icon only */}
          <a href="https://wa.me/59898247552?text=Hola%2C%20quiero%20información%20sobre%20Tolvink" target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", opacity:0.7 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        </div>
      </div>

      {/* Minimal footer */}
      <div style={{ textAlign:"center", padding:"16px 24px", paddingBottom:"max(16px, env(safe-area-inset-bottom))", fontSize:10, color:C.t3 }}>
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
      onLogin(loginId.replace(/[\s\-()]/g,''),pw);
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
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body,#root{margin:0;padding:0;background:${C.bg};height:auto!important;min-height:0!important;overflow:visible!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;position:static!important}input::placeholder,textarea::placeholder{color:${C.t3}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background:C.bg, fontFamily:FONT, maxWidth:430, margin:"0 auto", padding:"0 28px", boxSizing:"border-box" }}>
        <div style={{ paddingTop:mode==="signup"?"max(24px, env(safe-area-inset-top))":"28px", paddingBottom:"max(40px, env(safe-area-inset-bottom))", minHeight:mode==="login"?"100svh":"auto", display:"flex", flexDirection:"column", justifyContent:mode==="login"?"center":"flex-start" }}>
          <div style={{ textAlign:"center", marginBottom:mode==="login"?32:20 }}>
            {onBackToLanding && <button onClick={onBackToLanding} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4, margin:"0 auto 14px" }}>{Ic.chev(C.pri,18)} Volver</button>}
            <div style={{ display:"inline-flex", alignItems:"flex-start", animation:"fadeUp 0.6s ease-out" }}>
              <span style={{ fontSize:48, fontWeight:800, color:C.pri, letterSpacing:-2.5, lineHeight:1 }}>tolvink</span>
              <span style={{ width:10, height:10, borderRadius:5, background:C.acc, marginLeft:3, marginTop:2, display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }} />
            </div>
            <div style={{ fontSize:12, color:C.t2, marginTop:10, fontWeight:500, animation:"fadeUp 0.8s ease-out" }}>Logística agrícola simplificada</div>
          </div>
          <div style={{ background:C.w, borderRadius:16, padding:22, boxShadow:C.shMd, border:`1px solid ${C.b2}` }}>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:3, color:C.t1 }}>{mode==="login"?"Iniciar sesión":"Crear cuenta"}</div>
            <div style={{ fontSize:12.5, color:C.t2, marginBottom:18 }}>{mode==="login"?"Ingresá con email o teléfono":"Completá tus datos para registrarte"}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* === LOGIN MODE === */}
              {mode==="login" && <>
                <div>
                  <Field label="Email o teléfono" icon={Ic.mail(C.t2,14)} value={loginId} onChange={setLoginId} placeholder="tu@email.com o 09X XXX XXX"/>
                  {touched&&<FieldError error={errs.email}/>}
                </div>
                <div>
                  <Field label="Contraseña" icon={Ic.lock(C.t2,14)} value={pw} onChange={setPw} placeholder="••••••" type="password"/>
                  {touched&&<FieldError error={errs.pw}/>}
                </div>
              </>}

              {/* === SIGNUP MODE === */}
              {mode==="signup" && <>
                <div>
                  <Field label="Nombre completo" icon={Ic.user(C.t2,14)} value={name} onChange={setName} placeholder="Tu nombre completo"/>
                  {touched&&<FieldError error={errs.name}/>}
                </div>
                <div>
                  <Field label="Email" icon={Ic.mail(C.t2,14)} value={email} onChange={setEmail} placeholder="tu@email.com" type="email"/>
                  {touched&&<FieldError error={errs.email}/>}
                </div>
                <div>
                  <Field label="Celular" icon={Ic.phone(C.t2,14)} value={phone} onChange={handlePhone} placeholder="09X XXX XXX" type="tel"/>
                  {touched&&<FieldError error={errs.phone}/>}
                </div>
                <div>
                  <Field label="Contraseña" icon={Ic.lock(C.t2,14)} value={pw} onChange={setPw} placeholder="Mínimo 4 caracteres" type="password"/>
                  {touched&&<FieldError error={errs.pw}/>}
                </div>

                {/* Multi-select user types */}
                <div>
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
                </div>
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
      </div>
    </>
  );
}

// ======================== TABLE SORT HOOK =============================
function useTableSort() {
  // sortCol: column key, sortDir: "asc"|"desc"|null, cycle: asc→desc→null
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const toggle = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
  };
  const sortData = useCallback((data, getters) => {
    if (!sortCol || !sortDir || !getters[sortCol]) return data;
    const getter = getters[sortCol];
    return [...data].sort((a, b) => {
      let va = getter(a), vb = getter(b);
      // Detect type
      if (va == null) va = "";
      if (vb == null) vb = "";
      // Numbers
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      // Dates (YYYY-MM-DD or DD/MM/YYYY)
      const da = new Date(va), db = new Date(vb);
      if (!isNaN(da) && !isNaN(db) && String(va).length > 4) return sortDir === "asc" ? da - db : db - da;
      // Strings
      const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
      const cmp = sa.localeCompare(sb, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortCol, sortDir]);
  return { sortCol, sortDir, toggle, sortData };
}

function SortTh({ label, colKey, sortCol, sortDir, onSort }) {
  const active = sortCol === colKey;
  const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th onClick={() => onSort(colKey)} style={{ padding:"8px 6px", textAlign:"left", fontWeight:700, color: active ? C.pri : C.t2, fontSize:10, whiteSpace:"nowrap", borderBottom:`1px solid ${C.b1}`, cursor:"pointer", userSelect:"none" }}>
      {label}{arrow && <span style={{ color: C.pri, fontWeight: 800 }}>{arrow}</span>}
    </th>
  );
}

// ======================== HOME SCREEN ================================

// CSV Export helper
function exportCSV(freights, filename) {
  const headers = ["Código","Estado","Productor","Origen","Destino","Producto","Cantidad","Unidad","Camión","Fecha Carga","Hora","Transportista","Notas"];
  const rows = freights.map(f => {
    const st = stCfg(f.status);
    const fmtDate = f.loadDate ? f.loadDate.slice(8,10)+"-"+f.loadDate.slice(5,7)+"-"+f.loadDate.slice(2,4) : "";
    return [f.code, st.label, f.requestedByName||"", (f.originName||"").split("—")[0].trim(), f.destName, f.grain, f.tons, f.unit||"tn", f.truckPlate||"", fmtDate, f.loadTime, f.transporterName||"", (f.notes||"").replace(/[\n\r]+/g," ")];
  });
  const escape = v => { const s = String(v||""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename || "tolvink-fletes.csv"; a.click();
  URL.revokeObjectURL(url);
}

function HomeScreen({ user, freights, perms, onNav, catalog, isDesktop }) {
  const [activePanel, setActivePanel] = useState(null); // null | "map" | "pending" | "calendar" | "reports" | "fields" | "trucks"

  const FILTER_MAP = {
    requested: ["draft","pending_assignment"],
    active: ["assigned","accepted","in_progress","loaded"],
    done: ["finished"],
  };

  const stats = useMemo(()=>{
    const avail = freights.filter(f=>FILTER_MAP.requested.includes(f.status)).length;
    const active = freights.filter(f=>FILTER_MAP.active.includes(f.status)).length;
    const done = freights.filter(f=>f.status==="finished").length;
    return {avail,active,done};
  },[freights]);

  const displayFreights = useMemo(()=>freights.filter(f=>!["canceled","draft"].includes(f.status)),[freights]);

  const tc = ({plant:C.pri,transporter:C.info,producer:C.acc})[user.userType]||C.pri;
  const typeLabel = ({plant:"Planta de Acopio",transporter:"Transportista",producer:"Productor"})[user.userType];

  const statCards = [
    {k:"requested",l:"Solicitados",v:stats.avail,c:C.acc,bg:C.accPale},
    {k:"active",l:"En curso",v:stats.active,c:"#258B3E",bg:"#D0EBD7"},
    {k:"done",l:"Finalizados",v:stats.done,c:C.pri,bg:C.priPale},
  ];

  const togglePanel = (key) => setActivePanel(prev=>prev===key?null:key);

  // Quick access items
  const quickItems = [
    {k:"map",l:"Abrir mapa",ic:Ic.pin,c:C.pri,show:true},
    {k:"pending",l:"Asignar fletes",ic:Ic.bell,c:C.acc,show:perms.canApprove&&stats.avail>0},
    {k:"calendar",l:"Calendario",ic:Ic.cal,c:C.sec,show:true},
    {k:"reports",l:"Informes y Documentos",ic:Ic.doc,c:"#7C3AED",show:true},
    {k:"fields",l:"Campos y Lotes",ic:Ic.seedling,c:C.pri,show:user.userType==="producer"},
    {k:"trucks",l:"Flota",ic:Ic.truck,c:C.acc,show:user.userType==="transporter"||user.userType==="producer"},
  ].filter(b=>b.show);

  // --- Left column: greeting + stats + quick access ---
  const leftPanel = (
    <div style={{ width:isDesktop&&activePanel?280:undefined, flexShrink:0, overflow:"auto", padding:"0 18px 18px 18px", boxSizing:"border-box" }}>
      {/* Greeting */}
      <div style={{ padding:"18px 0 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:13, color:C.t2 }}>Hola,</div><div style={{ fontSize:isDesktop&&activePanel?18:22, fontWeight:800, letterSpacing:-0.3, color:C.t1 }}>{user.name.split(" ")[0]}</div></div>
          {!(isDesktop&&activePanel) && <div style={{ textAlign:"right" }}><Bd color={tc}>{typeLabel}</Bd><div style={{ fontSize:10, color:C.t3, marginTop:4 }}>{user.role==="admin"?"Gerente":"Operario"} · {user.entity}</div></div>}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:isDesktop&&activePanel?"1fr":"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
        {statCards.map(s=>(
          <div key={s.k} onClick={()=>onNav("list")} style={{ background:s.bg, borderRadius:10, padding:isDesktop&&activePanel?"8px 10px":"10px 8px", textAlign:"center", cursor:"pointer", transition:"all 0.2s ease", border:"2px solid transparent" }}>
            <div style={{ fontSize:isDesktop&&activePanel?18:24, fontWeight:800, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:9.5, color:s.c, fontWeight:500, marginTop:1, opacity:0.8 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {perms.canApprove && stats.avail>0 && (
        <div onClick={()=>togglePanel("pending")} style={{ background:C.accPale, border:`1px solid ${C.acc}22`, borderLeft:`3px solid ${C.acc}`, borderRadius:10, padding:12, marginBottom:12, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
          {Ic.warn(C.acc,20)}<div><div style={{ fontSize:12, fontWeight:700, color:C.acc }}>{stats.avail} pendiente{stats.avail>1?"s":""}</div><div style={{ fontSize:10.5, color:C.t2 }}>Esperando asignación</div></div>
        </div>
      )}

      {/* Quick access — vertical list */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2 }}>Accesos rápidos</div>
        {quickItems.map(b=>{
          const isActive = activePanel===b.k;
          return (
            <button key={b.k} onClick={()=>togglePanel(b.k)} style={{ display:"flex", alignItems:"center", gap:10, padding:isDesktop&&activePanel?"9px 10px":"11px 14px", borderRadius:10, background:isActive?`${b.c}12`:C.w, border:`1px solid ${isActive?`${b.c}40`:C.b1}`, cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"left", transition:"all 0.15s", boxShadow:isActive?"none":C.sh }} onMouseEnter={e=>{if(!isActive){e.currentTarget.style.background=C.priGhost;e.currentTarget.style.borderColor=`${b.c}40`}}} onMouseLeave={e=>{if(!isActive){e.currentTarget.style.background=C.w;e.currentTarget.style.borderColor=C.b1}}}>
              <div style={{ width:isDesktop&&activePanel?28:34, height:isDesktop&&activePanel?28:34, borderRadius:8, background:isActive?`${b.c}22`:`${b.c}12`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{b.ic(b.c,isDesktop&&activePanel?14:17)}</div>
              <span style={{ fontSize:isDesktop&&activePanel?11.5:13, fontWeight:isActive?700:600, color:isActive?b.c:C.t1, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.l}</span>
              {!isActive && <span style={{ display:"flex", transform:"rotate(180deg)", flexShrink:0 }}>{Ic.chev(C.t3,14)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  // --- Right column: dynamic panel content ---
  const rightPanel = activePanel ? (
    <div style={{ flex:1, overflow:"auto", borderLeft:isDesktop?`1px solid ${C.b1}`:"none", animation:"fadeIn 0.2s ease", minWidth:0 }}>
      <div style={{ padding:18 }}>
        {/* Panel header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:`${quickItems.find(q=>q.k===activePanel)?.c||C.pri}12`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {quickItems.find(q=>q.k===activePanel)?.ic(quickItems.find(q=>q.k===activePanel)?.c||C.pri,16)}
            </div>
            <span style={{ fontSize:16, fontWeight:800, color:C.t1 }}>{quickItems.find(q=>q.k===activePanel)?.l||""}</span>
          </div>
          <button onClick={()=>setActivePanel(null)} style={{ background:C.bgCardAlt, border:`1px solid ${C.b1}`, borderRadius:8, padding:"6px 8px", cursor:"pointer", display:"flex", alignItems:"center", fontFamily:"inherit" }}>{Ic.cross(C.t2,16)}</button>
        </div>

        {/* Panel content */}
        {activePanel==="map" && <HomeMapView freights={displayFreights} onNav={onNav} />}
        {activePanel==="pending" && <PendingScreen user={user} freights={freights} onNav={onNav} onNewFreight={()=>onNav("new")} embedded />}
        {activePanel==="calendar" && <HomeCalendarPanel freights={freights} perms={perms} onNav={onNav} />}
        {activePanel==="reports" && <ReportsScreen onBack={()=>setActivePanel(null)} freights={freights} isDesktop={false} embedded />}
        {activePanel==="fields" && <FieldsScreen onBack={()=>setActivePanel(null)} embedded />}
        {activePanel==="trucks" && <TrucksScreen onBack={()=>setActivePanel(null)} embedded />}
      </div>
    </div>
  ) : null;

  // --- Desktop split or Mobile stacked ---
  if(isDesktop) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"row", overflow:"hidden" }}>
        <div style={{ width:activePanel?280:undefined, flex:activePanel?undefined:1, overflow:"auto", transition:"width 0.2s ease" }}>
          {leftPanel}
        </div>
        {rightPanel}
      </div>
    );
  }

  // Mobile: if panel active, show panel fullscreen with back button
  if(activePanel) {
    return (
      <div style={{ flex:1, overflow:"auto" }}>
        <div style={{ padding:18 }}>
          <button onClick={()=>setActivePanel(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0, marginBottom:12 }}>
            {Ic.chev(C.pri,18)}
            <span style={{ fontSize:14, fontWeight:700, color:C.pri }}>Inicio</span>
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:`${quickItems.find(q=>q.k===activePanel)?.c||C.pri}12`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {quickItems.find(q=>q.k===activePanel)?.ic(quickItems.find(q=>q.k===activePanel)?.c||C.pri,16)}
            </div>
            <span style={{ fontSize:16, fontWeight:800, color:C.t1 }}>{quickItems.find(q=>q.k===activePanel)?.l||""}</span>
          </div>
          {activePanel==="map" && <HomeMapView freights={displayFreights} onNav={onNav} />}
          {activePanel==="pending" && <PendingScreen user={user} freights={freights} onNav={onNav} onNewFreight={()=>onNav("new")} embedded />}
          {activePanel==="calendar" && <HomeCalendarPanel freights={freights} perms={perms} onNav={onNav} />}
          {activePanel==="reports" && <ReportsScreen onBack={()=>setActivePanel(null)} freights={freights} isDesktop={false} embedded />}
          {activePanel==="fields" && <FieldsScreen onBack={()=>setActivePanel(null)} embedded />}
          {activePanel==="trucks" && <TrucksScreen onBack={()=>setActivePanel(null)} embedded />}
        </div>
      </div>
    );
  }

  // Mobile: default dashboard
  return (
    <div style={{ flex:1, overflow:"auto" }}>
      {leftPanel}
    </div>
  );
}

// Inline calendar panel for Home dashboard
function HomeCalendarPanel({ freights, perms, onNav }) {
  const [calMonth, setCalMonth] = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()}});
  const [calSelDay, setCalSelDay] = useState(null);
  const monNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const filtered = useMemo(()=>freights.filter(f=>!["canceled","draft"].includes(f.status)),[freights]);
  const days=useMemo(()=>{const arr=[];const first=new Date(calMonth.y,calMonth.m,1);const lastDay=new Date(calMonth.y,calMonth.m+1,0).getDate();const startDow=(first.getDay()+6)%7;for(let i=0;i<startDow;i++)arr.push(null);for(let d=1;d<=lastDay;d++)arr.push(d);return arr;},[calMonth]);
  const byDay=useMemo(()=>{const map={};filtered.forEach(f=>{if(!f.loadDate)return;const dd=parseInt(f.loadDate.slice(8,10),10);const mm=parseInt(f.loadDate.slice(5,7),10)-1;const yy=parseInt(f.loadDate.slice(0,4),10);if(yy===calMonth.y&&mm===calMonth.m){if(!map[dd])map[dd]=[];map[dd].push(f);}});return map;},[filtered,calMonth]);
  const selFreights=calSelDay?byDay[calSelDay]||[]:[];
  const today=new Date();const isToday=(d)=>d===today.getDate()&&calMonth.m===today.getMonth()&&calMonth.y===today.getFullYear();

  return <div>
    <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:14,boxShadow:C.sh,marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <button onClick={()=>{setCalMonth(p=>p.m===0?{y:p.y-1,m:11}:{y:p.y,m:p.m-1});setCalSelDay(null);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex"}}>{Ic.chev(C.pri,20)}</button>
        <span style={{fontSize:15,fontWeight:700,color:C.t1}}>{monNames[calMonth.m]} {calMonth.y}</span>
        <button onClick={()=>{setCalMonth(p=>p.m===11?{y:p.y+1,m:0}:{y:p.y,m:p.m+1});setCalSelDay(null);}} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",transform:"rotate(180deg)"}}>{Ic.chev(C.pri,20)}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center"}}>
        {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{fontSize:9,fontWeight:700,color:C.t3,padding:4}}>{d}</div>)}
        {days.map((d,i)=>{if(!d)return<div key={`e${i}`}/>;const cnt=byDay[d]?.length||0;const sel=calSelDay===d;const td=isToday(d);const statuses=byDay[d]?.map(f=>stCfg(f.status).color)||[];
          return <div key={d} onClick={()=>setCalSelDay(sel?null:d)} style={{padding:"6px 2px",borderRadius:8,cursor:"pointer",background:sel?C.pri:td?C.priPale:"transparent",transition:"background 0.15s",minHeight:36}}>
            <div style={{fontSize:12,fontWeight:sel||td?700:400,color:sel?C.w:td?C.pri:C.t1}}>{d}</div>
            {cnt>0&&<div style={{display:"flex",gap:2,justifyContent:"center",marginTop:2}}>{statuses.slice(0,3).map((c,j)=><div key={j} style={{width:5,height:5,borderRadius:3,background:sel?"#fff":c}}/>)}{cnt>3&&<div style={{fontSize:7,color:sel?C.w:C.t3}}>+</div>}</div>}
          </div>;})}
      </div>
    </div>
    {calSelDay&&<div style={{animation:"fadeIn 0.15s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:13,fontWeight:700,color:C.t1}}>{calSelDay} de {monNames[calMonth.m]} — {selFreights.length} flete{selFreights.length!==1?"s":""}</span>
        {perms.canRequest&&<Btn sm v="acc" icon={Ic.plus(C.w,12)} onClick={()=>{const dd=String(calSelDay).padStart(2,"0");const mm=String(calMonth.m+1).padStart(2,"0");onNav("new_date",`${calMonth.y}-${mm}-${dd}`)}}>Nuevo</Btn>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {selFreights.map(f=>{const st=stCfg(f.status);return <div key={f.id} className="tv-card" onClick={()=>onNav("detail",f.id)} style={{background:C.w,border:`1px solid ${C.b1}`,borderLeft:`3px solid ${st.border}`,borderRadius:10,padding:12,cursor:"pointer",boxShadow:C.sh}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:10,fontWeight:700,color:C.t3,fontFamily:MONO}}>{f.code}</span><Bd color={st.color} bg={st.bg} small>{st.label}</Bd></div>
          <div style={{fontSize:13,fontWeight:700,color:C.t1}}>{f.grain} · {f.tons} tn</div>
          <div style={{fontSize:10.5,color:C.t2,marginTop:3}}>{(f.originName||"").split("—")[0].trim()} → {f.destName}</div>
          <div style={{fontSize:10,color:C.t3,marginTop:3}}>{f.loadTime||""}{f.transporterName?` · ${f.transporterName}`:""}</div>
        </div>})}
        {selFreights.length===0&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:12}}>Sin fletes este día</div>}
      </div>
    </div>}
  </div>;
}

function HomeMapView({ freights, onNav }) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fStatus, setFStatus] = useState("");
  const [fPlant, setFPlant] = useState("");
  const [fTransp, setFTransp] = useState("");
  const [fProd, setFProd] = useState("");
  const [fDate, setFDate] = useState("");

  const filteredMF = useMemo(()=>{
    let ff=freights;
    if(fStatus)ff=ff.filter(f=>f.status===fStatus);
    if(fPlant)ff=ff.filter(f=>f.destName===fPlant);
    if(fTransp)ff=ff.filter(f=>f.transporterName===fTransp);
    if(fProd)ff=ff.filter(f=>f.requestedByName===fProd);
    if(fDate)ff=ff.filter(f=>f.loadDate===fDate);
    return ff;
  },[freights,fStatus,fPlant,fTransp,fProd,fDate]);

  const plantOpts = useMemo(()=>[...new Set(freights.map(f=>f.destName).filter(Boolean))].sort(),[freights]);
  const transpOpts = useMemo(()=>[...new Set(freights.map(f=>f.transporterName).filter(Boolean))].sort(),[freights]);
  const prodOpts = useMemo(()=>[...new Set(freights.map(f=>f.requestedByName).filter(Boolean))].sort(),[freights]);
  const hasFilters = fStatus||fPlant||fTransp||fProd||fDate;
  const clearAll = ()=>{setFStatus("");setFPlant("");setFTransp("");setFProd("");setFDate("");};

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    (async () => {
      const maps = await loadGMaps();
      if (cancelled) return;
      const bounds = new maps.LatLngBounds();
      let hasPoints = false;
      const center = { lat: -34.6, lng: -56.2 };

      const map = new maps.Map(mapRef.current, {
        zoom: 6, center, disableDefaultUI: true, zoomControl: true,
        gestureHandling: "greedy", mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });

      filteredMF.forEach(f => {
        const oLat = parseFloat(f.originLat); const oLng = parseFloat(f.originLng);
        const dLat = parseFloat(f.destLat); const dLng = parseFloat(f.destLng);
        const st = stCfg(f.status);

        if (oLat && oLng) {
          bounds.extend({ lat: oLat, lng: oLng });
          hasPoints = true;
          const m = new maps.Marker({ position: { lat: oLat, lng: oLng }, map, title: `${f.code} — Origen`, icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: st.color, fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 2 } });
          m.addListener("click", () => onNav("detail", f.id));
        }
        if (dLat && dLng) {
          bounds.extend({ lat: dLat, lng: dLng });
          hasPoints = true;
          const m = new maps.Marker({ position: { lat: dLat, lng: dLng }, map, title: `${f.code} — Destino`, icon: { path: maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 5, fillColor: st.color, fillOpacity: 0.9, strokeColor: "#fff", strokeWeight: 2 } });
          m.addListener("click", () => onNav("detail", f.id));
        }
        if (oLat && oLng && dLat && dLng) {
          new maps.Polyline({ path: [{ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng }], map, strokeColor: st.color, strokeOpacity: 0.5, strokeWeight: 2 });
        }
      });

      if (hasPoints) map.fitBounds(bounds, 40);
      setMapReady(true);
    })();
    return () => { cancelled = true; };
  }, [filteredMF]);

  const wrapStyle = fullscreen ? { position:"fixed", inset:0, zIndex:200, background:C.bg, display:"flex", flexDirection:"column" } : { borderRadius: 12, overflow: "hidden", border: `1px solid ${C.b1}`, boxShadow: C.sh };

  return (
    <div style={wrapStyle}>
      {/* Filters bar */}
      <div style={{ padding:fullscreen?"10px 16px":"6px 12px", background:C.w, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", borderBottom:`1px solid ${C.b2}` }}>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${C.b1}`, fontSize:10, background:C.w, color:fStatus?C.t1:C.t3, fontFamily:"inherit" }}>
          <option value="">Estado</option>
          <option value="pending_assignment">Solicitado</option><option value="assigned">Asignado</option><option value="accepted">Aceptado</option><option value="in_progress">En viaje</option><option value="loaded">Cargado</option><option value="finished">Finalizado</option>
        </select>
        <select value={fPlant} onChange={e=>setFPlant(e.target.value)} style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${C.b1}`, fontSize:10, background:C.w, color:fPlant?C.t1:C.t3, fontFamily:"inherit" }}>
          <option value="">Planta</option>
          {plantOpts.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {transpOpts.length>0&&<select value={fTransp} onChange={e=>setFTransp(e.target.value)} style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${C.b1}`, fontSize:10, background:C.w, color:fTransp?C.t1:C.t3, fontFamily:"inherit" }}>
          <option value="">Transportista</option>
          {transpOpts.map(t=><option key={t} value={t}>{t}</option>)}
        </select>}
        {prodOpts.length>0&&<select value={fProd} onChange={e=>setFProd(e.target.value)} style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${C.b1}`, fontSize:10, background:C.w, color:fProd?C.t1:C.t3, fontFamily:"inherit" }}>
          <option value="">Productor</option>
          {prodOpts.map(p=><option key={p} value={p}>{p}</option>)}
        </select>}
        <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${C.b1}`, fontSize:10, background:C.w, color:fDate?C.t1:C.t3, fontFamily:"inherit", cursor:"pointer" }}/>
        {hasFilters&&<button onClick={clearAll} style={{ background:"none", border:"none", fontSize:10, color:C.err, fontWeight:600, cursor:"pointer", fontFamily:"inherit", padding:"2px 4px" }}>Limpiar</button>}
        <span style={{ fontSize:10, color:C.t3, marginLeft:"auto" }}>{filteredMF.length} fletes</span>
        <button onClick={()=>setFullscreen(!fullscreen)} style={{ background:C.priPale, border:`1px solid ${C.pri}20`, borderRadius:6, padding:"5px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600, color:C.pri, fontFamily:"inherit" }}>
          {fullscreen?Ic.collapse(C.pri,12):Ic.expand(C.pri,12)} {fullscreen?"Cerrar":"Expandir"}
        </button>
      </div>
      <div ref={mapRef} style={{ width: "100%", flex:fullscreen?1:undefined, height: fullscreen?undefined:350 }} />
      {!mapReady && <div style={{ textAlign: "center", padding: 20, fontSize: 12, color: C.t3 }}>Cargando mapa...</div>}
      <div style={{ padding: "6px 12px", background: C.w, fontSize: 10, color: C.t3, display: "flex", gap: 12 }}>
        <span>● Origen</span> <span>▼ Destino</span> <span>— Ruta</span>
      </div>
    </div>
  );
}

// ======================== PULL TO REFRESH =============================

function usePullToRefresh(onRefresh) {
  const containerRef = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullDist = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop <= 0) startY.current = e.touches[0].clientY;
      else startY.current = 0;
    };
    const onTouchMove = (e) => {
      if (!startY.current || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 10 && el.scrollTop <= 0) {
        pullDist.current = Math.min(diff, 100);
        setPulling(pullDist.current > 50);
      }
    };
    const onTouchEnd = async () => {
      if (pulling && !refreshing) {
        setRefreshing(true);
        setPulling(false);
        try { await onRefresh(); } catch {}
        setRefreshing(false);
      }
      startY.current = 0;
      pullDist.current = 0;
      setPulling(false);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, pulling, refreshing]);

  const indicator = (refreshing || pulling) ? (
    <div style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600, color: refreshing ? C.pri : C.t3 }}>
      {refreshing ? "Actualizando..." : "Soltar para actualizar"}
    </div>
  ) : null;

  return { containerRef, indicator, refreshing };
}

// ======================== FREIGHT LIST ================================

function ListScreen({ freights, onNav, onRefresh }) {
  const [tab, setTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [fPlant, setFPlant] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // cards | table | map
  const sort = useTableSort();
  const LIST_GETTERS = { code:f=>f.code, status:f=>stCfg(f.status).label, producer:f=>f.requestedByName||"", origin:f=>(f.originName||"").split("—")[0].trim(), dest:f=>f.destName, product:f=>f.grain, qty:f=>f.tons, truck:f=>f.truckPlate||"", date:f=>f.loadDate };

  const plantOptions = useMemo(()=>[...new Set(freights.map(f=>f.destName).filter(Boolean))].sort(),[freights]);

  // Date preset handler
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

  const filtered = useMemo(()=>{
    return freights.filter(f=>{
      if(tab==="available" && f.status!=="pending_assignment") return false;
      if(tab==="active" && !["assigned","accepted","in_progress","loaded"].includes(f.status)) return false;
      if(tab==="done" && f.status!=="finished") return false;
      if(tab==="closed" && f.status!=="canceled") return false;
      if(searchQ && !textMatch(f.requestedByName,searchQ) && !textMatch(f.code,searchQ) && !textMatch(f.grain,searchQ) && !textMatch(f.originName,searchQ) && !textMatch(f.destName,searchQ) && !textMatch(f.transporterName,searchQ)) return false;
      if(fPlant && f.destName!==fPlant) return false;
      if(dateFrom && f.loadDate < dateFrom) return false;
      if(dateTo && f.loadDate > dateTo) return false;
      return true;
    });
  },[freights,tab,searchQ,fPlant,dateFrom,dateTo]);

  const activeFilters = [fPlant,searchQ,dateFrom,dateTo].filter(Boolean).length;
  const { containerRef, indicator } = usePullToRefresh(onRefresh);

  return (
    <div ref={containerRef} style={{ flex:1, overflow:"auto", padding:18, WebkitOverflowScrolling:"touch" }}>
      {indicator}
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

          {/* Date presets */}
          <label style={{fontSize:10,fontWeight:600,color:C.t2,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6,display:"block"}}>Fecha de carga</label>
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {[{k:"",l:"Todas"},{k:"today",l:"Hoy"},{k:"week",l:"Última semana"},{k:"month",l:"Último mes"},{k:"quarter",l:"3 meses"},{k:"custom",l:"Personalizado"}].map(p=>(
              <button key={p.k} onClick={()=>{ if(p.k==="custom"){setDatePreset("custom");}else applyDatePreset(p.k);}} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${datePreset===p.k?C.pri:C.b1}`,background:datePreset===p.k?C.priPale:C.w,color:datePreset===p.k?C.pri:C.t2,fontSize:10.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>
            ))}
          </div>

          {/* Custom date range */}
          {datePreset==="custom" && (
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <div style={{flex:1}}>
                <label style={{fontSize:9,fontWeight:600,color:C.t3,display:"block",marginBottom:3}}>Desde</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{width:"100%",padding:"7px 8px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:9,fontWeight:600,color:C.t3,display:"block",marginBottom:3}}>Hasta</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} onClick={e=>e.target.showPicker?.()} style={{width:"100%",padding:"7px 8px",borderRadius:8,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"}}/>
              </div>
            </div>
          )}

          {activeFilters>0 && <button onClick={()=>{setFPlant("");setSearchQ("");setDateFrom("");setDateTo("");setDatePreset("");}} style={{fontSize:11,color:C.pri,fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>Limpiar filtros</button>}
        </div>
      )}

      <Tabs items={[{k:"all",l:"Todos"},{k:"available",l:"Solicitados"},{k:"active",l:"Activos"},{k:"done",l:"Finalizados"},{k:"closed",l:"Cerrados"}]} active={tab} onChange={setTab}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,marginBottom:6}}>
        <div style={{fontSize:11,color:C.t3}}>{filtered.length} resultado{filtered.length!==1?"s":""}</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {viewMode==="table" && <>
            <span style={{ fontSize:10, color:C.t3, whiteSpace:"nowrap" }}>Descargar información</span>
            <button onClick={()=>exportCSV(filtered,`tolvink-fletes-${new Date().toISOString().slice(0,10)}.csv`)} style={{ display:"flex", alignItems:"center", gap:4, background:C.accPale, border:`1px solid ${C.acc}20`, borderRadius:8, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:600, color:C.acc }}>
              {Ic.down(C.acc,12)} CSV
            </button>
          </>}
          <span style={{ fontSize:10, color:C.t3, whiteSpace:"nowrap" }}>Cambiar visualización</span>
          <button onClick={()=>setViewMode(v=>v==="cards"?"table":v==="table"?"map":"cards")} style={{ display:"flex", alignItems:"center", gap:4, background:C.priPale, border:`1px solid ${C.pri}20`, borderRadius:8, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:600, color:C.pri }}>
            {viewMode==="table"?Ic.doc(C.pri,12):viewMode==="map"?Ic.pin(C.pri,12):Ic.home(C.pri,12)} {viewMode==="cards"?"Tabla":viewMode==="table"?"Mapa":"Tarjetas"}
          </button>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode==="table" && (
        <div style={{ overflowX:"auto", borderRadius:10, border:`1px solid ${C.b1}`, background:C.w }}>
          <table className="tv-table" style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ background:C.bg }}>
                {[["Código","code"],["Estado","status"],["Productor","producer"],["Origen","origin"],["Destino","dest"],["Producto","product"],["Cant.","qty"],["Camión","truck"],["Fecha","date"]].map(([h,k])=>(
                  <SortTh key={k} label={h} colKey={k} sortCol={sort.sortCol} sortDir={sort.sortDir} onSort={sort.toggle}/>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={9} style={{ padding:24, textAlign:"center", color:C.t3 }}>Sin fletes</td></tr>}
              {sort.sortData(filtered, LIST_GETTERS).map(f=>{
                const st = stCfg(f.status);
                const fmtDate = f.loadDate ? f.loadDate.slice(8,10)+"-"+f.loadDate.slice(5,7)+"-"+f.loadDate.slice(2,4) : "";
                return (
                  <tr key={f.id} className="tv-row" onClick={()=>onNav("detail",f.id)} style={{ cursor:"pointer", borderBottom:`1px solid ${C.b2}` }}>
                    <td style={{ padding:"7px 6px", fontFamily:MONO, fontWeight:600, color:C.t1, whiteSpace:"nowrap" }}>{f.code}</td>
                    <td style={{ padding:"7px 6px" }}><Bd color={st.color} bg={st.bg} small>{st.label}</Bd></td>
                    <td style={{ padding:"7px 6px", color:C.t2, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.requestedByName||"-"}</td>
                    <td style={{ padding:"7px 6px", color:C.t2, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(f.originName||"").split("—")[0].trim()}</td>
                    <td style={{ padding:"7px 6px", color:C.t2, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.destName}</td>
                    <td style={{ padding:"7px 6px", fontWeight:600, color:C.t1, whiteSpace:"nowrap" }}>{f.grain}</td>
                    <td style={{ padding:"7px 6px", fontWeight:600, color:C.t1, whiteSpace:"nowrap" }}>{f.tons} tn</td>
                    <td style={{ padding:"7px 6px", color:C.t3, whiteSpace:"nowrap" }}>{f.truckPlate||"-"}</td>
                    <td style={{ padding:"7px 6px", color:C.t3, whiteSpace:"nowrap" }}>{fmtDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CARDS VIEW — filtered (single status) */}
      {viewMode==="cards" && tab!=="all" && (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }} className="tv-grid">
        {filtered.length===0 && <div style={{ textAlign:"center", padding:40, color:C.t3, fontSize:13, gridColumn:"1/-1" }}>Sin fletes en esta categoría</div>}
        {filtered.map((f,idx)=>{
          const st = stCfg(f.status);
          return (
          <div key={f.id} className="tv-card" onClick={()=>onNav("detail",f.id)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderLeft:`3px solid ${st.border}`, borderRadius:12, padding:14, cursor:"pointer", boxShadow:C.sh, animation:`cardIn 0.3s ease ${idx*0.04}s both` }}>
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
      )}

      {/* KANBAN COLUMNS — when tab=all */}
      {viewMode==="cards" && tab==="all" && (()=>{
        const cols = [
          { key:"available", label:"Solicitados", color:C.acc, bg:C.accPale, statuses:["pending_assignment"] },
          { key:"active", label:"En curso", color:"#258B3E", bg:"#D0EBD7", statuses:["assigned","accepted","in_progress","loaded"] },
          { key:"done", label:"Finalizados", color:C.pri, bg:C.priPale, statuses:["finished"] },
        ];
        return <div className="tv-kanban" style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {cols.map(col=>{
            const items = filtered.filter(f=>col.statuses.includes(f.status));
            return <div key={col.key} style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"8px 12px", background:col.bg, borderRadius:8, borderLeft:`3px solid ${col.color}`, flexShrink:0 }}>
                <span style={{ fontSize:12, fontWeight:700, color:col.color }}>{col.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:col.color, opacity:0.7 }}>({items.length})</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                {items.length===0 && <div style={{ textAlign:"center", padding:16, color:C.t3, fontSize:11, background:C.w, borderRadius:8, border:`1px dashed ${C.b1}` }}>Sin fletes</div>}
                {items.map((f,idx)=>{
                  const st = stCfg(f.status);
                  return <div key={f.id} className="tv-card" onClick={()=>onNav("detail",f.id)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderLeft:`3px solid ${st.border}`, borderRadius:10, padding:12, cursor:"pointer", boxShadow:C.sh, animation:`cardIn 0.3s ease ${idx*0.03}s both` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:C.t3, fontFamily:MONO }}>{f.code}</span>
                      <Bd color={st.color} bg={st.bg} small>{st.label}</Bd>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.t1 }}>{f.grain} · {f.tons} tn</div>
                    <div style={{ fontSize:10.5, color:C.t2, marginTop:3 }}>{(f.originName||"").split("—")[0].trim()} → {f.destName}</div>
                    <div style={{ fontSize:10, color:C.t3, marginTop:3 }}>{Ic.cal(C.t3,10)} {f.loadDate}{f.transporterName?` · ${f.transporterName}`:""}</div>
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>;
      })()}

      {/* MAP VIEW */}
      {viewMode==="map" && <HomeMapView freights={filtered} onNav={onNav} />}

    </div>
  );
}

function getPendingActions(freight, userType) {
  const s = freight.status;
  const own = freight.isOwnFleet;
  if (userType === "plant") {
    if (s === "pending_assignment") return { action: "Asignar transporte", color: C.acc, icon: "assign" };
    if (s === "assigned" && own) return { action: "Autorizar viaje", color: C.sec, icon: "authorize" };
    if (s === "loaded" && !freight.plantFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm" };
    return null;
  }
  if (userType === "transporter") {
    if (s === "assigned" && !own) return { action: "Aceptar o rechazar", color: C.sec, icon: "respond" };
    if (s === "accepted") return { action: "Iniciar viaje", color: C.pri, icon: "start" };
    if (s === "in_progress" && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm" };
    if (s === "loaded" && !freight.transporterFinishedConfirmedAt) return { action: "Confirmar entrega", color: C.pri, icon: "confirm" };
    return null;
  }
  if (userType === "producer") {
    if (s === "accepted" && own) return { action: "Iniciar viaje", color: C.pri, icon: "start" };
    if (s === "in_progress" && own && !freight.transporterLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm" };
    if (s === "loaded" && !freight.producerLoadedConfirmedAt) return { action: "Confirmar carga", color: C.acc, icon: "confirm" };
    return null;
  }
  return null;
}

function PendingScreen({ user, freights, onNav, onNewFreight, embedded }) {
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
                      return (
                        <button key={f.id} onClick={() => onNav("detail", f.id)} style={{ width: "100%", background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${pa.color}`, borderRadius: 12, padding: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxShadow: C.sh, animation:`cardIn 0.2s ease ${idx*0.03}s both` }}>
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
                          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: `${pa.color}10`, borderRadius: 8, border: `1px solid ${pa.color}20` }}>
                            <span style={{ width: 8, height: 8, borderRadius: 4, background: pa.color, animation: "ti 1.5s infinite" }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: pa.color }}>{pa.action}</span>
                            <span style={{ marginLeft: "auto", display: "flex" }}>{Ic.chev(pa.color, 16)}</span>
                          </div>
                        </button>
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

// ======================== PHOTO UPLOAD ================================

// ======================== GOOGLE MAPS ================================

const GMAPS_KEY = "AIzaSyCeRfFUaBJgB7650sTKq_-RujC9jLJtWWw";

function loadGMaps() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const check = setInterval(() => { if (window.google?.maps) { clearInterval(check); resolve(window.google.maps); } }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=geometry,places`;
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.google.maps);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Error Boundary to prevent white screens
class SafeZone extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("SafeZone caught:", error, info); }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 12, background: "#FEE2E2", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Error en este componente</div>
        <div>{this.state.error?.message || "Error desconocido"}</div>
        <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 8, padding: "4px 12px", borderRadius: 6, border: "1px solid #DC2626", background: "white", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reintentar</button>
      </div>;
    }
    return this.props.children;
  }
}

// Location Picker: Autocomplete + Map Pin
function LocationPicker({ label, value, onChange }) {
  // value = { lat, lng, address }
  const inputRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapObjRef = useRef(null);
  const [showMap, setShowMap] = useState(false);
  const [addr, setAddr] = useState(value?.address || "");
  const [mapFull, setMapFull] = useState(false);
  const fullSearchRef = useRef(null);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    if (!showMap || !mapRef.current) return;
    let cancelled = false;

    const initMap = async (startCenter, startZoom) => {
      try {
        const maps = await loadGMaps();
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          zoom: startZoom, center: startCenter,
          disableDefaultUI: true, zoomControl: !mapFull, mapTypeControl: false,
          streetViewControl: false, fullscreenControl: false,
          gestureHandling: "greedy",
        });
        mapObjRef.current = map;

        const marker = new maps.Marker({ position: startCenter, map, draggable: true });
        markerRef.current = marker;

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location: { lat: pos.lat(), lng: pos.lng() } }, (results, status) => {
            const a = status === "OK" && results[0] ? results[0].formatted_address : "";
            setAddr(a);
            onChange({ lat: pos.lat(), lng: pos.lng(), address: a });
          });
        });

        map.addListener("click", (e) => {
          marker.setPosition(e.latLng);
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location: { lat: e.latLng.lat(), lng: e.latLng.lng() } }, (results, status) => {
            const a = status === "OK" && results[0] ? results[0].formatted_address : "";
            setAddr(a);
            onChange({ lat: e.latLng.lat(), lng: e.latLng.lng(), address: a });
          });
        });

        // Autocomplete
        if (inputRef.current) {
          const autocomplete = new maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: ["ar", "uy", "br", "py"] },
            fields: ["geometry", "formatted_address", "name"],
          });
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const a = place.formatted_address || place.name || "";
              map.setCenter({ lat, lng });
              map.setZoom(14);
              marker.setPosition({ lat, lng });
              setAddr(a);
              onChange({ lat, lng, address: a });
            }
          });
        }
      } catch (err) {
        console.error("LocationPicker initMap error:", err);
        setInitError(true);
      }
    };

    // If we already have a value, use it
    if (value?.lat && value?.lng) {
      initMap({ lat: Number(value.lat), lng: Number(value.lng) }, 13);
    } else {
      // Try to get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            initMap({ lat, lng }, 14);
            // Auto-set the location and reverse geocode
            const maps = window.google?.maps;
            if (maps) {
              new maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
                const a = status === "OK" && results[0] ? results[0].formatted_address : "";
                setAddr(a);
                onChange({ lat, lng, address: a });
              });
            }
          },
          () => {
            // Geolocation denied/failed — fallback to Uruguay center
            if (!cancelled) initMap({ lat: -34.6, lng: -56.2 }, 6);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        initMap({ lat: -34.6, lng: -56.2 }, 6);
      }
    }

    return () => { cancelled = true; };
  }, [showMap, mapFull]);

  const toggleFull = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setMapFull(f => {
      const next = !f;
      setTimeout(() => {
        if (mapObjRef.current && window.google?.maps) {
          window.google.maps.event.trigger(mapObjRef.current, "resize");
          if (value?.lat && value?.lng) {
            mapObjRef.current.setCenter({ lat: value.lat, lng: value.lng });
          }
        }
      }, 150);
      return next;
    });
  };

  // Setup autocomplete on fullscreen search input
  useEffect(() => {
    if (!mapFull || !fullSearchRef.current || !window.google?.maps?.places) return;
    const autocomplete = new window.google.maps.places.Autocomplete(fullSearchRef.current, {
      componentRestrictions: { country: ["ar", "uy", "br", "py"] },
      fields: ["geometry", "formatted_address", "name"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location && mapObjRef.current && markerRef.current) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const a = place.formatted_address || place.name || "";
        mapObjRef.current.setCenter({ lat, lng });
        mapObjRef.current.setZoom(14);
        markerRef.current.setPosition({ lat, lng });
        setAddr(a);
        onChange({ lat, lng, address: a });
      }
    });
  }, [mapFull]);

  // Hide Google Maps default zoom control in fullscreen to avoid overlap
  useEffect(() => {
    if (mapObjRef.current) {
      mapObjRef.current.setOptions({ zoomControl: !mapFull });
    }
  }, [mapFull]);

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>{label || "Ubicación"}</div>
      {initError && <div style={{ fontSize: 11, color: C.err, marginBottom: 4 }}>Error al cargar el mapa. Intentá recargar la página.</div>}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input ref={inputRef} value={addr} onChange={e => setAddr(e.target.value)}
          placeholder="Buscar dirección o tocar en el mapa..."
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${C.b1}`, fontSize: 12.5, fontFamily: "inherit", outline: "none", color: C.t1, background: C.w, boxSizing: "border-box" }}
          onFocus={() => setShowMap(true)} />
        <button onClick={() => { if(!showMap) setShowMap(true); else toggleFull(); }} style={{ padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${value?.lat ? C.ok : C.b1}`, background: value?.lat ? C.okPale : C.w, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: value?.lat ? C.ok : C.t3 }}>
          {Ic.pin(value?.lat ? C.ok : C.t3, 14)} {value?.lat ? "✓" : "Mapa"}
        </button>
      </div>

      {/* FULLSCREEN PORTAL — completely separate overlay */}
      {mapFull && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#000", display:"flex", flexDirection:"column" }}>
          {/* Header bar */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", paddingTop:"calc(10px + env(safe-area-inset-top))", background:C.w, flexShrink:0, zIndex:2 }}>
            <button onPointerDown={toggleFull} style={{ width:44, height:44, borderRadius:10, background:C.bg, border:`1.5px solid ${C.b1}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, touchAction:"manipulation" }}>
              {Ic.chev(C.t1,22)}
            </button>
            <input ref={fullSearchRef} value={addr} onChange={e => setAddr(e.target.value)} placeholder="Buscar dirección..."
              style={{ flex:1, padding:"12px 14px", borderRadius:10, border:`1.5px solid ${C.b1}`, fontSize:16, fontFamily:"inherit", outline:"none", color:C.t1, background:C.bg }} />
            <button onPointerDown={toggleFull} style={{ padding:"12px 20px", borderRadius:10, background:C.pri, color:C.w, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:15, fontWeight:700, flexShrink:0, minHeight:44, touchAction:"manipulation" }}>Listo</button>
          </div>
          {/* Map takes remaining space */}
          <div style={{ flex:1, position:"relative" }}>
            <div ref={mapRef} style={{ position:"absolute", inset:0 }} />
          </div>
          {/* Footer coords */}
          {value?.lat && (
            <div style={{ fontSize:11, color:C.t3, padding:"8px 16px", paddingBottom:"calc(8px + env(safe-area-inset-bottom))", background:C.w, textAlign:"center", flexShrink:0, zIndex:2 }}>
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </div>
          )}
        </div>
      )}

      {/* Inline map (non-fullscreen) */}
      {showMap && !mapFull && (
        <div style={{ marginTop: 6, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.b1}`, position:"relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: 180 }} />
          <button onClick={toggleFull} style={{ position:"absolute", top:8, right:8, zIndex:5, padding:"6px 8px", borderRadius:6, background:"rgba(255,255,255,0.9)", border:`1px solid ${C.b1}`, cursor:"pointer", display:"flex", alignItems:"center", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }}>
            {Ic.expand(C.t1,16)}
          </button>
          {value?.lat && <div style={{ fontSize: 10, color: C.t3, padding: "4px 8px", background: C.bg }}>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</div>}
        </div>
      )}
    </div>
  );
}

function FreightMap({ freightId, originLat, originLng, destLat, destLng, originName, destName, status, isDriver }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const truckMarker = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [truckPos, setTruckPos] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  const hasCoords = originLat && originLng && destLat && destLng;
  const isLive = status === "in_progress";

  // Resize map on fullscreen toggle
  useEffect(() => {
    if (mapInstance.current) {
      setTimeout(() => window.google?.maps?.event?.trigger(mapInstance.current, "resize"), 100);
    }
  }, [fullscreen]);

  useEffect(() => {
    if (!hasCoords || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const maps = await loadGMaps();
        if (cancelled) return;

        const origin = { lat: originLat, lng: originLng };
        const dest = { lat: destLat, lng: destLng };

        const map = new maps.Map(mapRef.current, {
          zoom: 7,
          center: { lat: (originLat + destLat) / 2, lng: (originLng + destLng) / 2 },
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapInstance.current = map;

        // Origin marker (green)
        new maps.Marker({
          position: origin, map,
          title: originName || "Origen",
          icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#1A6B37", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });

        // Destination marker (blue)
        new maps.Marker({
          position: dest, map,
          title: destName || "Destino",
          icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#003882", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });

        // Route
        const directionsService = new maps.DirectionsService();
        const directionsRenderer = new maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: isLive ? "#FF6A00" : "#1A6B37",
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        });

        directionsService.route({
          origin, destination: dest,
          travelMode: maps.TravelMode.DRIVING,
        }, (result, s) => {
          if (cancelled) return;
          if (s === "OK") {
            directionsRenderer.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            if (leg) setRouteInfo({ distance: leg.distance.text, duration: leg.duration.text });
          }
        });

      } catch (e) {
        if (!cancelled) setError("No se pudo cargar el mapa");
      }
    })();

    return () => { cancelled = true; };
  }, [hasCoords, originLat, originLng, destLat, destLng, status]);

  // Live tracking — poll last position
  useEffect(() => {
    if (!isLive || !freightId || !mapInstance.current) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const pos = await apiGetLastPosition(freightId);
        if (cancelled || !pos) return;
        const lat = parseFloat(pos.lat);
        const lng = parseFloat(pos.lng);
        setTruckPos({ lat, lng, speed: pos.speed, updatedAt: pos.createdAt });

        const maps = window.google.maps;
        if (!truckMarker.current) {
          truckMarker.current = new maps.Marker({
            position: { lat, lng },
            map: mapInstance.current,
            title: "Camión",
            icon: { url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#FF6A00" stroke="#fff" stroke-width="1.5"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'), scaledSize: new maps.Size(36, 36), anchor: new maps.Point(18, 18) },
            zIndex: 999,
          });
        } else {
          truckMarker.current.setPosition({ lat, lng });
        }
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [isLive, freightId, mapInstance.current]);

  // Driver sends position
  useEffect(() => {
    if (!isDriver || !isLive || !freightId) return;
    let watchId = null;

    if (navigator.geolocation) {
      setTracking(true);
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            await apiSendTracking(freightId, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed || 0,
              heading: pos.coords.heading || 0,
            });
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setTracking(false);
    };
  }, [isDriver, isLive, freightId]);

  if (!hasCoords) return null;

  const mapContainer = (
    <div style={fullscreen ? { position:"fixed", inset:0, zIndex:150, background:C.w, display:"flex", flexDirection:"column" } : { background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, overflow: "hidden", marginBottom: 12, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: fullscreen?"14px 18px":"10px 14px", paddingTop: fullscreen?"max(14px, env(safe-area-inset-top))":10, flexShrink:0 }}>
        {Ic.pin(C.pri, 14)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Recorrido</span>
        {routeInfo && (
          <span style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>
            {routeInfo.distance} · {routeInfo.duration}
          </span>
        )}
        <button onClick={()=>setFullscreen(!fullscreen)} style={{ marginLeft:"auto", padding:6, borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>
          {fullscreen ? Ic.collapse(C.t1,16) : Ic.expand(C.t1,16)}
        </button>
      </div>
      {error ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>{error}</div>
      ) : (
        <div ref={mapRef} style={{ width: "100%", flex: fullscreen?1:"none", height: fullscreen?"auto":220 }} />
      )}
      <div style={{ padding: fullscreen?"10px 18px":"8px 14px", paddingBottom: fullscreen?"max(10px, env(safe-area-inset-bottom))":8, display: "flex", gap: 12, fontSize: 10.5, flexWrap: "wrap", alignItems: "center", flexShrink:0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#1A6B37" }} />
          <span style={{ color: C.t2 }}>{originName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#003882" }} />
          <span style={{ color: C.t2 }}>{destName}</span>
        </div>
        {isLive && truckPos && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#FF6A00", animation: "ti 1.5s infinite" }} />
            <span style={{ color: C.acc, fontWeight: 600, fontSize: 10 }}>En vivo{truckPos.speed>0?` · ${Math.round(parseFloat(truckPos.speed))} km/h`:""}</span>
          </div>
        )}
        {isLive && tracking && (
          <div style={{ fontSize: 9, color: C.ok, fontWeight: 600 }}>📡 Enviando ubicación</div>
        )}
      </div>
    </div>
  );

  return mapContainer;
}

function PhotoUpload({ freightId, step, label, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Solo imágenes'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Máximo 10MB'); return; }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPhoto(file, freightId, step);
      // Register in DB so all participants can see it
      await apiAddDocument(freightId, { name: file.name, url, type: 'photo', step });
      setDone(true);
      if (onUploaded) onUploaded({ url, name: file.name, step });
    } catch (err) {
      setError(err.message || 'Error al subir');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
      {preview ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.b1}` }}>
          <img src={preview} alt="foto" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
          {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: C.w, fontSize: 12, fontWeight: 600 }}>Subiendo...</div>}
          {done && <div style={{ position: "absolute", top: 6, right: 6, background: C.ok, borderRadius: 12, padding: "2px 8px", fontSize: 10, color: C.w, fontWeight: 600 }}>Guardada</div>}
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ width: "100%", padding: "16px 14px", borderRadius: 10, border: `1.5px dashed ${C.b1}`, background: C.bg, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {Ic.cam(C.acc, 20)}
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>{label || "Adjuntar foto"}</span>
        </button>
      )}
      {error && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ======================== DOCUMENTS GALLERY ============================

function DocsGallery({ documents }) {
  if (!documents || documents.length === 0) return null;
  const stepLabels = { request: "Solicitud", assignment: "Asignación", load_confirmation: "Carga", delivery_confirmation: "Entrega", cancellation: "Cancelación" };
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>{Ic.img(C.pri, 16)}<span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Archivos del flete ({documents.length})</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {documents.map(d => {
          const isImg = d.type === "photo" || d.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
          return (
            <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: C.bg, border: `1px solid ${C.b2}`, borderRadius: 8, textDecoration: "none" }}>
              {isImg ? (
                <img src={d.url} alt={d.name} style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 6, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.doc(C.pri, 20)}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, wordBreak: "break-all" }}>{d.name || "Archivo"}</div>
                <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>
                  {stepLabels[d.step] || d.type || "Doc"}
                  {d.createdAt && ` · ${new Date(d.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}`}
                  {d.uploadedBy?.name && ` · ${d.uploadedBy.name.split(" ")[0]}`}
                </div>
              </div>
              {Ic.down(C.pri, 14)}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ======================== FREIGHT FILE UPLOAD (multi-source) ===========

function FreightFileUpload({ freightId, step, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const docRef = useRef(null);

  const addFiles = (fileList, fromCamera = false) => {
    const newFiles = Array.from(fileList).filter(f => f.size <= 15 * 1024 * 1024).map(f => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      name: f.name,
      uploading: false,
      done: false,
      error: null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const uploadAll = async () => {
    setUploadingAll(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].done) continue;
      setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: true, error: null } : f));
      try {
        const url = await uploadPhoto(files[i].file, freightId, step);
        await apiAddDocument(freightId, { name: files[i].name, url, type: files[i].file.type.startsWith("image/") ? "photo" : "document", step });
        setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: false, done: true } : f));
      } catch (err) {
        setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: false, error: err.message || "Error" } : f));
      }
    }
    setUploadingAll(false);
    if (onUploaded) onUploaded();
  };

  const pending = files.filter(f => !f.done);

  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {Ic.clip(C.acc, 16)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Adjuntar archivos</span>
      </div>

      {/* Preview staged files */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${f.done ? C.ok : f.error ? C.err : C.b1}` }}>
              {f.preview ? (
                <img src={f.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 4 }}>
                  {Ic.doc(C.pri, 20)}
                  <span style={{ fontSize: 7, color: C.t3, textAlign: "center", marginTop: 2, wordBreak: "break-all", lineHeight: 1.1 }}>{f.name?.slice(-12)}</span>
                </div>
              )}
              {f.uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
              {f.done && <div style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, background: C.ok, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.chk("#fff", 12)}</div>}
              {!f.done && !f.uploading && <button onClick={() => removeFile(i)} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: C.err, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.cross("#fff", 10)}</button>}
              {f.error && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.err, color: "#fff", fontSize: 7, textAlign: "center", padding: 2 }}>Error</div>}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.length) addFiles(e.target.files, true); e.target.value = ""; }} style={{ display: "none" }} />
      <input ref={galRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      <input ref={docRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx" multiple onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />

      {/* Single attach button */}
      <div style={{ marginBottom: pending.length > 0 ? 10 : 0 }}>
        <button onClick={() => setShowAttach(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: `1.5px dashed ${C.b1}`, background: C.bg, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: C.t2 }}>
          {Ic.clip(C.t2, 16)} Adjuntar archivo
        </button>
      </div>

      <AttachMenu open={showAttach} onClose={() => setShowAttach(false)} onCamera={() => camRef.current?.click()} onGallery={() => galRef.current?.click()} onFiles={() => docRef.current?.click()} />

      {/* Upload button */}
      {pending.length > 0 && (
        <Btn full v="acc" icon={uploadingAll ? null : Ic.chk(C.w, 14)} disabled={uploadingAll} onClick={uploadAll}>
          {uploadingAll ? "Subiendo..." : `Subir ${pending.length} archivo${pending.length > 1 ? "s" : ""}`}
        </Btn>
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
    <div style={{ flex:1, overflow:"auto", padding:18, animation:"slideUp 0.25s ease" }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:11, color:C.t3, fontWeight:600, fontFamily:MONO }}>{freight.code}</div>
          <div style={{ fontSize:22, fontWeight:800, marginTop:2, letterSpacing:-0.3 }}>{freight.grain==="Otros"?freight.productTypeOther||"Otros":freight.grain} · {freight.tons} {freight.unit||"tn"}</div>
        </div>
        <Bd color={st.color} bg={st.bg}>{st.label}</Bd>
      </div>

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

      {/* Map */}
      <FreightMap freightId={freight.id} originLat={freight.originLat} originLng={freight.originLng} destLat={freight.destLat} destLng={freight.destLng} originName={freight.originName} destName={freight.destName} status={freight.status} isDriver={user.userType==="transporter"||(user.userType==="producer"&&freight.isOwnFleet)}/>

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

      {/* Info */}
      <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:C.sh }}>
        <div style={{ fontSize:10.5, fontWeight:700, marginBottom:12, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Información del flete</div>
        {[
          [Ic.pin(C.pri,15),"Origen",freight.originName],
          freight.fieldName&&[Ic.pin(C.ok,15),"Campo",freight.fieldName],
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

      {/* Actions */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
        {filteredActions.includes("authorize") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"authorize")}>{actionLoading?"Procesando...":"Autorizar viaje"}</Btn>}
        {filteredActions.includes("assign") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"assign")}>Asignar transportista</Btn>}
        {filteredActions.includes("accept") && <Btn full icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"accept")}>Aceptar flete</Btn>}
        {filteredActions.includes("start") && <Btn full icon={Ic.truck(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"start")}>{actionLoading?"Procesando...":"Iniciar viaje"}</Btn>}
        {filteredActions.includes("confirm_loaded") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_loaded")}>{actionLoading?"Procesando...":"Confirmar carga"}</Btn>}
        {filteredActions.includes("confirm_finished") && <Btn full v="acc" icon={Ic.chk(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"confirm_finished")}>{actionLoading?"Procesando...":"Confirmar entrega"}</Btn>}
        {filteredActions.includes("reject") && <Btn full v="err" icon={Ic.ban(C.w,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"reject")}>Rechazar asignación</Btn>}
        {filteredActions.includes("cancel") && <Btn full v="err" icon={Ic.cross(C.err,16)} disabled={actionLoading} onClick={()=>onAction(freight.id,"cancel")}>Cancelar flete</Btn>}
      </div>

      {/* Secondary actions — edit */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {freight.status==="pending_assignment" && perms.canRequest && <Btn full sm v="sec" icon={Ic.doc(C.pri,14)} onClick={()=>onEdit(freight)}>Editar</Btn>}
      </div>

      {/* Documents gallery */}
      <DocsGallery documents={freight.documents}/>

      {/* File upload — multi-source, any status except finished/canceled */}
      {freight.status !== "finished" && freight.status !== "canceled" && (
        <FreightFileUpload freightId={freight.id} step={freight.status==="pending_assignment"?"request":freight.status==="in_progress"||freight.status==="loaded"?"load_confirmation":"assignment"} onUploaded={()=>{ if(onRefresh) onRefresh(freight.id); }} />
      )}

      <button onClick={()=>onChat(freight.conversationId)} disabled={!freight.conversationId}
        style={{ width:"100%", background:C.priPale, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${C.pri}30`, cursor:freight.conversationId?"pointer":"default", fontFamily:"inherit" }}>
        {Ic.msg(C.pri,20)}<div style={{textAlign:"left"}}><div style={{ fontSize:12, fontWeight:700, color:C.pri }}>Chat del flete</div><div style={{ fontSize:10, color:C.t2 }}>Conversá con las partes involucradas</div></div>
      </button>
    </div>
  );
}


// ======================== NEW FREIGHT ================================

function NewScreen({ user, lots, plants, fields, trucks, onBack, onCreate, duplicateFrom }) {
  const dup = duplicateFrom;
  const [form, setForm] = useState({
    grain: dup?.grain || "",
    tons: dup?.tons?.toString() || "",
    lotId: dup?.originLotId || "",
    plantId: dup?.destPlantId || "",
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

  // Load lots when field changes
  useEffect(()=>{
    if(!form.fieldId){ setFieldLots([]); return; }
    setLoadingLots(true);
    apiGetFieldLots(form.fieldId).then(l=>setFieldLots(l||[])).catch(()=>setFieldLots([])).finally(()=>setLoadingLots(false));
  },[form.fieldId]);

  const fieldOpts = (fields||[]).map(f=>({ value:f.id, label:f.name, sub:f.address||"" }));
  const lotOpts = fieldLots.map(l=>({ value:l.id, label:l.name, sub:l.hectares?`${l.hectares} ha`:'' }));
  const plantOpts = (plants||[]).map(p=>({ value:p.id, label:p.name }));
  const selectedLot = fieldLots.find(l=>l.id===form.lotId);
  const selectedPlant = (plants||[]).find(p=>p.id===form.plantId);
  const truckOpts = (trucks||[]).map(t=>({ value:t.id, label:`${t.plate}${t.model?` · ${t.model}`:""}` }));
  const showTruckSelect = user.userType==="producer" && truckOpts.length > 0;

  // Coords for map preview
  const originCoords = selectedLot?.lat ? { lat: parseFloat(selectedLot.lat), lng: parseFloat(selectedLot.lng) } : null;
  const destCoords = selectedPlant?.lat ? { lat: parseFloat(selectedPlant.lat), lng: parseFloat(selectedPlant.lng) } : null;
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [editingDest, setEditingDest] = useState(false);
  const [overrideOrigin, setOverrideOrigin] = useState(null);
  const [overrideDest, setOverrideDest] = useState(null);
  const finalOrigin = overrideOrigin || originCoords;
  const finalDest = overrideDest || destCoords;

  const submit = () => {
    setTouched(true);
    const {ok,errs:e} = validate(form, SCHEMAS.freight);
    if(form.grain==="Otros" && !form.productTypeOther.trim()) { e.productTypeOther="Descripción obligatoria"; }
    if(form.fieldId && !form.lotId) { e.lotId="Seleccioná un lote del campo"; }
    setErrs(e);
    if(!ok || Object.keys(e).filter(k=>e[k]).length>0) return;
    onCreate({...form, amount:form.amount?parseFloat(form.amount):0, photos: photos.map(p=>p.preview),
      overrideOriginLat: overrideOrigin?.lat || undefined,
      overrideOriginLng: overrideOrigin?.lng || undefined,
      overrideDestLat: overrideDest?.lat || undefined,
      overrideDestLng: overrideDest?.lng || undefined,
    });
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

  return (
    <div style={{ flex:1, overflow:"auto", padding:18, animation:"slideUp 0.25s ease" }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Solicitar Flete</div>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>Solicitando como: <span style={{fontWeight:600,color:C.t1}}>{user.name}</span></div>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div>
          <Field label="Tipo de producto" icon={Ic.grain(C.pri,14)}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
              {GRANOS.map(g=><button key={g} onClick={()=>{u({grain:g}); if(g!=="Otros")u({productTypeOther:""});}} style={{ padding:"10px 8px", borderRadius:8, border:`1.5px solid ${form.grain===g?C.pri:C.b1}`, background:form.grain===g?C.priPale:C.w, color:form.grain===g?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>{g}</button>)}
            </div>
          </Field>
          {touched&&<FieldError error={errs.grain}/>}
        </div>

        {form.grain==="Otros" && (
          <div>
            <Field label="Descripción de producto" value={form.productTypeOther} onChange={v=>u({productTypeOther:v})} placeholder="Ej: Arena, Cemento, etc."/>
            {touched&&<FieldError error={errs.productTypeOther}/>}
          </div>
        )}

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

        <div>
          <Field label="Importe (opcional)" value={form.amount} onChange={v=>u({amount:v})} placeholder="Ej: 150000"/>
        </div>

        <div>
          <Select label="Campo" icon={Ic.pin(C.ok,14)} value={form.fieldId} onChange={v=>{u({fieldId:v,lotId:""});}} options={fieldOpts} placeholder="Seleccionar campo..."/>
        </div>

        <div>
          <Select label="Origen (lote)" icon={Ic.pin(C.pri,14)} value={form.lotId} onChange={v=>u({lotId:v})} options={lotOpts} placeholder={loadingLots?"Cargando lotes...":form.fieldId?"Seleccionar lote...":"Primero seleccioná un campo"}/>
          {touched&&<FieldError error={errs.lotId}/>}
          {selectedLot && selectedLot.lat && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:C.priPale, borderRadius:8, marginTop:6 }}>{Ic.chk(C.pri,14)}<span style={{fontSize:10.5,color:C.pri,fontWeight:500}}>{selectedLot.lat}, {selectedLot.lng}</span></div>}
        </div>

        <div>
          <Select label="Destino (planta)" icon={Ic.plant(C.t2,14)} value={form.plantId} onChange={v=>u({plantId:v})} options={plantOpts} placeholder="Seleccionar planta..."/>
          {touched&&<FieldError error={errs.plantId}/>}
        </div>

        {/* Route preview map */}
        {(finalOrigin || finalDest) && (
          <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:C.sh }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px" }}>
              {Ic.pin(C.pri,14)}
              <span style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Vista previa del recorrido</span>
            </div>

            {finalOrigin && finalDest ? (
              <FreightMap freightId={null} originLat={finalOrigin.lat} originLng={finalOrigin.lng} destLat={finalDest.lat} destLng={finalDest.lng} originName={fieldLots.find(l=>l.id===form.lotId)?.name||"Origen"} destName={(plants||[]).find(p=>p.id===form.plantId)?.name||"Destino"} status="preview" isDriver={false}/>
            ) : (
              <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:C.t3 }}>
                Seleccioná {!finalOrigin?"origen (lote)":""}{!finalOrigin&&!finalDest?" y ":""}{!finalDest?"destino (planta)":""} para ver la ruta
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

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.cal(C.pri,14)} Fecha carga</label>
            <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} onClick={e=>e.target.showPicker?.()} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadDate?C.err:C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer" }}/>
            {touched&&<FieldError error={errs.loadDate}/>}
          </div>
          <div>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.clk(C.pri,14)} Hora carga</label>
            <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} onClick={e=>e.target.showPicker?.()} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadTime?C.err:C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer" }}/>
            {touched&&<FieldError error={errs.loadTime}/>}
          </div>
        </div>

        {showTruckSelect && (
          <div style={{ background:C.accPale, border:`1.5px solid ${C.acc}30`, borderRadius:12, padding:14 }}>
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
        <div>
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

        <Btn full icon={Ic.chk(C.w,16)} disabled={submitting} onClick={submit}>{submitting?"Enviando...":"Solicitar Flete"}</Btn>
      </div>
    </div>
  );
}


// ======================== PROFILE =====================================

function ProfileScreen({ user, perms, onLogout, onNav, theme, toggleTheme }) {
  const tc = ({plant:C.pri,transporter:C.info,producer:C.acc})[user.userType]||C.pri;
  const pl = []; if(perms.canRequest)pl.push("Solicitar fletes"); if(perms.canApprove)pl.push("Aprobar fletes"); if(perms.canAssignDriver)pl.push("Asignar choferes"); if(perms.canCancel)pl.push("Cancelar fletes"); if(perms.canReject)pl.push("Rechazar viajes");
  const isDark = theme === "dark";

  const mgmtItems = [];
  if(user.userType==="transporter"||user.userType==="producer") mgmtItems.push({k:"trucks",l:"Mis Camiones",ic:Ic.truck(C.acc,18),c:C.acc});
  if(user.userType==="producer") mgmtItems.push({k:"fields",l:"Mis Campos y Lotes",ic:Ic.pin(C.pri,18),c:C.pri});
  if(user.userType==="plant") mgmtItems.push({k:"access",l:"Productores Habilitados",ic:Ic.user(C.pri,18),c:C.pri});
  mgmtItems.push({k:"calendar",l:"Calendario",ic:Ic.cal(C.info||C.sec,18),c:C.info||C.sec});
  mgmtItems.push({k:"reports",l:"Informes y Documentos",ic:Ic.doc(C.sec,18),c:C.sec});
  if(user.role==="platform_admin"||user.role==="admin") mgmtItems.push({k:"admin",l:"Administración",ic:Ic.shield(C.err,18),c:C.err});

  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24,marginTop:8,animation:"slideUp 0.3s ease"}}>
        <Av letters={user.av} size={72} color={tc}/>
        <div style={{fontSize:18,fontWeight:700,marginTop:12,color:C.t1}}>{user.name}</div>
        <div style={{fontSize:12,color:C.t2,marginTop:3}}>{user.email}</div>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:8}}>
          <Bd color={tc}>{({plant:"Planta",transporter:"Transportista",producer:"Productor"})[user.userType]}</Bd>
          <Bd color={C.t2} bg={C.bgInput}>{user.role==="admin"?"Gerente":"Operario"}</Bd>
        </div>
        <div style={{fontSize:12,color:C.t2,marginTop:6}}>{user.entity}</div>
        {user.companyId && <div style={{fontSize:9.5,color:C.t3,marginTop:4,fontFamily:MONO}}>ID: {user.companyId}</div>}
      </div>

      {mgmtItems.length>0 && (
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:4,marginBottom:12,boxShadow:C.sh,animation:"cardIn 0.3s ease 0.05s both"}}>
          {mgmtItems.map((m,i)=>(
            <button key={m.k} onClick={()=>onNav(m.k)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 14px",background:"none",border:"none",borderTop:i>0?`1px solid ${C.b2}`:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:36,height:36,borderRadius:10,background:`${m.c}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>{m.ic}</div>
              <span style={{fontSize:14,fontWeight:600,color:C.t1}}>{m.l}</span>
              <span style={{marginLeft:"auto",display:"flex"}}>{Ic.chev(C.t3,16)}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>{Ic.shield(C.pri,16)}<span style={{fontSize:10.5,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Permisos</span></div>
        {pl.length>0?pl.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0"}}>{Ic.chk(C.pri,14)}<span style={{fontSize:13}}>{p}</span></div>):<div style={{fontSize:12,color:C.t3}}>Rol operativo</div>}
      </div>
      {/* Dark Mode Toggle */}
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>{isDark?"🌙":"☀️"}</span>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:C.t1}}>Modo {isDark?"oscuro":"claro"}</div>
            <div style={{fontSize:10.5,color:C.t3}}>Cambiar apariencia</div>
          </div>
        </div>
        <button onClick={()=>toggleTheme(isDark?"light":"dark")} style={{width:48,height:28,borderRadius:14,background:isDark?C.pri:C.b1,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
          <div style={{width:22,height:22,borderRadius:11,background:C.w,position:"absolute",top:3,left:isDark?23:3,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
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
    try { await apiDeactivateTruck(id); setMsg({ t: "Camión eliminado", k: "ok" }); load(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); }
  };

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:18 }}>
      {!embedded && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Mi Perfil</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Mis Camiones</div>
        <Btn sm onClick={() => setShowForm(!showForm)} icon={showForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showForm ? "Cerrar" : "Agregar"}</Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {showForm && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <Field label="Patente" value={plate} onChange={setPlate} placeholder="Ej: AB-123-CD" />
          <div style={{ height: 10 }} />
          <Field label="Modelo (opcional)" value={model} onChange={setModel} placeholder="Ej: Scania R500" />
          <div style={{ height: 12 }} />
          <Btn full v="acc" disabled={saving} onClick={handleCreate}>{saving ? "Guardando..." : "Registrar camión"}</Btn>
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Cargando...</div> :
        trucks.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>No tenés camiones registrados.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                <button onClick={() => handleDeactivate(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>{Ic.ban(C.err, 18)}</button>
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

      {msg && <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {showFieldForm && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <Field label="Nombre del campo" value={fieldName} onChange={setFieldName} placeholder="Ej: Campo San Juan" />
          <div style={{ height: 10 }} />
          <SafeZone><LocationPicker label="Ubicación del campo" value={fieldLoc} onChange={setFieldLoc} /></SafeZone>
          <div style={{ height: 12 }} />
          <Btn full v="acc" disabled={saving} onClick={handleCreateField}>{saving ? "Guardando..." : "Crear campo"}</Btn>
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Cargando...</div> :
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
  const [prodId, setProdId] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [allCompanies, setAllCompanies] = useState([]);

  const load = useCallback(async () => {
    try {
      const p = await apiListAccessProducers();
      setProducers(p || []);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleGrant = async () => {
    if (!prodId.trim()) { setMsg({ t: "Ingresá el ID del productor", k: "err" }); return; }
    setSaving(true);
    try {
      await apiGrantAccess({ producerCompanyId: prodId.trim() });
      setProdId(""); setShowGrant(false); setMsg({ t: "Productor habilitado", k: "ok" }); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); } finally { setSaving(false); }
  };

  const handleRevoke = async (companyId) => {
    try { await apiRevokeAccess(companyId); setMsg({ t: "Acceso revocado", k: "ok" }); load(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Mi Perfil</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Productores</div>
        <Btn sm onClick={() => setShowGrant(!showGrant)} icon={showGrant ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showGrant ? "Cerrar" : "Habilitar"}</Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {showGrant && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <Field label="ID de empresa productora" value={prodId} onChange={setProdId} placeholder="UUID del productor" />
          <div style={{ fontSize: 10, color: C.t3, marginTop: 4, marginBottom: 10 }}>Pedile el ID al productor desde su perfil</div>
          <Btn full v="acc" disabled={saving} onClick={handleGrant}>{saving ? "Guardando..." : "Habilitar productor"}</Btn>
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Cargando...</div> :
        producers.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Ningún productor habilitado aún.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {producers.map(p => (
              <div key={p.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${p.active ? C.ok : C.muted}`, borderRadius: 12, padding: 14, boxShadow: C.sh, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {Ic.user(p.active ? C.ok : C.muted, 20)}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.producerCompany?.name || "Productor"}</div>
                    <div style={{ fontSize: 10, color: C.t3 }}>{p.producerCompany?.email || ""}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bd color={p.active ? C.ok : C.muted} small>{p.active ? "Activo" : "Revocado"}</Bd>
                  {p.active && <button onClick={() => handleRevoke(p.producerCompany?.id || p.producerCompanyId)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.ban(C.err, 16)}</button>}
                </div>
              </div>
            ))}
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
  const [newErr, setNewErr] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterPlant, setFilterPlant] = useState("");
  const [filterTransporter, setFilterTransporter] = useState("");
  const [filterProducer, setFilterProducer] = useState("");
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
    try { const m = await apiGetMessages(conv.id); setMessages(m || []); } catch {}
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

  const handleStartConv = async () => {
    if (!newCompId.trim()) { setNewErr("Ingresá el ID de la empresa"); return; }
    setNewErr(null);
    try {
      const conv = await apiStartConversation({ targetCompanyId: newCompId.trim() });
      setShowNew(false); setNewCompId("");
      loadConvs();
      openConv(conv);
    } catch (e) { setNewErr(e.message); }
  };

  const getConvName = (conv) => {
    if (!conv) return "Chat";
    if (conv.displayName) return conv.displayName;
    if (conv.freight) return `Flete ${conv.freight.code}`;
    const otherP = (conv.participants || []).find(p => p.companyId !== user.companyId);
    if (otherP?.company?.name) return otherP.company.name;
    return otherP?.companyId?.slice(0, 8) || "Chat del flete";
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

  // Extract unique companies by type for filter dropdowns
  const filterOptions = useMemo(() => {
    const plants = new Map();
    const transporters = new Map();
    const producers = new Map();
    convs.forEach(c => {
      (c.participants || []).forEach(p => {
        const co = p.company;
        if (!co?.name || !co?.id) return;
        const t = co.type;
        if (t === "plant") plants.set(co.id, co.name);
        else if (t === "transporter") transporters.set(co.id, co.name);
        else if (t === "producer") producers.set(co.id, co.name);
      });
      // Also check freight origin/dest companies
      if (c.freight) {
        const oc = c.freight.originCompany;
        const dc = c.freight.destCompany;
        if (oc?.id && oc?.name) {
          if (oc.type === "producer") producers.set(oc.id, oc.name);
          if (oc.type === "plant") plants.set(oc.id, oc.name);
        }
        if (dc?.id && dc?.name) {
          if (dc.type === "plant") plants.set(dc.id, dc.name);
          if (dc.type === "producer") producers.set(dc.id, dc.name);
        }
      }
    });
    const toArr = (m) => [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    return { plants: toArr(plants), transporters: toArr(transporters), producers: toArr(producers) };
  }, [convs]);

  // Filter conversations
  const filteredConvs = useMemo(() => {
    if (!filterPlant && !filterTransporter && !filterProducer) return convs;
    return convs.filter(c => {
      const participantIds = (c.participants || []).map(p => p.companyId);
      const freightCompanyIds = [];
      if (c.freight) {
        if (c.freight.originCompanyId) freightCompanyIds.push(c.freight.originCompanyId);
        if (c.freight.destCompanyId) freightCompanyIds.push(c.freight.destCompanyId);
      }
      const allIds = [...participantIds, ...freightCompanyIds];
      if (filterPlant && !allIds.includes(filterPlant)) return false;
      if (filterTransporter && !allIds.includes(filterTransporter)) return false;
      if (filterProducer && !allIds.includes(filterProducer)) return false;
      return true;
    });
  }, [convs, filterPlant, filterTransporter, filterProducer]);

  // Group ALL conversations by company (freight + direct together)
  const grouped = useMemo(() => {
    const byCompany = {};
    filteredConvs.forEach(c => {
      const others = (c.participants || []).filter(p => p.companyId !== user.companyId);
      const companyKey = others.map(o => o.company?.name || "").filter(Boolean).sort().join(", ") || "Otros";
      if (!byCompany[companyKey]) byCompany[companyKey] = [];
      byCompany[companyKey].push(c);
    });

    // Sort each group: active fletes first, then by last message
    const statusOrder = { in_progress: 0, loaded: 1, accepted: 2, assigned: 3, pending_assignment: 4, finished: 5, canceled: 6 };
    Object.values(byCompany).forEach(arr => {
      arr.sort((a, b) => {
        // Freight convs first, then direct
        if (a.freight && !b.freight) return -1;
        if (!a.freight && b.freight) return 1;
        if (a.freight && b.freight) {
          const sa = statusOrder[a.freight?.status] ?? 99;
          const sb = statusOrder[b.freight?.status] ?? 99;
          if (sa !== sb) return sa - sb;
        }
        const ta = a.messages?.[0]?.createdAt || "";
        const tb = b.messages?.[0]?.createdAt || "";
        return tb.localeCompare(ta);
      });
    });

    // Sort companies by most recent activity
    const companyKeys = Object.keys(byCompany).sort((a, b) => {
      const getLatest = (arr) => arr.reduce((max, c) => {
        const t = c.messages?.[0]?.createdAt || "";
        return t > max ? t : max;
      }, "");
      return getLatest(byCompany[b]).localeCompare(getLatest(byCompany[a]));
    });

    return { companyKeys, byCompany };
  }, [filteredConvs, user.companyId]);

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

      {/* Filters */}
      {(filterOptions.plants.length > 0 || filterOptions.transporters.length > 0 || filterOptions.producers.length > 0) && (
        <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
          {filterOptions.plants.length > 0 && (
            <select value={filterPlant} onChange={e=>setFilterPlant(e.target.value)} style={{ flex:1, minWidth:100, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${filterPlant?C.pri:C.b1}`, background:filterPlant?C.priPale:C.w, color:filterPlant?C.pri:C.t2, fontSize:11.5, fontWeight:600, fontFamily:"inherit", outline:"none", cursor:"pointer", appearance:"auto" }}>
              <option value="">Planta</option>
              {filterOptions.plants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {filterOptions.transporters.length > 0 && (
            <select value={filterTransporter} onChange={e=>setFilterTransporter(e.target.value)} style={{ flex:1, minWidth:100, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${filterTransporter?C.sec:C.b1}`, background:filterTransporter?C.secPale:C.w, color:filterTransporter?C.sec:C.t2, fontSize:11.5, fontWeight:600, fontFamily:"inherit", outline:"none", cursor:"pointer", appearance:"auto" }}>
              <option value="">Transportista</option>
              {filterOptions.transporters.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {filterOptions.producers.length > 0 && (
            <select value={filterProducer} onChange={e=>setFilterProducer(e.target.value)} style={{ flex:1, minWidth:100, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${filterProducer?C.acc:C.b1}`, background:filterProducer?C.accPale:C.w, color:filterProducer?C.acc:C.t2, fontSize:11.5, fontWeight:600, fontFamily:"inherit", outline:"none", cursor:"pointer", appearance:"auto" }}>
              <option value="">Productor</option>
              {filterOptions.producers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {(filterPlant||filterTransporter||filterProducer) && (
            <button onClick={()=>{setFilterPlant("");setFilterTransporter("");setFilterProducer("");}} style={{ padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.err}30`, background:C.errPale, color:C.err, fontSize:11, fontWeight:600, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap" }}>
              Limpiar
            </button>
          )}
        </div>
      )}

      {showNew && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: C.sh }}>
          <Field label="ID de empresa" value={newCompId} onChange={setNewCompId} placeholder="UUID de la empresa" />
          <div style={{ fontSize: 10, color: C.t3, marginTop: 4, marginBottom: 10 }}>Copiá el ID desde el perfil de la otra empresa</div>
          {newErr && <div style={{ fontSize: 11, color: C.err, marginBottom: 8 }}>{newErr}</div>}
          <Btn full v="acc" onClick={handleStartConv}>Iniciar conversación</Btn>
        </div>
      )}

      {loading ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Cargando...</div> :
        convs.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Sin conversaciones aún.{!showNew && <><br/><button onClick={()=>setShowNew(true)} style={{background:"none",border:"none",color:C.acc,fontWeight:600,cursor:"pointer",fontFamily:"inherit",fontSize:13,marginTop:8}}>Iniciar una nueva</button></>}</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {grouped.companyKeys.map(companyName => {
              const convsList = grouped.byCompany[companyName];
              const isOpen = expandedGroups[companyName] !== false;
              const freightCount = convsList.filter(c => c.freight).length;
              const directCount = convsList.filter(c => !c.freight).length;
              const countParts = [];
              if (freightCount > 0) countParts.push(`${freightCount} flete${freightCount !== 1 ? "s" : ""}`);
              if (directCount > 0) countParts.push(`${directCount} directo${directCount !== 1 ? "s" : ""}`);
              return (
                <div key={companyName} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, overflow: "hidden", boxShadow: C.sh }}>
                  {/* Company header — white with shadow */}
                  <button onClick={() => toggleGroup(companyName)} style={{ width: "100%", padding: "12px 14px", background: C.w, border: "none", borderBottom: isOpen ? `1px solid ${C.b2}` : "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {Ic.user(C.pri, 16)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{companyName}</div>
                      <div style={{ fontSize: 10.5, color: C.t3 }}>{countParts.join(" · ")}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2.5" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {/* All conversations for this company */}
                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {convsList.map((c, i) => {
                        const isFreight = !!c.freight;
                        const title = isFreight ? `Flete ${c.freight.code}` : "Mensaje directo";
                        const statusCol = isFreight ? stColor(c.freight?.status) : C.acc;
                        return (
                          <button key={c.id} onClick={() => openConv(c)} style={{ padding: "10px 14px", border: "none", borderTop: i > 0 ? `1px solid ${C.b2}` : "none", background: C.w, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 10, width: "100%", transition: "background 0.15s" }} onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background=C.w}>
                            <div style={{ width: 8, height: 8, borderRadius: 4, background: statusCol, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{title}</span>
                                {isFreight && <span style={{ fontSize: 9, fontWeight: 600, color: statusCol, textTransform: "uppercase" }}>{stLabel(c.freight?.status)}</span>}
                              </div>
                              <div style={{ fontSize: 11, color: C.t3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{getLastMsg(c)}</div>
                            </div>
                            <span style={{ fontSize: 9.5, color: C.t3, flexShrink: 0 }}>{getLastMsgTime(c)}</span>
                          </button>
                        );
                      })}
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
  const [fStatus, setFStatus] = useState("");

  const filtered = useMemo(()=>{
    let ff = freights.filter(f=>!["canceled","draft"].includes(f.status));
    if(fStatus) ff = ff.filter(f=>f.status===fStatus);
    return ff;
  },[freights,fStatus]);

  const monNames=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const days=useMemo(()=>{
    const arr=[];
    const first=new Date(calMonth.y,calMonth.m,1);
    const lastDay=new Date(calMonth.y,calMonth.m+1,0).getDate();
    const startDow=(first.getDay()+6)%7;
    for(let i=0;i<startDow;i++)arr.push(null);
    for(let d=1;d<=lastDay;d++)arr.push(d);
    return arr;
  },[calMonth]);

  const byDay=useMemo(()=>{
    const map={};
    filtered.forEach(f=>{
      if(!f.loadDate)return;
      const dd=parseInt(f.loadDate.slice(8,10),10);
      const mm=parseInt(f.loadDate.slice(5,7),10)-1;
      const yy=parseInt(f.loadDate.slice(0,4),10);
      if(yy===calMonth.y&&mm===calMonth.m){
        if(!map[dd])map[dd]=[];
        map[dd].push(f);
      }
    });
    return map;
  },[filtered,calMonth]);

  const selFreights=calSelDay?byDay[calSelDay]||[]:[];
  const today=new Date();
  const isToday=(d)=>d===today.getDate()&&calMonth.m===today.getMonth()&&calMonth.y===today.getFullYear();
  const totalInMonth = Object.values(byDay).reduce((s,a)=>s+a.length,0);

  // --- Detail panel (shared between mobile inline and desktop side panel) ---
  const detailPanel = calSelDay ? (
    <div style={{animation:"fadeIn 0.2s ease",padding:isDesktop?"18px 16px":0,overflow:"auto",flex:isDesktop?1:undefined}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:C.t1}}>{calSelDay} de {monNames[calMonth.m]}</div>
          <div style={{fontSize:11,color:C.t2,marginTop:2}}>{selFreights.length} flete{selFreights.length!==1?"s":""}</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {perms.canRequest&&<Btn sm v="acc" icon={Ic.plus(C.w,12)} onClick={()=>{const dd=String(calSelDay).padStart(2,"0");const mm=String(calMonth.m+1).padStart(2,"0");onNav("new_date",`${calMonth.y}-${mm}-${dd}`)}}>Nuevo</Btn>}
          {isDesktop&&<button onClick={()=>setCalSelDay(null)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",padding:4}}>{Ic.cross(C.t3,18)}</button>}
        </div>
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
              {Ic.pin(C.t3,12)} <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(f.originName||"").split("—")[0].trim()}</span>
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>Calendario</div>
        <div style={{fontSize:11,color:C.t2}}>{totalInMonth} flete{totalInMonth!==1?"s":""}</div>
      </div>
      <div style={{ fontSize:12, color:C.t3, marginBottom:12 }}>{monNames[calMonth.m]} {calMonth.y}</div>

      {/* Status filter */}
      <div style={{ display:"flex", gap:5, marginBottom:14, flexWrap:"wrap" }}>
        {[{k:"",l:"Todos"},{k:"pending_assignment",l:"Solicitados"},{k:"assigned",l:"Asignados"},{k:"accepted",l:"Aceptados"},{k:"in_progress",l:"En viaje"},{k:"loaded",l:"Cargados"},{k:"finished",l:"Finalizados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFStatus(opt.k)} style={{ padding:"4px 10px", borderRadius:20, border:`1.5px solid ${fStatus===opt.k?C.pri:C.b1}`, background:fStatus===opt.k?C.priPale:C.w, color:fStatus===opt.k?C.pri:C.t2, fontSize:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>{opt.l}</button>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,boxShadow:C.sh,marginBottom:isDesktop?0:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button onClick={()=>{setCalMonth(p=>p.m===0?{y:p.y-1,m:11}:{y:p.y,m:p.m-1});setCalSelDay(null);}} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex"}}>{Ic.chev(C.pri,22)}</button>
          <span style={{fontSize:17,fontWeight:700,color:C.t1}}>{monNames[calMonth.m]} {calMonth.y}</span>
          <button onClick={()=>{setCalMonth(p=>p.m===11?{y:p.y+1,m:0}:{y:p.y,m:p.m+1});setCalSelDay(null);}} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",transform:"rotate(180deg)"}}>{Ic.chev(C.pri,22)}</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,textAlign:"center"}}>
          {["Lu","Ma","Mi","Ju","Vi","Sá","Do"].map(d=><div key={d} style={{fontSize:10,fontWeight:700,color:C.t3,padding:6}}>{d}</div>)}
          {days.map((d,i)=>{
            if(!d)return<div key={`e${i}`}/>;
            const cnt=byDay[d]?.length||0;
            const sel=calSelDay===d;
            const td=isToday(d);
            const statuses=byDay[d]?.map(f=>stCfg(f.status).color)||[];
            return <div key={d} onClick={()=>setCalSelDay(sel?null:d)} style={{padding:"8px 4px",borderRadius:10,cursor:"pointer",background:sel?C.pri:td?C.priPale:"transparent",transition:"all 0.15s",minHeight:44}}>
              <div style={{fontSize:14,fontWeight:sel||td?700:400,color:sel?C.w:td?C.pri:C.t1}}>{d}</div>
              {cnt>0&&<div style={{display:"flex",gap:2,justifyContent:"center",marginTop:3,flexWrap:"wrap"}}>
                {statuses.slice(0,4).map((c,j)=><div key={j} style={{width:6,height:6,borderRadius:3,background:sel?"#fff":c}}/>)}
                {cnt>4&&<div style={{fontSize:8,color:sel?C.w:C.t3,lineHeight:1}}>+{cnt-4}</div>}
              </div>}
            </div>;
          })}
        </div>
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

const REPORT_COLUMNS = [
  { key:"code", label:"Código", default:true, get:f=>f.code },
  { key:"status", label:"Estado", default:true, get:f=>stCfg(f.status).label },
  { key:"grain", label:"Producto", default:true, get:f=>f.grain==="Otros"?f.productTypeOther||"Otros":f.grain },
  { key:"tons", label:"Cantidad", default:true, get:f=>`${f.tons} ${f.unit||"tn"}` },
  { key:"amount", label:"Importe", default:false, get:f=>f.amount>0?`$${Number(f.amount).toLocaleString()}`:"" },
  { key:"originName", label:"Origen", default:true, get:f=>f.originName },
  { key:"fieldName", label:"Campo", default:false, get:f=>f.fieldName||"" },
  { key:"destName", label:"Destino", default:true, get:f=>f.destName },
  { key:"loadDate", label:"Fecha carga", default:true, get:f=>f.loadDate },
  { key:"loadTime", label:"Hora carga", default:false, get:f=>f.loadTime||"" },
  { key:"requestedByName", label:"Solicitado por", default:false, get:f=>f.requestedByName },
  { key:"transporterName", label:"Transportista", default:true, get:f=>f.transporterName||"" },
  { key:"truckPlate", label:"Matrícula", default:false, get:f=>f.truckPlate||"" },
  { key:"truckModel", label:"Modelo camión", default:false, get:f=>f.truckModel||"" },
  { key:"driverName", label:"Chofer", default:false, get:f=>f.driverName||"" },
  { key:"driverPhone", label:"Tel. chofer", default:false, get:f=>f.driverPhone||"" },
  { key:"isOwnFleet", label:"Flota propia", default:false, get:f=>f.isOwnFleet?"Sí":"No" },
  { key:"notes", label:"Notas", default:false, get:f=>f.notes||"" },
  { key:"docsCount", label:"Documentos", default:false, get:f=>(f.documents?.length||0).toString() },
  { key:"createdAt", label:"Creado", default:false, get:f=>f.createdAt?new Date(f.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}):"" },
];

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
  const [generating, setGenerating] = useState(null);
  const [showColPicker, setShowColPicker] = useState(false);
  const [selectedCols, setSelectedCols] = useState(()=>REPORT_COLUMNS.filter(c=>c.default).map(c=>c.key));
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const toggle = (k) => setExpanded(p=>({...p,[k]:!p[k]}));
  const toggleCol = (key) => setSelectedCols(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);

  const allFreights = (freights||[]).filter(f=>{
    if(!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (f.code||"").toLowerCase().includes(q) || (f.originName||"").toLowerCase().includes(q) || (f.destName||"").toLowerCase().includes(q) || (f.grain||"").toLowerCase().includes(q) || (f.transporterName||"").toLowerCase().includes(q) || (f.requestedByName||"").toLowerCase().includes(q);
  });
  const filteredForExport = filterStatus==="all" ? allFreights : allFreights.filter(f=> filterStatus==="active" ? !["finished","canceled"].includes(f.status) : f.status===filterStatus);

  // Group by status
  const groups = useMemo(()=>{
    const active = allFreights.filter(f=>!["finished","canceled"].includes(f.status));
    const finished = allFreights.filter(f=>f.status==="finished");
    const canceled = allFreights.filter(f=>f.status==="canceled");
    return [
      {key:"active", label:"Fletes activos", items:active, color:C.acc},
      {key:"finished", label:"Finalizados", items:finished, color:C.ok},
      {key:"canceled", label:"Cancelados", items:canceled, color:C.muted},
    ].filter(g=>g.items.length>0);
  },[allFreights]);

  const totalDocs = allFreights.reduce((sum,f)=>sum+(f.documents?.length||0),0);

  // Load SheetJS
  const loadXLSX = async () => {
    if(window.XLSX) return window.XLSX;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.XLSX;
  };

  // Excel — summary with selected columns
  const generateExcel = async () => {
    setGenerating("excel");
    try {
      const XLSX = await loadXLSX();
      const cols = REPORT_COLUMNS.filter(c=>selectedCols.includes(c.key));
      const headers = cols.map(c=>c.label);
      const rows = filteredForExport.map(f=>cols.map(c=>c.get(f)));
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = cols.map(c=>({ wch: Math.max(c.label.length+2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fletes");
      // Docs sheet
      const allDocs = [];
      filteredForExport.forEach(f=>(f.documents||[]).forEach(d=>{
        allDocs.push({ "Flete":f.code, "Documento":d.name||"Documento", "Tipo":d.type||"otro", "Etapa":d.step==="request"?"Solicitud":d.step==="load_confirmation"?"Carga":d.step==="assignment"?"Asignación":"Otro", "Fecha":d.createdAt?new Date(d.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}):"", "URL":d.url||"" });
      }));
      if(allDocs.length>0) {
        const wsD = XLSX.utils.json_to_sheet(allDocs);
        wsD['!cols'] = [{wch:12},{wch:25},{wch:10},{wch:12},{wch:12},{wch:50}];
        XLSX.utils.book_append_sheet(wb, wsD, "Documentos");
      }
      // Audit sheet — fetch all audit logs
      try {
        const auditRows = [];
        const fmtDt = d => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; }};
        const actionLabels = { created:"Solicitado", assigned:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Viaje iniciado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado" };
        for (const f of filteredForExport) {
          try {
            const logs = await apiGetAuditLog(f.id);
            (logs||[]).forEach(l => {
              auditRows.push({ "Flete":f.code, "Acción":actionLabels[l.action]||l.action, "Usuario":l.user?.name||"", "Empresa":l.user?.company?.name||"", "Motivo":l.reason||"", "Fecha":fmtDt(l.createdAt) });
            });
          } catch(e) { /* skip */ }
        }
        if(auditRows.length>0) {
          const wsA = XLSX.utils.json_to_sheet(auditRows);
          wsA['!cols'] = [{wch:12},{wch:20},{wch:20},{wch:20},{wch:30},{wch:18}];
          XLSX.utils.book_append_sheet(wb, wsA, "Historial");
        }
      } catch(e) { /* skip audit */ }
      const label = filterStatus==="all"?"todos":filterStatus==="active"?"activos":filterStatus;
      XLSX.writeFile(wb, `tolvink-fletes-${label}-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { console.error("Excel error",e); }
    setGenerating(null);
  };

  // Excel — single freight
  const generateFreightExcel = async (f) => {
    setGenerating(f.id+"x");
    try {
      const XLSX = await loadXLSX();
      const info = [
        ["Código", f.code], ["Estado", stCfg(f.status).label],
        ["Producto", f.grain==="Otros"?f.productTypeOther||"Otros":f.grain],
        ["Cantidad", `${f.tons} ${f.unit||"tn"}`],
        f.amount>0&&["Importe", `$${Number(f.amount).toLocaleString()}`],
        ["Origen", f.originName], f.fieldName&&["Campo", f.fieldName],
        ["Destino", f.destName], ["Fecha carga", f.loadDate],
        f.loadTime&&["Hora", f.loadTime], ["Solicitado por", f.requestedByName],
        f.transporterName&&["Transportista", f.transporterName],
        f.truckPlate&&["Matrícula", f.truckPlate], f.truckModel&&["Modelo", f.truckModel],
        f.driverName&&["Chofer", f.driverName], f.driverPhone&&["Teléfono", f.driverPhone],
        f.isOwnFleet&&["Flota propia", "Sí"], f.notes&&["Notas", f.notes],
        ["Creado", f.createdAt?new Date(f.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}):""],
      ].filter(Boolean);
      const ws = XLSX.utils.aoa_to_sheet([["Campo","Valor"], ...info]);
      ws['!cols'] = [{wch:18},{wch:40}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Informe");
      const docs = f.documents||[];
      if(docs.length>0) {
        const wsD = XLSX.utils.json_to_sheet(docs.map(d=>({ "Documento":d.name||"Documento", "Tipo":d.type||"otro", "Etapa":d.step==="request"?"Solicitud":d.step==="load_confirmation"?"Carga":"Otro", "Fecha":d.createdAt?new Date(d.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}):"", "URL":d.url||"" })));
        XLSX.utils.book_append_sheet(wb, wsD, "Documentos");
      }
      // Audit sheet
      try {
        const logs = await apiGetAuditLog(f.id);
        const fmtDt = d => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; }};
        const actionLabels = { created:"Solicitado", assigned:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Viaje iniciado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado" };
        if(logs && logs.length>0) {
          const wsA = XLSX.utils.json_to_sheet(logs.map(l=>({ "Acción":actionLabels[l.action]||l.action, "Usuario":l.user?.name||"", "Empresa":l.user?.company?.name||"", "Motivo":l.reason||"", "Fecha":fmtDt(l.createdAt) })));
          wsA['!cols'] = [{wch:20},{wch:20},{wch:20},{wch:30},{wch:18}];
          XLSX.utils.book_append_sheet(wb, wsA, "Historial");
        }
      } catch(e) { /* skip */ }
      XLSX.writeFile(wb, `${f.code}-informe.xlsx`);
    } catch(e) { console.error("Excel error",e); }
    setGenerating(null);
  };

  // PDF generation for a single freight
  const generatePDF = async (f) => {
    setGenerating(f.id);
    try {
      if(!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const st = stCfg(f.status);
      const lm = 18; const rm = 192; const pw = rm - lm;
      let y = 0;

      const addFooter = (pg, total) => {
        doc.setDrawColor(26,107,55); doc.setLineWidth(0.5);
        doc.line(lm, 280, rm, 280);
        doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(140,140,140);
        doc.text("tolvink — Plataforma de gestión logística de fletes", lm, 285);
        doc.text(`Generado: ${new Date().toLocaleString("es-AR")}`, lm + 80, 285);
        doc.text(`Pág. ${pg}/${total}`, rm - 15, 285);
      };
      const checkPage = (need) => { if(y+need>268) { doc.addPage(); y=20; return true; } return false; };

      // ─── HEADER BAR ───
      doc.setFillColor(26,107,55); doc.rect(0, 0, 210, 28, "F");
      doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
      doc.text("tolvink", lm, 16);
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(200,230,210);
      doc.text("Informe de Flete", lm + 44, 16);
      // Code badge right
      doc.setFontSize(14); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
      doc.text(f.code, rm - doc.getTextWidth(f.code), 16);
      doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(200,230,210);
      const idStr = `ID: ${f.id?.slice(0,8)||"—"}`;
      doc.text(idStr, rm - doc.getTextWidth(idStr), 23);

      y = 36;

      // ─── STATUS + SUMMARY LINE ───
      doc.setFillColor(245,247,245); doc.roundedRect(lm, y, pw, 18, 3, 3, "F");
      doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
      doc.text(`${f.grain==="Otros"?f.productTypeOther||"Otros":f.grain} · ${f.tons} ${f.unit||"tn"}`, lm + 6, y + 11);
      const stLabel = `Estado: ${st.label}`;
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
      doc.text(stLabel, rm - 6 - doc.getTextWidth(stLabel), y + 11);
      y += 26;

      // ─── INFO TABLE (two-column layout) ───
      const sectionTitle = (title) => {
        checkPage(18);
        doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(26,107,55);
        doc.text(title, lm, y); y += 2;
        doc.setDrawColor(26,107,55); doc.setLineWidth(0.3); doc.line(lm, y, rm, y); y += 7;
      };

      const infoRow = (label, val, highlight) => {
        checkPage(9);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(110,110,110);
        doc.text(label, lm, y);
        doc.setFont("helvetica", highlight?"bold":"normal"); doc.setTextColor(30,30,30);
        const valStr = String(val||"—");
        const maxW = pw - 58;
        const lines = doc.splitTextToSize(valStr, maxW);
        doc.text(lines, lm + 56, y);
        y += 6 * lines.length;
      };

      sectionTitle("Datos del Flete");
      infoRow("Código", f.code, true);
      infoRow("Producto", `${f.grain==="Otros"?f.productTypeOther||"Otros":f.grain}`, true);
      infoRow("Cantidad", `${f.tons} ${f.unit||"tn"}`, true);
      if(f.amount>0) infoRow("Importe", `$${Number(f.amount).toLocaleString()}`);
      infoRow("Estado", st.label);
      y += 3;

      sectionTitle("Logística");
      infoRow("Origen", f.originName);
      if(f.fieldName) infoRow("Campo", f.fieldName);
      infoRow("Destino", f.destName);
      infoRow("Fecha carga", f.loadDate || "—");
      if(f.loadTime) infoRow("Hora carga", f.loadTime);
      y += 3;

      sectionTitle("Participantes");
      infoRow("Solicitado por", f.requestedByName);
      if(f.transporterName) infoRow("Transportista", f.transporterName);
      if(f.truckPlate) infoRow("Camión", `${f.truckPlate}${f.truckModel?` · ${f.truckModel}`:""}`);
      if(f.driverName) infoRow("Chofer", f.driverName);
      if(f.driverPhone) infoRow("Teléfono", f.driverPhone);
      if(f.isOwnFleet) infoRow("Tipo", "Flota propia del productor");
      y += 3;

      if(f.notes) {
        sectionTitle("Observaciones");
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
        const noteLines = doc.splitTextToSize(f.notes, pw);
        noteLines.forEach(l => { checkPage(6); doc.text(l, lm, y); y += 5; });
        y += 3;
      }

      sectionTitle("Identificadores");
      infoRow("ID interno", f.id || "—");
      infoRow("Código", f.code);
      infoRow("Creado", f.createdAt ? new Date(f.createdAt).toLocaleString("es-AR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—");

      // ─── QR-like code block ───
      y += 5; checkPage(30);
      doc.setFillColor(245,247,245); doc.roundedRect(lm, y, pw, 22, 2, 2, "F");
      doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
      doc.text("Verificación:", lm + 4, y + 9);
      doc.setFont("courier","bold"); doc.setFontSize(9); doc.setTextColor(26,107,55);
      const verCode = `${f.code}-${(f.id||"").slice(0,8).toUpperCase()}`;
      doc.text(verCode, lm + 34, y + 9);
      doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(130,130,130);
      doc.text(`Fecha generación: ${new Date().toISOString().slice(0,19).replace("T"," ")}`, lm + 4, y + 17);
      y += 28;

      // ─── DOCUMENTS ───
      const docs = f.documents||[];
      if(docs.length>0) {
        sectionTitle(`Documentos adjuntos (${docs.length})`);
        doc.setFontSize(8.5); doc.setFont("helvetica","normal");
        docs.forEach((d,i)=>{
          checkPage(12);
          const stepLabel = d.step==="request"?"Solicitud":d.step==="load_confirmation"?"Carga":d.step==="assignment"?"Asignación":"Otro";
          const dateStr = d.createdAt?new Date(d.createdAt).toLocaleDateString("es",{day:"2-digit",month:"short"}):"";
          doc.setTextColor(30,30,30);
          doc.text(`${i+1}. ${d.name||"Documento"}`, lm, y);
          doc.setTextColor(100,100,100);
          doc.text(`${stepLabel} · ${dateStr}`, lm+78, y);
          y+=5;
          if(d.url) {
            doc.setTextColor(0,56,130);
            doc.textWithLink(d.url.length>55?d.url.slice(0,55)+"...":d.url, lm+4, y, {url:d.url});
            y+=6;
          }
        });
        y += 3;
      }

      // ─── AUDIT HISTORY ───
      try {
        const logs = await apiGetAuditLog(f.id);
        const actionLabels = { created:"Solicitado", assigned:"Asignado", accepted:"Aceptado", rejected:"Rechazado", started:"Viaje iniciado", confirm_loaded:"Carga confirmada", confirm_finished:"Entrega confirmada", finished:"Finalizado", canceled:"Cancelado", authorized:"Autorizado", updated:"Editado" };
        if(logs && logs.length>0) {
          sectionTitle(`Historial de cambios (${logs.length})`);
          doc.setFontSize(8.5);
          logs.forEach(l => {
            checkPage(10);
            const fmtDt = d => { try { const dt=new Date(d); return dt.toLocaleDateString("es-AR",{day:"2-digit",month:"short"})+" "+dt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",hour12:false}); } catch(e){ return ""; }};
            doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
            doc.text(actionLabels[l.action]||l.action, lm, y);
            doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
            doc.text(`${l.user?.name||""} ${l.user?.company?.name?`· ${l.user.company.name}`:""}`, lm+42, y);
            doc.setTextColor(150,150,150);
            doc.text(fmtDt(l.createdAt), rm - 35, y);
            y += 5;
            if(l.reason) { doc.setTextColor(120,120,120); doc.text(`  Motivo: ${l.reason}`, lm, y); y += 5; }
          });
        }
      } catch(e) { /* skip audit */ }

      // ─── ADD FOOTERS TO ALL PAGES ───
      const totalPages = doc.internal.getNumberOfPages();
      for(let p=1; p<=totalPages; p++) { doc.setPage(p); addFooter(p, totalPages); }

      doc.save(`${f.code}-informe.pdf`);
    } catch(e) { console.error("PDF error",e); }
    setGenerating(null);
  };

  // Generate summary PDF of all freights
  const generateSummaryPDF = async () => {
    setGenerating("summary");
    try {
      if(!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 0;
      const lm = 18; const rm = 192; const pw = rm - lm;

      // Header bar
      doc.setFillColor(26,107,55); doc.rect(0, 0, 210, 28, "F");
      doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
      doc.text("tolvink", lm, 16);
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(200,230,210);
      doc.text("Resumen de Fletes", lm + 44, 16);
      doc.setFontSize(8); doc.setTextColor(200,230,210);
      doc.text(new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"}), rm - 40, 16);

      y = 36;
      doc.setFillColor(245,247,245); doc.roundedRect(lm, y, pw, 14, 2, 2, "F");
      doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
      doc.text(`${allFreights.length} fletes · ${totalDocs} documentos`, lm + 6, y + 9);
      y += 22;

      // Table header
      doc.setFontSize(8.5); doc.setFont("helvetica","bold"); doc.setTextColor(26,107,55);
      doc.text("Código", lm, y); doc.text("Producto", lm+26, y); doc.text("Origen", lm+62, y); doc.text("Destino", lm+104, y); doc.text("Estado", lm+144, y);
      y+=2; doc.setDrawColor(26,107,55); doc.setLineWidth(0.3); doc.line(lm, y, rm, y); y+=5;

      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      allFreights.forEach(f=>{
        const st2 = stCfg(f.status);
        doc.setTextColor(30,30,30); doc.setFont("helvetica","bold");
        doc.text(f.code||"—", lm, y);
        doc.setFont("helvetica","normal");
        doc.text(`${(f.grain||"").slice(0,12)} ${f.tons}${f.unit==="toneladas"?"tn":f.unit||""}`, lm+26, y);
        doc.text((f.originName||"").slice(0,22), lm+62, y);
        doc.text((f.destName||"").slice(0,22), lm+104, y);
        doc.setTextColor(100,100,100);
        doc.text(st2.label, lm+144, y);
        y+=6;
        if(y>268) { doc.addPage(); y=20; }
      });

      // Footer on all pages
      const totalPages = doc.internal.getNumberOfPages();
      for(let p=1; p<=totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(26,107,55); doc.setLineWidth(0.5); doc.line(lm, 280, rm, 280);
        doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(140,140,140);
        doc.text("tolvink — Plataforma de gestión logística de fletes", lm, 285);
        doc.text(`Pág. ${p}/${totalPages}`, rm - 15, 285);
      }

      doc.save(`tolvink-resumen-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch(e) { console.error("PDF error",e); }
    setGenerating(null);
  };

  return (
    <div style={{ flex:embedded?undefined:1, overflow:embedded?"visible":"auto", padding:embedded?0:18 }}>
      {!isDesktop && !embedded && <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Mi Perfil</button>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={{ fontSize:20, fontWeight:800, letterSpacing:-0.3 }}>Informes y Documentos</div>
      </div>
      <div style={{ fontSize:12, color:C.t2, marginBottom:12 }}>{allFreights.length} flete{allFreights.length!==1?"s":""} · {totalDocs} documento{totalDocs!==1?"s":""}</div>

      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:12 }}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ic.srch(C.t3,16)}</div>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar por código, origen, destino, producto..."
          style={{width:"100%",padding:"10px 14px 10px 36px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:12.5,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",display:"flex"}}>{Ic.cross(C.t3,16)}</button>}
      </div>

      {/* Status filter pills */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        {[{k:"all",l:"Todos"},{k:"active",l:"Activos"},{k:"finished",l:"Finalizados"},{k:"canceled",l:"Cancelados"}].map(opt=>(
          <button key={opt.k} onClick={()=>setFilterStatus(opt.k)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${filterStatus===opt.k?C.pri:C.b1}`, background:filterStatus===opt.k?C.priPale:C.w, color:filterStatus===opt.k?C.pri:C.t2, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>{opt.l}</button>
        ))}
      </div>

      {/* Column selector */}
      <button onClick={()=>setShowColPicker(!showColPicker)} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:10, padding:"10px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600, color:C.sec, display:"flex", alignItems:"center", gap:6, marginBottom:showColPicker?0:10, width:"100%" }}>
        {Ic.doc(C.sec,14)} Columnas del Excel ({selectedCols.length}/{REPORT_COLUMNS.length})
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.sec} strokeWidth="2.5" style={{marginLeft:"auto",transform:showColPicker?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {showColPicker && (
        <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:12, marginBottom:10, boxShadow:C.sh }}>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <button onClick={()=>setSelectedCols(REPORT_COLUMNS.map(c=>c.key))} style={{fontSize:10,fontWeight:600,color:C.pri,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Todas</button>
            <span style={{color:C.t3}}>·</span>
            <button onClick={()=>setSelectedCols(REPORT_COLUMNS.filter(c=>c.default).map(c=>c.key))} style={{fontSize:10,fontWeight:600,color:C.t2,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Predeterminadas</button>
            <span style={{color:C.t3}}>·</span>
            <button onClick={()=>setSelectedCols([])} style={{fontSize:10,fontWeight:600,color:C.err,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>Ninguna</button>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {REPORT_COLUMNS.map(col=>{
              const sel = selectedCols.includes(col.key);
              return <button key={col.key} onClick={()=>toggleCol(col.key)} style={{ padding:"5px 10px", borderRadius:8, border:`1.5px solid ${sel?C.sec:C.b1}`, background:sel?C.secPale:C.w, color:sel?C.sec:C.t2, fontSize:10.5, fontWeight:sel?600:500, cursor:"pointer", fontFamily:"inherit" }}>{sel?"✓ ":""}{col.label}</button>;
            })}
          </div>
        </div>
      )}

      {/* Export buttons — Excel + PDF */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={generateExcel} disabled={generating==="excel"||selectedCols.length===0} style={{ flex:1, padding:"12px 10px", borderRadius:10, border:`1.5px solid ${C.sec}`, background:C.secPale, cursor:selectedCols.length===0?"default":"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, color:C.sec, display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:selectedCols.length===0?0.5:1 }}>
          {Ic.doc(C.sec,15)} {generating==="excel"?"Generando...":"Excel"}
        </button>
        <button onClick={generateSummaryPDF} disabled={generating==="summary"} style={{ flex:1, padding:"12px 10px", borderRadius:10, border:`1.5px solid ${C.pri}`, background:C.priPale, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, color:C.pri, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {Ic.doc(C.pri,15)} {generating==="summary"?"Generando...":"PDF"}
        </button>
      </div>

      {allFreights.length===0 && <div style={{ textAlign:"center", padding:40, color:C.t3, fontSize:13 }}>No hay fletes registrados.</div>}

      {groups.map(group=>(
        <div key={group.key} style={{ marginBottom:16 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{width:8,height:8,borderRadius:4,background:group.color}}/>
            {group.label} ({group.items.length})
          </div>

          {group.items.map(f=>{
            const isOpen = expanded[f.id];
            const docs = f.documents||[];
            return (
              <div key={f.id} style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", marginBottom:8, boxShadow:C.sh }}>
                <button onClick={()=>toggle(f.id)} style={{ width:"100%", padding:"12px 14px", background:C.w, border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
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
                    {/* Export buttons */}
                    <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                      <button onClick={()=>generateFreightExcel(f)} disabled={generating===f.id+"x"}
                        style={{ flex:1, padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.sec}30`, background:C.secPale, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600, color:C.sec, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                        {Ic.doc(C.sec,13)} {generating===f.id+"x"?"...":"Excel"}
                      </button>
                      <button onClick={()=>generatePDF(f)} disabled={generating===f.id}
                        style={{ flex:1, padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.pri}30`, background:C.priPale, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600, color:C.pri, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                        {Ic.doc(C.pri,13)} {generating===f.id?"...":"PDF"}
                      </button>
                    </div>

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
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:"16px 16px max(16px, env(safe-area-inset-bottom))"}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Asignar transporte · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn · {freight.originName}</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Transportista</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
          {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10}}>No hay transportistas disponibles</div>}
          {ts.map(x=><button key={x.id} onClick={()=>setT(x.id)} style={{padding:"13px 14px",borderRadius:10,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${t===x.id?C.pri:C.b1}`,background:t===x.id?C.priPale:C.w,color:t===x.id?C.pri:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>{Ic.truck(t===x.id?C.pri:C.t3,16)} {x.name}</button>)}
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
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:"16px 16px max(16px, env(safe-area-inset-bottom))"}}>
      <div style={{background:C.w,borderRadius:18,padding:22,width:"100%",maxWidth:400,boxShadow:C.shLg}}>
        <div style={{fontSize:17,fontWeight:700,marginBottom:4}}>Aceptar flete · {freight.code}</div>
        <div style={{fontSize:12,color:C.t2,marginBottom:18}}>{freight.grain} · {freight.tons}tn → {freight.destName}</div>
        <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:8,display:"block",textTransform:"uppercase",letterSpacing:0.6}}>Seleccioná un camión</label>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18,maxHeight:220,overflowY:"auto"}}>
          {ts.length===0 && <div style={{fontSize:12,color:C.t3,padding:10,textAlign:"center"}}>No tenés camiones registrados.<br/><span style={{color:C.acc,fontWeight:600}}>Registrá uno desde tu perfil.</span></div>}
          {ts.map(t=><button key={t.id} onClick={()=>setSel(t.id)} style={{padding:"13px 14px",borderRadius:10,textAlign:"left",fontFamily:"inherit",border:`1.5px solid ${sel===t.id?C.acc:C.b1}`,background:sel===t.id?C.accPale:C.w,color:sel===t.id?C.acc:C.t2,fontSize:13.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
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
    <div style={{position:"fixed",inset:0,background:C.bgOverlay,display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,padding:"16px 16px max(16px, env(safe-area-inset-bottom))"}}>
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

// ======================== ADMIN SCREEN ================================
function AdminScreen({ user, onBack }) {
  const isPlatform = user.role === "platform_admin";
  const [tab, setTab] = useState("companies");
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name:"",type:"producer",phone:"",email:"",rut:"",hasInternalFleet:false,lat:null,lng:null });
  const [userForm, setUserForm] = useState({ name:"",email:"",phone:"",password:"",userTypes:[],role:"operator",companyId:"" });
  const [branchForm, setBranchForm] = useState({ name:"",address:"",reference:"",companyId:"",lat:null,lng:null });

  // Detail view
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showBranchForm, setShowBranchForm] = useState(false);

  const typeColors = { producer:"#F59E0B",plant:"#6366F1",transporter:"#3B82F6" };
  const typeLabels = { producer:"Productor",plant:"Planta",transporter:"Transportista" };
  const roleLabels = { platform_admin:"Admin Principal",admin:"Gerente",operator:"Operario" };

  const show = (t,k="ok") => { setMsg({t,k}); setTimeout(()=>setMsg(null),3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([apiAdminListCompanies(), apiAdminListUsers()]);
      setCompanies(c||[]); setUsers(u||[]);
      if(isPlatform) { const s = await apiAdminStats(); setStats(s); }
    } catch(e) { show(e.message,"err"); }
    finally { setLoading(false); }
  }, [isPlatform]);

  useEffect(() => { load(); }, [load]);

  // Search
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if(tab==="companies") { const c=await apiAdminListCompanies(search); setCompanies(c||[]); }
        else { const u=await apiAdminListUsers(search); setUsers(u||[]); }
      } catch {}
    }, 300);
    return ()=>clearTimeout(t);
  }, [search, tab]);

  // Company CRUD
  const handleCreateCompany = async () => {
    if(!companyForm.name.trim()) return show("Nombre requerido","err");
    setSaving(true);
    try { await apiAdminCreateCompany(companyForm); show("Empresa creada"); setShowForm(false); setCompanyForm({name:"",type:"producer",phone:"",email:"",rut:"",hasInternalFleet:false,lat:null,lng:null}); load(); }
    catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };

  // User CRUD
  const toggleUserType = (t) => setUserForm(p=>({...p,userTypes:p.userTypes.includes(t)?p.userTypes.filter(x=>x!==t):[...p.userTypes,t]}));

  const handleCreateUser = async () => {
    if(!userForm.name.trim()||!userForm.email.trim()||!userForm.password) return show("Nombre, email y contraseña obligatorios","err");
    setSaving(true);
    try { await apiAdminCreateUser({...userForm,companyId:userForm.companyId||undefined}); show("Usuario creado"); setShowForm(false); setUserForm({name:"",email:"",phone:"",password:"",userTypes:[],role:"operator",companyId:""}); load(); }
    catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };

  const handleUpdateUser = async (id, data) => {
    try { await apiAdminUpdateUser(id, data); show("Usuario actualizado"); load(); }
    catch(e) { show(e.message,"err"); }
  };

  // Branch CRUD
  const loadBranches = async (companyId) => {
    try { const b = await apiAdminListBranches(companyId); setBranches(b||[]); } catch {}
  };

  const openCompanyDetail = async (c) => {
    setSelectedCompany(c); await loadBranches(c.id);
  };

  const handleCreateBranch = async () => {
    if(!branchForm.name.trim()) return show("Nombre requerido","err");
    setSaving(true);
    try { await apiAdminCreateBranch({...branchForm,companyId:selectedCompany.id}); show("Sucursal creada"); setShowBranchForm(false); setBranchForm({name:"",address:"",reference:"",companyId:"",lat:null,lng:null}); loadBranches(selectedCompany.id); load(); }
    catch(e) { show(e.message,"err"); } finally { setSaving(false); }
  };

  const handleDeleteBranch = async (id) => {
    try { await apiAdminDeleteBranch(id); show("Sucursal eliminada"); loadBranches(selectedCompany.id); load(); }
    catch(e) { show(e.message,"err"); }
  };

  // MapPicker inline
  const MapPicker = ({ lat, lng, onChange }) => {
    const mapRef = useRef(null);
    const [pin, setPin] = useState({ lat: lat||-34.9, lng: lng||-56.2 });
    const handleClick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const newLat = -30 - (y * 8);
      const newLng = -58 + (x * 6);
      const rounded = { lat: Math.round(newLat*1000)/1000, lng: Math.round(newLng*1000)/1000 };
      setPin(rounded); onChange(rounded);
    };
    return (
      <div style={{marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:4}}>Ubicación (clic para marcar):</div>
        <div ref={mapRef} onClick={handleClick} style={{width:"100%",height:150,borderRadius:8,border:`1px solid ${C.b1}`,background:`linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)`,cursor:"crosshair",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,opacity:0.1,background:"repeating-linear-gradient(0deg,transparent,transparent 30px,#000 30px,#000 31px),repeating-linear-gradient(90deg,transparent,transparent 30px,#000 30px,#000 31px)"}}/>
          {(pin.lat&&pin.lng) && <div style={{position:"absolute",left:`${((pin.lng+58)/6)*100}%`,top:`${((pin.lat+30)/-8)*100}%`,transform:"translate(-50%,-100%)",fontSize:24,filter:"drop-shadow(0 2px 2px rgba(0,0,0,0.3))"}}>📍</div>}
        </div>
        {(pin.lat&&pin.lng) && <div style={{fontSize:10,color:C.t3,marginTop:2}}>Lat: {pin.lat}, Lng: {pin.lng}</div>}
      </div>
    );
  };

  const inputStyle = { width:"100%", padding:"8px 10px", borderRadius:6, border:`1px solid ${C.b1}`, fontSize:13, fontFamily:"inherit", background:C.bgInput, color:C.t1, boxSizing:"border-box" };
  const halfInputStyle = { ...inputStyle, flex:1 };

  // === COMPANY DETAIL VIEW ===
  if (selectedCompany) {
    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        <button onClick={()=>setSelectedCompany(null)} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:12,padding:16,marginBottom:12,boxShadow:C.sh}}>
          <div style={{fontSize:16,fontWeight:700,color:C.t1}}>{selectedCompany.name}</div>
          <div style={{display:"flex",gap:6,marginTop:6}}>
            <Bd color={typeColors[selectedCompany.type]}>{typeLabels[selectedCompany.type]}</Bd>
            {selectedCompany.rut && <Bd color={C.t2}>RUT: {selectedCompany.rut}</Bd>}
          </div>
          {selectedCompany.email && <div style={{fontSize:12,color:C.t2,marginTop:4}}>{selectedCompany.email}</div>}
          {selectedCompany.phone && <div style={{fontSize:12,color:C.t3}}>{selectedCompany.phone}</div>}
        </div>

        {/* Branches */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:700,color:C.t1}}>Sucursales ({branches.length})</div>
          <button onClick={()=>setShowBranchForm(!showBranchForm)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${C.pri}`,background:`${C.pri}12`,color:C.pri,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showBranchForm?"Cancelar":"+ Nueva"}</button>
        </div>

        {showBranchForm && (
          <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:C.sh}}>
            <input value={branchForm.name} onChange={e=>setBranchForm({...branchForm,name:e.target.value})} placeholder="Nombre de sucursal" style={{...inputStyle,marginBottom:8}} />
            <input value={branchForm.address} onChange={e=>setBranchForm({...branchForm,address:e.target.value})} placeholder="Dirección" style={{...inputStyle,marginBottom:8}} />
            <input value={branchForm.reference} onChange={e=>setBranchForm({...branchForm,reference:e.target.value})} placeholder="Referencia (opcional)" style={{...inputStyle,marginBottom:8}} />
            <MapPicker lat={branchForm.lat} lng={branchForm.lng} onChange={({lat,lng})=>setBranchForm({...branchForm,lat,lng})} />
            <button onClick={handleCreateBranch} disabled={saving} style={{width:"100%",padding:"10px 0",borderRadius:8,background:C.pri,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>{saving?"Creando...":"Crear sucursal"}</button>
          </div>
        )}

        {branches.map(b => (
          <div key={b.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",marginBottom:8,boxShadow:C.sh,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{b.name}</div>
              {b.address && <div style={{fontSize:11,color:C.t3}}>{b.address}</div>}
              {b.reference && <div style={{fontSize:10,color:C.t3,fontStyle:"italic"}}>{b.reference}</div>}
              {b.lat && <div style={{fontSize:9,color:C.t3}}>📍 {Number(b.lat).toFixed(3)}, {Number(b.lng).toFixed(3)}</div>}
            </div>
            <button onClick={()=>handleDeleteBranch(b.id)} style={{background:"none",border:`1px solid ${C.err}30`,borderRadius:6,padding:"4px 8px",fontSize:10,color:C.err,cursor:"pointer",fontFamily:"inherit"}}>Eliminar</button>
          </div>
        ))}
        {branches.length===0 && !showBranchForm && <div style={{textAlign:"center",padding:20,color:C.t3,fontSize:12}}>Sin sucursales</div>}

        {msg && <div style={{padding:"8px 12px",borderRadius:8,background:msg.k==="ok"?C.okPale:`${C.err}15`,color:msg.k==="ok"?C.ok:C.err,fontSize:12,marginTop:10}}>{msg.t}</div>}
      </div>
    );
  }

  // === MAIN ADMIN VIEW ===
  return (
    <div style={{flex:1,overflow:"auto",padding:18}}>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button>
      <div style={{fontSize:18,fontWeight:800,color:C.t1,marginBottom:4}}>Administración</div>
      <div style={{fontSize:11,color:C.t3,marginBottom:14}}>{isPlatform?"Admin Principal — Control total":"Gerente — Tu empresa"}</div>

      {/* Stats */}
      {stats && isPlatform && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
          {[{l:"Empresas",v:stats.companies,c:C.pri},{l:"Sucursales",v:stats.branches,c:C.info||"#3B82F6"},{l:"Usuarios",v:stats.users,c:C.acc},{l:"Fletes",v:stats.freights,c:C.ok}].map(s=>(
            <div key={s.l} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:8,padding:"10px 8px",textAlign:"center",boxShadow:C.sh}}>
              <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
              <div style={{fontSize:9,color:C.t3}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {["companies","users"].map(t=>(
          <button key={t} onClick={()=>{setTab(t);setSearch("");setShowForm(false);}} style={{flex:1,padding:"9px 0",borderRadius:8,border:`1px solid ${tab===t?C.pri:C.b1}`,background:tab===t?`${C.pri}12`:C.w,color:tab===t?C.pri:C.t2,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            {t==="companies"?"Empresas":"Usuarios"}
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="companies"?"Buscar empresa o RUT...":"Buscar usuario..."} style={{...inputStyle,marginBottom:10,paddingLeft:12}} />

      {/* Message */}
      {msg && <div style={{padding:"8px 12px",borderRadius:8,background:msg.k==="ok"?C.okPale:`${C.err}15`,color:msg.k==="ok"?C.ok:C.err,fontSize:12,marginBottom:10,display:"flex",justifyContent:"space-between"}}>{msg.t}<button onClick={()=>setMsg(null)} style={{background:"none",border:"none",cursor:"pointer",color:"inherit"}}>✕</button></div>}

      {loading ? <div style={{textAlign:"center",padding:40,color:C.t3}}>Cargando...</div> : (<>

        {/* ===== COMPANIES TAB ===== */}
        {tab==="companies" && (<>
          {isPlatform && <button onClick={()=>setShowForm(!showForm)} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px dashed ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{showForm?"Cancelar":"+ Nueva Empresa"}</button>}

          {showForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <input value={companyForm.name} onChange={e=>setCompanyForm({...companyForm,name:e.target.value})} placeholder="Nombre" style={{...inputStyle,marginBottom:8}} />
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {["producer","plant","transporter"].map(t=>(<button key={t} onClick={()=>setCompanyForm({...companyForm,type:t})} style={{flex:1,padding:"8px 0",borderRadius:6,border:`1px solid ${companyForm.type===t?typeColors[t]:C.b1}`,background:companyForm.type===t?`${typeColors[t]}15`:C.w,color:companyForm.type===t?typeColors[t]:C.t2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{typeLabels[t]}</button>))}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <input value={companyForm.email} onChange={e=>setCompanyForm({...companyForm,email:e.target.value})} placeholder="Email" style={halfInputStyle} />
                <input value={companyForm.phone} onChange={e=>setCompanyForm({...companyForm,phone:e.target.value})} placeholder="Teléfono" style={halfInputStyle} />
              </div>
              <input value={companyForm.rut} onChange={e=>setCompanyForm({...companyForm,rut:e.target.value})} placeholder="RUT" style={{...inputStyle,marginBottom:8}} />
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.t2,marginBottom:8,cursor:"pointer"}}>
                <input type="checkbox" checked={companyForm.hasInternalFleet} onChange={e=>setCompanyForm({...companyForm,hasInternalFleet:e.target.checked})} /> Flota propia
              </label>
              <MapPicker lat={companyForm.lat} lng={companyForm.lng} onChange={({lat,lng})=>setCompanyForm({...companyForm,lat,lng})} />
              <button onClick={handleCreateCompany} disabled={saving} style={{width:"100%",padding:"10px 0",borderRadius:8,background:C.pri,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>{saving?"Creando...":"Crear empresa"}</button>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {companies.map(c=>(
              <button key={c.id} onClick={()=>openCompanyDetail(c)} className="tv-card" style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",boxShadow:C.sh,cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.t1}}>{c.name}</div>
                    <div style={{fontSize:11,color:C.t3,marginTop:2}}>{c.email||""} {c.rut?`· RUT: ${c.rut}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    <Bd color={typeColors[c.type]}>{typeLabels[c.type]}</Bd>
                    <div style={{fontSize:10,color:C.t3,background:C.bgInput,padding:"2px 6px",borderRadius:4}}>{c._count?.users||0} usr · {c._count?.branches||0} suc</div>
                    {Ic.chev(C.t3,14)}
                  </div>
                </div>
              </button>
            ))}
            {companies.length===0 && <div style={{textAlign:"center",padding:24,color:C.t3,fontSize:13}}>No se encontraron empresas</div>}
          </div>
        </>)}

        {/* ===== USERS TAB ===== */}
        {tab==="users" && (<>
          <button onClick={()=>setShowForm(!showForm)} style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px dashed ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>{showForm?"Cancelar":"+ Nuevo Usuario"}</button>

          {showForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="Nombre completo" style={{...inputStyle,marginBottom:8}} />
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <input value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} placeholder="Email" type="email" style={halfInputStyle} />
                <input value={userForm.phone} onChange={e=>setUserForm({...userForm,phone:e.target.value})} placeholder="Teléfono" style={halfInputStyle} />
              </div>
              <input value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} placeholder="Contraseña" type="password" style={{...inputStyle,marginBottom:8}} />
              <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:4}}>Tipo:</div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {["producer","plant","transporter"].map(t=>{const sel=userForm.userTypes.includes(t);return(<button key={t} onClick={()=>toggleUserType(t)} style={{flex:1,padding:"8px 0",borderRadius:6,border:`1px solid ${sel?typeColors[t]:C.b1}`,background:sel?`${typeColors[t]}15`:C.w,color:sel?typeColors[t]:C.t2,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{sel?"✓ ":""}{typeLabels[t]}</button>);})}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:4}}>Rol:</div>
                  <select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})} style={inputStyle}>
                    <option value="operator">Operario</option>
                    <option value="admin">Gerente de empresa</option>
                    {isPlatform && <option value="platform_admin">Admin Principal</option>}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.t3,marginBottom:4}}>Empresa:</div>
                  <select value={userForm.companyId} onChange={e=>setUserForm({...userForm,companyId:e.target.value})} style={inputStyle}>
                    <option value="">Sin empresa</option>
                    {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleCreateUser} disabled={saving} style={{width:"100%",padding:"10px 0",borderRadius:8,background:C.acc,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>{saving?"Creando...":"Crear usuario"}</button>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {users.map(u=>(
              <div key={u.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:10,padding:"12px 14px",boxShadow:C.sh}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.t1}}>{u.name}</div>
                    <div style={{fontSize:11.5,color:C.t2,marginTop:1}}>{u.email}</div>
                    {u.phone && <div style={{fontSize:11,color:C.t3}}>{u.phone}</div>}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <Bd color={u.active?C.ok:C.err}>{u.active?"Activo":"Inactivo"}</Bd>
                    <Bd color={C.t2}>{roleLabels[u.role]||u.role}</Bd>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.b2}`,flexWrap:"wrap"}}>
                  {u.company ? <Bd color={typeColors[u.company.type]}>{u.company.name}</Bd> : <span style={{fontSize:11,color:C.t3}}>Sin empresa</span>}
                  {isPlatform && !u.company && (
                    <select onChange={e=>{if(e.target.value)handleUpdateUser(u.id,{companyId:e.target.value});}} defaultValue="" style={{padding:"3px 6px",borderRadius:4,border:`1px solid ${C.b1}`,fontSize:10,background:C.bgInput,color:C.t1}}>
                      <option value="">Asignar empresa...</option>
                      {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                    <select onChange={e=>handleUpdateUser(u.id,{role:e.target.value})} value={u.role} style={{padding:"3px 6px",borderRadius:4,border:`1px solid ${C.b1}`,fontSize:10,background:C.bgInput,color:C.t1}}>
                      <option value="operator">Operario</option>
                      <option value="admin">Gerente</option>
                      {isPlatform && <option value="platform_admin">Admin</option>}
                    </select>
                    <button onClick={()=>handleUpdateUser(u.id,{active:!u.active})} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${u.active?C.err:C.ok}30`,background:"none",fontSize:10,color:u.active?C.err:C.ok,cursor:"pointer",fontFamily:"inherit"}}>{u.active?"Desactivar":"Activar"}</button>
                  </div>
                </div>
              </div>
            ))}
            {users.length===0 && <div style={{textAlign:"center",padding:24,color:C.t3,fontSize:13}}>No se encontraron usuarios</div>}
          </div>
        </>)}
      </>)}
    </div>
  );
}

// ======================== MAIN APP ====================================
export default function Tolvink() {
  const [theme, toggleTheme] = useTheme();
  // Update global C object when theme changes
  C = theme === "dark" ? { ...DARK } : { ...LIGHT };

  const auth = useAuth();
  const fh = useFreights(auth.user);
  const catalog = useCatalog(auth.user);
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

  // Poll for unread chats (simple: count convs with recent messages)
  useEffect(()=>{
    if(!auth.user) return;
    const checkUnread = async ()=>{
      try {
        const convs = await apiListConversations();
        const recent = (convs||[]).filter(c=>{
          const m = c.messages?.[0];
          if(!m) return false;
          const senderId = m.sender?.id || m.senderId;
          if(senderId === auth.user.id) return false;
          const age = Date.now() - new Date(m.createdAt).getTime();
          return age < 300000; // 5 min
        });
        setUnreadChats(recent.length);
      } catch {}
    };
    checkUnread();
    const iv = setInterval(checkUnread, 30000);
    return ()=>clearInterval(iv);
  },[auth.user]);

  const perms = useMemo(()=>permsFor(auth.user),[auth.user]);
  const show = (msg,type="ok")=>setToast({msg,type});
  const nav = (s,fId)=>{ if(s==="new_date"&&fId){if(!perms.canRequest){show("Sin permisos para solicitar","err");return;} setDuplicateData({preDate:fId});setScreen("new");return;} if(fId){ setSelFreight(fId); if(s==="detail") fh.refresh(fId); } if(s==="new"&&!perms.canRequest){show("Sin permisos para solicitar","err");return;} setScreen(s); };

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
    if(r.ok){ setModal(null); show("Flete aceptado"); } else { setModal(null); show(r.error,"err"); }
  };

  const handleAssign = async (fId, transportCompanyId)=>{
    const r = await fh.assign(fId, transportCompanyId);
    if(r.ok){ setModal(null); show("Transportista asignado"); } else { setModal(null); show(r.error,"err"); }
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
    if(r.ok){ setScreen("list"); show("Flete solicitado"); } else show(r.error,"err");
  };

  if(auth.loading) return <div style={{minHeight:"100dvh",background:C.bg,fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,800&display=swap');@keyframes splashIn{0%{opacity:0;transform:scale(0.7)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}@keyframes dotPulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}*{margin:0;padding:0;box-sizing:border-box}html,body,#root{background:${C.bg};margin:0;height:auto!important;overflow:visible!important}`}</style>
    <div style={{textAlign:"center",animation:"splashIn 0.8s ease-out forwards"}}>
      <span style={{fontSize:72,fontWeight:800,color:C.pri,letterSpacing:-3,display:"inline-block"}}>tolvink</span>
      <span style={{width:14,height:14,borderRadius:7,background:C.acc,display:"inline-block",marginLeft:4,marginTop:-30,verticalAlign:"top",animation:"dotPulse 1.5s ease-in-out infinite"}}></span>
    </div>
  </div>;

  if(!auth.user) return <LandingScreen onLogin={auth.login} onSignup={auth.signup} loading={auth.loading} error={auth.error} clearError={auth.clearError}/>;
  const curFreight = fh.freights.find(f=>f.id===selFreight);
  const navActive = ["detail"].includes(screen)?"list":["trucks","fields","access","admin"].includes(screen)?"profile":(!isDesktop&&screen==="reports")?"profile":(!isDesktop&&screen==="calendar")?"profile":screen;

  return (
    <div className="tv-shell" style={{height:"100dvh",background:C.bg,color:C.t1,fontFamily:FONT,display:"flex",flexDirection:isDesktop?"row":"column",maxWidth:isDesktop?1400:1100,width:"100%",margin:"0 auto",position:"relative",overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html,body{height:100%;margin:0;overflow-x:hidden;max-width:100vw}body{background:${C.bg};overflow-y:hidden;overscroll-behavior:none}input,textarea,select,button{font-size:16px}input::placeholder,textarea::placeholder{color:${C.t3}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.b1};border-radius:4px}@keyframes ti{0%,100%{opacity:1}50%{opacity:.4}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.tv-card{transition:transform 0.15s ease,box-shadow 0.15s ease}.tv-row{transition:background 0.1s ease}@media(hover:hover){.tv-card:hover{transform:translateY(-2px);box-shadow:${C.shMd}!important}.tv-row:hover{background:${C.priGhost}!important}}@media(min-width:640px){.tv-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}.tv-grid3{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:12px!important}.tv-pad{padding:24px 32px!important}.tv-detail-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:16px!important}.tv-table th,.tv-table td{padding:10px 12px!important;font-size:12px!important}.tv-stats{gap:12px!important}.tv-stats>div{padding:14px 12px!important;border-radius:12px!important}.tv-stats .tv-stat-num{font-size:28px!important}.tv-header-bar{padding:10px 32px 0 32px!important}}@media(min-width:768px){.tv-shell{max-width:1400px!important}.tv-mobile-header{display:none!important}.tv-mobile-nav{display:none!important}.tv-kanban{flex-direction:row!important;gap:12px!important}.tv-kanban-col{max-height:calc(100vh - 280px)!important;overflow-y:auto!important}}@media(max-width:767px){.tv-sidebar{display:none!important}.tv-shell{max-width:100vw!important;width:100%!important}}@media(min-width:900px){.tv-grid{grid-template-columns:1fr 1fr 1fr!important}}@media(min-width:1100px){.tv-grid{grid-template-columns:repeat(4,1fr)!important}}`}</style>

      {/* Desktop Sidebar */}
      <div className="tv-sidebar">
        <Sidebar active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} canRequest={perms.canRequest} onNew={()=>nav("new")} />
      </div>

      {/* Main content column */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        {/* Mobile-only header */}
        <div className="tv-mobile-header" style={{paddingTop:"max(12px, env(safe-area-inset-top))",paddingBottom:12,paddingLeft:18,paddingRight:18,display:"flex",alignItems:"center",borderBottom:`1px solid ${C.b2}`,background:C.w,flexShrink:0,zIndex:10}}>
          <span style={{fontSize:26,fontWeight:800,color:C.pri,letterSpacing:-0.8}}>tolvink</span>
          <span style={{width:7,height:7,borderRadius:4,background:C.acc,display:"inline-block",marginLeft:3,marginTop:-12}}></span>
        </div>

        {/* Scrollable content area */}
        <div style={{flex:1,overflow:(screen==="chats"||screen==="calendar")&&isDesktop?"hidden":"auto",display:"flex",flexDirection:"column",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
        {screen==="home" && <HomeScreen user={auth.user} freights={fh.freights} perms={perms} onNav={nav} catalog={catalog} isDesktop={isDesktop}/>}
        {screen==="list" && <ListScreen freights={fh.freights} onNav={nav} onRefresh={fh.fetchAll}/>}
        {screen==="pending" && <PendingScreen user={auth.user} freights={fh.freights} onNav={nav} onNewFreight={()=>nav("new")}/>}
        {screen==="calendar" && <CalendarScreen freights={fh.freights} perms={perms} onNav={nav} isDesktop={isDesktop}/>}
        {screen==="detail" && <DetailScreen user={auth.user} freight={curFreight} perms={perms} onBack={()=>setScreen("list")} onAction={handleAction} actionLoading={actionLoading} onChat={(convId)=>{if(convId){setChatConvId(convId);setScreen("chats");}}} onRefresh={(id)=>fh.refresh(id)} onDuplicate={(f)=>{setDuplicateData(f);setScreen("new");}} onEdit={(f)=>{setEditData(f);setScreen("edit");}}/>}
        {screen==="new" && <NewScreen user={auth.user} lots={catalog.lots} plants={catalog.plants} fields={catalog.fields} trucks={catalog.trucks} onBack={()=>{setDuplicateData(null);setScreen("home");}} onCreate={handleCreate} submitting={submitting} duplicateFrom={duplicateData}/>}
        {screen==="edit" && editData && <EditScreen freight={editData} fields={catalog.fields} plants={catalog.plants} onBack={()=>{setEditData(null);setScreen("detail");}} onSave={async(id,data)=>{const r=await fh.update(id,data);if(r.ok){setEditData(null);setScreen("detail");show("Flete actualizado");}else show(r.error,"err");}}/>}
        {screen==="profile" && <ProfileScreen user={auth.user} perms={perms} onLogout={auth.logout} onNav={nav} theme={theme} toggleTheme={toggleTheme}/>}
        {screen==="trucks" && <TrucksScreen onBack={()=>{catalog.refresh();setScreen("profile");}}/>}
        {screen==="fields" && <FieldsScreen onBack={()=>{catalog.refresh();setScreen("profile");}}/>}
        {screen==="access" && <AccessScreen onBack={()=>setScreen("profile")}/>}
        {screen==="admin" && <AdminScreen user={auth.user} onBack={()=>setScreen("profile")}/>}
        {screen==="reports" && <ReportsScreen onBack={()=>setScreen(isDesktop?"reports":"profile")} freights={fh.freights} isDesktop={isDesktop}/>}
        {screen==="chats" && <ChatsScreen user={auth.user} openConvId={chatConvId} onConvOpened={()=>setChatConvId(null)} isDesktop={isDesktop}/>}
        </div>

        {/* Mobile-only bottom nav */}
        <div className="tv-mobile-nav">
          <Nav active={navActive} onChange={nav} unread={unreadChats} pendingCount={pendingCount} canRequest={perms.canRequest} onNew={()=>nav("new")}/>
        </div>
      </div>

      {modal?.type==="assign" && <AssignModal freight={modal.freight} transporters={catalog.transporters} onClose={()=>setModal(null)} onConfirm={t=>handleAssign(modal.freight.id,t)}/>}
      {modal?.type==="truck_select" && <TruckSelectModal freight={modal.freight} trucks={catalog.trucks} onClose={()=>setModal(null)} onConfirm={t=>handleAcceptWithTruck(modal.freight.id,t)}/>}
      {modal?.type==="reason" && <ReasonModal title={modal.title} freight={modal.freight} btnLabel={modal.btnLabel} onClose={()=>setModal(null)} onConfirm={r=>handleReasonAction(modal.freight.id,r,modal.action)}/>}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}
