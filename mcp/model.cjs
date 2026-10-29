// Reuse the studio's validators so the MCP and browser speak the same model.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.join(__dirname,'..','dist');
const elements=new Map();
const element=s=>{if(!elements.has(s))elements.set(s,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:''});return elements.get(s);};
const context={document:{querySelector:element,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},structuredClone,crypto:crypto.webcrypto,console:{log(){},warn(){},error(){}},setTimeout:()=>0,clearTimeout(){},performance,TextEncoder,Blob};
vm.createContext(context);
for(const name of ['app','studio','hardware','clipboard','workbench','assembly','wiring-handoff','wiring-guard']){
  const source=fs.readFileSync(path.join(root,name+'.js'),'utf8').replace(/\n(?:render\(\)|initializeHardware\(\)|initializeComponentClipboard\(\)|initializeWorkbench\(\)|initializeAssembly\(\)|initializeWiringHandoff\(\));\s*$/,'');
  vm.runInContext(source,context,{timeout:2000,filename:name+'.js'});
}
function run(source,values){Object.assign(context,values);try{return structuredClone(vm.runInContext(source,context,{timeout:3000}));}finally{for(const key of Object.keys(values))delete context[key];}}
exports.validate=raw=>run('validate(mcpInput)',{mcpInput:structuredClone(raw)});
exports.wiring=(current,incoming)=>run('applyWiringUpdate(mcpCurrent,mcpInput)',{mcpCurrent:structuredClone(current),mcpInput:structuredClone(incoming)});
exports.handoff=raw=>run('project=validate(mcpInput);buildWiringHandoffFiles()',{mcpInput:structuredClone(raw)});
exports.brief=raw=>run('project=validate(mcpInput);brief()',{mcpInput:structuredClone(raw)});
