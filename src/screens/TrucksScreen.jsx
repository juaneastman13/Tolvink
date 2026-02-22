import { useState, useCallback, useEffect } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, Loader, LoadingOverlay } from "../components";
import { apiGetTrucks, apiCreateTruck, apiDeactivateTruck, apiListDrivers, apiCreateDriver, apiDeactivateDriver } from "../api";

export default function TrucksScreen({ onBack, embedded, user }) {
  const canEdit = !user || user.role==="admin" || user.role==="platform_admin";
  const [tab, setTab] = useState("trucks"); // "trucks" | "drivers"
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");

  const loadTrucks = useCallback(async () => {
    try { const t = await apiGetTrucks(); setTrucks(t||[]); } catch(e) { setMsg({t:e.message||"Error al cargar flota",k:"err"}); } finally { setLoading(false); }
  }, []);
  const loadDrivers = useCallback(async () => {
    try { const d = await apiListDrivers(); setDrivers(d||[]); } catch(e) { setMsg({t:e.message||"Error al cargar choferes",k:"err"}); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if(tab==="trucks") loadTrucks(); else loadDrivers(); }, [tab, loadTrucks, loadDrivers]);

  const handleCreateTruck = async () => {
    if (!plate.trim()) { setMsg({ t: "Patente obligatoria", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateTruck({ plate: plate.trim().toUpperCase(), model: model.trim() || undefined });
      setPlate(""); setModel(""); setShowForm(false); setSaving(false); setDoneMsg("Camión registrado");
      loadTrucks();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const handleDeactivateTruck = async (id) => {
    if(saving||doneMsg) return;
    setSaving(true);
    try { await apiDeactivateTruck(id); setSaving(false); setDoneMsg("Camión eliminado"); loadTrucks(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const handleCreateDriver = async () => {
    if (!dName.trim()) { setMsg({ t: "Nombre obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateDriver({ name: dName.trim(), phone: dPhone.trim() || undefined });
      setDName(""); setDPhone(""); setShowForm(false); setSaving(false); setDoneMsg("Chofer registrado");
      loadDrivers();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const handleDeactivateDriver = async (id) => {
    if(saving||doneMsg) return;
    setSaving(true);
    try { await apiDeactivateDriver(id); setSaving(false); setDoneMsg("Chofer eliminado"); loadDrivers(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const switchTab = (t) => { setTab(t); setShowForm(false); setMsg(null); setLoading(true); };

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:undefined }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      {!embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Menú</button></div>}
      <div style={{ padding: embedded?0:"0 18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Mi Flota</div>
        {canEdit && <Btn sm onClick={() => { setShowForm(!showForm); setMsg(null); }} icon={showForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showForm ? "Cerrar" : "Agregar"}</Btn>}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:16, borderRadius:10, overflow:"hidden", border:`1.5px solid ${C.b1}` }}>
        <button onClick={()=>switchTab("trucks")} style={{ flex:1, padding:"9px 0", fontFamily:"inherit", fontSize:12.5, fontWeight:tab==="trucks"?700:500, background:tab==="trucks"?C.acc:C.w, color:tab==="trucks"?C.w:C.t2, border:"none", cursor:"pointer" }}>Vehículos</button>
        <button onClick={()=>switchTab("drivers")} style={{ flex:1, padding:"9px 0", fontFamily:"inherit", fontSize:12.5, fontWeight:tab==="drivers"?700:500, background:tab==="drivers"?C.acc:C.w, color:tab==="drivers"?C.w:C.t2, border:"none", cursor:"pointer", borderLeft:`1px solid ${C.b1}` }}>Choferes</button>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {/* ========== TRUCKS TAB ========== */}
      {tab === "trucks" && <>
        {showForm && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
            <Field label="Patente" value={plate} onChange={setPlate} placeholder="Ej: AB-123-CD" />
            <div style={{ height: 10 }} />
            <Field label="Modelo (opcional)" value={model} onChange={setModel} placeholder="Ej: Scania R500" />
            <div style={{ height: 12 }} />
            <Btn full v="acc" disabled={saving} onClick={handleCreateTruck}>{saving ? "Guardando..." : "Registrar camión"}</Btn>
          </div>
        )}
        {loading ? <Loader/> :
          trucks.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: C.t3, fontSize: 13 }}>No tenés vehículos registrados.</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trucks.map(t => (
                <div key={t.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${C.acc}`, borderRadius: 12, padding: 14, boxShadow: C.sh, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {Ic.truck(C.acc, 20)}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{t.plate}</div>
                      {t.model && <div style={{ fontSize: 11, color: C.t3 }}>{t.model}</div>}
                      {t.assignedUser && <div style={{ fontSize: 10, color: C.t2 }}>Chofer: {t.assignedUser.name}</div>}
                    </div>
                  </div>
                  {canEdit && <button disabled={saving} onClick={() => handleDeactivateTruck(t.id)} style={{ background: "none", border: "none", cursor: saving?"not-allowed":"pointer", padding: 6, opacity:saving?0.4:1 }}>{Ic.ban(C.err, 18)}</button>}
                </div>
              ))}
            </div>
        }
      </>}

      {/* ========== DRIVERS TAB ========== */}
      {tab === "drivers" && <>
        {showForm && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
            <Field label="Nombre" value={dName} onChange={setDName} placeholder="Ej: Juan Pérez" />
            <div style={{ height: 10 }} />
            <Field label="Teléfono (opcional)" value={dPhone} onChange={setDPhone} placeholder="Ej: 099123456" />
            <div style={{ height: 12 }} />
            <Btn full v="acc" disabled={saving} onClick={handleCreateDriver}>{saving ? "Guardando..." : "Registrar chofer"}</Btn>
          </div>
        )}
        {loading ? <Loader/> :
          drivers.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: C.t3, fontSize: 13 }}>No tenés choferes registrados.</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {drivers.map(d => (
                <div key={d.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${C.info||C.sec}`, borderRadius: 12, padding: 14, boxShadow: C.sh, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {Ic.user(C.info||C.sec, 20)}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{d.name}</div>
                      {d.phone && <div style={{ fontSize: 11, color: C.t3 }}>{d.phone}</div>}
                    </div>
                  </div>
                  {canEdit && <button disabled={saving} onClick={() => handleDeactivateDriver(d.id)} style={{ background: "none", border: "none", cursor: saving?"not-allowed":"pointer", padding: 6, opacity:saving?0.4:1 }}>{Ic.ban(C.err, 18)}</button>}
                </div>
              ))}
            </div>
        }
      </>}
      </div>
    </div>
  );
}
