const WISHLIST_KEY = 'mena_wishlist';

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export function readLocalWishlist(): string[] {
  try {
    return normalizeIds(JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function writeLocalWishlist(ids: string[]) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(normalizeIds(ids)));
}
