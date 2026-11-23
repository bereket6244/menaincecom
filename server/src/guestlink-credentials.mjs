import { records } from './db.mjs';
import { hashPassword } from './auth.mjs';

const GUESTLINK_API = 'https://menaincet.com/guestlink/api';
const PHONE = /^\+?[0-9]{9,15}$/;

/** GuestLink owns the admin decision and the account-to-shop identity link. */
export async function linkedGuestlinkShopId(accountId, token, fetchImpl = fetch, username = '') {
  if (!/^[0-9a-f-]{36}$/i.test(accountId) || !token || token.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(token)) return null;
  const suffix = username ? `?username=${encodeURIComponent(username)}` : '';
  const response = await fetchImpl(`${GUESTLINK_API}/accounts/${encodeURIComponent(accountId)}/shop-identity${suffix}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  return typeof body.shop_user_id === 'string' && body.shop_user_id.length <= 128 ? body.shop_user_id : null;
}

export async function updateGuestlinkShopCredentials({ accountId, token, username = '', password = '' }, deps = {}) {
  const identifier = String(username).trim().toLowerCase();
  const shopId = await linkedGuestlinkShopId(accountId, token, deps.fetchImpl, identifier);
  if (!shopId) return { status: 403, message: 'GuestLink admin access or linked Mena account could not be verified.' };
  const store = deps.store || records;
  const user = await store.get('users', shopId);
  if (!user || user.role !== 'customer') return { status: 409, message: 'This Mena account cannot be changed here.' };
  const nextPassword = String(password);
  if (!identifier && !nextPassword) return { status: 400, message: 'Enter a new email, phone number, or password.' };
  if (identifier && (identifier.length > 64 || !(identifier.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) : PHONE.test(identifier)))) {
    return { status: 400, message: 'Enter a valid email address or phone number (up to 64 characters).' };
  }
  if (nextPassword && (nextPassword.length < 8 || nextPassword.length > 128)) {
    return { status: 400, message: 'New password must be 8–128 characters.' };
  }
  if (identifier && identifier !== user.identifier) {
    const other = await store.find('users', (candidate) => candidate.identifier === identifier && candidate.id !== shopId);
    if (other) return { status: 409, message: 'That email or phone number is already in use.' };
  }
  const patch = { credentialsVersion: (Number(user.credentialsVersion) || 0) + 1 };
  if (identifier) patch.identifier = identifier;
  if (nextPassword) patch.passwordHash = await hashPassword(nextPassword);
  const updated = await store.update('users', shopId, patch);
  if (!updated) return { status: 503, message: 'Could not update the Mena account.' };
  return { status: 200, ok: true };
}
