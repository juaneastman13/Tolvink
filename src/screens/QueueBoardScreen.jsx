import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { C, Ic, FONT, R } from "../theme";
import { LicensePlate } from "../components";
import { apiGetQueueBoard, apiMoveAssignment, apiReorderAssignments, apiCancelAssignment, apiAssignTruck, apiAssignFreight, apiAssignMultiTruck, apiGetTruckQueue, apiReorderTruckQueue } from "../api";
import {
  DndContext, closestCenter, rectIntersection, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TRIP_ST = {
  pending:     { color: '#FF6A00', bg: '#FFF3E0', label: "Pendiente" },
  accepted:    { color: '#0891B2', bg: '#ECFEFF',  label: "Aceptado" },
  in_progress: { color: '#43A047', bg: '#E8F5E9', label: "En viaje" },
  loaded:      { color: '#1A6B37', bg: '#E0F2E5', label: "Cargado" },
  finished:    { color: '#9E9E9E', bg: '#F5F5F5', label: "Finalizado" },
  canceled:    { color: '#E53935', bg: '#FFEBEE', label: "Cancelado" },
};
const isDraggable = (ts) => ts === "pending" || ts === "accepted";

// ─── Hover card via portal (avoids overflow clipping) ───
function TruckHoverCard({ triggerRef, lines }) {
  const [pos, setPos] = useState(null);
  const cardRef = useRef(null);
  // Position after first render so we know the real card height
  useEffect(() => {
    if (!triggerRef.current || !cardRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const ch = cardRef.current.offsetHeight;
    const cardW = 210;
    let x = r.left, y = r.top - ch - 4;
    if (y < 4) y = r.bottom + 4;
    if (x + cardW > window.innerWidth - 8) x = window.innerWidth - cardW - 8;
    if (x < 8) x = 8;
    setPos({ x, y });
  });
  if (!lines?.length) return null;
  return createPortal(
    <div ref={cardRef} style={{ position: "fixed", left: pos?.x ?? -9999, top: pos?.y ?? -9999, width: 210, zIndex: 10000, pointerEvents: "none", background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, boxShadow: C.shLg, padding: "8px 12px", fontFamily: FONT, visibility: pos ? "visible" : "hidden" }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: l.color || C.t2, fontWeight: l.bold ? 600 : 400, marginBottom: i < lines.length - 1 ? 3 : 0 }}>
          {l.icon} {l.text}
        </div>
      ))}
    </div>,
    document.body
  );
}

// ─── Sortable truck block (assignment in freight row) ───
function TruckBlock({ assignment, isOverlay, onUnassign }) {
  const [hover, setHover] = useState(false);
  const hoverRef = useRef(null);
  const canDrag = isDraggable(assignment.tripStatus);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: assignment.id, disabled: !canDrag });
  const st = TRIP_ST[assignment.tripStatus] || TRIP_ST.pending;
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.4 : canDrag ? 1 : 0.55,
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 10px", borderRadius: R.md,
    border: `2px solid ${st.color}`, background: isOverlay ? C.w : st.bg,
    cursor: canDrag ? "grab" : "default",
    fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.t1,
    userSelect: "none", boxShadow: isOverlay ? C.shLg : "none",
    whiteSpace: "nowrap", flexShrink: 0, position: "relative",
  };
  const a = assignment;
  const isExt = a.isExternal;
  const borderCol = isExt ? '#9E9E9E' : a.isOwnFleet ? C.pri : C.sec;
  const hoverLines = [
    isExt
      ? { icon: Ic.plant(C.t3, 11), text: a.externalCompanyName || "Tercero", bold: true, color: C.t1 }
      : a.transportCompany?.name && { icon: Ic.plant(C.t3, 11), text: a.transportCompany.name + (a.isOwnFleet ? " (Propia)" : ""), bold: true, color: C.t1 },
    isExt
      ? a.externalDriverName && { icon: Ic.user(C.t3, 11), text: a.externalDriverName }
      : a.driverName && { icon: Ic.user(C.t3, 11), text: a.driverName },
    !isExt && a.truck?.model && { icon: Ic.truck(C.t3, 11), text: a.truck.model, color: C.t3 },
    a.tons && { icon: Ic.grain(C.t3, 11), text: `${a.tons}t`, color: C.t3 },
    isExt && { icon: null, text: "Externo", color: C.sec, bold: true },
    { icon: null, text: st.label, color: st.color, bold: true },
  ].filter(Boolean);
  const content = (
    <>
      <div style={{ width: 4, height: 20, borderRadius: 2, background: borderCol, flexShrink: 0 }} />
      {a.plate ? <LicensePlate plate={a.plate} size="sm" /> : <span style={{ fontSize: 11, color: C.t3 }}>{isExt ? "Externo" : (a.transportCompany?.name || "Sin camión")}</span>}
      {isExt && <span style={{ fontSize: 8, fontWeight: 700, color: C.sec, background: `${C.sec}15`, padding: "1px 4px", borderRadius: R.pill }}>EXT</span>}
      {canDrag && onUnassign && (
        <button onClick={(e) => { e.stopPropagation(); onUnassign(a.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex", lineHeight: 1, minWidth: 28, minHeight: 28, alignItems: "center", justifyContent: "center" }}>
          {Ic.cross(C.err, 12)}
        </button>
      )}
      {hover && !isDragging && <TruckHoverCard triggerRef={hoverRef} lines={hoverLines} />}
    </>
  );
  if (isOverlay) return <div style={style}>{content}</div>;
  return <div ref={(el) => { setNodeRef(el); hoverRef.current = el; }} style={style} {...(canDrag ? { ...attributes, ...listeners } : {})} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{content}</div>;
}

// ─── Draggable truck card (panel) ───
// Truck card — draggable for own fleet and OPERATOR (USO) companies, view-only for READONLY (CONSULTA)
function PanelTruckCard({ truck, isOwnFleet, canDragTrucks, onShowQueue, isOverlay, companyName }) {
  const [hover, setHover] = useState(false);
  const hoverRef = useRef(null);
  const assignCount = truck.assignCount || 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `avail_${truck.id}`, disabled: !canDragTrucks,
  });
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.4 : canDragTrucks ? 1 : 0.6,
    display: "flex", alignItems: "center", gap: 8,
    padding: "5px 10px 5px 14px", marginBottom: 2,
    borderRadius: R.sm,
    cursor: canDragTrucks ? "grab" : "default",
    fontSize: 11, color: C.t2, fontFamily: FONT, userSelect: "none",
    boxShadow: isOverlay ? C.shLg : "none",
    background: isOverlay ? C.w : "transparent",
  };
  const content = (
    <>
      <LicensePlate plate={truck.plate} size="sm" />
      {assignCount > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onShowQueue && onShowQueue(truck.id, truck.plate, canDragTrucks); }}
          style={{ fontSize: 9, fontWeight: 700, color: C.w, background: C.acc, padding: "1px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FONT, lineHeight: "14px", minWidth: 16, textAlign: "center" }}>
          {assignCount}
        </button>
      )}
      {assignCount > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onShowQueue && onShowQueue(truck.id, truck.plate, canDragTrucks); }}
          style={{ fontSize: 10, fontWeight: 700, color: C.acc, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, padding: 0 }}>
          ver cola
        </button>
      )}
      {hover && !isDragging && (
        <TruckHoverCard triggerRef={hoverRef} lines={[
          companyName && { icon: Ic.plant(C.t3, 10), text: companyName, bold: true, color: C.t1 },
          truck.model && { icon: Ic.truck(C.t3, 10), text: truck.model, color: C.t3 },
          assignCount > 0 && { icon: Ic.doc(C.acc, 10), text: `${assignCount} flete${assignCount > 1 ? "s" : ""} en cola`, color: C.acc, bold: true },
        ].filter(Boolean)} />
      )}
    </>
  );
  if (isOverlay) return <div style={style}>{content}</div>;
  return <div ref={(el) => { setNodeRef(el); hoverRef.current = el; }} style={style} {...(canDragTrucks ? { ...attributes, ...listeners } : {})} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{content}</div>;
}

// ─── Draggable company card (panel) ───
function PanelCompanyCard({ group, isOverlay }) {
  const color = group.isOwnFleet ? C.pri : C.sec;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `company_${group.companyId}` });
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.4 : 1,
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 10px", borderRadius: R.md,
    border: `1.5px solid ${color}`, background: isOverlay ? C.w : group.isOwnFleet ? C.priPale : C.secPale,
    cursor: "grab", fontFamily: FONT, userSelect: "none",
    boxShadow: isOverlay ? C.shLg : "none", marginBottom: 6,
  };
  const content = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {group.isOwnFleet ? Ic.truck(C.pri, 14) : Ic.plant(C.sec, 14)}
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{group.isOwnFleet ? "Flota propia" : group.companyName}</span>
      </div>
      <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>Asignar al flete</div>
    </div>
  );
  if (isOverlay) return <div style={style}>{content}</div>;
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{content}</div>;
}

// ─── Droppable freight row ───
function FreightRow({ freight, onUnassign, onNav }) {
  const draggableIds = freight.assignments.filter(a => isDraggable(a.tripStatus)).map(a => a.id);
  const emptySlots = Math.max(0, freight.truckCount - freight.assignments.length);
  const isEmpty = freight.assignments.length === 0;
  const { setNodeRef, isOver } = useDroppable({ id: `freight_${freight.id}` });

  return (
    <div ref={setNodeRef} style={{
      background: isOver ? C.priPale : C.bgCard,
      border: `1.5px solid ${isOver ? C.pri : C.b1}`,
      borderRadius: R.lg, padding: "10px 14px", marginBottom: 8,
      opacity: isEmpty && !isOver ? 0.65 : 1,
      boxShadow: isOver ? `0 0 0 2px ${C.pri}40` : isEmpty ? "none" : C.sh,
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {onNav && <button onClick={() => onNav("detail", freight.id)} style={{ background: "none", border: `1px solid ${C.pri}30`, borderRadius: R.sm, padding: "2px 6px", cursor: "pointer", fontSize: 10, fontWeight: 600, color: C.pri, fontFamily: FONT, whiteSpace: "nowrap" }}>Ver flete</button>}
          <span style={{ fontSize: 12, fontWeight: 700, color: C.pri, fontFamily: "monospace" }}>{freight.code}</span>
          <span style={{ fontSize: 12, color: C.t2 }}>{freight.grain}{freight.tons ? ` · ${freight.tons}t` : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: "uppercase" }}>{freight.originCompany?.name || freight.originName || ""}</span>
          <span style={{ fontSize: 11, color: C.t3 }}>{freight.originName?.split(" ")[0]} → {freight.destName?.split(" ")[0]}</span>
          <span style={{ fontSize: 11, color: C.t3 }}>{freight.loadDate ? new Date(freight.loadDate).toLocaleDateString("es-UY", { day: "2-digit", month: "short" }) : ""}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: freight.assignments.length >= freight.truckCount ? C.ok : C.acc }}>
            {freight.assignments.length}/{freight.truckCount}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, alignItems: "center", minHeight: 36 }}>
        <SortableContext items={draggableIds} strategy={horizontalListSortingStrategy}>
          {freight.assignments.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: C.t3, fontWeight: 600, width: 14, textAlign: "center" }}>{i + 1}</span>
              <TruckBlock assignment={a} onUnassign={isDraggable(a.tripStatus) ? onUnassign : null} />
            </div>
          ))}
        </SortableContext>
        {emptySlots > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: R.md, border: `1.5px dashed ${isOver ? C.pri : C.b1}`, background: isOver ? `${C.pri}10` : C.bgCardAlt, fontSize: 11, color: isOver ? C.pri : C.t3, fontWeight: isOver ? 600 : 400, transition: "all 0.15s" }}>
            {isOver ? "Soltar para asignar" : isEmpty ? "Arrastrá camiones o empresas aquí" : `+${emptySlots} vacío${emptySlots > 1 ? "s" : ""}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile truck list (no drag-drop) ───
function MobileTruckList({ groups, search, onSearchChange, onShowQueue }) {
  const [collapsed, setCollapsed] = useState({});
  const totalAll = groups.reduce((s, g) => s + g.trucks.length, 0);
  const totalAvail = groups.reduce((s, g) => s + g.trucks.filter(t => !t.busy).length, 0);
  const filtered = search
    ? groups.map(g => ({ ...g, trucks: g.trucks.filter(t => t.plate.toLowerCase().includes(search.toLowerCase()) || g.companyName.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.trucks.length > 0)
    : groups;
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.b1}`, borderRadius: R.lg, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.b1}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Camiones</div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{Ic.srch(C.t3, 14)}</div>
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Buscar patente o empresa..."
            style={{ width: "100%", padding: "9px 10px 9px 30px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgInput, color: C.t1, fontSize: 13, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ padding: "8px 12px" }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13 }}>Sin resultados</div>}
        {filtered.map(g => {
          const isOpen = !collapsed[g.companyId];
          const availCount = g.trucks.filter(t => !t.busy).length;
          return (
            <div key={g.companyId} style={{ marginBottom: 10 }}>
              <button onClick={() => setCollapsed(p => ({ ...p, [g.companyId]: !p[g.companyId] }))} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
                <div style={{ width: 4, height: 16, borderRadius: 2, background: g.isOwnFleet ? C.pri : C.sec, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, flex: 1, textAlign: "left" }}>
                  {g.isOwnFleet ? "Flota propia" : g.companyName}
                  {!g.isOwnFleet && g.accessLevel === "READONLY" && <span style={{ fontSize: 9, fontWeight: 700, color: C.t3, background: C.bgCardAlt, padding: "2px 5px", borderRadius: R.xs, marginLeft: 6, verticalAlign: "middle" }}>CONSULTA</span>}
                </span>
                <span style={{ fontSize: 11, color: C.t3 }}>{availCount}/{g.trucks.length}</span>
                <span style={{ fontSize: 11, color: C.t3, transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>▶</span>
              </button>
              {isOpen && g.trucks.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 16px", borderBottom: `1px solid ${C.b2}` }}>
                  <LicensePlate plate={t.plate} size="sm" />
                  {t.assignCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: C.acc, color: C.w, fontSize: 10, fontWeight: 700 }}>{t.assignCount}</span>}
                  {t.assignCount > 0 && onShowQueue && (
                    <button onClick={() => onShowQueue(t.id, t.plate, g.isOwnFleet)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.acc, padding: 0 }}>ver cola</button>
                  )}
                  {t.assignCount === 0 && <span style={{ fontSize: 11, color: C.t3 }}>disponible</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.b1}`, fontSize: 12, color: C.t3, textAlign: "center" }}>{totalAvail} disponibles / {totalAll} total</div>
    </div>
  );
}

// ─── Summary view ───
function SummaryView({ data }) {
  const stats = useMemo(() => {
    if (!data?.freights) return null;
    const freights = data.freights;
    const allAssignments = freights.flatMap(f => f.assignments);
    const companies = {};
    allAssignments.forEach(a => {
      const key = a.transportCompanyId;
      if (!companies[key]) companies[key] = { id: key, name: a.transportCompany?.name || "Desconocida", isOwnFleet: a.isOwnFleet, trucks: new Set(), freightIds: new Set() };
      if (a.plate) companies[key].trucks.add(a.plate);
      companies[key].freightIds.add(a.freightId || "");
    });
    const sorted = Object.values(companies).sort((a, b) => {
      if (a.isOwnFleet && !b.isOwnFleet) return -1;
      if (!a.isOwnFleet && b.isOwnFleet) return 1;
      return b.trucks.size - a.trucks.size;
    });
    return {
      totalAssigned: allAssignments.length,
      activeFreights: freights.filter(f => f.assignments.length > 0).length,
      totalFreights: freights.length,
      companies: sorted.map(c => ({ ...c, truckCount: c.trucks.size, freightCount: c.freightIds.size, plates: [...c.trucks] })),
    };
  }, [data]);
  if (!stats) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { label: "Camiones asignados", value: stats.totalAssigned, color: C.pri },
          { label: "Fletes activos", value: stats.activeFreights, color: C.acc },
          { label: "Fletes totales", value: stats.totalFreights, color: C.info },
          { label: "Empresas participando", value: stats.companies.length, color: C.sec },
        ].map((s, i) => (
          <div key={i} style={{ flex: "1 1 120px", minWidth: 120, background: C.bgCard, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {stats.companies.length === 0 && <div style={{ textAlign: "center", padding: 32, color: C.t3, fontSize: 14 }}>Sin camiones asignados</div>}
      {stats.companies.map(co => (
        <div key={co.id} style={{ background: C.bgCard, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${co.isOwnFleet ? C.pri : C.sec}`, borderRadius: R.lg, padding: "12px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{co.name}</span>
            {co.isOwnFleet && <span style={{ fontSize: 10, fontWeight: 700, color: C.pri, background: C.priPale, padding: "2px 6px", borderRadius: R.sm }}>PROPIA</span>}
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.t2, marginBottom: 8 }}>
            <span>{co.truckCount} camión{co.truckCount !== 1 ? "es" : ""}</span>
            <span>{co.freightCount} flete{co.freightCount !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {co.plates.map(p => <span key={p} style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, background: C.bgCardAlt, padding: "3px 8px", borderRadius: R.sm, color: C.t1 }}>{p}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Available trucks panel ───
function AvailablePanel({ groups, search, onSearchChange, isDesktop, panelFilter, onFilter, onShowQueue }) {
  const [collapsed, setCollapsed] = useState({});
  const totalAll = groups.reduce((s, g) => s + g.trucks.length, 0);
  const totalAvail = groups.reduce((s, g) => s + g.trucks.filter(t => !t.busy).length, 0);
  const filtered = search
    ? groups.map(g => ({ ...g, trucks: g.trucks.filter(t => t.plate.toLowerCase().includes(search.toLowerCase()) || g.companyName.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.trucks.length > 0)
    : groups;
  const toggle = (id) => setCollapsed(p => ({ ...p, [id]: !p[id] }));

  return (
    <div style={{
      width: isDesktop ? 260 : "100%", flexShrink: 0,
      background: C.bgCard, border: `1px solid ${C.b1}`, borderRadius: R.lg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      ...(isDesktop ? { position: "sticky", top: 0, maxHeight: "calc(100vh - 80px)" } : {}),
    }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.b1}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 6 }}>Camiones</div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{Ic.srch(C.t3, 12)}</div>
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Buscar patente o empresa..."
            style={{ width: "100%", padding: "6px 8px 6px 26px", borderRadius: R.sm, border: `1px solid ${C.b1}`, background: C.bgInput, color: C.t1, fontSize: 11, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 16, color: C.t3, fontSize: 11 }}>Sin resultados</div>}
        {filtered.map(g => {
          const isOpen = !collapsed[g.companyId];
          const availCount = g.trucks.filter(t => !t.busy).length;
          // Only own fleet trucks are draggable. External companies (USO/CONSULTA) are view-only.
          const canDrag = g.isOwnFleet;
          return (
            <div key={g.companyId} style={{ marginBottom: 8 }}>
              {/* Section header */}
              <button onClick={() => toggle(g.companyId)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "6px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
                <div style={{ width: 4, height: 14, borderRadius: 2, background: g.isOwnFleet ? C.pri : C.sec, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, flex: 1, textAlign: "left" }}>
                  {g.isOwnFleet ? "Flota propia" : g.companyName}
                  {!canDrag && <span style={{ fontSize: 8, fontWeight: 700, color: C.t3, background: C.bgCardAlt, padding: "1px 4px", borderRadius: R.xs, marginLeft: 4, verticalAlign: "middle" }}>CONSULTA</span>}
                </span>
                <span style={{ fontSize: 10, color: C.t3 }}>{availCount}/{g.trucks.length}</span>
                <span onClick={(e) => { e.stopPropagation(); onFilter && onFilter(panelFilter?.type === "company" && panelFilter?.id === g.companyId ? null : { type: "company", id: g.companyId, label: g.isOwnFleet ? "Flota propia" : g.companyName }); }}
                  style={{ fontSize: 10, color: panelFilter?.type === "company" && panelFilter?.id === g.companyId ? C.pri : C.t3, cursor: "pointer", padding: 2 }}>
                  {Ic.filter(panelFilter?.type === "company" && panelFilter?.id === g.companyId ? C.pri : C.t3, 11)}
                </span>
                <span style={{ fontSize: 10, color: C.t3, transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>▶</span>
              </button>

              {/* Company assign card (draggable — for ALL companies) */}
              {isOpen && (
                <SortableContext items={[`company_${g.companyId}`]} strategy={horizontalListSortingStrategy}>
                  <PanelCompanyCard group={g} />
                </SortableContext>
              )}

              {/* Truck cards — draggable for own fleet + OPERATOR, view-only for READONLY */}
              {isOpen && (
                <SortableContext items={canDrag ? g.trucks.map(t => `avail_${t.id}`) : []} strategy={horizontalListSortingStrategy}>
                  {g.trucks.map(t => (
                    <div key={t.id} onClick={() => onFilter && onFilter(panelFilter?.type === "truck" && panelFilter?.id === t.id ? null : { type: "truck", id: t.id, label: t.plate })}
                      style={{ cursor: "pointer", borderRadius: R.md, outline: panelFilter?.type === "truck" && panelFilter?.id === t.id ? `2px solid ${C.pri}` : "none" }}>
                      <PanelTruckCard truck={t} isOwnFleet={g.isOwnFleet} canDragTrucks={canDrag} onShowQueue={onShowQueue} companyName={g.companyName} />
                    </div>
                  ))}
                </SortableContext>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.b1}`, fontSize: 11, color: C.t3, textAlign: "center" }}>
        {totalAvail} disponible{totalAvail !== 1 ? "s" : ""} / {totalAll} total
      </div>
    </div>
  );
}

// ─── Main ───
export default function QueueBoardScreen({ user, onBack, onNav, catalog }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState(typeof window !== "undefined" && window.innerWidth > 900 ? "queue" : "panel");
  const [panelSearch, setPanelSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(typeof window !== "undefined" && window.innerWidth > 900);
  const [confirmModal, setConfirmModal] = useState(null);
  const [truckQueueModal, setTruckQueueModal] = useState(null); // { truckId, plate, queue, loading }
  const [assigning, setAssigning] = useState(false);
  const [panelFilter, setPanelFilter] = useState(null); // { type: 'truck', id } or { type: 'company', id }
  const isDesktop = typeof window !== "undefined" && window.innerWidth > 900;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const load = useCallback(async () => {
    try { setLoading(true); const r = await apiGetQueueBoard(); setData(r); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toastTimer = useRef(null);
  const showToast = (msg, type = "ok") => { clearTimeout(toastTimer.current); setToast({ msg, type }); toastTimer.current = setTimeout(() => setToast(null), 3000); };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showTruckQueue = async (truckId, plate, canEdit = true) => {
    setTruckQueueModal({ truckId, plate, queue: [], loading: true, canEdit });
    try {
      const r = await apiGetTruckQueue(truckId);
      setTruckQueueModal({ truckId, plate: r.truck?.plate || plate, queue: r.queue || [], loading: false, canEdit });
    } catch (e) { setTruckQueueModal(prev => prev ? { ...prev, loading: false, error: e.message } : null); }
  };

  const findFreightForAssignment = useCallback((aId) => data?.freights?.find(f => f.assignments.some(a => a.id === aId)) || null, [data]);
  const findFreightByDroppable = useCallback((did) => {
    if (!data?.freights) return null;
    if (typeof did === "string" && did.startsWith("freight_")) return data.freights.find(f => f.id === did.replace("freight_", ""));
    return data.freights.find(f => f.assignments.some(a => a.id === did));
  }, [data]);

  const activeItem = useMemo(() => {
    if (!activeId || !data) return null;
    const aid = String(activeId);
    if (aid.startsWith("company_")) {
      const cid = aid.replace("company_", "");
      const g = (data.availableTrucks || []).find(g => g.companyId === cid);
      return g ? { type: "company", data: g } : null;
    }
    if (aid.startsWith("avail_")) {
      const tid = aid.replace("avail_", "");
      for (const g of (data.availableTrucks || [])) {
        const t = g.trucks.find(t => t.id === tid);
        if (t) return { type: "available", data: { ...t, isOwnFleet: g.isOwnFleet, companyName: g.companyName } };
      }
    }
    for (const f of (data.freights || [])) {
      const a = f.assignments.find(a => a.id === activeId);
      if (a) return { type: "assignment", data: a };
    }
    return null;
  }, [activeId, data]);

  // Custom collision detection: prefer freight droppables for panel items
  const customCollision = useCallback((args) => {
    const aid = String(args.active?.id || "");
    if (aid.startsWith("avail_") || aid.startsWith("company_")) {
      // For panel items, use rect intersection and prefer freight_ targets
      const collisions = rectIntersection(args);
      const freightHit = collisions.find(c => String(c.id).startsWith("freight_"));
      return freightHit ? [freightHit] : collisions;
    }
    return closestCenter(args);
  }, []);

  const handleDragStart = (e) => setActiveId(e.active.id);

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const aid = String(active.id), oid = String(over.id);

    // ─── Company dropped on freight ───
    if (aid.startsWith("company_")) {
      const cid = aid.replace("company_", "");
      const target = findFreightByDroppable(oid);
      if (!target) return;
      if (target.assignments.length >= target.truckCount) { showToast(`${target.code} ya completo`, "err"); return; }
      const g = (data.availableTrucks || []).find(g => g.companyId === cid);
      if (!g) return;
      setConfirmModal({ type: "company", companyId: cid, companyName: g.companyName, freightId: target.id, freightCode: target.code, isMultiTruck: target.isMultiTruck || target.truckCount > 1 });
      return;
    }

    // ─── Available truck dropped on freight (own fleet + USO only) ───
    if (aid.startsWith("avail_")) {
      const tid = aid.replace("avail_", "");
      const target = findFreightByDroppable(oid);
      if (!target) return;
      if (target.assignments.length >= target.truckCount) { showToast(`${target.code} ya completo`, "err"); return; }
      let truckInfo = null, groupInfo = null;
      for (const g of (data.availableTrucks || [])) { const t = g.trucks.find(t => t.id === tid); if (t) { truckInfo = t; groupInfo = g; break; } }
      if (!truckInfo || !groupInfo) return;
      setConfirmModal({ type: "truck", truckId: tid, truckPlate: truckInfo.plate, freightId: target.id, freightCode: target.code, companyId: groupInfo.companyId, companyName: groupInfo.companyName, isOwnFleet: groupInfo.isOwnFleet, isMultiTruck: target.isMultiTruck || target.truckCount > 1 });
      return;
    }

    // ─── Assignment reorder / move ───
    if (aid === oid) return;
    const src = findFreightForAssignment(aid);
    if (!src) return;
    const tgt = findFreightForAssignment(oid) || findFreightByDroppable(oid);
    if (!tgt) return;

    if (src.id === tgt.id) {
      const oldIds = src.assignments.filter(a => isDraggable(a.tripStatus)).map(a => a.id);
      const oi = oldIds.indexOf(aid), ni = oldIds.indexOf(oid);
      if (oi === -1 || ni === -1) return;
      const newOrder = [...oldIds]; newOrder.splice(oi, 1); newOrder.splice(ni, 0, aid);
      setData(p => ({ ...p, freights: p.freights.map(f => f.id !== src.id ? f : { ...f, assignments: [...newOrder.map(id => f.assignments.filter(a => isDraggable(a.tripStatus)).find(a => a.id === id)).filter(Boolean), ...f.assignments.filter(a => !isDraggable(a.tripStatus))] }) }));
      try { await apiReorderAssignments(newOrder); } catch (e) { showToast(e.message || "Error al reordenar", "err"); load(); }
    } else {
      if (tgt.assignments.length >= tgt.truckCount) { showToast(`${tgt.code} ya completo`, "err"); return; }
      const asgn = src.assignments.find(a => a.id === aid);
      setData(p => ({ ...p, freights: p.freights.map(f => { if (f.id === src.id) return { ...f, assignments: f.assignments.filter(a => a.id !== aid) }; if (f.id === tgt.id) return { ...f, assignments: [...f.assignments, { ...asgn, tripStatus: "pending" }] }; return f; }) }));
      try { await apiMoveAssignment(aid, tgt.id); showToast(`Movido a ${tgt.code}`); } catch (e) { showToast(e.message || "Error al mover", "err"); load(); }
    }
  };

  const handleUnassign = async (assignmentId) => {
    const f = findFreightForAssignment(assignmentId);
    if (!f) return;
    setData(p => ({ ...p, freights: p.freights.map(fr => fr.id === f.id ? { ...fr, assignments: fr.assignments.filter(a => a.id !== assignmentId) } : fr) }));
    try { await apiCancelAssignment(f.id, assignmentId, "Desasignado desde tablero"); showToast("Desasignado"); load(); }
    catch (e) { showToast(e.message || "Error", "err"); load(); }
  };

  const handleConfirmAssign = async () => {
    if (!confirmModal || assigning) return;
    setAssigning(true);
    try {
      if (confirmModal.type === "truck") {
        // Specific truck assignment (own fleet + USO companies)
        if (confirmModal.isMultiTruck) {
          await apiAssignMultiTruck(confirmModal.freightId, [{ transportCompanyId: confirmModal.companyId, truckId: confirmModal.truckId }]);
        } else {
          await apiAssignTruck(confirmModal.freightId, { transportCompanyId: confirmModal.companyId, truckId: confirmModal.truckId });
        }
        showToast(`${confirmModal.truckPlate} asignado a ${confirmModal.freightCode}`);
      } else {
        // Company-level assignment
        if (confirmModal.isMultiTruck) {
          await apiAssignMultiTruck(confirmModal.freightId, [{ transportCompanyId: confirmModal.companyId }]);
        } else {
          await apiAssignFreight(confirmModal.freightId, { transportCompanyId: confirmModal.companyId });
        }
        showToast(`${confirmModal.companyName} asignada a ${confirmModal.freightCode}`);
      }
      setConfirmModal(null); load();
    } catch (e) { showToast(e.message || "Error al asignar", "err"); }
    finally { setAssigning(false); }
  };

  const Legend = () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: C.t3, marginBottom: 12 }}>
      {Object.entries(TRIP_ST).filter(([k]) => k !== "canceled").map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, border: `2px solid ${v.color}`, background: v.bg }} /> {v.label}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
        <div style={{ width: 4, height: 12, borderRadius: 2, background: C.pri }} /> Propia
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 4, height: 12, borderRadius: 2, background: C.sec }} /> Externa
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", fontFamily: FONT, overflow: "hidden", maxHeight: "100dvh", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Ic.filter(C.pri, 22)}
            <span style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Colas de Camiones</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {isDesktop && <div style={{ display: "flex", borderRadius: R.md, border: `1px solid ${C.b1}`, overflow: "hidden" }}>
              {[{ k: "queue", l: "Colas" }, { k: "summary", l: "Resumen" }].map(v => (
                <button key={v.k} onClick={() => setView(v.k)}
                  style={{ padding: "5px 14px", border: "none", background: view === v.k ? C.pri : C.w, color: view === v.k ? C.w : C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {v.l}
                </button>
              ))}
            </div>}
            {view === "queue" && !isDesktop && (
              <button onClick={() => setPanelOpen(p => !p)}
                style={{ padding: "5px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: panelOpen ? C.priPale : C.w, color: C.pri, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                {Ic.truck(C.pri, 14)}
              </button>
            )}
            <button onClick={load} disabled={loading}
              style={{ background: C.priPale, border: `1px solid ${C.pri}30`, borderRadius: R.md, padding: "5px 12px", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.pri, display: "flex", alignItems: "center", gap: 4 }}>
              {Ic.redo(C.pri, 14)}
            </button>
          </div>
        </div>
        {view === "queue" && isDesktop && <Legend />}
      </div>

      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 20px", borderRadius: R.md, background: toast.type === "err" ? C.err : C.ok, color: C.w, fontSize: 13, fontWeight: 600, fontFamily: FONT, boxShadow: C.shLg }}>{toast.msg}</div>}

      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: "env(safe-area-inset-top, 0px) 12px env(safe-area-inset-bottom, 0px)" }} onClick={() => !assigning && setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.w, borderRadius: R.lg, padding: 24, maxWidth: 360, width: "90%", boxShadow: C.shLg }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Confirmar asignación</div>
            <div style={{ fontSize: 13, color: C.t2, marginBottom: 16 }}>
              {confirmModal.type === "truck"
                ? <>¿Asignar camión <strong style={{ fontFamily: "monospace" }}>{confirmModal.truckPlate}</strong> de {confirmModal.companyName} al flete <strong style={{ fontFamily: "monospace" }}>{confirmModal.freightCode}</strong>?</>
                : <>¿Asignar <strong>{confirmModal.companyName}</strong> al flete <strong style={{ fontFamily: "monospace" }}>{confirmModal.freightCode}</strong>?
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>La empresa asignará camión y chofer.</div></>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} disabled={assigning} style={{ flex: 1, padding: "10px 0", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.w, color: C.t2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
              <button onClick={handleConfirmAssign} disabled={assigning} style={{ flex: 1, padding: "10px 0", borderRadius: R.md, border: "none", background: C.pri, color: C.w, fontSize: 13, fontWeight: 600, cursor: assigning ? "not-allowed" : "pointer", fontFamily: FONT, opacity: assigning ? 0.6 : 1 }}>{assigning ? "Asignando..." : "Asignar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Truck queue modal with reorder */}
      {truckQueueModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: "env(safe-area-inset-top, 0px) 12px env(safe-area-inset-bottom, 0px)" }}
          onClick={() => setTruckQueueModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.w, borderRadius: R.lg, padding: 20, maxWidth: 420, width: "90%", boxShadow: C.shLg, maxHeight: "calc(100dvh - 120px)", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Cola de fletes</div>
                <div style={{ fontSize: 13, color: C.t2, marginTop: 2 }}>
                  <LicensePlate plate={truckQueueModal.plate} size="sm" />
                </div>
              </div>
              <button onClick={() => setTruckQueueModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
            </div>
            {truckQueueModal.loading && <div style={{ textAlign: "center", padding: 20, color: C.t3 }}>Cargando cola...</div>}
            {truckQueueModal.error && <div style={{ color: C.err, fontSize: 13 }}>{truckQueueModal.error}</div>}
            {!truckQueueModal.loading && truckQueueModal.queue?.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13 }}>Sin fletes asignados</div>
            )}
            {!truckQueueModal.loading && truckQueueModal.queue?.map((q, i, arr) => {
              const st = TRIP_ST[q.tripStatus] || TRIP_ST.pending;
              const isStarted = q.tripStatus === "in_progress" || q.tripStatus === "loaded";
              const canMove = truckQueueModal.canEdit && !isStarted;
              const moveUp = async () => {
                if (i === 0 || !canMove) return;
                const newQueue = [...arr];
                [newQueue[i - 1], newQueue[i]] = [newQueue[i], newQueue[i - 1]];
                setTruckQueueModal(prev => prev ? { ...prev, queue: newQueue } : null);
                try { await apiReorderTruckQueue(truckQueueModal.truckId, newQueue.map(q => q.assignmentId)); }
                catch (e) { showToast(e.message || "Error al reordenar", "err"); showTruckQueue(truckQueueModal.truckId, truckQueueModal.plate, truckQueueModal.canEdit); }
              };
              const moveDown = async () => {
                if (i >= arr.length - 1 || !canMove) return;
                const newQueue = [...arr];
                [newQueue[i], newQueue[i + 1]] = [newQueue[i + 1], newQueue[i]];
                setTruckQueueModal(prev => prev ? { ...prev, queue: newQueue } : null);
                try { await apiReorderTruckQueue(truckQueueModal.truckId, newQueue.map(q => q.assignmentId)); }
                catch (e) { showToast(e.message || "Error al reordenar", "err"); showTruckQueue(truckQueueModal.truckId, truckQueueModal.plate, truckQueueModal.canEdit); }
              };
              return (
                <div key={q.assignmentId} style={{ display: "flex", gap: 8, padding: isStarted ? 10 : "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.b2}` : "none", background: isStarted ? `${C.info}08` : "transparent", borderRadius: isStarted ? R.md : 0, alignItems: "center" }}>
                  {/* Position badge */}
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: st.bg, border: `2px solid ${st.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: st.color, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  {/* Freight info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: C.pri }}>{q.freightCode}</span>
                      <span style={{ fontSize: 10, color: st.color, background: st.bg, padding: "1px 6px", borderRadius: R.xs, fontWeight: 600 }}>{st.label}</span>
                      {isStarted && <span style={{ fontSize: 9, color: C.info, fontWeight: 700 }}>EN CURSO</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>
                      {q.originName?.split(" ")[0]} → {q.destName?.split(" ")[0]}
                    </div>
                    <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>
                      {q.grain}{q.tons ? ` · ${q.tons}t` : ""} · {q.loadDate ? new Date(q.loadDate).toLocaleDateString("es-UY", { day: "2-digit", month: "short" }) : ""}
                    </div>
                  </div>
                  {/* Reorder arrows — right side, side by side — only if canEdit */}
                  {truckQueueModal.canEdit && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                      <button disabled={!canMove || i === 0} onClick={moveUp}
                        style={{ background: "none", border: "none", cursor: canMove && i > 0 ? "pointer" : "default", padding: 2, opacity: canMove && i > 0 ? 1 : 0.2, display: "flex", transform: "rotate(90deg)" }}>
                        {Ic.chev(C.pri, 22)}
                      </button>
                      <button disabled={!canMove || i >= arr.length - 1} onClick={moveDown}
                        style={{ background: "none", border: "none", cursor: canMove && i < arr.length - 1 ? "pointer" : "default", padding: 2, opacity: canMove && i < arr.length - 1 ? 1 : 0.2, display: "flex", transform: "rotate(-90deg)" }}>
                        {Ic.chev(C.pri, 22)}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: isDesktop ? "row" : "column", gap: 12, padding: "0 18px 18px", minHeight: 0 }}>
        {loading && !data && <div style={{ textAlign: "center", padding: 40, color: C.t3, flex: 1 }}>Cargando tablero...</div>}
        {error && <div style={{ background: C.errPale, color: C.err, padding: 14, borderRadius: R.md, fontSize: 13, flex: 1 }}>{error}</div>}

        {data && view === "summary" && <div style={{ flex: 1 }}><SummaryView data={data} /></div>}

        {data && view === "panel" && (
          <div style={{ flex: 1 }}>
            {/* Mobile-only: static truck list without drag-drop */}
            <MobileTruckList groups={data.availableTrucks || []} search={panelSearch} onSearchChange={setPanelSearch} onShowQueue={showTruckQueue} />
          </div>
        )}

        {data && view === "queue" && (
          <DndContext sensors={sensors} collisionDetection={customCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              {(data.freights || []).length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>No hay fletes activos</div>}
              {panelFilter && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "6px 12px", background: C.priPale, borderRadius: R.md, fontSize: 12, color: C.pri, fontWeight: 600 }}>
                  Filtrando por: {panelFilter.label}
                  <button onClick={() => setPanelFilter(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>{Ic.cross(C.pri, 14)}</button>
                </div>
              )}
              {(data.freights || []).filter(f => {
                if (!panelFilter) return true;
                if (panelFilter.type === "truck") return f.assignments.some(a => a.truck?.id === panelFilter.id || a.truckId === panelFilter.id);
                if (panelFilter.type === "company") return f.assignments.some(a => a.transportCompanyId === panelFilter.id);
                return true;
              }).map(f => <FreightRow key={f.id} freight={f} onUnassign={handleUnassign} onNav={onNav} />)}
            </div>

            {isDesktop && (
              <AvailablePanel groups={data.availableTrucks || []} search={panelSearch} onSearchChange={setPanelSearch} isDesktop={isDesktop} panelFilter={panelFilter} onFilter={setPanelFilter} onShowQueue={showTruckQueue} />
            )}

            <DragOverlay>
              {activeItem?.type === "assignment" ? <TruckBlock assignment={activeItem.data} isOverlay /> : null}
              {activeItem?.type === "available" ? <PanelTruckCard truck={activeItem.data} isOwnFleet={activeItem.data.isOwnFleet} canDragTrucks isOverlay /> : null}
              {activeItem?.type === "company" ? <PanelCompanyCard group={activeItem.data} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
