import { useState, useRef, useEffect } from "react";
import { C, Ic, FONT, R } from "../../theme";
import { Bd } from "../../components";
import { ModalOverlay } from "../../components/overlays";
import {
  apiSearchUsersForShare,
  apiSharePoi, apiUnsharePoi, apiGetPoiShares,
  apiShareField, apiUnshareField, apiGetFieldShares,
  apiShareLot, apiUnshareLot, apiGetLotShares,
} from "../../api";

export default function ShareLocationModal({ entityType, entity, fieldId, onClose, onShared }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [msg, setMsg] = useState(null);
  const timerRef = useRef(null);

  const loadShares = async () => {
    try {
      let s;
      if (entityType === "poi") s = await apiGetPoiShares(entity.id);
      else if (entityType === "field") s = await apiGetFieldShares(entity.id);
      else if (entityType === "lot") s = await apiGetLotShares(fieldId, entity.id);
      setShares(s || []);
    } catch { setShares([]); }
    finally { setLoadingShares(false); }
  };

  useEffect(() => {
    let cancelled = false;
    loadShares().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [entityType, entity.id, fieldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (q) => {
    setSearch(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiSearchUsersForShare(q.trim());
        setResults(r || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  };

  const handleShare = async (userId, userName, userEmail) => {
    setMsg(null);
    try {
      if (entityType === "poi") await apiSharePoi(entity.id, userId);
      else if (entityType === "field") await apiShareField(entity.id, userId);
      else if (entityType === "lot") await apiShareLot(fieldId, entity.id, userId);
      // Optimistic: add to shares list immediately
      setShares(prev => [...prev, { id: `temp-${userId}`, sharedWith: { id: userId, name: userName, email: userEmail } }]);
      setMsg({ t: `Compartido con ${userName}`, k: "ok" });
      setSearch("");
      setResults([]);
      onShared?.();
    } catch (err) {
      setMsg({ t: err.message || "No se pudo compartir", k: "err" });
    }
  };

  const handleUnshare = async (userId, userName) => {
    setMsg(null);
    try {
      if (entityType === "poi") await apiUnsharePoi(entity.id, userId);
      else if (entityType === "field") await apiUnshareField(entity.id, userId);
      else if (entityType === "lot") await apiUnshareLot(fieldId, entity.id, userId);
      setShares(prev => prev.filter(s => s.sharedWith?.id !== userId));
      setMsg({ t: `Se dejó de compartir con ${userName}`, k: "ok" });
      onShared?.();
    } catch (err) {
      setMsg({ t: err.message || "Error al quitar compartido", k: "err" });
    }
  };

  const alreadySharedIds = new Set((shares || []).map(s => s.sharedWith?.id));
  const typeLabels = { poi: "ubicación", field: "campo", lot: "lote" };

  return (
    <ModalOverlay onClose={onClose} maxWidth={420} quick>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800 }}>{Ic.share(C.pri, 18)} Compartir "{entity.name}"</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
        </div>

        {msg && (
          <div onClick={() => setMsg(null)} style={{ padding: "8px 12px", borderRadius: R.md, marginBottom: 10, fontSize: 12.1, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err, cursor: "pointer" }}>
            {msg.t}
          </div>
        )}

        {/* Section 1: Current shares */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.1, fontWeight: 700, color: C.t2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Compartido con</div>
          {loadingShares && <div style={{ textAlign: "center", padding: 10, fontSize: 12.1, color: C.t3 }}>Cargando...</div>}
          {!loadingShares && shares.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 12.7, color: C.t3, fontStyle: "italic" }}>No compartido con nadie</div>
          )}
          {!loadingShares && shares.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {shares.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.w }}>
                  <div>
                    <div style={{ fontSize: 13.2, fontWeight: 600, color: C.t1 }}>{s.sharedWith?.name || "Usuario"}</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>{s.sharedWith?.email}</div>
                  </div>
                  <button onClick={() => handleUnshare(s.sharedWith?.id, s.sharedWith?.name || "usuario")} style={{ padding: "4px 10px", borderRadius: R.sm, border: `1px solid ${C.err}40`, background: C.errPale, cursor: "pointer", fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color: C.err }}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Add people */}
        <div>
          <div style={{ fontSize: 12.1, fontWeight: 700, color: C.t2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Agregar personas</div>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            style={{ width: "100%", padding: "10px 14px", borderRadius: R.md, border: `1.5px solid ${search ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: FONT, fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {loading && <div style={{ textAlign: "center", padding: 10, fontSize: 12.7, color: C.t3 }}>Buscando...</div>}
        {results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
            {results.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.bg }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: C.t3 }}>{u.email}</div>
                </div>
                {alreadySharedIds.has(u.id) ? (
                  <Bd color={C.ok} small>Compartido</Bd>
                ) : (
                  <button onClick={() => handleShare(u.id, u.name, u.email)} style={{ padding: "5px 12px", borderRadius: R.md, border: "none", background: C.pri, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, color: C.w }}>
                    Compartir
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !loading && search.length >= 2 && (
          <div style={{ textAlign: "center", padding: 12, color: C.t3, fontSize: 12.7 }}>Sin resultados para "{search}"</div>
        )}
      </div>
    </ModalOverlay>
  );
}
