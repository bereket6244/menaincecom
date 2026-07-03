import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { records } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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
  return bcrypt.compare(plain, hash);
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
  const identifier = (process.env.ADMIN_IDENTIFIER || 'admin@menainc.com').toLowerCase();
  const existing = await records.find('users', (u) => u.identifier === identifier);
  if (existing) return;
  await records.insert('users', {
    identifier,
    name: process.env.ADMIN_NAME || 'Mena Admin',
    role: 'admin',
    passwordHash: await hashPassword(process.env.ADMIN_PASSWORD || 'change-me'),
  });
  console.log(`[seed] admin account created: ${identifier}`);
}
