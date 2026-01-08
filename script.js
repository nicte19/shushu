/* ===== Helpers ===== */
const $ = (id)=>document.getElementById(id);
const escapeHTML = (s)=>String(s ?? "").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
const numOrNull = (v)=>{ const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }

/* ===== Storage ===== */
const STORE_KEY = "prot_rural_v4";
function defaultState(){
  return {
    activeProducerId: null,
    producers: [],
    insumos: {
      medicamentos: [
        {id: uid(), nombre:"Selenio", dosis:0.25, conc:10.95, vol:50, precio:350}
      ],
      consumibles: [
        {id: uid(), nombre:"Jeringa 5 mL", unidad:"pieza", precio:2.50},
        {id: uid(), nombre:"Aguja", unidad:"pieza", precio:1.50}
      ]
    }
  };
}
let state = loadState();
let activeProducerId = state.activeProducerId || null;

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  }catch(e){
    return defaultState();
  }
}
function saveState(){
  state.activeProducerId = activeProducerId;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function getActiveProducer(){
  return state.producers.find(p=>p.id===activeProducerId) || null;
}
function isOvinoName(especie){
  const s = (especie||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return s.includes("borrego") || s.includes("ovino") || s.includes("oveja") || s.includes("cordero");
}

/* ===== Tabs ===== */
document.querySelectorAll(".tabbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tabbtn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    showTab(btn.dataset.tab);
  });
});
function showTab(name){
  ["productores","procedimiento","insumos","reportes"].forEach(t=>{
    $("tab_"+t).classList.toggle("hidden", t!==name);
  });
  refreshAll();
}

/* ===== Producer form + family ===== */
let tempFamily = [];
function renderTempFamily(){
  $("fam_table").innerHTML = tempFamily.map((r,i)=>`
    <tr>
      <td>${escapeHTML(r.miembro)}</td>
      <td>${escapeHTML(r.actividad)}</td>
      <td style="text-align:right;"><button class="small danger" type="button" data-i="${i}">X</button></td>
    </tr>
  `).join("");
  $("fam_table").querySelectorAll("button[data-i]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const i = parseInt(b.dataset.i,10);
      tempFamily.splice(i,1);
      renderTempFamily();
    });
  });
}
$("btnAddFamily").addEventListener("click", ()=>{
  const m = $("fam_miembro").value.trim();
  const a = $("fam_actividad").value.trim();
  if(!m || !a){ alert("Pon miembro y actividad."); return; }
  tempFamily.push({miembro:m, actividad:a});
  $("fam_miembro").value=""; $("fam_actividad").value="";
  renderTempFamily();
});

$("p_foto").addEventListener("change", ()=>{
  const file = $("p_foto").files?.[0];
  if(!file){ $("p_foto").dataset.dataurl=""; previewPhoto(null); return; }
  const r = new FileReader();
  r.onload = ()=>{ $("p_foto").dataset.dataurl = r.result; previewPhoto(r.result); };
  r.readAsDataURL(file);
});
function previewPhoto(dataUrl){
  const img = $("p_fotoPreview");
  if(!dataUrl){ img.classList.add("hidden"); img.src=""; }
  else{ img.classList.remove("hidden"); img.src=dataUrl; }
}

$("btnGPS").addEventListener("click", ()=>{
  if(!navigator.geolocation){ alert("Este navegador no soporta GPS."); return; }
  navigator.geolocation.getCurrentPosition(
    (pos)=>{
      $("p_lat").value = pos.coords.latitude.toFixed(6);
      $("p_lng").value = pos.coords.longitude.toFixed(6);
    },
    (err)=> alert("No se pudo obtener ubicación: " + err.message),
    { enableHighAccuracy:true, timeout:10000 }
  );
});

$("btnClearProducer").addEventListener("click", clearProducerForm);
function clearProducerForm(){
  $("p_nombre").value=""; $("p_edad").value=""; $("p_escolaridad").value=""; $("p_personasCasa").value="";
  $("p_localizacion").value=""; $("p_lat").value=""; $("p_lng").value="";
  $("p_foto").value=""; $("p_foto").dataset.dataurl="";
  previewPhoto(null);
  tempFamily = [];
  renderTempFamily();
}
$("btnSaveProducer").addEventListener("click", ()=>{
  const nombre = $("p_nombre").value.trim();
  if(!nombre){ alert("Falta el nombre del productor/a."); return; }

  const prod = {
    id: uid(),
    nombre,
    edad: numOrNull($("p_edad").value),
    escolaridad: $("p_escolaridad").value.trim(),
    personasCasa: numOrNull($("p_personasCasa").value),
    localizacion: $("p_localizacion").value.trim(),
    lat: numOrNull($("p_lat").value),
    lng: numOrNull($("p_lng").value),
    fotoDataUrl: $("p_foto").dataset.dataurl || null,
    familia: [...tempFamily],
    animals: [],
    procedures: []
  };

  state.producers.push(prod);
  activeProducerId = prod.id;
  saveState();
  clearProducerForm();
  refreshAll();
  alert("Productor/a guardado ✅");
});

/* ===== Producer list + animals inside ===== */
function fmtCoords(lat,lng){
  if(lat==null || lng==null) return "";
  return ` • <span class="sub">(${lat.toFixed(6)}, ${lng.toFixed(6)})</span>`;
}
function selectProducer(id){
  activeProducerId = id;
  saveState();
  refreshAll();
}
function deleteProducer(id){
  const p = state.producers.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`¿Borrar a ${p.nombre} y TODO (animales, procedimientos)?`)) return;
  state.producers = state.producers.filter(x=>x.id!==id);
  activeProducerId = state.producers[0]?.id || null;
  saveState();
  refreshAll();
}
function renderProducerList(){
  const box = $("producerList");
  if(state.producers.length===0){
    box.innerHTML = `<div class="warn">No hay productores aún. Crea uno en el formulario.</div>`;
    return;
  }
  box.innerHTML = state.producers.map(p=>{
    const active = (p.id===activeProducerId);
    return `
      <div class="box">
        <div class="row" style="align-items:center;">
          <div>
            <div><b>${escapeHTML(p.nombre)}</b> ${active?'<span class="badge">Activo</span>':''}</div>
            <div class="sub">${escapeHTML(p.localizacion || "Sin localización")}${fmtCoords(p.lat,p.lng)}</div>
            <div class="sub"><b>Familia:</b> ${p.familia.length} | <b>Animales:</b> ${p.animals.length} | <b>Procedimientos:</b> ${p.procedures.length}</div>
          </div>
          <div style="text-align:right;">
            <button class="small ${active?'':'secondary'}" type="button" data-use="${p.id}">Usar</button>
            <button class="small danger" type="button" data-del="${p.id}">Borrar</button>
          </div>
        </div>
        ${p.fotoDataUrl ? `<img class="photo" src="${p.fotoDataUrl}" alt="Fachada">` : ``}
      </div>
    `;
  }).join("");

  box.querySelectorAll("button[data-use]").forEach(b=> b.addEventListener("click", ()=> selectProducer(b.dataset.use)));
  box.querySelectorAll("button[data-del]").forEach(b=> b.addEventListener("click", ()=> deleteProducer(b.dataset.del)));
}

/* ===== Animal inline form: decisions + feeding rows ===== */
let tempDecisions = [];
let tempFeeding = [];
function getPersonOptions(prod){
  const people = [];
  people.push({value:`Productor/a: ${prod.nombre}`, label:`Productor/a: ${prod.nombre}`});
  prod.familia.forEach(f=> people.push({value:`Familiar: ${f.miembro}`, label:`Familiar: ${f.miembro}`}));
  people.push({value:"Otro", label:"Otro"});
  return people;
}
function fillPeopleSelect(selectEl, prod){
  const opts = getPersonOptions(prod);
  selectEl.innerHTML = opts.map(o=>`<option value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</option>`).join("");
}
function renderDecisionTable(){
  $("dec_table").innerHTML = tempDecisions.map((d,i)=>`
    <tr>
      <td>${escapeHTML(d.accion)}</td>
      <td>${escapeHTML(d.quien)}</td>
      <td style="text-align:right;"><button class="small danger" type="button" data-i="${i}">X</button></td>
    </tr>
  `).join("");
  $("dec_table").querySelectorAll("button[data-i]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const i = parseInt(b.dataset.i,10);
      tempDecisions.splice(i,1);
      renderDecisionTable();
    });
  });
}
function renderFeedingTable(){
  $("ali_table").innerHTML = tempFeeding.map((f,i)=>`
    <tr>
      <td>${escapeHTML(f.accion)}</td>
      <td>${escapeHTML(f.quien)}</td>
      <td>${escapeHTML(f.tipo)}</td>
      <td style="text-align:right;"><button class="small danger" type="button" data-i="${i}">X</button></td>
    </tr>
  `).join("");
  $("ali_table").querySelectorAll("button[data-i]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const i = parseInt(b.dataset.i,10);
      tempFeeding.splice(i,1);
      renderFeedingTable();
    });
  });
}
$("btnAddDecision").addEventListener("click", ()=>{
  const accion = $("dec_accion").value.trim();
  const quien = $("dec_quien").value;
  if(!accion){ alert("Pon la decisión (ej. Venta)."); return; }
  tempDecisions.push({accion, quien});
  $("dec_accion").value="";
  renderDecisionTable();
});
$("btnAddFeeding").addEventListener("click", ()=>{
  const accion = $("ali_accion").value.trim();
  const quien = $("ali_quien").value;
  const tipo = $("ali_tipo").value.trim();
  if(!accion){ alert("Pon la acción (ej. Dar alimento)."); return; }
  if(!tipo){ alert("Pon el tipo de alimentación (ej. Pastoreo)."); return; }
  tempFeeding.push({accion, quien, tipo});
  $("ali_accion").value=""; $("ali_tipo").value="";
  renderFeedingTable();
});

$("btnSaveAnimal").addEventListener("click", saveAnimal);

function refreshAnimalsInsideProducer(){
  const prod = getActiveProducer();
  if(!prod){
    $("animalsInlineBox").classList.add("hidden");
    $("noActiveProducerBox").classList.remove("hidden");
    return;
  }
  $("noActiveProducerBox").classList.add("hidden");
  $("animalsInlineBox").classList.remove("hidden");

  fillPeopleSelect($("a_propietario"), prod);
  fillPeopleSelect($("dec_quien"), prod);
  fillPeopleSelect($("ali_quien"), prod);

  renderAnimalsList();
}
function saveAnimal(){
  const prod = getActiveProducer();
  if(!prod){ alert("Selecciona productor."); return; }

  const especie = $("a_especie").value.trim();
  const cantidad = parseInt($("a_cantidad").value,10);
  let raza = $("a_raza").value.trim();
  const funcion = $("a_funcion").value.trim();
  const propietario = $("a_propietario").value;
  const notas = $("a_notas").value.trim();

  if(!especie){ alert("Falta especie."); return; }
  if(!Number.isFinite(cantidad) || cantidad<=0){ alert("Cantidad inválida."); return; }
  if(!raza) raza = "Criolla";

  prod.animals.push({
    id: uid(),
    especie, cantidad, raza, funcion,
    propietario,
    decisiones: [...tempDecisions],
    alimentacionAcciones: [...tempFeeding],
    notas
  });

  saveState();
  $("a_especie").value=""; $("a_cantidad").value=""; $("a_raza").value=""; $("a_funcion").value="";
  $("a_notas").value="";
  tempDecisions = []; tempFeeding = [];
  renderDecisionTable(); renderFeedingTable();
  refreshAll();
  alert("Animal guardado ✅");
}
function deleteAnimal(animalId){
  const prod = getActiveProducer();
  if(!prod) return;
  const a = prod.animals.find(x=>x.id===animalId);
  if(!a) return;
  if(!confirm(`¿Borrar ${a.especie} (${a.cantidad})?`)) return;
  prod.animals = prod.animals.filter(x=>x.id!==animalId);
  saveState();
  refreshAll();
}
function goToProcedureForAnimal(animalId){
  document.querySelector('[data-tab="procedimiento"]').click();
  setTimeout(()=>{
    $("proc_ovinoSelect").value = animalId;
    refreshProcedureTab();
  },0);
}
function renderAnimalsList(){
  const prod = getActiveProducer();
  const box = $("animalsList");
  if(!prod){ box.innerHTML=""; return; }
  if(prod.animals.length===0){
    box.innerHTML = `<div class="warn">Aún no hay animales registrados para este productor/a.</div>`;
    return;
  }

  box.innerHTML = prod.animals.map(a=>{
    const ov = isOvinoName(a.especie);

    const decisions = (a.decisiones||[]).length
      ? (a.decisiones||[]).map(d=>`• ${escapeHTML(d.accion)} — <b>${escapeHTML(d.quien)}</b>`).join("<br>")
      : "—";

    const feeding = (a.alimentacionAcciones||[]).length
      ? (a.alimentacionAcciones||[]).map(f=>`• ${escapeHTML(f.accion)} — <b>${escapeHTML(f.quien)}</b> (${escapeHTML(f.tipo)})`).join("<br>")
      : "—";

    return `
      <div class="box">
        <div class="row" style="align-items:flex-start;">
          <div>
            <div><b>${escapeHTML(a.especie)}</b> <span class="badge">${a.cantidad}</span></div>
            <div class="sub"><b>Raza:</b> ${escapeHTML(a.raza)} • <b>Función:</b> ${escapeHTML(a.funcion || "—")}</div>
            <div class="sub"><b>Propietario:</b> ${escapeHTML(a.propietario || "—")}</div>
            ${a.notas ? `<div class="sub"><b>Notas:</b> ${escapeHTML(a.notas)}</div>` : ``}
            <div class="divider"></div>
            <div class="sub"><b>Decisiones:</b><br>${decisions}</div>
            <div class="divider"></div>
            <div class="sub"><b>Alimentación:</b><br>${feeding}</div>
          </div>
          <div style="text-align:right;">
            ${
              ov
                ? `<button class="small" type="button" data-proc="${a.id}">✅ Procedimiento</button>`
                : `<button class="small secondary" type="button" disabled>⛔ Procedimiento</button>`
            }
            <div style="height:8px"></div>
            <button class="small danger" type="button" data-del="${a.id}">Borrar</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  box.querySelectorAll("button[data-del]").forEach(b=> b.addEventListener("click", ()=> deleteAnimal(b.dataset.del)));
  box.querySelectorAll("button[data-proc]").forEach(b=> b.addEventListener("click", ()=> goToProcedureForAnimal(b.dataset.proc)));
}

/* ===== Procedure (ovinos) ===== */
let peso = 0, mlAplicados = 0, costoAplicacion = 0, medicamentoActual = "";
let insumosUsados = [];
let procTotal = 0;

$("btnBascula").addEventListener("click", ()=>{ $("basculaBox").classList.remove("hidden"); $("cintaBox").classList.add("hidden"); });
$("btnCinta").addEventListener("click", ()=>{ $("cintaBox").classList.remove("hidden"); $("basculaBox").classList.add("hidden"); });
$("btnSavePesoBascula").addEventListener("click", guardarPesoBascula);
$("btnCalcCinta").addEventListener("click", calcularPesoCinta);
$("btnCalcMed").addEventListener("click", aplicarMedicamento);
$("btnAddInsumoUso").addEventListener("click", addInsumoUso);
$("btnSaveProc").addEventListener("click", guardarProcedimiento);
$("proc_ovinoSelect").addEventListener("change", ()=>{
  syncMaxTratados();
  recomputeProcTotal();
});
$("proc_numAnimales").addEventListener("input", ()=>{
  clampTratados();
  recomputeProcTotal();
});

function resetProcedureUI(){
  peso=0; mlAplicados=0; costoAplicacion=0; medicamentoActual="";
  insumosUsados=[]; procTotal=0;

  $("basculaBox").classList.add("hidden");
  $("cintaBox").classList.add("hidden");
  $("pesoBascula").value=""; $("pt").value=""; $("lc").value="";
  $("pesoMostrado").textContent="";

  $("medicamentoBox").classList.add("hidden");
  $("resultadoMed").classList.add("hidden");
  $("resultadoMed").innerHTML="";

  $("insumosUsoBox").classList.add("hidden");
  $("insumosUsoTable").innerHTML="";

  $("registroBox").classList.add("hidden");
  $("idBorrego").value=""; $("procNotas").value="";
  $("procTotal").textContent="0.00";
  $("procBreakdown").textContent="";
}

function getTratados(){
  const n = parseInt($("proc_numAnimales").value,10);
  return Number.isFinite(n) ? n : 1;
}
function getSelectedOvino(){
  const prod = getActiveProducer();
  if(!prod) return null;
  return prod.animals.find(a=>a.id===$("proc_ovinoSelect").value) || null;
}
function syncMaxTratados(){
  const ov = getSelectedOvino();
  if(!ov) return;
  $("proc_numAnimales").min = 1;
  $("proc_numAnimales").max = ov.cantidad;
  $("proc_maxInfo").textContent = `Total registrados: ${ov.cantidad}.`;
  if(getTratados() > ov.cantidad) $("proc_numAnimales").value = ov.cantidad;
  if(getTratados() < 1) $("proc_numAnimales").value = 1;
}
function clampTratados(){
  const ov = getSelectedOvino();
  if(!ov) return;
  let v = getTratados();
  if(v < 1) v = 1;
  if(v > ov.cantidad) v = ov.cantidad;
  $("proc_numAnimales").value = v;
}

function refreshProcedureTab(){
  const prod = getActiveProducer();
  $("needProducer_proc").classList.add("hidden");
  $("needOvino_proc").classList.add("hidden");
  $("procBox").classList.add("hidden");

  if(!prod){
    $("needProducer_proc").classList.remove("hidden");
    $("procHistory").innerHTML="";
    return;
  }

  const ovinos = prod.animals.filter(a=>isOvinoName(a.especie));
  if(ovinos.length===0){
    $("needOvino_proc").classList.remove("hidden");
    $("procHistory").innerHTML="";
    return;
  }

  $("proc_ovinoSelect").innerHTML = ovinos.map(a=>`<option value="${a.id}">${escapeHTML(a.especie)} (${a.cantidad}) — ${escapeHTML(a.raza)}</option>`).join("");
  cargarMedicamentosUI();
  cargarConsumiblesUI();
  resetProcedureUI();
  $("procBox").classList.remove("hidden");
  syncMaxTratados();
  renderProcHistory();
}

function guardarPesoBascula(){
  peso = parseFloat($("pesoBascula").value);
  if(!Number.isFinite(peso) || peso<=0){ alert("Peso inválido"); return; }
  $("pesoMostrado").textContent = `Peso: ${peso.toFixed(2)} kg (báscula)`;
  $("medicamentoBox").classList.remove("hidden");
}
function calcularPesoCinta(){
  const PT = parseFloat($("pt").value);
  const LC = parseFloat($("lc").value);
  if(!Number.isFinite(PT) || !Number.isFinite(LC) || PT<=0 || LC<=0){ alert("Datos inválidos"); return; }
  peso = (PT*PT*LC)/10838;
  $("pesoMostrado").textContent = `Peso estimado: ${peso.toFixed(2)} kg (cinta)`;
  $("medicamentoBox").classList.remove("hidden");
}

function cargarMedicamentosUI(){
  const sel = $("medicamentoSelect");
  sel.innerHTML = "";
  state.insumos.medicamentos.forEach(m=> sel.innerHTML += `<option value="${m.id}">${escapeHTML(m.nombre)}</option>`);
  if(state.insumos.medicamentos.length===0){
    sel.innerHTML = `<option value="">(No hay medicamentos)</option>`;
  }
}

function aplicarMedicamento(){
  const m = state.insumos.medicamentos.find(x=>x.id===$("medicamentoSelect").value);
  if(!m){ alert("No hay medicamentos."); return; }
  if(!Number.isFinite(peso) || peso<=0){ alert("Primero define el peso."); return; }

  medicamentoActual = m.nombre;
  const mg = peso * Number(m.dosis);
  mlAplicados = mg / Number(m.conc);
  costoAplicacion = mlAplicados * (Number(m.precio) / Number(m.vol));

  $("resultadoMed").classList.remove("hidden");
  $("resultadoMed").innerHTML =
    `Aplicar <b>${mlAplicados.toFixed(2)} mL</b> por animal<br>
     Costo medicamento: <b>$${costoAplicacion.toFixed(2)}</b> por animal`;

  $("insumosUsoBox").classList.remove("hidden");
  $("registroBox").classList.remove("hidden");
  recomputeProcTotal();
}

function cargarConsumiblesUI(){
  const sel = $("insumoSelect");
  sel.innerHTML = `<option value="">(Ninguno)</option>`;
  state.insumos.consumibles.forEach(c=>{
    sel.innerHTML += `<option value="${c.id}">${escapeHTML(c.nombre)} ($${Number(c.precio).toFixed(2)})</option>`;
  });
}

function addInsumoUso(){
  const cid = $("insumoSelect").value;
  if(!cid){
    alert("Selecciona un consumible (o deja 'Ninguno' si no usarás).");
    return;
  }
  const c = state.insumos.consumibles.find(x=>x.id===cid);
  if(!c){ alert("Consumible inválido."); return; }

  const cant = parseInt($("insumoCant").value,10);
  if(!Number.isFinite(cant) || cant<=0){ alert("Cantidad inválida."); return; }

  const found = insumosUsados.find(x=>x.id===cid);
  if(found){
    found.cantPorAnimal += cant;
    found.subtotalPorAnimal = found.cantPorAnimal * found.precioUnit;
  }else{
    insumosUsados.push({
      id: c.id,
      nombre: c.nombre,
      cantPorAnimal: cant,
      precioUnit: Number(c.precio),
      subtotalPorAnimal: cant * Number(c.precio)
    });
  }
  renderInsumosUso();
  recomputeProcTotal();
}

function renderInsumosUso(){
  const n = getTratados();
  const tb = $("insumosUsoTable");
  tb.innerHTML = insumosUsados.map(x=>{
    const totalCant = x.cantPorAnimal * n;
    const subtotalTotal = x.subtotalPorAnimal * n;
    return `
      <tr>
        <td>${escapeHTML(x.nombre)}</td>
        <td>${x.cantPorAnimal}</td>
        <td>$${x.subtotalPorAnimal.toFixed(2)}</td>
        <td>$${subtotalTotal.toFixed(2)} <span class="sub">(x${n} = ${totalCant} unidades)</span></td>
        <td style="text-align:right;"><button class="small danger" type="button" data-rm="${x.id}">X</button></td>
      </tr>
    `;
  }).join("");

  tb.querySelectorAll("button[data-rm]").forEach(b=>{
    b.addEventListener("click", ()=>{
      insumosUsados = insumosUsados.filter(x=>x.id!==b.dataset.rm);
      renderInsumosUso();
      recomputeProcTotal();
    });
  });
}

function recomputeProcTotal(){
  const n = getTratados();
  const insPorAnimal = insumosUsados.reduce((s,x)=>s + x.subtotalPorAnimal, 0);
  const medPorAnimal = (Number.isFinite(costoAplicacion)?costoAplicacion:0);
  const porAnimal = medPorAnimal + insPorAnimal;
  procTotal = porAnimal * n;

  $("procTotal").textContent = procTotal.toFixed(2);

  if(medicamentoActual){
    $("procBreakdown").textContent =
      `Por animal: $${porAnimal.toFixed(2)} (Med $${medPorAnimal.toFixed(2)} + Cons $${insPorAnimal.toFixed(2)})  •  Animales: ${n}  •  Total: $${procTotal.toFixed(2)}`;
  }else{
    $("procBreakdown").textContent = "";
  }

  if($("insumosUsoBox") && !$("insumosUsoBox").classList.contains("hidden")){
    renderInsumosUso();
  }
}

function guardarProcedimiento(){
  const prod = getActiveProducer();
  if(!prod){ alert("Selecciona productor."); return; }
  const ov = getSelectedOvino();
  if(!ov){ alert("Selecciona ovinos."); return; }
  clampTratados();
  const n = getTratados();

  if(!Number.isFinite(peso) || peso<=0){ alert("Falta el peso."); return; }
  if(!medicamentoActual){ alert("Calcula el medicamento primero."); return; }

  const recId = $("idBorrego").value.trim() || "Sin ID";
  const notas = $("procNotas").value.trim();

  const insPorAnimal = insumosUsados.reduce((s,x)=>s + x.subtotalPorAnimal, 0);
  const medPorAnimal = costoAplicacion;
  const totalPorAnimal = medPorAnimal + insPorAnimal;

  prod.procedures.push({
    id: uid(),
    fechaISO: new Date().toISOString(),
    ovinoAnimalId: ov.id,
    ovinoEtiqueta: `${ov.especie} (${ov.cantidad})`,
    tratados: n,

    ref: recId,
    pesoPorAnimal: peso,

    medicamento: medicamentoActual,
    mlPorAnimal: mlAplicados,
    costoMedicamentoPorAnimal: medPorAnimal,

    consumiblesPorAnimal: insumosUsados.map(x=>({
      id:x.id, nombre:x.nombre,
      cantPorAnimal:x.cantPorAnimal,
      precioUnit:x.precioUnit,
      subtotalPorAnimal:x.subtotalPorAnimal
    })),

    costoConsumiblesPorAnimal: insPorAnimal,
    totalPorAnimal: totalPorAnimal,

    total: procTotal,
    notas
  });

  saveState();
  alert("Procedimiento guardado ✅");
  refreshAll();
}

function deleteProcedure(procId){
  const prod = getActiveProducer();
  if(!prod) return;
  if(!confirm("¿Borrar este procedimiento?")) return;
  prod.procedures = prod.procedures.filter(x=>x.id!==procId);
  saveState();
  refreshAll();
}

function renderProcHistory(){
  const prod = getActiveProducer();
  const box = $("procHistory");
  if(!prod){ box.innerHTML=""; return; }
  const list = (prod.procedures||[]).slice().reverse();
  if(list.length===0){
    box.innerHTML = `<div class="warn">Aún no hay procedimientos guardados.</div>`;
    return;
  }

  box.innerHTML = list.map(p=>{
    const dt = new Date(p.fechaISO).toLocaleString();
    const ins = (p.consumiblesPorAnimal||[]).length
      ? (p.consumiblesPorAnimal||[]).map(i=>`${escapeHTML(i.nombre)} x${i.cantPorAnimal} por animal`).join("<br>")
      : "—";
    return `
      <div class="box">
        <div class="row" style="align-items:center;">
          <div>
            <div><b>${escapeHTML(p.ovinoEtiqueta)}</b> • <span class="sub">${dt}</span></div>
            <div class="sub"><b>Tratados:</b> ${p.tratados} • <b>Peso:</b> ${p.pesoPorAnimal.toFixed(2)} kg (por animal)</div>
            <div class="sub"><b>Med:</b> ${escapeHTML(p.medicamento)} • <b>mL:</b> ${p.mlPorAnimal.toFixed(2)} (por animal)</div>
            <div class="sub"><b>Consumibles:</b><br>${ins}</div>
            <div class="sub"><b>Total:</b> $${p.total.toFixed(2)} <span class="sub">( $${p.totalPorAnimal.toFixed(2)} por animal × ${p.tratados})</span></div>
            ${p.notas ? `<div class="sub"><b>Notas:</b> ${escapeHTML(p.notas)}</div>` : ``}
          </div>
          <div style="text-align:right;">
            <button class="small danger" type="button" data-delproc="${p.id}">Borrar</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  box.querySelectorAll("button[data-delproc]").forEach(b=>{
    b.addEventListener("click", ()=> deleteProcedure(b.dataset.delproc));
  });
}

/* ===== Insumos CRUD ===== */
$("btnAddMed").addEventListener("click", agregarMedicamento);
$("btnUpdateMed").addEventListener("click", guardarCambiosMed);
$("btnDelMed").addEventListener("click", borrarMedicamento);
$("medEditar").addEventListener("change", ()=> loadMedToForm($("medEditar").value));

function refreshMedEditor(){
  const sel = $("medEditar");
  sel.innerHTML = "";
  state.insumos.medicamentos.forEach(m=> sel.innerHTML += `<option value="${m.id}">${escapeHTML(m.nombre)}</option>`);
  if(state.insumos.medicamentos.length>0){
    sel.value = state.insumos.medicamentos[0].id;
    loadMedToForm(sel.value);
  }else{
    $("medNombre").value=""; $("medDosis").value=""; $("medConc").value=""; $("medVol").value=""; $("medPrecio").value="";
  }
}
function loadMedToForm(id){
  const m = state.insumos.medicamentos.find(x=>x.id===id);
  if(!m) return;
  $("medNombre").value = m.nombre;
  $("medDosis").value = m.dosis;
  $("medConc").value = m.conc;
  $("medVol").value = m.vol;
  $("medPrecio").value = m.precio;
}
function agregarMedicamento(){
  const nombre = $("medNombre").value.trim();
  const dosis = parseFloat($("medDosis").value);
  const conc = parseFloat($("medConc").value);
  const vol = parseFloat($("medVol").value);
  const precio = parseFloat($("medPrecio").value);
  if(!nombre || !isFinite(dosis) || !isFinite(conc) || !isFinite(vol) || !isFinite(precio)){
    alert("Completa bien los campos del medicamento."); return;
  }
  state.insumos.medicamentos.push({id:uid(), nombre, dosis, conc, vol, precio});
  saveState(); refreshAll(); alert("Medicamento agregado 💉");
}
function guardarCambiosMed(){
  const id = $("medEditar").value;
  const m = state.insumos.medicamentos.find(x=>x.id===id);
  if(!m){ alert("No hay medicamento seleccionado."); return; }
  const nombre = $("medNombre").value.trim();
  const dosis = parseFloat($("medDosis").value);
  const conc = parseFloat($("medConc").value);
  const vol = parseFloat($("medVol").value);
  const precio = parseFloat($("medPrecio").value);
  if(!nombre || !isFinite(dosis) || !isFinite(conc) || !isFinite(vol) || !isFinite(precio)){
    alert("Completa bien los campos del medicamento."); return;
  }
  Object.assign(m, {nombre, dosis, conc, vol, precio});
  saveState(); refreshAll(); alert("Medicamento actualizado ✨");
}
function borrarMedicamento(){
  const id = $("medEditar").value;
  const m = state.insumos.medicamentos.find(x=>x.id===id);
  if(!m) return;
  if(!confirm(`¿Borrar medicamento "${m.nombre}"?`)) return;
  state.insumos.medicamentos = state.insumos.medicamentos.filter(x=>x.id!==id);
  saveState(); refreshAll();
}

$("btnAddCons").addEventListener("click", agregarConsumible);
$("btnUpdateCons").addEventListener("click", guardarCambiosCons);
$("btnDelCons").addEventListener("click", borrarConsumible);
$("consEditar").addEventListener("change", ()=> loadConsToForm($("consEditar").value));

function refreshConsEditor(){
  const sel = $("consEditar");
  sel.innerHTML = "";
  state.insumos.consumibles.forEach(c=> sel.innerHTML += `<option value="${c.id}">${escapeHTML(c.nombre)}</option>`);
  if(state.insumos.consumibles.length>0){
    sel.value = state.insumos.consumibles[0].id;
    loadConsToForm(sel.value);
  }else{
    $("consNombre").value=""; $("consUnidad").value=""; $("consPrecio").value="";
  }
}
function loadConsToForm(id){
  const c = state.insumos.consumibles.find(x=>x.id===id);
  if(!c) return;
  $("consNombre").value = c.nombre;
  $("consUnidad").value = c.unidad || "";
  $("consPrecio").value = c.precio;
}
function agregarConsumible(){
  const nombre = $("consNombre").value.trim();
  const unidad = $("consUnidad").value.trim() || "unidad";
  const precio = parseFloat($("consPrecio").value);
  if(!nombre || !isFinite(precio)){ alert("Completa bien los campos del consumible."); return; }
  state.insumos.consumibles.push({id:uid(), nombre, unidad, precio});
  saveState(); refreshAll(); alert("Consumible agregado ✅");
}
function guardarCambiosCons(){
  const id = $("consEditar").value;
  const c = state.insumos.consumibles.find(x=>x.id===id);
  if(!c){ alert("No hay consumible seleccionado."); return; }
  const nombre = $("consNombre").value.trim();
  const unidad = $("consUnidad").value.trim() || "unidad";
  const precio = parseFloat($("consPrecio").value);
  if(!nombre || !isFinite(precio)){ alert("Completa bien los campos del consumible."); return; }
  Object.assign(c, {nombre, unidad, precio});
  saveState(); refreshAll(); alert("Consumible actualizado ✨");
}
function borrarConsumible(){
  const id = $("consEditar").value;
  const c = state.insumos.consumibles.find(x=>x.id===id);
  if(!c) return;
  if(!confirm(`¿Borrar consumible "${c.nombre}"?`)) return;
  state.insumos.consumibles = state.insumos.consumibles.filter(x=>x.id!==id);
  saveState(); refreshAll();
}

/* ===== Reports ===== */
function refreshReports(){
  const prod = getActiveProducer();
  if(!prod){
    $("repBox").innerHTML = `<div class="warn">Selecciona un productor/a para ver reportes.</div>`;
    $("repList").innerHTML = "";
    return;
  }
  const total = (prod.procedures||[]).reduce((s,p)=>s + (p.total||0), 0);
  $("repBox").innerHTML = `
    <div class="box">
      <div><b>${escapeHTML(prod.nombre)}</b></div>
      <div class="sub">${escapeHTML(prod.localizacion||"Sin localización")}${fmtCoords(prod.lat, prod.lng)}</div>
      <div class="divider"></div>
      <div class="pill"><span>Total procedimientos:</span> <b>$${total.toFixed(2)}</b></div>
      <div class="divider"></div>
      <div class="sub"><b>Animales registrados:</b> ${prod.animals.length}</div>
    </div>
  `;
  const list = (prod.procedures||[]).slice().reverse();
  $("repList").innerHTML = list.length ? list.map(p=>{
    const dt = new Date(p.fechaISO).toLocaleString();
    return `<div class="box">
      <div><b>${escapeHTML(p.ovinoEtiqueta)}</b> • <span class="sub">${dt}</span></div>
      <div class="sub"><b>Tratados:</b> ${p.tratados} • <b>Total:</b> $${p.total.toFixed(2)}</div>
    </div>`;
  }).join("") : `<div class="warn">Sin procedimientos.</div>`;
}

/* ===== Reset ===== */
$("btnReset").addEventListener("click", ()=>{
  if(!confirm("¿Borrar TODO?")) return;
  localStorage.removeItem(STORE_KEY);
  state = loadState();
  activeProducerId = state.activeProducerId || null;
  refreshAll();
});

/* ===== Header + refresh ===== */
function refreshHeader(){
  const prod = getActiveProducer();
  $("activeProducerName").textContent = prod ? prod.nombre : "Ninguno";
}
function refreshAll(){
  refreshHeader();
  renderProducerList();
  refreshAnimalsInsideProducer();
  refreshProcedureTab();
  refreshMedEditor();
  refreshConsEditor();
  refreshReports();
}

/* Init */
renderTempFamily();
renderDecisionTable();
renderFeedingTable();
refreshAll();
