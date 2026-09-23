/* regiontype 경쟁전 · 순위 · 기록.

   순위(#ranking)와 기록(#records)은 설정처럼 제 페이지가 아니라 홈 위에 뜨는
   덮개다. 전환은 style.css 의 body.paging 이 맡고, 주소에는 해시만 남는다.

   경쟁전은 넵바 로고에서 시작한다. 로고를 잡고 아래로 끌면 빨간 Grok 봇이 딸려
   나와 규칙을 말하고, 구역 칸에 놓으면 그 칸이 빨갛게 물들고 아래 줄의 시작하기가
   '경쟁전 시작'으로 바뀐다. 키보드는 로고에서 ↓, 칸에서 Enter 다.
   lp 셈과 부정 막기는 전부 중계기(relay/worker.mjs 의 경쟁전 절)가 한다 — 여기는
   표를 받아 app.js 의 start() 에 넘기고, 끝나면 결과를 올릴 뿐이다.

   app.js 뒤에 실려 그 전역을 빌려 쓴다: t · token · asset · start · opt · clock ·
   calm · homeTitle · relayoutNavShapes · COURSE · PICK · TILE · G · LANG.
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
const PAGES = ['ranking', 'records'];
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
  else fillRecords();
}
function closePage(now) {
  if (!page) return;
  const el = over(page);
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

/* ── 경쟁전 봇 ───────────────────────────────────────────
   봇은 하나다. armed 면 떠 있고, tile 이 있으면 그 칸에 앉아 경쟁전이 준비된 것이다.
   앉은 봇은 칸의 오른쪽 위에 걸터앉아 매 프레임 칸을 따라간다 — 홈 지도를 밀거나
   줄여도 붙어 있다(auth.js 의 붙은 봇과 같은 수). */
const BOT = 56;
const layer = $('#rkLayer'), bubble = $('#rkSay');
let bot = null, making = null, armed = false, follow = 0, swallow = false;

function makeBot() {
  making = making || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href).then(({ mountBuddy }) => {
    const el = document.createElement('div');
    el.className = 'rk-bot';
    const motion = document.createElement('span');
    motion.className = 'rk-bot-motion';
    el.append(motion);
    layer.prepend(el);
    const face = readFace();
    const api = mountBuddy(motion, { calm, shape: face.shape, expression: face.expression });
    if (face.colour) api.setColour(face.colour);
    bot = { el, api, x: 0, y: 0, tile: null };
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      e.preventDefault();
      hold(e.clientX, e.clientY);
    });
    return bot;
  });
  return making;
}
function place(x, y) {
  bot.x = x; bot.y = y;
  bot.el.style.transform = `translate3d(${x}px,${y}px,0)`;
  /* 말풍선은 봇 오른쪽. 화면 끝에 닿으면 왼쪽으로 넘긴다 */
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  let bx = x + BOT + 10, by = y + BOT / 2 - h / 2;
  if (bx + w > innerWidth - 16) bx = x - w - 10;
  bubble.style.transform = `translate3d(${Math.max(16, bx)}px,${Math.max(16, Math.min(innerHeight - h - 16, by))}px,0)`;
}
function tell(key, vars, keepForm) {
  $('#rkSayText').textContent = t(key, vars);
  if (!keepForm) $('#rkName').hidden = true;
  if (bot) place(bot.x, bot.y);
}
const regionsOn = () => $('#regions').classList.contains('on');
const tilesVisible = () => [...document.querySelectorAll('#courseBtns .grid-btn:not(.gone)')]
  .filter(el => parseFloat(getComputedStyle(el).opacity) >= .5);
function tileUnder(x, y) {
  return tilesVisible().find(el => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }) || null;
}
const overLogo = (x, y) => {
  const r = $('#regions .navbar .nav-logo').getBoundingClientRect();
  return x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 24 && y <= r.bottom + 24;
};
const perch = el => { const r = el.getBoundingClientRect(); return [r.right - BOT * .75, r.top - BOT * .35]; };

function followFrame() {
  follow = 0;
  if (!armed || !bot || !bot.tile || !regionsOn()) return;
  if (!bot.tile.isConnected || bot.tile.classList.contains('gone')) { seat(null); return; }
  place(...perch(bot.tile));
  follow = requestAnimationFrame(followFrame);
}
const followKick = () => { if (!follow) follow = requestAnimationFrame(followFrame); };

/* 시작하기가 빨개지고 라벨이 바뀐다 — 색만으로 가르지 않는다 */
function paintPlay() {
  const ready = armed && !!bot?.tile;
  document.body.classList.toggle('rk-ready', ready);
  const play = $('#navPlay');
  play.dataset.i18n = ready ? 'rankedStart' : 'start';
  play.textContent = t(play.dataset.i18n);
  relayoutNavShapes();
}
function seat(el) {
  if (bot.tile) {
    bot.tile.classList.remove('is-ranked');
    bot.tile.removeAttribute('aria-description');
  }
  bot.tile = el;
  if (el) {
    el.classList.add('is-ranked');
    el.setAttribute('aria-description', t('rankedTab'));
    bot.api.setState('idle');
    tell('rkReady', { name: TILE.get(el)?.label || '' });
    followKick();
  }
  paintPlay();
}
async function arm(x, y) {
  await makeBot();
  armed = true;
  layer.hidden = false;
  document.body.classList.add('rk-armed');
  bot.el.classList.remove('is-leaving');
  bot.api.start();
  place(x - BOT / 2, y - BOT / 2);
  tell('rkHello');
}
function disarm() {
  if (!armed) return;
  armed = false;
  cancelAnimationFrame(follow); follow = 0;
  seat(null);
  document.body.classList.remove('rk-armed');
  /* 로고로 날아가 사라진다. 모션을 줄였으면 바로 숨긴다 */
  const r = $('#regions .navbar .nav-logo').getBoundingClientRect();
  bot.el.classList.add('is-leaving');
  place(r.left + r.width / 2 - BOT / 2, r.top);
  setTimeout(() => { if (!armed) { layer.hidden = true; bot.api.stop(); } }, calm() ? 0 : siDurMs());
}

/* 잡고 끈다. 창 전체에서 포인터를 듣는다 — 봇을 만드는 동안(모듈 읽기) 손이 먼저
   가 있어도 놓치지 않는다 */
function hold(px, py) {
  if (!bot) return;
  cancelAnimationFrame(follow); follow = 0;
  seat(null);
  bot.el.classList.add('is-held');
  bot.api.setState('wide');
  tell('rkHello');
  let hot = null;
  const at = (x, y) => {
    px = x; py = y;
    place(px - BOT / 2, py - BOT / 2);
    const tile = tileUnder(px, py);
    if (tile !== hot) { hot?.classList.remove('rk-hot'); hot = tile; hot?.classList.add('rk-hot'); }
  };
  at(px, py);
  const move = e => at(e.clientX, e.clientY);
  const drop = e => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', drop);
    removeEventListener('pointercancel', drop);
    if (e.type === 'pointerup') at(e.clientX, e.clientY);
    hot?.classList.remove('rk-hot');
    land(px, py);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', drop);
  addEventListener('pointercancel', drop);
}

/* 놓은 자리: 로고 근처면 돌아가 사라지고, 칸이면 앉고, 빈 곳이면 거기 떠서 기다린다 */
function land(x, y) {
  bot.el.classList.remove('is-held');
  if (overLogo(x, y)) return disarm();
  const tile = tileUnder(x, y);
  if (tile) return seat(tile);
  place(x - BOT / 2, y - BOT / 2);
  bot.api.setState('idle');
  tell('rkNeedTile');
}

/* 로고 — 호버로 봇을 미리 읽어 두고, 잡아서 아래로 16px 넘게 끌면 봇이 나온다 */
function wireLogo() {
  const logo = $('#regions .navbar .nav-logo');
  logo.addEventListener('pointerenter', () => { makeBot().catch(() => {}); });
  logo.addEventListener('dragstart', e => e.preventDefault());
  logo.addEventListener('pointerdown', e => {
    if (e.button || e.pointerType === 'touch') return;
    const y0 = e.clientY;
    let lx = e.clientX, ly = e.clientY, pulled = false, up = false;
    /* 봇을 읽는 동안(첫 한 번은 모듈을 받는다)에도 손 위치는 계속 따라 둔다.
       다 읽기 전에 손을 놓았으면 놓은 자리에 내려놓는다 */
    const move = ev => {
      lx = ev.clientX; ly = ev.clientY;
      if (pulled || ly - y0 < 16) return;
      pulled = swallow = true;
      arm(lx, ly).then(() => {
        if (up) return land(lx, ly);
        stop();
        hold(lx, ly);
      }).catch(stop);
    };
    const release = () => { up = true; stop(); };
    const stop = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', release);
      removeEventListener('pointercancel', release);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', release);
    addEventListener('pointercancel', release);
  });
  /* 끌고 난 뒤 따라오는 click 은 홈으로 가는 링크를 누른 게 아니다 */
  logo.addEventListener('click', e => { if (swallow) { e.preventDefault(); swallow = false; } });
  addEventListener('pointerup', () => setTimeout(() => { swallow = false; }, 0));
  /* 키보드: 로고에서 ↓ 로 부르고, 고른 칸이 있으면 바로 앉힌다 */
  logo.addEventListener('keydown', async e => {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    const r = logo.getBoundingClientRect();
    await arm(r.left + r.width / 2, r.bottom + BOT);
    if (PICK && !PICK.gone) seat(PICK.el);
  });
}

/* ── 경쟁전 시작 ─────────────────────────────────────── */
let quitNote = '';
async function go(slug) {
  if (!token()) { tell('rkNeedLogin'); $('#signinLink').click(); return; }
  const name = readName();
  if (!name) {
    tell('rkNeedName');
    $('#rkName').hidden = false;
    $('#rkNameIn').focus();
    return;
  }
  let d;
  try { d = await ask('/ranked/start', { c: slug, name }); }
  catch (e) {
    if (armed) tell(e.status === 401 ? 'rkNeedLogin' : 'rkFail');
    return;
  }
  quitNote = d.quit ? t('rkQuit', { n: -d.quit }) : '';
  if (armed) { disarm(); layer.hidden = true; }
  start(slug, null, { id: d.id, secs: d.secs });
}
function wireStart() {
  /* 캡처 단계에서 먼저 받는다 — app.js 의 일반 시작·칸 고르기·Esc 보다 앞선다 */
  document.addEventListener('click', e => {
    if (e.target.closest('#again') && G && G.ranked) {
      e.stopImmediatePropagation();
      go(G.slug);
      return;
    }
    if (!armed || document.body.matches('.signing, .setting, .paging')) return;
    if (e.target.closest('#navPlay')) {
      e.stopImmediatePropagation();
      if (bot.tile) go(TILE.get(bot.tile).slug);
      else tell('rkNeedTile');
      return;
    }
    const tile = e.target.closest('#courseBtns .grid-btn');
    if (tile) { e.stopImmediatePropagation(); seat(tile); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !armed || !regionsOn()) return;
    if (document.body.matches('.signing, .setting, .paging')) return;
    e.stopImmediatePropagation();
    disarm();
  }, true);
  $('#rkName').addEventListener('submit', e => {
    e.preventDefault();
    /* app.js 의 plain() 과 같은 자 — 중계기가 다듬은 이름과 어긋나지 않게 */
    const name = plain($('#rkNameIn').value);
    if (!name) return tell('badName', null, true);
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    if (bot?.tile) go(TILE.get(bot.tile).slug);
  });
  addEventListener('resize', () => { if (armed && bot && !bot.tile) place(bot.x, bot.y); });
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
wireStart();
if (PAGES.includes(location.hash.slice(1))) openPage(location.hash.slice(1));
})();
