/* regiontype — 나라의 지명을 친다. 코스는 data/*.json, 화면 말은 data/i18n.json. */
'use strict';

const $ = s => document.querySelector(s);
const VER = '0.96';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
/* 설정 화면의 빌드 번호는 VER 에서 직접 읽는다. 손으로 적어두면 올릴 때마다
   맞춰야 할 자리가 하나 더 늘고, 언젠가 실제 빌드와 어긋난다. */
$('#verBuild').textContent = VER;
const SYM = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'αβγδεζηθικλμνξοπρστυφχψωàáâãäåæçèéêëìíîïñòóôõöøùúûüýþăąćčďđęěğįłńňőřśşťůźżž';
let UI_LANGS = ['ko', 'en', 'ja'];
let I18N = { ko: {}, en: {}, ja: {} };
let WORLD = { countries: [] };
let LANG_COUNTRY = {};
let HERE = { country: '', lang: '', timezone: '' };
let LANG = 'ko', COUNTRY = 'KR';

/* UI 언어 태그를 i18n 키로 맞춘다. zh-Hant·nb 처럼 두 글자만 자르면 어긋난다. */
function normLangTag(tag) {
  const t = String(tag || '').replace('_', '-').trim().toLowerCase();
  if (!t) return '';
  if (t.startsWith('zh-hant') || t === 'zh-tw' || /-tw$/.test(t)) return 'zh-hant';
  if (t.startsWith('zh-hk') || /-hk$/.test(t)) return 'zh-hk';
  if (t.startsWith('zh')) return 'zh';
  if (t.startsWith('nb') || t === 'no' || t.startsWith('no-')) return 'nb';
  return t.slice(0, 2);
}
function parseUiLang(tag) {
  if (!tag) return null;
  const raw = String(tag).replace('_', '-').trim();
  if (UI_LANGS.includes(raw)) return raw;
  const low = raw.toLowerCase();
  if (UI_LANGS.includes(low)) return low;
  const base = normLangTag(raw);
  if (UI_LANGS.includes(base)) return base;
  if ((base === 'zh-hant' || base === 'zh-hk') && UI_LANGS.includes('zh')) return 'zh';
  return null;
}
function buildLangCountry(world) {
  const map = { ko: 'KR', ja: 'JP', zh: 'CN', 'zh-hant': 'TW', 'zh-hk': 'HK' };
  for (const c of world.countries) {
    const base = normLangTag(c.lang);
    if (!map[base]) map[base] = c.id;
  }
  return map;
}
function langLabel(code) {
  /* 설정 언어 목록은 각 언어의 자기 이름(endonym)으로 보여준다 — UI 가 한국어여도
     Deutsch·日本語·ไทย 로 읽히게. Intl 은 코드를 로케일로 쓰면 그 언어 이름을 돌려준다 */
  try { return new Intl.DisplayNames([code], { type: 'language' }).of(code) || code; }
  catch { return code; }
}

const t = (key, vars) => {
  const tab = I18N[LANG] || I18N.en;
  let s = (tab && tab[key]) || I18N.en[key] || I18N.ko[key] || key;
  if (vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
};
const loc = obj => {
  if (!obj || typeof obj === 'string') return obj || '';
  return obj[LANG] || obj.en || obj.ko || Object.values(obj)[0] || '';
};
const courseLabel = c => {
  if (!c) return '';
  if (c.title && c.title !== String((c.items || []).length)) return c.title;
  return t('places', { n: (c.items || []).length });
};
const countryName = id => {
  try { return new Intl.DisplayNames([LANG], { type: 'region' }).of(id) || id; }
  catch { return id; }
};

function applyI18n(root) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

function paintUI(then) {
  document.documentElement.lang = LANG;
  /* 레일 폭이 고정이라 글자가 길어져도 셸이 흔들리지 않는다 — 그냥 다시 그린다 */
  applyI18n(document);
  document.querySelectorAll('template').forEach(tpl => applyI18n(tpl.content));
  if (then) then();
}

/* ── 설정 ───────────────────────────────────────────── */
const TIMES = [60, 90, 120, 180, 300];
const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const DEF = { time: 120, night: false, sound: true, motion: true, hint: true, grid: true,
              lang: 'auto', country: 'auto' };
const opt = Object.assign({}, DEF, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
for (const k of Object.keys(opt)) if (!(k in DEF)) delete opt[k];

/* mimi 는 아직 내부용이다. 로컬에서만 문을 열어 둔다. CSS 기본이 숨김이라
   배포에서 잠깐 보였다 사라지는 일이 없다 — 여는 쪽에만 표시를 남긴다. */
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:') {
  document.documentElement.dataset.dev = '';
}
/* 배포/개발 갈림은 이 속성 하나다. 검사에서 지웠다 붙였다 하므로 그때그때 읽는다 */
const isDev = () => document.documentElement.hasAttribute('data-dev');

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
  const m = /^(.+?)(특별자치시|특별자치도|특별시|광역시|자치구|자치시|자치도|自治区|特别行政区|特別行政區|[시군구동읍면로가]|[都道府県]|[省市縣县])$/.exec(String(name).normalize('NFC'));
  return m && m[1].length > 1 ? m[1] : null;
}
function matchInput(raw, items, spacy = false) {
  const key = s => {
    let t = String(s).normalize('NFC');
    if (!spacy) t = t.replace(/\s/g, '');
    return t.toLowerCase();
  };
  const buf = key(raw);
  for (let i = 0; i < buf.length; i++) {
    const sub = buf.slice(i);
    const open = items.filter(it => !it.claimed);
    const exact = open.find(it => key(it.name) === sub);
    if (exact) return exact;
    const alias = open.find(it =>
      it.aliases.some(a => key(a) === sub) &&
      open.every(x => x === it ||
        (!key(x.name).startsWith(sub) && !x.aliases.some(a => key(a) === sub))));
    if (alias) return alias;
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
const GRID_MIN = 120;   /* 장식 격자 칸의 화면 하한(px). about.html 의 152 와 같은 눈높이 */
function syncGrid() {
  let root, space, cell, deco = false;
  if ($('#play').classList.contains('on') && G && G.cam) {
    root = $('#map'); space = G.cam; cell = G.cell;
  } else {
    /* 타이틀 밖(설정 등)에서도 같은 격자를 다시 잰다. 픽셀맵은 화면 밖 fixed 라
       화면이 바뀌어도 자리가 같다 — 여기서 return 하면 직전 칸 크기가 굳는다.
       모바일에서는 display:none 이라 아래 CTM 이 null 로 걸러진다. */
    const pm = $('#pixelmap');
    if (!pm) return;
    root = space = pm; cell = 1; deco = true;
  }
  const ctm = space.getScreenCTM();
  if (!ctm) return;
  const a = root.createSVGPoint();
  a.x = 0; a.y = 0;
  const o = a.matrixTransform(ctm);
  a.x = cell;
  const x1 = a.matrixTransform(ctm);
  let n = Math.hypot(x1.x - o.x, x1.y - o.y);
  /* 픽셀맵 1칸은 20px 남짓이라 그대로 그으면 배경이 단색으로 뭉갠다.
     격자와 점의 결을 유지하려고 N칸마다 긋는다 — 정수배라 원점이 안 어긋난다. */
  if (deco && n > 0) n *= Math.max(1, Math.ceil(GRID_MIN / n));
  applyGrid(o.x, o.y, n);
  if (deco) syncOptShell();
}
/* .opts-shell 의 윗변을 장식 격자의 가로선에 앉힌다.
   크기는 격자에서 얻지 않는다 — 칸은 나라마다 다르고(픽셀맵 행 수에서 나온다)
   탭 글자는 언어마다 다르다. 둘 중 하나로 높이·폭을 재면 나라나 언어를 고를
   때마다 통이 뛴다. 그래서 높이는 뷰포트에서만 얻되 레일(.opts-tabs) 자연 높이를
   밑돌지 않게 하고(밑돌면 탭 다섯 칸이 잘린다), 격자에는 자리만 맞춘다.
   shell.top 은 안 쓴다: #options 가 position:fixed;inset:0 라 셸은 늘 뷰포트
   한가운데 뜬다 — 거기서 거꾸로 풀어야 계산이 자기 참조가 되지 않는다.
   --opt-no-grid 여도 격자 값 자체는 그대로 잡히니 자리는 흔들리지 않는다 */
function syncOptShell() {
  const rail = $('.opts-tabs'), p = $('#bitgrid'), head = $('#options .screen-head');
  if (!rail || !p || !rail.getClientRects().length) return;
  const cell = Number(p.getAttribute('height'));
  const railH = rail.getBoundingClientRect().height;
  if (!(cell > 0) || !(railH > 0)) return;
  const gridY = Number(p.getAttribute('y')) || 0;
  const vh = window.innerHeight;
  /* 자리는 뷰포트가 아니라 '머리글 아래'에서 잡는다 — 뒤로·제목이 절대배치라 흐름에서
     빠져 있어, 뷰포트 한가운데로 재면 글자가 얹힌 위쪽이 늘 좁아 보인다 */
  const pad = parseFloat(getComputedStyle(document.documentElement)
                          .getPropertyValue('--screen-pad-y')) || 0;
  const areaTop = (head ? head.getBoundingClientRect().bottom : pad) + pad / 2;
  const areaBottom = vh - pad;
  /* 높이는 그 자리에 한 칸 남는 만큼으로 죈다 — 남는 칸이 없으면 어느 가로선에도
     앉지 못하고 가운데에 그대로 서 버린다 */
  const h = Math.max(railH, vh * 0.56);
  const mid = areaTop + (areaBottom - areaTop - h) / 2;   // 그 자리에 가운데 놓은 윗변
  const k = Math.round((mid - gridY) / cell);
  const fits = v => v >= areaTop - 1 && v + h <= areaBottom + 1;
  // 가장 가까운 선부터, 안 되면 이웃 선, 그래도 안 되면 격자를 포기하고 가운데
  const top = [k, k + 1, k - 1].map(i => gridY + i * cell).find(fits) ?? mid;
  const st = document.documentElement.style;
  st.setProperty('--opt-shell-h', h + 'px');
  st.setProperty('--opt-shell-dy', (top - (vh - h) / 2) + 'px');
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
window.addEventListener('resize', () => {
  document.querySelectorAll('#regionList .card').forEach(measureCard);
});
document.addEventListener('click', e => {
  const drum = document.querySelector('.wheel[data-on]');
  if (drum && !drum.closest('.stat.time').contains(e.target)) closeWheel(drum);
  const open = document.querySelector('.card[data-flip="true"]');
  /* 카드탭은 카드의 형제라 카드 안에 없다. 탭을 누른 것도 카드 안을 누른 것이다 —
     이걸 빼먹으면 탭을 누를 때마다 '바깥을 눌렀다'로 읽혀 카드가 닫힌다. */
  if (open && !open.contains(e.target) && !open.parentElement.contains(e.target))
    flip(open, false);
  const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
  const tog = e.target.closest('.toggle');
  if (tog) { opt[tog.dataset.opt] = !opt[tog.dataset.opt]; saveOpt(); }
});

/* ── 타이틀 픽셀맵 ──────────────────────────────────
   고른 나라의 격자를 찍고, 강조 칸(S)만 다른 색으로 둔다. */
function expandPixelRow(row) {
  if (!row || '.xSA'.includes(row[0])) return row;
  let out = '', i = 0;
  while (i < row.length) {
    let n = 0;
    /* 문자에서 48 을 그냥 빼면 '1' - 48 = -47 이 된다. 코드포인트로 읽는다 */
    while (i < row.length && row[i] >= '0' && row[i] <= '9') n = n * 10 + (row.charCodeAt(i++) - 48);
    if (!n || i >= row.length) break;
    out += row[i++].repeat(n);
  }
  return out;
}
let pmDraw = null, pmBits = [];
function loadPixels(file) {
  return grab(file.endsWith('.json') ? file : `data/${file}.json`).then(g => {
    const rows = g.enc === 'rle' ? g.rows.map(expandPixelRow) : g.rows;
    const svg = $('#pixelmap');
    svg.setAttribute('viewBox', `0 0 ${g.anchor + 1} ${g.h}`);
    g.over = (g.w - g.anchor - 1) / g.h;
    svg.style.setProperty('--pm-over', g.over);
    const bindBits = () => {
      pmBits = [...svg.querySelectorAll('circle')].map(el => ({
        el, x: +el.getAttribute('cx'), y: +el.getAttribute('cy'),
        hilite: el.classList.contains('hilite')
      }));
    };
    const draw = () => {
      svg.innerHTML = rows.flatMap((row, y) =>
        [...row].map((ch, x) => ch === '.' ? '' : dot(x, y, 1, ch === 'S' ? 'hilite' : ''))).join('');
      bindBits();
    };
    if (pmDraw) REDRAW.splice(REDRAW.indexOf(pmDraw), 1);
    pmDraw = draw;
    REDRAW.push(draw); draw();
    requestAnimationFrame(() => requestAnimationFrame(syncGrid));
  }).catch(() => {});
}
{
  const svg = $('#pixelmap');
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
    if (!fine() || !pmBits.length) return;
    if (!$('#title.on')) { pmBits.forEach(clearBit); return; }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = mx; pt.y = my;
    const p = pt.matrixTransform(ctm.inverse());
    const noScale = skipScale();
    for (const b of pmBits) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d >= R) { clearBit(b); continue; }
      const k = 1 - d / R;
      /* 강조 칸은 이미 불투명하다. 근접장의 색·투명도까지 씌우면 바닥을
         0.38 로 잡은 식이 되레 흐리게 만든다 — 크기만 반응시킨다. */
      if (!b.hilite) {
        b.el.style.fill = 'var(--accent)';
        b.el.style.opacity = d < HOVER ? '1' : String(0.38 + 0.62 * k);
      }
      b.el.style.transform = noScale ? ''
        : (d < HOVER ? 'scale(1)' : `scale(${1 - 0.5 * k * k})`);
    }
  };
  window.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
}

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

function wireRegionBack(card, back, courses, rail) {
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
    pane.querySelector('.ov-title').textContent = courseLabel(c);
    pane.querySelector('.ov-total').textContent = '/' + c.items.length;
    pane.querySelector('.ov-time').textContent = clock(opt.time);
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
    /* 미리보기는 늘 1배라 카메라를 따로 놓지 않는다 */
    wireDock(pane);
    pane.querySelector('.ov-start').onclick = () => { flip(card, false); start(c.slug); };
  };
  pick.onclick = e => {
    const b = e.target.closest('[data-slug]');
    if (!b) return;
    /* 미리보기가 자라날 원점. SVG 묶음에는 offset 좌표가 없어 지도 판을 대신 넘긴다 */
    showPlay(courses.find(c => c.slug === b.dataset.slug),
             b.offsetParent === undefined ? b.closest('.pickmap') : b);
  };
  wireRank(card, back, courses, showPick, rail);
  card._showPick = showPick;
  card._resetPick = () => showPick(true);
}

/* ── 카드 옆 순위 칸 ──────────────────────────────────
   결과 화면의 순위표는 판이 끝나야 보인다. 여기선 치기 전에 남들이 어디쯤
   몰려 있는지를 먼저 본다 — 겨룰 상대가 보여야 겨룰 마음이 든다.
   판은 (코스, 제한 시간) 이라 화살표로 코스를 넘기고 시간은 설정을 따른다. */
function wireRank(card, back, courses, showPick, rail) {
  const pane = back.querySelector('.ov-rank');
  const pick = back.querySelector('.ov-pick');
  const list = pane.querySelector('.rank-list');
  const say = (t, bad) => {
    const p = pane.querySelector('.rank-say');
    p.textContent = t; p.classList.toggle('bad', !!bad);
  };
  let at = Math.max(0, courses.findIndex(c => c.slug === (card.dataset.main || courses[0]?.slug)));
  let gen = 0;

  /* 막대는 그 판에서 나올 수 있는 최고 점수까지 그린다. 사람이 몰린 자리만
     그리면 판마다 가로 눈금이 달라져 서로 견줄 수 없다. */
  function plot(d) {
    const box = pane.querySelector('.rank-plot');
    const n = new Map(d.bins.map(b => [b.b, b.n]));
    const last = Math.max(0, Math.ceil(d.cap / d.bucket) - 1);
    const tall = Math.max(1, ...d.bins.map(b => b.n), 1);
    const W = 300, H = 100, w = W / (last + 1);
    let bars = '';
    for (let i = 0; i <= last; i++) {
      const h = (n.get(i) || 0) / tall * (H - 2);
      bars += `<rect x="${(i * w).toFixed(2)}" y="${(H - h).toFixed(2)}" ` +
              `width="${Math.max(.4, w - 1).toFixed(2)}" height="${h.toFixed(2)}"/>`;
    }
    const x = d.score === null ? null
      : Math.min(W - .5, d.score / d.bucket * w + w / 2);
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
      + `<g class="bars">${bars}</g>`
      + (x === null ? '' : `<g class="me"><line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${H}"/></g>`)
      + `</svg>`;
  }

  async function draw() {
    const n = ++gen, c = courses[at];
    pane.querySelector('.rank-title').textContent = courseLabel(c);
    pane.querySelector('.rank-where').textContent = clock(opt.time);
    pane.querySelector('.rank-score').textContent = '';
    pane.querySelector('.rank-you').textContent = '';
    pane.querySelector('.rank-plot').replaceChildren();
    list.replaceChildren();
    say(t('reading'));
    if (!FEEDBACK_URL) return say(t('noBoard'), true);
    try {
      const play = { c: c.slug, t: opt.time };
      const [d, t] = await Promise.all([
        boardAsk('/dist', { ...play }),
        boardAsk(`/top?c=${encodeURIComponent(play.c)}&t=${play.t}`),
      ]);
      if (n !== gen) return;
      plot(d);
      drawRanks(t.top || [], list);
      /* 등수는 서버가 센 값으로만 적는다. 막대에서 눈대중한 자리를 숫자로 적으면
         보이는 것과 실제가 어긋난다. */
      /* 판이 빈 것과 내가 안 올린 것은 다른 말이다. 이름을 안 적었으면 그 말을
         해줘야 한다 — 안 그러면 한 판 치고 와서 "아직 아무도" 를 보고
         순위표가 고장났다고 읽는다. */
      const joined = !!localStorage.getItem(NAME_KEY);
      pane.querySelector('.rank-you').textContent = d.score !== null
        ? t('rankYou', { pct: Math.max(1, Math.round((d.over + 1) / d.total * 100)),
                         total: d.total, rank: d.over + 1 })
        : !joined ? t('rankNeedName')
        : d.total ? t('rankOthers', { n: d.total })
        : t('rankEmpty');
      if (d.score !== null) pane.querySelector('.rank-score').textContent = d.score + t('scoreUnit');
      say('');
    } catch { if (n === gen) say(t('rankFail'), true); }
  }

  /* 탭을 누르면 카드가 실제로 한 번 돈다. 칸을 제자리에서 갈아끼우면 같은 자리가
     내용만 바뀐 것으로 읽히지만, 반 바퀴 돌려 모로 선 순간에 갈아끼우면 카드의
     다른 면을 넘긴 것이 된다 — 탭이 책갈피인 이유가 그때 살아난다.
     모션을 끈 사람에게는 --flip 이 0 이라 돌지 않고 그냥 바뀐다. */
  const turn = (el, from, to, ms) => el.animate(
    [{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }],
    { duration: ms, easing: 'cubic-bezier(.77,0,.175,1)', fill: 'both' });

  const mark = on => rail.querySelectorAll('.rail-b').forEach(b =>
    b.setAttribute('aria-selected', (b.dataset.pane === 'rank') === on));

  let turning = false;
  const open = async on => {
    if (turning) return;
    mark(on);
    /* 이미 그 칸이면 돌지 않는다 — 같은 탭을 두 번 눌러 카드를 돌릴 이유가 없다.
       순위 칸이 보이는 상태가 곧 on 이므로 pane.hidden 의 반대와 견준다. */
    if (on !== pane.hidden) return;
    const half = flipMs() / 2;
    const from = pane.hidden ? pick : pane;
    turning = true;
    if (half > 0) await turn(from, 0, -90, half).finished;
    showPick(true);            // 미리보기가 열려 있었으면 먼저 접는다
    pick.hidden = on;
    pane.hidden = !on;
    card.toggleAttribute('data-rank', on);
    if (on) draw(); else gen++;
    if (half > 0) turn(on ? pane : pick, 90, 0, half);
    turning = false;
  };
  card._closeRank = () => { if (!pane.hidden) { open(false); return true } return false };

  rail.onclick = e => {
    const b = e.target.closest('.rail-b');
    if (b) open(b.dataset.pane === 'rank');
  };
  pane.querySelector('.rank-head').onclick = e => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    at = (at + Number(b.dataset.step) + courses.length) % courses.length;
    draw();
  };
  /* 이름은 공개 목록에 걸린다. 올린 사람이 거둘 손잡이가 여기 있어야 한다 —
     설정의 기록 코드 칸을 걷어내면서 이 버튼도 같이 사라지면 철회 불가가 된다. */
  pane.querySelector('.rank-drop').onclick = async () => {
    if (!FEEDBACK_URL) return say(t('noBoard'), true);
    if (!confirm(t('forgetAsk'))) return;
    try {
      const d = await boardAsk('/forget', {});
      localStorage.removeItem(NAME_KEY);
      say(d.gone ? t('forgot', { n: d.gone }) : t('forgotNone'));
      draw();
    } catch { say(t('forgetFail'), true); }
  };
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const drum = document.querySelector('.wheel[data-on]');
  if (drum) { closeWheel(drum); return; }
  const open = document.querySelector('.card[data-flip="true"]');
  if (!open) return;
  if (open._closeRank && open._closeRank()) return;
  const play = open.querySelector('.ov-play');
  if (play && !play.hidden && open._showPick) { open._showPick(); return; }
  flip(open, false);
});

/* ── 코스 로드 ──────────────────────────────────────── */
const grab = url => fetch(asset(url)).then(r => r.json());
const loadCourse = slug => grab(`data/${slug}.course.json`);
const loadGeom = slug => grab(`data/${slug}.geom.json`);
const load = slug => Promise.all([loadCourse(slug), loadGeom(slug)]);

let regionRedraw = [];

async function renderRegions() {
  regionRedraw.forEach(f => {
    const i = REDRAW.indexOf(f);
    if (i >= 0) REDRAW.splice(i, 1);
  });
  regionRedraw = [];
  const regions = $('#regionList');
  regions.replaceChildren();
  const pack = WORLD.countries.find(c => c.id === COUNTRY) || WORLD.countries[0];
  if (!pack) return;
  for (const r of pack.regions) {
    /* 코스를 줄줄이 기다리면 지역 화면이 그만큼 늦게 뜬다. 한꺼번에 받는다. */
    const [geom, courses] = await Promise.all([
      loadGeom(r.thumb),
      Promise.all(r.courses.map(loadCourse))
    ]);

    const li = document.createElement('li');
    /* 카드탭은 카드 *밖*이다. 안에 두면 카드가 제 안쪽을 잘라내(overflow:hidden)
       밖으로 못 나가고, 카드 안에 넣으면 카드와 함께 돌아 좌우가 뒤집힌다.
       카드 뒤에 적어 형제 선택자(.card ~ .rail)로 열린 상태를 읽는다. */
    li.innerHTML = `<div class="card" data-flip="false">
        <button type="button" class="card-face card-front" aria-expanded="false">
          <span class="card-top"><span class="thumb"></span></span>
          <span class="card-body"><b></b><em></em><span class="desc"></span></span>
        </button>
      </div>
      <div class="rail" role="tablist" aria-label="${t('cardView')}">
        <button type="button" class="rail-b" data-pane="pick" role="tab" aria-selected="true">
          <i class="i i-pin" aria-hidden="true"></i><span class="sr">${t('pickCourse')}</span>
        </button>
        <button type="button" class="rail-b" data-pane="rank" role="tab" aria-selected="false">
          <i class="i i-chart" aria-hidden="true"></i><span class="sr">${t('rankTab')}</span>
        </button>
      </div>`;
    const thumb = li.querySelector('.thumb');
    const drawThumb = () => thumb.innerHTML = thumbSvg(geom);
    REDRAW.push(drawThumb); regionRedraw.push(drawThumb); drawThumb();
    const title = loc(r.title) || countryName(pack.id);
    li.querySelector('.card-body b').textContent = title;
    li.querySelector('.card-body em').textContent = t('nCourses', { n: r.courses.length });
    li.querySelector('.desc').textContent = loc(r.description) || t('places', { n: courses[0]?.items.length || 0 });

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
        const slug = r.nested && byGu.get(g.dataset.gu);
        if (slug) g.dataset.slug = slug;
        else if (r.nested) {
          g.classList.add('off'); g.removeAttribute('tabindex'); g.removeAttribute('role');
        }
      });
    };
    REDRAW.push(drawPick); regionRedraw.push(drawPick); drawPick();

    /* 이름 25개를 지도에 다 얹으면 서로 밟는다. 짚는 곳만 아래 한 줄로 읽는다. */
    const name = back.querySelector('.pickname');
    const idle = r.nested ? t('idleNested') : t('idleAdmin');
    name.dataset.idle = idle;
    name.textContent = idle;
    const tell = g => {
      if (!g) { name.textContent = idle; return; }
      const c = g.dataset.slug && bySlug.get(g.dataset.slug);
      if (c) name.textContent = `${c.title} · ${t('places', { n: c.items.length })}`;
      else if (g.dataset.gu) name.textContent = g.dataset.gu;
      else name.textContent = idle;
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

    const main = bySlug.get(r.main) || courses[0];
    back.querySelector('.course.wide').dataset.slug = main.slug;
    back.querySelector('.course.wide').textContent = courseLabel(main);

    card.dataset.main = main.slug;
    wireRegionBack(card, back, courses, li.querySelector('.rail'));
    li.querySelector('.card-front').onclick = () => flip(card, true);
    regions.append(li);
  }
}

const TZ_COUNTRY = {
  'Asia/Seoul': 'KR', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Taipei': 'TW',
  'Asia/Hong_Kong': 'HK', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH',
  'Asia/Kolkata': 'IN', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
  'Europe/London': 'GB', 'Europe/Amsterdam': 'NL', 'Europe/Warsaw': 'PL',
  'Europe/Brussels': 'BE', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Helsinki': 'FI',
  'Europe/Athens': 'GR', 'Europe/Bucharest': 'RO', 'Europe/Budapest': 'HU',
  'Europe/Sofia': 'BG', 'Europe/Prague': 'CZ', 'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE', 'Europe/Istanbul': 'TR', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Buenos_Aires': 'AR',
  'America/Santiago': 'CL', 'America/Bogota': 'CO',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
  'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG',
};
const haveCountry = id => WORLD.countries.some(c => c.id === id);

function countryFromLangTag(tag) {
  const p = String(tag || '').replace('_', '-').split('-');
  if (p[1] && haveCountry(p[1].toUpperCase())) return p[1].toUpperCase();
  const base = normLangTag(tag);
  if (base === 'zh-hant' && haveCountry('TW')) return 'TW';
  if (base === 'zh-hk' && haveCountry('HK')) return 'HK';
  if (base === 'zh' && /hk/i.test(tag) && haveCountry('HK')) return 'HK';
  const hit = LANG_COUNTRY[base];
  return hit && haveCountry(hit) ? hit : null;
}

async function sense() {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 1600);
    const r = await fetch(FEEDBACK_URL + '/where', { signal: ac.signal });
    clearTimeout(to);
    if (r.ok) {
      const d = await r.json();
      HERE = { country: d.country || '', lang: d.lang || '', timezone: d.timezone || '' };
      return HERE;
    }
  } catch {}
  HERE = { country: '', lang: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '' };
  return HERE;
}

function resolveCountry() {
  /* 배포는 아직 남한만 연다 — 자동 감지도, 저장해 둔 선택도 넘기지 않는다 */
  if (!isDev() && haveCountry('KR')) return 'KR';
  if (opt.country !== 'auto' && haveCountry(opt.country)) return opt.country;
  if (HERE.country && haveCountry(HERE.country)) return HERE.country;
  for (const tag of [HERE.lang, ...(navigator.languages || []), navigator.language]) {
    const hit = countryFromLangTag(tag);
    if (hit) return hit;
  }
  if (TZ_COUNTRY[HERE.timezone] && haveCountry(TZ_COUNTRY[HERE.timezone]))
    return TZ_COUNTRY[HERE.timezone];
  return haveCountry('KR') ? 'KR' : (WORLD.countries[0] && WORLD.countries[0].id);
}

function resolveLang() {
  if (opt.lang !== 'auto' && UI_LANGS.includes(opt.lang)) return opt.lang;
  for (const tag of [HERE.lang, ...(navigator.languages || []), navigator.language]) {
    const hit = parseUiLang(tag);
    if (hit) return hit;
  }
  const pack = WORLD.countries.find(c => c.id === COUNTRY);
  const fromCountry = parseUiLang(pack && pack.lang);
  if (fromCountry) return fromCountry;
  return UI_LANGS.includes('en') ? 'en' : UI_LANGS[0];
}

/* 언어 고르기 — 지역 판(fillRegionPick)과 같은 대륙별 fieldset · 2열 라디오다 */
const LANG_CONTINENTS = [
  ['continentAsia',         ['ko', 'ja', 'zh', 'vi', 'th', 'id', 'ms']],
  ['continentEurope',       ['de', 'fr', 'it', 'nl', 'pl', 'cs', 'sv', 'nb', 'fi', 'uk', 'ro', 'hu', 'bg', 'el', 'tr']],
  ['continentNorthAmerica', ['en']],
  ['continentSouthAmerica', ['es', 'pt']],
  ['continentAfricaMena',   ['ar']],
];

function pickRow(name, value, label, cur) {
  const l = document.createElement('label');
  l.className = 'region-opt';
  const i = document.createElement('input');
  i.type = 'radio'; i.name = name; i.value = value; i.checked = value === cur;
  const s = document.createElement('span');
  s.textContent = label;
  l.append(i, s);
  return l;
}

function fillLangPick() {
  const box = $('#optLang');
  if (!box) return;
  const held = document.activeElement;
  const heldValue = held && held.name === 'rtLang' ? held.value : null;
  /* '자동' 칸은 없다 — 사용자가 하나를 짚기 전까지 opt.lang 은 'auto' 로 남고
     resolveLang() 의 i18n 리전 정책만 따른다. 지금 켜진 언어(LANG)를 체크로 보여
     줄 뿐, 짚어야 opt.lang 이 그 값으로 굳는다 */
  const cur = UI_LANGS.includes(opt.lang) ? opt.lang : LANG;
  box.replaceChildren();
  for (const [key, codes] of LANG_CONTINENTS) {
    const have = codes.filter(c => UI_LANGS.includes(c))
      .sort((a, b) => langLabel(a).localeCompare(langLabel(b)));
    if (!have.length) continue;
    const fs = document.createElement('fieldset');
    fs.className = 'region-group';
    const lg = document.createElement('legend');
    lg.textContent = t(key);
    const grid = document.createElement('div');
    grid.className = 'region-grid';
    have.forEach(code => grid.append(pickRow('rtLang', code, langLabel(code), cur)));
    fs.append(lg, grid);
    box.append(fs);
  }
  if (heldValue) {
    const back = box.querySelector('input[name="rtLang"][value="' + heldValue + '"]');
    if (back) back.focus();
  }
}

/* 손으로 지은 코스(제목·한 줄 소개가 붙은 지역)를 가진 나라만 정식이다.
   나머지는 tools 가 찍은 admin-1 뿐이라 미리보기. 데이터에 status 를 새로
   심지 않고 이미 있는 것에서 읽는다 */
const countryStage = id => {
  const pack = WORLD.countries.find(c => c.id === id);
  return pack && (pack.regions || []).some(r => r.title) ? 'available' : 'preview';
};

/* 대륙 나눔 — 나라를 한눈에 고르게 묶는 화면 순서일 뿐이라 data/ 에 새 파일을
   만들지 않는다. world.json 에 없는 나라는 그리는 쪽에서 걸러진다 */
const CONTINENTS = [
  ['continentAsia',         'KR JP CN TW HK IN ID MY VN TH PH TR'],
  ['continentEurope',       'DE FR IT ES GB NL BE PL PT AT CH CZ SE NO FI IE UA RO HU BG GR'],
  ['continentNorthAmerica', 'US CA MX'],
  ['continentSouthAmerica', 'BR AR CL CO'],
  ['continentOceania',      'AU NZ'],
  ['continentAfricaMena',   'ZA EG SA AE'],
].map(([key, ids]) => [key, ids.split(' ')]);

/* 지역 고르기 — 스크롤 목록 대신 대륙별 라디오 판이다. 화살표·스페이스 이동은
   같은 name 을 쓰는 네이티브 라디오가 맡으므로 keydown 을 가로채지 않는다.
   배포에서는 판이 CSS 로 숨고 resolveCountry 가 KR 을 강제하므로 그리지 않는다 */
function fillRegionPick() {
  const box = $('#optRegion');
  if (!box || !isDev()) return;
  // 다시 그리면 초점이 날아간다. 화살표로 고르는 중이던 칸을 값으로 기억한다
  const held = document.activeElement;
  const heldValue = held && held.name === 'rtCountry' ? held.value : null;
  /* '자동' 칸은 없다 — fillLangPick 과 같은 결. 지금 잡힌 나라(COUNTRY)를 체크로
     보여줄 뿐, 짚어야 opt.country 가 그 값으로 굳는다 */
  const cur = haveCountry(opt.country) ? opt.country : COUNTRY;
  box.replaceChildren();
  for (const [key, ids] of CONTINENTS) {
    const have = ids.filter(haveCountry)
      .sort((a, b) => countryName(a).localeCompare(countryName(b), LANG));
    if (!have.length) continue;
    const fs = document.createElement('fieldset');
    fs.className = 'region-group';
    const lg = document.createElement('legend');
    lg.textContent = t(key);
    const grid = document.createElement('div');
    grid.className = 'region-grid';
    have.forEach(id => grid.append(pickRow('rtCountry', id, countryName(id), cur)));
    fs.append(lg, grid);
    box.append(fs);
  }
  if (heldValue) {
    const back = box.querySelector('input[name="rtCountry"][value="' + heldValue + '"]');
    if (back) back.focus();
  }
}

/* 설정 탭 — MM 스타일 세로 레일. role="tab" 사이를 화살표/Home/End 로 옮기고,
   고른 탭만 aria-selected="true" · tabindex="0" · 패널 hidden 해제로 남긴다.
   탭 자체는 index.html 에 고정 마크업으로 있어 다시 그릴 필요가 없다. */
function wireOptsTabs() {
  const tabs = [...document.querySelectorAll('.opts-tabs [role="tab"]')];
  const rail = document.querySelector('.opts-tabs');
  if (!rail || !tabs.length) return;
  const select = tab => {
    tabs.forEach(tb => {
      const on = tb === tab;
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tb.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !on;
      if (on && panel.id === 'optsLanguage') fillLangPick();
      if (on && panel.id === 'optsRegion') fillRegionPick();
    });
  };
  rail.addEventListener('click', e => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) select(tab);
  });
  rail.addEventListener('keydown', e => {
    const cur = tabs.indexOf(document.activeElement);
    if (cur < 0) return;
    let i = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i = (cur + 1) % tabs.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i = (cur - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = tabs.length - 1;
    else return;
    e.preventDefault();
    select(tabs[i]); tabs[i].focus();
  });
}

/* 지금 무엇이 잡혔는지 읽어 준다. 화면에는 더 안 그리고 콘솔에만 남긴다 —
   개발이면 고른 나라의 단계까지, 배포면 남한 하나 */
function paintRegion() {
  fillRegionPick();
  const dev = isDev();
  const stage = countryStage(COUNTRY);
  const badge = dev ? t(stage === 'available' ? 'devAvailable' : 'devPreview')
                    : t('regionSupported');
  const parts = [countryName(COUNTRY), badge];
  if (dev) parts.push(t('devWorld', { n: WORLD.countries.length }));
  console.log('[region]', ...parts);
}

async function showCountry(id) {
  COUNTRY = (isDev() && haveCountry(id)) ? id : resolveCountry();
  const pack = WORLD.countries.find(c => c.id === COUNTRY) || WORLD.countries[0];
  paintRegion();
  if (pack) await loadPixels(pack.pixels);
  await renderRegions();
}

async function boot() {
  saveOpt();
  const [i18n, world] = await Promise.all([
    grab('data/i18n.json'),
    grab('data/world.json'),
    sense(),
  ]);
  I18N = i18n;
  UI_LANGS = Object.keys(I18N);
  WORLD = world;
  LANG_COUNTRY = buildLangCountry(world);
  // 개발에서 골라 둔 나라가 localStorage 에 남아 있어도 배포에서는 되돌린다
  if (!isDev() && opt.country !== 'auto') { opt.country = 'auto'; saveOpt(); }
  COUNTRY = resolveCountry();
  LANG = resolveLang();
  paintUI(fillLangPick);
  fbPlaceholder();
  paintRegion();
  wireOptsTabs();
  const langBox = $('#optLang');
  if (langBox) {
    langBox.addEventListener('change', e => {
      const r = e.target.closest('input[name="rtLang"]');
      if (!r) return;
      opt.lang = r.value; saveOpt();
      LANG = resolveLang();
      paintUI(fillLangPick);
      fbPlaceholder(); paintRegion(); renderRegions();
    });
  }
  const regionBox = $('#optRegion');
  if (regionBox) {
    regionBox.addEventListener('change', e => {
      const r = e.target.closest('input[name="rtCountry"]');
      if (!r) return;
      opt.country = r.value; saveOpt();
      LANG = resolveLang();
      paintUI(fillLangPick);
      fbPlaceholder();
      showCountry(resolveCountry());
    });
  }
  await showCountry(COUNTRY);
}

/* ── 게임 ───────────────────────────────────────────── */
let G = null, tick = null, pending = null;

async function start(slug) {
  const zoom = 3;   // 1배를 없앴다 — 코스는 3배로만 돈다
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
       cell: geom.cell, spacy: items.some(it => /\s/.test(it.name)) };
  $('#typein').lang = course.lang || document.documentElement.lang;

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
  $('#statTime').firstElementChild.textContent = clock(opt.time);
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
  const buf = (G.spacy ? raw.replace(/^\s+/, '') : raw.replace(/\s/g, ''));
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
    $('#statTime').firstElementChild.textContent = clock(G.left);
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

function judge(raw) {
  const answer = G.spacy ? raw.trim() : raw.replace(/\s+/g, '');
  if (!answer) return;
  const hit = matchInput(answer, G.items, G.spacy);
  if (!hit || (G.seq && hit !== target())) return miss();
  claim(hit);
}

$('#typein').addEventListener('input', e => {
  if (!G || !tick) return;
  const inp = e.target;
  let val = inp.value, composing = e.isComposing;
  /* 제시된 글자 수를 넘겨서는 아예 안 써진다. 넘겨 친 찌꺼기가 남으면 같은
     지명이라도 지워야 할 백스페이스 수가 달라진다. 자모는 한 칸 안에서 합쳐지므로
     길이는 다음 음절을 시작할 때만 늘어난다 — 그 한 음절만 잘라 낸다.
     확정하는 스페이스는 잘라 내지 않는다.
     ponytail: 조합 중에 value 만 고치면 IME 가 제 버퍼를 도로 밀어 넣어 안 잘린다.
     포커스를 한 번 끊어야 조합이 진짜로 끝난다. IME 를 취소하는 표준 방법이 생기면
     blur/focus 는 지운다. */
  const cap = G.seq && G.want ? G.want.length : 0;
  if (cap && !(G.spacy && /\s/.test(G.want)) && !/\s/.test(val) && val.length > cap) {
    val = val.slice(0, cap);
    composing = false;
    inp.blur();
    inp.value = val;
    inp.focus();
  }
  paintTyped(val, composing);
  if (G.spacy) return;                            // 공백이 이름에 있으면 Enter 로 확정
  if (!/\s/.test(val)) return;                   // 스페이스 전에는 판단하지 않는다
  inp.value = '';
  judge(val);
});
$('#typein').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || !G || !tick) return;
  e.preventDefault();
  const val = e.target.value;
  e.target.value = '';
  judge(val);
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
    $('#rBest').textContent = G.score > prev ? t('bestNew') : prev ? t('bestPrev', { n: prev }) : '';
    if (G.score > prev) localStorage.setItem(key, G.score);

    const miss = G.items.filter(i => !i.claimed);
    $('#missCount').textContent = t('places', { n: miss.length });
    $('#missed').innerHTML = '';
    miss.forEach(i => {
      const li = document.createElement('li');
      li.innerHTML = '<b></b><span></span>';
      li.querySelector('b').textContent = i.name;
      li.querySelector('span').textContent = i.meta.description;
      $('#missed').append(li);
    });
    drawCard();
    board();
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
    ctx.fillText(t('cardLine', { title: courseLabel(G.course), zoom: G.zoom, score: G.score }), 70, cv.height - 136);
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
  const key = { bug: 'kindBug', idea: 'kindIdea', data: 'kindData' }[fbKind];
  $('#fbBody').placeholder = t(key);
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
  fbSay(t('fbSending'));
  try {
    const r = await fetch(FEEDBACK_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) });
    if (!r.ok) throw new Error(r.status);
    $('#fbBody').value = '';
    fbSay(t('fbThanks'));
    setTimeout(() => $('#feedback').close(), 1200);
  } catch {
    fbSay(t('fbFail'), true);
  }
  $('#fbSend').disabled = false;
};

/* ── 순위표 ───────────────────────────────────────────
   기록은 피드백과 같은 중계기 뒤 D1 에 쌓인다. 코스와 제한 시간이 둘 다 같아야
   한 판이다 — 5분과 1분을 한 줄에 세우면 점수에 뜻이 없다.
   채점은 여기 브라우저가 하고 중계기는 앞뒤만 본다. 명예의 전당이지 판정 기록이 아니다. */
const NAME_KEY = 'rt.name';
/* worker.mjs 의 plain() 과 같은 자여야 한다. 클라이언트만 통과하는 이름을 저장하면
   그 뒤 모든 판이 400 을 받고, board() 의 catch 가 순위표를 접으면서 이름을 다시
   적을 폼까지 함께 사라져 되돌릴 길이 없어진다. trim() 은 제로폭 공백을 안 턴다. */
const plain = (v, n = 12) =>
  String(v ?? '').trim().slice(0, n).replace(/[\p{C}\p{Z}]/gu, ' ').replace(/ +/g, ' ').trim();
/* ── 로그인 ───────────────────────────────────────────
   순위표에 올릴 때만 필요하다. 게임은 로그인 없이 그대로 돈다.

   비밀번호를 안 받는다. 패스키는 비밀이 기기 밖으로 나오지 않아서, 우리가
   털릴 것 자체가 없다 — 서버에는 공개키만 남는다.
   토큰을 쿠키가 아니라 localStorage 에 두는 건 중계기가 사이트와 다른 곳
   (workers.dev)에 있어서다. 사이트 밖 쿠키는 브라우저가 점점 더 막는다.
   ponytail: 중계기를 api.regiontype.com 으로 옮기면 HttpOnly 쿠키로 올린다. */
const TOKEN_KEY = 'rt.token';
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' } };

const toB64u = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0));
};

/* 이 기기에 패스키를 하나 만든다. 이미 로그인해 있으면 기기를 더하는 것이 된다 */
async function passkeyMake() {
  const d = await boardAsk('/auth/new', {});
  const name = 'regiontype · ' + d.user.slice(0, 6);
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: fromB64u(d.challenge),
    rp: d.rp,
    /* 사람 이름을 안 받는다 — 기기의 패스키 목록에도 난수만 남는다 */
    user: { id: fromB64u(toB64u(new TextEncoder().encode(d.user))), name, displayName: name },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    attestation: 'none', timeout: 60000,
  }});
  const r = cred.response;
  const out = await boardAsk('/auth/reg', {
    challenge: d.challenge, id: toB64u(cred.rawId),
    /* getPublicKey() 가 SPKI 를 그대로 준다 — 서버에 CBOR 파서를 들일 이유가 없다 */
    key: toB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(),
    clientDataJSON: toB64u(r.clientDataJSON), authData: toB64u(r.getAuthenticatorData()),
  });
  localStorage.setItem(TOKEN_KEY, out.token);
}

async function passkeyLogin() {
  const d = await boardAsk('/auth/go', {});
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: fromB64u(d.challenge), rpId: location.hostname,
    userVerification: 'preferred', timeout: 60000,
  }});
  const r = cred.response;
  const out = await boardAsk('/auth/log', {
    challenge: d.challenge, id: toB64u(cred.rawId),
    clientDataJSON: toB64u(r.clientDataJSON),
    authData: toB64u(r.authenticatorData), sig: toB64u(r.signature),
  });
  localStorage.setItem(TOKEN_KEY, out.token);
}

const boardSay = (t, bad) => {
  const p = $('#boardSay'); p.textContent = t; p.classList.toggle('bad', !!bad);
};

function drawRanks(list, ol = $('#ranks')) {
  ol.innerHTML = '';
  list.forEach((r, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<b></b><span class="who"></span><span class="pt"></span>';
    li.querySelector('b').textContent = i + 1;
    li.querySelector('.who').textContent = r.name;
    li.querySelector('.pt').textContent = r.score + t('scoreUnit');
    if (r.me) {
      li.classList.add('me');
      const tag = document.createElement('span');
      tag.className = 'tag'; tag.textContent = t('me');
      li.querySelector('.who').after(tag);
    }
    ol.append(li);
  });
}

const boardAsk = async (path, body) => {
  const t = token();
  const head = {};
  if (body) head['content-type'] = 'application/json';
  if (t) head.authorization = 'Bearer ' + t;
  const r = await fetch(FEEDBACK_URL + path, body
    ? { method: 'POST', headers: head, body: JSON.stringify(body) }
    : { headers: head });
  if (!r.ok) throw new Error(r.status);
  return r.json();
};

/* 순위표가 안 되어도 결과 화면은 그대로다 — 통째로 접고 만다 */
async function board() {
  const sec = $('#board');
  sec.hidden = true;
  if (!FEEDBACK_URL) return;
  const me = localStorage.getItem(NAME_KEY) || '';
  const inn = !!token();
  const play = { c: G.slug, t: G.total };
  try {
    const d = inn && me && G.score
      ? await boardAsk('/score', { ...play, name: me, score: G.score, hits: G.hits, tries: G.tries })
      : await boardAsk(`/top?c=${encodeURIComponent(play.c)}&t=${play.t}`);
    $('#boardWhere').textContent = `${courseLabel(G.course)} · ${clock(G.total)}`;
    /* 이름이 없으면 이 판은 조용히 안 올라간다. 왜 안 올라갔는지 여기서 말하지
       않으면 다음에 순위표를 열었을 때 "아직 아무도 없습니다" 만 보이고,
       기능이 고장난 것으로 읽힌다. */
    boardSay(d.rank ? t('nth', { n: d.rank })
      : G.score ? t('notOnBoard', { n: G.score })
      : '');
    /* 로그인 → 이름 → 올라감. 한 번에 하나씩만 묻는다 */
    $('#boardIn').hidden = inn;
    $('#boardJoin').hidden = !inn || !!me;
    drawRanks(d.top || []);
    sec.hidden = false;
  } catch (e) {
    /* 400 은 저장된 이름이 중계기 기준에 안 맞는다는 뜻이다. 그대로 두면 다음 판도
       같은 400 을 받아 순위표가 영영 안 뜬다 — 지우고 다시 적을 자리를 내어준다.
       이름이 있었을 때만 한 번 되돈다 — 안 그러면 /top 이 400 일 때 끝없이 돈다. */
    if (String(e.message) === '400' && me) { localStorage.removeItem(NAME_KEY); return board(); }
    sec.hidden = true;
  }
}

/* 이름은 이 브라우저에만 남는다. 한 번 적으면 다음 판부터는 묻지 않는다 */
/* 패스키가 없는 브라우저·기기가 있다. 그때는 버튼을 내리고 왜 안 되는지 말한다 */
const canPasskey = () => !!(window.PublicKeyCredential && navigator.credentials?.create);

const tryAuth = async (run, done) => {
  if (!canPasskey()) return boardSay(t('noPasskey'), true);
  const all = [$('#inGo'), $('#inNew')];
  all.forEach(b => b.disabled = true);
  boardSay(done);
  try {
    await run();
    boardSay('');
    board();          // 로그인했으니 다시 그린다 — 이제 이름 칸이 열린다
  } catch (e) {
    /* 사용자가 창을 닫은 것과 진짜 실패는 다른 말이다 */
    boardSay(e && e.name === 'NotAllowedError' ? t('cancelled')
           : String(e.message) === '401' ? t('noKey')
           : t('loginFail'), true);
  }
  all.forEach(b => b.disabled = false);
};

$('#inGo').onclick = () => tryAuth(passkeyLogin, t('askingDevice'));
$('#inNew').onclick = () => tryAuth(passkeyMake, t('makingKey'));

$('#boardJoin').onsubmit = e => {
  e.preventDefault();
  const name = plain($('#boardName').value);
  if (!name) return boardSay(t('badName'), true);
  localStorage.setItem(NAME_KEY, name);
  $('#boardJoin').hidden = true;
  boardSay(t('uploading'));
  board();
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

  const jp = mk(['東京都', '京都府']);
  console.assert(m('東京', jp) === '東京都', '都 접미 약칭');
  console.assert(m('京都', jp) === '京都府', '府 접미 약칭');
  const us = [{ name: 'New York', aliases: ['NY'], claimed: false },
              { name: 'New Mexico', aliases: ['NM'], claimed: false }];
  const ms = (s, items) => { const r = matchInput(s, items, true); return r && r.name; };
  console.assert(ms('New York', us) === 'New York', '띄어쓰기 이름 정확일치');
  console.assert(ms('new york', us) === 'New York', '영문 대소문자');
  console.assert(ms('NY', us) === 'New York', '우편 약칭');
  console.assert(ms('ny', us) === 'New York', '우편 약칭 소문자');
  const kj = mk(['전라남도', '광주광역시']);
  kj[0].aliases.push('KJ'); kj[1].aliases.push('KJ');
  console.assert(m('KJ', kj) === null, '겹치는 우편 약칭은 확정하지 않는다');
  console.assert(m('광주', kj) === '광주광역시', '접미 약칭은 후보가 하나일 때');

  console.assert(expandPixelRow('30.4x') === '.'.repeat(30) + 'xxxx', 'pixel RLE row');
  console.assert(expandPixelRow('....') === '....', 'plain pixel row');

  const fbu = fbIssue({ kind: 'bug', body: '가양1동이 오답으로 처리됨', v: '0.38',
                        href: 'https://regiontype.com/', ua: 'UA' });
  console.assert(fbu.includes(encodeURIComponent('[버그] 가양1동이 오답으로 처리됨')), '이슈 제목 = 종류 + 앞머리');
  console.assert(fbu.includes(encodeURIComponent('브라우저: UA')), '메타는 버전·주소·브라우저까지');

  UI_LANGS = ['ko', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'zh'];
  LANG_COUNTRY = buildLangCountry({
    countries: [{ id: 'KR', lang: 'ko' }, { id: 'JP', lang: 'ja' }, { id: 'US', lang: 'en' },
                { id: 'DE', lang: 'de' }, { id: 'FR', lang: 'fr' }, { id: 'TW', lang: 'zh' }],
  });
  WORLD = { countries: [
    { id: 'KR' }, { id: 'JP' }, { id: 'US' }, { id: 'DE' }, { id: 'FR' }, { id: 'TW' },
  ] };
  const devWas = isDev();
  document.documentElement.dataset.dev = '';        // 나라 감지는 개발 쪽 계약이다
  HERE = { country: '', lang: 'de-DE', timezone: 'Europe/Berlin' };
  opt.country = 'auto';
  console.assert(resolveCountry() === 'DE', 'Accept-Language·타임존으로 독일');
  HERE = { country: 'FR', lang: 'en-US', timezone: 'Europe/Paris' };
  console.assert(resolveCountry() === 'FR', 'relay 나라 코드가 언어보다 우선');
  opt.country = 'auto';
  HERE = { country: '', lang: 'zh-TW', timezone: '' };
  console.assert(resolveCountry() === 'TW', 'zh-TW → 대만');
  opt.country = 'JP';
  console.assert(resolveCountry() === 'JP', '개발에서는 고른 나라가 자동 감지를 이긴다');
  document.documentElement.removeAttribute('data-dev');
  console.assert(resolveCountry() === 'KR', '배포는 골라 둔 나라를 무시하고 남한');
  HERE = { country: 'FR', lang: 'fr-FR', timezone: 'Europe/Paris' };
  console.assert(resolveCountry() === 'KR', '배포는 자동 감지도 무시하고 남한');
  document.documentElement.toggleAttribute('data-dev', devWas);
  opt.country = 'auto';
  HERE = { country: '', lang: 'zh-TW', timezone: '' };
  opt.lang = 'auto';
  console.assert(parseUiLang('zh-Hant-TW') === 'zh', '번체 UI 는 zh 로');
  console.assert(parseUiLang('de-AT') === 'de', 'de-AT → de UI');
  opt.lang = 'auto'; LANG = resolveLang();
  HERE = { country: 'BR', lang: 'pt-BR', timezone: 'America/Sao_Paulo' };
  COUNTRY = 'BR';
  console.assert(resolveLang() === 'pt', 'pt-BR → pt UI');

  WORLD = { countries: [
    { id: 'KR', regions: [{ id: 'seoul', title: { ko: '서울' } }] },
    { id: 'JP', regions: [{ id: 'jp-admin' }] },
    { id: 'ZZ' },
  ] };
  console.assert(countryStage('KR') === 'available', '손으로 지은 코스가 있으면 정식');
  console.assert(countryStage('JP') === 'preview', 'admin-1 뿐이면 미리보기');
  console.assert(countryStage('XX') === 'preview', '모르는 나라도 미리보기로 떨어진다');
  console.assert(countryStage('ZZ') === 'preview', 'regions 가 없어도 터지지 않는다');

  console.log('self-check done');
}

boot();
