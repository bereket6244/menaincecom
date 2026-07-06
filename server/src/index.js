import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureSchema, records } from './db.js';
import { ensureAdminSeed } from './auth.js';
import { api } from './routes.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.set('deployVersion', 'shop-backend-20260703-01');
app.disable('x-powered-by');

// Only origins listed in CORS_ORIGIN may call the API cross-origin; with none
// configured the API is same-origin only (the server serves the client itself).
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
app.use(compression({ threshold: 1024 }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '1mb' }));

const basePath = `/${(process.env.APP_BASE_PATH || '').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
const mountPath = basePath === '' ? '/' : basePath;
const uploadsDir = path.join(serverRoot, 'uploads');

fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', immutable: true }));
if (mountPath !== '/') {
  app.use(`${mountPath}/uploads`, express.static(uploadsDir, { maxAge: '30d', immutable: true }));
}

app.use('/api', api);
if (mountPath !== '/') app.use(`${mountPath}/api`, api);

// Production: serve the built client if present.
const clientDist = process.env.CLIENT_DIST_DIR || path.resolve(serverRoot, '../client/dist');
const staticOptions = {
  maxAge: '1y',
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
};
app.use(mountPath, express.static(clientDist, staticOptions));
const sendClientIndex = (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDist, 'index.html'));
};
app.get(`${mountPath}/*`, sendClientIndex);
if (mountPath !== '/') {
  app.use(express.static(clientDist, staticOptions));
  app.get(/^(?!\/(api|uploads)\/).*/, sendClientIndex);
}
if (mountPath === '/') {
  app.get(/^(?!\/(api|uploads)\/).*/, sendClientIndex);
}

const DEFAULT_CATEGORIES = ['Wedding Invitations', 'Save-the-Dates', 'Thank-You Cards', 'Full Suites'];

async function seed() {
  const cats = await records.list('categories');
  if (cats.length === 0) {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      await records.insert('categories', { name: DEFAULT_CATEGORIES[i], sortOrder: i, photo: '' });
    }
    console.log('[seed] default categories created');
  }
  const business = await records.find('content', (c) => c.key === 'business');
  if (!business) {
    await records.insert('content', {
      key: 'business',
      phone: '+251 92 963 9939',
      email: 'hello@menainc.com',
      address: 'Reality Plaza, 1st Floor, Office No. 104, Bole (next to Yougo Church), Addis Ababa',
      hours: 'Mon-Sat, 9:00-18:00',
      whatsappNumber: '251929639939',
      telegramHandle: '+251929639939',
      paymentAccountName: 'CBE (Bereket Girma)',
      paymentAccountNumber: '1000530092732',
      pickupLocation: 'Reality Plaza, 1st Floor, Office No. 104\nBole, next to Yougo Church',
    });
    console.log('[seed] business settings created');
  }
}

// Final safety net: uncaught errors (e.g. multer rejections) become clean
// JSON instead of an HTML stack trace that leaks internals.
app.use((err, _req, res, _next) => {
  console.error('[server] error:', err.message);
  if (res.headersSent) return;
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: 'upload_failed', message: `Upload failed: ${err.message}` });
  }
  res.status(err.status || 500).json({ error: 'server_error', message: 'Unexpected server error.' });
});

const port = Number(process.env.PORT || 4000);
let initialized = false;
let initializing = null;

async function initialize() {
  if (initialized) return;
  if (initializing) return initializing;
  initializing = (async () => {
    try {
      await ensureSchema();
      await ensureAdminSeed();
      await seed();
      console.log('[db] schema ready');
    } catch (err) {
      // Boot anyway: /api/health reports whether writes are available instead
      // of taking the whole storefront down.
      console.error('[db] not reachable at boot:', err.code || err.message);
    } finally {
      initialized = true;
      initializing = null;
    }
  })();
  return initializing;
}

async function start() {
  await initialize();
  const server = app.listen(port, () => console.log(`MENA INC. API listening on http://localhost:${port}`));
  server.on('error', (listenErr) => {
    console.error('[server] listen error:', listenErr.code || listenErr.message);
    process.exitCode = 1;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start();
} else {
  initialize();
}

export { app, initialize, start };
export default app;
