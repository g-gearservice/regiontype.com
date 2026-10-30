import { modes, chips, lifts, tiles } from '../catalog.js';

/* 모드 아이콘 — repeat / graduation-cap / timer. 아이콘 폰트 없이 세 개면 충분하다. */
const paths = {
  practice: '<path d="M6 8h9a4 4 0 0 1 4 4M18 16H9a4 4 0 0 1-4-4"/><path d="m15 5 3 3-3 3M9 19l-3-3 3-3"/>',
  learning: '<path d="m12 5 9 4-9 4-9-4 9-4Z"/><path d="M7 11v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"/>',
  quiz: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3.5l2.2 1.6M9.5 3h5"/>'
};
const glyph = id => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.quiz}</svg>`;


function rail() {
  return `<nav class="rail" aria-label="보드">
    <a href="#/atlas">코스 탐색</a>
    <a href="#/sheet">결과</a>
    <a href="#/modes">모드</a>
    <a href="#/sight">접근성</a>
    <a href="#/districts">팔레트</a>
    <a href="#/foundation">스타일</a>
  </nav>`;
}

export function modesScene() {
  return `<div class="studio">
    <header>
      <h1>모드 표시 · Practice / Learning / Quiz</h1>
      <p>토글은 지도와 같은 하드 섀도를 쓰고, 활성 상태만 색을 갖는다</p>
    </header>
    <div class="lifts">
      ${['practice', 'learning', 'quiz'].map(m => `
        <div class="seg" data-mode="${m}">
          <b data-mode="practice">PRACTICE</b>
          <b data-mode="learning">LEARNING</b>
          <b data-mode="quiz">QUIZ</b>
        </div>`).join('')}
    </div>
    <div class="modes">
      ${modes.map(m => `
        <article class="slab mode-card">
          <div class="icon-chip" style="background:${m.paint}">${glyph(m.id)}</div>
          <h2>${m.kr}<span style="color:${m.paint}">${m.en}</span></h2>
          <p>${m.desc}</p>
          <ul style="--dot:${m.paint}">
            ${m.rules.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </article>`).join('')}
    </div>
    ${rail()}
  </div>`;
}

export function sight() {
  return `<div class="studio">
    <header>
      <h1>접근성 변형 — 색맹 모드 · 다크 모드</h1>
      <p>두 변형 모두 색에만 의존하지 않는다. 현재 목표 지역은 색 + 굵은 외곽선으로 이중 부호화한다.</p>
    </header>
    <div class="pair">
      <article class="variant safe">
        <h2>색맹 안전 모드</h2>
        <p>적록 구분에 의존하지 않는 청–황–주황 축 + 명도 사다리</p>
        <div class="mini-cue">
          <span>공항동</span>
          <b>화곡1동</b>
          <span class="box">화곡1</span>
          <span>화곡2동</span>
        </div>
        <div class="row-swatch">${chips.safe.map(c => `<i style="background:${c}"></i>`).join('')}</div>
      </article>
      <article class="variant night">
        <h2>다크 모드</h2>
        <p>야간 팔레트 · 그림자는 검정 하드 섀도로 유지</p>
        <div class="mini-cue">
          <span>공항동</span>
          <b>화곡1동</b>
          <span class="box">화곡1</span>
          <span>화곡2동</span>
        </div>
        <div class="row-swatch">${chips.night.map(c => `<i style="background:${c}"></i>`).join('')}</div>
      </article>
    </div>
    ${rail()}
  </div>`;
}

export function districts() {
  const gs = ['방화1동','방화2동','방화3동','공항동','가양1동','가양2동','가양3동','발산1동','우장산동','등촌3동','등촌1동','등촌2동','염창동','화곡1동','화곡2동','화곡3동','화곡4동','화곡6동','화곡8동'];
  const jn = ['평창동','부암동','삼청동','청운효자동','종로1·2·3·4가동','가회동','혜화동','무악동','교남동','사직동','종로5·6가동','이화동','창신1동','창신2동','창신3동','숭인1동','숭인2동'];
  return `<div class="studio">
    <header>
      <h1>자치구별 팔레트 — 뉴욕과 뭄바이만큼 벌린다</h1>
      <p>강서구는 한강·김포공항의 수변 도시, 종로구는 산·고궁의 흙과 단청. 같은 서비스지만 다른 판처럼 느껴져야 한다.</p>
    </header>
    <div class="districts">
      <article class="slab district">
        <div class="district-head">
          <div><h2>강서구</h2><em>수변 · 활주로 · 저층 격자</em></div>
          <span class="accent-pill" style="background:#8FD9C8;color:#2E5A52">#8FD9C8</span>
        </div>
        <div class="row-swatch">${chips.gangseo.map(c => `<i style="background:${c}"></i>`).join('')}</div>
        <div class="names">${gs.map(n => `<span>${n}</span>`).join('')}</div>
      </article>
      <article class="slab district">
        <div class="district-head">
          <div><h2>종로구</h2><em>산 · 고궁 · 단청과 흙</em></div>
          <span class="accent-pill" style="background:#C1362B;color:#FFF6E8">#C1362B</span>
        </div>
        <div class="row-swatch">${chips.jongno.map(c => `<i style="background:${c}"></i>`).join('')}</div>
        <div class="names">${jn.map(n => `<span>${n}</span>`).join('')}</div>
      </article>
    </div>
    ${rail()}
  </div>`;
}

export function foundation() {
  const sample = tiles[0];
  return `<div class="studio">
    <header>
      <h1>regiontype · “Mimi” 스타일</h1>
      <p>보드게임처럼 두껍고, 그림자에 블러가 없고, 지형은 게임 오브젝트로 뭉갠다.</p>
    </header>
    <div class="swatches">
      ${chips.outer.map(([n, hex]) => `
        <div class="swatch">
          <div class="chip-color" style="background:${hex}"></div>
          <b>${n}</b>
          <code>${hex}</code>
        </div>`).join('')}
    </div>
    <header>
      <h1>그림자 강도 — 블러는 언제나 0</h1>
      <p>0: dx8/dy10 · 1: dx16/dy20(권장) · 2: dx28/dy34</p>
    </header>
    <div class="lifts">
      ${lifts.map(l => `
        <div class="lift-card">
          <div class="sample" style="box-shadow:${l.x}px ${l.y}px 0 var(--slab)"></div>
          <b>${l.name}</b>
          <code style="color:var(--mute);font-family:var(--tally)">${l.spec}</code>
        </div>`).join('')}
    </div>
    <header>
      <h1>타이포그래피</h1>
      <p>Jua = 지명·헤드라인 · Noto Sans KR = 본문 · Baloo 2 = 숫자</p>
    </header>
    <div class="type-row">
      <div>
        <div class="sample face">화곡동</div>
        <small>Jua · 지명 / 헤드라인</small>
      </div>
      <div>
        <div class="sample tally">1,284</div>
        <small>Baloo 2 · 통계 / 카운트</small>
      </div>
    </div>
    <p style="font-size:22px">지역을 타이핑으로 알리자 <small style="color:var(--mute)">Noto Sans KR · 본문 / UI</small></p>
    <header><h1>카드 스타일</h1></header>
    <div style="max-width:430px">
      <button class="tile" type="button" data-go="table/${sample.id}">
        <div class="mosaic"><span class="river"></span>
          <i style="left:8%;top:18%;width:18%;height:22%;background:#9EC6DE"></i>
          <i style="left:30%;top:14%;width:16%;height:20%;background:#EFD79A"></i>
          <i style="left:50%;top:16%;width:20%;height:24%;background:#A8BE7E"></i>
          <i style="left:74%;top:12%;width:14%;height:28%;background:#E8622B"></i>
        </div>
        <div class="body">
          <div class="pills">
            <span class="pill region">${sample.region}</span>
            <span class="pill" style="background:${sample.kindFill};color:${sample.kindTone}">${sample.kind}</span>
          </div>
          <h3>${sample.title}</h3>
        </div>
      </button>
    </div>
    ${rail()}
  </div>`;
}
