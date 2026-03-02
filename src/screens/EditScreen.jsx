import { useState, useMemo } from "react";
import { C, Ic } from "../theme";
import { Btn, Field, LoadingOverlay } from "../components";

export default function EditScreen({ freight, fields, plants, branches, trucks, user, onBack, onSave }) {
  const isPending = freight.status === "pending_assignment";
  const canEditFleet = ["pending_assignment","assigned","accepted"].includes(freight.status);
  const canEditDest = ["pending_assignment","assigned","accepted","in_progress","loaded"].includes(freight.status);

  // Resolve current dest plant/company in catalog (catalog returns Company IDs for producers)
  const currentDestId = useMemo(() => {
    if (!plants?.length) return "";
    return plants.find(p => p.id === freight.destPlantId)?.id
      || plants.find(p => p.id === freight.destCompanyId)?.id
      || plants.find(p => p.companyId === freight.destCompanyId)?.id
      || "";
  }, [plants, freight.destPlantId, freight.destCompanyId]);

  // Check if user's company has trucks (own fleet)
  const showTruckSelect = useMemo(() => {
    if (!user) return false;
    const ut = user.userType;
    return (ut === "producer" || (user.userTypes || []).includes("producer")) && (trucks || []).length > 0;
  }, [user, trucks]);

  const [form, setForm] = useState({
    loadDate: freight.loadDate || "",
    loadTime: freight.loadTime || "",
    notes: freight.notes || "",
    ...(canEditFleet ? { useOwnFleet: freight.useOwnFleet ?? freight.isOwnFleet ?? false } : {}),
    ...(canEditDest ? { destPlantId: currentDestId, branchId: "" } : {}),
    ...(canEditFleet && showTruckSelect ? { truckId: "" } : {}),
  });
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const u = f => setForm(p=>({...p,...f}));

  // Branches filtered by selected plant company
  const selectedPlantCompanyId = (plants||[]).find(p=>p.id===form.destPlantId)?.companyId;
  const branchOpts = (branches||[]).filter(b=>b.companyId===selectedPlantCompanyId);
  const truckOpts = (trucks||[]).map(t=>({ id: t.id, label:`${t.plate}${t.model?` · ${t.model}`:""}` }));

  const save = async () => {
    setSaving(true);
    const data = {};
    if (isPending) {
      if (form.loadDate !== (freight.loadDate||"")) data.loadDate = form.loadDate;
      if (form.loadTime !== (freight.loadTime||"")) data.loadTime = form.loadTime;
      if (form.notes !== (freight.notes||"")) data.notes = form.notes;
    }
    if (canEditFleet && form.useOwnFleet !== (freight.useOwnFleet ?? freight.isOwnFleet ?? false)) {
      data.useOwnFleet = form.useOwnFleet;
    }
    if (canEditFleet && form.useOwnFleet && form.truckId) {
      data.truckId = form.truckId;
    }
    if (canEditDest && form.destPlantId && form.destPlantId !== currentDestId) {
      data.destPlantId = form.destPlantId;
      // If a branch is selected, pass its coords as customDest overrides
      if (form.branchId) {
        const branch = (branches||[]).find(b=>b.id===form.branchId);
        if (branch) {
          data.customDestName = branch.name;
          if (branch.lat) data.customDestLat = parseFloat(branch.lat);
          if (branch.lng) data.customDestLng = parseFloat(branch.lng);
        }
      }
    }
    if (Object.keys(data).length === 0) { setSaving(false); setDoneMsg("Sin cambios"); return; }
    const msg = await onSave(freight.id, data);
    setSaving(false);
    if(msg) setDoneMsg(msg);
  };

  const inputSt = {width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.b1}`,background:C.w,color:C.t1,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",cursor:"pointer"};
  const labelSt = {fontSize:10.5,fontWeight:600,color:C.t2,marginBottom:6,display:"flex",alignItems:"center",gap:4,textTransform:"uppercase",letterSpacing:0.6};

  return (
    <div style={{ flex:1, overflow:"auto" }}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>{setDoneMsg("");onBack();}}/>}
      <div style={{ position:"sticky", top:0, zIndex:10, background:C.bg, padding:"18px 18px 8px" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, color:C.pri, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:4 }}>{Ic.chev(C.pri,18)} Volver</button>
        <div style={{ fontSize:20, fontWeight:800, marginBottom:4, letterSpacing:-0.3 }}>Editar Flete</div>
      </div>
      <div style={{ padding:"0 18px 18px" }}>
      <div style={{ fontSize:12, color:C.t2, marginBottom:22 }}>{freight.code} · {freight.grain} · {freight.tons} {freight.unit||"tn"}</div>

      <div style={{ background:C.w, border:`1px solid ${C.b1}`, borderRadius:12, padding:16, boxShadow:C.sh }}>
        {/* Date/Time — only in pending_assignment */}
        {isPending && <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <div style={{flex:1}}>
            <label style={labelSt}>{Ic.cal(C.pri,14)} Fecha</label>
            <input type="date" value={form.loadDate} onChange={e=>u({loadDate:e.target.value})} onClick={e=>e.target.showPicker?.()} style={inputSt}/>
          </div>
          <div style={{flex:1}}>
            <label style={labelSt}>{Ic.clk(C.pri,14)} Hora</label>
            <input type="time" value={form.loadTime} onChange={e=>u({loadTime:e.target.value})} onClick={e=>e.target.showPicker?.()} style={inputSt}/>
          </div>
        </div>}

        {/* Notes — only in pending_assignment */}
        {isPending && <div style={{marginBottom:16}}>
          <label style={{...labelSt,display:"block"}}>Notas</label>
          <textarea value={form.notes} onChange={e=>u({notes:e.target.value})} placeholder="Indicaciones..." rows={3} style={{...inputSt,resize:"none",cursor:"text"}}/>
        </div>}

        {/* useOwnFleet toggle */}
        {canEditFleet && <div style={{marginBottom:16}}>
          <label style={labelSt}>{Ic.truck(C.pri,14)} Flota propia</label>
          <button onClick={()=>u({useOwnFleet:!form.useOwnFleet, truckId:""})} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 14px", borderRadius:10, border:`1.5px solid ${form.useOwnFleet?C.ok:C.b1}`, background:form.useOwnFleet?(C.okPale||"#e6f9ec"):C.w, cursor:"pointer", fontFamily:"inherit", fontSize:14, color:C.t1 }}>
            <span style={{ width:36, height:20, borderRadius:10, background:form.useOwnFleet?C.ok:C.b1, position:"relative", display:"inline-block", transition:"background 0.2s" }}>
              <span style={{ width:16, height:16, borderRadius:8, background:C.w, position:"absolute", top:2, left:form.useOwnFleet?18:2, transition:"left 0.2s", boxShadow:"0 1px 3px #0002" }}/>
            </span>
            {form.useOwnFleet ? "Sí — usar flota propia" : "No — transporte externo"}
          </button>
        </div>}

        {/* Truck selector — only when useOwnFleet=true and has trucks */}
        {canEditFleet && form.useOwnFleet && showTruckSelect && <div style={{marginBottom:16}}>
          <label style={labelSt}>{Ic.truck(C.pri,14)} Vehículo</label>
          <select value={form.truckId||""} onChange={e=>u({truckId:e.target.value})} style={{...inputSt,appearance:"auto"}}>
            <option value="">— Seleccionar camión —</option>
            {truckOpts.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>}

        {/* Dest plant selector */}
        {canEditDest && plants?.length > 0 && <div style={{marginBottom:16}}>
          <label style={labelSt}>{Ic.plant(C.pri,14)} Planta destino</label>
          <select value={form.destPlantId} onChange={e=>u({destPlantId:e.target.value, branchId:""})} style={{...inputSt,appearance:"auto"}}>
            <option value="">— Seleccionar planta —</option>
            {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>}

        {/* Branch selector — filtered by selected plant company */}
        {canEditDest && form.destPlantId && branchOpts.length > 0 && <div style={{marginBottom:16}}>
          <label style={labelSt}>{Ic.plant(C.t2,14)} Sucursal</label>
          <select value={form.branchId||""} onChange={e=>u({branchId:e.target.value})} style={{...inputSt,appearance:"auto"}}>
            <option value="">— Sin sucursal específica —</option>
            {branchOpts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>}

        <Btn full disabled={saving} onClick={save}>{saving?"Guardando...":"Guardar cambios"}</Btn>
      </div>

      <div style={{ marginTop:16, padding:12, background:C.bgInput, borderRadius:10, fontSize:11, color:C.t3 }}>
        {isPending
          ? "Podés editar fecha, hora, notas, flota propia y planta destino."
          : "Algunos cambios pueden requerir aprobación de la otra parte."}
      </div>
      </div>
    </div>
  );
}
