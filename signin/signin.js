/* regiontype 로그인 화면 (/signin/).

   app.js 를 싣지 않는다 — 그 파일은 최상단에서 홈 전용 DOM($('#verBuild') 등)을
   건드려 이 페이지에서 곧바로 터진다. 겹치는 잔손($·asset·t·b64u)은 하나하나가
   다섯 줄 미만이라 여기 다시 적는다.
   ponytail: 세 번째 페이지가 생기면 그때 공용 모듈로 뽑는다 — 두 곳이면 옮기는
   값이 뽑아 쓰는 값보다 작다.

   흐름은 relay/worker.mjs 가 정한 대로다:
     /auth/sso  → 공급자로 나갔다가 #signin=ok&t=<tag> 로 돌아온다
     /auth/take → bind + tag 로 토큰을 받는다 (패스키가 있으면 2단계를 더 묻는다)
     /auth/log  → 2단계를 패스키로 넘는다
     /auth/code → 2단계를 복구 코드로 넘는다
   토큰을 쥐면 여기 할 일은 끝이다 — 계정 화면(패스키 추가·복구 코드·로그아웃)은
   /settings/#security 다. replace 로 넘긴다: assign 이면 뒤로 가기가 로그인 화면으로
   되돌아와 다시 여기로 튕긴다.                                              */
'use strict';

const $ = s => document.querySelector(s);
/* VER 을 여기 또 적지 않는다 — 손으로 고칠 자리는 signin/index.html 의 ?v= 하나다 */
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
document.documentElement.toggleAttribute('data-night', !!opt.night);
document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';

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
async function passkeyTwo() {
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: fromB64u(TWO.challenge), rpId: location.hostname,
    userVerification: 'preferred', timeout: 60000,
  } });
  const r = cred.response;
  const out = await ask('/auth/log', {
    challenge: TWO.challenge, id: toB64u(cred.rawId),
    clientDataJSON: toB64u(r.clientDataJSON),
    authData: toB64u(r.authenticatorData), sig: toB64u(r.signature),
  });
  done(out.token);
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

/* ── SSO ─────────────────────────────────────────────── */
let TWO = null;      // { bind, tag, challenge } — 2단계가 도는 동안만 산다

async function sso(p) {
  const btns = [$('#goGoogle'), $('#goApple')];
  btns.forEach(b => b.disabled = true);
  say(t('signinWait'));
  try {
    /* bind 는 이 브라우저에만 남는다. 공급자에게는 그 해시(state)만 간다 */
    const bind = toB64u(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(BIND_KEY, bind);
    const { url } = await ask('/auth/sso', { p, s: await shaB64u(bind) });
    location.assign(url);
  } catch {
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

async function take(bind, tag) {
  let d;
  try {
    d = await ask('/auth/take', { b: bind, t: tag });
  } catch (e) {
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
  if (d.token) return done(d.token);
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
function done(tok) {
  localStorage.setItem(TOKEN_KEY, tok);
  sessionStorage.removeItem(BIND_KEY);   // 쓰고 나면 지운다
  TWO = null;
  say('');
  toAccount();
}
const toAccount = () => location.replace('../settings/#security');

/* ── 손잡이 ──────────────────────────────────────────── */
function wire() {
  $('#goGoogle').onclick = () => sso('google');
  $('#goApple').onclick = () => sso('apple');

  $('#twoGo').onclick = () => tryAuth(passkeyTwo, t('askingDevice'), [$('#twoGo'), $('#twoCode')]);
  $('#twoCode').onclick = () => {
    $('#codeForm').hidden = false;
    $('#codeIn').focus();
  };
  $('#codeForm').onsubmit = async e => {
    e.preventDefault();
    const code = $('#codeIn').value.trim().toLowerCase();
    say(t('askingDevice'));
    try {
      const d = await ask('/auth/code', { b: TWO.bind, t: TWO.tag, code });
      $('#codeIn').value = '';        // 쓴 코드를 칸에 남겨 두지 않는다
      done(d.token);
    } catch {
      say(t('loginFail'), true);
      $('#codeIn').select();
    }
  };

  /* Esc 는 뒤로 */
  addEventListener('keydown', e => {
    if (e.key === 'Escape') location.assign('../');
  });
}

(async () => {
  try { I18N = await grab('../data/i18n.json'); } catch {}
  /* 배포는 아직 한국어만이다(app.js 의 UI_LANGS 와 같은 갈림) */
  const dev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
  LANG = (dev && I18N[opt.lang]) ? opt.lang : 'ko';
  document.documentElement.lang = LANG;
  applyI18n(document);
  wire();

  const back = backFromSso();
  if (!back) { if (token()) return toAccount(); show('vSignin'); live = true; return; }
  if (back.s === 'ok') {
    const bind = sessionStorage.getItem(BIND_KEY);
    if (!bind) { say(t('signinFail'), true); show('vSignin'); live = true; return; }
    say(t('reading'));
    show('vSignin');
    /* 여기부터는 사람이 공급자를 거쳐 돌아온 뒤다 — 화면이 바뀌면 포커스도 따라간다 */
    live = true;
    return take(bind, back.tag);
  }
  say(back.s === 'cancel' ? t('signinCancel')
    : back.s === 'busy' ? (t('signinBusy') || t('signinFail'))
    : back.s === 'taken' ? (t('signinTaken') || t('signinFail'))
    : t('signinFail'), true);
  show('vSignin');
  live = true;
})();
