// Low-memory alternative to `ng serve`.
//
// Serves the production build in frontend/dist/frontend/browser and forwards /api
// to the backend, so the app behaves exactly as it does under `npm start` but in
// ~60 MB instead of well over a gigabyte. Useful when the machine is short on RAM.
// Node built-ins only, no dependencies.
//
//   node scripts/serve-frontend.mjs [port] [backend-origin]
//   defaults: 4200, http://localhost:8080
//
// Rebuild the UI after changing frontend source: cd frontend && npm run build

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..', 'frontend', 'dist', 'frontend', 'browser');
const PORT = Number(process.argv[2] || 4200);
const BACKEND = new URL(process.argv[3] || 'http://localhost:8080');

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`No production build found at ${ROOT}\nRun: cd frontend && npm run build`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function proxy(req, res) {
  const upstream = http.request(
    {
      hostname: BACKEND.hostname,
      port: BACKEND.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: BACKEND.host },
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 502, message: `Backend unreachable at ${BACKEND.origin}: ${err.code || err.message}` }));
  });
  req.pipe(upstream);
}

function sendFile(res, file) {
  const body = fs.readFileSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  // Hashed bundles may be cached; index.html must not be.
  const cache = path.basename(file) === 'index.html' ? 'no-store' : 'public, max-age=3600';
  res.writeHead(200, { 'content-type': type, 'content-length': body.length, 'cache-control': cache });
  res.end(body);
}

http
  .createServer((req, res) => {
    if (req.url === '/api' || req.url.startsWith('/api/')) return proxy(req, res);

    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const candidate = path.join(ROOT, urlPath);
    // Never serve outside the build directory.
    if (!candidate.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (urlPath !== '/' && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return sendFile(res, candidate);
    }
    // Angular client-side routes: every other path falls back to index.html.
    sendFile(res, path.join(ROOT, 'index.html'));
  })
  .listen(PORT, () => {
    console.log(`Carbon Marketplace UI on http://localhost:${PORT}  (API -> ${BACKEND.origin})`);
  });
