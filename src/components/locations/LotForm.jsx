import { useState } from "react";
import { C, Ic, FONT } from "../../theme";
import { SafeZone, LocationPicker } from "../../maps";

export default function LotForm({ mode = "create", lot, fieldId, fieldName, fields, defaultCenter, onSave, onCancel, saving, onSelectOnMap }) {
  const [name, setName] = useState("");
  const [ha, setHa] = useState(() => {
    if (mode === "edit" && lot) return lot.hectares != null ? String(Number(lot.hectares)) : "";
    return "";
  });
  const [loc, setLoc] = useState(() => {
    if (mode === "edit" && lot) {
      const lat = lot.lat != null ? Number(lot.lat) : null;
      const lng = lot.lng != null ? Number(lot.lng) : null;
      return lat && lng ? { lat, lng } : null;
    }
    return null;
  });
  // General mode: user must pick a field from dropdown
  const isGeneralCreate = mode === "create" && !fieldId && fields?.length > 0;
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const noFields = mode === "create" && !fieldId && (!fields || fields.length === 0);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    if (e.key === "Enter" && canSave) { e.preventDefault(); handleSave(); }
  };

  const handleSave = () => {
    if (mode === "create") {
      const resolvedFieldId = fieldId || selectedFieldId;
      onSave({ _fieldId: resolvedFieldId, name: name.trim(), hectares: ha ? parseFloat(ha) : undefined, lat: loc?.lat, lng: loc?.lng });
    } else {
      onSave({ hectares: ha ? parseFloat(ha) : undefined, lat: loc?.lat, lng: loc?.lng });
    }
  };

  const handleSelectOnMap = () => {
    onSelectOnMap?.(loc, (selected) => {
      if (selected) setLoc(selected);
    });
  };

  const canSave = mode === "edit" ? true : (name.trim() && (fieldId || selectedFieldId));
  const padding = mode === "edit" ? "10px 16px 14px 40px" : "10px 16px 14px 16px";

  // Derive defaultCenter from selected field if in general mode
  const resolvedCenter = defaultCenter || (() => {
    if (isGeneralCreate && selectedFieldId) {
      const f = fields.find(x => x.id === selectedFieldId);
      if (f?.lat && f?.lng) return { lat: Number(f.lat), lng: Number(f.lng) };
    }
    return null;
  })();

  return (
    <div style={{ padding, borderBottom: `1px solid ${C.b2}`, background: mode === "edit" ? C.accPale : C.bgCard }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.acc, marginBottom: mode === "edit" ? 4 : 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {mode === "edit" ? "Editar lote" : "Nuevo lote"}
      </div>
      {mode === "edit" && fieldName && (
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, fontFamily: FONT }}>Lote de: {fieldName}</div>
      )}
      {mode === "create" && fieldId && fieldName && (
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, fontFamily: FONT }}>Lote de: {fieldName}</div>
      )}
      {noFields && (
        <div style={{ padding: "12px 0", fontSize: 13, color: C.t3, fontWeight: 500 }}>Primero debés crear un campo</div>
      )}
      {isGeneralCreate && (
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>Campo</label>
          <select value={selectedFieldId} onChange={e => setSelectedFieldId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${selectedFieldId ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", appearance: "auto" }}>
            <option value="">Seleccionar campo...</option>
            {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      {!noFields && mode === "create" && (
        <div style={{ marginBottom: 6 }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Nombre del lote" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}
      {!noFields && (
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>Hectáreas</label>
          <input value={ha} onChange={e => setHa(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ej: 150" type="number" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        </div>
      )}
      {!noFields && onSelectOnMap ? (
        <div style={{ marginBottom: 6 }}>
          {loc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: C.okPale, border: `1px solid ${C.ok}40` }}>
              <span style={{ flex: 1, fontSize: 12.1, color: C.t1 }}>{`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}</span>
              <button onClick={handleSelectOnMap} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.t2 }}>Modificar ubicación</button>
            </div>
          ) : (
            <button onClick={handleSelectOnMap} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px dashed ${C.b2}`, background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t3 }}>
              {Ic.pin(C.t3, 14)} Seleccionar ubicación en mapa
            </button>
          )}
        </div>
      ) : !noFields ? (
        <SafeZone><LocationPicker label="Ubicación del lote" value={loc} onChange={setLoc} defaultCenter={resolvedCenter} /></SafeZone>
      ) : null}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
        {!noFields && <button onClick={handleSave} disabled={saving || !canSave} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.acc, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, color: C.w, opacity: (!canSave || saving) ? 0.5 : 1 }}>{saving ? "..." : mode === "edit" ? "Guardar" : "Crear lote"}</button>}
      </div>
    </div>
  );
}
