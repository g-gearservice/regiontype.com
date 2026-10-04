/* regiontype 설정 덮개. 제 페이지가 아니라 홈(index.html) 위에 뜬다 —
   뒤의 자치구 칸이 배경 비트맵이 된다. 전환은 style.css 의 body.setting.
   /settings/ 는 해시만 여기로 넘기는 착지대다(signin/ 과 같은 결).

   app.js 와 한 문서에 함께 실리므로 전부를 한 겹 함수 안에 둔다.            */
(function () {
'use strict';

const $ = s => document.querySelector(s);
/* VER 을 여기 또 적지 않는다 — 손으로 고칠 자리는 index.html 의 ?v= 하나다 */
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const grab = url => fetch(asset(url)).then(r => r.json());

const RELAY = self.RT_RELAY;   // relay.js
const TOKEN_KEY = 'rt.token', BIND_KEY = 'rt.bind', NAME_KEY = 'rt.name';
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

/* mimi 와 같은 갈림 — 개발에서만 지역·언어 고르기 문이 열린다 */
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:') {
  document.documentElement.dataset.dev = '';
}
const isDev = () => document.documentElement.hasAttribute('data-dev');

/* ── 설정 통 ─────────────────────────────────────────
   홈(app.js)과 같은 통, 같은 기본값이다. 키 집합이 어긋나면 한쪽이 저장할 때마다
   다른 쪽 값이 지워진다 */
const DEF = { time: 120, night: false, sound: true, motion: true, hint: true, grid: true, softkb: true, kbhint: true,
              lang: 'auto', country: 'auto', unit: 'auto', dong: 'admin', where: true };
const opt = Object.assign({}, DEF, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
for (const k of Object.keys(opt)) if (!(k in DEF)) delete opt[k];

/* 홈 봇이 바꾸는 설정(ranked.js 의 act). 여기 통을 거쳐야 이 덮개의 opt 가 낡지 않는다 —
   밖에서 localStorage 만 고치면 다음 토글이 옛 값을 도로 덮어쓴다. 모르는 키·꼴은 버린다 */
addEventListener('rt-bot-opt', ({ detail }) => {
  const ok = Object.entries(detail || {}).filter(([k, v]) =>
    Object.hasOwn(DEF, k) && k !== 'lang' && k !== 'country' && k !== 'where' && typeof v === typeof DEF[k]);
  if (!ok.length) return;
  Object.assign(opt, Object.fromEntries(ok));
  saveOpt();
});
/* kind 가 있으면(야간·언어) 즉석에서 칠하지 않고 부드러운 새로고침(app.js softReload)으로 넘긴다.
   판이 살아 있거나 못 하면 false 가 와서 예전처럼 칠한다 */
const saveOpt = kind => {
  localStorage.setItem('rt.opt', JSON.stringify(opt));
  if (kind && softReload(kind)) return true;
  document.documentElement.toggleAttribute('data-night', opt.night);
  document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
  document.documentElement.toggleAttribute('data-no-grid', !opt.grid);
  requestAnimationFrame(syncOptShell);
  paintPressed();
  paintUnit();
  dispatchEvent(new CustomEvent('rt-opt'));
  return false;
};

const paintPressed = () =>
  document.querySelectorAll('#options [data-opt]').forEach(b => b.setAttribute('aria-pressed', !!opt[b.dataset.opt]));
/* 다른 탭이 rt.opt 를 고치면 메모리 opt 를 맞춘다 — 안 그러면 여기서 다음에 저장할 때
   낡은 값(꺼 둔 where 등)이 도로 덮어쓴다. 여기서 setItem 하면 탭끼리 핑퐁이니 칠하기만 한다 */
addEventListener('storage', e => {
  if (e.key !== 'rt.opt' && e.key !== null) return;
  let next = {};
  try { next = JSON.parse(localStorage.getItem('rt.opt') || '{}') || {}; } catch {}
  Object.assign(opt, DEF, next);
  for (const k of Object.keys(opt)) if (!(k in DEF)) delete opt[k];
  paintPressed();
});

/* ── 화면 말 ─────────────────────────────────────────── */
let UI_LANGS = ['ko'];
let I18N = { ko: {} }, LANG = 'ko';
let WORLD = { countries: [] };
/* 없는 키는 빈 값을 낸다 — 부르는 쪽이 HTML 에 적힌 말을 덮지 않게 */
const t = (key, vars) => {
  let s = (I18N[LANG] || {})[key] || (I18N.ko || {})[key] || '';
  if (s && vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
};
function applyI18n(root) {
  root.querySelectorAll('[data-i18n]').forEach(el => { const s = t(el.dataset.i18n); if (s) el.textContent = s; });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const s = t(el.dataset.i18nAria); if (s) el.setAttribute('aria-label', s);
  });
}
function langLabel(code) {
  /* 설정 언어 목록은 각 언어의 자기 이름(endonym)으로 보여준다 — UI 가 한국어여도
     Deutsch·日本語·ไทย 로 읽히게. Intl 은 코드를 로케일로 쓰면 그 언어 이름을 돌려준다 */
  try { return new Intl.DisplayNames([code], { type: 'language' }).of(code) || code; }
  catch { return code; }
}
const countryName = id => {
  try { return new Intl.DisplayNames([LANG], { type: 'region' }).of(id) || id; }
  catch { return id; }
};

/* 장식 격자는 홈(app.js 의 syncGrid)이 그린다. 셸 높이는 격자 칸의 정수배로 두되
   셸의 세로 중심은 뷰포트의 정중앙에 고정한다. 칸 수는 뷰포트 56% 근방에서 고르되
   레일(.opts-tabs) 자연 높이를 밑돌지 않는다(밑돌면 탭이 잘린다) — 탭 글자로
   재지 않는 건 언어마다 글자 길이가 달라 통이 뛰는 걸 막기 위해서다.
   손가락 화면에서는 레일이 가로로 눕고 셸 높이가 auto 라 격자 정렬 자체가 없다 —
   여기서 값을 넣으면 오히려 높이를 못 박아 판이 잘린다 */
function syncOptShell() {
  if (matchMedia('(pointer:coarse)').matches) return;
  const rail = $('.opts-tabs'), p = $('#bitgrid');
  if (!rail || !p || !rail.getClientRects().length) return;
  const cell = Number(p.getAttribute('height'));
  /* 레일 높이는 첫 탭 윗변 ~ 마지막 탭 아랫변 — 레일이 스스로 굴러도(아래) 변하지 않는다 */
  const tabs = rail.children, railH = tabs.length
    ? tabs[tabs.length - 1].getBoundingClientRect().bottom - tabs[0].getBoundingClientRect().top : 0;
  if (!(cell > 0) || !(railH > 0)) return;
  const vh = window.innerHeight;
  const minCells = Math.max(1, Math.ceil(railH / cell));
  const wantCells = Math.max(minCells, Math.round(vh * 0.56 / cell));
  /* 가운데에 두되, 위 흐림 띠 안으로는 안 올라간다 — 낮은 창에서 레일이 제목과 겹치고
     레일 옆에서 시작하는 언어 목록 머리도 흐림에 묻힌다. 그러다 화면 아래를 넘으면 셸을
     화면 끝에서 자르고 레일이 셸 안에서 굴러간다(아래 흐림 띠만큼 여백을 둬 마지막 탭도 올라선다) */
  const edge = sel => { const e = $(sel); return e ? e.getBoundingClientRect().height : 0; };
  const blurT = edge('#options > .backdrop-blur:not(.bot)'), blurB = edge('#options > .backdrop-blur.bot');
  let h = wantCells * cell;
  const mid = (vh - h) / 2, top = Math.max(mid, blurT);
  const tight = top + h > vh;
  if (tight) h = vh - top;
  const st = document.documentElement.style;
  const zc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zc')) || 1;
  st.setProperty('--opt-shell-h', h + 'px');
  st.setProperty('--opt-shell-dy', (top - (vh - h) / 2) + 'px');
  st.setProperty('--opt-rail-pb', (tight ? blurB / zc : 0) + 'px');
  st.setProperty('--opt-rail-h', rail.offsetHeight + 'px');
  /* 통은 화면 위·아래까지. 목록이 언어 탭 옆에서 시작하도록 위 padding 만 잰다.
     셸 윗변은 방금 고른 top 을 쓴다 — 들어올 때 getBoundingClientRect 는 아직 바닥이다.
     맨 아래 글자는 버전 탭에서 멈추되, 아래 흐림 띠 밑으로는 안 내려간다 */
  const inner = 28;
  const railTop = top + Math.max(0, (h - railH) / 2);
  const railBot = Math.min(vh, railTop + railH);
  st.setProperty('--opt-pick-h', (vh / zc) + 'px');
  st.setProperty('--opt-pick-dy', ((-top) / zc) + 'px');
  st.setProperty('--opt-pick-pad-t', (railTop / zc) + 'px');
  st.setProperty('--opt-pick-pad-b', (Math.max(blurB + inner, vh - railBot + inner) / zc) + 'px');
}

/* 데스크톱 확대는 125% 까지만 레이아웃에 반영한다 — 그 위로는 설정 셸을 같은 비율로
   되돌려(--zc) 고르기 판 두 열이 한 열로 접히지 않게 한다. 확대 자체는 페이지가 막을
   수 없다. 확대율은 창 바깥/안쪽 폭의 비로 재고 5% 눈금으로 반올림한다 */
const ZOOM_CAP = 1.25;
function capZoom() {
  const z = Math.round((window.outerWidth / window.innerWidth) * 20) / 20;
  const fine = matchMedia('(pointer:fine)').matches;
  const k = (fine && z > ZOOM_CAP) ? ZOOM_CAP / z : 1;
  document.documentElement.style.setProperty('--zc', String(k));
}

/* ── 언어·지역 고르기 ─────────────────────────────────
   대륙별 fieldset · 2열 라디오. 화살표·스페이스 이동은 같은 name 을 쓰는 네이티브
   라디오가 맡으므로 keydown 을 가로채지 않는다 */
const LANG_CONTINENTS = [
  ['continentAsia',         ['ko', 'ja', 'zh', 'vi', 'th', 'id', 'ms']],
  ['continentEurope',       ['de', 'fr', 'it', 'nl', 'pl', 'cs', 'sv', 'nb', 'fi', 'uk', 'ro', 'hu', 'bg', 'el', 'tr']],
  ['continentNorthAmerica', ['en']],
  ['continentSouthAmerica', ['es', 'pt']],
  ['continentAfricaMena',   ['ar']],
];
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
const haveCountry = id => WORLD.countries.some(c => c.id === id);

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

/* 다시 그리면 초점이 날아가므로 화살표로 고르던 칸을 값으로 기억해 되돌린다.
   '자동' 칸은 없다 — 지금 잡힌 값(cur)을 체크로 보여줄 뿐, 짚어야 opt 가 그 값으로 굳는다 */
function fillPick(box, name, groups, label, cur, locale) {
  const held = document.activeElement;
  const heldValue = held && held.name === name ? held.value : null;
  box.replaceChildren();
  for (const [key, have] of groups) {
    if (!have.length) continue;
    have.sort((a, b) => label(a).localeCompare(label(b), locale));
    const fs = document.createElement('fieldset');
    fs.className = 'region-group';
    const lg = document.createElement('legend');
    lg.textContent = t(key);
    const grid = document.createElement('div');
    grid.className = 'region-grid';
    have.forEach(v => grid.append(pickRow(name, v, label(v), cur)));
    fs.append(lg, grid);
    box.append(fs);
  }
  if (heldValue) box.querySelector(`input[name="${name}"][value="${heldValue}"]`)?.focus();
}

function fillLangPick() {
  const box = $('#optLang');
  if (!box) return;
  fillPick(box, 'rtLang', LANG_CONTINENTS.map(([k, codes]) => [k, codes.filter(c => UI_LANGS.includes(c))]),
           langLabel, UI_LANGS.includes(opt.lang) ? opt.lang : LANG);
}
/* 지역 탭은 개발 중이라 나라 고르기를 그리지 않는다. 안내는 HTML 의 pending 문장 */
function fillRegionPick() {}

/* ── 탭 ──────────────────────────────────────────────
   MM 스타일 세로 레일. role="tab" 사이를 화살표/Home/End 로 옮기고, 고른 탭만
   aria-selected="true" · tabindex="0" · 패널 hidden 해제로 남긴다. 고른 탭은
   해시에도 남는다 — 그래야 /settings/#security 딥링크가 산다 */
const coarse = () => matchMedia('(pointer:coarse)').matches;
const tabHash = tb => tb.getAttribute('aria-controls').slice(4).toLowerCase();
let pickTab = () => {};
function wireOptsTabs() {
  const allTabs = [...document.querySelectorAll('.opts-tabs [role="tab"]')];
  const tabs = allTabs.filter(tb => isDev() || !tb.hasAttribute('data-dev-only'));
  const rail = document.querySelector('.opts-tabs');
  if (!rail || !tabs.length) return;
  let cur = null;
  const select = (tab, keepHash) => {
    const dir = cur ? Math.sign(allTabs.indexOf(tab) - allTabs.indexOf(cur)) : 0;
    cur = tab;
    allTabs.forEach(tb => {
      const on = tb === tab;
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tb.getAttribute('aria-controls'));
      if (!panel) return;
      if (on) panel.style.setProperty('--dir', dir);
      panel.hidden = !on;
      if (on && panel.id === 'optsLanguage') fillLangPick();
      if (on && panel.id === 'optsRegion') fillRegionPick();
      if (on && panel.id === 'optsSecurity') account();
    });
    if (!keepHash) history.replaceState(null, '', location.pathname + location.search + '#' + tabHash(tab));
    /* 폰에서는 탭이 가로로 굴리는 한 줄이다 — 고른 칩이 줄 밖에 있으면 끌어온다.
       scrollIntoView 는 쓰지 않는다: sticky 칩이라 덮개까지 세로로 굴려 버린다 */
    if (coarse()) {
      const r = tab.getBoundingClientRect(), b = rail.getBoundingClientRect();
      if (r.left < b.left || r.right > b.right) rail.scrollLeft += r.left - b.left - 16;
    }
  };
  rail.addEventListener('click', e => {
    const tab = e.target.closest('[role="tab"]');
    if (tab && tabs.includes(tab)) select(tab);
  });
  /* 폰의 토글 줄은 줄 전체가 누름 자리다(iOS 설정 결). 라벨·빈자리를 짚어도 그 줄의
     토글을 누른다 — 토글 자체와 키보드 길은 그대로라 이벤트를 새로 만들지 않고 click 만 넘긴다 */
  document.querySelector('#options')?.addEventListener('click', e => {
    if (!coarse() || e.target.closest('button')) return;
    const cell = e.target.closest('.opts dt, .opts dd');
    const dd = cell?.matches('dt') ? cell.nextElementSibling : cell;
    dd?.querySelector('.toggle')?.click();
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
  /* 들어올 때 해시를 읽는다. 모르는 해시면 첫 탭 그대로 두고 주소도 안 건드린다 */
  pickTab = (name, keepHash) => {
    const want = tabs.find(tb => tabHash(tb) === String(name || '').toLowerCase());
    select(want || tabs[0], keepHash || !want);
  };
  /* 덮개가 아직 닫혀 있어도 ARIA·tabindex·hidden 을 현재 환경의 첫 탭에 맞춘다.
     개발은 언어, 배포는 화면이 첫 탭이다. CSS 는 이보다 먼저 개발용 판을 숨긴다. */
  select(tabs[0], true);
}

/* ── 타자 속도 단위 ──────────────────────────────────
   저장되는 값은 늘 CPM 이다(app.js 의 주석). 여기서 고르는 건 화면에 보일 자뿐이라,
   단위를 바꿔도 이미 올라간 기록은 그대로다 */
function paintUnit() {
  const box = $('#optUnit');
  if (!box) return;
  box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === opt.unit)));
  $('#optDong').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === opt.dong)));
}

/* ── 계정 보안 ──────────────────────────────────────── */
const toB64u = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => {
  const x = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(x + '='.repeat((4 - x.length % 4) % 4)), c => c.charCodeAt(0));
};
const say = (msg, bad) => {
  const p = $('#optSay');
  p.textContent = msg || '';
  p.classList.toggle('bad', !!bad);
};
const codesSay = (msg, bad) => {
  const p = $('#codesSay');
  p.textContent = msg || '';
  p.classList.toggle('bad', !!bad);
};

async function ask(path, body) {
  const head = { 'content-type': 'application/json' };
  const tok = token();
  if (tok) head.authorization = 'Bearer ' + tok;
  const r = await fetch(RELAY + path, { method: 'POST', headers: head, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.msg || String(r.status)); e.status = r.status; e.data = d; throw e; }
  return d;
}

/* 계정 상태는 중계기에게 묻는다 — 개수 둘뿐이다. 이 브라우저가 겪은 것만 세면
   다른 기기에서 만든 패스키도, 거기서 쓴 복구 코드도 안 보여 남은 개수가 틀리게
   뜬다. 비상구가 몇 개 남았는지는 틀리면 안 되는 숫자다.
   401 이면 죽은 토큰이니 여기서 같이 버린다 */
async function me() {
  const tok = token();
  if (!tok) return null;
  const r = await fetch(RELAY + '/auth/me', { headers: { authorization: 'Bearer ' + tok } });
  if (tok !== token()) return null;
  /* 토큰이 죽었으면 이 브라우저에 남긴 거울도 통째로 지운다. 이름만 지우고
     소개·캐릭터를 남기면, 다음 사람이 이 기기로 가입할 때 그 값이 그 사람의
     공개 프로필로 올라간다(welcome/welcome.js 의 save 참고) */
  if (r.status === 401) {
    try { for (const k of [TOKEN_KEY, NAME_KEY, 'rt.bio', 'rt.character', 'rt.botname', 'rt.intro']) localStorage.removeItem(k); } catch {}
    return null;
  }
  return r.ok ? r.json().catch(() => null) : null;
}

const canPasskey = () => !!(window.PublicKeyCredential && navigator.credentials?.create);

/* 이 기기에 패스키를 하나 만든다 — 로그인해 있어야 한다(2단계를 얹는 것이다) */
async function passkeyMake() {
  const d = await ask('/auth/new', {});
  /* 열쇠고리(애플 암호·구글 비밀번호 관리자)에 걸릴 이름. 정해 둔 아이디나
     닉네임이 있으면 그것을 쓴다 — 'regiontype · 55f247' 두 줄이 나란히 있으면
     같은 계정의 기기 둘인지 계정이 둘인지 사람이 가릴 수가 없다. 계정 id 앞
     여섯 자는 이름이 아직 없을 때의 마지막 수단으로만 남긴다(그래도 계정마다
     다른 값이라 두 줄이 서로 다른 계정임은 드러난다).
     ponytail: 이름을 나중에 바꿔도 이미 걸린 줄은 안 바뀐다 — 그건 열쇠고리가
     쥔 값이라 우리가 고칠 수 없다. 새로 만드는 줄부터 적용된다. */
  const name = d.name || ('regiontype · ' + d.user.slice(0, 6));
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: fromB64u(d.challenge),
    rp: d.rp,
    /* 사람 이름은 여전히 안 받는다 — 여기 실리는 건 이 사이트에서 고른 표시뿐이다 */
    user: { id: new TextEncoder().encode(d.user), name, displayName: name },
    /* 이 계정이 이미 가진 열쇠. 같은 기기에서 또 만들려 하면 브라우저가
       "이미 등록돼 있습니다" 로 막는다 — 한 기기가 한 계정에 두 줄을 쌓지 않는다 */
    excludeCredentials: (d.keys || []).map(id => ({ type: 'public-key', id: fromB64u(id) })),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    attestation: 'none', timeout: 60000,
  } });
  const r = cred.response;
  const out = await ask('/auth/reg', {
    challenge: d.challenge, id: toB64u(cred.rawId),
    /* getPublicKey() 가 SPKI 를 그대로 준다 — 서버에 CBOR 파서를 들일 이유가 없다 */
    key: toB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(),
    clientDataJSON: toB64u(r.clientDataJSON), authData: toB64u(r.getAuthenticatorData()),
  });
  localStorage.setItem(TOKEN_KEY, out.token);
  return out;
}

/* 패스키를 부르는 버튼은 전부 이 문을 지난다 — 취소와 진짜 실패는 다른 말이다 */
async function tryAuth(run, doing, btns) {
  if (!canPasskey()) return say(t('noPasskey'), true);
  btns.forEach(b => b.disabled = true);
  say(doing);
  try {
    await run();
  } catch (e) {
    say(e && e.name === 'NotAllowedError' ? t('cancelled')
      : e && e.status === 401 ? t('noKey')
      : t('loginFail'), true);
  }
  btns.forEach(b => b.disabled = false);
}

let CODES = [];      // 복구 코드. 판이 떠 있는 동안만 산다
let securityRequest = 0;

async function account() {
  const request = ++securityRequest;
  const inn = !!token();
  $('#secIn').hidden = !inn;
  $('#secOut').hidden = inn;
  [$('#acctKey'), $('#acctCodesNew'), $('#acctOut'), $('#privForget')].forEach(b => { b.disabled = !inn; });
  $('#securityState').textContent = inn ? '확인 중' : '로그인 필요';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const device = /Mac/i.test(platform) ? 'Mac' : /Win/i.test(platform) ? 'Windows PC' : /Linux/i.test(platform) ? 'Linux' : '현재 기기';
  $('#securityDevice').textContent = inn ? device + ' · 이 브라우저' : '로그인이 필요합니다';
  $('#securityKeys').textContent = '';
  $('#securityTwo').textContent = inn ? '확인 중' : '로그인 필요';
  $('#securityTwoSwitch').setAttribute('aria-pressed', 'false');
  $('#securityTwoText').textContent = '패스키 등록 상태를 확인합니다.';
  $('#acctWarn').hidden = $('#acctCodes').hidden = true;
  if (!inn) return;
  const a = await me().catch(() => null);
  if (request !== securityRequest) return;
  /* 못 읽었으면 숫자를 지어내지 않는다 — 줄을 숨긴다. 토큰이 죽었으면 로그인부터다 */
  if (!a) {
    if (!token()) return account();
    $('#securityState').textContent = '확인할 수 없음';
    $('#securityTwo').textContent = '확인 불가';
    $('#securityTwoText').textContent = '보안 상태 진단을 눌러 다시 확인해 주세요.';
    $('#acctWarn').hidden = $('#acctCodes').hidden = true;
    return;
  }
  $('#securityState').textContent = a.keys > 0 ? '패스키 보호 중' : '추가 보호 필요';
  $('#securityKeys').textContent = '등록된 패스키 ' + a.keys + '개';
  $('#securityTwo').textContent = a.keys > 0 ? '사용 중' : '꺼짐';
  $('#securityTwoSwitch').setAttribute('aria-pressed', String(a.keys > 0));
  $('#securityTwoText').textContent = a.keys > 0 ? '패스키로 로그인 시 한 번 더 확인합니다.' : '패스키를 추가하면 2단계 인증이 켜집니다.';
  $('#acctWarn').hidden = a.keys !== 1;
  $('#acctCodes').hidden = !a.codes;
  if (a.codes) $('#acctCodes').textContent = t('codesLeft', { n: a.codes });
}

/* 판을 닫으면 평문은 없앤다 — 숨기기만 하면 DOM 에 그대로 남는다 */
function wipeCodes() {
  CODES = [];
  $('#codeList').textContent = '';
  codesSay('');
}

function showCodes(codes) {
  CODES = codes || [];
  const ol = $('#codeList');
  ol.innerHTML = '';
  CODES.forEach(c => { const li = document.createElement('li'); li.textContent = c; ol.append(li); });
  $('#codesOk').checked = false;
  $('#codesDone').disabled = true;
  $('#codes').showModal();
}


/* ── 덮개 여닫기 ─────────────────────────────────────── */
const SET_HASH = new Set(['settings', 'language', 'region', 'game', 'video', 'audio', 'security', 'policy', 'version']);
const isSetHash = (h = location.hash) => SET_HASH.has(h.slice(1).toLowerCase());
const over = () => $('#options');
let opener = null;
let backgroundState = [];
function setBackgroundInert(inert) {
  if (inert) {
    backgroundState = [...document.body.children]
      .filter(el => el !== over() && el.id !== 'codes' && el.id !== 'tabDock' && el.tagName !== 'SCRIPT')
      .map(el => [el, el.hasAttribute('inert')]);
    backgroundState.forEach(([el]) => { el.inert = true; });
    return;
  }
  backgroundState.forEach(([el, wasInert]) => {
    el.inert = wasInert;
    if (!wasInert) el.removeAttribute('inert');
  });
  backgroundState = [];
}
const focusable = () => [...over().querySelectorAll(
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
)].filter(el => !el.closest('[hidden]') && !el.closest('dialog[open]'));
let closeGen = 0;
const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  || document.documentElement.dataset.motion === 'off';
function siDurMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--si-dur').trim();
  if (!raw || raw === '0' || raw === '0s' || raw === '0ms') return 0;
  return raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
}
function finishClose() {
  document.body.classList.remove('setting', 'opts-leaving');
  over().classList.remove('opts-exit');
  if (over().hidden) return;
  over().hidden = true;
  setBackgroundInert(false);
  if (opener) { opener.focus(); opener = null; }
  if (isSetHash()) history.replaceState(null, '', location.pathname + location.search);
}
/* 'auto' 는 홈(app.js 의 resolveLang — 중계기 위치까지 본다)이 <html lang> 에 적어 둔 말을
   따른다. 여기서 브라우저 언어로 따로 고르면 설정 덮개만 다른 말로 보였다가 나가면 바뀐다 */
const pickLang = () => UI_LANGS.includes(opt.lang) ? opt.lang
  : UI_LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'ko';
function open(tab) {
  const name = String(tab || location.hash.slice(1) || 'settings').toLowerCase();
  LANG = pickLang(); applyI18n(over());   // 홈이 말을 늦게 정해도 열 때마다 맞춘다
  dispatchEvent(new CustomEvent('rt-open-settings', { detail: name }));
  const leaving = document.body.classList.contains('opts-leaving') || over().classList.contains('opts-exit');
  if (over().hidden) {
    opener = document.activeElement;
    setBackgroundInert(true);
    over().classList.remove('opts-exit');
    document.body.classList.remove('opts-leaving');
    over().hidden = false;
    document.body.classList.add('setting');
  } else if (leaving) {
    closeGen += 1;
    over().classList.remove('opts-exit');
    document.body.classList.remove('opts-leaving');
    document.body.classList.add('setting');
  }
  pickTab(name === 'settings' ? '' : name, name === 'settings');
  if (!isSetHash()) histPush({ set: 1 }, '#' + (name === 'settings' ? 'settings' : name));
  requestAnimationFrame(syncOptShell);
}
function close(immediate) {
  if (over().hidden && !document.body.classList.contains('opts-leaving')) return;
  const skip = immediate === true || motionOff() || siDurMs() === 0;
  if (skip) { closeGen += 1; finishClose(); return; }
  if (over().classList.contains('opts-exit')) return;
  closeGen += 1;
  const gen = closeGen;
  /* 덮개 글자는 바로 접고, 칸 위 서리만 --si-dur 동안 걷는다 */
  over().classList.add('opts-exit');
  document.body.classList.remove('setting');
  document.body.classList.add('opts-leaving');
  setTimeout(() => { if (gen === closeGen) finishClose(); }, siDurMs() + 80);
}

/* ── 손잡이 ──────────────────────────────────────────── */
function wire() {
  $('#securityShield').src = asset('assets/security-shield.svg');
  $('#securityDeviceIcon').src = asset('assets/security-device.svg');
  $('#securityCheck').onclick = account;
  document.addEventListener('click', e => {
    const tog = e.target.closest('#options [data-opt]');
    if (tog) { opt[tog.dataset.opt] = !opt[tog.dataset.opt]; saveOpt(tog.dataset.opt === 'night' ? 'night' : undefined); }
    const unit = e.target.closest('#optUnit button');
    if (unit) { opt.unit = unit.dataset.v; saveOpt(); }
    const dong = e.target.closest('#optDong button');
    if (dong) { opt.dong = dong.dataset.v; saveOpt(); }
  });

  $('#optLang').addEventListener('change', e => {
    const r = e.target.closest('input[name="rtLang"]');
    if (!r) return;
    opt.lang = r.value;
    if (saveOpt('lang')) return;
    LANG = UI_LANGS.includes(opt.lang) ? opt.lang : LANG;
    document.documentElement.lang = LANG;
    applyI18n(over());
    paintUnit();
    fillLangPick(); fillRegionPick();
    dispatchEvent(new CustomEvent('rt-opt'));
  });
  $('#optRegion').addEventListener('change', e => {
    const r = e.target.closest('input[name="rtCountry"]');
    if (!r) return;
    opt.country = r.value; saveOpt();
    fillRegionPick();
  });

  $('#acctKey').onclick = () => tryAuth(async () => {
    const out = await passkeyMake();
    say('');
    /* 첫 패스키면 중계기가 복구 코드를 함께 준다 — 이 판을 닫으면 다시 못 본다 */
    if (out.codes) showCodes(out.codes); else account();
  }, t('makingKey'), [$('#acctKey'), $('#acctCodesNew'), $('#acctOut')]);

  $('#acctCodesNew').onclick = async () => {
    const btns = [$('#acctKey'), $('#acctCodesNew'), $('#acctOut')];
    btns.forEach(b => b.disabled = true);
    say(t('reading'));
    try { showCodes((await ask('/auth/codes', {})).codes); say(''); }
    catch { say(t('loginFail'), true); }
    btns.forEach(b => b.disabled = false);
  };

  /* 이름도 함께 지운다 — 남겨 두면 같은 브라우저의 다음 사람이 올린 점수가
     앞사람 이름으로 순위표에 걸린다(app.js 의 board 가 이 칸을 읽는다) */
  $('#acctOut').onclick = () => {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); localStorage.removeItem('rt.character'); } catch {}
    try { sessionStorage.removeItem(BIND_KEY); } catch {}
    wipeCodes();
    say('');
    account();
  };

  /* ── 개인정보와 이 브라우저 ── 지운 개수를 말한다. 서버 쪽은 순위표 내리기·계정 삭제 몫이다 */
  const wipe = hit => {
    let n = 0;
    for (const s of [localStorage, sessionStorage]) {
      try { for (const k of Object.keys(s)) if (hit(k)) { s.removeItem(k); n++; } } catch {}
    }
    return n;
  };
  const wiped = n => say(n ? t('wiped', { n }) : t('wipedNone'));
  /* 옛 열쇠(rt.best.*·rt.fast.*)도 같은 게임 기록이다 */
  $('#privKeys').onclick = () => {
    if (confirm(t('wipeKeysAsk'))) wiped(wipe(k => /^rt\.(keys|best|fast)\./.test(k)));
  };
  /* kind 없이 저장한다 — 부드러운 새로고침으로 넘어가면 #optSay 의 개수가 날아간다 */
  $('#privOpt').onclick = () => {
    if (!confirm(t('wipeOptAsk'))) return;
    const n = wipe(k => k === 'rt.opt' || k === 'rt.ui' || k === 'rt.botsize');
    const where = opt.where;
    Object.assign(opt, DEF, { where }); saveOpt();
    wiped(n);
  };
  $('#privAll').onclick = () => {
    if (!confirm(t('wipeAllAsk'))) return;
    const n = wipe(k => k.startsWith('rt.'));
    const where = opt.where;
    Object.assign(opt, DEF, { where }); saveOpt();
    wipeCodes();
    account();
    wiped(n);
  };
  $('#privForget').onclick = async () => {
    if (!confirm(t('forgetAsk'))) return;
    const b = $('#privForget');
    b.disabled = true;
    try {
      const d = await ask('/forget', {});
      try { localStorage.removeItem(NAME_KEY); } catch {}
      say(d.gone ? t('forgot', { n: d.gone }) : t('forgotNone'));
    } catch { say(t('forgetFail'), true); }
    b.disabled = !token();
  };

  /* 복사가 조용히 실패하면 사용자는 없는 코드를 저장했다고 믿는다 */
  $('#codesCopy').onclick = () => Promise.resolve(navigator.clipboard?.writeText(CODES.join('\n')))
    .then(() => codesSay(t('codesCopied')))
    .catch(() => codesSay(t('codesCopyFail'), true));
  $('#codesDown').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([CODES.join('\n') + '\n'], { type: 'text/plain' }));
    a.download = 'regiontype-recovery-codes.txt';
    a.click();
    /* 바로 폐기하면 사파리가 내려받기를 취소한다 */
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };
  /* 저장했다고 말하기 전에는 나갈 문을 안 연다 — 이 코드는 다시 안 보여준다 */
  $('#codesOk').onchange = e => { $('#codesDone').disabled = !e.target.checked; };
  $('#codesDone').onclick = () => { $('#codes').close(); wipeCodes(); account(); };
  /* Esc 도, 바깥 짚기도 이 판을 닫지 못한다 — 떠나면 코드를 다시 못 본다 */
  $('#codes').addEventListener('cancel', e => e.preventDefault());

  addEventListener('resize', capZoom);
  addEventListener('resize', () => { if (!over().hidden) syncOptShell(); });

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href !== 'settings/' && !href.startsWith('settings/') && !href.startsWith('#language') &&
        !href.startsWith('#security') && !href.startsWith('#settings')) return;
    if (href.startsWith('#') && !SET_HASH.has(href.slice(1))) return;
    e.preventDefault();
    let tab = 'settings';
    try { tab = (new URL(href, location.href).hash || '#settings').slice(1) || 'settings'; } catch {}
    open(tab);
  });
  const closeBtn = $('#optClose');
  if (closeBtn) closeBtn.onclick = close;
  addEventListener('rt-open-signin', () => close(true));
  addEventListener('rt-open-settings', () => {});
  addEventListener('rt-tab-swap', () => close(true));
  addEventListener('keydown', e => {
    if (over().hidden) return;
    if (($('#codes') && $('#codes').open) || ($('#feedback') && $('#feedback').open)) return;
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const items = focusable().filter(n => n.getClientRects().length).concat(dockTabs());
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  });
  addEventListener('popstate', () => { if (!isSetHash()) close(); });
  addEventListener('hashchange', () => { if (isSetHash()) open(location.hash.slice(1)); });
}

/* 이어 붙이기(app.js softReload)로 온 새 문서 — 덮개 안 스크롤과 초점을 적어 둔 자리로 되돌린다 */
function softApply() {
  const s = window.RT_SOFT;
  if (!s || over().hidden) return;
  const all = [...over().querySelectorAll('*')];
  (s.scroll || []).forEach(({ i, t, l }) => { if (all[i]) { all[i].scrollTop = t; all[i].scrollLeft = l; } });
  const f = s.focus && s.focus.sel && document.querySelector(s.focus.sel);
  if (f) f.focus({ preventScroll: true, focusVisible: s.focus.kb });
}

(async () => {
  capZoom();
  saveOpt();
  /* 부트 스크립트가 읽어 둔 마지막 말(app.js 의 cacheUI)이 있으면 기다리지 않고 바로 연다 —
     이어 붙이기(softReload)의 덮개가 첫 그림에 서야 한다. 전체 팩·지역은 열고 나서 받는다 */
  const ui = window.RT_UI;
  if (ui) { I18N = { [ui.lang]: ui.pack }; UI_LANGS = ui.langs; }
  else {
    try { I18N = await grab('data/i18n.json'); } catch {}
    /* 배포는 아직 한국어만이다(app.js 의 UI_LANGS 와 같은 갈림) */
    UI_LANGS = isDev() ? Object.keys(I18N) : ['ko'];
  }
  /* 'auto' 는 홈이 정한 말을 빌린다(pickLang). 홈이 늦게 정하면 덮개를 열 때 다시 맞춘다 */
  LANG = pickLang();
  applyI18n(over());
  paintUnit();
  $('#verBuild').textContent = VER;
  $('#verPatch').textContent = VER.replace('.', '');   // 릴리스 C 자리는 VER 에서 점을 뺀 숫자
  /* 지역 판은 개발에서만 열린다 — 배포에서는 world.json 을 부르지도 않는다 */
  if (isDev() && !ui) { try { WORLD = await grab('data/world.json'); } catch {} }
  wire();
  wireOptsTabs();
  if (isSetHash()) open(location.hash.slice(1));
  if (ui) {
    softApply();
    grab('data/i18n.json').then(all => { I18N = all; }).catch(() => {});
    if (isDev()) grab('data/world.json').then(w => { WORLD = w; }).catch(() => {});
  }
  document.fonts?.ready.then(() => { if (!over().hidden) syncOptShell(); });

  /* ?v= 표류. 페이지가 셋이라 손으로 적는 자리가 여섯이다 — 개발에서만 짖는다.
     파비콘(rel=icon)은 뺀다: 그림이 바뀔 때만 움직이는 별개의 캐시 열쇠다 */
  if (isDev()) document.querySelectorAll('[src*="?v="],[href*="?v="]:not([rel~="icon"])').forEach(el => {
    const v = new URL(el.getAttribute('src') || el.getAttribute('href'), location.href).searchParams.get('v');
    if (v !== VER) console.warn('[ver] ?v=' + v + ' ≠ ' + VER, el);
  });
})();
})();
