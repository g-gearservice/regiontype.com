#!/usr/bin/env node
/* Harden the regiontype.com zone: TLS, HSTS, security headers, anti-spoofing DNS.
 *
 * Wrangler OAuth is zone:read only, so this needs an API token scoped to the zone:
 *   Zone: Read · Zone Settings: Edit · DNS: Edit · Transform Rules: Edit · WAF: Edit
 *
 *   export CLOUDFLARE_API_TOKEN='…'
 *   node relay/harden-zone.mjs            dry run — prints current state and the plan
 *   node relay/harden-zone.mjs --apply    writes, then checks the live headers
 *
 * Safe to re-run. HSTS preload is left off on purpose: it cannot be taken back quickly.
 */
const ZONE = 'regiontype.com';
const SITE_HOSTS = ['regiontype.com', 'www.regiontype.com'];
/* 중계기는 다른 존에 산다 — 홍수 차단 규칙은 사이트 존이 아니라 그 존에 걸어야
   한다. 같은 존에 걸면 규칙이 아무 요청과도 안 맞아 조용히 아무것도 안 막는다 */
const RELAY_ZONE = 'gearservicevanguard.com';
const RELAY_HOST = 'g.gearservicevanguard.com';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const APPLY = process.argv.includes('--apply');

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (Zone Read, Zone Settings Edit, DNS Edit, Transform Rules Edit, WAF Edit).');
  process.exit(2);
}

const api = async (method, path, body) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ok: !!data.success, result: data.result, errors: data.errors };
};
const fail = (what, res) => console.error(`  ✗ ${what}: ${res.status} ${JSON.stringify(res.errors)}`);

const SETTINGS = {
  ssl: 'strict',                     // GitHub Pages cert covers apex + www
  min_tls_version: '1.2',
  tls_1_3: 'on',
  always_use_https: 'on',
  automatic_https_rewrites: 'on',
  opportunistic_encryption: 'on',
  browser_check: 'on',
  security_header: { strict_transport_security: {
    enabled: true, max_age: 31536000, include_subdomains: true, preload: false, nosniff: true,
  } },
};

/* Only the static site. The relay sets its own CORS headers and must stay fetchable. */
const HEADER_RULE = {
  ref: 'rt-security-headers',
  description: 'regiontype security headers',
  expression: `(http.host in {${SITE_HOSTS.map(h => `"${h}"`).join(' ')}})`,
  action: 'rewrite',
  action_parameters: { headers: Object.fromEntries(Object.entries({
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    /* No script/style/connect limits — they would need the inline JSON-LD and relay hosts
       listed, and a mistake breaks play. These directives cannot break the app. */
    'Content-Security-Policy':
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests",
  }).map(([k, value]) => [k, { operation: 'set', value }])) },
};

/* The domain sends no mail, so tell receivers to reject anything claiming to be from it. */
const MAIL_RECORDS = [
  { type: 'TXT', name: ZONE, content: '"v=spf1 -all"', match: c => c.includes('v=spf1') },
  { type: 'TXT', name: `_dmarc.${ZONE}`, content: '"v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s"', match: c => c.includes('v=DMARC1') },
  { type: 'TXT', name: `*._domainkey.${ZONE}`, content: '"v=DKIM1; p="', match: c => c.includes('v=DKIM1') },
  { type: 'MX', name: ZONE, content: '.', priority: 0, match: () => true },
];
const CAA = ['letsencrypt.org', 'pki.goog', 'ssl.com'];

/* The repo is public, so serving its files leaks nothing — but the site has no reason to
   hand out relay source, build tools, or dotfiles. Pages has no .assetsignore; this is the
   edge standing in for it until the site moves to the Worker. */
const INTERNALS = ['/wrangler.toml', '/_headers', '/_redirects', '/.assetsignore',
                   '/CLAUDE.md', '/CURSOR.md', '/.gitignore', '/README.md'];
const WAF_RULE = {
  ref: 'rt-block-internals',
  description: 'regiontype: the repo is not part of the site',
  expression: `(http.host in {${SITE_HOSTS.map(h => `"${h}"`).join(' ')}} and (`
    + 'starts_with(http.request.uri.path, "/relay/") or '
    + 'starts_with(http.request.uri.path, "/tools/") or '
    /* 점으로 시작하는 건 다 막되 /.well-known/ 은 연다 — 거기로 ACME 챌린지가 와서
       막으면 인증서 갱신이 조용히 깨진다 */
    + '(starts_with(http.request.uri.path, "/.") and '
    + 'not starts_with(http.request.uri.path, "/.well-known/")) or '
    + `http.request.uri.path in {${INTERNALS.map(p => `"${p}"`).join(' ')}}))`,
  action: 'block',
};

/* The worker counts its own windows (RL_FB·RL_SC·RL_AU), but only after it wakes. This one
   sits in front, so a flood is dropped at the edge. Free plan allows exactly one.
   Deliberately loose: a school or office shares one public IP, and a class finishing their
   games together must not trip it. The worker's own windows do the fine counting — this
   only has to cut a flood, so it stays far above anything a room of people can produce. */
const RATE_RULE = {
  ref: 'rt-relay-flood',
  description: 'regiontype relay: per-IP ceiling on writes',
  expression: `(http.host eq "${RELAY_HOST}" and http.request.method eq "POST")`,
  action: 'block',
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    /* Free plan offers one window: 10 seconds. The course has a time limit, so a room that
       starts together finishes together — dozens of score writes land in the same few
       seconds from one public IP. 100 rides over that and still cuts a real flood. */
    period: 10,
    requests_per_period: 100,
    mitigation_timeout: 60,
  },
};

const zones = await api('GET', `zones?name=${ZONE}`);
const zoneId = zones.result?.[0]?.id;
if (!zoneId) { fail('zone lookup', zones); process.exit(1); }
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${ZONE} (${zoneId})\n`);

/* 중계기 존은 따로 찾는다. 없으면 홍수 차단만 건너뛴다 — 사이트 쪽 굳히기는 그대로 돈다 */
const relayZones = await api('GET', `zones?name=${RELAY_ZONE}`);
const relayZoneId = relayZones.result?.[0]?.id;
if (!relayZoneId) console.log(`  (${RELAY_ZONE} 존을 못 찾았다 — 중계기 홍수 차단은 건너뛴다)\n`);

console.log('Zone settings');
for (const [id, want] of Object.entries(SETTINGS)) {
  const cur = await api('GET', `zones/${zoneId}/settings/${id}`);
  if (!cur.ok) { fail(id, cur); continue; }
  const same = JSON.stringify(cur.result.value) === JSON.stringify(want);
  console.log(`  ${same ? '=' : '→'} ${id}: ${JSON.stringify(cur.result.value)}${same ? '' : `  ⇒  ${JSON.stringify(want)}`}`);
  if (APPLY && !same) {
    const res = await api('PATCH', `zones/${zoneId}/settings/${id}`, { value: want });
    if (!res.ok) fail(id, res);
  }
}

console.log('\nDNS records');
const dns = await api('GET', `zones/${zoneId}/dns_records?per_page=100`);
if (!dns.ok) { fail('dns list', dns); process.exit(1); }
for (const r of dns.result) console.log(`  · ${r.type} ${r.name} ${r.content}${r.proxied ? ' (proxied)' : ''}`);

const hasMail = dns.result.some(r => r.type === 'MX' && r.content !== '.');
const plan = [];
if (hasMail) console.log('  ! real MX records exist — skipping SPF/DMARC/null-MX, set those by hand');
else for (const rec of MAIL_RECORDS) {
  const exists = dns.result.some(r => r.type === rec.type && r.name === rec.name && rec.match(r.content));
  if (!exists) plan.push({ type: rec.type, name: rec.name, content: rec.content, ttl: 1,
    ...(rec.priority !== undefined && { priority: rec.priority }) });
}
for (const value of CAA) {
  const exists = dns.result.some(r => r.type === 'CAA' && r.name === ZONE && r.data?.value === value);
  if (!exists) plan.push({ type: 'CAA', name: ZONE, ttl: 1, data: { flags: 0, tag: 'issue', value } });
}
for (const rec of plan) {
  console.log(`  + ${rec.type} ${rec.name} ${rec.content ?? `${rec.data.tag} "${rec.data.value}"`}`);
  if (APPLY) {
    const res = await api('POST', `zones/${zoneId}/dns_records`, rec);
    if (!res.ok) fail(`${rec.type} ${rec.name}`, res);
  }
}
if (!plan.length) console.log('  = nothing to add');

/* PUT replaces a whole phase — read what is there first and keep every rule that is
   not ours, so a rule someone added by hand is not swept away by this script. */
async function putPhase(phase, rule, label, zid = zoneId) {
  console.log(`\n${label}`);
  const path = `zones/${zid}/rulesets/phases/${phase}/entrypoint`;
  const entry = await api('GET', path);
  if (!entry.ok && entry.status !== 404) { fail(`read ${phase}`, entry); return; }
  const had = entry.result?.rules || [];
  const others = had.filter(r => r.ref !== rule.ref)
    .map(({ id, version, last_updated, ...keep }) => keep);
  console.log(`  ${others.length} other rule(s) kept; ${others.length === had.length ? 'adding' : 'replacing'} ${rule.ref}`);
  if (rule.action_parameters?.headers)
    for (const [k, v] of Object.entries(rule.action_parameters.headers)) console.log(`    ${k}: ${v.value}`);
  else console.log(`    ${rule.action}: ${rule.expression}`);
  if (APPLY) {
    const res = await api('PUT', path, { rules: [...others, rule] });
    if (!res.ok) fail(`write ${phase}`, res);
  }
}

await putPhase('http_response_headers_transform', HEADER_RULE, 'Response header rule');
await putPhase('http_request_firewall_custom', WAF_RULE, 'Security rule — repo internals');
if (relayZoneId)
  await putPhase('http_ratelimit', RATE_RULE, `Rate limiting rule — relay writes (${RELAY_ZONE})`, relayZoneId);

if (!APPLY) { console.log('\nNothing written. Re-run with --apply.'); process.exit(0); }

await new Promise(r => setTimeout(r, 5000));
console.log('\nLive check');
for (const url of SITE_HOSTS.map(h => `https://${h}/`).concat(`https://${RELAY_HOST}/where`)) {
  const r = await fetch(url, { redirect: 'manual', headers: { Origin: `https://${ZONE}` } });
  const pick = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'referrer-policy']
    .map(h => `${h}=${r.headers.get(h) ? 'yes' : 'no'}`).join(' ');
  console.log(`  ${r.status} ${url}  ${pick}`);
}
