import assert from 'node:assert/strict';
import test from 'node:test';
import { updateTelegramProductPost } from '../src/product-telegram.mjs';

test('photo count changes replace safely and retry cleanup without reposting', async (t) => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  t.after(() => {
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });
  let product;
  let denyPermission = false;
  let failDelete = false;
  let invalidContent = false;
  const calls = [];
  const initial = (count = 1) => ({
    id: 'product', name: 'Card', price: 100, status: 'published', contentVersion: 2,
    photos: ['first', 'second', 'third'].slice(0, count + 1),
    telegramChannelId: '-1001', telegramMessageId: 42,
    telegramMessageIds: count === 1 ? [42] : [42, 43],
    telegramPostType: count === 1 ? 'photo' : 'album',
    telegramPostedAt: new Date().toISOString(),
  });
  const persist = async (patch) => {
    calls.push({ method: 'persist' });
    product = { ...product, ...patch };
    return structuredClone(product);
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const method = String(url).split('/').at(-1);
    const body = options.body instanceof FormData ? Object.fromEntries(options.body) : JSON.parse(options.body);
    calls.push({ method, body });
    let result = true;
    if (method === 'getMe') result = { id: 1 };
    if (method === 'getChatMember') result = { status: 'administrator', can_delete_messages: !denyPermission };
    if (method === 'sendMediaGroup') result = JSON.parse(body.media).map((media, index) => ({
      message_id: 100 + index, photo: [{ file_id: media.media }], caption: invalidContent ? 'wrong' : media.caption,
      date: Math.floor(Date.now() / 1000),
    }));
    if (method === 'deleteMessage') {
      assert.ok(product.telegramMessageId >= 100, 'replacement linkage saved before deleting');
      assert.ok(!product.telegramMessageIds.includes(body.message_id), 'never delete replacement');
    }
    const failed = method === 'deleteMessage' && failDelete;
    return new Response(JSON.stringify(failed
      ? { ok: false, error_code: 400, description: "message can't be deleted" }
      : { ok: true, result }), { status: failed ? 400 : 200 });
  });

  for (const count of [1, 2]) {
    product = initial(count);
    calls.length = 0;
    const patch = await updateTelegramProductPost(product, { persist });
    assert.equal(patch.telegramCleanupStatus, 'complete');
    assert.deepEqual(patch.telegramSyncedPhotos, product.photos);
    assert.deepEqual(patch.telegramSupersededMessageIds, count === 1 ? [42] : [42, 43]);
    assert.deepEqual(calls.map((call) => call.method), [
      'getMe', 'getChatMember', 'sendMediaGroup', 'persist', ...Array(count).fill('deleteMessage'),
    ]);
    assert.deepEqual(JSON.parse(calls[2].body.media).map((media) => media.media), product.photos);
  }

  product = { ...initial(), telegramPostedAt: '2020-01-01' };
  calls.length = 0;
  await assert.rejects(updateTelegramProductPost(product, { persist }), /channel admin/);
  assert.deepEqual(calls, []);
  product = initial();
  denyPermission = true;
  await assert.rejects(updateTelegramProductPost(product, { persist }), /Delete messages permission/);
  assert.ok(!calls.some((call) => call.method === 'sendMediaGroup'));
  denyPermission = false;

  product = initial(2);
  failDelete = true;
  await assert.rejects(updateTelegramProductPost(product, { persist }), /can't be deleted/);
  assert.equal(product.telegramCleanupStatus, 'pending');
  assert.deepEqual(product.telegramMessageIds, [100, 101, 102]);
  failDelete = false;
  calls.length = 0;
  await updateTelegramProductPost(product, { persist });
  assert.equal(product.telegramCleanupStatus, 'complete');
  assert.deepEqual(calls.filter((call) => call.method === 'deleteMessage').map((call) => call.body.message_id), [42, 43]);
  assert.ok(!calls.some((call) => call.method.startsWith('send')));

  product = initial();
  invalidContent = true;
  calls.length = 0;
  await assert.rejects(updateTelegramProductPost(product, { persist }), /could not be verified/);
  assert.equal(product.telegramCleanupStatus, 'pending');
  assert.ok(!calls.some((call) => call.method === 'deleteMessage'));
});
