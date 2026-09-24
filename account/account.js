/* 독립 계정 화면. 프로필 서비스가 없는 항목은 지원 여부를 명시한다. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const read = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const parse = (key, fallback) => { try { return JSON.parse(read(key)) || fallback; } catch { return fallback; } };
const say = text => { $('#accountSay').textContent = text; };
const write = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { say('브라우저에 저장하지 못했습니다. 저장 공간 설정을 확인해 주세요.'); return false; } };
const opt = parse('rt.opt', {});
/* ── 캐릭터 ────────────────────────────────────────────────
   그림과 움직임은 로그인 화면·경쟁전 봇과 같은 엔진(assets/bloub)이 낸다. 예전엔
   여기만 CSS 로 흉내 낸 동그라미였는데, 눈만 까딱해 같은 놈으로 보이지 않았다.
   이제 셋이 한 몸이라 여기서 고른 모습이 경쟁전 봇에 그대로 나간다.

   모양·표정·색의 id 는 엔진이 쥐고 있고(프랑스어다), 화면에 걸 이름만 여기서 짓는다. */
const KO = {
  cercle: '동그라미', galet: '조약돌', squircle: '둥근네모', capsule: '캡슐',
  triangle: '세모', hexagone: '육각', nuage: '구름', goutte: '물방울',
  neutre: '무표정', attentif: '집중', surpris: '놀람', excite: '신남',
  heureux: '기쁨', hilare: '함박웃음', colere: '골남', triste: '시무룩',
  effraye: '겁먹음', mefiant: '갸웃', confus: '어리둥절', curieux: '호기심',
  fier: '뿌듯', timide: '수줍음', blase: '심드렁', somnolent: '졸림',
  encre: '먹색', brun: '밤색', rouge: '빨강', orange: '주황', ambre: '호박',
  vert: '초록', turquoise: '청록', bleu: '파랑', violet: '보라', rose: '분홍',
  gris: '잿빛', creme: '크림',
};
const FALLBACK = { shape: 'cercle', expression: 'curieux', colour: 'turquoise' };
const saved = parse('rt.character', {});
const character = { ...FALLBACK };
const lists = { shape: [], expression: [], colour: [] };
const hexes = new Map();
/* 장식 움직임이라 움직임 줄이기(OS·앱 설정)가 켜져 있으면 한 장만 그리고 멈춘다 */
const still = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

let me = null;            // 큰 미리보기
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
    $('#' + key + 'Label').textContent = KO[character[key]] || '';
    document.querySelectorAll('[data-' + key + ']')
      .forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === character[key])));
  }
  $('#character').setAttribute('aria-label',
    `${KO[character.colour]} ${KO[character.shape]} · ${KO[character.expression]}`);
  if (!me) return;
  me.setShape(character.shape);
  me.setExpression(character.expression);
  me.setColour(character.colour);
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
const buddyKit = import(new URL(asset('../assets/bloub/buddy.js'), document.baseURI).href);
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

  for (const key of ['shape', 'expression', 'colour']) {
    for (const id of lists[key]) {
      const label = KO[id] || id;
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
  $('#character').textContent = '캐릭터를 불러오지 못했습니다.';
});

const loggedIn = () => !!read('rt.token');
/* 이 브라우저에 남긴 거울을 통째로 지운다. 로그아웃도, 토큰이 죽은 것을 알아챈
   자리도 같은 손을 쓴다 — 한쪽만 지우면 다음 사람이 이 기기로 가입할 때 남은
   값이 그 사람의 공개 프로필로 올라간다(welcome/welcome.js 의 save 참고). */
const KEYS = ['rt.token', 'rt.name', 'rt.bio', 'rt.character', 'rt.botname', 'rt.intro'];
const forget = () => { for (const k of KEYS) localStorage.removeItem(k); sessionStorage.removeItem('rt.bind'); };

/* ── 서버에 남는 프로필 ────────────────────────────────────
   로그인해 있으면 원본은 서버다. localStorage 는 그 거울일 뿐이다 — 경기 화면은
   토큰을 들여다보지 않고 rt.name 만 읽고(app.js·ranked.js), 중계기가 잠깐 안 되어도
   화면이 비면 안 된다. 그래서 늘 브라우저에 먼저 적고 그다음에 올린다. */
const API = 'https://g.gearservicevanguard.com';
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
  if (!p.name) return '닉네임을 비워 둘 수 없습니다.';
  /* 아이디는 아직 안 정한 사람이 있다 — 그 경우 서버가 덮지 않으므로 빈 값이
     올라가도 지워지지 않는다. 칸에 적다 만 것만 막는다 */
  if ($('#accountId').value.trim() && !p.handle) return '아이디는 영문 소문자·숫자·밑줄 3~16자입니다.';
  return '';
}
function push(done) {
  if (!loggedIn()) { say(done + ' 로그인하면 다른 기기에서도 따라옵니다.'); return; }
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
      ? '이미 쓰이고 있는 아이디입니다. 다른 아이디를 지어 주세요.'
      : '계정에 저장하지 못했습니다. 이 브라우저에는 남아 있습니다 — 잠시 후 다시 시도해 주세요.'));
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
  say('캐릭터를 저장했습니다.');
  clearTimeout(keeping);
  keeping = setTimeout(() => push('캐릭터를 저장했습니다.'), 700);
}

/* ── 카메라로 따라 하기 ────────────────────────────────────
   켜 두는 동안만 표정과 고개가 카메라를 따르고, 끄면 고른 표정으로 돌아온다.
   저장하는 값(character)은 건드리지 않는다 — 따라 하는 얼굴은 지나가는 것이고,
   계정에 남는 것은 사람이 골라 저장한 모습이다. 영상은 기기 밖으로 안 나간다. */
const camSay = text => { $('#camSay').textContent = text; };
let cam = null, camBusy = false;

function camOff() {
  camSay('');
  cam?.stop();
  cam = null;
  /* 갸웃도 부풀림도 카메라를 켠 동안만의 것이다 — 끄면 고른 모습으로 돌아간다 */
  $('#character').style.transform = '';
  $('#characterCam').setAttribute('aria-pressed', 'false');
  $('#characterCam').textContent = '카메라로 따라 하기';
  if (me) { me.setExpression(character.expression); me.lookAway(); }
  lookTo(aim);
}
$('#characterCam').onclick = async () => {
  if (cam) { camOff(); return; }
  if (camBusy) return;
  if (!navigator.mediaDevices?.getUserMedia) { camSay('이 브라우저에서는 카메라를 쓸 수 없습니다.'); return; }
  camBusy = true;
  $('#characterCam').textContent = '카메라 준비 중…';
  camSay('카메라 권한을 묻고 판정기를 내려받습니다. 영상은 이 기기 안에서만 씁니다.');
  try {
    const { startMimic } = await import(new URL(asset('../assets/face/mimic.js'), document.baseURI).href);
    await buddyKit;
    cam = await startMimic({
      base: new URL('../assets/face/', document.baseURI).href,
      onFace: ({ expression, look, roll, puff }) => {
        if (!me || !cam) return;
        me.setExpression(expression);
        me.lookAt(look[0], look[1]);
        /* 고개 갸웃과 볼 부풀리기는 몸 전체에 건다 — 엔진이 그리는 실루엣은
           그대로 두고 바깥에서 돌리고 키운다 */
        $('#character').style.transform = `rotate(${roll.toFixed(1)}deg) scale(${(1 + puff * .12).toFixed(3)})`;
      },
    });
    $('#characterCam').setAttribute('aria-pressed', 'true');
    $('#characterCam').textContent = '카메라 끄기';
    camSay('카메라를 따라 합니다. 여기서 보는 얼굴은 저장되지 않습니다 — 저장되는 건 아래에서 고른 모습입니다.');
  } catch (err) {
    camOff();
    /* getUserMedia 가 거절할 때만 DOMException 이다(권한·기기 없음·다른 앱이 쥠).
       판정기를 못 받은 것은 보통 TypeError 라, 이름을 하나씩 세지 않고 갈래로 나눈다 */
    camSay(err instanceof DOMException
      ? '카메라를 쓰지 못했습니다. 브라우저의 카메라 권한과 연결된 카메라를 확인해 주세요.'
      : '카메라 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
  } finally {
    camBusy = false;
    if (!cam) $('#characterCam').textContent = '카메라로 따라 하기';
  }
};
/* 화면을 떠나면 카메라도 끈다 — 탭을 두고 나갔는데 불이 켜져 있으면 안 된다 */
addEventListener('pagehide', () => cam && camOff());
function session() {
  const inn = loggedIn();
  $('#accountLogout').disabled = !inn;
  $('#accountErase').disabled = !inn;
  $('#accountSignin').hidden = inn;
  $('#accountName').disabled = !inn;
  $('#accountName').value = inn ? read('rt.name') : '';
  $('#accountBio').disabled = !inn;
  $('#accountBio').value = inn ? read('rt.bio') : '';
  $('#accountBio').placeholder = inn ? '한 줄로 나를 소개해 주세요 (최대 60자)' : '로그인하면 소개를 적을 수 있습니다.';
  countBio();
  $('#accountId').disabled = !inn;
  if (!inn) $('#accountId').value = '';
  paintSwitches();
  $('#accountSession').textContent = inn ? '' : '로그인하면 닉네임과 보안 설정을 관리할 수 있습니다.';
}
$('#accountName').value = read('rt.name');
$('#accountName').addEventListener('change', e => {
  if (!loggedIn()) { session(); return; }
  const value = e.target.value.replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, 12);
  if (!value) { e.target.value = read('rt.name'); say('닉네임을 비워 둘 수 없습니다.'); return; }
  e.target.value = value;
  if (write('rt.name', value)) push('닉네임을 저장했습니다. 이미 올라간 기록의 이름도 바뀝니다.');
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
  if (write('rt.bio', value)) push(value ? '소개를 저장했습니다.' : '소개를 비웠습니다.');
});
/* 아이디는 한 번 정하면 여기서 비울 수 없다 — 빈 칸으로 두고 나가도 서버가
   덮지 않으므로, 화면도 서버가 쥔 값으로 되돌려 둔다. 모양이 틀리면 올리지
   않고 그 자리에서 말한다. */
$('#accountId').addEventListener('change', e => {
  if (!loggedIn()) { session(); return; }
  const value = e.target.value.trim().replace(/^@/, '').toLowerCase();
  e.target.value = value;
  if (!value) { say('아이디를 지우려면 문의해 주세요. 지금 아이디는 그대로 둡니다.'); return; }
  if (!/^[a-z0-9_]{3,16}$/.test(value)) {
    say('아이디는 영문 소문자·숫자·밑줄 3~16자입니다.');
    return;
  }
  push('아이디를 저장했습니다.');
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
    if (!('Notification' in window)) { say('이 브라우저는 알림을 지원하지 않습니다.'); return; }
    let ok = 'denied';
    try { ok = await Notification.requestPermission(); } catch {}
    if (ok !== 'granted') { say('브라우저가 알림을 허용하지 않았습니다.'); return; }
  }
  switches.push = !switches.push;
  paintSwitches();
  push(switches.push ? '새소식 알림을 켰습니다.' : '새소식 알림을 껐습니다.');
};
$('#accountShut').onclick = () => {
  switches.shut = !switches.shut;
  paintSwitches();
  push(switches.shut ? '계정을 비공개로 두었습니다.' : '계정을 공개로 두었습니다.');
};

/* quiet 는 서버가 준 값을 되받아 적는 길이다 — 방금 내려받은 것을 도로 올리지 않는다 */
function saveOption(key, value, quiet) {
  const latest = parse('rt.opt', {});
  latest[key] = value;
  if (!write('rt.opt', JSON.stringify(latest))) return;
  opt[key] = value;
  $('#accountLanguage').value = opt.lang || 'auto';
  if (!quiet) push('설정을 저장했습니다.');
}
$('#accountLanguage').value = ['ko', 'auto'].includes(opt.lang) ? opt.lang : 'auto';
$('#accountLanguage').onchange = e => saveOption('lang', e.target.value);
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  fetch(asset('../data/i18n.json')).then(r => r.json()).then(data => {
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
  if (!loggedIn()) { say('로그인한 계정만 지울 수 있습니다.'); return; }
  const ok = confirm(
    '계정을 지우면 순위표 기록과 경쟁전 점수, 닉네임과 소개, 캐릭터, 패스키와 복구 코드가 모두 사라집니다.\n\n' +
    '되돌릴 수 없습니다. 지울까요?');
  if (!ok) return;
  const btn = $('#accountErase');
  btn.disabled = true;
  say('계정을 지우는 중입니다…');
  try {
    const r = await fetch(API + '/auth/erase', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + read('rt.token') },
      body: JSON.stringify({ sure: true }),
    });
    if (!r.ok) throw r;
    /* 서버에서 지워진 뒤에야 이 브라우저를 비운다 — 먼저 비우면 실패했을 때
       토큰을 잃어 제 계정을 지울 길조차 없어진다 */
    for (const k of ['rt.token', 'rt.name', 'rt.bio', 'rt.character']) {
      try { localStorage.removeItem(k); } catch {}
    }
    try { sessionStorage.removeItem('rt.bind'); } catch {}
    location.replace('../');
  } catch {
    btn.disabled = false;
    say('계정을 지우지 못했습니다. 잠시 후 다시 시도해 주세요 — 계정은 그대로 있습니다.');
  }
};

$('#accountLogout').onclick = () => {
  try { forget(); }
  catch { say('로그아웃하지 못했습니다. 브라우저 설정을 확인해 주세요.'); return; }
  $('#accountName').value = '';
  $('#accountBio').value = '';
  session();
  location.replace('../');
};
session();
function syncOptions() {
  Object.assign(opt, { night: false, lang: 'auto', motion: true }, parse('rt.opt', {}));
  document.documentElement.toggleAttribute('data-night', !!opt.night);
  document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';
  $('#accountLanguage').value = opt.lang || 'auto';
}
addEventListener('pageshow', () => { session(); syncOptions(); });
addEventListener('storage', e => {
  if (e.key === null || e.key === 'rt.token' || e.key === 'rt.name' || e.key === 'rt.bio') session();
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
    } else if (!r.ok) $('#accountSession').textContent = '계정 상태를 확인할 수 없습니다. 잠시 후 다시 접속해 주세요.';
    /* 서버에 남은 프로필이 원본이다 — 이 브라우저에 있던 값은 여기서 덮는다 */
    else return r.json().then(data => apply(data.profile));
  })
  .catch(() => { if (checkedToken === read('rt.token')) $('#accountSession').textContent = '계정 상태를 확인할 수 없습니다. 인터넷 연결을 확인해 주세요.'; });
})();
