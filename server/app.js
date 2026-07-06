import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let app;

try {
  const mod = await import('./src/index.js');
  app = mod.default || mod.app;
} catch (err) {
  console.error('[startup] full app failed, exporting static fallback:', err?.stack || err?.message || err);
  app = createStaticFallbackHandler();
}

function createStaticFallbackHandler() {
  const serverRoot = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = process.env.CLIENT_DIST_DIR || path.resolve(serverRoot, '../client/dist');
  const basePath = `/${(process.env.APP_BASE_PATH || '').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
  const mountPath = basePath === '' ? '/' : basePath;

  const send = (res, status, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  };

  return (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    const relative = mountPath !== '/' && pathname.startsWith(`${mountPath}/`)
      ? pathname.slice(mountPath.length + 1)
      : pathname.replace(/^\/+/, '');

    if (pathname === '/api/health' || pathname === `${mountPath}/api/health`) {
      send(res, 503, JSON.stringify({
        ok: false,
        db: false,
        writable: false,
        error: 'startup_fallback',
      }), 'application/json; charset=utf-8');
      return;
    }

    if (pathname.startsWith('/api/') || pathname.startsWith(`${mountPath}/api/`)) {
      send(res, 503, JSON.stringify({
        error: 'startup_fallback',
        message: 'The storefront is loading in fallback mode while the API restarts.',
      }), 'application/json; charset=utf-8');
      return;
    }

    const assetPath = relative && !relative.includes('..') ? path.join(clientDist, relative) : '';
    if (assetPath && assetPath.startsWith(clientDist) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      const ext = path.extname(assetPath).toLowerCase();
      const type = {
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      }[ext] || 'application/octet-stream';
      send(res, 200, fs.readFileSync(assetPath), type);
      return;
    }

    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      send(res, 200, fs.readFileSync(indexPath), 'text/html; charset=utf-8');
      return;
    }

    send(res, 503, 'Storefront fallback is running, but client files are missing.');
  };
}

export { app };
export default app;
