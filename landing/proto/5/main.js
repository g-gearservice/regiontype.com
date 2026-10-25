/* 갈래 넷. 낱말의 _ \ * 는 시안의 장식. ← → 와 탭으로 넘긴다.
   망점은 서울 구 격자와 대한민국 점 지도. */
const LINES = [
  { id: 'practice', tab: '연습', bg: '#e5d7bf', ink: '#c4473f', out: '#b5b5b5', img: '36%', word: ['region_', 'type'], cap: ['Archive of place names', 'typed by hand'], map: 'seoul', href: '/' },
  { id: 'ranked', tab: '경쟁전', bg: '#126b98', ink: '#061922', out: '#b5b5b5', img: '42%', word: ['rank\\\\', 'ed'], cap: ['Matches judged by', 'speed and accuracy'], map: 'korea', href: '/' },
  { id: 'mimi', tab: 'mimi', bg: '#982323', ink: '#1a0607', out: 'linear-gradient(#2b74b8,#c9b8c6 60%,#c46d55)', img: '0%', word: ['mimi', '*board'], cap: ['', ''], map: null, href: '/mimi/',
    bio: '보드게임처럼 두꺼운 지형 위에서 지역을 타이핑한다.' },
  { id: 'bus', tab: '동네버스', bg: '#d9e04a', ink: '#14200c', out: '#b5b5b5', img: '40%', word: ['bus_', 'stops'], cap: ['Typing along', 'a neighbourhood line'], map: 'seoul', href: '/beta/bus/' }
];
const $ = id => document.getElementById(id);
const menu = $('menu');
let cur = 0, shapes = {};

LINES.forEach((l, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.role = 'tab';
  b.id = 'tab-' + l.id;
  b.textContent = l.tab;
  b.setAttribute('aria-controls', 'tp');
  b.addEventListener('click', () => show(i));
  menu.append(b);
});

addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (e.altKey || e.metaKey || e.ctrlKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  const n = e.key === 'ArrowRight' ? (cur + 1) % LINES.length : (cur + LINES.length - 1) % LINES.length;
  show(n);
  const b = menu.querySelector('[aria-selected="true"]');
  if (b) b.focus();
});

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
  el.setAttribute('aria-label', lines.join(' ').replace(/[_\\*]/g, ''));
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
  document.body.style.background = l.out;
  menu.querySelectorAll('button').forEach((b, k) => {
    b.setAttribute('aria-selected', String(k === i));
    b.tabIndex = k === i ? 0 : -1;
  });
  $('tp').setAttribute('aria-labelledby', 'tab-' + l.id);
  const cap = $('cap');
  cap.replaceChildren();
  cap.style.visibility = l.cap[0] ? 'visible' : 'hidden';
  l.cap.forEach((c, k) => {
    if (k) cap.append(document.createElement('br'));
    cap.append(c);
  });
  paintWord(l.word);
  const bio = $('bio');
  bio.hidden = !l.bio;
  bio.replaceChildren();
  if (l.bio) {
    bio.append(l.bio);
    const a = document.createElement('a');
    a.className = 'go';
    a.href = l.href;
    a.textContent = '판 열기 →';
    bio.append(document.createElement('br'), a);
  }
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
show(0);
