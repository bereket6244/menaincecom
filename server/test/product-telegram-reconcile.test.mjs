import assert from 'node:assert/strict';
import test from 'node:test';
import { records } from '../src/db.mjs';
import { classifyChannelMessages } from '../src/telegram-presence.mjs';
import { reconcileDeletedTelegramPost } from '../src/product-telegram-reconcile.mjs';
import { deleteTelegramProductPost, formatProductCaption } from '../src/product-telegram.mjs';

test('presence classification accepts only complete, explicit channel results', () => {
  assert.deepEqual(classifyChannelMessages({ messages: [
    { className: 'Message', id: 7 }, { className: 'MessageEmpty', id: 8 },
  ] }, [7, 8]), { state: 'absent', present: [7], absent: [8] });
  assert.equal(classifyChannelMessages({ messages: [{ className: 'MessageEmpty', id: 7 }] }, [7, 8]).state, 'unknown');
  assert.equal(classifyChannelMessages({ messages: [{ className: 'MessageEmpty', id: 99 }] }, [7]).state, 'unknown');
  assert.equal(classifyChannelMessages({ messages: [{ className: 'Message', id: 7 }] }, [7]).state, 'present');
});

test('reconciliation checks twice, removes surviving album fragments, then saves new linkage', async (t) => {
  const oldToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  t.after(() => oldToken === undefined ? delete process.env.TELEGRAM_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN = oldToken);
  let product = {
    id: 'p1', status: 'published', name: 'Card', price: 50, contentVersion: 1, photos: [],
    telegramChannelId: '-1001', telegramMessageId: 7, telegramMessageIds: [7, 8],
  };
  const calls = [];
  t.mock.method(records, 'get', async () => structuredClone(product));
  t.mock.method(records, 'claimTelegramReconcile', async (_id, messageId, claim) => {
    assert.equal(messageId, 7);
    if (product.telegramReconcileClaim) return false;
    product.telegramReconcileClaim = claim;
    return true;
  });
  t.mock.method(records, 'finishTelegramReconcile', async (_id, token, patch) => {
    assert.equal(product.telegramReconcileClaim.token, token);
    product = { ...product, ...patch };
    delete product.telegramReconcileClaim;
    return structuredClone(product);
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const method = String(url).split('/').at(-1);
    const body = JSON.parse(options.body);
    calls.push({ method, body });
    if (method === 'deleteMessage') return new Response(JSON.stringify({ ok: true, result: true }));
    if (method === 'sendMessage') return new Response(JSON.stringify({ ok: true, result: {
      message_id: 50, text: formatProductCaption(product), date: Math.floor(Date.now() / 1000),
    } }));
    throw new Error(`Unexpected ${method}`);
  });
  const absent = { state: 'absent', present: [], absent: [7, 8] };
  const partial = { state: 'absent', present: [8], absent: [7] };
  let result = await reconcileDeletedTelegramPost('p1', { check: async () => ({ state: 'unknown' }) });
  assert.equal(result.status, 'unverified');
  assert.deepEqual(calls, []);
  result = await reconcileDeletedTelegramPost('p1', { check: async () => ({ state: 'present' }) });
  assert.equal(result.status, 'present');
  assert.deepEqual(calls, []);
  let checks = 0;
  result = await reconcileDeletedTelegramPost('p1', { check: async () => [partial, partial, absent][checks++] });
  assert.equal(result.status, 'republished');
  assert.equal(checks, 3);
  assert.deepEqual(calls.map((call) => call.method), ['deleteMessage', 'sendMessage']);
  assert.equal(calls[0].body.message_id, 8);
  assert.deepEqual(product.telegramMessageIds, [50]);
  assert.deepEqual(product.telegramSupersededMessageIds, [7, 8]);
  assert.equal(product.telegramCleanupStatus, 'complete');
  assert.equal(product.telegramPostVerified, true);
  assert.equal(product.telegramReconcileClaim, undefined);
});

test('reconciliation blocks when the second read changes or cleanup fails', async (t) => {
  let product = { id: 'p2', status: 'published', telegramChannelId: '-1001', telegramMessageId: 7, telegramMessageIds: [7, 8] };
  let finished = 0;
  t.mock.method(records, 'get', async () => structuredClone(product));
  t.mock.method(records, 'claimTelegramReconcile', async (_id, _messageId, claim) => { product.telegramReconcileClaim = claim; return true; });
  t.mock.method(records, 'finishTelegramReconcile', async () => { finished++; delete product.telegramReconcileClaim; return product; });
  const absent = { state: 'absent', present: [], absent: [7, 8] };
  let checks = 0;
  let result = await reconcileDeletedTelegramPost('p2', { check: async () => [absent, { state: 'unknown' }][checks++] });
  assert.equal(result.status, 'unverified');
  assert.equal(finished, 1);
  checks = 0;
  result = await reconcileDeletedTelegramPost('p2', { check: async () => [absent, { state: 'absent', present: [8], absent: [7] }][checks++] });
  assert.equal(result.status, 'unverified');
  assert.equal(finished, 2);
});

test('Bot API not-found deletion response is a failure', async (t) => {
  const oldToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  t.after(() => oldToken === undefined ? delete process.env.TELEGRAM_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN = oldToken);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    ok: false, error_code: 400, description: 'Bad Request: message to delete not found',
  }), { status: 400 }));
  await assert.rejects(deleteTelegramProductPost({ telegramChannelId: '-1001', telegramMessageIds: [7] }), /not found/);
});

test('a competing reconciliation claim prevents publication', async (t) => {
  t.mock.method(records, 'get', async () => ({
    id: 'p3', status: 'published', telegramMessageId: 7, telegramMessageIds: [7],
  }));
  t.mock.method(records, 'claimTelegramReconcile', async () => false);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not publish'); });
  const result = await reconcileDeletedTelegramPost('p3', {
    check: async () => ({ state: 'absent', present: [], absent: [7] }),
  });
  assert.deepEqual(result, { status: 'blocked', reason: 'product_changed_or_claimed' });
});
