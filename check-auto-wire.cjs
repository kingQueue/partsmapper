const assert=require('assert/strict'),fs=require('fs/promises'),path=require('path'),os=require('os');
const auto=require('./auto-wire.cjs'),store=require('./project-store.cjs'),{createPartmapServer}=require('./preview.cjs');
(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'partmap-auto-wire-')),config=path.join(temp,'selection.json'),directory=path.join(temp,'project');let server;
  try{
    await store.selectProject(directory,{create:true,config});let w=await store.readWorkspace(config);
    const n=(id,name,pins)=>({id,name,category:'board',parent:null,quantity:1,pins:pins.map(([id,name])=>({id,name,type:'unspecified',section:'main'})),pinSections:[{id:'main',name:'Main',side:'left'}],connections:[]});
    w.project.nodes=[n('cpu','ESP32',[['gpio','GPIO27']]),n('pwm','16-channel PWM driver',[['rail','V+']])];
    await store.saveWorkspace(config,{workspaceId:w.id,expectedRevision:w.revision,project:w.project,brief:'',library:{components:[]}});w=await store.readWorkspace(config);
    assert.equal((await auto.readResult(directory,w.project)).found,false);
    const data={format:'partmap.wiring-edits',connections:[{from:{component:'cpu',pin:'gpio'},to:{component:'pwm',pin:'rail'},reason:'Intentional invalid test route'}],blocked:[],assumptions:[]};
    const output=path.join(directory,'complete-wiring.json');await fs.writeFile(output,JSON.stringify(data));const before=await fs.readFile(path.join(directory,'project.json'));
    const result=await auto.readResult(directory,w.project);assert.equal(result.routes.length,1);assert.equal(result.issues.length,1);assert.ok(result.routes[0].issue);assert.equal(result.unapplied,true);
    server=createPartmapServer({config});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
    const context=await(await fetch(base+'/api/workspace')).json();
    const response=await fetch(base+'/api/workspace/auto-wire',{method:'POST',headers:{'Content-Type':'application/json','X-Partmap-Token':context.token},body:JSON.stringify({workspaceId:w.id,agentId:'must-not-run'})});
    const existing=await response.json();assert.equal(existing.existing,true);assert.equal(existing.result.routes.length,1);
    assert.ok(before.equals(await fs.readFile(path.join(directory,'project.json'))));assert.equal(await fs.readFile(output,'utf8'),JSON.stringify(data));
    data.connections[0].from.pin='missing';await fs.writeFile(output,JSON.stringify(data));const stale=await auto.readResult(directory,w.project);assert.equal(stale.routes.length,0);assert.equal(stale.issues.length,1);
    await fs.writeFile(output,'not json');assert.equal((await auto.readResult(directory,w.project)).invalid,true);
    await assert.rejects(()=>auto.workspaceResult(config,'wrong-workspace'),/changed/);
    console.log('Passed: automatic file discovery, file overlay data, flagged route visibility, unknown-ID and malformed-file reporting, existing-result dispatch prevention and unchanged source files.');
  }finally{if(server)await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
