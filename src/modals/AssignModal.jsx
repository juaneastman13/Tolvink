import { useState, useEffect, useCallback } from "react";
import { C, Ic } from "../theme";
import { Field, ModalOverlay } from "../components";
import { apiGetTrucks, apiCreateTruck, apiGetDrivers, apiCreateDriver } from "../api";

// ======================== STEPPER ========================================
function Stepper({ steps, current }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:0, marginBottom:20, padding:"0 8px" }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background: done || active ? C.pri : C.b1,
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"background 0.2s",
              }}>
                {done ? Ic.chk(C.tOn, 14) : <span style={{ fontSize:13, fontWeight:500, color: active ? C.tOn : C.t3 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize:11, fontWeight:600, color: active ? C.pri : done ? C.pri : C.t3, whiteSpace:"nowrap" }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex:1, height:2, background: done ? C.pri : C.b1, margin:"0 6px", marginBottom:18, transition:"background 0.2s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ======================== ROW ITEM =======================================
function RowItem({ icon, label, sub, selected, onClick, warning }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"10px 12px", borderRadius:8, textAlign:"left", fontFamily:"inherit",
      border: selected ? `1.5px solid ${C.pri}` : `1px solid ${C.b1}`,
      background: selected ? C.okPale : C.bgCard,
      cursor:"pointer", display:"flex", alignItems:"center", gap:10, marginBottom:6,
      transition:"border-color 0.15s, background 0.15s",
    }}>
      {icon}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.2, fontWeight:600, color:C.t1 }}>{label}</div>
        {sub && <div style={{ fontSize:11.6, color:C.t3, marginTop:1 }}>{sub}</div>}
      </div>
      {warning && <span style={{ fontSize:10, fontWeight:700, color:C.acc, background:C.accPale, padding:"2px 6px", borderRadius:4, whiteSpace:"nowrap" }}>{warning}</span>}
    </button>
  );
}

// ======================== CREATE BUTTON ==================================
function CreateBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:"100%", padding:"10px 12px", borderRadius:8, textAlign:"center", fontFamily:"inherit",
      border:`1.5px dashed ${C.pri}`, background:"transparent", color:C.pri,
      fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center",
      justifyContent:"center", gap:6, marginBottom:6,
    }}>
      {Ic.plus(C.pri, 14)} {label}
    </button>
  );
}

// ======================== MAIN MODAL =====================================
export default function AssignModal({ freight, transporters, user, onClose, onConfirm, onAssignMulti }) {
  const multiTruck = (freight.truckCount || 1) > 1;
  const [step, setStep] = useState(0); // 0=vehicle, 1=driver, 2=tons
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

  // Create truck inline
  const [showNewTruck, setShowNewTruck] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [savingTruck, setSavingTruck] = useState(false);
  const [truckErr, setTruckErr] = useState("");

  // Create driver inline
  const [showNewDriver, setShowNewDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverErr, setDriverErr] = useState("");

  const [tonsInput, setTonsInput] = useState("");
  const ts = transporters || [];

  // Multi-truck tracking
  const alreadyAssigned = freight.assignedTruckCount || 0;
  const needed = (freight.truckCount || 1) - alreadyAssigned;
  const totalTons = freight.tons || 0;

  // Own fleet detection
  const hasOwnFleet = !!freight.originHasOwnFleet || !!freight.destHasOwnFleet || !!user?.hasInternalFleet;
  const ownFleetCompanyId = (user?.hasInternalFleet && !freight.destHasOwnFleet && !freight.originHasOwnFleet)
    ? (user.activeCompanyId || user.companyId)
    : freight.destHasOwnFleet ? freight.destCompanyId : freight.originCompanyId;
  const forceMode = freight.useOwnFleet === true ? "own" : null;

  // Selected objects
  const selTruck = truckId ? trucks.find(x => x.id === truckId) : null;
  const selDriver = driverId ? (driverId === user?.id ? { name: user.name, _isMe: true } : drivers.find(x => x.id === driverId)) : null;

  // Compute default tons when truck is selected
  const truckCapacity = selTruck?.capacity ? parseFloat(selTruck.capacity) : null;
  const assignedTons = truckList.reduce((s, e) => s + (e.tons || 0), 0);
  const remainingTons = Math.max(0, totalTons - assignedTons);
  const defaultTons = truckCapacity ? Math.min(truckCapacity, remainingTons || totalTons) : (remainingTons || totalTons);

  // Set default tons when entering step 2 (after truck selection)
  useEffect(() => {
    if (step === 2 && !tonsInput) {
      setTonsInput(defaultTons > 0 ? String(Math.round(defaultTons * 10) / 10) : "");
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load trucks/drivers
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

  // Load when mode=own or when company is selected in company mode
  useEffect(() => {
    if (mode === "own") { loadTrucks(ownFleetCompanyId); loadDriversFn(ownFleetCompanyId); }
  }, [mode, ownFleetCompanyId, loadTrucks, loadDriversFn]);

  useEffect(() => {
    if (mode === "company" && t) { loadTrucks(t); loadDriversFn(t); }
  }, [mode, t, loadTrucks, loadDriversFn]);

  // Pre-select driver from truck's assignedUser
  useEffect(() => {
    if (truckId) {
      const tk = trucks.find(x => x.id === truckId);
      if (tk?.assignedUser?.id) {
        const d = drivers.find(x => x.id === tk.assignedUser.id);
        if (d) setDriverId(tk.assignedUser.id);
      }
    }
  }, [truckId, trucks, drivers]);

  // Create truck handler
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
    } catch (e) { setTruckErr(e.message || "Error al crear vehículo"); }
    finally { setSavingTruck(false); }
  };

  // Create driver handler
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
    } catch (e) { setDriverErr(e.message || "Error al crear chofer"); }
    finally { setSavingDriver(false); }
  };

  // Confirm assignment
  const doConfirm = async () => {
    if (loading || closing) return;
    const tons = parseFloat(tonsInput) || undefined;
    setLoading(true);

    if (multiTruck) {
      // Add current selection to list and assign all
      const compId = mode === "own" ? ownFleetCompanyId : t;
      const entry = { transportCompanyId: compId, truckId: truckId || undefined, driverId: driverId || undefined, tons };
      const all = [...truckList, entry];
      const payload = all.map(e => ({ transportCompanyId: e.transportCompanyId, truckId: e.truckId, driverId: e.driverId, tons: e.tons }));
      const msg = await onAssignMulti(payload);
      setLoading(false);
      if (msg) { setClosingText(msg); setClosing(true); }
    } else {
      const compId = mode === "own" ? ownFleetCompanyId : t;
      const msg = await onConfirm(compId, truckId || undefined, driverId || undefined);
      setLoading(false);
      if (msg) { setClosingText(msg); setClosing(true); }
    }
  };

  // Multi-truck: add to list and reset for next
  const addAndContinue = () => {
    const compId = mode === "own" ? ownFleetCompanyId : t;
    const tons = parseFloat(tonsInput) || undefined;
    const selTruckObj = trucks.find(x => x.id === truckId);
    const selDriverObj2 = driverId === user?.id ? { name: user.name } : drivers.find(x => x.id === driverId);
    setTruckList(prev => [...prev, {
      transportCompanyId: compId,
      truckId: truckId || undefined,
      driverId: driverId || undefined,
      tons,
      _plate: selTruckObj?.plate || "",
      _model: selTruckObj?.model || "",
      _driverName: selDriverObj2?.name || "",
    }]);
    setTruckId(""); setDriverId(""); setTonsInput(""); setStep(0);
  };

  const removeFromList = (idx) => setTruckList(prev => prev.filter((_, i) => i !== idx));

  // Safe close
  const hasDirtyData = !!(t || truckId || driverId || truckList.length > 0 || showNewTruck || showNewDriver);
  const safeClose = () => {
    if (hasDirtyData && !loading && !closing) {
      if (!window.confirm("¿Descartar los cambios sin guardar?")) return;
    }
    onClose();
  };

  // For company mode: need to select transporter first (pre-step)
  const needsTransporter = mode === "company" && !t;
  const externalTs = ts.filter(x => x.id !== freight.originCompanyId);

  const remainingSlots = multiTruck ? Math.max(0, needed - truckList.length) : 1;
  const canConfirm = truckId && driverId && parseFloat(tonsInput) > 0;
  const stepLabels = ["Vehículo", "Chofer", "Toneladas"];

  // ======================== RENDER =======================================
  return (
    <ModalOverlay onClose={safeClose} loading={loading} closing={closing} closingText={closingText}>
      <div style={{ maxWidth:480, width:"90vw", maxHeight:"80vh", overflow:"auto" }}>

        {/* Title + close */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:18.7, fontWeight:700, color:C.t1 }}>Asignar transporte</div>
          <button onClick={safeClose} aria-label="Cerrar" style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3, 18)}</button>
        </div>

        {/* Mode toggle */}
        {hasOwnFleet && !forceMode && (
          <div style={{ display:"flex", gap:0, marginBottom:16, borderRadius:10, overflow:"hidden", border:`1.5px solid ${C.b1}` }}>
            <button onClick={() => { setMode("company"); setTruckId(""); setDriverId(""); setStep(0); setT(""); }} style={{ flex:1, padding:"10px 0", fontFamily:"inherit", fontSize:13.8, fontWeight:mode === "company" ? 700 : 500, background:mode === "company" ? C.pri : C.w, color:mode === "company" ? C.w : C.t2, border:"none", cursor:"pointer" }}>Empresa</button>
            <button onClick={() => { setMode("own"); setT(""); setStep(0); }} style={{ flex:1, padding:"10px 0", fontFamily:"inherit", fontSize:13.8, fontWeight:mode === "own" ? 700 : 500, background:mode === "own" ? C.acc : C.w, color:mode === "own" ? C.w : C.t2, border:"none", cursor:"pointer", borderLeft:`1px solid ${C.b1}` }}>Flota propia</button>
          </div>
        )}
        {forceMode === "own" && <div style={{ padding:"8px 12px", background:C.accPale, borderRadius:8, fontSize:12.1, fontWeight:500, color:C.acc, marginBottom:12 }}>El productor eligió usar flota propia</div>}

        {/* Multi-truck header + list of already added */}
        {multiTruck && (
          <div style={{ background:`${C.info}10`, border:`1px solid ${C.info}30`, borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
            {Ic.truck(C.info, 18)}
            <div>
              <div style={{ fontSize:14.3, fontWeight:700, color:C.info }}>Necesita {freight.truckCount} camiones</div>
              <div style={{ fontSize:12.1, color:C.t2 }}>{alreadyAssigned + truckList.length} asignados · {Math.max(0, remainingSlots)} pendientes</div>
            </div>
          </div>
        )}
        {multiTruck && truckList.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11.6, fontWeight:600, color:C.t2, marginBottom:6, textTransform:"uppercase", letterSpacing:0.6 }}>Agregados ({truckList.length})</div>
            {truckList.map((tk, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, marginBottom:4 }}>
                {Ic.truck(C.t3, 14)}
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ fontSize:12.1, fontWeight:600, color:C.t1 }}>{tk._plate || "Sin especificar"}</span>
                  {tk._driverName && <span style={{ fontSize:11, color:C.t3 }}> · {tk._driverName}</span>}
                  {tk.tons && <span style={{ fontSize:11, color:C.t3 }}> · {tk.tons} tn</span>}
                </div>
                <button onClick={() => removeFromList(i)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.err, 14)}</button>
              </div>
            ))}
          </div>
        )}

        {/* Company selector (pre-step for company mode) */}
        {needsTransporter && remainingSlots > 0 ? (
          <>
            <div style={{ fontSize:11.6, fontWeight:600, color:C.t2, marginBottom:8, textTransform:"uppercase", letterSpacing:0.6 }}>Seleccioná un transportista</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:300, overflowY:"auto" }}>
              {(hasOwnFleet ? externalTs : ts).length === 0 && <div style={{ fontSize:13.2, color:C.t3, padding:10 }}>No hay transportistas disponibles</div>}
              {(hasOwnFleet ? externalTs : ts).map(x => (
                <RowItem key={x.id} icon={Ic.truck(C.t3, 16)} label={x.name}
                  sub={x.accessUsers?.length > 0 ? x.accessUsers.map(u => `${u.name}${u.phone ? ` · ${u.phone}` : ""}`).join(", ") : undefined}
                  onClick={() => setT(x.id)} />
              ))}
            </div>
          </>
        ) : remainingSlots > 0 ? (
          <>
            {/* Company selected badge */}
            {mode === "company" && t && (
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:14 }}>
                {Ic.truck(C.t3, 14)}
                <span style={{ fontSize:13.2, fontWeight:600, color:C.t1, flex:1 }}>{ts.find(x => x.id === t)?.name || ""}</span>
                <button onClick={() => { setT(""); setTruckId(""); setDriverId(""); setStep(0); }} style={{ background:"none", border:`1px solid ${C.b2}`, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:600, color:C.pri, cursor:"pointer", fontFamily:"inherit" }}>Cambiar</button>
              </div>
            )}

            {/* Stepper */}
            <Stepper steps={stepLabels} current={step} />

            {/* =================== STEP 0: VEHICLE =================== */}
            {step === 0 && (
              <div>
                <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:10 }}>Seleccionar vehículo</div>
                <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:260, overflowY:"auto", marginBottom:8 }}>
                  {loadingTrucks && <div style={{ fontSize:13.2, color:C.t3, padding:10, textAlign:"center" }}>Cargando vehículos...</div>}
                  {!loadingTrucks && trucks.length === 0 && !showNewTruck && <div style={{ fontSize:13.2, color:C.t3, padding:10, textAlign:"center" }}>No hay vehículos registrados</div>}
                  {trucks.map(tk => {
                    const cap = tk.capacity ? ` · ${tk.capacity} tn` : "";
                    const busy = tk.activeTripStatus === "in_progress" || tk.activeTripStatus === "loaded";
                    return (
                      <RowItem key={tk.id} icon={Ic.truck(C.t3, 16)}
                        label={`${tk.plate}${tk.model ? ` · ${tk.model}` : ""}${cap}`}
                        sub={tk.assignedUser ? `Chofer: ${tk.assignedUser.name}` : undefined}
                        selected={truckId === tk.id}
                        warning={busy ? "En viaje" : undefined}
                        onClick={() => setTruckId(truckId === tk.id ? "" : tk.id)}
                      />
                    );
                  })}
                </div>

                {/* Create new truck inline */}
                {!showNewTruck ? (
                  <CreateBtn label="Crear nuevo vehículo" onClick={() => { setShowNewTruck(true); setTruckErr(""); }} />
                ) : (
                  <div style={{ border:`1.5px solid ${C.pri}`, borderRadius:10, padding:12, marginBottom:8, background:`${C.pri}04` }}>
                    <div style={{ fontSize:12.1, fontWeight:700, color:C.pri, marginBottom:8 }}>Nuevo vehículo</div>
                    <Field label="Patente" value={newPlate} onChange={v => { setNewPlate(v); setTruckErr(""); }} placeholder="Ej: ABC1234" hasError={!!truckErr && !newPlate.trim()} />
                    <div style={{ height:6 }} />
                    <Field label="Marca" value={newBrand} onChange={v => { setNewBrand(v); setTruckErr(""); }} placeholder="Ej: Scania" hasError={!!truckErr && !newBrand.trim()} />
                    <div style={{ height:6 }} />
                    <Field label="Modelo" value={newModel} onChange={v => { setNewModel(v); setTruckErr(""); }} placeholder="Ej: R500" hasError={!!truckErr && !newModel.trim()} />
                    <div style={{ height:6 }} />
                    <Field label="Capacidad (toneladas)" value={newCapacity} onChange={setNewCapacity} placeholder="Ej: 30" />
                    {truckErr && <div style={{ fontSize:12.1, color:C.err, fontWeight:600, marginTop:6 }}>{truckErr}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:10 }}>
                      <button onClick={() => { setShowNewTruck(false); setNewPlate(""); setNewBrand(""); setNewModel(""); setNewCapacity(""); setTruckErr(""); }} style={{ flex:1, padding:"10px 0", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12.7, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                      <button disabled={savingTruck} onClick={handleCreateTruck} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background:C.pri, color:C.tOn, fontSize:12.7, fontWeight:600, cursor:savingTruck ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingTruck ? 0.6 : 1 }}>{savingTruck ? "Creando..." : "Crear y seleccionar"}</button>
                    </div>
                  </div>
                )}

                {/* Next button */}
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                  <button disabled={!truckId} onClick={() => setStep(1)} style={{
                    background: truckId ? C.pri : C.b1, color: truckId ? C.tOn : C.t3,
                    borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:500,
                    border:"none", cursor: truckId ? "pointer" : "default", fontFamily:"inherit",
                  }}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* =================== STEP 1: DRIVER =================== */}
            {step === 1 && (
              <div>
                <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:10 }}>Seleccionar chofer</div>

                {/* "Yo soy el chofer" button */}
                {user && (
                  <RowItem icon={Ic.user(C.pri, 16)} label={`${user.name} (yo)`}
                    selected={driverId === user.id}
                    onClick={() => setDriverId(driverId === user.id ? "" : user.id)} />
                )}

                <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:220, overflowY:"auto", marginBottom:8 }}>
                  {loadingDrivers && <div style={{ fontSize:13.2, color:C.t3, padding:10, textAlign:"center" }}>Cargando choferes...</div>}
                  {!loadingDrivers && drivers.length === 0 && !showNewDriver && !user && <div style={{ fontSize:13.2, color:C.t3, padding:8, textAlign:"center" }}>No hay choferes registrados</div>}
                  {drivers.filter(d => d.id !== user?.id).map(d => {
                    const qLen = d.activeFreights?.length || 0;
                    return (
                      <RowItem key={d.id} icon={Ic.user(C.t3, 16)}
                        label={d.name + (d.phone ? ` · ${d.phone}` : "")}
                        sub={qLen > 0 ? `${qLen} flete${qLen > 1 ? "s" : ""} activo${qLen > 1 ? "s" : ""}` : undefined}
                        selected={driverId === d.id}
                        onClick={() => setDriverId(driverId === d.id ? "" : d.id)}
                      />
                    );
                  })}
                </div>

                {/* Create new driver inline */}
                {!showNewDriver ? (
                  <CreateBtn label="Crear usuario chofer" onClick={() => { setShowNewDriver(true); setDriverErr(""); }} />
                ) : (
                  <div style={{ border:`1.5px solid ${C.pri}`, borderRadius:10, padding:12, marginBottom:8, background:`${C.pri}04` }}>
                    <div style={{ fontSize:12.1, fontWeight:700, color:C.pri, marginBottom:8 }}>Nuevo chofer</div>
                    <Field label="Nombre" value={newDriverName} onChange={v => { setNewDriverName(v); setDriverErr(""); }} placeholder="Ej: Juan Pérez" hasError={!!driverErr} />
                    <div style={{ height:6 }} />
                    <Field label="Teléfono (opcional)" value={newDriverPhone} onChange={setNewDriverPhone} placeholder="Ej: 099123456" />
                    {driverErr && <div style={{ fontSize:12.1, color:C.err, fontWeight:600, marginTop:6 }}>{driverErr}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:10 }}>
                      <button onClick={() => { setShowNewDriver(false); setNewDriverName(""); setNewDriverPhone(""); setDriverErr(""); }} style={{ flex:1, padding:"10px 0", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12.7, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                      <button disabled={savingDriver} onClick={handleCreateDriver} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background:C.pri, color:C.tOn, fontSize:12.7, fontWeight:600, cursor:savingDriver ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingDriver ? 0.6 : 1 }}>{savingDriver ? "Creando..." : "Crear y seleccionar"}</button>
                    </div>
                  </div>
                )}

                {/* Prev / Next buttons */}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
                  <button onClick={() => setStep(0)} style={{
                    background:"transparent", border:`1px solid ${C.b1}`, color:C.t2,
                    borderRadius:10, padding:"10px 20px", fontSize:14, fontFamily:"inherit", cursor:"pointer",
                  }}>← Anterior</button>
                  <button disabled={!driverId} onClick={() => setStep(2)} style={{
                    background: driverId ? C.pri : C.b1, color: driverId ? C.tOn : C.t3,
                    borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:500,
                    border:"none", cursor: driverId ? "pointer" : "default", fontFamily:"inherit",
                  }}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* =================== STEP 2: TONS =================== */}
            {step === 2 && (
              <div>
                <div style={{ fontSize:15.4, fontWeight:700, color:C.t1, marginBottom:14 }}>Toneladas para este camión</div>

                {/* Summary of selections */}
                <div style={{ padding:"10px 14px", borderRadius:10, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    {Ic.truck(C.t1, 16)}
                    <span style={{ fontSize:14, fontWeight:600, color:C.t1 }}>{selTruck?.plate || ""}{selTruck?.model ? ` · ${selTruck.model}` : ""}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {Ic.user(C.t1, 16)}
                    <span style={{ fontSize:14, fontWeight:600, color:C.t1 }}>{selDriver?._isMe ? `${selDriver.name} (yo)` : selDriver?.name || ""}</span>
                  </div>
                </div>

                {/* Tons input */}
                <label style={{ fontSize:12.1, fontWeight:600, color:C.t2, marginBottom:6, display:"block" }}>Toneladas a transportar</label>
                <input
                  type="number" min="0" step="0.1"
                  value={tonsInput} onChange={e => setTonsInput(e.target.value)}
                  placeholder={defaultTons > 0 ? String(defaultTons) : ""}
                  style={{
                    width:"100%", fontSize:16, textAlign:"center", padding:"12px 16px",
                    border:`1px solid ${C.b1}`, borderRadius:8, fontFamily:"inherit",
                    outline:"none", boxSizing:"border-box",
                  }}
                />
                {truckCapacity && <div style={{ fontSize:11, color:C.t3, textAlign:"center", marginTop:4 }}>Capacidad del camión: {truckCapacity} tn</div>}

                {/* Prev / Confirm buttons */}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:16 }}>
                  <button onClick={() => setStep(1)} style={{
                    background:"transparent", border:`1px solid ${C.b1}`, color:C.t2,
                    borderRadius:10, padding:"10px 20px", fontSize:14, fontFamily:"inherit", cursor:"pointer",
                  }}>← Anterior</button>

                  {multiTruck && remainingSlots > 1 ? (
                    <div style={{ display:"flex", gap:6 }}>
                      <button disabled={!parseFloat(tonsInput)} onClick={addAndContinue} style={{
                        background:"transparent", border:`1px solid ${C.pri}`, color:C.pri,
                        borderRadius:10, padding:"10px 14px", fontSize:13, fontWeight:500,
                        cursor: parseFloat(tonsInput) ? "pointer" : "default", fontFamily:"inherit",
                      }}>+ Agregar otro</button>
                      <button disabled={!(parseFloat(tonsInput) > 0) || loading} onClick={doConfirm} style={{
                        background: parseFloat(tonsInput) > 0 ? C.pri : C.b1,
                        color: parseFloat(tonsInput) > 0 ? C.tOn : C.t3,
                        borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:500,
                        border:"none", cursor: parseFloat(tonsInput) > 0 ? "pointer" : "default", fontFamily:"inherit",
                      }}>{loading ? "Asignando..." : "Confirmar"}</button>
                    </div>
                  ) : (
                    <button disabled={!(parseFloat(tonsInput) > 0) || loading} onClick={doConfirm} style={{
                      background: parseFloat(tonsInput) > 0 ? C.pri : C.b1,
                      color: parseFloat(tonsInput) > 0 ? C.tOn : C.t3,
                      borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:500,
                      border:"none", cursor: parseFloat(tonsInput) > 0 ? "pointer" : "default", fontFamily:"inherit",
                    }}>{loading ? "Asignando..." : "Confirmar asignación"}</button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : multiTruck && truckList.length > 0 ? (
          /* All slots filled — final confirm */
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={safeClose} style={{ flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
            <button disabled={loading} onClick={async () => {
              setLoading(true);
              const payload = truckList.map(e => ({ transportCompanyId: e.transportCompanyId, truckId: e.truckId, driverId: e.driverId, tons: e.tons }));
              const msg = await onAssignMulti(payload);
              setLoading(false);
              if (msg) { setClosingText(msg); setClosing(true); }
            }} style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", background:C.pri, color:C.tOn, fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
              {loading ? "Asignando..." : `Asignar ${truckList.length} camiones`}
            </button>
          </div>
        ) : null}

      </div>
    </ModalOverlay>
  );
}
