import { useState, useEffect, useCallback, useRef } from "react";
import { C, Ic } from "../theme";
import { Btn, Bd, Field, Loader, LoadingOverlay, EmptyState } from "../components";
import { SafeZone, LocationPicker } from "../maps";
import { apiGetFields, apiCreateField, apiUpdateField, apiCreateLot, apiUpdateLot, apiGetFieldLots } from "../api";
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

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:undefined }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      {!embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Menú</button></div>}
      <div style={{ padding: embedded?0:"0 18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Mis Campos</div>
        <Btn sm onClick={() => setShowFieldForm(!showFieldForm)} icon={showFieldForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showFieldForm ? "Cerrar" : "Agregar"}</Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

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
                        <span style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{group.name}</span>
                        <span style={{ fontSize:10, color:C.t3 }}>{group.fields.length} campo{group.fields.length!==1?"s":""}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {group.fields.map(f => (
              <div key={f.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${C.pri}`, borderRadius: 12, padding: 14, boxShadow: C.sh }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {Ic.pin(C.pri, 18)}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{f.name}{f.lat&&f.lng&&goToMap&&<span onClick={(e)=>{e.stopPropagation();goToMap(f.lat,f.lng,f.name);}} style={{cursor:"pointer",opacity:0.6,marginLeft:4,fontSize:10}} title="Ver en mapa">📍</span>}</div>
                      {f.address && <div style={{ fontSize: 11, color: C.t3 }}>{f.address}</div>}
                      {f.lat && <div style={{ fontSize: 9.5, color: C.ok, fontWeight: 600 }}>📍 Ubicación cargada</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => editField === f.id ? setEditField(null) : startEditField(f)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.edit(editField === f.id ? C.pri : C.t3, 16)}</button>
                    <Bd color={C.pri} small>{(f.lots || []).length} lote{(f.lots || []).length !== 1 ? "s" : ""}</Bd>
                  </div>
                </div>

                {/* Edit field form */}
                {editField === f.id && (
                  <div style={{ background: C.priPale, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar campo</div>
                    <SafeZone><LocationPicker label="Ubicación" value={editFieldLoc} onChange={setEditFieldLoc} /></SafeZone>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <Btn sm v="ghost" onClick={() => setEditField(null)}>Cancelar</Btn>
                      <Btn sm disabled={saving} onClick={() => handleUpdateField(f.id)}>{saving ? "..." : "Guardar"}</Btn>
                    </div>
                  </div>
                )}

                {(f.lots || []).map(l => (
                  <div key={l.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0 6px 28px", borderTop: `1px solid ${C.b2}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {Ic.grain(C.ok, 14)}
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</span>
                        {l.hectares && <span style={{ fontSize: 10, color: C.t3 }}>{l.hectares} ha</span>}
                        {l.lat&&l.lng&&goToMap?<span onClick={(e)=>{e.stopPropagation();goToMap(l.lat,l.lng,f.name+" — "+l.name);}} style={{cursor:"pointer",opacity:0.6,fontSize:10}} title="Ver en mapa">📍</span>:l.lat&&<span style={{ fontSize: 9, color: C.ok }}>📍</span>}
                      </div>
                      <button onClick={() => editLot?.lotId === l.id ? setEditLot(null) : startEditLot(f.id, l)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.edit(editLot?.lotId === l.id ? C.pri : C.t3, 14)}</button>
                    </div>
                    {/* Edit lot form */}
                    {editLot?.lotId === l.id && (
                      <div style={{ background: C.accPale, borderRadius: 10, padding: 12, marginLeft: 28, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.acc, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar lote</div>
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

                {showLotForm === f.id ? (
                  <div style={{ marginTop: 8, padding: "10px 0 0 28px", borderTop: `1px solid ${C.b2}` }}>
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
                  <button onClick={() => setShowLotForm(f.id)} style={{ marginTop: 6, marginLeft: 28, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: C.acc, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.plus(C.acc, 12)} Agregar lote</button>
                )}
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
