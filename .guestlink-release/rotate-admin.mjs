import {randomBytes} from 'node:crypto';

const env = process.env;
for (const name of ['CPANEL_USER', 'CPANEL_TOKEN', 'GUESTLINK_ADMIN_USERNAME', 'GUESTLINK_ADMIN_PASSWORD']) {
  if (!env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const host = (env.CPANEL_HOST || 'menaincet.com').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
const base = (env.CPANEL_URL || `https://${host.includes(':') ? host : host + ':' + (env.CPANEL_PORT || '2083')}`).trim().replace(/\/+$/, '');
const filename = `admin-maintenance-${randomBytes(8).toString('hex')}.php`;
const oneTimeKey = randomBytes(32).toString('hex');
const php = `<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';
$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input) || !hash_equals('${oneTimeKey}', (string)($input['key'] ?? ''))) json_error('Not found.', 404);
register_shutdown_function(static function (): void { @unlink(__FILE__); });
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');
if ($username === '' || strlen($password) < 16) json_error('Invalid credentials.', 400);
$pdo = db();
$pdo->beginTransaction();
try {
  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1 FOR UPDATE');
  $stmt->execute([$username]);
  $id = $stmt->fetchColumn();
  $hash = password_hash($password, PASSWORD_BCRYPT);
  if ($id) {
    $pdo->prepare("UPDATE users SET password_hash = ?, display_name = 'Super Admin', role = 'superadmin', shop_user_id = NULL, is_active = 1 WHERE id = ?")->execute([$hash, $id]);
  } else {
    $id = uuid4();
    $pdo->prepare("INSERT INTO users (id, username, password_hash, display_name, role, shop_user_id, is_active) VALUES (?, ?, ?, 'Super Admin', 'superadmin', NULL, 1)")->execute([$id, $username, $hash]);
  }
  $move = $pdo->prepare("UPDATE events e INNER JOIN users u ON u.id = e.user_id SET e.user_id = ? WHERE u.role IN ('superadmin','admin') AND u.id <> ?");
  $move->execute([$id, $id]);
  $delete = $pdo->prepare("DELETE FROM users WHERE role IN ('superadmin','admin') AND id <> ?");
  $delete->execute([$id]);
  $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role IN ('superadmin','admin')")->fetchColumn();
  $pdo->commit();
  audit($username, 'superadmin', 'admin.rotate_sole_account', null, json_encode(['removed' => $delete->rowCount(), 'reassigned_events' => $move->rowCount()]));
  json_out(['ok' => true, 'username' => $username, 'admin_count' => $adminCount, 'removed' => $delete->rowCount(), 'reassigned_events' => $move->rowCount()]);
} catch (Throwable $error) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_error('Admin rotation failed.', 500);
}
`;

async function cpanel(endpoint, options = {}) {
  const response = await fetch(`${base}/execute/Fileman/${endpoint}`, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    headers: {Authorization: `cpanel ${env.CPANEL_USER}:${env.CPANEL_TOKEN}`, ...(options.headers || {})},
  });
  const data = await response.json();
  if (!response.ok || data.status !== 1) throw new Error(`cPanel ${endpoint} failed (${response.status}).`);
  return data;
}

const form = new FormData();
form.set('dir', 'public_html/guestlink/api');
form.set('overwrite', '0');
form.set('file-1', new Blob([php], {type: 'application/x-httpd-php'}), filename);
await cpanel('upload_files', {method: 'POST', body: form});

const endpoint = `https://menaincet.com/guestlink/api/${filename}`;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({key: oneTimeKey, username: env.GUESTLINK_ADMIN_USERNAME, password: env.GUESTLINK_ADMIN_PASSWORD}),
  signal: AbortSignal.timeout(30000),
});
const result = await response.json();
if (!response.ok || !result.ok || result.admin_count !== 1 || result.username !== env.GUESTLINK_ADMIN_USERNAME) {
  throw new Error(`Admin rotation verification failed (${response.status}).`);
}

const listing = await cpanel(`list_files?dir=${encodeURIComponent('public_html/guestlink/api')}`);
if (listing.data?.some((file) => file.file === filename)) {
  throw new Error('One-time maintenance endpoint did not delete itself.');
}

const login = await fetch('https://menaincet.com/guestlink/api/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: env.GUESTLINK_ADMIN_USERNAME, password: env.GUESTLINK_ADMIN_PASSWORD}),
  signal: AbortSignal.timeout(30000),
});
const loginResult = await login.json();
if (!login.ok || !loginResult.token || loginResult.user?.email !== env.GUESTLINK_ADMIN_USERNAME) {
  throw new Error(`New super-admin login verification failed (${login.status}).`);
}

console.log(JSON.stringify({ok: true, adminCount: 1, removedAdmins: result.removed, reassignedEvents: result.reassigned_events, endpointDeleted: true, loginVerified: true}));
