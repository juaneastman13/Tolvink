import { useState, useEffect, useCallback, useRef } from "react";
import { C, Ic } from "../theme";
import { Btn, Bd, Field, Loader, LoadingOverlay, EmptyState } from "../components";
import { SafeZone, LocationPicker } from "../maps";
import { apiGetFields, apiCreateField, apiUpdateField, apiCreateLot, apiUpdateLot, apiGetFieldLots, apiImportParseLinks, apiImportConfirm } from "../api";
import log from "../logger";

export default function FieldsScreen({ onBack, embedded, goToMap }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [fieldAddr, setFieldAddr] = useState("");
  const [fieldLoc, setFieldLoc] = useState(null);
  const [showLotForm, setShowLotForm] = useState(null);
  const [lotName, setLotName] = useState("");
  const [lotHa, setLotHa] = useState("");
  const [lotLoc, setLotLoc] = useState(null);
  const [expandedField, setExpandedField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");
  // Edit states
  const [editField, setEditField] = useState(null); // field id being edited
  const [editFieldAddr, setEditFieldAddr] = useState("");
  const [editFieldLoc, setEditFieldLoc] = useState(null);
  const [editLot, setEditLot] = useState(null); // {fieldId, lotId}
  const [editLotHa, setEditLotHa] = useState("");
  const [editLotLoc, setEditLotLoc] = useState(null);
  // Import flow
  const [importStep, setImportStep] = useState(0); // 0=hidden, 1=upload, 2=preview, 3=done
  const [importParsed, setImportParsed] = useState([]);
  const [importDiscarded, setImportDiscarded] = useState(0);
  const [importSelected, setImportSelected] = useState(new Set());
  const [importNames, setImportNames] = useState({}); // id→edited name
  const [importText, setImportText] = useState(""); // pasted links text

  const load = useCallback(async () => {
    try { const f = await apiGetFields(); setFields(f || []); } catch(e) { setMsg({t:e.message||"Error al cargar campos",k:"err"}); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreateField = async () => {
    if (!fieldName.trim()) { setMsg({ t: "Nombre obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateField({
        name: fieldName.trim(),
        address: fieldLoc?.address || fieldAddr.trim() || undefined,
        lat: fieldLoc?.lat || undefined,
        lng: fieldLoc?.lng || undefined,
      });
      setFieldName(""); setFieldAddr(""); setFieldLoc(null); setShowFieldForm(false); setSaving(false); setDoneMsg("Campo creado"); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const handleCreateLot = async (fieldId) => {
    if (!lotName.trim()) { setMsg({ t: "Nombre del lote obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateLot(fieldId, {
        name: lotName.trim(),
        hectares: lotHa ? parseFloat(lotHa) : undefined,
        lat: lotLoc?.lat || undefined,
        lng: lotLoc?.lng || undefined,
      });
      setLotName(""); setLotHa(""); setLotLoc(null); setShowLotForm(null); setSaving(false); setDoneMsg("Lote creado"); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const startEditField = (f) => {
    setEditField(f.id);
    setEditFieldAddr(f.address || "");
    const lat = f.lat != null ? Number(f.lat) : null;
    const lng = f.lng != null ? Number(f.lng) : null;
    setEditFieldLoc(lat && lng ? { lat, lng, address: f.address || "" } : null);
  };

  const handleUpdateField = async (fieldId) => {
    setSaving(true);
    try {
      await apiUpdateField(fieldId, {
        address: editFieldLoc?.address || editFieldAddr.trim() || undefined,
        lat: editFieldLoc?.lat || undefined,
        lng: editFieldLoc?.lng || undefined,
      });
      setEditField(null); setSaving(false); setDoneMsg("Campo actualizado"); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const startEditLot = (fieldId, l) => {
    try {
      setEditLot({ fieldId, lotId: l.id });
      setEditLotHa(l.hectares != null ? String(Number(l.hectares)) : "");
      const lat = l.lat != null ? Number(l.lat) : null;
      const lng = l.lng != null ? Number(l.lng) : null;
      setEditLotLoc(lat && lng ? { lat, lng } : null);
    } catch (e) {
      log.error("Fields", "startEditLot error", e);
      setEditLot({ fieldId, lotId: l.id });
      setEditLotHa("");
      setEditLotLoc(null);
    }
  };

  const handleUpdateLot = async () => {
    if (!editLot) return;
    setSaving(true);
    try {
      await apiUpdateLot(editLot.fieldId, editLot.lotId, {
        hectares: editLotHa ? parseFloat(editLotHa) : undefined,
        lat: editLotLoc?.lat || undefined,
        lng: editLotLoc?.lng || undefined,
      });
      setEditLot(null); setSaving(false); setDoneMsg("Lote actualizado"); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const handleImportLinks = async () => {
    if (!importText.trim()) { setMsg({ t: "Pegá al menos un link de Google Maps", k: "err" }); return; }
    setSaving(true);
    try {
      const result = await apiImportParseLinks(importText);
      setImportParsed(result.parsed || []);
      setImportDiscarded(result.discarded || 0);
      const sel = new Set(result.parsed.map((_, i) => i));
      setImportSelected(sel);
      setImportNames({});
      setImportStep(2);
    } catch (err) { setMsg({ t: err.message || "Error al procesar links", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleImportConfirm = async () => {
    const locations = importParsed
      .filter((_, i) => importSelected.has(i))
      .map((loc, i) => ({
        name: (importNames[i] || loc.name).trim().slice(0, 255),
        address: loc.address || undefined,
        lat: loc.lat,
        lng: loc.lng,
      }));
    if (locations.length === 0) { setMsg({ t: "Seleccioná al menos una ubicación", k: "err" }); return; }
    setSaving(true);
    try {
      const result = await apiImportConfirm(locations);
      setImportStep(0); setImportParsed([]); setSaving(false);
      const errMsg = result.errors?.length ? ` (${result.errors.length} omitidos)` : "";
      setDoneMsg(`${result.created} campo${result.created !== 1 ? "s" : ""} importado${result.created !== 1 ? "s" : ""}${errMsg}`);
      load();
    } catch (err) { setMsg({ t: err.message, k: "err" }); setSaving(false); }
  };

  const toggleImportItem = (i) => {
    setImportSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const closeImport = () => { setImportStep(0); setImportParsed([]); setImportText(""); };

  const selectedCount = [...importSelected].length;

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:undefined }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      {!embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Menú</button></div>}
      <div style={{ padding: embedded?0:"0 18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Mis Campos</div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn sm v="ghost" onClick={() => { setImportStep(importStep ? 0 : 1); setShowFieldForm(false); }} icon={Ic.pin(importStep ? C.pri : C.t2, 14)}>{importStep ? "Cerrar" : "Importar"}</Btn>
          <Btn sm onClick={() => { setShowFieldForm(!showFieldForm); if (importStep) setImportStep(0); }} icon={showFieldForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showFieldForm ? "Cerrar" : "Agregar"}</Btn>
        </div>
      </div>

      {/* ── Import from Google Maps links ── */}
      {importStep === 1 && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ fontSize: 15.4, fontWeight: 700, marginBottom: 8 }}>{Ic.pin(C.pri, 16)} Importar desde Google Maps</div>
          <div style={{ fontSize: 12.7, color: C.t2, lineHeight: 1.5, marginBottom: 12 }}>
            En Google Maps, abrí cada ubicación guardada y tocá <strong>"Compartir"</strong>. Pegá todos los links acá (uno por línea).
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={"Toma agua · Juan Eastman\nhttps://maps.app.goo.gl/qTNPZX2...\n\nOtro lugar\nhttps://maps.app.goo.gl/abc123..."}
            style={{ width: "100%", minHeight: 120, padding: 12, borderRadius: 10, border: `1.5px solid ${importText ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
          />
          <div style={{ marginTop: 10 }}>
            <Btn full v="acc" disabled={saving || !importText.trim()} onClick={handleImportLinks}>
              {saving ? "Procesando links..." : "Procesar links"}
            </Btn>
          </div>
        </div>
      )}

      {importStep === 2 && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 15.4, fontWeight: 700 }}>{Ic.pin(C.pri, 16)} Ubicaciones encontradas</div>
            <button onClick={closeImport} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 16)}</button>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 12.7, color: C.t2 }}>
            <span style={{ fontWeight: 600, color: C.ok }}>{importParsed.length} encontradas</span>
            {importDiscarded > 0 && <span style={{ color: C.t3 }}>{importDiscarded} descartadas (sin coordenadas)</span>}
          </div>
          {importParsed.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13.2 }}>No se encontraron ubicaciones válidas en el archivo</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => setImportSelected(new Set(importParsed.map((_, i) => i)))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.pri, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Seleccionar todas</button>
                <span style={{ color: C.t3 }}>·</span>
                <button onClick={() => setImportSelected(new Set())} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.t3, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Ninguna</button>
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {importParsed.map((loc, i) => (
                  <div key={i} onClick={() => toggleImportItem(i)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${importSelected.has(i) ? C.pri : C.b1}`, background: importSelected.has(i) ? `${C.pri}06` : C.bg, cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${importSelected.has(i) ? C.pri : C.b1}`, background: importSelected.has(i) ? C.pri : C.w, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      {importSelected.has(i) && Ic.chk(C.w, 12)}
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
                        {loc.countryCode && <span style={{ marginLeft: 6, color: C.t3, fontWeight: 500 }}>{loc.countryCode}</span>}
                      </div>
                    </div>
                  </div>
                ))}
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

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.2, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {showFieldForm && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <Field label="Nombre del campo" value={fieldName} onChange={setFieldName} placeholder="Ej: Campo San Juan" />
          <div style={{ height: 10 }} />
          <SafeZone><LocationPicker label="Ubicación del campo" value={fieldLoc} onChange={setFieldLoc} /></SafeZone>
          <div style={{ height: 12 }} />
          <Btn full v="acc" disabled={saving} onClick={handleCreateField}>{saving ? "Guardando..." : "Crear campo"}</Btn>
        </div>
      )}

      {loading ? <Loader/> :
        fields.length === 0 ? <EmptyState icon={Ic.pin(C.t3,28)} title="Sin campos registrados" subtitle="Agregá tu primer campo para poder solicitar fletes" action={<Btn sm onClick={()=>setShowFieldForm(true)}>Agregar campo</Btn>}/> :
          (() => {
            // Group fields by company
            const companyMap = new Map();
            for (const f of fields) {
              const cId = f.company?.id || f.companyId || "_";
              if (!companyMap.has(cId)) companyMap.set(cId, { name: f.company?.name || "Mi empresa", fields: [] });
              companyMap.get(cId).fields.push(f);
            }
            const companies = Array.from(companyMap.entries());
            const multiCompany = companies.length > 1;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: multiCompany ? 20 : 12 }}>
                {companies.map(([cId, group]) => (
                  <div key={cId}>
                    {multiCompany && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        {Ic.user(C.sec,16)}
                        <span style={{ fontSize:15.4, fontWeight:800, color:C.t1 }}>{group.name}</span>
                        <span style={{ fontSize:11, color:C.t3 }}>{group.fields.length} campo{group.fields.length!==1?"s":""}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {group.fields.map(f => (
              <div key={f.id} style={{ background: C.w, border: `1px solid ${expandedField === f.id ? C.pri : C.b1}`, borderLeft: `3px solid ${C.pri}`, borderRadius: 12, boxShadow: C.sh, overflow: "hidden" }}>
                <div onClick={() => setExpandedField(expandedField === f.id ? null : f.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {Ic.pin(C.pri, 18)}
                    <div>
                      <div style={{ fontSize: 15.4, fontWeight: 700 }}>{f.name}{f.lat&&f.lng&&goToMap&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.lat,f.lng,f.name);}} style={{cursor:"pointer",opacity:0.6,marginLeft:4,fontSize:11}} title="Ver en mapa">📍</span>}</div>
                      {f.address && <div style={{ fontSize: 12.1, color: C.t3 }}>{f.address}</div>}
                      {f.lat && <div style={{ fontSize: 10.5, color: C.ok, fontWeight: 600 }}>📍 Ubicación cargada</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button aria-label="Editar campo" onClick={(e) => { e.stopPropagation(); editField === f.id ? setEditField(null) : startEditField(f); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.edit(editField === f.id ? C.pri : C.t3, 16)}</button>
                    <Bd color={C.pri} small>{(f.lots || []).length} lote{(f.lots || []).length !== 1 ? "s" : ""}</Bd>
                    <span style={{ display: "flex", transition: "transform 0.2s", transform: expandedField === f.id ? "rotate(-90deg)" : "rotate(0deg)", marginLeft: 2 }}>{Ic.chev(C.t3, 16)}</span>
                  </div>
                </div>

                {/* Edit field form */}
                {editField === f.id && (
                  <div style={{ background: C.priPale, borderRadius: 10, padding: 12, margin: "0 14px 8px" }}>
                    <div style={{ fontSize: 12.1, fontWeight: 700, color: C.pri, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar campo</div>
                    <SafeZone><LocationPicker label="Ubicación" value={editFieldLoc} onChange={setEditFieldLoc} /></SafeZone>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <Btn sm v="ghost" onClick={() => setEditField(null)}>Cancelar</Btn>
                      <Btn sm disabled={saving} onClick={() => handleUpdateField(f.id)}>{saving ? "..." : "Guardar"}</Btn>
                    </div>
                  </div>
                )}

                {expandedField === f.id && (f.lots || []).map(l => (
                  <div key={l.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px 6px 28px", borderTop: `1px solid ${C.b2}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {Ic.grain(C.ok, 14)}
                        <span style={{ fontSize: 13.2, fontWeight: 500 }}>{l.name}</span>
                        {l.hectares && <span style={{ fontSize: 11, color: C.t3 }}>{l.hectares} ha</span>}
                        {l.lat&&l.lng&&goToMap?<span onClick={(e)=>{e.stopPropagation();goToMap(l.lat,l.lng,f.name+" — "+l.name);}} style={{cursor:"pointer",opacity:0.6,fontSize:11}} title="Ver en mapa">📍</span>:l.lat&&<span style={{ fontSize: 9.9, color: C.ok }}>📍</span>}
                      </div>
                      <button aria-label="Editar lote" onClick={() => editLot?.lotId === l.id ? setEditLot(null) : startEditLot(f.id, l)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.edit(editLot?.lotId === l.id ? C.pri : C.t3, 14)}</button>
                    </div>
                    {/* Edit lot form */}
                    {editLot?.lotId === l.id && (
                      <div style={{ background: C.accPale, borderRadius: 10, padding: 12, marginLeft: 28, marginBottom: 6 }}>
                        <div style={{ fontSize: 12.1, fontWeight: 700, color: C.acc, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar lote</div>
                        <Field label="Hectáreas" value={editLotHa} onChange={setEditLotHa} placeholder="Ej: 150" />
                        <div style={{ height: 8 }} />
                        <SafeZone><LocationPicker label="Ubicación del lote" value={editLotLoc} onChange={setEditLotLoc} defaultCenter={f.lat&&f.lng?{lat:f.lat,lng:f.lng}:null} /></SafeZone>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <Btn sm v="ghost" onClick={() => setEditLot(null)}>Cancelar</Btn>
                          <Btn sm v="acc" disabled={saving} onClick={handleUpdateLot}>{saving ? "..." : "Guardar"}</Btn>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {expandedField === f.id && (showLotForm === f.id ? (
                  <div style={{ marginTop: 8, padding: "10px 14px 14px", borderTop: `1px solid ${C.b2}` }}>
                    <Field label="Nombre del lote" value={lotName} onChange={setLotName} placeholder="Ej: Lote 1A" />
                    <div style={{ height: 8 }} />
                    <Field label="Hectáreas (opcional)" value={lotHa} onChange={setLotHa} placeholder="Ej: 150" />
                    <div style={{ height: 8 }} />
                    <SafeZone><LocationPicker label="Ubicación del lote" value={lotLoc} onChange={setLotLoc} defaultCenter={f.lat&&f.lng?{lat:f.lat,lng:f.lng}:null} /></SafeZone>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <Btn sm v="ghost" onClick={() => { setShowLotForm(null); setLotName(""); setLotHa(""); setLotLoc(null); }}>Cancelar</Btn>
                      <Btn sm v="acc" disabled={saving} onClick={() => handleCreateLot(f.id)}>{saving ? "..." : "Crear lote"}</Btn>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowLotForm(f.id)} style={{ margin: "8px 14px 14px 28px", background: `${C.acc}10`, border: `1px solid ${C.acc}40`, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, color: C.acc, padding: "10px 16px", minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>{Ic.plus(C.acc, 14)} Agregar lote</button>
                ))}
              </div>
            ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
      }
      </div>
    </div>
  );
}
