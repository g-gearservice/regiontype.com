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
  if (d.token) return done(d.token, generation);
  if (d.need === 'passkey') {
    TWO = { bind, tag, challenge: d.challenge };
    say('');
    return show('vTwo');
  }
  sessionStorage.removeItem(BIND_KEY);
  say(t('signinFail'), true);
  show('vSignin');
}

/* 토큰을 쥐었으면 여기 볼 것은 없다 — 계정 화면은 설정의 보안 탭이다 */
function done(tok, generation) {
  if (!current(generation)) return;
  localStorage.setItem(TOKEN_KEY, tok);
  sessionStorage.removeItem(BIND_KEY);   // 쓰고 나면 지운다
  TWO = null;
  say('');
  toAccount();
}
const toAccount = () => {
  close();
  location.hash = 'security';
};

/* ── 덮개 여닫기 ─────────────────────────────────────── */
const over = () => $('#signin');
let opener = null;
/* 로그인 로고 옆 주황 점은 Grok 봇(bloub). 덮개가 열리면 그 자리에 앉고
   한 바퀴씩 돈다. 모션을 줄이면 시계를 돌리지 않고 한 장만 둔다 */
const motionOff = () => matchMedia('(prefers-reduced-motion:reduce)').matches
  || document.documentElement.dataset.motion === 'off';
let buddy = null;
async function wakeBuddy() {
  const host = $('.si-logo .dot');
  if (!host) return;
  try {
    if (!buddy) {
      const { mountBuddy } = await import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href);
      buddy = mountBuddy(host, { calm: motionOff });
      host.classList.add('is-buddy');
    }
    buddy.start();
  } catch {}
}
function sleepBuddy() {
  if (!buddy) return;
  buddy.stop();
  buddy.lookAway();
}
function buddyLook(e) {
  if (!buddy || motionOff() || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const box = buddy.node.getBoundingClientRect();
  const dx = (e.clientX - (box.left + box.width / 2)) / Math.max(box.width, 1);
  const dy = (e.clientY - (box.top + box.height / 2)) / Math.max(box.height, 1);
  buddy.lookAt(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
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
  over().addEventListener('pointerleave', () => { if (buddy) buddy.lookAway(); });
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
