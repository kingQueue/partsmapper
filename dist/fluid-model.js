(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FluidifyModel=api;})(globalThis,function(){
  'use strict';
  const kinds={reservoir:{name:'Reservoir',icon:'▱',ports:[['Supply','out'],['Return','in']]},pump:{name:'Pump',icon:'◉',ports:[['Inlet','in'],['Outlet','out']]},valve:{name:'Control valve',icon:'⋈',ports:[['Inlet','in'],['Outlet','out']]},check_valve:{name:'Check valve',icon:'▷',ports:[['Inlet','in'],['Outlet','out']]},pipe:{name:'Pipe / hose',icon:'━',ports:[['End A','bidirectional'],['End B','bidirectional']]},junction:{name:'Tee / junction',icon:'┳',ports:[['Port A','bidirectional'],['Port B','bidirectional'],['Port C','bidirectional']]},filter:{name:'Filter',icon:'▧',ports:[['Inlet','in'],['Outlet','out']]},accumulator:{name:'Accumulator',icon:'▰',ports:[['Fluid','bidirectional']]},gauge:{name:'Pressure gauge',icon:'◴',ports:[['Pressure tap','bidirectional']]},cylinder:{name:'Cylinder',icon:'⊣',ports:[['Cap end','bidirectional'],['Rod end','bidirectional']]},fluid_motor:{name:'Fluid motor',icon:'⊗',ports:[['Inlet','in'],['Outlet','out']]},custom:{name:'Custom fluid part',icon:'◇',ports:[['Port A','bidirectional'],['Port B','bidirectional']]}};
  const id=()=>globalThis.crypto?.randomUUID?.()||'fluid-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const text=(v,max=200)=>typeof v==='string'&&v.length<=max;
  function empty(){return {format:'partmap.fluid-circuit',version:1,name:'Fluid circuit',nodes:[],connections:[],viewport:{x:40,y:40,scale:1}};}
  function validate(raw){
    if(raw==null)return null;
    if(raw.format!=='partmap.fluid-circuit'||raw.version!==1||!text(raw.name)||!raw.name.trim()||!Array.isArray(raw.nodes)||raw.nodes.length>300||!Array.isArray(raw.connections)||raw.connections.length>1200)throw Error('Invalid Fluidify circuit document.');
    const copy=structuredClone(raw),ids=new Set();
    for(const n of copy.nodes){
      if(!n||!text(n.id)||!n.id||ids.has(n.id)||!Object.hasOwn(kinds,n.kind)||!text(n.name)||!n.name.trim()||!Number.isInteger(n.quantity)||n.quantity<1||n.quantity>100000||!finite(n.x)||!finite(n.y)||Math.abs(n.x)>100000||Math.abs(n.y)>100000||!text(n.medium,80)||!text(n.notes,6000)||!text(n.model)||!Array.isArray(n.ports)||n.ports.length>24)throw Error('Invalid fluid mechanical component.');
      ids.add(n.id);const ports=new Set();
      for(const p of n.ports){if(!p||!text(p.id)||!p.id||ports.has(p.id)||!text(p.name,80)||!p.name.trim()||!['in','out','bidirectional'].includes(p.direction))throw Error('Fluid ports need unique IDs, names and valid flow directions.');ports.add(p.id);}
      for(const key of ['maxPressureBar','flowLMin','boreMm'])if(n[key]!=null&&(!finite(n[key])||n[key]<0||n[key]>1e9))throw Error('Fluid specifications must be non-negative numbers or left blank.');
    }
    for(const n of copy.nodes){if(n.parent!=null&&!ids.has(n.parent))throw Error('A fluid assembly parent is missing.');let cur=n;const seen=new Set();while(cur){if(seen.has(cur.id))throw Error('Fluid assembly hierarchy contains a cycle.');seen.add(cur.id);cur=copy.nodes.find(x=>x.id===cur.parent);}}
    const used=new Set(),wires=new Set();
    for(const c of copy.connections){if(!c||!text(c.id)||!c.id||wires.has(c.id)||!text(c.notes,1000))throw Error('Invalid fluid connection.');wires.add(c.id);checkConnection(copy,c.from,c.to,used);used.add(c.from.component+':'+c.from.port);used.add(c.to.component+':'+c.to.port);}
    const v=copy.viewport||{x:40,y:40,scale:1};if(!finite(v.x)||!finite(v.y)||Math.abs(v.x)>100000||Math.abs(v.y)>100000||!finite(v.scale)||v.scale<.15||v.scale>3)throw Error('Invalid fluid map viewport.');copy.viewport=v;return copy;
  }
  function checkConnection(circuit,from,to,used=null){
    const a=circuit.nodes.find(n=>n.id===from?.component),b=circuit.nodes.find(n=>n.id===to?.component),ap=a?.ports.find(p=>p.id===from?.port),bp=b?.ports.find(p=>p.id===to?.port);
    if(!ap||!bp||a===b)throw Error('Choose ports on two separate fluid components.');
    if(ap.direction==='in'||bp.direction==='out')throw Error('Connect an outlet or bidirectional port to an inlet or bidirectional port.');
    const occupied=used||new Set(circuit.connections.flatMap(c=>[c.from.component+':'+c.from.port,c.to.component+':'+c.to.port]));
    if(occupied.has(from.component+':'+from.port)||occupied.has(to.component+':'+to.port))throw Error('A port already has a hose. Add a tee/junction to branch the circuit.');
  }
  function add(circuit,kind,point={x:80,y:80}){if(!Object.hasOwn(kinds,kind))throw Error('Choose a fluid mechanical component.');if(!finite(point.x)||!finite(point.y)||Math.abs(point.x)>100000||Math.abs(point.y)>100000)throw Error('Choose a position within the fluid map.');if(circuit.nodes.length>=300)throw Error('Maximum 300 fluid components.');const spec=kinds[kind],number=circuit.nodes.filter(n=>n.kind===kind).length+1,n={id:id(),name:spec.name+(number>1?' '+number:''),kind,model:'',quantity:1,parent:null,x:point.x,y:point.y,medium:'',maxPressureBar:null,flowLMin:null,boreMm:null,notes:'',ports:spec.ports.map(([name,direction])=>({id:id(),name,direction}))};circuit.nodes.push(n);return n;}
  function connect(circuit,from,to){checkConnection(circuit,from,to);const wire={id:id(),from:{...from},to:{...to},notes:''};circuit.connections.push(wire);return wire;}
  function remove(circuit,selection){const ids=new Set(selection);circuit.nodes=circuit.nodes.filter(n=>!ids.has(n.id));for(const n of circuit.nodes)if(ids.has(n.parent))n.parent=null;circuit.connections=circuit.connections.filter(c=>!ids.has(c.from.component)&&!ids.has(c.to.component));}
  function duplicate(circuit,source,offset=36){
    if(circuit.nodes.length+source.nodes.length>300)throw Error('Maximum 300 fluid components.');
    const nodes=new Map(),ports=new Map(),copies=source.nodes.map(n=>{const c=structuredClone(n);nodes.set(n.id,c.id=id());c.name=n.name+' copy';c.x+=offset;c.y+=offset;c.ports=c.ports.map(p=>{const old=p.id;p.id=id();ports.set(n.id+':'+old,p.id);return p;});return c;});
    for(let i=0;i<copies.length;i++)copies[i].parent=nodes.get(source.nodes[i].parent)||null;
    const connections=source.connections.filter(c=>nodes.has(c.from.component)&&nodes.has(c.to.component)).map(c=>({id:id(),notes:c.notes,from:{component:nodes.get(c.from.component),port:ports.get(c.from.component+':'+c.from.port)},to:{component:nodes.get(c.to.component),port:ports.get(c.to.component+':'+c.to.port)}}));
    const candidate={...circuit,nodes:[...circuit.nodes,...copies],connections:[...circuit.connections,...connections]};validate(candidate);circuit.nodes=candidate.nodes;circuit.connections=candidate.connections;return copies;
  }
  function descendants(circuit,id){const ids=new Set([id]);let size;do{size=ids.size;for(const n of circuit.nodes)if(ids.has(n.parent))ids.add(n.id);}while(size!==ids.size);return ids;}
  function bounds(n){return {x:n.x,y:n.y,width:228,height:84+n.ports.length*30};}
  return {kinds,empty,validate,add,connect,remove,duplicate,descendants,bounds,id};
});
