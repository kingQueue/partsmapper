const fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
const store=require('./project-store.cjs'),roles=require('./mcp/wiring-edits.cjs');
const connector=path.join(__dirname,'.partmap-runtime','character-room-auto-wire.json');
async function bridge(action,body={}){
  let config;try{config=JSON.parse(await fs.readFile(connector,'utf8'));}catch{throw Error('Start Character Room and grant an agent Auto wire listen, then try again.');}
  const url=new URL(config.url);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||!config.token)throw Error('Invalid local Character Room connector.');
  const response=await fetch(new URL('/api/auto-wire/'+action,url),{method:action==='listeners'||action.startsWith('jobs/')?'GET':'POST',headers:{'Content-Type':'application/json','X-Character-Room':'1','X-Auto-Wire-Token':config.token},body:action==='listeners'||action.startsWith('jobs/')?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Character Room request failed.'),{status:response.status});return result;
}
async function readResult(directory,project){
  const file=await store.safePath(directory,'complete-wiring.json');let bytes;
  try{const stat=await fs.stat(file);if(stat.size>1024*1024)throw Error('complete-wiring.json exceeds 1 MB.');bytes=await fs.readFile(file);}catch(e){if(e.code==='ENOENT')return {found:false};throw e;}
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  try{
    const data=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
    if(data.format!=='partmap.wiring-edits'||!Array.isArray(data.connections)||!Array.isArray(data.blocked)||!Array.isArray(data.assumptions)||data.connections.length>1024)throw Error('Expected partmap.wiring-edits with connections, blocked and assumptions arrays.');
    const nodes=new Map(project.nodes.map(n=>[n.id,n])),routes=[],issues=[],seen=new Set();
    for(const [index,c] of data.connections.entries()){
      const a=nodes.get(c.from?.component),b=nodes.get(c.to?.component),p=a?.pins?.find(p=>p.id===c.from.pin),q=b?.pins?.find(p=>p.id===c.to.pin);
      if(!p||!q||a===b){issues.push({index,message:'Unknown endpoint IDs or same-component connection; route cannot be drawn.'});continue;}
      const key=JSON.stringify([[a.id,p.id],[b.id,q.id]].sort());if(seen.has(key)){issues.push({index,message:'Duplicate route skipped.'});continue;}seen.add(key);
      const issue=roles.review({nodes:[{...a,connections:[{target:b.id,localPinId:p.id,remotePinId:q.id}]},{...b,connections:[]} ]})[0]?.needed||null;
      routes.push({from:c.from,to:c.to,reason:String(c.reason||''),issue});if(issue)issues.push({index,message:issue});
    }
    return {found:true,path:file,sha256,routes,issues,blocked:data.blocked,assumptions:data.assumptions,unapplied:true};
  }catch(error){return {found:true,path:file,sha256,routes:[],issues:[{message:error.message}],invalid:true,unapplied:true};}
}
async function workspaceResult(config,workspaceId){const w=await store.readWorkspace(config);if(!w.directory||w.id!==workspaceId)throw Error('Selected project changed. Reload before checking wiring.');return readResult(w.directory,w.project);}
module.exports={bridge,readResult,workspaceResult,connector};
