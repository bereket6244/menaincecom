import assert from 'node:assert/strict';
import test from 'node:test';
import { linkedGuestlinkShopId, updateGuestlinkShopCredentials } from '../src/guestlink-credentials.mjs';
import { verifyPassword } from '../src/auth.mjs';
import { signToken, requireAuth } from '../src/auth.mjs';
import { records } from '../src/db.mjs';
import express from 'express';

const accountId = '11111111-2222-4333-8444-555555555555';
const token = 'valid.jwt.token';
const verified = async (url, options) => {
  assert.ok(url.startsWith(`https://menaincet.com/guestlink/api/accounts/${accountId}/shop-identity`));
  assert.equal(options.headers.Authorization, `Bearer ${token}`);
  return { ok: true, json: async () => ({ shop_user_id: 'shop-user-1' }) };
};

test('shop identity requires a GuestLink admin verification response', async () => {
  assert.equal(await linkedGuestlinkShopId(accountId, token, async () => ({ ok: false })), null);
  assert.equal(await linkedGuestlinkShopId('bad-id', token, verified), null);
  assert.equal(await linkedGuestlinkShopId(accountId, token, verified), 'shop-user-1');
});

test('admin changes only the verified linked customer; reset invalidates older sessions', async () => {
  const users = [
    { id: 'shop-user-1', role: 'customer', identifier: 'old@example.test', credentialsVersion: 0, passwordHash: 'old' },
    { id: 'other', role: 'customer', identifier: 'taken@example.test' },
  ];
  const store = {
    get: async (_collection, id) => users.find(user => user.id === id),
    find: async (_collection, predicate) => users.find(predicate),
    update: async (_collection, id, patch) => Object.assign(users.find(user => user.id === id), patch),
  };
  const deps = { store, fetchImpl: verified };
  assert.equal((await updateGuestlinkShopCredentials({ accountId, token, username: 'taken@example.test' }, deps)).status, 409);
  assert.equal((await updateGuestlinkShopCredentials({ accountId, token, username: 'bad user' }, deps)).status, 400);
  assert.equal((await updateGuestlinkShopCredentials({ accountId, token, password: 'short' }, deps)).status, 400);
  const result = await updateGuestlinkShopCredentials({ accountId, token, username: 'new@example.test', password: 'New-password-2026' }, deps);
  assert.equal(result.status, 200);
  assert.equal(users[0].identifier, 'new@example.test');
  assert.equal(users[0].credentialsVersion, 1);
  assert.equal(await verifyPassword('New-password-2026', users[0].passwordHash), true);
  assert.equal(users[1].identifier, 'taken@example.test');
});

test('an older shop session is rejected after a credential version change', async t => {
  const user = { id: 'shop-user-1', role: 'customer', credentialsVersion: 0 };
  t.mock.method(records, 'get', async () => user);
  const oldToken = signToken(user);
  const app = express();
  app.get('/private', requireAuth, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/private`;
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${oldToken}` } })).status, 200);
  user.credentialsVersion = 1;
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${oldToken}` } })).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${signToken(user)}` } })).status, 200);
});
