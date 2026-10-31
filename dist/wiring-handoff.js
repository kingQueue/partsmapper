const REQUIREMENTS_LIMIT=1024*1024;
function validateRequirementsDocument(raw){
  if(raw==null)return null;
  if(typeof raw.markdown!=='string'||raw.markdown.length>REQUIREMENTS_LIMIT)throw Error('Use a Markdown requirements document smaller than 1 MB.');
  return {name:'missing-requirements.md',markdown:raw.markdown,updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:null};
}
const validateBeforeHandoff=validate;
validate=function(raw){const result=validateBeforeHandoff(raw);result.requirementsDocument=validateRequirementsDocument(raw.requirementsDocument);return result;};
function requirementsMarkdown(p=project){return p.requirementsDocument?.markdown||'# Missing requirements\n\nNo requirements document is attached to this project yet.\n\nThe wiring agent must inspect project.json and generate missing-requirements.md, listing unresolved requirements or explicitly stating that no known blockers remain. Absence of this file is not proof that the hardware is ready to power.\n';}
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
function wiringAgentCommand(){return 'Use agent-prompt.md and wiring-context.json to generate complete-wiring.json in this project folder.';}
function buildWiringAgentPrompt(){return `# Task: complete supported Partmap wiring

Planning input: wiring-context.json only. Read it once. Do not read project.json.
Do not read any file twice. After reading, your next message is the JSON below.

## Rules
- Endpoints are { "component": "<component id>", "pin": "<pin id>" }.
  Use the exact "id" values from the context file. Never use pin names,
  labels, or section names as endpoints.
- Parent/child is assembly intent only. It is NOT a reason to connect pins.
- Only create a connection if the context file justifies it. Valid examples:
  ground to ground, a documented logic supply to a logic VCC, and matching
  I2C SDA/SCL pairs.
- Never connect a GPIO to a power pin. Never connect a servo PWM channel to
  a DC motor. Never connect encoder outputs to a PWM driver.
- Anything that needs a missing part or fact (motor driver, servo supply,
  level shifting, pull-ups, OE state, encoder voltage) goes in "blocked".
- The PWM driver has duplicate left/right logic headers. Wire one set only
  and say which in "assumptions".
- Do not add, remove, or copy components.

## Final output (required)
Your final message must be ONE fenced json code block and nothing else after
it. It must follow this shape exactly. "connections" must not be empty
unless you list why in "blocked".

{
  "format": "partmap.wiring-edits",
  "connections": [
    {
      "from": { "component": "<id>", "pin": "<pin id>" },
      "to":   { "component": "<id>", "pin": "<pin id>" },
      "reason": "<one short sentence>"
    }
  ],
  "blocked": [
    {
      "component": "<id>",
      "pins": ["<pin id>"],
      "needed": "<exact missing fact or part>"
    }
  ],
  "assumptions": ["<text>"]
}

Do not describe the JSON before or after. Do not write a table.
`;}
function buildWiringHandoffFiles(){
  const snapshot=exportObject();snapshot.requirementsDocument=project.requirementsDocument||null;snapshot.wiringTask=makeWiringTask(project);
  return [
    {name:'project.json',text:JSON.stringify(snapshot,null,2)},
    {name:'agent-prompt.md',text:buildWiringAgentPrompt()},
    {name:'agent-command.txt',text:wiringAgentCommand()+'\n'},
    {name:'missing-requirements.md',text:requirementsMarkdown()},
    {name:'wiring-context.json',text:PartmapWiringContext.text(snapshot)},
    {name:'README.md',text:"# Partmap wiring handoff\n\nUse the exact prompt in agent-prompt.md. Planning input is wiring-context.json only. Save the returned partmap.wiring-edits JSON as complete-wiring.json in the selected project directory. Partmap detects it automatically in Wiring; do not replace project.json with this edit file. Full source snapshots in this package are for backup, not additional planning inputs.\n\nThe Auto complete wiring button checks for an existing complete-wiring.json first and does not overwrite it. If missing, a Character Room agent with Auto wire listen can receive the local MCP request and create that file. File routes are displayed as an overlay with review issues highlighted.\n"}
  ];
}
function zipCrc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// A dependency-free UTF-8 ZIP (stored entries); one download avoids browser multi-file blocking.
function wiringHandoffZip(files){
  const encoder=new TextEncoder(),chunks=[],central=[];let offset=0,centralSize=0;
  for(const file of files){
    const name=encoder.encode(file.name),data=encoder.encode(file.text),crc=zipCrc32(data),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);header.set(name,30);chunks.push(header,data);
    const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);entry.set(name,46);central.push(entry);centralSize+=entry.length;offset+=header.length+data.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}
function downloadHandoffBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function downloadWiringHandoff(files){downloadHandoffBlob(wiringHandoffZip(files),'partmap-wiring-handoff.zip');}
function openAutoWiringHandoff(){
  try{
    const files=buildWiringHandoffFiles(),dialog=createModal(`<div class="dialog-heading"><div><div class="eyebrow">AUTO COMPLETE WIRING</div><h2>Agent wiring package</h2></div><button class="icon-button" data-dismiss>×</button></div><p>The ZIP contains a compact wiring-context.json, your complete project, an agent prompt, a starter command, and the latest missing-requirements.md. Agents should analyze the compact file first. Extract it and give the files to your agent.</p><p class="handoff-explanation">This exports the task; it does not run an agent automatically.</p><label>Agent command<textarea id="wiringAgentCommand" readonly rows="4"></textarea></label><p class="muted">The agent should produce complete-wiring.json using the supplied prompt. Partmap automatically detects the file and displays its routes in Wiring.</p><details><summary>View exported prompt</summary><pre id="wiringPromptPreview"></pre></details><div class="dialog-actions"><button id="copyWiringCommand" class="button">Copy command</button><button id="copyWiringPrompt" class="button">Copy full prompt</button><button id="downloadWiringPackage" class="button primary">Download ZIP again</button></div>`);
    dialog.classList.add('wide-dialog');dialog.querySelector('#wiringAgentCommand').value=wiringAgentCommand();dialog.querySelector('#wiringPromptPreview').textContent=files.find(f=>f.name==='agent-prompt.md').text;
    const copy=async text=>{try{await navigator.clipboard.writeText(text);toast('Copied to clipboard.');}catch{toast('Clipboard unavailable. Select and copy the command or use the files in the ZIP.');}};
    dialog.querySelector('#copyWiringCommand').onclick=()=>copy(wiringAgentCommand());dialog.querySelector('#copyWiringPrompt').onclick=()=>copy(buildWiringAgentPrompt());dialog.querySelector('#downloadWiringPackage').onclick=()=>downloadWiringHandoff(files);dialog.showModal();downloadWiringHandoff(files);
  }catch(error){toast(error.message);}
}
function renderRequirementsWorkspace(){
  const target=$('#requirementsWorkspace'),attached=!!project.requirementsDocument;
  target.innerHTML=`<div class="workbench-heading"><div><div class="eyebrow">WIRING REVIEW</div><h2>Missing requirements</h2><p>${attached?'Attached to this project: missing-requirements.md':'Attach the latest requirements Markdown for this project.'}</p></div><button class="button" id="requirementsBack">Back to product map</button></div><div class="requirements-actions"><label class="button">Import .md<input type="file" id="requirementsFile" accept=".md,.markdown,text/markdown,text/plain"></label><button class="button" id="downloadRequirements">Download .md</button><button class="button primary" id="requirementsAutoWire">Auto complete wiring</button></div><div class="requirements-views"><button class="button selected" id="requirementsRead">Read document</button><button class="button" id="requirementsEdit">Markdown / edit</button><span>${attached&&project.requirementsDocument.updatedAt?'Updated '+esc(project.requirementsDocument.updatedAt):'No attached review yet'}</span></div><article id="requirementsRendered" class="requirements-markdown"></article><div id="requirementsEditArea" hidden><label>missing-requirements.md<textarea id="requirementsEditor" maxlength="${REQUIREMENTS_LIMIT}"></textarea></label><button class="button primary" id="saveRequirements">Save document</button></div>`;
  $('#requirementsRendered').innerHTML=renderRequirementsMarkdown(requirementsMarkdown());$('#requirementsEditor').value=requirementsMarkdown();
  $('#requirementsBack').onclick=()=>showWorkbench('map');$('#requirementsAutoWire').onclick=openAutoWiringHandoff;
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
function initializeWiringHandoff(){
  try{project.requirementsDocument=validateRequirementsDocument(project.requirementsDocument);}catch(error){toast(error.message);}
  const nav=document.createElement('button');nav.id='requirementsNav';nav.className='rail-item';nav.innerHTML='≡ <span>Missing requirements</span>';$('#exportNav').before(nav);nav.onclick=()=>showWorkbench('requirements');
  const workspace=document.createElement('section');workspace.id='requirementsWorkspace';workspace.hidden=true;$('.studio').before(workspace);
  const button=document.createElement('button');button.id='autoCompleteWiring';button.className='button primary auto-wiring-button';button.textContent='Auto complete wiring';button.onclick=openAutoWiringHandoff;$('.toolbar-right').prepend(button);
}
initializeWiringHandoff();
