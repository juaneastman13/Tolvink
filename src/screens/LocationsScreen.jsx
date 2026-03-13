import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { C, Ic, FONT } from "../theme";
import { Btn, Bd, Loader, LoadingOverlay, EmptyState } from "../components";
import { ModalOverlay } from "../components/overlays";
import {
  apiGetFields, apiCreateField, apiCreateLot, apiUpdateField, apiUpdateLot,
  apiImportGoogleList, apiGetPois, apiCreatePoi, apiUpdatePoi, apiDeletePoi,
  apiSharePoi, apiUnsharePoi, apiGetPoiShares, apiReclassifyPoi, apiSearchUsersForShare,
} from "../api";
import MapPreviewModal from "../modals/MapPreviewModal";
import { loadGMaps, mkFieldIcon, mkLotIcon, mkPoiIcon, SafeZone, LocationPicker } from "../maps";
import { useIsDesktop } from "../hooks/useResponsive";

// ── Color config per type ──────────────────────────────────────────
const TYPE_CFG = {
  field: { label: "Campo", color: "#1A6B37", icon: (c, s) => Ic.field(c, s) },
  lot:   { label: "Lote",  color: "#2563EB", icon: (c, s) => Ic.lot(c, s) },
  poi:   { label: "Interés", color: "#0891B2", icon: (c, s) => Ic.poi(c, s) },
};

const MAP_COLORS = { field: "#1A6B37", lot: "#1A6B37", poi: "#0891B2" };
const URUGUAY_CENTER = { lat: -33.0, lng: -56.0 };

const _esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const FILTER_CHIPS = [
  { key: "field", label: "Campos", color: "#1A6B37", icon: (c, s) => Ic.field(c, s) },
  { key: "lot", label: "Lotes", color: "#1A6B37", icon: (c, s) => Ic.lot(c, s) },
  { key: "poi", label: "POIs", color: "#0891B2", icon: (c, s) => Ic.poi(c, s) },
];

export default function LocationsScreen({ onBack }) {
  const isDesktop = useIsDesktop(768);

  // ── Existing state ──
  const [fields, setFields] = useState([]);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");
  const [previewLoc, setPreviewLoc] = useState(null);

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

  // POI edit/delete
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

  // Field edit
  const [editField, setEditField] = useState(null);
  const [editFieldLoc, setEditFieldLoc] = useState(null);

  // Lot edit
  const [editLot, setEditLot] = useState(null); // { fieldId, lotId }
  const [editLotHa, setEditLotHa] = useState("");
  const [editLotLoc, setEditLotLoc] = useState(null);

  // ── New state for fullscreen layout ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [sectionOpen, setSectionOpen] = useState({ pois: true, fields: true });
  const [expandedField, setExpandedField] = useState(null);
  const [mapFilters, setMapFilters] = useState({ field: true, lot: true, poi: true });

  // Map refs
  const mapContainerRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef({});
  const infoRef = useRef(null);
  const panelRef = useRef(null);
  const itemRefsMap = useRef({});

  // ── Data loading ──
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

  // ── POI delete ──
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

  // ── Field edit ──
  const startEditField = (f) => {
    setEditField(f.id);
    const lat = f.lat != null ? Number(f.lat) : null;
    const lng = f.lng != null ? Number(f.lng) : null;
    setEditFieldLoc(lat && lng ? { lat, lng, address: f.address || "" } : null);
  };

  const handleUpdateField = async (fieldId) => {
    setSaving(true);
    try {
      await apiUpdateField(fieldId, {
        address: editFieldLoc?.address || undefined,
        lat: editFieldLoc?.lat || undefined,
        lng: editFieldLoc?.lng || undefined,
      });
      setEditField(null);
      setMsg({ t: "Campo actualizado", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al actualizar campo", k: "err" });
    } finally {
      setSaving(false);
    }
  };

  // ── Lot edit ──
  const startEditLot = (fieldId, l) => {
    setEditLot({ fieldId, lotId: l.id });
    setEditLotHa(l.hectares != null ? String(Number(l.hectares)) : "");
    const lat = l.lat != null ? Number(l.lat) : null;
    const lng = l.lng != null ? Number(l.lng) : null;
    setEditLotLoc(lat && lng ? { lat, lng } : null);
  };

  const handleUpdateLot = async () => {
    if (!editLot) return;
    setSaving(true);
    try {
      await apiUpdateLot(editLot.fieldId, editLot.lotId, {
        hectares: editLotHa ? parseFloat(editLotHa) : undefined,
        lat: editLotLoc?.lat || undefined,
        lng: editLotLoc?.lng || undefined,
      });
      setEditLot(null);
      setMsg({ t: "Lote actualizado", k: "ok" });
      load();
    } catch (err) {
      setMsg({ t: err.message || "Error al actualizar lote", k: "err" });
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

  // ── Derived data ──
  const ownPois = pois.filter(p => !p._isSharedWithMe);
  const sharedPois = pois.filter(p => p._isSharedWithMe);
  const allPois = [...ownPois, ...sharedPois];

  const matchesSearch = (name) => !search || name.toLowerCase().includes(search.toLowerCase());

  // Build flat location array for map markers
  const allLocations = [];
  fields.forEach(f => {
    if (f.lat && f.lng) allLocations.push({ id: `field-${f.id}`, type: "field", name: f.name, lat: Number(f.lat), lng: Number(f.lng), address: f.address });
    (f.lots || []).forEach(l => {
      if (l.lat && l.lng) allLocations.push({ id: `lot-${l.id}`, type: "lot", name: l.name, lat: Number(l.lat), lng: Number(l.lng), fieldName: f.name });
    });
  });
  pois.forEach(p => {
    if (p.lat && p.lng) allLocations.push({ id: `poi-${p.id}`, type: "poi", name: p.name, lat: Number(p.lat), lng: Number(p.lng), address: p.address, isShared: p._isSharedWithMe });
  });

  // ── Map initialization ──
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;
    loadGMaps().then(maps => {
      if (cancelled || !mapContainerRef.current) return;
      const map = new maps.Map(mapContainerRef.current, {
        zoom: 7, center: URUGUAY_CENTER,
        disableDefaultUI: true, zoomControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: { style: maps.MapTypeControlStyle.DROPDOWN_MENU, position: maps.ControlPosition.BOTTOM_RIGHT },
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      mapObjRef.current = map;
      infoRef.current = new maps.InfoWindow();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Update markers when data or filters change ──
  const allLocsRef = useRef(allLocations);
  allLocsRef.current = allLocations;

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.setMap(null));
    markersRef.current = {};

    const bounds = new maps.LatLngBounds();
    let hasPoints = false;

    allLocations.forEach(loc => {
      if (!mapFilters[loc.type]) return;

      const pos = { lat: loc.lat, lng: loc.lng };
      let icon;
      if (loc.type === "field") icon = mkFieldIcon(maps, 1.0);
      else if (loc.type === "lot") icon = mkLotIcon(maps, 0.85);
      else icon = mkPoiIcon(maps, 1.0);

      const marker = new maps.Marker({
        position: pos, map, icon,
        title: loc.name,
        zIndex: activeId === loc.id ? 999 : 1,
      });

      marker.addListener("click", () => {
        const curLoc = allLocsRef.current.find(l => l.id === loc.id) || loc;
        const typeLabel = TYPE_CFG[curLoc.type]?.label || curLoc.type;
        const color = MAP_COLORS[curLoc.type] || C.t1;
        infoRef.current.setContent(
          `<div style="font-family:${FONT};font-size:12px;line-height:1.5;max-width:220px">` +
          `<strong>${_esc(curLoc.name)}</strong><br/>` +
          `<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:${color};color:#fff;font-size:10px;font-weight:600;margin-top:2px">${_esc(typeLabel)}</span>` +
          (curLoc.address ? `<br/><span style="color:#666">${_esc(curLoc.address)}</span>` : "") +
          (curLoc.fieldName ? `<br/><span style="color:#666">${_esc(curLoc.fieldName)}</span>` : "") +
          `</div>`
        );
        infoRef.current.open(map, marker);
        highlightPanelItem(loc.id);
      });

      markersRef.current[loc.id] = marker;
      bounds.extend(pos);
      hasPoints = true;
    });

    if (hasPoints) {
      map.fitBounds(bounds, { top: 60, bottom: 20, left: 20, right: 20 });
    }
  }, [fields, pois, mapFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to active item ──
  useEffect(() => {
    if (!activeId) return;
    const el = itemRefsMap.current[activeId];
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [activeId]);

  // ── Focus on map from panel click ──
  const focusOnMap = useCallback((id, lat, lng) => {
    setActiveId(id);
    const map = mapObjRef.current;
    if (!map) return;
    map.panTo({ lat, lng });
    map.setZoom(15);

    const marker = markersRef.current[id];
    if (marker && infoRef.current) {
      const loc = allLocsRef.current.find(l => l.id === id);
      if (loc) {
        const typeLabel = TYPE_CFG[loc.type]?.label || loc.type;
        const color = MAP_COLORS[loc.type] || C.t1;
        infoRef.current.setContent(
          `<div style="font-family:${FONT};font-size:12px;line-height:1.5;max-width:220px">` +
          `<strong>${_esc(loc.name)}</strong><br/>` +
          `<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:${color};color:#fff;font-size:10px;font-weight:600;margin-top:2px">${_esc(typeLabel)}</span>` +
          (loc.address ? `<br/><span style="color:#666">${_esc(loc.address)}</span>` : "") +
          (loc.fieldName ? `<br/><span style="color:#666">${_esc(loc.fieldName)}</span>` : "") +
          `</div>`
        );
        infoRef.current.open(map, marker);
      }
    }

    if (!isDesktop) setDrawerOpen(false);
  }, [isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Highlight panel item from marker click ──
  const highlightPanelItem = useCallback((id) => {
    setActiveId(id);
    // Expand parent field if it's a lot
    if (id.startsWith("lot-")) {
      const lotId = id.replace("lot-", "");
      for (const f of fields) {
        if ((f.lots || []).some(l => String(l.id) === lotId)) {
          setExpandedField(f.id);
          if (!sectionOpen.fields) setSectionOpen(prev => ({ ...prev, fields: true }));
          break;
        }
      }
    }
    if (id.startsWith("poi-") && !sectionOpen.pois) {
      setSectionOpen(prev => ({ ...prev, pois: true }));
    }
    if (!isDesktop) setDrawerOpen(true);
  }, [isDesktop, fields, sectionOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMapFilter = (key) => setMapFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleSection = (key) => setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Filtered lists for panel ──
  const filteredPois = allPois.filter(p => matchesSearch(p.name));
  const filteredFields = fields.filter(f => {
    if (matchesSearch(f.name)) return true;
    return (f.lots || []).some(l => matchesSearch(l.name));
  });

  // ── Render helpers ──
  const renderPoiItem = (p, isShared) => {
    const id = `poi-${p.id}`;
    const isActive = activeId === id;
    const isEditing = editingPoi?.id === p.id;
    const isDeleting = deletingPoi === p.id;
    const hasCoords = p.lat && p.lng;

    if (isEditing) {
      return (
        <div key={p.id} ref={el => { if (el) itemRefsMap.current[id] = el; }} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.b2}`, background: C.priPale }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.bFocus}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, fontWeight: 700, color: C.t1, outline: "none", boxSizing: "border-box" }} />
            <input value={editComments} onChange={e => setEditComments(e.target.value)} placeholder="Comentarios (opcional)" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 12.1, color: C.t1, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingPoi(null)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
              <button onClick={handleUpdatePoi} disabled={!editName?.trim()} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w, opacity: editName?.trim() ? 1 : 0.5 }}>Guardar</button>
            </div>
          </div>
        </div>
      );
    }

    if (isDeleting) {
      return (
        <div key={p.id} ref={el => { if (el) itemRefsMap.current[id] = el; }} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.b2}`, background: C.errPale }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12.1, fontWeight: 600, color: C.err, flex: 1 }}>
              {isShared ? `¿Quitar "${p.name}"?` : `¿Eliminar "${p.name}"?`}
            </span>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setDeletingPoi(null)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>No</button>
              <button onClick={() => handleDeletePoi(p.id)} style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: C.err, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>{isShared ? "Quitar" : "Sí"}</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={p.id}
        ref={el => { if (el) itemRefsMap.current[id] = el; }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "16px 16px",
          borderBottom: `1px solid ${C.b2}`,
          borderLeft: isActive ? `3px solid ${C.pri}` : "3px solid transparent",
          background: isActive ? C.priPale : "transparent",
          cursor: hasCoords ? "pointer" : "default",
          transition: "background 0.15s",
        }}
        onClick={() => hasCoords && focusOnMap(id, Number(p.lat), Number(p.lng))}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.bgCard; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${C.sec}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {Ic.poi(C.sec, 14)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", whiteSpace: "normal" }}>{p.name}</div>
          {p.comments && <div style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{p.comments}</div>}
          {isShared && <span style={{ fontSize: 10, color: C.info, fontWeight: 600, marginTop: 4, display: "inline-block" }}>Compartida</span>}
        </div>
        <div style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>
          <RowMenu
            id={p.id}
            items={[
              ...(hasCoords ? [{ icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => focusOnMap(id, Number(p.lat), Number(p.lng)) }] : []),
              ...(!isShared ? [{ icon: Ic.share(C.t3, 14), label: "Compartir", onClick: () => openShareModal(p) }] : []),
              ...(!isShared ? [{ icon: Ic.pin(C.t3, 14), label: "Reclasificar", onClick: () => openReclassify(p) }] : []),
              ...(!isShared ? [{ icon: Ic.edit(C.t3, 14), label: "Editar", onClick: () => startEditPoi(p) }] : []),
              { icon: Ic.cross(C.err, 14), label: isShared ? "Quitar" : "Eliminar", onClick: () => setDeletingPoi(p.id), danger: true },
            ]}
          />
        </div>
      </div>
    );
  };

  const renderFieldItem = (f) => {
    const id = `field-${f.id}`;
    const isActive = activeId === id;
    const hasCoords = f.lat && f.lng;
    const isExpanded = expandedField === f.id;
    const isEditingField = editField === f.id;
    const lots = f.lots || [];
    const filteredLots = lots.filter(l => matchesSearch(l.name) || matchesSearch(f.name));

    return (
      <div key={f.id}>
        <div
          ref={el => { if (el) itemRefsMap.current[id] = el; }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "16px 16px",
            borderBottom: `1px solid ${C.b2}`,
            borderLeft: isActive ? `3px solid ${C.pri}` : "3px solid transparent",
            background: isActive ? C.priPale : "transparent",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onClick={() => {
            if (hasCoords) focusOnMap(id, Number(f.lat), Number(f.lng));
            setExpandedField(isExpanded ? null : f.id);
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.bgCard; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${C.pri}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {Ic.field(C.pri, 14)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", whiteSpace: "normal" }}>{f.name}</div>
            {f.address && <div style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{f.address}</div>}
          </div>
          <Bd color={C.pri} small>{lots.length} lote{lots.length !== 1 ? "s" : ""}</Bd>
          <span style={{ display: "inline-flex", transition: "transform 200ms", transform: isExpanded ? "rotate(0)" : "rotate(-90deg)" }}>
            {Ic.down(C.t3, 14)}
          </span>
          <div style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>
            <RowMenu
              id={f.id}
              items={[
                ...(hasCoords ? [{ icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => focusOnMap(id, Number(f.lat), Number(f.lng)) }] : []),
                { icon: Ic.edit(C.t3, 14), label: "Editar ubicación", onClick: () => isEditingField ? setEditField(null) : startEditField(f) },
              ]}
            />
          </div>
        </div>

        {/* Edit field form */}
        {isEditingField && (
          <div style={{ background: C.priPale, padding: 12, borderBottom: `1px solid ${C.b2}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar campo</div>
            <SafeZone><LocationPicker label="Ubicación" value={editFieldLoc} onChange={setEditFieldLoc} /></SafeZone>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => setEditField(null)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
              <button onClick={() => handleUpdateField(f.id)} disabled={saving} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w, opacity: saving ? 0.5 : 1 }}>{saving ? "..." : "Guardar"}</button>
            </div>
          </div>
        )}

        {/* Expanded lots */}
        {isExpanded && filteredLots.map(l => {
          const lotId = `lot-${l.id}`;
          const lotActive = activeId === lotId;
          const lotHasCoords = l.lat && l.lng;
          const isEditingLot = editLot?.lotId === l.id;

          return (
            <div key={l.id}>
              <div
                ref={el => { if (el) itemRefsMap.current[lotId] = el; }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "14px 16px 14px 40px",
                  borderBottom: `1px solid ${C.b2}`,
                  borderLeft: lotActive ? `3px solid ${C.pri}` : "3px solid transparent",
                  background: lotActive ? C.priPale : "transparent",
                  cursor: lotHasCoords ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
                onClick={() => lotHasCoords && focusOnMap(lotId, Number(l.lat), Number(l.lng))}
                onMouseEnter={e => { if (!lotActive) e.currentTarget.style.background = C.bgCard; }}
                onMouseLeave={e => { if (!lotActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 24, height: 24, borderRadius: 6, background: `${C.ok}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {Ic.lot(C.ok, 12)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.t1 }}>{l.name}</span>
                  {l.hectares && <span style={{ fontSize: 11, color: C.t3, marginLeft: 6 }}>{l.hectares} ha</span>}
                </div>
                <div style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>
                  <RowMenu
                    id={l.id}
                    items={[
                      ...(lotHasCoords ? [{ icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => focusOnMap(lotId, Number(l.lat), Number(l.lng)) }] : []),
                      { icon: Ic.edit(C.t3, 14), label: "Editar", onClick: () => isEditingLot ? setEditLot(null) : startEditLot(f.id, l) },
                    ]}
                  />
                </div>
              </div>

              {/* Edit lot form */}
              {isEditingLot && (
                <div style={{ background: C.accPale, padding: 12, marginLeft: 40, borderBottom: `1px solid ${C.b2}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.acc, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Editar lote</div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.t2, display: "block", marginBottom: 4 }}>Hectáreas</label>
                    <input value={editLotHa} onChange={e => setEditLotHa(e.target.value)} placeholder="Ej: 150" type="number" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <SafeZone><LocationPicker label="Ubicación del lote" value={editLotLoc} onChange={setEditLotLoc} defaultCenter={f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : null} /></SafeZone>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => setEditLot(null)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>Cancelar</button>
                    <button onClick={handleUpdateLot} disabled={saving} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.acc, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w, opacity: saving ? 0.5 : 1 }}>{saving ? "..." : "Guardar"}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSectionHeader = (title, count, key, color, iconFn) => (
    <div
      onClick={() => toggleSection(key)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px",
        background: C.bg, cursor: "pointer", userSelect: "none",
        borderBottom: `1px solid ${C.b2}`,
      }}
    >
      <span style={{ display: "inline-flex", transition: "transform 200ms", transform: sectionOpen[key] ? "rotate(0)" : "rotate(-90deg)" }}>
        {Ic.down(C.t3, 14)}
      </span>
      {iconFn(color, 16)}
      <span style={{ flex: 1, fontSize: 13.2, fontWeight: 700, color: C.t1 }}>{title}</span>
      <span style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>{count}</span>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg, fontFamily: FONT }}>
      {/* ── Overlays & Modals ── */}
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}
      {previewLoc && <MapPreviewModal loc={previewLoc} onClose={() => setPreviewLoc(null)} />}

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

      {/* ── Mobile overlay backdrop ── */}
      {!isDesktop && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: C.bgOverlay, zIndex: 100, transition: "opacity 250ms" }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
           LEFT PANEL (desktop: fixed, mobile: drawer)
         ═══════════════════════════════════════════════════════ */}
      <div
        ref={panelRef}
        style={{
          ...(isDesktop ? {
            width: "30%", minWidth: 320, maxWidth: 420,
            borderRight: `1px solid ${C.b1}`,
            position: "relative",
          } : {
            position: "fixed", left: 0, top: 0, bottom: 0,
            width: "85vw", maxWidth: 360,
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 250ms ease-out",
            zIndex: 101,
            boxShadow: drawerOpen ? C.shLg : "none",
          }),
          background: C.w,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.b2}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: importStep === 0 ? 10 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                {Ic.chev(C.pri, 18)}
              </button>
              <span style={{ fontSize: 18, fontWeight: 600, color: C.t1 }}>Ubicaciones</span>
            </div>
            <button
              onClick={() => setImportStep(importStep ? 0 : 1)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: importStep ? "transparent" : C.pri,
                border: importStep ? `1px solid ${C.b1}` : "none",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {importStep ? Ic.cross(C.t3, 16) : Ic.plus(C.w, 16)}
            </button>
          </div>
          {/* Search bar */}
          {importStep === 0 && (
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
                {Ic.srch(C.t3, 14)}
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar ubicación..."
                style={{
                  width: "100%", padding: "8px 12px 8px 32px",
                  borderRadius: 10, border: `1.5px solid ${search ? C.bFocus : C.b2}`,
                  background: C.bgInput, fontFamily: "inherit", fontSize: 13.2,
                  color: C.t1, outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
              />
            </div>
          )}
        </div>

        {/* Panel body - scrollable */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Messages */}
          {msg && (
            <div onClick={() => setMsg(null)} style={{ padding: "8px 16px", fontSize: 12.1, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err, cursor: "pointer", borderBottom: `1px solid ${C.b2}` }}>
              {msg.t}
            </div>
          )}

          {/* Import step 1: paste link */}
          {importStep === 1 && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 14.3, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                {Ic.pin(C.pri, 16)} Importar desde Google Maps
              </div>
              <div style={{ fontSize: 12.1, color: C.t2, lineHeight: 1.5, marginBottom: 12 }}>
                Abrí Google Maps → <strong>Tus sitios</strong> → Seleccioná una lista → <strong>Compartir</strong> → Copiar enlace
              </div>
              <input
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${importUrl ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }}
              />
              {importSlowMsg && <div style={{ marginTop: 8, fontSize: 11, color: C.t3, fontStyle: "italic" }}>Esto puede tardar un momento…</div>}
              <div style={{ marginTop: 10 }}>
                <Btn full v="acc" disabled={saving || !importUrl.trim()} onClick={handleImportList}>
                  {saving ? "Buscando ubicaciones…" : "Buscar ubicaciones"}
                </Btn>
              </div>
            </div>
          )}

          {/* Import step 2: classify */}
          {importStep === 2 && (
            <div style={{ padding: 12 }}>
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
            </div>
          )}

          {/* Loading state */}
          {importStep === 0 && loading && (
            <div style={{ padding: 32, textAlign: "center" }}><Loader /></div>
          )}

          {/* List content */}
          {importStep === 0 && !loading && (
            <>
              {/* ── POIs section ── */}
              {renderSectionHeader(
                "Ubicaciones de interés",
                filteredPois.length,
                "pois",
                MAP_COLORS.poi,
                (c, s) => Ic.poi(c, s)
              )}
              {sectionOpen.pois && (
                filteredPois.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", fontSize: 12.7, color: C.t3 }}>
                    {search ? "Sin resultados" : "Sin ubicaciones de interés"}
                  </div>
                ) : (
                  filteredPois.map(p => renderPoiItem(p, p._isSharedWithMe))
                )
              )}

              {/* ── Fields section ── */}
              {renderSectionHeader(
                "Campos",
                filteredFields.length,
                "fields",
                MAP_COLORS.field,
                (c, s) => Ic.field(c, s)
              )}
              {sectionOpen.fields && (
                filteredFields.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", fontSize: 12.7, color: C.t3 }}>
                    {search ? "Sin resultados" : "Sin campos registrados"}
                  </div>
                ) : (
                  filteredFields.map(f => renderFieldItem(f))
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           MAP (fills remaining space)
         ═══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

        {/* Filter chips (top-right) */}
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 5, display: "flex", gap: 6 }}>
          {FILTER_CHIPS.map(fc => {
            const active = mapFilters[fc.key];
            return (
              <button
                key={fc.key}
                onClick={() => toggleMapFilter(fc.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "6px 10px", borderRadius: 20,
                  background: active ? fc.color : C.w,
                  color: active ? "#fff" : fc.color,
                  border: `1.5px solid ${fc.color}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12.1, fontWeight: 700,
                  boxShadow: C.sh,
                  transition: "all 0.15s",
                }}
              >
                {fc.icon(active ? "#fff" : fc.color, 13)} {fc.label}
              </button>
            );
          })}
        </div>

        {/* Mobile: back button (top-left) */}
        {!isDesktop && !drawerOpen && (
          <button
            onClick={onBack}
            style={{
              position: "absolute", top: 12, left: 12, zIndex: 5,
              width: 40, height: 40, borderRadius: 20,
              background: C.w, border: `1px solid ${C.b1}`,
              boxShadow: C.sh, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {Ic.chev(C.pri, 20)}
          </button>
        )}

        {/* Mobile: list button (bottom-left) */}
        {!isDesktop && !drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              position: "absolute", bottom: 24, left: 16, zIndex: 5,
              background: C.w, border: `1px solid ${C.b1}`,
              borderRadius: 12, padding: "10px 16px",
              boxShadow: C.shMd, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "inherit", fontSize: 14.3, fontWeight: 700, color: C.t1,
            }}
          >
            {Ic.menu3(C.pri, 16)} Lista
          </button>
        )}

        {/* Empty state overlay on map */}
        {!loading && allLocations.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <div style={{ background: C.w, padding: "20px 28px", borderRadius: 14, boxShadow: C.shMd, textAlign: "center", pointerEvents: "auto" }}>
              <div style={{ marginBottom: 8 }}>{Ic.poi(C.t3, 28)}</div>
              <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Sin ubicaciones</div>
              <div style={{ fontSize: 12.7, color: C.t3, marginBottom: 12 }}>Importá ubicaciones desde Google Maps</div>
              <Btn sm onClick={() => { if (!isDesktop) setDrawerOpen(true); setImportStep(1); }}>Importar</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ROW CONTEXT MENU (⋮ → dropdown)
// ═══════════════════════════════════════════════════════════════════════

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

  // Use portal to escape CSS transform containing blocks (e.g. mobile drawer)
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
          fontSize: 12.1, color: C.t3, fontFamily: "inherit", fontWeight: 600,
        }}
      >
        Opciones <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, lineHeight: 1 }}>⋮</span>
      </button>
      {dropdown}
    </div>
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

        <div style={{ marginBottom: 14 }}>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
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
                  <button onClick={() => onShare(u.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: C.pri, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>
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

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { key: "field", label: "Campo", color: MAP_COLORS.field, icon: Ic.field },
            { key: "lot", label: "Lote", color: "#2563EB", icon: Ic.lot },
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
// IMPORT CLASSIFY PANEL
// ═══════════════════════════════════════════════════════════════════════

function ImportClassifyPanel({
  importParsed, importSelected, importNames, importTypes, importFieldIds, importComments,
  importDiscarded, importWarning, importListName, fieldOptions, saving, selectedCount,
  getType, getName,
  onToggle, onNameChange, onTypeChange, onFieldIdChange, onCommentChange,
  onSelectAll, onSelectNone, onPreview, onClose, onConfirm,
}) {
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, boxShadow: C.sh }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 14.3, fontWeight: 700 }}>{Ic.pin(C.pri, 14)} {importListName || "Ubicaciones encontradas"}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 14)}</button>
      </div>
      {importWarning && <div style={{ padding: "6px 10px", borderRadius: 8, marginBottom: 8, fontSize: 11, fontWeight: 500, background: C.warnPale, color: C.warn, border: `1px solid ${C.warn}30` }}>{importWarning}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 12.1, color: C.t2 }}>
          <span style={{ fontWeight: 600, color: C.ok }}>{importParsed.length} encontradas</span>
          {importDiscarded > 0 && <span style={{ color: C.t3 }}>{importDiscarded} descartadas</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onSelectAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.pri, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Todas</button>
          <span style={{ color: C.t3 }}>·</span>
          <button onClick={onSelectNone} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.t3, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Ninguna</button>
        </div>
      </div>

      {importParsed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 16, color: C.t3, fontSize: 12.7 }}>No se encontraron ubicaciones válidas</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {importParsed.map((loc, i) => {
              const sel = importSelected.has(i);
              const t = getType(i);
              const cfg = TYPE_CFG[t];
              return (
                <div key={i} style={{
                  borderRadius: 10, border: `1.5px solid ${sel ? cfg.color : C.b1}`,
                  borderLeft: sel ? `3px solid ${cfg.color}` : `3px solid ${C.b1}`,
                  background: sel ? `${cfg.color}04` : C.bg,
                  transition: "all 0.15s", overflow: "hidden",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 6px" }}>
                    <div onClick={() => onToggle(i)} style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: `2px solid ${sel ? cfg.color : C.b2}`,
                      background: sel ? cfg.color : C.w,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, cursor: "pointer",
                    }}>
                      {sel && Ic.chk(C.w, 12)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={importNames[i] ?? loc.name}
                        onChange={e => onNameChange(i, e.target.value)}
                        placeholder="Nombre"
                        style={{ width: "100%", border: "none", background: "transparent", fontSize: 13.2, fontWeight: 700, color: C.t1, fontFamily: "inherit", padding: 0, outline: "none" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        {loc.address && <span style={{ fontSize: 10, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.address}</span>}
                        <span style={{ fontSize: 9.5, color: C.ok, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onPreview({ name: importNames[i] ?? loc.name, address: loc.address, lat: loc.lat, lng: loc.lng })}
                      title="Ver en mapa"
                      style={{
                        background: `${cfg.color}10`, border: `1px solid ${cfg.color}30`,
                        borderRadius: 6, cursor: "pointer", padding: "6px 8px",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      {Ic.nav(cfg.color, 16)}
                    </button>
                  </div>

                  <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {Object.entries(TYPE_CFG).map(([k, c]) => {
                        const active = t === k;
                        return (
                          <button
                            key={k}
                            onClick={() => onTypeChange(i, k)}
                            style={{
                              flex: 1, padding: "6px 4px", borderRadius: 6,
                              border: `2px solid ${active ? c.color : C.b2}`,
                              background: active ? `${c.color}12` : C.w,
                              cursor: "pointer", fontFamily: "inherit",
                              fontSize: 11.5, fontWeight: 800,
                              color: active ? c.color : C.t3,
                              transition: "all 0.15s",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                            }}
                          >
                            {c.icon(active ? c.color : C.t3, 12)} {c.label}
                          </button>
                        );
                      })}
                    </div>

                    {t === "lot" && (
                      <select
                        value={importFieldIds[i] || ""}
                        onChange={e => onFieldIdChange(i, e.target.value)}
                        style={{
                          padding: "8px 10px", borderRadius: 6,
                          border: `1.5px solid ${importFieldIds[i] ? C.acc : C.err}`,
                          background: C.bgInput, fontFamily: "inherit", fontSize: 12.1,
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
                        width: "100%", padding: "6px 8px", borderRadius: 6,
                        border: `1px solid ${C.b2}`, background: C.bgInput,
                        fontFamily: "inherit", fontSize: 11.5, color: C.t1,
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCount > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {(() => {
                const counts = { field: 0, lot: 0, poi: 0 };
                importParsed.forEach((_, i) => { if (importSelected.has(i)) counts[getType(i)]++; });
                return Object.entries(TYPE_CFG).map(([k, c]) => counts[k] > 0 && (
                  <Bd key={k} color={c.color}>{counts[k]} {c.label}{counts[k] !== 1 ? (k === "poi" ? "es" : "s") : ""}</Bd>
                ));
              })()}
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <Btn sm v="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn sm disabled={saving || selectedCount === 0} onClick={onConfirm} style={{ flex: 1 }}>
              {saving ? "Importando..." : `Importar (${selectedCount})`}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
