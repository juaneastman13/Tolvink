import { useState, useRef, useEffect } from "react";
import { uploadPhoto, apiAddDocument, apiDeleteDocument, thumb } from "./api";
import { C, Ic } from "./theme";
import { AttachMenu, Btn } from "./components";
import { useUIStore } from "./store";
import log from "./logger";

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

    const newPreview = URL.createObjectURL(file);
    setPreview(newPreview);
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPhoto(file, freightId, step);
      await apiAddDocument(freightId, { name: file.name, url, type: 'photo', step });
      URL.revokeObjectURL(newPreview);
      setDone(true);
      if (onUploaded) onUploaded({ url, name: file.name, step });
    } catch (err) {
      setError(err.message || 'Error al subir');
      URL.revokeObjectURL(newPreview);
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

export function DocsGallery({ documents, onViewFile, freightId, canDelete, onDeleted, onOcr, ocrLoading, onViewOcr }) {
  const [deleting, setDeleting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [open, setOpen] = useState(false);
  const show = useUIStore(s => s.show);
  if (!documents || documents.length === 0) return null;
  const stepLabels = { request: "Solicitud", assignment: "Asignación", load_confirmation: "Carga", delivery_confirmation: "Entrega", cancellation: "Cancelación" };

  const handleDelete = async (docId) => {
    setDeleting(docId);
    try {
      await apiDeleteDocument(freightId, docId);
      setConfirm(null);
      show("Archivo eliminado", "ok");
      if (onDeleted) onDeleted();
    } catch (e) {
      log.error("Uploads", "delete doc failed:", e);
      show(e?.message || "Error al eliminar archivo", "err");
      setConfirm(null);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, boxShadow: C.sh, width:"100%", boxSizing:"border-box" }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, width:"100%", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0, marginBottom:open?10:0 }}>
        {Ic.img(C.pri, 16)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5, flex:1, textAlign:"left" }}>Archivos del flete ({documents.length})</span>
        <span style={{ fontSize:10, fontWeight:600, color:C.t3 }}>{open?"Ocultar":"Ver archivos"}</span>
        <span style={{ fontSize:14, color:C.t3, transition:"transform 0.2s", transform:open?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
      </button>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {documents.map(d => {
          const isImg = d.type === "photo" || d.url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
          return (
            <div key={d.id} style={{ position:"relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, background: C.bg, border: `1px solid ${C.b2}`, borderRadius: 8, width:"100%" }}>
                <button onClick={()=>onViewFile?onViewFile({url:d.url,name:d.name||"Archivo",type:d.type,id:d.id,ocrData:d.ocrData}):null} style={{ display: "flex", alignItems: "center", gap: 10, flex:1, minWidth:0, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left", padding:0 }}>
                  {isImg ? (
                    <img src={thumb(d.url)} alt={d.name} loading="lazy" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
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
                </button>
                {d.ocrData && onViewOcr && <button onClick={()=>onViewOcr(d.ocrData)} title="Ver datos extraídos" aria-label="Ver datos extraídos" style={{ padding:6, borderRadius:6, border:`1px solid #1A6B37`, background:"#E6F4EA", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{Ic.eye("#1A6B37",14)}</button>}
                {isImg && onOcr && !d.ocrData && <button onClick={()=>onOcr({url:d.url,name:d.name||"Archivo",type:d.type,id:d.id})} disabled={ocrLoading} title="Extraer datos (OCR)" aria-label="Extraer datos (OCR)" style={{ padding:6, borderRadius:6, border:`1px solid ${C.pri}40`, background:C.priPale, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity:ocrLoading?0.5:1 }}>{Ic.doc(C.pri,14)}</button>}
                {canDelete && <button onClick={()=>setConfirm(d.id)} disabled={!!deleting} aria-label="Eliminar archivo" style={{ padding:6, borderRadius:6, border:`1px solid ${C.err}40`, background:C.errPale||"#fef2f2", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{Ic.cross(C.err,14)}</button>}
              </div>
              {confirm===d.id && (
                <div style={{ position:"absolute", right:0, top:"100%", zIndex:20, background:C.w, border:`1px solid ${C.b1}`, borderRadius:10, padding:12, boxShadow:C.shMd, minWidth:180, marginTop:4 }}>
                  <div style={{ fontSize:11, color:C.t1, fontWeight:600, marginBottom:8 }}>Eliminar este archivo?</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>setConfirm(null)} style={{ flex:1, padding:"6px 0", borderRadius:6, border:`1px solid ${C.b1}`, background:C.bg, cursor:"pointer", fontSize:11, fontWeight:600, color:C.t2, fontFamily:"inherit" }}>No</button>
                    <button onClick={()=>handleDelete(d.id)} disabled={deleting===d.id} style={{ flex:1, padding:"6px 0", borderRadius:6, border:"none", background:C.err, color:"#fff", cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:"inherit", opacity:deleting===d.id?0.6:1 }}>{deleting===d.id?"...":"Sí, eliminar"}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// ======================== OCR RESULT MODAL (floating) ====================

export function OcrResultModal({ result, onClose }) {
  const show = useUIStore(s => s.show);
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  if (!result) return null;
  const datos = result.datos || {};
  const entries = Object.entries(datos).filter(([,v]) => v != null && v !== "");

  const copyAll = () => {
    const text = entries.map(([k,v]) => `${k}\t${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
    navigator.clipboard?.writeText(text).then(() => show("Datos copiados", "ok")).catch(() => show("No se pudo copiar", "err"));
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:mobile?"flex-end":"center", justifyContent:"center", zIndex:260, animation:"fvFadeIn 0.2s ease", padding:mobile?0:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.w, borderRadius:mobile?"14px 14px 0 0":14, boxShadow:mobile?"0 -4px 32px rgba(0,0,0,0.3)":"0 8px 40px rgba(0,0,0,0.25)", maxWidth:480, width:"100%", maxHeight:mobile?"80vh":"70vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Drag handle — mobile only */}
        {mobile && <div onClick={onClose} style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px", cursor:"pointer", flexShrink:0 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:C.b1 }}/>
        </div>}
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:mobile?"4px 16px 10px":"12px 16px", borderBottom:`1px solid ${C.b2}`, flexShrink:0, gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
            {Ic.doc(C.pri,16)}
            <span style={{ fontSize:13, fontWeight:700, color:C.t1 }}>Datos extraídos</span>
            <span style={{ fontSize:9, color:C.t3, fontWeight:500, background:C.bg, padding:"2px 6px", borderRadius:8, whiteSpace:"nowrap" }}>{result.tipoDocumento} · {Math.round((result.confianza||0)*100)}%</span>
          </div>
          {entries.length > 0 && <button onClick={copyAll} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4, padding:"6px 12px", borderRadius:8, border:"none", background:C.pri, cursor:"pointer", fontSize:11, fontWeight:700, color:"#fff", fontFamily:"inherit", flexShrink:0, whiteSpace:"nowrap" }}>{Ic.doc("#fff",13)} Copiar</button>}
          <button onClick={onClose} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:8, background:C.err, border:"none", cursor:"pointer", flexShrink:0 }}>{Ic.cross("#fff",16)}</button>
        </div>
        {/* Content */}
        <div style={{ flex:1, overflow:"auto", padding:"14px 18px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {entries.map(([key, val]) => (
              <div key={key} style={{ display:"flex", gap:10, fontSize:12, lineHeight:1.5, padding:"6px 0", borderBottom:`1px solid ${C.b2}` }}>
                <span style={{ fontWeight:700, color:C.t2, minWidth:100, flexShrink:0, textTransform:"capitalize" }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style={{ color:C.t1, wordBreak:"break-word" }}>{typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}</span>
              </div>
            ))}
            {entries.length === 0 && <div style={{ fontSize:12, color:C.t3, textAlign:"center", padding:20 }}>No se pudieron extraer datos del documento</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================== UPLOAD OVERLAY (Tolvink dot animation) =======

export function UploadOverlay({ uploading, done, total, current, label }) {
  const [stage, setStage] = useState("idle"); // idle | uploading | success | fadeout
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (uploading && stage === "idle") {
      setStage("uploading");
      setOpacity(1);
    }
    if (!uploading && stage === "uploading") {
      if (done) {
        setStage("success");
        const t1 = setTimeout(() => setStage("fadeout"), 1400);
        const t2 = setTimeout(() => { setStage("idle"); setOpacity(0); }, 1800);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      } else {
        setStage("idle");
        setOpacity(0);
      }
    }
  }, [uploading, done, stage]);

  if (stage === "idle") return null;

  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(255,255,255,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 5, transition: "opacity 0.35s ease", opacity: stage === "fadeout" ? 0 : 1 }}>
      <style>{`
@keyframes uplPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}
@keyframes uplCircleIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes uplChkDraw{to{stroke-dashoffset:0}}
      `}</style>
      {stage === "uploading" && (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.pri, letterSpacing: -1.5, lineHeight: 1 }}>tolvink</span>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: C.acc, marginLeft: 3, marginTop: 2, display: "inline-block", animation: "uplPulse 1.2s ease-in-out infinite" }} />
          </div>
          {total > 1 && <div style={{ fontSize: 11, color: C.t2, fontWeight: 600 }}>{label || "Subiendo"} {current}/{total}...</div>}
          {total <= 1 && <div style={{ fontSize: 11, color: C.t2, fontWeight: 600 }}>{label || "Subiendo"}...</div>}
        </>
      )}
      {(stage === "success" || stage === "fadeout") && (
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.acc, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, animation: "uplCircleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards", boxShadow: "0 6px 24px rgba(0,0,0,0.12)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: "uplChkDraw 0.4s ease 0.2s forwards" }}><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      )}
    </div>
  );
}

// ======================== FREIGHT FILE UPLOAD (multi-source) ===========

export function FreightFileUpload({ freightId, step, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => {
    return () => { filesRef.current.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); }); };
  }, []);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const docRef = useRef(null);

  const show = useUIStore(s => s.show);
  const addFiles = (fileList) => {
    const rejected = Array.from(fileList).filter(f => f.size > 15 * 1024 * 1024);
    if (rejected.length > 0) show(`${rejected.length} archivo(s) exceden 15MB`, 'err');
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

  const removeFile = (idx) => setFiles(prev => {
    const f = prev[idx];
    if (f?.preview) URL.revokeObjectURL(f.preview);
    return prev.filter((_, i) => i !== idx);
  });

  const uploadAll = async () => {
    setUploadingAll(true);
    setUploadDone(false);
    let allOk = true;
    const pending = files.reduce((acc, f, i) => f.done ? acc : [...acc, i], []);
    for (let pi = 0; pi < pending.length; pi++) {
      const i = pending[pi];
      setCurrentIdx(pi + 1);
      setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: true, error: null } : f));
      try {
        const url = await uploadPhoto(filesRef.current[i].file, freightId, step);
        await apiAddDocument(freightId, { name: filesRef.current[i].name, url, type: filesRef.current[i].file.type.startsWith("image/") ? "photo" : "document", step });
        if (filesRef.current[i].preview) URL.revokeObjectURL(filesRef.current[i].preview);
        setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: false, done: true, preview: null } : f));
      } catch (err) {
        setFiles(prev => prev.map((f, j) => j === i ? { ...f, uploading: false, error: err.message || "Error" } : f));
        allOk = false;
      }
    }
    setUploadDone(allOk);
    setUploadingAll(false);
    if (onUploaded) onUploaded();
  };

  const pending = files.filter(f => !f.done);
  const pendingCount = pending.length;

  return (
    <div style={{ position: "relative", background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 14, boxShadow: C.sh, overflow: "hidden", width:"100%", boxSizing:"border-box" }}>
      <UploadOverlay uploading={uploadingAll} done={uploadDone} total={pendingCount || 1} current={currentIdx} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {Ic.clip(C.acc, 16)}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: 0.5 }}>Adjuntar archivos</span>
      </div>

      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${f.done ? C.ok : f.error ? C.err : C.b1}` }}>
              {f.preview ? (
                <img src={f.preview} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 4 }}>
                  {Ic.doc(C.pri, 20)}
                  <span style={{ fontSize: 7, color: C.t3, textAlign: "center", marginTop: 2, wordBreak: "break-all", lineHeight: 1.1 }}>{f.name?.slice(-12)}</span>
                </div>
              )}
              {f.done && <div style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, background: C.ok, display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.chk("#fff", 12)}</div>}
              {!f.done && !f.uploading && <button onClick={() => removeFile(i)} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: C.err, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ic.cross("#fff", 10)}</button>}
              {f.error && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: C.err, color: "#fff", fontSize: 7, textAlign: "center", padding: 2 }}>Error</div>}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      <input ref={galRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      <input ref={docRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx" multiple onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />

      <div style={{ marginBottom: pendingCount > 0 ? 10 : 0 }}>
        <button onClick={() => setShowAttach(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: `1.5px dashed ${C.b1}`, background: C.bg, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: C.t2 }}>
          {Ic.clip(C.t2, 16)} Adjuntar archivo
        </button>
      </div>

      <AttachMenu open={showAttach} onClose={() => setShowAttach(false)} onCamera={() => camRef.current?.click()} onGallery={() => galRef.current?.click()} onFiles={() => docRef.current?.click()} />

      {pendingCount > 0 && (
        <Btn full v="acc" icon={uploadingAll ? null : Ic.chk(C.w, 14)} disabled={uploadingAll} onClick={uploadAll}>
          {uploadingAll ? "Subiendo..." : `Subir ${pendingCount} archivo${pendingCount > 1 ? "s" : ""}`}
        </Btn>
      )}
    </div>
  );
}
