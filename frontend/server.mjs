import './server/env.mjs';
import { createTestCaseHandler } from './server/test-case-api.mjs';
import { extractProduct } from './server/product-api.mjs';
const handleTestCase = createTestCaseHandler();
const handleProductCase = createTestCaseHandler({ loadRow: extractProduct, source: 'backend' });
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
const root = fileURLToPath(new URL('./dist', import.meta.url));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  if (new URL(req.url, 'http://localhost').pathname === '/api/product-case') { await handleProductCase(req, res); return; }
  if (new URL(req.url, 'http://localhost').pathname === '/api/test-case') { await handleTestCase(req, res); return; }
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    const file = path === root ? resolve(root, 'index.html') : path;
    const contents = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(contents);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port 5173 is already in use. If Product Court is already running, open http://localhost:5173. Otherwise close the other server and try again.'
    : `Could not start Product Court: ${error.message}`);
  process.exitCode = 1;
});
server.listen(5173, '0.0.0.0', () => {
  console.log('\nProduct Court is running.\n');
  console.log('On this Mac: http://localhost:5173');
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) console.log(`On the same Wi-Fi: http://${entry.address}:5173`);
    }
  }
  console.log('\nOpen a link above in your browser. Keep this Terminal window open.\nPress Control+C to stop the server.\n');
});
