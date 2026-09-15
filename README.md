# regiontype.com

[English](#english) · [中文](#中文) · [日本語](#日本語) · [हिन्दी](#हिन्दी)

---

<a id="english"></a>

# English

A typing drill for place names. v0.4.145 (`VER=1.45`) — first-level admin courses by country, UI in 26 languages.

## What's new in 0.4.145

- The tilted atlas bitmap on the Places screen is gone. Courses are grid-cell buttons on the same background grid as the title screen, and South Korea is laid out as a map-shaped block
- Click a cell to select it. Double-click (or press Enter on the selected cell) to expand a province into its districts on the same screen: the districts spread out one by one, the grid tightens, and the other provinces shrink and scatter into the free space. Esc folds it back
- Motion is a critically damped spring and can be interrupted mid-flight. With reduced motion, cells jump into place and only fade
- District cells are as large as the Start cell whenever the block fits the screen, and shrink a step only when it does not
- In Korean, pushed-aside provinces use short names (서울, 경기, 충북) and district cells drop 시·군 (파주, 고양일산서구). Screen readers still read the full name
- Outside the Korean UI, Korean place names show in romanization from `data/kr-names.json` (`tools/build_names.py`). The names you type stay Korean

## What's new in 0.4.0

- The title screen sits on the background grid. Logo and menu are one block, and the About / Settings / Start row is laid on the grid lines
- The title pixel map and its pointer near-field are gone
- A GitHub link with the star count sits in the title corner. The count comes from the public API, is cached for half a day, and sends no referrer
- The settings shell snaps both its top and bottom edge to the grid, and the bottom blur band is pinned to the viewport instead of to the panel
- Desktop zoom past 125% no longer folds the settings picker into one column
- About pages in Arabic, Thai, and Ukrainian
- `도` counts as a name suffix, so 경기도 confirms on 경기 and 울릉도 on 울릉
- Korea-wide data is generated but not served yet: 17 provinces (`kr-admin`) with their 250 districts (`tools/build_kr.py`), and board tiles that share one projection (`tools/build_board.py`)
- When GitHub refuses an issue, the relay logs the status and the remaining rate limit, never the body

## What's new in 0.97

- The about page follows the UI language (`about.{lang}.html`)
- The settings language list fades at the top and bottom with a gradient blur
- Commit messages are English. This README holds English, Chinese, Japanese, and Hindi in one file

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

A release is `vA.B.C`.

- **A** — a large change: the structure is redrawn, or a new mode appears. Chosen by hand
- **B** — a small change: an ordinary addition or fix, visible to a player but not on the scale of A. Chosen by hand
- **C** — `VER` from `app.js` without the dot (`VER = '1.45'` → `v0.4.145`). Never chosen, only copied

Raising A resets B to zero. C always follows `VER`, so it never resets.

`VER` — the number in parentheses on the settings version line — goes up by `0.01` on every change (`1.45 → 1.46`). The settings line reads C from it.

Each release gets its own branch, `static-A.B.C` (`static-0.4.145`).

This README is written in English only.

The changelog lists **only this release**. Stacking older bullets hides what actually landed.

Never lower a `?v=` query. If you do, it collides with an old number and the cache never turns over.

## Run

    python3 -m http.server 3000

`http://localhost:3000` — static files only, so any static host will do.
`?rt=1` runs the matching-engine self-check in the console.

## Files

    index.html               screens (title / regions / settings / play / result)
    about/                    about page — one file per UI language (about/index.html is Korean); inherits style.css tokens, does not load app.js
    style.css
    app.js                   matching engine + game loop + result card
    design/                  play/queue design (`design.pen`)
    relay/                   Cloudflare Worker — feedback → GitHub issues, leaderboard → D1
    mimi/                    Mini Motorways-style board (dev only)
    data/*.course.json       items, aliases, one-line blurbs (mode: sequence)
    data/*.geom.json         bitmap dot grid
    data/world.json          country list (build_world.py)
    data/i18n.json           UI copy (26 languages). Hand-edited
    data/kr-tree.json        Korea layer tree (build_kr.py). Not served yet
    data/kr-names.json       romanized Korean place names shown outside the Korean UI (build_names.py)
    data/board/              board tiles on one shared projection (build_board.py). Not served yet
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      all 25-district dong courses at once
    tools/build_kr.py        provinces and their districts in one run
    tools/build_board.py     one sheet, all of South Korea, tiles by layer
    tools/build_world.py     Natural Earth admin-1 → country courses
    tools/build_size.py      course sizes → relay/size.mjs
    tools/build_names.py     southkorea-maps name_eng → kr-names.json

## Refreshing map data

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

Dong courses for the 25 districts are built in one pass. Grid density follows filled-dot count per district — a fixed width explodes the dot count on tall districts.

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

The Gangseo-gu course keeps a hand-written blurb (`KEEP` in build_dong.py). Other blurbs stay empty — we will not invent 400 of them.

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
    const FEEDBACK_REPO = 'g-gearservice/regiontype.com'

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

**Do not put Cloudflare Access in front of this Worker.** If `rt-feedback.*.workers.dev` is behind Access, browsers get `OPTIONS` 403 on preflight and feedback never reaches your code. Remove the hostname from Zero Trust, or add a public Bypass policy for `/`. Issue labels on GitHub must exist in English (`bug`, `enhancement`) — the relay maps feedback kinds to those names.

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

---

# 中文

用地名做打字练习。v0.4.0（`VER=1.32`）——按国家提供一级行政区课程，界面 26 种语言。

## 0.4.0 更新

- 标题画面坐在背景网格上。标志和菜单是一整块，介绍 / 设置 / 开始一行贴着网格线
- 去掉标题像素地图和指针近场
- 标题一角放了 GitHub 链接和星标数。数字取自公开 API，缓存半天，不发送来源地址
- 设置面板的上下两条边都对齐网格线，底部的模糊带改钉在视口上，不再跟着面板
- 桌面端放大超过 125% 时，设置里的选择面板不再挤成一列
- 新增阿拉伯语、泰语、乌克兰语的介绍页
- `도` 算作地名后缀，所以 경기도 打 경기、울릉도 打 울릉 就能确认
- 全国数据已生成但还没上线：17 个道（`kr-admin`）及其 250 个市郡区（`tools/build_kr.py`），以及共用同一投影的大地瓦片（`tools/build_board.py`）
- GitHub 拒收反馈时，中继器只记状态码和剩余调用量，不记正文

## 0.97 更新

- 介绍页跟随界面语言打开 `about.{lang}.html`
- 设置里的语言列表上下用渐变模糊盖住被裁切的一行
- 提交说明用英语。本 README 一份文件里写英语、中文、日语、印地语

## 0.3.9 更新

- 设置里可选国家和语言。留空则用浏览器语言和中继器的国家代码（`GET /where`）
- 46 个国家的一级行政区课程。地名来自 Natural Earth 的本地名称。一行介绍留空
- 韩国保留首尔课程。日本是都道府县。美国是 50 州加华盛顿哥伦比亚特区
- 名称里有空格时用 Enter 确认，不用空格键

## 0.3.8 更新

- 图标改从 `assets/*.svg` 遮罩绘制，不再请求 Google Fonts。外网慢或被拦时图标也不会变成空框
- 标题菜单链到介绍页（`about.html`），搜索也能读到什么是自治区、什么是行政洞、为什么靠打字记
- 加入 OG、Twitter Card 和结构化数据，供链接预览
- 结果页有全球排行榜。课程和时限相同的对局才分在同一榜
- 地区卡片在选课旁边加了 **排名** 页，开打前就能看到别人挤在哪、自己会站哪

## 0.3.7 更新

- 浅色主题：打对的字是深橙，打错是红
- 返回图标改为本地 SVG，没有网页字体也能显示
- 缩短移动端提示

## 0.3.6 更新

- 打错也不会停。格子跟着已输入的字变长，屏幕如实映出输入
- 地名中间的间隔号改成逗号——键盘打不出 `종로1·2·3·4가`
- 对错颜色对调，因为原先太像、一眼分不清

更早补丁里留下的：标志旁圆点的反馈窗、设置里的网格开关、按系统主题的 favicon、标题与设置共用的像素地图和指针近场、内部版本号、对局下方的上一/当前/下一队列和模糊、首尔 25 区行政洞课程、开发用预览 `/mimi/`。

## 版本

版本名是 `vA.B.C` 三位。每一位由改动的性质决定，不是从 `VER` 倒推出来的。

- **A** —— 大改：结构重排，或者新增一种模式
- **B** —— 小改：平常的功能增删或修复，用户看得见，但没到 A 那么大
- **C** —— 安全、策略、规则：用户看不见的部分（`relay/` 的令牌处理、限流、CLAUDE.md 和提交规范）

抬高某一位，它下面的位都归零。

`app.js` 里的 `VER`（设置页版本行括号里的数字）跟这三位无关，是破缓存用的内部构建计数，每改一次加 `0.01`（`0.69 → 0.70`）。

更新列表只写 **这一版改了什么**。把旧条目一直堆下去，就看不出这次新来了什么。

`?v=` 查询参数不要往小改。改小会和旧号撞车，缓存就不会换。

## 运行

    python3 -m http.server 3000

`http://localhost:3000` —— 只有静态文件，任何静态托管都能上。
加上 `?rt=1`，判定引擎的自检会在控制台跑。

## 文件

    index.html               画面（标题 / 地区 / 设置 / 对局 / 结果）
    about.html / about.*.html  介绍 —— 每种界面语言一页；只继承 style.css 变量，不加载 app.js
    style.css
    app.js                   判定引擎 + 游戏循环 + 结果卡
    design/                  对局与队列设计（`design.pen`）
    relay/                   Cloudflare Worker —— 反馈 → GitHub Issue，排行榜 → D1
    mimi/                    Mini Motorways 风格棋盘（仅开发）
    data/*.course.json       条目、别名、一行介绍（mode: sequence）
    data/*.geom.json         点阵网格
    data/world.json          国家列表（build_world.py）
    data/i18n.json           界面文案（26 种语言）。手写
    data/kr-tree.json        韩国层级树（build_kr.py）。尚未上线
    data/kr-names.json       非韩语界面显示的韩国地名罗马字（build_names.py）
    data/board/              共用一套投影的大地瓦片（build_board.py）。尚未上线
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      一次生成 25 区行政洞课程
    tools/build_kr.py        一次生成道和道内市郡区的课程
    tools/build_board.py     一张大地铺满南韩，按层出瓦片
    tools/build_world.py     Natural Earth admin-1 → 国家课程
    tools/build_size.py      课程容量 → relay/size.mjs
    tools/build_names.py     southkorea-maps name_eng → kr-names.json

## 更新地图数据

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

25 个自治区的行政洞课程一次打出。网格按填满的点数分区来定——宽度写死的话，瘦高的区点数会爆。

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

江西区课程的一行介绍是手写的，所以不覆盖（build_dong.py 的 `KEEP`）。其余介绍留空——四百条编不出来，留给人填。

## 国家课程

首尔以外的一级行政区来自 Natural Earth 10m。一行介绍不编。

    curl -sL -o /tmp/ne-admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
    curl -sL -o /tmp/ne-admin0.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
    python3 tools/build_world.py /tmp/ne-admin1.geojson /tmp/ne-admin0.geojson data/
    python3 tools/build_size.py

`relay/size.mjs` 是容量表。课程一增加，中继器也读这份文件，打完后用 `node relay/test.mjs` 对一下。`GET /where` 在已部署的中继器上。

## 判定

每次输入都检查（包括汉字拼写尚未确定时）。简称（如「강남」）**只有在还能对上的未占领项只剩它自己时**才确定。

- `강남` → 立即确定江南区
- `중` → 中区和中浪区都还在时不确定（必须打完 `중구`）
- 词干只有一个字时不当成简称
- 前面的错字用后缀检查滤掉（`ㅋㅋ강남` → 江南区）

打错是在 **拼写结束、且任何后缀都不再是未占领名的前缀时** 自动确定（`강난` → 立即判错）。在 `keydown` 上拦截空格会弄坏 IME 上屏，所以不那么做。名称里有空格的课程里，空格是字，这时才用 Enter 确认。没有罚分，只断连击。

## 反馈

标题标志上的黄点就是反馈按钮。悬停或用 Tab 移过去，点会变大并出现旗子，点开是模态 `<dialog>`。不再另做一屏——标志旁边一颗点就表示「可以在这儿说话」。

去向由 `app.js` 顶部一个常量决定。

    const FEEDBACK_URL = ''       // 填了就 POST JSON 到这里
    const FEEDBACK_REPO = 'g-gearservice/regiontype.com'

正文是

    { kind, body, v, href, ua }

`kind` 是缺陷 / 建议 / 地名信息错误。只收正文无法复现，所以带上版本、地址、浏览器。不收集回复邮箱——Issue 是公开的，一填就会把别人的邮箱亮出去，回复写在 Issue 里即可。

`FEEDBACK_URL` 为空时，会新开标签打开 `FEEDBACK_REPO` 里填好的 Issue 草稿。这条路不需要基础设施，但要求反馈人有 GitHub 账号。不愿意的话就搭下面的中继器。

### 中继器（`relay/`）

GitHub Issue 没有令牌建不成，静态站点里放令牌等于直接被拿走。所以中间放一张拿着令牌的 Cloudflare Worker，只做一件事：把 JSON 做成 Issue，交给 GitHub API。

    cd relay
    wrangler login
    wrangler secret put GH_TOKEN     # 只对该仓库 Issues 有写权限的细粒度令牌
    wrangler deploy

把得到的地址填进 `FEEDBACK_URL`。令牌只在 Worker 里，不会下到浏览器。

    node relay/test.mjs      检查一篇 Issue 和一行分数是否被正确过滤

这是能建 Issue 的公开地址，迟早会有垃圾。按 IP 开了窗口，元数据放进代码块，别人送来的值不能搅乱 Issue 格式。真要漏，就在前面加 Turnstile——令牌只能动该仓库的 Issue，最坏也不过清空一个只有 README 的仓库。

窗口用 `ratelimit` 绑定来数。**以前用 Cache API 数，在 `workers.dev` 上会被整段忽略**——`put` 丢掉，`match` 永远空手，所以窗看起来有、实际从未开过。假装关上的墙比没有墙更糟。没有绑定时返回 503 而不是 200。

回复邮箱无论什么形状都不收。界面上没有输入框还不够——中继器只要读那个字段，谁都能把别人的邮箱钉到公开 Issue 上。

### 排行榜（`relay/` + D1）

同一中继器再加两条路径。一局是 **课程加时限**，其中一人一行——把 5 分钟局和 1 分钟局放同一行，分数就没意义。

    POST /score    {c, t, who, name, score, hits, tries} → {rank, top}
    GET  /top      ?c=课程&t=秒 → {top}
    POST /dist     {c, t} → {bins, bucket, cap, total, score, over}
    POST /forget   {} → {gone}      撤掉我的全部行

    POST /auth/new  开始创建通行密钥 → 挑战
    POST /auth/reg  结束创建 → 会话令牌
    POST /auth/go   开始登录 → 挑战
    POST /auth/log  结束登录 → 会话令牌
    GET  /auth/me   现在是谁

    cd relay
    wrangler d1 create rt-board                              # 把打出的 id 写进 wrangler.toml
    wrangler d1 execute rt-board --remote --file schema.sql
    wrangler deploy

`database_id` 为空或尚未部署时，中继器以 503 收起，站点整段隐藏排行榜。结果页照常。

行的主人是 `who` 不是名字——浏览器生成一次的随机数，不显示、也不出现在响应里。用名字当主人的话，可以在别人名下堆高分，让对方永远无法再提交。自己的行由中继器用 `me` 标出；名字在服务器上修剪，客户端用名字去对会错位。

计分在浏览器。中继器只看前后是否说得通。上限由 **课程容量和时限** 一起定——不能比课程里的地方还多，再快打一处也要 0.5 秒。没有容量表（`SIZE`），25 处的课可以谎称打了 500 处、25 万分，永远占第一。表里没有的课程名直接拒收。

那张表是从 `data/*.course.json` 抄来的，迟早会旧。`relay/test.mjs` 每次都和源文件对，对不上就报。

诚实的分和编得好的假分在这里分不出。**排行榜是荣誉堂，不是判定记录。** 真要分，只能把计分搬到服务器。

### 登录

**只有上榜才需要。** 游戏本身不用登录。分布图照样能看——只是不标你的位置。

**不收密码。** 静态站点一旦管密码，就要自己扛哈希、重置、泄露，这不是本仓库该养的一层。通行密钥不离开设备，所以 **我们没有可被偷的秘密**——服务器只留公钥。

    wrangler secret put SESSION_KEY   # 任意长随机串。一换，所有会话都断

还没有邮件链接。Cloudflare Email Routing 只能收不能发，要先有发信方（Resend、Postmark 等）和 API 密钥。

通行密钥校验 **不额外加依赖**。注册时浏览器的 `getPublicKey()` 给出 SPKI，服务器不必上 CBOR 解析器。签名用 WebCrypto 验，认证器给的 DER 签名展开成原始 64 字节（`derToRaw`）。

`attestation` 是 `none`。不收设备厂商证书，只守一件事：**是这个挑战、这个来源、这台设备答的**。排行榜够用。

会话是签过名的无状态令牌，用 `Authorization: Bearer` 带。不用 Cookie，因为中继器和站点不在一处（`workers.dev`）——站外 Cookie 越来越被拦。用头也没有 CSRF。把中继器迁到 `api.regiontype.com` 就可以改用 HttpOnly Cookie。

**行的主人从令牌读。** 不看正文里带来的值——旧的记录码谁知道码就能用那个名字提交。

无状态就不能逐条作废会话。急了就换 `SESSION_KEY`，全部断开。

### 排名页

从地区卡片的页签打开。这是开打前的画面，和结果页排行榜目的不同——那里是刚打完的这一局，这里是 **对手**。方向键换课程，时限跟设置。

分布画到该局可能出现的最高分。只画到人堆处，横轴每局都变，就没法互相比。名次和前百分之几只写服务器数过的值——把目测的柱子位置写成数字，看见的和实际会对不上。

`/dist` 是读，却用 POST。`who` 是凭证，放进地址栏会进中转和访问日志。

名字是唯一会出现在别人面前的他人输入。截到 12 字，去掉看不见的控制/格式/反向字符，画面只用 `textContent`。浏览器也用 **和中继器同一把尺** 修剪——只在这边通过的名字一存，后面每一局都 400，排名页收起，连改名的表一起消失，没法挽回。

在填写处写明名字会公开（「这个名字会出现在所有人都能看到的排行榜上」），设置里有 **从排行榜撤下我的记录**。不用打破自己的最高分也能改名字。
IP 只用于限速窗口，不存储。D1 里只留课程、时间、`who`、名字、分数。

## 无障碍

- 全部功能可用键盘。开关和步进按钮有 `aria-label`
- 占领状态不只靠颜色——还有边框和地名标签（PRD 8.4）
- 剩余时间同时用进度条和 **数字**，不单靠对比度
- 尊重 `prefers-reduced-motion`，设置里也可以单独关掉动画
- 移动端提示按 `pointer:coarse` 分，不按屏宽——桌面 200% 放大的人不会被赶出去

## v1 还缺什么

法定洞与同名对应、位置模式、服务端排名、课程编辑器。行政洞一行介绍目前只填了江西区。

---

# 日本語

地名を打って覚えるタイピング練習。v0.4.0（`VER=1.32`）——国ごとの第一級行政区画コース、画面は 26 言語。

## 0.4.0 の変更

- タイトル画面が背景のグリッドに乗る。ロゴとメニューはひと塊で、紹介 / 設定 / 開始の一行はグリッド線の上に置かれる
- タイトルのピクセルマップとポインタ近傍をなくした
- タイトルの隅に GitHub リンクとスター数。数は公開 API から取り、半日キャッシュし、リファラは送らない
- 設定シェルは上辺と下辺の両方をグリッド線に合わせる。下のブラー帯はパネルではなくビューポートに固定
- デスクトップで 125% を超えて拡大しても、設定の選択面が一列に折り畳まれない
- アラビア語・タイ語・ウクライナ語の紹介ページ
- `도` を地名の接尾として扱う。경기도 は 경기 で、울릉도 は 울릉 で確定する
- 韓国全土のデータは生成済みだがまだ配信しない: 17 の道（`kr-admin`）とその 250 市郡区（`tools/build_kr.py`）、投影を共有する大地タイル（`tools/build_board.py`）
- GitHub が Issue を受け取らなかったとき、中継器はステータスと残り呼び出し量だけを記録する。本文は残さない

## 0.97 の変更

- 紹介ページは UI 言語に合わせて `about.{lang}.html` を開く
- 設定の言語リストの上下をグラデーションブラーでぼかし、切れた行を「続きがある」と読ませる
- コミットメッセージは英語。この README 一枚に英語・中国語・日本語・ヒンディー語を書く

## 0.3.9 の変更

- 設定で国と言語を選ぶ。空ならブラウザ言語と中継の国コード（`GET /where`）が初期値
- 46 か国の第一級行政区画コース。地名は Natural Earth の現地名。一行紹介は空
- 韓国はソウルコースを残す。日本は都道府県。米国は 50 州とワシントン DC
- 名前に空白があるときは Space ではなく Enter で確定する

## 0.3.8 の変更

- アイコンを Google Fonts から外し `assets/*.svg` マスクで描く。外向きのフォント要求が消え、遅い・遮断された網でも空欄にならない
- 紹介ページ（`about.html`）をタイトルメニューからつなぐ。自治区と行政洞が何か、なぜ打って覚えるかを検索が届く場所に置く
- リンクプレビュー用の OG・Twitter Card・構造化データ
- 結果画面に全域ランキング。コースと制限時間が同じ対局だけを同じ表で競う
- 地域カードに **順位** タブ。打つ前に、人がどこに集まって自分がどこに立つかを見る

## 0.3.7 の変更

- ライトテーマでは当たりを暗いオレンジ、ミスを赤で分ける
- 戻るアイコンをローカル SVG にし、ウェブフォントなしでも見えるようにする
- モバイル案内を短くする

## 0.3.6 の変更

- 打ち間違えても止まらない。打った字のぶんマスが伸び、画面が入力をそのまま映す
- 地名の中黒をカンマにする——`종로1·2·3·4가` はキーボードで打てない
- 当たりとミスの色を入れ替える。似すぎて一目で分かれなかったため

以前のパッチから引き継いだもの: ロゴ横ドットのフィードバック、設定のグリッド切替、端末テーマのファビコン、タイトルと設定が共有するピクセルマップとポインタ近傍、ビルド番号、プレイ下の前・今・次キューとブラー、ソウル 25 区の行政洞コース、開発用プレビュー `/mimi/`。

## バージョン

リリース名は `vA.B.C` の三桁。各桁は `VER` から逆算する値ではなく、変わったものの性質で人が選ぶ。

- **A** — 大きな変更。構造を組み直す、新しいモードができる、という規模
- **B** — 小さな変更。普段の機能追加・修正のように利用者に見えるが、A ほどではないもの
- **C** — セキュリティ・方針・ルール。利用者の画面には出ないもの（`relay/` のトークン処理、レート制限、CLAUDE.md やコミット規約）

上の桁を上げたら、その下の桁は 0 に戻す。

`app.js` の `VER`（設定画面のバージョン行の括弧内の数字）はこの三桁とは別。キャッシュ破り用の内部ビルドカウンタで、直すたびに `0.01` 上げる（`0.69 → 0.70`）。

変更点リストには **このリリースで変わったことだけ** を書く。古い項目を積み続けると、何が新しく入ったか読めない。

`?v=` クエリは小さくしない。小さくすると古い番号と重なり、キャッシュが切り替わらない。

## 実行

    python3 -m http.server 3000

`http://localhost:3000` —— 静的ファイルだけなので、どの静的ホスティングにもそのまま載る。
`?rt=1` を付けると判定エンジンの自己検査がコンソールで走る。

## ファイル

    index.html               画面（タイトル / 地域 / 設定 / プレイ / 結果）
    about.html / about.*.html  紹介 —— UI 言語ごとに一枚。style.css のトークンだけ借り、app.js は読まない
    style.css
    app.js                   判定エンジン + ゲームループ + 結果カード
    design/                  プレイ・キュー画面のデザイン（`design.pen`）
    relay/                   Cloudflare Worker —— フィードバック → GitHub Issue、ランキング → D1
    mimi/                    Mini Motorways 風ボード（開発用）
    data/*.course.json       項目・別名・一行紹介（mode: sequence）
    data/*.geom.json         ビットマップの点格子
    data/world.json          国一覧（build_world.py）
    data/i18n.json           画面の言葉（26 UI 言語）。手で書く
    data/kr-tree.json        韓国の階層ツリー（build_kr.py）。まだ配信しない
    data/kr-names.json       韓国語以外の画面で出す韓国地名のローマ字（build_names.py）
    data/board/              投影を共有する大地タイル（build_board.py）。まだ配信しない
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      25 区の行政洞コースを一度に
    tools/build_kr.py        道と道内の市郡区コースを一度に
    tools/build_board.py     一枚の大地に韓国全土、層ごとのタイル
    tools/build_world.py     Natural Earth admin-1 → 国コース
    tools/build_size.py      コース定員 → relay/size.mjs
    tools/build_names.py     southkorea-maps name_eng → kr-names.json

## 地図データの更新

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

25 自治区の行政洞コースは一度に打つ。格子は埋まった点の数を見て区ごとに変える——幅だけ固定すると縦に長い区で点が爆発する。

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

江西区コースの一行紹介は手書きなので上書きしない（build_dong.py の `KEEP`）。ほかの紹介は空——400 件は作れないので、人が埋める席にしてある。

## 国コース

ソウル以外の第一級行政区画は Natural Earth 10m から打つ。一行紹介は作らない。

    curl -sL -o /tmp/ne-admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
    curl -sL -o /tmp/ne-admin0.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
    python3 tools/build_world.py /tmp/ne-admin1.geojson /tmp/ne-admin0.geojson data/
    python3 tools/build_size.py

`relay/size.mjs` は定員表。コースが増えると中継もこのファイルを読むので、打ったあと `node relay/test.mjs` でずれを見る。`GET /where` はデプロイ済みの中継にある。

## 判定

入力のたび（ハングル組み合わせ中も含む）に調べる。略称（「강남」）は **その略称でつながる未占領項目が自分だけであるときだけ** 確定する。

- `강남` → 江南区を即確定
- `중` → 中区と中浪区が残っているあいだは確定しない（`중구` まで打つ）
- 語幹が一文字なら略称にしない
- 先頭の打ち間違いは接尾検査で流す（`ㅋㅋ강남` → 江南区）

ミスは **組み合わせが終わり、どの接尾も未占領名の先頭でなくなったとき** に自動確定する（`강난` → 即ミス）。Space を `keydown` で横取りすると IME の確定が壊れるので、そうしない。名前に空白があるコースでは Space が文字なので、そのときだけ Enter で確定する。減点はなく、コンボだけ切れる。

## フィードバック

タイトルロゴの黄色い点がフィードバックボタン。載せたり Tab で移ると点が大きくなり旗が出て、押すとモーダル `<dialog>` が開く。画面を増やさないのは、「ここで話せる」をロゴ横の一点で終えるため。

送り先は `app.js` 先頭の定数ひとつ。

    const FEEDBACK_URL = ''       // 入れるとここに JSON を POST
    const FEEDBACK_REPO = 'g-gearservice/regiontype.com'

本体は

    { kind, body, v, href, ua }

`kind` はバグ / 提案 / 地名・情報の誤り。文だけだと再現できないので、バージョン・URL・ブラウザも載せる。返信先は受け取らない——Issue は公開で、書けば他人のメールがそのまま見え、返事は Issue に付ければよい。

`FEEDBACK_URL` が空なら `FEEDBACK_REPO` の Issue 下書きを新しいタブで開く。インフラなしで回る道なので既定にしたが、報告者に GitHub アカウントを求める。それが嫌なら下の中継を立てる。

### 中継（`relay/`）

GitHub Issue はトークンなしでは作れず、静的サイトにトークンを置くとすぐ抜かれる。だからトークンを握る Cloudflare Worker を一枚挟む。仕事はそれだけ——受け取った JSON を Issue 一枚にして GitHub API へ渡す。

    cd relay
    wrangler login
    wrangler secret put GH_TOKEN     # そのリポジトリの Issues 書き込みだけを持つ細かいトークン
    wrangler deploy

出た URL を `FEEDBACK_URL` に付ける。トークンは Worker の中だけにあり、ブラウザへは下りない。

    node relay/test.mjs      Issue 一枚とスコア一行を正しく濾せるか検査

Issue を作る開いた URL なので、いずれスパムが来る。IP ごとに窓を置き、メタはコードブロックに閉じ、他人の値が Issue 書式を揺らさないようにした。それでも漏れたら Turnstile を前に置く——トークンはそのリポジトリの Issue しか触れないので、最悪でも README だけのリポジトリを空にすれば終わる。

窓は `ratelimit` バインディングで数える。**以前は Cache API で数えていたが、`workers.dev` では丸ごと無視される**——`put` は捨てられ `match` はいつも空手なので、窓があると書いてあるあいだ実際は一度も点いていなかった。閉まっているように見える壁は、ない壁より悪い。バインディングがなければ 200 ではなく 503 で扉を閉じる。

返信先はどんな形でも受け取らない。画面に欄がないだけでは足りない——中継がその欄を読む限り、誰でも他人のメールを公開 Issue に打てる。

### ランキング（`relay/` + D1）

同じ中継に経路を二つ足した。一局は **コースと制限時間** で、その中で一人一行——5 分と 1 分を一行に並べると点数に意味がない。

    POST /score    {c, t, who, name, score, hits, tries} → {rank, top}
    GET  /top      ?c=コース&t=秒 → {top}
    POST /dist     {c, t} → {bins, bucket, cap, total, score, over}
    POST /forget   {} → {gone}      自分の行を全部下ろす

    POST /auth/new  パスキー作成開始 → チャレンジ
    POST /auth/reg  パスキー作成終了 → セッショントークン
    POST /auth/go   ログイン開始 → チャレンジ
    POST /auth/log  ログイン終了 → セッショントークン
    GET  /auth/me   今だれか

    cd relay
    wrangler d1 create rt-board                              # 出た id を wrangler.toml へ
    wrangler d1 execute rt-board --remote --file schema.sql
    wrangler deploy

`database_id` が空か、まだデプロイしていなければ中継は 503 で畳み、サイトはランキング節を丸ごと隠す。結果画面はそのまま。

行の主は名前ではなく `who`——ブラウザが一度作る乱数で、画面に出ず応答にも乗らない。名前を主にすると、他人の名前に高得点を置いてその人が二度と記録を上げられなくできる。自分の行表示も中継が `me` で付ける——名前はサーバが整えて保存するので、ブラウザが名前を突き合わせるとずれる。

採点はブラウザ。中継が見るのは前後が合うかだけ。上限は **コース定員と制限時間** が一緒に決める——コースにある場所以上は回れず、一か所打つのにいくら速くても 0.5 秒はかかる。定員表（`SIZE`）がなければ 25 か所の局に 500 か所打ったふりをした 25 万点が通り、1 位を永久に占める。表にないコース名は受けない。

その表は `data/*.course.json` から写した値なのでいつか古くなる。`relay/test.mjs` が毎回原本と突き合わせて、ずれたら拾う。

それでも正直な値とよく作った嘘はここでは分けられない。**ランキングは名誉の殿堂であって判定記録ではない。** 分けねばならないほどやられたら、採点をサーバへ移すしかない。

### ログイン

**ランキングに載せるときだけ必要。** ゲームはログインなしで回る。分布もそのまま見える——自分の席だけ印が付かない。

**パスワードは受け取らない。** 静的サイトがパスワードを扱うとハッシュ・再設定・漏洩対応を全部背負うが、それはこのリポジトリが担う層ではない。パスキーは秘密が端末の外に出ないので **こちらが抜かれるもの自体がない**——サーバには公開鍵だけ残る。

    wrangler secret put SESSION_KEY   # 長い乱数。替えると全セッションが切れる

メールリンクはまだない。Cloudflare Email Routing は受け取りだけで送れないので、送信元（Resend・Postmark など）と API キーが決まってから載せられる。

パスキー検証は **依存なし**。登録時のブラウザ `getPublicKey()` が SPKI をそのまま渡すので、サーバに CBOR パーサを入れない。署名は WebCrypto で確かめ、認証器が送る DER 署名を生の 64 バイトにほどく（`derToRaw`）。

`attestation` は `none`。機器メーカー証明書は受け取らず、守るのは **「このチャレンジに、このオリジンから、この機器が答えた」** 一つ。ランキングにはそれで足りる。

セッションは署名した無状態トークンで `Authorization: Bearer` に載せる。Cookie を使わないのは中継がサイトと別の場所（`workers.dev`）にあるから——サイト外 Cookie はブラウザがますます止める。ヘッダなら CSRF もない。中継を `api.regiontype.com` へ移せば HttpOnly Cookie に上げられる。

**行の主はトークンから読む。** 本体に乗ってきた値は見ない——昔の記録コード方式は、コードを知る人なら誰でもその名前で上げられた。

無状態なのでセッションを一つずつ切れない。急げば `SESSION_KEY` を替えて全部切る。

### 順位タブ

地域カードのタブから開く。打つ前の画面なので、結果画面のランキングとは目的が違う——あちらは今打った局の結果、こちらは **相手**。矢印でコースを送り、制限時間は設定に従う。

分布はその局で出うる最高点まで描く。人が集まったところまでしか描かないと、横目盛りが局ごとに変わり比べられない。順位と上位何 % はサーバが数えた値だけ書く——棒から目分量した位置を数字にすると、見えるものと実際がずれる。

`/dist` は読みなのに POST。`who` が資格情報なので、アドレスバーに載せると中継・アクセスログに残る。

名前は他人の前に掛かる唯一の他人入力。12 字で切り、見えない文字（制御・書式・方向反転）を払い、画面には `textContent` だけで載せる。ブラウザも **中継と同じ尺** で整える——こちらだけ通る名前を保存すると、そのあと全ての局が 400 を受け、順位欄が畳まれ、名前を書き直すフォームまで消えて戻せなくなる。

名前が公開されると書く場所で明かし（「誰でも見るランキングにこの名前が載ります」）、設定に **ランキングから自分の記録を下ろす** を置く。点を破らなくても名前は更新できるので、打ち間違えた名前を消すために自己記録を破る必要はない。
IP はレート制限の窓にだけ使い、保存しない。D1 に残るのはコース・時間・`who`・名前・点だけ。

## アクセシビリティ

- 全機能キーボード操作。トグルとステッパーは `aria-label` を持つ
- 占領状態は色だけでなく **枠と地名ラベル** でも分かる（PRD 8.4）
- 残り時間をゲージと **数字** の両方で出し、色対比だけに頼らない
- `prefers-reduced-motion` を尊重し、設定でアニメーションを個別に止められる
- モバイル案内は画面幅ではなく `pointer:coarse` で分ける——デスクトップで 200% 拡大した人を追い出さないため

## v1 までに残っていること

法定洞・同名対応、位置型モード、サーバ側ランキング、コースエディタ。行政洞の一行紹介は江西区だけ埋まっている。

---

# हिन्दी

स्थान-नाम टाइप करके याद करने का अभ्यास। v0.4.0 (`VER=1.32`) — देश के अनुसार प्रथम-स्तर प्रशासनिक पाठ्यक्रम, इंटरफ़ेस 26 भाषाओं में।

## 0.4.0 में नया

- शीर्षक स्क्रीन पृष्ठभूमि ग्रिड पर बैठती है। लोगो और मेनू एक ही खंड हैं, और परिचय / सेटिंग / शुरू वाली पंक्ति ग्रिड रेखाओं पर रखी है
- शीर्षक का पिक्सेल मानचित्र और उसका पॉइंटर निकट-क्षेत्र हटा दिया गया
- शीर्षक के कोने में स्टार संख्या के साथ GitHub लिंक। संख्या सार्वजनिक API से आती है, आधे दिन कैश रहती है, और रेफ़रर नहीं भेजा जाता
- सेटिंग पैनल अपने ऊपरी और निचले, दोनों किनारे ग्रिड रेखा पर बिठाता है; नीचे की ब्लर पट्टी अब पैनल से नहीं, व्यूपोर्ट से जुड़ी है
- डेस्कटॉप पर 125% से अधिक ज़ूम करने पर सेटिंग का चयन-पट एक ही स्तंभ में नहीं सिमटता
- अरबी, थाई और यूक्रेनी में परिचय पृष्ठ
- `도` नाम-प्रत्यय गिना जाता है, इसलिए 경기도 पर 경기 और 울릉도 पर 울릉 से पुष्टि होती है
- पूरे कोरिया का डेटा बन गया है पर अभी परोसा नहीं जाता: 17 प्रांत (`kr-admin`) और उनके 250 ज़िले (`tools/build_kr.py`), तथा एक ही प्रक्षेप साझा करने वाली बोर्ड टाइलें (`tools/build_board.py`)
- GitHub जब इशू न ले, तो रिले केवल स्थिति और बची हुई दर-सीमा लिखता है, मूल पाठ कभी नहीं

## 0.97 में नया

- परिचय पृष्ठ UI भाषा के साथ `about.{lang}.html` खोलता है
- सेटिंग की भाषा-सूची ऊपर-नीचे ग्रेडिएंट धुंध से कटी पंक्ति को नरम करती है
- कमिट संदेश अंग्रेज़ी में। यही एक README अंग्रेज़ी, चीनी, जापानी और हिन्दी रखता है

## 0.3.9 में नया

- सेटिंग में देश और भाषा चुनें। खाली छोड़ें तो ब्राउज़र भाषा और रिले का देश कोड (`GET /where`) डिफ़ॉल्ट देता है
- 46 देशों के प्रथम-स्तर प्रशासनिक पाठ्यक्रम। नाम Natural Earth के स्थानीय नाम हैं। एक-पंक्ति परिचय खाली है
- कोरिया सियोल पाठ्यक्रम रखता है। जापान प्रान्त हैं। अमेरिका 50 राज्य और वाशिंगटन डीसी
- नाम में स्पेस हो तो Space नहीं, Enter से पुष्टि

## 0.3.8 में नया

- आइकन Google Fonts से नहीं, `assets/*.svg` मास्क से। बाहर कोई फ़ॉन्ट अनुरोध नहीं, इसलिए धीमे या बंद जाल पर आइकन खाली बक्सा नहीं बनते
- शीर्ष मेनू से परिचय पृष्ठ (`about.html`) जुड़ा है, ताकि खोज यह पढ़ सके कि जिला और प्रशासनिक दोंग क्या हैं, और हम टाइप क्यों करते हैं
- लिंक पूर्वावलोकन के लिए OG, Twitter Card और संरचित डेटा
- परिणाम स्क्रीन पर वैश्विक लीडरबोर्ड। एक बोर्ड तभी साझा होता है जब पाठ्यक्रम और समय-सीमा एक हों
- क्षेत्र कार्ड पर कोर्स चुनने के पास **रैंक** टैब, ताकि खेल से पहले दिखे लोग कहाँ जुटे हैं

## 0.3.7 में नया

- हल्की थीम: सही अक्षर गहरे नारंगी, ग़लत लाल
- वापस आइकन स्थानीय SVG है, वेबफ़ॉन्ट के बिना भी दिखता है
- मोबाइल पाठ छोटा

## 0.3.6 में नया

- ग़लती पर रन रुकता नहीं। पंक्ति टाइप किए अक्षरों के साथ बढ़ती है, स्क्रीन इनपुट को वैसा ही दिखाती है
- नामों का मध्य-बिंदु अल्पविराम बनता है — कीबोर्ड `종로1·2·3·4가` नहीं टाइप कर सकता
- सही और ग़लत के रंग बदल दिए, क्योंकि पहले बहुत मिलते-जुलते थे

पिछले पैच से: लोगो-डॉट फीडबैक, सेटिंग ग्रिड टॉगल, थीम फ़ेविकॉन, शीर्ष/सेटिंग पिक्सेल मैप और पॉइंटर निकट-क्षेत्र, बिल्ड संख्या, प्ले कतार और ब्लर, सियोल के 25 ज़िला दोंग पाठ्यक्रम, डेव पूर्वावलोकन `/mimi/`।

## संस्करण

रिलीज़ का नाम `vA.B.C` — तीन अंक। हर अंक `VER` से उल्टा निकाला गया मान नहीं है; जो बदला उसकी प्रकृति देखकर चुना जाता है।

- **A** — बड़ा बदलाव: ढाँचा फिर से बनता है, या कोई नया मोड आता है
- **B** — छोटा बदलाव: सामान्य जोड़-घटाव या सुधार, जो उपयोगकर्ता को दिखता है पर A जितना बड़ा नहीं
- **C** — सुरक्षा, नीति और नियम: जो उपयोगकर्ता की स्क्रीन पर कभी नहीं दिखता (`relay/` के टोकन, दर-सीमा, CLAUDE.md और कमिट नियम)

ऊपर का अंक बढ़ाने पर उसके नीचे के अंक शून्य हो जाते हैं।

`app.js` का `VER` (सेटिंग के संस्करण वाली पंक्ति में कोष्ठक का अंक) इन तीन अंकों से अलग है — कैश तोड़ने का आंतरिक बिल्ड काउंटर, हर बदलाव पर `0.01` बढ़ता है (`0.69 → 0.70`)।

चेंजलॉग में **केवल इस रिलीज़** की बात लिखें। पुरानी गोलियाँ ढेर करने से नया क्या आया, पढ़ा नहीं जाता।

`?v=` क्वेरी कभी छोटी न करें। छोटी करने पर पुराने नंबर से टकराती है और कैश नहीं बदलता।

## चलाना

    python3 -m http.server 3000

`http://localhost:3000` — केवल स्थैतिक फ़ाइलें, कोई भी स्थैतिक होस्ट चल जाएगा।
`?rt=1` कंसोल में मिलान-इंजन की स्व-जाँच चलाता है।

## फ़ाइलें

    index.html               स्क्रीन (शीर्ष / क्षेत्र / सेटिंग / प्ले / परिणाम)
    about.html / about.*.html  परिचय — हर UI भाषा की एक फ़ाइल; style.css टोकन लेती है, app.js नहीं
    style.css
    app.js                   मिलान इंजन + गेम लूप + परिणाम कार्ड
    design/                  प्ले/कतार डिज़ाइन (`design.pen`)
    relay/                   Cloudflare Worker — फीडबैक → GitHub इश्यू, लीडरबोर्ड → D1
    mimi/                    Mini Motorways-शैली बोर्ड (केवल डेव)
    data/*.course.json       प्रविष्टियाँ, उपनाम, एक-पंक्ति परिचय (mode: sequence)
    data/*.geom.json         बिटक मानचित्र ग्रिड
    data/world.json          देश सूची (build_world.py)
    data/i18n.json           UI पाठ (26 भाषाएँ)। हाथ से लिखा
    data/kr-tree.json        कोरिया का स्तर-वृक्ष (build_kr.py)। अभी परोसा नहीं जाता
    data/kr-names.json       कोरियाई के अलावा UI में दिखने वाले कोरियाई स्थान-नामों का रोमन रूप (build_names.py)
    data/board/              एक ही प्रक्षेप की बोर्ड टाइलें (build_board.py)। अभी परोसा नहीं जाता
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      25 ज़िले के दोंग पाठ्यक्रम एक साथ
    tools/build_kr.py        प्रांत और उनके ज़िले एक ही बार में
    tools/build_board.py     एक चादर पर पूरा दक्षिण कोरिया, स्तर-वार टाइलें
    tools/build_world.py     Natural Earth admin-1 → देश पाठ्यक्रम
    tools/build_size.py      पाठ्यक्रम आकार → relay/size.mjs
    tools/build_names.py     southkorea-maps name_eng → kr-names.json

## मानचित्र डेटा ताज़ा करना

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

25 ज़िलों के दोंग पाठ्यक्रम एक पास में बनते हैं। ग्रिड घनत्व भरे बिंदुओं के अनुसार ज़िले-ज़िले बदलता है — स्थिर चौड़ाई लंबे ज़िले पर बिंदु विस्फोट कर देती है।

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

गंगसो-गु पाठ्यक्रम का हाथ-लिखा परिचय रहता है (`KEEP` in build_dong.py)। बाकी परिचय खाली हैं — 400 कल्पित पंक्तियाँ नहीं लिखेंगे।

## देश पाठ्यक्रम

सियोल के बाहर प्रथम-स्तर इकाइयाँ Natural Earth 10m से आती हैं। एक-पंक्ति परिचय गढ़ते नहीं।

    curl -sL -o /tmp/ne-admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
    curl -sL -o /tmp/ne-admin0.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
    python3 tools/build_world.py /tmp/ne-admin1.geojson /tmp/ne-admin0.geojson data/
    python3 tools/build_size.py

`relay/size.mjs` आकार तालिका है। पाठ्यक्रम बढ़ें तो रिले वही फ़ाइल पढ़ता है, इसलिए पुनर्निर्माण के बाद `node relay/test.mjs` चलाएँ। `GET /where` तैनात रिले पर है।

## मिलान

हर कीस्ट्रोक जाँचा जाता है, हांगुल संयोजन के दौरान भी। संक्षेप जैसे "강남" तभी बैठता है **जब उसी संक्षेप से ठीक एक अनजित वस्तु बचे**।

- `강남` → गंगनाम-गु, तुरंत
- `중` → जब जंग-गु और जंगनांग-गु दोनों बचे हों तो नहीं (`중구` पूरा टाइप करें)
- एक-अक्षर तना संक्षेप नहीं
- आगे की ग़लतियाँ प्रत्यय जाँच से छूटती हैं (`ㅋㅋ강남` → गंगनाम-गु)

ग़लती तब बैठती है **जब संयोजन खत्म हो और कोई प्रत्यय अनजित नाम का उपसर्ग न रहे** (`강난` → तुरंत ग़लती)। `keydown` पर Space काटना IME पुष्टि तोड़ देता है, इसलिए हम ऐसा नहीं करते। जिन पाठ्यक्रमों के नाम में स्पेस है, वहाँ Space एक अक्षर है, इसलिए केवल वे Enter से पुष्टि करते हैं। दंड नहीं; कॉम्बो टूटता है।

## फीडबैक

शीर्ष लोगो का पीला बिंदु फीडबैक बटन है। होवर या टैब करें तो बढ़कर झंडा बनता है; क्लिक से मोडल `<dialog>` खुलता है। अलग स्क्रीन नहीं — लोगो के पास एक बिंदु ही «यहाँ बात की जा सकती है»।

गंतव्य `app.js` के ऊपर एक स्थिरांक है।

    const FEEDBACK_URL = ''       // सेट हो तो JSON यहाँ POST
    const FEEDBACK_REPO = 'g-gearservice/regiontype.com'

शरीर है

    { kind, body, v, href, ua }

`kind` बग / विचार / स्थान-नाम त्रुटि। केवल पाठ से पुनरुत्पादन नहीं होता, इसलिए संस्करण, URL और यूज़र एजेंट भी भेजते हैं। उत्तर पता नहीं लेते — इश्यू सार्वजनिक हैं, टाइप किया ईमेल लीक होगा, उत्तर इश्यू पर ही दें।

`FEEDBACK_URL` खाली हो तो `FEEDBACK_REPO` पर पहले से भरा इश्यू नए टैब में खुलता है। इन्फ्रा नहीं चाहिए, पर रिपोर्टर से GitHub खाता माँगता है। न हो तो नीचे का रिले खड़ा करें।

### रिले (`relay/`)

GitHub इश्यू के लिए टोकन चाहिए, और स्थैतिक साइट पर टोकन तुरंत चोरी होता है। Cloudflare Worker टोकन रखता है और एक काम करता है: JSON को इश्यू बनाकर GitHub API पर भेजना।

    cd relay
    wrangler login
    wrangler secret put GH_TOKEN     # उस रेपो पर Issues लिखने वाला सूक्ष्म टोकन
    wrangler deploy

URL `FEEDBACK_URL` में रखें। टोकन Worker से बाहर नहीं जाता।

    node relay/test.mjs      एक इश्यू और एक स्कोर पंक्ति सही छनती है या नहीं

यह इश्यू बनाने वाला खुला URL है, स्पैम आएगा। प्रति-IP खिड़की है, मेटा कोड ब्लॉक में है ताकि बाहरी इनपुट टेम्पलेट न तोड़े। फिर भी रिसे तो आगे Turnstile लगाएँ — टोकन केवल इश्यू खोल सकता है, सबसे बुरा README-मात्र रेपो खाली करना है।

खिड़की `ratelimit` बाइंडिंग से गिनी जाती है। **पहले Cache API थी, जिसे `workers.dev` चुपचाप नज़रअंदाज़ करता है** — `put` गिरता है, `match` हमेशा खाली, इसलिए खिड़की कभी चली ही नहीं। बंद दिखने वाली दीवार खुली दीवार से बुरी है। बाइंडिंग न हो तो 200 नहीं, 503।

उत्तर पता किसी भी रूप में नहीं लेते। UI में फ़ील्ड न होना काफ़ी नहीं — रिले उस फ़ील्ड को पढ़े तो कोई भी किसी और का ईमेल सार्वजनिक इश्यू पर चिपका सकता है।

### लीडरबोर्ड (`relay/` + D1)

उसी वर्कर पर दो और पथ। एक बोर्ड **पाठ्यक्रम प्लस समय-सीमा** है। एक व्यक्ति, उस बोर्ड पर एक पंक्ति — 5 मिनट और 1 मिनट एक पंक्ति में मिलाने से स्कोर बेमानी हो जाता है।

    POST /score    {c, t, who, name, score, hits, tries} → {rank, top}
    GET  /top      ?c=course&t=seconds → {top}
    POST /dist     {c, t} → {bins, bucket, cap, total, score, over}
    POST /forget   {} → {gone}      मेरी सारी पंक्तियाँ हटाएँ

    POST /auth/new  पासकी बनाना शुरू → चैलेंज
    POST /auth/reg  पासकी बनाना खत्म → सेशन टोकन
    POST /auth/go   लॉगिन शुरू → चैलेंज
    POST /auth/log  लॉगिन खत्म → सेशन टोकन
    GET  /auth/me   यह कौन है

    cd relay
    wrangler d1 create rt-board                              # id wrangler.toml में
    wrangler d1 execute rt-board --remote --file schema.sql
    wrangler deploy

`database_id` खाली हो या डिप्लॉय न हो तो रिले 503 देता है और साइट लीडरबोर्ड छुपाती है। परिणाम स्क्रीन चलती रहती है।

पंक्ति का मालिक नाम नहीं, `who` है — ब्राउज़र एक बार बनाता यादृच्छिक id। दिखता नहीं, लौटता नहीं। नाम मालिक हो तो कोई और के नाम पर ऊँचा स्कोर गाड़ सकता है। रिले «me» चिह्नित करता है; नाम सर्वर काटता है, क्लाइंट नाम से मिलान बहक जाता है।

स्कोरिंग ब्राउज़र में है। रिले केवल जाँचता है कि संख्याएँ बैठती हैं। सीमा **पाठ्यक्रम आकार × समय-सीमा** है — पाठ्यक्रम से ज़्यादा स्थान नहीं, एक स्थान कम-से-कम 0.5 सेकंड। बिना आकार तालिका (`SIZE`) 25-स्थान पाठ्यक्रम 500 यात्रा और 250,000 अंक दावा कर स्थायी प्रथम रख सकता है। अज्ञात पाठ्यक्रम अस्वीकृत।

तालिका `data/*.course.json` से नकल है और पुरानी पड़ जाएगी। `relay/test.mjs` हर बार स्रोत से अंतर देखता है।

ईमानदार स्कोर और अच्छी गढ़ी झूठ यहाँ एक जैसे लगते हैं। **बोर्ड यश-भवन है, ऑडिट लॉग नहीं।** अलग करना हो तो स्कोरिंग सर्वर पर ले जानी होगी।

### लॉगिन

**केवल लीडरबोर्ड पर पोस्ट के लिए।** खेल बिना लॉगिन चलता है। वितरण दिखता रहता है — केवल आपकी सीट नहीं।

**पासवर्ड नहीं।** स्थैतिक साइट पासवर्ड ले तो हैश, रीसेट, उल्लंघन सब अपने सिर — यह रेपो वह परत नहीं चलाएगा। पासकी डिवाइस से बाहर नहीं जाती, इसलिए **चुराने को हमारा कुछ नहीं** — सर्वर पर केवल सार्वजनिक कुंजी।

    wrangler secret put SESSION_KEY   # कोई लंबा यादृच्छिक। घुमाने से सभी सेशन मरते हैं

ईमेल लिंक अभी नहीं। Cloudflare Email Routing प्राप्त कर सकता है, भेज नहीं, इसलिए भेजने वाला (Resend, Postmark, …) और API कुंजी पहले चाहिए।

पासकी जाँच **बिना अतिरिक्त निर्भरता**। पंजीकरण `getPublicKey()` से SPKI देता है, सर्वर को CBOR पार्सर नहीं चाहिए। हस्ताक्षर WebCrypto से, प्रमाणक का DER कच्चा 64 बाइट (`derToRaw`)।

`attestation` `none` है। विक्रेता प्रमाणपत्र नहीं; एक दावा: **यह चैलेंज, यह ओरिजिन, इस डिवाइस ने उत्तर दिया**। लीडरबोर्ड के लिए काफ़ी।

सेशन हस्ताक्षरित अवस्था-रहित टोकन है, `Authorization: Bearer` पर। कुकी नहीं, क्योंकि रिले `workers.dev` पर साइट से अलग है — तीसरी-पार्टी कुकी और बंद हो रही हैं। हेडर से CSRF भी नहीं। रिले `api.regiontype.com` पर ले जाएँ तो HttpOnly कुकी संभव।

**पंक्ति मालिक टोकन से पढ़ा जाता है।** शरीर अनदेखा — पुराना रिकॉर्ड-कोड जानने वाला कोई भी उस नाम से पोस्ट कर सकता था।

अवस्था-रहित सेशन एक-एक कर रद्द नहीं होते। जल्दी में `SESSION_KEY` घुमाएँ, सब गिरें।

### रैंक टैब

क्षेत्र कार्ड से खुलता है। यह खेल-से-पहले स्क्रीन है, परिणाम-बोर्ड से काम अलग — वह अभी टाइप किया रन है, यह **प्रतिद्वंद्वी**। तीर पाठ्यक्रम बदलते हैं; समय-सीमा सेटिंग से आती है।

वितरण उस बोर्ड के संभव उच्चतम स्कोर तक खींचा जाता है। भीड़ तक ही खींचें तो x-अक्ष हर बोर्ड पर बदलता है, तुलना नहीं हो सकती। रैंक और शीर्ष-% केवल सर्वर गिनती — आँख से देखी पट्टी को संख्या लिखना वास्तविक रैंक से टकराएगा।

`/dist` पढ़ाई है, फिर भी POST। `who` प्रमाण है; क्वेरी में डालने से प्रॉक्सी और लॉग में रह जाता है।

नाम एकमात्र दूसरे व्यक्ति का इनपुट है जो UI में दिखता है। 12 अक्षर पर काटते हैं, अदृश्य नियंत्रण हटाते हैं, केवल `textContent` से दिखाते हैं। ब्राउज़र **रिले जैसी ही छड़ी** से काटता है — केवल यहाँ पास नाम संगृहीत हो तो बाद का हर पोस्ट 400, रैंक फोल्ड, नाम-फ़ॉर्म गायब, वापसी नहीं।

नाम सार्वजनिक है, यह उसी जगह लिखते हैं जहाँ टाइप करते हैं («यह नाम सार्वजनिक लीडरबोर्ड पर जाएगा»), सेटिंग में **मेरी पंक्तियाँ हटाएँ** है। ख़राब नाम सुधारने के लिए अपना उच्च स्कोर तोड़ना नहीं पड़ता।
IP केवल दर-सीमा खिड़की के लिए, संगृहीत नहीं। D1 में पाठ्यक्रम, समय, `who`, नाम, स्कोर।

## पहुँच

- पूरा कीबोर्ड उपयोग। टॉगल और स्टेपर पर `aria-label`
- जीती अवस्था केवल रंग नहीं — सीमा और स्थान-नाम लेबल भी (PRD 8.4)
- बचा समय गेज और **संख्या** दोनों, केवल कंट्रास्ट पर निर्भर नहीं
- `prefers-reduced-motion` माना जाता है; सेटिंग एनीमेशन भी बंद कर सकती है
- मोबाइल सूचना `pointer:coarse` से, चौड़ाई से नहीं — डेस्कटॉप 200% ज़ूम उपयोगकर्ता बाहर नहीं फेंका जाता

## v1 के लिए बाकी

कानूनी-दोंग / समान-नाम मानचित्रण, स्थान मोड, सर्वर रैंकिंग, पाठ्यक्रम संपादक। एक-पंक्ति परिचय अभी केवल गंगसो-गु में है।
