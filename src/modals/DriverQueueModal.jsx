import { useState, useEffect } from "react";
import { C, Ic, MONO } from "../theme";
import { Btn, ModalOverlay } from "../components";
import { stCfg } from "../constants";
import { apiGetDriverQueue, apiReorderDriverQueue } from "../api";
import { useUIStore } from "../store";
import log from "../logger";

export default function DriverQueueModal({ driverId, driverName, onClose }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const show = useUIStore(s => s.show);

  useEffect(() => {
    if (!driverId) return;
    setLoading(true);
    apiGetDriverQueue(driverId).then(r => { setQueue(r || []); }).catch(() => setQueue([])).finally(() => setLoading(false));
  }, [driverId]);

  const move = (idx, dir) => {
    const next = idx + dir;
    if (next < 0 || next >= queue.length) return;
    const q = [...queue];
    [q[idx], q[next]] = [q[next], q[idx]];
    setQueue(q);
    setDirty(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await apiReorderDriverQueue(driverId, queue.map(q => q.freightId));
      setDirty(false);
      onClose();
    } catch (e) {
      log.error("DriverQueue", "reorder failed:", e);
      show("Error al guardar el orden", "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Cola del chofer</div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 16 }}>{driverName || "Chofer"}</div>

      {loading && <div style={{ fontSize: 12, color: C.t3, padding: 20, textAlign: "center" }}>Cargando cola...</div>}

      {!loading && queue.length === 0 && <div style={{ fontSize: 12, color: C.t3, padding: 20, textAlign: "center" }}>Sin fletes en cola</div>}

      {!loading && queue.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 360, overflowY: "auto" }}>
          {queue.map((q, i) => {
            const st = stCfg(q.status);
            return (
              <div key={q.assignmentId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${i === 0 ? C.pri : C.b1}`, background: i === 0 ? C.priPale : C.w }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: i === 0 ? C.pri : C.b1, color: i === 0 ? C.w : C.t2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: C.t2 }}>{q.code}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, padding: "1px 6px", borderRadius: 4 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, marginTop: 2 }}>{q.grain} {q.tons ? `\u00B7 ${q.tons}tn` : ""}</div>
                  {q.destName && <div style={{ fontSize: 10.5, color: C.t3, marginTop: 1 }}>{q.destName}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} style={{ width: 28, height: 24, borderRadius: 6, border: `1px solid ${C.b1}`, background: i === 0 ? C.bg : C.w, cursor: i === 0 ? "default" : "pointer", fontSize: 14, fontFamily: "inherit", color: i === 0 ? C.t3 : C.t1, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u25B2"}</button>
                  <button aria-label="Bajar" disabled={i === queue.length - 1} onClick={() => move(i, 1)} style={{ width: 28, height: 24, borderRadius: 6, border: `1px solid ${C.b1}`, background: i === queue.length - 1 ? C.bg : C.w, cursor: i === queue.length - 1 ? "default" : "pointer", fontSize: 14, fontFamily: "inherit", color: i === queue.length - 1 ? C.t3 : C.t1, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u25BC"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn full v="ghost" onClick={onClose}>Cerrar</Btn>
        {dirty && <Btn full disabled={saving} onClick={save}>{saving ? "Guardando..." : "Guardar orden"}</Btn>}
      </div>
    </ModalOverlay>
  );
}
