import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C, Ic, R, STATUS_COLORS } from "../theme";
import { Btn, Loader, EmptyState } from "../components";
import { apiGetAllWeighTickets } from "../api";

const TYPE_LABELS = { origin: "Origen", destination: "Destino" };
const TYPE_COLORS = { origin: "#43A047", destination: "#0891B2" };

function fmtWeight(v) {
  if (v == null) return "—";
  const n = Number(v);
  return isNaN(n) ? "—" : n.toLocaleString("es-UY") + " kg";
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-UY", { day: "2-digit", month: "short" }) + " " + dt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

export default function TicketsScreen({ user, onBack }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // "" | "origin" | "destination"
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetAllWeighTickets({ type: typeFilter || undefined, search: search || undefined, limit: 50 });
      setTickets(res?.items || []);
      setTotal(res?.total || 0);
    } catch { setTickets([]); setTotal(0); }
    finally { setLoading(false); }
  }, [typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const StatusPill = ({ status }) => {
    const sc = STATUS_COLORS[status] || { pillBg: C.bg, pillText: C.t3, label: status };
    return <span style={{ padding: "2px 8px", borderRadius: R.sm, fontSize: 10.5, fontWeight: 700, background: sc.pillBg, color: sc.pillText }}>{sc.label}</span>;
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18, fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>{Ic.chev(C.pri, 18)}</button>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, flex: 1 }}>Tickets de Pesaje</span>
        <span style={{ fontSize: 12.1, color: C.t3, fontWeight: 600 }}>{total} ticket{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{Ic.srch(C.t3, 14)}</span>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar por nro ticket o código flete..."
            style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: R.md, border: `1.5px solid ${searchInput ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }} />
        </div>
        {["", "origin", "destination"].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: "7px 14px", borderRadius: R.md, fontFamily: "inherit", fontSize: 12.7, fontWeight: 600, cursor: "pointer",
            border: `1.5px solid ${typeFilter === t ? (t ? TYPE_COLORS[t] : C.pri) : C.b1}`,
            background: typeFilter === t ? (t ? `${TYPE_COLORS[t]}14` : `${C.pri}10`) : C.w,
            color: typeFilter === t ? (t ? TYPE_COLORS[t] : C.pri) : C.t3,
          }}>{t ? TYPE_LABELS[t] : "Todos"}</button>
        ))}
      </div>

      {/* Content */}
      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Loader /></div> :
        tickets.length === 0 ? (
          <EmptyState icon={Ic.doc(C.t3, 28)} title="Sin tickets de pesaje"
            subtitle={search ? "No hay resultados para esta búsqueda" : "Los tickets aparecerán aquí cuando se registren pesajes"} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tickets.map(t => {
              const isExp = expanded === t.id;
              const freight = t.freight || {};
              const grain = freight.items?.[0]?.grain || "";
              const typeColor = TYPE_COLORS[t.type] || C.t3;
              const hasOcr = t.ocrConfidence != null;
              const conf = hasOcr ? Math.round(Number(t.ocrConfidence) * 100) : null;

              return (
                <div key={t.id} onClick={() => setExpanded(isExp ? null : t.id)} style={{
                  background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${typeColor}`,
                  borderRadius: R.lg, padding: 14, boxShadow: C.sh, cursor: "pointer", transition: "all 0.15s",
                }}>
                  {/* Main row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: R.md, background: `${typeColor}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {Ic.doc(typeColor, 18)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15.4, fontWeight: 700 }}>{t.ticketNumber || "Sin número"}</span>
                        <span style={{ padding: "2px 7px", borderRadius: R.sm, fontSize: 10, fontWeight: 700, background: `${typeColor}18`, color: typeColor }}>{TYPE_LABELS[t.type] || t.type}</span>
                        {hasOcr && <span style={{ padding: "2px 7px", borderRadius: R.sm, fontSize: 10, fontWeight: 700, background: C.priPale, color: C.pri }}>OCR {conf}%</span>}
                      </div>
                      <div style={{ fontSize: 12.1, color: C.t3, marginTop: 3 }}>
                        {fmtWeight(t.netWeight)} neto · {fmtDate(t.registeredAt)}
                      </div>
                    </div>
                    {/* Freight badge */}
                    {freight.code && (
                      <button onClick={e => { e.stopPropagation(); navigate(`/freight/${freight.id}`); }} style={{
                        padding: "4px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bg,
                        cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: C.pri,
                        display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                      }}>
                        {freight.code} <StatusPill status={freight.status} />
                      </button>
                    )}
                    <span style={{ display: "flex", transform: isExp ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>{Ic.chev(C.t3, 14)}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.b2}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 10 }}>
                        <DetailCell label="Peso Bruto" value={fmtWeight(t.grossWeight)} />
                        <DetailCell label="Tara" value={fmtWeight(t.tareWeight)} />
                        <DetailCell label="Peso Neto" value={fmtWeight(t.netWeight)} bold />
                        <DetailCell label="Humedad" value={t.humidity != null ? Number(t.humidity) + "%" : "—"} />
                        <DetailCell label="Impurezas" value={t.impurities != null ? Number(t.impurities) + "%" : "—"} />
                        <DetailCell label="Merma" value={t.dockage != null ? Number(t.dockage) : "—"} />
                        <DetailCell label="Temperatura" value={t.temperature != null ? Number(t.temperature) + "°C" : "—"} />
                      </div>
                      {t.observations && <div style={{ fontSize: 12.1, color: C.t2, marginBottom: 8 }}>{t.observations}</div>}
                      {t.photoUrl && (
                        <div style={{ marginBottom: 8 }}>
                          <img src={t.photoUrl} alt="Ticket" style={{ maxWidth: 200, maxHeight: 160, borderRadius: R.md, border: `1px solid ${C.b1}`, objectFit: "cover" }} />
                        </div>
                      )}
                      {/* Freight info */}
                      {freight.code && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: R.md, background: C.bg, border: `1px solid ${C.b2}` }}>
                          {Ic.truck(C.acc, 16)}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13.2, fontWeight: 600, color: C.t1 }}>{freight.code}</span>
                            {grain && <span style={{ fontSize: 12.1, color: C.t3, marginLeft: 8 }}>{grain}</span>}
                            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{freight.originName} → {freight.destName}</div>
                          </div>
                          <Btn sm onClick={e => { e.stopPropagation(); navigate(`/freight/${freight.id}`); }}>Ver flete</Btn>
                        </div>
                      )}
                      {t.registeredBy && <div style={{ fontSize: 11, color: C.t3, marginTop: 6 }}>Registrado por {t.registeredBy.name}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

function DetailCell({ label, value, bold }) {
  return (
    <div style={{ padding: "6px 8px", borderRadius: R.sm, background: C.bg }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14.3, fontWeight: bold ? 700 : 500, color: C.t1 }}>{value}</div>
    </div>
  );
}
