const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict');
const store=require('./project-store.cjs'),manager=require('./project-manager.cjs'),{createPartmapServer}=require('./preview.cjs');
(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'partmap-manager-test-')),config=path.join(temp,'runtime','selection.json');
  const server=createPartmapServer({config,browseFolder:async()=>({directory:temp,cancelled:false})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  let token;
  async function request(route,body,extra={}){const response=await fetch(base+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Partmap-Token':token,...extra}:extra,body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
  try{
    const initial=await request('/api/projects');assert.equal(initial.status,200);assert.equal(initial.data.projects.length,0);token=initial.data.token;
    assert.equal((await request('/api/projects/activate',{action:'create',name:'Blocked',parent:temp},{'X-Partmap-Token':'invalid'})).status,403);
    const created=await request('/api/projects/activate',{action:'create',name:'Robot alpha',parent:temp});assert.equal(created.status,200);assert.equal(created.data.components,0);
    let current=await store.readWorkspace(config);assert.equal(current.project.name,'Robot alpha');assert.deepEqual(current.project.nodes,[]);
    const guard=()=>({currentId:current.id,currentDirectory:current.directory,currentRevision:current.revision});
    assert.equal((await request('/api/projects/browse',{initialDirectory:temp})).data.directory,temp);
    assert.equal((await request('/api/projects/activate',{...guard(),action:'create',name:'Robot alpha',parent:temp})).status,409);
    assert.equal((await request('/api/projects/activate',{...guard(),action:'create',name:'../escape',parent:temp})).status,400);
    const other=path.join(temp,'Existing');await fs.mkdir(other);await fs.writeFile(path.join(other,'project.json'),JSON.stringify({name:'Existing project',nodes:[]}));
    const invalid=path.join(temp,'Invalid');await fs.mkdir(invalid);await fs.writeFile(path.join(invalid,'project.json'),JSON.stringify({name:'Invalid',nodes:[{id:'x',name:'Broken',category:'not-a-category'}]}));
    assert.equal((await request('/api/projects/activate',{...guard(),action:'open',directory:invalid})).status,400);assert.equal((await store.selected(config)).directory,current.directory);
    const altered={...current.project,name:'External agent edit'};await fs.writeFile(path.join(current.directory,'project.json'),JSON.stringify(altered));
    assert.equal((await request('/api/projects/activate',{...guard(),action:'open',directory:other})).status,409);
    assert.equal((await request('/api/projects/activate',{...guard(),keepRecovery:true,action:'open',directory:other})).status,200);
    assert.equal((await request('/api/projects/activate',{...guard(),keepRecovery:true,action:'open',directory:current.directory})).status,409);
    const recent=await request('/api/projects');assert.equal(recent.data.projects.length,2);assert.equal(recent.data.projects.filter(p=>p.current).length,1);
    assert.equal(JSON.parse(await fs.readFile(path.join(current.directory,'project.json'),'utf8')).name,'External agent edit','Switching never overwrites the old project');
    await fs.writeFile(path.join(current.directory,'project.json'),'invalid JSON');assert.equal((await manager.list(config)).projects.find(p=>p.directory===current.directory).available,false);
    assert.equal((await request('/api/projects',null,{Origin:'https://untrusted.example'})).status,403);
    console.log('Passed: project management over real HTTP, blank local creation, validated open, recents/search data, existing-folder protection, folder browser routing, stale-tab/revision guards, explicit recovery switching, old-project preservation and local-origin/token checks.');
  }finally{await new Promise(resolve=>server.close(resolve));assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('partmap-manager-test-'));await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
