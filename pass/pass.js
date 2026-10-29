/* 리전 패스 — 할로윈·블랙 프라이데이·크리스마스를 날짜 차례로 이은 150칸 한 줄(assets/bloub/items.js 의 PASS)을 늘어놓고,
   고른 칸을 미리 본다 — 팔레트는 이 페이지 색과 작은 서울 지도로(어두운 팔레트는 밤 화면으로), 모양은 내 봇의 몸으로.
   시즌 탭은 줄에서 그 시즌 첫 칸으로 건너뛴다. 진행(레벨·XP)은 서버가 세기 전(PLAN-pass.md M3)이라 이 기기의 rt.pass 를
   읽는다(쌓는 것은 ranked.js). 화면 말은 community.js 와 같은 길로 고른다(rt.ui 팩 → 없으면 data/i18n.json). */
const opt = (() => { try { return JSON.parse(localStorage.getItem('rt.opt') || '{}'); } catch { return {}; } })();
document.documentElement.toggleAttribute('data-night', !!opt.night);
document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';

const SEARCH = new URL(import.meta.url).search;
const VER = new URLSearchParams(SEARCH).get('v') || '';
const { mountBuddy, anchorOf, TABLES, shapeRadii } = await import('../assets/bloub/buddy.js' + SEARCH);
const { SEASONS, SEASON_LEVELS, seasonAt, trackOf, PASS, passStore, passLevel, passOwns, PASS_LEVELS, PASS_XP, FREE, ITEMS, COLOURS, FINISHES, REGIONS,
  PALETTE_FAMILIES, SEASON_SHAPES, PASS_ENGINE_SHAPES, parseReward, finishImg } = await import('../assets/bloub/items.js' + SEARCH);

let I18N = { ko: {} }, LANG = 'ko';
const t = (key, vars) => {
  let s = (I18N[LANG] || {})[key] || (I18N.en || {})[key] || (I18N.ko || {})[key] || '';
  if (s && vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
};
let ui = null;
try { ui = JSON.parse(localStorage.getItem('rt.ui') || 'null'); } catch {}
/* 홈이 남긴 팩이 패스보다 옛것이면(새 모양 이름이 없으면) 표 전체를 받는다 */
if (ui && ui.pack && ui.pack.passXpLeft && [...SEASON_SHAPES.map(x => x.id), ...PASS_ENGINE_SHAPES].every(id => ui.pack['shape_' + id])) { I18N = { [ui.lang]: ui.pack }; LANG = ui.lang; }
else {
  try { I18N = await (await fetch('../data/i18n.json?v=' + VER)).json(); } catch {}
  const langs = Object.keys(I18N);
  LANG = [opt.lang, ...(navigator.languages || [navigator.language])]
    .map(x => String(x || '').toLowerCase().replace(/^(no|nn)\b.*/, 'nb').slice(0, 2))
    .find(x => langs.includes(x)) || (langs.includes('en') ? 'en' : 'ko');
}
document.documentElement.lang = LANG;
document.querySelectorAll('[data-i18n]').forEach(e => { const s = t(e.dataset.i18n); if (s) e.textContent = s; });
document.querySelectorAll('[data-i18n-aria]').forEach(e => { const s = t(e.dataset.i18nAria); if (s) e.setAttribute('aria-label', s); });
document.title = t('pass') + ' — regiontype';

const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const name = ref => {
  const got = parseReward(ref);
  if (!got) return '';
  if (got.kind === 'shape') return t('shape_' + got.shape.id) || got.shape.id;
  if (got.kind === 'palette') return (t('pal_' + got.palette.family) || got.palette.family) + (got.palette.n > 1 ? ' ' + got.palette.roman : '');
  return ref;
};
const kindOf = got => 'kind_' + got.kind;
const dayName = d => new Intl.DateTimeFormat(LANG, { month: 'long', day: 'numeric' }).format(new Date(d + 'T00:00'));

/* 칸의 작은 그림 — 팔레트는 바탕 위 칸색·강조색 점, 모양은 실루엣 */
const NS = 'http://www.w3.org/2000/svg';
function swatch(got) {
  if (got.kind === 'shape') {
    const svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('viewBox', '-1.4 -1.4 2.8 2.8');
    svg.classList.add('ps-sil');
    const r = got.shape.radii || shapeRadii(got.shape.id);   // 엔진 모양(citrouille)은 엔진의 반지름
    path.setAttribute('d', 'M' + r.map((v, i) => { const a = i / r.length * Math.PI * 2; return `${(v * Math.cos(a)).toFixed(3)} ${(v * Math.sin(a)).toFixed(3)}`; }).join('L') + 'Z');
    svg.append(path);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }
  const chip = el('span', 'ps-chip');
  chip.setAttribute('aria-hidden', 'true');
  const { accent, block, bg } = got.palette;
  chip.style.background = `radial-gradient(circle, ${accent} 26%, transparent 28%) center / 100% 100% no-repeat,
    radial-gradient(circle, ${block} 30%, transparent 33%) 0 0 / 33.3% 33.3%, ${bg}`;
  return chip;
}

/* 로그인 줄 — 홈이 남긴 이름을 쓴다 */
const signed = (() => { try { return !!localStorage.getItem('rt.token'); } catch { return false; } })();
if (signed) {
  const me = $('#me');
  me.textContent = (() => { try { return localStorage.getItem('rt.name') || ''; } catch { return ''; } })() || t('passAccount');
  me.href = '/account/';
}
const today = new Date().toLocaleDateString('sv');
const st = passStore((() => { try { return JSON.parse(localStorage.getItem('rt.pass') || 'null'); } catch { return null; } })());
const level = passLevel(st.xp), now = seasonAt(today);

/* 내 봇 — 홈에서 고른 모양·표정·색 그대로 */
const face = (() => { try { return JSON.parse(localStorage.getItem('rt.character') || '{}'); } catch { return {}; } })();
const calm = () => opt.motion === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
const bot = mountBuddy($('#bot'), { calm, shape: face.shape || 'cercle', expression: face.expression || 'curieux', gen: face.gen });
bot.setColour(face.colour || 'accent');
bot.start();

/* ── 시즌 탭 ─────────────────────────────────────────────
   패스는 하나다. 탭은 그 시즌의 첫 칸으로 건너뛰는 길이고, 상태는 색이 아니라 글로 — 진행 중 · <날>부터 · 끝남 */
const stateOf = s => s === now ? 'open' : today < s.from ? 'soon' : 'ended';
const stateText = s => ({ open: t('passOpen'), soon: t('passFrom', { day: dayName(s.from) }), ended: t('passEnded') })[stateOf(s)];
const seasonOfCell = i => SEASONS[Math.floor(i / SEASON_LEVELS)];
const tabs = SEASONS.map((s, k) => {
  const b = el('button', 'ps-tab', `${t('season_' + s.theme) || s.theme} · ${stateText(s)}`);
  b.type = 'button';
  b.addEventListener('click', () => { choose(k * SEASON_LEVELS); btns[cur].scrollIntoView({ block: 'nearest', inline: 'start' }); });
  return b;
});
$('#seasons').replaceChildren(...tabs);
$('#seasons').addEventListener('keydown', e => {
  const i = tabs.indexOf(document.activeElement), d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (i < 0 || !d) return;
  e.preventDefault();
  tabs[(i + d + tabs.length) % tabs.length].focus();
});

/* ── 카드 — 레벨·XP 는 패스 하나의 값, 이름·상태는 지금 시즌(사이면 다음, 다 지났으면 마지막) ── */
const head = now || SEASONS.find(s => today < s.from) || SEASONS[SEASONS.length - 1], open = !!now;
$('#psNow').textContent = t('season_' + head.theme) || head.theme;
$('#state').textContent = stateText(head);
$('#state').dataset.state = stateOf(head);
$('#span').textContent = t('passSpan', { from: dayName(SEASONS[0].from), to: dayName(new Date(new Date(SEASONS[SEASONS.length - 1].to + 'T00:00') - 864e5).toLocaleDateString('sv')) });
$('#lv').textContent = level;
$('#lvMax').textContent = '/ ' + PASS_LEVELS;
$('#xp').max = PASS_XP.level;
$('#xp').hidden = !open;
$('#xp').value = level >= PASS_LEVELS ? PASS_XP.level : st.xp % PASS_XP.level;
$('#xpNum').textContent = !open || level >= PASS_LEVELS ? '' : t('passXpLeft', { xp: PASS_XP.level - st.xp % PASS_XP.level });
$('#note').textContent = !open ? t(stateOf(head) === 'soon' ? 'passSoonNote' : 'passEndedNote') : signed ? t('passLocal') : t('passSignIn');

/* ── 보상 줄 ─────────────────────────────────────────────
   150칸을 버튼 하나씩, 시즌 첫 칸에 시즌 이름표. 탭 자리는 하나만 두고(roving) ←→·Home·End 로 옮긴다.
   잠김은 색이 아니라 자물쇠 기호와 라벨로 — 레벨이 모자라면 '잠김', 레벨은 닿았어도 시즌 전이면 그 시즌 여는 날 */
const track = $('#track');
let cur = 0;
const lockText = p => passOwns(p, level, today) ? '✓ ' + t(p.free ? 'passFree' : 'passOwned')
  : today < p.season.from ? '🔒 ' + dayName(p.season.from) : '🔒 ' + t('passLocked');
const btns = PASS.map((p, i) => {
  const li = el('li', 'ps-cell' + (p.big ? ' is-big' : ''));
  const b = el('button', 'ps-lvbtn');
  b.type = 'button';
  b.tabIndex = -1;
  const got = parseReward(p.reward);
  const row = el('span', 'ps-row');
  row.append(el('span', 'ps-num', 'Lv ' + p.level), el('span', 'ps-kind', t(kindOf(got))));
  /* 시즌 첫 칸엔 시즌 이름표 — 줄 안에서 어디부터 그 시즌인지 글로 보인다 */
  if (i % SEASON_LEVELS === 0) { li.classList.add('is-first'); b.append(el('span', 'ps-season', '▸ ' + (t('season_' + p.season.theme) || p.season.theme))); }
  b.append(row, swatch(got), el('span', 'ps-what', (p.big ? '★ ' : '') + name(p.reward)), el('span', 'ps-lock', lockText(p)));
  b.addEventListener('click', () => choose(i));
  li.append(b);
  track.append(li);
  return b;
});
function choose(i, focus) {
  cur = i;
  btns.forEach((b, j) => { b.tabIndex = j === i ? 0 : -1; b.setAttribute('aria-pressed', String(j === i)); });
  if (focus) btns[i].focus();
  const p = PASS[i], got = parseReward(p.reward), on = seasonOfCell(i);
  tabs.forEach((b, k) => { b.setAttribute('aria-current', String(SEASONS[k] === on)); });
  /* 한 번에 하나만 입어 본다. 모양을 고르면 몸이 그 모양으로, 팔레트를 고르면 페이지 색·지도·봇 색이 그 팔레트로
     (봇은 강조색을 입는다 — 내 봇이 다른 색이면 팔레트가 안 보이니까) */
  bot.setShape(got.kind === 'shape' ? p.reward : face.shape || 'cercle', got.kind === 'shape' ? null : face.gen);
  const pal = got.kind === 'palette' ? got.palette : null;
  paint(pal);
  bot.setColour(pal ? 'accent' : face.colour || 'accent');
  $('#psMap').hidden = !pal;
  if (pal) drawMap(pal);
  $('#pick').textContent = `Lv ${p.level} · ${name(p.reward)} — ${lockText(p).replace(/^\S+ /, '')}`;
}
/* 작은 서울 지도 — 서울 윤곽(REGIONS 의 seoul, 반지름 64개) 안에 홈 지도처럼 점을 깐다. 바탕은 팔레트 바탕,
   점은 칸색, 몇 점은 강조색(먹은 칸), 이름은 글자색. 밤에도 팔레트 그대로 보인다 — 견본이니까 */
const SEOUL = REGIONS.find(r => r.id === 'seoul').radii;
const inSeoul = (x, y) => {
  const a = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1 * SEOUL.length, i = Math.floor(a), f = a - i;
  return Math.hypot(x, y) < SEOUL[i] * (1 - f) + SEOUL[(i + 1) % SEOUL.length] * f;
};
const DOTS = [];
for (let y = -1.3; y <= 1.3; y += .13) for (let x = -1.3; x <= 1.3; x += .13) if (inSeoul(x, y)) DOTS.push([x, y]);
function drawMap(pal) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-1.5 -1.5 3 3');
  const mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); svg.append(e); return e; };
  mk('rect', { x: -1.5, y: -1.5, width: 3, height: 3, rx: .3, fill: pal.bg });
  DOTS.forEach(([x, y], i) => mk('circle', { cx: x.toFixed(3), cy: y.toFixed(3), r: .052, fill: i % 9 === 4 ? pal.accent : pal.block }));
  mk('text', { x: 0, y: 1.38, 'text-anchor': 'middle', 'font-size': .22, 'font-weight': 800, fill: pal.ink }).textContent = name('pal:' + pal.id);
  $('#psMap').replaceChildren(svg);
}
/* 팔레트 미리 보기 — 홈의 THEME(ranked.js)과 같은 넷을 :root 에 얹는다. 밝은 팔레트의 바탕·글자는 낮에만(밤엔 사이트 밤 값),
   어두운 팔레트는 미리 보는 동안 밤 화면을 켜고 그 바탕을 깐다(홈에서 입을 때와 같다) */
const NIGHT = !!opt.night;
function paint(pal) {
  const root = document.documentElement, r = root.style;
  root.toggleAttribute('data-night', pal?.dark || NIGHT);
  const night = root.hasAttribute('data-night'), mix = (a, p, b) => `color-mix(in srgb,${a} ${p}%,${b})`;
  const base = pal && night === !!pal.dark ? { '--bg': pal.bg, '--ink': pal.ink, '--ink-soft': mix(pal.ink, pal.dark ? 68 : 78, pal.bg),
    '--card': pal.dark ? mix(pal.bg, 92, '#fff') : mix(pal.bg, 45, '#fff'), '--grid': mix(pal.bg, pal.dark ? 88 : 92, pal.ink) } : {};
  const v = pal ? { '--accent': pal.accent, '--accent-deep': mix(pal.accent, 82, '#000'),
    '--block': pal.block, '--block-hi': mix(pal.block, 88, '#000'), ...base } : {};
  for (const k of ['--accent', '--accent-deep', '--block', '--block-hi', '--bg', '--ink', '--ink-soft', '--card', '--grid']) v[k] ? r.setProperty(k, v[k]) : r.removeProperty(k);
}
track.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  let n = null;
  if (step) n = Math.max(0, Math.min(btns.length - 1, cur + step));
  if (e.key === 'Home') n = 0;
  if (e.key === 'End') n = btns.length - 1;
  if (n === null) return;
  e.preventDefault();
  choose(n, true);
  btns[n].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
});
$('#off').addEventListener('click', () => { paint(null); $('#psMap').hidden = true; bot.setColour(face.colour || 'accent'); bot.setShape(face.shape || 'cercle', face.gen); $('#pick').textContent = ''; btns.forEach(b => b.setAttribute('aria-pressed', 'false')); });
/* 처음엔 다음에 받을 칸 — 내 레벨 다음 칸과 지금 시즌 첫 칸 중 뒤의 것(다 받았으면 마지막) */
choose(Math.min(Math.max(level, Math.max(0, SEASONS.indexOf(now)) * SEASON_LEVELS), PASS_LEVELS - 1));
btns[cur].scrollIntoView({ block: 'nearest', inline: 'center' });

/* ── ?rt=1 자체검사 ──────────────────────────────────── */
if (new URLSearchParams(location.search).get('rt') === '1') {
  const A = console.assert;
  const lum = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0);
  const con = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  for (const s of SEASONS) {
    const T = trackOf(s), pals = T.map(p => parseReward(p.reward)).filter(g => g.kind === 'palette').map(g => g.palette);
    A(T.length === SEASON_LEVELS && T.every((p, i) => p.level === i + 1), `pass ${s.id}: 1..50 레벨이 빠짐없이`);
    A(T.every(p => ['palette', 'shape'].includes(parseReward(p.reward)?.kind)), `pass ${s.id}: 보상은 팔레트와 모양뿐`);
    A(new Set(T.map(p => p.reward)).size === SEASON_LEVELS, `pass ${s.id}: 같은 보상을 두 번 주지 않는다`);
    A(T.filter(p => p.free).map(p => p.level).join() === '1,2' && FREE === 2, `pass ${s.id}: 무료는 맨 앞 팔레트 둘`);
    A(s.shapes.every(id => T.some(p => p.big && p.reward === id)) && T[SEASON_LEVELS - 1].reward === s.shapes[s.shapes.length - 1], `pass ${s.id}: 모양은 모두 큰 칸에, 마지막 칸은 그 시즌의 얼굴`);
    A(PALETTE_FAMILIES.filter(f => f.season === s.theme).every(f => T.some(p => p.big && p.reward === 'pal:' + f.id)), `pass ${s.id}: 갈래는 모두 큰 칸에`);
    A(pals.every(q => con(q.accent, '#232c31') >= 4.5 && con(q.block, '#ffffff') >= 3 && con(q.bg, q.ink) >= 4.5), `palette ${s.id}: 대비(ranked.js THEME 의 min)를 지킨다`);
    A(new Set(pals.map(q => [q.accent, q.block, q.bg, q.ink].join())).size === pals.length, `palette ${s.id}: 같은 색 넷이 두 번 나오지 않는다`);
    A(t('season_' + s.theme), `i18n: 시즌 이름 ${s.theme}`);
  }
  A(PALETTE_FAMILIES.filter(f => f.season === 'blackfriday').every(f => f.dark && lum(f.bg) < .02), 'palette: 블랙 프라이데이는 모두 어두운 스타일');
  A(PASS.length === PASS_LEVELS && PASS.every((p, i) => p.level === i + 1) && new Set(PASS.map(p => p.reward)).size === PASS_LEVELS, 'pass: 한 줄 1..150, 같은 보상 없음');
  A(PASS.every((p, i) => !i || PASS[i - 1].season.from <= p.season.from), 'pass: 줄 순서 = 날짜 순서');
  A(PASS[SEASON_LEVELS - 1].reward === 'citrouille' && shapeRadii('citrouille') && !TABLES.shapes.some(x => x.id === 'citrouille'), 'pass: 할로윈 50레벨은 엔진 호박(citrouille) — 기본 목록엔 없다');
  A(SEASONS.every((s, i) => s.from < s.to && (!i || SEASONS[i - 1].to === s.from)), 'season: 날짜가 겹치거나 비지 않고 이어진다');
  A(seasonAt('2026-10-31').theme === 'halloween' && seasonAt('2026-11-27').theme === 'blackfriday' && seasonAt('2026-12-25').theme === 'christmas', 'season: 날짜로 시즌을 고른다');
  A(SEASON_SHAPES.every(x => /^[a-z]{1,16}$/.test(x.id) && x.radii.length === 64 && x.radii.every(v => v >= .4 && v <= 1.3)), 'shapes: 중계기가 받는 id · 반지름 64개 · 엔진 범위 안');
  A(SEASON_SHAPES.every(x => !TABLES.shapes.some(y => y.id === x.id)), 'shapes: 엔진 기본 모양과 id 가 겹치지 않는다');
  A(SEASON_SHAPES.every(x => t('shape_' + x.id)) && PALETTE_FAMILIES.every(f => t('pal_' + f.id)) && ['palette', 'shape'].every(k => t('kind_' + k)), 'i18n: 모양 · 팔레트 이름 · 갈래');
  A(t('passFrom') && t('passEnded') && t('passSpan') && t('passFree'), 'i18n: 시즌 상태');
  A(REGIONS.length === 26 && REGIONS.every(r => r.radii.length === 64 && r.radii.every(v => v >= .4 && v <= 1.3)), 'regions: 26개 · 반지름 64개 · 엔진 범위 안');
  Promise.all(FINISHES.filter(f => f.img).map(f => fetch(finishImg(f), { method: 'HEAD' }).then(r => r.ok)))
    .then(ok => A(ok.length === 12 && ok.every(Boolean), 'finish: 질감 그림 열둘이 다 있다'));
  A(ITEMS.every(x => ['hat', 'back'].includes(x.slot) && COLOURS.includes(x.tint)), 'items: 슬롯·기본색이 맞다');
  A(COLOURS.join() === TABLES.colours.map(c => c.id).join(), 'items: COLOURS 가 engine COLORS 와 같다');
  const a = anchorOf('M0 -100C10 -100 20 -90 100 0C80 20 20 100 0 100C-20 100 -80 20 -100 0C-80 -20 -20 -100 0 -100');
  A(a && a.hat.y === -100 && a.hat.x === 0 && a.back.x === 0 && a.back.y === 0 && a.hat.k === 1, 'anchor: 정수리·한가운데·배율');
  A(anchorOf('') === null, 'anchor: 빈 윤곽은 null');
  /* 뾰족한 머리(삼각형: 꼭짓점 (0,-100), 밑변 y=100, 반폭 = (y+100)/2) — 챙 15 는 반폭 15 인 y=-70 까지
     내려앉는다. 챙 40 은 y=-20 까지 가야 하지만 1.8배로 늘려도 덮을 수 있는 데(cover·1.8−6)서 멈춘다. 평평한 머리(위변 y=-100, x -60‥0)에서는 그 줄 가운데에 꽂힌다 */
  const tri = 'M0 -100C0 -100 100 100 100 100C100 100 -100 100 -100 100C-100 100 0 -100 0 -100';
  const sat = anchorOf(tri, { brim: 40, cover: 22 });
  A(sat && sat.hat.y > -100 && sat.hat.sy > 1 && sat.hat.sy <= 1.8, 'anchor: 뾰족한 머리에서 내려앉고 위로 늘어난다');
  A(sat && sat.hat.y + 100 + 4 <= 22 * sat.hat.k * sat.hat.sy, 'anchor: 늘린 모자가 뿔을 덮는다(뚫고 나오지 않는다)');
  const wide = anchorOf(tri, { brim: 15, cover: 22 });
  A(wide && Math.abs(wide.hat.y + 70) <= 2, 'anchor: 덮을 수 있으면 챙 폭까지 내려앉는다');
  A(anchorOf(tri, { brim: 40, floor: -60 }).hat.y <= -60, 'anchor: 눈 윗선 아래로 내려오지 않는다');
  const flat = anchorOf('M-60 -100C-60 -100 0 -100 0 -100C0 -100 60 100 60 100C60 100 -60 100 -60 100C-60 100 -60 -100 -60 -100');
  A(flat && Math.abs(flat.hat.x + 30) < 3, 'anchor: 평평한 머리는 줄 가운데');
  A(ITEMS.filter(x => x.slot === 'hat').every(x => Number.isFinite(x.brim) && Number.isFinite(x.sink)), 'items: 모자마다 brim·sink');
  console.log('pass ?rt=1 done');
}
