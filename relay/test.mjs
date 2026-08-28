/* node relay/test.mjs — 이슈 한 장이 제대로 지어지는지만 본다 */
import assert from 'node:assert/strict';
import { compose } from './worker.mjs';

const base = { kind: 'bug', body: '가양1동이 오답으로 처리됩니다', from: '',
               v: '0.40', href: 'https://regiontype.com/', ua: 'UA' };

const a = compose(base);
assert.equal(a.title, '[버그] 가양1동이 오답으로 처리됩니다', '제목 = 종류 + 첫 줄');
assert.deepEqual(a.labels, ['버그']);
assert.ok(!a.body.includes('회신:'), '회신 주소는 적었을 때만 싣는다');
assert.ok(a.body.includes('```\n종류: 버그'), '메타는 코드 블록 안에 가둔다');

const b = compose({ ...base, from: 'me@x.com' });
assert.ok(b.body.includes('회신: me [at] x.com'), '메일은 @ 를 풀어 적는다');
assert.ok(!b.body.includes('me@x.com'), '원문 그대로는 남기지 않는다');

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
