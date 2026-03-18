import { useState, useEffect, useCallback } from "react";
import { C, Ic } from "../theme";
import { Field, ModalOverlay } from "../components";
import { apiGetTrucks, apiCreateTruck, apiGetDrivers, apiCreateDriver } from "../api";

// ======================== STEPPER (compact) ==============================
function Stepper({ steps, current }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:0, marginBottom:12, padding:"0 4px" }}>
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background: done || active ? C.pri : C.b1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {done ? Ic.chk(C.tOn, 12) : <span style={{ fontSize:11, fontWeight:500, color: active ? C.tOn : C.t3 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize:10, fontWeight:600, color: active || done ? C.pri : C.t3, whiteSpace:"nowrap" }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex:1, height:2, background: done ? C.pri : C.b1, margin:"0 4px", marginBottom:16 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ======================== TRUCK ROW (2-line) ==============================
function TruckRow({ tk, selected, onClick }) {
  const cap = tk.capacity ? `${tk.capacity} tn` : null;
  const busy = tk.activeTripStatus === "in_progress" || tk.activeTripStatus === "loaded";
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"8px 10px", borderRadius:8, textAlign:"left", fontFamily:"inherit",
      border: selected ? `1.5px solid ${C.pri}` : `1px solid ${C.b1}`,
      background: selected ? C.okPale : C.bgCard,
      cursor:"pointer", marginBottom:4, display:"block",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:4, minWidth:0 }}>
          <span style={{ fontSize:13, fontWeight:500, color:C.t1 }}>{tk.plate}</span>
          {tk.model && <span style={{ fontSize:12, color:C.t2 }}>· {tk.model}</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
          {cap && <span style={{ fontSize:12, color:C.t2 }}>{cap}</span>}
          {busy && <span style={{ fontSize:10, fontWeight:700, color:C.acc, background:C.accPale, padding:"1px 5px", borderRadius:4 }}>En viaje</span>}
        </div>
      </div>
      {tk.assignedUser && (
        <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
          {Ic.user(C.t3, 11)}
          <span style={{ fontSize:11, color:C.t3 }}>{tk.assignedUser.name}</span>
        </div>
      )}
    </button>
  );
}

// ======================== DRIVER ROW (2-line) =============================
function DriverRow({ d, selected, onClick, isMe }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"8px 10px", borderRadius:8, textAlign:"left", fontFamily:"inherit",
      border: selected ? `1.5px solid ${C.pri}` : `1px solid ${C.b1}`,
      background: selected ? C.okPale : C.bgCard,
      cursor:"pointer", marginBottom:4, display:"block",
    }}>
      <div style={{ fontSize:13, fontWeight:500, color:C.t1 }}>{d.name}{isMe ? " (yo)" : ""}</div>
      {d.phone && <div style={{ fontSize:11, color:C.t3, marginTop:1 }}>{d.phone}</div>}
      {!isMe && d.activeFreights?.length > 0 && <div style={{ fontSize:10, color:C.info, marginTop:1 }}>{d.activeFreights.length} flete{d.activeFreights.length > 1 ? "s" : ""} activo{d.activeFreights.length > 1 ? "s" : ""}</div>}
    </button>
  );
}

// ======================== CREATE BUTTON ==================================
function CreateBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"7px 10px", borderRadius:8, textAlign:"center", fontFamily:"inherit",
      border:`1.5px dashed ${C.pri}`, background:"transparent", color:C.pri,
      fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center",
      justifyContent:"center", gap:4, marginBottom:4,
    }}>
      {Ic.plus(C.pri, 12)} {label}
    </button>
  );
}

// ======================== NAV BUTTONS ====================================
const btnPrev = { background:"transparent", border:`1px solid ${C.b1}`, color:C.t2, borderRadius:8, padding:"8px 16px", fontSize:13, fontFamily:"inherit", cursor:"pointer" };
const btnNext = (on) => ({ background: on ? C.pri : C.b1, color: on ? C.tOn : C.t3, borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:500, border:"none", cursor: on ? "pointer" : "default", fontFamily:"inherit" });

// ======================== MAIN MODAL =====================================
export default function AssignModal({ freight, transporters, user, onClose, onConfirm, onAssignMulti }) {
  const multiTruck = (freight.truckCount || 1) > 1;
  const [step, setStep] = useState(0);
  const [truckList, setTruckList] = useState([]);
  const [mode, setMode] = useState(() => freight.useOwnFleet === true ? "own" : "company");
  const [t, setT] = useState("");
  const [truckId, setTruckId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingTrucks, setLoadingTrucks] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingText, setClosingText] = useState("");

  const [showNewTruck, setShowNewTruck] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [savingTruck, setSavingTruck] = useState(false);
  const [truckErr, setTruckErr] = useState("");

  const [showNewDriver, setShowNewDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverErr, setDriverErr] = useState("");

  const [tonsInput, setTonsInput] = useState("");
  const ts = transporters || [];

  const alreadyAssigned = freight.assignedTruckCount || 0;
  const needed = (freight.truckCount || 1) - alreadyAssigned;
  const totalTons = freight.tons || 0;

  const hasOwnFleet = !!freight.originHasOwnFleet || !!freight.destHasOwnFleet || !!user?.hasInternalFleet;
  const ownFleetCompanyId = (user?.hasInternalFleet && !freight.destHasOwnFleet && !freight.originHasOwnFleet)
    ? (user.activeCompanyId || user.companyId)
    : freight.destHasOwnFleet ? freight.destCompanyId : freight.originCompanyId;
  const forceMode = freight.useOwnFleet === true ? "own" : null;

  const selTruck = truckId ? trucks.find(x => x.id === truckId) : null;
  const selDriver = driverId ? (driverId === user?.id ? { name: user.name, _isMe: true } : drivers.find(x => x.id === driverId)) : null;

  const truckCapacity = selTruck?.capacity ? parseFloat(selTruck.capacity) : null;
  const assignedTons = truckList.reduce((s, e) => s + (e.tons || 0), 0);
  const remainingTons = Math.max(0, totalTons - assignedTons);
  const defaultTons = truckCapacity ? Math.min(truckCapacity, remainingTons || totalTons) : (remainingTons || totalTons);

  useEffect(() => {
    if (step === 2 && !tonsInput) setTonsInput(defaultTons > 0 ? String(Math.round(defaultTons * 10) / 10) : "");
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrucks = useCallback((compId) => {
    const cid = compId || (mode === "own" ? ownFleetCompanyId : t);
    if (!cid) return;
    setLoadingTrucks(true);
    apiGetTrucks(cid).then(r => setTrucks((r || []).filter(t => t.active !== false))).catch(() => setTrucks([])).finally(() => setLoadingTrucks(false));
  }, [mode, ownFleetCompanyId, t]);

  const loadDriversFn = useCallback((compId) => {
    const cid = compId || (mode === "own" ? ownFleetCompanyId : t);
    if (!cid) return;
    setLoadingDrivers(true);
    apiGetDrivers(cid).then(r => setDrivers(r || [])).catch(() => setDrivers([])).finally(() => setLoadingDrivers(false));
  }, [mode, ownFleetCompanyId, t]);

  useEffect(() => { if (mode === "own") { loadTrucks(ownFleetCompanyId); loadDriversFn(ownFleetCompanyId); } }, [mode, ownFleetCompanyId, loadTrucks, loadDriversFn]);
  useEffect(() => { if (mode === "company" && t) { loadTrucks(t); loadDriversFn(t); } }, [mode, t, loadTrucks, loadDriversFn]);

  useEffect(() => {
    if (truckId) {
      const tk = trucks.find(x => x.id === truckId);
      if (tk?.assignedUser?.id) { const d = drivers.find(x => x.id === tk.assignedUser.id); if (d) setDriverId(tk.assignedUser.id); }
    }
  }, [truckId, trucks, drivers]);

  const handleCreateTruck = async () => {
    if (savingTruck) return;
    const plate = newPlate.trim().toUpperCase();
    if (!plate) { setTruckErr("Patente obligatoria"); return; }
    if (!newBrand.trim()) { setTruckErr("Marca obligatoria"); return; }
    if (!newModel.trim()) { setTruckErr("Modelo obligatorio"); return; }
    setSavingTruck(true); setTruckErr("");
    try {
      const model = `${newBrand.trim()} ${newModel.trim()}`.trim();
      const created = await apiCreateTruck({ plate, model });
      setNewPlate(""); setNewBrand(""); setNewModel(""); setNewCapacity(""); setShowNewTruck(false);
      loadTrucks();
      if (created?.id) setTruckId(created.id);
    } catch (e) { setTruckErr(e.message || "Error al crear"); }
    finally { setSavingTruck(false); }
  };

  const handleCreateDriver = async () => {
    if (savingDriver) return;
    const name = newDriverName.trim();
    if (!name) { setDriverErr("Nombre obligatorio"); return; }
    setSavingDriver(true); setDriverErr("");
    try {
      const created = await apiCreateDriver({ name, phone: newDriverPhone.trim() || undefined });
      setNewDriverName(""); setNewDriverPhone(""); setShowNewDriver(false);
      loadDriversFn();
      if (created?.id) setDriverId(created.id);
    } catch (e) { setDriverErr(e.message || "Error al crear"); }
    finally { setSavingDriver(false); }
  };

  const doConfirm = async () => {
    if (loading || closing) return;
    const tons = parseFloat(tonsInput) || undefined;
    setLoading(true);
    if (multiTruck) {
      const compId = mode === "own" ? ownFleetCompanyId : t;
      const all = [...truckList, { transportCompanyId: compId, truckId: truckId || undefined, driverId: driverId || undefined, tons }];
      const msg = await onAssignMulti(all.map(e => ({ transportCompanyId: e.transportCompanyId, truckId: e.truckId, driverId: e.driverId, tons: e.tons })));
      setLoading(false);
      if (msg) { setClosingText(msg); setClosing(true); }
    } else {
      const compId = mode === "own" ? ownFleetCompanyId : t;
      const msg = await onConfirm(compId, truckId || undefined, driverId || undefined);
      setLoading(false);
      if (msg) { setClosingText(msg); setClosing(true); }
    }
  };

  const addAndContinue = () => {
    const compId = mode === "own" ? ownFleetCompanyId : t;
    const tons = parseFloat(tonsInput) || undefined;
    const selTruckObj = trucks.find(x => x.id === truckId);
    const selDriverObj2 = driverId === user?.id ? { name: user.name } : drivers.find(x => x.id === driverId);
    setTruckList(prev => [...prev, { transportCompanyId: compId, truckId: truckId || undefined, driverId: driverId || undefined, tons, _plate: selTruckObj?.plate || "", _model: selTruckObj?.model || "", _driverName: selDriverObj2?.name || "" }]);
    setTruckId(""); setDriverId(""); setTonsInput(""); setStep(0);
  };

  const removeFromList = (idx) => setTruckList(prev => prev.filter((_, i) => i !== idx));

  const hasDirtyData = !!(t || truckId || driverId || truckList.length > 0 || showNewTruck || showNewDriver);
  const safeClose = () => { if (hasDirtyData && !loading && !closing && !window.confirm("¿Descartar los cambios sin guardar?")) return; onClose(); };

  const needsTransporter = mode === "company" && !t;
  const externalTs = ts.filter(x => x.id !== freight.originCompanyId);
  const remainingSlots = multiTruck ? Math.max(0, needed - truckList.length) : 1;
  const stepLabels = ["Vehículo", "Chofer", "Toneladas"];

  // ======================== RENDER =======================================
  return (
    <ModalOverlay onClose={safeClose} loading={loading} closing={closing} closingText={closingText} maxWidth={560}>

        {/* Title */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.t1 }}>Asignar transporte</div>
          <button onClick={safeClose} aria-label="Cerrar" style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>{Ic.cross(C.t3, 16)}</button>
        </div>

        {/* Mode toggle */}
        {hasOwnFleet && !forceMode && (
          <div style={{ display:"flex", gap:0, marginBottom:12, borderRadius:8, overflow:"hidden", border:`1.5px solid ${C.b1}` }}>
            <button onClick={() => { setMode("company"); setTruckId(""); setDriverId(""); setStep(0); setT(""); }} style={{ flex:1, padding:"8px 0", fontFamily:"inherit", fontSize:13, fontWeight:mode === "company" ? 700 : 500, background:mode === "company" ? C.pri : C.w, color:mode === "company" ? C.w : C.t2, border:"none", cursor:"pointer" }}>Empresa</button>
            <button onClick={() => { setMode("own"); setT(""); setStep(0); }} style={{ flex:1, padding:"8px 0", fontFamily:"inherit", fontSize:13, fontWeight:mode === "own" ? 700 : 500, background:mode === "own" ? C.acc : C.w, color:mode === "own" ? C.w : C.t2, border:"none", cursor:"pointer", borderLeft:`1px solid ${C.b1}` }}>Flota propia</button>
          </div>
        )}
        {forceMode === "own" && <div style={{ padding:"6px 10px", background:C.accPale, borderRadius:6, fontSize:11, fontWeight:500, color:C.acc, marginBottom:10 }}>Flota propia del productor</div>}

        {/* Multi-truck header */}
        {multiTruck && (
          <div style={{ background:`${C.info}10`, border:`1px solid ${C.info}30`, borderRadius:8, padding:"8px 10px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            {Ic.truck(C.info, 16)}
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.info }}>Necesita {freight.truckCount} camiones</div>
              <div style={{ fontSize:11, color:C.t2 }}>{alreadyAssigned + truckList.length} asignados · {Math.max(0, remainingSlots)} pendientes</div>
            </div>
          </div>
        )}
        {multiTruck && truckList.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.t2, marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Agregados ({truckList.length})</div>
            {truckList.map((tk, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 8px", borderRadius:6, border:`1px solid ${C.b1}`, background:C.w, marginBottom:3 }}>
                {Ic.truck(C.t3, 12)}
                <div style={{ flex:1, minWidth:0, fontSize:11 }}>
                  <span style={{ fontWeight:600, color:C.t1 }}>{tk._plate || "—"}</span>
                  {tk._driverName && <span style={{ color:C.t3 }}> · {tk._driverName}</span>}
                  {tk.tons && <span style={{ color:C.t3 }}> · {tk.tons} tn</span>}
                </div>
                <button onClick={() => removeFromList(i)} style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>{Ic.cross(C.err, 12)}</button>
              </div>
            ))}
          </div>
        )}

        {/* Company selector (pre-step) */}
        {needsTransporter && remainingSlots > 0 ? (
          <>
            <div style={{ fontSize:10, fontWeight:600, color:C.t2, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Seleccioná un transportista</div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:320, overflowY:"auto" }}>
              {(hasOwnFleet ? externalTs : ts).length === 0 && <div style={{ fontSize:12, color:C.t3, padding:8 }}>No hay transportistas disponibles</div>}
              {(hasOwnFleet ? externalTs : ts).map(x => (
                <button key={x.id} onClick={() => setT(x.id)} style={{ width:"100%", padding:"8px 10px", borderRadius:8, textAlign:"left", fontFamily:"inherit", border:`1px solid ${C.b1}`, background:C.bgCard, cursor:"pointer", display:"block", marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:C.t1 }}>{x.name}</div>
                  {x.accessUsers?.length > 0 && <div style={{ fontSize:11, color:C.t3, marginTop:1 }}>{x.accessUsers.map(u => u.name).join(", ")}</div>}
                </button>
              ))}
            </div>
          </>
        ) : remainingSlots > 0 ? (
          <>
            {/* Company badge */}
            {mode === "company" && t && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:6, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:10 }}>
                {Ic.truck(C.t3, 12)}
                <span style={{ fontSize:12, fontWeight:600, color:C.t1, flex:1 }}>{ts.find(x => x.id === t)?.name || ""}</span>
                <button onClick={() => { setT(""); setTruckId(""); setDriverId(""); setStep(0); }} style={{ background:"none", border:`1px solid ${C.b2}`, borderRadius:4, padding:"2px 6px", fontSize:10, fontWeight:600, color:C.pri, cursor:"pointer", fontFamily:"inherit" }}>Cambiar</button>
              </div>
            )}

            <Stepper steps={stepLabels} current={step} />

            {/* =================== STEP 0: VEHICLE =================== */}
            {step === 0 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:8 }}>Seleccionar vehículo</div>
                <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:320, overflowY:"auto", marginBottom:6 }}>
                  {loadingTrucks && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>Cargando...</div>}
                  {!loadingTrucks && trucks.length === 0 && !showNewTruck && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>No hay vehículos</div>}
                  {trucks.map(tk => (
                    <TruckRow key={tk.id} tk={tk} selected={truckId === tk.id} onClick={() => setTruckId(truckId === tk.id ? "" : tk.id)} />
                  ))}
                </div>

                {!showNewTruck ? (
                  <CreateBtn label="Crear nuevo vehículo" onClick={() => { setShowNewTruck(true); setTruckErr(""); }} />
                ) : (
                  <div style={{ border:`1.5px solid ${C.pri}`, borderRadius:8, padding:10, marginBottom:6, background:`${C.pri}04` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.pri, marginBottom:6 }}>Nuevo vehículo</div>
                    <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                      <div style={{ flex:1 }}><Field label="Patente" value={newPlate} onChange={v => { setNewPlate(v); setTruckErr(""); }} placeholder="ABC1234" hasError={!!truckErr && !newPlate.trim()} /></div>
                      <div style={{ flex:1 }}><Field label="Capacidad (tn)" value={newCapacity} onChange={setNewCapacity} placeholder="30" /></div>
                    </div>
                    <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                      <div style={{ flex:1 }}><Field label="Marca" value={newBrand} onChange={v => { setNewBrand(v); setTruckErr(""); }} placeholder="Scania" hasError={!!truckErr && !newBrand.trim()} /></div>
                      <div style={{ flex:1 }}><Field label="Modelo" value={newModel} onChange={v => { setNewModel(v); setTruckErr(""); }} placeholder="R500" hasError={!!truckErr && !newModel.trim()} /></div>
                    </div>
                    {truckErr && <div style={{ fontSize:11, color:C.err, fontWeight:600, marginTop:2 }}>{truckErr}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:8 }}>
                      <button onClick={() => { setShowNewTruck(false); setNewPlate(""); setNewBrand(""); setNewModel(""); setNewCapacity(""); setTruckErr(""); }} style={{ flex:1, padding:"7px 0", borderRadius:6, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                      <button disabled={savingTruck} onClick={handleCreateTruck} style={{ flex:1, padding:"7px 0", borderRadius:6, border:"none", background:C.pri, color:C.tOn, fontSize:12, fontWeight:600, cursor:savingTruck ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingTruck ? 0.6 : 1 }}>{savingTruck ? "Creando..." : "Crear"}</button>
                    </div>
                  </div>
                )}

                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                  <button disabled={!truckId} onClick={() => setStep(1)} style={btnNext(!!truckId)}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* =================== STEP 1: DRIVER =================== */}
            {step === 1 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:8 }}>Seleccionar chofer</div>

                {user && <DriverRow d={{ name: user.name, phone: user.phone }} selected={driverId === user.id} isMe onClick={() => setDriverId(driverId === user.id ? "" : user.id)} />}

                <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:320, overflowY:"auto", marginBottom:6 }}>
                  {loadingDrivers && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>Cargando...</div>}
                  {!loadingDrivers && drivers.length === 0 && !showNewDriver && !user && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>No hay choferes</div>}
                  {drivers.filter(d => d.id !== user?.id).map(d => (
                    <DriverRow key={d.id} d={d} selected={driverId === d.id} onClick={() => setDriverId(driverId === d.id ? "" : d.id)} />
                  ))}
                </div>

                {!showNewDriver ? (
                  <CreateBtn label="Crear chofer" onClick={() => { setShowNewDriver(true); setDriverErr(""); }} />
                ) : (
                  <div style={{ border:`1.5px solid ${C.pri}`, borderRadius:8, padding:10, marginBottom:6, background:`${C.pri}04` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.pri, marginBottom:6 }}>Nuevo chofer</div>
                    <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                      <div style={{ flex:1 }}><Field label="Nombre" value={newDriverName} onChange={v => { setNewDriverName(v); setDriverErr(""); }} placeholder="Juan Pérez" hasError={!!driverErr} /></div>
                      <div style={{ flex:1 }}><Field label="Teléfono" value={newDriverPhone} onChange={setNewDriverPhone} placeholder="099123456" /></div>
                    </div>
                    {driverErr && <div style={{ fontSize:11, color:C.err, fontWeight:600, marginTop:2 }}>{driverErr}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:8 }}>
                      <button onClick={() => { setShowNewDriver(false); setNewDriverName(""); setNewDriverPhone(""); setDriverErr(""); }} style={{ flex:1, padding:"7px 0", borderRadius:6, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                      <button disabled={savingDriver} onClick={handleCreateDriver} style={{ flex:1, padding:"7px 0", borderRadius:6, border:"none", background:C.pri, color:C.tOn, fontSize:12, fontWeight:600, cursor:savingDriver ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingDriver ? 0.6 : 1 }}>{savingDriver ? "Creando..." : "Crear"}</button>
                    </div>
                  </div>
                )}

                <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
                  <button onClick={() => setStep(0)} style={btnPrev}>← Anterior</button>
                  <button disabled={!driverId} onClick={() => setStep(2)} style={btnNext(!!driverId)}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* =================== STEP 2: TONS =================== */}
            {step === 2 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:10 }}>Toneladas</div>

                <div style={{ padding:"8px 10px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                    {Ic.truck(C.t1, 14)}
                    <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{selTruck?.plate || ""}{selTruck?.model ? ` · ${selTruck.model}` : ""}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {Ic.user(C.t1, 14)}
                    <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{selDriver?._isMe ? `${selDriver.name} (yo)` : selDriver?.name || ""}</span>
                  </div>
                </div>

                <label style={{ fontSize:11, fontWeight:600, color:C.t2, marginBottom:4, display:"block" }}>Toneladas a transportar</label>
                <input type="number" min="0" step="0.1" value={tonsInput} onChange={e => setTonsInput(e.target.value)}
                  placeholder={defaultTons > 0 ? String(defaultTons) : ""}
                  style={{ width:"100%", fontSize:16, textAlign:"center", padding:"10px 12px", border:`1px solid ${C.b1}`, borderRadius:8, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                />
                {truckCapacity && <div style={{ fontSize:10, color:C.t3, textAlign:"center", marginTop:3 }}>Capacidad: {truckCapacity} tn</div>}

                <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, gap:8 }}>
                  <button onClick={() => setStep(1)} style={btnPrev}>← Anterior</button>
                  {multiTruck && remainingSlots > 1 ? (
                    <div style={{ display:"flex", gap:6 }}>
                      <button disabled={!parseFloat(tonsInput)} onClick={addAndContinue} style={{ background:"transparent", border:`1px solid ${C.pri}`, color:C.pri, borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:500, cursor: parseFloat(tonsInput) ? "pointer" : "default", fontFamily:"inherit" }}>+ Otro</button>
                      <button disabled={!(parseFloat(tonsInput) > 0) || loading} onClick={doConfirm} style={btnNext(parseFloat(tonsInput) > 0)}>{loading ? "..." : "Confirmar"}</button>
                    </div>
                  ) : (
                    <button disabled={!(parseFloat(tonsInput) > 0) || loading} onClick={doConfirm} style={btnNext(parseFloat(tonsInput) > 0)}>{loading ? "Asignando..." : "Confirmar"}</button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : multiTruck && truckList.length > 0 ? (
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <button onClick={safeClose} style={{ flex:1, padding:"8px 0", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
            <button disabled={loading} onClick={async () => {
              setLoading(true);
              const msg = await onAssignMulti(truckList.map(e => ({ transportCompanyId: e.transportCompanyId, truckId: e.truckId, driverId: e.driverId, tons: e.tons })));
              setLoading(false);
              if (msg) { setClosingText(msg); setClosing(true); }
            }} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", background:C.pri, color:C.tOn, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
              {loading ? "..." : `Asignar ${truckList.length} camiones`}
            </button>
          </div>
        ) : null}

    </ModalOverlay>
  );
}
