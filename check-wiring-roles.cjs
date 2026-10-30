const assert=require('assert/strict'),edits=require('./mcp/wiring-edits.cjs');
const pin=(id,name)=>({id,name,type:'unspecified'});
const nodes=[
  {id:'cpu',name:'RP2040 board',category:'board',pins:[pin('gpio','GP3'),pin('gnd','GND'),pin('sda','GP0')]},
  {id:'pwm',name:'16-channel PWM driver',category:'board',pins:[pin('rail','V+'),pin('out','PWM'),pin('gnd','GND'),pin('sda','SDA')]},
  {id:'motor',name:'DC wheel motor',category:'motor',pins:[pin('pos','M+'),pin('neg','M−')]},
  {id:'encoder',name:'Wheel encoder',category:'sensor',pins:[pin('a','A'),pin('b','B'),pin('ground','GND')]}
].map(n=>({...n,connections:[]}));
const project={name:'Role fixture',nodes},route=(a,p,b,q)=>({from:{component:a,pin:p},to:{component:b,pin:q},reason:'Fixture'});
const batch=connections=>({connections,blocked:[],assumptions:[]});
for(const connection of [route('cpu','gpio','pwm','rail'),route('pwm','out','motor','pos'),route('pwm','gnd','motor','neg'),route('encoder','a','pwm','out'),route('encoder','b','pwm','sda')]){
  const before=JSON.stringify(project);assert.throws(()=>edits.apply(project,batch([connection])),e=>e.code==='WIRING_REJECTED');assert.equal(JSON.stringify(project),before);
}
const valid=edits.apply(project,batch([route('cpu','gnd','pwm','gnd'),route('cpu','sda','pwm','sda')]));assert.equal(valid.added,2);
const legacy=structuredClone(project);legacy.nodes[0].connections=[{target:'pwm',localPinId:'gpio',remotePinId:'rail'}];
assert.equal(edits.review(legacy).length,1);
const removed=edits.apply(legacy,{connections:[],remove:[route('cpu','gpio','pwm','rail')],blocked:[{component:'cpu',pins:['gpio'],needed:'Confirm actuator power source'}],assumptions:[]});
assert.equal(removed.removed,1);assert.equal(edits.review(removed.project).length,0);
console.log('Passed: untyped GPIO/rail, motor/servo-header and encoder/PWM conflicts rejected atomically; ground/I2C accepted structurally; existing invalid routes reported and explicitly removable.');
