// Reuse the studio's validators so the server and browser speak the same model.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.join(__dirname,'..','dist');
const elements=new Map();
const element=s=>{if(!elements.has(s))elements.set(s,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:''});return elements.get(s);};
const context={document:{querySelector:element,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},structuredClone,crypto:crypto.webcrypto,FluidifyModel:require('../dist/fluid-model.js'),console:{log(){},warn(){},error(){}},setTimeout:()=>0,clearTimeout(){},performance,TextEncoder,Blob};
vm.createContext(context);
for(const name of ['app','studio','hardware','clipboard','workbench','assembly','project-notes','wiring-guard']){
  const source=fs.readFileSync(path.join(root,name+'.js'),'utf8').replace(/\n(?:render\(\)|initializeHardware\(\)|initializeComponentClipboard\(\)|initializeWorkbench\(\)|initializeAssembly\(\)|initializeProjectNotes\(\));\s*$/,'');
  vm.runInContext(source,context,{timeout:2000,filename:name+'.js'});
}
function run(source,values){Object.assign(context,values);try{return structuredClone(vm.runInContext(source,context,{timeout:3000}));}finally{for(const key of Object.keys(values))delete context[key];}}
exports.validate=raw=>run('validate(modelInput)',{modelInput:structuredClone(raw)});
exports.wiring=(current,incoming)=>run('applyWiringUpdate(modelCurrent,modelInput)',{modelCurrent:structuredClone(current),modelInput:structuredClone(incoming)});
exports.brief=raw=>{const text=run('project=validate(modelInput);brief()',{modelInput:structuredClone(raw)});return raw.fluidify?text+'\n\n## Experimental fluid circuit\nConceptual fluid connections; pressure/flow compatibility is not simulated.\n'+JSON.stringify(require('../dist/fluid-model.js').validate(raw.fluidify),null,2):text;};

exports.libraryTemplate=raw=>run('checkedTemplate(modelInput)',{modelInput:structuredClone(raw)});
exports.defaultLibrary=()=>run('defaultComponentLibrary',{});
