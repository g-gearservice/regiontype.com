/* regiontype 중계기 — 정적 사이트가 혼자 못 하는 두 가지만 한다. 도메인은
   g.gearservicevanguard.com 이다(workers.dev 문은 닫혀 있다 — wrangler.toml 참고).

     POST /         피드백을 GitHub 이슈로 옮긴다 (토큰을 사이트에 둘 수 없다)
     POST /score    판 하나의 점수를 순위표에 올린다
     GET  /top      그 판의 상위 기록을 읽는다
     POST /dist     그 판의 점수 분포와 그 안에서 내가 선 자리
     POST /forget   내 줄을 전부 내린다 (순위표·경쟁전·전적)
     POST /ranked/start {c,name}  경쟁전 표를 낸다. 끝내지 않은 옛 표는 탈주로 셈한다
     POST /ranked/end   {id,score,hits,tries}  표를 태우고 lp 를 오르내린다
     POST /played   일반전 한 판을 전적에 남긴다
     GET  /games    내 사다리 줄과 최근 판들 (로그인 필요)
     GET  /ladder   경쟁전 상위 50

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
const CAP = { body: 500, v: 16, href: 300, ua: 300, name: 12, bio: 60, handle: 16, botname: 12 };
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
  const [score, hits, tries, cpm] = [c.score, c.hits, c.tries, c.cpm].map(Number);
  const int = n => Number.isInteger(n) && n >= 0;
  const ok = w.ok && !!name && /^[a-z0-9]{8,64}$/.test(who)
    && int(score) && int(hits) && int(tries) && int(cpm)
    /* 속도는 분당 타수(키 수, 한글은 자모)다. 천장 둘은 app.js 의 cpmNow 가 쓰는 것과
       같은 값이어야 한다 — 한 곳당 50 은 아무리 빨라도 못 넘는 자고(가장 긴 지명이
       확정 키까지 45타다), 1500(=300 WPM)은 사람의 천장이다. 이 둘이 없으면 한 곳만
       맞히고 아무 속도나 적어 보낼 수 있다 */
    && cpm <= Math.min(1500, hits * 50)
    /* 한 곳당 최대 100점 × 콤보 5배. 상한은 둘이 함께 정한다 — 코스에 있는
       곳보다 많이 들를 수 없고, 한 곳을 치는 데 아무리 빨라도 0.5초는 든다. */
    && hits <= tries && tries <= w.secs * 8 && hits <= Math.min(w.size, w.secs * 2)
    && score % 100 === 0 && score <= Math.min(hits * 500, w.secs * 1000);
  return { ...w, name, who, score, hits, tries, cpm, ok,
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

/* 순위는 타자 속도로 세운다 — 들른 곳 수가 아니라 얼마나 빨리 쳤는가다.
   동점이면 먼저 올린 쪽이 앞이다 */
/* 비공개(profile.shut)로 둔 사람은 이름 자리가 빈다. 쓰는 자리에서 지우지 않고
   읽는 자리에서 가리는 이유: 기록을 올리는 길이 /score·/ranked/end·/auth/profile
   셋이라 한 곳만 막으면 다음 판에 도로 박힌다. 읽는 쿼리는 여기 둘뿐이다.
   기록(cpm·순위)은 그대로 선다 — 가리는 것은 이름 하나다. */
const board = (env, w) => env.DB.prepare(
  `select b.who as who, case when p.shut = 1 then '' else b.name end as name,
          b.cpm as cpm, b.score as score, b.hits as hits, b.acc as acc
     from speed b left join profile p on p.who = b.who
    where b.slug = ? and b.secs = ? order by b.cpm desc, b.at asc limit ?`
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
         ' from speed where slug = ? and secs = ? group by b order by b'
      ).bind(bucket, w.slug, w.secs),
      env.DB.prepare('select count(*) as n from speed where slug = ? and secs = ?').bind(w.slug, w.secs),
      env.DB.prepare('select score from speed where slug = ? and secs = ? and who = ?')
        .bind(w.slug, w.secs, me ?? ''),
    ]);
    const score = mine.results[0]?.score ?? null;
    let over = null;
    if (score !== null) {
      const r = await env.DB.prepare(
        'select count(*) as n from speed where slug = ? and secs = ? and score > ?'
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
        `insert into speed (slug, secs, who, name, cpm, score, hits, acc, at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (slug, secs, who) do update set
           /* 이름만은 기록과 무관하게 바뀐다. 이걸 기록 조건에 묶어두면 잘못 적은
              본명을 지우려고 자기 최고 기록을 깨야 한다 — 사실상 철회 불가가 된다. */
           name  = excluded.name,
           cpm   = max(speed.cpm, excluded.cpm),
           score = case when excluded.cpm > speed.cpm then excluded.score else speed.score end,
           hits  = case when excluded.cpm > speed.cpm then excluded.hits else speed.hits end,
           acc   = case when excluded.cpm > speed.cpm then excluded.acc  else speed.acc  end,
           at    = case when excluded.cpm > speed.cpm then excluded.at   else speed.at   end`
      ).bind(e.slug, e.secs, e.who, e.name, e.cpm, e.score, e.hits, e.acc, Date.now()),
      /* coalesce 가 없으면 그 줄이 없을 때 score > NULL 이 NULL 이 되어 조용히 1위가 된다 */
      env.DB.prepare(
        `select count(*) + 1 as n from speed where slug = ? and secs = ? and cpm >
           coalesce((select cpm from speed where slug = ? and secs = ? and who = ?), -1)`
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
  /* 이름이 걸린 곳은 전부 내린다 — 경쟁전 사다리와 전적도 같은 사람의 것이다 */
  return safely(o, async () => {
    const [r] = await env.DB.batch(['speed', 'board', 'ladder', 'played', 'ticket']
      .map(tb => env.DB.prepare(`delete from ${tb} where who = ?`).bind(who)));
    return send(200, { gone: r.meta?.changes ?? 0 }, o);
  });
}

/* ── 경쟁전 ──────────────────────────────────────────────
   혼자 치는 게임이라 맞상대가 없다. 그래서 이긴다·진다를 "이 티어에서 기대하는
   속도를 넘었나"로 정한다(TypeClash 의 티어별 기대 WPM 과 같은 결).
     속도  = 분당 타수(CPM). 코스가 달라도 견줄 수 있는 유일한 값이다
     기대  = WANT[티어]                       브론즈 100 … 마스터 350 CPM
     lp    = (속도 − 기대) × .4 × K × 정확도 배율   K 는 배치 5판 동안 2, 그 뒤 1
   정확도는 얻는 쪽만 깎는다(95%↑ ×1 · 90 ×.8 · 85 ×.6 · 80 ×.4 · 그 아래는 이겨도 잃는다).
   이기면 최소 +3, 지면 최소 −5, 한 판에 ±50 을 넘지 않는다. 탈주는 −25.
   하루(24시간)에 얻는 lp 는 200 까지다.
   제한 시간은 120초로 못 박는다 — 판마다 조건이 같아야 견줄 수 있다. */
export const RANKED_SECS = 120;
const STEP = 100, PLACE = 5, QUIT = 25, KEEP = 50, DAY_CAP = 200;
/* 티어마다 기대하는 속도(CPM). 위로 갈수록 너비가 같아 한 계단이 50 CPM 이다.
   음절로 세던 옛 값(40…140)에 2.5 를 곱했다 — 한국 지명은 확정 키까지 음절당 2.8타,
   약칭을 치면 그보다 적다.
   ponytail: 서울 코스의 어림값이다. 판이 쌓이면 실제 분포의 분위수로 다시 잡는다 */
export const WANT = [100, 150, 200, 250, 300, 350];
export function lpDelta(lp, games, cpm, acc) {
  const want = WANT[Math.min(WANT.length - 1, Math.floor(lp / STEP))];
  const raw = (cpm - want) * .4 * (games < PLACE ? 2 : 1);
  const mod = acc >= 95 ? 1 : acc >= 90 ? .8 : acc >= 85 ? .6 : acc >= 80 ? .4 : -.5;
  let d = Math.round(raw >= 0 ? raw * mod : raw);
  d = d > 0 || (d === 0 && mod > 0) ? Math.max(3, d) : Math.min(-5, d);
  return Math.max(-lp, Math.max(-50, Math.min(50, d)));
}
/* 끝난 판이 앞뒤가 맞는지. 표를 낸 코스·시간으로만 본다 — 몸통의 c·t 는 무시한다.
   다 치지 않았으면 120초가 지나야 하고, 다 쳤으면 한 곳에 0.5초는 들었어야 한다 */
export function rankedCheck(c, tk, now, who) {
  const e = entry({ ...c, c: tk.slug, t: RANKED_SECS }, who);
  const took = now - tk.at;
  const need = e.hits >= (SIZE[tk.slug] || 0) ? e.hits * 500 : RANKED_SECS * 1000;
  return { ...e, ok: e.ok && c.id === tk.id && took >= need && took <= 10 * 60e3 };
}
/* 판 한 줄을 적고 그 사람의 옛 줄을 50 판에서 자른다 */
const logPlay = (env, who, mode, slug, secs, e, delta, at) => [
  env.DB.prepare('insert into played (who, mode, slug, secs, cpm, score, hits, acc, delta, at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(who, mode, slug, secs, e.cpm, e.score, e.hits, e.acc, delta, at),
  env.DB.prepare('delete from played where who = ? and rowid not in (select rowid from played where who = ? order by at desc limit ?)')
    .bind(who, who, KEEP),
];

async function rankedStart(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '경쟁전은 로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const slug = cut(c.c, 40), name = plain(c.name, CAP.name);
  if (!Object.hasOwn(SIZE, slug) || !name) return reply(400, '시작할 수 없는 판입니다.', o);
  const ok = await pass(env.RL_RK, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    const now = Date.now(), id = rand(18);
    const [old, row] = await env.DB.batch([
      env.DB.prepare('select slug from ticket where who = ?').bind(me),
      env.DB.prepare('select lp from ladder where who = ?').bind(me),
    ]);
    const tk = old.results[0], lp = row.results[0]?.lp ?? 0;
    const quit = tk ? -Math.min(QUIT, lp) : 0;
    await env.DB.batch([
      env.DB.prepare(`insert into ladder (who, name, lp, games, wins, at) values (?, ?, 0, 0, 0, ?)
                      on conflict (who) do update set name = excluded.name`).bind(me, name, now),
      ...(tk ? [
        env.DB.prepare('update ladder set lp = lp + ?, games = games + 1, at = ? where who = ?').bind(quit, now, me),
        ...logPlay(env, me, 'ranked', tk.slug, RANKED_SECS, { cpm: 0, score: 0, hits: 0, acc: 0 }, quit, now),
      ] : []),
      env.DB.prepare(`insert into ticket (who, id, slug, at) values (?, ?, ?, ?)
                      on conflict (who) do update set id = excluded.id, slug = excluded.slug, at = excluded.at`)
        .bind(me, id, slug, now),
    ]);
    return send(201, { id, secs: RANKED_SECS, quit }, o);
  });
}

async function rankedEnd(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const ok = await pass(env.RL_RK, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    const now = Date.now();
    /* 표를 먼저 태운다 — 한 줄을 돌려받은 요청만 이어 간다. 같은 표로 두 번
       동시에 끝내도 한 번만 셈된다 */
    const tk = await env.DB.prepare('delete from ticket where who = ? and id = ? returning slug, at')
      .bind(me, cut(c.id, 40)).first();
    if (!tk) return reply(409, '끝낼 경쟁전이 없습니다.', o);
    const [row, day] = await env.DB.batch([
      env.DB.prepare('select name, lp, games from ladder where who = ?').bind(me),
      env.DB.prepare("select coalesce(sum(delta), 0) as n from played where who = ? and mode = 'ranked' and delta > 0 and at > ?")
        .bind(me, now - 864e5),
    ]);
    const lad = row.results[0];
    if (!lad) return reply(409, '끝낼 경쟁전이 없습니다.', o);
    const e = rankedCheck({ ...c, name: lad.name }, { ...tk, id: c.id }, now, me);
    /* 앞뒤가 안 맞는 판은 탈주와 같게 셈한다 — 표는 이미 탔다 */
    let d = e.ok ? lpDelta(lad.lp, lad.games, e.cpm, e.acc) : -Math.min(QUIT, lad.lp);
    /* 채점이 브라우저에 있어 잘 지은 만점을 가릴 수 없다. 하루에 얻는 lp 에 뚜껑을
       덮어 거짓말 한 번의 값을 줄인다.
       ponytail: 뚜껑은 속도만 늦춘다. 사다리가 시달리면 채점(타건 기록 검증)을 서버로 옮긴다 */
    if (d > 0) d = Math.max(0, Math.min(d, DAY_CAP - (day.results[0]?.n ?? 0)));
    await env.DB.batch([
      env.DB.prepare('update ladder set lp = lp + ?, games = games + 1, wins = wins + ?, at = ? where who = ?')
        .bind(d, d > 0 ? 1 : 0, now, me),
      ...logPlay(env, me, 'ranked', tk.slug, RANKED_SECS, e.ok ? e : { cpm: 0, score: 0, hits: 0, acc: 0 }, d, now),
    ]);
    if (!e.ok) return reply(400, '올릴 수 없는 기록입니다.', o);
    return send(200, { delta: d, lp: lad.lp + d, games: lad.games + 1 }, o);
  });
}

/* 일반전 한 판을 전적에 남긴다. 이름은 받지 않는다 — 전적은 본인만 본다 */
async function playedNormal(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  /* entry 는 공개 이름을 요구한다. 여기는 이름이 안 남으니 자리만 채운다 */
  const e = entry({ ...c, name: '-' }, me);
  if (!e.ok) return reply(400, '올릴 수 없는 기록입니다.', o);
  const ok = await pass(env.RL_SC, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    await env.DB.batch(logPlay(env, me, 'normal', e.slug, e.secs, e, null, Date.now()));
    return send(201, {}, o);
  });
}

/* 내 전적 — 사다리 한 줄과 최근 판들. who 는 싣지 않는다 */
async function myGames(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  return safely(o, async () => {
    const [lad, list, above] = await env.DB.batch([
      env.DB.prepare('select name, lp, games, wins from ladder where who = ?').bind(me),
      env.DB.prepare('select mode, slug, secs, cpm, score, hits, acc, delta, at from played where who = ? order by at desc limit ?')
        .bind(me, KEEP),
      env.DB.prepare(`select count(*) + 1 as n from ladder where games >= ? and lp >
                      coalesce((select lp from ladder where who = ?), 1e9)`).bind(PLACE, me),
    ]);
    const r = lad.results[0] || null;
    return send(200, { ladder: r && { ...r, rank: r.games >= PLACE ? above.results[0]?.n ?? null : null },
                       place: PLACE, step: STEP, games: list.results }, o);
  });
}

/* 경쟁전 순위. 배치 5판을 마친 사람만 오른다 */
async function ladderTop(req, env, o) {
  const me = await sessionWho(env, req);
  return safely(o, async () => {
    const { results } = await env.DB.prepare(
      `select l.who as who, case when p.shut = 1 then '' else l.name end as name,
              l.lp as lp, l.games as games, l.wins as wins
         from ladder l left join profile p on p.who = l.who
        where l.games >= ? order by l.lp desc, l.at asc limit 50`
    ).bind(PLACE).all();
    return send(200, { top: seen(results, me), place: PLACE, step: STEP }, o);
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

/* 패스키를 만들기 전에 브라우저가 알아야 할 것들. keys 는 이 계정이 이미 가진
   credential id 들이다 — excludeCredentials 에 실으면 같은 기기에서 두 번 만들
   때 새 줄이 아니라 "이미 있습니다" 가 뜬다. 그게 없으면 한 사람의 열쇠고리에
   같은 사이트가 여러 줄로 쌓여, 어느 줄이 어느 계정인지 알 길이 없어진다.
   name 은 열쇠고리에 걸릴 이름이다 — 정해 둔 아이디·닉네임이 있으면 그것을 쓴다.
   없을 때만 계정 id 앞 여섯 자로 떨어진다. */
async function authNew(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  return safely(o, async () => {
    const [keys, row] = await env.DB.batch([
      env.DB.prepare('select id from passkey where who = ?').bind(me),
      env.DB.prepare('select handle, name from profile where who = ?').bind(me),
    ]);
    const p = row.results[0] || {};
    return send(200, {
      challenge: await challenge(env, 'reg', me),
      rp: { id: rpOf(o), name: RPNAME },
      user: me,
      keys: keys.results.map(k => k.id),
      name: p.handle ? '@' + p.handle : (p.name || ''),
    }, o);
  });
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
    let who, isNewAccount = false;
    if (found?.who) {
      /* 이미 다른 계정에 붙어 있는 공급자다. 지금 로그인해 있는 계정과 다르면
         조용히 갈아타지 않는다 — 공격자가 로그인한 채로 이 흐름을 밟으면
         피해자의 sub 을 공격자 계정에 몰래 엮을 길이 되기 때문이다. */
      if (row.who && row.who !== found.who)
        return send(409, { msg: '이미 다른 계정에 연결된 공급자입니다.', taken: true }, o);
      who = found.who;
    } else {
      who = row.who || hex(16);
      const created = await env.DB.batch([
        env.DB.prepare('insert or ignore into user (id, mail, at) values (?, null, ?)').bind(who, Date.now()),
        env.DB.prepare('insert into sso (provider, sub, who, at) values (?, ?, ?, ?)')
          .bind(row.provider, row.sub, who, Date.now()),
      ]);
      // 성공한 원자적 생성 결과만 센다. 공급자 추가·기존 계정 로그인은 제외한다.
      isNewAccount = !row.who && created[0]?.meta?.changes === 1;
    }

    const has = await env.DB.prepare('select 1 from passkey where who = ? limit 1').bind(who).first();
    if (has) {
      /* 같은 id 를 그대로 이어 쓴다 — /auth/log 는 이 값을 challenge 로 받고,
         /auth/code 는 브라우저가 들고 있는 b·t 에서 같은 값을 다시 계산해 찾는다. */
      await challenge(env, 'two', who, { id });
      return send(200, { need: 'passkey', challenge: id }, o);
    }
    return send(200, { token: await sign(env.SESSION_KEY, who), isNewAccount }, o);
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
/* 프로필 한 장. 남 앞에 걸릴 값이라 이름과 같은 규칙으로 보이지 않는 글자를 턴다.
   캐릭터(face)는 어떤 말이 있는지 여기서 세지 않는다 — 모양만 보고 넘기고, 모르는
   값이면 화면(account.js)이 자기 기본값으로 떨어뜨린다. 목록을 두 곳에 두면
   캐릭터를 하나 더할 때마다 워커를 같이 배포해야 한다. */
/* 아무도 가져갈 수 없는 아이디. handle 은 화면에 @… 로 걸리므로(가입 안내의
   요약, 패스키 이름) 이 말들을 내주면 그대로 사칭 통로가 된다. 목록이지 규칙이
   아니다 — 늘릴 일이 생기면 여기 한 줄을 더한다. */
const KEPT = new Set(['admin', 'administrator', 'root', 'staff', 'support', 'help',
  'system', 'official', 'regiontype', 'moderator', 'mod', 'security', 'billing',
  'api', 'www', 'mail', 'null', 'undefined', 'me', 'you', 'anonymous']);

export function profile(c) {
  const slug = s => /^[a-z]{1,16}$/.test(String(s ?? '')) ? String(s) : '';
  /* face 는 두 모양으로 온다 — 객체({shape,expression,colour})거나, 이미 이어
     붙인 'shape,expression,colour' 문자열이거나. 화면 둘이 서로 다르게 보내던
     것을 여기서 한 번에 받는다(문자열을 객체만 받게 두면 캐릭터가 ',,' 로
     저장돼, 고른 모습이 조용히 사라졌다). */
  const f = typeof c?.face === 'string'
    ? (([shape, expression, colour]) => ({ shape, expression, colour }))(c.face.split(','))
    : (c?.face && typeof c.face === 'object' ? c.face : {});
  const lang = String(c?.lang ?? '');
  /* 아이디는 이름과 규칙이 다르다 — 남 앞에 주소처럼 걸리는 값이라 소문자·숫자·
     밑줄만 받고, 모양이 안 맞으면 다듬지 않고 통째로 버린다(빈 값 = 아직 안 정함).
     조용히 깎아 주면 사람이 친 것과 저장된 것이 달라진다. */
  /* 한도(16)에서 자른 뒤에 모양을 보면 스무 자를 친 사람이 열여섯 자짜리 남의
     아이디를 조용히 받아 가게 된다. 넉넉히 자른 다음 모양을 본다 — 길이도 모양의
     일부다(자르는 건 정규식이 폭주하지 않게 두는 울타리일 뿐이다). */
  const handle = cut(c?.handle, 64).toLowerCase();
  return {
    name: plain(c?.name, CAP.name),
    bio:  plain(c?.bio, CAP.bio),
    face: [slug(f.shape), slug(f.expression), slug(f.colour)].join(','),
    lang: /^[a-z]{2}$/.test(lang) ? lang : 'auto',
    handle: /^[a-z0-9_]{3,16}$/.test(handle) && !KEPT.has(handle) ? handle : '',
    botname: plain(c?.botname, CAP.botname),
    /* 두 스위치는 켬/끔이다. 안 보낸 것과 끈 것을 가르지 않는다 — 화면이 늘
       지금 상태를 통째로 보내므로, 빠진 값은 끈 것으로 읽는다 */
    push: c?.push === true || c?.push === 1 ? 1 : 0,
    shut: c?.shut === true || c?.shut === 1 ? 1 : 0,
  };
}

/* 프로필 저장. 이 저장소에서 사용자가 직접 쓰는 값이 서버에 남는 유일한 곳이다. */
async function authProfile(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const p = profile(c);
  if (!p.name) return reply(400, '닉네임을 1자 이상 입력해 주세요.', o);
  return safely(o, async () => {
    /* 아이디가 남의 것이면 여기서 돌려보낸다. unique 인덱스가 최종 판정이지만
       (둘이 같은 순간에 같은 아이디를 낸 경우), 그 오류는 프로필 전체를 통째로
       실패시켜 "왜 안 되는지" 를 못 알린다 — 먼저 보고 아이디만 짚어 준다. */
    if (p.handle) {
      const taken = await env.DB.prepare('select who from profile where handle = ?').bind(p.handle).first();
      if (taken && taken.who !== me) return send(409, { msg: '이미 쓰이고 있는 아이디입니다.', handle: true }, o);
    }
    await env.DB.batch([
      env.DB.prepare(
        `insert into profile (who, name, bio, face, lang, at, handle, botname, push, shut)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (who) do update set
           name = excluded.name, bio = excluded.bio,
           face = excluded.face, lang = excluded.lang, at = excluded.at,
           /* 아이디는 한 번 정하면 빈 값으로 덮이지 않는다 — 아이디 칸이 없는
              화면(내 계정)이 프로필을 통째로 올려도 지워지면 안 된다 */
           handle = case when excluded.handle = '' then profile.handle else excluded.handle end,
           botname = excluded.botname, push = excluded.push, shut = excluded.shut`
      ).bind(me, p.name, p.bio, p.face, p.lang, Date.now(), p.handle, p.botname, p.push, p.shut),
      /* 이미 걸려 있는 이름도 같이 고친다 — 한 곳에서 바꿨는데 순위표에 옛 이름이
         남으면 그 이름을 거둘 손잡이가 없는 것과 같다 */
      env.DB.prepare('update speed set name = ? where who = ?').bind(p.name, me),
      env.DB.prepare('update ladder set name = ? where who = ?').bind(p.name, me),
    ]);
    return send(200, p, o);
  });
}

/* 가입 안내(welcome/)의 설문 한 줄. 고른 것만 담는다 — 자유 입력 칸이 없으므로
   여기로 남의 글이 들어올 길도 없다. 한 사람 한 줄이고, 다시 보내면 덮어쓴다
   (안내를 도중에 닫았다가 다시 들어온 사람이 막히면 안 된다). */
export function intro(c) {
  const slug = s => /^[a-z][a-z0-9-]{0,23}$/.test(String(s ?? '')) ? String(s) : '';
  const n = Number(c?.nps);
  return {
    platform: slug(c?.platform),
    medium: slug(c?.medium),
    /* 안 고르고 넘어갈 수 있는 값이라 0 과 '안 함' 을 갈라야 한다 — null 이다 */
    nps: Number.isInteger(n) && n >= 0 && n <= 10 ? n : null,
  };
}

async function authIntro(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const v = intro(c);
  return safely(o, async () => {
    await env.DB.prepare(
      `insert into intro (who, platform, medium, nps, at) values (?, ?, ?, ?, ?)
       on conflict (who) do update set
         platform = excluded.platform, medium = excluded.medium,
         nps = excluded.nps, at = excluded.at`
    ).bind(me, v.platform, v.medium, v.nps, Date.now()).run();
    return send(200, v, o);
  });
}

/* 계정을 지운다. 사람이 제 것을 거둘 권리이므로 반쪽짜리로 두지 않는다 —
   순위표만 내리는 /forget 과 달리 이 사람을 가리키는 줄을 남김없이 지운다.

   이 목록이 곧 "이 저장소가 사람에 대해 쥐고 있는 전부" 다. 새 표를 만들면서 여기
   더하는 걸 잊으면 지웠다고 해놓고 남는다 — relay/test.mjs 가 schema.sql 과 대조해
   빠진 표를 잡는다. 그 검사가 이 상수를 보는 이유다. */
export const ERASE = ['speed', 'board', 'ladder', 'played', 'ticket', 'profile', 'intro',
                      'passkey', 'recovery', 'pending', 'sso'];

async function authErase(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  /* 되돌릴 수 없는 일이라 빈 POST 한 번으로는 안 지워지게 한다. 화면이 사람에게
     물어 받은 답을 여기 실어 보낸다 — 문지기가 아니라 빗나간 요청을 거르는 턱이다. */
  if (c?.sure !== true) return reply(400, '지우겠다는 확인이 없습니다.', o);

  return safely(o, async () => {
    const rows = await env.DB.batch([
      ...ERASE.map(tb => env.DB.prepare(`delete from ${tb} where who = ?`).bind(me)),
      /* 사람 줄은 맨 끝에 지운다. D1 의 batch 는 한 묶음으로 도니 도중에 엎어지면
         통째로 없던 일이 된다 — 반쯤 지워진 계정이 남지 않는다 */
      env.DB.prepare('delete from user where id = ?').bind(me),
    ]);
    /* 세션 토큰은 서명만으로 서는 무상태라 지운 뒤에도 모양은 멀쩡하다. 가리키는
       줄이 없으니 무엇을 물어도 빈손이고, 다시 로그인하면 새 사람으로 시작한다 —
       그게 '지웠다' 의 뜻이다. 화면은 받는 즉시 토큰을 버린다. */
    return send(200, { gone: rows.reduce((n, r) => n + (r.meta?.changes ?? 0), 0) }, o);
  });
}

async function authMe(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  return safely(o, async () => {
    const [keys, codes, row, intro] = await env.DB.batch([
      env.DB.prepare('select count(*) as n from passkey where who = ?').bind(me),
      env.DB.prepare('select count(*) as n from recovery where who = ?').bind(me),
      env.DB.prepare('select name, bio, face, lang, handle, botname, push, shut from profile where who = ?').bind(me),
      env.DB.prepare('select 1 as n from intro where who = ?').bind(me),
    ]);
    /* intro 는 '가입 안내를 이미 마쳤다' 는 표시다. 화면(auth.js·welcome.js)이
       이걸 보고 안내를 다시 띄울지 정한다 — 두 번 묻지 않기 위한 값 하나다. */
    return send(200, { keys: keys.results[0]?.n ?? 0, codes: codes.results[0]?.n ?? 0,
                       profile: row.results[0] ?? null, intro: !!intro.results[0] }, o);
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
        if (path === '/auth/profile') return authProfile(req, env, o);
        if (path === '/auth/intro') return authIntro(req, env, o);
        if (path === '/auth/erase') return authErase(req, env, o);
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
    if (path === '/ranked/start' || path === '/ranked/end' || path === '/played' ||
        path === '/games' || path === '/ladder') {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      if (path === '/ranked/start' && req.method === 'POST') return rankedStart(req, env, o);
      if (path === '/ranked/end' && req.method === 'POST') return rankedEnd(req, env, o);
      if (path === '/played' && req.method === 'POST') return playedNormal(req, env, o);
      if (path === '/games' && req.method === 'GET') return myGames(req, env, o);
      if (path === '/ladder' && req.method === 'GET') return ladderTop(req, env, o);
    }
    return reply(405, '받지 않는 요청입니다.', o);
  },
};
