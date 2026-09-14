# Cloudflare Access and the public relay

The feedback relay must be **anonymous** (no login). If Zero Trust protects these hostnames, browsers fail with **OPTIONS 403** or redirect to `cloudflareaccess.com` before the Worker runs.

Protected hostnames today (remove or Bypass):

- `rt-feedback.g-gearservice.workers.dev`
- `feedback.regiontype.com`

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
  'https://feedback.regiontype.com/' \
  -H 'Origin: https://regiontype.com' \
  -H 'Access-Control-Request-Method: POST'
```

Expect **204**, not 403 HTML.

```bash
curl -sS 'https://feedback.regiontype.com/where' \
  -H 'Origin: https://regiontype.com'
```

Expect JSON `{"ok":true,...}`, not a 302 to Access login.

## Deploy route (keep custom domain in wrangler)

Local `relay/wrangler.toml` includes `feedback.regiontype.com`. After changing Access, redeploy:

```bash
cd relay && npx wrangler deploy
```

Site `FEEDBACK_URL` in `app.js` should be `https://feedback.regiontype.com`.
