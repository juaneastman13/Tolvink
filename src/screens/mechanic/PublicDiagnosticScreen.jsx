import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { C, R, FONT, MONO, Ic } from "../../theme";
import { apiGetPublicDiagnostic } from "../../api";

export default function PublicDiagnosticScreen() {
  const location = useLocation();
  const shareToken = location.pathname.split("/public/diagnostic/")[1];
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetPublicDiagnostic(shareToken)
      .then(setData)
      .catch(e => setError(e?.message || "Enlace no válido o expirado"))
      .finally(() => setLoading(false));
  }, [shareToken]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (loading) return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: FONT, color: C.t3 }}>Cargando...</div>;

  if (error) return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: FONT, gap: 16, padding: 32 }}>
      <span style={{ fontSize: 42, fontWeight: 800, color: C.pri, letterSpacing: -2 }}>tolvink</span>
      <p style={{ fontSize: 16, fontWeight: 600, color: C.t1 }}>{error}</p>
      <a href="https://tolvink.com" style={{ fontSize: 13, color: C.pri, fontWeight: 600, textDecoration: "none" }}>Conocé Tolvink Mecánico →</a>
    </div>
  );

  const m = data.machine;
  const messages = data.messages || [];

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: C.bgCard, borderBottom: `1px solid ${C.b1}`, padding: "16px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.pri, letterSpacing: -1 }}>tolvink</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "rgba(71,85,105,0.1)", padding: "2px 7px", borderRadius: R.sm }}>Mecánico</span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: "0 0 6px" }}>{data.title || "Diagnóstico compartido"}</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>
            {m.brand} {m.model} {m.year ? `(${m.year})` : ""} · {m.enginePower || ""}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: isMobile ? 16 : 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: R.lg,
              background: msg.role === "user" ? C.pri : C.bgCard,
              color: msg.role === "user" ? C.tOn : C.t1,
              border: msg.role === "assistant" ? `1px solid ${C.b1}` : "none",
              fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.mediaUrls?.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {msg.mediaUrls.map((url, j) => (
                    <img key={j} src={url} alt="" style={{ maxWidth: 180, maxHeight: 180, borderRadius: R.md, objectFit: "cover" }} />
                  ))}
                </div>
              )}
              {msg.content}
              {msg.suggestedParts?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {msg.suggestedParts.map((part, pi) => (
                    <div key={pi} style={{ padding: 10, borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bgCardAlt }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 4 }}>{part.description}</div>
                      <div style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: C.pri }}>{part.partNumber} ({part.brand})</div>
                      {part.sourceUrl && <a href={part.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.info }}>Ver en catálogo →</a>}
                      {part.crossReferences?.length > 0 && <div style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>Alt: {part.crossReferences.map(cr => `${cr.brand} ${cr.partNumber}`).join(" · ")}</div>}
                      {part.price && <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>Precio ref: USD {part.price}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.b1}`, padding: "20px 24px", textAlign: "center", marginTop: 32 }}>
        <p style={{ fontSize: 13, color: C.t3 }}>¿Querés gestionar tu maquinaria con IA?</p>
        <a href="https://tolvink.com" style={{ fontSize: 14, fontWeight: 600, color: C.pri, textDecoration: "none" }}>Conocé Tolvink →</a>
      </div>
    </div>
  );
}
