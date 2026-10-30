const assert=require('assert/strict'),{build,text}=require('./dist/wiring-context.js');
const project={name:'Robot',nodes:[
  {id:'frame',name:'Frame',category:'mechanical',parent:null},
  {id:'a',name:'PWM',category:'board',parent:'frame',model:'PCA9685',voltage:'3.3 V logic',notes:'Confirm actuator rail',firmware:'I2C address not confirmed',pinSections:[{id:'left',name:'Left',side:'left'},{id:'right',name:'Right',style:'terminal-block',pinCount:2}],pins:[{id:'g1',name:'GND',section:'left',type:'ground'},{id:'g2',name:'GND',section:'right',type:'ground',notes:'Separate physical pin'}],connections:[{target:'b',localPinId:'g2',remotePinId:'ground',local:'GND',remote:'GND'}],positions:{x:1,y:2},attachments:[{name:'datasheet.pdf',type:'application/pdf',data:'x'.repeat(50000)}]},
  {id:'b',name:'PWM',category:'board',parent:null,pins:[{id:'ground',name:'GND',section:'main'}]},
  {id:'screw',name:'Screw',category:'fastener'},
  {id:'connector',name:'Connector',category:'mechanical',pins:[{id:'p',name:'contact'}]}
],baseline:[{big:'x'.repeat(50000)}],partsChecklist:[],pcb:{},history:[]};
const original=JSON.stringify(project),view=build(project),serialized=text(project);
assert.deepEqual(JSON.parse(serialized),view);assert.equal(JSON.stringify(project),original);
assert.deepEqual(view.components.map(n=>n.id),['frame','a','b','connector']);
assert.deepEqual(view.components[1].pins,project.nodes[1].pins);
assert.deepEqual(view.components[1].pinSections,project.nodes[1].pinSections);
assert.deepEqual(view.components[1].connections,project.nodes[1].connections);
assert.equal(view.components[1].firmware,project.nodes[1].firmware);
assert.ok(view.components.every(n=>!('positions' in n)));assert.ok(!serialized.includes('xxxxx'));assert.ok(!view.nodes);
assert.ok(Buffer.byteLength(serialized)<Buffer.byteLength(original)/10);
project.nodes[1].pins.pop();assert.equal(build(project).components[1].pins.length,1);
project.nodes=project.nodes.filter(n=>n.id!=='b');assert.ok(!build(project).components.some(n=>n.id==='b'));
assert.equal(JSON.parse(text({name:'Empty',nodes:[]})).components.length,0);
assert.ok(serialized.split('\n').every(line=>line.length<24000));
console.log('Passed: compact context preserves duplicate devices/physical pins, header styles, connections, specs, mechanical ancestors; excludes snapshots/binary payloads; reflects edits without mutating sources; paginates and parses.');
