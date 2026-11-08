const REQUIREMENTS_LIMIT=1024*1024;
function validateRequirementsDocument(raw){
  if(raw==null)return null;
  if(typeof raw.markdown!=='string'||raw.markdown.length>REQUIREMENTS_LIMIT)throw Error('Use a Markdown requirements document smaller than 1 MB.');
  return {name:'missing-requirements.md',markdown:raw.markdown,updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:null};
}
const validateBeforeNotes=validate;
validate=function(raw){const result=validateBeforeNotes(raw);result.requirementsDocument=validateRequirementsDocument(raw.requirementsDocument);return result;};
function requirementsMarkdown(p=project){return p.requirementsDocument?.markdown||'# Project notes\n\nRecord missing parts, measurements, wiring checks and other tasks here.\n';}
function setRequirementsMarkdown(markdown){project.requirementsDocument=validateRequirementsDocument({markdown,updatedAt:new Date().toISOString()});persist();}
function inlineRequirementsMarkdown(text){
  return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
function renderRequirementsMarkdown(markdown){
  const lines=markdown.replace(/\r\n/g,'\n').split('\n');let html='',list=null,code=null,table=false;
  const closeList=()=>{if(list){html+=`</${list}>`;list=null;}};
  const closeTable=()=>{if(table){html+='</tbody></table></div>';table=false;}};
  for(const line of lines){
    if(/^```/.test(line)){closeList();closeTable();if(code!==null){html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';code=null;}else code=[];continue;}
    if(code!==null){code.push(line);continue;}
    if(/^\s*\|.*\|\s*$/.test(line)){
      closeList();const cells=line.trim().slice(1,-1).split('|').map(s=>s.trim());if(cells.every(s=>/^:?-{2,}:?$/.test(s)))continue;
      if(!table){html+='<div class="requirements-table"><table><tbody>';table=true;}html+='<tr>'+cells.map(s=>'<td>'+inlineRequirementsMarkdown(s)+'</td>').join('')+'</tr>';continue;
    }
    closeTable();
    const heading=line.match(/^(#{1,6})\s+(.+)$/),bullet=line.match(/^\s*[-*]\s+(.+)$/),number=line.match(/^\s*\d+\.\s+(.+)$/);
    if(heading){closeList();html+=`<h${heading[1].length}>${inlineRequirementsMarkdown(heading[2])}</h${heading[1].length}>`;}
    else if(bullet||number){const kind=bullet?'ul':'ol';if(list!==kind){closeList();html+=`<${kind}>`;list=kind;}html+='<li>'+inlineRequirementsMarkdown((bullet||number)[1])+'</li>';}
    else{closeList();if(line.trim())html+='<p>'+inlineRequirementsMarkdown(line)+'</p>';}
  }
  closeList();closeTable();if(code!==null)html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';return html;
}
function downloadHandoffBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderRequirementsWorkspace(){
  const target=$('#requirementsWorkspace'),attached=!!project.requirementsDocument;
  target.innerHTML=`<div class="workbench-heading"><div><div class="eyebrow">PROJECT NOTES</div><h2>Project notes</h2><p>${attached?'Attached to this project: missing-requirements.md':'Attach the latest requirements Markdown for this project.'}</p></div><button class="button" id="requirementsBack">Back to product map</button></div><div class="requirements-actions"><label class="button">Import .md<input type="file" id="requirementsFile" accept=".md,.markdown,text/markdown,text/plain"></label><button class="button" id="downloadRequirements">Download .md</button></div><div class="requirements-views"><button class="button selected" id="requirementsRead">Read document</button><button class="button" id="requirementsEdit">Markdown / edit</button><span>${attached&&project.requirementsDocument.updatedAt?'Updated '+esc(project.requirementsDocument.updatedAt):'No attached review yet'}</span></div><article id="requirementsRendered" class="requirements-markdown"></article><div id="requirementsEditArea" hidden><label>missing-requirements.md<textarea id="requirementsEditor" maxlength="${REQUIREMENTS_LIMIT}"></textarea></label><button class="button primary" id="saveRequirements">Save document</button></div>`;
  $('#requirementsRendered').innerHTML=renderRequirementsMarkdown(requirementsMarkdown());$('#requirementsEditor').value=requirementsMarkdown();
  $('#requirementsBack').onclick=()=>showWorkbench('map');
  $('#downloadRequirements').onclick=()=>downloadHandoffBlob(new Blob([requirementsMarkdown()],{type:'text/markdown;charset=utf-8'}),'missing-requirements.md');
  $('#requirementsFile').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(!/\.(md|markdown)$/i.test(file.name)||file.size>REQUIREMENTS_LIMIT)throw Error('Choose a .md or .markdown file smaller than 1 MB.');const sourceProject=project,markdown=await file.text();if(sourceProject!==project)throw Error('The project changed while reading this document. Import it again for the intended project.');setRequirementsMarkdown(markdown);renderRequirementsWorkspace();toast('Requirements document attached to this project.');}catch(error){toast(error.message);}};
  $('#requirementsRead').onclick=()=>{$('#requirementsRendered').hidden=false;$('#requirementsEditArea').hidden=true;$('#requirementsRead').classList.add('selected');$('#requirementsEdit').classList.remove('selected');};
  $('#requirementsEdit').onclick=()=>{$('#requirementsRendered').hidden=true;$('#requirementsEditArea').hidden=false;$('#requirementsEdit').classList.add('selected');$('#requirementsRead').classList.remove('selected');};
  $('#saveRequirements').onclick=()=>{try{setRequirementsMarkdown($('#requirementsEditor').value);renderRequirementsWorkspace();toast('Requirements saved with this project.');}catch(error){toast(error.message);}};
}
const showWorkbenchBeforeRequirements=showWorkbench;
showWorkbench=function(mode){
  showWorkbenchBeforeRequirements(mode==='requirements'?'map':mode);const active=mode==='requirements';$('#requirementsWorkspace').hidden=!active;$('#requirementsNav').classList.toggle('active',active);
  if(active){workbenchView='requirements';['.studio','#componentLibrary','#pcbWorkspace','.project-heading','.stats','.handoff-banner'].forEach(s=>$(s).hidden=true);$('#mapNav').classList.remove('active');renderRequirementsWorkspace();$('#requirementsWorkspace').scrollIntoView({block:'start'});}
};
const renderBeforeRequirements=render;
render=function(inspect=true){renderBeforeRequirements(inspect);if(workbenchView==='requirements')renderRequirementsWorkspace();};
function initializeProjectNotes(){
  try{project.requirementsDocument=validateRequirementsDocument(project.requirementsDocument);}catch(error){toast(error.message);}
  const nav=document.createElement('button');nav.id='requirementsNav';nav.className='rail-item';nav.innerHTML='≡ <span>Project notes</span>';$('#exportNav').before(nav);nav.onclick=()=>showWorkbench('requirements');
  const workspace=document.createElement('section');workspace.id='requirementsWorkspace';workspace.hidden=true;$('.studio').before(workspace);
}
initializeProjectNotes();
