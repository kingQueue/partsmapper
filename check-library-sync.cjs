const assert=require('assert/strict'),vm=require('vm'),fs=require('fs');
const ctx={console,esc:s=>String(s),localStorage:{setItem(){}},checkedTemplate:raw=>structuredClone(raw),libraryCardHTML:()=>'<small>2 pins</small>',renderInspector(){},document:{},calls:0,renders:0};
vm.createContext(ctx);vm.runInContext(`
let projectFolder={id:'one',revision:'old',projectRevision:'source'},folderLoading=false,folderBlocked=false,folderPending=false,folderSaving=null;
let savedComponentLibrary=[],defaultComponentLibrary=[],workbenchView='map';const LIBRARY_KEY='test';
function renderComponentLibrary(){renders++;}function renderPcb(){}function toast(){}function folderStatus(){}
async function folderApi(){calls++;return response;}
const beforeProject={nodes:[{id:'untouched-board'}]};let project=beforeProject;
`,ctx);
vm.runInContext(fs.readFileSync('dist/library-research.js','utf8'),ctx);
ctx.response={id:'one',projectRevision:'source',revision:'with-library',libraryRevision:'new-library',library:{customIds:['researched'],components:[{id:'researched',name:'Fixture',pins:[{id:'g',name:'GND',number:'1'}],pinSections:[{id:'left',name:'Left',side:'left'}],research:{status:'draft',sources:[{url:'https://manufacturer.example'}]}}]}};
const run=s=>vm.runInContext(s,ctx);
(async()=>{
  await run('refreshResearchLibrary()');assert.equal(run('savedComponentLibrary[0].research.status'),'draft');assert.equal(run('savedComponentLibrary[0].pins[0].number'),'1');assert.equal(run('projectFolder.revision'),'with-library');assert.equal(run('project===beforeProject'),true);assert.equal(ctx.renders,1);
  await run('refreshResearchLibrary()');assert.equal(ctx.renders,1);
  ctx.response={...ctx.response,projectRevision:'different-source',revision:'must-not-rebase',libraryRevision:'another-library'};
  await run('refreshResearchLibrary()');assert.equal(run('projectFolder.revision'),'with-library');assert.equal(ctx.renders,1);
  run('folderPending=true');const count=ctx.calls;await run('refreshResearchLibrary()');assert.equal(ctx.calls,count);
  assert.ok(run("libraryCardHTML({research:{status:'draft'}})").includes('review needed'));
  console.log('Passed: researched templates refresh from disk without map mutation, metadata/pins survive, unchanged libraries avoid rerendering, edited projects are not silently rebased, pending saves pause refresh and drafts are labelled.');
})().catch(e=>{console.error(e);process.exitCode=1;});
