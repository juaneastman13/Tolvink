import { useState, useRef } from "react";
import { uploadPhoto, apiAddDocument } from "./api";
import { C, Ic } from "./theme";
import { AttachMenu, Btn } from "./components";

// ======================== PHOTO UPLOAD ================================

export function PhotoUpload({ freightId, step, label, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Solo imágenes'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Máximo 10MB'); return; }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPhoto(file, freightId, step);
      await apiAddDocument(freightId, { name: file.name, url, type: 'photo', step });
      setDone(true);
      if (onUploaded) onUploaded({ url, name: file.name, step });
    } catch (err) {
      setError(err.message || 'Error al subir');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
      {preview ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.b1}` }}>
          <img src={preview} alt="foto" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
          {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: C.w, fontSize: 12, fontWeight: 600 }}>Subiendo...</div>}
          {done && <div style={{ position: "absolute", top: 6, right: 6, background: C.ok, borderRadius: 12, padding: "2px 8px", fontSize: 10, color: C.w, fontWeight: 600 }}>Guardada</div>}
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ width: "100%", padding: "16px 14px", borderRadius: 10, border: `1.5px dashed ${C.b1}`, background: C.bg, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {Ic.cam(C.acc, 20)}
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>{label || "Adjuntar foto"}</span>
        </button>
      )}
      {error && <div style={{ fontSize: 11, color: C.err, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ======================== DOCUMENTS GALLERY ============================

export function DocsGallery({ documents }) {
  if (!documents || documents.length === 0) return null;
  const stepLabels = { request: "Solicitud", assignment: "Asignación", load_confirmation: "Carga", delivery_confirmation: "Entrega", cancellation: "Cancelación" };
  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>{Ic.img(C.pri, 16)}<span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Archivos del flete ({documents.length})</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {documents.map(d => {
          const isImg = d.type === "photo" || d.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
          return (
            <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: C.bg, border: `1px solid ${C.b2}`, borderRadius: 8, textDecoration: "none" }}>
              {isImg ? (
                <img src={d.url} alt={d.name} style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 6, background: C.priPale, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Ic.doc(C.pri, 20)}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, wordBreak: "break-all" }}>{d.name || "Archivo"}</div>
                <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>
                  {stepLabels[d.step] || d.type || "Doc"}
                  {d.createdAt && ` · ${new Date(d.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}`}
                  {d.uploadedBy?.name && ` · ${d.uploadedBy.name.split(" ")[0]}`}
                </div>
              </div>
              {Ic.down(C.pri, 14)}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ======================== FREIGHT FILE UPLOAD (multi-source) ===========

export function FreightFileUpload({ freightId, step, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const docRef = useRef(null);

  const addFiles = (fileList, fromCamera = false) => {
    const newFiles = Array.from(fileList).filter(f => f.size <= 15 * 1024 * 1024).map(f => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      name: f.name,
      uploading: false,
      done: false,
      error: null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const uploadAll = async () => {
    setUploadingAll(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].done) continue;
      setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: true, error: null } : f));
      try {
        const url = await uploadPhoto(files[i].file, freightId, step);
        await apiAddDocument(freightId, { name: files[i].name, url, type: files[i].file.type.startsWith("image/") ? "photo" : "document", step });
        setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: false, done: true } : f));
      } catch (err) {
        setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: false, error: err.message || "Error" } : f));
      }
    }
    setUploadingAll(false);
    if (onUploaded) onUploaded();
  };

  const pending = files.filter(f => !f.done);

  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: C.sh }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {Ic.clip(C.acc, 16)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Adjuntar archivos</span>
      </div>

      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${f.done ? C.ok : f.error ? C.err : C.b1}` }}>
              {f.preview ? (
                <img src={f.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 4 }}>
                  {Ic.doc(C.pri, 20)}
                  <span style={{ fontSize: 7, color: C.t3, textAlign: "center", marginTop: 2, wordBreak: "break-all", lineHeight: 1.1 }}>{f.name?.slice(-12)}</span>
                </div>
              )}
              {f.uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 18, height: 18, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
              {f.done && <div style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, background: C.ok, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.chk("#fff", 12)}</div>}
              {!f.done && !f.uploading && <button onClick={() => removeFile(i)} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: C.err, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.cross("#fff", 10)}</button>}
              {f.error && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.err, color: "#fff", fontSize: 7, textAlign: "center", padding: 2 }}>Error</div>}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.length) addFiles(e.target.files, true); e.target.value = ""; }} style={{ display: "none" }} />
      <input ref={galRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      <input ref={docRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx" multiple onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />

      <div style={{ marginBottom: pending.length > 0 ? 10 : 0 }}>
        <button onClick={() => setShowAttach(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: `1.5px dashed ${C.b1}`, background: C.bg, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: C.t2 }}>
          {Ic.clip(C.t2, 16)} Adjuntar archivo
        </button>
      </div>

      <AttachMenu open={showAttach} onClose={() => setShowAttach(false)} onCamera={() => camRef.current?.click()} onGallery={() => galRef.current?.click()} onFiles={() => docRef.current?.click()} />

      {pending.length > 0 && (
        <Btn full v="acc" icon={uploadingAll ? null : Ic.chk(C.w, 14)} disabled={uploadingAll} onClick={uploadAll}>
          {uploadingAll ? "Subiendo..." : `Subir ${pending.length} archivo${pending.length > 1 ? "s" : ""}`}
        </Btn>
      )}
    </div>
  );
}
