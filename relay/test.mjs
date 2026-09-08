/* node relay/test.mjs — 이슈 한 장이 제대로 지어지는지만 본다 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { compose, entry, where, regionOf } from './worker.mjs';
import { sign, open, derToRaw, readClientData, readAuthData, b64u } from './auth.mjs';
/* 검사는 대부분 '몸통' 만 흔든다 — 주인은 늘 같은 값으로 고정해 둔다 */
const entry2 = (c, me = ME) => entry(c, me);

const base = { kind: 'bug', body: '가양1동이 오답으로 처리됩니다',
               v: '0.40', href: 'https://regiontype.com/', ua: 'UA' };

const a = compose(base);
assert.equal(a.title, '[버그] 가양1동이 오답으로 처리됩니다', '제목 = 종류 + 첫 줄');
assert.deepEqual(a.labels, ['버그']);
assert.ok(a.body.includes('```\n종류: 버그'), '메타는 코드 블록 안에 가둔다');

/* 이슈는 공개다. 사이트에 입력칸이 없어도 여기서 받으면 아무나 남의 주소를 박는다 */
const b = compose({ ...base, from: 'me@x.com' });
assert.ok(!b.body.includes('회신'), '회신 주소는 받지 않는다');
assert.ok(!b.body.includes('me@x.com') && !b.body.includes('me [at] x.com'),
          '보내온 주소는 어떤 모양으로도 남기지 않는다');

/* 남이 보낸 값으로 이슈 서식을 흔들 수 없어야 한다 */
const c = compose({ ...base, ua: '```\n# 관리자 공지', kind: '../evil' });
assert.deepEqual(c.labels, ['버그'], '모르는 종류는 버그로 떨어뜨린다');
assert.ok(c.title.startsWith('[버그] '));
assert.equal(c.body.split('```').length, 3, '메타의 백틱은 지워져 코드 블록이 하나로 남는다');
assert.ok(!/브라우저:.*\n.*관리자/.test(c.body), '줄바꿈으로 메타를 늘려 쓸 수 없다');

const d = compose({ ...base, body: '가'.repeat(900) });
assert.equal(d.body.split('\n')[0].length, 500, '본문은 500자에서 자른다');
assert.equal(compose({ ...base, body: '   ' }).ok, false, '빈 내용은 거른다');
assert.equal(compose({ ...base, body: '첫 줄\n둘째 줄' }).title, '[버그] 첫 줄', '제목은 첫 줄만');

console.log('relay self-check done');

/* ── 순위표에 올릴 한 줄 ──────────────────────────── */
const run = { c: 'seoul-gu', t: 120, name: '가나', score: 1500, hits: 5, tries: 6 };
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
