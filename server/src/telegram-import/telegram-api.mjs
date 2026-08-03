const API_ROOT = 'https://api.telegram.org';

export async function telegramApi(token, method, payload = {}) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  const response = await fetch(`${API_ROOT}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.description || `Telegram ${method} failed with HTTP ${response.status}.`);
    error.code = result?.error_code || response.status;
    throw error;
  }
  return result.result;
}

export function sanitizedTelegramError(error) {
  return {
    code: error?.code || null,
    message: String(error?.message || 'Unknown Telegram error').replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]'),
  };
}
