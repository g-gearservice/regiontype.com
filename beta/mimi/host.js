import { atlas } from './scenes/atlas.js';
import { table } from './scenes/table.js';
import { sheet } from './scenes/sheet.js';
import { modesScene, sight, districts, foundation } from './scenes/studio.js';

const scenes = {
  atlas,
  table,
  sheet,
  modes: modesScene,
  sight,
  districts,
  foundation
};

const state = {
  mode: 'learning',
  ribbon: '전체'
};

/* 씬은 문자열이나 { html, mount } 를 돌려준다. mount는 정리 함수를 돌려줄 수 있다. */
let teardown = null;
let epoch = 0;

function read() {
  const raw = (location.hash.replace(/^#\/?/, '') || 'atlas').split('/');
  const name = scenes[raw[0]] ? raw[0] : 'atlas';
  return { name, id: raw[1] };
}

async function paint() {
  const { name, id } = read();
  const mine = ++epoch;
  if (teardown) teardown(), teardown = null;

  const root = document.getElementById('stage');
  let out;
  try {
    out = await scenes[name]({ id, mode: state.mode, ribbon: state.ribbon, go });
  } catch (err) {
    console.error(err);
    out = `<p class="fault">코스를 불러오지 못했다. <a href="#/atlas">코스 탐색으로</a></p>`;
  }
  /* 늦게 도착한 응답이 새 씬을 덮어쓰지 않게 한다. */
  if (mine !== epoch) return;

  document.documentElement.dataset.scene = name;
  document.body.style.overflow = name === 'table' ? 'hidden' : '';
  root.innerHTML = typeof out === 'string' ? out : out.html;
  wire(root);
  const current = root.querySelector(`.rail a[href="#/${name}"]`);
  if (current) current.setAttribute('aria-current', 'page');
  if (typeof out === 'object' && out.mount) teardown = out.mount(root) || null;
}

function go(path) {
  const next = path.replace(/^#\/?/, '');
  if (location.hash === '#/' + next) paint();
  else location.hash = '#/' + next;
}

function wire(root) {
  root.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => go(el.dataset.go));
  });
  root.querySelectorAll('.seg b[data-mode]').forEach(el => {
    el.addEventListener('click', () => {
      state.mode = el.dataset.mode;
      const { name } = read();
      if (name === 'modes') paint();
      else go('atlas');
    });
  });
  root.querySelectorAll('.ribbons .chip').forEach(el => {
    el.addEventListener('click', () => {
      state.ribbon = el.textContent;
      root.querySelectorAll('.ribbons .chip').forEach(c => {
        const on = c === el;
        c.classList.toggle('on', on);
        c.setAttribute('aria-pressed', on);
      });
      /* 카드가 26장이라 리본은 장식이 아니라 실제로 걸러야 한다 */
      root.querySelectorAll('.deck .tile').forEach(t => {
        t.hidden = state.ribbon !== '전체' && t.dataset.region !== state.ribbon;
      });
    });
  });
}

window.addEventListener('hashchange', paint);
paint();
