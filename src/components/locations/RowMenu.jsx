import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { C, FONT } from "../../theme";

export default function RowMenu({ id, items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  const btnRef = useRef(null);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 220;
    setPos({
      above,
      top: above ? rect.top : rect.bottom + 4,
      left: Math.max(8, rect.right - 180),
    });
    setOpen(true);
  };

  const dropdown = open ? createPortal(
    <>
      <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      <div
        style={{
          position: "fixed",
          left: pos.left,
          ...(pos.above ? { bottom: window.innerHeight - pos.top + 4 } : { top: pos.top }),
          minWidth: 180, background: C.w,
          border: `1px solid ${C.b1}`, borderRadius: 10,
          boxShadow: C.shMd, padding: "4px 0",
          zIndex: 9999,
          animation: "rowMenuIn 150ms ease-out",
        }}
      >
        <style>{`@keyframes rowMenuIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", background: "transparent", border: "none",
              borderTop: item.danger ? `1px solid ${C.b2}` : "none",
              cursor: "pointer", fontFamily: FONT, fontSize: 15,
              fontWeight: 400, color: item.danger ? C.err : C.t1,
              textAlign: "left",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.bgCard}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          height: 32, borderRadius: 8, padding: "0 10px",
          background: open ? C.bgCard : "transparent",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          fontSize: 12.1, color: C.t3, fontFamily: FONT, fontWeight: 600,
        }}
      >
        Opciones <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1 }}>⋮</span>
      </button>
      {dropdown}
    </div>
  );
}
