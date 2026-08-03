#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseTelegramJsonExport } from './json-parser.mjs';
import { classifyMessages } from './classifier.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.png' ? 'image/png'
    : extension === '.webp' ? 'image/webp'
      : extension === '.gif' ? 'image/gif'
        : extension === '.avif' ? 'image/avif'
          : 'image/jpeg';
}

async function request(baseUrl, route, options = {}) {
  const { timeout = 120_000, ...fetchOptions } = options;
  const response = await fetch(`${baseUrl}${route}`, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeout),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `${route} failed with HTTP ${response.status}`);
  return body;
}

function importStatus(record, publishConfident) {
  if (record.proposedProduct.unavailable) return 'archived';
  const uncertain = record.classification !== 'product' || record.proposedProduct.needsReview;
  if (uncertain || !publishConfident) return 'draft';
  return 'published';
}

export function buildImportProduct(record, context) {
  const proposed = record.proposedProduct;
  if (!proposed?.name) return null;
  const groupMembers = record.inferredMediaGroupId
    ? context.records.filter((item) => item.inferredMediaGroupId === record.inferredMediaGroupId).map((item) => item.id)
    : [record.id];
  const needsReview = proposed.needsReview || record.classification !== 'product';
  return {
    name: proposed.name,
    categoryId: context.categoryId,
    description: proposed.description,
    photos: [],
    pricingMode: proposed.pricingMode,
    price: proposed.price,
    variants: [],
    isAddon: false,
    suggestedAddonIds: [],
    complimentaryItems: [],
    universalComplimentaryItemIds: [],
    featured: false,
    status: importStatus(record, context.publishConfident),
    contentVersion: 1,
    sourcePlatform: 'telegram_export',
    telegramChannelId: context.channelId,
    telegramMessageId: proposed.telegramMessageId,
    telegramMessageIds: groupMembers,
    telegramMediaGroupId: proposed.telegramMediaGroupId,
    telegramPostUrl: proposed.telegramPostUrl,
    telegramOriginalCaption: proposed.telegramOriginalCaption,
    telegramSyncStatus: 'existing_manual_post',
    telegramSyncedVersion: 1,
    telegramLastSyncedAt: context.importedAt,
    originalPublishedAt: proposed.originalPublishedAt,
    importBatchId: context.batchId,
    importedAt: context.importedAt,
    needsReview,
    reviewReasons: [...new Set([
      ...proposed.reviewReasons,
      ...record.classificationReasons,
      ...(record.classification === 'product_repost' ? ['possible_repost'] : []),
      ...(record.classification === 'product_update' ? ['possible_product_update'] : []),
    ])],
    tags: proposed.tags,
  };
}

async function uploadPhotos(baseUrl, token, exportRoot, relativePaths) {
  const form = new FormData();
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(exportRoot, relativePath);
    const buffer = await fs.readFile(absolutePath);
    form.append('files', new Blob([buffer], { type: mimeType(absolutePath) }), path.basename(absolutePath));
  }
  const result = await request(baseUrl, '/admin/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return result.urls || [];
}

export async function runProductionImport() {
  dotenv.config({ path: path.resolve('.env') });
  const exportOption = option('export');
  if (!exportOption) throw new Error('--export is required.');
  const exportRoot = path.resolve(exportOption);
  const baseUrl = String(option('base-url') || 'https://menaincet.com/shop/api').replace(/\/$/, '');
  const outputDir = path.resolve(option('output') || 'reports/production-import');
  const apply = process.argv.includes('--apply');
  const publishConfident = process.argv.includes('--publish-confident');
  const backupReference = option('backup-reference');
  if (apply && !backupReference) throw new Error('--backup-reference is required with --apply.');

  const parsed = await parseTelegramJsonExport(exportRoot);
  const records = classifyMessages(parsed.messages, 'menaweddingcatalogue');
  const categories = await request(baseUrl, '/categories');
  const category = categories.find((item) => item.name === 'Wedding Invitations');
  if (!category) throw new Error('The Wedding Invitations category was not found.');
  const batchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const context = {
    records,
    categoryId: category.id,
    channelId: `-100${parsed.channelId}`,
    publishConfident,
    batchId,
    importedAt,
  };
  const candidates = records.map((record) => ({ record, product: buildImportProduct(record, context) }))
    .filter((item) => item.product);
  const state = {
    batchId,
    startedAt: importedAt,
    mode: apply ? 'production' : 'dry-run',
    backupReference: backupReference || null,
    counts: {
      candidates: candidates.length,
      published: candidates.filter((item) => item.product.status === 'published').length,
      drafts: candidates.filter((item) => item.product.status === 'draft').length,
      archived: candidates.filter((item) => item.product.status === 'archived').length,
      skippedMissingTitle: records.filter((record) => record.proposedProduct && !record.proposedProduct.name).length,
      created: 0,
      skippedExisting: 0,
      failed: 0,
    },
    items: [],
  };
  await fs.mkdir(outputDir, { recursive: true });
  const statePath = path.join(outputDir, `import-${batchId}.json`);
  const saveState = () => fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  if (!apply) {
    state.items = candidates.map(({ record, product }) => ({
      telegramMessageId: record.id,
      name: product.name,
      status: product.status,
      needsReview: product.needsReview,
      reviewReasons: product.reviewReasons,
    }));
    await saveState();
    console.log(JSON.stringify({ statePath, counts: state.counts }, null, 2));
    return;
  }

  const identifier = process.env.IMPORT_ADMIN_IDENTIFIER;
  const password = process.env.IMPORT_ADMIN_PASSWORD;
  if (!identifier || !password) throw new Error('IMPORT_ADMIN_IDENTIFIER and IMPORT_ADMIN_PASSWORD are required.');
  const login = await request(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (login.user?.role !== 'admin' || !login.token) throw new Error('The import account is not an administrator.');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };
  const existingProducts = await request(baseUrl, '/admin/products', { headers });
  const existingIds = new Set(existingProducts
    .filter((product) => product.telegramChannelId && product.telegramMessageId)
    .map((product) => `${product.telegramChannelId}:${product.telegramMessageId}`));

  for (const { record, product } of candidates) {
    const identity = `${product.telegramChannelId}:${product.telegramMessageId}`;
    if (existingIds.has(identity)) {
      state.counts.skippedExisting += 1;
      state.items.push({ telegramMessageId: record.id, status: 'skipped_existing' });
      await saveState();
      continue;
    }
    try {
      product.photos = await uploadPhotos(baseUrl, login.token, exportRoot, record.proposedProduct.photos);
      const created = await request(baseUrl, '/admin/products', {
        method: 'POST', headers, body: JSON.stringify(product),
      });
      existingIds.add(identity);
      state.counts.created += 1;
      state.items.push({ telegramMessageId: record.id, productId: created.id, status: 'created' });
    } catch (error) {
      state.counts.failed += 1;
      state.items.push({ telegramMessageId: record.id, status: 'failed', error: error.message });
    }
    await saveState();
  }
  state.completedAt = new Date().toISOString();
  await saveState();
  console.log(JSON.stringify({ statePath, counts: state.counts }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runProductionImport().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
