// =====================================================================
// TOLVINK — Truck Detail Screen
// Sections: Summary | Freights | Incomes | Expenses | Movements | Docs
// =====================================================================

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { C, Ic, R, FONT, MONO } from "../theme";
import { Btn, Field, Loader, EmptyState, LicensePlate, LoadingOverlay, StatusPill } from "../components";
import { useIsDesktop } from "../hooks/useResponsive";
import { FileViewer } from "../components/overlays";
import {
  apiGetTruckDetail, apiAddTruckDocument, apiUpdateTruckDocument, apiDeleteTruckDocument,
  apiAddTruckExpense, apiUpdateTruckExpense, apiDeleteTruckExpense, apiGetTruckExpenseSummary,
  apiGetTruckFreights, apiGetTruckIncomes, apiAddTruckIncome, apiUpdateTruckIncome, apiDeleteTruckIncome,
  apiGetTruckMovements, apiAddTruckMovement, apiUpdateTruckMovement, apiDeleteTruckMovement,
  apiGetEconomicSummary, apiGetTruckDocuments, apiUpdateTripData, apiProcessTruckDocOcr, uploadPhoto,
} from "../api";

const LocPickerFullscreen = lazy(() => import("../maps").then(m => ({ default: m.LocPickerFullscreen })));

// ======================== CONSTANTS ====================================

// All labels (for display of existing docs)
const DOC_TYPE_LABELS = { VTV_ITV:"ITV", INSURANCE:"Seguro", TRANSPORT_LICENSE:"Habilitación de transporte", GREEN_CARD:"Cédula verde", DRIVER_LICENSE:"Licencia de conducir", RUAT:"RUAT", SENASA:"SENASA", FUMIGATION:"Certificado de fumigación", BPS_DGI:"Habilitaciones BPS-DGI", GET_CERTIFICATE:"GET", CIRCULATION_PERMIT:"Permiso nacional de circulación", OTHER:"Otro" };
// Active types for new document dropdown (deprecated types hidden)
const DOC_TYPE_ACTIVE = { VTV_ITV:"ITV", INSURANCE:"Seguro", TRANSPORT_LICENSE:"Habilitación de transporte", DRIVER_LICENSE:"Licencia de conducir", BPS_DGI:"Habilitaciones BPS-DGI", GET_CERTIFICATE:"GET", CIRCULATION_PERMIT:"Permiso nacional de circulación", OTHER:"Otro" };
const EXP_TYPE_LABELS = { FUEL:"Combustible", TOLL:"Peaje", MAINTENANCE:"Mantenimiento", TIRE:"Neumáticos", INSURANCE:"Seguro", FINE:"Multa", PARKING:"Estacionamiento", MEAL:"Viáticos", OTHER:"Otro" };
const MOV_TYPE_LABELS = { REPOSITIONING:"Reposicionamiento", MAINTENANCE_TRIP:"Viaje a taller", INTERNAL_TRANSFER:"Traslado interno", PERSONAL:"Uso particular", OTHER:"Otro" };
const INC_STATUS = { PENDING: { label:"Pendiente", color:C.warn, bg:C.warnPale }, PAID: { label:"Cobrado", color:C.ok, bg:C.okPale }, OVERDUE: { label:"Vencido", color:C.err, bg:C.errPale } };
const EXPIRY_COLORS = { valid:C.ok, expiring_soon:C.warn, expired:C.err, no_expiry:C.t3 };
const EXPIRY_LABELS = { valid:"Vigente", expiring_soon:"Por vencer", expired:"Vencido", no_expiry:"Sin vencimiento" };

function fmtDate(d) { if (!d) return "—"; const dt = new Date(d); return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`; }
function fmtMoney(n, cur="UYU") { const v = Number(n)||0; return `${cur==="USD"?"US$":"$"}${v.toLocaleString("es-UY",{minimumFractionDigits:0,maximumFractionDigits:0})}`; }
function fmtKm(n) { const v = Number(n)||0; return `${v.toLocaleString("es-UY",{maximumFractionDigits:0})} km`; }
const lbl = (s,f=12,c=C.t2,w=600) => ({ fontSize:f, fontWeight:w, color:c, marginBottom:4, display:"block" });
const sel = { width:"100%", padding:"8px 10px", borderRadius:R.md, border:`1px solid ${C.b1}`, fontSize:13, fontFamily:FONT, background:C.w };

// ======================== SECTION HEADER ================================

function SH({ title, icon, count, onAdd, expanded, onToggle }) {
  return (
    <button onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"14px 16px", background:C.w, border:`1px solid ${C.b1}`, borderRadius:R.lg, cursor:"pointer", fontFamily:FONT, marginBottom:expanded?0:10, borderBottomLeftRadius:expanded?0:R.lg, borderBottomRightRadius:expanded?0:R.lg, boxShadow:C.sh }}>
      {icon}
      <span style={{ flex:1, textAlign:"left", fontSize:15, fontWeight:700, color:C.t1 }}>{title}</span>
      {count!=null && <span style={{ fontSize:12, fontWeight:600, color:C.t3, background:C.bg, padding:"2px 8px", borderRadius:R.pill }}>{count}</span>}
      {onAdd && <span onClick={e=>{e.stopPropagation();onAdd();}} style={{ padding:"4px 10px", borderRadius:R.md, background:C.pri, cursor:"pointer", display:"flex", alignItems:"center" }}>{Ic.plus(C.tOn,14)}</span>}
      <span style={{ transform:expanded?"rotate(90deg)":"rotate(0deg)", transition:"transform 0.2s" }}>{Ic.chev(C.t3,14)}</span>
    </button>
  );
}
function SecBody({ children }) {
  return <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderTop:"none", borderBottomLeftRadius:R.lg, borderBottomRightRadius:R.lg, padding:14, marginBottom:16 }}>{children}</div>;
}

// ======================== STAT CARD =====================================

function Stat({ label, value, color=C.t1, sub }) {
  return (
    <div style={{ flex:"1 1 80px", textAlign:"center", padding:"10px 6px", background:C.bg, borderRadius:R.md, minWidth:80 }}>
      <div style={{ fontSize:17, fontWeight:800, color, lineHeight:1.2 }}>{value}</div>
      <div style={{ fontSize:10.5, color:C.t3, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:C.t3 }}>{sub}</div>}
    </div>
  );
}

// ======================== MOBILE STEP FORM ================================

function StepForm({ title, steps, onSubmit, onCancel, saving, submitLabel = "Confirmar" }) {
  const [step, setStep] = useState(0);
  const total = steps.length;
  const isLast = step === total - 1;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9998, background:C.bg, display:"flex", flexDirection:"column", animation:"slideUp 0.25s ease" }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:`1px solid ${C.b1}`, background:C.w, flexShrink:0 }}>
        <button onClick={step > 0 ? () => setStep(s => s - 1) : onCancel} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.chev(C.pri, 18)}</button>
        <span style={{ flex:1, fontSize:15, fontWeight:700, color:C.t1 }}>{title}</span>
        <button onClick={onCancel} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3, 18)}</button>
      </div>
      {/* Progress */}
      <div style={{ display:"flex", gap:4, padding:"10px 16px", flexShrink:0 }}>
        {steps.map((_, i) => <div key={i} style={{ flex:1, height:4, borderRadius:2, background:i <= step ? C.pri : C.b1, transition:"background 0.2s" }} />)}
      </div>
      <div style={{ padding:"4px 16px 0", fontSize:12, color:C.t3, flexShrink:0 }}>Paso {step + 1} de {total}{steps[step].title ? ` · ${steps[step].title}` : ""}</div>
      {/* Content */}
      <div style={{ flex:1, overflow:"auto", padding:"12px 16px" }}>
        {steps[step].content}
      </div>
      {/* Sticky footer */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.b1}`, background:C.w, flexShrink:0 }}>
        <button disabled={saving} onClick={isLast ? onSubmit : () => setStep(s => s + 1)} style={{ width:"100%", padding:"14px 0", borderRadius:R.md, border:"none", background:isLast ? C.pri : C.acc, color:C.w, fontSize:15, fontWeight:700, fontFamily:FONT, cursor:saving ? "not-allowed" : "pointer", opacity:saving ? 0.6 : 1, minHeight:48 }}>
          {saving ? "Guardando..." : isLast ? submitLabel : "Siguiente →"}
        </button>
      </div>
    </div>
  );
}

// ======================== FORMS (Doc, Exp reused from before) ============

function DocForm({ onSave, onCancel, saving, initial, linkOptions, storagePath }) {
  const [type, setType] = useState(initial?.type||"VTV_ITV");
  const [name, setName] = useState(initial?.name||"");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt?new Date(initial.expiresAt).toISOString().split("T")[0]:"");
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt?new Date(initial.issuedAt).toISOString().split("T")[0]:"");
  const [notes, setNotes] = useState(initial?.notes||"");
  const [linkType, setLinkType] = useState(initial?.expenseId?"expense":initial?.incomeId?"income":initial?.freightId?"freight":initial?.movementId?"movement":"none");
  const [linkId, setLinkId] = useState(initial?.expenseId||initial?.incomeId||initial?.freightId||initial?.movementId||"");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handleSubmit = async()=>{if(!initial&&!file)return;setUploading(true);try{let fu=initial?.fileUrl,fn=initial?.fileName,mt=initial?.mimeType;if(file){fu=await uploadPhoto(file,storagePath||"truck-docs","doc");fn=file.name;mt=file.type;}const linkData = {};if(linkType==="expense")linkData.expenseId=linkId||null;else if(linkType==="income")linkData.incomeId=linkId||null;else if(linkType==="freight")linkData.freightId=linkId||null;else if(linkType==="movement")linkData.movementId=linkId||null;await onSave({type,name:name||null,fileUrl:fu,fileName:fn,mimeType:mt,expiresAt:expiresAt||null,issuedAt:issuedAt||null,notes:notes||null,...linkData});}finally{setUploading(false);}};
  const linkItems = linkType==="expense"?linkOptions?.expenses:linkType==="income"?linkOptions?.incomes:linkType==="freight"?linkOptions?.freights:linkType==="movement"?linkOptions?.movements:[];
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Tipo de documento</label><select value={type} onChange={e=>setType(e.target.value)} style={sel}>{Object.entries(DOC_TYPE_ACTIVE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    {type==="OTHER"&&<Field label="Nombre" value={name} onChange={setName} placeholder="Nombre del documento"/>}
    {!initial&&<div style={{marginBottom:10}}><label style={lbl("s")}>Archivo</label><input type="file" accept="image/*,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} style={{fontSize:13,fontFamily:FONT}}/></div>}
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><label style={lbl("s")}>Emisión</label><input type="date" value={issuedAt} onChange={e=>setIssuedAt(e.target.value)} style={{...sel}}/></div><div style={{flex:1}}><label style={lbl("s")}>Vencimiento</label><input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} style={{...sel}}/></div></div>
    {linkOptions && <div style={{marginBottom:10}}>
      <label style={lbl("s")}>Vincular a</label>
      <select value={linkType} onChange={e=>{setLinkType(e.target.value);setLinkId("");}} style={{...sel,marginBottom:4}}><option value="none">Documento general</option><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="freight">Flete</option><option value="movement">Movimiento</option></select>
      {linkType!=="none"&&linkItems?.length>0&&<select value={linkId} onChange={e=>setLinkId(e.target.value)} style={sel}><option value="">Seleccionar...</option>{linkItems.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select>}
    </div>}
    <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||uploading||(!initial&&!file)} onClick={handleSubmit}>{uploading?"Subiendo...":initial?"Guardar":"Agregar documento"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

function ExpForm({ onSave, onCancel, saving, initial, activeFreights, mobile, storagePath }) {
  const [type, setType] = useState(initial?.type||"FUEL");
  const [amount, setAmount] = useState(initial?.amount?.toString()||"");
  const [currency, setCurrency] = useState(initial?.currency||"UYU");
  const [date, setDate] = useState(initial?.date?new Date(initial.date).toISOString().split("T")[0]:new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState(initial?.description||"");
  const [freightId, setFreightId] = useState(initial?.freightId||"");
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handleSubmit = async()=>{if(!amount||!date)return;setUploading(true);try{let ru=initial?.receiptUrl,rn=initial?.receiptName;if(receiptFile){ru=await uploadPhoto(receiptFile,storagePath||"truck-receipts","receipt");rn=receiptFile.name;}await onSave({type,amount:parseFloat(amount),currency,date,description:description||null,freightId:freightId||null,receiptUrl:ru,receiptName:rn});}finally{setUploading(false);}};
  if (mobile) return <StepForm title={initial?"Editar gasto":"Nuevo gasto"} saving={saving||uploading} onSubmit={handleSubmit} onCancel={onCancel} submitLabel={initial?"Guardar":"Registrar"} steps={[
    {title:"Tipo",content:<div><label style={lbl("s")}>Tipo de gasto</label><select value={type} onChange={e=>setType(e.target.value)} style={{...sel,minHeight:48}}>{Object.entries(EXP_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>},
    {title:"Monto",content:<div><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number" inputMode="decimal"/><div style={{marginTop:10}}><label style={lbl("s")}>Moneda</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={{...sel,minHeight:48}}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div></div>},
    {title:"Detalles",content:<div><div style={{marginBottom:10}}><label style={lbl("s")}>Fecha</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...sel,minHeight:48}}/></div><Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle"/>{activeFreights?.length>0&&<div style={{marginTop:10}}><label style={lbl("s")}>Flete asociado</label><select value={freightId} onChange={e=>setFreightId(e.target.value)} style={{...sel,minHeight:48}}><option value="">Sin flete</option>{activeFreights.map(f=><option key={f.id} value={f.id}>{f.code}</option>)}</select></div>}</div>},
    {title:"Comprobante",content:<div><label style={lbl("s")}>Comprobante (opcional)</label><input type="file" accept="image/*,.pdf" onChange={e=>setReceiptFile(e.target.files?.[0]||null)} style={{fontSize:14,fontFamily:FONT,minHeight:48}}/></div>},
  ]}/>;
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Tipo de gasto</label><select value={type} onChange={e=>setType(e.target.value)} style={sel}>{Object.entries(EXP_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}><div style={{flex:"2 1 140px"}}><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number" inputMode="decimal"/></div><div style={{flex:"1 1 80px"}}><label style={lbl("s")}>Moneda</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={sel}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div></div>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Fecha</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...sel}}/></div>
    <Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle del gasto"/>
    {activeFreights?.length>0&&<div style={{marginTop:10}}><label style={lbl("s")}>Flete asociado</label><select value={freightId} onChange={e=>setFreightId(e.target.value)} style={sel}><option value="">Sin flete</option>{activeFreights.map(f=><option key={f.id} value={f.id}>{f.code}</option>)}</select></div>}
    <div style={{marginTop:10}}><label style={lbl("s")}>Comprobante</label><input type="file" accept="image/*,.pdf" onChange={e=>setReceiptFile(e.target.files?.[0]||null)} style={{fontSize:13,fontFamily:FONT}}/></div>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||uploading||!amount||!date} onClick={handleSubmit}>{uploading?"Guardando...":initial?"Guardar":"Registrar gasto"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

function IncForm({ onSave, onCancel, saving, initial, freights, mobile, storagePath }) {
  const [concept, setConcept] = useState(initial?.concept||"");
  const [amount, setAmount] = useState(initial?.amount?.toString()||"");
  const [currency, setCurrency] = useState(initial?.currency||"UYU");
  const [date, setDate] = useState(initial?.date?new Date(initial.date).toISOString().split("T")[0]:new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState(initial?.status||"PENDING");
  const [freightId, setFreightId] = useState(initial?.freightId||"");
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber||"");
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [notes, setNotes] = useState(initial?.notes||"");
  const [uploading, setUploading] = useState(false);
  const handleSubmit = async()=>{if(!concept||!amount||!date)return;setUploading(true);try{let iu=initial?.invoiceUrl;if(invoiceFile){iu=await uploadPhoto(invoiceFile,storagePath||"truck-incomes","invoice");}await onSave({concept,amount:parseFloat(amount),currency,date,status,freightId:freightId||null,invoiceNumber:invoiceNumber||null,invoiceUrl:iu,notes:notes||null});}finally{setUploading(false);}};
  if (mobile) return <StepForm title={initial?"Editar ingreso":"Nuevo ingreso"} saving={saving||uploading} onSubmit={handleSubmit} onCancel={onCancel} submitLabel={initial?"Guardar":"Registrar"} steps={[
    {title:"Concepto",content:<div><Field label="Concepto" value={concept} onChange={setConcept} placeholder="Ej: Flete Colonia → Montevideo"/>{freights?.length>0&&<div style={{marginTop:10}}><label style={lbl("s")}>Flete asociado</label><select value={freightId} onChange={e=>{setFreightId(e.target.value);if(e.target.value&&!concept){const f=freights.find(x=>(x.freightId||x.id)===e.target.value);if(f)setConcept(`Flete ${f.origin||"?"} → ${f.dest||"?"}`);}}} style={{...sel,minHeight:48}}><option value="">Sin flete</option>{freights.map(f=><option key={f.freightId||f.id} value={f.freightId||f.id}>{f.code}</option>)}</select></div>}</div>},
    {title:"Monto",content:<div><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number" inputMode="decimal"/><div style={{display:"flex",gap:10,marginTop:10}}><div style={{flex:1}}><label style={lbl("s")}>Moneda</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={{...sel,minHeight:48}}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div><div style={{flex:1}}><label style={lbl("s")}>Estado</label><select value={status} onChange={e=>setStatus(e.target.value)} style={{...sel,minHeight:48}}>{Object.entries(INC_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div></div></div>},
    {title:"Detalles",content:<div><div style={{marginBottom:10}}><label style={lbl("s")}>Fecha</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...sel,minHeight:48}}/></div><Field label="N° Factura (opcional)" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="A-0001-00012345"/><Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/></div>},
    {title:"Factura",content:<div><label style={lbl("s")}>Adjuntar factura (opcional)</label><input type="file" accept="image/*,.pdf" onChange={e=>setInvoiceFile(e.target.files?.[0]||null)} style={{fontSize:14,fontFamily:FONT,minHeight:48}}/></div>},
  ]}/>;
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <Field label="Concepto" value={concept} onChange={setConcept} placeholder="Ej: Flete Colonia → Montevideo"/>
    <div style={{display:"flex",gap:10,marginTop:10,marginBottom:10,flexWrap:"wrap"}}><div style={{flex:"2 1 140px"}}><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number" inputMode="decimal"/></div><div style={{flex:"1 1 80px"}}><label style={lbl("s")}>Moneda</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={sel}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}><div style={{flex:"1 1 140px"}}><label style={lbl("s")}>Fecha</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...sel}}/></div><div style={{flex:"1 1 140px"}}><label style={lbl("s")}>Estado</label><select value={status} onChange={e=>setStatus(e.target.value)} style={sel}>{Object.entries(INC_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div></div>
    {freights?.length>0&&<div style={{marginBottom:10}}><label style={lbl("s")}>Flete asociado</label><select value={freightId} onChange={e=>{setFreightId(e.target.value);if(e.target.value&&!concept){const f=freights.find(x=>(x.freightId||x.id)===e.target.value);if(f)setConcept(`Flete ${f.origin||"?"} → ${f.dest||"?"}`);}}} style={sel}><option value="">Sin flete</option>{freights.map(f=><option key={f.freightId||f.id} value={f.freightId||f.id}>{f.code} — {f.origin||"?"} → {f.dest||"?"}</option>)}</select></div>}
    <Field label="N° Factura (opcional)" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="Ej: A-0001-00012345"/>
    <div style={{marginTop:10}}><label style={lbl("s")}>Factura (opcional)</label><input type="file" accept="image/*,.pdf" onChange={e=>setInvoiceFile(e.target.files?.[0]||null)} style={{fontSize:13,fontFamily:FONT}}/></div>
    <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||uploading||!concept||!amount||!date} onClick={handleSubmit}>{uploading?"Guardando...":initial?"Guardar":"Registrar ingreso"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

function MovForm({ onSave, onCancel, saving, initial, locations, mobile }) {
  const [type, setType] = useState(initial?.type||"REPOSITIONING");
  const [description, setDescription] = useState(initial?.description||"");
  const [originName, setOriginName] = useState(initial?.originName||"");
  const [originFieldId, setOriginFieldId] = useState(initial?.originFieldId||"");
  const [originLat, setOriginLat] = useState(initial?.originLat||null);
  const [originLng, setOriginLng] = useState(initial?.originLng||null);
  const [destName, setDestName] = useState(initial?.destName||"");
  const [destFieldId, setDestFieldId] = useState(initial?.destFieldId||"");
  const [destLat, setDestLat] = useState(initial?.destLat||null);
  const [destLng, setDestLng] = useState(initial?.destLng||null);
  const [departureAt, setDepartureAt] = useState(initial?.departureAt?new Date(initial.departureAt).toISOString().slice(0,16):"");
  const [arrivalAt, setArrivalAt] = useState(initial?.arrivalAt?new Date(initial.arrivalAt).toISOString().slice(0,16):"");
  const [kmDriven, setKmDriven] = useState(initial?.kmDriven?.toString()||"");
  const [fuelLiters, setFuelLiters] = useState(initial?.fuelLiters?.toString()||"");
  const [fuelCost, setFuelCost] = useState(initial?.fuelCost?.toString()||"");
  const [tollCost, setTollCost] = useState(initial?.tollCost?.toString()||"");
  const [notes, setNotes] = useState(initial?.notes||"");
  const [mapFor, setMapFor] = useState(null); // "origin" or "dest"
  const pickLoc = (fieldId, setFieldId, setName) => {
    if (!fieldId) { setFieldId(""); return; }
    const loc = locations?.find(l => l.id === fieldId);
    if (loc) { setFieldId(fieldId); setName(loc.name); }
  };
  const handleMapPick = (loc) => {
    if (!loc) return;
    const name = loc.address || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
    if (mapFor === "origin") { setOriginName(name); setOriginLat(loc.lat); setOriginLng(loc.lng); setOriginFieldId(""); }
    else { setDestName(name); setDestLat(loc.lat); setDestLng(loc.lng); setDestFieldId(""); }
    setMapFor(null);
  };
  const handleSubmit = ()=>onSave({type,description:description||null,originName:originName||null,originFieldId:originFieldId||null,originLat,originLng,destName:destName||null,destFieldId:destFieldId||null,destLat,destLng,departureAt:departureAt||null,arrivalAt:arrivalAt||null,kmDriven:kmDriven?parseFloat(kmDriven):null,fuelLiters:fuelLiters?parseFloat(fuelLiters):null,fuelCost:fuelCost?parseFloat(fuelCost):null,tollCost:tollCost?parseFloat(tollCost):null,notes:notes||null});
  if (mobile) return <StepForm title={initial?"Editar movimiento":"Nuevo movimiento"} saving={saving} onSubmit={handleSubmit} onCancel={onCancel} submitLabel={initial?"Guardar":"Registrar"} steps={[
    {title:"Tipo",content:<div><label style={lbl("s")}>Tipo de movimiento</label><select value={type} onChange={e=>setType(e.target.value)} style={{...sel,minHeight:48}}>{Object.entries(MOV_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><div style={{marginTop:10}}><Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle"/></div></div>},
    {title:"Origen",content:<div>{locations?.length>0&&<div style={{marginBottom:8}}><label style={lbl("s")}>Ubicación guardada</label><select value={originFieldId} onChange={e=>{pickLoc(e.target.value,setOriginFieldId,setOriginName);}} style={{...sel,minHeight:48}}><option value="">Escribir manualmente</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}<Field label="Origen" value={originName} onChange={v=>{setOriginName(v);if(v)setOriginFieldId("");}} placeholder="Ciudad/lugar"/></div>},
    {title:"Destino",content:<div>{locations?.length>0&&<div style={{marginBottom:8}}><label style={lbl("s")}>Ubicación guardada</label><select value={destFieldId} onChange={e=>{pickLoc(e.target.value,setDestFieldId,setDestName);}} style={{...sel,minHeight:48}}><option value="">Escribir manualmente</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}<Field label="Destino" value={destName} onChange={v=>{setDestName(v);if(v)setDestFieldId("");}} placeholder="Ciudad/lugar"/></div>},
    {title:"Datos",content:<div><Field label="Km recorridos" value={kmDriven} onChange={setKmDriven} type="number" placeholder="0" inputMode="decimal"/><div style={{display:"flex",gap:10,marginTop:10}}><div style={{flex:1}}><Field label="Litros" value={fuelLiters} onChange={setFuelLiters} type="number" inputMode="decimal"/></div><div style={{flex:1}}><Field label="Peajes" value={tollCost} onChange={setTollCost} type="number" inputMode="decimal"/></div></div><div style={{display:"flex",gap:10,marginTop:10}}><div style={{flex:1}}><label style={lbl("s")}>Salida</label><input type="datetime-local" value={departureAt} onChange={e=>setDepartureAt(e.target.value)} style={{...sel,minHeight:44}}/></div><div style={{flex:1}}><label style={lbl("s")}>Llegada</label><input type="datetime-local" value={arrivalAt} onChange={e=>setArrivalAt(e.target.value)} style={{...sel,minHeight:44}}/></div></div></div>},
  ]}/>;
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Tipo</label><select value={type} onChange={e=>setType(e.target.value)} style={sel}>{Object.entries(MOV_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle"/>
    <div style={{display:"flex",gap:10,marginTop:10,marginBottom:10,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 200px",minWidth:0}}>
        {locations?.length>0 && <div style={{marginBottom:4}}><label style={lbl("s")}>Origen (ubicación)</label><select value={originFieldId} onChange={e=>{pickLoc(e.target.value,setOriginFieldId,setOriginName);}} style={{...sel,marginBottom:4}}><option value="">Escribir manualmente</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
        <Field label={locations?.length?"O escribir" :"Origen"} value={originName} onChange={v=>{setOriginName(v);if(v)setOriginFieldId("");}} placeholder="Ciudad/lugar"/>
        <button onClick={()=>setMapFor("origin")} style={{marginTop:4,background:"none",border:`1px solid ${C.b1}`,borderRadius:R.md,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600,color:C.pri,fontFamily:FONT,display:"flex",alignItems:"center",gap:4,minHeight:36}}>{Ic.pin(C.pri,12)} Mapa</button>
        {originLat && <span style={{fontSize:10,color:C.t3}}>{Number(originLat).toFixed(4)}, {Number(originLng).toFixed(4)}</span>}
      </div>
      <div style={{flex:"1 1 200px",minWidth:0}}>
        {locations?.length>0 && <div style={{marginBottom:4}}><label style={lbl("s")}>Destino (ubicación)</label><select value={destFieldId} onChange={e=>{pickLoc(e.target.value,setDestFieldId,setDestName);}} style={{...sel,marginBottom:4}}><option value="">Escribir manualmente</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
        <Field label={locations?.length?"O escribir":"Destino"} value={destName} onChange={v=>{setDestName(v);if(v)setDestFieldId("");}} placeholder="Ciudad/lugar"/>
        <button onClick={()=>setMapFor("dest")} style={{marginTop:4,background:"none",border:`1px solid ${C.b1}`,borderRadius:R.md,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:600,color:C.pri,fontFamily:FONT,display:"flex",alignItems:"center",gap:4,minHeight:36}}>{Ic.pin(C.pri,12)} Mapa</button>
        {destLat && <span style={{fontSize:10,color:C.t3}}>{Number(destLat).toFixed(4)}, {Number(destLng).toFixed(4)}</span>}
      </div>
    </div>
    {mapFor && <div style={{borderRadius:R.lg,overflow:"hidden",border:`1.5px solid ${C.pri}`,height:280,marginBottom:10}}><Suspense fallback={<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:C.bgCard,color:C.t3,fontSize:13}}>Cargando mapa...</div>}><LocPickerFullscreen value={null} onChange={()=>{}} label={mapFor==="origin"?"Seleccionar origen":"Seleccionar destino"} onClose={()=>setMapFor(null)} confirmLabel="Confirmar" onConfirm={handleMapPick}/></Suspense></div>}
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}><div style={{flex:"1 1 140px"}}><label style={lbl("s")}>Salida</label><input type="datetime-local" value={departureAt} onChange={e=>setDepartureAt(e.target.value)} style={{...sel,minHeight:44}}/></div><div style={{flex:"1 1 140px"}}><label style={lbl("s")}>Llegada</label><input type="datetime-local" value={arrivalAt} onChange={e=>setArrivalAt(e.target.value)} style={{...sel,minHeight:44}}/></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}><div style={{flex:"1 1 120px"}}><Field label="Km" value={kmDriven} onChange={setKmDriven} type="number" placeholder="0" inputMode="decimal"/></div><div style={{flex:"1 1 120px"}}><Field label="Litros" value={fuelLiters} onChange={setFuelLiters} type="number" placeholder="0" inputMode="decimal"/></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}><div style={{flex:"1 1 120px"}}><Field label="Costo combustible" value={fuelCost} onChange={setFuelCost} type="number" placeholder="0" inputMode="decimal"/></div><div style={{flex:"1 1 120px"}}><Field label="Peajes" value={tollCost} onChange={setTollCost} type="number" placeholder="0" inputMode="decimal"/></div></div>
    <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||!type} onClick={handleSubmit}>{initial?"Guardar":"Registrar movimiento"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

// ======================== TRIP DATA FORM ================================

function TripDataForm({ freight, onSave, onCancel, saving }) {
  const [kmLoaded, setKmLoaded] = useState(freight.kmLoaded?.toString()||"");
  const [kmEmpty, setKmEmpty] = useState(freight.kmEmpty?.toString()||"");
  const [fuelLiters, setFuelLiters] = useState(freight.fuelLiters?.toString()||"");
  const [fuelCostPerLiter, setFuelCostPerLiter] = useState(freight.fuelCostPerLiter?.toString()||"");
  const [tollCost, setTollCost] = useState(freight.tollCost?.toString()||"");
  const [odometerStart, setOdometerStart] = useState(freight.odometerStart?.toString()||"");
  const [odometerEnd, setOdometerEnd] = useState(freight.odometerEnd?.toString()||"");
  const kmTotal = (parseFloat(kmLoaded||"0")+parseFloat(kmEmpty||"0"))||"";
  return (<div style={{padding:14,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:10}}>
    <div style={{fontSize:12,fontWeight:700,color:C.t2,marginBottom:8}}>Datos de viaje — {freight.code}</div>
    <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 100px",minWidth:80}}><Field label="Km con carga" value={kmLoaded} onChange={setKmLoaded} type="number" placeholder="0" inputMode="decimal"/></div>
      <div style={{flex:"1 1 100px",minWidth:80}}><Field label="Km vacío" value={kmEmpty} onChange={setKmEmpty} type="number" placeholder="0" inputMode="decimal"/></div>
      <div style={{flex:"1 1 100px",minWidth:80}}><div style={lbl("s")}>Km total</div><div style={{padding:"8px 10px",borderRadius:R.md,background:C.bg,fontSize:13,color:C.t1,fontWeight:600}}>{kmTotal||"—"}</div></div>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 100px",minWidth:80}}><Field label="Litros" value={fuelLiters} onChange={setFuelLiters} type="number" placeholder="0" inputMode="decimal"/></div>
      <div style={{flex:"1 1 100px",minWidth:80}}><Field label="$/litro" value={fuelCostPerLiter} onChange={setFuelCostPerLiter} type="number" placeholder="0" inputMode="decimal"/></div>
      <div style={{flex:"1 1 100px",minWidth:80}}><Field label="Peajes" value={tollCost} onChange={setTollCost} type="number" placeholder="0" inputMode="decimal"/></div>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 140px",minWidth:120}}><Field label="Odómetro inicio" value={odometerStart} onChange={setOdometerStart} type="number" placeholder="0" inputMode="numeric"/></div>
      <div style={{flex:"1 1 140px",minWidth:120}}><Field label="Odómetro fin" value={odometerEnd} onChange={setOdometerEnd} type="number" placeholder="0" inputMode="numeric"/></div>
    </div>
    <div style={{display:"flex",gap:8}}>
      <Btn full disabled={saving} onClick={()=>onSave({kmLoaded:parseFloat(kmLoaded)||null,kmEmpty:parseFloat(kmEmpty)||null,kmTotal:parseFloat(kmTotal)||null,fuelLiters:parseFloat(fuelLiters)||null,fuelCostPerLiter:parseFloat(fuelCostPerLiter)||null,tollCost:parseFloat(tollCost)||null,odometerStart:parseInt(odometerStart)||null,odometerEnd:parseInt(odometerEnd)||null})}>{saving?"Guardando...":"Guardar datos"}</Btn>
      <Btn v="muted" onClick={onCancel}>Cancelar</Btn>
    </div>
  </div>);
}

// ======================== MAIN SCREEN ===================================

export default function TruckDetailScreen({ truckId, user, onBack, onNavFreight }) {
  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [viewFile, setViewFile] = useState(null); // file object for FileViewer
  const [ocrLoading, setOcrLoading] = useState(false);

  // Active tab
  const [tab, setTab] = useState("summary");

  // Forms & state per section
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [tripDataFor, setTripDataFor] = useState(null); // freight being edited for trip data
  const [showMapFor, setShowMapFor] = useState(null); // "origin" or "dest" for map picker in movements
  const [expandedItem, setExpandedItem] = useState(null); // id of expanded income/expense

  const isDesktop = useIsDesktop();
  const storePath = `truck-docs/${user?.activeCompanyId||"shared"}/${truckId}`;

  // Lazy-loaded data
  const [ecoSummary, setEcoSummary] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [expSummary, setExpSummary] = useState(null);
  const [incomes, setIncomes] = useState(null);
  const [movements, setMovements] = useState(null);
  const [freightHistory, setFreightHistory] = useState(null);
  const [locations, setLocations] = useState(null);
  const [allDocs, setAllDocs] = useState(null);
  const [docFilter, setDocFilter] = useState("all"); // all|general|expense|income|freight|movement

  const canEdit = user?.role !== "chofer";

  const load = useCallback(async () => {
    try { const d = await apiGetTruckDetail(truckId); setTruck(d); setError(null); }
    catch (e) { setError(e.message || "Error al cargar"); }
    finally { setLoading(false); }
  }, [truckId]);

  useEffect(() => { load(); }, [load]);

  // Load section data on tab switch
  useEffect(() => {
    if (!truck) return;
    if (tab === "summary" && !ecoSummary) apiGetEconomicSummary(truckId).then(setEcoSummary).catch(() => setEcoSummary({}));
    if (tab === "expenses" && !expenses) { apiGetTruckExpenseSummary(truckId).then(setExpSummary).catch(()=>{}); import("../api").then(a=>a.apiGetTruckExpenses(truckId)).then(d=>setExpenses(d||[])).catch(()=>setExpenses([])); }
    if (tab === "incomes" && !incomes) apiGetTruckIncomes(truckId).then(d=>setIncomes(d||[])).catch(()=>setIncomes([]));
    if (tab === "movements" && !movements) { apiGetTruckMovements(truckId).then(d=>setMovements(d||[])).catch(()=>setMovements([])); if (!locations) import("../api").then(a=>a.apiGetFields?.()??a.default?.apiGetFields?.()).catch(()=>null).then(d=>setLocations(d||[])).catch(()=>setLocations([])); }
    if (tab === "freights" && !freightHistory) apiGetTruckFreights(truckId).then(d=>setFreightHistory(d||[])).catch(()=>setFreightHistory([]));
    // Load allDocs for any tab that needs them (incomes, expenses, movements, docs)
    if (["incomes","expenses","movements","docs"].includes(tab) && !allDocs) apiGetTruckDocuments(truckId).then(d=>setAllDocs(d||[])).catch(()=>setAllDocs([]));
  }, [tab, truck]);

  // Poll for OCR processing completion
  useEffect(() => {
    if (tab !== "docs" || !allDocs) return;
    const hasProcessing = allDocs.some(d => d.ocrStatus === "pending" || d.ocrStatus === "processing");
    if (!hasProcessing) return;
    const timer = setInterval(() => {
      apiGetTruckDocuments(truckId).then(d => {
        setAllDocs(d || []);
        if (!d?.some(doc => doc.ocrStatus === "pending" || doc.ocrStatus === "processing")) clearInterval(timer);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [tab, allDocs, truckId]);

  // ======================== CRUD HELPERS ==================================

  const crud = (apiFn, refreshKey) => async (body) => {
    setSaving(true);
    try { await apiFn(body); setShowForm(false); setEditItem(null); setDoneMsg("Listo");
      if (refreshKey === "inc") setIncomes(null);
      if (refreshKey === "exp") { setExpenses(null); setExpSummary(null); }
      if (refreshKey === "mov") setMovements(null);
      if (refreshKey === "doc") { await load(); setAllDocs(null); }
      setEcoSummary(null); // refresh summary
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleAddDoc = crud((b) => apiAddTruckDocument(truckId, b), "doc");
  const handleUpdateDoc = crud((b) => apiUpdateTruckDocument(truckId, editItem.id, b), "doc");
  const handleDeleteDoc = async (id) => { setSaving(true); try { await apiDeleteTruckDocument(truckId, id); setConfirmDelete(null); setDoneMsg("Eliminado"); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };

  const handleAddExp = crud((b) => apiAddTruckExpense(truckId, b), "exp");
  const handleUpdateExp = crud((b) => apiUpdateTruckExpense(truckId, editItem.id, b), "exp");
  const handleDeleteExp = async (id) => { setSaving(true); try { await apiDeleteTruckExpense(truckId, id); setConfirmDelete(null); setDoneMsg("Eliminado"); setExpenses(null); setExpSummary(null); setEcoSummary(null); } catch (e) { setError(e.message); } finally { setSaving(false); } };

  const handleAddInc = crud((b) => apiAddTruckIncome(truckId, b), "inc");
  const handleUpdateInc = crud((b) => apiUpdateTruckIncome(truckId, editItem.id, b), "inc");
  const handleDeleteInc = async (id) => { setSaving(true); try { await apiDeleteTruckIncome(truckId, id); setConfirmDelete(null); setDoneMsg("Eliminado"); setIncomes(null); setEcoSummary(null); } catch (e) { setError(e.message); } finally { setSaving(false); } };

  const handleAddMov = crud((b) => apiAddTruckMovement(truckId, b), "mov");
  const handleUpdateMov = crud((b) => apiUpdateTruckMovement(truckId, editItem.id, b), "mov");
  const handleDeleteMov = async (id) => { setSaving(true); try { await apiDeleteTruckMovement(truckId, id); setConfirmDelete(null); setDoneMsg("Eliminado"); setMovements(null); setEcoSummary(null); } catch (e) { setError(e.message); } finally { setSaving(false); } };

  const handleSaveTripData = async (body) => {
    if (!tripDataFor) return;
    setSaving(true);
    try {
      await apiUpdateTripData(tripDataFor.freightId, tripDataFor.assignmentId, body);
      setTripDataFor(null); setDoneMsg("Datos de viaje guardados");
      setFreightHistory(null); setEcoSummary(null); // reload
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // Upload file and link to income/expense/movement
  const handleInlineUpload = async (file, linkField, linkId) => {
    if (!file) return;
    setSaving(true);
    try {
      const cid = user?.activeCompanyId || "shared";
      const fileUrl = await uploadPhoto(file, `truck-docs/${cid}/${truckId}`, "doc");
      await apiAddTruckDocument(truckId, {
        type: "OTHER", fileUrl, fileName: file.name, mimeType: file.type,
        [linkField]: linkId,
      });
      setDoneMsg("Archivo subido");
      // Reload docs immediately so the file shows in the expanded item
      const freshDocs = await apiGetTruckDocuments(truckId).catch(() => []);
      setAllDocs(freshDocs);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleOcr = async (file) => {
    if (!file?.id) return;
    setOcrLoading(true);
    try {
      await apiProcessTruckDocOcr(truckId, file.id);
      setDoneMsg("Procesando documento con IA...");
      setAllDocs(null); // refresh to pick up ocrStatus change
    } catch (e) { setError(e.message); }
    finally { setOcrLoading(false); }
  };

  const openFile = (d) => setViewFile({ id: d.id, url: d.fileUrl, name: d.fileName || d.name, type: d.mimeType?.startsWith("image") ? "image" : d.mimeType, ocrData: d.ocrData, ocrStatus: d.ocrStatus });

  // ======================== RENDER =======================================

  if (loading) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><Loader/></div>;
  if (error && !truck) return <div style={{padding:20}}><button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT,fontSize:14,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button><EmptyState icon={Ic.warn(C.err,28)} title="Error" subtitle={error}/></div>;

  // Linked truck: show basic info only
  if (truck && truck.isOwn === false) return (
    <div style={{flex:1,overflow:"auto"}}>
      <div style={{position:"sticky",top:0,zIndex:10,background:C.bg,padding:"14px 18px 0"}}><button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT,fontSize:14,fontWeight:600,color:C.pri,marginBottom:8,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Flota</button></div>
      <div style={{padding:"0 18px 24px"}}>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius:R.xl,padding:20,boxShadow:C.shMd}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}><LicensePlate plate={truck.plate} size="lg"/><div><span style={{fontSize:9.5,fontWeight:700,color:C.sec,background:C.secPale,padding:"2px 8px",borderRadius:R.pill}}>Vinculado</span>{truck.model && <div style={{fontSize:13,color:C.t3,marginTop:4}}>{truck.model}</div>}</div></div>
          {truck.assignedUser && <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.bg,borderRadius:R.md}}>{Ic.user(C.pri,16)}<span style={{fontSize:13,fontWeight:600,color:C.t1}}>{truck.assignedUser.name}</span></div>}
          <div style={{marginTop:12,fontSize:13,color:C.t3}}>Este camión pertenece a otra empresa. Solo podés asignarlo a fletes.</div>
        </div>
      </div>
    </div>
  );

  const docs = truck?.documents || [];
  const docSum = truck?.docsSummary || {};
  const eco = ecoSummary || {};
  const TABS = [
    { key:"summary", label:"Resumen" },
    { key:"freights", label:"Fletes" },
    { key:"movements", label:"Movimientos" },
    { key:"incomes", label:"Ingresos" },
    { key:"expenses", label:"Gastos" },
    { key:"docs", label:"Documentos" },
  ];

  return (
    <div style={{ flex:1, overflow:"auto" }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}

      {/* Sticky header + tabs */}
      <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"14px 18px 0" }}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT,fontSize:14,fontWeight:600,color:C.pri,marginBottom:8,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Flota</button>

        {/* Header compact */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <LicensePlate plate={truck.plate} size={isDesktop?"lg":"md"}/>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            {truck.model && <span style={{fontSize:12,color:C.t3}}>{truck.model}</span>}
            {truck.currentOdometer && <span style={{fontSize:10,color:C.t3,fontFamily:MONO}}>{Number(truck.currentOdometer).toLocaleString("es-UY")} km</span>}
            {docSum.expired>0 && <span style={{background:C.errPale,color:C.err,fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:R.pill}}>{docSum.expired} venc.</span>}
          </div>
        </div>

        {/* Tab bar — grid 3x2 on mobile, flex row on desktop */}
        {isDesktop ? (
          <div style={{display:"flex",gap:0,borderRadius:R.md,overflow:"hidden",border:`1.5px solid ${C.b1}`,marginBottom:0}}>
            {TABS.map((t,i)=><button key={t.key} onClick={()=>{setTab(t.key);setShowForm(false);setEditItem(null);}} style={{flex:1,padding:"8px 0",fontFamily:FONT,fontSize:11.5,fontWeight:tab===t.key?700:500,background:tab===t.key?C.pri:C.w,color:tab===t.key?C.tOn:C.t2,border:"none",cursor:"pointer",textAlign:"center",borderLeft:i>0?`1px solid ${C.b1}`:"none"}}>{t.label}</button>)}
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:C.b1,borderRadius:R.md,overflow:"hidden",marginBottom:0}}>
            {TABS.map(t=><button key={t.key} onClick={()=>{setTab(t.key);setShowForm(false);setEditItem(null);}} style={{padding:"10px 4px",fontFamily:FONT,fontSize:12,fontWeight:tab===t.key?700:500,background:tab===t.key?C.pri:C.w,color:tab===t.key?C.tOn:C.t2,border:"none",cursor:"pointer",textAlign:"center",minHeight:44}}>{t.label}</button>)}
          </div>
        )}
      </div>

      <div style={{ padding:"14px 18px 24px" }}>

        {/* ==================== SUMMARY TAB ==================== */}
        {tab === "summary" && (ecoSummary === null ? <Loader/> : <>
          {/* Result row */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <Stat label="Ingresos" value={fmtMoney(eco.income?.paid||0)} color={C.ok}/>
            <Stat label="Gastos" value={fmtMoney(eco.expenses?.total||0)} color={C.err}/>
            <Stat label="Resultado" value={fmtMoney(eco.net||0)} color={(eco.net||0)>=0?C.ok:C.err}/>
          </div>
          {/* Ops row */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <Stat label="Km totales" value={fmtKm(eco.km?.total||0)}/>
            <Stat label="Viajes" value={eco.trips?.total||0}/>
            <Stat label="Horas" value={`${eco.hours||0}h`}/>
            <Stat label="km/litro" value={eco.fuel?.kmPerLiter||"—"}/>
          </div>
          {/* Efficiency */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <Stat label="Costo/km" value={eco.costPerKm?fmtMoney(eco.costPerKm):"—"}/>
            <Stat label="Ingreso/km" value={eco.incomePerKm?fmtMoney(eco.incomePerKm):"—"}/>
            <Stat label="Km productivos" value={eco.km?.productivePercent!=null?`${eco.km.productivePercent}%`:"—"}/>
          </div>
          {/* Expense breakdown */}
          {eco.expenses?.byType?.length > 0 && <>
            <div style={{fontSize:12,fontWeight:700,color:C.t2,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Desglose de gastos</div>
            {eco.expenses.byType.sort((a,b)=>Number(b.total)-Number(a.total)).map(t=>{
              const pct = eco.expenses.total > 0 ? Math.round(Number(t.total)/Number(eco.expenses.total)*100) : 0;
              return <div key={t.type} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:12,color:C.t2,minWidth:100}}>{EXP_TYPE_LABELS[t.type]||t.type}</span>
                <div style={{flex:1,height:8,background:C.bg,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:C.acc,borderRadius:4}}/></div>
                <span style={{fontSize:11,fontWeight:600,color:C.t1,minWidth:70,textAlign:"right"}}>{fmtMoney(t.total)} ({pct}%)</span>
              </div>;
            })}
          </>}
          {/* Income status */}
          {(eco.income?.pending>0||eco.income?.overdue>0) && <div style={{display:"flex",gap:8,marginTop:12}}>
            <Stat label="Pendiente" value={fmtMoney(eco.income?.pending||0)} color={C.warn}/>
            <Stat label="Vencido" value={fmtMoney(eco.income?.overdue||0)} color={C.err}/>
          </div>}
          {!eco.km?.total && !eco.income?.total && <EmptyState icon={Ic.truck(C.t3,24)} title="Sin datos" subtitle="Registrá ingresos, gastos y datos de viaje para ver el rendimiento"/>}
        </>)}

        {/* ==================== FREIGHTS TAB ==================== */}
        {tab === "freights" && <>
          {truck.activeFreights?.length > 0 && <>
            <div style={{fontSize:12,fontWeight:700,color:C.t2,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Activos</div>
            {truck.activeFreights.map(f=><div key={f.id} onClick={()=>onNavFreight?.(f.id)} style={{padding:"10px 12px",border:`1.5px solid ${C.pri}`,borderRadius:R.md,marginBottom:8,cursor:"pointer",background:C.priPale}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13.5,fontWeight:700,color:C.pri,fontFamily:MONO}}>{f.code}</span><StatusPill status={f.tripStatus || f.status} small/></div>
              <div style={{fontSize:12,color:C.t2,marginTop:4}}>{f.originName||"?"}→{f.destName||"?"}</div>
            </div>)}
          </>}
          <div style={{fontSize:12,fontWeight:700,color:C.t2,marginBottom:8,marginTop:truck.activeFreights?.length?12:0,textTransform:"uppercase",letterSpacing:0.5}}>Historial</div>
          {tripDataFor && <TripDataForm freight={tripDataFor} onSave={handleSaveTripData} onCancel={()=>setTripDataFor(null)} saving={saving}/>}
          {freightHistory===null?<Loader/>:freightHistory.length===0?<EmptyState icon={Ic.truck(C.t3,20)} title="Sin historial" subtitle="Este camión aún no completó fletes"/>:
            freightHistory.map((f,i)=><div key={i} style={{padding:"8px 12px",borderBottom:`1px solid ${C.b2}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>onNavFreight?.(f.freightId)}>
                <span style={{fontSize:12.5,fontWeight:700,color:C.pri,fontFamily:MONO,minWidth:110}}>{f.code}</span>
                <span style={{flex:1,fontSize:12,color:C.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.origin||"?"}→{f.dest||"?"}</span>
                <span style={{fontSize:11,color:C.t3}}>{fmtDate(f.date)}</span>
                {f.tons&&<span style={{fontSize:11,fontWeight:600,color:C.t2}}>{Number(f.tons).toLocaleString("es-UY")}t</span>}
                {f.kmTotal?<span style={{fontSize:9,color:C.ok}} title="Datos de viaje cargados">✓ {fmtKm(f.kmTotal)}</span>:<span style={{fontSize:9,color:C.t3,background:C.bg,padding:"1px 4px",borderRadius:R.pill}} title="Sin datos de viaje">km?</span>}
              </div>
              {canEdit && f.assignmentId && <div style={{marginTop:4}}>
                <button onClick={e=>{e.stopPropagation();setTripDataFor(tripDataFor?.assignmentId===f.assignmentId?null:f);}} style={{background:"none",border:`1px solid ${C.b1}`,borderRadius:R.md,padding:"3px 8px",cursor:"pointer",fontSize:10.5,fontWeight:600,color:f.kmTotal?C.pri:C.acc,fontFamily:FONT}}>{f.kmTotal?"Editar datos de viaje":"Cargar datos de viaje"}</button>
              </div>}
            </div>)
          }
        </>}

        {/* ==================== INCOMES TAB ==================== */}
        {tab === "incomes" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo ingreso"}</Btn></div>}
          {showForm && <IncForm onSave={handleAddInc} onCancel={()=>setShowForm(false)} saving={saving} freights={freightHistory} mobile={!isDesktop} storagePath={storePath}/>}
          {editItem && tab==="incomes" && <IncForm initial={editItem} onSave={handleUpdateInc} onCancel={()=>setEditItem(null)} saving={saving} freights={freightHistory} mobile={!isDesktop} storagePath={storePath}/>}
          {incomes===null?<Loader/>:incomes.length===0&&!showForm?<EmptyState icon={Ic.doc(C.t3,20)} title="Sin ingresos" subtitle="Registrá el primer ingreso del camión"/>:
            incomes.map(inc=>{
              const st = INC_STATUS[inc.status]||INC_STATUS.PENDING;
              const isExp = expandedItem === `inc-${inc.id}`;
              const incDocs = (allDocs||[]).filter(d=>d.incomeId===inc.id);
              return <div key={inc.id} style={{borderBottom:`1px solid ${C.b2}`,background:isExp?C.bg:"transparent",borderRadius:isExp?R.md:0}}>
                <div onClick={()=>setExpandedItem(isExp?null:`inc-${inc.id}`)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:C.t1}}>{inc.concept}</span><span style={{fontSize:10,fontWeight:700,color:st.color,background:st.bg,padding:"1px 6px",borderRadius:R.pill}}>{st.label}</span></div>
                    {inc.freight&&<span style={{fontSize:10.5,color:C.pri,fontWeight:600}}>{inc.freight.code}</span>}
                    <div style={{fontSize:11,color:C.t3,marginTop:2}}>{fmtDate(inc.date)}{inc.invoiceNumber?` · Fact: ${inc.invoiceNumber}`:""}{incDocs.length>0?` · 📎 ${incDocs.length}`:""}</div>
                  </div>
                  <span style={{fontSize:14,fontWeight:700,color:st.color,whiteSpace:"nowrap"}}>{fmtMoney(inc.amount,inc.currency)}</span>
                  <span style={{fontSize:14,color:C.t3,transition:"transform 0.2s",transform:isExp?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                </div>
                {isExp && <div style={{padding:"0 12px 12px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    {canEdit&&<button onClick={()=>setEditItem(inc)} style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.b1}`,background:C.w,cursor:"pointer",fontSize:11,fontWeight:600,color:C.t2,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.edit(C.t3,12)} Editar</button>}
                    {canEdit&&<label style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.pri}40`,background:C.priPale,cursor:"pointer",fontSize:11,fontWeight:600,color:C.pri,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.clip(C.pri,12)} Adjuntar<input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleInlineUpload(e.target.files[0],"incomeId",inc.id);e.target.value="";}}/></label>}
                    {canEdit&&<button onClick={()=>setConfirmDelete({type:"inc",id:inc.id,label:inc.concept})} style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.err}40`,background:C.errPale,cursor:"pointer",fontSize:11,fontWeight:600,color:C.err,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.ban(C.err,12)} Eliminar</button>}
                  </div>
                  {incDocs.length>0 && <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Archivos ({incDocs.length})</div>
                    {incDocs.map(d=>{
                      const isImg = d.mimeType?.startsWith("image")||d.fileUrl?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                      return <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:8,background:C.w,border:`1px solid ${C.b2}`,borderRadius:R.md}}>
                        <button onClick={()=>openFile(d)} style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,textAlign:"left",padding:0}}>
                          {isImg?<img src={d.fileUrl} alt="" style={{width:48,height:48,borderRadius:R.sm,objectFit:"cover",flexShrink:0}}/>:<div style={{width:48,height:48,borderRadius:R.sm,background:C.priPale,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.doc(C.pri,20)}</div>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.t1,wordBreak:"break-all"}}>{d.fileName||"Archivo"}</div>
                            <div style={{fontSize:10.5,color:C.t3}}>{DOC_TYPE_LABELS[d.type]||d.type} · {fmtDate(d.createdAt)}</div>
                          </div>
                        </button>
                        <button onClick={()=>openFile(d)} style={{padding:6,borderRadius:R.sm,border:`1px solid ${C.b1}`,background:C.bg,cursor:"pointer",display:"flex"}}>{Ic.eye(C.t2,14)}</button>
                        {d.ocrStatus==="completed"&&<span style={{fontSize:10,color:C.pri}}>✨</span>}
                      </div>;
                    })}
                  </div>}
                  {incDocs.length===0&&<div style={{fontSize:12,color:C.t3,fontStyle:"italic"}}>Sin archivos adjuntos</div>}
                </div>}
              </div>;
            })
          }
        </>}

        {/* ==================== EXPENSES TAB ==================== */}
        {tab === "expenses" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo gasto"}</Btn></div>}
          {expSummary && <div style={{display:"flex",gap:10,marginBottom:12}}><Stat label="Este mes" value={fmtMoney(expSummary.thisMonth)}/><Stat label="Mes anterior" value={fmtMoney(expSummary.prevMonth)} color={C.t3}/></div>}
          {showForm && <ExpForm onSave={handleAddExp} onCancel={()=>setShowForm(false)} saving={saving} activeFreights={truck.activeFreights} mobile={!isDesktop} storagePath={storePath}/>}
          {editItem && tab==="expenses" && <ExpForm initial={editItem} onSave={handleUpdateExp} onCancel={()=>setEditItem(null)} saving={saving} activeFreights={truck.activeFreights} mobile={!isDesktop} storagePath={storePath}/>}
          {expenses===null?<Loader/>:expenses.length===0&&!showForm?<EmptyState icon={Ic.doc(C.t3,20)} title="Sin gastos" subtitle="Registrá el primer gasto del camión"/>:
            expenses.map(e=>{
              const isExp = expandedItem === `exp-${e.id}`;
              const expDocs = (allDocs||[]).filter(d=>d.expenseId===e.id);
              return <div key={e.id} style={{borderBottom:`1px solid ${C.b2}`,background:isExp?C.bg:"transparent",borderRadius:isExp?R.md:0}}>
                <div onClick={()=>setExpandedItem(isExp?null:`exp-${e.id}`)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:C.t1}}>{EXP_TYPE_LABELS[e.type]||e.type}</span>{e.freight&&<span style={{fontSize:10.5,color:C.pri,fontWeight:600}}>{e.freight.code}</span>}</div>
                    {e.description&&<div style={{fontSize:11.5,color:C.t3,marginTop:2}}>{e.description}</div>}
                    <div style={{fontSize:11,color:C.t3,marginTop:2}}>{fmtDate(e.date)}{expDocs.length>0?` · 📎 ${expDocs.length}`:""}{e.receiptUrl&&!expDocs.length?" · 📎 1":""}</div>
                  </div>
                  <span style={{fontSize:14,fontWeight:700,color:C.t1,whiteSpace:"nowrap"}}>{fmtMoney(e.amount,e.currency)}</span>
                  <span style={{fontSize:14,color:C.t3,transition:"transform 0.2s",transform:isExp?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                </div>
                {isExp && <div style={{padding:"0 12px 12px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    {canEdit&&<button onClick={()=>setEditItem(e)} style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.b1}`,background:C.w,cursor:"pointer",fontSize:11,fontWeight:600,color:C.t2,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.edit(C.t3,12)} Editar</button>}
                    {canEdit&&<label style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.pri}40`,background:C.priPale,cursor:"pointer",fontSize:11,fontWeight:600,color:C.pri,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.clip(C.pri,12)} Adjuntar<input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e2=>{if(e2.target.files?.[0])handleInlineUpload(e2.target.files[0],"expenseId",e.id);e2.target.value="";}}/></label>}
                    {canEdit&&<button onClick={()=>setConfirmDelete({type:"exp",id:e.id,label:EXP_TYPE_LABELS[e.type]})} style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.err}40`,background:C.errPale,cursor:"pointer",fontSize:11,fontWeight:600,color:C.err,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.ban(C.err,12)} Eliminar</button>}
                  </div>
                  {/* Legacy receipt URL */}
                  {e.receiptUrl&&!expDocs.length&&<div style={{display:"flex",alignItems:"center",gap:10,padding:8,background:C.w,border:`1px solid ${C.b2}`,borderRadius:R.md,marginBottom:6}}>
                    <button onClick={()=>setViewFile({url:e.receiptUrl,name:e.receiptName||"Comprobante",type:"document"})} style={{display:"flex",alignItems:"center",gap:10,flex:1,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,textAlign:"left",padding:0}}>
                      <div style={{width:48,height:48,borderRadius:R.sm,background:C.priPale,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.doc(C.pri,20)}</div>
                      <div><div style={{fontSize:12,fontWeight:600,color:C.t1}}>{e.receiptName||"Comprobante"}</div><div style={{fontSize:10.5,color:C.t3}}>{fmtDate(e.date)}</div></div>
                    </button>
                    <button onClick={()=>setViewFile({url:e.receiptUrl,name:e.receiptName||"Comprobante",type:"document"})} style={{padding:6,borderRadius:R.sm,border:`1px solid ${C.b1}`,background:C.bg,cursor:"pointer",display:"flex"}}>{Ic.eye(C.t2,14)}</button>
                  </div>}
                  {/* Linked TruckDocuments */}
                  {expDocs.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.t2,textTransform:"uppercase",letterSpacing:0.5}}>Archivos ({expDocs.length})</div>
                    {expDocs.map(d=>{
                      const isImg = d.mimeType?.startsWith("image")||d.fileUrl?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                      return <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:8,background:C.w,border:`1px solid ${C.b2}`,borderRadius:R.md}}>
                        <button onClick={()=>openFile(d)} style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,textAlign:"left",padding:0}}>
                          {isImg?<img src={d.fileUrl} alt="" style={{width:48,height:48,borderRadius:R.sm,objectFit:"cover",flexShrink:0}}/>:<div style={{width:48,height:48,borderRadius:R.sm,background:C.priPale,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.doc(C.pri,20)}</div>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.t1,wordBreak:"break-all"}}>{d.fileName||"Archivo"}</div>
                            <div style={{fontSize:10.5,color:C.t3}}>{DOC_TYPE_LABELS[d.type]||d.type} · {fmtDate(d.createdAt)}</div>
                          </div>
                        </button>
                        <button onClick={()=>openFile(d)} style={{padding:6,borderRadius:R.sm,border:`1px solid ${C.b1}`,background:C.bg,cursor:"pointer",display:"flex"}}>{Ic.eye(C.t2,14)}</button>
                        {d.ocrStatus==="completed"&&<span style={{fontSize:10,color:C.pri}}>✨</span>}
                      </div>;
                    })}
                  </div>}
                  {!expDocs.length&&!e.receiptUrl&&<div style={{fontSize:12,color:C.t3,fontStyle:"italic"}}>Sin archivos adjuntos</div>}
                </div>}
              </div>;
            })
          }
        </>}

        {/* ==================== MOVEMENTS TAB ==================== */}
        {tab === "movements" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo movimiento"}</Btn></div>}
          {showForm && <MovForm onSave={handleAddMov} onCancel={()=>setShowForm(false)} saving={saving} locations={locations} mobile={!isDesktop}/>}
          {editItem && tab==="movements" && <MovForm initial={editItem} onSave={handleUpdateMov} onCancel={()=>setEditItem(null)} saving={saving} locations={locations} mobile={!isDesktop}/>}
          {movements===null?<Loader/>:movements.length===0&&!showForm?<EmptyState icon={Ic.truck(C.t3,20)} title="Sin movimientos" subtitle="Registrá viajes que no son fletes de la plataforma"/>:
            movements.map(m=>{
              const isMExp = expandedItem === `mov-${m.id}`;
              const movDocs = (allDocs||[]).filter(d=>d.movementId===m.id);
              return <div key={m.id} style={{borderBottom:`1px solid ${C.b2}`,background:isMExp?C.bg:"transparent",borderRadius:isMExp?R.md:0}}>
                <div onClick={()=>setExpandedItem(isMExp?null:`mov-${m.id}`)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{MOV_TYPE_LABELS[m.type]||m.type}</div>
                    {(m.originName||m.destName)&&<div style={{fontSize:12,color:C.t2,marginTop:2}}>{m.originName||"?"}→{m.destName||"?"}</div>}
                    <div style={{fontSize:11,color:C.t3,marginTop:2}}>
                      {fmtDate(m.departureAt)}
                      {m.kmDriven?` · ${Number(m.kmDriven).toLocaleString("es-UY")} km`:""}
                      {movDocs.length>0?` · 📎 ${movDocs.length}`:""}
                    </div>
                  </div>
                  {m.driver&&<span style={{fontSize:11,color:C.pri,fontWeight:600}}>{m.driver.name}</span>}
                  <span style={{fontSize:14,color:C.t3,transition:"transform 0.2s",transform:isMExp?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
                </div>
                {isMExp && <div style={{padding:"0 12px 12px"}}>
                  {m.description&&<div style={{fontSize:11.5,color:C.t3,marginBottom:6}}>{m.description}</div>}
                  {m.fuelLiters&&<div style={{fontSize:11,color:C.t3,marginBottom:6}}>Combustible: {m.fuelLiters}L{m.fuelCost?` · ${fmtMoney(m.fuelCost)}`:""}{m.tollCost?` · Peajes: ${fmtMoney(m.tollCost)}`:""}</div>}
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    {canEdit&&<button onClick={()=>setEditItem(m)} style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.b1}`,background:C.w,cursor:"pointer",fontSize:11,fontWeight:600,color:C.t2,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.edit(C.t3,12)} Editar</button>}
                    {canEdit&&<label style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.pri}40`,background:C.priPale,cursor:"pointer",fontSize:11,fontWeight:600,color:C.pri,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.clip(C.pri,12)} Adjuntar<input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleInlineUpload(e.target.files[0],"movementId",m.id);e.target.value="";}}/></label>}
                    {canEdit&&<button onClick={()=>setConfirmDelete({type:"mov",id:m.id,label:MOV_TYPE_LABELS[m.type]})} style={{padding:"4px 10px",borderRadius:R.md,border:`1px solid ${C.err}40`,background:C.errPale,cursor:"pointer",fontSize:11,fontWeight:600,color:C.err,fontFamily:FONT,display:"flex",alignItems:"center",gap:4}}>{Ic.ban(C.err,12)} Eliminar</button>}
                  </div>
                  {movDocs.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {movDocs.map(d=>{
                      const isImg = d.mimeType?.startsWith("image")||d.fileUrl?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                      return <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:8,background:C.w,border:`1px solid ${C.b2}`,borderRadius:R.md}}>
                        <button onClick={()=>openFile(d)} style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,textAlign:"left",padding:0}}>
                          {isImg?<img src={d.fileUrl} alt="" style={{width:48,height:48,borderRadius:R.sm,objectFit:"cover",flexShrink:0}}/>:<div style={{width:48,height:48,borderRadius:R.sm,background:C.priPale,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.doc(C.pri,20)}</div>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:C.t1,wordBreak:"break-all"}}>{d.fileName||"Archivo"}</div>
                            <div style={{fontSize:10.5,color:C.t3}}>{fmtDate(d.createdAt)}</div>
                          </div>
                        </button>
                        <button onClick={()=>openFile(d)} style={{padding:6,borderRadius:R.sm,border:`1px solid ${C.b1}`,background:C.bg,cursor:"pointer",display:"flex"}}>{Ic.eye(C.t2,14)}</button>
                      </div>;
                    })}
                  </div>}
                </div>}
              </div>;
            })
          }
        </>}

        {/* ==================== DOCUMENTS TAB ==================== */}
        {tab === "docs" && (()=>{
          const LINK_BADGE = { general:{label:"General",bg:C.bg,color:C.t3}, expense:{label:"Gasto",bg:C.errPale,color:C.err}, income:{label:"Ingreso",bg:C.okPale,color:C.ok}, freight:{label:"Flete",bg:C.secPale,color:C.sec}, movement:{label:"Movimiento",bg:C.accPale,color:C.acc} };
          const displayDocs = allDocs ? (docFilter==="all" ? allDocs : allDocs.filter(d=>d.linkedType===(docFilter==="general"?"general":docFilter))) : docs;
          const linkOpts = { expenses:(expenses||[]).map(e=>({id:e.id,label:`${EXP_TYPE_LABELS[e.type]||e.type} — ${fmtDate(e.date)}`})), incomes:(incomes||[]).map(i=>({id:i.id,label:`${i.concept} — ${fmtDate(i.date)}`})), freights:(freightHistory||[]).map(f=>({id:f.freightId||f.id,label:f.code})), movements:(movements||[]).map(m=>({id:m.id,label:`${MOV_TYPE_LABELS[m.type]||m.type} — ${fmtDate(m.departureAt)}`})) };
          return <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {["all","general","expense","income","freight","movement"].map(f=><button key={f} onClick={()=>setDocFilter(f)} style={{padding:"3px 8px",borderRadius:R.pill,border:`1px solid ${docFilter===f?C.pri:C.b1}`,background:docFilter===f?C.priPale:C.w,color:docFilter===f?C.pri:C.t3,fontSize:10.5,fontWeight:600,cursor:"pointer",fontFamily:FONT}}>{f==="all"?"Todos":f==="general"?"General":f==="expense"?"Gastos":f==="income"?"Ingresos":f==="freight"?"Fletes":"Movimientos"}</button>)}
            </div>
            {canEdit && <Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"":"Nuevo"}</Btn>}
          </div>
          {docSum.valid+docSum.expiringSoon+docSum.expired>0&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {docSum.valid>0&&<span style={{fontSize:11,fontWeight:600,color:C.ok,background:C.okPale,padding:"3px 10px",borderRadius:R.pill}}>✅ {docSum.valid}</span>}
            {docSum.expiringSoon>0&&<span style={{fontSize:11,fontWeight:600,color:C.warn,background:C.warnPale,padding:"3px 10px",borderRadius:R.pill}}>⚠️ {docSum.expiringSoon}</span>}
            {docSum.expired>0&&<span style={{fontSize:11,fontWeight:600,color:C.err,background:C.errPale,padding:"3px 10px",borderRadius:R.pill}}>❌ {docSum.expired}</span>}
          </div>}
          {showForm && <DocForm onSave={handleAddDoc} onCancel={()=>setShowForm(false)} saving={saving} linkOptions={linkOpts} storagePath={storePath}/>}
          {editItem && tab==="docs" && <DocForm initial={editItem} onSave={handleUpdateDoc} onCancel={()=>setEditItem(null)} saving={saving} linkOptions={linkOpts} storagePath={storePath}/>}
          {displayDocs.length===0&&!showForm?<EmptyState icon={Ic.doc(C.t3,24)} title="Sin documentos" subtitle="Cargá el primer documento del camión"/>:
            displayDocs.map(d=>{
              const lb = LINK_BADGE[d.linkedType||"general"]||LINK_BADGE.general;
              const linkLabel = d.linkedType==="expense"&&d.expense?`${EXP_TYPE_LABELS[d.expense.type]||""} ${fmtDate(d.expense.date)}`:d.linkedType==="income"&&d.income?d.income.concept:d.linkedType==="freight"&&d.freight?d.freight.code:d.linkedType==="movement"&&d.movement?`${MOV_TYPE_LABELS[d.movement.type]||""} ${fmtDate(d.movement.departureAt)}`:"";
              const isImg = d.mimeType?.startsWith("image")||d.fileUrl?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
              const ab = {padding:6,minWidth:36,minHeight:36,borderRadius:R.sm,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}; // action button base
              return <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,padding:8,background:C.bg,border:`1px solid ${C.b2}`,borderRadius:R.md,marginBottom:6}}>
              {/* Thumbnail */}
              <button onClick={()=>openFile(d)} style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,textAlign:"left",padding:0}}>
                {isImg?<img src={d.fileUrl} alt="" loading="lazy" style={{width:48,height:48,borderRadius:R.sm,objectFit:"cover",flexShrink:0}} onError={e=>{e.target.style.display="none"}}/>:<div style={{width:48,height:48,borderRadius:R.sm,background:C.priPale,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{Ic.doc(C.pri,20)}</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12.1,fontWeight:600,color:C.t1,wordBreak:"break-all"}}>{d.fileName||d.name||"Archivo"}</div>
                  <div style={{fontSize:11,color:C.t3,marginTop:2,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                    <span>{DOC_TYPE_LABELS[d.type]||d.type}{d.createdAt?` · ${fmtDate(d.createdAt)}`:""}</span>
                    <span style={{fontSize:9.5,fontWeight:700,color:lb.color,background:lb.bg,padding:"1px 5px",borderRadius:R.sm}}>{lb.label}{linkLabel?`: ${linkLabel}`:""}</span>
                  </div>
                </div>
              </button>
              {/* Action buttons: view, download, edit, delete — matching freight docs */}
              <button onClick={()=>openFile(d)} title="Ver" style={{...ab,border:`1px solid ${C.b1}`,background:C.w}}>{Ic.eye(C.t2,14)}</button>
              <a href={d.fileUrl} download title="Descargar" style={{...ab,border:`1px solid ${C.b1}`,background:C.w,textDecoration:"none"}}>{Ic.down(C.t2,14)}</a>
              {canEdit&&<button onClick={()=>setEditItem(d)} title="Editar" style={{...ab,border:`1px solid ${C.b1}`,background:C.w}}>{Ic.edit(C.t3,14)}</button>}
              {canEdit&&<button onClick={()=>setConfirmDelete({type:"doc",id:d.id,label:DOC_TYPE_LABELS[d.type]})} title="Eliminar" style={{...ab,border:`1px solid ${C.err}40`,background:C.errPale}}>{Ic.cross(C.err,14)}</button>}
            </div>})
          }
        </>})()}
      </div>

      {/* ==================== FILE VIEWER ==================== */}
      <FileViewer
        file={viewFile}
        onClose={() => setViewFile(null)}
        onOcr={handleOcr}
        ocrLoading={ocrLoading}
      />

      {/* ==================== DELETE CONFIRMATION ==================== */}
      {confirmDelete && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.w,borderRadius:R.xl,padding:24,maxWidth:340,width:"90%",boxShadow:C.shLg}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>¿Eliminar {confirmDelete.label}?</div>
            <div style={{fontSize:13,color:C.t3,marginBottom:16}}>Esta acción no se puede deshacer.</div>
            <div style={{display:"flex",gap:8}}>
              <Btn v="muted" full onClick={()=>setConfirmDelete(null)}>Cancelar</Btn>
              <Btn v="err" full onClick={()=>{
                if(confirmDelete.type==="doc") handleDeleteDoc(confirmDelete.id);
                else if(confirmDelete.type==="exp") handleDeleteExp(confirmDelete.id);
                else if(confirmDelete.type==="inc") handleDeleteInc(confirmDelete.id);
                else if(confirmDelete.type==="mov") handleDeleteMov(confirmDelete.id);
              }}>Eliminar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
