import { useEffect, useMemo, useState } from "react";
import { C, Ic, R } from "../theme";
import { Btn, Field, Loader, ModalOverlay, PageHeader, PageShell, SectionCard, Select, StatePanel, StatCard, Tabs } from "../components";
import {
  apiCreateStockItem,
  apiCreateStockLocation,
  apiCreateStockMovement,
  apiGetStockItems,
  apiGetStockLocations,
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

const MODAL_TABS = [
  { k: "movement", l: "Movimiento" },
  { k: "item", l: "Ítem" },
  { k: "location", l: "Ubicación" },
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

  useEffect(() => {
    load();
  }, [user?.activeCompanyId]);

  useEffect(() => {
    if (actionOpen) {
      loadCatalog();
    }
  }, [actionOpen, user?.activeCompanyId]);

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

  const movementDef = MOVEMENT_OPTIONS.find((option) => option.value === movementForm.movementType);
  const requiresFrom = movementDef?.kind === "out" || movementDef?.kind === "transfer";
  const requiresTo = movementDef?.kind === "in" || movementDef?.kind === "transfer";
  const canCreateMovement = items.length > 0 && locations.length > 0;

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
    if (!window.confirm(`¿Querés revertir el movimiento de ${movement.itemName}?`)) return;
    setRevertingId(movement.id);
    try {
      await apiRevertStockMovement(movement.id, { reason: "Reversión solicitada desde Stock y Acopio" });
      await load();
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

  return (
    <PageShell accent="pri" style={{ flex: 1, overflow: "auto", fontFamily: "inherit" }}>
      <PageHeader
        title="Stock y Acopio"
        subtitle={`Empresa activa: ${user?.entity || "-"}`}
        onBack={onBack}
        badge="Operacion"
        actions={
          <>
            <Btn sm onClick={() => openManager("movement")} icon={Ic.plus(C.w, 14)}>Gestionar</Btn>
            <button onClick={load} style={pageButtonStyle}>Actualizar</button>
          </>
        }
      />

      {feedback ? (
        <div style={{ marginBottom: 16 }}>
          <StatePanel
            tone={feedback.kind === "ok" ? "success" : "error"}
            title={feedback.kind === "ok" ? "Accion completada" : "Revisá este punto"}
            description={feedback.text}
            compact
            action={
              <button onClick={() => setFeedback(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", fontFamily: "inherit", fontSize: 12.1, fontWeight: 700 }}>
                Cerrar
              </button>
            }
          />
        </div>
      ) : null}

      {loading ? (
        <SectionCard title="Cargando stock" subtitle="Preparando resumen operativo de la empresa activa">
          <Loader />
        </SectionCard>
      ) : error ? (
        <StatePanel
          tone="error"
          title="No se pudo cargar el resumen"
          description={error}
          action={<button onClick={load} style={smallActionStyle}>Reintentar</button>}
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard title="Stock propio" value={totals.own.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub="Acopio interno" icon={Ic.grain(C.pri, 18)} color={C.pri} />
            <StatCard title="Stock en terceros" value={totals.thirdParty.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub="Depositado fuera del establecimiento" icon={Ic.plant(C.acc, 18)} color={C.acc} />
            <StatCard title="Stock total" value={totals.total.toLocaleString("es-UY", { maximumFractionDigits: 3 })} sub={`${summary?.items?.length || 0} item(s) con saldo`} icon={Ic.chk(C.info, 18)} color={C.info} />
          </div>

          <SectionCard
            title="Por categoria"
            subtitle="Lectura rápida del stock consolidado por familia de producto."
            action={<button onClick={() => openManager("movement")} style={smallActionStyle}>Registrar movimiento</button>}
          >
            {summary?.categories?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {summary.categories.map((category) => (
                  <div key={category.category} style={{ border: `1px solid ${C.b2}`, borderRadius: R.md, padding: 12, background: C.bg }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      {category.category}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{formatQty(category.totalQuantity, category.baseUnit)}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12.1, color: C.t3, flexWrap: "wrap" }}>
                      <span>Propio: <strong style={{ color: C.t1 }}>{formatQty(category.ownQuantity, category.baseUnit)}</strong></span>
                      <span>Terceros: <strong style={{ color: C.t1 }}>{formatQty(category.thirdPartyQuantity, category.baseUnit)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <StatePanel
                tone="info"
                title="Sin stock cargado"
                description="Todavia no hay stock cargado para esta empresa."
                compact
              />
            )}
          </SectionCard>

          <SectionCard
            title="Items con saldo"
            subtitle="Saldo disponible por ítem, con acceso directo a ajustes manuales."
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
              <StatePanel
                tone="info"
                title="Sin items con saldo"
                description="No hay items con movimientos registrados."
                compact
              />
            )}
          </SectionCard>

          <SectionCard
            title="Movimientos recientes"
            subtitle="Últimos movimientos registrados y reversión rápida para operaciones manuales."
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
              <StatePanel
                tone="info"
                title="Sin movimientos"
                description="Todavia no hay movimientos de stock."
                compact
              />
            )}
          </SectionCard>
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
            <SectionCard title="Cargando catálogos" subtitle="Preparando items y ubicaciones disponibles para operar.">
              <Loader />
            </SectionCard>
          ) : (
            <div style={{ marginTop: 16 }}>
              {feedback ? (
                <StatePanel
                  tone={feedback.kind === "ok" ? "success" : "error"}
                  title={feedback.kind === "ok" ? "Operacion completada" : "Revisá este punto"}
                  description={feedback.text}
                  compact
                />
              ) : null}

              {actionTab === "movement" ? (
                <>
                  {!canCreateMovement ? (
                    <StatePanel
                      tone="warning"
                      title="Faltan datos base"
                      description="Para registrar movimientos primero necesitás al menos un ítem y una ubicación."
                      compact
                    />
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
    </PageShell>
  );
}
