import { useState, useEffect } from "react";
import { C, Ic, R } from "../theme";
import { Btn, ModalOverlay, NumericStepper } from "../components";
import WeighTicketForm from "../components/WeighTicketForm";
import { apiGetWeighTickets } from "../api";
import { useUIStore } from "../store";
import log from "../logger";

export default function WeighTicketConfirmModal({ freight, action, title, btnLabel, btnVariant = "acc", icon, onClose, onConfirm, showTonsInput, defaultTons }) {
  const [step, setStep] = useState("choose"); // "choose" | "ticket" | "confirm"
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingText, setClosingText] = useState("");
  const [tons, setTons] = useState(defaultTons || freight.tons || "");
  const [ticketCreated, setTicketCreated] = useState(false);
  const [originTickets, setOriginTickets] = useState([]);
  const show = useUIStore(s => s.show);

  const isLoaded = action === "confirm_loaded";
  const ticketType = isLoaded ? "origin" : "destination";

  // For confirm_finished, fetch origin tickets for comparison
  useEffect(() => {
    if (!isLoaded && freight?.id) {
      apiGetWeighTickets(freight.id, "origin").then(setOriginTickets).catch(e => {
        log.warn("WT", "Failed to fetch origin tickets:", e);
      });
    }
  }, [freight?.id, isLoaded]);

  const doConfirm = async () => {
    if (loading || closing) return;
    if (showTonsInput) {
      const n = parseFloat(tons);
      if (!n || n <= 0) { show("Ingrese toneladas válidas (mayor a 0)", "err"); return; }
    }
    setLoading(true);
    const msg = await onConfirm(showTonsInput ? tons : undefined);
    setLoading(false);
    if (msg) { setClosingText(msg); setClosing(true); }
  };

  const handleTicketCreated = () => {
    setTicketCreated(true);
    // Move to confirm step after ticket is saved
    setStep("confirm");
  };

  return (
    <ModalOverlay onClose={onClose} maxWidth={step === "ticket" ? 480 : 360} loading={loading} closing={closing} closingText={closingText} quick>
      {/* Step 1: Choose whether to add ticket */}
      {step === "choose" && <>
        {icon && <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: R.pill, background: `${btnVariant === "acc" ? C.acc : C.pri}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        </div>}
        <div style={{ fontSize: 18.7, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>{title}</div>
        <div style={{ fontSize: 13.2, color: C.t2, marginBottom: 16, textAlign: "center", padding: "8px 12px", background: C.bg, borderRadius: R.md, border: `1px solid ${C.b1}` }}>
          <div style={{ fontWeight: 700, color: C.t1 }}>{freight.grain} · {freight.tons}{freight.unit || "tn"}</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{freight.code}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.2, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            ¿Agregar ticket de pesaje?
          </div>
          <button onClick={() => setStep("ticket")}
            style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: `1.5px solid ${C.acc}40`, background: `${C.acc}08`, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {Ic.doc(C.acc, 18)}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14.3, fontWeight: 700, color: C.acc }}>Sí, registrar pesaje</div>
              <div style={{ fontSize: 11.5, color: C.t3 }}>Foto+OCR o ingreso manual</div>
            </div>
          </button>
          <button onClick={() => setStep("confirm")}
            style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
            {Ic.chk(C.t3, 18)}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14.3, fontWeight: 600, color: C.t1 }}>No, confirmar directamente</div>
              <div style={{ fontSize: 11.5, color: C.t3 }}>Sin ticket de pesaje</div>
            </div>
          </button>
        </div>
      </>}

      {/* Step 2: Weigh ticket form */}
      {step === "ticket" && <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setStep("choose")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, color: C.pri, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            {Ic.chev(C.pri, 14)} Volver
          </button>
          <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{title}</div>
          <div style={{ width: 60 }} />
        </div>
        <WeighTicketForm
          freightId={freight.id}
          type={ticketType}
          onCreated={handleTicketCreated}
          originTickets={originTickets}
          compact
        />
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.b1}`, paddingTop: 10 }}>
          <button onClick={() => setStep("confirm")}
            style={{ width: "100%", fontSize: 12.7, fontWeight: 600, color: C.t3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "6px 0" }}>
            Omitir ticket y confirmar →
          </button>
        </div>
      </>}

      {/* Step 3: Final confirmation (same as ConfirmActionModal) */}
      {step === "confirm" && <>
        {icon && <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: R.pill, background: `${btnVariant === "acc" ? C.acc : C.pri}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        </div>}
        <div style={{ fontSize: 18.7, fontWeight: 700, marginBottom: 6, textAlign: "center" }}>{title}</div>
        <div style={{ fontSize: 13.2, color: C.t2, marginBottom: showTonsInput ? 12 : 8, textAlign: "center", padding: "8px 12px", background: C.bg, borderRadius: R.md, border: `1px solid ${C.b1}` }}>
          <div style={{ fontWeight: 700, color: C.t1 }}>{freight.grain} · {freight.tons}{freight.unit || "tn"}</div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{freight.code}</div>
        </div>
        {ticketCreated && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: R.md, background: `${C.ok}12`, marginBottom: 10 }}>
            {Ic.chk(C.ok, 14)}
            <span style={{ fontSize: 12.7, fontWeight: 600, color: C.ok }}>Ticket de pesaje registrado</span>
          </div>
        )}
        {showTonsInput && <div style={{ marginBottom: 16 }}>
          <NumericStepper label="Toneladas cargadas" value={tons} onChange={setTons} min={0} step={0.01} placeholder="Ej: 30.5" />
        </div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn full v="ghost" onClick={onClose} disabled={loading || closing}>Cancelar</Btn>
          <Btn full v={btnVariant} disabled={loading || closing} onClick={doConfirm}>
            {loading ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite", marginRight: 6, verticalAlign: "middle" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Procesando...</> : btnLabel}
          </Btn>
        </div>
      </>}
    </ModalOverlay>
  );
}
