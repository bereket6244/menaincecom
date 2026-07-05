import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
app.use(mountPath, express.static(clientDist));
app.get(`${mountPath}/*`, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
if (mountPath !== '/') {
  app.use(express.static(clientDist));
  app.get(/^(?!\/(api|uploads)\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
if (mountPath === '/') {
  app.get(/^(?!\/(api|uploads)\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
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
  const home = await records.find('content', (c) => c.key === 'homepage');
  if (!home) {
    await records.insert('content', {
      key: 'homepage',
      heroTitle: 'Wedding cards, crafted to order.',
      heroSubtitle: 'Invitations, save-the-dates and full stationery suites — designed and printed in Addis Ababa by Mena INK Trading PLC.',
      heroImage: '',
      heroCta: 'Browse the catalog',
      noticeText: '',
    });
    console.log('[seed] homepage content created');
  }
  const business = await records.find('content', (c) => c.key === 'business');
  if (!business) {
    await records.insert('content', {
      key: 'business',
      phone: '+251 92 963 9939',
      email: 'hello@menainc.com',
      address: 'Reality Plaza, 1st Floor, Office No. 104, Bole (next to Yougo Church), Addis Ababa',
      hours: 'Mon–Sat, 9:00–18:00',
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

async function start() {
  try {
    await ensureSchema();
    await ensureAdminSeed();
    await seed();
    console.log('[db] schema ready');
  } catch (err) {
    // Boot anyway: /api/health reports the outage and the client shows its
    // database-connection notice instead of the whole API being down.
    console.error('[db] not reachable at boot:', err.code || err.message);
  }
  app.listen(port, () => console.log(`MENA INC. API listening on http://localhost:${port}`));
}

start();
