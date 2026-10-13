import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { records } from '../src/db.mjs';
import {
  resolveTelegramUser,
  telegramAuthRouter,
  telegramClientId,
  telegramProvider,
  telegramRedirectUri,
} from '../src/telegram-auth.mjs';

test('Telegram customer creation uses stable identity and safely links existing customers', async (t) => {
  const users = [];
  t.mock.method(records, 'find', async (_collection, predicate) => users.find(predicate));
  t.mock.method(records, 'get', async (_collection, id) => users.find((user) => user.id === id));
  t.mock.method(records, 'insert', async (_collection, data) => { const user = { id: String(users.length + 1), ...data }; users.push(user); return user; });
  t.mock.method(records, 'update', async (_collection, id, patch) => Object.assign(users.find((user) => user.id === id), patch));

  const identity = {
    sub: '88110001', id: 88110001, name: 'Telegram Customer',
    preferred_username: 'mena_customer', phone_number: '251911223344', picture: 'https://example.com/avatar.jpg',
  };
  const created = await resolveTelegramUser(identity, undefined, 'openid profile phone telegram:bot_access');
  assert.equal(created.identifier, '+251911223344');
  assert.equal(created.telegramUsername, '@mena_customer');
  assert.equal(created.telegramBotAccess, true);
  assert.equal((await resolveTelegramUser({ ...identity, preferred_username: 'new_name' })).id, created.id);
  assert.equal(created.telegramUsername, '@new_name');
  assert.equal(users.length, 1);

  users.push({ id: 'password-user', identifier: '+251922334455', role: 'customer', passwordHash: 'existing-hash' });
  const matchingPhone = { ...identity, sub: '88110002', id: 88110002, phone_number: '251922334455' };
  await assert.rejects(resolveTelegramUser(matchingPhone), { status: 409 });
  const linked = await resolveTelegramUser(matchingPhone, 'password-user');
  assert.equal(linked.telegramSubject, '88110002');
  assert.equal(linked.passwordHash, 'existing-hash');
  await assert.rejects(resolveTelegramUser(identity, 'password-user'), { status: 403 });
});

test('Telegram endpoint uses PKCE state once and creates a verified session', async (t) => {
  const priorSecret = process.env.TELEGRAM_CLIENT_SECRET;
  process.env.TELEGRAM_CLIENT_SECRET = 'test-secret';
  t.after(() => {
    if (priorSecret === undefined) delete process.env.TELEGRAM_CLIENT_SECRET;
    else process.env.TELEGRAM_CLIENT_SECRET = priorSecret;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/auth/telegram', telegramAuthRouter((_req, _res, next) => next()));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth/telegram`;
  const configResponse = await fetch(`${base}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  assert.equal(configResponse.status, 200);
  assert.equal(configResponse.headers.get('cache-control'), 'no-store');
  assert.match(configResponse.headers.get('set-cookie'), /HttpOnly/i);
  const cookie = configResponse.headers.get('set-cookie').split(';')[0];
  const { authorizationUrl } = await configResponse.json();
  const authorization = new URL(authorizationUrl);
  assert.equal(authorization.origin, 'https://oauth.telegram.org');
  assert.equal(authorization.searchParams.get('client_id'), telegramClientId);
  assert.equal(authorization.searchParams.get('redirect_uri'), telegramRedirectUri);
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.match(authorization.searchParams.get('scope'), /phone/);
  const state = authorization.searchParams.get('state');

  let verifier;
  t.mock.method(telegramProvider, 'exchangeCode', async (input) => {
    verifier = input.verifier;
    assert.equal(input.code, 'valid-code');
    return { id_token: 'verified-token', scope: 'openid profile phone telegram:bot_access' };
  });
  t.mock.method(telegramProvider, 'verifyIdToken', async (token) => {
    assert.equal(token, 'verified-token');
    return { sub: '99887766', id: 99887766, name: 'Verified Telegram', phone_number: '251933445566' };
  });
  t.mock.method(records, 'find', async () => undefined);
  let creates = 0;
  t.mock.method(records, 'insert', async (_collection, data) => { creates += 1; return { id: 'telegram-user', ...data }; });
  const post = (body, browserCookie = cookie) => fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: browserCookie }, body: JSON.stringify(body),
  });
  assert.equal((await post({ code: 'valid-code', state: 'wrong' })).status, 401);
  const responses = await Promise.all([
    post({ code: 'valid-code', state }),
    post({ code: 'valid-code', state }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 401]);
  assert.ok(verifier.length >= 43);
  assert.equal(creates, 1);
  const session = await responses.find((response) => response.status === 200).json();
  assert.equal(jwt.decode(session.token).role, 'customer');
  assert.equal(session.user.telegramPhone, '+251933445566');
});
