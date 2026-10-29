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
/* 패스 보상 하나를 푼다. 꼴은 넷:
     'crown' · 'crown:rose'  → 씌우는 아이템   { kind: 'item', item, colour }
     'fin:dots'              → 몸 마감         { kind: 'finish', finish }
     'pal:pumpkin-2'         → 사이트 색       { kind: 'palette', palette }
     'gu-mapo'               → 몸 모양(구)     { kind: 'shape', region } */
export function parseReward(ref) {
  ref = String(ref || '');
  if (ref.startsWith('fin:')) { const finish = FINISH_BY_ID.get(ref.slice(4)); return finish ? { kind: 'finish', finish } : null; }
  if (ref.startsWith('pal:')) { const palette = paletteOf(ref.slice(4)); return palette ? { kind: 'palette', palette } : null; }
  if (REGION_BY_SHAPE.has(ref)) return { kind: 'shape', region: REGION_BY_SHAPE.get(ref) };
  const got = parseItem(ref);
  return got ? { kind: 'item', ...got } : null;
}

/* 색 팔레트 — 사이트 색(ranked.js 의 THEME: accent·block·bg·ink)을 통째로 바꾸는 패스 보상. 사람이 색을 직접
   고르는 길은 없다 — 가진 팔레트만 입는다. 갈래(아래 표)는 대비(accent↔#232c31 4.5, block↔흰 글자 3, bg↔ink 4.5)를
   지키게 뽑은 값이다. 고치면 ?rt=1 이 대비를 잰다.
   변주 '<갈래>-<k>'(k 2‥7)는 그 갈래의 강조색에 다른 갈래의 칸색과 바탕·글자 짝을 빌린다. 셋 다 저마다 대비를
   지키므로 섞어도 지킨다. 이름은 갈래 이름 뒤에 로마 숫자(호박 II) */
export const PALETTE_FAMILIES = [
  { id: 'pumpkin', accent: '#f79545', block: '#7c4fb0', bg: '#f2e8de', ink: '#604d39' },
  { id: 'candycorn', accent: '#fac942', block: '#e3581c', bg: '#f6f0da', ink: '#605839' },
  { id: 'witch', accent: '#9ada62', block: '#8e4ab5', bg: '#e9e2ee', ink: '#503960' },
  { id: 'cauldron', accent: '#64d887', block: '#43a383', bg: '#e2eee7', ink: '#396049' },
  { id: 'bat', accent: '#e79e55', block: '#655ca3', bg: '#e5e3ed', ink: '#413d5c' },
  { id: 'ghost', accent: '#7cb5c0', block: '#637e9c', bg: '#e3eaed', ink: '#3d525c' },
  { id: 'harvestmoon', accent: '#f0d04c', block: '#4a5fb5', bg: '#f4f0dd', ink: '#605b39' },
  { id: 'graveyard', accent: '#94bb81', block: '#6b8a94', bg: '#e5ebe5', ink: '#415841' },
  { id: 'raven', accent: '#6ea1cf', block: '#575fa8', bg: '#e3e5ed', ink: '#3d435c' },
  { id: 'spider', accent: '#e76a6a', block: '#7a6b94', bg: '#ebe5e6', ink: '#584145' },
  { id: 'potion', accent: '#d766db', block: '#33a398', bg: '#eee1ef', ink: '#5c3960' },
  { id: 'lantern', accent: '#ffb13d', block: '#cf5530', bg: '#f5ebdb', ink: '#605039' },
  { id: 'bloodmoon', accent: '#f2645a', block: '#c9364e', bg: '#f0e2e0', ink: '#603e39' },
  { id: 'mummy', accent: '#c7ae75', block: '#a1845e', bg: '#f0ece0', ink: '#605539' },
  { id: 'skeleton', accent: '#b0ae8d', block: '#70798f', bg: '#ebebe5', ink: '#565643' },
  { id: 'haunted', accent: '#a385d6', block: '#528fad', bg: '#e6e2ee', ink: '#453960' },
  { id: 'broom', accent: '#d3a269', block: '#b5754a', bg: '#efe9e1', ink: '#605039' },
  { id: 'blackcat', accent: '#d0f04c', block: '#636b9c', bg: '#eceee2', ink: '#596039' },
  { id: 'werewolf', accent: '#cf986e', block: '#5e80a1', bg: '#ede8e3', ink: '#5c4d3d' },
  { id: 'vampire', accent: '#e76a87', block: '#cf3046', bg: '#efe1e5', ink: '#603943' },
  { id: 'zombie', accent: '#aada62', block: '#4ea651', bg: '#e9efe1', ink: '#4e6039' },
  { id: 'fog', accent: '#86a6b6', block: '#668599', bg: '#e5e9eb', ink: '#415158' },
  { id: 'candle', accent: '#f5d247', block: '#c66339', bg: '#f2edde', ink: '#605539' },
  { id: 'owl', accent: '#daa662', block: '#a67d59', bg: '#efeae1', ink: '#605239' },
];
export const PALETTE_VARIANTS = 7;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
/* 'pumpkin' · 'pumpkin-3' → { id, family, n, accent, block, bg, ink }. 모르는 것은 null */
export function paletteOf(id) {
  const [, fam, k] = String(id || '').match(/^([a-z]+)(?:-([2-7]))?$/) || [];
  const i = PALETTE_FAMILIES.findIndex(f => f.id === fam);
  if (i < 0) return null;
  const n = +(k || 1), F = PALETTE_FAMILIES, at = d => F[(i + d * (n - 1)) % F.length];
  return { id, family: fam, n, roman: ROMAN[n], accent: F[i].accent, block: at(5).block, bg: at(7).bg, ink: at(7).ink };
}

/* ── 리전 패스 1 · 할로윈 · 100레벨 ──────────────────────
   큰 보상(BIG)은 손으로 적는다 — 팔레트 갈래 24개, 끝에 서울 전체 모양.
   나머지 레벨에는 서울 25구 모양을 코스 순서(강서구부터 시계 방향)로 고르게 흩고,
   남는 자리는 이미 연 갈래의 변주를 돌아가며 준다. 같은 것을 두 번 주지 않는다.
   맨 앞 팔레트 FREE 개는 누구나 처음부터 가진다(free) — 서버가 레벨을 세기 전엔 그것만 가진 것이다.
   모자·등·마감(ITEMS·FINISHES)은 이번 시즌 보상에서 빠졌다. 그리는 코드는 다음 시즌을 위해 남긴다 */
const BIG = { 1: 'pal:pumpkin', 5: 'pal:candycorn', 10: 'pal:ghost', 12: 'pal:bat', 15: 'pal:broom', 20: 'pal:owl',
  22: 'pal:mummy', 25: 'pal:graveyard', 30: 'pal:spider', 33: 'pal:cauldron', 35: 'pal:candle', 40: 'pal:raven',
  45: 'pal:witch', 48: 'pal:werewolf', 50: 'pal:skeleton', 55: 'pal:zombie', 60: 'pal:haunted', 65: 'pal:fog',
  70: 'pal:potion', 75: 'pal:blackcat', 80: 'pal:lantern', 85: 'pal:harvestmoon', 90: 'pal:vampire', 95: 'pal:bloodmoon',
  100: 'gu-seoul' };
export const PASS_LEVELS = 100, FREE = 2;
/* XP — 끝낸 판마다 game(경쟁전은 ranked), 하루 day 까지. level 만큼 쌓이면 한 레벨.
   ponytail: 서버가 세기 전(PLAN-pass M3)이라 이 기기(rt.pass: { pass, xp, day, today })에 쌓는다. 서버가 오면 그 값을 받는다 */
export const PASS_ID = 'halloween-1';
export const PASS_XP = { game: 20, ranked: 30, level: 100, day: 300 };
export const passLevel = xp => Math.min(PASS_LEVELS, Math.floor((+xp || 0) / PASS_XP.level));
/* rt.pass 한 칸에 판 하나의 XP 를 더한 새 값. 다른 패스의 값이면 0 에서, 날이 바뀌면 하루치를 새로 센다 */
export function gainXp(st, ranked, today) {
  st = st && st.pass === PASS_ID ? st : { pass: PASS_ID, xp: 0 };
  const used = st.day === today ? st.today || 0 : 0;
  const add = Math.max(0, Math.min(ranked ? PASS_XP.ranked : PASS_XP.game, PASS_XP.day - used));
  return { pass: PASS_ID, xp: (st.xp || 0) + add, day: today, today: used + add, add };
}
export const PASS = (() => {
  const out = [], open = [], used = new Map();
  const gus = REGIONS.filter(r => r.id !== 'seoul').map(r => `gu-${r.id}`);
  const fill = PASS_LEVELS - Object.keys(BIG).length;
  let turn = 0, nth = 0, g = 0, free = FREE;
  const push = (lv, reward, big) => {
    const p = { level: lv, reward, big };
    if (reward && reward.startsWith('pal:') && free > 0) { p.free = true; free--; }
    out.push(p);
  };
  for (let lv = 1; lv <= PASS_LEVELS; lv++) {
    const big = BIG[lv];
    if (big) {
      if (big.startsWith('pal:')) { open.push(big.slice(4)); used.set(big.slice(4), 1); }
      push(lv, big, true);
      continue;
    }
    /* 채움 칸 nth 번째 — 구 모양이 들어갈 차례인지(25개를 채움 칸 전체에 고르게) */
    const gu = Math.floor((nth + 1) * gus.length / fill) > Math.floor(nth * gus.length / fill);
    nth++;
    let reward = gu ? gus[g++] : null;
    for (let k = 0; k < open.length && !reward; k++) {
      const fam = open[(turn + k) % open.length], n = used.get(fam) + 1;
      if (n <= PALETTE_VARIANTS) { used.set(fam, n); reward = `pal:${fam}-${n}`; turn = (turn + k + 1) % open.length; }
    }
    push(lv, reward, false);
  }
  return out;
})();
