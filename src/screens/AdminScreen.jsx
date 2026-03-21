import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { C, Ic, FONT, MONO , R} from "../theme";
import { Btn, Field, Tabs, Select, Loader, Av, Bd, LoadingOverlay, NumericStepper } from "../components";
import { apiAdminStats, apiAdminActivity, apiAdminListCompanies, apiAdminGetCompany, apiAdminCreateCompany, apiAdminUpdateCompany, apiAdminListBranches, apiAdminCreateBranch, apiAdminUpdateBranch, apiAdminDeleteBranch, apiAdminListUsers, apiAdminCreateUser, apiAdminUpdateUser, apiAdminAddUserCompany, apiAdminUpdateUserCompany, apiAdminRemoveUserCompany, apiAdminListFields, apiAdminCreateField, apiAdminUpdateField, apiAdminDeleteField, apiAdminListLots, apiAdminCreateLot, apiAdminUpdateLot, apiAdminDeleteLot, apiAdminListTrucks, apiAdminCreateTruck, apiAdminUpdateTruck, apiAdminDeleteTruck, apiAdminImportCompanies, apiAdminImportUsers } from "../api";
import { adminStyles, typeColors, typeLabels, roleLabels, adminBackBtn } from "../utils/freight-helpers";
import { LocationPicker } from "../maps";
import AccessScreen from "./AccessScreen";
import LinkedCompaniesScreen from "./LinkedCompaniesScreen";
import ImportExcelModal from "../components/ImportExcelModal";
import { useCatalogStore } from "../store";

export default function AdminScreen({ user, onBack }) {
  const isPlatform = user.role === "platform_admin" || user.isSuperAdmin === true;
  const isManager = user.role === "admin";
  const isHub = ["admin","gerente","platform_admin"].includes(user.role);
  const s = adminStyles();

  const [tab, setTab] = useState("companies");
  const [companies, setCompanies] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [statsFilter, setStatsFilter] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

  // Views: list | companyForm | companyDetail | userForm | userEdit
  const [view, setView] = useState("list");
  const [companyForm, setCompanyForm] = useState({ name:"",type:"producer",phone:"",email:"",rut:"",hasInternalFleet:false,lat:null,lng:null,address:"" });
  const [editCompanyId, setEditCompanyId] = useState(null);
  const [userForm, setUserForm] = useState({ name:"",email:"",phone:"",password:"",userTypes:[],companyByType:{},roleByType:{} });
  const [editUserData, setEditUserData] = useState(null);
  const [originalUserData, setOriginalUserData] = useState(null);
  const [activeUserType, setActiveUserType] = useState(null); // which type tab is active in user edit
  const [branchForm, setBranchForm] = useState({ name:"",address:"",reference:"",lat:null,lng:null,locationAddress:"" });
  const [editBranchId, setEditBranchId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showBranchForm, setShowBranchForm] = useState(false);

  // Producer: fields + lots
  const [fields, setFields] = useState([]);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState({ name:"",lat:null,lng:null,address:"",hectares:"",comments:"" });
  const [editFieldId, setEditFieldId] = useState(null);
  const [expandedFieldId, setExpandedFieldId] = useState(null);
  const [lots, setLots] = useState([]);
  const [showLotForm, setShowLotForm] = useState(false);
  const [lotForm, setLotForm] = useState({ name:"",lat:null,lng:null,address:"",hectares:"",comments:"" });
  const [editLotId, setEditLotId] = useState(null);

  // Transporter: trucks
  const [trucks, setTrucks] = useState([]);
  const [showTruckForm, setShowTruckForm] = useState(false);
  const [truckForm, setTruckForm] = useState({ plate:"",brand:"",model:"",capacity:"" });
  const [editTruckId, setEditTruckId] = useState(null);

  // Detail tab: branches | fields | trucks
  const [detailTab, setDetailTab] = useState("branches");

  // User edit — membership management (must be top-level for hooks rules)
  const [savingField, setSavingField] = useState(null);
  const [savedField, setSavedField] = useState(null);
  const [addingCompany, setAddingCompany] = useState(false);
  const [addCompanyId, setAddCompanyId] = useState("");
  const [addCompanyRole, setAddCompanyRole] = useState("operario");
  const [confirmRemove, setConfirmRemove] = useState(null);

  // Import modal: null | "companies" | "users"
  const [importMode, setImportMode] = useState(null);

  const msgTimer = useRef(null);
  const show = (t,k="ok") => { setMsg({t,k}); clearTimeout(msgTimer.current); msgTimer.current = setTimeout(()=>setMsg(null),3000); };
  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([apiAdminListCompanies(), apiAdminListUsers()]);
      setCompanies(c||[]); setAllCompanies(c||[]); setUsers(u||[]); setAllUsers(u||[]);
      if(isPlatform) { const st = await apiAdminStats(); setStats(st); }
    } catch(e) { show(e.message,"err"); }
    finally { setLoading(false); }
  }, [isPlatform]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if(tab==="companies") { const c=search?(await apiAdminListCompanies(search)):allCompanies; setCompanies(c||[]); }
        else { const u=search?(await apiAdminListUsers(search)):allUsers; setUsers(u||[]); }
      } catch { /* debounced search — silent */ }
    }, 300);
    return ()=>clearTimeout(t);
  }, [search, tab, allCompanies, allUsers]);

  // Load activity when tab switches
  useEffect(() => {
    if (tab !== "activity") return;
    setActivityLoading(true);
    apiAdminActivity(activityPage, 20).then(r => {
      setActivity(prev => activityPage === 1 ? (r.data || []) : [...prev, ...(r.data || [])]);
      setActivityTotal(r.total || 0);
    }).catch(() => {}).finally(() => setActivityLoading(false));
  }, [tab, activityPage]);

  const handleStatsClick = (filter) => {
    if(statsFilter===filter) { setStatsFilter(null); return; }
    setStatsFilter(filter);
    if(filter==="companies"||filter==="branches") setTab("companies");
    else if(filter==="users") setTab("users");
    setSearch("");
  };

  // --- Company ---
  const openNewCompany = () => { setCompanyForm({name:"",type:"producer",phone:"",email:"",rut:"",hasInternalFleet:false,lat:null,lng:null,address:""}); setEditCompanyId(null); setView("companyForm"); };
  const openEditCompany = (c) => { setCompanyForm({name:c.name,type:c.type,phone:c.phone||"",email:c.email||"",rut:c.rut||"",hasInternalFleet:!!c.hasInternalFleet,lat:c.lat?Number(c.lat):null,lng:c.lng?Number(c.lng):null,address:c.address||""}); setEditCompanyId(c.id); setView("companyForm"); };
  const handleSaveCompany = async () => {
    if(!companyForm.name.trim()) return show("Nombre requerido","err");
    if(!/^09\d{7}$/.test(companyForm.phone)) return show("Celular obligatorio (09XXXXXXX)","err");
    setSaving(true);
    try {
      if(editCompanyId) { await apiAdminUpdateCompany(editCompanyId, companyForm); setDoneMsg("Empresa actualizada"); }
      else { await apiAdminCreateCompany(companyForm); setDoneMsg("Empresa creada"); }
      useCatalogStore.getState().clearCache();
      setView("list"); await load();
    } catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };

  // --- Branches ---
  const openCompanyDetail = async (c) => {
    setSelectedCompany(c); setBranches([]); setFields([]); setTrucks([]);
    setShowBranchForm(false); setShowFieldForm(false); setShowTruckForm(false); setShowLotForm(false); setExpandedFieldId(null);
    setDetailTab("branches"); setView("companyDetail");
    try { const b=await apiAdminListBranches(c.id); setBranches(b||[]); } catch(e) { console.warn('[AdminScreen] Load branches failed:', e.message); }
    if(c.type==="producer") { try { const f=await apiAdminListFields(c.id); setFields(f||[]); } catch(e) { console.warn('[AdminScreen] Load fields failed:', e.message); } }
    if(c.type==="transporter") { try { const t=await apiAdminListTrucks(c.id); setTrucks(t||[]); } catch(e) { console.warn('[AdminScreen] Load trucks failed:', e.message); } }
  };
  const openNewBranch = () => { setBranchForm({name:"",address:"",reference:"",lat:null,lng:null,locationAddress:""}); setEditBranchId(null); setShowBranchForm(true); };
  const openEditBranch = (b) => { setBranchForm({name:b.name,address:b.address||"",reference:b.reference||"",lat:b.lat?Number(b.lat):null,lng:b.lng?Number(b.lng):null,locationAddress:""}); setEditBranchId(b.id); setShowBranchForm(true); };
  const handleSaveBranch = async () => {
    if(!branchForm.name.trim()) return show("Nombre requerido","err");
    setSaving(true);
    try {
      const {locationAddress, ...branchData} = branchForm;
      // If locationAddress exists but address is empty, use locationAddress as address
      if(locationAddress && !branchData.address?.trim()) {
        branchData.address = locationAddress;
      }
      if(editBranchId) { await apiAdminUpdateBranch(editBranchId, branchData); setDoneMsg("Sucursal actualizada"); }
      else { await apiAdminCreateBranch({...branchData,companyId:selectedCompany.id}); setDoneMsg("Sucursal creada"); }
      useCatalogStore.getState().clearCache();
      setShowBranchForm(false); const b=await apiAdminListBranches(selectedCompany.id); setBranches(b||[]); await load();
    } catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };
  const handleDeleteBranch = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteBranch(id); setDoneMsg("Sucursal eliminada"); useCatalogStore.getState().clearCache(); const b=await apiAdminListBranches(selectedCompany.id); setBranches(b||[]); await load(); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Fields ---
  const openNewField = () => { setFieldForm({name:"",lat:null,lng:null,address:"",hectares:"",comments:""}); setEditFieldId(null); setShowFieldForm(true); };
  const openEditField = (f) => { setFieldForm({name:f.name,lat:f.lat?Number(f.lat):null,lng:f.lng?Number(f.lng):null,address:f.address||"",hectares:f.hectares?String(f.hectares):"",comments:f.comments||""}); setEditFieldId(f.id); setShowFieldForm(true); };
  const handleSaveField = async () => {
    if(!fieldForm.name.trim()) return show("Nombre requerido","err");
    if(fieldForm.lat==null||fieldForm.lng==null) return show("Ubicación requerida","err");
    setSaving(true);
    try {
      const data = {...fieldForm, hectares:fieldForm.hectares?Number(fieldForm.hectares):null};
      if(editFieldId) { await apiAdminUpdateField(editFieldId, data); setDoneMsg("Campo actualizado"); }
      else { await apiAdminCreateField(selectedCompany.id, data); setDoneMsg("Campo creado"); }
      useCatalogStore.getState().clearCache();
      setShowFieldForm(false); const f=await apiAdminListFields(selectedCompany.id); setFields(f||[]); await load();
    } catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };
  const handleDeleteField = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteField(id); setDoneMsg("Campo eliminado"); useCatalogStore.getState().clearCache(); const f=await apiAdminListFields(selectedCompany.id); setFields(f||[]); await load(); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Lots ---
  const expandField = async (fieldId) => {
    if(expandedFieldId===fieldId) { setExpandedFieldId(null); return; }
    setExpandedFieldId(fieldId); setLots([]); setShowLotForm(false);
    try { const l=await apiAdminListLots(fieldId); setLots(l||[]); } catch {}
  };
  const openNewLot = () => { setLotForm({name:"",lat:null,lng:null,address:"",hectares:"",comments:""}); setEditLotId(null); setShowLotForm(true); };
  const openEditLot = (l) => { setLotForm({name:l.name,lat:l.lat?Number(l.lat):null,lng:l.lng?Number(l.lng):null,address:"",hectares:l.hectares?String(l.hectares):"",comments:l.comments||""}); setEditLotId(l.id); setShowLotForm(true); };
  const handleSaveLot = async () => {
    if(!lotForm.name.trim()) return show("Nombre requerido","err");
    if(lotForm.lat==null||lotForm.lng==null) return show("Ubicación requerida","err");
    setSaving(true);
    try {
      const data = {...lotForm, hectares:lotForm.hectares?Number(lotForm.hectares):null};
      if(editLotId) { await apiAdminUpdateLot(editLotId, data); setDoneMsg("Lote actualizado"); }
      else { await apiAdminCreateLot(expandedFieldId, data); setDoneMsg("Lote creado"); }
      useCatalogStore.getState().clearCache();
      setShowLotForm(false); const l=await apiAdminListLots(expandedFieldId); setLots(l||[]);
      const f=await apiAdminListFields(selectedCompany.id); setFields(f||[]);
    } catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };
  const handleDeleteLot = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteLot(id); setDoneMsg("Lote eliminado"); useCatalogStore.getState().clearCache(); const l=await apiAdminListLots(expandedFieldId); setLots(l||[]); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Trucks ---
  const openNewTruck = () => { setTruckForm({plate:"",brand:"",model:"",capacity:""}); setEditTruckId(null); setShowTruckForm(true); };
  const openEditTruck = (t) => { setTruckForm({plate:t.plate,brand:t.brand||"",model:t.model||"",capacity:t.capacity||""}); setEditTruckId(t.id); setShowTruckForm(true); };
  const handleSaveTruck = async () => {
    if(!truckForm.plate.trim()) return show("Patente requerida","err");
    setSaving(true);
    try {
      if(editTruckId) { await apiAdminUpdateTruck(editTruckId, truckForm); setDoneMsg("Vehículo actualizado"); }
      else { await apiAdminCreateTruck(selectedCompany.id, truckForm); setDoneMsg("Vehículo creado"); }
      useCatalogStore.getState().clearCache();
      setShowTruckForm(false); const t=await apiAdminListTrucks(selectedCompany.id); setTrucks(t||[]); await load();
    } catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };
  const handleDeleteTruck = async (id) => { if(saving) return; setSaving(true); try { await apiAdminDeleteTruck(id); setDoneMsg("Vehículo eliminado"); useCatalogStore.getState().clearCache(); const t=await apiAdminListTrucks(selectedCompany.id); setTrucks(t||[]); await load(); } catch(e) { show(e.message,"err"); } finally { setSaving(false); } };

  // --- Users with companyByType + roleByType ---
  const toggleFormUserType = (t) => setUserForm(p=>({...p,userTypes:p.userTypes.includes(t)?p.userTypes.filter(x=>x!==t):[...p.userTypes,t]}));
  const toggleEditUserType = (t) => setEditUserData(p=>{
    const has = (p.userTypes||[]).includes(t);
    const newTypes = has ? (p.userTypes||[]).filter(x=>x!==t) : [...(p.userTypes||[]),t];
    return {...p, userTypes:newTypes};
  });

  const openNewUser = () => { setUserForm({name:"",email:"",phone:"",password:"",userTypes:[],companyByType:{},roleByType:{},_selectedCompanyId:""}); setActiveUserType(null); setView("userForm"); };

  const openEditUser = (u) => {
    const cbt = u.companyByType && typeof u.companyByType === "object" ? {...u.companyByType} : {};
    const rbt = u.roleByType && typeof u.roleByType === "object" ? {...u.roleByType} : {};
    if(u.companyId && u.company && Object.keys(cbt).length===0) cbt[u.company.type] = u.companyId;
    if(u.role && Object.keys(rbt).length===0 && (u.userTypes||[]).length>0) {
      (u.userTypes||[]).forEach(t => { rbt[t] = u.role; });
    }
    const types = u.userTypes||[];
    const userData = {...u, userTypes:types, companyByType:cbt, roleByType:rbt};
    setEditUserData(userData);
    setOriginalUserData({...userData});
    setActiveUserType(types[0]||null);
    setView("userEdit");
  };

  const handleCreateUser = async () => {
    if(!userForm.name.trim()||!userForm.email.trim()||!userForm.password) return show("Nombre, email y contraseña obligatorios","err");
    if(!userForm._selectedCompanyId) return show("Seleccioná una empresa","err");
    if(userForm.userTypes.length===0) return show("Seleccioná al menos un tipo","err");
    setSaving(true);
    const cbt = userForm.companyByType||{};
    const rbt = userForm.roleByType||{};
    const firstCompanyId = Object.values(cbt).find(v=>v) || undefined;
    const rawRole = Object.values(rbt).find(v=>v) || "operator";
    const firstRole = rawRole === "chofer" ? "operator" : rawRole;
    const {_selectedCompanyId, ...payload} = userForm;
    try { await apiAdminCreateUser({...payload, companyId:firstCompanyId, role:firstRole, companyByType:cbt, roleByType:rbt}); setDoneMsg("Usuario creado"); useCatalogStore.getState().clearCache(); setView("list"); await load(); }
    catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };

  const getEditChanges = () => {
    if(!editUserData||!originalUserData) return {};
    const changes = {};
    const fields = ["name","email","phone","role","active"];
    fields.forEach(f => { if(editUserData[f] !== originalUserData[f]) changes[f] = true; });
    return changes;
  };

  const handleSaveEditUser = async () => {
    const changes = getEditChanges();
    if(Object.keys(changes).length===0) return;
    setSaving(true);
    const payload = {};
    if(changes.name) payload.name = editUserData.name;
    if(changes.email) payload.email = editUserData.email;
    if(changes.phone) payload.phone = editUserData.phone;
    if(changes.role) payload.role = editUserData.role;
    if(changes.active) payload.active = editUserData.active;
    try {
      await apiAdminUpdateUser(editUserData.id, payload);
      setDoneMsg("Cambios guardados"); useCatalogStore.getState().clearCache(); setOriginalUserData({...editUserData}); setView("list"); await load();
    } catch(e) { show(e.message,"err"); }
    finally { setSaving(false); }
  };

  const handleEditUserBack = () => {
    const changes = getEditChanges();
    if(Object.keys(changes).length>0) {
      if(!window.confirm("Tenés cambios sin guardar. ¿Salir sin guardar?")) return;
    }
    setView("list");
  };

  const MsgBar = () => msg ? <div style={{padding:"8px 12px",borderRadius: R.md,background:msg.k==="ok"?C.okPale:`${C.err}15`,color:msg.k==="ok"?C.ok:C.err,fontSize:13.2,marginTop:10,marginBottom:10,display:"flex",justifyContent:"space-between"}}>{msg.t}<button onClick={()=>setMsg(null)} style={{background:"none",border:"none",cursor:"pointer",color:"inherit",fontFamily:"inherit"}}>✕</button></div> : null;

  // ===================== COMPANY FORM =====================
  if (view==="companyForm") {
    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
        {adminBackBtn(()=>setView("list"))}
        <div style={{fontSize:17.6,fontWeight:700,color:C.t1,marginBottom:12}}>{editCompanyId?"Editar empresa":"Nueva empresa"}</div>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,boxShadow:C.sh}}>
          <div style={s.lbl}>Nombre:</div>
          <input value={companyForm.name} onChange={e=>setCompanyForm(p=>({...p,name:e.target.value}))} placeholder="Nombre de la empresa" style={{...s.inp,marginBottom:10}} />
          <div style={s.lbl}>Tipo:</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {["producer","plant","transporter"].map(t=>(<button key={t} onClick={()=>setCompanyForm(p=>({...p,type:t}))} style={{flex:1,padding:"9px 0",borderRadius: R.md,border:`1.5px solid ${companyForm.type===t?typeColors[t]:C.b1}`,background:companyForm.type===t?`${typeColors[t]}12`:C.w,color:companyForm.type===t?typeColors[t]:C.t2,fontSize:13.2,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{typeLabels[t]}</button>))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><div style={s.lbl}>Email:</div><input value={companyForm.email} onChange={e=>setCompanyForm(p=>({...p,email:e.target.value}))} placeholder="Email" style={s.inp} /></div>
            <div style={{flex:1}}><div style={s.lbl}>Celular: <span style={{fontWeight:400,color:C.t3}}>(obligatorio)</span></div><input value={companyForm.phone} onChange={e=>{ const v=e.target.value.replace(/\D/g,"").slice(0,9); setCompanyForm(p=>({...p,phone:v})); }} placeholder="09XXXXXXX" maxLength={9} inputMode="tel" style={{...s.inp, borderColor: companyForm.phone && !/^09\d{7}$/.test(companyForm.phone) ? C.err : undefined }} /></div>
          </div>
          <div style={s.lbl}>RUT:</div>
          <input value={companyForm.rut} onChange={e=>setCompanyForm(p=>({...p,rut:e.target.value}))} placeholder="RUT" style={{...s.inp,marginBottom:10}} />
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13.2,color:C.t2,marginBottom:10,cursor:"pointer"}}>
            <input type="checkbox" checked={companyForm.hasInternalFleet} onChange={e=>setCompanyForm(p=>({...p,hasInternalFleet:e.target.checked}))} style={{width:16,height:16}} /> Flota propia
          </label>
          <LocationPicker label="Ubicación" value={companyForm.lat?{lat:companyForm.lat,lng:companyForm.lng,address:companyForm.address||""}:null} onChange={(loc)=>setCompanyForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,address:loc?.address||""}))} />
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <button onClick={()=>setView("list")} style={{flex:1,padding:"10px 0",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:14.3,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
            <button onClick={handleSaveCompany} disabled={saving} style={{...s.btnP(C.pri,saving),flex:2}}>{saving?"Guardando...":(editCompanyId?"Guardar cambios":"Crear empresa")}</button>
          </div>
        </div>
        <MsgBar/>
      </div>
    );
  }

  // ===================== USER EDIT =====================
  if (view==="userEdit" && editUserData) {
    const memberships = editUserData.memberships||[];
    const membershipRoles = {operario:"Operario",gerente:"Gerente",chofer:"Chofer"};
    const changes = getEditChanges();
    const changeCount = Object.keys(changes).length;
    const roleLabelsMap = {operator:"Operador",admin:"Admin",platform_admin:"Admin Principal"};
    const statusLabelsMap = {true:"Activo",false:"Inactivo"};

    const handleAddCompany = async () => {
      if(!addCompanyId) return;
      setSavingField("addCompany");
      try {
        const result = await apiAdminAddUserCompany(editUserData.id, addCompanyId, addCompanyRole);
        const co = allCompanies.find(c=>c.id===addCompanyId);
        setEditUserData(p=>({...p, memberships:[...(p.memberships||[]), {id:result.id, companyId:addCompanyId, role:addCompanyRole, company:co||result.company}]}));
        setAddingCompany(false); setAddCompanyId(""); setAddCompanyRole("operario");
        show("Empresa agregada","ok");
      } catch(e) { show(e.message,"err"); }
      finally { setSavingField(null); }
    };

    const handleUpdateMembershipRole = async (companyId, newRole) => {
      setSavingField("role_"+companyId);
      try {
        await apiAdminUpdateUserCompany(editUserData.id, companyId, newRole);
        setEditUserData(p=>({...p, memberships:(p.memberships||[]).map(m=>m.companyId===companyId?{...m,role:newRole}:m)}));
        setSavedField("role_"+companyId); setTimeout(()=>setSavedField(null),2000);
      } catch(e) { show(e.message,"err"); }
      finally { setSavingField(null); }
    };

    const handleRemoveMembership = async (companyId) => {
      setSavingField("rm_"+companyId);
      try {
        await apiAdminRemoveUserCompany(editUserData.id, companyId);
        setEditUserData(p=>({...p, memberships:(p.memberships||[]).filter(m=>m.companyId!==companyId)}));
        setConfirmRemove(null);
        show("Empresa removida","ok");
      } catch(e) { show(e.message,"err"); }
      finally { setSavingField(null); }
    };

    const existingCompanyIds = new Set(memberships.map(m=>m.companyId));
    const availableCompanies = allCompanies.filter(c=>!existingCompanyIds.has(c.id));

    const PrevValue = ({field, labelFn}) => {
      if(!changes[field] || !originalUserData) return null;
      const prev = labelFn ? labelFn(originalUserData[field]) : (originalUserData[field]||"(vacío)");
      return <div style={{fontSize:11.5,color:C.t3,textDecoration:"line-through",marginTop:2}}>{prev}</div>;
    };

    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
        {adminBackBtn(handleEditUserBack)}
        <div style={{fontSize:17.6,fontWeight:700,color:C.t1,marginBottom:12}}>Editar usuario</div>

        {/* Section A — Personal data */}
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.lg,padding:16,boxShadow:C.sh,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:10}}>Datos personales</div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:"0 16px"}}>
            {/* Nombre — full width */}
            <div style={{gridColumn:"1 / -1",marginBottom:10}}>
              <div style={s.lbl}>Nombre:</div>
              <input value={editUserData.name} onChange={e=>setEditUserData(p=>({...p,name:e.target.value}))} placeholder="Nombre" style={{...s.inp,marginBottom:0,borderColor:changes.name?C.pri:undefined}} />
              <PrevValue field="name"/>
            </div>

            {/* Email */}
            <div style={{marginBottom:10}}>
              <div style={s.lbl}>Email:</div>
              <input value={editUserData.email} onChange={e=>setEditUserData(p=>({...p,email:e.target.value}))} placeholder="Email" style={{...s.inp,marginBottom:0,borderColor:changes.email?C.pri:undefined}} />
              <PrevValue field="email"/>
            </div>

            {/* Teléfono */}
            <div style={{marginBottom:10}}>
              <div style={s.lbl}>Teléfono:</div>
              <input value={editUserData.phone||""} onChange={e=>setEditUserData(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={{...s.inp,marginBottom:0,borderColor:changes.phone?C.pri:undefined}} />
              <PrevValue field="phone"/>
            </div>

            {/* Rol global */}
            <div style={{marginBottom:10}}>
              <div style={s.lbl}>Rol global:</div>
              <select value={editUserData.role||"operator"} onChange={e=>setEditUserData(p=>({...p,role:e.target.value}))} style={{...s.sel,borderColor:changes.role?C.pri:undefined}}>
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
                {isPlatform && <option value="platform_admin">Admin Principal</option>}
              </select>
              <PrevValue field="role" labelFn={v=>roleLabelsMap[v]||v}/>
            </div>

            {/* Estado */}
            <div style={{marginBottom:10}}>
              <div style={s.lbl}>Estado:</div>
              <select value={editUserData.active?"active":"inactive"} onChange={e=>setEditUserData(p=>({...p,active:e.target.value==="active"}))} style={{...s.sel,borderColor:changes.active?C.pri:undefined}}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
              <PrevValue field="active" labelFn={v=>statusLabelsMap[String(v)]||String(v)}/>
            </div>
          </div>

          {/* Single save button */}
          <button disabled={changeCount===0||saving} onClick={handleSaveEditUser} style={{...s.btnP(C.pri,saving||changeCount===0),width:"100%",marginTop:6,opacity:changeCount===0?0.45:1}}>
            {saving?"Guardando...":`Guardar cambios${changeCount>0?` (${changeCount})`:""}`}
          </button>
        </div>

        {/* Section B — Company memberships */}
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.lg,padding:16,boxShadow:C.sh}}>
          <div style={{fontSize:14,fontWeight:700,color:C.t1,marginBottom:10}}>Empresas asignadas</div>

          {memberships.length===0 && !addingCompany && (
            <div style={{fontSize:13,color:C.t3,padding:"12px 0",textAlign:"center"}}>Sin empresas asignadas</div>
          )}

          {memberships.map((m,i)=>{
            const co = m.company || {};
            const isRemoving = confirmRemove===m.companyId;
            return (
              <div key={m.companyId} style={{padding:"12px 0",borderBottom:i<memberships.length-1?`1px solid ${C.b2}`:"none",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:"1 1 140px",minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:C.t1}}>{co.name||"Empresa"}</div>
                  <span style={{display:"inline-block",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius: R.md,marginTop:3,color:typeColors[co.type]||C.t3,background:`${typeColors[co.type]||C.t3}15`}}>
                    {typeLabels[co.type]||co.type}
                  </span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                  <select value={m.role} onChange={e=>handleUpdateMembershipRole(m.companyId,e.target.value)}
                    disabled={savingField==="role_"+m.companyId}
                    style={{...s.sel,fontSize:12,padding:"6px 8px",minWidth:100,marginBottom:0}}>
                    {Object.entries(membershipRoles).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                  {savingField==="role_"+m.companyId && <span style={{fontSize:11,color:C.t3}}>...</span>}
                  {savedField==="role_"+m.companyId && <span style={{fontSize:11,color:C.ok,fontWeight:600}}>✓</span>}
                  {!isRemoving ? (
                    <button onClick={()=>setConfirmRemove(m.companyId)} style={{background:"none",border:"none",color:C.err,cursor:"pointer",fontSize:12,fontWeight:600,padding:"4px 8px",borderRadius: R.sm,fontFamily:"inherit"}}
                      onMouseEnter={e=>{e.currentTarget.style.background=C.errPale}} onMouseLeave={e=>{e.currentTarget.style.background="none"}}>
                      Quitar
                    </button>
                  ) : (
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <button disabled={savingField==="rm_"+m.companyId} onClick={()=>handleRemoveMembership(m.companyId)} style={{background:C.err,color:C.w,border:"none",borderRadius: R.sm,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                        {savingField==="rm_"+m.companyId?"...":"Confirmar"}
                      </button>
                      <button onClick={()=>setConfirmRemove(null)} style={{background:"none",border:`1px solid ${C.b1}`,borderRadius: R.sm,padding:"4px 8px",fontSize:11,color:C.t3,cursor:"pointer",fontFamily:"inherit"}}>No</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add company */}
          {!addingCompany ? (
            <button onClick={()=>setAddingCompany(true)} style={{width:"100%",padding:"10px 0",borderRadius: R.md,border:`1.5px dashed ${C.pri}`,background:`${C.pri}06`,color:C.pri,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:10}}>
              {Ic.plus(C.pri,14)} Agregar empresa
            </button>
          ) : (
            <div style={{border:`1.5px solid ${C.pri}`,borderRadius: R.md,padding:12,marginTop:10,background:`${C.pri}04`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.pri,marginBottom:8}}>Agregar empresa</div>
              <select value={addCompanyId} onChange={e=>setAddCompanyId(e.target.value)} style={{...s.sel,marginBottom:8}}>
                <option value="">Seleccionar empresa...</option>
                {availableCompanies.map(c=><option key={c.id} value={c.id}>{c.name} ({typeLabels[c.type]||c.type})</option>)}
              </select>
              <div style={s.lbl}>Rol en la empresa:</div>
              <select value={addCompanyRole} onChange={e=>setAddCompanyRole(e.target.value)} style={{...s.sel,marginBottom:8}}>
                {Object.entries(membershipRoles).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setAddingCompany(false);setAddCompanyId("");}} style={{flex:1,padding:"8px 0",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:12.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button disabled={!addCompanyId||savingField==="addCompany"} onClick={handleAddCompany} style={{...s.btnP(C.pri,savingField==="addCompany"),flex:1,padding:"8px 0",fontSize:12.5}}>
                  {savingField==="addCompany"?"Agregando...":"Agregar"}
                </button>
              </div>
            </div>
          )}
        </div>
        <MsgBar/>
      </div>
    );
  }

  // ===================== USER CREATE =====================
  if (view==="userForm") {
    const formTypes = userForm.userTypes;
    const formAt = activeUserType && formTypes.includes(activeUserType) ? activeUserType : formTypes[0]||null;
    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
        {adminBackBtn(()=>setView("list"))}
        <div style={{fontSize:17.6,fontWeight:700,color:C.t1,marginBottom:12}}>Nuevo usuario</div>
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,boxShadow:C.sh}}>
          <div style={s.lbl}>Nombre:</div>
          <input value={userForm.name} onChange={e=>setUserForm(p=>({...p,name:e.target.value}))} placeholder="Nombre completo" style={{...s.inp,marginBottom:10}} />
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}><div style={s.lbl}>Email:</div><input value={userForm.email} onChange={e=>setUserForm(p=>({...p,email:e.target.value}))} placeholder="Email" type="email" style={s.inp} /></div>
            <div style={{flex:1}}><div style={s.lbl}>Teléfono:</div><input value={userForm.phone} onChange={e=>setUserForm(p=>({...p,phone:e.target.value}))} placeholder="Teléfono" style={s.inp} /></div>
          </div>
          <div style={s.lbl}>Contraseña:</div>
          <input value={userForm.password} onChange={e=>setUserForm(p=>({...p,password:e.target.value}))} placeholder="Contraseña" type="password" style={{...s.inp,marginBottom:10}} />

          {/* Step 1: Select company */}
          <div style={s.lbl}>Empresa:</div>
          <select value={userForm._selectedCompanyId||""} onChange={e=>{
            const cId=e.target.value;
            const comp=allCompanies.find(c=>c.id===cId);
            if(!cId||!comp){setUserForm(p=>({...p,_selectedCompanyId:"",userTypes:[],companyByType:{},roleByType:{}}));return;}
            const baseType=comp.type;
            const types=[baseType];
            const cbt={[baseType]:cId};
            const rbt={[baseType]:"operator"};
            if(comp.hasInternalFleet && baseType==="producer"){types.push("transporter");cbt.transporter=cId;rbt.transporter="operator";}
            setUserForm(p=>({...p,_selectedCompanyId:cId,userTypes:types,companyByType:cbt,roleByType:rbt}));
          }} style={{...s.sel,marginBottom:10}}>
            <option value="">Seleccionar empresa...</option>
            {allCompanies.map(c=><option key={c.id} value={c.id}>{c.name} ({typeLabels[c.type]})</option>)}
          </select>

          {/* Step 2: Types auto-determined + toggleable extras */}
          {userForm._selectedCompanyId && (() => {
            const comp = allCompanies.find(c=>c.id===userForm._selectedCompanyId);
            if (!comp) return null;
            const baseType = comp.type;
            // Available types: always the base type. If producer+fleet, also transporter.
            const availableTypes = [baseType];
            if (comp.hasInternalFleet && baseType === "producer") availableTypes.push("transporter");
            return (
              <div style={{background:C.bgInput,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:12,marginBottom:10}}>
                <div style={s.lbl}>Tipo de usuario:</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {availableTypes.map(t=>{const sel=formTypes.includes(t);return(
                    <button key={t} onClick={()=>{if(t===baseType)return; setUserForm(p=>{const has=p.userTypes.includes(t);const newTypes=has?p.userTypes.filter(x=>x!==t):[...p.userTypes,t];const cbt={...p.companyByType};const rbt={...p.roleByType};if(!has){cbt[t]=p._selectedCompanyId;rbt[t]="operator";}else{delete cbt[t];delete rbt[t];}return{...p,userTypes:newTypes,companyByType:cbt,roleByType:rbt};});}} style={{flex:1,padding:"9px 0",borderRadius: R.md,border:`1.5px solid ${sel?typeColors[t]:C.b1}`,background:sel?`${typeColors[t]}12`:C.w,color:sel?typeColors[t]:C.t2,fontSize:13.2,fontWeight:600,cursor:t===baseType?"default":"pointer",fontFamily:"inherit",transition:"all 0.15s",opacity:t===baseType?1:undefined}}>{sel?"✓ ":""}{typeLabels[t]}</button>
                  );})}
                </div>
                {/* Role per type */}
                {formTypes.map(t=>(
                  <div key={t} style={{marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <div style={{width:8,height:8,borderRadius: R.xs,background:typeColors[t]}}/>
                      <span style={{fontSize:12.1,fontWeight:700,color:typeColors[t]}}>Rol como {typeLabels[t]}:</span>
                    </div>
                    <select value={(userForm.roleByType||{})[t]||"operator"} onChange={e=>setUserForm(p=>({...p,roleByType:{...(p.roleByType||{}),[t]:e.target.value}}))} style={s.sel}>
                      <option value="operator">Operario</option>
                      <option value="admin">Gerente</option>
                      <option value="chofer">Chofer</option>
                      {isPlatform&&<option value="platform_admin">Admin Principal</option>}
                    </select>
                  </div>
                ))}
              </div>
            );
          })()}
          <button onClick={handleCreateUser} disabled={saving} style={s.btnP(C.acc,saving)}>{saving?"Creando...":"Crear usuario"}</button>
        </div>
        <MsgBar/>
      </div>
    );
  }

  // ===================== COMPANY DETAIL =====================
  if (view==="companyDetail" && selectedCompany) {
    const cType = selectedCompany.type;
    const isProducer = cType==="producer";
    const isTransporter = cType==="transporter";
    const tabs = [{k:"branches",l:"Sucursales",n:branches.length}];
    if(isProducer) tabs.push({k:"fields",l:"Campos",n:fields.length});
    if(isTransporter) tabs.push({k:"trucks",l:"Flota",n:trucks.length});
    tabs.push({k:"access",l:"Accesos"});
    const curTab = tabs.find(t=>t.k===detailTab) ? detailTab : "branches";

    return (
      <div style={{flex:1,overflow:"auto",padding:18}}>
        {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
        {adminBackBtn(()=>{setView("list");setShowBranchForm(false);setShowFieldForm(false);setShowTruckForm(false);})}
        {/* Company header */}
        <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.lg,padding:16,marginBottom:12,boxShadow:C.sh}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:17.6,fontWeight:700,color:C.t1}}>{selectedCompany.name}</div>
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <Bd color={typeColors[cType]}>{typeLabels[cType]}</Bd>
                {selectedCompany.rut&&<Bd color={C.t2}>RUT: {selectedCompany.rut}</Bd>}
                {selectedCompany.hasInternalFleet&&<Bd color={C.info||"#3B82F6"}>Flota propia</Bd>}
              </div>
              {selectedCompany.email&&<div style={{fontSize:13.2,color:C.t2,marginTop:4}}>{selectedCompany.email}</div>}
              {selectedCompany.phone&&<div style={{fontSize:13.2,color:C.t3}}>{selectedCompany.phone}</div>}
              {selectedCompany.lat&&<div style={{fontSize:11,color:C.t3,marginTop:2}}>📍 {Number(selectedCompany.lat).toFixed(5)}, {Number(selectedCompany.lng).toFixed(5)}</div>}
            </div>
            <button onClick={()=>openEditCompany(selectedCompany)} style={{padding:"6px 12px",borderRadius: R.sm,border:`1px solid ${C.pri}40`,background:`${C.pri}08`,color:C.pri,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:10}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setDetailTab(t.k)} style={{flex:1,padding:"8px 0",borderRadius: R.md,border:`1.5px solid ${curTab===t.k?C.pri:C.b1}`,background:curTab===t.k?`${C.pri}12`:C.w,color:curTab===t.k?C.pri:C.t2,fontSize:13.2,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l} ({t.n})</button>
          ))}
        </div>

        {/* ====== TAB: BRANCHES ====== */}
        {curTab==="branches"&&(<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button onClick={()=>{showBranchForm?setShowBranchForm(false):openNewBranch();}} style={{padding:"6px 12px",borderRadius: R.sm,border:`1px solid ${C.pri}`,background:`${C.pri}12`,color:C.pri,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showBranchForm&&!editBranchId?"Cancelar":"+ Nueva"}</button>
          </div>
          {showBranchForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <div style={{fontSize:13.2,fontWeight:600,color:C.t1,marginBottom:8}}>{editBranchId?"Editar sucursal":"Nueva sucursal"}</div>
              <div style={s.lbl}>Nombre:</div>
              <input value={branchForm.name} onChange={e=>setBranchForm(p=>({...p,name:e.target.value}))} placeholder="Nombre" style={{...s.inp,marginBottom:10}} />
              <div style={s.lbl}>Dirección:</div>
              <input value={branchForm.address} onChange={e=>setBranchForm(p=>({...p,address:e.target.value}))} placeholder="Dirección" style={{...s.inp,marginBottom:10}} />
              <div style={s.lbl}>Referencia:</div>
              <input value={branchForm.reference} onChange={e=>setBranchForm(p=>({...p,reference:e.target.value}))} placeholder="Referencia (opcional)" style={{...s.inp,marginBottom:10}} />
              <LocationPicker label="Ubicación sucursal" value={branchForm.lat?{lat:branchForm.lat,lng:branchForm.lng,address:branchForm.locationAddress||""}:null} onChange={(loc)=>setBranchForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,locationAddress:loc?.address||""}))} />
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={()=>setShowBranchForm(false)} style={{flex:1,padding:"10px 0",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:14.3,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={handleSaveBranch} disabled={saving} style={{...s.btnP(C.pri,saving),flex:2}}>{saving?"Guardando...":(editBranchId?"Guardar":"Crear")}</button>
              </div>
            </div>
          )}
          {branches.map(b=>(<div key={b.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:"12px 14px",marginBottom:8,boxShadow:C.sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}><div style={{fontSize:14.3,fontWeight:600,color:C.t1}}>{b.name}</div>{b.address&&<div style={{fontSize:12.1,color:C.t3}}>{b.address}</div>}{b.lat&&<div style={{fontSize:9.9,color:C.t3}}>📍 {Number(b.lat).toFixed(5)}, {Number(b.lng).toFixed(5)}</div>}</div>
              <div style={{display:"flex",gap:4}}><button onClick={()=>openEditBranch(b)} style={{padding:"4px 8px",borderRadius: R.sm,border:`1px solid ${C.pri}40`,background:"none",fontSize:11,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button><button disabled={saving} onClick={()=>handleDeleteBranch(b.id)} style={{padding:"4px 8px",borderRadius: R.sm,border:`1px solid ${C.err}30`,background:"none",fontSize:11,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button></div>
            </div>
          </div>))}
          {branches.length===0&&!showBranchForm&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:13.2}}>Sin sucursales</div>}
        </>)}

        {/* ====== TAB: FIELDS (Producer) ====== */}
        {curTab==="fields"&&isProducer&&(<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button onClick={()=>{showFieldForm?setShowFieldForm(false):openNewField();}} style={{padding:"6px 12px",borderRadius: R.sm,border:`1px solid ${typeColors.producer}`,background:`${typeColors.producer}12`,color:typeColors.producer,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showFieldForm&&!editFieldId?"Cancelar":"+ Nuevo campo"}</button>
          </div>
          {showFieldForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <div style={{fontSize:13.2,fontWeight:600,color:C.t1,marginBottom:8}}>{editFieldId?"Editar campo":"Nuevo campo"}</div>
              <div style={s.lbl}>Nombre *</div>
              <input value={fieldForm.name} onChange={e=>setFieldForm(p=>({...p,name:e.target.value}))} placeholder="Nombre del campo" style={{...s.inp,marginBottom:10}} />
              <LocationPicker label="Ubicación *" value={fieldForm.lat?{lat:fieldForm.lat,lng:fieldForm.lng,address:fieldForm.address}:null} onChange={(loc)=>setFieldForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,address:loc?.address||""}))} />
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><NumericStepper label="Hectáreas" value={fieldForm.hectares} onChange={v=>setFieldForm(p=>({...p,hectares:v}))} min={0} step={1} placeholder="Ej: 150" /></div>
              </div>
              <div style={s.lbl}>Comentarios</div>
              <textarea value={fieldForm.comments} onChange={e=>setFieldForm(p=>({...p,comments:e.target.value}))} placeholder="Notas opcionales..." rows={2} style={{...s.inp,resize:"vertical",marginBottom:10}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowFieldForm(false)} style={{flex:1,padding:"10px 0",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:14.3,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={handleSaveField} disabled={saving} style={{...s.btnP(typeColors.producer,saving),flex:2}}>{saving?"Guardando...":(editFieldId?"Guardar":"Crear campo")}</button>
              </div>
            </div>
          )}
          {fields.map(f=>(<div key={f.id} style={{background:C.w,border:`1px solid ${expandedFieldId===f.id?typeColors.producer:C.b1}`,borderRadius: R.md,marginBottom:8,boxShadow:C.sh,overflow:"hidden"}}>
            <div style={{padding:"12px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>expandField(f.id)}>
              <div style={{flex:1}}>
                <div style={{fontSize:14.3,fontWeight:600,color:C.t1}}>{f.name}</div>
                <div style={{display:"flex",gap:8,fontSize:11,color:C.t3,marginTop:2}}>
                  {f.hectares&&<span>{Number(f.hectares)} ha</span>}
                  {f.lat&&<span>📍 {Number(f.lat).toFixed(3)}, {Number(f.lng).toFixed(3)}</span>}
                  <span>{f._count?.lots||f.lots?.length||0} lotes</span>
                </div>
                {f.comments&&<div style={{fontSize:11,color:C.t3,fontStyle:"italic",marginTop:1}}>{f.comments}</div>}
              </div>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <button onClick={(e)=>{e.stopPropagation();openEditField(f);}} style={{padding:"4px 8px",borderRadius: R.sm,border:`1px solid ${C.pri}40`,background:"none",fontSize:11,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                <button disabled={saving} onClick={(e)=>{e.stopPropagation();handleDeleteField(f.id);}} style={{padding:"4px 8px",borderRadius: R.sm,border:`1px solid ${C.err}30`,background:"none",fontSize:11,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button>
                <span style={{fontSize:13.2,color:C.t3,marginLeft:4}}>{expandedFieldId===f.id?"▾":"▸"}</span>
              </div>
            </div>
            {/* Lots inside field */}
            {expandedFieldId===f.id&&(
              <div style={{padding:"0 14px 12px",borderTop:`1px solid ${C.b1}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,marginBottom:6}}>
                  <div style={{fontSize:12.1,fontWeight:600,color:C.t2}}>Lotes</div>
                  <button onClick={()=>{showLotForm?setShowLotForm(false):openNewLot();}} style={{padding:"4px 10px",borderRadius: R.sm,border:`1px solid ${typeColors.producer}`,background:`${typeColors.producer}10`,color:typeColors.producer,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showLotForm&&!editLotId?"Cancelar":"+ Lote"}</button>
                </div>
                {showLotForm&&(
                  <div style={{background:C.bgInput,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:12,marginBottom:8}}>
                    <div style={s.lbl}>Nombre *</div>
                    <input value={lotForm.name} onChange={e=>setLotForm(p=>({...p,name:e.target.value}))} placeholder="Nombre del lote" style={{...s.inp,marginBottom:8}} />
                    <LocationPicker label="Ubicación *" value={lotForm.lat?{lat:lotForm.lat,lng:lotForm.lng,address:lotForm.address}:null} onChange={(loc)=>setLotForm(p=>({...p,lat:loc?.lat||null,lng:loc?.lng||null,address:loc?.address||""}))} defaultCenter={f.lat&&f.lng?{lat:f.lat,lng:f.lng}:null} />
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <div style={{flex:1}}><NumericStepper label="Hectáreas" value={lotForm.hectares} onChange={v=>setLotForm(p=>({...p,hectares:v}))} min={0} step={1} placeholder="Ej: 50" /></div>
                    </div>
                    <div style={s.lbl}>Comentarios</div>
                    <textarea value={lotForm.comments} onChange={e=>setLotForm(p=>({...p,comments:e.target.value}))} placeholder="Notas..." rows={2} style={{...s.inp,resize:"vertical",marginBottom:8}} />
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>setShowLotForm(false)} style={{flex:1,padding:"8px 0",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:13.2,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                      <button onClick={handleSaveLot} disabled={saving} style={{...s.btnP(typeColors.producer,saving),flex:2,padding:"8px 0"}}>{saving?"Guardando...":(editLotId?"Guardar":"Crear lote")}</button>
                    </div>
                  </div>
                )}
                {lots.map(l=>(<div key={l.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:"8px 12px",marginBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:13.2,fontWeight:600,color:C.t1}}>{l.name}</div>
                      <div style={{display:"flex",gap:6,fontSize:9.9,color:C.t3}}>{l.hectares&&<span>{Number(l.hectares)} ha</span>}{l.lat&&<span>📍 {Number(l.lat).toFixed(3)},{Number(l.lng).toFixed(3)}</span>}</div>
                      {l.comments&&<div style={{fontSize:9.9,color:C.t3,fontStyle:"italic"}}>{l.comments}</div>}
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>openEditLot(l)} style={{padding:"3px 6px",borderRadius: R.xs,border:`1px solid ${C.pri}40`,background:"none",fontSize:9.9,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                      <button disabled={saving} onClick={()=>handleDeleteLot(l.id)} style={{padding:"3px 6px",borderRadius: R.xs,border:`1px solid ${C.err}30`,background:"none",fontSize:9.9,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button>
                    </div>
                  </div>
                </div>))}
                {lots.length===0&&!showLotForm&&<div style={{textAlign:"center",padding:10,color:C.t3,fontSize:12.1}}>Sin lotes</div>}
              </div>
            )}
          </div>))}
          {fields.length===0&&!showFieldForm&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:13.2}}>Sin campos</div>}
        </>)}

        {/* ====== TAB: TRUCKS (Transporter) ====== */}
        {curTab==="trucks"&&isTransporter&&(<>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
            <button onClick={()=>{showTruckForm?setShowTruckForm(false):openNewTruck();}} style={{padding:"6px 12px",borderRadius: R.sm,border:`1px solid ${typeColors.transporter}`,background:`${typeColors.transporter}12`,color:typeColors.transporter,fontSize:12.1,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{showTruckForm&&!editTruckId?"Cancelar":"+ Nuevo vehículo"}</button>
          </div>
          {showTruckForm && (
            <div style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:14,marginBottom:10,boxShadow:C.sh}}>
              <div style={{fontSize:13.2,fontWeight:600,color:C.t1,marginBottom:8}}>{editTruckId?"Editar vehículo":"Nuevo vehículo"}</div>
              <div style={s.lbl}>Patente *</div>
              <input value={truckForm.plate} onChange={e=>setTruckForm(p=>({...p,plate:e.target.value}))} placeholder="ABC-1234" style={{...s.inp,marginBottom:10,textTransform:"uppercase"}} />
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><div style={s.lbl}>Marca</div><input value={truckForm.brand} onChange={e=>setTruckForm(p=>({...p,brand:e.target.value}))} placeholder="Ej: Scania" style={s.inp} /></div>
                <div style={{flex:1}}><div style={s.lbl}>Modelo</div><input value={truckForm.model} onChange={e=>setTruckForm(p=>({...p,model:e.target.value}))} placeholder="Ej: R500" style={s.inp} /></div>
              </div>
              <div style={s.lbl}>Capacidad</div>
              <input value={truckForm.capacity} onChange={e=>setTruckForm(p=>({...p,capacity:e.target.value}))} placeholder="Ej: 30 ton" style={{...s.inp,marginBottom:10}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowTruckForm(false)} style={{flex:1,padding:"10px 0",borderRadius: R.md,border:`1px solid ${C.b1}`,background:C.w,color:C.t2,fontSize:14.3,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={handleSaveTruck} disabled={saving} style={{...s.btnP(typeColors.transporter,saving),flex:2}}>{saving?"Guardando...":(editTruckId?"Guardar":"Crear vehículo")}</button>
              </div>
            </div>
          )}
          {trucks.map(t=>(<div key={t.id} style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:"12px 14px",marginBottom:8,boxShadow:C.sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:15.4,fontWeight:700,color:C.t1,letterSpacing:1}}>{t.plate}</div>
                <div style={{display:"flex",gap:8,fontSize:12.1,color:C.t3,marginTop:2}}>
                  {t.brand&&<span>{t.brand}</span>}{t.model&&<span>{t.model}</span>}{t.capacity&&<span>· {t.capacity}</span>}
                </div>
                {t.assignedUser&&<div style={{fontSize:11,color:C.t2,marginTop:1}}>Chofer: {t.assignedUser.name}</div>}
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>openEditTruck(t)} style={{padding:"4px 8px",borderRadius: R.sm,border:`1px solid ${C.pri}40`,background:"none",fontSize:11,color:C.pri,cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
                <button disabled={saving} onClick={()=>handleDeleteTruck(t.id)} style={{padding:"4px 8px",borderRadius: R.sm,border:`1px solid ${C.err}30`,background:"none",fontSize:11,color:saving?C.t3:C.err,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.5:1}}>Eliminar</button>
              </div>
            </div>
          </div>))}
          {trucks.length===0&&!showTruckForm&&<div style={{textAlign:"center",padding:20,color:C.t3,fontSize:13.2}}>Sin vehículos</div>}
        </>)}

        {/* ====== TAB: ACCESS ====== */}
        {curTab==="access"&&<AccessScreen user={user} embedded defaultCompanyId={selectedCompany.id} defaultCompanyType={selectedCompany.type}/>}

        <MsgBar/>
      </div>
    );
  }

  // ===================== MAIN LIST =====================
  return (
    <div style={{flex:1,overflow:"auto"}}>
      {(saving||doneMsg) && <LoadingOverlay closing={!!doneMsg} closingText={doneMsg} onClose={()=>setDoneMsg("")}/>}
      <div style={{position:"sticky",top:0,zIndex:10,background:C.bg,padding:"18px 18px 8px"}}>{adminBackBtn(onBack)}</div>
      <div style={{padding:"0 18px 18px"}}>
      <div style={{fontSize:19.8,fontWeight:800,color:C.t1,marginBottom:4}}>Administración</div>
      <div style={{fontSize:12.1,color:C.t3,marginBottom:14}}>{isPlatform?"Admin Principal — Control total":isManager?"Gerente — Tu empresa":""}</div>

      {stats&&isPlatform&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          {[{k:"companies",l:"Empresas",v:stats.companies,c:C.pri},{k:"branches",l:"Sucursales",v:stats.branches,c:C.info||"#3B82F6"},{k:"users",l:"Usuarios",v:stats.users,c:C.acc}].map(st=>(
            <button key={st.k} onClick={()=>handleStatsClick(st.k)} style={{background:C.w,border:`2px solid ${statsFilter===st.k?st.c:C.b1}`,borderRadius: R.md,padding:"10px 8px",textAlign:"center",boxShadow:statsFilter===st.k?`0 0 0 1px ${st.c}20`:C.sh,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
              <div style={{fontSize:22,fontWeight:800,color:st.c}}>{st.v}</div>
              <div style={{fontSize:9.9,color:C.t3}}>{st.l}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[...(isHub ? ["vinculadas"] : []), "companies","users","activity"].map(t=>(
          <button key={t} onClick={()=>{setTab(t);setSearch("");setStatsFilter(null);}} style={{flex:1,padding:"9px 0",borderRadius: R.md,border:`1px solid ${tab===t?C.pri:C.b1}`,background:tab===t?`${C.pri}12`:C.w,color:tab===t?C.pri:C.t2,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",minWidth:t==="vinculadas"?90:undefined}}>
            {t==="vinculadas"?"Vinculadas":t==="companies"?"Empresas":t==="users"?"Usuarios":"Actividad"}
          </button>
        ))}
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="companies"?"Buscar empresa o RUT...":"Buscar usuario..."} style={{...s.inp,marginBottom:10,paddingLeft:12}} />
      <MsgBar/>

      {loading?<Loader/>:(<>
        {tab==="companies"&&(<>
          {isPlatform&&<div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={openNewCompany} style={{flex:1,padding:"10px 14px",borderRadius: R.md,border:`1px dashed ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:14.3,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Nueva Empresa</button>
            <button onClick={()=>setImportMode("companies")} style={{padding:"10px 14px",borderRadius: R.md,border:`1px solid ${C.pri}`,background:`${C.pri}08`,color:C.pri,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Importar Excel</button>
          </div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {companies.map(c=>(
              <div key={c.id} className="tv-card" style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:"12px 14px",boxShadow:C.sh}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>openCompanyDetail(c)}>
                    <div style={{fontSize:15.4,fontWeight:700,color:C.t1}}>{c.name}</div>
                    <div style={{fontSize:12.1,color:C.t3,marginTop:2}}>{c.email||""} {c.rut?`· RUT: ${c.rut}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    <Bd color={typeColors[c.type]}>{typeLabels[c.type]}</Bd>
                    <div style={{fontSize:11,color:C.t3,background:C.bgInput,padding:"2px 6px",borderRadius: R.xs}}>{c._count?.users||0} usr · {c._count?.branches||0} suc</div>
                    <button onClick={()=>openEditCompany(c)} title="Editar" style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}>{Ic.doc(C.pri,14)}</button>
                    <button onClick={()=>openCompanyDetail(c)} title="Ver" style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}>{Ic.chev(C.t3,14)}</button>
                  </div>
                </div>
              </div>
            ))}
            {companies.length===0&&<div style={{textAlign:"center",padding:32,color:C.t3,fontSize:14.3}}>No se encontraron empresas</div>}
          </div>
        </>)}

        {tab==="vinculadas"&&<LinkedCompaniesScreen user={user} embedded/>}

        {tab==="activity"&&(
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {activityLoading && <Loader/>}
            {!activityLoading && activity.length===0 && <div style={{textAlign:"center",padding:32,color:C.t3,fontSize:14.3}}>Sin actividad reciente</div>}
            {activity.map(e=>{
              const ago = ((Date.now()-new Date(e.createdAt).getTime())/60000);
              const agoStr = ago<60?`${Math.round(ago)}m`:ago<1440?`${Math.round(ago/60)}h`:`${Math.round(ago/1440)}d`;
              const actionLabels = {created:"Creó flete",assigned:"Asignó transportista",accepted:"Aceptó flete",rejected:"Rechazó flete",started:"Inició viaje",confirm_loaded:"Confirmó carga",canceled:"Canceló flete",authorized:"Autorizó flota propia",updated:"Actualizó flete",change_approved:"Aprobó cambio",change_rejected:"Rechazó cambio",assigned_multi:"Asignó multi-camión",assignment_canceled:"Canceló asignación",assignment_updated:"Actualizó asignación",trip_rejected:"Rechazó viaje",trip_accepted:"Aceptó viaje",trip_started:"Inició viaje",trip_confirm_loaded:"Confirmó carga de viaje",document_added:"Agregó documento",document_deleted:"Eliminó documento",ocr_data_saved:"Guardó datos OCR",switch_company:"Cambió empresa"};
              return (
                <div key={e.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.b2}`}}>
                  <Av name={e.userName} size={32}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.t1}}>{e.userName}</span>
                      <span style={{fontSize:11,color:C.t3}}>hace {agoStr}</span>
                    </div>
                    <div style={{fontSize:12.5,color:C.t2,marginTop:1}}>
                      {actionLabels[e.action]||e.action}
                      {e.freightCode && <span style={{fontFamily:MONO,fontWeight:600,color:C.pri,marginLeft:4}}>{e.freightCode}</span>}
                    </div>
                    {e.reason && <div style={{fontSize:11.5,color:C.t3,marginTop:2}}>Motivo: {e.reason}</div>}
                  </div>
                </div>
              );
            })}
            {activityTotal > activity.length && !activityLoading && (
              <button onClick={()=>setActivityPage(p=>p+1)} style={{padding:"10px 0",background:"none",border:`1px solid ${C.b1}`,borderRadius: R.md,color:C.pri,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>Cargar más</button>
            )}
          </div>
        )}

        {tab==="users"&&(<>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={openNewUser} style={{flex:1,padding:"10px 14px",borderRadius: R.md,border:`1px dashed ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:14.3,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Nuevo Usuario</button>
            <button onClick={()=>setImportMode("users")} style={{padding:"10px 14px",borderRadius: R.md,border:`1px solid ${C.acc}`,background:`${C.acc}08`,color:C.acc,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Importar Excel</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {users.map(u=>{
              const cbt = u.companyByType && typeof u.companyByType === "object" ? u.companyByType : {};
              const memberships = u.memberships || [];
              const assignedCompanies = Object.entries(cbt).filter(([_,v])=>v);
              return (
              <div key={u.id} className="tv-card" style={{background:C.w,border:`1px solid ${C.b1}`,borderRadius: R.md,padding:"12px 14px",boxShadow:C.sh,cursor:"pointer"}} onClick={()=>openEditUser(u)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15.4,fontWeight:700,color:C.t1}}>{u.name}</div>
                    <div style={{fontSize:12.7,color:C.t2,marginTop:1}}>{u.email}</div>
                    {u.phone&&<div style={{fontSize:12.1,color:C.t3}}>{u.phone}</div>}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <Bd color={u.active?C.ok:C.err}>{u.active?"Activo":"Inactivo"}</Bd>
                  </div>
                </div>
                {/* Types with inline role */}
                <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                  {(u.userTypes||[]).map(t=>{
                    const mem = memberships.find(m=>m.companyId===cbt[t]);
                    const memberRole = mem?.role;
                    const displayRole = memberRole === "gerente" ? "admin" : memberRole === "chofer" ? "chofer" : memberRole === "operario" ? "operator" : u.role || "operator";
                    return <Bd key={t} color={typeColors[t]}>{typeLabels[t]} · {roleLabels[displayRole]||displayRole}</Bd>;
                  })}
                  {(u.userTypes||[]).length===0&&<span style={{fontSize:11,color:C.t3}}>Sin tipo</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6,paddingTop:6,borderTop:`1px solid ${C.b2}`,flexWrap:"wrap"}}>
                  {assignedCompanies.length>0 ? assignedCompanies.map(([type,cId])=>{const comp=allCompanies.find(c=>c.id===cId); return comp?<Bd key={type} color={typeColors[type]}>{comp.name}</Bd>:null;}) : u.company ? <Bd color={typeColors[u.company.type]}>{u.company.name}</Bd> : <span style={{fontSize:12.1,color:C.t3}}>Sin empresa</span>}
                  <span style={{marginLeft:"auto",display:"flex"}}>{Ic.chev(C.t3,14)}</span>
                </div>
              </div>
            );})}
            {users.length===0&&<div style={{textAlign:"center",padding:32,color:C.t3,fontSize:14.3}}>No se encontraron usuarios</div>}
          </div>
        </>)}
      </>)}
      </div>
      {importMode && (
        <ImportExcelModal
          mode={importMode}
          existingCompanies={allCompanies}
          existingUsers={allUsers}
          onClose={() => { setImportMode(null); load(); }}
          onImport={(data) => importMode === "companies" ? apiAdminImportCompanies(data) : apiAdminImportUsers(data)}
        />
      )}
    </div>
  );
}
