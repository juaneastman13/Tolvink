import { useState } from "react";
import { createPortal } from "react-dom";
import { C, Ic, FONT, R } from "../theme";
import { apiUpdateFreightMtop } from "../api";

const MTOP_URL = "https://guiatransporte.mtop.gub.uy/GuideForLoader/AddCargoByLoader";

const MODE_OPTIONS = [
  { value: "simple", label: "Simple", desc: "Un punto de carga, un punto de descarga" },
  { value: "recolecta", label: "Recolecta", desc: "Varios puntos de carga, un punto de descarga" },
  { value: "distribuye", label: "Distribuye", desc: "Un punto de carga, varios de descarga" },
  { value: "multiples", label: "Múltiples", desc: "Varios puntos de carga y descarga" },
];

const DURATION_OPTIONS = [24, 48, 72];

const VEHICLE_CONFIG_OPTIONS = [
  { value: "camion", label: "Camión simple" },
  { value: "tractor", label: "Tractor + semirremolque" },
  { value: "bitren", label: "Bitrén (2 remolques)" },
  { value: "tritren", label: "Tritrén (3 remolques)" },
];

function Row({ label, value, ok, missing }) {
  const color = ok ? C.ok : C.acc;
  const bg = ok ? C.okPale : C.accPale;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.b2}` }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        {ok
          ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.ok} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        }
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t3, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 1 }}>{label}</div>
        {value
          ? <div style={{ fontSize: 13.5, color: C.t1, fontWeight: 500, wordBreak: "break-word" }}>{value}</div>
          : <div style={{ fontSize: 13, color: color, fontWeight: 600, background: bg, padding: "2px 8px", borderRadius: R.sm, display: "inline-block" }}>
              {missing || "Completar manualmente"}
            </div>
        }
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 18, marginBottom: 8, borderBottom: `2px solid ${C.b1}`, paddingBottom: 4 }}>
      {children}
    </div>
  );
}

export default function MtopGuideAssistant({ freight, onClose, onSaved, show: showToast }) {
  const f = freight;

  // Derive data from freight
  const firstAssignment = f.activeAssignments?.[0] || f.assignments?.[0];
  const truck = firstAssignment?.truck;
  const truckPlate = firstAssignment?.plate || truck?.plate;
  const driverName = firstAssignment?.driverName || firstAssignment?.driver?.name;
  const transporterName = firstAssignment?.transporterName || firstAssignment?.transportCompany?.name;
  const totalTons = f.items?.reduce((s, it) => s + (parseFloat(it.tons) || 0), 0);
  const totalKg = totalTons ? Math.round(totalTons * 1000) : null;
  const grains = f.items?.map(it => it.grain).filter(Boolean).join(", ");
  const originRut = f.originCompany?.rut;
  const destRut = f.destCompany?.rut;
  const routeKm = f.routeDistanceKm ? Math.round(f.routeDistanceKm) : null;

  // MTOP form state — initialise from saved values if present
  const [mode, setMode] = useState(f.mtopModeOfOperation || "simple");
  const [duration, setDuration] = useState(f.mtopDuration || 24);
  const [price, setPrice] = useState(f.mtopTransportPrice?.toString() || "");
  const [guideId, setGuideId] = useState(f.mtopGuideId || "");
  const [accessCode, setAccessCode] = useState(f.mtopAccessCode || "");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0); // 0=prefill, 1=create, 2=done

  const hasGuide = !!(f.mtopGuideId || guideId);

  async function handleSave() {
    setSaving(true);
    try {
      await apiUpdateFreightMtop(f.id, {
        mtopModeOfOperation: mode,
        mtopDuration: duration,
        mtopTransportPrice: price ? parseFloat(price) : undefined,
        mtopGuideId: guideId || undefined,
        mtopAccessCode: accessCode || undefined,
        mtopGuideStatus: guideId ? "activa" : undefined,
      });
      if (showToast) showToast("Datos MTOP guardados", "ok");
      if (onSaved) onSaved();
    } catch (e) {
      if (showToast) showToast(e.message || "Error al guardar", "err");
    } finally {
      setSaving(false);
    }
  }

  const lbl = { fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 4 };
  const inp = { width: "100%", padding: "9px 11px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.w, fontSize: 14, color: C.t1, fontFamily: FONT, boxSizing: "border-box", outline: "none" };
  const tabStyle = (active) => ({
    flex: 1, padding: "8px 4px", fontSize: 13, fontWeight: 700, color: active ? C.pri : C.t3,
    borderBottom: `2px solid ${active ? C.pri : "transparent"}`, background: "none", border: "none",
    borderBottom: `2px solid ${active ? C.pri : "transparent"}`, cursor: "pointer", fontFamily: FONT, textAlign: "center",
  });

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.w, borderRadius: R.lg, width: "min(520px,96vw)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: C.shLg, fontFamily: FONT }}>

        {/* Header */}
        <div style={{ padding: "14px 16px 0", borderBottom: `1px solid ${C.b1}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex" }}>{Ic.doc(C.pri, 20)}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, lineHeight: 1.2 }}>Asistente Guía MTOP</div>
                <div style={{ fontSize: 12, color: C.t3 }}>Flete {f.code}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            <button style={tabStyle(step === 0)} onClick={() => setStep(0)}>Pre-llenado</button>
            <button style={tabStyle(step === 1)} onClick={() => setStep(1)}>Datos adicionales</button>
            <button style={tabStyle(step === 2)} onClick={() => setStep(2)}>{hasGuide ? "✓ Guía creada" : "Registrar guía"}</button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>

          {/* ---- Tab 0: Pre-filled data ---- */}
          {step === 0 && <>
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, background: C.priGhost, border: `1px solid ${C.pri}30`, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
              Estos datos se pueden copiar directamente al portal MTOP. Los marcados en naranja requieren completar información faltante.
            </div>

            <SectionTitle>Transportista</SectionTitle>
            <Row label="Empresa transportista" value={transporterName} ok={!!transporterName} missing="Asignar transportista primero" />
            <Row label="RUT transportista" value={originRut} ok={!!originRut} missing="Agregar RUT a la empresa" />

            <SectionTitle>Cargador / Productor</SectionTitle>
            <Row label="Nombre cargador" value={f.originCompany?.name || f.originName} ok={!!(f.originCompany?.name || f.originName)} />
            <Row label="RUT cargador" value={destRut || originRut} ok={!!(destRut || originRut)} missing="Agregar RUT a la empresa" />

            <SectionTitle>Vehículo</SectionTitle>
            <Row label="Matrícula camión" value={truckPlate} ok={!!truckPlate} missing="Asignar camión al flete" />
            <Row label="Chofer" value={driverName} ok={!!driverName} missing="Asignar chofer al flete" />

            <SectionTitle>Carga</SectionTitle>
            <Row label="Tipo de mercadería" value={grains ? `${grains} — Graneles sólidos` : null} ok={!!grains} missing="Agregar producto al flete" />
            <Row label="Peso bruto (kg)" value={totalKg ? `${totalKg.toLocaleString("es-UY")} kg` : null} ok={!!totalKg} missing="Especificar toneladas en el flete" />
            <Row label="Tipo de embalaje" value="Graneles sólidos" ok />

            <SectionTitle>Ruta</SectionTitle>
            <Row label="Origen" value={f.originName} ok={!!f.originName} />
            <Row label="Destino" value={f.destName} ok={!!f.destName} />
            <Row label="Distancia km" value={routeKm ? `${routeKm} km` : null} ok={!!routeKm} missing="Distancia calculada al confirmar flete" />
            <Row label="Localidad catastral origen" value={null} ok={false} missing="Seleccionar manualmente en MTOP" />
            <Row label="Localidad catastral destino" value={null} ok={false} missing="Seleccionar manualmente en MTOP" />

            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "10px 12px", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                Siguiente →
              </button>
            </div>
          </>}

          {/* ---- Tab 1: Additional data ---- */}
          {step === 1 && <>
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, background: "#FFF3E8", border: `1px solid ${C.acc}30`, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
              Estos datos son necesarios para crear la guía y no están en Tolvink. Se guardarán junto al flete.
            </div>

            <SectionTitle>Modo de operación</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
              {MODE_OPTIONS.map(opt => (
                <label key={opt.value} onClick={() => setMode(opt.value)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: R.md, border: `1.5px solid ${mode === opt.value ? C.pri : C.b1}`, background: mode === opt.value ? C.priGhost : C.w, cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${mode === opt.value ? C.pri : C.b1}`, background: mode === opt.value ? C.pri : C.w, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {mode === opt.value && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.w }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <SectionTitle>Validez de la guía</SectionTitle>
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              {DURATION_OPTIONS.map(h => (
                <button key={h} onClick={() => setDuration(h)} style={{ flex: 1, padding: "10px 0", borderRadius: R.md, border: `1.5px solid ${duration === h ? C.pri : C.b1}`, background: duration === h ? C.priGhost : C.w, color: duration === h ? C.pri : C.t2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  {h}h
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>Tiempo de validez desde que el chofer inicia la guía en la aplicación MTOP.</div>

            <SectionTitle>Precio del transporte</SectionTitle>
            <div style={lbl}>Monto total en pesos uruguayos (opcional)</div>
            <input style={inp} value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" placeholder="Ej: 45000" inputMode="numeric" />
            <div style={{ fontSize: 12, color: C.t3, marginTop: 4, marginBottom: 6 }}>Campo "Precio pactado por el transporte" en el formulario MTOP.</div>

            <SectionTitle>Configuración del vehículo</SectionTitle>
            <div style={lbl}>Tipo de configuración (completar en camión luego)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              {VEHICLE_CONFIG_OPTIONS.map(opt => (
                <div key={opt.value} style={{ padding: "6px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 12.5, color: C.t2, fontWeight: 500 }}>
                  {opt.label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 4 }}>Actualizar en la pantalla de camiones para que aparezca automáticamente en futuras guías.</div>

            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button onClick={() => setStep(0)} style={{ padding: "10px 16px", borderRadius: R.md, background: C.b2, color: C.t2, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                ← Atrás
              </button>
              <button disabled={saving} onClick={async () => { await handleSave(); if (!saving) setStep(2); }} style={{ flex: 1, padding: "10px 12px", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Guardando..." : "Guardar y continuar →"}
              </button>
            </div>
          </>}

          {/* ---- Tab 2: Create guide / Save guide ID ---- */}
          {step === 2 && <>
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: R.md, background: C.priGhost, border: `1px solid ${C.pri}30` }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, marginBottom: 6 }}>Pasos para crear la guía en MTOP</div>
              {[
                "Abrir el portal MTOP (botón abajo)",
                "Ingresar con su CI y contraseña ID Uruguay",
                'En "Guía de Carga" → "Agregar carga como cargador"',
                "Completar el formulario usando los datos del tab 1",
                "Localidad catastral: buscar por departamento y seleccionar",
                "Una vez creada, copiar el número de guía y código de acceso aquí",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.pri, color: C.w, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.4, paddingTop: 2 }}>{step}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => window.open(MTOP_URL, "_blank", "noopener")}
              style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: R.md, background: "#1565C0", color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Abrir portal MTOP
            </button>

            <SectionTitle>Registrar guía creada</SectionTitle>
            <div style={{ marginBottom: 10 }}>
              <div style={lbl}>Número de guía (Nro. de Guía)</div>
              <input style={inp} value={guideId} onChange={e => setGuideId(e.target.value)} placeholder="Ej: 2024-123456" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Código de acceso directo</div>
              <input style={inp} value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="Ej: ABC123" />
              <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>El código que el chofer usa para iniciar o finalizar la guía sin necesitar cuenta.</div>
            </div>

            {(f.mtopGuideId || guideId) && (
              <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: R.md, background: C.okPale, border: `1px solid ${C.ok}30` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ok, marginBottom: 4 }}>Guía guardada</div>
                <div style={{ fontSize: 13, color: C.t1 }}>N° {f.mtopGuideId || guideId}</div>
                {(f.mtopAccessCode || accessCode) && <div style={{ fontSize: 13, color: C.t2 }}>Código: {f.mtopAccessCode || accessCode}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ padding: "10px 16px", borderRadius: R.md, background: C.b2, color: C.t2, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                ← Atrás
              </button>
              <button disabled={saving || (!guideId && !accessCode)} onClick={handleSave} style={{ flex: 1, padding: "10px 12px", borderRadius: R.md, background: C.ok, color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: (saving || (!guideId && !accessCode)) ? "not-allowed" : "pointer", fontFamily: FONT, opacity: (saving || (!guideId && !accessCode)) ? 0.6 : 1 }}>
                {saving ? "Guardando..." : "Guardar guía"}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>,
    document.body
  );
}
