import { useState, useEffect, useCallback } from "react";
import { C, Ic , R} from "../theme";
import { Field, ModalOverlay } from "../components";
import { apiGetTrucks, apiCreateTruck, apiGetDrivers, apiCreateDriver, apiGetCompanyAccess, apiCreateLinkedCompany, apiUpdateFreight } from "../api";

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
      width:"100%", padding:"8px 10px", borderRadius: R.md, textAlign:"left", fontFamily:"inherit",
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
          {busy && <span style={{ fontSize:10, fontWeight:700, color:C.acc, background:C.accPale, padding:"1px 5px", borderRadius: R.xs }}>En viaje</span>}
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
      width:"100%", padding:"8px 10px", borderRadius: R.md, textAlign:"left", fontFamily:"inherit",
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
      width:"100%", padding:"7px 10px", borderRadius: R.md, textAlign:"center", fontFamily:"inherit",
      border:`1.5px dashed ${C.pri}`, background:"transparent", color:C.pri,
      fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center",
      justifyContent:"center", gap:4, marginBottom:4,
    }}>
      {Ic.plus(C.pri, 12)} {label}
    </button>
  );
}

// ======================== NAV BUTTONS ====================================
const btnPrev = { background:"transparent", border:`1px solid ${C.b1}`, color:C.t2, borderRadius: R.md, padding:"8px 16px", fontSize:13, fontFamily:"inherit", cursor:"pointer" };
const btnNext = (on) => ({ background: on ? C.pri : C.b1, color: on ? C.tOn : C.t3, borderRadius: R.md, padding:"8px 16px", fontSize:13, fontWeight:500, border:"none", cursor: on ? "pointer" : "default", fontFamily:"inherit" });

// ======================== MAIN MODAL =====================================
export default function AssignModal({ freight, transporters, user, onClose, onConfirm, onAssignMulti, onRefresh }) {
  const multiTruck = (freight.truckCount || 1) > 1;
  const [step, setStep] = useState(0);
  const [truckList, setTruckList] = useState([]);
  const isProducerUser = user?.userType === "producer";
  const _producerHasFleet = !!freight.originHasOwnFleet || !!freight.destHasOwnFleet || !!user?.hasInternalFleet;
  const _producerHasTransporters = (transporters || []).length > 0;
  const _producerOnlyDelegate = isProducerUser && !_producerHasFleet && !_producerHasTransporters && !!freight.destCompanyId;
  const [mode, setMode] = useState(() => {
    if (_producerOnlyDelegate) return "delegate";
    return freight.useOwnFleet === true ? "own" : "company";
  });
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
  const [loadError, setLoadError] = useState(null);
  const [transporterIsConsulta, setTransporterIsConsulta] = useState(false);

  // Linked transporters from CompanyAccess (includes CONSULTA)
  const [linkedTs, setLinkedTs] = useState([]);
  const [loadingLinkedTs, setLoadingLinkedTs] = useState(false);

  // Inline company creation
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyRut, setNewCompanyRut] = useState("");
  const [newCompanyAccess, setNewCompanyAccess] = useState("OPERATOR");
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyErr, setCompanyErr] = useState("");

  const ts = transporters || [];
  const isPlantUser = user?.userType === "plant";

  // Load linked transporters from CompanyAccess for plant users (includes CONSULTA)
  useEffect(() => {
    if (!isPlantUser || !user?.activeCompanyId) return;
    let cancelled = false;
    setLoadingLinkedTs(true);
    apiGetCompanyAccess(user.activeCompanyId, "TRANSPORTER").then(records => {
      if (cancelled) return;
      setLinkedTs((records || []).map(r => ({
        id: r.granteeCompanyId || r.granteeCompany?.id,
        name: r.granteeCompany?.name || "—",
        accessLevel: r.accessLevel,
      })));
    }).catch(() => {}).finally(() => { if (!cancelled) setLoadingLinkedTs(false); });
    return () => { cancelled = true; };
  }, [isPlantUser, user?.activeCompanyId]);

  // Handler: create transporter company inline
  const handleCreateCompany = async () => {
    if (savingCompany) return;
    const name = newCompanyName.trim();
    if (!name) { setCompanyErr("Nombre obligatorio"); return; }
    setSavingCompany(true); setCompanyErr("");
    try {
      const res = await apiCreateLinkedCompany({
        name,
        type: "transporter",
        rut: newCompanyRut.trim() || undefined,
        accessLevel: newCompanyAccess,
      });
      const newId = res?.company?.id || res?.companyAccess?.granteeCompanyId || res?.id;
      setLinkedTs(prev => [...prev, { id: newId, name, accessLevel: newCompanyAccess }]);
      setShowNewCompany(false); setNewCompanyName(""); setNewCompanyRut(""); setNewCompanyAccess("OPERATOR");
      if (newId) setT(newId);
    } catch (e) { setCompanyErr(e.message || "Error al crear"); }
    finally { setSavingCompany(false); }
  };

  const alreadyAssigned = freight.assignedTruckCount || 0;
  const needed = (freight.truckCount || 1) - alreadyAssigned;
  const totalTons = freight.tons || 0;

  const hasOwnFleet = !!freight.originHasOwnFleet || !!freight.destHasOwnFleet || !!user?.hasInternalFleet;
  // Use the user's active company for own-fleet truck/driver loading.
  // The user always has access to their own active company, and trucks/drivers are created under it.
  const ownFleetCompanyId = user?.activeCompanyId || user?.companyId || freight.originCompanyId;
  const forceMode = freight.useOwnFleet === true ? "own" : null;

  const selTruck = truckId ? trucks.find(x => x.id === truckId) : null;
  const selDriver = driverId ? (driverId === user?.id ? { name: user.name, _isMe: true } : drivers.find(x => x.id === driverId)) : null;

  const truckCapacity = selTruck?.capacity ? parseFloat(selTruck.capacity) : null;
  const assignedTons = truckList.reduce((s, e) => s + (e.tons || 0), 0);
  const remainingTons = Math.max(0, totalTons - assignedTons);
  const defaultTons = truckCapacity ? Math.min(truckCapacity, remainingTons || totalTons) : (remainingTons || totalTons);

  const isDelegation = mode === "company" && !transporterIsConsulta;
  const tonsStep = isDelegation ? 0 : 2;
  useEffect(() => { setStep(0); }, [isDelegation]);

  // Check access level when plant selects a transporter in company mode (uses linkedTs)
  useEffect(() => {
    if (!isPlantUser || mode !== "company" || !t) {
      setTransporterIsConsulta(false);
      return;
    }
    const rec = linkedTs.find(r => r.id === t);
    const isConsulta = rec?.accessLevel === "READONLY";
    setTransporterIsConsulta(isConsulta);
    if (isConsulta) { loadTrucks(t); loadDriversFn(t); }
  }, [isPlantUser, mode, t, linkedTs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step === tonsStep && !tonsInput) setTonsInput(defaultTons > 0 ? String(Math.round(defaultTons * 10) / 10) : "");
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrucks = useCallback((compId) => {
    const cid = compId || (mode === "own" ? ownFleetCompanyId : t);
    if (!cid) return;
    setLoadingTrucks(true); setLoadError(null);
    apiGetTrucks(cid).then(r => setTrucks((r || []).filter(t => t.active !== false))).catch(() => { setTrucks([]); setLoadError("No se pudieron cargar los vehículos"); }).finally(() => setLoadingTrucks(false));
  }, [mode, ownFleetCompanyId, t]);

  const loadDriversFn = useCallback((compId) => {
    const cid = compId || (mode === "own" ? ownFleetCompanyId : t);
    if (!cid) return;
    setLoadingDrivers(true); setLoadError(null);
    apiGetDrivers(cid).then(r => setDrivers(r || [])).catch(() => { setDrivers([]); setLoadError("No se pudieron cargar los choferes"); }).finally(() => setLoadingDrivers(false));
  }, [mode, ownFleetCompanyId, t]);

  useEffect(() => { if (mode === "own") { loadTrucks(ownFleetCompanyId); loadDriversFn(ownFleetCompanyId); } }, [mode, ownFleetCompanyId, loadTrucks, loadDriversFn]);
  useEffect(() => { if (mode === "company" && t && !isDelegation) { loadTrucks(t); loadDriversFn(t); } }, [mode, t, isDelegation, loadTrucks, loadDriversFn]);

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
      const body = { plate, model };
      // When plant creates truck for a transporter, set ownerCompanyId
      if (mode === "company" && t) body.ownerCompanyId = t;
      const cap = parseFloat(newCapacity);
      if (cap > 0) body.capacity = cap;
      const created = await apiCreateTruck(body);
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

  // Producer delegation to plant
  const plantName = freight.destPlantName || freight.destCompanyName || freight.destName || "la planta";
  const canDelegate = isProducerUser && freight.destCompanyId;
  const producerHasOptions = hasOwnFleet || ts.length > 0;

  const handleDelegate = async () => {
    if (loading || closing) return;
    setLoading(true);
    try {
      await apiUpdateFreight(freight.id, { useOwnFleet: false });
      if (onRefresh) onRefresh(freight.id);
      setClosingText(`Transporte delegado a ${plantName}`);
      setClosing(true);
    } catch (e) {
      setLoading(false);
    }
  };

  const hasDirtyData = !!(t || truckId || driverId || truckList.length > 0 || showNewTruck || showNewDriver || showNewCompany);
  const safeClose = () => { if (hasDirtyData && !loading && !closing && !window.confirm("¿Descartar los cambios sin guardar?")) return; onClose(); };

  const needsTransporter = mode === "company" && !t;
  // Plant users: use linkedTs from CompanyAccess (includes CONSULTA). Others: use catalog transporters.
  const displayTs = isPlantUser && linkedTs.length > 0
    ? linkedTs.filter(x => x.id !== freight.originCompanyId)
    : ts.filter(x => x.id !== freight.originCompanyId);
  const remainingSlots = multiTruck ? Math.max(0, needed - truckList.length) : 1;
  const stepLabels = isDelegation ? ["Toneladas"] : ["Vehículo", "Chofer", "Toneladas"];
  const isConsultaFlow = mode === "company" && transporterIsConsulta;

  // ======================== RENDER =======================================
  return (
    <ModalOverlay onClose={safeClose} loading={loading} closing={closing} closingText={closingText} maxWidth={560}>

        {/* Title */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.t1 }}>Asignar transporte</div>
          <button onClick={safeClose} aria-label="Cerrar" style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>{Ic.cross(C.t3, 16)}</button>
        </div>

        {/* Mode toggle */}
        {hasOwnFleet && !forceMode && mode !== "delegate" && (
          <div style={{ display:"flex", gap:0, marginBottom:12, borderRadius: R.md, overflow:"hidden", border:`1.5px solid ${C.b1}` }}>
            <button onClick={() => { setMode("company"); setTruckId(""); setDriverId(""); setStep(0); setT(""); }} style={{ flex:1, padding:"8px 0", fontFamily:"inherit", fontSize:13, fontWeight:mode === "company" ? 700 : 500, background:mode === "company" ? C.pri : C.w, color:mode === "company" ? C.w : C.t2, border:"none", cursor:"pointer" }}>Empresa</button>
            <button onClick={() => { setMode("own"); setT(""); setStep(0); }} style={{ flex:1, padding:"8px 0", fontFamily:"inherit", fontSize:13, fontWeight:mode === "own" ? 700 : 500, background:mode === "own" ? C.acc : C.w, color:mode === "own" ? C.w : C.t2, border:"none", cursor:"pointer", borderLeft:`1px solid ${C.b1}` }}>Flota propia</button>
            {canDelegate && (
              <button onClick={() => { setMode("delegate"); setT(""); setTruckId(""); setDriverId(""); setStep(0); }} style={{ flex:1, padding:"8px 0", fontFamily:"inherit", fontSize:13, fontWeight:mode === "delegate" ? 700 : 500, background:mode === "delegate" ? C.info : C.w, color:mode === "delegate" ? C.w : C.t2, border:"none", cursor:"pointer", borderLeft:`1px solid ${C.b1}` }}>Delegar</button>
            )}
          </div>
        )}
        {forceMode === "own" && <div style={{ padding:"6px 10px", background:C.accPale, borderRadius: R.sm, fontSize:11, fontWeight:500, color:C.acc, marginBottom:10 }}>Flota propia del productor</div>}

        {/* Producer: delegate to plant (sole option or selected mode) */}
        {mode === "delegate" && canDelegate && (
          <div>
            <div style={{ background:`${C.info}08`, border:`1px solid ${C.info}25`, borderRadius: R.lg, padding:16, marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                {Ic.plant(C.info, 20)}
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>Delegar a {plantName}</div>
                  <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>La planta se encargará de asignar el transporte</div>
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {producerHasOptions && <button onClick={() => setMode(hasOwnFleet ? "own" : "company")} style={{ flex:1, padding:"10px 0", borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>}
              <button disabled={loading} onClick={handleDelegate} style={{ flex:1, padding:"10px 0", borderRadius: R.md, border:"none", background:C.info, color:C.w, fontSize:13, fontWeight:700, cursor:loading ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:loading ? 0.6 : 1 }}>{loading ? "Delegando..." : "Delegar asignación"}</button>
            </div>
          </div>
        )}

        {/* Multi-truck header */}
        {multiTruck && mode !== "delegate" && (
          <div style={{ background:`${C.info}10`, border:`1px solid ${C.info}30`, borderRadius: R.md, padding:"8px 10px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            {Ic.truck(C.info, 16)}
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.info }}>Necesita {freight.truckCount} camiones</div>
              <div style={{ fontSize:11, color:C.t2 }}>{alreadyAssigned + truckList.length} asignados · {Math.max(0, remainingSlots)} pendientes</div>
            </div>
          </div>
        )}
        {multiTruck && mode !== "delegate" && truckList.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.t2, marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Agregados ({truckList.length})</div>
            {truckList.map((tk, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 8px", borderRadius: R.sm, border:`1px solid ${C.b1}`, background:C.w, marginBottom:3 }}>
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
        {mode === "delegate" ? null : needsTransporter && remainingSlots > 0 ? (
          <>
            <div style={{ fontSize:10, fontWeight:600, color:C.t2, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Seleccioná un transportista</div>
            {loadingLinkedTs && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>Cargando...</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:280, overflowY:"auto" }}>
              {!loadingLinkedTs && displayTs.length === 0 && !showNewCompany && <div style={{ fontSize:12, color:C.t3, padding:8 }}>No hay transportistas disponibles</div>}
              {displayTs.map(x => (
                <button key={x.id} onClick={() => setT(x.id)} style={{ width:"100%", padding:"8px 10px", borderRadius: R.md, textAlign:"left", fontFamily:"inherit", border:`1px solid ${C.b1}`, background:C.bgCard, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:C.t1 }}>{x.name}</div>
                    {x.accessUsers?.length > 0 && <div style={{ fontSize:11, color:C.t3, marginTop:1 }}>{x.accessUsers.map(u => u.name).join(", ")}</div>}
                  </div>
                  {x.accessLevel === "READONLY" && <span style={{ fontSize:9, fontWeight:700, color:C.info, background:`${C.info}15`, padding:"2px 6px", borderRadius: R.xs, flexShrink:0 }}>CONSULTA</span>}
                </button>
              ))}
            </div>
            {/* Inline create transporter company (plant only) */}
            {isPlantUser && !showNewCompany && (
              <CreateBtn label="Crear empresa transportista" onClick={() => { setShowNewCompany(true); setCompanyErr(""); }} />
            )}
            {isPlantUser && showNewCompany && (
              <div style={{ border:`1.5px solid ${C.pri}`, borderRadius: R.md, padding:10, marginTop:4, background:`${C.pri}04` }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.pri, marginBottom:6 }}>Nueva empresa transportista</div>
                <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                  <div style={{ flex:2 }}><Field label="Nombre" value={newCompanyName} onChange={v => { setNewCompanyName(v); setCompanyErr(""); }} placeholder="Transporte SA" hasError={!!companyErr && !newCompanyName.trim()} /></div>
                  <div style={{ flex:1 }}><Field label="RUT (opcional)" value={newCompanyRut} onChange={setNewCompanyRut} placeholder="123456" /></div>
                </div>
                <div style={{ marginBottom:4 }}>
                  <label style={{ fontSize:10, fontWeight:600, color:C.t2, marginBottom:2, display:"block" }}>Nivel de acceso</label>
                  <div style={{ display:"flex", gap:0, borderRadius: R.sm, overflow:"hidden", border:`1px solid ${C.b1}` }}>
                    <button onClick={() => setNewCompanyAccess("OPERATOR")} style={{ flex:1, padding:"6px 0", fontSize:11, fontWeight:newCompanyAccess === "OPERATOR" ? 700 : 500, background:newCompanyAccess === "OPERATOR" ? C.pri : C.w, color:newCompanyAccess === "OPERATOR" ? C.w : C.t2, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Operador</button>
                    <button onClick={() => setNewCompanyAccess("READONLY")} style={{ flex:1, padding:"6px 0", fontSize:11, fontWeight:newCompanyAccess === "READONLY" ? 700 : 500, background:newCompanyAccess === "READONLY" ? C.info : C.w, color:newCompanyAccess === "READONLY" ? C.w : C.t2, border:"none", cursor:"pointer", fontFamily:"inherit", borderLeft:`1px solid ${C.b1}` }}>Consulta</button>
                  </div>
                </div>
                {companyErr && <div style={{ fontSize:11, color:C.err, fontWeight:600, marginTop:2 }}>{companyErr}</div>}
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  <button onClick={() => { setShowNewCompany(false); setNewCompanyName(""); setNewCompanyRut(""); setCompanyErr(""); }} style={{ flex:1, padding:"7px 0", borderRadius: R.sm, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                  <button disabled={savingCompany} onClick={handleCreateCompany} style={{ flex:1, padding:"7px 0", borderRadius: R.sm, border:"none", background:C.pri, color:C.tOn, fontSize:12, fontWeight:600, cursor:savingCompany ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingCompany ? 0.6 : 1 }}>{savingCompany ? "Creando..." : "Crear"}</button>
                </div>
              </div>
            )}
          </>
        ) : remainingSlots > 0 ? (
          <>
            {/* Company badge */}
            {mode === "company" && t && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius: R.sm, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:10 }}>
                {Ic.truck(C.t3, 12)}
                <span style={{ fontSize:12, fontWeight:600, color:C.t1, flex:1 }}>{displayTs.find(x => x.id === t)?.name || ts.find(x => x.id === t)?.name || ""}</span>
                {isConsultaFlow && <span style={{ fontSize:9.5, fontWeight:700, color:C.info, background:`${C.info}15`, padding:"2px 6px", borderRadius: R.xs }}>CONSULTA</span>}
                <button onClick={() => { setT(""); setTruckId(""); setDriverId(""); setStep(0); setTransporterIsConsulta(false); }} style={{ background:"none", border:`1px solid ${C.b2}`, borderRadius: R.xs, padding:"2px 6px", fontSize:10, fontWeight:600, color:C.pri, cursor:"pointer", fontFamily:"inherit" }}>Cambiar</button>
              </div>
            )}
            {/* CONSULTA banner */}
            {isConsultaFlow && (
              <div style={{ padding:"8px 10px", background:`${C.info}10`, border:`1px solid ${C.info}30`, borderRadius: R.md, marginBottom:10, fontSize:11.5, color:C.info, fontWeight:500 }}>
                Este transportista está en modo consulta. Seleccioná vehículo y chofer. La asignación se confirma automáticamente.
              </div>
            )}

            {!isDelegation && <Stepper steps={stepLabels} current={step} />}

            {/* =================== STEP 0: VEHICLE (own fleet only) =================== */}
            {!isDelegation && step === 0 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:8 }}>Seleccionar vehículo</div>
                <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:320, overflowY:"auto", marginBottom:6 }}>
                  {loadingTrucks && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>Cargando...</div>}
                  {!loadingTrucks && trucks.length === 0 && !showNewTruck && <div style={{ fontSize:12, color: loadError ? C.err : C.t3, padding:8, textAlign:"center" }}>{loadError || "No hay vehículos"}</div>}
                  {trucks.map(tk => (
                    <TruckRow key={tk.id} tk={tk} selected={truckId === tk.id} onClick={() => setTruckId(truckId === tk.id ? "" : tk.id)} />
                  ))}
                </div>

                {!showNewTruck ? (
                  <CreateBtn label="Crear nuevo vehículo" onClick={() => { setShowNewTruck(true); setTruckErr(""); }} />
                ) : showNewTruck ? (
                  <div style={{ border:`1.5px solid ${C.pri}`, borderRadius: R.md, padding:10, marginBottom:6, background:`${C.pri}04` }}>
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
                      <button onClick={() => { setShowNewTruck(false); setNewPlate(""); setNewBrand(""); setNewModel(""); setNewCapacity(""); setTruckErr(""); }} style={{ flex:1, padding:"7px 0", borderRadius: R.sm, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                      <button disabled={savingTruck} onClick={handleCreateTruck} style={{ flex:1, padding:"7px 0", borderRadius: R.sm, border:"none", background:C.pri, color:C.tOn, fontSize:12, fontWeight:600, cursor:savingTruck ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingTruck ? 0.6 : 1 }}>{savingTruck ? "Creando..." : "Crear"}</button>
                    </div>
                  </div>
                ) : null}

                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
                  <button disabled={!truckId} onClick={() => setStep(1)} style={btnNext(!!truckId)}>Siguiente →</button>
                </div>
              </div>
            )}

            {/* =================== STEP 1: DRIVER (own fleet only) =================== */}
            {!isDelegation && step === 1 && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:8 }}>Seleccionar chofer</div>

                {user && !isConsultaFlow && !isPlantUser && <DriverRow d={{ name: user.name, phone: user.phone }} selected={driverId === user.id} isMe onClick={() => setDriverId(driverId === user.id ? "" : user.id)} />}

                <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:320, overflowY:"auto", marginBottom:6 }}>
                  {loadingDrivers && <div style={{ fontSize:12, color:C.t3, padding:8, textAlign:"center" }}>Cargando...</div>}
                  {!loadingDrivers && drivers.length === 0 && !showNewDriver && !user && <div style={{ fontSize:12, color: loadError ? C.err : C.t3, padding:8, textAlign:"center" }}>{loadError || "No hay choferes"}</div>}
                  {drivers.filter(d => d.id !== user?.id).map(d => (
                    <DriverRow key={d.id} d={d} selected={driverId === d.id} onClick={() => setDriverId(driverId === d.id ? "" : d.id)} />
                  ))}
                </div>

                {!showNewDriver ? (
                  <CreateBtn label="Crear chofer" onClick={() => { setShowNewDriver(true); setDriverErr(""); }} />
                ) : showNewDriver ? (
                  <div style={{ border:`1.5px solid ${C.pri}`, borderRadius: R.md, padding:10, marginBottom:6, background:`${C.pri}04` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.pri, marginBottom:6 }}>Nuevo chofer</div>
                    <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                      <div style={{ flex:1 }}><Field label="Nombre" value={newDriverName} onChange={v => { setNewDriverName(v); setDriverErr(""); }} placeholder="Juan Pérez" hasError={!!driverErr} /></div>
                      <div style={{ flex:1 }}><Field label="Teléfono" value={newDriverPhone} onChange={setNewDriverPhone} placeholder="099123456" /></div>
                    </div>
                    {driverErr && <div style={{ fontSize:11, color:C.err, fontWeight:600, marginTop:2 }}>{driverErr}</div>}
                    <div style={{ display:"flex", gap:6, marginTop:8 }}>
                      <button onClick={() => { setShowNewDriver(false); setNewDriverName(""); setNewDriverPhone(""); setDriverErr(""); }} style={{ flex:1, padding:"7px 0", borderRadius: R.sm, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                      <button disabled={savingDriver} onClick={handleCreateDriver} style={{ flex:1, padding:"7px 0", borderRadius: R.sm, border:"none", background:C.pri, color:C.tOn, fontSize:12, fontWeight:600, cursor:savingDriver ? "not-allowed" : "pointer", fontFamily:"inherit", opacity:savingDriver ? 0.6 : 1 }}>{savingDriver ? "Creando..." : "Crear"}</button>
                    </div>
                  </div>
                ) : null}

                <div style={{ display:"flex", justifyContent:"space-between", marginTop:12 }}>
                  <button onClick={() => setStep(0)} style={btnPrev}>← Anterior</button>
                  <button onClick={() => setStep(2)} style={btnNext(true)}>{driverId ? "Siguiente →" : "Omitir →"}</button>
                </div>
              </div>
            )}

            {/* =================== TONS + CONFIRM (delegation: step 0, own fleet: step 2) =================== */}
            {((isDelegation && step === 0) || (!isDelegation && step === 2)) && (
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.t1, marginBottom:10 }}>Toneladas</div>

                {/* Truck/driver summary — only for own fleet mode */}
                {!isDelegation && (
                  <div style={{ padding:"8px 10px", borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.bg, marginBottom:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      {Ic.truck(C.t1, 14)}
                      <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{selTruck?.plate || ""}{selTruck?.model ? ` · ${selTruck.model}` : ""}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {Ic.user(C.t1, 14)}
                      <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{selDriver?._isMe ? `${selDriver.name} (yo)` : selDriver?.name || ""}</span>
                    </div>
                  </div>
                )}

                {isDelegation && (
                  <div style={{ fontSize:12, color:C.t3, marginBottom:10 }}>El transportista asignará vehículo y chofer.</div>
                )}

                <label style={{ fontSize:11, fontWeight:600, color:C.t2, marginBottom:4, display:"block" }}>Toneladas a transportar</label>
                <input type="number" min="0" step="0.1" value={tonsInput} onChange={e => setTonsInput(e.target.value)}
                  placeholder={defaultTons > 0 ? String(defaultTons) : ""}
                  style={{ width:"100%", fontSize:16, textAlign:"center", padding:"10px 12px", border:`1px solid ${C.b1}`, borderRadius: R.md, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                />
                {!isDelegation && truckCapacity && <div style={{ fontSize:10, color:C.t3, textAlign:"center", marginTop:3 }}>Capacidad: {truckCapacity} tn</div>}

                <div style={{ display:"flex", justifyContent:isDelegation ? "flex-end" : "space-between", marginTop:12, gap:8 }}>
                  {!isDelegation && <button onClick={() => setStep(1)} style={btnPrev}>← Anterior</button>}
                  {multiTruck && remainingSlots > 1 ? (
                    <div style={{ display:"flex", gap:6 }}>
                      <button disabled={!parseFloat(tonsInput)} onClick={addAndContinue} style={{ background:"transparent", border:`1px solid ${C.pri}`, color:C.pri, borderRadius: R.md, padding:"8px 12px", fontSize:12, fontWeight:500, cursor: parseFloat(tonsInput) ? "pointer" : "default", fontFamily:"inherit" }}>+ Otro</button>
                      <button disabled={!(parseFloat(tonsInput) > 0) || loading} onClick={doConfirm} style={btnNext(parseFloat(tonsInput) > 0)}>{loading ? "..." : "Confirmar"}</button>
                    </div>
                  ) : (
                    <button disabled={!(parseFloat(tonsInput) > 0) || loading} onClick={doConfirm} style={btnNext(parseFloat(tonsInput) > 0)}>{loading ? "Asignando..." : isConsultaFlow ? "Asignar y confirmar" : "Confirmar"}</button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : multiTruck && truckList.length > 0 ? (
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <button onClick={safeClose} style={{ flex:1, padding:"8px 0", borderRadius: R.md, border:`1px solid ${C.b1}`, background:C.w, color:C.t2, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
            <button disabled={loading} onClick={async () => {
              setLoading(true);
              const msg = await onAssignMulti(truckList.map(e => ({ transportCompanyId: e.transportCompanyId, truckId: e.truckId, driverId: e.driverId, tons: e.tons })));
              setLoading(false);
              if (msg) { setClosingText(msg); setClosing(true); }
            }} style={{ flex:1, padding:"8px 0", borderRadius: R.md, border:"none", background:C.pri, color:C.tOn, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
              {loading ? "..." : `Asignar ${truckList.length} camiones`}
            </button>
          </div>
        ) : null}

    </ModalOverlay>
  );
}
