import { useEffect, useMemo, useState } from "react";
import { C, Ic, R } from "../theme";
import { Btn, Field, Loader, ModalOverlay, Select, Tabs } from "../components";
import {
  apiCreateStockItem,
  apiCreateStockLocation,
  apiCreateStockMovement,
  apiGetStockItems,
  apiGetStockLocations,
  apiGetStockMovements,
  apiGetStockSummary,
  apiRevertStockMovement,
} from "../api";

const ITEM_CATEGORY_OPTIONS = [
  { value: "grain", label: "Grano" },
  { value: "fertilizer", label: "Fertilizante" },
  { value: "seed", label: "Semilla" },
  { value: "agrochemical", label: "Agroquímico" },
  { value: "fuel", label: "Combustible" },
  { value: "other", label: "Otro" },
];

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "tn", label: "Toneladas (tn)" },
  { value: "lt", label: "Litros (lt)" },
  { value: "unit", label: "Unidades" },
  { value: "bag", label: "Bolsas" },
];

const LOCATION_TYPE_OPTIONS = [
  { value: "warehouse", label: "Depósito" },
  { value: "silo", label: "Silo" },
  { value: "silo_bag", label: "Silobolsa" },
  { value: "shed", label: "Galpón" },
  { value: "tank", label: "Tanque" },
  { value: "field", label: "Campo" },
  { value: "lot", label: "Lote" },
  { value: "plant", label: "Planta" },
  { value: "other", label: "Otro" },
];

const OWNERSHIP_OPTIONS = [
  { value: "own", label: "Propio" },
  { value: "third_party", label: "Terceros" },
];

const MOVEMENT_OPTIONS = [
  { value: "manual_in", label: "Ingreso manual", kind: "in" },
  { value: "purchase_in", label: "Compra / ingreso", kind: "in" },
  { value: "adjustment_in", label: "Ajuste positivo", kind: "in" },
  { value: "manual_out", label: "Salida manual", kind: "out" },
  { value: "sale_out", label: "Venta / egreso", kind: "out" },
  { value: "reexpedition_out", label: "Reexpedición", kind: "out" },
  { value: "consumption_out", label: "Consumo interno", kind: "out" },
  { value: "adjustment_out", label: "Ajuste negativo", kind: "out" },
  { value: "transfer", label: "Transferencia", kind: "transfer" },
];

const MOVEMENT_MODE_OPTIONS = [
  { value: "in", label: "Ingreso", description: "Suma stock en un sitio de destino.", icon: "plus", color: C.ok },
  { value: "out", label: "Egreso", description: "Descuenta stock desde un sitio de origen.", icon: "out", color: C.err },
  { value: "transfer", label: "Transferencia", description: "Mueve stock entre dos sitios.", icon: "share", color: C.info },
  { value: "adjustment", label: "Ajuste", description: "Corrige diferencias de inventario.", icon: "gear", color: C.acc },
];

const MODAL_TABS = [
  { k: "movement", l: "Movimiento" },
  { k: "item", l: "Ítem" },
  { k: "location", l: "Ubicación" },
];

const SCREEN_TABS = [
  { k: "movement", l: "Actualizar stock" },
  { k: "products", l: "Productos" },
  { k: "sites", l: "Sitios" },
  { k: "kardex", l: "Kardex" },
];

const DEFAULT_MOVEMENT_FORM = {
  movementType: "manual_in",
  itemId: "",
  quantity: "",
  unit: "",
  fromLocationId: "",
  toLocationId: "",
  notes: "",
};

const DEFAULT_ITEM_FORM = {
  category: "grain",
  name: "",
  code: "",
  baseUnit: "kg",
};

const DEFAULT_LOCATION_FORM = {
  locationType: "warehouse",
  ownershipType: "own",
  name: "",
  address: "",
  notes: "",
};

const DEFAULT_LOCATION_FILTERS = {
  search: "",
  locationType: "",
  ownershipType: "",
};

const DEFAULT_KARDEX_FILTERS = {
  itemId: "",
  locationId: "",
  movementType: "",
  dateFrom: "",
  dateTo: "",
  limit: "100",
};

function formatQty(value, unit) {
  const num = Number(value || 0);
  return `${num.toLocaleString("es-UY", { maximumFractionDigits: 3 })} ${unit || ""}`.trim();
}

function humanizeMovementType(type) {
  return MOVEMENT_OPTIONS.find((option) => option.value === type)?.label || type;
}

function unitLabel(unit) {
  return UNIT_OPTIONS.find((option) => option.value === unit)?.label || unit;
}

function getCompatibleUnits(baseUnit) {
  if (!baseUnit) return [];
  if (baseUnit === "kg" || baseUnit === "tn") {
    return UNIT_OPTIONS.filter((option) => option.value === "kg" || option.value === "tn");
  }
  return UNIT_OPTIONS.filter((option) => option.value === baseUnit);
}

function movementDirection(movementType) {
  return MOVEMENT_OPTIONS.find((option) => option.value === movementType)?.kind || "transfer";
}

function movementModeFromType(movementType) {
  if (movementType === "transfer") return "transfer";
  if (movementType === "adjustment_in" || movementType === "adjustment_out") return "adjustment";
  const kind = movementDirection(movementType);
  return kind === "out" ? "out" : "in";
}

function defaultMovementTypeForMode(mode) {
  if (mode === "transfer") return "transfer";
  if (mode === "adjustment") return "adjustment_in";
  if (mode === "out") return "manual_out";
  return "manual_in";
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-UY");
}

function movementSignedQuantity(movement, scopedLocationId = "") {
  const qty = Number(movement.baseQuantity ?? movement.quantity ?? 0);
  if (scopedLocationId) {
    if (movement.toLocation?.id === scopedLocationId && movement.fromLocation?.id === scopedLocationId) return 0;
    if (movement.toLocation?.id === scopedLocationId) return qty;
    if (movement.fromLocation?.id === scopedLocationId) return -qty;
    return 0;
  }

  const kind = movementDirection(movement.movementType);
  if (kind === "in") return qty;
  if (kind === "out") return -qty;
  return 0;
}

function normalizeStockMovement(movement, scopedLocationId = "") {
  const signedQty = movementSignedQuantity(movement, scopedLocationId);
  return {
    ...movement,
    quantity: Number(movement.quantity ?? 0),
    baseQuantity: Number(movement.baseQuantity ?? movement.quantity ?? 0),
    signedQty,
    inQty: signedQty > 0 ? signedQty : 0,
    outQty: signedQty < 0 ? Math.abs(signedQty) : 0,
  };
}

function OperationCard({ active, title, description, color, icon, onClick }) {
  const iconByKey = {
    plus: Ic.plus,
    out: Ic.out,
    share: Ic.share,
    gear: Ic.gear,
  };
  const Icon = iconByKey[icon] || Ic.gear;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 180,
        textAlign: "left",
        padding: 14,
        borderRadius: R.lg,
        border: `1px solid ${active ? `${color}44` : C.b1}`,
        background: active ? `${color}10` : C.w,
        boxShadow: active ? `0 0 0 1px ${color}18 inset` : "none",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: R.md, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {Icon(color, 18)}
        </div>
        <span style={{ fontSize: 13.2, fontWeight: 800, color: active ? color : C.t1 }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.1, color: C.t3, lineHeight: 1.45 }}>{description}</div>
    </button>
  );
}

function SummaryCard({ title, value, sub, icon, color }) {
  return (
    <div style={{ flex: 1, minWidth: 170, background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: R.md, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <span style={{ fontSize: 12.1, fontWeight: 700, color: C.t3 }}>{title}</span>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: C.t1, letterSpacing: -0.4 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.lg, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15.4, fontWeight: 700, color: C.t1 }}>{title}</div>
        {action || null}
      </div>
      {children}
    </div>
  );
}

export default function StockScreen({ user, onBack }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [actionOpen, setActionOpen] = useState(false);
  const [actionTab, setActionTab] = useState("movement");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revertingId, setRevertingId] = useState("");
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [movementForm, setMovementForm] = useState(DEFAULT_MOVEMENT_FORM);
  const [itemForm, setItemForm] = useState(DEFAULT_ITEM_FORM);
  const [locationForm, setLocationForm] = useState(DEFAULT_LOCATION_FORM);
  const [screenTab, setScreenTab] = useState("movement");
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState("");
  const [stockLocations, setStockLocations] = useState([]);
  const [locationFilters, setLocationFilters] = useState(DEFAULT_LOCATION_FILTERS);
  const [kardexLoading, setKardexLoading] = useState(false);
  const [kardexError, setKardexError] = useState("");
  const [kardexFilters, setKardexFilters] = useState(DEFAULT_KARDEX_FILTERS);
  const [kardexRows, setKardexRows] = useState([]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGetStockSummary();
      setSummary(data);
    } catch (e) {
      setError(e.message || "No se pudo cargar el resumen de stock");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const [nextItems, nextLocations] = await Promise.all([
        apiGetStockItems(),
        apiGetStockLocations(),
      ]);
      setItems(Array.isArray(nextItems) ? nextItems : []);
      setLocations(Array.isArray(nextLocations) ? nextLocations : []);
    } catch (e) {
      setFeedback({ kind: "err", text: e.message || "No se pudieron cargar los catálogos de stock" });
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadLocationsData = async () => {
    setLocationsLoading(true);
    setLocationsError("");
    try {
      const nextLocations = await apiGetStockLocations();
      setStockLocations(Array.isArray(nextLocations) ? nextLocations : []);
    } catch (e) {
      setLocationsError(e.message || "No se pudieron cargar las ubicaciones de stock");
    } finally {
      setLocationsLoading(false);
    }
  };

  const loadKardex = async (nextFilters = kardexFilters) => {
    setKardexLoading(true);
    setKardexError("");
    try {
      const rows = await apiGetStockMovements({
        itemId: nextFilters.itemId || undefined,
        locationId: nextFilters.locationId || undefined,
        movementType: nextFilters.movementType || undefined,
        dateFrom: nextFilters.dateFrom || undefined,
        dateTo: nextFilters.dateTo || undefined,
        limit: Number(nextFilters.limit || 100),
      });
      setKardexRows(Array.isArray(rows) ? rows.map((row) => normalizeStockMovement(row, nextFilters.locationId)) : []);
    } catch (e) {
      setKardexError(e.message || "No se pudo cargar el kardex de stock");
    } finally {
      setKardexLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.activeCompanyId]);

  useEffect(() => {
    loadCatalog();
  }, [user?.activeCompanyId]);

  useEffect(() => {
    if (actionOpen) {
      loadCatalog();
    }
  }, [actionOpen, user?.activeCompanyId]);

  useEffect(() => {
    if (screenTab === "sites") {
      loadLocationsData();
    }
    if (screenTab === "kardex") {
      loadKardex();
    }
  }, [screenTab, user?.activeCompanyId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === movementForm.itemId) || null,
    [items, movementForm.itemId],
  );

  const unitChoices = useMemo(
    () => getCompatibleUnits(selectedItem?.baseUnit),
    [selectedItem?.baseUnit],
  );

  useEffect(() => {
    if (!selectedItem) return;
    if (!unitChoices.some((option) => option.value === movementForm.unit)) {
      setMovementForm((prev) => ({ ...prev, unit: selectedItem.baseUnit }));
    }
  }, [selectedItem, unitChoices, movementForm.unit]);

  const totals = useMemo(() => {
    const categories = summary?.categories || [];
    return categories.reduce((acc, item) => {
      acc.own += Number(item.ownQuantity || 0);
      acc.thirdParty += Number(item.thirdPartyQuantity || 0);
      acc.total += Number(item.totalQuantity || 0);
      return acc;
    }, { own: 0, thirdParty: 0, total: 0 });
  }, [summary]);

  const itemOptions = useMemo(
    () => items.map((item) => ({
      value: item.id,
      label: item.name,
      sub: `${ITEM_CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label || item.category} · ${unitLabel(item.baseUnit)}`,
    })),
    [items],
  );

  const locationOptions = useMemo(
    () => locations.map((location) => ({
      value: location.id,
      label: location.name,
      sub: `${LOCATION_TYPE_OPTIONS.find((option) => option.value === location.locationType)?.label || location.locationType} · ${location.ownershipType === "own" ? "Propio" : "Terceros"}`,
    })),
    [locations],
  );

  const filteredStockLocations = useMemo(() => {
    const term = locationFilters.search.trim().toLowerCase();
    return stockLocations.filter((location) => {
      if (locationFilters.locationType && location.locationType !== locationFilters.locationType) return false;
      if (locationFilters.ownershipType && location.ownershipType !== locationFilters.ownershipType) return false;
      if (!term) return true;
      const haystack = [
        location.name,
        location.address,
        location.field?.name,
        location.lot?.name,
        location.plant?.name,
        location.plant?.company?.name,
        ...(location.balances || []).map((balance) => balance.item?.name),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [stockLocations, locationFilters]);

  const locationStats = useMemo(() => {
    return filteredStockLocations.reduce((acc, location) => {
      acc.locations += 1;
      if ((location.balances || []).length > 0) acc.withStock += 1;
      if (location.ownershipType === "own") acc.own += 1;
      else acc.thirdParty += 1;
      acc.positions += (location.balances || []).length;
      return acc;
    }, { locations: 0, withStock: 0, own: 0, thirdParty: 0, positions: 0 });
  }, [filteredStockLocations]);

  const selectedKardexItem = useMemo(
    () => summary?.items?.find((item) => item.itemId === kardexFilters.itemId) || null,
    [summary, kardexFilters.itemId],
  );

  const selectedKardexLocation = useMemo(
    () => stockLocations.find((location) => location.id === kardexFilters.locationId) || locations.find((location) => location.id === kardexFilters.locationId) || null,
    [stockLocations, locations, kardexFilters.locationId],
  );

  const currentKardexBalance = useMemo(() => {
    if (!selectedKardexItem) return null;
    if (kardexFilters.locationId) {
      const locationBalance = selectedKardexLocation?.balances?.find((balance) => balance.itemId === kardexFilters.itemId || balance.item?.id === kardexFilters.itemId);
      return Number(locationBalance?.currentQuantity || 0);
    }
    return Number(selectedKardexItem.totalQuantity || 0);
  }, [selectedKardexItem, selectedKardexLocation, kardexFilters.locationId, kardexFilters.itemId]);

  const kardexRowsWithBalance = useMemo(() => {
    if (!kardexFilters.itemId || currentKardexBalance === null) {
      return kardexRows.map((row) => ({
        ...row,
        runningBalance: null,
      }));
    }

    let cursor = currentKardexBalance;
    return kardexRows.map((row) => {
      const runningBalance = cursor;
      cursor -= row.signedQty;
      return {
        ...row,
        runningBalance,
      };
    });
  }, [kardexRows, kardexFilters.itemId, currentKardexBalance]);

  const movementMode = movementModeFromType(movementForm.movementType);
  const movementDef = MOVEMENT_OPTIONS.find((option) => option.value === movementForm.movementType);
  const movementModeDef = MOVEMENT_MODE_OPTIONS.find((option) => option.value === movementMode) || MOVEMENT_MODE_OPTIONS[0];
  const movementTypeChoices = MOVEMENT_OPTIONS.filter((option) => movementModeFromType(option.value) === movementMode);
  const movementCopyByMode = {
    in: {
      title: "Ingreso de stock",
      subtitle: "Carga mercaderia o recepciones en un sitio concreto.",
      typeLabel: "Motivo del ingreso",
      quantityLabel: "Cantidad a ingresar",
      fromLabel: "",
      toLabel: "Sitio que recibe",
      submitLabel: "Registrar ingreso",
      notesPlaceholder: "Proveedor, lote, referencia o comentario del ingreso...",
    },
    out: {
      title: "Egreso de stock",
      subtitle: "Descuenta mercaderia desde un sitio de origen.",
      typeLabel: "Motivo del egreso",
      quantityLabel: "Cantidad a egresar",
      fromLabel: "Sitio desde donde sale",
      toLabel: "",
      submitLabel: "Registrar egreso",
      notesPlaceholder: "Destino, cliente, consumo o comentario del egreso...",
    },
    transfer: {
      title: "Transferencia entre sitios",
      subtitle: "Mueve stock de un sitio origen hacia otro sitio destino.",
      typeLabel: "Operacion",
      quantityLabel: "Cantidad a transferir",
      fromLabel: "Sitio origen",
      toLabel: "Sitio destino",
      submitLabel: "Registrar transferencia",
      notesPlaceholder: "Motivo del traslado, referencia interna u observaciones...",
    },
    adjustment: {
      title: "Ajuste de inventario",
      subtitle: "Corrige diferencias entre el saldo real y el saldo del sistema.",
      typeLabel: "Tipo de ajuste",
      quantityLabel: "Cantidad a ajustar",
      fromLabel: "Sitio afectado",
      toLabel: "Sitio afectado",
      submitLabel: "Registrar ajuste",
      notesPlaceholder: "Explica el motivo del ajuste para dejar trazabilidad clara...",
    },
  };
  const movementCopy = movementCopyByMode[movementMode];
  const requiresFrom = movementDef?.kind === "out" || movementDef?.kind === "transfer";
  const requiresTo = movementDef?.kind === "in" || movementDef?.kind === "transfer";
  const canCreateMovement = items.length > 0 && locations.length > 0;

  const setMovementMode = (mode) => {
    const nextMovementType = defaultMovementTypeForMode(mode);
    setMovementForm((prev) => ({
      ...prev,
      movementType: nextMovementType,
      fromLocationId: "",
      toLocationId: "",
      notes: mode === movementMode ? prev.notes : "",
    }));
  };

  const openManager = (tab = "movement", seed = {}) => {
    setActionTab(tab);
    if (tab === "movement") {
      setMovementForm({
        ...DEFAULT_MOVEMENT_FORM,
        ...seed,
      });
    }
    setActionOpen(true);
  };

  const closeManager = () => {
    if (saving) return;
    setActionOpen(false);
  };

  const handleCreateItem = async () => {
    if (!itemForm.name.trim()) {
      setFeedback({ kind: "err", text: "Ingresá un nombre para el ítem" });
      return;
    }
    setSaving(true);
    try {
      const created = await apiCreateStockItem({
        category: itemForm.category,
        name: itemForm.name.trim(),
        code: itemForm.code.trim() || undefined,
        baseUnit: itemForm.baseUnit,
      });
      await loadCatalog();
      if (screenTab === "kardex") {
        await loadKardex();
      }
      setItemForm(DEFAULT_ITEM_FORM);
      setActionTab("movement");
      setMovementForm((prev) => ({
        ...prev,
        itemId: created?.id || prev.itemId,
        unit: created?.baseUnit || prev.unit,
      }));
      setFeedback({ kind: "ok", text: "Ítem creado. Ya podés registrar el movimiento." });
    } catch (e) {
      setFeedback({ kind: "err", text: e.message || "No se pudo crear el ítem" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLocation = async () => {
    if (!locationForm.name.trim()) {
      setFeedback({ kind: "err", text: "Ingresá un nombre para la ubicación" });
      return;
    }
    setSaving(true);
    try {
      await apiCreateStockLocation({
        locationType: locationForm.locationType,
        ownershipType: locationForm.ownershipType,
        name: locationForm.name.trim(),
        address: locationForm.address.trim() || undefined,
        notes: locationForm.notes.trim() || undefined,
      });
      await loadCatalog();
      if (screenTab === "sites" || screenTab === "kardex") {
        await loadLocationsData();
      }
      setLocationForm(DEFAULT_LOCATION_FORM);
      setActionTab("movement");
      setFeedback({ kind: "ok", text: "Ubicación creada. Ya podés mover stock contra ese destino." });
    } catch (e) {
      setFeedback({ kind: "err", text: e.message || "No se pudo crear la ubicación" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMovement = async () => {
    const quantity = Number(movementForm.quantity);
    if (!movementForm.itemId) {
      setFeedback({ kind: "err", text: "Seleccioná un ítem para registrar el movimiento" });
      return;
    }
    if (!quantity || quantity <= 0) {
      setFeedback({ kind: "err", text: "Ingresá una cantidad válida" });
      return;
    }
    if (!movementForm.unit) {
      setFeedback({ kind: "err", text: "Seleccioná la unidad del movimiento" });
      return;
    }
    if (requiresFrom && !movementForm.fromLocationId) {
      setFeedback({ kind: "err", text: "Seleccioná la ubicación de origen" });
      return;
    }
    if (requiresTo && !movementForm.toLocationId) {
      setFeedback({ kind: "err", text: "Seleccioná la ubicación de destino" });
      return;
    }
    if (movementForm.movementType === "transfer" && movementForm.fromLocationId === movementForm.toLocationId) {
      setFeedback({ kind: "err", text: "La transferencia requiere origen y destino distintos" });
      return;
    }

    setSaving(true);
    try {
      await apiCreateStockMovement({
        movementType: movementForm.movementType,
        itemId: movementForm.itemId,
        quantity,
        unit: movementForm.unit,
        fromLocationId: movementForm.fromLocationId || undefined,
        toLocationId: movementForm.toLocationId || undefined,
        notes: movementForm.notes.trim() || undefined,
      });
      await load();
      await loadCatalog();
      if (screenTab === "sites") {
        await loadLocationsData();
      }
      if (screenTab === "kardex") {
        await loadKardex();
      }
      setMovementForm((prev) => ({
        ...DEFAULT_MOVEMENT_FORM,
        movementType: prev.movementType,
      }));
      setActionOpen(false);
      setFeedback({ kind: "ok", text: "Movimiento registrado correctamente" });
    } catch (e) {
      setFeedback({ kind: "err", text: e.message || "No se pudo registrar el movimiento" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevertMovement = async (movement) => {
    const movementItemName = movement.item?.name || movement.itemName || "este item";
    if (!window.confirm(`¿Querés revertir el movimiento de ${movementItemName}?`)) return;
    setRevertingId(movement.id);
    try {
      await apiRevertStockMovement(movement.id, { reason: "Reversión solicitada desde Stock y Acopio" });
      await load();
      if (screenTab === "sites") {
        await loadLocationsData();
      }
      if (screenTab === "kardex") {
        await loadKardex();
      }
      setFeedback({ kind: "ok", text: "Movimiento revertido correctamente" });
    } catch (e) {
      setFeedback({ kind: "err", text: e.message || "No se pudo revertir el movimiento" });
    } finally {
      setRevertingId("");
    }
  };

  const pageButtonStyle = {
    padding: "8px 12px",
    borderRadius: R.md,
    border: `1px solid ${C.b1}`,
    background: C.w,
    color: C.t2,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const smallActionStyle = {
    padding: "6px 10px",
    borderRadius: R.md,
    border: `1px solid ${C.b1}`,
    background: C.w,
    color: C.t2,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  const renderMovementView = () => (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <SummaryCard title="Stock propio" value={totals.own.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub="Disponible en sitios propios" icon={Ic.grain(C.pri, 18)} color={C.pri} />
        <SummaryCard title="Stock terceros" value={totals.thirdParty.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub="Depositado fuera del establecimiento" icon={Ic.plant(C.acc, 18)} color={C.acc} />
        <SummaryCard title="Stock total" value={totals.total.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub={`${summary?.items?.length || 0} producto(s) con saldo`} icon={Ic.chk(C.info, 18)} color={C.info} />
      </div>

      <Section
        title="Registrar actualizacion de stock"
        action={<button onClick={load} style={smallActionStyle}>Actualizar saldos</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          {MOVEMENT_MODE_OPTIONS.map((mode) => (
            <OperationCard
              key={mode.value}
              active={movementMode === mode.value}
              title={mode.label}
              description={mode.description}
              color={mode.color}
              icon={mode.icon}
              onClick={() => setMovementMode(mode.value)}
            />
          ))}
        </div>

        {!canCreateMovement ? (
          <div style={{ background: C.warnPale, color: C.warn, border: `1px solid ${C.warn}22`, borderRadius: R.lg, padding: 14, marginBottom: 14, fontSize: 12.7, fontWeight: 600 }}>
            Para actualizar stock primero necesitás al menos un producto y un sitio.
          </div>
        ) : null}

        <div style={{ border: `1px solid ${movementModeDef.color}22`, background: `${movementModeDef.color}0D`, borderRadius: R.lg, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 15.2, fontWeight: 800, color: C.t1 }}>{movementCopy.title}</div>
          <div style={{ fontSize: 12.3, color: C.t3, marginTop: 4 }}>{movementCopy.subtitle}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Select
            label={movementCopy.typeLabel}
            value={movementForm.movementType}
            onChange={(value) => setMovementForm((prev) => ({ ...prev, movementType: value, fromLocationId: "", toLocationId: "" }))}
            options={movementTypeChoices.map((option) => ({ value: option.value, label: option.label }))}
          />
          <Select
            label="Producto"
            value={movementForm.itemId}
            onChange={(value) => setMovementForm((prev) => ({ ...prev, itemId: value }))}
            options={itemOptions}
            placeholder="Elegí un producto"
            searchable
          />
          <Field
            label={movementCopy.quantityLabel}
            value={movementForm.quantity}
            onChange={(value) => setMovementForm((prev) => ({ ...prev, quantity: value }))}
            placeholder="Ej: 30000"
            inputMode="decimal"
          />
          <Select
            label="Unidad"
            value={movementForm.unit}
            onChange={(value) => setMovementForm((prev) => ({ ...prev, unit: value }))}
            options={unitChoices}
            placeholder={selectedItem ? "Elegí la unidad" : "Seleccioná un producto"}
          />
          {requiresFrom ? (
            <Select
              label={movementCopy.fromLabel || "Sitio origen"}
              value={movementForm.fromLocationId}
              onChange={(value) => setMovementForm((prev) => ({ ...prev, fromLocationId: value }))}
              options={locationOptions}
              placeholder="Elegí origen"
              searchable
            />
          ) : null}
          {requiresTo ? (
            <Select
              label={movementCopy.toLabel || "Sitio destino"}
              value={movementForm.toLocationId}
              onChange={(value) => setMovementForm((prev) => ({ ...prev, toLocationId: value }))}
              options={locationOptions}
              placeholder="Elegí destino"
              searchable
            />
          ) : null}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11.6, fontWeight: 600, color: C.t2, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}>Notas operativas</label>
            <textarea
              value={movementForm.notes}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder={movementCopy.notesPlaceholder}
              rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontSize: 14.3, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setScreenTab("products")} style={smallActionStyle}>Ir a productos</button>
            <button onClick={() => setScreenTab("sites")} style={smallActionStyle}>Ir a sitios</button>
          </div>
          <Btn onClick={handleCreateMovement} disabled={saving || !canCreateMovement}>
            {saving ? "Guardando..." : movementCopy.submitLabel}
          </Btn>
        </div>
      </Section>

      <Section title="Movimientos recientes" action={<button onClick={() => setScreenTab("kardex")} style={smallActionStyle}>Ver kardex completo</button>}>
        {summary?.recentMovements?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {summary.recentMovements.map((movement) => {
              const canRevert = movement.sourceType === "manual" || movement.sourceType === "adjustment";
              const reverting = revertingId === movement.id;
              return (
                <div key={movement.id} style={{ border: `1px solid ${C.b2}`, borderRadius: R.md, padding: 12, background: C.bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1 }}>
                        {movement.itemName} <span style={{ color: C.t3, fontWeight: 600 }}>· {humanizeMovementType(movement.movementType)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
                        {movement.fromLocation ? `${movement.fromLocation} -> ` : ""}
                        {movement.toLocation || "Sin destino"}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: movement.sourceType === "freight" ? C.info : C.acc, background: movement.sourceType === "freight" ? C.infoPale : C.accPale, borderRadius: R.pill, padding: "3px 8px" }}>
                          {movement.sourceType === "freight" ? "Automático" : "Manual"}
                        </span>
                        {canRevert ? (
                          <button
                            onClick={() => handleRevertMovement(movement)}
                            disabled={reverting}
                            style={{ ...smallActionStyle, color: C.err, border: `1px solid ${C.err}33`, opacity: reverting ? 0.7 : 1 }}
                          >
                            {reverting ? "Revirtiendo..." : "Revertir"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13.2, fontWeight: 800, color: C.pri }}>{formatQty(movement.quantity, movement.baseUnit)}</div>
                      <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>{new Date(movement.effectiveAt).toLocaleString("es-UY")}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>Todavía no hay movimientos de stock.</div>
        )}
      </Section>
    </>
  );

  const renderProductsView = () => (
    <>
      <Section
        title="Crear producto"
        action={<button onClick={loadCatalog} style={smallActionStyle}>Actualizar catalogo</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Select
            label="Categoria"
            value={itemForm.category}
            onChange={(value) => setItemForm((prev) => ({ ...prev, category: value }))}
            options={ITEM_CATEGORY_OPTIONS}
          />
          <Select
            label="Unidad base"
            value={itemForm.baseUnit}
            onChange={(value) => setItemForm((prev) => ({ ...prev, baseUnit: value }))}
            options={UNIT_OPTIONS}
          />
          <Field
            label="Nombre"
            value={itemForm.name}
            onChange={(value) => setItemForm((prev) => ({ ...prev, name: value }))}
            placeholder="Ej: Soja zafra 2026"
          />
          <Field
            label="Codigo"
            value={itemForm.code}
            onChange={(value) => setItemForm((prev) => ({ ...prev, code: value }))}
            placeholder="Opcional"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => setScreenTab("movement")} style={smallActionStyle}>Volver a actualizar stock</button>
          <Btn onClick={handleCreateItem} disabled={saving}>
            {saving ? "Guardando..." : "Crear producto"}
          </Btn>
        </div>
      </Section>

      <Section title="Productos cargados">
        {items.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.2, fontFamily: "inherit" }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${C.b1}` }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Producto</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Categoria</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Unidad base</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Saldo total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const summaryItem = summary?.items?.find((entry) => entry.itemId === item.id);
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${C.b2}` }}>
                      <td style={{ padding: "10px", fontWeight: 700, color: C.t1 }}>
                        {item.name}
                        {item.code ? <div style={{ fontSize: 11.5, fontWeight: 600, color: C.t3, marginTop: 2 }}>{item.code}</div> : null}
                      </td>
                      <td style={{ padding: "10px", color: C.t2 }}>{ITEM_CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label || item.category}</td>
                      <td style={{ padding: "10px", color: C.t2 }}>{unitLabel(item.baseUnit)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: C.pri }}>
                        {summaryItem ? formatQty(summaryItem.totalQuantity, summaryItem.baseUnit) : formatQty(0, item.baseUnit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>Todavía no hay productos cargados.</div>
        )}
      </Section>
    </>
  );

  const renderLocationsView = () => (
    <>
      <Section
        title="Crear sitio"
        action={<button onClick={loadLocationsData} style={smallActionStyle}>Actualizar sitios</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Select
            label="Tipo de sitio"
            value={locationForm.locationType}
            onChange={(value) => setLocationForm((prev) => ({ ...prev, locationType: value }))}
            options={LOCATION_TYPE_OPTIONS}
          />
          <Select
            label="Titularidad"
            value={locationForm.ownershipType}
            onChange={(value) => setLocationForm((prev) => ({ ...prev, ownershipType: value }))}
            options={OWNERSHIP_OPTIONS}
          />
          <Field
            label="Nombre"
            value={locationForm.name}
            onChange={(value) => setLocationForm((prev) => ({ ...prev, name: value }))}
            placeholder="Ej: Silo norte"
          />
          <Field
            label="Direccion"
            value={locationForm.address}
            onChange={(value) => setLocationForm((prev) => ({ ...prev, address: value }))}
            placeholder="Opcional"
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11.6, fontWeight: 600, color: C.t2, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}>Notas del sitio</label>
            <textarea
              value={locationForm.notes}
              onChange={(e) => setLocationForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Opcional: aclaraciones operativas del sitio"
              rows={4}
              style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontSize: 14.3, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => setScreenTab("movement")} style={smallActionStyle}>Volver a actualizar stock</button>
          <Btn onClick={handleCreateLocation} disabled={saving}>
            {saving ? "Guardando..." : "Crear sitio"}
          </Btn>
        </div>
      </Section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <SummaryCard title="Sitios" value={locationStats.locations} sub="Espacios registrados" icon={Ic.plant(C.pri, 18)} color={C.pri} />
        <SummaryCard title="Con saldo" value={locationStats.withStock} sub={`${locationStats.positions} posiciones con producto`} icon={Ic.chk(C.ok, 18)} color={C.ok} />
        <SummaryCard title="Propios / terceros" value={`${locationStats.own} / ${locationStats.thirdParty}`} sub="Segun titularidad del sitio" icon={Ic.grain(C.acc, 18)} color={C.acc} />
      </div>

      <Section
        title="Stock por sitio"
        action={<button onClick={loadLocationsData} style={smallActionStyle}>Actualizar sitios</button>}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Field
            label="Buscar"
            value={locationFilters.search}
            onChange={(value) => setLocationFilters((prev) => ({ ...prev, search: value }))}
            placeholder="Silo, planta, item..."
          />
          <Select
            label="Tipo"
            value={locationFilters.locationType}
            onChange={(value) => setLocationFilters((prev) => ({ ...prev, locationType: value }))}
            options={[{ value: "", label: "Todos" }, ...LOCATION_TYPE_OPTIONS]}
          />
          <Select
            label="Titularidad"
            value={locationFilters.ownershipType}
            onChange={(value) => setLocationFilters((prev) => ({ ...prev, ownershipType: value }))}
            options={[{ value: "", label: "Todas" }, ...OWNERSHIP_OPTIONS]}
          />
        </div>

        {locationsLoading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader /></div>
        ) : locationsError ? (
          <div style={{ background: C.errPale, color: C.err, border: `1px solid ${C.err}22`, borderRadius: R.lg, padding: 14, fontSize: 12.7, fontWeight: 600 }}>
            {locationsError}
          </div>
        ) : filteredStockLocations.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredStockLocations.map((location) => (
              <div key={location.id} style={{ border: `1px solid ${C.b2}`, borderRadius: R.lg, padding: 14, background: C.bg }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: 15.4, fontWeight: 800, color: C.t1 }}>{location.name}</div>
                    <div style={{ fontSize: 12.1, color: C.t3, marginTop: 4 }}>
                      {(LOCATION_TYPE_OPTIONS.find((option) => option.value === location.locationType)?.label || location.locationType)}
                      {" · "}
                      {location.ownershipType === "own" ? "Propio" : "Terceros"}
                      {location.address ? ` · ${location.address}` : ""}
                    </div>
                    {location.field?.name || location.lot?.name || location.plant?.name ? (
                      <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>
                        {[location.field?.name, location.lot?.name, location.plant?.name].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Items con saldo</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.pri }}>{location.balances?.length || 0}</div>
                  </div>
                </div>

                {location.balances?.length ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    {location.balances
                      .filter((balance) => Number(balance.currentQuantity || 0) !== 0)
                      .sort((a, b) => (b.currentQuantity || 0) - (a.currentQuantity || 0))
                      .map((balance) => (
                        <div key={balance.id || `${location.id}-${balance.item?.id}`} style={{ border: `1px solid ${C.b1}`, borderRadius: R.md, padding: 12, background: C.w }}>
                          <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1 }}>{balance.item?.name || "-"}</div>
                          <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>
                            {ITEM_CATEGORY_OPTIONS.find((option) => option.value === balance.item?.category)?.label || balance.item?.category || "-"}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: C.pri, marginTop: 8 }}>
                            {formatQty(balance.currentQuantity, balance.baseUnit)}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.1, color: C.t3, textAlign: "center", padding: 12 }}>No hay saldo cargado en esta ubicacion.</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 16 }}>
            No encontramos sitios que coincidan con los filtros aplicados.
          </div>
        )}
      </Section>
    </>
  );

  const renderKardexView = () => (
    <Section
      title="Kardex de stock"
      action={<button onClick={() => loadKardex()} style={smallActionStyle}>Actualizar kardex</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Select
          label="Item"
          value={kardexFilters.itemId}
          onChange={(value) => setKardexFilters((prev) => ({ ...prev, itemId: value }))}
          options={[{ value: "", label: "Todos los items" }, ...itemOptions]}
          placeholder="Todos los items"
          searchable
        />
        <Select
          label="Ubicacion"
          value={kardexFilters.locationId}
          onChange={(value) => setKardexFilters((prev) => ({ ...prev, locationId: value }))}
          options={[{ value: "", label: "Toda la empresa" }, ...locationOptions]}
          placeholder="Toda la empresa"
          searchable
        />
        <Select
          label="Movimiento"
          value={kardexFilters.movementType}
          onChange={(value) => setKardexFilters((prev) => ({ ...prev, movementType: value }))}
          options={[{ value: "", label: "Todos los tipos" }, ...MOVEMENT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]}
        />
        <Select
          label="Limite"
          value={kardexFilters.limit}
          onChange={(value) => setKardexFilters((prev) => ({ ...prev, limit: value }))}
          options={[
            { value: "50", label: "50 movimientos" },
            { value: "100", label: "100 movimientos" },
            { value: "200", label: "200 movimientos" },
          ]}
        />
        <Field
          label="Desde"
          value={kardexFilters.dateFrom}
          onChange={(value) => setKardexFilters((prev) => ({ ...prev, dateFrom: value }))}
          type="date"
        />
        <Field
          label="Hasta"
          value={kardexFilters.dateTo}
          onChange={(value) => setKardexFilters((prev) => ({ ...prev, dateTo: value }))}
          type="date"
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: 12.1, color: C.t3 }}>
          {kardexFilters.itemId
            ? `Saldo actual${kardexFilters.locationId ? " en ubicacion" : ""}: ${formatQty(currentKardexBalance || 0, selectedKardexItem?.baseUnit)}`
            : "Selecciona un item para ver saldo corrido sobre el kardex."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setKardexFilters(DEFAULT_KARDEX_FILTERS)} style={smallActionStyle}>Limpiar filtros</button>
          <Btn sm onClick={() => loadKardex()}>{kardexLoading ? "Consultando..." : "Aplicar filtros"}</Btn>
        </div>
      </div>

      {kardexLoading ? (
        <div style={{ padding: 40, textAlign: "center" }}><Loader /></div>
      ) : kardexError ? (
        <div style={{ background: C.errPale, color: C.err, border: `1px solid ${C.err}22`, borderRadius: R.lg, padding: 14, fontSize: 12.7, fontWeight: 600 }}>
          {kardexError}
        </div>
      ) : kardexRowsWithBalance.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.2, fontFamily: "inherit" }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${C.b1}` }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Fecha</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Item</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Movimiento</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Origen / destino</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Ingreso</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Egreso</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Saldo</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {kardexRowsWithBalance.map((movement) => {
                const canRevert = movement.sourceType === "manual" || movement.sourceType === "adjustment";
                const reverting = revertingId === movement.id;
                return (
                  <tr key={movement.id} style={{ borderBottom: `1px solid ${C.b2}` }}>
                    <td style={{ padding: "10px", color: C.t2, whiteSpace: "nowrap" }}>{formatDateTime(movement.effectiveAt)}</td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 700, color: C.t1 }}>{movement.item?.name || movement.itemName || "-"}</div>
                      <div style={{ fontSize: 11.5, color: C.t3 }}>{movement.baseUnit || movement.item?.baseUnit || "-"}</div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 700, color: C.t1 }}>{humanizeMovementType(movement.movementType)}</div>
                      <div style={{ fontSize: 11.5, color: movement.sourceType === "freight" ? C.info : C.t3 }}>
                        {movement.sourceType === "freight" ? "Automatico" : "Manual"}
                      </div>
                    </td>
                    <td style={{ padding: "10px", color: C.t2 }}>
                      <div>{movement.fromLocation?.name || movement.fromLocation || "-"}</div>
                      <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}>{movement.toLocation?.name || movement.toLocation || "-"}</div>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", color: C.ok, fontWeight: 700 }}>
                      {movement.inQty > 0 ? formatQty(movement.inQty, movement.baseUnit) : "-"}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", color: C.err, fontWeight: 700 }}>
                      {movement.outQty > 0 ? formatQty(movement.outQty, movement.baseUnit) : "-"}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", color: movement.runningBalance === null ? C.t3 : C.pri, fontWeight: 800 }}>
                      {movement.runningBalance === null ? "-" : formatQty(movement.runningBalance, movement.baseUnit)}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      {canRevert ? (
                        <button
                          onClick={() => handleRevertMovement(movement)}
                          disabled={reverting}
                          style={{ ...smallActionStyle, color: C.err, border: `1px solid ${C.err}33`, opacity: reverting ? 0.7 : 1 }}
                        >
                          {reverting ? "Revirtiendo..." : "Revertir"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11.5, color: C.t3 }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 16 }}>
          No encontramos movimientos para el filtro seleccionado.
        </div>
      )}
    </Section>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 18, fontFamily: "inherit" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
          {Ic.chev(C.pri, 18)}
        </button>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, flex: 1 }}>Stock y Acopio</span>
        <button onClick={load} style={pageButtonStyle}>Actualizar</button>
      </div>

      <div style={{ fontSize: 13.2, color: C.t3, marginBottom: 16 }}>
        Empresa activa: <strong style={{ color: C.t1 }}>{user?.entity || "-"}</strong>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs items={SCREEN_TABS} active={screenTab} onChange={setScreenTab} />
      </div>

      {feedback ? (
        <div style={{ background: feedback.kind === "ok" ? C.okPale : C.errPale, color: feedback.kind === "ok" ? C.ok : C.err, border: `1px solid ${feedback.kind === "ok" ? `${C.ok}22` : `${C.err}22`}`, borderRadius: R.lg, padding: 14, fontSize: 13.2, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex" }}>
            {Ic.cross(feedback.kind === "ok" ? C.ok : C.err, 16)}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}><Loader /></div>
      ) : error ? (
        <div style={{ background: C.errPale, color: C.err, border: `1px solid ${C.err}22`, borderRadius: R.lg, padding: 16, fontSize: 13.2, fontWeight: 600 }}>
          {error}
        </div>
      ) : (
        <>
          {screenTab === "movement" ? renderMovementView() : null}
          {screenTab === "products" ? renderProductsView() : null}
          {screenTab === "sites" ? renderLocationsView() : null}
          {false ? (<>

          <Section
            title="Items con saldo"
            action={<button onClick={() => openManager("item")} style={smallActionStyle}>Nuevo ítem</button>}
          >
            {summary?.items?.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.2, fontFamily: "inherit" }}>
                  <thead>
                    <tr style={{ borderBottom: `1.5px solid ${C.b1}` }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Item</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Categoria</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Propio</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Terceros</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Total</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items.map((item) => (
                      <tr key={item.itemId} style={{ borderBottom: `1px solid ${C.b2}` }}>
                        <td style={{ padding: "10px", fontWeight: 700, color: C.t1 }}>{item.itemName}</td>
                        <td style={{ padding: "10px", color: C.t2 }}>{ITEM_CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label || item.category}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.t1 }}>{formatQty(item.ownQuantity, item.baseUnit)}</td>
                        <td style={{ padding: "10px", textAlign: "right", color: C.t1 }}>{formatQty(item.thirdPartyQuantity, item.baseUnit)}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 800, color: C.pri }}>{formatQty(item.totalQuantity, item.baseUnit)}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>
                          <button
                            onClick={() => openManager("movement", {
                              itemId: item.itemId,
                              movementType: Number(item.totalQuantity || 0) > 0 ? "adjustment_out" : "adjustment_in",
                              unit: item.baseUnit,
                            })}
                            style={smallActionStyle}
                          >
                            Ajustar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>No hay items con movimientos registrados.</div>
            )}
          </Section>

          <Section
            title="Movimientos recientes"
            action={<button onClick={() => openManager("location")} style={smallActionStyle}>Nueva ubicación</button>}
          >
            {summary?.recentMovements?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {summary.recentMovements.map((movement) => {
                  const canRevert = movement.sourceType === "manual" || movement.sourceType === "adjustment";
                  const reverting = revertingId === movement.id;
                  return (
                    <div key={movement.id} style={{ border: `1px solid ${C.b2}`, borderRadius: R.md, padding: 12, background: C.bg }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontSize: 13.2, fontWeight: 700, color: C.t1 }}>
                            {movement.itemName} <span style={{ color: C.t3, fontWeight: 600 }}>· {humanizeMovementType(movement.movementType)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
                            {movement.fromLocation ? `${movement.fromLocation} -> ` : ""}
                            {movement.toLocation || "Sin destino"}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: movement.sourceType === "freight" ? C.info : C.acc, background: movement.sourceType === "freight" ? C.infoPale : C.accPale, borderRadius: R.pill, padding: "3px 8px" }}>
                              {movement.sourceType === "freight" ? "Automático" : "Manual"}
                            </span>
                            {canRevert ? (
                              <button
                                onClick={() => handleRevertMovement(movement)}
                                disabled={reverting}
                                style={{ ...smallActionStyle, color: C.err, border: `1px solid ${C.err}33`, opacity: reverting ? 0.7 : 1 }}
                              >
                                {reverting ? "Revirtiendo..." : "Revertir"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13.2, fontWeight: 800, color: C.pri }}>{formatQty(movement.quantity, movement.baseUnit)}</div>
                          <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4 }}>{new Date(movement.effectiveAt).toLocaleString("es-UY")}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.7, color: C.t3, textAlign: "center", padding: 12 }}>Todavia no hay movimientos de stock.</div>
            )}
          </Section>

          {screenTab === "locations" ? renderLocationsView() : null}
          </>) : null}
          {screenTab === "kardex" ? renderKardexView() : null}
        </>
      )}

      {actionOpen ? (
        <ModalOverlay onClose={closeManager} maxWidth={760} quick>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.t1 }}>Gestionar stock</div>
              <div style={{ fontSize: 12.1, color: C.t3, marginTop: 3 }}>Empresa activa: {user?.entity || "-"}</div>
            </div>
            <button onClick={closeManager} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
              {Ic.cross(C.t3, 18)}
            </button>
          </div>

          <Tabs items={MODAL_TABS} active={actionTab} onChange={setActionTab} />

          {catalogLoading ? (
            <div style={{ padding: 40, textAlign: "center" }}><Loader /></div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {feedback ? (
                <div style={{ background: feedback.kind === "ok" ? C.okPale : C.errPale, color: feedback.kind === "ok" ? C.ok : C.err, border: `1px solid ${feedback.kind === "ok" ? `${C.ok}22` : `${C.err}22`}`, borderRadius: R.lg, padding: 12, fontSize: 12.7, fontWeight: 600, marginBottom: 14 }}>
                  {feedback.text}
                </div>
              ) : null}

              {actionTab === "movement" ? (
                <>
                  {!canCreateMovement ? (
                    <div style={{ background: C.warnPale, color: C.warn, border: `1px solid ${C.warn}22`, borderRadius: R.lg, padding: 14, marginBottom: 14, fontSize: 12.7, fontWeight: 600 }}>
                      Para registrar movimientos primero necesitás al menos un ítem y una ubicación.
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <Select
                      label="Tipo de movimiento"
                      value={movementForm.movementType}
                      onChange={(value) => setMovementForm((prev) => ({ ...prev, movementType: value, fromLocationId: "", toLocationId: "" }))}
                      options={MOVEMENT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    />
                    <Select
                      label="Ítem"
                      value={movementForm.itemId}
                      onChange={(value) => setMovementForm((prev) => ({ ...prev, itemId: value }))}
                      options={itemOptions}
                      placeholder="Elegí un ítem"
                      searchable
                    />
                    <Field
                      label="Cantidad"
                      value={movementForm.quantity}
                      onChange={(value) => setMovementForm((prev) => ({ ...prev, quantity: value }))}
                      placeholder="Ej: 30000"
                      inputMode="decimal"
                    />
                    <Select
                      label="Unidad"
                      value={movementForm.unit}
                      onChange={(value) => setMovementForm((prev) => ({ ...prev, unit: value }))}
                      options={unitChoices}
                      placeholder={selectedItem ? "Elegí la unidad" : "Seleccioná un ítem"}
                    />
                    {requiresFrom ? (
                      <Select
                        label="Origen"
                        value={movementForm.fromLocationId}
                        onChange={(value) => setMovementForm((prev) => ({ ...prev, fromLocationId: value }))}
                        options={locationOptions}
                        placeholder="Elegí origen"
                        searchable
                      />
                    ) : null}
                    {requiresTo ? (
                      <Select
                        label="Destino"
                        value={movementForm.toLocationId}
                        onChange={(value) => setMovementForm((prev) => ({ ...prev, toLocationId: value }))}
                        options={locationOptions}
                        placeholder="Elegí destino"
                        searchable
                      />
                    ) : null}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 11.6, fontWeight: 600, color: C.t2, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}>Notas</label>
                      <textarea
                        value={movementForm.notes}
                        onChange={(e) => setMovementForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Opcional: referencia, motivo del ajuste, observaciones..."
                        rows={4}
                        style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontSize: 14.3, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setActionTab("item")} style={smallActionStyle}>Crear ítem</button>
                      <button onClick={() => setActionTab("location")} style={smallActionStyle}>Crear ubicación</button>
                    </div>
                    <Btn onClick={handleCreateMovement} disabled={saving || !canCreateMovement}>
                      {saving ? "Guardando..." : "Registrar movimiento"}
                    </Btn>
                  </div>
                </>
              ) : null}

              {actionTab === "item" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <Select
                      label="Categoría"
                      value={itemForm.category}
                      onChange={(value) => setItemForm((prev) => ({ ...prev, category: value }))}
                      options={ITEM_CATEGORY_OPTIONS}
                    />
                    <Select
                      label="Unidad base"
                      value={itemForm.baseUnit}
                      onChange={(value) => setItemForm((prev) => ({ ...prev, baseUnit: value }))}
                      options={UNIT_OPTIONS}
                    />
                    <Field
                      label="Nombre"
                      value={itemForm.name}
                      onChange={(value) => setItemForm((prev) => ({ ...prev, name: value }))}
                      placeholder="Ej: Soja zafra 2026"
                    />
                    <Field
                      label="Código"
                      value={itemForm.code}
                      onChange={(value) => setItemForm((prev) => ({ ...prev, code: value }))}
                      placeholder="Opcional"
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <Btn onClick={handleCreateItem} disabled={saving}>
                      {saving ? "Guardando..." : "Crear ítem"}
                    </Btn>
                  </div>
                </>
              ) : null}

              {actionTab === "location" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <Select
                      label="Tipo de ubicación"
                      value={locationForm.locationType}
                      onChange={(value) => setLocationForm((prev) => ({ ...prev, locationType: value }))}
                      options={LOCATION_TYPE_OPTIONS}
                    />
                    <Select
                      label="Titularidad"
                      value={locationForm.ownershipType}
                      onChange={(value) => setLocationForm((prev) => ({ ...prev, ownershipType: value }))}
                      options={OWNERSHIP_OPTIONS}
                    />
                    <Field
                      label="Nombre"
                      value={locationForm.name}
                      onChange={(value) => setLocationForm((prev) => ({ ...prev, name: value }))}
                      placeholder="Ej: Silo norte"
                    />
                    <Field
                      label="Dirección"
                      value={locationForm.address}
                      onChange={(value) => setLocationForm((prev) => ({ ...prev, address: value }))}
                      placeholder="Opcional"
                    />
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 11.6, fontWeight: 600, color: C.t2, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}>Notas</label>
                      <textarea
                        value={locationForm.notes}
                        onChange={(e) => setLocationForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Opcional: aclaraciones sobre la ubicación"
                        rows={4}
                        style={{ width: "100%", padding: "12px 14px", borderRadius: R.md, border: `1.5px solid ${C.b1}`, background: C.w, color: C.t1, fontSize: 14.3, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <Btn onClick={handleCreateLocation} disabled={saving}>
                      {saving ? "Guardando..." : "Crear ubicación"}
                    </Btn>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </ModalOverlay>
      ) : null}
    </div>
  );
}
