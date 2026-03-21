import { useState, useEffect, useMemo } from "react";
import { C, Ic, R } from "../theme";
import { Loader } from "../components";
import { apiFreightSummary, apiByProducer, apiByProduct, apiByMonth, apiTransporterRanking } from "../api";

const PERIOD_OPTS = [
  { k: "week", l: "Semana" },
  { k: "month", l: "Mes" },
  { k: "campaign", l: "Campaña" },
];

const DONUT_COLORS = ["#43A047", "#F59E0B", "#0891B2", "#E53935", "#7C3AED", "#EC4899", "#14B8A6", "#FF6A00"];

function MetricCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 140, background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: R.md, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t3 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, color = C.pri, maxItems = 10 }) {
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 120, fontSize: 12.1, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{d[labelKey]}</div>
          <div style={{ flex: 1, height: 22, background: C.bg, borderRadius: R.sm, overflow: "hidden" }}>
            <div style={{ width: `${(d[valueKey] / max) * 100}%`, height: "100%", background: color, borderRadius: R.sm, transition: "width 0.4s ease", minWidth: 2 }} />
          </div>
          <span style={{ fontSize: 12.1, fontWeight: 700, color: C.t1, minWidth: 60, textAlign: "right" }}>{typeof d[valueKey] === "number" ? d[valueKey].toLocaleString("es-UY") : d[valueKey]}</span>
        </div>
      ))}
      {items.length === 0 && <div style={{ fontSize: 12.7, color: C.t3, padding: 12, textAlign: "center" }}>Sin datos</div>}
    </div>
  );
}

function DonutChart({ data, labelKey, valueKey }) {
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0) || 1;
  let offset = 0;
  const segments = data.slice(0, 8).map((d, i) => {
    const pct = (d[valueKey] / total) * 100;
    const seg = { ...d, pct, offset, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    offset += pct;
    return seg;
  });
  const r = 50, cx = 60, cy = 60, stroke = 14;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${(s.pct / 100) * circ} ${circ}`}
            strokeDashoffset={-(s.offset / 100) * circ}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "all 0.4s ease" }} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={C.t1} fontSize="16" fontWeight="800">{Math.round(total)}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={C.t3} fontSize="9" fontWeight="600">ton</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: R.xs, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.1, color: C.t1, flex: 1 }}>{s[labelKey]}</span>
            <span style={{ fontSize: 12.1, fontWeight: 700, color: C.t1 }}>{s[valueKey].toLocaleString("es-UY")} t</span>
            <span style={{ fontSize: 10.5, color: C.t3, minWidth: 32, textAlign: "right" }}>{Math.round(s.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }) {
  if (!data.length) return <div style={{ fontSize: 12.7, color: C.t3, padding: 12, textAlign: "center" }}>Sin datos</div>;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const maxTons = Math.max(...data.map(d => d.tons), 1);
  const w = 500, h = 140, px = 40, py = 10;
  const xStep = data.length > 1 ? (w - px * 2) / (data.length - 1) : 0;

  const countPoints = data.map((d, i) => `${px + i * xStep},${py + (1 - d.count / maxCount) * (h - py * 2)}`).join(" ");
  const tonsPoints = data.map((d, i) => `${px + i * xStep},${py + (1 - d.tons / maxTons) * (h - py * 2)}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${w} ${h + 20}`} style={{ width: "100%", maxWidth: w, height: "auto" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={px} y1={py + (1 - p) * (h - py * 2)} x2={w - px} y2={py + (1 - p) * (h - py * 2)} stroke={C.b2} strokeWidth="0.5" />
        ))}
        <polyline points={countPoints} fill="none" stroke={C.pri} strokeWidth="2" strokeLinejoin="round" />
        <polyline points={tonsPoints} fill="none" stroke={C.acc} strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />
        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={px + i * xStep} cy={py + (1 - d.count / maxCount) * (h - py * 2)} r="3" fill={C.pri} />
            <circle cx={px + i * xStep} cy={py + (1 - d.tons / maxTons) * (h - py * 2)} r="3" fill={C.acc} />
            <text x={px + i * xStep} y={h + 14} textAnchor="middle" fill={C.t3} fontSize="9" fontWeight="600">{d.month.slice(5)}</text>
          </g>
        ))}
        {/* Legend */}
        <circle cx={px} cy={h + 14} r="4" fill={C.pri} /><text x={px + 8} y={h + 17} fill={C.t2} fontSize="9">Fletes</text>
        <circle cx={px + 60} cy={h + 14} r="4" fill={C.acc} /><text x={px + 68} y={h + 17} fill={C.t2} fontSize="9">Toneladas</text>
      </svg>
    </div>
  );
}

export default function AnalyticsScreen({ user, onBack }) {
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [byProducer, setByProducer] = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [byMonth, setByMonth] = useState([]);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFreightSummary(period).catch(() => null),
      apiByProducer(period).catch(() => []),
      apiByProduct(period).catch(() => []),
      apiByMonth(12).catch(() => []),
      apiTransporterRanking(period).catch(() => []),
    ]).then(([s, bp, bpr, bm, r]) => {
      setSummary(s);
      setByProducer(bp || []);
      setByProduct(bpr || []);
      setByMonth(bm || []);
      setRanking(r || []);
    }).finally(() => setLoading(false));
  }, [period]);

  const isManager = ["admin", "gerente", "platform_admin"].includes(user?.role);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18, fontFamily: "inherit" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>{Ic.chev(C.pri, 18)}</button>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, flex: 1 }}>Estadísticas</span>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {PERIOD_OPTS.map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)} style={{
            padding: "7px 16px", borderRadius: R.md, fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, cursor: "pointer",
            border: `1.5px solid ${period === p.k ? C.pri : C.b1}`,
            background: period === p.k ? `${C.pri}10` : C.w,
            color: period === p.k ? C.pri : C.t3,
          }}>{p.l}</button>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Loader /></div> : <>
        {/* Summary cards */}
        {summary && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <MetricCard icon={Ic.truck(C.pri, 18)} label="Fletes totales" value={summary.totalFreights} color={C.pri} />
            <MetricCard icon={Ic.doc(C.acc, 18)} label="Toneladas" value={summary.totalTons.toLocaleString("es-UY")} sub="toneladas" color={C.acc} />
            <MetricCard icon={Ic.nav("#43A047", 18)} label="Activos ahora" value={summary.activeFreights} color="#43A047" />
            <MetricCard icon={Ic.chk(C.t2, 18)} label="Finalizados" value={summary.finishedFreights} color={C.t2} />
          </div>
        )}

        {/* By product — donut */}
        <Section title="Volumen por producto">
          <DonutChart data={byProduct} labelKey="grain" valueKey="tons" />
        </Section>

        {/* By producer — bar (manager only) */}
        {isManager && byProducer.length > 0 && (
          <Section title="Volumen por productor">
            <BarChart data={byProducer} labelKey="name" valueKey="tons" color="#F59E0B" />
          </Section>
        )}

        {/* Monthly — line */}
        <Section title="Actividad mensual">
          <LineChart data={byMonth} />
        </Section>

        {/* Transporter ranking */}
        {isManager && ranking.length > 0 && (
          <Section title="Ranking de transportistas">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.2, fontFamily: "inherit" }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${C.b1}` }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Transportista</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Completados</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Toneladas</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.companyId} style={{ borderBottom: `1px solid ${C.b2}` }}>
                      <td style={{ padding: "10px 10px", fontWeight: 700, color: i < 3 ? C.acc : C.t2 }}>{i + 1}</td>
                      <td style={{ padding: "10px 10px", fontWeight: 600, color: C.t1 }}>{r.name}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{r.finishedAssignments}/{r.totalAssignments}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: C.pri }}>{r.tons.toLocaleString("es-UY")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
      <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
