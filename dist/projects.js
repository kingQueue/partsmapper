async function openProjectManager(){
  const dialog=createModal(`<div class="dialog-heading"><div><div class="eyebrow">LOCAL WORKSPACES</div><h2>Your projects</h2></div><button class="icon-button" data-dismiss aria-label="Close projects">×</button></div><p>Open a project folder or create a new one. Project data, references and exports stay together on your computer.</p><p id="managerCurrent" class="project-current"></p><div id="managerRecovery" class="project-recovery" hidden><strong>Saving is paused.</strong><p>Your browser edits can be kept as a recovery copy before switching.</p><label><input id="switchWithRecovery" type="checkbox"> Keep a browser recovery copy and switch without saving</label></div><div class="project-manager-grid"><section><h3>Recent projects</h3><label>Find a project<input id="projectSearch" placeholder="Search by name or folder"></label><div id="recentProjects" class="recent-projects">Loading projects…</div></section><section><h3>Open a project folder</h3><p class="muted">Choose the folder containing project.json.</p><label>Project folder<div class="project-path-field"><input id="openProjectDirectory" placeholder="D:\\my-project"><button class="button" id="browseOpenProject" type="button">Browse…</button></div></label><button class="button" id="openLocalProject">Open project</button><hr><h3>Create a project</h3><label>Project name<input id="newProjectName" maxlength="100" placeholder="My robot"></label><label>Save in<div class="project-path-field"><input id="newProjectParent"><button class="button" id="browseProjectParent" type="button">Browse…</button></div></label><p id="newProjectLocation" class="project-location"></p><button class="button primary" id="createLocalProject">Create project</button></section></div><div id="projectManagerError" role="alert"></div><p id="projectManagerProgress" role="status"></p>`);
  dialog.classList.add('project-manager-dialog');dialog.showModal();
  const find=s=>dialog.querySelector(s);let listing=null,working=false;
  function error(message){find('#projectManagerError').textContent=message;}
  function loading(value,message=''){working=value;for(const button of dialog.querySelectorAll('button:not([data-dismiss])'))button.disabled=value;find('#projectManagerProgress').textContent=message;if(!value&&listing)renderRecentProjects();}
  function renderRecentProjects(){
    const term=find('#projectSearch').value.toLowerCase(),rows=listing.projects.filter(p=>(p.name+' '+p.directory).toLowerCase().includes(term));
    find('#recentProjects').innerHTML=rows.length?rows.map((p,i)=>`<article class="recent-project"><div><strong>${esc(p.name)}</strong><small>${esc(p.directory)}</small><span>${p.available?p.components+' component'+(p.components===1?'':'s'):esc('Unavailable: '+p.error)}</span></div><button class="button" data-open-recent="${i}" ${working||!p.available||p.current?'disabled':''}>${p.current?'Current':'Open'}</button></article>`).join(''):'<p class="muted">No matching projects. Browse to an existing folder or create your first project.</p>';
    for(const button of dialog.querySelectorAll('[data-open-recent]'))button.onclick=()=>switchProject({action:'open',directory:rows[Number(button.dataset.openRecent)].directory});
  }
  function preview(){const parent=find('#newProjectParent').value.trim().replace(/[\\/]$/,''),name=find('#newProjectName').value.trim();find('#newProjectLocation').textContent=name?'New folder: '+parent+(parent.includes('\\')?'\\':'/')+name:'A new folder will be created for this project.';}
  async function switchProject(action){
    if(working)return;error('');loading(true,'Saving your current project…');
    try{
      if(folderLoading)throw Error('The current project is still loading. Please wait a moment.');
      const keepRecovery=find('#switchWithRecovery').checked;
      if(folderBlocked&&!keepRecovery)throw Error('Saving is paused. Reload the current project, or check the recovery option above before switching.');
      if(projectFolder&&!folderBlocked)await saveProjectFolder();
      localStorage.setItem('partmap.folder-recovery.'+(projectFolder?.id||'browser'),JSON.stringify(project));
      const context=projectFolder||{id:listing.currentId,directory:listing.currentDirectory};
      const result=await folderApi('/api/projects/activate',{...action,currentId:context.id||null,currentDirectory:context.directory||null,currentRevision:projectFolder?.revision,keepRecovery});
      folderLoading=true;clearTimeout(folderTimer);folderPending=false;find('#projectManagerProgress').textContent='Opening '+result.name+'…';location.reload();
    }catch(e){error(e.message);find('#managerRecovery').hidden=!folderBlocked;loading(false);}
  }
  let folderPicker=null,folderTarget=null,folderState=null;
  function closeFolderPicker(){if(folderPicker)folderPicker.hidden=true;dialog.querySelector('.project-manager-grid').hidden=false;}
  async function navigateFolder(directory){
    if(working)return;error('');loading(true,'Loading folders...');
    try{
      const next=await folderApi('/api/projects/folders',{directory});folderState=next;
      folderPicker.querySelector('#folderAddress').value=next.directory;
      folderPicker.querySelector('#folderDrives').innerHTML=next.drives.map((d,i)=>`<button class="button" data-drive="${i}">${esc(d.name)}</button>`).join('');
      folderPicker.querySelector('#folderEntries').innerHTML=next.entries.length?next.entries.map((d,i)=>`<button class="folder-entry" data-directory="${i}"><span aria-hidden="true">&#128193;</span><span>${esc(d.name)}</span><span aria-hidden="true">&rsaquo;</span></button>`).join(''):'<p class="muted">No subfolders here. You can use this folder or go up.</p>';
      for(const button of folderPicker.querySelectorAll('[data-drive]'))button.onclick=()=>navigateFolder(folderState.drives[Number(button.dataset.drive)].directory);
      for(const button of folderPicker.querySelectorAll('[data-directory]'))button.onclick=()=>navigateFolder(folderState.entries[Number(button.dataset.directory)].directory);
      folderPicker.querySelector('#folderUp').onclick=()=>folderState.parent&&navigateFolder(folderState.parent);
      folderPicker.querySelector('#useSelectedFolder').onclick=()=>{find(folderTarget).value=folderState.directory;preview();closeFolderPicker();};
    }catch(e){if(folderState)folderPicker.querySelector('#folderAddress').value=folderState.directory;error('Could not browse that folder: '+e.message);}
    finally{loading(false);folderPicker.querySelector('#folderUp').disabled=!folderState?.parent;folderPicker.querySelector('#useSelectedFolder').disabled=!folderState;}
  }
  async function browse(target){
    if(working)return;folderTarget=target;
    if(!folderPicker){
      folderPicker=document.createElement('section');folderPicker.className='project-folder-picker';folderPicker.setAttribute('aria-label','Local folder browser');
      folderPicker.innerHTML='<h3 id="folderPickerTitle">Choose a folder</h3><div id="folderDrives" class="folder-drives"></div><div class="folder-address"><button class="button" id="folderUp" type="button">Up</button><input id="folderAddress" aria-label="Folder location"><button class="button" id="folderGo" type="button">Go</button></div><div id="folderEntries" class="folder-entries"></div><div class="folder-picker-actions"><button class="button" id="cancelFolderBrowse" type="button">Cancel</button><button class="button primary" id="useSelectedFolder" type="button">Use this folder</button></div>';
      dialog.querySelector('.project-manager-grid').before(folderPicker);
      folderPicker.querySelector('#cancelFolderBrowse').onclick=closeFolderPicker;
      folderPicker.querySelector('#folderGo').onclick=()=>navigateFolder(folderPicker.querySelector('#folderAddress').value);
      folderPicker.querySelector('#folderAddress').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();navigateFolder(e.target.value);}};
    }
    folderPicker.hidden=false;folderPicker.querySelector('#folderPickerTitle').textContent=target==='#openProjectDirectory'?'Open a project folder':'Choose where to save your project';
    dialog.querySelector('.project-manager-grid').hidden=true;
    await navigateFolder(find(target).value||listing.currentDirectory||listing.defaultParent);
  }
  find('#openLocalProject').onclick=()=>switchProject({action:'open',directory:find('#openProjectDirectory').value});
  find('#createLocalProject').onclick=()=>switchProject({action:'create',name:find('#newProjectName').value,parent:find('#newProjectParent').value});
  find('#browseOpenProject').onclick=()=>browse('#openProjectDirectory');find('#browseProjectParent').onclick=()=>browse('#newProjectParent');
  find('#newProjectName').oninput=preview;find('#newProjectParent').oninput=preview;find('#projectSearch').oninput=()=>listing&&renderRecentProjects();
  try{
    listing=await folderApi('/api/projects');folderToken=listing.token;
    find('#managerCurrent').textContent='Active folder: '+(listing.currentDirectory||'Browser-only project');find('#newProjectParent').value=listing.defaultParent;
    find('#managerRecovery').hidden=!folderBlocked;preview();renderRecentProjects();

  }catch(e){error('Local project management is unavailable. Run Partmap using its local server. '+e.message);for(const button of dialog.querySelectorAll('button:not([data-dismiss])'))button.disabled=true;}
}
function initializeProjectManager(){
  const navigation=document.createElement('button');navigation.id='projectsNav';navigation.className='rail-item';navigation.innerHTML='▱ <span>Projects</span>';navigation.onclick=openProjectManager;$('#mapNav').before(navigation);
  const button=document.createElement('button');button.id='manageProjects';button.className='button';button.textContent='Projects';button.onclick=openProjectManager;$('#importBtn').before(button);
}
initializeProjectManager();
