import { useState } from "react";
import { C, Ic } from "../../theme";
import { Btn } from "../../components";
import { ModalOverlay } from "../../components/overlays";
import { apiReclassifyPoi } from "../../api";

const MAP_COLORS = { field: "#1A6B37", lot: "#2563EB" };

export default function ReclassifyModal({ poi, fields, onClose, onReclassified }) {
  const [type, setType] = useState("field");
  const [fieldId, setFieldId] = useState("");
  const [hectares, setHectares] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const body = { targetType: type };
      if (type === "lot") {
        body.fieldId = fieldId;
        if (hectares) body.hectares = parseFloat(hectares);
      }
      await apiReclassifyPoi(poi.id, body);
      onReclassified?.(`Reclasificado como ${type === "field" ? "Campo" : "Lote"}`);
    } catch (err) {
      onReclassified?.(null, err.message || "Error al reclasificar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose} maxWidth={400} quick>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800 }}>{Ic.pin(C.acc, 18)} Reclasificar "{poi.name}"</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
        </div>

        <div style={{ fontSize: 13.2, color: C.t2, marginBottom: 14, lineHeight: 1.4 }}>
          Esta ubicación de interés se convertirá en un Campo o Lote. La ubicación original se eliminará.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { key: "field", label: "Campo", color: MAP_COLORS.field, icon: Ic.field },
            { key: "lot", label: "Lote", color: MAP_COLORS.lot, icon: Ic.lot },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setType(opt.key)}
              style={{
                flex: 1, padding: "12px 8px", borderRadius: 10,
                border: `2px solid ${type === opt.key ? opt.color : C.b2}`,
                background: type === opt.key ? `${opt.color}12` : C.w,
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 14.3, fontWeight: 800,
                color: type === opt.key ? opt.color : C.t3,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {opt.icon(type === opt.key ? opt.color : C.t3, 16)} {opt.label}
            </button>
          ))}
        </div>

        {type === "lot" && (
          <>
            <select
              value={fieldId}
              onChange={e => setFieldId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${fieldId ? C.ok : C.err}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", cursor: "pointer", boxSizing: "border-box", marginBottom: 10 }}
            >
              <option value="">— Seleccioná el campo —</option>
              {fields.filter(f => f.id).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input
              type="number"
              value={hectares}
              onChange={e => setHectares(e.target.value)}
              placeholder="Hectáreas (opcional)"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Btn sm v="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn sm disabled={saving || (type === "lot" && !fieldId)} onClick={handleConfirm} style={{ flex: 1 }}>
            {saving ? "Reclasificando..." : `Convertir a ${type === "field" ? "Campo" : "Lote"}`}
          </Btn>
        </div>
      </div>
    </ModalOverlay>
  );
}
