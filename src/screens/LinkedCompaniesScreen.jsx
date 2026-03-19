import { useState, useEffect, useCallback, useRef } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, Loader, LoadingOverlay, ModalOverlay } from "../components";
import { Select } from "../components/form";
import {
  apiGetCompanyAccess, apiUpdateAccessLevel, apiToggleAccess,
  apiCreateLinkedCompany, apiCreateLinkedUser, apiAdminListUsers,
} from "../api";

// =====================================================================
// TOLVINK — LinkedCompaniesScreen
// Plant-centric: manage linked companies (producers/transporters),
// their access levels (USO/CONSULTA), and create users for them.
// =====================================================================

const TYPE_COLORS = { PRODUCER: "#F59E0B", TRANSPORTER: "#14B8A6" };
const TYPE_LABELS = { PRODUCER: "Productor", TRANSPORTER: "Transportista" };
const LEVEL_LABELS = { OPERATOR: "USO", READONLY: "CONSULTA" };
const ROLE_LABELS = { gerente: "Gerente", operario: "Operario", chofer: "Chofer" };

export default function LinkedCompaniesScreen({ user, embedded }) {
  const plantCompanyId = user?.activeCompanyId;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  // New company form
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [cf, setCf] = useState({ name: "", type: "PRODUCER", rut: "", contactEmail: "", hasInternalFleet: false, accessLevel: "OPERATOR" });

  // Expanded company detail
  const [expandedId, setExpandedId] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // New user form (inside expanded company)
  const [showNewUser, setShowNewUser] = useState(false);
  const [uf, setUf] = useState({ name: "", phone: "", email: "", role: "operario" });

  const msgTimer = useRef(null);
  const show = (t, k = "ok") => { setMsg({ t, k }); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(null), 4000); };
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const load = useCallback(async () => {
    if (!plantCompanyId) return;
    try {
      const data = await apiGetCompanyAccess(plantCompanyId);
      setRecords(data || []);
    } catch (e) { show(e.message || "Error al cargar empresas vinculadas", "err"); }
    finally { setLoading(false); }
  }, [plantCompanyId]);

  useEffect(() => { load(); }, [load]);

  // Load users when expanding a company
  const toggleExpand = async (accessRecord) => {
    const companyId = accessRecord.granteeCompanyId || accessRecord.granteeCompany?.id;
    if (expandedId === accessRecord.id) {
      setExpandedId(null);
      setCompanyUsers([]);
      setShowNewUser(false);
      return;
    }
    setExpandedId(accessRecord.id);
    setShowNewUser(false);
    setLoadingUsers(true);
    try {
      const users = await apiAdminListUsers(undefined, companyId);
      setCompanyUsers(users || []);
    } catch { setCompanyUsers([]); }
    finally { setLoadingUsers(false); }
  };

  // Toggle CONSULTA / USO
  const handleToggleLevel = async (record) => {
    const newLevel = record.accessLevel === "OPERATOR" ? "READONLY" : "OPERATOR";
    setSaving(true);
    try {
      await apiUpdateAccessLevel(record.id, newLevel);
      await load();
      show(newLevel === "READONLY" ? "Cambiado a CONSULTA" : "Cambiado a USO");
    } catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  // Toggle active/inactive
  const handleToggleActive = async (record) => {
    setSaving(true);
    try {
      await apiToggleAccess(record.id);
      await load();
      show(record.isActive ? "Vinculación desactivada" : "Vinculación activada");
    } catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  // Create linked company
  const handleCreateCompany = async () => {
    if (!cf.name.trim()) return show("Nombre obligatorio", "err");
    setSaving(true);
    try {
      await apiCreateLinkedCompany({
        name: cf.name.trim(),
        type: cf.type,
        rut: cf.rut.trim() || undefined,
        contactEmail: cf.contactEmail.trim() || undefined,
        hasInternalFleet: cf.type === "PRODUCER" ? cf.hasInternalFleet : false,
        accessLevel: cf.accessLevel,
      });
      setCf({ name: "", type: "PRODUCER", rut: "", contactEmail: "", hasInternalFleet: false, accessLevel: "OPERATOR" });
      setShowNewCompany(false);
      setDoneMsg("Empresa creada y vinculada");
      await load();
    } catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  // Create user for linked company
  const handleCreateUser = async (targetCompanyId) => {
    if (!uf.name.trim()) return show("Nombre obligatorio", "err");
    setSaving(true);
    try {
      await apiCreateLinkedUser({
        targetCompanyId,
        name: uf.name.trim(),
        phone: uf.phone.trim() || undefined,
        email: uf.email.trim() || undefined,
        role: uf.role,
      });
      setUf({ name: "", phone: "", email: "", role: "operario" });
      setShowNewUser(false);
      setDoneMsg("Usuario creado");
      // Reload users for this company
      const users = await apiAdminListUsers(undefined, targetCompanyId);
      setCompanyUsers(users || []);
    } catch (e) { show(e.message, "err"); }
    finally { setSaving(false); }
  };

  const activeRecords = records.filter(r => r.isActive);
  const inactiveRecords = records.filter(r => !r.isActive);

  return (
    <div style={{ padding: embedded ? 0 : "0 18px 18px" }}>
      {(saving || doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={() => setDoneMsg("")} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: embedded ? 17.6 : 22, fontWeight: 800, letterSpacing: -0.3 }}>Empresas vinculadas</div>
        <Btn sm onClick={() => { setShowNewCompany(!showNewCompany); setMsg(null); }} icon={showNewCompany ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>
          {showNewCompany ? "Cerrar" : "Nueva empresa"}
        </Btn>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.2, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {/* New company form */}
      {showNewCompany && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ fontSize: 15.4, fontWeight: 700, marginBottom: 12 }}>Nueva empresa vinculada</div>
          <Field label="Nombre" value={cf.name} onChange={v => setCf(p => ({ ...p, name: v }))} placeholder="Nombre de la empresa" />
          <div style={{ height: 10 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {["PRODUCER", "TRANSPORTER"].map(t => (
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

      {/* Company list */}
      {loading ? <Loader /> : activeRecords.length === 0 && !showNewCompany ? (
        <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 14.3 }}>
          No hay empresas vinculadas aún. Creá una para empezar.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeRecords.map(r => {
            const co = r.granteeCompany || {};
            const isExpanded = expandedId === r.id;
            const typeColor = TYPE_COLORS[r.granteeType] || C.t3;
            const companyId = r.granteeCompanyId || co.id;
            return (
              <div key={r.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${typeColor}`, borderRadius: 12, boxShadow: C.sh, overflow: "hidden" }}>
                {/* Company row */}
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => toggleExpand(r)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15.4, fontWeight: 700, color: C.t1 }}>{co.name || "Empresa"}</span>
                      <span style={{ fontSize: 9.9, fontWeight: 700, color: typeColor, background: `${typeColor}15`, padding: "1px 6px", borderRadius: 4 }}>
                        {TYPE_LABELS[r.granteeType] || r.granteeType}
                      </span>
                    </div>
                    {co.email && <div style={{ fontSize: 11.6, color: C.t3 }}>{co.email}</div>}
                  </div>
                  {/* USO / CONSULTA toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleLevel(r); }}
                    disabled={saving}
                    style={{
                      padding: "5px 10px", borderRadius: 6, fontFamily: "inherit", fontSize: 11.6, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                      border: "none",
                      background: r.accessLevel === "OPERATOR" ? `${C.ok}18` : `${C.info}18`,
                      color: r.accessLevel === "OPERATOR" ? C.ok : C.info,
                    }}
                  >
                    {LEVEL_LABELS[r.accessLevel] || r.accessLevel}
                  </button>
                  {/* Expand chevron */}
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
                      {co.hasInternalFleet && <span style={{ color: C.ok, fontWeight: 600 }}>Flota propia</span>}
                    </div>

                    {/* Deactivate link */}
                    <button onClick={() => handleToggleActive(r)} disabled={saving} style={{ background: "none", border: "none", fontSize: 11.6, color: C.err, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14 }}>
                      Desactivar vinculación
                    </button>

                    {/* Users section */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 4 }}>
                      <div style={{ fontSize: 13.8, fontWeight: 700, color: C.t1 }}>Usuarios</div>
                      <button onClick={() => { setShowNewUser(!showNewUser); setUf({ name: "", phone: "", email: "", role: "operario" }); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, color: C.pri }}>
                        {showNewUser ? "Cancelar" : "+ Crear usuario"}
                      </button>
                    </div>

                    {/* New user form */}
                    {showNewUser && (
                      <div style={{ background: C.bg, border: `1px solid ${C.b2}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                        <Field label="Nombre" value={uf.name} onChange={v => setUf(p => ({ ...p, name: v }))} placeholder="Nombre completo" />
                        <div style={{ height: 8 }} />
                        <Field label="Teléfono" value={uf.phone} onChange={v => setUf(p => ({ ...p, phone: v }))} placeholder="09X XXX XXX" />
                        <div style={{ height: 8 }} />
                        <Field label="Email (opcional)" value={uf.email} onChange={v => setUf(p => ({ ...p, email: v }))} placeholder="usuario@email.com" />
                        <div style={{ height: 8 }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          {["gerente", "operario", "chofer"].map(r => (
                            <button key={r} onClick={() => setUf(p => ({ ...p, role: r }))} style={{
                              flex: 1, padding: "7px 0", borderRadius: 6, fontFamily: "inherit", fontSize: 12.1, fontWeight: 600, cursor: "pointer",
                              border: `1.5px solid ${uf.role === r ? C.pri : C.b1}`,
                              background: uf.role === r ? `${C.pri}12` : C.w,
                              color: uf.role === r ? C.pri : C.t3,
                            }}>{ROLE_LABELS[r]}</button>
                          ))}
                        </div>
                        <div style={{ height: 10 }} />
                        <Btn full v="acc" disabled={saving} onClick={() => handleCreateUser(companyId)}>
                          {saving ? "Creando..." : "Crear usuario"}
                        </Btn>
                      </div>
                    )}

                    {/* Users list */}
                    {loadingUsers ? <Loader /> : companyUsers.length === 0 ? (
                      <div style={{ fontSize: 12.1, color: C.t3, textAlign: "center", padding: 16 }}>Sin usuarios registrados</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {companyUsers.map(u => (
                          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.bg, borderRadius: 8 }}>
                            {Ic.user(C.t2, 16)}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13.2, fontWeight: 600, color: C.t1 }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: C.t3 }}>
                                {u.phone || u.email || ""}
                                {u.role && <span style={{ marginLeft: 6, fontWeight: 600, color: C.t2 }}>{ROLE_LABELS[u.role] || u.role}</span>}
                              </div>
                            </div>
                            {!u.active && <span style={{ fontSize: 9.9, fontWeight: 700, color: C.err, background: C.errPale, padding: "1px 6px", borderRadius: 4 }}>Inactivo</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Inactive companies */}
          {inactiveRecords.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12.1, fontWeight: 600, color: C.t3, marginBottom: 6 }}>Desactivadas ({inactiveRecords.length})</div>
              {inactiveRecords.map(r => {
                const co = r.granteeCompany || {};
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.mutedPale, borderRadius: 8, marginBottom: 6, opacity: 0.7 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13.8, fontWeight: 600, color: C.t2 }}>{co.name || "Empresa"}</span>
                      <span style={{ fontSize: 9.9, marginLeft: 8, color: C.t3 }}>{TYPE_LABELS[r.granteeType] || ""}</span>
                    </div>
                    <button onClick={() => handleToggleActive(r)} disabled={saving} style={{ background: "none", border: "none", fontSize: 11.6, color: C.pri, fontWeight: 600, cursor: "pointer" }}>
                      Reactivar
                    </button>
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
