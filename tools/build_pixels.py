"""행정경계 GeoJSON → 픽셀 격자. 스캔라인으로 채운다(셀마다 점 검사하면 느리다).

    python3 tools/build_pixels.py kr.json data/korea-pixels.json 34
    python3 tools/build_pixels.py ne-admin0.geojson data/jp-pixels.json 34 JP
"""
import json, math, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from optimize_pixels import optimize_local, plain_rows

src, dst = sys.argv[1], sys.argv[2]
COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 30
ISO = sys.argv[4].upper() if len(sys.argv) > 4 else ''

raw = json.load(open(src))['features']

def iso_of(p):
    eh = p.get('ISO_A2_EH') or ''
    a2 = p.get('ISO_A2') or ''
    a3 = p.get('ADM0_A3') or ''
    if eh and eh not in ('-99', '-1'):
        return eh
    if a2 and a2 not in ('-99', '-1'):
        return a2
    return a3

if ISO:
    feats = [f for f in raw if iso_of(f['properties']) == ISO]
    assert feats, f'ISO {ISO} 인 나라가 없다'
    HILITE, ANCHOR = None, ()
else:
    feats = raw
    HILITE = '서울특별시'
    ANCHOR = ('부산광역시', '울산광역시')


def rings(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates'][0]]
    return [p[0] for p in geom['coordinates']]

def area(ring):
    return abs(sum(ax * by - bx * ay for (ax, ay), (bx, by)
                   in zip(ring, ring[1:] + ring[:1]))) / 2

def centroid(ring):
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))

# 해외 영토가 경위도 상자를 지구 반 바퀴로 늘리면 본토가 한 칸이 된다.
# 가장 넓은 고리를 본토로 보고, 그 근처만 상자에 넣는다.
all_rings = [r for f in feats for r in rings(f['geometry'])]
if ISO and all_rings:
    home = max(all_rings, key=area)
    hx, hy = centroid(home)
    near = [r for r in all_rings
            if abs(centroid(r)[0] - hx) < 25 and abs(centroid(r)[1] - hy) < 25]
    if near:
        all_rings = near

pts = [c for r in all_rings for c in r]
lon0, lon1 = min(p[0] for p in pts), max(p[0] for p in pts)
lat0, lat1 = min(p[1] for p in pts), max(p[1] for p in pts)
k = math.cos(math.radians((lat0 + lat1) / 2))          # 경도 폭 보정
cell = (lon1 - lon0) * k / COLS
ROWS = max(1, round((lat1 - lat0) / cell))

grid = [['.'] * COLS for _ in range(ROWS)]

def cell_of(lon, lat):
    return round((lat1 - lat) / cell - .5), round((lon - lon0) * k / cell - .5)

def in_box(ring):
    x, y = centroid(ring)
    return lon0 <= x <= lon1 and lat0 <= y <= lat1

def paint(geom, mark):
    for ring in rings(geom):
        if ISO and not in_box(ring):
            continue
        hit = False
        for row in range(ROWS):
            # 셀 중심의 위도에서 가로선을 긋고 교차점 사이를 채운다
            y = lat1 - (row + .5) * cell
            xs = []
            for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
                if (ay > y) != (by > y):
                    xs.append(ax + (y - ay) * (bx - ax) / (by - ay))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                c0 = max(0, math.ceil((xs[i] * k - lon0 * k) / cell - .5))
                c1 = min(COLS - 1, math.floor((xs[i + 1] * k - lon0 * k) / cell - .5))
                for c in range(c0, c1 + 1):
                    grid[row][c] = mark; hit = True
        if hit:
            continue
        # 셀(약 19km)보다 작은 섬은 스캔라인이 통째로 비껴간다. 울릉도가 그렇게
        # 사라졌다. 한 칸도 못 칠한 폴리곤은 중심이 놓인 칸을 찍어 살린다.
        lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
        r, c = cell_of((min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2)
        if 0 <= r < ROWS and 0 <= c < COLS:
            grid[r][c] = mark

for f in feats:
    if not HILITE or f['properties'].get('name') != HILITE:
        paint(f['geometry'], 'x')
for f in feats:                                        # 서울을 나중에 덮어쓴다
    if HILITE and f['properties'].get('name') == HILITE:
        paint(f['geometry'], 'S')

if ANCHOR:
    # 부산·울산이 차지한 칸을 따로 찍어 가장 오른쪽 열을 기억한다.
    # 동해안(포항 쪽)이 한 칸 더 튀어나와 있어 도형 경계로 여백을 잡으면 어긋난다.
    mark = [['.'] * COLS for _ in range(ROWS)]
    grid, mark = mark, grid
    for f in feats:
        if f['properties'].get('name') in ANCHOR:
            paint(f['geometry'], 'A')
    anchor_cols = [c for r in grid for c in range(COLS) if r[c] == 'A']
    grid, mark = mark, grid
    anchor = max(anchor_cols) if anchor_cols else COLS - 1
else:
    anchor = COLS - 1

# 바깥쪽 빈 여백을 걷어낸다
while grid and set(grid[0]) == {'.'}: grid.pop(0)
while grid and set(grid[-1]) == {'.'}: grid.pop()
def col_empty(c): return all(r[c] == '.' for r in grid)
while grid and col_empty(0):
    grid = [r[1:] for r in grid]; anchor -= 1
while grid and col_empty(len(grid[0]) - 1): grid = [r[:-1] for r in grid]
assert grid and grid[0], f'{ISO or "map"} 픽셀이 비었다'
COLS, ROWS = len(grid[0]), len(grid)
if not ANCHOR:
    # 잘린 뒤 오른쪽 끝이 곧 나라의 동쪽이다
    for c in range(COLS - 1, -1, -1):
        if not col_empty(c):
            anchor = c
            break

rows = [''.join(r) for r in grid]
out = optimize_local({'w': COLS, 'h': ROWS, 'anchor': anchor, 'rows': rows})
json.dump(out, open(dst, 'w'), separators=(',', ':'))
show = plain_rows(out)
print('\n'.join(show))
print(f'anchor = 열 {out["anchor"]} / 전체 폭 {out["w"]}')
print(f'{out["w"]}x{out["h"]}, land={sum(r.count("x") for r in show)}, seoul={sum(r.count("S") for r in show)}')
