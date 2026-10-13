import crypto from 'node:crypto';
import { Router } from 'express';
import nodemailer from 'nodemailer';
import { records, dbRoute } from './db.mjs';
import { hashPassword, publicUser, signToken } from './auth.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;
const configuredSecret = process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET || '';
const verificationSecret = configuredSecret && configuredSecret !== 'change-me-to-a-long-random-string'
  ? configuredSecret
  : crypto.randomBytes(32).toString('hex');
if (!configuredSecret || configuredSecret === 'change-me-to-a-long-random-string') {
  console.warn('[email] EMAIL_VERIFICATION_SECRET is missing; verification codes reset on restart.');
}

export const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 20_000,
});

function codeHash(email, code) {
  return crypto.createHmac('sha256', verificationSecret).update(`${email}:${code}`).digest('hex');
}

function cleanSignup(body) {
  const email = String(body?.identifier || '').trim().toLowerCase();
  const name = String(body?.name || '').trim();
  const password = String(body?.password || '');
  if (!EMAIL_RE.test(email) || email.length > 190 || !name || name.length > 100) {
    throw Object.assign(new Error('Enter a valid name and email address.'), { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    throw Object.assign(new Error('Password must be 8–128 characters.'), { status: 400 });
  }
  return { email, name, password };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export async function sendVerificationEmail(email, name, code) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('Email delivery is not configured.');
  }
  await mailTransport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `${code} is your Mena Storefront verification code`,
    text: `Hello ${name},\n\nYour Mena Storefront verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2025"><h2 style="color:#ee2d7b">Verify your email</h2><p>Hello ${escapeHtml(name)},</p><p>Enter this code to create your Mena Storefront account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p><p>This code expires in 10 minutes.</p><p style="font-size:12px;color:#76666d">If you did not request this code, you can ignore this email.</p></div>`,
  });
}

let accountQueue = Promise.resolve();

export function emailSignupRouter(limiter) {
  const router = Router();

  router.post('/', limiter, dbRoute(async (req, res) => {
    let signup;
    try { signup = cleanSignup(req.body); }
    catch (error) { return res.status(error.status).json({ error: 'bad_request', message: error.message }); }
    const { email, name, password } = signup;
    if (await records.find('users', (user) => user.identifier === email)) {
      return res.status(409).json({ error: 'exists', message: 'An account with this email already exists.' });
    }
    const existing = await records.find('email_verifications', (item) => item.email === email);
    const now = Date.now();
    if (existing && now - Number(existing.sentAt || 0) < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (now - Number(existing.sentAt || 0))) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'rate_limited', message: `Wait ${retryAfter} seconds before requesting another code.` });
    }
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const data = {
      email,
      name,
      passwordHash: await hashPassword(password),
      codeHash: codeHash(email, code),
      expiresAt: now + CODE_TTL_MS,
      sentAt: now,
      attempts: 0,
    };
    if (existing) await records.update('email_verifications', existing.id, data);
    else await records.insert('email_verifications', data);
    try {
      await sendVerificationEmail(email, name, code);
    } catch (error) {
      console.error('[email] verification delivery failed:', error.code || error.message);
      return res.status(502).json({ error: 'email_failed', message: 'We could not send the verification email. Please try again.' });
    }
    res.json({ verificationRequired: true, email, expiresIn: CODE_TTL_MS / 1000 });
  }));

  router.post('/verify', limiter, dbRoute(async (req, res) => {
    const email = String(req.body?.identifier || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'bad_request', message: 'Enter the six-digit code from your email.' });
    }
    const pending = await records.find('email_verifications', (item) => item.email === email);
    if (!pending || Number(pending.expiresAt) < Date.now()) {
      if (pending) await records.remove('email_verifications', pending.id);
      return res.status(410).json({ error: 'expired', message: 'This code expired. Request a new one.' });
    }
    if (Number(pending.attempts || 0) >= MAX_ATTEMPTS) {
      await records.remove('email_verifications', pending.id);
      return res.status(429).json({ error: 'too_many_attempts', message: 'Too many incorrect attempts. Request a new code.' });
    }
    const expected = Buffer.from(pending.codeHash, 'hex');
    const received = Buffer.from(codeHash(email, code), 'hex');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      await records.update('email_verifications', pending.id, { attempts: Number(pending.attempts || 0) + 1 });
      return res.status(401).json({ error: 'invalid_code', message: 'That code is incorrect.' });
    }
    const operation = accountQueue.then(async () => {
      const existing = await records.find('users', (user) => user.identifier === email);
      if (existing) throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
      const user = await records.insert('users', {
        identifier: email,
        name: pending.name,
        role: 'customer',
        passwordHash: pending.passwordHash,
        emailVerified: true,
      });
      await records.remove('email_verifications', pending.id);
      return user;
    });
    accountQueue = operation.catch(() => {});
    try {
      const user = await operation;
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: 'exists', message: error.message });
      throw error;
    }
  }));

  return router;
}
