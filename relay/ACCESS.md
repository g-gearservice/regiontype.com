# Cloudflare Access and the public relay

The feedback relay must be **anonymous** (no login). If Zero Trust protects these hostnames, browsers fail with **OPTIONS 403** or redirect to `cloudflareaccess.com` before the Worker runs.

Hostname to keep clear of Access:

- `g.gearservicevanguard.com`

That custom domain is the only door. The `rt-feedback.*.workers.dev` address answered the
same calls until `workers_dev = false` in `relay/wrangler.toml` closed it.

## Fix (Cloudflare dashboard)

1. Open **Zero Trust** → **Access** → **Applications**.
2. Open each application that lists the hostnames above (or a wildcard that includes them).
3. Either **delete** those applications, or add a **Bypass** policy:
   - **Action:** Bypass
   - **Include:** Everyone
   - **Path** (optional): leave empty for all paths, or `/` and `/auth/*` etc. as needed
4. Save. Wait ~1 minute.

## Verify

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X OPTIONS \
  'https://g.gearservicevanguard.com/' \
  -H 'Origin: https://regiontype.com' \
  -H 'Access-Control-Request-Method: POST'
```

Expect **204**, not 403 HTML.

```bash
curl -sS 'https://g.gearservicevanguard.com/where' \
  -H 'Origin: https://regiontype.com'
```

Expect JSON `{"ok":true,...}`, not a 302 to Access login.

## Deploy route (keep custom domain in wrangler)

Local `relay/wrangler.toml` includes `g.gearservicevanguard.com`. After changing Access, redeploy:

```bash
cd relay && npx wrangler deploy
```

Site `FEEDBACK_URL` in `app.js` should be `https://g.gearservicevanguard.com`.

## Split workers

Each path group deploys on its own (`entry.mjs` `OWN` lists the paths). The zone routes in
`wrangler.<name>.toml` ship commented out: put the secrets first, then uncomment and deploy.

```bash
cd relay
npx wrangler secret put SESSION_KEY -c wrangler.auth.toml   # see each toml for its secrets
npx wrangler deploy -c wrangler.auth.toml                   # auth · board · community · bot · online
```

Zone-route Workers run before the Custom Domain Worker, so `rt-feedback` stays the fallback.
