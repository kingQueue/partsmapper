let projectFolder=null,folderPending=false,folderSaving=null,folderTimer=null,folderBlocked=false,folderLoading=true,browserProjectBeforeFolder=null;
function folderStatus(message,error=false){const status=$('#folderSaveStatus');if(status){status.textContent=message;status.classList.toggle('folder-error',error);}if(projectFolder)$('#saveState').textContent=message;}
async function folderApi(route,body){
  const response=await fetch(route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Partmap-Token':projectFolder.token}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Project folder request failed.'),{status:response.status});return data;
}
function scheduleFolderSave(){if(folderLoading||!projectFolder||folderBlocked)return;folderPending=true;clearTimeout(folderTimer);folderStatus('Saving to project folder…');folderTimer=setTimeout(()=>saveProjectFolder().catch(()=>{}),450);}
function saveProjectFolder(){
  clearTimeout(folderTimer);if(!projectFolder)return Promise.resolve(false);if(folderBlocked)return Promise.reject(Error('Folder saving is paused. Reload the project folder before continuing.'));
  folderPending=true;if(folderSaving)return folderSaving;
  folderSaving=(async()=>{
    while(folderPending){
      folderPending=false;const context=projectFolder,body={workspaceId:context.id,expectedRevision:context.revision,project:exportObject(),brief:brief(),library:{format:'partmap.component-library',version:1,components:allLibraryParts(),customIds:savedComponentLibrary.map(n=>n.id)}};
      const result=await folderApi('/api/workspace/save',body);context.revision=result.revision;folderStatus('Saved to project folder');
    }return true;
  })().catch(error=>{folderBlocked=true;folderPending=false;try{localStorage.setItem('partmap.folder-recovery.'+projectFolder.id,JSON.stringify(project));}catch{}folderStatus(error.message,true);toast(error.message);throw error;}).finally(()=>{folderSaving=null;});
  return folderSaving;
}
function blobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not encode project export.'));reader.readAsDataURL(blob);});}
async function saveFolderExport(blob,name,files=null){
  await saveProjectFolder();const result=await folderApi('/api/workspace/export',{workspaceId:projectFolder.id,name,base64:await blobBase64(blob),files});toast('Saved: '+result.path);folderStatus('Saved export to project folder');return result;
}
const persistBeforeFolder=persist;
persist=function(){persistBeforeFolder();scheduleFolderSave();};
const saveLibraryBeforeFolder=saveLibraryPart;
saveLibraryPart=function(n){const result=saveLibraryBeforeFolder(n);scheduleFolderSave();return result;};
const downloadBlobBeforeFolder=downloadHandoffBlob;
downloadHandoffBlob=function(blob,name){if(folderLoading||folderBlocked){toast('Project folder is not ready. Check the folder status before exporting.');return;}if(!projectFolder)return downloadBlobBeforeFolder(blob,name);return saveFolderExport(blob,name).catch(error=>{if(!folderBlocked)toast(error.message);});};
downloadWorkbenchJSON=function(value,name){return downloadHandoffBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),name);};
const downloadWiringBeforeFolder=downloadWiringHandoff;
downloadWiringHandoff=function(files){if(folderLoading||folderBlocked){toast('Project folder is not ready. Check the folder status before exporting.');return;}if(!projectFolder)return downloadWiringBeforeFolder(files);files=files.map(f=>f.name==='agent-prompt.md'?{...f,text:f.text+'\n## Project-folder workflow\nThese input files are snapshots inside wiring-handoff/. Write the requested output files alongside them. Do not overwrite the parent project.json while Partmap is running. Apply the returned JSON through Update wiring (no new components), then attach the returned requirements file. Keep all generated files inside this selected project folder.\n'}:f);return saveFolderExport(wiringHandoffZip(files),'partmap-wiring-handoff.zip',files).catch(error=>{if(!folderBlocked)toast(error.message);});};
const openWiringBeforeFolder=openAutoWiringHandoff;
openAutoWiringHandoff=function(){openWiringBeforeFolder();if(projectFolder&&$('#downloadWiringPackage')){$('#downloadWiringPackage').textContent='Save package to folder';$('.handoff-explanation').textContent='Saves the ZIP under exports/ and unpacked agent files under wiring-handoff/ in '+projectFolder.directory+'. This exports the task; it does not run an agent automatically.';}};
const updateExportBeforeFolder=updateExport;
updateExport=function(){updateExportBeforeFolder();if(projectFolder)$('#downloadBtn').textContent=exportMode==='json'?'Save JSON to folder':'Save brief to folder';};
function importBrowserProjectToFolder(){
  if(!browserProjectBeforeFolder)return;
  const dialog=createModal('<div class="dialog-heading"><h2>Use browser project?</h2><button class="icon-button" data-dismiss>×</button></div><p>This replaces the selected folder’s active project with the browser project kept before the folder was opened. A disk backup is made before replacing changed data.</p><div class="dialog-actions"><button class="button" data-dismiss>Cancel</button><button id="useBrowserProject" class="button primary">Use browser project</button></div>');
  dialog.querySelector('#useBrowserProject').onclick=()=>{try{project=validate(structuredClone(browserProjectBeforeFolder));selected=project.nodes[0]?.id;enabled=new Set(Object.keys(categories));showWorkbench('map');setView('full');changed('Imported browser project into selected disk folder');dialog.close();}catch(e){toast(e.message);}};dialog.showModal();
}
async function initializeProjectFolder(){
  const banner=document.createElement('section');banner.id='projectFolderBanner';banner.innerHTML='<div><strong id="projectFolderPath">Connecting to local project folder…</strong><small id="folderSaveStatus">Browser data is kept as a backup.</small></div><button class="button" id="saveFolderNow">Save now</button><button class="button" id="reloadFolder">Reload folder</button><button class="button" id="importBrowserProject" hidden>Use browser project</button>';$('header').after(banner);
  $('#autoCompleteWiring').onclick=()=>openAutoWiringHandoff();
  $('#saveFolderNow').onclick=()=>saveProjectFolder().catch(error=>toast(error.message));$('#reloadFolder').onclick=()=>location.reload();$('#importBrowserProject').onclick=importBrowserProjectToFolder;
  $('#downloadBtn').onclick=()=>downloadHandoffBlob(new Blob([$('#exportPreview').textContent],{type:exportMode==='json'?'application/json':'text/markdown'}),project.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+(exportMode==='json'?'-project.json':'-ai-brief.md'));
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[download]');if(!projectFolder||!anchor)return;event.preventDefault();
    const name=anchor.getAttribute('download')||new URL(anchor.href,location.href).pathname.split('/').pop();fetch(anchor.href).then(r=>{if(!r.ok)throw Error('Could not read the reference file.');return r.blob();}).then(blob=>saveFolderExport(blob,name)).catch(error=>toast(error.message));
  },true);
  try{
    const context=await folderApi('/api/workspace');
    if(!context.directory){$('#projectFolderPath').textContent='Browser-only mode — choose or create a project folder from Partmap Server on your desktop.';$('#saveFolderNow').disabled=true;$('#reloadFolder').hidden=true;folderLoading=false;return;}
    const loaded=validate(context.project);browserProjectBeforeFolder=structuredClone(project);
    // Save a recovery copy before replacing this browser's cached project.
    const previousFolder=localStorage.getItem('partmap.activeFolderId.v1')||'browser';localStorage.setItem('partmap.folder-recovery.'+previousFolder,JSON.stringify(project));localStorage.setItem('partmap.activeFolderId.v1',context.id);
    projectFolder=context;project=loaded;
    if(!project.requirementsDocument)project.requirementsDocument={name:'missing-requirements.md',markdown:requirementsMarkdown(project),updatedAt:new Date().toISOString()};
    savedComponentLibrary=[];if(context.library?.components){const customIds=context.library.customIds;savedComponentLibrary=context.library.components.filter(n=>customIds?customIds.includes(n.id):!defaultComponentLibrary.some(b=>b.id===n.id)).map(checkedTemplate);}localStorage.setItem(LIBRARY_KEY,JSON.stringify(savedComponentLibrary));
    selected=project.nodes[0]?.id;enabled=new Set(Object.keys(categories));mapSelection.clear();pcbSelection.clear();showWorkbench('map');setView('full');
    $('#projectFolderPath').textContent=context.directory;$('.rail-bottom small').textContent='Saved in project folder';$('#importBrowserProject').hidden=!browserProjectBeforeFolder.nodes.length;
    folderLoading=false;persist();await saveProjectFolder();
  }catch(error){folderLoading=false;folderBlocked=true;$('#projectFolderPath').textContent='Project folder could not be loaded';folderStatus(error.message,true);toast(error.message);}
}
initializeProjectFolder();
