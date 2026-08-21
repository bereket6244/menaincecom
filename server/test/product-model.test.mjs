import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicProduct, normalizeProductStatus, publicProduct, telegramProductIdentity } from '../src/product-model.mjs';
import { formatProductCaption, shouldCreateTelegramPost, shouldUpdateTelegramPost } from '../src/product-telegram.mjs';

test('legacy products remain published while drafts stay private', () => {
  assert.equal(normalizeProductStatus(undefined), 'published');
  assert.equal(isPublicProduct({ name: 'Legacy' }), true);
  assert.equal(isPublicProduct({ status: 'draft' }), false);
  assert.equal(isPublicProduct({ status: 'published', deletedAt: '2026-08-15T00:00:00.000Z' }), false);
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

test('published Telegram products update when the content version changes', () => {
  const original = process.env.TELEGRAM_SYNC_ENABLED;
  process.env.TELEGRAM_SYNC_ENABLED = 'true';
  try {
    assert.equal(shouldUpdateTelegramPost(
      { status: 'published', contentVersion: 2 },
      { status: 'published', contentVersion: 3, telegramChannelId: '-1001', telegramMessageId: 42 }
    ), true);
    assert.equal(shouldUpdateTelegramPost(
      { status: 'published', contentVersion: 3 },
      { status: 'published', contentVersion: 3, telegramChannelId: '-1001', telegramMessageId: 42 }
    ), false);
    assert.equal(shouldUpdateTelegramPost(
      { status: 'published', contentVersion: 2 },
      { status: 'draft', contentVersion: 3, telegramChannelId: '-1001', telegramMessageId: 42 }
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
    categoryNames: ['Wedding Invitations'],
    variants: [
      { name: 'Size', options: [{ label: 'A6' }, { label: 'A5' }] },
      { name: 'Paper', options: [{ label: 'Matte 300gsm' }] },
    ],
  });
  assert.match(caption, /Pocket Card/);
  assert.match(caption, /Price: From 125 ETB/);
  assert.match(caption, /Item type: Wedding Invitations/);
  assert.match(caption, /Size: A6, A5/);
  assert.match(caption, /#wedding_invitations/);
  assert.match(caption, /#size_a6/);
  assert.match(caption, /#paper_matte_300gsm/);
  assert.match(caption, /\/product\/product%201/);
  assert.ok(caption.length <= 1024);
});
