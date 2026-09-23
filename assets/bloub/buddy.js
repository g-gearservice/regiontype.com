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
  const paper = el('path', { fill: 'var(--buddy-paper, #fff)' });
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

  function draw(now) {
    const f = engine.sample(now);
    maskBody.setAttribute('d', f.bodyPath);
    paper.setAttribute('d', f.bodyPath);
    body.setAttribute('opacity', f.bodyAlpha);
    f.eyes.forEach((eye, i) => {
      let node = eyes[i];
      if (!node) { node = eyes[i] = el('path', { fill: '#000' }); mask.append(node); }
      node.setAttribute('d', eye.d);
      node.setAttribute('transform', eye.matrix);
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
      if (calm()) return;
      /* dx·dy 는 화면 좌표다 — 오른쪽이 +, 아래가 +. 엔진의 pitch 는 위가 + 라
         여기서 한 번 뒤집는다. 부르는 쪽마다 음수를 붙이게 두면 한 곳은 꼭 빠뜨린다
         (실제로 계정 화면이 위아래 거꾸로 봤다). */
      engine.setLook(
        { yaw: 40 * dx, pitch: -34 * dy, mix: 1, wander: 0.25, spin: 0 },
        clock()
      );
      paintNow();
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
    setExpression(id) { at(now => engine.setExpression(exprOf(id), now)); },
    setColour(id) {
      const hex = COLOR_BY_ID.get(id)?.hex;
      if (hex) host.style.setProperty('--buddy-ink', hex);
      else host.style.removeProperty('--buddy-ink');
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
