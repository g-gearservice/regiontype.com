/* 로그인 로고 옆의 동글이. 그림과 움직임은 옆의 engine.js(bloub, MIT · Jérémy Perret)가 내고,
   여기서는 그 결과(BotFrame)를 SVG 에 옮기고 시계를 돌리는 일만 한다.

   원본은 Vue 컴포넌트로 그리지만 이 저장소에는 프레임워크가 없다(CLAUDE.md).
   대기 상태만 쓰므로 그릴 것은 몸통 하나와 눈 두 개뿐이다 — 궤도 고리와 입자는
   다른 상태에서만 나오고, 여기서는 sample() 이 빈 배열을 준다.

   눈은 몸통 위에 얹은 흰 도형이 아니라 몸통에 뚫은 '구멍'이다(원본과 같다).
   그래야 눈이 가장자리로 갈 때 실루엣에 저절로 잘린다. 구멍 뒤로 페이지가
   비쳐 보이면 안 되므로 같은 모양의 바탕을 한 겹 깔고 그 위를 마스크로 판다. */
/* engine.js 를 '내가 불린 그 판'으로 부른다. 정적 import 는 물음표를 물려받지 못해
   './engine.js' 라는 한 주소로만 남는데, 그 주소엔 ?v= 가 없어 브라우저가 옛 파일을
   그대로 쥔다 — 새 buddy.js(?v= 가 붙어 새로 받은 것)와 옛 engine.js 가 만나면 없는
   이름을 가져오다 모듈째 죽는다. 실제로 그렇게 계정 화면과 카메라가 한꺼번에 멈췄다.
   저장소 규칙("에셋엔 ?v= 를 태운다")이 이 파일 하나만 비켜 가 있던 자리다. */
const { BotEngine, DEMI_VIEWBOX: VB, SHAPE_BY_ID, EXPRESSION_BY_ID, COLOR_BY_ID, SHAPES, EXPRESSIONS, COLORS, genProfile } =
  await import(new URL('engine.js' + new URL(import.meta.url).search, import.meta.url).href);

/* 고를 수 있는 것의 목록. 부르는 쪽이 engine.js 를 따로 부르지 않게 여기서 건넨다 —
   두 번 부르면 판이 갈려(한쪽만 ?v=) 같은 사고가 다시 난다. */
const EYE = 'oklch(from var(--buddy-eye, var(--buddy-ink, var(--block))) clamp(.2, (.62 - l) * 1000, .98) calc(c * .25) h)';
const STEM_D = 'M-15 -72C-13 -96 -22 -114 -31 -124L-17 -133C-3 -120 10 -98 15 -72Q8 -65 0 -69Q-8 -65 -15 -72Z';

const { ITEMS, parseItem, SLOTS, FINISH_BY_ID, finishImg, REGION_BY_SHAPE, FIT } = await import(new URL('items.js' + new URL(import.meta.url).search, import.meta.url).href);

export const TABLES = { shapes: SHAPES, expressions: EXPRESSIONS, colours: COLORS, items: ITEMS };

/* 몸 윤곽(engine 의 bodyPath: M 한 점 + C 세 점씩)에서 곡선 위의 점만 골라 꾸미기의 닻을 낸다.
   back 은 한가운데. hat 은 진짜 모자처럼 앉힌다 — 정수리에서 아래로 내려가며 몸 가로가 챙(brim)만큼
   넓어지는 첫 높이에 얹는다. 둥근 머리는 거의 정수리에, 물방울·삼각형처럼 뾰족한 머리는 뿔이 모자
   속으로 들어갈 만큼 내려앉는다. 다만 눈(floor)을 덮지 않게, 그리고 몸 키의 45% 아래로는 내려가지
   않게 멈춘다. brim 0 은 꼭짓점에 꽂히는 것(핀·새싹)이나 떠 있는 것(후광)이다.
   k 는 몸 폭에 맞춘 배율(지름 200 = 1) — 너무 좁거나 넓은 모양에서 모자가 따로 놀지 않게 묶어 둔다 */
function outline(d) {
  const n = String(d).match(/-?[\d.]+/g)?.map(Number) || [], p = [];
  for (let i = 0; i + 1 < n.length; i += i ? 6 : 2) {
    const j = i ? i + 4 : 0;
    if (n[j] === undefined || n[j + 1] === undefined) break;
    p.push({ x: n[j], y: n[j + 1] });
  }
  return p;
}
/* 높이 y 에서 몸을 가로지르는 [왼, 오]. 없으면 null */
function span(p, y) {
  let a = Infinity, b = -Infinity;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length];
    if ((q.y - y) * (r.y - y) > 0 || q.y === r.y) continue;
    const x = q.x + (r.x - q.x) * (y - q.y) / (r.y - q.y);
    a = Math.min(a, x); b = Math.max(b, x);
  }
  return a < b ? [a, b] : null;
}
export function anchorOf(d, { brim = 0, sink = 0, cover = 0, floor = Infinity } = {}) {
  const p = outline(d);
  if (!p.length) return null;
  let top = p[0], x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of p) {
    if (q.y < top.y) top = q;
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
  }
  const k = Math.min(1.1, Math.max(0.95, (x1 - x0) / 200));
  /* 평평한 머리(육각·둥근네모)는 가장 높은 점이 모서리라 그 줄의 가운데에 꽂는다 */
  const crest = span(p, top.y + 3);
  let hat = { x: crest ? (crest[0] + crest[1]) / 2 : top.x, y: top.y, k, sy: 1 };
  if (brim > 0) {
    /* 늘려서도 못 덮을 만큼은 내려가지 않는다 — 뿔이 모자를 뚫고 나오느니 챙이 몸 밖으로 조금 나오는 게 낫다 */
    const reach = cover ? cover * k * 1.8 - 6 : Infinity;
    const need = brim * k, stop = Math.max(top.y, Math.min(floor - sink * k, top.y + (y1 - y0) * .45, top.y + reach));
    let y = top.y, s = null;
    for (; y < stop; y += 2) if ((s = span(p, y)) && (s[1] - s[0]) / 2 >= need) break;
    y = Math.min(y, stop);
    s = span(p, y) || s;
    /* 뾰족한 머리(물방울)는 앉은 자리 위로 뿔이 남는다 — 모자를 위로 늘려 뿔을 덮는다(cover 는 모자가
       가운데에서 덮는 높이). 1.8 배까지만: 더 늘면 모자가 아니라 고깔이다 */
    const sy = cover ? Math.min(1.8, Math.max(1, (y - top.y + 4) / (cover * k))) : 1;
    hat = { x: s ? (s[0] + s[1]) / 2 : top.x, y, k, sy };
  }
  return { hat, back: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k } };
}
/* 눈 구멍 윗선 — 모자가 이 아래로 내려오면 안 된다. 눈이 없으면(잠·숨김) Infinity */
function eyeTop(eyes) {
  let top = Infinity;
  for (const e of eyes) {
    const [mx, my, r] = e.d.match(/-?[\d.]+/g).map(Number), m = e.matrix.match(/-?[\d.]+/g).map(Number);
    top = Math.min(top, m[5] - (r - my) * Math.abs(m[3]) - 4);
  }
  return top;
}

/* 입체. 엔진이 내는 몸은 평면 윤곽이라 고개를 돌려도 눈만 미끄러진다. 몸을 두께 있는 덩이로 세우고
   눈과 같은 셈(engine 의 eyePoses)으로 시선만큼 돌려 다시 비춘 그림자를 몸으로 쓴다 — 고개를 돌리면
   실루엣이 함께 돈다. 그림자는 덩이를 이루는 조각들의 그림자를 한 path 에 겹쳐 놓은 것이다 —
   같은 방향으로 감긴 하위 경로는 nonzero 로 하나로 합쳐진다(돌림이 90° 를 넘지 않아 방향이 안 뒤집힌다).
   보통 모양은 윤곽을 앞뒤로 줄여 쌓은 덩이, 호박은 세로축을 도는 타원체 마디 LOBES 개다 */
const TURN = .5, TURN_MAX = 30, PUFF = 1, SLICES = [1, .99, .97, .94, .9, .85, .78, .7, .6, .48, .34, .18], LOBES = 8;
const spin3 = (u, v, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [u.map((x, i) => x * c + v[i] * s), v.map((x, i) => x * c - u[i] * s)];
};
function basis(g, k = TURN) {
  const rad = d => d * k * Math.PI / 180;
  let f = [0, 0, 1], right = [1, 0, 0], down = [0, 1, 0];
  [f, right] = spin3(f, right, rad(g.yaw));
  [down, f] = spin3(down, f, rad(g.pitch));
  [right, down] = spin3(right, down, rad(g.roll));
  return (x, y, z) => [0, 1, 2].map(i => right[i] * x + down[i] * y + f[i] * z);
}
/* 몸 한가운데와 반 폭·반 키 — 윤곽의 상자로 잰다 */
function box(p) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of p) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: (x1 - x0) / 2, h: (y1 - y0) / 2 };
}
const ring = (c, pts) => 'M' + pts.map(([x, y]) => (c.x + x).toFixed(1) + ' ' + (c.y + y).toFixed(1)).join('L') + 'Z';
/* 덩이 — 윤곽을 앞뒤로 줄여 가며 겹쳐 쌓는다. 가장자리는 두께 0, 한가운데는 앞뒤로 반지름 × PUFF.
   PUFF 1 이라야 원이 공이 된다(그보다 얇으면 돌릴 때 바둑돌처럼 납작하다) */
function pillow(p, c, rot) {
  const t = Math.min(c.w, c.h) * PUFF;
  let d = '';
  for (const s of SLICES) {
    const z = t * Math.sqrt(1 - s * s);
    for (const zz of z ? [z, -z] : [0]) d += ring(c, p.map(q => rot((q.x - c.x) * s, (q.y - c.y) * s, zz)));
  }
  return d;
}
/* 타원체(가운데 o, 세 반축 a·b·e)의 그림자는 타원이다 — 반축을 비춘 2×3 행렬 M 의 M·Mᵀ 를 풀어 낸다 */
function blob(c, rot, o, axes) {
  const [cx, cy] = rot(...o), m = axes.map(v => rot(...v));
  let a = 0, b = 0, d = 0;
  for (const [x, y] of m) { a += x * x; b += x * y; d += y * y; }
  const h = (a + d) / 2, q = Math.sqrt(((a - d) / 2) ** 2 + b * b), th = Math.atan2(2 * b, a - d) / 2;
  const r1 = Math.sqrt(h + q), r2 = Math.sqrt(Math.max(0, h - q)), ct = Math.cos(th), st = Math.sin(th), pts = [];
  for (let i = 0; i < 40; i++) {
    const u = i / 40 * Math.PI * 2, x = r1 * Math.cos(u), y = r2 * Math.sin(u);
    pts.push([cx + x * ct - y * st, cy + x * st + y * ct]);
  }
  return ring(c, pts);
}
/* 호박 — 가운데 심 하나와 그 둘레의 마디들. 마디끼리 겹치는 자리가 골이 되어 가장자리에 물결로 선다 */
function gourd(c, rot) {
  const W = c.w, H = c.h;
  let d = blob(c, rot, [0, 0, 0], [[W * .7, 0, 0], [0, H * .96, 0], [0, 0, W * .7]]);
  for (let i = 0; i < LOBES; i++) {
    const ph = (i + .5) / LOBES * Math.PI * 2, sx = Math.sin(ph), sz = Math.cos(ph), R = W * .5;
    d += blob(c, rot, [R * sx, 0, R * sz], [[W * .5 * sx, 0, W * .5 * sz], [0, H, 0], [W * .3 * sz, 0, -W * .3 * sx]]);
  }
  return d;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/* calm  — 움직임을 줄인 사람. 시계도 시선도 멈춘다(사람의 뜻이다).
   still — 시계만 안 돈다. 견본처럼 여럿 띄우는 놈이 제 숨을 쉬느라 프레임을 먹지
           않게 하는 것뿐이라, 시선은 부르는 쪽이 한 바퀴에 한 장씩 그려 따라본다. */
export function mountBuddy(host, { calm = () => false, still = false, shape = null, expression = null, gen = null, wear = null } = {}) {
  const uid = 'buddy-' + Math.random().toString(36).slice(2, 8);
  const svg = el('svg', { viewBox: `${-VB} ${-VB} ${VB * 2} ${VB * 2}`, 'aria-hidden': 'true' });
  svg.classList.add('buddy');

  const mask = el('mask', { id: uid, maskUnits: 'userSpaceOnUse', x: -VB, y: -VB, width: VB * 2, height: VB * 2 });
  const maskBody = el('path', { fill: '#fff' });
  mask.append(maskBody);
  const defs = el('defs');
  defs.append(mask);

  /* 눈은 몸통에 뚫은 구멍이다. 구멍 뒤로 페이지가 비치면 안 되므로 같은 모양의
     바탕(--buddy-paper)을 깔고, 그 위를 마스크로 판 몸통(--buddy-ink)을 올린다 */
  /* 몸 윤곽은 id 로 밖에서 <use> 할 수 있다 — 경쟁전 봇의 말풍선이 겹치는 곳에 테두리를
     그릴 때 쓴다(ranked.js). <use> 는 매 프레임 바뀌는 모양을 저절로 따라간다 */
  /* 눈 빛깔은 몸 빛깔에서 딴다 — OKLCH 밝기 .62 를 넘으면 짙은 눈, 아니면 흰 눈이다.
     고를 수 있는 열두 색과 브랜드 주황·경쟁전 빨강에서 흰 글자와 짙은 글자의 대비가
     뒤집히는 자리가 거기다(#e8483f .63 은 짙게, #8b5cf6 .61 은 희게). 몸 빛깔을 조금
     남겨 눈이 몸과 한 벌로 보이게 한다. --buddy-paper 를 주면 그걸 쓴다(말풍선 테두리) */
  const paper = el('path', { id: uid + '-body', fill: `var(--buddy-paper, ${EYE})` });
  const inkRect = el('rect', { x: -VB, y: -VB, width: VB * 2, height: VB * 2, fill: 'var(--buddy-ink, var(--block))' });
  const inked = el('g', { mask: `url(#${uid})` });
  inked.append(inkRect);
  const stem = el('path', { class: 'buddy-stem', d: STEM_D, fill: '#424245' });
  const body = el('g');
  /* 꾸미기 슬롯. back 은 몸 바탕보다 아래, hat 은 몸 위에 얹힌다. 자리는 draw() 가 매 프레임 옮긴다 */
  const slot = Object.fromEntries(SLOTS.map(k => [k, el('g', { class: 'buddy-' + k })]));
  body.append(slot.back, paper, inked, stem, slot.hat);
  svg.append(defs, body);
  host.append(svg);

  const eyes = [];
  /* 모양·표정은 id 로 받고 엔진이 쓰는 값으로 여기서 바꾼다 — 부르는 쪽이
     엔진 내부 표를 알 필요가 없다. 모르는 id 는 null(기본 모습)로 떨어진다.
     생성 모양(gen)이 함께 오면 그 레시피로 64개 반지름을 빚어 넣는다 */
  const hasStem = (id, g) => id === 'citrouille' || !!(g && g.stem);
  /* 구 모양(gu-*)은 실제 경계에서 찍은 반지름이라 생성 모양과 같은 길(genProfile)로 넣는다 */
  const radiiOf = (id, g) => (id === 'gen' && g ? genProfile(g) : null) ?? SHAPE_BY_ID.get(id)?.radii ??
    (REGION_BY_SHAPE.has(id) ? genProfile({ radii: REGION_BY_SHAPE.get(id).radii }) : null) ?? (g ? genProfile(g) : null);
  const exprOf = id => EXPRESSION_BY_ID.get(id) ?? null;
  /* 호박 꼭지는 모자를 쓰면 숨는다 — 모자 밑으로 삐져나온다 */
  let stemOf = hasStem(shape, gen);
  const paintStem = () => { stem.style.display = stemOf && !worn.hat ? '' : 'none'; };
  const engine = new BotEngine(100, 'idle', radiiOf(shape, gen), exprOf(expression));
  let raf = 0, t0 = 0;
  /* 잠들기(doze). 엔진의 졸린 눈(somnolent)과 같은 수 — 눈꺼풀은 깜빡임처럼 open 으로
     내리고, 시선은 아래로 떨군다. 한 번에 감으면 0.45s 모프라 툭 떨어진다. 그래서
     꾸벅꾸벅 세 번에 나눠 감는다: 살짝 졸고(1.4s) → 더 졸고(1.4s) → 감는다.
     좌우로 틀지 않아야 감은 눈이 몸 한가운데에 선다 */
  const somnolent = EXPRESSION_BY_ID.get('somnolent');
  const lids = open => somnolent.eyes.map(e => ({ ...e, open }));
  const NODS = [
    [0, { ...somnolent, gaze: { yaw: 0, pitch: -5, roll: 0 }, eyes: lids(0.62) }],
    [1400, { ...somnolent, gaze: { yaw: 0, pitch: -9, roll: 0 }, eyes: lids(0.42) }],
    [2800, { ...somnolent, gaze: { yaw: 0, pitch: -16, roll: 0 }, eyes: lids(0.3) }],
  ];
  let awake = null, dozing = false, nods = [];

  /* 엔진의 표정 모프는 0.45s easeOutQuint 라 첫 프레임에 20% 가까이 뛴다 — 깨어 있을
     때 표정을 바꾸기엔 좋지만 스르르 잠드는 데선 툭 끊겨 보인다. 잠들고 깨는 동안은
     표정과 시선을 여기서 매 프레임 느리게 들어가 느리게 멈추는 곡선으로 잇는다 */
  const mix = (a, b, t) => a + (b - a) * t;
  const blend = (a, b, t) => ({
    id: b.id,
    gaze: { yaw: mix(a.gaze.yaw, b.gaze.yaw, t), pitch: mix(a.gaze.pitch, b.gaze.pitch, t), roll: mix(a.gaze.roll, b.gaze.roll, t) },
    split: mix(a.split, b.split, t),
    eyes: a.eyes.map((e, i) => {
      const f = b.eyes[i];
      return { w: mix(e.w, f.w, t), h: mix(e.h, f.h, t), tilt: mix(e.tilt ?? 0, f.tilt ?? 0, t), open: mix(e.open ?? 1, f.open ?? 1, t) };
    }),
  });
  const REST_LOOK = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 };
  const lerpLook = (a, b, t) => ({ yaw: mix(a.yaw, b.yaw, t), pitch: mix(a.pitch, b.pitch, t), mix: mix(a.mix, b.mix, t), spin: mix(a.spin, b.spin, t), wander: mix(a.wander, b.wander, t) });
  let glide = null;
  function glideTo(to, now, secs, look) {
    glide = { ex: [engine.exprAtTime(now), to], lk: look ? [engine.lookAtTime(now), REST_LOOK] : null, at: now, secs };
  }
  function glideAt(now) {
    if (!glide) return;
    const k = Math.min(1, Math.max(0, (now - glide.at) / glide.secs)), e = ease(k);
    engine.expr = blend(glide.ex[0], glide.ex[1], e);
    engine.exprPrev = null;
    if (glide.lk) engine.setLook(lerpLook(glide.lk[0], glide.lk[1], e), now, 1e-6);
    if (k >= 1) { engine.expr = glide.ex[1]; glide = null; }
  }

  /* 감은 눈 ‿. 엔진의 눈 구멍을 매 프레임 ‿ 쪽으로 녹여 낸다 — 따로 그린 ‿ 를
     바꿔 끼우면 두 그림이 갈리는 자리에서 툭 끊긴다. 눈 구멍(캡슐)과 ‿ 를 같은 수의
     점으로 늘어놓고(윗변 왼→오, 아랫변 오→왼) 점마다 잇는다. ‿ 는 엔진 눈의 지금
     한가운데에 서므로, 엔진이 시선을 떨구는 움직임도 끝까지 탄다.
     단위는 엔진 좌표(몸 반지름 100 ≈ 25px)다. 눈꺼풀 두께 12 ≈ 3px */
  const ARC_W = 13, ARC_SAG = 12, ARC_T = 6, EDGE = 16;
  let shutFrom = 0, shutTo = 0, shutAt = 0, shutFor = 1;
  const ease = k => k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
  const shutAtTime = now => shutFrom + (shutTo - shutFrom) * ease(Math.min(1, Math.max(0, (now - shutAt) / shutFor)));
  const shut = (to, now, secs) => { shutFrom = shutAtTime(now); shutTo = to; shutAt = now; shutFor = secs; };
  function melt(eye, p) {
    const [mx, my, r] = eye.d.match(/-?[\d.]+/g).map(Number);
    const hw = -mx, hh = r - my;
    const [a, b, c, d, e, f] = eye.matrix.match(/-?[\d.]+/g).map(Number);
    const pts = [];
    for (const side of [-1, 1]) {
      for (let j = 0; j <= EDGE; j++) {
        const u = -Math.cos((side < 0 ? j : EDGE - j) / EDGE * Math.PI);   // -1..1, 끝으로 갈수록 촘촘히
        const lx = u * hw, over = Math.max(0, Math.abs(lx) - (hw - r));
        const ly = side * (hh - r + Math.sqrt(Math.max(0, r * r - over * over)));
        const ex = a * lx + c * ly + e, ey = b * lx + d * ly + f;
        const bow = Math.sqrt(1 - u * u);
        const ax = e + u * ARC_W, ay = f + ARC_SAG * (bow * bow - .5) + side * ARC_T * bow;
        pts.push((ex + (ax - ex) * p).toFixed(2) + ' ' + (ey + (ay - ey) * p).toFixed(2));
      }
    }
    return 'M' + pts.join('L') + 'Z';
  }

  /* 슬롯마다 아이템 하나. tint 칸은 고른 색(없으면 아이템 기본색)으로 칠한다 */
  const worn = {};
  let shapeId = shape;
  function dress(w) {
    for (const k of SLOTS) {
      const g = slot[k], got = parseItem(w?.[k]);
      g.replaceChildren();
      worn[k] = got && got.item.slot === k ? got.item : null;
      if (!worn[k]) continue;
      const tint = COLOR_BY_ID.get(got.colour)?.hex || '#a3a3a3';
      for (const p of got.item.parts) g.append(el('path', { d: p.d, fill: p.fill === 'tint' ? tint : p.fill, 'fill-rule': p.rule || 'nonzero' }));
    }
  }
  /* 몸 마감(fin). 몸 색 칸(inkRect)을 무늬·그라데이션으로 바꾼다. 마감을 벗으면 고른 색으로 돌아온다 */
  let ink = 'var(--buddy-ink, var(--block))', finish = null;
  function paintInk() {
    defs.querySelector('.buddy-fin')?.remove();
    const f = FINISH_BY_ID.get(finish);
    svg.style.removeProperty('--buddy-eye');
    if (!f) { inkRect.setAttribute('fill', ink); return; }
    const id = uid + '-fin';
    let paint;
    if (f.grad) {
      const a = (f.grad.angle ?? 90) * Math.PI / 180;
      paint = el('linearGradient', { id, x1: .5 - Math.cos(a) / 2, y1: .5 - Math.sin(a) / 2, x2: .5 + Math.cos(a) / 2, y2: .5 + Math.sin(a) / 2 });
      f.grad.stops.forEach((c, i, all) => paint.append(el('stop', { offset: i / (all.length - 1), 'stop-color': c })));
    } else if (f.img) {
      /* 그림 한 장을 보기 칸 전체에 깐다 — 몸이 숨쉬고 바뀌어도 그림은 제자리다 */
      paint = el('pattern', { id, patternUnits: 'userSpaceOnUse', x: -VB, y: -VB, width: VB * 2, height: VB * 2 });
      paint.append(el('rect', { width: VB * 2, height: VB * 2, fill: f.bg }),
        el('image', { href: finishImg(f), width: VB * 2, height: VB * 2, preserveAspectRatio: 'xMidYMid slice' }));
    } else {
      const { size, bg, rot, parts } = f.pat;
      paint = el('pattern', { id, patternUnits: 'userSpaceOnUse', width: size, height: size, ...(rot ? { patternTransform: `rotate(${rot})` } : {}) });
      const back = el('rect', { width: size, height: size });
      back.style.fill = bg === 'ink' ? ink : bg;
      paint.append(back, ...parts.map(q => el('path', { d: q.d, fill: q.fill })));
    }
    paint.classList.add('buddy-fin');
    defs.append(paint);
    inkRect.setAttribute('fill', `url(#${id})`);
    /* 눈 빛깔은 --buddy-ink 에서 딴다 — 그라데이션은 대표색으로 대신 잰다 */
    if (f.eye || f.bg) svg.style.setProperty('--buddy-eye', f.eye || f.bg);
  }
  dress(wear);
  paintStem();
  finish = wear?.finish ? String(wear.finish).replace(/^fin:/, '') : null;
  if (finish) paintInk();

  function draw(now) {
    glideAt(now);
    const f = engine.sample(now);
    /* 몸은 표정이 원래 보는 쪽(poseGaze)에서 벗어난 만큼만 돈다 — 가만히 있을 땐 똑바로 서 있고,
       눈은 그 표정의 자리(오른쪽 위로 비낀 시선)에 박혀 있다가 몸과 함께 돈다 */
    const g0 = f.poseGaze || { yaw: 0, pitch: 0, roll: 0 }, g = f.gaze || g0;
    const flat = outline(f.bodyPath), c = box(flat);
    /* 반대쪽 구석을 보면 벗어남이 70° 가까이 된다 — 그만큼 돌리면 눈 자리가 몸 가장자리로 넘어간다.
       절반만, TURN_MAX 까지만 돈다 */
    const off = k => Math.max(-TURN_MAX, Math.min(TURN_MAX, (g[k] - g0[k]) * TURN));
    /* 고개 기울기(roll)는 쓰지 않는다 — 눈 줄이 비스듬해진다 */
    const rot = basis({ yaw: off('yaw'), pitch: off('pitch'), roll: 0 }, 1), face = basis({ ...g0, roll: 0 }, 1);
    const solid = stemOf ? gourd(c, rot) : pillow(flat, c, rot);
    /* 눈은 몸에 박혀 있다 — 얼굴 위 제자리(시선 0 의 자리)를 덩이 앞면에 얹고 몸과 같은 돌림으로 옮긴다.
       눈 모양(기울기·줄어듦)은 엔진의 것을 그대로 두고 자리만 바꾼다 */
    const t = stemOf ? c.w : Math.min(c.w, c.h) * PUFF, rr = Math.min(c.w, c.h);
    for (const eye of f.eyes) {
      if (!eye.home) continue;
      const x = eye.home.x - c.x, y = eye.home.y - c.y, k = Math.min(1, Math.hypot(x, y) / rr);
      const [px, py] = rot(...face(x, y, t * Math.sqrt(1 - k * k)));
      /* 눈은 늘 표정 그대로의 크기로 곧게 선 캡슐이다. 엔진은 공 위에 비춘 눈을 기울이고 짓눌러 주는데,
         그건 버리고 눈꺼풀(깜빡임·졸린 눈)만큼만 세로로 줄인다 */
      eye.matrix = `matrix(1,0,0,${(eye.lid ?? 1).toFixed(3)},${(c.x + px).toFixed(2)},${(c.y + py).toFixed(2)})`;
    }
    maskBody.setAttribute('d', solid);
    paper.setAttribute('d', solid);
    /* 꼭지는 돌린 공의 꼭대기(극)에 꽂고 그 축만큼 기운다 */
    if (stemOf) {
      const [px, py] = rot(0, -c.h, 0), lean = Math.atan2(px, -py) * 180 / Math.PI;
      stem.setAttribute('transform', `translate(${(c.x + px).toFixed(1)} ${(c.y + py).toFixed(1)}) rotate(${lean.toFixed(1)}) translate(${-c.x.toFixed(1)} ${(c.h - c.y).toFixed(1)})`);
    }
    if (worn.hat || worn.back) {
      const a = anchorOf(f.bodyPath, { brim: worn.hat?.brim, sink: worn.hat?.sink, cover: worn.hat?.cover, floor: eyeTop(f.eyes) });
      /* 모양별 손보기(items.js 의 FIT) — 자동 자리에서 dy 만큼 내리고 k 배 키운다 */
      const fit = FIT[shapeId]?.[worn.hat?.id] ?? FIT[shapeId]?.['*'] ?? null;
      if (a && fit) a.hat = { ...a.hat, y: a.hat.y + (fit.dy || 0), k: a.hat.k * (fit.k || 1) };
      /* 꽂는 것(핀·새싹)은 그림 자체를 키운다 — items.js 의 scale */
      if (a && worn.hat?.scale) a.hat = { ...a.hat, k: a.hat.k * worn.hat.scale };
      if (a) for (const k of SLOTS) if (worn[k])
        slot[k].setAttribute('transform', `translate(${a[k].x.toFixed(1)} ${a[k].y.toFixed(1)}) scale(${a[k].k.toFixed(3)} ${(a[k].k * (a[k].sy || 1)).toFixed(3)})`);
    }
    body.setAttribute('opacity', f.bodyAlpha);
    const p = shutAtTime(now);
    f.eyes.forEach((eye, i) => {
      let node = eyes[i];
      if (!node) { node = eyes[i] = el('path', { fill: '#000' }); mask.append(node); }
      if (p > 0.001) {
        node.setAttribute('d', melt(eye, p));
        node.removeAttribute('transform');
      } else {
        node.setAttribute('d', eye.d);
        node.setAttribute('transform', eye.matrix);
      }
      node.setAttribute('opacity', eye.alpha);
    });
  }

  const tick = () => {
    draw(clock());
    raf = requestAnimationFrame(tick);
  };

  /* 시계가 안 도는(모션을 줄인) 화면에서도 바뀐 모습이 보여야 한다 — 상태를 바꾼 뒤
     모프가 끝난 시각을 한 장 그려 둔다. setState 가 하던 일과 같은 수다. */
  /* 이 놈의 시계. 아직 안 돌았으면 지금을 0 으로 잡는다 */
  const clock = () => {
    if (!t0) t0 = performance.now();
    return (performance.now() - t0) / 1000;
  };
  /* 모양·표정처럼 모프가 붙는 변화. 시계가 도는 놈도 첫 장을 바로 그려 두고,
     시계가 안 도는 놈은 모프가 끝난 뒤(now + 1)를 한 장 그린다 */
  function at(change) {
    const now = clock();
    change(now);
    draw(raf ? now : now + 1);
  }

  /* 시계가 안 도는 놈도 시선은 따라본다 — 부르는 쪽 rAF 한 바퀴에 한 장씩.
     지금 시각으로 그려야 LOOK_MORPH 가 살아 눈이 미끄러지듯 따라간다 */
  const paintNow = () => { if (!raf) draw(clock()); };

  return {
    node: svg,
    bodyId: uid + '-body',
    start() {
      if (raf) return;
      /* 모션을 줄였으면 시계를 돌리지 않고 한 장만 그린다 — 깜빡임도 시선도 멈춘다.
         시각 0 이 아니라 지금 시계로 그린다: 0 은 상태를 바꾸기 전이라, 자라고
         해 둔 놈이 start() 한 번에 도로 옛 모습으로 돌아온다 */
      if (calm() || still) { draw(clock() + 1); return; }
      raf = requestAnimationFrame(tick);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; t0 = 0; },
    /* 커서를 따라본다. yaw·pitch 는 절대 방향(도)이고, mix 는 바깥이 방향을
       얼마나 쥐는지다. 원본이 그렇듯 섞는 일은 엔진이 한다 */
    lookAt(dx, dy) {
      if (calm() || dozing) return;
      /* dx·dy 는 화면 좌표다 — 오른쪽이 +, 아래가 +. 엔진의 pitch 는 위가 + 라
         여기서 한 번 뒤집는다. 부르는 쪽마다 음수를 붙이게 두면 한 곳은 꼭 빠뜨린다
         (실제로 계정 화면이 위아래 거꾸로 봤다). */
      engine.setLook(
        { yaw: 40 * dx, pitch: -34 * dy, mix: 1, wander: 0.25, spin: 0 },
        clock()
      );
      paintNow();
    },
    /* 화면의 한 점을 본다. 제 몸 한가운데에서 그 점까지의 방향을 재고, 몸 하나쯤
       떨어지면 고개를 다 돌린다. 세기만 줄이고 방향은 그대로 두는 것이 요점이다 —
       축마다 따로 자르면(옛 계정 화면) 멀리 있는 커서가 죄다 네 귀퉁이로 몰려
       고개는 안 돌고 눈알만 평면으로 미끄러진다. */
    lookToward(x, y) {
      const r = host.getBoundingClientRect();
      if (!r.width) return;
      const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (!len) return;
      const k = Math.min(1, len / r.width);
      this.lookAt(dx / len * k, dy / len * k);
    },
    lookAway() {
      if (calm()) return;
      engine.setLook(null, clock());
      paintNow();
    },
    /* 엔진의 상태를 갈아 끼운다. 쓸 수 있는 이름은 STATES 의 것뿐이다 —
       idle·sleep·alert·notify·thinking·wink… (neutre 류는 상태가 아니라 표정이다).
       없는 이름을 주면 setState 가 다음 호출에서 STATE_BY_ID.get(cur).morph 로 터진다.
       깜빡임은 sample() 이 이미 내주므로, 깨우는 일은 sleep 에서 나오는 것으로 끝난다 */
    /* 고른 모양·표정·색을 갈아 끼운다. 모양과 표정은 엔진이 모프로 넘겨 주므로
       툭 끊기지 않는다. 색은 CSS 변수라 엔진을 거치지 않는다 */
    setShape(id, gen) {
      shapeId = id;
      stemOf = hasStem(id, gen);
      paintStem();
      at(now => engine.setShape(radiiOf(id, gen), now));
    },
    /* 꾸미기를 갈아 입는다 — { hat: 'crown:rose', back: null } */
    setWear(w) {
      dress(w);
      paintStem();
      finish = w?.finish ? String(w.finish).replace(/^fin:/, '') : null;
      paintInk();
      draw(raf ? clock() : clock() + 1);
    },
    setExpression(id) {
      if (dozing) { awake = exprOf(id); return; }
      at(now => engine.setExpression(exprOf(id), now));
    },
    setColour(id) {
      const v = id === 'accent' ? 'var(--accent)' : COLOR_BY_ID.get(id)?.hex || '';
      if (v) {
        host.style.setProperty('--buddy-ink', v);
        svg.style.setProperty('--buddy-ink', v);
        ink = v;
      } else {
        host.style.removeProperty('--buddy-ink');
        svg.style.removeProperty('--buddy-ink');
        ink = 'var(--buddy-ink, var(--block))';
      }
      paintInk();
      if (!raf) draw(clock() + 1);
    },
    /* 잠들고 깬다. 깰 땐 고른 표정으로 눈을 뜨며 돌아온다. 고른 표정이 없으면(null)
       엔진은 모프 없이 툭 바꾸므로, 같은 모습인 neutre 를 사이에 끼운다 */
    doze(on) {
      if (on === dozing) return;
      dozing = on;
      nods.forEach(clearTimeout);
      if (on) {
        awake = engine.expr;
        if (!engine.expr) engine.expr = EXPRESSION_BY_ID.get('neutre');
        /* 움직임을 줄였으면 곧장 감는다 */
        const steps = calm() ? NODS.slice(-1).map(([, e]) => [0, e]) : NODS;
        const last = steps[steps.length - 1][1];
        /* 꾸벅마다 0.9s 에 걸쳐 스르르 — 첫 꾸벅은 커서를 보던 시선도 함께 거둔다.
           마지막 꾸벅과 함께 눈 구멍이 같은 0.9s 에 ‿ 로 녹는다 */
        nods = steps.map(([ms, e]) => setTimeout(() => at(now => {
          glideTo(e, now, 0.9, e === steps[0][1]);
          if (e === last) shut(1, now, 0.9);
        }), ms));
      } else {
        /* 깰 땐 ‿ 가 풀리며 눈이 뜬다 — 같은 곡선, 조금 빠르게 */
        at(now => {
          glideTo(awake ?? EXPRESSION_BY_ID.get('neutre'), now, 0.5, false);
          shut(0, now, 0.4);
        });
      }
    },
    setState(id) {
      const now = (performance.now() - t0) / 1000;
      engine.setState(id, now);
      /* 모션을 줄였으면 시계가 안 돈다 — 바뀐 모습을 한 장 그려 둔다. 같은 시계로,
         모프(최대 .5s)가 끝난 뒤를 그려야 한다. draw(0) 은 상태가 바뀌기 전 시각이라
         옛 모습이 그대로 나온다 */
      if (calm()) draw(now + 1);
    },
  };
}
