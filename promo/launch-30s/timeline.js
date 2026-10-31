/* regiontype 30초 세로 홍보 영상 — 시간표. 화면(scene.js)과 소리(audio.mjs)가 이 한 표를 같이 읽는다.
   120 BPM: 한 박 0.5s = 15프레임. 장면 경계 3·8·14·20·26s 는 모두 박 위에 있다.
   타자는 실제 두벌식 조합(ㅅ→서→성→서우→서울)을 그대로 밟는다 — 스페이스·Enter 가 확정이다. */

export const FPS = 30, DUR = 30, W = 1080, H = 1920;
export const BPM = 120, BEAT = 60 / BPM;

/* ── 두벌식 ─────────────────────────────────────────── */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const SPLIT = { ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' };
const JOIN = Object.fromEntries(Object.entries(SPLIT).map(([k, v]) => [v, k]));
const isV = j => JUNG.includes(j);
const syl = (c, v, k = ' ') => String.fromCharCode(0xac00 + (CHO.indexOf(c) * 21 + JUNG.indexOf(v)) * 28 + JONG.indexOf(k));

/* '서울' → ['ㅅ','ㅓ','ㅇ','ㅜ','ㄹ'] — 겹모음은 두 번 누른다. 한글 아닌 글자는 그대로 한 번 */
export function keysOf(str) {
  const out = [];
  for (const ch of str) {
    const n = ch.charCodeAt(0) - 0xac00;
    if (n < 0 || n > 11171) { out.push(ch); continue; }
    const c = CHO[Math.floor(n / 588)], v = JUNG[Math.floor(n % 588 / 28)], k = JONG[n % 28];
    out.push(c, ...(SPLIT[v] || v));
    if (k !== ' ') out.push(k);   // 겹받침은 이 영상에 없다
  }
  return out;
}

/* 키 하나씩 넣은 뒤의 화면 글자. { text, comp } — comp 는 아직 조합 중인 마지막 글자가 있는지 */
export function composeSteps(keys) {
  const done = [], steps = [];
  let c = null, v = null, k = null;   // 조합 중인 음절
  const flush = () => { if (c || v) done.push(c && v ? syl(c, v, k || ' ') : (c || v)); c = v = k = null; };
  for (const key of keys) {
    if (isV(key)) {
      if (k) { const moved = k; k = null; flush(); c = moved; v = key; }
      else if (c && !v) v = key;
      else if (v && JOIN[v + key]) v = JOIN[v + key];
      else { flush(); v = key; }
    } else if (CHO.includes(key)) {
      if (c && v && !k && JONG.includes(key)) k = key;
      else { flush(); c = key; }
    } else { flush(); done.push(key); }
    const cur = c || v ? (c && v ? syl(c, v, k || ' ') : (c || v)) : '';
    steps.push({ text: done.join('') + cur, comp: !!cur });
  }
  return steps;
}

/* 이름 하나를 confirm 시각에 확정되게 친다. 키 간격은 step, 마지막 키는 확정 한 칸 앞 */
export function typing(text, confirm, step) {
  const keys = keysOf(text), steps = composeSteps(keys);
  return { text, confirm, keys: keys.map((k, i) => ({ t: confirm - (keys.length - i) * step, key: k, ...steps[i] })) };
}
/* t 에 보이는 글자 */
export function typedAt(ty, t) {
  if (t >= ty.confirm) return { text: ty.text, comp: false, done: true };
  let s = { text: '', comp: false, done: false };
  for (const k of ty.keys) if (k.t <= t) s = { text: k.text, comp: k.comp, done: false };
  return s;
}

/* ── 장면 경계 ───────────────────────────────────────── */
export const SC = { first: 0, fill: 3, world: 8, bot: 14, pass: 20, brand: 26 };

/* ── 1·2장: 서울 — 25개 자치구, 코스 차례 그대로(data/seoul-gu.course.json) ── */
export const SEOUL_ORDER = ['강서구', '양천구', '구로구', '금천구', '영등포구', '마포구', '서대문구', '은평구', '종로구', '중구',
  '용산구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구', '광진구', '성동구', '동대문구', '중랑구', '노원구', '도봉구', '강북구', '성북구'];
/* 확정 박: 강서구 2.0 · 4분음표 넷 · 8분음표 일곱 · 16분음표 열셋 — 점점 빨라져 7.875 에 다 찬다 */
const fillBeats = [2.0, 3.0, 3.5, 4.0, 4.5];
for (let i = 0; i < 7; i++) fillBeats.push(4.75 + i * 0.25);
for (let i = 0; i < 13; i++) fillBeats.push(6.375 + i * 0.125);
export const SEOUL_TYPE = SEOUL_ORDER.map((name, i) => {
  const gap = i ? fillBeats[i] - fillBeats[i - 1] : 1, n = keysOf(name).length;
  const step = i === 0 ? 0.083 : Math.min(0.06, Math.max(0.006, (gap - Math.min(0.12, gap * 0.3)) / n));
  return typing(name, fillBeats[i], step);
});
export const SEOUL_WORD = typing('서울', 0.5, 0.09);

/* ── 3장: 도쿄·파리 — 각 코스의 첫 이름(data/names/*.ko.json) ── */
export const TOKYO_TYPE = typing('네리마구', 10.5, 0.08);
export const PARIS_TYPE = typing('파리 16구', 12.0, 0.075);

/* ── 4장: 봇 — 홈(서울)에서 실제로 되는 요청: 지도 위 코스를 시작한다(ranked.js act 'start') ── */
export const BOT_ASK = typing('강서구 시작해줘', 16.5, 0.075);
export const BOT_REPLY_AT = 16.95;
/* 강서구 20개 행정동 — 코스 차례(data/gangseo-dong.course.json). 18.8 부터 19.85 까지 */
export const GANGSEO_ORDER = ['공항동', '방화2동', '방화3동', '방화1동', '가양1동', '가양2동', '가양3동', '염창동', '등촌1동', '등촌3동',
  '발산1동', '화곡3동', '우장산동', '화곡1동', '화곡8동', '화곡2동', '화곡4동', '등촌2동', '화곡6동', '화곡본동'];
export const GANGSEO_FILL = GANGSEO_ORDER.map((name, i) => ({ name, t: 18.8 + i * 0.055 }));

/* ── 5장: 리전 패스 — 끝낸 판마다 20 XP, 100 XP 에 한 레벨(assets/bloub/items.js PASS_XP) ── */
export const XP_GAME = 20, XP_LEVEL = 100;
export const XP_TICKS = [21.0, 21.5, 22.0, 22.5, 23.0];          // 다섯 판 → Lv 1 (호박 팔레트)
for (let i = 1; i <= 15; i++) XP_TICKS.push(24.0 + i * 1 / 15);   // 열다섯 판 더 → Lv 4 (박쥐 모양)
export const LV1_AT = 23.0, LV4_AT = 25.0;

/* ── 6장: 브랜드 ── */
export const ROMA_TYPE = typing('로마', 27.0, 0.1);
export const LOGO_AT = 28.0, LOOP_AT = 29.75;

/* ── 소리 사건 — audio.mjs 가 읽는다 ── */
export function soundEvents() {
  const ev = [];
  const keyEv = (ty, vol = 1) => {
    for (const k of ty.keys) ev.push({ t: k.t, type: k.key === ' ' ? 'space' : 'key', vol });
    ev.push({ t: ty.confirm, type: 'confirm', vol });
  };
  keyEv(SEOUL_WORD);
  SEOUL_TYPE.forEach((ty, i) => { keyEv(ty, i < 5 ? 1 : i < 12 ? 0.7 : 0.45); ev.push({ t: ty.confirm, type: 'fill', n: i }); });
  ev.push({ t: 0.5, type: 'unfold' });
  ev.push({ t: 8.0, type: 'complete' });
  ev.push({ t: 8.5, type: 'trace' }, { t: 10.75, type: 'trace' });
  keyEv(TOKYO_TYPE); ev.push({ t: TOKYO_TYPE.confirm, type: 'fill', n: 3 });
  keyEv(PARIS_TYPE); ev.push({ t: PARIS_TYPE.confirm, type: 'fill', n: 5 });
  ev.push({ t: 12.5, type: 'spread' });
  ev.push({ t: 14.0, type: 'bot' });
  keyEv(BOT_ASK, 0.85);
  ev.push({ t: BOT_REPLY_AT, type: 'reply' });
  ev.push({ t: 18.0, type: 'trace' });
  GANGSEO_FILL.forEach((f, i) => ev.push({ t: f.t, type: 'key', vol: 0.4 }, { t: f.t, type: 'fill', n: i, soft: true }));
  ev.push({ t: 20.0, type: 'complete' });
  ev.push({ t: 20.0, type: 'straighten' });
  XP_TICKS.forEach((t, i) => ev.push({ t, type: 'xp', n: i, soft: i >= 5 }));
  ev.push({ t: LV1_AT, type: 'level' }, { t: LV4_AT, type: 'level' }, { t: LV4_AT, type: 'morph' });
  ev.push({ t: 26.0, type: 'fold' });
  keyEv(ROMA_TYPE);
  ev.push({ t: 27.0, type: 'align' });
  ev.push({ t: LOGO_AT, type: 'logo' });
  return ev.sort((a, b) => a.t - b.t);
}
