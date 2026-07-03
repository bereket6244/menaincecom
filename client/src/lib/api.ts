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

type StatusListener = (dbDown: boolean) => void;
let statusListener: StatusListener | null = null;
export function onDbStatus(fn: StatusListener) {
  statusListener = fn;
}

function token(): string | null {
  return localStorage.getItem('mena_token');
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem('mena_token', t);
  else localStorage.removeItem('mena_token');
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
    return raw ? (JSON.parse(raw) as T) : null;
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
    statusListener?.(true);
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
    const res = await fetch(`/api${path}`, { headers: headers(false) });
    if (!res.ok) throw await parseError(res);
    const data = (await res.json()) as T;
    writeCache(path, data);
    statusListener?.(false);
    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      const cached = readCache<T>(path);
      if (err.kind === 'db' && cached !== null) return cached;
      throw err;
    }
    // Network-level failure while the browser still reports online.
    statusListener?.(true);
    const cached = readCache<T>(path);
    if (cached !== null) return cached;
    throw new ApiError('db', 'Could not reach the server.');
  }
}

/** Mutations are blocked offline — the database must be reachable. */
export async function apiSend<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!navigator.onLine) throw new ApiError('offline', OFFLINE_MESSAGE);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
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
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: headers(false),
    body: form,
  });
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as { urls: string[] };
  return data.urls;
}
