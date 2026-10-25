const fs=require('fs'),vm=require('vm'),assert=require('assert');
const els=new Map();function el(s){if(!els.has(s))els.set(s,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',clientWidth:800});return els.get(s);}
const ctx={document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},structuredClone,crypto:require('crypto').webcrypto,console,setTimeout,clearTimeout,performance};vm.createContext(ctx);
for(const file of ['app.js','studio.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8').replace(/\nrender\(\);\s*$/,''),ctx);
vm.runInContext(fs.readFileSync('dist/hardware.js','utf8').replace(/initializeHardware\(\);\s*$/,''),ctx);
vm.runInContext(fs.readFileSync('dist/clipboard.js','utf8').replace(/initializeComponentClipboard\(\);\s*$/,''),ctx);const run=s=>vm.runInContext(s,ctx);
run('node("sensor").name="Wheel encoder";node("motor").name="Wheel motor";const payload=componentClipboardPayload(node("sensor"));const encoderSnapshot=parseComponentClipboard(JSON.stringify(payload));const encoderOriginalId=node("sensor").id;const encoders=pasteComponentCopies(encoderSnapshot,3)');
assert.equal(run('project.nodes.filter(n=>n.name.startsWith("Wheel encoder")).length'),4);assert.equal(run('new Set([encoderOriginalId,...encoders.map(n=>n.id)]).size'),4);assert.equal(run('new Set(encoders.flatMap(n=>n.pins.map(p=>p.id))).size'),3);
assert.ok(run('encoders.every(n=>n.parent==="controller"&&n.quantity===1&&n.connections.length===0)'));
run('encoders[0].pins[0].name="INDEPENDENT"');assert.equal(run('node("sensor").pins[0].name'),'OUT');assert.equal(run('encoders[1].pins[0].name'),'OUT');
run('const motorSnapshot=parseComponentClipboard(JSON.stringify(componentClipboardPayload(node("motor"))));const motors=pasteComponentCopies(motorSnapshot,3)');assert.equal(run('project.nodes.filter(n=>n.name.startsWith("Wheel motor")).length'),4);
run('node("motor").notes="Edited after copy";const extra=pasteComponentCopies(motorSnapshot,1,"")');assert.notEqual(run('extra[0].notes'),'Edited after copy');assert.equal(run('extra[0].parent'),null);
run('const other=pasteComponentCopies(encoderSnapshot,1,"motor")');assert.equal(run('other[0].parent'),'motor');
assert.equal(run('parseComponentClipboard("ordinary text")'),null);assert.equal(run('parseComponentClipboard("{\\"name\\":\\"not a component clipboard\\"}")'),null);assert.throws(()=>run('parseComponentClipboard(JSON.stringify({format:"partmap.component",version:9,component:{}}))'),/unsupported/);
run('const countBeforeFailure=project.nodes.length');assert.throws(()=>run('pasteComponentCopies(motorSnapshot,301)'),/whole number/);assert.equal(run('project.nodes.length'),run('countBeforeFailure'));assert.throws(()=>run('pasteComponentCopies(motorSnapshot,1,"missing-parent")'),/no longer/);
run('const orphanSnapshot=structuredClone(motorSnapshot);orphanSnapshot.parent="absent-in-this-project";const reparented=pasteComponentCopies(orphanSnapshot,1)');assert.equal(run('reparented[0].parent'),null);
assert.ok(run('clipboardTargetIsEditable({closest:()=>({tagName:"INPUT"})})'));assert.equal(run('clipboardTargetIsEditable({closest:()=>null})'),false);
const round=run('validate(JSON.parse(JSON.stringify(exportObject())))');assert.equal(round.nodes.length,run('project.nodes.length'));assert.equal(new Set(round.nodes.map(n=>n.id)).size,round.nodes.length);
console.log('Passed: four independent encoders and four motors, unique device/pin IDs, detached wires, snapshot isolation, parent selection and fallback, native text-editing guard, invalid clipboard handling, atomic limits, and export round trip.');
