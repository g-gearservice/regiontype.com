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
/* 이벤트 시즌 모양 몸 — tools/build_season_shapes.py 가 원·다각형으로 지은 실루엣(반지름 64개). id 는 소문자뿐이라
   그대로 모양 칸에 들어간다(중계기 profile() 의 얼굴 칸이 [a-z]{1,16} 만 받는다). buddy.js 의 radiiOf 가 여기서도 찾는다 */
const { SEASON_SHAPES } = await import(new URL('shapes.js' + new URL(import.meta.url).search, import.meta.url).href);
export { SEASON_SHAPES };
export const SEASON_SHAPE_BY_ID = new Map(SEASON_SHAPES.map(x => [x.id, x]));
/* 엔진 기본 모양 가운데 패스에 잠근 것 — 받기 전엔 봇 스타일에 없다(ranked.js). 반지름은 엔진에 있다 */
export const PASS_ENGINE_SHAPES = ['citrouille'];

/* 'crown:rose' → { item, colour }. 모르는 아이템·색은 null */
export function parseItem(ref) {
  const [id, c] = String(ref || '').split(':');
  const item = ITEM_BY_ID.get(id);
  if (!item || (c && !COLOURS.includes(c))) return null;
  return { item, colour: c || item.tint };
}
/* 패스 보상 하나를 푼다. 꼴은 다섯:
     'crown' · 'crown:rose'  → 씌우는 아이템   { kind: 'item', item, colour }
     'fin:dots'              → 몸 마감         { kind: 'finish', finish }
     'pal:pumpkin-2'         → 사이트 색       { kind: 'palette', palette }
     'fantome'               → 이벤트 몸 모양  { kind: 'shape', shape }
     'gu-mapo'               → 구 몸 모양      { kind: 'region', region } */
export function parseReward(ref) {
  ref = String(ref || '');
  if (ref.startsWith('fin:')) { const finish = FINISH_BY_ID.get(ref.slice(4)); return finish ? { kind: 'finish', finish } : null; }
  if (ref.startsWith('pal:')) { const palette = paletteOf(ref.slice(4)); return palette ? { kind: 'palette', palette } : null; }
  if (SEASON_SHAPE_BY_ID.has(ref)) return { kind: 'shape', shape: SEASON_SHAPE_BY_ID.get(ref) };
  if (PASS_ENGINE_SHAPES.includes(ref)) return { kind: 'shape', shape: { id: ref } };
  if (REGION_BY_SHAPE.has(ref)) return { kind: 'region', region: REGION_BY_SHAPE.get(ref) };
  const got = parseItem(ref);
  return got ? { kind: 'item', ...got } : null;
}

/* 색 팔레트 — 사이트 색(ranked.js 의 THEME: accent·block·bg·ink)을 통째로 바꾸는 패스 보상. 사람이 색을 직접
   고르는 길은 없다 — 가진 팔레트만 입는다. 갈래(아래 표)는 대비(accent↔#232c31 4.5, block↔흰 글자 3, bg↔ink 4.5)를
   지키게 뽑은 값이다. 고치면 pass/?rt=1 이 대비를 잰다.
   강조색은 봇의 몸 색이기도 하다(봇은 강조색을 따라간다). 그래서 밝은 갈래의 강조색은 어두운 글자 4.5 를 겨우 넘는
   만큼(≈4.7)까지 색조를 지킨 채 눌러, 밝은 바탕 위에서도 봇이 묻히지 않게(바탕과 ≈2.4) 잡았다.
   dark 갈래는 어두운 바탕에 밝은 글자다 — 입으면 밤 화면이 켜지고 사이트의 밤 바탕 대신 그 바탕을 깐다(ranked.js 의 themeCss).
   변주 '<갈래>-<k>'(k 2‥7)는 그 갈래의 강조색에 같은 시즌 다른 갈래의 칸색과 바탕·글자 짝을 빌린다. 셋 다 저마다
   대비를 지키고 같은 시즌끼리는 밝기(dark)도 같으므로 섞어도 지킨다. 이름은 갈래 이름 뒤에 로마 숫자(호박 II) */
export const PALETTE_FAMILIES = [
  /* 할로윈 — 호박·사탕·마녀·핏빛 */
  { id: 'pumpkin', season: 'halloween', accent: '#d4803b', block: '#7c4fb0', bg: '#f2e8de', ink: '#604d39' },
  { id: 'candycorn', season: 'halloween', accent: '#b3902f', block: '#e3581c', bg: '#f6f0da', ink: '#605839' },
  { id: 'ghost', season: 'halloween', accent: '#6b9da6', block: '#637e9c', bg: '#e3eaed', ink: '#3d525c' },
  { id: 'bat', season: 'halloween', accent: '#c68749', block: '#655ca3', bg: '#e5e3ed', ink: '#413d5c' },
  { id: 'witch', season: 'halloween', accent: '#73a249', block: '#8e4ab5', bg: '#e9e2ee', ink: '#503960' },
  { id: 'cauldron', season: 'halloween', accent: '#4da668', block: '#43a383', bg: '#e2eee7', ink: '#396049' },
  { id: 'potion', season: 'halloween', accent: '#d766db', block: '#33a398', bg: '#eee1ef', ink: '#5c3960' },
  { id: 'blackcat', season: 'halloween', accent: '#899e32', block: '#636b9c', bg: '#eceee2', ink: '#596039' },
  { id: 'vampire', season: 'halloween', accent: '#e76a87', block: '#cf3046', bg: '#efe1e5', ink: '#603943' },
  { id: 'bloodmoon', season: 'halloween', accent: '#f2645a', block: '#c9364e', bg: '#f0e2e0', ink: '#603e39' },
  /* 블랙 프라이데이 — 모두 어두운 스타일. 검정 위 금빛·세일 빨강·네온 */
  { id: 'blackfriday', season: 'blackfriday', dark: true, accent: '#f5ca47', block: '#50505e', bg: '#131316', ink: '#e4e4e7' },
  { id: 'doorbuster', season: 'blackfriday', dark: true, accent: '#fb5c51', block: '#7e3036', bg: '#1a0f10', ink: '#ebe0e1' },
  { id: 'cybermonday', season: 'blackfriday', dark: true, accent: '#42ccfa', block: '#274786', bg: '#0b111e', ink: '#e0e3eb' },
  { id: 'neonsale', season: 'blackfriday', dark: true, accent: '#fa42cc', block: '#623479', bg: '#180d1c', ink: '#e8e0eb' },
  { id: 'goldcard', season: 'blackfriday', dark: true, accent: '#e2b05a', block: '#755c38', bg: '#1b160e', ink: '#ebe7e0' },
  { id: 'midnight', season: 'blackfriday', dark: true, accent: '#9783fc', block: '#343a79', bg: '#0b0d1e', ink: '#e0e1eb' },
  { id: 'onyx', season: 'blackfriday', dark: true, accent: '#90a1ad', block: '#4e585f', bg: '#131516', ink: '#e3e6e8' },
  { id: 'cashback', season: 'blackfriday', dark: true, accent: '#51ec9e', block: '#2b8265', bg: '#0d1c17', ink: '#e0ebe7' },
  /* 크리스마스 — 호랑가시·전나무·눈·사탕지팡이·루돌프 코 */
  { id: 'holly', season: 'christmas', accent: '#52a56d', block: '#c62f3b', bg: '#e2eee2', ink: '#396039' },
  { id: 'pine', season: 'christmas', accent: '#5ca37f', block: '#37a477', bg: '#e3ede7', ink: '#3d5c47' },
  { id: 'snow', season: 'christmas', accent: '#589dbf', block: '#437ab1', bg: '#dfeaf1', ink: '#395060' },
  { id: 'candycane', season: 'christmas', accent: '#f25f77', block: '#d0253c', bg: '#f0e0e3', ink: '#603940' },
  { id: 'gingerbread', season: 'christmas', accent: '#c08953', block: '#be6837', bg: '#f1e9df', ink: '#604e39' },
  { id: 'tinsel', season: 'christmas', accent: '#ae9232', block: '#bc8d2f', bg: '#f2edde', ink: '#605539' },
  { id: 'poinsettia', season: 'christmas', accent: '#ee636e', block: '#ca2b53', bg: '#efe1e1', ink: '#603939' },
  { id: 'frost', season: 'christmas', accent: '#609eab', block: '#5c8599', bg: '#e2ebee', ink: '#395660' },
  { id: 'cocoa', season: 'christmas', accent: '#ba8b69', block: '#ab6a49', bg: '#efe8e1', ink: '#604b39' },
  { id: 'rudolph', season: 'christmas', accent: '#f6624c', block: '#b17143', bg: '#f0e3e0', ink: '#604039' },
];
export const PALETTE_VARIANTS = 7;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
/* 밤 바탕(nightBg) — 밤 화면에서 사이트 밤 바탕(#232c31) 대신 까는 색. 칸색을 밤 먹색(#161b1e)에 20% 섞어 팔레트 기운만 남긴다.
   밤 글자(#e7eef1)와 대비 4.5 를 넘게 어둡다(pass/?rt=1 이 잰다). dark 팔레트는 제 바탕이 곧 밤 바탕이다 */
const hexMix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
/* 'pumpkin' · 'pumpkin-3' → { id, family, n, roman, dark, accent, block, bg, ink, nightBg }. 모르는 것은 null */
export function paletteOf(id) {
  const [, fam, k] = String(id || '').match(/^([a-z]+)(?:-([2-7]))?$/) || [];
  const f = PALETTE_FAMILIES.find(x => x.id === fam);
  if (!f) return null;
  const G = PALETTE_FAMILIES.filter(x => x.season === f.season), i = G.indexOf(f), n = +(k || 1);
  const at = d => G[(i + d * (n - 1)) % G.length];
  const block = at(3).block, bg = at(5).bg;
  return { id, family: fam, n, roman: ROMAN[n], dark: !!f.dark, accent: f.accent, block, bg, ink: at(5).ink, nightBg: f.dark ? bg : hexMix(block, '#161b1e', .2) };
}

/* ── 리전 패스 · 이벤트 시즌 ─────────────────────────────
   시즌마다 패스 하나(50레벨). 날짜가 [from, to) 안이면 그 시즌이 열려 있고, 날이 바뀌면 저절로 다음 시즌으로 넘어간다.
   큰 보상(★)은 그 시즌의 팔레트 갈래와 모양(적은 차례대로)을 번갈아 1레벨부터 50레벨까지 고르게 놓는다 —
   마지막 칸은 shapes 의 마지막(그 시즌의 얼굴: 할로윈 호박(엔진의 citrouille)·왕관·산타).
   나머지 레벨은 이미 연 갈래의 변주를 돌아가며 준다. 같은 것을 두 번 주지 않는다.
   맨 앞 팔레트 FREE 개는 그 시즌을 연 누구나 가진다(free). 받은 것은 시즌이 끝나도 남는다.
   모자·등·마감(ITEMS·FINISHES)과 구 모양은 이벤트 시즌 보상에서 빠졌다. 그리는 코드는 남긴다 */
export const SEASONS = [
  { id: 'halloween-2026', theme: 'halloween', from: '2026-10-01', to: '2026-11-02',
    shapes: ['chauvesouris', 'chat', 'tombe', 'chaudron', 'fantome', 'crane', 'potiron', 'citrouille'] },
  { id: 'blackfriday-2026', theme: 'blackfriday', from: '2026-11-02', to: '2026-12-01',
    shapes: ['etiquette', 'ticket', 'sac', 'bourse', 'diamant', 'couronne'] },
  { id: 'christmas-2026', theme: 'christmas', from: '2026-12-01', to: '2027-01-07',
    shapes: ['cloche', 'chaussette', 'flocon', 'cadeau', 'bonhomme', 'sapin', 'renne', 'perenoel'] },
];
export const SEASON_LEVELS = 50, PASS_LEVELS = SEASONS.length * SEASON_LEVELS, FREE = 2;
/* XP — 끝낸 판마다 game(경쟁전은 ranked), 하루 상한 없음. level 만큼 쌓이면 한 레벨 */
export const PASS_XP = { game: 20, ranked: 30, level: 100 };
export const passLevel = xp => Math.min(PASS_LEVELS, Math.floor((+xp || 0) / PASS_XP.level));
/* 'YYYY-MM-DD'(그 사람의 날) → 열린 시즌. 시즌 사이면 null */
export const seasonAt = day => SEASONS.find(s => s.from <= day && day < s.to) || null;
export const SEASON_BY_ID = new Map(SEASONS.map(s => [s.id, s]));

const tracks = new Map();
/* 시즌 하나의 50칸 — [{ level, reward, big, free }] */
export function trackOf(season) {
  if (tracks.has(season.id)) return tracks.get(season.id);
  const fams = PALETTE_FAMILIES.filter(f => f.season === season.theme).map(f => 'pal:' + f.id);
  const bigs = [];
  for (let i = 0; i < Math.max(fams.length, season.shapes.length); i++) bigs.push(fams[i], season.shapes[i]);
  const order = bigs.filter(Boolean);
  const last = season.shapes[season.shapes.length - 1];
  if (order[order.length - 1] !== last) order.push(order.splice(order.indexOf(last), 1)[0]);
  const at = new Map(order.map((r, k) => [1 + Math.round(k * (SEASON_LEVELS - 1) / (order.length - 1)), r]));
  const out = [], open = [], used = new Map();
  let turn = 0, free = FREE;
  for (let lv = 1; lv <= SEASON_LEVELS; lv++) {
    let reward = at.get(lv) || null;
    const big = !!reward;
    if (reward && reward.startsWith('pal:')) { open.push(reward.slice(4)); used.set(reward.slice(4), 1); }
    for (let k = 0; k < open.length && !reward; k++) {
      const fam = open[(turn + k) % open.length], n = used.get(fam) + 1;
      if (n <= PALETTE_VARIANTS) { used.set(fam, n); reward = `pal:${fam}-${n}`; turn = (turn + k + 1) % open.length; }
    }
    const p = { level: lv, reward, big };
    if (reward && reward.startsWith('pal:') && free > 0) { p.free = true; free--; }
    out.push(p);
  }
  tracks.set(season.id, out);
  return out;
}

/* ── 리전 패스 하나 ─────────────────────────────────────
   세 시즌의 50칸을 날짜 차례로 이어 한 줄 150레벨, XP 도 하나다. 레벨은 언제든 오르지만 칸은 그 시즌이 열린 날부터
   받는다(지난 시즌 칸은 늦게 닿아도 받는다). 하루 상한은 없다(v6.02) — 많이 하면 그만큼 빨리 오른다.
   ponytail: 시즌마다 50칸 고정 — 덜 하는 사람은 크리스마스 줄에 못 닿을 수 있다. 그게 문제면 칸 수를 날짜 길이에 맞춘다 */
export const PASS_ID = 'holiday-2026';
export const PASS = SEASONS.flatMap((s, k) => trackOf(s).map(p => ({ ...p, level: p.level + k * SEASON_LEVELS, season: s })));
export const passOpen = day => !!seasonAt(day);
/* rt.pass → { pass, xp }. v2.2.0 의 할로윈 패스(halloween-1) XP 는 그대로 잇는다 */
export function passStore(raw) {
  const ok = raw && (raw.pass === PASS_ID || raw.pass === 'halloween-1');
  return { pass: PASS_ID, xp: ok ? +raw.xp || 0 : 0 };
}
/* 판 하나의 XP 를 더한 새 rt.pass(add 는 더한 양). 패스가 닫힌 날엔 0 */
export function gainXp(st, ranked, today) {
  const add = passOpen(today) ? (ranked ? PASS_XP.ranked : PASS_XP.game) : 0;
  return { pass: PASS_ID, xp: passStore(st).xp + add, add };
}
/* 칸 하나를 가졌나 — 그 시즌이 열렸고, 무료이거나 내 레벨까지 */
export const passOwns = (p, lv, today) => p.season.from <= today && (!!p.free || p.level <= lv);
/* 가진 보상 [{ ref, got, season }] */
export function ownedRewards(st, today) {
  const lv = passLevel(passStore(st).xp);
  return PASS.filter(p => passOwns(p, lv, today)).map(p => ({ ref: p.reward, got: parseReward(p.reward), season: p.season }));
}
