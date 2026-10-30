import { ribbons, tiles } from '../catalog.js';
import { loadGeom } from '../play.js';
import { boardSvg } from '../board.js';

const PALE = { 1: ['#DCE8DE', '#5E7A63'], 2: ['#F3E0D6', '#96543C'], 3: ['#E8DFEE', '#7A6389'] };
const STEP = { 1: '가볍게', 2: '한 판', 3: '길게' };

function tile(item, geom) {
  const dots = [0, 1, 2].map(i => `<i class="${i < item.hard ? 'on' : ''}"></i>`).join('');
  const [fill, tone] = PALE[item.hard];
  return `<button class="tile" type="button" data-region="${item.region}" data-go="table/${item.id}">
    <div class="thumb">${geom ? boardSvg(geom, item.id, 'slice') : ''}</div>
    <div class="body">
      <div class="pills">
        <span class="pill region">${item.region}</span>
        <span class="pill" style="background:${fill};color:${tone}">${STEP[item.hard]}</span>
      </div>
      <h3>${item.title}</h3>
      <div class="meta">
        <span class="plays">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h4"/></svg>
          ${item.count}곳
        </span>
        <span class="dots">${dots}</span>
      </div>
    </div>
  </button>`;
}

export async function atlas({ mode = 'learning' }) {
  /* 카드마다 그 구의 진짜 지형이 올라간다. 지형 파일만 받는다 — 코스는 눌러야 필요하다. */
  const geoms = await Promise.all(tiles.map(t => loadGeom(t.id).catch(() => null)));

  return `<div class="atlas">
    <div class="mast">
      <div class="brand">
        <strong>regiontype</strong>
        <em>지역을 타이핑으로 알리자</em>
      </div>
      <div class="mast-end">
        <label class="find">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
          <input type="search" placeholder="자치구 · 코스 검색" aria-label="자치구 · 코스 검색">
        </label>
        <div class="seg" data-mode="${mode}" role="tablist" aria-label="모드">
          <b data-mode="practice" aria-pressed="${mode === 'practice'}">PRACTICE</b>
          <b data-mode="learning" aria-pressed="${mode === 'learning'}">LEARNING</b>
          <b data-mode="quiz" aria-pressed="${mode === 'quiz'}">QUIZ</b>
        </div>
      </div>
    </div>
    <div class="ribbons" role="tablist" aria-label="필터">
      ${ribbons.map((r, i) =>
        `<button class="chip${i === 0 ? ' on' : ''}" type="button" aria-pressed="${i === 0}">${r}</button>`
      ).join('')}
    </div>
    <div class="deck">
      ${tiles.map((t, i) => tile(t, geoms[i])).join('')}
    </div>
    <nav class="rail" aria-label="보드">
      <a href="#/atlas" aria-current="page">코스 탐색</a>
      <a href="#/sheet">결과</a>
      <a href="#/modes">모드</a>
      <a href="#/sight">접근성</a>
      <a href="#/districts">팔레트</a>
      <a href="#/foundation">스타일</a>
    </nav>
  </div>`;
}
