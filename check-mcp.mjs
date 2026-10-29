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
  const ro=await connect(false);const catalog=await ro.listTools();assert.equal(catalog.tools.length,11);
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
  assert.equal((await call(rw,'partmap_write_file',{path:'project.json',content:'{}'})).error.code,'INVALID_OUTPUT');
  assert.equal((await call(rw,'partmap_write_file',{path:path.join(project,'project.json'),content:'{}'})).error.code,'INVALID_OUTPUT');
  assert.equal((await call(rw,'partmap_export_project',{output:path.join(project,'project.json')})).error.code,'INVALID_OUTPUT');
  assert.equal((await call(rw,'partmap_write_file',{path:'context.md',content:'SECRET_TEST_CONTENT'})).verified,true);
  const page=await call(rw,'partmap_read_file',{path:'context.md'});assert.equal(page.content,'SECRET_TEST_CONTENT');
  const contextSave=await call(rw,'partmap_write_file',{path:'context.md',content:'Updated',expected_sha256:page.sha256});assert.equal(contextSave.verified,true);
  assert.equal((await call(rw,'partmap_export_project',{format:'markdown',output:'exports/brief.md'})).verified,true);
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
