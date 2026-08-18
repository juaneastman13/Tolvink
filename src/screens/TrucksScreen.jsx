import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { C, Ic, R } from "../theme";
const BpsCertificadosAssistant = lazy(() => import("../components/BpsCertificadosAssistant"));
import { Btn, Field, Loader, LoadingOverlay, EmptyState, LicensePlate } from "../components";
import { apiGetTrucks, apiCreateTruck, apiDeactivateTruck, apiListDrivers, apiCreateDriver, apiDeactivateDriver, apiGetCompanyAccess, apiGetExpiringDocs, apiGetFleetSummary, apiExportFleetReport } from "../api";
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
  // Fleet summary
  const [fleetSummary, setFleetSummary] = useState(null);
  const [exporting, setExporting] = useState(false);

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
      const [t, expDocs, fs] = await Promise.all([
        apiGetTrucks(selectedCompanyId || user?.activeCompanyId || undefined),
        apiGetExpiringDocs(30).catch(() => []),
        apiGetFleetSummary().catch(() => null),
      ]);
      setFleetSummary(fs);
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

  const [showBps, setShowBps] = useState(false); // BPS certificate assistant modal
  const [editTruck, setEditTruck] = useState(null); // truck being edited
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

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

  const handleExportFleet = async () => {
    setExporting(true);
    try { await apiExportFleetReport(); setMsg({ k: "ok", t: "Informe descargado" }); }
    catch (e) { setMsg({ k: "err", t: e.message || "Error al exportar" }); }
    finally { setExporting(false); }
  };

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:undefined }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      {!embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Menú</button></div>}
      <div style={{ padding: embedded?0:"0 18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>{selectedCompanyId ? "Flota" : "Mi Flota"}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowBps(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: R.lg, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{Ic.shield(C.pri, 14)} BPS</button>
          {trucks.length > 0 && <button onClick={handleExportFleet} disabled={exporting} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: R.lg, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: exporting ? "wait" : "pointer", opacity: exporting ? 0.6 : 1 }}>{exporting ? Ic.loader?.(C.t2, 14) || "..." : Ic.download(C.pri, 14)} {exporting ? "Exportando..." : "Excel"}</button>}
          {canEdit && <Btn sm onClick={() => { setShowForm(!showForm); setMsg(null); }} icon={showForm ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showForm ? "Cerrar" : "Agregar"}</Btn>}
        </div>
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
        {/* Fleet summary card */}
        {!loading && trucks.length > 0 && fleetSummary && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 14, marginBottom: 14, boxShadow: C.sh }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Resumen del mes</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 70, textAlign: "center", padding: "6px 4px", background: C.bg, borderRadius: R.md }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.ok }}>${Number(fleetSummary.totalIncome || 0).toLocaleString("es-UY")}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>Ingresos</div>
              </div>
              <div style={{ flex: 1, minWidth: 70, textAlign: "center", padding: "6px 4px", background: C.bg, borderRadius: R.md }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.err }}>${Number(fleetSummary.totalExpense || 0).toLocaleString("es-UY")}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>Gastos</div>
              </div>
              <div style={{ flex: 1, minWidth: 70, textAlign: "center", padding: "6px 4px", background: C.bg, borderRadius: R.md }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: (fleetSummary.net || 0) >= 0 ? C.ok : C.err }}>${Number(fleetSummary.net || 0).toLocaleString("es-UY")}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>Resultado</div>
              </div>
              <div style={{ flex: 1, minWidth: 60, textAlign: "center", padding: "6px 4px", background: C.bg, borderRadius: R.md }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>{Number(fleetSummary.totalKm || 0).toLocaleString("es-UY")}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>Km</div>
              </div>
            </div>
            {fleetSummary.bestTruck && <div style={{ fontSize: 11, color: C.pri, fontWeight: 600, marginTop: 8 }}>Mejor resultado: {fleetSummary.bestTruck.plate} (${Number(fleetSummary.bestTruck.net).toLocaleString("es-UY")})</div>}
          </div>
        )}

        {loading ? <Loader/> :
          trucks.length === 0 ? <EmptyState icon={Ic.truck(C.t3,28)} title="Sin vehículos registrados" subtitle={selectedCompanyId ? "Esta empresa aún no tiene camiones registrados" : "Registrá tu primer camión para recibir asignaciones de flete"} action={canEdit && <Btn sm onClick={()=>setShowForm(true)}>Registrar camión</Btn>}/> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trucks.map(t => {
                const ownerName = t.ownerCompanyId && companyNameMap[t.ownerCompanyId];
                const alert = docAlerts[t.id];
                const truckEco = fleetSummary?.trucks?.find(ft => ft.id === t.id);
                const isLinked = t.ownerCompanyId && t.companyId !== (user?.activeCompanyId || user?.companyId);
                return (
                  <div key={t.id} onClick={() => !isLinked && onTruckClick?.(t.id)} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: "12px 14px", boxShadow: C.sh, display: "flex", alignItems: "center", gap: 12, cursor: !isLinked && onTruckClick ? "pointer" : "default" }}>
                    <LicensePlate plate={t.plate} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        {t.model && <span style={{ fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{t.model}</span>}
                        {isLinked && <span style={{ fontSize: 9.5, fontWeight: 700, color: C.sec, background: C.secPale, padding: "1px 6px", borderRadius: R.pill }}>Vinculado</span>}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop: 3 }}>
                        {t.assignedUser && <span style={{ fontSize: 11.5, color: C.pri, fontWeight: 600 }}>{Ic.user(C.pri,11)} {t.assignedUser.name}</span>}
                        <span style={{ fontSize: 10.5, color: t.active ? C.ok : C.t3 }}>● {t.active ? "Activo" : "Inactivo"}</span>
                      </div>
                      {!isLinked && (
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3, flexWrap:"wrap" }}>
                          {alert?.expired > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.err, background: C.errPale, padding: "1px 6px", borderRadius: R.pill }}>{alert.expired} venc.</span>}
                          {alert?.expiring > 0 && !alert?.expired && <span style={{ fontSize: 10, fontWeight: 700, color: C.warn, background: C.warnPale, padding: "1px 6px", borderRadius: R.pill }}>{alert.expiring} por vencer</span>}
                          {truckEco?.net !== 0 && truckEco && <span style={{ fontSize: 10, fontWeight: 700, color: truckEco.net >= 0 ? C.ok : C.err }}>${Number(truckEco.net).toLocaleString("es-UY")}</span>}
                          {truckEco?.km > 0 && <span style={{ fontSize: 10, color: C.t3 }}>{Number(truckEco.km).toLocaleString("es-UY")} km</span>}
                        </div>
                      )}
                      {ownerName && !selectedCompanyId && <div style={{ fontSize: 10.5, color: C.info, fontWeight: 600, marginTop: 2 }}>{ownerName}</div>}
                    </div>
                    {canEdit && !isLinked && <button aria-label="Editar camión" onClick={(e) => { e.stopPropagation(); setEditTruck(t); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, opacity: 0.6 }}>{Ic.edit(C.t2, 16)}</button>}
                    {!isLinked && onTruckClick && <span style={{ opacity: 0.3 }}>{Ic.chev(C.t3, 14)}</span>}
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
                <div key={d.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, boxShadow: C.sh, overflow: "hidden" }}>
                  <div style={{ position: "relative", padding: "14px 14px 14px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div aria-hidden="true" style={{ position: "absolute", left: 6, top: "25%", height: "50%", width: 10, background: C.info || C.sec, borderRadius: 999, pointerEvents: "none" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {Ic.user(C.info||C.sec, 20)}
                    <div>
                      <div style={{ fontSize: 15.4, fontWeight: 700 }}>{d.name}</div>
                      {d.phone && <div style={{ fontSize: 12.1, color: C.t3 }}>{d.phone}</div>}
                    </div>
                  </div>
                  {canEdit && <button aria-label="Desactivar chofer" disabled={saving} onClick={() => handleDeactivateDriver(d.id)} style={{ background: "none", border: "none", cursor: saving?"not-allowed":"pointer", padding: 6, opacity:saving?0.4:1 }}>{Ic.ban(C.err, 18)}</button>}
                  </div>
                </div>
              ))}
            </div>
        }
      </>}
      </div>

      {/* Edit truck modal */}
      {editTruck && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => { setEditTruck(null); setConfirmDeactivate(false); }}>
          <div style={{ background: C.w, borderRadius: R.xl, padding: 24, maxWidth: 380, width: "90%", boxShadow: C.shLg }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Camión</div>
              <button onClick={() => { setEditTruck(null); setConfirmDeactivate(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <LicensePlate plate={editTruck.plate} size="lg" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.bg, borderRadius: R.md }}>
                <span style={{ fontSize: 13, color: C.t3 }}>Modelo</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{editTruck.model || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.bg, borderRadius: R.md }}>
                <span style={{ fontSize: 13, color: C.t3 }}>Chofer</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{editTruck.assignedUser?.name || "Sin asignar"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: C.bg, borderRadius: R.md }}>
                <span style={{ fontSize: 13, color: C.t3 }}>Estado</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: editTruck.active ? C.ok : C.t3 }}>● {editTruck.active ? "Activo" : "Inactivo"}</span>
              </div>
            </div>

            {!confirmDeactivate ? (
              <button onClick={() => setConfirmDeactivate(true)} style={{ width: "100%", padding: "10px 0", background: "none", border: `1px solid ${C.err}`, borderRadius: R.md, color: C.err, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Desactivar camión</button>
            ) : (
              <div style={{ padding: 14, background: C.errPale, borderRadius: R.md, border: `1px solid ${C.err}20` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.err, marginBottom: 6 }}>¿Estás seguro?</div>
                <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>Esta acción no se puede deshacer. El camión dejará de aparecer en la lista.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmDeactivate(false)} style={{ flex: 1, padding: "8px 0", background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.md, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: C.t2 }}>Cancelar</button>
                  <button disabled={saving} onClick={async () => { await handleDeactivateTruck(editTruck.id); setEditTruck(null); setConfirmDeactivate(false); }} style={{ flex: 1, padding: "8px 0", background: C.err, border: "none", borderRadius: R.md, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: C.w }}>Confirmar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showBps && <Suspense fallback={null}><BpsCertificadosAssistant onClose={() => setShowBps(false)} /></Suspense>}
    </div>
  );
}
