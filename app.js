/* regiontype — 서울 자치구 자유형. 코스 데이터는 data/*.json 에서 읽는다. */
'use strict';

const $ = s => document.querySelector(s);
const VER = '0.2';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const REGIONS = [
  {
    id: 'seoul',
    title: '서울',
    description: '한강이 가로지르는 수도. 25개 자치구부터 행정동까지.',
    thumb: 'seoul-gu',
    courses: ['seoul-gu', 'gangseo-dong']
  }
];
const SYM = '0123456789abcdefghijklmnopqrstuvwxyz';   // 도트 격자의 자치구 번호
let PM = null;   // 타이틀 픽셀맵 메타. 배경 격자를 비트 칸에 맞출 때 쓴다.

/* 보드 에셋을 문서 안에 심는다. 외부 파일을 use 로 참조하면 브라우저에 따라
   CSS 변수가 그림자 트리로 넘어가지 않아 색을 바꿀 수 없다. */
const sprite = fetch(asset('assets/board.svg')).then(r => r.text()).then(t => {
  document.body.insertAdjacentHTML('afterbegin', t);
});

/* 로드맵 에셋을 비트맵 위에 얹을 때 쓰는 치수.
   v  뷰박스, b  건물(또는 상자)이 그 안에서 차지하는 칸,
   c  도트를 지워야 하는 자리(토지까지 포함. 그림자는 뺀다). */
const ASSET = {
  // v 뷰박스 · b 건물 · c 토지 · p 꼭지 끝점(심볼 좌표) · nub 꼭지 폭
  depot: { id: 'rt-block-depot', v: [-8, -10, 200, 152], b: [26, 18, 128, 72], c: [12, 10, 150, 98],
           p: { l: [-4, 59], r: [178, 59], t: [87, -6], b: [87, 124] }, nub: 20 },
  stop:  { id: 'rt-block', v: [-8, -10, 200, 152], b: [26, 18, 128, 72], c: [12, 10, 150, 98],
           p: { l: [-4, 59], r: [178, 59], t: [87, -6], b: [87, 124] }, nub: 20 },
  end:   { id: 'rt-block-end', v: [-8, -10, 200, 152], b: [26, 18, 128, 72], c: [12, 10, 150, 98],
           p: { l: [-4, 59], r: [178, 59], t: [87, -6], b: [87, 124] }, nub: 20 },
};

/* 건물 폭을 지정하면 use 상자 크기와, 건물 중심·토지·꼭지를 그 상자 안
   좌표로 돌려준다. */
function tileBox(kind, buildWidth) {
  const a = ASSET[kind];
  const [vx, vy, vw, vh] = a.v, [bx, by, bw, bh] = a.b, [cx, cy, cw, ch] = a.c;
  const w = buildWidth * vw / bw, h = w * vh / vw;
  const sx = w / vw, sy = h / vh;
  const at = ([x, y]) => [(x - vx) * sx, (y - vy) * sy];
  const port = {};
  for (const k in a.p) port[k] = at(a.p[k]);
  return {
    id: a.id, w, h, nub: a.nub * sx,
    dx: (bx - vx + bw / 2) * sx,          // 상자 왼쪽 위 → 건물 한가운데
    dy: (by - vy + bh / 2) * sy,
    clear: { x: (cx - vx) * sx, y: (cy - vy) * sy, w: cw * sx, h: ch * sy },
    // 꼭지는 토지 한가운데를 기준으로 놓여 있다. 칸 중심에 이 점을 맞춘다
    mid: at([cx + cw / 2, cy + ch / 2]),
    port,
  };
}

/* 순서형 코스에서 이 항목이 무엇인가 — 출발·경유·종점 */
const kindOf = (n, total) => n === 0 ? 'depot' : n === total - 1 ? 'end' : 'stop';
const HUES = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'slate'];
/* 건물 색 배합. 느와르는 한 색, 유사색은 이웃한 세 색만 돈다 */
const TINTS = { rainbow: HUES, noir: ['slate'], akin: ['teal', 'blue', 'green'] };
const hueAt = i => { const t = TINTS[opt.tint] || HUES; return t[i % t.length]; };
/* ── 설정 ───────────────────────────────────────────── */
const TIMES = [60, 90, 120, 180, 300];
const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
/* 미니 모터웨이즈 지도는 아직 다듬는 중이다 — 개발 환경에서만 켤 수 있다.
   배포본에서는 설정 항목 자체가 사라지고 값도 강제로 꺼진다. */
const DEV = ['localhost', '127.0.0.1', '::1', ''].includes(location.hostname) ||
            location.search.includes('dev=1');
document.documentElement.toggleAttribute('data-dev', DEV);

const opt = Object.assign(
  { time: 120, strict: false, night: false, sound: true, motion: true, road: false, hint: true, tint: 'rainbow' },
  JSON.parse(localStorage.getItem('rt.opt') || '{}')
);
// 예전에는 style:'road' 로 적었다. 켜 두었던 사람이 조용히 비트맵으로 돌아가지 않게
if (opt.style) { opt.road = opt.style === 'road'; delete opt.style; }
if (!DEV) opt.road = false;
const saveOpt = () => {
  localStorage.setItem('rt.opt', JSON.stringify(opt));
  document.documentElement.toggleAttribute('data-night', opt.night);
  document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
  // 미니 모터웨이즈는 지도만이 아니라 화면 전체의 말투다 — 토큰째 갈아끼운다
  document.documentElement.toggleAttribute('data-road', opt.road);
  REDRAW.forEach(f => f());   // 도트 그림은 모드마다 모양이 달라 다시 그린다
  requestAnimationFrame(syncGrid);
  document.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-pressed', !!opt[b.dataset.opt]));
  $('#optStyle').textContent = opt.road ? '미니 모터웨이즈' : '비트맵';
};

/* 못 넘기는 스타일 — 값 자리에 ✕ 를 잠깐 띄운다 */
function denyStyle() {
  const el = $('#optStyle');
  el.innerHTML = '<i class="ms">close</i>';
  el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
  setTimeout(() => {
    el.classList.remove('deny');
    el.textContent = opt.road ? '미니 모터웨이즈' : '비트맵';
  }, 700);
}

/* 모드가 바뀌면 다시 그려야 하는 그림들 */
const REDRAW = [];
/* 비트맵은 도트, 미니 모터웨이즈는 칸을 채운 타일이다 */
const dot = (x, y, cell, cls) => {
  const a = cls ? ` class="${cls}"` : '';
  if (!opt.road) return `<circle cx="${((x + .5) * cell).toFixed(2)}" cy="${((y + .5) * cell).toFixed(2)}" r="${(cell * .46).toFixed(2)}"${a}/>`;
  const p = cell * .04;   // 타일 사이 실틈. 붙여 놓으면 덩어리가 뭉개진다
  return `<rect x="${(x * cell + p).toFixed(2)}" y="${(y * cell + p).toFixed(2)}"` +
    ` width="${(cell - p * 2).toFixed(2)}" height="${(cell - p * 2).toFixed(2)}"` +
    ` rx="${(cell * .18).toFixed(2)}"${a}/>`;
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
  requestAnimationFrame(() => requestAnimationFrame(syncGrid));
  // 숨은 화면에서는 높이가 0으로 읽힌다. 보이게 된 뒤에 재어 둔다
  requestAnimationFrame(() => document.querySelectorAll('.course-list .card').forEach(measureCard));
}

function applyGrid(ox, oy, n) {
  const svg = $('.grid-bg'), p = $('#bitgrid');
  if (!p || !(n > 0)) return;
  svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  p.setAttribute('width', n);
  p.setAttribute('height', n);
  p.setAttribute('x', ox);
  p.setAttribute('y', oy);
  p.querySelector('path').setAttribute('d', `M${n} 0 V${n} H0`);
}
/* SVG 유저 좌표 → 화면. 추정하지 않고 CTM 으로 격자 원점·칸을 읽는다. */
function syncGrid() {
  let root, space, cell;
  if ($('#play').classList.contains('on') && G && G.cam) {
    root = $('#map'); space = G.cam; cell = G.cell;
  } else {
    const pm = $('#pixelmap');
    if (!pm || !$('#title').classList.contains('on')) return;
    root = space = pm; cell = opt.road ? 4 : 1;
  }
  const ctm = space.getScreenCTM();
  if (!ctm) return;
  const a = root.createSVGPoint();
  a.x = 0; a.y = 0;
  const o = a.matrixTransform(ctm);
  a.x = cell;
  const x1 = a.matrixTransform(ctm);
  applyGrid(o.x, o.y, Math.hypot(x1.x - o.x, x1.y - o.y));
}
function followGrid(ms) {
  const t0 = performance.now();
  const step = () => {
    syncGrid();
    if (performance.now() - t0 < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
window.addEventListener('resize', syncGrid);
document.addEventListener('click', e => {
  const drum = document.querySelector('.wheel[data-on]');
  if (drum && !drum.closest('.stat.time').contains(e.target)) closeWheel(drum);
  const open = document.querySelector('.card[data-flip="true"]');
  if (open && !open.contains(e.target)) flip(open, false);
  const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
  const t = e.target.closest('.toggle');
  if (t) { opt[t.dataset.opt] = !opt[t.dataset.opt]; saveOpt(); }
  // 스타일은 화살표로 넘긴다. 지금은 두 가지뿐이라 어느 쪽이든 반대편으로 간다
  const s = e.target.closest('[data-style]');
  if (s) {
    // 배포본에서 미니 모터웨이즈는 아직 못 켠다 — ✕ 만 띄우고 자리에 둔다
    if (!DEV && !opt.road) return denyStyle();
    opt.road = !opt.road; saveOpt();
  }
});

/* ── 배경 보드 (미니 모터웨이즈 모드) ────────────────
   홈·설정 화면 뒤로 길과 건물이 지난다. 레퍼런스의 메뉴 화면처럼
   놀고 있는 지도 위에 UI 가 얹힌 꼴이 되게. 좌표는 1600x900 기준.
   심볼 뷰박스가 (-8,-10,200,152) 라 좌표는 그대로 8·10 만 밀면 된다. */
/* 레퍼런스 타이틀 화면을 그대로 옮긴 배치다. 위에서 내려온 길이 꺾여
   왼쪽 아래로 빠지고, 오른쪽에 목적지 한 채, 가지 끝에 차고지 하나. */
const BOARD = [
  // x, y, 꼭지 방향, 건물 심볼, 색  (심볼 뷰박스가 -8/-10 이라 좌표는 그만큼만 밀면 된다)
  [560, 88, 'l', 'rt-block-end', 'c-orange', '대치동'],   // 목적지 — 길 오른쪽에 붙는다
  [529, 314, null, 'rt-depot', 'c-red'],        // 차고지 — 토지 없이 상자만 (레퍼런스와 같게)
];
const ROADS = [
  'M564 -10 V236 L346 460',       // 본선: 위에서 내려와 왼쪽 아래로 빠진다
  'M521 280 Q560 292 560 320',    // 차고지로 갈라지는 가지
];
function drawBoard() {
  const svg = $('.road-bg');
  if (!opt.road) { svg.innerHTML = ''; return; }
  const place = (id, x, y, w = 200, h = 152) => `<use href="#${id}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  // 게임판과 같은 순서로 쌓는다 — 토지 → 길 → 건물. 길이 토지 꼭지를 덮어야
  // 이음매의 테두리가 지워지고 하나로 이어져 보인다.
  const layer = f => BOARD.map(a => f(...a)).join('');
  const lines = w => ROADS.map(d => `<path d="${d}" stroke-width="${w}"/>`).join('');
  svg.innerHTML =
    `<g class="rb-plots">${layer((x, y, dir) => dir ? place('rt-plot-' + dir, x, y) : '')}</g>` +
    `<g class="rb-edge">${lines(27)}</g><g class="rb-road">${lines(20)}</g>` +
    // 길 테두리가 토지 입구를 가로지른다. 테두리 없는 토지를 한 번 더 얹어 지운다
    `<g class="rb-plots rb-plots-top">${layer((x, y, dir) => dir ? place('rt-plot-' + dir, x, y) : '')}</g>` +
    layer((x, y, dir, blk, hue, label) =>
      `<g class="rb-tile ${hue}">${dir ? place(blk, x, y) : place(blk, x, y, 84, 82)}` +
      // 건물 위에 찍힌 글자다 — 지도와 같이 커지고, 핀 아래에 앉는다
      (label ? `<text x="${x + 98}" y="${y + 78}">${label}</text>` : '') + '</g>') +
    // 차 심볼은 코가 위(-y)를 본다. rotate="auto" 는 +x 를 진행방향에 맞추므로 90도 미리 돌린다
    (opt.motion ? '<g class="rb-car c-yellow"><g transform="rotate(90)">' +
      '<use href="#rt-car" x="-12" y="-21" width="31.5" height="45"/></g>' +
      '<animateMotion dur="11s" repeatCount="indefinite" rotate="auto"' +
      ` path="${ROADS[0]}"/></g>` : '');
}
sprite.then(() => { REDRAW.push(drawBoard); drawBoard(); });

/* ── 타이틀 픽셀맵 ──────────────────────────────────
   대한민국을 격자로 찍고 서울만 다른 색으로 둔다. v1 이 서울에서
   시작해 전국으로 넓어진다는 로드맵이 그림 하나로 보이게. */
fetch(asset('data/korea-pixels.json')).then(r => r.json()).then(g => {
  const svg = $('#pixelmap');
  // 우측 여백은 부산·울산까지로 잰다 (g.anchor). 더 동쪽으로 튀어나온 해안은
  // viewBox 밖으로 흘려보내되 지워지지는 않는다.
  svg.setAttribute('viewBox', `0 0 ${g.anchor + 1} ${g.h}`);
  // 기준선 밖(울릉도·독도)이 차지하는 폭을 높이 대비 비율로 넘겨 잘림을 막는다
  g.over = (g.w - g.anchor - 1) / g.h;
  svg.style.setProperty('--pm-over', g.over);
  PM = g;
  const draw = () => svg.innerHTML = opt.road ? '' : g.rows.flatMap((row, y) =>
    [...row].map((ch, x) => ch === '.' ? '' : dot(x, y, 1, ch === 'S' ? 'seoul' : ''))).join('');
  REDRAW.push(draw); draw();
  requestAnimationFrame(() => requestAnimationFrame(syncGrid));
});

/* 카드 상단은 흰 원 없이 도트만. 빈 칸을 잘라 초록 면을 채운다 */
function thumbSvg(geom) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const dots = [];
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    dots.push(dot(x, y, geom.cell, ''));
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }));
  const c = geom.cell;
  return `<svg viewBox="${minX * c} ${minY * c} ${(maxX - minX + 1) * c} ${(maxY - minY + 1) * c}"` +
    ` preserveAspectRatio="xMidYMid slice">${dots.join('')}</svg>`;
}

/* 카드를 누르면 그 자리에서 뒤집힌다 — 같은 목록에서 한 장만 열린다 */
function flipMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--flip').trim();
  return raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
}
function lockUntilSettled(card, after) {
  card.dataset.locking = '1';
  const ms = flipMs();
  const unlock = () => {
    delete card.dataset.locking;
    if (after) after();
  };
  if (!(ms > 0)) { unlock(); return; }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    card.removeEventListener('transitionend', onEnd);
    unlock();
  };
  const onEnd = e => { if (e.target === card && e.propertyName === 'transform') finish(); };
  card.addEventListener('transitionend', onEnd);
  setTimeout(finish, ms + 50);
}

function applyFlip(card, open) {
  card.closest('.course-list').querySelectorAll('.card').forEach(c => {
    const on = open && c === card;
    const front = c.querySelector('.card-front'), back = c.querySelector('.card-back');
    c.dataset.flip = on;
    front.setAttribute('aria-expanded', on);
    front.inert = on;
    back.inert = !on;
  });
}

/* 프리뷰 → 카드: 먼저 반 이상 접고, 그다음 뒤집는다. 코스 고르기로 한 단 내려오는 길은 그대로다 */
function closePreviewToCard(card) {
  card.dataset.locking = '1';
  const half = (card.getBoundingClientRect().width + 230) / 2;
  card.removeAttribute('data-preview');
  let flipped = false;
  const startFlip = () => {
    if (flipped) return;
    flipped = true;
    applyFlip(card, false);
    lockUntilSettled(card, card._resetPick);
    card.querySelector('.card-front').focus();
  };
  const tick = () => {
    if (flipped) return;
    if (card.getBoundingClientRect().width <= half) startFlip();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(startFlip, flipMs() * .72);
}

/* 닫힌 높이를 픽셀로 박아둔다 — auto 로는 접히는 길이를 잇지 못한다 */
function measureCard(card) {
  if (card.dataset.flip === 'true' || card.dataset.locking === '1') return;
  card.style.removeProperty('--card-h');
  const h = card.querySelector('.card-front').offsetHeight;
  if (h) card.style.setProperty('--card-h', h + 'px');
}
function flip(card, open) {
  if (open && (card.dataset.flip === 'true' || card.dataset.locking === '1')) return;
  if (!open && (card.dataset.flip !== 'true' || card.dataset.locking === '1')) return;
  if (open) measureCard(card);
  if (!open && card.dataset.preview === '1' && flipMs() > 0) {
    closePreviewToCard(card);
    return;
  }
  applyFlip(card, open);
  if (!open) {
    const wasPreview = card.dataset.preview === '1';
    card.removeAttribute('data-preview');
    lockUntilSettled(card, wasPreview ? card._resetPick : null);
    card.querySelector('.card-front').focus();
    return;
  }
  const play = card.querySelector('.ov-play');
  const focus = (play && !play.hidden && card.querySelector('.ov-start'))
    || card.querySelector('.ov-courses button')
    || card.querySelector('.ov-start');
  if (focus) focus.focus();
}

/* 뒷면 하나에 배율 선택·시작·취소를 묶는다 */
function previewCam(svg, geom, zoom, at) {
  const W = geom.w, H = geom.h, z = zoom;
  let tx = 0, ty = 0;
  if (z > 1 && at) {
    tx = Math.min(0, Math.max(W - z * W, W / 2 - z * at[0]));
    ty = Math.min(0, Math.max(H - z * H, H / 2 - z * at[1]));
  }
  svg.style.setProperty('--z', z);
  const cam = svg.querySelector('.cam');
  if (cam) cam.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${z})`);
}

function wireBack(card, back, slug, geom, items) {
  const svg = back.querySelector('.ov-map');
  const head = items[0] && geom.items.find(g => g.name === items[0].name);
  const at = head && head.c;
  previewCam(svg, geom, 1, at);
  wireDock(back);
  back.querySelector('.ov-start').onclick = () => {
    flip(card, false);
    start(slug, { zoom: 3 });
  };
}

/* 미리보기 독 — 이름 보임·색. 제한 시간은 HUD 드럼에서 고른다 */
function closeWheel(wheel) {
  if (!wheel || wheel.hidden) return;
  const btn = wheel.closest('.stat.time')?.querySelector('.ov-time');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  wheel.removeAttribute('data-on');
  const hide = () => { wheel.hidden = true; };
  if (!opt.motion || matchMedia('(prefers-reduced-motion:reduce)').matches) { hide(); return; }
  wheel.addEventListener('transitionend', hide, { once: true });
  setTimeout(hide, 240);
}
function wireTimeWheel(pane, paint) {
  const slot = pane.querySelector('.stat.time');
  const btn = pane.querySelector('.ov-time');
  if (!slot || !btn) return;
  const wheel = document.createElement('div');
  wheel.className = 'wheel';
  wheel.hidden = true;
  wheel.setAttribute('role', 'listbox');
  wheel.innerHTML = '<div class="wheel-band" aria-hidden="true"></div><div class="wheel-drum"></div>';
  const drum = wheel.querySelector('.wheel-drum');
  TIMES.forEach((sec, i) => {
    const it = document.createElement('button');
    it.type = 'button';
    it.className = 'wheel-item';
    it.setAttribute('role', 'option');
    it.textContent = clock(sec);
    it.dataset.i = i;
    drum.append(it);
  });
  slot.append(wheel);
  const items = [...drum.children];
  const last = TIMES.length - 1;
  const ITEM = 36;
  const indexOf = () => Math.min(last, Math.max(0, Math.round(drum.scrollTop / ITEM)));
  const draw = () => {
    const mid = drum.scrollTop + drum.clientHeight / 2;
    items.forEach((el, i) => {
      const c = el.offsetTop + el.offsetHeight / 2;
      const d = (c - mid) / ITEM;
      el.style.opacity = String(Math.max(.22, 1 - Math.abs(d) / 1.5));
      el.setAttribute('aria-selected', i === indexOf());
    });
  };
  const commit = () => {
    const i = indexOf();
    if (TIMES[i] !== opt.time) { opt.time = TIMES[i]; saveOpt(); paint(); }
    draw();
  };

  btn.onclick = e => {
    e.stopPropagation();
    if (!wheel.hidden && wheel.dataset.on) { closeWheel(wheel); return; }
    wheel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    drum.scrollTop = Math.max(0, TIMES.indexOf(opt.time)) * ITEM;
    draw();
    requestAnimationFrame(() => { wheel.dataset.on = '1'; });
  };
  drum.addEventListener('scroll', commit, { passive: true });
  items.forEach(it => {
    it.onclick = () => { drum.scrollTop = +it.dataset.i * ITEM; commit(); };
  });
}

function wireDock(pane) {
  const hint = pane.querySelector('.ov-hint');
  const tint = pane.querySelector('.ov-tint');
  if (!hint) return;
  const paint = () => {
    hint.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!opt.hint));
    if (tint) tint.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', b.dataset.v === opt.tint));
    pane.querySelector('.ov-time').textContent = clock(opt.time);
  };
  wireTimeWheel(pane, paint);
  if (tint) tint.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    opt.tint = b.dataset.v;
    saveOpt(); paint();
    pane.querySelectorAll('.blocks > g').forEach((g, i) => {
      g.className.baseVal = g.className.baseVal.replace(/c-\w+/, 'c-' + hueAt(i));
    });
  };
  hint.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    opt.hint = b.dataset.v === '1';
    saveOpt(); paint();
  };
  paint();
}

function wireRegionBack(card, back, courses) {
  const pick = back.querySelector('.ov-pick');
  const play = back.querySelector('.ov-play');
  let gen = 0;
  /* 미리보기를 접는다 — 카드 크기로 줄어들며 흐려진 뒤에 치운다.
     instant 는 카드가 이미 앞면으로 돌아간 뒤의 뒷정리용이다. */
  const showPick = (instant) => {
    gen++;
    card.removeAttribute('data-preview');
    const pane = play.firstElementChild;
    const done = () => {
      play.hidden = true;
      play.replaceChildren();
      pick.hidden = false;
      if (card.dataset.flip !== 'true') return;
      const first = back.querySelector('.ov-courses button');
      if (first) first.focus();
    };
    const ms = flipMs();
    if (instant || !pane || !(ms > 0)) { done(); return; }
    setTimeout(done, ms);
  };
  const showPlay = async (c, from) => {
    const n = ++gen;
    // 누른 버튼 자리를 원점으로 삼는다. 숨기기 전에 재야 좌표가 살아 있고,
    // offset 은 레이아웃 좌표라 카드가 뒤집혀 있어도 좌우가 뒤바뀌지 않는다
    const org = from && `${(from.offsetLeft + from.offsetWidth / 2).toFixed(1)}px ` +
                        `${(from.offsetTop + from.offsetHeight / 2).toFixed(1)}px`;
    pick.hidden = true;
    play.hidden = false;
    const pane = $('#ovTpl').content.firstElementChild.cloneNode(true);
    if (org) pane.style.transformOrigin = org;
    pane.querySelector('.ov-title').textContent = c.title;
    pane.querySelector('.ov-total').textContent = '/' + c.items.length;
    pane.querySelector('.ov-time').textContent =
      Math.floor(opt.time / 60) + ':' + String(opt.time % 60).padStart(2, '0');
    play.append(pane);
    // 자리를 잡은 다음 프레임에 켠다 — 같은 프레임에 켜면 커지는 과정이 없다
    requestAnimationFrame(() => {
      if (n === gen && card.dataset.flip === 'true') card.dataset.preview = '1';
    });
    pane.querySelector('.ov-start').focus();
    const [, geom] = await load(c.slug);
    await sprite;
    if (n !== gen) return;
    const items = c.items.map(it => ({ ...it }));
    const svg = pane.querySelector('.ov-map');
    const asRoad = opt.road && geom.slots;
    svg.classList.toggle('road', !!asRoad);
    if (asRoad) drawRoad(svg, geom, items, {});
    else {
      svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
      drawDots(svg, geom, items);
    }
    if (c.mode === 'sequence' && items[0] && items[0].el) items[0].el.classList.add('target');
    wireBack(card, pane, c.slug, geom, items);
  };
  back.querySelector('.ov-courses').onclick = e => {
    const b = e.target.closest('[data-slug]');
    if (!b) return;
    showPlay(courses.find(c => c.slug === b.dataset.slug), b);
  };
  card._showPick = showPick;
  card._resetPick = () => showPick(true);
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const drum = document.querySelector('.wheel[data-on]');
  if (drum) { closeWheel(drum); return; }
  const open = document.querySelector('.card[data-flip="true"]');
  if (!open) return;
  const play = open.querySelector('.ov-play');
  if (play && !play.hidden && open._showPick) { open._showPick(); return; }
  flip(open, false);
});

/* ── 코스 로드 ──────────────────────────────────────── */
const load = slug => Promise.all([
  fetch(asset(`data/${slug}.course.json`)).then(r => r.json()),
  fetch(asset(`data/${slug}.geom.json`)).then(r => r.json())
]);

(async () => {
  saveOpt();
  const regions = $('#regionList');
  for (const r of REGIONS) {
    const [, geom] = await load(r.thumb);
    const courses = [];
    for (const slug of r.courses) {
      const [c] = await load(slug);
      courses.push(c);
    }
    const li = document.createElement('li');
    li.innerHTML = `<div class="card" data-flip="false">
        <button type="button" class="card-face card-front" aria-expanded="false">
          <span class="card-top"><span class="thumb"></span></span>
          <span class="card-body"><b></b><em></em><span class="desc"></span></span>
        </button>
      </div>`;
    const thumb = li.querySelector('.thumb');
    const drawThumb = () => thumb.innerHTML = thumbSvg(geom);
    REDRAW.push(drawThumb); drawThumb();
    li.querySelector('b').textContent = r.title;
    li.querySelector('em').textContent = `${r.courses.length}개 코스`;
    li.querySelector('.desc').textContent = r.description;

    const card = li.querySelector('.card');
    const back = $('#regionTpl').content.firstElementChild.cloneNode(true);
    back.classList.add('card-face');
    back.querySelector('.ov-title').textContent = r.title;
    const pack = back.querySelector('.ov-courses');
    courses.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.slug = c.slug;
      b.textContent = c.title;
      pack.append(b);
    });
    card.append(back);
    back.inert = true;
    wireRegionBack(card, back, courses);
    li.querySelector('.card-front').onclick = () => flip(card, true);
    regions.append(li);
    window.addEventListener('resize', () => measureCard(card));
  }
})();

/* ── 게임 ───────────────────────────────────────────── */
let G = null, tick = null, pending = null;

async function start(slug, o = {}) {
  const zoom = o.zoom || 3;   // 1배를 없앴다 — 코스는 3배로만 돈다
  const [course, geom] = await load(slug);
  await sprite;   // 타일 심볼이 문서에 들어온 뒤에 그린다
  const items = course.items.map(it => {
    const a = stripSuffix(it.name);
    return { ...it, aliases: [...(it.aliases || []), ...(a ? [a] : [])], claimed: false };
  });
  G = { slug, course, items, zoom, seq: course.mode === 'sequence', idx: 0,
       total: opt.time, left: opt.time, hits: 0, tries: 0, combo: 0, best: 0, score: 0,
       cell: geom.cell };

  const svg = $('#map');
  const road = opt.road && geom.slots;
  G.road = !!road;
  svg.classList.toggle('road', !!road);
  if (road) {
    drawRoad(svg, geom, items, G);
  } else {
    svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
    drawDots(svg, geom, items, zoom > 1);   // 에셋은 확대해 볼 때만 얹는다
  }

  svg.style.setProperty('--z', zoom);   // 라벨·테두리를 역보정해 화면상 크기를 유지한다
  G.cam = svg.querySelector('.cam');
  G.roads = svg.querySelector('.roads');
  G.roadsEdge = svg.querySelector('.roads-edge');
  G.car = svg.querySelector('.car');
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  G.view = [vb[2], vb[3]];
  // 정보 줄을 먼저 비운다 — aim() 이 띄운 첫 목표를 곧바로 지워버리던 순서였다
  $('#fact').classList.remove('on');
  $('#fact').innerHTML = '';
  aim();                              // 첫 목표를 잡고 화면을 맞춘다
  $('#statTotal').textContent = '/' + items.length;
  $('#statCount').textContent = '0';
  $('#statScore').textContent = '0';
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

/* 도트 지도 — 격자 한 칸이 원 하나. 자치구 코스가 쓴다. */
/* withTiles 는 인자로 받는다. 미리보기는 게임이 시작되기 전에 이 함수를
   쓰므로 여기서 전역 G 를 보면 null 참조로 지도가 통째로 안 그려진다. */
function drawDots(svg, geom, items, withTiles = false) {
  const cells = geom.items.map(() => []);
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') cells[SYM.indexOf(ch)].push([x, y]);
  }));
  const cw = geom.cell, dr = (cw * .46).toFixed(1);
  svg.style.setProperty('--tf', (cw * .86).toFixed(1) + 'px');   // 칸을 꽉 채우게

  svg.innerHTML = '<g class="cam">' + geom.items.map((g, i) =>
    `<g id="p${i}">` + cells[i].map(([x, y], n) =>
      // --i 는 도트가 차오르는 순서. 한 구가 다 차는 데 최대 0.28초
      `<circle cx="${((x + .5) * cw).toFixed(1)}" cy="${((y + .5) * cw).toFixed(1)}"` +
      ` r="${dr}" style="--i:${Math.min(n, 40)}"/>`).join('') + '</g>').join('') +
    // 이름의 y 는 격자 줄 한가운데로 맞춘다. 줄 사이에 걸치면 위아래 도트를
    // 반씩 건드려 지저분해진다
    '<g class="tiles">' + geom.items.map((g, i) =>
      `<g id="tl${i}" class="tile"><text id="t${i}" x="${g.c[0]}"` +
      ` y="${((Math.round(g.c[1] / cw - .5) + .5) * cw).toFixed(1)}"></text></g>`
    ).join('') + '</g>' +
    '</g>';

  link(svg, geom, items);
  // 글자 상자는 화면에 올라온 뒤에야 잴 수 있다. display:none 이면 0 이 나온다
  requestAnimationFrame(() => coverDots(svg, items, cw));
}

/* 지형도 — 비트맵 격자를 가로줄 단위로 이어 붙여 서울 모양을 만든다.
   슬롯 좌표가 지리에서 나온 것이라 보드에 그대로 겹치면 자리가 맞는다. */
function landRects(geom, W, H) {
  const cw = geom.cell;
  let out = '';
  geom.grid.forEach((row, y) => {
    let run = 0;
    for (let x = 0; x <= row.length; x++) {
      if (row[x] && row[x] !== '.') { run++; continue; }
      if (run) out += `<rect x="${((x - run) * cw).toFixed(1)}" y="${(y * cw).toFixed(1)}"` +
        ` width="${(run * cw).toFixed(1)}" height="${cw.toFixed(1)}"/>`;
      run = 0;
    }
  });
  return `<g class="land" transform="scale(${(W / geom.w).toFixed(4)} ${(H / geom.h).toFixed(4)})">${out}</g>`;
}

/* ── 로드맵 (미니 모터웨이즈 방식) ─────────────────────
   도트를 쓰지 않는다. 타일을 칸에 정렬해 놓고 길로 잇는다.
   칸 하나를 CELL 로 잡고 그 안에서 타일 크기를 정한다. */
const CELL = 100;

/* ctx 에 결과를 담는다. 미리보기는 게임이 시작되기 전에 이 함수를 쓰므로
   여기서 전역 G 를 만지면 null 참조로 지도가 통째로 안 그려진다. */
function drawRoad(svg, geom, items, ctx = {}) {
  const S = geom.slots;
  const W = S.cols * CELL, H = S.rows * CELL;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.setProperty('--tf', (CELL * .17).toFixed(1) + 'px');
  ctx.grid = { cols: S.cols, rows: S.rows,
             blocked: new Set(geom.items.map(g => g.s.join(','))) };

  const order = new Map(items.map((it, n) => [it.name, n]));
  const box = geom.items.map(g => {
    const kind = kindOf(order.get(g.name), items.length);
    if (kind === 'depot') ctx.carHue = hueAt(geom.items.indexOf(g));
    const b = tileBox(kind, CELL * .62);
    const [c, r] = g.s;
    b.kind = kind;
    b.x = (c + .5) * CELL - b.mid[0];
    b.y = (r + .5) * CELL - b.mid[1];
    b.cx = (c + .5) * CELL;
    b.cy = (r + .5) * CELL;
    return b;
  });
  // 길 굵기는 꼭지 폭과 같아야 이음매가 벌어지지 않는다
  const stop = box.find(b => b.kind !== 'depot') || box[0];
  svg.style.setProperty('--road-w', stop.nub.toFixed(1) + 'px');
  svg.style.setProperty('--road-edge', (7 * stop.w / 200).toFixed(2) + 'px');

  // 먼저 항목을 이어 두어야 어느 꼭지를 쓸지 알 수 있다
  const by = new Map(geom.items.map((g, i) => [g.name, i]));
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    const b = box[i];
    it.slot = g.s; it.at = [b.cx, b.cy]; it.side = new Set();
    it.port = {};
    for (const k in b.port) it.port[k] = [b.x + b.port[k][0], b.y + b.port[k][1]];
  });
  ctx.legs = [];
  for (let n = 0; n < items.length - 1; n++) {
    const a = items[n], c = items[n + 1];
    const cells = routeCells(a.slot, c.slot, ctx.grid.blocked, S.cols, S.rows);
    let from = 'r', into = 'l';
    if (cells && cells.length > 1) {
      from = DIR(cells[0], cells[1]);
      into = OPP[DIR(cells[cells.length - 2], cells[cells.length - 1])];
    }
    a.side.add(from); c.side.add(into);
    ctx.legs.push({ cells, from, into });
  }

  // 토지 → 길 → 차 → 건물. 이 순서라야 차가 건물 아래로 지나간다
  const plotId = it => 'rt-plot-' +
    [...'lrtb'].filter(d => it.side.has(d)).join('') || 'rt-plot-lr';

  let plots = '', tops = '', blocks = '';
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name), b = box[i];
    const pos = `x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}"` +
                ` width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}"`;
    plots += `<g id="pl${i}" class="plot"><use href="#${plotId(it)}" ${pos}/></g>`;
    tops += `<g id="pt${i}" class="plot"><use href="#${plotId(it)}" ${pos}/></g>`;
    blocks += `<g id="bk${i}" class="tile c-${hueAt(i)}">` +
      `<use href="#${b.id}" ${pos}/>` +
      `<text id="t${i}" x="${(b.x + b.dx).toFixed(1)}"` +
      ` y="${(b.y + b.dy).toFixed(1)}"></text></g>`;
  });

  const show = location.search.includes('slots=1');
  const used = new Set(geom.items.map(g => g.s.join(',')));
  let grid = `<rect class="ground" x="0" y="0" width="${W}" height="${H}"/>` +
             landRects(geom, W, H) + '<g class="cells">';
  for (let r = 0; r < S.rows; r++)
    for (let c = 0; c < S.cols; c++) {
      grid += `<rect class="cell${used.has(c + ',' + r) ? ' used' : ''}" x="${c * CELL}"` +
              ` y="${r * CELL}" width="${CELL}" height="${CELL}"/>`;
      if (show) grid += `<text class="coord" x="${c * CELL + 6}" y="${r * CELL + 22}">${c},${r}</text>`;
    }
  grid += '</g>';

  svg.innerHTML = '<g class="cam">' + grid +
    `<g class="plots">${plots}</g>` +
    '<g class="roads-edge"></g><g class="roads"></g>' +
    // 길 테두리가 토지 입구를 가로지른다. 테두리 없는 토지를 덧대 이음매를 지운다
    `<g class="plots plots-top">${tops}</g>` +
    `<g class="car c-${ctx.carHue}" hidden><use href="#rt-car" x="-12" y="-21"` +
    ' width="31.5" height="45"/></g>' +
    `<g class="blocks">${blocks}</g>` +
    '</g>';

  paveAll(svg, items, ctx.legs);   // 길은 처음부터 깔려 있다. 맞히면 차가 그 위를 달린다

  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    it.el = svg.querySelector('#bk' + i);        // 건물이 곧 그 지역이다
    it.tile = it.el;
    it.plot = svg.querySelector('#pl' + i);
    it.plotTop = svg.querySelector('#pt' + i);
    it.label = svg.querySelector('#t' + i);
    if (it.label) it.label.textContent = g.name;
  });
}

/* 빈 칸만 밟아 두 칸을 잇는다. 꼭지가 네 방향이라 드나드는 방향은 자유다.
   길이 없으면 null — 부르는 쪽이 곧장 잇는다. */
function routeCells(from, to, blocked, cols, rows) {
  const key = ([c, r]) => c + ',' + r;
  const free = ([c, r]) => c >= 0 && c < cols && r >= 0 && r < rows && !blocked.has(key([c, r]));
  const goal = key(to);
  const near = ([c, r]) => Math.abs(c - to[0]) + Math.abs(r - to[1]);
  const step = ([c, r]) => [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];

  const prev = new Map([[key(from), null]]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i], k = key(cur);
    if (k === goal) {
      const path = [];
      for (let kk = k; kk; kk = prev.get(kk)) path.unshift(kk.split(',').map(Number));
      return path;
    }
    // 같은 길이면 목표에 가까운 쪽부터
    for (const n of step(cur).sort((a, b) => near(a) - near(b))) {
      const nk = key(n);
      if (prev.has(nk)) continue;
      if (nk !== goal && !free(n)) continue;   // 중간은 빈 칸만
      prev.set(nk, k); q.push(n);
    }
  }
  return null;
}

/* 꺾이는 자리마다 모서리를 둥글게 깎아 하나의 path 로 만든다 */
function roundedPath(pts, r = 20) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const r1 = Math.min(r, Math.hypot(cx - px, cy - py) / 2);
    const r2 = Math.min(r, Math.hypot(nx - cx, ny - cy) / 2);
    const a = [cx + Math.sign(px - cx) * r1, cy + Math.sign(py - cy) * r1];
    const b = [cx + Math.sign(nx - cx) * r2, cy + Math.sign(ny - cy) * r2];
    d += `L${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  const e = pts[pts.length - 1];
  return d + `L${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
}

/* 새로 깔린 길을 따라 차를 앞으로 보낸다.
   경로를 직접 재지 않고 path 에게 물어본다 — 모서리가 둥글어 계산이 어긋난다. */
function driveAlong(path, ms = 620) {
  const car = G.car;
  if (!car) return;
  const len = path.getTotalLength();
  if (!(len > 0)) return;
  car.removeAttribute('hidden');
  const t0 = performance.now();
  const put = f => {
    const p = path.getPointAtLength(len * f);
    // 진행 방향을 알려면 조금 앞을 함께 본다
    const q = path.getPointAtLength(Math.min(len, len * f + 1));
    const a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + 90;
    car.setAttribute('transform',
      `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`);
  };
  cancelAnimationFrame(G.driveId);
  const step = now => {
    const f = Math.min(1, (now - t0) / ms);
    put(f);
    if (f < 1) G.driveId = requestAnimationFrame(step);
  };
  put(0);
  G.driveId = requestAnimationFrame(step);
}

/* 코스 전체의 길을 한 번에 깐다. 미리보기용 — 진행 상태가 없다. */
function paveAll(svg, items, legs) {
  const roads = svg.querySelector('.roads'), edges = svg.querySelector('.roads-edge');
  if (!roads || !legs) return;
  for (let n = 0; n < items.length - 1; n++) {
    const p = makeRoad(items[n], items[n + 1], legs[n]);
    const edge = p.cloneNode();
    edge.setAttribute('class', 'road-edge');
    edges.append(edge); roads.append(p);
  }
}

/* 두 타일을 잇는 길 하나를 만든다. 빈 칸만 밟고, 걸어 나가는 방향의 꼭지로 드나든다. */
const DIR = (a, b) => b[0] > a[0] ? 'r' : b[0] < a[0] ? 'l' : b[1] > a[1] ? 'b' : 't';
const OPP = { l: 'r', r: 'l', t: 'b', b: 't' };

function makeRoad(a, b, leg) {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('class', 'road-line');
  const cells = leg && leg.cells;
  if (!cells || cells.length < 2) {            // 돌아갈 길이 없으면 곧장
    const right = b.at[0] >= a.at[0];
    p.setAttribute('d', roadPath(right ? a.port.r : a.port.l, right ? b.port.l : b.port.r));
    return p;
  }
  const mid = ([c, r]) => [(c + .5) * CELL, (r + .5) * CELL];
  p.setAttribute('d', roundedPath([a.port[leg.from], ...cells.slice(1, -1).map(mid),
                                   b.port[leg.into]]));
  return p;
}

/* 두 꼭지를 직각으로 잇는다. 가로 → 세로 → 가로, 모서리는 둥글게. */
function roadPath(a, b, r = 22) {
  const [ax, ay] = a, [bx, by] = b;
  if (Math.abs(ay - by) < 1) return `M${ax} ${ay}H${bx}`;
  const mx = (ax + bx) / 2, sy = Math.sign(by - ay), s1 = Math.sign(mx - ax), s2 = Math.sign(bx - mx);
  const rr = Math.min(r, Math.abs(mx - ax), Math.abs(bx - mx), Math.abs(by - ay) / 2);
  return `M${ax} ${ay}H${mx - s1 * rr}Q${mx} ${ay} ${mx} ${ay + sy * rr}` +
         `V${by - sy * rr}Q${mx} ${by} ${mx + s2 * rr} ${by}H${bx}`;
}

/* 이름을 격자에 앉히고, 그 자리 도트를 찾아 둔다.
   글자가 몇 칸을 차지하는지 재서 그 칸들의 한가운데로 옮긴다. 그래야
   글자가 칸 경계에 걸치지 않고, 지울 도트도 칸 단위로 딱 떨어진다. */
function coverDots(svg, items, cw) {
  const cell = ([x, y]) => [Math.round(x / cw - .5), Math.round(y / cw - .5)];
  const dots = [...svg.querySelectorAll('.cam > g[id^="p"] circle')].map(c => {
    const [x, y] = [+c.getAttribute('cx'), +c.getAttribute('cy')];
    const [col, row] = cell([x, y]);
    return { el: c, col, row };
  });

  for (const it of items) {
    if (!it.label) continue;
    const b = it.label.getBBox();
    const span = Math.max(1, Math.ceil(b.width / cw));
    const start = Math.round((b.x + b.width / 2) / cw - span / 2);
    it.label.setAttribute('x', ((start + span / 2) * cw).toFixed(1));

    const row = Math.round(+it.label.getAttribute('y') / cw - .5);
    const inside = (c, r) => r === row && c >= start && c < start + span;
    const touch = (c, r) => r >= row - 1 && r <= row + 1 &&
                            c >= start - 1 && c < start + span + 1;
    it.under = dots.filter(d => inside(d.col, d.row)).map(d => d.el);
    it.shrink = dots.filter(d => !inside(d.col, d.row) && touch(d.col, d.row)).map(d => d.el);
  }
}

function link(svg, geom, items) {
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    it.el = svg.querySelector('#p' + i);
    it.tile = svg.querySelector('#tl' + i);
    // 이름표는 타일 안에 있다. 타일을 안 그리는 미리보기에서는 없다
    it.label = svg.querySelector('#t' + i);
    if (it.label) it.label.textContent = g.name;
    it.at = g.c;
  });
}

/* 지도 아래 정보 줄. 윗줄과 아랫줄을 따로 갱신한다 —
   '보임'에서는 윗줄이 지금 칠 곳, 아랫줄이 직전에 맞힌 곳의 설명이 된다. */
function say(head, body) {
  const f = $('#fact');
  if (!f.firstElementChild) f.innerHTML = '<span></span>';
  if (body !== undefined) f.querySelector('span').textContent = body;
  if (head !== undefined) setTarget(head);
  f.classList.add('on');
}

/* 칠 이름을 글자 하나씩 늘어놓는다. 이 자체가 입력창이다 —
   맞게 친 글자만 색이 차오른다. */
function setTarget(name) {
  const box = $('#typing');
  box.replaceChildren();
  G.want = name;
  for (const ch of name) {
    const el = document.createElement('b');
    el.textContent = ch;
    box.append(el);
  }
  box.classList.remove('bad');
  box.classList.toggle('hide', !opt.hint);   // 숨김이면 글자를 가리고 친 만큼만 드러난다
  paintTyped('');
}

/* 지금까지 친 것을 그대로 보여준다.
   맞은 글자는 색이 차고, 지금 치는 자리에는 조합 중인 자모(ㄱ, 가)가
   그대로 뜬다. 조합 중인지 아닌지는 input 이벤트가 알려준다 —
   자모 표를 들고 맞춰볼 필요가 없다. */
function paintTyped(raw, composing = false) {
  const box = $('#typing');
  if (!G.want) return;
  const buf = raw.replace(/\s/g, '');
  // 앞에 붙은 찌꺼기를 흘려보낸다. 스페이스로 확정할 때 IME 가 조합을 끝내며
  // 비운 입력창에 글자를 도로 넣는 일이 있어, 앞에서부터만 비교하면 그 뒤로
  // 영영 색이 안 찬다. 정답 판정이 접미를 훑는 것과 같은 방식이다.
  let n = 0, rest = buf;
  for (let i = 0; i < buf.length; i++) {
    const sub = buf.slice(i);
    let k = 0;
    while (k < sub.length && k < G.want.length && sub[k] === G.want[k]) k++;
    if (k > n || i === 0) { n = k; rest = sub.slice(k); }
    if (n === G.want.length) break;
  }
  const ing = composing && rest.length === 1;   // 아직 만들어지는 중인 한 글자
  [...box.children].forEach((el, i) => {
    el.classList.toggle('on', i < n);
    const live = i === n && rest && (ing || !composing);
    el.classList.toggle('ing', !!live);
    el.textContent = live ? rest[0] : G.want[i];
    // 커서는 방금 친 것 바로 뒤에 선다
    el.classList.toggle('cur-l', i === n && !live);
    el.classList.toggle('cur-r', !!live || (n >= G.want.length && i === G.want.length - 1));
  });
  // 조합이 끝났는데도 안 맞으면 오타다
  box.classList.toggle('bad', rest.length > 0 && !ing);
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
  // 이름과 설명은 언제나 같은 곳을 가리켜야 한다. 치는 동안 그곳을 읽게 된다
  if (t) say(promptName(t), t.meta.description);
  $('#fact').classList.toggle('aim', !!t);
  G.items.forEach(i => {
    if (!i.label) return;
    const show = i.claimed || (opt.hint && (!G.seq || i === t));
    i.label.classList.toggle('on', show);
  });
  const [W, H] = G.view, z = G.zoom;
  let tx = 0, ty = 0;
  if (t) {
    // 지도 밖 빈 공간이 보이지 않게 가둔다. z=1 이면 범위가 0 하나뿐이다
    tx = Math.min(0, Math.max(W - z * W, W / 2 - z * t.at[0]));
    ty = Math.min(0, Math.max(H - z * H, H / 2 - z * t.at[1]));
  }
  G.cam.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${z})`);
  followGrid(600);
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

/* 스페이스로 확정한다.
   keydown 으로 스페이스를 가로채면 한글 조합 확정 자체가 깨지므로
   (조합 중 스페이스는 isComposing:true 로 먼저 온다) 가로채지 않고
   입력값에 들어온 공백을 보고 판단한다. */
/* 입력창은 1x1 로 숨겨 두었다. 다른 데를 클릭하면 포커스가 빠져나가
   타이핑이 먹지 않으므로, 플레이 화면을 누르면 되돌린다.
   pointerdown 에서 기본 동작을 막아야 포커스가 딴 데로 가지 않는다. */
$('#play').addEventListener('pointerdown', e => {
  if (e.target.closest('button, a, input, select, textarea')) return;
  e.preventDefault();
  $('#typein').focus();
});

/* 지금 칠 수 있는 상태인지 눈에 보이게 한다 */
const markFocus = () => $('#typing').classList.toggle('off', document.activeElement !== $('#typein'));
$('#typein').addEventListener('focus', markFocus);
$('#typein').addEventListener('blur', markFocus);

$('#typein').addEventListener('input', e => {
  if (!G || !tick) return;
  paintTyped(e.target.value, e.isComposing);
  if (!/\s/.test(e.target.value)) return;        // 스페이스 전에는 판단하지 않는다
  const answer = e.target.value.replace(/\s+/g, '');
  e.target.value = '';
  if (!answer) return;                            // 빈 스페이스는 그냥 넘긴다
  // 미점령 전체를 대상으로 판정한 뒤 목표인지 본다. 목표만 넘기면
  // 약칭의 경쟁 판정(중 → 중구/중랑구)이 무너진다.
  const hit = matchInput(answer, G.items, opt.strict);
  if (!hit || (G.seq && hit !== target())) return miss();
  claim(hit);
});

function miss() {
  $('#typein').value = '';
  paintTyped('');
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
  if (it.label) it.label.classList.add('on');
  if (it.tile) it.tile.classList.add('built');
  if (it.plot) it.plot.classList.add('built');
  if (it.plotTop) it.plotTop.classList.add('built');
  if (it.under) it.under.forEach(c => c.classList.add('under'));
  if (it.shrink) it.shrink.forEach(c => c.classList.add('near'));
  if (G.road && G.prev) {
    const p = G.roads.children[G.idx - 1];   // 길은 이미 깔려 있다
    if (p) driveAlong(p);
  }
  if (G.road) G.prev = it;
  G.hits++; G.tries++; G.combo++;
  G.score += 100 * Math.min(5, G.combo);   // ponytail: 콤보 배율만. 인지도 역수(weight) 데이터 확보되면 항목별 배점으로 교체
  $('#statCount').textContent = G.hits;
  $('#statScore').textContent = G.score;
  if (it.tile) { it.tile.classList.remove('pop'); void it.tile.getBBox(); it.tile.classList.add('pop'); }
  const cb = $('#statCombo');
  cb.textContent = G.combo > 1 ? '×' + Math.min(5, G.combo) : '';
  cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump');
  setTimeout(() => cb.classList.remove('bump'), 160);
  // 순서형은 바로 뒤 aim() 이 다음 목표의 이름과 설명으로 갈아끼운다
  if (!G.seq) say(it.name, it.meta.description);
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
  svg.insertAdjacentHTML('afterbegin', '<style>' +
    `circle{fill:${land}}g.got circle{fill:${acc}}g.miss circle{fill:${land}}` +
    'text{display:none}</style>');
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

  console.log('self-check done');
}
