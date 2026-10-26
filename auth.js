/* regiontype 로그인. 제 페이지가 아니라 홈(index.html) 위에 뜨는 덮개다 —
   화면이 안 바뀌므로 전환은 진짜 요소에 건 CSS transition 이 맡는다(style.css 의
   body.signing). 스냅샷도, 두 문서 사이 이름 맞추기도 없다.

   app.js 와 한 문서에 함께 실린다. 겹치는 잔손($·asset·t 등)은 그대로 두되 전부를
   한 겹 함수 안에 넣어 전역이 부딪히지 않게 한다.
   ponytail: 세 번째 자리가 생기면 그때 공용 모듈로 뽑는다.

   흐름은 relay/worker.mjs 가 정한 대로다:
     /auth/sso  → 공급자로 나갔다가 #signin=ok&t=<tag> 로 돌아온다
     /auth/take → bind + tag 로 토큰을 받는다 (2단계가 걸려 있으면 need:'two' + via 를 준다)
     /auth/log  → 2단계를 패스키로 넘는다
     /auth/two/send, /auth/two/check → 2단계를 메일·문자 코드(영문 8자, 대소문자 구분)로 넘는다
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

const RELAY = self.RT_RELAY;   // relay.js
const TOKEN_KEY = 'rt.token', BIND_KEY = 'rt.bind', NAME_KEY = 'rt.name';
const OPT_KEY = 'rt.opt';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

/* 설정은 홈과 같은 통에서 읽는다 — 야간 모드와 모션이 페이지를 넘어도 따라오게 */
const opt = read(OPT_KEY, '{}');

/* ── 화면 말 ─────────────────────────────────────────── */
/* 부트 스크립트가 읽어 둔 마지막 말 팩(app.js cacheUI)이 있으면 그것부터 쓴다 — 전체 팩을
   받기 전에 덮개를 열어도 HTML 에 적힌 한국어가 비치지 않게. 전체 팩은 아래에서 받는다 */
let I18N = window.RT_UI ? { [RT_UI.lang]: RT_UI.pack } : { ko: {} }, LANG = window.RT_UI ? RT_UI.lang : 'ko';
/* 그 말에 없는 키는 영어로, 아무 데도 없으면 빈 값 — 부르는 쪽이 HTML 에 적힌 말을 덮지 않게 */
const t = (key, vars) => {
  let s = (I18N[LANG] || {})[key] || (I18N.en || {})[key] || (I18N.ko || {})[key] || '';
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

/* home 이면 홈(app.js paintUI)이 <html lang> 에 적은 말을 빌린다 — sense() 의 HERE.lang 까지
   본 결과라 여기서 다시 고르면 어긋난다. 처음 읽을 때는 HTML 의 lang="ko" 가 아직 그대로라
   쓰지 않고 같은 규칙으로 고른다 */
function uiLang(home = false) {
  const langs = Object.keys(I18N);
  if (opt.lang !== 'auto' && langs.includes(opt.lang)) return opt.lang;
  if (home && langs.includes(document.documentElement.lang)) return document.documentElement.lang;
  for (const tag of [...(navigator.languages || []), navigator.language]) {
    const hit = parseUiLang(tag, langs);
    if (hit) return hit;
  }
  return langs.includes('en') ? 'en' : (langs[0] || 'ko');
}

/* ── 잔손 ────────────────────────────────────────────── */
const toB64u = b => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const shaB64u = async s => toB64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

const say = (msg, bad) => {
  const p = $('#siSay');
  p.textContent = msg || '';
  p.classList.toggle('bad', !!bad);
};

/* 메일 코드는 숫자 6자리 — 공백만 걷는다. 모양이 아니면 '' */
const otpOf = el => {
  const s = el.value.replace(/\s+/g, '');
  return /^\d{6}$/.test(s) ? s : '';
};

const VIEWS = ['vSignin', 'vTwo'];
/* 첫 화면을 그리는 동안은 포커스를 옮기지 않는다 — 짚지도 않았는데 포커스 테두리가
   그려져 글자가 선택된 것처럼 보인다. 탭 키는 그대로 첫 버튼에 닿는다 */
let live = false;
function show(id) {
  VIEWS.forEach(v => { $('#' + v).hidden = v !== id; });
  if (id === 'vTwo') { resetTwo(); paintTwo(); }
  /* 화면이 바뀌면 손이 갈 첫 자리로 포커스를 옮긴다 — 키보드만으로도 이어진다.
     숨긴 버튼은 건너뛴다. */
  const first = live && [...$('#' + id).querySelectorAll('button:not([disabled]), input:not([disabled])')]
    .find(el => !el.closest('[hidden]') && el.getClientRects().length);
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

/* 2단계 화면 — 한 장에 할 일 하나다. mode 'mail' 은 메일 코드 칸, 'code' 는 복구 코드 칸과
   보조 메일 구조다. 열 때마다 칸을 비우고, 쓴 코드는 칸에 남기지 않는다 */
const RESEND_S = 30;   // 다시 보내기 사이 쉬는 초. 중계기는 한 시도에 5통까지 받는다
let resendTimer = 0;
function resetTwo() {
  ['twoOtpIn', 'codeIn', 'rescueIn'].forEach(id => { $('#' + id).value = ''; });
  ['twoOtpGo', 'codeGo', 'rescueGo', 'twoCode', 'twoBack'].forEach(id => { $('#' + id).disabled = false; });
  clearInterval(resendTimer);
  const again = $('#twoResend');
  again.disabled = false;
  again.textContent = t('twoResend');
  $('#twoLost').open = false;
  if (TWO) { TWO.sent = ''; TWO.mode = TWO.via.mail ? 'mail' : 'code'; }
}
/* 메일을 보낼 수 있으면 메일 코드부터, 아니면 복구 코드부터 보인다. 둘 다 없으면 보조 메일 구조를 펼친다 */
function paintTwo() {
  const two = TWO;
  if (!two) return;
  const mail = two.mode === 'mail';
  $('#twoLead').textContent = !mail ? t('twoLeadCode')
    : two.mailTo ? t('twoLead', { to: two.mailTo }) : t('twoLeadPlain');
  $('#twoOtpForm').hidden = !mail;
  $('#codeForm').hidden = mail;
  $('#twoResend').hidden = !mail;
  $('#twoCode').hidden = !mail;
  $('#twoBack').hidden = mail || !two.via.mail;
  $('#twoLost').hidden = mail;
  if (!two.via.mail && !two.via.code) {
    $('#twoLost').open = true;
    say(t('twoNone'), true);
  }
}
function twoMode(mode) {
  TWO.mode = mode;
  say('');
  paintTwo();
  $(mode === 'mail' ? '#twoOtpIn' : '#codeIn').focus();
}
/* 보낸 직후에는 다시 보내기를 잠시 쉰다 — 남은 초를 글로 센다(색만으로 막지 않는다) */
function coolResend() {
  const b = $('#twoResend');
  let left = RESEND_S;
  const tick = () => {
    if (left <= 0) { clearInterval(resendTimer); b.disabled = false; b.textContent = t('twoResend'); return; }
    b.disabled = true;
    b.textContent = t('twoResendIn', { s: left-- });
  };
  clearInterval(resendTimer);
  tick();
  resendTimer = setInterval(tick, 1000);
}
/* 틀렸다는 말은 글(siSay)이 하고, 칸은 한 번 흔들려 어디가 틀렸는지 가리킨다 */
function shake(el) {
  el.classList.remove('is-wrong');
  void el.offsetWidth;
  el.classList.add('is-wrong');
}
/* ── SSO ─────────────────────────────────────────────── */
let TWO = null;      // { bind, tag, isNew, via, mailTo, sent, mode } — 2단계가 도는 동안만 산다

async function sso(p) {
  const generation = modalGeneration;
  const btns = [$('#goGoogle')];
  btns.forEach(b => b.disabled = true);
  say(t('signinWait'));
  try {
    /* bind 는 이 브라우저에만 남는다. 공급자에게는 그 해시(state)만 간다 */
    const bind = toB64u(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(BIND_KEY, bind);
    /* 로컬 중계기에는 Google 비밀이 없어 콜백 DB 도 갈라진다. 로그인은 운영 중계기로
       보내고, 그 토큰을 검사하는 쪽도 그 중계기가 되게 릴레이 선택을 바꿔 둔다. */
    let relay = RELAY;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && RELAY.startsWith('http://')) {
      localStorage.setItem('rt.relay', 'live');
      relay = self.RT_LIVE || 'https://regiontype.gearservicevanguard.com';
    }
    const head = { 'content-type': 'application/json' };
    const tok = token();
    if (tok) head.authorization = 'Bearer ' + tok;
    const r = await fetch(relay + '/auth/sso', {
      method: 'POST', headers: head, body: JSON.stringify({ p, s: await shaB64u(bind) }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.msg || t('signinFail'));
    if (current(generation)) location.assign(d.url);
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
  /* 누구든 2단계(메일 숫자 6자리)를 거친다. 메일을 보낼 수 있으면 바로 보낸다 */
  if (d.need === 'two') {
    const v = d.via || {};
    TWO = {
      bind, tag, isNew: d.isNewAccount === true,
      via: { mail: !!v.mail, code: !!v.code },
      mailTo: v.mail && typeof d.mailTo === 'string' ? d.mailTo : '',
      sent: '', mode: '',
    };
    say('');
    show('vTwo');
    if (TWO.via.mail) $('#twoResend').click();
    return;
  }
  sessionStorage.removeItem(BIND_KEY);
  say(t('signinFail'), true);
  show('vSignin');
}

const MIRROR_KEYS = [NAME_KEY, 'rt.bio', 'rt.character', 'rt.botname', 'rt.botsize', 'rt.intro', 'rt.rescue', 'rt.greet'];
function clearMirror() {
  for (const k of MIRROR_KEYS) { try { localStorage.removeItem(k); } catch {} }
}
function clearAcct() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  clearMirror();
  try { sessionStorage.removeItem(BIND_KEY); } catch {}
}
function mirrorProfile(p, introTok) {
  try {
    if (introTok) localStorage.setItem('rt.intro', introTok);
    if (!p) return;
    if (p.name) localStorage.setItem(NAME_KEY, p.name);
    localStorage.setItem('rt.bio', p.bio || '');
    localStorage.setItem('rt.botname', p.botname || '');
    const [shape, expression, colour] = String(p.face || '').split(',');
    if (shape && expression && colour) {
      localStorage.setItem('rt.character', JSON.stringify({ shape, expression, colour }));
    }
    if (p.lang) {
      const cur = read(OPT_KEY, '{}');
      if (cur.lang !== p.lang) {
        cur.lang = p.lang;
        localStorage.setItem(OPT_KEY, JSON.stringify(cur));
      }
    }
  } catch {}
}

/* 토큰을 쥐었으면 여기 볼 것은 없다 — 계정 화면은 독립 페이지다.
   처음 만든 계정은 가입 안내(welcome/)로 보낸다: 캐릭터와 프로필을 한 장씩
   맞추고 나면 스스로 홈으로 돌아온다. 이미 마친 사람이 그 주소로 와도
   welcome.js 가 /auth/me 의 intro 를 보고 비켜 준다 */
async function done(tok, generation, isNewAccount = false) {
  if (!current(generation)) return;
  clearMirror();
  localStorage.setItem(TOKEN_KEY, tok);
  sessionStorage.removeItem(BIND_KEY);   // 쓰고 나면 지운다
  TWO = null;
  if (!isNewAccount) {
    try {
      const r = await fetch(RELAY + '/auth/me', { headers: { authorization: 'Bearer ' + tok } });
      if (!current(generation)) return;
      if (r.ok) {
        const d = await r.json().catch(() => null);
        if (!current(generation)) return;
        /* 이름을 이미 적어도 안내(intro)를 끝내기 전이면 다시 안내로 보낸다. */
        if (d && !d.intro) isNewAccount = true;
        else if (d) mirrorProfile(d.profile, d.intro ? tok : '');
      }
    } catch {}
  }
  say('');
  close();
  /* 새 계정이면 가입 안내를 마치고 돌아온 첫 홈에서 봇이 꺼내 달라고 조른다(ranked.js) */
  if (isNewAccount) localStorage.setItem('rt.rescue', '1');
  /* 로그인하고 돌아온 홈에서는 봇이 먼저 나와 인사한다(ranked.js 의 greetIn) — 한 번만 */
  localStorage.setItem('rt.greet', '1');
  if (isNewAccount) return location.assign('welcome/');
  /* 홈은 그 자리에서 티 안 나게 새로 연다(app.js softReload) — 화면은 그대로, 계정 것만 새로 읽는다 */
  if (!(window.softReload && softReload('auth'))) location.assign('./');
}

/* ── 덮개 여닫기 ─────────────────────────────────────── */
const over = () => $('#signin');
let opener = null;
/* ── Grok 봇(bloub) ──────────────────────────────────────
   로고 오른쪽 위에서 떠 있다. 끌어다 놓은 자리에 내려앉아 잠들고, 로고 근처에 놓으면
   제자리로 돌아간다. 끄는 동안 Option(맥·리눅스)이나 Ctrl(윈도)을 누르고 있으면
   한 마리가 더 생긴다. 뒤의 지도는 구마다 도트 묶음이라 봇이 칸에 붙지 않는다 */
const motionOff = () => matchMedia('(prefers-reduced-motion:reduce)').matches
  || document.documentElement.dataset.motion === 'off';
const BOT = 44;
const WIN = /Win/i.test(navigator.userAgentData?.platform || navigator.platform || '');
const cloneKey = e => e.altKey || (WIN && e.ctrlKey);
const bots = [];
let mountBuddy = null;

async function botMaker() {
  if (!mountBuddy) ({ mountBuddy } = await (window.RT_BUDDY_P || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href)));
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
/* 제자리(로고 옆)에서 내려온다 — 손에 잡히는 크기로 돌아간다.
   이름을 unseat 로 둔 것은 botGrab 안의 지역 drop(포인터업)과 가려지지 않게 하려는 것이다 */
function unseat(b) {
  b.home = false;
  b.el.classList.remove('is-home');
  b.size = BOT;
  wake(b, false);
}
function wake(b, on) {
  b.el.classList.toggle('is-on', on);
  if (!on) b.size = BOT;
  /* 홈 도우미 봇과 같은 얼굴 — idle 몸 + doze 눈감기. 엔진 sleep(작은 점)은 쓰지 않는다 */
  if (b.api) {
    b.api.setState('idle');
    if (typeof b.api.doze === 'function') b.api.doze(!on);
  }
}
async function addBot(x, y) {
  const make = await botMaker().catch(() => null);
  if (!make) return null;
  const el = document.createElement('div');
  el.className = 'si-bot';
  const motion = document.createElement('span');
  motion.className = 'si-bot-motion';
  el.append(motion);
  $('#siBots').append(el);
  const b = { el, motion, api: make(motion, { calm: motionOff }),
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
      if (overLogo(px, py)) { park(t); return; }
      /* 그 자리에 내려앉아 잠든다 */
      const from = { x: t.x, y: t.y - 5, size: t.size };
      wake(t, false);
      springTo(t, t.x, t.y, from);
    };
    t.el.addEventListener('pointermove', move);
    t.el.addEventListener('pointerup', drop, { once: true });
    t.el.addEventListener('pointercancel', drop, { once: true });
  };
  start();
}
async function wakeBuddy() {
  if (!bots.length) { const p = parkAt(); await addBot(p.x, p.y); }
  bots.forEach(b => { park(b, false); b.api.start(); });
}
function sleepBuddy() {
  /* 복제본은 그 판의 놀이라 정리한다 */
  while (bots.length > 1) { const b = bots.pop(); unseat(b); b.api.stop(); b.el.remove(); }
  bots.forEach(b => { park(b, false); b.api.stop(); b.api.lookAway(); });
}
/* 봇은 커서 쪽을 바라본다. 화면 좌표 그대로 넘기면 된다 — 방향 재기도 세로축
   뒤집기도 mountBuddy 의 lookToward 안에서 한 번만 한다. */
function buddyLook(e) {
  if (motionOff() || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  for (const b of bots) b.api.lookToward(e.clientX, e.clientY);
}
let backgroundState = [];
function setBackgroundInert(inert) {
  if (inert) {
    backgroundState = [...document.body.children]
      .filter(el => el !== over() && el.id !== 'boot' && el.id !== 'options' && el.id !== 'codes' && el.id !== 'tabDock' && el.tagName !== 'SCRIPT')
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
  LANG = uiLang(true); applyI18n(over());   // 홈이 말을 늦게 정해도 열 때마다 맞춘다
  modalGeneration += 1;
  dispatchEvent(new CustomEvent('rt-open-signin'));
  opener = document.activeElement;
  setBackgroundInert(true);
  over().hidden = false;
  document.body.classList.add('signing');
  live = true;
  show('vSignin');
  /* 뒤로 가기로 닫힌다 — 주소는 그대로고 기록만 한 칸 쌓는다 */
  if (location.hash !== '#signin') histPush({ si: 1 }, '#signin');
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
  const rescueIn = $('#rescueIn');
  if (rescueIn) rescueIn.value = '';
  resetTwo();
  $('#goGoogle').disabled = false;
  say('');
  setBackgroundInert(false);
  if (opener) { opener.focus(); opener = null; }
  if (location.hash === '#signin') history.replaceState(null, '', location.pathname + location.search);
}

/* ── 손잡이 ──────────────────────────────────────────── */
function wire() {
  $('#goGoogle').onclick = () => sso('google');
  const rescue = $('#rescueForm');
  if (rescue) rescue.onsubmit = async e => {
    e.preventDefault();
    const generation = modalGeneration;
    say(t('twoSending'));
    try {
      await ask('/auth/rescue', { email: $('#rescueIn').value.trim() });
      if (!current(generation)) return;
      $('#rescueIn').value = '';
      say(t('rescueSent'));
      $('#codeIn').focus();
    } catch (err) {
      if (!current(generation)) return;
      say(err.status === 503 ? (t('mailFail') || err.message) : (err.message || t('signinFail')), true);
    }
  };
  const mailSay = (msg, bad) => {
    const el = $('#mailSay');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('bad', !!bad);
  };
  const mailForm = $('#mailForm');
  if (mailForm) mailForm.onsubmit = async e => {
    e.preventDefault();
    mailSay(t('twoSending'));
    try {
      await ask('/auth/mail', { email: $('#mailIn').value.trim() });
      $('#mailIn').value = '';
      $('#mailConfirm').hidden = false;
      $('#mailCode').focus();
      mailSay(t('mailSent'));
    } catch (err) {
      mailSay(err.status === 503 ? (t('mailFail') || err.message)
        : err.status === 429 ? (t('twoBusy') || err.message)
        : (err.message || t('signinFail')), true);
    }
  };
  const mailConfirm = $('#mailConfirm');
  if (mailConfirm) mailConfirm.onsubmit = async e => {
    e.preventDefault();
    const code = otpOf($('#mailCode'));
    if (!code) return mailSay(t('twoOtpBad'), true);
    mailSay(t('twoChecking'));
    try {
      await ask('/auth/mail/confirm', { code });
      $('#mailCode').value = '';
      mailConfirm.hidden = true;
      mailSay(t('mailOk'));
      dispatchEvent(new Event('rt-acct'));
    } catch (err) {
      mailSay(err.status === 401 ? t('twoOtpWrong') : (err.message || t('signinFail')), true);
      $('#mailCode').select();
    }
  };
  /* 메일 코드 보내기. 다시 보내면 중계기가 앞 코드를 버린다(마지막 것만 유효).
     어디로 갔는지는 머리말이 이미 말한다 — 첫 발송은 따로 알리지 않는다 */
  async function sendTwo() {
    const generation = modalGeneration;
    const two = TWO;
    if (!two) return;
    const again = !!two.sent;
    $('#twoResend').disabled = true;
    say(t('twoSending'));
    try {
      await ask('/auth/two/send', { b: two.bind, t: two.tag, via: 'mail' });
      if (!current(generation)) return;
      two.sent = 'mail';
      say(again ? t('twoSentAgain') : '');
      coolResend();
      if (two.mode === 'mail') $('#twoOtpIn').focus();
    } catch (err) {
      if (!current(generation)) return;
      $('#twoResend').disabled = false;
      say(err.status === 429 ? t('twoTooMany')
        : err.status === 503 ? t('mailFail')
        : t('twoSendFail'), true);
    }
  }
  $('#twoResend').onclick = () => sendTwo();
  /* 여섯 자리가 차면 바로 확인한다 — 붙여 넣기·자동 채움도 한 번에 끝난다 */
  $('#twoOtpIn').addEventListener('input', e => {
    const el = e.target, v = el.value.replace(/\D/g, '').slice(0, 6);
    if (v !== el.value) el.value = v;
    el.classList.remove('is-wrong');
    if (v.length === 6 && !$('#twoOtpGo').disabled) $('#twoOtpForm').requestSubmit();
  });
  $('#twoOtpForm').onsubmit = async e => {
    e.preventDefault();
    const generation = modalGeneration;
    const two = TWO;
    if (!two) return;
    const inp = $('#twoOtpIn');
    const code = otpOf(inp);
    if (!code) { say(t('twoOtpBad'), true); shake(inp); return inp.select(); }
    $('#twoOtpGo').disabled = true;
    say(t('twoChecking'));
    try {
      const d = await ask('/auth/two/check', { b: two.bind, t: two.tag, code });
      if (!current(generation)) return;
      inp.value = '';                 // 쓴 코드를 칸에 남겨 두지 않는다
      return done(d.token, generation, two.isNew);
    } catch (err) {
      if (!current(generation)) return;
      if (err.status === 400) {       // 요청이 만료됐다 — 처음부터
        TWO = null;
        try { sessionStorage.removeItem(BIND_KEY); } catch {}
        resetTwo();
        show('vSignin');
        return say(t('twoExpired'), true);
      }
      say(err.status === 401 ? t('twoOtpWrong')
        : err.status === 429 ? t('twoTooMany')
        : err.status === 503 ? t('twoSendFail')
        : t('loginFail'), true);
      if (err.status === 401) { shake(inp); inp.select(); }
    }
    $('#twoOtpGo').disabled = false;
  };
  $('#twoCode').onclick = () => twoMode('code');
  $('#twoBack').onclick = () => twoMode('mail');
  $('#codeIn').addEventListener('input', e => e.target.classList.remove('is-wrong'));
  $('#codeForm').onsubmit = async e => {
    e.preventDefault();
    const generation = modalGeneration;
    const two = TWO;
    if (!two) return;
    const inp = $('#codeIn');
    const code = inp.value.trim().toLowerCase();
    $('#codeGo').disabled = true;
    say(t('twoChecking'));
    try {
      const d = await ask('/auth/code', { b: two.bind, t: two.tag, code });
      if (!current(generation)) return;
      inp.value = '';                 // 쓴 코드를 칸에 남겨 두지 않는다
      return done(d.token, generation, two.isNew);
    } catch {
      if (!current(generation)) return;
      say(t('loginFail'), true);
      shake(inp);
      inp.select();
    }
    $('#codeGo').disabled = false;
  };

  /* 홈의 '로그인' 은 이제 페이지가 아니라 이 덮개를 연다. 로그인해 있으면
     app.js 가 라벨과 href 를 계정 쪽으로 바꿔 두므로 그때는 가로채지 않는다 */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href !== 'signin/' && !href.startsWith('signin/') && href !== '#signin') return;
    e.preventDefault();
    open();
  });
  $('#siClose').onclick = close;
  over().addEventListener('pointermove', buddyLook);
  over().addEventListener('pointerleave', () => bots.forEach(b => b.api.lookAway()));
  addEventListener('rt-open-settings', close);
  addEventListener('rt-tab-swap', close);
  addEventListener('keydown', e => {
    if (over().hidden) return;
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const items = focusable().filter(n => n.getClientRects().length).concat(dockTabs());
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  });
  addEventListener('popstate', () => { if (location.hash !== '#signin') close(); });
}

/* 공급자에게 다녀온 길이 아니면 첫 진입 로딩(app.js boot)의 사용자 신호 단계가 기다릴 수 있게
   /auth/me 확인을 먼저 띄워 둔다 — 봇 스타일과 언어가 서버 프로필과 어긋나지 않게 */
const ssoBack = backFromSso();
if (!ssoBack) {
  const checkedTok = token();
  if (checkedTok) {
    window.RT_ME_P = fetch(RELAY + '/auth/me', {
      headers: { authorization: 'Bearer ' + checkedTok },
      signal: AbortSignal.timeout(2400),
    })
      .then(async r => {
        if (checkedTok !== token()) return;
        if (r.status === 401) {
          clearAcct();
          dispatchEvent(new Event('rt-tab-swap'));
          dispatchEvent(new Event('rt-auth-out'));
          if (typeof paintUI === 'function') paintUI();
          /* 토큰이 죽어서 로그인된 사람이 아니다. 홈에 남기지 않고 소개로 보낸다.
             호출: index.html 이 auth.js 를 싣고, 응답은 /auth/me 401. 토큰 키는 rt.token. */
          try {
            const framed = window.top !== window.self;
            const home = location.pathname === '/' || location.pathname === '/index.html';
            if (!framed && home && !location.search.includes('rt=1') && sessionStorage.getItem('rt.home') !== '1') location.replace('/landing/' + location.search);
          } catch {}
          return;
        }
        if (!r.ok) return;
        const d = await r.json().catch(() => null);
        if (!d || checkedTok !== token()) return;
        if (!d.intro) {
          try {
            localStorage.removeItem('rt.intro');
            localStorage.setItem('rt.rescue', '1');
          } catch {}
          if (!$('#play')?.classList.contains('on')) location.assign('welcome/');
          return;
        }
        mirrorProfile(d.profile, d.intro ? checkedTok : '');
      })
      .catch(() => {});
  }
}

(async () => {
  applyI18n(over());   // 마지막 말 팩으로 먼저
  try { I18N = await (window.RT_I18N_P || grab('data/i18n.json')); } catch {}
  LANG = uiLang();
  applyI18n(over());
  wire();

  /* 공급자에게 다녀온 길이 아니면 덮개는 닫힌 채로 둔다 — 홈이 먼저다 */
  const back = ssoBack;
  /* 다른 페이지(community/)가 /#signin 으로 보내면 덮개를 연 채로 맞는다 */
  if (!back) {
    if (location.hash === '#signin') open();
    return;
  }
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
