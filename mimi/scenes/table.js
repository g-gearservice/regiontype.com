import { tiles } from '../catalog.js';
import { load, createRun } from '../play.js';
import { boardSvg, paintBoard } from '../board.js';

const MODE_PAINT = { practice: 'var(--drill)', learning: 'var(--mark)', quiz: 'var(--flare)' };

export async function table({ id = 'gangseo-dong', mode = 'learning', go }) {
  const card = tiles.find(t => t.id === id) || tiles[0];
  const data = await load(card.id);
  const run = createRun(data, mode);

  const html = `<div class="table" data-mode="${mode}">
    <a class="back-chip" href="#/atlas" aria-label="코스로">←</a>
    <div class="plate">${boardSvg(data.geom, card.id)}</div>
    <div class="brief">
      <span class="badge" style="background:${MODE_PAINT[mode]}">${mode.toUpperCase()}</span>
      <h1>${card.title}</h1>
      <p>${data.course.description}</p>
    </div>
    <div class="tally">
      <div class="row">
        <div class="num"><b class="done">0</b><span>/ ${run.names.length}</span></div>
        <span class="cap">${card.region === '서울' && card.id === 'seoul-gu' ? '자치구' : '행정동'}</span>
      </div>
      <div class="bar"><i style="width:0%"></i></div>
    </div>
    <div class="dock">
      <span class="clock">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        <time>0:00</time>
      </span>
      <div class="cue">
        <div class="side prev">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>
          <span></span>
        </div>
        <div class="box">
          <span class="ghost" aria-hidden="true"></span>
          <input aria-label="현재 지명" spellcheck="false" autocomplete="off" autocapitalize="off">
        </div>
        <div class="side next"><span></span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
        </div>
      </div>
      <p class="hint" aria-live="polite"></p>
    </div>
  </div>`;

  function mount(root) {
    const svg = root.querySelector('.board');
    const input = root.querySelector('.cue input');
    const box = root.querySelector('.cue .box');
    const prev = root.querySelector('.side.prev span');
    const next = root.querySelector('.side.next span');
    const done = root.querySelector('.tally .done');
    const bar = root.querySelector('.bar i');
    const time = root.querySelector('.clock time');
    const hint = root.querySelector('.hint');
    const ghost = root.querySelector('.cue .ghost');

    function draw() {
      paintBoard(svg, run);
      prev.textContent = run.prev;
      /* QUIZ는 다음 지명도 답이다. 안 보여준다. */
      next.textContent = mode === 'quiz' ? '' : run.next;
      done.textContent = run.i;
      bar.style.width = `${(run.i / run.names.length) * 100}%`;
      box.classList.toggle('bad', run.bad);
      hint.textContent = run.hint
        ? `초성 ${run.hint}`
        : mode === 'practice' ? 'Enter — 모르겠으면 넘어간다' : '';
      /* 쳐야 할 지명을 입력칸 안에 흐리게 깔아 둔다. QUIZ는 그게 답이라 안 깐다.
         친 만큼은 자리만 차지하고 안 그린다 — '과'와 '광'은 다른 글리프라
         겹쳐 놓으면 받침 때문에 초성·중성이 어긋난다. 남은 글자만 이어 붙인다. */
      if (mode === 'quiz' || run.over) ghost.replaceChildren();
      else {
        const eaten = document.createElement('span');
        eaten.className = 'eaten';
        eaten.textContent = run.typed;
        ghost.replaceChildren(eaten, run.target.slice(run.typed.length));
      }
      /* 조합 중인 한글을 건드리면 IME가 깨진다. 달라졌을 때만 쓴다. */
      if (input.value !== run.typed) input.value = run.typed;
    }

    function finish() {
      if (mode === 'practice') go('atlas');
      else go(`sheet/${card.id}`);
    }

    input.addEventListener('input', () => {
      if (run.feed(input.value)) draw();
      if (run.over) finish();
    });
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (run.skip()) draw();
      if (run.over) finish();
    });

    run.start();
    draw();
    input.focus();

    const tick = setInterval(() => { time.textContent = run.clock }, 250);
    return () => clearInterval(tick);
  }

  return { html, mount };
}
