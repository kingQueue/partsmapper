const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map(),storage=new Map(),el=s=>{if(!elements.has(s))elements.set(s,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:''});return elements.get(s);};
const requests=[];let releaseFirst,requestNumber=0;
const ctx={document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},structuredClone,crypto:require('crypto').webcrypto,console,setTimeout:()=>1,clearTimeout(){},performance,TextEncoder,Blob,fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body),headers:options.headers});requestNumber++;if(requestNumber===1)await new Promise(resolve=>releaseFirst=resolve);const revision='revision-'+requestNumber;return {ok:true,json:async()=>({revision})};}};
vm.createContext(ctx);for(const name of ['app','studio','hardware','clipboard','workbench','assembly','wiring-context','wiring-handoff','wiring-guard','project-folder'])vm.runInContext(fs.readFileSync(`dist/${name}.js`,'utf8').replace(/\n(?:render\(\)|initializeHardware\(\)|initializeComponentClipboard\(\)|initializeWorkbench\(\)|initializeAssembly\(\)|initializeWiringHandoff\(\)|initializeProjectFolder\(\));\s*$/,''),ctx);
const run=s=>vm.runInContext(s,ctx);
(async()=>{
  run('projectFolder={id:"folder-a",token:"test-token",revision:"initial",directory:"C:/Project"};folderLoading=false;const saving=saveProjectFolder();project.name="Changed during save";persist();');
  releaseFirst();await run('saving');
  assert.equal(requests.length,2);assert.equal(requests[0].headers['X-Partmap-Token'],'test-token');assert.equal(requests[0].body.expectedRevision,'initial');assert.equal(requests[1].body.expectedRevision,'revision-1');assert.equal(requests[1].body.project.name,'Changed during save');assert.equal(requests[1].body.project.nodes.length,7);assert.ok(requests[1].body.brief.includes('Changed during save'));assert.ok(requests[1].body.library.components.length>=6);
  ctx.fetch=async()=>({ok:false,status:409,json:async()=>({error:'Agent changed files on disk'})});await assert.rejects(()=>run('saveProjectFolder()'),/Agent changed/);
  assert.equal(run('folderBlocked'),true);assert.ok(storage.has('partmap.folder-recovery.folder-a'));await assert.rejects(()=>run('saveProjectFolder()'),/paused/);
  run('downloadHandoffBlob(new Blob(["test"]),"test.md")');assert.ok(el('#toast').textContent.includes('not ready'));
  console.log('Passed: queued disk autosaves preserve edits made during a save, revision chaining, exported brief/library snapshots, external-edit conflicts pause writes, browser recovery, and blocked exports do not fall back to Downloads.');
})().catch(error=>{console.error(error);process.exitCode=1;});
