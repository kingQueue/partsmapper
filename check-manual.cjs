const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createPartmapServer}=require('./preview.cjs'),store=require('./project-store.cjs'),model=require('./lib/project-model.cjs');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'partmap-manual-'));let server;
 try{
  const config=path.join(temp,'selection.json');await store.selectProject(path.join(temp,'project'),{create:true,config});
  server=createPartmapServer({config});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const page=await (await fetch(base)).text();assert.ok(!/auto-wire|sourcing-review|wiring-handoff|AI handoff/.test(page));
  for(const name of [...page.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map(m=>m[1]))assert.equal((await fetch(base+'/'+name)).status,200,name);
  for(const route of ['/api/workspace/auto-wire','/api/workspace/auto-wire-status','/api/workspace/wiring-result','/api/workspace/sourcing','/api/env','/.env','/.partmap-runtime/sourceparts.env','/mcp/server.mjs','/../.env','/%2eenv'])assert.equal((await fetch(base+route)).status,404,route);
  const w=await(await fetch(base+'/api/workspace')).json();assert.ok(w.token);assert.equal(w.apiKey,undefined);
  const p=model.validate({name:'Manual wiring',nodes:[{id:'a',name:'A',category:'board',quantity:1,parent:null,pins:[{id:'a-g',name:'GND'}]},{id:'b',name:'B',category:'sensor',quantity:1,parent:'a',pins:[{id:'b-g',name:'GND'}]}]});
  const incoming=structuredClone(p);incoming.nodes[1].connections=[{target:'a',local:'b-g',remote:'a-g'}];const updated=model.wiring(p,incoming);assert.equal(updated.nodes.length,2);assert.equal(updated.nodes[1].parent,'a');assert.equal(updated.nodes[1].connections.length,1);
  incoming.nodes.push({...incoming.nodes[1],id:'extra'});assert.throws(()=>model.wiring(p,incoming),/component/);
  await store.saveWorkspace(config,{workspaceId:w.id,expectedRevision:w.revision,project:updated,brief:model.brief(updated),library:{components:[]}});
  const names=await fs.readdir(w.directory);assert.ok(names.includes('parts-report.md'));assert.ok(!names.some(n=>/agent|wiring-context|handoff|ai-brief/.test(n)));
  const package_=JSON.parse(await fs.readFile('package.json'));assert.equal(package_.dependencies,undefined);assert.equal(package_.scripts.mcp,undefined);
  console.log('Passed: manual wiring update, inventory preservation, report saves, packaged assets, removed integration routes and denied credential/runtime URLs.');
 }finally{if(server)await new Promise(r=>server.close(r));assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('partmap-manual-'));await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
