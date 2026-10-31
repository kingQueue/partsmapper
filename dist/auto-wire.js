let drawingCompletedWiring=false;
let completedWiring=null,completedWiringWorkspaceId=null,completedWiringSignature='',autoWireJob=null,checkingCompletedWiring=false;
const wireRecordsBeforeCompleteFile=wireRecords;
wireRecords=function(){
  const saved=wireRecordsBeforeCompleteFile();if(!drawingCompletedWiring||view!=='wiring'||!completedWiring||typeof projectFolder==='undefined'||projectFolder?.id!==completedWiringWorkspaceId)return saved;
  const seen=new Set(saved.map(w=>JSON.stringify([[w.source.id,w.connection.localPinId],[w.target.id,w.connection.remotePinId]].sort())));
  const overlay=completedWiring.routes.flatMap((r,i)=>{
    const source=node(r.from.component),target=node(r.to.component),a=source?.pins.find(p=>p.id===r.from.pin),b=target?.pins.find(p=>p.id===r.to.pin);
    if(!a||!b)return [];const pair=JSON.stringify([[source.id,a.id],[target.id,b.id]].sort());if(seen.has(pair))return [];seen.add(pair);
    return [{source,target,index:-1,key:'complete-file:'+i,proposalIssue:r.issue,connection:{target:target.id,localPinId:a.id,remotePinId:b.id,local:pinLabel(source,a),remote:pinLabel(target,b)}}];
  });return [...saved,...overlay];
};
const openWireActionsBeforeCompleteFile=openWireActions;
openWireActions=function(key){if(!key.startsWith('complete-file:'))return openWireActionsBeforeCompleteFile(key);const r=completedWiring?.routes[Number(key.split(':')[1])];if(r)toast((r.issue?'Needs review: '+r.issue+' ':'')+(r.reason||'Route from complete-wiring.json')+' Edit the result file to change this overlay.');};
const removeWireBeforeCompleteFile=removeWire;
removeWire=function(key){if(key.startsWith('complete-file:')){toast('This route comes from complete-wiring.json. Edit that file to change it.');return;}return removeWireBeforeCompleteFile(key);};
const renderGraphBeforeCompleteFile=renderGraph;
renderGraph=function(){drawingCompletedWiring=true;try{renderGraphBeforeCompleteFile();}finally{drawingCompletedWiring=false;}if(view==='wiring'&&completedWiring){for(const [i,r] of completedWiring.routes.entries()){const group=document.querySelector(`[data-wire-key="complete-file:${i}"] .wire-line`);if(group){group.setAttribute('stroke-dasharray','6 3');if(r.issue)group.setAttribute('stroke','#d34f4f');}}}};
function completeWiringStatus(text){let banner=document.querySelector('#completedWiringStatus');if(!banner){banner=document.createElement('section');banner.id='completedWiringStatus';banner.className='handoff-explanation';banner.innerHTML='<span></span><details hidden><summary>Review file details</summary><pre style="max-height:220px;overflow:auto;white-space:pre-wrap"></pre></details>';document.querySelector('.map-toolbar').after(banner);}banner.querySelector('span').textContent=text;}
async function checkCompletedWiring(){
  if(typeof projectFolder==='undefined'||!projectFolder||folderLoading||folderBlocked||folderPending||folderSaving||checkingCompletedWiring)return null;
  checkingCompletedWiring=true;const context=projectFolder;
  try{
    const result=await folderApi('/api/workspace/wiring-result',{workspaceId:context.id});if(context!==projectFolder)return null;
    const signature=context.id+':'+(result.sha256||'missing')+':'+JSON.stringify(result.issues||[])+':'+JSON.stringify(project.nodes.map(n=>[n.id,n.pins.map(p=>p.id)]));
    if(signature!==completedWiringSignature){completedWiringSignature=signature;completedWiring=result.found?result:null;completedWiringWorkspaceId=context.id;
      completeWiringStatus(result.found?`complete-wiring.json: ${result.routes.length} routes · ${result.issues.length} review issue(s) · ${(result.blocked||[]).length} blocker(s). Dashed routes are a file overlay; flagged routes are red. Project boards and source wiring are preserved.`:'No complete-wiring.json in the selected folder. Auto complete wiring can request a listening agent.');
      const details=document.querySelector('#completedWiringStatus details');details.hidden=!result.found;if(result.found)details.querySelector('pre').textContent=JSON.stringify({issues:result.issues,blocked:result.blocked||[],assumptions:result.assumptions||[]},null,2);
      if(view==='wiring')renderGraph();
    }return result;
  }catch(e){completeWiringStatus(e.message);return null;}finally{checkingCompletedWiring=false;}
}
const autoWiringBeforeListen=openAutoWiringHandoff;
openAutoWiringHandoff=async function(){
  if(typeof projectFolder==='undefined'||!projectFolder)return autoWiringBeforeListen();
  try{
    const found=await folderApi('/api/workspace/wiring-result',{workspaceId:projectFolder.id});
    if(found?.found){alert('complete-wiring.json already exists in '+projectFolder.directory+'. Its routes are available in Wiring. No agent request was sent and no file was overwritten.');return;}
    await saveProjectFolder();
    const dialog=createModal('<div class="dialog-heading"><h2>Auto complete wiring</h2><button class="icon-button" data-dismiss>×</button></div><label>Agent prompt<textarea id="autoWireExactPrompt" readonly rows="12"></textarea></label><p id="autoWireAgentStatus">Checking Character Room listeners…</p><select id="autoWireAgentPicker"></select><div class="dialog-actions"><button id="autoWireCopyPrompt" class="button">Copy prompt</button><button id="autoWireSend" class="button primary" disabled>Send wiring request</button></div>');dialog.classList.add('wide-dialog');dialog.querySelector('#autoWireExactPrompt').value=buildWiringAgentPrompt();dialog.querySelector('#autoWireCopyPrompt').onclick=()=>navigator.clipboard.writeText(buildWiringAgentPrompt());dialog.showModal();
    const available=await folderApi('/api/workspace/auto-wire',{workspaceId:projectFolder.id});
    if(available.existing){alert('complete-wiring.json already exists. No agent request was sent.');dialog.close();return;}
    if(!dialog.open)return;
    const agents=available.agents||[];
    dialog.querySelector('#autoWireAgentPicker').innerHTML=agents.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.model)}</option>`).join('');
    dialog.querySelector('#autoWireAgentStatus').textContent=agents.length?'Uses the Auto wire listen grant to read compact context and create complete-wiring.json.':'No listening agent. In Character Room, edit a character and grant Auto wire listen, then try again.';
    const send=dialog.querySelector('#autoWireSend');send.disabled=!agents.length;
    send.onclick=async()=>{if(!dialog.open)return;send.disabled=true;try{const job=await folderApi('/api/workspace/auto-wire',{workspaceId:projectFolder.id,agentId:dialog.querySelector('#autoWireAgentPicker').value});if(job.existing){alert('complete-wiring.json appeared before dispatch; no agent started.');await checkCompletedWiring();dialog.close();return;}autoWireJob={id:job.id,workspaceId:projectFolder.id};dialog.querySelector('#autoWireAgentStatus').textContent='Agent request started. You can close this dialog; the result is detected automatically. Open its chat in Character Room to watch or cancel.';}catch(e){send.disabled=false;dialog.querySelector('#autoWireAgentStatus').textContent=e.message;}};
    if(agents.length===1)await send.onclick();
  }catch(e){toast(e.message);}
};
if(typeof setInterval==='function')setInterval(async()=>{
  await checkCompletedWiring();if(autoWireJob&&typeof projectFolder!=='undefined'&&projectFolder?.id===autoWireJob.workspaceId){try{const job=await folderApi('/api/workspace/auto-wire-status',{jobId:autoWireJob.id});if(['done','failed','cancelled'].includes(job.status)){autoWireJob=null;if(job.status==='done')completedWiringSignature='';completeWiringStatus(job.status==='done'?'Agent created complete-wiring.json. Open Wiring to view its routes.':job.error||job.status);await checkCompletedWiring();}}catch(e){completeWiringStatus(e.message);}}
},4000);

const renderInspectorBeforeCompleteFile=renderInspector;
renderInspector=function(){drawingCompletedWiring=true;try{renderInspectorBeforeCompleteFile();}finally{drawingCompletedWiring=false;}document.querySelectorAll('[data-physical-wire^="complete-file:"]').forEach(button=>{button.disabled=true;button.title="Edit complete-wiring.json to change this file overlay.";});};
