import { C, Ic } from "../theme";
import { Btn, ModalOverlay } from "../components";

const ROLE_CONFIG = {
  producer: {
    greeting: "Solicita fletes y seguilos en vivo",
    features: [
      { icon: (c,s) => Ic.truck(c,s), text: "Solicitar fletes" },
      { icon: (c,s) => Ic.pin(c,s), text: "Seguirlos en tiempo real" },
      { icon: (c,s) => Ic.chk(c,s), text: "Confirmar cargas y entregas" },
    ],
    cta: "Solicitar primer flete",
    ctaRoute: "new",
  },
  plant: {
    greeting: "Gestion\u00e1 fletes y asign\u00e1 transportistas",
    features: [
      { icon: (c,s) => Ic.truck(c,s), text: "Asignar transportistas" },
      { icon: (c,s) => Ic.pin(c,s), text: "Seguir viajes en vivo" },
      { icon: (c,s) => Ic.chk(c,s), text: "Confirmar recepciones" },
    ],
    cta: "Ver fletes pendientes",
    ctaRoute: "list",
  },
  transporter: {
    greeting: "Gestion\u00e1 tu flota y viajes asignados",
    features: [
      { icon: (c,s) => Ic.truck(c,s), text: "Gestionar camiones y choferes" },
      { icon: (c,s) => Ic.nav(c,s), text: "Aceptar e iniciar viajes" },
      { icon: (c,s) => Ic.chk(c,s), text: "Confirmar cargas y entregas" },
    ],
    cta: "Registrar un cami\u00f3n",
    ctaRoute: "trucks",
  },
  chofer: {
    greeting: "Ac\u00e1 ves tus viajes asignados",
    features: [
      { icon: (c,s) => Ic.nav(c,s), text: "Iniciar y confirmar viajes" },
      { icon: (c,s) => Ic.pin(c,s), text: "Compartir tu ubicaci\u00f3n" },
      { icon: (c,s) => Ic.wa(c,s), text: "Todo funciona por WhatsApp tambi\u00e9n" },
    ],
    cta: "Entendido",
    ctaRoute: null,
  },
};

export default function OnboardingWelcomeModal({ user, onClose, onNavigate }) {
  // Determine role: check company type, fallback to first userType
  const companyType = user.company?.types?.[0] || user.company?.type || user.userTypes?.[0] || "producer";
  const role = user.role === "chofer" ? "chofer" : companyType;
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.producer;

  const handleCta = () => {
    onClose();
    if (cfg.ctaRoute && onNavigate) onNavigate(cfg.ctaRoute);
  };

  return (
    <ModalOverlay onClose={onClose} maxWidth={380}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.pri, letterSpacing: -1 }}>tolvink</span>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.acc, display: "inline-block" }} />
      </div>

      {/* Welcome */}
      <div style={{ fontSize: 18, fontWeight: 700, color: C.t1, textAlign: "center", marginBottom: 4 }}>
        Bienvenido, {user.name?.split(" ")[0] || ""}
      </div>
      <div style={{ fontSize: 13, color: C.t2, textAlign: "center", marginBottom: 20 }}>
        {cfg.greeting}
      </div>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {cfg.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: C.priPale }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.pri}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {f.icon(C.pri, 16)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{f.text}</span>
          </div>
        ))}
      </div>

      {/* WhatsApp hint */}
      {role !== "chofer" && (
        <div style={{ fontSize: 12, color: C.t3, textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>
          Tambi\u00e9n pod\u00e9s hacer todo esto por WhatsApp
        </div>
      )}

      {/* CTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Btn full v="pri" onClick={handleCta}>{cfg.cta}</Btn>
        {cfg.ctaRoute && (
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 13, color: C.t3, cursor: "pointer", fontFamily: "inherit", padding: "8px 0", textAlign: "center" }}>
            Explorar primero
          </button>
        )}
      </div>
    </ModalOverlay>
  );
}
