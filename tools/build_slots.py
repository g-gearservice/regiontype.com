"""geom 에 로드맵용 칸 배치를 얹는다.

로드맵(미니 모터웨이즈 방식)은 타일을 칸에 정렬해야 한다. 에셋이 좌우
꼭지로 이어지는 구조라, 실제 중심에 두면 길이 사선으로 꺾여 꼭지가
맞지 않는다. 그래서 중심을 칸에 붙이되 겹치면 가장 가까운 빈 칸으로
밀어낸다. 도트 격자(cols/rows_n)는 건드리지 않는다.
"""
import json, math, sys

src = sys.argv[1]
COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 0
ROWS = int(sys.argv[3]) if len(sys.argv) > 3 else 0

g = json.load(open(src))
its, W, H = g['items'], g['w'], g['h']
n = len(its)

if not COLS:                       # 항목 하나당 칸 3.6 개쯤이 성기지도 빽빽하지도 않다
    COLS = max(4, round(math.sqrt(n * 3.6 * W / H)))
    ROWS = max(4, round(COLS * H / W))

def snap(cols, rows):
    taken, slot = {}, {}
    # 서쪽부터 자리를 잡는다 — 순서를 고정해야 다시 돌려도 같은 배치가 나온다
    for i in sorted(range(n), key=lambda i: (its[i]['c'][0], its[i]['c'][1])):
        cx, cy = its[i]['c']
        c0 = min(cols - 1, max(0, round(cx / W * (cols - 1))))
        r0 = min(rows - 1, max(0, round(cy / H * (rows - 1))))
        best = min(((r - r0) ** 2 + (c - c0) ** 2, r, c)
                   for r in range(rows) for c in range(cols) if (r, c) not in taken)
        _, r, c = best
        taken[(r, c)] = i
        slot[i] = [c, r]
    return slot, taken

slot, taken = snap(COLS, ROWS)
moved = sum(1 for i in range(n)
            if slot[i] != [min(COLS - 1, max(0, round(its[i]['c'][0] / W * (COLS - 1)))),
                           min(ROWS - 1, max(0, round(its[i]['c'][1] / H * (ROWS - 1))))])

for i, it in enumerate(its):
    it['s'] = slot[i]
g['slots'] = {'cols': COLS, 'rows': ROWS}
json.dump(g, open(src, 'w'), ensure_ascii=False, separators=(',', ':'))

print(f"{src}  {COLS}x{ROWS} 칸 · 항목 {n} · 자리 옮김 {moved}")
for r in range(ROWS):
    print("  " + "".join(f"{its[taken[(r,c)]]['name'][:-1]:<5}" if (r, c) in taken else "  .  "
                         for c in range(COLS)))
