/* Mimi 보드 — geom 격자를 두꺼운 판때기로 그린다.
   칸마다 안쪽으로 pad만큼 줄인 사각형을 하나의 path로 합치고,
   같은 색 stroke를 2*pad 두께로 둥글게 둘러 원래 크기를 되찾는다.
   덕분에 같은 동의 칸끼리는 붙고, 바깥 모서리만 둥글어진다. */

const SYM = '0123456789abcdefghijklmnopqrstuvwxyz';
/* 칸 크기는 구마다 다르다(1000/22 ~ 1000/40). 여백·테두리·그림자를 픽셀로 박아 두면
   촘촘한 구에서 이웃 구역끼리 서로 파고든다. 전부 칸 크기에 비례시킨다. */
const PAD = .16;   // 칸 대비 안쪽 여백

const PALETTE = {
  /* 주황 계열은 뺀다 — 현재 목표(--flare)만 주황이어야 눈에 박힌다. */
  'gangseo-dong': ['#8FD9C8', '#9EC6DE', '#BCCB90', '#EFD79A', '#A9AEDA', '#9FBF9A', '#A8BE7E', '#7FC9BC'],
  'seoul-gu': ['#9EC6DE', '#E5C489', '#A8BE7E', '#C79FC0', '#8FD9C8', '#A9AEDA', '#BCCB90', '#7FC9BC']
};
const FALLBACK = PALETTE['gangseo-dong'];

/* 손으로 고른 팔레트는 두 코스뿐이다. 나머지 구는 같은 색을 슬러그 해시만큼
   돌려 쓴다 — 구마다 다른 판처럼 보이되, 25벌을 지어내지는 않는다.
   ponytail: 구별 고유 팔레트가 필요해지면 여기 표에 얹는다 (design.pen 07). */
export function paletteOf(slug) {
  if (PALETTE[slug]) return PALETTE[slug];
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const n = h % FALLBACK.length;
  return FALLBACK.slice(n).concat(FALLBACK.slice(0, n));
}

function cellsOf(geom) {
  const out = geom.items.map(() => []);
  geom.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const i = SYM.indexOf(ch);
    if (out[i]) out[i].push([x, y]);
  }));
  return out;
}

const pathOf = (cells, cell) => {
  const p = cell * PAD, w = cell - p * 2;
  return cells.map(([x, y]) =>
    `M${(x * cell + p).toFixed(1)} ${(y * cell + p).toFixed(1)}h${w.toFixed(1)}v${w.toFixed(1)}h-${w.toFixed(1)}z`
  ).join('');
};

/* 한 번만 그린다. 이후 상태 변화는 paint()가 클래스만 바꾼다. */
let seq = 0;

export function boardSvg(geom, slug, fit = 'meet') {
  const gid = `mimi-grid-${++seq}`;   // 한 화면에 판이 여럿 뜨면 id가 겹친다
  const cells = cellsOf(geom);
  const paint = paletteOf(slug);
  const shapes = geom.items.map((g, i) => ({ name: g.name, d: pathOf(cells[i], geom.cell), c: paint[i % paint.length] }));

  /* 라벨은 그 구역 폭에 맞춘다. 안 그러면 좁은 동에서 이름이 서로 밟는다. */
  const size = i => {
    const xs = cells[i].map(([x]) => x);
    if (!xs.length) return 14;
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * geom.cell;
    return Math.round(Math.max(11, Math.min(30, w / (geom.items[i].name.length * 0.92))));
  };

  const drop = (geom.cell * .32).toFixed(1);
  return `<svg class="board" style="--cell:${geom.cell}px" viewBox="0 0 ${geom.w} ${geom.h}" preserveAspectRatio="xMidYMid ${fit}" aria-hidden="true">
    <defs>
      <pattern id="${gid}" width="${geom.cell * 2}" height="${geom.cell * 2}" patternUnits="userSpaceOnUse">
        <path d="M${geom.cell * 2} 0V${geom.cell * 2}H0" fill="none" stroke="#C97F6E" stroke-opacity=".15" stroke-width="1.5"/>
      </pattern>
    </defs>
    <rect width="${geom.w}" height="${geom.h}" fill="var(--terrain)"/>
    <rect width="${geom.w}" height="${geom.h}" fill="url(#${gid})"/>
    <g class="drop" transform="translate(${drop} ${(geom.cell * .416).toFixed(1)})">
      ${shapes.map(s => `<path d="${s.d}" data-name="${s.name}"/>`).join('')}
    </g>
    <g class="rings">
      ${shapes.map(s => `<path d="${s.d}" data-name="${s.name}"/>`).join('')}
    </g>
    <g class="lots">
      ${shapes.map(s => `<path d="${s.d}" data-name="${s.name}" style="--lot:${s.c}"/>`).join('')}
    </g>
    <g class="tags">
      ${geom.items.map((g, i) => `<text x="${g.c[0]}" y="${g.c[1]}" font-size="${size(i)}" data-name="${g.name}">${g.name}</text>`).join('')}
    </g>
  </svg>`;
}

const show = (mode, mark) =>
  mode === 'practice' ? true : mode === 'quiz' ? false : mark !== 'wait';

/* 상태만 칠한다 — 판을 다시 그리지 않아 타이핑 중에도 안 튄다. */
export function paintBoard(svg, run) {
  svg.querySelectorAll('[data-name]').forEach(el => {
    const mark = run.mark(el.dataset.name);
    el.setAttribute('class', mark);
    /* PRACTICE는 라벨을 늘 보여주고, QUIZ는 전부 숨긴다 (design.pen 05).
       숨겨도 현재 목표는 색 + 굵은 외곽선으로 이중 부호화된다. */
    if (el.tagName === 'text') el.style.display = show(run.mode, mark) ? '' : 'none';
  });
}
