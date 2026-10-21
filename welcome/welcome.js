/* 가입 안내. 처음 로그인한 사람에게만 한 번 뜬다(auth.js 의 done() 이 여기로
   보낸다). 한 장에 한 가지만 묻는다 — 설문 두 장, 캐릭터와 프로필 다섯 장.

   서버에 남는 것은 두 줄뿐이다: intro 한 줄(무엇을 보고 왔는지·추천 의향)과
   profile 한 줄(닉네임·아이디·캐릭터·스위치 둘). 자유 입력 칸은 닉네임·아이디·
   캐릭터 이름 셋이고, 셋 다 worker.mjs 의 profile() 이 같은 규칙으로 다듬는다.
   끝의 보안 두 장은 이 두 줄과 별개로 /auth/phone·/auth/mail 에 곧장 건다 —
   서버엔 번호·보조 메일의 해시만 남고, 복구 코드는 처음 한 번만 내려온다.

   '건너뛰기' 는 진짜로 건너뛴다 — 안 고른 값은 안 보낸다. 다만 아이디는 한 번
   정하면 여기서 비울 수 없다(서버가 빈 값으로 덮지 않는다).                */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const API = self.RT_RELAY;   // relay.js

const DONE_KEY = 'rt.intro';
const ACCT_KEYS = ['rt.token', 'rt.name', 'rt.bio', 'rt.character', 'rt.botname', 'rt.botsize', DONE_KEY, 'rt.rescue', 'rt.greet'];
const read = (k, d = '') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const parse = (k, d) => { try { return JSON.parse(read(k)) || d; } catch { return d; } };
const token = () => read('rt.token');
function forget() {
  for (const k of ACCT_KEYS) { try { localStorage.removeItem(k); } catch {} }
  try { sessionStorage.removeItem('rt.bind'); } catch {}
}
const still = () => document.documentElement.dataset.motion === 'off'
  || matchMedia('(prefers-reduced-motion: reduce)').matches;

const say = (text, bad) => {
  $('#introSay').textContent = text || '';
  $('#introSay').classList.toggle('bad', !!bad);
};

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token() },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { forget(); location.replace('../'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.msg || String(r.status)); e.status = r.status; e.data = d; throw e; }
  return d;
}

/* ── 모아 두는 답 ──────────────────────────────────────── */
const FACE = { shape: 'cercle', expression: 'curieux', colour: 'turquoise' };
const answer = {
  platform: '', medium: '', nps: null,
  face: { ...FACE }, botname: '', name: '', handle: '',
  /* null 은 '아직 안 골랐다' 다 — false(아니요)와 다르다. 이 둘을 뭉개면
     고르지 않고 지나간 사람을 붙잡을 수 없다 */
  push: null, shut: null,
};

/* 캐릭터 말 이름. account.js 와 같은 표다 — 늘리는 자리가 둘이라 값이 갈리면
   같은 캐릭터가 두 이름으로 보인다. 엔진이 쥔 id 는 프랑스어다. */
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

/* ── 물을 것 ───────────────────────────────────────────────
   한 장이 한 항목이다. kind 가 어떤 몸을 그릴지 정하고, key 는 answer 의 칸이다.
   여기 순서를 바꾸면 화면 순서가 바뀐다 — 다른 곳에 번호를 적어 두지 않았다.

   skip:true 인 장만 건너뛸 수 있다. 설문 셋이 그렇다 — 안 알려 주셔도 그만이다.
   프로필(캐릭터·이름·아이디·스위치 둘)은 계정에 남아 남 앞에 걸리는 값이라
   비워 둔 채 지나가지 못한다. 캐릭터는 늘 고른 모습이 있어 따로 막을 것이 없다. */
const STEPS = [
  { kind: 'hello' },
  { kind: 'pick', skip: true, key: 'platform', kicker: '설문 1/3',
    ask: 'regiontype 을 어디에서 보셨나요?',
    note: '',
    list: [
      ['search', '검색 (구글·네이버 등)'], ['youtube', '유튜브'],
      ['instagram', '인스타그램'], ['x', 'X (트위터)'],
      ['tiktok', '틱톡'], ['community', '커뮤니티·카페'],
      ['friend', '친구·지인'], ['etc', '그 밖에'],
    ] },
  { kind: 'pick', skip: true, key: 'medium', kicker: '설문 2/3',
    ask: '어떤 모습으로 만나셨나요?',
    note: '',
    list: [
      ['video', '영상'], ['post', '글·게시물'], ['comment', '댓글'],
      ['result', '검색 결과'], ['ad', '광고'], ['etc', '그 밖에'],
    ] },
  /* 0 과 10 이 무슨 뜻인지는 자 양끝의 말이 한다(drawScale 의 .intro-ends) —
     설명을 한 줄 더 얹으면 같은 말을 두 번 하는 것이다 */
  { kind: 'scale', skip: true, key: 'nps', kicker: '설문 3/3',
    ask: '이곳을 친구에게 권하시겠어요?', note: '' },
  { kind: 'face', kicker: '프로필 1/6',
    ask: '함께 다닐 캐릭터를 고르세요.',
    note: '여기서 고른 모습이 경쟁전에서도 그대로 나옵니다. 나중에 언제든 바꿉니다.' },
  { kind: 'text', key: 'botname', kicker: '프로필 2/6',
    ask: '캐릭터 이름을 지어 주세요.',
    note: '최대 12자.', max: 12, hint: '예: 방울이' },
  { kind: 'text', key: 'name', kicker: '프로필 3/6',
    ask: '어떻게 불러 드릴까요?',
    note: '순위표와 경쟁전에 걸리는 이름입니다. 최대 12자.', max: 12, hint: '닉네임' },
  { kind: 'text', key: 'handle', kicker: '프로필 4/6',
    ask: '아이디를 정해 주세요.',
    note: '영문 소문자·숫자·밑줄 3~16자. 다른 사람과 겹칠 수 없습니다.',
    max: 16, hint: 'gayang', prefix: '@' },
  { kind: 'yesno', key: 'push', kicker: '프로필 5/6',
    ask: '새소식을 알림으로 받으시겠어요?',
    note: '새 코스와 바뀐 것을 이 기기의 알림으로 알려 드립니다. 예를 고르면 브라우저가 한 번 더 묻습니다.' },
  { kind: 'yesno', key: 'shut', kicker: '프로필 6/6',
    ask: '계정을 비공개로 둘까요?',
      note: '비공개로 두면 순위표에 이름 대신 빈칸이 걸립니다. 기록은 그대로 쌓입니다.' },
  /* 보안 두 장은 서버 응답이 답이다(sec). 전화는 인증이 끝나야 다음으로 간다.
     문자를 못 보내도 넘어가지 않는다. 보조 메일은 건너뛸 수 있다. */
  { kind: 'phone', kicker: '보안 1/2',
    ask: '기본 인증 수단인 전화번호를 입력한 뒤 인증해 주세요.',
    note: '' },
  { kind: 'mail', skip: true, kicker: '보안 2/2',
    ask: '보조 메일을 추가할까요?',
    note: '' },
  { kind: 'done' },
];

/* 보안 두 장의 상태. 번호·메일 값은 서버가 쥐고, 여기엔 '어디까지 왔나' 만 둔다.
   off 는 보조 메일이 503(발송 미설정)인 것. 전화는 이 칸으로 넘어가지 않는다.
   codes 는 복구 코드를 처음 받은 순간부터 체크할 때까지만 메모리에 있다 */
const sec = {
  phone: { done: false, already: false, off: false, sent: false, busy: false, value: '', codes: null, acked: false },
  mail: { want: null, done: false, already: false, off: false, sent: false, busy: false, value: '' },
};
const CHAN = {
  phone: {
    path: '/auth/phone', field: 'phone', send: '인증 문자 보내기',
    empty: '전화번호를 적어 주세요.', bad: '번호를 다시 확인해 주세요.',
    sent: '문자를 보냈습니다. 5분 안에 받은 코드를 입력해 주세요.',
    off: '문자를 보내지 못했습니다. 인증이 끝나야 다음으로 갈 수 있습니다.',
    ok: '✓ 인증됐습니다', already: '✓ 이미 인증된 번호가 있습니다.',
  },
  mail: {
    path: '/auth/mail', field: 'email', send: '확인 코드 보내기',
    empty: '메일 주소를 적어 주세요.', bad: '메일 주소를 다시 확인해 주세요.',
    sent: '메일을 보냈습니다. 5분 안에 받은 코드를 입력해 주세요.',
    off: '메일 발송이 아직 준비되지 않았습니다. 설정 › 보안에서 나중에 추가할 수 있습니다.',
    ok: '✓ 확인됐습니다', already: '✓ 이미 확인된 보조 메일이 있습니다.',
  },
};
const isSec = k => k === 'phone' || k === 'mail';

$('#introTotal').textContent = STEPS.length;

let at = 0;
let engine = null;              // buddy.js. 캐릭터 장에서만 부른다
let big = null;                 // 큰 미리보기
const thumbs = { shape: new Map(), expression: new Map() };
const lists = { shape: [], expression: [], colour: [] };
const hexes = new Map();
let claimed = '';               // 서버가 받아 준 아이디. 다시 물으러 가지 않게 기억한다

/* ── 그리기 ────────────────────────────────────────────── */
const body = () => $('#introBody');

/* 고르면 다음 장으로 넘어간다. 칠하는 것은 즉시(누른 그 프레임에) 하고, 넘어가는
   것만 한 박자 뒤다 — 그 사이에 주황이 번지고 번호 칸이 한 번 튄다. 이 박자가
   짧으면 무엇을 골랐는지 보기도 전에 화면이 바뀐다.

   길이는 여기 적지 않고 CSS 의 --intro-beat 에서 읽는다. 물드는 시간과 튀는
   시간이 거기 있으니, 그 옆에 둬야 한 쪽만 고쳐 어긋나지 않는다. 움직임을 끄면
   그 값이 0 이 되고 기다림도 같이 사라진다 — 볼 것이 없으니 기다릴 이유도 없다.
   ms 로 적는다(parseFloat 가 '440ms' 를 440 으로 읽는다 — '.44s' 로 적으면 .44 다). */
const beat = () => parseFloat(getComputedStyle(document.body).getPropertyValue('--intro-beat')) || 0;

/* 고른 표시만 다시 칠한다. 장을 통째로 다시 그리지 않는 이유가 둘이다:
   하나, 다시 그리면 등장 애니메이션이 또 돌아 화면이 한 번 끊긴 것처럼 보인다.
   둘, 새로 만든 단추는 처음부터 고른 모습이라 물드는 것도 튀는 것도 안 보인다 —
   transition 은 값이 바뀌어야 돌지, 그 값으로 태어나면 돌지 않는다.
   있던 단추의 aria-pressed 만 뒤집으면 둘 다 제대로 돈다. */
function repaint(s) {
  const now = String(s.kind === 'scale' ? answer.nps : answer[s.key]);
  body().querySelectorAll('[data-val]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.val === now));
  });
}

let beating = 0;
function chose(key, value) {
  answer[key] = value;
  repaint(STEPS[at]);
  clearTimeout(beating);
  const wait = still() ? 0 : beat();
  /* 박자 도중에 다른 것을 골라도 된다 — 위에서 이미 지웠으니 새로 센다 */
  if (!wait) return next();
  beating = setTimeout(next, wait);
}

/* 카드는 왔던 방향으로 들고 난다 — 앞으로 가면 아래에서 올라오고 '이전' 이면
   위에서 내려온다. 같은 요소를 다시 쓰므로(제목·설명) 클래스를 떼고 레이아웃을
   한 번 읽어 애니메이션을 처음부터 다시 태운다. */
let way = 'fwd';
function draw() {
  const s = STEPS[at];
  $('#introStep').textContent = at + 1;
  /* 레일은 폭이 아니라 scaleX 다 — 매 장마다 레이아웃을 다시 재지 않는다 */
  $('#introBar').style.setProperty('--at', (at + 1) / STEPS.length);
  $('#introKicker').textContent = s.kicker || '';
  $('#introNote').textContent = s.note || '';
  $('#introBack').hidden = at === 0;
  $('#introSkip').hidden = !s.skip;
  $('#introNext').textContent = s.kind === 'done' ? '시작하기' : s.kind === 'hello' ? '시작' : '다음';
  say('');
  body().replaceChildren();
  ({ hello: drawHello, pick: drawPick, scale: drawScale, face: drawFace,
     text: drawText, yesno: drawYesno, phone: drawVerify, mail: drawVerify,
     done: drawDone })[s.kind](s);
  const card = $('#introCard');
  card.dataset.way = way;
  card.classList.remove('is-in');
  void card.offsetWidth;            // 여기서 한 번 읽어야 애니메이션이 되감긴다
  card.classList.add('is-in');
  /* 포커스는 첫 단추가 아니라 카드가 받는다. 단추에 얹으면 짚지도 않았는데
     테두리가 그려져 '이미 이것을 골랐다' 거나 '어서 누르라' 는 말처럼 보인다
     (로그인 덮개도 같은 까닭으로 첫 화면에서는 포커스를 안 옮긴다 — auth.js 의 live).
     카드는 tabindex="-1" 이라 탭 차례에는 안 들어가고 테두리도 안 그린다. 대신
     장이 바뀐 것을 읽어 주는 자리가 되고, 탭을 누르면 거기서부터 보기로 이어진다.

     글 칸만 예외다 — 거기서는 바로 치기 시작해야 하고, 글 칸의 테두리는 재촉이
     아니라 '여기에 친다' 는 표시다. 화면이 튀지 않게 스크롤은 건드리지 않는다. */
  const typing = (s.kind === 'text' || s.kind === 'phone')
    && [...body().querySelectorAll('input')].find(i => !i.closest('[hidden]'));
  (typing || card).focus({ preventScroll: true });
}

function drawHello() {
  $('#introAsk').textContent = '반갑습니다.';
  const p = document.createElement('p');
  p.className = 'intro-lede';
  p.textContent = '여기는 나라와 동네 이름을 받아쓰는 타자 연습입니다. '
    + '시작하기 전에 몇 가지만 여쭙고 프로필을 맞춰 두겠습니다 — 1분이면 끝납니다.';
  body().append(p);
}

/* 고르는 장. 숫자 키가 그대로 번호다(1‥9). 고르면 바로 다음 장으로 넘어간다 —
   'Enter 를 또 눌러야 하나' 를 사람이 고민하지 않게 한다. */
function drawPick(s) {
  $('#introAsk').textContent = s.ask;
  const box = document.createElement('div');
  box.className = 'intro-picks';
  s.list.forEach(([id, label], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'intro-pick';
    b.setAttribute('aria-pressed', String(answer[s.key] === id));
    b.dataset.val = id;
    const key = document.createElement('kbd');
    key.textContent = i < 9 ? String(i + 1) : '·';
    const text = document.createElement('span');
    text.textContent = label;
    /* 체크는 색 말고 또 하나의 표시다 — 색만으로 고른 것을 나누지 않는다 */
    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.textContent = '✓';
    tick.setAttribute('aria-hidden', 'true');
    b.append(key, text, tick);
    b.style.setProperty('--i', i);   // 차례로 서게 하는 번호
    b.onclick = () => chose(s.key, id);
    box.append(b);
  });
  body().append(box);
}

function drawScale(s) {
  $('#introAsk').textContent = s.ask;
  const box = document.createElement('div');
  box.className = 'intro-scale';
  for (let n = 0; n <= 10; n++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'intro-score';
    b.textContent = String(n);
    b.setAttribute('aria-label', n + '점');
    b.setAttribute('aria-pressed', String(answer.nps === n));
    b.dataset.val = String(n);
    b.style.setProperty('--i', n);
    b.onclick = () => chose('nps', n);
    box.append(b);
  }
  const ends = document.createElement('p');
  ends.className = 'intro-ends';
  const l = document.createElement('span'); l.textContent = '전혀 아니다';
  const r = document.createElement('span'); r.textContent = '꼭 권한다';
  ends.append(l, r);
  body().append(box, ends);
}

function drawYesno(s) {
  $('#introAsk').textContent = s.ask;
  const box = document.createElement('div');
  box.className = 'intro-picks intro-yesno';
  [[true, '예'], [false, '아니요']].forEach(([v, label], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'intro-pick';
    b.setAttribute('aria-pressed', String(answer[s.key] === v));
    b.dataset.val = String(v);
    const key = document.createElement('kbd'); key.textContent = String(i + 1);
    const text = document.createElement('span'); text.textContent = label;
    const tick = document.createElement('span');
    tick.className = 'tick'; tick.textContent = '✓'; tick.setAttribute('aria-hidden', 'true');
    b.append(key, text, tick);
    b.style.setProperty('--i', i);
    b.onclick = () => pickYesno(s, v);
    box.append(b);
  });
  body().append(box);
}

/* 알림은 고른 그 자리에서 브라우저에게도 묻는다 — 나중에 한꺼번에 물으면
   무엇 때문에 묻는지 모르는 창이 뜬다. 거절해도 넘어간다(값만 끈다). */
async function pickYesno(s, v) {
  if (s.key === 'push' && v) {
    if (!('Notification' in window)) {
      answer.push = false;
      repaint(s);
      say('이 브라우저는 알림을 지원하지 않습니다. 이 항목은 꺼 둡니다.');
      return;
    }
    say('브라우저에 알림 권한을 묻고 있습니다…');
    let ok = 'denied';
    try { ok = await Notification.requestPermission(); } catch {}
    answer.push = ok === 'granted';
    if (!answer.push) {
      repaint(s);
      say('알림이 허용되지 않았습니다. 나중에 설정에서 다시 켤 수 있습니다.');
      return;
    }
  }
  chose(s.key, v);
}

function drawText(s) {
  $('#introAsk').textContent = s.ask;
  const wrap = document.createElement('label');
  wrap.className = 'intro-field';
  if (s.prefix) {
    const p = document.createElement('span');
    p.className = 'intro-prefix';
    p.textContent = s.prefix;
    wrap.append(p);
  }
  const input = document.createElement('input');
  input.id = 'introInput';
  input.maxLength = s.max;
  input.placeholder = s.hint || '';
  input.value = answer[s.key];
  input.autocomplete = s.key === 'name' ? 'nickname' : 'off';
  if (s.key === 'handle') { input.spellcheck = false; input.autocapitalize = 'none'; }
  input.setAttribute('aria-label', s.ask);
  wrap.append(input);
  body().append(wrap);
}

function drawFace() {
  $('#introAsk').textContent = STEPS[at].ask;
  const stage = document.createElement('div');
  stage.className = 'intro-stage';
  const me = document.createElement('div');
  me.id = 'introFace';
  me.className = 'character';
  me.setAttribute('role', 'img');
  stage.append(me);

  const controls = document.createElement('div');
  controls.className = 'character-controls intro-controls';
  for (const [key, label] of [['shape', '모양'], ['expression', '표정'], ['colour', '색']]) {
    const set = document.createElement('fieldset');
    const leg = document.createElement('legend');
    leg.className = 'profile-label';
    leg.textContent = label;
    const row = document.createElement('div');
    row.className = 'character-choices' + (key === 'colour' ? ' colour-choices' : '');
    row.id = 'intro' + key;
    set.append(leg, row);
    controls.append(set);
  }
  body().append(stage, controls);
  mountFace();
}

/* ── 보안 두 장 ────────────────────────────────────────────
   전화(phone)와 보조 메일(mail)은 같은 몸이다: 칸 → 보내기 → 코드 → 확인.
   칸의 id 는 한 장에 하나뿐이라 고정이다(vIn·vCode…). 코드는 영문 대소문자 8자리이고
   대소문자를 구분한다 — 공백만 지우고 대소문자는 건드리지 않는다. */
const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const here = kind => STEPS[at].kind === kind;

function drawVerify(s) {
  const kind = s.kind, m = sec[kind], c = CHAN[kind];
  $('#introAsk').textContent = s.ask;

  if (kind === 'mail' && !m.already) {
    const picks = h('div', 'intro-picks intro-yesno');
    [[true, '추가하기'], [false, '추가하지 않기']].forEach(([v, label], i) => {
      const b = h('button', 'intro-pick');
      b.type = 'button';
      b.dataset.want = String(v);
      const key = h('kbd', '', String(i + 1));
      const tick = h('span', 'tick', '✓');
      tick.setAttribute('aria-hidden', 'true');
      b.append(key, h('span', '', label), tick);
      b.style.setProperty('--i', i);
      b.onclick = () => pickMail(v);
      picks.append(b);
    });
    body().append(picks);
  }

  const box = h('div', 'intro-verify');
  box.id = 'vBox';
  const ok = h('p', 'intro-ok');
  ok.id = 'vOk';

  const sendRow = h('div', 'intro-vrow');
  sendRow.id = 'vSendRow';
  const f1 = h('label', 'intro-field');
  const input = document.createElement('input');
  input.id = 'vIn';
  input.value = m.value;
  input.setAttribute('aria-label', kind === 'phone' ? '전화번호' : '보조 메일 주소');
  if (kind === 'phone') {
    input.type = 'tel'; input.inputMode = 'tel'; input.autocomplete = 'tel';
    input.maxLength = 20; input.placeholder = '010-1234-5678';
  } else {
    input.type = 'email'; input.inputMode = 'email'; input.autocomplete = 'email';
    input.maxLength = 254; input.placeholder = 'name@example.com';
    input.spellcheck = false;
  }
  f1.append(input);
  const send = h('button', 'profile-button', c.send);
  send.type = 'button';
  send.id = 'vSend';
  send.onclick = () => sendCode(kind);
  sendRow.append(f1, send);

  const codeRow = h('div', 'intro-vcode');
  codeRow.id = 'vCodeRow';
  const help = h('p', 'intro-help', '영문 대소문자 8자리 · 대소문자를 구분합니다');
  help.id = 'vHelp';
  const f2 = h('label', 'intro-field intro-code');
  const code = document.createElement('input');
  code.id = 'vCode';
  code.maxLength = 16;
  code.autocomplete = 'one-time-code';
  code.setAttribute('autocapitalize', 'off');
  code.setAttribute('autocorrect', 'off');
  code.spellcheck = false;
  code.pattern = '[A-Za-z ]{8,16}';
  code.setAttribute('aria-label', '확인 코드 (영문 대소문자 8자리)');
  code.setAttribute('aria-describedby', 'vHelp');
  f2.append(code);
  const btns = h('div', 'intro-vrow');
  const go = h('button', 'profile-button', '확인');
  go.type = 'button';
  go.id = 'vConfirm';
  go.onclick = () => confirmCode(kind);
  const again = h('button', 'profile-button', '다시 보내기');
  again.type = 'button';
  again.id = 'vResend';
  again.onclick = () => sendCode(kind);
  btns.append(go, again);
  codeRow.append(help, f2, btns);

  box.append(ok, sendRow, codeRow);

  if (kind === 'phone') {
    const codes = h('div', 'intro-codes');
    codes.id = 'vCodes';
    codes.tabIndex = -1;
    const list = h('ol');
    list.id = 'vList';
    const ack = h('label', 'intro-check');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'vAck';
    cb.onchange = () => { m.acked = cb.checked; };
    ack.append(cb, h('span', '', '적어 두었습니다'));
    codes.append(
      h('p', 'intro-help', '이 복구 코드를 안전한 곳에 적어 두세요. 각 코드는 한 번만 쓸 수 있고, 다시 볼 수 없습니다.'),
      list, ack);
    box.append(codes);
  }
  body().append(box);
  if (kind === 'phone' || kind === 'mail') {
    const policy = h('a', 'profile-button intro-policy', '개인정보 처리방침');
    policy.href = '../policy/';
    policy.target = '_blank';        // 같은 탭으로 가면 이 장의 진행이 날아간다
    policy.rel = 'noopener';
    body().append(policy);
  }
  paintVerify(kind);
  if (m.off) say(c.off);
}

/* 상태를 칸에 칠한다. 장을 다시 그리지 않는다 — 입력 중인 글이 날아간다 */
function paintVerify(kind) {
  if (!here(kind)) return;
  const m = sec[kind], c = CHAN[kind];
  $('#vBox').hidden = kind === 'mail' && m.want !== true && !m.done;
  const ok = $('#vOk');
  ok.hidden = !m.done;
  ok.textContent = m.done ? (m.already ? c.already : c.ok) : '';
  const open = !m.done && (kind === 'phone' || !m.off);
  $('#vSendRow').hidden = !open;
  $('#vSend').hidden = m.sent;
  $('#vCodeRow').hidden = !(open && m.sent);
  for (const id of ['vSend', 'vConfirm', 'vResend']) $('#' + id).disabled = m.busy;
  body().querySelectorAll('[data-want]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.want === String(m.want)));
    b.disabled = m.busy;
  });
  if (kind === 'phone') {
    const box = $('#vCodes'), list = $('#vList');
    box.hidden = !m.codes;
    if (m.codes && !list.children.length) {
      list.replaceChildren(...m.codes.map(x => h('li', '', x)));
    }
    $('#vAck').checked = m.acked;
  }
}

/* 요청이 날아가는 동안은 이 장을 못 떠난다 — 코드가 도착했는데 장이 바뀌어 있으면
   복구 코드를 영영 못 본다 */
function setBusy(kind, on) {
  sec[kind].busy = on;
  $('#introNext').disabled = on;
  $('#introBack').disabled = on;
  $('#introSkip').disabled = on;
  paintVerify(kind);
}

function failSay(kind, how, e) {
  const c = CHAN[kind];
  if (e.status === 401) return;      // post() 가 이미 로그아웃으로 보냈다
  if (how === 'send' && e.status === 503) return say(c.off, kind === 'phone');
  if (e.status === 400) return say(how === 'send' ? c.bad : '코드가 맞지 않거나 만료되었습니다.', true);
  if (e.status === 429) return say('잠시 후 다시 시도해 주세요.', true);
  say('처리하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.', true);
}

async function sendCode(kind) {
  const m = sec[kind], c = CHAN[kind];
  if (m.busy || m.done || (kind !== 'phone' && m.off)) return;
  const v = ($('#vIn')?.value || '').trim();
  if (!v) { say(c.empty, true); $('#vIn')?.focus(); return; }
  m.value = v;
  const again = m.sent;
  setBusy(kind, true);
  say('보내고 있습니다…');
  let ok = false;
  try {
    await post(c.path, { [c.field]: v });
    m.sent = ok = true;
    if (here(kind)) say(again ? '다시 보냈습니다. 가장 나중에 받은 코드만 쓸 수 있습니다.' : c.sent);
  } catch (e) {
    if (e.status === 503 && kind !== 'phone') m.off = true;
    if (here(kind)) failSay(kind, 'send', e);
  } finally {
    setBusy(kind, false);
  }
  if (!here(kind)) return;
  (ok ? $('#vCode') : (kind !== 'phone' && m.off) ? $('#introCard') : $('#vIn'))?.focus({ preventScroll: true });
}

async function confirmCode(kind) {
  const m = sec[kind];
  if (m.busy || m.done) return;
  const v = ($('#vCode')?.value || '').replace(/\s+/g, '');
  if (!/^[A-Za-z]{8}$/.test(v)) {
    say('코드는 영문 대소문자 8자리입니다. 대소문자를 구분합니다.', true);
    $('#vCode')?.focus();
    return;
  }
  setBusy(kind, true);
  say('확인하고 있습니다…');
  let d = null;
  try {
    d = await post(CHAN[kind].path + '/confirm', { code: v });
    m.done = true;
    /* 복구 코드는 이 계정에 처음 하나 만들어질 때만 내려온다 */
    if (kind === 'phone' && Array.isArray(d.codes) && d.codes.length) {
      m.codes = d.codes.map(String);
      m.acked = false;
    }
    if (here(kind)) say('');
  } catch (e) {
    if (here(kind)) failSay(kind, 'confirm', e);
  } finally {
    setBusy(kind, false);
  }
  if (!here(kind)) return;
  ((m.done ? (m.codes ? $('#vCodes') : $('#introCard')) : $('#vCode')))?.focus({ preventScroll: m.done && !m.codes });
}

function pickMail(v) {
  const m = sec.mail;
  if (m.busy) return;
  clearTimeout(beating);
  if (!v && m.done) { say('이미 확인된 메일입니다. 설정 › 보안에서 바꿀 수 있습니다.'); return; }
  m.want = v;
  say(m.off ? CHAN.mail.off : '');
  paintVerify('mail');
  if (v) { if (!m.done && !m.off) $('#vIn')?.focus(); return; }
  const wait = still() ? 0 : beat();
  if (!wait) return next();
  beating = setTimeout(next, wait);
}

/* 복구 코드는 이 장을 떠나는 순간 화면에서도 메모리에서도 지운다 */
function wipeCodes() {
  sec.phone.codes = null;
  $('#vList')?.replaceChildren();
}

function drawDone() {
  $('#introAsk').textContent = '다 됐습니다.';
  const list = document.createElement('dl');
  list.className = 'intro-recap';
  const rows = [
    ['캐릭터', `${KO[answer.face.colour] || ''} ${KO[answer.face.shape] || ''} · ${KO[answer.face.expression] || ''}`
      + (answer.botname ? ` — ${answer.botname}` : '')],
    ['닉네임', answer.name],
    ['아이디', '@' + answer.handle],
    ['알림', answer.push === true ? '받음' : '안 받음'],
    ['계정', answer.shut === true ? '비공개' : '공개'],
    ['전화번호', sec.phone.done ? '인증됨' : '나중에 인증'],
    ['보조 메일', sec.mail.done ? '추가함' : '추가 안 함'],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    list.append(dt, dd);
  }
  body().append(list);
}

/* ── 캐릭터 엔진 ──────────────────────────────────────────
   계정 화면과 같은 몸(assets/bloub)이다. 견본은 제 시계를 안 돌린다 — 스물넷이
   저마다 숨 쉴 이유가 없다. 여기선 시선 따라보기까지는 하지 않는다: 이 장은
   잠깐 머무는 자리라, 도는 rAF 는 큰 놈 하나로 족하다. */
async function mountFace() {
  const kit = await import(new URL(asset('../assets/bloub/buddy.js'), document.baseURI).href)
    .catch(err => { console.error('[welcome] 캐릭터 엔진', err); return null; });
  if (!kit || STEPS[at].kind !== 'face') return;
  engine = kit;
  if (!lists.shape.length) {
    lists.shape = kit.TABLES.shapes.map(x => x.id);
    lists.expression = kit.TABLES.expressions.map(x => x.id);
    lists.colour = kit.TABLES.colours.map(x => x.id);
    for (const c of kit.TABLES.colours) hexes.set(c.id, c.hex);
  }
  thumbs.shape.clear();
  thumbs.expression.clear();
  big = kit.mountBuddy($('#introFace'), { calm: still,
    shape: answer.face.shape, expression: answer.face.expression });
  big.start();

  for (const key of ['shape', 'expression', 'colour']) {
    const row = $('#intro' + key);
    for (const id of lists[key]) {
      const label = KO[id] || id;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'character-choice';
      b.dataset.pickKey = key;
      b.dataset.pickId = id;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', 'false');
      b.title = label;
      if (key === 'colour') b.style.background = hexes.get(id);
      else {
        const api = kit.mountBuddy(b, { still: true, calm: still,
          shape: key === 'shape' ? id : answer.face.shape,
          expression: key === 'expression' ? id : answer.face.expression });
        api.setColour(answer.face.colour);
        api.start();
        thumbs[key].set(id, api);
      }
      b.onclick = () => { answer.face[key] = id; paintFace(); };
      row.append(b);
    }
  }
  paintFace();
}

function paintFace() {
  for (const key of ['shape', 'expression', 'colour']) {
    document.querySelectorAll(`[data-pick-key="${key}"]`).forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.pickId === answer.face[key])));
  }
  $('#introFace')?.setAttribute('aria-label',
    `${KO[answer.face.colour]} ${KO[answer.face.shape]} · ${KO[answer.face.expression]}`);
  if (!big) return;
  big.setShape(answer.face.shape);
  big.setExpression(answer.face.expression);
  big.setColour(answer.face.colour);
  for (const api of thumbs.expression.values()) { api.setShape(answer.face.shape); api.setColour(answer.face.colour); }
  for (const api of thumbs.shape.values()) { api.setExpression(answer.face.expression); api.setColour(answer.face.colour); }
}

function dropFace() {
  big?.stop();
  big = null;
  for (const key of ['shape', 'expression']) {
    for (const api of thumbs[key].values()) api.stop();
    thumbs[key].clear();
  }
}

/* ── 오가기 ────────────────────────────────────────────── */
/* 브라우저 거울. 경기 화면은 토큰을 안 보고 rt.name·rt.character 만 읽는다
   (app.js·ranked.js) — 중계기가 잠깐 안 되어도 화면이 비면 안 된다. */
function mirror() {
  if (answer.name) write('rt.name', answer.name);
  write('rt.character', JSON.stringify(answer.face));
}

/* 아이디는 이 장을 떠날 때 바로 서버에 건다. 끝에서 한꺼번에 올리면, 마지막
   장까지 다 걸어온 사람에게 "그 아이디는 남의 것입니다" 를 그제야 알리게 된다. */
async function claimHandle() {
  const v = answer.handle;
  if (!v || v === claimed) return true;
  if (!/^[a-z0-9_]{3,16}$/.test(v)) {
    say('영문 소문자·숫자·밑줄 3~16자로 지어 주세요.', true);
    return false;
  }
  say('아이디를 확인하고 있습니다…');
  try {
    /* 서버가 다듬어 되돌려 준 값을 확인한다 — 모양은 맞지만 서버가 안 내주는
       말(예약어)이 있어서, 200 을 받았다고 저장된 것은 아니다. 되돌아온 값이
       친 것과 다르면 조용히 넘어가지 않는다 */
    const back = await save();
    if (back.handle !== v) {
      say('그 아이디는 쓸 수 없습니다. 다른 아이디를 지어 주세요.', true);
      return false;
    }
    claimed = v;
    say('');
    return true;
  } catch (e) {
    say(e.status === 409 ? '이미 쓰이고 있는 아이디입니다. 다른 아이디를 지어 주세요.'
      : '아이디를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
    return false;
  }
}

/* 이 브라우저에 남아 있는 rt.name·rt.bio 는 읽지 않는다 — 앞사람이 로그아웃
   없이 탭을 닫았으면 그 값이 남아 있고, 그대로 올리면 남의 소개가 새 계정의
   공개 프로필이 된다(가족·공용 PC). 가입 안내에는 소개 칸 자체가 없으므로
   소개는 빈 값으로 시작한다 — 내 계정에서 적으면 된다. */
const save = () => post('/auth/profile', {
  name: answer.name,
  bio: '',
  face: answer.face,
  lang: parse('rt.opt', {}).lang || 'auto',
  handle: answer.handle,
  botname: answer.botname,
  push: answer.push === true,
  shut: answer.shut === true,
});

/* 그 장을 채웠는가. 못 채웠으면 무엇이 빠졌는지 그 자리에서 말한다 —
   '다음' 이 말없이 안 눌리면 고장으로 보인다 */
function missing(s) {
  if (s.kind === 'phone') {
    const p = sec.phone;
    if (p.codes && !p.acked) return '복구 코드를 적어 두고 "적어 두었습니다"에 체크해 주세요.';
    return p.done ? '' : '기본 인증 수단인 전화번호를 입력한 뒤 인증해 주세요.';
  }
  if (s.kind === 'mail') {
    const m = sec.mail;
    return m.want === true && !m.done && !m.off
      ? '확인 코드를 입력하거나 "추가하지 않기"를 골라 주세요.' : '';
  }
  if (s.skip) return '';
  if (s.kind === 'text' && !answer[s.key]) return {
    botname: '캐릭터 이름을 지어 주세요.',
    name: '닉네임을 적어 주세요.',
    handle: '아이디를 정해 주세요.',
  }[s.key] || '이 칸을 채워 주세요.';
  if (s.kind === 'yesno' && answer[s.key] === null) return '둘 중 하나를 골라 주세요.';
  return '';
}

async function next() {
  clearTimeout(beating);
  way = 'fwd';
  const s = STEPS[at];
  if (isSec(s.kind) && sec[s.kind].busy) return;
  if (s.kind === 'text') {
    const input = $('#introInput');
    let v = (input?.value || '').trim();
    if (s.key === 'handle') v = v.replace(/^@/, '').toLowerCase();
    else v = v.replace(/\p{C}/gu, ' ').replace(/ +/g, ' ').trim();
    answer[s.key] = v.slice(0, s.max);
    /* 다듬은 값을 칸에도 되돌려 적는다 — 'AB' 를 치고 막혔는데 칸엔 'AB' 가
       남아 있으면, 무엇이 저장될 값인지 사람이 알 수 없다 */
    if (input) input.value = answer[s.key];
  }
  const gap = missing(s);
  if (gap) {
    say(gap, true);
    /* 못 채운 그 칸으로 데려다 준다 — 여기서는 테두리가 옳다. 무엇을 고쳐야
       하는지 가리키는 것이지 재촉이 아니다 */
    (body().querySelector('input, button') || $('#introNext')).focus({ preventScroll: true });
    return;
  }
  if (s.kind === 'text' && s.key === 'handle' && !(await claimHandle())) return;
  if (s.kind === 'face') dropFace();
  if (s.kind === 'phone') wipeCodes();
  if (s.kind === 'done') return finish();
  at = Math.min(at + 1, STEPS.length - 1);
  mirror();
  draw();
}

function back() {
  clearTimeout(beating);
  way = 'back';
  const s = STEPS[at];
  if (isSec(s.kind) && sec[s.kind].busy) return;
  /* 복구 코드는 다시 볼 수 없다 — 적어 두었다고 체크하기 전엔 못 떠난다 */
  if (s.kind === 'phone' && sec.phone.codes && !sec.phone.acked) {
    say(missing(s), true);
    return;
  }
  if (s.kind === 'face') dropFace();
  if (s.kind === 'phone') wipeCodes();
  at = Math.max(at - 1, 0);
  draw();
}

/* 건너뛰기는 진짜로 비운다. 설문 셋에만 있다(STEPS 의 skip) — 프로필은
   비워 둔 채 지나갈 수 없으므로 이 손이 닿지 않는다 */
function skip() {
  clearTimeout(beating);
  way = 'fwd';
  const s = STEPS[at];
  if (!s.skip) return;
  if (s.kind === 'mail') {
    if (sec.mail.busy) return;
    if (!sec.mail.done) sec.mail.want = false;   // 확인 못 한 메일은 추가하지 않은 것이다
  }
  if (s.kind === 'pick') answer[s.key] = '';
  if (s.kind === 'scale') answer.nps = null;
  at = Math.min(at + 1, STEPS.length - 1);
  draw();
}

let finishing = false;
async function finish() {
  if (finishing) return;
  finishing = true;
  $('#introNext').disabled = true;
  say('저장하고 있습니다…');
  mirror();
  try {
    /* 설문 먼저다 — 이 줄이 있어야 다음에 들어와도 안내를 다시 안 띄운다 */
    await post('/auth/intro', { platform: answer.platform, medium: answer.medium, nps: answer.nps });
    await save();
  } catch {
    finishing = false;
    $('#introNext').disabled = false;
    say('저장하지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.', true);
    return;
  }
  /* 마쳤다는 표를 이 브라우저에도 남긴다 — 뒤로 가기로 돌아오면 중계기에
     묻기 전에 바로 비키려는 것이다(아래 들어오는 문). 원본은 서버의 intro 다 */
  write(DONE_KEY, token());
  /* replace 가 아니라 assign 이다. 바꿔치기(replace) navigation 에는 브라우저가
     교차 문서 View Transition 을 걸지 않는다 — 카드가 내려가며 홈이 드러나는
     그 전환이 통째로 사라진다(Navigation API 의 history:'replace' 도 같다).
     그래서 기록을 한 칸 쌓는 assign 으로 가고, 뒤로 돌아오는 길은 위의 표로 막는다. */
  location.assign('../');
}

/* ── 손잡이 ────────────────────────────────────────────── */
$('#introNext').onclick = () => next();
$('#introBack').onclick = back;
$('#introSkip').onclick = skip;

/* 복구 코드를 받고 적어 두기 전에 탭을 닫으면 코드를 영영 못 본다 */
addEventListener('beforeunload', e => {
  if (sec.phone.codes && !sec.phone.acked) e.preventDefault();
});

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const s = STEPS[at];
  const el = document.activeElement;
  if (e.key === 'Enter') {
    /* 보안 두 장에서는 칸마다 Enter 의 뜻이 다르다: 번호·메일 칸은 보내기, 코드 칸은
       확인. 칸 안의 단추(보내기·확인·다시 보내기·추가하기)는 브라우저가 누르게 둔다.
       한글 조합 중의 Enter 는 조합 확정이라 건드리지 않는다 */
    if (isSec(s.kind) && el) {
      if (e.isComposing) return;
      if (el.id === 'vIn') { e.preventDefault(); sendCode(s.kind); return; }
      if (el.id === 'vCode') { e.preventDefault(); confirmCode(s.kind); return; }
      if (el.tagName === 'BUTTON' && body().contains(el)) return;
    }
    /* 글 칸 안에서도 Enter 는 '다음' 이다 — 폼이 아니라 장이 하나씩 넘어간다 */
    e.preventDefault();
    next();
    return;
  }
  /* 숫자 키는 고르는 장에서만 뜻이 있다. 글 칸에 숫자를 치는 걸 뺏지 않는다 */
  if (el?.tagName === 'INPUT') return;
  if (!/^[0-9]$/.test(e.key)) return;
  const n = Number(e.key);
  if (s.kind === 'mail' && (n === 1 || n === 2) && !sec.mail.already) {
    e.preventDefault();
    pickMail(n === 1);
  } else if (s.kind === 'pick' && n >= 1 && n <= s.list.length) {
    e.preventDefault();
    chose(s.key, s.list[n - 1][0]);
  } else if (s.kind === 'yesno' && (n === 1 || n === 2)) {
    e.preventDefault();
    pickYesno(s, n === 1);
  } else if (s.kind === 'scale') {
    e.preventDefault();
    chose('nps', n);         // 10 은 단추로 고른다 — 키 하나로는 못 친다
  }
});

/* ── 들어오는 문 ───────────────────────────────────────── */
(async () => {
  if (!token()) { location.replace('../'); return; }
  /* 이미 마친 사람은 여기 머물 이유가 없다. 이 브라우저에 지금 토큰과 같은 표가 있으면
     중계기에 묻기도 전에 비킨다 — 뒤로 가기로 돌아왔을 때 설문이 한 번 번쩍이지 않는다.
     옛 계정이 남긴 표('1' 이나 다른 토큰)는 새로 가입한 계정을 내쫓지 못한다. */
  if (read(DONE_KEY) === token()) { location.replace('../'); return; }
  draw();
  /* 표가 없으면(기기를 바꿨거나 저장소를 지웠거나) 서버에 묻는다. 그 사이에도
     첫 장은 이미 떠 있다 — 중계기가 느려도 빈 화면을 보이지 않는다 */
  try {
    const r = await fetch(API + '/auth/me', { headers: { authorization: 'Bearer ' + token() } });
    if (r.status === 401) { forget(); location.replace('../'); return; }
    const d = await r.json();
    if (d.intro) { write(DONE_KEY, token()); location.replace('../'); return; }
    /* 이미 확인된 번호·메일은 다시 묻지 않는다 */
    const was = [sec.phone.done, sec.mail.done];
    if (d.phone === true) sec.phone.done = sec.phone.already = true;
    if (d.mailbox === true) sec.mail.done = sec.mail.already = true;
    const moved = was[0] !== sec.phone.done || was[1] !== sec.mail.done;
    /* 다시 들어온 사람은 하다 만 자리에서 잇는다 */
    const p = d.profile;
    if (p) {
      answer.name = p.name || '';
      answer.handle = p.handle || '';
      claimed = answer.handle;
      answer.botname = p.botname || '';
      answer.push = p.push == null ? null : !!p.push;
      answer.shut = p.shut == null ? null : !!p.shut;
      const [shape, expression, colour] = String(p.face || '').split(',');
      if (shape) answer.face = { shape, expression, colour };
      if (STEPS[at].kind !== 'face') draw();
    } else if (moved && isSec(STEPS[at].kind)) draw();
  } catch {}
})();
})();
