/* 경쟁전 판정 코어. 서버(DO)·브라우저·봇이 이 파일 하나를 같이 쓴다 — 네트워크도 DOM 도 없고,
   시각은 늘 인자(now, ms)로 받는다. 수치는 compete-config.mjs 에서만 온다.

   한 판은 순수 리듀서다: step(state, event, now) → { state, out }. out 은 내보낼 메시지
   [{ to: 'all' | pid, msg }] 이고, 그걸 소켓에 싣는 건 부른 쪽(DO)의 일이다.
   단계는 WAITING → COUNTDOWN → PLAYING → FINISHED → RESULTS. FINISHED 에서 결과가 서고,
   RESULTS 는 부른 쪽이 레이팅·저장을 마쳤다는 표시다. */
import { STROKE, RANKED_POOL, SET, SPRINT, TERRITORY, NET, AUDIT } from './compete-config.mjs';
import { NAMES } from './names.mjs';

/* ── 타수 ──────────────────────────────────────────────
   두벌식에서 실제로 누르는 키로 푼다(app.js 의 jamo·keysOf 와 같은 셈). 겹모음·겹받침은
   STROKE 값이 2면 두 키로 쪼개고 1이면 한 키로 둔다. 쌍자음·ㅒ·ㅖ 는 Shift+키 한 번이다.
   한글이 아닌 글자(숫자·가운뎃점·공백)는 한 글자 한 키. */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const VOWEL2 = { ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' };
const FINAL2 = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ',
                 ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' };
const split = ch => VOWEL2[ch] && STROKE.compoundVowel === 2 ? [...VOWEL2[ch]]
  : FINAL2[ch] && STROKE.compoundFinal === 2 ? [...FINAL2[ch]] : [ch];

/** 문자열을 누르는 키 하나하나로 푼다. 조합 중인 '강ㅅ' 도 '강서구' 의 앞부분으로 읽힌다.
 *  @param {string} s @returns {string[]} */
export function units(s) {
  const out = [];
  for (const ch of String(s ?? '').normalize('NFC')) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c >= 11172) { out.push(...split(ch)); continue; }
    out.push(CHO[Math.floor(c / 588)], ...split(JUNG[Math.floor(c % 588 / 28)]));
    if (c % 28) out.push(...split(JONG[c % 28]));
  }
  return out;
}
/** 이름을 치는 데 드는 키 수(확정 키 빼고) */
export const strokes = s => units(s).length;
/** 항목 하나의 값 — 이름 + 확정 키. CPM·예산·영토 가치가 전부 이걸 쓴다 */
export const itemStrokes = s => strokes(s) + STROKE.commit;

/** 폰 키보드는 keydown 이 229 로 와 키를 못 읽는다. 입력칸 값이 바뀐 앞뒤를 키 단위로 견줘
 *  친 키와 지운 키를 센다(공통 앞머리 밖이 전부 바뀐 것). '가'→'간' 은 1키, '닭'→'달' 은 지움 1.
 *  @returns {{ keys: number, backs: number }} */
export function diffKeys(prev, next) {
  const a = units(prev), b = units(next);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return { keys: b.length - p, backs: a.length - p };
}

/** 정답 판정 — 정식 명칭과 정확히 같아야 한다(약칭 없음). 앞뒤 공백과 유니코드 조합형(NFC)만 맞춘다 */
const canon = s => String(s ?? '').normalize('NFC').trim();
export const judge = (text, name) => canon(text) === canon(name);

/* ── 문제 세트 ─────────────────────────────────────────── */
/** mulberry32. 같은 seed 는 어디서 돌려도 같은 수열이다 @param {number} seed */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** 코스 여럿의 이름을 한 풀로. 같은 이름은 한 번만(서울엔 신사동이 둘) */
export const pool = (slugs = RANKED_POOL) => [...new Set(slugs.flatMap(s => NAMES[s] || []))];

/** 시드로 세트를 뽑는다. 풀을 타수 순으로 cfg.bins 비율만큼 가른 칸마다 정해진 수를 뽑고,
 *  합이 예산(size × 풀 평균 ±tolerance) 안에 들 때까지 다시 뽑는다. 순서는 마지막에 섞는다.
 *  풀이 size 이하면 풀 전부를 섞어 낸다.
 *  @returns {{ items: string[], strokes: number, budget: number }} */
export function buildSet(seed, names, cfg = SET) {
  const r = rng(seed), val = n => itemStrokes(n);
  const mean = names.reduce((s, n) => s + val(n), 0) / names.length;
  if (names.length <= cfg.size) {
    const items = shuffle([...names], r);
    return { items, strokes: items.reduce((s, n) => s + val(n), 0), budget: Math.round(mean * items.length) };
  }
  const sorted = [...names].sort((a, b) => val(a) - val(b) || (a < b ? -1 : a > b ? 1 : 0));
  let cum = 0;
  const bins = cfg.bins.map(w => { const lo = Math.round(cum * sorted.length); cum += w; return sorted.slice(lo, Math.round(cum * sorted.length)); });
  /* 칸마다 뽑을 수 — 큰 나머지 순으로 size 를 맞춘다 */
  const raw = cfg.bins.map(w => w * cfg.size), counts = raw.map(Math.floor);
  raw.map((x, i) => [x - counts[i], i]).sort((a, b) => b[0] - a[0])
    .slice(0, cfg.size - counts.reduce((a, b) => a + b, 0)).forEach(([, i]) => counts[i]++);
  const budget = cfg.size * mean, lo = budget * (1 - cfg.tolerance), hi = budget * (1 + cfg.tolerance);
  let best = null, bestGap = Infinity;
  for (let k = 0; k < cfg.tries && bestGap > 0; k++) {
    const pick = bins.flatMap((b, i) => shuffle([...b], r).slice(0, counts[i]));
    const sum = pick.reduce((s, n) => s + val(n), 0);
    const gap = sum < lo ? lo - sum : sum > hi ? sum - hi : 0;
    if (gap < bestGap) { best = pick; bestGap = gap; }
  }
  return { items: shuffle(best, r), strokes: best.reduce((s, n) => s + val(n), 0), budget: Math.round(budget) };
}

/* ── 한 판 ──────────────────────────────────────────────
   키는 브라우저가 100ms 마다 묶어 보낸다(keys). 확정(commit) 직전에는 남은 키를 먼저 보내야
   그 항목의 몫으로 셈된다 — 서버는 다음 확정까지 쌓인 키를 그 항목에 붙인다. */
const MODES = { sprint: SPRINT, territory: TERRITORY };

/** 새 판. sprint 는 slugs 의 풀에서 시드로 세트를 뽑고, territory 는 코스 하나의 지명 전부다.
 *  @param {{ mode: 'sprint'|'territory', seed: number, players: string[], slugs?: string[] }} o */
export function newMatch({ mode, seed, players, slugs = RANKED_POOL }) {
  if (!MODES[mode]) throw new Error('mode');
  const items = mode === 'sprint' ? buildSet(seed, pool(slugs)).items : pool(slugs);
  return {
    mode, seed, phase: 'WAITING', items, values: items.map(itemStrokes),
    startAt: null, endAt: null, result: null,
    owner: mode === 'territory' ? items.map(() => null) : null,
    players: Object.fromEntries(players.map(pid => [pid, {
      ready: false, at: 0, last: null, doneAt: null, quit: false,
      presses: 0, pend: { keys: 0, backs: 0, wrongs: 0 }, log: [], flags: [],
    }])),
  };
}

/** 한 사람의 지표. CPM = 맞힌 항목 타수 합 ÷ 분(완주했으면 완주까지, 아니면 끝까지).
 *  정확도 = 맞힌 항목 타수 합 ÷ 실제 누른 키(지움·확정 포함), 0–100 정수 */
export function stats(s, pid) {
  const p = s.players[pid], good = p.log.reduce((a, it) => a + it.strokes, 0);
  const until = p.doneAt ?? s.endAt ?? s.startAt;
  const ms = Math.max(1, until - s.startAt);
  return {
    strokes: good, items: p.log.length, ms,
    cpm: s.startAt === null ? 0 : Math.round(good / ms * 60000),
    acc: p.presses ? Math.min(100, Math.floor(good / p.presses * 100)) : 0,
    log: p.log,
  };
}

/** 상대 진행 표시(10Hz)에 싣는 값 — 입력 글자는 안 나간다 */
export const progress = s => Object.fromEntries(Object.entries(s.players)
  .map(([pid, p]) => [pid, { itemIndex: p.at, strokes: p.log.reduce((a, it) => a + it.strokes, 0) }]));

/* 둘 중 누가 나은지: 1 a · -1 b · 0 같음. 정확도까지 같으면 무승부다 */
const better = (a, b, key) => a[key] !== b[key] ? Math.sign(a[key] - b[key]) : Math.sign(a.acc - b.acc);

function decide(s, reason) {
  const ids = Object.keys(s.players), st = Object.fromEntries(ids.map(id => [id, stats(s, id)]));
  const [A, B] = ids, pa = s.players[A], pb = s.players[B];
  let w = 0;   // 1 = A, -1 = B, 0 = 무승부
  if (reason === 'abort') w = 0;
  else if (pa.quit || pb.quit) w = pa.quit === pb.quit ? 0 : pa.quit ? -1 : 1;
  else if (s.mode === 'territory') {
    const val = id => s.owner.reduce((a, o, i) => a + (o === id ? s.values[i] : 0), 0);
    st[A].value = val(A); st[B].value = val(B);
    w = better(st[A], st[B], 'value');
  } else if (pa.doneAt !== null && pb.doneAt !== null) {
    /* 둘 다 완주 — 차이가 tieMs 안이면 동시로 보고 정확도로 가린다 */
    w = Math.abs(pa.doneAt - pb.doneAt) <= SPRINT.tieMs ? Math.sign(st[A].acc - st[B].acc) : pa.doneAt < pb.doneAt ? 1 : -1;
  } else if (pa.doneAt !== null || pb.doneAt !== null) w = pa.doneAt !== null ? 1 : -1;
  else w = better(st[A], st[B], 'strokes');   // 시간 끝 — 맞힌 타수 합
  return { winner: w === 1 ? A : w === -1 ? B : null, reason, rated: reason !== 'abort', stats: st };
}

function finish(s, now, reason, out) {
  s.phase = 'FINISHED';
  s.endAt = reason === 'abort' ? now : Math.min(now, s.startAt + MODES[s.mode].secs * 1000);   // 무른 판은 무른 시각
  s.result = decide(s, reason);
  const { stats: st, ...rest } = s.result;
  out.push({ to: 'all', msg: { type: 'match.end', result: { ...rest,
    stats: Object.fromEntries(Object.entries(st).map(([id, x]) => [id, { cpm: x.cpm, acc: x.acc, strokes: x.strokes, items: x.items, value: x.value }])) } } });
}

const flag = (p, why) => { if (!p.flags.includes(why)) p.flags.push(why); };

/** 리듀서. state 를 직접 고치지 않고 복사본을 돌려준다.
 *  event: { type: 'ready'|'tick'|'keys'|'commit'|'paste'|'forfeit'|'close', pid?, keys?, backs?, i?, text? } */
export function step(state, ev, now) {
  const s = structuredClone(state), out = [], p = ev.pid !== undefined ? s.players[ev.pid] : null;
  const cfg = MODES[s.mode], lim = s.startAt === null ? Infinity : s.startAt + cfg.secs * 1000;
  if (ev.pid !== undefined && !p) return { state, out };   // 이 판 사람이 아니다

  switch (ev.type) {
    case 'ready':
      if (s.phase !== 'WAITING') break;
      p.ready = true;
      if (Object.values(s.players).every(x => x.ready)) {
        s.phase = 'COUNTDOWN';
        s.startAt = now + cfg.countdownMs;
        out.push({ to: 'all', msg: { type: 'match.countdown', startAt: s.startAt } });
      }
      break;

    case 'tick':
      if (s.phase === 'COUNTDOWN' && now >= s.startAt) {
        s.phase = 'PLAYING';
        for (const x of Object.values(s.players)) x.last = s.startAt;
        out.push({ to: 'all', msg: { type: 'match.phase', phase: 'PLAYING' } });
      }
      if (s.phase !== 'PLAYING') break;
      if (now >= lim) { finish(s, now, 'time', out); break; }
      /* 한 사람만 완주했으면 tieMs 동안 상대를 기다린다 — 그 안에 오면 동시다 */
      { const done = Object.values(s.players).map(x => x.doneAt).filter(t => t !== null);
        if (s.mode === 'sprint' && done.length && now >= Math.min(...done) + SPRINT.tieMs) finish(s, now, 'finish', out); }
      break;

    case 'keys': {
      if (s.phase !== 'PLAYING' || p.doneAt !== null) break;
      const k = Math.max(0, ev.keys | 0), b = Math.max(0, ev.backs | 0);
      p.pend.keys += k; p.pend.backs += b; p.presses += k + b;
      break;
    }

    case 'commit': {
      if (s.phase !== 'PLAYING' || p.doneAt !== null || now >= lim) break;
      /* 지난 항목을 다시 보낸 늦은 확정은 오답이 아니다 — 무시한다 */
      if (s.mode === 'sprint' && ev.i !== p.at) break;
      const text = String(ev.text ?? '').slice(0, 100);
      p.presses++;   // 확정 키도 누른 키다
      const i = s.mode === 'sprint' ? (judge(text, s.items[p.at]) ? p.at : -1)
        : s.owner.findIndex((o, j) => o === null && judge(text, s.items[j]));
      if (i < 0) {
        p.pend.wrongs++;
        out.push({ to: ev.pid, msg: { type: 'item.result', itemIndex: s.mode === 'sprint' ? p.at : null, correct: false } });
        break;
      }
      /* 정답인데 그 항목에 받은 키가 이름의 타수보다 적다 — 치지 않고 넣은 글자(붙여넣기·자동 채움) */
      if (p.pend.keys < strokes(s.items[i])) flag(p, 'keys');
      p.log.push({ i, start: p.last, end: now, strokes: s.values[i], ...p.pend });
      p.pend = { keys: 0, backs: 0, wrongs: 0 };
      p.last = now;
      out.push({ to: ev.pid, msg: { type: 'item.result', itemIndex: i, correct: true } });
      if (s.mode === 'sprint') {
        p.at++;
        if (p.at === s.items.length) {
          p.doneAt = now;
          if (Object.values(s.players).every(x => x.doneAt !== null)) finish(s, now, 'finish', out);
        }
      } else {
        s.owner[i] = ev.pid;
        out.push({ to: 'all', msg: { type: 'territory.claim', i, pid: ev.pid } });
        if (s.owner.every(o => o !== null)) finish(s, now, 'clear', out);
      }
      break;
    }

    case 'forfeit':
      /* 시작 전에 나가면 판을 무른다(레이팅 없음). 시작한 뒤면 나간 쪽이 진다. abort 는 카운트다운 중에
         끊겨 유예가 끝난 사람 — 그 사이 판이 시작했어도 무른 것으로 본다 */
      if (s.phase === 'WAITING' || s.phase === 'COUNTDOWN' || (ev.abort && s.phase === 'PLAYING')) { p.quit = true; finish(s, now, 'abort', out); }
      else if (s.phase === 'PLAYING') { p.quit = true; finish(s, now, 'quit', out); }
      break;

    /* 브라우저가 막은 붙여넣기를 알린다 — 판은 그대로, 플래그만 */
    case 'paste':
      if (s.phase === 'PLAYING') flag(p, 'paste');
      break;

    case 'close':
      if (s.phase === 'FINISHED') s.phase = 'RESULTS';
      break;
  }
  return { state: s, out };
}

/* ── 메시지(브라우저 → 서버) ────────────────────────────
   서버가 받는 모양은 여기서만 정한다. 모르는 type·모양이 틀린 값은 null — 받는 쪽은 그냥 버린다.
   input.keys 의 events 는 { dt, kind: 'key'|'back', code? } — dt 는 앞 키부터 잰 ms(브라우저 시계,
   항목 안 키 간격 분석에만 쓴다). PC 는 keydown 의 code 를 싣고, 폰은 diffKeys 로 센 키를 code 없이 싣는다.
   확정 키(Enter·스페이스)는 events 에 넣지 않는다 — input.commit 이 그 한 번이다. */
const str = (v, n) => typeof v === 'string' && v.length <= n ? v : null;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function parseMsg(raw) {
  if (typeof raw !== 'string' || raw.length > NET.maxMsgBytes) return null;
  let m;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  switch (m.type) {
    case 'auth': { const k = str(m.ticket ?? m.token, 64); return k ? { type: 'auth', key: k } : null; }
    case 'queue.join':
      if (!['sprint', 'territory'].includes(m.mode) || typeof m.ranked !== 'boolean') return null;
      if (m.bot !== undefined && typeof m.bot !== 'boolean') return null;
      return { type: 'queue.join', mode: m.mode, ranked: m.ranked, slug: str(m.slug ?? '', 40) ?? '', bot: m.bot === true };
    case 'queue.leave': case 'match.ready': return { type: m.type };
    case 'input.paste': return { type: 'input.paste' };
    case 'ping': return typeof m.t === 'number' && Number.isFinite(m.t) ? { type: 'ping', t: m.t } : null;
    case 'input.commit':
      if (!(m.itemIndex === null || int(m.itemIndex, 0, 9999))) return null;
      return str(m.text, 100) === null ? null : { type: 'input.commit', itemIndex: m.itemIndex, text: m.text };
    case 'input.keys': {
      if (!int(m.itemIndex, 0, 9999) || !Array.isArray(m.events) || m.events.length > NET.maxKeysPerBatch) return null;
      const events = [];
      for (const e of m.events) {
        if (!e || !int(e.dt, 0, 600000) || !['key', 'back'].includes(e.kind)) return null;
        const code = e.code === undefined ? undefined : str(e.code, 24);
        if (code === null) return null;
        events.push(code === undefined ? { dt: e.dt, kind: e.kind } : { dt: e.dt, kind: e.kind, code });
      }
      return { type: 'input.keys', itemIndex: m.itemIndex, events };
    }
  }
  return null;
}
/** 키 묶음 → 리듀서가 셈하는 수 */
export const countKeys = events => ({
  keys: events.filter(e => e.kind === 'key').length,
  backs: events.filter(e => e.kind === 'back').length,
});

/* ── 부정 의심(판이 끝날 때) ─────────────────────────────
   한 사람의 판을 본다. batches 는 받은 키 묶음 [{ at, i, events }], log 는 맞힌 항목(서버 시각).
   항목의 첫 키 dt 는 앞 항목에서 건너온 간격이라 빼고, 나머지 dt 만 그 항목 안의 간격으로 쓴다.
   돌려주는 값은 이유 목록(없으면 []): cpm · clock · fast · cv · device */
export function audit({ dev, log, batches, cpm, ms }, cfg = AUDIT) {
  const c = cfg[dev] ?? cfg.pc, why = new Set(), by = new Map();
  if (cpm > c.cpmMax && ms >= c.sustainMs) why.add('cpm');
  for (const b of batches) { if (!by.has(b.i)) by.set(b.i, []); by.get(b.i).push(...b.events); }
  const gaps = [];
  let bad = 0, keys = 0, coded = 0;
  for (const [i, ev] of by) {
    for (const e of ev) if (e.kind === 'key') { keys++; if (e.code !== undefined) coded++; }
    const dts = ev.slice(1).map(e => e.dt), it = log.find(x => x.i === i);
    if (it && dts.reduce((a, x) => a + x, 0) > it.end - it.start + cfg.clock.slackMs + cfg.clock.rttMs) { bad++; continue; }
    let run = 0;
    for (const dt of dts) {
      run = dt < c.fastMs ? run + 1 : 0;
      if (c.fastRun && run >= c.fastRun) why.add('fast');
    }
    gaps.push(...dts);
  }
  if (bad >= cfg.clock.items) why.add('clock');
  if (gaps.length >= c.cvKeys) {
    const mean = gaps.reduce((a, x) => a + x, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, x) => a + (x - mean) ** 2, 0) / gaps.length);
    if (!mean || sd / mean < c.cvMin) why.add('cv');
  }
  if (keys >= c.deviceKeys && (coded / keys < c.minCode || coded / keys > c.maxCode)) why.add('device');
  return [...why];
}
