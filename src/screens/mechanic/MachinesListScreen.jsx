import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C, R, FONT, Ic } from "../../theme";
import { apiListMachines } from "../../api";

const MACHINE_TYPES = [
  { value: "", label: "Todos" },
  { value: "tractor", label: "Tractores" },
  { value: "harvester", label: "Cosechadoras" },
  { value: "seeder", label: "Sembradoras" },
  { value: "baler", label: "Enfardadoras" },
  { value: "implement", label: "Implementos" },
  { value: "truck", label: "Camiones" },
  { value: "other", label: "Otros" },
];

const TYPE_LABELS = { tractor: "Tractor", harvester: "Cosechadora", seeder: "Sembradora", baler: "Enfardadora", implement: "Implemento", truck: "Camión", car: "Auto", motorcycle: "Moto", other: "Otro" };

export default function MachinesListScreen({ onNavigate }) {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiListMachines({ machineType: filter || undefined, search: search || undefined });
      setMachines(data);
    } catch { setMachines([]); }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (!loading && machines.length === 0 && !filter && !search) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, fontFamily: FONT }}>
        <div style={{ width: 64, height: 64, borderRadius: R.xl, background: C.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Ic.gear(C.muted, 32)}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Sin máquinas registradas</h2>
        <p style={{ fontSize: 14, color: C.t3, textAlign: "center" }}>Registrá tu primera máquina para empezar a gestionar tu flota</p>
        <button onClick={() => navigate("/mechanic/machines/new")} style={{ padding: "10px 24px", borderRadius: R.lg, border: "none", background: C.pri, color: C.tOn, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
          + Registrar máquina
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 16 : 24, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, margin: 0 }}>Mis Máquinas</h1>
        <button onClick={() => navigate("/mechanic/machines/new")} style={{ padding: "8px 18px", borderRadius: R.lg, border: "none", background: C.pri, color: C.tOn, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}>
          {Ic.plus(C.tOn, 16)} Agregar máquina
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {MACHINE_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)} style={{
              padding: "6px 14px", borderRadius: R.pill, border: `1px solid ${filter === t.value ? C.pri : C.b1}`,
              background: filter === t.value ? C.priPale : C.bgCard, color: filter === t.value ? C.pri : C.t2,
              fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar marca, modelo..." style={{
            width: "100%", padding: "8px 12px 8px 34px", borderRadius: R.md, border: `1px solid ${C.b1}`,
            background: C.bgInput, fontSize: 13, color: C.t1, fontFamily: FONT, outline: "none",
            boxSizing: "border-box",
          }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>{Ic.srch(C.t3, 14)}</span>
        </div>
      </div>

      {/* Loading */}
      {loading && <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>Cargando...</div>}

      {/* Grid */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {machines.map(m => (
            <button key={m.id} onClick={() => navigate(`/mechanic/machines/${m.id}`)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: R.lg,
              border: `1px solid ${C.b1}`, background: C.bgCard, cursor: "pointer", fontFamily: FONT,
              textAlign: "left", boxShadow: C.sh, transition: "box-shadow 0.15s", width: "100%",
            }}>
              {/* Placeholder icon */}
              <div style={{ width: 52, height: 52, borderRadius: R.md, background: C.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {m.photos?.length > 0
                  ? <img src={m.photos[0]} alt="" style={{ width: 52, height: 52, borderRadius: R.md, objectFit: "cover" }} />
                  : Ic.gear(C.muted, 24)
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.brand} {m.model}
                </div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
                  {TYPE_LABELS[m.machineType] || m.machineType}{m.year ? ` · ${m.year}` : ""}
                </div>
                {m.currentHorometer != null && (
                  <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}>{Ic.clk(C.t3, 12)} {m.currentHorometer.toLocaleString()} hs</div>
                )}
              </div>
              <div style={{ width: 8, height: 8, borderRadius: R.full, background: m.status === "active" ? C.ok : C.muted, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {!loading && machines.length === 0 && (filter || search) && (
        <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14 }}>Sin resultados para esta búsqueda</div>
      )}
    </div>
  );
}
