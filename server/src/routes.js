import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { records, pool, dbRoute, isUsingLocalStore } from './db.js';
import {
  signToken, publicUser, hashPassword, verifyPassword,
  requireAdmin, optionalAuth,
} from './auth.js';
import { formatOrderMessage, sendTelegram, sendWhatsApp, pushToAdmins } from './notify.js';

export const api = Router();

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

/* ---------------------------------- health --------------------------------- */

api.get('/health', async (_req, res) => {
  if (isUsingLocalStore()) return res.json({ ok: true, db: false, localStore: true });

  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false, error: 'db_unavailable' });
  }
});

/* ----------------------------------- auth ---------------------------------- */

api.post('/auth/signup', dbRoute(async (req, res) => {
  const { identifier, password, name } = req.body || {};
  if (!identifier || !password || !name) {
    return res.status(400).json({ error: 'bad_request', message: 'Name, email/phone and password are required.' });
  }
  const norm = String(identifier).trim().toLowerCase();
  if (await records.find('users', (u) => u.identifier === norm)) {
    return res.status(409).json({ error: 'exists', message: 'An account with this email/phone already exists.' });
  }
  const user = await records.insert('users', {
    identifier: norm,
    name: String(name).trim(),
    role: 'customer',
    passwordHash: await hashPassword(String(password)),
  });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

api.post('/auth/login', dbRoute(async (req, res) => {
  const { identifier, password } = req.body || {};
  const norm = String(identifier || '').trim().toLowerCase();
  const user = await records.find('users', (u) => u.identifier === norm);
  if (!user || !(await verifyPassword(String(password || ''), user.passwordHash))) {
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

/* ------------------------------ public catalog ----------------------------- */

api.get('/categories', dbRoute(async (_req, res) => {
  const cats = await records.list('categories');
  res.json(cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
}));

api.get('/products', dbRoute(async (_req, res) => {
  res.json(await records.list('products'));
}));

api.get('/products/:id', dbRoute(async (req, res) => {
  const product = await records.get('products', req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  res.json(product);
}));

api.get('/gallery', dbRoute(async (_req, res) => {
  const items = await records.list('gallery');
  res.json(items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
}));

api.get('/content/homepage', dbRoute(async (_req, res) => {
  const doc = await records.find('content', (c) => c.key === 'homepage');
  res.json(doc || { key: 'homepage' });
}));

/* ---------------------------------- orders --------------------------------- */

api.post('/orders', optionalAuth, dbRoute(async (req, res) => {
  const { items, customer, channel, note } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'Order has no items.' });
  }
  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'bad_request', message: 'Name and phone number are required.' });
  }
  if (!['whatsapp', 'telegram'].includes(channel)) {
    return res.status(400).json({ error: 'bad_request', message: 'Invalid channel.' });
  }

  const priced = items.filter((i) => i.priceEach != null);
  const estimatedTotal = priced.length
    ? priced.reduce((sum, i) => sum + i.priceEach * i.qty, 0)
    : null;

  const order = await records.insert('orders', {
    items,
    customer: {
      name: String(customer.name).trim(),
      phone: String(customer.phone).trim(),
      email: customer.email ? String(customer.email).trim() : '',
    },
    channel,
    note: note ? String(note) : '',
    estimatedTotal,
    status: 'new',
    userId: req.auth?.id || null,
  });

  // Lead capture: one record per phone number, updated on repeat orders.
  const existingLead = await records.find('leads', (l) => l.phone === order.customer.phone);
  if (existingLead) {
    await records.update('leads', existingLead.id, {
      name: order.customer.name,
      email: order.customer.email || existingLead.email,
      lastChannel: channel,
      orderCount: (existingLead.orderCount || 1) + 1,
      lastOrderId: order.id,
    });
  } else {
    await records.insert('leads', {
      name: order.customer.name,
      phone: order.customer.phone,
      email: order.customer.email,
      source: req.auth ? 'account' : 'guest',
      userId: req.auth?.id || null,
      lastChannel: channel,
      orderCount: 1,
      lastOrderId: order.id,
    });
  }

  // Outbound delivery + admin push run in the background; the customer gets
  // an immediate confirmation once the order is safely in the database.
  const message = formatOrderMessage(order);
  const deliver = channel === 'telegram' ? sendTelegram(message) : sendWhatsApp(message);
  deliver.catch((err) => console.error(`[${channel}] delivery error:`, err));
  pushToAdmins({
    title: 'New order — MENA INC.',
    body: `${order.customer.name} (${order.customer.phone}) via ${channel} — ${items.length} item(s)`,
    url: '/admin',
  }).catch((err) => console.error('[push] error:', err));

  res.json({ ok: true, id: order.id });
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

api.put('/admin/content/homepage', requireAdmin, dbRoute(async (req, res) => {
  const existing = await records.find('content', (c) => c.key === 'homepage');
  const doc = existing
    ? await records.update('content', existing.id, { ...req.body, key: 'homepage' })
    : await records.insert('content', { ...req.body, key: 'homepage' });
  res.json(doc);
}));

/* --------------------------------- uploads --------------------------------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve('uploads'),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
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
