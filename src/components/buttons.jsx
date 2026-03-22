import { memo } from "react";
import { C , R} from "../theme";

const BTN_VARIANTS = {
  pri:  { bg:C.pri, c:C.w, hbg:C.priLt, dbg:C.priPale, dc:C.t3 },
  sec:  { bg:C.w,   c:C.pri, bd:C.b1, dbg:C.b2, dc:C.t3 },
  err:  { bg:C.errPale, c:C.err, dbg:C.errPale, dc:C.t3 },
  ghost:{ bg:"transparent", c:C.t2, dbg:"transparent", dc:C.t3 },
  acc:  { bg:C.acc, c:C.w, hbg:C.accLt, dbg:C.accPale, dc:C.t3 },
};

export const Btn = memo(function Btn({ children, onClick, v="pri", full, sm, icon, disabled, style={}, type="button", "aria-label": ariaLabel }) {
  const vv = BTN_VARIANTS[v] || BTN_VARIANTS.pri;
  return <button type={type} disabled={disabled} onClick={onClick} aria-label={ariaLabel || (!children && icon ? "Acción" : undefined)} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, padding:sm?"8px 14px":"13px 22px", borderRadius: R.md, fontSize:sm?13.2:14.9, fontWeight:600, fontFamily:"inherit", background:disabled?(vv.dbg||C.b2):vv.bg, color:disabled?(vv.dc||C.t3):vv.c, border:vv.bd?`1px solid ${disabled?C.b1:vv.bd}`:"none", cursor:disabled?"not-allowed":"pointer", width:full?"100%":"auto", transition:"all 0.15s ease", minHeight:sm?38:44, WebkitTapHighlightColor:"transparent", touchAction:"manipulation", ...style }} onMouseEnter={e=>{if(!disabled&&vv.hbg)e.currentTarget.style.background=vv.hbg}} onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=disabled?(vv.dbg||C.b2):vv.bg}} onPointerDown={e=>{if(!disabled)e.currentTarget.style.transform="scale(0.97)"}} onPointerUp={e=>{e.currentTarget.style.transform="none"}} onPointerLeave={e=>{e.currentTarget.style.transform="none"}}>{icon&&<span style={{display:"flex",alignItems:"center"}}>{icon}</span>}{children}</button>;
});
