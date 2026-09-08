"""GeoJSON → 화면 좌표. 위도 보정한 등거리 투영.

구역은 도형이 아니라 도트 격자로 나간다. 격자 한 칸이 화면의 원 하나가 되고,
칸마다 그 자리를 차지한 항목 번호가 들어간다. 정답을 맞히면 그 번호의 도트만
색이 찬다.
"""
import json, math, sys

# 0-9a-z 36자는 서울 25구에 충분하다. 필리핀 주(118)까지 받으려면 더 필요하다.
# BMP 안만 쓴다 — 격자 문자열을 [...row] 로 풀 때 서로게이트가 끼면 칸이 어긋난다.
SYM = (
    '0123456789abcdefghijklmnopqrstuvwxyz'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    'αβγδεζηθικλμνξοπρστυφχψω'
    'àáâãäåæçèéêëìíîïñòóôõöøùúûüýþ'
    'ăąćčďđęěğįłńňőřśşťůźżž'
)
W = 1000.0
src, dst = sys.argv[1], sys.argv[2]
COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 32
PREFIX = sys.argv[4] if len(sys.argv) > 4 else ""      # 코드 접두로 한 구만 뽑을 때

feats = [f for f in json.load(open(src))["features"]
         if str(f["properties"].get("code", "")).startswith(PREFIX)]
assert feats, f"코드 {PREFIX!r} 로 시작하는 항목이 없다"
assert len(feats) <= len(SYM), f'항목 {len(feats)}개가 격자 기호 {len(SYM)}개를 넘는다'

def outers(f):
    """겉 테두리. 구멍은 버리고, 떨어진 섬은 모두 칠한다."""
    g = f["geometry"]
    if g["type"] == "Polygon":
        return [g["coordinates"][0]]
    return [p[0] for p in g["coordinates"]]

lats = [c[1] for f in feats for r in outers(f) for c in r]
lons = [c[0] for f in feats for r in outers(f) for c in r]
k = math.cos(math.radians((min(lats) + max(lats)) / 2))   # 경도 1도의 실제 폭 보정
x0 = min(lons) * k
s = W / (max(lons) * k - x0)
H = round((max(lats) - min(lats)) * s, 1)

def px(lon, lat):
    return (lon * k - x0) * s, (max(lats) - lat) * s

def center(parts):
    """가장 큰 조각의 무게중심. 스캔라인이 비껴갔을 때 대신 짚을 자리다."""
    ring = max(parts, key=len)
    return (sum(p[0] for p in ring) / len(ring),
            sum(p[1] for p in ring) / len(ring))

rings = [[[px(*c) for c in ring] for ring in outers(f)] for f in feats]
# 가운뎃점은 키보드로 치기 어렵다. 이름은 곧 타이핑 대상이라 콤마로 바꿔 둔다
names = [f["properties"]["name"].replace("·", ",") for f in feats]

cell = W / COLS
ROWS = math.ceil(H / cell)
grid = [[None] * COLS for _ in range(ROWS)]

def fill(ring, idx):
    hit = False
    for row in range(ROWS):
        y = (row + .5) * cell                      # 셀 중심에 가로선을 긋는다
        xs = sorted(ax + (y - ay) * (bx - ax) / (by - ay)
                    for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1])
                    if (ay > y) != (by > y))
        for i in range(0, len(xs) - 1, 2):
            c0 = max(0, math.ceil(xs[i] / cell - .5))
            c1 = min(COLS - 1, math.floor(xs[i + 1] / cell - .5))
            for c in range(c0, c1 + 1):
                if grid[row][c] is None:           # 경계는 먼저 온 구가 갖는다
                    grid[row][c] = idx
                    hit = True
    return hit

for i, parts in enumerate(rings):
    hit = False
    for ring in parts:
        if fill(ring, i):
            hit = True
    if hit:
        continue
    # 셀보다 작은 구는 스캔라인이 통째로 비껴간다 — 중심 칸을 준다
    cx, cy = center(parts)
    grid[min(ROWS - 1, int(cy / cell))][min(COLS - 1, int(cx / cell))] = i

counts = [0] * len(feats)
for row in grid:
    for v in row:
        if v is not None:
            counts[v] += 1

def nearest_empty(cx, cy):
    """스캔라인이 전부 남의 칸이면 가장 가까운 빈 칸을 준다."""
    tr, tc = cy / cell, cx / cell
    best, bd = None, 1e18
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r][c] is not None:
                continue
            d = (r - tr) ** 2 + (c - tc) ** 2
            if d < bd:
                bd, best = d, (r, c)
    return best

for i, c in enumerate(counts):
    if c:
        continue
    at = nearest_empty(*center(rings[i]))
    if at:
        grid[at[0]][at[1]] = i
        counts[i] = 1

assert all(counts), f'도트를 못 받은 항목: {[names[i] for i, c in enumerate(counts) if not c]}'

items = []
for i, name in enumerate(names):
    cs = [(c, r) for r in range(ROWS) for c in range(COLS) if grid[r][c] == i]
    # 라벨·건물 자리는 그 구가 실제로 차지한 도트의 평균. 도형 중심은 강·굴곡에 끌려간다
    items.append({"name": name,
                  "c": [round((sum(c for c, _ in cs) / len(cs) + .5) * cell, 1),
                        round((sum(r for _, r in cs) / len(cs) + .5) * cell, 1)]})

json.dump({"w": W, "h": H, "cols": COLS, "rows_n": ROWS, "cell": round(cell, 3),
           "grid": [''.join('.' if v is None else SYM[v] for v in row) for row in grid],
           "items": items},
          open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(items)} items, {COLS}x{ROWS} 격자, 도트 {sum(counts)}개, viewBox 0 0 {W} {H}")
print('구별 도트:', ', '.join(f'{n}={c}' for n, c in zip(names, counts)))
