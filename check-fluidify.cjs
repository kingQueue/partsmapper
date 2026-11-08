const assert=require('assert/strict'),fs=require('fs/promises'),os=require('os'),path=require('path');
const fluid=require('./dist/fluid-model.js'),model=require('./lib/project-model.cjs'),store=require('./project-store.cjs');
(async()=>{
 const c=fluid.empty(),tank=fluid.add(c,'reservoir',{x:30,y:40}),pump=fluid.add(c,'pump',{x:370,y:40}),filter=fluid.add(c,'filter',{x:700,y:40});pump.parent=tank.id;filter.parent=pump.id;
 const end=(n,i)=>({component:n.id,port:n.ports[i].id});
 fluid.connect(c,end(tank,0),end(pump,0));fluid.connect(c,end(pump,1),end(filter,0));fluid.connect(c,end(filter,1),end(tank,1));
 assert.deepEqual(fluid.validate(JSON.parse(JSON.stringify(c))),c);
 assert.throws(()=>fluid.add(c,'board'),/fluid mechanical/);assert.equal(c.nodes.length,3);
 assert.throws(()=>fluid.add(c,'pump',{x:Infinity,y:0}),/position/);assert.equal(c.nodes.length,3);
 const badDirection=fluid.empty(),a=fluid.add(badDirection,'pump'),b=fluid.add(badDirection,'pump');assert.throws(()=>fluid.connect(badDirection,end(a,0),end(b,1)),/outlet/);
 assert.throws(()=>fluid.connect(c,end(tank,0),end(filter,0)),/already/);
 const malformed=structuredClone(c);malformed.connections[0].to.port='missing';assert.throws(()=>fluid.validate(malformed),/ports/);
 const cyclic=structuredClone(c);cyclic.nodes[0].parent=filter.id;assert.throws(()=>fluid.validate(cyclic),/cycle/);
 const copies=fluid.duplicate(c,structuredClone(c));assert.equal(c.nodes.length,6);assert.equal(c.connections.length,6);assert.equal(copies[1].parent,copies[0].id);
 assert.notEqual(copies[0].ports[0].id,tank.ports[0].id);copies[0].ports[0].name='Independent supply';assert.equal(tank.ports[0].name,'Supply');
 fluid.remove(c,[tank.id]);assert.equal(c.nodes.length,5);assert.equal(pump.parent,null);assert.equal(c.nodes.find(n=>n.id===filter.id).parent,pump.id);assert.equal(c.connections.length,4);
 const electronics={id:'mcu',name:'Existing board',category:'board',quantity:1,parent:null,pins:[],pinSections:[],connections:[]};
 const p={name:'Mixed product',nodes:[electronics],fluidify:c};const normalized=model.validate(p);assert.deepEqual(normalized.fluidify,c);assert.equal(normalized.nodes.length,1);assert.equal(model.validate({name:'Legacy',nodes:[]}).fluidify,null);
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'partmap-fluidify-')),config=path.join(tmp,'selection.json'),directory=path.join(tmp,'Project');
 try{
  await store.selectProject(directory,{create:true,name:'Fixture',config});const w=await store.readWorkspace(config);
  const saved=await store.saveWorkspace(config,{workspaceId:w.id,expectedRevision:w.revision,project:p,brief:'Fluid fixture',library:{components:[],customIds:[]}});
  assert.ok(saved.revision);const reloaded=await store.readWorkspace(config);assert.deepEqual(reloaded.project.fluidify,c);assert.deepEqual(reloaded.project.nodes,[electronics]);assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory,'fluidify-circuit.json'),'utf8')),c);
  const html=await fs.readFile(path.join(__dirname,'dist/index.html'),'utf8');assert.ok(html.indexOf('fluid-model.js')<html.indexOf('app.js'));assert.ok(html.indexOf('fluidify.js')<html.indexOf('project-folder.js'));
 }finally{assert.ok(path.resolve(tmp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(tmp).startsWith('partmap-fluidify-'));await fs.rm(tmp,{recursive:true,force:true});}
 console.log('Passed: fluid-only inventory, connected closed circuit, direction/port validation, independent duplicates with internal hoses, orphan-preserving deletion, native model round trip, legacy compatibility and project-folder autosave/export without changing electronics.');
})().catch(e=>{console.error(e);process.exitCode=1;});
