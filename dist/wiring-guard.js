function wiringCanonical(value){if(Array.isArray(value))return value.map(wiringCanonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,wiringCanonical(value[k])]));return value;}
function wiringSourceFingerprint(p){
  const source={name:p.name,requirementsDocument:p.requirementsDocument||null,nodes:p.nodes.map(n=>({id:n.id,name:n.name,category:n.category,model:n.model||'',parent:n.parent,quantity:n.quantity,ready:n.ready,pins:n.pins,pinSections:n.pinSections,positions:n.positions,voltage:n.voltage,interface:n.interface,notes:n.notes,firmware:n.firmware,connections:n.connections})).sort((a,b)=>a.id.localeCompare(b.id))};
  const text=JSON.stringify(wiringCanonical(source));let a=2166136261,b=5381;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619)>>>0;b=(Math.imul(b,33)^text.charCodeAt(i))>>>0;}
  return `v1:${text.length}:${a.toString(16)}:${b.toString(16)}`;
}
function makeWiringTask(p){return {format:'partmap.wiring-task',version:1,componentIds:p.nodes.map(n=>n.id).sort(),sourceFingerprint:wiringSourceFingerprint(p)};}
function validateWiringTask(raw){
  if(raw==null)return null;
  if(raw.format!=='partmap.wiring-task'||raw.version!==1||!Array.isArray(raw.componentIds)||raw.componentIds.length>300||raw.componentIds.some(id=>typeof id!=='string'||!id)||new Set(raw.componentIds).size!==raw.componentIds.length||typeof raw.sourceFingerprint!=='string'||!/^v1:\d+:[0-9a-f]+:[0-9a-f]+$/.test(raw.sourceFingerprint))throw Error('Invalid wiring task inventory. Re-export the wiring package.');
  return structuredClone(raw);
}
function assertWiringInventory(expectedIds,incoming){
  const expected=new Set(expectedIds),actual=new Set(incoming.nodes.map(n=>n.id)),added=incoming.nodes.filter(n=>!expected.has(n.id)),missing=[...expected].filter(id=>!actual.has(id));
  if(added.length||missing.length)throw Error(`Wiring update blocked: ${added.length} added and ${missing.length} missing component(s).${added.length?' Unexpected: '+added.slice(0,4).map(n=>n.name).join(', ')+'.':''} Auto wiring must keep the exact existing component IDs and count; ask the agent to correct its result without adding copies.`);
}
function wiringImportIsRelated(current,incoming){const ids=new Set(current.nodes.map(n=>n.id));return incoming.nodes.some(n=>ids.has(n.id))||current.name===incoming.name;}
function wiringImportIsTask(incoming,fileName=''){return !!incoming.wiringTask||/wired[-_ ]?project|wiring[-_ ]?(result|project)/i.test(fileName);}
function checkWiringImport(current,incoming,fileName=''){
  if(incoming.wiringTask)assertWiringInventory(incoming.wiringTask.componentIds,incoming);
  if(wiringImportIsTask(incoming,fileName)&&wiringImportIsRelated(current,incoming))assertWiringInventory(current.nodes.map(n=>n.id),incoming);
}
function guardJsonAppend(current,incoming){
  const ids=new Set(current.nodes.map(n=>n.id));if(incoming.wiringTask||incoming.nodes.some(n=>ids.has(n.id)))throw Error('This JSON contains an existing project or wiring result. Appending it would create extra copies. Choose Update wiring (no new components), or Replace for a full project restore.');
}
function applyWiringUpdate(current,raw){
  const incoming=validate(raw);assertWiringInventory(current.nodes.map(n=>n.id),incoming);
  if(incoming.wiringTask){
    assertWiringInventory(incoming.wiringTask.componentIds,incoming);
    if(incoming.wiringTask.sourceFingerprint!==wiringSourceFingerprint(current)){
      const fields=['pins','pinSections','connections','notes','firmware','parent','quantity'];
      const alreadyApplied=current.nodes.every(n=>{const candidate=incoming.nodes.find(other=>other.id===n.id);return fields.every(key=>JSON.stringify(wiringCanonical(n[key]))===JSON.stringify(wiringCanonical(candidate[key])));})&&JSON.stringify(wiringCanonical(current.requirementsDocument||null))===JSON.stringify(wiringCanonical(incoming.requirementsDocument||null));
      if(alreadyApplied)return validate(structuredClone(current));
      throw Error('The project changed after this wiring package was exported. Re-export it and have the agent update the latest project; nothing was applied.');
    }
  }
  const next=structuredClone(current),byId=new Map(incoming.nodes.map(n=>[n.id,n]));
  for(const n of next.nodes){
    const update=byId.get(n.id);
    if(n.quantity!==update.quantity||n.parent!==update.parent)throw Error(`Wiring update changes quantity or parent for ${n.name}. Keep the original inventory and hierarchy.`);
    for(const pin of n.pins)if(!update.pins.some(p=>p.id===pin.id))throw Error(`Wiring update drops an existing pin on ${n.name}. Preserve pin IDs instead of rebuilding the board.`);
    for(const section of n.pinSections)if(!update.pinSections.some(s=>s.id===section.id))throw Error(`Wiring update drops a header section on ${n.name}. Preserve section IDs.`);
    // Wiring-only application keeps inventory, attachments, positions, readiness, and metadata intact.
    for(const key of ['pins','pinSections','connections','notes','firmware'])n[key]=structuredClone(update[key]);
  }
  if(incoming.requirementsDocument)next.requirementsDocument=structuredClone(incoming.requirementsDocument);
  next.wiringTask=null;synchronizePartsChecklist(next);return validate(next);
}
const validateBeforeWiringGuard=validate;
validate=function(raw){const result=validateBeforeWiringGuard(raw);result.wiringTask=validateWiringTask(raw.wiringTask);if(result.wiringTask)assertWiringInventory(result.wiringTask.componentIds,result);return result;};
const mergeBeforeWiringGuard=mergeParts;
mergeParts=function(current,incoming){if(incoming.wiringTask)throw Error('A wiring task result cannot be appended. Use Update wiring (no new components).');return mergeBeforeWiringGuard(current,incoming);};
