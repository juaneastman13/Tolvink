import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { C, Ic, FONT, R } from "../theme";
import {
  apiBpsConsultarRut, apiBpsGetEmpresas, apiBpsMonitorearEmpresa,
  apiBpsQuitarEmpresa, apiBpsGetConfig, apiBpsUpdateConfig,
  apiBpsConectarCuenta, apiBpsDesconectarCuenta, apiBpsSincronizarCuenta, apiBpsGetDatosCuenta,
  apiBpsGetToken, apiBpsCrearToken, apiBpsRevocarToken, API_URL,
} from "../api";

// Consultas públicas gratuitas (sin usuario BPS) — fallback manual
const BPS_CONSULTAS_URL = "https://www.bps.gub.uy/8750/certificados-comunes-y-especiales-empresas.html";
const DGI_CERT_UNICO_URL = "https://servicios.dgi.gub.uy/serviciosenlinea/dgi--servicios-en-linea--consulta-de-certifcado-unico";

const FRECUENCIA_OPTIONS = [
  { value: "diaria", label: "Diaria", desc: "Consulta cada empresa una vez por día" },
  { value: "semanal", label: "Semanal", desc: "Consulta cada empresa una vez por semana" },
  { value: "quincenal", label: "Quincenal", desc: "Consulta cada empresa cada 15 días" },
];

const ESTADO_CFG = {
  VIGENTE: { label: "Vigente", color: C.ok, bg: C.okPale },
  NO_VIGENTE: { label: "No vigente", color: C.err, bg: C.errPale },
  EN_TRAMITE: { label: "En trámite", color: C.warn, bg: C.warnPale },
  DESCONOCIDO: { label: "Sin datos", color: C.t3, bg: C.b2 },
  // Estados de datos de cuenta autenticada
  OK: { label: "Al día", color: C.ok, bg: C.okPale },
  ATENCION: { label: "Atención", color: C.warn, bg: C.warnPale },
};

const TIPO_DATO_LABELS = {
  OBSERVACIONES: { label: "Observaciones", desc: "Trabas para la emisión del certificado" },
  OBLIGACIONES: { label: "Aportes y obligaciones", desc: "Facturas y vencimientos ante BPS" },
  NOMINA: { label: "Nómina / GAFI", desc: "Estado de las declaraciones de nómina" },
};

// RUT uruguayo: 12 dígitos, dígito verificador módulo 11
export function validarRut(rut) {
  const d = String(rut || "").replace(/\D/g, "");
  if (d.length !== 12) return false;
  const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * parseInt(d[i], 10), 0);
  const resto = suma % 11;
  const dv = resto === 0 ? 0 : 11 - resto;
  if (dv === 10) return false;
  return dv === parseInt(d[11], 10);
}

function fmtFecha(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; }
}

function EstadoChip({ estado }) {
  const cfg = ESTADO_CFG[estado] || ESTADO_CFG.DESCONOCIDO;
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "2px 9px", borderRadius: R.sm, whiteSpace: "nowrap" }}>{cfg.label}</span>;
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 800, color: C.t3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 18, marginBottom: 8, borderBottom: `2px solid ${C.b1}`, paddingBottom: 4 }}>
      {children}
    </div>
  );
}

// Panel mostrado cuando el backend aún no tiene habilitado el módulo BPS
function BackendPendiente() {
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: R.md, background: "#FFF3E8", border: `1px solid ${C.acc}30` }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Conexión con BPS pendiente de activación</div>
      <div style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5 }}>
        El servidor de Tolvink todavía no tiene habilitado el módulo de consultas a BPS.
        La especificación técnica está en <b>docs/BPS-WEB-SERVICES.md</b> del proyecto.
        Mientras tanto podés usar la consulta pública manual desde la pestaña Ayuda.
      </div>
    </div>
  );
}

export default function BpsCertificadosAssistant({ onClose }) {
  const [tab, setTab] = useState(0); // 0=consulta, 1=monitoreo, 2=cuenta, 3=ayuda

  // ── Consulta puntual ──
  const [rut, setRut] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [errConsulta, setErrConsulta] = useState("");

  // ── Monitoreo ──
  const [empresas, setEmpresas] = useState([]);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [config, setConfig] = useState(null);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [msgMonitoreo, setMsgMonitoreo] = useState(null); // { t, k }

  // ── Cuenta BPS autenticada ──
  const [cuenta, setCuenta] = useState(null); // { conectada, usuario, ultimaSync, ultimoError, datos }
  const [cargandoCuenta, setCargandoCuenta] = useState(true);
  const [cUsuario, setCUsuario] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [conectando, setConectando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [msgCuenta, setMsgCuenta] = useState(null); // { t, k }
  const [confirmDesconectar, setConfirmDesconectar] = useState(false);

  // ── Token de integración Excel ──
  const [tokenInfo, setTokenInfo] = useState(null); // { existe, createdAt }
  const [tokenNuevo, setTokenNuevo] = useState(""); // valor en claro, visible solo tras generar
  const [generandoToken, setGenerandoToken] = useState(false);

  // Módulo backend no desplegado todavía (404/501)
  const [backendPendiente, setBackendPendiente] = useState(false);

  const rutLimpio = rut.replace(/\D/g, "");
  const rutValido = validarRut(rutLimpio);

  const esBackendFaltante = (e) => e?.status === 404 || e?.status === 501;

  const cargarMonitoreo = useCallback(async () => {
    setCargandoEmpresas(true);
    try {
      const [emps, cfg] = await Promise.all([apiBpsGetEmpresas(), apiBpsGetConfig().catch(() => null)]);
      setEmpresas(emps || []);
      setConfig(cfg);
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setMsgMonitoreo({ t: e.message || "Error al cargar monitoreo", k: "err" });
    } finally {
      setCargandoEmpresas(false);
    }
  }, []);

  const cargarToken = useCallback(async () => {
    try { setTokenInfo(await apiBpsGetToken()); } catch { /* opcional: sin token info */ }
  }, []);

  async function handleGenerarToken() {
    setGenerandoToken(true); setMsgMonitoreo(null);
    try {
      const { token } = await apiBpsCrearToken();
      setTokenNuevo(token);
      setTokenInfo({ existe: true, createdAt: new Date().toISOString() });
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setMsgMonitoreo({ t: e.message || "Error al generar el token", k: "err" });
    } finally {
      setGenerandoToken(false);
    }
  }

  async function handleRevocarToken() {
    setMsgMonitoreo(null);
    try {
      await apiBpsRevocarToken();
      setTokenInfo({ existe: false }); setTokenNuevo("");
      setMsgMonitoreo({ t: "Token revocado — las planillas que lo usaban dejan de funcionar", k: "ok" });
    } catch (e) {
      setMsgMonitoreo({ t: e.message || "Error al revocar el token", k: "err" });
    }
  }

  const cargarCuenta = useCallback(async () => {
    setCargandoCuenta(true);
    try {
      setCuenta(await apiBpsGetDatosCuenta());
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
    } finally {
      setCargandoCuenta(false);
    }
  }, []);

  useEffect(() => { cargarMonitoreo(); cargarCuenta(); cargarToken(); }, [cargarMonitoreo, cargarCuenta, cargarToken]);

  async function handleConectarCuenta() {
    if (!cUsuario.trim() || !cPassword) return;
    setConectando(true); setMsgCuenta(null);
    try {
      await apiBpsConectarCuenta({ usuario: cUsuario.trim(), password: cPassword });
      setCPassword(""); setCUsuario("");
      setMsgCuenta({ t: "Cuenta BPS conectada — credenciales verificadas y guardadas cifradas", k: "ok" });
      await cargarCuenta();
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setMsgCuenta({ t: e.message || "No se pudo conectar la cuenta BPS", k: "err" });
    } finally {
      setConectando(false);
    }
  }

  async function handleSincronizar() {
    setSincronizando(true); setMsgCuenta(null);
    try {
      setCuenta(await apiBpsSincronizarCuenta());
      setMsgCuenta({ t: "Sincronización completada", k: "ok" });
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setMsgCuenta({ t: e.message || "Error al sincronizar con BPS", k: "err" });
    } finally {
      setSincronizando(false);
    }
  }

  async function handleDesconectar() {
    setConfirmDesconectar(false); setMsgCuenta(null);
    try {
      await apiBpsDesconectarCuenta();
      setCuenta({ conectada: false, datos: [] });
      setMsgCuenta({ t: "Cuenta desconectada — credenciales eliminadas del servidor", k: "ok" });
    } catch (e) {
      setMsgCuenta({ t: e.message || "Error al desconectar", k: "err" });
    }
  }

  async function handleConsultar() {
    if (!rutValido) return;
    setConsultando(true); setErrConsulta(""); setResultado(null);
    try {
      const r = await apiBpsConsultarRut(rutLimpio);
      setResultado(r);
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setErrConsulta(e.message || "Error al consultar BPS");
    } finally {
      setConsultando(false);
    }
  }

  async function handleMonitorear() {
    if (!resultado?.rut) return;
    try {
      await apiBpsMonitorearEmpresa({ rut: resultado.rut, nombre: resultado.razonSocial || undefined });
      setMsgMonitoreo({ t: "Empresa agregada al monitoreo automático", k: "ok" });
      setTab(1);
      await cargarMonitoreo();
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setErrConsulta(e.message || "Error al agregar al monitoreo");
    }
  }

  async function handleQuitar(id) {
    try {
      await apiBpsQuitarEmpresa(id);
      setEmpresas(prev => prev.filter(x => x.id !== id));
      setMsgMonitoreo({ t: "Empresa quitada del monitoreo", k: "ok" });
    } catch (e) {
      setMsgMonitoreo({ t: e.message || "Error al quitar empresa", k: "err" });
    }
  }

  async function handleFrecuencia(frecuencia) {
    setGuardandoConfig(true);
    try {
      const cfg = await apiBpsUpdateConfig({ frecuencia });
      setConfig(cfg || { ...(config || {}), frecuencia });
    } catch (e) {
      if (esBackendFaltante(e)) setBackendPendiente(true);
      else setMsgMonitoreo({ t: e.message || "Error al guardar configuración", k: "err" });
    } finally {
      setGuardandoConfig(false);
    }
  }

  const lbl = { fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 4 };
  const inp = { width: "100%", padding: "9px 11px", borderRadius: R.md, border: `1px solid ${C.b1}`, background: C.w, fontSize: 14, color: C.t1, fontFamily: FONT, boxSizing: "border-box", outline: "none" };
  const tabStyle = (active) => ({
    flex: 1, padding: "8px 4px", fontSize: 13, fontWeight: 700, color: active ? C.pri : C.t3,
    background: "none", border: "none", borderBottom: `2px solid ${active ? C.pri : "transparent"}`,
    cursor: "pointer", fontFamily: FONT, textAlign: "center",
  });
  const linkBtn = (bg) => ({ width: "100%", marginTop: 8, padding: "11px 0", borderRadius: R.md, background: bg, color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 });
  const extIcon = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.w, borderRadius: R.lg, width: "min(520px,96vw)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: C.shLg, fontFamily: FONT }}>

        {/* Header */}
        <div style={{ padding: "14px 16px 0", borderBottom: `1px solid ${C.b1}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex" }}>{Ic.shield(C.pri, 20)}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, lineHeight: 1.2 }}>Certificados BPS</div>
                <div style={{ fontSize: 12, color: C.t3 }}>Consulta de vigencia de certificado común</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{Ic.cross(C.t3, 18)}</button>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            <button style={tabStyle(tab === 0)} onClick={() => setTab(0)}>Consulta</button>
            <button style={tabStyle(tab === 1)} onClick={() => setTab(1)}>Monitoreo{empresas.length ? ` (${empresas.length})` : ""}</button>
            <button style={tabStyle(tab === 2)} onClick={() => setTab(2)}>{cuenta?.conectada ? "✓ Cuenta BPS" : "Cuenta BPS"}</button>
            <button style={tabStyle(tab === 3)} onClick={() => setTab(3)}>Ayuda</button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>

          {/* ---- Tab 0: Consulta puntual ---- */}
          {tab === 0 && <>
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, background: C.priGhost, border: `1px solid ${C.pri}30`, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
              Verificá si una empresa (transportista, productor o planta) tiene el certificado común de BPS vigente. Solo necesitás el RUT.
            </div>

            <SectionTitle>RUT de la empresa</SectionTitle>
            <div style={lbl}>RUT (12 dígitos)</div>
            <input
              style={{ ...inp, borderColor: rutLimpio.length === 12 && !rutValido ? C.err : C.b1 }}
              value={rut}
              onChange={e => { setRut(e.target.value); setResultado(null); setErrConsulta(""); }}
              onKeyDown={e => { if (e.key === "Enter" && rutValido && !consultando) handleConsultar(); }}
              placeholder="Ej: 211234567890"
              inputMode="numeric"
            />
            {rutLimpio.length === 12 && !rutValido && (
              <div style={{ fontSize: 12, color: C.err, marginTop: 4 }}>El dígito verificador del RUT no es válido.</div>
            )}

            <button
              disabled={!rutValido || consultando}
              onClick={handleConsultar}
              style={{ width: "100%", marginTop: 12, padding: "11px 0", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: (!rutValido || consultando) ? "not-allowed" : "pointer", fontFamily: FONT, opacity: (!rutValido || consultando) ? 0.6 : 1 }}
            >
              {consultando ? "Consultando BPS..." : "Consultar en BPS"}
            </button>

            {errConsulta && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: R.md, background: C.errPale, color: C.err, fontSize: 13, fontWeight: 600 }}>{errConsulta}</div>
            )}

            {backendPendiente && <BackendPendiente />}

            {resultado && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: R.md, background: (ESTADO_CFG[resultado.estado] || ESTADO_CFG.DESCONOCIDO).bg, border: `1px solid ${(ESTADO_CFG[resultado.estado] || ESTADO_CFG.DESCONOCIDO).color}30` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.t1 }}>{resultado.razonSocial || `RUT ${resultado.rut}`}</div>
                  <EstadoChip estado={resultado.estado} />
                </div>
                <div style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.6 }}>
                  <div>RUT: <b>{resultado.rut}</b></div>
                  {resultado.vigenteHasta && <div>Vigente hasta: <b>{fmtFecha(resultado.vigenteHasta)}</b></div>}
                  <div>Consultado: {fmtFecha(resultado.consultadoEn)} {resultado.fuente ? `· Fuente: ${resultado.fuente}` : ""}</div>
                </div>
                <button onClick={handleMonitorear} style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  + Agregar al monitoreo automático
                </button>
              </div>
            )}
          </>}

          {/* ---- Tab 1: Monitoreo automático ---- */}
          {tab === 1 && <>
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, background: C.priGhost, border: `1px solid ${C.pri}30`, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
              Tolvink consulta BPS automáticamente para cada empresa monitoreada y te avisa si un certificado deja de estar vigente o está por vencer.
            </div>

            {msgMonitoreo && (
              <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, fontSize: 12.5, fontWeight: 600, background: msgMonitoreo.k === "ok" ? C.okPale : C.errPale, color: msgMonitoreo.k === "ok" ? C.ok : C.err }}>{msgMonitoreo.t}</div>
            )}

            {backendPendiente && <BackendPendiente />}

            {!backendPendiente && <>
              <SectionTitle>Empresas monitoreadas</SectionTitle>
              {cargandoEmpresas && <div style={{ fontSize: 13, color: C.t3, padding: "8px 0" }}>Cargando...</div>}
              {!cargandoEmpresas && empresas.length === 0 && (
                <div style={{ fontSize: 13, color: C.t3, padding: "8px 0", lineHeight: 1.5 }}>
                  Todavía no hay empresas en monitoreo. Consultá un RUT en la primera pestaña y agregalo desde el resultado.
                </div>
              )}
              {empresas.map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.b2}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.nombre || `RUT ${e.rut}`}</div>
                    <div style={{ fontSize: 11.5, color: C.t3 }}>
                      RUT {e.rut} · Última consulta: {fmtFecha(e.ultimaConsulta)}
                      {e.vigenteHasta ? ` · Vence: ${fmtFecha(e.vigenteHasta)}` : ""}
                    </div>
                  </div>
                  <EstadoChip estado={e.estado} />
                  <button onClick={() => handleQuitar(e.id)} title="Quitar del monitoreo" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>{Ic.cross(C.t3, 14)}</button>
                </div>
              ))}

              <SectionTitle>Frecuencia de consulta automática</SectionTitle>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                {FRECUENCIA_OPTIONS.map(opt => {
                  const active = (config?.frecuencia || "diaria") === opt.value;
                  return (
                    <button key={opt.value} disabled={guardandoConfig} onClick={() => handleFrecuencia(opt.value)} title={opt.desc} style={{ flex: 1, padding: "10px 0", borderRadius: R.md, border: `1.5px solid ${active ? C.pri : C.b1}`, background: active ? C.priGhost : C.w, color: active ? C.pri : C.t2, fontSize: 13.5, fontWeight: 700, cursor: guardandoConfig ? "wait" : "pointer", fontFamily: FONT }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: C.t3 }}>
                Las consultas se ejecutan en el servidor de Tolvink. Si un certificado pasa a no vigente, se genera una alerta de flota y una notificación.
              </div>

              <SectionTitle>Conexión con Excel</SectionTitle>
              <div style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5, marginBottom: 8 }}>
                Generá un <b>token de solo lectura</b> para que cualquier persona — incluso sin usuario Tolvink — consulte estos estados desde una planilla Excel.
              </div>

              {tokenNuevo ? (
                <div style={{ padding: "10px 12px", borderRadius: R.md, background: C.warnPale, border: `1px solid ${C.warn}30`, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.warn, marginBottom: 4 }}>Copiá el token ahora — no se vuelve a mostrar</div>
                  <input readOnly value={tokenNuevo} onFocus={e => e.target.select()} style={{ ...inp, fontSize: 12.5, fontFamily: "monospace", marginBottom: 8 }} />
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 2 }}>Tabla completa (Power Query / Datos → Desde web):</div>
                  <input readOnly value={`${API_URL}/bps/excel/empresas?format=csv&token=${tokenNuevo}`} onFocus={e => e.target.select()} style={{ ...inp, fontSize: 11.5, fontFamily: "monospace", marginBottom: 6 }} />
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 2 }}>Estado de un RUT (fórmula =SERVICIOWEB):</div>
                  <input readOnly value={`${API_URL}/bps/excel/vigencia?rut=RUT_AQUI&token=${tokenNuevo}`} onFocus={e => e.target.select()} style={{ ...inp, fontSize: 11.5, fontFamily: "monospace" }} />
                </div>
              ) : tokenInfo?.existe ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: R.md, background: C.bg, marginBottom: 8 }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: C.t2 }}>Token activo desde {fmtFecha(tokenInfo.createdAt)} · el valor solo se muestra al generarlo</div>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={generandoToken} onClick={handleGenerarToken} style={{ flex: 1, padding: "9px 0", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 12.5, fontWeight: 700, cursor: generandoToken ? "wait" : "pointer", fontFamily: FONT }}>
                  {generandoToken ? "Generando..." : tokenInfo?.existe ? "Regenerar token" : "Generar token"}
                </button>
                {tokenInfo?.existe && (
                  <button onClick={handleRevocarToken} style={{ padding: "9px 14px", borderRadius: R.md, background: "none", border: `1px solid ${C.err}`, color: C.err, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    Revocar
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: C.t3, marginTop: 6, lineHeight: 1.5 }}>
                El token solo permite leer estados de certificados (nunca credenciales ni otros datos). Regenerarlo o revocarlo invalida las planillas anteriores.
              </div>
            </>}
          </>}

          {/* ---- Tab 2: Cuenta BPS autenticada ---- */}
          {tab === 2 && <>
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, background: C.priGhost, border: `1px solid ${C.pri}30`, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
              Conectá el usuario BPS de tu empresa para que Tolvink consulte automáticamente observaciones, aportes y nómina, además del certificado.
            </div>

            {msgCuenta && (
              <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: R.md, fontSize: 12.5, fontWeight: 600, background: msgCuenta.k === "ok" ? C.okPale : C.errPale, color: msgCuenta.k === "ok" ? C.ok : C.err }}>{msgCuenta.t}</div>
            )}

            {backendPendiente && <BackendPendiente />}

            {!backendPendiente && cargandoCuenta && <div style={{ fontSize: 13, color: C.t3, padding: "12px 0" }}>Cargando...</div>}

            {/* Sin cuenta conectada: formulario */}
            {!backendPendiente && !cargandoCuenta && !cuenta?.conectada && <>
              <SectionTitle>Conectar usuario BPS</SectionTitle>
              <div style={{ marginBottom: 10 }}>
                <div style={lbl}>Usuario BPS (usuario directo, no ID Uruguay)</div>
                <input style={inp} value={cUsuario} onChange={e => setCUsuario(e.target.value)} placeholder="Usuario de Servicios en Línea BPS" autoComplete="off" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={lbl}>Contraseña</div>
                <input style={inp} type="password" value={cPassword} onChange={e => setCPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password"
                  onKeyDown={e => { if (e.key === "Enter" && cUsuario.trim() && cPassword && !conectando) handleConectarCuenta(); }} />
              </div>
              <div style={{ padding: "9px 12px", borderRadius: R.md, background: C.b2, fontSize: 12, color: C.t3, lineHeight: 1.5, marginBottom: 10 }}>
                Las credenciales se verifican contra BPS antes de guardarse, viajan solo por HTTPS y se almacenan <b>cifradas</b> en el servidor de Tolvink. Se usan únicamente para estas consultas y podés eliminarlas cuando quieras con "Desconectar".
              </div>
              <button disabled={!cUsuario.trim() || !cPassword || conectando} onClick={handleConectarCuenta}
                style={{ width: "100%", padding: "11px 0", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 14, fontWeight: 700, cursor: (!cUsuario.trim() || !cPassword || conectando) ? "not-allowed" : "pointer", fontFamily: FONT, opacity: (!cUsuario.trim() || !cPassword || conectando) ? 0.6 : 1 }}>
                {conectando ? "Verificando con BPS..." : "Conectar y probar"}
              </button>
            </>}

            {/* Cuenta conectada: estado + datos */}
            {!backendPendiente && !cargandoCuenta && cuenta?.conectada && <>
              <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: R.md, background: C.okPale, border: `1px solid ${C.ok}30`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ok }}>Cuenta conectada · {cuenta.usuario}</div>
                  <div style={{ fontSize: 11.5, color: C.t3 }}>Última sincronización: {fmtFecha(cuenta.ultimaSync)}</div>
                </div>
                <button onClick={handleSincronizar} disabled={sincronizando} style={{ padding: "8px 12px", borderRadius: R.md, background: C.pri, color: C.w, border: "none", fontSize: 12.5, fontWeight: 700, cursor: sincronizando ? "wait" : "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
                  {sincronizando ? "Sincronizando..." : "Sincronizar ahora"}
                </button>
              </div>
              {cuenta.ultimoError && (
                <div style={{ marginTop: 8, padding: "9px 12px", borderRadius: R.md, background: C.warnPale, color: C.warn, fontSize: 12.5, fontWeight: 600 }}>
                  Último error de sincronización: {cuenta.ultimoError}
                </div>
              )}

              <SectionTitle>Consultas automáticas</SectionTitle>
              {Object.entries(TIPO_DATO_LABELS).map(([tipo, cfg]) => {
                const dato = (cuenta.datos || []).find(d => d.tipo === tipo);
                return (
                  <div key={tipo} style={{ padding: "10px 0", borderBottom: `1px solid ${C.b2}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{cfg.label}</div>
                      <EstadoChip estado={dato?.estado || "DESCONOCIDO"} />
                    </div>
                    <div style={{ fontSize: 12, color: C.t3 }}>{cfg.desc}</div>
                    {dato && <div style={{ fontSize: 12.5, color: C.t2, marginTop: 4 }}>{dato.resumen || "—"} · {fmtFecha(dato.obtenidoEn)}</div>}
                    {!dato && <div style={{ fontSize: 12.5, color: C.t3, marginTop: 4 }}>Todavía sin datos — sincronizá para obtenerlos.</div>}
                    {dato?.detalle?.items?.length > 0 && (
                      <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: R.sm, background: C.bg, fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
                        {dato.detalle.items.slice(0, 5).map((it, i) => <div key={i}>• {it}</div>)}
                        {dato.detalle.items.length > 5 && <div style={{ color: C.t3 }}>… y {dato.detalle.items.length - 5} más en el portal BPS</div>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: C.t3, marginTop: 8 }}>
                Estas consultas se repiten automáticamente cada día en el servidor. Si algo pasa a "Atención" recibís una notificación.
              </div>

              <SectionTitle>Desconectar</SectionTitle>
              {!confirmDesconectar ? (
                <button onClick={() => setConfirmDesconectar(true)} style={{ width: "100%", padding: "10px 0", background: "none", border: `1px solid ${C.err}`, borderRadius: R.md, color: C.err, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                  Desconectar cuenta BPS
                </button>
              ) : (
                <div style={{ padding: 14, background: C.errPale, borderRadius: R.md, border: `1px solid ${C.err}20` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.err, marginBottom: 6 }}>¿Desconectar la cuenta?</div>
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>Se eliminan las credenciales cifradas y el historial de consultas autenticadas del servidor.</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setConfirmDesconectar(false)} style={{ flex: 1, padding: "8px 0", background: C.w, border: `1px solid ${C.b1}`, borderRadius: R.md, cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.t2 }}>Cancelar</button>
                    <button onClick={handleDesconectar} style={{ flex: 1, padding: "8px 0", background: C.err, border: "none", borderRadius: R.md, cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.w }}>Confirmar</button>
                  </div>
                </div>
              )}
            </>}
          </>}

          {/* ---- Tab 3: Ayuda ---- */}
          {tab === 3 && <>
            <SectionTitle>¿Qué consulta Tolvink en BPS?</SectionTitle>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
              BPS ofrece una consulta pública y gratuita para verificar si un contribuyente tiene el <b>certificado común vigente</b>, ingresando solamente el RUT.
              Tolvink usa ese servicio desde el servidor para automatizar la verificación de transportistas y productores, sin necesidad de usuario BPS.
            </div>

            <SectionTitle>Consulta manual (sin Tolvink)</SectionTitle>
            <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, marginBottom: 4 }}>
              También podés verificar certificados directamente en los portales oficiales:
            </div>
            <button onClick={() => window.open(BPS_CONSULTAS_URL, "_blank", "noopener")} style={linkBtn("#1565C0")}>
              {extIcon} Consultas de certificados BPS
            </button>
            <button onClick={() => window.open(DGI_CERT_UNICO_URL, "_blank", "noopener")} style={linkBtn("#2E7D32")}>
              {extIcon} Certificado único DGI
            </button>

            <SectionTitle>Servicios con usuario BPS</SectionTitle>
            <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
              Con el <b>usuario BPS de tu empresa</b> conectado (pestaña "Cuenta BPS"), Tolvink también consulta automáticamente observaciones, aportes/obligaciones y estado de nómina.
              Las credenciales se guardan cifradas en el servidor y solo se usan para estas consultas. Si tu empresa aún no tiene usuario BPS, se tramita en el portal de BPS (Servicios en línea → Registrarse).
            </div>

            <SectionTitle>Documentación técnica</SectionTitle>
            <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5 }}>
              El contrato de la API y la guía de activación del módulo en el servidor están en <b>docs/BPS-WEB-SERVICES.md</b> dentro del repositorio del proyecto.
            </div>
          </>}
        </div>
      </div>
    </div>,
    document.body
  );
}
