import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {projectRelative} from './mcp/paths.mjs';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'partmap-mcp-test-')),project=path.join(temp,'project'),logs=path.join(temp,'logs');
await fs.mkdir(project);const seed={schemaVersion:'2.0',name:'MCP fixture',nodes:[{id:'board',name:'ESP32',category:'board',quantity:1,parent:null,pins:[{id:'gnd',name:'GND',section:'main',type:'ground',notes:''}],pinSections:[{id:'main',name:'Main',parent:null,side:'left',style:'standard'}],connections:[],attachments:[]}]};
await fs.writeFile(path.join(project,'project.json'),JSON.stringify(seed));
for(const spelling of ['project.json','./project.json','D:/part_map_demo/project.json','D:\\part_map_demo\\project.json','/project.json'])assert.equal(projectRelative('D:/part_map_demo',spelling,'win32'),'project.json');
assert.equal(projectRelative('D:/part_map_demo','/wiring-handoff/project.json','win32'),'wiring-handoff/project.json');
assert.equal(projectRelative('D:/part_map_demo','wiring-handoff\\project.json','win32'),'wiring-handoff/project.json');
for(const spelling of ['D:/part_map_demo-other/project.json','C:/outside/project.json','../project.json','D:relative.json','//server/share/file.json','D:/part_map_demo/../secret.json'])assert.throws(()=>projectRelative('D:/part_map_demo',spelling,'win32'),/unsafe|outside/);
assert.equal(projectRelative('/project','/project/project.json','linux'),'project.json');
assert.throws(()=>projectRelative('/project','/outside/project.json','linux'),/outside/);
const clients=[];
async function connect(writable){const c=new Client({name:'integration-test',version:'1'}),t=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./mcp/server.mjs',import.meta.url)),'--project',project,'--log-dir',logs,...(writable?['--allow-writes']:[])],stderr:'pipe'});let stderr='';t.stderr?.on('data',b=>stderr+=b);try{await c.connect(t,{timeout:10000});}catch(e){throw Error(e.message+'\n'+stderr);}clients.push(c);return c;}
async function call(c,name,args={}){const r=await c.callTool({name,arguments:args});assert.ok(r.content[0].text);const body=JSON.parse(r.content[0].text);assert.deepEqual(r.structuredContent,body);if(!body.ok)assert.equal(r.isError,true);return body;}
try{
  const ro=await connect(false);const catalog=await ro.listTools();assert.equal(catalog.tools.length,13);
  assert.ok(catalog.tools.every(t=>t.inputSchema.additionalProperties===false));
  assert.equal((await call(ro,'partmap_status')).allowWrites,false);
  assert.equal((await call(ro,'partmap_self_test')).passed,true);
  assert.equal((await call(ro,'partmap_self_test',{write_test:true})).error.code,'READ_ONLY');
  const bad=await call(ro,'partmap_validate_project',{expected_sha256:'placeholder',args:['--node','parts.read']});assert.equal(bad.error.code,'INVALID_ARGUMENTS');
  assert.equal((await call(ro,'partmap_read_project',{path:'.partmap-project.json'})).error.code,'WRONG_PROJECT_FILE');
  for(const relative of ['../secret.md','C:/Windows/file.md','.git/config','.env','.PARTMAP-PROJECT.json'])assert.equal((await call(ro,'partmap_read_file',{path:relative})).error.code,'PATH_DENIED');
  const rw=await connect(true);
  // Reproduce an unwritable project-metadata path without depending on OS ACLs.
  const obstructed=path.join(project,'.partmap');await fs.writeFile(obstructed,'Metadata path temporarily blocked by this test');
  const blockedProof=await call(rw,'partmap_self_test',{write_test:true});assert.equal(blockedProof.error.code,'PROJECT_WRITE_FAILED');assert.ok(blockedProof.error.details.operation);
  const fallback=await call(rw,'partmap_export_diagnostics',{save:true});assert.equal(fallback.location,'server-log-fallback');assert.equal(fallback.projectWritable,false);assert.equal(fallback.verified,true);assert.ok((await fs.readFile(fallback.savedPath,'utf8')).includes('PROJECT_WRITE_FAILED'));
  await fs.unlink(obstructed);
  const proof=await call(rw,'partmap_self_test',{write_test:true});assert.equal(proof.passed,true);assert.equal(proof.projectUnchanged,true);assert.ok((await fs.readFile(path.join(project,proof.proof.path),'utf8')).includes('access proof'));
  const alias=await call(rw,'partmap_read_project',{path:path.join(project,'project.json')});assert.equal(alias.path,'project.json');assert.equal((await call(rw,'partmap_validate_project',{path:path.join(project,'project.json')})).valid,true);
  const original=await call(rw,'partmap_read_project');assert.equal(original.project.name,seed.name);
  const updated={...original.project,name:'Edited through MCP'};
  assert.equal((await call(rw,'partmap_write_project',{project:updated,expected_sha256:'a'.repeat(64)})).error.code,'REVISION_CONFLICT');
  const save=await call(rw,'partmap_write_project',{project:updated,expected_sha256:original.sha256});assert.equal(save.verified,true);
  assert.equal((await call(rw,'partmap_validate_project')).valid,true);
  assert.equal((await call(rw,'partmap_analyze_project')).part_count,1);
  const wiring={...updated,nodes:[...updated.nodes,{id:'copy',name:'Extra board',category:'board',quantity:1,parent:null}]};
  assert.equal((await call(rw,'partmap_apply_wiring',{project:wiring,expected_sha256:save.sha256})).error.code,'WIRING_REJECTED');
  const wire=await call(rw,'partmap_apply_wiring',{project:updated,expected_sha256:save.sha256});assert.equal(wire.verified,true);

  {
  // Narrow wiring edits never require the model to read/rebuild the full project.
  const beforeContext=await call(rw,'partmap_wiring_context');assert.equal(beforeContext.projectName,updated.name);assert.ok(beforeContext.expected_sha256);assert.ok(!beforeContext.project);assert.equal(beforeContext.context.components[0].id,'board');
  const target={id:'target',name:'Logic module',category:'peripheral',parent:'board',quantity:1,pins:[{id:'ground2',name:'GND',section:'main',type:'ground'},{id:'out',name:'OUT',section:'main',type:'digital'}],pinSections:[{id:'main',name:'Main',side:'left',parent:null}],connections:[],attachments:[],positions:{full:{x:320,y:420}}};
  const currentForConnect=await call(rw,'partmap_read_project');const fixtureProject={...currentForConnect.project,nodes:[...currentForConnect.project.nodes,target],customPreserved:{test:true}};
  const fixtureSave=await call(rw,'partmap_write_project',{project:fixtureProject,expected_sha256:currentForConnect.sha256});assert.equal(fixtureSave.ok,true,JSON.stringify(fixtureSave));
  const context=await call(rw,'partmap_wiring_context');assert.equal(context.contextFileMatches,false);
  const route={from:{component:'board',pin:'gnd'},to:{component:'target',pin:'ground2'},reason:'Documented shared ground in test fixture'};
  const patch={expected_sha256:context.expected_sha256,connections:[route],blocked:[{component:'target',pins:['out'],needed:'Supply and logic voltage unknown'}],assumptions:['Fixture only, no physical validation']};
  assert.equal((await call(ro,'partmap_connect',patch)).error.code,'READ_ONLY');
  assert.equal((await call(rw,'partmap_connect',{...patch,expected_sha256:'0'.repeat(64)})).error.code,'REVISION_CONFLICT');
  const invalid=[{...route,to:{component:'missing',pin:'x'}},{...route,to:route.from},{...route,to:{component:'target',pin:'out'}}];
  for(const r of invalid)assert.equal((await call(rw,'partmap_connect',{...patch,connections:[r]})).error.code,'WIRING_REJECTED');
  assert.equal((await call(rw,'partmap_connect',{...patch,connections:[route,{...route,from:route.to,to:route.from}]})).error.code,'WIRING_REJECTED');
  assert.equal((await call(rw,'partmap_wiring_context')).expected_sha256,context.expected_sha256);
  const connected=await call(rw,'partmap_connect',patch);assert.equal(connected.verified,true,JSON.stringify(connected));assert.equal(connected.added,1);assert.equal(connected.blocked,1);assert.deepEqual(connected.warnings,[]);
  const after=await call(rw,'partmap_read_project');assert.deepEqual(after.project.nodes.map(n=>n.id),fixtureProject.nodes.map(n=>n.id));assert.deepEqual(after.project.customPreserved,{test:true});assert.deepEqual(after.project.nodes[1].positions,target.positions);assert.ok(after.project.requirementsDocument.markdown.includes('Supply and logic voltage unknown'));
  const nextContext=await call(rw,'partmap_wiring_context');assert.equal(nextContext.contextFileMatches,true);assert.equal(nextContext.context.components[0].connections.length,1);
  const repeatedConnect=await call(rw,'partmap_connect',{...patch,expected_sha256:nextContext.expected_sha256});assert.equal(repeatedConnect.added,0);assert.equal(repeatedConnect.unchanged,1);
  const removal=await call(rw,'partmap_connect',{...patch,expected_sha256:repeatedConnect.sha256,connections:[],remove:[route]});assert.equal(removal.removed,1);
  assert.equal((await call(rw,'partmap_validate_project')).valid,true);
  // Test path targeting separately from root: two real projects must never be confused.
  await fs.mkdir(path.join(project,'handoff'));await fs.writeFile(path.join(project,'handoff','project.json'),JSON.stringify(seed));
  const nested=await call(rw,'partmap_wiring_context',{path:'handoff/project.json'});assert.equal(nested.path,'handoff/project.json');assert.equal(nested.projectName,seed.name);
  assert.equal((await call(rw,'partmap_wiring_context')).projectName,updated.name);
  }
  assert.equal((await call(rw,'partmap_write_file',{path:'project.json',content:'{}'})).error.code,'INVALID_OUTPUT');
  assert.equal((await call(rw,'partmap_write_file',{path:path.join(project,'project.json'),content:'{}'})).error.code,'INVALID_OUTPUT');
  assert.equal((await call(rw,'partmap_export_project',{output:path.join(project,'project.json')})).error.code,'INVALID_OUTPUT');
  assert.equal((await call(rw,'partmap_write_file',{path:'context.md',content:'SECRET_TEST_CONTENT'})).verified,true);
  const page=await call(rw,'partmap_read_file',{path:'context.md'});assert.equal(page.content,'SECRET_TEST_CONTENT');
  const contextSave=await call(rw,'partmap_write_file',{path:'context.md',content:'Updated',expected_sha256:page.sha256});assert.equal(contextSave.verified,true);
  assert.equal((await call(rw,'partmap_export_project',{format:'markdown',output:'exports/brief.md'})).verified,true);
  const repeated=await call(rw,'partmap_export_project',{format:'markdown',output:'exports/brief.md'});assert.equal(repeated.ok,true);
  const jsonExport=await call(rw,'partmap_export_project',{format:'json',output:'exports/snapshot.json'});
  const identical=await call(rw,'partmap_export_project',{format:'json',output:'exports/snapshot.json'});assert.equal(identical.unchanged,true);assert.equal(identical.written,false);
  const strictExport=await call(rw,'partmap_export_project',{format:'json',output:'exports/snapshot.json',on_exists:'error'});assert.equal(strictExport.error.code,'READ_REQUIRED');assert.equal(strictExport.error.details.path,'exports/snapshot.json');
  assert.equal(strictExport.error.details.readTool,'partmap_read_file');
  const staleExport=await call(rw,'partmap_export_project',{format:'json',output:'exports/snapshot.json',expected_sha256:'0'.repeat(64)});assert.equal(staleExport.error.code,'REVISION_CONFLICT');
  const refreshedExport=await call(rw,'partmap_export_project',{format:'json',output:'exports/snapshot.json',expected_sha256:jsonExport.sha256});assert.equal(refreshedExport.verified,true);
  await call(rw,'partmap_write_file',{path:'exports/brief.md',content:'Retain this older export',expected_sha256:(await call(rw,'partmap_read_file',{path:'exports/brief.md'})).sha256});
  const newName=await call(rw,'partmap_export_project',{format:'markdown',output:'exports/brief.md'});assert.notEqual(newName.path,'exports/brief.md');assert.equal(newName.requestedOutput,'exports/brief.md');
  assert.equal((await call(rw,'partmap_read_file',{path:'exports/brief.md'})).content,'Retain this older export');

  const target=path.join(temp,'outside');await fs.mkdir(target);await fs.writeFile(path.join(target,'secret.md'),'outside');await fs.symlink(target,path.join(project,'escape'),process.platform==='win32'?'junction':'dir');
  assert.equal((await call(rw,'partmap_read_file',{path:'escape/secret.md'})).error.code,'PATH_DENIED');
  const report=await call(rw,'partmap_export_diagnostics',{save:true});assert.equal(report.verified,true);
  assert.ok(report.report.events.some(e=>e.requestId===bad.requestId&&e.code==='INVALID_ARGUMENTS'));
  assert.ok(!JSON.stringify(report.report).includes('SECRET_TEST_CONTENT'));
  assert.ok((await fs.readdir(path.join(project,'.partmap','mcp-backups'))).length>=1);
  const unknown=await call(rw,'partmap_nonexistent');assert.equal(unknown.error.code,'UNKNOWN_TOOL');
  console.log('Passed: MCP initialize/list/call over real stdio, schemas, read-only and writable access proofs, exact read-back, structured/logged errors, request IDs, project validation/writes, stale hashes, wiring inventory, backups, context/export files, diagnostic redaction, traversal/junction protection, filesystem error details and off-project diagnostic fallback.');
}finally{
  for(const c of clients)await c.close();
  // Only this test-created directory under os.tmpdir is disposable.
  assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('partmap-mcp-test-'));
  await fs.rm(temp,{recursive:true,force:true});
}
