/* regiontype 중계기 — 정적 사이트가 혼자 못 하는 두 가지만 한다.

     POST /         피드백을 GitHub 이슈로 옮긴다 (토큰을 사이트에 둘 수 없다)
     POST /score    판 하나의 점수를 순위표에 올린다
     GET  /top      그 판의 상위 기록을 읽는다
     POST /dist     그 판의 점수 분포와 그 안에서 내가 선 자리
     POST /forget   내 줄을 전부 내린다

     POST /auth/new  패스키 만들기 시작 → 챌린지
     POST /auth/reg  패스키 만들기 끝  → 세션 토큰
     POST /auth/go   로그인 시작       → 챌린지
     POST /auth/log  로그인 끝         → 세션 토큰
     GET  /where    이 요청의 나라 코드 (cf.country). 도시는 안 보낸다

       wrangler secret put SESSION_KEY  // 아무 긴 난수. 갈면 모든 세션이 끊긴다

       wrangler d1 create rt-board
       wrangler d1 execute rt-board --remote --file schema.sql
       wrangler secret put GH_TOKEN     // 그 저장소의 Issues 쓰기만 가진 세밀 토큰
       wrangler deploy                                                        */

import { sign, who as sessionWho, rand, hex, b64u, unb64u,
         readClientData, readAuthData, verify, sha, eq } from './auth.mjs';
import { SIZE } from './size.mjs';

const REPO = 'pistolinkr/regiontype.com';
const SITE = ['https://regiontype.com', 'https://www.regiontype.com'];
const KIND = { bug: '버그', idea: '제안', data: '지명·정보 오류' };
const CAP = { body: 500, v: 16, href: 300, ua: 300, name: 12 };
/* 제한 시간이 다르면 다른 판이다. app.js 의 TIMES 와 같아야 한다 */
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
const mine = o => SITE.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

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
    labels: [KIND[kind]],
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

const head = o => ({
  'access-control-allow-origin': mine(o) ? o : SITE[0],
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400',
});
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
  if (!r.ok) return reply(502, 'GitHub 이 받지 않았습니다. 잠시 뒤 다시 시도해 주세요.', o);
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
   패스키만 먼저 놓는다. 메일 링크는 발송처(API 키)가 정해지면 여기에 얹는다.
   rpId 는 페이지가 있는 도메인이어야 한다 — 중계기 도메인이 아니다.
   그래서 요청한 곳에서 뽑되, 우리가 아는 곳인지 mine() 으로 먼저 거른다. */
const RPNAME = 'regiontype';
const ALGS = [-7, -257];   // ES256 · RS256
const rpOf = o => new URL(o).hostname;
const LIVE = 5 * 60e3;   // 챌린지가 사는 시간

const nokey = o => reply(503, '로그인 설정이 덜 되었습니다.', o);

/* 챌린지 한 장을 낸다. 우리가 낸 것만 받으려고 표에 적어 둔다 —
   적지 않으면 아무 값이나 챌린지라고 들고 와 서명해 보일 수 있다. */
async function challenge(env, kind, who = null) {
  const id = rand(32);
  await env.DB.prepare('insert into pending (id, kind, who, until) values (?, ?, ?, ?)')
    .bind(id, kind, who, Date.now() + LIVE).run();
  return id;
}
/* 한 번 쓰면 지운다. 지나간 것도 여기서 함께 쓸어낸다 — 따로 청소할 곳을 두지 않는다 */
async function claim(env, id, kind) {
  const row = await env.DB.prepare(
    'select who, until from pending where id = ? and kind = ?').bind(id, kind).first();
  await env.DB.batch([
    env.DB.prepare('delete from pending where id = ?').bind(id),
    env.DB.prepare('delete from pending where until < ?').bind(Date.now()),
  ]);
  return row && row.until > Date.now() ? row : null;
}

async function authNew(req, env, o) {
  const me = await sessionWho(env, req);            // 있으면 기기를 더하는 것이다
  return safely(o, async () => send(200, {
    challenge: await challenge(env, 'reg', me),
    rp: { id: rpOf(o), name: RPNAME },
    /* 사람 이름을 안 받는다. id 는 난수고, 화면에 뜨는 이름도 그 난수의 앞머리다 —
       패스키 목록에 남의 메일 주소가 적히는 일이 없다. */
    user: me || hex(16),
  }, o));
}

/* 등록 마무리. attestation 을 안 받으므로 공개키는 브라우저가 준 것을 그대로 믿는다 —
   등록은 원래 신뢰를 처음 세우는 순간이라, 남이 아니라 자기 키를 넣을 뿐이다.
   우리가 여기서 지키는 건 '이 챌린지에, 이 출처에서 답했다' 이다. */
async function authReg(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const id = cut(c.id, 400), key = cut(c.key, 2000), alg = Number(c.alg);
  if (!id || !key || !ALGS.includes(alg)) return reply(400, '만들 수 없는 패스키입니다.', o);

  return safely(o, async () => {
    const row = await claim(env, cut(c.challenge, 100), 'reg');
    if (!row) return reply(400, '만료되었거나 우리가 낸 요청이 아닙니다.', o);
    const bad = readClientData(c.clientDataJSON, 'webauthn.create', cut(c.challenge, 100), SITE.concat(o));
    if (bad) return reply(400, bad, o);
    const a = readAuthData(unb64u(c.authData));
    if (!a || !a.up) return reply(400, '기기가 확인해 주지 않았습니다.', o);
    if (!eq(a.rpIdHash, await sha(rpOf(o)))) return reply(400, '다른 곳에서 만든 패스키입니다.', o);

    const me = row.who || hex(16);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('insert or ignore into user (id, mail, at) values (?, null, ?)').bind(me, now),
      env.DB.prepare(
        'insert into passkey (id, who, key, alg, count, at) values (?, ?, ?, ?, ?, ?)'
      ).bind(id, me, key, alg, a.count, now),
    ]);
    return send(201, { token: await sign(env.SESSION_KEY, me), user: me }, o);
  });
}

async function authGo(req, env, o) {
  return safely(o, async () => send(200, { challenge: await challenge(env, 'log') }, o));
}

async function authLog(req, env, o) {
  let c;
  try { c = await req.json(); } catch { return reply(400, '읽을 수 없는 내용입니다.', o); }
  const id = cut(c.id, 400);
  return safely(o, async () => {
    const row = await claim(env, cut(c.challenge, 100), 'log');
    if (!row) return reply(400, '만료되었거나 우리가 낸 요청이 아닙니다.', o);
    const bad = readClientData(c.clientDataJSON, 'webauthn.get', cut(c.challenge, 100), SITE.concat(o));
    if (bad) return reply(400, bad, o);
    const a = readAuthData(unb64u(c.authData));
    if (!a || !a.up) return reply(400, '기기가 확인해 주지 않았습니다.', o);
    if (!eq(a.rpIdHash, await sha(rpOf(o)))) return reply(400, '다른 곳의 패스키입니다.', o);

    const k = await env.DB.prepare('select who, key, alg, count from passkey where id = ?')
      .bind(id).first();
    if (!k) return reply(401, '모르는 패스키입니다.', o);
    const ok = await verify({ alg: k.alg, key: k.key, authData: c.authData,
                              clientDataJSON: c.clientDataJSON, signature: cut(c.sig, 2000) });
    if (!ok) return reply(401, '서명이 맞지 않습니다.', o);
    /* 셈이 뒤로 가면 복제된 기기다. 0 을 그대로 두는 인증기가 많아 0 은 안 본다 */
    if (a.count && k.count && a.count <= k.count) return reply(401, '복제된 기기로 보입니다.', o);
    await env.DB.prepare('update passkey set count = ? where id = ?').bind(a.count, id).run();
    return send(200, { token: await sign(env.SESSION_KEY, k.who), user: k.who }, o);
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
    const o = req.headers.get('origin') || '';
    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: head(o) });
    if (!mine(o)) return reply(403, '허용된 곳이 아닙니다.', o);

    if (path === '/' && req.method === 'POST') return feedback(req, env, o);
    if (path === '/where' && req.method === 'GET') {
      return send(200, regionOf(req.cf, req.headers.get('accept-language')), o);
    }

    if (path.startsWith('/auth/')) {
      if (!env.DB) return reply(503, '순위표는 아직 열리지 않았습니다.', o);
      if (!env.SESSION_KEY) return nokey(o);
      if (req.method === 'POST') {
        /* 로그인 시도도 창을 센다 — 패스키를 찍어 맞히려는 반복을 막는다.
           점수 창(분당 3)과 나눠 쓰면 등록 두 번에 다 써버려 정작 못 올린다 */
        const ok = await pass(env.RL_AU, ip(req));
        if (ok !== true) return shut(ok, o);
        if (path === '/auth/new') return authNew(req, env, o);
        if (path === '/auth/reg') return authReg(req, env, o);
        if (path === '/auth/go') return authGo(req, env, o);
        if (path === '/auth/log') return authLog(req, env, o);
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
