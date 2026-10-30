// Narrow edits: never trust a model to reconstruct the component inventory.
const key=(a,b)=>JSON.stringify([a,b].map(e=>[e.component,e.pin]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y))));
const problem=message=>Object.assign(Error(message),{code:'WIRING_REJECTED',hint:'Use exact current component/pin IDs from parts_wiring_context. Unsupported routes belong in blocked; no edits from this batch were saved.'});
function role(n,p){
  const label=String(p.name||'').trim().toUpperCase().replace(/[−–]/g,'-'),type=String(p.type||'').toLowerCase();
  // These labels identify functions, not voltage/current compatibility. Do not infer supplies.
  if(/^(?:GND|AGND|DGND|GROUND)$/.test(label))return 'ground';
  if(/^(?:VCC|VDD|V\+|VBAT|VSYS|VBUS|VIN|3V3|3\.3V|5V|12V)$/.test(label))return 'power';
  if(n.category==='motor'&&/^M[+-]$/.test(label))return 'motor-terminal';
  if(/encoder/i.test(n.name+' '+n.model)&&/^(?:A|B|OUTA|OUTB|CHANNEL A|CHANNEL B)$/.test(label))return 'encoder-output';
  if(/^(?:GPIO\s*\d+|GP\s*\d+|SDA|SCL|OE|PWM|SIGNAL)$/.test(label))return 'signal';
  if(['power','ground'].includes(type))return type;
  return ['','unknown','unspecified'].includes(type)?'unknown':'signal';
}
function pwmController(n){return /pca9685|16.channel pwm|servo.*(?:driver|controller)/i.test(n.name+' '+n.model)||(n.pinSections||[]).some(s=>s.style==='servo-bank');}
function conflict(a,p,b,q){
  const ar=role(a,p),br=role(b,q),rail=r=>r==='power'||r==='ground',signal=r=>r==='signal'||r==='encoder-output';
  if((rail(ar)&&signal(br))||(rail(br)&&signal(ar))||(rail(ar)&&rail(br)&&ar!==br))return 'Pin-function conflict: '+a.name+' / '+p.name+' ('+ar+') to '+b.name+' / '+q.name+' ('+br+').';
  if((ar==='motor-terminal'&&pwmController(b))||(br==='motor-terminal'&&pwmController(a)))return 'DC motor terminals require an appropriate motor power driver; a servo/PCA9685 header is not that driver.';
  if((ar==='encoder-output'&&pwmController(b))||(br==='encoder-output'&&pwmController(a)))return 'Quadrature encoder outputs cannot be used as inputs to a servo/PCA9685 output controller.';
  return null;
}
function review(project){
  const nodes=new Map(project.nodes.map(n=>[n.id,n])),issues=[];
  for(const n of project.nodes)for(const c of n.connections||[]){
    const b=nodes.get(c.target),p=n.pins?.find(p=>p.id===c.localPinId),q=b?.pins?.find(p=>p.id===c.remotePinId);
    if(!p||!q)continue;const needed=conflict(n,p,b,q);
    if(needed)issues.push({from:{component:n.id,pin:p.id},to:{component:b.id,pin:q.id},needed});
  }
  return issues;
}
function apply(current,{connections,blocked,assumptions,remove=[]}){
  const next=structuredClone(current),nodes=new Map(next.nodes.map(n=>[n.id,n]));
  function endpoint(e){const n=nodes.get(e.component),p=n?.pins?.find(p=>p.id===e.pin);if(!n||!p)throw problem('Unknown endpoint '+e.component+' / '+e.pin);return {n,p};}
  function route(c){const a=endpoint(c.from),b=endpoint(c.to);if(a.n.id===b.n.id)throw problem('Connections within the same component are unsupported.');return {a,b,key:key(c.from,c.to)};}
  const existing=new Map();for(const n of next.nodes)for(const c of n.connections||[])existing.set(key({component:n.id,pin:c.localPinId},{component:c.target,pin:c.remotePinId}),{n,c});
  const requested=new Set(),removed=new Set();let added=0,unchanged=0;
  for(const c of remove){const r=route(c);if(removed.has(r.key))throw problem('Duplicate removal in batch.');removed.add(r.key);if(!existing.has(r.key))throw problem('Cannot remove a connection that does not exist.');}
  for(const c of connections){
    const r=route(c);if(requested.has(r.key))throw problem('Duplicate connection in batch (including reversed endpoints).');requested.add(r.key);
    if(removed.has(r.key))throw problem('The same connection cannot be added and removed in one batch.');
    const issue=conflict(r.a.n,r.a.p,r.b.n,r.b.p);if(issue)throw problem(issue+' Remove this proposal and report the missing requirement in blocked.');
    const type=p=>String(p.type||'unspecified').trim().toLowerCase(),at=type(r.a.p),bt=type(r.b.p);
    const rail=t=>['ground','power'].includes(t),known=t=>!['unspecified','unknown',''].includes(t);
    if((known(at)&&known(bt))&&((rail(at)!==rail(bt))||(rail(at)&&at!==bt)))throw problem('Explicit pin-type conflict: '+r.a.p.name+' ('+at+') to '+r.b.p.name+' ('+bt+').');
    if(existing.has(r.key)){unchanged++;continue;}
    r.a.n.connections??=[];r.a.n.connections.push({target:r.b.n.id,localPinId:r.a.p.id,remotePinId:r.b.p.id,local:r.a.p.name,remote:r.b.p.name,reason:c.reason});added++;
  }
  for(const b of blocked){if(!nodes.has(b.component))throw problem('Unknown blocked component '+b.component);for(const pin of b.pins)endpoint({component:b.component,pin});}
  for(const n of next.nodes)n.connections=(n.connections||[]).filter(c=>!removed.has(key({component:n.id,pin:c.localPinId},{component:c.target,pin:c.remotePinId})));
  const markdown='# Wiring requirements review\n\n'+(blocked.length?'Status: unresolved requirements remain.':'Status: no blockers reported by the agent; hardware and firmware remain untested.')+'\n\n'+
    '## Unresolved requirements\n'+(blocked.length?blocked.map(b=>'- '+JSON.stringify(b.component)+' / pins '+JSON.stringify(b.pins)+': '+b.needed.replace(/\r?\n/g,' ')).join('\n'):'- None reported.')+'\n\n## Assumptions\n'+(assumptions.length?assumptions.map(a=>'- '+a.replace(/\r?\n/g,' ')).join('\n'):'- None reported.')+'\n\n## Applied changes\n'+connections.map(c=>'- '+JSON.stringify(c.from)+' ↔ '+JSON.stringify(c.to)+': '+c.reason.replace(/\r?\n/g,' ')).join('\n')+'\n\nStructural validation and pin-type checks do not certify voltage/current compatibility, circuit safety, or powered operation.\n';
  next.requirementsDocument={name:'missing-requirements.md',markdown,updatedAt:new Date().toISOString()};
  next.wiringTask=null;
  return {project:next,added,removed:removed.size,unchanged,blocked:blocked.length,markdown};
}
module.exports={apply,review};
