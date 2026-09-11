[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [한국어](README.ko.md)

# regiontype.com

用地名做打字练习。v0.3.9（`VER=0.97`）——按国家提供一级行政区课程，界面 26 种语言。

## 0.97 更新

- 介绍页跟随界面语言打开 `about.{lang}.html`
- 设置里的语言列表上下用渐变模糊盖住被裁切的一行
- 提交说明用英语。README 提供英语、中文、日语、印地语

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

`0.3.7` 里前面的 `0.3` 是版本，最后的 `7` 是补丁。补丁号来自 `app.js` 的 `VER`。`VER` 用来破缓存，每改一次就加 1（`0.69 → 0.70`）。**小数点后第一位**就是补丁：`VER=0.70` 等于 `v0.3.7`。

更新列表只写 **这一补丁改了什么**。把旧条目一直堆下去，就看不出这次新来了什么。

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
    data/*-pixels.json       标题像素地图
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      一次生成 25 区行政洞课程
    tools/build_pixels.py    GeoJSON → 像素网格
    tools/build_world.py     Natural Earth admin-1 → 国家课程
    tools/build_size.py      课程容量 → relay/size.mjs

## 更新地图数据

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

25 个自治区的行政洞课程一次打出。网格按填满的点数分区来定——宽度写死的话，瘦高的区点数会爆。

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

江西区课程的一行介绍是手写的，所以不覆盖（build_dong.py 的 `KEEP`）。其余介绍留空——四百条编不出来，留给人填。

## 标题像素地图

把全国道界打成格子，只有首尔换色，好让 v1「从首尔扩到全国」的路线一眼能看见。

    curl -sL -o kr.json https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json
    python3 tools/build_pixels.py kr.json data/korea-pixels.json 34

最后一项是横向格数（裁掉空白后会更窄）。郁陵岛、独岛这种没有邻居的单格岛当作噪点去掉。

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
    const FEEDBACK_REPO = 'pistolinkr/regiontype.com'

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
