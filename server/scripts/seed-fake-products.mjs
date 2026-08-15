import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storePath = path.join(serverRoot, 'dev-data.json');
const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const now = new Date().toISOString();
const categories = data.categories || [];

if (!categories.length) throw new Error('No categories found in dev-data.json');

const catIds = categories.map((category) => category.id);
const photoPool = [
  '/uploads/demo/invitation-square.svg',
  '/uploads/demo/invitation-wide.svg',
  '/uploads/demo/invitation-tall.svg',
  '/uploads/demo/invitation-narrow.svg',
  '/uploads/demo/suite-wide.svg',
  '/uploads/demo/suite-tall.svg',
];
const names = [
  'Aster Garden', 'Bole Pearl', 'Lalibela Script', 'Mercato Modern', 'Addis Linen',
  'Dahlia Press', 'Shoa Minimal', 'Entoto Green', 'Blue Nile Fold', 'Timket Gold',
  'Harar Arch', 'Sidama Bloom', 'Axum Monogram', 'Lucy Letterpress', 'Jubilee Ivory',
  'Kaffa Coffee', 'Adwa Crest', 'Fikir Blush', 'Sheger Suite', 'Tana Watercolor',
  'Meskal Velvet', 'Zema Classic', 'Arada Noir', 'Omo Terracotta', 'Walia Crest',
  'Semien Mist', 'Gulele Floral', 'Piassa Ribbon', 'Abyssinia Pearl', 'Rift Valley',
  'Unity Script', 'Coptic Lace', 'Jasmine Seal', 'Mena Matte', 'Velvet RSVP',
  'Botanical Gate', 'Gold Foil Charm', 'Modern Amharic', 'Soft Cotton', 'Rose Quartz',
  'Evergreen Vow', 'Royal Navy', 'Minimal Dove', 'Peony Story', 'Satin Promise',
  'Copper Bloom', 'Cloud Nine', 'Classic Cream', 'Marble Kiss', 'Opal Celebration',
];
const sizes = ['A6', 'A5', 'Square', 'DL'];
const colors = ['Ivory', 'Blush', 'Sage', 'Navy', 'Gold', 'Terracotta'];
const papers = ['Matte 300gsm', 'Cotton 450gsm', 'Pearl 350gsm', 'Textured Linen'];

const existing = data.products || [];
const filtered = existing.filter((product) => {
  const text = `${product.name || ''} ${product.description || ''} ${product.id || ''}`.toLowerCase();
  return !String(product.id || '').startsWith('fake-product-')
    && !/trial product|product trial|\btrial\b/.test(text);
});

const fakeProducts = names.map((name, index) => {
  const n = index + 1;
  const isAddon = n % 17 === 0;
  const pricingMode = n % 13 === 0 ? 'quote' : n % 5 === 0 ? 'starting' : 'exact';
  const basePrice = 65 + (index % 12) * 15;

  return {
    id: `fake-product-${String(n).padStart(3, '0')}`,
    name,
    categoryId: isAddon ? '' : catIds[index % catIds.length],
    description: `${name} sample catalog item for local testing with realistic variants, pricing, and photos.`,
    photos: [photoPool[index % photoPool.length]],
    pricingMode,
    price: pricingMode === 'quote' ? null : basePrice,
    variants: [
      { name: 'Size', options: sizes.slice(0, 2 + (index % 3)).map((label) => ({ label })) },
      { name: 'Color', options: colors.slice(index % 2, index % 2 + 4).map((label) => ({ label })) },
      { name: 'Paper', options: papers.slice(0, 2 + (index % 2)).map((label) => ({ label })) },
    ],
    isAddon,
    suggestedAddonIds: [],
    complimentaryItems: isAddon ? [] : [
      { id: `fake-free-${String(n).padStart(3, '0')}`, enabled: true, name: 'Envelope', type: 'multiplier', qty: 1, extraPriceEach: 8 },
    ],
    universalComplimentaryItemIds: [],
    featured: n % 8 === 0,
    status: 'published',
    deletedAt: null,
    contentVersion: 1,
    createdAt: new Date(Date.now() - (50 - index) * 3600_000).toISOString(),
    updatedAt: now,
  };
});

data.products = [...fakeProducts, ...filtered];
fs.writeFileSync(storePath, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify({
  products: data.products.length,
  fakeProducts: fakeProducts.length,
  removedTrialOrPriorFake: existing.length - filtered.length,
}, null, 2));
