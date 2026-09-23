/* regiontype 로그인. 제 페이지가 아니라 홈(index.html) 위에 뜨는 덮개다 —
   화면이 안 바뀌므로 전환은 진짜 요소에 건 CSS transition 이 맡는다(style.css 의
   body.signing). 스냅샷도, 두 문서 사이 이름 맞추기도 없다.

   app.js 와 한 문서에 함께 실린다. 겹치는 잔손($·asset·t 등)은 그대로 두되 전부를
   한 겹 함수 안에 넣어 전역이 부딪히지 않게 한다.
   ponytail: 세 번째 자리가 생기면 그때 공용 모듈로 뽑는다.

   흐름은 relay/worker.mjs 가 정한 대로다:
     /auth/sso  → 공급자로 나갔다가 #signin=ok&t=<tag> 로 돌아온다
     /auth/take → bind + tag 로 토큰을 받는다 (패스키가 있으면 2단계를 더 묻는다)
     /auth/log  → 2단계를 패스키로 넘는다
     /auth/code → 2단계를 복구 코드로 넘는다
   공급자는 Worker 의 /auth/cb 로 돌아오고, Worker 는 브라우저를 /signin/ 으로
   보낸다. 그 자리는 해시만 여기로 넘기는 빈 착지대다(signin/index.html).      */
(function () {
'use strict';


const $ = s => document.querySelector(s);
/* VER 을 여기 또 적지 않는다 — 손으로 고칠 자리는 index.html 의 ?v= 하나다 */
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const grab = url => fetch(asset(url)).then(r => r.json());

const RELAY = 'https://g.gearservicevanguard.com';
const TOKEN_KEY = 'rt.token', BIND_KEY = 'rt.bind', NAME_KEY = 'rt.name';
const OPT_KEY = 'rt.opt';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

/* 설정은 홈과 같은 통에서 읽는다 — 야간 모드와 모션이 페이지를 넘어도 따라오게 */
const opt = read(OPT_KEY, '{}');

/* ── 화면 말 ─────────────────────────────────────────── */
let I18N = { ko: {} }, LANG = 'ko';
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

/* app.js 와 같은 규칙으로 브라우저 언어 태그를 i18n 묶음 이름에 맞춘다. */
function parseUiLang(tag, langs) {
  const raw = String(tag || '').replace('_', '-').trim().toLowerCase();
  if (!raw) return null;
  if (langs.includes(raw)) return raw;
  let base;
  if (raw.startsWith('zh-hant') || raw === 'zh-tw' || /-tw$/.test(raw)) base = 'zh-hant';
  else if (raw.startsWith('zh-hk') || /-hk$/.test(raw)) base = 'zh-hk';
  else if (raw.startsWith('zh')) base = 'zh';
  else if (raw.startsWith('nb') || raw === 'no' || raw.startsWith('no-')) base = 'nb';
  else base = raw.slice(0, 2);
  if (langs.includes(base)) return base;
  if ((base === 'zh-hant' || base === 'zh-hk') && langs.includes('zh')) return 'zh';
  return null;
}

function devLang() {
  const langs = Object.keys(I18N);
  if (opt.lang !== 'auto' && langs.includes(opt.lang)) return opt.lang;
  for (const tag of [...(navigator.languages || []), navigator.language]) {
    const hit = parseUiLang(tag, langs);
    if (hit) return hit;
  }
  return langs.includes('en') ? 'en' : (langs[0] || 'ko');
}

/* ── 잔손 ────────────────────────────────────────────── */
const toB64u = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => {
  const x = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(x + '='.repeat((4 - x.length % 4) % 4)), c => c.charCodeAt(0));
};
const shaB64u = async s => toB64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

const say = (msg, bad) => {
  const p = $('#siSay');
  p.textContent = msg || '';
  p.classList.toggle('bad', !!bad);
};

const VIEWS = ['vSignin', 'vTwo'];
/* 첫 화면을 그리는 동안은 포커스를 옮기지 않는다 — 짚지도 않았는데 포커스 테두리가
   그려져 글자가 선택된 것처럼 보인다. 탭 키는 그대로 첫 버튼에 닿는다 */
let live = false;
function show(id) {
  VIEWS.forEach(v => { $('#' + v).hidden = v !== id; });
  /* 화면이 바뀌면 손이 갈 첫 자리로 포커스를 옮긴다 — 키보드만으로도 이어진다 */
  const first = live && $('#' + id).querySelector('button:not([disabled]), input:not([disabled])');
  if (first) first.focus();
}

async function ask(path, body) {
  const head = { 'content-type': 'application/json' };
  const tok = token();
  if (tok) head.authorization = 'Bearer ' + tok;
  const r = await fetch(RELAY + path, { method: 'POST', headers: head, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.msg || String(r.status)); e.status = r.status; e.data = d; throw e; }
  return d;
}

/* ── 패스키 ──────────────────────────────────────────── */
const canPasskey = () => !!(window.PublicKeyCredential && navigator.credentials?.create);

/* 2단계: 챌린지를 여기서 새로 받지 않는다 — /auth/take 가 준 id 를 그대로 쓴다 */
async function passkeyTwo(generation) {
  const two = TWO;
  if (!two) return;
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: fromB64u(two.challenge), rpId: location.hostname,
    userVerification: 'preferred', timeout: 60000,
  } });
  if (!current(generation)) return;
  const r = cred.response;
  const out = await ask('/auth/log', {
    challenge: two.challenge, id: toB64u(cred.rawId),
    clientDataJSON: toB64u(r.clientDataJSON),
    authData: toB64u(r.authenticatorData), sig: toB64u(r.signature),
  });
  if (current(generation)) done(out.token, generation);
}

/* 패스키를 부르는 버튼은 전부 이 문을 지난다 — 취소와 진짜 실패는 다른 말이다 */
async function tryAuth(run, doing, btns) {
  if (!canPasskey()) return say(t('noPasskey'), true);
  const generation = modalGeneration;
  btns.forEach(b => b.disabled = true);
  say(doing);
  try {
    await run(generation);
  } catch (e) {
    if (!current(generation)) return;
    say(e && e.name === 'NotAllowedError' ? t('cancelled')
      : e && e.status === 401 ? t('noKey')
      : t('loginFail'), true);
  }
  if (current(generation)) btns.forEach(b => b.disabled = false);
}

/* ── SSO ─────────────────────────────────────────────── */
let TWO = null;      // { bind, tag, challenge } — 2단계가 도는 동안만 산다

async function sso(p) {
  const generation = modalGeneration;
  const btns = [$('#goGoogle')];
  btns.forEach(b => b.disabled = true);
  say(t('signinWait'));
  try {
    /* bind 는 이 브라우저에만 남는다. 공급자에게는 그 해시(state)만 간다 */
    const bind = toB64u(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(BIND_KEY, bind);
    const { url } = await ask('/auth/sso', { p, s: await shaB64u(bind) });
    if (current(generation)) location.assign(url);
  } catch {
    if (!current(generation)) return;
    say(t('signinFail'), true);
    btns.forEach(b => b.disabled = false);
  }
}

/* 공급자에게 다녀오면 #signin=… 로 돌아온다. tag 가 주소·방문 기록에 남지
   않게 먼저 지우고 읽는다 */
function backFromSso() {
  const h = new URLSearchParams(location.hash.slice(1));
  const s = h.get('signin');
  if (!s) return null;
  const tag = h.get('t') || '';
  history.replaceState(null, '', location.pathname + location.search);
  return { s, tag };
}

async function take(bind, tag, generation) {
  let d;
  try {
    d = await ask('/auth/take', { b: bind, t: tag });
  } catch (e) {
    if (!current(generation)) return;
    /* 409 는 "이미 다른 계정에 연결된 공급자" 다 — 잠시 뒤 다시 하면 되는
       실패가 아니라서 같은 말로 뭉개지 않는다 */
    if (e.status === 409 && e.data && e.data.taken) {
      say(t('signinTaken') || e.message || t('signinFail'), true);
    } else {
      say(t('signinFail'), true);
    }
    sessionStorage.removeItem(BIND_KEY);
    return show('vSignin');
  }
  if (!current(generation)) return;
  if (d.token) return done(d.token, generation, d.isNewAccount === true);
  if (d.need === 'passkey') {
    TWO = { bind, tag, challenge: d.challenge };
    say('');
    return show('vTwo');
  }
  sessionStorage.removeItem(BIND_KEY);
  say(t('signinFail'), true);
  show('vSignin');
}

/* 토큰을 쥐었으면 여기 볼 것은 없다 — 계정 화면은 독립 페이지다.
   처음 만든 계정은 가입 안내(welcome/)로 보낸다: 캐릭터와 프로필을 한 장씩
   맞추고 나면 스스로 홈으로 돌아온다. 이미 마친 사람이 그 주소로 와도
   welcome.js 가 /auth/me 의 intro 를 보고 비켜 준다 */
function done(tok, generation, isNewAccount = false) {
  if (!current(generation)) return;
  localStorage.setItem(TOKEN_KEY, tok);
  sessionStorage.removeItem(BIND_KEY);   // 쓰고 나면 지운다
  TWO = null;
  say('');
  close();
  location.assign(isNewAccount ? 'welcome/' : './');
}

/* ── 덮개 여닫기 ─────────────────────────────────────── */
const over = () => $('#signin');
let opener = null;
/* ── Grok 봇(bloub) ──────────────────────────────────────
   로고 오른쪽 위에서 떠 있다. 끌어서 뒤의 비트맵 칸에 얹으면 그 칸을 물고
   커진 채 눈을 뜨고 깜빡인다(엔진 상태 idle). 끄는 동안 Option(맥·리눅스)
   이나 Ctrl(윈도)을 누르고 있으면 한 마리가 더 생긴다.
   ponytail: 붙은 봇은 제 칸의 화면 좌표를 매 프레임 따라 읽는다 — 지도를 밀든
   줄이든 늘 맞는다. 칸 수만큼 도는 게 아니라 붙은 봇 수만큼이라 값이 싸다 */
const motionOff = () => matchMedia('(prefers-reduced-motion:reduce)').matches
  || document.documentElement.dataset.motion === 'off';
const BOT = 44;
const WIN = /Win/i.test(navigator.userAgentData?.platform || navigator.platform || '');
const cloneKey = e => e.altKey || (WIN && e.ctrlKey);
const bots = [];
let mountBuddy = null, follow = 0;

async function botMaker() {
  if (!mountBuddy) ({ mountBuddy } = await import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href));
  return mountBuddy;
}
/* 로고의 점 자리 — 오른쪽 위. 진짜 점은 숨기고 봇이 그 자리를 맡는다 */
function parkAt() {
  const logo = $('.si-logo');
  if (!logo) return { x: 24, y: 24 };
  const r = logo.getBoundingClientRect();
  return { x: r.right - BOT * .45, y: r.top - BOT * .35 };
}
/* 봇이 앉으면 안 되는 자리 — 로고·제목·버튼이 덮고 있는 칸이다. 글자 뒤로 들어가면
   둘 다 안 읽힌다 */
const boxOf = (sel, pad) => {
  const el = $(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
};
const inBox = (x, y, z) => !!z && x >= z.l && x <= z.r && y >= z.t && y <= z.b;
const blocked = () => ['.si-logo', '#vSignin .si-head', '#vSignin .si-btns']
  .map(sel => boxOf(sel, 14)).filter(Boolean);
/* 로고 근처에 놓으면 제자리(로고 옆 동글뱅이)로 돌아간다 */
const overLogo = (x, y) => inBox(x, y, boxOf('.si-logo', 28));
/* WAAPI 이동을 집는 중에 끊어도 목표점으로 순간이동하지 않게, 지금 화면에 그려진
   위치를 인라인 좌표로 굳힌 뒤 취소한다. 좌표 host 와 몸짓 motion 을 갈라 둬서
   드래그의 즉각 추종과 몸의 scale/rotate 가 서로 transform 을 빼앗지 않는다. */
function freezeSettle(b) {
  if (!b.settle) return;
  const m = new DOMMatrixReadOnly(getComputedStyle(b.el).transform);
  b.settle.cancel();
  b.settle = null;
  b.el.classList.remove('is-settling');
  b.x = m.m41; b.y = m.m42;
  place(b);
  if (b.bodySettle) { b.bodySettle.cancel(); b.bodySettle = null; }
}
const cssSeconds = name => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw.endsWith('ms') ? parseFloat(raw) / 1000 : parseFloat(raw) || 0;
};
function springTo(b, x, y, from = { x: b.x, y: b.y, size: b.size }) {
  freezeSettle(b);
  const oldSize = from.size || b.size;
  b.x = x; b.y = y;
  place(b);
  if (motionOff()) return;
  const dx = from.x - x, dy = from.y - y;
  const duration = cssSeconds('--slow') * 2000;
  const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim();
  b.el.classList.add('is-settling');
  b.settle = b.el.animate([
    { transform: `translate3d(${x + dx}px,${y + dy}px,0)`, offset: 0 },
    { transform: `translate3d(${x - dx * .04}px,${y - dy * .04}px,0)`, offset: .64 },
    { transform: `translate3d(${x + dx * .015}px,${y + dy * .015}px,0)`, offset: .84 },
    { transform: `translate3d(${x}px,${y}px,0)`, offset: 1 },
  ], { duration, easing: ease });
  const scale = oldSize / b.size;
  b.bodySettle = b.motion.animate([
    { transform: `scale(${scale})`, transformOrigin: '50% 50%', offset: 0 },
    { transform: 'scale(1.035)', transformOrigin: '50% 50%', offset: .64 },
    { transform: 'scale(.99)', transformOrigin: '50% 50%', offset: .84 },
    { transform: 'scale(1)', transformOrigin: '50% 50%', offset: 1 },
  ], { duration, easing: ease });
  b.settle.onfinish = () => {
    b.settle = b.bodySettle = null;
    b.el.classList.remove('is-settling');
  };
}
function park(b, animate = true) {
  freezeSettle(b);
  const from = { x: b.x, y: b.y, size: b.size };
  const p = parkAt();
  unseat(b);
  b.home = true;
  b.el.hidden = false;
  b.el.classList.add('is-home');
  wake(b, true);
  if (animate) springTo(b, p.x, p.y, from);
  else { b.x = p.x; b.y = p.y; place(b); }
}
function place(b) {
  b.el.style.transform = `translate3d(${b.x}px,${b.y}px,0)`;
  b.el.style.width = b.el.style.height = b.size + 'px';
}
/* 칸에서 내려온다 — 칸은 제 그림을 되찾고 봇은 손에 잡히는 크기로 돌아간다.
   이름을 unseat 로 둔 것은 botGrab 안의 지역 drop(포인터업)과 가려지지 않게 하려는 것이다 */
function unseat(b) {
  if (b.tile) b.tile.classList.remove('has-bot');
  b.tile = null;
  b.home = false;
  b.el.classList.remove('is-home');
  b.size = BOT;
  wake(b, false);
}
function wake(b, on) {
  b.el.classList.toggle('is-on', on);
  if (!on) b.size = BOT;
  /* idle 이 깨어 있는 얼굴이다 — baseFace·baseBody 가 켜져 둥근 몸에 눈이 붙고,
     깜빡임은 sample() 이 낸다. alert 는 느낌표가 튀어 오르는 연출이라 얼굴이 없다.
     sleep 은 눈을 감은 작은 덩이(eyeAlpha 0) — 로고 옆에서 자는 모습이다 */
  if (b.api) b.api.setState(on ? 'idle' : 'sleep');
}
/* 봇 아래에 있는 비트맵 칸. elementsFromPoint 는 못 쓴다 — 덮개가 떠 있는 동안
   칸은 pointer-events:none 이라 hit-test 에서 통째로 빠진다. 좌표로 직접 고른다.
   스물다섯 칸이라 값이 싸고, 무엇이 위에 덮였든 결과가 같다 */
function tileUnder(x, y) {
  if (blocked().some(z => inBox(x, y, z))) return null;
  for (const el of document.querySelectorAll('#courseBtns .grid-btn')) {
    if (parseFloat(getComputedStyle(el).opacity) < .5) continue;
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
  }
  return null;
}
function followFrame() {
  follow = 0;
  let live = false;
  for (const b of bots) {
    if (!b.tile) continue;
    if (!b.tile.isConnected) { unseat(b); place(b); continue; }
    const r = b.tile.getBoundingClientRect();
    /* 칸이 곧 몸이다 — 자리도 크기도 칸에서 받는다. 지도를 밀거나 줄여도 맞는다 */
    b.size = r.width;
    b.x = r.left;
    b.y = r.top;
    place(b);
    live = true;
  }
  if (live && !over().hidden) follow = requestAnimationFrame(followFrame);
}
const followKick = () => { if (!follow) follow = requestAnimationFrame(followFrame); };

async function addBot(x, y) {
  const make = await botMaker().catch(() => null);
  if (!make) return null;
  const el = document.createElement('div');
  el.className = 'si-bot';
  const motion = document.createElement('span');
  motion.className = 'si-bot-motion';
  el.append(motion);
  $('#siBots').append(el);
  const b = { el, motion, api: make(motion, { calm: motionOff }), tile: null,
    x, y, size: BOT, home: false, settle: null, bodySettle: null };
  bots.push(b);
  place(b);
  b.api.start();
  wake(b, false);
  el.addEventListener('pointerdown', e => botGrab(e, b));
  return b;
}
function botGrab(e, b) {
  if (e.button) return;
  e.preventDefault();
  e.stopPropagation();
  const start = async () => {
    /* 복제는 원본을 두고 새 놈을 끈다 — 끌던 손이 그대로 이어진다 */
    const t = cloneKey(e) ? await addBot(b.x, b.y) : b;
    if (!t) return;
    freezeSettle(t);
    unseat(t);
    /* 집은 위치와 상관없이 몸의 중심을 포인터에 둔다. 이 중심을 아래의 타일 판정과
       확대 spring 시작점까지 그대로 써야 크기가 바뀌어도 우하단으로 튀지 않는다. */
    let px = e.clientX, py = e.clientY;
    t.x = px - t.size / 2; t.y = py - t.size / 2;
    place(t);
    t.el.classList.add('is-held');
    /* 잡혀 있는 동안은 허둥지둥한다 — wide 는 눈이 위아래로 커지고 시선이 들린다 */
    if (t.api) t.api.setState('wide');
    /* 이미 놓친 포인터면 던진다 — 캡처는 있으면 좋고 없어도 끌기는 된다 */
    try { t.el.setPointerCapture(e.pointerId); } catch {}
    const move = ev => {
      px = ev.clientX; py = ev.clientY;
      t.x = px - t.size / 2; t.y = py - t.size / 2;
      place(t);
    };
    const drop = ev => {
      t.el.removeEventListener('pointermove', move);
      t.el.classList.remove('is-held');
      /* pointerup 좌표가 마지막 pointermove보다 새로울 수 있다. cancel은 마지막으로
         확인한 좌표에 놓아, (0,0)을 주는 브라우저에서도 화면 모서리로 날리지 않는다. */
      if (ev.type !== 'pointercancel') { px = ev.clientX; py = ev.clientY; }
      t.x = px - t.size / 2; t.y = py - t.size / 2;
      place(t);
      /* 로고의 복귀 범위는 타일 금지 범위보다 넓다. 먼저 보지 않으면 그 바깥 14px
         고리에서는 뒤에 깔린 비트맵 칸이 이겨, 집으로 놓아도 칸에 붙어 버린다. */
      if (overLogo(px, py)) { park(t); return; }
      const tile = tileUnder(px, py);
      /* 칸이 아닌 빈 곳에서는 그 자리에 내려앉아 잠든다. */
      if (!tile) {
        const from = { x: t.x, y: t.y - 5, size: t.size };
        wake(t, false);
        springTo(t, t.x, t.y, from);
        return;
      }
      t.el.hidden = false;
      /* 한 칸에 한 마리만 — 먼저 앉아 있던 놈은 내려온다 */
      bots.forEach(o => { if (o !== t && o.tile === tile) { unseat(o); place(o); } });
      t.tile = tile;
      tile.classList.add('has-bot');
      wake(t, true);
      const r = tile.getBoundingClientRect();
      /* host는 지금부터 타일 크기다. 그 큰 상자의 중심을 포인터에 맞춘 좌표에서
         시작하고 안쪽 몸만 이전 크기로 줄여 두면, 확대 첫 프레임도 포인터 중심이다. */
      const from = { x: px - r.width / 2, y: py - r.width / 2, size: t.size };
      t.size = r.width;
      springTo(t, r.left, r.top, from);
      followKick();
    };
    t.el.addEventListener('pointermove', move);
    t.el.addEventListener('pointerup', drop, { once: true });
    t.el.addEventListener('pointercancel', drop, { once: true });
  };
  start();
}
async function wakeBuddy() {
  if (!bots.length) { const p = parkAt(); await addBot(p.x, p.y); }
  bots.forEach(b => { if (!b.tile) park(b, false); b.api.start(); });
  followKick();
}
function sleepBuddy() {
  cancelAnimationFrame(follow); follow = 0;
  /* 앉아 있던 칸을 반드시 돌려준다 — has-bot 이 남으면 그 구가 홈에서 투명한 채
     굳는다(도봉구가 사라져 보이던 이유). 복제본은 그 판의 놀이라 정리한다 */
  while (bots.length > 1) { const b = bots.pop(); unseat(b); b.api.stop(); b.el.remove(); }
  bots.forEach(b => { park(b, false); b.api.stop(); b.api.lookAway(); });
}
/* 봇은 커서 쪽을 바라본다. 화면 좌표 그대로 넘기면 된다 — 세로축 뒤집기는
   mountBuddy 의 lookAt 안에서 한 번만 한다(부르는 쪽마다 붙이던 음수를 거뒀다). */
function buddyLook(e) {
  if (motionOff() || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const grip = v => Math.max(-1, Math.min(1, v));
  for (const b of bots) {
    const dx = (e.clientX - (b.x + b.size / 2)) / b.size;
    const dy = (e.clientY - (b.y + b.size / 2)) / b.size;
    b.api.lookAt(grip(dx), grip(dy));
  }
}
let backgroundState = [];
function setBackgroundInert(inert) {
  if (inert) {
    backgroundState = [...document.body.children]
      .filter(el => el !== over() && el.id !== 'options' && el.id !== 'codes' && el.tagName !== 'SCRIPT')
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
)].filter(el => !el.closest('[hidden]'));
/* 닫힌 덮개의 비동기 응답은 다음에 연 덮개의 상태를 건드리지 못한다. fetch 와
   패스키 창 자체를 강제로 끊을 수 없어도 결과는 이 세대 표로 버린다. */
let modalGeneration = 0;
const current = generation => generation === modalGeneration && !over().hidden;
function open() {
  if (!over().hidden) return;
  modalGeneration += 1;
  dispatchEvent(new CustomEvent('rt-open-signin'));
  opener = document.activeElement;
  setBackgroundInert(true);
  over().hidden = false;
  document.body.classList.add('signing');
  live = true;
  show('vSignin');
  /* 뒤로 가기로 닫힌다 — 주소는 그대로고 기록만 한 칸 쌓는다 */
  if (location.hash !== '#signin') history.pushState({ si: 1 }, '', '#signin');
  wakeBuddy();
}
function close() {
  if (over().hidden) return;
  modalGeneration += 1;
  document.body.classList.remove('signing');
  live = false;
  sleepBuddy();
  over().hidden = true;
  TWO = null;
  sessionStorage.removeItem(BIND_KEY);
  $('#codeIn').value = '';
  $('#codeForm').hidden = true;
  [$('#goGoogle'), $('#twoGo'), $('#twoCode')].forEach(b => { b.disabled = false; });
  say('');
  setBackgroundInert(false);
  if (opener) { opener.focus(); opener = null; }
  if (location.hash === '#signin') history.replaceState(null, '', location.pathname + location.search);
}

/* ── 손잡이 ──────────────────────────────────────────── */
function wire() {
  $('#goGoogle').onclick = () => sso('google');

  $('#twoGo').onclick = () => tryAuth(passkeyTwo, t('askingDevice'), [$('#twoGo'), $('#twoCode')]);
  $('#twoCode').onclick = () => {
    $('#codeForm').hidden = false;
    $('#codeIn').focus();
  };
  $('#codeForm').onsubmit = async e => {
    e.preventDefault();
    const generation = modalGeneration;
    const two = TWO;
    if (!two) return;
    const code = $('#codeIn').value.trim().toLowerCase();
    say(t('askingDevice'));
    try {
      const d = await ask('/auth/code', { b: two.bind, t: two.tag, code });
      if (!current(generation)) return;
      $('#codeIn').value = '';        // 쓴 코드를 칸에 남겨 두지 않는다
      done(d.token, generation);
    } catch {
      if (!current(generation)) return;
      say(t('loginFail'), true);
      $('#codeIn').select();
    }
  };

  /* 홈의 '로그인' 은 이제 페이지가 아니라 이 덮개를 연다. 로그인해 있으면
     app.js 가 라벨과 href 를 계정 쪽으로 바꿔 두므로 그때는 가로채지 않는다 */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href !== 'signin/' && !href.startsWith('signin/') && href !== '#signin') return;
    if (token()) return;
    e.preventDefault();
    open();
  });
  $('#siClose').onclick = close;
  over().addEventListener('pointermove', buddyLook);
  over().addEventListener('pointerleave', () => bots.forEach(b => b.api.lookAway()));
  addEventListener('rt-open-settings', close);
  addEventListener('keydown', e => {
    if (over().hidden) return;
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !over().contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !over().contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  });
  addEventListener('popstate', () => { if (location.hash !== '#signin') close(); });
}

(async () => {
  try { I18N = await grab('data/i18n.json'); } catch {}
  /* 배포는 아직 한국어만이다(app.js 의 UI_LANGS 와 같은 갈림) */
  const dev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
  LANG = dev ? devLang() : 'ko';
  applyI18n(over());
  wire();

  /* 공급자에게 다녀온 길이 아니면 덮개는 닫힌 채로 둔다 — 홈이 먼저다 */
  const back = backFromSso();
  if (!back) return;
  open();
  if (back.s === 'ok') {
    const bind = sessionStorage.getItem(BIND_KEY);
    if (!bind) { say(t('signinFail'), true); return; }
    say(t('reading'));
    return take(bind, back.tag, modalGeneration);
  }
  say(back.s === 'cancel' ? t('signinCancel')
    : back.s === 'busy' ? (t('signinBusy') || t('signinFail'))
    : back.s === 'taken' ? (t('signinTaken') || t('signinFail'))
    : t('signinFail'), true);
})();
})();
