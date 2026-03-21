import { useState, useEffect, useCallback } from "react";
import { C, Ic, FONT, R } from "../theme";
import { Btn, SkeletonCard } from "../components";
import { apiGetAssignmentSuggestions } from "../api";

const AVAIL_DOT = { free: C.ok, busy_other_hours: "#F59E0B", busy_now: C.err };

function ScoreBar({ score }) {
  const fill = score >= 70 ? C.pri : score >= 40 ? "#F59E0B" : C.err;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 6, borderRadius: R.xs, background: C.bgAlt, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: R.xs, background: fill, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: fill, minWidth: 28, textAlign: "right" }}>{score}</span>
    </div>
  );
}

export default function AssignmentSuggestions({ freight, user, onAssign, onRefreshKey }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetAssignmentSuggestions(freight.id);
      setSuggestions(res.suggestions || []);
      if (!res.suggestions?.length) setShowManual(true);
    } catch (e) {
      setError(e.message || "No se pudieron cargar sugerencias");
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  }, [freight.id]);

  // Fetch only when expanded for the first time
  useEffect(() => {
    if (expanded && suggestions === null) fetchSuggestions();
  }, [expanded, suggestions, fetchSuggestions]);

  // Re-fetch when refreshKey changes (but only if already expanded)
  useEffect(() => {
    if (expanded && onRefreshKey) fetchSuggestions();
  }, [onRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssign = async (s) => {
    setAssigningId(s.truckId || s.companyId);
    try {
      if (s.type === "own_fleet" && s.truckId) {
        await onAssign({ transportCompanyId: s.companyId, truckId: s.truckId });
      } else {
        await onAssign({ transportCompanyId: s.companyId, truckId: s.truckId || undefined });
      }
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, marginBottom: 12, boxShadow: C.sh }}>
      {/* Header — clickable to expand/collapse */}
      <div onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
        <span style={{ display: "flex" }}>{Ic.star ? Ic.star(C.pri, 16) : Ic.chk(C.pri, 16)}</span>
        <span style={{ fontSize: 12.2, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>Sugerencias de asignación</span>
        <span style={{ display: "flex", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>{Ic.chev(C.t3, 14)}</span>
      </div>

      {!expanded ? null : <>
      {/* Loading */}
      {loading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>}

      {/* Error */}
      {!loading && error && (
        <div style={{ fontSize: 13.2, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>
          No se pudieron cargar sugerencias
          <button onClick={fetchSuggestions} style={{ background: "none", border: "none", color: C.pri, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Reintentar</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && suggestions?.length === 0 && (
        <div style={{ fontSize: 13.2, color: C.t3, fontStyle: "italic" }}>
          No se encontraron opciones de transporte disponibles.
        </div>
      )}

      {/* Suggestions */}
      {!loading && !error && suggestions?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {suggestions.map((s, i) => {
            const isAssigning = assigningId === (s.truckId || s.companyId);
            const isFirst = i === 0;
            return (
              <div key={s.truckId || s.companyId} style={{ position: "relative", background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.md, padding: 14, transition: "background 0.15s" }}
                onPointerEnter={e => e.currentTarget.style.background = C.bgAlt}
                onPointerLeave={e => e.currentTarget.style.background = C.w}>
                {/* Recommended badge */}
                {isFirst && (
                  <div style={{ position: "absolute", top: 8, right: 10, background: C.priPale, color: C.pri, fontSize: 11, fontWeight: 600, textTransform: "uppercase", borderRadius: R.xs, padding: "2px 8px" }}>
                    Recomendado
                  </div>
                )}
                {/* Row 1: availability dot + name + score */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: AVAIL_DOT[s.availability] || C.t3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.3, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: isFirst ? 90 : 0 }}>
                      {s.type === "own_fleet" ? "Flota propia" : s.companyName}
                    </div>
                  </div>
                  <ScoreBar score={s.score} />
                </div>
                {/* Row 2: plate + driver */}
                {(s.plate || s.driverName) && (
                  <div style={{ fontSize: 12.5, color: C.t2, marginBottom: 4, paddingLeft: 16 }}>
                    {s.plate}{s.plate && s.driverName ? " · " : ""}{s.driverName}
                  </div>
                )}
                {!s.plate && !s.driverName && s.type === "transporter" && (
                  <div style={{ fontSize: 12.5, color: C.t3, marginBottom: 4, paddingLeft: 16, fontStyle: "italic" }}>
                    Sin camiones registrados
                  </div>
                )}
                {/* Row 3: reasons */}
                <div style={{ fontSize: 13, color: C.t3, paddingLeft: 16, marginBottom: 8 }}>
                  {s.reasons.slice(0, 3).join(" · ")}
                  {s.reasons.length > 3 && (
                    <span style={{ color: C.t3, fontSize: 12 }}> +{s.reasons.length - 3} más</span>
                  )}
                </div>
                {/* Assign button */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn sm onClick={() => handleAssign(s)} disabled={!!assigningId}>
                    {isAssigning ? "Asignando..." : "Asignar"}
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual selection toggle */}
      {!loading && (
        <button onClick={() => setShowManual(p => !p)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: suggestions?.length ? 12 : 8, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: C.t2, padding: 0 }}>
          <span style={{ display: "flex", transform: showManual ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>{Ic.chev(C.t3, 12)}</span>
          Selección manual
        </button>
      )}
      </>}
    </div>
  );
}

// Export showManual state accessor for parent integration
AssignmentSuggestions.useShowManual = () => {
  const [show, setShow] = useState(false);
  return [show, setShow];
};
