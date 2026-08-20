"""GeoJSON -> 화면 좌표 SVG path. 서울만 다루므로 위도 보정한 등거리 투영으로 충분하다."""
import json, math, sys

W = 1000.0
src, dst = sys.argv[1], sys.argv[2]
feats = json.load(open(src))["features"]

lats = [c[1] for f in feats for c in f["geometry"]["coordinates"][0]]
lons = [c[0] for f in feats for c in f["geometry"]["coordinates"][0]]
lat0 = (min(lats) + max(lats)) / 2
k = math.cos(math.radians(lat0))          # 경도 1도의 실제 폭 보정
x0, x1 = min(lons) * k, max(lons) * k
s = W / (x1 - x0)
H = round((max(lats) - min(lats)) * s, 1)

def px(lon, lat):
    return round((lon * k - x0) * s, 1), round((max(lats) - lat) * s, 1)

items = []
for f in feats:
    ring = f["geometry"]["coordinates"][0]
    pts = [px(*c) for c in ring]
    d = "M" + "L".join(f"{x} {y}" for x, y in pts) + "Z"
    # 면적 가중 중심 (label 위치용) — 단순 평균은 해안선 굴곡에 끌려간다
    a = cx = cy = 0.0
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        cr = ax * by - bx * ay
        a += cr; cx += (ax + bx) * cr; cy += (ay + by) * cr
    a *= 0.5
    items.append({"name": f["properties"]["name"], "d": d,
                  "c": [round(cx / (6 * a), 1), round(cy / (6 * a), 1)]})

json.dump({"w": W, "h": H, "items": items}, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(items)} items, viewBox 0 0 {W} {H}")
