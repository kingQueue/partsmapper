// Shared reusable templates and a PCB placement sketch. No manufacturing geometry is implied.
const LIBRARY_KEY='partmap.library.v1',PART_DRAG_TYPE='application/x-partmap-library';
function makeLibraryTemplate(id,name,category,pins,interfaceName='',firmware=''){
  const n={id,name,category,model:'Generic template — verify exact variant',parent:null,quantity:1,ready:false,voltage:'Verify exact device',interface:interfaceName,notes:'Starter template. Edit the pin inventory to match your exact device.',firmware,attachments:[],connections:[],pins:pinList(pins),pinSections:[]};normalizeNodePins(n);return n;
}
const defaultComponentLibrary=[
  makeLibraryTemplate('builtin-esp32','ESP32 development board','board','Power::3V3;Power::GND;GPIO::GPIO21;GPIO::GPIO22;GPIO::GPIO18;GPIO::GPIO27','GPIO / I2C / PWM','Record the exact ESP32 board target and framework before selecting drivers.'),
  makeLibraryTemplate('builtin-pico','RP2040 development board','board','Power::3V3;Power::GND;GPIO::GP0;GPIO::GP1;GPIO::GP2;GPIO::GP3','GPIO / I2C / SPI','Assign interfaces and pins for the exact RP2040 board.'),
  makeLibraryTemplate('builtin-pwm','16-channel PWM driver','board','','I2C','Configure the verified I2C address and safe PWM frequency for the actuators.'),
  makeLibraryTemplate('builtin-encoder','Wheel encoder','sensor','Header::VCC;Header::GND;Header::A;Header::B','Quadrature','Record pulses per revolution; use interrupt-safe counters and determine direction.'),
  makeLibraryTemplate('builtin-motor','DC wheel motor','motor','Motor::M+;Motor::M−','Motor driver required','Use a suitable motor driver; record current, gear ratio, direction, and PWM limits.'),
  makeLibraryTemplate('builtin-oled','I2C OLED display','peripheral','Header::VCC;Header::GND;Header::SDA;Header::SCL','I2C','Verify controller, dimensions, I2C address, and library version.')
];
applyServoPreset(defaultComponentLibrary.find(n=>n.id==='builtin-pwm'));
let savedComponentLibrary=[],libraryQuery='',pcbSelected=null,pcbScale=8,workbenchView='map';
function checkedTemplate(raw){const copy=structuredClone(raw);copy.parent=null;copy.connections=[];delete copy.positions;return validate({name:'Library template',nodes:[copy]}).nodes[0];}
function allLibraryParts(){return [...defaultComponentLibrary,...savedComponentLibrary];}
function findLibraryPart(id){return allLibraryParts().find(n=>n.id===id);}
function saveLibraryPart(source){
  if(savedComponentLibrary.length>=100)throw Error('The reusable library supports 100 saved templates.');
  const copy=checkedTemplate(source);copy.id=uid();copy.name=uniqueLibraryName(copy.name);copy.ready=false;
  const next=[...savedComponentLibrary,copy];localStorage.setItem(LIBRARY_KEY,JSON.stringify(next));savedComponentLibrary=next;return copy;
}
function uniqueLibraryName(name){let result=name,i=2;while(allLibraryParts().some(n=>n.name===result))result=`${name} (${i++})`;return result;}
function instantiateLibraryPart(id,parent=null,position=null){
  const source=findLibraryPart(id);if(!source)throw Error('Choose an existing library component.');
  if(project.nodes.length>=300)throw Error('The project already has 300 components.');
  if(parent&&!node(parent))throw Error('Choose an existing parent.');
  const copy=duplicateDevice(source,project.nodes.some(n=>n.name===source.name)?uniqueDeviceName(source.name):source.name);copy.parent=parent;delete copy.positions;
  if(position)copy.positions={[mapMode()]:{x:Math.max(10,position.x),y:Math.max(10,position.y)}};
  project.nodes.push(copy);return copy;
}
function newPcb(){return {version:1,name:'Untitled PCB',width:100,height:80,placements:[]};}
function validatePcb(raw){
  if(raw==null)return null;
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  if(raw.version!==1||typeof raw.name!=='string'||raw.name.length>200||!finite(raw.width,20,500)||!finite(raw.height,20,500)||!Array.isArray(raw.placements)||raw.placements.length>300)throw Error('Invalid PCB placement document.');
  const ids=new Set();
  const placements=raw.placements.map(p=>{
    if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||!finite(p.x,0,500)||!finite(p.y,0,500)||![0,90,180,270].includes(p.rotation)||!finite(p.width,2,500)||!finite(p.height,2,500)||typeof p.sourceId!=='string'||!['project','library'].includes(p.source))throw Error('Invalid PCB component placement.');
    ids.add(p.id);const size=placementSize(p);if(p.x+size.width>raw.width||p.y+size.height>raw.height)throw Error('A PCB component extends outside the board.');
    return {...p,component:checkedTemplate(p.component)};
  });return {version:1,name:raw.name,width:raw.width,height:raw.height,placements};
}
const validateBeforeWorkbench=validate;
validate=function(raw){const result=validateBeforeWorkbench(raw);result.pcb=validatePcb(raw.pcb);return result;};
function placementSize(p){return p.rotation%180?{width:p.height,height:p.width}:{width:p.width,height:p.height};}
function addPcbPlacement(source,id,x=null,y=null){
  const original=source==='library'?findLibraryPart(id):source==='project'?node(id):null;
  if(!original||!categories[original.category][2])throw Error('Choose an electronic component from the project or library.');
  const pcb=project.pcb||newPcb();if(pcb.placements.length>=300)throw Error('Maximum 300 PCB placements.');
  if(x===null||y===null){const columns=Math.max(1,Math.floor((pcb.width-5)/22)),index=pcb.placements.length;x=5+(index%columns)*22;y=5+Math.floor(index/columns)*16;}
  const p={id:uid(),source,sourceId:id,component:checkedTemplate(original),x:0,y:0,width:18,height:12,rotation:0};
  p.x=Math.max(0,Math.min(pcb.width-p.width,Math.round(x)));p.y=Math.max(0,Math.min(pcb.height-p.height,Math.round(y)));
  pcb.placements.push(p);project.pcb=pcb;return p;
}
function movePcbPlacement(p,x,y){const size=placementSize(p),pcb=project.pcb;p.x=Math.max(0,Math.min(pcb.width-size.width,Math.round(x)));p.y=Math.max(0,Math.min(pcb.height-size.height,Math.round(y)));}
function resizePcb(width,height){
  const proposed={...(project.pcb||newPcb()),width,height};validatePcb(proposed);project.pcb=proposed;
}
function downloadWorkbenchJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function libraryCardHTML(n,source='library'){
  return `<article class="library-card" draggable="true" data-library-id="${esc(n.id)}" data-part-source="${source}"><span class="library-icon">${categories[n.category][1]}</span><div><strong>${esc(n.name)}</strong><small>${esc(n.interface||categories[n.category][0])} · ${n.pins.length} pins</small></div><button class="button" data-use-library="${esc(n.id)}" data-source="${source}" aria-label="Add ${esc(n.name)}">＋</button></article>`;
}
function bindLibraryCards(container,destination){
  container.querySelectorAll('[data-library-id]').forEach(card=>{card.ondragstart=e=>{e.dataTransfer.setData(PART_DRAG_TYPE,JSON.stringify({source:card.dataset.partSource,id:card.dataset.libraryId}));e.dataTransfer.effectAllowed='copy';toast('Drop the component onto the project map or PCB board.');};});
  container.querySelectorAll('[data-use-library]').forEach(b=>b.onclick=()=>destination(b.dataset.source,b.dataset.useLibrary));
}
function renderComponentLibrary(){
  const list=allLibraryParts().filter(n=>`${n.name} ${n.model} ${n.interface}`.toLowerCase().includes(libraryQuery.toLowerCase()));
  $('#libraryCards').innerHTML=list.map(n=>libraryCardHTML(n)).join('')||'<p class="muted">No matching components. Save a project part to reuse it.</p>';
  bindLibraryCards($('#libraryCards'),(_,id)=>addLibraryToMap(id));
}
function addLibraryToMap(id,point=null){try{const n=instantiateLibraryPart(id,$('#libraryParent').value||null,point);selected=n.id;enabled.add(n.category);changed(`Added library component ${n.name}`);setView(view);renderInspector();toast(`Added ${n.name}. Edit its pins for your exact device.`);}catch(e){toast(e.message);}}
function refreshLibraryParent(){const select=$('#libraryParent');if(!select)return;const old=select.value;select.innerHTML='<option value="">Product root</option>'+project.nodes.map(n=>`<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('');select.value=node(old)?old:'';}
function renderPcb(){
  const pcb=project.pcb||newPcb(),workspace=$('#pcbWorkspace');
  workspace.innerHTML=`<div class="workbench-heading"><div><div class="eyebrow">PCB WORKSPACE · PLACEMENT PREVIEW</div><h2>Make a PCB</h2><p>Arrange parts from your library or current project on a board measured in millimeters.</p></div><button class="button" id="pcbBack">Back to product map</button></div><div class="pcb-notice">Placement sketches use generic blocks, not verified footprints. Copper routing, pad definitions, design-rule checks, and Gerber export are planned.</div><div class="pcb-tools"><label>Board name<input id="pcbName" maxlength="200" value="${esc(pcb.name)}"></label><label>Width (mm)<input id="pcbWidth" type="number" min="20" max="500" value="${pcb.width}"></label><label>Height (mm)<input id="pcbHeight" type="number" min="20" max="500" value="${pcb.height}"></label><button class="button" id="pcbResize">Apply size</button><label>Zoom<select id="pcbZoom">${[4,6,8,12,16].map(v=>`<option value="${v}" ${pcbScale===v?'selected':''}>${v*12.5}%</option>`).join('')}</select></label><button class="button" id="pcbDownload">Export PCB sketch</button><button class="button" disabled title="Requires verified footprints, copper routing, drills, and manufacturing checks">Gerber export · planned</button></div><div class="pcb-layout"><aside class="pcb-palette"><h3>Shared component library</h3><p>Drag onto the board or click ＋.</p>${allLibraryParts().filter(n=>categories[n.category][2]).map(n=>libraryCardHTML(n)).join('')}<h3>From this project</h3>${project.nodes.filter(n=>categories[n.category][2]).map(n=>libraryCardHTML(n,'project')).join('')||'<p>No electronic parts yet.</p>'}</aside><div><div class="pcb-scroll"><div id="pcbBoard" style="width:${pcb.width*pcbScale}px;height:${pcb.height*pcbScale}px;background-size:${pcbScale*5}px ${pcbScale*5}px"><span class="pcb-board-label">${esc(pcb.name)} · ${pcb.width} × ${pcb.height} mm</span>${pcb.placements.map(p=>{const size=placementSize(p);return `<button class="pcb-part ${pcbSelected===p.id?'selected':''}" data-pcb-part="${esc(p.id)}" style="left:${p.x*pcbScale}px;top:${p.y*pcbScale}px;width:${size.width*pcbScale}px;height:${size.height*pcbScale}px"><strong>${esc(p.component.name)}</strong><small>${p.rotation}° · generic block</small></button>`;}).join('')}</div></div><div id="pcbPartDetails"></div></div></div>`;
  $('#pcbBack').onclick=()=>showWorkbench('map');
  $('#pcbName').onchange=e=>{project.pcb=project.pcb||newPcb();project.pcb.name=e.target.value.slice(0,200);persist();renderPcb();};
  $('#pcbResize').onclick=()=>{try{resizePcb(Number($('#pcbWidth').value),Number($('#pcbHeight').value));persist();renderPcb();}catch(e){toast(e.message);}};
  $('#pcbZoom').onchange=e=>{pcbScale=Number(e.target.value);renderPcb();};
  $('#pcbDownload').onclick=()=>downloadWorkbenchJSON({format:'partmap.pcb-sketch',version:1,pcb:project.pcb||newPcb(),manufacturingReady:false},'partmap-pcb-sketch.json');
  bindLibraryCards(workspace,(source,id)=>{try{pcbSelected=addPcbPlacement(source,id).id;persist();renderPcb();}catch(e){toast(e.message);}});
  bindWorkbenchDrop($('#pcbBoard'),(data,e)=>{const r=$('#pcbBoard').getBoundingClientRect();pcbSelected=addPcbPlacement(data.source,data.id,(e.clientX-r.left)/pcbScale,(e.clientY-r.top)/pcbScale).id;persist();renderPcb();});
  bindPcbDragging();renderPcbPartDetails();
}
function renderPcbPartDetails(){
  const p=project.pcb?.placements.find(p=>p.id===pcbSelected),target=$('#pcbPartDetails');if(!target)return;
  target.innerHTML=p?`<div class="pcb-detail"><strong>${esc(p.component.name)}</strong><span>${p.x}, ${p.y} mm · ${p.rotation}° · ${p.component.pins.length} pins · snapshot from ${p.source}${p.source==='project'&&!node(p.sourceId)?' (source removed)':''}</span><label>Block width (mm)<input id="pcbPartWidth" type="number" min="2" value="${p.width}"></label><label>Block height (mm)<input id="pcbPartHeight" type="number" min="2" value="${p.height}"></label><button id="pcbPartResize" class="button">Apply block size</button><button id="pcbRotate" class="button">Rotate 90°</button><button id="pcbRemove" class="button">Remove placement</button></div>`:'<p class="muted">Drop a part on the board. Drag blocks to position them; select one to resize or rotate it.</p>';
  if(!p)return;
  $('#pcbRotate').onclick=()=>{const next=(p.rotation+90)%360,size=placementSize({...p,rotation:next});if(size.width>project.pcb.width||size.height>project.pcb.height){toast('The rotated block does not fit on this board.');return;}p.rotation=next;movePcbPlacement(p,p.x,p.y);persist();renderPcb();};
  $('#pcbPartResize').onclick=()=>{try{const next=structuredClone(project.pcb),part=next.placements.find(n=>n.id===p.id);part.width=Number($('#pcbPartWidth').value);part.height=Number($('#pcbPartHeight').value);validatePcb(next);project.pcb=next;persist();renderPcb();}catch(e){toast(e.message);}};
  $('#pcbRemove').onclick=()=>{project.pcb.placements=project.pcb.placements.filter(n=>n.id!==p.id);pcbSelected=null;persist();renderPcb();};
}
function bindPcbDragging(){
  const board=$('#pcbBoard');let drag=null;
  board.onpointerdown=e=>{const handle=e.target.closest('[data-pcb-part]');if(!handle||e.button!==0)return;const p=project.pcb.placements.find(p=>p.id===handle.dataset.pcbPart);pcbSelected=p.id;drag={p,x:e.clientX,y:e.clientY,original:{x:p.x,y:p.y},pointer:e.pointerId,handle};board.setPointerCapture(e.pointerId);e.preventDefault();renderPcbPartDetails();};
  board.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;movePcbPlacement(drag.p,drag.original.x+(e.clientX-drag.x)/pcbScale,drag.original.y+(e.clientY-drag.y)/pcbScale);drag.handle.style.left=drag.p.x*pcbScale+'px';drag.handle.style.top=drag.p.y*pcbScale+'px';};
  const end=e=>{if(!drag||drag.pointer!==e.pointerId)return;if(e.type==='pointercancel')Object.assign(drag.p,drag.original);drag=null;if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);persist();renderPcb();};board.onpointerup=end;board.onpointercancel=end;board.onlostpointercapture=end;
}
function bindWorkbenchDrop(target,handler){
  target.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes(PART_DRAG_TYPE)){e.preventDefault();e.dataTransfer.dropEffect='copy';target.classList.add('library-drop-active');}});
  target.addEventListener('dragleave',e=>{if(!target.contains(e.relatedTarget))target.classList.remove('library-drop-active');});
  target.addEventListener('drop',e=>{target.classList.remove('library-drop-active');const text=e.dataTransfer.getData(PART_DRAG_TYPE);if(!text)return;e.preventDefault();try{const data=JSON.parse(text);if(!['library','project'].includes(data.source)||typeof data.id!=='string')throw Error('Unsupported component drop.');handler(data,e);}catch(error){toast(error.message);}});
}
function showWorkbench(mode){
  workbenchView=mode;$('.studio').hidden=mode==='pcb';$('#componentLibrary').hidden=mode==='pcb';$('#pcbWorkspace').hidden=mode!=='pcb';$('.handoff-banner').hidden=mode==='pcb';$('.project-heading').hidden=mode==='pcb';$('.stats').hidden=mode==='pcb';
  $('.map-panel').classList.remove('expanded');$('#expandMap').textContent='Expand map';$('#mapNav').classList.toggle('active',mode==='map');$('#pcbNav').classList.toggle('active',mode==='pcb');
  if(mode==='pcb'){renderPcb();$('#pcbWorkspace').scrollIntoView({block:'start'});}else{renderComponentLibrary();refreshLibraryParent();render();fitMap();$('#componentLibrary').scrollIntoView({block:'start'});}
}
const clipboardAllowedBeforeWorkbench=componentClipboardShortcutAllowed;
componentClipboardShortcutAllowed=function(event){return workbenchView==='map'&&clipboardAllowedBeforeWorkbench(event);};
const inspectorBeforeWorkbench=renderInspector;
renderInspector=function(){inspectorBeforeWorkbench();refreshLibraryParent();const n=node(selected);if(!n)return;const b=document.createElement('button');b.className='button';b.textContent='Save to library';b.onclick=()=>{try{saveLibraryPart(n);renderComponentLibrary();toast('Saved reusable specifications, headers, and firmware notes. Connections are not copied.');}catch(e){toast(e.message);}};$('.inspector-bottom').append(b);};
function initializeWorkbench(){
  try{const raw=JSON.parse(localStorage.getItem(LIBRARY_KEY)||'[]');if(!Array.isArray(raw)||raw.length>100)throw Error();savedComponentLibrary=raw.map(checkedTemplate);}catch{toast('Saved component library could not be loaded. Your project is unchanged.');}
  try{project.pcb=validatePcb(project.pcb);}catch{toast('PCB sketch could not be loaded; export your project before editing it.');}
  const nav=document.createElement('button');nav.id='pcbNav';nav.className='rail-item';nav.innerHTML='▦ <span>Make a PCB</span>';$('#exportNav').before(nav);nav.onclick=()=>showWorkbench('pcb');
  const libraryNav=document.createElement('button');libraryNav.id='libraryNav';libraryNav.className='rail-item';libraryNav.innerHTML='▣ <span>Component library</span>';nav.before(libraryNav);libraryNav.onclick=()=>{showWorkbench('map');$('#componentLibrary').scrollIntoView({behavior:'smooth',block:'start'});};
  $('#mapNav').onclick=()=>showWorkbench('map');
  const section=document.createElement('section');section.id='componentLibrary';section.innerHTML='<div class="library-heading"><div><div class="eyebrow">REUSABLE BUILDING BLOCKS</div><h2>Component library</h2><p>Drag a template down onto your project map, or click ＋. Each part gets independent pins and settings.</p></div><button class="button" id="exportLibrary">Export library</button></div><div class="library-tools"><label>Search templates<input id="librarySearch" type="search" placeholder="Boards, motors, encoders…"></label><label>Attach new parts to<select id="libraryParent"><option value="">Product root</option></select></label><span>Save any project part from its details, including its firmware notes.</span></div><div id="libraryCards"></div><details class="firmware-roadmap"><summary>Reusable firmware library · foundation</summary><p>Templates already carry reusable firmware notes into new parts and AI handoffs. Save a configured project component to build your own library. Versioned code modules, dependencies, and firmware generation are planned.</p></details>';
  $('.studio').before(section);$('#librarySearch').oninput=e=>{libraryQuery=e.target.value;renderComponentLibrary();};$('#exportLibrary').onclick=()=>downloadWorkbenchJSON({format:'partmap.component-library',version:1,components:allLibraryParts()},'partmap-component-library.json');
  bindWorkbenchDrop($('.map-panel'),(data,e)=>{if(data.source!=='library')throw Error('Use the component library to add a new part.');const r=$('#graph').getBoundingClientRect();addLibraryToMap(data.id,{x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom});});
  const previousRender=render;render=function(inspect=true){previousRender(inspect);refreshLibraryParent();if(workbenchView==='pcb')renderPcb();};
  const previousBrief=brief;brief=function(){return previousBrief()+(project.pcb?'\n\n## PCB placement sketch\n'+project.pcb.name+' — '+project.pcb.width+' × '+project.pcb.height+' mm. Generic blocks only; no verified footprints, copper routing, or manufacturing output.\n'+project.pcb.placements.map(p=>`- ${p.component.name}: ${p.x}, ${p.y} mm; ${p.rotation}°; source ${p.source}/${p.sourceId}`).join('\n'):'');};
  renderComponentLibrary();renderInspector();
}
initializeWorkbench();
