import { useEffect, useMemo, useState } from "react";
import { C, Ic, R } from "../theme";
import { Loader } from "../components";
import { apiGetStockSummary } from "../api";

function formatQty(value, unit) {
  const num = Number(value || 0);
  return `${num.toLocaleString("es-UY", { maximumFractionDigits: 3 })} ${unit || ""}`.trim();
}

function SummaryCard({ title, value, sub, icon, color }) {
  return (
    <div style={{ flex: 1, minWidth: 170, background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: R.md, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <span style={{ fontSize: 12.1, fontWeight: 700, color: C.t3 }}>{title}</span>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: C.t1, letterSpacing: -0.4 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1 }}>{title}</div>
        {action || null}
      </div>
      {children}
    </div>
  );
}

export default function StockScreen({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGetStockSummary();
      setSummary(data);
    } catch (e) {
      setError(e.message || "No se pudo cargar el resumen de stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.activeCompanyId]);

  const totals = useMemo(() => {
    const categories = summary?.categories || [];
    return categories.reduce((acc, item) => {
      acc.own += Number(item.ownQuantity || 0);
      acc.thirdParty += Number(item.thirdPartyQuantity || 0);
      acc.total += Number(item.totalQuantity || 0);
      return acc;
    }, { own: 0, thirdParty: 0, total: 0 });
  }, [summary]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18, fontFamily: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
          {Ic.chev(C.pri, 18)}
        </button>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, flex: 1 }}>Stock y Acopio</span>
        <button
          onClick={load}
          style={{ padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.w, color: C.t2, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          Actualizar
        </button>
      </div>

      <div style={{ fontSize: 13.2, color: C.t3, marginBottom: 16 }}>
        Empresa activa: <strong style={{ color: C.t1 }}>{user?.entity || "-"}</strong>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><Loader /></div>
      ) : error ? (
        <div style={{ background: C.errPale, color: C.err, border: `1px solid ${C.err}22`, borderRadius: R.lg, padding: 16, fontSize: 13.2, fontWeight: 600 }}>
          {error}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <SummaryCard title="Stock propio" value={totals.own.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub="Acopio interno" icon={Ic.grain(C.pri, 18)} color={C.pri} />
            <SummaryCard title="Stock en terceros" value={totals.thirdParty.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub="Depositado fuera del establecimiento" icon={Ic.plant(C.acc, 18)} color={C.acc} />
            <SummaryCard title="Stock total" value={totals.total.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub={`${summary?.items?.length || 0} item(s) con saldo`} icon={Ic.chk(C.info, 18)} color={C.info} />
          </div>

          <Section title="Por categoria">
            {summary?.categories?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {summary.categories.map((category) => (
                  <div key={category.category} style={{ border: `1px solid ${C.b2}`, borderRadius: R.md, padding: 12, background: C.bg }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      {category.category}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{formatQty(category.totalQuantity, category.baseUnit)}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12.1, color: C.t3 }}>
                      <span>Propio: <strong style={{ color: C.t1 }}>{formatQty(category.ownQuantity, category.baseUnit)}</strong></span>
                      <span>Terceros: <strong style={{ color: C.t1 }}>{formatQty(category.thirdPartyQuantity, category.baseUnit)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>Todavia no hay stock cargado para esta empresa.</div>
            )}
          </Section>

          <Section title="Items con saldo">
            {summary?.items?.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.2, fontFamily: "inherit" }}>
                  <thead>
                    <tr style={{ borderBottom: `1.5px solid ${C.b1}` }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Item</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Categoria</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Propio</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Terceros</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items.map((item) => (
                      <tr key={item.itemId} style={{ borderBottom: `1px solid ${C.b2}` }}>
                        <td style={{ padding: "10px", fontWeight: 700, color: C.t1 }}>{item.itemName}</td>
                        <td style={{ padding: "10px", color: C.t2 }}>{item.category}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.t1 }}>{formatQty(item.ownQuantity, item.baseUnit)}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.t1 }}>{formatQty(item.thirdPartyQuantity, item.baseUnit)}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: C.pri }}>{formatQty(item.totalQuantity, item.baseUnit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>No hay items con movimientos registrados.</div>
            )}
          </Section>

          <Section title="Movimientos recientes">
            {summary?.recentMovements?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {summary.recentMovements.map((movement) => (
                  <div key={movement.id} style={{ border: `1px solid ${C.b2}`, borderRadius: R.md, padding: 12, background: C.bg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1 }}>
                          {movement.itemName} <span style={{ color: C.t3, fontWeight: 600 }}>· {movement.movementType}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
                          {movement.fromLocation ? `${movement.fromLocation} -> ` : ""}
                          {movement.toLocation || "Sin destino"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13.2, fontWeight: 800, color: C.pri }}>{formatQty(movement.quantity, movement.baseUnit)}</div>
                        <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>{new Date(movement.effectiveAt).toLocaleString("es-UY")}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>Todavia no hay movimientos de stock.</div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
