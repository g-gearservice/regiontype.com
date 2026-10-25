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
  a.href = '/';
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
