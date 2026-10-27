// Checklist plans survive removal from the map; mapped state is derived from node identity.
function checklistSnapshot(n){const copy=structuredClone(n);copy.parent=null;copy.connections=[];delete copy.positions;return copy;}
function checklistSignature(n){return JSON.stringify([n.name,n.category,n.model||'']);}
function synchronizePartsChecklist(p=project){
  if(!Array.isArray(p.partsChecklist))p.partsChecklist=[];
  const active=new Set(p.nodes.map(n=>n.id)),claimed=new Set();
  for(const n of p.nodes){
    let row=p.partsChecklist.find(e=>e.componentId===n.id&&!claimed.has(e.id));
    if(!row)row=p.partsChecklist.find(e=>!active.has(e.componentId)&&!claimed.has(e.id)&&checklistSignature(e.component)===checklistSignature(n));
    if(!row){row={id:uid(),componentId:n.id,component:checklistSnapshot(n)};p.partsChecklist.push(row);}
    row.componentId=n.id;row.component=checklistSnapshot(n);claimed.add(row.id);
  }
  return p.partsChecklist;
}
function partsChecklistStatus(p=project){const rows=synchronizePartsChecklist(p),ids=new Set(p.nodes.map(n=>n.id)),mapped=rows.filter(e=>ids.has(e.componentId)).length;return {total:rows.length,mapped,missing:rows.length-mapped,complete:rows.length>0&&mapped===rows.length};}
function validatePartsChecklist(raw){
  if(raw==null)return [];
  if(!Array.isArray(raw)||raw.length>2000)throw Error('Invalid parts checklist.');
  const ids=new Set(),componentIds=new Set();return raw.map(row=>{
    if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.componentId!=='string'||!row.componentId||componentIds.has(row.componentId))throw Error('Invalid or duplicate checklist entry.');
    ids.add(row.id);componentIds.add(row.componentId);return {id:row.id,componentId:row.componentId,component:checkedTemplate(row.component)};
  });
}
const validateBeforeAssembly=validate;
validate=function(raw){const result=validateBeforeAssembly(raw);result.partsChecklist=validatePartsChecklist(raw.partsChecklist);return result;};
function deleteComponentKeepingChildren(id){
  const removed=node(id);if(!removed)return null;
  synchronizePartsChecklist();const {children}=removeComponentNode(id);
  mapSelection.delete(id);if(selected===id)selected=children[0]?.id||project.nodes[0]?.id;
  return {removed,children};
}
function restoreChecklistComponent(rowId){
  const row=project.partsChecklist?.find(e=>e.id===rowId);if(!row)throw Error('This checklist part no longer exists.');
  if(node(row.componentId))throw Error('This part is already on the product map.');
  if(project.nodes.length>=300)throw Error('The project already has 300 components.');
  const copy=duplicateDevice(checkedTemplate(row.component),row.component.name);copy.parent=null;delete copy.positions;
  row.componentId=copy.id;project.nodes.push(copy);selected=copy.id;enabled.add(copy.category);return copy;
}
function refreshPartsChecklistState(){
  const state=partsChecklistStatus();$('#readyStat').textContent=`${state.mapped}/${state.total}`;$('#checkBadge').textContent=state.complete?'Complete':String(state.missing);
  $('#checkNav').classList.toggle('checklist-complete',state.complete);$('#checkNav').title=state.complete?'Complete — every listed part is on the product map':`${state.missing} listed part(s) missing from the product map`;
}
checklist=function(){
  const rows=synchronizePartsChecklist(),state=partsChecklistStatus();
  $('#checkList').innerHTML=`<p class="checklist-progress">${state.mapped} of ${state.total} listed parts on the map${state.complete?' · Complete':''}</p>`+rows.map(row=>{
    const n=row.component,present=!!node(row.componentId);
    return `<div class="check-row ${present?'part-mapped':'part-unmapped'}"><input type="checkbox" disabled ${present?'checked':''} aria-label="${esc(n.name)} is on the product map"><span>${esc(n.name)}<small>${esc(categories[n.category][0])} · ${esc(n.model||'No model specified')} · ${present?'On product map':'Not on product map'}</small></span><b>×${n.quantity}</b>${present?'':`<button class="button" data-restore-part="${esc(row.id)}">Add to map</button>`}</div>`;
  }).join('');
  $$('[data-restore-part]').forEach(button=>button.onclick=()=>{try{const n=restoreChecklistComponent(button.dataset.restorePart);changed(`Restored checklist part ${n.name}`);setView('full');renderInspector();checklist();}catch(e){toast(e.message);}});
};
const inspectorBeforeAssembly=renderInspector;
renderInspector=function(){
  inspectorBeforeAssembly();const n=node(selected);if(!n)return;
  $('#deleteNode').onclick=()=>{
    const children=project.nodes.filter(c=>c.parent===n.id);
    const dialog=createModal(`<div class="dialog-heading"><h2>Remove component?</h2><button class="icon-button" data-dismiss>×</button></div><p>Remove ${esc(n.name)} from the product map?</p><p>${children.length?`Its ${children.length} direct child component(s) will remain at the product root. `:''}This part stays unchecked in the checklist and can be added back.</p><div class="dialog-actions"><button class="button" data-dismiss>Keep component</button><button id="confirmRemoveComponent" class="button danger">Remove component</button></div>`);
    dialog.querySelector('#confirmRemoveComponent').onclick=()=>{deleteComponentKeepingChildren(n.id);changed(`Removed ${n.name}; kept ${children.length} direct children without a parent`);renderInspector();dialog.close();};dialog.showModal();
  };
};
const persistBeforeAssembly=persist;
persist=function(){synchronizePartsChecklist();persistBeforeAssembly();};
const renderBeforeAssembly=render;
render=function(inspect=true){synchronizePartsChecklist();renderBeforeAssembly(inspect);refreshPartsChecklistState();};
const exportBeforeAssembly=exportObject;
exportObject=function(){synchronizePartsChecklist();return exportBeforeAssembly();};
function initializeAssembly(){
  try{project.partsChecklist=validatePartsChecklist(project.partsChecklist);}catch(error){toast(error.message);return;}
  synchronizePartsChecklist();render();persist();
}
initializeAssembly();
