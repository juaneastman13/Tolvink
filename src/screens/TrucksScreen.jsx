import { useState, useCallback, useEffect } from "react";
import { C, Ic, R } from "../theme";
import { Btn, Field, Loader, LoadingOverlay, EmptyState, LicensePlate } from "../components";
import { apiGetTrucks, apiCreateTruck, apiDeactivateTruck, apiListDrivers, apiCreateDriver, apiDeactivateDriver, apiGetCompanyAccess, apiGetExpiringDocs } from "../api";
import { useCatalogStore } from "../store";

export default function TrucksScreen({ onBack, embedded, user, onTruckClick }) {
  const canEdit = !user || user.role !== "chofer";
  const isManager = ["admin","gerente","platform_admin"].includes(user?.role);
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

  // Document expiry alerts per truck: { truckId: { expired: N, expiring: N } }
  const [docAlerts, setDocAlerts] = useState({});

  // Cross-company: plant selects whose fleet to view
  const [linkedCompanies, setLinkedCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(""); // "" = my fleet

  // Load linked companies for hub dropdown (any admin/gerente)
  useEffect(() => {
    if (!isManager || !user?.activeCompanyId) return;
    apiGetCompanyAccess(user.activeCompanyId)
      .then(data => {
        // Show all active linked companies (transporters + producers)
        const relevant = (data || []).filter(r => r.isActive);
        setLinkedCompanies(relevant);
      })
      .catch(() => {});
  }, [isManager, user?.activeCompanyId]);

  const loadTrucks = useCallback(async () => {
    try {
      const [t, expDocs] = await Promise.all([
        apiGetTrucks(selectedCompanyId || user?.activeCompanyId || undefined),
        apiGetExpiringDocs(30).catch(() => []),
      ]);
      setTrucks(t || []);
      // Build alerts map: truckId → { expired, expiring }
      const alerts = {};
      const now = new Date();
      for (const d of (expDocs || [])) {
        const tid = d.truck?.id || d.truckId;
        if (!tid) continue;
        if (!alerts[tid]) alerts[tid] = { expired: 0, expiring: 0 };
        if (d.expiryStatus === 'expired' || (d.expiresAt && new Date(d.expiresAt) < now)) alerts[tid].expired++;
        else alerts[tid].expiring++;
      }
      setDocAlerts(alerts);
    } catch (e) { setMsg({ t: e.message || "Error al cargar flota", k: "err" }); }
    finally { setLoading(false); }
  }, [selectedCompanyId]);

  const loadDrivers = useCallback(async () => {
    try { const d = await apiListDrivers(selectedCompanyId || user?.activeCompanyId || undefined); setDrivers(d||[]); } catch(e) { setMsg({t:e.message||"Error al cargar choferes",k:"err"}); } finally { setLoading(false); }
  }, [selectedCompanyId, user?.activeCompanyId]);

  useEffect(() => { setLoading(true); if(tab==="trucks") loadTrucks(); else loadDrivers(); }, [tab, loadTrucks, loadDrivers]);

  const handleCreateTruck = async () => {
    if (!plate.trim()) { setMsg({ t: "Patente obligatoria", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateTruck({
        plate: plate.trim().toUpperCase(),
        model: model.trim() || undefined,
        ...(selectedCompanyId ? { ownerCompanyId: selectedCompanyId } : {}),
      });
      setPlate(""); setModel(""); setShowForm(false); setDoneMsg("Camión registrado");
      useCatalogStore.getState().clearCache();
      await loadTrucks();
    } catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  const handleDeactivateTruck = async (id) => {
    if(saving||doneMsg) return;
    setSaving(true);
    try { await apiDeactivateTruck(id); setDoneMsg("Camión eliminado"); useCatalogStore.getState().clearCache(); await loadTrucks(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  const handleCreateDriver = async () => {
    if (!dName.trim()) { setMsg({ t: "Nombre obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateDriver({ name: dName.trim(), phone: dPhone.trim() || undefined }, selectedCompanyId || undefined);
      setDName(""); setDPhone(""); setShowForm(false); setDoneMsg("Chofer registrado");
      useCatalogStore.getState().clearCache();
      await loadDrivers();
    } catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  const handleDeactivateDriver = async (id) => {
    if(saving||doneMsg) return;
    setSaving(true);
    try { await apiDeactivateDriver(id); setDoneMsg("Chofer eliminado"); await loadDrivers(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); }
    finally { setSaving(false); }
  };

  const switchTab = (t) => { setTab(t); setShowForm(false); setMsg(null); setLoading(true); };

  const handleCompanyChange = (companyId) => {
    setSelectedCompanyId(companyId);
    setShowForm(false);
    setMsg(null);
    setLoading(true);
  };

  // Resolve company name for badge on trucks
  const selectedCompanyName = selectedCompanyId
    ? linkedCompanies.find(r => (r.granteeCompanyId || r.granteeCompany?.id) === selectedCompanyId)?.granteeCompany?.name || ""
    : "";

  // Build company name map for badges
  const companyNameMap = {};
  for (const r of linkedCompanies) {
    const cId = r.granteeCompanyId || r.granteeCompany?.id;
    if (cId) companyNameMap[cId] = r.granteeCompany?.name || "";
  }

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:undefined }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      {!embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Menú</button></div>}
      <div style={{ padding: embedded?0:"0 18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>{selectedCompanyId ? "Flota" : "Mi Flota"}</div>
        {canEdit && <Btn sm onClick={() => { setShowForm(!showForm); setMsg(null); }} icon={showForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showForm ? "Cerrar" : "Agregar"}</Btn>}
      </div>

      {/* Plant: company dropdown */}
      {isManager && linkedCompanies.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <select
            value={selectedCompanyId}
            onChange={e => handleCompanyChange(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 13.2, fontFamily: "inherit", background: C.w, color: C.t1 }}
          >
            <option value="">Mi flota</option>
            {linkedCompanies.map(r => {
              const co = r.granteeCompany || {};
              const cId = r.granteeCompanyId || co.id;
              return <option key={cId} value={cId}>{co.name || "Empresa"} ({r.granteeType === "TRANSPORTER" ? "Transportista" : "Productor"})</option>;
            })}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:16, borderRadius: R.md, overflow:"hidden", border:`1.5px solid ${C.b1}` }}>
        <button onClick={()=>switchTab("trucks")} style={{ flex:1, padding:"9px 0", fontFamily:"inherit", fontSize:13.8, fontWeight:tab==="trucks"?700:500, background:tab==="trucks"?C.acc:C.w, color:tab==="trucks"?C.w:C.t2, border:"none", cursor:"pointer" }}>Vehículos</button>
        <button onClick={()=>switchTab("drivers")} style={{ flex:1, padding:"9px 0", fontFamily:"inherit", fontSize:13.8, fontWeight:tab==="drivers"?700:500, background:tab==="drivers"?C.acc:C.w, color:tab==="drivers"?C.w:C.t2, border:"none", cursor:"pointer", borderLeft:`1px solid ${C.b1}` }}>Choferes</button>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: R.lg, marginBottom: 12, fontSize: 13.2, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {/* ========== TRUCKS TAB ========== */}
      {tab === "trucks" && <>
        {showForm && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
            {selectedCompanyId && <div style={{ fontSize: 12.1, fontWeight: 600, color: C.info, marginBottom: 8 }}>Creando para: {selectedCompanyName}</div>}
            <Field label="Patente" value={plate} onChange={setPlate} placeholder="Ej: AB-123-CD" />
            <div style={{ height: 10 }} />
            <Field label="Modelo (opcional)" value={model} onChange={setModel} placeholder="Ej: Scania R500" />
            <div style={{ height: 12 }} />
            <Btn full v="acc" disabled={saving} onClick={handleCreateTruck}>{saving ? "Guardando..." : "Registrar camión"}</Btn>
          </div>
        )}
        {loading ? <Loader/> :
          trucks.length === 0 ? <EmptyState icon={Ic.truck(C.t3,28)} title="Sin vehículos registrados" subtitle={selectedCompanyId ? "Esta empresa aún no tiene camiones registrados" : "Registrá tu primer camión para recibir asignaciones de flete"} action={canEdit && <Btn sm onClick={()=>setShowForm(true)}>Registrar camión</Btn>}/> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trucks.map(t => {
                const ownerName = t.ownerCompanyId && companyNameMap[t.ownerCompanyId];
                const alert = docAlerts[t.id];
                return (
                  <div key={t.id} onClick={() => onTruckClick?.(t.id)} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${alert?.expired ? C.err : alert?.expiring ? C.warn : C.acc}`, borderRadius: R.lg, padding: 14, boxShadow: C.sh, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: onTruckClick ? "pointer" : "default" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {Ic.truck(C.acc, 20)}
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <LicensePlate plate={t.plate} size="md" />
                          {t.assignedUser && <span style={{ fontSize: 11.5, color: C.pri, fontWeight: 600 }}>{t.assignedUser.name}</span>}
                          {alert?.expired > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.err, background: C.errPale, padding: "1px 6px", borderRadius: R.pill }}>{alert.expired} venc.</span>}
                          {alert?.expiring > 0 && !alert?.expired && <span style={{ fontSize: 10, fontWeight: 700, color: C.warn, background: C.warnPale, padding: "1px 6px", borderRadius: R.pill }}>{alert.expiring} por vencer</span>}
                        </div>
                        {t.model && <div style={{ fontSize: 12.1, color: C.t3, marginTop: 2 }}>{t.model}</div>}
                        {ownerName && !selectedCompanyId && <div style={{ fontSize: 10.5, color: C.info, fontWeight: 600, marginTop: 2 }}>{ownerName}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {canEdit && <button aria-label="Desactivar camión" disabled={saving} onClick={(e) => { e.stopPropagation(); handleDeactivateTruck(t.id); }} style={{ background: "none", border: "none", cursor: saving?"not-allowed":"pointer", padding: 6, opacity:saving?0.4:1 }}>{Ic.ban(C.err, 18)}</button>}
                      {onTruckClick && <span style={{ opacity: 0.4 }}>{Ic.chev(C.t3, 14)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </>}

      {/* ========== DRIVERS TAB ========== */}
      {tab === "drivers" && <>
        {showForm && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
            <Field label="Nombre" value={dName} onChange={setDName} placeholder="Ej: Juan Pérez" />
            <div style={{ height: 10 }} />
            <Field label="Teléfono (opcional)" value={dPhone} onChange={setDPhone} placeholder="Ej: 099123456" />
            <div style={{ height: 12 }} />
            <Btn full v="acc" disabled={saving} onClick={handleCreateDriver}>{saving ? "Guardando..." : "Registrar chofer"}</Btn>
          </div>
        )}
        {loading ? <Loader/> :
          drivers.length === 0 ? <EmptyState icon={Ic.user(C.t3,28)} title="Sin choferes registrados" subtitle="Agregá choferes para asignarles viajes" action={canEdit && <Btn sm onClick={()=>{switchTab("drivers");setShowForm(true);}}>Registrar chofer</Btn>}/> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {drivers.map(d => (
                <div key={d.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${C.info||C.sec}`, borderRadius: R.lg, padding: 14, boxShadow: C.sh, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {Ic.user(C.info||C.sec, 20)}
                    <div>
                      <div style={{ fontSize: 15.4, fontWeight: 700 }}>{d.name}</div>
                      {d.phone && <div style={{ fontSize: 12.1, color: C.t3 }}>{d.phone}</div>}
                    </div>
                  </div>
                  {canEdit && <button aria-label="Desactivar chofer" disabled={saving} onClick={() => handleDeactivateDriver(d.id)} style={{ background: "none", border: "none", cursor: saving?"not-allowed":"pointer", padding: 6, opacity:saving?0.4:1 }}>{Ic.ban(C.err, 18)}</button>}
                </div>
              ))}
            </div>
        }
      </>}
      </div>
    </div>
  );
}
