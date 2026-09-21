/* regiontype 중계기 — 정적 사이트가 혼자 못 하는 두 가지만 한다. 도메인은
   g.gearservicevanguard.com 이다(workers.dev 문은 닫혀 있다 — wrangler.toml 참고).

     POST /         피드백을 GitHub 이슈로 옮긴다 (토큰을 사이트에 둘 수 없다)
     POST /score    판 하나의 점수를 순위표에 올린다
     GET  /top      그 판의 상위 기록을 읽는다
     POST /dist     그 판의 점수 분포와 그 안에서 내가 선 자리
     POST /forget   내 줄을 전부 내린다

     1차 인증은 Google·Apple(SSO) 이 하고, 패스키는 그 위에 얹는 2단계다.
     POST /auth/new    패스키 만들기 시작 (로그인 필요)   → 챌린지
     POST /auth/reg    패스키 만들기 끝   (로그인 필요)   → 세션 토큰(첫 패스키면 복구 코드도)
     POST /auth/sso    SSO 시작 {p,s}                    → 공급자 URL
     GET  /auth/cb     공급자가 돌아오는 자리 (GET, Origin 없음) → 302 (#signin=ok&t=…)
     POST /auth/take   {b,t} 로 토큰을 받는다 — 패스키가 있으면 2단계를 요구한다
     POST /auth/log    2단계: 패스키로 넘는다              → 세션 토큰
     POST /auth/code   2단계: {b,t,code} 복구 코드로 넘는다 → 세션 토큰
     POST /auth/codes  복구 코드 재발급 (로그인 필요, 복구 코드가 없을 때만 자동 발급, 옛 코드는 전량 교체)
     GET  /auth/me     계정 화면이 볼 값 (로그인 필요) → {keys, codes} 개수만 — who·sub 같은
                        식별자는 안 싣는다. 이 브라우저의 localStorage 만으론 다른 기기에서
                        만든 패스키·거기서 쓴 복구 코드를 몰라 "남은 비상구" 숫자가 틀릴 수 있다
     GET  /where    이 요청의 나라 코드 (cf.country). 도시는 안 보낸다

       wrangler secret put SESSION_KEY   // 아무 긴 난수. 갈면 모든 세션만 끊긴다 —
                                          // 비상 레버지만 SSO 연결은 안 건드린다
       wrangler secret put SUB_KEY       // 선택. 없으면 SESSION_KEY 로 대신한다.
                                          // SSO 의 sub 을 이 키로 HMAC 해 저장한다
                                          // (schema.sql 의 sso 표 참고) — 이 키만의
                                          // 비상 레버다: 갈면 sso 연결이 전부 끊겨
                                          // 다음 로그인에서 새 빈 계정이 생긴다.
                                          // SESSION_KEY 와 겸하지 않는 이유가 이거다
       wrangler secret put GOOGLE_SECRET // Google OAuth 클라이언트 비밀
       wrangler secret put APPLE_KEY     // Apple Sign in .p8 키 원문(PEM)

       wrangler d1 create rt-board
       wrangler d1 execute rt-board --remote --file schema.sql
       // pending 표가 이전 배포에서 이미 있었다면 위 실행으로는 새 칼럼이
       // 안 붙는다 — schema.sql 의 pending 주석을 본다
       wrangler secret put GH_TOKEN     // 그 저장소의 Issues 쓰기만 가진 세밀 토큰
       wrangler secret put TURNSTILE_SITEKEY // 공개 키지만 배포별 설정으로 둔다
       wrangler secret put TURNSTILE_SECRET  // Turnstile 서버 검증 비밀키
       wrangler deploy                                                        */

import { sign, who as sessionWho, rand, hex, b64u, unb64u, mac,
         readClientData, readAuthData, verify, sha, eq } from './auth.mjs';
import { SIZE } from './size.mjs';

const REPO = 'g-gearservice/regiontype.com';
const SITE = ['https://regiontype.com', 'https://www.regiontype.com'];
const KIND = { bug: '버그', idea: '제안', data: '지명·정보 오류' };
/* GitHub 저장소 라벨은 영어다. 한글 이름을 넣으면 422 → 브라우저엔 502 로 보인다. */
const GH_LABEL = { bug: 'bug', idea: 'enhancement', data: 'bug' };
const CAP = { body: 500, v: 16, href: 300, ua: 300, name: 12 };
/* 제한 시간이 다르면 다른 판이다. app.js 의 opt.time 은 이 안의 값이어야 한다 */
const TIMES = [60, 90, 120, 180, 300];
const TOP = 10;
/* SIZE 는 tools/build_size.py 가 data/*.course.json 에서 찍는다. */

const cut = (s, n) => String(s ?? '').trim().slice(0, n);
/* 메타 한 줄에 들어갈 값. 백틱과 줄바꿈을 빼야 코드 블록을 뚫고 나오지 못한다 */
const flat = (s, n) => cut(s, n).replace(/[`\r\n]/g, ' ');
/* 남 앞에 걸릴 이름. 보이지 않는 글자(제어·서식·방향 뒤집기)를 통째로 턴다 */
const plain = (s, n) => cut(s, n).replace(/[\p{C}\p{Z}]/gu, ' ').replace(/ +/g, ' ').trim();
/* Origin 은 curl 로 얼마든 꾸며낼 수 있다 — 문지기가 아니라 CORS 예의일 뿐이라
   로컬도 그냥 통과시킨다. 실제로 막는 건 아래 IP 창이다. */
const ip = req => req.headers.get('cf-connecting-ip') || '?';
export const allowedOrigin = o => {
  if (!o) return false;
  if (SITE.includes(o)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return true;
  /* GitHub Pages 미리보기·작업 브랜치 */
  if (/^https:\/\/g-gearservice\.github\.io\/regiontype\.com\/?$/i.test(o)) return true;
  return false;
};
const mine = allowedOrigin;
const refererOrigin = req => {
  const ref = req.headers.get('referer');
  if (!ref) return '';
  try { return new URL(ref).origin; } catch { return ''; }
};

/* 이슈 한 장을 짓는다. 사이트의 GitHub 초안 경로와 같은 모양이라
   중계기를 켜기 전후로 이슈가 달라 보이지 않는다. */
export function compose(c) {
  const kind = KIND[c.kind] ? c.kind : 'bug';
  const body = cut(c.body, CAP.body);
  const meta = [`종류: ${KIND[kind]}`, `버전: ${flat(c.v, CAP.v)}`,
                `주소: ${flat(c.href, CAP.href)}`, `브라우저: ${flat(c.ua, CAP.ua)}`];
  /* 회신 주소는 받지 않는다. 이슈가 공개라 적는 순간 남의 주소가 공개된다 —
     사이트에 입력칸이 없어도 여기서 받으면 아무나 남의 메일을 박아 넣을 수 있다. */
  return {
    title: `[${KIND[kind]}] ${body.split('\n')[0].slice(0, 60)}`,
    /* 메타는 코드 블록에 가둔다 — 남이 보낸 값이 이슈 마크다운으로 살아나지 않게 */
    body: `${body}\n\n---\n\`\`\`\n${meta.join('\n')}\n\`\`\``,
    labels: [GH_LABEL[kind] || 'bug'],
    ok: !!body,
  };
}

/* 어느 판인지. 코스 이름과 제한 시간이 둘 다 맞아야 한 줄에 세운다 */
export function where(c) {
  const slug = cut(c.c, 40), secs = Number(c.t);
  return { slug, secs, size: SIZE[slug] || 0,
           ok: Object.hasOwn(SIZE, slug) && TIMES.includes(secs) };
}

/* 올라온 점수 한 줄. 채점은 브라우저가 한다 — 여기서 보는 건 앞뒤가 맞는지뿐이다.
   ponytail: 클라이언트 채점이라 정직한 값과 잘 지은 거짓말을 가릴 수 없다. 순위표는
   명예의 전당이지 판정 기록이 아니다. 가려야 할 만큼 시달리면 채점을 서버로 옮긴다. */
export function entry(c, who = '') {
  const w = where(c);
  const name = plain(c.name, CAP.name);
  /* 줄의 주인은 로그인한 사람이다. 몸통에 실려 온 값이 아니라 세션 토큰에서
     읽으므로, 남의 이름으로 올리는 길이 아예 없다 — 예전 기록 코드 방식은
     코드를 아는 사람이면 누구나 그 이름으로 올릴 수 있었다. */
  const [score, hits, tries] = [c.score, c.hits, c.tries].map(Number);
  const int = n => Number.isInteger(n) && n >= 0;
  const ok = w.ok && !!name && /^[a-z0-9]{8,64}$/.test(who)
    && int(score) && int(hits) && int(tries)
    /* 한 곳당 최대 100점 × 콤보 5배. 상한은 둘이 함께 정한다 — 코스에 있는
       곳보다 많이 들를 수 없고, 한 곳을 치는 데 아무리 빨라도 0.5초는 든다. */
    && hits <= tries && tries <= w.secs * 8 && hits <= Math.min(w.size, w.secs * 2)
    && score % 100 === 0 && score <= Math.min(hits * 500, w.secs * 1000);
  return { ...w, name, who, score, hits, tries, ok,
           acc: tries ? Math.round(hits / tries * 100) : 0 };
}

const head = o => mine(o) ? {
  'access-control-allow-origin': o,
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400',
  vary: 'Origin',
} : { vary: 'Origin' };
const send = (status, data, o) =>
  new Response(JSON.stringify({ ok: status < 300, ...data }),
    { status, headers: { 'content-type': 'application/json', ...head(o) } });
const reply = (status, msg, o) => send(status, { msg }, o);

/* IP 창. 예전엔 Cache API 로 셌는데 그건 workers.dev 배포에서 통째로 무시된다 —
   put 은 버려지고 match 는 늘 빈손이라 방벽이 켜진 적이 없었다. 조용히 열린 방벽이
   없는 방벽보다 나쁘다. 그래서 바인딩으로 옮기고, 바인딩이 없으면 문을 닫는다.
   창은 바깥을 부르기 *전에* 센다 — 동시에 퍼붓는 게 정확히 그 공격이다. */
const pass = async (rl, key) => rl ? (await rl.limit({ key })).success : null;
const shut = (ok, o) => ok === null ? reply(503, '중계기 설정이 덜 되었습니다.', o)
                                    : reply(429, '조금 뒤에 다시 보내주세요.', o);

/* Turnstile — 사람인지 묻는 일은 전부 여기서 한다. 사이트는 공개 sitekey 로 토큰만
   만들어 보내고, 비밀키도 검증도 이 중계기에만 있다. 계정과 세션이 그렇듯 사람
   판정도 저쪽 도메인으로 새 나가지 않는다.
   비밀키가 없으면 null 을 돌려 문을 닫는다 — IP 창과 같은 결이다. 조용히 열린
   방벽은 없는 방벽보다 나쁘다. 배포 전에 TURNSTILE_SECRET 을 먼저 넣어야 한다. */
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ACTION = 'feedback';
const TURNSTILE_HOSTS = new Set(['regiontype.com', 'www.regiontype.com', 'g-gearservice.github.io']);
async function human(env, token, from) {
  if (!env.TURNSTILE_SECRET) return null;
  /* 토큰은 남이 보낸 값이다 — 길이를 먼저 자른다. 정상 토큰은 2KB 를 넘지 않는다 */
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    /* remoteip 는 선택값이다. CF 헤더가 없는 로컬 검사에서 '?'를 보내지 않는다 */
    if (from && from !== '?') form.set('remoteip', from);
    const r = await fetch(TURNSTILE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return false;
    const d = await r.json();
    /* 같은 sitekey 의 다른 위젯에서 얻은 토큰도 받아들이지 않는다 */
    return d.success === true && d.action === TURNSTILE_ACTION
      && TURNSTILE_HOSTS.has(String(d.hostname || '').toLowerCase());
  } catch { return false; }   /* 못 물어봤으면 사람이 아니라고 본다 */
}

/* sitekey 는 브라우저에 보이는 공개값이다. 정적 파일에 박지 않고 여기서 주면
   Turnstile 위젯을 갈 때 사이트를 다시 배포할 필요가 없다. 비밀키는 절대 안 보낸다. */
const turnstileConfig = (env, o) => env.TURNSTILE_SITEKEY
  ? send(200, { sitekey: env.TURNSTILE_SITEKEY }, o)
  : reply(503, '사람 확인 설정이 덜 되었습니다.', o);

const board = (env, w) => env.DB.prepare(
  'select who, name, score, hits, acc from board where slug = ? and secs = ? order by score desc, at asc limit ?'
).bind(w.slug, w.secs, TOP);
/* 이름은 서버가 다듬어 저장하므로 브라우저가 자기 줄을 이름으로 찾으면 어긋난다.
   난수 id 는 남에게 보일 값이 아니니 여기서 떼고 '나' 표시만 붙여 보낸다. */
const seen = (rows, who) => rows.map(({ who: w, ...r }) => who ? { ...r, me: w === who } : r);
/* D1 이 넘어져도 CORS 없는 1101 대신 우리 형식으로 답한다 — 사이트가 조용히 접히게 */
const safely = async (o, f) => { try { return await f(); } catch { return reply(503, '순위표를 읽지 못했습니다.', o); } };

async function feedback(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const issue = compose(c);
  if (!issue.ok) return reply(400, '내용이 비어 있습니다.', o);
  const ok = await pass(env.RL_FB, ip(req));
  if (ok !== true) return shut(ok, o);
  /* 창을 지난 뒤에 사람인지 묻는다 — 퍼붓는 쪽에 바깥 호출을 시키지 않는다.
     여기만 잠그면 된다: /score·/forget 은 이미 로그인 뒤고, 이슈를 만드는 이 길만
     아무나 두드릴 수 있다 */
  const who = await human(env, c && c.cf, ip(req));
  if (who === null) return reply(503, '중계기 설정이 덜 되었습니다.', o);
  if (!who) return reply(403, '사람인지 확인하지 못했습니다. 다시 시도해 주세요.', o);

  const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'regiontype-feedback',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ title: issue.title, body: issue.body, labels: issue.labels }),
  });
  /* 왜 막혔는지는 wrangler tail 로만 본다 — 사용자 화면엔 토큰 사정을 내보이지 않는다 */
  if (!r.ok) {
    /* 상태와 남은 호출량이면 원인이 갈린다(401·403 토큰, 404 저장소, 422 서식).
       본문은 남기지 않는다 — 남이 보낸 내용이 그대로 되비칠 수 있다. */
    console.log('github', r.status, r.headers.get('x-ratelimit-remaining') ?? '?');
    return reply(502, 'GitHub 이 받지 않았습니다. 잠시 뒤 다시 시도해 주세요.', o);
  }
  return reply(201, '고맙습니다', o);
}

/* 점수 분포. 남들이 어디쯤에 몰려 있고 내가 그 어디에 서는지를 한 장으로 본다.
   막대 개수는 그 판에서 나올 수 있는 최고 점수로 정한다 — 판마다 천장이 다르다.
   내 자리는 로그인했을 때만 실린다. 안 했으면 남들의 분포만 보인다. */
const BINS = 30;
async function dist(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const w = where(c);
  if (!w.ok) return reply(400, '없는 판입니다.', o);
  const me = await sessionWho(env, req);

  const cap = Math.min(w.size * 500, w.secs * 1000);
  /* 점수는 100점 배수라 칸도 100점 배수로 끊는다 — 반 칸짜리 막대가 생기지 않게 */
  const bucket = Math.max(100, Math.ceil(cap / BINS / 100) * 100);

  return safely(o, async () => {
    const [bins, all, mine] = await env.DB.batch([
      env.DB.prepare(
        /* cast 가 없으면 바인딩된 칸 크기가 실수로 읽혀 나눗셈이 소수로 떨어진다 */
        'select cast(score / ? as integer) as b, count(*) as n' +
        ' from board where slug = ? and secs = ? group by b order by b'
      ).bind(bucket, w.slug, w.secs),
      env.DB.prepare('select count(*) as n from board where slug = ? and secs = ?').bind(w.slug, w.secs),
      env.DB.prepare('select score from board where slug = ? and secs = ? and who = ?')
        .bind(w.slug, w.secs, me ?? ''),
    ]);
    const score = mine.results[0]?.score ?? null;
    let over = null;
    if (score !== null) {
      const r = await env.DB.prepare(
        'select count(*) as n from board where slug = ? and secs = ? and score > ?'
      ).bind(w.slug, w.secs, score).first('n');
      over = r ?? 0;
    }
    return send(200, { bucket, cap, bins: bins.results,
                       total: all.results[0]?.n ?? 0, score, over }, o);
  });
}

async function top(req, env, o) {
  const u = new URL(req.url);
  const w = where({ c: u.searchParams.get('c'), t: u.searchParams.get('t') });
  if (!w.ok) return reply(400, '없는 판입니다.', o);
  return safely(o, async () => {
    const { results } = await board(env, w).all();
    return send(200, { top: seen(results, null) }, o);
  });
}

async function post(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '순위표에 올리려면 로그인이 필요합니다.', o);
  const e = entry(c, me);
  if (!e.ok) return reply(400, '올릴 수 없는 기록입니다.', o);
  /* 한 판을 다 돌려면 아무리 짧아도 60초다. 분당 셋이면 넉넉하다 */
  const ok = await pass(env.RL_SC, ip(req));
  if (ok !== true) return shut(ok, o);

  /* 한 사람이 한 판에 한 줄만 차지한다 — 자기 최고 기록으로만 갱신된다 */
  return safely(o, async () => {
    const [, rank, list] = await env.DB.batch([
      env.DB.prepare(
        `insert into board (slug, secs, who, name, score, hits, acc, at) values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (slug, secs, who) do update set
           /* 이름만은 점수와 무관하게 바뀐다. 이걸 점수 조건에 묶어두면 잘못 적은
              본명을 지우려고 자기 최고 기록을 깨야 한다 — 사실상 철회 불가가 된다. */
           name  = excluded.name,
           score = max(board.score, excluded.score),
           hits  = case when excluded.score > board.score then excluded.hits else board.hits end,
           acc   = case when excluded.score > board.score then excluded.acc  else board.acc  end,
           at    = case when excluded.score > board.score then excluded.at   else board.at   end`
      ).bind(e.slug, e.secs, e.who, e.name, e.score, e.hits, e.acc, Date.now()),
      /* coalesce 가 없으면 그 줄이 없을 때 score > NULL 이 NULL 이 되어 조용히 1위가 된다 */
      env.DB.prepare(
        `select count(*) + 1 as n from board where slug = ? and secs = ? and score >
           coalesce((select score from board where slug = ? and secs = ? and who = ?), -1)`
      ).bind(e.slug, e.secs, e.slug, e.secs, e.who),
      board(env, { slug: e.slug, secs: e.secs }),
    ]);
    return send(201, { rank: rank.results[0]?.n ?? null, top: seen(list.results, e.who) }, o);
  });
}

/* 순위표에서 내린다. 이름은 공개 목록에 걸리므로 거둘 손잡이가 있어야 한다.
   기록 코드를 아는 사람만 지울 수 있다 — 올릴 때와 같은 열쇠다. */
async function forget(req, env, o) {
  const who = await sessionWho(env, req);
  if (!who) return reply(401, '로그인이 필요합니다.', o);
  const ok = await pass(env.RL_SC, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    const r = await env.DB.prepare('delete from board where who = ?').bind(who).run();
    return send(200, { gone: r.meta?.changes ?? 0 }, o);
  });
}

/* ── 로그인 ──────────────────────────────────────────────
   1차 인증은 Google·Apple 이 한다(SSO, 아래). 패스키는 계정에 하나라도 있으면
   그 위에 얹는 2단계다 — 로그인하지 않은 사람이 패스키를 만들 수는 없다.
   rpId 는 페이지가 있는 도메인이어야 한다 — 중계기 도메인이 아니다.
   그래서 요청한 곳에서 뽑되, 우리가 아는 곳인지 mine() 으로 먼저 거른다. */
const RPNAME = 'regiontype';
const ALGS = [-7, -257];   // ES256 · RS256
const rpOf = o => new URL(o).hostname;
const LIVE = 5 * 60e3;   // 챌린지 · pending 줄이 사는 시간

const nokey = o => reply(503, '로그인 설정이 덜 되었습니다.', o);

/* 챌린지(또는 SSO 진행 상태) 한 장을 낸다. 우리가 낸 것만 받으려고 표에 적어
   둔다 — 적지 않으면 아무 값이나 챌린지라고 들고 와 서명해 보일 수 있다.
   id 를 지정하면(SSO 흐름) 나중에 같은 계산으로 같은 줄을 다시 찾을 수 있다. */
async function challenge(env, kind, who = null,
    { id = rand(32), back = null, sub = null, provider = null } = {}) {
  await env.DB.prepare(
    'insert into pending (id, kind, who, until, back, sub, provider) values (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, kind, who, Date.now() + LIVE, back, sub, provider).run();
  return id;
}
/* 한 번 쓰면 지운다. 지나간 것도 여기서 함께 쓸어낸다 — 따로 청소할 곳을 두지 않는다.
   kind 를 안 주면(주로 /auth/cb) id 만으로 찾는다 — 그 줄의 kind 로 SSO 공급자를 읽어야
   해서, 부르는 쪽이 kind 를 미리 알 수 없다.
   'two'(2단계) 는 이 함수로 부르지 않는다 — 실패해도 남겨 둬야 해서 아래
   peekTwo/consumeTwo 를 따로 쓴다. */
async function claim(env, id, kind = null) {
  const row = await (kind
    ? env.DB.prepare('select who, kind, back, sub, provider, until from pending where id = ? and kind = ?').bind(id, kind)
    : env.DB.prepare('select who, kind, back, sub, provider, until from pending where id = ?').bind(id)
  ).first();
  await env.DB.batch([
    env.DB.prepare('delete from pending where id = ?').bind(id),
    env.DB.prepare('delete from pending where until < ?').bind(Date.now()),
  ]);
  return row && row.until > Date.now() ? row : null;
}
/* 2단계 줄은 읽었다고 바로 지우지 않는다 — 패스키를 취소하거나 틀려도 복구
   코드로 갈아탈 수 있어야 한다. 대신 시도를 세어 5회에서 스스로 태운다.
   성공했을 때만 호출자가 consumeTwo 로 명시적으로 지운다. */
async function peekTwo(env, id) {
  const row = await env.DB.prepare(
    'select who, tries, until from pending where id = ? and kind = ?').bind(id, 'two').first();
  await env.DB.prepare('delete from pending where until < ?').bind(Date.now()).run();
  if (!row || row.until <= Date.now()) return null;
  if (row.tries >= 5) {
    await env.DB.prepare('delete from pending where id = ?').bind(id).run();
    return null;
  }
  await env.DB.prepare('update pending set tries = tries + 1 where id = ?').bind(id).run();
  return row;
}
const consumeTwo = (env, id) =>
  env.DB.prepare('delete from pending where id = ? and kind = ?').bind(id, 'two').run();

async function authNew(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  return safely(o, async () => send(200, {
    challenge: await challenge(env, 'reg', me),
    rp: { id: rpOf(o), name: RPNAME },
    user: me,
  }, o));
}

/* 등록 마무리. attestation 을 안 받으므로 공개키는 브라우저가 준 것을 그대로 믿는다 —
   등록은 원래 신뢰를 처음 세우는 순간이라, 남이 아니라 자기 키를 넣을 뿐이다.
   우리가 여기서 지키는 건 '이 챌린지에, 로그인한 그 사람이, 이 출처에서 답했다' 이다. */
async function authReg(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  const id = cut(c.id, 400), key = cut(c.key, 2000), alg = Number(c.alg);
  if (!id || !key || !ALGS.includes(alg)) return reply(400, '만들 수 없는 패스키입니다.', o);

  return safely(o, async () => {
    const row = await claim(env, cut(c.challenge, 100), 'reg');
    /* 챌린지를 낸 사람과 지금 등록을 마치는 사람이 같아야 한다 — 아니면
       남이 발급받은 챌린지에 내 패스키를 끼워 넣을 수 있다. */
    if (!row || row.who !== me) return reply(400, '만료되었거나 우리가 낸 요청이 아닙니다.', o);
    const bad = readClientData(c.clientDataJSON, 'webauthn.create', cut(c.challenge, 100), SITE.concat(o));
    if (bad) return reply(400, bad, o);
    const a = readAuthData(unb64u(c.authData));
    if (!a || !a.up) return reply(400, '기기가 확인해 주지 않았습니다.', o);
    if (!eq(a.rpIdHash, await sha(rpOf(o)))) return reply(400, '다른 곳에서 만든 패스키입니다.', o);

    await env.DB.prepare(
      'insert into passkey (id, who, key, alg, count, at) values (?, ?, ?, ?, ?, ?)'
    ).bind(id, me, key, alg, a.count, Date.now()).run();
    const token = await sign(env.SESSION_KEY, me);
    /* '첫 패스키인지' 가 아니라 '복구 코드가 있는지' 로 본다 — /auth/codes 로
       이미 받아 둔 사람의 코드를 여기서 말없이 갈아엎으면 안 된다(화면이
       새 코드를 안 그리면 이미 죽은 옛 코드를 유효한 줄 알고 들고 있게 된다).
       반대로 패스키가 이미 있어도 복구 코드가 하나도 없으면(안 받았거나
       전부 써서 소진됐거나) 여기서 채워 준다 — 패스키만 걸고 넘을 수단이
       없는 계정을 만들지 않는다. */
    const hasCodes = await env.DB.prepare('select 1 from recovery where who = ? limit 1').bind(me).first();
    if (hasCodes) return send(201, { token, user: me }, o);
    return send(201, { token, user: me, codes: await issueRecoveryCodes(env, me) }, o);
  });
}

/* ── SSO (Google · Apple) ────────────────────────────────
   1차 인증은 공급자가 한다. scope 를 openid 하나로 묶어 메일도 이름도 받지
   않는다 — id_token 의 sub(공급자 안에서만 뜻이 있는 불투명한 식별자) 하나가
   사람 하나를 가리킨다.

   id_token 은 각 공급자의 토큰 엔드포인트에서 TLS 로 직접 받는다(서버 대
   서버, authorization code 와 맞바꾼 값). 그래서 JWKS 로 서명을 다시 검증하지
   않는다 — OIDC Core §3.1.3.7 이 이 경로(token endpoint response)를 신뢰
   경계로 인정한다. 브라우저를 거쳐 온 id_token(예: implicit flow)이었다면
   이 가정이 깨진다 — 여긴 그 경로를 쓰지 않는다. */
const REDIRECT = 'https://g.gearservicevanguard.com/auth/cb';

const PROVIDERS = {
  google: {
    iss: ['https://accounts.google.com', 'accounts.google.com'],
    ready: env => !!(env.GOOGLE_ID && env.GOOGLE_SECRET),
    id: env => env.GOOGLE_ID,
    authURL(env, state) {
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.search = new URLSearchParams({
        client_id: env.GOOGLE_ID, redirect_uri: REDIRECT, response_type: 'code',
        scope: 'openid', state, nonce: state,
      });
      return u.toString();
    },
    async secret(env) { return env.GOOGLE_SECRET; },
    token: 'https://oauth2.googleapis.com/token',
  },
  apple: {
    iss: ['https://appleid.apple.com'],
    ready: env => !!(env.APPLE_ID && env.APPLE_KEY && env.APPLE_TEAM && env.APPLE_KID),
    id: env => env.APPLE_ID,
    authURL(env, state) {
      const u = new URL('https://appleid.apple.com/auth/authorize');
      /* scope 를 비워야 response_mode=query 를 쓸 수 있다 — email·name 을 물으면
         Apple 이 form_post 를 강제해, 그 응답을 받을 자리를 따로 둬야 한다. */
      u.search = new URLSearchParams({
        client_id: env.APPLE_ID, redirect_uri: REDIRECT, response_type: 'code',
        response_mode: 'query', state, nonce: state,
      });
      return u.toString();
    },
    async secret(env) { return appleClientSecret(env); },
    token: 'https://appleid.apple.com/auth/token',
  },
};

/* .p8 는 PEM 이다 — 머리·꼬리 줄을 떼면 남는 게 표준 base64 DER 이다.
   WebCrypto 의 pkcs8 import 는 그 DER 을 그대로 받는다. */
async function appleKey(pem) {
  const der = atob(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  return crypto.subtle.importKey('pkcs8', Uint8Array.from(der, c => c.charCodeAt(0)),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}
/* Apple 은 client_secret 을 미리 정한 값이 아니라 ES256 JWT 로 요구한다.
   요청마다 새로 지어 쓴다 — 오래 살려 둘 이유가 없다. WebCrypto ECDSA 서명은
   r||s 원시 64바이트로 바로 나온다 — JWT 서명이 원하는 모양 그대로라
   DER 변환이 필요 없다(다른 방향, 인증기 서명을 풀 때만 필요하다). */
async function appleClientSecret(env) {
  const now = Math.floor(Date.now() / 1000);
  const enc = s => b64u(new TextEncoder().encode(s));
  const signee = `${enc(JSON.stringify({ alg: 'ES256', kid: env.APPLE_KID }))}.` +
    enc(JSON.stringify({ iss: env.APPLE_TEAM, iat: now, exp: now + 300,
                          aud: 'https://appleid.apple.com', sub: env.APPLE_ID }));
  const key = await appleKey(env.APPLE_KEY);
  const sig = b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    key, new TextEncoder().encode(signee)));
  return `${signee}.${sig}`;
}

const jwtPayload = token => {
  const part = String(token ?? '').split('.')[1];
  if (!part) return null;
  try { return JSON.parse(new TextDecoder().decode(unb64u(part))); } catch { return null; }
};
const toHex = buf => [...buf].map(b => b.toString(16).padStart(2, '0')).join('');

/* bind → state, (state,tag) → take 줄의 id. 둘 다 sha256 이라 b64u 로 적으면
   32바이트 → 43자, /^[\w-]{43}$/ 와 맞아떨어진다 — 무엇을 해시했든 모양이
   같다. /auth/take·/auth/code 는 b(bind)·t(tag) 를 받아 이 두 함수로 같은
   id 를 되짚어 찾는다. */
const stateOf = async b => b64u(await sha(b));
const takeId = async (state, tag) => b64u(await sha(state + tag));

async function ssoToken(env, p, code) {
  const prov = PROVIDERS[p];
  const body = new URLSearchParams({ client_id: prov.id(env), client_secret: await prov.secret(env),
    code, grant_type: 'authorization_code', redirect_uri: REDIRECT });
  /* redirect: 'manual' — 응답을 자동으로 따라가지 않는다. "id_token 은 TLS 로
     공급자에게서 직접 받는다"(JWKS 검증을 생략하는 근거, 위 주석) 는 전제를
     그대로 코드로 고정한다. 3xx 가 오면 !r.ok 에 걸려 그냥 실패로 처리된다. */
  const r = await fetch(prov.token, { method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.id_token ?? null;
}

/* Google 의 sub 은 공급자를 넘어 고정된 전역 id 다 — 다른 곳에서 유출된
   대응표와 맞춰 보면 동일인이 드러난다. HMAC 을 씌워 이 사이트 안에서만
   뜻이 있는 값으로 접는다(Apple 은 원래 팀 단위 가명이라 덜 절실하지만 같은
   경로를 태운다 — 갈라 쓸 이유가 없다).

   SESSION_KEY 가 아니라 SUB_KEY(없으면 SESSION_KEY 로 대신한다)로 HMAC 을
   씌운다 — 두 키를 겸하면 "급하면 SESSION_KEY 를 갈아 세션만 끊는다" 는
   비상 레버가 sso 연결까지 함께 끊어 버린다(다음 로그인에서 새 빈 계정이
   생기고 옛 순위표·패스키·복구 코드가 고아가 된다). 키를 나누면 SESSION_KEY
   는 원래 하려던 일만 하고, sso 연결을 끊는 건 SUB_KEY 를 따로 갈 때뿐이다
   — 그것도 여전히 파괴적이니(schema.sql 의 sso 표 주석) 쓸 일이 있을 때만. */
async function hmacSub(env, provider, sub) {
  const sig = await crypto.subtle.sign('HMAC', await mac(env.SUB_KEY || env.SESSION_KEY),
    new TextEncoder().encode(`${provider}:${sub}`));
  return toHex(new Uint8Array(sig));
}

async function authSso(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const p = Object.hasOwn(PROVIDERS, c.p) ? c.p : null;
  const s = cut(c.s, 60);
  if (!p || !/^[\w-]{43}$/.test(s)) return reply(400, '요청이 이상합니다.', o);
  if (!PROVIDERS[p].ready(env)) return nokey(o);
  const me = await sessionWho(env, req);   // 있으면 기존 계정에 공급자를 더 붙이는 것이다
  return safely(o, async () => {
    await challenge(env, `sso-${p}`, me, { id: s, back: o });
    return send(200, { url: PROVIDERS[p].authURL(env, s) }, o);
  });
}

/* 이 응답 하나로 브라우저를 돌려보낸다 — 경로는 여기 고정한 값뿐이고,
   오리진만 pending.back(허용 목록을 통과한 값) 에서 읽는다. 사용자가 보낸
   값으로 경로나 오리진을 짓지 않는다 — 그러면 오픈 리다이렉트가 된다.
   frag 는 이 함수를 부르는 쪽이 통째로 준다('signin=fail' 처럼) — /auth/cb
   의 성공 케이스만 뒤에 '&t=…' 를 붙인다. */
const redir = (origin, frag) => new Response(null, { status: 302, headers: {
  location: `${origin}/signin/#${frag}`,
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
} });

/* 공급자가 GET 으로 돌려보내는 자리. fetch() 안에서 origin 검사보다 앞서 불린다
   — 그 예외는 이 함수 하나로 끝난다, 아래 fetch() 의 주석을 함께 본다.

   여기서는 계정을 만들거나 sso 를 엮지 않는다 — 이 GET 을 받은 브라우저가
   /auth/sso 를 부른 그 브라우저라는 보장이 없다. state 는 누구든 자기 bind 로
   /auth/sso 를 불러 미리 만들 수 있는 값이라, state 만으로 다음 단계를 열어
   주면 "내가 만든 동의 링크를 남에게 보내 그 사람이 완성한 로그인을 가로채기"
   가 된다. 대신 tag 를 새로 내어 이 302 의 URL 프래그먼트로만 돌려준다 —
   프래그먼트는 서버 로그에도 Referer 에도 안 실리므로, 이 302 를 실제로 받은
   브라우저만 tag 를 안다. /auth/take 가 bind(state 로 되짚어짐)와 tag 를
   함께 대야 다음 줄을 열 수 있다(schema.sql 의 pending 표 주석 참고). */
async function authCb(req, env) {
  const u = new URL(req.url);
  const state = cut(u.searchParams.get('state'), 60);
  if (!/^[\w-]{43}$/.test(state)) return redir(SITE[0], 'signin=fail');

  const row = await claim(env, state);   // kind 를 모르니 id 로만 찾는다
  const back = row?.back && allowedOrigin(row.back) ? row.back : SITE[0];
  if (u.searchParams.get('error')) return redir(back, 'signin=cancel');
  if (!row || !String(row.kind).startsWith('sso-')) return redir(back, 'signin=fail');

  const p = row.kind.slice(4);
  const prov = PROVIDERS[p];
  const code = cut(u.searchParams.get('code'), 2000);
  if (!prov || !prov.ready(env) || !code) return redir(back, 'signin=fail');

  try {
    const idToken = await ssoToken(env, p, code);
    const claims = idToken && jwtPayload(idToken);
    if (!claims || !prov.iss.includes(claims.iss) || claims.aud !== prov.id(env)
        || !(claims.exp > Date.now() / 1000) || claims.nonce !== state || !claims.sub)
      return redir(back, 'signin=fail');

    const tag = rand(32);
    const id = await takeId(state, tag);
    const sub = await hmacSub(env, p, claims.sub);
    /* row.who: /auth/sso 를 부를 때 로그인해 있었으면 그 계정. 계정 조회·
       생성은 여기서 하지 않고 provider·sub 만 넘겨 둔다 — bind+tag 증명 뒤
       (/auth/take) 로 미룬다. */
    await challenge(env, 'take', row.who, { id, sub, provider: p });
    return redir(back, `signin=ok&t=${tag}`);
  } catch {
    return redir(back, 'signin=fail');
  }
}

/* 돌아온 뒤 토큰을 받는 자리 — bind(b)와 authCb 가 프래그먼트로만 돌려준
   tag(t)를 함께 대야 한다. 계정 조회·생성·sso 연결을 실제로 하는 곳이 여기다.
   계정에 패스키가 하나라도 있으면 2단계를 더 요구한다 — SSO 는 '그 메일함·
   그 기기의 생체인증을 통과했다' 이상을 보장하지 않으니, 패스키를 만들어 둔
   사람에게는 그 위에 한 겹을 더 씌운다. */
async function authTake(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const b = cut(c.b, 200), t = cut(c.t, 60);
  if (!b || !/^[\w-]{43}$/.test(t)) return reply(400, '요청이 이상합니다.', o);
  return safely(o, async () => {
    const id = await takeId(await stateOf(b), t);
    const row = await claim(env, id, 'take');
    if (!row || !row.provider || !row.sub) return reply(400, '만료되었거나 우리가 낸 요청이 아닙니다.', o);

    const found = await env.DB.prepare('select who from sso where provider = ? and sub = ?')
      .bind(row.provider, row.sub).first();
    let who;
    if (found?.who) {
      /* 이미 다른 계정에 붙어 있는 공급자다. 지금 로그인해 있는 계정과 다르면
         조용히 갈아타지 않는다 — 공격자가 로그인한 채로 이 흐름을 밟으면
         피해자의 sub 을 공격자 계정에 몰래 엮을 길이 되기 때문이다. */
      if (row.who && row.who !== found.who)
        return send(409, { msg: '이미 다른 계정에 연결된 공급자입니다.', taken: true }, o);
      who = found.who;
    } else {
      who = row.who || hex(16);
      await env.DB.batch([
        env.DB.prepare('insert or ignore into user (id, mail, at) values (?, null, ?)').bind(who, Date.now()),
        env.DB.prepare('insert into sso (provider, sub, who, at) values (?, ?, ?, ?)')
          .bind(row.provider, row.sub, who, Date.now()),
      ]);
    }

    const has = await env.DB.prepare('select 1 from passkey where who = ? limit 1').bind(who).first();
    if (has) {
      /* 같은 id 를 그대로 이어 쓴다 — /auth/log 는 이 값을 challenge 로 받고,
         /auth/code 는 브라우저가 들고 있는 b·t 에서 같은 값을 다시 계산해 찾는다. */
      await challenge(env, 'two', who, { id });
      return send(200, { need: 'passkey', challenge: id }, o);
    }
    return send(200, { token: await sign(env.SESSION_KEY, who) }, o);
  });
}

/* 2단계: 패스키로 넘는다. SSO 뒤 확인 전용이라 who 를 스스로 정하지 않는다 —
   /auth/take 가 pending 에 적어 둔 그 계정과, 이 패스키의 주인이 같아야 한다.
   claim 대신 peekTwo 를 쓴다 — 서명이 틀리거나 사용자가 취소해도 줄을 지우지
   않아야 복구 코드로 갈아탈 수 있다(성공했을 때만 consumeTwo 로 지운다). */
async function authLog(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const id = cut(c.id, 400), chal = cut(c.challenge, 100);
  return safely(o, async () => {
    const row = await peekTwo(env, chal);
    if (!row) return reply(400, '만료되었거나 우리가 낸 요청이 아닙니다.', o);
    const bad = readClientData(c.clientDataJSON, 'webauthn.get', chal, SITE.concat(o));
    if (bad) return reply(400, bad, o);
    const a = readAuthData(unb64u(c.authData));
    if (!a || !a.up) return reply(400, '기기가 확인해 주지 않았습니다.', o);
    if (!eq(a.rpIdHash, await sha(rpOf(o)))) return reply(400, '다른 곳의 패스키입니다.', o);

    const k = await env.DB.prepare('select who, key, alg, count from passkey where id = ?')
      .bind(id).first();
    if (!k) return reply(401, '모르는 패스키입니다.', o);
    if (k.who !== row.who) return reply(401, '이 계정의 패스키가 아닙니다.', o);
    const ok = await verify({ alg: k.alg, key: k.key, authData: c.authData,
                              clientDataJSON: c.clientDataJSON, signature: cut(c.sig, 2000) });
    if (!ok) return reply(401, '서명이 맞지 않습니다.', o);
    /* 셈이 뒤로 가면 복제된 기기다. 0 을 그대로 두는 인증기가 많아 0 은 안 본다 */
    if (a.count && k.count && a.count <= k.count) return reply(401, '복제된 기기로 보입니다.', o);
    await env.DB.prepare('update passkey set count = ? where id = ?').bind(a.count, id).run();
    await consumeTwo(env, chal);
    return send(200, { token: await sign(env.SESSION_KEY, k.who), user: k.who }, o);
  });
}

/* 2단계: 복구 코드로 넘는다. 패스키를 잃어버린(또는 아예 안 가진 다른 기기의)
   사람을 위한 비상구다. 코드는 그 자체가 고엔트로피 난수(10글자, 약 50비트)라
   사전공격을 걱정할 이유가 없다 — 비밀번호처럼 느린 KDF 를 씌울 이유가 없어
   기존 sha() 한 번으로 충분하고, RL_AU 만으로도 무차별 대입은 막힌다. */
async function authCode(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const b = cut(c.b, 200), t = cut(c.t, 60), code = cut(c.code, 20).toLowerCase();
  if (!b || !/^[\w-]{43}$/.test(t) || !/^[a-z0-9]{10}$/.test(code))
    return reply(400, '요청이 이상합니다.', o);
  return safely(o, async () => {
    const id = await takeId(await stateOf(b), t);
    const row = await peekTwo(env, id);
    if (!row) return reply(400, '만료되었거나 우리가 낸 요청이 아닙니다.', o);
    const h = toHex(await sha(code));
    const r = await env.DB.prepare('select who from recovery where hash = ?').bind(h).first();
    if (!r || r.who !== row.who) return reply(401, '맞지 않는 코드입니다.', o);
    /* 쓰면 지운다 — 복구 코드는 한 번만 쓴다 */
    await env.DB.prepare('delete from recovery where hash = ?').bind(h).run();
    await consumeTwo(env, id);
    return send(200, { token: await sign(env.SESSION_KEY, r.who) }, o);
  });
}

/* 복구 코드를 새로 짓고(8개, 10글자, 소문자+숫자 ≈ 50비트) 그 계정의 옛 코드는
   전부 지운 뒤 심는다 — 재발급은 전량 교체다, 안 그러면 옛 코드가 계속 살아
   남는다. crypto 바이트 하나(0~255)를 36 으로 그냥 나누면 앞쪽 글자가 살짝
   더 잘 나온다(256 이 36 의 배수가 아니라서) — 252(=36×7) 를 넘는 값은 버린다. */
const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';   // 36자
async function issueRecoveryCodes(env, who) {
  const pick = () => {
    let b;
    do { b = crypto.getRandomValues(new Uint8Array(1))[0]; } while (b >= 252);
    return CODE_ALPHABET[b % 36];
  };
  const codes = Array.from({ length: 8 }, () => Array.from({ length: 10 }, pick).join(''));
  const now = Date.now();
  const hashes = await Promise.all(codes.map(code => sha(code).then(toHex)));
  await env.DB.batch([
    env.DB.prepare('delete from recovery where who = ?').bind(who),
    ...hashes.map(h => env.DB.prepare(
      'insert into recovery (hash, who, at) values (?, ?, ?)').bind(h, who, now)),
  ]);
  return codes;
}

async function authCodes(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  return safely(o, async () => send(200, { codes: await issueRecoveryCodes(env, me) }, o));
}

/* 계정 화면이 볼 값. 이 기기의 localStorage 만으로는 다른 기기에서 만든
   패스키나 거기서 쓴 복구 코드를 알 수 없다 — 특히 "남은 비상구가 몇 개"는
   틀리면 안 되는 숫자라 여기서 세어 준다. 개수만 내보낸다 — who·sub·해시·
   자격증명 id 같이 사람을 가리키는 값은 하나도 싣지 않는다. */
async function authMe(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  return safely(o, async () => {
    const [keys, codes] = await env.DB.batch([
      env.DB.prepare('select count(*) as n from passkey where who = ?').bind(me),
      env.DB.prepare('select count(*) as n from recovery where who = ?').bind(me),
    ]);
    return send(200, { keys: keys.results[0]?.n ?? 0, codes: codes.results[0]?.n ?? 0 }, o);
  });
}

export function regionOf(cf, accept) {
  const c = String(cf?.country || '');
  const country = /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : '';
  const timezone = String(cf?.timezone || '').replace(/[^\w/+\-]/g, '').slice(0, 64);
  const lang = String(accept || '').split(',')[0].trim().slice(0, 35);
  return { country, timezone, lang };
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;

    /* GET /auth/cb 는 fetch() 의 origin 검사(mine()) 보다 앞에 둔 유일한 예외다.
       공급자가 브라우저를 여기로 돌려보내는 요청은 최상위 내비게이션(GET) 이라
       Origin 헤더가 없다 — 거기서 mine() 을 들이대면 모든 로그인이 403 으로
       막힌다. 대신 여기서 지키는 건 출처가 아니라 state 가 우리가 낸 값인지
       (claim), 그리고 돌아갈 곳은 pending.back(허용 목록을 통과한 값) 에서만
       읽는다는 것 — 이 한 경로만의 예외이고, 범위는 이 if 블록 안뿐이다. */
    if (path === '/auth/cb' && req.method === 'GET') {
      if (!env.DB || !env.SESSION_KEY) return redir(SITE[0], 'signin=fail');
      /* 존 단위 레이트리밋(harden-zone.mjs)은 POST 만 센다 — GET 인 이 경로는
         여기서 직접 세지 않으면 아무 창도 없이 열린다. RL_AU 와 나눠 쓰지 않고
         전용 창(RL_CB)을 쓴다 — 같이 쓰면 /auth/sso·take·log 가 먹는 예산을
         이 GET 이 깎아 먹는다. 창에 걸린 건 실패가 아니라 '잠깐 뒤' 다 —
         Google/Apple 이 이미 code 를 태운 뒤라 fail 로 보내면 처음부터 다시
         해야 한다. */
      const ok = await pass(env.RL_CB, ip(req));
      if (ok === false) return redir(SITE[0], 'signin=busy');
      if (ok !== true) return redir(SITE[0], 'signin=fail');
      return authCb(req, env);
    }

    const o = req.headers.get('origin') || refererOrigin(req);
    /* 이 분기는 path 를 보지 않는다 — 아래에서 어떤 경로를 새로 붙이든(예:
       /auth/sso, /auth/me) 프리플라이트는 자동으로 같이 열린다. 경로별로
       따로 등록해야 하는 목록이 아니다 — 빠뜨릴 자리가 없다. */
    if (req.method === 'OPTIONS') {
      if (!mine(o)) return new Response(null, { status: 403, headers: head(o) });
      return new Response(null, { status: 204, headers: head(o) });
    }
    if (!mine(o)) return reply(403, '허용된 곳이 아닙니다.', o);

    if (path === '/' && req.method === 'POST') return feedback(req, env, o);
    if (path === '/turnstile' && req.method === 'GET') return turnstileConfig(env, o);
    if (path === '/where' && req.method === 'GET') {
      return send(200, regionOf(req.cf, req.headers.get('accept-language')), o);
    }

    if (path.startsWith('/auth/')) {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      if (!env.SESSION_KEY) return nokey(o);
      /* /auth/me 는 GET 이지만 나머지 /auth/* 와 같은 창(RL_AU)을 쓴다 —
         출처 검사도 위에서 이미 걸렸다. 계정 정보 조회라고 창을 열어 둘
         이유가 없다. */
      if (req.method === 'POST' || (req.method === 'GET' && path === '/auth/me')) {
        /* 로그인 시도도 창을 센다 — 패스키를 찍어 맞히거나 복구 코드를 찍어
           맞히려는 반복을 막는다. 점수 창(분당 3)과 나눠 쓰면 등록 두 번에
           다 써버려 정작 못 올린다 */
        const ok = await pass(env.RL_AU, ip(req));
        if (ok !== true) return shut(ok, o);
        if (path === '/auth/me') return authMe(req, env, o);
        if (path === '/auth/new') return authNew(req, env, o);
        if (path === '/auth/reg') return authReg(req, env, o);
        if (path === '/auth/sso') return authSso(req, env, o);
        if (path === '/auth/take') return authTake(req, env, o);
        if (path === '/auth/log') return authLog(req, env, o);
        if (path === '/auth/code') return authCode(req, env, o);
        if (path === '/auth/codes') return authCodes(req, env, o);
      }
    }
    /* 순위표는 D1 을 붙이기 전에도 사이트가 멀쩡해야 한다 — 없으면 없다고만 한다 */
    if (path === '/top' || path === '/dist' || path === '/score' || path === '/forget') {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      if (path === '/top' && req.method === 'GET') return top(req, env, o);
      if (path === '/dist' && req.method === 'POST') return dist(req, env, o);
      if (path === '/score' && req.method === 'POST') return post(req, env, o);
      if (path === '/forget' && req.method === 'POST') return forget(req, env, o);
    }
    return reply(405, '받지 않는 요청입니다.', o);
  },
};
