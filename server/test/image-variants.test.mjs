import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import express from 'express';
import sharp from 'sharp';
import { imageVariants } from '../src/image-variants.mjs';

test('product image variants: size, cache, concurrency, validation and fallback', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mena-image-test-'));
  const uploads = path.join(root, 'uploads');
  const cache = path.join(root, 'cache');
  await fs.mkdir(uploads);
  const original = await sharp(randomBytes(1600 * 1200 * 3), { raw: { width: 1600, height: 1200, channels: 3 } })
    .jpeg({ quality: 92 }).toBuffer();
  await fs.writeFile(path.join(uploads, 'photo.jpg'), original);
  const app = express();
  const api = express.Router();
  api.get('/image', imageVariants(uploads, cache));
  app.use('/shop/api', api);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    await fs.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/shop/api/image`;
  const url = `${base}?file=photo.jpg&width=320`;
  const results = await Promise.all(Array.from({ length: 6 }, () => fetch(url)));
  for (const res of results) assert.equal(res.status, 200);
  const small = Buffer.from(await results[0].arrayBuffer());
  assert.match(results[0].headers.get('content-type'), /image\/webp/);
  assert.match(results[0].headers.get('cache-control'), /max-age=2592000/);
  assert.equal((await sharp(small).metadata()).width, 320);
  assert.ok(small.length < original.length / 4, 'card photo should be substantially smaller');
  assert.equal((await fs.readdir(cache)).length, 1, 'concurrent requests reuse one variant');
  assert.deepEqual(await fs.readFile(path.join(uploads, 'photo.jpg')), original, 'original is preserved');
  assert.deepEqual(Buffer.from(await (await fetch(url)).arrayBuffer()), small, 'cached bytes are reused');
  const queued = await Promise.all([320, 640, 960, 1280].map((width) => fetch(`${base}?file=photo.jpg&width=${width}`)));
  for (const res of queued) assert.equal(res.status, 200, 'queued conversion succeeds');
  for (const query of ['file=../photo.jpg&width=320', 'file=photo.jpg&width=999', 'file=https://example.com/x.jpg&width=320']) {
    assert.equal((await fetch(`${base}?${query}`)).status, 400);
  }
  assert.equal((await fetch(`${base}?file=missing.jpg&width=320`)).status, 404);
  await fs.writeFile(path.join(uploads, 'broken.jpg'), 'invalid image');
  const fallback = await fetch(`${base}?file=broken.jpg&width=320`, { redirect: 'manual' });
  assert.equal(fallback.status, 302);
  assert.equal(fallback.headers.get('location'), '/shop/uploads/broken.jpg');
  assert.equal(fallback.headers.get('cache-control'), 'no-store');
  console.log(`Card variant: ${original.length} → ${small.length} bytes (${Math.round(100 * (1 - small.length / original.length))}% smaller on test fixture)`);
});
