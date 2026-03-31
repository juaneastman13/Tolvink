import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C, R, FONT, Ic } from "../../theme";
import { apiGetTemplateBrands, apiGetTemplateSeries, apiListTemplates, apiCreateMachine, apiAddModification, apiAddRepair } from "../../api";

const MACHINE_TYPES = [
  { value: "tractor", label: "Tractor" }, { value: "harvester", label: "Cosechadora" },
  { value: "seeder", label: "Sembradora" }, { value: "baler", label: "Enfardadora" },
  { value: "implement", label: "Implemento" }, { value: "truck", label: "Camión" },
  { value: "car", label: "Auto" }, { value: "motorcycle", label: "Moto" }, { value: "other", label: "Otro" },
];

const STEPS = ["Identificación", "Datos técnicos", "Fotografías", "Historial previo", "Confirmación"];

function StepIndicator({ current }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: R.full, display: "flex", alignItems: "center", justifyContent: "center",
            background: i <= current ? C.pri : C.bgCardAlt, color: i <= current ? C.tOn : C.t3,
            fontSize: 12, fontWeight: 700, fontFamily: FONT,
          }}>{i + 1}</div>
          {i < STEPS.length - 1 && <div style={{ width: 20, height: 2, background: i < current ? C.pri : C.b1 }} />}
        </div>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", required }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2, fontFamily: FONT }}>
      {label}{required && <span style={{ color: C.err }}> *</span>}
      <input value={value || ""} onChange={e => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder} type={type}
        style={{ padding: "10px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgInput, fontSize: 14, color: C.t1, fontFamily: FONT, outline: "none" }} />
    </label>
  );
}

function SelectInput({ label, value, onChange, options, required }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: C.t2, fontFamily: FONT }}>
      {label}{required && <span style={{ color: C.err }}> *</span>}
      <select value={value || ""} onChange={e => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgInput, fontSize: 14, color: C.t1, fontFamily: FONT, outline: "none" }}>
        <option value="">Seleccionar...</option>
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </label>
  );
}

export default function MachineWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 state
  const [machineType, setMachineType] = useState("");
  const [brand, setBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [series, setSeries] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [templateId, setTemplateId] = useState(null);
  const [templateData, setTemplateData] = useState(null);

  // Step 2 state (tech)
  const [engineBrand, setEngineBrand] = useState("");
  const [engineModel, setEngineModel] = useState("");
  const [enginePower, setEnginePower] = useState("");
  const [engineDisplacement, setEngineDisplacement] = useState("");
  const [transmissionType, setTransmissionType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [hydraulicSystem, setHydraulicSystem] = useState("");
  const [hydraulicCapacity, setHydraulicCapacity] = useState("");
  const [tireSize, setTireSize] = useState("");
  const [tireBrand, setTireBrand] = useState("");
  const [currentHorometer, setCurrentHorometer] = useState(null);
  const [currentOdometer, setCurrentOdometer] = useState(null);

  // Step 3 (photos - placeholder)
  const [photos] = useState([]);

  // Step 4 (history)
  const [modifications, setModifications] = useState([]);
  const [repairs, setRepairs] = useState([]);

  // Catalog data
  const [brands, setBrands] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => { apiGetTemplateBrands().then(setBrands).catch(() => {}); }, []);

  useEffect(() => {
    if (brand && brand !== "__other__") {
      apiGetTemplateSeries(brand).then(setSeriesList).catch(() => setSeriesList([]));
      apiListTemplates({ brand, machineType: machineType || undefined }).then(setModels).catch(() => setModels([]));
    } else { setSeriesList([]); setModels([]); }
  }, [brand, machineType]);

  const selectTemplate = useCallback((tmpl) => {
    setTemplateId(tmpl.id);
    setTemplateData(tmpl);
    setModel(tmpl.model);
    // Pre-fill tech data
    setEngineBrand(tmpl.engineBrand || "");
    setEngineModel(tmpl.engineModel || "");
    setEnginePower(tmpl.enginePower || "");
    setEngineDisplacement(tmpl.engineDisplacement || "");
    setTransmissionType(tmpl.transmissionType || "");
    setFuelType(tmpl.fuelType || "");
    setHydraulicSystem(tmpl.hydraulicSystem || "");
  }, []);

  const canAdvance = () => {
    if (step === 0) return machineType && (brand === "__other__" ? customBrand : brand) && model && serialNumber;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const machine = await apiCreateMachine({
        machineType, brand: brand === "__other__" ? customBrand : brand, model, serialNumber, year,
        templateId: templateId || undefined,
        engineBrand: engineBrand || undefined, engineModel: engineModel || undefined,
        enginePower: enginePower || undefined, engineDisplacement: engineDisplacement || undefined,
        transmissionType: transmissionType || undefined, fuelType: fuelType || undefined,
        hydraulicSystem: hydraulicSystem || undefined, hydraulicCapacity: hydraulicCapacity || undefined,
        tireSize: tireSize || undefined, tireBrand: tireBrand || undefined,
        currentHorometer: currentHorometer || undefined, currentOdometer: currentOdometer || undefined,
        photos,
      });
      // Add modifications and repairs
      await Promise.all(modifications.map(m => apiAddModification(machine.id, m)));
      await Promise.all(repairs.map(r => apiAddRepair(machine.id, r)));
      navigate(`/mechanic/machines/${machine.id}`, { replace: true });
    } catch (e) {
      alert(e?.message || "Error al crear máquina");
    }
    setSubmitting(false);
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const finalBrand = brand === "__other__" ? customBrand : brand;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: isMobile ? 16 : 32, fontFamily: FONT }}>
      <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", color: C.t3, fontSize: 13, fontFamily: FONT, marginBottom: 16, padding: 0 }}>
        {Ic.chev(C.t3, 16)} Volver
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, marginBottom: 8 }}>Registrar máquina</h1>
      <StepIndicator current={step} />

      {/* ── STEP 1: Identification ── */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SelectInput label="Tipo de máquina" value={machineType} onChange={setMachineType} options={MACHINE_TYPES} required />
          <SelectInput label="Marca" value={brand} onChange={v => { setBrand(v); setModel(""); setTemplateId(null); setTemplateData(null); }}
            options={[...brands.map(b => ({ value: b, label: b })), { value: "__other__", label: "Otra marca" }]} required />
          {brand === "__other__" && <Input label="Nombre de la marca" value={customBrand} onChange={setCustomBrand} required />}
          {seriesList.length > 0 && <SelectInput label="Serie / Línea" value={series} onChange={setSeries} options={seriesList} />}
          {brand && brand !== "__other__" && models.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: C.t2 }}>Modelo <span style={{ color: C.err }}>*</span></span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {models.filter(m => !series || m.series === series).map(m => (
                  <button key={m.id} onClick={() => selectTemplate(m)} style={{
                    padding: "8px 14px", borderRadius: R.md, border: `1.5px solid ${templateId === m.id ? C.pri : C.b1}`,
                    background: templateId === m.id ? C.priPale : C.bgCard, color: templateId === m.id ? C.pri : C.t1,
                    fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT,
                  }}>{m.model}</button>
                ))}
              </div>
              {templateData && <div style={{ fontSize: 12, color: C.ok, marginTop: 4 }}>✓ Datos técnicos pre-cargados</div>}
              <Input label="O escribí el modelo" value={model} onChange={v => { setModel(v); setTemplateId(null); setTemplateData(null); }} placeholder="Ej: 8245R" />
            </div>
          ) : (
            <Input label="Modelo" value={model} onChange={setModel} required placeholder="Ej: 8245R" />
          )}
          <Input label="Año de fabricación" value={year} onChange={setYear} type="number" placeholder="Ej: 2020" />
          <Input label="Número de serie" value={serialNumber} onChange={setSerialNumber} required placeholder="Obligatorio — único por empresa" />
        </div>
      )}

      {/* ── STEP 2: Tech Data ── */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: 0 }}>Motor</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Marca motor" value={engineBrand} onChange={setEngineBrand} />
            <Input label="Modelo motor" value={engineModel} onChange={setEngineModel} />
            <Input label="Potencia" value={enginePower} onChange={setEnginePower} placeholder="Ej: 245 hp" />
            <Input label="Cilindrada" value={engineDisplacement} onChange={setEngineDisplacement} placeholder="Ej: 6.8L" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: 0 }}>Transmisión y combustible</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Tipo transmisión" value={transmissionType} onChange={setTransmissionType} />
            <Input label="Combustible" value={fuelType} onChange={setFuelType} placeholder="Ej: Diésel" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: 0 }}>Hidráulica y neumáticos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Sistema hidráulico" value={hydraulicSystem} onChange={setHydraulicSystem} />
            <Input label="Capacidad hidráulica" value={hydraulicCapacity} onChange={setHydraulicCapacity} />
            <Input label="Medida neumáticos" value={tireSize} onChange={setTireSize} />
            <Input label="Marca neumáticos" value={tireBrand} onChange={setTireBrand} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: 0 }}>Lecturas actuales</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Horómetro actual (hs)" value={currentHorometer} onChange={setCurrentHorometer} type="number" />
            <Input label="Odómetro actual (km)" value={currentOdometer} onChange={setCurrentOdometer} type="number" />
          </div>
        </div>
      )}

      {/* ── STEP 3: Photos ── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 32 }}>
          {Ic.cam(C.muted, 48)}
          <p style={{ fontSize: 14, color: C.t3, textAlign: "center" }}>Subida de fotos — Próximamente</p>
          <p style={{ fontSize: 12.5, color: C.t3, textAlign: "center" }}>Podés saltear este paso y agregar fotos después desde la ficha de la máquina</p>
        </div>
      )}

      {/* ── STEP 4: History ── */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Modifications */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: 0 }}>Modificaciones realizadas</h3>
              <button onClick={() => setModifications([...modifications, { description: "", date: "" }])}
                style={{ border: "none", background: C.priPale, color: C.pri, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: R.md, cursor: "pointer", fontFamily: FONT }}>
                + Agregar
              </button>
            </div>
            {modifications.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <Input label="Descripción" value={m.description} onChange={v => { const n = [...modifications]; n[i].description = v; setModifications(n); }} />
                </div>
                <Input label="Fecha" value={m.date} onChange={v => { const n = [...modifications]; n[i].date = v; setModifications(n); }} type="date" />
                <button onClick={() => setModifications(modifications.filter((_, j) => j !== i))}
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 4, marginBottom: 2 }}>{Ic.cross(C.err, 16)}</button>
              </div>
            ))}
          </div>
          {/* Repairs */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: C.t1, margin: 0 }}>Reparaciones anteriores</h3>
              <button onClick={() => setRepairs([...repairs, { description: "", date: "", workshop: "", cost: null }])}
                style={{ border: "none", background: C.priPale, color: C.pri, fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: R.md, cursor: "pointer", fontFamily: FONT }}>
                + Agregar
              </button>
            </div>
            {repairs.map((r, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: 12, borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCardAlt }}>
                <Input label="Descripción" value={r.description} onChange={v => { const n = [...repairs]; n[i].description = v; setRepairs(n); }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <Input label="Fecha" value={r.date} onChange={v => { const n = [...repairs]; n[i].date = v; setRepairs(n); }} type="date" />
                  <Input label="Taller" value={r.workshop} onChange={v => { const n = [...repairs]; n[i].workshop = v; setRepairs(n); }} />
                  <Input label="Costo ($)" value={r.cost} onChange={v => { const n = [...repairs]; n[i].cost = v; setRepairs(n); }} type="number" />
                </div>
                <button onClick={() => setRepairs(repairs.filter((_, j) => j !== i))}
                  style={{ alignSelf: "flex-end", border: "none", background: "none", cursor: "pointer", color: C.err, fontSize: 12, fontFamily: FONT }}>Eliminar</button>
              </div>
            ))}
          </div>
          {modifications.length === 0 && repairs.length === 0 && (
            <p style={{ fontSize: 13, color: C.t3, textAlign: "center" }}>Podés saltear este paso — el historial se puede cargar después</p>
          )}
        </div>
      )}

      {/* ── STEP 5: Confirmation ── */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 20, borderRadius: R.lg, border: `1px solid ${C.b1}`, background: C.bgCard }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "0 0 4px" }}>{finalBrand} {model}</h3>
            <div style={{ fontSize: 13, color: C.t3, marginBottom: 12 }}>
              {MACHINE_TYPES.find(t => t.value === machineType)?.label || machineType}{year ? ` · ${year}` : ""} · S/N: {serialNumber}
            </div>
            {enginePower && <div style={{ fontSize: 13, color: C.t2 }}>Motor: {engineBrand} {engineModel} — {enginePower} {engineDisplacement ? `(${engineDisplacement})` : ""}</div>}
            {transmissionType && <div style={{ fontSize: 13, color: C.t2 }}>Transmisión: {transmissionType}</div>}
            {fuelType && <div style={{ fontSize: 13, color: C.t2 }}>Combustible: {fuelType}</div>}
            {currentHorometer != null && <div style={{ fontSize: 13, color: C.t2 }}>Horómetro: {currentHorometer} hs</div>}
          </div>
          {modifications.length > 0 && <div style={{ fontSize: 13, color: C.t2 }}>{modifications.length} modificación(es) a registrar</div>}
          {repairs.length > 0 && <div style={{ fontSize: 13, color: C.t2 }}>{repairs.length} reparación(es) a registrar</div>}
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, gap: 12 }}>
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} style={{ padding: "10px 24px", borderRadius: R.lg, border: `1px solid ${C.b1}`, background: C.bgCard, color: C.t2, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>
            Anterior
          </button>
        ) : <div />}
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)} disabled={!canAdvance()}
            style={{ padding: "10px 24px", borderRadius: R.lg, border: "none", background: canAdvance() ? C.pri : C.b1, color: canAdvance() ? C.tOn : C.t3, fontSize: 14, fontWeight: 600, cursor: canAdvance() ? "pointer" : "not-allowed", fontFamily: FONT }}>
            Siguiente
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding: "10px 24px", borderRadius: R.lg, border: "none", background: C.pri, color: C.tOn, fontSize: 14, fontWeight: 600, cursor: submitting ? "wait" : "pointer", fontFamily: FONT }}>
            {submitting ? "Registrando..." : "Confirmar"}
          </button>
        )}
      </div>
    </div>
  );
}
