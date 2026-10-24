const fs=require('fs'),vm=require('vm'),assert=require('assert');
const els=new Map();function el(s){if(!els.has(s))els.set(s,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',clientWidth:800});return els.get(s);}
const ctx={document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},structuredClone,crypto:require('crypto').webcrypto,console,setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),ctx);
function run(s){return vm.runInContext(s,ctx);}
assert.equal(run('project.nodes.length'),7);assert.equal(run('differences().added.length'),0);assert.ok(run('brief()').includes('GPIO21'));
run('project.nodes[0].notes="changed"');assert.equal(run('differences().modified.length'),1);
run('project.nodes.push({...structuredClone(seed.nodes[0]),id:"new-board"})');assert.equal(run('differences().added.length'),1);
run('project.nodes=project.nodes.filter(n=>n.id!=="motor")');assert.equal(run('differences().removed[0].name'),'Micro servo');
assert.throws(()=>run('validate({name:"bad",nodes:[{id:"a",name:"a",category:"board",quantity:1,parent:"a"}]})'),/circular/);
assert.throws(()=>run('validate({name:"bad",nodes:[{id:"a",name:"a",category:"board",quantity:1,parent:"missing"}]})'),/missing/);
assert.equal(run('csvRows(\'name,notes\\n"A,B","two\\nlines"\')[1][0]'),'A,B');
assert.ok(run('brief()').includes('Removed: Micro servo'));
run('render();setView("electronics")');assert.ok(!el('#nodes').innerHTML.includes('Printed enclosure'));
const p=run('exportObject()');assert.ok(p.changes.removed.length===1);assert.equal(run('validate(exportObject()).nodes.length'),7);
console.log('Passed: tree validation, cycle/orphan rejection, baseline changes, firmware brief, quoted CSV, JSON round trip, electronics filtering, initial render.');
