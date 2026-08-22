"""행정동 GeoJSON → Mini Motorways 식 보드.

한 동이 하나의 '큰집'이 되고, 맞닿은 동끼리 길로 이어진다. 동 안에는
작은 집들이 흩어진다. 그래서 이 스크립트가 내보내는 것은 네 가지다.

  d       동의 땅 모양 (SVG path)
  c       큰집 자리 — 도형 중심이 아니라 경계에서 가장 먼 안쪽 점.
          오목한 동(공항동처럼)에서 중심이 땅 밖으로 나가는 걸 막는다
  houses  작은 집터 — 큰집을 피해 안쪽에 흩뿌린다
  adj     맞닿은 동 쌍 — 길을 놓을 수 있는 곳
"""
import json, math, sys, random

W = 1000.0
GRID = 150                      # 안쪽 거리·인접 판정을 위한 래스터 해상도

src, dst, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
feats = [f for f in json.load(open(src))["features"]
         if str(f["properties"]["code"]).startswith(prefix)]
assert feats, f"코드 {prefix} 로 시작하는 동이 없다"

def rings(g):
    return [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]

pts = [c for f in feats for r in rings(f["geometry"]) for c in r]
lon0, lon1 = min(p[0] for p in pts), max(p[0] for p in pts)
lat0, lat1 = min(p[1] for p in pts), max(p[1] for p in pts)
k = math.cos(math.radians((lat0 + lat1) / 2))
s = W / ((lon1 - lon0) * k)
H = round((lat1 - lat0) * s, 1)

def px(lon, lat):
    return (lon * k - lon0 * k) * s, (lat1 - lat) * s

shapes = [[[px(*c) for c in r] for r in rings(f["geometry"])] for f in feats]
names = [f["properties"]["name"] for f in feats]

# ── 래스터: 칸마다 어느 동인지 ──────────────────────────────
cell = W / GRID
ROWS = math.ceil(H / cell)
own = [[-1] * GRID for _ in range(ROWS)]

def burn(polys, idx):
    for ring in polys:
        for row in range(ROWS):
            y = (row + .5) * cell
            xs = sorted(ax + (y - ay) * (bx - ax) / (by - ay)
                        for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1])
                        if (ay > y) != (by > y))
            for i in range(0, len(xs) - 1, 2):
                for c in range(max(0, math.ceil(xs[i] / cell - .5)),
                               min(GRID - 1, math.floor(xs[i + 1] / cell - .5)) + 1):
                    if own[row][c] == -1:
                        own[row][c] = idx

for i, sh in enumerate(shapes):
    burn(sh, i)

# ── 안쪽 거리 (경계에서 몇 칸 들어왔나) ─────────────────────
INF = 10 ** 6
dist = [[0 if own[r][c] == -1 else INF for c in range(GRID)] for r in range(ROWS)]
for r in range(ROWS):                                    # 자기 동이 아닌 이웃이면 경계
    for c in range(GRID):
        if own[r][c] == -1:
            continue
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if not (0 <= nr < ROWS and 0 <= nc < GRID) or own[nr][nc] != own[r][c]:
                dist[r][c] = 1
                break
for _ in range(2):                                       # 두 번 훑는 chamfer 변환
    rows = range(ROWS) if _ == 0 else range(ROWS - 1, -1, -1)
    for r in rows:
        cols = range(GRID) if _ == 0 else range(GRID - 1, -1, -1)
        for c in cols:
            if dist[r][c] == 0:
                continue
            for dr, dc in (((-1, 0), (0, -1)) if _ == 0 else ((1, 0), (0, 1))):
                nr, nc = r + dr, c + dc
                if 0 <= nr < ROWS and 0 <= nc < GRID and own[nr][nc] == own[r][c]:
                    dist[r][c] = min(dist[r][c], dist[nr][nc] + 1)

# ── 맞닿은 동 ────────────────────────────────────────────
adj = set()
for r in range(ROWS):
    for c in range(GRID):
        a = own[r][c]
        if a == -1:
            continue
        for dr, dc in ((1, 0), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < ROWS and 0 <= nc < GRID:
                b = own[nr][nc]
                if b != -1 and b != a:
                    adj.add((min(a, b), max(a, b)))

# ── 큰집 자리와 작은 집터 ────────────────────────────────
rnd = random.Random(20260822)
items = []
for i, sh in enumerate(shapes):
    mine = [(r, c) for r in range(ROWS) for c in range(GRID) if own[r][c] == i]
    assert mine, f"{names[i]} 가 래스터에 한 칸도 없다"
    br, bc = max(mine, key=lambda rc: dist[rc[0]][rc[1]])          # 가장 깊은 안쪽
    big = [round((bc + .5) * cell, 1), round((br + .5) * cell, 1)]

    # 작은 집: 안쪽으로 두 칸 이상 들어온 자리에서 큰집을 피해 고른다
    room = [(r, c) for r, c in mine if dist[r][c] >= 2]
    rnd.shuffle(room)
    houses, taken = [], []
    for r, c in room:
        x, y = (c + .5) * cell, (r + .5) * cell
        if math.hypot(x - big[0], y - big[1]) < cell * 3.4:
            continue
        if any(math.hypot(x - hx, y - hy) < cell * 2.6 for hx, hy, _ in taken):
            continue
        taken.append((x, y, 0))
        houses.append([round(x, 1), round(y, 1), rnd.randrange(4)])
        if len(houses) >= 9:
            break

    d = "".join("M" + "L".join(f"{round(x,1)} {round(y,1)}" for x, y in ring) + "Z" for ring in sh)
    items.append({"name": names[i], "d": d, "c": big, "houses": houses})

json.dump({"w": W, "h": H, "items": items,
           "adj": sorted([a, b] for a, b in adj)},
          open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(items)}개 동, viewBox 0 0 {W} {H}, 인접 {len(adj)}쌍")
for it in items:
    print(f"  {it['name']:>6}  큰집 {it['c']}  집 {len(it['houses'])}채")
