import { useMemo } from "react";
import { C, Ic } from "../theme";
import { Btn } from "../components";

function getSteps(companyType, role, { fields, trucks, drivers, freights }) {
  const base = [{ id: "account", title: "Crear cuenta", subtitle: "Registro completado", complete: true }];

  if (role === "chofer") {
    return [...base, {
      id: "whatsapp", title: "Usar WhatsApp", subtitle: "Escribile a Tolvink por WhatsApp para gestionar viajes",
      complete: freights.length > 0, route: null,
    }];
  }

  if (companyType === "producer") {
    return [...base,
      { id: "field", title: "Agregar un campo", subtitle: "Donde se origina tu producci\u00f3n", complete: fields.length > 0, route: "fields" },
      { id: "freight", title: "Solicitar primer flete", subtitle: "Prob\u00e1 creando un flete", complete: freights.length > 0, route: "new" },
    ];
  }

  if (companyType === "plant") {
    return [...base,
      { id: "freight", title: "Recibir primer flete", subtitle: "Cuando un productor solicite un flete, aparece ac\u00e1", complete: freights.length > 0, route: null },
    ];
  }

  if (companyType === "transporter") {
    return [...base,
      { id: "truck", title: "Registrar un cami\u00f3n", subtitle: "Para recibir asignaciones de flete", complete: trucks.length > 0, route: "trucks" },
      { id: "driver", title: "Registrar un chofer", subtitle: "Asignale viajes a tu equipo", complete: drivers.length > 0, route: "trucks" },
    ];
  }

  // Fallback (multi-type or unknown)
  return [...base, {
    id: "freight", title: "Primer flete", subtitle: "Cre\u00e1 o recib\u00ed tu primer flete", complete: freights.length > 0, route: "new",
  }];
}

export default function OnboardingChecklist({ user, catalog, freights, onNavigate, onDismiss, compact }) {
  const companyType = user.company?.types?.[0] || user.company?.type || user.userTypes?.[0] || "producer";
  const role = user.role === "chofer" ? "chofer" : companyType;

  const steps = useMemo(() => getSteps(companyType, role, {
    fields: catalog.fields || [],
    trucks: catalog.trucks || [],
    drivers: [], // Drivers come from catalog.trucks drivers tab; approximate via trucks
    freights: freights || [],
  }), [companyType, role, catalog.fields, catalog.trucks, freights]);

  const completed = steps.filter(s => s.complete).length;
  const allDone = completed === steps.length;

  if (allDone) return null;

  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div style={{
      background: C.w, borderRadius: 14, padding: compact ? "12px 10px" : "16px 16px",
      marginBottom: compact ? 8 : 12, border: `1.5px solid ${C.pri}25`,
      boxShadow: "0 2px 8px rgba(26,107,55,0.06)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: C.t1 }}>Primeros pasos</div>
          {!compact && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Complet\u00e1 estos pasos para empezar</div>}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri }}>{completed}/{steps.length}</div>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map(step => (
          <div
            key={step.id}
            onClick={() => !step.complete && step.route && onNavigate(step.route)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: compact ? "8px 10px" : "10px 12px", borderRadius: 10,
              background: step.complete ? `${C.pri}08` : C.bgInput,
              cursor: !step.complete && step.route ? "pointer" : "default",
              transition: "background 0.15s",
            }}
          >
            {/* Status icon */}
            <div style={{
              width: 24, height: 24, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: step.complete ? C.pri : `${C.t3}30`,
            }}>
              {step.complete
                ? Ic.chk("#fff", 12)
                : <div style={{ width: 8, height: 8, borderRadius: 4, background: C.t3 }} />
              }
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: compact ? 12 : 13, fontWeight: 600,
                color: step.complete ? C.t3 : C.t1,
                textDecoration: step.complete ? "line-through" : "none",
              }}>{step.title}</div>
              {!compact && !step.complete && (
                <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>{step.subtitle}</div>
              )}
            </div>

            {/* Arrow for actionable steps */}
            {!step.complete && step.route && (
              <div style={{ transform: "rotate(180deg)", flexShrink: 0 }}>{Ic.chev(C.pri, 12)}</div>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.b2 }}>
          <div style={{ height: 4, borderRadius: 2, background: C.pri, width: `${pct}%`, transition: "width 0.3s" }} />
        </div>
        <button
          onClick={onDismiss}
          style={{ background: "none", border: "none", fontSize: 11, color: C.t3, cursor: "pointer", fontFamily: "inherit", padding: "4px 0", whiteSpace: "nowrap" }}
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
