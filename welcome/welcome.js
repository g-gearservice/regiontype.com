/* 가입 안내. 처음 로그인한 사람에게만 한 번 뜬다(auth.js 의 done() 이 여기로
   보낸다). 한 장에 한 가지만 묻는다 — 설문 두 장, 캐릭터와 프로필 다섯 장.

   서버에 남는 것은 두 줄뿐이다: intro 한 줄(무엇을 보고 왔는지·추천 의향)과
   profile 한 줄(닉네임·아이디·캐릭터·스위치 둘). 자유 입력 칸은 닉네임·아이디·
   캐릭터 이름 셋이고, 셋 다 worker.mjs 의 profile() 이 같은 규칙으로 다듬는다.

   '건너뛰기' 는 진짜로 건너뛴다 — 안 고른 값은 안 보낸다. 다만 아이디는 한 번
   정하면 여기서 비울 수 없다(서버가 빈 값으로 덮지 않는다).                */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const VER = new URL(document.currentScript.src).searchParams.get('v') || '';
const asset = p => p + (p.includes('?') ? '&' : '?') + 'v=' + VER;
const API = 'https://g.gearservicevanguard.com';

const read = (k, d = '') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const parse = (k, d) => { try { return JSON.parse(read(k)) || d; } catch { return d; } };
const token = () => read('rt.token');
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
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.msg || String(r.status)); e.status = r.status; e.data = d; throw e; }
  return d;
}

/* ── 모아 두는 답 ──────────────────────────────────────── */
const FACE = { shape: 'cercle', expression: 'curieux', colour: 'turquoise' };
const answer = {
  platform: '', medium: '', nps: null,
  face: { ...FACE }, botname: '', name: '', handle: '',
  push: false, shut: false,
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
   여기 순서를 바꾸면 화면 순서가 바뀐다 — 다른 곳에 번호를 적어 두지 않았다. */
const STEPS = [
  { kind: 'hello' },
  { kind: 'pick', key: 'platform', kicker: '설문 1/3',
    ask: 'regiontype 을 어디에서 보셨나요?',
    note: '딱 세 가지만 묻습니다. 어디에 더 나가야 할지 정하는 데만 씁니다.',
    list: [
      ['search', '검색 (구글·네이버 등)'], ['youtube', '유튜브'],
      ['instagram', '인스타그램'], ['x', 'X (트위터)'],
      ['tiktok', '틱톡'], ['community', '커뮤니티·카페'],
      ['friend', '친구·지인'], ['etc', '그 밖에'],
    ] },
  { kind: 'pick', key: 'medium', kicker: '설문 2/3',
    ask: '어떤 모습으로 만나셨나요?',
    note: '',
    list: [
      ['video', '영상'], ['post', '글·게시물'], ['comment', '댓글'],
      ['result', '검색 결과'], ['ad', '광고'], ['direct', '주소를 직접 쳤다'],
      ['etc', '그 밖에'],
    ] },
  { kind: 'scale', key: 'nps', kicker: '설문 3/3',
    ask: '이곳을 친구에게 권하시겠어요?',
    note: '0 은 전혀 아니다, 10 은 꼭 권하겠다 입니다.' },
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
  { kind: 'done' },
];

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

function draw() {
  const s = STEPS[at];
  $('#introStep').textContent = at + 1;
  $('#introBar').style.width = ((at + 1) / STEPS.length * 100) + '%';
  $('#introKicker').textContent = s.kicker || '';
  $('#introNote').textContent = s.note || '';
  $('#introBack').hidden = at === 0;
  $('#introSkip').hidden = !['pick', 'scale', 'text', 'yesno'].includes(s.kind);
  $('#introNext').textContent = s.kind === 'done' ? '시작하기' : s.kind === 'hello' ? '시작' : '다음';
  say('');
  body().replaceChildren();
  ({ hello: drawHello, pick: drawPick, scale: drawScale, face: drawFace,
     text: drawText, yesno: drawYesno, done: drawDone })[s.kind](s);
  /* 화면이 바뀌면 손이 갈 첫 자리로 옮긴다 — 키보드만으로도 끝까지 간다 */
  (body().querySelector('input, button') || $('#introNext')).focus();
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
    const key = document.createElement('kbd');
    key.textContent = i < 9 ? String(i + 1) : '·';
    const text = document.createElement('span');
    text.textContent = label;
    b.append(key, text);
    b.onclick = () => { answer[s.key] = id; draw(); next(); };
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
    b.onclick = () => { answer.nps = n; draw(); next(); };
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
    const key = document.createElement('kbd'); key.textContent = String(i + 1);
    const text = document.createElement('span'); text.textContent = label;
    b.append(key, text);
    b.onclick = () => pickYesno(s, v);
    box.append(b);
  });
  body().append(box);
}

/* 알림은 고른 그 자리에서 브라우저에게도 묻는다 — 나중에 한꺼번에 물으면
   무엇 때문에 묻는지 모르는 창이 뜬다. 거절해도 넘어간다(값만 끈다). */
async function pickYesno(s, v) {
  answer[s.key] = v;
  if (s.key === 'push' && v) {
    if (!('Notification' in window)) {
      answer.push = false;
      say('이 브라우저는 알림을 지원하지 않습니다. 이 항목은 꺼 둡니다.');
      draw();
      return;
    }
    say('브라우저에 알림 권한을 묻고 있습니다…');
    let ok = 'denied';
    try { ok = await Notification.requestPermission(); } catch {}
    answer.push = ok === 'granted';
    if (!answer.push) {
      say('알림이 허용되지 않았습니다. 나중에 설정에서 다시 켤 수 있습니다.');
      draw();
      return;
    }
  }
  draw();
  next();
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

function drawDone() {
  $('#introAsk').textContent = '다 됐습니다.';
  const list = document.createElement('dl');
  list.className = 'intro-recap';
  const rows = [
    ['캐릭터', `${KO[answer.face.colour] || ''} ${KO[answer.face.shape] || ''} · ${KO[answer.face.expression] || ''}`
      + (answer.botname ? ` — ${answer.botname}` : '')],
    ['닉네임', answer.name || '(안 정함)'],
    ['아이디', answer.handle ? '@' + answer.handle : '(안 정함)'],
    ['알림', answer.push ? '받음' : '안 받음'],
    ['계정', answer.shut ? '비공개' : '공개'],
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
  name: answer.name || '익명',
  bio: '',
  face: answer.face,
  lang: parse('rt.opt', {}).lang || 'auto',
  handle: answer.handle,
  botname: answer.botname,
  push: answer.push,
  shut: answer.shut,
});

async function next() {
  const s = STEPS[at];
  if (s.kind === 'text') {
    const input = $('#introInput');
    let v = (input?.value || '').trim();
    if (s.key === 'handle') v = v.replace(/^@/, '').toLowerCase();
    else v = v.replace(/\p{C}/gu, ' ').replace(/ +/g, ' ').trim();
    answer[s.key] = v.slice(0, s.max);
    /* 다듬은 값을 칸에도 되돌려 적는다 — 'AB' 를 치고 막혔는데 칸엔 'AB' 가
       남아 있으면, 무엇이 저장될 값인지 사람이 알 수 없다 */
    if (input) input.value = answer[s.key];
    if (s.key === 'handle' && !(await claimHandle())) return;
  }
  if (s.kind === 'face') dropFace();
  if (s.kind === 'done') return finish();
  at = Math.min(at + 1, STEPS.length - 1);
  mirror();
  draw();
}

function back() {
  if (STEPS[at].kind === 'face') dropFace();
  at = Math.max(at - 1, 0);
  draw();
}

/* 건너뛰기는 진짜로 비운다 — 아이디만 예외다(서버가 빈 값으로 덮지 않는다) */
function skip() {
  const s = STEPS[at];
  if (s.kind === 'pick') answer[s.key] = '';
  if (s.kind === 'scale') answer.nps = null;
  if (s.kind === 'yesno') answer[s.key] = false;
  if (s.kind === 'text') answer[s.key] = '';
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
  location.replace('../');
}

/* ── 손잡이 ────────────────────────────────────────────── */
$('#introNext').onclick = () => next();
$('#introBack').onclick = back;
$('#introSkip').onclick = skip;

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const s = STEPS[at];
  if (e.key === 'Enter') {
    /* 글 칸 안에서도 Enter 는 '다음' 이다 — 폼이 아니라 장이 하나씩 넘어간다 */
    e.preventDefault();
    next();
    return;
  }
  /* 숫자 키는 고르는 장에서만 뜻이 있다. 글 칸에 숫자를 치는 걸 뺏지 않는다 */
  if (document.activeElement?.tagName === 'INPUT') return;
  if (!/^[0-9]$/.test(e.key)) return;
  const n = Number(e.key);
  if (s.kind === 'pick' && n >= 1 && n <= s.list.length) {
    e.preventDefault();
    answer[s.key] = s.list[n - 1][0];
    draw();
    next();
  } else if (s.kind === 'yesno' && (n === 1 || n === 2)) {
    e.preventDefault();
    pickYesno(s, n === 1);
  } else if (s.kind === 'scale') {
    e.preventDefault();
    answer.nps = n;          // 10 은 단추로 고른다 — 키 하나로는 못 친다
    draw();
    next();
  }
});

/* ── 들어오는 문 ───────────────────────────────────────── */
(async () => {
  if (!token()) { location.replace('../'); return; }
  draw();
  /* 이미 마친 사람은 여기 머물 이유가 없다. 안내를 보여 준 뒤에 묻는다 —
     중계기가 느려도 첫 장은 바로 뜬다 */
  try {
    const r = await fetch(API + '/auth/me', { headers: { authorization: 'Bearer ' + token() } });
    if (r.status === 401) { location.replace('../'); return; }
    const d = await r.json();
    if (d.intro) { location.replace('../account/'); return; }
    /* 다시 들어온 사람은 하다 만 자리에서 잇는다 */
    const p = d.profile;
    if (p) {
      answer.name = p.name || '';
      answer.handle = p.handle || '';
      claimed = answer.handle;
      answer.botname = p.botname || '';
      answer.push = !!p.push;
      answer.shut = !!p.shut;
      const [shape, expression, colour] = String(p.face || '').split(',');
      if (shape) answer.face = { shape, expression, colour };
      if (STEPS[at].kind !== 'face') draw();
    }
  } catch {}
})();
})();
