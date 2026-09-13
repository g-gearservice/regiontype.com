/* regiontype — 나라의 지명을 친다. 코스는 data/*.json, 화면 말은 data/i18n.json. */
'use strict';

const $ = s => document.querySelector(s);
const VER = '1.36';
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
  /* 소개 페이지는 언어마다 별도 파일이다(about.ko 는 접미 없이 about.html).
     파일이 없는 언어는 한국어 소개로 보낸다 — 없는 주소를 열지 않는다 */
  const aboutLink = $('#aboutLink');
  if (aboutLink) {
    const have = 'ar,bg,cs,de,el,en,es,fi,fr,hu,id,it,ja,ms,nb,nl,pl,pt,ro,sv,th,tr,uk,vi,zh';
    aboutLink.href = (LANG !== 'ko' && have.split(',').includes(LANG))
      ? `about.${LANG}.html` : 'about.html';
  }
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
  const m = /^(.+?)(특별자치시|특별자치도|특별시|광역시|자치구|자치시|자치도|自治区|特别行政区|特別行政區|[시군구동읍면로가도]|[都道府県]|[省市縣县])$/.exec(String(name).normalize('NFC'));
  return m && m[1].length > 1 ? m[1] : null;
}

/* 화면에 띄울 이름. 긴 행정명은 한 자로 줄여 뒤에 남긴다 —
   서울특별시는 서울시, 제주특별자치도는 제주도다. 경기도·강남구처럼
   이미 짧으면 그대로 두고, 한국 밖 이름은 손대지 않는다. */
function adminLabel(name) {
  const n = String(name).normalize('NFC');
  const m = /^(.+?)(특별자치시|특별자치도|특별시|광역시|자치구|자치시|자치도)$/.exec(n);
  if (m && m[1].length > 1) {
    if (/시$/.test(m[2])) return m[1] + '시';
    if (/도$/.test(m[2])) return m[1] + '도';
    if (/구$/.test(m[2])) return m[1] + '구';
  }
  return n;
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

function applyGrid(ox, oy, nx, ny = nx) {
  const svg = $('.grid-bg'), p = $('#bitgrid');
  if (!p || !(nx > 0)) return;
  svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  p.setAttribute('width', nx);
  p.setAttribute('height', ny);
  p.setAttribute('x', ox);
  p.setAttribute('y', oy);
  p.querySelector('path').setAttribute('d', `M${nx} 0 V${ny} H0`);
}
/* SVG 유저 좌표 → 화면. 추정하지 않고 CTM 으로 격자 원점·칸을 읽는다. */
const DECO_CELL = 152;   /* 플레이 밖 장식 격자 칸(px). about.html 과 같은 값 */
function syncGrid() {
  /* 플레이 밖에서는 맞출 지도가 없다 — 못 박은 칸으로 되돌리고 셸만 다시 앉힌다.
     되돌리지 않으면 플레이에서 나올 때 그 판의 칸 크기가 배경에 굳어 남는다 */
  if ($('#regions').classList.contains('on') && ATLAS && ATLAS.geom && ATLAS.box) {
    const svg = $('#atlasPlane svg');
    const ctm = svg && svg.getScreenCTM();
    if (ctm) {
      const cell = ATLAS.geom.cell, box = ATLAS.box;
      const a = svg.createSVGPoint();
      a.x = box.x; a.y = box.y;
      const o = a.matrixTransform(ctm);
      a.x = box.x + cell; a.y = box.y;
      const x1 = a.matrixTransform(ctm);
      a.x = box.x; a.y = box.y + cell;
      const y1 = a.matrixTransform(ctm);
      applyGrid(o.x, o.y,
        Math.hypot(x1.x - o.x, x1.y - o.y),
        Math.hypot(y1.x - o.x, y1.y - o.y));
      return;
    }
  }
  if (!($('#play').classList.contains('on') && G && G.cam)) {
    /* 화면 폭·높이가 DECO_CELL 의 배수가 아니면 우측·하단에 짜투리 칸이 남는다.
       칸을 화면에 딱 맞는 배수로 살짝 늘리거나 줄여 경계를 딱 맞춘다 */
    const w = window.innerWidth, h = window.innerHeight;
    const cols = Math.max(1, Math.round(w / DECO_CELL));
    const rows = Math.max(1, Math.round(h / DECO_CELL));
    const cw = w / cols, ch = h / rows;
    /* 칸 크기와 '몇 번째 칸'을 CSS 로 넘긴다 — 타이틀은 자리를 재지 않고 칸에 앉는다.
       로고가 가운데 세 칸, 그 아래 한 줄이 버튼 세 칸이라 덩이는 세 칸 × 두 줄이다 */
    const st = document.documentElement.style;
    st.setProperty('--deco-cw', cw + 'px');
    st.setProperty('--deco-ch', ch + 'px');
    st.setProperty('--title-col', String(Math.max(0, Math.floor((cols - 3) / 2))));
    st.setProperty('--title-row', String(Math.max(0, Math.round((rows - 2) / 2))));
    applyGrid(0, 0, cw, ch);
    syncOptShell();
    placeGridBtns();
    return;
  }
  const root = $('#map'), space = G.cam, cell = G.cell;
  const ctm = space.getScreenCTM();
  if (!ctm) return;
  const a = root.createSVGPoint();
  a.x = 0; a.y = 0;
  const o = a.matrixTransform(ctm);
  a.x = cell;
  const x1 = a.matrixTransform(ctm);
  applyGrid(o.x, o.y, Math.hypot(x1.x - o.x, x1.y - o.y));
}
/* .opts-shell 의 위아래 변을 둘 다 장식 격자의 가로선에 앉힌다.
   윗변만 앉히고 높이를 아무 값이나 쓰면 아랫변은 칸의 중간 어디쯤에서 끊긴다 —
   테두리도 배경도 없는 통이라 그 끊김이 '내용이 격자 밖으로 샜다'로 읽힌다.
   그래서 높이 자체를 칸의 정수배로 죈다: 윗변이 선 위에 서면 그로부터 정수 칸
   내려간 아랫변도 저절로 선 위에 선다. 칸 수는 뷰포트 56% 근방에서 고르되
   레일(.opts-tabs) 자연 높이를 밑돌지 않는다(밑돌면 탭 다섯 칸이 잘린다) —
   탭 글자로 재지 않는 건 언어마다 글자 길이가 달라 통이 뛰는 걸 막기 위해서다.
   그 칸 수로 자리가 안 나면(뷰포트가 아주 좁으면) 한 칸씩 줄여 다시 찾고,
   그래도 없으면 격자 정렬을 포기하고 자리 한가운데 그대로 선다.
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
  const fits = (v, h) => v >= areaTop - 1 && v + h <= areaBottom + 1;
  const minCells = Math.max(1, Math.ceil(railH / cell));
  const wantCells = Math.max(minCells, Math.round(vh * 0.56 / cell));
  let h = wantCells * cell, top;
  for (let n = wantCells; n >= minCells; n--) {
    h = n * cell;
    const mid = areaTop + (areaBottom - areaTop - h) / 2;   // 그 자리에 가운데 놓은 윗변
    const k = Math.round((mid - gridY) / cell);
    // 가장 가까운 선부터, 안 되면 이웃 선
    top = [k, k + 1, k - 1].map(i => gridY + i * cell).find(v => fits(v, h));
    if (top !== undefined) break;
  }
  if (top === undefined) { h = minCells * cell; top = areaTop + (areaBottom - areaTop - h) / 2; }
  const st = document.documentElement.style;
  st.setProperty('--opt-shell-h', h + 'px');
  st.setProperty('--opt-shell-dy', (top - (vh - h) / 2) + 'px');
}
/* GitHub 별 개수. 공개 저장소 정보라 토큰을 안 쓴다 — 토큰은 Worker 안에만 둔다.
   IP당 시간당 60회 제한이 있어 10분은 재워두고, 실패하면 숫자 없이 링크만 남긴다 */
const GH_REPO = 'pistolinkr/regiontype.com';
async function ghStars() {
  const el = $('#ghStars');
  if (!el) return;
  const show = n => { el.textContent = '\u2606 ' + n; el.hidden = false; };
  /* 별 개수는 하루에 몇 개 움직인다. 10분마다 물어볼 값이 아니고, 물어볼 때마다
     보는 사람의 IP 와 어디서 왔는지가 GitHub 로 간다 — 간격을 벌리고, 실패도
     기억하고(안 그러면 막힌 망에서 매 페이지마다 다시 두드린다), 주소는 안 보낸다.
     ponytail: IP 를 아예 안 보내려면 relay 에 /stars 를 두고 거기서 캐시해야 한다 */
  const KEY = 'rt.gh', TTL = 432e5, FAIL_TTL = 36e5;
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && Date.now() - c.t < (c.n == null ? FAIL_TTL : TTL)) {
      if (c.n != null) show(c.n);
      return;
    }
  } catch {}
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 1600);
    const r = await fetch('https://api.github.com/repos/' + GH_REPO,
                          { signal: ac.signal, referrerPolicy: 'no-referrer' });
    clearTimeout(to);
    const n = r.ok ? (await r.json()).stargazers_count : null;
    if (typeof n !== 'number') { save({ n: null, t: Date.now() }); return; }
    save({ n, t: Date.now() });
    show(n);
  } catch { save({ n: null, t: Date.now() }); }
}

/* 홈의 격자 한 칸 버튼. 자리만 localStorage 에 둔다 — 설정(opt) 과 섞지 않는다.
   c/r 이 음수면 끝에서 센다(-1 = 마지막 칸). slot 은 로고 아래 줄의 몇 번째 칸.
   한 번도 안 끌면 깃허브는 오른쪽 아래, 소개·설정·시작은 로고 아래 세 칸에 남는다 */
const GRID_BTN_KEY = 'rt.gridBtn';
const GRID_BTN_DEF = {
  gh: { c: -1, r: -1 }, alt: { c: 0, r: -1 },
  about: { slot: 0 }, options: { slot: 1 }, play: { slot: 2 },
  atlasStart: { c: -1, r: -1 },
};
function loadGridBtns() {
  try { return Object.assign({}, GRID_BTN_DEF, JSON.parse(localStorage.getItem(GRID_BTN_KEY) || '{}')); }
  catch { return Object.assign({}, GRID_BTN_DEF); }
}
function saveGridBtns(pos) {
  try { localStorage.setItem(GRID_BTN_KEY, JSON.stringify(pos)); } catch {}
}
function decoGrid() {
  const s = getComputedStyle(document.documentElement);
  const cw = parseFloat(s.getPropertyValue('--deco-cw')) || DECO_CELL;
  const ch = parseFloat(s.getPropertyValue('--deco-ch')) || DECO_CELL;
  const cols = Math.max(1, Math.round(innerWidth / cw));
  const rows = Math.max(1, Math.round(innerHeight / ch));
  return { cw, ch, cols, rows };
}
function resolveCell(c, r, cols, rows) {
  const col = c < 0 ? cols + c : c;
  const row = r < 0 ? rows + r : r;
  return [Math.max(0, Math.min(cols - 1, col)), Math.max(0, Math.min(rows - 1, row))];
}
function titleMenuCell(slot, cols, rows) {
  const s = getComputedStyle(document.documentElement);
  const tc = Number(s.getPropertyValue('--title-col')) || 0;
  const tr = Number(s.getPropertyValue('--title-row')) || 0;
  return resolveCell(tc + slot, tr + 1, cols, rows);
}
function placeGridBtns() {
  const { cols, rows } = decoGrid();
  const pos = loadGridBtns();
  document.querySelectorAll('[data-grid-btn]').forEach(el => {
    if (el.hasAttribute('data-drag')) return;
    const p = pos[el.dataset.gridBtn] || GRID_BTN_DEF[el.dataset.gridBtn] || { c: 0, r: 0 };
    const [c, r] = p.r === 'mid'
      ? resolveCell(p.c ?? -1, Math.floor((rows - 1) / 2), cols, rows)
      : (typeof p.c === 'number' && typeof p.r === 'number')
        ? resolveCell(p.c, p.r, cols, rows)
        : titleMenuCell(p.slot || 0, cols, rows);
    el.style.setProperty('--btn-col', c);
    el.style.setProperty('--btn-row', r);
  });
}
function wireGridBtns() {
  placeGridBtns();
  document.querySelectorAll('[data-grid-btn]').forEach(el => {
    let drag = false, held = false, sx = 0, sy = 0, sc = 0, sr = 0;
    const move = e => {
      if (!held) return;
      const { cw, ch, cols, rows } = decoGrid();
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!drag && dx * dx + dy * dy < 25) return;
      drag = true;
      el.dataset.drag = '';
      el.style.setProperty('--btn-col', Math.max(0, Math.min(cols - 1, Math.round(sc + dx / cw))));
      el.style.setProperty('--btn-row', Math.max(0, Math.min(rows - 1, Math.round(sr + dy / ch))));
    };
    const up = () => {
      if (!held) return;
      held = false;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      el.removeAttribute('data-drag');
      if (!drag) return;
      const pos = loadGridBtns();
      pos[el.dataset.gridBtn] = {
        c: Number(el.style.getPropertyValue('--btn-col')),
        r: Number(el.style.getPropertyValue('--btn-row')),
      };
      saveGridBtns(pos);
    };
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      sx = e.clientX; sy = e.clientY;
      sc = Number(el.style.getPropertyValue('--btn-col'));
      sr = Number(el.style.getPropertyValue('--btn-row'));
      drag = false; held = true;
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    el.addEventListener('click', e => {
      if (!drag) return;
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('keydown', e => {
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!step) return;
      e.preventDefault();
      const { cols, rows } = decoGrid();
      let c = Number(el.style.getPropertyValue('--btn-col'));
      let r = Number(el.style.getPropertyValue('--btn-row'));
      c = Math.max(0, Math.min(cols - 1, c + step[0]));
      r = Math.max(0, Math.min(rows - 1, r + step[1]));
      el.style.setProperty('--btn-col', c);
      el.style.setProperty('--btn-row', r);
      const pos = loadGridBtns();
      pos[el.dataset.gridBtn] = { c, r };
      saveGridBtns(pos);
    });
  });
}

function followGrid(ms) {
  const t0 = performance.now();
  const step = () => {
    syncGrid();
    if (performance.now() - t0 < ms) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/* 데스크톱 확대는 125% 까지만 레이아웃에 반영한다 — 그 위로는 설정 셸을 같은 비율로
   되돌려(--zc) 고르기 판 두 열이 한 열로 접히지 않게 한다. 확대 자체는 페이지가 막을
   수 없다. 확대율은 창 바깥/안쪽 폭의 비로 재고 5% 눈금으로 반올림한다 —
   창틀·스크롤바 몇 px 이 100% 를 101% 로 읽게 만드는 걸 지운다 */
const ZOOM_CAP = 1.25;
function capZoom() {
  const z = Math.round((window.outerWidth / window.innerWidth) * 20) / 20;
  const fine = matchMedia('(pointer:fine)').matches;
  const k = (fine && z > ZOOM_CAP) ? ZOOM_CAP / z : 1;
  document.documentElement.style.setProperty('--zc', String(k));
}
capZoom();
window.addEventListener('resize', capZoom);
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
  if (closeAtlas()) return;
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

/* ── 지역 고르기 — 눕힌 비트맵 ─────────────────────────
   카드를 걷어냈다. 나라의 행정구역 비트맵을 뒤로 눕혀 깔고, 커서가 간 쪽으로
   판이 밀린다 — 커서가 곧 카메라다.
   한국은 시·도 아래에 또 판이 있다. 서울처럼 구 아래 동 코스가 있으면 한 단
   내려가고, 부산처럼 구 코스가 끝이면 그 코스의 시작 판을 연다. 나라를
   누르면 바로 치지 않는다 — 제한 시간·이름 힌트를 고를 자리가 있어야 한다. */
let ATLAS = null;
let atlasRedraw = [];
let atlasGen = 0;

const esc = s => String(s).replace(/[&<>"']/g, ch =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));

/* tree 가 없으면 구역마다 코스가 없다 — 판 전체가 그 나라 한 코스다.
   값이 null 인 자리(세종)는 코스가 아직 없다. */
function atlasChild(tree, slug, name) {
  return tree ? (tree.children[`${slug}/${name}`] || null) : null;
}
/* 자식 슬러그가 있으면 그 판으로 내려간다. 서울만 동이 있고 부산 이하는
   시군구가 잎이지만, 판은 있어야 전 지역을 고를 수 있다. */
function atlasDeeper(tree, child) {
  return !!child;
}

/* 이름 크기는 그 구역의 넓이를 따른다 — 광역시는 칸 몇 개뿐이라 같은 크기로
   찍으면 옆 도(道) 이름을 밟는다. 넓을수록 크게, 좁을수록 작게.
   거기에 제 폭에 맞춰 한 번 더 줄인다: 한 칸짜리 주에 'South Carolina' 를
   같은 크기로 찍으면 다섯 칸을 가로지른다. 너무 작아질 이름은 아예 접는다 —
   아래 한 줄 읽기가 대신 알려준다. */
const CJK = /[\u3000-\u9fff\uac00-\ud7af\u3040-\u30ff]/;
function nameSize(label, cellsN, boxW) {
  const per = CJK.test(label) ? 1 : .58;
  const fit = boxW / Math.max(1, label.length * per);
  /* 구가 많은 판은 넓이에 맞춘다. 나라 판 크기는 atlasSvg 에서 도(道)와 같게 맞춘다 */
  const by = .62 + .62 * Math.min(1, Math.sqrt(cellsN) / 11);
  const s = Math.min(by, fit * 1.9);
  return s < .22 ? 0 : s;
}

function atlasSvg(geom) {
  const cells = geom.items.map(() => []);
  /* 격자에는 빈 가장자리가 붙어 있다(us-admin 은 40칸 중 14칸만 쓴다) — 쓰는 데까지
     잘라야 판이 제 비율을 갖는다. 안 자르면 가로로 납작해져 글자만 겹친다. */
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const i = SYM.indexOf(ch);
    if (i < 0) return;
    cells[i].push([x, y]);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }));
  const c = geom.cell;
  const box = { x: minX * c, y: minY * c, w: (maxX - minX + 1) * c, h: (maxY - minY + 1) * c };
  /* 도트 사이 빈틈에서도 그 구역이 잡혀야 한다 — 칸을 통째로 이은 판을 밑에 깐다 */
  const skin = i => cells[i].map(([x, y]) =>
    `M${(x * c).toFixed(1)} ${(y * c).toFixed(1)}h${c.toFixed(1)}v${c.toFixed(1)}h-${c.toFixed(1)}z`
  ).join('');
  /* 특별시·광역시·특별자치시·도는 접미를 둘째 줄에 둔다.
     한 줄로 붙이면 서울·인천·경기가 서로 밟고, 글자를 키울 수도 없다. */
  const splitAdmin = name => {
    const m = /^(.*?)(특별자치시|특별자치도|특별시|광역시)$/.exec(String(name));
    return m ? [m[1], m[2]] : [name];
  };
  /* 한국 시·도 판: 글자 크기는 도(道)와 같게 두고, 겹치는 이름은 옆으로 민다.
     좌표는 판 비율(%). 손댄 값은 충남·세종·대전·수도권처럼 서로 밟는 자리뿐이다. */
  const krBoard = geom.items.some(g => /특별시|광역시|특별자치/.test(g.name));
  const NUDGE = {
    '서울특별시': [-6, -4],
    '인천광역시': [-8, 1],
    '경기도': [8, -1],
    '충청남도': [-9, 2],
    '세종특별자치시': [-1, 2],
    '대전광역시': [5, 7],
    '충청북도': [5, 0],
    '광주광역시': [-10, -5],
    '대구광역시': [-5, 1],
    '부산광역시': [7, 3],
    '울산광역시': [7, -2],
    '제주특별자치도': [5, 0],
  };
  const names = [];
  const doSize = 1.85;
  geom.items.forEach((g, i) => {
    const xs = cells[i].map(p => p[0]);
    if (!xs.length) return;
    const lines = splitAdmin(g.name);
    const wide = lines.reduce((a, b) => a.length >= b.length ? a : b);
    const s = krBoard
      ? doSize
      : nameSize(wide, cells[i].length, Math.max(...xs) - Math.min(...xs) + 1);
    if (!s) return;
    const [dx, dy] = NUDGE[g.name] || (lines.length > 1
      ? [(g.c[0] - box.x) / box.w < .4 ? -6 : (g.c[0] - box.x) / box.w > .55 ? 6 : 0, 0]
      : [0, 0]);
    names.push({
      i, lines,
      x: (g.c[0] - box.x) / box.w * 100 + dx,
      y: (g.c[1] - box.y) / box.h * 100 + dy,
      ns: c * s,
    });
  });
  /* 장식 격자를 판 유저 좌표에 그린다. 뷰포트 격자는 원근에서 칸이 어긋난다.
     점은 (x+.5, y+.5)*cell — 선은 정수 칸에 서서 점이 칸 한가운데 앉는다 */
  let gridD = '';
  const x1 = box.x + box.w, y1 = box.y + box.h;
  for (let x = box.x; x <= x1 + .05; x += c) {
    gridD += `M${x.toFixed(1)} ${box.y.toFixed(1)}V${y1.toFixed(1)}`;
  }
  for (let y = box.y; y <= y1 + .05; y += c) {
    gridD += `M${box.x.toFixed(1)} ${y.toFixed(1)}H${x1.toFixed(1)}`;
  }
  const svg = `<svg viewBox="${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}"` +
    ` preserveAspectRatio="xMidYMid meet">` +
    `<path class="atlas-grid" d="${gridD}"/>` +
    geom.items.map((g, i) =>
      `<g class="gu" role="button" tabindex="0" data-area="${i}" aria-label="${esc(g.name)}">` +
      `<path class="hit" d="${skin(i)}"/>` +
      cells[i].map(([x, y]) => dot(x, y, c, '')).join('') +
      '</g>'
    ).join('') + '</svg>';
  return { svg, box, names };
}

function hideAtlasOv() {
  const ov = $('#atlasOv');
  if (!ov) return;
  ov.hidden = true;
  ov.replaceChildren();
}

function unitRank(name) {
  const n = String(name).normalize('NFC');
  if (/읍$/.test(n)) return 5;
  if (/면$/.test(n)) return 4;
  if (/동$/.test(n)) return 3;
  if (/군$/.test(n)) return 2;
  if (/구$/.test(n)) return 1;
  return 0;
}
function atlasPlaySlug(a) {
  const at = a || ATLAS;
  return (at && at.pick && at.pick.slug) || (at && at.slug) || null;
}
function atlasMotionOff() {
  return !opt.motion || matchMedia('(prefers-reduced-motion:reduce)').matches;
}
/* --ease-in-out: cubic-bezier(.77, 0, .175, 1) 를 프레임마다 푼다 */
function atlasEase(t) {
  const p1x = .77, p1y = 0, p2x = .175, p2y = 1;
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const samp = (x, a, b, c) => ((a * x + b) * x + c) * x;
  const der = (x, a, b, c) => (3 * a * x + 2 * b) * x + c;
  let x = t;
  for (let i = 0; i < 8; i++) {
    const z = samp(x, ax, bx, cx) - t;
    const d = der(x, ax, bx, cx);
    if (Math.abs(z) < 1e-5 || Math.abs(d) < 1e-6) break;
    x -= z / d;
  }
  return samp(x, ay, by, cy);
}
const atlasLerp = (a, b, k) => a + (b - a) * k;
function atlasTiltOf(z) {
  if (atlasMotionOff()) return 0;
  const t = Math.min(1, Math.max(0, (z - 1) / .22));
  return 56 * (1 - t * t);
}
/* 판 변환은 scale 뒤에 pan 이다. 커서 아래 점(판 중심 기준 -0.5~0.5)이
   같은 화면에 남으려면 pan 을 z 차만큼 반대로 민다 */
function atlasZoomPan(pan, local, z0, z1) {
  return pan + local * 100 * (z0 - z1);
}
function atlasPreviewCam(z, x, y) {
  const plane = $('#atlasPlane'), rig = $('#atlasRig');
  if (plane) {
    plane.style.setProperty('--atlas-z', Number(z).toFixed(3));
    plane.style.setProperty('--pan-x', Number(x).toFixed(2));
    plane.style.setProperty('--pan-y', Number(y).toFixed(2));
  }
  if (rig) {
    rig.classList.add('live');
    rig.style.setProperty('--atlas-tilt', atlasTiltOf(z).toFixed(2) + 'deg');
  }
}
function atlasUserFromClient(cx, cy) {
  const svg = $('#atlasPlane svg');
  const ctm = svg && svg.getScreenCTM();
  if (!svg || !ctm) return null;
  const p = svg.createSVGPoint();
  p.x = cx; p.y = cy;
  return p.matrixTransform(ctm.inverse());
}
function atlasClientFromUser(ux, uy) {
  const svg = $('#atlasPlane svg');
  const ctm = svg && svg.getScreenCTM();
  if (!svg || !ctm) return null;
  const p = svg.createSVGPoint();
  p.x = ux; p.y = uy;
  return p.matrixTransform(ctm);
}
/* 기울기가 바뀌면 세로가 원근으로 뛴다. 추정 식 대신 CTM 으로
   같은 유저 점이 같은 화면에 남게 pan 을 몇 번 푼다 */
function atlasPanToKeep(cx, cy, z1) {
  const plane = $('#atlasPlane');
  if (!plane || !ATLAS) return { x: ATLAS.panX || 0, y: ATLAS.panY || 0 };
  const user = atlasUserFromClient(cx, cy);
  if (!user) return { x: ATLAS.panX || 0, y: ATLAS.panY || 0 };
  let px = ATLAS.panX || 0, py = ATLAS.panY || 0;
  const w = plane.offsetWidth || 1, h = plane.offsetHeight || 1;
  for (let i = 0; i < 5; i++) {
    atlasPreviewCam(z1, px, py);
    void plane.offsetWidth;
    const now = atlasClientFromUser(user.x, user.y);
    if (!now) break;
    const tilt = atlasTiltOf(z1) * Math.PI / 180;
    const cos = Math.max(.38, Math.cos(tilt));
    px += (cx - now.x) / w * 100;
    py += (cy - now.y) / (h * cos) * 100;
  }
  return { x: px, y: py };
}
function atlasLocalFromClient(cx, cy) {
  const plane = $('#atlasPlane'), box = $('#atlas');
  if (!plane || !box || !ATLAS) return { lx: 0, ly: 0 };
  const w = plane.offsetWidth || 1, h = plane.offsetHeight || 1;
  const z = (ATLAS.aim && ATLAS.aim.z) || ATLAS.z || 1;
  const px = (ATLAS.aim && ATLAS.aim.x) || ATLAS.panX || 0;
  const py = (ATLAS.aim && ATLAS.aim.y) || ATLAS.panY || 0;
  const b = box.getBoundingClientRect();
  const tilt = atlasTiltOf(z) * Math.PI / 180;
  const cos = Math.max(.38, Math.cos(tilt));
  const sx = cx - (b.left + b.width / 2);
  const sy = (cy - (b.top + b.height / 2)) / cos;
  return {
    lx: sx / (w * z) - px / (100 * z),
    ly: sy / (h * z) - py / (100 * z),
  };
}
function atlasClampXY(z, x, y) {
  const zz = Math.max(1, z || 1);
  const maxX = 52 * zz, maxY = 58 * zz;
  return [Math.max(-maxX, Math.min(maxX, x)), Math.max(-maxY, Math.min(maxY, y))];
}
function atlasClampCam() {
  if (!ATLAS) return;
  if (ATLAS.z == null) ATLAS.z = 1;
  if (ATLAS.panX == null) ATLAS.panX = 0;
  if (ATLAS.panY == null) ATLAS.panY = 0;
  const [x, y] = atlasClampXY(ATLAS.z, ATLAS.panX, ATLAS.panY);
  ATLAS.panX = x; ATLAS.panY = y;
  if (ATLAS.aim) {
    const [ax, ay] = atlasClampXY(ATLAS.aim.z || ATLAS.z, ATLAS.aim.x, ATLAS.aim.y);
    ATLAS.aim.x = ax; ATLAS.aim.y = ay;
  }
}
function atlasApplyCam(el) {
  const plane = el || $('#atlasPlane');
  if (!plane || !ATLAS) return;
  atlasClampCam();
  plane.style.setProperty('--atlas-z', ATLAS.z.toFixed(3));
  plane.style.setProperty('--pan-x', ATLAS.panX.toFixed(2));
  plane.style.setProperty('--pan-y', ATLAS.panY.toFixed(2));
  const rig = $('#atlasRig');
  if (rig && !el) {
    rig.style.setProperty('--atlas-tilt', atlasTiltOf(ATLAS.z).toFixed(2) + 'deg');
    rig.classList.toggle('live', (ATLAS.z || 1) > 1.02);
  }
  if (!el) { atlasApplyLod(); requestAnimationFrame(syncGrid); }
}
function atlasSetO(el, o) {
  if (el) el.style.setProperty('--atlas-o', o.toFixed(3));
}
function atlasCopyPlane(from, to) {
  if (!from || !to) return;
  to.innerHTML = from.innerHTML;
  ['--atlas-ar', '--atlas-rows-h', '--atlas-bw', '--atlas-z', '--pan-x', '--pan-y', '--atlas-o']
    .forEach(k => to.style.setProperty(k, from.style.getPropertyValue(k) || ''));
}
function atlasResetCam(z) {
  if (!ATLAS) return;
  ATLAS.z = z == null ? 1 : z;
  ATLAS.panX = 0; ATLAS.panY = 0;
  ATLAS.aim = { z: ATLAS.z, x: 0, y: 0 };
  atlasApplyCam();
}
function atlasSyncAim() {
  if (!ATLAS) return;
  ATLAS.aim = { z: ATLAS.z, x: ATLAS.panX, y: ATLAS.panY };
}
function atlasChase() {
  if (!ATLAS || ATLAS.busy || ATLAS.camRaf) return;
  if (atlasMotionOff()) {
    ATLAS.z = ATLAS.aim.z; ATLAS.panX = ATLAS.aim.x; ATLAS.panY = ATLAS.aim.y;
    atlasApplyCam();
    atlasMaybeDive();
    return;
  }
  const step = () => {
    if (!ATLAS || ATLAS.busy) { ATLAS.camRaf = 0; return; }
    const a = ATLAS.aim, k = .62;
    ATLAS.z += (a.z - ATLAS.z) * k;
    ATLAS.panX += (a.x - ATLAS.panX) * k;
    ATLAS.panY += (a.y - ATLAS.panY) * k;
    atlasApplyCam();
    const done = Math.abs(a.z - ATLAS.z) < .003
      && Math.abs(a.x - ATLAS.panX) < .12
      && Math.abs(a.y - ATLAS.panY) < .12;
    if (done) {
      ATLAS.z = a.z; ATLAS.panX = a.x; ATLAS.panY = a.y;
      atlasApplyCam();
      ATLAS.camRaf = 0;
    } else {
      ATLAS.camRaf = requestAnimationFrame(step);
    }
    atlasMaybeDive();
  };
  ATLAS.camRaf = requestAnimationFrame(step);
}
function atlasTween(ms, tick) {
  return new Promise(resolve => {
    if (ATLAS && ATLAS.tweenRaf) cancelAnimationFrame(ATLAS.tweenRaf);
    if (atlasMotionOff() || ms <= 0) { tick(1); resolve(); return; }
    const t0 = performance.now();
    const step = now => {
      const u = Math.min(1, (now - t0) / ms);
      tick(atlasEase(u));
      if (u < 1) ATLAS.tweenRaf = requestAnimationFrame(step);
      else { ATLAS.tweenRaf = 0; resolve(); }
    };
    ATLAS.tweenRaf = requestAnimationFrame(step);
  });
}
function atlasItemFrame(i) {
  const geom = ATLAS.geom, box = ATLAS.box, it = geom.items[i], cell = geom.cell;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  geom.grid.forEach((row, y) => {
    const s = String(row);
    for (let x = 0; x < s.length; x++) {
      if (SYM.indexOf(s[x]) !== i) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });
  const cx = it && it.c ? it.c[0] : (minX + maxX + 1) / 2 * cell;
  const cy = it && it.c ? it.c[1] : (minY + maxY + 1) / 2 * cell;
  const nx = (cx - box.x) / box.w, ny = (cy - box.y) / box.h;
  const rw = Number.isFinite(minX) ? (maxX - minX + 1) * cell / box.w : .12;
  const rh = Number.isFinite(minY) ? (maxY - minY + 1) * cell / box.h : .12;
  const z = Math.min(4.2, Math.max(2.35, .78 / Math.max(rw, rh, .08)));
  return { z, panX: -(nx - .5) * 100, panY: -(ny - .5) * 100 };
}
function atlasClearGhost() {
  const ghost = $('#atlasGhost');
  if (!ghost) return;
  ghost.hidden = true;
  ghost.replaceChildren();
  atlasSetO(ghost, 1);
}
function atlasShowGhost(from) {
  const ghost = $('#atlasGhost');
  if (!ghost || !from) return null;
  atlasCopyPlane(from, ghost);
  ghost.hidden = false;
  atlasSetO(ghost, 1);
  return ghost;
}
function atlasMaybeDive() {
  if (!ATLAS || ATLAS.busy) return;
  const i = ATLAS.hotI;
  if (i == null || i < 0 || !ATLAS.geom || !ATLAS.geom.items[i]) return;
  if ((ATLAS.aim && ATLAS.aim.z || ATLAS.z || 1) < 2.2) return;
  if (!atlasChild(ATLAS.tree, ATLAS.slug, ATLAS.geom.items[i].name)) return;
  atlasDive(i);
}
function atlasApplyLod() {
  if (!ATLAS || !ATLAS.geom) return;
  const plane = $('#atlasPlane');
  if (!plane) return;
  const ranks = ATLAS.geom.items.map(it => unitRank(it.name));
  const coarse = ranks.length ? Math.min.apply(null, ranks) : 0;
  const steps = [0, .4, .65, 1.1, 1.35, 1.7];
  const z = ATLAS.z || 1;
  plane.querySelectorAll('.ar-name').forEach(el => {
    const i = +el.dataset.area;
    const need = 1 + (steps[Math.max(0, (ranks[i] || 0) - coarse)] || 0);
    const keep = ATLAS.pick && ATLAS.pick.i === i;
    el.classList.toggle('dim', !keep && z < need - .02);
  });
}
function atlasPaintPick() {
  const plane = $('#atlasPlane');
  if (!plane) return;
  plane.querySelectorAll('.gu.pick').forEach(g => g.classList.remove('pick'));
  plane.querySelectorAll('.ar-name.pick').forEach(el => el.classList.remove('pick'));
  if (!ATLAS || !ATLAS.pick) return;
  const g = plane.querySelector(`.gu[data-area="${ATLAS.pick.i}"]`);
  if (g) g.classList.add('pick');
  const tag = plane.querySelector(`.ar-name[data-area="${ATLAS.pick.i}"]`);
  if (tag) tag.classList.add('pick');
}
async function atlasTellCourse() {
  const name = $('#atlasName');
  if (!name || !ATLAS) return;
  const slug = atlasPlaySlug();
  if (!slug) { name.textContent = ATLAS.idle || ''; return; }
  try {
    const course = await loadCourse(slug);
    name.textContent = courseLabel(course);
  } catch { name.textContent = ATLAS.pick ? adminLabel(ATLAS.pick.name) : ATLAS.idle; }
}
function atlasPick(i) {
  if (!ATLAS || !ATLAS.geom || !ATLAS.geom.items[i]) return;
  const name = ATLAS.geom.items[i].name;
  const child = atlasChild(ATLAS.tree, ATLAS.slug, name);
  ATLAS.pick = { i, name, slug: child || ATLAS.slug };
  atlasPaintPick();
  atlasTellCourse();
}
async function atlasDive(i) {
  if (!ATLAS || ATLAS.busy || !ATLAS.geom || !ATLAS.geom.items[i]) return;
  const name = ATLAS.geom.items[i].name;
  const child = atlasChild(ATLAS.tree, ATLAS.slug, name);
  if (!child) return;
  ATLAS.busy = true;
  ATLAS.want = null;
  const fly = ++ATLAS.flyGen;
  const plane = $('#atlasPlane');
  const dest = atlasItemFrame(i);
  const zS = ATLAS.z, xS = ATLAS.panX, yS = ATLAS.panY;
  loadGeom(child);
  await atlasTween(520, k => {
    if (fly !== ATLAS.flyGen) return;
    ATLAS.z = atlasLerp(zS, dest.z, k);
    ATLAS.panX = atlasLerp(xS, dest.panX, k);
    ATLAS.panY = atlasLerp(yS, dest.panY, k);
    atlasSyncAim();
    atlasApplyCam();
  });
  if (!ATLAS || fly !== ATLAS.flyGen) return;
  if (ATLAS.want === 'out') {
    ATLAS.busy = false;
    atlasRise();
    return;
  }
  const ghost = atlasShowGhost(plane);
  ATLAS.pick = null;
  ATLAS.stack.push({ slug: child, name });
  ATLAS.z = .92; ATLAS.panX = 0; ATLAS.panY = 0;
  atlasSyncAim();
  await paintAtlas();
  if (!ATLAS || fly !== ATLAS.flyGen) return;
  atlasSetO(plane, 0);
  const gz0 = dest.z, gz1 = dest.z * 1.16;
  await atlasTween(420, k => {
    if (fly !== ATLAS.flyGen) return;
    ATLAS.z = atlasLerp(.92, 1, k);
    ATLAS.panX = 0; ATLAS.panY = 0;
    atlasSyncAim();
    atlasApplyCam();
    atlasSetO(plane, k);
    if (ghost) {
      ghost.style.setProperty('--atlas-z', atlasLerp(gz0, gz1, k).toFixed(3));
      ghost.style.setProperty('--pan-x', dest.panX.toFixed(2));
      ghost.style.setProperty('--pan-y', dest.panY.toFixed(2));
      atlasSetO(ghost, 1 - k);
    }
  });
  if (fly !== ATLAS.flyGen) return;
  atlasClearGhost();
  atlasSetO(plane, 1);
  ATLAS.z = 1; ATLAS.panX = 0; ATLAS.panY = 0;
  atlasSyncAim();
  atlasApplyCam();
  ATLAS.busy = false;
  ATLAS.hotI = -1;
  if (ATLAS.want === 'out') atlasRise();
}
function atlasEnter(i) { atlasDive(i); }
async function atlasRise() {
  if (!ATLAS || ATLAS.stack.length < 2 || ATLAS.busy) return false;
  ATLAS.busy = true;
  ATLAS.want = null;
  const fly = ++ATLAS.flyGen;
  const left = ATLAS.stack[ATLAS.stack.length - 1];
  const plane = $('#atlasPlane');
  const childZ0 = ATLAS.z, childX0 = ATLAS.panX, childY0 = ATLAS.panY;
  const ghost = atlasShowGhost(plane);
  ATLAS.pick = null;
  ATLAS.stack.pop();
  await paintAtlas();
  if (!ATLAS || fly !== ATLAS.flyGen) return true;
  const idx = ATLAS.geom.items.findIndex(it => it.name === left.name);
  const framed = idx >= 0 ? atlasItemFrame(idx) : { z: 2.2, panX: 0, panY: 0 };
  ATLAS.z = framed.z; ATLAS.panX = framed.panX; ATLAS.panY = framed.panY;
  atlasSyncAim();
  atlasApplyCam();
  atlasSetO(plane, 0);
  if (ghost) {
    ghost.style.setProperty('--atlas-z', childZ0.toFixed(3));
    ghost.style.setProperty('--pan-x', childX0.toFixed(2));
    ghost.style.setProperty('--pan-y', childY0.toFixed(2));
    atlasSetO(ghost, 1);
  }
  await atlasTween(520, k => {
    if (fly !== ATLAS.flyGen) return;
    ATLAS.z = atlasLerp(framed.z, 1, k);
    ATLAS.panX = atlasLerp(framed.panX, 0, k);
    ATLAS.panY = atlasLerp(framed.panY, 0, k);
    atlasSyncAim();
    atlasApplyCam();
    atlasSetO(plane, k);
    if (ghost) {
      ghost.style.setProperty('--atlas-z', atlasLerp(childZ0, Math.max(.72, childZ0 * .72), k).toFixed(3));
      atlasSetO(ghost, 1 - k);
    }
  });
  if (fly !== ATLAS.flyGen) return true;
  atlasClearGhost();
  atlasSetO(plane, 1);
  ATLAS.z = 1; ATLAS.panX = 0; ATLAS.panY = 0;
  atlasSyncAim();
  atlasApplyCam();
  ATLAS.busy = false;
  ATLAS.hotI = -1;
  return true;
}
function atlasLeave() { return atlasRise(); }

async function showAtlasPlay(slug) {
  const ov = $('#atlasOv');
  if (!ov) return;
  const n = ++atlasGen;
  const course = await loadCourse(slug);
  if (n !== atlasGen) return;
  const pane = $('#ovTpl').content.firstElementChild.cloneNode(true);
  pane.querySelector('.ov-title').textContent = courseLabel(course);
  pane.querySelector('.ov-total').textContent = '/' + course.items.length;
  pane.querySelector('.ov-time').textContent = clock(opt.time);
  ov.replaceChildren(pane);
  ov.hidden = false;
  requestAnimationFrame(() => pane.querySelector('.ov-start').focus());
  wireDock(pane);
  pane.querySelector('.ov-start').onclick = () => { hideAtlasOv(); start(slug); };
  const [, geom] = await load(slug);
  if (n !== atlasGen) return;
  const items = course.items.map(it => ({ ...it }));
  const svg = pane.querySelector('.ov-map');
  svg.setAttribute('viewBox', `0 0 ${geom.w} ${geom.h}`);
  drawDots(svg, geom, items);
  if (course.mode === 'sequence' && items[0] && items[0].el) items[0].el.classList.add('target');
}

async function paintAtlas() {
  if (!ATLAS) return;
  hideAtlasOv();
  atlasRedraw.forEach(f => {
    const i = REDRAW.indexOf(f);
    if (i >= 0) REDRAW.splice(i, 1);
  });
  atlasRedraw = [];
  const n = ++atlasGen;
  const slug = ATLAS.stack[ATLAS.stack.length - 1].slug;
  const geom = await loadGeom(slug);
  if (n !== atlasGen) return;
  ATLAS.slug = slug;
  ATLAS.geom = geom;
  ATLAS.idle = ATLAS.slug === 'seoul-gu' ? t('idleNested') : t('idleAdmin');
  const plane = $('#atlasPlane'), name = $('#atlasName');
  const head = $('#regions .head');
  const here = ATLAS.stack[ATLAS.stack.length - 1];
  head.textContent = here.name ? adminLabel(here.name) : t('regions');
  const draw = () => {
    const { svg, box, names } = atlasSvg(geom);
    ATLAS.box = box;
    plane.style.setProperty('--atlas-ar', (box.w / box.h).toFixed(3));
    /* 판 크기는 격자 촘촘함에서 딴다 — 한 칸을 늘 비슷한 크기로 찍는다.
       한국은 53줄이라 판이 화면을 넘어(밀 데가 생기고), 미국은 9줄짜리
       그림글자라 한 화면에 다 들어온다. 못 박은 vh 로는 이 둘이 안 맞는다. */
    plane.style.setProperty('--atlas-rows-h', Math.round(box.h / geom.cell * 44) + 'px');
    plane.style.setProperty('--atlas-bw', box.w.toFixed(2));
    plane.innerHTML = svg;
    names.forEach(n => {
      const el = document.createElement('span');
      el.className = 'ar-name';
      el.dataset.area = String(n.i);
      n.lines.forEach((line, k) => {
        if (k) el.append(document.createElement('br'));
        el.append(line);
      });
      el.style.setProperty('--x', n.x.toFixed(2) + '%');
      el.style.setProperty('--y', n.y.toFixed(2) + '%');
      el.style.setProperty('--ns', n.ns.toFixed(2));
      plane.appendChild(el);
    });
    atlasApplyCam();
    atlasPaintPick();
  };
  REDRAW.push(draw); atlasRedraw.push(draw); draw();
  if (ATLAS.pick) atlasTellCourse();
  else name.textContent = ATLAS.idle;
}

async function renderAtlas() {
  const pack = WORLD.countries.find(c => c.id === COUNTRY) || WORLD.countries[0];
  if (!pack) return;
  const slug = `${pack.id.toLowerCase()}-admin`;
  /* 한국만 시·도 아래에 또 판이 있다(kr-tree). 나머지 나라는 행정구역 한 벌로 끝난다 */
  const tree = pack.id === 'KR' ? await grab('data/kr-tree.json') : null;
  ATLAS = { tree, stack: [{ slug, name: '' }], idle: t('idleAdmin'),
    z: 1, panX: 0, panY: 0, aim: { z: 1, x: 0, y: 0 },
    pick: null, busy: false, flyGen: 0, hotI: -1, camRaf: 0, tweenRaf: 0, want: null };
  await paintAtlas();
  wireAtlas();
}

function atlasBack() {
  if ($('#atlasOv') && !$('#atlasOv').hidden) { hideAtlasOv(); return; }
  if (ATLAS && ATLAS.stack.length > 1) { atlasLeave(); return; }
  go('title');
}

function closeAtlas() {
  if (!$('#regions').classList.contains('on')) return false;
  if ($('#atlasOv') && !$('#atlasOv').hidden) { hideAtlasOv(); return true; }
  if (ATLAS && ATLAS.stack.length > 1) { atlasLeave(); return true; }
  return false;
}

function wireAtlas() {
  const atlas = $('#atlas'), plane = $('#atlasPlane'), name = $('#atlasName');
  if (atlas.dataset.wired) return;
  atlas.dataset.wired = '1';
  /* 구역 이름 17개를 다 띄우면 서로 밟는다 — 짚는 곳만 아래 한 줄로 읽는다 */
  const hot = i => {
    plane.querySelectorAll('.ar-name.on').forEach(el => el.classList.remove('on'));
    if (i == null) return;
    const el = plane.querySelector(`.ar-name[data-area="${i}"]`);
    if (el) el.classList.add('on');
  };
  const tell = g => {
    if (g) {
      name.textContent = adminLabel(g.getAttribute('aria-label') || '');
      hot(g.dataset.area);
      return;
    }
    hot(null);
    if (ATLAS && ATLAS.pick) atlasTellCourse();
    else name.textContent = (ATLAS && ATLAS.idle) || '';
  };
  /* 커서가 카메라다 — 커서가 간 쪽 땅이 앞으로 오도록 판을 반대로 민다.
     따라오는 맛은 CSS transition 이 낸다. rAF 루프를 따로 돌리지 않는다. */
  const aim = (mx, my) => {
    atlas.style.setProperty('--mx', mx.toFixed(3));
    atlas.style.setProperty('--my', my.toFixed(3));
  };
  let drag = null, pinch = 0;
  const zoomAt = (factor, cx, cy) => {
    if (!ATLAS) return;
    if (ATLAS.busy) {
      ATLAS.want = factor < 1 ? 'out' : 'in';
      return;
    }
    if (!ATLAS.aim) ATLAS.aim = { z: ATLAS.z || 1, x: ATLAS.panX || 0, y: ATLAS.panY || 0 };
    const z0 = ATLAS.aim.z || 1;
    let z1 = Math.min(4.8, Math.max(.98, z0 * factor));
    if (z1 < 1) {
      atlasRise();
      return;
    }
    const keep = atlasPanToKeep(cx, cy, z1);
    const [ax, ay] = atlasClampXY(z1, keep.x, keep.y);
    ATLAS.aim.x = ax; ATLAS.aim.y = ay;
    ATLAS.aim.z = z1;
    ATLAS.z = z1; ATLAS.panX = ax; ATLAS.panY = ay;
    if (z1 > 1.02) aim(0, 0);
    atlasApplyCam();
    const hit = document.elementFromPoint(cx, cy);
    const g = hit && hit.closest ? hit.closest('.gu') : null;
    ATLAS.hotI = g ? +g.dataset.area : -1;
    if (ATLAS.hotI >= 0 && ATLAS.geom && ATLAS.geom.items[ATLAS.hotI]) {
      const sl = atlasChild(ATLAS.tree, ATLAS.slug, ATLAS.geom.items[ATLAS.hotI].name);
      if (sl && z1 > 1.55) loadGeom(sl);
    }
    atlasMaybeDive();
  };
  atlas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * .0018), e.clientX, e.clientY);
  }, { passive: false });
  atlas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
  }, { passive: true });
  atlas.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    const a = e.touches[0], b = e.touches[1];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
    zoomAt(d / pinch, mx, my);
    pinch = d;
  }, { passive: false });
  atlas.addEventListener('touchend', () => { pinch = 0; });
  atlas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && pinch) return;
    drag = { x: e.clientX, y: e.clientY, px: ATLAS.panX || 0, py: ATLAS.panY || 0, moved: false, id: e.pointerId };
  });
  atlas.addEventListener('pointermove', e => {
    if (drag) {
      const w = plane.offsetWidth || 1, h = plane.offsetHeight || 1;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (dx * dx + dy * dy > 25) drag.moved = true;
      const tilt = atlasTiltOf(ATLAS.z || 1) * Math.PI / 180;
      const cos = Math.max(.38, Math.cos(tilt));
      ATLAS.panX = ATLAS.aim.x = drag.px + dx / w * 100;
      ATLAS.panY = ATLAS.aim.y = drag.py + dy / (h * cos) * 100;
      atlasApplyCam();
      return;
    }
    if ((ATLAS.z || 1) > 1.06) return;
    const b = atlas.getBoundingClientRect();
    aim(.5 - (e.clientX - b.left) / b.width, .5 - (e.clientY - b.top) / b.height);
  });
  atlas.addEventListener('pointerup', () => { drag = null; });
  atlas.addEventListener('pointercancel', () => { drag = null; });
  atlas.addEventListener('pointerleave', () => { if ((ATLAS.z || 1) <= 1.06) aim(0, 0); });
  plane.addEventListener('pointerover', e => tell(e.target.closest('.gu')));
  plane.addEventListener('pointerout', () => tell(null));
  /* SVG 묶음은 초점을 받아도 focus 를 안 쏜다. focusin 은 위로 올라오므로 그걸 쓴다 —
     키보드로 옮긴 초점도 카메라가 따라가야 마우스와 같은 화면을 본다 */
  plane.addEventListener('focusin', e => {
    const g = e.target.closest && e.target.closest('.gu');
    if (!g || !ATLAS) return;
    const [cx, cy] = ATLAS.geom.items[+g.dataset.area].c;
    const b = ATLAS.box;
    aim(.5 - (cx - b.x) / b.w, .5 - (cy - b.y) / b.h);
    tell(g);
  });
  plane.addEventListener('click', e => {
    if (drag && drag.moved) return;
    const g = e.target.closest('.gu');
    if (!g || !ATLAS) return;
    atlasPick(+g.dataset.area);
  });
  /* SVG 묶음은 버튼이 아니라 Enter·Space 가 저절로 눌리지 않는다 */
  plane.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest && e.target.closest('.gu');
    if (!g) return;
    e.preventDefault();
    atlasPick(+g.dataset.area);
  });
  $('#atlasBack').onclick = atlasBack;
  const goPlay = $('#atlasStart');
  if (goPlay) goPlay.onclick = () => {
    const slug = atlasPlaySlug();
    if (slug) start(slug);
  };
}

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
  await renderAtlas();
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
  wireGridBtns();
  ghStars();
  const langBox = $('#optLang');
  if (langBox) {
    langBox.addEventListener('change', e => {
      const r = e.target.closest('input[name="rtLang"]');
      if (!r) return;
      opt.lang = r.value; saveOpt();
      LANG = resolveLang();
      paintUI(fillLangPick);
      fbPlaceholder(); paintRegion(); renderAtlas();
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
    // 어간('서울')과 줄인 행정명('서울시') 둘 다 쳐서 맞는다.
    // 코스가 손으로 적어 둔 별칭(울릉도 같은 것)은 그대로 남는다
    const also = [stripSuffix(it.name), adminLabel(it.name)]
      .filter(a => a && a !== it.name);
    // 한 줄 소개는 아직 사람이 안 쓴 코스가 있다. 여기서 한 번만 채워 두면
    // 목표 줄·자유형·결과 목록이 저마다 undefined 를 막을 필요가 없다
    return { ...it, meta: { description: '', ...it.meta },
             aliases: [...new Set([...(it.aliases || []), ...also])], claimed: false };
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
    if (it.label) it.label.textContent = adminLabel(g.name);
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

/* 안내에 띄울 이름. 행정명을 한 자로 줄여 붙인다 — 서울시, 제주도.
   경기도·강남구처럼 이미 짧으면 정식 명칭 그대로다. */
const promptName = it => adminLabel(it.name);

/* 칠 수 있는 가장 긴 이름의 길이. 안내에 '서울시'가 떠 있어도
   '서울특별시'까지 쳐져야 하므로 별칭 길이도 같이 잰다. */
const typeCap = it => it
  ? Math.max(it.name.length, ...(it.aliases || []).map(a => a.length))
  : 0;

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
  const cap = G.seq ? typeCap(target()) : 0;
  if (cap && !(G.spacy && /\s/.test(G.want || '')) && !/\s/.test(val) && val.length > cap) {
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

  /* 시·도. 홑 '도' 가 접미 문자류에 없으면 경기도는 약칭이 아예 안 생긴다 */
  const sido = mk(['경기도', '강원도', '충청북도', '충청남도', '제주특별자치도']);
  console.assert(m('경기', sido) === '경기도', '도 접미 약칭');
  console.assert(m('제주', sido) === '제주특별자치도', '특별자치도가 홑 도보다 먼저 걸린다');
  console.assert(m('충청', sido) === null, '충청북도/충청남도 사이에서 미확정');
  sido[2].aliases.push('충북'); sido[3].aliases.push('충남');
  console.assert(m('충북', sido) === '충청북도', '통용 약칭은 별칭으로 박는다');
  const seom = mk(['울릉도', '독도']);
  console.assert(m('울릉', seom) === '울릉도', '섬 이름도 도 접미를 탄다');
  console.assert(m('독', seom) === null, '한 글자 어간은 약칭으로 인정하지 않는다');

  /* 화면 이름은 행정명을 한 자로 줄여 붙인다 */
  console.assert(adminLabel('서울특별시') === '서울시', '특별시는 시로 줄인다');
  console.assert(adminLabel('세종특별자치시') === '세종시', '특별자치시도 시로');
  console.assert(adminLabel('광주광역시') === '광주시', '광역시도 시로');
  console.assert(adminLabel('제주특별자치도') === '제주도', '특별자치도는 도로');
  console.assert(adminLabel('경기도') === '경기도', '이미 짧은 이름은 그대로 둔다');
  console.assert(adminLabel('강남구') === '강남구', '자치구가 아닌 구도 그대로');
  console.assert(adminLabel('California') === 'California', '한국 밖 이름은 손대지 않는다');

  /* 안내에 '서울시'가 떠 있어도 어간·줄인 이름·정식 명칭이 모두 맞는다 */
  const mkAdmin = names => names.map(n => ({
    name: n,
    aliases: [...new Set([stripSuffix(n), adminLabel(n)].filter(a => a && a !== n))],
    claimed: false,
  }));
  const si = mkAdmin(['서울특별시', '부산광역시', '제주특별자치도']);
  console.assert(m('서울', si) === '서울특별시', '어간만 쳐도 맞는다');
  console.assert(m('서울시', si) === '서울특별시', '줄인 행정명도 맞는다');
  console.assert(m('서울특별시', si) === '서울특별시', '정식 명칭도 그대로 맞는다');
  console.assert(m('제주도', si) === '제주특별자치도', '제주도로도 맞는다');
  console.assert(typeCap(si[0]) === '서울특별시'.length, '입력 한도는 가장 긴 이름에서 딴다');

  const tree = { children: {
    'kr-admin/서울특별시': 'seoul-gu', 'kr-admin/세종특별자치시': null,
    'seoul-gu/강서구': 'gangseo-dong', 'busan-sgg/강서구': null,
  } };
  console.assert(atlasChild(tree, 'kr-admin', '서울특별시') === 'seoul-gu', '서울은 구 판으로');
  console.assert(atlasChild(tree, 'kr-admin', '세종특별자치시') === null, '세종은 코스가 없다');
  console.assert(atlasDeeper(tree, 'seoul-gu') === true, '서울은 구 판으로 내려간다');
  console.assert(atlasDeeper(tree, 'busan-sgg') === true, '부산도 시군구 판으로 내려간다');
  console.assert(atlasDeeper(tree, null) === false, '세종처럼 자식이 없으면 내려가지 않는다');
  console.assert(atlasChild(null, 'us-admin', 'California') === null, 'tree 없으면 구역 코스 없음');
  console.assert(unitRank('경기도') === 0 && unitRank('강남구') === 1, '도<구');
  console.assert(unitRank('울릉군') === 2 && unitRank('한솔동') === 3, '군<동');
  console.assert(unitRank('금남면') === 4 && unitRank('조치원읍') === 5, '면<읍');
  console.assert(atlasPlaySlug({ pick: { slug: 'sejong-emd' }, slug: 'kr-admin' }) === 'sejong-emd', '고른 코스');
  console.assert(atlasPlaySlug({ pick: null, slug: 'kr-admin' }) === 'kr-admin', '안 고르면 지금 판');
  console.assert(Math.abs(atlasEase(0)) < 1e-5, 'ease 시작은 0');
  console.assert(Math.abs(atlasEase(1) - 1) < 1e-3, 'ease 끝은 1');
  console.assert(atlasEase(.5) > .15 && atlasEase(.5) < .85, 'ease 중간은 가운데');
  console.assert(Math.abs(atlasZoomPan(0, -.3, 1, 2) - 30) < 1e-6, '왼쪽을 키우면 판이 오른쪽으로 간다');
  console.assert(Math.abs(atlasZoomPan(0, .25, 1, 2) + 25) < 1e-6, '오른쪽을 키우면 판이 왼쪽으로 간다');
  console.assert(Math.abs(atlasZoomPan(10, 0, 1, 2) - 10) < 1e-6, '한가운데는 pan 이 그대로다');

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
