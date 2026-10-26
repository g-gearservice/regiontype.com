/* 격자 칸을 깐다. 일정표는 changes.json 을 버전 내림차순(최신이 위)으로 읽는다. */
const board = document.getElementById('board');
const wrap = document.querySelector('.wrap');

function metrics() {
  const narrow = matchMedia('(max-width:820px)').matches;
  const cols = narrow ? 8 : 20;
  const cs = getComputedStyle(wrap);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const inner = Math.max(1, wrap.clientWidth - pad);
  document.documentElement.style.setProperty('--cols', String(cols));
  document.documentElement.style.setProperty('--cell', (inner / cols) + 'px');
  return cols;
}
function lay() {
  board.querySelectorAll('.cell').forEach(c => c.remove());
  const cols = metrics();
  const rows = cols > 10 ? 16 : 11;
  const off = (x, y) => cols > 10
    ? (y < 2 && x < 3) || (y === 0 && x < 17 && x > 2) || (y >= 11 && x < 12) || (y >= 13 && x > 19) || (y >= 9 && x < 7)
    : (y === 0 && x < 5) || (y >= 9 && x > 3);
  const frag = document.createDocumentFragment();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = document.createElement('div');
    c.className = 'cell' + (off(x, y) ? ' off' : '');
    c.style.gridArea = `${y + 1}/${x + 1}`;
    c.setAttribute('aria-hidden', 'true');
    frag.append(c);
  }
  board.prepend(frag);
}
lay();
addEventListener('resize', lay);

const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const ver = v => String(v).split('.').map(n => parseInt(n, 10) || 0);
fetch('/data/changes.json').then(r => r.json()).then(list => {
  const sorted = [...list].sort((a, b) => {
    const av = ver(a.v), bv = ver(b.v);
    const n = Math.max(av.length, bv.length);
    for (let i = 0; i < n; i++) {
      const d = (bv[i] || 0) - (av[i] || 0);
      if (d) return d;
    }
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  const fmt = s => {
    const dt = new Date(s + 'T00:00:00');
    return `${DAY[dt.getDay()]} ${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  const top = sorted[0];
  if (!top) return;
  const feat = document.getElementById('feat');
  feat.replaceChildren();
  const a = document.createElement('a');
  a.href = '#dev';
  a.textContent = `${fmt(top.date)}: v${top.v} — ${top.ko}`;
  feat.append(a);
  const box = document.getElementById('sched');
  sorted.slice(1, 8).forEach(e => {
    const ev = document.createElement('article');
    ev.className = 'ev';
    const t = document.createElement('time');
    t.dateTime = e.date;
    t.textContent = fmt(e.date);
    const p = document.createElement('p');
    p.textContent = `UPDATE | ${e.ko}`;
    const sm = document.createElement('small');
    sm.textContent = `v${e.v} / ${e.date}`;
    p.append(sm);
    ev.append(t, p);
    box.append(ev);
  });
}).catch(() => {});

/* 여섯 칸 — 소개·개발·스타일·스토리·플레이·플랜. 머리 버튼이 펼치고 접는다.
   주소의 #이름 과 메뉴의 #이름 은 그 칸을 연다. 플레이는 /#home 을 새 탭으로 여는 바로가기다. */
const secs = [...document.querySelectorAll('.sec')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function setOpen(sec, open) {
  sec.classList.toggle('open', open);
  sec.querySelector('.sec-head').setAttribute('aria-expanded', String(open));
}
secs.forEach(s => s.querySelector('.sec-head').addEventListener('click', () => {
  const open = !s.classList.contains('open');
  setOpen(s, open);
  history.replaceState(null, '', open ? '#' + s.id : location.pathname);
}));
function openTo(id, scroll) {
  const s = id && document.getElementById(id);
  if (!s || !s.classList.contains('sec')) return;
  setOpen(s, true);
  if (scroll) s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href').slice(1), s = document.getElementById(id);
  if (!s || !s.classList.contains('sec')) return;
  e.preventDefault();
  history.replaceState(null, '', '#' + id);
  openTo(id, true);
  s.querySelector('.sec-head').focus({ preventScroll: true });
}));
addEventListener('hashchange', () => openTo(location.hash.slice(1), true));
openTo(location.hash.slice(1), true);

// 개발: 버전은 app.js 의 VER 에서 읽는다(C 자리는 VER 에서 점을 뺀 숫자). 바뀐 것은 changes.json
fetch('/data/changes.json').then(r => r.json()).then(list => {
  document.querySelectorAll('[data-log]').forEach(log => log.replaceChildren(...list.slice(0, 8).map(e => {
    const li = document.createElement('li');
    const v = document.createElement('span'); v.className = 'v'; v.textContent = 'v' + e.v;
    const t = document.createElement('time'); t.dateTime = e.date; t.textContent = e.date;
    const p = document.createElement('span'); p.textContent = e.ko;
    li.append(v, t, p);
    return li;
  })));
  return fetch('/app.js').then(r => r.text()).then(t => {
    const m = t.match(/const VER\s*=\s*'([\d.]+)'/);
    if (!m) return;
    const ab = (list[0] && list[0].v || '0.0.0').split('.').slice(0, 2).join('.');
    document.querySelectorAll('[data-ver]').forEach(el => { el.textContent = `v${ab}.${m[1].replace('.', '')}`; });
  });
}).catch(() => {});
