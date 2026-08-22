/* regiontype — 서울 자치구 자유형. 코스 데이터는 data/*.json 에서 읽는다. */
'use strict';

const $ = s => document.querySelector(s);
const COURSES = ['seoul-gu'];

/* ── 설정 ───────────────────────────────────────────── */
const TIMES = [60, 90, 120, 180, 300];
const opt = Object.assign(
  { time: 120, strict: false, night: false, sound: true, motion: true },
  JSON.parse(localStorage.getItem('rt.opt') || '{}')
);
const saveOpt = () => {
  localStorage.setItem('rt.opt', JSON.stringify(opt));
  document.documentElement.toggleAttribute('data-night', opt.night);
  document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
  $('#optTime').textContent = opt.time + '초';
  document.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-pressed', !!opt[b.dataset.opt]));
};

/* ── 정답 판정 ───────────────────────────────────────
   조합 중 문자열까지 매 입력마다 검사한다. 약칭("강남")은
   그 약칭으로 이어질 수 있는 미점령 항목이 자기 자신뿐일 때만
   인정한다. 그래서 "중"은 중구/중랑구 사이에서 확정되지 않고,
   "강남"은 즉시 확정된다. 앞에 붙은 오타는 접미 검사로 흘려보낸다. */
function stripSuffix(name) {
  const m = /^(.+?)(특별시|광역시|자치구|자치시|[시군구동읍면로가])$/.exec(name);
  return m && m[1].length > 1 ? m[1] : null;
}
function matchInput(raw, items, strict) {
  const buf = raw.replace(/\s/g, '');
  for (let i = 0; i < buf.length; i++) {
    const sub = buf.slice(i);
    const open = items.filter(it => !it.claimed);
    const exact = open.find(it => it.name === sub);
    if (exact) return exact;                       // 정식 명칭은 무조건 통과
    if (strict) continue;
    const alias = open.find(it => it.aliases.includes(sub));
    if (alias && open.every(it => it === alias || !it.name.startsWith(sub))) return alias;
  }
  return null;
}
/* 이 입력이 아직 무언가로 이어질 수 있는가. 어느 접미도 미점령 항목의
   앞부분이 아니면 오타로 확정한다. */
function canContinue(raw, items) {
  const buf = raw.replace(/\s/g, '');
  if (!buf) return true;
  const open = items.filter(it => !it.claimed);
  for (let i = 0; i < buf.length; i++)
    if (open.some(it => it.name.startsWith(buf.slice(i)))) return true;
  return false;
}

/* ── 사운드 (WebAudio 삑 소리, 소재 확보 전 임시) ────── */
let ac;
function beep(freq, dur = .07, type = 'sine') {
  if (!opt.sound) return;
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(.09, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}

/* ── 화면 ───────────────────────────────────────────── */
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id !== 'play') stop();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
  const t = e.target.closest('.toggle');
  if (t) { opt[t.dataset.opt] = !opt[t.dataset.opt]; saveOpt(); }
  const s = e.target.closest('.step');
  if (s) {
    const i = TIMES.indexOf(opt.time) + Number(s.dataset.dir);
    opt.time = TIMES[Math.min(TIMES.length - 1, Math.max(0, i))]; saveOpt();
  }
});

/* ── 타이틀 픽셀맵 ──────────────────────────────────
   대한민국을 격자로 찍고 서울만 다른 색으로 둔다. v1 이 서울에서
   시작해 전국으로 넓어진다는 로드맵이 그림 하나로 보이게. */
fetch('data/korea-pixels.json').then(r => r.json()).then(g => {
  const svg = $('#pixelmap');
  // 우측 여백은 부산·울산까지로 잰다 (g.anchor). 더 동쪽으로 튀어나온 해안은
  // viewBox 밖으로 흘려보내되 지워지지는 않는다.
  svg.setAttribute('viewBox', `0 0 ${g.anchor + 1} ${g.h}`);
  // 기준선 밖(울릉도·독도)이 차지하는 폭을 높이 대비 비율로 넘겨 잘림을 막는다
  svg.style.setProperty('--pm-over', (g.w - g.anchor - 1) / g.h);
  svg.innerHTML = g.rows.flatMap((row, y) => [...row].map((ch, x) => ch === '.' ? '' :
    `<circle cx="${x + .5}" cy="${y + .5}" r=".36"${ch === 'S' ? ' class="seoul"' : ''}/>`
  )).join('');
});

/* ── 코스 로드 ──────────────────────────────────────── */
const load = slug => Promise.all([
  fetch(`data/${slug}.course.json`).then(r => r.json()),
  fetch(`data/${slug}.geom.json`).then(r => r.json())
]);

(async () => {
  saveOpt();
  const list = $('#courseList');
  for (const slug of COURSES) {
    const [c] = await load(slug);
    const li = document.createElement('li');
    li.innerHTML = `<h3></h3><p></p><span class="n"></span><button>플레이</button>`;
    li.querySelector('h3').textContent = c.title;
    li.querySelector('p').textContent = c.description;
    li.querySelector('.n').textContent = `${c.items.length}개 항목 · 자유형`;
    li.querySelector('button').onclick = () => start(slug);
    list.append(li);
  }
})();

/* ── 게임 ───────────────────────────────────────────── */
let G = null, tick = null, pending = null;

async function start(slug) {
  const [course, geom] = await load(slug);
  const items = course.items.map(it => {
    const a = stripSuffix(it.name);
    return { ...it, aliases: [...(it.aliases || []), ...(a ? [a] : [])], claimed: false };
  });
  G = { slug, course, items, total: opt.time, left: opt.time, hits: 0, tries: 0, combo: 0, best: 0, score: 0 };

  const svg = $('#map');
  svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
  // 땅 → 한강 → 도로 → 핀. Mini Motorways 보드의 쌓는 순서다
  svg.innerHTML =
    '<g class="land">' +
    geom.items.map((g, i) => `<path id="p${i}" class="h${i % 7}" d="${g.d}"></path>`).join('') +
    '</g>' +
    (geom.river ? `<path class="river" d="${geom.river}"></path>` : '') +
    '<g class="roads"></g><g class="pins"></g>';
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    it.el = svg.querySelector('#p' + i);
    it.at = g.c;
  });
  G.roads = svg.querySelector('.roads');
  G.pins = svg.querySelector('.pins');
  G.taken = [];                     // 이미 점령한 좌표 — 도로를 이어붙일 목적지

  $('#statTotal').textContent = '/' + items.length;
  $('#statCount').textContent = '0';
  $('#statCombo').textContent = '';
  $('#fact').classList.remove('on');
  $('#typein').value = '';
  $('#gaugeFill').style.width = '100%';
  $('#statTime').firstElementChild.textContent =
    Math.floor(opt.time / 60) + ':' + String(opt.time % 60).padStart(2, '0');
  $('.gauge').classList.remove('warn');
  $('#statTime').classList.remove('warn');
  go('play');
  stop();
  countdown(3, run);
}

function countdown(n, done) {
  const el = $('#countdown'); el.classList.add('on');
  const step = () => {
    el.replaceChildren();
    if (n > 0) { const b = document.createElement('b'); b.textContent = n; el.append(b); }
    if (n-- <= 0) { el.classList.remove('on'); return done(); }
    beep(440 + n * 110, .09, 'triangle');
    pending = setTimeout(step, 700);
  };
  step();
}

function run() {
  $('#typein').focus();
  tick = setInterval(() => {
    G.left--;
    $('#gaugeFill').style.width = (G.left / G.total * 100) + '%';
    $('#statTime').firstElementChild.textContent =
      Math.floor(G.left / 60) + ':' + String(G.left % 60).padStart(2, '0');
    $('.gauge').classList.toggle('warn', G.left <= 10);
    $('#statTime').classList.toggle('warn', G.left <= 10);
    if (G.left <= 0) finish();
  }, 1000);
}
function stop() { clearInterval(tick); clearTimeout(pending); tick = pending = null; }

$('#typein').addEventListener('input', e => {
  if (!G || !tick) return;
  const hit = matchInput(e.target.value, G.items, opt.strict);
  if (!hit) return;
  e.target.value = '';
  claim(hit);
});
// 조합이 끝난 시점에 어디로도 이어질 수 없으면 그때 오답이다.
// keydown 으로 스페이스를 가로채면 IME 조합 확정 자체가 깨진다.
$('#typein').addEventListener('compositionend', e => {
  if (!G || !tick || canContinue(e.target.value, G.items)) return;
  miss();
});

function miss() {
  $('#typein').value = '';
  G.tries++; G.combo = 0;
  $('#statCombo').textContent = '';
  const bar = $('.typebar');
  bar.classList.remove('bad'); void bar.offsetWidth; bar.classList.add('bad');
  setTimeout(() => bar.classList.remove('bad'), 240);
  beep(160, .12, 'square');
}

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/* 두 목적지를 잇는 도로. 가로로 갔다가 모서리를 둥글게 돌아 세로로 내려간다 */
function roadPath([x1, y1], [x2, y2]) {
  const sx = Math.sign(x2 - x1), sy = Math.sign(y2 - y1);
  const r = Math.min(20, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2);
  if (!r) return `M${x1} ${y1}L${x2} ${y2}`;
  return `M${x1} ${y1}H${x2 - r * sx}Q${x2} ${y1} ${x2} ${y1 + r * sy}V${y2}`;
}

function claim(it) {
  it.claimed = true;
  it.el.classList.add('got');

  // 가장 가까운 기존 목적지와 길을 잇는다
  if (G.taken.length) {
    const near = G.taken.reduce((a, b) =>
      Math.hypot(b[0] - it.at[0], b[1] - it.at[1]) <
      Math.hypot(a[0] - it.at[0], a[1] - it.at[1]) ? b : a);
    G.roads.append(el('path', { class: 'road-line', d: roadPath(near, it.at) }));
  }
  G.taken.push(it.at);

  const [cx, cy] = it.at;
  const g = el('g', { class: 'pin', transform: `translate(${cx} ${cy})` });
  g.append(el('path', { d: 'M0 0C-5.5-8-8.5-11.5-8.5-16A8.5 8.5 0 1 1 8.5-16C8.5-11.5 5.5-8 0 0Z' }));
  g.append(el('circle', { cx: 0, cy: -16, r: 3.2, class: 'eye' }));
  const t = el('text', { x: 0, y: 26 });
  t.textContent = it.name;
  g.append(t);
  G.pins.append(g);
  G.hits++; G.tries++; G.combo++;
  G.score += 100 * Math.min(5, G.combo);   // ponytail: 콤보 배율만. 인지도 역수(weight) 데이터 확보되면 항목별 배점으로 교체
  $('#statCount').textContent = G.hits;
  const cb = $('#statCombo');
  cb.textContent = G.combo > 1 ? '×' + Math.min(5, G.combo) : '';
  cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump');
  setTimeout(() => cb.classList.remove('bump'), 160);
  const f = $('#fact');
  f.innerHTML = '<b></b><span></span>';
  f.querySelector('b').textContent = it.name;
  f.querySelector('span').textContent = it.meta.description;
  f.classList.add('on');
  beep(520 + G.combo * 40, .08, 'triangle');
  if (G.hits === G.items.length) finish();
}

function finish() {
  stop();
  beep(300, .3, 'triangle');
  G.items.filter(i => !i.claimed).forEach(i => i.el.classList.add('miss'));
  pending = setTimeout(() => {
    const key = 'rt.best.' + G.slug;
    const prev = Number(localStorage.getItem(key) || 0);
    $('#rScore').textContent = G.score;
    $('#rCount').textContent = G.hits;
    $('#rAcc').textContent = (G.tries ? Math.round(G.hits / G.tries * 100) : 0) + '%';
    $('#rBest').textContent = G.score > prev ? '최고 기록 경신!' : prev ? `최고 기록 ${prev}점` : '';
    if (G.score > prev) localStorage.setItem(key, G.score);

    const miss = G.items.filter(i => !i.claimed);
    $('#missCount').textContent = miss.length + '곳';
    $('#missed').innerHTML = '';
    miss.forEach(i => {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span>';
      li.querySelector('b').textContent = i.name;
      li.querySelector('span').textContent = i.meta.description;
      $('#missed').append(li);
    });
    drawCard();
    go('result');
  }, 1200);
}

/* 결과 카드 — SVG를 그대로 이미지로 굽는다 (16:9) */
let cardReady = Promise.resolve();
function drawCard() {
  let done;
  cardReady = new Promise(r => done = r);
  const cv = $('#card'), ctx = cv.getContext('2d');
  const css = getComputedStyle(document.body);
  const ink = css.color, bg = css.getPropertyValue('--sea').trim();
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);

  const svg = $('#map').cloneNode(true);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const v = n => css.getPropertyValue(n);
  const hues = [0, 1, 2, 3, 4, 5, 6].map(i => `.land .h${i}.got{fill:${v('--h' + i)}}`).join('');
  svg.insertAdjacentHTML('afterbegin',
    `<style>.land path{fill:${v('--cream')};stroke:${v('--road-line')};stroke-width:3}` +
    hues +
    `.river{fill:none;stroke:${v('--sea')};stroke-width:20;stroke-linecap:round;stroke-linejoin:round}` +
    `.road-line{fill:none;stroke:${v('--road-line')};stroke-width:7;stroke-linecap:round;stroke-linejoin:round}` +
    `.pin path{fill:${v('--pin')}}.pin .eye{fill:${v('--cream')}}.pin text{display:none}` +
    `</style>`);
  const img = new Image();
  img.onload = () => {
    const vb = $('#map').getAttribute('viewBox').split(' ').map(Number);
    const h = cv.height - 220, w = h * vb[2] / vb[3];
    ctx.drawImage(img, (cv.width - w) / 2, 140, w, h);
    ctx.fillStyle = ink;
    ctx.font = '800 54px system-ui,sans-serif';
    ctx.fillText('regiontype', 70, 100);
    ctx.font = '500 38px system-ui,sans-serif';
    ctx.fillText(`${G.course.title} · ${G.score}점`, 70, cv.height - 118);
    ctx.font = '800 76px system-ui,sans-serif';
    ctx.fillText(`${G.hits}/${G.items.length}`, 70, cv.height - 50);
    ctx.textAlign = 'right';
    ctx.font = '500 34px system-ui,sans-serif';
    ctx.fillText('regiontype.com', cv.width - 70, 96);
    ctx.textAlign = 'left';
    done();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
}

$('#save').onclick = async () => {
  await cardReady;
  const a = document.createElement('a');
  a.download = `regiontype-${G.slug}.png`;
  a.href = $('#card').toDataURL('image/png');
  a.click();
};
$('#again').onclick = () => start(G.slug);

/* ── 자체 검사: rt=1 쿼리로 실행 ─────────────────────── */
if (location.search.includes('rt=1')) {
  const mk = names => names.map(n => ({ name: n, aliases: [stripSuffix(n)].filter(Boolean), claimed: false }));
  const m = (s, items, st) => { const r = matchInput(s, items, st); return r && r.name; };
  const gu = mk(['중구', '중랑구', '강남구', '강서구', '성북구', '성동구']);
  console.assert(m('중', gu) === null, '중: 중구/중랑구 미확정이어야');
  console.assert(m('중구', gu) === '중구', '중구 정확일치');
  console.assert(m('강남', gu) === '강남구', '약칭 즉시 확정');
  console.assert(m('ㅋㅋ강남', gu) === '강남구', '앞 오타는 접미 검사로 흘려보냄');
  console.assert(m('강남', gu, true) === null, '정식 명칭 강제 시 약칭 불가');
  console.assert(m('강남구', gu, true) === '강남구', '정식 명칭 강제 시 정식은 통과');
  console.assert(m('없는곳', gu) === null, '미등록');
  const one = mk(['중구', '중랑구']); one[1].claimed = true;
  console.assert(m('중', one) === null, '한 글자 어간(중)은 약칭으로 인정하지 않는다');
  const two = mk(['강서구', '강남구']); two[0].claimed = true;
  console.assert(m('강서', two) === null, '이미 점령한 곳은 다시 맞지 않는다');

  // 법정동 별칭이 다른 항목의 정식 명칭과 겹치는 경우 (PRD 6.3)
  const dong = [{ name: '역삼1동', aliases: ['역삼동', '역삼1'], claimed: false },
                { name: '역삼동', aliases: [], claimed: false }];
  console.assert(m('역삼동', dong) === '역삼동', '정식 명칭 일치가 남의 별칭에 가려지면 안 된다');
  console.assert(m('역삼동', dong, true) === '역삼동', '정식 명칭 강제 모드에서도 마찬가지');
  console.assert(m('역삼1', dong) === '역삼1동', '별칭은 후보가 자기 자신뿐일 때 확정');

  // 오타 확정 판정
  console.assert(canContinue('강', gu) === true, '강: 강남구로 이어질 수 있다');
  console.assert(canContinue('강난', gu) === false, '강난: 어디로도 이어지지 않는다');
  console.assert(canContinue('', gu) === true, '빈 입력은 오답이 아니다');
  console.assert(canContinue('가나강', gu) === true, '접미가 살아 있으면 이어진다');
  console.log('self-check done');
}
