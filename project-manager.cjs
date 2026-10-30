const fs=require('fs/promises'),path=require('path'),os=require('os'),{execFile}=require('child_process');
const store=require('./project-store.cjs'),model=require('./mcp/model.cjs');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const home=path.join(os.homedir(),'Documents','Partmap Projects');
const registryFile=config=>path.join(path.dirname(config),'recent-projects.json');
async function registry(config){try{const data=JSON.parse(await fs.readFile(registryFile(config),'utf8'));return Array.isArray(data)?data:[];}catch(error){if(error.code==='ENOENT')return [];throw error;}}
async function remember(config,entry){
  const previous=await registry(config),next=[{...entry,lastOpened:new Date().toISOString()},...previous.filter(p=>p.directory.toLowerCase()!==entry.directory.toLowerCase())].slice(0,24);
  const file=registryFile(config);await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+require('crypto').randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(next,null,2));await fs.rename(temp,file);
}
async function describe(directory){
  try{const canonical=await fs.realpath(directory),file=await store.safePath(canonical,'project.json'),project=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));model.validate(project);return {directory:canonical,name:project.name,components:project.nodes.length,available:true};}
  catch(error){return {directory,name:path.basename(directory),available:false,error:error.message};}
}
async function list(config){
  let current=null,currentError=null;try{current=await store.selected(config);}catch(error){currentError=error.message;}
  const recent=await registry(config),paths=[...(current?[current.directory]:[]),...recent.map(p=>p.directory)],unique=[...new Map(paths.map(p=>[p.toLowerCase(),p])).values()];
  const projects=await Promise.all(unique.map(async directory=>({...await describe(directory),lastOpened:recent.find(p=>p.directory.toLowerCase()===directory.toLowerCase())?.lastOpened||null,current:current?.directory.toLowerCase()===directory.toLowerCase()})));
  return {projects,currentId:current?.id||null,currentDirectory:current?.directory||null,currentError,defaultParent:home,nativeBrowse:process.platform==='win32'};
}
function absolute(value){if(typeof value!=='string'||!value.trim()||!path.isAbsolute(value.trim()))throw fail('Enter an absolute local folder path.');return path.resolve(value.trim());}
async function checkCurrent(config,body){
  let current;try{current=await store.selected(config);}catch{current=null;}
  if((current?.id||null)!==(body.currentId||null)||(current?.directory||null)!==(body.currentDirectory||null))throw fail('The active project changed in another window. Reload before switching projects.',409);
  if(current&&!body.keepRecovery){const snapshot=await store.readWorkspace(config);if(snapshot.revision!==body.currentRevision)throw fail('The current files changed on disk. Reload them, or explicitly keep a browser recovery copy and switch without saving.',409);}
}
async function activate(config,body){
  await checkCurrent(config,body);const previous=await store.selected(config).catch(()=>null);let directory;
  if(body.action==='create'){
    const name=store.leaf(body.name?.trim());const parent=absolute(body.parent);
    if(parent===home)await fs.mkdir(parent,{recursive:true});
    if(!(await fs.stat(parent)).isDirectory())throw fail('Choose an existing parent directory.');
    directory=path.join(parent,name);
    try{await fs.lstat(directory);throw fail('That directory already exists. Open it as an existing project, or use a different name.',409);}catch(error){if(error.code!=='ENOENT')throw error;}
    await fs.mkdir(directory); // Exclusive creation prevents replacing an existing folder.
    await store.selectProject(directory,{create:true,name,config});
  }else if(body.action==='open'){
    directory=absolute(body.directory);const project=await describe(directory);if(!project.available)throw fail('Cannot open this project: '+project.error);
    await store.selectProject(project.directory,{config});
  }else throw fail('Choose create or open.');
  const entry=await describe(directory);try{if(previous&&previous.directory!==entry.directory){const old=await describe(previous.directory);if(old.available)await remember(config,old);}await remember(config,entry);}catch(error){entry.warning='Project opened, but recent history could not be saved: '+error.message;}return entry;
}
async function browseFolder(initialDirectory){
  if(process.platform!=='win32')throw fail('Native browsing is available on Windows. Enter the folder path instead.');
  const initial=initialDirectory?absolute(initialDirectory):home;
  return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'Partmap-Pick-Folder.ps1')],{windowsHide:true,encoding:'utf8',timeout:300000,env:{...process.env,PARTMAP_PICK_INITIAL:initial}},(error,stdout)=>{
    if(error)return reject(fail('Folder browser could not open. Enter the path manually. '+error.message));
    try{resolve(JSON.parse(stdout.trim().replace(/^\uFEFF/,'')));}catch{reject(fail('The folder browser returned an invalid response. Enter the path manually.'));}
  }));
}
module.exports={list,activate,browseFolder,describe};
