// Component clipboard snapshots are independent of their source and omit wires.
let copiedPart=null;
const COMPONENT_CLIPBOARD_FORMAT='partmap.component';
function componentClipboardPayload(component){
  const snapshot=structuredClone(component);snapshot.connections=[];
  return {format:COMPONENT_CLIPBOARD_FORMAT,version:1,component:snapshot};
}
function parseComponentClipboard(text){
  if(typeof text!=='string'||!text.trim().startsWith('{'))return null;
  let payload;try{payload=JSON.parse(text);}catch{return null;}
  if(payload?.format!==COMPONENT_CLIPBOARD_FORMAT)return null;
  if(payload.version!==1||!payload.component||text.length>8*1024*1024)throw Error('This copied component is unsupported or too large.');
  const snapshot=structuredClone(payload.component),parent=snapshot.parent||null;
  snapshot.parent=null;snapshot.connections=[];
  const checked=validate({name:'Component clipboard',nodes:[snapshot]}).nodes[0];
  checked.parent=parent;return checked;
}
function pasteComponentCopies(snapshot,count=1,parentMode='source'){
  if(!snapshot)throw Error('Copy a component first.');
  if(project.nodes.length>=300)throw Error('The project already has 300 components. Remove a part before pasting.');
  if(!Number.isInteger(count)||count<1||project.nodes.length+count>300)throw Error(`Enter a whole number from 1 to ${Math.max(0,300-project.nodes.length)} new copies.`);
  const checked=parseComponentClipboard(JSON.stringify(componentClipboardPayload(snapshot)));
  const parent=parentMode==='source'?(node(checked.parent)?.id||null):(parentMode||null);
  if(parent&&!node(parent))throw Error('The destination parent is no longer in this project.');
  const usedNames=new Set(project.nodes.map(n=>n.name)),base=checked.name.replace(/\s+\(\d+\)$/,'');const copies=[];let suffix=2;
  for(let i=0;i<count;i++){
    let name=`${base} (${suffix++})`;while(usedNames.has(name))name=`${base} (${suffix++})`;usedNames.add(name);
    const copy=duplicateDevice(checked,name);copy.parent=parent;
    if(copy.positions)for(const [mode,pos] of Object.entries(copy.positions)){const step=mode==='wiring'?boardGeometry(copy).width+90:260;pos.x=Math.min(100000,pos.x+i*step);}
    copies.push(copy);
  }
  // Validate the complete proposed result before changing the current project.
  validate({...project,nodes:[...project.nodes,...copies]});project.nodes.push(...copies);return copies;
}
function clipboardTargetIsEditable(target){return !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');}
function componentClipboardShortcutAllowed(event){
  return !clipboardTargetIsEditable(event.target)&&!clipboardTargetIsEditable(document.activeElement)&&!document.querySelector('dialog[open]')&&!window.getSelection()?.toString();
}
function refreshComponentClipboard(){
  const copyButton=$('#copyPart'),pasteButton=$('#pasteParts');if(!copyButton)return;
  copyButton.disabled=!node(selected);pasteButton.disabled=!copiedPart;
  $('#componentClipboardStatus').textContent=copiedPart?`Copied: ${copiedPart.name}`:'Select a part to copy';
  const count=$('#pasteCopies');count.max=Math.max(1,300-project.nodes.length);
  const parent=$('#pasteParent'),previous=parent.value;
  parent.innerHTML='<option value="source">Same parent as original</option><option value="">Product root</option>'+chooseOptions(project.nodes.map(n=>[n.id,`${n.name} · ${n.id.slice(0,6)}`]));
  parent.value=[...parent.options].some(o=>o.value===previous)?previous:'source';
}
async function copySelectedPart(){
  const n=node(selected);if(!n){toast('Select a component in the map first.');return;}
  const text=JSON.stringify(componentClipboardPayload(n));copiedPart=parseComponentClipboard(text);refreshComponentClipboard();
  try{await navigator.clipboard.writeText(text);toast(`Copied ${n.name}. Paste once or set the number of new copies.`);}
  catch{toast(`Copied ${n.name} inside Partmap. Use Paste; browser clipboard access is unavailable.`);}
}
function applyComponentPaste(count=1,parentMode='source'){
  try{const copies=pasteComponentCopies(copiedPart,count,parentMode);selected=copies[0].id;copies.forEach(n=>enabled.add(n.category));$$('[data-filter]').forEach(c=>c.checked=enabled.has(c.dataset.filter));if(view!=='full'&&copies.some(n=>!categories[n.category][2]))view='full';changed(`Pasted ${count} independent ${copiedPart.name} component${count===1?'':'s'}`);setView(view);renderInspector();refreshComponentClipboard();toast(`Pasted ${count} independent part${count===1?'':'s'}. Wire each instance separately.`);}
  catch(error){toast(error.message);}
}
const inspectorBeforeClipboard=renderInspector;
renderInspector=function(){
  inspectorBeforeClipboard();const n=node(selected);
  if(n){const button=document.createElement('button');button.className='button';button.id='copyInspectedPart';button.textContent='Copy';button.title='Copy this component (Ctrl+C / Command+C)';button.onclick=copySelectedPart;$('.inspector-bottom').prepend(button);}
  refreshComponentClipboard();
};
function initializeComponentClipboard(){
  const toolbar=document.createElement('div');toolbar.className='component-clipboard';toolbar.innerHTML='<div class="clipboard-buttons"><button class="button" id="copyPart" title="Copy selected component (Ctrl+C / Command+C)">Copy part</button><button class="button primary" id="pasteParts" disabled title="Paste copied component(s)">Paste</button></div><label>New copies<input id="pasteCopies" type="number" min="1" max="300" step="1" value="1"></label><label>Attach copies to<select id="pasteParent"><option value="source">Same parent as original</option></select></label><span id="componentClipboardStatus" role="status">Select a part to copy</span>';
  $('.map-controls').after(toolbar);$('#copyPart').onclick=copySelectedPart;$('#pasteParts').onclick=()=>applyComponentPaste(Number($('#pasteCopies').value),$('#pasteParent').value);
  document.addEventListener('copy',event=>{
    if(!componentClipboardShortcutAllowed(event)||!node(selected)||!event.clipboardData)return;
    const text=JSON.stringify(componentClipboardPayload(node(selected)));event.clipboardData.setData('text/plain',text);event.preventDefault();copiedPart=parseComponentClipboard(text);refreshComponentClipboard();toast(`Copied ${copiedPart.name}. Ctrl+V / Command+V creates another instance.`);
  });
  document.addEventListener('paste',event=>{
    if(!componentClipboardShortcutAllowed(event))return;
    try{const snapshot=parseComponentClipboard(event.clipboardData?.getData('text/plain')||'');if(!snapshot)return;event.preventDefault();copiedPart=snapshot;applyComponentPaste(Number($('#pasteCopies').value),$('#pasteParent').value);}
    catch(error){event.preventDefault();toast(error.message);}
  });
  renderInspector();
}
initializeComponentClipboard();
