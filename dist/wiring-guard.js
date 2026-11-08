function assertWiringInventory(expectedIds,incoming){
  const expected=new Set(expectedIds),actual=new Set(incoming.nodes.map(n=>n.id)),added=incoming.nodes.filter(n=>!expected.has(n.id)),missing=[...expected].filter(id=>!actual.has(id));
  if(added.length||missing.length)throw Error(`Wiring update blocked: ${added.length} added and ${missing.length} missing component(s).${added.length?' Unexpected: '+added.slice(0,4).map(n=>n.name).join(', ')+'.':''} Wiring updates must keep the exact existing component IDs and count.`);
}
function wiringImportIsRelated(current,incoming){const ids=new Set(current.nodes.map(n=>n.id));return incoming.nodes.some(n=>ids.has(n.id))||current.name===incoming.name;}
function wiringImportIsTask(incoming,fileName=''){return /wired[-_ ]?project|wiring[-_ ]?(result|project)/i.test(fileName);}
function checkWiringImport(current,incoming,fileName=''){
  if(wiringImportIsTask(incoming,fileName)&&wiringImportIsRelated(current,incoming))assertWiringInventory(current.nodes.map(n=>n.id),incoming);
}
function guardJsonAppend(current,incoming){
  const ids=new Set(current.nodes.map(n=>n.id));if(incoming.nodes.some(n=>ids.has(n.id)))throw Error('This JSON contains an existing project or wiring result. Appending it would create extra copies. Choose Update wiring (no new components), or Replace for a full project restore.');
}
function applyWiringUpdate(current,raw){
  const incoming=validate(raw);assertWiringInventory(current.nodes.map(n=>n.id),incoming);
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
  synchronizePartsChecklist(next);return validate(next);
}
