import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { C, Ic , R} from "../theme";
import { stCfg } from "../constants";
import { originDisplay, destDisplay } from "../hooks";

// ======================== LAZY-LOADED SCREENS ===========================
export const LandingScreen = lazy(() => import("../screens/LandingScreen"));
export const HomeScreen = lazy(() => import("../screens/HomeScreen"));
export const ListScreen = lazy(() => import("../screens/ListScreen"));
export const DetailScreen = lazy(() => import("../screens/DetailScreen"));
export const NewScreen = lazy(() => import("../screens/NewScreen"));
export const EditScreen = lazy(() => import("../screens/EditScreen"));
export const CalendarScreen = lazy(() => import("../screens/CalendarScreen"));
export const MenuScreen = lazy(() => import("../screens/MenuScreen"));
export const TrucksScreen = lazy(() => import("../screens/TrucksScreen"));
export const TicketsScreen = lazy(() => import("../screens/TicketsScreen"));
export const DocumentsScreen = lazy(() => import("../screens/DocumentsScreen"));
export const AnalyticsScreen = lazy(() => import("../screens/AnalyticsScreen"));
export const LocationsScreen = lazy(() => import("../screens/LocationsScreen"));
export const AdminScreen = lazy(() => import("../screens/AdminScreen"));
export const MyDataScreen = lazy(() => import("../screens/MyDataScreen"));
export const ReportsScreen = lazy(() => import("../screens/ReportsScreen"));
export const ChatsScreen = lazy(() => import("../screens/ChatsScreen"));
export const NotificationsScreen = lazy(() => import("../screens/NotificationsScreen"));
export const LinkedCompaniesScreen = lazy(() => import("../screens/LinkedCompaniesScreen"));
export const QueueBoardScreen = lazy(() => import("../screens/QueueBoardScreen"));
export const PickLocationScreen = lazy(() => import("../screens/PickLocationScreen"));
export const TrackFreightScreen = lazy(() => import("../screens/TrackFreightScreen"));
export const ReportDownloadScreen = lazy(() => import("../screens/ReportDownloadScreen"));
export const DailyMapScreen = lazy(() => import("../screens/DailyMapScreen"));
export const LiveFreightScreen = lazy(() => import("../screens/LiveFreightScreen"));
export const ViewMapScreen = lazy(() => import("../screens/ViewMapScreen"));
export const SharedLinkScreen = lazy(() => import("../screens/SharedLinkScreen"));

// AI Chat
export const AiChat = lazy(() => import("../AiChat").then(m => ({ default: m.default })));
export const AiChatFabComp = lazy(() => import("../AiChat").then(m => ({ default: m.AiChatFab })));

// Lazy modals
export const ConfirmActionModal = lazy(() => import("../modals/ConfirmActionModal"));
export const AssignModal = lazy(() => import("../modals/AssignModal"));
export const TruckSelectModal = lazy(() => import("../modals/TruckSelectModal"));
export const ReasonModal = lazy(() => import("../modals/ReasonModal"));
export const DriverQueueModal = lazy(() => import("../modals/DriverQueueModal"));
export const EditTripModal = lazy(() => import("../modals/EditTripModal"));
export const WeighTicketConfirmModal = lazy(() => import("../modals/WeighTicketConfirmModal"));

// Lazy load heavy map components
export const MapOverlay = lazy(() => import("../maps").then(m => ({ default: m.MapOverlay })));
export const LocPickerFullscreen = lazy(() => import("../maps").then(m => ({ default: m.LocPickerFullscreen })));

// ======================== ROUTE MAP ===================================
export const SCREEN_TO_PATH = {
  home: "/", list: "/list", detail: "/freight", new: "/new", edit: "/edit",
  calendar: "/calendar", menu: "/menu", trucks: "/trucks", tickets: "/tickets",
  documents: "/documents", analytics: "/analytics", locations: "/locations", admin: "/admin", mydata: "/mydata",
  reports: "/reports", chats: "/chats", notifs: "/notifications", linked: "/linked", queue: "/queue",
};
export const PATH_TO_SCREEN = {};
Object.entries(SCREEN_TO_PATH).forEach(([s, p]) => { PATH_TO_SCREEN[p] = s; });
PATH_TO_SCREEN["/fields"] = "locations"; // redirect legacy route

// ======================== SCREEN LOADER ===============================
export const SL = () => <div role="status" aria-label="Cargando" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,gap:14,animation:"fadeIn 0.3s ease"}}>
  <div style={{display:"flex",gap:6}}>
    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius: R.xs,background:C.pri,opacity:0.3,animation:`tvDots 1.2s ${i*0.15}s ease-in-out infinite`}}/>)}
  </div>
  <style>{`@keyframes tvDots{0%,80%,100%{opacity:0.3;transform:scale(1)}40%{opacity:1;transform:scale(1.3)}}`}</style>
</div>;

// ======================== MOBILE SEARCH ===============================
export function MobileSearch({ query, onChange, results, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); onChange(""); } };
    const tid = setTimeout(() => { document.addEventListener("mousedown", h); document.addEventListener("touchstart", h, { passive: true }); }, 0);
    return () => { clearTimeout(tid); document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  }, [open, onChange]);
  if (!open) return <button onClick={() => setOpen(true)} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34, borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", flexShrink:0 }} aria-label="Buscar">{Ic.srch(C.t3,16)}</button>;
  return (
    <div ref={ref} style={{ flex:1, position:"relative", minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius: R.md, background:C.bgInput, border:`1.5px solid ${C.bFocus}` }}>
        {Ic.srch(C.t3,14)}
        <input autoFocus value={query} onChange={e=>onChange(e.target.value)} placeholder="Buscar flete..." style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:13.2, color:C.t1, fontFamily:"inherit", padding:0 }} />
        <button onClick={()=>{setOpen(false);onChange("");}} style={{ display:"flex", border:"none", background:"none", cursor:"pointer", padding:0 }}>{Ic.cross(C.t3,14)}</button>
      </div>
      {query.length >= 2 && results.length > 0 && <div style={{ position:"absolute", left:0, right:0, top:"100%", marginTop:4, background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.md, boxShadow:C.shMd, zIndex:200, maxHeight:260, overflowY:"auto", padding:4 }}>
        {results.slice(0,6).map(f => <button key={f.id} onClick={()=>{onSelect(f.id);setOpen(false);}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"8px 10px", background:"transparent", border:"none", borderRadius: R.md, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:C.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.grain} · {f.tons} {f.unit||"tn"}</div>
            <div style={{ fontSize:10.5, color:C.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.code} · {originDisplay(f)||"—"} → {destDisplay(f)||"—"}</div>
          </div>
        </button>)}
      </div>}
      {query.length >= 2 && results.length === 0 && <div style={{ position:"absolute", left:0, right:0, top:"100%", marginTop:4, background:C.w, border:`1px solid ${C.b1}`, borderRadius: R.md, boxShadow:C.shMd, zIndex:200, padding:"10px 14px", fontSize:12.1, color:C.t3 }}>Sin resultados</div>}
    </div>
  );
}

// ======================== PUBLIC ROUTE MATCHING ========================
export function renderPublicRoute(pathname) {
  const trackMatch = pathname.match(/^\/(FLT-\d{4,}|F\d{2}-[A-Z]{3}\.\d{4})\/ubicacion$/i);
  if (trackMatch) return <Suspense fallback={<SL/>}><TrackFreightScreen code={trackMatch[1].toUpperCase()} /></Suspense>;

  const reportMatch = pathname.match(/^\/(FLT-\d{4,}|F\d{2}-[A-Z]{3}\.\d{4})\/informe$/i);
  if (reportMatch) return <Suspense fallback={<SL/>}><ReportDownloadScreen code={reportMatch[1].toUpperCase()} /></Suspense>;

  const campoMatch = pathname.match(/^\/campo\/([a-z0-9-]+)\/ubicacion$/i);
  if (campoMatch) return <Suspense fallback={<SL/>}><PickLocationScreen slug={campoMatch[1]} /></Suspense>;

  const ubicacionMatch = pathname.match(/^\/ubicacion\/([a-z0-9-]+)$/i);
  if (ubicacionMatch) return <Suspense fallback={<SL/>}><PickLocationScreen slug={ubicacionMatch[1]} /></Suspense>;

  const sharedMatch = pathname.match(/^\/s\/([a-zA-Z0-9_-]{10,30})$/);
  if (sharedMatch) return <Suspense fallback={<SL/>}><SharedLinkScreen token={sharedMatch[1]} /></Suspense>;

  if (pathname === "/ver-mapa") return <Suspense fallback={<SL/>}><ViewMapScreen /></Suspense>;
  if (pathname === "/pick-location") return <Suspense fallback={<SL/>}><PickLocationScreen /></Suspense>;
  if (pathname === "/track") return <Suspense fallback={<SL/>}><TrackFreightScreen /></Suspense>;
  if (pathname === "/report") return <Suspense fallback={<SL/>}><ReportDownloadScreen /></Suspense>;
  if (pathname === "/daily-map") return <Suspense fallback={<SL/>}><DailyMapScreen /></Suspense>;
  if (pathname === "/live-freight") return <Suspense fallback={<SL/>}><LiveFreightScreen /></Suspense>;

  return null;
}

// ======================== SCREEN DERIVATION ============================
export function useScreen() {
  const location = useLocation();
  return useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/freight/")) return "detail";
    if (p.startsWith("/edit/")) return "edit";
    if (p.startsWith("/chats/")) return "chats";
    return PATH_TO_SCREEN[p] || "home";
  }, [location.pathname]);
}

// ======================== PUBLIC PATH CHECK ============================
export function isPublicPath(pathname) {
  return /^\/s\/[a-zA-Z0-9_-]{10,30}$/.test(pathname)
    || ["/pick-location","/track","/report","/daily-map","/live-freight","/ver-mapa"].includes(pathname)
    || /^\/(FLT-\d{4,}|F\d{2}-[A-Z]{3}\.\d{4})\/(ubicacion|informe)$/i.test(pathname)
    || /^\/campo\/[a-z0-9-]+\/ubicacion$/i.test(pathname)
    || /^\/ubicacion\/[a-z0-9-]+$/i.test(pathname);
}

export const FREIGHT_SCREENS = new Set(["home","list","calendar","detail","reports","notifs"]);
