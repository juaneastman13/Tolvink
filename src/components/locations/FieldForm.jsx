import { useState } from "react";
import { C, Ic, FONT, R } from "../../theme";
import { SafeZone, LocationPicker } from "../../maps";

const COLOR = C.pri;

export default function FieldForm({ mode = "create", field, onSave, onCancel, saving, onSelectOnMap, isManager, linkedCompanies, defaultOwnerCompanyId }) {
  const [name, setName] = useState(mode === "edit" ? "" : "");
  const [ownerCompanyId, setOwnerCompanyId] = useState(defaultOwnerCompanyId || "");
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
      onSave({ name: name.trim(), address: loc?.address, lat: loc?.lat, lng: loc?.lng, ...(ownerCompanyId ? { ownerCompanyId } : {}) });
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
      {mode === "create" && isManager && linkedCompanies?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>¿Para quién es este campo?</label>
          <select value={ownerCompanyId} onChange={e => setOwnerCompanyId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px solid ${ownerCompanyId ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", appearance: "auto" }}>
            <option value="">Para mi empresa</option>
            {linkedCompanies.map(r => {
              const co = r.granteeCompany || {};
              const cId = r.granteeCompanyId || co.id;
              return <option key={cId} value={cId}>{co.name || "Empresa"}</option>;
            })}
          </select>
        </div>
      )}
      {mode === "create" && (
        <input
          autoFocus={!isManager || !linkedCompanies?.length}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nombre del campo"
          style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
        />
      )}
      {onSelectOnMap ? (
        <div style={{ marginBottom: 6 }}>
          {loc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: R.md, background: C.okPale, border: `1px solid ${C.ok}40` }}>
              <span style={{ flex: 1, fontSize: 12.1, color: C.t1 }}>{loc.address || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}</span>
              <button onClick={handleSelectOnMap} style={{ padding: "3px 8px", borderRadius: R.sm, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.t2 }}>Modificar ubicación</button>
            </div>
          ) : (
            <button onClick={handleSelectOnMap} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px dashed ${C.b2}`, background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t3 }}>
              {Ic.pin(C.t3, 14)} {mode === "create" ? "Seleccionar ubicación en mapa (opcional)" : "Seleccionar ubicación en mapa"}
            </button>
          )}
        </div>
      ) : (
        <SafeZone><LocationPicker label={mode === "create" ? "Ubicación (opcional)" : "Ubicación"} value={loc} onChange={setLoc} /></SafeZone>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={onCancel} style={{ padding: "5px 12px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
        <button onClick={handleSave} disabled={saving || !canSave} style={{ padding: "5px 12px", borderRadius: R.md, border: "none", background: mode === "edit" ? C.pri : COLOR, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, color: C.w, opacity: (!canSave || saving) ? 0.5 : 1 }}>{saving ? "..." : mode === "edit" ? "Guardar" : "Crear campo"}</button>
      </div>
    </div>
  );
}
