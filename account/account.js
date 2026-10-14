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
/* ── 캐릭터 ────────────────────────────────────────────────
   그림과 움직임은 로그인 화면·경쟁전 봇과 같은 엔진(assets/bloub)이 낸다. 예전엔
   여기만 CSS 로 흉내 낸 동그라미였는데, 눈만 까딱해 같은 놈으로 보이지 않았다.
   이제 셋이 한 몸이라 여기서 고른 모습이 경쟁전 봇에 그대로 나간다.

   모양·표정·색의 id 는 엔진이 쥐고 있고(프랑스어다), 화면에 걸 이름은 화면 말 표에서 꺼낸다. */
const KO = id => (id && t('ch_' + id) !== 'ch_' + id) ? t('ch_' + id) : '';   // 이름은 data/i18n.json 의 ch_<id>
const FALLBACK = { shape: 'cercle', expression: 'curieux', colour: 'turquoise' };
const saved = parse('rt.character', {});
const character = { ...FALLBACK };
const lists = { shape: [], expression: [], colour: [] };
const hexes = new Map();
/* 장식 움직임이라 움직임 줄이기(OS·앱 설정)가 켜져 있으면 한 장만 그리고 멈춘다 */
const still = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

let me = null;            // 확대 크기 미리보기
let real = null;          // 실제 크기 — 홈 봇과 같은 px(--bot-scale)
const thumbs = { shape: new Map(), expression: new Map() };
let aim = null, looking = 0, waiting = null;

/* 서버가 준 'shape,expression,colour' 를 입는다. 엔진이 아직 안 왔으면 목록이 비어
   무엇이 옳은 값인지 판단할 수 없으니 들고 있다가 오면 그때 입는다 — 여기서 그냥
   버리면 로그인한 사람이 자기 캐릭터 대신 기본값을 보고, 다음 저장에 그게 덮어쓴다. */
function wear(face) {
  if (!lists.shape.length) { waiting = face; return; }
  waiting = null;
  const [shape, expression, colour] = String(face || '').split(',');
  for (const [key, value] of [['shape', shape], ['expression', expression], ['colour', colour]]) {
    if (lists[key].includes(value)) character[key] = value;
  }
  write('rt.character', JSON.stringify(character));
  paint();
}

function paint() {
  for (const key of ['shape', 'expression', 'colour']) {
    $('#' + key + 'Label').textContent = KO(character[key]) || '';
    document.querySelectorAll('[data-' + key + ']')
      .forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === character[key])));
  }
  $('#character').setAttribute('aria-label',
    `${KO(character.colour)} ${KO(character.shape)} · ${KO(character.expression)}`);
  if (!me) return;
  for (const api of [me, real]) {
    api.setShape(character.shape);
    api.setExpression(character.expression);
    api.setColour(character.colour);
  }
  /* 표정 견본은 지금 고른 모양과 색을 입고 서 있어야 고를 때 비교가 된다 */
  for (const [id, api] of thumbs.expression) { api.setShape(character.shape); api.setColour(character.colour); void id; }
  for (const [id, api] of thumbs.shape) { api.setExpression(character.expression); api.setColour(character.colour); void id; }
}

/* 커서를 따라본다. 큰 놈도 견본 스물넷도 모두 제자리에서 커서 쪽을 본다 —
   저마다 제 한가운데에서 커서까지의 방향을 재므로 화면 어디에 있든 같은 곳을 본다.

   견본은 제 시계를 안 돌린다(still). 스물넷이 저마다 숨 쉬면 프레임을 먹으니,
   대신 이 한 바퀴에서 한 장씩 그려 준다 — 도는 rAF 는 큰 놈 하나와 여기 하나뿐이다.
   화면 좌표를 그대로 넘기고, 방향과 세기는 mountBuddy 의 lookToward 가 잰다
   (로그인 화면의 봇과 같은 자 — 화면 너비로 나누던 옛 셈은 고개를 안 돌렸다). */
function eachLooker(f) {
  if (me) f(me);
  if (real) f(real);
  for (const key of ['shape', 'expression']) for (const api of thumbs[key].values()) f(api);
}
function look() {
  looking = 0;
  eachLooker(api => { if (aim) api.lookToward(aim[0], aim[1]); else api.lookAway(); });
}
const lookTo = p => { aim = p; looking ||= requestAnimationFrame(look); };
addEventListener('pointermove', e => lookTo([e.clientX, e.clientY]), { passive: true });
document.documentElement.addEventListener('pointerleave', () => lookTo(null));

/* 엔진은 미리 부르지 않는다 — 계정 화면에 들어온 사람만 받는다.
   목록도 buddy.js 가 건네는 것만 쓴다: engine.js 를 여기서 또 부르면 판이 둘이 된다 */
const buddyKit = import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href);
buddyKit.then(({ mountBuddy, TABLES }) => {
  lists.shape = TABLES.shapes.map(x => x.id);
  lists.expression = TABLES.expressions.map(x => x.id);
  lists.colour = TABLES.colours.map(x => x.id);
  for (const c of TABLES.colours) hexes.set(c.id, c.hex);
  for (const key of ['shape', 'expression', 'colour']) {
    if (lists[key].includes(saved[key])) character[key] = saved[key];
  }

  me = mountBuddy($('#character'), { calm: still, shape: character.shape, expression: character.expression });
  me.start();
  real = mountBuddy($('#characterReal'), { calm: still, shape: character.shape, expression: character.expression });
  real.start();

  for (const key of ['shape', 'expression', 'colour']) {
    for (const id of lists[key]) {
      const label = KO(id) || id;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset[key] = id;
      button.className = 'character-choice';
      button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', 'false');
      button.title = label;
      if (key === 'colour') button.style.background = hexes.get(id);
      else {
        /* 견본은 제 시계를 안 돌린다 — 스물넷이 저마다 숨 쉴 이유가 없다.
           그래도 시선은 따라본다(위 look() 이 한 바퀴에 한 장씩 그려 준다) */
        const api = mountBuddy(button, {
          still: true, calm: still,
          shape: key === 'shape' ? id : character.shape,
          expression: key === 'expression' ? id : character.expression,
        });
        api.setColour(character.colour);
        api.start();
        thumbs[key].set(id, api);
      }
      button.onclick = () => { character[key] = id; paint(); keep(); };
      $('#' + key + 'Choices').append(button);
    }
  }
  paint();
  /* 엔진을 기다리는 사이에 서버 프로필이 먼저 왔으면 이제 입힌다 */
  if (waiting !== null) wear(waiting);
}).catch(err => {
  /* 조용히 삼키면 왜 안 되는지 알 길이 없다 — 화면엔 한 줄, 콘솔엔 진짜 까닭 */
  console.error('[account] 캐릭터 엔진', err);
  $('#character').textContent = t('acctCharFail');
});

/* 홈 봇 크기(70~130%). 이 기기에만 둔다 — '실제 크기' 봇이 --bot-scale 로 곧장 커지고 줄며,
   홈 봇은 계정을 닫을 때 ranked.js 의 leftAccount 가 같은 값으로 다시 세운다 */
{
  const size = $('#botSize');
  const v = +read('rt.botsize');
  size.value = v >= .7 && v <= 1.3 ? Math.round(v * 100) : 100;
  const show = () => {
    /* 화면엔 숫자를 안 두고(실제 크기 봇이 보여 준다) 읽기 도구에만 % 를 준다 */
    size.setAttribute('aria-valuetext', size.value + '%');
    document.documentElement.style.setProperty('--bot-scale', size.value / 100);
  };
  show();
  size.addEventListener('input', show);
  /* 밀대 꼭지는 '실제 크기' 글자 아래에 선다. 봇이 커지고 줄면 칸 폭이 바뀌어 글자가
     옮겨 가므로, 봇·밀대의 크기가 바뀔 때마다(전이 중에도) 다시 잰다 */
  const pill = size.parentElement, cap = $('#characterReal').nextElementSibling;
  const aim = new ResizeObserver(() => {
    const a = cap.getBoundingClientRect(), b = pill.getBoundingClientRect();
    pill.style.setProperty('--tail-x', (a.left + a.width / 2 - b.left - parseFloat(getComputedStyle(pill).borderLeftWidth)) + 'px');
  });
  aim.observe($('#characterReal'));
  aim.observe(pill);
  size.addEventListener('change', () => write('rt.botsize', String(size.value / 100)));
}

const loggedIn = () => !!read('rt.token');
/* 이 브라우저에 남긴 거울을 통째로 지운다. 로그아웃도, 토큰이 죽은 것을 알아챈
   자리도 같은 손을 쓴다 — 한쪽만 지우면 다음 사람이 이 기기로 가입할 때 남은
   값이 그 사람의 공개 프로필로 올라간다(welcome/welcome.js 의 save 참고). */
const KEYS = ['rt.token', 'rt.name', 'rt.bio', 'rt.character', 'rt.botname', 'rt.botsize', 'rt.intro', 'rt.rescue', 'rt.greet'];
const forget = () => { for (const k of KEYS) localStorage.removeItem(k); sessionStorage.removeItem('rt.bind'); };

/* ── 서버에 남는 프로필 ────────────────────────────────────
   로그인해 있으면 원본은 서버다. localStorage 는 그 거울일 뿐이다 — 경기 화면은
   토큰을 들여다보지 않고 rt.name 만 읽고(app.js·ranked.js), 중계기가 잠깐 안 되어도
   화면이 비면 안 된다. 그래서 늘 브라우저에 먼저 적고 그다음에 올린다. */
const API = self.RT_RELAY;   // relay.js
/* 프로필은 늘 통째로 올린다 — 한 칸만 보내면 서버가 나머지를 빈 값으로 덮는다.
   handle 은 한 번 정하면 서버가 빈 값으로 덮지 않으므로, 아직 안 정한 사람이
   다른 칸을 고쳐도 아이디가 사라지지 않는다. */
const switches = { push: false, shut: false };
const mine = () => ({
  name: read('rt.name'),
  bio: read('rt.bio'),
  face: [character.shape, character.expression, character.colour].join(','),
  lang: parse('rt.opt', {}).lang || 'auto',
  handle: (v => /^[a-z0-9_]{3,16}$/.test(v) ? v : '')(
    $('#accountId').value.trim().replace(/^@/, '').toLowerCase()),
  botname: read('rt.botname'),
  push: switches.push,
  shut: switches.shut,
});
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
    .catch(r => say(r && r.status === 409
      ? t('acctIdTaken')
      : t('acctSaveFail')));
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
  wear(p.face);
  if (p.lang && p.lang !== (parse('rt.opt', {}).lang || 'auto')) saveOption('lang', p.lang, true);
}
/* 고르는 즉시 저장한다 — 누를 단추가 따로 없다. 브라우저엔 바로 적고, 계정으로
   올리는 것만 잠깐 모은다: 표정을 훑어보며 열 번 누르면 열 번 다 올라가 중계기의
   분당 창(RL_AU)을 혼자 다 써버린다. 마지막으로 고른 것 하나만 올라간다. */
let keeping = 0;
function keep() {
  if (!write('rt.character', JSON.stringify(character))) return;
  say(t('acctCharSaved'));
  clearTimeout(keeping);
  keeping = setTimeout(() => push(t('acctCharSaved')), 700);
}

function session() {
  const inn = loggedIn();
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
  }
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
  fetch(asset('data/i18n.json')).then(r => r.json()).then(data => {
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
    /* 200 이어도 본문이 성공이 아니면 지운 것이 아니다. 실패로 보이면 세션을 둔다 */
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || data.ok !== true) throw r;
    /* 서버에서 지워진 뒤에야 이 브라우저를 비운다 — 먼저 비우면 실패했을 때
       토큰을 잃어 제 계정을 지울 길조차 없어진다.
       location.replace('./') 는 #account 에서 해시만 바뀌고 문서는 그대로라
       지운 뒤에도 로그인 상태가 남는다. 키를 전부 지우고 화면을 내린다. */
    try { forget(); }
    catch {
      btn.disabled = false;
      say(t('acctErasedTrace'));
      return;
    }
    session();
    if (typeof paintUI === 'function') paintUI();
    say(t('acctErased'));
  } catch {
    btn.disabled = false;
    say(t('acctEraseFail'));
  }
};

$('#accountLogout').onclick = () => {
  try { forget(); }
  catch { say(t('acctLogoutFail')); return; }
  $('#accountName').value = '';
  $('#accountBio').value = '';
  session();
  location.replace('./');
};
session();
function syncOptions() {
  Object.assign(opt, { night: false, lang: 'auto', motion: true }, parse('rt.opt', {}));
  document.documentElement.toggleAttribute('data-night', !!opt.night);
  document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';
  $('#accountLanguage').value = opt.lang || 'auto';
}
addEventListener('rt-account', () => { session(); syncOptions(); });
addEventListener('storage', e => {
  /* 다른 탭이 토큰을 지우면(계정 삭제·로그아웃) 이 탭도 로그인 화면을 내린다.
     같은 탭의 removeItem 은 storage 가 안 오므로, 지운 자리는 session() 을 직접 부른다 */
  if (e.key === null || e.key === 'rt.token') {
    session();
    if (typeof paintUI === 'function') paintUI();
  } else if (e.key === 'rt.name' || e.key === 'rt.bio') session();
  if (e.key === null || e.key === 'rt.opt') {
    syncOptions();
  }
});
const checkedToken = read('rt.token');
if (checkedToken) fetch(API + '/auth/me', {headers: {authorization: 'Bearer ' + checkedToken}})
  .then(r => {
    if (checkedToken !== read('rt.token')) return;
    if (r.status === 401) {
      forget(); session();
      if (typeof paintUI === 'function') paintUI();
    } else if (!r.ok) $('#accountSession').textContent = t('acctCheckFail');
    /* 서버에 남은 프로필이 원본이다 — 이 브라우저에 있던 값은 여기서 덮는다 */
    else return r.json().then(data => apply(data.profile));
  })
  .catch(() => { if (checkedToken === read('rt.token')) $('#accountSession').textContent = t('acctCheckNet'); });
})();
