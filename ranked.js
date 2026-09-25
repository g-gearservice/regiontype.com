/* regiontype 경쟁전 · 순위 · 기록.

   순위(#ranking)·기록(#records)·내 계정(#account)은 설정처럼 제 페이지가 아니라 홈 위에
   뜨는 덮개다. 전환은 style.css 의 body.paging 이 맡고, 주소에는 해시만 남는다.

   경쟁전은 아래 줄의 시작하기를 꾹 눌러 켠다. 넵바 로고를 끌어내리면 나오는 Grok
   봇은 이제 경쟁전이 아니라 홈의 도우미다(아래 '도우미 봇' 절).
   lp 셈과 부정 막기는 전부 중계기(relay/worker.mjs 의 경쟁전 절)가 한다 — 여기는
   표를 받아 app.js 의 start() 에 넘기고, 끝나면 결과를 올릴 뿐이다.

   app.js 뒤에 실려 그 전역을 빌려 쓴다: t · token · asset · start · opt · clock ·
   calm · homeTitle · aimNavShape · relayoutNavShapes · plain · showSpeed · BOOTED ·
   COURSE · PICK · G.
   ponytail: 빌려 쓰는 게 이만큼 늘었다. 한 번 더 늘면 app.js 를 모듈로 나눈다. */
(function () {
'use strict';

const $ = s => document.querySelector(s);
const RELAY = 'https://g.gearservicevanguard.com';
const NAME_KEY = 'rt.name';
/* 중계기와 같은 수다(worker.mjs 의 STEP · PLACE). 티어 이름은 여기서만 짓는다 */
const STEP = 100, PLACE = 5, TIERS = 6;
const tierOf = lp => Math.min(TIERS - 1, Math.floor(lp / STEP));
const tierName = (lp, games) => games < PLACE
  ? t('placing', { n: games, m: PLACE }) : t('tier' + tierOf(lp));
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
/* 봇의 모습은 계정 화면에서 고른 것을 그대로 쓴다 — 저장은 거기서 하고 여기선 읽기만
   한다(로그인해 있으면 계정 화면이 서버 값을 이 거울에 맞춰 둔다). 고른 적이 없으면
   null 셋이라 엔진이 제 기본 모습으로 선다. 색은 CSS 의 --buddy-ink(경쟁전 빨강)를
   덮으므로, 안 골랐으면 덮지 않아 빨간 봇 그대로다. */
const readFace = () => {
  try { return JSON.parse(localStorage.getItem('rt.character') || '{}') || {}; }
  catch { return {}; }
};

async function ask(path, body) {
  const head = {};
  if (body) head['content-type'] = 'application/json';
  if (token()) head.authorization = 'Bearer ' + token();
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
      .filter(n => n !== el && n.tagName !== 'SCRIPT' && !['signin', 'options', 'codes', 'feedback'].includes(n.id))
      .map(n => [n, n.inert]);
    inertWas.forEach(([n]) => { n.inert = true; });
  } else {
    inertWas.forEach(([n, was]) => { n.inert = was; });
    inertWas = [];
  }
}
function openPage(name) {
  if (page === name) return;
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
  if (location.hash !== '#' + name) history.pushState({ pg: 1 }, '', '#' + name);
  el.querySelector('[data-pg-close]').focus({ preventScroll: true });
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
}

/* ── 순위 ─────────────────────────────────────────────── */
function rankRow(i, name, right, me, tier) {
  const li = document.createElement('li');
  li.innerHTML = '<b></b><span class="who"></span><span class="pt"></span>';
  li.querySelector('b').textContent = i + 1;
  li.querySelector('.who').textContent = name;
  li.querySelector('.pt').textContent = right;
  if (tier != null) {
    const s = document.createElement('span');
    s.className = 'tier'; s.dataset.tier = tier; s.textContent = t('tier' + tier);
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
  try {
    const d = await ask('/ladder');
    if (n !== rankReq) return;
    lad.replaceChildren(...d.top.map((r, i) => rankRow(i, r.name, r.lp + ' LP', r.me, tierOf(r.lp))));
    say.textContent = d.top.length ? '' : t('ladderEmpty');
  } catch { if (n === rankReq) say.textContent = t('boardFail'); }

  /* 일반전은 코스·시간마다 판이 따로다 — 지금 고른 칸과 설정의 시간으로 읽는다 */
  const slug = PICK ? PICK.slug : COURSE.root, list = $('#normalList'), nsay = $('#normalSay');
  $('#normalWhere').textContent = slug ? `${placeOf(slug)} · ${clock(opt.time)}` : '';
  list.replaceChildren(); nsay.textContent = t('reading');
  if (!slug) return;
  try {
    const d = await ask(`/top?c=${encodeURIComponent(slug)}&t=${opt.time}`);
    if (n !== rankReq) return;
    list.replaceChildren(...(d.top || []).map((r, i) => rankRow(i, r.name, showSpeed(r.cpm), r.me)));
    nsay.textContent = (d.top || []).length ? '' : t('ladderEmpty');
  } catch { if (n === rankReq) nsay.textContent = t('boardFail'); }
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
  try { d = await ask('/games'); } catch { if (n === recReq) say.textContent = t('boardFail'); return; }
  if (n !== recReq) return;
  const lad = d.ladder;
  if (lad) {
    const placed = lad.games >= PLACE;
    const tier = $('#recTier');
    tier.textContent = tierName(lad.lp, lad.games);
    tier.dataset.tier = placed ? tierOf(lad.lp) : '';
    $('#recLp').textContent = lad.lp + ' LP';
    /* 마스터는 끝이 없다 — 막대를 가득 채운다 */
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
      ['lp', g.delta == null ? '' : signed(g.delta) + ' LP'],
      ['at', day.format(new Date(g.at))],
    ];
    cells.forEach(([k, v]) => {
      const s = document.createElement(k === 'at' ? 'time' : 'span');
      s.className = k; s.textContent = v;
      if (k === 'lp' && g.delta != null) s.dataset.sign = g.delta > 0 ? 'up' : 'down';
      if (k === 'at') s.dateTime = new Date(g.at).toISOString();
      li.append(s);
    });
    return li;
  }));
  say.textContent = d.games.length || lad ? '' : t('recordsEmpty');
}

/* ── 도우미 봇 ───────────────────────────────────────────
   Grok 봇은 홈의 도우미다. 사이트에 들어오거나 로그인하면 로고 알약 뒤에서 먼저 나와
   인사하고(greetIn), 평소엔 네 귀퉁이 중 한 곳에서 자다가 가리키거나(호버·키보드
   초점) 누르면 깬다.
   가입하고 처음 홈에 오면(auth.js 가 새 계정에만 rt.rescue 를 남긴다) 넵바만 두고 홈을
   어둡게 덮은 채 로고 알약 뒤에서 꺼내 달라고 조른다. 로고를 끌어내리거나 누르면
   (키보드는 로고에서 ↓) 나와서 화면 오른쪽에서부터 한 번만 둘러보기를 한다. 로고로
   봇을 꺼내는 건 이때뿐이다 — 그 뒤 로고는 그냥 홈 링크다. 자세한 플레이 방법은
   소개 페이지(data/howto.json)가 맡는다.
   ponytail: 대화는 아직 없다 — 누르면 인사만 한다. 오픈라우터를 붙일 때 greet() 에 입력을 연다 */
const BOT = 80, RESCUE_KEY = 'rt.rescue';
const layer = $('#rkLayer'), bubble = $('#rkSay'), dim = $('#rkDim'), next = $('#rkNext');
const logo = () => $('#regions .navbar .nav-logo');
const regionsOn = () => $('#regions').classList.contains('on');
const botName = () => { try { return localStorage.getItem('rt.botname') || 'Grok'; } catch { return 'Grok'; } };
let bot = null, making = null, out = false, intro = false, touring = false, corner = 0, hush = 0, nap = 0;

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
  making = making || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href).then(({ mountBuddy }) => {
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
      else if (!touring) greet();
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
const clampXY = (x, y) => [Math.max(0, Math.min(innerWidth - BOT, x)), Math.max(0, Math.min(innerHeight - BOT, y))];
function moveTo(x, y) {
  spot = clampXY(x, y);
  place(...spot);
}
function grab(e) {
  if (e.button || intro || touring) return;
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
    doze();
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
function nudge(e) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d || intro || touring) return;
  e.preventDefault();
  const step = e.shiftKey ? 96 : 24;
  moveTo(bot.x + d[0] * step, bot.y + d[1] * step);
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
  bot.x = x; bot.y = y;
  bot.el.style.transform = `translate3d(${x}px,${y}px,0)`;
  const cx = x + BOT / 2, cy = y + BOT / 2, side = sideOf(cx, cy);
  const turned = bubble.dataset.side !== side;
  bubble.dataset.side = side;
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  const bx = side === 'right' ? cx : side === 'left' ? cx - w : cx - w / 2;
  const by = side === 'down' ? cy : side === 'up' ? cy - h : cy - h / 2;
  const fx = Math.max(16, Math.min(innerWidth - w - 16, bx)), fy = Math.max(16, Math.min(innerHeight - h - 16, by));
  bubble.style.transform = `translate3d(${fx}px,${fy}px,0)`;
  /* 테두리는 말풍선 안에서 봇 자리에 선다 */
  bubble.style.setProperty('--ring-x', x - fx + 'px');
  bubble.style.setProperty('--ring-y', y - fy + 'px');
  /* 말하는 채로 반대편으로 끌려가면 새 방향으로 다시 펼친다 */
  if (turned && !bubble.hidden) unfold();
}
/* 날지 않고 그 자리에 선다 — 처음 나타날 때 */
function jump(x, y) {
  bot.el.style.transition = bubble.style.transition = 'none';
  place(x, y);
  void bot.el.offsetWidth;
  bot.el.style.transition = bubble.style.transition = '';
}
function tell(key, vars, form) {
  $('#rkSayText').textContent = t(key, vars);
  $('#rkName').hidden = !form;
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
function hide() { bubble.hidden = true; }

/* 귀퉁이는 넵바 아래 두 곳과 화면 아래 두 곳이다 */
function cornerAt(i) {
  const top = $('#regions .navbar').getBoundingClientRect().bottom + 12;
  return [i % 2 ? innerWidth - BOT - 20 : 20, i < 2 ? top : innerHeight - BOT - 24];
}
function sleep() {
  hide();
  bot.el.classList.add('is-asleep');
  bot.api.setState('sleep');
}
function wake() {
  if (!bot || intro || touring) return;
  clearTimeout(nap);
  bot.el.classList.remove('is-asleep');
  bot.api.setState('idle');
}
function doze() {
  if (!bot || intro || touring) return;
  clearTimeout(nap);
  nap = setTimeout(() => {
    if (!touring && bubble.hidden && !bot.el.matches(':hover, :focus-visible')) sleep();
  }, 1500);
}
/* 떠 있지 않으면 아무 귀퉁이에서 깨어난다 */
async function summon() {
  await makeBot();
  if (out) return;
  out = true;
  layer.hidden = false;
  bot.api.start();
  spot = null;
  corner = Math.floor(Math.random() * 4);
  jump(...cornerAt(corner));
}
/* 둘러보기 밖에서 하는 말. 이름 칸을 연 말이 아니면 조금 뒤 접고 다시 잔다 */
async function say(key, vars, form) {
  await summon();
  if (!touring) wake();
  tell(key, vars, form);
  clearTimeout(hush);
  if (!form && !touring) hush = setTimeout(() => { hide(); doze(); }, 6000);
}
function greet() { say('botHi'); }

/* ── 처음 온 사람 ──
   넵바만 밝게 두고 나머지는 .rk-dim 이 덮는다. 봇은 로고 알약 바로 아래에 반쯤
   숨어(넵바가 봇 층보다 위로 올라간다) 들썩이며 조른다 */
const INTRO_LOCK = () => [$('#courseBtns'), $('#regions .nav-bot'), $('#regions .screen-head'), $('#courseName')];
function peekAt() {
  const r = logo().getBoundingClientRect();
  return [r.left + r.width / 2 - BOT / 2, r.bottom - BOT * .35];
}
async function beginIntro() {
  intro = true;
  document.body.classList.add('rk-intro');
  dim.hidden = false;
  layer.hidden = false;
  INTRO_LOCK().forEach(n => { if (n) n.inert = true; });
  aimNavShape(logo());
  logo().setAttribute('aria-label', t('logoBot'));
  await makeBot();
  if (!intro) return;
  out = true;
  bot.api.start();
  bot.api.setState('alert');
  tell('botPeek');
  jump(...peekAt());
  requestAnimationFrame(peekFrame);
}
/* 넵바는 글꼴이 늦게 오거나 창이 바뀌면 자리를 옮긴다 — 조르는 동안 매 프레임 로고를
   따라가고, 막의 윗변도 넵바 아랫변에 맞춘다 */
function peekFrame() {
  if (!intro) return;
  dim.style.top = $('#regions .navbar').getBoundingClientRect().bottom + 'px';
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
  return [x, r.top > innerHeight / 2 ? r.top - BOT * .85 : r.bottom - BOT * .1];
}
function midTile() {
  const tiles = [...document.querySelectorAll('#courseBtns .grid-btn:not(.gone)')]
    .filter(el => parseFloat(getComputedStyle(el).opacity) >= .5);
  const d = el => {
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - innerWidth / 2, r.top + r.height / 2 - innerHeight / 2);
  };
  return tiles.sort((a, b) => d(a) - d(b))[0] || null;
}
const STEPS = [
  ['tourHi', () => [innerWidth * .72, innerHeight * .36]],
  ['tourTiles', () => near(midTile())],
  ['tourPlay', () => near($('#navPlay'))],
  ['tourRanked', () => near($('#navPlay'))],
  ['tourBoard', () => near($('#regions .navbar a[href="#ranking"]'))],
  ['tourSettings', () => near($('#regions .nav-bot a[href="settings/"]'))],
  ['tourBye', () => [innerWidth / 2 - BOT / 2, innerHeight * .36]],
];
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
    jump(r.left + r.width / 2 - BOT / 2, r.top);
  }
  bot.api.start();
  bot.el.classList.remove('is-asleep');
  bot.api.setState('idle');
  next.hidden = false;
  next.focus({ preventScroll: true });
  for (const [key, at] of STEPS) {
    /* 날아가는 동안은 입을 다물고, 내려앉은 뒤 말풍선을 펼친다 */
    hide();
    place(...at());
    await new Promise(res => setTimeout(res, siDurMs()));
    tell(key, { bot: botName() });
    /* 날아가는 동안 말풍선이 숨어 '다음'에서 초점이 빠졌다 — 돌려준다 */
    next.focus({ preventScroll: true });
    await nextPress();
  }
  next.hidden = true;
  touring = false;
  /* '다음'에 있던 초점은 봇이 받는다 — 숨은 버튼에 남기지 않는다 */
  if (!document.activeElement || document.activeElement === next || document.activeElement === document.body) {
    bot.el.focus({ preventScroll: true });
  }
  settle();
}
/* 아무 귀퉁이로 가서 잔다 */
function settle() {
  spot = null;
  corner = Math.floor(Math.random() * 4);
  place(...cornerAt(corner));
  sleep();
}

/* ── 다시 온 사람 ── 사이트에 들어오거나 로그인하면 봇이 먼저 로고 알약 뒤에서 걸어
   나와 인사하고, 조금 뒤 귀퉁이로 가서 잔다. 한 탭(세션)에 한 번 — 설정을 다녀오거나
   새로고침할 때마다 인사하지 않는다. 로그인하면 auth.js 가 표를 지워 다시 인사한다 */
const GREETED_KEY = 'rt.greeted';
async function greetIn() {
  await makeBot();
  out = true;
  layer.hidden = false;
  bot.api.start();
  bot.api.setState('idle');
  hide();
  /* 나오는 동안만 넵바를 봇 층 위로 올려, 알약 뒤에서 빠져나오는 것처럼 보인다 */
  document.body.classList.add('rk-emerge');
  const r = logo().getBoundingClientRect();
  jump(r.left + r.width / 2 - BOT / 2, r.top + r.height / 2 - BOT / 2);
  requestAnimationFrame(() => place(r.left + r.width / 2 - BOT / 2,
    $('#regions .navbar').getBoundingClientRect().bottom - BOT * .15));
  await new Promise(res => setTimeout(res, Math.max(60, siDurMs())));
  document.body.classList.remove('rk-emerge');
  const name = token() ? readName() : '';
  tell(name ? 'botWelcomeName' : 'botWelcome', { name });
  clearTimeout(hush);
  /* 인사하는 사이 옮겨 놓았으면 그 자리에서 잔다 */
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
addEventListener('resize', () => {
  if (!out || !bot || touring || intro) return;
  if (spot) moveTo(...spot); else place(...cornerAt(corner));
});

/* 로고 — 조르는 동안에만 봇을 꺼내는 손잡이다. 잡아서 아래로 16px 넘게 끌면 나온다 */
let swallowLogo = false;
function wireLogo() {
  const el = logo();
  el.addEventListener('dragstart', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (!intro || e.button || e.pointerType === 'touch') return;
    const y0 = e.clientY;
    const move = ev => {
      if (ev.clientY - y0 < 16) return;
      stop();
      swallowLogo = true;
      pull();
    };
    const stop = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);
  });
  /* 끌고 난 뒤 따라오는 click 은 홈으로 가는 링크를 누른 게 아니다.
     조르는 동안에는 로고를 누르기만 해도 꺼내진다(손가락 화면은 끌 수 없다) */
  el.addEventListener('click', e => {
    if (swallowLogo) { e.preventDefault(); swallowLogo = false; }
    else if (intro) { e.preventDefault(); pull(); }
  });
  addEventListener('pointerup', () => setTimeout(() => { swallowLogo = false; }, 0));
  el.addEventListener('keydown', e => {
    if (!intro || e.key !== 'ArrowDown') return;
    e.preventDefault();
    pull();
  });
  next.addEventListener('click', () => advance());
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
async function go(slug) {
  if (!token()) { say('rkNeedLogin'); $('#signinLink').click(); return; }
  const name = readName();
  if (!name) {
    await say('rkNeedName', null, true);
    $('#rkNameIn').focus();
    return;
  }
  let d;
  try { d = await ask('/ranked/start', { c: slug, name }); }
  catch (e) { say(e.status === 401 ? 'rkNeedLogin' : 'rkFail'); return; }
  quitNote = d.quit ? t('rkQuit', { n: -d.quit }) : '';
  setRanked(false);
  if (!touring) hide();
  start(slug, null, { id: d.id, secs: d.secs });
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
  if (!token()) return;
  const body = { score: g.score, cpm: g.cpm, hits: g.hits, tries: g.tries };
  if (!g.ranked) { ask('/played', { ...body, c: g.slug, t: g.total }).catch(() => {}); return; }
  line.textContent = t('uploading');
  try {
    const d = await ask('/ranked/end', { ...body, id: g.ranked.id });
    line.textContent = [quitNote, t('rkResult', { d: signed(d.delta), tier: tierName(d.lp, d.games), lp: d.lp })]
      .filter(Boolean).join(' · ');
  } catch {
    line.textContent = t('rkEndFail');
    line.classList.add('bad');
  }
  quitNote = '';
});

/* ── 손잡이 ──────────────────────────────────────────── */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (a && PAGES.includes(a.getAttribute('href').slice(1))) { e.preventDefault(); openPage(a.getAttribute('href').slice(1)); }
  if (e.target.closest('[data-pg-close]')) closePage();
});
addEventListener('keydown', e => {
  if (!page || ($('#feedback') && $('#feedback').open)) return;
  if (e.key === 'Escape') { e.preventDefault(); return closePage(); }
  if (e.key !== 'Tab') return;
  const items = [...over(page).querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
    .filter(n => !n.closest('[hidden]'));
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !over(page).contains(document.activeElement))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !over(page).contains(document.activeElement))) {
    e.preventDefault(); first.focus();
  }
});
addEventListener('popstate', () => {
  const h = location.hash.slice(1);
  if (PAGES.includes(h)) openPage(h); else closePage();
});
addEventListener('rt-open-settings', () => closePage(true));
addEventListener('rt-open-signin', () => closePage(true));

wireTabs();
wireLogo();
wirePlayHold();
wireStart();
/* 가입하고 처음 온 홈이면 조르고, 아니면 귀퉁이에서 자고 있다.
   화면 말(i18n)을 다 읽은 뒤에 연다 */
BOOTED.then(() => {
  if (!regionsOn()) return;
  let rescue = false;
  try { rescue = !!localStorage.getItem(RESCUE_KEY); } catch {}
  if (rescue && token()) beginIntro();
  else {
    let greeted = true;
    try { greeted = !!sessionStorage.getItem(GREETED_KEY); sessionStorage.setItem(GREETED_KEY, '1'); } catch {}
    (greeted ? summon().then(sleep) : greetIn());
  }
}).catch(() => {});
if (PAGES.includes(location.hash.slice(1))) openPage(location.hash.slice(1));
})();
