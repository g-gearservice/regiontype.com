/* ── 라이선스 시험 판정 ──
   다섯 면허를 아래에서 위로 한 번에 하나씩 응시한다. 아래를 따야 위가 열린다.
   gamer·reporter 는 고른 코스를 secs 안에 완주하고 타수·정확도·오타를 모두 넘겨야 한다.
   basic·mid·expert 는 전국 시군구에서 뽑은 chars 자를 secs 안에 다 치면 합격이다 —
   시간 안에 끝냈다는 것이 곧 그 자수를 낸 것이라 타수·오타는 따로 보지 않는다. */
export const LICENSES = [
  { id: 'gamer', secs: 120, cpm: 400, acc: 93, miss: 5 },
  { id: 'reporter', secs: 120, cpm: 600, acc: 98, miss: 1 },
  { id: 'basic', secs: 60, chars: 270, acc: 90 },
  { id: 'mid', secs: 60, chars: 300, acc: 90 },
  { id: 'expert', secs: 60, chars: 320, acc: 90 },
];

export const TIER_WEIGHT = { gamer: 1, reporter: 2, basic: 3, mid: 4, expert: 5 };

/* 글자 수로 뽑는 면허가 치는 코스. 코스 정원은 시험 때마다 달라서 SIZE 에 없다 */
export const POOL_SLUG = 'kr-sgg';

/* 합격이면 null, 아니면 처음 걸린 조건 */
export function failOf(lic, { done, acc, cpm, misses }) {
  if (!done) return { kind: 'done' };
  if (lic.miss != null && misses > lic.miss) return { kind: 'miss', need: lic.miss };
  if (lic.cpm && cpm < lic.cpm) return { kind: 'cpm', need: lic.cpm };
  if (acc < lic.acc) return { kind: 'acc', need: lic.acc };
  return null;
}

/* 글자 수 합이 꼭 chars 인 이름 묶음. 섞어서 들어가는 것만 담고, 안 맞으면 다시 섞는다 */
export function pickPool(pool, chars, rand = Math.random) {
  for (let t = 0; t < 50; t++) {
    const a = pool.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const out = [];
    let left = chars;
    for (const nm of a) {
      if (nm.length <= left) { out.push(nm); left -= nm.length; if (!left) return out; }
    }
  }
  throw new Error(`pickPool: ${chars}자를 맞출 수 없다`);
}
