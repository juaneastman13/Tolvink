import { useState, useEffect, useCallback, useRef } from "react";
import { C, Ic, FONT } from "../theme";
import { Btn, Field, Loader, LoadingOverlay } from "../components";
import { Select } from "../components/form";
import {
  apiGetUnifiedAccess, apiUpdateAccessLevel, apiToggleAccess,
  apiCreateLinkedCompany, apiGetLinkedStats, apiCreateSharedLink,
} from "../api";

// =====================================================================
// TOLVINK — LinkedCompaniesScreen (Unified)
// Merges CompanyAccess + PlantProducerAccess into a single grouped view.
// Groups: Productores / Transportistas, with badges USO/CONSULTA.
// =====================================================================

const TYPE_COLORS = { PRODUCER: "#F59E0B", TRANSPORTER: "#14B8A6" };
const TYPE_LABELS = { PRODUCER: "Productor", TRANSPORTER: "Transportista" };
const LEVEL_LABELS = { OPERATOR: "USO", READONLY: "CONSULTA" };


function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return `hace ${Math.floor(d / 30)} mes${Math.floor(d / 30) > 1 ? "es" : ""}`;
}

export default function LinkedCompaniesScreen({ user, embedded, onBack, onNav }) {
  const hubCompanyId = user?.activeCompanyId;
  const hubType = user?.userType;
  const allowedGranteeTypes = hubType === "producer" ? ["TRANSPORTER"] : hubType === "transporter" ? ["PRODUCER"] : ["PRODUCER", "TRANSPORTER"];

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({});

  // New company form
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [cf, setCf] = useState({ name: "", type: allowedGranteeTypes[0], rut: "", contactEmail: "", hasInternalFleet: false, accessLevel: "OPERATOR" });

  // Expanded company detail
  const [expandedId, setExpandedId] = useState(null);

  const msgTimer = useRef(null);
  const show = (t, k = "ok") => { setMsg({ t, k }); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(null), 4000); };
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const load = useCallback(async () => {
    if (!hubCompanyId) return;
    try {
      const [data, statsData] = await Promise.all([
        apiGetUnifiedAccess(hubCompanyId),
        apiGetLinkedStats(hubCompanyId).catch(() => ({})),
      ]);
      setRecords(data || []);
      setStats(statsData || {});
    } catch (e) { show(e.message || "Error al cargar empresas vinculadas", "err"); }
    finally { setLoading(false); }
  }, [hubCompanyId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (accessRecord) => {
    if (expandedId === accessRecord.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(accessRecord.id);
  };

  const handleToggleLevel = async (record) => {
    if (record.accessSource === "plant_producer_access") {
      show("Migrar a vinculación completa primero (usar Crear empresa)", "err");
      return;
    }
    const newLevel = record.accessLevel === "OPERATOR" ? "READONLY" : "OPERATOR";
    setSaving(true);
    try { await apiUpdateAccessLevel(record.id, newLevel); await load(); show(newLevel === "READONLY" ? "Cambiado a CONSULTA" : "Cambiado a USO"); }
    catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (record) => {
    if (record.accessSource === "plant_producer_access") {
      show("No se puede desactivar acceso legacy desde aquí", "err");
      return;
    }
    setSaving(true);
    try { await apiToggleAccess(record.id); await load(); show(record.isActive ? "Vinculación desactivada" : "Vinculación activada"); }
    catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  const handleCreateCompany = async () => {
    if (!cf.name.trim()) return show("Nombre obligatorio", "err");
    setSaving(true);
    try {
      await apiCreateLinkedCompany({
        name: cf.name.trim(), type: cf.type,
        rut: cf.rut.trim() || undefined, contactEmail: cf.contactEmail.trim() || undefined,
        hasInternalFleet: cf.type === "PRODUCER" ? cf.hasInternalFleet : false, accessLevel: cf.accessLevel,
      });
      setCf({ name: "", type: "PRODUCER", rut: "", contactEmail: "", hasInternalFleet: false, accessLevel: "OPERATOR" });
      setShowNewCompany(false); setDoneMsg("Empresa creada y vinculada"); await load();
    } catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  // Filter + group
  const searchLower = search.toLowerCase().trim();
  const activeRecords = records.filter(r => r.isActive && (!searchLower || (r.granteeCompany?.name || "").toLowerCase().includes(searchLower)));
  const inactiveRecords = records.filter(r => !r.isActive);
  const producers = activeRecords.filter(r => r.granteeType === "PRODUCER");
  const transporters = activeRecords.filter(r => r.granteeType === "TRANSPORTER");

  // Render a single company card
  const CompanyCard = ({ r }) => {
    const co = r.granteeCompany || {};
    const isExpanded = expandedId === r.id;
    const typeColor = TYPE_COLORS[r.granteeType] || C.t3;
    const companyId = r.granteeCompanyId || co.id;
    const st = stats[companyId] || {};
    const lastAgo = timeAgo(st.lastFreightAt);
    const isLegacy = r.accessSource === "plant_producer_access";
    const levelColor = r.accessLevel === "OPERATOR" ? C.ok : C.info;

    return (
      <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${typeColor}`, borderRadius: 12, boxShadow: C.sh, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => toggleExpand(r)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
              <span style={{ fontSize: 15.4, fontWeight: 700, color: C.t1 }}>{co.name || "Empresa"}</span>
              <span style={{ fontSize: 9.9, fontWeight: 700, color: typeColor, background: `${typeColor}15`, padding: "1px 6px", borderRadius: 4 }}>
                {TYPE_LABELS[r.granteeType] || r.granteeType}
              </span>
              <span style={{ fontSize: 9.9, fontWeight: 700, color: levelColor, background: `${levelColor}18`, padding: "1px 6px", borderRadius: 4 }}>
                {LEVEL_LABELS[r.accessLevel] || r.accessLevel}
              </span>
              {isLegacy && <span style={{ fontSize: 8.8, fontWeight: 600, color: C.t3, background: `${C.t3}12`, padding: "1px 5px", borderRadius: 4 }}>Legacy</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.6, color: C.t3 }}>
              {st.activeFreights > 0 ? (
                <span style={{ fontWeight: 600, color: C.pri }}>{st.activeFreights} flete{st.activeFreights > 1 ? "s" : ""}</span>
              ) : (
                <span>Sin actividad</span>
              )}
              {lastAgo && <span>Último: {lastAgo}</span>}
            </div>
          </div>
          {/* Toggle USO/CONSULTA */}
          {!isLegacy && (
            <button onClick={e => { e.stopPropagation(); handleToggleLevel(r); }} disabled={saving}
              style={{ padding: "5px 10px", borderRadius: 6, fontFamily: "inherit", fontSize: 11.6, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", border: "none", background: `${levelColor}18`, color: levelColor }}>
              {LEVEL_LABELS[r.accessLevel] || r.accessLevel}
            </button>
          )}
          <div style={{ transform: isExpanded ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
            {Ic.chev(C.t3, 18)}
          </div>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div style={{ borderTop: `1px solid ${C.b2}`, padding: "12px 14px" }}>
            {/* Company info */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12.1, color: C.t2 }}>
              {co.rut && <span>RUT: {co.rut}</span>}
              {co.phone && <span>Tel: {co.phone}</span>}
              {co.email && <span>{co.email}</span>}
              {co.hasInternalFleet && <span style={{ color: C.ok, fontWeight: 600 }}>Flota propia</span>}
              {isLegacy && <span style={{ color: C.acc, fontWeight: 600, fontSize: 11 }}>Acceso legacy (PlantProducerAccess)</span>}
            </div>

            {/* Level toggle row */}
            {!isLegacy && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", background: C.bg, borderRadius: 8 }}>
                <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t2, flex: 1 }}>Nivel de acceso:</span>
                {["OPERATOR", "READONLY"].map(l => (
                  <button key={l} onClick={() => { if (r.accessLevel !== l) handleToggleLevel(r); }} disabled={saving}
                    style={{
                      padding: "5px 12px", borderRadius: 6, fontFamily: "inherit", fontSize: 11.6, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                      border: `1.5px solid ${r.accessLevel === l ? (l === "OPERATOR" ? C.ok : C.info) : C.b1}`,
                      background: r.accessLevel === l ? (l === "OPERATOR" ? `${C.ok}12` : `${C.info}12`) : C.w,
                      color: r.accessLevel === l ? (l === "OPERATOR" ? C.ok : C.info) : C.t3,
                    }}>
                    {l === "OPERATOR" ? "USO" : "CONSULTA"}
                  </button>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {onNav && <button onClick={() => onNav("list", { filterCompany: co.name })} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.pri}30`, background: `${C.pri}08`, cursor: "pointer", fontFamily: FONT, fontSize: 11.6, fontWeight: 600, color: C.pri }}>
                {Ic.truck(C.pri, 13)} Ver fletes
              </button>}
              <button onClick={async () => {
                try {
                  const link = await apiCreateSharedLink({ linkType: "PORTAL", targetCompanyId: companyId });
                  const url = `${window.location.origin}/s/${link.token}`;
                  await navigator.clipboard.writeText(url);
                  show("Link de portal copiado");
                } catch (e) { show(e.message || "Error", "err"); }
              }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.info}30`, background: `${C.info}08`, cursor: "pointer", fontFamily: FONT, fontSize: 11.6, fontWeight: 600, color: C.info }}>
                {Ic.doc(C.info, 13)} Link de portal
              </button>
              {!isLegacy && <button onClick={() => handleToggleActive(r)} disabled={saving} style={{ background: "none", border: "none", fontSize: 11.6, color: C.err, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Desactivar vinculación
              </button>}
            </div>

          </div>
        )}
      </div>
    );
  };

  // Section header
  const SectionHeader = ({ icon, label, count, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 8 }}>
      {icon}
      <span style={{ fontSize: 14.3, fontWeight: 800, color }}>{label}</span>
      <span style={{ fontSize: 12.1, fontWeight: 600, color: C.t3 }}>({count})</span>
    </div>
  );

  return (
    <div style={{ padding: embedded ? 0 : "18px", flex: 1, overflow: "auto" }}>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}

      {!embedded && onBack && (
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.3, fontWeight: 600, color: C.pri, padding: "0 0 12px" }}>
          {Ic.chev(C.pri, 18)} Volver
        </button>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: embedded ? 17.6 : 22, fontWeight: 800, letterSpacing: -0.3 }}>Empresas vinculadas</div>
        <Btn sm onClick={() => { setShowNewCompany(!showNewCompany); setMsg(null); }} icon={showNewCompany ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>
          {showNewCompany ? "Cerrar" : "Nueva empresa"}
        </Btn>
      </div>

      {/* Search — always show when there are records */}
      {records.filter(r => r.isActive).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, background: C.bgInput || C.bg, border: `1.5px solid ${search ? C.bFocus || C.pri : C.b2}` }}>
            {Ic.srch(C.t3, 14)}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa..." style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13.2, color: C.t1, fontFamily: FONT, padding: 0 }} />
            {search && <button onClick={() => setSearch("")} style={{ display: "flex", border: "none", background: "none", cursor: "pointer", padding: 0 }}>{Ic.cross(C.t3, 12)}</button>}
          </div>
        </div>
      )}

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.2, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {/* New company form */}
      {showNewCompany && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ fontSize: 15.4, fontWeight: 700, marginBottom: 12 }}>Nueva empresa vinculada</div>
          <Field label="Nombre" value={cf.name} onChange={v => setCf(p => ({ ...p, name: v }))} placeholder="Nombre de la empresa" />
          <div style={{ height: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {allowedGranteeTypes.map(t => (
              <button key={t} onClick={() => setCf(p => ({ ...p, type: t }))} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontFamily: "inherit", fontSize: 13.2, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${cf.type === t ? TYPE_COLORS[t] : C.b1}`,
                background: cf.type === t ? `${TYPE_COLORS[t]}12` : C.w,
                color: cf.type === t ? TYPE_COLORS[t] : C.t2,
              }}>{TYPE_LABELS[t]}</button>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {["OPERATOR", "READONLY"].map(l => (
              <button key={l} onClick={() => setCf(p => ({ ...p, accessLevel: l }))} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${cf.accessLevel === l ? (l === "OPERATOR" ? C.ok : C.info) : C.b1}`,
                background: cf.accessLevel === l ? (l === "OPERATOR" ? `${C.ok}12` : `${C.info}12`) : C.w,
                color: cf.accessLevel === l ? (l === "OPERATOR" ? C.ok : C.info) : C.t3,
              }}>{l === "OPERATOR" ? "USO (opera)" : "CONSULTA (solo ve)"}</button>
            ))}
          </div>
          <div style={{ height: 10 }} />
          <Field label="RUT (opcional)" value={cf.rut} onChange={v => setCf(p => ({ ...p, rut: v }))} placeholder="Ej: 12.345.678-9" />
          <div style={{ height: 10 }} />
          <Field label="Email de contacto (opcional)" value={cf.contactEmail} onChange={v => setCf(p => ({ ...p, contactEmail: v }))} placeholder="contacto@empresa.com" />
          {cf.type === "PRODUCER" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer", fontSize: 13.2, color: C.t2 }}>
              <input type="checkbox" checked={cf.hasInternalFleet} onChange={e => setCf(p => ({ ...p, hasInternalFleet: e.target.checked }))} />
              Tiene flota propia
            </label>
          )}
          <div style={{ height: 14 }} />
          <Btn full v="acc" disabled={saving} onClick={handleCreateCompany}>{saving ? "Creando..." : "Crear y vincular"}</Btn>
        </div>
      )}

      {/* Company list — grouped */}
      {loading ? <Loader /> : activeRecords.length === 0 && !showNewCompany ? (
        <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14.3 }}>
          No hay empresas vinculadas aún. Creá una para empezar.
        </div>
      ) : (
        <div>
          {/* Productores */}
          {producers.length > 0 && (
            <>
              <SectionHeader icon={Ic.grain("#F59E0B", 18)} label="Productores" count={producers.length} color="#F59E0B" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {producers.map(r => <CompanyCard key={r.id} r={r} />)}
              </div>
            </>
          )}

          {/* Transportistas */}
          {transporters.length > 0 && (
            <>
              <SectionHeader icon={Ic.truck("#14B8A6", 18)} label="Transportistas" count={transporters.length} color="#14B8A6" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {transporters.map(r => <CompanyCard key={r.id} r={r} />)}
              </div>
            </>
          )}

          {/* Inactive */}
          {inactiveRecords.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12.1, fontWeight: 600, color: C.t3, marginBottom: 6 }}>Desactivadas ({inactiveRecords.length})</div>
              {inactiveRecords.map(r => {
                const co = r.granteeCompany || {};
                const typeColor = TYPE_COLORS[r.granteeType] || C.t3;
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.mutedPale || C.bg, borderRadius: 8, marginBottom: 6, opacity: 0.7 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13.8, fontWeight: 600, color: C.t2 }}>{co.name || "Empresa"}</span>
                      <span style={{ fontSize: 9.9, marginLeft: 8, fontWeight: 700, color: typeColor, background: `${typeColor}15`, padding: "1px 6px", borderRadius: 4 }}>{TYPE_LABELS[r.granteeType] || ""}</span>
                    </div>
                    {r.accessSource !== "plant_producer_access" && (
                      <button onClick={() => handleToggleActive(r)} disabled={saving} style={{ background: "none", border: "none", fontSize: 11.6, color: C.pri, fontWeight: 600, cursor: "pointer" }}>
                        Reactivar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
