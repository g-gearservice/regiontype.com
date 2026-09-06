/* node relay/test.mjs — 이슈 한 장이 제대로 지어지는지만 본다 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { compose, entry, where } from './worker.mjs';

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
const run = { c: 'seoul-gu', t: 120, who: 'a1b2c3d4e5', name: '가나',
              score: 1500, hits: 5, tries: 6 };

const e = entry(run);
assert.equal(e.ok, true);
assert.equal(e.acc, 83, '정확도는 들른 곳 ÷ 친 횟수');
assert.equal(entry({ ...run, t: 100 }).ok, false, '없는 제한 시간은 거른다');
assert.equal(entry({ ...run, c: '../evil' }).ok, false, '코스 이름은 소문자와 하이픈뿐');
assert.equal(entry({ ...run, c: 'SEOUL' }).ok, false, '대문자도 거른다');

/* 채점은 브라우저가 한다 — 여기서 거를 수 있는 건 말이 안 되는 값뿐이다 */
assert.equal(entry({ ...run, score: 2600 }).ok, false, '한 곳당 500점을 넘길 수 없다');
assert.equal(entry({ ...run, score: 2500 }).ok, true, '5곳 × 5배 콤보는 그대로 통과한다');
assert.equal(entry({ ...run, score: 150 }).ok, false, '100점 배수가 아닌 값은 없다');
assert.equal(entry({ ...run, hits: 7 }).ok, false, '들른 곳이 친 횟수보다 많을 수 없다');
assert.equal(entry({ ...run, score: -100 }).ok, false, '음수는 없다');
assert.equal(entry({ ...run, score: 1.5 }).ok, false, '정수가 아니면 거른다');
assert.equal(entry({ ...run, hits: 600, tries: 600, score: 0 }).ok, false, '코스보다 큰 판은 없다');

/* 제한 시간이 상한을 하나 더 준다 — 이게 없으면 60초 판에 25만점이 통과한다 */
assert.equal(entry({ ...run, t: 60, hits: 500, tries: 500, score: 250000 }).ok, false,
             '60초에 500곳은 없다');
assert.equal(entry({ ...run, t: 300, hits: 26, tries: 26, score: 13000 }).ok, false,
             '25곳짜리 코스에서 26곳을 들를 수는 없다');
assert.equal(entry({ ...run, t: 300, hits: 25, tries: 25, score: 12500 }).ok, true,
             '정원을 다 채운 만점 판은 통과한다');
assert.equal(entry({ ...run, c: 'nowhere-dong' }).ok, false, '없는 코스는 판을 만들지 못한다');
/* 25곳짜리 seoul-gu 는 코스 정원이 먼저 걸린다 — 25 × 500 = 12,500 이 천장이다 */
assert.equal(entry({ ...run, t: 60, score: 12500, hits: 25, tries: 25 }).ok, true,
             '정원을 다 채운 판은 60초에서도 통과한다');
assert.equal(entry({ ...run, t: 60, score: 12600, hits: 25, tries: 25 }).ok, false,
             '그 위는 거른다');
/* 정원이 큰 코스에서는 시간이 천장을 정한다 — 60초 × 2 = 26곳까지 */
assert.equal(entry({ ...run, c: 'songpa-dong', t: 60, hits: 26, tries: 26, score: 13000 }).ok,
             true, '26곳짜리 코스는 26곳까지 든다');
assert.equal(entry({ ...run, t: 300, hits: 25, tries: 30, score: 12500 }).ok, true,
             '5분 판의 만점 기록은 그대로 통과한다');

/* 줄의 주인은 이름이 아니라 who 다 */
assert.equal(entry({ ...run, who: '' }).ok, false, 'who 없이는 못 올린다');
assert.equal(entry({ ...run, who: 'abc' }).ok, false, '너무 짧은 who 는 거른다');
assert.equal(entry({ ...run, who: '../../etc' }).ok, false, 'who 는 영숫자뿐');

/* 이름은 남 앞에 걸린다 */
assert.equal(entry({ ...run, name: '  가 나  ' }).name, '가 나', '앞뒤 공백은 턴다');
assert.equal(entry({ ...run, name: '가'.repeat(30) }).name, '가'.repeat(12), '이름은 12자에서 자른다');
assert.equal(entry({ ...run, name: '가‮나' }).name, '가 나', '방향 뒤집기 글자는 지운다');
assert.equal(entry({ ...run, name: '가\n나' }).name, '가 나', '줄바꿈으로 두 줄을 차지할 수 없다');
assert.equal(entry({ ...run, name: '​​' }).ok, false, '보이지 않는 글자만 있는 이름은 거른다');
assert.equal(entry({ ...run, name: '   ' }).ok, false, '빈 이름은 거른다');

/* SIZE 는 data/*.course.json 에서 뽑아 적은 표다. 코스가 늘거나 항목이 바뀌면
   여기서 어긋난다 — 손으로 옮겨 적은 값이 조용히 낡는 걸 막는 유일한 자리다. */
const dir = new URL('../data/', import.meta.url);
for (const f of readdirSync(dir).filter(n => n.endsWith('.course.json'))) {
  const slug = f.replace('.course.json', '');
  const n = JSON.parse(readFileSync(new URL(f, dir), 'utf8')).items.length;
  assert.equal(where({ c: slug, t: 120 }).size, n, `${slug} 정원이 데이터와 다르다`);
}

console.log('board self-check done');
