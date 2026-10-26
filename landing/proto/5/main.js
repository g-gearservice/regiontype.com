/* 갈래 여섯 — /landing/ 의 여섯 칸. 낱말의 _ \ * 는 시안의 장식. ← → 와 탭으로 넘긴다.
   판 아래 '펼치기' 가 고른 갈래의 글을 펼치고 접는다. 망점은 서울 구 격자와 대한민국 점 지도. */
const LINES = [
  { id: 'about', bg: '#e5d7bf', ink: '#c4473f', out: '#b5b5b5', img: '36%', word: ['ab_', 'out'], cap: ['소개', 'About'], map: 'seoul' },
  { id: 'dev', bg: '#126b98', ink: '#061922', out: '#b5b5b5', img: '42%', word: ['dev\\\\', 'elop'], cap: ['개발', 'Development'], map: 'korea' },
  { id: 'style', bg: '#d9e04a', ink: '#14200c', out: '#b5b5b5', img: '40%', word: ['sty*', 'le'], cap: ['스타일', 'Style'], map: 'seoul' },
  { id: 'story', bg: '#982323', ink: '#1a0607', out: 'linear-gradient(#2b74b8,#c9b8c6 60%,#c46d55)', img: '36%', word: ['sto_', 'ry'], cap: ['스토리', 'Story'], map: 'korea' },
  { id: 'play', bg: '#f0a03c', ink: '#232c31', out: '#b5b5b5', img: '40%', word: ['pl_', 'ay'], cap: ['플레이', 'Play'], map: 'seoul' },
  { id: 'plans', bg: '#d8d4cc', ink: '#141414', out: '#b5b5b5', img: '38%', word: ['pl*', 'an'], cap: ['플랜', 'Plan'], map: 'korea' }
];
const $ = id => document.getElementById(id);
const menu = $('menu');
const tabs = [...menu.querySelectorAll('[role="tab"]')];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cur = 0, shapes = {};

tabs.forEach((b, i) => b.addEventListener('click', () => show(i)));

addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  const n = e.key === 'ArrowRight' ? (cur + 1) % LINES.length : (cur + LINES.length - 1) % LINES.length;
  show(n);
  tabs[n].focus();
});

// 펼치기 — 고른 갈래의 글. 접혀 있어도 판의 짧은 줄(bio)은 보인다
const more = $('more');
function setOpen(open) {
  $('detail').classList.toggle('open', open);
  more.setAttribute('aria-expanded', String(open));
}
more.addEventListener('click', () => setOpen(more.getAttribute('aria-expanded') !== 'true'));

function paintWord(lines) {
  const el = $('word');
  el.replaceChildren();
  lines.forEach((w, i) => {
    if (i) el.append('\n');
    const re = /([_\\*]+)/g;
    let last = 0, m;
    while ((m = re.exec(w))) {
      if (m.index > last) el.append(w.slice(last, m.index));
      const s = document.createElement('span');
      s.className = 'mk';
      s.textContent = m[1];
      el.append(s);
      last = m.index + m[1].length;
    }
    if (last < w.length) el.append(w.slice(last));
  });
}

function fitWord() {
  const el = $('word');
  el.style.fontSize = '';
  const max = el.parentElement.clientWidth;
  if (max < 8) return;
  const w = el.scrollWidth;
  if (w > max) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * (max - 2) / w) + 'px';
}

function show(i) {
  cur = i;
  const l = LINES[i], p = $('panel');
  p.style.setProperty('--bg', l.bg);
  p.style.setProperty('--ink', l.ink);
  p.style.setProperty('--img', l.img);
  $('detail').style.setProperty('--bg', l.bg);
  document.body.style.background = l.out;
  tabs.forEach((b, k) => {
    b.setAttribute('aria-selected', String(k === i));
    b.tabIndex = k === i ? 0 : -1;
  });
  document.querySelectorAll('.sec').forEach(s => { s.hidden = s.id !== l.id; });
  const cap = $('cap');
  cap.replaceChildren();
  l.cap.forEach((c, k) => {
    if (k) cap.append(document.createElement('br'));
    cap.append(c);
  });
  paintWord(l.word);
  // 판 오른쪽의 짧은 줄은 그 칸 첫 문장을 그대로 옮긴다. 플레이는 바로가기 버튼을 함께
  const sec = $(l.id), bio = $('bio');
  const lead = sec.querySelector('.beat h3, .lead, .plan-note, .card h3, pre');
  bio.replaceChildren();
  if (lead) {
    const q = document.createElement('p');
    q.textContent = lead.textContent;
    bio.append(q);
  }
  const go = sec.querySelector('.go-site');
  if (go) bio.append(go.cloneNode(true));
  history.replaceState(null, '', i ? '#' + l.id : location.pathname);
  requestAnimationFrame(() => { fitWord(); draw(); });
}

function draw() {
  const l = LINES[cur], cv = $('cv'), r = cv.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const src = shapes[l.map];
  if (!src || !r.width) return;
  const s = Math.max(1, Math.floor(Math.min(W, H) / 150)), w = Math.ceil(W / s), h = Math.ceil(H / s);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const o = off.getContext('2d');
  o.filter = `blur(${Math.max(2, w / 38)}px)`;
  const k = Math.min(w / src.w, h / src.h) * .95, ox = (w - src.w * k) / 2, oy = (h - src.h * k) / 2;
  o.fillStyle = '#000';
  src.cells.forEach(([x, y]) => o.fillRect(ox + x * k, oy + y * k, k + .6, k + .6));
  const data = o.getImageData(0, 0, w, h).data;
  g.fillStyle = l.ink;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = data[(y * w + x) * 4 + 3] / 255;
    if (rnd() < .025 + a * .9) g.fillRect(x * s, y * s, s, s);
  }
}
addEventListener('resize', () => { fitWord(); draw(); });
document.fonts.ready.then(() => { fitWord(); draw(); });

Promise.all([
  fetch('/data/seoul-gu.geom.json').then(r => r.json()).then(g => {
    const c = [];
    g.grid.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') c.push([x, y]); }));
    shapes.seoul = { cells: c, w: g.cols, h: g.rows_n };
  }),
  fetch('/data/korea-pixels.json').then(r => r.json()).then(p => {
    const c = [];
    p.rows.forEach((row, y) => {
      let x = 0;
      for (const [, n, k] of row.matchAll(/(\d*)([.xS])/g)) {
        const len = +(n || 1);
        if (k !== '.') for (let j = 0; j < len; j++) c.push([x + j, y]);
        x += len;
      }
    });
    shapes.korea = { cells: c, w: p.w, h: p.h };
  })
]).then(draw).catch(() => {});
const fromHash = () => {
  const k = LINES.findIndex(l => l.id === location.hash.slice(1));
  if (k < 0) return false;
  show(k);
  setOpen(true);
  $('detail').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  return true;
};
addEventListener('hashchange', fromHash);
if (!fromHash()) show(0);

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
