const fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
const wiringContext=require('./dist/wiring-context.js');
const DEFAULT_CONFIG=path.join(__dirname,'.partmap-runtime','project-selection.json');
function problem(message,status=400){return Object.assign(new Error(message),{status});}
function leaf(name){if(typeof name!=='string'||!name||name.length>160||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^\.{1,2}$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw problem('Invalid project filename.');return name;}
async function optional(file){try{return await fs.readFile(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function safePath(root,relative){
  const parts=relative.split('/');parts.forEach(leaf);let current=root;
  for(const part of parts){current=path.join(current,part);try{if((await fs.lstat(current)).isSymbolicLink())throw problem('Project files cannot be symbolic links or junctions.');}catch(e){if(e.code!=='ENOENT')throw e;}}
  return current;
}
async function atomic(root,relative,data){const file=await safePath(root,relative);await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,data,{flag:'wx'});try{await fs.rename(temp,file);}catch(e){await fs.unlink(temp).catch(()=>{});throw e;}}
async function jsonFile(file){const bytes=await optional(file);return bytes?JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')):null;}
async function selected(config=DEFAULT_CONFIG){
  const configData=await jsonFile(config);if(!configData?.directory)return null;
  const directory=await fs.realpath(configData.directory),marker=await jsonFile(await safePath(directory,'.partmap-project.json'));
  if(!marker?.id)throw problem('Selected folder is not a Partmap project. Open it from the CMD menu again.',409);
  await fs.mkdir(path.dirname(config),{recursive:true});const temp=config+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify({directory},null,2));await fs.rename(temp,config);
  return {directory,id:marker.id};
}
async function revision(workspace,files=['project.json','missing-requirements.md','component-library.json']){const hash=crypto.createHash('sha256');for(const file of files){hash.update(file);hash.update(await optional(await safePath(workspace.directory,file))||'');}return hash.digest('hex');}
async function readWorkspace(config=DEFAULT_CONFIG){
  const workspace=await selected(config);if(!workspace)return {directory:null};
  const project=await jsonFile(await safePath(workspace.directory,'project.json'));if(!project||!Array.isArray(project.nodes))throw problem('The selected project.json is missing or invalid. Restore a backup before saving.',409);
  const md=await optional(await safePath(workspace.directory,'missing-requirements.md'));
  if(md){const stat=await fs.stat(path.join(workspace.directory,'missing-requirements.md')),projectStat=await fs.stat(path.join(workspace.directory,'project.json')),text=md.toString('utf8');if(!project.requirementsDocument||project.requirementsDocument.markdown===text||stat.mtimeMs>=projectStat.mtimeMs)project.requirementsDocument={name:'missing-requirements.md',markdown:text,updatedAt:project.requirementsDocument?.markdown===text?project.requirementsDocument.updatedAt:stat.mtime.toISOString()};}
  return {...workspace,revision:await revision(workspace),projectRevision:await revision(workspace,['project.json','missing-requirements.md']),project,library:await jsonFile(await safePath(workspace.directory,'component-library.json'))};
}
const lastBackup=new Map();
async function saveWorkspace(config,body){
  const workspace=await selected(config);if(!workspace||workspace.id!==body.workspaceId)throw problem('The selected project folder changed. Reload before saving.',409);
  if(body.expectedRevision!==await revision(workspace))throw problem('Files changed on disk, possibly in another tab or by an agent. Reload the folder before saving; your browser backup is retained.',409);
  if(!body.project||typeof body.project.name!=='string'||!Array.isArray(body.project.nodes)||body.project.nodes.length>300||typeof body.brief!=='string')throw problem('Invalid project save.');
  const projectText=JSON.stringify(body.project,null,2),previous=await optional(await safePath(workspace.directory,'project.json'));
  if(previous&&previous.toString('utf8')!==projectText&&Date.now()-(lastBackup.get(workspace.id)||0)>60000){await atomic(workspace.directory,`.partmap/backups/project-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,previous);lastBackup.set(workspace.id,Date.now());}
  await atomic(workspace.directory,'project.json',projectText);
  await atomic(workspace.directory,'wiring-context.json',wiringContext.text(body.project));
  await atomic(workspace.directory,'ai-brief.md',body.brief);
  await atomic(workspace.directory,'missing-requirements.md',body.project.requirementsDocument?.markdown||'# Missing requirements\n\nNo review has been attached yet. Inspect project.json before completing wiring.\n');
  await atomic(workspace.directory,'component-library.json',JSON.stringify(body.library||{format:'partmap.component-library',version:1,components:[]},null,2));
  await atomic(workspace.directory,'pcb-sketch.json',JSON.stringify({format:'partmap.pcb-sketch',version:1,pcb:body.project.pcb||null,manufacturingReady:false},null,2));
  const references=[];
  for(const n of body.project.nodes)for(const [index,a] of (n.attachments||[]).entries()){
    const match=typeof a.data==='string'&&a.data.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);if(!match)continue;
    const folder=crypto.createHash('sha256').update(n.id).digest('hex').slice(0,16),name=('reference-'+index+'-'+String(a.name||'file').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'')).slice(0,140);
    const relative=`references/${folder}/${name}`;await atomic(workspace.directory,relative,Buffer.from(match[2],'base64'));references.push({componentId:n.id,component:n.name,name:a.name,path:relative,type:match[1]});
  }
  await atomic(workspace.directory,'references/index.json',JSON.stringify(references,null,2));
  return {directory:workspace.directory,id:workspace.id,revision:await revision(workspace),projectRevision:await revision(workspace,['project.json','missing-requirements.md'])};
}
async function readLibraryState(config,workspaceId){
  const workspace=await selected(config);if(!workspace||workspace.id!==workspaceId)throw problem('Selected project changed. Reload before refreshing the library.',409);
  const names=['project.json','missing-requirements.md','component-library.json'];
  const first=await Promise.all(names.map(async name=>await optional(await safePath(workspace.directory,name))||Buffer.alloc(0)));
  const second=await Promise.all(names.map(async name=>await optional(await safePath(workspace.directory,name))||Buffer.alloc(0)));
  if(first.some((bytes,i)=>!bytes.equals(second[i])))throw problem('Files changed during library refresh. Try again after the write finishes.',409);
  const digest=indices=>{const h=crypto.createHash('sha256');for(const i of indices){h.update(names[i]);h.update(first[i]);}return h.digest('hex');};
  return {id:workspace.id,library:first[2].length?JSON.parse(first[2].toString('utf8').replace(/^\uFEFF/,'')):null,libraryRevision:crypto.createHash('sha256').update(first[2]).digest('hex'),projectRevision:digest([0,1]),revision:digest([0,1,2])};
}
async function saveExport(config,body){
  const workspace=await selected(config);if(!workspace||workspace.id!==body.workspaceId)throw problem('The selected project folder changed. Reload before exporting.',409);
  const name=leaf(body.name);if(typeof body.base64!=='string'||!/^[A-Za-z0-9+/=]*$/.test(body.base64))throw problem('Invalid export data.');
  if(body.files){
    const allowed=new Set(['project.json','agent-prompt.md','agent-command.txt','missing-requirements.md','README.md','wiring-context.json']);
    if(!Array.isArray(body.files)||![5,6].includes(body.files.length)||new Set(body.files.map(f=>f.name)).size!==body.files.length||!['project.json','agent-prompt.md','agent-command.txt','missing-requirements.md','README.md'].every(name=>body.files.some(f=>f.name===name))||body.files.some(f=>!allowed.has(f.name)||typeof f.text!=='string'))throw problem('Invalid wiring handoff files.');
  }
  await atomic(workspace.directory,'exports/'+name,Buffer.from(body.base64,'base64'));
  if(body.files)for(const f of body.files)await atomic(workspace.directory,'wiring-handoff/'+f.name,f.text);
  return {path:path.join(workspace.directory,'exports',name)};
}
async function selectProject(directory,{create=false,name,config=DEFAULT_CONFIG}={}){
  directory=path.resolve(directory);if(create)await fs.mkdir(directory,{recursive:true});directory=await fs.realpath(directory);
  const markerPath=await safePath(directory,'.partmap-project.json');let marker=await jsonFile(markerPath);
  const projectPath=await safePath(directory,'project.json'),existing=await jsonFile(projectPath);
  if(existing&&(!Array.isArray(existing.nodes)||typeof existing.name!=='string'))throw problem('This project.json is not a Partmap project. No files were replaced.');
  if(!existing&&!create)throw problem('Choose a folder containing project.json, or use Create new project.');
  if(!existing){const project={schemaVersion:'2.0',name:name||path.basename(directory),nodes:[],baseline:[],history:[],partsChecklist:[],pcb:null,requirementsDocument:null,wiringTask:null};await atomic(directory,'project.json',JSON.stringify(project,null,2));}
  await atomic(directory,'wiring-context.json',wiringContext.text(existing||{name:name||path.basename(directory),nodes:[]}));
  if(!marker){marker={format:'partmap.project-folder',version:1,id:crypto.randomUUID(),createdAt:new Date().toISOString()};await atomic(directory,'.partmap-project.json',JSON.stringify(marker,null,2));}
  await atomic(directory,'PROJECT-README.md','# Partmap project folder\n\nproject.json is the main project. The app autosaves it here. wiring-context.json is the compact electrical view, refreshed with each app save. ai-brief.md, missing-requirements.md, component-library.json and pcb-sketch.json are also refreshed with saves. Reference uploads are extracted under references/. Exports go under exports/. Auto complete wiring also writes an unpacked wiring-handoff/ folder for agents.\n\nAgents: read wiring-handoff/agent-prompt.md and wiring-context.json first when present. Handoffs are snapshots: re-export after changing boards or pins. Connected agents use parts_wiring_context then parts_connect and parts_validate on the same source path, without reading or reconstructing full JSON. Never replace project.json with the compact view. Write results alongside those snapshots, without adding component copies; apply results through Update wiring in the app. Do not overwrite the root project.json while the browser is editing it. Disk conflicts are detected rather than silently overwritten. Backups are kept under .partmap/backups/.\n');
  await fs.mkdir(path.dirname(config),{recursive:true});const temp=config+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify({directory},null,2));await fs.rename(temp,config);
  return {directory,id:marker.id};
}
module.exports={DEFAULT_CONFIG,readLibraryState,selected,readWorkspace,saveWorkspace,saveExport,selectProject,leaf,safePath};
if(require.main===module){const [action,directory,...name]=process.argv.slice(2);(async()=>{if(action==='status')console.log(JSON.stringify(await selected()));else if(['create','open'].includes(action)&&directory)console.log(JSON.stringify(await selectProject(directory,{create:action==='create',name:name.join(' ')})));else throw Error('Usage: node project-store.cjs create|open <directory> [project name], or status');})().catch(e=>{console.error(e.message);process.exitCode=1;});}
