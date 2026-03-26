// =====================================================================
// TOLVINK — Truck Detail Screen
// Sections: Summary | Freights | Incomes | Expenses | Movements | Docs
// =====================================================================

import { useState, useEffect, useCallback } from "react";
import { C, Ic, R, FONT, MONO } from "../theme";
import { Btn, Field, Loader, EmptyState, LicensePlate, LoadingOverlay } from "../components";
import {
  apiGetTruckDetail, apiAddTruckDocument, apiUpdateTruckDocument, apiDeleteTruckDocument,
  apiAddTruckExpense, apiUpdateTruckExpense, apiDeleteTruckExpense, apiGetTruckExpenseSummary,
  apiGetTruckFreights, apiGetTruckIncomes, apiAddTruckIncome, apiUpdateTruckIncome, apiDeleteTruckIncome,
  apiGetTruckMovements, apiAddTruckMovement, apiUpdateTruckMovement, apiDeleteTruckMovement,
  apiGetEconomicSummary, uploadPhoto,
} from "../api";

// ======================== CONSTANTS ====================================

const DOC_TYPE_LABELS = { VTV_ITV:"VTV / ITV", INSURANCE:"Seguro", TRANSPORT_LICENSE:"Habilitación de transporte", GREEN_CARD:"Cédula verde", DRIVER_LICENSE:"Licencia de conducir", RUAT:"RUAT", SENASA:"SENASA", FUMIGATION:"Certificado de fumigación", OTHER:"Otro" };
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
    <div style={{ flex:1, textAlign:"center", padding:"10px 6px", background:C.bg, borderRadius:R.md, minWidth:0 }}>
      <div style={{ fontSize:17, fontWeight:800, color, lineHeight:1.2 }}>{value}</div>
      <div style={{ fontSize:10.5, color:C.t3, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:C.t3 }}>{sub}</div>}
    </div>
  );
}

// ======================== FORMS (Doc, Exp reused from before) ============

function DocForm({ onSave, onCancel, saving, initial }) {
  const [type, setType] = useState(initial?.type||"VTV_ITV");
  const [name, setName] = useState(initial?.name||"");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt?new Date(initial.expiresAt).toISOString().split("T")[0]:"");
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt?new Date(initial.issuedAt).toISOString().split("T")[0]:"");
  const [notes, setNotes] = useState(initial?.notes||"");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handleSubmit = async()=>{if(!initial&&!file)return;setUploading(true);try{let fu=initial?.fileUrl,fn=initial?.fileName,mt=initial?.mimeType;if(file){fu=await uploadPhoto(file,"truck-docs","doc");fn=file.name;mt=file.type;}await onSave({type,name:name||null,fileUrl:fu,fileName:fn,mimeType:mt,expiresAt:expiresAt||null,issuedAt:issuedAt||null,notes:notes||null});}finally{setUploading(false);}};
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Tipo de documento</label><select value={type} onChange={e=>setType(e.target.value)} style={sel}>{Object.entries(DOC_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    {type==="OTHER"&&<Field label="Nombre" value={name} onChange={setName} placeholder="Nombre del documento"/>}
    {!initial&&<div style={{marginBottom:10}}><label style={lbl("s")}>Archivo</label><input type="file" accept="image/*,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} style={{fontSize:13,fontFamily:FONT}}/></div>}
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><label style={lbl("s")}>Emisión</label><input type="date" value={issuedAt} onChange={e=>setIssuedAt(e.target.value)} style={{...sel}}/></div><div style={{flex:1}}><label style={lbl("s")}>Vencimiento</label><input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} style={{...sel}}/></div></div>
    <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||uploading||(!initial&&!file)} onClick={handleSubmit}>{uploading?"Subiendo...":initial?"Guardar":"Agregar documento"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

function ExpForm({ onSave, onCancel, saving, initial, activeFreights }) {
  const [type, setType] = useState(initial?.type||"FUEL");
  const [amount, setAmount] = useState(initial?.amount?.toString()||"");
  const [currency, setCurrency] = useState(initial?.currency||"UYU");
  const [date, setDate] = useState(initial?.date?new Date(initial.date).toISOString().split("T")[0]:new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState(initial?.description||"");
  const [freightId, setFreightId] = useState(initial?.freightId||"");
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const handleSubmit = async()=>{if(!amount||!date)return;setUploading(true);try{let ru=initial?.receiptUrl,rn=initial?.receiptName;if(receiptFile){ru=await uploadPhoto(receiptFile,"truck-receipts","receipt");rn=receiptFile.name;}await onSave({type,amount:parseFloat(amount),currency,date,description:description||null,freightId:freightId||null,receiptUrl:ru,receiptName:rn});}finally{setUploading(false);}};
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Tipo de gasto</label><select value={type} onChange={e=>setType(e.target.value)} style={sel}>{Object.entries(EXP_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:2}}><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number"/></div><div style={{flex:1}}><label style={lbl("s")}>Moneda</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={sel}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div></div>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Fecha</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...sel}}/></div>
    <Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle del gasto"/>
    {activeFreights?.length>0&&<div style={{marginTop:10}}><label style={lbl("s")}>Flete asociado</label><select value={freightId} onChange={e=>setFreightId(e.target.value)} style={sel}><option value="">Sin flete</option>{activeFreights.map(f=><option key={f.id} value={f.id}>{f.code}</option>)}</select></div>}
    <div style={{marginTop:10}}><label style={lbl("s")}>Comprobante</label><input type="file" accept="image/*,.pdf" onChange={e=>setReceiptFile(e.target.files?.[0]||null)} style={{fontSize:13,fontFamily:FONT}}/></div>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||uploading||!amount||!date} onClick={handleSubmit}>{uploading?"Guardando...":initial?"Guardar":"Registrar gasto"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

function IncForm({ onSave, onCancel, saving, initial, freights }) {
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
  const handleSubmit = async()=>{if(!concept||!amount||!date)return;setUploading(true);try{let iu=initial?.invoiceUrl;if(invoiceFile){iu=await uploadPhoto(invoiceFile,"truck-incomes","invoice");}await onSave({concept,amount:parseFloat(amount),currency,date,status,freightId:freightId||null,invoiceNumber:invoiceNumber||null,invoiceUrl:iu,notes:notes||null});}finally{setUploading(false);}};
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <Field label="Concepto" value={concept} onChange={setConcept} placeholder="Ej: Flete Colonia → Montevideo"/>
    <div style={{display:"flex",gap:10,marginTop:10,marginBottom:10}}><div style={{flex:2}}><Field label="Monto" value={amount} onChange={setAmount} placeholder="0" type="number"/></div><div style={{flex:1}}><label style={lbl("s")}>Moneda</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={sel}><option value="UYU">UYU</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><label style={lbl("s")}>Fecha</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...sel}}/></div><div style={{flex:1}}><label style={lbl("s")}>Estado</label><select value={status} onChange={e=>setStatus(e.target.value)} style={sel}>{Object.entries(INC_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div></div>
    {freights?.length>0&&<div style={{marginBottom:10}}><label style={lbl("s")}>Flete asociado</label><select value={freightId} onChange={e=>setFreightId(e.target.value)} style={sel}><option value="">Sin flete</option>{freights.map(f=><option key={f.freightId||f.id} value={f.freightId||f.id}>{f.code}</option>)}</select></div>}
    <Field label="N° Factura (opcional)" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="Ej: A-0001-00012345"/>
    <div style={{marginTop:10}}><label style={lbl("s")}>Factura (opcional)</label><input type="file" accept="image/*,.pdf" onChange={e=>setInvoiceFile(e.target.files?.[0]||null)} style={{fontSize:13,fontFamily:FONT}}/></div>
    <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||uploading||!concept||!amount||!date} onClick={handleSubmit}>{uploading?"Guardando...":initial?"Guardar":"Registrar ingreso"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

function MovForm({ onSave, onCancel, saving, initial }) {
  const [type, setType] = useState(initial?.type||"REPOSITIONING");
  const [description, setDescription] = useState(initial?.description||"");
  const [originName, setOriginName] = useState(initial?.originName||"");
  const [destName, setDestName] = useState(initial?.destName||"");
  const [departureAt, setDepartureAt] = useState(initial?.departureAt?new Date(initial.departureAt).toISOString().slice(0,16):"");
  const [arrivalAt, setArrivalAt] = useState(initial?.arrivalAt?new Date(initial.arrivalAt).toISOString().slice(0,16):"");
  const [kmDriven, setKmDriven] = useState(initial?.kmDriven?.toString()||"");
  const [fuelLiters, setFuelLiters] = useState(initial?.fuelLiters?.toString()||"");
  const [fuelCost, setFuelCost] = useState(initial?.fuelCost?.toString()||"");
  const [tollCost, setTollCost] = useState(initial?.tollCost?.toString()||"");
  const [notes, setNotes] = useState(initial?.notes||"");
  const handleSubmit = ()=>onSave({type,description:description||null,originName:originName||null,destName:destName||null,departureAt:departureAt||null,arrivalAt:arrivalAt||null,kmDriven:kmDriven?parseFloat(kmDriven):null,fuelLiters:fuelLiters?parseFloat(fuelLiters):null,fuelCost:fuelCost?parseFloat(fuelCost):null,tollCost:tollCost?parseFloat(tollCost):null,notes:notes||null});
  return (<div style={{padding:16,background:C.bgCard,border:`1px solid ${C.b2}`,borderRadius:R.lg,marginBottom:12}}>
    <div style={{marginBottom:10}}><label style={lbl("s")}>Tipo</label><select value={type} onChange={e=>setType(e.target.value)} style={sel}>{Object.entries(MOV_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <Field label="Descripción (opcional)" value={description} onChange={setDescription} placeholder="Detalle"/>
    <div style={{display:"flex",gap:10,marginTop:10,marginBottom:10}}><div style={{flex:1}}><Field label="Origen" value={originName} onChange={setOriginName} placeholder="Ciudad/lugar"/></div><div style={{flex:1}}><Field label="Destino" value={destName} onChange={setDestName} placeholder="Ciudad/lugar"/></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><label style={lbl("s")}>Salida</label><input type="datetime-local" value={departureAt} onChange={e=>setDepartureAt(e.target.value)} style={{...sel}}/></div><div style={{flex:1}}><label style={lbl("s")}>Llegada</label><input type="datetime-local" value={arrivalAt} onChange={e=>setArrivalAt(e.target.value)} style={{...sel}}/></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><Field label="Km" value={kmDriven} onChange={setKmDriven} type="number" placeholder="0"/></div><div style={{flex:1}}><Field label="Litros" value={fuelLiters} onChange={setFuelLiters} type="number" placeholder="0"/></div></div>
    <div style={{display:"flex",gap:10,marginBottom:10}}><div style={{flex:1}}><Field label="Costo combustible" value={fuelCost} onChange={setFuelCost} type="number" placeholder="0"/></div><div style={{flex:1}}><Field label="Peajes" value={tollCost} onChange={setTollCost} type="number" placeholder="0"/></div></div>
    <Field label="Notas (opcional)" value={notes} onChange={setNotes} placeholder="Observaciones"/>
    <div style={{display:"flex",gap:8,marginTop:12}}><Btn full disabled={saving||!type} onClick={handleSubmit}>{initial?"Guardar":"Registrar movimiento"}</Btn><Btn v="muted" onClick={onCancel}>Cancelar</Btn></div>
  </div>);
}

// ======================== MAIN SCREEN ===================================

export default function TruckDetailScreen({ truckId, user, onBack, onNavFreight }) {
  const [truck, setTruck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  // Active tab
  const [tab, setTab] = useState("summary");

  // Forms & state per section
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Lazy-loaded data
  const [ecoSummary, setEcoSummary] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [expSummary, setExpSummary] = useState(null);
  const [incomes, setIncomes] = useState(null);
  const [movements, setMovements] = useState(null);
  const [freightHistory, setFreightHistory] = useState(null);

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
    if (tab === "movements" && !movements) apiGetTruckMovements(truckId).then(d=>setMovements(d||[])).catch(()=>setMovements([]));
    if (tab === "freights" && !freightHistory) apiGetTruckFreights(truckId).then(d=>setFreightHistory(d||[])).catch(()=>setFreightHistory([]));
  }, [tab, truck]);

  // ======================== CRUD HELPERS ==================================

  const crud = (apiFn, refreshKey) => async (body) => {
    setSaving(true);
    try { await apiFn(body); setShowForm(false); setEditItem(null); setDoneMsg("Listo");
      if (refreshKey === "inc") setIncomes(null);
      if (refreshKey === "exp") { setExpenses(null); setExpSummary(null); }
      if (refreshKey === "mov") setMovements(null);
      if (refreshKey === "doc") await load();
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

  // ======================== RENDER =======================================

  if (loading) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}><Loader/></div>;
  if (error && !truck) return <div style={{padding:20}}><button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT,fontSize:14,fontWeight:600,color:C.pri,marginBottom:14,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Volver</button><EmptyState icon={Ic.warn(C.err,28)} title="Error" subtitle={error}/></div>;

  const docs = truck?.documents || [];
  const docSum = truck?.docsSummary || {};
  const eco = ecoSummary || {};
  const TABS = [
    { key:"summary", label:"Resumen" },
    { key:"freights", label:"Fletes" },
    { key:"incomes", label:"Ingresos" },
    { key:"expenses", label:"Gastos" },
    { key:"movements", label:"Movimientos" },
    { key:"docs", label:"Documentos" },
  ];

  return (
    <div style={{ flex:1, overflow:"auto" }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}

      {/* Sticky header + tabs */}
      <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"14px 18px 0" }}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT,fontSize:14,fontWeight:600,color:C.pri,marginBottom:8,padding:0,display:"flex",alignItems:"center",gap:4}}>{Ic.chev(C.pri,18)} Flota</button>

        {/* Header compact */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          {Ic.truck(C.acc,22)}
          <LicensePlate plate={truck.plate} size="lg"/>
          {truck.model && <span style={{fontSize:12,color:C.t3}}>{truck.model}</span>}
          {docSum.expired>0 && <span style={{background:C.errPale,color:C.err,fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:R.pill}}>{docSum.expired} venc.</span>}
        </div>

        {/* Tab bar */}
        <div style={{display:"flex",gap:0,borderRadius:R.md,overflow:"hidden",border:`1.5px solid ${C.b1}`,marginBottom:0}}>
          {TABS.map(t=><button key={t.key} onClick={()=>{setTab(t.key);setShowForm(false);setEditItem(null);}} style={{flex:1,padding:"8px 0",fontFamily:FONT,fontSize:11.5,fontWeight:tab===t.key?700:500,background:tab===t.key?C.pri:C.w,color:tab===t.key?C.tOn:C.t2,border:"none",cursor:"pointer",borderLeft:t.key!=="summary"?`1px solid ${C.b1}`:"none"}}>{t.label}</button>)}
        </div>
      </div>

      <div style={{ padding:"14px 18px 24px" }}>

        {/* ==================== SUMMARY TAB ==================== */}
        {tab === "summary" && (ecoSummary === null ? <Loader/> : <>
          {/* Result row */}
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <Stat label="Ingresos" value={fmtMoney(eco.income?.paid||0)} color={C.ok}/>
            <Stat label="Gastos" value={fmtMoney(eco.expenses?.total||0)} color={C.err}/>
            <Stat label="Resultado" value={fmtMoney(eco.net||0)} color={(eco.net||0)>=0?C.ok:C.err}/>
          </div>
          {/* Ops row */}
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <Stat label="Km totales" value={fmtKm(eco.km?.total||0)}/>
            <Stat label="Viajes" value={eco.trips?.total||0}/>
            <Stat label="Horas" value={`${eco.hours||0}h`}/>
            <Stat label="km/litro" value={eco.fuel?.kmPerLiter||"—"}/>
          </div>
          {/* Efficiency */}
          <div style={{display:"flex",gap:8,marginBottom:12}}>
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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13.5,fontWeight:700,color:C.pri,fontFamily:MONO}}>{f.code}</span><span style={{fontSize:11,fontWeight:600,color:C.pri,background:C.w,padding:"2px 8px",borderRadius:R.pill}}>{f.tripStatus}</span></div>
              <div style={{fontSize:12,color:C.t2,marginTop:4}}>{f.originName||"?"}→{f.destName||"?"}</div>
            </div>)}
          </>}
          <div style={{fontSize:12,fontWeight:700,color:C.t2,marginBottom:8,marginTop:truck.activeFreights?.length?12:0,textTransform:"uppercase",letterSpacing:0.5}}>Historial</div>
          {freightHistory===null?<Loader/>:freightHistory.length===0?<EmptyState icon={Ic.truck(C.t3,20)} title="Sin historial" subtitle="Este camión aún no completó fletes"/>:
            freightHistory.map((f,i)=><div key={i} onClick={()=>onNavFreight?.(f.freightId)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:`1px solid ${C.b2}`,cursor:"pointer"}}>
              <span style={{fontSize:12.5,fontWeight:700,color:C.pri,fontFamily:MONO,minWidth:110}}>{f.code}</span>
              <span style={{flex:1,fontSize:12,color:C.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.origin||"?"}→{f.dest||"?"}</span>
              <span style={{fontSize:11,color:C.t3}}>{fmtDate(f.date)}</span>
              {f.tons&&<span style={{fontSize:11,fontWeight:600,color:C.t2}}>{Number(f.tons).toLocaleString("es-UY")}t</span>}
            </div>)
          }
        </>}

        {/* ==================== INCOMES TAB ==================== */}
        {tab === "incomes" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo ingreso"}</Btn></div>}
          {showForm && <IncForm onSave={handleAddInc} onCancel={()=>setShowForm(false)} saving={saving} freights={freightHistory}/>}
          {editItem && tab==="incomes" && <IncForm initial={editItem} onSave={handleUpdateInc} onCancel={()=>setEditItem(null)} saving={saving} freights={freightHistory}/>}
          {incomes===null?<Loader/>:incomes.length===0&&!showForm?<EmptyState icon={Ic.doc(C.t3,20)} title="Sin ingresos" subtitle="Registrá el primer ingreso del camión"/>:
            incomes.map(inc=>{
              const st = INC_STATUS[inc.status]||INC_STATUS.PENDING;
              return <div key={inc.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.b2}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:C.t1}}>{inc.concept}</span><span style={{fontSize:10,fontWeight:700,color:st.color,background:st.bg,padding:"1px 6px",borderRadius:R.pill}}>{st.label}</span></div>
                  {inc.freight&&<span style={{fontSize:10.5,color:C.pri,fontWeight:600}}>{inc.freight.code}</span>}
                  <div style={{fontSize:11,color:C.t3,marginTop:2}}>{fmtDate(inc.date)}{inc.invoiceNumber?` · Fact: ${inc.invoiceNumber}`:""}</div>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:st.color,whiteSpace:"nowrap"}}>{fmtMoney(inc.amount,inc.currency)}</span>
                {inc.invoiceUrl&&<a href={inc.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{padding:4}}>{Ic.clip(C.pri,14)}</a>}
                {canEdit&&<button onClick={()=>setEditItem(inc)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.edit(C.t3,14)}</button>}
                {canEdit&&<button onClick={()=>setConfirmDelete({type:"inc",id:inc.id,label:inc.concept})} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.ban(C.err,14)}</button>}
              </div>;
            })
          }
        </>}

        {/* ==================== EXPENSES TAB ==================== */}
        {tab === "expenses" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo gasto"}</Btn></div>}
          {expSummary && <div style={{display:"flex",gap:10,marginBottom:12}}><Stat label="Este mes" value={fmtMoney(expSummary.thisMonth)}/><Stat label="Mes anterior" value={fmtMoney(expSummary.prevMonth)} color={C.t3}/></div>}
          {showForm && <ExpForm onSave={handleAddExp} onCancel={()=>setShowForm(false)} saving={saving} activeFreights={truck.activeFreights}/>}
          {editItem && tab==="expenses" && <ExpForm initial={editItem} onSave={handleUpdateExp} onCancel={()=>setEditItem(null)} saving={saving} activeFreights={truck.activeFreights}/>}
          {expenses===null?<Loader/>:expenses.length===0&&!showForm?<EmptyState icon={Ic.doc(C.t3,20)} title="Sin gastos" subtitle="Registrá el primer gasto del camión"/>:
            expenses.map(e=><div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.b2}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:600,color:C.t1}}>{EXP_TYPE_LABELS[e.type]||e.type}</span>{e.freight&&<span style={{fontSize:10.5,color:C.pri,fontWeight:600}}>{e.freight.code}</span>}</div>
                {e.description&&<div style={{fontSize:11.5,color:C.t3,marginTop:2}}>{e.description}</div>}
                <div style={{fontSize:11,color:C.t3,marginTop:2}}>{fmtDate(e.date)}</div>
              </div>
              <span style={{fontSize:14,fontWeight:700,color:C.t1,whiteSpace:"nowrap"}}>{fmtMoney(e.amount,e.currency)}</span>
              {e.receiptUrl&&<a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" style={{padding:4}}>{Ic.clip(C.pri,14)}</a>}
              {canEdit&&<button onClick={()=>setEditItem(e)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.edit(C.t3,14)}</button>}
              {canEdit&&<button onClick={()=>setConfirmDelete({type:"exp",id:e.id,label:EXP_TYPE_LABELS[e.type]})} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.ban(C.err,14)}</button>}
            </div>)
          }
        </>}

        {/* ==================== MOVEMENTS TAB ==================== */}
        {tab === "movements" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo movimiento"}</Btn></div>}
          {showForm && <MovForm onSave={handleAddMov} onCancel={()=>setShowForm(false)} saving={saving}/>}
          {editItem && tab==="movements" && <MovForm initial={editItem} onSave={handleUpdateMov} onCancel={()=>setEditItem(null)} saving={saving}/>}
          {movements===null?<Loader/>:movements.length===0&&!showForm?<EmptyState icon={Ic.truck(C.t3,20)} title="Sin movimientos" subtitle="Registrá viajes que no son fletes de la plataforma"/>:
            movements.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.b2}`}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.t1}}>{MOV_TYPE_LABELS[m.type]||m.type}</div>
                {(m.originName||m.destName)&&<div style={{fontSize:12,color:C.t2,marginTop:2}}>{m.originName||"?"}→{m.destName||"?"}</div>}
                {m.description&&<div style={{fontSize:11.5,color:C.t3,marginTop:2}}>{m.description}</div>}
                <div style={{fontSize:11,color:C.t3,marginTop:2}}>
                  {fmtDate(m.departureAt)}
                  {m.kmDriven?` · ${Number(m.kmDriven).toLocaleString("es-UY")} km`:""}
                  {m.fuelLiters?` · ${m.fuelLiters}L`:""}
                </div>
              </div>
              {m.driver&&<span style={{fontSize:11,color:C.pri,fontWeight:600}}>{m.driver.name}</span>}
              {canEdit&&<button onClick={()=>setEditItem(m)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.edit(C.t3,14)}</button>}
              {canEdit&&<button onClick={()=>setConfirmDelete({type:"mov",id:m.id,label:MOV_TYPE_LABELS[m.type]})} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.ban(C.err,14)}</button>}
            </div>)
          }
        </>}

        {/* ==================== DOCUMENTS TAB ==================== */}
        {tab === "docs" && <>
          {canEdit && <div style={{marginBottom:10,textAlign:"right"}}><Btn sm onClick={()=>setShowForm(!showForm)} icon={showForm?Ic.cross(C.w,12):Ic.plus(C.w,12)}>{showForm?"Cerrar":"Nuevo documento"}</Btn></div>}
          {docs.length>0&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {docSum.valid>0&&<span style={{fontSize:11,fontWeight:600,color:C.ok,background:C.okPale,padding:"3px 10px",borderRadius:R.pill}}>✅ {docSum.valid} vigente{docSum.valid>1?"s":""}</span>}
            {docSum.expiringSoon>0&&<span style={{fontSize:11,fontWeight:600,color:C.warn,background:C.warnPale,padding:"3px 10px",borderRadius:R.pill}}>⚠️ {docSum.expiringSoon} por vencer</span>}
            {docSum.expired>0&&<span style={{fontSize:11,fontWeight:600,color:C.err,background:C.errPale,padding:"3px 10px",borderRadius:R.pill}}>❌ {docSum.expired} vencido{docSum.expired>1?"s":""}</span>}
          </div>}
          {showForm && <DocForm onSave={handleAddDoc} onCancel={()=>setShowForm(false)} saving={saving}/>}
          {editItem && tab==="docs" && <DocForm initial={editItem} onSave={handleUpdateDoc} onCancel={()=>setEditItem(null)} saving={saving}/>}
          {docs.length===0&&!showForm?<EmptyState icon={Ic.doc(C.t3,24)} title="Sin documentos" subtitle="Cargá el primer documento del camión"/>:
            docs.map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${C.b2}`,borderLeft:`3px solid ${EXPIRY_COLORS[d.expiryStatus]}`,borderRadius:R.md,marginBottom:8,background:C.w}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:600,color:C.t1}}>{DOC_TYPE_LABELS[d.type]||d.type}{d.name?` — ${d.name}`:""}</div>
                <div style={{fontSize:11.5,color:EXPIRY_COLORS[d.expiryStatus],fontWeight:600,marginTop:2}}>{EXPIRY_LABELS[d.expiryStatus]}{d.expiresAt?` · ${fmtDate(d.expiresAt)}`:""}</div>
              </div>
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{padding:4,color:C.pri}}>{Ic.eye(C.pri,16)}</a>
              {canEdit&&<button onClick={()=>setEditItem(d)} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.edit(C.t3,14)}</button>}
              {canEdit&&<button onClick={()=>setConfirmDelete({type:"doc",id:d.id,label:DOC_TYPE_LABELS[d.type]})} style={{background:"none",border:"none",cursor:"pointer",padding:4}}>{Ic.ban(C.err,14)}</button>}
            </div>)
          }
        </>}
      </div>

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
