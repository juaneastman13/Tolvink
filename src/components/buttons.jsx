import { memo } from "react";
import { C } from "../theme";

export const Btn = memo(function Btn({ children, onClick, v="pri", full, sm, icon, disabled, style={}, type="button" }) {
  const vs = {
    pri:  { bg:C.pri, c:C.w, hbg:C.priLt, dbg:C.priPale, dc:C.t3 },
    sec:  { bg:C.w,   c:C.pri, bd:C.b1, dbg:"#E8ECE9", dc:C.t3 },
    err:  { bg:C.errPale, c:C.err, dbg:"#F5E8E8", dc:C.t3 },
    ghost:{ bg:"transparent", c:C.t2, dbg:"transparent", dc:C.t3 },
    acc:  { bg:C.acc, c:C.w, hbg:C.accLt, dbg:C.accPale, dc:C.t3 },
  };
  const vv = vs[v] || vs.pri;
  return <button type={type} disabled={disabled} onClick={onClick} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, padding:sm?"8px 14px":"13px 22px", borderRadius:10, fontSize:sm?13.2:14.9, fontWeight:600, fontFamily:"inherit", background:disabled?(vv.dbg||"#E8ECE9"):vv.bg, color:disabled?(vv.dc||C.t3):vv.c, border:vv.bd?`1px solid ${disabled?C.b1:vv.bd}`:"none", cursor:disabled?"not-allowed":"pointer", width:full?"100%":"auto", transition:"all 0.15s ease", minHeight:sm?38:44, WebkitTapHighlightColor:"transparent", touchAction:"manipulation", ...style }} onMouseEnter={e=>{if(!disabled&&vv.hbg)e.currentTarget.style.background=vv.hbg}} onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=disabled?(vv.dbg||"#E8ECE9"):vv.bg}} onPointerDown={e=>{if(!disabled)e.currentTarget.style.transform="scale(0.97)"}} onPointerUp={e=>{e.currentTarget.style.transform="none"}} onPointerLeave={e=>{e.currentTarget.style.transform="none"}}>{icon&&<span style={{display:"flex",alignItems:"center"}}>{icon}</span>}{children}</button>;
});
