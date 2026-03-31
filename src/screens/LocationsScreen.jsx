import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C, Ic, FONT, R } from "../theme";
import { Btn, Bd, Loader, LoadingOverlay } from "../components";
import {
  apiGetFields, apiGetFieldOwnersSummary, apiCreateField, apiCreateLot, apiUpdateField, apiUpdateLot,
  apiImportGoogleList, apiGetPois, apiCreatePoi, apiUpdatePoi, apiDeletePoi,
  apiDeleteField, apiDeleteLot, apiGetCompanyAccess,
} from "../api";
import MapPreviewModal from "../modals/MapPreviewModal";
import { useCatalogStore } from "../store";
import { loadGMaps, mkFieldIcon, mkLotIcon, mkPoiIcon } from "../maps";
import { useIsDesktop } from "../hooks/useResponsive";
import { useAccessLevel } from "../hooks/useAccessLevel";
import {
  RowMenu, FieldForm, LotForm, PoiForm,
  ShareLocationModal, ReclassifyModal, ImportClassifyPanel,
} from "../components/locations";

// ── Constants ──
const LOC_COLORS = { field: "#1A6B37", lot: "#66BB6A", poi: "#29B6F6" };
const TYPE_CFG = {
  field: { label: "Campo", color: LOC_COLORS.field, icon: (c, s) => Ic.field(c, s) },
  lot:   { label: "Lote",  color: LOC_COLORS.lot, icon: (c, s) => Ic.lot(c, s) },
  poi:   { label: "Interés", color: LOC_COLORS.poi, icon: (c, s) => Ic.poi(c, s) },
};
const MAP_COLORS = LOC_COLORS;
const URUGUAY_CENTER = { lat: -33.0, lng: -56.0 };
const FILTER_CHIPS = [
  { key: "field", label: "campos", icon: (c, s) => Ic.field(c, s) },
  { key: "lot", label: "lotes", icon: (c, s) => Ic.lot(c, s) },
  { key: "poi", label: "ubicaciones", icon: (c, s) => Ic.poi(c, s) },
];
const FILTER_COLORS = { field: LOC_COLORS.field, lot: LOC_COLORS.lot, poi: LOC_COLORS.poi };
const _esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ── Slide-in wrapper for inline forms ──
function SlideIn({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.maxHeight = "0";
    el.style.opacity = "0";
    el.style.overflow = "hidden";
    el.style.transition = "max-height 200ms ease-out, opacity 150ms ease-out";
    requestAnimationFrame(() => {
      el.style.maxHeight = el.scrollHeight + 200 + "px";
      el.style.opacity = "1";
    });
  }, []);
  return <div ref={ref}>{children}</div>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCATIONS SCREEN — orchestrator
// ═══════════════════════════════════════════════════════════════════

export default function LocationsScreen({ onBack, user }) {
  const isDesktop = useIsDesktop(768);
  const navigate = useNavigate();
  const isManager = ["admin","gerente","platform_admin"].includes(user?.role);
  const { isConsulta } = useAccessLevel(user);
  const canWrite = !isConsulta;

  // ── Plant filter: company dropdown ──
  const [ownerFilter, setOwnerFilter] = useState(""); // "" = all, "mine" = own, uuid = specific company
  const [ownersSummary, setOwnersSummary] = useState([]); // [{companyId, companyName, fieldCount, lotCount}]
  const [linkedCompanies, setLinkedCompanies] = useState([]); // CompanyAccess linked companies for creation forms

  // ── Core data ──
  const [fields, setFields] = useState([]);
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");
  const [previewLoc, setPreviewLoc] = useState(null);

  // ── Import flow ──
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

  // ── Entity state ──
  const [editingPoi, setEditingPoi] = useState(null);
  const [deletingPoi, setDeletingPoi] = useState(null);
  const [deletingField, setDeletingField] = useState(null);
  const [deletingLot, setDeletingLot] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editLot, setEditLot] = useState(null);
  const [creatingField, setCreatingField] = useState(false);
  const [creatingLotForField, setCreatingLotForField] = useState(null);
  const [creatingPoi, setCreatingPoi] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuSub, setAddMenuSub] = useState(null); // null | "manual"
  const [creationMode, setCreationMode] = useState(null); // null | 'field' | 'lot' | 'poi'

  // ── Modals ──
  const [sharingEntity, setSharingEntity] = useState(null);
  const [reclassifyPoi, setReclassifyPoi] = useState(null);

  // ── Layout state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [sectionOpen, setSectionOpen] = useState({ pois: true, fields: true });
  const [collapsedCompanies, setCollapsedCompanies] = useState({});
  const [expandedField, setExpandedField] = useState(null);
  const [mapFilters, setMapFilters] = useState({ field: true, lot: true, poi: true });
  const [mapType, setMapType] = useState("roadmap");
  const [mapOptionsOpen, setMapOptionsOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapSelectMode, setMapSelectMode] = useState(null); // null | { callback, currentPos }
  const selectMarkerRef = useRef(null);
  const selectListenerRef = useRef(null);

  // ── Map refs ──
  const mapContainerRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef({});
  const infoRef = useRef(null);
  const panelRef = useRef(null);
  const itemRefsMap = useRef({});

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════

  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([apiGetFields(), apiGetPois().catch(() => [])]);
      setFields(f || []);
      setPois(p || []);
      // Load owners summary for plant dropdown
      if (isManager) apiGetFieldOwnersSummary().then(s => setOwnersSummary(s || [])).catch(() => {});
    } catch (e) {
      setMsg({ t: e.message || "Error al cargar datos", k: "err" });
    } finally {
      setLoading(false);
    }
  }, [isManager]);
  useEffect(() => { load(); }, [load]);

  // Load linked companies for plant creation forms
  useEffect(() => {
    if (!isManager || !user?.activeCompanyId) return;
    apiGetCompanyAccess(user.activeCompanyId)
      .then(data => setLinkedCompanies((data || []).filter(r => r.isActive)))
      .catch(() => {});
  }, [isManager, user?.activeCompanyId]);

  // ═══════════════════════════════════════════════════════════════
  // API HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleCreateField = async (data) => {
    if (!data.name) { setMsg({ t: "Nombre obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateField({ name: data.name, address: data.address || undefined, lat: data.lat || undefined, lng: data.lng || undefined, ...(data.ownerCompanyId ? { ownerCompanyId: data.ownerCompanyId } : {}) });
      await load();
      useCatalogStore.getState().clearCache();
      setCreatingField(false);
      setCreationMode(null);
      setMsg({ t: "Campo creado", k: "ok" });
      if (data.lat && data.lng && mapObjRef.current) { mapObjRef.current.panTo({ lat: data.lat, lng: data.lng }); mapObjRef.current.setZoom(15); }
    } catch (err) { setMsg({ t: err.message || "Error al crear campo", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleUpdateField = async (fieldId, data) => {
    setSaving(true);
    try {
      await apiUpdateField(fieldId, { address: data.address || undefined, lat: data.lat || undefined, lng: data.lng || undefined });
      await load();
      useCatalogStore.getState().clearCache();
      setEditField(null);
      setMsg({ t: "Campo actualizado", k: "ok" });
    } catch (err) { setMsg({ t: err.message || "Error al actualizar campo", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleDeleteField = async (fieldId) => {
    const prev = fields;
    setFields(f => f.filter(x => x.id !== fieldId));
    setDeletingField(null);
    setMsg({ t: "Campo eliminado", k: "ok" });
    try {
      await apiDeleteField(fieldId);
      useCatalogStore.getState().clearCache();
    } catch (err) {
      setFields(prev);
      setMsg({ t: err.message || "Error al eliminar", k: "err" });
    }
  };

  const handleCreateLot = async (fieldId, data) => {
    if (!data.name) { setMsg({ t: "Nombre del lote obligatorio", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreateLot(fieldId, { name: data.name, hectares: data.hectares, lat: data.lat || undefined, lng: data.lng || undefined });
      await load();
      useCatalogStore.getState().clearCache();
      setCreatingLotForField(null);
      setCreationMode(null);
      setMsg({ t: "Lote creado", k: "ok" });
      if (data.lat && data.lng && mapObjRef.current) { mapObjRef.current.panTo({ lat: data.lat, lng: data.lng }); mapObjRef.current.setZoom(15); }
    } catch (err) { setMsg({ t: err.message || "Error al crear lote", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleUpdateLot = async (fieldId, lotId, data) => {
    setSaving(true);
    try {
      await apiUpdateLot(fieldId, lotId, { hectares: data.hectares, lat: data.lat || undefined, lng: data.lng || undefined });
      await load();
      useCatalogStore.getState().clearCache();
      setEditLot(null);
      setMsg({ t: "Lote actualizado", k: "ok" });
    } catch (err) { setMsg({ t: err.message || "Error al actualizar lote", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleDeleteLot = async (fieldId, lotId) => {
    const prev = fields;
    setFields(f => f.map(x => x.id === fieldId ? { ...x, lots: (x.lots || []).filter(l => l.id !== lotId) } : x));
    setDeletingLot(null);
    setMsg({ t: "Lote eliminado", k: "ok" });
    try {
      await apiDeleteLot(fieldId, lotId);
      useCatalogStore.getState().clearCache();
    } catch (err) {
      setFields(prev);
      setMsg({ t: err.message || "Error al eliminar", k: "err" });
    }
  };

  const handleCreatePoi = async (data) => {
    if (!data.name) { setMsg({ t: "Nombre obligatorio", k: "err" }); return; }
    if (!data.lat) { setMsg({ t: "Seleccioná una ubicación en el mapa", k: "err" }); return; }
    setSaving(true);
    try {
      await apiCreatePoi({ name: data.name, comments: data.comments, lat: data.lat, lng: data.lng, ...(data.ownerCompanyId ? { ownerCompanyId: data.ownerCompanyId } : {}) });
      await load();
      useCatalogStore.getState().clearCache();
      setCreatingPoi(false);
      setCreationMode(null);
      setMsg({ t: "Ubicación creada", k: "ok" });
      if (data.lat && data.lng && mapObjRef.current) { mapObjRef.current.panTo({ lat: data.lat, lng: data.lng }); mapObjRef.current.setZoom(15); }
    } catch (err) { setMsg({ t: err.message || "Error al crear ubicación", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleUpdatePoi = async (poiId, data) => {
    setSaving(true);
    try {
      await apiUpdatePoi(poiId, data);
      await load();
      useCatalogStore.getState().clearCache();
      setEditingPoi(null);
      setMsg({ t: "Ubicación actualizada", k: "ok" });
    } catch (err) { setMsg({ t: err.message || "Error al actualizar", k: "err" }); }
    finally { setSaving(false); }
  };

  const handleDeletePoi = async (id) => {
    const prev = pois;
    setPois(p => p.filter(x => x.id !== id));
    setDeletingPoi(null);
    setMsg({ t: "Ubicación eliminada", k: "ok" });
    try {
      await apiDeletePoi(id);
      useCatalogStore.getState().clearCache();
    } catch (err) {
      setPois(prev);
      setMsg({ t: err.message || "Error al eliminar", k: "err" });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // IMPORT HANDLERS
  // ═══════════════════════════════════════════════════════════════

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
      setImportNames({}); setImportTypes({}); setImportFieldIds({}); setImportComments({});
      setImportStep(2);
    } catch (err) { setMsg({ t: err.message || "No se pudieron extraer ubicaciones de este link.", k: "err" }); }
    finally { clearTimeout(slowTimer); setImportSlowMsg(false); setSaving(false); }
  };

  const getType = (i) => importTypes[i] || "field";
  const getName = (i) => (importNames[i] ?? (importParsed[i]?.name || "")).trim().slice(0, 255);

  const handleImportConfirm = async () => {
    const selected = importParsed.map((loc, i) => ({ loc, i })).filter(({ i }) => importSelected.has(i));
    if (selected.length === 0) { setMsg({ t: "Seleccioná al menos una ubicación", k: "err" }); return; }
    for (const { i } of selected) {
      if (getType(i) === "lot" && !importFieldIds[i]) {
        setMsg({ t: `"${getName(i)}" es Lote pero no tiene campo asignado`, k: "err" }); return;
      }
    }
    setSaving(true);
    let createdFields = 0, createdLots = 0, createdPois = 0;
    const errors = [];
    const newFieldIds = {};
    for (const { loc, i } of selected) {
      if (getType(i) !== "field") continue;
      try { const r = await apiCreateField({ name: getName(i), address: loc.address || undefined, lat: loc.lat, lng: loc.lng }); newFieldIds[i] = r.id; createdFields++; }
      catch (err) { errors.push(`"${getName(i)}": ${err.message}`); }
    }
    for (const { loc, i } of selected) {
      if (getType(i) !== "lot") continue;
      let fieldId = importFieldIds[i];
      if (fieldId?.startsWith("new:")) { fieldId = newFieldIds[parseInt(fieldId.split(":")[1], 10)]; if (!fieldId) { errors.push(`"${getName(i)}": el campo asociado no se pudo crear`); continue; } }
      try { await apiCreateLot(fieldId, { name: getName(i), lat: loc.lat, lng: loc.lng }); createdLots++; }
      catch (err) { errors.push(`"${getName(i)}": ${err.message}`); }
    }
    for (const { loc, i } of selected) {
      if (getType(i) !== "poi") continue;
      try { await apiCreatePoi({ name: getName(i), address: loc.address || undefined, lat: loc.lat, lng: loc.lng, comments: importComments[i] || undefined }); createdPois++; }
      catch (err) { errors.push(`"${getName(i)}": ${err.message}`); }
    }
    setImportStep(0); setImportParsed([]); setImportUrl(""); setSaving(false);
    const parts = [];
    if (createdFields) parts.push(`${createdFields} campo${createdFields !== 1 ? "s" : ""}`);
    if (createdLots) parts.push(`${createdLots} lote${createdLots !== 1 ? "s" : ""}`);
    if (createdPois) parts.push(`${createdPois} ubicación${createdPois !== 1 ? "es" : ""} de interés`);
    const total = createdFields + createdLots + createdPois;
    if (total > 0) { let m = parts.join(", ") + ` importado${total !== 1 ? "s" : ""}`; if (errors.length) m += ` · ${errors.length} error${errors.length !== 1 ? "es" : ""}: ${errors.slice(0, 2).join("; ")}`; setDoneMsg(m); }
    else if (errors.length) setDoneMsg(`Error al importar: ${errors.slice(0, 3).join("; ")}`);
    else setDoneMsg("No se importaron ubicaciones");
    await load();
    if (createdFields + createdLots + createdPois > 0) useCatalogStore.getState().clearCache();
  };

  const toggleItem = (i) => setImportSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const closeImport = () => { setImportStep(0); setImportParsed([]); setImportUrl(""); setImportWarning(null); setImportListName(null); setImportTypes({}); setImportFieldIds({}); setImportComments({}); };

  const selectedCount = [...importSelected].length;
  const fieldOptions = [
    ...fields.map(f => ({ id: f.id, name: f.name })),
    ...importParsed.map((loc, i) => ({ i, name: importNames[i] ?? loc.name })).filter(({ i }) => importSelected.has(i) && getType(i) === "field").map(({ i, name }) => ({ id: `new:${i}`, name: `${name} (nuevo)` })),
  ];

  // ═══════════════════════════════════════════════════════════════
  // DERIVED DATA
  // ═══════════════════════════════════════════════════════════════

  const ownPois = pois.filter(p => !p._isSharedWithMe);
  const sharedPois = pois.filter(p => p._isSharedWithMe);
  const allPois = [...ownPois, ...sharedPois];
  const matchesSearch = (name) => !search || name.toLowerCase().includes(search.toLowerCase());

  const allLocations = [];
  const fieldsForMap = isManager && ownerFilter
    ? fields.filter(f => ownerFilter === "mine" ? !f.ownerCompanyId : (f.ownerCompanyId === ownerFilter || f.companyId === ownerFilter))
    : fields;
  fieldsForMap.forEach(f => {
    if (f.lat && f.lng) allLocations.push({ id: `field-${f.id}`, type: "field", name: f.name, lat: Number(f.lat), lng: Number(f.lng), address: f.address, ownerCompanyName: f.ownerCompany?.name });
    (f.lots || []).forEach(l => {
      if (l.lat && l.lng) allLocations.push({ id: `lot-${l.id}`, type: "lot", name: l.name, lat: Number(l.lat), lng: Number(l.lng), fieldName: f.name, fieldId: f.id });
    });
  });
  pois.forEach(p => {
    if (p.lat && p.lng) allLocations.push({ id: `poi-${p.id}`, type: "poi", name: p.name, lat: Number(p.lat), lng: Number(p.lng), address: p.address, isShared: p._isSharedWithMe });
  });

  const filteredPois = allPois.filter(p => matchesSearch(p.name));
  // Apply owner filter for plant users
  const ownerFilteredFields = isManager && ownerFilter
    ? fields.filter(f => {
        if (ownerFilter === "mine") return !f.ownerCompanyId;
        return f.ownerCompanyId === ownerFilter || f.companyId === ownerFilter;
      })
    : fields;
  const filteredFields = ownerFilteredFields.filter(f => matchesSearch(f.name) || (f.lots || []).some(l => matchesSearch(l.name)));

  // ═══════════════════════════════════════════════════════════════
  // MAP
  // ═══════════════════════════════════════════════════════════════

  const handleInfoAction = useCallback((action, type, rawId) => {
    if (type === "field") {
      const f = fields.find(x => String(x.id) === rawId);
      if (!f) return;
      if (action === "edit") { setEditField(f.id); setExpandedField(f.id); if (!sectionOpen.fields) setSectionOpen(p => ({ ...p, fields: true })); if (!isDesktop) setDrawerOpen(true); }
      if (action === "share") setSharingEntity({ type: "field", entity: f });
    } else if (type === "lot") {
      for (const f of fields) {
        const l = (f.lots || []).find(x => String(x.id) === rawId);
        if (l) {
          if (action === "edit") { setEditLot({ fieldId: f.id, lotId: l.id }); setExpandedField(f.id); if (!sectionOpen.fields) setSectionOpen(p => ({ ...p, fields: true })); if (!isDesktop) setDrawerOpen(true); }
          if (action === "share") setSharingEntity({ type: "lot", entity: l, fieldId: f.id });
          break;
        }
      }
    } else if (type === "poi") {
      const p = pois.find(x => String(x.id) === rawId);
      if (!p) return;
      if (action === "edit") { setEditingPoi(p); if (!sectionOpen.pois) setSectionOpen(p2 => ({ ...p2, pois: true })); if (!isDesktop) setDrawerOpen(true); }
      if (action === "share") setSharingEntity({ type: "poi", entity: p });
    }
  }, [fields, pois, isDesktop, sectionOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInfoActionRef = useRef(handleInfoAction);
  handleInfoActionRef.current = handleInfoAction;
  const highlightPanelItemRef = useRef(null);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;
    loadGMaps().then(maps => {
      if (cancelled || !mapContainerRef.current) return;
      const map = new maps.Map(mapContainerRef.current, {
        zoom: 7, center: URUGUAY_CENTER, disableDefaultUI: true, zoomControl: true,
        mapTypeControl: false,
        gestureHandling: "greedy",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "transit", stylers: [{ visibility: "off" }] }],
      });
      mapObjRef.current = map;
      infoRef.current = new maps.InfoWindow();
      setMapReady(true);
      map.getDiv().addEventListener("click", (e) => {
        const btn = e.target.closest("[data-iw-action]");
        if (!btn) return;
        const action = btn.dataset.iwAction;
        const type = btn.dataset.iwType;
        const id = btn.dataset.iwId;
        infoRef.current.close();
        if (action === "edit") handleInfoActionRef.current("edit", type, id);
        if (action === "share") handleInfoActionRef.current("share", type, id);
        if (action === "list") highlightPanelItemRef.current(id);
        if (action === "solicitar") {
          const name = btn.dataset.iwName;
          const fieldId = btn.dataset.iwFieldId;
          const lat = btn.dataset.iwLat;
          const lng = btn.dataset.iwLng;
          if (type === "field") navigateRef.current(`/new?originFieldId=${id}`);
          else if (type === "lot") navigateRef.current(`/new?originFieldId=${fieldId}&originLotId=${id}`);
          else navigateRef.current(`/new?originMode=map&originName=${encodeURIComponent(name)}&originLat=${lat}&originLng=${lng}`);
        }
        if (action === "ver-fletes") {
          const name = btn.dataset.iwName;
          navigateRef.current(`/list?search=${encodeURIComponent(name)}&fromLocations=1`);
        }
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const allLocsRef = useRef(allLocations);
  allLocsRef.current = allLocations;

  const buildInfoContent = (loc) => {
    const typeLabel = TYPE_CFG[loc.type]?.label || loc.type;
    const color = MAP_COLORS[loc.type] || C.t1;
    const btnStyle = `display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:6px;border:1px solid ${C.b2};background:${C.w};cursor:pointer;font-family:${FONT};font-size:11px;font-weight:600;color:${C.t2}`;
    const rawId = loc.id.replace(/^(field|lot|poi)-/, "");
    const accBtn = `flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 8px;border-radius:8px;border:none;cursor:pointer;background:${C.acc};color:#fff;font-size:12px;font-weight:600;font-family:${FONT}`;
    const secBtn = `flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 8px;border-radius:8px;cursor:pointer;background:${C.w};color:${C.t1};font-size:12px;font-weight:500;font-family:${FONT};border:1px solid ${C.b1}`;
    return `<div style="font-family:${FONT};font-size:12px;line-height:1.5;min-width:210px;max-width:260px">` +
      `<div style="display:flex;gap:6px;margin-bottom:8px">` +
        `<button data-iw-action="ver-fletes" data-iw-type="${loc.type}" data-iw-id="${rawId}" data-iw-name="${_esc(loc.name)}" style="${secBtn}">Ver fletes</button>` +
        `<button data-iw-action="solicitar" data-iw-type="${loc.type}" data-iw-id="${rawId}" data-iw-field-id="${loc.fieldId || ""}" data-iw-lat="${loc.lat}" data-iw-lng="${loc.lng}" data-iw-name="${_esc(loc.name)}" style="${accBtn}">Solicitar flete</button>` +
      `</div>` +
      `<strong>${_esc(loc.name)}</strong><br/>` +
      `<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:${color};color:#fff;font-size:10px;font-weight:600;margin-top:2px">${_esc(typeLabel)}</span>` +
      (loc.fieldName ? `<br/><span style="color:#666">${_esc(loc.fieldName)}</span>` : "") +
      `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">` +
        (!loc.isShared ? `<button data-iw-action="edit" data-iw-type="${loc.type}" data-iw-id="${rawId}" style="${btnStyle}">Editar</button>` : "") +
        (!loc.isShared ? `<button data-iw-action="share" data-iw-type="${loc.type}" data-iw-id="${rawId}" style="${btnStyle}">Compartir</button>` : "") +
        (!isDesktop ? `<button data-iw-action="list" data-iw-type="${loc.type}" data-iw-id="${loc.id}" style="${btnStyle}">Ver en lista</button>` : "") +
      `</div>` +
      `</div>`;
  };

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;
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
      const marker = new maps.Marker({ position: pos, map, icon, title: loc.name, zIndex: activeId === loc.id ? 999 : 1 });
      marker.addListener("click", () => {
        const curLoc = allLocsRef.current.find(l => l.id === loc.id) || loc;
        infoRef.current.setContent(buildInfoContent(curLoc));
        infoRef.current.open(map, marker);
        if (isDesktop) highlightPanelItem(loc.id);
      });
      markersRef.current[loc.id] = marker;
      bounds.extend(pos);
      hasPoints = true;
    });
    if (hasPoints) map.fitBounds(bounds, { top: 60, bottom: 20, left: 20, right: 20 });
  }, [fields, pois, mapFilters, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId) return;
    const el = itemRefsMap.current[activeId];
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  }, [activeId]);

  const focusOnMap = useCallback((id, lat, lng) => {
    setActiveId(id);
    const map = mapObjRef.current;
    if (!map) return;
    map.panTo({ lat, lng }); map.setZoom(15);
    const marker = markersRef.current[id];
    if (marker && infoRef.current) {
      const loc = allLocsRef.current.find(l => l.id === id);
      if (loc) { infoRef.current.setContent(buildInfoContent(loc)); infoRef.current.open(map, marker); }
    }
    if (!isDesktop) setDrawerOpen(false);
  }, [isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlightPanelItem = useCallback((id) => {
    setActiveId(id);
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
    if (id.startsWith("poi-") && !sectionOpen.pois) setSectionOpen(prev => ({ ...prev, pois: true }));
    if (!isDesktop) setDrawerOpen(true);
  }, [isDesktop, fields, sectionOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  highlightPanelItemRef.current = highlightPanelItem;

  const toggleMapFilter = (key) => setMapFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleMapType = () => {
    const next = mapType === "roadmap" ? "hybrid" : "roadmap";
    setMapType(next);
    if (mapObjRef.current) mapObjRef.current.setMapTypeId(next);
  };

  const startMapSelect = useCallback((currentPos, callback) => {
    if (!isDesktop) setDrawerOpen(false);
    setMapSelectMode({ callback, currentPos });
    const map = mapObjRef.current;
    if (!map || !window.google?.maps) return;
    const maps = window.google.maps;
    // Clear previous select marker
    if (selectMarkerRef.current) { selectMarkerRef.current.setMap(null); selectMarkerRef.current = null; }
    if (selectListenerRef.current) { maps.event.removeListener(selectListenerRef.current); selectListenerRef.current = null; }
    const redPinIcon = {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="#E53E3E"/><circle cx="18" cy="18" r="7" fill="white"/></svg>'),
      scaledSize: new maps.Size(36, 48),
      anchor: new maps.Point(18, 48),
    };
    const addDragEnd = (marker) => {
      marker.addListener("dragend", () => {
        const p = { lat: marker.getPosition().lat(), lng: marker.getPosition().lng() };
        setMapSelectMode(prev => prev ? { ...prev, currentPos: p } : null);
      });
    };
    // Place existing marker if editing
    if (currentPos?.lat && currentPos?.lng) {
      selectMarkerRef.current = new maps.Marker({ position: { lat: currentPos.lat, lng: currentPos.lng }, map, draggable: true, icon: redPinIcon, animation: maps.Animation.DROP, zIndex: 9999 });
      addDragEnd(selectMarkerRef.current);
      map.panTo({ lat: currentPos.lat, lng: currentPos.lng });
    }
    // Click to place/move marker
    selectListenerRef.current = map.addListener("click", (e) => {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (selectMarkerRef.current) {
        selectMarkerRef.current.setPosition(pos);
      } else {
        selectMarkerRef.current = new maps.Marker({ position: pos, map, draggable: true, icon: redPinIcon, animation: maps.Animation.DROP, zIndex: 9999 });
        addDragEnd(selectMarkerRef.current);
      }
      setMapSelectMode(prev => prev ? { ...prev, currentPos: pos } : null);
    });
  }, [isDesktop]);

  const confirmMapSelect = useCallback(() => {
    const marker = selectMarkerRef.current;
    if (!marker || !mapSelectMode?.callback) { cancelMapSelect(); return; }
    const pos = { lat: marker.getPosition().lat(), lng: marker.getPosition().lng() };
    const cb = mapSelectMode.callback;
    // Cleanup
    marker.setMap(null);
    selectMarkerRef.current = null;
    if (selectListenerRef.current && window.google?.maps) { window.google.maps.event.removeListener(selectListenerRef.current); selectListenerRef.current = null; }
    setMapSelectMode(null);
    if (!isDesktop) setDrawerOpen(true);
    cb(pos);
  }, [mapSelectMode, isDesktop]);

  const cancelMapSelect = useCallback(() => {
    if (selectMarkerRef.current) { selectMarkerRef.current.setMap(null); selectMarkerRef.current = null; }
    if (selectListenerRef.current && window.google?.maps) { window.google.maps.event.removeListener(selectListenerRef.current); selectListenerRef.current = null; }
    setMapSelectMode(null);
    if (!isDesktop) setDrawerOpen(true);
  }, [isDesktop]);
  const toggleSection = (key) => setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const isFormActive = creationMode || creatingField || creatingPoi || creatingLotForField || editField || editLot || editingPoi;

  // ═══════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════

  const renderPoiItem = (p, isShared) => {
    const id = `poi-${p.id}`;
    const isActive = activeId === id;
    const hasCoords = p.lat && p.lng;

    if (editingPoi?.id === p.id) {
      return <SlideIn key={`edit-poi-${p.id}`}><PoiForm mode="edit" poi={p} fields={fields} saving={saving} onSave={(data) => handleUpdatePoi(p.id, data)} onCancel={() => setEditingPoi(null)} onSelectOnMap={startMapSelect} /></SlideIn>;
    }

    if (deletingPoi === p.id) {
      return (
        <div key={p.id} ref={el => { if (el) itemRefsMap.current[id] = el; }} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.b2}`, background: C.errPale }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12.1, fontWeight: 600, color: C.err, flex: 1 }}>{isShared ? `¿Quitar "${p.name}"?` : `¿Eliminar "${p.name}"?`}</span>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setDeletingPoi(null)} style={{ padding: "5px 10px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>No</button>
              <button onClick={() => handleDeletePoi(p.id)} style={{ padding: "5px 10px", borderRadius: R.md, border: "none", background: C.err, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>{isShared ? "Quitar" : "Sí"}</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={p.id} ref={el => { if (el) itemRefsMap.current[id] = el; }}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 16px", borderBottom: `1px solid ${C.b2}`, borderLeft: isActive ? `3px solid ${C.pri}` : "3px solid transparent", background: isActive ? C.priPale : "transparent", cursor: "default", transition: "background 0.15s" }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.bgCard; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ width: 28, height: 28, borderRadius: R.sm, background: `${LOC_COLORS.poi}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.poi(LOC_COLORS.poi, 14)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", whiteSpace: "normal" }}>{p.name}</div>
          {p.comments && <div style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{p.comments}</div>}
          {isShared && <span style={{ fontSize: 10, color: C.info, fontWeight: 600, marginTop: 4, display: "inline-block" }}>Compartida</span>}
        </div>
        <div style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>
          <RowMenu id={p.id} items={[
            ...(hasCoords ? [{ icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => focusOnMap(id, Number(p.lat), Number(p.lng)) }] : []),
            ...(!isShared ? [{ icon: Ic.share(C.t3, 14), label: "Compartir", onClick: () => setSharingEntity({ type: "poi", entity: p }) }] : []),
            ...(canWrite && !isShared ? [{ icon: Ic.pin(C.t3, 14), label: "Reclasificar", onClick: () => setReclassifyPoi(p) }] : []),
            ...(canWrite && !isShared ? [{ icon: Ic.edit(C.t3, 14), label: "Editar", onClick: () => setEditingPoi(p) }] : []),
            ...(canWrite ? [{ icon: Ic.cross(C.err, 14), label: isShared ? "Quitar" : "Eliminar", onClick: () => setDeletingPoi(p.id), danger: true }] : []),
          ]} />
        </div>
      </div>
    );
  };

  const renderFieldItem = (f) => {
    const id = `field-${f.id}`;
    const isActive = activeId === id;
    const hasCoords = f.lat && f.lng;
    const isExpanded = expandedField === f.id;
    const isShared = f._isSharedWithMe;
    const lots = f.lots || [];
    const filteredLots = lots.filter(l => matchesSearch(l.name) || matchesSearch(f.name));

    if (deletingField === f.id) {
      return (
        <div key={f.id}>
          <div ref={el => { if (el) itemRefsMap.current[id] = el; }} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.b2}`, background: C.errPale }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12.1, fontWeight: 600, color: C.err, flex: 1 }}>{isShared ? `¿Quitar "${f.name}"?` : `¿Eliminar "${f.name}" y sus ${lots.length} lote${lots.length !== 1 ? "s" : ""}?`}</span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setDeletingField(null)} style={{ padding: "5px 10px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>No</button>
                <button onClick={() => handleDeleteField(f.id)} style={{ padding: "5px 10px", borderRadius: R.md, border: "none", background: C.err, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>{isShared ? "Quitar" : "Sí"}</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={f.id}>
        <div ref={el => { if (el) itemRefsMap.current[id] = el; }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 16px", borderBottom: `1px solid ${C.b2}`, borderLeft: isActive ? `3px solid ${C.pri}` : "3px solid transparent", background: isActive ? C.priPale : "transparent", cursor: "pointer", transition: "background 0.15s" }}
          onClick={() => setExpandedField(isExpanded ? null : f.id)}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.bgCard; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{ width: 28, height: 28, borderRadius: R.sm, background: `${C.pri}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.field(C.pri, 14)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", whiteSpace: "normal" }}>{f.name}</div>
            {f.address && <div style={{ fontSize: 11, color: C.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>{f.address}</div>}
            {isShared && <span style={{ fontSize: 10, color: C.info, fontWeight: 600, marginTop: 4, display: "inline-block" }}>Compartido</span>}
            {isManager && f.ownerCompany?.name && !ownerFilter && <span style={{ fontSize: 10, color: "#F59E0B", fontWeight: 600, marginTop: 2, display: "inline-block" }}>{f.ownerCompany.name}</span>}
          </div>
          <Bd color={C.pri} small>{lots.length} lote{lots.length !== 1 ? "s" : ""}</Bd>
          <span style={{ display: "inline-flex", transition: "transform 200ms", transform: isExpanded ? "rotate(0)" : "rotate(-90deg)" }}>{Ic.down(C.t3, 14)}</span>
          <div style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>
            <RowMenu id={f.id} items={[
              ...(canWrite ? [{ icon: Ic.truck(C.acc, 14), label: "Solicitar flete", onClick: () => navigate(`/new?originFieldId=${f.id}`) }] : []),
              { icon: Ic.doc(C.t3, 14), label: "Ver fletes", onClick: () => navigate(`/list?search=${encodeURIComponent(f.name)}&fromLocations=1`) },
              ...(hasCoords ? [{ icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => focusOnMap(id, Number(f.lat), Number(f.lng)) }] : []),
              ...(!isShared ? [{ icon: Ic.share(C.t3, 14), label: "Compartir", onClick: () => setSharingEntity({ type: "field", entity: f }) }] : []),
              ...(canWrite && !isShared ? [{ icon: Ic.edit(C.t3, 14), label: "Editar ubicación", onClick: () => setEditField(editField === f.id ? null : f.id) }] : []),
              ...(canWrite ? [{ icon: Ic.cross(C.err, 14), label: isShared ? "Quitar" : "Eliminar", onClick: () => setDeletingField(f.id), danger: true }] : []),
            ]} />
          </div>
        </div>

        {editField === f.id && <SlideIn><FieldForm mode="edit" field={f} saving={saving} onSave={(data) => handleUpdateField(f.id, data)} onCancel={() => setEditField(null)} onSelectOnMap={startMapSelect} /></SlideIn>}

        {isExpanded && filteredLots.map(l => {
          const lotId = `lot-${l.id}`;
          const lotActive = activeId === lotId;
          const lotHasCoords = l.lat && l.lng;

          if (deletingLot?.lotId === l.id) {
            return (
              <div key={l.id}>
                <div ref={el => { if (el) itemRefsMap.current[lotId] = el; }} style={{ padding: "10px 16px 10px 40px", borderBottom: `1px solid ${C.b2}`, background: C.errPale }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12.1, fontWeight: 600, color: C.err, flex: 1 }}>¿Eliminar "{l.name}"?</span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setDeletingLot(null)} style={{ padding: "5px 10px", borderRadius: R.md, border: `1px solid ${C.b2}`, background: C.w, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.t2 }}>No</button>
                      <button onClick={() => handleDeleteLot(f.id, l.id)} style={{ padding: "5px 10px", borderRadius: R.md, border: "none", background: C.err, cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700, color: C.w }}>Sí</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (editLot?.lotId === l.id) {
            return <SlideIn key={`edit-lot-${l.id}`}><LotForm mode="edit" lot={l} fieldName={f.name} defaultCenter={f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : null} saving={saving} onSave={(data) => handleUpdateLot(f.id, l.id, data)} onCancel={() => setEditLot(null)} onSelectOnMap={startMapSelect} /></SlideIn>;
          }

          return (
            <div key={l.id}>
              <div ref={el => { if (el) itemRefsMap.current[lotId] = el; }}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px 14px 40px", borderBottom: `1px solid ${C.b2}`, borderLeft: lotActive ? `3px solid ${C.pri}` : "3px solid transparent", background: lotActive ? C.priPale : "transparent", cursor: "default", transition: "background 0.15s" }}
                onMouseEnter={e => { if (!lotActive) e.currentTarget.style.background = C.bgCard; }}
                onMouseLeave={e => { if (!lotActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 24, height: 24, borderRadius: R.sm, background: `${LOC_COLORS.lot}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.lot(LOC_COLORS.lot, 12)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.t1 }}>{l.name}</span>
                  {l.hectares && <span style={{ fontSize: 11, color: C.t3, marginLeft: 6 }}>{l.hectares} ha</span>}
                </div>
                <div style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>
                  <RowMenu id={l.id} items={[
                    ...(canWrite ? [{ icon: Ic.truck(C.acc, 14), label: "Solicitar flete", onClick: () => navigate(`/new?originFieldId=${f.id}&originLotId=${l.id}`) }] : []),
                    { icon: Ic.doc(C.t3, 14), label: "Ver fletes", onClick: () => navigate(`/list?search=${encodeURIComponent(l.name)}&fromLocations=1`) },
                    ...(lotHasCoords ? [{ icon: Ic.nav(C.t3, 14), label: "Ver en mapa", onClick: () => focusOnMap(lotId, Number(l.lat), Number(l.lng)) }] : []),
                    ...(!isShared ? [{ icon: Ic.share(C.t3, 14), label: "Compartir", onClick: () => setSharingEntity({ type: "lot", entity: l, fieldId: f.id }) }] : []),
                    ...(canWrite && !isShared ? [{ icon: Ic.edit(C.t3, 14), label: "Editar", onClick: () => setEditLot(editLot?.lotId === l.id ? null : { fieldId: f.id, lotId: l.id }) }] : []),
                    ...(canWrite ? [{ icon: Ic.cross(C.err, 14), label: "Eliminar", onClick: () => setDeletingLot({ fieldId: f.id, lotId: l.id }), danger: true }] : []),
                  ]} />
                </div>
              </div>
            </div>
          );
        })}

        {isExpanded && (
          creatingLotForField === f.id
            ? <SlideIn><LotForm mode="create" fieldId={f.id} fieldName={f.name} defaultCenter={f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : null} saving={saving} onSave={(data) => handleCreateLot(f.id, data)} onCancel={() => setCreatingLotForField(null)} onSelectOnMap={startMapSelect} /></SlideIn>
            : canWrite && <button onClick={() => setCreatingLotForField(f.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px 10px 40px", width: "100%", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: FONT, fontSize: 12.7, fontWeight: 600, color: C.acc }}>{Ic.plus(C.acc, 13)} Agregar lote</button>
        )}
      </div>
    );
  };

  const renderFieldsList = () => {
    const companyMap = new Map();
    for (const f of filteredFields) {
      const cId = f.company?.id || f.companyId || "_";
      if (!companyMap.has(cId)) companyMap.set(cId, { name: f.company?.name || "Mi empresa", fields: [] });
      companyMap.get(cId).fields.push(f);
    }
    const companies = Array.from(companyMap.entries());
    const multiCompany = companies.length > 1;
    const toggleCompany = (cId) => setCollapsedCompanies(prev => ({ ...prev, [cId]: !prev[cId] }));
    return companies.map(([cId, group]) => (
      <div key={cId}>
        {multiCompany && (
          <div onClick={() => toggleCompany(cId)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: `${C.pri}06`, borderBottom: `1px solid ${C.b2}`, cursor: "pointer", userSelect: "none" }}>
            <span style={{ display: "inline-flex", transition: "transform 200ms", transform: collapsedCompanies[cId] ? "rotate(-90deg)" : "rotate(0)" }}>{Ic.down(C.t3, 14)}</span>
            {Ic.user(C.sec, 14)}
            <span style={{ flex: 1, fontSize: 12.7, fontWeight: 700, color: C.t1 }}>{group.name}</span>
            <span style={{ fontSize: 10.5, color: C.t3 }}>{group.fields.length} campo{group.fields.length !== 1 ? "s" : ""}</span>
          </div>
        )}
        {(!multiCompany || !collapsedCompanies[cId]) && group.fields.map(f => renderFieldItem(f))}
      </div>
    ));
  };

  const renderSectionHeader = (title, count, key, color, iconFn) => (
    <div onClick={() => toggleSection(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: C.bg, cursor: "pointer", userSelect: "none", borderBottom: `1px solid ${C.b2}` }}>
      <span style={{ display: "inline-flex", transition: "transform 200ms", transform: sectionOpen[key] ? "rotate(0)" : "rotate(-90deg)" }}>{Ic.down(C.t3, 14)}</span>
      {iconFn(color, 16)}
      <span style={{ flex: 1, fontSize: 13.2, fontWeight: 700, color: C.t1 }}>{title}</span>
      <span style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>{count}</span>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg, fontFamily: FONT }}>
      <style>{`@keyframes truckDrive{0%{transform:translateX(-10px)}60%{transform:translateX(6px)}100%{transform:translateX(-10px)}}`}</style>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}
      {previewLoc && <MapPreviewModal loc={previewLoc} onClose={() => setPreviewLoc(null)} />}

      {sharingEntity && (
        <ShareLocationModal
          entityType={sharingEntity.type}
          entity={sharingEntity.entity}
          fieldId={sharingEntity.fieldId}
          onClose={() => setSharingEntity(null)}
          onShared={async () => { setMsg({ t: `${sharingEntity.type === "poi" ? "Ubicación" : sharingEntity.type === "field" ? "Campo" : "Lote"} compartido`, k: "ok" }); await load(); }}
        />
      )}

      {reclassifyPoi && (
        <ReclassifyModal
          poi={reclassifyPoi}
          fields={fields}
          onClose={() => setReclassifyPoi(null)}
          onReclassified={async (ok, err) => { setReclassifyPoi(null); setMsg({ t: ok || err, k: ok ? "ok" : "err" }); await load(); }}
        />
      )}

      {/* Mobile backdrop */}
      {!isDesktop && drawerOpen && (
        <div onClick={() => { if (!isFormActive) setDrawerOpen(false); }} style={{ position: "fixed", inset: 0, background: C.bgOverlay, zIndex: 100, transition: "opacity 250ms" }} />
      )}

      {/* ── PANEL ── */}
      <div ref={panelRef} style={{
        ...(isDesktop ? { width: "30%", minWidth: 320, maxWidth: 420, borderRight: `1px solid ${C.b1}`, position: "relative" } : {
          position: "fixed", left: 0, top: 0, bottom: 0, width: "100%",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 250ms ease-out", zIndex: 101, boxShadow: drawerOpen ? C.shLg : "none",
        }),
        background: C.w, display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.b2}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (importStep === 0 && !creationMode) ? 10 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>{Ic.chev(C.pri, 18)}</button>
              <span style={{ fontSize: 18, fontWeight: 600, color: C.t1 }}>Ubicaciones</span>
            </div>
            {creationMode ? null : importStep ? (
              <button onClick={() => { setImportStep(0); closeImport(); }} style={{ width: 32, height: 32, borderRadius: R.md, background: "transparent", border: `1px solid ${C.b1}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {Ic.cross(C.t3, 16)}
              </button>
            ) : (
              <div style={{ position: "relative" }}>
                {canWrite && <button onClick={() => { setAddMenuOpen(!addMenuOpen); setAddMenuSub(null); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: R.md, background: C.pri, border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 12.7, fontWeight: 700, color: C.w }}>
                  {Ic.plus(C.w, 14)} Agregar
                </button>}
                {addMenuOpen && <>
                  <div onClick={() => { setAddMenuOpen(false); setAddMenuSub(null); }} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 220, background: C.bgCard, border: `1px solid ${C.b1}`, borderRadius: R.md, boxShadow: C.shMd, zIndex: 20, overflow: "hidden" }}>
                    {!addMenuSub && <>
                      <button onClick={() => setAddMenuSub("manual")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: FONT, fontSize: 13.2, fontWeight: 600, color: C.t1, textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.priPale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {Ic.pin(C.pri, 16)} Crear manualmente
                      </button>
                      <button onClick={() => { setAddMenuOpen(false); setImportStep(1); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 13.2, fontWeight: 600, color: C.t1, textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.priPale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {Ic.pin(C.acc, 16)} Importar desde Google Maps
                      </button>
                    </>}
                    {addMenuSub === "manual" && <>
                      <button onClick={() => { setAddMenuOpen(false); setAddMenuSub(null); setCreationMode("field"); setCreatingField(true); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: FONT, fontSize: 13.2, fontWeight: 600, color: C.t1, textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.priPale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {Ic.field(LOC_COLORS.field, 16)} Campo
                      </button>
                      {fields.length > 0 && (
                        <button onClick={() => { setAddMenuOpen(false); setAddMenuSub(null); setCreationMode("lot"); setCreatingLotForField("__general__"); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "none", border: "none", borderBottom: `1px solid ${C.b2}`, cursor: "pointer", fontFamily: FONT, fontSize: 13.2, fontWeight: 600, color: C.t1, textAlign: "left" }}
                          onMouseEnter={e => e.currentTarget.style.background = C.priPale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          {Ic.lot(C.acc, 16)} Lote
                        </button>
                      )}
                      <button onClick={() => { setAddMenuOpen(false); setAddMenuSub(null); setCreationMode("poi"); setCreatingPoi(true); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 13.2, fontWeight: 600, color: C.t1, textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.priPale} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {Ic.poi(LOC_COLORS.poi, 16)} Ubicación de interés
                      </button>
                    </>}
                  </div>
                </>}
              </div>
            )}
          </div>
          {importStep === 0 && !creationMode && (<>
            {isManager && ownersSummary.length > 0 && (
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.b1}`, fontSize: 12.7, fontFamily: "inherit", background: C.w, color: C.t1, marginBottom: 8 }}>
                <option value="">Todas las empresas</option>
                <option value="mine">Mis ubicaciones</option>
                {ownersSummary.map(o => <option key={o.companyId} value={o.companyId}>{o.companyName} ({o.fieldCount} campos)</option>)}
              </select>
            )}
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{Ic.srch(C.t3, 14)}</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ubicación..."
                style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: R.md, border: `1.5px solid ${search ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }} />
            </div>
          </>)}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {msg && <div onClick={() => setMsg(null)} style={{ padding: "8px 16px", fontSize: 12.1, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err, cursor: "pointer", borderBottom: `1px solid ${C.b2}` }}>{msg.t}</div>}

          {/* ── CREATION MODE: full-panel form ── */}
          {creationMode && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C.b1}` }}>
                <button onClick={() => { setCreationMode(null); setCreatingField(false); setCreatingPoi(false); setCreatingLotForField(null); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.pri }}>
                  {Ic.chev(C.pri, 16)} Volver
                </button>
              </div>
              <div style={{ padding: 16, fontSize: 16, fontWeight: 600, fontFamily: FONT, color: C.t1, borderBottom: `1px solid ${C.b2}` }}>
                {creationMode === "field" && "Crear campo"}
                {creationMode === "lot" && "Crear lote"}
                {creationMode === "poi" && "Crear ubicación de interés"}
              </div>
              <div style={{ padding: 0, flex: 1 }}>
                {creationMode === "field" && <FieldForm mode="create" saving={saving} onSave={handleCreateField} onCancel={() => { setCreationMode(null); setCreatingField(false); }} onSelectOnMap={startMapSelect} isManager={isManager} linkedCompanies={linkedCompanies} defaultOwnerCompanyId={ownerFilter && ownerFilter !== "mine" ? ownerFilter : ""} />}
                {creationMode === "lot" && <LotForm mode="create" fields={fields} saving={saving} onSave={(data) => handleCreateLot(data._fieldId, data)} onCancel={() => { setCreationMode(null); setCreatingLotForField(null); }} onSelectOnMap={startMapSelect} />}
                {creationMode === "poi" && <PoiForm mode="create" fields={fields} saving={saving} onSave={handleCreatePoi} onCancel={() => { setCreationMode(null); setCreatingPoi(false); }} onSelectOnMap={startMapSelect} isManager={isManager} linkedCompanies={linkedCompanies} defaultOwnerCompanyId={ownerFilter && ownerFilter !== "mine" ? ownerFilter : ""} />}
              </div>
            </div>
          )}

          {/* ── NORMAL VIEW (import + list) ── */}
          {!creationMode && <>
          {importStep === 1 && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 14.3, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>{Ic.pin(C.pri, 16)} Importar desde Google Maps</div>
              <div style={{ fontSize: 12.1, color: C.t2, lineHeight: 1.5, marginBottom: 12 }}>Abrí Google Maps → <strong>Tus sitios</strong> → Seleccioná una lista → <strong>Compartir</strong> → Copiar enlace</div>
              <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: R.md, border: `1.5px solid ${importUrl ? C.bFocus : C.b2}`, background: C.bgInput, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box" }} />
              {importSlowMsg && <div style={{ marginTop: 8, fontSize: 11, color: C.t3, fontStyle: "italic" }}>Esto puede tardar un momento…</div>}
              <div style={{ marginTop: 10 }}><Btn full v="acc" disabled={saving || !importUrl.trim()} onClick={handleImportList}>{saving ? "Buscando ubicaciones…" : "Buscar ubicaciones"}</Btn></div>
            </div>
          )}

          {importStep === 2 && (
            <div style={{ padding: 12 }}>
              <ImportClassifyPanel
                importParsed={importParsed} importSelected={importSelected} importNames={importNames}
                importTypes={importTypes} importFieldIds={importFieldIds} importComments={importComments}
                importDiscarded={importDiscarded} importWarning={importWarning} importListName={importListName}
                fieldOptions={fieldOptions} saving={saving} selectedCount={selectedCount}
                getType={getType} getName={getName}
                onToggle={toggleItem}
                onNameChange={(i, v) => setImportNames(prev => ({ ...prev, [i]: v }))}
                onTypeChange={(i, k) => {
                  if (k === "field") { setImportTypes(prev => { const n = { ...prev }; delete n[i]; return n; }); setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; }); }
                  else { setImportTypes(prev => ({ ...prev, [i]: k })); if (k !== "lot") setImportFieldIds(prev => { const n = { ...prev }; delete n[i]; return n; }); }
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

          {importStep === 0 && loading && <div style={{ padding: 32, textAlign: "center" }}><Loader /></div>}

          {importStep === 0 && !loading && (
            <>
              {renderSectionHeader("Ubicaciones de interés", filteredPois.length, "pois", MAP_COLORS.poi, (c, s) => Ic.poi(c, s))}
              {sectionOpen.pois && (
                <>
                  {filteredPois.length === 0
                    ? <div style={{ padding: "16px", textAlign: "center", fontSize: 12.7, color: C.t3 }}>{search ? "Sin resultados" : "Sin ubicaciones de interés"}</div>
                    : (() => {
                        const poiCoMap = new Map();
                        for (const p of filteredPois) { const cId = p.company?.id || p.companyId || "_"; if (!poiCoMap.has(cId)) poiCoMap.set(cId, { name: p.company?.name || "Mi empresa", items: [] }); poiCoMap.get(cId).items.push(p); }
                        const poiCos = Array.from(poiCoMap.entries());
                        const multi = poiCos.length > 1;
                        return poiCos.map(([cId, g]) => (
                          <div key={cId}>
                            {multi && (
                              <div onClick={() => setCollapsedCompanies(prev => ({ ...prev, [`poi_${cId}`]: !prev[`poi_${cId}`] }))} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: `${C.sec}06`, borderBottom: `1px solid ${C.b2}`, cursor: "pointer", userSelect: "none" }}>
                                <span style={{ display: "inline-flex", transition: "transform 200ms", transform: collapsedCompanies[`poi_${cId}`] ? "rotate(-90deg)" : "rotate(0)" }}>{Ic.down(C.t3, 14)}</span>
                                {Ic.user(C.sec, 14)}
                                <span style={{ flex: 1, fontSize: 12.7, fontWeight: 700, color: C.t1 }}>{g.name}</span>
                                <span style={{ fontSize: 10.5, color: C.t3 }}>{g.items.length}</span>
                              </div>
                            )}
                            {(!multi || !collapsedCompanies[`poi_${cId}`]) && g.items.map(p => renderPoiItem(p, p._isSharedWithMe))}
                          </div>
                        ));
                      })()}
                </>
              )}

              {renderSectionHeader("Campos", filteredFields.length, "fields", MAP_COLORS.field, (c, s) => Ic.field(c, s))}
              {sectionOpen.fields && (
                <>
                  {creatingField && !creationMode && <SlideIn><FieldForm mode="create" saving={saving} onSave={handleCreateField} onCancel={() => setCreatingField(false)} onSelectOnMap={startMapSelect} isManager={isManager} linkedCompanies={linkedCompanies} defaultOwnerCompanyId={ownerFilter && ownerFilter !== "mine" ? ownerFilter : ""} /></SlideIn>}
                  {filteredFields.length === 0 && !creatingField
                    ? <div style={{ padding: "16px", textAlign: "center", fontSize: 12.7, color: C.t3 }}>{search ? "Sin resultados" : "Sin campos registrados"}</div>
                    : renderFieldsList()}
                </>
              )}
            </>
          )}
          </>}
        </div>
      </div>

      {/* ── MAP ── */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

        {mapSelectMode && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10, background: "rgba(0,0,0,0.5)", pointerEvents: "none" }}>
            <div style={{ color: "#fff", fontFamily: FONT, fontSize: 15, fontWeight: 500, textAlign: "center", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              {Ic.pin("#fff", 16)} Tocá el mapa para seleccionar la ubicación
            </div>
            <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
              <button onClick={cancelMapSelect} style={{ padding: "6px 16px", borderRadius: R.md, border: "1px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)", cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 600, color: "#fff" }}>Cancelar</button>
              <button onClick={confirmMapSelect} disabled={!mapSelectMode.currentPos} style={{ padding: "6px 16px", borderRadius: R.md, border: "none", background: C.pri, cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 700, color: "#fff", opacity: mapSelectMode.currentPos ? 1 : 0.5 }}>Confirmar</button>
            </div>
          </div>
        )}

        {!mapSelectMode && <>
          {/* Right column: collapsible options menu */}
          <div style={{ position: "absolute", top: isDesktop ? 12 : 60, right: 8, zIndex: 5, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <button onClick={() => setMapOptionsOpen(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: R.pill, background: C.bgCard, color: C.t2, border: `1px solid ${C.b1}`, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, boxShadow: C.sh }}>
              {Ic.eye(C.t2, 14)} {mapOptionsOpen ? "Cerrar" : "Opciones"}
            </button>
            {mapOptionsOpen && <>
              <button onClick={toggleMapType} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: R.pill, background: mapType === "hybrid" ? C.t1 : C.bgCard, color: mapType === "hybrid" ? "#fff" : C.t2, border: `1px solid ${mapType === "hybrid" ? "transparent" : C.b1}`, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, boxShadow: C.sh, transition: "all 0.2s" }}>
                {mapType === "hybrid" ? "Mapa" : "Satélite"}
              </button>
              {FILTER_CHIPS.map(fc => {
                const active = mapFilters[fc.key];
                const typeColor = FILTER_COLORS[fc.key];
                return (
                  <button key={fc.key} onClick={() => toggleMapFilter(fc.key)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: R.pill, background: active ? typeColor : C.bgCard, color: active ? C.tOn : C.t2, border: `1px solid ${active ? "transparent" : C.b1}`, cursor: "pointer", fontFamily: FONT, fontSize: 12.1, fontWeight: 700, boxShadow: C.sh, transition: "all 0.2s" }}>
                    {fc.icon(active ? C.tOn : typeColor, 14)} {active ? "Ocultar" : "Ver"} {fc.label}
                  </button>
                );
              })}
            </>}
          </div>
        </>}

        {!isDesktop && !drawerOpen && (<>
          {/* Floating search bar with back button */}
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 5, display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={onBack} style={{ width: 42, height: 42, borderRadius: R.lg, background: C.w, border: `1px solid ${C.b1}`, boxShadow: C.shMd, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {Ic.chev(C.pri, 18)}
            </button>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{Ic.srch(C.t3, 14)}</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                style={{ width: "100%", padding: "10px 12px 10px 32px", borderRadius: R.lg, border: `1px solid ${C.b1}`, background: C.w, fontFamily: "inherit", fontSize: 13.2, color: C.t1, outline: "none", boxSizing: "border-box", boxShadow: C.shMd }} />
            </div>
          </div>
          {/* Floating buttons — bottom left */}
          <div style={{ position: "absolute", bottom: 80, left: 12, zIndex: 5, display: "flex", flexDirection: "column", gap: 8 }}>
            {canWrite && <button onClick={() => { setDrawerOpen(true); setAddMenuOpen(true); }} style={{ width: 42, height: 42, borderRadius: R.lg, background: C.pri, border: "none", boxShadow: C.shMd, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {Ic.plus(C.w, 20)}
            </button>}
            <button onClick={() => setDrawerOpen(true)} style={{ width: 42, height: 42, borderRadius: R.lg, background: C.w, border: `1px solid ${C.b1}`, boxShadow: C.shMd, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {Ic.menu3(C.pri, 18)}
            </button>
          </div>
        </>)}

        {!loading && allLocations.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
            <div style={{ background: C.w, padding: "20px 28px", borderRadius: R.lg, boxShadow: C.shMd, textAlign: "center", pointerEvents: "auto" }}>
              <div style={{ marginBottom: 8 }}>{Ic.poi(C.t3, 28)}</div>
              <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Sin ubicaciones</div>
              <div style={{ fontSize: 12.7, color: C.t3, marginBottom: 12 }}>Creá campos, lotes o importá desde Google Maps</div>
              {canWrite && <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <Btn sm onClick={() => { if (!isDesktop) setDrawerOpen(true); setCreatingField(true); if (!sectionOpen.fields) setSectionOpen(p => ({ ...p, fields: true })); }}>Crear campo</Btn>
                <Btn sm v="ghost" onClick={() => { if (!isDesktop) setDrawerOpen(true); setImportStep(1); }}>Importar</Btn>
              </div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export RowMenu for backward compatibility
export { default as RowMenu } from "../components/locations/RowMenu";
