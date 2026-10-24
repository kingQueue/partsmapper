const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv', '.txt': 'text/plain', '.md': 'text/markdown' };
const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400);
    return res.end('Invalid URL');
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
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 4173 is already in use. If Partmap is already running, open http://127.0.0.1:4173.' : error.message);
  process.exitCode = 1;
});
server.listen(4173, '127.0.0.1', () => {
  console.log('Partmap is running locally. No sign-in required.');
  console.log('Open http://127.0.0.1:4173');
  console.log('Keep this process running while editing. Press Ctrl+C to stop.');
});
