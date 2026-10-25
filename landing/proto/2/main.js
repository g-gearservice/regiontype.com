/* 자치구 코스 순서. 들여쓰기는 시안의 리듬(왼쪽 1·7, 오른쪽 3·9).
   이름을 치면 그 줄이 기울어진다. 경쟁전 판의 빨강은 style.css 의 --ranked. */
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
  if (m) $('issue-ranked').style.setProperty('--c', m[1]);
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
