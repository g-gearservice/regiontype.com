/* 내 계정 덮개의 알맹이. 제 페이지가 아니라 홈(index.html) 위에 뜬다 — 여닫기는
   ranked.js 가 순위·기록과 같은 손으로 하고, 이 파일은 처음 열 때 실려 한 번만 돈다.
   다시 열 때마다 rt-account 를 받아 로그인 상태를 새로 읽는다.
   app.js 와 한 문서라 전부를 한 겹 함수 안에 둔다. 프로필 서비스가 없는 항목은
   지원 여부를 명시한다. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const read = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const parse = (key, fallback) => { try { return JSON.parse(read(key)) || fallback; } catch { return fallback; } };
const say = text => { $('#accountSay').textContent = text; };
const write = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { say(t('acctStoreFail')); return false; } };
const opt = parse('rt.opt', {});
/* ── 캐릭터 거울 ───────────────────────────────────────────
   봇 모양·색·크기는 내 스타일(#styles)의 '봇 스타일' 탭(ranked.js)이 맡는다.
   여기서는 서버 프로필의 face 를 rt.character 거울에 맞추고, 고른 모습을
   다른 프로필 칸(닉네임·소개·아이디·스위치)과 함께 /auth/profile 에 실어 보낸다. */
const FALLBACK = { shape: 'cercle', expression: 'curieux', colour: 'accent' };
function readChar() {
  const c = parse('rt.character', {});
  return {
    shape: (c.shape && c.shape !== 'gen') ? c.shape : FALLBACK.shape,
    expression: c.expression || FALLBACK.expression,
    colour: c.colour || FALLBACK.colour,
  };
}
function wear(face) {
  /* 이 세션에서 내 스타일(봇 스타일 탭)로 이미 모양·색을 골랐으면 서버의 옛 face 로 덮지 않는다 */
  if (sessionStorage.getItem('rt.charDirty') === '1') return;
  const [shape, expression, colour] = String(face || '').split(',');
  const cur = parse('rt.character', {});
  const next = {
    shape: shape || cur.shape || FALLBACK.shape,
    expression: expression || cur.expression || FALLBACK.expression,
    colour: colour || cur.colour || FALLBACK.colour,
  };
  if (cur.gen && (!shape || shape === cur.shape || cur.shape === 'gen')) {
    next.shape = cur.shape || 'gen';
    next.gen = cur.gen;
  }
  write('rt.character', JSON.stringify(next));
  dispatchEvent(new Event('rt-bot-look'));
}

const loggedIn = () => !!read('rt.token');
/* 왼쪽 카드의 봇 — 홈 봇(ranked.js 의 syncHomeBot)과 같은 모양·표정·색을 입고 멈춰 선다.
   색 'accent' 는 var(--accent) 라 리전 패스 팔레트를 저절로 따라간다. 고치는 곳은 내 스타일이고,
   거기서 바꾸면 rt-bot-look 이 오거나 판이 닫힐 때 다시 입는다 */
let buddy = null;
function dress() {
  if (!buddy) return;
  const f = parse('rt.character', {});
  buddy.setShape(f.shape || FALLBACK.shape, f.gen);
  buddy.setExpression(f.expression || FALLBACK.expression);
  buddy.setColour(f.colour || FALLBACK.colour);
}
(window.RT_BUDDY_P || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href)).then(({ mountBuddy }) => {
  buddy = mountBuddy($('#accountBot'), { still: true });
  dress();
  buddy.start();
}).catch(() => {});
addEventListener('rt-bot-look', dress);
$('#styles')?.addEventListener('toggle', dress);
/* 남에게 보이는 나 — 닉네임·아이디·소개를 거울(rt.*)과 칸에서 읽어 왼쪽 카드에 적는다 */
function paintMe() {
  $('#accountNick').textContent = read('rt.name');
  const id = $('#accountId').value.trim();
  $('#accountHandle').textContent = /^[a-z0-9_]{3,16}$/.test(id) ? '@' + id : '';
  $('#accountLine').textContent = read('rt.bio');
}
/* 이 브라우저에 남긴 거울을 통째로 지운다. 로그아웃도, 토큰이 죽은 것을 알아챈
   자리도 같은 손을 쓴다 — 한쪽만 지우면 다음 사람이 이 기기로 가입할 때 남은
   값이 그 사람의 공개 프로필로 올라간다(welcome/welcome.js 의 save 참고). */
const KEYS = ['rt.token', 'rt.name', 'rt.bio', 'rt.character', 'rt.botname', 'rt.botsize', 'rt.intro', 'rt.rescue', 'rt.greet'];
const forget = () => {
  clearTimeout(keeping);
  for (const k of KEYS) localStorage.removeItem(k);
  sessionStorage.removeItem('rt.bind');
  switches.push = switches.shut = false;
  document.documentElement.style.setProperty('--bot-scale', 1);
  dispatchEvent(new Event('rt-bot-look'));
};
function leaveOut() {
  $('#accountName').value = '';
  $('#accountBio').value = '';
  $('#accountId').value = '';
  session();
  if (typeof paintUI === 'function') paintUI();
  dispatchEvent(new Event('rt-tab-swap'));
  dispatchEvent(new Event('rt-auth-out'));
  if (location.hash === '#account') history.replaceState(null, '', location.pathname + location.search);
  if (!(window.softReload && softReload('auth'))) location.replace(location.pathname + location.search);
}

/* ── 서버에 남는 프로필 ────────────────────────────────────
   로그인해 있으면 원본은 서버다. localStorage 는 그 거울일 뿐이다 — 경기 화면은
   토큰을 들여다보지 않고 rt.name 만 읽고(app.js·ranked.js), 중계기가 잠깐 안 되어도
   화면이 비면 안 된다. 그래서 늘 브라우저에 먼저 적고 그다음에 올린다. */
const API = self.RT_RELAY;   // relay.js
/* 프로필은 늘 통째로 올린다 — 한 칸만 보내면 서버가 나머지를 빈 값으로 덮는다.
   handle 은 한 번 정하면 서버가 빈 값으로 덮지 않으므로, 아직 안 정한 사람이
   다른 칸을 고쳐도 아이디가 사라지지 않는다. */
const switches = { push: false, shut: false };
const mine = () => {
  const c = readChar();
  return {
    name: read('rt.name'),
    bio: read('rt.bio'),
    face: [c.shape, c.expression, c.colour].join(','),
    lang: parse('rt.opt', {}).lang || 'auto',
    handle: (v => /^[a-z0-9_]{3,16}$/.test(v) ? v : '')(
      $('#accountId').value.trim().replace(/^@/, '').toLowerCase()),
    botname: read('rt.botname'),
    push: switches.push,
    shut: switches.shut,
  };
};
/* 소개(bio)만 비울 수 있다. 닉네임·아이디·캐릭터는 남 앞에 걸리는 값이라 빈 채로
   저장하지 않는다 — 서버도 빈 닉네임을 400 으로 막지만, 그 전에 여기서 무엇이
   비었는지 짚어 준다(400 의 말만 보면 어느 칸인지 모른다).
   캐릭터는 늘 고른 모습이 있어 빌 수가 없다. */
function blank() {
  const p = mine();
  if (!p.name) return t('acctNickEmpty');
  /* 아이디는 아직 안 정한 사람이 있다 — 그 경우 서버가 덮지 않으므로 빈 값이
     올라가도 지워지지 않는다. 칸에 적다 만 것만 막는다 */
  if ($('#accountId').value.trim() && !p.handle) return t('acctIdRule');
  return '';
}
function push(done) {
  if (!loggedIn()) { say(done + ' ' + t('acctSyncHint')); return; }
  const gap = blank();
  if (gap) { say(gap); return; }
  fetch(API + '/auth/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + read('rt.token') },
    body: JSON.stringify(mine()),
  }).then(r => r.ok ? r.json() : Promise.reject(r))
    .then(() => say(done))
    /* 아이디가 겹친 것은 '잠시 후 다시' 가 아니다 — 다시 눌러도 같은 답이 온다 */
    .catch(r => {
      if (r && r.status === 401) {
        try { forget(); } catch { return; }
        leaveOut();
        return;
      }
      say(r && r.status === 409 ? t('acctIdTaken') : t('acctSaveFail'));
    });
}
/* 서버가 준 값을 화면과 거울에 얹는다. 모르는 캐릭터 값은 지금 고른 것을 둔다 —
   서버는 캐릭터 목록을 모르고 모양만 보므로, 아는 쪽이 떨어뜨린다. */
function apply(p) {
  if (!p) return;
  if (p.name) { write('rt.name', p.name); $('#accountName').value = p.name; }
  write('rt.bio', p.bio || '');
  $('#accountBio').value = p.bio || '';
  countBio();
  write('rt.botname', p.botname || '');
  $('#accountId').value = p.handle || '';
  switches.push = !!p.push;
  switches.shut = !!p.shut;
  paintSwitches();
  paintMe();
  wear(p.face);
  if (p.lang && p.lang !== (parse('rt.opt', {}).lang || 'auto')) saveOption('lang', p.lang, true);
}
/* 봇 스타일 탭(ranked.js)에서 모양·색을 바꾸면 여기서 받아 계정에도 올린다 */
let keeping = 0;
addEventListener('rt-bot-save', () => {
  clearTimeout(keeping);
  if (!loggedIn()) return;
  keeping = setTimeout(() => push(t('acctCharSaved')), 700);
});

function session() {
  const inn = loggedIn();
  $('#account').toggleAttribute('data-out', !inn);
  $('#accountLogout').disabled = !inn;
  $('#accountErase').disabled = !inn;
  $('#accountSignin').hidden = inn;
  $('#accountName').disabled = !inn;
  $('#accountName').value = inn ? read('rt.name') : '';
  $('#accountBio').disabled = !inn;
  $('#accountBio').value = inn ? read('rt.bio') : '';
  $('#accountBio').placeholder = t(inn ? 'acctBioPh' : 'acctBioOut');
  countBio();
  $('#accountId').disabled = !inn;
  if (!inn) $('#accountId').value = '';
  paintSwitches();
  paintMe();
  $('#accountSession').textContent = inn ? '' : t('acctSessionOut');
}
$('#accountName').value = read('rt.name');
$('#accountName').addEventListener('change', e => {
  if (!loggedIn()) { session(); return; }
  const value = e.target.value.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, 12);
  if (!value) { e.target.value = read('rt.name'); say(t('acctNickEmpty')); return; }
  e.target.value = value;
  if (write('rt.name', value)) push(t('acctNickSaved'));
});

/* 칸마다의 손이 먼저 돌아 거울에 적은 뒤 여기로 올라온다 — 왼쪽 카드를 다시 적는다 */
$('#account .account-details').addEventListener('change', paintMe);

/* 소개. 서버가 60자에서 자르므로 화면도 60자다 — 자르는 자리가 서로 다르면
   '저장했다'고 해놓고 다른 글이 남는다. */
function countBio() { $('#bioCount').textContent = [...$('#accountBio').value].length + '/60'; }
$('#accountBio').addEventListener('input', countBio);
$('#accountBio').addEventListener('change', e => {
  if (!loggedIn()) { session(); return; }
  const value = e.target.value.replace(/\p{C}/gu, ' ').replace(/ +/g, ' ').trim().slice(0, 60);
  e.target.value = value;
  countBio();
  if (write('rt.bio', value)) push(t(value ? 'acctBioSaved' : 'acctBioCleared'));
});
/* 아이디는 한 번 정하면 여기서 비울 수 없다 — 빈 칸으로 두고 나가도 서버가
   덮지 않으므로, 화면도 서버가 쥔 값으로 되돌려 둔다. 모양이 틀리면 올리지
   않고 그 자리에서 말한다. */
$('#accountId').addEventListener('change', e => {
  if (!loggedIn()) { session(); return; }
  const value = e.target.value.trim().replace(/^@/, '').toLowerCase();
  e.target.value = value;
  if (!value) { say(t('acctIdKeep')); return; }
  if (!/^[a-z0-9_]{3,16}$/.test(value)) {
    say(t('acctIdRule'));
    return;
  }
  push(t('acctIdSaved'));
});

/* 스위치 둘. 색만으로 나누지 않는다 — aria-pressed 와 켬/끔 글자가 같이 선다 */
function paintSwitches() {
  for (const [key, id] of [['push', '#accountPush'], ['shut', '#accountShut']]) {
    const b = $(id);
    b.setAttribute('aria-pressed', String(switches[key]));
    b.disabled = !loggedIn();
    $(id + 'State').textContent = t(switches[key] ? 'acctOn' : 'acctOff');
  }
  $('#accountShutChip').hidden = !switches.shut;
}
/* 알림은 켜는 그 자리에서 브라우저에게도 묻는다 — 우리 쪽 값만 켜 두면
   "켰는데 안 온다" 가 된다. 거절하면 스위치도 도로 내린다. */
$('#accountPush').onclick = async () => {
  if (!switches.push) {
    if (!('Notification' in window)) { say(t('acctNoNotif')); return; }
    let ok = 'denied';
    try { ok = await Notification.requestPermission(); } catch {}
    if (ok !== 'granted') { say(t('acctNotifDenied')); return; }
  }
  switches.push = !switches.push;
  paintSwitches();
  push(t(switches.push ? 'acctPushOn' : 'acctPushOff'));
};
$('#accountShut').onclick = () => {
  switches.shut = !switches.shut;
  paintSwitches();
  push(t(switches.shut ? 'acctShutOn' : 'acctShutOff'));
};

/* quiet 는 서버가 준 값을 되받아 적는 길이다 — 방금 내려받은 것을 도로 올리지 않는다 */
function saveOption(key, value, quiet) {
  const latest = parse('rt.opt', {});
  latest[key] = value;
  if (!write('rt.opt', JSON.stringify(latest))) return;
  opt[key] = value;
  $('#accountLanguage').value = opt.lang || 'auto';
  if (!quiet) push(t('acctOptSaved'));
}
$('#accountLanguage').value = ['ko', 'auto'].includes(opt.lang) ? opt.lang : 'auto';
$('#accountLanguage').onchange = e => saveOption('lang', e.target.value);
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  (window.RT_I18N_P || fetch(asset('data/i18n.json')).then(r => r.json())).then(data => {
    for (const code of Object.keys(data).filter(code => code !== 'ko')) {
      const option = document.createElement('option'); option.value = code;
      try { option.textContent = new Intl.DisplayNames([code], {type: 'language'}).of(code); } catch { option.textContent = code; }
      $('#accountLanguage').append(option);
    }
    $('#accountLanguage').value = opt.lang || 'auto';
  }).catch(() => {});
}
/* 계정 삭제. 사람이 제 것을 거둘 권리라 막아 두지 않는다 — 대신 무엇이 사라지는지
   먼저 또렷이 말하고, 되돌릴 수 없다는 것도 말한다. 지우고 나면 이 브라우저에 남은
   흔적(토큰·이름·소개·캐릭터)도 같이 버리고 홈으로 보낸다. */
$('#accountErase').onclick = async () => {
  if (!loggedIn()) { say(t('acctEraseOut')); return; }
  const ok = confirm(t('acctEraseAsk'));
  if (!ok) return;
  const btn = $('#accountErase');
  btn.disabled = true;
  say(t('acctErasing'));
  try {
    const r = await fetch(API + '/auth/erase', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + read('rt.token') },
      body: JSON.stringify({ sure: true }),
    });
    if (r.status !== 401) {
      /* 200 이어도 본문이 성공이 아니면 지운 것이 아니다. 실패로 보이면 세션을 둔다 */
      const data = await r.json().catch(() => null);
      if (!r.ok || !data || (data.ok !== true && typeof data.gone !== 'number')) throw r;
    }
    /* 서버에서 지워진 뒤에야 이 브라우저를 비운다 — 먼저 비우면 실패했을 때
       토큰을 잃어 제 계정을 지울 길조차 없어진다. */
    try { forget(); }
    catch {
      btn.disabled = false;
      say(t('acctErasedTrace'));
      return;
    }
    say(t('acctErased'));
    leaveOut();
  } catch {
    btn.disabled = false;
    say(t('acctEraseFail'));
  }
};

$('#accountLogout').onclick = () => {
  try { forget(); }
  catch { say(t('acctLogoutFail')); return; }
  leaveOut();
};
session();
function syncOptions() {
  Object.assign(opt, { night: false, lang: 'auto', motion: true }, parse('rt.opt', {}));
  document.documentElement.toggleAttribute('data-night', !!opt.night);
  document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';
  $('#accountLanguage').value = opt.lang || 'auto';
}
function checkSession() {
  const checkedToken = read('rt.token');
  if (!checkedToken) return;
  fetch(API + '/auth/me', { headers: { authorization: 'Bearer ' + checkedToken } })
    .then(r => {
      if (checkedToken !== read('rt.token')) return;
      if (r.status === 401) {
        try { forget(); } catch { return; }
        leaveOut();
      } else if (!r.ok) $('#accountSession').textContent = t('acctCheckFail');
      /* 서버에 남은 프로필이 원본이다 — 이 브라우저에 있던 값은 여기서 덮는다 */
      else return r.json().then(data => {
        if (!data.intro) {
          try {
            localStorage.removeItem('rt.intro');
            localStorage.setItem('rt.rescue', '1');
          } catch {}
          location.replace('welcome/');
          return;
        }
        if (data.intro) write('rt.intro', checkedToken);
        apply(data.profile);
      });
    })
    .catch(() => { if (checkedToken === read('rt.token')) $('#accountSession').textContent = t('acctCheckNet'); });
}
addEventListener('rt-account', () => { session(); syncOptions(); checkSession(); });
addEventListener('storage', e => {
  /* 다른 탭이 토큰을 지우면(계정 삭제·로그아웃) 이 탭도 로그인 화면을 내린다.
     같은 탭의 removeItem 은 storage 가 안 오므로, 지운 자리는 session() 을 직접 부른다 */
  if (e.key === null || e.key === 'rt.token') {
    session();
    if (typeof paintUI === 'function') paintUI();
    if (!loggedIn()) {
      dispatchEvent(new Event('rt-tab-swap'));
      dispatchEvent(new Event('rt-auth-out'));
    }
  } else if (e.key === 'rt.name' || e.key === 'rt.bio') session();
  if (e.key === null || e.key === 'rt.opt') {
    syncOptions();
  }
});
checkSession();
})();
