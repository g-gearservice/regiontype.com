/* 사람처럼 치는 봇. 판정 길은 따로 없다 — 여기는 '언제 어떤 키를 누르는가' 의 타임라인만 짓고,
   판 DO 가 그걸 사람의 input.keys · input.commit 과 같은 길(ingest)로 넣는다. 수치는 BOT(config).

   한 항목: 시작 지연(신호 읽기, 긴 이름이면 더) → 키마다 로그정규 간격(두벌식 손 교대 보정) →
   드문 음절 앞 망설임 → 키마다 오타(틀린 키 1–3 → 알아챔 → 백스페이스 → 바른 키) → 확정.
   아주 드물게 끝 음절을 빼먹고 확정했다가 고친다(오답 제출).
   모든 무작위는 seed 하나에서 나온다 — 같은 seed 는 같은 손이고, DO 가 쫓겨났다 깨어나도 다시 지을 수 있다. */
import { BOT, SPRINT } from './compete-config.mjs';
import { units, strokes, rng, pool, newMatch, step, stats } from './compete.mjs';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const skill = R => clamp((R - 1000) / 1500, 0, 1);

/** 기기의 기본 표 — 보정된 표(bot_calib)가 없을 때. mobile 은 pc 표 × mobileScale */
export const baseTable = dev => BOT.cpm.map(([R, c]) => [R, dev === 'mobile' ? c * BOT.mobileScale : c]);
/** 레이팅 → 목표 CPM. 표 사이는 선형, 표 밖은 끝값. table 은 그 기기의 표(없으면 baseTable) */
export function targetCpm(R, dev = 'pc', table = baseTable(dev)) {
  let c;
  if (R <= table[0][0]) c = table[0][1];
  else if (R >= table.at(-1)[0]) c = table.at(-1)[1];
  else {
    const i = table.findIndex(([r]) => r > R), [r0, c0] = table[i - 1], [r1, c1] = table[i];
    c = c0 + (c1 - c0) * (R - r0) / (r1 - r0);
  }
  return c;
}
/** 키당 오타 확률 */
export const typoP = R => clamp(BOT.typo.base - (R - 1000) * BOT.typo.slope, BOT.typo.min, BOT.typo.max);

const avg = ([a, b]) => (a + b) / 2;
/** 키 간격 평균. 목표 CPM 은 판에서 재는 값(맞힌 타수 ÷ 시간)이라, 항목 하나에 드는 시간
 *  (타수+확정)·60000/CPM 에서 키 말고 드는 시간(시작 지연·긴 이름·망설임·오타 알아챔·오답 제출)의
 *  기댓값을 빼고, 남은 시간을 키 간격 수(바른 키 + 확정 + 오타 키·지움)로 나눈다. 평균은 그 판 세트로 낸다 */
export function keyGap(rating, cpm, items) {
  const n = items.length, s = items.reduce((a, x) => a + strokes(x), 0) / n;
  const rareN = items.reduce((a, x) => a + [...x].filter(rare).length, 0) / n;
  const longMs = items.reduce((a, x) => a + Math.max(0, strokes(x) - BOT.long.at) * BOT.long.ms, 0) / n;
  const p = typoP(rating), wrong = 2;   // Math.round(uni[1,3]) 의 평균
  const fixed = BOT.startDelay[0] + (BOT.startDelay[1] - BOT.startDelay[0]) * skill(rating) + longMs
    + rareN * BOT.hesitate.p * avg(BOT.hesitate.ms) + s * p * avg(BOT.typo.notice) + BOT.wrongSubmit.p * avg(BOT.wrongSubmit.notice);
  const gaps = (s + 1) + s * p * wrong * (1 + BOT.typo.back) + BOT.wrongSubmit.p;
  return Math.max(BOT.minGapMs, ((s + 1) * 60000 / cpm - fixed) / gaps);
}

/** 봇 한 명의 손. 판 컨디션 ~ N(1, sd) 까지 seed 로 정해진다. items 는 그 판의 세트(간격 평균을 잡는 데 쓴다) */
export function makeBot({ seed, rating, dev = 'pc', table = baseTable(dev), items = pool() }) {
  const r = rng(seed);
  const normal = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const uni = ([a, b]) => a + (b - a) * r();
  const cond = clamp(1 + normal() * BOT.condition.sd, ...BOT.condition.clamp);
  const mean = keyGap(rating, targetCpm(rating, dev, table), items) / cond;
  /* 로그정규: 평균 mean, 변동계수 cv 가 되도록 μ·σ 를 잡는다 */
  const s2 = Math.log(1 + BOT.cv ** 2), mu = Math.log(mean) - s2 / 2, sd = Math.sqrt(s2);
  return { r, uni, rating, cond, mean, p: typoP(rating), gap: () => Math.exp(mu + sd * normal()) };
}

/* 두벌식: 모음은 오른손, 자음은 왼손. 한글이 아닌 키(숫자·가운뎃점)는 보정하지 않는다 */
const VOWEL = new Set('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ');
const hand = u => VOWEL.has(u) ? 'R' : /[ㄱ-ㅎ]/.test(u) ? 'L' : null;
/* 드문 음절 — 겹모음·ㅒ·ㅖ·겹받침·쌍받침이 든 음절 */
const RARE_V = new Set('ㅒㅖㅘㅙㅚㅝㅞㅟㅢ'), RARE_T = new Set('ㄲㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄㅆ');
const rare = ch => {
  const c = ch.charCodeAt(0) - 0xAC00;
  if (c < 0 || c >= 11172) return false;
  return RARE_V.has('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'[Math.floor(c % 588 / 28)])
    || RARE_T.has(['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'][c % 28]);
};

/** 항목 하나를 치는 계획. t 는 그 항목이 시작되는 시각(앞 항목 확정).
 *  @returns {{ events: {t:number, kind:'key'|'back'|'commit', text?:string}[], end: number }} */
export function itemPlan(b, name, t) {
  const out = [], chars = [...String(name).normalize('NFC')];
  t += BOT.startDelay[0] + (BOT.startDelay[1] - BOT.startDelay[0]) * skill(b.rating) + b.uni([-BOT.startJitter, BOT.startJitter]);
  const n = strokes(name);
  if (n > BOT.long.at) t += (n - BOT.long.at) * BOT.long.ms;
  const us = chars.flatMap((ch, ci) => units(ch).map((u, k) => ({ u, ci, first: k === 0 })));
  /* 손 교대 보정. 평균이 1 이 되게 나눠 목표 속도는 그대로 둔다 */
  const f = us.map((x, i) => {
    const h = hand(x.u), ph = i ? hand(us[i - 1].u) : null;
    return !h || !ph ? 1 : h === ph ? BOT.sameHand : BOT.alternate;
  });
  const fm = f.reduce((a, x) => a + x, 0) / (f.length || 1);
  const slip = chars.length > 1 && b.r() < BOT.wrongSubmit.p;   // 끝 음절을 빼먹고 확정
  const lastAt = us.findIndex(x => x.ci === chars.length - 1);
  for (let i = 0; i < us.length; i++) {
    if (slip && i === lastAt) {
      t += b.gap();
      out.push({ t, kind: 'commit', text: chars.slice(0, -1).join('') });
      t += b.uni(BOT.wrongSubmit.notice);
    }
    if (us[i].first && rare(chars[us[i].ci]) && b.r() < BOT.hesitate.p) t += b.uni(BOT.hesitate.ms);
    if (b.r() < b.p) {
      const k = Math.round(b.uni(BOT.typo.wrong));
      for (let j = 0; j < k; j++) { t += b.gap(); out.push({ t, kind: 'key' }); }
      t += b.uni(BOT.typo.notice);
      for (let j = 0; j < k; j++) { t += b.gap() * BOT.typo.back; out.push({ t, kind: 'back' }); }
    }
    t += b.gap() * f[i] / fm;
    out.push({ t, kind: 'key' });
  }
  t += b.gap();
  out.push({ t, kind: 'commit', text: name });
  return { events: out, end: t };
}

/** 스프린트 한 판의 타임라인 전체 — 판이 시작될 때 한 번 짓는다. 이벤트마다 항목 번호 i 가 붙는다 */
export function timeline(b, items, startAt) {
  const all = [];
  let t = startAt;
  items.forEach((name, i) => {
    const p = itemPlan(b, name, t);
    for (const e of p.events) all.push({ ...e, i });
    t = p.end;
  });
  return all;
}

/** 이미 지난 이벤트를 판 메시지로 바꾼다 — 키는 항목별로 한 묶음(input.keys), 확정은 하나씩.
 *  DO 가 박자마다 부른다. 보낸 만큼 from 을 옮겨 돌려준다 */
export function due(events, from, now) {
  const msgs = [];
  let k = from, batch = null, last = null;
  for (; k < events.length && events[k].t <= now; k++) {
    const e = events[k];
    if (e.kind === 'commit') {
      if (batch) { msgs.push(batch); batch = null; }
      msgs.push({ type: 'input.commit', itemIndex: e.i, text: e.text });
    } else {
      if (!batch || batch.itemIndex !== e.i) { if (batch) msgs.push(batch); batch = { type: 'input.keys', itemIndex: e.i, events: [] }; last = null; }
      batch.events.push({ dt: Math.max(0, Math.round(last === null ? 0 : e.t - last)), kind: e.kind });
    }
    last = e.t;
  }
  if (batch) msgs.push(batch);
  return { msgs, from: k };
}

/* ── 시뮬레이션: 봇 대 봇 — DO 없이 리듀서만으로 한 판씩 ── */
function playBots(seed, ra, rb, dev = 'pc') {
  let s = newMatch({ mode: 'sprint', seed, players: ['a', 'b'] });
  s = step(step(s, { type: 'ready', pid: 'a' }, 0).state, { type: 'ready', pid: 'b' }, 0).state;
  s = step(s, { type: 'tick' }, s.startAt).state;
  const ev = [['a', ra], ['b', rb]].flatMap(([pid, R], j) =>
    timeline(makeBot({ seed: (seed * 2 + j) >>> 0, rating: R, dev, items: s.items }), s.items, s.startAt).map(e => ({ ...e, pid })))
    .sort((x, y) => x.t - y.t);
  for (const e of ev) {
    s = step(s, { type: 'tick' }, e.t).state;
    if (s.phase !== 'PLAYING') break;
    s = step(s, e.kind === 'commit' ? { type: 'commit', pid: e.pid, i: e.i, text: e.text }
      : { type: 'keys', pid: e.pid, keys: e.kind === 'key' ? 1 : 0, backs: e.kind === 'back' ? 1 : 0 }, e.t).state;
  }
  if (s.phase === 'PLAYING') s = step(s, { type: 'tick' }, s.startAt + SPRINT.secs * 1000).state;
  return { winner: s.result.winner, a: stats(s, 'a'), b: stats(s, 'b') };
}

/** n 판. 레이팅 차이 diffs 를 돌려 가며 높은 쪽 승률과, 레이팅 구간별 실제 CPM·정확도를 잰다 */
export function simulate(n, seed = 1, diffs = [0, 50, 100, 200, 300, 400, 600]) {
  const r = rng(seed), curve = Object.fromEntries(diffs.map(d => [d, { games: 0, wins: 0, draws: 0 }]));
  const speed = {};
  for (let k = 0; k < n; k++) {
    const d = diffs[k % diffs.length], lo = Math.round(1000 + r() * (1500 - d)), hi = lo + d;
    const g = playBots((seed * 100003 + k * 7919) >>> 0, hi, lo);
    const c = curve[d];
    c.games++;
    if (g.winner === 'a') c.wins++; else if (g.winner === null) c.draws++;
    for (const [R, st] of [[hi, g.a], [lo, g.b]]) {
      const band = Math.floor(R / 250) * 250;
      (speed[band] ??= { n: 0, cpm: 0, acc: 0, target: 0 });
      speed[band].n++; speed[band].cpm += st.cpm; speed[band].acc += st.acc; speed[band].target += targetCpm(R);
    }
  }
  return {
    curve: Object.entries(curve).map(([d, c]) => ({ diff: +d, games: c.games, win: (c.wins + c.draws / 2) / c.games,
      elo: 1 / (1 + 10 ** (-d / 400)) })),
    speed: Object.entries(speed).map(([band, x]) => ({ band: +band, n: x.n, cpm: Math.round(x.cpm / x.n),
      target: Math.round(x.target / x.n), acc: Math.round(x.acc / x.n) })),
  };
}

/* ── 보정 루프 ──────────────────────────────────────────
   calibrate: 점마다의 배율 [[R, mult]] 을 고친다. 그 둘레(±band)의 사람 대 봇 판에서 사람이 너무 이기면
   봇이 느린 것이니 배율을 step 만큼 올리고, 너무 지면 내린다. 배율은 cfg.mult 안에 묶는다.
   rows = [{ botRating, human: 1 | .5 | 0 }]. 배율은 날마다 쌓이고, 기본 표가 회귀로 바뀌어도 남는다.
   regress: 사람 판(레이팅·CPM)이 regressGames 를 넘으면 최소제곱 직선으로 기본 표의 점을 다시 잡는다.
   쓰는 표 = 기본 표 × 배율(withMult). 하루 한 번 compete-do.mjs 의 daily 가 부른다. */
export function calibrate(mults, rows, cfg = BOT.calib) {
  return mults.map(([R, m]) => {
    const near = rows.filter(x => Math.abs(x.botRating - R) < cfg.band);
    if (near.length < cfg.minGames) return [R, m];
    const w = near.reduce((a, x) => a + x.human, 0) / near.length;
    const next = w > cfg.target[1] ? m * (1 + cfg.step) : w < cfg.target[0] ? m * (1 - cfg.step) : m;
    return [R, Math.round(clamp(next, ...cfg.mult) * 1e4) / 1e4];
  });
}
export const withMult = (table, mults) => table.map(([R, c]) => [R, Math.round(c * (mults.find(([r]) => r === R)?.[1] ?? 1))]);
export function regress(pairs, ratings = BOT.cpm.map(([R]) => R), cfg = BOT.calib) {
  if (pairs.length < cfg.regressGames) return null;
  const n = pairs.length, mx = pairs.reduce((a, p) => a + p.rating, 0) / n, my = pairs.reduce((a, p) => a + p.cpm, 0) / n;
  const sxx = pairs.reduce((a, p) => a + (p.rating - mx) ** 2, 0), sxy = pairs.reduce((a, p) => a + (p.rating - mx) * (p.cpm - my), 0);
  if (!sxx) return null;
  const slope = sxy / sxx;
  return ratings.map(R => [R, Math.max(1, Math.round(my + slope * (R - mx)))]);
}
