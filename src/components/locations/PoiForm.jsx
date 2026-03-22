import { useState } from "react";
import { C, Ic, FONT, R } from "../../theme";
import { SafeZone, LocationPicker } from "../../maps";

const COLOR = C.sec;

// Parse "Campo: X / Lote: Y" or "Campo: X" from comments
function parseAssoc(comments, fields) {
  if (!comments || !fields?.length) return { fieldId: "", lotId: "", cleanComments: comments || "" };
  const match = comments.match(/(?:^|\n)Campo: (.+?)(?:\s*\/\s*Lote: (.+?))?$/);
  if (!match) return { fieldId: "", lotId: "", cleanComments: comments };
  const fieldName = match[1].trim();
  const lotName = match[2]?.trim() || "";
  const clean = comments.replace(/(?:^|\n)Campo: .+$/, "").trim();
  const field = fields.find(f => f.name === fieldName);
  if (!field) return { fieldId: "", lotId: "", cleanComments: clean };
  const lot = lotName ? (field.lots || []).find(l => l.name === lotName) : null;
  return { fieldId: field.id, lotId: lot?.id || "", cleanComments: clean };
}

export default function PoiForm({ mode = "create", poi, fields, onSave, onCancel, saving, onSelectOnMap, isManager, linkedCompanies, defaultOwnerCompanyId }) {
  const hasFields = fields?.length > 0;
  const parsed = mode === "edit" && poi && hasFields ? parseAssoc(poi.comments, fields) : null;

  const [name, setName] = useState(mode === "edit" && poi ? poi.name : "");
  const [ownerCompanyId, setOwnerCompanyId] = useState(defaultOwnerCompanyId || "");
  const [comments, setComments] = useState(parsed ? parsed.cleanComments : (mode === "edit" && poi ? (poi.comments || "") : ""));
  const [loc, setLoc] = useState(() => {
    if (mode === "edit" && poi) {
      const lat = poi.lat != null ? Number(poi.lat) : null;
      const lng = poi.lng != null ? Number(poi.lng) : null;
      return lat && lng ? { lat, lng } : null;
    }
    return null;
  });

  const [assocFieldId, setAssocFieldId] = useState(parsed?.fieldId || "");
  const [assocLotId, setAssocLotId] = useState(parsed?.lotId || "");
  const assocField = hasFields ? fields.find(f => f.id === assocFieldId) : null;
  const assocLots = assocField?.lots || [];

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    if (e.key === "Enter" && canSave) { e.preventDefault(); handleSave(); }
  };

  const handleSave = () => {
    // Build comments with association info
    let finalComments = comments.trim();
    if (assocFieldId && assocField) {
      const assocLot = assocLotId ? assocLots.find(l => l.id === assocLotId) : null;
      const ref = assocLot ? `Campo: ${assocField.name} / Lote: ${assocLot.name}` : `Campo: ${assocField.name}`;
      finalComments = finalComments ? `${finalComments}\n${ref}` : ref;
    }
    onSave({
      name: name.trim(),
      comments: finalComments || undefined,
      lat: loc?.lat || undefined,
      lng: loc?.lng || undefined,
      ...(ownerCompanyId ? { ownerCompanyId } : {}),
    });
  };

  const handleSelectOnMap = () => {
    onSelectOnMap?.(loc, (selected) => {
      if (selected) setLoc(selected);
    });
  };

  const canSave = name.trim() && (mode === "edit" || loc?.lat);

  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.b2}`, background: mode === "edit" ? C.priPale : C.bgCard }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: mode === "edit" ? C.pri : COLOR, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {mode === "edit" ? "Editar ubicación" : "Nueva ubicación de interés"}
        </div>
        {mode === "create" && isManager && linkedCompanies?.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>¿Para quién es esta ubicación?</label>
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
        <input autoFocus={!isManager || !linkedCompanies?.length} value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Nombre" style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        <input value={comments} onChange={e => setComments(e.target.value)} onKeyDown={handleKeyDown} placeholder="Comentarios (opcional)" style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 12.1, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        {hasFields && (
          <>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>Campo asociado (opcional)</label>
              <select value={assocFieldId} onChange={e => { setAssocFieldId(e.target.value); setAssocLotId(""); }} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", appearance: "auto" }}>
                <option value="">Sin campo asociado</option>
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            {assocFieldId && assocLots.length > 0 && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>Lote asociado (opcional)</label>
                <select value={assocLotId} onChange={e => setAssocLotId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", appearance: "auto" }}>
                  <option value="">Sin lote asociado</option>
                  {assocLots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        {onSelectOnMap ? (
          <div>
            {loc ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: R.md, background: C.okPale, border: `1px solid ${C.ok}40` }}>
                <span style={{ flex: 1, fontSize: 12.1, color: C.t1 }}>{`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}</span>
                <button onClick={handleSelectOnMap} style={{ padding: "3px 8px", borderRadius: R.sm, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.t2 }}>Modificar ubicación</button>
              </div>
            ) : (
              <button onClick={handleSelectOnMap} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1.5px dashed ${COLOR}`, background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: COLOR }}>
                {Ic.pin(COLOR, 14)} {mode === "create" ? "Seleccionar ubicación en mapa (obligatorio)" : "Seleccionar ubicación en mapa"}
              </button>
            )}
          </div>
        ) : (
          <SafeZone><LocationPicker label={mode === "create" ? "Ubicación (obligatorio)" : "Ubicación"} value={loc} onChange={setLoc} /></SafeZone>
        )}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "5px 12px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
          <button onClick={handleSave} disabled={!canSave || saving} style={{ padding: "5px 12px", borderRadius: R.md, border: "none", background: mode === "edit" ? C.pri : COLOR, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, color: C.w, opacity: canSave && !saving ? 1 : 0.5 }}>{saving ? "..." : mode === "edit" ? "Guardar" : "Crear"}</button>
        </div>
      </div>
    </div>
  );
}
