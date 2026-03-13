import { useState, useRef, useEffect } from "react";
import { C, Ic } from "../../theme";
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
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let s;
        if (entityType === "poi") s = await apiGetPoiShares(entity.id);
        else if (entityType === "field") s = await apiGetFieldShares(entity.id);
        else if (entityType === "lot") s = await apiGetLotShares(fieldId, entity.id);
        if (!cancelled) setShares(s || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [entityType, entity.id, fieldId]);

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

  const handleShare = async (userId) => {
    try {
      if (entityType === "poi") await apiSharePoi(entity.id, userId);
      else if (entityType === "field") await apiShareField(entity.id, userId);
      else if (entityType === "lot") await apiShareLot(fieldId, entity.id, userId);

      let s;
      if (entityType === "poi") s = await apiGetPoiShares(entity.id);
      else if (entityType === "field") s = await apiGetFieldShares(entity.id);
      else if (entityType === "lot") s = await apiGetLotShares(fieldId, entity.id);
      setShares(s || []);
      setSearch("");
      setResults([]);
      onShared?.();
    } catch {}
  };

  const handleUnshare = async (userId) => {
    try {
      if (entityType === "poi") await apiUnsharePoi(entity.id, userId);
      else if (entityType === "field") await apiUnshareField(entity.id, userId);
      else if (entityType === "lot") await apiUnshareLot(fieldId, entity.id, userId);
      setShares(prev => prev.filter(s => s.sharedWith?.id !== userId));
      onShared?.();
    } catch {}
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

        <div style={{ marginBottom: 14 }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar usuario por nombre, email o teléfono..."
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${search ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {loading && <div style={{ textAlign: "center", padding: 10, fontSize: 12.7, color: C.t3 }}>Buscando...</div>}
        {results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 180, overflow: "auto" }}>
            {results.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.b1}`, background: C.bg }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: C.t3 }}>{u.email}</div>
                </div>
                {alreadySharedIds.has(u.id) ? (
                  <Bd color={C.ok} small>Compartido</Bd>
                ) : (
                  <button onClick={() => handleShare(u.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>
                    Compartir
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {shares.length > 0 && (
          <>
            <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t2, marginBottom: 8 }}>Compartido con:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {shares.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.b1}`, background: C.w }}>
                  <div>
                    <div style={{ fontSize: 13.2, fontWeight: 600, color: C.t1 }}>{s.sharedWith?.name || "Usuario"}</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>{s.sharedWith?.email}</div>
                  </div>
                  <button onClick={() => handleUnshare(s.sharedWith?.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.err}40`, background: C.errPale, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: C.err }}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {shares.length === 0 && results.length === 0 && !loading && search.length < 2 && (
          <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13.2 }}>
            Buscá un usuario para compartir este {typeLabels[entityType] || "elemento"}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
