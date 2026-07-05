import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { records } from './db.js';

// Never fall back to a guessable secret: a known secret lets anyone forge an
// admin token. With no configured secret we use a random per-boot one —
// logins reset on restart, but tokens stay unforgeable.
const PLACEHOLDER_SECRETS = new Set(['', 'change-me-to-a-long-random-string', 'dev-secret-change-me']);
const envSecret = process.env.JWT_SECRET || '';
const SECRET = PLACEHOLDER_SECRETS.has(envSecret) ? crypto.randomBytes(32).toString('hex') : envSecret;
if (PLACEHOLDER_SECRETS.has(envSecret)) {
  console.warn('[auth] JWT_SECRET is missing or a placeholder — using a random per-boot secret. Set a real JWT_SECRET in .env.');
}

// Compared against when the account doesn't exist, so login takes the same
// time either way (no user-enumeration via response timing).
const FAKE_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '30d' });
}

export function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  const ok = await bcrypt.compare(plain, hash || FAKE_HASH);
  return ok && Boolean(hash);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    records.get('users', req.auth.id)
      .then((user) => {
        if (!user || user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
        req.admin = publicUser(user);
        next();
      })
      .catch(next);
  });
}

/** Optional auth: attaches req.auth when a valid token is present, never rejects. */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.auth = jwt.verify(token, SECRET); } catch { /* guest */ }
  }
  next();
}

/** Create the seed admin account on boot if it does not exist yet. */
export async function ensureAdminSeed() {
  const password = process.env.ADMIN_PASSWORD || '';
  // Refuse to create an admin with a known default password — that would be
  // a documented backdoor into the admin panel.
  if (!password || password === 'change-me' || password.length < 12) {
    console.warn('[seed] ADMIN_PASSWORD missing or too weak (min 12 chars) — skipping admin seed.');
    return;
  }
  const identifier = (process.env.ADMIN_IDENTIFIER || 'admin@menainc.com').toLowerCase();
  const existing = await records.find('users', (u) => u.identifier === identifier);
  if (existing) return;
  await records.insert('users', {
    identifier,
    name: process.env.ADMIN_NAME || 'Mena Admin',
    role: 'admin',
    passwordHash: await hashPassword(password),
  });
  console.log(`[seed] admin account created: ${identifier}`);
}
