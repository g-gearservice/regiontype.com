#!/usr/bin/env node
/* Unprotect rt-feedback from Cloudflare Access (Zero Trust).
 *
 * Wrangler OAuth cannot write Access apps (403 auth.forbidden). Use an API token:
 *   Profile → API Tokens → Create → Custom
 *   Account → Access: Apps and Policies → Edit
 *
 *   export CLOUDFLARE_API_TOKEN='…'
 *   node relay/unprotect-access.mjs
 */
import { execSync } from 'node:child_process';

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || '0cf4c7fad03c3d370af003af56a365ac';
const WORKER = 'rt-feedback';
const HOST = 'feedback.regiontype.com';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (Access: Apps and Policies Write).');
  console.error('Wrangler login OAuth is not enough for Zero Trust API.');
  process.exit(2);
}

const api = async (method, path, body) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!data.success && method !== 'DELETE') {
    console.error(method, path, r.status, JSON.stringify(data.errors || data, null, 2));
  }
  return { status: r.status, data };
};

const listApps = async () => {
  const all = [];
  let page = 1;
  for (;;) {
    const { data } = await api('GET', `accounts/${ACCOUNT}/access/apps?per_page=50&page=${page}`);
    const chunk = data.result || [];
    all.push(...chunk);
    const info = data.result_info || {};
    if (page >= (info.total_pages || 1)) break;
    page += 1;
  }
  return all;
};

const protectsRelay = app => {
  const name = (app.name || '').toLowerCase();
  const domain = (app.domain || '').toLowerCase();
  if (domain === HOST) return true;
  if (name.includes(WORKER) || name.includes('feedback')) return true;
  const dest = app.destinations || [];
  return dest.some(d => {
    if (d.type === 'all_workers' || d.type === 'all_preview_workers') return true;
    if ((d.type === 'worker' || d.type === 'preview_worker') && d.worker_id === WORKER) return true;
    return false;
  });
};

const bypassBody = {
  type: 'self_hosted',
  name: `${WORKER} public bypass (CLI)`,
  destinations: [{ type: 'worker', worker_id: WORKER }],
  policies: [{
    name: 'Everyone bypass',
    decision: 'bypass',
    include: [{ everyone: {} }],
  }],
};

const verify = () => {
  try {
    const out = execSync(
      `curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS 'https://${HOST}/' ` +
        `-H 'Origin: https://regiontype.com' -H 'Access-Control-Request-Method: POST'`,
      { encoding: 'utf8' },
    );
    console.log('OPTIONS', HOST, '→', out.trim(), out.trim() === '204' ? 'OK' : 'still blocked');
  } catch (e) {
    console.warn('curl verify skipped:', e.message);
  }
};

console.log('Account', ACCOUNT, 'worker', WORKER);
const apps = await listApps();
console.log('Access apps listed:', apps.length);
const hits = apps.filter(protectsRelay);
for (const app of hits) {
  console.log(' -', app.id || app.uid, app.name, app.domain || '', (app.destinations || []).map(d => d.type).join(','));
}

if (hits.length) {
  console.log('\nDeleting matching Access applications…');
  for (const app of hits) {
    const id = app.id || app.uid;
    const { status, data } = await api('DELETE', `accounts/${ACCOUNT}/access/apps/${id}`);
    console.log('DELETE', id, status, data.success ? 'ok' : data.errors);
  }
} else {
  console.log('No matching Access app in list (account-level Worker Access may still apply).');
}

console.log('\nCreating worker-level bypass policy…');
const created = await api('POST', `accounts/${ACCOUNT}/access/apps`, bypassBody);
if (created.data.success) {
  console.log('Bypass app created:', created.data.result?.id || created.data.result?.uid);
} else {
  console.log('Bypass create failed (often already public or token lacks Access Write).');
  console.log('If OPTIONS below is 204, CORS/Access is fine — skip bypass.');
}

verify();
