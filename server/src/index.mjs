import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureSchema, records } from './db.mjs';
import { ensureAdminSeed } from './auth.mjs';
import { api } from './routes.mjs';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
app.set('deployVersion', 'shop-backend-20260930-digital-invites');
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
const privateRuntimeAsset = /^\/(?:app\.js|package(?:-lock)?\.json|src(?:\/|$)|tmp(?:\/|$)|server-deploy\.zip|shop-deploy\.zip)/;
app.use(mountPath, (req, res, next) => {
  if (privateRuntimeAsset.test(req.path)) return res.status(404).send('Not found');
  next();
});
app.use(mountPath, express.static(clientDist, staticOptions));
const sendClientIndex = (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDist, 'index.html'));
};
app.get(`${mountPath}/*`, sendClientIndex);
if (mountPath !== '/') {
  app.use((req, res, next) => {
    if (privateRuntimeAsset.test(req.path)) return res.status(404).send('Not found');
    next();
  });
  app.use(express.static(clientDist, staticOptions));
  app.get(/^(?!\/(api|uploads)\/).*/, sendClientIndex);
}
if (mountPath === '/') {
  app.get(/^(?!\/(api|uploads)\/).*/, sendClientIndex);
}

const DEFAULT_CATEGORIES = ['Wedding Invitations', 'Save-the-Dates', 'Thank-You Cards', 'Full Suites'];
const catalogSeedPath = path.join(serverRoot, 'src', 'catalog-seed.json');

const DEFAULT_DIGITAL_INVITATIONS = {
  enabled: true,
  title: 'Digital wedding invitation websites',
  subtitle: '',
  intro: '',
  portfolioUrl: 'https://menaincet.com',
  examples: [
    {
      id: 'yordanos-kaleab',
      title: 'Yordanos & Kaleab',
      url: 'https://menaincet.com/yordanoskaleab/',
      description: '',
    },
    {
      id: 'yeabsra-christian',
      title: 'Yeabsra & Christian',
      url: 'https://menaincet.com/yeabsrachristian',
      description: '',
    },
  ],
    packages: [
        {
          id: 'basic',
          name: 'Basic',
          eyebrow: '',
          description: 'Simple and elegant',
          price: 9000,
          compareAtPrice: null,
          badge: '',
          features: ['Wedding details', '3 photos', '1 venue + map', 'RSVP'],
          footnote: '',
        },
        {
          id: 'standard',
          name: 'Standard',
          eyebrow: '',
          description: 'Best for most weddings',
          price: 13000,
          compareAtPrice: null,
          badge: 'Most Popular',
          features: ['Everything in Basic', '10 photos', '2 venues + map', '2 languages + timeline'],
          footnote: '',
        },
        {
          id: 'premium',
          name: 'Premium',
          eyebrow: '',
          description: 'More personal and complete',
          price: 16000,
          compareAtPrice: null,
          badge: '',
          features: ['Everything in Standard', 'Unlimited photos', 'Video + couple profile', 'Gift info'],
          footnote: '',
        },
        {
          id: 'ultimate',
          name: 'Ultimate',
          eyebrow: '',
          description: 'For full guest management',
          price: 18500,
          compareAtPrice: null,
          badge: '',
          features: ['Everything in Premium', '3+ languages', 'QR code', 'Live guest check-in'],
          footnote: '',
        },
      ],
};

async function seed() {
  const cats = await records.list('categories');
  if (cats.length === 0) {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      await records.insert('categories', { name: DEFAULT_CATEGORIES[i], sortOrder: i, photo: '' });
    }
    console.log('[seed] default categories created');
  }

  const products = await records.list('products');
  if (products.length === 0) {
    try {
      const catalogSeed = JSON.parse(fs.readFileSync(catalogSeedPath, 'utf8'));
      const seededCollections = ['categories', 'complimentary_items', 'gallery', 'content'];
      for (const collection of seededCollections) {
        for (const existing of await records.list(collection)) {
          await records.remove(collection, existing.id);
        }
        for (const item of catalogSeed[collection] || []) {
          const { id, createdAt, updatedAt, ...data } = item;
          await records.insertWithId(collection, id, data);
        }
      }
      for (const item of catalogSeed.products || []) {
        const { id, createdAt, updatedAt, ...data } = item;
        await records.insertWithId('products', id, data);
      }
      console.log(`[seed] catalog fixture created ${catalogSeed.products?.length || 0} products`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[seed] catalog fixture failed:', err.message);
    }
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
      paymentAccountName: '',
      paymentAccountNumber: '',
      pickupLocation: 'Reality Plaza, 1st Floor, Office No. 104\nBole, next to Yougo Church',
      digitalInvitations: DEFAULT_DIGITAL_INVITATIONS,
    });
    console.log('[seed] business settings created');
  } else if (!business.digitalInvitations) {
    await records.update('content', business.id, {
      digitalInvitations: DEFAULT_DIGITAL_INVITATIONS,
    });
    console.log('[seed] digital invitation settings created');
  } else if (JSON.stringify(business.digitalInvitations.packages || []) !== JSON.stringify(DEFAULT_DIGITAL_INVITATIONS.packages)) {
    await records.update('content', business.id, {
      digitalInvitations: {
        ...business.digitalInvitations,
        packages: DEFAULT_DIGITAL_INVITATIONS.packages,
      },
    });
    console.log('[seed] digital invitation packages updated');
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
      if (process.env.DB_REQUIRE_MYSQL === 'true') throw err;
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
