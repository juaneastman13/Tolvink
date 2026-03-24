import { useState, useEffect, useCallback, useMemo } from "react";
import { C, Ic, FONT, R } from "../theme";
import { LicensePlate } from "../components";
import { apiGetQueueBoard, apiMoveAssignment, apiReorderAssignments, apiCancelAssignment, apiAssignTruck } from "../api";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TRIP_ST = {
  pending:     { color: C.muted, bg: `${C.muted}18`, label: "Pendiente" },
  accepted:    { color: C.acc,   bg: C.accPale,       label: "Aceptado" },
  in_progress: { color: C.info,  bg: C.infoPale,      label: "En viaje" },
  loaded:      { color: C.sec,   bg: C.secPale,       label: "Cargado" },
  finished:    { color: C.ok,    bg: C.okPale,         label: "Finalizado" },
  canceled:    { color: C.err,   bg: C.errPale,        label: "Cancelado" },
};
const isDraggable = (ts) => ts === "pending" || ts === "accepted";

// ─── Sortable truck block (from assignments) ───
function TruckBlock({ assignment, isOverlay, onUnassign }) {
  const canDrag = isDraggable(assignment.tripStatus);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: assignment.id, disabled: !canDrag,
  });
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
    whiteSpace: "nowrap", flexShrink: 0,
  };
  const content = (
    <>
      <div style={{ width: 4, height: 20, borderRadius: 2, background: assignment.isOwnFleet ? C.pri : C.sec, flexShrink: 0 }} />
      {assignment.plate ? <LicensePlate plate={assignment.plate} size="sm" /> : <span style={{ fontSize: 11, color: C.t3 }}>Sin camión</span>}
      {canDrag && onUnassign && (
        <button onClick={(e) => { e.stopPropagation(); onUnassign(assignment.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}>
          {Ic.cross(C.err, 12)}
        </button>
      )}
    </>
  );
  if (isOverlay) return <div style={style}>{content}</div>;
  return <div ref={setNodeRef} style={style} {...(canDrag ? { ...attributes, ...listeners } : {})}>{content}</div>;
}

// ─── Draggable available truck (from panel) ───
function AvailableTruckCard({ truck, isOwnFleet, companyName, isOverlay }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `avail_${truck.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.4 : 1,
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 10px", borderRadius: R.md,
    border: `1px solid ${C.b1}`, borderLeft: `4px solid ${isOwnFleet ? C.pri : C.sec}`,
    background: isOverlay ? C.w : C.bgCard,
    cursor: "grab", fontFamily: FONT, userSelect: "none",
    boxShadow: isOverlay ? C.shLg : "none", marginBottom: 4,
  };
  const content = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: C.t1 }}>{truck.plate}</div>
        <div style={{ fontSize: 10, color: isOwnFleet ? C.pri : C.sec, fontWeight: 600 }}>{companyName}</div>
      </div>
    </>
  );
  if (isOverlay) return <div style={style}>{content}</div>;
  return <div ref={setNodeRef} style={style} {...attributes} {...listeners}>{content}</div>;
}

// ─── Droppable freight row ───
function FreightRow({ freight, onUnassign }) {
  const draggableIds = freight.assignments.filter(a => isDraggable(a.tripStatus)).map(a => a.id);
  const emptySlots = Math.max(0, freight.truckCount - freight.assignments.length);
  const isEmpty = freight.assignments.length === 0;
  const { setNodeRef, isOver } = useDroppable({ id: `freight_${freight.id}` });

  return (
    <div ref={setNodeRef} style={{
      background: isOver ? C.priPale : C.bgCard,
      border: `1px solid ${isOver ? C.pri : C.b1}`,
      borderRadius: R.lg, padding: "10px 14px", marginBottom: 8,
      opacity: isEmpty ? 0.65 : 1,
      transition: "background 0.15s, border-color 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.pri, fontFamily: "monospace" }}>{freight.code}</span>
          <span style={{ fontSize: 12, color: C.t2 }}>{freight.grain}{freight.tons ? ` · ${freight.tons}t` : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: R.md, border: `1.5px dashed ${C.b1}`, background: C.bgCardAlt, fontSize: 11, color: C.t3 }}>
            {isEmpty ? "Arrastrá camiones aquí" : `+${emptySlots} vacío${emptySlots > 1 ? "s" : ""}`}
          </div>
        )}
      </div>
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
      {/* Global stats */}
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
      {/* Company cards */}
      {stats.companies.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: C.t3, fontSize: 14 }}>Sin camiones asignados</div>
      )}
      {stats.companies.map(co => (
        <div key={co.id} style={{ background: C.bgCard, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${co.isOwnFleet ? C.pri : C.sec}`, borderRadius: R.lg, padding: "12px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{co.name}</span>
              {co.isOwnFleet && <span style={{ fontSize: 10, fontWeight: 700, color: C.pri, background: C.priPale, padding: "2px 6px", borderRadius: R.sm }}>PROPIA</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.t2, marginBottom: 8 }}>
            <span>{co.truckCount} camión{co.truckCount !== 1 ? "es" : ""}</span>
            <span>{co.freightCount} flete{co.freightCount !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {co.plates.map(p => (
              <span key={p} style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, background: C.bgCardAlt, padding: "3px 8px", borderRadius: R.sm, color: C.t1 }}>{p}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Available trucks panel ───
function AvailablePanel({ groups, search, onSearchChange, isDesktop }) {
  const totalAvailable = groups.reduce((s, g) => s + g.trucks.length, 0);
  const filtered = search
    ? groups.map(g => ({ ...g, trucks: g.trucks.filter(t => t.plate.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.trucks.length > 0)
    : groups;

  return (
    <div style={{
      width: isDesktop ? 240 : "100%", flexShrink: 0,
      background: C.bgCard, border: `1px solid ${C.b1}`, borderRadius: R.lg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      ...(isDesktop ? { position: "sticky", top: 0, maxHeight: "calc(100vh - 80px)" } : {}),
    }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.b1}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 6 }}>Camiones disponibles</div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{Ic.srch(C.t3, 12)}</div>
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Buscar patente..."
            style={{ width: "100%", padding: "6px 8px 6px 26px", borderRadius: R.sm, border: `1px solid ${C.b1}`, background: C.bgInput, color: C.t1, fontSize: 11, fontFamily: FONT, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 16, color: C.t3, fontSize: 11 }}>Sin camiones disponibles</div>
        )}
        {filtered.map(g => (
          <div key={g.companyId} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 4, height: 12, borderRadius: 2, background: g.isOwnFleet ? C.pri : C.sec }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.t2 }}>{g.companyName}</span>
              <span style={{ fontSize: 10, color: C.t3 }}>({g.trucks.length})</span>
            </div>
            <SortableContext items={g.trucks.map(t => `avail_${t.id}`)} strategy={horizontalListSortingStrategy}>
              {g.trucks.map(t => (
                <AvailableTruckCard key={t.id} truck={t} isOwnFleet={g.isOwnFleet} companyName={g.companyName} />
              ))}
            </SortableContext>
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.b1}`, fontSize: 11, color: C.t3, textAlign: "center" }}>
        {totalAvailable} disponible{totalAvailable !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ─── Main screen ───
export default function QueueBoardScreen({ user, onBack, onNav, catalog }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);
  const [view, setView] = useState("queue"); // queue | summary
  const [panelSearch, setPanelSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null); // { truckId, truckPlate, freightId, freightCode, companyId, companyName, isOwnFleet }
  const [assigning, setAssigning] = useState(false);
  const isDesktop = typeof window !== "undefined" && window.innerWidth > 900;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const load = useCallback(async () => {
    try { setLoading(true); const r = await apiGetQueueBoard(); setData(r); setError(null); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const findFreightForAssignment = useCallback((aId) => {
    if (!data?.freights) return null;
    return data.freights.find(f => f.assignments.some(a => a.id === aId));
  }, [data]);

  // Find freight by droppable id
  const findFreightByDroppable = useCallback((droppableId) => {
    if (!data?.freights) return null;
    if (typeof droppableId === "string" && droppableId.startsWith("freight_")) {
      return data.freights.find(f => f.id === droppableId.replace("freight_", ""));
    }
    // Could also be an assignment id (dropping onto another assignment's freight)
    return data.freights.find(f => f.assignments.some(a => a.id === droppableId));
  }, [data]);

  const activeItem = useMemo(() => {
    if (!activeId || !data) return null;
    // Check assignments
    for (const f of (data.freights || [])) {
      const a = f.assignments.find(a => a.id === activeId);
      if (a) return { type: "assignment", data: a };
    }
    // Check available trucks
    if (typeof activeId === "string" && activeId.startsWith("avail_")) {
      const truckId = activeId.replace("avail_", "");
      for (const g of (data.availableTrucks || [])) {
        const t = g.trucks.find(t => t.id === truckId);
        if (t) return { type: "available", data: { ...t, isOwnFleet: g.isOwnFleet, companyName: g.companyName, companyId: g.companyId } };
      }
    }
    return null;
  }, [activeId, data]);

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // ─── Available truck dropped on freight ───
    if (activeIdStr.startsWith("avail_")) {
      const truckId = activeIdStr.replace("avail_", "");
      const targetFreight = findFreightByDroppable(overIdStr);
      if (!targetFreight) return;
      if (targetFreight.assignments.length >= targetFreight.truckCount) {
        showToast(`${targetFreight.code} ya tiene ${targetFreight.truckCount} camiones`, "err");
        return;
      }
      // Find truck info
      let truckInfo = null, groupInfo = null;
      for (const g of (data.availableTrucks || [])) {
        const t = g.trucks.find(t => t.id === truckId);
        if (t) { truckInfo = t; groupInfo = g; break; }
      }
      if (!truckInfo || !groupInfo) return;

      // Show confirmation modal
      setConfirmModal({
        truckId, truckPlate: truckInfo.plate,
        freightId: targetFreight.id, freightCode: targetFreight.code,
        companyId: groupInfo.companyId, companyName: groupInfo.companyName,
        isOwnFleet: groupInfo.isOwnFleet,
      });
      return;
    }

    // ─── Assignment reorder / move ───
    if (activeIdStr === overIdStr) return;
    const sourceFreight = findFreightForAssignment(activeIdStr);
    if (!sourceFreight) return;

    const targetFreight = findFreightForAssignment(overIdStr) || findFreightByDroppable(overIdStr);
    if (!targetFreight) return;

    if (sourceFreight.id === targetFreight.id) {
      const oldIds = sourceFreight.assignments.filter(a => isDraggable(a.tripStatus)).map(a => a.id);
      const oldIdx = oldIds.indexOf(activeIdStr);
      const newIdx = oldIds.indexOf(overIdStr);
      if (oldIdx === -1 || newIdx === -1) return;
      const newOrder = [...oldIds]; newOrder.splice(oldIdx, 1); newOrder.splice(newIdx, 0, activeIdStr);
      setData(prev => ({
        ...prev,
        freights: prev.freights.map(f => {
          if (f.id !== sourceFreight.id) return f;
          const draggables = f.assignments.filter(a => isDraggable(a.tripStatus));
          const locked = f.assignments.filter(a => !isDraggable(a.tripStatus));
          return { ...f, assignments: [...newOrder.map(id => draggables.find(a => a.id === id)).filter(Boolean), ...locked] };
        }),
      }));
      try { await apiReorderAssignments(newOrder); } catch (e) { showToast(e.message || "Error al reordenar", "err"); load(); }
    } else {
      if (targetFreight.assignments.length >= targetFreight.truckCount) {
        showToast(`${targetFreight.code} ya tiene ${targetFreight.truckCount} camiones`, "err"); return;
      }
      const assignment = sourceFreight.assignments.find(a => a.id === activeIdStr);
      setData(prev => ({
        ...prev,
        freights: prev.freights.map(f => {
          if (f.id === sourceFreight.id) return { ...f, assignments: f.assignments.filter(a => a.id !== activeIdStr) };
          if (f.id === targetFreight.id) return { ...f, assignments: [...f.assignments, { ...assignment, tripStatus: "pending" }] };
          return f;
        }),
      }));
      try { await apiMoveAssignment(activeIdStr, targetFreight.id); showToast(`Camión movido a ${targetFreight.code}`); }
      catch (e) { showToast(e.message || "Error al mover", "err"); load(); }
    }
  };

  const handleUnassign = async (assignmentId) => {
    const freight = findFreightForAssignment(assignmentId);
    if (!freight) return;
    const assignment = freight.assignments.find(a => a.id === assignmentId);
    setData(prev => ({
      ...prev,
      freights: prev.freights.map(f => f.id === freight.id ? { ...f, assignments: f.assignments.filter(a => a.id !== assignmentId) } : f),
    }));
    try {
      await apiCancelAssignment(freight.id, assignmentId, "Desasignado desde tablero de colas");
      showToast("Camión desasignado");
      load(); // Refresh to update available panel
    } catch (e) { showToast(e.message || "Error al desasignar", "err"); load(); }
  };

  const handleConfirmAssign = async () => {
    if (!confirmModal || assigning) return;
    setAssigning(true);
    try {
      await apiAssignTruck(confirmModal.freightId, {
        transportCompanyId: confirmModal.isOwnFleet ? confirmModal.companyId : confirmModal.companyId,
        truckId: confirmModal.truckId,
      });
      showToast(`${confirmModal.truckPlate} asignado a ${confirmModal.freightCode}`);
      setConfirmModal(null);
      load();
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", fontFamily: FONT, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Ic.filter(C.pri, 22)}
            <span style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Colas de Camiones</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* View toggle */}
            <div style={{ display: "flex", borderRadius: R.md, border: `1px solid ${C.b1}`, overflow: "hidden" }}>
              {[{ k: "queue", l: "Colas" }, { k: "summary", l: "Resumen" }].map(v => (
                <button key={v.k} onClick={() => setView(v.k)}
                  style={{ padding: "5px 14px", border: "none", background: view === v.k ? C.pri : C.w, color: view === v.k ? C.w : C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {v.l}
                </button>
              ))}
            </div>
            {view === "queue" && !isDesktop && (
              <button onClick={() => setPanelOpen(p => !p)}
                style={{ padding: "5px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: panelOpen ? C.priPale : C.w, color: C.pri, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                {Ic.truck(C.pri, 14)} {panelOpen ? "Ocultar" : "Camiones"}
              </button>
            )}
            <button onClick={load} disabled={loading}
              style={{ background: C.priPale, border: `1px solid ${C.pri}30`, borderRadius: R.md, padding: "5px 12px", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.pri, display: "flex", alignItems: "center", gap: 4 }}>
              {Ic.redo(C.pri, 14)}
            </button>
          </div>
        </div>
        {view === "queue" && <Legend />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 20px", borderRadius: R.md, background: toast.type === "err" ? C.err : C.ok, color: C.w, fontSize: 13, fontWeight: 600, fontFamily: FONT, boxShadow: C.shLg }}>
          {toast.msg}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => !assigning && setConfirmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.w, borderRadius: R.lg, padding: 24, maxWidth: 360, width: "90%", boxShadow: C.shLg }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Confirmar asignación</div>
            <div style={{ fontSize: 13, color: C.t2, marginBottom: 16 }}>
              ¿Asignar <strong style={{ fontFamily: "monospace" }}>{confirmModal.truckPlate}</strong> ({confirmModal.companyName}) al flete <strong style={{ fontFamily: "monospace" }}>{confirmModal.freightCode}</strong>?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} disabled={assigning}
                style={{ flex: 1, padding: "10px 0", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.w, color: C.t2, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                Cancelar
              </button>
              <button onClick={handleConfirmAssign} disabled={assigning}
                style={{ flex: 1, padding: "10px 0", borderRadius: R.md, border: "none", background: C.pri, color: C.w, fontSize: 13, fontWeight: 600, cursor: assigning ? "not-allowed" : "pointer", fontFamily: FONT, opacity: assigning ? 0.6 : 1 }}>
                {assigning ? "Asignando..." : "Asignar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", gap: 12, padding: "0 18px 18px" }}>
        {loading && !data && <div style={{ textAlign: "center", padding: 40, color: C.t3, flex: 1 }}>Cargando tablero...</div>}
        {error && <div style={{ background: C.errPale, color: C.err, padding: 14, borderRadius: R.md, fontSize: 13, flex: 1 }}>{error}</div>}

        {data && view === "summary" && <div style={{ flex: 1 }}><SummaryView data={data} /></div>}

        {data && view === "queue" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Freight rows */}
            <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              {(data.freights || []).length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>No hay fletes activos</div>
              )}
              {(data.freights || []).map(f => (
                <FreightRow key={f.id} freight={f} onUnassign={handleUnassign} />
              ))}
            </div>

            {/* Available trucks panel */}
            {(isDesktop || panelOpen) && (data.availableTrucks || []).length > 0 && (
              <AvailablePanel groups={data.availableTrucks} search={panelSearch} onSearchChange={setPanelSearch} isDesktop={isDesktop} />
            )}

            <DragOverlay>
              {activeItem?.type === "assignment" ? <TruckBlock assignment={activeItem.data} isOverlay /> : null}
              {activeItem?.type === "available" ? (
                <AvailableTruckCard truck={activeItem.data} isOwnFleet={activeItem.data.isOwnFleet} companyName={activeItem.data.companyName} isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
