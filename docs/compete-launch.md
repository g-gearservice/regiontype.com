# Competitive (rt-compete) launch checklist

> Phase 6 release (v0.10.3xx). Every step that touches production is done by a person, or by Claude only after explicit permission.
> 출시 순서대로 적었다. 위에서부터 하나씩 지운다.

## Before deploy

- [ ] Durable Objects paid plan is on (the match DO uses SQLite storage).
- [ ] D1 migration, once, **before** deploying rt-auth with the new account-erase list:
      `wrangler d1 execute rt-board --remote --file relay/migrate-season.sql`
- [ ] rt-compete secrets (`wrangler secret put X -c relay/wrangler.compete.toml`):
  - [ ] `SESSION_KEY` — same value as the other workers
  - [ ] `ADMIN_IDS` — account ids allowed to use `compete/review.html` (comma-separated)
- [ ] Uncomment the zone route in `relay/wrangler.compete.toml`.
- [ ] Key-log retention wording (30 days / 90 days after review) is in the privacy text.

## Season rows

Ranked queue is closed until a `seasons` row covers "now". Times are ms since epoch (UTC).

- [ ] **Preseason — 2 weeks from launch**, `reset = 'full'`:
      ```sql
      insert into seasons (id, name, kind, starts_at, ends_at, reset)
      values (1, '프리시즌', 'pre', <launch ms>, <launch ms + 14 × 86400000>, 'full');
      ```
- [ ] Before preseason ends: report the real display-rating distribution and re-set `TIERS` in `relay/compete-config.mjs` (decided 2026-10-04: keep current bounds until then).
- [ ] **Season 1 — 3 months**, start date chosen by the owner after Phase 7. `reset` is `'full'` or `'soft'` (owner decides):
      ```sql
      insert into seasons (id, name, kind, starts_at, ends_at, reset)
      values (2, '시즌 1', 'season', <start ms>, <start ms + 3 months>, '<full|soft>');
      ```
- [ ] Old `ladder` (lp) is shown read-only as season 0.

## Deploy

- [ ] `wrangler deploy -c relay/wrangler.compete.toml` (ask first).
- [ ] Old `/match/*` answers 410 for one release.
- [ ] Next release: run `migrate-drop-duel.sql` and remove the 410 stubs.

## After deploy

- [ ] One ranked match on production: rating row written, `match.rating` received, lobby lock released.
- [ ] Next day 04:17 KST: daily cron ran (key logs pruned, `bot_calib` rows have `mult`).
