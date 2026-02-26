// =====================================================================
// TOLVINK — Report Download Screen (Public, for WhatsApp report links)
// Opened via link from WhatsApp bot. No auth required.
// Auto-generates and downloads PDF report for a freight.
// =====================================================================

import { useState, useEffect, useRef } from "react";
import { API_URL } from "../api";

const COLORS = {
  pri: "#1A6B37", acc: "#FF6A00", bg: "#F7F8F7", w: "#FFFFFF",
  t1: "#18251C", t2: "#4A6352", t3: "#8A9C90",
  b1: "#DEE4E0", b2: "#ECF0ED", err: "#DC2626",
};

export default function ReportDownloadScreen({ code: codeProp } = {}) {
  const [status, setStatus] = useState("loading"); // loading | generating | done | error
  const [error, setError] = useState(null);
  const [freightCode, setFreightCode] = useState(null);
  const attempted = useRef(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const shareToken = params.get("s");

  // Determine API URL: clean URL (/f/:code/report?s=shareToken) or legacy (/track/:token/report-data)
  const qs = codeProp && shareToken ? `?s=${encodeURIComponent(shareToken)}` : '';
  const reportUrl = codeProp ? `${API_URL}/f/${codeProp}/report${qs}` : token ? `${API_URL}/track/${token}/report-data` : null;
  const hasIdentifier = !!(codeProp || token);

  useEffect(() => {
    if (!reportUrl || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        // 1. Fetch report data from public endpoint
        const res = await fetch(reportUrl);
        if (!res.ok) throw new Error("Flete no encontrado o link invalido");
        const data = await res.json();
        setFreightCode(data.code);

        // 2. Generate PDF
        setStatus("generating");
        const { generateFreightPDF } = await import("../utils/pdf-report");
        generateFreightPDF(data, data.auditLog || []);

        // 3. Done
        setStatus("done");
      } catch (e) {
        setError(e.message || "Error desconocido");
        setStatus("error");
      }
    })();
  }, [reportUrl]);

  const retry = () => { window.location.reload(); };

  if (!hasIdentifier) return (
    <div style={S.center}>
      <div style={S.card}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.t1 }}>Link invalido</div>
        <div style={{ fontSize: 14, color: COLORS.t3, marginTop: 8 }}>
          Este link fue generado desde WhatsApp. Si no funciona, pedi uno nuevo.
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.center}>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <div style={S.card}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.pri, letterSpacing: -1 }}>tolvink</span>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.acc, display: "inline-block" }} />
        </div>

        {status === "loading" && <>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.t1 }}>Cargando datos del flete...</div>
          <div style={S.spinner} />
        </>}

        {status === "generating" && <>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.t1 }}>
            Generando informe{freightCode ? ` ${freightCode}` : ""}...
          </div>
          <div style={{ fontSize: 13, color: COLORS.t3, marginTop: 8 }}>
            La descarga comenzara automaticamente
          </div>
          <div style={S.spinner} />
        </>}

        {status === "done" && <>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.pri }}>
            Informe {freightCode} descargado
          </div>
          <div style={{ fontSize: 13, color: COLORS.t3, marginTop: 8 }}>
            Si la descarga no inicio, hace click abajo
          </div>
          <button onClick={retry} style={S.btn}>Descargar de nuevo</button>
        </>}

        {status === "error" && <>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.err }}>Error</div>
          <div style={{ fontSize: 13, color: COLORS.t3, marginTop: 8 }}>{error}</div>
          <button onClick={retry} style={S.btn}>Reintentar</button>
        </>}
      </div>
    </div>
  );
}

const S = {
  center: {
    minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
    background: COLORS.bg, fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif", padding: 24,
  },
  card: {
    textAlign: "center", padding: 32, background: COLORS.w, borderRadius: 16,
    maxWidth: 380, width: "100%", boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  spinner: {
    width: 24, height: 24, border: `3px solid ${COLORS.b1}`, borderTop: `3px solid ${COLORS.pri}`,
    borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "16px auto 0",
  },
  btn: {
    marginTop: 16, padding: "10px 24px", background: COLORS.pri, color: "#fff",
    borderRadius: 8, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit",
  },
};
