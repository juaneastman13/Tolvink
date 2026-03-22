import { memo } from "react";
import { FONT, MONO } from "../../theme";

const SIZES = {
  sm: { hPad: "1.5px 6px", uFs: 6, uLs: 1, fW: 10.7, fH: 7.65, fR: 4, bPad: "2px 6px 3px", pFs: 13, pLs: 1.5 },
  md: { hPad: "2.5px 8px", uFs: 8, uLs: 1.5, fW: 13.8, fH: 9.2, fR: 6, bPad: "3px 10px 5px", pFs: 18, pLs: 2 },
  lg: { hPad: "3px 10px", uFs: 10, uLs: 2, fW: 18.4, fH: 12.2, fR: 6, bPad: "6px 16px 8px", pFs: 28, pLs: 3 },
};

function normalize(plate) {
  if (!plate) return "";
  const clean = plate.replace(/[\s\-]/g, "").toUpperCase();
  if (/^[A-Z]{3}\d{4}$/.test(clean)) return clean.slice(0, 3) + " " + clean.slice(3);
  return clean;
}

function Flag({ w, h }) {
  const stripeH = h / 9;
  const cantonW = w * 0.4;
  const cantonH = stripeH * 5;
  const sunCx = cantonW / 2;
  const sunCy = cantonH / 2;
  const sunR = Math.min(cantonW, cantonH) * 0.18;
  const rays = 16;
  const rLong = sunR * 2.1;
  const rShort = sunR * 1.5;
  const rayPaths = [];
  for (let i = 0; i < rays; i++) {
    const angle = (i * 360) / rays - 90;
    const rad = (angle * Math.PI) / 180;
    const r = i % 2 === 0 ? rLong : rShort;
    rayPaths.push(`M${sunCx},${sunCy}L${sunCx + Math.cos(rad) * r},${sunCy + Math.sin(rad) * r}`);
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={0} y={i * stripeH} width={w} height={stripeH} fill={i % 2 === 0 ? "#fff" : "#003DA5"} />
      ))}
      <rect x={0} y={0} width={cantonW} height={cantonH} fill="#fff" />
      <path d={rayPaths.join("")} stroke="#D4A017" strokeWidth={sunR * 0.25} fill="none" />
      <circle cx={sunCx} cy={sunCy} r={sunR} fill="#F5C400" stroke="#D4A017" strokeWidth={sunR * 0.15} />
      <circle cx={sunCx - sunR * 0.25} cy={sunCy - sunR * 0.15} r={sunR * 0.1} fill="#8B6914" />
      <circle cx={sunCx + sunR * 0.25} cy={sunCy - sunR * 0.15} r={sunR * 0.1} fill="#8B6914" />
      <path d={`M${sunCx - sunR * 0.2},${sunCy + sunR * 0.2} Q${sunCx},${sunCy + sunR * 0.4} ${sunCx + sunR * 0.2},${sunCy + sunR * 0.2}`} stroke="#8B6914" strokeWidth={sunR * 0.08} fill="none" />
    </svg>
  );
}

export const LicensePlate = memo(function LicensePlate({ plate, size = "sm" }) {
  if (!plate) return null;
  const s = SIZES[size] || SIZES.sm;
  const display = normalize(plate);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", border: "2px solid #1a1a1a", borderRadius: 4, overflow: "hidden", boxShadow: "0 0 0 0.5px #000", verticalAlign: "middle", lineHeight: 1 }}>
      <span style={{ background: "#003DA5", display: "flex", alignItems: "center", position: "relative", padding: s.hPad }}>
        <span style={{ width: "100%", textAlign: "center", color: "#fff", fontWeight: 700, fontSize: s.uFs, letterSpacing: s.uLs, fontFamily: FONT, lineHeight: 1.2 }}>URUGUAY</span>
        <span style={{ position: "absolute", right: s.fR, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Flag w={s.fW} h={s.fH} />
        </span>
      </span>
      <span style={{ background: "#f8f8f8", textAlign: "center", padding: s.bPad }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, color: "#1a1a1a", fontSize: s.pFs, letterSpacing: s.pLs, lineHeight: 1 }}>{display}</span>
      </span>
    </span>
  );
});

export default LicensePlate;
