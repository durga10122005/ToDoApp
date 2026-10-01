import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleApiRoute } from './server/api.js';
import { setSecurityHeaders } from './server/security.js';
import { logger } from './server/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);

  // Apply Enterprise Security Headers (CSP, HSTS, X-Content-Type-Options, etc.)
  setSecurityHeaders(res);

  // Handle API Endpoints
  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApiRoute(req, res, url);
    } catch (err) {
      logger.error('Unhandled API exception', err, { path: url.pathname });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred.' }
      }));
    } finally {
      logger.info('API Request processed', {
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        durationMs: Date.now() - startTime
      });
    }
    return;
  }

  // Handle Static Files
  let reqPath = url.pathname;
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    };

    // Service Worker requires scope allowance header
    if (reqPath === '/sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  logger.info(`Enterprise To-Do App server running at http://localhost:${PORT}`);
});
