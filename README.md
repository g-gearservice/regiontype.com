[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [한국어](README.ko.md)

# regiontype.com

A typing drill for place names. v0.3.9 (`VER=0.97`) — first-level admin courses by country, UI in 26 languages.

## What's new in 0.97

- The about page follows the UI language (`about.{lang}.html`)
- The settings language list fades at the top and bottom with a gradient blur
- Commit messages are English. The README ships in English, Chinese, Japanese, and Hindi

## What's new in 0.3.9

- Settings let you pick a country and a language. Leave them empty and the defaults come from the browser language and the relay country code (`GET /where`)
- First-level admin courses for 46 countries. Names are Natural Earth local names. One-line blurbs are left empty
- Korea keeps the Seoul course. Japan is prefectures. The United States is the 50 states plus Washington, DC
- Names that contain a space confirm with Enter, not Space

## What's new in 0.3.8

- Icons come from `assets/*.svg` masks instead of Google Fonts. No outbound font request, so a slow or blocked network does not leave empty icon boxes
- An about page (`about.html`) is linked from the title menu, so search can reach what a district and an administrative dong are, and why we type them
- Open Graph, Twitter Card, and structured data for link previews
- A global leaderboard on the result screen. Runs share a board only when course and time limit match
- Region cards have a **Rank** tab next to the course picker, so you can see where people cluster before you start

## What's new in 0.3.7

- Light theme: hits are dark orange, misses are red
- The back icon is a local SVG so it still shows without a webfont
- Shorter mobile copy

## What's new in 0.3.6

- A typo no longer stops the run. The row grows with what you typed, so the screen mirrors the input
- Interpuncts in names become commas — `종로1·2·3·4가` cannot be typed on a keyboard
- Hit and miss colors swapped, because they used to look too alike

Carried from earlier patches: the logo-dot feedback dialog, the settings grid toggle, theme favicons, the title/settings pixel map and pointer near-field, the build number, the play-screen prev/now/next queue and blur, Seoul's 25-district dong courses, `/mimi/` as a dev preview.

## Version

In `0.3.7`, `0.3` is the version and `7` is the patch. The patch digit comes from `app.js` `VER`. `VER` is a cache buster, so it goes up by 1 on every change (`0.69 → 0.70`). The **first decimal digit** is the patch: `VER=0.70` means `v0.3.7`.

The changelog lists **only this patch**. Stacking older bullets hides what actually landed.

Never lower a `?v=` query. If you do, it collides with an old number and the cache never turns over.

## Run

    python3 -m http.server 3000

`http://localhost:3000` — static files only, so any static host will do.
`?rt=1` runs the matching-engine self-check in the console.

## Files

    index.html               screens (title / regions / settings / play / result)
    about.html / about.*.html  about page — one file per UI language; inherits style.css tokens, does not load app.js
    style.css
    app.js                   matching engine + game loop + result card
    design/                  play/queue design (`design.pen`)
    relay/                   Cloudflare Worker — feedback → GitHub issues, leaderboard → D1
    mimi/                    Mini Motorways-style board (dev only)
    data/*.course.json       items, aliases, one-line blurbs (mode: sequence)
    data/*.geom.json         bitmap dot grid
    data/world.json          country list (build_world.py)
    data/i18n.json           UI copy (26 languages). Hand-edited
    data/*-pixels.json       title pixel map
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      all 25-district dong courses at once
    tools/build_pixels.py    GeoJSON → pixel grid
    tools/build_world.py     Natural Earth admin-1 → country courses
    tools/build_size.py      course sizes → relay/size.mjs

## Refreshing map data

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

Dong courses for the 25 districts are built in one pass. Grid density follows filled-dot count per district — a fixed width explodes the dot count on tall districts.

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

The Gangseo-gu course keeps a hand-written blurb (`KEEP` in build_dong.py). Other blurbs stay empty — we will not invent 400 of them.

## Title pixel map

Provincial borders are rasterized and Seoul is a different color, so the v1 roadmap (start in Seoul, widen to the country) is visible in one picture.

    curl -sL -o kr.json https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json
    python3 tools/build_pixels.py kr.json data/korea-pixels.json 34

The last argument is the column count (trimming empty margins makes the result narrower). One-cell islands with no neighbors, such as Ulleungdo and Dokdo, are dropped as noise.

## Country courses

First-level admin units outside Seoul come from Natural Earth 10m. We do not invent one-line blurbs.

    curl -sL -o /tmp/ne-admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
    curl -sL -o /tmp/ne-admin0.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
    python3 tools/build_world.py /tmp/ne-admin1.geojson /tmp/ne-admin0.geojson data/
    python3 tools/build_size.py

`relay/size.mjs` is the size table. When courses grow, the relay reads that file, so run `node relay/test.mjs` after a rebuild. `GET /where` lives on the deployed relay.

## Matching

Every keystroke is checked, including while Hangul is still composing. An abbreviation such as "강남" commits **only when it can lead to exactly one unconquered item**.

- `강남` → Gangnam-gu, immediately
- `중` → not while both Jung-gu and Jungnang-gu remain (`중구` must be typed out)
- A one-character stem is not an abbreviation
- Leading typos are skipped by a suffix check (`ㅋㅋ강남` → Gangnam-gu)

A miss commits **when composition has ended and no suffix is still a prefix of an unconquered name** (`강난` → miss at once). Intercepting Space on `keydown` breaks IME commit, so we do not do that. On courses whose names contain spaces, Space is a character, so only those courses confirm with Enter. There is no penalty; the combo just breaks.

## Feedback

The yellow dot on the title logo is the feedback button. Hover or tab to it and it grows a flag; click opens a modal `<dialog>`. There is no extra screen — one dot next to the logo is the whole "you can talk to us here".

The destination is a single constant at the top of `app.js`.

    const FEEDBACK_URL = ''       // if set, POST JSON here
    const FEEDBACK_REPO = 'pistolinkr/regiontype.com'

The body is

    { kind, body, v, href, ua }

`kind` is bug / idea / place-name error. Text alone is not enough to reproduce, so we send version, URL, and user agent. We do not collect a reply address — issues are public, so a typed email would leak, and replies belong on the issue.

If `FEEDBACK_URL` is empty, we open a prefilled issue on `FEEDBACK_REPO` in a new tab. That path needs no infra, but it asks the reporter for a GitHub account. If that is unwanted, stand up the relay below.

### Relay (`relay/`)

GitHub issues need a token, and a token on a static site is stolen immediately. A Cloudflare Worker holds the token and does one job: turn the JSON into an issue and POST it to the GitHub API.

    cd relay
    wrangler login
    wrangler secret put GH_TOKEN     # fine-grained token with Issues write on that repo
    wrangler deploy

Put the URL in `FEEDBACK_URL`. The token never leaves the Worker.

    node relay/test.mjs      checks that one issue and one score row are filtered correctly

It is an open URL that creates issues, so spam will come. There is a per-IP window, and metadata sits in a code block so foreign input cannot break the issue template. If it still leaks, put Turnstile in front — the token can only open issues, so the worst case is emptying a README-only repo.

The window is counted with a `ratelimit` binding. **It used to use the Cache API, which `workers.dev` silently ignores** — `put` is dropped and `match` is always empty, so the window never actually ran. A wall that looks closed and is open is worse than no wall. If the binding is missing, the door returns 503 instead of 200.

We never accept a reply address in any shape. A missing field in the UI is not enough — if the relay reads that field, anyone can plant someone else's email on a public issue.

### Leaderboard (`relay/` + D1)

The same Worker adds two more paths. A board is **course plus time limit**. One person, one row on that board — mixing a 5-minute run with a 1-minute run in one row makes the score meaningless.

    POST /score    {c, t, who, name, score, hits, tries} → {rank, top}
    GET  /top      ?c=course&t=seconds → {top}
    POST /dist     {c, t} → {bins, bucket, cap, total, score, over}
    POST /forget   {} → {gone}      drop all of my rows

    POST /auth/new  start passkey create → challenge
    POST /auth/reg  finish passkey create → session token
    POST /auth/go   start login → challenge
    POST /auth/log  finish login → session token
    GET  /auth/me   who is this

    cd relay
    wrangler d1 create rt-board                              # paste the id into wrangler.toml
    wrangler d1 execute rt-board --remote --file schema.sql
    wrangler deploy

If `database_id` is empty or the deploy is not live, the relay folds with 503 and the site hides the whole leaderboard section. The result screen still works.

The owner of a row is `who`, not the name — a random id the browser mints once. It is not shown and not returned. If the name were the owner, anyone could park a high score under someone else's name and lock them out. The relay marks "me"; names are trimmed on the server, so matching on the client name would drift.

Scoring is in the browser. The relay only checks that the numbers fit. The cap is **course size times time limit** — you cannot visit more places than the course has, and even a fast hit takes 0.5s. Without the size table (`SIZE`), a 25-place course could claim 500 visits and 250,000 points and hold first forever. Unknown course ids are rejected.

That table is copied from `data/*.course.json` and will go stale. `relay/test.mjs` diffs it against the source every run.

Honest scores and well-built lies still look the same here. **The board is a hall of fame, not an audit log.** If we have to tell them apart, scoring has to move to the server.

### Login

**Only required to post to the leaderboard.** The game runs without it. The distribution still shows — only your seat is missing.

**No passwords.** A static site that handles passwords inherits hashing, reset, and breach response, which this repo will not own. A passkey never leaves the device, so **there is nothing of ours to steal** — the server keeps a public key.

    wrangler secret put SESSION_KEY   # any long random string. rotating it kills every session

There is no email link yet. Cloudflare Email Routing can receive, not send, so a sender (Resend, Postmark, …) and an API key have to exist first.

Passkey verify has **no extra dependency**. Registration gives SPKI from `getPublicKey()`, so the server does not need a CBOR parser. Signatures are checked with WebCrypto, and the authenticator's DER signature is unfolded to raw 64 bytes (`derToRaw`).

`attestation` is `none`. We skip vendor certs and keep one claim: **this challenge, this origin, this device answered**. That is enough for a leaderboard.

The session is a signed stateless token on `Authorization: Bearer`. No cookie, because the relay sits on `workers.dev` away from the site — third-party cookies are increasingly blocked. A header also means no CSRF. Move the relay to `api.regiontype.com` and HttpOnly cookies become possible.

**The row owner is read from the token.** The body is ignored — the old record-code path let anyone who knew the code post under that name.

Stateless sessions cannot be revoked one by one. In a pinch, rotate `SESSION_KEY` and drop them all.

### Rank tab

Opened from the region card. It is a pre-run screen, so its job differs from the result-screen board — that one is the run you just typed; this one is **who you will face**. Arrows change the course; the time limit follows settings.

The distribution is drawn out to the highest score that board can produce. If you only draw as far as the crowd, the x-axis changes per board and boards cannot be compared. Rank and top-% are server counts only — writing a bar you eyeballed as a number would disagree with the real rank.

`/dist` is a read, but it is POST. `who` is a credential; putting it in the query string leaves it in proxy and access logs.

The name is the only other-person input that appears in the UI. We clip at 12 characters, strip invisible controls, and render with `textContent` only. The browser trims **with the same ruler as the relay** — a name that passes only here gets stored, then every later post is 400, the rank pane folds, and the rename form disappears with it.

We say the name is public in the place you type it (“this name goes on a public leaderboard”), and settings has **remove my rows**. You can fix a bad name without beating your own high score.
IP is used only for the rate-limit window and is not stored. D1 keeps course, time, `who`, name, and score.

## Accessibility

- Full keyboard use. Toggles and steppers have `aria-label`
- Conquered state is not color alone — border and place-name label as well (PRD 8.4)
- Remaining time is both a gauge and a **number**, so we do not rely on contrast alone
- `prefers-reduced-motion` is honored; settings can also kill animation
- The mobile notice keys off `pointer:coarse`, not viewport width — a desktop user at 200% zoom is not thrown out

## Still open for v1

Legal-dong / same-name mapping, location mode, server-side ranking, a course editor. Only Gangseo-gu has a one-line blurb so far.
