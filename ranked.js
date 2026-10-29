/* regiontype 경쟁전 · 순위 · 기록.

   순위(#ranking)·기록(#records)·내 계정(#account)은 설정처럼 제 페이지가 아니라 홈 위에
   뜨는 덮개다. 전환은 style.css 의 body.paging 이 맡고, 주소에는 해시만 남는다.

   경쟁전은 아래 줄의 시작하기를 꾹 눌러 켠다. 넵바 로고를 끌어내리면 나오는 Grok
   봇은 이제 경쟁전이 아니라 홈의 도우미다(아래 '도우미 봇' 절).
   lp 셈과 부정 막기는 전부 중계기(relay/worker.mjs 의 경쟁전 절)가 한다 — 여기는
   표를 받아 app.js 의 start() 에 넘기고, 끝나면 결과를 올릴 뿐이다.

   app.js 뒤에 실려 그 전역을 빌려 쓴다: t · token · asset · start · opt · clock ·
   calm · homeTitle · aimNavShape · relayoutNavShapes · plain · showSpeed · BOOTED ·
   COURSE · PICK · G · board · LICENSES · licName · examResult.
   ponytail: 빌려 쓰는 게 이만큼 늘었다. 한 번 더 늘면 app.js 를 모듈로 나눈다. */
(function () {
'use strict';

const $ = s => document.querySelector(s);
const RELAY = self.RT_RELAY;   // relay.js
const NAME_KEY = 'rt.name';
/* relay/worker.mjs 의 plain(s, CAP.name) 과 같은 자 — 부르던 곳만 있고 정의가 없어 이름·라이선스 제출이 ReferenceError 로 죽었다 */
const plain = s => String(s ?? '').trim().slice(0, 12).replace(/[\p{C}\p{Z}]/gu, ' ').replace(/ +/g, ' ').trim();
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
  if (!r.ok) { const e = new Error(d.msg || String(r.status)); e.status = r.status; e.data = d; throw e; }
  return d;
}

/* 코스 이름은 홈 칸에서 읽는다. 서울 코스는 머리글 이름이다 */
const placeOf = slug => slug === 'kr-sgg' ? t('courseSgg') : slug === COURSE.root ? homeTitle()
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
      .filter(n => n !== el && n.tagName !== 'SCRIPT' && !['boot', 'signin', 'options', 'codes', 'feedback', 'styles', 'tabDock', 'rkLayer'].includes(n.id))
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

/* ── 내 스타일 ── 덮개가 아니라 오른쪽 아래 구석에서 올라오는 popover 다(자리는 style.css). 계정에서 열어도 계정이 그대로 남는다.
   Esc·바깥 누르기(popover 가 한다)·닫기 단추로 닫히고, 초점은 연 단추로 돌아간다 */
let styOpener = null;
const styOpen = () => $('#styles').matches(':popover-open');
function openStyles(from, tab) {
  const d = $('#styles');
  if (styOpen()) {
    if (tab === 'bot') pickStyTab($('#styTabBot'));
    else if (tab === 'game') pickStyTab($('#styTabGame'));
    return;
  }
  styOpener = from || document.activeElement;
  $('#styNote').textContent = '';
  if ($('#botSay')) $('#botSay').textContent = '';
  fillStyles();
  if (tab === 'bot') pickStyTab($('#styTabBot'));
  else if (tab === 'game') pickStyTab($('#styTabGame'));
  else if (!$('#styPanelBot').hidden) mountBotStyle();
  d.showPopover();
  (fingers() ? $('#styHead') : $('#styClose')).focus({ preventScroll: true });
}

/* ── 내 계정 ──────────────────────────────────────────
   알맹이(account/account.js)는 처음 열 때 한 번 싣는다 — 다시 열면 로그인 상태만 새로 읽힌다.
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
function syncHomeBot() {
  if (!bot) return;
  const face = readFace();
  bot.api.setShape(face.shape || 'cercle', face.gen);
  if (face.expression) bot.api.setExpression(face.expression);
  bot.api.setColour(face.colour || 'accent');
  paintTint(bot.el.querySelector('.rk-bot-motion'));
  bot.el.setAttribute('aria-label', botName());
  /* 크기가 바뀌었으면 제자리(옮겨 둔 곳이나 로고 밑)에 다시 선다 */
  const was = BOT;
  sizeBot();
  if (was !== BOT && out && !touring && !intro) { if (spot) moveTo(...spot); else place(...(phone() ? underLogo() : cornerAt(corner))); }
}
function syncBotLook() {
  syncBotStyleFromStorage();
  syncHomeBot();
}
function leftAccount() {
  dispatchEvent(new Event('rt-opt'));
  syncBotLook();
}
addEventListener('rt-bot-look', syncBotLook);

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
function sLi(i, name, at, me) {
  const li = document.createElement('li');
  li.innerHTML = '<b></b><span class="who"></span><span class="pt"></span>';
  li.querySelector('b').textContent = i + 1;
  li.querySelector('.who').textContent = name;
  const badge = document.createElement('span');
  badge.className = 'exam-badge';
  badge.dataset.grade = 'expert';
  badge.textContent = licName('expert');
  li.querySelector('.who').after(badge);
  li.querySelector('.pt').textContent = at ? new Date(at).toLocaleDateString() : '';
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
  await Promise.all(['ranked', 'normal'].map(mode => Promise.all([fillBests(n, mode), fillLicense(n, mode)])));
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
/* 라이선스 순위 — 숙련 라이선스 보유자 명단과 코스별 라이선스 최고 기록 */
async function fillLicense(n, mode) {
  const sList = $(`#${mode}SHolders`), sSay = $(`#${mode}SSay`);
  const box = $(`#${mode}LicenseBests`), boxSay = $(`#${mode}LicenseBestsSay`);
  sList.replaceChildren(); sSay.textContent = t('reading');
  box.replaceChildren(); boxSay.textContent = t('reading');
  let topData;
  try {
    topData = await ask(`/license/top?mode=${mode}`);
  } catch {
    if (n === rankReq) {
      sSay.textContent = t('boardFail');
      boxSay.textContent = t('boardFail');
    }
    return;
  }
  if (n !== rankReq) return;

  // 1. 숙련 라이선스 보유자 명단
  const sHolders = topData.holders || [];
  sList.replaceChildren(...sHolders.map((h, i) => sLi(i, h.name || t('anon'), h.s_at, h.me)));
  sSay.textContent = sHolders.length ? '' : t('holdersEmpty');

  // 2. 코스별 라이선스 순위
  const here = PICK ? PICK.slug : COURSE.root;
  const courses = [COURSE.root, ...COURSE.tiles.map(x => x.slug), 'kr-sgg'].filter((s, i, a) => a.indexOf(s) === i);   // 자수 면허는 전국 시군구에서 친다

  box.replaceChildren(...courses.map(slug => {
    const det = document.createElement('details');
    det.className = 'pg-best';
    det.innerHTML = '<summary><span class="where"></span><span class="who"></span><span class="pt"></span></summary><ol class="ranks pg-ranks"></ol><p class="pg-say" role="status"></p>';
    det.querySelector('.where').textContent = placeOf(slug);
    let read = false;
    det.addEventListener('toggle', async () => {
      if (!det.open || read) return;
      read = true;
      const ol = det.querySelector('ol'), p = det.querySelector('p');
      p.textContent = t('reading');
      try {
        const r = await ask(`/license/top?mode=${mode}&c=${encodeURIComponent(slug)}`);
        const list = r.top || [];
        ol.replaceChildren(...list.map((x, i) => {
          const li = document.createElement('li');
          li.innerHTML = '<b></b><span class="who"></span><span class="pt"></span>';
          li.querySelector('b').textContent = i + 1;
          li.querySelector('.who').textContent = x.name || t('anon');
          const badge = document.createElement('span');
          badge.className = 'exam-badge';
          badge.dataset.grade = x.grade;
          badge.textContent = LICENSES.some(l => l.id === x.grade) ? licName(x.grade) : x.grade;
          li.querySelector('.who').after(badge);
          li.querySelector('.pt').textContent = `${showSpeed(x.cpm)} · ${x.acc}%`;
          if (x.me) {
            li.classList.add('me');
            const tag = document.createElement('span');
            tag.className = 'tag'; tag.textContent = t('me');
            li.querySelector('.who').after(tag);
          }
          return li;
        }));
        p.textContent = list.length ? '' : t('ladderEmpty');
      } catch {
        read = false;
        p.textContent = t('boardFail');
      }
    });
    if (slug === here) det.open = true;
    return det;
  }));
  boxSay.textContent = courses.length ? '' : t('ladderEmpty');
}
function wireTabGroup(tablist, onSwap) {
  if (!tablist) return () => {};
  const tabs = [...tablist.querySelectorAll(':scope > [role="tab"]')];
  const pick = tab => {
    tabs.forEach(tb => {
      const on = tb === tab;
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      const p = document.getElementById(tb.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    if (onSwap) onSwap(tab);
  };
  tabs.forEach(tb => tb.addEventListener('click', () => pick(tb)));
  tablist.addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : (i + 1) % tabs.length];
    pick(next); next.focus();
  });
  return pick;
}
function wireTabs() {
  wireTabGroup($('#ranking > .pg-shell > .pg-tabs'));
  wireTabGroup($('#rkRanked .sub-tabs'));
  wireTabGroup($('#rkNormal .sub-tabs'));
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
   사이트 색은 리전 패스의 팔레트로만 바뀐다(assets/bloub/items.js 의 PASS) — 사람이 직접 고르는 칸도, 봇이 짓는 색도 없다.
   가진 팔레트를 늘어놓고, 누르면 입는다(rt.theme). 지금 색은 이 기기(rt.theme) 것이다 */
const curTheme = () => { try { return JSON.parse(localStorage.getItem('rt.theme') || 'null') || {}; } catch { return {}; } };
const sameStyle = (a, b) => THEME.every(k => (a[k.key] || '') === (b[k.key] || ''));
/* 패스 표는 buddy.js 가 이미 부르는 모듈이라 같은 주소(?v=)로 한 번만 받는다 */
const passKit = import(new URL(asset('assets/bloub/items.js'), document.baseURI).href);
/* 가진 팔레트 — [{ ref, palette }].
   ponytail: 서버가 패스 레벨을 세기 전(PLAN-pass M3)이라 무료(free) 칸만 가진다. 레벨이 오면 p.level <= 내 레벨을 더한다 */
let owned = [];
passKit.then(({ PASS, parseReward }) => {
  owned = PASS.filter(p => p.free).map(p => ({ ref: p.reward, palette: parseReward(p.reward).palette }));
  /* 가진 팔레트가 아닌 색(옛 색 직접 고르기·봇이 지은 색)은 거두고 기본 색으로 돌린다 */
  const cur = curTheme();
  if (THEME.some(k => cur[k.key]) && !owned.some(o => sameStyle(pickTheme(o.palette), cur))) {
    try { localStorage.removeItem('rt.theme'); } catch {}
    paintTheme();
  }
  try { localStorage.removeItem('rt.styles'); } catch {}
  if (styOpen()) fillStyles();
}).catch(() => {});
const palName = q => (t('pal_' + q.family) || q.family) + (q.n > 1 ? ' ' + q.roman : '');
/* 견본 하나 — 지도 점 3×3, 가운데가 강조색 */
function swatch(el, s) {
  el.classList.add('sty-swatch');
  if (HEX.test(s.block)) el.style.setProperty('--sw-block', s.block);
  if (HEX.test(s.accent)) el.style.setProperty('--sw-accent', s.accent);
  if (HEX.test(s.bg)) el.style.setProperty('--sw-bg', s.bg);
  for (let i = 0; i < 9; i++) el.append(document.createElement('i'));
  return el;
}
function fillStyles(focusRef) {
  const cur = curTheme(), ul = $('#styList');
  ul.replaceChildren(...owned.map(({ ref, palette }) => {
    const li = document.createElement('li'), on = sameStyle(pickTheme(palette), cur);
    const b = swatch(document.createElement('button'), palette);
    b.type = 'button'; b.dataset.ref = ref; b.title = palName(palette);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', palName(palette));
    b.insertAdjacentHTML('beforeend', '<span class="sty-tick" aria-hidden="true">✓</span>');
    li.append(b);
    return li;
  }));
  $('#stySay').textContent = owned.length ? '' : t('stylesEmpty');
  $('#styReset').hidden = !THEME.some(k => cur[k.key]);
  if (focusRef) (ul.querySelector(`[data-ref="${CSS.escape(focusRef)}"]`) || $('#styHead')).focus({ preventScroll: true });
}
function wearPalette(ref) {
  const o = owned.find(x => x.ref === ref);
  if (!o) return;
  try { localStorage.setItem('rt.theme', JSON.stringify(pickTheme(o.palette))); } catch { return; }
  paintTheme();
  fillStyles(ref);
  $('#styNote').textContent = t('styleWorn', { name: palName(o.palette) });
}

/* ── 봇 스타일 탭 (모양·색·크기·생성) ───────────────────────
   모양·색의 id 는 엔진(assets/bloub)이 쥐고 있고 화면 이름은 data/i18n.json 의 ch_<id> 다.
   표정 고르기는 따로 두지 않는다. 색 첫 단추('accent')는 현재 강조색(--accent)과 연동된다 */
const KO = id => (id && t('ch_' + id) !== 'ch_' + id) ? t('ch_' + id) : '';
const BOT_DEF = { shape: 'cercle', expression: 'curieux', colour: 'accent', gen: null };
const botChar = { ...BOT_DEF };
/* 마법봉이 가운데에 섰는가. 지은 모양을 입고 있으면 켜지고, 프리셋을 고르거나 판을 닫으면 꺼진다.
   지은 모양이 아직 없어도 켤 수 있다 — 그때는 말풍선만 열고 모습은 그대로 둔다 */
let botGenMode = false, botLastGen = null;
const botLists = { shape: [], colour: [] };
const botThumbs = new Map();
let botMe = null, botMounted = false, botLookAim = null, botLooking = 0, botKeepT = 0;

function syncBotStyleFromStorage() {
  const f = readFace();
  botChar.shape = f.shape || BOT_DEF.shape;
  botChar.expression = f.expression || BOT_DEF.expression;
  botChar.colour = f.colour || BOT_DEF.colour;
  botChar.gen = f.gen || null;
  if (botChar.gen) { botGenMode = true; botLastGen = botChar.gen; }
  if (botMounted) paintBotStyle();
}

function paintBotStyle() {
  const btns = [...document.querySelectorAll('#shapeChoices [data-shape]')];
  const on = btns.find(b => botGenMode ? b.dataset.shape === 'gen' : b.dataset.shape === botChar.shape && !botChar.gen);
  $('#styPanelBot .character-preview').toggleAttribute('data-gen', botGenMode);
  /* 물러난 쪽은 눌리지도 읽히지도 않게 한다(style.css 는 투명하게만 만든다) */
  $('#styPanelBot .pet-size').inert = botGenMode;
  $('#botViewGen').inert = !botGenMode;
  btns.forEach(b => { b.setAttribute('aria-pressed', String(b === on)); b.tabIndex = b === (on || btns[0]) ? 0 : -1; });
  if (on) { centreShape(on); placeShapeSlot(on); }
  $('#character')?.setAttribute('aria-label',
    `${KO(botChar.colour)} ${botChar.shape === 'gen' ? t('botSubGen') : KO(botChar.shape)}`);
  if (!botMe) return;
  botMe.setShape(botChar.shape, botChar.gen);
  botMe.setExpression(botChar.expression);
  botMe.setColour(botChar.colour);
  for (const api of botThumbs.values()) {
    api.setExpression(botChar.expression);
    api.setColour(botChar.colour);
  }
}

/* 모양 알약 — 고른 모양을 가운데에 세운다. 첫 것(마법봉)과 끝 것만 맨 위·맨 아래 끝에 붙어 위아래에 빈칸이 없다.
   그래서 첫 둘·끝 둘은 같은 굴림 자리를 나눠 쓴다 — 굴려서 끝에 닿으면 끝 것, 그 밖에서 멈추면 가장 가까운 가운데 자리의 것을 고른다.
   shapeAim 은 우리가 굴리는 목적지다 — 거기 닿은 멈춤은 고르기가 아니고, 닿기 전의 멈춤(끊긴 미끄러짐)도 고르지 않는다 */
let shapeAim = null;
function shapeTop(box, i) {
  const all = box.children, max = box.scrollHeight - box.clientHeight;
  if (i <= 0) return 0;
  if (i >= all.length - 1) return max;
  const b = all[i];
  return Math.round(Math.max(0, Math.min(max, b.offsetTop + b.offsetHeight / 2 - box.clientHeight / 2)));
}
function centreShape(b) {
  const box = b.parentElement, top = shapeTop(box, [...box.children].indexOf(b));
  if (Math.abs(box.scrollTop - top) <= 1 || shapeAim === top) return;
  shapeAim = top;
  box.scrollTo({ top });
}
/* 고른 자리 테는 알약 바탕에 박혀 가운데에 서 있다 — 모양이 그 밑을 지나간다.
   첫 것·끝 것은 가운데까지 굴러오지 못하니 테가 그쪽 끝으로 옮겨 간다(굴림이 닿을 자리 기준) */
function placeShapeSlot(b) {
  const box = b.parentElement;
  if (!box.clientHeight) return;
  const y = b.offsetTop + b.offsetHeight / 2 - shapeTop(box, [...box.children].indexOf(b)) - box.clientHeight / 2;
  box.parentElement.style.setProperty('--slot-y', Math.round(y) + 'px');
}
/* 멈춘 자리에서 고를 모양 — 가장 가까운 자리의 것. 다만 그게 고른 것 그대로인데 12px 넘게 밀었으면 민 쪽으로
   한 칸 간다 — 아이폰 타이머처럼 조금 밀어도 되튀지 않고, 세게 밀어도 두 칸씩 튀지 않는다.
   끝 둘은 굴림 자리를 나눠 쓰니 그 짝에서 출발했으면 짝으로 간다 */
function shapeAtCentre() {
  const box = $('#shapeChoices'), all = box.children, n = all.length, st = box.scrollTop;
  if (!n) return null;
  const on = [...all].findIndex(b => b.getAttribute('aria-pressed') === 'true');
  const from = on >= 0 ? shapeTop(box, on) : st;
  /* 고른 것 자리에 그대로 서 있으면 그대로다 — 나눠 쓰는 끝자리에서 짝으로 뒤집히지 않게 */
  if (Math.abs(from - st) <= 1) return on >= 0 ? all[on] : null;
  const dir = Math.sign(st - from);
  if (dir > 0 && on === 0 && n > 2 && st < shapeTop(box, 2)) return all[1];
  if (dir < 0 && on === n - 1 && n > 2 && st > shapeTop(box, n - 3)) return all[n - 2];
  /* 굴러서 끝에 닿아도 끝 것이 아니라 그 앞(첫 모양·끝에서 둘째)에 선다 — 끝 것은 한 번 더 밀어야(shapeEdgeStep) 간다 */
  let best = 1, d = Infinity;
  for (let i = 1; i < n - 1; i++) { const dd = Math.abs(shapeTop(box, i) - st); if (dd < d) { d = dd; best = i; } }
  if (best === on && Math.abs(st - from) >= 12) best = Math.min(n - 2, Math.max(1, on + dir));
  return all[best];
}
/* 끝에 닿아 더 굴러가지 않는데 그쪽으로 또 밀면 한 칸 옮긴다 — 첫 둘(마법봉·첫 모양)과 끝 둘은 같은 굴림
   자리를 나눠 써서, 이게 없으면 첫 모양에서 위로 밀어도 아무 일이 없다(빨리 튕겨 올려야만 마법봉에 닿았다) */
function shapeEdgeStep(dir, dry) {
  const box = $('#shapeChoices'), all = box.children, n = all.length, st = box.scrollTop, max = box.scrollHeight - box.clientHeight;
  const on = [...all].findIndex(b => b.getAttribute('aria-pressed') === 'true');
  const to = st <= .5 && (dir < 0 ? on === 1 : on === 0) ? (dir < 0 ? 0 : 1)
    : st >= max - .5 && (dir > 0 ? on === n - 2 : on === n - 1) ? (dir > 0 ? n - 1 : n - 2) : -1;
  if (to < 0) return false;
  if (!dry) all[to].click();
  return true;
}

async function saveBotProfile() {
  if (!token()) return;
  /* 내 계정 덮개(account.js)를 부르지 않고 직접 올린다 — openAccount() 는 /auth/me 를 다시 읽어
     방금 고른 rt.character 를 서버의 옛 face 로 덮어쓰는 경합을 일으킨다 */
  try {
    const me = await ask('/auth/me');
    const p = me?.profile || {};
    const name = readName() || p.name || '';
    if (!name) return;
    const f = readFace();
    const shape = (f.shape && f.shape !== 'gen') ? f.shape : 'cercle';
    const expression = f.expression || 'curieux';
    const colour = f.colour || 'accent';
    await ask('/auth/profile', {
      name,
      bio: localStorage.getItem('rt.bio') ?? p.bio ?? '',
      face: [shape, expression, colour].join(','),
      lang: JSON.parse(localStorage.getItem('rt.opt') || '{}').lang || p.lang || 'auto',
      handle: p.handle || '',
      botname: localStorage.getItem('rt.botname') ?? p.botname ?? '',
      push: !!p.push,
      shut: !!p.shut,
    });
  } catch {}
}

function keepBotStyle(msgKey = null) {
  const out = { shape: botChar.shape, expression: botChar.expression, colour: botChar.colour };
  if (botChar.gen) out.gen = botChar.gen;
  try {
    sessionStorage.setItem('rt.charDirty', '1');
    localStorage.setItem('rt.character', JSON.stringify(out));
  } catch { return; }
  syncHomeBot();
  if ($('#botSay') && msgKey) $('#botSay').textContent = t(msgKey);
  clearTimeout(botKeepT);
  botKeepT = setTimeout(saveBotProfile, 400);
}

function botLookTick() {
  botLooking = 0;
  if (!styOpen() || $('#styPanelBot').hidden) return;
  const f = api => { if (botLookAim) api.lookToward(botLookAim[0], botLookAim[1]); else api.lookAway(); };
  if (botMe) f(botMe);
  for (const api of botThumbs.values()) f(api);
}

function mountBotStyle() {
  if (botMounted) {
    if (botMe) botMe.start();
    syncBotStyleFromStorage();
    return;
  }
  botMounted = true;
  syncBotStyleFromStorage();
  const buddyKit = window.RT_BUDDY_P || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href);
  buddyKit.then(({ mountBuddy, TABLES }) => {
    botLists.shape = TABLES.shapes.map(x => x.id);
    botLists.colour = ['accent', ...TABLES.colours.map(x => x.id)];
    const saved = readFace();
    if (botLists.shape.includes(saved.shape) || saved.shape === 'gen') botChar.shape = saved.shape;
    if (botLists.colour.includes(saved.colour)) botChar.colour = saved.colour;
    if (saved.gen) botChar.gen = saved.gen;

    botMe = mountBuddy($('#character'), { calm, shape: botChar.shape, expression: botChar.expression, gen: botChar.gen });
    botMe.start();

    const shBox = $('#shapeChoices');
    shBox.replaceChildren();
    const wand = document.createElement('button');
    wand.type = 'button'; wand.dataset.shape = 'gen';
    wand.className = 'character-choice pet-wand';
    wand.setAttribute('aria-label', t('botSubGen')); wand.setAttribute('aria-pressed', 'false');
    wand.title = t('botSubGen');
    wand.innerHTML = '<i class="i i-wand" aria-hidden="true"></i>';
    wand.onclick = () => {
      if (botGenMode) return centreShape(wand);
      botGenMode = true;
      if (botLastGen) { botChar.shape = 'gen'; botChar.gen = botLastGen; keepBotStyle(); }
      paintBotStyle();
    };
    shBox.append(wand);
    for (const id of botLists.shape) {
      const label = KO(id) || id;
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.shape = id;
      b.className = 'character-choice';
      b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', 'false');
      b.title = label;
      const api = mountBuddy(b, { still: true, calm, shape: id, expression: botChar.expression });
      api.setColour(botChar.colour);
      api.start();
      botThumbs.set(id, api);
      b.onclick = () => {
        if (!botGenMode && botChar.shape === id && !botChar.gen) return centreShape(b);
        botGenMode = false; botChar.shape = id; botChar.gen = null; paintBotStyle(); keepBotStyle();
      };
      shBox.append(b);
    }
    /* scrollend 는 굴리기(미끄러짐 포함)가 다 끝나야 온다 — 없는 곳만 잠깐 멈춤으로 갈음한다 */
    const settle = () => {
      if (shapeAim != null) { if (Math.abs(shBox.scrollTop - shapeAim) <= 1) shapeAim = null; return; }
      const b = shapeAtCentre(); if (b) b.click();
    };
    /* 끝에서 더 밀면 곧장 넘어가지 않고 모양들이 고무줄처럼 늘어나 따라오다가(--pull) 민 거리가
       SHAPE_PULL 을 넘으면 한 칸 딸려 간다. 문턱 전에 놓으면 제자리로 되튄다.
       끝 것(마법봉·마지막 모양)을 고른 동안은 고리도 그 모양에 붙어 함께 늘어난다(--slot-pull).
       손가락은 넘어간 뒤에도 놓을 때까지 계속 늘어난다 — 넘어가는 순간 멈칫하지 않게(한 번 끄는 동안 한 칸만) */
    const SHAPE_PULL = 36, wrap = shBox.parentElement;
    let pull = 0, stepped = false, edgeQuiet = 0, letGo = 0, catching = 0, touchY = null;
    const stretch = d => {
      pull = d;
      const px = (-Math.sign(d) * 40 * (1 - Math.exp(-Math.abs(d) / 40))).toFixed(1) + 'px';
      const all = shBox.children, on = all[0]?.getAttribute('aria-pressed') === 'true' || all[all.length - 1]?.getAttribute('aria-pressed') === 'true';
      wrap.classList.toggle('is-pulling', !!d);
      wrap.style.setProperty('--pull', px);
      wrap.style.setProperty('--slot-pull', on ? px : '0px');
    };
    const atEdge = dir => dir < 0 ? shBox.scrollTop <= .5 : shBox.scrollTop >= shBox.scrollHeight - shBox.clientHeight - .5;
    /* 민 거리를 더한다. 옮길 데가 없거나 되돌려 밀면 놓아 준다. 문턱을 넘으면 옮기고 'moved' — 고리는 잠깐(is-catching)
       미끄러져 새 모양에 가 붙은 뒤로는 손을 1:1 로 따른다. 옮긴 뒤엔 정말 굴림 끝일 때만 더 늘어난다
       (마법봉에서 아래로 옮겼으면 그다음은 그냥 굴림이다) */
    const tug = d => {
      const dir = Math.sign(d);
      if (!dir || !(stepped ? atEdge(dir) : pull || shapeEdgeStep(dir, true))) { stretch(0); return false; }
      if (stepped || Math.abs(d) < SHAPE_PULL || !shapeEdgeStep(dir)) { stretch(d); return true; }
      stepped = true;
      wrap.classList.add('is-catching');
      clearTimeout(catching);
      catching = setTimeout(() => wrap.classList.remove('is-catching'), 180);
      stretch(d);
      return 'moved';
    };
    /* 휠·트랙패드. 새로 민 것(앞 휠과 250ms 넘게 떨어진 것)만 당기기 시작한다 — 굴러와 끝에 붙은 뒤에도
       이어 오는 관성 휠이 넘기지 않게. 150ms 조용하면 놓은 것이다. 휠은 따라갈 손이 없으니 옮기면 곧장 놓고,
       뒤따르는 휠은 200ms 조용해질 때까지 삼킨다 */
    let lastWheel = -Infinity;
    shBox.addEventListener('wheel', e => {
      const fresh = e.timeStamp - lastWheel > 250;
      lastWheel = e.timeStamp;
      const r = edgeQuiet || ((pull || fresh) && tug((Math.sign(e.deltaY) === Math.sign(pull) ? pull : 0) + e.deltaY));
      if (!r) return;
      e.preventDefault();
      clearTimeout(letGo);
      if (edgeQuiet || r === 'moved') {
        stretch(0);
        stepped = false;
        clearTimeout(edgeQuiet);
        edgeQuiet = setTimeout(() => { edgeQuiet = 0; }, 200);
      } else letGo = setTimeout(() => { stretch(0); stepped = false; }, 150);
    }, { passive: false });
    /* 손가락 — 끝에 닿은 자리부터 당긴 거리를 잰다 */
    shBox.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
    shBox.addEventListener('touchmove', e => {
      if (touchY == null) return;
      const y = e.touches[0].clientY;
      if (tug(touchY - y)) { if (e.cancelable) e.preventDefault(); }
      else touchY = y;
    }, { passive: false });
    for (const ev of ['touchend', 'touchcancel']) shBox.addEventListener(ev, () => { touchY = null; stepped = false; stretch(0); }, { passive: true });
    /* 사람이 손대면 우리 목적지는 버린다 */
    for (const ev of ['wheel', 'touchstart', 'pointerdown']) shBox.addEventListener(ev, () => { shapeAim = null; }, { passive: true });
    let still = 0;
    if ('onscrollend' in shBox) shBox.onscrollend = settle;
    else shBox.onscroll = () => { clearTimeout(still); still = setTimeout(settle, 140); };
    shBox.onkeydown = e => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const all = [...shBox.children], i = all.indexOf(document.activeElement);
      const next = all[e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.min(all.length - 1, Math.max(0, i + (e.key === 'ArrowUp' ? -1 : 1)))];
      next.click(); next.focus({ preventScroll: true });
    };
    paintBotStyle();
  }).catch(err => {
    console.error('[styles] 캐릭터 엔진', err);
    if ($('#character')) $('#character').textContent = t('acctCharFail');
  });
}

function pickStyTab(tab) {
  const tabs = [$('#styTabGame'), $('#styTabBot')];
  tabs.forEach(tb => {
    const on = tb === tab;
    tb.setAttribute('aria-selected', String(on));
    tb.tabIndex = on ? 0 : -1;
    document.getElementById(tb.getAttribute('aria-controls')).hidden = !on;
  });
  if (tab === $('#styTabBot')) mountBotStyle();
}

/* 할로윈 낱말 → 모델을 기다리지 않고 곧바로 입힐 프리셋. 앞의 것이 이긴다(할로윈·spooky 는 맨 끝의 덮개).
   모델 답에 look 이 오면 그걸로 다듬는다 */
const SPOOKY = [
  [/호박|잭오랜턴|\bpumpkin|\bjack-?o/i, { shape: 'citrouille', colour: 'orange', expression: 'hilare' }],
  [/유령|귀신|\bghost/i, { shape: 'goutte', colour: 'creme', expression: 'effraye' }],
  [/박쥐|\bbats?\b/i, { shape: 'eclat', colour: 'encre', expression: 'mefiant' }],
  [/마녀|\bwitch/i, { shape: 'triangle', colour: 'violet', expression: 'fier' }],
  [/뱀파이어|드라큘라|흡혈귀|\bvampire|\bdracula/i, { shape: 'pentagone', colour: 'rouge', expression: 'mefiant' }],
  [/해골|\bskull|\bskeleton/i, { shape: 'galet', colour: 'creme', expression: 'blase' }],
  [/좀비|\bzombie/i, { shape: 'galet', colour: 'vert', expression: 'somnolent' }],
  [/고양이|\bcats?\b/i, { shape: 'squircle', colour: 'encre', expression: 'curieux' }],
  [/할로윈|핼러윈|\bhalloween|\bspooky/i, { shape: 'citrouille', colour: 'orange', expression: 'heureux' }],
];
function spookyLook(text) {
  const hit = SPOOKY.find(([re]) => re.test(text));
  return hit && { act: 'look', ...hit[1] };
}

/* 낱말도 모델 답도 없을 때 설명을 해시해 빚는 모양. 같은 설명이면 같은 모양이다 */
function hashGen(text) {
  const h = [...text].reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0) >>> 0;
  return {
    lobes: 3 + (h % 7),
    amp: +((0.1 + ((h >>> 3) % 15) * 0.01) * ((h >>> 2) % 2 ? 1 : -1)).toFixed(2),
    sharp: +(0.8 + ((h >>> 7) % 14) * 0.1).toFixed(2),
    sx: +(0.9 + ((h >>> 11) % 5) * 0.05).toFixed(2),
    sy: +(0.9 + ((h >>> 14) % 5) * 0.05).toFixed(2),
    stem: /사과|체리|귤|열매|모자|꼭지|apple|cherry|fruit|hat|stem/i.test(text),
  };
}

async function generateBotLook(promptText) {
  const btn = $('#botGenBtn'), inp = $('#botGenIn'), note = $('#botSay');
  if (!promptText || btn.disabled) return;
  btn.disabled = true; inp.disabled = true;
  btn.textContent = t('botGenBusy');
  note.textContent = t('botProgLook');
  const quick = spookyLook(promptText);
  let changed = !!quick;
  if (quick) act(quick);
  try {
    /* 워커가 한 줄을 400자(BOT_LINE)에서 자른다 — 설명(최대 160자)이 들어갈 자리를 남긴다. 자세한 꼴은 시스템 프롬프트에 있다 */
    const askPrompt = `Change your look to match: "${promptText}". Reply with a look act: a preset shape if one truly fits, otherwise draw the outline with gen.pts; add a matching colour and expression.`;
    const d = await ask('/bot/chat', {
      msgs: [{ role: 'user', content: askPrompt }],
      courses: botCourses(),
      lang: document.documentElement.lang,
      name: botName(),
      now: botNow(),
    }, true);
    const look = (d.do || []).find(a => a.act === 'look');
    if (look) act(look);
    else if (!quick) act({ act: 'look', shape: 'gen', gen: hashGen(promptText) });
    changed = true;
    note.textContent = d.say || '';
  } catch (e) {
    /* 프리셋을 이미 입혔으면 그대로 둔다 — 모델이 못 다듬었을 뿐이다 */
    note.textContent = quick ? '' : t(e.status === 429 ? 'botBusy' : 'botChatFail');
  } finally {
    if (changed) saveBotProfile();
    btn.disabled = false; inp.disabled = false;
    btn.textContent = t('botGenBtn');
  }
}

function wireStyles() {
  const d = $('#styles');
  $('#styClose').addEventListener('click', () => d.hidePopover());
  const styTabs = [$('#styTabGame'), $('#styTabBot')];
  styTabs.forEach(tb => tb.addEventListener('click', () => pickStyTab(tb)));
  $('#styles .sty-tabs').addEventListener('keydown', e => {
    const i = styTabs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = styTabs[e.key === 'Home' ? 0 : e.key === 'End' ? styTabs.length - 1 : (i + 1) % styTabs.length];
    pickStyTab(next); next.focus();
  });
  $('#botReset').addEventListener('click', () => {
    Object.assign(botChar, BOT_DEF);
    botGenMode = false;
    const size = $('#botSize');
    if (size) {
      size.value = 100;
      size.setAttribute('aria-valuetext', '100%');
      document.documentElement.style.setProperty('--bot-scale', 1);
      try { localStorage.setItem('rt.botsize', '1'); } catch {}
    }
    paintBotStyle();
    keepBotStyle();
  });
  $('#botViewGen').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#botGenIn').value.trim();
    if (text) generateBotLook(text);
  });
  {
    const size = $('#botSize');
    let v = 1;
    try { const sv = +localStorage.getItem('rt.botsize'); if (sv >= .7 && sv <= 1.3) v = sv; } catch {}
    size.value = Math.round(v * 100);
    const show = () => {
      size.setAttribute('aria-valuetext', size.value + '%');
      document.documentElement.style.setProperty('--bot-scale', size.value / 100);
      try { localStorage.setItem('rt.botsize', String(size.value / 100)); } catch {}
      dispatchEvent(new Event('rt-bot-look'));
    };
    show();
    size.addEventListener('input', show);
    size.addEventListener('change', () => { try { localStorage.setItem('rt.botsize', String(size.value / 100)); } catch {} });
  }
  addEventListener('pointermove', e => {
    if (!styOpen() || $('#styPanelBot').hidden) return;
    botLookAim = [e.clientX, e.clientY];
    botLooking ||= requestAnimationFrame(botLookTick);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    if (!styOpen() || $('#styPanelBot').hidden) return;
    botLookAim = null;
    botLooking ||= requestAnimationFrame(botLookTick);
  });
  /* 덮개 손(Esc·Tab 가두기)과 홈의 글쇠 손이 뒤에서 받지 않게 — 닫기(Esc)는 popover 의 기본 동작이라 그대로 산다 */
  d.addEventListener('keydown', e => e.stopPropagation());
  d.addEventListener('toggle', e => {
    if (e.newState !== 'closed') return;
    botGenMode = false;
    document.body.classList.remove('rk-styling');
    /* 바깥의 다른 것을 눌러 닫혔으면 그 초점을 빼앗지 않는다 */
    const back = document.activeElement === document.body || d.contains(document.activeElement);
    if (back && styOpener && styOpener.isConnected) styOpener.focus({ preventScroll: true });
    styOpener = null;
  });
  d.addEventListener('click', e => {
    const b = e.target.closest('#styList .sty-swatch');
    if (b) wearPalette(b.dataset.ref);
    else if (e.target.closest('#styReset')) {
      act({ act: 'theme', reset: true });
      fillStyles();
      $('#styNote').textContent = t('styleResetDone');
      $('#styHead').focus({ preventScroll: true });
    }
  });
}

/* ── 도우미 봇 ───────────────────────────────────────────
   Grok 봇은 홈의 도우미고, 로고 안에 산다. 나올 때는 로고 점이 로고를 채우고 그 뒤에서
   걸어 나온다(emerge).
   처음 온 사람이나 가입하고 처음 홈에 오면(rt.rescue — auth.js 가 새 계정에, RT_BOOT_PLACE 가
   첫 방문에 남긴다) 넵바만 두고 홈을
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
    const api = mountBuddy(motion, { calm, shape: face.shape || 'cercle', expression: face.expression || 'curieux', gen: face.gen });
    api.setColour(face.colour || 'accent');
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
  const d = $('#tabDock'), lr = logo().getBoundingClientRect();
  return [lr.height > 0 && lr.top >= 0 ? lr.top : 16, d && d.offsetHeight ? d.getBoundingClientRect().top - 8 : innerHeight];
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
  const nr = $('#regions .navbar').getBoundingClientRect();
  const top = nr.height > 0 && nr.bottom > 12 ? nr.bottom + 12 : 84;
  const x = i % 2 ? innerWidth - BOT - 20 : 20;
  /* 아래 막대와 겹치는 아래 귀퉁이는 막대 위로 올린다 */
  const dock = $(fingers() ? '#tabDock' : '#regions .nav-bot').getBoundingClientRect();
  const low = dock.height > 0 && dock.top < innerHeight && x < dock.right && x + BOT > dock.left
    ? dock.top - BOT - 8 : innerHeight - BOT - 24;
  return [x, i < 2 ? top : Math.min(innerHeight - BOT - 24, low)];
}
const narrow = () => !phone() && innerWidth < 760;
/* 인사하는 자리. 폰이 아니면 말풍선이 도트를 덮지 않는 곳 — 로고 밑 가운데는 지도 머리(도봉)를
   덮는다. 위 두 귀퉁이에서 말풍선을 아래·안쪽으로 펴 보고, 봇과 말풍선이 도트 하나라도 덮으면
   다음 자리를 본다. 다 덮으면 null(로고 밑 그대로) */
const GREET_W = 300, GREET_H = 72;
function greetSpot() {
  if (phone()) return null;
  const dots = document.body.matches('.signing, .setting, .paging') ? []
    : [...document.querySelectorAll('#courseBtns .course-map')]
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
  if (!(r.height > 0 && r.bottom > 0)) return [innerWidth / 2 - BOT / 2, 60];
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
  if (!(r.height > 0 && r.bottom > 0)) return [innerWidth / 2 - BOT / 2, -BOT];
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
  const nowPage = document.body.classList.contains('setting') ? 'settings' : (page || 'home');
  return { opt: { ...DEF, ...o }, page: nowPage, signed: !!token(), named: !!readName(), dev: DEV,
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
  if (bot) paintTint(bot.el.querySelector('.rk-bot-motion'));
}
const PAGE_LINK = { settings: 'settings/', community: 'community/', about: 'about/' };
function leaveOver() {
  if (page) closePage(true);
  if (document.body.classList.contains('setting')) dispatchEvent(new Event('rt-tab-swap'));
}
function act(a) {
  if (a.act === 'duel' && botCourses().some(x => x.slug === a.course)) { leaveOver(); go(a.course, true); return; }
  if (a.act === 'post') {
    /* 초안만 — 커뮤니티 화면이 받아 글쓰기 칸에 채워 열고, 올리기는 사람이 누른다 */
    try { sessionStorage.setItem('rt.cmDraft', JSON.stringify({ tag: a.tag, title: a.title, body: a.body })); } catch { return; }
    act({ act: 'open', page: 'community' });
    return;
  }
  if (a.act === 'look') {
    const face = readFace();
    for (const k of ['shape', 'expression', 'colour']) if (a[k]) face[k] = a[k];
    if (a.gen) { face.gen = a.gen; if (!a.shape) face.shape = 'gen'; }
    else if (a.shape && a.shape !== 'gen') delete face.gen;
    try {
      sessionStorage.setItem('rt.charDirty', '1');
      localStorage.setItem('rt.character', JSON.stringify(face));
    } catch { return; }
    leftAccount();
    return;
  }
  /* 색은 패스 팔레트로만 바뀐다 — 봇이 지은 색은 받지 않고, 기본 색으로 돌리기만 받는다 */
  if (a.act === 'theme') {
    if (!a.reset) return;
    try { localStorage.removeItem('rt.theme'); } catch { return; }
    paintTheme();
    return;
  }
  if (a.act === 'start' && botCourses().some(x => x.slug === a.course)) {
    leaveOver();
    /* 경쟁전은 꾹 누른 시작하기와 같은 길(go) — 로그인·이름이 없으면 봇이 그걸 조른다 */
    if (a.ranked) { go(a.course); return; }
    hide();
    doze();
    start(a.course);
  } else if (a.act === 'set') {
    /* 설정 통의 주인은 settings.js 다 — 거기서 저장하고 화면에 알린다 */
    dispatchEvent(new CustomEvent('rt-bot-opt', { detail: { [a.key]: a.value } }));
  } else if (a.act === 'open') {
    if (PAGES.includes(a.page)) {
      if (document.body.classList.contains('setting')) dispatchEvent(new Event('rt-tab-swap'));
      openPage(a.page);
      return;
    }
    if (a.page === 'styles') { openStyles(document.body); return; }
    if (a.page === 'feedback') { openFeedback(); return; }
    if (a.page === 'home') {
      if (page) closePage();
      if (document.body.classList.contains('setting')) ($('#optClose') || { click: () => dispatchEvent(new Event('rt-tab-swap')) }).click();
      if ($('#result').classList.contains('on')) $('#result [data-go="regions"]')?.click();
      return;
    }
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
function progDone() {
  clearInterval(progT);
  progPaint(100); progHide = setTimeout(progStop, 300);
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
  progDone();
  const said = d.say || '👍';
  talk.push({ role: 'assistant', content: said });
  if (chatting) {
    setTalkUI('response');
    speak(said);
  }
  /* 동작은 말을 보여 준 뒤에 — 무엇을 하려는지 먼저 읽힌다 */
  (d.do || []).forEach(act);
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
      leaveOver();
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
    /* 내 스타일을 여는 동안 봇과 말풍선은 물러난다(body.rk-styling) — 닫히면 대화째 돌아온다 */
    if (chip === 'styles') { document.body.classList.add('rk-styling'); openStyles(btn); return; }
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
  punch();
  requestAnimationFrame(peekFrame);
}
/* 데스크톱은 봇 층이 넵바 위로 올라 막이 넵바까지 어둡게 덮고, 봇 손이 넵바 위로 나온다(style.css).
   로고 알약 자리만 막과 봇에서 오려 내 — 로고가 밝게 비치고 봇은 그 뒤에 갇혀 보인다.
   clip-path 라 오린 자리는 누름도 로고로 간다 */
function punch() {
  const r = logo().getBoundingClientRect();
  const pill = (x, y) => { const h = r.height / 2; return `M${x + h} ${y}H${x + r.width - h}A${h} ${h} 0 0 1 ${x + r.width - h} ${y + r.height}H${x + h}A${h} ${h} 0 0 1 ${x + h} ${y}Z`; };
  dim.style.clipPath = `path(evenodd,"M0 0H${innerWidth}V${innerHeight}H0Z${pill(r.left, r.top)}")`;
  bot.el.style.clipPath = `path(evenodd,"M-9999 -9999H9999V9999H-9999Z${pill(r.left - bot.x, r.top - bot.y)}")`;
}
function endIntro() {
  if (!intro) return;
  intro = false;
  try { localStorage.removeItem(RESCUE_KEY); } catch {}
  document.body.classList.remove('rk-intro');
  dim.hidden = true;
  dim.style.clipPath = '';
  if (bot) bot.el.style.clipPath = '';
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

/* ── 시작하기 → 일반전 / 경쟁전 ─────────────────────────
   시작하기를 누르면 그 바로 위에 고르기 판(#modePick)이 뜬다. 짧게 누르면 그 모드로 간다 —
   경쟁전은 지금 고른 칸(없으면 전체 코스)으로 1대1 매칭이다.
   라이선스는 시작하기를 꾹(1.2초) 눌러서만 켜진다(다시 꾹 누르면 꺼진다) — 예전에 꾹 눌러
   경쟁전을 켜던 자리다. 누르는 동안 알약이 차오르고(움직임을 끄면 남은 초가 글자로 보인다),
   다 차기 전에 떼거나 단추 밖으로 나가면 없던 일이 된다. 키보드는 Space 를 누르고 있으면 된다.
   켜져도 아직 응시할 면허 고르기(openExam)는 띄우지 않는다 */
const EXAM_HOLD_MS = 1200;
let ranked = false, licensed = false, swallowPlay = false;
const rankedSlug = () => PICK ? PICK.slug : COURSE.root;
function setRanked(on) {
  ranked = on;
  document.body.classList.toggle('rk-ready', on);
  if (bot) paintTint(bot.el.querySelector('.rk-bot-motion'));
  paintPlay();
}
function setLicensed(on) {
  licensed = on;
  document.body.classList.toggle('lic-ready', on);
  paintPlay();
}
/* 시작하기 라벨 — 라이선스가 켜졌으면 '라이선스 시험'(색만이 아니라 글자로도 보인다) */
function paintPlay() {
  const play = $('#navPlay');
  play.dataset.i18n = licensed ? 'examToggle' : ranked ? 'rankedStart' : 'start';
  play.textContent = t(play.dataset.i18n);
  relayoutNavShapes();
}
const pickOpen = () => $('#modePick').matches(':popover-open');
const quietMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
/* 데스크톱은 아래 알약을 통째로 덮는다 — 시작하기 알약이 둘로 갈라져 설정·계정 자리까지 벌어진다.
   폰은 시작하기가 tab-dock 안으로 옮겨 가니 그 바로 위, 가운데에 세운다 */
function placePick() {
  const d = $('#modePick'), bar = $('#navPlay').closest('.nav-bot');
  d.classList.toggle('is-split', !!bar);
  if (bar) {
    const r = bar.getBoundingClientRect();
    Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    return;
  }
  d.style.width = d.style.height = '';
  const a = $('#navPlay').getBoundingClientRect(), PAD = 12, GAP = 10;
  const w = d.offsetWidth, h = d.offsetHeight;
  d.style.left = Math.round(Math.min(Math.max(PAD, a.left + a.width / 2 - w / 2), innerWidth - w - PAD)) + 'px';
  d.style.top = Math.round(Math.max(PAD, a.top - GAP - h)) + 'px';
}
function closePick(back) {
  if (!pickOpen()) return;
  $('#modePick').hidePopover();
  if (back) $('#navPlay').focus({ preventScroll: true });
}
/* 꾹 누르기 하나. 짧으면 onTap, 다 차면 onHold. 꾹 뒤에 따라오는 click 은 삼킨다 */
function wireHold(btn, onTap, onHold) {
  let timer = 0, tick = 0, held = false, t0 = 0;
  const stop = () => {
    clearTimeout(timer); clearInterval(tick); timer = tick = 0;
    btn.classList.remove('is-holding');
    delete btn.dataset.left;
  };
  const step = () => {
    const left = Math.max(0, Math.ceil((EXAM_HOLD_MS - (Date.now() - t0)) / 1000));
    btn.dataset.left = t('examLeft', { n: left });
  };
  const begin = () => {
    if (timer) return;
    held = false; t0 = Date.now();
    btn.style.setProperty('--hold-ms', EXAM_HOLD_MS + 'ms');
    btn.classList.add('is-holding');
    if (quietMotion()) step();
    tick = setInterval(() => { if (quietMotion()) step(); }, 100);
    timer = setTimeout(() => {
      stop();
      held = true;
      try { navigator.vibrate?.(20); } catch {}
      onHold();
    }, EXAM_HOLD_MS);
  };
  btn.addEventListener('pointerdown', e => { if (!e.button) begin(); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(n => btn.addEventListener(n, stop));
  btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) begin(); });
  ['keyup', 'blur'].forEach(n => btn.addEventListener(n, stop));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('click', e => {
    if (held) { held = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    onTap();
  });
}
function pickNote(msg) {
  const p = $('#modeNote');
  if (p) p.textContent = msg || '';
}
/* 라이선스 시험 진입 창 — 다섯 면허를 아래에서 위로 늘어놓고 하나를 고른다(라디오 묶음, ↑↓ 로 옮긴다).
   딴 면허 바로 위 하나까지만 열린다. 상태는 글자(합격·응시 가능·잠김)와 표시·테두리로 가른다 */
const koOnly = lic => !!lic.chars && LANG !== 'ko';
function condOf(lic) {
  const p = [t('examLeft', { n: lic.secs })];
  if (lic.chars) p.push(t('examDone'));
  if (lic.cpm) p.push(showSpeed(lic.cpm));
  p.push(`${t('accuracy')} ${lic.acc}%`);
  if (lic.miss != null) p.push(t('examMissMax', { n: lic.miss }));
  return p.join(' · ');
}
function paintLicenses(d, best, slug) {
  const rows = $('#examRows'), have = best ? LICENSES.findIndex(l => l.id === best) : -1;
  const state = (lic, i) => i <= have ? 'pass' : i > have + 1 || koOnly(lic) ? 'lock' : 'open';
  const pick = id => {
    d.dataset.tier = id;
    rows.querySelectorAll('[role=radio]').forEach(b => {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $('#examGo').disabled = false;
    $('#examNote').textContent = '';
  };
  rows.replaceChildren(...LICENSES.map((lic, i) => {
    const st = state(lic, i), b = document.createElement('button');
    b.type = 'button'; b.className = 'lic-row'; b.dataset.id = lic.id; b.dataset.st = st;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.tabIndex = -1;
    if (st === 'lock') b.setAttribute('aria-disabled', 'true');
    const course = koOnly(lic) ? t('examKoOnly')
      : lic.chars ? `${t('courseSgg')} · ${t('examCourseSgg', { n: lic.chars })}`
      : t('examCoursePick', { name: placeOf(slug) });
    b.innerHTML = '<span class="lic-name"></span><span class="lic-state"></span><span class="lic-course"></span><span class="lic-cond"></span>';
    b.querySelector('.lic-name').textContent = licName(lic.id);
    b.querySelector('.lic-state').textContent = t({ pass: 'examPass', open: 'examOpen', lock: 'examLock' }[st]);
    b.querySelector('.lic-course').textContent = course;
    b.querySelector('.lic-cond').textContent = condOf(lic);
    b.addEventListener('click', () => { if (st !== 'lock') pick(lic.id); });
    return b;
  }));
  const ok = [...rows.children].filter(b => b.dataset.st !== 'lock');
  const first = rows.querySelector(`[data-id="${LICENSES[Math.min(have + 1, LICENSES.length - 1)].id}"]`);
  const sel = first && first.dataset.st !== 'lock' ? first : ok[ok.length - 1];
  if (sel) pick(sel.dataset.id);
  else { $('#examGo').disabled = true; rows.firstElementChild.tabIndex = 0; }
}
async function openExam(mode) {
  closePick();
  if (!token()) {
    pickNote(t('signinBtn'));
    openPage('account');
    return;
  }
  const slug = rankedSlug();
  const d = $('#examGate');
  d.dataset.mode = mode;
  delete d.dataset.tier;
  $('#examTitle').textContent = `${placeOf(slug)} · ${t(mode === 'ranked' ? 'rankedTab' : 'normalTab')}`;
  $('#examLede').textContent = t('examLede');
  $('#examNote').textContent = '';
  $('#examRows').replaceChildren();
  $('#examGo').disabled = true;
  d.showModal();
  let best = null;
  try { best = ((await ask('/license/me')).best || {})[mode] || null; } catch {}   // 못 읽으면 처음부터
  if (d.open && d.dataset.mode === mode) {
    paintLicenses(d, best, slug);
    ($('#examRows').querySelector('[aria-checked=true]') || $('#examRows').firstElementChild)?.focus({ preventScroll: true });
  }
}
function wireModePick() {
  const d = $('#modePick'), play = $('#navPlay');
  const pick = mode => {
    closePick();
    if (mode === 'ranked') {
      setRanked(true);
      go(rankedSlug());
      return;
    }
    setRanked(false);
    playNormal();
  };
  $('#modeNormal').addEventListener('click', () => pick('normal'));
  $('#modeRanked').addEventListener('click', () => pick('ranked'));
  /* 꾹 뒤에 따라오는 click 은 wireStart 가 삼킨다 — 거기서 먼저 받아 propagation 을 끊기 때문이다 */
  ['pointerdown', 'keydown'].forEach(n => play.addEventListener(n, () => { swallowPlay = false; }));
  wireHold(play, () => {}, () => { swallowPlay = true; setLicensed(!licensed); });
  /* 시작하기 위에 올린 채 트랙패드를 핀치해도 켜고 끈다 — 크롬·파이어폭스는 ctrl+wheel, 사파리는 gesture 로 온다.
     한 번 집는 동안 이벤트가 줄줄이 오니 300ms 조용해질 때까지 한 번만 친다. 화면 확대는 막는다 */
  let pinchQuiet = 0;
  const pinched = e => {
    e.preventDefault();
    if (!pinchQuiet) setLicensed(!licensed);
    clearTimeout(pinchQuiet);
    pinchQuiet = setTimeout(() => { pinchQuiet = 0; }, 300);
  };
  play.addEventListener('wheel', e => { if (e.ctrlKey) pinched(e); }, { passive: false });
  ['gesturestart', 'gesturechange'].forEach(n => play.addEventListener(n, pinched));
  /* 시작하기가 판을 여닫는다 — popovertarget 이라 바깥 누르기로 닫힌 직후 다시 열리는 일이 없다.
     ranked.js 가 없으면 이 줄도 없으니 app.js 가 곧장 일반전을 친다 */
  play.setAttribute('popovertarget', 'modePick');
  d.addEventListener('beforetoggle', e => {
    if (e.newState !== 'open') return;
    pickNote('');
    play.setAttribute('aria-expanded', 'true');
    placePick();
  });
  d.addEventListener('toggle', e => {
    if (e.newState !== 'open') { play.setAttribute('aria-expanded', 'false'); return; }
    placePick();
    $('#modeNormal').focus({ preventScroll: true });
  });
  play.setAttribute('aria-expanded', 'false');
  addEventListener('resize', () => { if (pickOpen()) placePick(); });
  /* 판이 떠 있는 동안 Esc 는 판만 닫는다 — 홈의 Esc(고른 칸 풀기)까지 가지 않게 먼저 받는다 */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !pickOpen()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    closePick(true);
  }, true);
  $('#examClose').addEventListener('click', () => $('#examGate').close());
  /* 라디오 묶음: ↑↓←→ 로 열린 면허만 옮긴다 */
  $('#examRows').addEventListener('keydown', e => {
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    const open = [...$('#examRows').children].filter(b => b.dataset.st !== 'lock');
    const at = open.indexOf(document.activeElement);
    if (at < 0 || !open.length) return;
    e.preventDefault();
    const nx = open[(at + dir + open.length) % open.length];
    nx.focus(); nx.click();
  });
  $('#examGo').addEventListener('click', async () => {
    const d = $('#examGate');
    const mode = d.dataset.mode || 'normal';
    const lic = LICENSES.find(l => l.id === d.dataset.tier);
    if (!lic) return;
    const slug = lic.chars ? 'kr-sgg' : rankedSlug();
    const goBtn = $('#examGo'), note = $('#examNote');
    goBtn.disabled = true;
    note.textContent = '';
    try {
      const res = await ask('/license/start', { c: slug, mode, tier: lic.id, dev: DEV, lang: LANG });
      d.close();
      start(res.slug || slug, null, null, { mode, id: res.id, tier: res.tier || lic.id, names: res.names });
    } catch (e) {
      goBtn.disabled = false;
      if (e.status === 403 && e.data && e.data.error === 'locked') {
        note.textContent = t('examLocked', { name: licName(e.data.need) });
      } else if (lic.chars) {
        note.textContent = t('examNeedServer');   // 이름 묶음은 서버가 뽑는다 — 오프라인 판은 없다
      } else {
        /* 코스 면허는 중계기가 없어도 로컬로 칠 수 있다(기록은 남지 않는다) */
        d.close();
        start(slug, null, null, { mode, id: 'exam-' + Date.now().toString(36), tier: lic.id });
      }
    }
  });
  $('#examGate').addEventListener('close', () => play.focus({ preventScroll: true }));
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
    if (e.target.closest('#again')) {
      if (!touring) { hide(); doze(); }
      if (G && G.exam) {
        e.stopImmediatePropagation();
        openExam(G.exam.mode);
        return;
      }
      if (G && G.ranked) {
        e.stopImmediatePropagation();
        go(G.slug);
      }
      return;
    }
    if (!e.target.closest('#navPlay')) return;
    /* 꾹 눌러 라이선스를 켜고 끈 뒤 손을 떼며 오는 click 은 판을 열지 않는다 */
    if (swallowPlay) { swallowPlay = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
    /* 안내 도중에 시작하면 안내는 거기서 끝난다 — 판에서 돌아왔을 때 매달려 있지 않게 */
    quitTour();
    if (!touring) { hide(); doze(); }
    /* 일반 시작(app.js)은 막는다 — 시작하기는 고르기 판을 여닫는다(popovertarget) */
    e.stopImmediatePropagation();
    if (document.body.matches('.signing, .setting, .paging')) return;
    /* 라이선스가 켜져 있으면('라이선스 시험') 판 대신 지금 응시할 수 있는 면허 고르기를 연다.
       봇이 경쟁전을 켜 뒀으면 경쟁전 면허다 */
    if (licensed) { e.preventDefault(); openExam(ranked ? 'ranked' : 'normal'); return; }
    /* 봇이 켜 둔 경쟁전(rk-ready)이면 판을 열지 않고 곧장 겨룬다 */
    if (!ranked) return;
    e.preventDefault();
    go(rankedSlug());
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && chatting) {
      /* 내 스타일이 떠 있으면 Esc 는 그것부터 닫는다(popover 기본 동작) — 대화는 그 뒤에 */
      if (styOpen()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      endChat();
      return;
    }
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
  if (g.exam) {
    /* 라이선스 시험 판을 서버에 제출한다 */
    try {
      const res = await ask('/license/end', {
        id: g.exam.id,
        hits: g.hits,
        tries: g.tries,
        cpm: g.cpm,
        acc: g.acc,
        score: g.score,
        name: plain(localStorage.getItem(NAME_KEY) || '')
      });
      if (G === g) examResult(res);   // 서버 판정으로 결과 칸을 고친다. 합격하면 다음 면허가 열렸다고 알린다
    } catch (err) {
      console.warn('License submission failed', err);
    }
    return;
  }
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
const botFocusable = () => layer.hidden ? [] : [...layer.querySelectorAll(
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'
)].filter(n => !n.closest('[hidden]') && n.getClientRects().length);
addEventListener('keydown', e => {
  if (!page || ($('#feedback') && $('#feedback').open)) return;
  if (e.key === 'Escape') { e.preventDefault(); return closePage(); }
  if (e.key !== 'Tab') return;
  const items = [...over(page).querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')]
    .filter(n => !n.closest('[hidden]') && n.getClientRects().length).concat(botFocusable(), dockTabs());
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
wireModePick();
wireStart();
wireMatch();
wireChat();
wireStyles();
paintTheme();   // 머리 스크립트가 붙일 rt.themeCss 를 지금 표로 다시 적는다
if (location.search.includes('rt=1')) {
  /* 워커가 gen.pts 를 편 64칸 radii 가 버디까지 닿아 그려지는지 */
  (window.RT_BUDDY_P || import(new URL(asset('assets/bloub/buddy.js'), document.baseURI).href)).then(({ mountBuddy }) => {
    const box = document.createElement('div'), radii = Array.from({ length: 64 }, (_, i) => +(1 - 0.3 * Math.max(0, Math.sin(i / 64 * Math.PI * 2))).toFixed(3));
    mountBuddy(box, { still: true, shape: 'gen', gen: { radii } }).setShape('gen', { radii });
    console.assert(box.querySelector('path')?.getAttribute('d')?.length > 20, '봇 모양: 윤곽 점(radii) 맞춤 모양이 그려진다');
  });
  console.assert(spookyLook('유령 같은 봇')?.shape === 'goutte' && spookyLook('할로윈 호박')?.shape === 'citrouille' &&
    spookyLook('combat robot') === undefined && spookyLook('맑은 하늘') === undefined, '봇 모양: 할로윈 낱말 프리셋');
  console.assert(JSON.stringify(hashGen('별빛')) === JSON.stringify(hashGen('별빛')) &&
    ['밤', 'x'.repeat(40), '🎃🦇'].every(x => { const g = hashGen(x); return g.lobes >= 3 && g.lobes <= 9 && Math.abs(g.amp) <= 0.28 && g.sharp <= 2.2; }), '봇 모양: 해시 폴백은 범위 안');
  console.assert(THEME.every(k => HEX.test(k.def) && (!k.on || HEX.test(k.on) || THEME.some(x => x.key === k.on))), '스타일: 표의 기본값·짝');
  console.assert(!themeLow({}).length, '스타일: 기본 색은 대비를 지킨다');
  console.assert(themeLow({ ink: '#e8edf0' })[0]?.key === 'bg' && themeLow({ accent: '#232c31' })[0]?.key === 'accent', '스타일: 대비 부족을 잡는다');
  console.assert(themeCss({ bg: '#ffffff' }).startsWith(':root:not([data-night]){--bg:#ffffff') && themeCss({}) === '', '스타일: 밤엔 낮 바탕을 깔지 않는다');
  console.assert(Object.keys(pickTheme({ accent: '#123456', bad: '#ffffff', block: 'red' })).join() === 'accent', '스타일: 표 밖·틀린 값은 버린다');
  console.assert(!$('#styPick') && !$('#stySug') && !$('#stySave'), '스타일: 색을 직접 고르는 칸은 없다');
  passKit.then(({ PASS, parseReward }) => console.assert(PASS.filter(p => p.reward.startsWith('pal:')).every(p => !themeLow(pickTheme(parseReward(p.reward).palette)).length) && owned.length === 2,
    '스타일: 패스 팔레트는 모두 대비를 지키고, 지금은 무료 둘을 가진다'));
  console.assert($('#styTabGame') && $('#styTabBot') && $('#styPanelGame') && $('#styPanelBot'), '스타일: 게임 스타일 · 봇 스타일 탭');
  console.assert(!$('#expressionChoices'), '스타일: 봇 스타일 탭에 표정 선택은 두지 않는다');
  console.assert($('#modePick') && $('#modeNormal') && $('#modeRanked'), '모드 고르기: 일반전·경쟁전');
  console.assert($('#examGate') && $('#examRows'), '라이선스: 시험 진입 대화상자');
  console.assert($('#rkTabRankedCasual') && $('#rkTabRankedLicense') && $('#rkTabNormalCasual') && $('#rkTabNormalLicense'), '순위표: 일반/라이선스 하위 탭');
  console.assert($('#rankedSHolders') && $('#normalSHolders') && $('#rankedLicenseBests') && $('#normalLicenseBests'), '순위표: S자 명단 및 코스별 라이선스 순위표');
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
  bot.api.setShape(face.shape || 'cercle', face.gen);
  if (face.expression) bot.api.setExpression(face.expression);
  bot.api.setColour(face.colour || 'accent');
  paintTint(bot.el.querySelector('.rk-bot-motion'));
  bot.el.setAttribute('aria-label', botName());
};
window.RT_BOOT_PLACE = async () => {
  if (!regionsOn()) return;
  /* 처음 온 사람(본 릴리스 표 rt.seenRel 이 아직 없다 — app.js 가 BOOTED 뒤에 남긴다)도
     가입한 새 계정처럼 꺼내 달라고 조른다. 다 꺼낼 때까지(endIntro) 새로고침해도 다시 조른다 */
  let rescue = false;
  try {
    if (!localStorage.getItem('rt.seenRel') && !localStorage.getItem('rt.seenVer')) localStorage.setItem(RESCUE_KEY, '1');
    rescue = !!localStorage.getItem(RESCUE_KEY);
  } catch {}
  let greet = false;
  try { greet = !!localStorage.getItem(GREET_KEY); localStorage.removeItem(GREET_KEY); } catch {}
  /* 폰이 아니면 예전처럼 들어올 때마다 봇이 나와 있다 — 한 탭(세션)에 한 번 인사하고, 그 뒤엔 귀퉁이에서 잔다 */
  if (!phone()) {
    try { greet = greet || !sessionStorage.getItem(GREETED_KEY); sessionStorage.setItem(GREETED_KEY, '1'); } catch {}
  }
  if (rescue) bootAct = 'rescue';
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
