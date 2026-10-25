/* 구 이름을 점으로 잇고 담기로 고른다.
   고른 목록은 이 화면에만 있다. 플레이는 서울 코스(/)로 연다. */
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

function toggle(ko) {
  if (picked.has(ko)) picked.delete(ko);
  else picked.add(ko);
  sync();
}
function sync() {
  document.querySelectorAll('[data-ko]').forEach(el => {
    const on = picked.has(el.dataset.ko);
    if (el.matches('li')) el.classList.toggle('on', on);
    if (el.matches('button')) {
      el.setAttribute('aria-pressed', String(on));
      el.setAttribute('aria-label', `${el.dataset.ko} ${on ? '담음' : '담기'}`);
      const lab = el.querySelector('[data-lab]');
      if (lab) lab.textContent = on ? '담음' : '담기';
    }
  });
  document.getElementById('cnt').textContent = picked.size;
  document.getElementById('start').hidden = !picked.size;
}
function renderList() {
  const ol = document.getElementById('rows');
  ol.replaceChildren(...items.map(it => {
    const li = document.createElement('li');
    li.dataset.ko = it.ko;
    const a = document.createElement('a');
    a.className = 'nm';
    a.href = '/';
    a.textContent = it.en;
    const sm = document.createElement('small');
    sm.textContent = it.ko;
    a.append(sm);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.dataset.ko = it.ko;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `${it.ko} 담기`);
    const lab = document.createElement('span');
    lab.dataset.lab = '';
    lab.textContent = '담기';
    b.append(lab);
    b.addEventListener('click', () => toggle(it.ko));
    li.append(a, b);
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
    b.setAttribute('aria-label', `${it.ko} 담기`);
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
    sp.textContent = it.en;
    b.append(s, sp);
    b.addEventListener('click', () => toggle(it.ko));
    return b;
  }));
}
document.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.v;
  document.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  document.getElementById('rows').hidden = v !== 'list';
  document.getElementById('grid').hidden = v !== 'grid';
}));
