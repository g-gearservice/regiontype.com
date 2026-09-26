/* node relay/test.mjs — 이슈 한 장이 제대로 지어지는지만 본다 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import relayWorker, { compose, entry, where, regionOf, allowedOrigin,
         lpDelta, WANT, rankedCheck, profile, intro, ERASE, RANKED_SECS,
         cmPost, cmTarget } from './worker.mjs';
import { sign, open, derToRaw, readClientData, readAuthData, b64u, rand, sha, mac } from './auth.mjs';
import { RULES, check, tally } from './security-rules.mjs';
/* 검사는 대부분 '몸통' 만 흔든다 — 주인은 늘 같은 값으로 고정해 둔다 */
const entry2 = (c, me = ME) => entry(c, me);

const base = { kind: 'bug', body: '가양1동이 오답으로 처리됩니다',
               v: '0.40', href: 'https://regiontype.com/', ua: 'UA' };

const a = compose(base);
assert.equal(a.title, '[버그] 가양1동이 오답으로 처리됩니다', '제목 = 종류 + 첫 줄');
assert.deepEqual(a.labels, ['bug']);
assert.ok(a.body.includes('```\n종류: 버그'), '메타는 코드 블록 안에 가둔다');

/* 이슈는 공개다. 사이트에 입력칸이 없어도 여기서 받으면 아무나 남의 주소를 박는다 */
const b = compose({ ...base, from: 'me@x.com' });
assert.ok(!b.body.includes('회신'), '회신 주소는 받지 않는다');
assert.ok(!b.body.includes('me@x.com') && !b.body.includes('me [at] x.com'),
          '보내온 주소는 어떤 모양으로도 남기지 않는다');

/* 남이 보낸 값으로 이슈 서식을 흔들 수 없어야 한다 */
const c = compose({ ...base, ua: '```\n# 관리자 공지', kind: '../evil' });
assert.deepEqual(c.labels, ['bug'], '모르는 종류는 bug 로 떨어뜨린다');
assert.deepEqual(compose({ ...base, kind: 'idea' }).labels, ['enhancement']);
assert.ok(c.title.startsWith('[버그] '));
assert.equal(c.body.split('```').length, 3, '메타의 백틱은 지워져 코드 블록이 하나로 남는다');
assert.ok(!/브라우저:.*\n.*관리자/.test(c.body), '줄바꿈으로 메타를 늘려 쓸 수 없다');

const d = compose({ ...base, body: '가'.repeat(900) });
assert.equal(d.body.split('\n')[0].length, 500, '본문은 500자에서 자른다');
assert.equal(compose({ ...base, body: '   ' }).ok, false, '빈 내용은 거른다');
assert.equal(compose({ ...base, body: '첫 줄\n둘째 줄' }).title, '[버그] 첫 줄', '제목은 첫 줄만');

assert.equal(allowedOrigin('https://regiontype.com'), true);
assert.equal(allowedOrigin('https://www.regiontype.com'), true);
assert.equal(allowedOrigin('http://localhost:3000'), true);
assert.equal(allowedOrigin('https://g-gearservice.github.io/regiontype.com'), true);
assert.equal(allowedOrigin('https://evil.example'), false);

/* ── 경쟁전 lp ─────────────────────────────────────────
   점수가 아니라 타자 속도(CPM, 분당 타수)로 센다 — 코스가 달라도 견줄 수 있는 유일한 값이다 */
assert.equal(lpDelta(0, 10, WANT[0], 100), 3, '기대 속도와 같으면 최소 +3');
assert.equal(lpDelta(0, 10, 150, 100), 20, '브론즈(기대 100)가 150 CPM 이면 +20');
assert.equal(lpDelta(0, 0, 150, 100), 40, '배치 중엔 두 배');
assert.equal(lpDelta(0, 10, 150, 85), 12, '정확도 85% 는 얻는 몫을 .6 으로');
assert.ok(lpDelta(100, 10, 500, 70) < 0, '정확도 80% 아래는 빨라도 잃는다');
assert.equal(lpDelta(250, 10, 180, 100), -8, '골드(기대 200)가 180 CPM 이면 −8');
assert.equal(lpDelta(250, 10, 195, 100), -5, '지면 최소 −5');
assert.equal(lpDelta(3, 10, 0, 100), -3, 'lp 는 0 아래로 안 내려간다');
assert.equal(lpDelta(900, 10, 410, 100), 24, '마스터 위로는 기대가 350 에서 멈춘다');
assert.equal(lpDelta(0, 0, 1500, 100), 50, '한 판에 ±50 을 넘지 않는다');

/* 속도는 맞힌 곳 수에 묶인다 — 한 곳만 치고 아무 속도나 적어 보낼 수 없다 */
const SME = 'a1b2c3d4e5';
const sc = { c: 'seoul-gu', t: 120, name: '나', score: 1000, hits: 10, tries: 12 };
assert.equal(entry({ ...sc, cpm: 120 }, SME).ok, true, '열 곳에 120 CPM 은 통과');
assert.equal(entry({ ...sc, cpm: 500 }, SME).ok, true, '열 곳에 500 CPM 까지는 통과');
assert.equal(entry({ ...sc, cpm: 501 }, SME).ok, false, '한 곳당 50 을 넘을 수 없다');
const big = { c: 'ph-admin', t: 300, name: '나', score: 20000, hits: 40, tries: 40 };
assert.equal(entry({ ...big, cpm: 1500 }, SME).ok, true, '1500 CPM 까지는 통과');
assert.equal(entry({ ...big, cpm: 1501 }, SME).ok, false, '1500 CPM(=300 WPM)이 사람의 천장');
assert.equal(entry({ ...sc, cpm: -1 }, SME).ok, false, '음수 속도는 없다');
assert.equal(entry({ ...sc, cpm: 120 }, SME).acc, 83, '정확도가 안 오면 맞힌 곳 ÷ 시도(옛 앱)');
assert.equal(entry({ ...sc, cpm: 120, acc: 97 }, SME).acc, 97, '키 단위 정확도는 그대로 실린다');
assert.equal(entry({ ...sc, cpm: 120, acc: 101 }, SME).ok, false, '정확도는 100 을 넘지 않는다');
assert.equal(entry({ ...sc, cpm: 120, acc: 9.5 }, SME).ok, false, '정확도는 정수다');
assert.equal(entry({ ...sc }, SME).ok, false, '속도를 안 보내면 거른다');
assert.equal(entry({ ...sc, cpm: 120 }, SME).cpm, 120, '속도는 그대로 실려 나간다');

const tk = { id: 'tk1', slug: 'seoul-gu', at: 0 }, RME = 'a1b2c3d4e5';
const fin = { id: 'tk1', name: '나', score: 1000, cpm: 120, hits: 10, tries: 12 };
assert.equal(rankedCheck(fin, tk, RANKED_SECS * 1000, RME).ok, true, '120초 뒤 끝낸 판');
assert.equal(rankedCheck(fin, tk, 30e3, RME).ok, false, '다 못 쳤는데 120초 전에 끝낼 수 없다');
assert.equal(rankedCheck({ ...fin, id: 'x' }, tk, 130e3, RME).ok, false, '남의 표로 끝낼 수 없다');
assert.equal(rankedCheck({ ...fin, c: 'gangseo-dong', t: 60 }, tk, 130e3, RME).ok, true,
             '코스·시간은 표에서 읽는다 — 몸통이 바꾸지 못한다');
const clear = { ...fin, score: 11500, hits: 25, tries: 25, cpm: 200 };
assert.equal(rankedCheck(clear, tk, 13e3, RME).ok, true, '다 쳤으면 곳당 0.5초 뒤에 끝낼 수 있다');
assert.equal(rankedCheck(clear, tk, 5e3, RME).ok, false, '그보다 빠르면 거짓말');
assert.equal(rankedCheck(fin, tk, 11 * 60e3, RME).ok, false, '10분 넘게 묵은 표는 무효');
console.log('ranked self-check done');

/* ── 피드백 문 앞: IP 창 → Turnstile → GitHub ─────────── */
const fbReq = (body = { ...base, cf: 'human-token' }, ip = '203.0.113.7') => new Request(
  'https://g.gearservicevanguard.com/', {
    method: 'POST',
    headers: { origin: 'https://regiontype.com', 'content-type': 'application/json',
               ...(ip ? { 'cf-connecting-ip': ip } : {}) },
    body: JSON.stringify(body),
  });
const limit = (success, order) => ({ limit: async () => { order?.push('rate'); return { success }; } });
const fbEnv = (over = {}, order) => ({
  RL_FB: limit(true, order), GH_TOKEN: 'bound-at-runtime',
  TURNSTILE_SECRET: 'server-secret', TURNSTILE_SITEKEY: 'public-sitekey', ...over,
});
const status = async (env, body, ip) => (await relayWorker.fetch(fbReq(body, ip), env)).status;
const originalFetch = globalThis.fetch;
try {
  let calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error('외부 호출 금지'); };
  assert.equal(await status(fbEnv({ TURNSTILE_SECRET: '' })), 503, '비밀키가 없으면 닫는다');
  assert.equal(calls.length, 0, '비밀키가 없으면 바깥을 부르지 않는다');
  assert.equal(await status(fbEnv(), { ...base }), 403, '토큰이 없으면 거른다');
  assert.equal(await status(fbEnv(), { ...base, cf: 7 }), 403, '문자열 아닌 토큰은 거른다');
  assert.equal(await status(fbEnv(), { ...base, cf: 'x'.repeat(2049) }), 403, '2KB 넘는 토큰은 거른다');
  assert.equal(calls.length, 0, '틀린 토큰은 Siteverify 도 부르지 않는다');
  assert.equal(await status(fbEnv({ RL_FB: undefined })), 503, 'IP 창이 없으면 닫는다');
  assert.equal(await status(fbEnv({ RL_FB: limit(false) })), 429, 'IP 창이 거절하면 멈춘다');
  assert.equal(calls.length, 0, 'IP 창을 못 지나면 Siteverify 를 부르지 않는다');

  const verdict = async (answer, siteStatus = 200) => {
    let github = 0;
    globalThis.fetch = async url => {
      if (String(url).includes('/siteverify')) return new Response(answer, { status: siteStatus });
      github++; return new Response('{}', { status: 201 });
    };
    const s = await status(fbEnv());
    assert.equal(github, 0, 'Turnstile 실패 뒤 GitHub 을 부르지 않는다');
    return s;
  };
  assert.equal(await verdict('{}', 502), 403, 'Siteverify 비정상 응답은 거른다');
  assert.equal(await verdict('{'), 403, 'Siteverify JSON 오류는 거른다');
  assert.equal(await verdict(JSON.stringify({ success: false })), 403, '실패 판정은 거른다');
  assert.equal(await verdict(JSON.stringify({ success: true, action: 'score', hostname: 'regiontype.com' })), 403,
               '다른 action 토큰은 거른다');
  assert.equal(await verdict(JSON.stringify({ success: true, action: 'feedback', hostname: 'evil.example' })), 403,
               '다른 hostname 토큰은 거른다');
  globalThis.fetch = async () => { throw new Error('network down'); };
  assert.equal(await status(fbEnv()), 403, 'Siteverify 네트워크 오류는 닫는다');
  for (const hostname of ['regiontype.com', 'www.regiontype.com', 'g-gearservice.github.io']) {
    let github = 0;
    globalThis.fetch = async url => {
      if (String(url).includes('/siteverify'))
        return Response.json({ success: true, action: 'feedback', hostname });
      github++; return new Response('{}', { status: 201 });
    };
    assert.equal(await status(fbEnv()), 201, `${hostname} 토큰은 통과한다`);
    assert.equal(github, 1);
  }

  const order = [], sent = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/siteverify')) {
      order.push('turnstile'); sent.push({ u, init });
      return Response.json({ success: true, action: 'feedback', hostname: 'regiontype.com' });
    }
    order.push('github'); sent.push({ u, init });
    return new Response('{}', { status: 201 });
  };
  const ok = await relayWorker.fetch(fbReq(), fbEnv({}, order));
  assert.equal(ok.status, 201);
  assert.deepEqual(order, ['rate', 'turnstile', 'github'], 'IP 창, 사람 확인, GitHub 순서다');
  const form = new URLSearchParams(sent[0].init.body);
  assert.equal(sent[0].init.method, 'POST');
  assert.equal(sent[0].u, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(sent[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
  assert.equal(form.get('secret'), 'server-secret');
  assert.equal(form.get('response'), 'human-token');
  assert.equal(form.get('remoteip'), '203.0.113.7');
  assert.equal(sent[1].init.body.includes('human-token'), false,
               '사람 확인 토큰은 공개 이슈에 싣지 않는다');

  globalThis.fetch = async url => String(url).includes('/siteverify')
    ? Response.json({ success: true, action: 'feedback', hostname: 'regiontype.com' })
    : new Response('{}', { status: 500 });
  const log = console.log; console.log = () => {};
  try { assert.equal(await status(fbEnv()), 502, 'GitHub 실패는 중계기 실패로 감춘다'); }
  finally { console.log = log; }

  sent.length = 0;
  globalThis.fetch = async (url, init) => {
    sent.push({ u: String(url), init });
    return String(url).includes('/siteverify')
      ? Response.json({ success: true, action: 'feedback', hostname: 'regiontype.com' })
      : new Response('{}', { status: 201 });
  };
  await relayWorker.fetch(fbReq(undefined, ''), fbEnv());
  assert.equal(new URLSearchParams(sent[0].init.body).has('remoteip'), false,
               'IP 헤더가 없으면 선택 필드를 보내지 않는다');

  const cfg = await relayWorker.fetch(new Request('https://g.gearservicevanguard.com/turnstile', {
    headers: { origin: 'https://regiontype.com' },
  }), fbEnv());
  assert.equal(cfg.status, 200);
  assert.equal((await cfg.json()).sitekey, 'public-sitekey');
  assert.equal(cfg.headers.get('access-control-allow-origin'), 'https://regiontype.com');
  assert.equal(JSON.stringify(await (await relayWorker.fetch(new Request(
    'https://g.gearservicevanguard.com/turnstile', { headers: { origin: 'https://regiontype.com' } }
  ), fbEnv())).json()).includes('server-secret'), false, '설정 응답에는 비밀키가 없다');
  assert.equal((await relayWorker.fetch(new Request('https://g.gearservicevanguard.com/turnstile', {
    headers: { origin: 'https://evil.example' },
  }), fbEnv())).status, 403, '낯선 출처에는 공개 설정도 주지 않는다');
  assert.equal((await relayWorker.fetch(new Request('https://g.gearservicevanguard.com/turnstile', {
    headers: { origin: 'https://regiontype.com' },
  }), fbEnv({ TURNSTILE_SITEKEY: '' }))).status, 503, '공개키가 없으면 위젯 설정도 닫는다');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('relay self-check done');

/* ── 순위표에 올릴 한 줄 ──────────────────────────── */
const run = { c: 'seoul-gu', t: 120, name: '가나', score: 1500, cpm: 60, hits: 5, tries: 6 };
const ME = 'a1b2c3d4e5';   // 세션에서 읽어 온 주인. 몸통에 실려 오지 않는다

const e = entry(run, ME);
assert.equal(e.ok, true);
assert.equal(e.acc, 83, '정확도는 들른 곳 ÷ 친 횟수');
assert.equal(entry2({ ...run, t: 100 }).ok, false, '없는 제한 시간은 거른다');
assert.equal(entry2({ ...run, c: '../evil' }).ok, false, '코스 이름은 소문자와 하이픈뿐');
assert.equal(entry2({ ...run, c: 'SEOUL' }).ok, false, '대문자도 거른다');

/* 채점은 브라우저가 한다 — 여기서 거를 수 있는 건 말이 안 되는 값뿐이다 */
assert.equal(entry2({ ...run, score: 2600 }).ok, false, '한 곳당 500점을 넘길 수 없다');
assert.equal(entry2({ ...run, score: 2500 }).ok, true, '5곳 × 5배 콤보는 그대로 통과한다');
assert.equal(entry2({ ...run, score: 150 }).ok, false, '100점 배수가 아닌 값은 없다');
assert.equal(entry2({ ...run, hits: 7 }).ok, false, '들른 곳이 친 횟수보다 많을 수 없다');
assert.equal(entry2({ ...run, score: -100 }).ok, false, '음수는 없다');
assert.equal(entry2({ ...run, score: 1.5 }).ok, false, '정수가 아니면 거른다');
assert.equal(entry2({ ...run, hits: 600, tries: 600, score: 0 }).ok, false, '코스보다 큰 판은 없다');

/* 제한 시간이 상한을 하나 더 준다 — 이게 없으면 60초 판에 25만점이 통과한다 */
assert.equal(entry2({ ...run, t: 60, hits: 500, tries: 500, score: 250000 }).ok, false,
             '60초에 500곳은 없다');
assert.equal(entry2({ ...run, t: 300, hits: 26, tries: 26, score: 13000 }).ok, false,
             '25곳짜리 코스에서 26곳을 들를 수는 없다');
assert.equal(entry2({ ...run, t: 300, hits: 25, tries: 25, score: 12500 }).ok, true,
             '정원을 다 채운 만점 판은 통과한다');
assert.equal(entry2({ ...run, c: 'nowhere-dong' }).ok, false, '없는 코스는 판을 만들지 못한다');
/* 25곳짜리 seoul-gu 는 코스 정원이 먼저 걸린다 — 25 × 500 = 12,500 이 천장이다 */
assert.equal(entry2({ ...run, t: 60, score: 12500, hits: 25, tries: 25 }).ok, true,
             '정원을 다 채운 판은 60초에서도 통과한다');
assert.equal(entry2({ ...run, t: 60, score: 12600, hits: 25, tries: 25 }).ok, false,
             '그 위는 거른다');
/* 정원이 큰 코스에서는 시간이 천장을 정한다 — 60초 × 2 = 26곳까지 */
assert.equal(entry2({ ...run, c: 'songpa-dong', t: 60, hits: 26, tries: 26, score: 13000 }).ok,
             true, '26곳짜리 코스는 26곳까지 든다');
assert.equal(entry2({ ...run, t: 300, hits: 25, tries: 30, score: 12500 }).ok, true,
             '5분 판의 만점 기록은 그대로 통과한다');

/* 줄의 주인은 세션에서만 온다 — 몸통에 실어 보낼 길이 없다 */
assert.equal(entry2({ ...run }, '').ok, false, '로그인 없이는 못 올린다');
assert.equal(entry2({ ...run }, 'abc').ok, false, '말이 안 되는 주인은 거른다');
assert.equal(entry2({ ...run }, '../../etc').ok, false, '주인 id 는 영숫자뿐');
assert.equal(entry2({ ...run, who: 'sneaky00000' }, ME).who, ME,
             '몸통에 who 를 실어 보내도 세션의 주인을 이긴다');

/* 이름은 남 앞에 걸린다 */
assert.equal(entry2({ ...run, name: '  가 나  ' }).name, '가 나', '앞뒤 공백은 턴다');
assert.equal(entry2({ ...run, name: '가'.repeat(30) }).name, '가'.repeat(12), '이름은 12자에서 자른다');
assert.equal(entry2({ ...run, name: '가‮나' }).name, '가 나', '방향 뒤집기 글자는 지운다');
assert.equal(entry2({ ...run, name: '가\n나' }).name, '가 나', '줄바꿈으로 두 줄을 차지할 수 없다');
assert.equal(entry2({ ...run, name: '​​' }).ok, false, '보이지 않는 글자만 있는 이름은 거른다');
assert.equal(entry2({ ...run, name: '   ' }).ok, false, '빈 이름은 거른다');

/* SIZE 는 data/*.course.json 에서 뽑아 적은 표다. 코스가 늘거나 항목이 바뀌면
   여기서 어긋난다 — 손으로 옮겨 적은 값이 조용히 낡는 걸 막는 유일한 자리다. */
const dir = new URL('../data/', import.meta.url);
for (const f of readdirSync(dir).filter(n => n.endsWith('.course.json'))) {
  const slug = f.replace('.course.json', '');
  const n = JSON.parse(readFileSync(new URL(f, dir), 'utf8')).items.length;
  assert.equal(where({ c: slug, t: 120 }).size, n, `${slug} 정원이 데이터와 다르다`);
}

console.log('board self-check done');

const loc = regionOf({ country: 'KR', timezone: 'Asia/Seoul' }, 'ko-KR,en;q=0.8');
assert.equal(loc.country, 'KR');
assert.equal(loc.timezone, 'Asia/Seoul');
assert.equal(loc.lang, 'ko-KR');
assert.equal(regionOf({ country: 'XX' }, '').country, '');
assert.equal(regionOf({ country: 'T1' }, '').country, '');
assert.equal(regionOf({ country: 'usa' }, '').country, '');
assert.equal(regionOf({ country: 'KR<script>' }, '').country, '');
assert.ok(!('city' in loc), '도시는 안 실어 보낸다');

console.log('region self-check done');

/* ── 프로필 ────────────────────────────────────────── */
/* 이 절은 이름·소개·캐릭터·언어만 본다. 같은 함수가 다루는 다른 칸(handle·botname·
   스위치)은 그쪽 절에서 따로 본다 — 여기서 통째로 견주면 칸이 하나 늘 때마다 깨진다 */
const pr = profile({ name: '가양', bio: '강서구 사람', face: { shape: 'round', expression: 'wink', colour: 'teal' }, lang: 'ko' });
const mineOnly = ({ name, bio, face, lang }) => ({ name, bio, face, lang });
assert.deepEqual(mineOnly(pr), { name: '가양', bio: '강서구 사람', face: 'round,wink,teal', lang: 'ko' });
/* 화면은 face 를 이어 붙인 문자열로 보낸다 — 객체만 받으면 ',,' 로 저장돼 고른 모습이 사라진다 */
assert.equal(profile({ name: '가양', face: 'nuage,curieux,violet' }).face, 'nuage,curieux,violet',
             '문자열로 온 캐릭터도 그대로 받는다');
assert.equal(profile({ name: '가', bio: '소'.repeat(90) }).bio.length, 60, '소개는 60자에서 자른다');
assert.equal(profile({ name: '가'.repeat(30) }).name.length, 12, '닉네임은 12자에서 자른다');
/* 소개도 남 앞에 걸릴 값이다 — 이름과 같은 규칙으로 보이지 않는 글자를 턴다 */
assert.equal(profile({ bio: '앞‮뒤\u0007' }).bio, '앞 뒤', '제어·방향 뒤집기 글자는 남지 않는다');
assert.equal(profile({ name: '   ' }).name, '', '빈 닉네임은 빈 값으로 — 부르는 쪽이 400 으로 막는다');
assert.equal(profile({ face: { shape: '../evil', expression: 'wink' } }).face, ',wink,',
             '모르는 모양은 빈 칸으로 떨어진다');
assert.equal(profile({ lang: 'ko-KR' }).lang, 'auto', '두 글자 말만 받는다');
assert.equal(profile({}).lang, 'auto');
assert.doesNotThrow(() => profile(null), '몸통이 없어도 터지지 않는다');

/* 아이디(handle). 남 앞에 주소처럼 걸리는 값이라 모양이 안 맞으면 다듬지 않고
   통째로 버린다 — 조용히 깎으면 사람이 친 것과 저장된 것이 달라진다 */
assert.equal(profile({ name: '가', handle: 'GaYang' }).handle, 'gayang', '아이디는 소문자로 접는다');
assert.equal(profile({ handle: 'ga' }).handle, '', '세 자 미만은 버린다');
assert.equal(profile({ handle: 'a'.repeat(20) }).handle, '', '열여섯 자를 넘으면 자르지 않고 버린다');
assert.equal(profile({ handle: '가양' }).handle, '', '한글 아이디는 받지 않는다');
assert.equal(profile({ handle: 'ga-yang' }).handle, '', '밑줄 말고 다른 기호는 받지 않는다');
assert.equal(profile({ handle: 'ga_yang9' }).handle, 'ga_yang9');
assert.equal(profile({}).handle, '', '안 보내면 빈 값 — 서버가 옛 아이디를 덮지 않는다');
assert.equal(profile({ handle: 'admin' }).handle, '', '예약어는 아무도 못 가져간다');
assert.equal(profile({ handle: 'ADMIN' }).handle, '', '대문자로 우회할 수 없다');
assert.equal(profile({ handle: 'regiontype' }).handle, '', '우리 이름도 예약어다');
assert.equal(profile({ handle: 'admins' }).handle, 'admins', '예약어를 품은 말까지 막지는 않는다');

assert.equal(profile({ botname: '방울‮이\u0007' }).botname, '방울 이', '캐릭터 이름도 닉네임과 같은 규칙으로 턴다');
assert.equal(profile({ botname: '방'.repeat(30) }).botname.length, 12, '캐릭터 이름은 12자에서 자른다');

/* 스위치 둘은 켬/끔이다. 화면이 늘 통째로 보내므로 빠진 값은 끈 것으로 읽는다 */
assert.equal(profile({ push: true }).push, 1);
assert.equal(profile({ push: 'yes' }).push, 0, '켬은 true·1 뿐이다 — 아무 값이나 참이 되지 않는다');
assert.equal(profile({}).shut, 0);

/* face 는 객체로도 문자열로도 온다 — 화면 둘이 서로 다르게 보낸다.
   문자열을 못 읽으면 캐릭터가 ',,' 로 저장돼 고른 모습이 조용히 사라진다 */
assert.equal(profile({ face: 'cercle,curieux,turquoise' }).face, 'cercle,curieux,turquoise',
             '이어 붙인 문자열도 그대로 받는다');
assert.equal(profile({ face: 'cercle,curieux,turquoise' }).face,
             profile({ face: { shape: 'cercle', expression: 'curieux', colour: 'turquoise' } }).face,
             '두 모양이 같은 값으로 떨어진다');
assert.equal(profile({ face: '../evil,curieux' }).face, ',curieux,', '문자열로 와도 모양을 본다');

/* ── 계정 삭제 ──────────────────────────────────────────
   사람이 제 계정을 지우면 그 사람을 가리키는 줄이 하나도 남으면 안 된다. 표를 새로
   만들면서 ERASE 에 더하는 걸 잊는 것이 이 기능이 조용히 반쪽이 되는 길이라,
   schema.sql 을 직접 읽어 who 를 가진 표를 전부 찾아 대조한다. */
const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const tablesWithWho = [...sql.matchAll(/create table if not exists (\w+) \(([\s\S]*?)\n\);/g)]
  .filter(([, , body]) => /^\s*who\s/m.test(body))
  .map(([, name]) => name);
assert.ok(tablesWithWho.length >= 8, 'who 를 가진 표를 못 찾았다 — 검사가 헛돌고 있다');
const missed = tablesWithWho.filter(t => !ERASE.includes(t));
assert.deepEqual(missed, [], `계정을 지워도 남는 표가 있다: ${missed.join(', ')}`);
/* 없는 표를 지우려 들면 배포한 뒤에야 500 으로 드러난다 */
const ghosts = ERASE.filter(t => !tablesWithWho.includes(t));
assert.deepEqual(ghosts, [], `schema.sql 에 없는 표가 ERASE 에 있다: ${ghosts.join(', ')}`);
/* 사람 줄(user)은 who 가 아니라 id 로 산다 — 목록이 아니라 authErase 가 따로 지운다 */
assert.ok(!ERASE.includes('user'), 'user 는 id 로 지운다 — 목록에 넣으면 who 칸을 찾다 터진다');

console.log('erase self-check done');

console.log('profile self-check done');

/* ── 가입 안내 설문 ─────────────────────────────────────── */
assert.deepEqual(intro({ platform: 'youtube', medium: 'video', nps: 9 }),
                 { platform: 'youtube', medium: 'video', nps: 9 });
assert.equal(intro({ platform: '../evil' }).platform, '', '고른 목록 밖의 값은 버린다');
assert.equal(intro({ platform: '검색' }).platform, '', '자유 입력은 들어올 자리가 없다');
assert.equal(intro({ nps: 11 }).nps, null, '0‥10 밖은 안 센다');
assert.equal(intro({ nps: 0 }).nps, 0, '0 은 값이다 — 안 고른 것(null)과 다르다');
assert.equal(intro({}).nps, null, '안 고르면 null');
assert.equal(intro({ nps: '7' }).nps, 7, "'7' 처럼 글자로 온 숫자는 숫자로 읽는다");
assert.equal(intro({ nps: '일곱' }).nps, null, '숫자가 아니면 안 센다');
assert.equal(intro({ nps: 7.5 }).nps, null, '정수만 센다');
assert.doesNotThrow(() => intro(null), '몸통이 없어도 터지지 않는다');

console.log('intro self-check done');

/* ── 로그인 ────────────────────────────────────────── */
const KEY = 'test-key';
assert.equal(await open(KEY, await sign(KEY, 'u123')), 'u123', '내가 서명한 토큰은 내가 연다');
assert.equal(await open('다른열쇠', await sign(KEY, 'u123')), null, '남의 열쇠로는 못 연다');
assert.equal(await open(KEY, await sign(KEY, 'u123', -1)), null, '지난 토큰은 안 열린다');
assert.equal(await open(KEY, 'aaa.bbb'), null, '아무 값이나 토큰이 되지 않는다');
assert.equal(await open(KEY, undefined), null, '없는 토큰은 없는 사람이다');
/* payload 만 갈아끼우면 서명이 안 맞아야 한다 — 남의 id 로 갈아탈 수 있으면 끝이다 */
const t = await sign(KEY, 'u123');
const forged = b64u(new TextEncoder().encode(JSON.stringify({ u: 'admin', x: Date.now() + 1e6 })))
             + '.' + t.split('.')[1];
assert.equal(await open(KEY, forged), null, '몸통만 바꿔치기하면 열리지 않는다');

/* clientDataJSON — 챌린지와 출처가 둘 다 맞아야 통과한다 */
const cd = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
const SITE = ['https://regiontype.com'];
assert.equal(readClientData(cd({ type: 'webauthn.get', challenge: 'c1', origin: SITE[0] }),
             'webauthn.get', 'c1', SITE), null, '맞는 응답은 통과한다');
assert.ok(readClientData(cd({ type: 'webauthn.create', challenge: 'c1', origin: SITE[0] }),
          'webauthn.get', 'c1', SITE), '등록 응답을 로그인에 못 쓴다');
assert.ok(readClientData(cd({ type: 'webauthn.get', challenge: 'other', origin: SITE[0] }),
          'webauthn.get', 'c1', SITE), '다른 챌린지는 막힌다');
assert.ok(readClientData(cd({ type: 'webauthn.get', challenge: 'c1', origin: 'https://evil.example' }),
          'webauthn.get', 'c1', SITE), '다른 출처는 막힌다');

/* authenticatorData — 앞 37바이트 고정 자리 */
const ad = new Uint8Array(37); ad[32] = 0x05; new DataView(ad.buffer).setUint32(33, 7);
const got = readAuthData(ad);
assert.equal(got.up && got.uv, true, '사람이 만졌고 본인 확인까지 한 표시를 읽는다');
assert.equal(got.count, 7, '셈을 읽는다');
assert.equal(readAuthData(new Uint8Array(10)), null, '짧은 값은 거른다');

/* ECDSA 서명은 DER 로 온다. WebCrypto 는 원시 64바이트를 받는다 */
const int = v => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++;
  let b = v.slice(i); if (b[0] & 0x80) b = Uint8Array.from([0, ...b]);
  return Uint8Array.from([0x02, b.length, ...b]); };
const raw = crypto.getRandomValues(new Uint8Array(64));
const r = int(raw.slice(0, 32)), sv = int(raw.slice(32));
const back = derToRaw(Uint8Array.from([0x30, r.length + sv.length, ...r, ...sv]));
assert.equal(back.length, 64, '원시형은 64바이트다');
assert.deepEqual([...back], [...raw], 'DER 을 풀면 원래 값이 나온다');

console.log('auth self-check done');

/* 실제 /auth/take 응답을 검사한다. D1 경계만 대역으로 바꿔 최초 생성과
   재로그인·공급자 연결·경쟁 생성 실패를 구분한다. */
async function takeResponse({ existing = false, linked = false, changes = 1,
  conflict = false, passkey = false } = {}) {
  const DB = {
    prepare(sql) {
      return {
        sql,
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.startsWith('select who, kind, back')) return {
            who: linked ? 'existing-user' : null, kind: 'take', provider: 'google',
            sub: 'hashed-sub', until: Date.now() + 60000,
          };
          if (sql.startsWith('select who from sso')) return existing ? { who: 'existing-user' } : null;
          if (sql.startsWith('select 1 from passkey')) return passkey ? { 1: 1 } : null;
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          assert.ok(sql.startsWith('insert into pending'));
          return { meta: { changes: 1 } };
        },
      };
    },
    async batch(statements) {
      if (statements[0].sql.startsWith('delete from pending'))
        return statements.map(() => ({ meta: { changes: 1 } }));
      assert.ok(statements[0].sql.startsWith('insert or ignore into user'));
      assert.ok(statements[1].sql.startsWith('insert into sso'));
      if (conflict) throw new Error('UNIQUE constraint failed');
      return [{ meta: { changes } }, { meta: { changes: 1 } }];
    },
  };
  const response = await relayWorker.fetch(new Request('https://relay.example/auth/take', {
    method: 'POST', headers: { origin: 'https://regiontype.com', 'content-type': 'application/json' },
    body: JSON.stringify({ b: 'test-bind', t: 'a'.repeat(43) }),
  }), { DB, SESSION_KEY: KEY, RL_AU: { limit: async () => ({ success: true }) } });
  return { status: response.status, body: await response.json() };
}
const firstLogin = await takeResponse();
assert.equal(firstLogin.status, 200);
assert.ok(firstLogin.body.token);
assert.equal(firstLogin.body.isNewAccount, true, '실제로 새 계정을 생성한 로그인만 최초 가입이다');
assert.equal((await takeResponse({ existing: true })).body.isNewAccount, false, '재로그인은 가입이 아니다');
assert.equal((await takeResponse({ linked: true })).body.isNewAccount, false, '공급자 추가는 가입이 아니다');
assert.equal((await takeResponse({ changes: 0 })).body.isNewAccount, false, '생성되지 않은 행은 신규로 세지 않는다');
const racedLogin = await takeResponse({ conflict: true });
assert.equal(racedLogin.status, 503);
assert.ok(!racedLogin.body.token && !racedLogin.body.isNewAccount, '경쟁 생성 실패는 가입 성공을 반환하지 않는다');
const secondFactorLogin = await takeResponse({ existing: true, passkey: true });
assert.equal(secondFactorLogin.body.need, 'passkey');
assert.ok(!secondFactorLogin.body.token && !secondFactorLogin.body.isNewAccount,
  '2단계 확인 전에는 가입 성공이나 세션을 반환하지 않는다');

/* ── SSO 2단계 (Google·Apple → 패스키·복구 코드) ────────────────
   authCb·authTake·peekTwo·issueRecoveryCodes 는 worker.mjs 가 내보내지 않고,
   D1 이 있어야 도는 것도 많다. 못 부르는 것은 (a) 내보낸 재료(sha·mac·b64u)로
   같은 계산을 재현하거나 (b) security-rules.mjs 와 같은 방식으로 실제 소스
   문자열이 그 모양을 유지하는지를 정규식으로 붙든다. 둘 다 안 되는 건 아래
   '못 덮은 것' 에 적는다. */
const worker = readFileSync(new URL('worker.mjs', import.meta.url), 'utf8');
const fn = name => worker.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n}\\n`))?.[0] ?? '';

/* 1) take 줄의 id = b64u(sha(state + tag)). state 만 아는 쪽(공격자)이 tag 를
   못 맞히면 다른 id 가 나와야 한다 — 무너지면 계정 탈취가 되살아난다. */
const stateOf = async b => b64u(await sha(b));
const takeId = async (state, tag) => b64u(await sha(state + tag));
const state1 = await stateOf('아무-bind-값');
const realTag = rand(32);
assert.equal(await takeId(state1, realTag), await takeId(state1, realTag), '같은 state·tag 는 늘 같은 id');
assert.notEqual(await takeId(state1, rand(32)), await takeId(state1, realTag),
  'state 만 아는 공격자가 tag 를 못 맞히면 다른 id 가 나와야 한다');

/* 2) 2단계 시도 횟수 — peekTwo 는 D1 상태 없인 부를 수 없다. 5회 상한과
   실패해도 세는 증분, 성공했을 때만 줄을 지우는 순서를 소스에서 붙든다. */
const peekTwoSrc = fn('peekTwo');
assert.ok(peekTwoSrc, 'peekTwo 를 찾지 못했다 — 검사가 낡았다');
assert.ok(/tries >= 5/.test(peekTwoSrc), '5회 상한이 사라졌다');
assert.ok(/tries = tries \+ 1/.test(peekTwoSrc), '실패해도 시도를 세는 증분이 사라졌다');
assert.ok(!/consumeTwo/.test(peekTwoSrc), 'peekTwo 는 읽기만 한다 — 성공 판정 전에 줄을 지우면 안 된다');
const authLogSrc = fn('authLog'), authCodeSrc = fn('authCode');
assert.ok(authLogSrc.includes('consumeTwo(env, chal)') &&
  authLogSrc.indexOf('서명이 맞지 않습니다') < authLogSrc.indexOf('consumeTwo(env, chal)'),
  '패스키는 서명 검증을 통과했을 때만 줄을 지워야 한다');
assert.ok(authCodeSrc.includes('consumeTwo(env, id)') &&
  authCodeSrc.indexOf('맞지 않는 코드입니다') < authCodeSrc.indexOf('consumeTwo(env, id)'),
  '복구 코드는 검증을 통과했을 때만 줄을 지워야 한다');

/* 3) id_token 검증 — iss·aud·exp·nonce 가 하나라도 어긋나면 닫는 쪽으로
   떨어져야 한다. authCb 도 못 부르니 같은 조건을 여기서 재현하고, 재현이
   실제 코드에서 벗어나지 않았는지 느슨한 정규식으로 원문과 맞춰 본다. */
const authCbSrc = fn('authCb');
const guard = /!claims\s*\|\|\s*!prov\.iss\.includes\(claims\.iss\)\s*\|\|\s*claims\.aud\s*!==\s*prov\.id\(env\)\s*\|\|\s*!\(claims\.exp\s*>\s*Date\.now\(\)\s*\/\s*1000\)\s*\|\|\s*claims\.nonce\s*!==\s*state\s*\|\|\s*!claims\.sub/;
assert.ok(guard.test(authCbSrc), 'id_token 검증 조건이 바뀌었다 — 재현한 계산을 다시 맞춰야 한다');

const PROV = { iss: ['https://accounts.google.com', 'accounts.google.com'], id: 'client-123' };
const validClaims = (c, prov, state) => !!c && prov.iss.includes(c.iss) && c.aud === prov.id
  && c.exp > Date.now() / 1000 && c.nonce === state && !!c.sub;
const now = Date.now() / 1000;
const goodClaims = { iss: 'https://accounts.google.com', aud: 'client-123', exp: now + 300, nonce: 'n1', sub: 'u1' };
assert.equal(validClaims(goodClaims, PROV, 'n1'), true, '맞는 토큰은 통과한다');
assert.equal(validClaims({ ...goodClaims, iss: 'https://evil.example' }, PROV, 'n1'), false, 'iss 가 다르면 거른다');
assert.equal(validClaims({ ...goodClaims, aud: 'other-client' }, PROV, 'n1'), false, 'aud 가 다르면 거른다');
assert.equal(validClaims({ ...goodClaims, exp: now - 1 }, PROV, 'n1'), false, '지난 토큰은 거른다');
assert.equal(validClaims({ ...goodClaims, nonce: 'n2' }, PROV, 'n1'), false, 'nonce 가 다르면 거른다');

/* 4) 복구 코드 — 해시로만 맞춰 보고, 쓰면 지우고, 재발급은 옛 코드를 통째로
   지운다. 평문 code 가 아니라 해시 h 만 저장하는지도 소스에서 확인한다. */
const issueSrc = fn('issueRecoveryCodes');
assert.ok(/delete from recovery where who = \?/.test(issueSrc), '재발급이 옛 코드를 지우지 않는다');
assert.ok(/insert into recovery[\s\S]*bind\(h, who, now\)/.test(issueSrc), '해시만 저장해야 한다');
assert.ok(!/\.bind\(code,/.test(issueSrc), '평문 코드가 저장되면 안 된다');
assert.ok(/select who from recovery where hash = \?/.test(authCodeSrc), '코드가 아니라 해시로 맞춰 봐야 한다');
assert.ok(authCodeSrc.includes("delete from recovery where hash = ?") &&
  authCodeSrc.indexOf('맞지 않는 코드입니다') < authCodeSrc.indexOf("delete from recovery where hash = ?"),
  '검증을 통과했을 때만 지워야 한다 — 복구 코드는 한 번만 쓴다');

const hex = buf => [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
assert.equal(hex(await sha('가나다라마바')), hex(await sha('가나다라마바')), '같은 코드는 같은 해시');
assert.notEqual(hex(await sha('가나다라마바')), hex(await sha('가나다라마사')), '다른 코드는 다른 해시');

/* 5) sub 해시 — 같은 공급자·같은 sub·같은 키는 늘 같은 값으로, 키나 공급자가
   다르면 다른 값으로 떨어져야 한다. hmacSub 은 안 내보내지만 mac() 은
   내보내니 같은 재료로 재현한다. */
const hmacSub = async (key, provider, sub) => hex(new Uint8Array(
  await crypto.subtle.sign('HMAC', await mac(key), new TextEncoder().encode(`${provider}:${sub}`))));
assert.equal(await hmacSub('key-a', 'google', 'sub-1'), await hmacSub('key-a', 'google', 'sub-1'),
  '같은 공급자·같은 sub·같은 키는 늘 같은 값');
assert.notEqual(await hmacSub('key-a', 'google', 'sub-1'), await hmacSub('key-b', 'google', 'sub-1'),
  '키가 다르면 다른 값 — SUB_KEY 를 갈면 sso 연결이 끊긴다는 전제가 여기 있다');
assert.notEqual(await hmacSub('key-a', 'google', 'sub-1'), await hmacSub('key-a', 'apple', 'sub-1'),
  '공급자가 다르면 같은 sub 이라도 다른 값');

console.log('sso two-factor self-check done');

/* ── 보안 룰 ──────────────────────────────────────────
   룰이 통과만 시키는 룰이 되는 게 제일 무섭다. 그래서 여기서는 맞는 값 한 번,
   틀린 값 한 번을 같이 먹인다 — 틀린 값에 조용히 통과하는 룰이 있으면 여기서 걸린다. */
const only = id => RULES.filter(r => r.id === id);
const one = (id, fact) => check({ [only(id)[0].need]: fact }, only(id))[0];
const good = (id, fact, why) => assert.equal(one(id, fact).state, 'pass', why ?? `${id} 가 맞는 값을 거른다`);
const bad = (id, fact, why) => assert.equal(one(id, fact).state, 'fail', why ?? `${id} 가 틀린 값을 통과시킨다`);

const HEAD = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy':
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
};
const page = (over = {}) => ({ status: 200, headers: { ...HEAD, ...over } });
const drop = name => { const { [name]: _, ...rest } = HEAD; return { status: 200, headers: rest }; };

good('site-hsts', page());
bad('site-hsts', drop('strict-transport-security'));
bad('site-hsts', page({ 'strict-transport-security': 'max-age=600; includeSubDomains' }),
    '짧은 max-age 는 걸러야 한다');
bad('site-hsts', page({ 'strict-transport-security': 'max-age=31536000' }),
    'includeSubDomains 가 빠지면 걸러야 한다');

good('site-csp', page());
bad('site-csp', page({ 'content-security-policy': "base-uri 'self'" }), '한 지시어만으로는 부족하다');
good('site-frame', page());
bad('site-frame', page({ 'x-frame-options': 'SAMEORIGIN' }));
good('site-nosniff', page());
bad('site-nosniff', drop('x-content-type-options'));
good('site-permissions', page());
bad('site-permissions', page({ 'permissions-policy': 'camera=(), microphone=()' }),
    '남은 기능이 열려 있으면 걸러야 한다');
/* www 는 같은 룰을 다른 자리에 건 것이다 — 한쪽만 고쳐도 다른 쪽이 남게 */
assert.equal(only('www-hsts')[0].need, 'probe:www', 'www 룰은 www 응답을 본다');

good('https-only', { status: 301, headers: { location: 'https://regiontype.com/' } });
bad('https-only', { status: 200, headers: {} }, '평문이 그대로 답하면 걸러야 한다');
bad('https-only', { status: 301, headers: { location: 'http://regiontype.com/' } },
    '평문으로 보내는 이동은 이동이 아니다');

/* Access 가 중계기를 덮는 사고 — 이 검사의 출발점이다 */
good('relay-open', { status: 200, headers: { 'content-type': 'application/json' } });
bad('relay-open', { status: 302, headers: { location: 'https://x.cloudflareaccess.com/' } },
    'Access 로그인으로 넘기면 걸러야 한다');
bad('relay-open', { status: 403, headers: {} });

good('relay-preflight', { status: 204, headers: { 'access-control-allow-origin': 'https://regiontype.com' } });
bad('relay-preflight', { status: 403, headers: {} });
bad('relay-preflight', { status: 204, headers: { 'access-control-allow-origin': '*' } });
good('relay-stranger', { status: 403, headers: {} });
bad('relay-stranger', { status: 204, headers: { 'access-control-allow-origin': 'https://evil.example' } });
bad('relay-stranger', { status: 204, headers: { 'access-control-allow-origin': '*' } });
good('relay-no-credentials', { status: 204, headers: {} });
bad('relay-no-credentials', { status: 204, headers: { 'access-control-allow-credentials': 'true' } });

bad('no-secret-literal', "const t = 'ghp_0123456789abcdefghijklmnopqrstuvwxyz';",
    '토큰처럼 생긴 값을 놓치면 안 된다');
bad('no-secret-literal', "const GH_TOKEN = 'x-very-secret-value';");
bad('no-secret-literal', "const TURNSTILE_SECRET = 'x-very-secret-value';");
good('no-secret-literal', 'authorization: `Bearer ${env.GH_TOKEN}`,',
     '바인딩에서 읽는 건 비밀이 박힌 게 아니다');
bad('secret-not-in-vars', '[vars]\nGH_TOKEN = "abc"\n');
good('secret-not-in-vars', '[vars]\nSITE = "regiontype.com"\n');
bad('ratelimits', '[[ratelimits]]\nname = "RL_FB"\n', '창 하나로는 부족하다');
bad('assets-exclude', '.git\nCLAUDE.md\n', 'relay 가 빠지면 소스가 나간다');
bad('origin-allowlist', "const SITE = ['https://regiontype.com', 'https://evil.example'];");
bad('origin-allowlist', "const SITE = ['https://regiontype.com'];\nexport const allowedOrigin = o => true;");
good('origin-allowlist', "const SITE = ['https://regiontype.com', 'https://www.regiontype.com'];");
bad('token-stays-server', 'const t = env.GH_TOKEN;', '브라우저 코드에 토큰이 보이면 안 된다');

/* Cloudflare MCP 가 떠다 주는 값 — 판정은 그래도 여기 표가 한다 */
good('workers-known', ['regiontype-com', 'rt-feedback']);
good('workers-known', ['rt-feedback', 'regiontype-com'], '순서는 상관없다');
bad('workers-known', ['regiontype-com', 'rt-feedback', 'crypto-miner'], '모르는 워커를 놓치면 안 된다');
bad('workers-known', ['regiontype-com'], '워커가 사라진 것도 사고다');

/* 값을 못 떠 온 룰은 통과가 아니라 skip 이다 — 꺼진 검사가 초록으로 보이면 안 된다 */
const blind = check({}, only('site-hsts'))[0];
assert.equal(blind.state, 'skip', '값이 없으면 skip');
assert.deepEqual(tally([blind]), { pass: 0, fail: 0, skip: 1, high: 0 }, 'skip 은 통과로 세지 않는다');
assert.equal(tally(check({ 'probe:site': drop('strict-transport-security') }, only('site-hsts'))).high, 1,
             'high 가 깨지면 성적에 남는다');
/* 룰 이름이 겹치면 리포트에서 두 줄이 한 줄로 보인다 */
assert.equal(new Set(RULES.map(r => r.id)).size, RULES.length, '룰 이름은 겹치지 않는다');

console.log('security rule self-check done');

/* ── 커뮤니티 ─────────────────────────────────────────────
   SQL 이 이 기능의 전부라 흉내가 아니라 진짜 sqlite(node:sqlite)에 schema.sql 을 깔고
   워커를 그대로 태운다. D1 은 prepare·bind·first·all·run·batch 만 흉내 낸다. */
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  const stmt = (q, a = []) => ({
    q, bind: (...b) => stmt(q, b),
    first: async col => { const r = db.prepare(q).get(...a); return r ? (col ? r[col] : { ...r }) : null; },
    all: async () => ({ results: db.prepare(q).all(...a).map(r => ({ ...r })) }),
    run: async () => ({ meta: { changes: Number(db.prepare(q).run(...a).changes) } }),
  });
  const DB = { prepare: q => stmt(q), batch: async ss => Promise.all(ss.map(s =>
    /^\s*select/i.test(s.q) ? s.all() : s.run().then(r => ({ results: [], ...r })))) };
  const open = { limit: async () => ({ success: true }) };
  const env = { DB, SESSION_KEY: 'k'.repeat(32), RL_CM: open, RL_CR: open, RL_AU: open };
  const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32), D = 'd'.repeat(32);
  const tok = {}; for (const w of [A, B, C, D]) tok[w] = await sign(env.SESSION_KEY, w);
  const call = async (path, body, who) => {
    const r = await relayWorker.fetch(new Request('https://g.gearservicevanguard.com' + path, {
      method: body ? 'POST' : 'GET', body: body && JSON.stringify(body),
      headers: { origin: 'https://regiontype.com', 'content-type': 'application/json',
                 ...(who ? { authorization: 'Bearer ' + tok[who] } : {}) } }), env);
    return { status: r.status, ...(await r.json()) };
  };
  const post = { tag: 'brag', title: '강서구 1분 컷', body: '<img src=x onerror=alert(1)>\n\n\n\n둘째 줄\u202e' };

  assert.equal((await call('/cm/post', post)).status, 401, '로그인 없이는 못 쓴다');
  const nn = await call('/cm/post', post, A);
  assert.equal(nn.status, 409, '닉네임이 없으면 못 쓴다'); assert.ok(nn.noname);
  for (const w of [A, B, C, D]) db.prepare('insert into user (id, at) values (?, 0)').run(w);
  for (const [w, name, shut] of [[A, '가양', 0], [B, '나리', 0], [C, '다온', 1], [D, '라온', 0]])
    db.prepare("insert into profile (who, name, at, handle, shut) values (?, ?, 0, ?, ?)").run(w, name, name === '가양' ? 'gayang' : '', shut);

  assert.equal((await call('/cm/post', { ...post, tag: 'spam' }, A)).status, 400, '모르는 주제는 거른다');
  const made = await call('/cm/post', post, A);
  assert.equal(made.status, 201);
  const hid = (await call('/cm/post', { ...post, title: '비공개 사람 글' }, C)).id;

  let list = await call('/cm/list', null, B);
  assert.equal(list.posts.length, 2);
  assert.equal(list.posts[1].name, '가양'); assert.equal(list.posts[1].handle, 'gayang');
  assert.equal(list.posts[0].name, '', '비공개로 둔 사람은 이름이 빈다');
  assert.ok(list.posts.every(p => !('who' in p)), 'who 는 밖으로 안 나간다');
  assert.equal(list.posts[1].mine, false);
  assert.equal((await call('/cm/list?tag=ask')).posts.length, 0, '주제로 거른다');

  let read = await call('/cm/read?id=' + made.id, null, A);
  assert.ok(read.post.mine);
  assert.equal(read.post.body, '<img src=x onerror=alert(1)>\n\n둘째 줄', '평문 그대로 두되 빈 줄은 하나, 방향 글자는 지운다');

  assert.equal((await call('/cm/reply', { post: made.id, body: '축하해요' }, B)).status, 201);
  assert.equal((await call('/cm/reply', { post: 999, body: '허공' }, B)).status, 404, '없는 글엔 댓글이 안 붙는다');
  let up = await call('/cm/up', { target: 'p' + made.id }, B);
  assert.deepEqual([up.on, up.n], [true, 1]);
  up = await call('/cm/up', { target: 'p' + made.id }, B);
  assert.deepEqual([up.on, up.n], [false, 0], '다시 누르면 거둔다');
  await call('/cm/up', { target: 'p' + made.id }, D);
  list = await call('/cm/list');
  assert.deepEqual([list.posts[1].ups, list.posts[1].replies], [1, 1]);

  assert.equal((await call('/cm/del', { target: 'p' + made.id }, B)).status, 404, '남의 글은 못 지운다');
  const under = (await call('/cm/reply', { post: hid, body: '가려질 글의 댓글' }, B)).id;
  for (const w of [A, B, B, D]) await call('/cm/flag', { target: 'p' + hid }, w);
  assert.equal((await call('/cm/list')).posts.length, 1, '서로 다른 셋이 신고하면 가려진다 — 한 사람이 여러 번은 한 번');
  assert.equal((await call('/cm/read?id=' + hid)).status, 404);
  assert.equal((await call('/cm/reply', { post: hid, body: '가려진 글에' }, B)).status, 404, '가려진 글엔 댓글이 안 붙는다');
  assert.equal((await call('/cm/up', { target: 'p' + hid }, D)).status, 404, '가려진 글엔 공감이 안 쌓인다');
  assert.equal((await call('/cm/flag', { target: 'p' + hid }, C)).status, 404, '가려진 글엔 신고도 더 안 쌓인다');
  assert.equal((await call('/cm/up', { target: 'r' + under }, D)).status, 404, '가려진 글 밑의 댓글에도 안 쌓인다');
  assert.equal((await call('/cm/up', null, B)).status, 405);
  for (const junk of [null, 7, [1]]) {
    const r = await relayWorker.fetch(new Request('https://g.gearservicevanguard.com/cm/up', {
      method: 'POST', body: JSON.stringify(junk),
      headers: { origin: 'https://regiontype.com', 'content-type': 'application/json', authorization: 'Bearer ' + tok[B] } }), env);
    assert.equal(r.status, 400, JSON.stringify(junk) + ' 몸통은 400 으로 거른다');
  }

  /* 갓 만든 계정의 신고는 세지 않는다 */
  const fresh = (await call('/cm/post', { ...post, title: '새 계정 신고 표적' }, A)).id;
  db.prepare('update user set at = ? where id in (?, ?, ?)').run(Date.now(), B, C, D);
  for (const w of [B, C, D]) await call('/cm/flag', { target: 'p' + fresh }, w);
  assert.equal((await call('/cm/read?id=' + fresh)).status, 200, '가입 사흘이 안 된 계정 셋으로는 못 가린다');
  db.prepare('update user set at = 0').run();

  assert.equal((await call('/cm/del', { target: 'p' + made.id }, A)).status, 200);
  assert.equal(db.prepare('select count(*) as n from reply where post = ?').get(made.id).n, 0, '글을 지우면 댓글도 간다');
  assert.equal(db.prepare("select count(*) as n from mark where kind = 'up'").get().n, 0, '공감도 간다');
  /* 계정을 지우면 남의 글에 단 내 댓글을 가리키던 공감·신고 줄도 간다 */
  const host = (await call('/cm/post', { ...post, title: '남의 글' }, A)).id;
  const mine = (await call('/cm/reply', { post: host, body: '곧 떠날 댓글' }, D)).id;
  await call('/cm/up', { target: 'r' + mine }, B);
  assert.equal((await call('/auth/erase', { sure: true }, D)).status, 200);
  assert.equal(db.prepare("select count(*) as n from mark where target = ?").get('r' + mine).n, 0, '지운 사람 댓글의 표시는 남지 않는다');
  assert.equal(cmTarget('p0'), ''); assert.equal(cmTarget("p1 or 1=1"), '');
  assert.equal(cmPost({ tag: 'chat', title: '제목\n줄', body: ' ' }).ok, false, '빈 본문은 거른다');
  console.log('community self-check done');
}
