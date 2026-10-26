/* 서울 격자의 칸을 점 넷으로 쪼갠다. 구 이름을 치면 그 구의 점이 켜진다.
   아래 나라 지도는 world.json 의 pixels 를 그대로 찍는다. */
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
const norm = s => s.replace(/\s/g, '');
const lit = new Set();
const dots = {};
const $ = id => document.getElementById(id);

function circle(parent, attrs) {
  const c = document.createElementNS(NS, 'circle');
  for (const k in attrs) c.setAttribute(k, attrs[k]);
  parent.appendChild(c);
  return c;
}

function paintPixels(svg, p) {
  const m = Math.max(p.w, p.h);
  svg.setAttribute('viewBox', `0 0 ${m} ${m}`);
  svg.setAttribute('aria-hidden', 'true');
  const ox = (m - p.w) / 2, oy = (m - p.h) / 2;
  p.rows.forEach((row, y) => {
    let x = 0;
    for (const [, num, k] of row.matchAll(/(\d*)([.xS])/g)) {
      const len = +(num || 1);
      if (k !== '.') {
        for (let i = 0; i < len; i++) circle(svg, { cx: ox + x + i + .5, cy: oy + y + .5, r: .36 });
      }
      x += len;
    }
  });
}

fetch('/data/seoul-gu.geom.json').then(r => r.json()).then(g => {
  const map = $('map'), q = g.cell / 2;
  $('guCount').textContent = g.items.length;
  $('total').textContent = g.items.length;
  g.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const name = g.items[parseInt(ch, 36)].name;
    for (let i = 0; i < 4; i++) {
      const h = (x * 73 + y * 151 + i * 37) % 17;
      if (h < 4) continue;
      const r = q * (.14 + (h % 5) * .035);
      const c = circle(map, {
        cx: x * g.cell + (i % 2) * q + q / 2,
        cy: y * g.cell + (i >> 1) * q + q / 2,
        r: r.toFixed(2)
      });
      c.dataset.r = r;
      if (h === 16) c.classList.add('tint');
      (dots[name] = dots[name] || []).push(c);
    }
  }));
}).catch(() => {});

const t = $('t'), n = $('n');
const check = e => {
  if (e && e.isComposing) return;
  const v = norm(t.value);
  Object.entries(dots).forEach(([k, cs]) => cs.forEach(c => {
    c.classList.toggle('hot', !lit.has(k) && v.length > 0 && k.startsWith(v));
  }));
  if (dots[v] && !lit.has(v)) {
    lit.add(v);
    dots[v].forEach(c => {
      c.classList.remove('hot', 'tint');
      c.classList.add('on');
      c.setAttribute('r', (c.dataset.r * 2.1).toFixed(2));
    });
    t.value = '';
    n.textContent = lit.size;
  }
};
t.addEventListener('input', check);
t.addEventListener('compositionend', () => setTimeout(check));

fetch('/data/world.json').then(r => r.json()).then(world => {
  const list = world.countries || [];
  const box = $('nations');
  list.forEach(country => {
    const d = document.createElement('div');
    d.className = 'nation';
    const s = document.createElementNS(NS, 'svg');
    d.append(s);
    const sp = document.createElement('span');
    sp.textContent = NAMES[country.id] || country.id;
    d.append(sp);
    box.append(d);
    fetch(`/data/${country.pixels}.json`).then(r => r.json()).then(p => paintPixels(s, p)).catch(() => {});
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
