import { useState, useEffect, useRef, useMemo } from "react";
import { C, Ic, track } from "../theme";
import { V, validate, SCHEMAS, textMatch, FieldError } from "../validation";
import { stCfg, GRANOS, UNITS } from "../constants";
import { Btn, Field, Select, Sec, AttachMenu } from "../components";
import { LocationPicker, SafeZone, FreightMap } from "../maps";
import { uploadPhoto, apiAddDocument, apiGetFieldLots, apiCreateLot } from "../api";
import { useIsDesktop } from "../hooks";

// ======================== NEW FREIGHT ================================

export default function NewScreen({ user, lots, plants, branches, fields, trucks, onBack, onCreate, duplicateFrom }) {
  const dup = duplicateFrom;
  const _isDesktop = useIsDesktop(768);
  const [originMode, setOriginMode] = useState("field"); // "field" | "map"
  const [customOrigin, setCustomOrigin] = useState({ name:"", lat:null, lng:null });
  const [destMode, setDestMode] = useState("plant");
  const [customDest, setCustomDest] = useState({ name:"", lat:null, lng:null });
  const [confirmMode, setConfirmMode] = useState("none"); // "plant" | "none"
  const [confirmPlantId, setConfirmPlantId] = useState("");
  const [form, setForm] = useState({
    grain: dup?.grain || "",
    tons: dup?.tons?.toString() || "",
    lotId: dup?.originLotId || "",
    plantId: dup?.destPlantId || "",
    branchId: dup?.destBranchId || "",
    fieldId: dup?.fieldId || "",
    loadDate: dup?.loadDate?.split("T")[0] || dup?.preDate || "", loadTime: dup?.loadTime || "",
    notes: dup?.notes || "",
    unit: dup?.unit || "toneladas",
    amount: dup?.amount?.toString() || "",
    productTypeOther: dup?.productTypeOther || "",
    truckId: ""
  });
  const [errs, setErrs] = useState({});
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldLots, setFieldLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [newLot, setNewLot] = useState(false);
  const [newLotName, setNewLotName] = useState("");
  const [newLotLoc, setNewLotLoc] = useState(null);
  const [newLotSaving, setNewLotSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const nfCamRef = useRef(null);
  const nfGalRef = useRef(null);
  const nfDocRef = useRef(null);
  const u = f => setForm(p=>({...p,...f}));

  // Section refs for collapsible sections
  const secRefs = { product:useRef(null), quantity:useRef(null), origin:useRef(null), ownfleet:useRef(null), destination:useRef(null), schedule:useRef(null), extras:useRef(null), submit:useRef(null) };
  const SEC_ORDER = ["product","quantity","origin","destination","schedule"];
  const [activeSection, setActiveSection] = useState(()=>{
    const g=!!form.grain&&(form.grain!=="Otros"||!!form.productTypeOther.trim()), q=!!form.tons&&parseFloat(form.tons)>0, o=originMode==="field"?(!!form.fieldId&&!!form.lotId):(!!customOrigin.lat), d=destMode==="plant"?!!form.plantId:!!customDest.name?.trim(), s=!!form.loadDate&&/^\d{2}:\d{2}$/.test(form.loadTime);
    if(!g)return"product";if(!q)return"quantity";if(!o)return"origin";if(!d)return"destination";return"schedule";
  });
  const [showIncomplete, setShowIncomplete] = useState(false);

  // Section completeness
  const secComplete = useMemo(()=>({
    product: !!form.grain && (form.grain!=="Otros" || !!form.productTypeOther.trim()),
    quantity: !!form.tons && parseFloat(form.tons) > 0,
    origin: originMode==="field" ? (!!form.fieldId && !!form.lotId) : (!!customOrigin.lat && !!customOrigin.name?.trim()),
    destination: destMode==="plant" ? !!form.plantId : (!!customDest.name?.trim() && (confirmMode==="none" || !!confirmPlantId)),
    schedule: !!form.loadDate && /^\d{2}:\d{2}$/.test(form.loadTime),
  }),[form, originMode, customOrigin, destMode, customDest, confirmMode, confirmPlantId]);

  // Next section to fill (highlight it when collapsed)
  const nextToFill = SEC_ORDER.find(s => !secComplete[s]);

  // Sections are locked if previous required sections are incomplete
  const secEnabled = {
    product: true,
    quantity: secComplete.product,
    origin: secComplete.product && secComplete.quantity,
    ownfleet: secComplete.product && secComplete.quantity && secComplete.origin,
    destination: secComplete.product && secComplete.quantity && secComplete.origin,
    schedule: secComplete.product && secComplete.quantity && secComplete.origin && secComplete.destination,
  };

  // Load lots when field changes
  useEffect(()=>{
    if(!form.fieldId){ setFieldLots([]); return; }
    setLoadingLots(true);
    apiGetFieldLots(form.fieldId).then(l=>setFieldLots(l||[])).catch(()=>setFieldLots([])).finally(()=>setLoadingLots(false));
  },[form.fieldId]);

  const handleCreateLot = async () => {
    if(!newLotName.trim()||!newLotLoc?.lat||!form.fieldId||newLotSaving) return;
    setNewLotSaving(true);
    try {
      const lot = await apiCreateLot(form.fieldId, { name: newLotName.trim(), lat: newLotLoc?.lat || undefined, lng: newLotLoc?.lng || undefined });
      setFieldLots(prev=>[...prev, lot]);
      u({ lotId: lot.id });
      setNewLot(false); setNewLotName(""); setNewLotLoc(null);
    } catch(e) { console.error("Error creando lote:", e); }
    finally { setNewLotSaving(false); }
  };

  const fieldOpts = (fields||[]).map(f=>({ value:f.id, label:f.name, sub:f.address||"" }));
  const lotOpts = fieldLots.map(l=>({ value:l.id, label:l.name, sub:l.hectares?`${l.hectares} ha`:'' }));
  const plantOpts = (plants||[]).map(p=>({ value:p.id, label:p.name }));
  const selectedPlantCompanyId = (plants||[]).find(p=>p.id===form.plantId)?.companyId;
  const branchOpts = (branches||[]).filter(b=>b.companyId===selectedPlantCompanyId).map(b=>({ value:b.id, label:b.name }));
  const selectedLot = fieldLots.find(l=>l.id===form.lotId);
  const selectedPlant = (plants||[]).find(p=>p.id===form.plantId);
  const selectedBranch = (branches||[]).find(b=>b.id===form.branchId);
  const truckOpts = (trucks||[]).map(t=>({ value:t.id, label:`${t.plate}${t.model?` \u00b7 ${t.model}`:""}` }));
  const showTruckSelect = (user.userType==="producer"||(user.userTypes||[]).includes("producer")) && truckOpts.length > 0;

  // Coords for map preview
  const originCoords = originMode==="field"
    ? (selectedLot?.lat ? { lat: parseFloat(selectedLot.lat), lng: parseFloat(selectedLot.lng) } : null)
    : (customOrigin.lat ? { lat: customOrigin.lat, lng: customOrigin.lng } : null);
  const destCoords = destMode==="plant"
    ? (selectedBranch?.lat ? { lat: parseFloat(selectedBranch.lat), lng: parseFloat(selectedBranch.lng) } : selectedPlant?.lat ? { lat: parseFloat(selectedPlant.lat), lng: parseFloat(selectedPlant.lng) } : null)
    : (customDest.lat ? { lat: customDest.lat, lng: customDest.lng } : null);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [editingDest, setEditingDest] = useState(false);
  const [overrideOrigin, setOverrideOrigin] = useState(null);
  const [overrideDest, setOverrideDest] = useState(null);
  const finalOrigin = overrideOrigin || originCoords;
  const finalDest = overrideDest || destCoords;

  const destDisplayName = destMode==="plant" ? ((selectedPlant?.name||"")+(selectedBranch?` \u2192 ${selectedBranch.name}`:"")) : (customDest.name||"");

  const submit = () => {
    setTouched(true);
    const {ok,errs:e} = validate(form, SCHEMAS.freight);
    if(form.grain==="Otros" && !form.productTypeOther?.trim()) { e.productTypeOther="Descripci\u00f3n obligatoria"; }
    if(originMode==="field" && !form.fieldId) { e.fieldId="Seleccion\u00e1 un campo"; }
    if(originMode==="field" && form.fieldId && !form.lotId) { e.lotId="Seleccion\u00e1 un lote del campo"; }
    if(originMode==="map" && !customOrigin.lat) { e.customOrigin="Indic\u00e1 una ubicaci\u00f3n en el mapa"; }
    // Destination validation
    if(destMode==="plant" && !form.plantId) { e.plantId="Seleccion\u00e1 una planta"; }
    if(destMode==="custom" && !customDest.name?.trim()) { e.customDestName="Nombre de destino obligatorio"; }
    setErrs(e);
    if(!ok || Object.keys(e).filter(k=>e[k]).length>0) {
      setShowIncomplete(true);
      const first=SEC_ORDER.find(s=>!secComplete[s]);
      if(first){
        setActiveSection(first);
        // Wait for React to re-render the expanded section before scrolling
        requestAnimationFrame(() => {
          secRefs[first]?.current?.scrollIntoView({behavior:"smooth",block:"center"});
        });
      }
      return;
    }
    if(submitting) return;
    setSubmitting(true);
    const payload = {...form, amount:form.amount?parseFloat(form.amount):0, photos: photos.map(p=>p.preview),
      overrideOriginLat: originMode==="map" ? customOrigin.lat : (overrideOrigin?.lat || undefined),
      overrideOriginLng: originMode==="map" ? customOrigin.lng : (overrideOrigin?.lng || undefined),
      customOriginName: originMode==="map" ? (customOrigin.name || "Origen personalizado") : undefined,
      overrideDestLat: overrideDest?.lat || undefined,
      overrideDestLng: overrideDest?.lng || undefined,
    };
    if(destMode==="custom") {
      payload.plantId = undefined;
      payload.branchId = undefined;
      payload.customDestName = customDest.name;
      payload.customDestLat = customDest.lat || undefined;
      payload.customDestLng = customDest.lng || undefined;
      if(confirmMode==="plant" && confirmPlantId) {
        const cp = (plants||[]).find(p=>p.id===confirmPlantId);
        if(cp) payload.destCompanyId = cp.companyId;
      }
    }
    if(selectedBranch) {
      payload.customDestName = selectedBranch.name;
      payload.customDestLat = selectedBranch.lat ? parseFloat(selectedBranch.lat) : undefined;
      payload.customDestLng = selectedBranch.lng ? parseFloat(selectedBranch.lng) : undefined;
    }
    if(originMode==="map") {
      payload.lotId = undefined;
      payload.fieldId = undefined;
    }
    onCreate(payload);
  };

  const addPhoto = (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    if(!file.type.startsWith('image/')) return;
    if(file.size > 10*1024*1024) return;
    setPhotos(prev=>[...prev, { file, preview: URL.createObjectURL(file) }]);
    e.target.value="";
  };

  const removePhoto = (idx) => {
    setPhotos(prev=>prev.filter((_,i)=>i!==idx));
  };

  const secSummary = {
    product: form.grain ? (form.grain==="Otros" ? `Otros: ${form.productTypeOther}` : form.grain) : "",
    quantity: form.tons ? `${form.tons} ${form.unit}${form.amount?` \u00b7 $${form.amount}`:""}` : "",
    origin: originMode==="field" ? ((fieldOpts.find(f=>f.value===form.fieldId)?.label||"")+(selectedLot?` \u2192 ${selectedLot.name}`:"")) : (customOrigin.name||"Ubicaci\u00f3n en mapa"),
    destination: destMode==="plant" ? (destDisplayName||"") : ((customDest.name||"")+(confirmMode==="plant"&&confirmPlantId?` \u00b7 Confirma: ${(plants||[]).find(p=>p.id===confirmPlantId)?.name||""}`:" \u00b7 Sin confirmaci\u00f3n")),
    schedule: form.loadDate&&form.loadTime ? `${form.loadDate} a las ${form.loadTime}` : "",
  };

  return (
    <div style={{ flex:1, overflow:"auto", animation:"slideUp 0.25s ease" }}>
      <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Solicitar Flete</div>
      </div>
      <div style={{ padding:"0 18px 18px" }}>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>Solicitando como: <span style={{fontWeight:600,color:C.t1}}>{user.name}</span></div>

      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* PRODUCT SECTION */}
        <Sec label="Producto" complete={secComplete.product} summary={secSummary.product} isExpanded={activeSection==="product"} onFocus={()=>setActiveSection("product")} secRef={secRefs.product} incomplete={showIncomplete&&!secComplete.product} highlight={nextToFill==="product"&&activeSection!=="product"}>
          <div>
            <Field label="Tipo de producto" icon={Ic.grain(C.pri,14)}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                {GRANOS.map(g=><button key={g} onClick={()=>{u({grain:g}); if(g!=="Otros")u({productTypeOther:""});}} style={{ padding:"10px 8px", borderRadius:8, border:`1.5px solid ${form.grain===g?C.pri:C.b1}`, background:form.grain===g?C.priPale:C.w, color:form.grain===g?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>{g}</button>)}
              </div>
            </Field>
            {touched&&<FieldError error={errs.grain}/>}
          </div>
          {form.grain==="Otros" && (
            <div style={{ marginTop:10 }}>
              <Field label="Descripci\u00f3n de producto" value={form.productTypeOther} onChange={v=>u({productTypeOther:v})} placeholder="Ej: Arena, Cemento, etc."/>
              {touched&&<FieldError error={errs.productTypeOther}/>}
            </div>
          )}
        </Sec>

        {/* QUANTITY SECTION */}
        <Sec label="Cantidad" complete={secComplete.quantity} summary={secSummary.quantity} isExpanded={activeSection==="quantity"} onFocus={()=>setActiveSection("quantity")} secRef={secRefs.quantity} incomplete={showIncomplete&&!secComplete.quantity} highlight={nextToFill==="quantity"&&activeSection!=="quantity"} disabled={!secEnabled.quantity}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <Field label="Cantidad" icon={Ic.grain(C.t2,14)} value={form.tons} onChange={v=>u({tons:v})} placeholder="Ej: 30"/>
              {touched&&<FieldError error={errs.tons}/>}
            </div>
            <div>
              <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>Unidad</label>
              <div style={{ display:"flex", gap:4 }}>
                {UNITS.map(uu=><button key={uu.v} onClick={()=>u({unit:uu.v})} style={{ flex:1, padding:"10px 4px", borderRadius:8, border:`1.5px solid ${form.unit===uu.v?C.pri:C.b1}`, background:form.unit===uu.v?C.priPale:C.w, color:form.unit===uu.v?C.pri:C.t2, cursor:"pointer", fontSize:10, fontWeight:600, fontFamily:"inherit" }}>{uu.l}</button>)}
              </div>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <Field label="Importe (opcional)" value={form.amount} onChange={v=>u({amount:v})} placeholder="Ej: 150000"/>
          </div>
        </Sec>

        {/* ORIGIN SECTION */}
        <Sec label="Origen" complete={secComplete.origin} summary={secSummary.origin} isExpanded={activeSection==="origin"} onFocus={()=>setActiveSection("origin")} secRef={secRefs.origin} incomplete={showIncomplete&&!secComplete.origin} highlight={nextToFill==="origin"&&activeSection!=="origin"} disabled={!secEnabled.origin}>
          {/* Toggle: Campo / Mapa */}
          <div style={{ display:"flex", gap:0, marginBottom:14, borderRadius:10, overflow:"hidden", border:`1.5px solid ${C.b1}` }}>
            {[{k:"field",l:"Seleccionar campo"},{k:"map",l:"Indicar en mapa"}].map(m=>(
              <button key={m.k} type="button" onClick={()=>{setOriginMode(m.k);if(m.k==="map"){u({fieldId:"",lotId:""});}else{setCustomOrigin({name:"",lat:null,lng:null});}}} style={{ flex:1, padding:"9px 0", fontSize:11.5, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"inherit", background:originMode===m.k?C.pri:C.w, color:originMode===m.k?C.w:C.t2, transition:"all 0.2s ease" }}>{m.l}</button>
            ))}
          </div>
          {originMode==="field" ? (<>
            <div>
              <Select label="Campo" icon={Ic.pin(C.ok,14)} value={form.fieldId} onChange={v=>{u({fieldId:v,lotId:""});}} options={fieldOpts} placeholder="Seleccionar campo..."/>
            </div>
            <div style={{ marginTop:10 }}>
              <Select label="Origen (lote)" icon={Ic.pin(C.pri,14)} value={form.lotId} onChange={v=>u({lotId:v})} options={lotOpts} placeholder={loadingLots?"Cargando lotes...":form.fieldId?"Seleccionar lote...":"Primero seleccion\u00e1 un campo"}/>
              {touched&&<FieldError error={errs.lotId}/>}
              {selectedLot && selectedLot.lat && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:C.priPale, borderRadius:8, marginTop:6 }}>{Ic.chk(C.pri,14)}<span style={{fontSize:10.5,color:C.pri,fontWeight:500}}>{selectedLot.lat}, {selectedLot.lng}</span></div>}
              {form.fieldId && !newLot && <button type="button" onClick={()=>setNewLot(true)} style={{marginTop:8,background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,color:C.pri,padding:0,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>{Ic.plus(C.pri,13)} Crear lote nuevo</button>}
              {newLot && (
                <div style={{marginTop:8,background:C.priPale,borderRadius:10,padding:12}}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                    <div style={{flex:1}}>
                      <Field label="Nombre del lote" value={newLotName} onChange={setNewLotName} placeholder="Ej: Lote 3"/>
                    </div>
                    <Btn sm disabled={!newLotName.trim()||!newLotLoc?.lat||newLotSaving} onClick={handleCreateLot}>{newLotSaving?"...":"Crear"}</Btn>
                    <Btn sm v="ghost" onClick={()=>{setNewLot(false);setNewLotName("");setNewLotLoc(null);}}>Cancelar</Btn>
                  </div>
                  <div style={{marginTop:10}}>
                    <SafeZone><LocationPicker label="Ubicaci\u00f3n del lote" value={newLotLoc} onChange={setNewLotLoc} defaultCenter={(() => { const sf = (fields||[]).find(f=>f.id===form.fieldId); return sf?.lat&&sf?.lng ? {lat:Number(sf.lat),lng:Number(sf.lng)} : null; })()}/></SafeZone>
                  </div>
                  {newLotLoc && <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:C.w,borderRadius:8,marginTop:6}}>{Ic.chk(C.pri,14)}<span style={{fontSize:10.5,color:C.pri,fontWeight:500}}>{newLotLoc.lat.toFixed(4)}, {newLotLoc.lng.toFixed(4)}</span></div>}
                </div>
              )}
            </div>
          </>) : (<>
            <Field label="Nombre del origen" value={customOrigin.name} onChange={v=>setCustomOrigin(p=>({...p,name:v}))} placeholder="Ej: Chacra Los \u00c1lamos"/>
            <div style={{ marginTop:10 }}>
              <SafeZone><LocationPicker label="Ubicaci\u00f3n en mapa" value={customOrigin.lat?{lat:customOrigin.lat,lng:customOrigin.lng}:null} onChange={loc=>setCustomOrigin(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,name:p.name||loc?.address||""}))}/></SafeZone>
            </div>
            {touched&&errs.customOrigin&&<div style={{padding:"6px 10px",borderRadius:8,marginTop:6,fontSize:11,fontWeight:600,color:C.err,background:C.errPale}}>{errs.customOrigin}</div>}
            {customOrigin.lat && <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:C.priPale, borderRadius:8, marginTop:6 }}>{Ic.chk(C.pri,14)}<span style={{fontSize:10.5,color:C.pri,fontWeight:500}}>{customOrigin.lat.toFixed(4)}, {customOrigin.lng.toFixed(4)}</span></div>}
          </>)}
        </Sec>

        {/* OWN FLEET (optional, between origin and destination) */}
        {showTruckSelect && (
          <Sec label="Flete propio (opcional)" complete={!!form.truckId} summary={truckOpts.find(t=>t.value===form.truckId)?.label||""} isExpanded={activeSection==="ownfleet"} onFocus={()=>setActiveSection("ownfleet")} secRef={secRefs.ownfleet} highlight={secComplete.origin&&!form.truckId&&activeSection!=="ownfleet"} disabled={!secEnabled.ownfleet}>
            <div style={{ fontSize:11, color:C.t2, marginBottom:12 }}>Uso mi propia flota \u2014 la planta solo autoriza el viaje</div>
            <Select label="Cami\u00f3n" icon={Ic.truck(C.acc,14)} value={form.truckId} onChange={v=>u({truckId:v})} options={truckOpts} placeholder="Seleccionar cami\u00f3n..."/>
            {form.truckId && <button type="button" onClick={()=>u({truckId:""})} style={{ marginTop:8, background:"none", border:"none", cursor:"pointer", fontSize:11, color:C.err, fontWeight:600, fontFamily:"inherit" }}>Quitar cami\u00f3n propio</button>}
          </Sec>
        )}

        {/* DESTINATION SECTION */}
        <Sec label="Destino" complete={secComplete.destination} summary={secSummary.destination} isExpanded={activeSection==="destination"} onFocus={()=>setActiveSection("destination")} secRef={secRefs.destination} incomplete={showIncomplete&&!secComplete.destination} highlight={nextToFill==="destination"&&activeSection!=="destination"} disabled={!secEnabled.destination}>
          <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.plant(C.t2,14)} Destino</label>
          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
            <button onClick={()=>{setDestMode("plant"); setCustomDest({name:"",lat:null,lng:null}); setConfirmMode("none"); setConfirmPlantId("");}} style={{ flex:1, padding:"10px 8px", borderRadius:8, border:`1.5px solid ${destMode==="plant"?C.pri:C.b1}`, background:destMode==="plant"?C.priPale:C.w, color:destMode==="plant"?C.pri:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>Planta</button>
            <button onClick={()=>{setDestMode("custom"); u({plantId:""}); setConfirmMode("none"); setConfirmPlantId("");}} style={{ flex:1, padding:"10px 8px", borderRadius:8, border:`1.5px solid ${destMode==="custom"?C.acc:C.b1}`, background:destMode==="custom"?C.accPale:C.w, color:destMode==="custom"?C.acc:C.t2, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>Personalizado</button>
          </div>
          {destMode==="plant" && (
            <>
              <Select value={form.plantId} onChange={v=>u({plantId:v,branchId:""})} options={plantOpts} placeholder="Seleccionar planta..."/>
              {touched&&<FieldError error={errs.plantId}/>}
              {form.plantId && branchOpts.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <Select label="Sucursal (opcional)" icon={Ic.pin(C.sec,14)} value={form.branchId} onChange={v=>u({branchId:v})} options={branchOpts} placeholder="Seleccionar sucursal..."/>
                </div>
              )}
            </>
          )}
          {destMode==="custom" && (
            <>
              <Field label="Nombre del destino" value={customDest.name} onChange={v=>setCustomDest(p=>({...p,name:v}))} placeholder="Ej: Acopio Central, Puerto Rosario..."/>
              {touched&&<FieldError error={errs.customDestName}/>}
              {!_isDesktop && <div style={{ marginTop:8 }}>
                <LocationPicker label="Ubicaci\u00f3n del destino" value={customDest.lat?{lat:customDest.lat,lng:customDest.lng}:null} onChange={loc=>setCustomDest(p=>({...p,lat:loc.lat,lng:loc.lng}))}/>
              </div>}
              <div style={{marginTop:14}}>
                <label style={{fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"flex",alignItems:"center",gap:4,textTransform:"uppercase",letterSpacing:0.6}}>{Ic.chk(C.t2,14)} \u00bfQui\u00e9n debe confirmar el viaje?</label>
                <div style={{display:"flex",gap:6,marginBottom:confirmMode==="plant"?10:0}}>
                  <button onClick={()=>setConfirmMode("plant")} style={{flex:1,padding:"10px 8px",borderRadius:8,border:`1.5px solid ${confirmMode==="plant"?C.pri:C.b1}`,background:confirmMode==="plant"?C.priPale:C.w,color:confirmMode==="plant"?C.pri:C.t2,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>Planta</button>
                  <button onClick={()=>{setConfirmMode("none");setConfirmPlantId("");}} style={{flex:1,padding:"10px 8px",borderRadius:8,border:`1.5px solid ${confirmMode==="none"?C.ok:C.b1}`,background:confirmMode==="none"?C.okPale:C.w,color:confirmMode==="none"?C.ok:C.t2,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>Nadie</button>
                </div>
                {confirmMode==="plant" && (
                  <>
                    <Select value={confirmPlantId} onChange={v=>setConfirmPlantId(v)} options={plantOpts} placeholder="Seleccionar planta que confirma..."/>
                    {touched&&!confirmPlantId&&<FieldError error="Seleccion\u00e1 una planta que confirme el viaje"/>}
                    <div style={{fontSize:10,color:C.t3,marginTop:6}}>La planta debe aceptar el flete para que se realice el viaje</div>
                  </>
                )}
                {confirmMode==="none" && <div style={{fontSize:10,color:C.t3,marginTop:6}}>El flete no requiere confirmaci\u00f3n externa</div>}
              </div>
            </>
          )}
        </Sec>

        {/* Route preview + custom dest map — side by side on desktop when custom */}
        {destMode==="custom" && _isDesktop ? (
          <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <LocationPicker label="Ubicaci\u00f3n del destino" value={customDest.lat?{lat:customDest.lat,lng:customDest.lng}:null} onChange={loc=>setCustomDest(p=>({...p,lat:loc.lat,lng:loc.lng}))}/>
            </div>
            {(finalOrigin || finalDest) && (
              <div style={{ flex:1, minWidth:0, background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:C.sh }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px" }}>
                  {Ic.pin(C.pri,14)}
                  <span style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Vista previa del recorrido</span>
                </div>
                {finalOrigin && finalDest ? (
                  <FreightMap freightId={null} originLat={finalOrigin.lat} originLng={finalOrigin.lng} destLat={finalDest.lat} destLng={finalDest.lng} originName={fieldLots.find(l=>l.id===form.lotId)?.name||"Origen"} destName={destDisplayName||"Destino"} status="preview" isDriver={false}/>
                ) : (
                  <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:C.t3 }}>
                    Seleccion\u00e1 {!finalOrigin?"origen (lote)":""}{!finalOrigin&&!finalDest?" y ":""}{!finalDest?"destino":""} para ver la ruta
                  </div>
                )}
                <div style={{ padding:"6px 14px 10px", display:"flex", gap:8 }}>
                  {finalOrigin && (
                    <button onClick={()=>setEditingOrigin(!editingOrigin)} style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${editingOrigin?C.pri:C.b1}`, background:editingOrigin?C.priPale:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:10.5, fontWeight:600, color:editingOrigin?C.pri:C.t2, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                      {Ic.pin("#1A6B37",12)} {editingOrigin?"Editando origen":"Editar origen"}
                    </button>
                  )}
                  {finalDest && (
                    <button onClick={()=>setEditingDest(!editingDest)} style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${editingDest?C.sec:C.b1}`, background:editingDest?C.secPale:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:10.5, fontWeight:600, color:editingDest?C.sec:C.t2, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                      {Ic.pin("#003882",12)} {editingDest?"Editando destino":"Editar destino"}
                    </button>
                  )}
                </div>
                {editingOrigin && <div style={{ padding:"0 14px 12px" }}><LocationPicker label="Corregir ubicaci\u00f3n de origen" value={overrideOrigin||originCoords} onChange={loc=>setOverrideOrigin({lat:loc.lat,lng:loc.lng})}/></div>}
                {editingDest && <div style={{ padding:"0 14px 12px" }}><LocationPicker label="Corregir ubicaci\u00f3n de destino" value={overrideDest||destCoords} onChange={loc=>setOverrideDest({lat:loc.lat,lng:loc.lng})}/></div>}
              </div>
            )}
          </div>
        ) : (
          /* Standard stacked layout (mobile or plant mode) */
          (finalOrigin || finalDest) && (
            <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, overflow:"hidden", boxShadow:C.sh }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px" }}>
                {Ic.pin(C.pri,14)}
                <span style={{ fontSize:10.5, fontWeight:700, color:C.t2, textTransform:"uppercase", letterSpacing:0.5 }}>Vista previa del recorrido</span>
              </div>
              {finalOrigin && finalDest ? (
                <FreightMap freightId={null} originLat={finalOrigin.lat} originLng={finalOrigin.lng} destLat={finalDest.lat} destLng={finalDest.lng} originName={fieldLots.find(l=>l.id===form.lotId)?.name||"Origen"} destName={destDisplayName||"Destino"} status="preview" isDriver={false}/>
              ) : (
                <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:C.t3 }}>
                  Seleccion\u00e1 {!finalOrigin?"origen (lote)":""}{!finalOrigin&&!finalDest?" y ":""}{!finalDest?"destino":""} para ver la ruta
                </div>
              )}
              <div style={{ padding:"6px 14px 10px", display:"flex", gap:8 }}>
                {finalOrigin && (
                  <button onClick={()=>setEditingOrigin(!editingOrigin)} style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${editingOrigin?C.pri:C.b1}`, background:editingOrigin?C.priPale:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:10.5, fontWeight:600, color:editingOrigin?C.pri:C.t2, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    {Ic.pin("#1A6B37",12)} {editingOrigin?"Editando origen":"Editar origen"}
                  </button>
                )}
                {finalDest && (
                  <button onClick={()=>setEditingDest(!editingDest)} style={{ flex:1, padding:"7px 10px", borderRadius:8, border:`1px solid ${editingDest?C.sec:C.b1}`, background:editingDest?C.secPale:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:10.5, fontWeight:600, color:editingDest?C.sec:C.t2, display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    {Ic.pin("#003882",12)} {editingDest?"Editando destino":"Editar destino"}
                  </button>
                )}
              </div>
              {editingOrigin && <div style={{ padding:"0 14px 12px" }}><LocationPicker label="Corregir ubicaci\u00f3n de origen" value={overrideOrigin||originCoords} onChange={loc=>setOverrideOrigin({lat:loc.lat,lng:loc.lng})}/></div>}
              {editingDest && <div style={{ padding:"0 14px 12px" }}><LocationPicker label="Corregir ubicaci\u00f3n de destino" value={overrideDest||destCoords} onChange={loc=>setOverrideDest({lat:loc.lat,lng:loc.lng})}/></div>}
            </div>
          )
        )}

        {/* SCHEDULE SECTION */}
        <Sec label="Fecha y hora" complete={secComplete.schedule} summary={secSummary.schedule} isExpanded={activeSection==="schedule"} onFocus={()=>setActiveSection("schedule")} secRef={secRefs.schedule} incomplete={showIncomplete&&!secComplete.schedule} highlight={nextToFill==="schedule"&&activeSection!=="schedule"} disabled={!secEnabled.schedule}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.cal(C.pri,14)} Fecha carga</label>
              <div style={{ position:"relative" }}>
                <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} onClick={e=>e.target.showPicker?.()} onFocus={e=>{e.target.style.borderColor=touched&&errs.loadDate?C.err:C.bFocus;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.bFocus}} onBlur={e=>{e.target.style.borderColor=touched&&errs.loadDate?C.err:C.b1;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.t3}} style={{ width:"100%", padding:"12px 42px 12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadDate?C.err:C.b1}`, background:C.w, color:form.loadDate?C.t1:C.t3, fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer", minHeight:44, transition:"border-color 0.15s" }}/>
                <div className="tv-dt-icon" style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", display:"flex", color:C.t3, transition:"color 0.15s" }}>{Ic.cal(C.t3,17)}</div>
              </div>
              {touched&&<FieldError error={errs.loadDate}/>}
            </div>
            <div>
              <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.clk(C.pri,14)} Hora carga</label>
              <div style={{ position:"relative" }}>
                <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} onClick={e=>e.target.showPicker?.()} onFocus={e=>{e.target.style.borderColor=touched&&errs.loadTime?C.err:C.bFocus;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.bFocus}} onBlur={e=>{e.target.style.borderColor=touched&&errs.loadTime?C.err:C.b1;e.target.parentElement.querySelector('.tv-dt-icon').style.color=C.t3}} style={{ width:"100%", padding:"12px 42px 12px 14px", borderRadius:10, border:`1.5px solid ${touched&&errs.loadTime?C.err:C.b1}`, background:C.w, color:form.loadTime?C.t1:C.t3, fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box", cursor:"pointer", minHeight:44, transition:"border-color 0.15s" }}/>
                <div className="tv-dt-icon" style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", display:"flex", color:C.t3, transition:"color 0.15s" }}>{Ic.clk(C.t3,17)}</div>
              </div>
              {touched&&<FieldError error={errs.loadTime}/>}
            </div>
          </div>
        </Sec>

        {/* EXTRAS */}
        <div ref={secRefs.extras}>
          <div>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:6, display:"block", textTransform:"uppercase", letterSpacing:0.6 }}>Notas</label>
            <textarea value={form.notes} onChange={e=>u({notes:e.target.value})} placeholder="Indicaciones, horarios especiales..." rows={3} style={{ width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${C.b1}`, background:C.w, color:C.t1, fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", boxSizing:"border-box" }}/>
          </div>

          {/* Photo/file attachments */}
          <div style={{ marginTop:12 }}>
            <label style={{ fontSize:10.5, fontWeight:600, color:C.t2, marginBottom:8, display:"flex", alignItems:"center", gap:4, textTransform:"uppercase", letterSpacing:0.6 }}>{Ic.clip(C.acc,14)} Adjuntar archivos (opcional)</label>
            {photos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
                {photos.map((p,i)=>(
                  <div key={i} style={{ position:"relative", width:72, height:72, borderRadius:10, overflow:"hidden", border:`1px solid ${C.b1}` }}>
                    {p.preview ? <img src={p.preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:C.bg, padding:4 }}>{Ic.doc(C.pri,18)}<span style={{fontSize:7,color:C.t3,textAlign:"center",marginTop:2,wordBreak:"break-all"}}>{(p.name||"").slice(-12)}</span></div>}
                    <button onClick={()=>removePhoto(i)} style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:10, background:C.err, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{Ic.cross(C.w,12)}</button>
                  </div>
                ))}
              </div>
            )}
            {/* Hidden inputs */}
            <input ref={nfCamRef} type="file" accept="image/*" capture="environment" onChange={addPhoto} style={{ display:"none" }}/>
            <input ref={nfGalRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>{if(f.type.startsWith('image/')&&f.size<=10*1024*1024)setPhotos(prev=>[...prev,{file:f,preview:URL.createObjectURL(f)}])});e.target.value="";}} style={{ display:"none" }}/>
            <input ref={nfDocRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>{if(f.size<=10*1024*1024)setPhotos(prev=>[...prev,{file:f,preview:f.type.startsWith('image/')?URL.createObjectURL(f):null,name:f.name}])});e.target.value="";}} style={{ display:"none" }}/>
            <button onClick={()=>setShowAttach(true)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 16px", borderRadius:10, border:`1.5px dashed ${C.b1}`, background:C.bg, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, color:C.t2 }}>
              {Ic.clip(C.t2,16)} Adjuntar archivo
            </button>
            <AttachMenu open={showAttach} onClose={()=>setShowAttach(false)} onCamera={()=>nfCamRef.current?.click()} onGallery={()=>nfGalRef.current?.click()} onFiles={()=>nfDocRef.current?.click()} />
          </div>
        </div>

        <div ref={secRefs.submit}>
          <Btn full icon={Ic.chk(C.w,16)} disabled={submitting} onClick={submit}>{submitting?"Enviando...":"Solicitar Flete"}</Btn>
        </div>
      </div>
      </div>
    </div>
  );
}
