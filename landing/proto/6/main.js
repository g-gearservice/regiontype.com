/* 여섯 칸을 점으로 이은 줄로 세우고, 담기 알약이 칸을 펼친다.
   플레이 칸 안에서는 구를 담는다. 고른 목록은 이 화면에만 있고, 바로가기는 /#home 을 새 탭으로 연다. */
const NS = 'http://www.w3.org/2000/svg';
const picked = new Set();
const items = [];
const mast = document.getElementById('mast');

const fit = () => {
  mast.style.fontSize = '100px';
  const w = document.body.clientWidth - 36;
  const sw = mast.scrollWidth;
  if (sw > 0) mast.style.fontSize = (100 * w / sw) + 'px';
};
document.fonts.ready.then(fit);
addEventListener('resize', fit);

Promise.all(['seoul-gu.course', 'seoul-gu.geom', 'kr-names'].map(f => fetch(`/data/${f}.json`).then(r => r.json()))).then(([c, g, names]) => {
  const by = {};
  g.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const n = g.items[parseInt(ch, 36)].name;
    (by[n] = by[n] || []).push([x, y]);
  }));
  c.items.forEach(it => {
    const en = (names['seoul-gu/' + it.name] || it.name).replace(/-gu$/, '.Gu');
    items.push({ ko: it.name, en, cells: by[it.name] || [] });
  });
  document.getElementById('of').textContent = items.length;
  renderList();
  renderGrid();
  fit();
}).catch(() => {});

// 담기/담음 두 말을 다 두고 aria-pressed 로 하나만 보인다. 이름은 화면 밖 글자로 버튼 안에 남긴다
function pickLabel(ko) {
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = ko + ' ';
  const add = document.createElement('span');
  add.className = 'lab-add';
  add.dataset.i18n = 'play.pick.add';
  add.textContent = '담기';
  const done = document.createElement('span');
  done.className = 'lab-done';
  done.dataset.i18n = 'play.pick.added';
  done.textContent = '담음';
  return [sr, add, done];
}
function toggle(ko) {
  if (picked.has(ko)) picked.delete(ko);
  else picked.add(ko);
  sync();
}
function sync() {
  document.querySelectorAll('[data-ko]').forEach(el => {
    const on = picked.has(el.dataset.ko);
    if (el.matches('li')) el.classList.toggle('on', on);
    if (el.matches('button')) el.setAttribute('aria-pressed', String(on));
  });
  document.getElementById('cnt').textContent = picked.size;
  document.getElementById('start').hidden = !picked.size;
}
function renderList() {
  const ol = document.getElementById('gus');
  ol.replaceChildren(...items.map(it => {
    const li = document.createElement('li');
    li.dataset.ko = it.ko;
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = it.en;
    const sm = document.createElement('small');
    sm.textContent = it.ko;
    nm.append(sm);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.dataset.ko = it.ko;
    b.setAttribute('aria-pressed', 'false');
    b.append(...pickLabel(it.ko));
    b.addEventListener('click', () => toggle(it.ko));
    li.append(nm, b);
    return li;
  }));
}
function renderGrid() {
  const box = document.getElementById('grid');
  box.replaceChildren(...items.map(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.ko = it.ko;
    b.setAttribute('aria-pressed', 'false');
    const cells = it.cells.length ? it.cells : [[0, 0]];
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1, m = Math.max(w, h) + 2;
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${m} ${m}`);
    s.setAttribute('aria-hidden', 'true');
    it.cells.forEach(([x, y]) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x - x0 + (m - w) / 2 + .5);
      c.setAttribute('cy', y - y0 + (m - h) / 2 + .5);
      c.setAttribute('r', .4);
      c.setAttribute('fill', '#0b0b0b');
      s.append(c);
    });
    const sp = document.createElement('span');
    sp.className = 'gn';
    sp.textContent = it.en;
    const lab = document.createElement('span');
    lab.className = 'gl';
    lab.append(...pickLabel(it.ko));
    b.append(s, sp, lab);
    b.addEventListener('click', () => toggle(it.ko));
    return b;
  }));
}
document.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.v;
  document.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  document.getElementById('gus').hidden = v !== 'list';
  document.getElementById('grid').hidden = v !== 'grid';
}));

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
