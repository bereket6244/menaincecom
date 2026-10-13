import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { records, dbRoute } from './db.mjs';
import { optionalAuth, publicUser, signToken } from './auth.mjs';

const ISSUER = 'https://oauth.telegram.org';
const AUTHORIZATION_ENDPOINT = `${ISSUER}/auth`;
const TOKEN_ENDPOINT = `${ISSUER}/token`;
const JWKS_ENDPOINT = `${ISSUER}/.well-known/jwks.json`;
const STATE_COOKIE = 'mena_telegram_state';
const FLOW_TTL = 10 * 60_000;
const flows = new Map();
let accountQueue = Promise.resolve();
let cachedKeys = { expiresAt: 0, keys: [] };

export const telegramClientId = String(process.env.TELEGRAM_CLIENT_ID || '8811055582');
export const telegramRedirectUri = String(
  process.env.TELEGRAM_REDIRECT_URI || 'https://menaincet.com/shop/auth/telegram/callback',
);

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function clientSecret() {
  return String(process.env.TELEGRAM_CLIENT_SECRET || '');
}

function cookie(req, name) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function cleanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15 ? `+${digits}` : '';
}

export const telegramProvider = {
  async exchangeCode({ code, verifier }) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: telegramRedirectUri,
      client_id: telegramClientId,
      code_verifier: verifier,
    });
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${telegramClientId}:${clientSecret()}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.id_token !== 'string') throw new Error('Telegram token exchange failed');
    return result;
  },

  async verifyIdToken(idToken) {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded?.header?.kid || decoded.header.alg !== 'RS256') throw new Error('Invalid Telegram token header');
    if (cachedKeys.expiresAt < Date.now() || !cachedKeys.keys.some((key) => key.kid === decoded.header.kid)) {
      const response = await fetch(JWKS_ENDPOINT, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error('Telegram signing keys unavailable');
      const body = await response.json();
      cachedKeys = { keys: Array.isArray(body.keys) ? body.keys : [], expiresAt: Date.now() + 60 * 60_000 };
    }
    const jwk = cachedKeys.keys.find((key) => key.kid === decoded.header.kid && key.kty === 'RSA');
    if (!jwk) throw new Error('Telegram signing key not found');
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return jwt.verify(idToken, key, {
      algorithms: ['RS256'], issuer: ISSUER, audience: telegramClientId,
    });
  },
};

export async function resolveTelegramUser(payload, authenticatedId, grantedScope = '') {
  const subject = String(payload?.sub || '');
  if (!/^\d+$/.test(subject)) {
    throw Object.assign(new Error('Telegram did not provide a valid account identity.'), { status: 401 });
  }
  const linked = await records.find('users', (user) => user.telegramSubject === subject);
  if (linked) {
    if (linked.role !== 'customer' || (authenticatedId && linked.id !== authenticatedId)) {
      throw Object.assign(new Error('This Telegram account is already connected to another account.'), { status: 403 });
    }
    return records.update('users', linked.id, telegramProfilePatch(payload, grantedScope));
  }

  const phone = cleanPhone(payload.phone_number);
  const phoneOwner = phone && await records.find('users', (user) => user.identifier === phone);
  if (authenticatedId) {
    const current = await records.get('users', authenticatedId);
    if (!current || current.role !== 'customer') {
      throw Object.assign(new Error('Telegram can only be connected to a customer account.'), { status: 403 });
    }
    if (current.telegramSubject) {
      throw Object.assign(new Error('This account already has a Telegram account connected.'), { status: 409 });
    }
    if (phoneOwner && phoneOwner.id !== current.id) {
      throw Object.assign(new Error('That Telegram phone number belongs to another shop account.'), { status: 409 });
    }
    return records.update('users', current.id, { telegramSubject: subject, ...telegramProfilePatch(payload, grantedScope) });
  }
  if (phoneOwner) {
    throw Object.assign(new Error('An account already uses this phone number. Log in first, then connect Telegram from your account page.'), { status: 409 });
  }

  return records.insert('users', {
    identifier: phone || `telegram:${subject}`,
    name: String(payload.name || payload.preferred_username || 'Telegram customer').slice(0, 100),
    role: 'customer',
    telegramSubject: subject,
    ...telegramProfilePatch(payload, grantedScope),
  });
}

function telegramProfilePatch(payload, grantedScope) {
  const username = String(payload?.preferred_username || '').replace(/^@/, '').slice(0, 64);
  const picture = String(payload?.picture || '');
  return {
    telegramUserId: String(payload?.id || payload?.sub || ''),
    telegramUsername: username ? `@${username}` : '',
    telegramPhone: cleanPhone(payload?.phone_number),
    telegramPhotoUrl: /^https:\/\//.test(picture) ? picture.slice(0, 2048) : '',
    telegramBotAccess: String(grantedScope).split(/\s+/).includes('telegram:bot_access'),
  };
}

export function telegramAuthRouter(limiter) {
  const router = Router();
  router.post('/config', limiter, optionalAuth, (req, res) => {
    if (!clientSecret()) return res.status(503).json({ message: 'Telegram sign-in is not configured yet.' });
    const now = Date.now();
    for (const [key, flow] of flows) if (flow.expiresAt < now) flows.delete(key);
    if (flows.size >= 5000) return res.status(429).json({ message: 'Please try again shortly.' });
    const state = crypto.randomBytes(32).toString('hex');
    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
    flows.set(state, { verifier, expiresAt: now + FLOW_TTL });
    res.set('Cache-Control', 'no-store');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: FLOW_TTL,
    });
    const params = new URLSearchParams({
      client_id: telegramClientId,
      redirect_uri: telegramRedirectUri,
      response_type: 'code',
      scope: 'openid profile phone telegram:bot_access',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    res.json({ authorizationUrl: `${AUTHORIZATION_ENDPOINT}?${params}` });
  });

  router.post('/', limiter, optionalAuth, dbRoute(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const state = String(req.body?.state || '');
    const code = String(req.body?.code || '');
    const browserState = cookie(req, STATE_COOKIE);
    const flow = flows.get(state);
    if (!req.is('application/json') || !code || code.length > 4096 || !state || state !== browserState || !flow || flow.expiresAt < Date.now()) {
      return res.status(401).json({ message: 'Telegram sign-in expired. Please start again.' });
    }
    if (!flows.delete(state)) return res.status(401).json({ message: 'Please start Telegram sign-in again.' });
    res.clearCookie(STATE_COOKIE, { path: '/' });
    try {
      const tokens = await telegramProvider.exchangeCode({ code, verifier: flow.verifier });
      const payload = await telegramProvider.verifyIdToken(tokens.id_token);
      const operation = accountQueue.then(() => resolveTelegramUser(payload, req.auth?.id, tokens.scope));
      accountQueue = operation.catch(() => {});
      const user = await operation;
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      return res.status(401).json({ message: 'Could not verify Telegram sign-in. Please try again.' });
    }
  }));
  return router;
}
