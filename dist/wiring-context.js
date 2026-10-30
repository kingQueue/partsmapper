// Shared by browser exports and local autosaves. A derived view, never an importable project.
(function(root){
  function pick(value,keys){return Object.fromEntries(keys.filter(k=>value[k]!==undefined&&value[k]!==''&&value[k]!==null).map(k=>[k,value[k]]));}
  function build(project){
    const inventory=project.nodes||[];
    // Keep electrical devices, anything with pins/wires, and their assembly ancestors.
    const ids=new Set(inventory.filter(n=>['board','sensor','motor','power','peripheral'].includes(n.category)||(n.pins||[]).length||(n.connections||[]).length).map(n=>n.id));
    let size;do{size=ids.size;for(const n of inventory)if(ids.has(n.id)){if(n.parent)ids.add(n.parent);for(const c of n.connections||[])ids.add(c.target);}}while(size!==ids.size);
    return {
      format:'partmap.wiring-context',version:1,sourceFile:'project.json',name:project.name,
      usage:'Derived read-only wiring view. Not a full project; never replace/import project.json with this file. Use stable component and pin IDs, not repeated pin labels. Connected agents: use parts_wiring_context to obtain current compact data and its source hash, then parts_connect to apply small edits without reading a full project. Missing specs remain unknown; parent relationships are assembly intent, not electrical connections.',
      components:inventory.filter(n=>ids.has(n.id)).map(n=>({
        ...pick(n,['id','name','category','parent','quantity','model','voltage','interface','notes','firmware']),
        pinSections:(n.pinSections||[]).map(s=>({...s})),
        pins:(n.pins||[]).map(p=>({...p})),
        connections:(n.connections||[]).map(c=>({...c})),
        ...(n.attachments?.length?{references:n.attachments.map(a=>pick(a,['name','type','size','url']))}:{}),
      })),
      omitted:{nonElectricalComponents:inventory.filter(n=>!ids.has(n.id)).length,fields:['layout positions','history','baseline snapshots','parts checklist','PCB snapshots','attachment payloads']},
      requirementsFile:'missing-requirements.md'
    };
  }
  // One pin per line permits bounded file-reader pagination without pretty-print bloat.
  function text(project){
    const view=build(project),entries=Object.entries(view).filter(([k])=>k!=='components');
    const lines=['{',...entries.map(([k,v])=>JSON.stringify(k)+':'+JSON.stringify(v)+','),'"components":['];
    view.components.forEach((n,i)=>{
      lines.push('{');const fields=Object.entries(n);
      fields.forEach(([key,value],j)=>{
        const suffix=j<fields.length-1?',':'';
        if(['pins','pinSections','connections'].includes(key)&&value.length){lines.push(JSON.stringify(key)+':[');value.forEach((v,k)=>lines.push(JSON.stringify(v)+(k<value.length-1?',':'')));lines.push(']'+suffix);}
        else lines.push(JSON.stringify(key)+':'+JSON.stringify(value)+suffix);
      });lines.push('}'+(i<view.components.length-1?',':''));
    });lines.push(']}');return lines.join('\n')+'\n';
  }
  if(typeof module==='object'&&module.exports)module.exports={build,text};else root.PartmapWiringContext={build,text};
})(typeof globalThis==='object'?globalThis:this);
