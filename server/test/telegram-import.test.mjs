import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parsePrices, parseTitle, classifyMessages } from '../src/telegram-import/classifier.mjs';
import { parseTelegramHtmlExport } from '../src/telegram-import/html-parser.mjs';
import { parseTelegramJsonExport } from '../src/telegram-import/json-parser.mjs';
import { buildImportProduct } from '../src/telegram-import/production-import.mjs';

test('parses exact and tiered ETB prices', () => {
  assert.deepEqual(parsePrices('Pocket card 95 ETB'), [95]);
  assert.deepEqual(parsePrices('<500 = 115birr\n>500 = 110 birr'), [115, 110]);
});

test('extracts a title without its trailing price', () => {
  assert.equal(parseTitle('Acrylic tracing paper with ribbon 320 birr'), 'Acrylic tracing paper with ribbon');
  assert.equal(parseTitle('85 birr\nAvailable in white'), '');
  assert.equal(parseTitle('35 ETB\nEntrance cards are free with your purchase.'), '');
});

test('classifies priced media as a product without inventing fields', () => {
  const [message] = classifyMessages([{
    id: 42,
    date: '2026-01-01T10:00:00+03:00',
    text: 'Pocket card\n95 ETB',
    hashtags: ['budget'],
    media: [{ kind: 'photo', relativePath: 'photos/p.jpg', exists: true }],
    replyToMessageId: null,
    inferredMediaGroupId: null,
    albumRepresentativeId: null,
    albumMedia: null,
  }], 'menaweddingcatalogue');
  assert.equal(message.classification, 'product');
  assert.equal(message.proposedProduct.name, 'Pocket card');
  assert.equal(message.proposedProduct.price, 95);
  assert.equal(message.proposedProduct.telegramPostUrl, 'https://t.me/menaweddingcatalogue/42');
});

test('HTML parser preserves caption, message ID, timestamp, and media hash', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mena-telegram-test-'));
  await fs.mkdir(path.join(root, 'photos'));
  await fs.writeFile(path.join(root, 'photos', 'sample.jpg'), 'sample image');
  await fs.writeFile(path.join(root, 'messages.html'), `
    <div class="page_header"><div class="text bold">Test Channel</div></div>
    <div class="message default clearfix" id="message7"><div class="body">
      <div class="date details" title="03.08.2026 12:00:00 UTC+03:00">12:00</div>
      <a class="photo_wrap" href="photos/sample.jpg"></a>
      <div class="text">Wax card<br>120 ETB <a>#modern</a></div>
    </div></div>
  `);
  const parsed = await parseTelegramHtmlExport(root);
  assert.equal(parsed.channelName, 'Test Channel');
  assert.equal(parsed.messages[0].id, 7);
  assert.equal(parsed.messages[0].text, 'Wax card\n120 ETB #modern');
  assert.equal(parsed.messages[0].date, '2026-08-03T12:00:00+03:00');
  assert.equal(parsed.messages[0].media[0].sha256.length, 64);
});

test('JSON parser flattens rich text and exposes the numeric channel ID', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mena-telegram-json-test-'));
  await fs.mkdir(path.join(root, 'photos'));
  await fs.writeFile(path.join(root, 'photos', 'sample.jpg'), 'sample image');
  await fs.writeFile(path.join(root, 'result.json'), JSON.stringify({
    name: 'Test Channel',
    type: 'public_channel',
    id: 1845653017,
    messages: [{
      id: 7,
      type: 'message',
      date: '2026-08-03T12:00:00',
      date_unixtime: '1785747600',
      from_id: 'channel1845653017',
      photo: 'photos/sample.jpg',
      text: ['Wax card\n120 ETB ', { type: 'hashtag', text: '#modern' }],
      text_entities: [{ type: 'hashtag', text: '#modern' }],
    }],
  }));
  const parsed = await parseTelegramJsonExport(root);
  assert.equal(parsed.format, 'json');
  assert.equal(parsed.channelId, 1845653017);
  assert.equal(parsed.messages[0].text, 'Wax card\n120 ETB #modern');
  assert.deepEqual(parsed.messages[0].hashtags, ['modern']);
});

test('production mapping keeps uncertain reposts in draft review', () => {
  const record = {
    id: 42,
    classification: 'product_repost',
    classificationReasons: ['repeated_caption'],
    inferredMediaGroupId: null,
    proposedProduct: {
      name: 'Pocket card', description: 'Pocket card\n95 ETB', pricingMode: 'exact', price: 95,
      telegramMessageId: 42, telegramMediaGroupId: null,
      telegramPostUrl: 'https://t.me/menaweddingcatalogue/42', telegramOriginalCaption: 'Pocket card\n95 ETB',
      originalPublishedAt: '2026-01-01T00:00:00Z', unavailable: false, needsReview: false,
      reviewReasons: [], tags: ['budget'],
    },
  };
  const product = buildImportProduct(record, {
    records: [record], categoryId: 'category-1', channelId: '-1001845653017',
    publishConfident: true, batchId: 'batch-1', importedAt: '2026-08-03T00:00:00Z',
  });
  assert.equal(product.status, 'draft');
  assert.equal(product.needsReview, true);
  assert.ok(product.reviewReasons.includes('possible_repost'));
});
