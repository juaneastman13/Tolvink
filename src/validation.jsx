import { C } from "./theme";

// ======================== VALIDATION ENGINE ===========================
export const V = {
  req: (v, f) => (!v || (typeof v==='string' && !v.trim())) ? `${f} es obligatorio` : null,
  email: (v) => { if(!v) return 'Email es obligatorio'; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?null:'Email inválido'; },
  min: (n) => (v,f) => { if(!v) return `${f} es obligatorio`; return v.length>=n?null:`${f}: mínimo ${n} caracteres`; },
  maxLen: (n) => (v,f) => { if(v && typeof v==='string' && v.length>n) return `${f}: máximo ${n} caracteres`; return null; },
  posNum: (v, f) => { if(!v&&v!==0) return `${f} es obligatorio`; return Number(v)>0?null:`${f} debe ser mayor a 0`; },
  maxNum: (n) => (v,f) => { if(v && Number(v)>n) return `${f}: máximo ${n.toLocaleString()}`; return null; },
  optPosNum: (v, f) => { if(!v&&v!==0) return null; return Number(v)>0?null:`${f} debe ser mayor a 0`; },
  sel: (v, f) => !v ? `Seleccioná ${f}` : null,
  time: (v, f) => { if(!v) return `${f} es obligatorio`; return /^\d{2}:\d{2}$/.test(v)?null:`${f} inválido`; },
  phone: (v) => { if(!v) return 'Teléfono es obligatorio'; const clean=v.replace(/[\s\-()]/g,''); return /^09\d{7}$/.test(clean)?null:'Formato: 09X XXX XXX'; },
  userTypes: (v) => { if(!v||!Array.isArray(v)||v.length===0) return 'Seleccioná al menos un tipo'; return null; },
};

export function validate(vals, schema) {
  const errs = {}; let ok = true;
  for (const [k, rules] of Object.entries(schema)) {
    for (const rule of rules) { const e = rule(vals[k],k); if(e){errs[k]=e;ok=false;break;} }
    if(!errs[k]) errs[k]=null;
  }
  return {ok,errs};
}

export const SCHEMAS = {
  login:   { email:[V.email] },
  signup:  { name:[V.req,V.min(3)], email:[V.email], phone:[V.phone], userTypes:[V.userTypes] },
  freight: { grain:[v=>V.sel(v,'tipo de grano')], tons:[V.optPosNum, V.maxNum(100000)], loadDate:[V.req], loadTime:[V.time], notes:[V.maxLen(1000)] },
};

// ======================== FILTER ENGINE ===============================
export function textMatch(haystack, needle) {
  if(!needle||!needle.trim()) return true;
  if(!haystack) return false;
  return String(haystack).toLowerCase().includes(needle.toLowerCase().trim());
}

// Inline error display component
export function FieldError({ error }) {
  if(!error) return null;
  return <div style={{fontSize:12.1,color:C.err,fontWeight:500,marginTop:4,display:"flex",alignItems:"center",gap:4}}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    {error}
  </div>;
}
