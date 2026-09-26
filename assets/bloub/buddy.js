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
const { BotEngine, DEMI_VIEWBOX: VB, SHAPE_BY_ID, EXPRESSION_BY_ID, COLOR_BY_ID, SHAPES, EXPRESSIONS, COLORS } =
  await import(new URL('engine.js' + new URL(import.meta.url).search, import.meta.url).href);

/* 고를 수 있는 것의 목록. 부르는 쪽이 engine.js 를 따로 부르지 않게 여기서 건넨다 —
   두 번 부르면 판이 갈려(한쪽만 ?v=) 같은 사고가 다시 난다. */
const EYE = 'oklch(from var(--buddy-ink, var(--block)) clamp(.2, (.62 - l) * 1000, .98) calc(c * .25) h)';

export const TABLES = { shapes: SHAPES, expressions: EXPRESSIONS, colours: COLORS };

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/* calm  — 움직임을 줄인 사람. 시계도 시선도 멈춘다(사람의 뜻이다).
   still — 시계만 안 돈다. 견본처럼 여럿 띄우는 놈이 제 숨을 쉬느라 프레임을 먹지
           않게 하는 것뿐이라, 시선은 부르는 쪽이 한 바퀴에 한 장씩 그려 따라본다. */
export function mountBuddy(host, { calm = () => false, still = false, shape = null, expression = null } = {}) {
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
  const inked = el('g', { mask: `url(#${uid})` });
  inked.append(el('rect', { x: -VB, y: -VB, width: VB * 2, height: VB * 2, fill: 'var(--buddy-ink, var(--block))' }));
  const body = el('g');
  body.append(paper, inked);
  svg.append(defs, body);
  host.append(svg);

  const eyes = [];
  /* 모양·표정은 id 로 받고 엔진이 쓰는 값으로 여기서 바꾼다 — 부르는 쪽이
     엔진 내부 표를 알 필요가 없다. 모르는 id 는 null(기본 모습)로 떨어진다 */
  const radiiOf = id => SHAPE_BY_ID.get(id)?.radii ?? null;
  const exprOf = id => EXPRESSION_BY_ID.get(id) ?? null;
  const engine = new BotEngine(100, 'idle', radiiOf(shape), exprOf(expression));
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

  function draw(now) {
    glideAt(now);
    const f = engine.sample(now);
    maskBody.setAttribute('d', f.bodyPath);
    paper.setAttribute('d', f.bodyPath);
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

  const tick = (ms) => {
    if (!t0) t0 = ms;
    draw((ms - t0) / 1000);
    raf = requestAnimationFrame(tick);
  };

  /* 시계가 안 도는(모션을 줄인) 화면에서도 바뀐 모습이 보여야 한다 — 상태를 바꾼 뒤
     모프가 끝난 시각을 한 장 그려 둔다. setState 가 하던 일과 같은 수다. */
  /* 이 놈의 시계. 아직 안 돌았으면 지금을 0 으로 잡는다 */
  const clock = () => {
    if (!t0) t0 = performance.now();
    return (performance.now() - t0) / 1000;
  };
  /* 모양·표정처럼 모프가 붙는 변화. 시계가 안 도는 놈은 모프가 끝난 뒤를 한 장 그린다 */
  function at(change) {
    const now = clock();
    change(now);
    if (!raf) draw(now + 1);
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
    setShape(id) { at(now => engine.setShape(radiiOf(id), now)); },
    setExpression(id) {
      if (dozing) { awake = exprOf(id); return; }
      at(now => engine.setExpression(exprOf(id), now));
    },
    setColour(id) {
      const hex = COLOR_BY_ID.get(id)?.hex;
      if (hex) host.style.setProperty('--buddy-ink', hex);
      else host.style.removeProperty('--buddy-ink');
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
