/* Liten statisk server for lokal testing.
   Mikrofon krever HTTPS eller localhost — denne gir deg localhost.
   Ingen avhengigheter; `node server.js` og du er i gang. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROT = __dirname;
const PORT = 8123;
const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fil = path.join(ROT, p);
  // ingen vei ut av prosjektmappa
  if (!fil.startsWith(ROT)) { res.writeHead(403).end(); return; }
  fs.readFile(fil, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('ikke funnet: ' + p); return; }
    res.writeHead(200, {
      'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, () => console.log('Beatboks: http://localhost:' + PORT));
