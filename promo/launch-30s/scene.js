/* regiontype 30초 세로 홍보 영상 — 한 장면 그리기. seek(t) 가 t 초의 한 프레임을 그린다.
   지도는 저장소의 실제 칸 지도(data/*.geom.json), 봇은 실제 봇(assets/bloub/buddy.js)이다.
   봇의 시계는 가짜 시계(VNOW)로 돌린다 — 앞으로만 넘기면 프레임마다 똑같이 그려진다.

   주황 하나가 장면마다 역할을 바꾼다: 입력 커서 → 지도 경계 → 봇 → 패스 진행선 → 로고 점 → 다시 커서. */
import * as T from './timeline.js';

const { W, H } = T;
const ROOT = new URL('../../', import.meta.url).href;

/* ── 가짜 시계 — buddy.js 를 부르기 전에 건다. 0 은 buddy 가 '아직 안 돎'으로 읽어 1초부터 센다 ── */
let VNOW = 1000;
const rafQ = [];
performance.now = () => VNOW;
window.requestAnimationFrame = cb => (rafQ.push(cb), rafQ.length);
window.cancelAnimationFrame = () => {};
const { mountBuddy } = await import(ROOT + 'assets/bloub/buddy.js');

/* ── 색 — style.css 의 값. 호박 팔레트는 items.js 의 pumpkin, 따라 나오는 색은 ranked.js themeCss 와 같은 셈 ── */
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = c => `rgb(${c.map(v => Math.round(v)).join(',')})`;
const derive = (bg, ink) => ({ grid: mixRgb(hex(bg), hex(ink), .08), land: mixRgb(hex(bg), hex(ink), .14),
  inkSoft: mixRgb(hex(ink), hex(bg), .22), card: mixRgb(hex(bg), [255, 255, 255], .55) });
const BASE = { bg: hex('#e8edf0'), ink: hex('#3c464a'), accent: hex('#f0a03c'), block: hex('#6f9a9e'),
  grid: hex('#dae2e7'), land: hex('#d3dde3'), inkSoft: hex('#5b676e'), card: hex('#f4f8f9') };
const PUMP = { bg: hex('#f2e8de'), ink: hex('#604d39'), accent: hex('#d4803b'), block: hex('#7c4fb0'), ...derive('#f2e8de', '#604d39') };
const palAt = k => Object.fromEntries(Object.keys(BASE).map(n => [n, mixRgb(BASE[n], PUMP[n], k)]));
const ON_ACCENT = '#232c31';

/* ── 곡선 ── */
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => cl((t - a) / (b - a));
const io = x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
const out = x => 1 - (1 - x) ** 3;
const out5 = x => 1 - (1 - x) ** 5;
const inn = x => x * x * x;
const back = x => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const lerp = (a, b, t) => a + (b - a) * t;
const bump = x => Math.sin(Math.PI * cl(x));
const FONT = 'system-ui,-apple-system,"Apple SD Gothic Neo","Pretendard",sans-serif';

/* ── 지도 ───────────────────────────────────────────── */
const CELL = 30;
const CH = '0123456789abcdefghijklmnopqrstuvwxyz';
const geom = id => fetch(ROOT + `data/${id}.geom.json`).then(r => r.json());

/* 칸 지도의 바깥 윤곽 — 칸 가장자리를 시계 방향으로 이어 가장 긴 고리를 고르고, 모서리만 남겨 세 번 깎는다(Chaikin) */
function outline(grid) {
  const R = grid.length, C = grid[0].length, inside = (r, c) => r >= 0 && r < R && c >= 0 && c < C && grid[r][c] !== '.';
  const next = new Map(), add = (a, b) => { const k = a.join(); (next.get(k) || next.set(k, []).get(k)).push(b); };
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!inside(r, c)) continue;
    if (!inside(r - 1, c)) add([c, r], [c + 1, r]);
    if (!inside(r, c + 1)) add([c + 1, r], [c + 1, r + 1]);
    if (!inside(r + 1, c)) add([c + 1, r + 1], [c, r + 1]);
    if (!inside(r, c - 1)) add([c, r + 1], [c, r]);
  }
  let best = [];
  for (const [k, list] of next) while (list.length) {
    const pts = [k.split(',').map(Number)];
    let n = list.pop();
    for (let guard = 0; guard < 1e5 && n.join() !== k; guard++) {
      pts.push(n);
      const l = next.get(n.join());
      if (!l || !l.length) break;
      n = l.pop();
    }
    if (pts.length > best.length) best = pts;
  }
  /* 계단을 0.25칸 간격으로 다시 찍고, 앞뒤 한 칸씩 세 번 고르게 편다 — 칸 하나 크기의 굴곡은 남고 계단만 사라진다 */
  let p = [];
  best.forEach((q, i) => {
    const r = best[(i + 1) % best.length];
    for (let k = 0; k < 4; k++) p.push([q[0] + (r[0] - q[0]) * k / 4, q[1] + (r[1] - q[1]) * k / 4]);
  });
  const n = p.length, rad = 4;
  for (let pass = 0; pass < 3; pass++) p = p.map((_, i) => {
    let x = 0, y = 0;
    for (let k = -rad; k <= rad; k++) { const q = p[(i + k + n) % n]; x += q[0]; y += q[1]; }
    return [x / (2 * rad + 1), y / (2 * rad + 1)];
  });
  return p.filter((_, i) => i % 2 === 0);
}

function makeMap(id, g, gx, gy, title = '') {
  const ox = gx * CELL, oy = gy * CELL, k = CELL / g.cell;
  const cells = [];
  g.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') cells.push({ x: ox + (c + .5) * CELL, y: oy + (r + .5) * CELL, it: CH.indexOf(ch), t0: Infinity, tf: Infinity });
  }));
  const items = g.items.map(it => ({ name: it.name, x: ox + it.c[0] * k, y: oy + it.c[1] * k }));
  const loop = outline(g.grid).map(([x, y]) => [ox + x * CELL, oy + y * CELL]);
  return { id, title, ox, oy, w: g.cols * CELL, h: g.rows_n * CELL, cx: ox + g.cols * CELL / 2, cy: oy + g.rows_n * CELL / 2,
    cells, items, loop, labels: new Map() };
}
/* 이름이 그 지도의 몇 번째 칸인지 */
const itemOf = (m, name) => m.items.findIndex(x => x.name === name);
/* 칸이 솟는 때: from 에서 가까운 칸부터 span 초에 걸쳐 */
function rise(m, t0, span, fx, fy) {
  const d = m.cells.map(c => Math.hypot(c.x - fx, c.y - fy)), max = Math.max(...d);
  m.cells.forEach((c, i) => { c.t0 = t0 + d[i] / max * span; });
}
/* 이름 하나를 채우는 때: 그 구역의 칸이 무게중심에서 퍼져 나간다 */
function fillItem(m, idx, t) {
  const it = m.items[idx];
  for (const c of m.cells) if (c.it === idx) c.tf = t + Math.hypot(c.x - it.x, c.y - it.y) / CELL * 0.014;
}

/* ── 선(경로) — 길이로 잘라 그린다 ── */
class Path {
  constructor(pts) {
    this.p = pts; this.s = [0];
    for (let i = 1; i < pts.length; i++) this.s.push(this.s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.L = this.s[this.s.length - 1];
  }
  idx(s) { let lo = 0, hi = this.s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.s[m] <= s) lo = m; else hi = m; } return lo; }
  at(s) {
    s = cl(s, 0, this.L);
    const i = this.idx(s), a = this.p[i], b = this.p[Math.min(i + 1, this.p.length - 1)], d = this.s[Math.min(i + 1, this.s.length - 1)] - this.s[i];
    const u = d ? (s - this.s[i]) / d : 0;
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  }
  slice(a, b) {
    if (b <= a) return [];
    const i = this.idx(a), j = this.idx(b), out = [this.at(a)];
    for (let k = i + 1; k <= j; k++) out.push(this.p[k]);
    out.push(this.at(b));
    return out;
  }
}
const nearest = (loop, x, y) => loop.reduce((bi, p, i) => Math.hypot(p[0] - x, p[1] - y) < Math.hypot(loop[bi][0] - x, loop[bi][1] - y) ? i : bi, 0);
const rotate = (loop, i) => [...loop.slice(i), ...loop.slice(0, i), loop[i]];

/* ── 무대 ───────────────────────────────────────────── */
const stage = document.getElementById('stage');
const under = stage.querySelector('#under').getContext('2d');
const over = stage.querySelector('#over').getContext('2d');
const botHost = stage.querySelector('#bot');
const BOT_BOX = 720, BOT_R = 100 * BOT_BOX / 316;   // 엔진의 몸 반지름 100 ↔ 화면 228px (scale 1)

/* ── 자료 ── */
/* 한 판에 깔리는 지도 — 열마다 위에서 아래로 쌓고, 모두 같은 격자 줄(CELL)에 앉는다.
   서울 열과 도쿄 열은 서울·도쿄를 가로 한 줄(y 0)에 맞추고, 나머지 열은 가운데를 맞춘다 */
const COLS = [
  ['us-capital', 'de-capital', 'jp-admin', 'au-admin'],
  ['gb-capital', 'seoul-gu', 'fr-capital', 'it-capital'],
  ['cn-capital', 'jp-capital', 'es-capital'],
  ['us-admin', 'ca-capital', 'fr-admin'],
];
const TITLES = { 'seoul-gu': '서울', 'jp-capital': '도쿄도', 'fr-capital': '파리' };
const G = Object.fromEntries(await Promise.all([...COLS.flat(), 'gangseo-dong'].map(async id => [id, await geom(id)])));
const placed = {};
{
  const GAP = 4, colW = COLS.map(c => Math.max(...c.map(id => G[id].cols)));
  let x = 0;
  COLS.forEach((col, k) => {
    let y = 0;
    const ys = col.map(id => { const at = y; y += G[id].rows_n + 3; return at; });
    const anchor = col.includes('seoul-gu') ? 'seoul-gu' : col.includes('jp-capital') ? 'jp-capital' : null;
    const dy = anchor ? -(ys[col.indexOf(anchor)] + Math.round(G[anchor].rows_n / 2)) : -Math.round((y - 3) / 2);
    col.forEach((id, i) => { placed[id] = [x + Math.floor((colW[k] - G[id].cols) / 2), ys[i] + dy]; });
    x += colW[k] + GAP;
  });
  const [sx, sy] = placed['seoul-gu'];
  for (const id in placed) placed[id] = [placed[id][0] - sx - 16, placed[id][1] - sy - 13];
}
const WORLD = COLS.flat().map(id => makeMap(id, G[id], ...placed[id], TITLES[id] || ''));
const byId0 = Object.fromEntries(WORLD.map(m => [m.id, m]));
const seoul = byId0['seoul-gu'], tokyo = byId0['jp-capital'], paris = byId0['fr-capital'];
const extras = WORLD.filter(m => ![seoul, tokyo, paris].includes(m));
const gangseo = makeMap('gangseo-dong', G['gangseo-dong'], 150, 150, '강서구');
/* 마지막 장의 지도 조각 — 3열 5줄, 가운데(8번째)는 로마 */
const TILE_IDS = ['seoul-gu', 'jp-capital', 'fr-capital', 'gb-capital', 'us-capital', 'de-capital', 'jp-admin',
  'it-capital', 'cn-capital', 'es-capital', 'fr-admin', 'us-admin', 'ca-capital', 'au-admin', 'gangseo-dong'];
const byId = Object.fromEntries([...WORLD, gangseo].map(m => [m.id, m]));

/* ── 시간표를 지도에 얹는다 ── */
const CAM1 = { x: 0, y: 30, z: 1 };   // 첫 장의 카메라 — 서울이 화면 폭에 들어온다
const toWorld = (sx, sy, c) => [(sx - W / 2) / c.z + c.x, (sy - H / 2) / c.z + c.y];
const toScreen = (wx, wy, c) => [(wx - c.x) * c.z + W / 2, (wy - c.y) * c.z + H / 2];

const WORD1 = { y: 960, size: 220 };   // '서울' — 첫 프레임의 커서 자리이자 마지막 프레임이 돌아오는 자리
over.font = `800 ${WORD1.size}px ${FONT}`;
const seoulW = over.measureText('서울').width;
const caretStart = toWorld(W / 2 + seoulW / 2 + 22, WORD1.y, CAM1);

rise(seoul, 0.55, 0.65, caretStart[0], caretStart[1]);
T.SEOUL_TYPE.forEach(ty => fillItem(seoul, itemOf(seoul, ty.text), ty.confirm));

/* 한 줄 경로: 커서 → 서울 고리 → 도쿄 고리 → 파리 고리. 앞 지도의 마지막 경계가 다음 지도의 첫 경계로 이어진다 */
const sLoop = rotate(seoul.loop, seoul.loop.reduce((bi, p, i) => p[0] > seoul.loop[bi][0] ? i : bi, 0));
const exitS = sLoop[0];
const tLoop = rotate(tokyo.loop, nearest(tokyo.loop, exitS[0], exitS[1]));
const pLoop = rotate(paris.loop, nearest(paris.loop, tLoop[0][0], tLoop[0][1]));
const snake = new Path([caretStart, ...sLoop, ...tLoop, ...pLoop]);
const mark = n => snake.s[n];
const S = { sA: mark(1), sB: mark(sLoop.length), tA: mark(sLoop.length + 1), tB: mark(sLoop.length + tLoop.length) };
S.pA = mark(sLoop.length + tLoop.length + 1); S.pB = snake.L;

rise(tokyo, 8.9, 0.8, tLoop[0][0], tLoop[0][1]);
fillItem(tokyo, itemOf(tokyo, '練馬区'), T.TOKYO_TYPE.confirm);
rise(paris, 11.0, 0.55, pLoop[0][0], pLoop[0][1]);
fillItem(paris, itemOf(paris, '16e Arrondissement'), T.PARIS_TYPE.confirm);
for (const m of extras) {
  const d = Math.hypot(m.cx - seoul.cx, m.cy - seoul.cy);
  rise(m, 12.2 + d / 4000 * 0.9, 0.35, m.cx, m.cy);
}

/* 4장 뒤쪽 — 봇이 연 강서구 */
const CAM4 = { x: gangseo.cx, y: gangseo.cy - 190, z: 0.95 };
const BOT_TOP = { x: W / 2, y: 520, s: .4 };
const botFoot = toWorld(BOT_TOP.x, BOT_TOP.y + BOT_R * BOT_TOP.s + 6, CAM4);
const gLoop = rotate(gangseo.loop, gangseo.loop.reduce((bi, p, i) => p[1] < gangseo.loop[bi][1] ? i : bi, 0));
const snake2 = new Path([botFoot, ...gLoop]);
const S2A = snake2.s[1];
rise(gangseo, 18.2, 0.65, gLoop[0][0], gLoop[0][1]);
T.GANGSEO_FILL.forEach(f => fillItem(gangseo, itemOf(gangseo, f.name), f.t));
const CAM5 = { x: gangseo.cx, y: gangseo.cy + 120, z: 0.78 };

/* ── 카메라 ─────────────────────────────────────────── */
/* 8.4초까지는 지금 치는 구를 부드럽게 따라간다(임계 감쇠 용수철을 미리 돌려 둔다). 그 뒤는 정한 자리 사이를 잇는다 */
function camTarget(t) {
  if (t < 2.3) return CAM1;
  if (t < 6.1) {
    const ty = T.SEOUL_TYPE.find(x => x.confirm >= t) || T.SEOUL_TYPE[T.SEOUL_TYPE.length - 1];
    const it = seoul.items[itemOf(seoul, ty.text)];
    return { x: lerp(seoul.cx, it.x, .3), y: lerp(seoul.cy, it.y, .35) + 40, z: 1.32 };
  }
  return { x: seoul.cx, y: seoul.cy + 20, z: 1.02 };
}
const SPRING = [];
{
  let p = { ...CAM1 }, v = { x: 0, y: 0, z: 0 };
  const dt = 1 / 240, w = 7;
  for (let i = 0; i <= 8.4 * 240; i++) {
    const g = camTarget(i * dt);
    for (const k of ['x', 'y', 'z']) { const a = w * w * (g[k] - p[k]) - 2 * w * v[k]; v[k] += a * dt; p[k] += v[k] * dt; }
    SPRING.push({ ...p });
  }
}
const camMix = (a, b, u) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)) });
const TOKYO_CAM = { x: tokyo.cx, y: tokyo.cy + 30, z: 0.92 };
const PARIS_CAM = { x: paris.cx, y: paris.cy + 40, z: 1.0 };
const WIDE_CAM = (() => {
  const x0 = Math.min(...WORLD.map(m => m.ox)), x1 = Math.max(...WORLD.map(m => m.ox + m.w));
  return { x: (x0 + x1) / 2, y: seoul.cy + 200, z: W / (x1 - x0 + 160) };
})();
const CAM_KEYS = [
  [8.4, SPRING[SPRING.length - 1]], [9.75, TOKYO_CAM], [10.7, TOKYO_CAM], [11.55, PARIS_CAM], [12.15, PARIS_CAM], [13.45, WIDE_CAM],
];
function cam(t) {
  if (t < 8.4) return SPRING[Math.min(SPRING.length - 1, Math.round(t * 240))];
  if (t >= 17.7) return t < 20 ? CAM4 : camMix(CAM4, CAM5, io(seg(t, 20.0, 20.8)));
  if (t >= 13.7) {   // 주황 점으로 파고든다
    const head = snake.at(S.pB);
    const c = camMix(WIDE_CAM, { x: head[0], y: head[1], z: WIDE_CAM.z }, io(seg(t, 13.7, 14.05)));
    return { ...c, z: WIDE_CAM.z * Math.exp(inn(seg(t, 13.95, 14.5)) * 3.2) };
  }
  for (let i = CAM_KEYS.length - 1; i >= 0; i--) {
    const [ta, a] = CAM_KEYS[i];
    if (t < ta) continue;
    const nx = CAM_KEYS[i + 1];
    return nx ? camMix(a, nx[1], io(seg(t, ta, nx[0]))) : a;
  }
  return CAM1;
}

/* ── 봇 ─────────────────────────────────────────────── */
const bot = mountBuddy(botHost, { shape: 'cercle', expression: 'curieux' });
bot.setColour('accent');
bot.start();
const BOT_ACTS = [
  [T.LV4_AT, () => bot.setShape('chauvesouris')],
  [26.2, () => bot.setShape('cercle')],
];
let actsDone = 0;

/* ── 5장의 막대 ── */
const BAR = { x0: 120, x1: 960, y: 1500 };
const BAR_W = BAR.x1 - BAR.x0;
function xpAt(t) {   // 그려지는 XP — 한 판마다 0.18s 에 걸쳐 차오른다
  let xp = 0;
  for (const tk of T.XP_TICKS) xp += T.XP_GAME * out(seg(t, tk - .12, tk + .06));
  return xp;
}
const xpNow = t => T.XP_TICKS.filter(tk => tk <= t).length * T.XP_GAME;
/* 막대의 찬 몫(0‥1) — 패스 화면처럼 레벨 안의 XP(xp % 100). 레벨이 오르는 순간만 0.2s 꽉 찬 채 둔다 */
function barP(t) {
  if (t < 21.15) return lerp(1, .2, io(seg(t, 20.9, 21.15)));   // 펴진 경계선이 막대를 꽉 채웠다가 한 판 몫(20 XP)으로 앉는다
  const xp = xpAt(t), last = T.XP_TICKS.filter(tk => tk <= t).pop() ?? 0;
  if (xpNow(t) % T.XP_LEVEL === 0 && xpNow(t) > 0 && t - last < .2) return 1;
  return (xp % T.XP_LEVEL) / T.XP_LEVEL;
}

/* ── 그리기 도구 ── */
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function caret(g, x, y, h, color, a = 1, w = Math.max(5, h * 0.055)) {
  if (a <= 0) return;
  g.globalAlpha = a; g.fillStyle = color;
  roundRect(g, x - w / 2, y - h / 2, w, h, w / 2); g.fill();
  g.globalAlpha = 1;
}
/* 글자 + 조합 중 밑줄. 왼쪽 끝 x, 세로 가운데 y. 오른쪽 끝을 돌려준다 */
function typeText(g, text, comp, x, y, size, color, weight = 800) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = color;
  g.fillText(text, x, y);
  const w = g.measureText(text).width;
  if (comp && text) {
    const lw = g.measureText(text.slice(-1)).width;
    g.fillRect(x + w - lw, y + size * .52, lw, Math.max(2, size * .045));
  }
  return x + w;
}
function blinkOn(t, idleSince) { return t - idleSince < .1 || Math.floor((t - idleSince) / T.BEAT * 2) % 2 === 0; }

/* 카드 위에 치는 칸(2·3장). 가운데 (x,y). 캐럿 자리를 돌려준다 */
function chip(g, P, s, x, y, a, size = 52) {
  if (a <= 0) return null;
  g.font = `800 ${size}px ${FONT}`;
  const tw = Math.max(g.measureText(s.text).width, size * .4), padX = size * .5, h = size * 1.55, w = tw + padX * 2 + size * .22;
  const left = cl(x - w / 2, 36, W - 36 - w), top = y - h / 2;
  g.save(); g.globalAlpha = a;
  g.shadowColor = 'rgba(58,78,88,.22)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
  g.fillStyle = css(P.card); roundRect(g, left, top, w, h, h * .32); g.fill();
  g.shadowColor = 'transparent';
  const end = typeText(g, s.text, s.comp, left + padX, y + 2, size, css(P.ink));
  g.restore();
  return { x: end + size * .16, y, h: size * 1.02 };
}

function copy(g, P, t, t0, t1, text, y = 262) {
  const a = out(seg(t, t0, t0 + .35)) * (1 - seg(t, t1 - .25, t1));
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.font = `800 66px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.strokeStyle = css(P.bg); g.lineWidth = 18;
  const dy = (1 - out(seg(t, t0, t0 + .45))) * 26;
  g.strokeText(text, W / 2, y + dy); g.fillStyle = css(P.ink); g.fillText(text, W / 2, y + dy);
  g.restore();
}

/* 지도 한 장의 점. 바탕 위에 칸 → 채움 */
function drawMap(g, m, t, c, P, alpha = 1, palWave = null) {
  if (alpha <= 0) return;
  const r0 = CELL * .42 * c.z;
  if (r0 < .4) return;
  const [sx0, sy0] = toScreen(m.ox, m.oy, c), [sx1, sy1] = toScreen(m.ox + m.w, m.oy + m.h, c);
  if (sx1 < -40 || sx0 > W + 40 || sy1 < -40 || sy0 > H + 40) return;
  g.globalAlpha = alpha;
  /* 멀리서 보면 옅은 땅 점이 바탕에 묻힌다 — 물러날수록 먹 쪽으로 눌러 칸이 읽히게 한다(채운 칸과의 구분은 그대로) */
  const farLand = mixRgb(P.land, P.inkSoft, cl((1 - c.z) * .5, 0, .38));
  for (const cell of m.cells) {
    const a = seg(t, cell.t0, cell.t0 + .38);
    if (a <= 0) continue;
    const [x, y] = toScreen(cell.x, cell.y, c);
    if (x < -r0 * 2 || x > W + r0 * 2 || y < -r0 * 2 || y > H + r0 * 2) continue;
    const f = cell.tf < 1e9 ? seg(t, cell.tf, cell.tf + .2) : 0, pop = cell.tf < 1e9 ? 1 + .2 * bump(seg(t, cell.tf, cell.tf + .32)) : 1;
    let land = farLand, block = P.block;
    if (palWave) { const k = palWave(x, y); land = mixRgb(BASE.land, PUMP.land, k); block = mixRgb(BASE.block, PUMP.block, k); }
    g.fillStyle = css(f > 0 ? mixRgb(land, block, out(f)) : land);
    g.beginPath(); g.arc(x, y, r0 * back(a) * pop, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
function drawLine(g, pts, c, color, width, screenSpace = false) {
  if (pts.length < 2) return;
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  pts.forEach((p, i) => { const [x, y] = screenSpace ? p : toScreen(p[0], p[1], c); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
}
function dot(g, x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

function lattice(g, c, P, a = 1) {
  let step = CELL * c.z;
  while (step < 14) step *= 4;
  const k = step / (CELL * c.z);
  g.strokeStyle = css(P.grid); g.lineWidth = 1.5; g.globalAlpha = a * cl(c.z / .6, .35, 1);
  const x0 = ((-c.x * c.z + W / 2) % step + step) % step, y0 = ((-c.y * c.z + H / 2) % step + step) % step;
  g.beginPath();
  for (let x = x0; x < W; x += step) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, H); }
  for (let y = y0; y < H; y += step) { g.moveTo(0, Math.round(y) + .5); g.lineTo(W, Math.round(y) + .5); }
  g.stroke(); g.globalAlpha = 1;
  return k;
}

/* 작은 이름표(채운 구) */
function label(g, text, x, y, size, color, a) {
  if (a <= 0) return;
  g.globalAlpha = a; g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = size * .28; g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y); g.globalAlpha = 1;
}
const shortGu = n => n.length > 2 ? n.replace(/구$/, '') : n;

/* ── 한 프레임 ─────────────────────────────────────────── */
export function seek(t) {
  VNOW = 1000 + t * 1000;
  while (actsDone < BOT_ACTS.length && BOT_ACTS[actsDone][0] <= t) BOT_ACTS[actsDone++][1]();

  /* 팔레트: 23.0 에 막대 머리에서 호박 색이 번져 나가고, 26.0 에 기본으로 돌아온다 */
  const palK = io(seg(t, T.LV1_AT, T.LV1_AT + .55)) * (1 - io(seg(t, 26.0, 26.5)));
  const P = palAt(palK);
  document.documentElement.style.setProperty('--accent', css(P.accent));
  document.documentElement.style.setProperty('--block', css(P.block));
  const ACC = css(P.accent);

  const c = cam(t);
  const g = under, o = over;
  g.setTransform(1, 0, 0, 1, 0, 0); o.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = css(P.bg); g.fillRect(0, 0, W, H);
  o.clearRect(0, 0, W, H);

  const worldA = 1 - seg(t, 14.15, 14.45);
  const g4A = t < 17.5 ? 0 : 1 - seg(t, 26.0, 26.45);
  lattice(g, t < 14.5 ? c : t < 26.5 ? cam(t) : { x: 0, y: 0, z: 1 }, P, t < 14.5 ? 1 : 1);

  /* ── 세계(1‥3장) ── */
  if (t < 14.5) {
    for (const m of WORLD) drawMap(g, m, t, c, P, worldA);
    /* 채운 구의 이름 — 2장, 가까이 볼 때만 */
    const labA = (1 - seg(t, 8.3, 8.6)) * seg(c.z, .9, 1.2);
    for (const ty of T.SEOUL_TYPE) {
      const it = seoul.items[itemOf(seoul, ty.text)], a = seg(t, ty.confirm + .05, ty.confirm + .3) * labA;
      const [x, y] = toScreen(it.x, it.y, c);
      label(g, shortGu(ty.text), x, y, 21 * c.z, css(P.ink), a);
    }
    /* 지도 이름 — 3장 */
    for (const [m, t0] of [[seoul, 8.3], [tokyo, 9.0], [paris, 11.1]]) {
      const a = seg(t, t0, t0 + .35) * (1 - seg(t, 13.3, 13.6));
      if (a <= 0) continue;
      const [x, y] = toScreen(m.ox, m.oy - CELL * .6, c);
      g.globalAlpha = a; g.font = `800 ${Math.max(22, 44 * c.z)}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = css(P.ink); g.fillText(m.title, x + CELL * c.z, y); g.globalAlpha = 1;
    }

    /* 주황 경계선 — 머리·꼬리를 길이로 민다 */
    let head = 0, tail = 0;
    head = lerp(0, S.sB, io(seg(t, .5, 1.25)));
    tail = lerp(0, S.sA, out(seg(t, .62, 1.15)));
    if (t >= 8.45) { head = lerp(S.sB, S.tB, io(seg(t, 8.45, 9.8))); tail = lerp(S.sB - 1, S.tA, io(seg(t, 8.6, 9.65))); tail = Math.max(tail, S.sA); }
    if (t >= 10.7) { head = lerp(S.tB, S.pB, io(seg(t, 10.7, 11.6))); tail = lerp(S.tB - 1, S.pA, io(seg(t, 10.85, 11.5))); }
    if (t >= 8.45 && t < 8.6) tail = S.sA;
    if (t >= 13.25) tail = lerp(S.pA, S.pB, io(seg(t, 13.25, 13.75)));
    const lw = 5 + 5 * cl(c.z);
    g.globalAlpha = worldA;
    if (t >= .5 && t < 13.8) drawLine(g, snake.slice(tail, head), c, ACC, lw);
    /* 머리 점 — 움직일 때 보이고, 13.75 부터는 혼자 남은 '주황 점'이다 */
    const moving = (t > .5 && t < 1.3) || (t > 8.45 && t < 9.85) || (t > 10.7 && t < 11.65);
    if (moving) { const [hx, hy] = toScreen(...snake.at(head), c); dot(g, hx, hy, lw * 1.05, ACC); }
    g.globalAlpha = 1;
    if (t >= 13.7) {
      const [hx, hy] = toScreen(...snake.at(S.pB), c);
      const r = lerp(lw * .9, BOT_R, inn(seg(t, 14.0, 14.5)));
      dot(o, hx, hy, Math.max(r, 7), ACC);
    }
  }

  /* ── 1장: '서울' ── */
  {
    const s = T.typedAt(T.SEOUL_WORD, t);
    const k = io(seg(t, .55, 1.25)), size = lerp(WORD1.size, 120, k), y = lerp(WORD1.y, 430, k);
    const a = 1 - seg(t, 2.55, 2.95);
    if (a > 0) {
      o.globalAlpha = a; o.font = `800 ${size}px ${FONT}`;
      const w = o.measureText(s.text).width;
      o.lineJoin = 'round'; o.strokeStyle = css(P.bg); o.lineWidth = size * .1; o.textBaseline = 'middle'; o.textAlign = 'left';
      if (t > .55) o.strokeText(s.text, W / 2 - w / 2, y);
      typeText(o, s.text, s.comp, W / 2 - w / 2, y, size, css(P.ink));
      o.globalAlpha = 1;
      if (t < .5) caret(o, W / 2 + w / 2 + (s.text ? 22 : 0), WORD1.y, 170, ACC, blinkOn(t, T.SEOUL_WORD.keys[0].t) || t > .04 ? 1 : 0, 10);
    }
  }

  /* ── 1·2장: 구마다 칩 → 확정 → 채움. 커서는 칩에서 칩으로 건너간다 ── */
  if (t >= 1.2 && t < 8.6) {
    const list = T.SEOUL_TYPE;
    let curCaret = null;
    for (let i = 0; i < list.length; i++) {
      const ty = list[i], start = ty.keys[0].t, it = seoul.items[itemOf(seoul, ty.text)];
      const shown = seg(t, start - .08, start) * (1 - seg(t, ty.confirm + .05, ty.confirm + (i < 5 ? .3 : .12)));
      if (shown <= 0) continue;
      const [x, y] = toScreen(it.x, it.y, c);
      const size = i < 5 ? 52 : i < 12 ? 44 : 38;
      const ch = chip(o, P, T.typedAt(ty, t), x, y - 74 * cl(c.z, .8, 1.4), shown, size);
      if (ch && t < ty.confirm) curCaret = ch;
    }
    /* 확정과 다음 첫 키 사이: 커서가 미끄러져 건너간다. 1.25 에는 경계선의 머리에서 출발한다 */
    if (!curCaret) {
      const nextI = list.findIndex(ty => ty.keys[0].t > t);
      const prevI = nextI < 0 ? list.length - 1 : nextI - 1;
      const at = i => { const it = seoul.items[itemOf(seoul, list[i].text)]; const [x, y] = toScreen(it.x, it.y, c); return [x, y - 74 * cl(c.z, .8, 1.4)]; };
      let from, t0;
      if (prevI < 0) { from = toScreen(...snake.at(S.sB), c); t0 = 1.25; } else { from = at(prevI); t0 = list[prevI].confirm; }
      if (nextI >= 0) {
        const to = at(nextI), u = io(seg(t, t0, list[nextI].keys[0].t));
        curCaret = { x: lerp(from[0], to[0], u), y: lerp(from[1], to[1], u), h: 54 };
      } else if (t < 8.45) {   // 다 채웠다 — 커서는 서울의 동쪽 끝(경계선 머리)으로 돌아가 선에 붙는다
        const to = toScreen(...snake.at(S.sB), c), u = io(seg(t, list[prevI].confirm, 8.4));
        curCaret = { x: lerp(from[0], to[0], u), y: lerp(from[1], to[1], u), h: lerp(54, 12, u) };
      }
    }
    if (curCaret) caret(o, curCaret.x, curCaret.y, curCaret.h, ACC);
  }

  /* ── 3장: 도쿄·파리 — 이름 하나 → 칸 하나 ── */
  for (const [ty, m, idx] of [[T.TOKYO_TYPE, tokyo, itemOf(tokyo, '練馬区')], [T.PARIS_TYPE, paris, itemOf(paris, '16e Arrondissement')]]) {
    const start = ty.keys[0].t;
    const a = seg(t, start - .15, start) * (1 - seg(t, ty.confirm + .35, ty.confirm + .6));
    if (a <= 0) continue;
    const it = m.items[idx], [x, y] = toScreen(it.x, it.y, c);
    const ch = chip(o, P, T.typedAt(ty, t), x, y - 80, a, 54);
    if (ch && t < ty.confirm) caret(o, ch.x, ch.y, ch.h, ACC);
  }

  /* ── 4장: 봇 ── */
  let bp = null;
  if (t >= 14.45 && t < 26.2) {
    const u1 = io(seg(t, 14.55, 15.0)), u2 = io(seg(t, 17.75, 18.25));
    bp = { x: W / 2, y: lerp(lerp(H / 2, 790, u1), BOT_TOP.y, u2), s: lerp(lerp(1, .82, u1), BOT_TOP.s, u2) };
    if (t >= 20.0) {   // 막대 머리에 올라탄다
      /* 봇은 막대 끝(다음 레벨)에 앉아 차오르는 머리를 본다. Lv 4 에 박쥐가 되며 한 번 커진다 */
      const s = .36 + .16 * seg(t, T.LV4_AT - .05, T.LV4_AT + .25);
      const ride = { x: BAR.x1 - BOT_R * s * .9, y: BAR.y - 18 - BOT_R * s, s };
      const u = io(seg(t, 20.15, 20.9));
      bp = { x: lerp(bp.x, ride.x, u), y: lerp(bp.y, ride.y, u) - 60 * bump(u), s: lerp(bp.s, ride.s, u) };
      bp.s *= 1 - inn(seg(t, 25.85, 26.15));
    }
  }
  if (bp) {
    botHost.style.opacity = '1';
    botHost.style.transform = `translate(${bp.x - BOT_BOX / 2}px,${bp.y - BOT_BOX / 2}px) scale(${bp.s})`;
  } else botHost.style.opacity = '0';

  /* 말풍선 — 제품처럼 주황 판에 입력 칸 */
  if (t >= 14.85 && t < 18.05) {
    const a = out(seg(t, 14.85, 15.15)) * (1 - seg(t, 17.75, 18.0));
    const bx = 90, bw = W - 180, by = 1150, bh = 250, s = T.typedAt(T.BOT_ASK, t), replied = t >= T.BOT_REPLY_AT;
    o.save(); o.globalAlpha = a;
    o.translate(0, (1 - out(seg(t, 14.85, 15.2))) * 30);
    o.shadowColor = 'rgba(58,78,88,.22)'; o.shadowBlur = 26; o.shadowOffsetY = 12;
    o.fillStyle = ACC; roundRect(o, bx, by, bw, bh, 34); o.fill();
    o.beginPath(); o.moveTo(W / 2 - 28, by + 2); o.lineTo(W / 2, by - 30); o.lineTo(W / 2 + 28, by + 2); o.fill();
    o.shadowColor = 'transparent';
    if (!replied) {
      o.fillStyle = css(P.card); roundRect(o, bx + 34, by + 58, bw - 68, bh - 116, 22); o.fill();
      /* 보낸 말은 답이 올 때까지 그대로 남는다(조금 옅게) — 무엇을 청했는지 읽힌다 */
      const sent = t >= T.BOT_ASK.confirm;
      o.globalAlpha = a * (sent ? .6 : 1);
      const end = typeText(o, s.text, s.comp, bx + 70, by + bh / 2, 50, css(P.ink));
      o.globalAlpha = a;
      if (!sent) caret(o, end + 8, by + bh / 2, 54, ACC, blinkOn(t, T.BOT_ASK.keys[T.BOT_ASK.keys.length - 1].t) ? 1 : 0);
      bot._look = [end + 8, by + bh / 2];
    } else {
      o.font = `800 54px ${FONT}`; o.fillStyle = ON_ACCENT; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.globalAlpha = a * out(seg(t, T.BOT_REPLY_AT, T.BOT_REPLY_AT + .2));
      o.fillText('네, 강서구 시작할게요.', W / 2, by + bh / 2);
    }
    o.restore();
  }
  /* 봇의 눈길: 치는 동안은 커서를, 답한 뒤에는 열리는 지도를, 막대 위에선 앞을 본다 */
  if (bp) {
    let look = null;
    if (t >= 14.9 && t < T.BOT_ASK.confirm) look = bot._look || [W / 2, 1275];
    else if (t >= T.BOT_ASK.confirm && t < T.BOT_REPLY_AT) look = [bp.x + 260, bp.y - 420];
    else if (t >= T.BOT_REPLY_AT + .35 && t < 20.0) look = [W / 2, 1150];
    else if (t >= 20.9 && t < 25.9) look = [BAR.x0 + BAR_W * barP(t), BAR.y];
    if (look) {
      const dx = look[0] - bp.x, dy = look[1] - bp.y, len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / (BOT_BOX * bp.s));
      bot.lookAt(dx / len * k, dy / len * k);
    } else if (bot._looking) bot.lookAway();
    bot._looking = !!look;
  }

  /* 봇이 연 강서구: 봇의 발끝에서 선이 내려와 경계를 두른다 → 칸이 차오른다 */
  if (t >= 17.9 && t < 26.6) {
    const cc = cam(t);
    const pw = t < 20 ? null : (x, y) => io(seg(t, T.LV1_AT + Math.hypot(x - BAR.x0 - BAR_W * .2, y - BAR.y) / 1800 * .6, T.LV1_AT + Math.hypot(x - BAR.x0 - BAR_W * .2, y - BAR.y) / 1800 * .6 + .25)) * (1 - io(seg(t, 26.0, 26.5)));
    drawMap(g, gangseo, t, cc, P, g4A, pw);
    const head = lerp(0, snake2.L, io(seg(t, 18.0, 18.75))), tail = lerp(0, S2A, out(seg(t, 18.2, 18.7)));
    if (t < 20.0) {
      drawLine(g, snake2.slice(tail, head), cc, ACC, 9);
      if (t < 18.8) { const [hx, hy] = toScreen(...snake2.at(head), cc); dot(g, hx, hy, 9.5, ACC); }
      /* 채우는 동 이름이 지나간다 */
      for (const f of T.GANGSEO_FILL) {
        const it = gangseo.items[itemOf(gangseo, f.name)], a = bump(seg(t, f.t - .02, f.t + .35));
        if (a <= 0) continue;
        const [x, y] = toScreen(it.x, it.y, cc);
        label(o, f.name, x, y - 10 * seg(t, f.t, f.t + .35), 26, css(P.ink), a);
      }
    } else if (t < 20.9) {
      /* 경계선이 곧게 펴져 리전 패스 막대가 된다 */
      const loopPath = new Path(gLoop), u = io(seg(t, 20.05, 20.9)), Lt = BAR_W;
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const q = i / 160, [wx, wy] = loopPath.at(q * loopPath.L), [sx, sy] = toScreen(wx, wy, cc);
        pts.push([lerp(sx, BAR.x0 + q * Lt, u), lerp(sy, BAR.y, u)]);
      }
      drawLine(o, pts, null, ACC, lerp(9, 16, u), true);
    }
  }

  /* ── 5장: 리전 패스 막대 ── */
  if (t >= 20.5 && t < 26.6) {
    const a = seg(t, 20.5, 20.9);
    const fold = io(seg(t, 26.0, 26.45));
    const lvl = Math.floor(xpNow(t) / T.XP_LEVEL), p = barP(t);
    o.save();
    if (fold <= 0) {
      o.globalAlpha = a;
      drawLine(o, [[BAR.x0, BAR.y], [BAR.x1, BAR.y]], null, css(P.land), 16, true);
      o.globalAlpha = 1;
      if (t >= 20.9) drawLine(o, [[BAR.x0, BAR.y], [BAR.x0 + Math.max(.5, BAR_W * p), BAR.y]], null, ACC, 16, true);
      o.globalAlpha = a;
      o.font = `800 40px ${FONT}`; o.textBaseline = 'alphabetic'; o.textAlign = 'left'; o.fillStyle = css(P.ink);
      o.fillText('리전 패스', BAR.x0, BAR.y + 78);
      o.textAlign = 'right';
      const lvPop = 1 + .25 * bump(seg(t, T.LV1_AT, T.LV1_AT + .35)) + .25 * bump(seg(t, T.LV4_AT, T.LV4_AT + .35));
      o.save(); o.translate(BAR.x1, BAR.y + 78); o.scale(lvPop, lvPop);
      o.font = `800 56px ${FONT}`; o.fillText(`Lv ${lvl}`, 0, 0); o.restore();
      o.font = `700 32px ${FONT}`; o.fillStyle = css(P.inkSoft); o.textAlign = 'left';
      o.fillText(`다음 레벨까지 ${T.XP_LEVEL - xpNow(t) % T.XP_LEVEL} XP`, BAR.x0, BAR.y + 128);
      /* +20 XP — 앞의 다섯 판만 하나씩 읽힌다 */
      T.XP_TICKS.slice(0, 5).forEach((tk, i) => {
        const u = seg(t, tk, tk + .45);
        if (u <= 0 || u >= 1) return;
        o.globalAlpha = bump(u); o.font = `800 38px ${FONT}`; o.fillStyle = css(P.ink); o.textAlign = 'center';
        o.fillText('+20 XP', Math.min(BAR.x0 + BAR_W * (i + 1) * .2, BAR.x1 - 190), BAR.y - 56 - 40 * out(u));
      });
      o.globalAlpha = 1;
    } else {
      /* 막대가 다시 입력 커서로 접힌다 */
      const cx = lerp(BAR.x0 + BAR_W / 2, W / 2, fold), cy = lerp(BAR.y, 960, fold);
      const half = lerp(BAR_W / 2, 0, out(fold)), vh = lerp(0, 75, io(seg(t, 26.2, 26.5)));
      o.globalAlpha = 1 - seg(t, 26.45, 26.5);
      drawLine(o, [[cx - half, cy], [cx + half, cy]], null, ACC, 16, true);
      o.globalAlpha = 1;
      if (vh > 0) caret(o, W / 2, 960, vh * 2, ACC, 1, 12);
    }
    o.restore();
    /* 보상: 레벨 이름표 */
    for (const [t0, t1, text] of [[T.LV1_AT, 24.25, 'Lv 1  ·  팔레트  ·  호박'], [T.LV4_AT, 25.9, 'Lv 4  ·  모양  ·  박쥐']]) {
      const u = out(seg(t, t0, t0 + .3)) * (1 - seg(t, t1 - .2, t1));
      if (u <= 0) continue;
      o.save(); o.globalAlpha = u; o.font = `800 46px ${FONT}`;
      const tw = o.measureText(text).width, w = tw + 80, h = 92, x = W / 2 - w / 2, y = 1236 + (1 - u) * 20;
      o.shadowColor = 'rgba(58,78,88,.2)'; o.shadowBlur = 20; o.shadowOffsetY = 8;
      o.fillStyle = css(P.card); roundRect(o, x, y, w, h, h / 2); o.fill(); o.shadowColor = 'transparent';
      o.fillStyle = css(P.ink); o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText(text, W / 2, y + h / 2 + 2);
      o.restore();
    }
  }

  /* ── 6장: '로마' → 지도 조각이 격자에 앉고 → 커서가 로고의 점이 된다 ── */
  if (t >= 26.45) {
    const ty = T.ROMA_TYPE, s = T.typedAt(ty, t);
    const wordA = 1 - seg(t, 27.0, 27.25);
    o.font = `800 180px ${FONT}`;
    const w = o.measureText(s.text).width;
    if (wordA > 0) { o.globalAlpha = wordA; typeText(o, s.text, s.comp, W / 2 - w / 2, 960, 180, css(P.ink)); o.globalAlpha = 1; }
    /* 지도 조각: 3열 5줄. 가운데(로마)는 글자 자리에서 피어나고, 나머지는 바깥에서 날아와 격자에 앉는다 */
    const TW = 240, TH = 285;
    const slots = [];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) slots.push([90 + q * 330, 150 + r * 345]);
    const order = TILE_IDS, center = 7;
    const gone = io(seg(t, 27.75, 28.05));
    order.forEach((id, i) => {
      const m = byId[id], [sx, sy] = slots[i];
      const cellT = Math.min(TW / (m.w / CELL), TH / (m.h / CELL)), mw = m.w / CELL * cellT, mh = m.h / CELL * cellT;
      const st = 27.0 + Math.abs(i - center) * .02;
      const u = out5(seg(t, st, st + .4));
      if (u <= 0) return;
      const fromX = i === center ? W / 2 - TW / 2 : sx + (sx - W / 2 + TW / 2) * 1.6, fromY = i === center ? 960 - 80 : sy + (sy - 960) * 1.4;
      const x = lerp(fromX, sx + (TW - mw) / 2, u), y = lerp(fromY, sy + (TH - mh) / 2, u);
      const k = 1 - gone;
      g.globalAlpha = (i === center ? 1 : u) * k;
      for (const cell of m.cells) {
        /* 홈 화면의 지도처럼 칸은 모두 칸색 */
        g.fillStyle = css(P.block);
        const px = x + (cell.x - m.ox) / CELL * cellT, py = y + (cell.y - m.oy) / CELL * cellT;
        g.beginPath(); g.arc(lerp(px, sx + TW / 2, gone), lerp(py, sy + TH / 2, gone), cellT * .42 * (i === center ? back(u) : 1) * k, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    });
    /* 커서 → 점 → 로고의 점 */
    o.font = `800 150px ${FONT}`; o.letterSpacing = '-4.5px';
    const wR = o.measureText('region').width;
    o.font = `400 150px ${FONT}`;
    const wT = o.measureText('type').width;
    o.letterSpacing = '0px';
    const LX = W / 2 - (wR + wT + 42) / 2, LY = 975;
    const DOT = { x: LX + wR + wT + 4.5 + 21, y: LY - 106.5, r: 16.5 };
    const tc = t < 27.0 ? (s.text ? W / 2 + w / 2 + 16 : W / 2) : W / 2 + w / 2 + 16;
    const shrink = io(seg(t, 27.1, 27.45)), fly = io(seg(t, 27.65, 28.0));
    if (t < 27.0) caret(o, tc, 960, 150, ACC, 1, 12);
    else if (t < T.LOOP_AT) {
      const ch = lerp(150, DOT.r * 2, shrink), cw = lerp(12, DOT.r * 2, shrink);
      const x = lerp(tc, DOT.x, fly), y = lerp(960, DOT.y, fly) - 120 * bump(fly);
      caret(o, x, y, ch, ACC, 1, cw);
    }
    /* 로고 · 줄 · 주소 */
    const la = seg(t, 27.95, 28.25) * (1 - seg(t, T.LOOP_AT, T.LOOP_AT + .18));
    if (la > 0) {
      const wipe = out(seg(t, 27.95, 28.3));
      o.save(); o.beginPath(); o.rect(0, 0, LX + (wR + wT + 10) * wipe, H); o.clip();
      o.globalAlpha = la; o.fillStyle = css(P.ink); o.textBaseline = 'alphabetic'; o.textAlign = 'left';
      o.letterSpacing = '-4.5px'; o.font = `800 150px ${FONT}`; o.fillText('region', LX, LY);
      o.font = `400 150px ${FONT}`; o.fillText('type', LX + wR, LY); o.letterSpacing = '0px';
      o.restore();
      const ta = seg(t, 28.25, 28.6) * (1 - seg(t, T.LOOP_AT, T.LOOP_AT + .18));
      o.globalAlpha = ta; o.textAlign = 'center'; o.fillStyle = css(P.ink);
      o.font = `800 64px ${FONT}`; o.fillText('세계를, 손끝으로.', W / 2, LY + 150 + (1 - out(seg(t, 28.25, 28.6))) * 16);
      o.globalAlpha = seg(t, 28.45, 28.8) * (1 - seg(t, T.LOOP_AT, T.LOOP_AT + .18));
      o.font = `600 42px ${FONT}`; o.fillStyle = css(P.inkSoft); o.fillText('regiontype.com', W / 2, LY + 240);
      o.globalAlpha = 1;
    }
    /* 고리: 점이 첫 프레임의 커서로 되돌아간다 */
    if (t >= T.LOOP_AT) {
      const u = io(seg(t, T.LOOP_AT, 30 - 1 / 30));
      caret(o, lerp(DOT.x, W / 2, u), lerp(DOT.y, WORD1.y, u), lerp(DOT.r * 2, 170, u), ACC, 1, lerp(DOT.r * 2, 10, u));
    }
  }

  /* ── 카피 ── */
  copy(o, P, t, 3.2, 7.95, '지명을 치면, 지도가 채워진다.');
  copy(o, P, t, 12.3, 13.85, '수도에서, 세계 곳곳까지.');
  copy(o, P, t, 18.0, 19.95, '봇에게 말하고, 바로 시작.');
  copy(o, P, t, 20.55, 25.95, '칠수록 쌓이는 리전 패스.');

  /* 봇 한 장 — 가짜 시계로 rAF 를 한 바퀴 돌린다 */
  rafQ.splice(0).forEach(cb => cb(VNOW));
}
