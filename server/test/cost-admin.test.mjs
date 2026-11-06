import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { api } from '../src/routes.mjs';
import { records } from '../src/db.mjs';
import { signToken } from '../src/auth.mjs';

test('admin accepts custom margins and deletes only unused materials', async t => {
  const material = { id: 'paper', name: 'Paper', unitCost: 100 };
  let product = { id: 'sample', name: 'Sample', status: 'draft', photos: [] };
  let removed = false;
  t.mock.method(records, 'get', async (collection, id) => collection === 'users'
    ? { id: 'admin-test', role: 'admin' } : collection === 'products' ? product : id === material.id && !removed ? material : null);
  t.mock.method(records, 'list', async collection => collection === 'cost_inputs' ? [material] : collection === 'products' ? [product] : []);
  t.mock.method(records, 'update', async (collection, id, patch) => (product = { ...product, ...patch }));
  t.mock.method(records, 'remove', async (collection, id) => {
    assert.equal(collection, 'cost_inputs'); assert.equal(id, material.id); removed = true; return true;
  });
  const app = express(); app.use(express.json(), api);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ id: 'admin-test', role: 'admin' })}` };
  const response = await fetch(`${base}/admin/products/sample`, { method: 'PUT', headers, body: JSON.stringify({ cost: {
    items: [{ inputId: 'paper', quantity: 1 }], margin: 27.75, roundDirection: 'down', roundUp: 5,
    thresholds: [{ minQty: 50, margin: 13.7 }],
  } }) });
  assert.equal(response.status, 200, await response.clone().text());
  const saved = await response.json();
  assert.equal(saved.price, 125); assert.equal(saved.cost.margin, 27.75);
  assert.equal(saved.cost.thresholds[0].margin, 13.7);
  const remove = () => fetch(`${base}/admin/cost-inputs/paper`, { method: 'DELETE', headers });
  assert.equal((await remove()).status, 409); assert.equal(removed, false);
  product.deletedAt = new Date().toISOString();
  assert.equal((await remove()).status, 409);
  product.cost = null;
  assert.equal((await remove()).status, 200); assert.equal(removed, true);
  assert.equal((await remove()).status, 404);
  assert.equal((await fetch(`${base}/admin/cost-inputs/paper`, { method: 'DELETE' })).status, 401);
});

test('checkout stores the blended rate and exact total above the threshold', async t => {
  const product = { id: 'cards', name: 'Cards', status: 'published', photos: [], pricingMode: 'tiered', price: 100,
    priceTiers: [{ minQty: 1, priceEach: 100 }, { minQty: 10, priceEach: 80 }] };
  const savedOrders = [];
  t.mock.method(records, 'list', async collection => collection === 'products' ? [product] : []);
  t.mock.method(records, 'insert', async (collection, data) => {
    const saved = { id: 'order-' + savedOrders.length, ...structuredClone(data) };
    if (collection === 'orders') savedOrders.push(saved);
    return saved;
  });
  const realFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1:')) return realFetch(url, options);
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
  const app = express(); app.use(express.json(), api);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const order = (qty, expectedPriceEach) => fetch(`${base}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'sms', items: [{ productId: 'cards', qty, expectedPriceEach }] }) });
  for (const [qty, total] of [[9, 900], [10, 1000], [11, 1080]]) {
    const response = await order(qty, total / qty);
    assert.equal(response.status, 200, await response.clone().text());
    const { order: saved } = await response.json();
    assert.equal(saved.estimatedTotal, total);
    assert.equal(saved.items[0].priceEach, total / qty);
    assert.equal(Math.round(saved.items[0].priceEach * qty * 100) / 100, total);
  }
  assert.equal((await order(11, 80)).status, 409);
  product.priceTiers[1].priceEach = 60;
  assert.equal(savedOrders[2].estimatedTotal, 1080);
  assert.equal(savedOrders[2].items[0].priceEach, 1080 / 11);
});
