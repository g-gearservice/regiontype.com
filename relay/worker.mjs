/* regiontype 중계기 — 정적 사이트가 혼자 못 하는 두 가지만 한다. 도메인은
   g.gearservicevanguard.com 이다(workers.dev 문은 닫혀 있다 — wrangler.toml 참고).

     배포는 경로 묶음별로 따로 한다 — 코드는 이 파일 하나, 문은 entry-<이름>.mjs(entry.mjs 의 OWN).
       rt-feedback   POST / · /turnstile · /where, 그리고 어느 워커도 안 잡은 나머지의 원점
       rt-auth       /auth/*        rt-board   /top /dist /forget /ranked/* /played /games /ladder /match/*
       rt-community  /cm/*          rt-bot     /bot/*          rt-online  /online
       rt-feedback 는 커스텀 도메인, 나머지는 같은 호스트의 존 라우트라 먼저 요청을 받는다.
       바인딩·시크릿은 wrangler.<이름>.toml 에. 아래 secret put 은 그 워커가 쓰는 것만 넣는다.

     POST /         피드백을 GitHub 이슈로 옮긴다 (토큰을 사이트에 둘 수 없다)
     GET  /top      ?c=&t=&mode= 그 판의 상위 기록과 내 자리. c 가 없으면 코스마다 1위
     POST /dist     그 판의 점수 분포와 그 안에서 내가 선 자리
     POST /forget   내 줄을 전부 내린다 (순위표·경쟁전·전적)
     POST /ranked/start {c,name}  경쟁전 표를 낸다. 끝내지 않은 옛 표는 탈주로 셈한다
     POST /ranked/end   {id,score,hits,tries}  표를 태우고 lp 를 오르내린다
     POST /match/find {c,name,dev,bot?}  1대1 매칭 줄에 서거나(폴링) 짝을 받는다 → {wait,n} | 짝 응답
     POST /match/leave  매칭 줄에서 나간다
     POST /match/tick {duel,hits}  내 진행을 적고 상대 진행·정산 결과를 받는다
     POST /played   일반전 한 판을 전적에 남기고 순위표(코스별 최고 기록)를 갈아 끼운다
     GET  /games    내 사다리 줄과 최근 판들 (로그인 필요)
     GET  /ladder   경쟁전 상위 50
     순위표·사다리는 기기(dev)마다 따로 선다 — 'pc' | 'mobile'. 쓰기는 몸통의 dev,
     읽기(/top·/ladder·/games)는 ?dev= 로 받는다. 'mobile' 이 아니면 전부 'pc' 다

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

     커뮤니티(community/) — 읽기는 누구나, 쓰기는 로그인 + 닉네임
     GET  /cm/list  ?tag=&before=  글 목록 20개씩
     GET  /cm/read  ?id=           글 하나와 댓글
     POST /cm/post  {tag,title,body} · /cm/reply {post,body}
     POST /bot/chat {msgs,courses,lang,name}  홈 봇 대화 → {say, do} (NVIDIA NIM)
     POST /online   {id}  이 탭이 떠 있다고 알리고 지금 접속 수 {n} 을 받는다
     POST /cm/up    {target}  공감 켜고 끄기 · /cm/flag {target} 신고 · /cm/del {target} 내 글 지우기

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
       wrangler secret put NV_KEY       // build.nvidia.com API 키 — 봇 대화
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

/* 기기 갈래. 폰 타자 속도는 키보드와 견줄 수 없어 순위표를 둘로 나눈다. 남이 보낸
   값이라 'mobile' 이 아니면 전부 'pc' 로 떨어뜨린다 — 옛 앱도 쓰레기 값도 pc 다.
   줄을 가르는 데만 쓰고 그 밖의 무엇도 이 값을 믿지 않는다 */
export const devOf = d => d === 'mobile' ? 'mobile' : 'pc';

/* 어느 판인지. 코스 이름과 제한 시간이 둘 다 맞아야 한 줄에 세운다.
   mode 는 읽을 때만 쓴다 — 쓰는 쪽(logPlay)은 부른 경로가 정한 값을 쓴다 */
export function where(c) {
  const slug = cut(c.c, 40), secs = Number(c.t);
  return { slug, secs, dev: devOf(c.dev), mode: c.mode === 'ranked' ? 'ranked' : 'normal', size: SIZE[slug] || 0,
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
  /* 정확도는 앱이 키 단위로 센 값(맞은 키 ÷ 친 키)이다. 안 실려 오면(옛 앱) 맞힌 곳 ÷
     시도로 갈음한다. hits·tries 도 앱이 세어 보내는 값이라 믿음의 크기는 같다 */
  const acc = c.acc === undefined ? (tries ? Math.round(hits / tries * 100) : 0) : Number(c.acc);
  const ok = w.ok && int(acc) && acc <= 100 && !!name && /^[a-z0-9]{8,64}$/.test(who)
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
  return { ...w, name, who, score, hits, tries, cpm, ok, acc };
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
   읽는 자리에서 가리는 이유: 기록을 올리는 길이 /played·/ranked/end·/auth/profile
   셋이라 한 곳만 막으면 다음 판에 도로 박힌다. 읽는 쿼리는 여기 둘뿐이다.
   기록(cpm·순위)은 그대로 선다 — 가리는 것은 이름 하나다. */
/* 닉네임(profile)이 있으면 그것이 앞선다 — 고치면 옛 기록에도 따라간다 */
const SHOWN = `case when p.shut = 1 then '' else coalesce(nullif(p.name, ''), b.name) end`;
const board = (env, w) => env.DB.prepare(
  `select b.who as who, ${SHOWN} as name,
          b.cpm as cpm, b.score as score, b.hits as hits, b.acc as acc
     from best b left join profile p on p.who = b.who
    where b.mode = ? and b.slug = ? and b.secs = ? and b.dev = ? order by b.cpm desc, b.at asc limit ?`
).bind(w.mode, w.slug, w.secs, w.dev, TOP);
/* 그 판의 상위 줄과 내 자리. 내 줄이 없으면 rank 는 null 이다 */
async function standing(env, w, me) {
  const [list, rank] = await env.DB.batch([
    board(env, w),
    env.DB.prepare(
      `select count(b.who) + 1 as n from best m left join best b
          on b.mode = m.mode and b.slug = m.slug and b.secs = m.secs and b.dev = m.dev and b.cpm > m.cpm
        where m.mode = ? and m.slug = ? and m.secs = ? and m.dev = ? and m.who = ? group by m.who`
    ).bind(w.mode, w.slug, w.secs, w.dev, me ?? ''),
  ]);
  return { top: seen(list.results, me), rank: rank.results[0]?.n ?? null };
}
/* 코스마다 1위 한 줄과 올린 사람 수. 줄 수는 코스 × 제한 시간을 못 넘는다(수백 줄).
   ponytail: 같은 속도 1위가 둘이면 sqlite 가 아무나 고른다 — 순위표(board)는 먼저 올린 쪽이다 */
const bests = (env, mode, dev) => env.DB.prepare(
  `select b.slug as slug, b.secs as secs, b.n as n, b.cpm as cpm, ${SHOWN} as name
     from (select slug, secs, count(*) as n, max(cpm) as cpm, who, name from best
            where mode = ? and dev = ? group by slug, secs) b
     left join profile p on p.who = b.who
    order by b.n desc, b.cpm desc`
).bind(mode, dev);
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
     여기만 잠그면 된다: /played·/forget 은 이미 로그인 뒤고, 이슈를 만드는 이 길만
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
         ' from speed where slug = ? and secs = ? and dev = ? group by b order by b'
      ).bind(bucket, w.slug, w.secs, w.dev),
      env.DB.prepare('select count(*) as n from speed where slug = ? and secs = ? and dev = ?').bind(w.slug, w.secs, w.dev),
      env.DB.prepare('select score from speed where slug = ? and secs = ? and dev = ? and who = ?')
        .bind(w.slug, w.secs, w.dev, me ?? ''),
    ]);
    const score = mine.results[0]?.score ?? null;
    let over = null;
    if (score !== null) {
      const r = await env.DB.prepare(
        'select count(*) as n from speed where slug = ? and secs = ? and dev = ? and score > ?'
      ).bind(w.slug, w.secs, w.dev, score).first('n');
      over = r ?? 0;
    }
    return send(200, { bucket, cap, bins: bins.results,
                       total: all.results[0]?.n ?? 0, score, over }, o);
  });
}

/* GET /top?c=&t=&mode=&dev= 그 판의 상위 줄과 내 자리. c 가 없으면 코스마다 1위 */
async function top(req, env, o) {
  const u = new URL(req.url), q = k => u.searchParams.get(k);
  const me = await sessionWho(env, req);
  if (!q('c')) {
    const w = where({ mode: q('mode'), dev: q('dev') });
    return safely(o, async () => send(200, { bests: (await bests(env, w.mode, w.dev).all()).results }, o));
  }
  const w = where({ c: q('c'), t: q('t'), dev: q('dev'), mode: q('mode') });
  if (!w.ok) return reply(400, '없는 판입니다.', o);
  return safely(o, async () => send(200, await standing(env, w, me), o));
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
    const [r] = await env.DB.batch(['best', 'speed', 'board', 'ladder', 'played', 'ticket', 'queue']
      .map(tb => env.DB.prepare(`delete from ${tb} where who = ?`).bind(who))
      .concat(env.DB.prepare('delete from duel where a = ? or b = ?').bind(who, who)));
    return send(200, { gone: r.meta?.changes ?? 0 }, o);
  });
}

/* ── 경쟁전 ──────────────────────────────────────────────
   보이는 lp 와 숨은 실력(mmr)을 따로 둔다(LoL·발로란트의 MMR 과 같은 결).
     실력  = 판마다 잰 perf(= CPM × 정확도 배율)의 평균. 단위가 CPM 이라 코스가 달라도
             견줄 수 있고, 티어가 결국 속도에 묶인다 — 티어가 객관적이게 하는 핵심이다
     배치  = 처음 5판. lp 를 주지 않고 실력만 잰다. 5판째에 그 실력의 디비전에 앉힌다
             (다이아 III 까지 — 그 위는 이겨서 오른다). 5연승해도 실력이 브론즈면 브론즈다
     티어  = 브론즈·실버·골드·플래티넘·다이아는 III·II·I 세 디비전, 디비전마다 100 lp.
             마스터(1500 lp~)는 하나다. 디비전 d 의 기준 속도는 divCpm(d) = 100 + d×50/3
     lp    = 40 × (승패 − 기대승률) × 수렴 배율 + 격차 보너스
             기대승률은 상대 실력과 내 실력의 차이로(100 CPM 차이 = 10:1).
             수렴 배율은 내 실력의 자리가 lp 보다 위면 이길 때 더 받고 질 때 덜 잃는다
             (아래면 거꾸로, 0.5~1.5배). 격차 보너스는 perf 차이로 ±5.
             이기면 최소 +5, 지면 최소 −5, 한 판에 ±50 을 넘지 않는다. 탈주는 −25.
   하루(24시간)에 얻는 lp 는 200 까지다(배치 자리는 빼고).
   제한 시간은 120초로 못 박는다 — 판마다 조건이 같아야 견줄 수 있다.
   사다리(lp·실력)는 기기마다 따로다 — 폰 사람은 폰 사람끼리 선다.
   기기는 표를 낼 때 정해 표에 적고, 끝낼 때는 몸통이 아니라 표의 것을 쓴다. */
export const RANKED_SECS = 120;
const STEP = 100, DIVS = 3, PLACE = 5, PLACE_TOP = 12, QUIT = 25, KEEP = 50, DAY_CAP = 200;
/* 티어마다 바닥 속도(CPM) — 브론즈 100 … 마스터 350. 한 티어가 50 CPM, 한 디비전이 그 셋째.
   ponytail: 서울 코스의 어림값이다. 판이 쌓이면 실제 실력 분포의 분위수로 다시 잡는다 */
export const WANT = [100, 150, 200, 250, 300, 350];
export const divCpm = d => WANT[0] + d * (WANT[1] - WANT[0]) / DIVS;
export const divOf = r => Math.max(0, Math.floor((r - WANT[0]) * DIVS / (WANT[1] - WANT[0])));
/* 정확도 95% 이상은 그대로, 그 아래는 1% 마다 3% 씩 깎는다(85% → ×.7) */
export const perf = (cpm, acc) => Math.round(cpm * (acc >= 95 ? 1 : Math.max(0, 1 - (95 - acc) * .03)));
const BOT_MMR = 150;   // 실력을 아직 모르는 사람의 첫 봇 — 실버 III 쯤
/* 한 판을 셈한다. lad 는 그 판 전의 {lp, games, mmr}, S 는 1 | .5 | 0, myP 는 내 perf
   (앞뒤 안 맞는 판은 null — 실력은 그대로 둔다), oppR·oppP 는 상대의 실력·이번 perf.
   돌려주는 d 는 lp 변화, mmr 은 새 실력, placed 는 이 판으로 배치가 끝났는지 */
export function rate(lad, S, myP, oppR, oppP) {
  const { lp = 0, games = 0 } = lad, r0 = lad.mmr ?? null;
  const mmr = myP == null ? r0
    : r0 == null ? myP
    : games < PLACE ? (r0 * games + myP) / (games + 1)
    : r0 + .15 * (myP - r0);
  if (games < PLACE - 1) return { d: 0, mmr };
  if (games === PLACE - 1) return { d: (mmr == null ? 0 : Math.min(PLACE_TOP, divOf(mmr))) * STEP - lp, mmr, placed: true };
  const me = r0 ?? divCpm(lp / STEP);
  const E = 1 / (1 + 10 ** ((oppR - me) / 100));
  const gap = Math.max(-1, Math.min(1, (divOf(me) + .5 - lp / STEP) / DIVS));
  const conv = S === 0 ? 1 - .5 * gap : 1 + .5 * gap;
  const edge = S === .5 ? 0 : Math.max(-5, Math.min(5, Math.round(((myP ?? 0) - oppP) / Math.max(oppP, 1) * 20)));
  let d = Math.round(40 * (S - E) * conv) + edge;
  if (S === 1) d = Math.max(5, d); else if (S === 0) d = Math.min(-5, d);
  return { d: Math.max(-lp, Math.max(-50, Math.min(50, d))), mmr };
}
/* 탈주·앞뒤 안 맞는 판의 lp. 배치 중엔 잃을 lp 가 없고, 5판째면 그때까지의 실력으로 앉힌다 */
export const quitDelta = lad => (lad?.games ?? 0) < PLACE ? rate(lad ?? {}, 0, null, 0, 0).d : -Math.min(QUIT, lad.lp ?? 0);
/* 하루에 얻은 lp — 배치 자리(한 번에 크게 뛴다)는 뚜껑에서 뺀다 */
const DAY_SQL = "select coalesce(sum(delta), 0) as n from played where who = ? and mode = 'ranked' and dev = ? and delta > 0 and delta <= 50 and at > ?";
/* 끝난 판이 앞뒤가 맞는지. 표를 낸 코스·시간으로만 본다 — 몸통의 c·t 는 무시한다.
   다 치지 않았으면 120초가 지나야 하고, 다 쳤으면 한 곳에 0.5초는 들었어야 한다 */
export function rankedCheck(c, tk, now, who) {
  const e = entry({ ...c, c: tk.slug, t: RANKED_SECS, dev: tk.dev }, who);
  const took = now - tk.at;
  const need = e.hits >= (SIZE[tk.slug] || 0) ? e.hits * 500 : RANKED_SECS * 1000;
  return { ...e, ok: e.ok && c.id === tk.id && took >= need && took <= 10 * 60e3 };
}
/* 판 한 줄을 적고 그 사람의 옛 줄을 50 판에서 자른다. 일반전·경쟁전·1대1 이 전부 여기를
   지나므로 코스별 최고 기록(best)도 여기서만 쓴다 — 더 빠를 때만 갈아 끼운다.
   탈주·앞뒤 안 맞는 판은 cpm 0 으로 오니 올리지 않는다 */
const logPlay = (env, who, mode, dev, slug, secs, e, delta, at, win = null) => [
  env.DB.prepare('insert into played (who, mode, dev, slug, secs, cpm, score, hits, acc, delta, win, at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(who, mode, dev, slug, secs, e.cpm, e.score, e.hits, e.acc, delta, win, at),
  env.DB.prepare('delete from played where who = ? and rowid not in (select rowid from played where who = ? order by at desc limit ?)')
    .bind(who, who, KEEP),
  ...(e.cpm > 0 ? [env.DB.prepare(
    `insert into best (mode, slug, secs, dev, who, name, cpm, score, hits, acc, at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (mode, slug, secs, dev, who) do update set name = excluded.name, cpm = excluded.cpm,
       score = excluded.score, hits = excluded.hits, acc = excluded.acc, at = excluded.at
     where excluded.cpm > best.cpm`
  ).bind(mode, slug, secs, dev, who, e.name || '', e.cpm, e.score, e.hits, e.acc, at)] : []),
];

/* 끝내지 않은 옛 표를 탈주로 셈하는 문장들 — rankedStart 와 matchFind 가 같이 쓴다.
   맞대결 표였으면 그 판의 내 칸을 -2(탈주, 이미 깎음)로 적어 상대가 이기게 하고, 정산에서
   또 깎지 않는다. 부른 쪽은 batch 뒤에 tk.duel 이 있으면 settle 을 불러 준다 */
const forfeit = (env, me, tk, quit, now) => [
  env.DB.prepare('update ladder set lp = lp + ?, games = games + 1, at = ? where who = ? and dev = ?').bind(quit, now, me, tk.dev),
  ...logPlay(env, me, 'ranked', tk.dev, tk.slug, RANKED_SECS, { cpm: 0, score: 0, hits: 0, acc: 0 }, quit, now, 0),
  env.DB.prepare('delete from ticket where who = ?').bind(me),
  ...(tk.duel ? [env.DB.prepare(`update duel set a_cpm = case when a = ? and a_cpm is null then -2 else a_cpm end,
                                                   b_cpm = case when b = ? and b_cpm is null then -2 else b_cpm end
                                  where id = ? and done = 0`).bind(me, me, tk.duel)] : []),
];

async function rankedStart(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '경쟁전은 로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const slug = cut(c.c, 40), name = plain(c.name, CAP.name), dev = devOf(c.dev);
  if (!Object.hasOwn(SIZE, slug) || !name) return reply(400, '시작할 수 없는 판입니다.', o);
  const ok = await pass(env.RL_RK, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    const now = Date.now(), id = rand(18);
    const [old, row] = await env.DB.batch([
      env.DB.prepare('select slug, dev, duel from ticket where who = ?').bind(me),
      /* 탈주는 옛 표를 낸 기기의 사다리에서 깎는다 */
      env.DB.prepare('select lp, games, mmr from ladder where who = ? and dev = (select dev from ticket where who = ?)').bind(me, me),
    ]);
    const tk = old.results[0];
    const quit = tk ? quitDelta(row.results[0]) : 0;
    await env.DB.batch([
      env.DB.prepare(`insert into ladder (who, dev, name, lp, games, wins, at) values (?, ?, ?, 0, 0, 0, ?)
                      on conflict (who, dev) do update set name = excluded.name`).bind(me, dev, name, now),
      ...(tk ? forfeit(env, me, tk, quit, now) : []),
      env.DB.prepare(`insert into ticket (who, id, slug, dev, at) values (?, ?, ?, ?, ?)
                      on conflict (who) do update set id = excluded.id, slug = excluded.slug, dev = excluded.dev, at = excluded.at`)
        .bind(me, id, slug, dev, now),
    ]);
    if (tk?.duel) await settle(env, tk.duel, now);
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
    const tk = await env.DB.prepare('delete from ticket where who = ? and id = ? returning slug, dev, at, duel')
      .bind(me, cut(c.id, 40)).first();
    if (!tk) return reply(409, '끝낼 경쟁전이 없습니다.', o);
    if (tk.duel) return duelEnd(env, me, tk, c, now, o);
    const [row, day] = await env.DB.batch([
      env.DB.prepare('select name, lp, games, mmr from ladder where who = ? and dev = ?').bind(me, tk.dev),
      env.DB.prepare(DAY_SQL).bind(me, tk.dev, now - 864e5),
    ]);
    const lad = row.results[0];
    if (!lad) return reply(409, '끝낼 경쟁전이 없습니다.', o);
    const e = rankedCheck({ ...c, name: lad.name }, { ...tk, id: c.id }, now, me);
    /* 혼자 친 판은 내 디비전 기준 속도의 그림자와 겨룬다. 앞뒤가 안 맞는 판은 탈주와 같게
       셈한다 — 표는 이미 탔다 */
    const ghost = Math.round(divCpm(lad.lp / STEP)), myP = e.ok ? perf(e.cpm, e.acc) : null;
    const S = e.ok ? (myP > ghost ? 1 : myP === ghost ? .5 : 0) : 0;
    const r = e.ok ? rate(lad, S, myP, ghost, ghost) : { d: quitDelta(lad), mmr: lad.mmr, placed: lad.games === PLACE - 1 };
    let d = r.d;
    /* 채점이 브라우저에 있어 잘 지은 만점을 가릴 수 없다. 하루에 얻는 lp 에 뚜껑을
       덮어 거짓말 한 번의 값을 줄인다.
       ponytail: 뚜껑은 속도만 늦춘다. 사다리가 시달리면 채점(타건 기록 검증)을 서버로 옮긴다 */
    if (d > 0 && !r.placed) d = Math.max(0, Math.min(d, DAY_CAP - (day.results[0]?.n ?? 0)));
    await env.DB.batch([
      env.DB.prepare('update ladder set lp = lp + ?, games = games + 1, wins = wins + ?, mmr = ?, at = ? where who = ? and dev = ?')
        .bind(d, S === 1 ? 1 : 0, r.mmr ?? null, now, me, tk.dev),
      ...logPlay(env, me, 'ranked', tk.dev, tk.slug, RANKED_SECS, e.ok ? e : { cpm: 0, score: 0, hits: 0, acc: 0 }, d, now, S),
    ]);
    if (!e.ok) return reply(400, '올릴 수 없는 기록입니다.', o);
    return send(200, { delta: d, lp: lad.lp + d, games: lad.games + 1, dev: tk.dev, win: S, placed: !!r.placed }, o);
  });
}

/* ── 경쟁전 1대1 ─────────────────────────────────────────
   사람끼리 자동 매칭, 20초 안에 짝이 없으면(또는 눌러서) 봇. D1 + 짧은 폴링뿐이다.
   승패는 cpm 이 높은 쪽 → 같으면 acc → 그래도 같으면 무승부. 앞뒤 안 맞는 판·탈주는 진다.
   lp 는 위 rate() 로 — 상대 실력은 사람이면 그 사람의 mmr, 봇이면 봇의 속도다.
   얻는 쪽에는 DAY_CAP 이 그대로 씌워진다.
   두 요청이 같은 줄을 집거나 정산이 두 번 도는 걸 `delete … returning`·
   `update … where done = 0 returning` 한 문장으로 막는다 — 한 줄을 돌려받은 쪽만 이어 간다. */
export const DUEL_WAIT = 20000, DUEL_LEAD = 3000, DUEL_GRACE = 30000, DUEL_KEYS = 8, DUEL_ACC = 96, DUEL_PAIR = 3;
/* 봇의 속도 — 내 lp 가 아니라 내 실력에 맞춘다(±15%). lp 에 맞추면 봇이 늘 반반이라
   이기기만 하면 오르는 사다리가 된다 */
export const botCpmFor = (mmr, rnd = Math.random()) => Math.round((mmr ?? BOT_MMR) * (.85 + rnd * .3));
/* a 쪽에서 본 결과 1 | .5 | 0. cpm < 0 은 못 낸 판(-1 앞뒤 불일치 · -2 탈주) */
export function duelWinner(a, b) {
  if (a.cpm < 0 || b.cpm < 0) return a.cpm >= 0 ? 1 : 0;
  if (a.cpm !== b.cpm) return a.cpm > b.cpm ? 1 : 0;
  return a.acc === b.acc ? .5 : a.acc > b.acc ? 1 : 0;
}
/* 봇이 지금까지 맞힌 곳. ponytail: 한 곳당 평균 KEYS 타로 어림한다 — 코스마다 지명 길이가
   달라 실제와 어긋난다. 봇이 너무 빠르거나 굼뜨면 코스별 평균 타수를 size.mjs 에서 찍는다 */
export const botHits = (slug, botCpm, elapsedMs) =>
  Math.min(SIZE[slug] || 0, Math.floor(Math.min(Math.max(0, elapsedMs), RANKED_SECS * 1000) * botCpm / 6e4 / DUEL_KEYS));

/* 짝 응답. 상대에게서는 이름·lp·봇 여부만 싣는다 — who 는 안 나간다 */
async function pair(env, me, id, duel, now, o) {
  const d = await env.DB.prepare('select * from duel where id = ?').bind(duel).first();
  if (!d) return reply(404, '없는 판입니다.', o);
  const p = d.a === me ? 'b' : 'a';
  return send(200, { id, duel, slug: d.slug, secs: RANKED_SECS, at: d.at, now,
    opp: { name: d[p + '_name'], lp: d[p + '_lp'], bot: d[p] === 'bot' } }, o);
}

async function matchFind(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '경쟁전은 로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  if (!c || typeof c !== 'object') return reply(400, '읽을 수 없는 내용입니다.', o);
  const slug = cut(c.c, 40), name = plain(c.name, CAP.name), dev = devOf(c.dev);
  if (!Object.hasOwn(SIZE, slug) || !name) return reply(400, '시작할 수 없는 판입니다.', o);
  const ok = await pass(env.RL_MT, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    const now = Date.now();
    const [, lad, old, que] = await env.DB.batch([
      env.DB.prepare(`insert into ladder (who, dev, name, lp, games, wins, at) values (?, ?, ?, 0, 0, 0, ?)
                      on conflict (who, dev) do update set name = excluded.name`).bind(me, dev, name, now),
      env.DB.prepare('select lp, mmr from ladder where who = ? and dev = ?').bind(me, dev),
      env.DB.prepare('select id, slug, dev, duel, at from ticket where who = ?').bind(me),
      env.DB.prepare('select at from queue where who = ?').bind(me),
    ]);
    const tk = old.results[0], q = que.results[0], lp = lad.results[0]?.lp ?? 0, mmr = lad.results[0]?.mmr ?? null;
    /* 방금 지어진 짝이면 그 판을 준다. 집힌 사람의 줄은 집을 때 이미 지워져 q 가 없을 수
       있으니, 표가 시작 20초 안이고(q 가 있으면 줄에 선 때보다 늦게 생겼고) 판이 아직 안
       끝났으면 짝으로 본다. 그보다 묵은 표는 아래에서 탈주로 셈한다 */
    if (tk?.duel && now < tk.at + DUEL_WAIT && (!q || tk.at >= q.at)) {
      await env.DB.prepare('delete from queue where who = ?').bind(me).run();
      return pair(env, me, tk.id, tk.duel, now, o);
    }
    /* 그 밖의 옛 표는 탈주다. 옛 표를 낸 기기의 사다리에서 깎는다 */
    if (tk) {
      const ol = await env.DB.prepare('select lp, games, mmr from ladder where who = ? and dev = ?').bind(me, tk.dev).first();
      await env.DB.batch(forfeit(env, me, tk, quitDelta(ol), now));
      if (tk.duel) await settle(env, tk.duel, now);
    }
    const mk = (a, b, extra) => {
      const id = rand(18), at = now + DUEL_LEAD;
      return { id, tid: rand(18), at, slug: extra.slug,
        duel: env.DB.prepare(`insert into duel (id, dev, slug, at, a, b, a_name, b_name, a_lp, b_lp, bot_cpm, b_cpm, b_acc)
                              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, dev, extra.slug, at, a.who, b.who, a.name, b.name, a.lp, b.lp,
                extra.botCpm ?? null, extra.botCpm ?? null, extra.botCpm ? DUEL_ACC : null) };
    };
    const tkt = (who, m, tid) => env.DB.prepare(`insert into ticket (who, id, slug, dev, at, duel) values (?, ?, ?, ?, ?, ?)
      on conflict (who) do update set id = excluded.id, slug = excluded.slug, dev = excluded.dev, at = excluded.at, duel = excluded.duel`)
      .bind(who, tid, m.slug, dev, m.at, m.id);
    const meRow = { who: me, name, lp };

    if (c.bot === true) {
      /* 내 줄을 지우고도 돌려받은 게 없으면 그 사이 누가 나를 집은 것이다 — 그 짝을 받는다.
         ponytail: 집힌 사람의 batch 가 아직 표를 못 쓴 몇 ms 는 못 잡는다(그러면 봇 판이 된다) */
      const gone = await env.DB.prepare('delete from queue where who = ? returning at').bind(me).first();
      if (q && !gone) {
        const t = await env.DB.prepare('select id, duel from ticket where who = ?').bind(me).first();
        if (t?.duel) return pair(env, me, t.id, t.duel, now, o);
      }
      const botCpm = botCpmFor(mmr);
      const m = mk(meRow, { who: 'bot', name: 'bot', lp }, { slug, botCpm });
      await env.DB.batch([env.DB.prepare('delete from duel where at < ?').bind(now - 864e5), m.duel, tkt(me, m, m.tid)]);
      return pair(env, me, m.tid, m.id, now, o);
    }

    /* 사람 짝: 20초 넘은 줄은 걷고, 같은 기기의 가장 오래된 다른 줄을 한 문장으로 집는다 */
    await env.DB.prepare('delete from queue where at < ?').bind(now - DUEL_WAIT).run();
    const p = await env.DB.prepare(`delete from queue where who = (select who from queue where dev = ? and who <> ? order by at limit 1)
                                    returning who, name, slug, lp`).bind(dev, me).first();
    if (p) {
      const m = mk(p, meRow, { slug: p.slug });
      /* 옛 판은 하루면 걷는다 — 표가 커지지 않게, 남의 이름이 오래 남지 않게 */
      await env.DB.batch([
        env.DB.prepare('delete from duel where at < ?').bind(now - 864e5),
        env.DB.prepare('delete from queue where who = ?').bind(me),
        m.duel, tkt(p.who, m, rand(18)), tkt(me, m, m.tid)]);
      return pair(env, me, m.tid, m.id, now, o);
    }
    await env.DB.prepare(`insert into queue (who, dev, slug, name, lp, at) values (?, ?, ?, ?, ?, ?)
                          on conflict (who) do update set name = excluded.name, slug = excluded.slug, lp = excluded.lp`)
      .bind(me, dev, slug, name, lp, now).run();
    const n = await env.DB.prepare('select count(*) as n from queue where dev = ?').bind(dev).first('n');
    return send(200, { wait: true, n }, o);
  });
}

async function matchLeave(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  const ok = await pass(env.RL_MT, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    await env.DB.prepare('delete from queue where who = ?').bind(me).run();
    return send(200, {}, o);
  });
}

/* 정산. 두 칸이 다 차면(force 면 상대가 안 나타나도) 한 번만 — done 을 먼저 잡은 요청만
   이어 간다. 끝내면 {d(행), out:{a,b}} 를 돌려주고, 못 잡았으면 null 이다.
   ponytail: 잡은 뒤 batch 가 엎어지면 그 판은 done 인데 lp 가 안 오른다(드묾). 시달리면
   done 을 batch 안으로 옮긴다 */
async function settle(env, id, now, force = false) {
  const d = await env.DB.prepare(`update duel set done = 1 where id = ? and done = 0
      and (? = 1 or (a_cpm is not null and b_cpm is not null)) returning *`).bind(id, force ? 1 : 0).first();
  if (!d) return null;
  const hs = [['a', 'b'], ['b', 'a']].filter(([s]) => d[s] !== 'bot');
  const rows = await env.DB.batch(hs.flatMap(([s]) => [
    env.DB.prepare('select lp, games, mmr from ladder where who = ? and dev = ?').bind(d[s], d.dev),
    env.DB.prepare(DAY_SQL).bind(d[s], d.dev, now - 864e5),
  ]));
  const lads = Object.fromEntries(hs.map(([s], i) => [s, rows[2 * i].results[0] ?? { lp: 0, games: 0, mmr: null }]));
  /* 같은 두 사람이 하루에 DUEL_PAIR 판을 넘기면 얻는 lp 가 없다 — 두 계정으로 서로
     져 주며 lp 를 뽑는 길을 막는다(져 주는 쪽이 lp 0 이면 잃을 것도 없다) */
  const same = hs.length < 2 ? 0 : await env.DB.prepare(`select count(*) as n from duel where done = 1 and id <> ? and at > ?
      and ((a = ? and b = ?) or (a = ? and b = ?))`).bind(id, now - 864e5, d.a, d.b, d.b, d.a).first('n');
  const out = {}, st = [];
  hs.forEach(([s, p], i) => {
    const lad = lads[s], cpm = d[s + '_cpm'];
    const quit = cpm === null, paid = cpm === -2;   // 안 나타남 · 이미 깎은 탈주
    const S = duelWinner({ cpm: cpm ?? -1, acc: d[s + '_acc'] ?? 0 }, { cpm: d[p + '_cpm'] ?? -1, acc: d[p + '_acc'] ?? 0 });
    /* 상대 실력 — 봇은 제 속도, 사람은 짝지을 때가 아니라 지금의 mmr(없으면 그 lp 의 기준 속도) */
    const opp = d[p] === 'bot' ? null : lads[p];
    const oppR = d[p] === 'bot' ? d.bot_cpm : opp.mmr ?? divCpm(opp.lp / STEP);
    const oc = d[p + '_cpm'], oppP = oc > 0 ? perf(oc, d[p + '_acc'] ?? 0) : 0;
    const r = paid ? { d: 0, mmr: lad.mmr } : quit ? { d: quitDelta(lad), mmr: lad.mmr, placed: lad.games === PLACE - 1 }
      : rate(lad, S, cpm >= 0 ? perf(cpm, d[s + '_acc'] ?? 0) : null, oppR, oppP);
    let dl = r.d;
    if (dl > 0 && !r.placed) dl = same >= DUEL_PAIR ? 0 : Math.max(0, Math.min(dl, DAY_CAP - (rows[2 * i + 1].results[0]?.n ?? 0)));
    out[s] = { d: dl, S, lp: lad.lp + dl, games: lad.games + (paid ? 0 : 1), placed: !!r.placed };
    if (!paid) st.push(
      env.DB.prepare('update ladder set lp = lp + ?, games = games + 1, wins = wins + ?, mmr = ?, at = ? where who = ? and dev = ?')
        .bind(dl, S === 1 ? 1 : 0, r.mmr ?? null, now, d[s], d.dev),
      ...logPlay(env, d[s], 'ranked', d.dev, d.slug, RANKED_SECS,
        { cpm: Math.max(0, cpm ?? 0), score: 0, hits: d[s + '_hits'] ?? 0, acc: Math.max(0, d[s + '_acc'] ?? 0), name: d[s + '_name'] }, dl, now, S));
    /* 안 나타난 사람의 표도 태운다 — 다음 시작에서 또 깎이지 않게 */
    if (quit) st.push(env.DB.prepare('delete from ticket where who = ? and duel = ?').bind(d[s], id));
  });
  st.push(env.DB.prepare('update duel set a_d = ?, b_d = ? where id = ?').bind(out.a?.d ?? null, out.b?.d ?? null, id));
  await env.DB.batch(st);
  return { d, out };
}

/* /ranked/end 의 맞대결 갈래 — 표는 이미 탔다. lp 는 바로 안 바꾸고 내 칸만 적는다 */
async function duelEnd(env, me, tk, c, now, o) {
  const [lad, dl] = await env.DB.batch([
    env.DB.prepare('select name from ladder where who = ? and dev = ?').bind(me, tk.dev),
    env.DB.prepare('select id, a from duel where id = ? and (a = ? or b = ?)').bind(tk.duel, me, me),
  ]);
  const d = dl.results[0];
  if (!d) return reply(409, '끝낼 경쟁전이 없습니다.', o);
  const s = d.a === me ? 'a' : 'b';   // 열 이름은 이 두 값뿐이라 바로 붙여도 된다
  const e = lad.results[0] ? rankedCheck({ ...c, name: lad.results[0].name }, { ...tk, id: c.id }, now, me) : { ok: false };
  await env.DB.prepare(`update duel set ${s}_cpm = ?, ${s}_acc = ?, ${s}_hits = max(coalesce(${s}_hits, 0), ?)
                         where id = ? and ${s}_cpm is null and done = 0`)
    .bind(e.ok ? e.cpm : -1, e.ok ? e.acc : 0, e.ok ? e.hits : 0, d.id).run();
  const r = await settle(env, d.id, now);
  if (!r) return send(200, { pending: true }, o);   // 상대가 아직이거나, 같은 순간 상대가 정산을 잡았다 — 틱으로 받는다
  const p = s === 'a' ? 'b' : 'a', m = r.out[s];
  return send(200, { delta: m.d, lp: m.lp, games: m.games, dev: tk.dev,
                     placed: m.placed, duel: { win: m.S, oppCpm: Math.max(0, r.d[p + '_cpm'] ?? 0) } }, o);
}

async function matchTick(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  if (!c || typeof c !== 'object') return reply(400, '읽을 수 없는 내용입니다.', o);
  const id = cut(c.duel, 40), hits = c.hits;
  if (!id || !Number.isInteger(hits) || hits < 0) return reply(400, '읽을 수 없는 내용입니다.', o);
  const ok = await pass(env.RL_MT, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    const now = Date.now();
    /* 내가 낀 판만 본다 — 남의 판은 없는 판이다 */
    let d = await env.DB.prepare('select * from duel where id = ? and (a = ? or b = ?)').bind(id, me, me).first();
    if (!d) return reply(404, '없는 판입니다.', o);
    const s = d.a === me ? 'a' : 'b', p = s === 'a' ? 'b' : 'a';
    if (!d.done) {
      await env.DB.prepare(`update duel set ${s}_hits = max(coalesce(${s}_hits, 0), ?)
                             where id = ? and ${s}_cpm is null and done = 0`).bind(Math.min(hits, SIZE[d.slug] || 0), id).run();
      /* 나는 끝냈는데 사람 상대가 제한 시간 + 30초가 지나도록 안 나타났다 → 그쪽을 탈주로 셈한다 */
      if (d[s + '_cpm'] !== null && d[p + '_cpm'] === null && d[p] !== 'bot' && now > d.at + RANKED_SECS * 1000 + DUEL_GRACE)
        await settle(env, id, now, true);
      d = await env.DB.prepare('select * from duel where id = ?').bind(id).first();
    }
    const res = { opp: d[p] === 'bot'
      ? { hits: botHits(d.slug, d.bot_cpm, now - d.at), done: now - d.at >= RANKED_SECS * 1000 }
      : { hits: d[p + '_hits'] ?? 0, done: d[p + '_cpm'] !== null } };
    if (d.done) {
      const lad = await env.DB.prepare('select lp, games from ladder where who = ? and dev = ?').bind(me, d.dev).first();
      const my = d[s + '_cpm'], their = d[p + '_cpm'];
      res.result = { win: duelWinner({ cpm: my ?? -1, acc: d[s + '_acc'] ?? 0 }, { cpm: their ?? -1, acc: d[p + '_acc'] ?? 0 }),
                     delta: d[s + '_d'] ?? 0, lp: lad?.lp ?? 0, games: lad?.games ?? 0, placed: lad?.games === PLACE,
                     oppCpm: Math.max(0, their ?? 0), myCpm: Math.max(0, my ?? 0) };
    }
    return send(200, res, o);
  });
}

/* 일반전 한 판을 전적에 남기고, 더 빠르면 코스별 최고 기록도 갈아 끼운다.
   이름은 없어도 된다 — 순위표는 닉네임(profile)을 먼저 보고, 이건 닉네임이 없을 때만 걸린다.
   결과 화면이 바로 그리게 그 판의 순위표와 내 자리를 돌려준다 */
async function playedNormal(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const name = plain(c.name, CAP.name);
  /* entry 는 이름을 요구한다. 없으면 자리만 채우고 빈 이름으로 적는다 */
  const e = entry({ ...c, name: name || '-' }, me);
  if (!e.ok) return reply(400, '올릴 수 없는 기록입니다.', o);
  /* 한 판을 다 돌려면 아무리 짧아도 60초다. 분당 셋이면 넉넉하다 */
  const ok = await pass(env.RL_SC, ip(req));
  if (ok !== true) return shut(ok, o);
  return safely(o, async () => {
    await env.DB.batch(logPlay(env, me, 'normal', e.dev, e.slug, e.secs, { ...e, name }, null, Date.now()));
    return send(201, await standing(env, { ...e, mode: 'normal' }, me), o);
  });
}

/* 내 전적 — ?dev= 기기의 사다리 한 줄과 최근 판들(기기 무관, 줄마다 dev). who 는 싣지 않는다 */
async function myGames(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return reply(401, '로그인이 필요합니다.', o);
  const dev = devOf(new URL(req.url).searchParams.get('dev'));
  return safely(o, async () => {
    const [lad, list, above] = await env.DB.batch([
      env.DB.prepare('select name, lp, games, wins from ladder where who = ? and dev = ?').bind(me, dev),
      env.DB.prepare('select mode, dev, slug, secs, cpm, score, hits, acc, delta, win, at from played where who = ? order by at desc limit ?')
        .bind(me, KEEP),
      env.DB.prepare(`select count(*) + 1 as n from ladder where dev = ? and games >= ? and lp >
                      coalesce((select lp from ladder where who = ? and dev = ?), 1e9)`).bind(dev, PLACE, me, dev),
    ]);
    const r = lad.results[0] || null;
    return send(200, { ladder: r && { ...r, rank: r.games >= PLACE ? above.results[0]?.n ?? null : null },
                       dev, place: PLACE, step: STEP, games: list.results }, o);
  });
}

/* 경쟁전 순위. 배치 5판을 마친 사람만 오른다. ?dev= 기기의 사다리만 */
async function ladderTop(req, env, o) {
  const me = await sessionWho(env, req);
  const dev = devOf(new URL(req.url).searchParams.get('dev'));
  return safely(o, async () => {
    const { results } = await env.DB.prepare(
      `select l.who as who, case when p.shut = 1 then '' else l.name end as name,
              l.lp as lp, l.games as games, l.wins as wins
         from ladder l left join profile p on p.who = l.who
        where l.dev = ? and l.games >= ? order by l.lp desc, l.at asc limit 50`
    ).bind(dev, PLACE).all();
    return send(200, { top: seen(results, me), dev, place: PLACE, step: STEP }, o);
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

/* ── 경쟁전(실시간) ── 판정·소켓은 Durable Object(compete-do.mjs)가 한다. 여기는 문 셋뿐이다:
   POST /compete/ticket  로그인했으면 그 사람, 아니면 게스트로 30초짜리 일회용 표를 받는다(로비 DO 가 낸다).
                         세션 토큰은 소켓 주소에 싣지 않는다 — 주소는 로그에 남는다. 표는 소켓을 연 뒤
                         첫 메시지(auth)로 보낸다.
   GET  /compete/ws      로비 소켓(업그레이드만)
   GET  /compete/m/<id>  판 소켓(업그레이드만). 판 토큰은 로비가 match.found 로 준다
   GET/POST /compete/flags  부정 의심 검토 큐와 판정. 로그인한 사람이 시크릿 ADMIN_IDS(쉼표로 이은 who)에
                         있어야 한다. 일은 로비 DO 가 한다(compete-do.mjs 의 flagQueue · review)
   Origin 은 fetch() 의 mine() 이 이미 걸렀다 — 브라우저는 소켓에도 Origin 을 싣는다. */
const lobby = env => env.LOBBY.get(env.LOBBY.idFromName('lobby'));
async function competeTicket(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const me = await sessionWho(env, req);
  return safely(o, async () => {
    const r = await lobby(env).fetch('https://lobby/ticket', { method: 'POST', body: JSON.stringify({
      who: me || 'g' + hex(12), name: plain(c?.name, CAP.name) || (me ? '' : 'guest'), dev: devOf(c?.dev), guest: !me }) });
    if (!r.ok) return reply(503, '경쟁전 서버가 응답하지 않습니다.', o);
    return send(200, { ticket: (await r.json()).ticket, guest: !me }, o);
  });
}
async function competeRoute(req, env, o, path) {
  if (!env.LOBBY || !env.MATCH) return reply(503, '경쟁전 서버가 아직 열리지 않았습니다.', o);
  const ok = await pass(env.RL_CP, ip(req));
  if (ok !== true) return shut(ok, o);
  if (path === '/compete/ticket' && req.method === 'POST') {
    if (!env.SESSION_KEY) return nokey(o);
    return competeTicket(req, env, o);
  }
  if (path === '/compete/flags' && (req.method === 'GET' || req.method === 'POST')) {
    const me = await sessionWho(env, req);
    if (!me || !String(env.ADMIN_IDS ?? '').split(',').map(x => x.trim()).includes(me)) return reply(403, '관리자만 볼 수 있습니다.', o);
    let body;
    if (req.method === 'POST') {
      try { body = JSON.stringify({ ...(await req.json()), by: me }); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
    }
    return safely(o, async () => {
      const r = await lobby(env).fetch('https://lobby/flags', { method: req.method, body });
      return send(r.ok ? 200 : 503, await r.json(), o);
    });
  }
  if (req.method === 'GET' && req.headers.get('upgrade') === 'websocket') {
    if (path === '/compete/ws') return lobby(env).fetch(req);
    const id = /^\/compete\/m\/([\w-]{16,40})$/.exec(path)?.[1];
    if (id) return env.MATCH.get(env.MATCH.idFromName(id)).fetch(req);
  }
  return reply(405, '받지 않는 요청입니다.', o);
}

/* ── 개발 로그인 ── 로컬 중계기(wrangler dev)에서만 열린다. 두 겹으로 잠근다:
   DEV_LOGIN 변수는 .claude/launch.json 의 `--var DEV_LOGIN:1` 로만 켠다(wrangler.*.toml 에도
   시크릿에도 없다). 그리고 요청이 들어온 주소가 로컬이어야 한다 — 배포된 워커는 존 라우트로만
   열려 req.url 이 로컬일 수 없다. Origin 은 꾸밀 수 있어 잠금으로 쓰지 않는다.
   이름 하나로 테스트 계정을 만들거나 다시 들어간다(같은 이름 = 같은 계정). id 는 'dev' + 이름의
   sha 앞 32자라 운영 id(hex 32자)와 겹치지 않는다. 패스키 2단계는 건너뛴다 — 패스키는
   regiontype.com 에 묶여 로컬에서는 통과할 수 없다 */
export const devLoginOn = (env, url) => env.DEV_LOGIN === '1' && /^(localhost|127\.0\.0\.1)$/.test(new URL(url).hostname);
async function authDev(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const name = plain(c?.name, CAP.name);
  if (!name) return reply(400, '이름을 적어 주세요.', o);
  return safely(o, async () => {
    const who = 'dev' + [...await sha(name)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const r = await env.DB.prepare('insert or ignore into user (id, mail, at) values (?, null, ?)').bind(who, Date.now()).run();
    return send(200, { token: await sign(env.SESSION_KEY, who), isNewAccount: r.meta?.changes === 1 }, o);
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
export const ERASE = ['best', 'speed', 'board', 'ladder', 'played', 'ticket', 'queue', 'profile', 'intro', 'match_participants', 'match_logs', 'player_ratings',
                      'passkey', 'recovery', 'pending', 'sso', 'post', 'reply', 'mark'];

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
      /* 내 글에 남이 단 댓글과 그 표시도 같이 간다 — 글이 없으면 볼 길도 없이 고아로 남는다 */
      env.DB.prepare(`delete from mark where target in (select 'r' || r.id from reply r join post p on p.id = r.post where p.who = ?)
                        or target in (select 'p' || id from post where who = ?)
                        or target in (select 'r' || id from reply where who = ?)`).bind(me, me, me),
      env.DB.prepare('delete from reply where post in (select id from post where who = ?)').bind(me),
      ...ERASE.map(tb => env.DB.prepare(`delete from ${tb} where who = ?`).bind(me)),
      /* 맞대결 판은 who 칸이 없다(a·b) — 내가 낀 판은 따로 지운다 */
      env.DB.prepare('delete from duel where a = ? or b = ?').bind(me, me),
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

/* ── 커뮤니티 ────────────────────────────────────────────
   사이트 안의 게시판. 읽기는 누구나, 쓰기는 로그인하고 닉네임을 정한 사람만.
   글은 평문이다 — 서버는 HTML 을 짓지 않고, 화면(community.js)은 textContent 로만
   그린다. 여기서는 보이지 않는 글자(제어·서식·방향 뒤집기)만 턴다.
   신고가 FLAGS 개 쌓이면 읽는 쿼리에서 빠진다. 사람 손 검토는 wrangler d1 로 한다.
   ponytail: 운영자 화면이 없다. 시달리면 mark 에서 flag 순으로 읽는 관리 경로를 연다. */
export const TAGS = ['brag', 'ask', 'idea', 'chat'];
const FLAGS = 3, PAGE = 20;
const CM = { title: 60, body: 2000, reply: 500 };
/* 여러 줄 글. 줄바꿈만 살리고 나머지 보이지 않는 글자는 지운다. 빈 줄은 하나까지 */
const prose = (s, n) => String(s ?? '').replace(/\r\n?|[\u2028\u2029]/g, '\n')
  .replace(/[^\P{C}\n]/gu, '').replace(/[^\S\n]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);

export function cmPost(c) {
  const tag = TAGS.includes(c?.tag) ? c.tag : '';
  const title = plain(c?.title, CM.title), body = prose(c?.body, CM.body);
  return { tag, title, body, ok: !!(tag && title && body) };
}
export const cmReply = c => {
  const post = Number(c?.post), body = prose(c?.body, CM.reply);
  return { post, body, ok: Number.isInteger(post) && post > 0 && !!body };
};
/* 공감·신고·지우기의 대상. 'p12' 는 글, 'r40' 은 댓글 */
export const cmTarget = s => /^[pr][1-9]\d{0,15}$/.test(String(s ?? '')) ? String(s) : '';

/* 글쓴이는 이름·아이디만 보인다. 비공개(shut)면 둘 다 빈다 — 화면이 '익명' 으로 건다.
   who 는 내보내지 않고 '내 글인가' 하나로 접는다 */
const AUTHOR = `case when a.shut = 1 then '' else coalesce(a.name, '') end as name,
                case when a.shut = 1 then '' else coalesce(a.handle, '') end as handle`;
/* 신고는 가입한 지 사흘 넘은 계정 것만 센다 — 새 계정 셋을 급히 만들어 남의 글을 가리는 길을 좁힌다.
   가려진 글은 지워지지 않는다. 사람이 mark 를 읽어 신고를 거두면 도로 선다 */
const FLAG_AGE = 3 * 864e5;
const hidden = t => `(select count(*) from mark f join user u on u.id = f.who
   where f.kind = 'flag' and f.target = ${t} and u.at < ${Date.now() - FLAG_AGE}) >= ${FLAGS}`;
const ups = t => `(select count(*) from mark u where u.kind = 'up' and u.target = ${t})`;
const mineOf = (rows, me) => rows.map(({ who, ...r }) => ({ ...r, mine: !!me && who === me }));

async function cmList(req, env, o) {
  const u = new URL(req.url);
  const tag = TAGS.includes(u.searchParams.get('tag')) ? u.searchParams.get('tag') : '';
  const before = Number(u.searchParams.get('before')) || 9e15;
  const me = await sessionWho(env, req);
  return safely(o, async () => {
    const { results } = await env.DB.prepare(
      `select p.id, p.who, p.tag, p.title, substr(p.body, 1, 140) as lead, p.at, ${AUTHOR},
              ${ups("'p' || p.id")} as ups,
              (select count(*) from reply r where r.post = p.id) as replies
         from post p left join profile a on a.who = p.who
        where p.id < ? and (? = '' or p.tag = ?) and not ${hidden("'p' || p.id")}
        order by p.id desc limit ?`
    ).bind(before, tag, tag, PAGE + 1).all();
    return send(200, { posts: mineOf(results.slice(0, PAGE), me), more: results.length > PAGE }, o);
  });
}

async function cmRead(req, env, o) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return reply(400, '없는 글입니다.', o);
  const me = await sessionWho(env, req);
  return safely(o, async () => {
    const [p, r, m] = await env.DB.batch([
      env.DB.prepare(
        `select p.id, p.who, p.tag, p.title, p.body, p.at, ${AUTHOR}, ${ups("'p' || p.id")} as ups
           from post p left join profile a on a.who = p.who
          where p.id = ? and not ${hidden("'p' || p.id")}`).bind(id),
      env.DB.prepare(
        `select r.id, r.who, r.body, r.at, ${AUTHOR}
           from reply r left join profile a on a.who = r.who
          where r.post = ? and not ${hidden("'r' || r.id")} order by r.id limit 200`).bind(id),
      /* 내가 이 글과 댓글들에 무엇을 눌렀는지. 로그인 안 했으면 빈손이다 */
      env.DB.prepare(`select kind, target from mark where who = ? and (target = ? or target in
                        (select 'r' || id from reply where post = ?))`).bind(me ?? '', 'p' + id, id),
    ]);
    const post = p.results[0];
    if (!post) return reply(404, '지워졌거나 가려진 글입니다.', o);
    const marks = m.results.map(x => x.kind + ':' + x.target);
    return send(200, { post: { ...mineOf([post], me)[0], upped: marks.includes('up:p' + id) },
                       replies: mineOf(r.results, me), flagged: marks.filter(x => x.startsWith('flag:')).map(x => x.slice(5)) }, o);
  });
}

/* 쓰는 쪽 공통 문. 로그인 → 창 → 닉네임 순이다. 닉네임이 없으면 남 앞에 걸 이름이
   없다 — 계정을 지운 뒤 남은 토큰도 여기서 걸린다(profile 줄이 없다) */
async function cmWriter(req, env, o) {
  const me = await sessionWho(env, req);
  if (!me) return { no: reply(401, '로그인이 필요합니다.', o) };
  let c;
  try { c = await req.json(); } catch { return { no: reply(400, '읽을 수 없는 내용입니다.', o) }; }
  /* 'null'·숫자·배열도 JSON 이다 — 그대로 두면 c.target 에서 터져 엉뚱한 503 이 나간다 */
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { no: reply(400, '읽을 수 없는 내용입니다.', o) };
  const ok = await pass(env.RL_CM, ip(req));
  /* 창은 IP 와 계정 둘 다 센다 — IP 를 갈아 끼우는 한 계정도 분당 8 번에서 멈춘다 */
  const ok2 = ok === true && await pass(env.RL_CM, 'u:' + me);
  if (ok !== true || ok2 !== true) return { no: shut(ok === true ? ok2 : ok, o) };
  const named = await env.DB.prepare("select 1 from profile where who = ? and name <> ''").bind(me).first();
  if (!named) return { no: send(409, { msg: '닉네임을 먼저 정해 주세요.', noname: true }, o) };
  return { me, c };
}

async function cmWrite(req, env, o, path) {
  return safely(o, async () => {
    const { me, c, no } = await cmWriter(req, env, o);
    if (no) return no;
    const now = Date.now();
    if (path === '/cm/post') {
      const p = cmPost(c);
      if (!p.ok) return reply(400, '주제·제목·내용을 모두 채워 주세요.', o);
      const r = await env.DB.prepare('insert into post (who, tag, title, body, at) values (?, ?, ?, ?, ?) returning id')
        .bind(me, p.tag, p.title, p.body, now).first();
      return send(201, { id: r.id }, o);
    }
    if (path === '/cm/reply') {
      const r = cmReply(c);
      if (!r.ok) return reply(400, '댓글이 비어 있습니다.', o);
      const row = await env.DB.prepare(
        `insert into reply (post, who, body, at) select p.id, ?, ?, ? from post p
           where p.id = ? and not ${hidden("'p' || p.id")} returning id`)
        .bind(me, r.body, now, r.post).first();
      if (!row) return reply(404, '지워진 글입니다.', o);
      return send(201, { id: row.id }, o);
    }
    const t = cmTarget(c.target);
    if (!t) return reply(400, '대상이 이상합니다.', o);
    const [kind, id] = [t[0], Number(t.slice(1))];
    if (path === '/cm/up' || path === '/cm/flag') {
      const k = path === '/cm/up' ? 'up' : 'flag';
      /* 공감은 누를 때마다 켜고 끈다. 신고는 한 번 하면 거두지 않는다 */
      const had = k === 'up' && await env.DB.prepare(
        "delete from mark where who = ? and kind = 'up' and target = ? returning 1").bind(me, t).first();
      if (!had) {
        /* 신고로 가려진 글·댓글에는 더 달지 않는다 — 안 보이는 곳에 줄만 쌓인다.
           hidden() 안의 id 는 user 표와 겹치므로 x.id 로 못 박는다 */
        const tb = kind === 'p' ? 'post' : 'reply';
        const live = `from ${tb} x where x.id = ? and not ${hidden(`'${kind}' || x.id`)}`
          + (kind === 'r' ? ` and not ${hidden("'p' || x.post")}` : '');   // 가려진 글 밑의 댓글도
        const r = await env.DB.prepare(`insert or ignore into mark (who, kind, target, at) select ?, ?, ?, ? ${live}`)
          .bind(me, k, t, now, id).run();
        const there = r.meta?.changes || await env.DB.prepare(`select 1 ${live}`).bind(id).first();
        if (!there) return reply(404, '지워진 글입니다.', o);
      }
      const n = await env.DB.prepare('select count(*) as n from mark where kind = ? and target = ?').bind(k, t).first('n');
      return send(200, k === 'up' ? { on: !had, n } : { on: true }, o);
    }
    if (path === '/cm/del') {
      /* 제 것만 지운다. 글을 지우면 딸린 댓글과 그 표시도 같이 간다 */
      const tb = kind === 'p' ? 'post' : 'reply';
      const gone = await env.DB.prepare(`delete from ${tb} where id = ? and who = ? returning id`).bind(id, me).first();
      if (!gone) return reply(404, '지울 수 없는 글입니다.', o);
      await env.DB.batch(kind === 'p' ? [
        env.DB.prepare(`delete from mark where target = ? or target in (select 'r' || id from reply where post = ?)`).bind(t, id),
        env.DB.prepare('delete from reply where post = ?').bind(id),
      ] : [env.DB.prepare('delete from mark where target = ?').bind(t)]);
      return send(200, {}, o);
    }
    return reply(405, '받지 않는 요청입니다.', o);
  });
}

/* ── 봇 대화 ────────────────────────────────────────────
   홈의 Grok 봇이 NVIDIA NIM(OpenAI 꼴 API) 무료 모델에 묻는다. 키(NV_KEY)는 여기에만
   있다 — GH_TOKEN 과 같은 까닭이다. 시스템 말은 여기서만 짓고, 브라우저는 대화와
   고를 수 있는 코스 목록만 보낸다. 봇이 사이트를 움직이는 길(do)은 아래 BOT_ACTS
   (시작·열기·설정)뿐이고, 여기서 한 번, 브라우저(ranked.js)에서 한 번 더 거른다.
       wrangler secret put NV_KEY      // build.nvidia.com 의 API 키 (nvapi-…)
   ponytail: 모델이 JSON 을 약속만 한다(response_format 은 모델마다 달라 안 쓴다).
   못 읽으면 글 전체를 말로만 쓴다 — 틀린 동작보다 동작 없음이 낫다. */
const NV = 'https://integrate.api.nvidia.com/v1/chat/completions';
/* 무료 모델을 이 차례로 돌려 쓴다. [vars] NV_MODELS 에 쉼표로 적으면 그걸 따른다.
   모델마다 하루 토큰 예산(NV_BUDGET, 기본 NV_DAY)을 두고, 이번 물음이 쓸 만큼
   (어림한 들어갈 토큰 + max_tokens)을 더해 넘칠 모델은 묻기 전에 건너뛴다 — 한도에
   부딪혀 429 를 받고서야 갈아타지 않는다. 쓴 양은 답의 usage 로 세어 D1(botuse)에 쌓는다.
   그래도 429·5xx·시간 초과(25초 — 생각하는 모델은 10초를 넘긴다)가 나면 다음 모델로 넘긴다(한 물음에 BOT_TRIES 번까지). 200 을
   받았으면 답이 비었어도 거기서 끝낸다 — 빈 답을 유도해 모델마다 예산을 깎게 두지 않는다.
   ponytail: 어림은 글자 수로 한다(한글·한자 한 글자 = 1, 그 밖 4글자 = 1). 모델마다
   토크나이저가 달라 정확히 못 맞추니 예산을 넉넉히 밑돌게 잡는다 */
/* 차례는 잰 속도순이다(2026-09-29, 이 키로): nemotron-3-super 1.6초, glm-5.3-flash 20초,
   deepseek-v4.1-flash 22~25초. kimi-k2.6·gemma-3-12b·mistral-large-2·llama-3.1-nemotron-70b 는
   목록에 있어도 이 키엔 404, gemma-4-31b·nemotron-3.5-lightning·gpt-oss-20b 는 25초를 넘겨 뺐다 */
const NV_MODELS = ['nvidia/nemotron-3-super-120b-a12b', 'z-ai/glm-5.3-flash', 'deepseek-ai/deepseek-v4.1-flash'];
const NV_DAY = 200000, BOT_OUT = 400, BOT_TRIES = 2;
const DAY_MS = 86400000;
const BOT_PAGES = ['home', 'ranking', 'records', 'settings', 'community', 'about', 'signin', 'account', 'feedback'];
/* 봇이 바꿀 수 있는 설정과 그 값. app.js·settings.js 의 DEF 와 같은 키다(lang·country 는
   개발 중이라 뺀다). time 은 순위표가 판마다 갈리는 그 값들이다 */
const ONOFF = [true, false];
export const BOT_SET = { night: ONOFF, sound: ONOFF, motion: ONOFF, grid: ONOFF, hint: ONOFF,
                         unit: ['auto', 'cpm', 'wpm'], dong: ['admin', 'legal'], time: TIMES };
const BOT_TURNS = 12, BOT_LINE = 400, BOT_COURSES = 80;

/* 브라우저가 보낸 몸통을 다듬는다. system 은 받지 않는다 — 역할은 user·assistant 둘뿐 */
export function botAsk(c) {
  const msgs = (Array.isArray(c?.msgs) ? c.msgs : []).slice(-BOT_TURNS)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: cut(m.content, BOT_LINE) }))
    .filter(m => m.content);
  const courses = (Array.isArray(c?.courses) ? c.courses : []).slice(0, BOT_COURSES)
    .map(x => ({ slug: cut(x?.slug, 40), label: plain(x?.label, 40) }))
    .filter(x => /^[\w-]+$/.test(x.slug) && x.label);
  return { msgs, courses, lang: plain(c?.lang, 8) || 'ko', name: plain(c?.name, CAP.botname) || 'Grok',
           ok: msgs.length > 0 && msgs[msgs.length - 1].role === 'user' };
}

export function botSystem({ courses, lang, name }) {
  return `You are ${name}, a small round mascot bot living on the home screen of regiontype.com, ` +
    'a typing game where players type place names (districts, provinces) on a map as fast as they can. ' +
    `Reply in the user's language (site language: ${lang}), always politely (in Korean use 존댓말, never 반말). ` +
    'Be short and friendly, one to three sentences. You can run the whole site for the user.\n' +
    'Facts: pick a course and press Start for a normal game (time limit from settings). Ranked: ' +
    '120 seconds, needs sign-in and a leaderboard name; LP goes up or down with the score, accuracy under 80% ' +
    'loses LP even on a win, leaving mid-game costs 25 LP. Leaderboards are per course and time limit, ' +
    'and PC and phone players have separate leaderboards and ranked ladders. ' +
    'Seoul dongs can be administrative (admin) or legal (legal).\n' +
    'Answer ONLY with one JSON object, no code fence: {"say":"what you say","do":[actions]}. ' +
    'Actions (do may be empty, at most 3):\n' +
    '{"act":"start","course":"<slug>"} starts a normal game on that course.\n' +
    '{"act":"start","course":"<slug>","ranked":true} starts a ranked game on that course.\n' +
    `{"act":"open","page":"<${BOT_PAGES.join('|')}>"} opens that screen (feedback = the feedback form).\n` +
    '{"act":"set","key":"<key>","value":<value>} changes a setting: ' +
    Object.entries(BOT_SET).map(([k, v]) => `${k} ${v.map(x => JSON.stringify(x)).join('|')}`).join('; ') +
    ' (night = dark mode, motion = animations, grid = background grid, hint = show the place name, ' +
    'unit = speed unit, dong = Seoul dong kind, time = seconds per game).\n' +
    'Only act when the user asks. If you cannot do exactly what was asked, say so and ask — never swap in ' +
    'a different action. Never invent a slug. Courses (slug: name):\n' +
    courses.map(x => `${x.slug}: ${x.label}`).join('\n');
}

/* 모델의 답을 말과 동작으로 가른다. 모르는 동작·없는 코스는 버린다 */
export function botAct(text, courses) {
  const raw = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  let j = null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) try { j = JSON.parse(m[0]); } catch {}
  if (!j || typeof j !== 'object') return { say: cut(raw, BOT_LINE), do: [] };
  const slugs = new Set(courses.map(x => x.slug));
  const acts = (Array.isArray(j.do) ? j.do : []).slice(0, 3).map(a => {
    if (a?.act === 'start' && slugs.has(a.course)) return { act: 'start', course: a.course, ranked: a.ranked === true };
    if (a?.act === 'open' && BOT_PAGES.includes(a.page)) return { act: 'open', page: a.page };
    if (a?.act === 'set' && Object.hasOwn(BOT_SET, a.key) && BOT_SET[a.key].includes(a.value)) {
      return { act: 'set', key: a.key, value: a.value };
    }
    return null;
  }).filter(Boolean);
  return { say: cut(j.say, BOT_LINE), do: acts };
}

/* 토큰 어림. 메시지마다 역할 표시 몫으로 4 를 더한다 */
export function botTokens(msgs) {
  return msgs.reduce((n, m) => {
    const t = String(m.content ?? '');
    const wide = (t.match(/[^\x00-\x7f]/g) || []).length;
    return n + 4 + wide + Math.ceil((t.length - wide) / 4);
  }, 0);
}

/* 오늘 예산 안에 이번 물음(need)이 들어가는 모델만, 정한 차례대로 */
export function botRoute(models, used, need, budget) {
  return models.filter(m => (used[m] || 0) + need <= budget);
}

async function botUsed(env, day) {
  try {
    const r = await env.DB.prepare('select model, tok from botuse where day = ?').bind(day).all();
    return Object.fromEntries((r.results || []).map(x => [x.model, x.tok]));
  } catch { console.warn('botuse: 읽지 못함 — 예산 없이 돈다'); return {}; }   // 표가 아직 없거나 D1 이 넘어져도 대화는 돈다 — 실패 시 갈아타기만 남는다
}

async function botSpend(env, day, model, tok) {
  try {
    await env.DB.batch([
      env.DB.prepare('insert into botuse (model, day, tok) values (?, ?, ?) on conflict (model, day) do update set tok = tok + excluded.tok')
        .bind(model, day, tok),
      env.DB.prepare('delete from botuse where day < ?').bind(day - 1),
    ]);
  } catch { console.warn('botuse: 적지 못함'); }
}

async function botChat(req, env, o) {
  if (!env.NV_KEY) return reply(503, '봇 대화는 아직 열리지 않았습니다.', o);
  /* IP 창에 더해 모두가 나눠 쓰는 창 하나 — IP 를 돌려 가며 무료 키 한도를 다 먹어
     모든 사람의 봇을 429 로 만드는 걸 막는다. 이 창에 걸리면 모두가 잠깐 쉰다 */
  const ok = await pass(env.RL_BT, ip(req));
  if (ok !== true) return shut(ok, o);
  const all = await pass(env.RL_BA, 'all');
  if (all !== true) return shut(all, o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const a = botAsk(c);
  if (!a.ok) return reply(400, '할 말이 없습니다.', o);
  const messages = [{ role: 'system', content: botSystem(a) }, ...a.msgs];
  const models = String(env.NV_MODELS || env.NV_MODEL || '').split(',').map(x => x.trim()).filter(Boolean);
  const day = Math.floor(Date.now() / DAY_MS);
  const need = botTokens(messages) + BOT_OUT;
  const route = botRoute(models.length ? models : NV_MODELS, await botUsed(env, day), need,
                         Number(env.NV_BUDGET) || NV_DAY).slice(0, BOT_TRIES);
  if (!route.length) return reply(429, '오늘 봇이 쓸 수 있는 몫을 다 썼습니다.', o);
  let busy = false;
  /* 맨 앞 모델이 곧바로(2초 안) 5xx 를 주면 느린 예비로 넘기 전에 그 모델에 한 번 더 묻는다 —
     nemotron 은 가끔 0.1초 만에 503 을 주고 다음 번엔 멀쩡히 답한다 */
  const tries = [...route];
  for (let i = 0; i < tries.length; i++) {
    const model = tries[i];
    let r;
    const t0 = Date.now();
    try {
      r = await fetch(NV, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.NV_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: BOT_OUT, temperature: 0.6, messages }),
        /* 맨 앞 모델은 평소 3초 안에 답한다 — 가끔 멈출 때 25초를 다 기다리지 않게 8초에 끊는다.
           NV_MODELS 로 느린 모델을 맨 앞에 두면 이 8초에 걸린다 */
        signal: AbortSignal.timeout(model === route[0] ? 8000 : 25000),
      });
    } catch (e) { console.warn('bot', model, e?.name, Date.now() - t0); continue; }
    console.log('bot', model, r.status, Date.now() - t0);
    if (!r.ok) {
      busy ||= r.status === 429;
      if (i === 0 && r.status >= 500 && Date.now() - t0 < 2000) tries.splice(1, 0, model);
      continue;
    }
    const d = await r.json().catch(() => null);
    const text = d?.choices?.[0]?.message?.content;
    await botSpend(env, day, model, d?.usage?.total_tokens || need - BOT_OUT + botTokens([{ content: text }]));
    const out = botAct(text, a.courses);
    return out.say || out.do.length ? send(200, out, o) : reply(502, '봇이 대답하지 못했습니다.', o);
  }
  return reply(busy ? 429 : 502, '봇이 대답하지 못했습니다.', o);
}

/* ── 지금 접속 ── 사이트가 보이는 탭마다 ONLINE_PING 에 한 번 {id} 를 두드린다. id 는 탭이
   지은 난수라 사람도 계정도 가리키지 않는다(who 가 아니다 — 계정을 지워도 지울 줄이 없다).
   ONLINE_MS 안에 두드린 탭 수가 '지금 접속'이고, 경쟁전 짝 맞추기도 이 표를 읽을 것이다.
   세기와 지난 줄 걷기는 격리 하나에 ONLINE_FRESH 에 한 번만 한다 — 두드릴 때마다 표를
   훑으면 D1 읽기가 접속 수의 제곱으로 는다.
   ponytail: 한 IP 가 창(RL_ON) 안에서 id 를 바꿔 가며 숫자를 부풀릴 수 있다. 짝 맞추기에
   쓸 때는 로그인한 사람만 센다 */
export const ONLINE_PING = 120000, ONLINE_MS = 300000, ONLINE_FRESH = 15000;
export const onlineId = c => {
  const id = String(c?.id ?? '');
  return /^[0-9a-f]{32}$/.test(id) ? id : '';
};
let onlineNow = { n: 0, at: 0 };
async function online(req, env, o) {
  const ok = await pass(env.RL_ON, ip(req));
  if (ok !== true) return shut(ok, o);
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const id = onlineId(c);
  if (!id) return reply(400, '읽을 수 없는 내용입니다.', o);
  const now = Date.now();
  const mark = env.DB.prepare('insert into online (id, at) values (?, ?) on conflict (id) do update set at = excluded.at')
    .bind(id, now);
  if (now - onlineNow.at < ONLINE_FRESH) {
    await mark.run();
    return send(200, { n: Math.max(1, onlineNow.n) }, o);
  }
  const [, , row] = await env.DB.batch([
    mark,
    env.DB.prepare('delete from online where at < ?').bind(now - ONLINE_MS),
    env.DB.prepare('select count(*) as n from online'),
  ]);
  onlineNow = { n: row.results[0].n, at: now };
  return send(200, { n: onlineNow.n }, o);
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
    if (path.startsWith('/compete/')) return competeRoute(req, env, o, path);
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
        if (path === '/auth/dev' && devLoginOn(env, req.url)) return authDev(req, env, o);
      }
    }
    /* 순위표는 D1 을 붙이기 전에도 사이트가 멀쩡해야 한다 — 없으면 없다고만 한다 */
    if (path === '/top' || path === '/dist' || path === '/forget') {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      if (path === '/top' && req.method === 'GET') return top(req, env, o);
      if (path === '/dist' && req.method === 'POST') return dist(req, env, o);
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
    if (path.startsWith('/match/') && req.method === 'POST') {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      if (path === '/match/find') return matchFind(req, env, o);
      if (path === '/match/leave') return matchLeave(req, env, o);
      if (path === '/match/tick') return matchTick(req, env, o);
    }
    if (path === '/bot/chat' && req.method === 'POST') return botChat(req, env, o);
    if (path === '/online' && req.method === 'POST') {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      return online(req, env, o);
    }
    if (path.startsWith('/cm/')) {
      if (!env.DB) return reply(503, '커뮤니티는 아직 열리지 않았습니다.', o);
      if (req.method === 'GET') {
        /* 읽기도 느슨한 창을 둔다. 존 규칙은 POST 만 세서 GET 반복이 D1 읽기를 태운다 */
        const ok = await pass(env.RL_CR, ip(req));
        if (ok !== true) return shut(ok, o);
      }
      if (path === '/cm/list' && req.method === 'GET') return cmList(req, env, o);
      if (path === '/cm/read' && req.method === 'GET') return cmRead(req, env, o);
      if (req.method === 'POST' && ['/cm/post', '/cm/reply', '/cm/up', '/cm/flag', '/cm/del'].includes(path)) {
        if (!env.SESSION_KEY) return nokey(o);
        return cmWrite(req, env, o, path);
      }
    }
    return reply(405, '받지 않는 요청입니다.', o);
  },
};
