export const OFFLINE_MESSAGE =
  'Offline: viewing only. Connect to internet before registering changes in the database.';

export class ApiError extends Error {
  kind: 'offline' | 'db' | 'http';
  status?: number;
  constructor(kind: 'offline' | 'db' | 'http', message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

type StatusListener = (writesUnavailable: boolean) => void;
let statusListener: StatusListener | null = null;
export function onDbStatus(fn: StatusListener) {
  statusListener = fn;
}

export interface ApiHealth {
  ok: boolean;
  db: boolean;
  writable: boolean;
  localStore?: boolean;
  primary?: 'mysql' | 'local';
  version?: string;
  error?: string;
}

const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiUrl = (path: string) => `${APP_BASE}/api${path}`;
const mediaUrl = (value: string) => {
  if (!value.startsWith('/uploads/')) return value;
  return `${APP_BASE}${value}`;
};

function normalizeMediaUrls<T>(value: T): T {
  if (typeof value === 'string') return mediaUrl(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeMediaUrls(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeMediaUrls(item)])
    ) as T;
  }
  return value;
}

function token(): string | null {
  return localStorage.getItem('mena_token');
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem('mena_token', t);
  else localStorage.removeItem('mena_token');
}

export async function checkApiHealth(): Promise<ApiHealth> {
  try {
    const res = await fetch(apiUrl('/health'), {
      headers: headers(false),
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({})) as Partial<ApiHealth>;
    const writable = res.ok && body.writable !== false;
    statusListener?.(!writable);
    return {
      ok: res.ok && body.ok !== false,
      db: Boolean(body.db),
      writable,
      localStore: body.localStore,
      primary: body.primary,
      version: body.version,
      error: body.error,
    };
  } catch {
    statusListener?.(true);
    return { ok: false, db: false, writable: false, error: 'server_unreachable' };
  }
}

function refreshWriteStatus() {
  void checkApiHealth();
}

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const t = token();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

const CACHE_PREFIX = 'mena_cache:';

export function readCache<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path);
    return raw ? normalizeMediaUrls(JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(path: string, data: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
  } catch {
    /* storage full — cached view is best-effort */
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let dbDown = false;
  try {
    const body = await res.json();
    if (body.message) message = body.message;
    if (body.error === 'db_unavailable') dbDown = true;
  } catch { /* non-JSON error body */ }
  if (dbDown || res.status === 503) {
    return new ApiError('db', 'Database connection failed. Please try again shortly.', res.status);
  }
  return new ApiError('http', message, res.status);
}

/**
 * Cached GET: returns fresh data when reachable (and refreshes the cache);
 * falls back to the last cached copy when offline or the server is down.
 */
export async function apiGet<T>(path: string): Promise<T> {
  if (!navigator.onLine) {
    const cached = readCache<T>(path);
    if (cached !== null) return cached;
    throw new ApiError('offline', OFFLINE_MESSAGE);
  }
  try {
    const res = await fetch(apiUrl(path), { headers: headers(false) });
    if (!res.ok) throw await parseError(res);
    const data = normalizeMediaUrls((await res.json()) as T);
    writeCache(path, data);
    statusListener?.(false);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      const cached = readCache<T>(path);
      if (err.kind === 'db' && cached !== null) {
        refreshWriteStatus();
        return cached;
      }
      if (err.kind === 'db') await checkApiHealth();
      throw err;
    }
    // Network-level failure while the browser still reports online.
    const cached = readCache<T>(path);
    if (cached !== null) {
      refreshWriteStatus();
      return cached;
    }
    await checkApiHealth();
    throw new ApiError('db', 'Could not reach the server.');
  }
}

/** Mutations are blocked offline — the database must be reachable. */
export async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!navigator.onLine) throw new ApiError('offline', OFFLINE_MESSAGE);
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers: headers(true),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    statusListener?.(true);
    throw new ApiError('db', 'Could not reach the server.');
  }
  if (!res.ok) throw await parseError(res);
  statusListener?.(false);
  return (await res.json()) as T;
}

export async function apiUpload(files: File[]): Promise<string[]> {
  if (!navigator.onLine) throw new ApiError('offline', OFFLINE_MESSAGE);
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const res = await fetch(apiUrl('/admin/upload'), {
    method: 'POST',
    headers: headers(false),
    body: form,
  });
  // 406/413 come from the hosting layer's body-size limit, not our API — the
  // response is an HTML error page with no usable message.
  if (res.status === 406 || res.status === 413) {
    throw new ApiError('http', 'Upload rejected: the image is too large for the server. Try a smaller photo.', res.status);
  }
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as { urls: string[] };
  return data.urls.map(mediaUrl);
}
