import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { productPageMiddleware } from '../src/product-page-meta.mjs';

test('product links render public product photo metadata for link crawlers', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mena-product-meta-'));
  const index = path.join(root, 'index.html');
  await fs.writeFile(index, '<html><head><meta name="description" content="Store" /><title>Store</title></head><body><div id="root"></div></body></html>');
  const products = new Map([
    ['photo-1', { id: 'photo-1', name: 'Rose & Ivory', description: 'A wedding card\nwith a soft finish.', photos: ['/uploads/rose.jpg'], status: 'published' }],
    ['draft', { id: 'draft', name: 'Hidden', photos: ['/uploads/hidden.jpg'], status: 'draft' }],
  ]);
  const app = express();
  app.use(productPageMiddleware({
    clientIndex: index,
    basePath: '/shop',
    getProduct: (id) => products.get(id),
    publicShopUrl: 'https://menaincet.com/shop',
  }));
  app.use((_req, res) => res.status(404).send('Not found'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/shop/product/photo-1', '/product/photo-1']) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<meta property="og:image" content="https:\/\/menaincet\.com\/shop\/uploads\/rose\.jpg"/);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/menaincet\.com\/shop\/uploads\/rose\.jpg"/);
    assert.match(html, /<meta property="og:url" content="https:\/\/menaincet\.com\/shop\/product\/photo-1"/);
    assert.match(html, /<title>Rose &amp; Ivory \| mena inc<\/title>/);
    assert.doesNotMatch(html, /<title>Store<\/title>/);
  }
  assert.equal((await fetch(`${base}/shop/product/draft`)).status, 404);
  assert.equal((await fetch(`${base}/shop/product/missing`)).status, 404);
});
