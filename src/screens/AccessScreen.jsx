import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { C, Ic } from "../theme";
import { Btn, Bd, Field, Loader, LoadingOverlay, ModalOverlay } from "../components";
import { apiGrantAccess, apiRevokeAccess, apiListAccessProducers, apiListAccessPlants, apiSearchProducer, apiSearchCompany, apiGetMyFacilities, apiAdminListCompanies } from "../api";
import { useCatalogStore } from "../store";

export default function AccessScreen({ user, onBack, embedded, defaultCompanyId, defaultCompanyType }) {
  const isAdmin = user?.role === "platform_admin";
  const [producers, setProducers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [grantType, setGrantType] = useState("producer"); // "producer" | "transporter"
  const [searchMode, setSearchMode] = useState("company"); // "company" | "user"
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProducer, setSelectedProducer] = useState(null); // user result
  const [selectedCompany, setSelectedCompany] = useState(null); // company result
  const searchTimer = useRef(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doneMsg, setDoneMsg] = useState("");
  const [revokeClosing, setRevokeClosing] = useState("");
  const [facilities, setFacilities] = useState(null);
  const [selectedPlantIds, setSelectedPlantIds] = useState([]);
  const [editingAccess, setEditingAccess] = useState(null); // producer record being edited
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  // Admin general: company selector (all types)
  const [allCompanies, setAllCompanies] = useState([]);
  const [selCompanyId, setSelCompanyId] = useState(defaultCompanyId || "");
  const [selCompanyType, setSelCompanyType] = useState(defaultCompanyType || "");

  const load = useCallback(async () => {
    try {
      const plantFilter = isAdmin && selCompanyType === "plant" ? selCompanyId : undefined;
      const producerFilter = isAdmin && (selCompanyType === "producer" || selCompanyType === "transporter") ? selCompanyId : undefined;
      const facilityPcId = isAdmin && selCompanyType === "plant" ? selCompanyId : undefined;
      const [p, f] = await Promise.all([apiListAccessProducers(plantFilter, producerFilter), apiGetMyFacilities(facilityPcId).catch(()=>({plants:[],branches:[]}))]);
      setProducers(p || []);
      setFacilities(f);
    } catch {} finally { setLoading(false); }
  }, [isAdmin, selCompanyId, selCompanyType]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isAdmin) apiAdminListCompanies().then(c => setAllCompanies(c||[])).catch(()=>{}); }, [isAdmin]);

  const handleSearchChange = (q) => {
    setSearchQ(q);
    setSelectedProducer(null);
    setSelectedCompany(null);
    setSelectedPlantIds([]);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const searchFn = searchMode === "company" ? apiSearchCompany : apiSearchProducer;
    searchTimer.current = setTimeout(() => {
      searchFn(q.trim(), grantType).then(r => setSearchResults(r || [])).catch(() => setSearchResults([])).finally(() => setSearching(false));
    }, 400);
  };

  const handleSelectProducer = (p) => {
    setSelectedProducer(p);
    setSearchResults([]);
    setSearchQ(p.userName + (p.producerCompanyName ? ` (${p.producerCompanyName})` : ""));
  };

  const handleSelectCompany = (c) => {
    setSelectedCompany(c);
    setSearchResults([]);
    setSearchQ(c.companyName);
  };

  const togglePlant = (id) => setSelectedPlantIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const handleGrant = async () => {
    if (!selectedProducer?.userId && !selectedCompany?.companyId && !editingAccess) return;
    if (isAdmin && !selCompanyId) {
      setMsg({ t: "Seleccioná una empresa primero", k: "err" }); return;
    }
    if (fPlants.length > 0 && selectedPlantIds.length === 0) {
      setMsg({ t: "Seleccioná al menos una planta", k: "err" }); return;
    }
    setSaving(true);
    let companyId, userId;
    if (editingAccess) {
      companyId = editingAccess.producerCompanyId;
      userId = editingAccess.producerUserId;
    } else if (selectedCompany) {
      companyId = selectedCompany.companyId;
      userId = undefined; // company-wide access
    } else {
      companyId = selectedProducer.producerCompanyId;
      userId = selectedProducer.userId;
    }
    try {
      await apiGrantAccess({ producerUserId: userId, producerCompanyId: companyId, allowedPlantIds: selectedPlantIds, ...(isAdmin && selCompanyId ? { plantCompanyId: selCompanyId } : {}) });
      useCatalogStore.getState().clearCache();
      setSearchQ(""); setSelectedProducer(null); setSelectedCompany(null); setSearchResults([]); setShowGrant(false); setEditingAccess(null);
      setSelectedPlantIds([]);
      setSaving(false); setDoneMsg(editingAccess ? "Habilitación actualizada" : selectedCompany ? "Empresa habilitada" : grantType==="producer"?"Productor habilitado":"Transportista habilitado"); load();
    } catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const handleRevoke = async (accessId) => {
    if(saving) return;
    setSaving(true);
    try { await apiRevokeAccess(accessId); useCatalogStore.getState().clearCache(); setSaving(false); setRevokeClosing("Acceso revocado"); load(); }
    catch (e) { setMsg({ t: e.message, k: "err" }); setSaving(false); }
  };

  const startEdit = (p) => {
    setEditingAccess(p);
    setSelectedPlantIds((p.allowedPlantIds || []).slice());
    setShowGrant(false); setSelectedProducer(null); setSearchResults([]); setSearchQ("");
  };

  const selCount = selectedPlantIds.length;
  const fPlants = facilities?.plants || [];
  const plantMap = useMemo(()=>new Map(fPlants.map(p=>[p.id,p])),[fPlants]);

  // Group active records by type (producer/transporter) then by plant
  const activeProducers = producers.filter(p=>p.active);
  const grouped = useMemo(()=>{
    const producerRecords = activeProducers.filter(p=>p.producerCompany?.type==="producer"||(!p.producerCompany?.type));
    const transporterRecords = activeProducers.filter(p=>p.producerCompany?.type==="transporter");
    const groupByPlant = (records) => {
      const byPlant = {};
      const general = [];
      for (const p of records) {
        const pIds = (p.allowedPlantIds || []);
        if (pIds.length === 0) { general.push(p); continue; }
        for (const pid of pIds) {
          if (!byPlant[pid]) byPlant[pid] = [];
          byPlant[pid].push(p);
        }
      }
      return { byPlant, general };
    };
    return { producers: groupByPlant(producerRecords), transporters: groupByPlant(transporterRecords) };
  },[activeProducers]);

  const FacilityToggle = ({ id, name, address, selected, color, onToggle }) => (
    <button onClick={()=>onToggle(id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:`1.5px solid ${selected?color:C.b1}`, background:selected?`${color}0A`:C.w, cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"all 0.15s", width:"100%" }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:selected?700:500, color:selected?color:C.t1 }}>{name}</div>
        {address && <div style={{ fontSize:10, color:C.t3 }}>{address}</div>}
      </div>
      <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${selected?color:C.b1}`, background:selected?color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
        {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.w} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
    </button>
  );

  const FacilitySelector = () => (
    <div style={{ marginBottom:12 }}>
      {fPlants.length > 0 ? (
        <>
          <div style={{ fontSize:11, fontWeight:700, color:C.t2, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5, display:"flex", alignItems:"center", gap:4 }}>{Ic.plant(C.pri,14)} Plantas</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
            {fPlants.map(p => <FacilityToggle key={p.id} id={p.id} name={p.name} address={p.address} selected={selectedPlantIds.includes(p.id)} color={C.pri} onToggle={togglePlant}/>)}
          </div>
        </>
      ) : (
        <div style={{ padding:"10px 12px", borderRadius:8, background:C.infoPale, border:`1px solid ${C.info}30`, marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.info }}>El productor tendrá acceso general a tu empresa.</div>
          <div style={{ fontSize:10.5, color:C.t3, marginTop:2 }}>Podés crear plantas desde el panel de administración para habilitar acceso específico.</div>
        </div>
      )}
    </div>
  );

  const ProducerRow = ({ p }) => {
    const nPlants = (p.allowedPlantIds||[]).length;
    const plantNames = (p.allowedPlantIds||[]).map(id=>plantMap.get(id)?.name).filter(Boolean).join(", ");
    const isCompanyWide = !p.producerUserId;
    const displayName = isCompanyWide ? (p.producerCompany?.name || "Empresa") : (p.producerUser?.name || p.producerCompany?.name || "Usuario");
    const companyName = !isCompanyWide ? (p.producerCompany?.name || "") : "";
    return (
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
        <button onClick={()=>startEdit(p)} style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left", padding:0 }}>
          {isCompanyWide ? Ic.plant(C.ok,18) : Ic.user(C.ok,18)}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.t1 }}>{displayName}</span>
              <span style={{ fontSize:9, fontWeight:700, color:isCompanyWide?C.ok:C.info, background:isCompanyWide?`${C.ok}15`:`${C.info}15`, padding:"1px 6px", borderRadius:4 }}>{isCompanyWide?"EMPRESA":"USUARIO"}</span>
            </div>
            {companyName && <div style={{ fontSize:10, color:C.t2 }}>{companyName}</div>}
            {isAdmin && !selCompanyId && p.plantCompany?.name && <div style={{ fontSize:10, color:C.sec }}>{Ic.plant(C.sec,10)} {p.plantCompany.name}</div>}
            {plantNames && <div style={{ fontSize:10, color:C.pri }}>{plantNames}</div>}
            {nPlants===0 && <div style={{ fontSize:10, color:C.t3 }}>Acceso general</div>}
          </div>
        </button>
        <button onClick={()=>setConfirmRevoke(p)} style={{ background:"none", border:"none", cursor:"pointer", padding:6, borderRadius:6, display:"flex", alignItems:"center" }}>
          {Ic.cross(C.err,16)}
        </button>
      </div>
    );
  };

  return (
    <div style={{ flex: embedded?undefined:1, overflow: embedded?"visible":"auto", padding: embedded?0:undefined }}>
      {(saving||doneMsg) && !confirmRevoke && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      {!embedded && <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}><button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: C.pri, marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>{Ic.chev(C.pri, 18)} Menú</button></div>}
      <div style={{ padding: embedded?0:"0 18px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: embedded?16:20, fontWeight: 800, letterSpacing: -0.3 }}>{isAdmin && selCompanyType === "producer" ? "Accesos del productor" : isAdmin && selCompanyType === "transporter" ? "Accesos del transportista" : "Accesos"}</div>
        <Btn sm onClick={() => { setShowGrant(!showGrant); setEditingAccess(null); setSelectedProducer(null); setSelectedCompany(null); setSearchResults([]); setSearchQ(""); setMsg(null); setSelectedPlantIds([]); setGrantType("producer"); setSearchMode("company"); }} icon={showGrant ? Ic.cross(C.w, 14) : Ic.plus(C.w, 14)}>{showGrant ? "Cerrar" : "Habilitar"}</Btn>
      </div>

      {/* Admin general: company selector (all types) — hidden when defaultCompanyId is set */}
      {isAdmin && allCompanies.length > 0 && !defaultCompanyId && (
        <div style={{ marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, fontWeight:600, color:C.t2, whiteSpace:"nowrap" }}>Empresa:</span>
          <select value={selCompanyId} onChange={e=>{const cId=e.target.value;const comp=allCompanies.find(c=>c.id===cId);setSelCompanyId(cId);setSelCompanyType(comp?.type||"");setLoading(true);setShowGrant(false);setEditingAccess(null);}} style={{ flex:1, padding:"8px 10px", borderRadius:8, border:`1px solid ${C.b1}`, fontSize:12, fontFamily:"inherit", background:C.w, color:C.t1 }}>
            <option value="">Todas las empresas</option>
            {allCompanies.filter(c=>c.type==="plant").length>0 && <optgroup label="Plantas">{allCompanies.filter(c=>c.type==="plant").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            {allCompanies.filter(c=>c.type==="producer").length>0 && <optgroup label="Productores">{allCompanies.filter(c=>c.type==="producer").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            {allCompanies.filter(c=>c.type==="transporter").length>0 && <optgroup label="Transportistas">{allCompanies.filter(c=>c.type==="transporter").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
          </select>
        </div>
      )}

      {msg && <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 12, fontWeight: 600, background: msg.k === "ok" ? C.okPale : C.errPale, color: msg.k === "ok" ? C.ok : C.err }}>{msg.t}</div>}

      {/* Confirm revoke modal */}
      {confirmRevoke && (
        <ModalOverlay onClose={()=>{setConfirmRevoke(null);setRevokeClosing("");}} maxWidth={340} loading={saving} closing={!!revokeClosing} closingText={revokeClosing}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Revocar acceso</div>
          <div style={{ fontSize:13, color:C.t2, marginBottom:16 }}>¿Revocar el acceso de <b>{confirmRevoke.producerUser?.name||confirmRevoke.producerCompany?.name}</b>? No podrá enviar fletes a tus plantas.</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setConfirmRevoke(null)} style={{ flex:1, padding:"10px 14px", borderRadius:8, border:`1px solid ${C.b1}`, background:C.w, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.t2 }}>Cancelar</button>
            <button disabled={saving||!!revokeClosing} onClick={()=>handleRevoke(confirmRevoke.id)} style={{ flex:1, padding:"10px 14px", borderRadius:8, border:"none", background:saving?C.muted:C.err, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.w, opacity:saving?0.7:1 }}>{saving?"Revocando...":"Revocar"}</button>
          </div>
        </ModalOverlay>
      )}

      {/* Edit access panel */}
      {editingAccess && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}>Editar: {editingAccess.producerUser?.name||editingAccess.producerCompany?.name}</div>
              <div style={{ fontSize:10, color:C.t3 }}>Modificá las plantas habilitadas</div>
            </div>
            <button onClick={()=>{setEditingAccess(null); setSelectedPlantIds([]);}} style={{ background:"none", border:"none", cursor:"pointer" }}>{Ic.cross(C.t2,18)}</button>
          </div>
          <FacilitySelector/>
          <Btn full v="acc" disabled={saving || (fPlants.length > 0 && selCount === 0)} onClick={handleGrant}>{saving ? "Guardando..." : fPlants.length > 0 ? `Guardar cambios (${selCount} seleccionados)` : "Guardar cambios"}</Btn>
        </div>
      )}

      {/* Grant new access */}
      {showGrant && !editingAccess && (
        <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: C.sh }}>
          {/* Type toggle */}
          <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            {[{k:"producer",l:"Productor"},{k:"transporter",l:"Transportista"}].map(t=>(
              <button key={t.k} onClick={()=>{if(grantType!==t.k){setGrantType(t.k);setSearchQ("");setSearchResults([]);setSelectedProducer(null);setSelectedCompany(null);setSelectedPlantIds([]);}}} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${grantType===t.k?C.pri:C.b1}`,background:grantType===t.k?`${C.pri}12`:C.w,color:grantType===t.k?C.pri:C.t2,fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>
            ))}
          </div>
          {/* Search mode toggle: company / user */}
          <div style={{ display:"flex", gap:6, marginBottom:12 }}>
            {[{k:"company",l:"Por empresa"},{k:"user",l:"Por usuario"}].map(m=>(
              <button key={m.k} onClick={()=>{if(searchMode!==m.k){setSearchMode(m.k);setSearchQ("");setSearchResults([]);setSelectedProducer(null);setSelectedCompany(null);setSelectedPlantIds([]);}}} style={{flex:1,padding:"6px 0",borderRadius:6,border:`1px solid ${searchMode===m.k?C.acc:C.b2}`,background:searchMode===m.k?`${C.acc}12`:C.bg,color:searchMode===m.k?C.acc:C.t3,fontWeight:600,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{m.l}</button>
            ))}
          </div>
          <div style={{ fontSize:11, fontWeight:600, color:C.t2, marginBottom:4 }}>{searchMode==="company"?(grantType==="producer"?"Habilitar una empresa productora. Todos sus usuarios tendrán acceso.":"Habilitar una empresa transportista. Todos sus usuarios podrán recibir asignaciones."):(grantType==="producer"?"Habilitar un usuario productor específico.":"Habilitar un usuario transportista específico.")}</div>
          <Field label={searchMode==="company"?"Buscar empresa":"Buscar usuario"} icon={Ic.srch(C.pri,14)} value={searchQ} onChange={handleSearchChange} placeholder={searchMode==="company"?"Nombre de empresa...":"Nombre, email o teléfono..."}/>
          {searching && <div style={{ fontSize:11, color:C.t3, marginTop:6 }}>Buscando...</div>}

          {/* Search results — company mode */}
          {searchMode==="company" && searchResults.length > 0 && !selectedCompany && (
            <div style={{ marginTop:8, border:`1px solid ${C.b1}`, borderRadius:8, overflow:"hidden", maxHeight:240, overflowY:"auto" }}>
              {searchResults.map(c => (
                <button key={c.companyId} onClick={() => handleSelectCompany(c)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:C.w, border:"none", borderBottom:`1px solid ${C.b2}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  {Ic.plant(C.pri,18)}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{c.companyName}</div>
                    <div style={{ fontSize:10.5, color:C.t3 }}>{c.address||""}{c.phone ? ` · ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Search results — user mode */}
          {searchMode==="user" && searchResults.length > 0 && !selectedProducer && (
            <div style={{ marginTop:8, border:`1px solid ${C.b1}`, borderRadius:8, overflow:"hidden", maxHeight:240, overflowY:"auto" }}>
              {searchResults.map(p => {
                const pType = p.producerCompanyType || p.companyType || grantType;
                const TYPE_L = {plant:"Planta",transporter:"Transp.",producer:"Productor"};
                const TYPE_C = {plant:C.pri,transporter:C.info||C.sec,producer:C.acc};
                return (
                <button key={p.userId} onClick={() => handleSelectProducer(p)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:C.w, border:"none", borderBottom:`1px solid ${C.b2}`, cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
                  {grantType==="producer"?Ic.user(C.pri,18):Ic.truck(C.acc,18)}
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:C.t1 }}>{p.userName}</span>
                      {pType && <span style={{ fontSize:9, fontWeight:700, color:TYPE_C[pType]||C.t3, background:`${TYPE_C[pType]||C.t3}15`, padding:"1px 6px", borderRadius:4, textTransform:"uppercase", letterSpacing:0.3 }}>{TYPE_L[pType]||pType}</span>}
                    </div>
                    <div style={{ fontSize:10.5, color:C.t3 }}>{p.producerCompanyName}{p.phone ? ` · ${p.phone}` : ""}{p.email ? ` · ${p.email}` : ""}</div>
                  </div>
                </button>
                );
              })}
            </div>
          )}

          {searchQ.trim().length >= 2 && !searching && searchResults.length === 0 && !selectedProducer && !selectedCompany && (
            <div style={{ fontSize:12, color:C.t3, marginTop:8, textAlign:"center", padding:10 }}>No se encontraron {searchMode==="company"?"empresas":grantType==="producer"?"productores":"transportistas"}</div>
          )}

          {/* Selected company — show plant selector + grant button */}
          {selectedCompany && (
            <div style={{ marginTop:12, background:`${C.pri}08`, border:`1.5px solid ${C.pri}30`, borderRadius:10, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                {Ic.plant(C.pri,20)}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{selectedCompany.companyName}</div>
                  {selectedCompany.address && <div style={{ fontSize:11, color:C.t2 }}>{selectedCompany.address}</div>}
                  {selectedCompany.phone && <div style={{ fontSize:10.5, color:C.t3 }}>{selectedCompany.phone}{selectedCompany.email ? ` · ${selectedCompany.email}` : ""}</div>}
                  <div style={{ fontSize:10, color:C.ok, fontWeight:600, marginTop:2 }}>Acceso para toda la empresa</div>
                </div>
                <button onClick={() => { setSelectedCompany(null); setSearchQ(""); setSelectedPlantIds([]); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,16)}</button>
              </div>
              {facilities ? <FacilitySelector/> : <div style={{ fontSize:11, color:C.t3, marginBottom:8 }}>Cargando instalaciones...</div>}
              <Btn full v="acc" disabled={saving || (fPlants.length > 0 && selCount === 0)} onClick={handleGrant}>{saving ? "Habilitando..." : fPlants.length > 0 ? `Habilitar empresa (${selCount} planta${selCount!==1?"s":""})` : "Habilitar empresa"}</Btn>
            </div>
          )}

          {/* Selected user — show plant selector + grant button */}
          {selectedProducer && (
            <div style={{ marginTop:12, background:grantType==="producer"?C.priPale:`${C.acc}0A`, border:`1.5px solid ${grantType==="producer"?C.pri:C.acc}30`, borderRadius:10, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                {grantType==="producer"?Ic.user(C.pri,20):Ic.truck(C.acc,20)}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.t1 }}>{selectedProducer.userName}</div>
                  <div style={{ fontSize:11, color:C.t2 }}>{selectedProducer.producerCompanyName}</div>
                  {selectedProducer.phone && <div style={{ fontSize:10.5, color:C.t3 }}>{selectedProducer.phone}{selectedProducer.email ? ` · ${selectedProducer.email}` : ""}</div>}
                  <div style={{ fontSize:10, color:C.info, fontWeight:600, marginTop:2 }}>Acceso solo para este usuario</div>
                </div>
                <button onClick={() => { setSelectedProducer(null); setSearchQ(""); setSelectedPlantIds([]); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>{Ic.cross(C.t3,16)}</button>
              </div>
              {facilities ? <FacilitySelector/> : <div style={{ fontSize:11, color:C.t3, marginBottom:8 }}>Cargando instalaciones...</div>}
              <Btn full v="acc" disabled={saving || (fPlants.length > 0 && selCount === 0)} onClick={handleGrant}>{saving ? "Habilitando..." : fPlants.length > 0 ? `Habilitar usuario (${selCount} planta${selCount!==1?"s":""})` : grantType==="producer"?"Habilitar usuario":"Habilitar usuario"}</Btn>
            </div>
          )}
        </div>
      )}

      {/* Access records list */}
      {loading ? <Loader/> :
        isAdmin && (selCompanyType === "producer" || selCompanyType === "transporter") ? (
          /* Producer/transporter view: show which plants they have access to */
          activeProducers.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>{selCompanyType === "transporter" ? "Sin accesos configurados para esta empresa." : "Esta empresa no tiene accesos a plantas."}</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(() => {
              const byPlantCo = new Map();
              for (const p of activeProducers) {
                const pcName = p.plantCompany?.name || "Planta";
                const pcId = p.plantCompanyId || p.plantCompany?.id || "_";
                if (!byPlantCo.has(pcId)) byPlantCo.set(pcId, { name: pcName, records: [] });
                byPlantCo.get(pcId).records.push(p);
              }
              return Array.from(byPlantCo.entries()).map(([pcId, { name, records }]) => (
                <div key={pcId} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px", background:`${C.pri}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                    {Ic.plant(C.pri,16)}
                    <div style={{ fontSize:13, fontWeight:700, color:C.pri }}>{name}</div>
                    <div style={{ fontSize:10, color:C.t3, marginLeft:4 }}>{records.length} acceso{records.length!==1?"s":""}</div>
                  </div>
                  <div style={{ padding:"4px 14px" }}>
                    {records.map(p => <ProducerRow key={p.id} p={p}/>)}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          /* Plant view (default): show records grouped by type then by plant */
          activeProducers.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.t3, fontSize: 13 }}>Ningún acceso habilitado aún.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Productores section */}
            {(Object.keys(grouped.producers.byPlant).length > 0 || grouped.producers.general.length > 0) && (
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.pri, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>{Ic.user(C.pri,16)} Productores</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {fPlants.map(plant => {
                    const prods = grouped.producers.byPlant[plant.id];
                    if (!prods || prods.length === 0) return null;
                    return (
                      <div key={plant.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                        <div style={{ padding:"10px 14px", background:`${C.pri}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                          {Ic.plant(C.pri,14)}
                          <div style={{ fontSize:12, fontWeight:700, color:C.pri }}>{plant.name}</div>
                          <div style={{ fontSize:10, color:C.t3, marginLeft:4 }}>{prods.length}</div>
                        </div>
                        <div style={{ padding:"4px 14px" }}>
                          {prods.map(p => <ProducerRow key={p.id} p={p}/>)}
                        </div>
                      </div>
                    );
                  })}
                  {grouped.producers.general.length > 0 && (
                    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                      <div style={{ padding:"10px 14px", background:`${C.t2}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                        {Ic.user(C.t2,14)}
                        <div style={{ fontSize:12, fontWeight:600, color:C.t2 }}>Acceso general</div>
                      </div>
                      <div style={{ padding:"4px 14px" }}>
                        {grouped.producers.general.map(p => <ProducerRow key={p.id} p={p}/>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Transportistas section */}
            {(Object.keys(grouped.transporters.byPlant).length > 0 || grouped.transporters.general.length > 0) && (
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.acc, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>{Ic.truck(C.acc,16)} Transportistas</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {fPlants.map(plant => {
                    const trans = grouped.transporters.byPlant[plant.id];
                    if (!trans || trans.length === 0) return null;
                    return (
                      <div key={plant.id} style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                        <div style={{ padding:"10px 14px", background:`${C.acc}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                          {Ic.plant(C.acc,14)}
                          <div style={{ fontSize:12, fontWeight:700, color:C.acc }}>{plant.name}</div>
                          <div style={{ fontSize:10, color:C.t3, marginLeft:4 }}>{trans.length}</div>
                        </div>
                        <div style={{ padding:"4px 14px" }}>
                          {trans.map(p => <ProducerRow key={p.id} p={p}/>)}
                        </div>
                      </div>
                    );
                  })}
                  {grouped.transporters.general.length > 0 && (
                    <div style={{ background: C.w, border: `1px solid ${C.b1}`, borderRadius: 12, boxShadow: C.sh, overflow:"hidden" }}>
                      <div style={{ padding:"10px 14px", background:`${C.t2}08`, borderBottom:`1px solid ${C.b2}`, display:"flex", alignItems:"center", gap:8 }}>
                        {Ic.truck(C.t2,14)}
                        <div style={{ fontSize:12, fontWeight:600, color:C.t2 }}>Acceso general</div>
                      </div>
                      <div style={{ padding:"4px 14px" }}>
                        {grouped.transporters.general.map(p => <ProducerRow key={p.id} p={p}/>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      }
      </div>
    </div>
  );
}
