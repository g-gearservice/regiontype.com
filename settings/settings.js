/* regiontype 설정 화면 (/settings/).

   app.js 를 싣지 않는다 — 그 파일은 홈 전용 DOM 을 최상단에서 건드린다. 겹치는
   잔손($·asset·t·b64u)은 하나하나가 다섯 줄 미만이라 signin.js 처럼 여기 다시 적는다.
   ponytail: 네 번째 페이지가 생기면 그때 공용 모듈로 뽑는다.

   여기 있는 것: 언어·지역·화면·소리·버전 판(홈의 #options 에서 옮겨 왔다)과
   보안 판(/signin/ 의 계정 화면에서 옮겨 왔다). 로그인 자체는 여전히 /signin/ 이다.
   탭 자리는 해시에 남는다 — /settings/#security 로 바로 들어올 수 있다.            */
'use strict';

const $ = s => document.querySelector(s);
/* VER 을 여기 또 적지 않는다 — 손으로 고칠 자리는 settings/index.html 의 ?v= 하나다 */
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const grab = url => fetch(asset(url)).then(r => r.json());

const RELAY = 'https://g.gearservicevanguard.com';
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
const DEF = { time: 120, night: false, sound: true, motion: true, hint: true, grid: true,
              lang: 'auto', country: 'auto' };
const opt = Object.assign({}, DEF, JSON.parse(localStorage.getItem('rt.opt') || '{}'));
for (const k of Object.keys(opt)) if (!(k in DEF)) delete opt[k];

const saveOpt = () => {
  localStorage.setItem('rt.opt', JSON.stringify(opt));
  document.documentElement.toggleAttribute('data-night', opt.night);
  document.documentElement.dataset.motion = opt.motion ? 'on' : 'off';
  document.documentElement.toggleAttribute('data-no-grid', !opt.grid);
  requestAnimationFrame(paintGrid);
  document.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-pressed', !!opt[b.dataset.opt]));
};

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

/* ── 장식 격자 ───────────────────────────────────────
   홈의 syncGrid 비플레이 갈래와 같은 셈이다: 화면 폭·높이가 152 의 배수가 아니면
   가장자리에 짜투리 칸이 남으므로 칸을 딱 떨어지는 배수로 늘렸다 줄인다 */
const DECO_CELL = 152;
function paintGrid() {
  const svg = $('.grid-bg'), p = $('#bitgrid');
  if (!p) return;
  const w = window.innerWidth, h = window.innerHeight;
  /* 칸은 정사각형이다 — 홈(app.js 의 syncGrid)과 같은 규칙이라야 페이지를 넘나들 때
     배경 격자가 같은 크기로 이어진다. 자투리가 적게 남는 한 변을 고른다 */
  const cols = Math.max(1, Math.round(w / DECO_CELL));
  const rows = Math.max(1, Math.round(h / DECO_CELL));
  const fitW = w / cols, fitH = h / rows;
  const spare = (cell) => Math.abs(w - cols * cell) + Math.abs(h - rows * cell);
  const cw = spare(fitH) < spare(fitW) ? fitH : fitW, ch = cw;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  p.setAttribute('width', cw);
  p.setAttribute('height', ch);
  p.setAttribute('x', 0);
  p.setAttribute('y', 0);
  p.querySelector('path').setAttribute('d', `M${cw} 0 V${ch} H0`);
  const st = document.documentElement.style;
  st.setProperty('--deco-cw', cw + 'px');
  st.setProperty('--deco-ch', ch + 'px');
  syncOptShell();
}

/* .opts-shell 의 위아래 변을 둘 다 장식 격자의 가로선에 앉힌다.
   윗변만 앉히고 높이를 아무 값이나 쓰면 아랫변은 칸의 중간 어디쯤에서 끊긴다 —
   테두리도 배경도 없는 통이라 그 끊김이 '내용이 격자 밖으로 샜다'로 읽힌다.
   그래서 높이 자체를 칸의 정수배로 죈다: 윗변이 선 위에 서면 그로부터 정수 칸
   내려간 아랫변도 저절로 선 위에 선다. 칸 수는 뷰포트 56% 근방에서 고르되
   레일(.opts-tabs) 자연 높이를 밑돌지 않는다(밑돌면 탭이 잘린다) — 탭 글자로
   재지 않는 건 언어마다 글자 길이가 달라 통이 뛰는 걸 막기 위해서다.
   shell.top 은 안 쓴다: #options 가 position:fixed;inset:0 라 셸은 늘 뷰포트
   한가운데 뜬다 — 거기서 거꾸로 풀어야 계산이 자기 참조가 되지 않는다.
   손가락 화면에서는 레일이 가로로 눕고 셸 높이가 auto 라 격자 정렬 자체가 없다 —
   여기서 값을 넣으면 오히려 높이를 못 박아 판이 잘린다 */
function syncOptShell() {
  if (matchMedia('(pointer:coarse)').matches) return;
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
const tabHash = tb => tb.getAttribute('aria-controls').slice(4).toLowerCase();
function wireOptsTabs() {
  const tabs = [...document.querySelectorAll('.opts-tabs [role="tab"]')];
  const rail = document.querySelector('.opts-tabs');
  if (!rail || !tabs.length) return;
  const select = (tab, keepHash) => {
    tabs.forEach(tb => {
      const on = tb === tab;
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tb.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !on;
      if (on && panel.id === 'optsLanguage') fillLangPick();
      if (on && panel.id === 'optsRegion') fillRegionPick();
      if (on && panel.id === 'optsSecurity') account();
    });
    if (!keepHash) history.replaceState(null, '', location.pathname + location.search + '#' + tabHash(tab));
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
  /* 들어올 때 해시를 읽는다. 모르는 해시면 첫 탭 그대로 두고 주소도 안 건드린다 */
  const want = tabs.find(tb => tabHash(tb) === location.hash.slice(1).toLowerCase());
  select(want || tabs[0], !want);
}

/* ── 보안 (signin.js 에서 옮겨 왔다) ─────────────────── */
const toB64u = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => {
  const x = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(x + '='.repeat((4 - x.length % 4) % 4)), c => c.charCodeAt(0));
};
const say = (msg, bad) => {
  const p = $('#siSay');
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
  if (!token()) return null;
  const r = await fetch(RELAY + '/auth/me', { headers: { authorization: 'Bearer ' + token() } });
  if (r.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch {} return null; }
  return r.ok ? r.json().catch(() => null) : null;
}

const canPasskey = () => !!(window.PublicKeyCredential && navigator.credentials?.create);

/* 이 기기에 패스키를 하나 만든다 — 로그인해 있어야 한다(2단계를 얹는 것이다) */
async function passkeyMake() {
  const d = await ask('/auth/new', {});
  const name = 'regiontype · ' + d.user.slice(0, 6);
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: fromB64u(d.challenge),
    rp: d.rp,
    /* 사람 이름을 안 받는다 — 기기의 패스키 목록에도 난수만 남는다 */
    user: { id: new TextEncoder().encode(d.user), name, displayName: name },
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

async function account() {
  const inn = !!token();
  $('#secIn').hidden = !inn;
  $('#secOut').hidden = inn;
  if (!inn) return;
  const a = await me().catch(() => null);
  /* 못 읽었으면 숫자를 지어내지 않는다 — 줄을 숨긴다. 토큰이 죽었으면 로그인부터다 */
  if (!a) {
    if (!token()) return account();
    $('#acctWarn').hidden = $('#acctCodes').hidden = true;
    return;
  }
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

/* ── 손잡이 ──────────────────────────────────────────── */
function wire() {
  document.addEventListener('click', e => {
    const tog = e.target.closest('.toggle');
    if (tog) { opt[tog.dataset.opt] = !opt[tog.dataset.opt]; saveOpt(); }
  });

  $('#optLang').addEventListener('change', e => {
    const r = e.target.closest('input[name="rtLang"]');
    if (!r) return;
    opt.lang = r.value; saveOpt();
    LANG = UI_LANGS.includes(opt.lang) ? opt.lang : LANG;
    document.documentElement.lang = LANG;
    applyI18n(document);
    fillLangPick(); fillRegionPick();
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
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); } catch {}
    try { sessionStorage.removeItem(BIND_KEY); } catch {}
    wipeCodes();
    say('');
    account();
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
  addEventListener('resize', paintGrid);
}

(async () => {
  capZoom();
  saveOpt();
  try { I18N = await grab('../data/i18n.json'); } catch {}
  /* 배포는 아직 한국어만이다(app.js 의 UI_LANGS 와 같은 갈림) */
  UI_LANGS = isDev() ? Object.keys(I18N) : ['ko'];
  /* 'auto' 의 정책(중계기 위치·타임존까지 보는 resolveLang)은 홈에 있다. 여기서는
     그 무거운 길을 다시 깔지 않고 브라우저가 말하는 언어만 본다 — 배포는 어차피
     한국어 하나다 */
  LANG = UI_LANGS.includes(opt.lang) ? opt.lang
    : (navigator.languages || []).map(x => x.split('-')[0]).find(x => UI_LANGS.includes(x)) || 'ko';
  document.documentElement.lang = LANG;
  applyI18n(document);
  $('#verBuild').textContent = VER;
  $('#verPatch').textContent = VER.replace('.', '');   // 릴리스 C 자리는 VER 에서 점을 뺀 숫자
  /* 지역 판은 개발에서만 열린다 — 배포에서는 world.json 을 부르지도 않는다 */
  if (isDev()) { try { WORLD = await grab('../data/world.json'); } catch {} }
  wire();
  wireOptsTabs();
  paintGrid();
  /* 글꼴이 늦게 오면 레일 높이가 달라진다 — 그때 한 번 더 앉힌다 */
  document.fonts?.ready.then(paintGrid);

  /* ?v= 표류. 페이지가 셋이라 손으로 적는 자리가 여섯이다 — 개발에서만 짖는다.
     파비콘(rel=icon)은 뺀다: 그림이 바뀔 때만 움직이는 별개의 캐시 열쇠다 */
  if (isDev()) document.querySelectorAll('[src*="?v="],[href*="?v="]:not([rel~="icon"])').forEach(el => {
    const v = new URL(el.getAttribute('src') || el.getAttribute('href'), location.href).searchParams.get('v');
    if (v !== VER) console.warn('[ver] ?v=' + v + ' ≠ ' + VER, el);
  });
})();
