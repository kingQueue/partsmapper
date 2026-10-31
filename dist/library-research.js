// Pick up externally researched library additions without replacing an edited product map.
let checkingResearchLibrary=false;
async function refreshResearchLibrary(){
  if(typeof projectFolder==='undefined'||!projectFolder||folderLoading||folderBlocked||folderPending||folderSaving||checkingResearchLibrary)return;
  checkingResearchLibrary=true;const context=projectFolder;
  try{
    const state=await folderApi('/api/workspace/library',{workspaceId:context.id});
    if(context!==projectFolder||folderPending||folderSaving||folderBlocked)return;
    if(state.projectRevision!==context.projectRevision)return; // A full project edit must still be reloaded explicitly.
    if(state.libraryRevision===context.libraryRevision)return;
    const customIds=state.library?.customIds;
    const templates=(state.library?.components||[]).filter(n=>customIds?customIds.includes(n.id):!defaultComponentLibrary.some(b=>b.id===n.id)).map(checkedTemplate);
    if(new Set(templates.map(n=>n.id)).size!==templates.length)throw Error('Duplicate library template IDs.');
    const changed=JSON.stringify(templates)!==JSON.stringify(savedComponentLibrary);
    savedComponentLibrary=templates;localStorage.setItem(LIBRARY_KEY,JSON.stringify(templates));context.revision=state.revision;context.libraryRevision=state.libraryRevision;
    if(changed){renderComponentLibrary();if(workbenchView==='pcb')renderPcb();toast('Component library refreshed from the project folder.');}
  }catch(e){folderStatus('Library refresh: '+e.message,true);}finally{checkingResearchLibrary=false;}
}
const libraryCardBeforeResearch=libraryCardHTML;
libraryCardHTML=function(n,source='library'){
  const html=libraryCardBeforeResearch(n,source);if(!n.research)return html;
  return html.replace('</small>',` · ${esc(n.variant||'')} · ${n.research.status==='documented'?'source-linked':'draft · review needed'}</small>`);
};
const inspectorBeforeResearch=renderInspector;
renderInspector=function(){
  inspectorBeforeResearch();const n=node(selected);if(!n?.research)return;
  const section=document.createElement('section');section.className='pin-editor';
  const sources=(Array.isArray(n.research.sources)?n.research.sources:[]).filter(s=>s&&typeof s.url==='string'&&s.url.startsWith('https://'));
  section.innerHTML=`<div class="section-label">RESEARCH &amp; DOCUMENTATION</div><p>${esc(n.manufacturer||'')} · ${esc(n.variant||'')} · ${esc(n.research.status)}</p><p class="muted">Source-linked data; physical wiring and footprints are not validated.</p>${sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)}</a></p>`).join('')}<p>${esc((Array.isArray(n.research.unresolved)?n.research.unresolved:[]).filter(u=>u&&typeof u.field==='string'&&typeof u.needed==='string').map(u=>u.field+': '+u.needed).join(' · ')||'No unresolved fields reported by the researcher.')}</p>`;
  section.innerHTML+=`<details><summary>Specifications and dimensions</summary><pre>${esc(JSON.stringify({dimensions:n.dimensions,specifications:n.specifications},null,2))}</pre></details><details><summary>Researched physical pinout (${n.pins.length})</summary><div style="overflow:auto"><table><thead><tr><th>Pin</th><th>Header / label</th><th>Functions</th></tr></thead><tbody>${n.pins.map(p=>`<tr><td>${esc(p.number||'')}</td><td>${esc(pinLabel(n,p))}</td><td>${esc((Array.isArray(p.functions)?p.functions:[]).join(', '))}</td></tr>`).join('')}</tbody></table></div></details>`;
  document.querySelector('#inspector .inspector-bottom')?.before(section);
};
if(typeof setInterval==='function')setInterval(refreshResearchLibrary,5000);
