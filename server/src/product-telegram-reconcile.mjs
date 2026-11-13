import crypto from 'node:crypto';
import { records } from './db.mjs';
import { checkTelegramPostPresence } from './telegram-presence.mjs';
import { createTelegramProductPost, deleteTelegramProductPost } from './product-telegram.mjs';
import { normalizeProductStatus } from './product-model.mjs';

export async function reconcileDeletedTelegramPost(id, { check = checkTelegramPostPresence, resolve = (product) => product } = {}) {
  const product = await records.get('products', id);
  if (!product) return { status: 'not_found' };
  if (normalizeProductStatus(product.status) !== 'published' || product.deletedAt || product.telegramDeletedAt) {
    return { status: 'skipped', reason: 'product_not_published' };
  }
  if (!Number.isSafeInteger(Number(product.telegramMessageId)) || Number(product.telegramMessageId) <= 0) {
    return { status: 'skipped', reason: 'no_saved_post' };
  }
  if (product.telegramCleanupStatus === 'pending') return { status: 'blocked', reason: 'previous_cleanup_pending' };
  if (product.telegramReconcileClaim) return { status: 'blocked', reason: 'reconciliation_claim_pending' };
  const first = await check(product);
  if (first.state !== 'absent') return { status: first.state === 'present' ? 'present' : 'unverified', presence: first };

  const claim = { token: crypto.randomUUID(), at: new Date().toISOString() };
  if (!await records.claimTelegramReconcile(id, product.telegramMessageId, claim)) {
    return { status: 'blocked', reason: 'product_changed_or_claimed' };
  }
  let sent = false;
  try {
    const current = await records.get('products', id);
    if (!current || current.telegramReconcileClaim?.token !== claim.token
      || Number(current.telegramMessageId) !== Number(product.telegramMessageId)
      || normalizeProductStatus(current.status) !== 'published' || current.deletedAt || current.telegramDeletedAt) {
      return { status: 'blocked', reason: 'product_changed' };
    }
    const second = await check(current);
    if (second.state !== 'absent') {
      return { status: second.state === 'present' ? 'present' : 'unverified', presence: second };
    }
    const oldIds = [...new Set([...(current.telegramMessageIds || []), current.telegramMessageId]
      .map(Number).filter((value) => Number.isSafeInteger(value) && value > 0))];
    if (second.present.length) {
      // Delete only confirmed surviving album fragments, before sending anything new.
      await deleteTelegramProductPost({ ...current, telegramMessageId: null, telegramMessageIds: second.present });
      const afterDeletion = await check(current);
      if (afterDeletion.state !== 'absent' || afterDeletion.present.length) {
        return { status: 'unverified', reason: 'old_post_cleanup_not_confirmed', presence: afterDeletion };
      }
    }
    const latest = await records.get('products', id);
    if (latest?.telegramReconcileClaim?.token !== claim.token
      || Number(latest.telegramMessageId) !== Number(product.telegramMessageId)
      || normalizeProductStatus(latest.status) !== 'published') {
      return { status: 'blocked', reason: 'product_changed' };
    }
    sent = true;
    const patch = await createTelegramProductPost(await resolve(latest));
    const saved = await records.finishTelegramReconcile(id, claim.token, {
      ...patch,
      telegramSupersededMessageIds: oldIds,
      telegramCleanupStatus: 'complete',
      telegramOldPostAbsentAt: new Date().toISOString(),
      ...(patch.telegramPostVerified ? {} : {
        telegramSyncStatus: 'error',
        telegramSyncError: { message: 'Telegram returned replacement messages, but their content or photos could not be verified.' },
      }),
    });
    if (!saved) return { status: 'blocked', reason: 'replacement_linkage_not_saved', replacementMessageIds: patch.telegramMessageIds };
    return {
      status: patch.telegramPostVerified ? 'republished' : 'replacement_unverified',
      oldMessageIds: oldIds,
      newMessageIds: patch.telegramMessageIds,
      cleanup: 'confirmed_absent',
      product: saved,
    };
  } catch {
    if (sent) {
      // Preserve the claim after a send/storage failure. A retry must not create a duplicate.
      return { status: 'blocked', reason: 'publication_or_storage_uncertain' };
    }
    return { status: 'unverified', reason: 'reconciliation_failed' };
  } finally {
    if (!sent) await records.finishTelegramReconcile(id, claim.token, {}).catch(() => {});
  }
}
