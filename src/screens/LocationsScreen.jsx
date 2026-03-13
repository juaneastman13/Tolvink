import { useState, useEffect, useCallback, useRef } from "react";
import { C, Ic } from "../theme";
import { Btn, Bd, Loader, LoadingOverlay, EmptyState } from "../components";
import { ModalOverlay } from "../components/overlays";
import {
  apiGetFields, apiCreateField, apiCreateLot,
  apiImportGoogleList, apiGetPois, apiCreatePoi, apiUpdatePoi, apiDeletePoi,
  apiSharePoi, apiUnsharePoi, apiGetPoiShares, apiReclassifyPoi, apiSearchUsersForShare,
} from "../api";
import MapPreviewModal from "../modals/MapPreviewModal";
import { loadGMaps } from "../maps";

// ── Color config per type ──────────────────────────────────────────
const TYPE_CFG = {
  field: { label: "Campo", color: "#1A6B37", icon: (c, s) => Ic.field(c, s) },
  lot:   { label: "Lote",  color: "#2563EB", icon: (c, s) => Ic.lot(c, s) },
  poi:   { label: "Interés", color: "#0891B2", icon: (c, s) => Ic.poi(c, s) },
};

// Map marker colors
const MAP_COLORS = { field: "#1A6B37", lot: "#2563EB", poi: "#0891B2" };

export default function LocationsScreen({ onBack }) {
  const [fields, setFields] = useState([]);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");

  // Map preview (single location)
  const [previewLoc, setPreviewLoc] = useState(null);

  // Map overview (all locations)
  const [showMapOverview, setShowMapOverview] = useState(false);
  const [mapFilter, setMapFilter] = useState("all"); // all | field | lot | poi

  // Import flow
  const [importStep, setImportStep] = useState(0);
  const [importUrl, setImportUrl] = useState("");
  const [importParsed, setImportParsed] = useState([]);
  const [importDiscarded, setImportDiscarded] = useState(0);
  const [importSelected, setImportSelected] = useState(new Set());
  const [importNames, setImportNames] = useState({});
  const [importTypes, setImportTypes] = useState({});
  const [importFieldIds, setImportFieldIds] = useState({});
  const [importComments, setImportComments] = useState({});
  const [importWarning, setImportWarning] = useState(null);
  const [importListName, setImportListName] = useState(null);
  const [importSlowMsg, setImportSlowMsg] = useState(false);

  // Edit/delete POI
  const [editingPoi, setEditingPoi] = useState(null);
  const [editName, setEditName] = useState("");
  const [editComments, setEditComments] = useState("");
  const [deletingPoi, setDeletingPoi] = useState(null);

  // Share modal
  const [sharingPoi, setSharingPoi] = useState(null);
  const [shareSearch, setShareSearch] = useState("");
  const [shareResults, setShareResults] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [currentShares, setCurrentShares] = useState([]);
  const shareTimerRef = useRef(null);

  // Reclassify modal
  const [reclassifyPoi, setReclassifyPoi] = useState(null);
  const [reclassifyType, setReclassifyType] = useState("field");
  const [reclassifyFieldId, setReclassifyFieldId] = useState("");
  const [reclassifyHectares, setReclassifyHectares] = useState("");

  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([
        apiGetFields(),
        apiGetPois().catch(() => []),
      ]);
      setFields(f || []);
      setPois(p || []);
    } catch (e) {
      setMsg({ t: e.message || "Error al cargar datos", k: "err" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Import handlers ──
  const handleImportList = async () => {
    const raw = importUrl.trim();
    if (!raw) { setMsg({ t: "Pegá el link de tu lista de Google Maps", k: "err" }); return; }
    const urlMatch = raw.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : raw;
    if (!url.includes("maps") && !url.includes("goo.gl")) { setMsg({ t: "Esa URL no parece ser de Google Maps", k: "err" }); return; }
    setSaving(true);
    setImportSlowMsg(false);
    const slowTimer = setTimeout(() => setImportSlowMsg(true), 15000);
    try {
      const result = await apiImportGoogleList(url);
      setImportParsed(result.parsed || []);
      setImportDiscarded(result.discarded || 0);
      setImportWarning(result.warning || null);
      setImportListName(result.listName || null);
      setImportSelected(new Set(result.parsed.map((_, i) => i)));
      setImportNames({});
      setImportTypes({});
      setImportFieldIds({});
      setImportComments({});
      setImportStep(2);
    } catch (err) {
      setMsg({ t: err.message || "No se pudieron extraer ubicaciones de este link.", k: "err" });
    } finally {
      clearTimeout(slowTimer);
      setImportSlowMsg(false);
      setSaving(false);
    }
  };

  const handleImportConfirm = async () => {
    const selected = importParsed
      .map((loc, i) => ({ loc, i }))
      .filter(({ i }) => importSelected.has(i));
    if (selected.length === 0) { setMsg({ t: "Seleccioná al menos una ubicación", k: "err" }); return; }

    for (const { i } of selected) {
      if (getType(i) === "lot" && !importFieldIds[i]) {
        setMsg({ t: `"${getName(i)}" es Lote pero no tiene campo asignado`, k: "err" });
        return;
      }
    }

    setSaving(true);
    let createdFields = 0, createdLots = 0, createdPois = 0;
    const errors = [];

    const newFieldIds = {};
    for (const { loc, i } of selected) {
      if (getType(i) !== "field") continue;
      const name = getName(i);
      try {
        const r = await apiCreateField({ name, address: loc.address || undefined, lat: loc.lat, lng: loc.lng });
        newFieldIds[i] = r.id;
        createdFields++;
      } catch (err) { errors.push(`"${name}": ${err.message}`); }
    }

    for (const { loc, i } of selected) {
      if (getType(i) !== "lot") continue;
      const name = getName(i);
      let fieldId = importFieldIds[i];
      if (fieldId?.startsWith("new:")) {
        fieldId = newFieldIds[parseInt(fieldId.split(":")[1], 10)];
        if (!fieldId) { errors.push(`"${name}": el campo asociado no se pudo crear`); continue; }
      }
      try {
        await apiCreateLot(fieldId, { name, lat: loc.lat, lng: loc.lng });
        createdLots++;
      } catch (err) { errors.push(`"${name}": ${err.message}`); }
    }

    for (const { loc, i } of selected) {
      if (getType(i) !== "poi") continue;
      const name = getName(i);
      try {
        await apiCreatePoi({ name, address: loc.address || undefined, lat: loc.lat, lng: loc.lng, comments: importComments[i] || undefined });
        createdPois++;
      } catch (err) { errors.push(`"${name}": ${err.message}`); }
    }

    setImportStep(0); setImportParsed([]); setImportUrl(""); setSaving(false);
    const parts = [];
    if (createdFields) parts.push(`${createdFields} campo${createdFields !== 1 ? "s" : ""}`);
    if (createdLots) parts.push(`${createdLots} lote${createdLots !== 1 ? "s" : ""}`);
    if (createdPois) parts.push(`${createdPois} ubicación${createdPois !== 1 ? "es" : ""} de interés`);
    const total = createdFields + createdLots + createdPois;
    if (total > 0) {
      let msg = parts.join(", ") + ` importado${total !== 1 ? "s" : ""}`;
      if (createdFields || createdLots) msg += ". Campos y lotes: ver en Mis Campos y Lotes";
      if (errors.length) msg += ` · ${errors.length} error${errors.length !== 1 ? "es" : ""}: ${errors.slice(0, 2).join("; ")}`;
      setDoneMsg(msg);
    } else if (errors.length) {
      setDoneMsg(`Error al importar: ${errors.slice(0, 3).join("; ")}`);
    } else {
      setDoneMsg("No se importaron ubicaciones");
    }
    load();
  };

  const toggleItem = (i) => setImportSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const closeImport = () => { setImportStep(0); setImportParsed([]); setImportUrl(""); setImportWarning(null); setImportListName(null); setImportTypes({}); setImportFieldIds({}); setImportComments({}); };

  // ── POI edit ──
  const startEditPoi = (p) => {
    setEditingPoi(p);
    setEditName(p.name);
    setEditComments(p.comments || "");
  };

  const handleUpdatePoi = async () => {
    if (!editingPoi) return;
    setSaving(true);
    try {
      await apiUpdatePoi(editingPoi.id, { name: editName.trim(), comments: editComments.trim() || undefined });
      setEditingPoi(null);
      setMsg({ t: "Ubicación actualizada", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al actualizar", k: "err" });
    } finally {
      setSaving(false);
    }
  };

  // ── POI delete (delete only for me) ──
  const handleDeletePoi = async (id) => {
    setSaving(true);
    try {
      await apiDeletePoi(id);
      setDeletingPoi(null);
      setMsg({ t: "Ubicación eliminada", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al eliminar", k: "err" });
    } finally {
      setSaving(false);
    }
  };

  // ── Share modal ──
  const openShareModal = async (p) => {
    setSharingPoi(p);
    setShareSearch("");
    setShareResults([]);
    setCurrentShares([]);
    try {
      const shares = await apiGetPoiShares(p.id);
      setCurrentShares(shares || []);
    } catch {}
  };

  const handleShareSearch = (q) => {
    setShareSearch(q);
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    if (q.trim().length < 2) { setShareResults([]); return; }
    shareTimerRef.current = setTimeout(async () => {
      setShareLoading(true);
      try {
        const r = await apiSearchUsersForShare(q.trim());
        setShareResults(r || []);
      } catch { setShareResults([]); }
      finally { setShareLoading(false); }
    }, 300);
  };

  const handleShare = async (userId) => {
    if (!sharingPoi) return;
    try {
      await apiSharePoi(sharingPoi.id, userId);
      const shares = await apiGetPoiShares(sharingPoi.id);
      setCurrentShares(shares || []);
      setShareSearch("");
      setShareResults([]);
      setMsg({ t: "Ubicación compartida", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al compartir", k: "err" });
    }
  };

  const handleUnshare = async (userId) => {
    if (!sharingPoi) return;
    try {
      await apiUnsharePoi(sharingPoi.id, userId);
      setCurrentShares(prev => prev.filter(s => s.sharedWith?.id !== userId));
      setMsg({ t: "Se dejó de compartir", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error", k: "err" });
    }
  };

  // ── Reclassify ──
  const openReclassify = (p) => {
    setReclassifyPoi(p);
    setReclassifyType("field");
    setReclassifyFieldId("");
    setReclassifyHectares("");
  };

  const handleReclassify = async () => {
    if (!reclassifyPoi) return;
    setSaving(true);
    try {
      const body = { targetType: reclassifyType };
      if (reclassifyType === "lot") {
        body.fieldId = reclassifyFieldId;
        if (reclassifyHectares) body.hectares = parseFloat(reclassifyHectares);
      }
      await apiReclassifyPoi(reclassifyPoi.id, body);
      setReclassifyPoi(null);
      setMsg({ t: `Reclasificado como ${reclassifyType === "field" ? "Campo" : "Lote"}`, k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al reclasificar", k: "err" });
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = [...importSelected].length;
  const getType = (i) => importTypes[i] || "field";
  const getName = (i) => (importNames[i] ?? (importParsed[i]?.name || "")).trim().slice(0, 255);

  const fieldOptions = [
    ...fields.map(f => ({ id: f.id, name: f.name })),
    ...importParsed
      .map((loc, i) => ({ i, name: importNames[i] ?? loc.name }))
      .filter(({ i }) => importSelected.has(i) && getType(i) === "field")
      .map(({ i, name }) => ({ id: `new:${i}`, name: `${name} (nuevo)` })),
  ];

  // Split POIs into own and shared
  const ownPois = pois.filter(p => !p._isSharedWithMe);
  const sharedPois = pois.filter(p => p._isSharedWithMe);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}
      {previewLoc && <MapPreviewModal loc={previewLoc} onClose={() => setPreviewLoc(null)} />}

      {/* Map overview modal */}
      {showMapOverview && (
        <MapOverviewModal
          fields={fields}
          pois={pois}
          filter={mapFilter}
          onFilterChange={setMapFilter}
          onClose={() => setShowMapOverview(false)}
          onSelectLocation={loc => { setShowMapOverview(false); setPreviewLoc(loc); }}
        />
      )}

      {/* Share modal */}
      {sharingPoi && (
        <SharePoiModal
          poi={sharingPoi}
          shares={currentShares}
          search={shareSearch}
          results={shareResults}
          loading={shareLoading}
          onSearch={handleShareSearch}
          onShare={handleShare}
          onUnshare={handleUnshare}
          onClose={() => setSharingPoi(null)}
        />
      )}

      {/* Reclassify modal */}
      {reclassifyPoi && (
        <ReclassifyPoiModal
          poi={reclassifyPoi}
          fields={fields}
          type={reclassifyType}
          fieldId={reclassifyFieldId}
          hectares={reclassifyHectares}
          saving={saving}
          onTypeChange={setReclassifyType}
          onFieldIdChange={setReclassifyFieldId}
          onHectaresChange={setReclassifyHectares}
          onConfirm={handleReclassify}
          onClose={() => setReclassifyPoi(null)}
        />
      )}

      <div style={{ position: "sticky", top: 0, zIndex: 10, background: C.bg, padding: "18px 18px 8px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {Ic.chev(C.pri, 18)} Menú
        </button>
      </div>

      <div style={{ padding: "0 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Ubicaciones</div>
          <div style={{ display: "flex", gap: 6 }}>
            {/* Map overview button */}
            <Btn sm v="sec" onClick={() => setShowMapOverview(true)} icon={Ic.mapView(C.pri, 14)}>
              Mapa
            </Btn>
            <Btn sm v="sec" onClick={() => setImportStep(importStep ? 0 : 1)}>
              {importStep ? Ic.cross(C.pri, 14) : "+"} {importStep ? "Cerrar" : "Importar"}
            </Btn>
          </div>
        </div>

        {msg && (
          <div onClick={() => setMsg(null)} style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.2, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err, cursor: "pointer" }}>
            {msg.t}
          </div>
        )}

        {/* ── Step 1: Paste link ── */}
        {importStep === 1 && (
          <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
            <div style={{ fontSize: 15.4, fontWeight: 700, marginBottom: 8 }}>{Ic.pin(C.pri, 16)} Importar desde Google Maps</div>
            <div style={{ fontSize: 12.7, color: C.t2, lineHeight: 1.5, marginBottom: 12 }}>
              Abrí Google Maps → <strong>Tus sitios</strong> → Seleccioná una lista → <strong>Compartir</strong> → Copiar enlace
            </div>
            <input
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${importUrl ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
            />
            {importSlowMsg && <div style={{ marginTop: 8, fontSize: 12.1, color: C.t3, fontStyle: "italic" }}>Esto puede tardar un momento…</div>}
            <div style={{ marginTop: 10 }}>
              <Btn full v="acc" disabled={saving || !importUrl.trim()} onClick={handleImportList}>
                {saving ? "Buscando ubicaciones…" : "Buscar ubicaciones"}
              </Btn>
            </div>
          </div>
        )}

        {/* ── Step 2: Classify each location ── */}
        {importStep === 2 && (
          <ImportClassifyPanel
            importParsed={importParsed}
            importSelected={importSelected}
            importNames={importNames}
            importTypes={importTypes}
            importFieldIds={importFieldIds}
            importComments={importComments}
            importDiscarded={importDiscarded}
            importWarning={importWarning}
            importListName={importListName}
            fieldOptions={fieldOptions}
            saving={saving}
            selectedCount={selectedCount}
            getType={getType}
            getName={getName}
            onToggle={toggleItem}
            onNameChange={(i, v) => setImportNames(prev => ({ ...prev, [i]: v }))}
            onTypeChange={(i, k) => {
              if (k === "field") {
                setImportTypes(prev => { const n = { ...prev }; delete n[i]; return n; });
                setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; });
              } else {
                setImportTypes(prev => ({ ...prev, [i]: k }));
                if (k !== "lot") setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; });
              }
              if (k === "lot" && fieldOptions.length === 1) setImportFieldIds(prev => ({ ...prev, [i]: fieldOptions[0].id }));
              if (!importSelected.has(i)) setImportSelected(prev => new Set([...prev, i]));
            }}
            onFieldIdChange={(i, v) => setImportFieldIds(prev => ({ ...prev, [i]: v }))}
            onCommentChange={(i, v) => setImportComments(prev => ({ ...prev, [i]: v }))}
            onSelectAll={() => setImportSelected(new Set(importParsed.map((_, i) => i)))}
            onSelectNone={() => setImportSelected(new Set())}
            onPreview={(loc) => setPreviewLoc(loc)}
            onClose={closeImport}
            onConfirm={handleImportConfirm}
          />
        )}

        {/* ── POI list ── */}
        {loading ? <Loader /> :
          pois.length === 0 && importStep === 0 ? (
            <EmptyState
              icon={Ic.poi(C.t3, 28)}
              title="Sin ubicaciones de interés"
              subtitle="Importá ubicaciones desde Google Maps y marcalas como 'Interés'"
              action={<Btn sm onClick={() => setImportStep(1)}>Importar</Btn>}
            />
          ) : importStep === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Own POIs */}
              {ownPois.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                    <Bd color={C.sec}>{ownPois.length} ubicación{ownPois.length !== 1 ? "es" : ""} de interés</Bd>
                  </div>
                  {ownPois.map(p => (
                    <PoiRow
                      key={p.id}
                      p={p}
                      isShared={false}
                      editingId={editingPoi?.id}
                      editName={editName}
                      editComments={editComments}
                      deletingId={deletingPoi}
                      onEditNameChange={setEditName}
                      onEditCommentsChange={setEditComments}
                      onStartEdit={startEditPoi}
                      onSaveEdit={handleUpdatePoi}
                      onCancelEdit={() => setEditingPoi(null)}
                      onStartDelete={setDeletingPoi}
                      onCancelDelete={() => setDeletingPoi(null)}
                      onConfirmDelete={handleDeletePoi}
                      onPreview={setPreviewLoc}
                      onShare={openShareModal}
                      onReclassify={openReclassify}
                    />
                  ))}
                </>
              )}

              {/* Shared with me */}
              {sharedPois.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 8, marginTop: ownPois.length > 0 ? 14 : 0, marginBottom: 4 }}>
                    <Bd color={C.info}>{sharedPois.length} compartida{sharedPois.length !== 1 ? "s" : ""} conmigo</Bd>
                  </div>
                  {sharedPois.map(p => (
                    <PoiRow
                      key={p.id}
                      p={p}
                      isShared
                      editingId={null}
                      deletingId={deletingPoi}
                      onStartDelete={setDeletingPoi}
                      onCancelDelete={() => setDeletingPoi(null)}
                      onConfirmDelete={handleDeletePoi}
                      onPreview={setPreviewLoc}
                    />
                  ))}
                </>
              )}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// POI ROW — Redesigned with inline action pictograms
// ═══════════════════════════════════════════════════════════════════════

function PoiRow({
  p, isShared,
  editingId, editName, editComments,
  deletingId,
  onEditNameChange, onEditCommentsChange,
  onStartEdit, onSaveEdit, onCancelEdit,
  onStartDelete, onCancelDelete, onConfirmDelete,
  onPreview, onShare, onReclassify,
}) {
  const borderColor = isShared ? C.info : C.sec;

  if (editingId === p.id) {
    return (
      <div style={{ background: C.w, border: `1px solid ${C.bFocus}`, borderLeft: `4px solid ${C.pri}`, borderRadius: 12, boxShadow: C.sh, padding: "12px 14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={editName} onChange={e => onEditNameChange(e.target.value)} placeholder="Nombre" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: "inherit", fontSize: 14.3, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box" }} />
          <input value={editComments} onChange={e => onEditCommentsChange(e.target.value)} placeholder="Comentarios (opcional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 12.7, color: C.t1, outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onCancelEdit} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 600, color: C.t2 }}>Cancelar</button>
            <button onClick={onSaveEdit} disabled={!editName?.trim()} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 700, color: C.w, opacity: editName?.trim() ? 1 : 0.5 }}>Guardar</button>
          </div>
        </div>
      </div>
    );
  }

  if (deletingId === p.id) {
    const deleteLabel = isShared ? "Quitar" : "Sí, eliminar";
    return (
      <div style={{ background: C.w, border: `1px solid ${C.err}40`, borderLeft: `4px solid ${C.err}`, borderRadius: 12, boxShadow: C.sh, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13.2, fontWeight: 600, color: C.err }}>
            {isShared ? `¿Quitar "${p.name}" de tus ubicaciones?` : `¿Eliminar "${p.name}"?`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onCancelDelete(null)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 600, color: C.t2 }}>No</button>
            <button onClick={() => onConfirmDelete(p.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.err, cursor: "pointer", fontFamily: "inherit", fontSize: 12.7, fontWeight: 700, color: C.w }}>{deleteLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `4px solid ${borderColor}`, borderRadius: 12, boxShadow: C.sh, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Icon */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${borderColor}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {Ic.poi(borderColor, 16)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.3, fontWeight: 700, color: C.t1 }}>{p.name}</div>
          {p.comments && (
            <div style={{ fontSize: 13, color: C.t3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.comments}</div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
            {isShared ? (
              <Bd color={C.info} small>Compartida por {p._sharedBy?.name || "alguien"}</Bd>
            ) : (
              <Bd color={C.sec} small>Interés</Bd>
            )}
            {p.address && <span style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.address}</span>}
            {!isShared && p.shares?.length > 0 && (
              <Bd color={C.pri} small>{p.shares.length} compartido{p.shares.length !== 1 ? "s" : ""}</Bd>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <RowMenu
          id={p.id}
          items={[
            { icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => onPreview({ name: p.name, address: p.address, lat: Number(p.lat), lng: Number(p.lng) }) },
            ...(!isShared && onShare ? [{ icon: Ic.share(C.t3, 14), label: "Compartir", onClick: () => onShare(p) }] : []),
            ...(!isShared && onReclassify ? [{ icon: Ic.pin(C.t3, 14), label: "Reclasificar", onClick: () => onReclassify(p) }] : []),
            ...(!isShared && onStartEdit ? [{ icon: Ic.edit(C.t3, 14), label: "Editar", onClick: () => onStartEdit(p) }] : []),
            { icon: Ic.cross(C.err, 14), label: isShared ? "Quitar" : "Eliminar", onClick: () => onStartDelete(p.id), danger: true },
          ]}
        />
      </div>
    </div>
  );
}

// ── Row context menu (⋮ → dropdown) ──────────────────────────────────
export function RowMenu({ id, items }) {
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
          fontSize: 12.1, color: C.t3, fontFamily: "inherit", fontWeight: 600,
        }}
      >
        Opciones <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1 }}>⋮</span>
      </button>
      {open && <>
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
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.2,
                fontWeight: 600, color: item.danger ? C.err : C.t1,
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
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAP OVERVIEW MODAL — Shows all locations color-coded on Google Maps
// ═══════════════════════════════════════════════════════════════════════

function MapOverviewModal({ fields, pois, filter, onFilterChange, onClose, onSelectLocation }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  // Collect all locations
  const allLocations = [];
  (fields || []).forEach(f => {
    if (f.lat && f.lng) allLocations.push({ type: "field", name: f.name, lat: Number(f.lat), lng: Number(f.lng), address: f.address });
    (f.lots || []).forEach(l => {
      if (l.lat && l.lng) allLocations.push({ type: "lot", name: `${l.name} (${f.name})`, lat: Number(l.lat), lng: Number(l.lng) });
    });
  });
  (pois || []).forEach(p => {
    if (p.lat && p.lng) allLocations.push({ type: "poi", name: p.name, lat: Number(p.lat), lng: Number(p.lng), address: p.address, isShared: p._isSharedWithMe });
  });

  const filtered = filter === "all" ? allLocations : allLocations.filter(l => l.type === filter);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    loadGMaps().then(maps => {
      if (cancelled || !mapRef.current) return;

      const center = filtered.length > 0
        ? { lat: filtered.reduce((s, l) => s + l.lat, 0) / filtered.length, lng: filtered.reduce((s, l) => s + l.lng, 0) / filtered.length }
        : { lat: -33.0, lng: -56.0 };

      if (!mapInstance.current) {
        mapInstance.current = new maps.Map(mapRef.current, {
          center,
          zoom: filtered.length > 0 ? 8 : 6,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          mapTypeControlOptions: { style: maps.MapTypeControlStyle.DROPDOWN_MENU },
          gestureHandling: "greedy",
        });
      }

      // Clear existing markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      const iw = new maps.InfoWindow();

      // Entity-specific marker SVGs (imported from maps.jsx pattern)
      const _mkSvg = (type) => {
        if (type === "field") {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 24 34"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22C24 5.37 18.63 0 12 0z" fill="%231A6B37" stroke="%23fff" stroke-width="1.5"/><path d="M12 5.5a4.5 4.5 0 00-4.5 4.5c0 3.5 4.5 6.5 4.5 6.5s4.5-3 4.5-6.5A4.5 4.5 0 0012 5.5z" fill="none" stroke="%23fff" stroke-width="1.3"/><circle cx="12" cy="10" r="1.5" fill="%23fff"/></svg>`;
          return { url: `data:image/svg+xml,${svg}`, scaledSize: new maps.Size(32, 44), anchor: new maps.Point(16, 44) };
        }
        if (type === "lot") {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 34"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22C24 5.37 18.63 0 12 0z" fill="%231A6B37" stroke="%23fff" stroke-width="1.5"/><path d="M15.5 6.5C11 7.5 9.5 11 8.5 14.5l1 .3.5-1.2c.3.1.5.2.7.2C16 13.5 17 6 17 6c-.5 1-4 1.2-6.5 1.7S6.5 9.5 6.5 10.5s.9 1.9.9 1.9" fill="none" stroke="%23fff" stroke-width="1.2" stroke-linecap="round"/></svg>`;
          return { url: `data:image/svg+xml,${svg}`, scaledSize: new maps.Size(28, 40), anchor: new maps.Point(14, 40) };
        }
        // poi
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 34"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 22 12 22s12-13 12-22C24 5.37 18.63 0 12 0z" fill="%230891B2" stroke="%23fff" stroke-width="1.5"/><polygon points="7 11 17 6.5 12.5 16.5 11.5 12 7 11" fill="none" stroke="%23fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        return { url: `data:image/svg+xml,${svg}`, scaledSize: new maps.Size(28, 40), anchor: new maps.Point(14, 40) };
      };
      filtered.forEach(loc => {
        const icon = _mkSvg(loc.type);
        const mk = new maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map: mapInstance.current,
          title: loc.name,
          icon,
        });
        mk.addListener("click", () => {
          const typeLabel = TYPE_CFG[loc.type]?.label || loc.type;
          iw.setContent(`<div style="font-family:system-ui;font-size:12px;line-height:1.5;max-width:220px"><strong>${loc.name}</strong><br/><span style="color:${color};font-weight:700">${typeLabel}</span>${loc.address ? "<br/>" + loc.address : ""}</div>`);
          iw.open(mapInstance.current, mk);
        });
        mk.addListener("dblclick", () => onSelectLocation(loc));
        markersRef.current.push(mk);
      });

      // Fit bounds
      if (filtered.length > 1) {
        const bounds = new maps.LatLngBounds();
        filtered.forEach(l => bounds.extend({ lat: l.lat, lng: l.lng }));
        mapInstance.current.fitBounds(bounds, 40);
      } else if (filtered.length === 1) {
        mapInstance.current.setCenter({ lat: filtered[0].lat, lng: filtered[0].lng });
        mapInstance.current.setZoom(14);
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [filter, fields, pois]);

  const counts = { all: allLocations.length, field: allLocations.filter(l => l.type === "field").length, lot: allLocations.filter(l => l.type === "lot").length, poi: allLocations.filter(l => l.type === "poi").length };
  const filterBtns = [
    { key: "all", label: "Todos", color: C.t1 },
    { key: "field", label: "Campos", color: MAP_COLORS.field },
    { key: "lot", label: "Lotes", color: MAP_COLORS.lot },
    { key: "poi", label: "Interés", color: MAP_COLORS.poi },
  ];

  return (
    <ModalOverlay onClose={onClose} maxWidth={560} quick>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{Ic.mapView(C.pri, 18)} Mapa de ubicaciones</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {filterBtns.map(fb => (
            <button
              key={fb.key}
              onClick={() => onFilterChange(fb.key)}
              style={{
                flex: 1,
                padding: "7px 6px",
                borderRadius: 8,
                border: `2px solid ${filter === fb.key ? fb.color : C.b2}`,
                background: filter === fb.key ? `${fb.color}12` : C.w,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12.1,
                fontWeight: 700,
                color: filter === fb.key ? fb.color : C.t3,
              }}
            >
              {fb.label} ({counts[fb.key]})
            </button>
          ))}
        </div>

        {/* Map */}
        <div ref={mapRef} style={{ width: "100%", height: 360, borderRadius: 12, border: `1px solid ${C.b1}`, background: C.bgInput, overflow: "hidden" }} />
        <div style={{ marginTop: 8, fontSize: 11, color: C.t3, textAlign: "center" }}>Doble clic en un marcador para ver detalle</div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARE POI MODAL
// ═══════════════════════════════════════════════════════════════════════

function SharePoiModal({ poi, shares, search, results, loading, onSearch, onShare, onUnshare, onClose }) {
  const alreadySharedIds = new Set((shares || []).map(s => s.sharedWith?.id));

  return (
    <ModalOverlay onClose={onClose} maxWidth={420} quick>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800 }}>{Ic.share(C.pri, 18)} Compartir "{poi.name}"</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
        </div>

        {/* Search users */}
        <div style={{ marginBottom: 14 }}>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar usuario por nombre, email o teléfono..."
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${search ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Search results */}
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
                  <button onClick={() => onShare(u.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>
                    Compartir
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Current shares */}
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
                  <button onClick={() => onUnshare(s.sharedWith?.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.err}40`, background: C.errPale, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: C.err }}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {shares.length === 0 && results.length === 0 && !loading && search.length < 2 && (
          <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13.2 }}>
            Buscá un usuario para compartir esta ubicación
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RECLASSIFY POI MODAL
// ═══════════════════════════════════════════════════════════════════════

function ReclassifyPoiModal({ poi, fields, type, fieldId, hectares, saving, onTypeChange, onFieldIdChange, onHectaresChange, onConfirm, onClose }) {
  return (
    <ModalOverlay onClose={onClose} maxWidth={400} quick>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800 }}>{Ic.pin(C.acc, 18)} Reclasificar "{poi.name}"</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
        </div>

        <div style={{ fontSize: 13.2, color: C.t2, marginBottom: 14, lineHeight: 1.4 }}>
          Esta ubicación de interés se convertirá en un Campo o Lote. La ubicación original se eliminará.
        </div>

        {/* Type selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { key: "field", label: "Campo", color: MAP_COLORS.field, icon: Ic.field },
            { key: "lot", label: "Lote", color: MAP_COLORS.lot, icon: Ic.lot },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => onTypeChange(opt.key)}
              style={{
                flex: 1, padding: "12px 8px", borderRadius: 10,
                border: `2px solid ${type === opt.key ? opt.color : C.b2}`,
                background: type === opt.key ? `${opt.color}12` : C.w,
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 14.3, fontWeight: 800,
                color: type === opt.key ? opt.color : C.t3,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {opt.icon(type === opt.key ? opt.color : C.t3, 16)} {opt.label}
            </button>
          ))}
        </div>

        {/* Field selector for lots */}
        {type === "lot" && (
          <>
            <select
              value={fieldId}
              onChange={e => onFieldIdChange(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${fieldId ? C.ok : C.err}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", cursor: "pointer", boxSizing: "border-box", marginBottom: 10 }}
            >
              <option value="">— Seleccioná el campo —</option>
              {fields.filter(f => f.id).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input
              type="number"
              value={hectares}
              onChange={e => onHectaresChange(e.target.value)}
              placeholder="Hectáreas (opcional)"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />
          </>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Btn sm v="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn sm disabled={saving || (type === "lot" && !fieldId)} onClick={onConfirm} style={{ flex: 1 }}>
            {saving ? "Reclasificando..." : `Convertir a ${type === "field" ? "Campo" : "Lote"}`}
          </Btn>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// IMPORT CLASSIFY PANEL (extracted for readability)
// ═══════════════════════════════════════════════════════════════════════

function ImportClassifyPanel({
  importParsed, importSelected, importNames, importTypes, importFieldIds, importComments,
  importDiscarded, importWarning, importListName, fieldOptions, saving, selectedCount,
  getType, getName,
  onToggle, onNameChange, onTypeChange, onFieldIdChange, onCommentChange,
  onSelectAll, onSelectNone, onPreview, onClose, onConfirm,
}) {
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: C.sh }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15.4, fontWeight: 700 }}>{Ic.pin(C.pri, 16)} {importListName || "Ubicaciones encontradas"}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 16)}</button>
      </div>
      {importWarning && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12.1, fontWeight: 500, background: C.warnPale, color: C.warn, border: `1px solid ${C.warn}30` }}>{importWarning}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, fontSize: 12.7, color: C.t2 }}>
          <span style={{ fontWeight: 600, color: C.ok }}>{importParsed.length} encontradas</span>
          {importDiscarded > 0 && <span style={{ color: C.t3 }}>{importDiscarded} descartadas</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSelectAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.pri, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Todas</button>
          <span style={{ color: C.t3 }}>·</span>
          <button onClick={onSelectNone} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.1, color: C.t3, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Ninguna</button>
        </div>
      </div>

      {importParsed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: C.t3, fontSize: 13.2 }}>No se encontraron ubicaciones válidas</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {importParsed.map((loc, i) => {
              const sel = importSelected.has(i);
              const t = getType(i);
              const cfg = TYPE_CFG[t];
              return (
                <div key={i} style={{
                  borderRadius: 12, border: `1.5px solid ${sel ? cfg.color : C.b1}`,
                  borderLeft: sel ? `4px solid ${cfg.color}` : `4px solid ${C.b1}`,
                  background: sel ? `${cfg.color}04` : C.bg,
                  transition: "all 0.15s", overflow: "hidden",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 8px" }}>
                    <div onClick={() => onToggle(i)} style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${sel ? cfg.color : C.b2}`,
                      background: sel ? cfg.color : C.w,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, cursor: "pointer",
                    }}>
                      {sel && Ic.chk(C.w, 13)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={importNames[i] ?? loc.name}
                        onChange={e => onNameChange(i, e.target.value)}
                        placeholder="Nombre de la ubicación"
                        style={{ width: "100%", border: "none", background: "transparent", fontSize: 15.4, fontWeight: 700, color: C.t1, fontFamily: "inherit", padding: 0, outline: "none" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        {loc.address && <span style={{ fontSize: 11.5, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.address}</span>}
                        <span style={{ fontSize: 10.5, color: C.ok, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onPreview({ name: importNames[i] ?? loc.name, address: loc.address, lat: loc.lat, lng: loc.lng })}
                      title="Ver en mapa"
                      style={{
                        background: `${cfg.color}10`, border: `1px solid ${cfg.color}30`,
                        borderRadius: 8, cursor: "pointer", padding: "8px 10px",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      {Ic.nav(cfg.color, 18)}
                    </button>
                  </div>

                  <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {Object.entries(TYPE_CFG).map(([k, c]) => {
                        const active = t === k;
                        return (
                          <button
                            key={k}
                            onClick={() => onTypeChange(i, k)}
                            style={{
                              flex: 1, padding: "8px 6px", borderRadius: 8,
                              border: `2px solid ${active ? c.color : C.b2}`,
                              background: active ? `${c.color}12` : C.w,
                              cursor: "pointer", fontFamily: "inherit",
                              fontSize: 13.2, fontWeight: 800,
                              color: active ? c.color : C.t3,
                              transition: "all 0.15s",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                            }}
                          >
                            {c.icon(active ? c.color : C.t3, 14)} {c.label}
                          </button>
                        );
                      })}
                    </div>

                    {t === "lot" && (
                      <select
                        value={importFieldIds[i] || ""}
                        onChange={e => onFieldIdChange(i, e.target.value)}
                        style={{
                          padding: "10px 12px", borderRadius: 8,
                          border: `1.5px solid ${importFieldIds[i] ? C.acc : C.err}`,
                          background: C.bgInput, fontFamily: "inherit", fontSize: 13.2,
                          color: C.t1, outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="">— Seleccioná el campo —</option>
                        {fieldOptions.map(fo => <option key={fo.id} value={fo.id}>{fo.name}</option>)}
                      </select>
                    )}

                    <input
                      value={importComments[i] || ""}
                      onChange={e => onCommentChange(i, e.target.value)}
                      placeholder="Comentarios (opcional)"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: `1px solid ${C.b2}`, background: C.bgInput,
                        fontFamily: "inherit", fontSize: 12.7, color: C.t1,
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCount > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {(() => {
                const counts = { field: 0, lot: 0, poi: 0 };
                importParsed.forEach((_, i) => { if (importSelected.has(i)) counts[getType(i)]++; });
                return Object.entries(TYPE_CFG).map(([k, c]) => counts[k] > 0 && (
                  <Bd key={k} color={c.color}>{counts[k]} {c.label}{counts[k] !== 1 ? (k === "poi" ? "es" : "s") : ""}</Bd>
                ));
              })()}
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <Btn sm v="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn sm disabled={saving || selectedCount === 0} onClick={onConfirm} style={{ flex: 1 }}>
              {saving ? "Importando..." : `Importar seleccionadas (${selectedCount})`}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
