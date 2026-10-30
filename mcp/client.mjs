#!/usr/bin/env node
// CLI for connection tests and the Character Room adapter. Uses the official MCP client.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
const serverPath=fileURLToPath(new URL('./server.mjs',import.meta.url));
const args=process.argv.slice(2);let project,allowWrites=false,selfTest=false,call,bridge=false,logDir;
for(let i=0;i<args.length;i++){
  if(args[i]==='--project')project=args[++i];else if(args[i]==='--allow-writes')allowWrites=true;else if(args[i]==='--self-test')selfTest=true;else if(args[i]==='--call')call=args[++i];else if(args[i]==='--character-room')bridge=true;else if(args[i]==='--log-dir')logDir=args[++i];else throw Error('Unknown client option: '+args[i]);
}
let stderr='';
const transport=new StdioClientTransport({command:process.execPath,args:[serverPath,'--project',project||'',...(allowWrites?['--allow-writes']:[]),...(logDir?['--log-dir',logDir]:[])],stderr:'pipe'});
transport.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-8000);});
const client=new Client({name:bridge?'character-room-partmap':'partmap-access-test',version:'1.0.0'});
function unpack(result){if(result.structuredContent)return result.structuredContent;const text=result.content?.find(c=>c.type==='text')?.text||'';try{return JSON.parse(text);}catch{return {ok:!result.isError,content:text};}}
const invoke=async(name,arguments_)=>unpack(await client.callTool({name,arguments:arguments_},undefined,{timeout:30000}));
async function stdin(){let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>20*1024*1024)throw Error('Client request exceeds 20 MiB.');}return JSON.parse(raw);}
try{
  await client.connect(transport,{timeout:15000});
  const catalog=await client.listTools();
  let result;
  if(selfTest){
    const status=await invoke('partmap_status',{}),proof=await invoke('partmap_self_test',{write_test:allowWrites});
    // Intentional schema error verifies both error responses and the log path.
    const errorProbe=await invoke('partmap_validate_project',{invented_flag:true});
    const diagnostics=await invoke('partmap_export_diagnostics',{save:allowWrites});
    result={ok:status.ok&&proof.ok&&proof.passed&&proof.projectUnchanged&&errorProbe.error?.code==='INVALID_ARGUMENTS'&&diagnostics.ok,tools:catalog.tools.map(t=>t.name),status,proof,errorProbe:{expectedError:true,...errorProbe},diagnostics};
  }else if(bridge){
    const request=await stdin(),mapping={wiring_context:'partmap_wiring_context',connect:'partmap_connect',read:'partmap_read_project',write:'partmap_write_project',validate:'partmap_validate_project',analyze:'partmap_analyze_project',export:'partmap_export_project',self_test:'partmap_self_test',diagnostics:'partmap_export_diagnostics',status:'partmap_status'};
    const name=mapping[request.command];if(!name)throw Error('Unsupported Character Room Partmap operation.');
    const input=request.arguments||{};if(input.expected_sha256==='')delete input.expected_sha256;if(!input.path&&['read','write','validate','analyze','export'].includes(request.command))input.path=await fs.stat(path.join(project,'project.json')).then(()=> 'project.json').catch(()=> 'parts.json');
    result=await invoke(name,input);
  }else{result=await invoke(call||'partmap_status',call?await stdin():{});}
  process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1;
}catch(error){
  process.stdout.write(JSON.stringify({ok:false,error:{code:'MCP_CONNECTION_ERROR',message:error.message,hint:'Check Node.js, npm ci, the absolute server/project paths, then reconnect the MCP client.'},serverStderr:stderr})+'\n');process.exitCode=1;
}finally{await client.close().catch(()=>{});}
