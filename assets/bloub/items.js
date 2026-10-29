/* 봇에 씌우는 꾸미기와 리전 패스 보상 표. DOM 도 engine.js 도 부르지 않는 순수 자료다 —
   buddy.js 가 그리고, pass/ 가 보여 주고, 나중엔 relay/ 가 같은 표로 보상을 준다.

   좌표는 engine 의 몸 공간이다(반지름 100 = 모양 1, 보이는 칸은 ±158). 슬롯마다 원점이 다르다:
     hat  — 몸의 정수리(이번 프레임 몸 윤곽에서 가장 높은 점). 위가 −y. 살짝 묻히게 아래 끝을 +8 쯤에 둔다
     back — 몸 한가운데. 몸 뒤(눈 구멍 바탕보다 아래)에 깔린다
   hat 의 brim 은 머리에 닿는 챙의 반폭이다 — buddy.js 가 몸 가로가 그만큼 넓어지는 높이까지 모자를
   내려 앉힌다(0 이면 정수리에 꽂힌다). sink 는 원점 아래로 내려오는 깊이(눈을 덮지 않게 잰다), cover 는 가운데에서 위로 덮는
   높이(뾰족한 머리에서 뿔이 남으면 그만큼 모자를 위로 늘린다)
   buddy.js 가 매 프레임 그 자리로 옮기고 몸 폭에 맞춰 키운다 — 모양마다 손으로 맞추지 않는다.
   scale 은 그림 자체를 키우는 배율(꽂는 것을 크게 보이게). 봇 svg 는 overflow:visible 로 그리므로 칸 밖으로
   나가도 잘리지 않지만, 되도록 모자는 정수리 위 100 안, 등 뒤 것은 ±150 안.

   parts 의 rule 은 SVG fill-rule(기본 nonzero — 겹친 꽃잎이 뚫리지 않게). fill 이 'tint' 면 아이템 색을 쓴다. 색은 id 뒤에 ':색' 으로 고른다(crown:rose).
   없으면 tint(기본색). 색 id 는 engine.js COLORS 와 같다 — pass.js 의 ?rt=1 이 맞춰 본다 */
export const COLOURS = ['encre', 'brun', 'rouge', 'orange', 'ambre', 'vert', 'turquoise', 'bleu', 'violet', 'rose', 'gris', 'creme'];

export const ITEMS = [
  /* 지도 핀 — 머리에 꽂힌 그림자, 오른쪽 그늘, 흰 구멍, 윗왼쪽 빛 */
  { id: 'pin', slot: 'hat', tint: 'rouge', brim: 0, sink: 6, scale: 1.3, parts: [
    { d: 'M-15 6A15 4.5 0 1 0 15 6A15 4.5 0 1 0 -15 6Z', fill: 'rgba(0,0,0,.2)' },
    { d: 'M0 6C-16 -10 -27 -24 -27 -41A27 27 0 1 1 27 -41C27 -24 16 -10 0 6Z', fill: 'tint' },
    { d: 'M0 -68A27 27 0 0 1 27 -41C27 -24 16 -10 0 6C9 -12 15 -26 15 -41C15 -55 9 -64 0 -68Z', fill: 'rgba(0,0,0,.18)' },
    { d: 'M0 -52A11 11 0 1 0 0.01 -52Z', fill: '#fff' },
    { d: 'M0 -46A5 5 0 1 0 0.01 -46Z', fill: 'tint' },
    { d: 'M-15 -58A4 4 0 1 0 -14.99 -58Z', fill: 'rgba(255,255,255,.55)' }] },
  /* 새싹 — 흙 한 줌에서 휜 줄기, 잎맥 있는 떡잎 둘, 가운데 움 */
  { id: 'sprout', slot: 'hat', tint: 'vert', brim: 0, sink: 8, scale: 1.35, parts: [
    { d: 'M-14 8C-12 -1 12 -1 14 8Z', fill: '#6b4a2f' },
    { d: 'M-7 2A2 2 0 1 0 -6.99 2ZM6 3A1.6 1.6 0 1 0 6.01 3Z', fill: '#8a6545' },
    { d: 'M-3 6C-4 -10 -2 -26 2 -38L6 -37C3 -25 2 -10 3 6Z', fill: '#2f7d4f' },
    { d: 'M1 -34C-6 -54 -34 -62 -46 -48C-34 -30 -12 -28 1 -34Z', fill: 'tint' },
    { d: 'M3 -38C10 -60 38 -66 48 -52C38 -34 16 -31 3 -38Z', fill: 'tint' },
    { d: 'M1 -34C-12 -38 -26 -42 -46 -48C-34 -36 -14 -32 1 -34ZM3 -38C17 -42 31 -47 48 -52C38 -38 18 -34 3 -38Z', fill: 'rgba(0,0,0,.16)' },
    { d: 'M0 -35C-14 -42 -28 -47 -40 -48C-28 -45 -14 -40 0 -33ZM3 -37C17 -46 31 -51 42 -52C31 -48 17 -42 3 -35Z', fill: 'rgba(0,0,0,.25)' },
    { d: 'M3 -46A6 6 0 1 0 3.01 -46Z', fill: 'tint' },
    { d: 'M3 -46A6 6 0 1 0 3.01 -46Z', fill: 'rgba(255,255,255,.3)' }] },
  { id: 'cap', slot: 'hat', tint: 'rouge', brim: 40, sink: 10, cover: 22, parts: [
    { d: 'M-46 10C-46 -34 46 -34 46 10Z', fill: 'tint' },
    { d: 'M30 2C54 -2 74 2 80 10C66 14 48 13 30 10Z', fill: 'tint' },
    { d: 'M0 -30A5 5 0 1 0 0.01 -30Z', fill: '#0a0a0c' }] },
  { id: 'beanie', slot: 'hat', tint: 'bleu', brim: 44, sink: 14, cover: 25, parts: [
    { d: 'M-50 10C-50 -38 50 -38 50 10Z', fill: 'tint' },
    { d: 'M-54 0H54V14H-54Z', fill: 'tint' },
    { d: 'M-54 0H54V14H-54Z', fill: 'rgba(0,0,0,.22)' },
    { d: 'M0 -46A10 10 0 1 0 0.01 -46Z', fill: '#f1efe9' }] },
  { id: 'flag', slot: 'back', tint: 'rouge', parts: [
    { d: 'M84 40V-140H90V40Z', fill: '#8b5e3c' },
    { d: 'M90 -140L148 -122L90 -104Z', fill: 'tint' }] },
  { id: 'halo', slot: 'hat', tint: 'ambre', brim: 0, sink: 0, parts: [
    { d: 'M-44 -30A44 12 0 1 0 44 -30A44 12 0 1 0 -44 -30ZM-32 -30A32 6 0 1 1 32 -30A32 6 0 1 1 -32 -30Z', fill: 'tint', rule: 'evenodd' }] },
  { id: 'tophat', slot: 'hat', tint: 'encre', brim: 38, sink: 14, cover: 48, parts: [
    { d: 'M-32 6V-48H32V6Z', fill: 'tint' },
    { d: 'M-32 -6H32V4H-32Z', fill: '#e8483f' },
    { d: 'M-50 4H50V14H-50Z', fill: 'tint' }] },
  { id: 'wings', slot: 'back', tint: 'creme', parts: [
    { d: 'M-60 -10C-100 -64 -150 -50 -146 -14C-150 8 -120 34 -66 18Z', fill: 'tint' },
    { d: 'M60 -10C100 -64 150 -50 146 -14C150 8 120 34 66 18Z', fill: 'tint' }] },
  { id: 'flower', slot: 'hat', tint: 'rose', brim: 0, sink: 0, parts: [
    { d: 'M0.0 -51.0A11 11 0 1 0 0.01 -51.0ZM13.3 -41.3A11 11 0 1 0 13.32 -41.3ZM8.2 -25.7A11 11 0 1 0 8.24 -25.7ZM-8.2 -25.7A11 11 0 1 0 -8.22 -25.7ZM-13.3 -41.3A11 11 0 1 0 -13.30 -41.3Z', fill: 'tint' },
    { d: 'M0 -34A8 8 0 1 0 0.01 -34Z', fill: '#f0b429' }] },
  { id: 'crown', slot: 'hat', tint: 'ambre', brim: 30, sink: 8, cover: 40, parts: [
    { d: 'M-40 8L-46 -38L-22 -16L0 -46L22 -16L46 -38L40 8Z', fill: 'tint' },
    { d: 'M0 -10A6 6 0 1 0 0.01 -10Z', fill: '#e8483f' }] },
];
export const ITEM_BY_ID = new Map(ITEMS.map(x => [x.id, x]));
export const SLOTS = ['hat', 'back'];

/* 모양별 손보기. 자동 자리(챙 맞춤)로 모자라는 모양만 적는다 — { 모양: { 아이템 또는 '*': { dy, k } } }.
   dy 는 더 내릴 거리(몸 공간, + 가 아래), k 는 배율 곱. 새 모양·새 모자를 더하면 pass/?rt=1 판을 보고 채운다 */
export const FIT = {};

/* 몸 마감 — 패스에서만 나온다. 몸 색 칸(buddy.js 의 inkRect)을 무늬나 그라데이션으로 바꾼다.
   pat: 한 칸(size)을 깔아 되풀이한다. bg 'ink' 면 고른 몸 색 위에 무늬만 얹는다. rot 는 기울기(도).
   grad: 위→아래(또는 angle 도) 색 띠. eye 는 눈 빛깔을 정하는 대표색이다(buddy.js 의 EYE 가 이 색에서 밝기를 잰다) */
export const FINISHES = [
  { id: 'dots', pat: { size: 22, bg: 'ink', parts: [{ d: 'M11 6A5 5 0 1 0 11.01 6Z', fill: 'rgba(255,255,255,.3)' }] } },
  { id: 'stripes', pat: { size: 20, bg: 'ink', rot: 45, parts: [{ d: 'M0 0H9V20H0Z', fill: 'rgba(255,255,255,.22)' }] } },
  /* 질감 마감 — tools/build_finish_tex.py 가 힉스필드로 뽑은 그림 한 장(fin/<id>.jpg)을 몸 위에 깐다.
     bg 는 그림이 오기 전 바탕색이자 견본 칸의 대신 색이고, 눈은 그 밝기의 반대로 판다.
     eye 는 그림의 대표색이 bg 와 다를 때만 적는다 */
  { id: 'dusk', eye: '#e152b0', img: true, bg: '#c8563a' },
  { id: 'night', eye: '#2b3770', img: true, bg: '#1d2238' },
  { id: 'gold', eye: '#f0c44a', img: true, bg: '#b8861f' },
  { id: 'holo', eye: '#c7b0ff', img: true, bg: '#a9c6ea' },
  { id: 'hanji', img: true, bg: '#e6e0d0' },
  { id: 'giwa', img: true, bg: '#3a3a3c' },
  { id: 'blossom', img: true, bg: '#f3c6d3' },
  { id: 'celadon', img: true, bg: '#2f7a55' },
  { id: 'dancheong', img: true, bg: '#2c7a4b' },
  { id: 'maple', img: true, bg: '#9c2f1e' },
  { id: 'neon', img: true, bg: '#2a1838' },
  { id: 'najeon', img: true, bg: '#151515' },
];
export const FINISH_BY_ID = new Map(FINISHES.map(x => [x.id, x]));
/* 질감 마감 그림의 주소 — ?v= 를 이 모듈에서 물려받는다 */
export const finishImg = f => f.img ? new URL(`fin/${f.id}.jpg` + new URL(import.meta.url).search, import.meta.url).href : null;

/* 구 모양 몸 — tools/build_regions.py 가 실제 경계에서 찍은 반지름 64개. id 는 'gu-<구>' 로 모양 칸에 들어간다
   (buddy.js 의 radiiOf 가 engine 의 SHAPES 다음으로 여기서 찾는다) */
const { REGIONS } = await import(new URL('regions.js' + new URL(import.meta.url).search, import.meta.url).href);
export { REGIONS };
export const REGION_BY_SHAPE = new Map(REGIONS.map(r => [`gu-${r.id}`, r]));

/* 'crown:rose' → { item, colour }. 모르는 아이템·색은 null */
export function parseItem(ref) {
  const [id, c] = String(ref || '').split(':');
  const item = ITEM_BY_ID.get(id);
  if (!item || (c && !COLOURS.includes(c))) return null;
  return { item, colour: c || item.tint };
}
/* 패스 보상 하나를 푼다. 꼴은 셋:
     'crown' · 'crown:rose'  → 씌우는 아이템   { kind: 'item', item, colour }
     'fin:dots'              → 몸 마감         { kind: 'finish', finish }
     'gu-mapo'               → 몸 모양(구)     { kind: 'shape', region } */
export function parseReward(ref) {
  ref = String(ref || '');
  if (ref.startsWith('fin:')) { const finish = FINISH_BY_ID.get(ref.slice(4)); return finish ? { kind: 'finish', finish } : null; }
  if (REGION_BY_SHAPE.has(ref)) return { kind: 'shape', region: REGION_BY_SHAPE.get(ref) };
  const got = parseItem(ref);
  return got ? { kind: 'item', ...got } : null;
}

/* ── 리전 패스 1 · 100레벨 ───────────────────────────────
   큰 보상(BIG)은 손으로 적는다 — 새 아이템, 새 마감, 끝에 서울 전체 모양.
   나머지 레벨에는 서울 25구 모양을 코스 순서(강서구부터 시계 방향)로 고르게 흩고,
   남는 자리는 이미 연 아이템의 새 색을 돌아가며 준다. 같은 것을 두 번 주지 않는다 */
const BIG = { 1: 'pin', 5: 'fin:dots', 10: 'sprout', 12: 'fin:hanji', 15: 'cap', 20: 'fin:stripes', 22: 'fin:giwa',
  25: 'beanie', 30: 'flag', 33: 'fin:blossom', 35: 'fin:dusk', 40: 'halo', 45: 'tophat', 48: 'fin:celadon',
  50: 'fin:night', 55: 'fin:dancheong', 60: 'wings', 65: 'fin:maple', 70: 'flower', 75: 'fin:neon', 80: 'fin:gold',
  85: 'fin:najeon', 90: 'fin:holo', 95: 'crown', 100: 'gu-seoul' };
export const PASS_LEVELS = 100;
export const PASS = (() => {
  const out = [], open = [], used = new Map();
  const gus = REGIONS.filter(r => r.id !== 'seoul').map(r => `gu-${r.id}`);
  const fill = PASS_LEVELS - Object.keys(BIG).length;
  let turn = 0, nth = 0, g = 0;
  for (let lv = 1; lv <= PASS_LEVELS; lv++) {
    const big = BIG[lv];
    if (big) {
      if (ITEM_BY_ID.has(big)) { open.push(big); used.set(big, new Set([ITEM_BY_ID.get(big).tint])); }
      out.push({ level: lv, reward: big, big: true });
      continue;
    }
    /* 채움 칸 nth 번째 — 구 모양이 들어갈 차례인지(25개를 채움 칸 전체에 고르게) */
    const gu = Math.floor((nth + 1) * gus.length / fill) > Math.floor(nth * gus.length / fill);
    nth++;
    let reward = gu ? gus[g++] : null;
    for (let k = 0; k < open.length && !reward; k++) {
      const it = open[(turn + k) % open.length], seen = used.get(it);
      const c = COLOURS.find(x => !seen.has(x));
      if (c) { seen.add(c); reward = it + ':' + c; turn = (turn + k + 1) % open.length; }
    }
    out.push({ level: lv, reward, big: false });
  }
  return out;
})();
