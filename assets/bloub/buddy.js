/* 넵바의 동글이. 그림과 움직임은 옆의 engine.js(bloub, MIT · Jérémy Perret)가 내고,
   여기서는 그 결과(BotFrame)를 SVG 에 옮기고 시계를 돌리는 일만 한다.

   원본은 Vue 컴포넌트로 그리지만 이 저장소에는 프레임워크가 없다(CLAUDE.md).
   대기 상태만 쓰므로 그릴 것은 몸통 하나와 눈 두 개뿐이다 — 궤도 고리와 입자는
   다른 상태에서만 나오고, 여기서는 sample() 이 빈 배열을 준다.

   눈은 몸통 위에 얹은 흰 도형이 아니라 몸통에 뚫은 '구멍'이다(원본과 같다).
   그래야 눈이 가장자리로 갈 때 실루엣에 저절로 잘린다. 구멍 뒤로 페이지가
   비쳐 보이면 안 되므로 같은 모양의 바탕을 한 겹 깔고 그 위를 마스크로 판다. */
import { BotEngine, DEMI_VIEWBOX as VB } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

export function mountBuddy(host, { calm = () => false } = {}) {
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
  const engine = new BotEngine(100, 'idle');
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

  return {
    node: svg,
    start() {
      if (raf) return;
      /* 모션을 줄였으면 시계를 돌리지 않고 한 장만 그린다 — 깜빡임도 시선도 멈춘다 */
      if (calm()) { draw(0); return; }
      raf = requestAnimationFrame(tick);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; t0 = 0; },
    /* 커서를 따라본다. yaw·pitch 는 절대 방향(도)이고, mix 는 바깥이 방향을
       얼마나 쥐는지다. 원본이 그렇듯 섞는 일은 엔진이 한다 */
    lookAt(dx, dy) {
      if (calm()) return;
      engine.setLook(
        { yaw: 40 * dx, pitch: 34 * dy, mix: 1, wander: 0.25, spin: 0 },
        (performance.now() - t0) / 1000
      );
    },
    lookAway() {
      if (calm()) return;
      engine.setLook(null, (performance.now() - t0) / 1000);
    },
  };
}
