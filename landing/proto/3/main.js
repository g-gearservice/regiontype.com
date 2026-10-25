/* 지명 한 줄 + 그 지명의 점 지도. 가나다/코스 순, 앞글자로 거른다.
   빨강 칸은 /style.css 의 --ranked. 나라 목록은 world.json. */
const NS = 'http://www.w3.org/2000/svg';
const NAMES = {
  AE: 'United Arab Emirates', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  BE: 'Belgium', BG: 'Bulgaria', BR: 'Brazil', CA: 'Canada', CH: 'Switzerland',
  CL: 'Chile', CN: 'China', CO: 'Colombia', CZ: 'Czechia', DE: 'Germany',
  EG: 'Egypt', ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom',
  GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland',
  IN: 'India', IT: 'Italy', JP: 'Japan', KR: 'Korea', MX: 'Mexico', MY: 'Malaysia',
  NL: 'Netherlands', NO: 'Norway', NZ: 'New Zealand', PH: 'Philippines',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SA: 'Saudi Arabia', SE: 'Sweden',
  TH: 'Thailand', TR: 'Türkiye', TW: 'Taiwan', UA: 'Ukraine', US: 'United States',
  VN: 'Vietnam', ZA: 'South Africa'
};
const LOOKS = [['#0d0d0d', '#fff'], ['#e9e9e9', '#0d0d0d'], ['#1f4fd8', '#fff'], ['#f2b41b', '#0d0d0d'], ['#c8322a', '#fff']];
const $ = id => document.getElementById(id);
const d = new Date();
$('date').textContent = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

function thumb(cells, w, h, look, ctx) {
  const s = document.createElementNS(NS, 'svg'), m = Math.max(w, h) + 2;
  s.setAttribute('viewBox', `0 0 ${m} ${m}`);
  s.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', m); bg.setAttribute('height', m); bg.setAttribute('fill', look[0]);
  s.append(bg);
  const ox = (m - w) / 2, oy = (m - h) / 2;
  const dot = (x, y, opacity) => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', ox + x + .1); r.setAttribute('y', oy + y + .1);
    r.setAttribute('width', .8); r.setAttribute('height', .8); r.setAttribute('fill', look[1]);
    if (opacity) r.setAttribute('opacity', opacity);
    s.append(r);
  };
  (ctx || []).forEach(([x, y]) => dot(x, y, .28));
  cells.forEach(([x, y]) => dot(x, y));
  return s;
}
const bbox = cs => {
  const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { cells: cs.map(([x, y]) => [x - x0, y - y0]), w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1 };
};
const cellsOf = p => {
  const cells = [];
  p.rows.forEach((row, y) => {
    let x = 0;
    for (const [, num, k] of row.matchAll(/(\d*)([.xS])/g)) {
      const n = +(num || 1);
      if (k !== '.') for (let j = 0; j < n; j++) cells.push([x + j, y]);
      x += n;
    }
  });
  return cells;
};

let rows = { seoul: [], world: [] }, tab = 'seoul', sort = 'course', worldP = null;
const list = $('list');

function render() {
  const q = $('q').value.replace(/\s/g, '').toLowerCase();
  const rs = [...rows[tab]].sort((a, b) => sort === 'abc' ? a.name.localeCompare(b.name, 'ko') : a.order - b.order);
  list.replaceChildren(...rs.map(r => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = '/';
    const nm = document.createElement('span');
    nm.className = 'nm' + (r.lat ? ' lat' : '');
    nm.textContent = r.name;
    const th = document.createElement('span');
    th.className = 'th';
    th.append(...r.thumbs.map(s => s.cloneNode(true)));
    a.append(nm, th);
    li.append(a);
    li.hidden = !!q && !r.name.replace(/\s/g, '').toLowerCase().startsWith(q);
    return li;
  }));
  $('none').hidden = rs.some(r => !q || r.name.replace(/\s/g, '').toLowerCase().startsWith(q));
  $('worldNote').hidden = tab !== 'world';
}

Promise.all([
  fetch('/data/seoul-gu.geom.json').then(r => r.json()),
  fetch('/data/seoul-gu.course.json').then(r => r.json()),
  fetch('/style.css').then(r => r.text()).catch(() => '')
]).then(([g, c, css]) => {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  const ranked = root && root[1].match(/--ranked\s*:\s*(#[0-9a-fA-F]{3,8})/);
  if (ranked) LOOKS[4][0] = ranked[1];
  const all = [], by = {};
  g.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const n = g.items[parseInt(ch, 36)].name;
    all.push([x, y]);
    (by[n] = by[n] || []).push([x, y]);
  }));
  const A = bbox(all);
  const ax = Math.min(...all.map(p => p[0])), ay = Math.min(...all.map(p => p[1]));
  rows.seoul = c.items.map((it, i) => {
    const own = bbox(by[it.name] || [[0, 0]]);
    const inCity = (by[it.name] || []).map(([x, y]) => [x - ax, y - ay]);
    const thumbs = [
      thumb(own.cells, own.w, own.h, LOOKS[i % 5]),
      thumb(inCity, A.w, A.h, LOOKS[(i + 1) % 5], A.cells),
      thumb(own.cells, own.w, own.h, LOOKS[(i + 2) % 5]),
      thumb(inCity, A.w, A.h, LOOKS[(i + 3) % 5], A.cells)
    ];
    return { name: it.name, key: it.name, order: i, thumbs: thumbs.slice(0, 2 + (i % 3)) };
  });
  $('tabSeoul').textContent = `서울 ${rows.seoul.length}`;
  render();
}).catch(() => {});

function loadWorld() {
  if (rows.world.length) return Promise.resolve();
  if (worldP) return worldP;
  worldP = fetch('/data/world.json').then(r => r.json()).then(world => Promise.all(world.countries.map((country, i) =>
    fetch(`/data/${country.pixels}.json`).then(r => r.json()).then(p => {
      const cells = cellsOf(p);
      const name = NAMES[country.id] || country.id;
      return {
        name, key: name, order: i, lat: true,
        thumbs: [0, 1, 2].slice(0, 1 + (i % 3)).map(k => thumb(cells, p.w, p.h, LOOKS[(i + k) % 5]))
      };
    }).catch(() => null))
  )).then(r => {
    rows.world = r.filter(Boolean);
    $('tabWorld').textContent = `World ${rows.world.length}`;
  });
  return worldP;
}

$('q').addEventListener('input', render);
document.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
  sort = b.dataset.sort;
  document.querySelectorAll('[data-sort]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
}));
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  (tab === 'world' ? loadWorld() : Promise.resolve()).then(render).catch(() => {});
}));
