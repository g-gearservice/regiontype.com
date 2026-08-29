/* regiontype — 서울 자치구 자유형. 코스 데이터는 data/*.json 에서 읽는다. */
'use strict';

const $ = s => document.querySelector(s);
const VER = '0.68';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
/* 설정 화면의 빌드 번호는 VER 에서 직접 읽는다. 손으로 적어두면 올릴 때마다
   맞춰야 할 자리가 하나 더 늘고, 언젠가 실제 빌드와 어긋난다. */
$('#verBuild').textContent = VER;
const REGIONS = [
  {
    id: 'seoul',
    title: '서울',
    description: '한강이 가로지르는 수도. 25개 자치구부터 423개 행정동까지.',
    thumb: 'seoul-gu',
    courses: ['seoul-gu', 'gangseo-dong', 'dobong-dong', 'dongdaemun-dong', 'dongjak-dong', 'eunpyeong-dong', 'gangbuk-dong', 'gangdong-dong', 'gangnam-dong', 'geumcheon-dong', 'guro-dong', 'gwanak-dong', 'gwangjin-dong', 'jongno-dong', 'jung-dong', 'jungnang-dong', 'mapo-dong', 'nowon-dong', 'seocho-dong', 'seodaemun-dong', 'seongbuk-dong', 'seongdong-dong', 'songpa-dong', 'yangcheon-dong', 'yeongdeungpo-dong', 'yongsan-dong']
  }
];
const SYM = '0123456789abcdefghijklmnopqrstuvwxyz';   // 도트 격자의 자치구 번호
let PM = null;   // 타이틀 픽셀맵 메타. 배경 격자를 비트 칸에 맞출 때 쓴다.

/* ── 설정 ───────────────────────────────────────────── */
const TIMES = [60, 90, 120, 180, 300];
const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const DEF = { time: 120, night: false, sound: true, motion: true, hint: true, grid: true };
const opt = Object.assign({}, DEF, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
for (const k of Object.keys(opt)) if (!(k in DEF)) delete opt[k];

/* mimi 는 아직 내부용이다. 로컬에서만 문을 열어 둔다. CSS 기본이 숨김이라
   배포에서 잠깐 보였다 사라지는 일이 없다 — 여는 쪽에만 표시를 남긴다. */
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:') {
  document.documentElement.dataset.dev = '';
}

const saveOpt = () => {
  localStorage.setItem('rt.opt', JSON.stringify(opt));
  document.documentElement.toggleAttribute('data-night', opt.night);
  document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
  document.documentElement.toggleAttribute('data-no-grid', !opt.grid);
  REDRAW.forEach(f => f());
  requestAnimationFrame(syncGrid);
  document.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-pressed', !!opt[b.dataset.opt]));
};

const REDRAW = [];
const dot = (x, y, cell, cls) => {
  const a = cls ? ` class="${cls}"` : '';
  return `<circle cx="${((x + .5) * cell).toFixed(2)}" cy="${((y + .5) * cell).toFixed(2)}" r="${(cell * .46).toFixed(2)}"${a}/>`;
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
function matchInput(raw, items) {
  const buf = raw.replace(/\s/g, '');
  for (let i = 0; i < buf.length; i++) {
    const sub = buf.slice(i);
    const open = items.filter(it => !it.claimed);
    const exact = open.find(it => it.name === sub);
    if (exact) return exact;
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
    if (!pm || !$('#title.on, #options.on')) return;
    root = space = pm; cell = 1;
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
});

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
  let bits = [];
  const bindBits = () => {
    bits = [...svg.querySelectorAll('circle')].map(el => ({
      el, x: +el.getAttribute('cx'), y: +el.getAttribute('cy'),
      seoul: el.classList.contains('seoul')
    }));
  };
  const draw = () => {
    svg.innerHTML = g.rows.flatMap((row, y) =>
      [...row].map((ch, x) => ch === '.' ? '' : dot(x, y, 1, ch === 'S' ? 'seoul' : ''))).join('');
    bindBits();
  };
  REDRAW.push(draw); draw();
  requestAnimationFrame(() => requestAnimationFrame(syncGrid));

  /* 타이틀 맵 근접장. 포인터는 창에서 읽고 SVG 유저 좌표로 옮긴다.
     #pixelmap 은 pointer-events:none 이라 클릭을 가로채지 않는다. */
  const R = 1.8, HOVER = 0.62;
  let mx = 0, my = 0, raf = 0;
  const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
  const skipScale = () => document.documentElement.dataset.motion === 'off'
    || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clearBit = b => {
    b.el.style.transform = '';
    b.el.style.fill = '';
    b.el.style.opacity = '';
  };
  const paint = () => {
    raf = 0;
    if (!fine() || !bits.length) return;
    if (!$('#title.on, #options.on')) { bits.forEach(clearBit); return; }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = mx; pt.y = my;
    const p = pt.matrixTransform(ctm.inverse());
    const noScale = skipScale();
    for (const b of bits) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d >= R) { clearBit(b); continue; }
      const t = 1 - d / R;
      /* 서울은 이미 강조색에 불투명하다. 근접장의 색·투명도까지 씌우면 바닥을
         0.38 로 잡은 식이 서울을 되레 흐리게 만든다 — 크기만 반응시킨다. */
      if (!b.seoul) {
        b.el.style.fill = 'var(--accent)';
        b.el.style.opacity = d < HOVER ? '1' : String(0.38 + 0.62 * t);
      }
      b.el.style.transform = noScale ? ''
        : (d < HOVER ? 'scale(1)' : `scale(${1 - 0.5 * t * t})`);
    }
  };
  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
});

/* 카드 상단은 흰 원 없이 도트만. 빈 칸을 잘라 초록 면을 채운다 */
function thumbSvg(geom, fit = 'slice') {
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
    ` preserveAspectRatio="xMidYMid ${fit}">${dots.join('')}</svg>`;
}

/* 고르는 지도 — 구마다 도트를 한 묶음으로 싸서 통째로 누를 수 있게 한다.
   thumbSvg 는 구 구분 없이 점만 뿌리므로 여기서 따로 그린다. */
function pickMapSvg(geom) {
  const cells = geom.items.map(() => []);
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') cells[SYM.indexOf(ch)].push([x, y]);
  }));
  /* 도트 사이 빈틈에서도 그 구가 잡혀야 한다. 칸을 통째로 이은 판을 밑에 깔고
     칠하지 않은 채 클릭만 받게 한다(fill:none + pointer-events:all). */
  const skin = i => {
    const c = geom.cell;
    return cells[i].map(([x, y]) =>
      `M${(x * c).toFixed(1)} ${(y * c).toFixed(1)}h${c.toFixed(1)}v${c.toFixed(1)}h-${c.toFixed(1)}z`
    ).join('');
  };
  return `<svg viewBox="0 0 ${geom.w} ${geom.h}" preserveAspectRatio="xMidYMid meet">` +
    geom.items.map((g, i) =>
      `<g class="gu" role="button" tabindex="0" data-gu="${g.name}" aria-label="${g.name}">` +
      `<path class="hit" d="${skin(i)}"/>` +
      cells[i].map(([x, y]) => dot(x, y, geom.cell, '')).join('') + '</g>').join('') +
    '</svg>';
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
  if (!hint) return;
  const paint = () => {
    hint.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!opt.hint));
    pane.querySelector('.ov-time').textContent = clock(opt.time);
  };
  wireTimeWheel(pane, paint);
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
      // 고르는 판으로 돌아오면 읽던 구 이름도 처음으로 되돌린다
      const nm = pick.querySelector('.pickname');
      if (nm) nm.textContent = nm.dataset.idle;
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
    if (n !== gen) return;
    const items = c.items.map(it => ({ ...it }));
    const svg = pane.querySelector('.ov-map');
    svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
    drawDots(svg, geom, items);
    if (c.mode === 'sequence' && items[0] && items[0].el) items[0].el.classList.add('target');
    wireBack(card, pane, c.slug, geom, items);
  };
  pick.onclick = e => {
    const b = e.target.closest('[data-slug]');
    if (!b) return;
    /* 미리보기가 자라날 원점. SVG 묶음에는 offset 좌표가 없어 지도 판을 대신 넘긴다 */
    showPlay(courses.find(c => c.slug === b.dataset.slug),
             b.offsetParent === undefined ? b.closest('.pickmap') : b);
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
const grab = url => fetch(asset(url)).then(r => r.json());
const loadCourse = slug => grab(`data/${slug}.course.json`);
const loadGeom = slug => grab(`data/${slug}.geom.json`);
const load = slug => Promise.all([loadCourse(slug), loadGeom(slug)]);

(async () => {
  saveOpt();
  const regions = $('#regionList');
  for (const r of REGIONS) {
    /* 코스 26개를 줄줄이 기다리면 지역 화면이 그만큼 늦게 뜬다. 한꺼번에 받는다.
       지형은 서울 지도 하나면 된다 — 구를 지도에서 짚으니 코스별 썸네일이 필요 없다. */
    const [geom, courses] = await Promise.all([
      loadGeom(r.thumb),
      Promise.all(r.courses.map(loadCourse))
    ]);

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
    li.querySelector('.card-body b').textContent = r.title;
    li.querySelector('.card-body em').textContent = `${r.courses.length}개 코스`;
    li.querySelector('.desc').textContent = r.description;

    const card = li.querySelector('.card');
    const back = $('#regionTpl').content.firstElementChild.cloneNode(true);
    back.classList.add('card-face');
    card.append(back);
    back.inert = true;

    /* 카드를 돌리면 뒷면이 서울 비트맵이다. 목록에서 구 이름을 찾는 것보다
       지도에서 짚는 게 빠르고, 어디인지가 곧 무엇인지다. */
    const bySlug = new Map(courses.map(c => [c.slug, c]));
    const byGu = new Map();
    courses.forEach(c => {
      const m = /^(\S+구)\s/.exec(c.title);
      if (m && c.slug.endsWith('-dong')) byGu.set(m[1], c.slug);
    });

    const pane = back.querySelector('.pickmap');
    const drawPick = () => {
      pane.innerHTML = pickMapSvg(geom);
      pane.querySelectorAll('.gu').forEach(g => {
        const slug = byGu.get(g.dataset.gu);
        if (slug) g.dataset.slug = slug;
        else { g.classList.add('off'); g.removeAttribute('tabindex'); g.removeAttribute('role') }
      });
    };
    REDRAW.push(drawPick); drawPick();

    /* 이름 25개를 지도에 다 얹으면 서로 밟는다. 짚는 곳만 아래 한 줄로 읽는다. */
    const name = back.querySelector('.pickname');
    const idle = '구를 눌러 행정동 코스로';
    name.dataset.idle = idle;
    name.textContent = idle;
    const tell = g => {
      const c = g && g.dataset.slug && bySlug.get(g.dataset.slug);
      name.textContent = c ? `${c.title} · ${c.items.length}곳` : idle;
    };
    pane.addEventListener('pointerover', e => tell(e.target.closest('.gu')));
    pane.addEventListener('pointerout', () => tell(null));
    /* SVG 묶음은 초점을 받아도 focus 이벤트를 아예 안 쏜다(활성 요소만 바뀐다).
       Tab 은 키를 뗄 때 새 초점 위에서 keyup 이 나므로 그걸로 읽는다. */
    pane.addEventListener('keyup', e => {
      const g = e.target.closest && e.target.closest('.gu');
      if (g) tell(g);
    });
    /* SVG 묶음은 버튼이 아니라 Enter·Space 가 저절로 눌리지 않는다 */
    pane.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest('.gu[data-slug]');
      if (!g) return;
      e.preventDefault();
      g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    back.querySelector('.course.wide').textContent =
      `${bySlug.get('seoul-gu').title} · 25곳`;

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
  const items = course.items.map(it => {
    const a = stripSuffix(it.name);
    // 한 줄 소개는 아직 사람이 안 쓴 코스가 있다. 여기서 한 번만 채워 두면
    // 목표 줄·자유형·결과 목록이 저마다 undefined 를 막을 필요가 없다
    return { ...it, meta: { description: '', ...it.meta },
             aliases: [...(it.aliases || []), ...(a ? [a] : [])], claimed: false };
  });
  G = { slug, course, items, zoom, seq: course.mode === 'sequence', idx: 0,
       total: opt.time, left: opt.time, hits: 0, tries: 0, combo: 0, best: 0, score: 0,
       cell: geom.cell };

  const svg = $('#map');
  svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
  drawDots(svg, geom, items);

  svg.style.setProperty('--z', zoom);   // 라벨·테두리를 역보정해 화면상 크기를 유지한다
  G.cam = svg.querySelector('.cam');
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

/* 도트 지도 — 격자 한 칸이 원 하나. */
function drawDots(svg, geom, items) {
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

  link(svg, geom, items, cells);
  // 글자 상자는 화면에 올라온 뒤에야 잴 수 있다. display:none 이면 0 이 나온다
  requestAnimationFrame(() => coverDots(svg, items, cw));
}

/* 이름을 격자에 앉힌다. 자리는 자기 구역이 실제로 깔린 줄 중에서 고르되,
   이미 다른 이름이 차지한 칸은 피한다 — 붙어 있는 화곡1·2·8동처럼 무게중심이
   몰린 구역들이 같은 줄에 겹쳐 찍히던 문제를 여기서 끊는다. */
function placeLabels(items, cw) {
  const taken = [];
  // 글자끼리 한 칸은 띄운다. 딱 붙으면 두 이름이 한 단어처럼 읽힌다
  const free = (row, a, b) => !taken.some(t => t.row === row && a - 1 < t.b && t.a < b + 1);
  const base = cw * .86;   // --tf 와 같은 값. 줄여 앉힐 때 여기서 깎는다

  // 고를 자리가 적은 구역부터 앉힌다. 넓은 구역은 나중에도 갈 데가 많다
  const order = items.filter(i => i.label && i.cells && i.cells.length)
                     .sort((x, y) => x.cells.length - y.cells.length);

  for (const it of order) {
    const home = Math.round(it.at[1] / cw - .5);
    // 자기 구역이 깔린 줄만 후보다. 남의 땅에 이름을 얹으면 더 헷갈린다
    const rows = new Map();
    for (const [x, y] of it.cells) {
      const r = rows.get(y);
      if (r) { r[0] = Math.min(r[0], x); r[1] = Math.max(r[1], x + 1) }
      else rows.set(y, [x, x + 1]);
    }
    const near = [...rows].sort((p, q) => Math.abs(p[0] - home) - Math.abs(q[0] - home));

    /* 제자리에 빈 줄이 없으면 글자를 줄여 다시 본다. 좁은 구가 스무 개씩 붙어 있는
       송파·강남에서는 원래 크기로는 모두를 앉힐 자리가 안 나온다. */
    let pick = null;
    for (const k of [1, .82, .68]) {
      it.label.style.fontSize = (base * k).toFixed(1) + 'px';
      const span = Math.max(1, Math.ceil(it.label.getBBox().width / cw));
      const spots = near.map(([row, [lo, hi]]) =>
        ({ row, start: Math.round((lo + hi) / 2 - span / 2), span }));
      const fit = spots.find(s => free(s.row, s.start, s.start + span));
      if (fit) { pick = fit; break }
      pick = spots[0];   // 못 앉으면 가장 작게 줄인 마지막 시도를 쓴다
    }

    it.label.setAttribute('x', ((pick.start + pick.span / 2) * cw).toFixed(1));
    it.label.setAttribute('y', ((pick.row + .5) * cw).toFixed(1));
    it.box = pick;
    taken.push({ row: pick.row, a: pick.start, b: pick.start + pick.span });
  }
}

/* 이름이 앉은 자리의 도트를 찾아 둔다 — 글자 밑은 지우고, 이웃한 도트는 줄인다. */
function coverDots(svg, items, cw) {
  placeLabels(items, cw);

  const dots = [...svg.querySelectorAll('.cam > g[id^="p"] circle')].map(c => ({
    el: c,
    col: Math.round(+c.getAttribute('cx') / cw - .5),
    row: Math.round(+c.getAttribute('cy') / cw - .5)
  }));

  for (const it of items) {
    if (!it.box) continue;
    const { row, start, span } = it.box;
    const inside = (c, r) => r === row && c >= start && c < start + span;
    const touch = (c, r) => r >= row - 1 && r <= row + 1 &&
                            c >= start - 1 && c < start + span + 1;
    it.under = dots.filter(d => inside(d.col, d.row)).map(d => d.el);
    it.shrink = dots.filter(d => !inside(d.col, d.row) && touch(d.col, d.row)).map(d => d.el);
  }
}

function link(svg, geom, items, cells) {
  geom.items.forEach((g, i) => {
    const it = items.find(x => x.name === g.name);
    if (!it) return;
    it.cells = cells && cells[i];
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

function fillSide(el, it, hideName) {
  if (!el) return;
  if (!it || hideName) { el.replaceChildren(); return; }
  el.innerHTML = `<span class="q-name">${promptName(it)}</span>`;
}

function paintQueue() {
  if (!G) return;
  const t = target();
  const i = t ? G.items.indexOf(t) : -1;
  fillSide($('#qPrev'), i > 0 ? G.items[i - 1] : null, false);
  fillSide($('#qNext'), i >= 0 ? G.items[i + 1] : null, !opt.hint);
}

/* 칠 이름을 글자 하나씩 늘어놓는다. 이 자체가 입력창이다 —
   맞게 친 글자만 색이 차오른다. */
function setTarget(name) {
  const box = $('#qLetters') || $('#typing');
  box.replaceChildren();
  G.want = name;
  for (const ch of name) {
    const el = document.createElement('b');
    el.textContent = ch;
    box.append(el);
  }
  $('#typing').classList.remove('bad');
  $('#typing').classList.toggle('hide', !opt.hint);
  paintTyped('');
}

/* 지금까지 친 것을 그대로 보여준다.
   맞은 글자는 색이 차고, 지금 치는 자리에는 조합 중인 자모(ㄱ, 가)가
   그대로 뜬다. 조합 중인지 아닌지는 input 이벤트가 알려준다 —
   자모 표를 들고 맞춰볼 필요가 없다. */
function paintTyped(raw, composing = false) {
  const box = $('#qLetters') || $('#typing');
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
  /* 목표를 다 맞힌 뒤에 남은 것은 IME 가 되돌려 넣은 찌꺼기다. 스페이스로 확정할
     때 조합을 끝내며 비운 입력창에 글자를 도로 넣는 일이 있다 — 그걸 칸을 늘려
     보여 주면 같은 음절이 두 번 찍힌 것처럼 된다. 다 맞혔으면 거기서 끝이다. */
  if (n >= G.want.length) rest = '';

  const ing = composing && rest.length > 0;     // 마지막 한 글자는 아직 만들어지는 중
  // 그 앞의 것들은 이미 굳은 오타다
  const bad = rest.length - (ing ? 1 : 0) > 0;

  /* 칸은 목표 글자 수에 맞춰 만들어져 있다. 오타로 길어지면 그릴 자리가 없어
     화면이 첫 오타 글자에서 굳고 — 아무리 더 쳐도 안 바뀐다 — 버퍼에 몇 자가
     쌓였는지 보이지 않아 몇 번을 지워야 할지도 알 수 없다. 넘치면 칸을 늘린다.
     한글 IME 는 스페이스 전까지 조합을 끝내지 않아 isComposing 이 계속 참이므로,
     조합 중이라고 손을 놓으면 그 사이 내내 굳어 있게 된다. */
  const need = Math.max(G.want.length, n + rest.length);
  while (box.children.length < need) box.append(document.createElement('b'));
  while (box.children.length > need) box.lastChild.remove();

  [...box.children].forEach((el, i) => {
    const typed = i >= n ? rest[i - n] : null;   // 이 자리에 실제로 친 글자
    const last = i === n + rest.length - 1;      // 방금 친 자리
    el.classList.toggle('on', i < n);
    el.classList.toggle('ing', !!typed);
    el.classList.toggle('over', i >= G.want.length);   // 목표보다 길어진 자리
    el.textContent = typed || G.want[i] || '';
    // 커서는 방금 친 것 바로 뒤에 선다
    el.classList.toggle('cur-l', i === n && !typed);
    // 다 맞게 쳤으면 마지막 글자 뒤에 선다 — 칸이 없어 cur-l 이 설 자리가 없다
    el.classList.toggle('cur-r', (!!typed && last) || (!rest.length && n >= need && i === need - 1));
  });
  $('#typing').classList.toggle('bad', bad);
  return bad;
}


/* 순서형에서 지금 쳐야 할 항목. 자유형이면 목표가 없다. */
const target = () => G.seq ? G.items[G.idx] : null;

/* 안내에 띄울 이름. 칠 수 있는 약칭만 보여준다.
   어간이 한 글자인 중구는 정식 명칭 그대로다. */
const promptName = it => stripSuffix(it.name) || it.name;

/* 현재 목표를 표시하고 카메라를 그리로 옮긴다.
   3·7배율에서는 전체가 안 보이므로 화면이 목표를 따라가야 한다. */
function aim() {
  const t = target();
  G.items.forEach(i => i.el.classList.toggle('target', i === t));
  // 이름과 설명은 언제나 같은 곳을 가리켜야 한다. 치는 동안 그곳을 읽게 된다
  if (t) say(promptName(t), t.meta.description);
  paintQueue();
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
  const hit = matchInput(answer, G.items);
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
  if (it.under) it.under.forEach(c => c.classList.add('under'));
  if (it.shrink) it.shrink.forEach(c => c.classList.add('near'));
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

/* ── 피드백 ──────────────────────────────────────────
   정적 사이트에는 GitHub 토큰을 둘 수 없다. relay/ 의 중계기가 토큰을 쥐고
   이슈를 대신 만든다 — FEEDBACK_URL 이 그 주소다. 비어 있으면 이슈 초안을
   새 탭으로 열어, 중계기가 서기 전에도 피드백이 쌓이도록 한다.
   글만으로는 재현할 수 없어 버전·주소·브라우저를 함께 싣는다. */
const FEEDBACK_URL = 'https://rt-feedback.g-gearservice.workers.dev';
const FEEDBACK_REPO = 'pistolinkr/regiontype.com';   // 코드는 없고 이슈만 받는 곳
const FB_KIND = { bug: '버그', idea: '제안', data: '지명·정보 오류' };

const fbIssue = c => {
  const lines = [c.body, '', '---', `종류: ${FB_KIND[c.kind]}`,
                 `버전: ${c.v}`, `주소: ${c.href}`, `브라우저: ${c.ua}`];
  return `https://github.com/${FEEDBACK_REPO}/issues/new`
    + `?title=${encodeURIComponent(`[${FB_KIND[c.kind]}] ${c.body.slice(0, 50)}`)}`
    + `&body=${encodeURIComponent(lines.join('\n'))}`;
};

const fbNote = $('#fbNote');
const fbSay = (msg, bad) => { fbNote.textContent = msg; fbNote.classList.toggle('bad', !!bad); };
let fbKind = 'bug';
const fbPlaceholder = () => {
  $('#fbBody').placeholder = FB_KIND[fbKind] + '내용';
};
fbPlaceholder();

$('#fbOpen').onclick = () => { fbSay(''); fbPlaceholder(); $('#feedback').showModal(); };
$('#fbClose').onclick = () => $('#feedback').close();
/* dialog 는 배경 클릭으로 닫히지 않는다. 여백은 form 이 갖고 있으니
   dialog 자신이 표적이면 곧 바깥이다. */
$('#feedback').onclick = e => { if (e.target === e.currentTarget) e.currentTarget.close(); };

$('.fb-kind').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  fbKind = b.dataset.v;
  $('.fb-kind').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  fbPlaceholder();
};

$('#fbForm').onsubmit = async e => {
  e.preventDefault();
  const body = $('#fbBody').value.trim();
  if (!body) return;
  const c = { kind: fbKind, body,
              v: VER, href: location.href, ua: navigator.userAgent };
  if (!FEEDBACK_URL) { window.open(fbIssue(c), '_blank', 'noopener'); $('#feedback').close(); return; }
  $('#fbSend').disabled = true;
  fbSay('보내는 중…');
  try {
    const r = await fetch(FEEDBACK_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
    if (!r.ok) throw new Error(r.status);
    $('#fbBody').value = '';
    fbSay('보내주셔서 고맙습니다.');
    setTimeout(() => $('#feedback').close(), 1200);
  } catch {
    fbSay('보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.', true);
  }
  $('#fbSend').disabled = false;
};

/* ── 자체 검사: rt=1 쿼리로 실행 ─────────────────────── */
if (location.search.includes('rt=1')) {
  const mk = names => names.map(n => ({ name: n, aliases: [stripSuffix(n)].filter(Boolean), claimed: false }));
  const m = (s, items) => { const r = matchInput(s, items); return r && r.name; };
  const gu = mk(['중구', '중랑구', '강남구', '강서구', '성북구', '성동구']);
  console.assert(m('중', gu) === null, '중: 중구/중랑구 미확정이어야');
  console.assert(m('중구', gu) === '중구', '중구 정확일치');
  console.assert(m('강남', gu) === '강남구', '약칭 즉시 확정');
  console.assert(m('ㅋㅋ강남', gu) === '강남구', '앞 오타는 접미 검사로 흘려보냄');
  console.assert(m('없는곳', gu) === null, '미등록');
  const one = mk(['중구', '중랑구']); one[1].claimed = true;
  console.assert(m('중', one) === null, '한 글자 어간(중)은 약칭으로 인정하지 않는다');
  const two = mk(['강서구', '강남구']); two[0].claimed = true;
  console.assert(m('강서', two) === null, '이미 점령한 곳은 다시 맞지 않는다');

  const dong = [{ name: '역삼1동', aliases: ['역삼동', '역삼1'], claimed: false },
                { name: '역삼동', aliases: [], claimed: false }];
  console.assert(m('역삼동', dong) === '역삼동', '정식 명칭 일치가 남의 별칭에 가려지면 안 된다');
  console.assert(m('역삼1', dong) === '역삼1동', '별칭은 후보가 자기 자신뿐일 때 확정');

  const fbu = fbIssue({ kind: 'bug', body: '가양1동이 오답으로 처리됨', v: '0.38',
                        href: 'https://regiontype.com/', ua: 'UA' });
  console.assert(fbu.includes(encodeURIComponent('[버그] 가양1동이 오답으로 처리됨')), '이슈 제목 = 종류 + 앞머리');
  console.assert(fbu.includes(encodeURIComponent('브라우저: UA')), '메타는 버전·주소·브라우저까지');

  console.log('self-check done');
}
