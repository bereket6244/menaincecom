import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicProduct, normalizeProductStatus, publicProduct, telegramProductIdentity } from '../src/product-model.mjs';
import { formatProductCaption, shouldCreateTelegramPost } from '../src/product-telegram.mjs';

test('legacy products remain published while drafts stay private', () => {
  assert.equal(normalizeProductStatus(undefined), 'published');
  assert.equal(isPublicProduct({ name: 'Legacy' }), true);
  assert.equal(isPublicProduct({ status: 'draft' }), false);
});

test('public product strips import and synchronization metadata', () => {
  const result = publicProduct({ id: '1', name: 'Card', telegramOriginalCaption: 'metadata', importBatchId: 'batch' });
  assert.deepEqual(result, { id: '1', name: 'Card' });
});

test('Telegram identity is stable per channel and message', () => {
  assert.equal(telegramProductIdentity({ telegramChannelId: '-1001', telegramMessageId: 42 }), '-1001:42');
  assert.equal(telegramProductIdentity({}), null);
});

test('new publication creates a Telegram post only once', () => {
  const original = process.env.TELEGRAM_SYNC_ENABLED;
  process.env.TELEGRAM_SYNC_ENABLED = 'true';
  try {
    assert.equal(shouldCreateTelegramPost(null, { status: 'published' }), true);
    assert.equal(shouldCreateTelegramPost({ status: 'draft' }, { status: 'published' }), true);
    assert.equal(shouldCreateTelegramPost({ status: 'published' }, { status: 'published' }), false);
    assert.equal(shouldCreateTelegramPost(
      { status: 'draft' },
      { status: 'published', telegramChannelId: '-1001', telegramMessageId: 42 }
    ), false);
  } finally {
    if (original === undefined) delete process.env.TELEGRAM_SYNC_ENABLED;
    else process.env.TELEGRAM_SYNC_ENABLED = original;
  }
});

test('Telegram product caption includes price and storefront link', () => {
  const caption = formatProductCaption({
    id: 'product 1', name: 'Pocket Card', description: 'Printed on premium stock',
    pricingMode: 'starting', price: 125,
  });
  assert.match(caption, /Pocket Card/);
  assert.match(caption, /Price: From 125 ETB/);
  assert.match(caption, /\/product\/product%201/);
  assert.ok(caption.length <= 1024);
});
