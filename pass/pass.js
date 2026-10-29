/* 리전 패스 — 보상 표(assets/bloub/items.js 의 PASS)를 늘어놓고, 고른 레벨의 보상을 내 봇에
   씌워 본다. 진행(레벨·XP)은 서버가 셀 몫이라(PLAN-pass.md M3) 아직은 0 에서 잠겨 있다.
   화면 말은 community.js 와 같은 길로 고른다(rt.ui 팩 → 없으면 data/i18n.json). */
const opt = (() => { try { return JSON.parse(localStorage.getItem('rt.opt') || '{}'); } catch { return {}; } })();
document.documentElement.toggleAttribute('data-night', !!opt.night);
document.documentElement.dataset.motion = opt.motion === false ? 'off' : 'on';

const SEARCH = new URL(import.meta.url).search;
const VER = new URLSearchParams(SEARCH).get('v') || '';
const { mountBuddy, anchorOf, TABLES } = await import('../assets/bloub/buddy.js' + SEARCH);
const { PASS, PASS_LEVELS, ITEMS, COLOURS, FINISHES, REGIONS, parseReward, finishImg } = await import('../assets/bloub/items.js' + SEARCH);

let I18N = { ko: {} }, LANG = 'ko';
const t = (key, vars) => {
  let s = (I18N[LANG] || {})[key] || (I18N.en || {})[key] || (I18N.ko || {})[key] || '';
  if (s && vars) s = String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  return s;
};
let ui = null;
try { ui = JSON.parse(localStorage.getItem('rt.ui') || 'null'); } catch {}
/* 홈이 남긴 팩이 패스보다 옛것이면(새 마감 이름이 없으면) 표 전체를 받는다 */
if (ui && ui.pack && ui.pack.passLead && FINISHES.every(f => ui.pack['fin_' + f.id])) { I18N = { [ui.lang]: ui.pack }; LANG = ui.lang; }
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
  if (got.kind === 'finish') return t('fin_' + got.finish.id) || got.finish.id;
  if (got.kind === 'shape') return t('passShapeOf', { name: LANG === 'ko' ? got.region.ko : got.region.en });
  const base = t('item_' + got.item.id) || got.item.id;
  return got.colour === got.item.tint ? base : `${base} · ${t('ch_' + got.colour) || got.colour}`;
};
const kindOf = got => got.kind === 'item' ? 'kind_' + got.item.slot : 'kind_' + got.kind;

/* 칸의 작은 그림 — 아이템은 색 동그라미, 마감은 그 무늬 견본, 구 모양은 실루엣 */
const NS = 'http://www.w3.org/2000/svg';
function swatch(got) {
  if (got.kind === 'shape') {
    const svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('viewBox', '-1.4 -1.4 2.8 2.8');
    svg.classList.add('ps-sil');
    const r = got.region.radii;
    path.setAttribute('d', 'M' + r.map((v, i) => { const a = i / r.length * Math.PI * 2; return `${(v * Math.cos(a)).toFixed(3)} ${(v * Math.sin(a)).toFixed(3)}`; }).join('L') + 'Z');
    svg.append(path);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }
  const chip = el('span', 'ps-chip');
  chip.setAttribute('aria-hidden', 'true');
  if (got.kind === 'finish') {
    const f = got.finish;
    chip.style.background = f.img ? `center / cover url("${finishImg(f)}"), ${f.bg}` : f.grad ? `linear-gradient(${f.grad.angle ?? 90}deg, ${f.grad.stops.join(',')})`
      : f.pat.bg === 'ink' ? `radial-gradient(circle, rgba(255,255,255,.55) 30%, transparent 32%) 0 0 / 8px 8px, var(--accent)` : f.pat.bg;
  } else chip.style.background = TABLES.colours.find(c => c.id === got.colour)?.hex || 'transparent';
  return chip;
}

/* 로그인 줄 — 홈이 남긴 이름을 쓴다. 진행은 아직 서버가 없어 0 이다 */
const signed = (() => { try { return !!localStorage.getItem('rt.token'); } catch { return false; } })();
if (signed) {
  const me = $('#me');
  me.textContent = (() => { try { return localStorage.getItem('rt.name') || ''; } catch { return ''; } })() || t('passAccount');
  me.href = '/account/';
}
const level = 0;
$('#lv').textContent = level;

/* 내 봇 — 홈에서 고른 모양·표정·색 그대로 */
const face = (() => { try { return JSON.parse(localStorage.getItem('rt.character') || '{}'); } catch { return {}; } })();
const calm = () => opt.motion === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
const bot = mountBuddy($('#bot'), { calm, shape: face.shape || 'cercle', expression: face.expression || 'curieux', gen: face.gen });
bot.setColour(face.colour || 'accent');
bot.start();

/* ── 보상 줄 ─────────────────────────────────────────────
   100칸을 버튼 하나씩. 탭 자리는 하나만 두고(roving) ←→·Home·End 로 옮긴다.
   잠김은 색이 아니라 자물쇠 기호와 '잠김' 라벨로 보인다 */
const track = $('#track');
let cur = 0;
const btns = PASS.map((p, i) => {
  const li = el('li', 'ps-cell' + (p.big ? ' is-big' : ''));
  const b = el('button', 'ps-lvbtn');
  b.type = 'button';
  b.tabIndex = i === 0 ? 0 : -1;
  const got = parseReward(p.reward);
  const head = el('span', 'ps-row');
  head.append(el('span', 'ps-num', 'Lv ' + p.level), el('span', 'ps-kind', t(kindOf(got))));
  b.append(head, swatch(got), el('span', 'ps-what', (p.big ? '★ ' : '') + name(p.reward)));
  const locked = p.level > level;
  b.append(el('span', 'ps-lock', locked ? '🔒 ' + t('passLocked') : '✓ ' + t('passOwned')));
  b.addEventListener('click', () => choose(i));
  li.append(b);
  track.append(li);
  return b;
});
function choose(i, focus) {
  cur = i;
  btns.forEach((b, j) => { b.tabIndex = j === i ? 0 : -1; b.setAttribute('aria-pressed', String(j === i)); });
  if (focus) btns[i].focus();
  const p = PASS[i], got = parseReward(p.reward);
  /* 한 번에 하나만 입어 본다. 구 모양을 고르면 몸이 그 구로, 아니면 내 모양으로 돌아온다 */
  bot.setShape(got.kind === 'shape' ? p.reward : face.shape || 'cercle', got.kind === 'shape' ? null : face.gen);
  bot.setWear(got.kind === 'item' ? { [got.item.slot]: p.reward } : got.kind === 'finish' ? { finish: p.reward } : null);
  $('#pick').textContent = `Lv ${p.level} · ${name(p.reward)} — ${p.level > level ? t('passLocked') : t('passOwned')}`;
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
$('#off').addEventListener('click', () => { bot.setWear(null); bot.setShape(face.shape || 'cercle', face.gen); $('#pick').textContent = ''; btns.forEach(b => b.setAttribute('aria-pressed', 'false')); });
choose(0);

/* ── ?rt=1 자체검사 ──────────────────────────────────── */
if (new URLSearchParams(location.search).get('rt') === '1') {
  const A = console.assert;
  A(PASS.length === PASS_LEVELS && PASS.every((p, i) => p.level === i + 1), 'pass: 1..100 레벨이 빠짐없이');
  A(PASS.every(p => parseReward(p.reward)), 'pass: 모든 레벨에 보상이 있고 아는 아이템·색·마감·구다');
  A(new Set(PASS.map(p => p.reward)).size === PASS_LEVELS, 'pass: 같은 보상을 두 번 주지 않는다');
  A(PASS.filter(p => p.big).every(p => !/^[a-z]+:/.test(p.reward) || p.reward.startsWith('fin:')), 'pass: 큰 보상은 새 아이템 기본색·마감·구');
  A(FINISHES.every(f => PASS.some(p => p.reward === 'fin:' + f.id)), 'pass: 마감은 모두 패스에서 나온다');
  A(REGIONS.length === 26 && REGIONS.every(r => r.radii.length === 64 && r.radii.every(v => v >= .4 && v <= 1.3)), 'regions: 26개 · 반지름 64개 · 엔진 범위 안');
  A(REGIONS.every(r => PASS.some(p => p.reward === 'gu-' + r.id)), 'pass: 25구와 서울이 모두 나온다');
  A(PASS[PASS_LEVELS - 1].reward === 'gu-seoul', 'pass: 100레벨은 서울 전체');
  A(t('passShapeOf') && ['hat', 'back', 'finish', 'shape'].every(k => t('kind_' + k)), 'i18n: 구 모양 이름 · 갈래');
  A(FINISHES.every(f => t('fin_' + f.id)), 'i18n: 마감 이름');
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
