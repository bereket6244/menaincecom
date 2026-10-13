import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { records } from '../src/db.mjs';
import { emailSignupRouter, mailTransport } from '../src/email-verification.mjs';

test('email signup sends a code and creates an account only after verification', async (t) => {
  process.env.SMTP_HOST = 'mail.example.test';
  process.env.SMTP_USER = 'sender@example.test';
  process.env.SMTP_PASSWORD = 'test-only';
  const collections = { users: [], email_verifications: [] };
  let sent;

  t.mock.method(records, 'list', async (collection) => collections[collection] || []);
  t.mock.method(records, 'find', async (collection, predicate) => (collections[collection] || []).find(predicate) || null);
  t.mock.method(records, 'insert', async (collection, data) => {
    const item = { id: `${collection}-${collections[collection].length + 1}`, ...data };
    collections[collection].push(item);
    return structuredClone(item);
  });
  t.mock.method(records, 'update', async (collection, id, patch) => {
    const item = collections[collection].find((entry) => entry.id === id);
    Object.assign(item, patch);
    return structuredClone(item);
  });
  t.mock.method(records, 'remove', async (collection, id) => {
    collections[collection] = collections[collection].filter((entry) => entry.id !== id);
    return true;
  });
  t.mock.method(mailTransport, 'sendMail', async (message) => { sent = message; return { accepted: [message.to] }; });

  const app = express();
  app.use(express.json());
  app.use('/signup', emailSignupRouter((_req, _res, next) => next()));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/signup`;
  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const request = await post('', { name: '<Mena Customer>', identifier: 'CUSTOMER@example.com', password: 'safe-password' });
  assert.equal(request.status, 200);
  assert.deepEqual(await request.json(), { verificationRequired: true, email: 'customer@example.com', expiresIn: 600 });
  assert.equal(collections.users.length, 0);
  assert.equal(collections.email_verifications.length, 1);
  assert.equal(collections.email_verifications[0].password, undefined);
  assert.equal(collections.email_verifications[0].code, undefined);
  assert.ok(collections.email_verifications[0].passwordHash);
  assert.ok(collections.email_verifications[0].codeHash);
  assert.doesNotMatch(sent.html, /<Mena Customer>/);
  const code = sent.subject.match(/^\d{6}/)[0];

  const wrong = await post('/verify', { identifier: 'customer@example.com', code: '999999' === code ? '888888' : '999999' });
  assert.equal(wrong.status, 401);
  assert.equal(collections.email_verifications[0].attempts, 1);
  assert.equal(collections.users.length, 0);

  const verified = await post('/verify', { identifier: 'customer@example.com', code });
  assert.equal(verified.status, 200);
  const session = await verified.json();
  assert.ok(session.token);
  assert.equal(session.user.identifier, 'customer@example.com');
  assert.equal(session.user.emailVerified, true);
  assert.equal(session.user.passwordHash, undefined);
  assert.equal(collections.users.length, 1);
  assert.equal(collections.email_verifications.length, 0);
});

test('email signup validates email, throttles resends, and rejects expired codes', async (t) => {
  process.env.SMTP_HOST = 'mail.example.test';
  process.env.SMTP_USER = 'sender@example.test';
  process.env.SMTP_PASSWORD = 'test-only';
  const pending = [];
  t.mock.method(records, 'find', async (collection, predicate) => collection === 'users' ? null : pending.find(predicate) || null);
  t.mock.method(records, 'insert', async (_collection, data) => { const item = { id: 'pending', ...data }; pending.push(item); return item; });
  t.mock.method(records, 'update', async (_collection, _id, patch) => Object.assign(pending[0], patch));
  t.mock.method(records, 'remove', async () => { pending.length = 0; return true; });
  t.mock.method(mailTransport, 'sendMail', async () => ({ accepted: ['customer@example.com'] }));
  const app = express();
  app.use(express.json());
  app.use('/signup', emailSignupRouter((_req, _res, next) => next()));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/signup`;
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('', { name: 'Customer', identifier: 'not-an-email', password: 'safe-password' })).status, 400);
  const body = { name: 'Customer', identifier: 'customer@example.com', password: 'safe-password' };
  assert.equal((await post('', body)).status, 200);
  const throttled = await post('', body);
  assert.equal(throttled.status, 429);
  assert.ok(Number(throttled.headers.get('retry-after')) > 0);
  pending[0].expiresAt = Date.now() - 1;
  assert.equal((await post('/verify', { identifier: body.identifier, code: '123456' })).status, 410);
  assert.equal(pending.length, 0);
});
