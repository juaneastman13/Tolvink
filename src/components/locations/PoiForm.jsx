import { useState } from "react";
import { C, FONT } from "../../theme";
import { SafeZone, LocationPicker } from "../../maps";

const COLOR = "#0891B2";

export default function PoiForm({ mode = "create", poi, onSave, onCancel, saving }) {
  const [name, setName] = useState(mode === "edit" && poi ? poi.name : "");
  const [comments, setComments] = useState(mode === "edit" && poi ? (poi.comments || "") : "");
  const [loc, setLoc] = useState(() => {
    if (mode === "edit" && poi) {
      const lat = poi.lat != null ? Number(poi.lat) : null;
      const lng = poi.lng != null ? Number(poi.lng) : null;
      return lat && lng ? { lat, lng } : null;
    }
    return null;
  });

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    if (e.key === "Enter" && canSave) { e.preventDefault(); handleSave(); }
  };

  const handleSave = () => {
    onSave({
      name: name.trim(),
      comments: comments.trim() || undefined,
      lat: loc?.lat || undefined,
      lng: loc?.lng || undefined,
    });
  };

  const canSave = name.trim() && (mode === "edit" || loc?.lat);

  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.b2}`, background: mode === "edit" ? C.priPale : C.bgCard }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: mode === "edit" ? C.pri : COLOR, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {mode === "edit" ? "Editar ubicación" : "Nueva ubicación de interés"}
        </div>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Nombre" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        <input value={comments} onChange={e => setComments(e.target.value)} onKeyDown={handleKeyDown} placeholder="Comentarios (opcional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 12.1, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        <SafeZone><LocationPicker label={mode === "create" ? "Ubicación (obligatorio)" : "Ubicación"} value={loc} onChange={setLoc} /></SafeZone>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: mode === "edit" ? C.pri : COLOR, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, color: C.w, opacity: canSave && !saving ? 1 : 0.5 }}>{saving ? "..." : mode === "edit" ? "Guardar" : "Crear"}</button>
        </div>
      </div>
    </div>
  );
}
