/* 자치구 코스 순서. 들여쓰기는 시안의 리듬(왼쪽 1·7, 오른쪽 3·9).
   이름을 치면 그 줄이 기울어진다. 플레이 호의 빨강은 /style.css 의 --ranked.
   호 여섯이 /landing/ 의 여섯 칸이다. */
const $ = id => document.getElementById(id);

fetch('/data/seoul-gu.course.json').then(r => r.json()).then(c => {
  const names = c.items.map(i => i.name);
  const A = $('colA'), B = $('colB');
  const indentA = new Set([0, 6]), indentB = new Set([2, 8]);
  names.forEach((n, i) => {
    const li = document.createElement('li');
    li.textContent = n;
    li.dataset.n = n;
    const col = i < 13 ? 0 : 1, k = col ? i - 13 : i;
    if ((col ? indentB : indentA).has(k)) li.classList.add('in');
    (col ? B : A).append(li);
  });
  const n = names.length;
  const secs = c.settings && c.settings.defaultTime;
  const min = secs ? Math.round(secs / 60) : 2;
  $('ltdN').textContent = n;
  $('capTime').textContent = `${min}분 · ${n}곳`;
}).catch(() => {});

fetch('/style.css').then(r => r.text()).then(css => {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!root) return;
  const m = root[1].match(/--ranked\s*:\s*(#[0-9a-fA-F]{3,8})/);
  if (m) document.querySelector('[data-ranked]').style.setProperty('--c', m[1]);
}).catch(() => {});

const fit = () => document.querySelectorAll('.issue .big').forEach(el => {
  el.style.fontSize = '100px';
  const issue = el.closest('.issue');
  const w = issue.clientWidth - parseFloat(getComputedStyle(issue).paddingLeft) * 2;
  const sw = el.scrollWidth;
  if (sw > 0) el.style.fontSize = (100 * w / sw * .985) + 'px';
});
document.fonts.ready.then(fit);
addEventListener('resize', fit);

const t = $('t');
const check = e => {
  if (e && e.isComposing) return;
  const v = t.value.replace(/\s/g, '');
  const li = document.querySelector(`.names li[data-n="${CSS.escape(v)}"]:not(.done)`);
  if (li) {
    li.classList.add('done');
    t.value = '';
    $('live').textContent = `${v} 맞힘`;
  }
};
t.addEventListener('input', check);
t.addEventListener('compositionend', () => setTimeout(check));

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
