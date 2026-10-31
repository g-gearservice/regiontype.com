/* 봇의 감정. ALMA(Gebhard 2005, "ALMA – A Layered Model of Affect", AAMAS)를 홈 봇 크기로 줄였다.
   두 겹이다 — 일(대화·판 결과)이 감정을 낳고, 감정은 잠깐 얼굴에 떴다가 바래며 그사이 기분을 끌고 민다.
   감정·기분은 둘 다 PAD(즐거움 Pleasure·각성 Arousal·지배 Dominance, -1..1) 공간의 한 점이다.
   DOM 도 엔진도 모른다 — 얼굴 id 하나만 내고, 그걸 입히는 일은 부르는 쪽(ranked.js)이 한다.
   relay/test.mjs 가 이 파일을 불러 검사한다 */

/* OCC 감정 → PAD. ALMA 의 Table 2 그대로이고, surprise 는 같은 논문의 기본 감정 표에서 왔다.
   confusion 만 논문에 없다 — 봇이 못 알아들었을 때 쓰려고 surprise(+A)와 distress(-P,-D) 사이에 두었다.
   face 는 engine.js 의 EXPRESSIONS id. 중계기(worker.mjs 의 BOT_FEEL)가 모델에게 이 이름들만 고르게 한다 */
export const FEEL = {
  joy:            { pad: [.4, .2, .1],     face: 'heureux' },
  happyfor:       { pad: [.4, .2, .2],     face: 'heureux' },
  gratitude:      { pad: [.4, .2, -.3],    face: 'heureux' },
  relief:         { pad: [.2, -.3, .4],    face: 'heureux' },
  gratification:  { pad: [.6, .5, .4],     face: 'hilare' },
  pride:          { pad: [.4, .3, .3],     face: 'fier' },
  admiration:     { pad: [.5, .3, -.2],    face: 'excite' },
  hope:           { pad: [.2, .2, -.1],    face: 'attentif' },
  surprise:       { pad: [.2, .5, .1],     face: 'surpris' },
  confusion:      { pad: [-.2, .3, -.3],   face: 'confus' },
  distress:       { pad: [-.4, -.2, -.5],  face: 'triste' },
  disappointment: { pad: [-.3, .1, -.4],   face: 'triste' },
  pity:           { pad: [-.4, -.2, -.5],  face: 'triste' },
  fear:           { pad: [-.64, .6, -.43], face: 'effraye' },
  anger:          { pad: [-.51, .59, .25], face: 'colere' },
  reproach:       { pad: [-.3, -.1, .4],   face: 'mefiant' },
  shame:          { pad: [-.3, .1, -.6],   face: 'timide' },
};

/* 기분 팔분면(ALMA Table 1) → 얼굴. 편안(+P-A+D)·온순(+P-A-D)은 제 얼굴(null)로 둔다 */
const OCTANT = { '+++': 'heureux', '++-': 'attentif', '+-+': null, '+--': null,
                 '---': 'blase', '--+': 'mefiant', '-+-': 'triste', '-++': 'colere' };

/* ALMA 의 수(감정은 20초에 걸쳐 곧게 바래고, 세기 0.4 아래면 얼굴에 안 뜬다)는 그대로 쓴다.
   기분은 논문이 팔분면 하나 건너는 데 10분, 제자리로 돌아오는 데 20분이다 — 한 판이 2분인 사이트엔
   너무 느려 같은 1:2 를 지켜 10분의 1로 줄였다. 기분은 원점에서 MOOD_MIN 넘게 벗어나면 얼굴에 뜬다 —
   논문의 '보통'(√3/3)은 감정 점 자체가 원점에서 0.5~0.9 라 1분 내내 화를 내도 못 닿아, '조금'(slightly) 안쪽에 둔다.
   한 번 기쁜 걸로는 안 넘고(약 0.17) 같은 감정이 몇 번 거듭되면 넘는다. 얼굴이 너무 자주·드물게 바뀌면 여기를 만진다 */
export const EMO_S = 20, EMO_MIN = .4, MOOD_S = 60, BACK_S = 120, MOOD_MIN = .3;

const len = v => Math.hypot(...v);
const clamp = x => Math.max(-1, Math.min(1, x));

export function createAffect(base = [0, 0, 0]) {
  let mood = [...base], live = [], last = 0;
  const strength = (e, now) => e.k * Math.max(0, 1 - (now - e.at) / EMO_S);
  /* now(초)까지 기분을 옮긴다. 살아 있는 감정의 가운데(세기로 가중)가 있으면 ALMA 의 끌고 밀기 —
     기분이 원점과 그 가운데 사이면 그쪽으로 끌려가고, 넘어섰으면 같은 쪽으로 더 밀려난다.
     감정이 없으면 제자리(base)로 돌아온다 */
  /* 0.5초씩 끊어 옮긴다(ALMA 의 period 500) — 한 번에 건너뛰면 그사이 살아 있던 감정을 못 본다.
     오래 비운 탭은 기분이 어차피 제자리라 BACK_S 두 배까지만 센다 */
  function step(now) {
    last = Math.max(last, now - BACK_S * 2);
    while (last < now) tick(Math.min(now, last + .5));
    live = live.filter(e => strength(e, now) > 0);
  }
  function tick(now) {
    const dt = now - last;
    last = now;
    live = live.filter(e => strength(e, now) > 0);
    if (!live.length) {
      const gap = mood.map((m, i) => base[i] - m), d = len(gap), go = Math.min(d, Math.sqrt(3) * dt / BACK_S);
      if (d) mood = mood.map((m, i) => m + gap[i] / d * go);
      return;
    }
    let w = 0;
    const c = [0, 0, 0];
    for (const e of live) { const s = strength(e, now); w += s; e.pad.forEach((x, i) => { c[i] += x * s; }); }
    const vec = c.map(x => x / w), k = w / live.length;
    const to = len(mood) < len(vec) ? vec.map((x, i) => x - mood[i]) : vec, d = len(to);
    if (!d) return;
    const go = Math.min(len(mood) < len(vec) ? d : Infinity, k * dt / MOOD_S);
    mood = mood.map((m, i) => clamp(m + to[i] / d * go));
  }
  return {
    /* 감정 하나를 낳는다. 모르는 이름은 버린다 */
    feel(name, k, now) {
      const f = Object.hasOwn(FEEL, name) ? FEEL[name] : null;
      if (!f) return false;
      step(now);
      live.push({ pad: f.pad, face: f.face, k: Math.max(0, Math.min(1, k)), at: now });
      return true;
    },
    /* 지금 띄울 얼굴. 가장 센 감정이 문턱을 넘으면 그 얼굴, 아니면 기분의 얼굴, 그것도 아니면 null(제 얼굴) */
    face(now) {
      step(now);
      let top = null, s = EMO_MIN;
      for (const e of live) { const v = strength(e, now); if (v >= s) { s = v; top = e; } }
      if (top) return top.face;
      if (len(mood) < MOOD_MIN) return null;
      return OCTANT[mood.map(x => x >= 0 ? '+' : '-').join('')];
    },
    mood: () => [...mood],
  };
}
