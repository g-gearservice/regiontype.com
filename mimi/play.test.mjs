/* node mimi/play.test.mjs — 엔진만 확인한다. 브라우저도 프레임워크도 필요 없다. */
import assert from 'node:assert/strict';
import { createRun, initials, store } from './play.js';

const data = {
  course: { slug: 't', title: '테스트', mode: 'sequence', items: [{ name: '화곡1동' }, { name: '공항동' }] },
  geom: { items: [{ name: '화곡1동' }, { name: '공항동' }] }
};

/* 조합 중인 글자는 오타가 아니다 */
{
  const r = createRun(data, 'learning');
  r.start();
  r.feed('화');
  r.feed('화고');          // '곡' 조합 중 — 초성이 맞으면 통과
  assert.equal(r.bad, false, '조합 중인 글자를 오타로 셌다');
  r.feed('화곡');
  r.feed('화곡1');
  r.feed('화곡1동');
  assert.equal(r.i, 1);
  assert.equal(r.misses, 0);
  assert.equal(r.rows[0].acc, 100);
}

/* 진짜 오타는 잡고, learning은 초성을 띄운다 */
{
  const r = createRun(data, 'learning');
  r.start();
  r.feed('종');
  assert.equal(r.bad, true);
  assert.equal(r.misses, 1);
  assert.equal(r.hint, initials('화곡1동'));
  assert.equal(r.i, 0, '오답으로 넘어가면 안 된다');
  r.feed('');
  r.feed('화곡1동');
  assert.equal(r.rows[0].miss, true);
  assert.ok(r.rows[0].acc < 100);
}

/* QUIZ는 오답 1회로 구간이 끝난다 (design.pen 05) */
{
  const r = createRun(data, 'quiz');
  r.start();
  r.feed('종');
  assert.equal(r.i, 1, 'QUIZ 오답이 구간을 끝내지 않았다');
  assert.equal(r.rows[0].miss, true);
}

/* PRACTICE는 Enter로 통과할 수 있고 기록을 남기지 않는다 */
{
  store.run = null;
  const r = createRun(data, 'practice');
  r.start();
  assert.equal(r.skip(), true);
  assert.equal(r.i, 1);
  r.feed('공항동');
  assert.equal(r.over, true);
  assert.equal(store.run, null, 'PRACTICE 기록이 저장됐다');
}

/* LEARNING은 저장하고, 요약이 말이 되는 값을 낸다 */
{
  store.run = null;
  const r = createRun(data, 'learning');
  r.start();
  r.feed('화곡1동');
  r.feed('공항동');
  assert.equal(store.run, r);
  const s = r.summary();
  assert.equal(s.ribbon, '완주 2 / 2');
  assert.equal(s.stats.find(x => x.label === '정확도').value, 100);
  assert.equal(s.rows.length, 2);
}

console.log('ok');
