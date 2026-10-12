import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { api } from '../src/routes.mjs';
import { records } from '../src/db.mjs';
import { signToken } from '../src/auth.mjs';

test('admin saves update linked Telegram posts and retain failed edits for retry', async (t) => {
  const envKeys = ['TELEGRAM_SYNC_ENABLED', 'TELEGRAM_BOT_TOKEN'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.TELEGRAM_SYNC_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  t.after(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  let product;
  let failure = false;
  const calls = [];
  t.mock.method(records, 'get', async (collection) => collection === 'users'
    ? { id: 'admin-test', role: 'admin' } : structuredClone(product));
  t.mock.method(records, 'list', async (collection) => collection === 'products' ? [structuredClone(product)] : []);
  t.mock.method(records, 'update', async (collection, id, patch) => {
    assert.equal(collection, 'products');
    assert.equal(id, 'product-test');
    product = { ...product, ...patch };
    return structuredClone(product);
  });
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://api.telegram.org/')) return realFetch(url, options);
    const method = String(url).split('/').at(-1);
    const body = options.body instanceof FormData
      ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body);
    calls.push({ method, body });
    return new Response(JSON.stringify(failure
      ? { ok: false, error_code: 403, description: 'Forbidden: missing channel permissions' }
      : { ok: true, result: { message_id: 42 } }), { status: failure ? 403 : 200 });
  });
  t.mock.method(console, 'error', () => {});
  const app = express();
  app.use(express.json(), api);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ id: 'admin-test', role: 'admin' })}` };
  const initialProduct = () => ({
    id: 'product-test', name: 'Invitation', description: 'Original description', price: 100,
    pricingMode: 'exact', status: 'published', contentVersion: 1,
    photos: ['telegram-file-id'], telegramSyncedPhotos: ['telegram-file-id'],
    telegramChannelId: '-1001', telegramMessageId: 42, telegramMessageIds: [42],
    telegramPostType: 'photo', telegramSyncStatus: 'synced',
  });
  const save = async (body) => {
    const response = await fetch(`${base}/admin/products/product-test`, { method: 'PUT', headers, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    return response.json();
  };

  product = initialProduct();
  let result = await save({ price: 250, description: 'Updated description', photos: ['replacement-file-id'] });
  assert.equal(result.telegramSyncStatus, 'synced');
  assert.equal(result.telegramSyncedVersion, 2);
  assert.equal(result.telegramMessageId, 42);
  assert.deepEqual(calls.map((call) => call.method), ['editMessageMedia']);
  assert.equal(calls[0].body.chat_id, '-1001');
  assert.equal(calls[0].body.message_id, '42');
  assert.equal(calls[0].body.photo, 'replacement-file-id');
  assert.match(JSON.parse(calls[0].body.media).caption, /250 ETB/);
  assert.match(JSON.parse(calls[0].body.media).caption, /Updated description/);

  calls.length = 0;
  product = { ...initialProduct(), photos: ['first', 'second'], telegramSyncedPhotos: ['first', 'second'], telegramPostType: 'album', telegramMessageIds: [42, 43] };
  await save({ name: 'Updated album' });
  assert.deepEqual(calls.map((call) => call.method), ['editMessageCaption']);
  assert.equal(calls[0].body.message_id, 42);
  assert.match(calls[0].body.caption, /Updated album/);

  calls.length = 0;
  product = initialProduct();
  const bulkResponse = await fetch(`${base}/admin/products/bulk`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ ids: ['product-test'], set: { pricingMode: 'exact', price: 300 } }),
  });
  assert.equal(bulkResponse.status, 200);
  assert.equal(product.price, 300);
  assert.equal(product.telegramSyncedVersion, 2);
  assert.deepEqual(calls.map((call) => call.method), ['editMessageMedia']);

  failure = true;
  result = await save({ price: 400 });
  assert.equal(result.price, 400);
  assert.equal(result.telegramSyncStatus, 'error');
  assert.equal(result.telegramSyncError.code, 403);
  assert.equal(result.telegramSyncedVersion, 2);
  failure = false;
  result = await save({ price: 400 });
  assert.equal(result.telegramSyncStatus, 'synced');
  assert.equal(result.telegramSyncError, null);
  assert.equal(result.telegramSyncedVersion, 4);
});
