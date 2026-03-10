import { useMemo } from "react";
import { C, Ic } from "../theme";

const NOTIF_ICONS = {
  freight_created: (s) => Ic.truck(C.pri, s),
  freight_assigned: (s) => Ic.truck(C.info, s),
  freight_accepted: (s) => Ic.chk(C.ok, s),
  freight_rejected: (s) => Ic.ban(C.err, s),
  freight_started: (s) => Ic.nav(C.info, s),
  freight_loaded: (s) => Ic.truck(C.ok, s),
  freight_finished: (s) => Ic.chk(C.ok, s),
  freight_cancelled: (s) => Ic.ban(C.err, s),
};

function _timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return `hace ${Math.floor(d / 7)} sem`;
}

function _NotifRow({ n, freight, onMarkRead, onTap, isLast }) {
  const icFn = NOTIF_ICONS[n.type] || ((s) => Ic.bell(C.t3, s));
  const f = freight;
  const detailStyle = { fontSize:12.1, color:C.t3, display:"flex", alignItems:"center", gap:4 };
  return (
    <button onClick={() => { if (!n.read) onMarkRead(n.id); if (n.entityId) onTap(n.entityId); }}
      className="tv-row"
      style={{
        display:"flex", alignItems:"flex-start", gap:14, width:"100%", padding:"14px 18px",
        border:"none", background: n.read ? "transparent" : C.priGhost, cursor:"pointer",
        fontFamily:"inherit", textAlign:"left",
        borderBottom: isLast ? "none" : `1px solid ${C.b2}`,
        WebkitTapHighlightColor:"transparent", touchAction:"manipulation", transition:"background 0.15s"
      }}>
      <div style={{ width:40, height:40, borderRadius:12, background: n.read ? C.bg : C.priPale, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icFn(18)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {f && <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <span style={{ fontSize:12.5, fontWeight:700, color: n.read ? C.t2 : C.t1 }}>{f.grain} · {f.tons} {f.unit||"tn"}</span>
          {f.destName && <span style={{ fontSize:11, color:C.t3 }}>→ {f.destName}</span>}
        </div>}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize: f ? 13.2 : 15.4, fontWeight: n.read ? 500 : 700, color: n.read ? C.t2 : C.t1, flex:1 }}>{n.title}</span>
          <span style={{ fontSize:11, color:C.t3, fontWeight:500, flexShrink:0 }}>{_timeAgo(n.createdAt)}</span>
        </div>
        <div style={{ fontSize:12.5, color:C.t3, marginTop:3, lineHeight:1.4 }}>{n.body}</div>
        {f && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4, fontSize:11, color:C.t3 }}>
            {(f.originCompanyName||f.requestedByName) && <span style={detailStyle}>{Ic.user(C.t3,10)} {f.originCompanyName||f.requestedByName}</span>}
            {f.transporterName && <span style={detailStyle}>{Ic.truck(C.t3,10)} {f.transporterName}</span>}
          </div>
        )}
      </div>
      {!n.read && <div style={{ width:8, height:8, borderRadius:4, background:C.pri, flexShrink:0, marginTop:8 }} />}
    </button>
  );
}

export default function NotificationsScreen({ notifications=[], freights=[], onMarkRead, onMarkAllRead, onTap }) {
  const freightMap = useMemo(() => { const m = {}; freights.forEach(f => { m[f.id] = f; }); return m; }, [freights]);
  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);
  return (
    <div className="tv-pad" style={{ padding:18, flex:1 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
        <div>
          {unread.length > 0 && <span style={{ fontSize:13.2, color:C.t3, fontWeight:500 }}>{unread.length} sin leer</span>}
        </div>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} style={{ border:"none", background:C.priPale, cursor:"pointer", fontSize:13.2, fontWeight:600, color:C.pri, fontFamily:"inherit", padding:"8px 14px", borderRadius:8 }}
            onMouseEnter={e=>e.currentTarget.style.background=C.priGhost} onMouseLeave={e=>e.currentTarget.style.background=C.priPale}>
            Marcar todas leídas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ marginBottom:12 }}>{Ic.bell(C.b1, 48)}</div>
          <div style={{ fontSize:16.5, fontWeight:600, color:C.t3 }}>Sin notificaciones</div>
          <div style={{ fontSize:14.3, color:C.t3, marginTop:6 }}>Las novedades de tus fletes aparecerán aquí</div>
        </div>
      ) : <>
        {/* No leídas */}
        {unread.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12.1, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, padding:"0 4px", marginBottom:8 }}>Nuevas</div>
            <div style={{ background:C.w, borderRadius:14, border:`1px solid ${C.b2}`, overflow:"hidden" }}>
              {unread.map((n, i) => <_NotifRow key={n.id} n={n} freight={freightMap[n.entityId]} onMarkRead={onMarkRead} onTap={onTap} isLast={i === unread.length - 1} />)}
            </div>
          </div>
        )}

        {/* Leídas */}
        {read.length > 0 && (
          <div>
            <div style={{ fontSize:12.1, fontWeight:700, color:C.t3, textTransform:"uppercase", letterSpacing:0.5, padding:"0 4px", marginBottom:8 }}>Anteriores</div>
            <div style={{ background:C.w, borderRadius:14, border:`1px solid ${C.b2}`, overflow:"hidden" }}>
              {read.map((n, i) => <_NotifRow key={n.id} n={n} freight={freightMap[n.entityId]} onMarkRead={onMarkRead} onTap={onTap} isLast={i === read.length - 1} />)}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
