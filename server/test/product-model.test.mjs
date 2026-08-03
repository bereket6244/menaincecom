import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicProduct, normalizeProductStatus, publicProduct, telegramProductIdentity } from '../src/product-model.mjs';

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
