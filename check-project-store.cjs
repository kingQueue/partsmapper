const assert=require('assert'),fs=require('fs/promises'),path=require('path'),os=require('os');
const store=require('./project-store.cjs'),{createPartmapServer}=require('./preview.cjs');
(async()=>{
  const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'partmap-project-test-')),config=path.join(fixture,'config.json'),directory=path.join(fixture,'Robot project');let server;
  try{
    await store.selectProject(directory,{create:true,name:'Robot',config});let initial=await store.readWorkspace(config);assert.equal(initial.project.name,'Robot');assert.equal(initial.project.nodes.length,0);
    const project={...initial.project,nodes:[{id:'controller',name:'Controller',parent:null,category:'board',quantity:1,pins:[],pinSections:[],connections:[],attachments:[{name:'reference.txt',data:'data:text/plain;base64,aGVsbG8='}]}],requirementsDocument:{name:'missing-requirements.md',markdown:'# Missing\nPower supply.',updatedAt:'2026-10-28'}};
    const body={workspaceId:initial.id,expectedRevision:initial.revision,project,brief:'# AI brief',library:{components:[]}};
    let saved=await store.saveWorkspace(config,body);assert.equal(JSON.parse(await fs.readFile(path.join(directory,'project.json'),'utf8')).nodes.length,1);
    assert.equal(JSON.parse(await fs.readFile(path.join(directory,'wiring-context.json'),'utf8')).components[0].id,'controller');
    project.nodes[0].pins=[{id:'power',name:'VCC',section:'main'}];
    saved=await store.saveWorkspace(config,{...body,expectedRevision:saved.revision});
    assert.equal(JSON.parse(await fs.readFile(path.join(directory,'wiring-context.json'),'utf8')).components[0].pins[0].id,'power');
    assert.equal(await fs.readFile(path.join(directory,'missing-requirements.md'),'utf8'),project.requirementsDocument.markdown);assert.equal(await fs.readFile(path.join(directory,'ai-brief.md'),'utf8'),'# AI brief');const libraryState=await store.readLibraryState(config,initial.id);assert.equal(libraryState.revision,saved.revision);assert.equal(libraryState.projectRevision,saved.projectRevision);
    const references=JSON.parse(await fs.readFile(path.join(directory,'references/index.json'),'utf8'));assert.equal(references.length,1);assert.equal(await fs.readFile(path.join(directory,references[0].path),'utf8'),'hello');
    await assert.rejects(()=>store.saveWorkspace(config,body),/changed on disk/);
    await store.saveExport(config,{workspaceId:initial.id,name:'report.md',base64:Buffer.from('report').toString('base64')});assert.equal(await fs.readFile(path.join(directory,'exports/report.md'),'utf8'),'report');
    const files=['project.json','agent-prompt.md','agent-command.txt','missing-requirements.md','README.md','wiring-context.json'].map(name=>({name,text:name}));await store.saveExport(config,{workspaceId:initial.id,name:'handoff.zip',base64:'UEs=',files});assert.equal(await fs.readFile(path.join(directory,'wiring-handoff/agent-prompt.md'),'utf8'),'agent-prompt.md');
    await assert.rejects(()=>store.saveExport(config,{workspaceId:initial.id,name:'../escape.txt',base64:''}),/filename/);
    await assert.rejects(()=>store.saveExport(config,{workspaceId:initial.id,name:'invalid.zip',base64:'',files:[{name:'../escape.txt',text:'x'}]}),/handoff/);await assert.rejects(()=>fs.access(path.join(directory,'exports/invalid.zip')));
    await fs.writeFile(path.join(directory,'missing-requirements.md'),'# Agent updated requirements');const external=await store.readWorkspace(config);assert.equal(external.project.requirementsDocument.markdown,'# Agent updated requirements');await assert.rejects(()=>store.saveWorkspace(config,{...body,expectedRevision:saved.revision}),/changed on disk/);
    const outside=path.join(fixture,'outside');await fs.mkdir(outside);try{await fs.symlink(outside,path.join(directory,'link'),'junction');await assert.rejects(()=>store.safePath(directory,'link/test.json'),/symbolic links/);}catch(error){if(!['EPERM','ENOTSUP'].includes(error.code))throw error;}
    server=createPartmapServer({config});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(url+'/api/workspace',{headers:{Origin:'https://unrelated.example'}})).status,403);
    const context=await (await fetch(url+'/api/workspace')).json();assert.equal(context.directory,await fs.realpath(directory));assert.ok(context.token);
    assert.equal((await fetch(url+'/api/workspace/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})).status,403);
    const exported=await fetch(url+'/api/workspace/export',{method:'POST',headers:{'Content-Type':'application/json','X-Partmap-Token':context.token},body:JSON.stringify({workspaceId:context.id,name:'api.txt',base64:Buffer.from('via API').toString('base64')})});assert.equal(exported.status,200);assert.equal(await fs.readFile(path.join(directory,'exports/api.txt'),'utf8'),'via API');
    await store.selectProject(path.join(fixture,'Other project'),{create:true,config});await assert.rejects(()=>store.saveWorkspace(config,{...body,expectedRevision:external.revision}),/folder changed/);
    await assert.rejects(()=>store.selectProject(path.join(fixture,'not-a-project'),{config}));
    console.log('Passed: create/open folders, disk project/Markdown/library/PCB saves, reference extraction, scoped exports and unpacked handoffs, backups, external edit/revision conflicts, selected-folder isolation, origin/token checks, and traversal/symlink rejection.');
  }finally{if(server)await new Promise(resolve=>server.close(resolve));const target=path.resolve(fixture),temporary=path.resolve(os.tmpdir());assert.ok(target.startsWith(temporary+path.sep)&&path.basename(target).startsWith('partmap-project-test-'));await fs.rm(target,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
