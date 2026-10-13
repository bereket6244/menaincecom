import crypto from 'node:crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { records, dbRoute } from './db.mjs';
import { optionalAuth, publicUser, signToken } from './auth.mjs';

// OAuth client IDs are public configuration, not credentials.
export const googleClientId = process.env.GOOGLE_CLIENT_ID || '1084369633289-tf4j5t7tvr4k2fnmviniob0qdn65851f.apps.googleusercontent.com';
export const googleVerifier = new OAuth2Client();
const challenges = new Map();
const cookieName = 'mena_google_nonce';
const ttl = 10 * 60_000;
let accountQueue = Promise.resolve();

export async function resolveGoogleUser(payload, authenticatedId) {
  const email = String(payload.email || '').trim().toLowerCase();
  if (!payload.sub || payload.email_verified !== true || !email || email.length > 190) {
    throw Object.assign(new Error('Google must provide a verified email address.'), { status: 401 });
  }
  const linked = await records.find('users', (user) => user.googleSubject === payload.sub);
  if (linked) {
    if (linked.role !== 'customer' || (authenticatedId && linked.id !== authenticatedId)) {
      throw Object.assign(new Error('This Google account cannot be used for this customer account.'), { status: 403 });
    }
    return linked;
  }
  const existing = await records.find('users', (user) => user.identifier === email);
  if (existing) {
    if (existing.role !== 'customer' || existing.googleSubject || existing.id !== authenticatedId) {
      throw Object.assign(new Error('This email already has an account. Log in with your password, then connect Google from your account page.'), { status: 409 });
    }
    return records.update('users', existing.id, { googleSubject: payload.sub });
  }
  if (authenticatedId) {
    throw Object.assign(new Error('Use a Google account with the same email as your shop account.'), { status: 409 });
  }
  return records.insert('users', {
    identifier: email,
    name: String(payload.name || email.split('@')[0]).slice(0, 100),
    role: 'customer',
    googleSubject: payload.sub,
  });
}

export function googleAuthRouter(limiter) {
  const router = Router();
  router.get('/config', limiter, (_req, res) => {
    const now = Date.now();
    for (const [key, expiry] of challenges) if (expiry < now) challenges.delete(key);
    if (challenges.size >= 5000) return res.status(429).json({ message: 'Please try again shortly.' });
    const nonce = crypto.randomBytes(32).toString('hex');
    challenges.set(nonce, now + ttl);
    res.set('Cache-Control', 'no-store');
    res.cookie(cookieName, nonce, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: ttl });
    res.json({ clientId: googleClientId, nonce });
  });
  router.post('/', limiter, optionalAuth, dbRoute(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const nonce = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!req.is('application/json') || !nonce || !challenges.has(nonce) || challenges.get(nonce) < Date.now()) {
      return res.status(401).json({ message: 'Google sign-in expired. Refresh the page and try again.' });
    }
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || credential.length > 12000) return res.status(400).json({ message: 'Invalid Google sign-in response.' });
    let payload;
    try {
      const ticket = await googleVerifier.verifyIdToken({ idToken: credential, audience: googleClientId });
      payload = ticket.getPayload();
      if (!payload || payload.nonce !== nonce) throw new Error('nonce mismatch');
    } catch {
      return res.status(401).json({ message: 'Could not verify Google sign-in. Please try again.' });
    }
    // Consume once after verification, including concurrent requests.
    if (!challenges.delete(nonce)) return res.status(401).json({ message: 'Please start Google sign-in again.' });
    const operation = accountQueue.then(() => resolveGoogleUser(payload, req.auth?.id));
    accountQueue = operation.catch(() => {});
    try {
      const user = await operation;
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      throw error;
    }
  }));
  return router;
}
