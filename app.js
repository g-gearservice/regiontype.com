/* regiontype — 서울 자치구 자유형. 코스 데이터는 data/*.json 에서 읽는다. */
'use strict';

const $ = s => document.querySelector(s);
const COURSES = ['seoul-gu'];
const SYM = '0123456789abcdefghijklmnopqrstuvwxyz';   // 도트 격자의 자치구 번호

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
    li.innerHTML = `<h3></h3><p></p><span class="n"></span>
      <button class="play-main">플레이</button>`;
    li.querySelector('h3').textContent = c.title;
    li.querySelector('p').textContent = c.description;
    li.querySelector('.n').textContent =
      `${c.items.length}개 항목 · ${c.mode === 'sequence' ? '순서형' : '자유형'}`;
    li.querySelector('.play-main').onclick = () => openOptions(slug, c);
    list.append(li);
  }
})();

/* ── 코스 시작 옵션 ─────────────────────────────────────
   플레이를 누르면 열린다. 고른 값으로 바로 시작한다. */
let pendingSlug = null, lastFocus = null;

function pick(group, v) {
  group.querySelectorAll('button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.v === String(v)));
}
const picked = group =>
  group.querySelector('[aria-pressed="true"]').dataset.v;

function openOptions(slug, course) {
  pendingSlug = slug;
  lastFocus = document.activeElement;
  $('#ovTitle').textContent = course.title;
  $('#ovSub').textContent = course.mode === 'sequence'
    ? `${course.items[0].name}에서 시작해 ${course.items.at(-1).name}에서 끝납니다`
    : '순서 없이 아는 곳부터';
  $('#ov').hidden = false;
  syncNote();
  $('#ovStart').focus();
}
function closeOptions() {
  $('#ov').hidden = true;
  pendingSlug = null;
  if (lastFocus) lastFocus.focus();
}
function syncNote() {
  const z = Number(picked($('#ovZoom')));
  $('#ovNote').textContent = z === 1
    ? '서울 전체가 한눈에 보입니다.'
    : `지도가 ${z}배로 확대되고, 화면이 다음 목표를 따라갑니다.`;
}
$('#ov').addEventListener('click', e => {
  if (e.target === $('#ov')) return closeOptions();      // 바깥을 누르면 닫힌다
  const b = e.target.closest('.choice-b button');
  if (!b) return;
  pick(b.parentElement, b.dataset.v);
  syncNote();
});
$('#ovCancel').onclick = closeOptions;
$('#ovStart').onclick = () => {
  const slug = pendingSlug;
  const zoom = Number(picked($('#ovZoom')));
  closeOptions();
  start(slug, { zoom });
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#ov').hidden) closeOptions();
});

/* ── 게임 ───────────────────────────────────────────── */
let G = null, tick = null, pending = null;

async function start(slug, o = {}) {
  const zoom = o.zoom || 1;
  const [course, geom] = await load(slug);
  const items = course.items.map(it => {
    const a = stripSuffix(it.name);
    return { ...it, aliases: [...(it.aliases || []), ...(a ? [a] : [])], claimed: false };
  });
  G = { slug, course, items, zoom, seq: course.mode === 'sequence', idx: 0,
       total: opt.time, left: opt.time, hits: 0, tries: 0, combo: 0, best: 0, score: 0 };

  const svg = $('#map');
  svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
  // 격자를 자치구별로 쪼갠다 — 칸 하나가 원 하나. 타이틀 픽셀맵과 같은 문법이다
  const cells = geom.items.map(() => []);
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') cells[SYM.indexOf(ch)].push([x, y]);
  }));
  const cw = geom.cell, dr = (cw * .38).toFixed(1);

  svg.innerHTML = '<g class="cam">' + geom.items.map((g, i) =>
    `<g id="p${i}">` + cells[i].map(([x, y], n) =>
      // --i 는 도트가 차오르는 순서. 한 구가 다 차는 데 최대 0.28초
      `<circle cx="${((x + .5) * cw).toFixed(1)}" cy="${((y + .5) * cw).toFixed(1)}"` +
      ` r="${dr}" style="--i:${Math.min(n, 40)}"/>`).join('') + '</g>').join('') +
    geom.items.map((g, i) =>
      `<text id="t${i}" x="${g.c[0]}" y="${g.c[1]}"></text>`).join('') + '</g>';
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    it.el = svg.querySelector('#p' + i);
    it.label = svg.querySelector('#t' + i);
    it.label.textContent = g.name;
    it.at = g.c;
  });

  svg.style.setProperty('--z', zoom);   // 라벨·테두리를 역보정해 화면상 크기를 유지한다
  G.cam = svg.querySelector('.cam');
  G.view = [geom.w, geom.h];
  // 정보 줄을 먼저 비운다 — aim() 이 띄운 첫 목표를 곧바로 지워버리던 순서였다
  $('#fact').classList.remove('on');
  $('#fact').innerHTML = '';
  aim();                              // 첫 목표를 잡고 화면을 맞춘다
  $('#statTotal').textContent = '/' + items.length;
  $('#statCount').textContent = '0';
  $('#statCombo').textContent = '';
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

/* 지도 아래 정보 줄. 윗줄과 아랫줄을 따로 갱신한다 —
   '보임'에서는 윗줄이 지금 칠 곳, 아랫줄이 직전에 맞힌 곳의 설명이 된다. */
function say(head, body) {
  const f = $('#fact');
  if (!f.firstElementChild) f.innerHTML = '<b></b><span></span>';
  if (head !== undefined) f.querySelector('b').textContent = head;
  if (body !== undefined) f.querySelector('span').textContent = body;
  f.classList.add('on');
}

/* 순서형에서 지금 쳐야 할 항목. 자유형이면 목표가 없다. */
const target = () => G.seq ? G.items[G.idx] : null;

/* 안내에 띄울 이름. 약칭이 허용되면 실제로 쳐야 하는 만큼만 보여준다 —
   '양천'만 쳐도 되는데 '양천구'라고 적어두면 안내와 판정이 어긋난다.
   어간이 한 글자인 중구처럼 약칭이 없는 곳은 정식 명칭 그대로다. */
const promptName = it => (opt.strict ? null : stripSuffix(it.name)) || it.name;

/* 현재 목표를 표시하고 카메라를 그리로 옮긴다.
   3·7배율에서는 전체가 안 보이므로 화면이 목표를 따라가야 한다. */
function aim() {
  const t = target();
  G.items.forEach(i => i.el.classList.toggle('target', i === t));
  if (t) say(promptName(t));               // 칠 곳은 언제나 알려준다
  $('#fact').classList.toggle('aim', !!t);
  const [W, H] = G.view, z = G.zoom;
  let tx = 0, ty = 0;
  if (t) {
    // 지도 밖 빈 공간이 보이지 않게 가둔다. z=1 이면 범위가 0 하나뿐이다
    tx = Math.min(0, Math.max(W - z * W, W / 2 - z * t.at[0]));
    ty = Math.min(0, Math.max(H - z * H, H / 2 - z * t.at[1]));
  }
  G.cam.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${z})`);
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
  // 미점령 전체를 대상으로 판정한 뒤 목표인지 본다. 목표만 넘기면
  // 약칭의 경쟁 판정(중 → 중구/중랑구)이 무너진다.
  const hit = matchInput(e.target.value, G.items, opt.strict);
  if (!hit) return;
  e.target.value = '';
  if (G.seq && hit !== target()) return miss();   // 순서가 아니면 오답
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

function claim(it) {
  it.claimed = true;
  it.el.classList.add('got');
  it.label.classList.add('on');
  G.hits++; G.tries++; G.combo++;
  G.score += 100 * Math.min(5, G.combo);   // ponytail: 콤보 배율만. 인지도 역수(weight) 데이터 확보되면 항목별 배점으로 교체
  $('#statCount').textContent = G.hits;
  const cb = $('#statCombo');
  cb.textContent = G.combo > 1 ? '×' + Math.min(5, G.combo) : '';
  cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump');
  setTimeout(() => cb.classList.remove('bump'), 160);
  // 순서형은 윗줄이 곧 다음 목표로 덮이므로 맞힌 이름을 설명 줄에 함께 남긴다
  if (G.seq) say(undefined, `${it.name} — ${it.meta.description}`);
  else say(it.name, it.meta.description);
  beep(520 + G.combo * 40, .08, 'triangle');
  if (G.hits === G.items.length) return finish();
  if (G.seq) { while (G.items[G.idx] && G.items[G.idx].claimed) G.idx++; }
  aim();
}

function finish() {
  stop();
  beep(300, .3, 'triangle');
  G.items.filter(i => !i.claimed).forEach(i => i.el.classList.add('miss'));
  pending = setTimeout(() => {
    const key = `rt.best.${G.slug}.z${G.zoom}`;
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
  const bg = css.backgroundColor, ink = css.color;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);

  const svg = $('#map').cloneNode(true);
  svg.querySelector('.cam').removeAttribute('transform');   // 카드에는 전체 지도를
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const acc = css.getPropertyValue('--accent'), land = css.getPropertyValue('--land');
  svg.insertAdjacentHTML('afterbegin',
    `<style>circle{fill:${land}}g.got circle{fill:${acc};r:9.5}` +
    `g.miss circle{fill:${land};r:5}text{display:none}</style>`);
  const img = new Image();
  img.onload = () => {
    const vb = $('#map').getAttribute('viewBox').split(' ').map(Number);
    const h = cv.height - 220, w = h * vb[2] / vb[3];
    ctx.drawImage(img, (cv.width - w) / 2, 140, w, h);
    ctx.fillStyle = ink;
    ctx.font = '800 54px system-ui,sans-serif';
    ctx.fillText('regiontype', 70, 100);
    ctx.font = '500 38px system-ui,sans-serif';
    ctx.fillText(`${G.course.title} · ${G.zoom}배율 · ${G.score}점`, 70, cv.height - 136);
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
$('#again').onclick = () => start(G.slug, { zoom: G.zoom });

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
