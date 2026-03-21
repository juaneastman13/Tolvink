// ======================== STATE MACHINE ==============================
// Freight has 2 states. Trip has its own lifecycle.
// Backend states: draft, pending_assignment, assigned, accepted, in_progress, loaded, finished, canceled
import { STATUS_COLORS } from "./theme";

// STATUS_LIGHT derived from STATUS_COLORS (backward compat — color/bg/border/label)
export const STATUS_LIGHT = Object.fromEntries(
  Object.entries(STATUS_COLORS).map(([k, v]) => [k, { label: v.label, color: v.ribbon, bg: v.pillBg, border: v.ribbon }])
);

export function stCfg(s) {
  return STATUS_LIGHT[s] || STATUS_LIGHT.pending_assignment;
}

export function getActions(status, userType, role, isOwnFleet) {
  // Chofer: first action is start (assignments are auto-accepted, never accept/reject)
  if (role === "chofer") {
    const choferMap = {
      accepted:    ["start"],
      in_progress: ["confirm_loaded"],
      loaded:      ["confirm_finished"],
    };
    return choferMap[status] || [];
  }
  const map = {
    pending_assignment: { producer:["cancel"], plant:["assign","cancel"], transporter:[] },
    // assigned = company delegated, no truck yet. Transporter manager assigns truck/driver.
    assigned:           { producer:["cancel"], plant:["cancel"], transporter:["assign_truck","cancel"] },
    // accepted = truck+driver assigned. Ready to start.
    accepted:           { producer: isOwnFleet ? ["start","cancel"] : ["cancel"], plant:["cancel"], transporter: isOwnFleet ? [] : ["start","cancel"] },
    in_progress:        { producer: isOwnFleet ? ["confirm_loaded"] : [], plant:[], transporter: isOwnFleet ? [] : ["confirm_loaded"] },
    loaded:             { producer: isOwnFleet ? ["confirm_loaded","confirm_finished"] : ["confirm_loaded"], plant:["confirm_finished"], transporter: isOwnFleet ? [] : ["confirm_finished"] },
    finished:           { producer:[], plant:[], transporter:[] },
    canceled:           { producer:[], plant:[], transporter:[] },
    draft:              { producer:[], plant:[], transporter:[] },
  };
  return map[status]?.[userType] || [];
}

// Trip-level status (multi-truck v6.0)
export const TRIP_STATUS_CFG = {
  pending:     { label:"Sin camión",       color:"#FF6A00", bg:"#FFF3E0" },
  accepted:    { label:"Asignado",         color:"#0891B2", bg:"#ECFEFF" },
  in_progress: { label:"A campo",          color:"#43A047", bg:"#E8F5E9" },
  loaded:      { label:"A planta",         color:"#1A6B37", bg:"#E0F2E5" },
  finished:    { label:"Finalizado",       color:"#9E9E9E", bg:"#F5F5F5" },
  canceled:    { label:"Cancelado",        color:"#E53935", bg:"#FFEBEE" },
};
export function tripStCfg(s) { return TRIP_STATUS_CFG[s] || TRIP_STATUS_CFG.pending; }

export const GRANOS = ["Soja","Maíz","Trigo","Girasol","Sorgo","Cebada","Otros"];
export const UNITS = [{v:"toneladas",l:"Toneladas"},{v:"cantidad",l:"Cantidad"},{v:"metros",l:"Metros"},{v:"m3",l:"M³"}];

// Polling intervals (ms)
export const POLL_INTERVALS = {
  FREIGHTS: 30000,      // 30s - freight list poll (SSE is the primary channel)
  UNREAD_CHATS: 30000,  // 30s - unread chat count
  CHAT_MESSAGES: 3000,  // 3s - active chat messages (adapts to 60s)
  DETAIL_REFRESH: 15000 // 15s - freight detail auto-refresh (SSE pushes real-time)
};

// Date format: "25/marzo", "03/febrero"
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export function formatFreightDate(dateStr) {
  if (!dateStr) return "";
  // Handle ISO datetime strings (e.g. "2026-03-22T00:00:00.000Z")
  const dateOnly = String(dateStr).split("T")[0];
  const parts = dateOnly.split("-");
  if (parts.length < 3) return dateStr;
  const day = parts[2].padStart(2, "0");
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return `${day}/${parts[1]}`;
  return `${day}/${MESES[monthIdx]}`;
}
