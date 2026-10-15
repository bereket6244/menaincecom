// GuestLink source: bereket6244/Entrance-cards-control@113e0806c565ef250c97699f5d9d6650e7f59294.
// Its deployment workflow passed build, TypeScript, PHP, and MySQL isolation tests.
// Publish only GuestLink; preserve its config.php and all shop files.
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
const env = process.env;
const host = (env.CPANEL_HOST || 'menaincet.com').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
const base = (env.CPANEL_URL || `https://${host.includes(':') ? host : host + ':' + (env.CPANEL_PORT || '2083')}`).trim().replace(/\/+$/, '');
if (new URL(base).protocol !== 'https:') throw new Error('HTTPS required');
if (!env.CPANEL_USER || !env.CPANEL_TOKEN) throw new Error('Missing cPanel credentials');
const target = 'public_html/guestlink';
async function call(endpoint, options = {}) {
  const res = await fetch(base + '/execute/Fileman/' + endpoint, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(120000),
    headers: {Authorization: `cpanel ${env.CPANEL_USER}:${env.CPANEL_TOKEN}`},
  });
  const data = await res.json();
  if (!res.ok || data.status !== 1) throw new Error(`cPanel ${endpoint.split('?')[0]} failed (${res.status}): ${JSON.stringify(data.errors || [])}`);
  return data;
}
const listing = await call('list_files?dir=' + encodeURIComponent(target + '/api'));
if (!listing.data?.some(file => file.file === 'config.php')) throw new Error('GuestLink config.php was not found; refusing deployment');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file));
    else result.push(file);
  }
  return result;
}
const packageFiles = await files('guestlink-package');
// Publish entry points after their dependencies.
const rank = f => f.endsWith('/index.html') ? 3 : f.endsWith('/api/index.php') ? 2 : f.includes('/api/') ? 1 : 0;
packageFiles.sort((a,b) => rank(a)-rank(b));
for (const file of packageFiles) {
  const relative = path.relative('guestlink-package', file).split(path.sep).join('/');
  if (relative === 'api/config.php') throw new Error('Configuration must not be deployed');
  const form = new FormData();
  form.set('dir', target + (path.posix.dirname(relative) === '.' ? '' : '/' + path.posix.dirname(relative)));
  form.set('overwrite', '1');
  form.set('file-1', new Blob([await readFile(file)]), path.basename(file));
  await call('upload_files', {method:'POST',body:form});
  console.log('Published ' + relative);
}
const health = await fetch('https://menaincet.com/guestlink/api/health', {cache:'no-store'}).then(r=>r.json());
if (health.schema_version !== 'guestlink-2026-10-member-accounts' || !health.migrated) throw new Error('Live migration check failed');
console.log('GuestLink published and member migration verified.');
