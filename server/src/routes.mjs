import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { records, dbRoute, ensureWritablePersistence } from './db.mjs';
import {
  signToken, publicUser, hashPassword, verifyPassword,
  requireAuth, requireAdmin, optionalAuth,
} from './auth.mjs';
import { formatOrderMessage, sendTelegram, sendWhatsApp, pushToAdmins } from './notify.mjs';

export const api = Router();
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsDir = path.join(serverRoot, 'uploads');

function publicCache(res, seconds = 60) {
  res.set('Cache-Control', `private, max-age=${seconds}, stale-while-revalidate=300`);
}

const STRONG_PASSWORD_MESSAGE =
  'Password must be at least 14 characters and include uppercase, lowercase, a number and a symbol.';

function isStrongAdminPassword(password) {
  return (
    password.length >= 14
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}

const PHONE_RE = /^\+?\d{9,15}$/;

function normalizePhone(value) {
  return String(value || '').replace(/[\s\-().]/g, '');
}

/**
 * Minimal in-memory rate limiter (per IP, fixed window). Protects the
 * password endpoints from brute force and the public order/upload endpoints
 * from flooding without any extra dependency.
 */
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    // Opportunistic cleanup so the map can't grow without bound.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'rate_limited', message });
    }
    next();
  };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 20,
  message: 'Too many login attempts. Please try again in a few minutes.',
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60_000, max: 20,
  message: 'Too many accounts created from this connection. Please try again later.',
});
const orderLimiter = rateLimit({
  windowMs: 10 * 60_000, max: 30,
  message: 'Too many orders in a short time. Please wait a moment and try again.',
});

/* ---------------------------------- health --------------------------------- */

api.get('/health', async (req, res) => {
  const version = req.app.get('deployVersion');
  try {
    const persistence = await ensureWritablePersistence();
    res.json({ ok: true, db: persistence.primary === 'mysql', version, ...persistence });
  } catch {
    res.status(503).json({ ok: false, db: false, writable: false, error: 'db_unavailable', version });
  }
});

/* ----------------------------------- auth ---------------------------------- */

api.post('/auth/signup', signupLimiter, dbRoute(async (req, res) => {
  const { identifier, password, name } = req.body || {};
  if (!identifier || !password || !name) {
    return res.status(400).json({ error: 'bad_request', message: 'Name, email/phone and password are required.' });
  }
  const norm = String(identifier).trim().toLowerCase();
  const cleanName = String(name).trim();
  const cleanPassword = String(password);
  if (norm.length < 3 || norm.length > 190 || cleanName.length > 100) {
    return res.status(400).json({ error: 'bad_request', message: 'Please enter a valid name and email/phone.' });
  }
  if (cleanPassword.length < 8 || cleanPassword.length > 128) {
    return res.status(400).json({ error: 'bad_request', message: 'Password must be 8–128 characters.' });
  }
  if (await records.find('users', (u) => u.identifier === norm)) {
    return res.status(409).json({ error: 'exists', message: 'An account with this email/phone already exists.' });
  }
  const user = await records.insert('users', {
    identifier: norm,
    name: cleanName,
    role: 'customer',
    passwordHash: await hashPassword(cleanPassword),
  });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

api.post('/auth/login', loginLimiter, dbRoute(async (req, res) => {
  const { identifier, password } = req.body || {};
  const norm = String(identifier || '').trim().toLowerCase();
  const user = await records.find('users', (u) => u.identifier === norm);
  // Always run the hash comparison so unknown accounts take the same time as
  // wrong passwords (no user enumeration through timing).
  const valid = await verifyPassword(String(password || ''), user?.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Wrong email/phone or password.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

api.get('/auth/me', optionalAuth, dbRoute(async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'unauthorized' });
  const user = await records.get('users', req.auth.id);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: publicUser(user) });
}));

/* -------------------------------- wishlist -------------------------------- */

api.get('/wishlist', requireAuth, dbRoute(async (req, res) => {
  const items = await records.list('wishlist_items');
  const productIds = items
    .filter((item) => item.userId === req.auth.id)
    .map((item) => item.productId);
  res.json({ productIds: [...new Set(productIds)] });
}));

api.put('/wishlist/:productId', requireAuth, dbRoute(async (req, res) => {
  const product = await records.get('products', req.params.productId);
  if (!product) return res.status(404).json({ error: 'not_found', message: 'Product not found.' });
  const existing = await records.find(
    'wishlist_items',
    (item) => item.userId === req.auth.id && item.productId === product.id
  );
  if (existing) return res.json({ ok: true });
  await records.insert('wishlist_items', { userId: req.auth.id, productId: product.id });
  res.json({ ok: true });
}));

api.delete('/wishlist/:productId', requireAuth, dbRoute(async (req, res) => {
  const existing = await records.find(
    'wishlist_items',
    (item) => item.userId === req.auth.id && item.productId === req.params.productId
  );
  if (existing) await records.remove('wishlist_items', existing.id);
  res.json({ ok: true });
}));

/* ------------------------------- admin users ------------------------------- */

api.get('/admin/users/admins', requireAdmin, dbRoute(async (_req, res) => {
  const users = await records.list('users');
  res.json(users.filter((u) => u.role === 'admin').map(publicUser));
}));

api.post('/admin/users/admins', requireAdmin, dbRoute(async (req, res) => {
  const { identifier, password, name } = req.body || {};
  const norm = String(identifier || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanPassword = String(password || '');

  if (!norm || !cleanName || !cleanPassword) {
    return res.status(400).json({ error: 'bad_request', message: 'Name, email/phone and password are required.' });
  }
  if (!isStrongAdminPassword(cleanPassword)) {
    return res.status(400).json({ error: 'bad_request', message: STRONG_PASSWORD_MESSAGE });
  }
  if (await records.find('users', (u) => u.identifier === norm)) {
    return res.status(409).json({ error: 'exists', message: 'An account with this email/phone already exists.' });
  }

  const user = await records.insert('users', {
    identifier: norm,
    name: cleanName,
    role: 'admin',
    passwordHash: await hashPassword(cleanPassword),
  });
  res.status(201).json({ user: publicUser(user) });
}));

api.delete('/admin/users/admins/:id', requireAdmin, dbRoute(async (req, res) => {
  if (req.params.id === req.auth.id) {
    return res.status(400).json({ error: 'bad_request', message: 'You cannot delete your own admin account.' });
  }
  const user = await records.get('users', req.params.id);
  if (!user || user.role !== 'admin') return res.status(404).json({ error: 'not_found' });
  const admins = (await records.list('users')).filter((u) => u.role === 'admin');
  if (admins.length <= 1) {
    return res.status(400).json({ error: 'bad_request', message: 'At least one admin account must remain.' });
  }
  res.json({ ok: await records.remove('users', req.params.id) });
}));

/* ------------------------------ public catalog ----------------------------- */

api.get('/categories', dbRoute(async (_req, res) => {
  publicCache(res);
  const cats = await records.list('categories');
  res.json(cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
}));

api.get('/products', dbRoute(async (_req, res) => {
  publicCache(res, 30);
  res.json(await records.list('products'));
}));

api.get('/products/:id', dbRoute(async (req, res) => {
  const product = await records.get('products', req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  res.json(product);
}));

api.get('/gallery', dbRoute(async (_req, res) => {
  publicCache(res);
  const items = await records.list('gallery');
  res.json(items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
}));

api.get('/content/business', dbRoute(async (_req, res) => {
  publicCache(res);
  const doc = await records.find('content', (c) => c.key === 'business');
  res.json(doc || { key: 'business' });
}));

api.get('/complimentary-items', dbRoute(async (_req, res) => {
  publicCache(res);
  const items = await records.list('complimentary_items');
  res.json(items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
}));

/* ---------------------------------- orders --------------------------------- */

const COMPLIMENTARY_MAX_MULTIPLIER = 2.5;
const COMPLIMENTARY_EXTRA_MAX_QTY = 100000;

function complimentaryForProduct(product, qty, selections = {}) {
  if (!product || product.isAddon) return [];
  const limit = Math.max(0, Math.floor((Number(qty) || 0) * COMPLIMENTARY_MAX_MULTIPLIER));
  if (limit <= 0) return [];
  return (product.complimentaryItems || [])
    .filter((item) => item?.enabled && String(item.name || '').trim() && Number(item.qty) > 0)
    .map((item) => {
      const rawQty = item.type === 'multiplier'
        ? Math.floor((Number(qty) || 0) * Number(item.qty))
        : Math.floor(Number(item.qty) || 0);
      const freeQty = Math.min(rawQty, limit);
      const name = String(item.name).trim().slice(0, 100);
      const hasSelection = Object.prototype.hasOwnProperty.call(selections, name);
      const selectedQty = hasSelection
        ? Math.min(COMPLIMENTARY_EXTRA_MAX_QTY, Math.max(0, Math.floor(Number(selections[name]) || 0)))
        : 0;
      const extraQty = Math.max(0, selectedQty - freeQty);
      const extraPriceEach = item.extraPriceEach == null ? null : Math.max(0, Number(item.extraPriceEach) || 0);
      return {
        name,
        qty: selectedQty,
        maxQty: freeQty,
        freeQty,
        extraQty,
        extraPriceEach,
        extraTotal: extraPriceEach != null ? extraQty * extraPriceEach : 0,
      };
    })
    .filter((item) => item.freeQty > 0 || item.qty > 0);
}

function resolveComplimentaryProduct(product, universalItems) {
  if (!product) return product;
  const selectedUniversalIds = new Set(product.universalComplimentaryItemIds || []);
  const universal = (universalItems || [])
    .filter((item) => item?.enabled && selectedUniversalIds.has(item.id))
    .map((item) => ({
      id: `universal:${item.id}`,
      enabled: item.enabled,
      name: item.name,
      type: item.type,
      qty: item.qty,
      extraPriceEach: item.extraPriceEach,
    }));

  return {
    ...product,
    complimentaryItems: [...universal, ...(product.complimentaryItems || [])],
  };
}

api.post('/orders', orderLimiter, optionalAuth, dbRoute(async (req, res) => {
  const { items: rawItems, customer, channel, note } = req.body || {};
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 60) {
    return res.status(400).json({ error: 'bad_request', message: 'Order has no items (or too many).' });
  }
  // Credentials are optional — guests check out straight to chat. Contact
  // details are attached automatically for signed-in customers.
  const phone = normalizePhone(customer?.phone);
  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'bad_request', message: 'Please enter a valid phone number, e.g. 09… or +2519…' });
  }
  if (!['whatsapp', 'telegram', 'sms'].includes(channel)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid channel.' });
  }

  const [products, universalComplimentaryItems] = await Promise.all([
    records.list('products'),
    records.list('complimentary_items'),
  ]);
  const productById = new Map(products.map((p) => [p.id, resolveComplimentaryProduct(p, universalComplimentaryItems)]));

  // Prices always come from the catalog — never trust amounts sent by the browser.
  const items = rawItems
    .map((raw) => {
      const product = productById.get(String(raw?.productId || ''));
      const qty = Math.min(100000, Math.max(1, Math.floor(Number(raw?.qty)) || 1));
      const variantSelections = Object.fromEntries(
        Object.entries(raw?.variantSelections || {})
          .filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
          .slice(0, 12)
      );
      const base = { qty, note: raw?.note ? String(raw.note).slice(0, 500) : '', variantSelections };
      if (!product) return null;
      const complimentarySelections = Object.fromEntries(
        (Array.isArray(raw?.complimentaryItems) ? raw.complimentaryItems : [])
          .filter((item) => item && typeof item.name === 'string')
          .map((item) => [String(item.name).trim().slice(0, 100), Number(item.qty)])
      );
      return {
        ...base,
        productId: product.id,
        name: product.name,
        photo: product.photos?.[0] || '',
        isAddon: !!product.isAddon,
        pricingMode: product.pricingMode,
        priceEach: product.pricingMode === 'exact' && product.price != null ? product.price : null,
        complimentaryItems: complimentaryForProduct(product, qty, complimentarySelections),
      };
    })
    .filter(Boolean);

  if (items.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'The items in your order are no longer available.' });
  }

  const priced = items.filter((i) => i.priceEach != null);
  const extraTotal = items.reduce(
    (sum, item) => sum + (item.complimentaryItems || []).reduce((sub, freeItem) => sub + (Number(freeItem.extraTotal) || 0), 0),
    0
  );
  const estimatedTotal = priced.length || extraTotal > 0
    ? priced.reduce((sum, i) => sum + i.priceEach * i.qty, extraTotal)
    : null;

  const order = await records.insert('orders', {
    items,
    customer: {
      name: customer?.name ? String(customer.name).trim().slice(0, 100) : 'Guest',
      phone,
      email: customer?.email ? String(customer.email).trim().slice(0, 254) : '',
    },
    channel,
    note: note ? String(note).slice(0, 1000) : '',
    estimatedTotal,
    status: 'new',
    userId: req.auth?.id || null,
  });

  // Outbound delivery + admin push run in the background; the customer gets
  // an immediate confirmation once the order is safely in the database.
  const message = formatOrderMessage(order);
  const deliver = channel === 'telegram' ? sendTelegram(message) : sendWhatsApp(message);
  deliver.catch((err) => console.error(`[${channel}] delivery error:`, err));
  pushToAdmins({
    title: 'New order — MENA INC.',
    body: `${order.customer.name}${order.customer.phone ? ` (${order.customer.phone})` : ''} via ${channel} — ${items.length} item(s)`,
    url: '/admin',
  }).catch((err) => console.error('[push] error:', err));

  // The client builds the WhatsApp/Telegram message from this sanitized order,
  // so the forwarded summary always matches catalog prices.
  res.json({ ok: true, id: order.id, order });
}));

/* ------------------------------- admin: CRUD -------------------------------- */

function crud(collection) {
  const r = Router();
  r.get('/', requireAdmin, dbRoute(async (_req, res) => res.json(await records.list(collection))));
  r.post('/', requireAdmin, dbRoute(async (req, res) => res.json(await records.insert(collection, req.body))));
  r.put('/:id', requireAdmin, dbRoute(async (req, res) => {
    const doc = await records.update(collection, req.params.id, req.body);
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.json(doc);
  }));
  r.delete('/:id', requireAdmin, dbRoute(async (req, res) => {
    res.json({ ok: await records.remove(collection, req.params.id) });
  }));
  return r;
}

api.use('/admin/products', crud('products'));
api.use('/admin/complimentary-items', crud('complimentary_items'));
api.use('/admin/categories', crud('categories'));
api.use('/admin/gallery', crud('gallery'));

api.get('/admin/orders', requireAdmin, dbRoute(async (_req, res) => {
  res.json(await records.list('orders'));
}));

api.put('/admin/orders/:id', requireAdmin, dbRoute(async (req, res) => {
  const { status } = req.body || {};
  if (!['new', 'contacted', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid status.' });
  }
  const doc = await records.update('orders', req.params.id, { status });
  if (!doc) return res.status(404).json({ error: 'not_found' });
  res.json(doc);
}));

api.get('/admin/leads', requireAdmin, dbRoute(async (_req, res) => {
  const [leads, users] = await Promise.all([records.list('leads'), records.list('users')]);
  // Account holders who have not ordered yet still count as leads.
  const leadPhones = new Set(leads.map((l) => l.phone));
  const accountLeads = users
    .filter((u) => u.role === 'customer' && !leadPhones.has(u.identifier))
    .map((u) => ({
      id: `user-${u.id}`,
      name: u.name,
      phone: u.identifier.includes('@') ? '' : u.identifier,
      email: u.identifier.includes('@') ? u.identifier : '',
      source: 'account',
      orderCount: 0,
      createdAt: u.createdAt,
    }));
  res.json([...leads, ...accountLeads]);
}));

api.put('/admin/content/business', requireAdmin, dbRoute(async (req, res) => {
  const existing = await records.find('content', (c) => c.key === 'business');
  const doc = existing
    ? await records.update('content', existing.id, { ...req.body, key: 'business' })
    : await records.insert('content', { ...req.body, key: 'business' });
  res.json(doc);
}));

/* --------------------------------- uploads --------------------------------- */

// Raster images only. SVG is deliberately excluded: an uploaded SVG served
// from /uploads executes scripts in the visitor's browser (stored XSS).
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const IMAGE_MIME_RE = /^image\/(jpeg|png|webp|gif|avif)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${IMAGE_EXTENSIONS.has(ext) ? ext : '.jpg'}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, IMAGE_MIME_RE.test(file.mimetype) && (ext === '' || IMAGE_EXTENSIONS.has(ext)));
  },
});

api.post('/admin/upload', requireAdmin, upload.array('files', 12), (req, res) => {
  res.json({ urls: (req.files || []).map((f) => `/uploads/${f.filename}`) });
});

/* -------------------------------- web push ---------------------------------- */

api.get('/admin/push/key', requireAdmin, (_req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

api.post('/admin/push/subscribe', requireAdmin, dbRoute(async (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription?.endpoint) return res.status(400).json({ error: 'bad_request' });
  const existing = await records.find('push_subscriptions', (s) => s.subscription?.endpoint === subscription.endpoint);
  if (!existing) await records.insert('push_subscriptions', { subscription, userId: req.auth.id });
  res.json({ ok: true });
}));

