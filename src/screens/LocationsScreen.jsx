import { useState, useEffect, useCallback } from "react";
import { C, Ic } from "../theme";
import { Btn, Bd, Loader, LoadingOverlay, EmptyState } from "../components";
import { apiGetFields, apiCreateField, apiCreateLot, apiImportGoogleList } from "../api";

export default function LocationsScreen({ onBack }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");

  // Import flow
  const [importStep, setImportStep] = useState(0); // 0=hidden, 1=paste, 2=preview
  const [importUrl, setImportUrl] = useState("");
  const [importParsed, setImportParsed] = useState([]);
  const [importDiscarded, setImportDiscarded] = useState(0);
  const [importSelected, setImportSelected] = useState(new Set());
  const [importNames, setImportNames] = useState({});
  const [importTypes, setImportTypes] = useState({}); // i -> "field"|"lot"
  const [importFieldIds, setImportFieldIds] = useState({}); // i -> fieldId (when type=lot)
  const [importWarning, setImportWarning] = useState(null);
  const [importListName, setImportListName] = useState(null);
  const [importSlowMsg, setImportSlowMsg] = useState(false);

  const load = useCallback(async () => {
    try {
      const f = await apiGetFields();
      setFields(f || []);
    } catch (e) {
      setMsg({ t: e.message || "Error al cargar campos", k: "err" });
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
      const sel = new Set(result.parsed.map((_, i) => i));
      setImportSelected(sel);
      setImportNames({});
      setImportTypes({});
      setImportFieldIds({});
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

    // Validate: lots must have a field assigned
    for (const { i } of selected) {
      if (importTypes[i] === "lot" && !importFieldIds[i]) {
        setMsg({ t: `"${importNames[i] ?? importParsed[i].name}" está marcada como Lote pero no tiene campo asignado`, k: "err" });
        return;
      }
    }

    setSaving(true);
    let createdFields = 0;
    let createdLots = 0;
    const errors = [];

    // First pass: create fields
    const newFieldIds = {}; // index -> new field id
    for (const { loc, i } of selected) {
      if (importTypes[i] === "lot") continue;
      const name = (importNames[i] ?? loc.name).trim().slice(0, 255);
      try {
        const created = await apiCreateField({
          name,
          address: loc.address || undefined,
          lat: loc.lat,
          lng: loc.lng,
        });
        newFieldIds[i] = created.id;
        createdFields++;
      } catch (err) {
        errors.push(`"${name}": ${err.message}`);
      }
    }

    // Second pass: create lots
    for (const { loc, i } of selected) {
      if (importTypes[i] !== "lot") continue;
      const name = (importNames[i] ?? loc.name).trim().slice(0, 255);
      // The fieldId can reference either an existing field or a newly created one
      let fieldId = importFieldIds[i];
      // Check if fieldId points to another import item (new:X format)
      if (fieldId?.startsWith("new:")) {
        const refIdx = parseInt(fieldId.split(":")[1], 10);
        fieldId = newFieldIds[refIdx];
        if (!fieldId) {
          errors.push(`"${name}": el campo asociado no se pudo crear`);
          continue;
        }
      }
      try {
        await apiCreateLot(fieldId, {
          name,
          lat: loc.lat,
          lng: loc.lng,
        });
        createdLots++;
      } catch (err) {
        errors.push(`"${name}": ${err.message}`);
      }
    }

    setImportStep(0);
    setImportParsed([]);
    setImportUrl("");
    setSaving(false);
    const parts = [];
    if (createdFields) parts.push(`${createdFields} campo${createdFields !== 1 ? "s" : ""}`);
    if (createdLots) parts.push(`${createdLots} lote${createdLots !== 1 ? "s" : ""}`);
    const errMsg = errors.length ? ` (${errors.length} error${errors.length !== 1 ? "es" : ""})` : "";
    setDoneMsg((parts.join(" y ") || "0 ubicaciones") + ` importado${createdFields + createdLots !== 1 ? "s" : ""}${errMsg}`);
    load();
  };

  const toggleImportItem = (i) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const closeImport = () => {
    setImportStep(0);
    setImportParsed([]);
    setImportUrl("");
    setImportWarning(null);
    setImportListName(null);
    setImportTypes({});
    setImportFieldIds({});
  };

  const selectedCount = [...importSelected].length;

  // ── Build field options for the lot dropdown ──
  // Includes existing fields + items in current import marked as "field"
  const fieldOptions = [
    ...fields.map(f => ({ id: f.id, name: f.name })),
    ...importParsed
      .map((loc, i) => ({ i, name: importNames[i] ?? loc.name }))
      .filter(({ i }) => importSelected.has(i) && importTypes[i] !== "lot")
      .map(({ i, name }) => ({ id: `new:${i}`, name: `${name} (nuevo)` })),
  ];

  // ── Flat list of all fields + lots for display ──
  const allLocations = [];
  for (const f of fields) {
    allLocations.push({ ...f, _type: "field" });
    if (f.lots) {
      for (const l of f.lots) {
        allLocations.push({ ...l, _type: "lot", _fieldName: f.name, _fieldId: f.id });
      }
    }
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}

      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, padding: "18px 18px 8px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {Ic.chev(C.pri, 18)} Menú
        </button>
      </div>

      <div style={{ padding: "0 18px 18px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Ubicaciones</div>
          <Btn sm v={importStep ? "ghost" : "acc"} onClick={() => { setImportStep(importStep ? 0 : 1); }} icon={importStep ? Ic.cross(C.t2, 14) : Ic.pin(C.w, 14)}>
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
                onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t) setImportUrl(t); } catch {} }}
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
            <div style={{ marginTop: 8, fontSize: 11, color: C.t3, lineHeight: 1.5 }}>
              Máximo ~20 ubicaciones por lista. Si tu lista tiene más, dividila en varias.
            </div>
          </div>
        )}

        {/* ── Step 2: Preview, assign type, confirm ── */}
        {importStep === 2 && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15.4, fontWeight: 700 }}>{Ic.pin(C.pri, 16)} {importListName || "Ubicaciones encontradas"}</div>
              <button onClick={closeImport} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 16)}</button>
            </div>
            {importWarning && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12.1, fontWeight: 500, background: "#FFF8E1", color: "#F57F17", border: "1px solid #FFE082" }}>{importWarning}</div>}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 12.7, color: C.t2 }}>
              <span style={{ fontWeight: 600, color: C.ok }}>{importParsed.length} encontradas</span>
              {importDiscarded > 0 && <span style={{ color: C.t3 }}>{importDiscarded} descartadas</span>}
            </div>
            {importParsed.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13.2 }}>No se encontraron ubicaciones válidas</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setImportSelected(new Set(importParsed.map((_, i) => i)))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.pri, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Seleccionar todas</button>
                  <span style={{ color: C.t3 }}>·</span>
                  <button onClick={() => setImportSelected(new Set())} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.t3, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Ninguna</button>
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {importParsed.map((loc, i) => {
                    const isLot = importTypes[i] === "lot";
                    const selected = importSelected.has(i);
                    return (
                      <div key={i} style={{ borderRadius: 10, border: `1.5px solid ${selected ? (isLot ? C.acc : C.pri) : C.b1}`, background: selected ? (isLot ? `${C.acc}06` : `${C.pri}06`) : C.bg, transition: "all 0.15s", overflow: "hidden" }}>
                        {/* Main row */}
                        <div onClick={() => toggleImportItem(i)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", cursor: "pointer" }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selected ? (isLot ? C.acc : C.pri) : C.b1}`, background: selected ? (isLot ? C.acc : C.pri) : C.w, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                            {selected && Ic.chk(C.w, 12)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input
                              value={importNames[i] ?? loc.name}
                              onChange={(e) => { e.stopPropagation(); setImportNames(prev => ({ ...prev, [i]: e.target.value })); }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: "100%", border: "none", background: "transparent", fontSize: 14.3, fontWeight: 600, color: C.t1, fontFamily: "inherit", padding: 0, outline: "none" }}
                            />
                            {loc.address && <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.address}</div>}
                            <div style={{ fontSize: 10.5, color: C.ok, fontWeight: 600, marginTop: 2 }}>
                              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                            </div>
                          </div>
                        </div>

                        {/* Type selector (only when selected) */}
                        {selected && (
                          <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => { setImportTypes(prev => { const n = { ...prev }; delete n[i]; return n; }); setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; }); }}
                                style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${!isLot ? C.pri : C.b1}`, background: !isLot ? `${C.pri}15` : C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: !isLot ? C.pri : C.t3, transition: "all 0.15s" }}
                              >
                                {Ic.pin(!isLot ? C.pri : C.t3, 12)} Campo
                              </button>
                              <button
                                onClick={() => setImportTypes(prev => ({ ...prev, [i]: "lot" }))}
                                style={{ padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${isLot ? C.acc : C.b1}`, background: isLot ? `${C.acc}15` : C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: isLot ? C.acc : C.t3, transition: "all 0.15s" }}
                              >
                                {Ic.grain(isLot ? C.acc : C.t3, 12)} Lote
                              </button>
                            </div>
                            {/* Field selector for lots */}
                            {isLot && (
                              <select
                                value={importFieldIds[i] || ""}
                                onChange={e => setImportFieldIds(prev => ({ ...prev, [i]: e.target.value }))}
                                style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${importFieldIds[i] ? C.acc : C.err}`, background: C.bgInput, fontFamily: "inherit", fontSize: 12.7, color: C.t1, outline: "none", cursor: "pointer" }}
                              >
                                <option value="">— Seleccioná el campo —</option>
                                {fieldOptions.map(fo => (
                                  <option key={fo.id} value={fo.id}>{fo.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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

        {/* ── Location list ── */}
        {loading ? <Loader /> :
          allLocations.length === 0 && importStep === 0 ? (
            <EmptyState
              icon={Ic.pin(C.t3, 28)}
              title="Sin ubicaciones"
              subtitle="Importá ubicaciones desde Google Maps para empezar"
              action={<Btn sm onClick={() => setImportStep(1)}>Importar</Btn>}
            />
          ) : importStep === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Summary */}
              <div style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12.1, color: C.t2 }}>
                <Bd color={C.pri}>{fields.length} campo{fields.length !== 1 ? "s" : ""}</Bd>
                <Bd color={C.acc}>{allLocations.filter(l => l._type === "lot").length} lote{allLocations.filter(l => l._type === "lot").length !== 1 ? "s" : ""}</Bd>
              </div>

              {fields.map(f => (
                <div key={f.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow: "hidden" }}>
                  {/* Field row */}
                  <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.pri}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {Ic.pin(C.pri, 16)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{f.name}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                        <Bd color={C.pri} small>Campo</Bd>
                        {f.address && <span style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.address}</span>}
                      </div>
                    </div>
                    {f.lat && f.lng && (
                      <span style={{ fontSize: 10, color: C.ok, fontWeight: 600, flexShrink: 0 }}>
                        {Number(f.lat).toFixed(4)}, {Number(f.lng).toFixed(4)}
                      </span>
                    )}
                  </div>

                  {/* Lots under this field */}
                  {(f.lots || []).map(l => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", padding: "8px 14px 8px 28px", gap: 10, borderTop: `1px solid ${C.b2}` }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${C.acc}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {Ic.grain(C.acc, 12)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.2, fontWeight: 600, color: C.t1 }}>{l.name}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
                          <Bd color={C.acc} small>Lote</Bd>
                          {l.hectares && <span style={{ fontSize: 10.5, color: C.t3 }}>{l.hectares} ha</span>}
                        </div>
                      </div>
                      {l.lat && l.lng && (
                        <span style={{ fontSize: 10, color: C.ok, fontWeight: 600, flexShrink: 0 }}>
                          {Number(l.lat).toFixed(4)}, {Number(l.lng).toFixed(4)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
