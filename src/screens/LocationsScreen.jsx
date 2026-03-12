import { useState, useEffect, useCallback } from "react";
import { C, Ic } from "../theme";
import { Btn, Bd, Loader, LoadingOverlay, EmptyState } from "../components";
import { apiGetFields, apiCreateField, apiCreateLot, apiImportGoogleList, apiGetPois, apiCreatePoi, apiUpdatePoi, apiDeletePoi } from "../api";
import MapPreviewModal from "../modals/MapPreviewModal";

// Type config
const TYPE_CFG = {
  field: { label: "Campo", color: C.pri, icon: (c, s) => Ic.pin(c, s) },
  lot:   { label: "Lote",  color: C.acc, icon: (c, s) => Ic.grain(c, s) },
  poi:   { label: "Interés", color: C.sec, icon: (c, s) => Ic.nav(c, s) },
};

export default function LocationsScreen({ onBack }) {
  const [fields, setFields] = useState([]);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");

  // Map preview
  const [previewLoc, setPreviewLoc] = useState(null);

  // Import flow
  const [importStep, setImportStep] = useState(0);
  const [importUrl, setImportUrl] = useState("");
  const [importParsed, setImportParsed] = useState([]);
  const [importDiscarded, setImportDiscarded] = useState(0);
  const [importSelected, setImportSelected] = useState(new Set());
  const [importNames, setImportNames] = useState({});
  const [importTypes, setImportTypes] = useState({});       // i -> "field"|"lot"|"poi"
  const [importFieldIds, setImportFieldIds] = useState({});  // i -> fieldId (when lot)
  const [importComments, setImportComments] = useState({});   // i -> string
  const [importWarning, setImportWarning] = useState(null);
  const [importListName, setImportListName] = useState(null);
  const [importSlowMsg, setImportSlowMsg] = useState(false);

  // Edit/delete POI
  const [editingPoi, setEditingPoi] = useState(null); // poi object being edited
  const [editName, setEditName] = useState("");
  const [editComments, setEditComments] = useState("");
  const [deletingPoi, setDeletingPoi] = useState(null); // poi id to confirm delete

  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([
        apiGetFields(),
        apiGetPois().catch(() => []),  // POI table might not exist yet
      ]);
      setFields(f || []);
      setPois(p || []);
    } catch (e) {
      setMsg({ t: e.message || "Error al cargar datos", k: "err" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Import handlers ──
  const handleImportList = async () => {
    const raw = importUrl.trim();
    if (!raw) { setMsg({ t: "Pegá el link de tu lista de Google Maps", k: "err" }); return; }
    const urlMatch = raw.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : raw;
    if (!url.includes("maps") && !url.includes("goo.gl")) { setMsg({ t: "Esa URL no parece ser de Google Maps", k: "err" }); return; }
    setSaving(true);
    setImportSlowMsg(false);
    const slowTimer = setTimeout(() => setImportSlowMsg(true), 15000);
    try {
      const result = await apiImportGoogleList(url);
      setImportParsed(result.parsed || []);
      setImportDiscarded(result.discarded || 0);
      setImportWarning(result.warning || null);
      setImportListName(result.listName || null);
      setImportSelected(new Set(result.parsed.map((_, i) => i)));
      setImportNames({});
      setImportTypes({});
      setImportFieldIds({});
      setImportComments({});
      setImportStep(2);
    } catch (err) {
      setMsg({ t: err.message || "No se pudieron extraer ubicaciones de este link.", k: "err" });
    } finally {
      clearTimeout(slowTimer);
      setImportSlowMsg(false);
      setSaving(false);
    }
  };

  const handleImportConfirm = async () => {
    const selected = importParsed
      .map((loc, i) => ({ loc, i }))
      .filter(({ i }) => importSelected.has(i));
    if (selected.length === 0) { setMsg({ t: "Seleccioná al menos una ubicación", k: "err" }); return; }

    for (const { i } of selected) {
      if (getType(i) === "lot" && !importFieldIds[i]) {
        setMsg({ t: `"${getName(i)}" es Lote pero no tiene campo asignado`, k: "err" });
        return;
      }
    }

    setSaving(true);
    let createdFields = 0, createdLots = 0, createdPois = 0;
    const errors = [];

    // Pass 1: fields
    const newFieldIds = {};
    for (const { loc, i } of selected) {
      if (getType(i) !== "field") continue;
      const name = getName(i);
      try {
        const r = await apiCreateField({ name, address: loc.address || undefined, lat: loc.lat, lng: loc.lng });
        newFieldIds[i] = r.id;
        createdFields++;
      } catch (err) { errors.push(`"${name}": ${err.message}`); }
    }

    // Pass 2: lots
    for (const { loc, i } of selected) {
      if (getType(i) !== "lot") continue;
      const name = getName(i);
      let fieldId = importFieldIds[i];
      if (fieldId?.startsWith("new:")) {
        fieldId = newFieldIds[parseInt(fieldId.split(":")[1], 10)];
        if (!fieldId) { errors.push(`"${name}": el campo asociado no se pudo crear`); continue; }
      }
      try {
        await apiCreateLot(fieldId, { name, lat: loc.lat, lng: loc.lng });
        createdLots++;
      } catch (err) { errors.push(`"${name}": ${err.message}`); }
    }

    // Pass 3: POIs
    for (const { loc, i } of selected) {
      if (getType(i) !== "poi") continue;
      const name = getName(i);
      try {
        await apiCreatePoi({ name, address: loc.address || undefined, lat: loc.lat, lng: loc.lng, comments: importComments[i] || undefined });
        createdPois++;
      } catch (err) { errors.push(`"${name}": ${err.message}`); }
    }

    setImportStep(0); setImportParsed([]); setImportUrl(""); setSaving(false);
    const parts = [];
    if (createdFields) parts.push(`${createdFields} campo${createdFields !== 1 ? "s" : ""}`);
    if (createdLots) parts.push(`${createdLots} lote${createdLots !== 1 ? "s" : ""}`);
    if (createdPois) parts.push(`${createdPois} ubicación${createdPois !== 1 ? "es" : ""} de interés`);
    const total = createdFields + createdLots + createdPois;
    if (total > 0) {
      let msg = parts.join(", ") + ` importado${total !== 1 ? "s" : ""}`;
      if (createdFields || createdLots) msg += ". Campos y lotes: ver en Mis Campos y Lotes";
      if (errors.length) msg += ` · ${errors.length} error${errors.length !== 1 ? "es" : ""}: ${errors.slice(0, 2).join("; ")}`;
      setDoneMsg(msg);
    } else if (errors.length) {
      setDoneMsg(`Error al importar: ${errors.slice(0, 3).join("; ")}`);
    } else {
      setDoneMsg("No se importaron ubicaciones");
    }
    load();
  };

  const toggleItem = (i) => setImportSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const closeImport = () => { setImportStep(0); setImportParsed([]); setImportUrl(""); setImportWarning(null); setImportListName(null); setImportTypes({}); setImportFieldIds({}); setImportComments({}); };

  const startEditPoi = (p) => {
    setEditingPoi(p);
    setEditName(p.name);
    setEditComments(p.comments || "");
  };

  const handleUpdatePoi = async () => {
    if (!editingPoi) return;
    setSaving(true);
    try {
      await apiUpdatePoi(editingPoi.id, { name: editName.trim(), comments: editComments.trim() || undefined });
      setEditingPoi(null);
      setMsg({ t: "Ubicación actualizada", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al actualizar", k: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePoi = async (id) => {
    setSaving(true);
    try {
      await apiDeletePoi(id);
      setDeletingPoi(null);
      setMsg({ t: "Ubicación eliminada", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al eliminar", k: "err" });
    } finally {
      setSaving(false);
    }
  };
  const selectedCount = [...importSelected].length;
  const getType = (i) => importTypes[i] || "field";
  const getName = (i) => (importNames[i] ?? (importParsed[i]?.name || "")).trim().slice(0, 255);

  const fieldOptions = [
    ...fields.map(f => ({ id: f.id, name: f.name })),
    ...importParsed
      .map((loc, i) => ({ i, name: importNames[i] ?? loc.name }))
      .filter(({ i }) => importSelected.has(i) && getType(i) === "field")
      .map(({ i, name }) => ({ id: `new:${i}`, name: `${name} (nuevo)` })),
  ];

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}
      {previewLoc && <MapPreviewModal loc={previewLoc} onClose={() => setPreviewLoc(null)} />}

      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, padding: "18px 18px 8px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {Ic.chev(C.pri, 18)} Menú
        </button>
      </div>

      <div style={{ padding: "0 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Ubicaciones</div>
          <Btn sm v={importStep ? "ghost" : "acc"} onClick={() => setImportStep(importStep ? 0 : 1)} icon={importStep ? Ic.cross(C.t2, 14) : Ic.pin(C.w, 14)}>
            {importStep ? "Cerrar" : "Importar"}
          </Btn>
        </div>

        {msg && (
          <div onClick={() => setMsg(null)} style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.2, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err, cursor: "pointer" }}>
            {msg.t}
          </div>
        )}

        {/* ── Step 1: Paste link ── */}
        {importStep === 1 && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
            <div style={{ fontSize: 15.4, fontWeight: 700, marginBottom: 8 }}>{Ic.pin(C.pri, 16)} Importar desde Google Maps</div>
            <div style={{ fontSize: 12.7, color: C.t2, lineHeight: 1.5, marginBottom: 12 }}>
              Abrí Google Maps → <strong>Tus sitios</strong> → Seleccioná una lista → <strong>Compartir</strong> → Copiar enlace
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${importUrl ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              />
              <button
                onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setImportUrl(t); } catch { setMsg({ t: "No se pudo pegar. Pegá manualmente.", k: "err" }); } }}
                style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${C.b1}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 600, color: C.pri, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {Ic.copy ? Ic.copy(C.pri, 14) : null} Pegar
              </button>
            </div>
            {importSlowMsg && <div style={{ marginTop: 8, fontSize: 12.1, color: C.t3, fontStyle: "italic" }}>Esto puede tardar un momento…</div>}
            <div style={{ marginTop: 10 }}>
              <Btn full v="acc" disabled={saving || !importUrl.trim()} onClick={handleImportList}>
                {saving ? "Buscando ubicaciones…" : "Buscar ubicaciones"}
              </Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: Classify each location ── */}
        {importStep === 2 && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15.4, fontWeight: 700 }}>{Ic.pin(C.pri, 16)} {importListName || "Ubicaciones encontradas"}</div>
              <button onClick={closeImport} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 16)}</button>
            </div>
            {importWarning && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12.1, fontWeight: 500, background: C.warnPale, color: C.warn, border: `1px solid ${C.warn}30` }}>{importWarning}</div>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, fontSize: 12.7, color: C.t2 }}>
                <span style={{ fontWeight: 600, color: C.ok }}>{importParsed.length} encontradas</span>
                {importDiscarded > 0 && <span style={{ color: C.t3 }}>{importDiscarded} descartadas</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setImportSelected(new Set(importParsed.map((_, i) => i)))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.pri, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Todas</button>
                <span style={{ color: C.t3 }}>·</span>
                <button onClick={() => setImportSelected(new Set())} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.t3, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Ninguna</button>
              </div>
            </div>

            {importParsed.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13.2 }}>No se encontraron ubicaciones válidas</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {importParsed.map((loc, i) => {
                    const sel = importSelected.has(i);
                    const t = getType(i);
                    const cfg = TYPE_CFG[t];
                    return (
                      <div key={i} style={{
                        borderRadius: 12, border: `1.5px solid ${sel ? cfg.color : C.b1}`,
                        borderLeft: sel ? `4px solid ${cfg.color}` : `4px solid ${C.b1}`,
                        background: sel ? `${cfg.color}04` : C.bg,
                        transition: "all 0.15s", overflow: "hidden",
                      }}>
                        {/* ── Row 1: checkbox + name + coords + map btn ── */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 8px" }}>
                          <div onClick={() => toggleItem(i)} style={{
                            width: 22, height: 22, borderRadius: 6,
                            border: `2px solid ${sel ? cfg.color : C.b2}`,
                            background: sel ? cfg.color : C.w,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, cursor: "pointer",
                          }}>
                            {sel && Ic.chk(C.w, 13)}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input
                              value={importNames[i] ?? loc.name}
                              onChange={e => setImportNames(prev => ({ ...prev, [i]: e.target.value }))}
                              placeholder="Nombre de la ubicación"
                              style={{
                                width: "100%", border: "none", background: "transparent",
                                fontSize: 15.4, fontWeight: 700, color: C.t1,
                                fontFamily: "inherit", padding: 0, outline: "none",
                              }}
                            />
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                              {loc.address && <span style={{ fontSize: 11.5, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.address}</span>}
                              <span style={{ fontSize: 10.5, color: C.ok, fontWeight: 700, whiteSpace: "nowrap" }}>
                                {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setPreviewLoc({ name: importNames[i] ?? loc.name, address: loc.address, lat: loc.lat, lng: loc.lng })}
                            title="Ver en mapa"
                            style={{
                              background: `${cfg.color}10`, border: `1px solid ${cfg.color}30`,
                              borderRadius: 8, cursor: "pointer", padding: "8px 10px",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}
                          >
                            {Ic.nav(cfg.color, 18)}
                          </button>
                        </div>

                        {/* ── Row 2: Type selector (always visible) ── */}
                        <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {Object.entries(TYPE_CFG).map(([k, c]) => {
                              const active = t === k;
                              return (
                                <button
                                  key={k}
                                  onClick={() => {
                                    if (k === "field") {
                                      setImportTypes(prev => { const n = { ...prev }; delete n[i]; return n; });
                                      setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; });
                                    } else {
                                      setImportTypes(prev => ({ ...prev, [i]: k }));
                                      if (k !== "lot") setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; });
                                    }
                                    // Auto-select field when only 1 option available
                                    if (k === "lot" && fieldOptions.length === 1) {
                                      setImportFieldIds(prev => ({ ...prev, [i]: fieldOptions[0].id }));
                                    }
                                    // Auto-select when setting type
                                    if (!sel) setImportSelected(prev => new Set([...prev, i]));
                                  }}
                                  style={{
                                    flex: 1, padding: "8px 6px", borderRadius: 8,
                                    border: `2px solid ${active ? c.color : C.b2}`,
                                    background: active ? `${c.color}12` : C.w,
                                    cursor: "pointer", fontFamily: "inherit",
                                    fontSize: 13.2, fontWeight: 800,
                                    color: active ? c.color : C.t3,
                                    transition: "all 0.15s",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                  }}
                                >
                                  {c.icon(active ? c.color : C.t3, 14)} {c.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Field dropdown for lots */}
                          {t === "lot" && (
                            <select
                              value={importFieldIds[i] || ""}
                              onChange={e => setImportFieldIds(prev => ({ ...prev, [i]: e.target.value }))}
                              style={{
                                padding: "10px 12px", borderRadius: 8,
                                border: `1.5px solid ${importFieldIds[i] ? C.acc : C.err}`,
                                background: C.bgInput, fontFamily: "inherit", fontSize: 13.2,
                                color: C.t1, outline: "none", cursor: "pointer",
                              }}
                            >
                              <option value="">— Seleccioná el campo —</option>
                              {fieldOptions.map(fo => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
                            </select>
                          )}

                          {/* Comments input */}
                          <input
                            value={importComments[i] || ""}
                            onChange={e => setImportComments(prev => ({ ...prev, [i]: e.target.value }))}
                            placeholder="Comentarios (opcional)"
                            style={{
                              width: "100%", padding: "8px 10px", borderRadius: 8,
                              border: `1px solid ${C.b2}`, background: C.bgInput,
                              fontFamily: "inherit", fontSize: 12.7, color: C.t1,
                              outline: "none", boxSizing: "border-box",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                {selectedCount > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {(() => {
                      const counts = { field: 0, lot: 0, poi: 0 };
                      importParsed.forEach((_, i) => { if (importSelected.has(i)) counts[getType(i)]++; });
                      return Object.entries(TYPE_CFG).map(([k, c]) => counts[k] > 0 && (
                        <Bd key={k} color={c.color}>{counts[k]} {c.label}{counts[k] !== 1 ? (k === "poi" ? "es" : "s") : ""}</Bd>
                      ));
                    })()}
                  </div>
                )}

                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  <Btn sm v="ghost" onClick={closeImport}>Cancelar</Btn>
                  <Btn sm disabled={saving || selectedCount === 0} onClick={handleImportConfirm} style={{ flex: 1 }}>
                    {saving ? "Importando..." : `Importar seleccionadas (${selectedCount})`}
                  </Btn>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── POI list (only ubicaciones de interés) ── */}
        {loading ? <Loader /> :
          pois.length === 0 && importStep === 0 ? (
            <EmptyState
              icon={Ic.nav(C.t3, 28)}
              title="Sin ubicaciones de interés"
              subtitle="Importá ubicaciones desde Google Maps y marcalas como 'Interés'"
              action={<Btn sm onClick={() => setImportStep(1)}>Importar</Btn>}
            />
          ) : importStep === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <Bd color={C.sec}>{pois.length} ubicación{pois.length !== 1 ? "es" : ""} de interés</Bd>
              </div>

              {pois.map(p => (
                <div key={p.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${C.sec}`, borderRadius: 12, boxShadow: C.sh, padding: "12px 14px" }}>
                  {editingPoi?.id === p.id ? (
                    // Edit mode
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: "inherit", fontSize: 14.3, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box" }} />
                      <input value={editComments} onChange={e => setEditComments(e.target.value)} placeholder="Comentarios (opcional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 12.7, color: C.t1, outline: "none", boxSizing: "border-box" }} />
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => setEditingPoi(null)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 600, color: C.t2 }}>Cancelar</button>
                        <button onClick={handleUpdatePoi} disabled={!editName.trim()} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 700, color: C.w, opacity: editName.trim() ? 1 : 0.5 }}>Guardar</button>
                      </div>
                    </div>
                  ) : deletingPoi === p.id ? (
                    // Delete confirmation
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13.2, fontWeight: 600, color: C.err }}>¿Eliminar "{p.name}"?</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setDeletingPoi(null)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 600, color: C.t2 }}>No</button>
                        <button onClick={() => handleDeletePoi(p.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.err, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 700, color: C.w }}>Sí, eliminar</button>
                      </div>
                    </div>
                  ) : (
                    // Normal display
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.sec}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {Ic.nav(C.sec, 16)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{p.name}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                          <Bd color={C.sec} small>Interés</Bd>
                          {p.address && <span style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</span>}
                          {p.comments && <span style={{ fontSize: 11, color: C.t2, fontStyle: "italic" }}>{p.comments}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {p.lat && p.lng && (
                          <span style={{ fontSize: 10, color: C.ok, fontWeight: 600 }}>
                            {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}
                          </span>
                        )}
                        <button onClick={() => setPreviewLoc({ name: p.name, address: p.address, lat: Number(p.lat), lng: Number(p.lng) })} title="Ver en mapa" style={{ background: `${C.sec}10`, border: `1px solid ${C.sec}30`, borderRadius: 8, cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {Ic.nav(C.sec, 14)}
                        </button>
                        <button onClick={() => startEditPoi(p)} title="Editar" style={{ background: `${C.pri}10`, border: `1px solid ${C.pri}30`, borderRadius: 8, cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {Ic.pin(C.pri, 14)}
                        </button>
                        <button onClick={() => setDeletingPoi(p.id)} title="Eliminar" style={{ background: `${C.err}10`, border: `1px solid ${C.err}30`, borderRadius: 8, cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {Ic.cross(C.err, 14)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
