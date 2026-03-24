import { useState, useEffect, useCallback, useMemo } from "react";
import { C, Ic, FONT, R } from "../theme";
import { LicensePlate } from "../components";
import { apiGetQueueBoard, apiMoveAssignment, apiReorderAssignments, apiCancelAssignment } from "../api";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Trip status color scale ───
const TRIP_ST = {
  pending:     { color: C.muted, bg: `${C.muted}18`, label: "Pendiente" },
  accepted:    { color: C.acc,   bg: C.accPale,       label: "Aceptado" },
  in_progress: { color: C.info,  bg: C.infoPale,      label: "En viaje" },
  loaded:      { color: C.sec,   bg: C.secPale,       label: "Cargado" },
  finished:    { color: C.ok,    bg: C.okPale,         label: "Finalizado" },
  canceled:    { color: C.err,   bg: C.errPale,        label: "Cancelado" },
};
const isDraggable = (ts) => ts === "pending" || ts === "accepted";

// ─── Sortable truck block ───
function TruckBlock({ assignment, isOverlay, onUnassign }) {
  const canDrag = isDraggable(assignment.tripStatus);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: assignment.id,
    disabled: !canDrag,
  });
  const st = TRIP_ST[assignment.tripStatus] || TRIP_ST.pending;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : canDrag ? 1 : 0.55,
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 10px", borderRadius: R.md,
    border: `2px solid ${st.color}`,
    background: isOverlay ? C.w : st.bg,
    cursor: canDrag ? "grab" : "default",
    fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.t1,
    position: "relative", userSelect: "none",
    boxShadow: isOverlay ? C.shLg : "none",
    whiteSpace: "nowrap", flexShrink: 0,
  };

  const content = (
    <>
      <div style={{ width: 4, height: 20, borderRadius: 2, background: assignment.isOwnFleet ? C.pri : C.sec, flexShrink: 0 }} />
      {assignment.plate
        ? <LicensePlate plate={assignment.plate} size="sm" />
        : <span style={{ fontSize: 11, color: C.t3 }}>Sin camión</span>}
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

// ─── Droppable freight row ───
function FreightRow({ freight, onUnassign, isDesktop }) {
  const draggableIds = freight.assignments.filter(a => isDraggable(a.tripStatus)).map(a => a.id);
  const emptySlots = Math.max(0, freight.truckCount - freight.assignments.length);

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: "10px 14px", marginBottom: 8 }}>
      {/* Header */}
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
      {/* Truck blocks */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
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
            +{emptySlots} vacío{emptySlots > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main screen ───
export default function QueueBoardScreen({ user, onBack, onNav }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await apiGetQueueBoard();
      setData(r);
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Find which freight contains an assignment
  const findFreightForAssignment = useCallback((assignmentId) => {
    if (!data?.freights) return null;
    return data.freights.find(f => f.assignments.some(a => a.id === assignmentId));
  }, [data]);

  // Active assignment for drag overlay
  const activeAssignment = useMemo(() => {
    if (!activeId || !data?.freights) return null;
    for (const f of data.freights) {
      const a = f.assignments.find(a => a.id === activeId);
      if (a) return a;
    }
    return null;
  }, [activeId, data]);

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceFreight = findFreightForAssignment(active.id);
    const targetFreight = findFreightForAssignment(over.id);

    if (!sourceFreight || !targetFreight) return;

    if (sourceFreight.id === targetFreight.id) {
      // Reorder within same freight
      const oldIds = sourceFreight.assignments.filter(a => isDraggable(a.tripStatus)).map(a => a.id);
      const oldIdx = oldIds.indexOf(active.id);
      const newIdx = oldIds.indexOf(over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const newOrder = [...oldIds];
      newOrder.splice(oldIdx, 1);
      newOrder.splice(newIdx, 0, active.id);

      // Optimistic update
      setData(prev => {
        const freights = prev.freights.map(f => {
          if (f.id !== sourceFreight.id) return f;
          const draggables = f.assignments.filter(a => isDraggable(a.tripStatus));
          const locked = f.assignments.filter(a => !isDraggable(a.tripStatus));
          const reordered = newOrder.map(id => draggables.find(a => a.id === id)).filter(Boolean);
          return { ...f, assignments: [...reordered, ...locked] };
        });
        return { ...prev, freights };
      });

      try {
        await apiReorderAssignments(newOrder);
      } catch (e) {
        showToast(e.message || "Error al reordenar", "err");
        load(); // Revert
      }
    } else {
      // Move between freights
      if (targetFreight.assignments.length >= targetFreight.truckCount) {
        showToast(`${targetFreight.code} ya tiene ${targetFreight.truckCount} camiones`, "err");
        return;
      }

      // Optimistic
      setData(prev => {
        const assignment = sourceFreight.assignments.find(a => a.id === active.id);
        const freights = prev.freights.map(f => {
          if (f.id === sourceFreight.id) return { ...f, assignments: f.assignments.filter(a => a.id !== active.id) };
          if (f.id === targetFreight.id) return { ...f, assignments: [...f.assignments, { ...assignment, tripStatus: "pending" }] };
          return f;
        });
        return { ...prev, freights };
      });

      try {
        await apiMoveAssignment(active.id, targetFreight.id);
        showToast(`Camión movido a ${targetFreight.code}`);
      } catch (e) {
        showToast(e.message || "Error al mover", "err");
        load();
      }
    }
  };

  const handleUnassign = async (assignmentId) => {
    const freight = findFreightForAssignment(assignmentId);
    if (!freight) return;

    // Optimistic
    setData(prev => ({
      ...prev,
      freights: prev.freights.map(f =>
        f.id === freight.id ? { ...f, assignments: f.assignments.filter(a => a.id !== assignmentId) } : f
      ),
    }));

    try {
      await apiCancelAssignment(freight.id, assignmentId, "Desasignado desde tablero de colas");
      showToast("Camión desasignado");
    } catch (e) {
      showToast(e.message || "Error al desasignar", "err");
      load();
    }
  };

  // ─── Legend ───
  const Legend = () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: C.t3 }}>
      {Object.entries(TRIP_ST).filter(([k]) => k !== "canceled").map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, border: `2px solid ${v.color}`, background: v.bg }} />
          {v.label}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
        <div style={{ width: 4, height: 12, borderRadius: 2, background: C.pri }} /> Flota propia
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 4, height: 12, borderRadius: 2, background: C.sec }} /> Transportista externo
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Ic.filter(C.pri, 22)}
          <span style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Colas de Camiones</span>
        </div>
        <button onClick={load} disabled={loading}
          style={{ background: C.priPale, border: `1px solid ${C.pri}30`, borderRadius: R.md, padding: "6px 14px", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.pri, display: "flex", alignItems: "center", gap: 4 }}>
          {Ic.redo(C.pri, 14)} Actualizar
        </button>
      </div>

      <Legend />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 20px", borderRadius: R.md, background: toast.type === "err" ? C.err : C.ok, color: C.w, fontSize: 13, fontWeight: 600, fontFamily: FONT, boxShadow: C.shLg }}>
          {toast.msg}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div style={{ textAlign: "center", padding: 40, color: C.t3 }}>Cargando tablero...</div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: C.errPale, color: C.err, padding: 14, borderRadius: R.md, marginTop: 12, fontSize: 13 }}>{error}</div>
      )}

      {/* Board */}
      {data?.freights && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ marginTop: 14 }}>
            {data.freights.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>
                No hay fletes activos con camiones asignados
              </div>
            )}

            {data.freights.map(f => (
              <FreightRow key={f.id} freight={f} onUnassign={handleUnassign} />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeAssignment ? <TruckBlock assignment={activeAssignment} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
