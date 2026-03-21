import { memo } from "react";
import { C, Ic, MONO, R, STATUS_COLORS } from "../theme";
import { formatFreightDate } from "../constants";
import { originDisplay, destDisplay } from "../hooks";

const MESES_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtDateTime(dateStr, timeStr) {
  if (!dateStr) return "";
  const p = dateStr.split("-");
  if (p.length < 3) return dateStr;
  const d = p[2].padStart(2, "0");
  const m = parseInt(p[1], 10) - 1;
  const mon = MESES_SHORT[m] || p[1];
  const base = `${d}/${mon}`;
  if (timeStr?.trim()) return `${base} ${timeStr.trim()}`;
  return base;
}

function fmtDateOnly(dateStr) {
  if (!dateStr) return "";
  const p = dateStr.split("-");
  if (p.length < 3) return dateStr;
  return `${p[2].padStart(2, "0")}/${MESES_SHORT[parseInt(p[1], 10) - 1] || p[1]}`;
}

function PulseDot({ color, size = 6 }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, animation: "tolvinkPulse 1.5s infinite", flexShrink: 0 }} />;
}

function StatusPill({ status, small }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending_assignment;
  const pad = small ? "2px 8px" : "3px 10px";
  const fs = small ? 10 : 11;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: sc.pillBg, padding: pad, borderRadius: R.pill, flexShrink: 0 }}>
      {sc.pulse && <PulseDot color={sc.ribbon} size={small ? 5 : 6} />}
      <span style={{ fontSize: fs, fontWeight: 500, color: sc.pillText, whiteSpace: "nowrap" }}>{sc.label}</span>
    </span>
  );
}

// ======================== FULL CARD ====================================
export const FreightCard = memo(function FreightCard({ freight: f, onClick, style, selected, checkbox }) {
  const sc = STATUS_COLORS[f.status] || STATUS_COLORS.pending_assignment;
  const origin = originDisplay(f) || f.originCompanyName || "Sin origen";
  const dest = destDisplay(f) || "Sin destino";
  const isCustomDest = !f.destPlantId && f.destLat && f.destLng;
  const grain = f.grain === "Otros" ? (f.productTypeOther || "Otros") : f.grain;
  const title = `${grain} · ${f.tons}${f.unit && f.unit !== "toneladas" ? ` ${f.unit}` : "tn"}`;

  const transport = f.transporterName || "Sin asignar";
  const plate = f.truckPlate;
  const driver = f.driverName;
  const dateTime = fmtDateTime(f.loadDate, f.loadTime);

  return (
    <div
      className="tv-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Flete ${f.code}`}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
      style={{
        display: "flex", borderRadius: R.sm, border: selected ? "1.5px solid #1A6B37" : `0.5px solid ${C.b1}`,
        overflow: "hidden", cursor: onClick ? "pointer" : "default",
        background: selected ? "#F5FBF7" : C.w, transition: "border-color 0.15s",
        ...style,
      }}
    >
      {/* Ribbon */}
      <div style={{ width: 20, background: sc.ribbon, flexShrink: 0 }} />
      {/* Content */}
      <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
        {/* Row 1: code + title | pill + checkbox */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: 12, color: C.t2, fontFamily: MONO, marginRight: 8, flexShrink: 0 }}>{f.code}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, flexShrink: 0 }}>
            <StatusPill status={f.status} />
            {checkbox}
          </div>
        </div>
        {/* Row 2: route */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
          {Ic.pin("#888", 13)}
          <span style={{ fontSize: 12, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{origin}</span>
          <span style={{ fontSize: 12, color: C.t2, flexShrink: 0 }}>→</span>
          {isCustomDest ? Ic.pin("#888", 12) : Ic.plant("#666", 12)}
          <span style={{ fontSize: 12, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dest}</span>
        </div>
        {/* Producer badge (plant-centric) */}
        {f.producerCompanyName && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            {Ic.user(C.acc, 11)}
            <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>{f.producerCompanyName}</span>
          </div>
        )}
        {/* Row 3: transport + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {Ic.truck(C.t2, 13)}
          <span style={{ fontSize: 12, color: C.t1, fontWeight: 500 }}>{transport}</span>
          {plate && <span style={{ fontSize: 11, color: C.t2 }}> · {plate}</span>}
          {driver && <span style={{ fontSize: 11, color: C.t2 }}> · {driver}</span>}
          {dateTime && <span style={{ fontSize: 11, color: C.t2, marginLeft: "auto", flexShrink: 0 }}>{dateTime}</span>}
        </div>
      </div>
    </div>
  );
});

// ======================== COMPACT CARD ==================================
export const FreightCardCompact = memo(function FreightCardCompact({ freight: f, onClick, style, showTime }) {
  const sc = STATUS_COLORS[f.status] || STATUS_COLORS.pending_assignment;
  const origin = originDisplay(f) || f.originCompanyName || "Sin origen";
  const dest = destDisplay(f) || "Sin destino";
  const isCustomDest = !f.destPlantId && f.destLat && f.destLng;
  const grain = f.grain === "Otros" ? (f.productTypeOther || "Otros") : f.grain;
  const title = `${grain} · ${f.tons}${f.unit && f.unit !== "toneladas" ? ` ${f.unit}` : "tn"}`;
  const date = showTime ? fmtDateTime(f.loadDate, f.loadTime) : fmtDateOnly(f.loadDate);

  // Abbreviated names: take first segment before " / " or " — "
  const shortOrigin = origin.split(/\s*[\/—]\s*/)[0];
  const shortDest = dest.split(/\s*[\/—]\s*/)[0];

  return (
    <div
      className="tv-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Flete ${f.code}`}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
      style={{
        display: "flex", borderRadius: R.sm, border: `0.5px solid ${C.b1}`,
        overflow: "hidden", cursor: onClick ? "pointer" : "default",
        background: C.w, transition: "border-color 0.15s",
        ...style,
      }}
    >
      {/* Ribbon */}
      <div style={{ width: 20, background: sc.ribbon, flexShrink: 0 }} />
      {/* Content */}
      <div style={{ padding: "8px 12px", flex: 1, minWidth: 0 }}>
        {/* Row 1: code | pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontSize: 11, color: C.t2, fontFamily: MONO }}>{f.code}</span>
          <StatusPill status={f.status} small />
        </div>
        {/* Row 2: title */}
        <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {/* Producer badge (plant-centric) */}
        {f.producerCompanyName && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
            {Ic.user(C.acc, 10)}
            <span style={{ fontSize: 10, color: C.acc, fontWeight: 600 }}>{f.producerCompanyName}</span>
          </div>
        )}
        {/* Row 3: route + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {Ic.pin("#888", 11)}
          <span style={{ fontSize: 11, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortOrigin}</span>
          <span style={{ fontSize: 11, color: C.t2, flexShrink: 0 }}>→</span>
          {isCustomDest ? Ic.pin("#888", 10) : Ic.plant("#666", 10)}
          <span style={{ fontSize: 11, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortDest}</span>
          {date && <span style={{ fontSize: 10, color: C.t2, marginLeft: "auto", flexShrink: 0 }}>{date}</span>}
        </div>
      </div>
    </div>
  );
});

// ======================== TRIP PROGRESS BAR ==============================
export function TripProgressBar({ status, ribbon, small }) {
  const pct = status === "in_progress" ? 40 : status === "loaded" ? 75 : status === "finished" ? 100 : 0;
  const sz = small ? 20 : 24;
  const barH = small ? 3 : 4;
  return (
    <div style={{ position: "relative", height: barH, background: C.b1, borderRadius: R.xs, flex: 1 }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: ribbon, borderRadius: R.xs, transition: "width 0.3s" }} />
      {pct > 0 && pct < 100 && (
        <div style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)", width: sz, height: sz, borderRadius: "50%", background: ribbon, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Ic.truck("#fff", small ? 11 : 13)}
        </div>
      )}
    </div>
  );
}

// ======================== ACTIVE TRIP CARD (HomeScreen) ==================
export const ActiveTripCard = memo(function ActiveTripCard({ freight: f, onClick }) {
  const sc = STATUS_COLORS[f.status] || STATUS_COLORS.in_progress;
  const origin = originDisplay(f) || f.originCompanyName || "Sin origen";
  const dest = destDisplay(f) || "Sin destino";
  const isCustomDest = !f.destPlantId && f.destLat && f.destLng;
  const grain = f.grain === "Otros" ? (f.productTypeOther || "Otros") : f.grain;
  const title = `${grain} · ${f.tons}${f.unit && f.unit !== "toneladas" ? ` ${f.unit}` : "tn"}`;
  const dateTime = fmtDateTime(f.loadDate, f.loadTime);
  const aa = (f.activeAssignments || []).filter(a => a.tripStatus === "in_progress" || a.tripStatus === "loaded");
  const isMulti = aa.length > 1;

  return (
    <div className="tv-card" onClick={onClick} role="button" tabIndex={0} aria-label={`Flete ${f.code}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }} style={{ display: "flex", borderRadius: R.sm, border: `0.5px solid ${C.b1}`, overflow: "hidden", cursor: "pointer", background: C.w }}>
      <div style={{ width: 20, background: sc.ribbon, flexShrink: 0 }} />
      <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: 12, color: C.t2, fontFamily: MONO, marginRight: 8, flexShrink: 0 }}>{f.code}</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </div>
          <StatusPill status={f.status} />
        </div>

        {/* Producer badge (plant-centric) */}
        {f.producerCompanyName && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            {Ic.user(C.acc, 11)}
            <span style={{ fontSize: 11, color: C.acc, fontWeight: 600 }}>{f.producerCompanyName}</span>
          </div>
        )}

        {isMulti ? (
          /* Multi-truck: route header + per-truck bars */
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
              {Ic.pin("#888", 13)}
              <span style={{ fontSize: 12, color: C.t2 }}>{origin}</span>
              <span style={{ fontSize: 12, color: C.t2 }}>→</span>
              {isCustomDest ? Ic.pin("#888", 12) : Ic.plant("#666", 12)}
              <span style={{ fontSize: 12, color: C.t2 }}>{dest}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {aa.map(a => {
                const tsc = STATUS_COLORS[a.tripStatus] || sc;
                return (
                  <div key={a.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: C.t1 }}>{a.plate || "?"} · {a.driverName || "Sin chofer"}</span>
                      <span style={{ fontSize: 10, fontWeight: 500, color: tsc.pillText }}>{tsc.label}</span>
                    </div>
                    <TripProgressBar status={a.tripStatus} ribbon={tsc.ribbon} small />
                  </div>
                );
              })}
            </div>
            <div style={{ background: C.bgCardAlt, borderRadius: R.sm, padding: "7px 10px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.t2 }}>
                {aa.filter(a => a.tripStatus === "in_progress").length} a campo · {aa.filter(a => a.tripStatus === "loaded").length} a planta
              </span>
              {dateTime && <span style={{ fontSize: 11, color: C.t2 }}>{dateTime}</span>}
            </div>
          </>
        ) : (
          /* Single-truck: progress bar with pictograms */
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              {/* Origin pictogram */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 50 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.bgCardAlt, border: "1.5px solid #888", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Ic.pin("#888", 16)}
                </div>
                <span style={{ fontSize: 10, color: C.t3, textAlign: "center", marginTop: 3, lineHeight: 1.2, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{origin.split(/\s*[\/—]\s*/)[0]}</span>
              </div>
              {/* Progress bar */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", marginTop: 14 }}>
                <TripProgressBar status={f.status} ribbon={sc.ribbon} />
              </div>
              {/* Dest pictogram */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 50 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.bgCardAlt, border: "1.5px solid #888", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isCustomDest ? Ic.pin("#888", 16) : Ic.plant("#666", 16)}
                </div>
                <span style={{ fontSize: 10, color: C.t3, textAlign: "center", marginTop: 3, lineHeight: 1.2, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dest.split(/\s*[\/—]\s*/)[0]}</span>
              </div>
            </div>
            {/* Footer */}
            <div style={{ background: C.bgCardAlt, borderRadius: R.sm, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: sc.ribbon, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Ic.user("#fff", 11)}
                </div>
                {f.truckPlate && <span style={{ fontSize: 12, color: C.t1, fontWeight: 500 }}>{f.truckPlate}</span>}
                {f.driverName && <span style={{ fontSize: 11, color: C.t2 }}>{f.driverName}</span>}
              </div>
              {dateTime && <span style={{ fontSize: 11, color: C.t2 }}>{dateTime}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// ======================== CALENDAR CHIP =================================
export const CalendarChip = memo(function CalendarChip({ freight: f }) {
  const sc = STATUS_COLORS[f.status] || STATUS_COLORS.pending_assignment;
  const grain = f.grain === "Otros" ? (f.productTypeOther || "Otros") : f.grain;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: sc.pillBg, padding: "2px 4px", borderRadius: R.xs, marginBottom: 2 }}>
      <div style={{ width: 3, height: 12, background: sc.ribbon, borderRadius: R.xs, flexShrink: 0 }} />
      <span style={{ fontSize: 8, color: sc.pillText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{grain} {f.tons}t</span>
    </div>
  );
});

export { StatusPill, PulseDot };
