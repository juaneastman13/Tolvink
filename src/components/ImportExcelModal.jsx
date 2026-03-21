import { useState, useRef, useCallback } from "react";
import { C, Ic, R } from "../theme";
import { typeLabels } from "../utils/freight-helpers";

const TYPE_MAP = { planta: "plant", productor: "producer", transportista: "transporter" };
const TYPE_MAP_REVERSE = { plant: "Planta", producer: "Productor", transporter: "Transportista" };
const VALID_ROLES = ["operario", "gerente", "chofer"];
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCompanyRows(rows, existingCompanies) {
  const nameSet = new Set(existingCompanies.map(c => c.name.toLowerCase()));
  const rutSet = new Set(existingCompanies.filter(c => c.rut).map(c => c.rut.toLowerCase()));
  const emailSet = new Set(existingCompanies.filter(c => c.email).map(c => c.email.toLowerCase()));

  return rows.map((r, i) => {
    const errors = [];
    const warnings = [];
    let duplicate = false;
    const name = r.name?.toString().trim();

    if (!name) { errors.push("Nombre requerido"); }
    else if (nameSet.has(name.toLowerCase())) { duplicate = true; }

    const rawType = r.type?.toString().trim().toLowerCase();
    if (!rawType || !TYPE_MAP[rawType]) errors.push(`Tipo inválido: ${r.type || "(vacío)"}`);
    if (r.email && !emailRe.test(r.email)) errors.push("Email inválido");

    // Partial matches (only if not already a full duplicate)
    if (!duplicate && name) {
      if (r.rut && rutSet.has(r.rut.toString().trim().toLowerCase()))
        warnings.push("RUT coincide con empresa existente");
      if (r.email && emailSet.has(r.email.toString().trim().toLowerCase()))
        warnings.push("Email coincide con empresa existente");
    }

    return { ...r, _row: i + 1, _errors: errors, _warnings: warnings, _valid: errors.length === 0, _duplicate: duplicate, _include: !duplicate && errors.length === 0 };
  });
}

function validateUserRows(rows, existingCompanies, existingUsers) {
  const emailSet = new Set(existingUsers.filter(u => u.email).map(u => u.email.toLowerCase()));
  const phoneSet = new Set(existingUsers.filter(u => u.phone).map(u => u.phone));
  const nameSet = new Set(existingUsers.map(u => u.name.toLowerCase()));
  const companyMap = new Map(existingCompanies.map(c => [c.name.toLowerCase(), c]));

  return rows.map((r, i) => {
    const errors = [];
    const warnings = [];
    let duplicate = false;
    const name = r.name?.toString().trim();
    const email = r.email?.toString().trim().toLowerCase();
    const password = r.password?.toString().trim();
    const companyName = r.companyName?.toString().trim();
    const role = r.role?.toString().trim().toLowerCase();

    if (!name) errors.push("Nombre requerido");
    if (!email) errors.push("Email requerido");
    else if (!emailRe.test(email)) errors.push("Email inválido");
    else if (emailSet.has(email)) { duplicate = true; }

    if (!password || password.length < 6) errors.push("Contraseña mín 6 caracteres");
    if (!companyName) errors.push("Empresa requerida");
    else if (!companyMap.has(companyName.toLowerCase())) errors.push(`Empresa no encontrada: ${companyName}`);
    if (!role || !VALID_ROLES.includes(role)) errors.push(`Rol inválido: ${r.role || "(vacío)"}`);

    // Partial matches
    if (!duplicate && name && email) {
      if (r.phone && phoneSet.has(r.phone.toString().trim()))
        warnings.push("Teléfono coincide con usuario existente");
      if (name && nameSet.has(name.toLowerCase()))
        warnings.push("Nombre coincide con usuario existente");
    }

    return { ...r, _row: i + 1, _errors: errors, _warnings: warnings, _valid: errors.length === 0, _duplicate: duplicate, _include: !duplicate && errors.length === 0 };
  });
}

function mapExcelRow(row, type) {
  if (type === "companies") {
    const rawType = row["TIPO"]?.toString().trim().toLowerCase();
    return {
      name: row["NOMBRE"]?.toString().trim() || "",
      type: rawType || "",
      email: row["EMAIL"]?.toString().trim() || null,
      phone: (row["TELEFONO"] ?? row["TELÉFONO"])?.toString().trim() || null,
      rut: row["RUT"]?.toString().trim() || null,
      hasInternalFleet: (row["FLOTA PROPIA"] ?? "").toString().trim().toUpperCase() === "SI",
    };
  }
  return {
    name: row["NOMBRE"]?.toString().trim() || "",
    email: row["EMAIL"]?.toString().trim() || "",
    phone: (row["TELEFONO"] ?? row["TELÉFONO"])?.toString().trim() || null,
    password: (row["CONTRASEÑA"] ?? row["CONTRASENA"] ?? row["PASSWORD"])?.toString().trim() || "",
    companyName: row["EMPRESA"]?.toString().trim() || "",
    role: row["ROL"]?.toString().trim().toLowerCase() || "",
  };
}

export default function ImportExcelModal({ mode, onClose, onImport, existingCompanies, existingUsers }) {
  const [step, setStep] = useState("upload"); // upload | preview
  const [rows, setRows] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState(null);
  const fileRef = useRef(null);

  const isCompanies = mode === "companies";
  const label = isCompanies ? "Empresas" : "Usuarios";
  const sheetName = isCompanies ? "EMPRESA" : "USUARIOS";

  const processFile = useCallback(async (file) => {
    setParseError(null);
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setParseError("Formato inválido. Solo se aceptan archivos .xlsx");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[sheetName];
      if (!sheet) { setParseError(`No se encontró la pestaña "${sheetName}" en el archivo`); return; }
      const raw = XLSX.utils.sheet_to_json(sheet);
      if (raw.length === 0) { setParseError("No se encontraron datos en la pestaña"); return; }
      const mapped = raw.map(r => mapExcelRow(r, mode));
      const validated = isCompanies
        ? validateCompanyRows(mapped, existingCompanies)
        : validateUserRows(mapped, existingCompanies, existingUsers);
      setRows(validated);
      setStep("preview");
    } catch {
      setParseError("Error al leer el archivo. Verificá que sea un Excel válido.");
    }
  }, [sheetName, mode, isCompanies, existingCompanies, existingUsers]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const toggleRow = (idx) => {
    setRows(prev => prev.map((r, i) => i === idx && !r._duplicate && r._valid ? { ...r, _include: !r._include } : r));
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => r._include);
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const payload = toImport.map(({ _row, _errors, _warnings, _valid, _duplicate, _include, ...rest }) => rest);
      const res = await onImport(payload);
      setResult(res);
    } catch (e) {
      setResult({ imported: 0, errors: [{ row: 0, error: e.message || "Error de red" }] });
    } finally {
      setImporting(false);
    }
  };

  const dupCount = rows.filter(r => r._duplicate).length;
  const errorCount = rows.filter(r => !r._valid && !r._duplicate).length;
  const warnCount = rows.filter(r => r._valid && !r._duplicate && r._warnings.length > 0).length;
  const cleanCount = rows.filter(r => r._valid && !r._duplicate && r._warnings.length === 0).length;
  const importableCount = rows.filter(r => r._include).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onClose(); }}>
      <div style={{ background: C.bgCard || C.w, borderRadius: 16, padding: 24, maxWidth: 640, width: "90vw", maxHeight: "80vh", overflow: "auto", position: "relative" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.t1 }}>
            {result ? "Resultado de importación" : step === "preview" ? `Importar ${label}` : "Importar desde Excel"}
          </div>
          {!importing && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.t3, fontFamily: "inherit" }}>✕</button>
          )}
        </div>

        {/* Result view */}
        {result && (
          <div>
            <div style={{ padding: 16, borderRadius: R.lg, background: result.imported > 0 ? C.okPale : C.errPale, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: result.imported > 0 ? C.ok : C.err }}>
                {result.imported > 0 ? `${result.imported} ${isCompanies ? "empresas" : "usuarios"} importados` : "No se importó ningún registro"}
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.err, marginBottom: 6 }}>Errores ({result.errors.length}):</div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.t2, padding: "4px 0", borderBottom: `1px solid ${C.b2 || "#eee"}` }}>
                    Fila {e.row}: {e.name || e.email || ""} — {e.error}
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} style={{ width: "100%", padding: "12px 0", borderRadius: R.md, border: "none", background: C.pri, color: C.tOn, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cerrar
            </button>
          </div>
        )}

        {/* Upload step */}
        {!result && step === "upload" && (
          <div>
            <div style={{ fontSize: 13.5, color: C.t2, marginBottom: 12 }}>
              <strong>1.</strong> Descargá el modelo:
            </div>
            <button onClick={() => {
              const a = document.createElement("a");
              a.href = "/Tolvink_-_Modelo_carga.xlsx";
              a.download = "Tolvink_-_Modelo_carga.xlsx";
              a.click();
            }} style={{ background: "transparent", border: `1px solid ${C.pri}`, color: C.pri, borderRadius: R.md, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {Ic.doc(C.pri, 14)} Descargar modelo Excel
            </button>

            <div style={{ fontSize: 13.5, color: C.t2, marginBottom: 10, marginTop: 8 }}>
              <strong>2.</strong> Completá la pestaña <strong>{sheetName}</strong> y subí el archivo:
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${isDragging ? C.pri : C.b1 || "#ccc"}`,
                borderRadius: R.lg, padding: "40px 20px", textAlign: "center", cursor: "pointer",
                background: isDragging ? C.priPale : "transparent", transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: 14, color: C.t2, fontWeight: 500 }}>
                {isDragging ? "Soltá el archivo aquí" : "Arrastrá el archivo aquí o hacé click para seleccionar"}
              </div>
              <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>.xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={(e) => { processFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>

            {parseError && (
              <div style={{ padding: "8px 12px", borderRadius: R.md, background: C.errPale, color: C.err, fontSize: 13, marginTop: 10 }}>
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* Preview step */}
        {!result && step === "preview" && (
          <div>
            <div style={{ fontSize: 13, color: C.t2, marginBottom: 10, lineHeight: 1.6 }}>
              {rows.length} {isCompanies ? "empresas" : "usuarios"} encontrados:
              {cleanCount > 0 && <> <span style={{ color: C.ok, fontWeight: 600 }}>{cleanCount} nuevos</span></>}
              {warnCount > 0 && <>{cleanCount > 0 ? "," : ""} <span style={{ color: C.warn, fontWeight: 600 }}>{warnCount} con coincidencias parciales</span></>}
              {dupCount > 0 && <>, <span style={{ color: C.t3, fontWeight: 600 }}>{dupCount} ya existentes</span></>}
              {errorCount > 0 && <>, <span style={{ color: C.err, fontWeight: 600 }}>{errorCount} con errores</span></>}
            </div>

            <div style={{ maxHeight: 320, overflow: "auto", marginBottom: 12 }}>
              {rows.map((r, i) => {
                const isDup = r._duplicate;
                const hasErr = !r._valid && !isDup;
                const hasWarn = r._valid && !isDup && r._warnings.length > 0;
                const isClean = r._valid && !isDup && r._warnings.length === 0;
                const bg = isDup ? `${C.t3}10` : hasErr ? C.errPale : hasWarn ? C.warnPale : C.okPale;
                const canToggle = (hasWarn || isClean) && !isDup;

                return (
                  <div key={i} style={{ background: bg, borderRadius: R.md, padding: "8px 12px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, opacity: isDup ? 0.6 : 1 }}>
                    {/* Checkbox for toggleable rows */}
                    {canToggle ? (
                      <input type="checkbox" checked={r._include} onChange={() => toggleRow(i)}
                        style={{ width: 16, height: 16, flexShrink: 0, cursor: "pointer", accentColor: C.pri }} />
                    ) : (
                      <span style={{ fontSize: 14, flexShrink: 0, width: 16, textAlign: "center" }}>
                        {isDup ? "—" : "❌"}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isDup ? C.t3 : C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: isDup ? "line-through" : "none" }}>
                        {isCompanies
                          ? (r.name || "(sin nombre)")
                          : `${r.name || "(sin nombre)"} — ${r.email || "(sin email)"}`}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.t2 }}>
                        {isCompanies
                          ? `${TYPE_MAP_REVERSE[TYPE_MAP[r.type?.toLowerCase()]] || r.type || "?"} ${r.rut ? `· RUT: ${r.rut}` : ""}`
                          : `${r.companyName || "?"} · ${r.role || "?"}`}
                      </div>
                      {isDup && (
                        <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                          Ya existe — no se importa
                        </div>
                      )}
                      {!isDup && (r._errors.length > 0 || r._warnings.length > 0) && (
                        <div style={{ fontSize: 11, color: hasErr ? C.err : C.warn, marginTop: 2 }}>
                          {[...r._errors, ...r._warnings].join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setStep("upload"); setRows([]); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: R.md, border: `1px solid ${C.b1 || "#ccc"}`, background: C.w, color: C.t2, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancelar
              </button>
              <button disabled={importableCount === 0 || importing} onClick={handleImport}
                style={{
                  flex: 2, padding: "12px 0", borderRadius: R.md, border: "none",
                  background: importableCount > 0 ? C.pri : (C.b1 || "#ccc"),
                  color: importableCount > 0 ? C.tOn : C.t3,
                  fontSize: 15, fontWeight: 600, cursor: importableCount > 0 ? "pointer" : "default",
                  fontFamily: "inherit", opacity: importing ? 0.7 : 1,
                }}>
                {importing ? "Importando..." : importableCount > 0 ? `Importar ${importableCount}` : "Nada para importar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
