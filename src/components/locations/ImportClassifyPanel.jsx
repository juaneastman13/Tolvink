import { C, Ic } from "../../theme";
import { Btn, Bd } from "../../components";

const TYPE_CFG = {
  field: { label: "Campo", color: "#1A6B37", icon: (c, s) => Ic.field(c, s) },
  lot:   { label: "Lote",  color: "#2563EB", icon: (c, s) => Ic.lot(c, s) },
  poi:   { label: "Interés", color: "#0891B2", icon: (c, s) => Ic.poi(c, s) },
};

export default function ImportClassifyPanel({
  importParsed, importSelected, importNames, importTypes, importFieldIds, importComments,
  importDiscarded, importWarning, importListName, fieldOptions, saving, selectedCount,
  getType, getName,
  onToggle, onNameChange, onTypeChange, onFieldIdChange, onCommentChange,
  onSelectAll, onSelectNone, onPreview, onClose, onConfirm,
}) {
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, boxShadow: C.sh }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 14.3, fontWeight: 700 }}>{Ic.pin(C.pri, 14)} {importListName || "Ubicaciones encontradas"}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 14)}</button>
      </div>
      {importWarning && <div style={{ padding: "6px 10px", borderRadius: 8, marginBottom: 8, fontSize: 11, fontWeight: 500, background: C.warnPale, color: C.warn, border: `1px solid ${C.warn}30` }}>{importWarning}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 12.1, color: C.t2 }}>
          <span style={{ fontWeight: 600, color: C.ok }}>{importParsed.length} encontradas</span>
          {importDiscarded > 0 && <span style={{ color: C.t3 }}>{importDiscarded} descartadas</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onSelectAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.pri, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Todas</button>
          <span style={{ color: C.t3 }}>·</span>
          <button onClick={onSelectNone} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.t3, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Ninguna</button>
        </div>
      </div>

      {importParsed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 16, color: C.t3, fontSize: 12.7 }}>No se encontraron ubicaciones válidas</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {importParsed.map((loc, i) => {
              const sel = importSelected.has(i);
              const t = getType(i);
              const cfg = TYPE_CFG[t];
              return (
                <div key={i} style={{
                  borderRadius: 10, border: `1.5px solid ${sel ? cfg.color : C.b1}`,
                  borderLeft: sel ? `3px solid ${cfg.color}` : `3px solid ${C.b1}`,
                  background: sel ? `${cfg.color}04` : C.bg,
                  transition: "all 0.15s", overflow: "hidden",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 6px" }}>
                    <div onClick={() => onToggle(i)} style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: `2px solid ${sel ? cfg.color : C.b2}`,
                      background: sel ? cfg.color : C.w,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, cursor: "pointer",
                    }}>
                      {sel && Ic.chk(C.w, 12)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={importNames[i] ?? loc.name}
                        onChange={e => onNameChange(i, e.target.value)}
                        placeholder="Nombre"
                        style={{ width: "100%", border: "none", background: "transparent", fontSize: 13.2, fontWeight: 700, color: C.t1, fontFamily: "inherit", padding: 0, outline: "none" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        {loc.address && <span style={{ fontSize: 10, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.address}</span>}
                        <span style={{ fontSize: 9.5, color: C.ok, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onPreview({ name: importNames[i] ?? loc.name, address: loc.address, lat: loc.lat, lng: loc.lng })}
                      title="Ver en mapa"
                      style={{
                        background: `${cfg.color}10`, border: `1px solid ${cfg.color}30`,
                        borderRadius: 6, cursor: "pointer", padding: "6px 8px",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      {Ic.nav(cfg.color, 16)}
                    </button>
                  </div>

                  <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {Object.entries(TYPE_CFG).map(([k, c]) => {
                        const active = t === k;
                        return (
                          <button
                            key={k}
                            onClick={() => onTypeChange(i, k)}
                            style={{
                              flex: 1, padding: "6px 4px", borderRadius: 6,
                              border: `2px solid ${active ? c.color : C.b2}`,
                              background: active ? `${c.color}12` : C.w,
                              cursor: "pointer", fontFamily: "inherit",
                              fontSize: 11.5, fontWeight: 800,
                              color: active ? c.color : C.t3,
                              transition: "all 0.15s",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                            }}
                          >
                            {c.icon(active ? c.color : C.t3, 12)} {c.label}
                          </button>
                        );
                      })}
                    </div>

                    {t === "lot" && (
                      <select
                        value={importFieldIds[i] || ""}
                        onChange={e => onFieldIdChange(i, e.target.value)}
                        style={{
                          padding: "8px 10px", borderRadius: 6,
                          border: `1.5px solid ${importFieldIds[i] ? C.acc : C.err}`,
                          background: C.bgInput, fontFamily: "inherit", fontSize: 12.1,
                          color: C.t1, outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="">— Seleccioná el campo —</option>
                        {fieldOptions.map(fo => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
                      </select>
                    )}

                    <input
                      value={importComments[i] || ""}
                      onChange={e => onCommentChange(i, e.target.value)}
                      placeholder="Comentarios (opcional)"
                      style={{
                        width: "100%", padding: "6px 8px", borderRadius: 6,
                        border: `1px solid ${C.b2}`, background: C.bgInput,
                        fontFamily: "inherit", fontSize: 11.5, color: C.t1,
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCount > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {(() => {
                const counts = { field: 0, lot: 0, poi: 0 };
                importParsed.forEach((_, i) => { if (importSelected.has(i)) counts[getType(i)]++; });
                return Object.entries(TYPE_CFG).map(([k, c]) => counts[k] > 0 && (
                  <Bd key={k} color={c.color}>{counts[k]} {c.label}{counts[k] !== 1 ? (k === "poi" ? "es" : "s") : ""}</Bd>
                ));
              })()}
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <Btn sm v="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn sm disabled={saving || selectedCount === 0} onClick={onConfirm} style={{ flex: 1 }}>
              {saving ? "Importando..." : `Importar (${selectedCount})`}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
