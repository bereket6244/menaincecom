import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorefrontAd } from '../src/storefront-ad.mjs';

const ad = { enabled: true, label: 'From Mena', title: ' Invitation offer ', description: '', buttonText: 'Explore', href: '/digital-invitations' };
test('normalizes the ad and excludes unrelated input', () => {
  assert.deepEqual(normalizeStorefrontAd({ ...ad, phone: 'unrelated' }), { ...ad, title: 'Invitation offer' });
});
test('supports a blank label and defaults legacy ads', () => {
  assert.equal(normalizeStorefrontAd({ ...ad, label: '' }).label, '');
  const { label, ...legacyAd } = ad;
  assert.equal(normalizeStorefrontAd(legacyAd).label, 'From Mena');
});
test('rejects unsafe or malformed destinations', () => {
  for (const href of ['//evil.com', '/\\evil.com', 'javascript:alert(1)', 'https://', 'https://?', '/bad path']) {
    assert.throws(() => normalizeStorefrontAd({ ...ad, href }));
  }
  for (const href of ['/catalog?category=cards', 'https://example.com/offer']) {
    assert.equal(normalizeStorefrontAd({ ...ad, href }).href, href);
  }
});
test('enforces publishing requirements and field limits', () => {
  for (const patch of [{ title: '' }, { buttonText: '' }, { href: '' }, { enabled: 'true' }, { label: 'a'.repeat(31) }, { title: 'a'.repeat(81) }, { description: null }]) {
    assert.throws(() => normalizeStorefrontAd({ ...ad, ...patch }));
  }
  assert.equal(normalizeStorefrontAd({ ...ad, enabled: false, title: '', buttonText: '', href: '' }).enabled, false);
});
