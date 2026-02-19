// ======================== STATE MACHINE ==============================
// Freight has 2 states. Trip has its own lifecycle.
// Backend states: draft, pending_assignment, assigned, accepted, in_progress, loaded, finished, canceled

export const STATUS_LIGHT = {
  draft:              { label:"Borrador",            color:"#71717A",   bg:"#F4F4F5",   border:"#71717A"   },
  pending_assignment: { label:"Solicitado",          color:"#FF6A00",   bg:"#FFF3E8",   border:"#FF6A00"   },
  assigned:           { label:"Asignado a flota",    color:"#0891B2",   bg:"#ECFEFF",   border:"#0891B2"   },
  accepted:           { label:"Confirmado camión",   color:"#2563EB",   bg:"#EFF6FF",   border:"#2563EB"   },
  in_progress:        { label:"En curso",            color:"#4ADE80",   bg:"#ECFDF5",   border:"#4ADE80"   },
  loaded:             { label:"Cargando",            color:"#22C55E",   bg:"#DCFCE7",   border:"#22C55E"   },
  finished:           { label:"Finalizado",          color:"#1A6B37",   bg:"#E4F3EA",   border:"#1A6B37"   },
  canceled:           { label:"Cancelado",           color:"#DC2626",   bg:"#FEE2E2",   border:"#DC2626"   },
};

export function stCfg(s) {
  return STATUS_LIGHT[s] || STATUS_LIGHT.pending_assignment;
}

export function getActions(status, userType, role, isOwnFleet) {
  const map = {
    pending_assignment: { producer:["cancel"], plant:["assign","cancel"], transporter:[] },
    assigned:           { producer: isOwnFleet ? ["cancel"] : ["cancel"], plant: isOwnFleet ? ["authorize","cancel"] : ["cancel"], transporter:["accept","reject"] },
    accepted:           { producer: isOwnFleet ? ["start","cancel"] : ["cancel"], plant:["cancel"], transporter: isOwnFleet ? [] : ["start","cancel"] },
    in_progress:        { producer: isOwnFleet ? ["confirm_loaded"] : [], plant:[], transporter: isOwnFleet ? [] : ["confirm_loaded"] },
    loaded:             { producer: isOwnFleet ? ["confirm_loaded","confirm_finished"] : ["confirm_loaded"], plant:["confirm_finished"], transporter: isOwnFleet ? [] : ["confirm_finished"] },
    finished:           { producer:[], plant:[], transporter:[] },
    canceled:           { producer:[], plant:[], transporter:[] },
    draft:              { producer:[], plant:[], transporter:[] },
  };
  return map[status]?.[userType] || [];
}

export const GRANOS = ["Soja","Maíz","Trigo","Girasol","Sorgo","Cebada","Otros"];
export const UNITS = [{v:"toneladas",l:"Toneladas"},{v:"cantidad",l:"Cantidad"},{v:"metros",l:"Metros"},{v:"m3",l:"M³"}];

// Polling intervals (ms)
export const POLL_INTERVALS = {
  FREIGHTS: 10000,      // 10s - freight list poll (active screens only)
  UNREAD_CHATS: 30000,  // 30s - unread chat count
  CHAT_MESSAGES: 3000,  // 3s - active chat messages (adapts to 60s)
  DETAIL_REFRESH: 10000 // 10s - freight detail auto-refresh
};

// Dev-only logger (no-ops in production)
const isDev = import.meta.env.DEV;
export const logger = {
  log: (...args) => { if(isDev) console.log(...args); },
  warn: (...args) => { if(isDev) console.warn(...args); },
  error: (...args) => { if(isDev) console.error(...args); },
};
