import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C, FONT } from "../../theme";
import { apiLookupMachineQr } from "../../api";

export default function MachineQrRedirect() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!qrCode) return;
    apiLookupMachineQr(qrCode)
      .then(data => navigate(`/mechanic/machines/${data.id}`, { replace: true }))
      .catch(e => setError(e?.message || "QR no encontrado o no pertenece a tu empresa"));
  }, [qrCode, navigate]);

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, fontFamily: FONT }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: C.err }}>{error}</p>
      <button onClick={() => navigate("/mechanic/machines")} style={{ border: "none", background: C.pri, color: C.tOn, padding: "8px 20px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
        Ir a Mis Máquinas
      </button>
    </div>
  );

  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: C.t3, fontSize: 14, fontFamily: FONT }}>Buscando máquina...</div>;
}
