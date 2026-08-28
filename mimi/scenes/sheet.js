import { sheet as fixture } from '../catalog.js';
import { store } from '../play.js';
import { boardSvg, paintBoard } from '../board.js';

/* 완주한 판은 전부 done이다. paintBoard가 읽는 만큼만 흉내낸다. */
const finished = { mode: 'learning', mark: () => 'done' };

export function sheet() {
  const run = store.run;
  /* 방금 끝낸 판이 있으면 그걸 쓰고, 없으면 디자인 원안의 기록을 보여준다. */
  const rec = run ? run.summary() : fixture;

  const html = `<div class="sheet">
    <article class="slab report">
      <div class="board-wrap">
        ${run
          ? boardSvg(run.geom, run.slug)
          : `<img src="boards/a6PPkz.png" alt="${rec.ribbon} — 완주한 강서구 보드">`}
        ${run ? `<span class="ribbon">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8FD9C8" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4h13l-2.5 4L18 12H5"/></svg>
          ${rec.ribbon}</span>` : ''}
      </div>
      <div class="report-body">
        <div>
          <h2>${rec.title}</h2>
          <p class="sub">${rec.meta}</p>
        </div>
        <div class="stats">
          ${rec.stats.map(s => `
            <div class="stat${s.flare ? ' flare' : ''}">
              <b>${s.value}${s.unit ? `<span class="unit"> ${s.unit}</span>` : ''}</b>
              <small>${s.label}</small>
            </div>`).join('')}
        </div>
        <div class="foot">
          <b>regiontype</b>
          <span>${rec.link}</span>
        </div>
      </div>
    </article>
    <div class="detail">
      <h3>구간별 기록</h3>
      <ul class="ledger">
        ${rec.rows.map(r => `
          <li class="${r.miss ? 'miss' : ''}">
            <i></i>
            <span>${r.name}</span>
            <time>${r.time}</time>
            <em>${r.acc}</em>
          </li>`).join('')}
      </ul>
      <div class="actions">
        <a class="act flare" href="#/table/${run ? run.slug : 'gangseo-dong'}">다시 도전</a>
        <a class="act paper" href="#/atlas">코스 탐색</a>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(root) {
      const svg = root.querySelector('.board');
      if (svg) paintBoard(svg, finished);
    }
  };
}
