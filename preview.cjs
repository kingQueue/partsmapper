const http = require('http');
const fs = require('fs');
const path = require('path');

const store = require('./project-store.cjs');
const manager = require('./project-manager.cjs');
const autoWire = require('./auto-wire.cjs');
const {spawn}=require('child_process');
const crypto = require('crypto');
const root = path.join(__dirname, 'dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv', '.txt': 'text/plain', '.md': 'text/markdown' };
function createPartmapServer({config=store.DEFAULT_CONFIG}={}) {
const token=crypto.randomBytes(32).toString('hex');let writes=Promise.resolve();
const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400);
    return res.end('Invalid URL');
  }
  if (pathname.startsWith('/api/')) {
    const port=server.address()?.port,allowed=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
    const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    if(!allowed.has(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&!new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]).has(req.headers.origin)))return reply(403,{error:'Project APIs only accept requests from this local app.'});
    try {
      if(pathname==='/api/projects'&&req.method==='GET')return reply(200,{...await manager.list(config),token});
      if(pathname==='/api/workspace'&&req.method==='GET')return reply(200,{...(await store.readWorkspace(config)),token});
      if(req.method!=='POST'||req.headers['x-partmap-token']!==token||!String(req.headers['content-type']).startsWith('application/json'))return reply(403,{error:'Invalid project request.'});
      const chunks=[];let size=0;for await (const chunk of req){size+=chunk.length;if(size>64*1024*1024)throw Object.assign(Error('Project request exceeds 64 MB.'),{status:413});chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(pathname==='/api/workspace/wiring-result')return reply(200,await autoWire.workspaceResult(config,body.workspaceId));
      if(pathname==='/api/workspace/auto-wire'){
        const w=await store.readWorkspace(config);if(!w.directory||w.id!==body.workspaceId)throw Error('Selected project changed.');
        const existing=await autoWire.readResult(w.directory,w.project);if(existing.found)return reply(200,{existing:true,result:existing});
        if(!body.agentId)return reply(200,await autoWire.bridge('listeners'));
        const input=JSON.stringify({agent_id:body.agentId});
        const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,'mcp','client.mjs'),'--project',w.directory,'--allow-writes','--call','partmap_request_auto_wiring'],{windowsHide:true});let output='';child.stdout.on('data',b=>{output+=b;if(output.length>100000){child.kill();reject(Error('MCP response too large.'));}});child.on('error',reject);child.on('close',()=>{try{const data=JSON.parse(output);if(!data.ok)reject(Error(data.error?.message||'Auto wiring dispatch failed.'));else resolve(data);}catch(e){reject(e);}});child.stdin.end(input);});return reply(200,result);
      }
      if(pathname==='/api/workspace/auto-wire-status')return reply(200,await autoWire.bridge('jobs/'+encodeURIComponent(body.jobId)));
      if(pathname==='/api/projects/folders')return reply(200,await manager.folders(body.directory));
      const operation=pathname==='/api/projects/activate'?()=>manager.activate(config,body):pathname==='/api/workspace/save'?()=>store.saveWorkspace(config,body):pathname==='/api/workspace/export'?()=>store.saveExport(config,body):null;
      if(!operation)return reply(404,{error:'Unknown project operation.'});
      const result=writes.then(operation);writes=result.catch(()=>{});return reply(200,await result);
    }catch(error){return reply(error.status||500,{error:error.message});}
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (error, contents) => {
    if (error) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(contents);
  });
});
return server;
}
module.exports={createPartmapServer};
if(require.main===module){
const server=createPartmapServer();
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 4173 is already in use. If Partmap is already running, open http://127.0.0.1:4173.' : error.message);
  process.exitCode = 1;
});
server.listen(4173, '127.0.0.1', () => {
  console.log('Partmap is running locally. No sign-in required.');
  console.log('Open http://127.0.0.1:4173');
  console.log('Keep this process running while editing. Press Ctrl+C to stop.');
});

}
