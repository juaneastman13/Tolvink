import { useState } from "react";
import { C, Ic, FONT } from "../../theme";
import { SafeZone, LocationPicker } from "../../maps";

const COLOR = "#1A6B37";

export default function FieldForm({ mode = "create", field, onSave, onCancel, saving, onSelectOnMap }) {
  const [name, setName] = useState(mode === "edit" ? "" : "");
  const [loc, setLoc] = useState(() => {
    if (mode === "edit" && field) {
      const lat = field.lat != null ? Number(field.lat) : null;
      const lng = field.lng != null ? Number(field.lng) : null;
      return lat && lng ? { lat, lng, address: field.address || "" } : null;
    }
    return null;
  });

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    if (e.key === "Enter" && canSave) { e.preventDefault(); handleSave(); }
  };

  const handleSave = () => {
    if (mode === "create") {
      onSave({ name: name.trim(), address: loc?.address, lat: loc?.lat, lng: loc?.lng });
    } else {
      onSave({ address: loc?.address, lat: loc?.lat, lng: loc?.lng });
    }
  };

  const handleSelectOnMap = () => {
    onSelectOnMap?.(loc, (selected) => {
      if (selected) setLoc(selected);
    });
  };

  const canSave = mode === "edit" || name.trim();

  return (
    <div style={{ padding: 12, borderBottom: `1px solid ${C.b2}`, background: mode === "edit" ? C.priPale : C.bgCard }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: mode === "edit" ? C.pri : COLOR, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {mode === "edit" ? "Editar campo" : "Nuevo campo"}
      </div>
      {mode === "create" && (
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nombre del campo"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
        />
      )}
      {onSelectOnMap ? (
        <div style={{ marginBottom: 6 }}>
          {loc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: C.okPale, border: `1px solid ${C.ok}40` }}>
              <span style={{ flex: 1, fontSize: 12.1, color: C.t1 }}>{loc.address || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}</span>
              <button onClick={handleSelectOnMap} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.t2 }}>Cambiar</button>
            </div>
          ) : (
            <button onClick={handleSelectOnMap} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px dashed ${C.b2}`, background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t3 }}>
              {Ic.pin(C.t3, 14)} {mode === "create" ? "Seleccionar en mapa (opcional)" : "Seleccionar en mapa"}
            </button>
          )}
        </div>
      ) : (
        <SafeZone><LocationPicker label={mode === "create" ? "Ubicación (opcional)" : "Ubicación"} value={loc} onChange={setLoc} /></SafeZone>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving || !canSave} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: mode === "edit" ? C.pri : COLOR, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, color: C.w, opacity: (!canSave || saving) ? 0.5 : 1 }}>{saving ? "..." : mode === "edit" ? "Guardar" : "Crear campo"}</button>
      </div>
    </div>
  );
}
