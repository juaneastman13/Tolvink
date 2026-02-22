import { useState, useEffect } from "react";
import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";
import { apiGetTrucks, apiGetDrivers } from "../api";

export default function EditTripModal({ freight, assignment, transporters, onClose, onSave }) {
  const [companyId, setCompanyId] = useState(assignment.transportCompanyId || "");
  const [truckId, setTruckId] = useState(assignment.truckId || "");
  const [driverId, setDriverId] = useState(assignment.driverId || "");
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingTrucks, setLoadingTrucks] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingText, setClosingText] = useState("");

  const isOwnFleet = assignment.transportCompanyId === freight.originCompanyId;

  const loadTrucks = (cid) => {
    if (!cid) return;
    setLoadingTrucks(true);
    apiGetTrucks(cid).then(r => setTrucks((r || []).filter(t => t.active !== false))).catch(() => setTrucks([])).finally(() => setLoadingTrucks(false));
  };
  const loadDriversFn = (cid) => {
    if (!cid) return;
    setLoadingDrivers(true);
    apiGetDrivers(cid).then(r => setDrivers(r || [])).catch(() => setDrivers([])).finally(() => setLoadingDrivers(false));
  };

  // Load trucks/drivers for current company on mount
  useEffect(() => {
    if (companyId) { loadTrucks(companyId); loadDriversFn(companyId); }
  }, []);

  // When company changes, reload trucks/drivers and reset selection
  const handleCompanyChange = (newId) => {
    setCompanyId(newId);
    setTruckId("");
    setDriverId("");
    if (newId) { loadTrucks(newId); loadDriversFn(newId); }
    else { setTrucks([]); setDrivers([]); }
  };

  // Pre-select driver from truck's assignedUser
  useEffect(() => {
    if (truckId) {
      const tk = trucks.find(x => x.id === truckId);
      if (tk?.assignedUser?.id) {
        const d = drivers.find(x => x.id === tk.assignedUser.id);
        if (d) setDriverId(tk.assignedUser.id);
      }
    }
  }, [truckId]);

  const hasChanges = companyId !== (assignment.transportCompanyId || "") || truckId !== (assignment.truckId || "") || driverId !== (assignment.driverId || "");

  const doSave = async () => {
    if (loading || closing || !hasChanges) return;
    setLoading(true);
    const data = {};
    if (companyId !== assignment.transportCompanyId) data.transportCompanyId = companyId;
    if (truckId !== (assignment.truckId || "")) data.truckId = truckId || null;
    if (driverId !== (assignment.driverId || "")) data.driverId = driverId || null;
    const msg = await onSave(data);
    setLoading(false);
    if (msg) { setClosingText(msg); setClosing(true); }
  };

  const sel = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.b1}`, fontSize: 13, fontFamily: "inherit", background: C.w, color: C.t1, boxSizing: "border-box", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 30, cursor: "pointer" };
  const lbl = { fontSize: 10.5, fontWeight: 600, color: C.t3, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: 0.5 };
  const externalTs = (transporters || []).filter(x => x.id !== freight.originCompanyId);

  return (
    <ModalOverlay onClose={onClose} maxWidth={400} loading={loading} closing={closing} closingText={closingText}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {Ic.doc(C.pri, 20)}
        <span style={{ fontSize: 17, fontWeight: 700 }}>Editar viaje #{assignment.tripNumber}</span>
      </div>
      <div style={{ fontSize: 12, color: C.t2, marginBottom: 18 }}>{freight.code} · {freight.grain} · {freight.tons}tn</div>

      {/* Transporter selector (skip for own-fleet) */}
      {!isOwnFleet && <>
        <label style={lbl}>Empresa transportista</label>
        <select value={companyId} onChange={e => handleCompanyChange(e.target.value)} style={{ ...sel, marginBottom: 12 }}>
          <option value="">Seleccionar...</option>
          {externalTs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </>}

      {/* Truck selector */}
      <label style={lbl}>Camión</label>
      <select value={truckId} onChange={e => setTruckId(e.target.value)} disabled={loadingTrucks || !companyId} style={{ ...sel, marginBottom: 12, opacity: loadingTrucks ? 0.6 : 1 }}>
        <option value="">{loadingTrucks ? "Cargando..." : "Sin camión asignado"}</option>
        {trucks.map(tk => <option key={tk.id} value={tk.id}>{tk.plate}{tk.model ? ` · ${tk.model}` : ""}</option>)}
      </select>

      {/* Driver selector */}
      <label style={lbl}>Chofer</label>
      <select value={driverId} onChange={e => setDriverId(e.target.value)} disabled={loadingDrivers || !companyId} style={{ ...sel, marginBottom: 18, opacity: loadingDrivers ? 0.6 : 1 }}>
        <option value="">{loadingDrivers ? "Cargando..." : "Sin chofer asignado"}</option>
        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.phone ? ` · ${d.phone}` : ""}</option>)}
      </select>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn full v="ghost" onClick={onClose} disabled={loading || closing}>Cancelar</Btn>
        <Btn full disabled={!hasChanges || loading || closing} onClick={doSave}>{loading ? "Guardando..." : "Guardar cambios"}</Btn>
      </div>
    </ModalOverlay>
  );
}
