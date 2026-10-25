/* regiontype 경쟁전 · 순위 · 기록.

   순위(#ranking)·기록(#records)·내 계정(#account)은 설정처럼 제 페이지가 아니라 홈 위에
   뜨는 덮개다. 전환은 style.css 의 body.paging 이 맡고, 주소에는 해시만 남는다.

   경쟁전은 아래 줄의 시작하기를 꾹 눌러 켠다. 넵바 로고를 끌어내리면 나오는 Grok
   봇은 이제 경쟁전이 아니라 홈의 도우미다(아래 '도우미 봇' 절).
   lp 셈과 부정 막기는 전부 중계기(relay/worker.mjs 의 경쟁전 절)가 한다 — 여기는
   표를 받아 app.js 의 start() 에 넘기고, 끝나면 결과를 올릴 뿐이다.

   app.js 뒤에 실려 그 전역을 빌려 쓴다: t · token · asset · start · opt · clock ·
   calm · homeTitle · aimNavShape · relayoutNavShapes · plain · showSpeed · BOOTED ·
   COURSE · PICK · G · board.
   ponytail: 빌려 쓰는 게 이만큼 늘었다. 한 번 더 늘면 app.js 를 모듈로 나눈다. */
(function () {
'use strict';

const $ = s => document.querySelector(s);
const RELAY = self.RT_RELAY;   // relay.js
const NAME_KEY = 'rt.name';
/* 중계기와 같은 수다(worker.mjs 의 STEP · DIVS · PLACE). 티어 이름은 여기서만 짓는다.
   한 디비전이 STEP lp, 한 티어가 III·II·I 세 디비전이고 마스터만 하나다 */
const STEP = 100, DIVS = 3, PLACE = 5, TIERS = 6;
const tierOf = lp => Math.min(TIERS - 1, Math.floor(lp / (STEP * DIVS)));
const tierLabel = lp => t('tier' + tierOf(lp)) +
  (tierOf(lp) < TIERS - 1 ? ' ' + ['III', 'II', 'I'][Math.floor(lp / STEP) % DIVS] : '');
const tierName = (lp, games) => games < PLACE
  ? t('placing', { n: games, m: PLACE }) : tierLabel(lp);
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
/* 전적 한 줄의 승패. 옛 줄(win 이 없던 때)은 lp 부호로 읽는다 */
const resKey = g => { const w = g.win ?? (g.delta > 0 ? 1 : g.delta < 0 ? 0 : .5); return w === 1 ? 'win' : w === 0 ? 'loss' : 'draw'; };
const resOf = g => t({ win: 'resWin', loss: 'resLoss', draw: 'resDraw' }[resKey(g)]);
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
/* 봇의 모습은 계정 화면에서 고른 것을 그대로 쓴다 — 저장은 거기서 하고 여기선 읽기만
   한다(로그인해 있으면 계정 화면이 서버 값을 이 거울에 맞춰 둔다). 고른 적이 없으면
   null 셋이라 엔진이 제 기본 모습으로 선다. 색은 CSS 의 --buddy-ink(경쟁전 빨강)를
   덮으므로, 안 골랐으면 덮지 않아 빨간 봇 그대로다. */
const readFace = () => {
  try { return JSON.parse(localStorage.getItem('rt.character') || '{}') || {}; }
  catch { return {}; }
};

/* anon — 세션 토큰을 싣지 않는다. 봇 대화는 로그인과 상관없고, 안 보내면 샐 일도 없다 */
async function ask(path, body, anon) {
  const head = {};
  if (body) head['content-type'] = 'application/json';
  if (token() && !anon) head.authorization = 'Bearer ' + token();
  const r = await fetch(RELAY + path, body
    ? { method: 'POST', headers: head, body: JSON.stringify(body) } : { headers: head });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.msg || String(r.status)); e.status = r.status; throw e; }
  return d;
}

/* 코스 이름은 홈 칸에서 읽는다. 서울 코스는 머리글 이름이다 */
const placeOf = slug => slug === COURSE.root ? homeTitle()
  : (COURSE.tiles.find(x => x.slug === slug && !x.kid) || COURSE.tiles.find(x => x.slug === slug) || {}).label || slug;

/* ── 덮개 여닫기 ─────────────────────────────────────────
   settings.js 와 같은 결: 뒤를 inert 로 잠그고, 탭은 안에서만 돌고, Esc·뒤로 가기로
   닫힌다. 닫을 때는 글자를 바로 접고 칸 위의 서리만 --si-dur 동안 걷는다 */
const PAGES = ['ranking', 'records', 'account'];
const over = name => document.getElementById(name);
let page = null, opener = null, inertWas = [], leaveGen = 0;

function siDurMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--si-dur').trim();
  return raw.endsWith('ms') ? parseFloat(raw) : (parseFloat(raw) || 0) * 1000;
}
function lockBack(on, el) {
  if (on) {
    inertWas = [...document.body.children]
      .filter(n => n !== el && n.tagName !== 'SCRIPT' && !['boot', 'signin', 'options', 'codes', 'feedback', 'styles', 'tabDock'].includes(n.id))
      .map(n => [n, n.inert]);
    inertWas.forEach(([n]) => { n.inert = true; });
  } else {
    inertWas.forEach(([n, was]) => { n.inert = was; });
    inertWas = [];
  }
}
function openPage(name) {
  if (page === name) return;
  /* 기록은 로그인한 사람만 — 로그인 전엔 로그인 덮개를 연다 */
  if (page) closePage(true);
  const el = over(name);
  leaveGen++;
  PAGES.forEach(p => { over(p).classList.remove('pg-exit'); if (p !== name) over(p).hidden = true; });
  document.body.classList.remove('pg-leaving');
  opener = document.activeElement;
  lockBack(true, el);
  el.hidden = false;
  document.body.classList.add('paging');
  page = name;
  if (location.hash !== '#' + name) histPush({ pg: 1 }, '#' + name);
  /* 폰은 뒤로 단추를 접고 탭으로 오간다 — 초점은 제목으로 */
  (fingers() ? el.querySelector('h1, h2') : el.querySelector('[data-pg-close]')).focus({ preventScroll: true });
  if (name === 'ranking') fillRanking();
  else if (name === 'records') fillRecords();
  else openAccount();
}
function closePage(now) {
  if (!page) return;
  const el = over(page), was = page;
  page = null;
  lockBack(false);
  document.body.classList.remove('paging');
  const done = () => { el.hidden = true; el.classList.remove('pg-exit'); document.body.classList.remove('pg-leaving'); };
  if (now === true || calm() || !siDurMs()) done();
  else {
    const gen = ++leaveGen;
    el.classList.add('pg-exit');
    document.body.classList.add('pg-leaving');
    setTimeout(() => { if (gen === leaveGen) done(); }, siDurMs() + 80);
  }
  if (PAGES.includes(location.hash.slice(1))) history.replaceState(null, '', location.pathname + location.search);
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  opener = null;
  if (was === 'account') leftAccount();
}

/* ── 내 스타일 ── 덮개가 아니라 연 단추 바로 아래 뜨는 popover 다. 계정에서 열어도 계정이 그대로 남는다.
   Esc·바깥 누르기(popover 가 한다)·닫기 단추로 닫히고, 초점은 연 단추로 돌아간다.
   아래 자리가 모자라면 단추 위로 뒤집고, 단추가 안 보이면(봇·주소로 열 때) 위 가운데에 띄운다 */
let styOpener = null;
const styOpen = () => $('#styles').matches(':popover-open');
function placeStyles() {
  const d = $('#styles'), PAD = 16, GAP = 8;
  const a = styOpener && styOpener !== document.body && styOpener.isConnected && styOpener.getClientRects().length ? styOpener.getBoundingClientRect() : null;
  const w = d.offsetWidth, h = d.firstElementChild.scrollHeight;
  let top = a ? a.bottom + GAP : PAD + 56;
  if (a && innerHeight - top - PAD < Math.min(h, 320) && a.top - GAP - PAD > innerHeight - top - PAD) top = Math.max(PAD, a.top - GAP - h);
  d.style.left = Math.round(a ? Math.min(Math.max(PAD, a.left), innerWidth - w - PAD) : (innerWidth - w) / 2) + 'px';
  d.style.top = Math.round(top) + 'px';
  d.style.maxHeight = Math.round((a && top < a.top ? a.top - GAP : innerHeight - PAD) - top) + 'px';
}
function openStyles(from) {
  const d = $('#styles');
  if (styOpen()) return;
  styOpener = from || document.activeElement;
  styleGone = null; $('#styNote').textContent = '';
  fillStyles();
  d.showPopover();
  placeStyles();
  (fingers() ? $('#styHead') : $('#styClose')).focus({ preventScroll: true });
}

/* ── 내 계정 ──────────────────────────────────────────
   알맹이(account/account.js)는 처음 열 때 한 번 싣는다 — 계정 화면에 안 들어오는 사람은
   캐릭터 견본 스물넷을 그릴 까닭이 없다. 다시 열면 로그인 상태만 새로 읽힌다.
   닫고 나면 거기서 바꾼 것을 홈에 입힌다: 말·야간 등은 app.js 가 rt-opt 로 다시 읽고,
   봇은 고친 모습·색·이름을 입는다 */
let accountJs = false;
function openAccount() {
  if (accountJs) { dispatchEvent(new Event('rt-account')); return; }
  accountJs = true;
  const s = document.createElement('script');
  s.src = asset('account/account.js');
  document.body.append(s);
}
function leftAccount() {
  dispatchEvent(new Event('rt-opt'));
  if (!bot) return;
  const face = readFace();
  if (face.shape) bot.api.setShape(face.shape);
  if (face.expression) bot.api.setExpression(face.expression);
  bot.api.setColour(face.colour);
  paintTint(bot.el.querySelector('.rk-bot-motion'));
  bot.el.setAttribute('aria-label', botName());
  /* 크기가 바뀌었으면 제자리(옮겨 둔 곳이나 로고 밑)에 다시 선다 */
  const was = BOT;
  sizeBot();
  if (was !== BOT && out && !touring && !intro) { if (spot) moveTo(...spot); else place(...(phone() ? underLogo() : cornerAt(corner))); }
}

/* ── 순위 ─────────────────────────────────────────────── */
function rankRow(i, name, right, me, lp) {
  const li = document.createElement('li');
  li.innerHTML = '<b></b><span class="who"></span><span class="pt"></span>';
  li.querySelector('b').textContent = i + 1;
  li.querySelector('.who').textContent = name;
  li.querySelector('.pt').textContent = right;
  if (lp != null) {
    const s = document.createElement('span');
    s.className = 'tier'; s.dataset.tier = tierOf(lp); s.textContent = tierLabel(lp);
    li.querySelector('.who').after(s);
  }
  if (me) {
    li.classList.add('me');
    const tag = document.createElement('span');
    tag.className = 'tag'; tag.textContent = t('me');
    li.querySelector('.who').after(tag);
  }
  return li;
}
let rankReq = 0;
async function fillRanking() {
  const n = ++rankReq;
  const lad = $('#ladderList'), say = $('#ladderSay');
  lad.replaceChildren(); say.textContent = t('reading');
  $('#rkDev').textContent = `${t(DEV === 'mobile' ? 'devMobile' : 'devPc')} · ${langName()}`;
  try {
    const d = await ask(`/ladder?dev=${DEV}`);
    if (n !== rankReq) return;
    lad.replaceChildren(...d.top.map((r, i) => rankRow(i, r.name, r.lp + ' LP', r.me, r.lp)));
    say.textContent = d.top.length ? '' : t('ladderEmpty');
  } catch { if (n === rankReq) say.textContent = t('boardFail'); }
  await Promise.all(['ranked', 'normal'].map(mode => fillBests(n, mode)));
}
/* 코스별 최고 기록. 코스·시간마다 1위 한 줄씩이고, 펼치면 그 판의 순위표와 내 자리를 읽는다.
   경쟁전과 일반전은 따로 센다. 이 나라 코스만 보인다 — 다른 나라 코스는 이름을 못 읽는다.
   지금 고른 칸의 판은 펼친 채로 연다 */
async function fillBests(n, mode) {
  const box = $(`#${mode}Bests`), say = $(`#${mode}BestsSay`);
  box.replaceChildren(); say.textContent = t('reading');
  let d;
  try { d = await ask(`/top?mode=${mode}&dev=${DEV}&lang=${LANG}`); } catch { if (n === rankReq) say.textContent = t('boardFail'); return; }
  if (n !== rankReq) return;
  const here = PICK ? PICK.slug : COURSE.root;
  const known = s => s === COURSE.root || COURSE.tiles.some(x => x.slug === s);
  const rows = d.bests.filter(b => known(b.slug));
  box.replaceChildren(...rows.map(b => {
    const det = document.createElement('details');
    det.className = 'pg-best';
    det.innerHTML = '<summary><span class="where"></span><span class="who"></span><span class="pt"></span><span class="n"></span></summary><ol class="ranks pg-ranks"></ol><p class="pg-say" role="status"></p>';
    det.querySelector('.where').textContent = `${placeOf(b.slug)} · ${clock(b.secs)}`;
    det.querySelector('.who').textContent = b.name;
    det.querySelector('.pt').textContent = showSpeed(b.cpm);
    det.querySelector('.n').textContent = t('players', { n: b.n });
    let read = false;
    det.addEventListener('toggle', async () => {
      if (!det.open || read) return;
      read = true;
      const ol = det.querySelector('ol'), p = det.querySelector('p');
      p.textContent = t('reading');
      try {
        const r = await ask(`/top?c=${encodeURIComponent(b.slug)}&t=${b.secs}&mode=${mode}&dev=${DEV}&lang=${LANG}`);
        ol.replaceChildren(...r.top.map((x, i) => rankRow(i, x.name, showSpeed(x.cpm), x.me)));
        /* 상위 줄 밖이어도 내 자리는 보인다 */
        p.textContent = r.rank && !r.top.some(x => x.me) ? `${t('me')} · ${t('nth', { n: r.rank })}` : '';
      } catch { read = false; p.textContent = t('boardFail'); }
    });
    if (b.slug === here && (mode === 'ranked' || b.secs === opt.time)) det.open = true;
    return det;
  }));
  say.textContent = rows.length ? '' : t('ladderEmpty');
}
function wireTabs() {
  const tabs = [$('#rkTabRanked'), $('#rkTabNormal')];
  const pick = tab => tabs.forEach(tb => {
    const on = tb === tab;
    tb.setAttribute('aria-selected', String(on));
    tb.tabIndex = on ? 0 : -1;
    document.getElementById(tb.getAttribute('aria-controls')).hidden = !on;
  });
  tabs.forEach(tb => tb.addEventListener('click', () => pick(tb)));
  $('#ranking .pg-tabs').addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + 1) % tabs.length];
    pick(next); next.focus();
  });
}

/* ── 기록 ─────────────────────────────────────────────── */
let recReq = 0;
async function fillRecords() {
  const n = ++recReq;
  const say = $('#recSay'), list = $('#recList');
  list.replaceChildren();
  $('#recCard').hidden = true;
  $('#recIn').hidden = !!token();
  if (!token()) { say.textContent = t('recordsOut'); return; }
  say.textContent = t('reading');
  let d;
  try { d = await ask(`/games?dev=${DEV}`); } catch { if (n === recReq) say.textContent = t('boardFail'); return; }
  if (n !== recReq) return;
  const lad = d.ladder;
  if (lad) {
    const placed = lad.games >= PLACE;
    const tier = $('#recTier');
    tier.textContent = tierName(lad.lp, lad.games);
    tier.dataset.tier = placed ? tierOf(lad.lp) : '';
    $('#recLp').textContent = lad.lp + ' LP';
    /* 다음 디비전까지. 마스터는 끝이 없다 — 막대를 가득 채운다 */
    $('#recBar').value = tierOf(lad.lp) === TIERS - 1 ? 100 : lad.lp % STEP;
    $('#recWl').textContent = [t('games', { n: lad.games }),
      t('winLoss', { w: lad.wins, l: lad.games - lad.wins }),
      lad.rank ? t('nth', { n: lad.rank }) : ''].filter(Boolean).join(' · ');
    $('#recCard').hidden = false;
  }
  const day = new Intl.DateTimeFormat(document.documentElement.lang || 'ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  list.replaceChildren(...d.games.map(g => {
    const li = document.createElement('li');
    li.dataset.mode = g.mode;
    const quit = g.mode === 'ranked' && !g.hits && g.delta < 0;
    const cells = [
      ['mode', t(g.mode === 'ranked' ? 'rankedTab' : 'normalTab')],
      ['where', `${placeOf(g.slug)} · ${clock(g.secs)}`],
      ['pt', quit ? t('quitRow') : showSpeed(g.cpm)],
      ['acc', quit ? '' : g.acc + '%'],
      /* 경쟁전은 승패 라벨을 lp 앞에 — 색만으로 가르지 않는다. 배치 판은 ±0 이라 승패가 곧 결과다 */
      ['lp', g.delta == null ? '' : [g.mode === 'ranked' ? resOf(g) : '', signed(g.delta) + ' LP'].filter(Boolean).join(' ')],
      ['at', day.format(new Date(g.at))],
    ];
    cells.forEach(([k, v]) => {
      const s = document.createElement(k === 'at' ? 'time' : 'span');
      s.className = k; s.textContent = v;
      if (k === 'lp' && g.delta != null) s.dataset.sign = g.delta > 0 ? 'up' : g.delta < 0 ? 'down' : '';
      if (k === 'lp' && g.mode === 'ranked') s.dataset.res = resKey(g);
      if (k === 'at') s.dateTime = new Date(g.at).toISOString();
      li.append(s);
    });
    return li;
  }));
  say.textContent = d.games.length || lad ? '' : t('recordsEmpty');
}

/* ── 내 스타일 ─────────────────────────────────────────────
   봇이 지은 스타일(theme 와 같은 답에 실린 look·night·motion)을 이 기기(rt.styles)에 쌓는다 — 지금 색(rt.theme)·
   봇 모습(rt.character)처럼 계정이 아니라 기기 것이다. 같은 두 색은 하나로, 새것이 위로, STYLE_MAX 개까지.
   지우기는 묻지 않고 곧장 지운 뒤 되돌리기를 준다 */
const STYLE_KEY = 'rt.styles', STYLE_MAX = 24;
const readStyles = () => { try { const v = JSON.parse(localStorage.getItem(STYLE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeStyles = list => { try { localStorage.setItem(STYLE_KEY, JSON.stringify(list)); return true; } catch { return false; } };
const curTheme = () => { try { return JSON.parse(localStorage.getItem('rt.theme') || 'null') || {}; } catch { return {}; } };
const sameStyle = (a, b) => THEME.every(k => (a[k.key] || '') === (b[k.key] || ''));
function keepStyle(acts) {
  const th = acts.find(a => a.act === 'theme' && !a.reset);
  if (!th) return;
  const look = acts.find(a => a.act === 'look');
  const s = { id: Date.now().toString(36), name: th.name || '', at: Date.now(), ...pickTheme(th) };
  if (look) s.face = { shape: look.shape, expression: look.expression, colour: look.colour };
  for (const a of acts) if (a.act === 'set' && (a.key === 'night' || a.key === 'motion')) s[a.key] = a.value;
  writeStyles([s, ...readStyles().filter(x => !sameStyle(x, s))].slice(0, STYLE_MAX));
  if (styOpen()) fillStyles();
}
function wearStyle(s) {
  try { localStorage.setItem('rt.theme', JSON.stringify(pickTheme(s))); } catch { return; }
  paintTheme();
  if (s.face) act({ act: 'look', ...s.face });
  const o = {};
  if (typeof s.night === 'boolean') o.night = s.night;
  if (typeof s.motion === 'boolean') o.motion = s.motion;
  if (Object.keys(o).length) dispatchEvent(new CustomEvent('rt-bot-opt', { detail: o }));
}
let styleGone = null, styEdit = false;
/* 견본 하나 — 지도 점 3×3, 가운데가 강조색. 프리셋·추천이 같이 쓴다 */
function swatch(el, s) {
  el.classList.add('sty-swatch');
  if (HEX.test(s.block)) el.style.setProperty('--sw-block', s.block);
  if (HEX.test(s.accent)) el.style.setProperty('--sw-accent', s.accent);
  if (HEX.test(s.bg) && s.night !== true) el.style.setProperty('--sw-bg', s.bg);
  el.toggleAttribute('data-night', s.night === true);
  for (let i = 0; i < 9; i++) el.append(document.createElement('i'));
  return el;
}
function fillStyles(focusId) {
  const list = readStyles(), cur = curTheme(), ul = $('#styList');
  if (!list.length) styEdit = false;
  const day = new Intl.DateTimeFormat(document.documentElement.lang || 'ko', { month: 'numeric', day: 'numeric' });
  ul.toggleAttribute('data-edit', styEdit);
  ul.replaceChildren(...list.map(s => {
    const li = document.createElement('li'), on = sameStyle(s, cur) && THEME.some(k => cur[k.key]);
    const name = s.name || t('styleUntitled');
    const b = swatch(document.createElement('button'), s);
    b.type = 'button'; b.dataset.id = s.id; b.title = name;
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', styEdit ? t('styleDelName', { name })
      : [name, day.format(new Date(s.at)), s.night === true ? t('botChipNight') : ''].filter(Boolean).join(' · '));
    b.insertAdjacentHTML('beforeend', '<span class="sty-tick" aria-hidden="true">✓</span><span class="sty-x" aria-hidden="true"><i class="i i-close"></i></span>');
    li.append(b);
    return li;
  }));
  $('#stySay').textContent = list.length ? '' : t('stylesEmpty');
  $('#styHint').hidden = !list.length || styEdit;
  $('#styDone').hidden = !styEdit;
  $('#styReset').hidden = !THEME.some(k => cur[k.key]);
  fillPick();
  $('#styUndo').hidden = !styleGone;
  if (focusId) (ul.querySelector(`[data-id="${CSS.escape(focusId)}"]`) || $('#styHead')).focus({ preventScroll: true });
}
function setEdit(on, focusId) {
  styEdit = on;
  fillStyles(focusId || document.activeElement?.dataset?.id);
}
function wearPreset(id) {
  const s = readStyles().find(x => x.id === id);
  if (!s) return;
  wearStyle(s);
  fillStyles(s.id);
  $('#styNote').textContent = t('styleWorn', { name: s.name || t('styleUntitled') });
}
function dropPreset(id) {
  const list = readStyles(), i = list.findIndex(x => x.id === id);
  if (i < 0) return;
  styleGone = { s: list[i], i };
  list.splice(i, 1);
  writeStyles(list);
  fillStyles((list[i] || list[i - 1] || {}).id);
  $('#styNote').textContent = t('styleGone', { name: styleGone.s.name || t('styleUntitled') });
  if (!list.length) $('#styUndo').focus({ preventScroll: true });
}
/* 추천 — 지금 강조색의 색상환 맞은편·옆자리에서 칸색을 짓는다. 칸색은 흰 글자와, 강조색은 진한 글자와
   대비(THEME 의 min)를 지킬 때까지 밝기를 민다. 그래서 추천은 늘 저장할 수 있는 짝이다 */
const hsl = (h, s, l) => '#' + [0, 8, 4].map(n => {
  const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
}).join('');
const hueOf = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 0;
  return ((mx === r ? (g - b) / d : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
};
const fitColour = (k, h, s, l, dir) => {
  let c = hsl(h, s, l);
  while (contrast(c, k.on) < k.min && l > .04 && l < .96) c = hsl(h, s, l += dir * .02);
  return c;
};
function styleIdeas(accent) {
  const [A, B] = THEME, h = hueOf(accent);
  if (contrast(accent, A.on) < A.min) accent = fitColour(A, h, .8, .6, 1);
  return [180, 210, 150, 120].map(d => ({ accent, block: fitColour(B, (h + d) % 360, .38, .52, -1) }));
}
function fillSug() {
  const acc = $('#styPick input[name="accent"]').value;
  $('#stySug').replaceChildren(...styleIdeas(acc).map((s, n) => {
    const b = swatch(document.createElement('button'), s);
    b.type = 'button'; b.dataset.accent = s.accent; b.dataset.block = s.block;
    b.setAttribute('aria-label', t('styleSugName', { n: n + 1 }));
    return b;
  }));
}
function useIdea(s) {
  for (const k of ['accent', 'block']) $(`#styPick input[name="${k}"]`).value = s[k];
  previewPick();
}
/* 색 직접 고르기 — THEME 한 줄마다 고르기 칸 하나. 고르는 동안 미리 보이되 대비가 모자란 짝은 미리 보기에서도
   빠진다(이 화면부터 읽히게). 저장해야 rt.theme 에 담기고 목록에 쌓인다. 저장 없이 닫으면 저장된 색으로 돌아간다.
   기본값과 같은 색은 담지 않는다 — 봇이 지은 두 색 스타일과 같은 꼴로 남는다 */
const pickDraft = () => Object.fromEntries([...document.querySelectorAll('#styPick input')]
  .filter(i => i.value !== THEME.find(k => k.key === i.name).def).map(i => [i.name, i.value]));
function fillPick() {
  const cur = curTheme();
  $('#styPick').replaceChildren(...THEME.map(k => {
    const row = document.createElement('label'), inp = document.createElement('input'),
          name = document.createElement('span'), low = document.createElement('span');
    row.className = 'sty-pick'; row.dataset.key = k.key;
    inp.type = 'color'; inp.name = k.key; inp.value = HEX.test(cur[k.key]) ? cur[k.key] : k.def;
    name.textContent = t('color_' + k.key);
    low.className = 'sty-low';
    row.append(inp, name, low);
    return row;
  }));
  checkPick();
  fillSug();
  paintTheme();
}
function checkPick() {
  const low = themeLow(pickDraft());
  for (const row of $('#styPick').children) {
    const x = low.find(l => l.key === row.dataset.key);
    row.toggleAttribute('data-low', !!x);
    row.lastChild.textContent = x ? t('styleLowTag', { r: x.r.toFixed(1), min: x.min }) : '';
  }
  $('#styWarn').textContent = low.length ? t('styleLow') : '';
  return low;
}
function previewPick() {
  const bad = new Set(checkPick().flatMap(x => [x.key, THEME.find(k => k.key === x.key).on]));
  paintTheme(Object.fromEntries(Object.entries(pickDraft()).filter(([k]) => !bad.has(k))));
}
function savePick() {
  if (checkPick().length) { $('#styNote').textContent = t('styleLow'); return; }
  const d = pickDraft();
  try { Object.keys(d).length ? localStorage.setItem('rt.theme', JSON.stringify(d)) : localStorage.removeItem('rt.theme'); } catch { return; }
  if (Object.keys(d).length) keepStyle([{ act: 'theme', name: t('styleMine'), ...d }]);
  fillStyles();
  $('#styNote').textContent = t('styleSaved');
}
function wireStyles() {
  $('#styPick').addEventListener('input', e => { previewPick(); if (e.target.name === 'accent') fillSug(); });
  $('#stySave').addEventListener('click', savePick);
  const d = $('#styles'), ul = $('#styList');
  $('#styClose').addEventListener('click', () => d.hidePopover());
  /* 덮개 손(Esc·Tab 가두기)과 홈의 글쇠 손이 뒤에서 받지 않게 — 닫기(Esc)는 popover 의 기본 동작이라 그대로 산다.
     지우기 모드에서는 Esc 가 먼저 그 모드만 끈다. 견본에서 Delete·Backspace 는 곧 지우기(꾹 누르기의 키보드 짝) */
  d.addEventListener('keydown', e => {
    e.stopPropagation();
    held = false;
    if (e.key === 'Escape' && styEdit) { e.preventDefault(); setEdit(false); return; }
    const b = e.target.closest('#styList .sty-swatch');
    if (b && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); dropPreset(b.dataset.id); }
  });
  d.addEventListener('toggle', e => {
    if (e.newState !== 'closed') return;
    styEdit = false;
    paintTheme();   // 저장하지 않은 미리 보기를 거둔다
    /* 바깥의 다른 것을 눌러 닫혔으면 그 초점을 빼앗지 않는다 */
    const back = document.activeElement === document.body || d.contains(document.activeElement);
    if (back && styOpener && styOpener.isConnected) styOpener.focus({ preventScroll: true });
    styOpener = null;
  });
  /* 뒤가 흐르거나 창이 바뀌면 단추를 따라간다 */
  addEventListener('scroll', () => { if (styOpen()) placeStyles(); }, true);
  addEventListener('resize', () => { if (styOpen()) placeStyles(); });
  /* 꾹 누르기(.5초) — 지우기 모드를 켠다. 뒤따르는 click 은 삼킨다. 마우스 오른쪽 단추도 같은 길 */
  let hold = 0, held = false;
  ul.addEventListener('pointerdown', e => {
    const b = e.target.closest('.sty-swatch');
    held = false;
    if (!b || e.button) return;
    hold = setTimeout(() => { held = true; if (!styEdit) { setEdit(true, b.dataset.id); navigator.vibrate?.(10); } }, 500);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => ul.addEventListener(n, () => clearTimeout(hold)));
  ul.addEventListener('contextmenu', e => {
    const b = e.target.closest('.sty-swatch');
    if (!b) return;
    e.preventDefault();
    if (!styEdit) setEdit(true, b.dataset.id);
  });
  d.addEventListener('click', e => {
    const b = e.target.closest('#styList .sty-swatch'), idea = e.target.closest('#stySug .sty-swatch');
    if (b) {
      if (held) { held = false; return; }
      styEdit ? dropPreset(b.dataset.id) : wearPreset(b.dataset.id);
    } else if (idea) {
      useIdea(idea.dataset);
    } else if (e.target.closest('#styShuffle')) {
      $('#styPick input[name="accent"]').value = fitColour(THEME[0], Math.random() * 360, .8, .6, 1);
      previewPick();
      fillSug();
    } else if (e.target.closest('#styUndo') && styleGone) {
      const list = readStyles();
      list.splice(styleGone.i, 0, styleGone.s);
      writeStyles(list.slice(0, STYLE_MAX));
      const id = styleGone.s.id;
      styleGone = null;
      $('#styNote').textContent = '';
      fillStyles(id);
    } else if (e.target.closest('#styReset')) {
      act({ act: 'theme', reset: true });
      fillStyles();
      $('#styNote').textContent = t('styleResetDone');
      $('#styHead').focus({ preventScroll: true });
    } else if (styEdit) {
      setEdit(false);   // 완료 단추나 판의 빈 곳 — 지우기 모드를 끈다
    }
  });
}

/* ── 도우미 봇 ───────────────────────────────────────────
   Grok 봇은 홈의 도우미고, 로고 안에 산다. 나올 때는 로고 점이 로고를 채우고 그 뒤에서
   걸어 나온다(emerge).
   가입하고 처음 홈에 오면(auth.js 가 새 계정에만 rt.rescue 를 남긴다) 넵바만 두고 홈을
   어둡게 덮은 채 채워진 로고 뒤에서 꺼내 달라고 조른다. 로고를 끌어내리거나 누르면
   (키보드는 로고에서 ↓) 나와서 화면 오른쪽에서부터 한 번만 둘러보기를 한다.
   로그인하고 돌아온 홈에서는(auth.js 가 rt.greet 를 남긴다) 먼저 나와 인사하고 로고로
   들어간다(greetIn). 그 밖에는 로고를 꾹 눌러 점이 로고를 채운 뒤, 로고 밖 아래로
   끌어내야만 나온다(wireLogo). 자세한 플레이 방법은 소개 페이지(data/howto.json)가 맡는다.
   누르면 말풍선에 입력칸이 열려 대화한다(아래 '대화' 절). */
const RESCUE_KEY = 'rt.rescue';
/* 봇 크기. 내 계정의 Size(70~130%)가 rt.botsize 에 남긴다 — 이 기기에만 둔다.
   CSS 는 --bot-scale(계정 미리보기)과 --rk-bot(홈 봇 한 변)을 읽고, 자리 셈은 BOT 를 쓴다 */
const botScale = () => { try { const v = +localStorage.getItem('rt.botsize'); return v >= .7 && v <= 1.3 ? v : 1; } catch { return 1; } };
let BOT = 80;
function sizeBot() {
  const k = botScale();
  BOT = Math.round(80 * k);
  document.documentElement.style.setProperty('--bot-scale', k);
  document.documentElement.style.setProperty('--rk-bot', BOT + 'px');
}
sizeBot();
const layer = $('#rkLayer'), bubble = $('#rkSay'), dim = $('#rkDim'), next = $('#rkNext'), skip = $('#rkSkip');
const logo = () => $('#regions .navbar .nav-logo');
const regionsOn = () => $('#regions').classList.contains('on');
const botName = () => { try { return localStorage.getItem('rt.botname') || 'Grok'; } catch { return 'Grok'; } };
let bot = null, making = null, out = false, intro = false, touring = false, corner = 0, hush = 0, nap = 0, chatting = false;
let progT = 0, progAt = 0, progKind = '', progHide = 0;   // 말풍선 진행 막대(progStart)
/* 폰 — 봇이 로고 안에 살고 불러야 나온다. 태블릿은 손가락 화면(fingers)이라도 데스크톱처럼
   봇이 제 발로 나와 귀퉁이에서 잔다. 창 폭이 아니라 기기 화면의 짧은 변으로 가른다 */
const phone = () => fingers() && Math.min(screen.width, screen.height) < 600;
/* aim — 폰 안내에서 말풍선이 가리키는 것(테두리가 둘린다). skipping — 둘러보기를 닫았다 */
let aim = null, skipping = false;
function aimAt(el) {
  if (aim) aim.classList.remove('rk-aim');
  aim = el || null;
  if (aim) aim.classList.add('rk-aim');
}

/* 경쟁전 빛깔은 봇의 빛깔이다 — 아래 줄의 '경쟁전 시작'도, 말풍선도 모두 --rk-on 을
   딴다. 계정 화면에서 고른 색이 없으면 --buddy-ink 가 --ranked 로 내려오므로 옛 빨강
   그대로다.
   --rk-ink 는 그 빛깔 위에 얹을 글자색이다. 고를 수 있는 열둘이 먹(#0a0a0c)에서
   크림(#f1efe9)까지 걸쳐 있어 흰 글자 하나로는 못 덮는다 — 밝기를 재서 고른다. */
const luma = c => {
  const hex = /^#?([0-9a-f]{6})$/i.exec(c);
  const [r, g, b] = hex ? [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16))
    : (c.match(/\d+/g) || [200, 50, 42]).slice(0, 3).map(Number);
  return (.2126 * r + .7152 * g + .0722 * b) / 255;
};
function paintTint(host) {
  const ink = getComputedStyle(host).getPropertyValue('--buddy-ink').trim();
  if (!ink) return;
  const st = document.documentElement.style;
  st.setProperty('--rk-on', ink);
  st.setProperty('--rk-ink', luma(ink) > .55 ? 'var(--on-accent)' : '#fff');
  /* 말풍선과 겹치는 곳의 봇 테두리 — 같은 빛깔의 어두운 쪽. 먹처럼 이미 아주 어두운
     빛깔은 더 어둡게 해도 안 보이니 살짝 밝힌 쪽을 쓴다 */
  st.setProperty('--rk-ring', luma(ink) < .12 ? `color-mix(in srgb, ${ink} 70%, #fff)` : `color-mix(in srgb, ${ink} 55%, #000)`);
}

function makeBot() {
  making = making || (window.RT_BUDDY_P || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href)).then(({ mountBuddy }) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'rk-bot';
    el.setAttribute('aria-label', botName());
    const motion = document.createElement('span');
    motion.className = 'rk-bot-motion';
    el.append(motion);
    bubble.before(el);
    const face = readFace();
    const api = mountBuddy(motion, { calm, shape: face.shape, expression: face.expression });
    if (face.colour) api.setColour(face.colour);
    paintTint(motion);
    const ring = $('#rkRing');
    ring.setAttribute('viewBox', api.node.getAttribute('viewBox'));
    ring.firstElementChild.setAttribute('href', '#' + api.bodyId);
    bot = { el, api, x: 0, y: 0 };
    el.addEventListener('click', () => {
      if (dragged) { dragged = false; return; }
      if (intro) pull();
      else if (!touring) chatting ? endChat() : chat();
    });
    el.addEventListener('pointerdown', e => grab(e));
    el.addEventListener('keydown', e => nudge(e));
    el.addEventListener('pointerenter', wake);
    el.addEventListener('focus', () => { if (el.matches(':focus-visible')) wake(); });
    el.addEventListener('pointerleave', doze);
    el.addEventListener('blur', doze);
    return bot;
  });
  return making;
}
/* ── 끌어 옮기기 ── 5px 넘게 끌면 옮기는 것이고, 그보다 적으면 누른 것(인사)이다.
   놓은 자리(spot)에 머물다 창이 바뀌면 화면 안으로 당겨 온다. 조르거나 둘러보는
   동안에는 옮기지 않는다. 키보드는 봇에 초점을 두고 화살표(Shift 면 크게) */
let spot = null, dragged = false;
const docked = () => !!bot && bot.el.parentNode === $('#sheetBot');
/* 폰은 상태바 밑(로고 윗선)부터 아래 독 윗선까지만 선다. 독(z 7)이 이 층(z 5) 위라 그 밑으로 들어간 봇은 가려지고,
   말풍선의 '다음'도 눌리지 않는다. 상태바 칸은 Safari 가 fixed 를 그리지 않는다 */
function room() {
  if (!phone()) return [0, innerHeight];
  const d = $('#tabDock');
  return [logo().getBoundingClientRect().top, d && d.offsetHeight ? d.getBoundingClientRect().top - 8 : innerHeight];
}
const clampXY = (x, y) => {
  const [top, low] = room();
  return [Math.max(0, Math.min(innerWidth - BOT, x)), Math.max(top, Math.min(low - BOT, y))];
};
function moveTo(x, y) {
  spot = clampXY(x, y);
  place(...spot);
}
/* 사람이 끌어다 놓은(키보드로 옮긴) 자리는 이 기기에 남는다 — 다시 들어오거나 새로고침해도
   폰이 아니면 봇은 귀퉁이가 아니라 거기서 깨고 잔다 */
const SPOT_KEY = 'rt.botspot';
function keepSpot() { try { localStorage.setItem(SPOT_KEY, JSON.stringify(spot)); } catch {} }
function keptSpot() {
  try { const v = JSON.parse(localStorage.getItem(SPOT_KEY)); return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? clampXY(...v) : null; } catch { return null; }
}
function grab(e) {
  if (e.button || intro || touring || docked()) return;
  const el = bot.el, sx = e.clientX, sy = e.clientY, ox = bot.x, oy = bot.y;
  let moving = false;
  el.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moving && Math.hypot(dx, dy) < 5) return;
    if (!moving) { moving = true; el.classList.add('is-held'); wake(); }
    moveTo(ox + dx, oy + dy);
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    if (!moving) return;
    el.classList.remove('is-held');
    /* 뒤따라오는 click 은 인사가 아니다. click 이 안 오는 경우를 위해 한 박자 뒤 푼다 */
    dragged = true;
    setTimeout(() => { dragged = false; }, 0);
    keepSpot();
    doze();
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
function nudge(e) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d || intro || touring || docked()) return;
  e.preventDefault();
  const step = e.shiftKey ? 96 : 24;
  moveTo(bot.x + d[0] * step, bot.y + d[1] * step);
  keepSpot();
}

/* 말풍선은 봇 뒤에서 펼쳐진다. 봇이 화면 왼쪽 3분의 1에 있으면 오른쪽으로, 오른쪽
   3분의 1이면 왼쪽으로, 가운데면 위쪽 반에선 아래로(로고에서 내려올 때), 아래쪽 반에선
   위로. 봇 쪽 끝은 봇 몸 한가운데 밑에 숨고, 그만큼 글은 안쪽 여백(style.css)으로 비킨다 */
function sideOf(cx, cy) {
  if (cx < innerWidth / 3) return 'right';
  if (cx > innerWidth * 2 / 3) return 'left';
  return cy > innerHeight / 2 ? 'up' : 'down';
}
function place(x, y) {
  /* 시트에 앉은 봇은 자리를 시트가 정한다 — 재기만 하고, 말풍선은 봇 위로 통째로 띄운다
     (봇이 시트 층에 있어 말풍선 밑에 숨을 수 없다) */
  const dock = docked(), r = dock && bot.el.getBoundingClientRect(), size = dock ? r.width : BOT;
  if (dock) { x = r.left; y = r.top; }
  else bot.el.style.transform = `translate3d(${x}px,${y}px,0)`;
  bot.x = x; bot.y = y;
  bubble.toggleAttribute('data-dock', dock);
  /* 안내 중인 폰은 봇이 시트에 묶여 못 날아간다 — 말풍선이 대신 가리키는 것(aim) 곁에
     선다. 위쪽 반에 있으면 그 밑에, 아니면 그 위에. 시트 안의 것은 시트 위로 비켜
     가리지 않는다 */
  const a = dock && aim && aim.getBoundingClientRect(), inSheet = a && aim.closest('#regions .nav-bot, #tabDock');
  const low = a && !inSheet && a.top + a.height / 2 < innerHeight / 2;
  const cx = a ? a.left + a.width / 2 : x + size / 2, cy = y + size / 2;
  let side = dock ? (low ? 'down' : 'up') : greetSide || sideOf(cx, cy);
  const was = bubble.dataset.side;
  bubble.dataset.side = side;
  const w = bubble.offsetWidth, [rTop, rBot] = room();
  let h = bubble.offsetHeight;
  /* 폰은 독 윗선 위 칸이 모자라 옆에 펼친 말풍선이 밀려 오르면 봇이 그 밑 '다음'을 가린다 — 봇 위로 접는다 */
  if (phone() && !dock && (side === 'left' || side === 'right') && cy + h / 2 > rBot) {
    side = 'up'; bubble.dataset.side = side; h = bubble.offsetHeight;
  }
  const turned = was !== side;
  const bx = side === 'right' ? cx : side === 'left' ? cx - w : cx - w / 2;
  const by = a ? (low ? a.bottom + 12 : (inSheet ? inSheet.getBoundingClientRect() : a).top - h - 12)
    : dock ? y - h - 10 : side === 'down' ? cy : side === 'up' ? cy - h : cy - h / 2;
  const fx = Math.max(16, Math.min(innerWidth - w - 16, bx)), fy = Math.max(rTop, 16, Math.min(rBot - h - (phone() ? 0 : 16), by));
  bubble.style.transform = `translate3d(${fx}px,${fy}px,0)`;
  /* 테두리는 말풍선 안에서 봇 자리에 선다 */
  bubble.style.setProperty('--ring-x', x - fx + 'px');
  bubble.style.setProperty('--ring-y', y - fy + 'px');
  /* 말하는 채로 반대편으로 끌려가면 새 방향으로 다시 펼친다 */
  if (turned && !bubble.hidden) unfold();
}
/* 날지 않고 그 자리에 선다 — 처음 나타날 때 */
function jump(x, y) {
  const m = bot.el.firstElementChild;
  bot.el.style.transition = bubble.style.transition = m.style.transition = 'none';
  place(x, y);
  void bot.el.offsetWidth;
  bot.el.style.transition = bubble.style.transition = m.style.transition = '';
}
function tell(key, vars, form) { speak(t(key, vars), form); }
function speak(text, form) {
  $('#rkSayText').textContent = text;
  $('#rkName').hidden = !form;
  $('#rkChat').hidden = !chatting;
  const chips = $('#rkChips');
  if (chips) chips.hidden = !(chatting && !$('#rkChat').classList.contains('is-thinking') && !$('#rkChat').classList.contains('is-busy'));
  clearTimeout(closing);
  bubble.classList.remove('is-closing');
  bubble.hidden = false;
  if (bot) place(bot.x, bot.y);
  unfold();
}
/* 펼치기는 다음 프레임에. 말풍선은 미끄러져 오지 않고 그 자리(봇 뒤)에서 펼쳐진다 —
   남은 이동은 끊고 끝자리로 옮긴 뒤 펼친다 */
function unfold() {
  bubble.classList.remove('is-open');
  requestAnimationFrame(() => {
    bubble.style.transition = 'none';
    void bubble.offsetWidth;
    bubble.style.transition = '';
    bubble.classList.add('is-open');
  });
}
/* 접을 때는 흐려지며 사라진다 — 다 흐려진 뒤에 hidden 을 건다. 그 사이에 speak 가 다시
   열면 취소한다. 움직임을 줄였으면 바로 숨긴다 */
let closing = 0;
function hide() {
  chatting = false;
  greetSide = null;
  setTalkUI(null);
  clearInterval(progT); clearTimeout(progHide);
  $('#rkProg').hidden = true;
  /* 추천 버튼은 말풍선과 함께 흐려진다 — 접히는 240ms 동안 먼저 사라지면 풍선이 줄어들며 깜빡인다.
     setTalkUI(null) 도 칩은 건드리지 않으니 풍선이 정말 숨는 자리(아래 둘)에서 같이 숨긴다 */
  const chips = $('#rkChips');
  clearTimeout(closing);
  if (bubble.hidden || calm()) { bubble.classList.remove('is-open', 'is-closing', 'is-busy'); bubble.hidden = true; if (chips) chips.hidden = true; return; }
  bubble.classList.remove('is-open');
  bubble.classList.add('is-closing');
  closing = setTimeout(() => { bubble.hidden = true; if (chips) chips.hidden = true; bubble.classList.remove('is-closing', 'is-busy'); }, 240);
}

/* 폰이 아니면 봇은 귀퉁이에서 잔다 — 넵바 아래 두 곳과 화면 아래 두 곳 */
function cornerAt(i) {
  /* 좁은 창(폰 폭)에서는 위 귀퉁이가 지도 머리(도봉·노원)를 덮는다 — 아래 막대 위 두 곳에만 앉는다 */
  if (narrow() && i < 2) i += 2;
  const top = $('#regions .navbar').getBoundingClientRect().bottom + 12;
  const x = i % 2 ? innerWidth - BOT - 20 : 20;
  /* 아래 막대와 겹치는 아래 귀퉁이는 막대 위로 올린다 */
  const dock = $(fingers() ? '#tabDock' : '#regions .nav-bot').getBoundingClientRect();
  const low = x < dock.right && x + BOT > dock.left ? dock.top - BOT - 8 : innerHeight - BOT - 24;
  return [x, i < 2 ? top : Math.min(innerHeight - BOT - 24, low)];
}
const narrow = () => !phone() && innerWidth < 760;
/* 인사하는 자리. 폰이 아니면 말풍선이 도트를 덮지 않는 곳 — 로고 밑 가운데는 지도 머리(도봉)를
   덮는다. 위 두 귀퉁이에서 말풍선을 아래·안쪽으로 펴 보고, 봇과 말풍선이 도트 하나라도 덮으면
   다음 자리를 본다. 다 덮으면 null(로고 밑 그대로) */
const GREET_W = 300, GREET_H = 72;
function greetSpot() {
  if (phone()) return null;
  const dots = [...document.querySelectorAll('#courseBtns .course-map')]
    .filter(el => parseFloat(getComputedStyle(el).opacity) >= .5)
    .flatMap(el => [...el.querySelectorAll('circle')].map(c => c.getBoundingClientRect()));
  if (!dots.length) return null;
  const hits = (l, t, r, b) => dots.some(d => d.left < r && d.right > l && d.top < b && d.bottom > t);
  const clampX = x => Math.max(16, Math.min(innerWidth - GREET_W - 16, x));
  for (const [x, y] of [cornerAt(1), cornerAt(0)]) {
    const cx = x + BOT / 2, cy = y + BOT / 2;
    for (const [side, bx, by] of [['down', clampX(cx - GREET_W / 2), cy], ['left', cx - GREET_W, cy - GREET_H / 2],
                                  ['right', cx, cy - GREET_H / 2]]) {
      if (bx < 16 || bx + GREET_W > innerWidth - 16) continue;
      if (!hits(x, y, x + BOT, y + BOT) && !hits(bx, by, bx + GREET_W, by + GREET_H)) return { at: [x, y], side };
    }
  }
  return null;
}
let greetSide = null;
/* 제 발로 나온 봇이 서는 곳 — 로고 바로 밑 가운데 */
function underLogo() {
  const r = logo().getBoundingClientRect();
  return [Math.max(16, Math.min(innerWidth - BOT - 16, r.left + r.width / 2 - BOT / 2)), r.bottom + 8];
}
/* 로고 점 자리 — 로고를 채우는 원(style.css 의 .nav-logo::before)이 여기서 커진다 */
function markDot() {
  const el = logo(), d = el.querySelector('.dot');
  if (!d) return;
  const r = el.getBoundingClientRect(), p = d.getBoundingClientRect();
  el.style.setProperty('--dot-x', (p.left + p.width / 2 - r.left).toFixed(1) + 'px');
  el.style.setProperty('--dot-y', (p.top + p.height / 2 - r.top).toFixed(1) + 'px');
  el.style.setProperty('--dot-r', (p.width / 2).toFixed(1) + 'px');
}

/* 말풍선 상태 — sleep / input / thinking / response / busy·fail (Figma 124:90–189).
   잠김·수면 같은 속말은 쓰지 않는다. busy 일 때 입력만 막고 thinking placeholder 는 botThink */
function setTalkUI(mode) {
  const form = $('#rkChat'), chips = $('#rkChips'), inp = $('#rkChatIn');
  const go = form && form.querySelector('button[type="submit"]');
  if (!form || !inp) return;
  const busy = mode === 'thinking' || mode === 'busy';
  form.classList.toggle('is-thinking', mode === 'thinking');
  form.classList.toggle('is-busy', mode === 'busy');
  bubble.classList.toggle('is-busy', mode === 'busy');
  inp.disabled = busy;
  if (go) go.disabled = busy;
  inp.placeholder = t(mode === 'thinking' ? 'botThink' : 'botChatPh');
  if (chips && mode !== null) chips.hidden = !(chatting && !busy);   // null 은 접는 중 — 칩은 hide() 가 풍선과 함께 숨긴다
}

function sleep() {
  /* 폰은 로고로 도로 들어간다. 그 밖에는 끌어다 놓은 자리나 귀퉁이에서 잔다 */
  if (phone()) { tuck(); return; }
  if (!spot) {
    const k = keptSpot();
    if (k) moveTo(...k); else { corner = Math.floor(Math.random() * 4); place(...cornerAt(corner)); }
  }
  hide();
  bot.el.classList.add('is-asleep');
  /* 엔진의 sleep 은 눈 없는 작은 점이다. 홈 봇은 몸을 그대로 두고 눈만 감는다 —
     시선을 떨구며 감고(buddy.js 의 doze), 다 감기면 ‿ 가 얹힌다(style.css) */
  bot.api.setState('idle');
  bot.api.doze(true);
}
function wake() {
  if (!bot || intro || touring) return;
  clearTimeout(nap);
  bot.el.classList.remove('is-asleep');
  bot.api.setState('idle');
  bot.api.doze(false);
}
function doze() {
  if (!bot || intro || touring) return;
  clearTimeout(nap);
  nap = setTimeout(() => {
    if (!touring && bubble.hidden && !bot.el.matches(':hover, :focus-within, :focus-visible')) sleep();
  }, 1500);
}
/* 떠 있지 않으면 폰은 로고에서 걸어 나오고, 그 밖에는 아무 귀퉁이에서 깨어난다 */
async function summon() {
  await makeBot();
  if (out) return;
  out = true;
  layer.hidden = false;
  bot.api.start();
  spot = null;
  wake();
  if (phone()) { await emerge(); return; }
  const k = keptSpot();
  if (k) { spot = k; jump(...k); return; }
  corner = Math.floor(Math.random() * 4);
  jump(...cornerAt(corner));
}
/* 로고 뒤 숨는 자리. 폰은 봇이 작아지지 않고 제 크기 그대로 경기장꼴 로고 뒤에 숨는다 —
   발끝을 로고 아랫변에 맞춰 두면 거기서 미끄러져 내려온다 */
function behind() {
  const r = logo().getBoundingClientRect();
  return [r.left + r.width / 2 - BOT / 2, fingers() ? r.bottom - BOT : r.top + r.height / 2 - BOT / 2];
}
/* 로고 한가운데에 작게 숨은 채 선다. 로고 점이 로고를 채우고(rk-emerge) 넵바가 봇 층
   위로 올라, 채워진 로고 뒤에서 빠져나오는 것처럼 보인다 */
function stow() {
  markDot();
  document.body.classList.add('rk-emerge');
  bot.el.classList.add('is-in');
  jump(...behind());
  bot.el.classList.remove('is-in');
}
async function emerge() {
  stow();
  /* jump 이 스타일을 한 번 확정해 두어 여기서 바로 옮겨도 미끄러져 나온다 */
  place(...underLogo());
  await new Promise(res => setTimeout(res, Math.max(60, siDurMs())));
  if (out) document.body.classList.remove('rk-emerge');
}
/* 할 일이 끝나면 로고로 도로 들어가 숨는다. 들어가는 사이 다시 불리면(summon)
   out 이 켜져 숨기지 않는다 */
function tuck() {
  hide();
  out = false;
  spot = null;
  if (bot.el.contains(document.activeElement)) logo().focus({ preventScroll: true });
  markDot();
  document.body.classList.add('rk-emerge');
  bot.el.classList.add('is-in');
  place(...behind());
  setTimeout(() => {
    if (out) return;
    document.body.classList.remove('rk-emerge');
    layer.hidden = true;
    bot.api.stop();
  }, calm() ? 0 : siDurMs());
}
/* 둘러보기 밖에서 하는 말. 이름 칸을 연 말이 아니면 조금 뒤 접고 다시 잔다 */
async function say(key, vars, form) {
  await summon();
  if (!touring) wake();
  tell(key, vars, form);
  clearTimeout(hush);
  if (!form && !touring) hush = setTimeout(() => { hide(); doze(); }, 6000);
}

/* ── 대화 ── 봇을 누르면 말풍선에 입력칸이 열린다. 중계기(/bot/chat)가 NVIDIA 모델에
   묻고 {say, do} 를 돌려준다. do 는 중계기가 이미 걸렀지만 여기서도 아는 것만 한다.
   대화는 이 탭에서만 기억한다(새로고침하면 처음부터) */
const talk = [];
let talkReq = 0;
async function chat() {
  await summon();
  wake();
  clearTimeout(hush);
  chatting = true;
  setTalkUI('input');
  speak(talk.length ? talk[talk.length - 1].content : t('botAsk', { bot: botName() }));
  $('#rkChatIn').focus({ preventScroll: true });
}
function endChat() {
  if (!chatting) return;
  progStop();
  /* 폰은 대화를 닫으면 곧바로 로고로 들어간다 */
  if (phone()) { tuck(); return; }
  hide();
  bot.el.focus({ preventScroll: true });
  doze();
}
/* 봇이 고를 수 있는 코스 — 홈 칸과 서울 전체. 같은 코스를 치는 칸은 하나로 */
function botCourses() {
  const seen = new Set(), list = [];
  for (const [slug, label] of [[COURSE.root, homeTitle()], ...COURSE.tiles.map(x => [x.slug, x.label])]) {
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    list.push({ slug, label });
  }
  return list;
}
/* 봇이 지금 형편을 알고 답하게 — 화면·설정·로그인·내 전적. 설정은 settings.js 가 막 고쳤을 수 있어 통에서 새로 읽는다 */
function botNow() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem('rt.opt') || '{}'); } catch {}
  return { opt: { ...DEF, ...o }, page: page || 'home', signed: !!token(), named: !!readName(), dev: DEV,
           rec: token() ? botRec.v : null };
}
/* 내 전적 — 기록 화면과 같은 /games 를 대화 한 번에 많아야 1분에 한 번 읽는다. 못 읽으면 없이 묻는다 */
async function botRec() {
  if (!token() || Date.now() - botRec.at < 60000) return;
  botRec.at = Date.now();
  try {
    const d = await ask(`/games?dev=${DEV}`), lad = d.ladder;
    botRec.v = { tier: lad ? tierName(lad.lp, lad.games) : '', lp: lad?.lp || 0, games: lad?.games || 0,
                 wins: lad?.wins || 0, rank: lad?.rank || 0,
                 last: d.games.slice(0, 5).map(g => ({ mode: g.mode, where: placeOf(g.slug), secs: g.secs, cpm: g.cpm, acc: g.acc, delta: g.delta })) };
  } catch {}
}
botRec.at = 0; botRec.v = null;
/* 스타일 — 고칠 수 있는 색은 이 표가 전부다. 사람이 고르든(내 스타일 › 색 직접 고르기) 봇이 고르든
   (theme act) 같은 rt.theme 에 key 로 담기고, 여기 없는 것 — 초점 테두리·--on-accent·경쟁전 빨강·
   --bad 처럼 상태를 알리는 색 — 은 누구도 못 바꾼다. 한 줄 더하면 새 색이 열린다(화면 말은 i18n 의 color_<key>).
   def  style.css :root 의 낮 값(고르기 칸의 첫 값·대비 셈의 바탕). 거기를 고치면 같이 고친다
   night  밤에도 입히나. false 면 밤엔 사이트의 밤 값을 둔다(낮 바탕을 밤에 깔지 않게)
   on·min  그 색과 맞닿는 글자색(#값 또는 다른 key)과 지켜야 할 대비. 못 미치면 저장하지 않는다
   also  그 색에서 따라 나오는 값들. 중계기(worker.mjs 의 botTheme)는 accent·block 만 받는다 */
const THEME = [
  { key: 'accent', def: '#f0a03c', night: true, on: '#232c31', min: 4.5, also: { '--accent-deep': v => `color-mix(in srgb,${v} 82%,#000)` } },
  { key: 'block', def: '#6f9a9e', night: true, on: '#ffffff', min: 3, also: { '--block-hi': v => `color-mix(in srgb,${v} 88%,#000)` } },
  { key: 'bg', def: '#e8edf0', night: false, on: 'ink', min: 4.5,
    also: { '--grid': v => `color-mix(in srgb,${v} 92%,var(--ink))`, '--land': v => `color-mix(in srgb,${v} 86%,var(--ink))`,
            '--land-line': v => v, '--card': v => `color-mix(in srgb,${v} 45%,#fff)` } },
  { key: 'ink', def: '#3c464a', night: false, also: { '--ink-soft': v => `color-mix(in srgb,${v} 78%,var(--bg))` } },
];
const HEX = /^#[0-9a-f]{6}$/;
const pickTheme = th => Object.fromEntries(THEME.filter(k => HEX.test(th?.[k.key])).map(k => [k.key, th[k.key]]));
const lum = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
/* 대비가 모자란 색들 — [{ key, r, min }]. 안 고른 색은 기본값으로 잰다 */
const themeLow = th => {
  const v = key => HEX.test(key) ? key : th[key] || THEME.find(k => k.key === key).def;
  return THEME.filter(k => k.on).map(k => ({ key: k.key, r: contrast(v(k.key), v(k.on)), min: k.min })).filter(x => x.r < x.min);
};
/* rt.theme 을 규칙 한 장으로. 밤에도 입히는 것과 낮에만 입히는 것을 가른다 */
const themeCss = th => {
  const both = [], day = [];
  for (const k of THEME) {
    const v = th[k.key];
    if (HEX.test(v)) (k.night ? both : day).push(`--${k.key}:${v}`, ...Object.entries(k.also || {}).map(([p, f]) => `${p}:${f(v)}`));
  }
  return (both.length ? `:root,:root[data-night]{${both.join(';')}}` : '') + (day.length ? `:root:not([data-night]){${day.join(';')}}` : '');
};
/* :root 에 얹는다. 첫 그림 전엔 index.html 의 머리 스크립트가 rt.themeCss 를 그대로 붙인다.
   draft 를 주면 저장하지 않고 미리 보기만 한다 */
function paintTheme(draft) {
  const css = themeCss(pickTheme(draft || curTheme()));
  let el = $('#rtTheme');
  if (!el) { el = document.createElement('style'); el.id = 'rtTheme'; document.head.append(el); }
  el.textContent = css;
  if (!draft) try { css ? localStorage.setItem('rt.themeCss', css) : localStorage.removeItem('rt.themeCss'); } catch {}
}
const PAGE_LINK = { settings: 'settings/', community: 'community/', about: 'about/' };
function act(a) {
  if (a.act === 'duel' && botCourses().some(x => x.slug === a.course)) { go(a.course, true); return; }
  if (a.act === 'post') {
    /* 초안만 — 커뮤니티 화면이 받아 글쓰기 칸에 채워 열고, 올리기는 사람이 누른다 */
    try { sessionStorage.setItem('rt.cmDraft', JSON.stringify({ tag: a.tag, title: a.title, body: a.body })); } catch { return; }
    act({ act: 'open', page: 'community' });
    return;
  }
  if (a.act === 'look') {
    const face = readFace();
    for (const k of ['shape', 'expression', 'colour']) if (a[k]) face[k] = a[k];
    try { localStorage.setItem('rt.character', JSON.stringify(face)); } catch { return; }
    leftAccount();
    return;
  }
  if (a.act === 'theme') {
    try {
      if (a.reset) localStorage.removeItem('rt.theme');
      else localStorage.setItem('rt.theme', JSON.stringify({ ...JSON.parse(localStorage.getItem('rt.theme') || '{}'), ...a, act: undefined }));
    } catch { return; }
    paintTheme();
    return;
  }
  if (a.act === 'start' && botCourses().some(x => x.slug === a.course)) {
    /* 경쟁전은 꾹 누른 시작하기와 같은 길(go) — 로그인·이름이 없으면 봇이 그걸 조른다 */
    if (a.ranked) { go(a.course); return; }
    hide();
    doze();
    start(a.course);
  } else if (a.act === 'set') {
    /* 설정 통의 주인은 settings.js 다 — 거기서 저장하고 화면에 알린다 */
    dispatchEvent(new CustomEvent('rt-bot-opt', { detail: { [a.key]: a.value } }));
  } else if (a.act === 'open') {
    if (PAGES.includes(a.page)) { openPage(a.page); return; }
    if (a.page === 'styles') { openStyles(document.body); return; }
    if (a.page === 'feedback') { openFeedback(); return; }
    if (a.page === 'home') { closePage(); return; }
    if (a.page === 'signin') { $('#signinLink').click(); return; }
    /* 설정은 제 손(settings.js)이 링크 click 을 받아 덮개로 연다 */
    const link = PAGE_LINK[a.page] && document.querySelector(`#regions a[href="${PAGE_LINK[a.page]}"], #tabDock a[href="${PAGE_LINK[a.page]}"]`);
    if (link) link.click();
  }
}
/* ── 진행 막대 ── 봇이 답을 짓는 동안 말풍선 안에 둔다. 한 번 묻고 한 번 받는 길이라 참 진행률은 없다:
   막대는 어림(PROG_MS 쯤에 80% — 90% 밑에서 멈추고 답이 오면 100%)이고, 옆의 초가 실제로 흐른 시간이다.
   스타일 물음은 더 오래 걸리니 단계 글을 셋 돌리고, 답에 스타일이 실려 오면 '적용 → 저장됨' 까지 보인다 */
const STYLE_ASK = /스타일|느낌|분위기|테마|색깔|색감|꾸며|컨셉|무드|style|theme|vibe|mood|aesthetic|colou?rs?\b/i;
const PROG_MS = { style: 20000, talk: 8000 };
function progPaint(v, step) {
  const bar = $('#rkProgBar');
  bar.setAttribute('aria-valuenow', String(Math.round(v)));
  bar.firstElementChild.style.transform = `scaleX(${v / 100})`;
  if (step && $('#rkProgStep').textContent !== step) $('#rkProgStep').textContent = step;
}
function progStart(text) {
  clearInterval(progT); clearTimeout(progHide);
  progKind = STYLE_ASK.test(text) ? 'style' : 'talk';
  progAt = Date.now();
  $('#rkProg').hidden = false;
  $('#rkProg').classList.remove('is-done');
  $('#rkProgSec').textContent = '';
  progPaint(0, t(progKind === 'style' ? 'botProgRead' : 'botProgThink'));
  if (bot) place(bot.x, bot.y);
  progT = setInterval(() => {
    const ms = Date.now() - progAt, v = 92 * (1 - Math.exp(-2 * ms / PROG_MS[progKind]));
    const step = progKind !== 'style' ? null : t(v < 35 ? 'botProgRead' : v < 65 ? 'botProgColour' : 'botProgLook');
    progPaint(v, step);
    $('#rkProgSec').textContent = t('botProgSec', { n: Math.floor(ms / 1000) });
  }, 250);
}
function progStop() {
  clearInterval(progT); clearTimeout(progHide);
  $('#rkProg').hidden = true;
  if (bot && !bubble.hidden) place(bot.x, bot.y);
}
/* 답이 왔다. 스타일이 실려 왔으면 '적용하는 중' 으로 가득 채운 뒤 '저장됨' 을 잠깐 보이고 접는다 */
function progDone(styled) {
  clearInterval(progT);
  if (!styled) { progPaint(100); progHide = setTimeout(progStop, 300); return; }
  progPaint(100, t('botProgApply'));
  progHide = setTimeout(() => {
    $('#rkProg').classList.add('is-done');
    $('#rkProgStep').textContent = t('botProgDone');
    progHide = setTimeout(progStop, 2200);
  }, 450);
}
async function send(text) {
  talk.push({ role: 'user', content: text });
  const my = ++talkReq;
  setTalkUI('thinking');
  speak(t('botThink'));
  progStart(text);
  await botRec();
  let d;
  try {
    d = await ask('/bot/chat', { msgs: talk.slice(-12), courses: botCourses(), lang: document.documentElement.lang, name: botName(), now: botNow() }, true);
  } catch (e) {
    talk.pop();
    if (my === talkReq) progStop();
    if (my === talkReq && chatting) {
      setTalkUI('busy');
      speak(t(e.status === 429 ? 'botBusy' : 'botChatFail'));
    }
    return;
  }
  if (my !== talkReq) return;
  progDone((d.do || []).some(a => a.act === 'theme' && !a.reset));
  const said = d.say || '👍';
  talk.push({ role: 'assistant', content: said });
  if (chatting) {
    setTalkUI('response');
    speak(said);
  }
  /* 동작은 말을 보여 준 뒤에 — 무엇을 하려는지 먼저 읽힌다 */
  (d.do || []).forEach(act);
  keepStyle(d.do || []);
}
/* 대화에서 피드백 판을 열면 막 오간 두 마디(보낸 말, 봇이 못 한다고 한 답)를 담아 둔다 —
   무엇이 안 됐는지 다시 적지 않게. 이미 적어 둔 글은 덮지 않는다.
   첫 줄은 중계기가 이슈 제목으로 쓰니(compose) 보낸 말을 라벨 없이 그대로 둔다 */
function openFeedback() {
  const box = $('#fbBody'), b = talk.at(-1), u = talk.at(-2);
  if (box && !box.value.trim() && b?.role === 'assistant' && u?.role === 'user')
    box.value = (`${u.content}\n${botName()}: ${b.content}\n\n`).slice(0, box.maxLength);
  $('[data-fb-open]')?.click();
  /* 커서는 담은 글 뒤 빈 줄에 — 거기서 바로 덧붙인다 */
  if (box) box.setSelectionRange(box.value.length, box.value.length);
}
function wireChat() {
  $('#rkChat').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#rkChatIn'), text = inp.value.trim();
    if (!text || inp.disabled) return;
    inp.value = '';
    send(text);
  });
  $('#rkChatIn').addEventListener('keydown', e => {
    /* IME 조합 중인 Esc 는 조합을 끄는 몫이다 */
    if (e.key !== 'Escape' || e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    endChat();
  });
  $('#rkChips')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-chip]');
    if (!btn || !chatting) return;
    const chip = btn.dataset.chip;
    if (chip === 'ranked') {
      setRanked(true);
      go(rankedSlug());
      return;
    }
    if (chip === 'night') {
      const on = !document.documentElement.hasAttribute('data-night');
      dispatchEvent(new CustomEvent('rt-bot-opt', { detail: { night: on } }));
      if (on) {
        setTalkUI('response');
        speak(t('botNightOn'));
      }
      return;
    }
    if (chip === 'styles') { openStyles(btn); return; }
    if (chip === 'feedback') openFeedback();
  });
}

/* ── 처음 온 사람 ──
   로고만 밝게 두고 나머지는 .rk-dim 이 덮는다 — 넵바의 다른 칸도 어둡게 잠가(inert)
   누르지도 호버하지도 못한다. 로고 점이 로고를 채우고, 봇은 그 바로 아래에 반쯤
   숨어(넵바가 봇 층보다 위로 올라간다) 들썩이며 조른다 */
/* 폰은 봇이 시트에 살고 시작하기도 거기 있다 — 시트는 막 위로 올려(style.css) 잠그지
   않는다. 처음 온 사람이 안내를 안 보고도 바로 시작할 수 있다 */
const INTRO_LOCK = () => [...document.querySelectorAll('#regions .navbar .nav-side'), $('#sheetGrab'), $('#courseBtns'), fingers() ? null : $('#regions .nav-bot'), $('#regions .screen-head'), $('#courseName')];
function peekAt() {
  const r = logo().getBoundingClientRect();
  /* 폰은 얼굴(눈)이 로고 아랫변에 걸려 잘리지 않게 덜 숨는다 */
  return [r.left + r.width / 2 - BOT / 2, r.bottom - BOT * (phone() ? .15 : .35)];
}
async function beginIntro() {
  intro = true;
  document.body.classList.add('rk-intro');
  dim.hidden = false;
  layer.hidden = false;
  INTRO_LOCK().forEach(n => { if (n) n.inert = true; });
  markDot();
  aimNavShape(null);
  logo().setAttribute('aria-label', t('logoBot'));
  await makeBot();
  if (!intro) return;
  out = true;
  bot.el.classList.remove('is-in');
  bot.api.start();
  /* 폰은 '!'(alert)가 로고 뒤에 가려 실오라기로만 보인다 — 얼굴 그대로 들썩인다.
     시트(docked)는 v0.8.348 에서 없어졌으니 폰이냐로 가른다 */
  bot.api.setState(phone() ? 'idle' : 'alert');
  if (phone()) { aimAt(logo()); skip.hidden = false; }
  tell('botPeek');
  jump(...peekAt());
  requestAnimationFrame(peekFrame);
}
/* 넵바는 글꼴이 늦게 오거나 창이 바뀌면 자리를 옮긴다 — 조르는 동안 매 프레임 로고를
   따라간다 */
function peekFrame() {
  if (!intro) return;
  const [x, y] = peekAt();
  if (x !== bot.x || y !== bot.y) place(x, y);
  requestAnimationFrame(peekFrame);
}
function endIntro() {
  if (!intro) return;
  intro = false;
  try { localStorage.removeItem(RESCUE_KEY); } catch {}
  document.body.classList.remove('rk-intro');
  dim.hidden = true;
  aimAt(null);
  skip.hidden = true;
  logo().setAttribute('aria-label', 'regiontype');
  INTRO_LOCK().forEach(n => { if (n) n.inert = false; });
  aimNavShape(null);
}

/* ── 둘러보기 ── 한 마디마다 제 자리로 날아가 말한다. '다음'을 눌러야만 넘어간다 —
   다 읽기 전에 저절로 넘어가지 않는다 */
function near(el) {
  if (!el) return [innerWidth / 2 - BOT / 2, innerHeight * .4];
  const r = el.getBoundingClientRect();
  const x = Math.max(16, Math.min(innerWidth - BOT - 16, r.left + r.width / 2 - BOT / 2));
  /* 폰은 독 밑으로 파고들지 않게 clampXY 가 독 윗선에 세운다 */
  return clampXY(x, r.top > innerHeight / 2 ? r.top - BOT * .85 : r.bottom - BOT * .1);
}
/* 홈은 도트 지도다 — 칸 하나 대신 보이는 지도(서울, 또는 펼친 구)를 가리킨다 */
function midTile() {
  const tiles = [...document.querySelectorAll('#courseBtns .course-map')]
    .filter(el => parseFloat(getComputedStyle(el).opacity) >= .5);
  const d = el => {
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
  };
  return tiles.sort((a, b) => d(a) - d(b))[0] || null;
}
/* 뒤로는 구를 펼쳤을 때만 선다 — 숨어 있으면 그 자리(아래 막대)를 가리킨다 */
function backBar() {
  const b = $('#navBack');
  if (b && !b.hidden && b.getBoundingClientRect().width) return b;
  return $(fingers() ? '#tabDock' : '#regions .nav-bot');
}
const STEPS = [
  ['tourHi', () => [innerWidth * .72, innerHeight * .36], () => $('#sheetBot')],
  ['tourTiles', () => near(midTile()), midTile],
  ['tourShift', () => near(midTile()), midTile],
  ['tourBack', () => near(backBar()), backBar],
  ['tourPlay', () => near($('#navPlay')), () => $('#navPlay')],
  ['tourRanked', () => near($('#navPlay')), () => $('#navPlay')],
  ['tourBoard', () => near($('#tabDock a[href="#ranking"], #regions a[href="#ranking"]')), () => $('#tabDock a[href="#ranking"], #regions a[href="#ranking"]')],
  ['tourSettings', () => near($('#tabDock a[href="settings/"], #regions a[href="settings/"]')), () => $('#tabDock a[href="settings/"], #regions a[href="settings/"]')],
  ['tourBye', () => [innerWidth / 2 - BOT / 2, innerHeight * .36], () => $('#sheetBot')],
];
/* 폰 — 셋째 칸이 가리킬 것이다. 순위·설정은 접힌 시트 안에 있으니 시트를 펼쳐 보여 준다 */
function sheetTo(open) {
  const g = $('#sheetGrab');
  if (g && (g.getAttribute('aria-expanded') === 'true') !== open) g.click();
}
/* 시트가 스프링으로 오르내리는 동안 말풍선이 따라간다 */
function follow() {
  if (!touring) return;
  if (!bubble.hidden) place(bot.x, bot.y);
  requestAnimationFrame(follow);
}
/* 닫기(폰)·시작하기 — 조르든 둘러보든 거기서 끝내고 봇은 시트에서 존다 */
function quitTour() {
  if (intro) {
    /* 닫기에 있던 초점은 봇이 받는다 — 숨은 버튼에 남기지 않는다 */
    const held = document.activeElement === skip;
    endIntro(); settle();
    if (held) logo().focus({ preventScroll: true });
  }
  else if (touring) { skipping = true; advance(); }
}
let advance = () => {};
const nextPress = () => new Promise(res => { advance = res; });
function pull() {
  if (!intro) return;
  endIntro();
  tour();
}
async function tour() {
  await makeBot();
  if (touring) return;
  touring = true;
  clearTimeout(hush); clearTimeout(nap);
  if (!out) {
    out = true;
    layer.hidden = false;
    const r = logo().getBoundingClientRect();
    bot.el.classList.remove('is-in');
    jump(r.left + r.width / 2 - BOT / 2, r.top);
  }
  bot.api.start();
  bot.el.classList.remove('is-asleep');
  bot.api.setState('idle');
  bot.api.doze(false);
  next.hidden = false;
  next.focus({ preventScroll: true });
  const dock = docked(), guide = phone();
  skip.hidden = !guide;
  if (dock) follow();
  for (const [key, at, what] of STEPS) {
    if (skipping) break;
    /* 여러 구 고르기는 Shift 뿐이다 — 손가락 화면에는 그 길이 없어 건너뛴다 */
    if (key === 'tourShift' && fingers()) continue;
    /* 날아가는 동안은 입을 다물고, 내려앉은 뒤 말풍선을 펼친다 */
    hide();
    if (dock) { const el = what && what(); sheetTo(!!el && !!el.closest('#sheetMore')); aimAt(el); }
    else if (guide) aimAt(what && what());
    place(...at());
    await new Promise(res => setTimeout(res, siDurMs()));
    if (skipping) break;
    tell(key, { bot: botName() });
    /* 날아가는 동안 말풍선이 숨어 '다음'에서 초점이 빠졌다 — 돌려준다 */
    next.focus({ preventScroll: true });
    await nextPress();
  }
  next.hidden = skip.hidden = true;
  touring = skipping = false;
  if (dock) { aimAt(null); sheetTo(false); }
  else if (guide) aimAt(null);
  /* '다음'에 있던 초점은 봇이 받는다 — 숨은 버튼에 남기지 않는다 */
  if (!document.activeElement || [next, skip, document.body].includes(document.activeElement)) {
    bot.el.focus({ preventScroll: true });
  }
  settle();
}
/* 로고로 들어간다 */
function settle() {
  spot = null;
  sleep();
}

/* ── 로그인한 사람 ── 로그인하고 돌아온 홈에서 봇이 먼저 채워진 로고 뒤에서 걸어 나와
   인사하고, 조금 뒤 로고로 들어간다. 로그인 한 번에 한 번 — auth.js 가 남긴 표를 여기서
   지운다. 그 뒤로는 로고에서 끌어내야 나온다 */
const GREET_KEY = 'rt.greet', GREETED_KEY = 'rt.greeted';
async function greetIn() {
  await makeBot();
  /* 부드러운 새로고침으로 온 첫 그림은 움직임을 눌러 둔다(data-still) — 풀린 뒤에 나와야 걸어 나온다 */
  while (document.documentElement.hasAttribute('data-still')) await new Promise(r => setTimeout(r, 50));
  out = true;
  layer.hidden = false;
  bot.api.start();
  bot.api.setState('idle');
  hide();
  spot = null;
  await emerge();
  /* 폰이 아니면 지도 밖으로 비켜서 인사한다(greetSpot) */
  const g = greetSpot();
  if (g) { greetSide = g.side; place(...g.at); await new Promise(res => setTimeout(res, siDurMs())); }
  const name = token() ? readName() : '';
  tell(name ? 'botWelcomeName' : 'botWelcome', { name });
  clearTimeout(hush);
  /* 인사하는 사이 옮겨 놓았으면 그 자리에서 잔다. 아니면 로고로 들어간다 */
  hush = setTimeout(() => {
    if (touring || intro) return;
    if (spot) { hide(); doze(); } else settle();
  }, 4500);
}

/* 이 봇도 커서를 본다 — 로그인 화면·계정 화면과 같은 자(buddy.js 의 lookToward) */
addEventListener('pointermove', e => {
  if (out && bot && e.pointerType === 'mouse') bot.api.lookToward(e.clientX, e.clientY);
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { if (out && bot) bot.api.lookAway(); });
/* 폰 시트가 움직이면 거기 앉은 봇의 말풍선은 접고 다시 존다(app.js 의 sheetSet) */
addEventListener('rt-sheet', () => {
  if (!docked() || bubble.hidden || touring || intro) return;
  hide();
  doze();
});
addEventListener('resize', () => {
  if (!out || !bot || touring || intro) return;
  if (spot) moveTo(...spot); else if (phone()) place(...underLogo()); else place(...cornerAt(corner));
});

/* 로고 — 가입하고 처음 온 사람에게 봇이 조르는 동안(rk-intro)에만 봇을 꺼내는 손잡이다.
   끌어내리거나 누르면(키보드는 ↓) 나온다. 그 밖에 꾹 누르거나 끌어도 아무 일 없다 —
   폰은 로고를 누르면 그 뒤에서 나와 말을 걸고, 다시 누르면 들어간다 */
let swallowLogo = false;
function wireLogo() {
  const el = logo();
  el.addEventListener('dragstart', e => e.preventDefault());
  /* 손가락으로 꾹 누르면 뜨는 링크 메뉴를 막는다 */
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (e.button || !intro) return;
    const id = e.pointerId;
    const move = ev => {
      if (ev.pointerId !== id || ev.clientY < el.getBoundingClientRect().bottom + 4) return;
      swallowLogo = true;
      stop();
      pull();
    };
    const stop = ev => {
      if (ev && ev.pointerId !== id) return;
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);
  });
  /* 끌고 난 뒤 따라오는 click 은 홈으로 가는 링크를 누른 게 아니다.
     조르는 동안에는 로고를 누르기만 해도 꺼내진다 */
  el.addEventListener('click', e => {
    if (swallowLogo) { e.preventDefault(); swallowLogo = false; }
    else if (intro) { e.preventDefault(); pull(); }
    else if (fingers() && !touring && regionsOn()) { e.preventDefault(); chatting ? endChat() : chat(); }
  });
  addEventListener('pointerup', () => setTimeout(() => { swallowLogo = false; }, 0));
  el.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' || !intro) return;
    e.preventDefault();
    pull();
  });
  next.addEventListener('click', () => advance());
  skip.addEventListener('click', quitTour);
}

/* ── 경쟁전 ────────────────────────────────────────────
   시작하기를 꾹(0.6초) 누르면 켜진다 — 누르는 동안 알약이 봇의 빛깔로 차오르고, 다 차면
   '경쟁전 시작'으로 바뀐다. 한 번 더 누르면 지금 고른 칸(없으면 전체 코스)으로 겨룬다.
   다시 꾹 누르거나 Esc 면 풀린다. 키보드는 Space 를 누르고 있으면 된다 */
const HOLD_MS = 600;
let ranked = false, press = 0, swallowPlay = false;
const rankedSlug = () => PICK ? PICK.slug : COURSE.root;
function setRanked(on) {
  ranked = on;
  document.body.classList.toggle('rk-ready', on);
  if (bot) paintTint(bot.el.querySelector('.rk-bot-motion'));
  const play = $('#navPlay');
  play.dataset.i18n = on ? 'rankedStart' : 'start';
  play.textContent = t(play.dataset.i18n);
  relayoutNavShapes();
}
function wirePlayHold() {
  const play = $('#navPlay');
  const cancel = () => { clearTimeout(press); press = 0; document.body.classList.remove('rk-charging'); };
  const begin = () => {
    if (press) return;
    swallowPlay = false;
    document.body.classList.add('rk-charging');
    press = setTimeout(() => {
      cancel();
      swallowPlay = true;
      setRanked(!ranked);
      if (ranked) say('rkArmed', { name: placeOf(rankedSlug()) });
      else if (!touring) hide();
    }, HOLD_MS);
  };
  play.addEventListener('pointerdown', e => { if (!e.button) begin(); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(n => play.addEventListener(n, cancel));
  play.addEventListener('keydown', e => { if (e.key === ' ' && !e.repeat) begin(); });
  play.addEventListener('keyup', e => { if (e.key === ' ') cancel(); });
  /* 손가락으로 꾹 누르면 뜨는 메뉴를 막는다 */
  play.addEventListener('contextmenu', e => e.preventDefault());
}

let quitNote = '';
/* 1대1 매칭. 같은 기기(dev)의 다른 사람이 줄에 있으면 곧장 짝이고, 20초 안 나오면 봇과 붙는다.
   중계기는 WebSocket 이 없어 2초마다 /match/find 를 다시 부르는 것이 곧 기다리는 방법이다 —
   먼저 온 사람은 다음 폴링에서 짝을 받는다 */
const FIND_MS = 2000, BOT_AFTER = 20, OPP_MS = 1500, WAIT_MAX = 180000;
let mm = null, pollGen = 0;
const lastLeave = () => {
  const head = { 'content-type': 'application/json' };
  if (token()) head.authorization = 'Bearer ' + token();
  fetch(RELAY + '/match/leave', { method: 'POST', headers: head, body: '{}', keepalive: true }).catch(() => {});
};
const mmText = (id, s) => { $(id).textContent = s; };
function matchClose(leave) {
  if (!mm) return;
  clearInterval(mm.timer);
  if (leave) lastLeave();
  const back = mm.opener;
  mm = null;
  $('#rkMatch').hidden = true;
  if (back && back.isConnected) back.focus();
}
/* poll 이 거짓이면 글만 고친다. 묻는 건 1초 타이머와 단추뿐이다 — 대기 응답에서 다시 물으면
   짝수 초 동안 응답이 오는 족족 또 물어 1초에 수십 번 두드리고 RL_MT(분당 120)를 다 써 버린다 */
function matchStep(poll = true) {
  if (!mm || mm.paired) return;
  const s = Math.floor((Date.now() - mm.t0) / 1000);
  if (s >= BOT_AFTER) mm.bot = true;
  mmText('#rkMatchStat', mm.bot ? t('rkFindingBot', { s }) : t('rkFinding', { s, n: mm.n }));
  $('#rkMatchBot').hidden = mm.bot;
  if (poll && !mm.busy && (mm.first || s % 2 === 0 || mm.bot)) matchFind();
  mm.first = false;
}
async function matchFind() {
  const m = mm;
  m.busy = true;
  let d;
  try { d = await ask('/match/find', { c: m.slug, name: m.name, dev: DEV, lang: LANG, ...(m.bot ? { bot: true } : {}) }); }
  catch (e) {
    if (mm !== m) return;
    m.busy = false;
    if (e.status === 401) { matchClose(false); say('rkNeedLogin'); return; }
    if (++m.fails >= 3) { matchClose(false); say('rkFail'); }
    return;
  }
  if (mm !== m) return;
  m.busy = false; m.fails = 0;
  if (d.wait) { m.n = Number(d.n) || 1; matchStep(false); return; }
  if (!d.id || !d.duel) { matchClose(false); say('rkFail'); return; }
  matchPaired(m, d);
}
/* 짝이 오면 상대를 보이고 duel.at 까지 센다. 서버 시계와 이 기기 시계 차를 now 로 맞춘다 */
function matchPaired(m, d) {
  m.paired = true;
  clearInterval(m.timer);
  quitNote = d.quit < 0 ? t('rkQuit', { n: -d.quit }) : '';   // 배치 5판째 탈주는 자리를 매기는 + 라 알리지 않는다
  const o = d.opp || {};
  if (o.bot) o.name = botName();   // 봇 판은 홈 봇이 맞상대다 — 서버는 'bot' 이라고만 적는다
  const info = o.bot ? t('rkBotTag') : t('rkPlayerInfo', { tier: tierName(o.lp, o.games == null ? PLACE : o.games), lp: o.lp });
  mmText('#rkMatchStat', placeOf(d.slug || m.slug));
  mmText('#rkMatchOpp', t('rkFoundVs', { name: o.name || '', info }));
  $('#rkMatchOpp').hidden = false;
  $('#rkMatchBtns').hidden = true;
  /* start() 의 3·2·1(700ms × 3) 이 duel.at 에 끝나도록 그만큼 먼저 부른다 */
  const at = d.at - (Number(d.now) - Date.now()) - 2100;
  const rk = { id: d.id, secs: d.secs, duel: d.duel, opp: { name: o.name || '', bot: !!o.bot } };
  const slug = d.slug || m.slug;
  const show = () => {
    const n = Math.max(0, Math.ceil((at - Date.now()) / 1000));
    $('#rkMatchCount').hidden = false;
    mmText('#rkMatchCount', n);
    /* 숫자를 스크린리더에 매초 읽히지 않게 aria-hidden 이고, 상태 줄은 처음 한 번만 알린다 */
    return n;
  };
  mmText('#rkMatchStat', t('rkStartsIn', { n: Math.max(0, Math.ceil((at - Date.now()) / 1000)) }));
  m.timer = setInterval(() => {
    if (show() > 0 && Date.now() < at) return;
    clearInterval(m.timer);
    matchClose(false);
    if (!touring) hide();
    start(slug, null, rk);
    oppWatch(rk);
  }, 200);
  show();
}
function matchOpen(slug, name, bot) {
  setRanked(false);
  if (!touring) hide();
  mm = { slug, name, t0: Date.now(), n: 1, bot: !!bot, busy: false, first: true, fails: 0, paired: false,
    opener: document.activeElement };
  $('#rkMatchOpp').hidden = true;
  $('#rkMatchCount').hidden = true;
  $('#rkMatchBtns').hidden = false;
  $('#rkMatchBot').hidden = false;
  $('#rkMatch').hidden = false;
  matchStep();
  $(mm.bot ? '#rkMatchCancel' : '#rkMatchBot').focus();
  mm.timer = setInterval(matchStep, 1000);
}
function wireMatch() {
  $('#rkMatchBot').addEventListener('click', () => {
    if (!mm || mm.paired) return;
    mm.bot = true;
    matchStep();
    $('#rkMatchCancel').focus();
  });
  $('#rkMatchCancel').addEventListener('click', () => matchClose(true));
  document.addEventListener('keydown', e => {
    if (!mm) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!mm.paired) matchClose(true);
      return;
    }
    /* 탭은 창 안 단추 둘 사이만 돈다 */
    if (e.key !== 'Tab' || mm.paired) return;
    const items = [...$('#rkMatchBtns').querySelectorAll('button')].filter(b => !b.hidden);
    const at = items.indexOf(document.activeElement);
    if (!items.length) return;
    e.preventDefault();
    items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  }, true);
  /* 짝이 지어지기 전에 탭을 닫으면 줄에서 내린다 */
  addEventListener('pagehide', () => { if (mm && !mm.paired) lastLeave(); });
}
/* vsBot — 봇에게 '나랑 붙자' 하면 사람을 기다리지 않고 곧장 봇과 짝한다(봇과 붙기 단추와 같은 길) */
async function go(slug, vsBot) {
  if (!token()) { say('rkNeedLogin'); $('#signinLink').click(); return; }
  const name = readName();
  if (!name) {
    await say('rkNeedName', null, true);
    $('#rkNameIn').focus();
    return;
  }
  if (mm) return;
  matchOpen(slug, name, vsBot);
}
/* 상대 미니맵 — 중계기가 주는 맞힌 곳 지도(set: 코스 칸 순서대로 '0'/'1')를 지도 모양 그대로 그린다.
   안 맞힌 칸은 옅은 고리, 맞힌 칸은 속이 찬 점, 막 늘어난 칸은 더 크고 테두리가 진하다(색만으로 가르지 않는다) */
let miniSet = '';
function mini(set) {
  const c = $('#rkMini'), x = c.getContext('2d');
  if (!x || !G || !G.view) return;
  const cs = getComputedStyle(c), on = cs.getPropertyValue('--rk-on').trim() || cs.getPropertyValue('--ranked').trim() || '#e5484d',
        ink = cs.getPropertyValue('--ink').trim() || '#000', W = c.width, H = c.height, pad = 10;
  const k = Math.min((W - pad * 2) / G.view[0], (H - pad * 2) / G.view[1]), d = G.cell * k, r = d * .42,
        ox = (W - G.view[0] * k) / 2, oy = (H - G.view[1] * k) / 2;
  x.clearRect(0, 0, W, H);
  x.strokeStyle = ink; x.fillStyle = on;
  G.items.forEach((it, i) => {
    const got = set[i] === '1', fresh = got && miniSet[i] !== '1';
    x.globalAlpha = got ? 1 : .3;
    x.lineWidth = fresh ? 1.5 : 1;
    (it.cells || []).forEach(([cx, cy]) => {
      x.beginPath(); x.arc(ox + (cx + .5) * d, oy + (cy + .5) * d, fresh ? r * 1.5 : r, 0, 7);
      if (got) x.fill();
      if (!got || fresh) x.stroke();
    });
  });
  x.globalAlpha = 1;
  miniSet = set;
}
/* 판 중에는 1.5초마다 내 맞힌 곳을 알리고 상대의 것을 받아 머리줄에 건다 */
let oppTimer = 0;
function oppWatch(rk) {
  clearInterval(oppTimer);
  const put = (n, set) => {
    const total = G && G.items ? G.items.length : 0;
    /* 옛 중계기는 지도를 안 준다 — 개수만큼 앞에서부터 채운다 */
    mini(typeof set === 'string' ? set : '1'.repeat(n).padEnd(total, '0'));
    mmText('#rkOppT', t('rkOppLine', { name: rk.opp.name, n }));
    $('#rkOppFill').style.width = (total ? Math.min(100, n / total * 100) : 0) + '%';
  };
  miniSet = '';
  put(0);
  let seen = false;
  oppTimer = setInterval(async () => {
    /* start() 는 코스를 읽고 나서 G 를 세운다 — 그 전 틱은 건너뛴다 */
    if (!G || G.ranked !== rk) { if (seen) clearInterval(oppTimer); return; }
    /* 그만두고 나갔으면 멈춘다 */
    if (seen && !$('#play').classList.contains('on')) { clearInterval(oppTimer); return; }
    seen = true;
    try {
      const d = await ask('/match/tick', { duel: rk.duel, hits: G.hits, set: G.items.map(it => it.claimed ? 1 : 0).join('') });
      if (oppTimer && d.opp && G && G.ranked === rk) put(Number(d.opp.hits) || 0, d.opp.set);
    } catch {}
  }, OPP_MS);
}
function wireStart() {
  /* 캡처 단계에서 먼저 받는다 — app.js 의 일반 시작·Esc 보다 앞선다 */
  document.addEventListener('click', e => {
    if (e.target.closest('#again') && G && G.ranked) {
      e.stopImmediatePropagation();
      go(G.slug);
      return;
    }
    if (!e.target.closest('#navPlay')) return;
    /* 꾹 누른 뒤 손을 떼며 오는 click 은 시작이 아니다 */
    if (swallowPlay) { swallowPlay = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    /* 안내 도중에 시작하면 안내는 거기서 끝난다 — 판에서 돌아왔을 때 매달려 있지 않게 */
    quitTour();
    if (!ranked || document.body.matches('.signing, .setting, .paging')) return;
    e.stopImmediatePropagation();
    go(rankedSlug());
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !regionsOn()) return;
    if (document.body.matches('.signing, .setting, .paging')) return;
    if (!ranked) return;
    setRanked(false);
    if (!touring) hide();
    e.stopImmediatePropagation();
  }, true);
  $('#rkName').addEventListener('submit', e => {
    e.preventDefault();
    /* app.js 의 plain() 과 같은 자 — 중계기가 다듬은 이름과 어긋나지 않게 */
    const name = plain($('#rkNameIn').value);
    if (!name) return tell('badName', null, true);
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    go(rankedSlug());
  });
}

/* 판이 끝나면 전적을 남긴다. 경쟁전이면 표를 태우고 lp 를 받아 결과 줄에 건다 */
addEventListener('rt-finish', async ({ detail: g }) => {
  const line = $('#rLp');
  line.textContent = '';
  line.classList.remove('bad');
  /* 일반전 판은 app.js 의 board() 가 올린다 — 그래야 그 판의 순위표를 한 번에 받는다 */
  if (!token() || !g.ranked) return;
  const body = { score: g.score, cpm: g.cpm, acc: g.acc, hits: g.hits, tries: g.tries };
  line.textContent = t('uploading');
  clearInterval(oppTimer); oppTimer = 0;
  const gen = ++pollGen, opp = g.ranked.opp || {};
  /* 결과 줄: 승패 라벨 · 상대 속도 · ±lp · 티어. 배치 중엔 lp 대신 몇 판째인지,
     배치를 마친 판엔 앉은 자리를 보인다 */
  const show = (win, oppCpm, d) => {
    const res = document.createElement('b');
    res.className = 'rk-res';
    res.dataset.res = win === 1 ? 'win' : win === 0 ? 'loss' : 'draw';
    res.textContent = t(win === 1 ? 'rkWin' : win === 0 ? 'rkLose' : 'rkDraw');
    const lp = d.games < PLACE ? t('rkPlacing', { n: d.games, m: PLACE })
      : d.placed || d.games === PLACE ? t('rkPlaced', { tier: tierLabel(d.lp), lp: d.lp })
      : t('rkResult', { d: signed(d.delta), tier: tierLabel(d.lp), lp: d.lp });
    line.replaceChildren(...[quitNote, res, t('rkVsResult', { name: opp.name, cpm: showSpeed(oppCpm) }), lp]
      .filter(Boolean).flatMap((x, i) => i ? [' · ', x] : [x]));
    quitNote = '';
    /* 정산이 끝나야 경쟁전 최고 기록이 적힌다 — 결과 화면 순위표를 다시 읽는다(app.js) */
    board();
  };
  try {
    const d = await ask('/ranked/end', { ...body, id: g.ranked.id });
    if (gen !== pollGen) return;
    if (!d.pending) { show(d.duel.win, d.duel.oppCpm, d); return; }
    /* 사람 상대가 아직 치는 중이다 — 정산될 때까지 1.5초마다 묻는다 */
    line.textContent = t('rkWaitOpp');
    for (const t0 = Date.now(); Date.now() - t0 < WAIT_MAX; ) {
      await new Promise(r => setTimeout(r, OPP_MS));
      if (gen !== pollGen || !$('#result').classList.contains('on')) return;
      let r;
      try { r = await ask('/match/tick', { duel: g.ranked.duel, hits: g.hits }); } catch { continue; }
      if (r.result) { show(r.result.win, r.result.oppCpm, r.result); return; }
    }
    throw new Error('wait');
  } catch {
    if (gen !== pollGen) return;
    line.textContent = t('rkEndFail');
    line.classList.add('bad');
  }
});

/* ── 손잡이 ──────────────────────────────────────────── */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (a && PAGES.includes(a.getAttribute('href').slice(1))) { e.preventDefault(); openPage(a.getAttribute('href').slice(1)); }
  if (a && a.getAttribute('href') === '#styles') { e.preventDefault(); openStyles(a); }
  if (e.target.closest('[data-pg-close]')) closePage();
});
addEventListener('keydown', e => {
  if (!page || ($('#feedback') && $('#feedback').open)) return;
  if (e.key === 'Escape') { e.preventDefault(); return closePage(); }
  if (e.key !== 'Tab') return;
  const items = [...over(page).querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
    .filter(n => !n.closest('[hidden]') && n.getClientRects().length).concat(dockTabs());
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
    e.preventDefault(); first.focus();
  }
});
addEventListener('popstate', () => {
  const h = location.hash.slice(1);
  if (PAGES.includes(h)) openPage(h); else closePage();
});
addEventListener('rt-open-settings', () => closePage(true));
addEventListener('rt-open-signin', () => closePage(true));
addEventListener('rt-tab-swap', () => closePage(true));

wireTabs();
wireLogo();
wirePlayHold();
wireStart();
wireMatch();
wireChat();
wireStyles();
paintTheme();   // 머리 스크립트가 붙일 rt.themeCss 를 지금 표로 다시 적는다
if (location.search.includes('rt=1')) {
  console.assert(THEME.every(k => HEX.test(k.def) && (!k.on || HEX.test(k.on) || THEME.some(x => x.key === k.on))), '스타일: 표의 기본값·짝');
  console.assert(!themeLow({}).length, '스타일: 기본 색은 대비를 지킨다');
  console.assert(themeLow({ ink: '#e8edf0' })[0]?.key === 'bg' && themeLow({ accent: '#232c31' })[0]?.key === 'accent', '스타일: 대비 부족을 잡는다');
  console.assert(themeCss({ bg: '#ffffff' }).startsWith(':root:not([data-night]){--bg:#ffffff') && themeCss({}) === '', '스타일: 밤엔 낮 바탕을 깔지 않는다');
  console.assert(Object.keys(pickTheme({ accent: '#123456', bad: '#ffffff', block: 'red' })).join() === 'accent', '스타일: 표 밖·틀린 값은 버린다');
  console.assert(['#000000', '#ffffff', '#f0a03c', '#2266cc', '#ff0000', '#7a7a7a'].every(a => styleIdeas(a).every(s => !themeLow(s).length)), '스타일: 추천은 늘 대비를 지킨다');
  console.assert(hsl(0, 1, .5) === '#ff0000' && Math.round(hueOf('#00ff00')) === 120, '스타일: 색상환 셈');
}
/* 첫 진입 로딩(app.js boot)의 봇 스타일·경쟁전 신호 단계와 맞물린다.
   로딩 중(RT_BOOT_BOT)에 엔진을 받아 캐릭터 모양·표정·색·크기와 --rk-on 빛깔을 먼저 입히고,
   지도 자리가 잡힌 뒤(RT_BOOT_PLACE) 귀퉁이 잠자리는 로딩 막 뒤에서 미리 세운다.
   인사(greetIn)와 첫 안내(beginIntro)는 막이 걷힌 직후(BOOTED.then) 시작한다 */
let bootAct = '';
window.RT_BOOT_BOT = async () => {
  sizeBot();
  await makeBot();
  if (!bot) return;
  const face = readFace();
  if (face.shape) bot.api.setShape(face.shape);
  if (face.expression) bot.api.setExpression(face.expression);
  bot.api.setColour(face.colour);
  paintTint(bot.el.querySelector('.rk-bot-motion'));
  bot.el.setAttribute('aria-label', botName());
};
window.RT_BOOT_PLACE = async () => {
  if (!regionsOn()) return;
  let rescue = false;
  try { rescue = !!localStorage.getItem(RESCUE_KEY); } catch {}
  let greet = false;
  try { greet = !!localStorage.getItem(GREET_KEY); localStorage.removeItem(GREET_KEY); } catch {}
  /* 폰이 아니면 예전처럼 들어올 때마다 봇이 나와 있다 — 한 탭(세션)에 한 번 인사하고, 그 뒤엔 귀퉁이에서 잔다 */
  if (!phone()) {
    try { greet = greet || !sessionStorage.getItem(GREETED_KEY); sessionStorage.setItem(GREETED_KEY, '1'); } catch {}
  }
  if (rescue && token()) bootAct = 'rescue';
  else if (greet) bootAct = 'greet';
  else if (!phone()) await summon().then(sleep);
};
BOOTED.then(() => {
  if (PAGES.includes(location.hash.slice(1))) openPage(location.hash.slice(1));
  if (location.hash === '#styles') { history.replaceState(null, '', location.pathname + location.search); openStyles(document.body); }
  if (!regionsOn()) return;
  if (bootAct === 'rescue') beginIntro();
  else if (bootAct === 'greet') greetIn();
}).catch(() => {});
})();
