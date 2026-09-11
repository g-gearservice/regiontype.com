[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [한국어](README.ko.md)

# regiontype.com

地名を打って覚えるタイピング練習。v0.3.9（`VER=0.97`）——国ごとの第一級行政区画コース、画面は 26 言語。

## 0.97 の変更

- 紹介ページは UI 言語に合わせて `about.{lang}.html` を開く
- 設定の言語リストの上下をグラデーションブラーでぼかし、切れた行を「続きがある」と読ませる
- コミットメッセージは英語。README は英語・中国語・日本語・ヒンディー語

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

`0.3.7` の前半 `0.3` がバージョン、末尾の `7` がパッチ。パッチ番号は `app.js` の `VER` から取る。`VER` はキャッシュ破りなので、直すたびに 1 上げる（`0.69 → 0.70`）。その **小数第一位** がパッチ。`VER=0.70` なら `v0.3.7`。

変更点リストには **このパッチで変わったことだけ** を書く。古い項目を積み続けると、何が新しく入ったか読めない。

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
    data/*-pixels.json       タイトルのピクセルマップ
    tools/build_map.py       GeoJSON → geom.json
    tools/build_dong.py      25 区の行政洞コースを一度に
    tools/build_pixels.py    GeoJSON → ピクセル格子
    tools/build_world.py     Natural Earth admin-1 → 国コース
    tools/build_size.py      コース定員 → relay/size.mjs

## 地図データの更新

    curl -sL -o gu.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json
    python3 tools/build_map.py gu.json data/seoul-gu.geom.json

25 自治区の行政洞コースは一度に打つ。格子は埋まった点の数を見て区ごとに変える——幅だけ固定すると縦に長い区で点が爆発する。

    curl -sL -o dong.json https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_submunicipalities_geo_simple.json
    python3 tools/build_dong.py dong.json gu.json data/

江西区コースの一行紹介は手書きなので上書きしない（build_dong.py の `KEEP`）。ほかの紹介は空——400 件は作れないので、人が埋める席にしてある。

## タイトルのピクセルマップ

全国の道境界を格子に打ち、ソウルだけ色を変える。v1 がソウルから全国へ広がる道筋が絵一枚で見えるように。

    curl -sL -o kr.json https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json
    python3 tools/build_pixels.py kr.json data/korea-pixels.json 34

最後の引数は横のマス数（余白を切るので結果はもっと狭い）。鬱陵島・独島のように隣のない一マスの島は飾りとしてのゴミなので消す。

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
    const FEEDBACK_REPO = 'pistolinkr/regiontype.com'

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
