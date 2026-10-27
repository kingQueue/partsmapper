const fs=require('fs'),vm=require('vm'),assert=require('assert');
const storage=new Map(),elements=new Map();function el(s){if(!elements.has(s))elements.set(s,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:''});return elements.get(s);}
const ctx={document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},structuredClone,crypto:require('crypto').webcrypto,console,setTimeout,clearTimeout,performance};vm.createContext(ctx);
for(const name of ['app','studio','hardware','clipboard','workbench','assembly']){const code=fs.readFileSync(`dist/${name}.js`,'utf8').replace(/\n(?:render\(\)|initializeHardware\(\)|initializeComponentClipboard\(\)|initializeWorkbench\(\)|initializeAssembly\(\));\s*$/,'');vm.runInContext(code,ctx);}
const run=s=>vm.runInContext(s,ctx);
run('const grandchild=duplicateDevice(node("display"),"Display accessory");grandchild.parent="display";project.nodes.push(grandchild);saveWire(node("display"),node("display").pins[0].id,"motor",node("motor").pins[0].id);synchronizePartsChecklist();');
assert.equal(run('partsChecklistStatus().total'),8);assert.equal(run('partsChecklistStatus().complete'),true);
run('render(false);checklist()');assert.equal(el('#checkBadge').textContent,'Complete');assert.equal((el('#checkList').innerHTML.match(/disabled checked/g)||[]).length,8);
run('const beforeDeletionIds=project.nodes.map(n=>n.id);const removed=deleteComponentKeepingChildren("controller");');
assert.equal(run('removed.children.length'),3);assert.equal(run('project.nodes.length'),7);
assert.ok(run('["display","motor","sensor"].every(id=>node(id).parent===null)'));
assert.equal(run('node(grandchild.id).parent'),'display');assert.ok(run('beforeDeletionIds.filter(id=>id!=="controller").every(id=>!!node(id))'));
assert.ok(run('project.nodes.every(n=>n.connections.every(c=>c.target!=="controller"))'));
assert.ok(run('node("display").connections.some(c=>c.target==="motor")'),'Unrelated child wiring remains intact');
assert.equal(run('partsChecklistStatus().missing'),1);assert.equal(run('partsChecklistStatus().complete'),false);
run('render(false);checklist()');assert.equal(el('#checkBadge').textContent,'1');assert.ok(el('#checkList').innerHTML.includes('Add to map'));
assert.equal((el('#checkList').innerHTML.match(/disabled checked/g)||[]).length,7);
run('const missingRow=project.partsChecklist.find(e=>e.componentId==="controller");const originalPinId=missingRow.component.pins[0].id;const restored=restoreChecklistComponent(missingRow.id);');
assert.equal(run('partsChecklistStatus().complete'),true);assert.equal(run('partsChecklistStatus().total'),8);assert.notEqual(run('restored.pins[0].id'),run('originalPinId'));
assert.equal(run('restored.parent'),null);assert.equal(run('restored.connections.length'),0);assert.equal(run('node("display").parent'),null);
run('deleteComponentKeepingChildren(restored.id);const manuallyReadded=duplicateDevice(restored,restored.name);manuallyReadded.parent=null;project.nodes.push(manuallyReadded);synchronizePartsChecklist();');
assert.equal(run('partsChecklistStatus().complete'),true);assert.equal(run('partsChecklistStatus().total'),8,'Adding the same missing item checks its existing row');
run('deleteComponentKeepingChildren(manuallyReadded.id);persist();');const stored=JSON.parse(storage.get('partmap.project.v1'));assert.equal(stored.partsChecklist.length,8);
const round=run('validate(JSON.parse(JSON.stringify(exportObject())))');assert.equal(round.partsChecklist.length,8);assert.equal(round.nodes.length,7);
run('project=validate(JSON.parse(JSON.stringify(exportObject())));');assert.equal(run('partsChecklistStatus().missing'),1,'Unchecked rows survive export/import and reload');
assert.throws(()=>run('{const bad=exportObject();bad.partsChecklist.push(structuredClone(bad.partsChecklist[0]));validate(bad);}'),/duplicate/);
run('project={name:"Empty",nodes:[],history:[],baseline:[]};');assert.equal(run('partsChecklistStatus().complete'),false);
console.log('Passed: parent-only deletion, direct-child detachment, preserved grandchildren and unrelated wiring, automatic checklist state, completion badge, independent restoration, matching re-added parts, and missing-part persistence/JSON round trips.');
